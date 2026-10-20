<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PlatformOperatorTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(string $name): Tenant
    {
        $tenant = Tenant::create([
            'name' => $name, 'slug' => strtolower($name).'-platform', 'status' => 'active',
        ]);
        DB::table('crm_tenant_subscriptions')->insert([
            'id' => (string) Str::uuid(), 'tenant_id' => $tenant->id,
            'plan_id' => DB::table('crm_subscription_plans')->where('code', 'starter')->value('id'),
            'status' => 'active', 'version' => 1, 'period_ends_at' => null,
            'cancel_at_period_end' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);
        return $tenant;
    }

    private function user(bool $verified = true): User
    {
        $user = User::create([
            'name' => 'Tester', 'email' => Str::random(12).'@example.test',
            'password' => 'SecurePassword123!',
        ]);
        if ($verified) $user->forceFill(['email_verified_at' => now()])->save();
        return $user;
    }

    private function grant(User $user, string $role = 'operator'): void
    {
        DB::table('crm_platform_operators')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $user->id,
            'role' => $role, 'active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_tenant_ownership_is_never_platform_authorization(): void
    {
        $tenant = $this->tenant('Alpha');
        $owner = $this->user();
        $org = Organization::create(['tenant_id' => $tenant->id, 'name' => 'Alpha', 'slug' => 'alpha']);
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $owner->id, 'role' => 'owner', 'status' => 'active',
        ]);
        $this->getJson('/api/v1/platform/me')->assertUnauthorized();
        $this->actingAs($owner);
        foreach (['me', 'plans', 'tenants', 'tenants/'.$tenant->id] as $route) {
            $this->getJson('/api/v1/platform/'.$route)->assertForbidden();
        }
        $this->patchJson('/api/v1/platform/tenants/'.$tenant->id.'/subscription', [
            'plan_code' => 'team', 'status' => 'active', 'expected_version' => 1,
            'period_ends_at' => null, 'cancel_at_period_end' => false,
            'acknowledge_manual_change' => true,
        ])->assertForbidden();
    }

    public function test_verified_platform_viewer_can_read_directory_but_cannot_update(): void
    {
        $alpha = $this->tenant('Alpha');
        $this->tenant('Bravo');
        $viewer = $this->user();
        $this->grant($viewer, 'viewer');
        $this->actingAs($viewer);
        $this->getJson('/api/v1/platform/me')->assertOk()->assertJsonPath('data.role', 'viewer');
        $this->getJson('/api/v1/platform/tenants?pageSize=1&page=1')->assertOk()
            ->assertJsonCount(1, 'data.items')->assertJsonPath('data.meta.total', 2)
            ->assertJsonPath('data.meta.hasNext', true);
        $this->getJson('/api/v1/platform/tenants?q=Bravo')->assertOk()->assertJsonCount(1, 'data.items');
        $this->getJson('/api/v1/platform/tenants/'.$alpha->id)->assertOk()
            ->assertJsonPath('data.subscription.plan', 'starter')
            ->assertJsonPath('data.billing_connected', false);
        $this->getJson('/api/v1/platform/plans')->assertOk()->assertJsonCount(4, 'data');
        $this->patchJson('/api/v1/platform/tenants/'.$alpha->id.'/subscription', [
            'plan_code' => 'team', 'status' => 'past_due', 'expected_version' => 1,
            'period_ends_at' => null, 'cancel_at_period_end' => false,
            'acknowledge_manual_change' => true,
        ])->assertForbidden();
        $this->assertDatabaseCount('crm_platform_events', 0);
    }

    public function test_operator_updates_versioned_subscription_with_two_audit_journals(): void
    {
        $alpha = $this->tenant('Alpha');
        $operator = $this->user();
        $this->grant($operator);
        $this->actingAs($operator);
        $path = '/api/v1/platform/tenants/'.$alpha->id.'/subscription';
        $payload = [
            'plan_code' => 'team', 'status' => 'past_due',
            'period_ends_at' => null, 'cancel_at_period_end' => false,
            'expected_version' => 1, 'acknowledge_manual_change' => true,
        ];
        $this->patchJson($path, $payload)->assertOk()
            ->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.subscription.plan', 'team')
            ->assertJsonPath('data.payment_processed', false);
        $this->assertDatabaseHas('crm_subscription_events', [
            'tenant_id' => $alpha->id, 'action' => 'platform_manual_update', 'source' => 'platform_ui',
        ]);
        $this->assertDatabaseHas('crm_platform_events', [
            'tenant_id' => $alpha->id, 'actor_user_id' => $operator->id,
            'action' => 'subscription.manually_updated',
        ]);
        $this->patchJson($path, $payload)->assertStatus(409)->assertJsonPath('error.code', 'conflict');
        $this->patchJson($path, array_merge($payload, [
            'expected_version' => 2, 'plan_code' => 'missing',
        ]))->assertUnprocessable();
        $this->patchJson($path, array_merge($payload, [
            'expected_version' => 2, 'acknowledge_manual_change' => false,
        ]))->assertUnprocessable();
        $this->patchJson($path, array_merge($payload, [
            'expected_version' => 2, 'cancel_at_period_end' => true,
        ]))->assertUnprocessable();
        $this->assertDatabaseCount('crm_platform_events', 1);
    }

    public function test_grant_revocation_and_email_verification_requirements(): void
    {
        $unverified = $this->user(false);
        $this->assertSame(1, Artisan::call('crm:platform:grant', [
            'email' => $unverified->email, 'role' => 'operator',
        ]));
        $verified = $this->user();
        $this->assertSame(0, Artisan::call('crm:platform:grant', [
            'email' => $verified->email, 'role' => 'operator',
        ]));
        $this->actingAs($verified);
        $this->getJson('/api/v1/platform/me')->assertOk();
        $this->assertSame(0, Artisan::call('crm:platform:revoke', [
            'email' => $verified->email,
        ]));
        $this->getJson('/api/v1/platform/me')->assertForbidden();
        $this->grant($unverified);
        $this->actingAs($unverified);
        $this->getJson('/api/v1/platform/me')->assertForbidden();
    }

    public function test_foreign_tenant_ids_are_not_accessible_without_platform_grant(): void
    {
        $tenant = $this->tenant('Alpha');
        $member = $this->user();
        $this->actingAs($member);
        $this->getJson('/api/v1/platform/tenants/'.$tenant->id)->assertForbidden();
        $this->getJson('/api/v1/platform/tenants/'.Str::uuid())->assertForbidden();
        $operator = $this->user();
        $this->grant($operator);
        $this->actingAs($operator);
        $this->getJson('/api/v1/platform/tenants/'.Str::uuid())->assertNotFound();
        $this->getJson('/api/v1/platform/tenants/'.$tenant->id)->assertOk();
    }
}
