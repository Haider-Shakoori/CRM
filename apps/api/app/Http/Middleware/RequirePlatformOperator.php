<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class RequirePlatformOperator
{
    public function handle(Request $request, Closure $next, string $level = 'view'): Response
    {
        // This is a separate trust domain: owning a tenant does NOT grant access.
        $user = $request->user();
        if (!$user || !$user->hasVerifiedEmail()) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'forbidden', 'message' => 'Verified platform operator required.',
                'retryable' => false,
            ]], 403);
        }
        $grant = DB::table('crm_platform_operators')->where('user_id', $user->id)
            ->where('active', true)->first(['id', 'role']);
        if (!$grant || !in_array($grant->role, ['viewer', 'operator'], true) ||
            ($level === 'write' && $grant->role !== 'operator')) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'forbidden', 'message' => 'Platform operator access required.',
                'retryable' => false,
            ]], 403);
        }
        $request->attributes->set('crm_platform_role', $grant->role);
        return $next($request);
    }
}
