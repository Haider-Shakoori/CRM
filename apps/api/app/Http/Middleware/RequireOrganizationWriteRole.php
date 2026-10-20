<?php

namespace App\Http\Middleware;

use App\Support\SubscriptionEntitlements;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireOrganizationWriteRole
{
    public function handle(Request $request, Closure $next): Response
    {
        $membership = $request->attributes->get('crm_membership');
        if (!$membership || !in_array($membership->role, ['owner', 'admin', 'member'], true)) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'forbidden', 'message' => 'This role cannot modify CRM records.', 'retryable' => false,
            ]], 403);
        }

        SubscriptionEntitlements::requireWritable($request->attributes->get('crm_organization')->tenant_id);
        return $next($request);
    }
}
