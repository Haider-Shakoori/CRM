<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_custom_fields', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('object_type', 16);
            $table->string('field_key', 50);
            $table->string('label', 120);
            $table->string('field_type', 16);
            $table->jsonb('options')->default('[]');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();
            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'object_type', 'is_active']);
        });
        DB::statement('CREATE UNIQUE INDEX crm_custom_key_unique ON crm_custom_fields (organization_id, object_type, lower(field_key))');
        DB::statement("ALTER TABLE crm_custom_fields ADD CONSTRAINT crm_custom_field_key_valid CHECK (field_key ~ '^[a-z][a-z0-9_]{1,49}$')");
        DB::statement("ALTER TABLE crm_custom_fields ADD CONSTRAINT crm_custom_field_type_valid CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select'))");
        DB::statement("ALTER TABLE crm_custom_fields ADD CONSTRAINT crm_custom_field_object_valid CHECK (object_type IN ('lead', 'contact', 'account', 'deal'))");
        DB::statement("ALTER TABLE crm_custom_fields ADD CONSTRAINT crm_custom_options_array CHECK (jsonb_typeof(options) = 'array')");

        Schema::create('crm_custom_values', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('field_id');
            $table->uuid('lead_id')->nullable();
            $table->uuid('contact_id')->nullable();
            $table->uuid('account_id')->nullable();
            $table->uuid('deal_id')->nullable();
            $table->jsonb('value');
            $table->foreignUuid('updated_by')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();
            $table->foreign(['organization_id', 'field_id'])->references(['organization_id', 'id'])
                ->on('crm_custom_fields')->restrictOnDelete();
            foreach (['lead' => 'leads', 'contact' => 'crm_contacts', 'account' => 'crm_accounts', 'deal' => 'crm_deals'] as $type => $tableName) {
                $table->foreign(['organization_id', $type.'_id'])->references(['organization_id', 'id'])
                    ->on($tableName)->restrictOnDelete();
                $table->unique(['organization_id', 'field_id', $type.'_id'], 'crm_custom_'.$type.'_unique');
                $table->index(['organization_id', $type.'_id'], 'crm_custom_'.$type.'_lookup');
            }
        });
        DB::statement('ALTER TABLE crm_custom_values ADD CONSTRAINT crm_custom_one_subject CHECK (num_nonnulls(lead_id, contact_id, account_id, deal_id) = 1)');
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_custom_values');
        Schema::dropIfExists('crm_custom_fields');
    }
};
