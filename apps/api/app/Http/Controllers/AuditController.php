<?php

namespace App\Http\Controllers;

use App\Support\OrganizationContext;
use App\Support\SeatUsage;
use App\Support\SubscriptionEntitlements;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AuditController
{
    private function canView(Request $request): bool
    {
        return in_array($request->attributes->get('crm_membership')?->role, ['owner', 'admin'], true);
    }

    public function usage(Request $request, OrganizationContext $context): JsonResponse
    {
        if (!$this->canView($request)) return $this->forbidden();
        $limit = SubscriptionEntitlements::effectiveSeatLimit($context->tenantId);
        return response()->json(['ok' => true, 'data' => [
            'seatsUsed' => SeatUsage::activeSeatCount($context->tenantId),
            'seatLimit' => $limit,
        ]]);
    }

    public function index(Request $request, OrganizationContext $context): JsonResponse
    {
        if (!$this->canView($request)) return $this->forbidden();
        $events = DB::table('audit_events')
            ->where('organization_id', $context->organizationId)
            ->orderByDesc('created_at')->limit(100)
            ->get(['id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'metadata', 'created_at']);
        return response()->json(['ok' => true, 'data' => ['items' => $events]]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'forbidden', 'message' => 'Organization administrator access required.',
            'retryable' => false,
        ]], 403);
    }
}
