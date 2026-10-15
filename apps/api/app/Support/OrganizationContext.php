<?php

namespace App\Support;

/**
 * Resolved exclusively by membership-checking middleware.
 * Absence of context must never result in a cross-organization query.
 */
final class OrganizationContext
{
    public ?string $organizationId = null;
    public ?string $tenantId = null;

    public function set(string $organizationId, string $tenantId): void
    {
        $this->organizationId = $organizationId;
        $this->tenantId = $tenantId;
    }
}
