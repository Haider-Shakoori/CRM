<?php

namespace App\Http\Controllers;

use App\Models\CrmActivity;

use App\Models\Lead;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class LeadController
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'status' => ['sometimes', Rule::in(Lead::STATUSES)],
            'q' => ['sometimes', 'string', 'max:120'],
        ]);

        $query = Lead::query();
        if (isset($input['status'])) {
            $query->where('status', $input['status']);
        }
        if (isset($input['q']) && trim($input['q']) !== '') {
            // Escaped wildcard characters so user input is a literal contains search.
            $needle = addcslashes(trim($input['q']), '%_\\');
            $query->where('name', 'like', '%'.$needle.'%');
        }
        $page = $query->orderByDesc('created_at')->paginate($input['pageSize'] ?? 25);

        return response()->json(['ok' => true, 'data' => [
            'items' => $page->items(),
            'meta' => [
                'page' => $page->currentPage(),
                'pageSize' => $page->perPage(),
                'total' => $page->total(),
                'totalPages' => $page->lastPage(),
                'hasNext' => $page->hasMorePages(),
                'hasPrev' => $page->currentPage() > 1,
            ],
        ]]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => Lead::query()->findOrFail($id)]);
    }

    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate($this->rules(false));
        // Force ownership from validated server context. Never copy tenant/organization from payload.
        $lead = new Lead();
        $lead->forceFill([
            'organization_id' => $context->organizationId,
            'name' => $input['name'],
            'email' => $input['email'] ?? null,
            'status' => $input['status'] ?? 'new',
            'notes' => $input['notes'] ?? null,
            'version' => 1,
        ]);
        $lead->save();
        AuditTrail::current($request, 'lead.created', 'lead', $lead->id);

        return response()->json(['ok' => true, 'data' => $lead], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $input = $request->validate(array_merge($this->rules(true), [
            'expected_version' => ['required', 'integer', 'min:1'],
        ]));
        $lead = Lead::query()->findOrFail($id);

        if ($lead->version !== (int) $input['expected_version']) {
            return $this->conflict();
        }

        $patch = array_intersect_key($input, array_flip(['name', 'email', 'notes', 'status']));
        // Version condition ensures concurrent writers cannot silently overwrite each other.
        $updated = Lead::query()->whereKey($id)
            ->where('version', $lead->version)
            ->update(array_merge($patch, [
                'version' => $lead->version + 1,
                'updated_at' => now(),
            ]));
        if ($updated !== 1) {
            return $this->conflict();
        }

        AuditTrail::current($request, 'lead.updated', 'lead', $id, ['version' => $lead->version + 1]);
        return response()->json(['ok' => true, 'data' => Lead::query()->findOrFail($id)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $lead = Lead::query()->findOrFail($id);
        if (CrmActivity::withTrashed()->where('lead_id', $id)->exists()) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'conflict', 'message' => 'Unlink linked activities before deleting this lead.',
                'retryable' => false,
            ]], 409);
        }
        $lead->delete();
        AuditTrail::current($request, 'lead.deleted', 'lead', $id);

        return response()->json(['ok' => true, 'data' => ['id' => $id]]);
    }

    private function rules(bool $partial): array
    {
        $prefix = $partial ? 'sometimes' : 'required';
        return [
            'name' => [$prefix, 'string', 'min:1', 'max:200'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:254'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'status' => ['sometimes', Rule::in(Lead::STATUSES)],
            'organization_id' => ['prohibited'],
            'tenant_id' => ['prohibited'],
            'id' => ['prohibited'],
            'version' => ['prohibited'],
        ];
    }

    private function conflict(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict',
            'message' => 'This lead was updated elsewhere. Refresh before editing again.',
            'retryable' => false,
        ]], 409);
    }
}
