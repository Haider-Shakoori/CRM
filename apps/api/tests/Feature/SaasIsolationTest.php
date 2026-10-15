<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SaasIsolationTest extends TestCase
{
    use RefreshDatabase;

    private function createOrganization(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-tenant', 'status' => 'active']);
        return Organization::create([
            'tenant_id' => $tenant->id,
            'name' => $name, 'slug' => strtolower($name), 'status' => 'active',
            'locale' => 'en', 'timezone' => 'UTC', 'currency' => 'USD',
        ]);
    }

    private function createUser(Organization $organization, bool $verified = true, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'CRM User', 'email' => 'user-'.strtolower($organization->name).'@example.test',
            'password' => 'SecurePassword123!',
        ]);

        if ($verified) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        OrganizationMembership::create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'role' => $role, 'status' => 'active',
        ]);
        return $user;
    }

    private function createLead(Organization $organization, string $name): Lead
    {
        return Lead::forceCreate([
            'organization_id' => $organization->id,
            'name' => $name, 'email' => 'lead@example.test', 'status' => 'new',
            'version' => 1,
        ]);
    }

    public function test_registration_creates_real_tenant_and_owner_membership(): void
    {
        Notification::fake();
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'First Owner', 'email' => 'Owner@Example.test',
            'password' => 'SecurePassword123!', 'password_confirmation' => 'SecurePassword123!',
            'organization_name' => 'New Company',
        ]);
        $response->assertCreated()->assertJsonPath('data.email_verification_required', true);
        $this->assertDatabaseHas('users', ['email' => 'owner@example.test']);
        $this->assertDatabaseCount('tenants', 1);
        $this->assertDatabaseCount('organizations', 1);
        $this->assertDatabaseHas('organization_memberships', ['role' => 'owner', 'status' => 'active']);
    }

    public function test_anonymous_and_unverified_users_cannot_access_leads(): void
    {
        $org = $this->createOrganization('Alpha');
        $user = $this->createUser($org, verified: false);

        $this->withHeader('X-Organization-ID', $org->id)
            ->getJson('/api/v1/leads')->assertUnauthorized();

        $this->actingAs($user)
            ->getJson('/api/v1/leads')->assertForbidden();
    }

    public function test_organization_selection_requires_active_membership_and_no_missing_header(): void
    {
        $orgA = $this->createOrganization('Alpha');
        $orgB = $this->createOrganization('Bravo');
        $user = $this->createUser($orgA);
        $this->actingAs($user)->getJson('/api/v1/leads')->assertStatus(400);

        $this->withHeader('X-Organization-ID', $orgB->id)
            ->getJson('/api/v1/leads')->assertNotFound();

        $orgB->tenant->update(['status' => 'suspended']);
        $this->withHeader('X-Organization-ID', $orgA->id)
            ->getJson('/api/v1/leads')->assertOk();

        $orgA->tenant->update(['status' => 'suspended']);
        $this->getJson('/api/v1/leads')->assertNotFound();
    }

    public function test_foreign_ids_cannot_be_read_updated_or_deleted(): void
    {
        $orgA = $this->createOrganization('Alpha');
        $orgB = $this->createOrganization('Bravo');
        $user = $this->createUser($orgA);
        $local = $this->createLead($orgA, 'Local Lead');
        $foreign = $this->createLead($orgB, 'Secret Foreign Lead');

        $this->actingAs($user)->withHeader('X-Organization-ID', $orgA->id);

        $response = $this->getJson('/api/v1/leads');
        $response->assertOk()->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', $local->id);

        $this->getJson('/api/v1/leads/'.$foreign->id)->assertNotFound();
        $this->patchJson('/api/v1/leads/'.$foreign->id, [
            'name' => 'Stolen', 'expected_version' => 1,
        ])->assertNotFound();
        $this->deleteJson('/api/v1/leads/'.$foreign->id)->assertNotFound();

        $this->assertDatabaseHas('leads', ['id' => $foreign->id, 'name' => 'Secret Foreign Lead']);
    }

    public function test_forged_ownership_is_rejected_and_lead_version_conflicts(): void
    {
        $orgA = $this->createOrganization('Alpha');
        $orgB = $this->createOrganization('Bravo');
        $user = $this->createUser($orgA);
        $this->actingAs($user)->withHeader('X-Organization-ID', $orgA->id);

        $this->postJson('/api/v1/leads', [
            'name' => 'Bad Lead', 'organization_id' => $orgB->id,
        ])->assertUnprocessable();
        $this->postJson('/api/v1/leads', [
            'name' => 'Bad Lead', 'tenant_id' => $orgB->tenant_id,
        ])->assertUnprocessable();

        $created = $this->postJson('/api/v1/leads', ['name' => 'Good Lead']);
        $created->assertCreated()->assertJsonPath('data.organization_id', $orgA->id);
        $id = $created->json('data.id');

        $this->patchJson('/api/v1/leads/'.$id, [
            'name' => 'Forged', 'organization_id' => $orgB->id, 'expected_version' => 1,
        ])->assertUnprocessable();

        $this->patchJson('/api/v1/leads/'.$id, [
            'name' => 'Updated', 'expected_version' => 1,
        ])->assertOk()->assertJsonPath('data.version', 2);

        $this->patchJson('/api/v1/leads/'.$id, [
            'name' => 'Stale Overwrite', 'expected_version' => 1,
        ])->assertStatus(409);
        $this->assertDatabaseHas('leads', ['id' => $id, 'name' => 'Updated', 'organization_id' => $orgA->id]);
    }

    public function test_switching_organizations_is_explicit_and_membership_revocation_takes_effect(): void
    {
        $orgA = $this->createOrganization('Alpha');
        $orgB = $this->createOrganization('Bravo');
        $user = $this->createUser($orgA);
        $membership = OrganizationMembership::create([
            'organization_id' => $orgB->id, 'user_id' => $user->id,
            'role' => 'member', 'status' => 'active',
        ]);
        $this->createLead($orgA, 'Alpha Lead');
        $this->createLead($orgB, 'Bravo Lead');

        $this->actingAs($user)
            ->withHeader('X-Organization-ID', $orgA->id)
            ->getJson('/api/v1/leads')->assertJsonPath('data.items.0.name', 'Alpha Lead');

        $this->withHeader('X-Organization-ID', $orgB->id)
            ->getJson('/api/v1/leads')->assertJsonPath('data.items.0.name', 'Bravo Lead');

        $membership->update(['status' => 'revoked']);
        $this->getJson('/api/v1/leads')->assertNotFound();
    }

    public function test_viewers_can_read_but_cannot_modify_records(): void
    {
        $org = $this->createOrganization('Alpha');
        $user = $this->createUser($org, role: 'viewer');
        $lead = $this->createLead($org, 'Read Only');

        $this->actingAs($user)->withHeader('X-Organization-ID', $org->id);
        $this->getJson('/api/v1/leads')->assertOk();
        $this->postJson('/api/v1/leads', ['name' => 'Nope'])->assertForbidden();
        $this->patchJson('/api/v1/leads/'.$lead->id, [
            'name' => 'Nope', 'expected_version' => 1,
        ])->assertForbidden();
        $this->deleteJson('/api/v1/leads/'.$lead->id)->assertForbidden();
    }

    public function test_global_scope_fails_closed_without_request_context(): void
    {
        $org = $this->createOrganization('Alpha');
        $this->createLead($org, 'Invisible Outside Middleware');
        $this->assertSame(0, Lead::query()->count());
        $this->assertSame(1, Lead::withoutGlobalScope('organization')->count());
    }
}
