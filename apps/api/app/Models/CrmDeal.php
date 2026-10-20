<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class CrmDeal extends Model
{
    use HasUuids, ScopedToOrganization, SoftDeletes;

    protected $table = 'crm_deals';
    protected $fillable = ['name', 'amount', 'currency', 'expected_close_date', 'notes', 'account_id'];
    protected $casts = ['amount' => 'decimal:2', 'version' => 'integer', 'expected_close_date' => 'date:Y-m-d'];

    public function events(): HasMany
    {
        return $this->hasMany(CrmDealEvent::class, 'deal_id')->orderByDesc('created_at')->orderByDesc('id');
    }
}
