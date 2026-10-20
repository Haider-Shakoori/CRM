<?php

namespace App\Http\Controllers;

use App\Models\CrmDeal;
use App\Models\CrmPipeline;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class CrmForecastController
{
    /**
     * Pipeline opportunity outlook only. Probabilities are configurable stage
     * assumptions, never statistical forecasts or recognized financial revenue.
     */
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'pipeline_id' => ['sometimes', 'uuid'],
            'close_from' => ['sometimes', 'date_format:Y-m-d'],
            'close_to' => ['sometimes', 'date_format:Y-m-d'],
        ]);
        if (isset($input['close_from'], $input['close_to']) &&
            $input['close_from'] > $input['close_to']) {
            throw ValidationException::withMessages(['close_to' => 'End date must not be before start date.']);
        }
        $id = $input['pipeline_id'] ?? null;
        if ($id && !CrmPipeline::query()->whereKey($id)->exists()) {
            throw ValidationException::withMessages(['pipeline_id' => 'Pipeline unavailable in this organization.']);
        }

        $query = CrmDeal::query()->join('crm_pipeline_stages AS stages', function ($join) {
            $join->on('stages.id', '=', 'crm_deals.stage_id')
                ->on('stages.pipeline_id', '=', 'crm_deals.pipeline_id')
                ->on('stages.organization_id', '=', 'crm_deals.organization_id');
        });
        if ($id) $query->where('crm_deals.pipeline_id', $id);
        if (isset($input['close_from'])) $query->whereDate('crm_deals.expected_close_date', '>=', $input['close_from']);
        if (isset($input['close_to'])) $query->whereDate('crm_deals.expected_close_date', '<=', $input['close_to']);

        $rows = $query->selectRaw("
            crm_deals.currency,
            COUNT(*) AS deal_count,
            SUM(CASE WHEN stages.kind = 'open' THEN crm_deals.amount ELSE 0 END) AS open_value,
            SUM(CASE WHEN stages.kind = 'open' THEN crm_deals.amount * stages.probability / 100.0 ELSE 0 END) AS weighted_open_value,
            SUM(CASE WHEN stages.kind = 'won' THEN crm_deals.amount ELSE 0 END) AS won_value,
            SUM(CASE WHEN stages.kind = 'lost' THEN crm_deals.amount ELSE 0 END) AS lost_value,
            SUM(CASE WHEN crm_deals.expected_close_date IS NULL THEN 1 ELSE 0 END) AS no_close_date
        ")->groupBy('crm_deals.currency')->orderBy('crm_deals.currency')->get();

        return response()->json(['ok' => true, 'data' => [
            'currencies' => $rows->map(fn ($row) => [
                'currency' => $row->currency, 'deal_count' => (int) $row->deal_count,
                'open_value' => (string) $row->open_value,
                'weighted_open_value' => (string) $row->weighted_open_value,
                'won_value' => (string) $row->won_value, 'lost_value' => (string) $row->lost_value,
                'no_close_date' => (int) $row->no_close_date,
            ])->all(),
            'assumptions' => [
                'method' => 'open deal amount multiplied by configurable stage probability',
                'confidence' => 'manual assumptions, not predictive analytics',
                'basis' => 'non-archived deals; currencies never converted or combined',
                'won' => 'won opportunities, not invoiced revenue or cash receipts',
                'date_filter' => 'only deals with expected close dates inside the requested inclusive range',
            ],
        ]]);
    }
}
