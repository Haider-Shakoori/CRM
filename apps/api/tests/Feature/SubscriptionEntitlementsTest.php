<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use App\Support\SubscriptionEntitlements;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

final class SubscriptionEntitlementsTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name, ?Tenant $tenant = null): Organization
    {
        $tenant ??= Tenant::create([
            'name' => $name, 'slug' => strtolower($name).'-entitlements', 'status' => 'active',
        ]);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name, 'slug' => strtolower($name).'-entitlements-'.Str::random(4),
            'status' => 'active', 'currency' => 'USD', 'locale' => 'en', 'timezone' => 'UTC',
        ]);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Subscriber', 'email' => Str::lower(Str::random(9)).'@example.test',
            'password' => 'StrongPassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id, 'status' => 'active', 'role' => $role,
        ]);
        return $user;
    }

    private function subscribe(Tenant $tenant, string $plan = 'starter', string $status = 'active', ?string $ends = null): void
    {
        DB::table('crm_tenant_subscriptions')->insert([
            'id' => (string) Str::uuid(), 'tenant_id' => $tenant->id,
            'plan_id' => DB::table('crm_subscription_plans')->where('code', $plan)->value('id'),
            'status' => $status, 'period_ends_at' => $ends,
            'cancel_at_period_end' => false, 'version' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_registration_assigns_free_starter_and_existing_fixture_without_subscription_keeps_legacy_access(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Owner', 'email' => 'starter-owner@example.test',
            'password' => 'SecurePassword123!', 'password_confirmation' => 'SecurePassword123!',
            'organization_name' => 'Subscriber Example',
        ])->assertCreated();
        $tenantId = DB::table('tenants')->value('id');
        $this->assertSame('starter', SubscriptionEntitlements::snapshot($tenantId)['plan']);
        $this->assertSame(3, SubscriptionEntitlements::effectiveSeatLimit($tenantId));
        $this->assertDatabaseHas('crm_tenant_subscriptions', ['tenant_id' => $tenantId, 'status' => 'active']);

        $legacy = $this->org('Legacy');
        $this->assertSame('legacy', SubscriptionEntitlements::snapshot($legacy->tenant_id)['plan']);
        $this->actingAs($this->member($legacy))->withHeader('X-Organization-ID', $legacy->id);
        $this->postJson('/api/v1/leads', ['name' => 'Old workflow remains available'])->assertCreated();
    }

    public function test_subscription_details_are_admin_only_and_organization_scoped(): void
    {
        $org = $this->org('Alpha');
        $this->subscribe($org->tenant);
        $owner = $this->member($org);
        $viewer = $this->member($org, 'viewer');
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $this->getJson('/api/v1/organizations/subscription')->assertOk()
            ->assertJsonPath('data.subscription.plan', 'starter')
            ->assertJsonPath('data.subscription.limits.seats', 3)
            ->assertJsonPath('data.usage.seats', 2)
            ->assertJsonPath('data.billing_connected', false);
        $this->getJson('/api/v1/subscription/plans')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'starter')
            ->assertJsonPath('data.0.checkout_available', false);
        $this->actingAs($viewer);
        $this->getJson('/api/v1/organizations/subscription')->assertForbidden();
        $other = $this->org('Bravo');
        $this->withHeader('X-Organization-ID', $other->id)
            ->getJson('/api/v1/organizations/subscription')->assertNotFound();
    }

    public function test_tenant_wide_limits_include_all_organizations_and_block_creates_atomically(): void
    {
        $org = $this->org('Alpha');
        $second = $this->org('Sibling', $org->tenant);
        $this->subscribe($org->tenant);
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);

        // Give the starter plan one Lead and one Contact for this test only.
        $planId = DB::table('crm_subscription_plans')->where('code', 'starter')->value('id');
        $limits = json_decode(DB::table('crm_subscription_plans')->where('id', $planId)->value('limits'), true);
        $limits['leads'] = 1;
        $limits['contacts'] = 1;
        $limits['accounts'] = 1;
        $limits['deals'] = 0;
        DB::table('crm_subscription_plans')->where('id', $planId)->update(['limits' => json_encode($limits)]);

        $this->postJson('/api/v1/leads', ['name' => 'Lead One'])->assertCreated();
        $this->postJson('/api/v1/leads', ['name' => 'Lead Two'])->assertStatus(409)
            ->assertJsonPath('error.code', 'entitlement_missing');
        $this->assertDatabaseCount('leads', 1);

        $secondUser = $this->member($second);
        $this->actingAs($secondUser)->withHeader('X-Organization-ID', $second->id);
        $this->postJson('/api/v1/leads', ['name' => 'Bypass via second org'])->assertStatus(409);

        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $pipeline = $this->postJson('/api/v1/pipelines', ['name' => 'Sales'])->assertCreated()->json('data');
        $leadId = DB::table('leads')->value('id');
        $this->postJson('/api/v1/leads/'.$leadId.'/convert', [
            'expected_version' => 1, 'first_name' => 'A', 'last_name' => 'B', 'account_name' => 'Company',
            'deal' => ['name' => 'Over quota', 'pipeline_id' => $pipeline['id'],
                'stage_id' => $pipeline['stages'][0]['id']],
        ])->assertStatus(409)->assertJsonPath('error.code', 'entitlement_missing');
        $this->assertDatabaseCount('crm_accounts', 0);
        $this->assertDatabaseCount('crm_contacts', 0);
        $this->assertDatabaseCount('crm_lead_conversions', 0);
        $this->getJson('/api/v1/leads/'.$leadId)->assertJsonPath('data.status', 'new');
    }

    public function test_inactive_and_expired_subscriptions_are_read_only_but_records_are_retained(): void
    {
        $org = $this->org('Alpha');
        $this->subscribe($org->tenant, 'starter');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Existing'])->assertCreated()->json('data.id');
        DB::table('crm_tenant_subscriptions')->where('tenant_id', $org->tenant_id)
            ->update(['status' => 'past_due']);
        $this->getJson('/api/v1/leads/'.$lead)->assertOk();
        $this->postJson('/api/v1/leads', ['name' => 'No create'])->assertStatus(409)
            ->assertJsonPath('error.code', 'subscription_inactive');
        $this->patchJson('/api/v1/leads/'.$lead, [
            'expected_version' => 1, 'name' => 'No edit',
        ])->assertStatus(409);
        $this->getJson('/api/v1/organizations/subscription')->assertJsonPath('data.write_enabled', false);
        DB::table('crm_tenant_subscriptions')->where('tenant_id', $org->tenant_id)
            ->update(['status' => 'trialing', 'period_ends_at' => now()->subMinute()]);
        $this->postJson('/api/v1/accounts', ['name' => 'Trial expired'])->assertStatus(409);
        DB::table('crm_tenant_subscriptions')->where('tenant_id', $org->tenant_id)
            ->update(['status' => 'active', 'period_ends_at' => null]);
        $this->patchJson('/api/v1/leads/'.$lead, [
            'expected_version' => 1, 'name' => 'Reactivated edit',
        ])->assertOk();
    }

    public function test_operator_command_changes_state_with_version_check_and_journal(): void
    {
        $org = $this->org('Alpha');
        $this->subscribe($org->tenant);
        $tenantId = $org->tenant_id;
        $this->assertSame(0, Artisan::call('crm:subscription:set', [
            'tenant' => $tenantId, 'plan' => 'team', 'status' => 'past_due',
            '--expected-version' => '1',
        ]));
        $this->assertSame('team', SubscriptionEntitlements::snapshot($tenantId)['plan']);
        $this->assertSame('past_due', SubscriptionEntitlements::snapshot($tenantId)['status']);
        $this->assertDatabaseHas('crm_subscription_events', [
            'tenant_id' => $tenantId, 'action' => 'operator_updated', 'source' => 'operator_cli',
        ]);
        $this->assertSame(1, Artisan::call('crm:subscription:set', [
            'tenant' => $tenantId, 'plan' => 'business', 'status' => 'active',
            '--expected-version' => '1',
        ]));
        $this->assertSame('team', SubscriptionEntitlements::snapshot($tenantId)['plan']);
        $this->assertDatabaseCount('crm_subscription_events', 1);
    }
}
