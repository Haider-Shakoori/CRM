<?php

namespace Tests\Feature;

use App\Models\CrmActivity;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ActivitiesTasksTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-task-tenant', 'status' => 'active']);
        return Organization::create([
            'tenant_id' => $tenant->id, 'name' => $name, 'slug' => strtolower($name).'-task',
            'status' => 'active', 'locale' => 'en', 'timezone' => 'UTC', 'currency' => 'USD',
        ]);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create([
            'name' => 'Team Member', 'email' => Str::random(9).'@example.test', 'password' => 'SecurePassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id,
            'role' => $role, 'status' => 'active',
        ]);
        return $user;
    }

    public function test_tasks_can_be_assigned_completed_reopened_and_audited(): void
    {
        $org = $this->org('Alpha');
        $owner = $this->member($org);
        $assignee = $this->member($org, 'member');
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $this->getJson('/api/v1/activities/assignees')->assertOk()->assertJsonCount(2, 'data');
        $created = $this->postJson('/api/v1/activities', [
            'title' => 'Follow up proposal', 'kind' => 'task', 'assigned_to' => $assignee->id,
            'due_at' => '2026-11-01T10:30:00+04:30',
            'remind_at' => '2026-10-31T10:30:00+04:30',
        ])->assertCreated()->assertJsonPath('data.status', 'open')->assertJsonPath('data.version', 1);
        $id = $created->json('data.id');
        $this->getJson('/api/v1/activities?mine=1')->assertJsonPath('data.meta.total', 0);
        $this->actingAs($assignee);
        $this->getJson('/api/v1/activities?mine=1')->assertJsonPath('data.meta.total', 1);
        $this->patchJson('/api/v1/activities/'.$id, [
            'status' => 'completed', 'expected_version' => 1,
        ])->assertOk()->assertJsonPath('data.version', 2);
        $this->assertDatabaseHas('crm_activities', ['id' => $id, 'status' => 'completed']);
        $this->assertNotNull(CrmActivity::findOrFail($id)->completed_at);
        $this->patchJson('/api/v1/activities/'.$id, [
            'status' => 'open', 'expected_version' => 2,
        ])->assertOk()->assertJsonPath('data.version', 3);
        $this->assertNull(CrmActivity::findOrFail($id)->completed_at);
        $this->patchJson('/api/v1/activities/'.$id, [
            'status' => 'completed', 'expected_version' => 1,
        ])->assertStatus(409);
        $this->getJson('/api/v1/activities/'.$id.'/events')->assertOk()->assertJsonCount(3, 'data');
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'activity.updated']);
    }

    public function test_foreign_records_assignees_and_ownership_are_rejected(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $alphaUser = $this->member($alpha);
        $bravoUser = $this->member($bravo);
        $this->actingAs($bravoUser)->withHeader('X-Organization-ID', $bravo->id);
        $foreignLead = $this->postJson('/api/v1/leads', ['name' => 'Private'])->assertCreated()->json('data.id');
        $foreignTask = $this->postJson('/api/v1/activities', [
            'title' => 'Private task', 'kind' => 'task', 'lead_id' => $foreignLead,
        ])->assertCreated()->json('data.id');

        $this->actingAs($alphaUser)->withHeader('X-Organization-ID', $alpha->id);
        $this->getJson('/api/v1/activities')->assertJsonPath('data.meta.total', 0);
        $this->getJson('/api/v1/activities/'.$foreignTask)->assertNotFound();
        $this->getJson('/api/v1/activities/'.$foreignTask.'/events')->assertNotFound();
        $this->patchJson('/api/v1/activities/'.$foreignTask, [
            'expected_version' => 1, 'status' => 'completed',
        ])->assertNotFound();
        $this->deleteJson('/api/v1/activities/'.$foreignTask)->assertNotFound();
        $this->postJson('/api/v1/activities', [
            'title' => 'Bad link', 'kind' => 'call', 'lead_id' => $foreignLead,
        ])->assertUnprocessable();
        $this->postJson('/api/v1/activities', [
            'title' => 'Bad assignee', 'kind' => 'meeting', 'assigned_to' => $bravoUser->id,
        ])->assertUnprocessable();
        $this->postJson('/api/v1/activities', [
            'title' => 'Forged', 'kind' => 'task', 'organization_id' => $bravo->id,
        ])->assertUnprocessable();
        $this->assertDatabaseHas('crm_activities', ['id' => $foreignTask, 'status' => 'open']);
    }

    public function test_related_record_links_are_tenant_scoped_and_only_one_subject_allowed(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Lead One'])->assertCreated()->json('data.id');
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Account One'])->assertCreated()->json('data.id');
        $task = $this->postJson('/api/v1/activities', [
            'title' => 'Initial call', 'kind' => 'call', 'lead_id' => $lead,
        ])->assertCreated();
        $id = $task->json('data.id');
        $this->patchJson('/api/v1/activities/'.$id, [
            'expected_version' => 1, 'lead_id' => null, 'account_id' => $account,
        ])->assertOk()->assertJsonPath('data.account_id', $account);
        $this->patchJson('/api/v1/activities/'.$id, [
            'expected_version' => 2, 'lead_id' => $lead,
        ])->assertUnprocessable();
        $this->postJson('/api/v1/activities', [
            'title' => 'Two records', 'kind' => 'task', 'lead_id' => $lead, 'account_id' => $account,
        ])->assertUnprocessable();
    }

    public function test_database_blocks_two_subjects_and_rejects_cross_organization_links(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $user = $this->member($alpha);
        $foreign = $this->member($bravo);
        $this->actingAs($user)->withHeader('X-Organization-ID', $alpha->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Alpha Lead'])->assertCreated()->json('data.id');
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Alpha Account'])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/activities', [
            'title' => 'No foreign assignment', 'kind' => 'task', 'assigned_to' => $foreign->id,
        ])->assertUnprocessable();
        try {
            DB::transaction(function () use ($alpha, $user, $lead, $account): void {
                DB::table('crm_activities')->insert([
                    'id' => (string) Str::uuid(), 'organization_id' => $alpha->id,
                    'title' => 'Invalid multi-link', 'kind' => 'task', 'status' => 'open',
                    'assigned_to' => $user->id, 'lead_id' => $lead, 'account_id' => $account,
                    'version' => 1, 'created_at' => now(), 'updated_at' => now(),
                ]);
            });
            $this->fail('Expected database constraint rejection');
        } catch (QueryException $exception) {
            $this->assertSame('23514', $exception->errorInfo[0]);
        }
    }

    public function test_viewers_are_read_only_and_revoked_members_cannot_be_assigned(): void
    {
        $org = $this->org('Alpha');
        $owner = $this->member($org);
        $viewer = $this->member($org, 'viewer');
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $id = $this->postJson('/api/v1/activities', [
            'title' => 'Appointment', 'kind' => 'meeting',
        ])->assertCreated()->json('data.id');
        $this->actingAs($viewer);
        $this->getJson('/api/v1/activities')->assertOk();
        $this->getJson('/api/v1/activities/'.$id)->assertOk();
        $this->postJson('/api/v1/activities', ['title' => 'No', 'kind' => 'task'])->assertForbidden();
        $this->patchJson('/api/v1/activities/'.$id, [
            'expected_version' => 1, 'status' => 'completed',
        ])->assertForbidden();
        $this->deleteJson('/api/v1/activities/'.$id)->assertForbidden();
        OrganizationMembership::query()->where('organization_id', $org->id)
            ->where('user_id', $viewer->id)->update(['status' => 'inactive']);
        $this->actingAs($owner);
        $this->postJson('/api/v1/activities', [
            'title' => 'No assignment', 'kind' => 'task', 'assigned_to' => $viewer->id,
        ])->assertUnprocessable();
    }

    public function test_search_due_filters_and_archive_preserve_history(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $id = $this->postJson('/api/v1/activities', [
            'title' => 'Follow up customer', 'kind' => 'task',
            'due_at' => '2026-11-05T12:00:00+00:00',
        ])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/activities', [
            'title' => 'Project meeting', 'kind' => 'meeting',
        ])->assertCreated();
        $this->getJson('/api/v1/activities?kind=task&status=open&q=follow')
            ->assertJsonPath('data.meta.total', 1);
        $this->getJson('/api/v1/activities?due_before=2026-11-04')
            ->assertJsonPath('data.meta.total', 0);
        $this->deleteJson('/api/v1/activities/'.$id)->assertOk();
        $this->getJson('/api/v1/activities/'.$id)->assertNotFound();
        $this->assertSoftDeleted('crm_activities', ['id' => $id]);
        $this->assertDatabaseHas('crm_activity_events', ['activity_id' => $id, 'action' => 'archived']);
    }


    public function test_linked_records_return_conflicts_before_deletion_even_after_activity_archive(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $lead = $this->postJson('/api/v1/leads', ['name' => 'Lead'])->assertCreated()->json('data.id');
        $contact = $this->postJson('/api/v1/contacts', [
            'first_name' => 'Amina', 'last_name' => 'Khan',
        ])->assertCreated()->json('data.id');
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Customer'])->assertCreated()->json('data.id');
        foreach ([
            ['lead_id', $lead, 'leads'],
            ['contact_id', $contact, 'contacts'],
            ['account_id', $account, 'accounts'],
        ] as [$column, $record, $route]) {
            $activity = $this->postJson('/api/v1/activities', [
                'title' => 'Linked to '. $route, 'kind' => 'task', $column => $record,
            ])->assertCreated()->json('data.id');
            $this->deleteJson('/api/v1/'.$route.'/'.$record)->assertStatus(409);
            $this->deleteJson('/api/v1/activities/'.$activity)->assertOk();
            $this->deleteJson('/api/v1/'.$route.'/'.$record)->assertStatus(409);
        }
    }

    public function test_queries_fail_closed_without_organization_context(): void
    {
        $this->assertSame(0, CrmActivity::query()->count());
    }
}
