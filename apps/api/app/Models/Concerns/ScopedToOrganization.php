<?php

namespace App\Models\Concerns;

use App\Support\OrganizationContext;
use Illuminate\Database\Eloquent\Builder;

trait ScopedToOrganization
{
    protected static function bootScopedToOrganization(): void
    {
        static::addGlobalScope('organization', function (Builder $query): void {
            $organizationId = app(OrganizationContext::class)->organizationId;
            if ($organizationId === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where($query->getModel()->qualifyColumn('organization_id'), $organizationId);
            }
        });
    }
}
