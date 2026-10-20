<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class CrmDealEvent extends Model
{
    use HasUuids, ScopedToOrganization;

    protected $table = 'crm_deal_events';
    public $timestamps = false;
    protected $guarded = ['*'];
    protected $casts = ['metadata' => 'array', 'created_at' => 'datetime'];
}
