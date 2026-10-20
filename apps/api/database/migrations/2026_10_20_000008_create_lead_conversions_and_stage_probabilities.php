<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('crm_lead_conversions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('lead_id');
            $table->uuid('contact_id');
            $table->uuid('account_id');
            $table->foreignUuid('converted_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['organization_id', 'lead_id']);
            $table->foreign(['organization_id', 'lead_id'])
                ->references(['organization_id', 'id'])->on('leads')->restrictOnDelete();
            $table->foreign(['organization_id', 'contact_id'])
                ->references(['organization_id', 'id'])->on('crm_contacts')->restrictOnDelete();
            $table->foreign(['organization_id', 'account_id'])
                ->references(['organization_id', 'id'])->on('crm_accounts')->restrictOnDelete();
        });
        Schema::table('crm_pipeline_stages', function (Blueprint $table) {
            $table->unsignedTinyInteger('probability')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('crm_pipeline_stages', fn (Blueprint $table) => $table->dropColumn('probability'));
        Schema::dropIfExists('crm_lead_conversions');
    }
};
