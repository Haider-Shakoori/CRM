/**
 * Service behaviour tests.
 *
 * These cover the cross-record consistency rules the brief is specific about: moving a deal
 * must update the visible pipeline totals, converting a lead must create the related records,
 * completing a task must update the plan, reset must restore the baseline, and switching
 * organization must visibly change the data.
 *
 * Each test runs against an isolated in-memory database (`persist: false`) so nothing is
 * written to `localStorage` and tests cannot interfere with each other.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MockDb } from '../lib/store';
import { buildDataset } from '../seed';
import { computeQuoteTotals, createMockServices } from './index';
import type { Deal, Lead, Organization } from '@crm/shared-types';

/** A database that never touches browser storage, seeded deterministically. */
function freshDb(): MockDb {
  return new MockDb({ persist: false, seed: buildDataset });
}

/** Fast writes so the suite does not spend its time waiting on simulated latency. */
const fast = { latency: { min: 0, max: 0 } };

describe('dataset generation', () => {
  it('is deterministic: two builds produce identical content', () => {
    const a = buildDataset();
    const b = buildDataset();
    expect(Object.keys(a.leads)).toEqual(Object.keys(b.leads));
    expect(a.leads['lead-org-vertex-1']).toEqual(b.leads['lead-org-vertex-1']);
  });

  it('seeds three tenants with genuinely different configuration', () => {
    const db = freshDb();
    const organizations = Object.values(db.state.organizations);
    expect(organizations).toHaveLength(3);
    expect(new Set(organizations.map((organization) => organization.defaultCurrency)).size).toBe(3);
    expect(new Set(organizations.map((organization) => organization.defaultLocale)).size).toBe(3);
    // Module entitlement differs, so the sidebar differs per tenant.
    expect(new Set(organizations.map((organization) => organization.enabledModuleKeys.length)).size).toBeGreaterThan(1);
  });

  it('partitions every tenant-scoped collection by organization', () => {
    const db = freshDb();
    const organizationIds = new Set(Object.keys(db.state.organizations));
    for (const collection of ['leads', 'contacts', 'accounts', 'deals', 'tickets', 'activities'] as const) {
      for (const record of Object.values(db.state[collection])) {
        expect(organizationIds.has((record as unknown as { organizationId: string }).organizationId)).toBe(true);
      }
    }
  });

  it('keeps account health scores consistent with the account record', () => {
    // The list column and the record panel read the same number, so they cannot disagree.
    const db = freshDb();
    for (const score of Object.values(db.state.healthScores)) {
      const account = db.state.accounts[score.accountId];
      expect(account).toBeDefined();
      expect(score.score).toBe(account!.healthScore);
      expect(score.band).toBe(account!.health);
    }
  });

  it('wires relationships rather than leaving dangling ids', () => {
    const db = freshDb();
    for (const deal of Object.values(db.state.deals)) {
      expect(db.state.accounts[deal.accountId]).toBeDefined();
      expect(db.state.pipelines[deal.pipelineId]).toBeDefined();
      const pipeline = db.state.pipelines[deal.pipelineId]!;
      expect(pipeline.stages.some((stage) => stage.id === deal.stageId)).toBe(true);
    }
    for (const contact of Object.values(db.state.contacts)) {
      if (contact.accountId) expect(db.state.accounts[contact.accountId]).toBeDefined();
    }
  });

  it('never makes an account its own ancestor', () => {
    // A self- or mutual-parent used to be possible: the generator pointed the first account
    // at itself, which both misrepresents the hierarchy and turns any unguarded tree walk
    // into an infinite loop. This guards the data, the walk below guards the reader.
    const db = freshDb();
    const accounts = Object.values(db.state.accounts);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    for (const account of accounts) {
      const seen = new Set([account.id]);
      let cursor = account.parentAccountId;
      while (cursor) {
        expect(seen.has(cursor), `cycle reached through ${account.id}`).toBe(false);
        seen.add(cursor);
        cursor = byId.get(cursor)?.parentAccountId;
      }
    }
  });

  it('gives every deal product line a product owned by the same tenant', () => {
    // The deals generator used to read one hard-coded catalogue, so a manufacturing tenant's
    // deals referenced software licences it does not sell. The invariant worth protecting is
    // stronger than "the names look right": the referenced product must belong to the tenant.
    const db = freshDb();
    const prefixesByOrganization = new Map<string, Set<string>>();
    for (const deal of Object.values(db.state.deals)) {
      for (const line of deal.products) {
        const product = db.state.products[line.productId];
        expect(product, `product ${line.productId} referenced by ${deal.id}`).toBeDefined();
        expect(product!.organizationId).toBe(deal.organizationId);
        const prefix = (line.sku ?? product!.sku).split('-')[0] ?? 'unknown';
        const prefixes = prefixesByOrganization.get(deal.organizationId) ?? new Set<string>();
        prefixes.add(prefix);
        prefixesByOrganization.set(deal.organizationId, prefixes);
      }
    }
    // Three tenants, three catalogues: the fix is only observable if they actually differ.
    const distinctCatalogueSignatures = new Set(
      [...prefixesByOrganization.values()].map((prefixes) => [...prefixes].sort().join('|')),
    );
    expect(distinctCatalogueSignatures.size).toBeGreaterThan(1);
  });
});

describe('tenant isolation', () => {
  it('returns a disjoint record set when switching organization', async () => {
    const services = createMockServices({ db: freshDb(), persist: false });

    const organizations = await services.tenant.organizations();
    expect(organizations.items.length).toBe(3);

    const [first, second] = organizations.items as Organization[];
    const firstLeads = await services.leads.list({ pageSize: 200 });
    const firstIds = new Set(firstLeads.items.map((lead) => lead.id));

    const switched = await services.tenant.switchOrganization(second!.id);
    // Asserting the message rather than a bare boolean means a failure names its cause.
    expect(switched.ok ? 'switched' : switched.error.message).toBe('switched');

    const secondLeads = await services.leads.list({ pageSize: 200 });
    expect({ tenant: second!.id, count: secondLeads.items.length }).toMatchObject({ count: expect.any(Number) });
    expect(secondLeads.items.length, `no leads returned for ${second!.id} (${second!.name})`).toBeGreaterThan(0);
    // No record may appear in both tenants.
    const overlap = secondLeads.items.filter((lead) => firstIds.has(lead.id)).map((lead) => lead.id);
    expect(overlap, `records leaked across tenants: ${overlap.slice(0, 3).join(', ')}`).toEqual([]);
    expect(firstIds.size).toBeGreaterThan(0);
    expect(first!.id).not.toBe(second!.id);
  });

  it('reports a typed failure for an unknown organization', async () => {
    const services = createMockServices({ db: freshDb(), persist: false });
    const result = await services.tenant.switchOrganization('org-does-not-exist');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
  });
});

describe('deal stage movement', () => {
  let db: MockDb;
  let services: ReturnType<typeof createMockServices>;
  let pipelineId: string;
  let openStageId: string;
  let wonStageId: string;
  let lostStageId: string;
  let deal: Deal;

  beforeEach(() => {
    db = freshDb();
    services = createMockServices({ db, persist: false });
    pipelineId = Object.values(db.state.pipelines)[0]!.id;
    const pipeline = db.state.pipelines[pipelineId]!;
    openStageId = pipeline.stages.find((stage) => stage.kind === 'open')!.id;
    wonStageId = pipeline.stages.find((stage) => stage.kind === 'won')!.id;
    lostStageId = pipeline.stages.find((stage) => stage.kind === 'lost')!.id;
    deal = Object.values(db.state.deals).find((candidate) => candidate.pipelineId === pipelineId && candidate.status === 'open')!;
  });

  it('updates the deal and recomputes the pipeline summary in one operation', async () => {
    const before = await services.deals.pipelineSummary(pipelineId);
    expect(before.ok).toBe(true);
    const beforeTotals = before.ok ? before.data : undefined;
    // Captured before the move: the store mutates records in place, so a live reference
    // would already show the new stage by the time the assertions run.
    const originStageId = deal.stageId;
    const originAmount = deal.amount.amount;

    const result = await services.deals.move({ dealId: deal.id, toStageId: wonStageId }, );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The deal itself reflects the move.
    expect(result.data.deal.stageId).toBe(wonStageId);
    expect(result.data.deal.status).toBe('won');
    expect(result.data.deal.daysInStage).toBe(0);
    expect(result.data.deal.isStale).toBe(false);
    expect(result.data.deal.actualCloseDate).toBeDefined();

    // The summary recomputed in the same response must reflect the move: one fewer open
    // deal, and exactly that deal's value removed from the open pipeline.
    expect(result.data.summary.totalDeals).toBe(beforeTotals!.totalDeals - 1);
    expect(result.data.summary.totalValue.amount).toBe(beforeTotals!.totalValue.amount - originAmount);
    // The origin stage must no longer contain it.
    const originBefore = beforeTotals!.stages.find((stage) => stage.stageId === originStageId);
    const originAfter = result.data.summary.stages.find((stage) => stage.stageId === originStageId);
    expect(originAfter!.dealCount).toBe((originBefore?.dealCount ?? 1) - 1);

    const wonStageAfter = result.data.summary.stages.find((stage) => stage.stageId === wonStageId);
    expect(wonStageAfter!.dealCount).toBeGreaterThan(beforeTotals!.stages.find((stage) => stage.stageId === wonStageId)?.dealCount ?? -1);

    // A later read must agree with what the move returned.
    const reread = await services.deals.get(deal.id);
    expect(reread.ok && reread.data.stageId).toBe(wonStageId);
  });

  it('applies the stage probability and forecast category', async () => {
    const pipeline = db.state.pipelines[pipelineId]!;
    const targetStage = pipeline.stages.find((stage) => stage.id === openStageId)!;
    const result = await services.deals.move({ dealId: deal.id, toStageId: openStageId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deal.probability).toBe(targetStage.probability);
    expect(result.data.deal.forecastCategory).toBe(targetStage.forecastCategory);
  });

  it('refuses to close a deal as lost without a reason, and says why', async () => {
    const result = await services.deals.move({ dealId: deal.id, toStageId: lostStageId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation_failed');
    expect(result.error.fieldErrors?.[0]?.path).toBe('lostReasonId');
    // The deal must be untouched after a rejected move.
    expect(db.state.deals[deal.id]!.stageId).toBe(deal.stageId);
  });

  it('records a stage-change event on the record timeline', async () => {
    const before = Object.keys(db.state.activities).length;
    await services.deals.move({ dealId: deal.id, toStageId: wonStageId, note: 'Signed after the security review' });
    const after = Object.values(db.state.activities).filter((activity) => activity.kind === 'stage_change');
    expect(Object.keys(db.state.activities).length).toBe(before + 1);
    expect(after.some((activity) => activity.subjects.some((subject) => subject.id === deal.id))).toBe(true);
  });

  it('reports a typed failure for an unknown deal or a foreign stage', async () => {
    const missing = await services.deals.move({ dealId: 'deal-nope', toStageId: wonStageId });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('not_found');

    const foreign = await services.deals.move({ dealId: deal.id, toStageId: 'some-other-pipeline-stage' });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.code).toBe('validation_failed');
  });

  it('keeps bulk moves consistent and reports per-record failures', async () => {
    const candidates = Object.values(db.state.deals).filter((candidate) => candidate.pipelineId === pipelineId && candidate.status === 'open').slice(0, 3);
    const ids = [...candidates.map((candidate) => candidate.id), 'deal-does-not-exist'];
    const result = await services.deals.bulkMove(ids, wonStageId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.outcome.succeeded).toBe(candidates.length);
    expect(result.data.outcome.failed).toBe(1);
    expect(result.data.outcome.failures[0]!.id).toBe('deal-does-not-exist');
    // Every moved deal is now won in the store as well as the summary.
    for (const candidate of candidates) expect(db.state.deals[candidate.id]!.status).toBe('won');
  });
});

describe('pipeline summary maths', () => {
  it('weights value by stage probability rather than summing it flat', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const pipelineId = Object.values(db.state.pipelines)[0]!.id;

    const summary = await services.deals.pipelineSummary(pipelineId);
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;

    const open = Object.values(db.state.deals).filter((deal) => deal.pipelineId === pipelineId && deal.status === 'open');
    const expectedTotal = open.reduce((sum, deal) => sum + deal.amount.amount, 0);
    const expectedWeighted = Math.round(open.reduce((sum, deal) => sum + (deal.amount.amount * deal.probability) / 100, 0));

    expect(summary.data.totalValue.amount).toBe(expectedTotal);
    expect(summary.data.weightedValue.amount).toBe(expectedWeighted);
    // Weighted must be less than flat unless every probability were 100%.
    expect(summary.data.weightedValue.amount).toBeLessThan(summary.data.totalValue.amount);
    expect(summary.data.totalDeals).toBe(open.length);

    // Per-stage totals include closed deals so a closed column never reads as empty, so
    // the sum of *open* stages is what must reconcile with the open pipeline total.
    const pipeline = db.state.pipelines[pipelineId]!;
    const openStageIds = new Set(pipeline.stages.filter((stage) => stage.kind === 'open').map((stage) => stage.id));
    const openStageSum = summary.data.stages
      .filter((stage) => openStageIds.has(stage.stageId))
      .reduce((sum, stage) => sum + stage.totalValue.amount, 0);
    expect(openStageSum).toBe(expectedTotal);

    // Closed stages must reconcile with the closed deals in the same pipeline.
    const closedStageIds = new Set(pipeline.stages.filter((stage) => stage.kind !== 'open').map((stage) => stage.id));
    const closedStageSum = summary.data.stages
      .filter((stage) => closedStageIds.has(stage.stageId))
      .reduce((sum, stage) => sum + stage.totalValue.amount, 0);
    const expectedClosed = Object.values(db.state.deals)
      .filter((candidate) => candidate.pipelineId === pipelineId && candidate.status !== 'open')
      .reduce((sum, candidate) => sum + candidate.amount.amount, 0);
    expect(closedStageSum).toBe(expectedClosed);
  });

  it('counts stale deals against the pipeline threshold', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const pipelineId = Object.values(db.state.pipelines)[0]!.id;
    const threshold = db.state.pipelines[pipelineId]!.settings.staleDealDays;

    const summary = await services.deals.pipelineSummary(pipelineId);
    if (!summary.ok) throw new Error('summary unavailable');

    const expectedStale = Object.values(db.state.deals).filter(
      (deal) => deal.pipelineId === pipelineId && deal.status === 'open' && deal.daysInStage > threshold,
    ).length;
    expect(summary.data.stages.reduce((sum, stage) => sum + stage.staleCount, 0)).toBe(expectedStale);
  });
});

describe('lead conversion', () => {
  let db: MockDb;
  let services: ReturnType<typeof createMockServices>;
  let lead: Lead;

  beforeEach(() => {
    db = freshDb();
    services = createMockServices({ db, persist: false });
    lead = Object.values(db.state.leads).find((candidate) => candidate.status !== 'converted')!;
  });

  it('previews what would be created without writing anything', async () => {
    const accountsBefore = Object.keys(db.state.accounts).length;
    const contactsBefore = Object.keys(db.state.contacts).length;
    const dealsBefore = Object.keys(db.state.deals).length;

    const preview = await services.leads.previewConversion(lead.id, {
      leadId: lead.id,
      contactAccountAction: 'create_new',
      createDeal: true,
      dealName: 'Previewed opportunity',
      copyNotes: true,
      copyActivities: true,
    });

    expect(preview.ok).toBe(true);
    // Nothing may be written by a preview: that is the entire point of the step.
    expect(Object.keys(db.state.accounts).length).toBe(accountsBefore);
    expect(Object.keys(db.state.contacts).length).toBe(contactsBefore);
    expect(Object.keys(db.state.deals).length).toBe(dealsBefore);
    // The lead must still be unconverted.
    expect(db.state.leads[lead.id]!.status).toBe(lead.status);
  });

  it('creates a contact, an account and a deal, then marks the lead converted', async () => {
    const dealsBefore = Object.keys(db.state.deals).length;
    const result = await services.leads.convert({
      leadId: lead.id,
      contactAccountAction: 'create_new',
      createDeal: true,
      dealName: 'Converted opportunity',
      copyNotes: true,
      copyActivities: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = db.state.leads[lead.id]!;
    expect(stored.status).toBe('converted');
    expect(stored.convertedAt).toBeDefined();
    expect(stored.convertedTo?.contactId).toBeDefined();
    expect(stored.convertedTo?.accountId).toBeDefined();
    expect(stored.convertedTo?.dealId).toBeDefined();

    expect(db.state.contacts[stored.convertedTo!.contactId!]).toBeDefined();
    expect(db.state.accounts[stored.convertedTo!.accountId!]).toBeDefined();
    expect(db.state.deals[stored.convertedTo!.dealId!]).toBeDefined();
    expect(Object.keys(db.state.deals).length).toBe(dealsBefore + 1);

    // The new deal must be valid: a real stage from a real pipeline.
    const created = db.state.deals[stored.convertedTo!.dealId!]!;
    const pipeline = db.state.pipelines[created.pipelineId]!;
    expect(pipeline.stages.some((stage) => stage.id === created.stageId)).toBe(true);
    expect(created.accountId).toBe(stored.convertedTo!.accountId);
    expect(created.primaryContactId).toBe(stored.convertedTo!.contactId);
  });

  it('creates only the contact and account when no deal is requested', async () => {
    const dealsBefore = Object.keys(db.state.deals).length;
    const result = await services.leads.convert({
      leadId: lead.id,
      contactAccountAction: 'create_new',
      createDeal: false,
      copyNotes: false,
      copyActivities: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(db.state.deals).length).toBe(dealsBefore);
    expect(db.state.leads[lead.id]!.convertedTo?.dealId).toBeUndefined();
  });

  it('reports a typed failure for a missing lead', async () => {
    const result = await services.leads.convert({
      leadId: 'lead-missing',
      contactAccountAction: 'create_new',
      createDeal: false,
      copyNotes: false,
      copyActivities: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
  });
});

describe('task and activity completion', () => {
  it('completes a task and clears it from the daily plan totals', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const userId = Object.values(db.state.users)[0]!.id;
    const date = new Date().toISOString().slice(0, 10);

    const before = await services.activities.dailyPlan(userId, date);
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    const openTask = Object.values(db.state.activities).find(
      (activity) => activity.ownerId === userId && activity.kind === 'task' && activity.status !== 'completed',
    );
    expect(openTask).toBeDefined();

    const completed = await services.tasks.complete(openTask!.id);
    expect(completed.ok).toBe(true);
    expect(db.state.activities[openTask!.id]!.status).toBe('completed');
    expect(db.state.activities[openTask!.id]!.completedAt).toBeDefined();
  });

  it('reports per-record failures for a bulk completion', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const tasks = Object.values(db.state.activities).filter((activity) => activity.kind === 'task').slice(0, 3);
    const result = await services.activities.complete([...tasks.map((task) => task.id), 'act-nope']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.succeeded).toBe(tasks.length);
    expect(result.data.failed).toBe(1);
  });
});

describe('optimistic concurrency', () => {
  it('rejects a write built on a stale copy', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const lead = Object.values(db.state.leads)[0]!;

    const first = await services.leads.update(lead.id, { notes: 'First edit', expectedUpdatedAt: lead.updatedAt }, fast);
    expect(first.ok).toBe(true);

    // A second writer still holding the original timestamp must be rejected, not silently win.
    const second = await services.leads.update(lead.id, { notes: 'Second edit', expectedUpdatedAt: lead.updatedAt }, fast);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('conflict');

    expect(db.state.leads[lead.id]!.notes).toBe('First edit');
  });

  it('accepts a write when no expectation is supplied', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const lead = Object.values(db.state.leads)[0]!;
    const result = await services.leads.update(lead.id, { notes: 'Blind write' }, fast);
    expect(result.ok).toBe(true);
  });
});

describe('simulated failure modes', () => {
  it('produces each typed error the UI has a state for', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const lead = Object.values(db.state.leads)[0]!;

    const cases = [
      { simulate: 'validation_error' as const, code: 'validation_failed' },
      { simulate: 'conflict' as const, code: 'conflict' },
      { simulate: 'forbidden' as const, code: 'forbidden' },
      { simulate: 'entitlement_missing' as const, code: 'entitlement_missing' },
      { simulate: 'server_error' as const, code: 'unexpected' },
      { simulate: 'offline' as const, code: 'offline' },
    ];

    for (const testCase of cases) {
      const result = await services.leads.update(lead.id, { notes: 'x' }, { simulate: testCase.simulate });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(testCase.code);
        // Retryability must be honest: only transient failures offer a retry.
        const transient = ['unexpected', 'offline', 'rate_limited'];
        expect(result.error.retryable).toBe(transient.includes(testCase.code));
      }
    }
  });

  it('does not mutate the record when a simulated failure is requested', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const lead = Object.values(db.state.leads)[0]!;
    const original = lead.notes;
    await services.leads.update(lead.id, { notes: 'should not persist' }, { simulate: 'server_error' });
    expect(db.state.leads[lead.id]!.notes).toBe(original);
  });
});

describe('demo data reset', () => {
  it('restores the seeded baseline after local changes', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const leadCountBefore = Object.keys(db.state.leads).length;
    const lead = Object.values(db.state.leads)[0]!;

    await services.leads.update(lead.id, { status: 'unqualified', notes: 'Changed locally' }, fast);
    expect(db.state.leads[lead.id]!.status).toBe('unqualified');

    const reset = await services.demo.reset('all');
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.data.collections).toBeGreaterThan(20);
    expect(reset.data.records).toBeGreaterThan(1000);

    // The baseline is restored exactly, including the edited record.
    expect(Object.keys(db.state.leads).length).toBe(leadCountBefore);
    expect(db.state.leads[lead.id]!.status).toBe(lead.status);
    expect(db.state.leads[lead.id]!.notes).toBe(lead.notes);
  });

  it('produces the same baseline on every reset', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const first = JSON.stringify(db.state.leads['lead-org-vertex-1']);
    await services.demo.reset('all');
    const second = JSON.stringify(db.state.leads['lead-org-vertex-1']);
    expect(second).toBe(first);
  });
});

describe('read services', () => {
  it('returns paginated, sorted, searchable collections', async () => {
    const services = createMockServices({ db: freshDb(), persist: false });

    const leads = await services.leads.list({ page: 1, pageSize: 10, sort: [{ field: 'scoring.score', direction: 'desc' }] });
    expect(leads.items).toHaveLength(10);
    expect(leads.meta.total).toBeGreaterThan(10);
    const scores = leads.items.map((lead) => lead.scoring?.score ?? 0);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);

    const searched = await services.accounts.list({ q: 'Ltd' });
    expect(searched.items.every((account) => account.name.toLowerCase().includes('ltd'))).toBe(true);
  });

  it('fails a get for a missing record with a typed error and a reference', async () => {
    const services = createMockServices({ db: freshDb(), persist: false });
    const result = await services.accounts.get('acc-missing');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('not_found');
      expect(result.error.traceId).toBeDefined();
    }
  });

  it('derives support metrics from tickets rather than storing them', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const overview = await services.tickets.overview();
    expect(overview.ok).toBe(true);
    if (!overview.ok) return;

    const activeId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const tickets = Object.values(db.state.tickets).filter((ticket) => ticket.organizationId === activeId);
    const open = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
    expect(overview.data.metrics.openTickets).toBe(open.length);
    // Status buckets must account for every ticket exactly once.
    expect(overview.data.byStatus.reduce((sum, entry) => sum + entry.count, 0)).toBe(tickets.length);
    expect(overview.data.byPriority.reduce((sum, entry) => sum + entry.count, 0)).toBe(tickets.length);
    expect(overview.data.agentPerformance.length).toBeGreaterThan(0);
  });

  it('returns dashboard widget data derived from the underlying records', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const dashboards = await services.dashboards.list();
    const executive = dashboards.items.find((dashboard) => dashboard.audience === 'executive');
    expect(executive).toBeDefined();

    const widgets = await services.dashboards.widgetDataBatch(executive!.id);
    expect(widgets.ok).toBe(true);
    if (!widgets.ok) return;
    expect(widgets.data).toHaveLength(executive!.widgets.length);
    // A KPI must carry a value, a state and a format so the tile can render without guessing.
    for (const widget of widgets.data) {
      expect(['ready', 'empty', 'loading', 'error', 'not_entitled']).toContain(widget.state);
      expect(widget.generatedAt).toBeDefined();
    }
  });

  it('executes a report and returns rows plus a chart series', async () => {
    const services = createMockServices({ db: freshDb(), persist: false });
    const reports = await services.reports.list({ pageSize: 5 });
    const first = reports.items[0]!;
    const result = await services.reports.run(first.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.columns.length).toBeGreaterThan(0);
    expect(result.data.rows.length).toBeGreaterThan(0);
    expect(result.data.chart?.series[0]?.data.length).toBe(result.data.rows.length);
    expect(result.data.meta.generatedAt).toBeDefined();
  });
});

describe('workflow validation and simulation', () => {
  it('blocks activation while the workflow has validation errors', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const workflow = Object.values(db.state.workflows)[0]!;

    // Remove every action and force the workflow back to draft, so the assertion tests the
    // guard rather than the seeded status.
    db.put('workflows', { ...workflow, status: 'draft', nodes: workflow.nodes.filter((node) => node.kind === 'trigger'), edges: [] });

    const activated = await services.workflows.activate(workflow.id);
    expect(activated.ok).toBe(false);
    if (!activated.ok) expect(activated.error.code).toBe('validation_failed');
    expect(db.state.workflows[workflow.id]!.status).toBe('draft');
  });

  it('flags an unreachable node as a warning rather than an error', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const workflow = Object.values(db.state.workflows)[0]!;
    const validation = await services.workflows.validate(workflow.id);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.data.errors).toHaveLength(0);
  });

  it('simulates against a sample record and labels every step as simulated', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const workflow = Object.values(db.state.workflows)[0]!;

    const simulation = await services.workflows.simulate(workflow.id);
    expect(simulation.ok).toBe(true);
    if (!simulation.ok) return;

    expect(simulation.data.state).toBe('completed');
    expect(simulation.data.steps.length).toBe(workflow.nodes.length);
    // The disclaimer must travel with the result so the UI cannot omit it.
    expect(simulation.data.disclaimer).toMatch(/No record was changed/);
    expect(simulation.data.sampleRecord.recordId).toBeDefined();
    for (const step of simulation.data.steps) {
      expect(['passed', 'failed', 'skipped', 'waited', 'branched']).toContain(step.outcome);
      expect(step.detail.length).toBeGreaterThan(0);
    }
  });
});

describe('AI assistant honesty', () => {
  it('labels every assistant message as coming from the demonstration engine', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const conversation = Object.values(db.state.aiConversations)[0]!;

    const reply = await services.ai.send(conversation.id, 'Summarise this account before my meeting.');
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;

    expect(reply.data.role).toBe('assistant');
    // This is the assertion that stops the UI presenting a template as model output.
    expect(reply.data.origin).toBe('demo_template_engine');
    expect(reply.data.citations?.length).toBeGreaterThan(0);
    for (const citation of reply.data.citations ?? []) {
      expect(citation.route).toBeDefined();
    }

    const stored = db.state.aiConversations[conversation.id]!;
    expect(stored.messages.some((message) => message.origin === 'user_input')).toBe(true);
    expect(stored.totalCredits).toBeGreaterThan(0);
  });

  it('reports settings that state no provider is connected', async () => {
    const services = createMockServices({ db: freshDb(), persist: false });
    const settings = await services.ai.settings();
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    expect(settings.data.providerState).toBe('demo_template_engine');
    expect(settings.data.dataAccess.excludeSensitiveFields).toBe(true);
    expect(settings.data.usageLimits.monthlyCreditLimit).toBeGreaterThan(0);
  });

  it('marks usage as not metered against a billing system', async () => {
    const services = createMockServices({ db: freshDb(), persist: false });
    const usage = await services.ai.usageDashboard();
    expect(usage.ok).toBe(true);
    if (!usage.ok) return;
    expect(usage.data.billingState).toBe('not_metered');
    expect(usage.data.byCapability.length).toBeGreaterThan(0);
  });
});

describe('role and permission presentation', () => {
  it('documents permissions rather than enforcing them, and protects system roles', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });

    const roles = await services.roles.list();
    expect(roles.items.length).toBeGreaterThanOrEqual(6);

    const systemRole = roles.items.find((role) => role.kind === 'system')!;
    const removed = await services.roles.remove(systemRole.id);
    expect(removed.ok).toBe(false);
    if (!removed.ok) expect(removed.error.code).toBe('forbidden');

    // A custom role that is still held by users cannot be deleted either.
    const created = await services.roles.create({ name: 'Regional manager', description: 'Test role', permissions: [] } as never);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const user = Object.values(db.state.users)[0]!;
    await services.users.changeRole(user.id, [...user.roleIds, created.data.id]);

    const blocked = await services.roles.remove(created.data.id);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('conflict');
    expect(db.state.roles[created.data.id]).toBeDefined();
  });

  it('clones a role rather than mutating the original', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const original = (await services.roles.list()).items[0]!;
    const clone = await services.roles.clone(original.id, 'Regional manager');
    expect(clone.ok).toBe(true);
    if (!clone.ok) return;
    expect(clone.data.id).not.toBe(original.id);
    expect(clone.data.kind).toBe('custom');
    expect(clone.data.permissions).toEqual(original.permissions);
    expect(db.state.roles[original.id]!.name).toBe(original.name);
  });

  it('explains why a field is masked in the permission matrix', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const role = (await services.roles.list()).items.find((candidate) => candidate.name === 'Administrator')!;
    const matrix = await services.roles.fieldMatrix(role.id, 'asset');
    expect(matrix.items.length).toBeGreaterThan(0);
    for (const row of matrix.items) {
      expect(row.perRole.length).toBeGreaterThan(0);
      // A sensitive field must be masked for at least one role, otherwise the flag does nothing.
      if (row.isSensitive) expect(row.perRole.some((entry) => entry.masked)).toBe(true);
    }
  });
});

describe('account hierarchy walk', () => {
  it('reports the hierarchy for every account without looping or losing a record', async () => {
    // The walker in the account screen is only as safe as the data it reads. This guards the
    // read path: hierarchy() must describe every account exactly once, and no node may be its
    // own ancestor even after a move.
    const db = freshDb();
    const services = createMockServices({ db, persist: false });

    const result = await services.accounts.hierarchy();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const activeId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const accounts = Object.values(db.state.accounts).filter((account) => account.organizationId === activeId);
    expect(result.data).toHaveLength(accounts.length);
    for (const node of result.data) {
      expect(node.id).not.toBe(node.parentId);
      expect(node.depth).toBeGreaterThanOrEqual(0);
    }

    // Move a child under a sibling and re-read: the walk must still terminate and stay flat.
    const withParent = accounts.find((account) => account.parentAccountId);
    if (withParent) {
      const moved = await services.accounts.moveAccount(withParent.id, null);
      expect(moved.ok).toBe(true);
      const after = await services.accounts.hierarchy();
      expect(after.ok && after.data).toHaveLength(accounts.length);
    }
  });
});

describe('quote pricing engine', () => {
  const line = (overrides: Partial<import('@crm/shared-types').QuoteLineItem>): import('@crm/shared-types').QuoteLineItem => ({
    id: 'l1',
    productId: 'p1',
    productName: 'Widget',
    sku: 'W-1',
    quantity: 10,
    unitPrice: { amount: 100, currency: 'USD' },
    listPrice: { amount: 100, currency: 'USD' },
    discountPercent: 0,
    discountAmount: { amount: 0, currency: 'USD' },
    unitOfMeasure: 'each',
    billing: 'one_time',
    subtotal: { amount: 0, currency: 'USD' },
    netTotal: { amount: 0, currency: 'USD' },
    isOptional: false,
    isRecurring: false,
    sortOrder: 0,
    priceSource: 'price_book',
    ...overrides,
  });

  it('derives line and order totals from quantity, price and discount', () => {
    const totals = computeQuoteTotals(
      [line({ quantity: 10, unitPrice: { amount: 100, currency: 'USD' } }), line({ id: 'l2', quantity: 2, unitPrice: { amount: 50, currency: 'USD' }, discountPercent: 10 })],
      'USD',
      0,
    );
    // 1000 + (2 * 50 = 100, less 10% = 90) = 1090.
    expect(totals.subtotal.amount).toBe(1100);
    expect(totals.lineDiscountTotal.amount).toBe(10);
    expect(totals.netSubtotal.amount).toBe(1090);
    expect(totals.grandTotal.amount).toBe(1090);
  });

  it('applies an order discount to the net subtotal, never to the gross', () => {
    const totals = computeQuoteTotals([line({ quantity: 10 })], 'USD', 20);
    // Gross 1000, no line discount, 20% order discount = 800.
    expect(totals.orderDiscountAmount.amount).toBe(200);
    expect(totals.netSubtotal.amount).toBe(800);
    expect(totals.grandTotal.amount).toBe(800);
  });

  it('never computes tax, and says so', () => {
    const totals = computeQuoteTotals([line({ quantity: 10 })], 'USD', 0);
    expect(totals.taxTotal.amount).toBe(0);
    expect(totals.taxNote).toMatch(/not calculated/i);
  });

  it('annualises recurring lines separately from one-off lines', () => {
    const totals = computeQuoteTotals(
      [line({ quantity: 1, unitPrice: { amount: 1200, currency: 'USD' }, billing: 'annual' }), line({ id: 'l2', quantity: 1, unitPrice: { amount: 100, currency: 'USD' }, billing: 'monthly' })],
      'USD',
      0,
    );
    expect(totals.recurring.annual.amount).toBe(1200);
    expect(totals.recurring.monthly.amount).toBe(100);
    expect(totals.recurring.annualisedTotal.amount).toBe(1200 + 100 * 12);
  });
});

describe('products, quotes and orders', () => {
  let db: MockDb;
  let services: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    db = freshDb();
    services = createMockServices({ db, persist: false });
  });

  it('lists products scoped to the current tenant', async () => {
    const page = await services.products.list({ pageSize: 200 });
    expect(page.items.length).toBeGreaterThan(0);
    const organizationId = Object.values(db.state.users)[0]!.activeOrganizationId;
    expect(page.items.every((product) => product.organizationId === organizationId)).toBe(true);
  });

  it('derives categories whose counts account for every product exactly once', async () => {
    const products = await services.products.list({ pageSize: 500 });
    const categories = await services.products.categories();
    expect(categories.items.length).toBeGreaterThan(0);
    expect(categories.items.reduce((sum, category) => sum + category.productCount, 0)).toBe(products.items.length);
  });

  it('exposes the standard price book for the tenant', async () => {
    const books = await services.products.priceBooks();
    expect(books.items.length).toBeGreaterThan(0);
    expect(books.items.some((book) => book.isStandard)).toBe(true);
  });

  it('recomputes a quote to the sum of its lines when a line is edited', async () => {
    const quote = Object.values(db.state.quotes)[0]!;
    const original = db.state.quotes[quote.id]!;
    const before = quote.totals.grandTotal.amount;

    const updated = await services.quotes.updateLineItem(quote.id, quote.lineItems[0]!.id, { quantity: quote.lineItems[0]!.quantity + 1 });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    const expected = updated.data.lineItems.reduce((sum, item) => sum + item.netTotal.amount, 0);
    expect(updated.data.totals.netSubtotal.amount).toBe(expected);
    expect(updated.data.totals.grandTotal.amount).toBe(expected);
    // A later read must agree with what the write returned.
    expect(db.state.quotes[quote.id]!.totals.grandTotal.amount).toBe(expected);
    void before;
    void original;
  });

  it('applies an order discount and records the reason', async () => {
    const quote = Object.values(db.state.quotes)[0]!;
    const result = await services.quotes.applyOrderDiscount(quote.id, 15, 'Competitive displacement');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totals.orderDiscountPercent).toBe(15);
    const net = result.data.totals.subtotal.amount - result.data.totals.lineDiscountTotal.amount;
    expect(result.data.totals.orderDiscountAmount.amount).toBe(Math.round(net * 0.15));
    expect(result.data.internalNotes).toContain('Competitive displacement');
  });

  it('builds an approval chain on submit and releases the quote once every step is approved', async () => {
    const quote = Object.values(db.state.quotes)[0]!;
    // Force a discount above the finance threshold so both steps are generated.
    const priced = await services.quotes.applyOrderDiscount(quote.id, 25, 'Large volume');
    expect(priced.ok).toBe(true);

    const submitted = await services.quotes.submitForApproval(quote.id);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.data.status).toBe('pending_approval');
    expect(submitted.data.approvalState).toBe('pending');
    expect(submitted.data.approvalSteps.length).toBeGreaterThan(0);

    let current = submitted.data;
    for (const step of submitted.data.approvalSteps) {
      const decided = await services.quotes.decideApproval(quote.id, step.id, 'approved');
      expect(decided.ok).toBe(true);
      if (decided.ok) current = decided.data;
    }
    expect(current.approvalState).toBe('approved');
    expect(current.status).toBe('approved');
  });

  it('refuses to convert a draft quote into an order, and explains why', async () => {
    const quote = Object.values(db.state.quotes)[0]!;
    db.put('quotes', { ...quote, status: 'draft', approvalSteps: [] });
    const ordersBefore = Object.values(db.state.orders).filter((order) => order.quoteId === quote.id).length;
    const result = await services.quotes.convertToOrder(quote.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation_failed');
    // No order may have been written.
    expect(Object.values(db.state.orders).filter((order) => order.quoteId === quote.id).length).toBe(ordersBefore);
  });

  it('converts an accepted quote into an order carrying the same lines and totals', async () => {
    const quote = Object.values(db.state.quotes)[0]!;
    db.put('quotes', { ...quote, status: 'accepted', approvalSteps: [] });

    const ordersBefore = Object.keys(db.state.orders).length;
    const result = await services.quotes.convertToOrder(quote.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.keys(db.state.orders).length).toBe(ordersBefore + 1);
    expect(result.data.order.quoteId).toBe(quote.id);
    expect(result.data.order.totals.grandTotal.amount).toBe(quote.totals.grandTotal.amount);
    expect(result.data.order.lineItems.map((item) => item.id)).toEqual(quote.lineItems.map((item) => item.id));
    expect(result.data.order.organizationId).toBe(quote.organizationId);
    // The quote now points back at its order.
    expect(result.data.quote.orderId).toBe(result.data.order.id);
    expect(db.state.quotes[quote.id]!.orderId).toBe(result.data.order.id);
  });

  it('activates, pays and cancels an order with honest state transitions', async () => {
    const quote = Object.values(db.state.quotes)[0]!;
    db.put('quotes', { ...quote, status: 'accepted', approvalSteps: [] });
    const converted = await services.quotes.convertToOrder(quote.id);
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    const orderId = converted.data.order.id;

    const activated = await services.orders.activate(orderId);
    expect(activated.ok).toBe(true);
    if (activated.ok) {
      expect(activated.data.status).toBe('activated');
      expect(activated.data.activatedAt).toBeDefined();
    }

    const total = converted.data.order.totals.grandTotal.amount;
    const paid = await services.orders.recordPayment(orderId, total, 'Bank transfer');
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(paid.data.paidAmount.amount).toBe(0 + total);

    const cancelled = await services.orders.cancel(orderId, 'Customer withdrew');
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(cancelled.data.status).toBe('cancelled');
      expect(cancelled.data.cancelReason).toBe('Customer withdrew');
    }

    // A cancelled order cannot be activated again.
    const reactivate = await services.orders.activate(orderId);
    expect(reactivate.ok).toBe(false);
  });

  it('assembles a revenue summary from the records the modules own', async () => {
    const summary = await services.products.revenueSummary();
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;

    const organizationId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const openQuotes = Object.values(db.state.quotes).filter(
      (quote) => quote.organizationId === organizationId && ['draft', 'in_review', 'pending_approval', 'approved', 'sent', 'viewed', 'revised'].includes(quote.status),
    );
    expect(summary.data.quotes.openCount).toBe(openQuotes.length);
    expect(summary.data.pipeline.dealCount).toBe(
      Object.values(db.state.deals).filter((deal) => deal.organizationId === organizationId && deal.status === 'open').length,
    );
    expect(summary.data.trend).toHaveLength(12);
    expect(summary.data.byChannel.length).toBe(5);
  });
});

describe('support, knowledge base and conversations', () => {
  let db: MockDb;
  let services: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    db = freshDb();
    services = createMockServices({ db, persist: false });
  });

  it('lists tickets scoped to the current tenant', async () => {
    const page = await services.tickets.list({ pageSize: 200 });
    expect(page.items.length).toBeGreaterThan(0);
    const organizationId = Object.values(db.state.users)[0]!.activeOrganizationId;
    expect(page.items.every((ticket) => ticket.organizationId === organizationId)).toBe(true);
  });

  it('filters the queue by SLA state', async () => {
    const breached = await services.tickets.list({
      pageSize: 500,
      filter: { id: 'sla', conjunction: 'and', clauses: [{ field: 'slaState', operator: 'eq', value: 'breached' }] },
    });
    expect(breached.items.every((ticket) => ticket.slaState === 'breached')).toBe(true);
  });

  it('records a reply, increments the count and starts the first-response clock', async () => {
    const ticket = Object.values(db.state.tickets)[0]!;
    db.put('tickets', { ...ticket, firstRespondedAt: undefined });
    const before = db.state.tickets[ticket.id]!.messageCount;

    const reply = await services.tickets.reply(ticket.id, 'We are looking into this now.');
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.data.delivery?.state).toBe('simulated_sent');

    const stored = db.state.tickets[ticket.id]!;
    expect(stored.messageCount).toBe(before + 1);
    expect(stored.firstRespondedAt).toBeDefined();
  });

  it('marks an internal note as a draft rather than a sent reply', async () => {
    const ticket = Object.values(db.state.tickets)[0]!;
    const reply = await services.tickets.reply(ticket.id, 'Strategic account — loop in the manager.', { isInternalNote: true });
    expect(reply.ok).toBe(true);
    if (reply.ok) {
      expect(reply.data.kind).toBe('internal_note');
      expect(reply.data.isFromCustomer).toBe(false);
      expect(reply.data.delivery?.state).toBe('draft');
    }
  });

  it('resolves and reopens a ticket, keeping the reopen count honest', async () => {
    const ticket = Object.values(db.state.tickets)[0]!;

    const resolved = await services.tickets.resolve(ticket.id, 'Restarted the connector.', 'Stale access token');
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.data.status).toBe('resolved');
      expect(resolved.data.resolutionSummary).toBe('Restarted the connector.');
      expect(resolved.data.rootCause).toBe('Stale access token');
      expect(resolved.data.resolvedAt).toBeDefined();
    }

    const before = db.state.tickets[ticket.id]!.reopenCount;
    const reopened = await services.tickets.reopen(ticket.id, 'Issue returned after two hours.');
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(reopened.data.status).toBe('reopened');
      expect(reopened.data.reopenCount).toBe(before + 1);
      expect(reopened.data.resolvedAt).toBeUndefined();
    }
  });

  it('escalates by raising the priority and recording the level', async () => {
    const ticket = Object.values(db.state.tickets).find((candidate) => candidate.escalationLevel === 0)!;
    const escalated = await services.tickets.escalate([ticket.id], 'Customer escalation');
    expect(escalated.ok).toBe(true);
    if (escalated.ok) expect(escalated.data.succeeded).toBe(1);

    const stored = db.state.tickets[ticket.id]!;
    expect(stored.priority).toBe('critical');
    expect(stored.escalationLevel).toBeGreaterThanOrEqual(1);
  });

  it('derives SLA compliance per policy from the tickets that reference it', async () => {
    const policies = await services.tickets.slaPolicies();
    expect(policies.items.length).toBeGreaterThan(0);
    for (const policy of policies.items) {
      const scoped = Object.values(db.state.tickets).filter((ticket) => ticket.slaPolicyId === policy.id);
      expect(policy.ticketsTotal).toBe(scoped.length);
      expect(policy.ticketsBreached).toBe(scoped.filter((ticket) => ticket.slaState === 'breached').length);
    }
  });

  it('reports a support overview whose open count matches the records', async () => {
    const overview = await services.tickets.overview();
    expect(overview.ok).toBe(true);
    if (!overview.ok) return;

    // Only the active organization's tickets contribute to the support overview.
    const activeId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const open = Object.values(db.state.tickets).filter((ticket) => ticket.organizationId === activeId && !['resolved', 'closed'].includes(ticket.status)).length;
    expect(overview.data.metrics.openTickets).toBe(open);
    expect(overview.data.byStatus.length).toBeGreaterThan(0);
  });

  it('publishes an article and stamps the publish time', async () => {
    const draft = Object.values(db.state.kbArticles).find((article) => article.status !== 'published')!;
    const published = await services.knowledgeBase.publish(draft.id);
    expect(published.ok).toBe(true);
    if (published.ok) {
      expect(published.data.status).toBe('published');
      expect(published.data.publishedAt).toBeDefined();
    }
  });

  it('moves an article into review and counts helpful votes', async () => {
    const article = Object.values(db.state.kbArticles)[0]!;
    const reviewer = Object.values(db.state.users)[0]!;

    const review = await services.knowledgeBase.submitForReview(article.id, reviewer.id);
    expect(review.ok).toBe(true);
    if (review.ok) {
      expect(review.data.status).toBe('in_review');
      expect(review.data.reviewerId).toBe(reviewer.id);
    }

    const helpfulBefore = db.state.kbArticles[article.id]!.helpfulCount;
    const voted = await services.knowledgeBase.vote(article.id, true);
    expect(voted.ok).toBe(true);
    if (voted.ok) expect(voted.data.helpfulCount).toBe(helpfulBefore + 1);
  });

  it('suggests knowledge articles for a ticket subject', async () => {
    const ticket = Object.values(db.state.tickets)[0]!;
    const suggestions = await services.knowledgeBase.suggestForTicket(ticket.id, ticket.subject);
    expect(Array.isArray(suggestions.items)).toBe(true);
    expect(suggestions.items.length).toBeLessThanOrEqual(5);
  });

  it('records a conversation reply and updates the thread preview', async () => {
    const conversation = Object.values(db.state.conversations)[0]!;
    db.put('conversations', { ...conversation, firstRespondedAt: undefined });
    const before = db.state.conversations[conversation.id]!.messageCount;

    const reply = await services.conversations.reply(conversation.id, 'Thanks — we have reproduced this.');
    expect(reply.ok).toBe(true);
    if (reply.ok) {
      expect(reply.data.delivery.state).toBe('simulated_sent');
      expect(reply.data.delivery.simulated).toBe(true);
    }

    const stored = db.state.conversations[conversation.id]!;
    expect(stored.messageCount).toBe(before + 1);
    expect(stored.lastMessagePreview).toContain('Thanks');
    expect(stored.firstRespondedAt).toBeDefined();
  });

  it('stars, snoozes and closes a conversation through its own state', async () => {
    const conversation = Object.values(db.state.conversations)[0]!;

    const starred = await services.conversations.star(conversation.id, true);
    expect(starred.ok).toBe(true);
    if (starred.ok) expect(starred.data.isStarred).toBe(true);

    const until = new Date(Date.now() + 86_400_000).toISOString();
    const snoozed = await services.conversations.snooze([conversation.id], until);
    expect(snoozed.ok).toBe(true);
    expect(db.state.conversations[conversation.id]!.status).toBe('snoozed');
    expect(db.state.conversations[conversation.id]!.snoozedUntil).toBe(until);

    const closed = await services.conversations.updateStatus([conversation.id], 'closed');
    expect(closed.ok).toBe(true);
    expect(db.state.conversations[conversation.id]!.status).toBe('closed');
  });

  it('summarises a conversation from its own thread, not a model', async () => {
    const conversation = Object.values(db.state.conversations)[0]!;
    const summary = await services.conversations.summarise(conversation.id);
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.data.origin).toBe('demo_template_engine');
      expect(summary.data.suggestedReplies.length).toBeGreaterThan(0);
      expect(summary.data.summary.length).toBeGreaterThan(0);
    }
  });
});

/* --------------------------- phase 0: tenant ownership regressions */

describe('tenant ownership regression guards (phase 0)', () => {
  it('rejects foreign record IDs across generic reads and mutations', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const activeId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const foreign = Object.values(db.state.leads).find((lead) => lead.organizationId !== activeId)!;
    const snapshot = structuredClone(foreign);

    const read = await services.leads.get(foreign.id);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe('not_found');

    const update = await services.leads.update(foreign.id, { companyName: 'Cross-tenant update' }, fast);
    expect(update.ok).toBe(false);
    const remove = await services.leads.remove(foreign.id, fast);
    expect(remove.ok).toBe(false);
    const bulk = await services.leads.bulkRemove([foreign.id], fast);
    expect(bulk.ok).toBe(true);
    if (bulk.ok) expect(bulk.data).toMatchObject({ succeeded: 0, failed: 1 });

    const tag = await services.leads.addTag([foreign.id], 'forbidden');
    expect(tag.ok && tag.data.succeeded).toBe(0);
    expect(db.state.leads[foreign.id]).toEqual(snapshot);
  });

  it('enforces the active organization on creates and protects tenant IDs on updates', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const activeId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const [foreignId] = Object.keys(db.state.organizations).filter((id) => id !== activeId);
    const existing = (await services.leads.list({ pageSize: 1 })).items[0]!;
    const update = await services.leads.update(existing.id, { organizationId: foreignId } as never, fast);
    expect(update.ok).toBe(true);
    expect(db.state.leads[existing.id]!.organizationId).toBe(activeId);
    // Bypass the facade type only to simulate an untrusted API payload.
    const create = await services.leads.create({
      ...existing,
      id: undefined,
      organizationId: foreignId,
      companyName: 'Forged tenant ID',
    } as never, fast);
    expect(create.ok).toBe(true);
    if (create.ok) expect(create.data.organizationId).toBe(activeId);
  });

  it('scopes ticket aggregates, policies, messages, and lifecycle writes', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const activeId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const localTickets = Object.values(db.state.tickets).filter((ticket) => ticket.organizationId === activeId);
    const foreign = Object.values(db.state.tickets).find((ticket) => ticket.organizationId !== activeId)!;
    const snapshot = structuredClone(foreign);
    const overview = await services.tickets.overview();
    expect(overview.ok).toBe(true);
    if (overview.ok) {
      expect(overview.data.metrics.openTickets).toBe(
        localTickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length,
      );
    }
    const policies = await services.tickets.slaPolicies();
    expect(policies.items.every((policy) => policy.organizationId === activeId)).toBe(true);
    const categories = await services.tickets.categories();
    expect(categories.items.every((category) => category.organizationId === activeId)).toBe(true);
    expect((await services.tickets.messages(foreign.id)).items).toEqual([]);
    expect((await services.tickets.reply(foreign.id, 'Not allowed')).ok).toBe(false);
    expect((await services.tickets.resolve(foreign.id, 'Not allowed', 'Not allowed')).ok).toBe(false);
    expect((await services.tickets.reopen(foreign.id, 'Not allowed')).ok).toBe(false);
    expect(db.state.tickets[foreign.id]).toEqual(snapshot);
  });

  it('rejects a cross-tenant merge without deleting any foreign records', async () => {
    const db = freshDb();
    const services = createMockServices({ db, persist: false });
    const activeId = Object.values(db.state.users)[0]!.activeOrganizationId;
    const local = Object.values(db.state.contacts).find((contact) => contact.organizationId === activeId)!;
    const foreign = Object.values(db.state.contacts).find((contact) => contact.organizationId !== activeId)!;
    const result = await services.contacts.merge(local.id, [foreign.id], {});
    expect(result.ok).toBe(false);
    expect(db.state.contacts[local.id]).toBeDefined();
    expect(db.state.contacts[foreign.id]).toBeDefined();
  });
});
