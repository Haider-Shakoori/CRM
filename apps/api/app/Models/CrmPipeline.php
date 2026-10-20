<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class CrmPipeline extends Model
{
    use HasUuids, ScopedToOrganization;

    protected $fillable = ['name'];
    protected $table = 'crm_pipelines';

    public function stages(): HasMany
    {
        return $this->hasMany(CrmPipelineStage::class, 'pipeline_id')->orderBy('position')->orderBy('id');
    }
}
