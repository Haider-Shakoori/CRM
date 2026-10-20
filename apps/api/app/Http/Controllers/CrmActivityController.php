<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmActivity;
use App\Models\CrmActivityEvent;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Models\Lead;
use App\Models\OrganizationMembership;
use App\Support\AuditTrail;
use App\Support\SubscriptionEntitlements;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CrmActivityController
{
    private const SUBJECTS = [
        'lead_id' => Lead::class,
        'contact_id' => CrmContact::class,
        'account_id' => CrmAccount::class,
        'deal_id' => CrmDeal::class,
    ];

    public function assignees(OrganizationContext $context): JsonResponse
    {
        $items = OrganizationMembership::query()->where('organization_id', $context->organizationId)
            ->where('status', 'active')->with('user:id,name,email')->get()
            ->filter(fn ($membership) => $membership->user !== null)
            ->map(fn ($membership) => [
                'id' => $membership->user_id, 'name' => $membership->user->name,
                'email' => $membership->user->email, 'role' => $membership->role,
            ])->values()->all();
        return response()->json(['ok' => true, 'data' => $items]);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'kind' => ['sometimes', Rule::in(['task', 'call', 'meeting'])],
            'status' => ['sometimes', Rule::in(['open', 'completed', 'cancelled'])],
            'assigned_to' => ['sometimes', 'uuid'],
            'mine' => ['sometimes', 'boolean'],
            'q' => ['sometimes', 'string', 'max:120'],
            'due_before' => ['sometimes', 'date'],
            'due_from' => ['sometimes', 'date'],
            'due_to' => ['sometimes', 'date', 'after:due_from'],
        ]);
        $query = CrmActivity::query();
        if (isset($filters['kind'])) $query->where('kind', $filters['kind']);
        if (isset($filters['status'])) $query->where('status', $filters['status']);
        if (isset($filters['assigned_to'])) $query->where('assigned_to', $filters['assigned_to']);
        if ($request->boolean('mine')) $query->where('assigned_to', $request->user()->id);
        if (isset($filters['due_before'])) $query->where('due_at', '<', $filters['due_before']);
        if (isset($filters['due_from'])) $query->where('due_at', '>=', $filters['due_from']);
        if (isset($filters['due_to'])) $query->where('due_at', '<', $filters['due_to']);
        if (isset($filters['q']) && trim($filters['q']) !== '') {
            $needle = '%'.addcslashes(trim($filters['q']), '%_\\').'%';
            $query->where('title', 'ilike', $needle);
        }
        $page = $query->orderByRaw('due_at ASC NULLS LAST')->orderBy('id')
            ->paginate($filters['pageSize'] ?? 25);
        return response()->json(['ok' => true, 'data' => [
            'items' => $page->items(),
            'meta' => [
                'page' => $page->currentPage(), 'pageSize' => $page->perPage(),
                'total' => $page->total(), 'totalPages' => $page->lastPage(),
                'hasNext' => $page->hasMorePages(), 'hasPrev' => $page->currentPage() > 1,
            ],
        ]]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => CrmActivity::query()->findOrFail($id)]);
    }

    public function events(string $id): JsonResponse
    {
        $item = CrmActivity::query()->findOrFail($id);
        return response()->json(['ok' => true, 'data' => $item->events()->limit(100)->get()]);
    }

    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $data = $request->validate($this->rules(false));
        $this->validateLinks($data, $context);
        $activity = DB::transaction(function () use ($request, $context, $data): CrmActivity {
            SubscriptionEntitlements::guardCreate($context->tenantId, 'activities');
            $status = $data['status'] ?? 'open';
            $activity = CrmActivity::forceCreate(array_merge($data, [
                'organization_id' => $context->organizationId,
                'assigned_to' => $data['assigned_to'] ?? $request->user()->id,
                'version' => 1,
                'status' => $status,
                'completed_at' => $status === 'completed' ? now() : null,
            ]));
            $this->record($request, $activity, 'created', ['status' => $activity->status]);
            AuditTrail::current($request, 'activity.created', 'activity', $activity->id);
            return $activity;
        });
        return response()->json(['ok' => true, 'data' => $activity], 201);
    }

    public function update(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $data = $request->validate(array_merge($this->rules(true), [
            'expected_version' => ['required', 'integer', 'min:1'],
        ]));
        return DB::transaction(function () use ($request, $context, $id, $data): JsonResponse {
            $item = CrmActivity::query()->lockForUpdate()->findOrFail($id);
            if ($item->version !== (int) $data['expected_version']) return $this->conflict();
            $this->validateLinks($data, $context, $item);
            $patch = array_intersect_key($data, array_flip([
                'title', 'kind', 'status', 'notes', 'due_at', 'remind_at', 'assigned_to',
                'lead_id', 'contact_id', 'account_id', 'deal_id',
            ]));
            if (isset($patch['status']) && $patch['status'] !== $item->status) {
                $patch['completed_at'] = $patch['status'] === 'completed' ? now() : null;
            }
            $previous = $item->status;
            $item->forceFill(array_merge($patch, ['version' => $item->version + 1]))->save();
            $this->record($request, $item, $previous !== $item->status ? 'status_changed' : 'updated',
                ['from_status' => $previous, 'to_status' => $item->status, 'fields' => array_keys($patch)]);
            AuditTrail::current($request, 'activity.updated', 'activity', $item->id,
                ['version' => $item->version, 'status' => $item->status]);
            return response()->json(['ok' => true, 'data' => $item->refresh()]);
        });
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return DB::transaction(function () use ($request, $id): JsonResponse {
            $item = CrmActivity::query()->lockForUpdate()->findOrFail($id);
            $this->record($request, $item, 'archived');
            $item->delete();
            AuditTrail::current($request, 'activity.archived', 'activity', $id);
            return response()->json(['ok' => true, 'data' => ['id' => $id]]);
        });
    }

    private function rules(bool $partial): array
    {
        $require = $partial ? 'sometimes' : 'required';
        return [
            'title' => [$require, 'string', 'min:1', 'max:200'],
            'kind' => [$require, Rule::in(['task', 'call', 'meeting'])],
            'status' => ['sometimes', Rule::in(['open', 'completed', 'cancelled'])],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'due_at' => ['sometimes', 'nullable', 'date'],
            'remind_at' => ['sometimes', 'nullable', 'date'],
            'assigned_to' => ['sometimes', 'uuid'],
            'lead_id' => ['sometimes', 'nullable', 'uuid'],
            'contact_id' => ['sometimes', 'nullable', 'uuid'],
            'account_id' => ['sometimes', 'nullable', 'uuid'],
            'deal_id' => ['sometimes', 'nullable', 'uuid'],
            'id' => ['prohibited'], 'organization_id' => ['prohibited'],
            'tenant_id' => ['prohibited'], 'version' => ['prohibited'],
            'completed_at' => ['prohibited'], 'created_at' => ['prohibited'],
        ];
    }

    private function validateLinks(array $data, OrganizationContext $context, ?CrmActivity $current = null): void
    {
        $assignee = $data['assigned_to'] ?? $current?->assigned_to ?? request()->user()->id;
        if (!OrganizationMembership::query()->where('organization_id', $context->organizationId)
            ->where('user_id', $assignee)->where('status', 'active')->exists()) {
            throw ValidationException::withMessages(['assigned_to' => 'Choose an active organization member.']);
        }
        $subjects = [];
        foreach (self::SUBJECTS as $field => $model) {
            $id = array_key_exists($field, $data) ? $data[$field] : $current?->$field;
            if ($id !== null) {
                $subjects[] = $field;
                if (!$model::query()->whereKey($id)->exists()) {
                    throw ValidationException::withMessages([$field => 'Record not found in this organization.']);
                }
            }
        }
        if (count($subjects) > 1) {
            throw ValidationException::withMessages(['subject' => 'Link only one CRM record per activity.']);
        }
    }

    private function record(Request $request, CrmActivity $item, string $action, array $metadata = []): void
    {
        CrmActivityEvent::forceCreate([
            'organization_id' => $item->organization_id,
            'activity_id' => $item->id, 'actor_user_id' => $request->user()->id,
            'action' => $action, 'metadata' => $metadata, 'created_at' => now(),
        ]);
    }

    private function conflict(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => 'Activity changed elsewhere. Refresh before editing.',
            'retryable' => false,
        ]], 409);
    }
}
