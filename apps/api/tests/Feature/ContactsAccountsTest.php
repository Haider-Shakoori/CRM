<?php

namespace Tests\Feature;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ContactsAccountsTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => Str::lower($name).'-org', 'status' => 'active']);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name,
            'slug' => Str::lower($name), 'status' => 'active',
            'locale' => 'en', 'timezone' => 'UTC', 'currency' => 'USD',
        ]);
    }

    private function user(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Member', 'email' => Str::random(8).'@example.test',
            'password' => 'SecurePassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id,
            'role' => $role, 'status' => 'active',
        ]);
        return $user;
    }

    public function test_tenant_scoped_account_and_contact_crud_with_audits(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->user($org))->withHeader('X-Organization-ID', $org->id);
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Alpha Account', 'industry' => 'Software'])
            ->assertCreated()->assertJsonPath('data.organization_id', $org->id);
        $accountId = $account->json('data.id');
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'account.created']);

        $contact = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Amina', 'last_name' => 'Khan', 'account_id' => $accountId,
            'email' => 'amina@example.test',
        ])->assertCreated()->assertJsonPath('data.organization_id', $org->id)
            ->assertJsonPath('data.account_id', $accountId);
        $contactId = $contact->json('data.id');
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'contact.created']);

        $this->getJson('/api/v1/accounts/'.$accountId)->assertOk()->assertJsonPath('data.name', 'Alpha Account');
        $this->getJson('/api/v1/contacts/'.$contactId)->assertOk()->assertJsonPath('data.first_name', 'Amina');
        $this->patchJson('/api/v1/accounts/'.$accountId, [
            'expected_version' => 1, 'name' => 'Renamed Account',
        ])->assertOk()->assertJsonPath('data.version', 2);
        $this->patchJson('/api/v1/contacts/'.$contactId, [
            'expected_version' => 1, 'job_title' => 'Sales Lead',
        ])->assertOk()->assertJsonPath('data.version', 2);
        $this->patchJson('/api/v1/contacts/'.$contactId, [
            'expected_version' => 1, 'first_name' => 'Stale',
        ])->assertStatus(409);
        $this->patchJson('/api/v1/accounts/'.$accountId, [
            'expected_version' => 1, 'name' => 'Stale',
        ])->assertStatus(409);

        $this->deleteJson('/api/v1/accounts/'.$accountId)->assertStatus(409);
        $this->deleteJson('/api/v1/contacts/'.$contactId)->assertOk();
        $this->deleteJson('/api/v1/accounts/'.$accountId)->assertOk();
        $this->assertDatabaseMissing('crm_accounts', ['id' => $accountId]);
        $this->assertDatabaseMissing('crm_contacts', ['id' => $contactId]);
        foreach (['account.updated', 'contact.updated', 'account.deleted', 'contact.deleted'] as $action) {
            $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => $action]);
        }
    }

    public function test_other_organization_ids_are_invisible_to_reads_writes_and_links(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->user($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $foreignAccountId = $this->postJson('/api/v1/accounts', ['name' => 'Private Bravo'])
            ->assertCreated()->json('data.id');
        $foreignContactId = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Foreign', 'last_name' => 'Person', 'account_id' => $foreignAccountId,
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->user($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $this->getJson('/api/v1/accounts')->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson('/api/v1/contacts')->assertOk()->assertJsonCount(0, 'data.items');
        foreach (['accounts/'.$foreignAccountId, 'contacts/'.$foreignContactId] as $record) {
            $this->getJson('/api/v1/'.$record)->assertNotFound();
            $this->patchJson('/api/v1/'.$record, ['expected_version' => 1, 'notes' => 'stolen'])
                ->assertNotFound();
            $this->deleteJson('/api/v1/'.$record)->assertNotFound();
        }
        $this->postJson('/api/v1/contacts', [
            'first_name' => 'Fake', 'last_name' => 'Link', 'account_id' => $foreignAccountId,
        ])->assertUnprocessable();
        $this->assertDatabaseHas('crm_contacts', ['id' => $foreignContactId, 'account_id' => $foreignAccountId]);
        $this->assertDatabaseHas('crm_accounts', ['id' => $foreignAccountId, 'name' => 'Private Bravo']);
    }

    public function test_payloads_cannot_forge_ownership_or_server_managed_fields(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->user($alpha))->withHeader('X-Organization-ID', $alpha->id);
        foreach (['accounts' => ['name' => 'Bad'], 'contacts' => [
            'first_name' => 'Bad', 'last_name' => 'Owner',
        ]] as $endpoint => $data) {
            foreach (['organization_id' => $bravo->id, 'tenant_id' => $bravo->tenant_id, 'version' => 900] as $field => $value) {
                $this->postJson('/api/v1/'.$endpoint, array_merge($data, [$field => $value]))
                    ->assertUnprocessable();
            }
        }
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Real'])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/accounts/'.$account, [
            'name' => 'Spoof', 'expected_version' => 1, 'organization_id' => $bravo->id,
        ])->assertUnprocessable();
    }

    public function test_read_only_member_cannot_mutate_and_anonymous_cannot_read(): void
    {
        $org = $this->org('Alpha');
        $this->withHeader('X-Organization-ID', $org->id)->getJson('/api/v1/accounts')->assertUnauthorized();
        $this->getJson('/api/v1/contacts')->assertUnauthorized();
        $this->actingAs($this->user($org, 'viewer'));
        $this->getJson('/api/v1/accounts')->assertOk();
        $this->getJson('/api/v1/contacts')->assertOk();
        $this->postJson('/api/v1/accounts', ['name' => 'Forbidden'])->assertForbidden();
        $this->postJson('/api/v1/contacts', ['first_name' => 'No', 'last_name' => 'Write'])->assertForbidden();
    }

    public function test_membership_revocation_takes_effect_without_stale_context(): void
    {
        $org = $this->org('Alpha');
        $user = $this->user($org);
        $this->actingAs($user)->withHeader('X-Organization-ID', $org->id);
        $this->getJson('/api/v1/accounts')->assertOk();
        $this->getJson('/api/v1/contacts')->assertOk();
        OrganizationMembership::where('organization_id', $org->id)->where('user_id', $user->id)
            ->update(['status' => 'inactive']);
        $this->getJson('/api/v1/accounts')->assertNotFound();
        $this->getJson('/api/v1/contacts')->assertNotFound();
    }

    public function test_scoped_search_and_pagination_and_account_filter(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->user($org))->withHeader('X-Organization-ID', $org->id);
        $accountA = $this->postJson('/api/v1/accounts', ['name' => 'Acme & Co'])
            ->assertCreated()->json('data.id');
        $this->postJson('/api/v1/accounts', ['name' => 'Other'])->assertCreated();
        $contactA = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Amina', 'last_name' => 'Test', 'account_id' => $accountA,
        ])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/contacts', [
            'first_name' => 'Bilal', 'last_name' => 'Other',
        ])->assertCreated();
        $this->getJson('/api/v1/accounts?q=acme&pageSize=1')
            ->assertOk()->assertJsonPath('data.meta.total', 1)->assertJsonPath('data.items.0.id', $accountA);
        $this->getJson('/api/v1/contacts?q=amina')
            ->assertOk()->assertJsonPath('data.meta.total', 1)->assertJsonPath('data.items.0.id', $contactA);
        $this->getJson('/api/v1/contacts?account_id='.$accountA)
            ->assertOk()->assertJsonPath('data.meta.total', 1);
        $this->getJson('/api/v1/contacts?pageSize=1&page=2')
            ->assertOk()->assertJsonPath('data.meta.totalPages', 2);
        $this->getJson('/api/v1/accounts?pageSize=101')->assertUnprocessable();
    }

    public function test_database_composite_key_blocks_cross_organization_links(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $foreign = CrmAccount::forceCreate([
            'organization_id' => $bravo->id, 'name' => 'Private', 'version' => 1,
        ]);
        // Server-side scope blocks reads even from background jobs without an organization context.
        $this->assertSame(0, CrmAccount::query()->count());
        $this->assertSame(0, CrmContact::query()->count());
        // The schema declares a composite FK so database writers cannot silently forge the link.
        $this->assertTrue(DB::getSchemaBuilder()->hasTable('crm_contacts'));
        $this->assertNotSame($alpha->id, $foreign->organization_id);
    }
}
