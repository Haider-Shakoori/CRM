<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\Lead;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CrmLeadConversionController
{
    public function show(string $id): JsonResponse
    {
        Lead::query()->findOrFail($id);
        $link = DB::table('crm_lead_conversions')
            ->where('organization_id', app(OrganizationContext::class)->organizationId)
            ->where('lead_id', $id)->first();
        if (!$link) abort(404);
        return response()->json(['ok' => true, 'data' => $this->format($link)]);
    }

    /**
     * Idempotent, serialized conversion. The Lead stays as an auditable CRM record.
     * Existing linked Account must be tenant-visible; created Contact is new.
     */
    public function store(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $data = $request->validate([
            'expected_version' => ['required', 'integer', 'min:1'],
            'first_name' => ['required', 'string', 'min:1', 'max:120'],
            'last_name' => ['required', 'string', 'min:1', 'max:120'],
            'account_id' => ['required_without:account_name', 'nullable', 'uuid', 'prohibits:account_name'],
            'account_name' => ['required_without:account_id', 'nullable', 'string', 'min:1', 'max:200', 'prohibits:account_id'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:254'],
            'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'],
            'contact_id' => ['prohibited'], 'id' => ['prohibited'],
        ]);

        return DB::transaction(function () use ($request, $context, $id, $data): JsonResponse {
            $lead = Lead::query()->lockForUpdate()->findOrFail($id);
            $existing = DB::table('crm_lead_conversions')
                ->where('organization_id', $context->organizationId)->where('lead_id', $id)->first();
            if ($existing) {
                return response()->json(['ok' => true, 'data' => $this->format($existing)]);
            }
            if ($lead->status === 'converted') {
                return $this->conflict('Lead marked converted without a conversion record. Review its data.');
            }
            if ((int) $lead->version !== (int) $data['expected_version']) {
                return $this->conflict('Lead changed elsewhere. Refresh before converting.');
            }

            if (!empty($data['account_id'])) {
                $account = CrmAccount::query()->find($data['account_id']);
                if (!$account) {
                    throw ValidationException::withMessages(['account_id' => 'Account unavailable in this organization.']);
                }
            } else {
                $account = CrmAccount::forceCreate([
                    'organization_id' => $context->organizationId, 'name' => $data['account_name'],
                    'version' => 1,
                ]);
                AuditTrail::current($request, 'account.created', 'account', $account->id, ['from_lead' => $id]);
            }

            $contact = CrmContact::forceCreate([
                'organization_id' => $context->organizationId,
                'account_id' => $account->id,
                'first_name' => trim($data['first_name']), 'last_name' => trim($data['last_name']),
                'email' => array_key_exists('email', $data) ? $data['email'] : $lead->email,
                'notes' => $lead->notes, 'version' => 1,
            ]);
            $lead->forceFill(['status' => 'converted', 'version' => $lead->version + 1])->save();
            $conversionId = (string) Str::uuid();
            DB::table('crm_lead_conversions')->insert([
                'id' => $conversionId, 'organization_id' => $context->organizationId,
                'lead_id' => $lead->id, 'contact_id' => $contact->id,
                'account_id' => $account->id, 'converted_by' => $request->user()->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            AuditTrail::current($request, 'contact.created', 'contact', $contact->id, ['from_lead' => $id]);
            AuditTrail::current($request, 'lead.converted', 'lead', $id, [
                'account_id' => $account->id, 'contact_id' => $contact->id, 'version' => $lead->version,
            ]);
            $link = DB::table('crm_lead_conversions')->where('id', $conversionId)->first();
            return response()->json(['ok' => true, 'data' => $this->format($link)], 201);
        });
    }

    private function format(object $row): array
    {
        return [
            'id' => $row->id, 'lead_id' => $row->lead_id,
            'account_id' => $row->account_id, 'contact_id' => $row->contact_id,
            'converted_by' => $row->converted_by, 'created_at' => $row->created_at,
        ];
    }

    private function conflict(string $message): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => $message, 'retryable' => false,
        ]], 409);
    }
}
