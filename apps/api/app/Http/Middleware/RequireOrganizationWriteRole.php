<?php

namespace App\Http\Middleware;

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

        return $next($request);
    }
}
