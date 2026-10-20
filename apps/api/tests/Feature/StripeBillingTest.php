<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

final class StripeBillingTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): array
    {
        $tenant = Tenant::create(['name' => 'Tenant', 'slug' => 'stripe-'.Str::random(10), 'status' => 'active']);
        $org = Organization::create(['tenant_id' => $tenant->id, 'name' => 'Acme',
            'slug' => 'sales', 'status' => 'active', 'currency' => 'USD', 'locale' => 'en', 'timezone' => 'UTC']);
        $user = User::create(['name' => 'Owner', 'email' => Str::random(10).'@example.test',
            'password' => 'SecurePass123!']);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create(['organization_id' => $org->id, 'user_id' => $user->id,
            'role' => 'owner', 'status' => 'active']);
        $plan = DB::table('crm_subscription_plans')->where('code', 'starter')->first();
        DB::table('crm_tenant_subscriptions')->insert([
            'id' => (string) Str::uuid(), 'tenant_id' => $tenant->id,
            'plan_id' => $plan->id, 'status' => 'active', 'period_ends_at' => null,
            'cancel_at_period_end' => false, 'version' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return [$tenant, $org, $user];
    }

    private function configured(): void
    {
        config()->set('crm_stripe.enabled', true);
        config()->set('crm_stripe.mode', 'test');
        config()->set('crm_stripe.secret', 'sk_test_fake_in_tests');
        config()->set('crm_stripe.webhook_secret', 'whsec_fake_in_tests');
        config()->set('crm_stripe.return_url', 'http://localhost:5173/crm/subscription');
        config()->set('crm_stripe.prices.team', 'price_team_test');
        DB::table('crm_subscription_plans')->where('code', 'team')->update(['public' => true]);
    }

    private function postEvent(array $event, bool $bad = false): \Illuminate\Testing\TestResponse
    {
        $raw = json_encode($event, JSON_THROW_ON_ERROR);
        $timestamp = time();
        $signature = $bad ? str_repeat('0', 64)
            : hash_hmac('sha256', $timestamp.'.'.$raw, (string) config('crm_stripe.webhook_secret'));
        return $this->call('POST', '/api/v1/billing/stripe/webhook', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_STRIPE_SIGNATURE' => 't='.$timestamp.',v1='.$signature,
        ], $raw);
    }

    private function subscriptionEvent(string $id, string $type, string $intentId, string $tenantId,
        int $created, string $state = 'active'): array
    {
        return ['id' => $id, 'type' => $type, 'created' => $created, 'livemode' => false,
            'data' => ['object' => [
                'id' => 'sub_test_x', 'customer' => 'cus_test_x', 'status' => $state,
                'metadata' => ['intent_id' => $intentId, 'tenant_id' => $tenantId],
                'items' => ['data' => [[
                    'price' => ['id' => 'price_team_test'], 'current_period_end' => time() + 86400 * 30,
                ]]],
                'cancel_at_period_end' => false,
            ]]];
    }

    public function test_billing_is_inert_without_configuration_or_valid_test_secrets(): void
    {
        [$tenant, $org, $user] = $this->owner();
        $this->actingAs($user)->withHeader('X-Organization-ID', $org->id);
        $this->postJson('/api/v1/organizations/billing/checkout', ['plan_code' => 'team'])
            ->assertStatus(503)->assertJsonPath('error.code', 'billing_unavailable');
        $this->postJson('/api/v1/organizations/billing/portal', [])
            ->assertStatus(503);
        $this->postEvent(['id' => 'evt_fake', 'type' => 'test'])->assertStatus(503);
        config()->set('crm_stripe.enabled', true);
        config()->set('crm_stripe.mode', 'live');
        config()->set('crm_stripe.secret', 'sk_live_forbidden');
        config()->set('crm_stripe.webhook_secret', 'whsec_test');
        $this->postJson('/api/v1/organizations/billing/checkout', ['plan_code' => 'team'])
            ->assertStatus(503);
        $this->assertDatabaseCount('crm_stripe_checkout_intents', 0);
        $this->assertDatabaseHas('crm_tenant_subscriptions', ['tenant_id' => $tenant->id, 'status' => 'active']);
    }

    public function test_checkout_is_tenant_scoped_never_accepts_forged_price_and_does_not_activate_plan(): void
    {
        [$tenant, $org, $owner] = $this->owner();
        $this->configured();
        Http::fake(['api.stripe.com/v1/checkout/sessions' => Http::response([
            'id' => 'cs_test_1234', 'url' => 'https://checkout.stripe.com/c/pay/cs_test_1234',
        ], 200)]);
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $this->postJson('/api/v1/organizations/billing/checkout', [
            'plan_code' => 'team', 'price_id' => 'price_attacker',
        ])->assertUnprocessable();
        $this->postJson('/api/v1/organizations/billing/checkout', [
            'plan_code' => 'team',
        ])->assertOk()->assertJsonPath('data.checkout_pending', true);
        $this->assertDatabaseCount('crm_stripe_checkout_intents', 1);
        $this->assertDatabaseHas('crm_tenant_subscriptions', [
            'tenant_id' => $tenant->id,
            'plan_id' => DB::table('crm_subscription_plans')->where('code', 'starter')->value('id'),
            'status' => 'active',
        ]);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'checkout/sessions') &&
            str_contains($request->body(), 'price_team_test') &&
            !str_contains($request->body(), 'price_attacker'));
        $this->postJson('/api/v1/organizations/billing/checkout', ['plan_code' => 'team'])
            ->assertStatus(409)->assertJsonPath('error.code', 'checkout_pending');
    }

    public function test_only_valid_signed_subscription_events_elevate_then_cancel_and_replays_are_ignored(): void
    {
        [$tenant, $org, $owner] = $this->owner();
        $this->configured();
        $intent = (string) Str::uuid();
        $plan = DB::table('crm_subscription_plans')->where('code', 'team')->first();
        DB::table('crm_stripe_checkout_intents')->insert([
            'id' => $intent, 'tenant_id' => $tenant->id, 'plan_id' => $plan->id,
            'price_id' => 'price_team_test', 'stripe_checkout_session_id' => 'cs_test_abc',
            'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $checkout = ['id' => 'evt_checkout_123', 'type' => 'checkout.session.completed',
            'created' => time() - 1, 'livemode' => false, 'data' => ['object' => [
                'id' => 'cs_test_abc', 'client_reference_id' => $intent, 'mode' => 'subscription',
                'customer' => 'cus_test_x', 'subscription' => 'sub_test_x',
            ]]];
        $this->postEvent($checkout, true)->assertStatus(400);
        $this->postEvent($checkout)->assertOk()->assertJsonPath('data.handled', 'checkout_verified_no_entitlements');
        $this->assertDatabaseHas('crm_tenant_subscriptions', ['tenant_id' => $tenant->id, 'plan_id' =>
            DB::table('crm_subscription_plans')->where('code', 'starter')->value('id')]);
        $this->postEvent($checkout)->assertOk()->assertJsonPath('data.handled', 'duplicate');
        $event = $this->subscriptionEvent('evt_subscription_123', 'customer.subscription.created',
            $intent, $tenant->id, time(), 'active');
        $this->postEvent($event)->assertOk()->assertJsonPath('data.handled', 'subscription_synced');
        $this->assertDatabaseHas('crm_tenant_subscriptions', ['tenant_id' => $tenant->id,
            'plan_id' => $plan->id, 'status' => 'active']);
        $this->assertDatabaseCount('crm_stripe_subscription_links', 1);
        $this->postEvent($event)->assertOk()->assertJsonPath('data.handled', 'duplicate');
        $stale = $this->subscriptionEvent('evt_stale_123', 'customer.subscription.updated',
            $intent, $tenant->id, time() - 10, 'past_due');
        $this->postEvent($stale)->assertOk()->assertJsonPath('data.handled', 'stale_event');
        $this->assertDatabaseHas('crm_tenant_subscriptions', ['tenant_id' => $tenant->id, 'status' => 'active']);
        $deleted = $this->subscriptionEvent('evt_deleted_123', 'customer.subscription.deleted',
            $intent, $tenant->id, time() + 10, 'canceled');
        $this->postEvent($deleted)->assertOk()->assertJsonPath('data.handled', 'subscription_synced');
        $this->assertDatabaseHas('crm_tenant_subscriptions', ['tenant_id' => $tenant->id, 'status' => 'canceled']);
        $this->assertDatabaseCount('crm_subscription_events', 2);
    }

    public function test_foreign_or_invalid_price_webhooks_never_grant_entitlements(): void
    {
        [$tenant] = $this->owner();
        $this->configured();
        $event = $this->subscriptionEvent('evt_unlinked', 'customer.subscription.created',
            (string) Str::uuid(), $tenant->id, time());
        $this->postEvent($event)->assertOk()->assertJsonPath('data.handled', 'unmatched_subscription');
        $this->assertDatabaseCount('crm_stripe_subscription_links', 0);
        $this->assertDatabaseHas('crm_tenant_subscriptions', ['tenant_id' => $tenant->id, 'status' => 'active']);
        $invoice = ['id' => 'evt_invoice_123', 'type' => 'invoice.paid', 'livemode' => false,
            'created' => time(), 'data' => ['object' => ['id' => 'in_123']]];
        $this->postEvent($invoice)->assertOk()->assertJsonPath('data.handled', 'billing_signal_only');
        $this->assertDatabaseCount('crm_subscription_events', 0);
        $live = $event;
        $live['id'] = 'evt_live_123';
        $live['livemode'] = true;
        $this->postEvent($live)->assertStatus(400);
    }

    public function test_portal_is_only_for_linked_tenant_administrators(): void
    {
        [$tenant, $org, $owner] = $this->owner();
        $this->configured();
        Http::fake(['api.stripe.com/v1/billing_portal/sessions' => Http::response([
            'id' => 'bps_test_abc', 'url' => 'https://billing.stripe.com/p/session/test_abc',
        ])]);
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $this->postJson('/api/v1/organizations/billing/portal')->assertStatus(409);
        DB::table('crm_stripe_subscription_links')->insert([
            'tenant_id' => $tenant->id, 'stripe_customer_id' => 'cus_test_only',
            'stripe_subscription_id' => 'sub_test_only',
            'plan_id' => DB::table('crm_subscription_plans')->where('code', 'team')->value('id'),
            'last_event_created' => 1, 'last_event_id' => 'evt_seed',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->postJson('/api/v1/organizations/billing/portal')->assertOk()
            ->assertJsonPath('data.portal_url', 'https://billing.stripe.com/p/session/test_abc');
        $viewer = $this->owner()[2];
        // A user must be a member of the actual organization, not of any tenant.
        $this->actingAs($viewer)->withHeader('X-Organization-ID', $org->id);
        $this->postJson('/api/v1/organizations/billing/portal')->assertNotFound();
    }
}
