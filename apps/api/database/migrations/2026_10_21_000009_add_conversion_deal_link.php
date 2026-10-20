<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('crm_lead_conversions', function (Blueprint $table) {
            $table->uuid('deal_id')->nullable();
            $table->foreign(['organization_id', 'deal_id'])
                ->references(['organization_id', 'id'])->on('crm_deals')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('crm_lead_conversions', function (Blueprint $table) {
            $table->dropForeign(['organization_id', 'deal_id']);
            $table->dropColumn('deal_id');
        });
    }
};
