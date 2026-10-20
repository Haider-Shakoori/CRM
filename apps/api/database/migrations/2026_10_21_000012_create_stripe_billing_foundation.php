<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('crm_stripe_checkout_intents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('plan_id')->constrained('crm_subscription_plans')->restrictOnDelete();
            $table->string('price_id', 255);
            $table->string('stripe_checkout_session_id', 255)->nullable()->unique();
            $table->string('stripe_customer_id', 255)->nullable();
            $table->string('stripe_subscription_id', 255)->nullable();
            $table->string('status', 32)->default('created');
            $table->timestampsTz();
            $table->index(['tenant_id', 'created_at']);
        });
        Schema::create('crm_stripe_subscription_links', function (Blueprint $table) {
            $table->uuid('tenant_id')->primary();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->string('stripe_customer_id', 255)->unique();
            $table->string('stripe_subscription_id', 255)->unique();
            $table->foreignUuid('plan_id')->constrained('crm_subscription_plans')->restrictOnDelete();
            $table->unsignedBigInteger('last_event_created')->default(0);
            $table->string('last_event_id', 255)->default('');
            $table->timestampsTz();
        });
        Schema::create('crm_stripe_webhook_events', function (Blueprint $table) {
            $table->string('id', 255)->primary();
            $table->string('type', 120);
            $table->boolean('livemode');
            $table->string('outcome', 40);
            $table->uuid('tenant_id')->nullable();
            $table->timestampTz('processed_at');
            $table->index(['tenant_id', 'processed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_stripe_webhook_events');
        Schema::dropIfExists('crm_stripe_subscription_links');
        Schema::dropIfExists('crm_stripe_checkout_intents');
    }
};
