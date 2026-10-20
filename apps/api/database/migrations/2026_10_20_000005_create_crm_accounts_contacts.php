<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('name', 200);
            $table->string('website', 255)->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('industry', 120)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'name']);
        });

        Schema::create('crm_contacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->uuid('account_id')->nullable();
            $table->string('first_name', 120);
            $table->string('last_name', 120);
            $table->string('email', 254)->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('job_title', 150)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            // A contact can never point to an Account in a different organization,
            // even if a write bypasses the HTTP/controller validation.
            $table->foreign(['organization_id', 'account_id'])
                ->references(['organization_id', 'id'])->on('crm_accounts')
                ->restrictOnDelete();
            $table->index(['organization_id', 'last_name', 'first_name']);
            $table->index(['organization_id', 'account_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_contacts');
        Schema::dropIfExists('crm_accounts');
    }
};
