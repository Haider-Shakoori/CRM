<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\Lead;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use App\Support\SubscriptionEntitlements;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CrmDataTransferController
{
    private const FIELDS = [
        'leads' => ['name', 'email', 'status', 'notes'],
        'contacts' => ['first_name', 'last_name', 'email', 'phone', 'job_title', 'notes', 'account_id'],
        'accounts' => ['name', 'website', 'phone', 'industry', 'notes'],
    ];

    private const MODELS = [
        'leads' => Lead::class,
        'contacts' => CrmContact::class,
        'accounts' => CrmAccount::class,
    ];

    private function onlyAdministrators(Request $request): void
    {
        if (!in_array($request->attributes->get('crm_membership')?->role, ['owner', 'admin'], true)) {
            abort(403, 'An organization owner or administrator is required for bulk transfers.');
        }
    }

    private function requestRows(Request $request): array
    {
        return $request->validate([
            'entity' => ['required', Rule::in(array_keys(self::FIELDS))],
            'rows' => ['required', 'array', 'min:1', 'max:100', 'list'],
            'rows.*' => ['required', 'array'],
            'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'],
            'mode' => ['prohibited'],
        ]);
    }

    private function rules(string $entity): array
    {
        return match ($entity) {
            'leads' => [
                'name' => ['required', 'string', 'min:1', 'max:200'],
                'email' => ['nullable', 'email:rfc', 'max:254'],
                'status' => ['nullable', Rule::in(['new', 'contacted', 'qualified', 'unqualified'])],
                'notes' => ['nullable', 'string', 'max:10000'],
            ],
            'contacts' => [
                'first_name' => ['required', 'string', 'min:1', 'max:120'],
                'last_name' => ['required', 'string', 'min:1', 'max:120'],
                'email' => ['nullable', 'email:rfc', 'max:254'],
                'phone' => ['nullable', 'string', 'max:60'],
                'job_title' => ['nullable', 'string', 'max:150'],
                'notes' => ['nullable', 'string', 'max:10000'],
                'account_id' => ['nullable', 'uuid'],
            ],
            default => [
                'name' => ['required', 'string', 'min:1', 'max:200'],
                'website' => ['nullable', 'url:http,https', 'max:255'],
                'phone' => ['nullable', 'string', 'max:60'],
                'industry' => ['nullable', 'string', 'max:120'],
                'notes' => ['nullable', 'string', 'max:10000'],
            ],
        };
    }

    /**
     * Re-evaluate on COMMIT after acquiring tenant serialization lock.
     * Do not trust preview results as an authorization or de-dup decision.
     */
    private function inspect(string $entity, array $rows): array
    {
        $normalized = [];
        $issues = [];
        $seen = [];
        $rules = $this->rules($entity);

        foreach ($rows as $index => $row) {
            $line = $index + 2; // Header occupies CSV line 1 (logical record numbers).
            if (!is_array($row) || array_is_list($row)) {
                $issues[] = ['row' => $line, 'field' => 'row', 'message' => 'Use named columns, not a list.'];
                continue;
            }
            foreach (array_keys($row) as $column) {
                if (!in_array($column, self::FIELDS[$entity], true)) {
                    $issues[] = ['row' => $line, 'field' => $column, 'message' => 'Column is not supported.'];
                }
            }
            $candidate = [];
            foreach (self::FIELDS[$entity] as $field) {
                if (!array_key_exists($field, $row)) continue;
                $value = $row[$field];
                $candidate[$field] = is_string($value) ? trim($value) : $value;
                if ($candidate[$field] === '') $candidate[$field] = null;
            }
            $validation = Validator::make($candidate, $rules);
            if ($validation->fails()) {
                foreach ($validation->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $issues[] = ['row' => $line, 'field' => $field, 'message' => $message];
                    }
                }
                continue;
            }
            $key = $entity === 'accounts'
                ? mb_strtolower((string) ($candidate['name'] ?? ''))
                : mb_strtolower((string) ($candidate['email'] ?? ''));
            $key = trim($key);
            if ($key !== '') {
                if (isset($seen[$key])) {
                    $issues[] = ['row' => $line, 'field' => $entity === 'accounts' ? 'name' : 'email',
                        'message' => 'Duplicate of imported record '.$seen[$key].'.'];
                }
                $seen[$key] = $line;
                $column = $entity === 'accounts' ? 'name' : 'email';
                $model = self::MODELS[$entity];
                if ($model::query()->whereRaw('LOWER(TRIM('.$column.')) = ?', [$key])->exists()) {
                    $issues[] = ['row' => $line, 'field' => $column,
                        'message' => 'A record with this '.($column === 'name' ? 'name' : 'email').' already exists in this organization.'];
                }
            }
            if ($entity === 'contacts' && !empty($candidate['account_id']) &&
                !CrmAccount::query()->whereKey($candidate['account_id'])->exists()) {
                $issues[] = ['row' => $line, 'field' => 'account_id',
                    'message' => 'Account does not belong to the selected organization.'];
            }
            $normalized[] = $candidate;
        }
        return ['rows' => $normalized, 'issues' => $issues, 'count' => count($rows)];
    }

    public function preview(Request $request): JsonResponse
    {
        $this->onlyAdministrators($request);
        $input = $this->requestRows($request);
        $inspection = $this->inspect($input['entity'], $input['rows']);
        return response()->json(['ok' => true, 'data' => [
            'entity' => $input['entity'], 'valid' => count($inspection['issues']) === 0,
            'count' => $inspection['count'], 'issues' => $inspection['issues'],
            'will_create' => count($inspection['issues']) === 0 ? $inspection['count'] : 0,
            'message' => 'Preview only: no records were created.',
        ]]);
    }

    public function commit(Request $request, OrganizationContext $context): JsonResponse
    {
        $this->onlyAdministrators($request);
        $input = $this->requestRows($request);
        $entity = $input['entity'];
        return DB::transaction(function () use ($request, $context, $input, $entity): JsonResponse {
            // SubscriptionEntitlements locks the tenant row before counting, so
            // concurrent standard writes and imports share the same quota lock.
            SubscriptionEntitlements::guardCreate($context->tenantId, $entity, count($input['rows']));
            $inspection = $this->inspect($entity, $input['rows']);
            if ($inspection['issues']) {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'validation_failed',
                    'message' => 'Import contains invalid or duplicate records. No rows were imported.',
                    'retryable' => false, 'issues' => $inspection['issues'],
                ]], 422);
            }
            $model = self::MODELS[$entity];
            foreach ($inspection['rows'] as $attributes) {
                if ($entity === 'leads') $attributes['status'] ??= 'new';
                $record = $model::forceCreate($attributes + [
                    'organization_id' => $context->organizationId, 'version' => 1,
                ]);
                AuditTrail::current($request, 'bulk.'.$entity.'.created', $entity, $record->id, [
                    'source' => 'csv_import',
                ]);
            }
            return response()->json(['ok' => true, 'data' => [
                'entity' => $entity, 'created' => count($inspection['rows']),
                'message' => 'Bulk import committed as a single transaction.',
            ]], 201);
        });
    }

    public function export(Request $request): JsonResponse
    {
        $this->onlyAdministrators($request);
        $filters = $request->validate([
            'entity' => ['required', Rule::in(array_keys(self::FIELDS))],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $entity = $filters['entity'];
        $model = self::MODELS[$entity];
        $fields = self::FIELDS[$entity];
        // No ownership IDs, user identifiers or internal timestamps are exported.
        $page = $model::query()->orderBy('id')->paginate(
            $filters['pageSize'] ?? 100, array_merge(['id'], $fields), 'page', $filters['page'] ?? 1,
        );
        AuditTrail::current($request, 'bulk.'.$entity.'.exported', $entity, null, [
            'count' => count($page->items()), 'page' => $page->currentPage(),
        ]);
        return response()->json(['ok' => true, 'data' => [
            'entity' => $entity, 'columns' => $fields,
            'items' => array_map(fn ($record) => collect($record)->only($fields)->all(), $page->items()),
            'meta' => [
                'page' => $page->currentPage(), 'total' => $page->total(),
                'hasNext' => $page->hasMorePages(),
                'pageSize' => $page->perPage(),
            ],
        ]]);
    }
}
