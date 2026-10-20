<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmActivity;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Models\CrmPipeline;
use App\Models\Lead;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class CrmReportingController
{
    /**
     * Counts are live and scoped by the same fail-closed model scopes as the
     * underlying CRUD endpoints. No mock, cache, or cross-tenant aggregation.
     */
    public function overview(Request $request): JsonResponse
    {
        $org = $request->attributes->get('crm_organization');
        $zone = $org->timezone ?: 'UTC';
        $today = CarbonImmutable::now($zone)->startOfDay();
        $tomorrow = $today->addDay();
        $nextWeek = $today->addDays(7);
        $utcToday = $today->setTimezone('UTC');
        $utcTomorrow = $tomorrow->setTimezone('UTC');
        $utcNextWeek = $nextWeek->setTimezone('UTC');

        $leadStatuses = Lead::query()
            ->selectRaw('status, COUNT(*) AS total')
            ->groupBy('status')->pluck('total', 'status')->all();

        $activityKinds = CrmActivity::query()
            ->selectRaw('kind, status, COUNT(*) AS total')
            ->groupBy('kind', 'status')->get()
            ->map(fn ($row) => [
                'kind' => $row->kind, 'status' => $row->status, 'count' => (int) $row->total,
            ])->all();

        return response()->json(['ok' => true, 'data' => [
            'as_of' => $today->toDateString(),
            'timezone' => $zone,
            'totals' => [
                'leads' => Lead::query()->count(),
                'contacts' => CrmContact::query()->count(),
                'accounts' => CrmAccount::query()->count(),
                'deals' => CrmDeal::query()->count(),
                'pipelines' => CrmPipeline::query()->count(),
                'open_activities' => CrmActivity::query()->where('status', 'open')->count(),
                'open_tasks' => CrmActivity::query()->where('kind', 'task')->where('status', 'open')->count(),
                'overdue_tasks' => CrmActivity::query()
                    ->where('kind', 'task')->where('status', 'open')
                    ->whereNotNull('due_at')->where('due_at', '<', $utcToday)->count(),
                'tasks_due_today' => CrmActivity::query()
                    ->where('kind', 'task')->where('status', 'open')
                    ->where('due_at', '>=', $utcToday)->where('due_at', '<', $utcTomorrow)->count(),
                'meetings_next_7_days' => CrmActivity::query()
                    ->where('kind', 'meeting')->where('status', 'open')
                    ->where('due_at', '>=', $utcToday)->where('due_at', '<', $utcNextWeek)->count(),
            ],
            'leads_by_status' => collect($leadStatuses)
                ->mapWithKeys(fn ($count, $status) => [$status => (int) $count])->all(),
            'activities_by_kind_status' => $activityKinds,
        ]]);
    }

    /**
     * Deal values are grouped by currency (never add AFN, USD and EUR together).
     * "Won" measures opportunity value, not invoiced/collected revenue.
     */
    public function pipelines(Request $request): JsonResponse
    {
        $filters = $request->validate(['pipeline_id' => ['sometimes', 'uuid']]);
        $pipelineId = $filters['pipeline_id'] ?? null;
        if ($pipelineId && !CrmPipeline::query()->whereKey($pipelineId)->exists()) {
            throw ValidationException::withMessages(['pipeline_id' => 'Pipeline unavailable in this organization.']);
        }

        $pipelines = CrmPipeline::query()->with('stages')->orderBy('name')->orderBy('id')->get();
        $rows = CrmDeal::query()
            ->join('crm_pipeline_stages AS stages', function ($join) {
                $join->on('stages.id', '=', 'crm_deals.stage_id')
                    ->on('stages.pipeline_id', '=', 'crm_deals.pipeline_id')
                    ->on('stages.organization_id', '=', 'crm_deals.organization_id');
            })
            ->when($pipelineId, fn ($query) => $query->where('crm_deals.pipeline_id', $pipelineId))
            ->selectRaw('crm_deals.pipeline_id, crm_deals.stage_id, stages.kind, crm_deals.currency, COUNT(*) AS deal_count, SUM(crm_deals.amount) AS deal_value')
            ->groupBy('crm_deals.pipeline_id', 'crm_deals.stage_id', 'stages.kind', 'crm_deals.currency')
            ->orderBy('crm_deals.pipeline_id')->orderBy('crm_deals.stage_id')->orderBy('crm_deals.currency')
            ->get();

        return response()->json(['ok' => true, 'data' => [
            'pipelines' => $pipelines->filter(fn ($item) => !$pipelineId || $item->id === $pipelineId)
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'stages' => $item->stages->map(fn ($stage) => [
                        'id' => $stage->id, 'name' => $stage->name,
                        'kind' => $stage->kind, 'position' => $stage->position,
                    ])->values()->all(),
                ])->values()->all(),
            'stage_currency_totals' => $rows->map(fn ($row) => [
                'pipeline_id' => $row->pipeline_id, 'stage_id' => $row->stage_id,
                'kind' => $row->kind, 'currency' => $row->currency,
                'deal_count' => (int) $row->deal_count,
                'deal_value' => (string) $row->deal_value,
            ])->all(),
            'definitions' => [
                'deals' => 'Active, non-archived deals only.',
                'value' => 'Sum of deal amount grouped by exact currency and pipeline stage.',
                'won' => 'Won opportunity value is not recognized revenue or cash collected.',
            ],
        ]]);
    }
}
