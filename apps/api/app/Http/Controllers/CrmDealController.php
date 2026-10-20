<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmDeal;
use App\Models\CrmDealEvent;
use App\Models\CrmPipeline;
use App\Models\CrmPipelineStage;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CrmDealController
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'pipeline_id' => ['sometimes', 'uuid'],
            'q' => ['sometimes', 'string', 'max:120'],
        ]);
        $query = CrmDeal::query();
        if (isset($input['pipeline_id'])) $query->where('pipeline_id', $input['pipeline_id']);
        if (isset($input['q']) && trim($input['q']) !== '') {
            $needle = '%'.addcslashes(trim($input['q']), '%_\\').'%';
            $query->where('name', 'ilike', $needle);
        }
        $page = $query->orderByDesc('created_at')->orderBy('id')->paginate($input['pageSize'] ?? 25);
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
        return response()->json(['ok' => true, 'data' => CrmDeal::query()->findOrFail($id)]);
    }

    public function events(string $id): JsonResponse
    {
        $deal = CrmDeal::query()->findOrFail($id);
        return response()->json(['ok' => true, 'data' =>
            $deal->events()->limit(100)->get(),
        ]);
    }

    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate($this->rules(false));
        $this->validateLinks($input);
        $deal = DB::transaction(function () use ($request, $context, $input): CrmDeal {
            $deal = CrmDeal::forceCreate(array_merge($input, [
                'organization_id' => $context->organizationId, 'version' => 1,
                'amount' => $input['amount'] ?? 0,
                'currency' => $input['currency'] ?? 'USD',
            ]));
            $this->record($request, $deal, 'created', null, $deal->stage_id);
            AuditTrail::current($request, 'deal.created', 'deal', $deal->id);
            return $deal;
        });
        return response()->json(['ok' => true, 'data' => $deal], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $input = $request->validate(array_merge($this->rules(true), [
            'expected_version' => ['required', 'integer', 'min:1'],
        ]));
        $this->validateLinks($input);
        return DB::transaction(function () use ($request, $id, $input): JsonResponse {
            $deal = CrmDeal::query()->lockForUpdate()->findOrFail($id);
            $version = (int) $input['expected_version'];
            if ($deal->version !== $version) return $this->conflict();
            $patch = array_intersect_key($input, array_flip([
                'name', 'amount', 'currency', 'expected_close_date', 'notes', 'account_id',
            ]));
            $deal->forceFill(array_merge($patch, ['version' => $version + 1]))->save();
            $this->record($request, $deal, 'updated', null, null, ['fields' => array_keys($patch)]);
            AuditTrail::current($request, 'deal.updated', 'deal', $id, ['version' => $deal->version]);
            return response()->json(['ok' => true, 'data' => $deal->refresh()]);
        });
    }

    public function move(Request $request, string $id): JsonResponse
    {
        $input = $request->validate([
            'expected_version' => ['required', 'integer', 'min:1'],
            'stage_id' => ['required', 'uuid'],
            'pipeline_id' => ['prohibited'], 'organization_id' => ['prohibited'],
        ]);
        return DB::transaction(function () use ($request, $id, $input): JsonResponse {
            $deal = CrmDeal::query()->lockForUpdate()->findOrFail($id);
            if ($deal->version !== (int) $input['expected_version']) return $this->conflict();
            $stage = CrmPipelineStage::query()->where('pipeline_id', $deal->pipeline_id)
                ->find($input['stage_id']);
            if (!$stage) {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'validation_failed',
                    'message' => 'Choose a stage belonging to this deal pipeline.',
                ]], 422);
            }
            if ($deal->stage_id === $stage->id) {
                return response()->json(['ok' => true, 'data' => $deal]);
            }
            $from = $deal->stage_id;
            $deal->forceFill(['stage_id' => $stage->id, 'version' => $deal->version + 1])->save();
            $this->record($request, $deal, 'moved', $from, $stage->id, ['stage_kind' => $stage->kind]);
            AuditTrail::current($request, 'deal.moved', 'deal', $id, [
                'from_stage_id' => $from, 'to_stage_id' => $stage->id,
                'version' => $deal->version,
            ]);
            return response()->json(['ok' => true, 'data' => $deal->refresh()]);
        });
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return DB::transaction(function () use ($request, $id): JsonResponse {
            $deal = CrmDeal::query()->lockForUpdate()->findOrFail($id);
            $this->record($request, $deal, 'archived', $deal->stage_id, null);
            $deal->delete(); // soft delete preserves immutable deal timeline
            AuditTrail::current($request, 'deal.archived', 'deal', $id);
            return response()->json(['ok' => true, 'data' => ['id' => $id]]);
        });
    }

    private function validateLinks(array $input): void
    {
        if (array_key_exists('pipeline_id', $input) &&
            !CrmPipeline::query()->whereKey($input['pipeline_id'])->exists()) {
            throw ValidationException::withMessages(['pipeline_id' => 'Pipeline unavailable.']);
        }
        if (array_key_exists('stage_id', $input) &&
            !CrmPipelineStage::query()->where('pipeline_id', $input['pipeline_id'] ?? '')
                ->whereKey($input['stage_id'])->exists()) {
            throw ValidationException::withMessages(['stage_id' => 'Stage unavailable in this pipeline.']);
        }
        if (!empty($input['account_id']) &&
            !CrmAccount::query()->whereKey($input['account_id'])->exists()) {
            throw ValidationException::withMessages(['account_id' => 'Account unavailable in this organization.']);
        }
    }

    private function rules(bool $partial): array
    {
        return [
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'min:1', 'max:200'],
            'pipeline_id' => $partial ? ['prohibited'] : ['required', 'uuid'],
            'stage_id' => $partial ? ['prohibited'] : ['required', 'uuid'],
            'account_id' => ['sometimes', 'nullable', 'uuid'],
            'amount' => ['sometimes', 'numeric', 'min:0', 'max:99999999999999.99'],
            'currency' => ['sometimes', 'string', 'size:3', 'alpha:ascii'],
            'expected_close_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'],
            'id' => ['prohibited'], 'version' => ['prohibited'],
        ];
    }

    private function record(Request $request, CrmDeal $deal, string $action, ?string $from, ?string $to, array $metadata = []): void
    {
        CrmDealEvent::forceCreate([
            'organization_id' => $deal->organization_id, 'deal_id' => $deal->id,
            'actor_user_id' => $request->user()->getKey(), 'action' => $action,
            'from_stage_id' => $from, 'to_stage_id' => $to,
            'metadata' => $metadata, 'created_at' => now(),
        ]);
    }

    private function conflict(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => 'This deal changed elsewhere. Refresh before editing.',
            'retryable' => false,
        ]], 409);
    }
}
