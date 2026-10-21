<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class CrmNote extends Model
{
    use HasUuids, ScopedToOrganization, SoftDeletes;

    protected $table = 'crm_notes';

    protected $fillable = ['title', 'body'];
    protected $casts = ['version' => 'integer', 'deleted_at' => 'datetime'];
}
