<?php

namespace App\Http\Controllers;

use App\Models\CrmActivity;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Support\AuditTrail;
use App\Support\SubscriptionEntitlements;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class CrmContactController
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['sometimes', 'string', 'max:120'],
            'account_id' => ['sometimes', 'uuid'],
        ]);
        $query = CrmContact::query();
        if (isset($input['account_id'])) $query->where('account_id', $input['account_id']);
        if (isset($input['q']) && trim($input['q']) !== '') {
            $needle = '%'.addcslashes(trim($input['q']), '%_\\').'%';
            $query->where(fn ($q) => $q->where('first_name', 'ilike', $needle)
                ->orWhere('last_name', 'ilike', $needle)->orWhere('email', 'ilike', $needle));
        }
        $page = $query->orderBy('last_name')->orderBy('first_name')->orderBy('id')
            ->paginate($input['pageSize'] ?? 25);
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
        return response()->json(['ok' => true, 'data' => CrmContact::query()->findOrFail($id)]);
    }

    public function store(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate($this->rules(false));
        $this->validateAccount($input);
        $contact = DB::transaction(function () use ($request, $context, $input): CrmContact {
            SubscriptionEntitlements::guardCreate($context->tenantId, 'contacts');
            $contact = new CrmContact();
            $contact->forceFill(array_merge($input, [
                'organization_id' => $context->organizationId, 'version' => 1,
            ]))->save();
            AuditTrail::current($request, 'contact.created', 'contact', $contact->id);
            return $contact;
        });
        return response()->json(['ok' => true, 'data' => $contact], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $input = $request->validate(array_merge($this->rules(true), [
            'expected_version' => ['required', 'integer', 'min:1'],
        ]));
        $this->validateAccount($input);
        return DB::transaction(function () use ($request, $id, $input): JsonResponse {
            $contact = CrmContact::query()->findOrFail($id);
            $expected = (int) $input['expected_version'];
            if ($contact->version !== $expected) return $this->conflict();
            $fields = array_intersect_key($input, array_flip([
                'first_name', 'last_name', 'email', 'phone', 'job_title', 'notes', 'account_id',
            ]));
            $affected = CrmContact::query()->whereKey($id)->where('version', $expected)
                ->update(array_merge($fields, ['version' => $expected + 1, 'updated_at' => now()]));
            if ($affected !== 1) return $this->conflict();
            AuditTrail::current($request, 'contact.updated', 'contact', $id, ['version' => $expected + 1]);
            return response()->json(['ok' => true, 'data' => CrmContact::query()->findOrFail($id)]);
        });
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return DB::transaction(function () use ($request, $id): JsonResponse {
            $contact = CrmContact::query()->findOrFail($id);
            if (DB::table('crm_lead_conversions')
                ->where('organization_id', $contact->organization_id)
                ->where('contact_id', $id)->exists()) {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'conflict',
                    'message' => 'This Contact is referenced by a Lead conversion. Preserve the conversion history.',
                    'retryable' => false,
                ]], 409);
            }
            if (CrmActivity::withTrashed()->where('contact_id', $id)->exists()) {
                return response()->json(['ok' => false, 'error' => [
                    'code' => 'conflict', 'message' => 'Unlink linked activities before deleting this contact.',
                    'retryable' => false,
                ]], 409);
            }
            $contact->delete();
            AuditTrail::current($request, 'contact.deleted', 'contact', $id);
            return response()->json(['ok' => true, 'data' => ['id' => $id]]);
        });
    }

    private function validateAccount(array $input): void
    {
        if (isset($input['account_id']) &&
            !CrmAccount::query()->whereKey($input['account_id'])->exists()) {
            throw ValidationException::withMessages([
                'account_id' => 'The selected account is unavailable in this organization.',
            ]);
        }
    }

    private function rules(bool $partial): array
    {
        return [
            'first_name' => [$partial ? 'sometimes' : 'required', 'string', 'min:1', 'max:120'],
            'last_name' => [$partial ? 'sometimes' : 'required', 'string', 'min:1', 'max:120'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:254'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:60'],
            'job_title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'account_id' => ['sometimes', 'nullable', 'uuid'],
            'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'],
            'id' => ['prohibited'], 'version' => ['prohibited'],
        ];
    }

    private function conflict(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => 'Contact changed elsewhere. Refresh before editing.',
            'retryable' => false,
        ]], 409);
    }
}
