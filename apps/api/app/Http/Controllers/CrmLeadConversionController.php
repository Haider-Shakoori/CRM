<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Models\CrmDealEvent;
use App\Models\CrmPipeline;
use App\Models\CrmPipelineStage;
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

    public function matches(string $id): JsonResponse
    {
        $lead = Lead::query()->findOrFail($id);
        $email = trim((string) $lead->email);
        // Only exact normalized emails are automatic matches. Name similarities
        // are advisory: names alone never cause two people to be merged.
        $contacts = $email !== '' ? CrmContact::query()
            ->whereRaw('LOWER(TRIM(email)) = ?', [mb_strtolower($email)])
            ->orderBy('id')->limit(15)->get(['id', 'first_name', 'last_name', 'email', 'account_id'])
            : collect();
        $leads = $email !== '' ? Lead::query()
            ->where('id', '!=', $id)
            ->whereRaw('LOWER(TRIM(email)) = ?', [mb_strtolower($email)])
            ->orderBy('id')->limit(15)->get(['id', 'name', 'email', 'status'])
            : collect();
        return response()->json(['ok' => true, 'data' => [
            'contact_email_matches' => $contacts,
            'lead_email_matches' => $leads,
            'match_rule' => 'Exact case-insensitive, trimmed email within this organization. Review before converting.',
        ]]);
    }

    public function store(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $data = $request->validate([
            'expected_version' => ['required', 'integer', 'min:1'],
            'first_name' => ['required', 'string', 'min:1', 'max:120'],
            'last_name' => ['required', 'string', 'min:1', 'max:120'],
            'account_id' => ['required_without:account_name', 'nullable', 'uuid', 'prohibits:account_name'],
            'account_name' => ['required_without:account_id', 'nullable', 'string', 'min:1', 'max:200', 'prohibits:account_id'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:254'],
            'allow_duplicate_contact' => ['sometimes', 'boolean'],
            'deal' => ['sometimes', 'nullable', 'array'],
            'deal.name' => ['required_with:deal', 'string', 'min:1', 'max:200'],
            'deal.pipeline_id' => ['required_with:deal', 'uuid'],
            'deal.stage_id' => ['required_with:deal', 'uuid'],
            'deal.amount' => ['sometimes', 'numeric', 'min:0', 'max:99999999999999.99'],
            'deal.currency' => ['sometimes', 'string', 'size:3', 'alpha:ascii'],
            'deal.expected_close_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'deal.notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'organization_id' => ['prohibited'], 'tenant_id' => ['prohibited'],
            'contact_id' => ['prohibited'], 'deal_id' => ['prohibited'], 'id' => ['prohibited'],
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

            $email = array_key_exists('email', $data) ? trim((string) $data['email']) : trim((string) $lead->email);
            if ($email !== '' && !$request->boolean('allow_duplicate_contact') &&
                CrmContact::query()->whereRaw('LOWER(TRIM(email)) = ?', [mb_strtolower($email)])->exists()) {
                return $this->conflict('A Contact with this email already exists. Review matches and explicitly confirm a separate Contact if intended.');
            }

            if (!empty($data['account_id'])) {
                $account = CrmAccount::query()->find($data['account_id']);
                if (!$account) {
                    throw ValidationException::withMessages(['account_id' => 'Account unavailable in this organization.']);
                }
            } else {
                $name = trim((string) $data['account_name']);
                if (CrmAccount::query()->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)])->exists()) {
                    throw ValidationException::withMessages(['account_name' => 'An Account with this name exists. Select the existing Account instead.']);
                }
                $account = CrmAccount::forceCreate([
                    'organization_id' => $context->organizationId, 'name' => $name, 'version' => 1,
                ]);
                AuditTrail::current($request, 'account.created', 'account', $account->id, ['from_lead' => $id]);
            }

            // Validate optional Deal links before committing any related CRM record.
            $dealFields = $data['deal'] ?? null;
            if ($dealFields !== null) {
                if (!CrmPipeline::query()->whereKey($dealFields['pipeline_id'])->exists() ||
                    !CrmPipelineStage::query()->where('pipeline_id', $dealFields['pipeline_id'])
                        ->whereKey($dealFields['stage_id'])->exists()) {
                    throw ValidationException::withMessages(['deal.stage_id' => 'Stage must belong to a pipeline in this organization.']);
                }
            }

            $contact = CrmContact::forceCreate([
                'organization_id' => $context->organizationId, 'account_id' => $account->id,
                'first_name' => trim($data['first_name']), 'last_name' => trim($data['last_name']),
                'email' => $email === '' ? null : $email, 'notes' => $lead->notes, 'version' => 1,
            ]);

            $dealId = null;
            if ($dealFields !== null) {
                $deal = CrmDeal::forceCreate([
                    'organization_id' => $context->organizationId,
                    'account_id' => $account->id, 'pipeline_id' => $dealFields['pipeline_id'],
                    'stage_id' => $dealFields['stage_id'], 'name' => trim($dealFields['name']),
                    'amount' => $dealFields['amount'] ?? 0, 'currency' => strtoupper($dealFields['currency'] ?? 'USD'),
                    'expected_close_date' => $dealFields['expected_close_date'] ?? null,
                    'notes' => $dealFields['notes'] ?? null, 'version' => 1,
                ]);
                CrmDealEvent::forceCreate([
                    'organization_id' => $context->organizationId, 'deal_id' => $deal->id,
                    'actor_user_id' => $request->user()->id, 'action' => 'created',
                    'from_stage_id' => null, 'to_stage_id' => $deal->stage_id,
                    'metadata' => ['from_lead' => $id], 'created_at' => now(),
                ]);
                $dealId = $deal->id;
                AuditTrail::current($request, 'deal.created', 'deal', $dealId, ['from_lead' => $id]);
            }

            $lead->forceFill(['status' => 'converted', 'version' => $lead->version + 1])->save();
            $conversionId = (string) Str::uuid();
            DB::table('crm_lead_conversions')->insert([
                'id' => $conversionId, 'organization_id' => $context->organizationId,
                'lead_id' => $lead->id, 'contact_id' => $contact->id,
                'account_id' => $account->id, 'deal_id' => $dealId,
                'converted_by' => $request->user()->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            AuditTrail::current($request, 'contact.created', 'contact', $contact->id, ['from_lead' => $id]);
            AuditTrail::current($request, 'lead.converted', 'lead', $id, [
                'account_id' => $account->id, 'contact_id' => $contact->id,
                'deal_id' => $dealId, 'version' => $lead->version,
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
            'deal_id' => $row->deal_id,
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
