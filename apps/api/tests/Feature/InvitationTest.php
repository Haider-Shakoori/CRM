<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\OrganizationInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class InvitationTest extends TestCase
{
    use RefreshDatabase;

    public function test_invitations_are_tenant_bound_email_bound_and_single_use(): void
    {
        Notification::fake();
        $tenant = Tenant::create(['name' => 'Alpha', 'slug' => 'alpha']);
        $org = Organization::create(['tenant_id' => $tenant->id, 'name' => 'Alpha', 'slug' => 'alpha']);
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'SecurePassword123!']);
        $owner->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create(['organization_id' => $org->id, 'user_id' => $owner->id, 'role' => 'owner']);
        $recipient = User::create(['name' => 'New member', 'email' => 'member@example.test', 'password' => 'SecurePassword123!']);
        $recipient->forceFill(['email_verified_at' => now()])->save();
        $wrong = User::create(['name' => 'Wrong', 'email' => 'wrong@example.test', 'password' => 'SecurePassword123!']);
        $wrong->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id)
            ->postJson('/api/v1/organizations/invitations', [
                'email' => $recipient->email, 'role' => 'member',
            ])->assertCreated();

        $token = '';
        Notification::assertSentOnDemand(
            OrganizationInvitationNotification::class,
            function (OrganizationInvitationNotification $notification) use (&$token): bool {
                $token = $notification->token;
                return true;
            }
        );
        $this->assertNotSame('', $token);
        $this->assertSame(64, strlen($token));
        $this->assertDatabaseCount('organization_invitations', 1);

        $this->actingAs($wrong)->postJson('/api/v1/invitations/accept', ['token' => $token])
            ->assertNotFound();
        $this->actingAs($recipient)->postJson('/api/v1/invitations/accept', ['token' => $token])
            ->assertOk()->assertJsonPath('data.organization_id', $org->id);
        $this->assertDatabaseHas('organization_memberships', [
            'user_id' => $recipient->id, 'organization_id' => $org->id,
            'role' => 'member', 'status' => 'active',
        ]);
        $this->postJson('/api/v1/invitations/accept', ['token' => $token])->assertNotFound();
    }

    public function test_viewer_cannot_invite_and_expired_invitation_cannot_be_accepted(): void
    {
        Notification::fake();
        $tenant = Tenant::create(['name' => 'Beta', 'slug' => 'beta']);
        $org = Organization::create(['tenant_id' => $tenant->id, 'name' => 'Beta', 'slug' => 'beta']);
        $viewer = User::create(['name' => 'Viewer', 'email' => 'viewer@example.test', 'password' => 'SecurePassword123!']);
        $viewer->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create(['organization_id' => $org->id, 'user_id' => $viewer->id, 'role' => 'viewer']);

        $this->actingAs($viewer)->withHeader('X-Organization-ID', $org->id)
            ->postJson('/api/v1/organizations/invitations', [
                'email' => 'other@example.test', 'role' => 'member',
            ])->assertForbidden();
        $this->assertDatabaseCount('organization_invitations', 0);
    }
}
