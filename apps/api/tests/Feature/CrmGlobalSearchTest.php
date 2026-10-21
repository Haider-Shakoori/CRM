<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CrmGlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name): Organization
    {
        $tenant = Tenant::create([
            'name' => $name, 'slug' => strtolower($name).'-global-search', 'status' => 'active',
        ]);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name,
            'slug' => strtolower($name).'-global-search',
            'status' => 'active', 'timezone' => 'UTC', 'currency' => 'USD', 'locale' => 'en',
        ]);
    }

    private function user(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Search User', 'email' => Str::random(12).'@example.test',
            'password' => 'SecurePassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id,
            'role' => $role, 'status' => 'active',
        ]);
        return $user;
    }

    public function test_finds_four_core_record_types_within_one_verified_organization(): void
    {
        $alpha = $this->org('Alpha');
        $this->actingAs($this->user($alpha))->withHeader('X-Organization-ID', $alpha->id);

        $lead = $this->postJson('/api/v1/leads', [
            'name' => 'Northstar prospect', 'email' => 'hello@northstar.example',
        ])->assertCreated()->json('data.id');
        $contact = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Northstar', 'last_name' => 'Manager', 'email' => 'contact@example.test',
        ])->assertCreated()->json('data.id');
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Northstar Company'])
            ->assertCreated()->json('data.id');
        $pipeline = $this->postJson('/api/v1/pipelines', ['name' => 'Sales'])
            ->assertCreated()->json('data');
        $deal = $this->postJson('/api/v1/deals', [
            'name' => 'Northstar Opportunity', 'pipeline_id' => $pipeline['id'],
            'stage_id' => $pipeline['stages'][0]['id'],
        ])->assertCreated()->json('data.id');

        $search = $this->getJson('/api/v1/search?q=NORTHSTAR')
            ->assertOk()->assertJsonPath('data.query', 'NORTHSTAR');
        foreach (['leads' => $lead, 'contacts' => $contact, 'accounts' => $account, 'deals' => $deal] as $group => $id) {
            $search->assertJsonPath('data.groups.'.$group.'.total', 1)
                ->assertJsonPath('data.groups.'.$group.'.items.0.id', $id)
                ->assertJsonPath('data.groups.'.$group.'.has_more', false);
        }
        $this->getJson('/api/v1/search?q=hello%40northstar.example')
            ->assertOk()->assertJsonPath('data.groups.leads.total', 1);
        $this->getJson('/api/v1/search?q=Northstar%20Manager')
            ->assertOk()->assertJsonPath('data.groups.contacts.total', 1);
    }

    public function test_viewer_can_search_but_no_other_tenant_data_is_visible(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->user($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $this->postJson('/api/v1/leads', ['name' => 'Confidential Alpha Unique'])
            ->assertCreated();
        $this->postJson('/api/v1/accounts', ['name' => 'Confidential Alpha Account'])
            ->assertCreated();
        $this->actingAs($this->user($alpha, 'viewer'))->withHeader('X-Organization-ID', $alpha->id);
        $this->getJson('/api/v1/search?q=Confidential')->assertOk()
            ->assertJsonPath('data.groups.leads.total', 0)
            ->assertJsonPath('data.groups.accounts.total', 0);
        $this->withHeader('X-Organization-ID', $bravo->id)
            ->getJson('/api/v1/search?q=Confidential')->assertNotFound();
        $this->withHeader('X-Organization-ID', '')
            ->getJson('/api/v1/search?q=Confidential')->assertStatus(400);
    }

    public function test_search_limits_are_strict_and_wildcards_are_literal(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->user($org))->withHeader('X-Organization-ID', $org->id);
        foreach (['100% Complete', '100 Percent', '100_Exact', '100XExact'] as $name) {
            $this->postJson('/api/v1/leads', ['name' => $name])->assertCreated();
        }
        $this->getJson('/api/v1/search?q=100%25')
            ->assertOk()->assertJsonPath('data.groups.leads.total', 1);
        $this->getJson('/api/v1/search?q=100_')
            ->assertOk()->assertJsonPath('data.groups.leads.total', 1);
        $this->getJson('/api/v1/search?q=100&per_type=2')
            ->assertOk()->assertJsonPath('data.groups.leads.total', 4)
            ->assertJsonCount(2, 'data.groups.leads.items')
            ->assertJsonPath('data.groups.leads.has_more', true);
        $this->getJson('/api/v1/search?q=%20')->assertUnprocessable();
        $this->getJson('/api/v1/search?q=x')->assertUnprocessable();
        $this->getJson('/api/v1/search?q=100&per_type=26')->assertUnprocessable();
    }

    public function test_soft_deleted_deals_do_not_appear_in_results(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->user($org))->withHeader('X-Organization-ID', $org->id);
        $pipeline = $this->postJson('/api/v1/pipelines', ['name' => 'Sales'])
            ->assertCreated()->json('data');
        $id = $this->postJson('/api/v1/deals', [
            'name' => 'Archived Sentinel Deal',
            'pipeline_id' => $pipeline['id'], 'stage_id' => $pipeline['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        $this->getJson('/api/v1/search?q=Sentinel')->assertJsonPath('data.groups.deals.total', 1);
        $this->deleteJson('/api/v1/deals/'.$id)->assertOk();
        $this->getJson('/api/v1/search?q=Sentinel')->assertJsonPath('data.groups.deals.total', 0);
    }
}
