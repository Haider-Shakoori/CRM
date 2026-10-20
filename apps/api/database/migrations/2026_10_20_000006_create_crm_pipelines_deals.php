<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_pipelines', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('name', 150);
            $t->unsignedInteger('version')->default(1);
            $t->timestamps();
            $t->unique(['organization_id', 'id']);
            $t->index(['organization_id', 'name']);
        });
        Schema::create('crm_pipeline_stages', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id');
            $t->uuid('pipeline_id');
            $t->string('name', 120);
            $t->enum('kind', ['open', 'won', 'lost'])->default('open');
            $t->unsignedInteger('position')->default(0);
            $t->timestamps();
            $t->foreign(['organization_id', 'pipeline_id'])
                ->references(['organization_id', 'id'])->on('crm_pipelines')->cascadeOnDelete();
            $t->unique(['organization_id', 'pipeline_id', 'id'], 'crm_stage_tenant_pipeline_id_uniq');
            $t->index(['organization_id', 'pipeline_id', 'position'], 'crm_stage_order_idx');
        });
        Schema::create('crm_deals', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id');
            $t->uuid('pipeline_id');
            $t->uuid('stage_id');
            $t->uuid('account_id')->nullable();
            $t->string('name', 200);
            $t->decimal('amount', 16, 2)->default(0);
            $t->char('currency', 3)->default('USD');
            $t->date('expected_close_date')->nullable();
            $t->text('notes')->nullable();
            $t->unsignedInteger('version')->default(1);
            $t->timestamps();
            $t->softDeletes();
            $t->foreign(['organization_id', 'pipeline_id', 'stage_id'])
                ->references(['organization_id', 'pipeline_id', 'id'])->on('crm_pipeline_stages')
                ->restrictOnDelete();
            $t->foreign(['organization_id', 'account_id'])
                ->references(['organization_id', 'id'])->on('crm_accounts')->restrictOnDelete();
            $t->unique(['organization_id', 'id']);
            $t->index(['organization_id', 'pipeline_id', 'stage_id'], 'crm_deals_board_idx');
        });
        Schema::create('crm_deal_events', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id');
            $t->uuid('deal_id');
            $t->foreignUuid('actor_user_id')->constrained('users')->restrictOnDelete();
            $t->string('action', 60);
            $t->uuid('from_stage_id')->nullable();
            $t->uuid('to_stage_id')->nullable();
            $t->jsonb('metadata')->default('{}');
            $t->timestamp('created_at');
            $t->foreign(['organization_id', 'deal_id'])
                ->references(['organization_id', 'id'])->on('crm_deals')->restrictOnDelete();
            $t->index(['organization_id', 'deal_id', 'created_at'], 'crm_deal_events_timeline');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_deal_events');
        Schema::dropIfExists('crm_deals');
        Schema::dropIfExists('crm_pipeline_stages');
        Schema::dropIfExists('crm_pipelines');
    }
};
