<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Models\CrmNote;
use App\Models\Lead;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CrmTimelineController
{
    private const SUBJECTS = [
        'lead' => ['lead_id', Lead::class],
        'contact' => ['contact_id', CrmContact::class],
        'account' => ['account_id', CrmAccount::class],
        'deal' => ['deal_id', CrmDeal::class],
    ];

    private function validateSubject(string $type, string $id): string
    {
        $def = self::SUBJECTS[$type] ?? null;
        if (!$def || !Str::isUuid($id)) {
            throw ValidationException::withMessages(['subject' => 'Choose a valid CRM record.']);
        }
        if (!$def[1]::query()->whereKey($id)->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'Record unavailable in this organization.']);
        }
        return $def[0];
    }

    /** Unified, server-paginated history of real CRM notes and logged activities. */
    public function index(Request $request, OrganizationContext $context): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'subject_id' => ['required', 'uuid'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $column = $this->validateSubject($data['subject_type'], $data['subject_id']);
        $org = $context->organizationId;
        $notes = DB::table('crm_notes')->where('organization_id', $org)
            ->where($column, $data['subject_id'])->whereNull('deleted_at')
            ->selectRaw("id, 'note'::text as entry_type, title, body as description, 'note'::text as kind, NULL::text as status, created_by as actor_user_id, created_at");
        $activities = DB::table('crm_activities')->where('organization_id', $org)
            ->where($column, $data['subject_id'])->whereNull('deleted_at')
            ->selectRaw("id, 'activity'::text as entry_type, title, notes as description, kind::text as kind, status::text as status, assigned_to as actor_user_id, created_at");
        $joined = $notes->unionAll($activities);
        $page = DB::query()->fromSub($joined, 'entries')
            ->leftJoin('users as actors', 'actors.id', '=', 'entries.actor_user_id')
            ->select('entries.*', 'actors.name as actor_name')
            ->orderByDesc('entries.created_at')->orderByDesc('entries.id')
            ->paginate($data['pageSize'] ?? 25, ['*'], 'page', $data['page'] ?? 1);
        return response()->json(['ok' => true, 'data' => [
            'subject_type' => $data['subject_type'], 'subject_id' => $data['subject_id'],
            'items' => $page->items(),
            'meta' => ['page' => $page->currentPage(), 'pageSize' => $page->perPage(),
                'total' => $page->total(), 'totalPages' => $page->lastPage(),
                'hasNext' => $page->hasMorePages(), 'hasPrev' => $page->currentPage() > 1],
        ]]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => CrmNote::query()->findOrFail($id)]);
    }

    public function events(string $id): JsonResponse
    {
        CrmNote::query()->findOrFail($id);
        $events = DB::table('crm_note_events')->where('organization_id', app(OrganizationContext::class)->organizationId)
            ->where('note_id', $id)->orderByDesc('created_at')->orderByDesc('id')
            ->limit(100)->get();
        return response()->json(['ok' => true, 'data' => $events]);
    }

    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'subject_id' => ['required', 'uuid'],
            'title' => ['required', 'string', 'min:1', 'max:200'],
            'body' => ['required', 'string', 'min:1', 'max:20000'],
            'organization_id' => ['prohibited'], 'created_by' => ['prohibited'],
            'version' => ['prohibited'], 'id' => ['prohibited'],
            'lead_id' => ['prohibited'], 'contact_id' => ['prohibited'],
            'account_id' => ['prohibited'], 'deal_id' => ['prohibited'],
        ]);
        $column = $this->validateSubject($data['subject_type'], $data['subject_id']);
        $title = trim($data['title']);
        $body = trim($data['body']);
        if ($title === '' || $body === '') {
            throw ValidationException::withMessages(['body' => 'A non-empty title and note body are required.']);
        }
        return DB::transaction(function () use ($request, $context, $data, $column, $title, $body) {
            $note = CrmNote::forceCreate([
                'organization_id' => $context->organizationId,
                'created_by' => $request->user()->id, 'title' => $title, 'body' => $body,
                $column => $data['subject_id'], 'version' => 1,
            ]);
            $this->event($request, $note, 'created');
            AuditTrail::current($request, 'note.created', 'note', $note->id, [
                'subject_type' => $data['subject_type'], 'subject_id' => $data['subject_id'],
            ]);
            return response()->json(['ok' => true, 'data' => $note], 201);
        });
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'expected_version' => ['required', 'integer', 'min:1'],
            'title' => ['sometimes', 'string', 'min:1', 'max:200'],
            'body' => ['sometimes', 'string', 'min:1', 'max:20000'],
            'subject_type' => ['prohibited'], 'subject_id' => ['prohibited'],
            'organization_id' => ['prohibited'], 'created_by' => ['prohibited'],
            'version' => ['prohibited'], 'id' => ['prohibited'],
            'lead_id' => ['prohibited'], 'contact_id' => ['prohibited'],
            'account_id' => ['prohibited'], 'deal_id' => ['prohibited'],
        ]);
        foreach (['title', 'body'] as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = trim($data[$field]);
                if ($data[$field] === '') {
                    throw ValidationException::withMessages([$field => 'Cannot be empty.']);
                }
            }
        }
        return DB::transaction(function () use ($request, $id, $data) {
            $note = CrmNote::query()->lockForUpdate()->findOrFail($id);
            if ((int) $note->version !== (int) $data['expected_version']) return $this->conflict();
            $changes = array_intersect_key($data, array_flip(['title', 'body']));
            if (!$changes) {
                throw ValidationException::withMessages(['body' => 'Provide a title or body change.']);
            }
            $note->forceFill($changes + ['version' => $note->version + 1])->save();
            $this->event($request, $note, 'updated', ['version' => $note->version, 'fields' => array_keys($changes)]);
            AuditTrail::current($request, 'note.updated', 'note', $note->id, ['version' => $note->version]);
            return response()->json(['ok' => true, 'data' => $note->refresh()]);
        });
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['expected_version' => ['required', 'integer', 'min:1']]);
        return DB::transaction(function () use ($request, $id, $data) {
            $note = CrmNote::query()->lockForUpdate()->findOrFail($id);
            if ((int) $note->version !== (int) $data['expected_version']) return $this->conflict();
            $this->event($request, $note, 'archived');
            $note->delete();
            AuditTrail::current($request, 'note.archived', 'note', $id);
            return response()->json(['ok' => true, 'data' => ['id' => $id]]);
        });
    }

    private function event(Request $request, CrmNote $note, string $action, array $metadata = []): void
    {
        DB::table('crm_note_events')->insert([
            'id' => (string) Str::uuid(), 'organization_id' => $note->organization_id,
            'note_id' => $note->id, 'actor_user_id' => $request->user()->id,
            'action' => $action, 'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }

    private function conflict(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => 'Note changed elsewhere. Refresh before editing.',
            'retryable' => false,
        ]], 409);
    }
}
