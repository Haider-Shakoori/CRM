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

final class CrmTagsTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-tags', 'status' => 'active']);
        return Organization::create(['tenant_id' => $tenant->id, 'name' => $name, 'slug' => strtolower($name).'-tags',
            'status' => 'active', 'currency' => 'USD', 'locale' => 'en', 'timezone' => 'UTC']);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create(['name' => 'Tagged User', 'email' => Str::random(12).'@example.test',
            'password' => 'SecurePassword123!']);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create(['organization_id' => $org->id, 'user_id' => $user->id,
            'role' => $role, 'status' => 'active']);
        return $user;
    }

    private function attach(string $type, string $id, string $tag): void
    {
        $this->postJson('/api/v1/tag-links', ['tag_id' => $tag,
            'subject_type' => $type, 'subject_id' => $id])->assertCreated();
    }

    public function test_tags_are_unique_per_organization_and_operator_roles_cannot_cross_tenants(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $secret = $this->postJson('/api/v1/tags', ['name' => 'Private VIP'])->assertCreated()->json('data.id');
        $bravoLead = $this->postJson('/api/v1/leads', ['name' => 'Secret lead'])->assertCreated()->json('data.id');
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $tag = $this->postJson('/api/v1/tags', ['name' => ' VIP ', 'color' => '#1b2d3f'])
            ->assertCreated()->assertJsonPath('data.version', 1)->json('data.id');
        $this->postJson('/api/v1/tags', ['name' => 'vip'])->assertStatus(409)->assertJsonPath('error.code', 'conflict');
        $this->postJson('/api/v1/tags', ['name' => 'VIP', 'organization_id' => $bravo->id])->assertUnprocessable();
        $this->getJson('/api/v1/tags')->assertJsonPath('data.meta.total', 1)->assertJsonPath('data.items.0.id', $tag);
        $this->getJson('/api/v1/tags/'.$secret.'/records?subject_type=lead')->assertNotFound();
        $this->postJson('/api/v1/tag-links', [
            'tag_id' => $secret, 'subject_type' => 'lead', 'subject_id' => $bravoLead,
        ])->assertUnprocessable();
        $this->postJson('/api/v1/tag-links', [
            'tag_id' => $tag, 'subject_type' => 'lead', 'subject_id' => $bravoLead,
        ])->assertUnprocessable();
        $this->getJson('/api/v1/tag-links?subject_type=lead&subject_id='.$bravoLead)->assertUnprocessable();
    }

    public function test_all_four_subject_types_support_tagging_and_paginated_segment_listing(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $tag = $this->postJson('/api/v1/tags', ['name' => 'Priority'])->assertCreated()->json('data.id');
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Lead one'])->assertCreated()->json('data.id');
        $contact = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Amina', 'last_name' => 'Khan',
        ])->assertCreated()->json('data.id');
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Acme'])->assertCreated()->json('data.id');
        $pipeline = $this->postJson('/api/v1/pipelines', ['name' => 'Sales'])->assertCreated()->json('data');
        $deal = $this->postJson('/api/v1/deals', [
            'name' => 'Opportunity', 'pipeline_id' => $pipeline['id'],
            'stage_id' => $pipeline['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        foreach (['lead' => $lead, 'contact' => $contact, 'account' => $account, 'deal' => $deal] as $type => $id) {
            $this->attach($type, $id, $tag);
            $this->postJson('/api/v1/tag-links', [
                'tag_id' => $tag, 'subject_type' => $type, 'subject_id' => $id,
            ])->assertStatus(409);
            $this->getJson('/api/v1/tag-links?subject_type='.$type.'&subject_id='.$id)
                ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $tag);
            $this->getJson('/api/v1/tags/'.$tag.'/records?subject_type='.$type)
                ->assertOk()->assertJsonPath('data.meta.total', 1)
                ->assertJsonPath('data.items.0.id', $id);
        }
        $this->deleteJson('/api/v1/tags/'.$tag, ['expected_version' => 1])->assertStatus(409);
        $this->deleteJson('/api/v1/tag-links', [
            'tag_id' => $tag, 'subject_type' => 'contact', 'subject_id' => $contact,
        ])->assertOk();
        $this->getJson('/api/v1/tags/'.$tag.'/records?subject_type=contact')
            ->assertJsonPath('data.meta.total', 0);
        $this->assertDatabaseHas('audit_events', ['action' => 'tag.assigned', 'subject_id' => $lead]);
        $this->assertDatabaseHas('audit_events', ['action' => 'tag.unassigned', 'subject_id' => $contact]);
    }

    public function test_permissions_rename_conflicts_and_immutability_are_checked(): void
    {
        $org = $this->org('Alpha');
        $owner = $this->member($org);
        $editor = $this->member($org, 'member');
        $viewer = $this->member($org, 'viewer');
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $tag = $this->postJson('/api/v1/tags', ['name' => 'Important'])->assertCreated()->json('data.id');
        $other = $this->postJson('/api/v1/tags', ['name' => 'Later'])->assertCreated()->json('data.id');
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Lead'])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/tags/'.$tag, [
            'name' => 'Rename', 'expected_version' => 2,
        ])->assertStatus(409);
        $this->patchJson('/api/v1/tags/'.$tag, [
            'name' => ' Later ', 'expected_version' => 1,
        ])->assertStatus(409);
        $this->patchJson('/api/v1/tags/'.$tag, [
            'name' => 'Follow-up', 'expected_version' => 1,
        ])->assertOk()->assertJsonPath('data.version', 2);
        $this->actingAs($editor);
        $this->postJson('/api/v1/tags', ['name' => 'Cannot create'])->assertForbidden();
        $this->patchJson('/api/v1/tags/'.$other, ['name' => 'No', 'expected_version' => 1])->assertForbidden();
        $this->attach('lead', $lead, $tag);
        $this->actingAs($viewer);
        $this->getJson('/api/v1/tags')->assertOk()->assertJsonPath('data.meta.total', 2);
        $this->getJson('/api/v1/tag-links?subject_type=lead&subject_id='.$lead)->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/tag-links', [
            'tag_id' => $other, 'subject_type' => 'lead', 'subject_id' => $lead,
        ])->assertForbidden();
        $this->deleteJson('/api/v1/tag-links', [
            'tag_id' => $tag, 'subject_type' => 'lead', 'subject_id' => $lead,
        ])->assertForbidden();
    }

    public function test_deleting_a_subject_removes_unneeded_link_but_not_other_tags(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $tag = $this->postJson('/api/v1/tags', ['name' => 'New'])->assertCreated()->json('data.id');
        $lead = $this->postJson('/api/v1/leads', ['name' => 'To remove'])->assertCreated()->json('data.id');
        $this->attach('lead', $lead, $tag);
        $this->deleteJson('/api/v1/leads/'.$lead)->assertOk();
        $this->assertDatabaseCount('crm_tag_links', 0);
        $this->deleteJson('/api/v1/tags/'.$tag, ['expected_version' => 1])->assertOk();
        $this->assertDatabaseCount('crm_tags', 0);
    }
}
