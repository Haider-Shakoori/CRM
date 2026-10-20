<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class CrmAccount extends Model
{
    use HasUuids, ScopedToOrganization;

    protected $table = 'crm_accounts';

    protected $fillable = ['name', 'website', 'phone', 'industry', 'notes'];

    protected $casts = ['version' => 'integer'];
}
