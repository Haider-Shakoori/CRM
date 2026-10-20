<?php

namespace Tests\Feature;

use App\Models\CrmDeal;
use App\Models\CrmPipeline;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

final class DealsPipelinesTest extends TestCase
{
    use RefreshDatabase;

    private function organization(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-deal-tenant', 'status' => 'active']);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name, 'slug' => strtolower($name).'-deal',
            'status' => 'active', 'locale' => 'en', 'timezone' => 'UTC', 'currency' => 'USD',
        ]);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Sales User', 'email' => Str::random(9).'@example.test',
            'password' => 'SecurePassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id,
            'role' => $role, 'status' => 'active',
        ]);
        return $user;
    }

    private function pipeline(string $name): array
    {
        return $this->postJson('/api/v1/pipelines', ['name' => $name])
            ->assertCreated()->assertJsonCount(5, 'data.stages')->json('data');
    }

    public function test_pipeline_bootstraps_ordered_stages_and_deal_movement_is_audited(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $pipeline = $this->pipeline('Sales');
        $this->assertSame(['open', 'open', 'open', 'won', 'lost'], array_column($pipeline['stages'], 'kind'));
        $deal = $this->postJson('/api/v1/deals', [
            'name' => 'Subscription Deal', 'pipeline_id' => $pipeline['id'],
            'stage_id' => $pipeline['stages'][0]['id'], 'amount' => '1200.50', 'currency' => 'USD',
        ])->assertCreated()->assertJsonPath('data.organization_id', $org->id);
        $id = $deal->json('data.id');
        $this->postJson('/api/v1/deals/'.$id.'/move', [
            'stage_id' => $pipeline['stages'][3]['id'], 'expected_version' => 1,
        ])->assertOk()->assertJsonPath('data.version', 2)
          ->assertJsonPath('data.stage_id', $pipeline['stages'][3]['id']);
        $this->getJson('/api/v1/deals/'.$id.'/events')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.action', 'moved')
            ->assertJsonPath('data.0.to_stage_id', $pipeline['stages'][3]['id']);
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'deal.moved']);
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'pipeline.created']);
        $this->getJson('/api/v1/deals?pipeline_id='.$pipeline['id'])
            ->assertOk()->assertJsonPath('data.meta.total', 1);
    }

    public function test_stale_versions_block_edit_and_stage_movement(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $pipeline = $this->pipeline('Sales');
        $id = $this->postJson('/api/v1/deals', [
            'name' => 'Deal', 'pipeline_id' => $pipeline['id'],
            'stage_id' => $pipeline['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/deals/'.$id, ['expected_version' => 1, 'name' => 'Updated'])
            ->assertOk()->assertJsonPath('data.version', 2);
        $this->patchJson('/api/v1/deals/'.$id, ['expected_version' => 1, 'name' => 'Stale'])
            ->assertStatus(409);
        $this->postJson('/api/v1/deals/'.$id.'/move', [
            'expected_version' => 1, 'stage_id' => $pipeline['stages'][1]['id'],
        ])->assertStatus(409);
        $this->getJson('/api/v1/deals/'.$id)->assertJsonPath('data.name', 'Updated');
        $this->getJson('/api/v1/deals/'.$id.'/events')->assertJsonCount(2, 'data');
    }

    public function test_foreign_pipeline_stage_and_deal_ids_are_invisible(): void
    {
        $alpha = $this->organization('Alpha');
        $bravo = $this->organization('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $foreignPipe = $this->pipeline('Secret');
        $foreignDeal = $this->postJson('/api/v1/deals', [
            'name' => 'Foreign', 'pipeline_id' => $foreignPipe['id'],
            'stage_id' => $foreignPipe['stages'][0]['id'],
        ])->assertCreated()->json('data.id');

        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $localPipe = $this->pipeline('Local');
        $this->getJson('/api/v1/pipelines')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/deals')->assertJsonPath('data.meta.total', 0);
        $this->getJson('/api/v1/pipelines/'.$foreignPipe['id'])->assertNotFound();
        $this->getJson('/api/v1/deals/'.$foreignDeal)->assertNotFound();
        $this->getJson('/api/v1/deals/'.$foreignDeal.'/events')->assertNotFound();
        $this->patchJson('/api/v1/deals/'.$foreignDeal, [
            'expected_version' => 1, 'name' => 'Hijack',
        ])->assertNotFound();
        $this->deleteJson('/api/v1/deals/'.$foreignDeal)->assertNotFound();
        $this->postJson('/api/v1/deals', [
            'name' => 'Bad', 'pipeline_id' => $foreignPipe['id'],
            'stage_id' => $foreignPipe['stages'][0]['id'],
        ])->assertUnprocessable();
        $this->postJson('/api/v1/deals', [
            'name' => 'Bad', 'pipeline_id' => $localPipe['id'],
            'stage_id' => $foreignPipe['stages'][0]['id'],
        ])->assertUnprocessable();
        $localDeal = $this->postJson('/api/v1/deals', [
            'name' => 'Local', 'pipeline_id' => $localPipe['id'],
            'stage_id' => $localPipe['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/deals/'.$localDeal.'/move', [
            'stage_id' => $foreignPipe['stages'][1]['id'], 'expected_version' => 1,
        ])->assertStatus(422);
        $this->assertDatabaseHas('crm_deals', ['id' => $foreignDeal, 'name' => 'Foreign']);
    }

    public function test_same_organization_cannot_move_deal_to_another_pipeline_stage(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $a = $this->pipeline('A');
        $b = $this->pipeline('B');
        $id = $this->postJson('/api/v1/deals', [
            'name' => 'Example', 'pipeline_id' => $a['id'], 'stage_id' => $a['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/deals/'.$id.'/move', [
            'stage_id' => $b['stages'][0]['id'], 'expected_version' => 1,
        ])->assertStatus(422);
        $this->getJson('/api/v1/deals/'.$id)->assertJsonPath('data.version', 1);
        $this->getJson('/api/v1/deals/'.$id.'/events')->assertJsonCount(1, 'data');
    }

    public function test_viewer_can_read_but_cannot_create_or_move_records(): void
    {
        $org = $this->organization('Alpha');
        $this->actingAs($this->member($org, 'viewer'))->withHeader('X-Organization-ID', $org->id);
        $this->getJson('/api/v1/pipelines')->assertOk();
        $this->getJson('/api/v1/deals')->assertOk();
        $this->postJson('/api/v1/pipelines', ['name' => 'No'])->assertForbidden();
        $this->postJson('/api/v1/deals', ['name' => 'No'])->assertForbidden();
        $this->postJson('/api/v1/deals/'.Str::uuid().'/move', [
            'stage_id' => (string) Str::uuid(), 'expected_version' => 1,
        ])->assertForbidden();
    }

    public function test_forged_organization_and_stage_change_are_rejected_and_archive_keeps_timeline(): void
    {
        $org = $this->organization('Alpha');
        $other = $this->organization('Bravo');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $this->postJson('/api/v1/pipelines', [
            'name' => 'Spoof', 'organization_id' => $other->id,
        ])->assertUnprocessable();
        $pipe = $this->pipeline('Real');
        $this->postJson('/api/v1/deals', [
            'name' => 'Spoof', 'pipeline_id' => $pipe['id'],
            'stage_id' => $pipe['stages'][0]['id'], 'organization_id' => $other->id,
        ])->assertUnprocessable();
        $id = $this->postJson('/api/v1/deals', [
            'name' => 'Keep History', 'pipeline_id' => $pipe['id'],
            'stage_id' => $pipe['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/deals/'.$id, [
            'expected_version' => 1, 'stage_id' => $pipe['stages'][2]['id'],
        ])->assertUnprocessable();
        $this->deleteJson('/api/v1/deals/'.$id)->assertOk();
        $this->getJson('/api/v1/deals/'.$id)->assertNotFound();
        $this->assertSoftDeleted('crm_deals', ['id' => $id]);
        $this->assertDatabaseHas('crm_deal_events', ['deal_id' => $id, 'action' => 'archived']);
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'deal.archived']);
    }

    public function test_background_queries_fail_closed_without_context(): void
    {
        $this->assertSame(0, CrmDeal::query()->count());
        $this->assertSame(0, CrmPipeline::query()->count());
    }
}
