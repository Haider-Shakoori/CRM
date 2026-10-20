<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'slug', 'status', 'seat_limit'];

    public function organizations(): HasMany
    {
        return $this->hasMany(Organization::class);
    }
}
