<?php

namespace App\Support;

use App\Models\Tenant;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

final class SubscriptionEntitlements
{
    public const RESOURCES = ['seats', 'leads', 'contacts', 'accounts', 'deals', 'activities'];

    /** Null limits are unmetered, including for grandfathered tenants. */
    public static function snapshot(string $tenantId): array
    {
        $row = DB::table('crm_tenant_subscriptions as sub')
            ->join('crm_subscription_plans as plan', 'plan.id', '=', 'sub.plan_id')
            ->where('sub.tenant_id', $tenantId)->first([
                'sub.id', 'sub.version', 'sub.status', 'sub.period_ends_at',
                'sub.cancel_at_period_end', 'plan.code', 'plan.name', 'plan.limits',
            ]);
        if (!$row) {
            // Test fixtures or pre-subscription systems can lack a row. Never
            // guess paid entitlements: legacy compatibility is explicit.
            $legacy = DB::table('crm_subscription_plans')->where('code', 'legacy')->first();
            return [
                'id' => null, 'plan' => $legacy?->code ?? 'legacy',
                'plan_name' => $legacy?->name ?? 'Legacy', 'status' => 'active',
                'version' => 0, 'period_ends_at' => null,
                'cancel_at_period_end' => false,
                'limits' => array_fill_keys(self::RESOURCES, null),
            ];
        }
        $limits = json_decode($row->limits, true, 512, JSON_THROW_ON_ERROR);
        return [
            'id' => $row->id, 'plan' => $row->code, 'plan_name' => $row->name,
            'status' => $row->status, 'version' => (int) $row->version,
            'period_ends_at' => $row->period_ends_at,
            'cancel_at_period_end' => (bool) $row->cancel_at_period_end,
            'limits' => array_replace(array_fill_keys(self::RESOURCES, null), $limits),
        ];
    }

    public static function canWrite(array $subscription): bool
    {
        if (!in_array($subscription['status'], ['active', 'trialing'], true)) return false;
        return $subscription['period_ends_at'] === null ||
            \Illuminate\Support\Carbon::parse($subscription['period_ends_at'])->isFuture();
    }

    public static function requireWritable(string $tenantId): void
    {
        if (!self::canWrite(self::snapshot($tenantId))) {
            self::denied('subscription_inactive', 'Subscription is not active. CRM remains readable.');
        }
    }

    public static function effectiveSeatLimit(string $tenantId): ?int
    {
        $planLimit = self::snapshot($tenantId)['limits']['seats'];
        $explicitLimit = Tenant::query()->whereKey($tenantId)->value('seat_limit');
        return $planLimit === null ? $explicitLimit
            : ($explicitLimit === null ? (int) $planLimit : min((int) $planLimit, (int) $explicitLimit));
    }

    /** Called inside the same transaction as the create: serialize all tenant writes. */
    public static function guardCreate(string $tenantId, string $resource, int $additional = 1): void
    {
        if (!in_array($resource, self::RESOURCES, true) || $additional < 1) {
            throw new \InvalidArgumentException('Unknown quota resource.');
        }
        Tenant::query()->whereKey($tenantId)->lockForUpdate()->firstOrFail();
        $plan = self::snapshot($tenantId);
        if (!self::canWrite($plan)) {
            self::denied('subscription_inactive', 'Subscription is not active. CRM remains readable.');
        }
        $limit = $resource === 'seats' ? self::effectiveSeatLimit($tenantId)
            : $plan['limits'][$resource];
        if ($limit !== null && self::used($tenantId, $resource) + $additional > (int) $limit) {
            self::denied('entitlement_missing', 'The '.$resource.' limit for the current plan has been reached.');
        }
    }

    public static function used(string $tenantId, string $resource): int
    {
        if ($resource === 'seats') return SeatUsage::activeSeatCount($tenantId);
        $tables = [
            'leads' => 'leads', 'contacts' => 'crm_contacts',
            'accounts' => 'crm_accounts', 'deals' => 'crm_deals', 'activities' => 'crm_activities',
        ];
        if (!isset($tables[$resource])) throw new \InvalidArgumentException('Unknown resource.');
        return DB::table($tables[$resource].' as records')
            ->join('organizations as org', 'org.id', '=', 'records.organization_id')
            ->where('org.tenant_id', $tenantId)
            ->when(in_array($resource, ['deals', 'activities'], true),
                fn ($query) => $query->whereNull('records.deleted_at'))
            ->count();
    }

    public static function usage(string $tenantId): array
    {
        $result = [];
        foreach (self::RESOURCES as $resource) {
            $result[$resource] = self::used($tenantId, $resource);
        }
        return $result;
    }

    public static function denied(string $code, string $message): never
    {
        throw new HttpResponseException(response()->json(['ok' => false, 'error' => [
            'code' => $code, 'message' => $message, 'retryable' => false,
        ]], 409));
    }
}
