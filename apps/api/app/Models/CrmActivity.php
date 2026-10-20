<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class CrmActivity extends Model
{
    use HasUuids, ScopedToOrganization, SoftDeletes;

    protected $table = 'crm_activities';
    protected $fillable = [
        'title', 'kind', 'status', 'notes', 'due_at', 'remind_at',
        'assigned_to', 'lead_id', 'contact_id', 'account_id', 'deal_id',
    ];
    protected $casts = [
        'due_at' => 'datetime', 'remind_at' => 'datetime', 'completed_at' => 'datetime',
        'version' => 'integer',
    ];

    public function events(): HasMany
    {
        return $this->hasMany(CrmActivityEvent::class, 'activity_id')
            ->orderByDesc('created_at')->orderByDesc('id');
    }
}
