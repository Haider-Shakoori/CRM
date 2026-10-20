<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('crm:health', function () {
    $this->info('CRM API bootstrap is available.');
})->purpose('Verify the API command runtime');


// Restricted server-side operator workflow. No browser endpoint can mutate plans.
Artisan::command('crm:subscription:set {tenant : Tenant UUID} {plan : Plan code} {status : active|trialing|past_due|canceled|expired} {--ends= : Period end ISO date or "none"} {--cancel-at-period-end} {--version= : Expected current subscription version}', function () {
    $tenantId = (string) $this->argument('tenant');
    $code = (string) $this->argument('plan');
    $status = (string) $this->argument('status');
    if (!in_array($status, ['active', 'trialing', 'past_due', 'canceled', 'expired'], true)) {
        $this->error('Invalid status.'); return 1;
    }
    if (!\Illuminate\Support\Str::isUuid($tenantId)) {
        $this->error('Invalid tenant UUID.'); return 1;
    }
    try {
        $ends = $this->option('ends');
        if ($ends !== null && $ends !== 'none') {
            $ends = \Illuminate\Support\Carbon::parse($ends)->utc();
        } else {
            $ends = null;
        }
        if ($status === 'trialing' && !$ends) {
            $this->error('Trialing subscriptions require --ends.'); return 1;
        }
        $expectedVersion = $this->option('version');
        if ($expectedVersion !== null && (!ctype_digit((string) $expectedVersion) || (int) $expectedVersion < 1)) {
            $this->error('Version must be a positive integer.'); return 1;
        }
        $result = \Illuminate\Support\Facades\DB::transaction(function () use ($tenantId, $code, $status, $ends, $expectedVersion): string {
            $tenant = \App\Models\Tenant::query()->whereKey($tenantId)->lockForUpdate()->first();
            $plan = \Illuminate\Support\Facades\DB::table('crm_subscription_plans')->where('code', $code)->first();
            if (!$tenant || !$plan) throw new \RuntimeException('Tenant or plan not found.');
            $db = \Illuminate\Support\Facades\DB::table('crm_tenant_subscriptions');
            $current = (clone $db)->where('tenant_id', $tenantId)->lockForUpdate()->first();
            if ($expectedVersion !== null && (!$current || (int) $expectedVersion !== (int) $current->version)) {
                throw new \RuntimeException('Subscription version mismatch; inspect before changing.');
            }
            $id = $current?->id ?? (string) \Illuminate\Support\Str::uuid();
            $newVersion = ($current?->version ?? 0) + 1;
            $values = [
                'plan_id' => $plan->id, 'status' => $status,
                'period_ends_at' => $ends, 'cancel_at_period_end' => (bool) $this->option('cancel-at-period-end'),
                'version' => $newVersion, 'updated_at' => now(),
            ];
            if ($current) {
                (clone $db)->where('id', $id)->update($values);
            } else {
                (clone $db)->insert(array_merge($values, [
                    'id' => $id, 'tenant_id' => $tenantId, 'created_at' => now(),
                ]));
            }
            \Illuminate\Support\Facades\DB::table('crm_subscription_events')->insert([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id' => $tenantId, 'subscription_id' => $id,
                'action' => 'operator_updated', 'source' => 'operator_cli',
                'changes' => json_encode(['plan' => $code, 'status' => $status,
                    'period_ends_at' => $ends?->toIso8601String(),
                    'cancel_at_period_end' => (bool) $this->option('cancel-at-period-end'),
                    'version' => $newVersion], JSON_THROW_ON_ERROR),
                'created_at' => now(),
            ]);
            return $id;
        });
        $this->info('Updated subscription '.$result.' for tenant '.$tenantId.'. No payment was processed.');
        return 0;
    } catch (\Throwable $e) {
        $this->error('Subscription update failed: '.$e->getMessage());
        return 1;
    }
})->purpose('Operator-only CRM entitlement changes; never charges or changes Stripe.');
