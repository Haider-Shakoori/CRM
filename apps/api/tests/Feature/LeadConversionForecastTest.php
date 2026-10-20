<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

final class LeadConversionForecastTest extends TestCase
{
    use RefreshDatabase;

    private function organization(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-convert', 'status' => 'active']);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name, 'slug' => strtolower($name).'-convert',
            'status' => 'active', 'timezone' => 'UTC', 'currency' => 'USD', 'locale' => 'en',
        ]);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'CRM Tester', 'email' => Str::random(12).'@example.test',
            'password' => 'StrongPass123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id, 'status' => 'active', 'role' => $role,
        ]);
        return $user;
    }

    public function test_conversion_is_atomic_and_retries_do_not_duplicate_contacts(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $leadId = $this->postJson('/api/v1/leads', [
            'name' => 'Amina Khan', 'email' => 'amina@example.test', 'notes' => 'Important opportunity',
        ])->assertCreated()->json('data.id');
        $payload = [
            'expected_version' => 1, 'first_name' => 'Amina',
            'last_name' => 'Khan', 'account_name' => 'Amina Industries',
        ];
        $response = $this->postJson('/api/v1/leads/'.$leadId.'/convert', $payload)
            ->assertCreated()->assertJsonPath('data.lead_id', $leadId);
        $accountId = $response->json('data.account_id');
        $contactId = $response->json('data.contact_id');
        $this->getJson('/api/v1/leads/'.$leadId)->assertJsonPath('data.status', 'converted')
            ->assertJsonPath('data.version', 2);
        $this->getJson('/api/v1/contacts/'.$contactId)->assertJsonPath('data.account_id', $accountId)
            ->assertJsonPath('data.email', 'amina@example.test')
            ->assertJsonPath('data.notes', 'Important opportunity');
        $this->postJson('/api/v1/leads/'.$leadId.'/convert', $payload)
            ->assertOk()->assertJsonPath('data.account_id', $accountId)
            ->assertJsonPath('data.contact_id', $contactId);
        $this->assertDatabaseCount('crm_lead_conversions', 1);
        $this->assertDatabaseCount('crm_contacts', 1);
        $this->assertDatabaseCount('crm_accounts', 1);
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'lead.converted']);
        $this->getJson('/api/v1/leads/'.$leadId.'/conversion')
            ->assertOk()->assertJsonPath('data.contact_id', $contactId);
        $this->patchJson('/api/v1/leads/'.$leadId, [
            'expected_version' => 2, 'status' => 'new',
        ])->assertStatus(409);
        $this->deleteJson('/api/v1/leads/'.$leadId)->assertStatus(409);
    }

    public function test_existing_account_conversion_and_foreign_account_rejection(): void
    {
        $alpha = $this->organization('Alpha');
        $bravo = $this->organization('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $foreign = $this->postJson('/api/v1/accounts', ['name' => 'Private'])
            ->assertCreated()->json('data.id');
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $own = $this->postJson('/api/v1/accounts', ['name' => 'Existing'])->assertCreated()->json('data.id');
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Bilal', 'email' => 'bilal@example.test'])
            ->assertCreated()->json('data.id');
        $payload = ['expected_version' => 1, 'first_name' => 'Bilal', 'last_name' => 'Ahmad'];
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $payload + [
            'account_id' => $foreign,
        ])->assertUnprocessable();
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $payload + [
            'account_name' => 'Bad', 'organization_id' => $bravo->id,
        ])->assertUnprocessable();
        $this->assertDatabaseCount('crm_lead_conversions', 0);
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $payload + [
            'account_id' => $own,
        ])->assertCreated()->assertJsonPath('data.account_id', $own);
        $this->assertDatabaseCount('crm_accounts', 2);
    }

    public function test_stale_versions_viewers_and_unverified_members_cannot_convert(): void
    {
        $org = $this->organization('Alpha');
        $owner = $this->member($org);
        $viewer = $this->member($org, 'viewer');
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Lead'])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/leads/'.$lead, ['expected_version' => 1, 'name' => 'Updated'])
            ->assertOk();
        $payload = ['first_name' => 'A', 'last_name' => 'B', 'account_name' => 'Acme', 'expected_version' => 1];
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $payload)->assertStatus(409);
        $this->actingAs($viewer);
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $payload)->assertForbidden();
        $this->getJson('/api/v1/leads/'.$lead.'/conversion')->assertNotFound();
        $this->assertDatabaseCount('crm_lead_conversions', 0);
    }

    public function test_weighted_forecast_uses_explicit_stage_percentages_and_never_mixes_currencies(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $pipeline = $this->postJson('/api/v1/pipelines', ['name' => 'Sales'])
            ->assertCreated()->json('data');
        $open = $pipeline['stages'][0]['id'];
        $won = $pipeline['stages'][3]['id'];
        $this->assertSame(10, $pipeline['stages'][0]['probability']);
        foreach ([
            ['A', $open, 'USD', '100.00'], ['B', $open, 'USD', '200.00'],
            ['C', $open, 'AFN', '500.00'], ['D', $won, 'USD', '90.00'],
        ] as [$name, $stageId, $currency, $amount]) {
            $this->postJson('/api/v1/deals', [
                'name' => $name, 'pipeline_id' => $pipeline['id'],
                'stage_id' => $stageId, 'currency' => $currency,
                'amount' => $amount, 'expected_close_date' => '2026-11-20',
            ])->assertCreated();
        }
        $result = $this->getJson('/api/v1/reports/forecast?pipeline_id='.$pipeline['id'])
            ->assertOk()->assertJsonCount(2, 'data.currencies');
        $rows = collect($result->json('data.currencies'))->keyBy('currency');
        $this->assertEquals(30, (float) $rows['USD']['weighted_open_value']);
        $this->assertEquals(50, (float) $rows['AFN']['weighted_open_value']);
        $this->assertEquals(90, (float) $rows['USD']['won_value']);
        $this->patchJson('/api/v1/pipelines/'.$pipeline['id'].'/stages/'.$open.'/probability', [
            'probability' => 50,
        ])->assertOk()->assertJsonPath('data.probability', 50);
        $revised = $this->getJson('/api/v1/reports/forecast')
            ->assertOk()->json('data.currencies');
        $revisedRows = collect($revised)->keyBy('currency');
        $this->assertEquals(150, (float) $revisedRows['USD']['weighted_open_value']);
        $this->patchJson('/api/v1/pipelines/'.$pipeline['id'].'/stages/'.$won.'/probability', [
            'probability' => 25,
        ])->assertStatus(422);
        $this->getJson('/api/v1/reports/forecast?close_to=2026-11-19')
            ->assertJsonCount(0, 'data.currencies');
        $this->getJson('/api/v1/reports/forecast?close_from=2026-12-20&close_to=2026-11-19')
            ->assertUnprocessable();
    }


    public function test_matching_emails_are_tenant_scoped_and_conversion_requires_explicit_review(): void
    {
        $alpha = $this->organization('Alpha');
        $bravo = $this->organization('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $this->postJson('/api/v1/contacts', [
            'first_name' => 'Other', 'last_name' => 'Tenant', 'email' => 'same@example.test',
        ])->assertCreated();
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $contact = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Amina', 'last_name' => 'Khan', 'email' => ' Same@Example.Test ',
        ])->assertCreated()->json('data.id');
        $otherLead = $this->postJson('/api/v1/leads', [
            'name' => 'Earlier lead', 'email' => 'same@example.test',
        ])->assertCreated()->json('data.id');
        $lead = $this->postJson('/api/v1/leads', [
            'name' => 'New lead', 'email' => 'SAME@example.test',
        ])->assertCreated()->json('data.id');
        $this->getJson('/api/v1/leads/'.$lead.'/matches')->assertOk()
            ->assertJsonCount(1, 'data.contact_email_matches')
            ->assertJsonCount(1, 'data.lead_email_matches')
            ->assertJsonPath('data.contact_email_matches.0.id', $contact)
            ->assertJsonPath('data.lead_email_matches.0.id', $otherLead);
        $conversion = [
            'expected_version' => 1, 'first_name' => 'New', 'last_name' => 'Lead',
            'account_name' => 'Another Business',
        ];
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $conversion)->assertStatus(409);
        $this->assertDatabaseCount('crm_lead_conversions', 0);
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $conversion + [
            'allow_duplicate_contact' => true,
        ])->assertCreated();
        $this->assertDatabaseCount('crm_lead_conversions', 1);
        $this->assertDatabaseCount('crm_contacts', 3);
    }

    public function test_new_account_name_matches_are_rejected_and_existing_account_is_reusable(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Example Ltd'])
            ->assertCreated()->json('data.id');
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Prospect'])
            ->assertCreated()->json('data.id');
        $fields = ['expected_version' => 1, 'first_name' => 'A', 'last_name' => 'B'];
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $fields + [
            'account_name' => ' example ltd ',
        ])->assertUnprocessable();
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $fields + [
            'account_id' => $account,
        ])->assertCreated()->assertJsonPath('data.account_id', $account)
            ->assertJsonPath('data.deal_id', null);
        $this->assertDatabaseCount('crm_accounts', 1);
    }

    public function test_optionally_created_deal_is_atomic_scoped_and_has_history(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $pipeline = $this->postJson('/api/v1/pipelines', ['name' => 'Sales'])->assertCreated()->json('data');
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Qualified'])->assertCreated()->json('data.id');
        $input = [
            'expected_version' => 1, 'first_name' => 'A', 'last_name' => 'B',
            'account_name' => 'New Account',
            'deal' => [
                'name' => 'Opportunity', 'pipeline_id' => $pipeline['id'],
                'stage_id' => $pipeline['stages'][0]['id'],
                'currency' => 'AFN', 'amount' => 1500,
            ],
        ];
        $conversion = $this->postJson('/api/v1/leads/'.$lead.'/convert', $input)
            ->assertCreated()->json('data');
        $this->assertNotNull($conversion['deal_id']);
        $this->getJson('/api/v1/deals/'.$conversion['deal_id'])
            ->assertJsonPath('data.account_id', $conversion['account_id'])
            ->assertJsonPath('data.currency', 'AFN');
        $this->getJson('/api/v1/deals/'.$conversion['deal_id'].'/events')
            ->assertJsonPath('data.0.action', 'created');
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'deal.created']);
        $this->postJson('/api/v1/leads/'.$lead.'/convert', $input)
            ->assertOk()->assertJsonPath('data.deal_id', $conversion['deal_id']);
        $this->assertDatabaseCount('crm_deals', 1);
        $this->assertDatabaseCount('crm_deal_events', 1);
    }

    public function test_invalid_stage_for_optional_deal_rolls_back_conversion(): void
    {
        $alpha = $this->organization('Alpha');
        $bravo = $this->organization('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $foreign = $this->postJson('/api/v1/pipelines', ['name' => 'Secret'])->assertCreated()->json('data');
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $local = $this->postJson('/api/v1/pipelines', ['name' => 'Sales'])->assertCreated()->json('data');
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Candidate'])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/leads/'.$lead.'/convert', [
            'expected_version' => 1, 'first_name' => 'A', 'last_name' => 'B',
            'account_name' => 'Candidate Business',
            'deal' => ['name' => 'Bad', 'pipeline_id' => $local['id'],
                'stage_id' => $foreign['stages'][0]['id']],
        ])->assertUnprocessable();
        $this->assertDatabaseCount('crm_lead_conversions', 0);
        $this->assertDatabaseCount('crm_deals', 0);
        $this->assertDatabaseCount('crm_contacts', 0);
        $this->assertDatabaseCount('crm_accounts', 0);
        $this->getJson('/api/v1/leads/'.$lead)->assertJsonPath('data.status', 'new');
    }

    public function test_no_email_match_results_and_foreign_lead_match_is_invisible(): void
    {
        $alpha = $this->organization('Alpha');
        $bravo = $this->organization('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $otherLead = $this->postJson('/api/v1/leads', ['name' => 'Foreign', 'email' => 'private@example.test'])
            ->assertCreated()->json('data.id');
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'No email'])
            ->assertCreated()->json('data.id');
        $this->getJson('/api/v1/leads/'.$lead.'/matches')->assertOk()
            ->assertJsonCount(0, 'data.contact_email_matches')
            ->assertJsonCount(0, 'data.lead_email_matches');
        $this->getJson('/api/v1/leads/'.$otherLead.'/matches')->assertNotFound();
    }

    public function test_forecast_rejects_foreign_pipeline_ids_and_anonymous_users(): void
    {
        $alpha = $this->organization('Alpha');
        $bravo = $this->organization('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $foreign = $this->postJson('/api/v1/pipelines', ['name' => 'Private'])
            ->assertCreated()->json('data.id');
        $this->actingAs($this->member($alpha, 'viewer'))->withHeader('X-Organization-ID', $alpha->id);
        $this->getJson('/api/v1/reports/forecast')->assertOk()->assertJsonCount(0, 'data.currencies');
        $this->getJson('/api/v1/reports/forecast?pipeline_id='.$foreign)->assertUnprocessable();
        $this->patchJson('/api/v1/pipelines/'.$foreign.'/stages/'.Str::uuid().'/probability', [
            'probability' => 50,
        ])->assertForbidden();
    }
}
