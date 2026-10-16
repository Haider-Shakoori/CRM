import { describe, expect, it } from 'vitest';
import { MockDb } from '../lib/store';
import { buildDataset } from '../seed';
import { createMockServices } from './index';

const fresh = () => {
  const db = new MockDb({ persist: false, seed: buildDataset });
  const services = createMockServices({ db, persist: false });
  const active = Object.values(db.state.users)[0]!.activeOrganizationId;
  const ownLead = Object.values(db.state.leads).find((lead) => lead.organizationId === active)!;
  const foreignLead = Object.values(db.state.leads).find((lead) => lead.organizationId !== active)!;
  return { db, services, active, ownLead, foreignLead };
};

describe('Phase 0: active-organization CRUD boundaries', () => {
  it('denies cross-tenant get, update, delete, archive and restore by ID', async () => {
    const { db, services, foreignLead } = fresh();
    expect((await services.leads.get(foreignLead.id)).ok).toBe(false);
    expect((await services.leads.update(foreignLead.id, { companyName: 'Cross-tenant edit' })).ok).toBe(false);
    expect((await services.leads.remove(foreignLead.id)).ok).toBe(false);
    expect((await services.leads.archive(foreignLead.id)).ok).toBe(false);
    expect((await services.leads.restore(foreignLead.id)).ok).toBe(false);
    expect(db.state.leads[foreignLead.id]!.companyName).toBe(foreignLead.companyName);
  });

  it('prevents tenant reassignment and partial bulk cross-tenant mutations', async () => {
    const { db, services, active, ownLead, foreignLead } = fresh();
    const update = await services.leads.update(ownLead.id, { organizationId: foreignLead.organizationId } as never);
    expect(update.ok).toBe(true);
    expect(db.state.leads[ownLead.id]!.organizationId).toBe(active);
    const deletion = await services.leads.bulkRemove([ownLead.id, foreignLead.id]);
    expect(deletion.ok).toBe(true);
    if (deletion.ok) {
      expect(deletion.data.succeeded).toBe(1);
      expect(deletion.data.failed).toBe(1);
    }
    expect(db.state.leads[foreignLead.id]).toBeDefined();
    await services.leads.assign([foreignLead.id], 'user-not-owned');
    expect(db.state.leads[foreignLead.id]!.ownerId).toBe(foreignLead.ownerId);
  });

  it('isolates support overview, ticket category lists and SLA compliance figures', async () => {
    const { db, services, active } = fresh();
    const mine = Object.values(db.state.tickets).filter((ticket) => ticket.organizationId === active);
    const overview = await services.tickets.overview();
    expect(overview.ok).toBe(true);
    if (overview.ok) {
      expect(overview.data.metrics.openTickets).toBe(mine.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length);
    }
    const categories = await services.tickets.categories();
    expect(categories.items.every((category) => category.organizationId === active)).toBe(true);
    const policies = await services.tickets.slaPolicies();
    expect(policies.items.every((policy) => policy.organizationId === active)).toBe(true);
    for (const policy of policies.items) {
      expect(policy.ticketsTotal).toBe(mine.filter((ticket) => ticket.slaPolicyId === policy.id).length);
    }
  });

  it('rejects cross-tenant lead merges and scopes pipeline summaries', async () => {
    const { db, services, active, ownLead, foreignLead } = fresh();
    const merged = await services.leads.merge(ownLead.id, [foreignLead.id], {});
    expect(merged.ok).toBe(false);
    expect(db.state.leads[foreignLead.id]).toBeDefined();
    const pipeline = Object.values(db.state.pipelines).find((item) => item.organizationId === active)!;
    const summary = await services.deals.pipelineSummary(pipeline.id);
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.data.totalDeals).toBe(
        Object.values(db.state.deals).filter((deal) => deal.organizationId === active && deal.pipelineId === pipeline.id && deal.status === 'open').length,
      );
    }
  });
});
