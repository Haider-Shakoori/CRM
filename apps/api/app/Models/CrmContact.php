<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class CrmContact extends Model
{
    use HasUuids, ScopedToOrganization;

    protected $table = 'crm_contacts';

    protected $fillable = ['first_name', 'last_name', 'email', 'phone', 'job_title', 'notes', 'account_id'];

    protected $casts = ['version' => 'integer'];
}
