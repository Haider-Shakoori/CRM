<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_tags', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('name', 80);
            $table->char('color', 7)->default('#64748b');
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();
            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'name']);
        });
        DB::statement('CREATE UNIQUE INDEX crm_tag_normalized_name_unique ON crm_tags (organization_id, lower(trim(name)))');
        DB::statement("ALTER TABLE crm_tags ADD CONSTRAINT crm_tag_color_valid CHECK (color ~ '^#[0-9A-Fa-f]{6}$')");

        Schema::create('crm_tag_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('tag_id');
            $table->uuid('lead_id')->nullable();
            $table->uuid('contact_id')->nullable();
            $table->uuid('account_id')->nullable();
            $table->uuid('deal_id')->nullable();
            $table->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at');
            $table->foreign(['organization_id', 'tag_id'])->references(['organization_id', 'id'])
                ->on('crm_tags')->restrictOnDelete();
            $table->foreign(['organization_id', 'lead_id'])->references(['organization_id', 'id'])
                ->on('leads')->cascadeOnDelete();
            $table->foreign(['organization_id', 'contact_id'])->references(['organization_id', 'id'])
                ->on('crm_contacts')->cascadeOnDelete();
            $table->foreign(['organization_id', 'account_id'])->references(['organization_id', 'id'])
                ->on('crm_accounts')->cascadeOnDelete();
            $table->foreign(['organization_id', 'deal_id'])->references(['organization_id', 'id'])
                ->on('crm_deals')->cascadeOnDelete();
            foreach (['lead', 'contact', 'account', 'deal'] as $type) {
                $table->unique(['organization_id', 'tag_id', $type.'_id'], 'crm_tag_'.$type.'_unique');
                $table->index(['organization_id', $type.'_id', 'tag_id'], 'crm_tag_'.$type.'_lookup');
            }
        });
        DB::statement('ALTER TABLE crm_tag_links ADD CONSTRAINT crm_tag_link_one_subject CHECK (num_nonnulls(lead_id, contact_id, account_id, deal_id) = 1)');
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_tag_links');
        Schema::dropIfExists('crm_tags');
    }
};
