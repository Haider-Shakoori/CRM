<?php

namespace Tests\Feature;

use App\Models\CrmNote;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CrmTimelineTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-timeline', 'status' => 'active']);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name,
            'slug' => strtolower($name).'-timeline', 'status' => 'active',
            'currency' => 'USD', 'locale' => 'en', 'timezone' => 'UTC',
        ]);
    }

    private function user(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Timeline User', 'email' => Str::random(10).'@example.test',
            'password' => 'SecurePassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create(['organization_id' => $org->id, 'user_id' => $user->id,
            'role' => $role, 'status' => 'active']);
        return $user;
    }

    public function test_note_creation_and_unified_timeline_are_scoped_to_organization_and_subject(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $foreign = $this->user($bravo);
        $this->actingAs($foreign)->withHeader('X-Organization-ID', $bravo->id);
        $foreignLead = $this->postJson('/api/v1/leads', ['name' => 'Foreign'])->assertCreated()->json('data.id');
        $foreignNote = $this->postJson('/api/v1/notes', [
            'subject_type' => 'lead', 'subject_id' => $foreignLead, 'title' => 'Secret', 'body' => 'Tenant B',
        ])->assertCreated()->json('data.id');
        $this->actingAs($this->user($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Real prospect'])->assertCreated()->json('data.id');
        $contact = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Amina', 'last_name' => 'Khan',
        ])->assertCreated()->json('data.id');
        $note = $this->postJson('/api/v1/notes', [
            'subject_type' => 'lead', 'subject_id' => $lead,
            'title' => 'Discovery notes', 'body' => 'Customer prefers Wednesday',
        ])->assertCreated()->assertJsonPath('data.version', 1)->json('data.id');
        $this->postJson('/api/v1/activities', [
            'title' => 'Discovery call', 'kind' => 'call', 'lead_id' => $lead,
        ])->assertCreated();
        $this->getJson('/api/v1/timeline?subject_type=lead&subject_id='.$lead)
            ->assertOk()->assertJsonPath('data.meta.total', 2)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.subject_id', $lead);
        $this->getJson('/api/v1/timeline?subject_type=contact&subject_id='.$contact)
            ->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson('/api/v1/timeline?subject_type=lead&subject_id='.$foreignLead)
            ->assertUnprocessable();
        $this->getJson('/api/v1/notes/'.$foreignNote)->assertNotFound();
        $this->patchJson('/api/v1/notes/'.$foreignNote, [
            'expected_version' => 1, 'body' => 'Hijacked',
        ])->assertNotFound();
        $this->deleteJson('/api/v1/notes/'.$foreignNote, ['expected_version' => 1])
            ->assertNotFound();
        $this->getJson('/api/v1/notes/'.$note)->assertOk()
            ->assertJsonPath('data.body', 'Customer prefers Wednesday');
        $this->assertSame(0, CrmNote::query()->where('organization_id', $bravo->id)->count());
    }

    public function test_edits_and_archives_require_versions_and_keep_immutable_audit_events(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->user($org))->withHeader('X-Organization-ID', $org->id);
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Customer'])->assertCreated()->json('data.id');
        $note = $this->postJson('/api/v1/notes', [
            'subject_type' => 'account', 'subject_id' => $account,
            'title' => 'First note', 'body' => 'Customer requested a quote',
        ])->assertCreated()->json('data.id');
        $this->patchJson('/api/v1/notes/'.$note, [
            'expected_version' => 2, 'title' => 'Stale',
        ])->assertStatus(409);
        $this->patchJson('/api/v1/notes/'.$note, [
            'expected_version' => 1, 'body' => 'Follow up Thursday',
        ])->assertOk()->assertJsonPath('data.version', 2);
        $this->patchJson('/api/v1/notes/'.$note, [
            'expected_version' => 2, 'subject_id' => Str::uuid(), 'body' => 'Reparent',
        ])->assertUnprocessable();
        $this->getJson('/api/v1/notes/'.$note.'/events')->assertJsonCount(2, 'data');
        $this->deleteJson('/api/v1/notes/'.$note, ['expected_version' => 1])->assertStatus(409);
        $this->deleteJson('/api/v1/notes/'.$note, ['expected_version' => 2])->assertOk();
        $this->getJson('/api/v1/notes/'.$note)->assertNotFound();
        $this->getJson('/api/v1/timeline?subject_type=account&subject_id='.$account)
            ->assertJsonPath('data.meta.total', 0);
        $this->assertSoftDeleted('crm_notes', ['id' => $note]);
        $this->assertDatabaseHas('crm_note_events', ['note_id' => $note, 'action' => 'archived']);
        $this->assertDatabaseHas('audit_events', ['subject_id' => $note, 'action' => 'note.archived']);
        $this->deleteJson('/api/v1/accounts/'.$account)->assertStatus(409);
    }

    public function test_forged_links_viewers_and_invalid_note_payloads_are_rejected(): void
    {
        $org = $this->org('Alpha');
        $owner = $this->user($org);
        $viewer = $this->user($org, 'viewer');
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Prospect'])->assertCreated()->json('data.id');
        $input = ['subject_type' => 'lead', 'subject_id' => $lead, 'title' => 'Call', 'body' => 'Important'];
        foreach ([
            $input + ['organization_id' => Str::uuid()],
            $input + ['contact_id' => Str::uuid()],
            array_merge($input, ['body' => '   ']),
            array_merge($input, ['subject_id' => Str::uuid()]),
        ] as $attempt) {
            $this->postJson('/api/v1/notes', $attempt)->assertUnprocessable();
        }
        $note = $this->postJson('/api/v1/notes', $input)->assertCreated()->json('data.id');
        $this->actingAs($viewer);
        $this->getJson('/api/v1/timeline?subject_type=lead&subject_id='.$lead)->assertOk()
            ->assertJsonPath('data.meta.total', 1);
        $this->getJson('/api/v1/notes/'.$note)->assertOk();
        $this->postJson('/api/v1/notes', $input)->assertForbidden();
        $this->patchJson('/api/v1/notes/'.$note, [
            'expected_version' => 1, 'body' => 'Blocked',
        ])->assertForbidden();
        $this->deleteJson('/api/v1/notes/'.$note, ['expected_version' => 1])->assertForbidden();
        $this->assertSame(0, CrmNote::query()->where('title', 'Blocked')->count());
    }

    public function test_timeline_is_paginated_and_all_four_subject_types_are_supported(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->user($org))->withHeader('X-Organization-ID', $org->id);
        $ids = [];
        $ids['lead'] = $this->postJson('/api/v1/leads', ['name' => 'Lead'])->assertCreated()->json('data.id');
        $ids['contact'] = $this->postJson('/api/v1/contacts', [
            'first_name' => 'A', 'last_name' => 'B',
        ])->assertCreated()->json('data.id');
        $ids['account'] = $this->postJson('/api/v1/accounts', ['name' => 'Customer'])->assertCreated()->json('data.id');
        $pipeline = $this->postJson('/api/v1/pipelines', ['name' => 'Main'])->assertCreated()->json('data');
        $ids['deal'] = $this->postJson('/api/v1/deals', [
            'name' => 'Qualified opportunity', 'pipeline_id' => $pipeline['id'],
            'stage_id' => $pipeline['stages'][0]['id'],
        ])->assertCreated()->json('data.id');
        foreach ($ids as $type => $id) {
            $this->postJson('/api/v1/notes', [
                'subject_type' => $type, 'subject_id' => $id,
                'title' => 'A '.$type.' note', 'body' => 'Logged by a real user',
            ])->assertCreated();
            $this->getJson('/api/v1/timeline?subject_type='.$type.'&subject_id='.$id)
                ->assertJsonPath('data.meta.total', 1)
                ->assertJsonPath('data.items.0.entry_type', 'note');
        }
        $this->postJson('/api/v1/notes', [
            'subject_type' => 'lead', 'subject_id' => $ids['lead'], 'title' => 'Second', 'body' => 'More',
        ])->assertCreated();
        $this->getJson('/api/v1/timeline?subject_type=lead&subject_id='.$ids['lead'].'&pageSize=1&page=1')
            ->assertJsonCount(1, 'data.items')->assertJsonPath('data.meta.total', 2)
            ->assertJsonPath('data.meta.hasNext', true);
        $this->getJson('/api/v1/timeline?subject_type=lead&subject_id='.$ids['lead'].'&pageSize=1&page=2')
            ->assertJsonPath('data.meta.total', 2)->assertJsonPath('data.meta.hasNext', false);
    }
}
