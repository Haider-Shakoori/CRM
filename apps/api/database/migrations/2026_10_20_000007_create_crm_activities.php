<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Composite uniqueness is needed for database-enforced tenant-safe links.
        Schema::table('leads', function (Blueprint $t) {
            $t->unique(['organization_id', 'id'], 'crm_leads_org_id_unique');
        });
        Schema::table('crm_contacts', function (Blueprint $t) {
            $t->unique(['organization_id', 'id'], 'crm_contacts_org_id_unique');
        });
        Schema::create('crm_activities', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('title', 200);
            $t->enum('kind', ['task', 'call', 'meeting'])->default('task');
            $t->enum('status', ['open', 'completed', 'cancelled'])->default('open');
            $t->text('notes')->nullable();
            $t->timestampTz('due_at')->nullable();
            $t->timestampTz('remind_at')->nullable();
            $t->timestampTz('completed_at')->nullable();
            $t->uuid('assigned_to');
            $t->uuid('lead_id')->nullable();
            $t->uuid('contact_id')->nullable();
            $t->uuid('account_id')->nullable();
            $t->uuid('deal_id')->nullable();
            $t->unsignedInteger('version')->default(1);
            $t->timestamps();
            $t->softDeletes();
            $t->foreign(['organization_id', 'assigned_to'])
                ->references(['organization_id', 'user_id'])->on('organization_memberships')
                ->restrictOnDelete();
            $t->foreign(['organization_id', 'lead_id'])
                ->references(['organization_id', 'id'])->on('leads')->restrictOnDelete();
            $t->foreign(['organization_id', 'contact_id'])
                ->references(['organization_id', 'id'])->on('crm_contacts')->restrictOnDelete();
            $t->foreign(['organization_id', 'account_id'])
                ->references(['organization_id', 'id'])->on('crm_accounts')->restrictOnDelete();
            $t->foreign(['organization_id', 'deal_id'])
                ->references(['organization_id', 'id'])->on('crm_deals')->restrictOnDelete();
            $t->unique(['organization_id', 'id']);
            $t->index(['organization_id', 'status', 'due_at']);
            $t->index(['organization_id', 'assigned_to', 'status', 'due_at'], 'crm_activity_assignee_queue_idx');
        });
        DB::statement('ALTER TABLE crm_activities ADD CONSTRAINT crm_activity_single_subject CHECK (num_nonnulls(lead_id, contact_id, account_id, deal_id) <= 1)');
        Schema::create('crm_activity_events', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id');
            $t->uuid('activity_id');
            $t->foreignUuid('actor_user_id')->constrained('users')->restrictOnDelete();
            $t->string('action', 60);
            $t->jsonb('metadata')->default('{}');
            $t->timestampTz('created_at');
            $t->foreign(['organization_id', 'activity_id'])
                ->references(['organization_id', 'id'])->on('crm_activities')->restrictOnDelete();
            $t->index(['organization_id', 'activity_id', 'created_at'], 'crm_activity_event_timeline_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_activity_events');
        Schema::dropIfExists('crm_activities');
        Schema::table('crm_contacts', fn (Blueprint $t) => $t->dropUnique('crm_contacts_org_id_unique'));
        Schema::table('leads', fn (Blueprint $t) => $t->dropUnique('crm_leads_org_id_unique'));
    }
};
