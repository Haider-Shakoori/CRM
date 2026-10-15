<?php

namespace App\Http\Middleware;

use App\Models\OrganizationMembership;
use App\Support\OrganizationContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ResolveOrganization
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->header('X-Organization-ID');

        if (!is_string($id) || $id === '') {
            return response()->json([
                'ok' => false,
                'error' => ['code' => 'validation_failed', 'message' => 'Select an organization.', 'retryable' => false],
            ], 400);
        }

        // Ignore any client-supplied tenant ID; only a verified active membership can resolve context.
        $membership = OrganizationMembership::query()
            ->with('organization.tenant')
            ->where('user_id', $request->user()->getKey())
            ->where('organization_id', $id)
            ->where('status', 'active')
            ->first();

        if (!$membership || !$membership->organization ||
            $membership->organization->status !== 'active' ||
            $membership->organization->tenant?->status !== 'active') {
            // Return 404 without revealing whether an organization exists.
            return response()->json([
                'ok' => false,
                'error' => ['code' => 'not_found', 'message' => 'Organization unavailable.', 'retryable' => false],
            ], 404);
        }

        $organization = $membership->organization;
        app(OrganizationContext::class)->set($organization->id, $organization->tenant_id);
        $request->attributes->set('crm_organization', $organization);
        $request->attributes->set('crm_membership', $membership);

        return $next($request);
    }
}
