<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Models\Lead;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CrmTagsController
{
    private const SUBJECTS = [
        'lead' => ['lead_id', Lead::class, 'leads'],
        'contact' => ['contact_id', CrmContact::class, 'crm_contacts'],
        'account' => ['account_id', CrmAccount::class, 'crm_accounts'],
        'deal' => ['deal_id', CrmDeal::class, 'crm_deals'],
    ];

    private function onlyAdministrators(Request $request): void
    {
        if (!in_array($request->attributes->get('crm_membership')?->role, ['owner', 'admin'], true)) {
            abort(403, 'Organization owner or administrator required.');
        }
    }

    private function subject(string $type, string $id): array
    {
        $definition = self::SUBJECTS[$type] ?? null;
        if (!$definition || !Str::isUuid($id) ||
            !$definition[1]::query()->whereKey($id)->exists()) {
            throw ValidationException::withMessages([
                'subject_id' => 'CRM record is unavailable in the selected organization.',
            ]);
        }
        return $definition;
    }

    private function conflict(string $reason): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => $reason, 'retryable' => false,
        ]], 409);
    }

    public function index(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate([
            'q' => ['sometimes', 'string', 'max:80'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $query = DB::table('crm_tags')->where('organization_id', $context->organizationId);
        if (!empty($input['q'])) {
            $safe = addcslashes(trim($input['q']), '%_\\');
            $query->where('name', 'ilike', '%'.$safe.'%');
        }
        $page = $query->orderBy('name')->orderBy('id')
            ->paginate($input['pageSize'] ?? 50, ['id', 'name', 'color', 'version', 'created_at'], 'page', $input['page'] ?? 1);
        return $this->paginate($page);
    }

    public function create(Request $request, OrganizationContext $context): JsonResponse
    {
        $this->onlyAdministrators($request);
        $input = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:80'],
            'color' => ['sometimes', 'regex:/^#[a-fA-F0-9]{6}$/'],
            'organization_id' => ['prohibited'], 'version' => ['prohibited'],
            'id' => ['prohibited'],
        ]);
        $name = trim($input['name']);
        if ($name === '') throw ValidationException::withMessages(['name' => 'Tag name is required.']);
        return DB::transaction(function () use ($request, $context, $name, $input) {
            DB::table('organizations')->where('id', $context->organizationId)->lockForUpdate()->first();
            if (DB::table('crm_tags')->where('organization_id', $context->organizationId)
                ->whereRaw('lower(trim(name)) = ?', [mb_strtolower($name)])->exists()) {
                return $this->conflict('A tag with that name already exists in this organization.');
            }
            $id = (string) Str::uuid();
            DB::table('crm_tags')->insert([
                'id' => $id, 'organization_id' => $context->organizationId,
                'name' => $name, 'color' => strtolower($input['color'] ?? '#64748b'),
                'version' => 1, 'created_at' => now(), 'updated_at' => now(),
            ]);
            AuditTrail::current($request, 'tag.created', 'tag', $id, ['name' => $name]);
            return response()->json(['ok' => true, 'data' => DB::table('crm_tags')->where('id', $id)->first()], 201);
        });
    }

    public function update(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $this->onlyAdministrators($request);
        $input = $request->validate([
            'expected_version' => ['required', 'integer', 'min:1'],
            'name' => ['sometimes', 'string', 'min:1', 'max:80'],
            'color' => ['sometimes', 'regex:/^#[a-fA-F0-9]{6}$/'],
            'organization_id' => ['prohibited'], 'id' => ['prohibited'], 'version' => ['prohibited'],
        ]);
        $updates = array_intersect_key($input, array_flip(['name', 'color']));
        if (!$updates) throw ValidationException::withMessages(['name' => 'Provide at least one change.']);
        if (isset($updates['name'])) {
            $updates['name'] = trim($updates['name']);
            if (!$updates['name']) throw ValidationException::withMessages(['name' => 'Tag name cannot be blank.']);
        }
        if (isset($updates['color'])) $updates['color'] = strtolower($updates['color']);
        return DB::transaction(function () use ($request, $context, $id, $input, $updates) {
            DB::table('organizations')->where('id', $context->organizationId)->lockForUpdate()->first();
            $query = DB::table('crm_tags')->where('organization_id', $context->organizationId)->where('id', $id);
            $current = (clone $query)->lockForUpdate()->first();
            if (!$current) abort(404);
            if ((int) $current->version !== (int) $input['expected_version']) {
                return $this->conflict('Tag changed. Refresh before editing.');
            }
            if (isset($updates['name']) && DB::table('crm_tags')
                ->where('organization_id', $context->organizationId)->where('id', '<>', $id)
                ->whereRaw('lower(trim(name)) = ?', [mb_strtolower($updates['name'])])->exists()) {
                return $this->conflict('Another tag already has that name.');
            }
            (clone $query)->update($updates + ['version' => $current->version + 1, 'updated_at' => now()]);
            AuditTrail::current($request, 'tag.updated', 'tag', $id,
                ['fields' => array_keys($updates), 'version' => $current->version + 1]);
            return response()->json(['ok' => true, 'data' => (clone $query)->first()]);
        });
    }

    public function destroy(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $this->onlyAdministrators($request);
        $input = $request->validate(['expected_version' => ['required', 'integer', 'min:1']]);
        return DB::transaction(function () use ($request, $context, $id, $input) {
            DB::table('organizations')->where('id', $context->organizationId)->lockForUpdate()->first();
            $query = DB::table('crm_tags')->where('organization_id', $context->organizationId)->where('id', $id);
            $current = (clone $query)->lockForUpdate()->first();
            if (!$current) abort(404);
            if ((int) $current->version !== (int) $input['expected_version']) return $this->conflict('Tag changed. Refresh before deletion.');
            if (DB::table('crm_tag_links')->where('organization_id', $context->organizationId)->where('tag_id', $id)->exists()) {
                return $this->conflict('Tag is assigned to CRM records. Unlink those records before deleting it.');
            }
            (clone $query)->delete();
            AuditTrail::current($request, 'tag.deleted', 'tag', $id);
            return response()->json(['ok' => true, 'data' => ['id' => $id]]);
        });
    }

    public function assignments(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'subject_id' => ['required', 'uuid'],
        ]);
        [$column] = $this->subject($input['subject_type'], $input['subject_id']);
        $items = DB::table('crm_tag_links as links')
            ->join('crm_tags as tags', function ($join) {
                $join->on('tags.id', '=', 'links.tag_id')->on('tags.organization_id', '=', 'links.organization_id');
            })
            ->where('links.organization_id', $context->organizationId)
            ->where('links.'.$column, $input['subject_id'])
            ->select('tags.id', 'tags.name', 'tags.color', 'links.created_at as linked_at')
            ->orderBy('tags.name')->limit(200)->get();
        return response()->json(['ok' => true, 'data' => $items]);
    }

    public function assign(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'subject_id' => ['required', 'uuid'],
            'tag_id' => ['required', 'uuid'],
            'organization_id' => ['prohibited'], 'created_by' => ['prohibited'],
        ]);
        return DB::transaction(function () use ($request, $context, $input) {
            DB::table('organizations')->where('id', $context->organizationId)->lockForUpdate()->first();
            [$column] = $this->subject($input['subject_type'], $input['subject_id']);
            $tag = DB::table('crm_tags')->where('organization_id', $context->organizationId)
                ->where('id', $input['tag_id'])->first();
            if (!$tag) throw ValidationException::withMessages(['tag_id' => 'Tag unavailable in this organization.']);
            if (DB::table('crm_tag_links')->where('organization_id', $context->organizationId)
                ->where('tag_id', $tag->id)->where($column, $input['subject_id'])->exists()) {
                return $this->conflict('This tag is already assigned to the CRM record.');
            }
            DB::table('crm_tag_links')->insert([
                'id' => (string) Str::uuid(), 'organization_id' => $context->organizationId,
                'tag_id' => $tag->id, $column => $input['subject_id'],
                'created_by' => $request->user()->id, 'created_at' => now(),
            ]);
            AuditTrail::current($request, 'tag.assigned', $input['subject_type'], $input['subject_id'], ['tag_id' => $tag->id]);
            return response()->json(['ok' => true, 'data' => ['tag_id' => $tag->id, 'name' => $tag->name]], 201);
        });
    }

    public function unassign(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'subject_id' => ['required', 'uuid'], 'tag_id' => ['required', 'uuid'],
        ]);
        return DB::transaction(function () use ($request, $context, $input) {
            DB::table('organizations')->where('id', $context->organizationId)->lockForUpdate()->first();
            [$column] = $this->subject($input['subject_type'], $input['subject_id']);
            $deleted = DB::table('crm_tag_links')->where('organization_id', $context->organizationId)
                ->where('tag_id', $input['tag_id'])->where($column, $input['subject_id'])->delete();
            if (!$deleted) abort(404);
            AuditTrail::current($request, 'tag.unassigned', $input['subject_type'], $input['subject_id'], [
                'tag_id' => $input['tag_id'],
            ]);
            return response()->json(['ok' => true, 'data' => ['tag_id' => $input['tag_id']]]);
        });
    }

    public function records(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $input = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        if (!DB::table('crm_tags')->where('organization_id', $context->organizationId)->where('id', $id)->exists()) abort(404);
        [, , $table] = self::SUBJECTS[$input['subject_type']];
        $column = self::SUBJECTS[$input['subject_type']][0];
        $label = match ($input['subject_type']) {
            'contact' => "concat_ws(' ', records.first_name, records.last_name)",
            default => 'records.name',
        };
        $query = DB::table($table.' as records')
            ->join('crm_tag_links as links', function ($join) use ($column) {
                $join->on('links.'.$column, '=', 'records.id')
                    ->on('links.organization_id', '=', 'records.organization_id');
            })->where('records.organization_id', $context->organizationId)
            ->where('links.tag_id', $id);
        if ($input['subject_type'] === 'deal') $query->whereNull('records.deleted_at');
        $page = $query->selectRaw('records.id, '.$label.' as label, records.created_at')
            ->orderByDesc('records.created_at')->orderByDesc('records.id')
            ->paginate($input['pageSize'] ?? 25, ['*'], 'page', $input['page'] ?? 1);
        return $this->paginate($page);
    }

    private function paginate($page): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => [
            'items' => $page->items(),
            'meta' => ['page' => $page->currentPage(), 'pageSize' => $page->perPage(),
                'total' => $page->total(), 'totalPages' => $page->lastPage(),
                'hasNext' => $page->hasMorePages(), 'hasPrev' => $page->currentPage() > 1],
        ]]);
    }
}
