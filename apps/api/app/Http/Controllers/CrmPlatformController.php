<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Support\SubscriptionEntitlements;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CrmPlatformController
{
    public function me(Request $request): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => [
            'id' => $request->user()->id,
            'name' => $request->user()->name,
            'role' => $request->attributes->get('crm_platform_role'),
        ]]);
    }

    public function plans(): JsonResponse
    {
        return response()->json(['ok' => true, 'data' =>
            DB::table('crm_subscription_plans')->orderBy('code')
                ->get(['code', 'name', 'limits', 'public'])->map(fn ($p) => [
                    'code' => $p->code, 'name' => $p->name,
                    'limits' => json_decode($p->limits, true),
                    'public' => (bool) $p->public,
                ]),
        ]);
    }

    public function tenants(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['sometimes', 'string', 'max:120'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        $query = DB::table('tenants as t')
            ->leftJoin('crm_tenant_subscriptions as s', 's.tenant_id', '=', 't.id')
            ->leftJoin('crm_subscription_plans as p', 'p.id', '=', 's.plan_id')
            ->when(isset($data['q']), function ($query) use ($data) {
                $escaped = addcslashes(trim($data['q']), '%_\\');
                $query->where(fn ($q) => $q->where('t.name', 'ilike', '%'.$escaped.'%')
                    ->orWhere('t.slug', 'ilike', '%'.$escaped.'%'));
            })
            ->select('t.id', 't.name', 't.slug', 't.status',
                't.created_at', 's.version as subscription_version',
                's.status as subscription_status', 'p.code as plan')
            ->orderBy('t.name')->orderBy('t.id');
        $page = $query->paginate($data['pageSize'] ?? 20, ['*'], 'page', $data['page'] ?? 1);
        return response()->json(['ok' => true, 'data' => [
            'items' => $page->items(),
            'meta' => [
                'page' => $page->currentPage(), 'pageSize' => $page->perPage(),
                'total' => $page->total(), 'totalPages' => $page->lastPage(),
                'hasNext' => $page->hasMorePages(),
            ],
        ]]);
    }

    public function tenant(string $id): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail($id);
        $subscription = SubscriptionEntitlements::snapshot($id);
        $subscription['limits']['seats'] = SubscriptionEntitlements::effectiveSeatLimit($id);
        $organizations = DB::table('organizations')->where('tenant_id', $id)
            ->orderBy('name')->get(['id', 'name', 'status', 'created_at']);
        $events = DB::table('crm_subscription_events')
            ->where('tenant_id', $id)->orderByDesc('created_at')->limit(50)
            ->get(['id', 'action', 'source', 'changes', 'created_at']);
        $platformEvents = DB::table('crm_platform_events')->where('tenant_id', $id)
            ->orderByDesc('created_at')->limit(50)
            ->get(['id', 'actor_user_id', 'action', 'changes', 'created_at']);
        return response()->json(['ok' => true, 'data' => [
            'tenant' => [
                'id' => $tenant->id, 'name' => $tenant->name, 'slug' => $tenant->slug,
                'status' => $tenant->status, 'created_at' => $tenant->created_at,
            ],
            'subscription' => $subscription,
            'usage' => SubscriptionEntitlements::usage($id),
            'organizations' => $organizations,
            'subscription_events' => $events,
            'platform_events' => $platformEvents,
            'billing_connected' => false,
        ]]);
    }

    /**
     * Manual operator action only. Does not imply payment, generate invoices,
     * charge a customer, or modify Stripe state.
     */
    public function updateSubscription(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'plan_code' => ['required', 'string', 'max:40'],
            'status' => ['required', 'in:active,trialing,past_due,canceled,expired'],
            'expected_version' => ['required', 'integer', 'min:1'],
            'period_ends_at' => ['present', 'nullable', 'date'],
            'cancel_at_period_end' => ['required', 'boolean'],
            'acknowledge_manual_change' => ['accepted'],
            'tenant_id' => ['prohibited'], 'user_id' => ['prohibited'],
            'amount' => ['prohibited'], 'payment_status' => ['prohibited'],
        ]);
        if (($data['status'] === 'trialing' || $data['cancel_at_period_end']) &&
            empty($data['period_ends_at'])) {
            throw ValidationException::withMessages(['period_ends_at' => 'A period end is required for trials and scheduled cancellation.']);
        }

        return DB::transaction(function () use ($request, $id, $data): JsonResponse {
            $tenant = Tenant::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            if (DB::table('crm_stripe_subscription_links')->where('tenant_id', $tenant->id)->exists()) {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'stripe_managed',
                    'message' => 'Stripe-linked subscriptions cannot be modified manually.',
                    'retryable' => false,
                ]], 409);
            }
            $sub = DB::table('crm_tenant_subscriptions')->where('tenant_id', $tenant->id)
                ->lockForUpdate()->first();
            if (!$sub || (int) $sub->version !== (int) $data['expected_version']) {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'conflict', 'message' => 'Subscription changed. Refresh before applying a new action.',
                    'retryable' => false,
                ]], 409);
            }
            $plan = DB::table('crm_subscription_plans')->where('code', $data['plan_code'])->first();
            if (!$plan) {
                throw ValidationException::withMessages(['plan_code' => 'Plan not found.']);
            }
            $date = !empty($data['period_ends_at'])
                ? \Illuminate\Support\Carbon::parse($data['period_ends_at'])->utc() : null;
            $version = (int) $sub->version + 1;
            $changes = [
                'from' => ['plan_id' => $sub->plan_id, 'status' => $sub->status,
                    'period_ends_at' => $sub->period_ends_at,
                    'cancel_at_period_end' => (bool) $sub->cancel_at_period_end],
                'to' => ['plan' => $plan->code, 'status' => $data['status'],
                    'period_ends_at' => $date?->toIso8601String(),
                    'cancel_at_period_end' => $data['cancel_at_period_end']],
                'version' => $version, 'manual' => true,
            ];
            DB::table('crm_tenant_subscriptions')->where('id', $sub->id)->update([
                'plan_id' => $plan->id, 'status' => $data['status'],
                'period_ends_at' => $date, 'cancel_at_period_end' => $data['cancel_at_period_end'],
                'version' => $version, 'updated_at' => now(),
            ]);
            DB::table('crm_subscription_events')->insert([
                'id' => (string) Str::uuid(), 'tenant_id' => $id,
                'subscription_id' => $sub->id, 'action' => 'platform_manual_update',
                'source' => 'platform_ui', 'changes' => json_encode($changes),
                'created_at' => now(),
            ]);
            DB::table('crm_platform_events')->insert([
                'id' => (string) Str::uuid(), 'tenant_id' => $id,
                'actor_user_id' => $request->user()->id, 'action' => 'subscription.manually_updated',
                'changes' => json_encode($changes), 'created_at' => now(),
            ]);
            return response()->json(['ok' => true, 'data' => [
                'tenant_id' => $id, 'version' => $version,
                'subscription' => SubscriptionEntitlements::snapshot($id),
                'payment_processed' => false,
            ]]);
        });
    }
}
