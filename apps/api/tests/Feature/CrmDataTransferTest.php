<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CrmDataTransferTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-transfer', 'status' => 'active']);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name,
            'slug' => strtolower($name).'-transfer', 'status' => 'active',
            'currency' => 'USD', 'locale' => 'en', 'timezone' => 'UTC',
        ]);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Import User', 'email' => Str::random(12).'@example.test',
            'password' => 'StrongPassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id,
            'status' => 'active', 'role' => $role,
        ]);
        return $user;
    }

    public function test_preview_never_writes_and_commit_imports_atomic_new_leads(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $body = ['entity' => 'leads', 'rows' => [
            ['name' => 'Amina', 'email' => 'amina@example.test', 'status' => 'new'],
            ['name' => 'Rahim', 'email' => 'rahim@example.test', 'notes' => 'Requested demo'],
        ]];
        $this->postJson('/api/v1/data-transfer/preview', $body)
            ->assertOk()->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.will_create', 2);
        $this->assertDatabaseCount('leads', 0);
        $this->postJson('/api/v1/data-transfer/import', $body)
            ->assertCreated()->assertJsonPath('data.created', 2);
        $this->assertDatabaseCount('leads', 2);
        $this->assertDatabaseHas('leads', ['organization_id' => $org->id, 'name' => 'Rahim', 'status' => 'new']);
        $this->assertSame(2, DB::table('audit_events')->where('action', 'bulk.leads.created')->count());
        $this->postJson('/api/v1/data-transfer/preview', $body)
            ->assertOk()->assertJsonPath('data.valid', false)
            ->assertJsonPath('data.will_create', 0);
        $this->postJson('/api/v1/data-transfer/import', $body)->assertStatus(422);
        $this->assertDatabaseCount('leads', 2);
    }

    public function test_invalid_or_duplicate_rows_fail_whole_import_with_no_partial_records(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $input = ['entity' => 'contacts', 'rows' => [
            ['first_name' => 'Amina', 'last_name' => 'Khan', 'email' => 'same@example.test'],
            ['first_name' => 'Bilal', 'last_name' => 'Khan', 'email' => ' SAME@example.test '],
        ]];
        $this->postJson('/api/v1/data-transfer/preview', $input)->assertJsonPath('data.valid', false);
        $this->postJson('/api/v1/data-transfer/import', $input)->assertStatus(422)
            ->assertJsonPath('error.code', 'validation_failed');
        $this->assertDatabaseCount('crm_contacts', 0);
        $this->postJson('/api/v1/data-transfer/import', [
            'entity' => 'accounts', 'rows' => [['name' => 'Valid'], ['name' => '']],
        ])->assertStatus(422);
        $this->assertDatabaseCount('crm_accounts', 0);
        $this->postJson('/api/v1/data-transfer/import', [
            'entity' => 'leads', 'rows' => [['name' => 'Injected', 'organization_id' => Str::uuid()]],
        ])->assertStatus(422);
        $this->assertDatabaseCount('leads', 0);
    }

    public function test_organization_restrictions_and_foreign_account_links_never_leak(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Private account'])
            ->assertCreated()->json('data.id');
        $foreign = $this->postJson('/api/v1/leads', [
            'name' => 'Private lead', 'email' => 'private@example.test',
        ])->assertCreated()->json('data.id');
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $this->postJson('/api/v1/data-transfer/import', [
            'entity' => 'contacts', 'rows' => [
                ['first_name' => 'Ada', 'last_name' => 'Lovelace', 'account_id' => $account],
            ],
        ])->assertStatus(422);
        $this->getJson('/api/v1/data-transfer/export?entity=accounts')
            ->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson('/api/v1/data-transfer/export?entity=leads')
            ->assertOk()->assertJsonCount(0, 'data.items');
        $this->postJson('/api/v1/data-transfer/import', [
            'entity' => 'leads', 'rows' => [['name' => 'Safe', 'email' => 'private@example.test']],
        ])->assertCreated(); // Same email in another tenant is not a collision.
        $this->assertDatabaseHas('leads', ['id' => $foreign, 'organization_id' => $bravo->id]);
        $this->assertDatabaseCount('crm_contacts', 0);
    }

    public function test_only_owners_and_admins_can_bulk_read_or_mutate(): void
    {
        $org = $this->org('Alpha');
        $user = $this->member($org, 'member');
        $this->actingAs($user)->withHeader('X-Organization-ID', $org->id);
        $payload = ['entity' => 'leads', 'rows' => [['name' => 'Attempted']]];
        $this->postJson('/api/v1/data-transfer/preview', $payload)->assertForbidden();
        $this->postJson('/api/v1/data-transfer/import', $payload)->assertForbidden();
        $this->getJson('/api/v1/data-transfer/export?entity=leads')->assertForbidden();
        $this->actingAs($this->member($org, 'viewer'));
        $this->getJson('/api/v1/data-transfer/export?entity=contacts')->assertForbidden();
        $this->assertDatabaseCount('leads', 0);
    }

    public function test_export_contains_only_approved_columns_is_paginated_and_audited(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        foreach (['First', 'Second'] as $name) {
            $this->postJson('/api/v1/leads', ['name' => $name])->assertCreated();
        }
        $first = $this->getJson('/api/v1/data-transfer/export?entity=leads&pageSize=1&page=1')
            ->assertOk()->assertJsonPath('data.meta.total', 2)
            ->assertJsonPath('data.meta.hasNext', true)
            ->assertJsonCount(1, 'data.items')
            ->json('data');
        $this->assertSame(['name', 'email', 'status', 'notes'], $first['columns']);
        $this->assertArrayNotHasKey('id', $first['items'][0]);
        $this->assertArrayNotHasKey('organization_id', $first['items'][0]);
        $this->getJson('/api/v1/data-transfer/export?entity=leads&pageSize=1&page=2')
            ->assertJsonPath('data.meta.hasNext', false);
        $this->assertSame(2, DB::table('audit_events')->where('action', 'bulk.leads.exported')->count());
    }

    public function test_subscription_quotas_apply_to_entire_atomic_import(): void
    {
        $org = $this->org('Alpha');
        $starter = DB::table('crm_subscription_plans')->where('code', 'starter')->first();
        DB::table('crm_tenant_subscriptions')->insert([
            'id' => (string) Str::uuid(), 'tenant_id' => $org->tenant_id,
            'plan_id' => $starter->id, 'status' => 'active', 'version' => 1,
            'period_ends_at' => null, 'cancel_at_period_end' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $limits = json_decode($starter->limits, true);
        $limits['accounts'] = 1;
        DB::table('crm_subscription_plans')->where('id', $starter->id)
            ->update(['limits' => json_encode($limits)]);
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $this->postJson('/api/v1/data-transfer/import', [
            'entity' => 'accounts', 'rows' => [['name' => 'One'], ['name' => 'Two']],
        ])->assertStatus(409)->assertJsonPath('error.code', 'entitlement_missing');
        $this->assertDatabaseCount('crm_accounts', 0);
    }
}
