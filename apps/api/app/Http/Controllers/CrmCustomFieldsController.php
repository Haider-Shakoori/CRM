<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use App\Models\CrmContact;
use App\Models\CrmDeal;
use App\Models\Lead;
use App\Support\AuditTrail;
use App\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CrmCustomFieldsController
{
    private const SUBJECTS = [
        'lead' => ['lead_id', Lead::class],
        'contact' => ['contact_id', CrmContact::class],
        'account' => ['account_id', CrmAccount::class],
        'deal' => ['deal_id', CrmDeal::class],
    ];
    private const TYPES = ['text', 'number', 'date', 'boolean', 'select'];

    private function admin(Request $request): void
    {
        if (!in_array($request->attributes->get('crm_membership')?->role, ['owner', 'admin'], true)) {
            abort(403, 'An organization owner or administrator is required.');
        }
    }

    private function subject(string $type, string $id): string
    {
        $definition = self::SUBJECTS[$type] ?? null;
        if (!$definition || !Str::isUuid($id) || !$definition[1]::query()->whereKey($id)->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'CRM record unavailable in this organization.']);
        }
        return $definition[0];
    }

    private function definition(OrganizationContext $context, string $id): object
    {
        $field = DB::table('crm_custom_fields')->where('organization_id', $context->organizationId)
            ->where('id', $id)->first();
        if (!$field) abort(404);
        return $field;
    }

    private function conflict(string $message): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => 'conflict', 'message' => $message, 'retryable' => false,
        ]], 409);
    }

    private function fieldPayload(object $field): array
    {
        return [
            'id' => $field->id, 'object_type' => $field->object_type,
            'field_key' => $field->field_key, 'label' => $field->label,
            'field_type' => $field->field_type,
            'options' => json_decode($field->options, true, 512, JSON_THROW_ON_ERROR),
            'is_active' => (bool) $field->is_active,
            'version' => (int) $field->version,
        ];
    }

    private function validatedOptions(string $type, array $options): array
    {
        if ($type !== 'select' && count($options)) {
            throw ValidationException::withMessages(['options' => 'Only select fields support options.']);
        }
        if ($type === 'select' && (count($options) < 1 || count($options) > 20)) {
            throw ValidationException::withMessages(['options' => 'Select fields require 1–20 choices.']);
        }
        $clean = [];
        foreach ($options as $option) {
            if (!is_string($option) || trim($option) === '' || mb_strlen($option) > 80) {
                throw ValidationException::withMessages(['options' => 'Each choice must be a non-empty label of at most 80 characters.']);
            }
            $clean[] = trim($option);
        }
        if (count($clean) !== count(array_unique($clean))) {
            throw ValidationException::withMessages(['options' => 'Choice labels must be unique.']);
        }
        return $clean;
    }

    private function typedValue(object $field, mixed $value): mixed
    {
        $fail = fn () => throw ValidationException::withMessages([
            'value' => 'Value does not match this field’s defined type.',
        ]);
        $options = json_decode($field->options, true, 512, JSON_THROW_ON_ERROR);
        switch ($field->field_type) {
            case 'text':
                return is_string($value) && mb_strlen($value) <= 2000 ? $value : $fail();
            case 'select':
                return is_string($value) && in_array($value, $options, true) ? $value : $fail();
            case 'boolean':
                return is_bool($value) ? $value : $fail();
            case 'number':
                return (is_int($value) || is_float($value)) && is_finite((float) $value) &&
                    abs((float) $value) <= 1000000000000 ? $value : $fail();
            case 'date':
                if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return $fail();
                $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
                return $date && $date->format('Y-m-d') === $value ? $value : $fail();
            default:
                return $fail();
        }
    }

    public function fields(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate(['object_type' => ['required', Rule::in(array_keys(self::SUBJECTS))]]);
        $rows = DB::table('crm_custom_fields')->where('organization_id', $context->organizationId)
            ->where('object_type', $input['object_type'])
            ->orderBy('field_key')->limit(200)->get();
        return response()->json(['ok' => true, 'data' => $rows->map(fn ($r) => $this->fieldPayload($r))]);
    }

    public function create(Request $request, OrganizationContext $context): JsonResponse
    {
        $this->admin($request);
        $input = $request->validate([
            'object_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'field_key' => ['required', 'regex:/^[a-z][a-z0-9_]{1,49}$/'],
            'label' => ['required', 'string', 'max:120'],
            'field_type' => ['required', Rule::in(self::TYPES)],
            'options' => ['sometimes', 'array', 'max:20'],
            'organization_id' => ['prohibited'], 'id' => ['prohibited'], 'version' => ['prohibited'],
        ]);
        $label = trim($input['label']);
        if ($label === '') throw ValidationException::withMessages(['label' => 'Label cannot be empty.']);
        $options = $this->validatedOptions($input['field_type'], $input['options'] ?? []);
        return DB::transaction(function () use ($context, $request, $input, $label, $options) {
            DB::table('organizations')->where('id', $context->organizationId)->lockForUpdate()->firstOrFail();
            if (DB::table('crm_custom_fields')->where('organization_id', $context->organizationId)
                ->where('object_type', $input['object_type'])->where('field_key', $input['field_key'])->exists()) {
                return $this->conflict('The field key already exists for this CRM record type.');
            }
            if (DB::table('crm_custom_fields')->where('organization_id', $context->organizationId)
                ->where('object_type', $input['object_type'])->count() >= 100) {
                return $this->conflict('Only 100 custom fields are supported per CRM record type.');
            }
            $id = (string) Str::uuid();
            DB::table('crm_custom_fields')->insert([
                'id' => $id, 'organization_id' => $context->organizationId,
                'object_type' => $input['object_type'], 'field_key' => $input['field_key'],
                'label' => $label, 'field_type' => $input['field_type'],
                'options' => json_encode($options, JSON_THROW_ON_ERROR),
                'is_active' => true, 'version' => 1, 'created_at' => now(), 'updated_at' => now(),
            ]);
            AuditTrail::current($request, 'custom_field.created', 'custom_field', $id,
                ['object_type' => $input['object_type'], 'field_key' => $input['field_key']]);
            return response()->json(['ok' => true, 'data' => $this->fieldPayload($this->definition($context, $id))], 201);
        });
    }

    public function update(Request $request, OrganizationContext $context, string $id): JsonResponse
    {
        $this->admin($request);
        $input = $request->validate([
            'expected_version' => ['required', 'integer', 'min:1'],
            'label' => ['sometimes', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'field_key' => ['prohibited'], 'field_type' => ['prohibited'], 'object_type' => ['prohibited'],
            'organization_id' => ['prohibited'], 'id' => ['prohibited'], 'options' => ['prohibited'],
        ]);
        $changes = array_intersect_key($input, array_flip(['label', 'is_active']));
        if (!$changes) throw ValidationException::withMessages(['label' => 'Provide a label or activation change.']);
        if (isset($changes['label'])) {
            $changes['label'] = trim($changes['label']);
            if ($changes['label'] === '') throw ValidationException::withMessages(['label' => 'Label cannot be empty.']);
        }
        return DB::transaction(function () use ($context, $request, $id, $input, $changes) {
            $row = DB::table('crm_custom_fields')->where('organization_id', $context->organizationId)
                ->where('id', $id)->lockForUpdate()->first();
            if (!$row) abort(404);
            if ((int) $row->version !== (int) $input['expected_version']) return $this->conflict('Field changed. Refresh and try again.');
            DB::table('crm_custom_fields')->where('id', $id)->update($changes + [
                'version' => (int) $row->version + 1, 'updated_at' => now(),
            ]);
            AuditTrail::current($request, 'custom_field.updated', 'custom_field', $id,
                ['fields' => array_keys($changes)]);
            return response()->json(['ok' => true, 'data' => $this->fieldPayload($this->definition($context, $id))]);
        });
    }

    public function values(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate([
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'subject_id' => ['required', 'uuid'],
        ]);
        $column = $this->subject($input['subject_type'], $input['subject_id']);
        $definitions = DB::table('crm_custom_fields')->where('organization_id', $context->organizationId)
            ->where('object_type', $input['subject_type'])->orderBy('field_key')->limit(200)->get();
        $values = DB::table('crm_custom_values')->where('organization_id', $context->organizationId)
            ->where($column, $input['subject_id'])->get()->keyBy('field_id');
        return response()->json(['ok' => true, 'data' => $definitions->map(function ($field) use ($values) {
            $record = $values->get($field->id);
            return ['field' => $this->fieldPayload($field),
                'value' => $record ? json_decode($record->value, true, 512, JSON_THROW_ON_ERROR) : null,
                'version' => $record ? (int) $record->version : null];
        })]);
    }

    public function saveValue(Request $request, OrganizationContext $context): JsonResponse
    {
        $input = $request->validate([
            'field_id' => ['required', 'uuid'],
            'subject_type' => ['required', Rule::in(array_keys(self::SUBJECTS))],
            'subject_id' => ['required', 'uuid'],
            'value' => ['present'],
            'expected_version' => ['present', 'nullable', 'integer', 'min:1'],
            'organization_id' => ['prohibited'], 'id' => ['prohibited'], 'version' => ['prohibited'],
            'lead_id' => ['prohibited'], 'contact_id' => ['prohibited'],
            'account_id' => ['prohibited'], 'deal_id' => ['prohibited'],
        ]);
        $column = $this->subject($input['subject_type'], $input['subject_id']);
        return DB::transaction(function () use ($request, $context, $input, $column) {
            DB::table('organizations')->where('id', $context->organizationId)->lockForUpdate()->firstOrFail();
            $field = $this->definition($context, $input['field_id']);
            if (!$field->is_active || $field->object_type !== $input['subject_type']) {
                throw ValidationException::withMessages(['field_id' => 'Field unavailable for this record type.']);
            }
            $value = $this->typedValue($field, $input['value']);
            $row = DB::table('crm_custom_values')->where('organization_id', $context->organizationId)
                ->where('field_id', $field->id)->where($column, $input['subject_id'])
                ->lockForUpdate()->first();
            if (($row?->version ?? null) !== $input['expected_version']) {
                return $this->conflict('Custom value changed. Refresh before writing.');
            }
            $next = ($row?->version ?? 0) + 1;
            $serialized = json_encode($value, JSON_THROW_ON_ERROR);
            if ($row) {
                DB::table('crm_custom_values')->where('id', $row->id)->update([
                    'value' => $serialized, 'updated_by' => $request->user()->id,
                    'version' => $next, 'updated_at' => now(),
                ]);
            } else {
                DB::table('crm_custom_values')->insert([
                    'id' => (string) Str::uuid(), 'organization_id' => $context->organizationId,
                    'field_id' => $field->id, $column => $input['subject_id'],
                    'value' => $serialized, 'updated_by' => $request->user()->id,
                    'version' => 1, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            AuditTrail::current($request, 'custom_field.value_saved', 'custom_field', $field->id, [
                'subject_type' => $input['subject_type'], 'subject_id' => $input['subject_id'],
                'version' => $next,
            ]);
            return response()->json(['ok' => true, 'data' => [
                'field_id' => $field->id, 'value' => $value, 'version' => $next,
            ]], $row ? 200 : 201);
        });
    }
}
