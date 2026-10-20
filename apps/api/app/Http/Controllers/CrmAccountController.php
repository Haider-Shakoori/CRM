<?php

namespace App\Http\Controllers;

use App\Models\CrmActivity;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class CrmAccountController
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['sometimes', 'string', 'max:120'],
        ]);
        $query = CrmAccount::query();
        if (isset($input['q']) && trim($input['q']) !== '') {
            $needle = addcslashes(trim($input['q']), '%_\\');
            $query->where('name', 'ilike', '%'.$needle.'%');
        }
        $page = $query->orderBy('name')->orderBy('id')->paginate($input['pageSize'] ?? 25);

        return response()->json(['ok' => true, 'data' => [
            'items' => $page->items(),
            'meta' => [
                'page' => $page->currentPage(), 'pageSize' => $page->perPage(),
                'total' => $page->total(), 'totalPages' => $page->lastPage(),
                'hasNext' => $page->hasMorePages(), 'hasPrev' => $page->currentPage() > 1,
            ],
        ]]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => CrmAccount::query()->findOrFail($id)]);
    }

    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate($this->rules(false));
        $account = DB::transaction(function () use ($input, $request, $context): CrmAccount {
            $account = new CrmAccount();
            $account->forceFill(array_merge($input, [
                'organization_id' => $context->organizationId, 'version' => 1,
            ]))->save();
            AuditTrail::current($request, 'account.created', 'account', $account->id);
            return $account;
        });

        return response()->json(['ok' => true, 'data' => $account], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $input = $request->validate(array_merge($this->rules(true), [
            'expected_version' => ['required', 'integer', 'min:1'],
        ]));
        return DB::transaction(function () use ($request, $id, $input): JsonResponse {
            $account = CrmAccount::query()->findOrFail($id);
            $expected = (int) $input['expected_version'];
            if ($account->version !== $expected) return $this->conflict();
            $fields = array_intersect_key($input, array_flip(['name', 'website', 'phone', 'industry', 'notes']));
            $affected = CrmAccount::query()->whereKey($id)->where('version', $expected)
                ->update(array_merge($fields, ['version' => $expected + 1, 'updated_at' => now()]));
            if ($affected !== 1) return $this->conflict();
            AuditTrail::current($request, 'account.updated', 'account', $id, ['version' => $expected + 1]);
            return response()->json(['ok' => true, 'data' => CrmAccount::query()->findOrFail($id)]);
        });
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return DB::transaction(function () use ($request, $id): JsonResponse {
            $account = CrmAccount::query()->lockForUpdate()->findOrFail($id);
            if (CrmContact::query()->where('account_id', $id)->exists() ||
                CrmDeal::withTrashed()->where('account_id', $id)->exists() ||
                CrmActivity::withTrashed()->where('account_id', $id)->exists()) {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'conflict', 'message' => 'Move or unlink contacts, deals and activities before deleting this account.',
                    'retryable' => false,
                ]], 409);
            }
            $account->delete();
            AuditTrail::current($request, 'account.deleted', 'account', $id);
            return response()->json(['ok' => true, 'data' => ['id' => $id]]);
        });
    }

    private function rules(bool $partial): array
    {
        return [
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'min:1', 'max:200'],
            'website' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:60'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:120'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'],
            'id' => ['prohibited'], 'version' => ['prohibited'],
        ];
    }

    private function conflict(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => 'Account changed elsewhere. Refresh before editing.',
            'retryable' => false,
        ]], 409);
    }
}
