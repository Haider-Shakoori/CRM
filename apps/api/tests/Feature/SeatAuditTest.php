<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SeatAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_seat_limit_blocks_new_user_and_records_an_audit_trail(): void
    {
        Notification::fake();
        $tenant = Tenant::create(['name' => 'Capacity', 'slug' => 'capacity', 'seat_limit' => 1]);
        $org = Organization::create(['tenant_id' => $tenant->id, 'name' => 'Capacity', 'slug' => 'capacity']);
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@capacity.test', 'password' => 'SecurePassword123!']);
        $owner->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create(['organization_id' => $org->id, 'user_id' => $owner->id, 'role' => 'owner']);
        $recipient = User::create(['name' => 'Recipient', 'email' => 'recipient@capacity.test', 'password' => 'SecurePassword123!']);
        $recipient->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id)
            ->getJson('/api/v1/organizations/usage')->assertOk()
            ->assertJsonPath('data.seatsUsed', 1)->assertJsonPath('data.seatLimit', 1);

        $this->postJson('/api/v1/organizations/invitations', ['email' => $recipient->email, 'role' => 'member'])
            ->assertCreated();
        $token = '';
        Notification::assertSentOnDemand(OrganizationInvitationNotification::class,
            function ($notification) use (&$token) { $token = $notification->token; return true; });

        $this->actingAs($recipient)->postJson('/api/v1/invitations/accept', ['token' => $token])
            ->assertStatus(409)->assertJsonPath('error.code', 'entitlement_missing');
        $this->assertDatabaseMissing('organization_memberships', ['organization_id' => $org->id, 'user_id' => $recipient->id]);

        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $this->postJson('/api/v1/leads', ['name' => 'Audited lead'])->assertCreated();
        $this->getJson('/api/v1/organizations/audit')->assertOk()
            ->assertJsonCount(2, 'data.items');
        $this->assertDatabaseHas('audit_events', ['organization_id' => $org->id, 'action' => 'lead.created']);
    }

    public function test_viewer_cannot_read_admin_audit_or_seat_usage(): void
    {
        $tenant = Tenant::create(['name' => 'Restricted', 'slug' => 'restricted']);
        $org = Organization::create(['tenant_id' => $tenant->id, 'name' => 'Restricted', 'slug' => 'restricted']);
        $viewer = User::create(['name' => 'Viewer', 'email' => 'viewer@restricted.test', 'password' => 'SecurePassword123!']);
        $viewer->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create(['organization_id' => $org->id, 'user_id' => $viewer->id, 'role' => 'viewer']);
        $this->actingAs($viewer)->withHeader('X-Organization-ID', $org->id);
        $this->getJson('/api/v1/organizations/audit')->assertForbidden();
        $this->getJson('/api/v1/organizations/usage')->assertForbidden();
    }
}
