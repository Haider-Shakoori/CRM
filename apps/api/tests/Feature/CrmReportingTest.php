<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CrmReportingTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name, string $timezone = 'UTC'): Organization
    {
        $tenant = Tenant::create([
            'name' => $name, 'slug' => strtolower($name).'-report-tenant', 'status' => 'active',
        ]);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name,
            'slug' => strtolower($name).'-report',
            'status' => 'active', 'currency' => 'USD',
            'timezone' => $timezone, 'locale' => 'en',
        ]);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Reporter', 'email' => Str::random(9).'@example.test',
            'password' => 'SecurePassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id,
            'status' => 'active', 'role' => $role,
        ]);
        return $user;
    }

    public function test_counts_match_real_organization_records_and_viewers_can_read(): void
    {
        Carbon::setTestNow('2026-10-20T08:00:00Z');
        try {
            $org = $this->org('Alpha', 'Asia/Kabul');
            $owner = $this->member($org);
            $viewer = $this->member($org, 'viewer');
            $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
            $this->postJson('/api/v1/leads', ['name' => 'Lead A'])->assertCreated();
            $this->postJson('/api/v1/leads', ['name' => 'Lead B', 'status' => 'contacted'])->assertCreated();
            $this->postJson('/api/v1/accounts', ['name' => 'Account'])->assertCreated();
            $this->postJson('/api/v1/contacts', [
                'first_name' => 'Mina', 'last_name' => 'Ahmad',
            ])->assertCreated();
            $this->postJson('/api/v1/activities', [
                'title' => 'Overdue task', 'kind' => 'task', 'due_at' => '2026-10-19T18:59:00Z',
            ])->assertCreated();
            $this->postJson('/api/v1/activities', [
                'title' => 'Today task', 'kind' => 'task', 'due_at' => '2026-10-20T16:00:00Z',
            ])->assertCreated();
            $this->postJson('/api/v1/activities', [
                'title' => 'Meeting soon', 'kind' => 'meeting', 'due_at' => '2026-10-21T09:00:00Z',
            ])->assertCreated();

            $this->actingAs($viewer)->withHeader('X-Organization-ID', $org->id);
            $this->getJson('/api/v1/reports/overview')->assertOk()
                ->assertJsonPath('data.as_of', '2026-10-20')
                ->assertJsonPath('data.timezone', 'Asia/Kabul')
                ->assertJsonPath('data.totals.leads', 2)
                ->assertJsonPath('data.totals.accounts', 1)
                ->assertJsonPath('data.totals.contacts', 1)
                ->assertJsonPath('data.totals.open_tasks', 2)
                ->assertJsonPath('data.totals.overdue_tasks', 1)
                ->assertJsonPath('data.totals.tasks_due_today', 1)
                ->assertJsonPath('data.totals.meetings_next_7_days', 1)
                ->assertJsonPath('data.leads_by_status.new', 1)
                ->assertJsonPath('data.leads_by_status.contacted', 1);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_pipeline_values_remain_separate_by_stage_and_currency(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $pipeline = $this->postJson('/api/v1/pipelines', [
            'name' => 'Sales',
        ])->assertCreated()->json('data');
        $open = $pipeline['stages'][0]['id'];
        $won = $pipeline['stages'][3]['id'];
        foreach ([
            ['One USD', $open, 'USD', '100.00'],
            ['Two USD', $open, 'USD', '200.00'],
            ['AFN deal', $open, 'AFN', '500.00'],
            ['Won deal', $won, 'USD', '50.00'],
        ] as [$name, $stage, $currency, $amount]) {
            $this->postJson('/api/v1/deals', [
                'name' => $name, 'pipeline_id' => $pipeline['id'],
                'stage_id' => $stage, 'currency' => $currency, 'amount' => $amount,
            ])->assertCreated();
        }
        $report = $this->getJson('/api/v1/reports/pipelines?pipeline_id='.$pipeline['id'])
            ->assertOk()->assertJsonCount(1, 'data.pipelines')
            ->assertJsonCount(3, 'data.stage_currency_totals');
        $groups = collect($report->json('data.stage_currency_totals'))->keyBy(
            fn ($item) => $item['stage_id'].'|'.$item['currency'],
        );
        $this->assertEquals('300.00', $groups[$open.'|USD']['deal_value']);
        $this->assertSame(2, $groups[$open.'|USD']['deal_count']);
        $this->assertEquals('500.00', $groups[$open.'|AFN']['deal_value']);
        $this->assertEquals('50.00', $groups[$won.'|USD']['deal_value']);
        $this->getJson('/api/v1/reports/overview')->assertJsonPath('data.totals.deals', 4);
    }

    public function test_archived_deals_do_not_count_as_active_and_foreign_pipeline_filters_are_rejected(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $foreign = $this->postJson('/api/v1/pipelines', ['name' => 'Private'])
            ->assertCreated()->json('data');
        $this->postJson('/api/v1/deals', [
            'name' => 'Private deal', 'pipeline_id' => $foreign['id'],
            'stage_id' => $foreign['stages'][0]['id'],
        ])->assertCreated();
        $this->postJson('/api/v1/leads', ['name' => 'Foreign lead'])->assertCreated();

        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $local = $this->postJson('/api/v1/pipelines', ['name' => 'Public'])
            ->assertCreated()->json('data');
        $dealId = $this->postJson('/api/v1/deals', [
            'name' => 'Local', 'pipeline_id' => $local['id'],
            'stage_id' => $local['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        $this->deleteJson('/api/v1/deals/'.$dealId)->assertOk();
        $this->getJson('/api/v1/reports/overview')->assertOk()
            ->assertJsonPath('data.totals.deals', 0)
            ->assertJsonPath('data.totals.leads', 0)
            ->assertJsonPath('data.totals.pipelines', 1);
        $this->getJson('/api/v1/reports/pipelines')->assertOk()
            ->assertJsonCount(1, 'data.pipelines')
            ->assertJsonCount(0, 'data.stage_currency_totals');
        $this->getJson('/api/v1/reports/pipelines?pipeline_id='.$foreign['id'])->assertUnprocessable();
    }

    public function test_reports_require_verified_active_membership(): void
    {
        $org = $this->org('Alpha');
        $this->withHeader('X-Organization-ID', $org->id)
            ->getJson('/api/v1/reports/overview')->assertUnauthorized();
        $viewer = $this->member($org, 'viewer');
        $viewer->forceFill(['email_verified_at' => null])->save();
        $this->actingAs($viewer);
        $this->getJson('/api/v1/reports/overview')->assertForbidden();
        $viewer->forceFill(['email_verified_at' => now()])->save();
        $this->getJson('/api/v1/reports/overview')->assertOk();
        OrganizationMembership::where('organization_id', $org->id)
            ->where('user_id', $viewer->id)->update(['status' => 'inactive']);
        $this->getJson('/api/v1/reports/overview')->assertNotFound();
    }
}
