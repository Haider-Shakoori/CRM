<?php

namespace App\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

final class StripeBilling
{
    public static function configured(): bool
    {
        $key = (string) config('crm_stripe.secret');
        return config('crm_stripe.enabled') === true
            && config('crm_stripe.mode') === 'test'
            && str_starts_with($key, 'sk_test_')
            && str_starts_with((string) config('crm_stripe.webhook_secret'), 'whsec_')
            && self::validReturnUrl((string) config('crm_stripe.return_url'));
    }

    public static function requireConfigured(): void
    {
        if (!self::configured()) {
            throw new HttpResponseException(response()->json(['ok' => false, 'error' => [
                'code' => 'billing_unavailable',
                'message' => 'Stripe billing is not configured or enabled in test mode.',
                'retryable' => false,
            ]], 503));
        }
    }

    public static function denied(string $code, string $message, int $status = 409): never
    {
        throw new HttpResponseException(response()->json(['ok' => false, 'error' => [
            'code' => $code, 'message' => $message, 'retryable' => false,
        ]], $status));
    }

    private static function validReturnUrl(string $url): bool
    {
        return str_starts_with($url, 'https://')
            || str_starts_with($url, 'http://localhost:')
            || str_starts_with($url, 'http://127.0.0.1:');
    }

    public static function price(string $plan): ?string
    {
        $price = config('crm_stripe.prices.'.$plan);
        return is_string($price) && str_starts_with($price, 'price_') ? $price : null;
    }

    public static function api(string $path, array $data, string $idempotencyKey): array
    {
        self::requireConfigured();
        try {
            $response = Http::withBasicAuth((string) config('crm_stripe.secret'), '')
            ->withHeaders(['Idempotency-Key' => $idempotencyKey])
            ->asForm()->timeout(15)->post('https://api.stripe.com/v1/'.$path, $data);
        } catch (ConnectionException) {
            self::denied('billing_provider_error', 'Stripe is temporarily unreachable.', 502);
        }
        // Never return Stripe error bodies to the browser: upstream errors can
        // carry sensitive payment/customer details.
        if (!$response->successful()) {
            throw new HttpResponseException(response()->json(['ok' => false, 'error' => [
                'code' => 'billing_provider_error',
                'message' => 'Stripe billing request could not be completed. Try again later.',
                'retryable' => true,
            ]], 502));
        }
        $object = $response->json();
        if (!is_array($object) || empty($object['id'])) {
            throw new HttpResponseException(response()->json(['ok' => false, 'error' => [
                'code' => 'billing_provider_error', 'message' => 'Stripe returned an invalid response.',
                'retryable' => true,
            ]], 502));
        }
        return $object;
    }

    /** Requires signed RAW bytes, not re-encoded JSON. */
    public static function verify(string $payload, string $header): ?array
    {
        self::requireConfigured();
        $timestamp = null;
        $signatures = [];
        foreach (explode(',', $header) as $part) {
            [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
            if ($key === 't' && ctype_digit($value)) $timestamp = (int) $value;
            if ($key === 'v1' && preg_match('/^[0-9a-f]{64}$/i', $value)) $signatures[] = strtolower($value);
        }
        if (!$timestamp || abs(time() - $timestamp) > 300 || !$signatures) return null;
        $expected = hash_hmac('sha256', $timestamp.'.'.$payload, (string) config('crm_stripe.webhook_secret'));
        $valid = false;
        foreach ($signatures as $signature) $valid = hash_equals($expected, $signature) || $valid;
        if (!$valid) return null;
        $event = json_decode($payload, true);
        if (!is_array($event) || !isset($event['id'], $event['type'], $event['created'], $event['data']['object']) ||
            !is_string($event['id']) || !str_starts_with($event['id'], 'evt_') ||
            !is_string($event['type']) || !is_int($event['created']) ||
            !is_array($event['data']['object']) || ($event['livemode'] ?? null) !== false) return null;
        return $event;
    }

    /** Deduplicated + serialized; only authoritative subscription events change entitlements. */
    public static function handle(array $event): string
    {
        return DB::transaction(function () use ($event): string {
            $inserted = DB::table('crm_stripe_webhook_events')->insertOrIgnore([
                'id' => $event['id'], 'type' => $event['type'], 'livemode' => false,
                'outcome' => 'ignored', 'tenant_id' => null, 'processed_at' => now(),
            ]);
            if (!$inserted) return 'duplicate';
            $object = $event['data']['object'];
            $type = $event['type'];
            $tenant = null;
            $outcome = 'ignored';
            if (in_array($type, ['checkout.session.completed', 'checkout.session.expired'], true)) {
                $intent = DB::table('crm_stripe_checkout_intents')
                    ->where('id', (string) ($object['client_reference_id'] ?? ''))
                    ->lockForUpdate()->first();
                if ($intent && $intent->stripe_checkout_session_id === ($object['id'] ?? null) &&
                    ($object['mode'] ?? null) === 'subscription') {
                    $tenant = $intent->tenant_id;
                    if ($type === 'checkout.session.expired') {
                        if ($intent->status !== 'completed') {
                            DB::table('crm_stripe_checkout_intents')->where('id', $intent->id)
                                ->update(['status' => 'expired', 'updated_at' => now()]);
                            $outcome = 'checkout_expired';
                        }
                    } else {
                        DB::table('crm_stripe_checkout_intents')->where('id', $intent->id)->update([
                            'status' => 'completed', 'stripe_customer_id' => $object['customer'] ?? null,
                            'stripe_subscription_id' => $object['subscription'] ?? null, 'updated_at' => now(),
                        ]);
                        $outcome = 'checkout_verified_no_entitlements';
                    }
                }
            } elseif (in_array($type, ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'], true)) {
                $outcome = self::applySubscription($event, $tenant);
            } elseif (in_array($type, ['invoice.paid', 'invoice.payment_failed'], true)) {
                // Record receipt/failure for audit only; payment succeeded events
                // cannot elevate entitlements without subscription state.
                $outcome = 'billing_signal_only';
            }
            DB::table('crm_stripe_webhook_events')->where('id', $event['id'])->update([
                'outcome' => $outcome, 'tenant_id' => $tenant,
            ]);
            return $outcome;
        }, 3);
    }

    private static function applySubscription(array $event, ?string &$tenant): string
    {
        $object = $event['data']['object'];
        $subId = (string) ($object['id'] ?? '');
        $customer = (string) ($object['customer'] ?? '');
        if (!str_starts_with($subId, 'sub_') || !str_starts_with($customer, 'cus_')) return 'missing_identity';
        $metadata = $object['metadata'] ?? [];
        $intent = DB::table('crm_stripe_checkout_intents')
            ->where('id', (string) ($metadata['intent_id'] ?? ''))
            ->lockForUpdate()->first();
        $link = DB::table('crm_stripe_subscription_links')
            ->where('stripe_subscription_id', $subId)->lockForUpdate()->first();
        if (!$intent && !$link) return 'unmatched_subscription';
        $tenant = $link?->tenant_id ?? $intent->tenant_id;
        if ($intent && ($intent->tenant_id !== $tenant || (string) ($metadata['tenant_id'] ?? '') !== $tenant)) {
            return 'tenant_mismatch';
        }
        $priceId = $object['items']['data'][0]['price']['id'] ?? null;
        $planId = $intent?->plan_id ?? $link->plan_id;
        $plan = DB::table('crm_subscription_plans')->where('id', $planId)->first();
        // Stripe deletion events can omit price details. A deletion can only
        // revoke a subscription that is already linked by exact provider ID
        // and customer. Never permit this exception to activate or switch plans.
        $knownDeletion = $event['type'] === 'customer.subscription.deleted'
            && $link && $link->stripe_subscription_id === $subId
            && $link->stripe_customer_id === $customer;
        if (!$knownDeletion && ($object['collection_method'] ?? null) !== 'charge_automatically') {
            // A manually marked paid invoice can leave Stripe status "active"
            // without funds collection. Checkout must be automatic billing.
            return 'unsupported_collection_method';
        }
        if (!$plan || (!$knownDeletion &&
            ($priceId !== self::price($plan->code) || ($intent && $intent->price_id !== $priceId)))) {
            return 'price_mismatch';
        }
        if ($link && ($link->stripe_customer_id !== $customer || $link->tenant_id !== $tenant)) {
            return 'customer_mismatch';
        }
        DB::table('tenants')->where('id', $tenant)->lockForUpdate()->firstOrFail();
        $created = $event['created'];
        if ($link && ($created < $link->last_event_created ||
            ($created === $link->last_event_created && strcmp($event['id'], $link->last_event_id) <= 0))) {
            return 'stale_event';
        }
        $previous = DB::table('crm_stripe_subscription_links')->where('tenant_id', $tenant)->first();
        $replacement = $previous && $previous->stripe_subscription_id !== $subId;
        $ends = $object['items']['data'][0]['current_period_end'] ?? $object['current_period_end'] ?? null;
        $endDate = is_int($ends) && $ends > time() ? \Illuminate\Support\Carbon::createFromTimestampUTC($ends) : null;
        $state = (string) ($object['status'] ?? '');
        if ($event['type'] === 'customer.subscription.deleted') $state = 'canceled';
        $status = match ($state) {
            'active' => $endDate ? 'active' : 'past_due',
            'trialing' => $endDate ? 'trialing' : 'past_due',
            'canceled' => 'canceled',
            'incomplete_expired' => 'expired',
            default => 'past_due',
        };
        $sub = DB::table('crm_tenant_subscriptions')->where('tenant_id', $tenant)->lockForUpdate()->first();
        if (!$sub) return 'missing_local_subscription';
        if ($replacement) {
            // Only a new, locally initiated checkout after cancellation may
            // replace the old subscription, and it MUST use the same customer.
            if (!$intent || $previous->stripe_customer_id !== $customer ||
                !in_array($sub->status, ['canceled', 'expired'], true)) {
                return 'different_subscription';
            }
            if (!in_array($status, ['active', 'trialing'], true)) {
                return 'replacement_pending_no_entitlements';
            }
        }
        if (!$previous) {
            DB::table('crm_stripe_subscription_links')->insert([
                'tenant_id' => $tenant, 'stripe_customer_id' => $customer,
                'stripe_subscription_id' => $subId, 'plan_id' => $planId,
                'last_event_created' => $created, 'last_event_id' => $event['id'],
                'created_at' => now(), 'updated_at' => now(),
            ]);
        } else {
            DB::table('crm_stripe_subscription_links')->where('tenant_id', $tenant)->update([
                'stripe_subscription_id' => $subId, 'plan_id' => $planId,
                'last_event_created' => $created, 'last_event_id' => $event['id'],
                'updated_at' => now(),
            ]);
        }
        if (!$previous && !in_array($status, ['active', 'trialing'], true)) {
            // A failed first checkout may not downgrade an existing free plan.
            // Retain the link for support/portal recovery and wait for a valid
            // subscription activation before modifying entitlements.
            return 'subscription_pending_no_entitlements';
        }
        DB::table('crm_tenant_subscriptions')->where('id', $sub->id)->update([
            'plan_id' => $planId, 'status' => $status, 'period_ends_at' => $endDate,
            'cancel_at_period_end' => (bool) ($object['cancel_at_period_end'] ?? false),
            'version' => $sub->version + 1, 'updated_at' => now(),
        ]);
        DB::table('crm_subscription_events')->insert([
            'id' => (string) Str::uuid(), 'tenant_id' => $tenant, 'subscription_id' => $sub->id,
            'action' => 'stripe.subscription_synced', 'source' => 'stripe_webhook',
            'changes' => json_encode([
                'stripe_event_id' => $event['id'], 'provider_status' => $state,
                'local_status' => $status, 'plan' => $plan->code,
            ], JSON_THROW_ON_ERROR), 'created_at' => now(),
        ]);
        return 'subscription_synced';
    }
}
