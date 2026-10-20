<?php

namespace App\Http\Controllers;

use App\Models\OrganizationInvitation;
use App\Models\OrganizationMembership;
use App\Models\User;
use App\Models\Tenant;
use App\Support\SeatUsage;
use App\Support\SubscriptionEntitlements;
use App\Support\AuditTrail;
use App\Notifications\OrganizationInvitationNotification;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class InvitationController
{
    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $membership = $request->attributes->get('crm_membership');
        if (!in_array($membership?->role, ['owner', 'admin'], true)) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'forbidden', 'message' => 'Only owners and admins can invite team members.',
                'retryable' => false,
            ]], 403);
        }

        SubscriptionEntitlements::requireWritable($context->tenantId);
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'role' => ['required', Rule::in(['admin', 'member', 'viewer'])],
            'organization_id' => ['prohibited'],
            'tenant_id' => ['prohibited'],
        ]);

        $email = Str::lower(trim($data['email']));
        $existing = User::where('email', $email)->first();
        if ($existing && OrganizationMembership::query()
            ->where('organization_id', $context->organizationId)
            ->where('user_id', $existing->id)
            ->where('status', 'active')->exists()) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'duplicate', 'message' => 'This person already belongs to the organization.',
                'retryable' => false,
            ]], 409);
        }

        $token = Str::random(64);
        $invitation = OrganizationInvitation::updateOrCreate(
            ['organization_id' => $context->organizationId, 'email' => $email],
            [
                'created_by_user_id' => $request->user()->id,
                'role' => $data['role'],
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addDays(7),
                'accepted_at' => null,
            ]
        );

        $organization = $request->attributes->get('crm_organization');
        AuditTrail::current($request, 'invitation.sent', 'invitation', $invitation->id, ['role' => $data['role']]);
        Notification::route('mail', $email)->notify(
            new OrganizationInvitationNotification($organization->name, $token)
        );

        return response()->json(['ok' => true, 'data' => [
            'id' => $invitation->id,
            'email' => $email,
            'role' => $invitation->role,
            'expires_at' => $invitation->expires_at,
            'state' => 'sent',
        ]], 201);
    }

    public function accept(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'min:32', 'max:256']]);
        $user = $request->user();

        $result = DB::transaction(function () use ($data, $user): OrganizationMembership|string|null {
            $invitation = OrganizationInvitation::query()
                ->where('token_hash', hash('sha256', $data['token']))
                ->whereNull('accepted_at')
                ->where('expires_at', '>', now())
                ->lockForUpdate()
                ->with('organization.tenant')
                ->first();

            if (!$invitation || $invitation->email !== Str::lower($user->email) ||
                $invitation->organization?->status !== 'active' ||
                $invitation->organization->tenant?->status !== 'active') {
                return null;
            }

            // A tenant-level row lock serializes concurrent accepts and prevents seat over-allocation.
            $tenant = Tenant::query()->whereKey($invitation->organization->tenant_id)
                ->lockForUpdate()->firstOrFail();
            if (!SubscriptionEntitlements::canWrite(SubscriptionEntitlements::snapshot($tenant->id))) {
                return 'subscription_inactive';
            }
            $limit = SubscriptionEntitlements::effectiveSeatLimit($tenant->id);
            if ($limit !== null && !SeatUsage::hasSeat($tenant->id, $user->id) &&
                SeatUsage::activeSeatCount($tenant->id) >= $limit) {
                return 'seat_limit';
            }

            $membership = OrganizationMembership::updateOrCreate(
                ['user_id' => $user->id, 'organization_id' => $invitation->organization_id],
                ['role' => $invitation->role, 'status' => 'active']
            );
            $invitation->forceFill(['accepted_at' => now()])->save();
            AuditTrail::explicit($tenant->id, $invitation->organization_id, $user->id,
                'invitation.accepted', 'invitation', $invitation->id, ['role' => $membership->role]);
            return $membership;
        });

        if ($result === 'subscription_inactive') {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'subscription_inactive', 'message' => 'Subscription inactive. Invitation cannot be accepted.', 'retryable' => false,
            ]], 409);
        }
        if ($result === 'seat_limit') {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'entitlement_missing', 'message' => 'No user seats are available.', 'retryable' => false,
            ]], 409);
        }

        if (!$result) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'not_found', 'message' => 'Invitation not found or expired.',
                'retryable' => false,
            ]], 404);
        }

        return response()->json(['ok' => true, 'data' => [
            'organization_id' => $result->organization_id,
            'role' => $result->role,
        ]]);
    }
}
