<?php

namespace App\Models;

use App\Models\Concerns\ScopedToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class CrmPipelineStage extends Model
{
    use HasUuids, ScopedToOrganization;

    protected $table = 'crm_pipeline_stages';
    protected $fillable = ['name', 'kind', 'position'];
}
