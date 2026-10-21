<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CrmCustomFieldsTest extends TestCase
{
    use RefreshDatabase;

    private function org(string $name): Organization
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => strtolower($name).'-custom', 'status' => 'active']);
        return Organization::create(['tenant_id' => $tenant->id, 'name' => $name, 'slug' => strtolower($name).'-custom',
            'status' => 'active', 'currency' => 'USD', 'locale' => 'en', 'timezone' => 'UTC']);
    }

    private function member(Organization $org, string $role = 'owner'): User
    {
        $user = User::create(['name' => 'Field User', 'email' => Str::random(10).'@example.test',
            'password' => 'SecurePassword123!']);
        $user->forceFill(['email_verified_at' => now()])->save();
        OrganizationMembership::create([
            'organization_id' => $org->id, 'user_id' => $user->id, 'status' => 'active', 'role' => $role,
        ]);
        return $user;
    }

    private function lead(): string
    {
        return $this->postJson('/api/v1/leads', ['name' => 'Lead for custom fields'])
            ->assertCreated()->json('data.id');
    }

    private function define(string $type = 'text', string $key = 'customer_tier', array $extra = []): array
    {
        return $this->postJson('/api/v1/custom-fields', array_merge([
            'object_type' => 'lead', 'field_key' => $key, 'field_type' => $type, 'label' => 'Customer tier',
        ], $extra))->assertCreated()->json('data');
    }

    public function test_definition_permissions_and_tenant_isolation(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $secret = $this->define();
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $this->getJson('/api/v1/custom-fields?object_type=lead')->assertOk()->assertJsonCount(0, 'data');
        $this->patchJson('/api/v1/custom-fields/'.$secret['id'], [
            'expected_version' => 1, 'label' => 'Stolen',
        ])->assertNotFound();
        $local = $this->define();
        $this->postJson('/api/v1/custom-fields', [
            'object_type' => 'lead', 'field_key' => 'customer_tier',
            'field_type' => 'text', 'label' => 'Duplicate',
        ])->assertStatus(409);
        $this->define('date', 'customer_tier_date');
        $this->getJson('/api/v1/custom-fields?object_type=lead')->assertJsonCount(2, 'data');
        $this->actingAs($this->member($alpha, 'member'));
        $this->getJson('/api/v1/custom-fields?object_type=lead')->assertOk();
        $this->postJson('/api/v1/custom-fields', [
            'object_type' => 'lead', 'field_key' => 'member_field',
            'field_type' => 'text', 'label' => 'Not allowed',
        ])->assertForbidden();
        $this->actingAs($this->member($alpha, 'viewer'));
        $this->patchJson('/api/v1/custom-fields/'.$local['id'], [
            'expected_version' => 1, 'is_active' => false,
        ])->assertForbidden();
    }

    public function test_record_values_are_typed_versioned_and_tenant_scoped(): void
    {
        $alpha = $this->org('Alpha');
        $bravo = $this->org('Bravo');
        $this->actingAs($this->member($bravo))->withHeader('X-Organization-ID', $bravo->id);
        $foreignLead = $this->lead();
        $this->actingAs($this->member($alpha))->withHeader('X-Organization-ID', $alpha->id);
        $lead = $this->lead();
        $text = $this->define();
        $field = $text['id'];
        $payload = [
            'field_id' => $field, 'subject_type' => 'lead', 'subject_id' => $lead,
            'expected_version' => null, 'value' => 'Enterprise',
        ];
        $this->putJson('/api/v1/custom-fields/values', $payload)->assertCreated()
            ->assertJsonPath('data.version', 1);
        $this->putJson('/api/v1/custom-fields/values', $payload)
            ->assertStatus(409)->assertJsonPath('error.code', 'conflict');
        $this->putJson('/api/v1/custom-fields/values', array_merge($payload, [
            'expected_version' => 1, 'value' => 'Midmarket',
        ]))->assertOk()->assertJsonPath('data.version', 2);
        $this->getJson('/api/v1/custom-fields/values?subject_type=lead&subject_id='.$lead)
            ->assertOk()->assertJsonPath('data.0.value', 'Midmarket')
            ->assertJsonPath('data.0.version', 2);
        $this->putJson('/api/v1/custom-fields/values', array_merge($payload, [
            'subject_id' => $foreignLead,
        ]))->assertUnprocessable();
        $this->putJson('/api/v1/custom-fields/values', array_merge($payload, [
            'organization_id' => $bravo->id,
        ]))->assertUnprocessable();
        $this->assertDatabaseHas('audit_events', ['organization_id' => $alpha->id,
            'action' => 'custom_field.value_saved']);
        $this->deleteJson('/api/v1/leads/'.$lead)->assertStatus(409)
            ->assertJsonPath('error.code', 'conflict');
    }

    public function test_select_number_boolean_and_date_validation(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $lead = $this->lead();
        $select = $this->define('select', 'priority_level', ['options' => ['High', 'Low']]);
        $number = $this->define('number', 'expected_value');
        $bool = $this->define('boolean', 'requires_approval');
        $date = $this->define('date', 'renewal_date');
        foreach ([
            [$select['id'], 'High', 201],
            [$select['id'], 'Outside options', 422],
            [$number['id'], 123.5, 201],
            [$number['id'], '123.5', 422],
            [$bool['id'], false, 201],
            [$bool['id'], 'false', 422],
            [$date['id'], '2026-12-31', 201],
            [$date['id'], '2026-02-30', 422],
        ] as [$fieldId, $value, $status]) {
            $this->putJson('/api/v1/custom-fields/values', [
                'field_id' => $fieldId, 'subject_type' => 'lead',
                'subject_id' => $lead, 'value' => $value, 'expected_version' => null,
            ])->assertStatus($status);
        }
        $this->assertDatabaseCount('crm_custom_values', 4);
        $this->getJson('/api/v1/custom-fields/values?subject_type=lead&subject_id='.$lead)
            ->assertOk()->assertJsonCount(4, 'data');
    }

    public function test_definitions_cannot_change_type_and_deactivated_fields_keep_values(): void
    {
        $org = $this->org('Alpha');
        $this->actingAs($this->member($org))->withHeader('X-Organization-ID', $org->id);
        $lead = $this->lead();
        $field = $this->define();
        $this->putJson('/api/v1/custom-fields/values', [
            'field_id' => $field['id'], 'subject_type' => 'lead',
            'subject_id' => $lead, 'value' => 'Important', 'expected_version' => null,
        ])->assertCreated();
        $this->patchJson('/api/v1/custom-fields/'.$field['id'], [
            'expected_version' => 1, 'field_type' => 'number',
        ])->assertUnprocessable();
        $this->patchJson('/api/v1/custom-fields/'.$field['id'], [
            'expected_version' => 2, 'label' => 'Outdated',
        ])->assertStatus(409);
        $this->patchJson('/api/v1/custom-fields/'.$field['id'], [
            'expected_version' => 1, 'label' => 'Account priority', 'is_active' => false,
        ])->assertOk()->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.is_active', false);
        $this->getJson('/api/v1/custom-fields/values?subject_type=lead&subject_id='.$lead)
            ->assertOk()->assertJsonPath('data.0.value', 'Important');
        $this->putJson('/api/v1/custom-fields/values', [
            'field_id' => $field['id'], 'subject_type' => 'lead',
            'subject_id' => $lead, 'value' => 'Changed', 'expected_version' => 1,
        ])->assertUnprocessable();
    }

    public function test_field_value_must_match_record_type_and_reader_can_view_not_modify(): void
    {
        $org = $this->org('Alpha');
        $owner = $this->member($org);
        $viewer = $this->member($org, 'viewer');
        $this->actingAs($owner)->withHeader('X-Organization-ID', $org->id);
        $lead = $this->lead();
        $account = $this->postJson('/api/v1/accounts', ['name' => 'Account'])->assertCreated()->json('data.id');
        $field = $this->define();
        $this->putJson('/api/v1/custom-fields/values', [
            'field_id' => $field['id'], 'subject_type' => 'account',
            'subject_id' => $account, 'value' => 'Invalid', 'expected_version' => null,
        ])->assertUnprocessable();
        $this->actingAs($viewer);
        $this->getJson('/api/v1/custom-fields/values?subject_type=lead&subject_id='.$lead)->assertOk();
        $this->putJson('/api/v1/custom-fields/values', [
            'field_id' => $field['id'], 'subject_type' => 'lead',
            'subject_id' => $lead, 'value' => 'Unauthorized', 'expected_version' => null,
        ])->assertForbidden();
    }
}
