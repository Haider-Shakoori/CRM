<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // NULL until the tenant has a paid plan: no arbitrary limit at signup.
            $table->unsignedInteger('seat_limit')->nullable();
        });

        Schema::create('audit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('actor_user_id')->constrained('users');
            $table->string('action', 120);
            $table->string('subject_type', 60);
            $table->string('subject_id')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at');
            $table->index(['organization_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::table('tenants', fn (Blueprint $table) => $table->dropColumn('seat_limit'));
    }
};
