<?php

namespace App\Models;

use App\Support\OrganizationContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    use HasUuids;

    public const STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted'];

    // Do not mass-assign ownership or record identity from browser payloads.
    protected $fillable = ['name', 'email', 'status', 'notes'];

    protected static function booted(): void
    {
        static::addGlobalScope('organization', function (Builder $query): void {
            $organizationId = app(OrganizationContext::class)->organizationId;

            if ($organizationId === null) {
                $query->whereRaw('1 = 0'); // explicit fail-closed for background jobs too
            } else {
                $query->where($query->getModel()->qualifyColumn('organization_id'), $organizationId);
            }
        });
    }
}
