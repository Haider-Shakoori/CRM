<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->uuid('created_by');
            $table->foreign('created_by')->references('id')->on('users')->restrictOnDelete();
            $table->string('title', 200);
            $table->text('body');
            $table->uuid('lead_id')->nullable();
            $table->uuid('contact_id')->nullable();
            $table->uuid('account_id')->nullable();
            $table->uuid('deal_id')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->unique(['organization_id', 'id']);
            $table->foreign(['organization_id', 'lead_id'])
                ->references(['organization_id', 'id'])->on('leads')->restrictOnDelete();
            $table->foreign(['organization_id', 'contact_id'])
                ->references(['organization_id', 'id'])->on('crm_contacts')->restrictOnDelete();
            $table->foreign(['organization_id', 'account_id'])
                ->references(['organization_id', 'id'])->on('crm_accounts')->restrictOnDelete();
            $table->foreign(['organization_id', 'deal_id'])
                ->references(['organization_id', 'id'])->on('crm_deals')->restrictOnDelete();
            foreach (['lead', 'contact', 'account', 'deal'] as $type) {
                $table->index(['organization_id', $type.'_id', 'created_at'], 'crm_note_'.$type.'_timeline_idx');
            }
        });
        DB::statement('ALTER TABLE crm_notes ADD CONSTRAINT crm_note_one_subject CHECK (num_nonnulls(lead_id, contact_id, account_id, deal_id) = 1)');

        Schema::create('crm_note_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('note_id');
            $table->foreignUuid('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 40);
            $table->jsonb('metadata')->default('{}');
            $table->timestampTz('created_at');
            $table->foreign(['organization_id', 'note_id'])
                ->references(['organization_id', 'id'])->on('crm_notes')->restrictOnDelete();
            $table->index(['organization_id', 'note_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_note_events');
        Schema::dropIfExists('crm_notes');
    }
};
