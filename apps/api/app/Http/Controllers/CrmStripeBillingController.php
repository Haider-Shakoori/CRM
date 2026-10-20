<?php

namespace App\Http\Controllers;

use App\Support\OrganizationContext;
use App\Support\StripeBilling;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CrmStripeBillingController
{
    private function requireAdministrator(Request $request): void
    {
        if (!in_array($request->attributes->get('crm_membership')?->role, ['owner', 'admin'], true)) {
            abort(403, 'Organization owner or administrator required.');
        }
    }

    public function checkout(Request $request, OrganizationContext $context): JsonResponse
    {
        $this->requireAdministrator($request);
        StripeBilling::requireConfigured();
        $data = $request->validate([
            'plan_code' => ['required', 'string', 'in:team,business'],
            'price_id' => ['prohibited'], 'amount' => ['prohibited'],
            'currency' => ['prohibited'], 'tenant_id' => ['prohibited'],
        ]);
        $price = StripeBilling::price($data['plan_code']);
        $plan = DB::table('crm_subscription_plans')->where('code', $data['plan_code'])
            ->where('public', true)->first();
        if (!$plan || !$price) {
            throw ValidationException::withMessages(['plan_code' => 'Plan is not available for Stripe Checkout.']);
        }
        [$intent, $customer] = DB::transaction(function () use ($context, $plan, $price): array {
            DB::table('tenants')->where('id', $context->tenantId)->lockForUpdate()->firstOrFail();
            $link = DB::table('crm_stripe_subscription_links')->where('tenant_id', $context->tenantId)->first();
            $subscription = DB::table('crm_tenant_subscriptions')->where('tenant_id', $context->tenantId)->first();
            if ($link && !in_array($subscription?->status, ['canceled', 'expired'], true)) {
                StripeBilling::denied('billing_already_linked', 'Use the customer portal for active Stripe subscriptions.');
            }
            if (DB::table('crm_stripe_checkout_intents')
                ->where('tenant_id', $context->tenantId)
                ->where('created_at', '>', now()->subMinutes(30))
                ->whereIn('status', ['created', 'pending', 'completed'])->exists()) {
                StripeBilling::denied('checkout_pending', 'A checkout was recently started. Retry later if it was abandoned.');
            }
            $id = (string) Str::uuid();
            DB::table('crm_stripe_checkout_intents')->insert([
                'id' => $id, 'tenant_id' => $context->tenantId, 'plan_id' => $plan->id,
                'price_id' => $price, 'status' => 'created', 'created_at' => now(), 'updated_at' => now(),
            ]);
            return [$id, $link?->stripe_customer_id];
        });
        $return = (string) config('crm_stripe.return_url');
        $details = [
            'mode' => 'subscription',
            'line_items' => [['price' => $price, 'quantity' => 1]],
            'success_url' => $return.(str_contains($return, '?') ? '&' : '?').'checkout=success',
            'cancel_url' => $return.(str_contains($return, '?') ? '&' : '?').'checkout=canceled',
            'client_reference_id' => $intent,
            'metadata' => ['tenant_id' => $context->tenantId, 'intent_id' => $intent],
            'subscription_data' => ['metadata' => ['tenant_id' => $context->tenantId, 'intent_id' => $intent]],
        ];
        if ($customer) $details['customer'] = $customer;
        else $details['customer_email'] = $request->user()->email;
        $session = StripeBilling::api('checkout/sessions', $details, 'crm-checkout-'.$intent);
        if (!str_starts_with((string) $session['id'], 'cs_test_') ||
            !str_starts_with((string) ($session['url'] ?? ''), 'https://checkout.stripe.com/')) {
            StripeBilling::denied('billing_provider_error', 'Stripe Checkout returned an invalid session.');
        }
        DB::table('crm_stripe_checkout_intents')->where('id', $intent)->update([
            'stripe_checkout_session_id' => $session['id'], 'status' => 'pending', 'updated_at' => now(),
        ]);
        return response()->json(['ok' => true, 'data' => [
            'checkout_url' => $session['url'], 'checkout_pending' => true,
            'message' => 'Subscription access changes only after verified Stripe subscription webhooks.',
        ]]);
    }

    public function portal(Request $request, OrganizationContext $context): JsonResponse
    {
        $this->requireAdministrator($request);
        StripeBilling::requireConfigured();
        $link = DB::table('crm_stripe_subscription_links')
            ->where('tenant_id', $context->tenantId)->first();
        if (!$link) {
            StripeBilling::denied('billing_not_linked', 'No Stripe customer is linked to this organization.');
        }
        $session = StripeBilling::api('billing_portal/sessions', [
            'customer' => $link->stripe_customer_id,
            'return_url' => (string) config('crm_stripe.return_url'),
        ], 'crm-portal-'.Str::uuid());
        if (!str_starts_with((string) ($session['url'] ?? ''), 'https://billing.stripe.com/')) {
            StripeBilling::denied('billing_provider_error', 'Stripe returned an invalid portal session.');
        }
        return response()->json(['ok' => true, 'data' => ['portal_url' => $session['url']]]);
    }

    public function webhook(Request $request): JsonResponse
    {
        StripeBilling::requireConfigured();
        $event = StripeBilling::verify($request->getContent(), (string) $request->header('Stripe-Signature'));
        if (!$event) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'invalid_webhook_signature', 'message' => 'Stripe webhook signature invalid.',
            ]], 400);
        }
        $outcome = StripeBilling::handle($event);
        return response()->json(['ok' => true, 'data' => ['handled' => $outcome]]);
    }
}
