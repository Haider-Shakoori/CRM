<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use LogicException;

final class AuditTrail
{
    public static function current(Request $request, string $action, string $subjectType, ?string $subjectId = null, array $metadata = []): void
    {
        $context = app(OrganizationContext::class);
        if (!$context->organizationId || !$context->tenantId || !$request->user()) {
            throw new LogicException('An authenticated organization context is required to audit a write.');
        }
        self::explicit($context->tenantId, $context->organizationId,
            $request->user()->getKey(), $action, $subjectType, $subjectId, $metadata);
    }

    public static function explicit(
        string $tenantId, string $organizationId, string $actorId,
        string $action, string $subjectType, ?string $subjectId = null, array $metadata = []
    ): void {
        DB::table('audit_events')->insert([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenantId,
            'organization_id' => $organizationId,
            'actor_user_id' => $actorId,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
