<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_subscription_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 40)->unique();
            $table->string('name', 100);
            $table->jsonb('limits');
            $table->boolean('public')->default(false);
            $table->timestampsTz();
        });
        Schema::create('crm_tenant_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->unique()->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('plan_id')->constrained('crm_subscription_plans')->restrictOnDelete();
            $table->string('status', 30);
            $table->timestampTz('period_ends_at')->nullable();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();
            $table->index(['status', 'period_ends_at']);
        });
        Schema::create('crm_subscription_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('subscription_id')->constrained('crm_tenant_subscriptions')->cascadeOnDelete();
            $table->string('action', 60);
            $table->jsonb('changes');
            $table->string('source', 30);
            $table->timestampTz('created_at');
            $table->index(['tenant_id', 'created_at']);
        });

        $now = now();
        foreach ([
            ['legacy', 'Legacy (existing tenants)', ['seats' => null, 'leads' => null, 'contacts' => null, 'accounts' => null, 'deals' => null, 'activities' => null], false],
            ['starter', 'Starter (free)', ['seats' => 3, 'leads' => 200, 'contacts' => 200, 'accounts' => 100, 'deals' => 100, 'activities' => 500], true],
            ['team', 'Team (not yet available for purchase)', ['seats' => 10, 'leads' => 5000, 'contacts' => 5000, 'accounts' => 2000, 'deals' => 3000, 'activities' => 10000], false],
            ['business', 'Business (not yet available for purchase)', ['seats' => 50, 'leads' => null, 'contacts' => null, 'accounts' => null, 'deals' => null, 'activities' => null], false],
        ] as [$code, $name, $limits, $public]) {
            DB::table('crm_subscription_plans')->insert([
                'id' => (string) Str::uuid(), 'code' => $code, 'name' => $name,
                'limits' => json_encode($limits), 'public' => $public,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        // Preserve existing tenant access: do not silently place existing customers
        // on a restrictive or allegedly paid plan during upgrade.
        $legacy = DB::table('crm_subscription_plans')->where('code', 'legacy')->value('id');
        DB::table('tenants')->orderBy('id')->chunk(100, function ($tenants) use ($legacy, $now) {
            foreach ($tenants as $tenant) {
                DB::table('crm_tenant_subscriptions')->insert([
                    'id' => (string) Str::uuid(), 'tenant_id' => $tenant->id,
                    'plan_id' => $legacy, 'status' => 'active', 'version' => 1,
                    'cancel_at_period_end' => false, 'period_ends_at' => null,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_subscription_events');
        Schema::dropIfExists('crm_tenant_subscriptions');
        Schema::dropIfExists('crm_subscription_plans');
    }
};
