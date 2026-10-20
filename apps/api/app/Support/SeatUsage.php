<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class SeatUsage
{
    public static function activeSeatCount(string $tenantId): int
    {
        // One user in several organizations of one tenant consumes exactly one seat.
        return DB::table('organization_memberships as membership')
            ->join('organizations as org', 'org.id', '=', 'membership.organization_id')
            ->where('org.tenant_id', $tenantId)
            ->where('membership.status', 'active')
            ->distinct()->count('membership.user_id');
    }

    public static function hasSeat(string $tenantId, string $userId): bool
    {
        return DB::table('organization_memberships as membership')
            ->join('organizations as org', 'org.id', '=', 'membership.organization_id')
            ->where('org.tenant_id', $tenantId)
            ->where('membership.user_id', $userId)
            ->where('membership.status', 'active')
            ->exists();
    }
}
