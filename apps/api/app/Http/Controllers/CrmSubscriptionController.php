<?php

namespace App\Http\Controllers;

use App\Support\OrganizationContext;
use App\Support\SubscriptionEntitlements;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class CrmSubscriptionController
{
    public function catalog(): JsonResponse
    {
        // Internal paid tiers are not listed as purchasable before checkout exists.
        $plans = DB::table('crm_subscription_plans')->where('public', true)
            ->orderBy('code')->get(['code', 'name', 'limits']);
        return response()->json(['ok' => true, 'data' => $plans->map(fn ($p) => [
            'code' => $p->code, 'name' => $p->name,
            'limits' => json_decode($p->limits, true),
            'checkout_available' => false,
        ])]);
    }

    public function show(Request $request, OrganizationContext $context): JsonResponse
    {
        $role = $request->attributes->get('crm_membership')?->role;
        if (!in_array($role, ['owner', 'admin'], true)) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'forbidden', 'message' => 'Organization administrator access required.',
                'retryable' => false,
            ]], 403);
        }
        $subscription = SubscriptionEntitlements::snapshot($context->tenantId);
        $subscription['limits']['seats'] = SubscriptionEntitlements::effectiveSeatLimit($context->tenantId);
        return response()->json(['ok' => true, 'data' => [
            'subscription' => $subscription,
            'usage' => SubscriptionEntitlements::usage($context->tenantId),
            'write_enabled' => SubscriptionEntitlements::canWrite($subscription),
            'billing_connected' => false,
            'manage_message' => 'Subscription changes are currently managed by the platform operator. No payment collection is connected.',
        ]]);
    }
}
