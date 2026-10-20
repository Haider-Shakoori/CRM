<?php

namespace App\Http\Controllers;

use App\Models\CrmPipeline;
use App\Models\CrmPipelineStage;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class CrmPipelineController
{
    public function index(): JsonResponse
    {
        return response()->json(['ok' => true, 'data' =>
            CrmPipeline::query()->with('stages')->orderBy('name')->orderBy('id')->get(),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['ok' => true, 'data' =>
            CrmPipeline::query()->with('stages')->findOrFail($id),
        ]);
    }

    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:150'],
            'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'],
            'id' => ['prohibited'], 'version' => ['prohibited'],
        ]);
        $pipeline = DB::transaction(function () use ($request, $context, $input): CrmPipeline {
            $pipeline = CrmPipeline::forceCreate([
                'organization_id' => $context->organizationId,
                'name' => $input['name'], 'version' => 1,
            ]);
            foreach ([
                ['Prospecting', 'open', 10], ['Qualification', 'open', 25],
                ['Proposal', 'open', 60], ['Won', 'won', 100], ['Lost', 'lost', 0],
            ] as $position => [$name, $kind, $probability]) {
                CrmPipelineStage::forceCreate([
                    'organization_id' => $context->organizationId,
                    'pipeline_id' => $pipeline->id,
                    'name' => $name, 'kind' => $kind, 'position' => $position + 1,
                    'probability' => $probability,
                ]);
            }
            AuditTrail::current($request, 'pipeline.created', 'pipeline', $pipeline->id);
            return $pipeline;
        });

        return response()->json(['ok' => true, 'data' => $pipeline->load('stages')], 201);
    }

    public function addStage(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:120'],
            'kind' => ['required', Rule::in(['open', 'won', 'lost'])],
            'probability' => ['sometimes', 'integer', 'between:0,100'],
            'organization_id' => ['prohibited'], 'pipeline_id' => ['prohibited'],
            'id' => ['prohibited'], 'position' => ['prohibited'],
        ]);
        $stage = DB::transaction(function () use ($request, $context, $id, $input): CrmPipelineStage {
            // Serialize concurrent stage additions for a single pipeline.
            $pipeline = CrmPipeline::query()->lockForUpdate()->findOrFail($id);
            $next = (int) CrmPipelineStage::query()->where('pipeline_id', $pipeline->id)->max('position') + 1;
            $stage = CrmPipelineStage::forceCreate([
                'organization_id' => $context->organizationId,
                'pipeline_id' => $pipeline->id, 'position' => $next,
                'name' => $input['name'], 'kind' => $input['kind'],
                'probability' => $input['kind'] === 'won' ? 100 : ($input['kind'] === 'lost' ? 0 : ($input['probability'] ?? 25)),
            ]);
            AuditTrail::current($request, 'pipeline.stage_created', 'pipeline_stage', $stage->id,
                ['pipeline_id' => $pipeline->id]);
            return $stage;
        });
        return response()->json(['ok' => true, 'data' => $stage], 201);
    }
    public function updateStageProbability(Request $request, string $id, string $stageId): JsonResponse
    {
        $input = $request->validate([
            'probability' => ['required', 'integer', 'between:0,100'],
            'organization_id' => ['prohibited'], 'kind' => ['prohibited'],
        ]);
        return DB::transaction(function () use ($request, $id, $stageId, $input): JsonResponse {
            CrmPipeline::query()->findOrFail($id);
            $stage = CrmPipelineStage::query()->where('pipeline_id', $id)->lockForUpdate()->findOrFail($stageId);
            if ($stage->kind !== 'open') {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'validation_failed', 'message' => 'Won and Lost stage probabilities are fixed.',
                    'retryable' => false,
                ]], 422);
            }
            $stage->forceFill(['probability' => $input['probability']])->save();
            AuditTrail::current($request, 'pipeline.stage_probability_updated', 'pipeline_stage', $stage->id, [
                'pipeline_id' => $id, 'probability' => $stage->probability,
            ]);
            return response()->json(['ok' => true, 'data' => $stage->refresh()]);
        });
    }

}
