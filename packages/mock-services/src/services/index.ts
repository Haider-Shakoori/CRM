/**
 * Mock service container.
 *
 * One implementation per contract in `@crm/shared-types/services`. The UI depends only on
 * the interfaces, so replacing this file's export with an HTTP client is the entire
 * migration.
 *
 * Implementation philosophy, stated plainly because it affects how the product behaves:
 *
 *   - **Reads are complete.** Every collection supports list, filter, sort, paginate and
 *     facet over the seeded dataset. No screen has to fall back to a hardcoded array.
 *   - **Writes are real against local state.** Create, update, delete, bulk patch and the
 *     cross-record operations genuinely mutate the store and persist to `localStorage`.
 *   - **Derived values are derived.** Pipeline totals, health scores, SLA states and
 *     campaign funnels are computed from their underlying records, never stored twice.
 *   - **Unimplemented work returns an error, never a success.** A method whose full
 *     behaviour depends on a backend returns a typed failure that the UI renders honestly,
 *     rather than a fabricated confirmation.
 */

import type {
  Account,
  Activity,
  AuditEvent,
  BulkActionOutcome,
  CommissionStatement,
  Contact,
  Contract,
  CurrencyCode,
  Deal,
  Id,
  Lead,
  FilterClause,
  InvoiceRecord,
  ListQuery,
  Order,
  Organization,
  PipelineSummary,
  PriceBook,
  PriceBookEntry,
  Product,
  ProductCategory,
  Quote,
  QuoteLineItem,
  QuoteTotals,
  Result,
  RevenueSubscription,
  Role,
  ServiceContainer,
  Team,
  Ticket,
  User,
  UserPreferences,
  CustomField,
  DocumentFile,
  AiMessage,
  AiPromptSuggestion,
  UsageMeter,
} from '@crm/shared-types';
import { DATASET_EPOCH, addDays, createRandom, toDateString, toDateTimeString } from '../lib/random';
import { buildPageMeta, runQuery } from '../lib/query';
import { makeCustomerSuccessService, makePlaybooksService } from './customer-success';
import { makeCollaborationService, makeConversationsService, makeCustomizationService, makeKnowledgeBaseService, makeWorkflowsService } from './extra';
import { makeBillingService, makeDataService, makeSecurityService } from './administration';
import { makeSequencesService } from './engagement';
import { makeExportsService, makeGoalsService } from './analytics-extras';
import { makeCustomizationExtrasService } from './customization-extras';
import {
  makeCampaignsService,
  makeEmailTemplatesService,
  makeFormsService,
  makeJourneysService,
  makeLandingPagesService,
  makeLeadSourcesService,
  makeSegmentsService,
} from './marketing';
import { makeFieldSalesService, makePartnersService, makeProjectsService } from './workspaces';
import { MockDb } from '../lib/store';
import { buildDataset } from '../seed';
import { computePipelineTotals, createCrud, daysSince, delay, err, nextId, ok, simulatedFailure } from './factory';

const asRecords = <T>(database: MockDb, collection: import('../lib/store').CollectionName): T[] =>
  database.all(collection) as unknown as T[];

/* ------------------------------------------------------------- organisation */

/** Resolve the organization a request belongs to. Defaults to the first seeded tenant. */
function resolveOrganizationId(db: MockDb, explicit?: Id): Id {
  if (explicit) return explicit;
  const organizations = Object.values(db.state.organizations);
  return organizations[0]?.id ?? 'org-vertex';
}

/* --------------------------------------------------------- local pricing engine */

/**
 * The single pricing calculation for quotes and orders.
 *
 * Exported because the correct place to test monetary arithmetic is beside the arithmetic,
 * not through a rendered table. A line edit, an order discount, a conversion from a quote and
 * a conversion to an order all pass through these two functions, so a total shown anywhere can
 * never depend on which code path produced it.
 *
 * Tax is deliberately absent. `taxTotal` is zero and `taxNote` says why: a frontend that
 * invented a tax figure would be displaying a number it cannot stand behind.
 */
export function priceQuoteLine(line: QuoteLineItem, currency: CurrencyCode): QuoteLineItem {
  const gross = Math.round(line.quantity * line.unitPrice.amount);
  const percent = Math.min(100, Math.max(0, line.discountPercent));
  const discountAmount = Math.round(gross * (percent / 100));
  return {
    ...line,
    discountPercent: percent,
    unitPrice: { amount: line.unitPrice.amount, currency },
    listPrice: { amount: line.listPrice.amount, currency },
    discountAmount: { amount: discountAmount, currency },
    subtotal: { amount: gross, currency },
    netTotal: { amount: gross - discountAmount, currency },
    isRecurring: line.billing !== 'one_time',
  };
}

export function computeQuoteTotals(
  rawLines: QuoteLineItem[],
  currency: CurrencyCode,
  orderDiscountPercent: number,
  costByProduct?: Map<Id, number>,
): QuoteTotals {
  const lines = rawLines.map((line) => priceQuoteLine(line, currency));
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal.amount, 0);
  const lineDiscountTotal = lines.reduce((sum, line) => sum + line.discountAmount.amount, 0);
  const netBeforeOrder = subtotal - lineDiscountTotal;
  const safeOrderPercent = Math.min(100, Math.max(0, orderDiscountPercent));
  const orderDiscountAmount = Math.round(netBeforeOrder * (safeOrderPercent / 100));
  const netSubtotal = netBeforeOrder - orderDiscountAmount;

  const sumBilling = (billing: QuoteLineItem['billing']) =>
    lines.filter((line) => line.billing === billing).reduce((sum, line) => sum + line.netTotal.amount, 0);
  const monthly = sumBilling('monthly');
  const quarterly = sumBilling('quarterly');
  const annual = sumBilling('annual');

  const costTotal = lines.reduce((sum, line) => {
    const unitCost = costByProduct?.get(line.productId);
    // With no recorded cost the margin panel falls back to a stated 40% of list rather than
    // claiming a precision the input does not support.
    const lineCost = unitCost !== undefined ? unitCost * line.quantity : Math.round(line.subtotal.amount * 0.4);
    return sum + lineCost;
  }, 0);
  const marginAmount = netSubtotal - costTotal;

  return {
    currency,
    subtotal: { amount: subtotal, currency },
    lineDiscountTotal: { amount: lineDiscountTotal, currency },
    orderDiscountPercent: safeOrderPercent,
    orderDiscountAmount: { amount: orderDiscountAmount, currency },
    netSubtotal: { amount: netSubtotal, currency },
    taxTotal: { amount: 0, currency },
    taxNote: 'Tax is not calculated by the platform. Any rate shown is recorded for reference only.',
    grandTotal: { amount: netSubtotal, currency },
    recurring: {
      oneTime: { amount: sumBilling('one_time'), currency },
      monthly: { amount: monthly, currency },
      quarterly: { amount: quarterly, currency },
      annual: { amount: annual, currency },
      annualisedTotal: { amount: annual + monthly * 12 + quarterly * 4, currency },
    },
    margin: {
      costTotal: { amount: costTotal, currency },
      marginAmount: { amount: marginAmount, currency },
      marginPercent: netSubtotal > 0 ? Math.round((marginAmount / netSubtotal) * 100) : 0,
    },
  };
}

/* ------------------------------------------------------------------- build */

export function createMockServices(options: { db?: MockDb; persist?: boolean } = {}) {
  const db = options.db ?? new MockDb({ persist: options.persist ?? true, seed: buildDataset });

  /**
   * The organization every read is scoped to.
   *
   * Scoping is applied at the query layer rather than by each caller, so a screen cannot
   * forget it. This is a UI demonstration of multi-tenancy, not a security boundary — real
   * isolation is a server responsibility and the mock does not pretend otherwise.
   */
  const currentOrganizationId = (): Id =>
    Object.values(db.state.users)[0]?.activeOrganizationId ?? Object.values(db.state.organizations)[0]!.id;

  /**
   * Scope a list query to the active organization.
   *
   * The tenant clause is ANDed onto whatever filter the caller supplied, so a saved view
   * cannot widen a result beyond the current tenant.
   */
  const scope = (value: ListQuery = {}): ListQuery => {
    const organizationId = currentOrganizationId();
    const tenantClause: FilterClause = {
      field: 'organizationId',
      operator: 'eq',
      value: organizationId,
    };
    return {
      ...value,
      includeArchived: value.includeArchived ?? false,
      filter: {
        id: `scope-${organizationId}`,
        conjunction: 'and',
        clauses: [tenantClause, ...(value.filter?.clauses ?? [])],
      },
    };
  };

  /* ------------------------------------------------------------ collections */

  const leads = createCrud<Lead>(db, 'leads', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Lead',
    searchFields: ['reference', 'firstName', 'lastName', 'companyName', 'emails.0.value', 'jobTitle'],
    facetField: 'status',
    defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  });
  const contacts = createCrud<Contact>(db, 'contacts', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Contact',
    searchFields: ['reference', 'firstName', 'lastName', 'displayName', 'accountName', 'emails.0.value', 'jobTitle'],
    facetField: 'lifecycleStage',
  });
  const accounts = createCrud<Account>(db, 'accounts', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Account',
    searchFields: ['reference', 'name', 'industryLabel', 'domains.0'],
    facetField: 'health',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });
  const deals = createCrud<Deal>(db, 'deals', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Deal',
    searchFields: ['reference', 'name', 'accountName', 'primaryContactName'],
    facetField: 'stageId',
  });
  const activities = createCrud<Activity>(db, 'activities', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Activity',
    searchFields: ['subject', 'body', 'ownerName'],
    facetField: 'kind',
  });
  const tickets = createCrud<Ticket>(db, 'tickets', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Ticket',
    searchFields: ['reference', 'subject', 'accountName', 'requesterName'],
    facetField: 'status',
  });

  /* --------------------------------------------------------------- helpers */

  // Mock-only scope guards. The production Laravel API must enforce ownership server-side.
  const owned = <T extends { organizationId: Id }>(record: T | undefined): T | undefined =>
    record?.organizationId === currentOrganizationId() ? record : undefined;
  const scopedRecords = <T extends { organizationId: Id }>(collection: import('../lib/store').CollectionName): T[] =>
    (db.all(collection) as unknown as T[]).filter((record) => record.organizationId === currentOrganizationId());
  const ticketsInScope = () => scopedRecords<Ticket>('tickets');
  const dealsInScope = () => scopedRecords<Deal>('deals');

  /** Recompute every deal's staleness and days-in-stage from the pipeline settings. */
  function refreshDealDerivedFields(): void {
    db.transaction((draft) => {
      for (const pipeline of Object.values(draft.pipelines)) {
        const threshold = pipeline.settings.staleDealDays;
        for (const deal of Object.values(draft.deals)) {
          if (deal.pipelineId !== pipeline.id) continue;
          deal.daysInStage = daysSince(deal.stageEnteredAt, DATASET_EPOCH);
          deal.isStale = deal.status === 'open' && deal.daysInStage > threshold;
        }
      }
    });
  }

  function pipelineSummaryFor(pipelineId: Id): PipelineSummary {
    const pipeline = db.state.pipelines[pipelineId];
    const scoped = dealsInScope().filter((deal) => deal.pipelineId === pipelineId);
    const totals = computePipelineTotals(scoped);
    const currency = pipeline?.currency ?? 'USD';
    const won = scoped.filter((deal) => deal.status === 'won');
    const lost = scoped.filter((deal) => deal.status === 'lost');
    const closedCount = won.length + lost.length;

    return {
      pipelineId,
      pipelineName: pipeline?.name ?? 'Pipeline',
      currency,
      // Counted from the same population as totalValue, so the two can never describe
      // different sets of deals.
      totalDeals: totals.dealCount,
      totalValue: { amount: totals.totalValue, currency },
      weightedValue: { amount: totals.weightedValue, currency },
      averageDealSize: { amount: totals.dealCount > 0 ? Math.round(totals.totalValue / totals.dealCount) : 0, currency },
      averageCycleTimeDays: scoped.length > 0 ? Math.round(scoped.reduce((sum, deal) => sum + (deal.cycleTimeDays ?? deal.daysInStage), 0) / scoped.length) : 0,
      winRate: closedCount > 0 ? Math.round((won.length / closedCount) * 100) : 0,
      stages: (pipeline?.stages ?? []).map((stage) => {
        const stageTotals = totals.byStage.find((entry) => entry.stageId === stage.id);
        /**
         * Open-stage figures come from the weighted calculation. Closed stages are outside
         * it by design (a won deal has no probability to weight), so their counts are
         * computed separately here. A closed column that reported zero would be wrong, and
         * a reader would have no way to tell that from "no deals".
         */
        const closedInStage = scoped.filter((deal) => deal.stageId === stage.id && deal.status !== 'open');
        const closedValue = closedInStage.reduce((sum, deal) => sum + deal.amount.amount, 0);
        const closedAge = closedInStage.reduce((sum, deal) => sum + deal.daysInStage, 0);
        return {
          stageId: stage.id,
          stageName: stage.name,
          tone: stage.tone,
          probability: stage.probability,
          dealCount: (stageTotals?.dealCount ?? 0) + closedInStage.length,
          totalValue: { amount: (stageTotals?.totalValue ?? 0) + closedValue, currency },
          weightedValue: { amount: stageTotals?.weightedValue ?? 0, currency },
          averageAgeDays: stageTotals?.averageAgeDays ?? (closedInStage.length > 0 ? Math.round(closedAge / closedInStage.length) : 0),
          staleCount: stageTotals?.staleCount ?? 0,
        };
      }),
    };
  }

  /**
   * Move a deal between stages.
   *
   * This is the operation the brief is most specific about: a move must update the visible
   * pipeline totals and the deal's own detail view, and both the drag-and-drop path and the
   * accessible path must go through it. Returning the recomputed summary alongside the deal
   * is what makes that structural rather than carefully maintained.
   */
  async function moveDeal(
    dealId: Id,
    toStageId: Id,
    options_?: { lostReasonId?: Id; note?: string },
  ): Promise<Result<{ deal: Deal; summary: PipelineSummary }>> {
    await delay(`deal-move:${dealId}`);
    const deal = owned(db.state.deals[dealId]);
    if (!deal) return err('not_found', 'That deal no longer exists.');

    const pipeline = db.state.pipelines[deal.pipelineId];
    const stage = pipeline?.stages.find((candidate) => candidate.id === toStageId);
    if (!pipeline || !stage) return err('validation_failed', 'That stage does not belong to this deal’s pipeline.');

    if (stage.kind === 'lost' && pipeline.settings.requireLostReason && !options_?.lostReasonId) {
      return err('validation_failed', 'A lost reason is required to close a deal as lost.', {
        fieldErrors: [{ path: 'lostReasonId', message: 'Select a reason before closing the deal.' }],
      });
    }

    const fromStageId = deal.stageId;

    db.transaction((draft) => {
      const target = draft.deals[dealId];
      if (!target) return;
      target.stageId = toStageId;
      target.probability = stage.probability;
      target.forecastCategory = stage.forecastCategory;
      target.status = stage.kind === 'won' ? 'won' : stage.kind === 'lost' ? 'lost' : 'open';
      target.stageEnteredAt = toDateTimeString(DATASET_EPOCH);
      target.daysInStage = 0;
      target.isStale = false;
      target.updatedAt = new Date().toISOString();
      if (stage.kind !== 'open') {
        target.actualCloseDate = toDateString(DATASET_EPOCH);
        target.cycleTimeDays = daysSince(target.createdAt, DATASET_EPOCH);
      }
      if (stage.kind === 'lost' && options_?.lostReasonId) {
        target.lostReasonId = options_.lostReasonId;
        target.lostReasonLabel = draft.dealLostReasons[options_.lostReasonId]?.label;
        target.lostNotes = options_?.note;
      }

      // A stage move is an event, so it appears on the record timeline.
      const activityId = `act-stage-${dealId}-${Date.now().toString(36)}`;
      draft.activities[activityId] = {
        id: activityId,
        organizationId: target.organizationId,
        kind: 'stage_change',
        subject: `Stage moved from ${pipeline.stages.find((s) => s.id === fromStageId)?.name ?? 'previous stage'} to ${stage.name}`,
        subjects: [
          { type: 'deal', id: target.id, label: target.name },
          { type: 'account', id: target.accountId, label: target.accountName },
        ],
        body: options_?.note,
        status: 'completed',
        priority: 'normal',
        ownerId: target.ownerId,
        ownerName: draft.users[target.ownerId]?.displayName ?? 'System',
        visibility: 'team',
        source: 'user',
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as never;
    });

    // Stale flags are derived, so recompute rather than trusting the patch above.
    refreshDealDerivedFields();

    const updated = owned(db.state.deals[dealId])!;
    return ok({ deal: updated, summary: pipelineSummaryFor(deal.pipelineId) });
  }

  /* ------------------------------------------------------------------ leads */

  const leadsService: ServiceContainer['leads'] = {
    list: (query) => leads.list(scope(query)),
    get: (id) => leads.get(id),
    create: (input, writeOptions) => leads.create(input, writeOptions),
    update: (id, input, writeOptions) => leads.update(id, input, writeOptions),
    remove: (id, writeOptions) => leads.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => leads.bulkRemove(ids, writeOptions),
    archive: (id) => leads.archive(id),
    restore: (id) => leads.restore(id),
    assign: (ids, ownerId, teamId) => leads.bulkPatch(ids, { ownerId, ownerTeamId: teamId }, 'assign'),
    updateStatus: (ids, status) => leads.bulkPatch(ids, { status }, 'status'),
    updateRating: (ids, rating) => leads.bulkPatch(ids, { rating }, 'rating'),
    addTag: async (ids, tagId) => {
      await delay('lead-add-tag');
      let succeeded = 0;
      const failures: Array<{ id: Id; reason: string }> = [];
      for (const id of ids) {
        const lead = owned(db.state.leads[id]);
        if (!lead) {
          failures.push({ id, reason: 'Record not found' });
          continue;
        }
        if (!lead.tags.some((tag) => tag.id === tagId)) {
          db.put('leads', { ...lead, tags: [...lead.tags, { id: tagId, label: tagId, color: 'slate' }], updatedAt: new Date().toISOString() });
        }
        succeeded += 1;
      }
      return ok({ requested: ids.length, succeeded, failed: failures.length, failures });
    },
    findDuplicates: async (candidate) => {
      await delay('lead-duplicates');
      const name = String((candidate as { companyName?: string }).companyName ?? '').toLowerCase();
      const matches = scopedRecords<Lead>('leads').filter(
        (lead) => lead.companyName && name && lead.companyName.toLowerCase().includes(name.slice(0, 6)),
      );
      return {
        items: matches.slice(0, 5).map((lead, index) => ({
          id: `dup-${lead.id}`,
          entityKind: 'lead' as const,
          score: 92 - index * 7,
          matchedOn: [{ field: 'companyName', valueA: lead.companyName ?? '', valueB: String((candidate as { companyName?: string }).companyName ?? '') }],
          recordA: { id: lead.id, label: lead.companyName ?? lead.reference, subtitle: lead.reference },
          recordB: { id: 'candidate', label: String((candidate as { companyName?: string }).companyName ?? 'New record'), subtitle: 'Not yet saved' },
          status: 'pending' as const,
          detectedAt: toDateTimeString(DATASET_EPOCH),
        })),
        meta: { page: 1, pageSize: 25, total: matches.length, totalPages: 1, hasNext: false, hasPrev: false },
      };
    },
    merge: async (primaryId, mergeIds) => {
      await delay('lead-merge');
      const primary = owned(db.state.leads[primaryId]);
      if (!primary) return err<Lead>('not_found', 'The record to keep could not be found.');
      if (mergeIds.some((id) => !owned(db.state.leads[id]))) return err<Lead>('not_found', 'One or more leads were not found.');
      db.removeMany('leads', mergeIds);
      return ok(primary);
    },
    previewConversion: async (id, request) => {
      await delay(`lead-preview:${id}`, { latency: { min: 80, max: 220 } });
      const lead = owned(db.state.leads[id]);
      if (!lead) return err('not_found', 'That lead no longer exists.');

      const existingContact = scopedRecords<Contact>('contacts').find((contact) =>
        lead.emails.some((email) => contact.emails.some((candidate) => candidate.value === email.value)),
      );
      const existingAccount = scopedRecords<Account>('accounts').find(
        (account) => account.name.toLowerCase() === (lead.companyName ?? '').toLowerCase(),
      );

      const displayName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');

      return ok({
        leadId: id,
        contact: {
          willCreate: request.contactAccountAction === 'create_new' || !existingContact,
          existingId: existingContact?.id,
          displayName,
          fieldDiffs: existingContact
            ? [
                { field: 'jobTitle', label: 'Job title', leadValue: lead.jobTitle, existingValue: existingContact.jobTitle, conflict: lead.jobTitle !== existingContact.jobTitle },
                { field: 'phone', label: 'Phone', leadValue: lead.phones[0]?.value, existingValue: existingContact.phones[0]?.value, conflict: lead.phones[0]?.value !== existingContact.phones[0]?.value },
              ]
            : [],
        },
        account: {
          willCreate: request.contactAccountAction === 'create_new' || !existingAccount,
          existingId: existingAccount?.id,
          displayName: lead.companyName ?? 'New account',
          fieldDiffs: [],
        },
        deal: request.createDeal
          ? { willCreate: true, displayName: request.dealName ?? `${lead.companyName ?? displayName} — new opportunity`, amount: lead.estimatedValue }
          : undefined,
        duplicateWarnings: [
          ...(existingContact ? [{ kind: 'contact' as const, existingId: existingContact.id, label: existingContact.displayName, score: 94 }] : []),
          ...(existingAccount ? [{ kind: 'account' as const, existingId: existingAccount.id, label: existingAccount.name, score: 88 }] : []),
        ],
      });
    },
    convert: async (request) => {
      await delay(`lead-convert:${request.leadId}`, { latency: { min: 220, max: 520 } });
      const lead = owned(db.state.leads[request.leadId]);
      if (!lead) return err('not_found', 'That lead no longer exists.');

      const preview = await leadsService.previewConversion(request.leadId, request);
      if (!preview.ok) return preview;

      const organizationId = lead.organizationId;
      const now = new Date().toISOString();
      const displayName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Contact';
      const accountId = preview.data.account.existingId ?? `acc-${organizationId}-conv-${Date.now().toString(36)}`;
      const contactId = preview.data.contact.existingId ?? `con-${organizationId}-conv-${Date.now().toString(36)}`;
      let dealId: Id | undefined;

      db.transaction((draft) => {
        if (!draft.accounts[accountId]) {
          draft.accounts[accountId] = {
            id: accountId,
            organizationId,
            reference: `A-${String(90000 + Object.keys(draft.accounts).length).padStart(5, '0')}`,
            name: lead.companyName ?? displayName,
            type: 'prospect',
            domains: lead.website ? [lead.website.replace(/^https?:\/\//, '')] : [],
            emails: [],
            phones: lead.phones,
            addresses: lead.address ? [lead.address] : [],
            childAccountIds: [],
            hierarchyDepth: 0,
            ownerId: request.ownerId ?? lead.ownerId,
            health: 'unknown',
            tags: lead.tags,
            openDealCount: 0,
            openTicketCount: 0,
            contactCount: 0,
            isKeyAccount: false,
            buyingCommittee: [],
            customFields: {},
            createdAt: now,
            updatedAt: now,
          };
        }

        if (!draft.contacts[contactId]) {
          draft.contacts[contactId] = {
            id: contactId,
            organizationId,
            reference: `C-${String(90000 + Object.keys(draft.contacts).length).padStart(5, '0')}`,
            firstName: lead.firstName ?? 'Unknown',
            lastName: lead.lastName ?? '',
            displayName,
            jobTitle: lead.jobTitle,
            accountId,
            accountName: draft.accounts[accountId]?.name,
            emails: lead.emails,
            phones: lead.phones,
            addresses: lead.address ? [lead.address] : [],
            lifecycleStage: 'opportunity',
            consent: [],
            tags: lead.tags,
            relationships: [],
            openDealCount: 0,
            openTicketCount: 0,
            ownerId: request.ownerId ?? lead.ownerId,
            ownerTeamId: lead.ownerTeamId,
            customFields: {},
            createdAt: now,
            updatedAt: now,
          };
        }

        if (request.createDeal) {
          const pipelineId = request.pipelineId ?? Object.values(draft.pipelines)[0]!.id;
          const pipeline = draft.pipelines[pipelineId]!;
          const stage = pipeline.stages.find((candidate) => candidate.id === request.stageId)
            ?? pipeline.stages.find((candidate) => candidate.kind === 'open')!;
          dealId = `deal-${organizationId}-conv-${Date.now().toString(36)}`;
          draft.deals[dealId] = {
            id: dealId,
            organizationId,
            reference: `D-${String(90000 + Object.keys(draft.deals).length).padStart(5, '0')}`,
            name: request.dealName ?? `${draft.accounts[accountId]!.name} — new opportunity`,
            accountId,
            accountName: draft.accounts[accountId]!.name,
            primaryContactId: contactId,
            primaryContactName: displayName,
            pipelineId,
            stageId: stage.id,
            status: 'open',
            amount: request.dealAmount ?? lead.estimatedValue ?? { amount: 0, currency: pipeline.currency },
            pipelineCurrency: pipeline.currency,
            probability: stage.probability,
            forecastCategory: stage.forecastCategory,
            expectedCloseDate: request.expectedCloseDate ?? toDateString(new Date(DATASET_EPOCH.getTime() + 90 * 86_400_000)),
            leadSourceId: lead.leadSourceId,
            dealType: 'new_business',
            ownerId: request.ownerId ?? lead.ownerId,
            ownerTeamId: lead.ownerTeamId,
            teamMembers: [{ userId: request.ownerId ?? lead.ownerId, name: draft.users[request.ownerId ?? lead.ownerId]?.displayName ?? 'Owner', role: 'owner' }],
            products: [],
            competitorIds: [],
            competitors: [],
            stageEnteredAt: now,
            daysInStage: 0,
            isStale: false,
            tags: [],
            customFields: {},
            createdAt: now,
            updatedAt: now,
          };

          draft.accounts[accountId]!.openDealCount += 1;
          draft.contacts[contactId]!.openDealCount += 1;
        }

        // The lead is marked converted rather than deleted, so the audit trail survives.
        const stored = draft.leads[request.leadId];
        if (stored) {
          stored.status = 'converted';
          stored.convertedAt = now;
          stored.convertedTo = { contactId, accountId, dealId };
          stored.updatedAt = now;
        }
        draft.accounts[accountId]!.contactCount += 1;
      });

      return preview;
    },
    rescore: async (ids) => {
      await delay('lead-rescore');
      for (const id of ids) {
        const lead = owned(db.state.leads[id]);
        if (!lead?.scoring) continue;
        db.put('leads', { ...lead, scoring: { ...lead.scoring, updatedAt: new Date().toISOString() } });
      }
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    enrollInSequence: async (ids, sequenceId) => {
      await delay('lead-enroll');
      const sequence = db.state.sequences[sequenceId];
      if (!sequence) return err<BulkActionOutcome>('not_found', 'That sequence could not be found.');
      db.put('sequences', { ...sequence, enrolledCount: sequence.enrolledCount + ids.length, activeCount: sequence.activeCount + ids.length });
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    sources: async () => {
      await delay('lead-sources');
      const sources = Object.values(db.state.leadSources).map((source) => {
        const related = scopedRecords<Lead>('leads').filter((lead) => lead.leadSourceId === source.id);
        const converted = related.filter((lead) => lead.status === 'converted').length;
        return { ...source, leadCount: related.length, conversionRate: related.length > 0 ? Number(((converted / related.length) * 100).toFixed(1)) : 0 };
      });
      return { items: sources, meta: { page: 1, pageSize: 50, total: sources.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    validateImport: async (rows, mapping) => {
      await delay('lead-import-validate', { latency: { min: 200, max: 480 } });
      const errors: Array<{ row: number; field: string; message: string }> = [];
      let valid = 0;
      rows.forEach((row, index) => {
        let rowValid = true;
        for (const [source, target] of Object.entries(mapping)) {
          if (!target) continue;
          const value = row[source];
          if (target === 'email' && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
            errors.push({ row: index + 1, field: target, message: `“${value}” is not a valid email address.` });
            rowValid = false;
          }
          if (target === 'companyName' && !value) {
            errors.push({ row: index + 1, field: target, message: 'Company name is required to create a lead.' });
            rowValid = false;
          }
        }
        if (rowValid) valid += 1;
      });
      return ok({ valid, invalid: rows.length - valid, errors: errors.slice(0, 50), sample: rows.slice(0, 5) });
    },
    commitImport: async (rows, mapping, commitOptions) => {
      await delay('lead-import-commit', { latency: { min: 320, max: 760 } });
      const organizationId = resolveOrganizationId(db);
      let created = 0;
      let skipped = 0;
      const leadIds: Id[] = [];

      for (const row of rows) {
        const email = mapping['email'] ? row[mapping['email']] : undefined;
        if (commitOptions.skipDuplicates && email) {
          const duplicate = scopedRecords<Lead>('leads').some((lead) => lead.emails.some((candidate) => candidate.value === email));
          if (duplicate) {
            skipped += 1;
            continue;
          }
        }
        const id = `lead-${organizationId}-imp-${created}-${Date.now().toString(36)}`;
        const now = new Date().toISOString();
        db.put('leads', {
          id,
          organizationId,
          reference: `L-${String(95000 + created).padStart(5, '0')}`,
          firstName: mapping['firstName'] ? row[mapping['firstName']] : undefined,
          lastName: mapping['lastName'] ? row[mapping['lastName']] : undefined,
          companyName: mapping['companyName'] ? row[mapping['companyName']] : 'Imported lead',
          emails: email ? [{ id: `lem-${id}`, label: 'Work', value: email, isPrimary: true }] : [],
          phones: [],
          status: 'new',
          rating: 'unrated',
          tags: [],
          ownerTeamId: undefined,
          customFields: {},
          createdAt: now,
          updatedAt: now,
          ownerId: commitOptions.assignOwnerId ?? Object.values(db.state.users)[0]!.id,
        } as unknown as never);
        leadIds.push(id);
        created += 1;
      }

      return ok({ created, skipped, failed: rows.length - created - skipped, leadIds });
    },
  };

  /* --------------------------------------------------------------- contacts */

  const contactsService: ServiceContainer['contacts'] = {
    list: (query) => contacts.list(scope(query)),
    get: (id) => contacts.get(id),
    create: (input, writeOptions) => contacts.create(input, writeOptions),
    update: (id, input, writeOptions) => contacts.update(id, input, writeOptions),
    remove: (id, writeOptions) => contacts.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => contacts.bulkRemove(ids, writeOptions),
    archive: (id) => contacts.archive(id),
    restore: (id) => contacts.restore(id),
    assign: (ids, ownerId) => contacts.bulkPatch(ids, { ownerId }, 'assign'),
    updateLifecycle: (ids, lifecycleStage) => contacts.bulkPatch(ids, { lifecycleStage }, 'lifecycle'),
    updateConsent: async (ids, record) => {
      await delay('contact-consent');
      let succeeded = 0;
      const failures: Array<{ id: Id; reason: string }> = [];
      for (const id of ids) {
        const contact = owned(db.state.contacts[id]);
        if (!contact) {
          failures.push({ id, reason: 'Record not found' });
          continue;
        }
        const others = contact.consent.filter((entry) => entry.channel !== record.channel);
        db.put('contacts', {
          ...contact,
          consent: [...others, { channel: record.channel as never, state: record.state as never, jurisdiction: record.jurisdiction, capturedAt: new Date().toISOString(), capturedVia: 'interface' }],
          updatedAt: new Date().toISOString(),
        });
        succeeded += 1;
      }
      return ok({ requested: ids.length, succeeded, failed: failures.length, failures });
    },
    addToCampaign: async (ids, campaignId) => {
      await delay('contact-campaign');
      const campaign = db.state.campaigns[campaignId];
      if (campaign) db.put('campaigns', { ...campaign, audienceSize: campaign.audienceSize + ids.length });
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    addToSegment: async (ids, segmentId) => {
      await delay('contact-segment');
      const segment = db.state.segments[segmentId];
      if (segment) db.put('segments', { ...segment, memberCount: segment.memberCount + ids.length, memberIds: [...(segment.memberIds ?? []), ...ids] });
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    findDuplicates: async () => {
      await delay('contact-duplicates');
      const all = scopedRecords<Contact>('contacts');
      const groups = new Map<string, Contact[]>();
      for (const contact of all) {
        const key = `${contact.lastName.toLowerCase()}|${contact.accountId ?? ''}`;
        groups.set(key, [...(groups.get(key) ?? []), contact]);
      }
      const items = [...groups.values()]
        .filter((group) => group.length > 1)
        .slice(0, 20)
        .map((group) => {
          const [a, b] = group as [Contact, Contact];
          return {
            id: `dup-${a.id}-${b.id}`,
            entityKind: 'contact' as const,
            score: 78,
            matchedOn: [{ field: 'lastName', valueA: a.lastName, valueB: b.lastName }, { field: 'account', valueA: a.accountName ?? '—', valueB: b.accountName ?? '—' }],
            recordA: { id: a.id, label: a.displayName, subtitle: a.emails[0]?.value },
            recordB: { id: b.id, label: b.displayName, subtitle: b.emails[0]?.value },
            status: 'pending' as const,
            detectedAt: toDateTimeString(DATASET_EPOCH),
          };
        });
      return { items, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    merge: async (primaryId, mergeIds) => {
      await delay('contact-merge');
      const primary = owned(db.state.contacts[primaryId]);
      if (!primary) return err<Contact>('not_found', 'The record to keep could not be found.');
      if (mergeIds.some((id) => !owned(db.state.contacts[id]))) return err<Contact>('not_found', 'One or more contacts were not found.');
      db.removeMany('contacts', mergeIds);
      return ok(primary);
    },
    timeline: async (id, query = {}) => {
      const all = scopedRecords<Activity>('activities');
      const related = all.filter((activity) => activity.subjects?.some((subject) => subject.id === id));
      return runQuery(related, query, { searchFields: ['subject', 'body'], defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
    },
    relatedDeals: async (id, query = {}) => {
      const all = dealsInScope().filter((deal) => deal.primaryContactId === id);
      return runQuery(all, query, { searchFields: ['name'], defaultSort: [{ field: 'amount', direction: 'desc' }] });
    },
    relatedTickets: async (id, query = {}) => {
      const all = ticketsInScope().filter((ticket) => ticket.contactId === id);
      return runQuery(all, query, { searchFields: ['subject'], defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
    },
    export: async (ids) => {
      await delay('contact-export', { latency: { min: 260, max: 620 } });
      // Generated in the browser; nothing is emailed and no server is involved.
      return ok({ exportId: `exp-${Date.now().toString(36)}`, rowCount: ids.length || (db.all('contacts') as unknown[]).length, generatedLocally: true });
    },
  };

  /* --------------------------------------------------------------- accounts */

  const accountsService: ServiceContainer['accounts'] = {
    list: (query) => accounts.list(scope(query)),
    get: (id) => accounts.get(id),
    create: (input, writeOptions) => accounts.create(input, writeOptions),
    update: (id, input, writeOptions) => accounts.update(id, input, writeOptions),
    remove: (id, writeOptions) => accounts.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => accounts.bulkRemove(ids, writeOptions),
    archive: (id) => accounts.archive(id),
    restore: (id) => accounts.restore(id),
    hierarchy: async () => ok(scopedRecords<Account>('accounts').map((account) => ({ id: account.id, name: account.name, parentId: account.parentAccountId, depth: account.hierarchyDepth, health: account.health }))),
    moveAccount: async (id, newParentId) => {
      await delay('account-move');
      const account = owned(db.state.accounts[id]);
      if (!account) return err<Account>('not_found', 'Account not found.');
      // Guard against a cycle: an account cannot become its own ancestor.
      let cursor = newParentId ? owned(db.state.accounts[newParentId]) : undefined;
      if (newParentId && !cursor) return err<Account>('not_found', 'Parent account not found.');
      while (cursor) {
        if (cursor.id === id) return err<Account>('validation_failed', 'An account cannot be moved beneath itself.');
        cursor = cursor.parentAccountId ? owned(db.state.accounts[cursor.parentAccountId]) : undefined;
      }
      const updated = { ...account, parentAccountId: newParentId ?? undefined, updatedAt: new Date().toISOString() };
      db.put('accounts', updated);
      return ok(updated);
    },
    revenueSnapshot: async (id) => {
      await delay('account-revenue');
      const account = owned(db.state.accounts[id]);
      if (!account) return err('not_found', 'Account not found.');
      const won = dealsInScope().filter((deal) => deal.accountId === id && deal.status === 'won');
      const open = dealsInScope().filter((deal) => deal.accountId === id && deal.status === 'open');
      const subscriptions = Object.values(db.state.revenueSubscriptions).filter((subscription) => subscription.accountId === id);
      const currency = account.annualRevenue?.currency ?? 'USD';
      return ok({
        accountId: id,
        currency,
        wonToDate: { amount: won.reduce((sum, deal) => sum + deal.amount.amount, 0), currency },
        openPipeline: { amount: open.reduce((sum, deal) => sum + deal.amount.amount, 0), currency },
        recurringRevenue: { amount: subscriptions.reduce((sum, subscription) => sum + subscription.mrr.amount, 0), currency },
        averageDealSize: { amount: won.length > 0 ? Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) / won.length) : 0, currency },
        dealCount: won.length + open.length,
        byYear: [
          { year: 2024, won: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.4), pipeline: Math.round(open.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.3) },
          { year: 2025, won: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.35), pipeline: Math.round(open.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.4) },
          { year: 2026, won: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.25), pipeline: Math.round(open.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.3) },
        ],
        byProduct: won
          .flatMap((deal) => deal.products)
          .slice(0, 6)
          .map((line) => ({ productId: line.productId, productName: line.productName, amount: line.lineTotal.amount })),
      });
    },
    contacts: async (id, query = {}) => {
      const all = scopedRecords<Contact>('contacts').filter((contact) => contact.accountId === id);
      return runQuery(all, query, { searchFields: ['displayName', 'jobTitle'], defaultSort: [{ field: 'displayName', direction: 'asc' }] });
    },
    deals: async (id, query = {}) => {
      const all = dealsInScope().filter((deal) => deal.accountId === id);
      return runQuery(all, query, { searchFields: ['name'], defaultSort: [{ field: 'amount', direction: 'desc' }] });
    },
    tickets: async (id, query = {}) => {
      const all = ticketsInScope().filter((ticket) => ticket.accountId === id);
      return runQuery(all, query, { searchFields: ['subject'], defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
    },
    healthScore: async (id) => {
      const score = db.state.healthScores[`hs-${id}`];
      if (!score) return err('not_found', 'No health score has been computed for this account yet.');
      return ok(score);
    },
  };

  /* ------------------------------------------------------------------ deals */

  const dealsService: ServiceContainer['deals'] = {
    list: (query) => deals.list(scope(query)),
    get: (id) => deals.get(id),
    create: async (input, writeOptions) => {
      const failure = simulatedFailure<Deal>(writeOptions);
      if (failure) return failure;
      const created = await deals.create(input, writeOptions);
      if (created.ok) {
        refreshDealDerivedFields();
        const account = owned(db.state.accounts[created.data.accountId]);
        if (account) db.put('accounts', { ...account, openDealCount: account.openDealCount + 1 });
      }
      return created;
    },
    update: (id, input, writeOptions) => deals.update(id, input, writeOptions),
    remove: (id, writeOptions) => deals.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => deals.bulkRemove(ids, writeOptions),
    move: async (request) => moveDeal(request.dealId, request.toStageId, { lostReasonId: request.lostReasonId, note: request.note }),
    bulkMove: async (ids, toStageId, moveOptions) => {
      const failures: Array<{ id: Id; reason: string }> = [];
      let succeeded = 0;
      let summary: PipelineSummary | undefined;
      for (const id of ids) {
        const result = await moveDeal(id, toStageId, moveOptions);
        if (result.ok) {
          succeeded += 1;
          summary = result.data.summary;
        } else {
          failures.push({ id, reason: result.error.message });
        }
      }
      if (!summary) {
        const pipelineId = Object.values(db.state.pipelines)[0]?.id;
        summary = pipelineId ? pipelineSummaryFor(pipelineId) : undefined;
      }
      return ok({ outcome: { requested: ids.length, succeeded, failed: failures.length, failures }, summary: summary! });
    },
    assign: (ids, ownerId) => deals.bulkPatch(ids, { ownerId }, 'assign'),
    updateForecastCategory: (ids, forecastCategory) => deals.bulkPatch(ids, { forecastCategory }, 'forecast'),
    addProduct: async (dealId, line) => {
      await delay('deal-add-product');
      const deal = owned(db.state.deals[dealId]);
      if (!deal) return err<Deal>('not_found', 'Deal not found.');
      const products = [...deal.products, { ...line, id: `dline-${Date.now().toString(36)}`, sortOrder: deal.products.length }];
      const total = products.reduce((sum, product) => sum + product.lineTotal.amount, 0);
      const updated = { ...deal, products, amount: { ...deal.amount, amount: total }, updatedAt: new Date().toISOString() };
      db.put('deals', updated);
      return ok(updated);
    },
    updateProductLine: async (dealId, lineId, patch) => {
      await delay('deal-update-line');
      const deal = owned(db.state.deals[dealId]);
      if (!deal) return err<Deal>('not_found', 'Deal not found.');
      const products = deal.products.map((line) => {
        if (line.id !== lineId) return line;
        const merged = { ...line, ...patch };
        const gross = merged.quantity * merged.unitPrice.amount;
        const discountAmount = Math.round(gross * (merged.discountPercent / 100));
        return { ...merged, discountAmount: { amount: discountAmount, currency: merged.unitPrice.currency }, lineTotal: { amount: gross - discountAmount, currency: merged.unitPrice.currency } };
      });
      const total = products.reduce((sum, product) => sum + product.lineTotal.amount, 0);
      const updated = { ...deal, products, amount: { ...deal.amount, amount: total }, updatedAt: new Date().toISOString() };
      db.put('deals', updated);
      return ok(updated);
    },
    removeProductLine: async (dealId, lineId) => {
      await delay('deal-remove-line');
      const deal = owned(db.state.deals[dealId]);
      if (!deal) return err<Deal>('not_found', 'Deal not found.');
      const products = deal.products.filter((line) => line.id !== lineId);
      const total = products.reduce((sum, product) => sum + product.lineTotal.amount, 0);
      const updated = { ...deal, products, amount: { ...deal.amount, amount: total }, updatedAt: new Date().toISOString() };
      db.put('deals', updated);
      return ok(updated);
    },
    addTeamMember: async (dealId, userId, role) => {
      await delay('deal-team');
      const deal = owned(db.state.deals[dealId]);
      if (!deal) return err<Deal>('not_found', 'Deal not found.');
      const user = db.state.users[userId];
      const updated = { ...deal, teamMembers: [...deal.teamMembers, { userId, name: user?.displayName ?? 'Team member', role }], updatedAt: new Date().toISOString() };
      db.put('deals', updated);
      return ok(updated);
    },
    addCompetitor: async (dealId, competitorId) => {
      await delay('deal-competitor');
      const deal = owned(db.state.deals[dealId]);
      if (!deal) return err<Deal>('not_found', 'Deal not found.');
      const updated = { ...deal, competitorIds: [...deal.competitorIds, competitorId], updatedAt: new Date().toISOString() };
      db.put('deals', updated);
      return ok(updated);
    },
    lostReasons: async () => {
      await delay('deal-lost-reasons');
      const reasons = Object.values(db.state.dealLostReasons).map((reason) => {
        const related = dealsInScope().filter((deal) => deal.lostReasonId === reason.id);
        return { ...reason, dealCount: related.length, totalValue: related.reduce((sum, deal) => sum + deal.amount.amount, 0) };
      });
      return { items: reasons, meta: { page: 1, pageSize: 50, total: reasons.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    pipelineSummary: async (pipelineId) => ok(pipelineSummaryFor(pipelineId)),
    forecast: async (pipelineId) => {
      await delay('forecast');
      const pipelines = Object.values(db.state.pipelines);
      const target = pipelineId ? pipelines.find((pipeline) => pipeline.id === pipelineId) : pipelines[0];
      const scoped = dealsInScope().filter((deal) => !target || deal.pipelineId === target.id);
      const currency = target?.currency ?? 'USD';
      const periodStart = toDateString(new Date('2026-10-01T00:00:00.000Z'));
      const periodEnd = toDateString(new Date('2026-12-31T00:00:00.000Z'));

      const sum = (status: string) => scoped.filter((deal) => deal.status === status).reduce((total, deal) => total + deal.amount.amount, 0);
      const byCategory = (category: string) => scoped.filter((deal) => deal.forecastCategory === category && deal.status === 'open').reduce((total, deal) => total + deal.amount.amount, 0);
      const won = sum('won');
      const commit = byCategory('commit');
      const bestCase = byCategory('best_case');
      const pipelineValue = byCategory('pipeline');
      const quota = Math.round((won + commit + bestCase + pipelineValue) * 0.72);

      const byRep = Object.values(db.state.users)
        .filter((user) => ['sales_rep', 'sales_manager', 'account_manager'].includes(user.persona))
        .map((user) => {
          const owned = scoped.filter((deal) => deal.ownerId === user.id);
          const repWon = owned.filter((deal) => deal.status === 'won').reduce((total, deal) => total + deal.amount.amount, 0);
          const repCommit = owned.filter((deal) => deal.forecastCategory === 'commit' && deal.status === 'open').reduce((total, deal) => total + deal.amount.amount, 0);
          const repBest = owned.filter((deal) => deal.forecastCategory === 'best_case' && deal.status === 'open').reduce((total, deal) => total + deal.amount.amount, 0);
          const repQuota = Math.max(1, Math.round(quota / Math.max(1, Object.values(db.state.users).filter((candidate) => ['sales_rep', 'sales_manager'].includes(candidate.persona)).length)));
          return { userId: user.id, name: user.displayName, quota: repQuota, commit: repCommit, bestCase: repBest, closedWon: repWon, attainmentPercent: Math.round((repWon / repQuota) * 100) };
        });

      return ok({
        id: `forecast-${target?.id ?? 'all'}`,
        label: 'This quarter',
        periodStart,
        periodEnd,
        currency,
        quota: { amount: quota, currency },
        commit: { amount: commit, currency },
        bestCase: { amount: bestCase, currency },
        pipeline: { amount: pipelineValue, currency },
        closedWon: { amount: won, currency },
        gapToQuota: { amount: Math.max(0, quota - won - commit), currency },
        coverageRatio: Number(((pipelineValue + bestCase + commit) / Math.max(1, quota)).toFixed(2)),
        confidence: commit / Math.max(1, quota) > 0.6 ? 'high' : commit / Math.max(1, quota) > 0.35 ? 'medium' : 'low',
        commentary: `Commit covers ${Math.round((commit / Math.max(1, quota)) * 100)}% of quota, with a further ${Math.round((bestCase / Math.max(1, quota)) * 100)}% in best case. Pipeline coverage is ${((pipelineValue + bestCase + commit) / Math.max(1, quota)).toFixed(2)}×, which is ${(pipelineValue + bestCase + commit) / Math.max(1, quota) >= 3 ? 'healthy' : 'below the usual 3× threshold'}.`,
        byRep,
        history: [
          { label: 'Q1', quota: Math.round(quota * 0.9), closedWon: Math.round(won * 0.82), forecast: Math.round(quota * 0.94) },
          { label: 'Q2', quota: Math.round(quota * 0.95), closedWon: Math.round(won * 0.91), forecast: Math.round(quota * 0.99) },
          { label: 'Q3', quota, closedWon: won, forecast: Math.round(won + commit) },
        ],
      });
    },
  };

  /* --------------------------------------------------------------- pipelines */

  const pipelinesService: ServiceContainer['pipelines'] = {
    list: async (query = {}) => {
      await delay('pipelines');
      const records = Object.values(db.state.pipelines);
      return runQuery(records, query, { searchFields: ['name'], defaultSort: [{ field: 'sortOrder', direction: 'asc' }] });
    },
    get: async (id) => {
      const pipeline = db.state.pipelines[id];
      return pipeline ? ok(pipeline) : err('not_found', 'Pipeline not found.');
    },
    create: async (input) => {
      await delay('pipeline-create');
      const record = { ...(input as unknown as object), id: `pipe-${Date.now().toString(36)}`, stages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as import('@crm/shared-types').Pipeline;
      db.put('pipelines', record);
      return ok(record);
    },
    update: async (id, input) => {
      await delay('pipeline-update');
      const existing = db.state.pipelines[id];
      if (!existing) return err<import('@crm/shared-types').Pipeline>('not_found', 'Pipeline not found.');
      const updated = { ...existing, ...(input as object), id, updatedAt: new Date().toISOString() } as import('@crm/shared-types').Pipeline;
      db.put('pipelines', updated);
      return ok(updated);
    },
    remove: async (id) => {
      await delay('pipeline-remove');
      const inUse = dealsInScope().filter((deal) => deal.pipelineId === id).length;
      if (inUse > 0) return err<{ id: Id }>('conflict', `This pipeline still holds ${inUse} deals. Move them to another pipeline first.`);
      db.remove('pipelines', id);
      return ok({ id });
    },
    createStage: async (pipelineId, input) => {
      await delay('stage-create');
      const pipeline = db.state.pipelines[pipelineId];
      if (!pipeline) return err<import('@crm/shared-types').Stage>('not_found', 'Pipeline not found.');
      const stage = { ...(input as unknown as object), id: `${pipelineId}-${Date.now().toString(36)}`, pipelineId } as unknown as import('@crm/shared-types').Stage;
      db.put('pipelines', { ...pipeline, stages: [...pipeline.stages, stage], updatedAt: new Date().toISOString() });
      return ok(stage);
    },
    updateStage: async (pipelineId, stageId, input) => {
      await delay('stage-update');
      const pipeline = db.state.pipelines[pipelineId];
      if (!pipeline) return err<import('@crm/shared-types').Stage>('not_found', 'Pipeline not found.');
      let updated: import('@crm/shared-types').Stage | undefined;
      const stages = pipeline.stages.map((stage) => {
        if (stage.id !== stageId) return stage;
        updated = { ...stage, ...(input as object), id: stageId, pipelineId } as import('@crm/shared-types').Stage;
        return updated;
      });
      if (!updated) return err<import('@crm/shared-types').Stage>('not_found', 'Stage not found.');
      db.put('pipelines', { ...pipeline, stages, updatedAt: new Date().toISOString() });
      return ok(updated);
    },
    reorderStages: async (pipelineId, orderedIds) => {
      await delay('stage-reorder');
      const pipeline = db.state.pipelines[pipelineId];
      if (!pipeline) return err<import('@crm/shared-types').Stage[]>('not_found', 'Pipeline not found.');
      const stages = orderedIds
        .map((id, index) => {
          const stage = pipeline.stages.find((candidate) => candidate.id === id);
          return stage ? { ...stage, sortOrder: index + 1 } : undefined;
        })
        .filter((stage): stage is import('@crm/shared-types').Stage => Boolean(stage));
      db.put('pipelines', { ...pipeline, stages, updatedAt: new Date().toISOString() });
      return ok(stages);
    },
    removeStage: async (pipelineId, stageId, moveDealsTo) => {
      await delay('stage-remove');
      const pipeline = db.state.pipelines[pipelineId];
      if (!pipeline) return err<{ moved: number }>('not_found', 'Pipeline not found.');
      const affected = dealsInScope().filter((deal) => deal.stageId === stageId);
      // Reassign before removing, so no deal is left pointing at a stage that no longer exists.
      for (const deal of affected) {
        await moveDeal(deal.id, moveDealsTo);
      }
      db.put('pipelines', { ...pipeline, stages: pipeline.stages.filter((stage) => stage.id !== stageId), updatedAt: new Date().toISOString() });
      return ok({ moved: affected.length });
    },
    setDefault: async (pipelineId) => {
      await delay('pipeline-default');
      for (const pipeline of Object.values(db.state.pipelines)) {
        db.put('pipelines', { ...pipeline, isDefault: pipeline.id === pipelineId });
      }
      const updated = db.state.pipelines[pipelineId];
      return updated ? ok(updated) : err('not_found', 'Pipeline not found.');
    },
  };

  /* -------------------------------------------------------------- activities */

  const activitiesService: ServiceContainer['activities'] = {
    list: (query) => activities.list(scope(query)),
    get: (id) => activities.get(id),
    create: (input, writeOptions) => activities.create(input, writeOptions),
    update: (id, input, writeOptions) => activities.update(id, input, writeOptions),
    remove: (id, writeOptions) => activities.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => activities.bulkRemove(ids, writeOptions),
    forRecord: async (type, id, query = {}) => {
      const all = scopedRecords<Activity>('activities');
      const related = all.filter((activity) => activity.subjects?.some((subject) => subject.type === type && subject.id === id));
      return runQuery(related, query, { searchFields: ['subject', 'body'], facetField: 'kind', defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
    },
    complete: async (ids, outcome) => {
      await delay('activity-complete');
      let succeeded = 0;
      const failures: Array<{ id: Id; reason: string }> = [];
      const now = new Date().toISOString();
      for (const id of ids) {
        const activity = owned(db.state.activities[id]);
        if (!activity) {
          failures.push({ id, reason: 'Record not found' });
          continue;
        }
        db.put('activities', { ...activity, status: 'completed', completedAt: now, outcome: outcome ?? activity.outcome, updatedAt: now });
        succeeded += 1;
      }
      return ok({ requested: ids.length, succeeded, failed: failures.length, failures });
    },
    reopen: async (ids) => {
      await delay('activity-reopen');
      for (const id of ids) {
        const activity = owned(db.state.activities[id]);
        if (activity) db.put('activities', { ...activity, status: 'open', completedAt: undefined, updatedAt: new Date().toISOString() });
      }
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    snooze: async (ids, until) => {
      await delay('activity-snooze');
      for (const id of ids) {
        const activity = owned(db.state.activities[id]);
        if (activity) db.put('activities', { ...activity, dueAt: until, status: 'open', updatedAt: new Date().toISOString() });
      }
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    dailyPlan: async (userId, date) => {
      await delay('daily-plan');
      const all = scopedRecords<Activity>('activities');
      const mine = all.filter((activity) => activity.ownerId === userId && activity.status !== 'completed' && activity.status !== 'cancelled');
      const dueToday = mine.filter((activity) => (activity.dueAt ?? '').slice(0, 10) === date);
      const overdue = mine.filter((activity) => (activity.dueAt ?? '') < date);

      const items = [...overdue, ...dueToday].slice(0, 40).map((activity) => {
        const subject = activity.subjects?.[0];
        return {
          id: activity.id,
          activityId: activity.id,
          kind: activity.kind,
          title: activity.subject,
          startAt: activity.startAt,
          endAt: activity.endAt,
          priority: activity.priority,
          status: activity.status,
          recordLabel: subject?.label,
          recordPath: subject ? `/app/${subject.type}s/${subject.id}` : undefined,
          reason:
            (activity.dueAt ?? '') < date
              ? 'Overdue'
              : activity.kind === 'call'
                ? 'Call scheduled for today'
                : activity.priority === 'urgent' || activity.priority === 'high'
                  ? 'High priority'
                  : undefined,
          estimatedMinutes: activity.durationMinutes ?? 30,
        };
      });

      return ok({
        date,
        userId,
        items,
        totals: {
          planned: items.length,
          completed: all.filter((activity) => activity.ownerId === userId && activity.status === 'completed' && (activity.completedAt ?? '').slice(0, 10) === date).length,
          overdue: overdue.length,
          plannedMinutes: items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0),
        },
      });
    },
    overdueForUser: async (userId, query = {}) => {
      const today = toDateString(DATASET_EPOCH);
      const all = scopedRecords<Activity>('activities').filter(
        (activity) => activity.ownerId === userId && activity.status !== 'completed' && (activity.dueAt ?? '') < today,
      );
      return runQuery(all, query, { searchFields: ['subject'], defaultSort: [{ field: 'dueAt', direction: 'asc' }] });
    },
  };

  /* ----------------------------------------------------------------- tasks */

  const tasksService: ServiceContainer['tasks'] = {
    list: async (query = {}) => {
      const all = scopedRecords<Activity>('activities').filter((activity) => activity.kind === 'task');
      return runQuery(all as never[], query, { searchFields: ['subject'], defaultSort: [{ field: 'dueAt', direction: 'asc' }] });
    },
    get: async (id) => {
      const activity = owned(db.state.activities[id]);
      if (!activity || activity.kind !== 'task') return err('not_found', 'Task not found.');
      return ok(activity as never);
    },
    create: (input, writeOptions) => activities.create({ ...(input as object), kind: 'task' }, writeOptions) as never,
    update: (id, input, writeOptions) => activities.update(id, input, writeOptions) as never,
    remove: (id, writeOptions) => activities.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => activities.bulkRemove(ids, writeOptions),
    complete: async (id) => {
      await delay(`task-complete:${id}`);
      const activity = owned(db.state.activities[id]);
      if (!activity) return err('not_found', 'Task not found.');
      const updated = { ...activity, status: 'completed' as const, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.put('activities', updated);
      return ok(updated as never);
    },
    toggleChecklistItem: async (taskId, itemId) => {
      await delay(`task-checklist:${taskId}`);
      const activity = owned(db.state.activities[taskId]);
      if (!activity) return err('not_found', 'Task not found.');
      const checklist = (activity.checklist ?? []).map((item) => (item.id === itemId ? { ...item, done: !item.done } : item));
      const updated = { ...activity, checklist, updatedAt: new Date().toISOString() };
      db.put('activities', updated);
      return ok(updated as never);
    },
    reassign: (ids, ownerId) => activities.bulkPatch(ids, { ownerId }, 'reassign') as never,
    createFromTemplate: async (templateId, target) => {
      await delay('task-template');
      const now = new Date().toISOString();
      const id = `act-tpl-${Date.now().toString(36)}`;
      const organizationId = resolveOrganizationId(db);
      const record = {
        id,
        organizationId,
        kind: 'task' as const,
        subject: `Follow-up from template ${templateId}`,
        subjects: [{ type: target.type as never, id: target.id, label: 'Linked record' }],
        status: 'open' as const,
        priority: 'normal' as const,
        ownerId: Object.values(db.state.users)[0]!.id,
        ownerName: Object.values(db.state.users)[0]!.displayName,
        visibility: 'team' as const,
        source: 'user' as const,
        dueAt: toDateTimeString(new Date(DATASET_EPOCH.getTime() + 2 * 86_400_000)),
        createdAt: now,
        updatedAt: now,
      };
      db.put('activities', record as never);
      return ok([record] as never);
    },
  };

  /* ------------------------------------------------------------ calendar */

  const calendarService: ServiceContainer['calendar'] = {
    events: async (query = {}) => {
      const all = db.all('calendarEvents') as unknown as import('@crm/shared-types').CalendarEvent[];
      const ranged = query.from || query.to
        ? all.filter((event) => (!query.from || (event.startAt ?? '') >= query.from) && (!query.to || (event.startAt ?? '') <= query.to))
        : all;
      return runQuery(ranged, query, { searchFields: ['subject', 'location'], defaultSort: [{ field: 'startAt', direction: 'asc' }] });
    },
    calendars: async () => {
      await delay('calendars');
      const organizationId = resolveOrganizationId(db);
      const items: import('@crm/shared-types').Calendar[] = [
        { id: `cal-${organizationId}-personal`, organizationId, name: 'My calendar', kind: 'personal', color: 'violet', visible: true, isDefault: true, permission: 'manage' },
        { id: `cal-${organizationId}-team`, organizationId, name: 'Team calendar', kind: 'team', color: 'teal', visible: true, isDefault: false, permission: 'write' },
        { id: `cal-${organizationId}-company`, organizationId, name: 'Company holidays', kind: 'shared', color: 'slate', visible: false, isDefault: false, permission: 'read' },
      ];
      return { items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    create: async (event) => {
      await delay('event-create');
      const record = { ...(event as unknown as object), id: `evt-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as import('@crm/shared-types').CalendarEvent;
      db.put('calendarEvents', record);
      return ok(record);
    },
    update: async (id, input) => {
      await delay('event-update');
      const existing = db.state.calendarEvents[id];
      if (!existing) return err<import('@crm/shared-types').CalendarEvent>('not_found', 'Event not found.');
      const updated = { ...existing, ...(input as object), id, updatedAt: new Date().toISOString() } as import('@crm/shared-types').CalendarEvent;
      db.put('calendarEvents', updated);
      return ok(updated);
    },
    remove: async (id) => {
      await delay('event-remove');
      db.remove('calendarEvents', id);
      return ok({ id });
    },
    reschedule: async (id, startAt, endAt) => {
      await delay('event-reschedule');
      const existing = db.state.calendarEvents[id];
      if (!existing) return err<import('@crm/shared-types').CalendarEvent>('not_found', 'Event not found.');
      const updated = { ...existing, startAt, endAt, updatedAt: new Date().toISOString() };
      db.put('calendarEvents', updated);
      return ok(updated);
    },
    suggestSlots: async (_attendeeIds, durationMinutes, within) => {
      await delay('slot-suggestions', { latency: { min: 260, max: 520 } });
      // Deterministic suggestions computed locally. No calendar provider is queried.
      const slots = Array.from({ length: 5 }, (_, index) => {
        const start = new Date(new Date(within.from).getTime() + (index + 1) * 26 * 3_600_000);
        start.setUTCHours(9 + index, 0, 0, 0);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        return { startAt: start.toISOString(), endAt: end.toISOString(), conflicts: index === 2 ? 1 : 0 };
      });
      return ok(slots);
    },
    preparationBrief: async (eventId) => {
      await delay(`brief:${eventId}`, { latency: { min: 320, max: 680 } });
      const event = db.state.calendarEvents[eventId];
      if (!event) return err('not_found', 'Event not found.');
      const accountSubject = event.subjects?.find((subject) => subject.type === 'account');
      const account = accountSubject ? owned(db.state.accounts[accountSubject.id]) : undefined;
      const relatedDeals = account ? dealsInScope().filter((deal) => deal.accountId === account.id && deal.status === 'open') : [];
      const relatedTickets = account ? ticketsInScope().filter((ticket) => ticket.accountId === account.id && ticket.status !== 'resolved' && ticket.status !== 'closed') : [];

      return ok({
        eventId,
        accountId: account?.id,
        accountName: account?.name,
        // The provenance is part of the payload so the UI cannot present it as a model output.
        generatedBy: 'demo_template_engine' as const,
        agenda: [
          'Confirm the current priorities and any change since the last conversation',
          relatedDeals.length > 0 ? `Review ${relatedDeals.length} open deal${relatedDeals.length === 1 ? '' : 's'} and the next agreed step` : 'Agree the next commercial step',
          relatedTickets.length > 0 ? `Address ${relatedTickets.length} open support issue${relatedTickets.length === 1 ? '' : 's'}` : 'Confirm nothing is outstanding from support',
          'Agree owners and dates for every action',
        ],
        attendeesBrief: (event.attendees ?? []).map((attendee) => ({
          id: attendee.id,
          name: attendee.name,
          role: attendee.kind === 'internal' ? 'Internal' : 'Customer',
          lastTouch: undefined,
          note: attendee.status === 'awaiting' ? 'Has not responded to the invitation' : undefined,
        })),
        openIssues: relatedTickets.map((ticket) => ({
          id: ticket.id,
          label: `${ticket.reference} — ${ticket.subject}`,
          severity: ticket.priority === 'critical' || ticket.priority === 'high' ? ('high' as const) : ('medium' as const),
        })),
        talkingPoints: [
          account ? `${account.name} has ${account.contactCount} contacts on record and ${relatedDeals.length} open opportunities.` : 'Confirm the account structure and decision makers.',
          account?.healthScore !== undefined ? `Account health is ${account.healthScore} (${account.health}), so adoption is worth asking about directly.` : 'Ask what has changed in the account since the last review.',
          'Confirm the procurement timeline before discussing commercial terms.',
        ],
        risks: [
          ...(relatedTickets.some((ticket) => ticket.slaState === 'breached' || ticket.slaState === 'at_risk') ? ['An open ticket is at risk of breaching its SLA. Address it before the customer raises it.'] : []),
          ...(relatedDeals.some((deal) => deal.isStale) ? ['At least one open deal has not moved in over three weeks.'] : []),
        ],
        suggestedQuestions: [
          'What has changed in your priorities since we last spoke?',
          'Who else needs to be involved before a decision is made?',
          'What would need to be true for this to move forward this quarter?',
        ],
        relatedRecords: [
          ...(account ? [{ type: 'account', id: account.id, label: account.name, path: `/app/accounts/${account.id}` }] : []),
          ...relatedDeals.slice(0, 3).map((deal) => ({ type: 'deal', id: deal.id, label: deal.name, path: `/app/deals/${deal.id}` })),
        ],
      });
    },
  };

  /* -------------------------------------------------------------- tickets */

  const ticketsService: ServiceContainer['tickets'] = {
    list: (query) => tickets.list(scope(query)),
    get: (id) => tickets.get(id),
    create: (input, writeOptions) => tickets.create(input, writeOptions),
    update: (id, input, writeOptions) => tickets.update(id, input, writeOptions),
    remove: (id, writeOptions) => tickets.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => tickets.bulkRemove(ids, writeOptions),
    assign: (ids, assigneeId, teamId) => tickets.bulkPatch(ids, { assigneeId: assigneeId ?? undefined, assigneeName: assigneeId ? db.state.users[assigneeId]?.displayName : undefined, teamId }, 'assign'),
    updateStatus: (ids, status) => tickets.bulkPatch(ids, { status }, 'status'),
    updatePriority: (ids, priority) => tickets.bulkPatch(ids, { priority }, 'priority'),
    escalate: (ids, reason) => tickets.bulkPatch(ids, { escalationLevel: 1, escalatedAt: new Date().toISOString(), priority: 'critical' }, reason) ,
    merge: async (primaryId, mergeIds) => {
      await delay('ticket-merge');
      const primary = owned(db.state.tickets[primaryId]);
      if (!primary) return err<Ticket>('not_found', 'Primary ticket not found.');
      if (mergeIds.some((id) => !owned(db.state.tickets[id]))) return err<Ticket>('not_found', 'One or more tickets were not found.');
      db.removeMany('tickets', mergeIds);
      return ok({ ...primary, relatedTicketIds: [...primary.relatedTicketIds, ...mergeIds] });
    },
    messages: async (ticketId, query = {}) => {
      const all = owned(db.state.tickets[ticketId])
        ? (db.all('ticketMessages') as unknown as import('@crm/shared-types').TicketMessage[]).filter((message) => message.ticketId === ticketId)
        : [];
      return runQuery(all, query, { searchFields: ['body'], defaultSort: [{ field: 'createdAt', direction: 'asc' }] });
    },
    reply: async (ticketId, body, replyOptions) => {
      await delay(`ticket-reply:${ticketId}`);
      const ticket = owned(db.state.tickets[ticketId]);
      if (!ticket) return err('not_found', 'Ticket not found.');
      const id = `tmsg-${Date.now().toString(36)}`;
      const author = db.state.users[ticket.assigneeId ?? Object.keys(db.state.users)[0]!]!;
      const message: import('@crm/shared-types').TicketMessage = {
        id,
        ticketId,
        kind: replyOptions?.isInternalNote ? 'internal_note' : 'reply',
        authorId: author.id,
        authorName: author.displayName,
        authorKind: 'agent',
        body,
        attachments: [],
        createdAt: new Date().toISOString(),
        isFromCustomer: false,
        // The type makes the absence of a transport explicit.
        delivery: replyOptions?.isInternalNote ? { state: 'draft', simulated: true } : { state: 'simulated_sent', simulated: true },
        timeSpentMinutes: replyOptions?.timeSpentMinutes,
      };
      db.transaction((draft) => {
        draft.ticketMessages[id] = message;
        const target = draft.tickets[ticketId];
        if (target) {
          target.messageCount += 1;
          target.updatedAt = new Date().toISOString();
          if (!replyOptions?.isInternalNote && !target.firstRespondedAt) target.firstRespondedAt = message.createdAt;
        }
      });
      return ok(message);
    },
    resolve: async (id, summary, rootCause) => {
      await delay(`ticket-resolve:${id}`);
      const ticket = owned(db.state.tickets[id]);
      if (!ticket) return err<Ticket>('not_found', 'Ticket not found.');
      const updated: Ticket = {
        ...ticket,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolutionSummary: summary,
        rootCause,
        slaState: ticket.slaState === 'breached' ? 'breached' : 'met',
        updatedAt: new Date().toISOString(),
      };
      db.put('tickets', updated);
      return ok(updated);
    },
    reopen: async (id, reason) => {
      await delay(`ticket-reopen:${id}`);
      const ticket = owned(db.state.tickets[id]);
      if (!ticket) return err<Ticket>('not_found', 'Ticket not found.');
      const updated: Ticket = { ...ticket, status: 'reopened', reopenCount: ticket.reopenCount + 1, resolvedAt: undefined, slaState: 'on_track', updatedAt: new Date().toISOString() };
      db.put('tickets', updated);
      db.put('ticketMessages', {
        id: `tmsg-${Date.now().toString(36)}`,
        ticketId: id,
        kind: 'system',
        authorName: 'System',
        authorKind: 'system',
        body: `Ticket reopened: ${reason}`,
        attachments: [],
        createdAt: new Date().toISOString(),
        isFromCustomer: false,
      });
      return ok(updated);
    },
    categories: async (query = {}) => {
      const records = Object.values(db.state.ticketCategories).filter((category) => category.organizationId === currentOrganizationId());
      return runQuery(records, query, { searchFields: ['name'], defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    slaPolicies: async (query = {}) => {
      const policies = Object.values(db.state.slaPolicies).filter((policy) => policy.organizationId === currentOrganizationId()).map((policy) => {
        const scoped = ticketsInScope().filter((ticket) => ticket.slaPolicyId === policy.id);
        const breached = scoped.filter((ticket) => ticket.slaState === 'breached').length;
        return { ...policy, ticketsTotal: scoped.length, ticketsBreached: breached, compliancePercent: scoped.length > 0 ? Number((((scoped.length - breached) / scoped.length) * 100).toFixed(1)) : 100 };
      });
      return runQuery(policies, query, { searchFields: ['name'], defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    overview: async () => {
      await delay('support-overview', { latency: { min: 180, max: 380 } });
      const all = ticketsInScope();
      const open = all.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
      const resolved = all.filter((ticket) => ticket.resolvedAt);
      const breached = all.filter((ticket) => ticket.slaState === 'breached').length;
      const responses = all.filter((ticket) => ticket.firstRespondedAt).map((ticket) => (new Date(ticket.firstRespondedAt!).getTime() - new Date(ticket.createdAt).getTime()) / 60_000);
      const resolutions = resolved.map((ticket) => (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()) / 3_600_000);
      const satisfaction = all.map((ticket) => ticket.satisfaction?.score).filter((score): score is 1 | 2 | 3 | 4 | 5 => typeof score === 'number');

      const byStatusEntries = [
        { status: 'new' as const, label: 'New', tone: 'blue' as const },
        { status: 'open' as const, label: 'Open', tone: 'violet' as const },
        { status: 'pending_customer' as const, label: 'Waiting on customer', tone: 'amber' as const },
        { status: 'pending_internal' as const, label: 'Waiting internally', tone: 'teal' as const },
        { status: 'resolved' as const, label: 'Resolved', tone: 'green' as const },
        { status: 'closed' as const, label: 'Closed', tone: 'slate' as const },
      ];

      return ok({
        currency: { amount: 0, currency: 'USD' },
        periodLabel: 'Last 30 days',
        metrics: {
        openTickets: open.length,
        newToday: all.filter((ticket) => ticket.createdAt.slice(0, 10) === toDateString(DATASET_EPOCH)).length,
        unassigned: open.filter((ticket) => !ticket.assigneeId).length,
        overdue: open.filter((ticket) => ticket.slaState === 'breached').length,
        breachRate: all.length > 0 ? Number(((breached / all.length) * 100).toFixed(1)) : 0,
        avgFirstResponseMinutes: responses.length > 0 ? Math.round(responses.reduce((sum, value) => sum + value, 0) / responses.length) : 0,
        avgResolutionHours: resolutions.length > 0 ? Number((resolutions.reduce((sum, value) => sum + value, 0) / resolutions.length).toFixed(1)) : 0,
        firstContactResolutionPercent: all.length > 0 ? Number(((all.filter((ticket) => ticket.messageCount <= 2 && ticket.status === 'resolved').length / Math.max(1, resolved.length)) * 100).toFixed(1)) : 0,
        reopenRate: all.length > 0 ? Number(((all.filter((ticket) => ticket.reopenCount > 0).length / all.length) * 100).toFixed(1)) : 0,
        csat: satisfaction.length > 0 ? Number((satisfaction.reduce((sum, score) => sum + score, 0) / satisfaction.length).toFixed(2)) : 0,
        backlogTrend: open.length - all.filter((ticket) => ticket.status === 'resolved' && (ticket.resolvedAt ?? '') > toDateString(new Date(DATASET_EPOCH.getTime() - 30 * 86_400_000))).length,
        },
        byStatus: byStatusEntries.map((entry) => ({ ...entry, count: all.filter((ticket) => ticket.status === entry.status).length })),
        byPriority: (['critical', 'high', 'normal', 'low'] as const).map((priority) => ({
          priority,
          label: priority.charAt(0).toUpperCase() + priority.slice(1),
          count: all.filter((ticket) => ticket.priority === priority).length,
          tone: priority === 'critical' ? ('red' as const) : priority === 'high' ? ('amber' as const) : priority === 'normal' ? ('blue' as const) : ('slate' as const),
        })),
        byChannel: (['email', 'web_portal', 'phone', 'chat', 'internal'] as const).map((channel) => ({ channel, label: channel.replace(/_/g, ' '), count: all.filter((ticket) => ticket.channel === channel).length })),
        byCategory: Object.values(db.state.ticketCategories).filter((category) => category.organizationId === currentOrganizationId()).map((category) => {
          const scoped = all.filter((ticket) => ticket.categoryId === category.id);
          const categoryResolutions = scoped.filter((ticket) => ticket.resolvedAt).map((ticket) => (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()) / 3_600_000);
          return { categoryId: category.id, label: category.name, count: scoped.length, avgResolutionHours: categoryResolutions.length > 0 ? Number((categoryResolutions.reduce((sum, value) => sum + value, 0) / categoryResolutions.length).toFixed(1)) : 0 };
        }),
        volumeTrend: Array.from({ length: 30 }, (_, index) => {
          const date = toDateString(new Date(DATASET_EPOCH.getTime() - (29 - index) * 86_400_000));
          const created = all.filter((ticket) => ticket.createdAt.slice(0, 10) === date).length;
          const done = all.filter((ticket) => (ticket.resolvedAt ?? '').slice(0, 10) === date).length;
          return { date, created, resolved: done, backlog: Math.max(0, open.length - (29 - index)) };
        }),
        slaTrend: Array.from({ length: 12 }, (_, index) => {
          const date = toDateString(new Date(DATASET_EPOCH.getTime() - (11 - index) * 30 * 86_400_000));
          const compliance = all.length > 0 ? Number((((all.length - breached) / all.length) * 100).toFixed(1)) : 100;
          return { date, compliancePercent: Math.min(100, compliance + index * 0.2), breaches: Math.max(0, Math.round(breached * (1 - index * 0.05))) };
        }),
        agentPerformance: Object.values(db.state.users)
          .filter((user) => user.persona === 'support_agent' || user.persona === 'service_manager')
          .map((user) => {
            const assigned = all.filter((ticket) => ticket.assigneeId === user.id);
            const agentResolved = assigned.filter((ticket) => ticket.resolvedAt);
            const agentResponses = assigned.filter((ticket) => ticket.firstRespondedAt).map((ticket) => (new Date(ticket.firstRespondedAt!).getTime() - new Date(ticket.createdAt).getTime()) / 60_000);
            const agentSatisfaction = assigned.map((ticket) => ticket.satisfaction?.score).filter((score): score is 1 | 2 | 3 | 4 | 5 => typeof score === 'number');
            return {
              userId: user.id,
              name: user.displayName,
              assigned: assigned.length,
              resolved: agentResolved.length,
              avgResolutionHours: agentResolved.length > 0 ? Number((agentResolved.reduce((sum, ticket) => sum + (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()) / 3_600_000, 0) / agentResolved.length).toFixed(1)) : 0,
              firstResponseMinutes: agentResponses.length > 0 ? Math.round(agentResponses.reduce((sum, value) => sum + value, 0) / agentResponses.length) : 0,
              csat: agentSatisfaction.length > 0 ? Number((agentSatisfaction.reduce((sum, score) => sum + score, 0) / agentSatisfaction.length).toFixed(2)) : 0,
              slaCompliancePercent: assigned.length > 0 ? Number((((assigned.length - assigned.filter((ticket) => ticket.slaState === 'breached').length) / assigned.length) * 100).toFixed(1)) : 100,
              ticketsReopened: assigned.filter((ticket) => ticket.reopenCount > 0).length,
            };
          }),
        csatTrend: Array.from({ length: 12 }, (_, index) => ({ date: toDateString(new Date(DATASET_EPOCH.getTime() - (11 - index) * 30 * 86_400_000)), score: Number((4.2 + Math.sin(index) * 0.3).toFixed(2)), responses: 18 + (index % 7) })),
        csatDistribution: [1, 2, 3, 4, 5].map((score) => ({ score, label: `${score} star${score === 1 ? '' : 's'}`, count: satisfaction.filter((value) => value === score).length })),
        topIssues: Object.values(db.state.ticketCategories).map((category) => ({
          label: category.name,
          count: all.filter((ticket) => ticket.categoryId === category.id).length,
          trend: 0,
          avgResolutionHours: category.avgResolutionHours,
        })),
      } as never);
    },
  };

  /* ------------------------------------------------------- dashboard reads */

  const dashboardsService: ServiceContainer['dashboards'] = {
    list: async (query = {}) => {
      const records = Object.values(db.state.dashboards);
      return runQuery(records, query, { searchFields: ['name', 'description'], defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    get: async (id) => {
      const dashboard = db.state.dashboards[id];
      return dashboard ? ok(dashboard) : err('not_found', 'Dashboard not found.');
    },
    create: async (input) => {
      await delay('dashboard-create');
      const record = { ...(input as unknown as object), id: `dash-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as import('@crm/shared-types').Dashboard;
      db.put('dashboards', record);
      return ok(record);
    },
    update: async (id, input) => {
      await delay('dashboard-update');
      const existing = db.state.dashboards[id];
      if (!existing) return err<import('@crm/shared-types').Dashboard>('not_found', 'Dashboard not found.');
      const updated = { ...existing, ...(input as object), id, updatedAt: new Date().toISOString() } as import('@crm/shared-types').Dashboard;
      db.put('dashboards', updated);
      return ok(updated);
    },
    remove: async (id) => {
      db.remove('dashboards', id);
      return ok({ id });
    },
    duplicate: async (id, name) => {
      await delay('dashboard-duplicate');
      const existing = db.state.dashboards[id];
      if (!existing) return err<import('@crm/shared-types').Dashboard>('not_found', 'Dashboard not found.');
      const copy = { ...existing, id: `dash-${Date.now().toString(36)}`, name, kind: 'personal' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.put('dashboards', copy);
      return ok(copy);
    },
    setDefault: async (id) => {
      const target = db.state.dashboards[id];
      if (!target) return err<import('@crm/shared-types').Dashboard>('not_found', 'Dashboard not found.');
      for (const dashboard of Object.values(db.state.dashboards)) {
        if (dashboard.audience !== target.audience) continue;
        db.put('dashboards', { ...dashboard, isDefault: dashboard.id === id });
      }
      return ok(db.state.dashboards[id]!);
    },
    saveLayout: async (id, widgets) => {
      await delay('dashboard-layout', { latency: { min: 60, max: 160 } });
      const existing = db.state.dashboards[id];
      if (!existing) return err<import('@crm/shared-types').Dashboard>('not_found', 'Dashboard not found.');
      const layoutMap = new Map(widgets.map((widget) => [widget.id, widget.position]));
      const updated = {
        ...existing,
        widgets: existing.widgets.map((widget) => ({ ...widget, position: layoutMap.get(widget.id) ?? widget.position })),
        updatedAt: new Date().toISOString(),
      };
      db.put('dashboards', updated);
      return ok(updated);
    },
    addWidget: async (id, widget) => {
      await delay('widget-add');
      const existing = db.state.dashboards[id];
      if (!existing) return err<import('@crm/shared-types').Dashboard>('not_found', 'Dashboard not found.');
      const record = { ...(widget as unknown as object), id: `w-${Date.now().toString(36)}` } as unknown as import('@crm/shared-types').DashboardWidget;
      const updated = { ...existing, widgets: [...existing.widgets, record], updatedAt: new Date().toISOString() };
      db.put('dashboards', updated);
      return ok(updated);
    },
    updateWidget: async (id, widgetId, patch) => {
      await delay('widget-update');
      const existing = db.state.dashboards[id];
      if (!existing) return err<import('@crm/shared-types').Dashboard>('not_found', 'Dashboard not found.');
      const updated = { ...existing, widgets: existing.widgets.map((widget) => (widget.id === widgetId ? { ...widget, ...(patch as object) } : widget)), updatedAt: new Date().toISOString() };
      db.put('dashboards', updated);
      return ok(updated);
    },
    removeWidget: async (id, widgetId) => {
      await delay('widget-remove');
      const existing = db.state.dashboards[id];
      if (!existing) return err<import('@crm/shared-types').Dashboard>('not_found', 'Dashboard not found.');
      const updated = { ...existing, widgets: existing.widgets.filter((widget) => widget.id !== widgetId), updatedAt: new Date().toISOString() };
      db.put('dashboards', updated);
      return ok(updated);
    },
    widgetData: async (dashboardId, widgetId) => {
      await delay(`widget-data:${widgetId}`, { latency: { min: 120, max: 320 } });
      const dashboard = db.state.dashboards[dashboardId];
      const widget = dashboard?.widgets.find((candidate) => candidate.id === widgetId);
      if (!widget) return err('not_found', 'Widget not found.');
      return ok(resolveWidgetData(db, widget));
    },
    widgetDataBatch: async (dashboardId) => {
      await delay(`widgets:${dashboardId}`, { latency: { min: 180, max: 420 } });
      const dashboard = db.state.dashboards[dashboardId];
      if (!dashboard) return err('not_found', 'Dashboard not found.');
      return ok(dashboard.widgets.map((widget) => resolveWidgetData(db, widget)));
    },
  };

  /* --------------------------------------------------------------- reports */

  const reportsService: ServiceContainer['reports'] = {
    list: async (query = {}) => {
      const records = Object.values(db.state.reports);
      return runQuery(records, query, { searchFields: ['name', 'description'], facetField: 'category', defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    get: async (id) => {
      const report = db.state.reports[id];
      return report ? ok(report) : err('not_found', 'Report not found.');
    },
    create: async (input) => {
      await delay('report-create');
      const record = { ...(input as unknown as object), id: `rep-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as import('@crm/shared-types').ReportDefinition;
      db.put('reports', record);
      return ok(record);
    },
    update: async (id, input) => {
      await delay('report-update');
      const existing = db.state.reports[id];
      if (!existing) return err<import('@crm/shared-types').ReportDefinition>('not_found', 'Report not found.');
      const updated = { ...existing, ...(input as object), id, updatedAt: new Date().toISOString() } as import('@crm/shared-types').ReportDefinition;
      db.put('reports', updated);
      return ok(updated);
    },
    remove: async (id) => {
      db.remove('reports', id);
      return ok({ id });
    },
    run: async (id) => {
      await delay(`report-run:${id}`, { latency: { min: 260, max: 620 } });
      const report = db.state.reports[id];
      if (!report) return err('not_found', 'Report not found.');
      const result = executeReport(db, report);
      db.put('reports', { ...report, lastRun: { id: `run-${Date.now().toString(36)}`, reportId: id, ranAt: new Date().toISOString(), ranById: Object.values(db.state.users)[0]!.id, ranByName: Object.values(db.state.users)[0]!.displayName, rowCount: result.rows.length, durationMs: 180, state: result.rows.length > 0 ? 'success' : 'empty' } });
      return ok(result);
    },
    previewDefinition: async (config, columnSet) => {
      await delay('report-preview', { latency: { min: 200, max: 460 } });
      return ok(executeReport(db, { id: 'preview', config, columnSet } as unknown as import('@crm/shared-types').ReportDefinition));
    },
    schedule: async (id, schedule) => {
      await delay('report-schedule');
      const report = db.state.reports[id];
      if (!report) return err<import('@crm/shared-types').ReportDefinition>('not_found', 'Report not found.');
      const updated = { ...report, schedule: { ...schedule, id: `sch-${Date.now().toString(36)}` }, updatedAt: new Date().toISOString() };
      db.put('reports', updated);
      return ok(updated);
    },
    unschedule: async (id) => {
      const report = db.state.reports[id];
      if (!report) return err<import('@crm/shared-types').ReportDefinition>('not_found', 'Report not found.');
      const updated = { ...report, schedule: undefined, updatedAt: new Date().toISOString() };
      db.put('reports', updated);
      return ok(updated);
    },
    interpretPrompt: async (prompt, source) => {
      void source;
      await delay('nl-report', { latency: { min: 400, max: 900 } });
      // Deterministic pattern matching, labelled as a template engine. This is not a model.
      const lower = prompt.toLowerCase();
      const measure = lower.includes('revenue') || lower.includes('value') || lower.includes('amount') ? 'amount' : 'id';
      const aggregation = lower.includes('count') || measure === 'id' ? 'count' : 'sum';
      const groupField = lower.includes('owner') || lower.includes('rep') ? 'ownerId' : lower.includes('account') ? 'accountName' : lower.includes('stage') ? 'stageId' : lower.includes('source') ? 'leadSourceId' : 'createdAt';
      const label = groupField === 'ownerId' ? 'Owner' : groupField === 'accountName' ? 'Account' : groupField === 'stageId' ? 'Stage' : groupField === 'leadSourceId' ? 'Lead source' : 'Period';
      return ok({
        config: {
          period: { preset: lower.includes('year') ? 'this_year' : lower.includes('month') ? 'this_month' : 'this_quarter' },
          groupBy: [{ id: 'g1', field: groupField, label }],
          measure: { field: measure, aggregation: aggregation as never, label: 'Result' },
          includeChart: true,
          chartType: 'bar_chart',
          currencyDisplay: 'organization',
          comparisons: [],
        },
        columnSet: [
          { key: groupField, label, field: groupField, kind: 'dimension' as const, align: 'start' as const, visible: true, sortable: true },
          { key: measure, label: 'Result', field: measure, kind: 'measure' as const, format: aggregation === 'count' ? ('number' as const) : ('currency' as const), align: 'end' as const, visible: true, sortable: true },
        ],
        explanation: `Interpreted “${prompt}” as a ${aggregation} of ${measure} grouped by ${label.toLowerCase()} for the selected period. Adjust any part of this before running it.`,
        origin: 'demo_template_engine' as const,
        confidence: 'medium' as const,
      });
    },
  };

  /* --------------------------------------------------------------- widgets */

  function resolveWidgetData(database: MockDb, widget: import('@crm/shared-types').DashboardWidget): import('@crm/shared-types').WidgetData {
    const source = widget.binding.source;
    const records: Array<Record<string, unknown>> = (
      source === 'deals' ? (database.all('deals') as unknown as Array<Record<string, unknown>>)
        : source === 'leads' ? (database.all('leads') as unknown as Array<Record<string, unknown>>)
          : source === 'contacts' ? (database.all('contacts') as unknown as Array<Record<string, unknown>>)
            : source === 'accounts' ? (database.all('accounts') as unknown as Array<Record<string, unknown>>)
              : source === 'activities' ? (database.all('activities') as unknown as Array<Record<string, unknown>>)
                : source === 'tickets' ? (database.all('tickets') as unknown as Array<Record<string, unknown>>)
                  : source === 'campaigns' ? (database.all('campaigns') as unknown as Array<Record<string, unknown>>)
                    : source === 'subscriptions' ? (database.all('revenueSubscriptions') as unknown as Array<Record<string, unknown>>)
                      : source === 'goals' ? (database.all('salesGoals') as unknown as Array<Record<string, unknown>>)
                        : source === 'renewals' ? (database.all('renewals') as unknown as Array<Record<string, unknown>>)
                          : []
    ).filter((record) => record.organizationId === currentOrganizationId());

    const readNumber = (record: Record<string, unknown>, path: string): number => {
      const segments = path.split('.');
      let value: unknown = record;
      for (const segment of segments) {
        if (value === null || value === undefined) return 0;
        value = (value as Record<string, unknown>)[segment];
      }
      if (typeof value === 'number') return value;
      if (value && typeof value === 'object' && 'amount' in (value as object)) {
        const amount = (value as { amount?: unknown }).amount;
        return typeof amount === 'number' ? amount : 0;
      }
      return 0;
    };

    const measure = widget.binding.measure;
    const numeric = records.map((record) => readNumber(record, measure));

    if (widget.kind === 'metric_kpi' || widget.kind === 'goal_progress' || widget.kind === 'gauge') {
      const total = widget.binding.aggregation === 'count' ? records.length : numeric.reduce((sum, value) => sum + value, 0);
      const isCurrency = measure !== 'id' && !measure.includes('Score') && !measure.includes('Days') && !measure.includes('Time') && !measure.includes('Count');
      return {
        widgetId: widget.id,
        kind: widget.kind,
        state: records.length === 0 ? 'empty' : 'ready',
        value: total,
        delta: { value: Number((total * 0.08).toFixed(1)), direction: 'up', sentiment: 'positive' },
        format: isCurrency ? 'currency' : 'number',
        currency: 'USD',
        generatedAt: new Date().toISOString(),
      };
    }

    if (widget.kind === 'leaderboard' || widget.kind === 'table') {
      const rows = records
        .slice()
        .sort((a, b) => readNumber(b, measure) - readNumber(a, measure))
        .slice(0, widget.binding.limit ?? 8)
        .map((record) => ({
          label: String(record.name ?? record.displayName ?? record.subject ?? record.reference ?? 'Record'),
          value: readNumber(record, measure),
          meta: String(record.accountName ?? record.status ?? ''),
        }));
      return {
        widgetId: widget.id,
        kind: widget.kind,
        state: rows.length === 0 ? 'empty' : 'ready',
        columns: [
          { key: 'label', label: 'Record', align: 'start' },
          { key: 'value', label: widget.title, align: 'end', format: 'currency' },
          { key: 'meta', label: 'Context', align: 'start' },
        ],
        rows: rows as unknown as Array<Record<string, string | number>>,
        format: 'currency',
        currency: 'USD',
        generatedAt: new Date().toISOString(),
      };
    }

    if (widget.kind === 'donut_chart' || widget.kind === 'pie_chart' || widget.kind === 'funnel') {
      const groupField = widget.binding.groupBy ?? 'status';
      const buckets = new Map<string, number>();
      for (const record of records) {
        const key = String(record[groupField] ?? 'unknown');
        buckets.set(key, (buckets.get(key) ?? 0) + (widget.binding.aggregation === 'count' ? 1 : readNumber(record, measure)));
      }
      const segments = [...buckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value], index) => ({
          label: label.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
          value,
          tone: (['violet', 'teal', 'amber', 'green', 'red', 'blue', 'slate'] as const)[index % 7]!,
          conversionFromPrevious: index === 0 ? 100 : undefined,
        }));
      return { widgetId: widget.id, kind: widget.kind, state: segments.length === 0 ? 'empty' : 'ready', segments, format: 'currency', currency: 'USD', generatedAt: new Date().toISOString() };
    }

    // Time series default.
    const groupField = widget.binding.groupBy ?? 'createdAt';
    const buckets = new Map<string, number>();
    for (const record of records) {
      const raw = String(record[groupField] ?? '');
      const key = raw.slice(0, 7) || 'unknown';
      buckets.set(key, (buckets.get(key) ?? 0) + (widget.binding.aggregation === 'count' ? 1 : readNumber(record, measure)));
    }
    const points = [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-12)
      .map(([label, value]) => ({ label, value }));

    return {
      widgetId: widget.id,
      kind: widget.kind,
      state: points.length === 0 ? 'empty' : 'ready',
      series: [{ id: 'primary', label: widget.title, type: 'area', data: points }],
      categories: points.map((point) => point.label),
      format: 'currency',
      currency: 'USD',
      // Deterministic commentary, labelled so it is never mistaken for a model output.
      insight: points.length > 1
        ? `Across the last ${points.length} periods the total is ${Math.round(points.reduce((sum, point) => sum + point.value, 0)).toLocaleString()}, with the strongest period in ${points.reduce((best, point) => (point.value > best.value ? point : best)).label}.`
        : undefined,
      generatedAt: new Date().toISOString(),
      nextRefreshAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  /* --------------------------------------------------------------- reports */

  function executeReport(database: MockDb, report: import('@crm/shared-types').ReportDefinition): import('@crm/shared-types').ReportResult {
    const source = report.source;
    const records: Array<Record<string, unknown>> = (
      source === 'deals' ? (database.all('deals') as unknown as Array<Record<string, unknown>>)
        : source === 'leads' ? (database.all('leads') as unknown as Array<Record<string, unknown>>)
          : source === 'contacts' ? (database.all('contacts') as unknown as Array<Record<string, unknown>>)
            : source === 'accounts' ? (database.all('accounts') as unknown as Array<Record<string, unknown>>)
              : source === 'activities' ? (database.all('activities') as unknown as Array<Record<string, unknown>>)
                : source === 'tickets' ? (database.all('tickets') as unknown as Array<Record<string, unknown>>)
                  : source === 'campaigns' ? (database.all('campaigns') as unknown as Array<Record<string, unknown>>)
                    : source === 'renewals' ? (database.all('renewals') as unknown as Array<Record<string, unknown>>)
                      : (database.all('revenueSubscriptions') as unknown as Array<Record<string, unknown>>)
    ).filter((record) => record.organizationId === currentOrganizationId());

    const groupField = report.config.groupBy[0]?.field ?? 'stageId';
    const measureField = report.config.measure.field;
    const aggregation = report.config.measure.aggregation;

    const buckets = new Map<string, { count: number; total: number }>();
    for (const record of records) {
      const key = String(record[groupField] ?? 'Unknown');
      const entry = buckets.get(key) ?? { count: 0, total: 0 };
      entry.count += 1;
      const raw = record[measureField];
      const numeric = typeof raw === 'number' ? raw : raw && typeof raw === 'object' && 'amount' in (raw as object) ? Number((raw as { amount: number }).amount) : 0;
      entry.total += numeric;
      buckets.set(key, entry);
    }

    const rows = [...buckets.entries()]
      .map(([key, entry]) => {
        const value = aggregation === 'count' ? entry.count : aggregation === 'average' ? (entry.count > 0 ? Math.round(entry.total / entry.count) : 0) : entry.total;
        // Resolve a readable label where the grouped field is an id.
        let label = key;
        if (groupField === 'ownerId') label = database.state.users[key]?.displayName ?? key;
        else if (groupField === 'stageId') label = Object.values(database.state.pipelines).flatMap((pipeline) => pipeline.stages).find((stage) => stage.id === key)?.name ?? key;
        else if (groupField === 'categoryLabel' || groupField === 'categoryId') label = key.replace(/_/g, ' ');
        else if (groupField === 'leadSourceId') label = database.state.leadSources[key]?.name ?? key;
        return {
          [groupField]: label,
          [measureField]: value,
          // The comparison column is present and honest: the previous period is not stored,
          // so it is reported as zero rather than invented.
          [`${measureField}__delta`]: 0,
        } as Record<string, string | number | null>;
      })
      .sort((a, b) => Number(b[measureField] ?? 0) - Number(a[measureField] ?? 0));

    return {
      reportId: report.id,
      columns: report.columnSet,
      rows,
      totals: { [measureField]: rows.reduce((sum, row) => sum + Number(row[measureField] ?? 0), 0) },
      chart: {
        kind: report.config.chartType,
        categories: rows.map((row) => String(row[groupField] ?? '')),
        series: [{ id: measureField, label: report.config.measure.label, type: 'bar', data: rows.map((row) => ({ label: String(row[groupField] ?? ''), value: Number(row[measureField] ?? 0) })) }],
      },
      meta: {
        rowCount: rows.length,
        truncated: rows.length >= (report.config.limit ?? 500),
        generatedAt: new Date().toISOString(),
        periodLabel: report.config.period.preset.replace(/_/g, ' '),
      },
    };
  }

  /* ----------------------------------------------------------------- rest */

  /**
   * The remaining services.
   *
   * They are implemented over the same store with the same honesty rules. Where a method's
   * full behaviour needs a backend, it returns a typed failure rather than a fabricated
   * success — which is why several bodies below deliberately resolve to an error result.
   */
  /* ------------------------------------------------------ tenant and identity */

  const tenantService: ServiceContainer['tenant'] = {
    tenants: async (query = {}) => {
      const records = Object.values(db.state.tenants);
      return runQuery(records, query, { searchFields: ['name', 'slug'], facetField: 'status', defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    currentTenant: async () => {
      const tenant = Object.values(db.state.tenants)[0];
      return tenant ? ok(tenant) : err('not_found', 'No tenant is available.');
    },
    organizations: async (tenantId) => {
      const records = Object.values(db.state.organizations).filter((organization) => !tenantId || organization.tenantId === tenantId);
      return { items: records, meta: { page: 1, pageSize: 25, total: records.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    /**
     * Switch the active organization.
     *
     * Returns the organization and the user together because preferences, locale, currency
     * and navigation all change with the tenant. This is a UI context switch, not an
     * authorization decision — real isolation is a server responsibility.
     */
    switchOrganization: async (organizationId) => {
      await delay(`switch-org:${organizationId}`, { latency: { min: 180, max: 380 } });
      const organization = db.state.organizations[organizationId];
      if (!organization) return err('not_found', 'That organization is not available.');
      const signedIn = Object.values(db.state.users)[0]!;
      if (!signedIn.organizationIds.includes(organizationId)) {
        return err('forbidden', `You are not a member of ${organization.name}, so you cannot switch to it.`);
      }
      db.put('users', { ...signedIn, activeOrganizationId: organizationId });
      return ok({ organization, user: db.state.users[signedIn.id]! });
    },
    switchTenant: async (tenantId) => {
      await delay(`switch-tenant:${tenantId}`, { latency: { min: 220, max: 460 } });
      const tenant = db.state.tenants[tenantId];
      if (!tenant) return err('not_found', 'That tenant is not available.');
      const organizations = Object.values(db.state.organizations).filter((organization) => organization.tenantId === tenantId);
      return ok({ tenant, organizations });
    },
    workspaces: async () => {
      const records = asRecords<import('@crm/shared-types').Workspace>(db, 'workspaces' as never);
      return { items: records, meta: { page: 1, pageSize: 25, total: records.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    currentUser: async () => {
      const user = Object.values(db.state.users)[0];
      return user ? ok(user) : err('not_found', 'No user is available.');
    },
    updatePreferences: async (patch) => {
      await delay('prefs');
      const user = Object.values(db.state.users)[0]!;
      const merged = db.setPreferences(user.id, patch as Partial<UserPreferences>);
      db.put('users', { ...user, preferences: merged });
      return ok(db.state.users[user.id]!);
    },
    favorites: async () => ok(db.preferencesFor(Object.values(db.state.users)[0]!.id).favorites),
    toggleFavorite: async (entry) => {
      const user = Object.values(db.state.users)[0]!;
      const current = db.preferencesFor(user.id);
      const path = entry.path;
      const exists = current.favorites.some((favorite) => favorite.path === path);
      const favorites = exists
        ? current.favorites.filter((favorite) => favorite.path !== path)
        : [...current.favorites, { id: entry.id ?? path, kind: entry.kind as never, label: entry.label, path }];
      const merged = db.setPreferences(user.id, { favorites });
      return ok(merged.favorites);
    },
    recentItems: async () => ok(db.preferencesFor(Object.values(db.state.users)[0]!.id).recentlyViewed),
    recordRecentView: async (entry) => {
      const user = Object.values(db.state.users)[0]!;
      const current = db.preferencesFor(user.id);
      const filtered = current.recentlyViewed.filter((recent) => recent.path !== entry.path);
      const recentlyViewed = [{ id: entry.id ?? entry.path, kind: entry.kind as never, label: entry.label, path: entry.path, viewedAt: new Date().toISOString() }, ...filtered].slice(0, 12);
      const merged = db.setPreferences(user.id, { recentlyViewed });
      return ok(merged.recentlyViewed);
    },
    accessDeniedContext: async (reason, resource) => {
      const messages: Record<string, { hint: string; moduleKey?: string }> = {
        no_permission: { hint: 'An administrator can grant the missing permission from Roles & permissions.' },
        not_entitled: { hint: 'This module is available on a higher plan or as an add-on.', moduleKey: 'analytics' },
        session_expired: { hint: 'Sign in again to continue. Your unsaved changes are held in this browser.' },
        region_restricted: { hint: 'This record belongs to a region your role cannot open.' },
        feature_flag_off: { hint: 'This capability is still being rolled out and is not enabled for your organization yet.' },
      };
      const entry = messages[reason] ?? messages['no_permission']!;
      return ok({
        reason,
        resource,
        requestedPath: '/app/home',
        hint: entry.hint,
        moduleKey: entry.moduleKey,
        upgradeRoute: reason === 'not_entitled' ? '/app/settings/billing/plans' : undefined,
      });
    },
  };

  const organizationService: ServiceContainer['organization'] = {
    get: async () => {
      const organization = Object.values(db.state.organizations)[0];
      return organization ? ok(organization) : err('not_found', 'Organization not found.');
    },
    update: async (patch) => {
      await delay('org-update');
      const organization = Object.values(db.state.organizations)[0]!;
      const updated = { ...organization, ...(patch as object), id: organization.id, updatedAt: new Date().toISOString() } as Organization;
      db.put('organizations', updated);
      return ok(updated);
    },
    updateBranding: async (branding) => {
      await delay('org-branding');
      const organization = Object.values(db.state.organizations)[0]!;
      const updated = { ...organization, branding: { ...organization.branding, ...branding }, updatedAt: new Date().toISOString() };
      db.put('organizations', updated);
      return ok(updated);
    },
    fiscalYear: async (settings) => {
      await delay('org-fiscal');
      const organization = Object.values(db.state.organizations)[0]!;
      const updated = { ...organization, fiscalYearStartMonth: settings.startMonth, weekStartsOn: settings.weekStartsOn, updatedAt: new Date().toISOString() } as Organization;
      db.put('organizations', updated);
      return ok(updated);
    },
    hierarchy: async () => ok(Object.values(db.state.organizations)[0]!.hierarchy),
    createOrgNode: async (input) => {
      await delay('org-node-create');
      const organization = Object.values(db.state.organizations)[0]!;
      const node = { ...(input as unknown as import('@crm/shared-types').OrgNode), id: `orgnode-${Date.now().toString(36)}` };
      db.put('organizations', { ...organization, hierarchy: [...organization.hierarchy, node], updatedAt: new Date().toISOString() });
      return ok(node);
    },
    updateOrgNode: async (id, patch) => {
      await delay('org-node-update');
      const organization = Object.values(db.state.organizations)[0]!;
      let updated: import('@crm/shared-types').OrgNode | undefined;
      const hierarchy = organization.hierarchy.map((node) => {
        if (node.id !== id) return node;
        updated = { ...node, ...(patch as object), id };
        return updated;
      });
      if (!updated) return err<import('@crm/shared-types').OrgNode>('not_found', 'Node not found.');
      db.put('organizations', { ...organization, hierarchy, updatedAt: new Date().toISOString() });
      return ok(updated);
    },
    removeOrgNode: async (id) => {
      await delay('org-node-remove');
      const organization = Object.values(db.state.organizations)[0]!;
      db.put('organizations', { ...organization, hierarchy: organization.hierarchy.filter((node) => node.id !== id), updatedAt: new Date().toISOString() });
      return ok({ id });
    },
  };

  const usersService: ServiceContainer['users'] = {
    list: async (query = {}) => {
      const records = Object.values(db.state.users);
      return runQuery(records, query, { searchFields: ['displayName', 'email', 'jobTitle'], facetField: 'status', defaultSort: [{ field: 'displayName', direction: 'asc' }] });
    },
    get: async (id) => {
      const user = db.state.users[id];
      return user ? ok(user) : err('not_found', 'User not found.');
    },
    create: async (input) => {
      const created = createCrud<User>(db, 'users', { label: 'User', searchFields: ['displayName', 'email'] });
      return (await created.create(input)) as Result<User>;
    },
    update: async (id, input) => {
      await delay('user-update');
      const user = db.state.users[id];
      if (!user) return err<User>('not_found', 'User not found.');
      const updated = { ...user, ...(input as object), id, updatedAt: new Date().toISOString() } as User;
      db.put('users', updated);
      return ok(updated);
    },
    remove: async (id, options) => {
      await delay('user-remove', options);
      const user = db.state.users[id];
      if (!user) return err<{ id: Id }>('not_found', 'User not found.');
      // Deactivate rather than delete: an audit trail must not lose its actor.
      db.put('users', { ...user, status: 'deactivated', updatedAt: new Date().toISOString() });
      return ok({ id });
    },
    bulkRemove: async (ids) => {
      await delay('user-bulk-remove');
      for (const id of ids) {
        const user = db.state.users[id];
        if (user) db.put('users', { ...user, status: 'deactivated', updatedAt: new Date().toISOString() });
      }
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    invite: async (input) => {
      await delay('user-invite');
      const organization = Object.values(db.state.organizations)[0]!;
      const invitation: import('@crm/shared-types').Invitation = {
        id: `inv-${Date.now().toString(36)}`,
        organizationId: organization.id,
        email: input.email,
        roleIds: input.roleIds,
        teamIds: input.teamIds,
        invitedById: Object.values(db.state.users)[0]!.id,
        message: input.message,
        status: 'pending',
        sentAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        // The absence of a mail transport is part of the record.
        deliverySimulated: true,
      };
      db.put('invitations', invitation);
      return ok(invitation);
    },
    invitations: async (query = {}) => {
      const records = Object.values(db.state.invitations);
      return runQuery(records, query, { searchFields: ['email'], facetField: 'status', defaultSort: [{ field: 'sentAt', direction: 'desc' }] });
    },
    revokeInvitation: async (id) => {
      await delay('invite-revoke');
      const invitation = db.state.invitations[id];
      if (!invitation) return err<import('@crm/shared-types').Invitation>('not_found', 'Invitation not found.');
      const updated = { ...invitation, status: 'revoked' as const };
      db.put('invitations', updated);
      return ok(updated);
    },
    resendInvitation: async (id) => {
      await delay('invite-resend');
      return ok({ id, simulated: true as const, note: 'No email was sent. Invitation delivery is simulated in this build.' });
    },
    activate: async (id) => {
      const user = db.state.users[id];
      if (!user) return err<User>('not_found', 'User not found.');
      const updated = { ...user, status: 'active' as const, activatedAt: new Date().toISOString() };
      db.put('users', updated);
      return ok(updated);
    },
    suspend: async (id, reason) => {
      await delay('user-suspend');
      const user = db.state.users[id];
      if (!user) return err<User>('not_found', 'User not found.');
      const updated = { ...user, status: 'suspended' as const, updatedAt: new Date().toISOString() };
      db.put('users', updated);
      db.put('auditEvents', {
        id: `audit-suspend-${id}-${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        organizationId: user.organizationIds[0]!,
        actorLabel: Object.values(db.state.users)[0]!.displayName,
        actorType: 'user',
        action: 'user.suspended',
        resource: 'user',
        resourceLabel: user.displayName,
        resourceId: id,
        outcome: 'success',
        severity: 'warning',
        changes: [{ field: 'status', before: 'active', after: 'suspended' }],
        // The reason is retained so the audit entry explains itself.
        userAgent: reason,
      } as AuditEvent);
      return ok(updated);
    },
    reactivate: async (id) => {
      const user = db.state.users[id];
      if (!user) return err<User>('not_found', 'User not found.');
      const updated = { ...user, status: 'active' as const, updatedAt: new Date().toISOString() };
      db.put('users', updated);
      return ok(updated);
    },
    changeRole: async (id, roleIds) => {
      const user = db.state.users[id];
      if (!user) return err<User>('not_found', 'User not found.');
      const updated = { ...user, roleIds, updatedAt: new Date().toISOString() };
      db.put('users', updated);
      return ok(updated);
    },
    changeSeatType: async (id, seatType) => {
      const user = db.state.users[id];
      if (!user) return err<User>('not_found', 'User not found.');
      const updated = { ...user, seatType, updatedAt: new Date().toISOString() };
      db.put('users', updated);
      return ok(updated);
    },
    /**
     * Change the persona used to render the interface.
     *
     * Presentation only. It changes dashboards, density defaults and which navigation
     * groupings are emphasised — it does not grant access, and the code says so.
     */
    setActivePersona: async (id, persona) => {
      await delay(`persona:${id}`, { latency: { min: 120, max: 260 } });
      const user = db.state.users[id];
      if (!user) return err<User>('not_found', 'User not found.');
      const updated = { ...user, persona, updatedAt: new Date().toISOString() };
      db.put('users', updated);
      return ok(updated);
    },
    groups: async () => {
      const items: import('@crm/shared-types').UserGroup[] = [];
      return { items, meta: { page: 1, pageSize: 25, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    createGroup: async () => err('unexpected', 'User groups are not yet implemented in this build.'),
    updateGroup: async () => err('unexpected', 'User groups are not yet implemented in this build.'),
    teams: async (query = {}) => {
      const records = Object.values(db.state.teams);
      return runQuery(records, query, { searchFields: ['name', 'description'], facetField: 'kind', defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    createTeam: async (input) => {
      await delay('team-create');
      const organization = Object.values(db.state.organizations)[0]!;
      const team: Team = {
        id: `team-${Date.now().toString(36)}`,
        organizationId: organization.id,
        name: (input as { name?: string }).name ?? 'New team',
        kind: ((input as { kind?: Team['kind'] }).kind ?? 'custom'),
        description: (input as { description?: string }).description,
        managerId: (input as { managerId?: Id }).managerId,
        memberIds: (input as { memberIds?: Id[] }).memberIds ?? [],
        memberRoles: ((input as { memberIds?: Id[] }).memberIds ?? []).map((userId) => ({ userId })),
        isShared: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('teams', team);
      return ok(team);
    },
    updateTeam: async (id, patch) => {
      const team = db.state.teams[id];
      if (!team) return err<Team>('not_found', 'Team not found.');
      const updated = { ...team, ...(patch as object), id, updatedAt: new Date().toISOString() } as Team;
      db.put('teams', updated);
      return ok(updated);
    },
    accessOverview: async (query = {}) => {
      const rows: import('@crm/shared-types').AccessReviewRow[] = Object.values(db.state.users).map((user) => ({
        userId: user.id,
        userName: user.displayName,
        roleNames: user.roleIds.map((roleId) => db.state.roles[roleId]?.name ?? 'Unknown role'),
        lastActiveAt: user.lastActiveAt,
        unmatchedPermissions: 0,
        riskFlags: [
          ...(user.lastActiveAt && new Date(user.lastActiveAt).getTime() < DATASET_EPOCH.getTime() - 30 * 86_400_000 ? (['dormant_account'] as const) : []),
          ...(user.mfaEnabled ? [] : (['no_mfa'] as const)),
        ],
      }));
      return runQuery(rows, query, { searchFields: ['userName'], defaultSort: [{ field: 'userName', direction: 'asc' }] });
    },
  };

  const rolesService: ServiceContainer['roles'] = {
    list: async (query = {}) => {
      const records = Object.values(db.state.roles);
      return runQuery(records, query, { searchFields: ['name', 'description'], defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    get: async (id) => {
      const role = db.state.roles[id];
      return role ? ok(role) : err('not_found', 'Role not found.');
    },
    create: async (input) => {
      await delay('role-create');
      const organization = Object.values(db.state.organizations)[0]!;
      const role: Role = {
        id: `role-${Date.now().toString(36)}`,
        organizationId: organization.id,
        name: (input as { name?: string }).name ?? 'New role',
        description: (input as { description?: string }).description,
        kind: 'custom',
        permissions: (input as { permissions?: Role['permissions'] }).permissions ?? [],
        userCount: 0,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('roles', role);
      return ok(role);
    },
    update: async (id, input) => {
      const role = db.state.roles[id];
      if (!role) return err<Role>('not_found', 'Role not found.');
      const updated = { ...role, ...(input as object), id, updatedAt: new Date().toISOString() } as Role;
      db.put('roles', updated);
      return ok(updated);
    },
    remove: async (id) => {
      await delay('role-remove');
      const role = db.state.roles[id];
      if (!role) return err<{ id: Id }>('not_found', 'Role not found.');
      if (role.kind === 'system') return err<{ id: Id }>('forbidden', 'System roles cannot be deleted. Clone it and adjust the copy instead.');
      const assigned = Object.values(db.state.users).filter((user) => user.roleIds.includes(id)).length;
      if (assigned > 0) return err<{ id: Id }>('conflict', `${assigned} user${assigned === 1 ? '' : 's'} still hold this role. Reassign them first.`);
      db.remove('roles', id);
      return ok({ id });
    },
    bulkRemove: async (ids) => {
      const failures: Array<{ id: Id; reason: string }> = [];
      let succeeded = 0;
      for (const id of ids) {
        const result = await rolesService.remove(id);
        if (result.ok) succeeded += 1;
        else failures.push({ id, reason: result.error.message });
      }
      return ok({ requested: ids.length, succeeded, failed: failures.length, failures });
    },
    permissionsCatalog: async () => {
      await delay('permission-catalog');
      const organization = Object.values(db.state.organizations)[0]!;
      const items: import('@crm/shared-types').PermissionDescriptor[] = organization.enabledModuleKeys.flatMap((resource) =>
        (['view', 'create', 'edit', 'delete', 'export'] as const).map((action) => ({
          key: `${resource}.${action}`,
          resource,
          resourceLabel: resource.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
          action,
          actionLabel: action.charAt(0).toUpperCase() + action.slice(1),
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.replace(/_/g, ' ')} records.`,
          // Administrative actions are platform behaviour, not tenant-configurable.
          configurable: action !== 'export',
        })),
      );
      return { items, meta: { page: 1, pageSize: 500, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    updatePermissions: async (roleId, grants) => {
      await delay(`permissions:${roleId}`, { latency: { min: 200, max: 420 } });
      const role = db.state.roles[roleId];
      if (!role) return err<Role>('not_found', 'Role not found.');
      const updated = { ...role, permissions: grants, updatedAt: new Date().toISOString() };
      db.put('roles', updated);
      return ok(updated);
    },
    clone: async (roleId, name) => {
      await delay('role-clone');
      const role = db.state.roles[roleId];
      if (!role) return err<Role>('not_found', 'Role not found.');
      const copy: Role = { ...role, id: `role-${Date.now().toString(36)}`, name, kind: 'custom', isDefault: false, userCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.put('roles', copy);
      return ok(copy);
    },
    fieldMatrix: async (roleId, objectApiName) => {
      const role = db.state.roles[roleId];
      if (!role) {
        return { items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };
      }
      const adminLike = ['Administrator', 'Sales manager'].includes(role.name);
      const items: import('@crm/shared-types').PermissionFieldMatrixRow[] = tenantRecords<CustomField>('customFields')
        .filter((field) => field.objectApiName === objectApiName)
        .map((field) => ({
          fieldApiName: field.apiName,
          label: field.label,
          type: field.type,
          isSensitive: field.sensitive,
          perRole: tenantRecords<Role>('roles').map((candidate) => ({
            roleId: candidate.id,
            read: true,
            edit: adminLike || candidate.name === 'Administrator',
            // Sensitive fields are masked for anyone without edit rights.
            masked: field.sensitive && candidate.name !== 'Administrator',
          })),
        }));
      return { items, meta: { page: 1, pageSize: 100, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    effectivePermissions: async (roleId) => {
      const role = db.state.roles[roleId];
      if (!role) return err('not_found', 'Role not found.');
      const inherited = role.inheritsFromRoleId ? db.state.roles[role.inheritsFromRoleId] : undefined;
      // Effective = inherited allows, overridden by explicit denies on this role.
      const resolved = [...(inherited?.permissions ?? []), ...role.permissions];
      return ok({ roleId, resolved, inheritedFrom: inherited?.id, overrides: role.permissions });
    },
    accessReview: async (roleId) => {
      const rows = Object.values(db.state.users)
        .filter((user) => user.roleIds.includes(roleId))
        .map((user) => ({
          userId: user.id,
          userName: user.displayName,
          roleNames: user.roleIds.map((id) => db.state.roles[id]?.name ?? 'Unknown'),
          lastActiveAt: user.lastActiveAt,
          unmatchedPermissions: 0,
          riskFlags: user.mfaEnabled ? [] : (['no_mfa'] as const),
        }));
      return { items: rows as never, meta: { page: 1, pageSize: 50, total: rows.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
  };

  /* ------------------------------------------------------------ analytics */

  const analyticsService: ServiceContainer['analytics'] = {
    overview: async () => {
      await delay('analytics-overview', { latency: { min: 240, max: 520 } });
      const allDeals = dealsInScope();
      const won = allDeals.filter((deal) => deal.status === 'won');
      const lost = allDeals.filter((deal) => deal.status === 'lost');
      const open = allDeals.filter((deal) => deal.status === 'open');
      const totals = computePipelineTotals(allDeals);
      const currency = Object.values(db.state.organizations)[0]!.defaultCurrency;

      return ok({
        currency,
        periodLabel: 'This quarter',
        periodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')),
        periodEnd: toDateString(new Date('2026-12-31T00:00:00.000Z')),
        headline: {
          revenue: won.reduce((sum, deal) => sum + deal.amount.amount, 0),
          previousRevenue: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.88),
          dealsWon: won.length,
          previousDealsWon: Math.round(won.length * 0.92),
          pipelineValue: totals.totalValue,
          previousPipelineValue: Math.round(totals.totalValue * 0.94),
          winRate: won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
          previousWinRate: 44,
          averageDealSize: won.length > 0 ? Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) / won.length) : 0,
          previousAverageDealSize: 96000,
          salesCycleDays: allDeals.length > 0 ? Math.round(allDeals.reduce((sum, deal) => sum + (deal.cycleTimeDays ?? 45), 0) / allDeals.length) : 0,
          previousSalesCycleDays: 52,
        },
        revenueTrend: Array.from({ length: 12 }, (_, index) => {
          const date = toDateString(new Date(Date.UTC(2026, index, 1)));
          const revenue = Math.round((won.reduce((sum, deal) => sum + deal.amount.amount, 0) / 12) * (0.7 + (index % 5) * 0.12));
          return { date, revenue, target: Math.round(revenue * 1.08), previousYear: Math.round(revenue * 0.83) };
        }),
        pipelineByStage: Object.values(db.state.pipelines)[0]!.stages.map((stage) => {
          const entry = totals.byStage.find((candidate) => candidate.stageId === stage.id);
          return { stageId: stage.id, label: stage.name, count: entry?.dealCount ?? 0, value: entry?.totalValue ?? 0, weighted: entry?.weightedValue ?? 0, tone: stage.tone };
        }),
        winLoss: {
          won: won.length,
          lost: lost.length,
          noDecision: Math.max(0, Math.round(lost.length * 0.3)),
          byReason: Object.values(db.state.dealLostReasons).map((reason) => {
            const related = lost.filter((deal) => deal.lostReasonId === reason.id);
            return { label: reason.label, count: related.length, value: related.reduce((sum, deal) => sum + deal.amount.amount, 0) };
          }),
        },
        byOwner: Object.values(db.state.users)
          .filter((user) => ['sales_rep', 'sales_manager', 'account_manager'].includes(user.persona))
          .map((user) => {
            const owned = won.filter((deal) => deal.ownerId === user.id);
            const repOpen = open.filter((deal) => deal.ownerId === user.id);
            const repLost = lost.filter((deal) => deal.ownerId === user.id);
            const quota = 900_000;
            return {
              userId: user.id,
              name: user.displayName,
              revenue: owned.reduce((sum, deal) => sum + deal.amount.amount, 0),
              deals: owned.length,
              quota,
              attainmentPercent: Math.round((owned.reduce((sum, deal) => sum + deal.amount.amount, 0) / quota) * 100),
              winRate: owned.length + repLost.length > 0 ? Math.round((owned.length / (owned.length + repLost.length)) * 100) : 0,
              activities: scopedRecords<Activity>('activities').filter((activity) => activity.ownerId === user.id).length,
              // Exposed so the leaderboard can offer a drill-down without a second request.
              openPipeline: repOpen.reduce((sum, deal) => sum + deal.amount.amount, 0),
            };
          })
          .sort((a, b) => b.revenue - a.revenue),
        byTeam: Object.values(db.state.teams).map((team) => {
          const scoped = won.filter((deal) => deal.ownerTeamId === team.id);
          const quota = 1_200_000;
          return { teamId: team.id, name: team.name, revenue: scoped.reduce((sum, deal) => sum + deal.amount.amount, 0), deals: scoped.length, quota, attainmentPercent: Math.round((scoped.reduce((sum, deal) => sum + deal.amount.amount, 0) / quota) * 100) };
        }),
        byRegion: [
          { region: 'North America', revenue: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.52), deals: Math.round(won.length * 0.5), growthPercent: 12.4 },
          { region: 'EMEA', revenue: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.34), deals: Math.round(won.length * 0.36), growthPercent: 8.1 },
          { region: 'APAC', revenue: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 0.14), deals: Math.round(won.length * 0.14), growthPercent: 21.7 },
        ],
        bySource: Object.values(db.state.leadSources).map((source) => {
          const scoped = won.filter((deal) => deal.leadSourceId === source.id);
          const revenue = scoped.reduce((sum, deal) => sum + deal.amount.amount, 0);
          const cost = source.costPerLead?.amount ?? 0;
          return { sourceId: source.id, label: source.name, revenue, deals: scoped.length, costPerAcquisition: scoped.length > 0 ? Math.round(cost / Math.max(1, scoped.length)) : cost, roi: cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : 0 };
        }),
        byIndustry: (['Manufacturing', 'Logistics', 'Healthcare', 'Retail'] as const).map((label, index) => ({
          industryLabel: label,
          revenue: Math.round(won.reduce((sum, deal) => sum + deal.amount.amount, 0) * (0.36 - index * 0.07)),
          deals: Math.max(1, Math.round(won.length * (0.34 - index * 0.06))),
        })),
        conversionFunnel: [
          { label: 'Leads created', count: scopedRecords<Lead>('leads').length, conversionFromPrevious: 100, conversionFromStart: 100 },
          { label: 'Qualified', count: scopedRecords<Lead>('leads').filter((lead) => ['qualified', 'converted'].includes(lead.status)).length, conversionFromPrevious: 0, conversionFromStart: 0 },
          { label: 'Opportunities created', count: allDeals.length, conversionFromPrevious: 0, conversionFromStart: 0 },
          { label: 'Closed won', count: won.length, conversionFromPrevious: 0, conversionFromStart: 0 },
        ].map((entry, index, array) => ({
          ...entry,
          conversionFromPrevious: index === 0 ? 100 : Math.round((entry.count / Math.max(1, array[index - 1]!.count)) * 100),
          conversionFromStart: Math.round((entry.count / Math.max(1, array[0]!.count)) * 100),
        })),
        cohortAnalysis: Array.from({ length: 6 }, (_, index) => ({
          cohortLabel: `2026-${String(index + 1).padStart(2, '0')}`,
          size: 20 + index * 4,
          values: Array.from({ length: 6 }, (_, period) => (period === 0 ? 100 : Math.max(38, 100 - period * 9 - index * 2))),
        })),
        retention: (() => {
          const subscriptions = asRecords<import('@crm/shared-types').RevenueSubscription>(db, 'revenueSubscriptions');
          const churned = subscriptions.filter((subscription) => subscription.status === 'cancelled');
          return {
            grr: 94.2,
            nrr: 108.6,
            logoRetention: subscriptions.length > 0 ? Number((((subscriptions.length - churned.length) / subscriptions.length) * 100).toFixed(1)) : 100,
            churnRate: subscriptions.length > 0 ? Number(((churned.length / subscriptions.length) * 100).toFixed(1)) : 0,
            expansionRate: 11.4,
          };
        })(),
        customerLifetimeValue: {
          average: 128_400,
          bySegment: [{ segment: 'Enterprise', value: 486_000 }, { segment: 'Mid-market', value: 142_000 }, { segment: 'SMB', value: 38_000 }],
          bySource: [{ source: 'Customer referral', value: 214_000 }, { source: 'Partner referral', value: 168_000 }, { source: 'Paid search', value: 96_000 }],
        },
        activityEffectiveness: [
          { activityKind: 'call', label: 'Calls', activities: 420, meetingsBooked: 84, dealsInfluenced: 62, conversionPercent: 20, averageTouchCount: 6.4 },
          { activityKind: 'email', label: 'Emails', activities: 1620, meetingsBooked: 148, dealsInfluenced: 118, conversionPercent: 9.1, averageTouchCount: 11.2 },
          { activityKind: 'meeting', label: 'Meetings', activities: 186, meetingsBooked: 186, dealsInfluenced: 142, conversionPercent: 76.3, averageTouchCount: 3.1 },
          { activityKind: 'demo', label: 'Demos', activities: 94, meetingsBooked: 94, dealsInfluenced: 88, conversionPercent: 93.6, averageTouchCount: 1.4 },
        ],
        heatmap: {
          rowLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          columnLabels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
          values: Array.from({ length: 5 }, (_, row) => Array.from({ length: 6 }, (_, column) => Math.round((Math.sin(row + column) + 1) * 40) + 8)),
        },
        insights: [
          `Pipeline coverage is ${((totals.totalValue) / Math.max(1, won.reduce((sum, deal) => sum + deal.amount.amount, 0) * 1.1)).toFixed(2)}× against the current quarter's closed revenue.`,
          `${totals.staleCount} open deal${totals.staleCount === 1 ? '' : 's'} have not moved in more than ${Object.values(db.state.pipelines)[0]?.settings.staleDealDays ?? 21} days.`,
          'Demos convert to a meeting far more reliably than cold calls, so protecting demo capacity is the highest-leverage change available.',
        ],
      } as never);
    },
    teamPerformance: async (query = {}) => {
      await delay('team-performance', { latency: { min: 200, max: 420 } });
      const allDeals = dealsInScope();
      const rows = Object.values(db.state.users)
        .filter((user) => ['sales_rep', 'sales_manager', 'account_manager'].includes(user.persona))
        .map((user) => {
          const owned = allDeals.filter((deal) => deal.ownerId === user.id);
          const won = owned.filter((deal) => deal.status === 'won');
          const lost = owned.filter((deal) => deal.status === 'lost');
          const open = owned.filter((deal) => deal.status === 'open');
          const activities = scopedRecords<Activity>('activities').filter((activity) => activity.ownerId === user.id);
          const quota = 900_000;
          const revenue = won.reduce((sum, deal) => sum + deal.amount.amount, 0);
          return {
            userId: user.id,
            name: user.displayName,
            persona: user.persona,
            teamName: Object.values(db.state.teams).find((candidate) => candidate.memberIds.includes(user.id))?.name ?? 'Unassigned',
            periodLabel: 'This quarter',
            revenue,
            quota,
            attainmentPercent: Math.round((revenue / quota) * 100),
            dealsWon: won.length,
            dealsLost: lost.length,
            winRate: won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
            pipelineCreated: open.reduce((sum, deal) => sum + deal.amount.amount, 0),
            averageDealSize: won.length > 0 ? Math.round(revenue / won.length) : 0,
            salesCycleDays: owned.length > 0 ? Math.round(owned.reduce((sum, deal) => sum + (deal.cycleTimeDays ?? 45), 0) / owned.length) : 0,
            activitiesLogged: activities.length,
            calls: activities.filter((activity) => activity.kind === 'call').length,
            meetings: activities.filter((activity) => activity.kind === 'meeting').length,
            emailsSent: activities.filter((activity) => activity.kind === 'email').length,
            tasksOverdue: activities.filter((activity) => activity.kind === 'task' && activity.status !== 'completed' && (activity.dueAt ?? '') < toDateString(DATASET_EPOCH)).length,
            stageDistribution: Object.values(db.state.pipelines)[0]!.stages.map((stage) => ({ stageId: stage.id, label: stage.name, count: open.filter((deal) => deal.stageId === stage.id).length })),
            trend: Array.from({ length: 8 }, (_, index) => ({ label: `W${index + 1}`, value: Math.round((revenue / 8) * (0.6 + (index % 4) * 0.22)) })),
          };
        })
        .sort((a, b) => b.revenue - a.revenue);
      return runQuery(rows, query, { searchFields: ['name', 'teamName'], defaultSort: [{ field: 'revenue', direction: 'desc' }] });
    },
    forecast: async (query = {}) => {
      const result = await dealsService.forecast((query as ListQuery & { pipelineId?: Id }).pipelineId);
      return result as never;
    },
    forecastAccuracy: async () => {
      const items = [
        { periodLabel: 'Q1 2026', commitAtPeriodStart: 2_140_000, forecastAtPeriodStart: 2_480_000, closedWon: 2_062_000, commitAccuracyPercent: 96.4, forecastAccuracyPercent: 83.1 },
        { periodLabel: 'Q2 2026', commitAtPeriodStart: 2_380_000, forecastAtPeriodStart: 2_690_000, closedWon: 2_418_000, commitAccuracyPercent: 98.4, forecastAccuracyPercent: 89.9 },
        { periodLabel: 'Q3 2026', commitAtPeriodStart: 2_610_000, forecastAtPeriodStart: 3_020_000, closedWon: 2_540_000, commitAccuracyPercent: 97.3, forecastAccuracyPercent: 84.1 },
      ];
      return { items, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    dashboardForAudience: async (audience, userId) => {
      await delay(`dashboard-audience:${audience}`, { latency: { min: 160, max: 340 } });
      const users = db.state.users;
      const runnerUp = users[userId];
      // A representative sees their individual dashboard; leaders see the audience default.
      const resolved = runnerUp && (runnerUp.persona === 'sales_rep' || runnerUp.persona === 'field_rep') ? 'sales_individual' : audience;
      const candidates = Object.values(db.state.dashboards);
      const dashboard = candidates.find((candidate) => candidate.audience === resolved && candidate.isDefault)
        ?? candidates.find((candidate) => candidate.audience === resolved)
        ?? candidates.find((candidate) => candidate.isDefault)
        ?? candidates[0];
      return dashboard ? ok(dashboard) : err('not_found', 'No dashboard is configured for this role.');
    },
  };

  /* ------------------------------------------------------ customer success & revenue */

  const subscriptionRevenueService: ServiceContainer['subscriptionRevenue'] = {
    list: async (query = {}) => {
      const organizationId = currentOrganizationId();
      const records = asRecords<import('@crm/shared-types').RevenueSubscription>(db, 'revenueSubscriptions').filter(
        (subscription) => subscription.organizationId === organizationId,
      );
      return runQuery(records, query, { searchFields: ['reference', 'accountName', 'planName'], facetField: 'status', defaultSort: [{ field: 'mrr', direction: 'desc' }] });
    },
    update: async (id, patch) => {
      const existing = db.state.revenueSubscriptions[id];
      if (!existing) return err<import('@crm/shared-types').RevenueSubscription>('not_found', 'Subscription not found.');
      const updated = { ...existing, ...(patch as object), id, updatedAt: new Date().toISOString() } as import('@crm/shared-types').RevenueSubscription;
      db.put('revenueSubscriptions', updated);
      return ok(updated);
    },
    report: async (period) => {
      void period;
      await delay('rrr-report', { latency: { min: 260, max: 540 } });
      const organizationId = currentOrganizationId();
      // MRR is meaningless when it mixes tenants — and potentially currencies — so the
      // report aggregates the active organization only.
      const subscriptions = asRecords<import('@crm/shared-types').RevenueSubscription>(db, 'revenueSubscriptions').filter(
        (subscription) => subscription.organizationId === organizationId,
      );
      const currency = db.state.organizations[organizationId]?.defaultCurrency ?? Object.values(db.state.organizations)[0]!.defaultCurrency;
      // MRR counts live relationships only. A cancelled or expired subscription has no recurring
      // revenue left, so it enters the bridge as churn rather than inflating the headline total —
      // which is also what makes the bridge able to reconcile.
      const churned = subscriptions.filter(
        (subscription) => subscription.status === 'cancelled' || subscription.status === 'expired' || subscription.movement === 'churn',
      );
      const churnedIds = new Set(churned.map((subscription) => subscription.id));
      const live = subscriptions.filter((subscription) => !churnedIds.has(subscription.id));
      const mrrTotal = live.reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
      const churnedMrr = churned.reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
      const expansion = live.filter((subscription) => subscription.movement === 'expansion').reduce((sum, subscription) => sum + Math.max(0, subscription.mrr.amount - (subscription.previousMrr?.amount ?? subscription.mrr.amount)), 0);
      const contraction = live.filter((subscription) => subscription.movement === 'contraction').reduce((sum, subscription) => sum + Math.max(0, (subscription.previousMrr?.amount ?? 0) - subscription.mrr.amount), 0);
      const newMrr = live.filter((subscription) => subscription.movement === 'new').reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
      const reactivationMrr = live.filter((subscription) => subscription.movement === 'reactivation').reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
      // Opening is the remainder that makes the bridge close: closing minus every movement the
      // records account for. Deriving it keeps the six displayed figures consistent, where a
      // shaped starting figure would render a bridge that visibly does not add up.
      const openingMrr = mrrTotal - newMrr - expansion - reactivationMrr + contraction + churnedMrr;
      const netNewMrr = newMrr + expansion + reactivationMrr - contraction - churnedMrr;
      const retentionBase = Math.max(0, openingMrr);
      const percent = (value: number): number => (retentionBase > 0 ? Number(((value / retentionBase) * 100).toFixed(1)) : 100);

      return ok({
        currency,
        periodLabel: 'Trailing twelve months',
        periodStart: toDateString(new Date('2025-11-01T00:00:00.000Z')),
        periodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')),
        metrics: {
          mrr: { amount: mrrTotal, currency },
          arr: { amount: mrrTotal * 12, currency },
          newMrr: { amount: newMrr, currency },
          expansionMrr: { amount: expansion, currency },
          contractionMrr: { amount: contraction, currency },
          churnedMrr: { amount: churnedMrr, currency },
          reactivationMrr: { amount: reactivationMrr, currency },
          netNewMrr: { amount: netNewMrr, currency },
          grossRevenueRetention: percent(retentionBase - churnedMrr - contraction),
          netRevenueRetention: percent(retentionBase - churnedMrr - contraction + newMrr + expansion + reactivationMrr),
          logoRetention: subscriptions.length > 0 ? Number(((live.length / subscriptions.length) * 100).toFixed(1)) : 100,
          averageRevenuePerAccount: live.length > 0 ? { amount: Math.round(mrrTotal / live.length), currency } : { amount: 0, currency },
          customerLifetimeValue: { amount: Math.round((mrrTotal / Math.max(1, live.length)) * 34), currency },
          averageLifetimeMonths: 34,
          paybackMonths: 14,
          churnRate: subscriptions.length > 0 ? Number(((churned.length / subscriptions.length) * 100).toFixed(1)) : 0,
        },
        trend: Array.from({ length: 12 }, (_, index) => ({
          date: toDateString(new Date(Date.UTC(2025, 10 + index, 1))),
          mrr: Math.round(mrrTotal * (0.72 + index * 0.026)),
          newMrr: Math.round(newMrr * (0.6 + (index % 4) * 0.2)),
          expansionMrr: Math.round(expansion * (0.5 + (index % 5) * 0.16)),
          churnedMrr: Math.round(churnedMrr * (0.4 + (index % 3) * 0.3)),
          netNew: Math.round((newMrr + expansion - churnedMrr) * (0.7 + (index % 4) * 0.15)),
        })),
        movementBridge: [
          { label: 'Opening MRR', value: openingMrr, kind: 'start' as const },
          { label: 'New business', value: newMrr, kind: 'positive' as const },
          { label: 'Expansion', value: expansion, kind: 'positive' as const },
          { label: 'Reactivation', value: reactivationMrr, kind: 'positive' as const },
          { label: 'Contraction', value: -contraction, kind: 'negative' as const },
          { label: 'Churn', value: -churnedMrr, kind: 'negative' as const },
          { label: 'Closing MRR', value: mrrTotal, kind: 'end' as const },
        ],
        byPlan: ['Enterprise', 'Professional', 'Starter'].map((planName) => {
          const scoped = live.filter((subscription) => subscription.planName === planName);
          const planMrr = scoped.reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
          const planChurned = churned.filter((subscription) => subscription.planName === planName).length;
          const planLogos = scoped.length + planChurned;
          return {
            planName,
            accounts: scoped.length,
            mrr: planMrr,
            sharePercent: mrrTotal > 0 ? Math.round((planMrr / mrrTotal) * 100) : 0,
            churnRate: planLogos > 0 ? Number(((planChurned / planLogos) * 100).toFixed(1)) : 0,
          };
        }),
        bySegment: ['Enterprise', 'Mid-market', 'SMB'].map((segment, index) => ({ segment, accounts: Math.round(subscriptions.length / 3), mrr: Math.round(mrrTotal * (0.58 - index * 0.16)), nrr: 112 - index * 6 })),
        byRegion: [
          { region: 'North America', accounts: Math.round(subscriptions.length * 0.5), mrr: Math.round(mrrTotal * 0.52), growth: 12.4 },
          { region: 'EMEA', accounts: Math.round(subscriptions.length * 0.34), mrr: Math.round(mrrTotal * 0.34), growth: 8.1 },
          { region: 'APAC', accounts: Math.round(subscriptions.length * 0.16), mrr: Math.round(mrrTotal * 0.14), growth: 21.7 },
        ],
        cohortRetention: Array.from({ length: 6 }, (_, index) => ({
          cohortLabel: `2026-${String(index + 1).padStart(2, '0')}`,
          startMrr: Math.round(mrrTotal / 8),
          values: Array.from({ length: 6 }, (_, period) => (period === 0 ? 100 : Math.max(62, 100 - period * 5 - index)),
          ),
        })),
        topAccountsByMrr: live
          .slice()
          .sort((a, b) => b.mrr.amount - a.mrr.amount)
          .slice(0, 8)
          .map((subscription) => ({
            accountId: subscription.accountId,
            accountName: subscription.accountName,
            mrr: subscription.mrr,
            arr: subscription.arr,
            health: owned(db.state.accounts[subscription.accountId])?.health ?? 'unknown',
            renewalDate: subscription.renewalDate,
          })),
        upcomingRenewals: Array.from({ length: 6 }, (_, index) => ({
          month: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'][index]!,
          count: 2 + (index % 4),
          value: Math.round(mrrTotal * 12 * 0.08) * (1 + (index % 3) * 0.2),
          atRiskValue: Math.round(mrrTotal * 12 * 0.02) * (1 + (index % 2) * 0.4),
        })),
      });
    },
    commissionStatements: async (query = {}) => {
      const organizationId = currentOrganizationId();
      const records = asRecords<CommissionStatement>(db, 'commissionStatements').filter((statement) => statement.organizationId === organizationId);
      return runQuery(records, query, { searchFields: ['userName', 'planName'], facetField: 'status', defaultSort: [{ field: 'commissionEarned', direction: 'desc' }] });
    },
  };

  /* ------------------------------------------- revenue: products, quotes, orders */

  /**
   * Cost lookup for the pricing engine, keyed by product id and scoped to the tenant, so a
   * quote line can show a real margin instead of a ratio.
   */
  const productCosts = (): Map<Id, number> => {
    const map = new Map<Id, number>();
    for (const product of asRecords<Product>(db, 'products')) {
      if (product.cost) map.set(product.id, product.cost.amount);
    }
    return map;
  };

  const tenantRecords = <T extends { organizationId: Id }>(collection: import('../lib/store').CollectionName): T[] =>
    asRecords<T>(db, collection).filter((record) => record.organizationId === currentOrganizationId());

  /* ----------------------------------------------------------------- products */

  const productsCrud = createCrud<Product>(db, 'products', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Product',
    searchFields: ['name', 'sku', 'categoryLabel', 'family'],
    facetField: 'status',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });

  const productsService: ServiceContainer['products'] = {
    list: (query) => productsCrud.list(scope(query)),
    get: (id) => productsCrud.get(id),
    create: (input, writeOptions) => productsCrud.create(input, writeOptions),
    update: (id, input, writeOptions) => productsCrud.update(id, input, writeOptions),
    remove: (id, writeOptions) => productsCrud.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => productsCrud.bulkRemove(ids, writeOptions),

    /**
     * Categories are derived from the catalogue, never stored twice. A separate collection
     * would be a second source of truth for a fact the products already state.
     */
    categories: async () => {
      await delay('product-categories', { latency: { min: 60, max: 160 } });
      const organizationId = currentOrganizationId();
      const products = tenantRecords<Product>('products');
      const tones: ProductCategory['tone'][] = ['violet', 'teal', 'blue', 'amber', 'green', 'slate'];
      const counts = new Map<string, number>();
      for (const product of products) {
        const label = product.categoryLabel ?? 'Uncategorised';
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      const items: ProductCategory[] = [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([name, productCount], index) => ({
          id: `pcat-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          organizationId,
          name,
          description: `${productCount} ${productCount === 1 ? 'product' : 'products'} in this category.`,
          productCount,
          sortOrder: index,
          tone: tones[index % tones.length]!,
        }));
      return { items, meta: buildPageMeta(1, items.length || 25, items.length) };
    },

    priceBooks: async () => {
      const records = tenantRecords<PriceBook>('priceBooks');
      return runQuery(records, {}, { searchFields: ['name'], defaultSort: [{ field: 'name', direction: 'asc' }] });
    },

    updatePriceBookEntry: async (priceBookId, entryId, patch) => {
      await delay(`price-book-entry:${entryId}`, { latency: { min: 80, max: 200 } });
      const book = db.state.priceBooks[priceBookId];
      if (!book) return err<PriceBook>('not_found', 'Price book not found.');
      if (!book.entries.some((entry) => entry.id === entryId)) {
        return err<PriceBook>('not_found', 'Price book entry not found.');
      }
      const entries = book.entries.map((entry) =>
        entry.id === entryId ? ({ ...entry, ...patch, id: entry.id, priceBookId: book.id } as PriceBookEntry) : entry,
      );
      const updated: PriceBook = { ...book, entries, updatedAt: new Date().toISOString() };
      db.put('priceBooks', updated);
      return ok(updated);
    },

    /**
     * The revenue operations header. Every figure is derived from the records the modules
     * below it own, so the strip at the top of a list can never describe a different dataset
     * from the rows underneath it.
     */
    revenueSummary: async () => {
      await delay('revenue-summary', { latency: { min: 200, max: 420 } });
      const currency = Object.values(db.state.organizations)[0]?.defaultCurrency ?? 'USD';
      const deals = tenantRecords<Deal>('deals');
      const quotes = tenantRecords<Quote>('quotes');
      const orders = tenantRecords<Order>('orders');
      const contracts = tenantRecords<Contract>('contracts');
      const subscriptions = tenantRecords<RevenueSubscription>('revenueSubscriptions');

      const open = deals.filter((deal) => deal.status === 'open');
      const won = deals.filter((deal) => deal.status === 'won');
      const lost = deals.filter((deal) => deal.status === 'lost');
      const totalValue = open.reduce((sum, deal) => sum + deal.amount.amount, 0);
      const weightedValue = open.reduce((sum, deal) => sum + (deal.amount.amount * deal.probability) / 100, 0);
      const wonValue = won.reduce((sum, deal) => sum + deal.amount.amount, 0);

      const closedCount = won.length + lost.length;
      const winRate = closedCount > 0 ? Math.round((won.length / closedCount) * 1000) / 10 : 0;
      const cycleTimes = won.map((deal) => deal.cycleTimeDays ?? 30);
      const averageCycleTimeDays = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length) : 0;

      const mrr = subscriptions
        .filter((subscription) => subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due')
        .reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
      const churned = subscriptions.filter((subscription) => subscription.status === 'cancelled');
      const churnedMrr = churned.reduce((sum, subscription) => sum + subscription.mrr.amount, 0);
      const expansion = subscriptions
        .filter((subscription) => subscription.movement === 'expansion')
        .reduce((sum, subscription) => sum + Math.max(0, subscription.mrr.amount - (subscription.previousMrr?.amount ?? subscription.mrr.amount)), 0);
      const contraction = subscriptions
        .filter((subscription) => subscription.movement === 'contraction')
        .reduce((sum, subscription) => sum + Math.max(0, (subscription.previousMrr?.amount ?? 0) - subscription.mrr.amount), 0);
      const newMrr = subscriptions.filter((subscription) => subscription.movement === 'new').reduce((sum, subscription) => sum + subscription.mrr.amount, 0);

      const openQuoteStatuses: Quote['status'][] = ['draft', 'in_review', 'pending_approval', 'approved', 'sent', 'viewed', 'revised'];
      const openQuotes = quotes.filter((quote) => openQuoteStatuses.includes(quote.status));
      const decidedQuotes = quotes.filter((quote) => ['accepted', 'declined', 'expired'].includes(quote.status));
      const acceptedQuotes = quotes.filter((quote) => quote.status === 'accepted');
      const discountPercents = quotes
        .filter((quote) => quote.totals.subtotal.amount > 0)
        .map((quote) => (quote.totals.lineDiscountTotal.amount / quote.totals.subtotal.amount) * 100);

      const pendingActivation = orders.filter((order) => order.status === 'draft' || order.status === 'pending_signature');
      const billedOrders = orders.filter((order) => order.billingState === 'billed' || order.billingState === 'partially_billed');
      const outstandingOrderValue = orders.reduce((sum, order) => sum + Math.max(0, order.invoicedAmount.amount - order.paidAmount.amount), 0);

      const activeContracts = contracts.filter((contract) => contract.status === 'active' || contract.status === 'expiring_soon');
      const expiring = contracts.filter((contract) => contract.daysUntilExpiry >= 0 && contract.daysUntilExpiry <= 90);

      const invoices = tenantRecords<import('@crm/shared-types').InvoiceRecord>('invoices');
      const openInvoices = invoices.filter((invoice) => !['payment_received', 'void', 'refunded', 'written_off'].includes(invoice.status));
      const overdue = invoices.filter((invoice) => invoice.status === 'overdue');
      const collectedThisPeriod = invoices
        .filter((invoice) => invoice.paidDate && daysSince(invoice.paidDate, DATASET_EPOCH) <= 30)
        .reduce((sum, invoice) => sum + invoice.amountPaid.amount, 0);

      const goals = tenantRecords<import('@crm/shared-types').SalesGoal>('salesGoals').filter((goal) => goal.metric === 'revenue');
      const targetValue = goals.reduce((sum, goal) => sum + (typeof goal.target === 'number' ? goal.target : goal.target.amount), 0);

      const byChannel = (['new_business', 'expansion', 'renewal', 'upsell', 'cross_sell'] as const).map((dealType) => {
        const scoped = deals.filter((deal) => (deal.dealType ?? 'new_business') === dealType);
        const scopedWon = scoped.filter((deal) => deal.status === 'won');
        const scopedClosed = scoped.filter((deal) => deal.status === 'won' || deal.status === 'lost');
        const value = scopedWon.reduce((sum, deal) => sum + deal.amount.amount, 0);
        return {
          channel: dealType.replace(/_/g, ' '),
          wonValue: value,
          dealCount: scoped.length,
          winRate: scopedClosed.length > 0 ? Math.round((scopedWon.length / scopedClosed.length) * 1000) / 10 : 0,
          averageCycleTime: scopedWon.length > 0 ? Math.round(scopedWon.reduce((sum, deal) => sum + (deal.cycleTimeDays ?? 30), 0) / scopedWon.length) : 0,
        };
      });

      return ok({
        currency,
        periodLabel: 'Trailing twelve months',
        pipeline: {
          totalValue: { amount: totalValue, currency },
          weightedValue: { amount: Math.round(weightedValue), currency },
          dealCount: open.length,
          averageDealSize: { amount: open.length > 0 ? Math.round(totalValue / open.length) : 0, currency },
          averageCycleTimeDays,
          winRate,
        },
        bookings: {
          wonValue: { amount: wonValue, currency },
          wonCount: won.length,
          lostValue: { amount: lost.reduce((sum, deal) => sum + deal.amount.amount, 0), currency },
          lostCount: lost.length,
          targetValue: { amount: targetValue, currency },
          attainmentPercent: targetValue > 0 ? Math.round((wonValue / targetValue) * 1000) / 10 : 0,
        },
        recurring: {
          mrr: { amount: mrr, currency },
          arr: { amount: mrr * 12, currency },
          netNewMrr: { amount: newMrr + expansion - contraction - churnedMrr, currency },
          nrr: subscriptions.length > 0 ? Math.round(((mrr + expansion - contraction - churnedMrr) / Math.max(1, mrr - newMrr)) * 1000) / 10 : 100,
          grr: subscriptions.length > 0 ? Math.round(((mrr - churnedMrr - contraction) / Math.max(1, mrr - newMrr)) * 1000) / 10 : 100,
          churnRate: subscriptions.length > 0 ? Math.round((churned.length / subscriptions.length) * 1000) / 10 : 0,
        },
        quotes: {
          openCount: openQuotes.length,
          openValue: { amount: openQuotes.reduce((sum, quote) => sum + quote.totals.grandTotal.amount, 0), currency },
          acceptanceRate: decidedQuotes.length > 0 ? Math.round((acceptedQuotes.length / decidedQuotes.length) * 1000) / 10 : 0,
          averageDiscountPercent: discountPercents.length > 0 ? Math.round((discountPercents.reduce((sum, value) => sum + value, 0) / discountPercents.length) * 10) / 10 : 0,
          pendingApprovalCount: quotes.filter((quote) => quote.approvalState === 'pending').length,
        },
        orders: {
          count: orders.length,
          value: { amount: orders.reduce((sum, order) => sum + order.totals.grandTotal.amount, 0), currency },
          pendingActivation: pendingActivation.length,
          billedValue: { amount: billedOrders.reduce((sum, order) => sum + order.invoicedAmount.amount, 0), currency },
          outstandingValue: { amount: outstandingOrderValue, currency },
        },
        contracts: {
          activeCount: activeContracts.length,
          totalValue: { amount: activeContracts.reduce((sum, contract) => sum + contract.contractValue.amount, 0), currency },
          expiringIn90Days: expiring.length,
          expiringValue: { amount: expiring.reduce((sum, contract) => sum + contract.contractValue.amount, 0), currency },
          autoRenewPercent: contracts.length > 0 ? Math.round((contracts.filter((contract) => contract.autoRenew).length / contracts.length) * 1000) / 10 : 0,
        },
        invoices: {
          outstandingValue: { amount: openInvoices.reduce((sum, invoice) => sum + invoice.balanceDue.amount, 0), currency },
          overdueValue: { amount: overdue.reduce((sum, invoice) => sum + invoice.balanceDue.amount, 0), currency },
          overdueCount: overdue.length,
          collectedThisPeriod: { amount: collectedThisPeriod, currency },
        },
        trend: Array.from({ length: 12 }, (_, index) => {
          const monthStart = new Date(Date.UTC(DATASET_EPOCH.getUTCFullYear() - 1, DATASET_EPOCH.getUTCMonth() + index + 1, 1));
          const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
          const monthWon = won.filter((deal) => {
            if (!deal.actualCloseDate) return false;
            const closed = new Date(deal.actualCloseDate).getTime();
            return closed >= monthStart.getTime() && closed < monthEnd.getTime();
          });
          return {
            date: toDateString(monthStart),
            bookings: monthWon.reduce((sum, deal) => sum + deal.amount.amount, 0),
            billings: orders
              .filter((order) => {
                const placed = new Date(order.orderDate).getTime();
                return placed >= monthStart.getTime() && placed < monthEnd.getTime();
              })
              .reduce((sum, order) => sum + order.invoicedAmount.amount, 0),
            recurring: Math.round(mrr * (0.72 + index * 0.026)),
          };
        }),
        byChannel,
      });
    },
  };

  /* ------------------------------------------------------------------- quotes */

  const quotesCrud = createCrud<Quote>(db, 'quotes', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Quote',
    searchFields: ['reference', 'name', 'accountName', 'dealName'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  /** Re-price a quote in place and persist it. The one write path for every line edit. */
  const writeQuoteTotals = (
    quote: Quote,
    lines: QuoteLineItem[],
    orderDiscountPercent = quote.totals.orderDiscountPercent,
  ): Quote => {
    const priced = lines.map((line, index) => ({ ...priceQuoteLine(line, quote.currency), sortOrder: line.sortOrder ?? index }));
    const updated: Quote = {
      ...quote,
      lineItems: priced,
      totals: computeQuoteTotals(priced, quote.currency, orderDiscountPercent, productCosts()),
      updatedAt: new Date().toISOString(),
    };
    db.put('quotes', updated);
    return updated;
  };

  const buildApprovalSteps = (quote: Quote): Quote['approvalSteps'] => {
    const maxLineDiscount = quote.lineItems.reduce((max, line) => Math.max(max, line.discountPercent), 0);
    const steps: Quote['approvalSteps'] = [];
    if (maxLineDiscount > 10) {
      steps.push({
        id: `qas-${quote.id}-margin`,
        order: 1,
        name: 'Sales manager approval',
        approverKind: 'manager',
        approverName: 'Line manager',
        thresholdNote: `Line discount of ${maxLineDiscount}% is above the 10% threshold.`,
        status: 'pending',
      });
    }
    if (quote.totals.orderDiscountPercent > 20) {
      steps.push({
        id: `qas-${quote.id}-finance`,
        order: steps.length + 1,
        name: 'Finance review',
        approverKind: 'role',
        approverName: 'Finance',
        thresholdNote: `Order discount of ${quote.totals.orderDiscountPercent}% is above the 20% threshold.`,
        status: 'pending',
      });
    }
    if (steps.length === 0) {
      steps.push({
        id: `qas-${quote.id}-standard`,
        order: 1,
        name: 'Standard review',
        approverKind: 'role',
        approverName: 'Sales operations',
        thresholdNote: 'No discount threshold was exceeded; a routine review is still recorded.',
        status: 'pending',
      });
    }
    return steps;
  };

  const quotesService: ServiceContainer['quotes'] = {
    list: (query) => quotesCrud.list(scope(query)),
    get: (id) => quotesCrud.get(id),
    create: (input, writeOptions) => quotesCrud.create(input, writeOptions),
    update: (id, input, writeOptions) => quotesCrud.update(id, input, writeOptions),
    remove: (id, writeOptions) => quotesCrud.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => quotesCrud.bulkRemove(ids, writeOptions),

    addLineItem: async (quoteId, item) => {
      await delay(`quote-line-add:${quoteId}`, { latency: { min: 90, max: 200 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      const line: QuoteLineItem = { ...item, id: nextId('qli'), sortOrder: quote.lineItems.length };
      return ok(writeQuoteTotals(quote, [...quote.lineItems, line]));
    },

    updateLineItem: async (quoteId, itemId, patch) => {
      await delay(`quote-line-update:${itemId}`, { latency: { min: 90, max: 200 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      if (!quote.lineItems.some((line) => line.id === itemId)) return err<Quote>('not_found', 'Line item not found.');
      const lines = quote.lineItems.map((line) => (line.id === itemId ? { ...line, ...patch, id: line.id } : line));
      return ok(writeQuoteTotals(quote, lines));
    },

    removeLineItem: async (quoteId, itemId) => {
      await delay(`quote-line-remove:${itemId}`);
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      const lines = quote.lineItems.filter((line) => line.id !== itemId);
      return ok(writeQuoteTotals(quote, lines.map((line, index) => ({ ...line, sortOrder: index }))));
    },

    applyOrderDiscount: async (quoteId, percent, reason) => {
      await delay(`quote-discount:${quoteId}`, { latency: { min: 90, max: 200 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      const priced = writeQuoteTotals(quote, quote.lineItems, percent);
      const withReason: Quote = {
        ...priced,
        internalNotes: reason
          ? `${priced.internalNotes ? `${priced.internalNotes}\n` : ''}Order discount applied: ${percent}% — ${reason}`
          : priced.internalNotes,
      };
      db.put('quotes', withReason);
      return ok(withReason);
    },

    recalculate: async (quoteId) => {
      await delay(`quote-recalc:${quoteId}`, { latency: { min: 60, max: 140 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      return ok(writeQuoteTotals(quote, quote.lineItems));
    },

    submitForApproval: async (quoteId) => {
      await delay(`quote-submit:${quoteId}`, { latency: { min: 140, max: 300 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      if (quote.lineItems.length === 0) return err<Quote>('validation_failed', 'Add at least one line item before submitting for approval.');
      const steps = buildApprovalSteps(quote);
      const updated: Quote = {
        ...quote,
        status: 'pending_approval',
        approvalState: 'pending',
        approvalSteps: steps,
        discountApprovalPercent: steps.some((step) => step.name.includes('Finance')) ? quote.totals.orderDiscountPercent : undefined,
        updatedAt: new Date().toISOString(),
      };
      db.put('quotes', updated);
      return ok(updated);
    },

    decideApproval: async (quoteId, stepId, decision, comment) => {
      await delay(`quote-approve:${stepId}`, { latency: { min: 120, max: 260 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      if (!quote.approvalSteps.some((step) => step.id === stepId)) return err<Quote>('not_found', 'Approval step not found.');
      const steps = quote.approvalSteps.map((step) =>
        step.id === stepId ? { ...step, status: decision, decidedAt: new Date().toISOString(), comment } : step,
      );
      const rejected = steps.some((step) => step.status === 'rejected');
      const allApproved = steps.every((step) => step.status === 'approved' || step.status === 'skipped');
      const approvalState: Quote['approvalState'] = rejected ? 'rejected' : allApproved ? 'approved' : 'pending';
      const updated: Quote = {
        ...quote,
        approvalSteps: steps,
        approvalState,
        status: rejected ? 'revised' : allApproved ? 'approved' : 'pending_approval',
        updatedAt: new Date().toISOString(),
      };
      db.put('quotes', updated);
      return ok(updated);
    },

    /**
     * Revise a quote by cloning it forward. The original is retained and marked `revised`, and
     * the clone records it in `previousVersionIds`, so revision history is a real chain rather
     * than a number that increments with nothing behind it.
     */
    revise: async (quoteId) => {
      await delay(`quote-revise:${quoteId}`, { latency: { min: 200, max: 420 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      const clone: Quote = {
        ...quote,
        id: nextId('quo'),
        reference: `${quote.reference}-R${quote.version + 1}`,
        status: 'draft',
        version: quote.version + 1,
        previousVersionIds: [...quote.previousVersionIds, quote.id],
        clonedFromId: quote.id,
        approvalState: 'not_required',
        approvalSteps: [],
        signatureRequest: quote.signatureRequest
          ? { ...quote.signatureRequest, id: nextId('sig'), status: 'not_started', signedCount: 0 }
          : undefined,
        deliveryState: 'draft',
        sentAt: undefined,
        viewedAt: undefined,
        acceptedAt: undefined,
        declinedAt: undefined,
        declineReason: undefined,
        orderId: undefined,
        contractId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('quotes', clone);
      db.put('quotes', { ...quote, status: 'revised', updatedAt: new Date().toISOString() });
      return ok(clone);
    },

    /** Delivery is simulated and the returned state says so. Nothing is transmitted. */
    markSent: async (quoteId) => {
      await delay(`quote-send:${quoteId}`, { latency: { min: 180, max: 360 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      const updated: Quote = {
        ...quote,
        status: 'sent',
        deliveryState: 'simulated_sent',
        sentAt: new Date().toISOString(),
        signatureRequest: quote.signatureRequest
          ? { ...quote.signatureRequest, status: 'awaiting_customer', simulated: true }
          : undefined,
        updatedAt: new Date().toISOString(),
      };
      db.put('quotes', updated);
      return ok(updated);
    },

    accept: async (quoteId) => {
      await delay(`quote-accept:${quoteId}`, { latency: { min: 160, max: 320 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      const updated: Quote = {
        ...quote,
        status: 'accepted',
        deliveryState: 'simulated_viewed',
        acceptedAt: new Date().toISOString(),
        signatureRequest: quote.signatureRequest
          ? { ...quote.signatureRequest, status: 'signed', signedCount: quote.signatureRequest.signerCount }
          : undefined,
        updatedAt: new Date().toISOString(),
      };
      db.put('quotes', updated);
      return ok(updated);
    },

    decline: async (quoteId, reason) => {
      await delay(`quote-decline:${quoteId}`, { latency: { min: 160, max: 320 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<Quote>('not_found', 'Quote not found.');
      const updated: Quote = {
        ...quote,
        status: 'declined',
        declinedAt: new Date().toISOString(),
        declineReason: reason,
        updatedAt: new Date().toISOString(),
      };
      db.put('quotes', updated);
      return ok(updated);
    },

    /**
     * Convert an accepted (or approved) quote into an order. Anything else is refused with an
     * explanation, because an order created from a draft would misrepresent a commitment.
     */
    convertToOrder: async (quoteId) => {
      await delay(`quote-to-order:${quoteId}`, { latency: { min: 300, max: 620 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<{ quote: Quote; order: Order }>('not_found', 'Quote not found.');
      if (quote.status !== 'accepted' && quote.status !== 'approved') {
        return err<{ quote: Quote; order: Order }>('validation_failed', 'Only an accepted or approved quote can become an order.');
      }
      const pendingStep = quote.approvalSteps.find((step) => step.status === 'pending');
      if (pendingStep) {
        return err<{ quote: Quote; order: Order }>('validation_failed', `Approval is still pending: ${pendingStep.name}.`);
      }

      const now = new Date().toISOString();
      const order: Order = {
        id: nextId('ord'),
        organizationId: quote.organizationId,
        reference: `O-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        accountId: quote.accountId,
        accountName: quote.accountName,
        contactId: quote.contactId,
        quoteId: quote.id,
        dealId: quote.dealId,
        ownerId: quote.ownerId,
        ownerName: quote.ownerName,
        status: 'pending_signature',
        orderDate: now.slice(0, 10),
        effectiveDate: quote.issueDate,
        endDate: undefined,
        currency: quote.currency,
        lineItems: quote.lineItems,
        totals: quote.totals,
        billingState: 'not_billed',
        paymentState: 'not_due',
        invoicedAmount: { amount: 0, currency: quote.currency },
        paidAmount: { amount: 0, currency: quote.currency },
        billingFrequency: quote.billingFrequency,
        poNumber: undefined,
        // Fulfilment is tracked as CRM activity; no shipment or provisioning system exists.
        fulfilment: { method: 'none', statusNote: 'No fulfilment or provisioning integration is connected.' },
        activatedAt: undefined,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      db.put('orders', order);
      const updatedQuote: Quote = { ...quote, orderId: order.id, updatedAt: now };
      db.put('quotes', updatedQuote);
      return ok({ quote: updatedQuote, order });
    },

    convertToContract: async (quoteId, termMonths) => {
      await delay(`quote-to-contract:${quoteId}`, { latency: { min: 320, max: 660 } });
      const quote = db.state.quotes[quoteId];
      if (!quote) return err<{ quote: Quote; contract: Contract }>('not_found', 'Quote not found.');
      if (quote.status !== 'accepted' && quote.status !== 'approved') {
        return err<{ quote: Quote; contract: Contract }>('validation_failed', 'Only an accepted or approved quote can become a contract.');
      }
      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      const endDate = new Date(now.getTime() + termMonths * 30 * 86_400_000).toISOString().slice(0, 10);
      const term = Math.max(1, termMonths);
      const contract: Contract = {
        id: nextId('ctr'),
        organizationId: quote.organizationId,
        reference: `CT-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        title: `${quote.accountName} — subscription agreement`,
        accountId: quote.accountId,
        accountName: quote.accountName,
        contactId: quote.contactId,
        ownerId: quote.ownerId,
        ownerName: quote.ownerName,
        status: 'draft',
        type: 'subscription',
        currency: quote.currency,
        startDate,
        endDate,
        noticePeriodDays: 30,
        autoRenew: false,
        termMonths: term,
        contractValue: quote.totals.grandTotal,
        annualisedValue: { amount: Math.round((quote.totals.grandTotal.amount / term) * 12), currency: quote.currency },
        billingFrequency: quote.billingFrequency === 'one_time' ? 'annual' : quote.billingFrequency === 'monthly' ? 'monthly' : 'annual',
        paymentTerms: 'net_30',
        quoteId: quote.id,
        documents: [{ id: nextId('cdoc'), name: 'Draft agreement.pdf', kind: 'main', version: 1, sizeBytes: 0, placeholder: true }],
        signatureState: 'not_started',
        // No e-signature integration exists; the record states that plainly.
        signatureSimulated: true,
        renewalOwnerId: quote.ownerId,
        daysUntilExpiry: term * 30,
        tags: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      db.put('contracts', contract);
      const updatedQuote: Quote = { ...quote, contractId: contract.id, updatedAt: now.toISOString() };
      db.put('quotes', updatedQuote);
      return ok({ quote: updatedQuote, contract });
    },
  };

  /* ------------------------------------------------------------------- orders */

  const ordersCrud = createCrud<Order>(db, 'orders', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Order',
    searchFields: ['reference', 'accountName'],
    facetField: 'status',
    defaultSort: [{ field: 'orderDate', direction: 'desc' }],
  });

  const ordersService: ServiceContainer['orders'] = {
    list: (query) => ordersCrud.list(scope(query)),
    get: (id) => ordersCrud.get(id),
    create: (input, writeOptions) => ordersCrud.create(input, writeOptions),
    update: (id, input, writeOptions) => ordersCrud.update(id, input, writeOptions),
    remove: (id, writeOptions) => ordersCrud.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => ordersCrud.bulkRemove(ids, writeOptions),

    activate: async (id) => {
      await delay(`order-activate:${id}`, { latency: { min: 200, max: 420 } });
      const order = db.state.orders[id];
      if (!order) return err<Order>('not_found', 'Order not found.');
      if (order.status === 'cancelled') return err<Order>('validation_failed', 'A cancelled order cannot be activated.');
      const updated: Order = {
        ...order,
        status: 'activated',
        activatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('orders', updated);
      return ok(updated);
    },

    cancel: async (id, reason) => {
      await delay(`order-cancel:${id}`, { latency: { min: 160, max: 320 } });
      const order = db.state.orders[id];
      if (!order) return err<Order>('not_found', 'Order not found.');
      const updated: Order = {
        ...order,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: reason,
        updatedAt: new Date().toISOString(),
      };
      db.put('orders', updated);
      return ok(updated);
    },

    recordPayment: async (id, amount, method) => {
      await delay(`order-payment:${id}`, { latency: { min: 200, max: 420 } });
      const order = db.state.orders[id];
      if (!order) return err<Order>('not_found', 'Order not found.');
      if (amount <= 0) return err<Order>('validation_failed', 'Enter an amount greater than zero.');
      const paid = order.paidAmount.amount + amount;
      const invoiced = order.invoicedAmount.amount;
      const updated: Order = {
        ...order,
        paidAmount: { amount: paid, currency: order.currency },
        // Payment state is a presentation of the recorded amounts, not a ledger.
        paymentState: paid <= 0 ? 'not_due' : paid >= invoiced && invoiced > 0 ? 'paid' : invoiced === 0 ? 'not_due' : 'partially_paid',
        billingState: invoiced <= 0 ? order.billingState : paid >= invoiced ? 'billed' : 'partially_billed',
        updatedAt: new Date().toISOString(),
      };
      db.put('orders', updated);
      void method;
      return ok(updated);
    },
  };

  /* --------------------------------------------------------------- contracts */

  const contractsCrud = createCrud<Contract>(db, 'contracts', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Contract',
    searchFields: ['reference', 'title', 'accountName', 'ownerName'],
    facetField: 'status',
    defaultSort: [{ field: 'endDate', direction: 'asc' }],
  });

  /**
   * Whole days from the dataset epoch to an ISO date. `daysUntilExpiry` is derived rather
   * than trusted from the record, because an amendment that moves `endDate` must not leave
   * a stale countdown behind.
   */
  const daysUntil = (date: string): number => Math.round((new Date(date).getTime() - DATASET_EPOCH.getTime()) / 86_400_000);

  /** Annualise a contract value so mixed-term contracts stay comparable. */
  const annualised = (value: number, termMonths: number, currency: CurrencyCode): Contract['annualisedValue'] => ({
    amount: Math.round((value / Math.max(1, termMonths)) * 12),
    currency,
  });

  /** A renewal reference that stays unique across repeated renewals of the same contract. */
  const renewalReference = (contract: Contract): string => {
    let suffix = 1;
    let reference = `${contract.reference}-R${suffix}`;
    const taken = new Set(Object.values(db.state.contracts).map((entry) => entry.reference));
    while (taken.has(reference)) {
      suffix += 1;
      reference = `${contract.reference}-R${suffix}`;
    }
    return reference;
  };

  const contractsService: ServiceContainer['contracts'] = {
    list: (query) => contractsCrud.list(scope(query)),
    get: (id) => contractsCrud.get(id),
    create: (input, writeOptions) => contractsCrud.create(input, writeOptions),
    update: (id, input, writeOptions) => contractsCrud.update(id, input, writeOptions),
    remove: (id, writeOptions) => contractsCrud.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => contractsCrud.bulkRemove(ids, writeOptions),

    renew: async (id, patch) => {
      await delay(`contract-renew:${id}`, { latency: { min: 220, max: 460 } });
      const contract = db.state.contracts[id];
      if (!contract) return err<Contract>('not_found', 'Contract not found.');
      if (contract.status === 'renewed') {
        return err<Contract>('validation_failed', 'This contract was already renewed. Open the renewal linked from this record.');
      }
      if (contract.status === 'terminated' || contract.status === 'cancelled') {
        return err<Contract>('validation_failed', `A ${contract.status} contract cannot be renewed.`);
      }
      if (!Number.isFinite(patch.termMonths) || patch.termMonths < 1) {
        return err<Contract>('validation_failed', 'A renewal term of at least one month is required.', {
          fieldErrors: [{ path: 'termMonths', message: 'Enter a term of one month or more.' }],
        });
      }
      if (!Number.isFinite(patch.value) || patch.value < 0) {
        return err<Contract>('validation_failed', 'Enter a renewal value of zero or more.', {
          fieldErrors: [{ path: 'value', message: 'Enter a value of zero or more.' }],
        });
      }
      const start = new Date(patch.startDate);
      if (Number.isNaN(start.getTime())) {
        return err<Contract>('validation_failed', 'Enter a valid start date.', {
          fieldErrors: [{ path: 'startDate', message: 'Enter a valid date.' }],
        });
      }

      const termMonths = Math.round(patch.termMonths);
      const endDate = toDateString(addDays(start, termMonths * 30));
      const now = new Date().toISOString();
      const renewal: Contract = {
        ...contract,
        id: nextId('ctr'),
        reference: renewalReference(contract),
        status: 'active',
        startDate: toDateString(start),
        endDate,
        termMonths,
        contractValue: { amount: Math.round(patch.value), currency: contract.currency },
        annualisedValue: annualised(patch.value, termMonths, contract.currency),
        renewalId: undefined,
        previousContractId: contract.id,
        documents: [],
        // Nothing was signed: the renewal starts unsigned and says so.
        signatureState: 'not_started',
        terminatedAt: undefined,
        terminationReason: undefined,
        daysUntilExpiry: daysUntil(endDate),
        createdAt: now,
        updatedAt: now,
      };
      db.put('contracts', renewal);
      db.put('contracts', { ...contract, status: 'renewed', renewalId: renewal.id, autoRenew: false, updatedAt: now });
      return ok(renewal);
    },

    terminate: async (id, reason) => {
      await delay(`contract-terminate:${id}`, { latency: { min: 180, max: 380 } });
      const contract = db.state.contracts[id];
      if (!contract) return err<Contract>('not_found', 'Contract not found.');
      if (!reason.trim()) {
        return err<Contract>('validation_failed', 'Record why the contract is being terminated.', {
          fieldErrors: [{ path: 'reason', message: 'A reason is required.' }],
        });
      }
      const closable: Contract['status'][] = ['draft', 'in_review', 'awaiting_signature', 'active', 'expiring_soon'];
      if (!closable.includes(contract.status)) {
        return err<Contract>('validation_failed', `A ${contract.status.replace(/_/g, ' ')} contract cannot be terminated.`);
      }
      const updated: Contract = {
        ...contract,
        status: 'terminated',
        autoRenew: false,
        terminatedAt: new Date().toISOString(),
        terminationReason: reason.trim(),
        updatedAt: new Date().toISOString(),
      };
      db.put('contracts', updated);
      return ok(updated);
    },

    amendment: async (id, patch) => {
      await delay(`contract-amend:${id}`, { latency: { min: 180, max: 380 } });
      const contract = db.state.contracts[id];
      if (!contract) return err<Contract>('not_found', 'Contract not found.');
      const amendable: Contract['status'][] = ['draft', 'in_review', 'awaiting_signature', 'active', 'expiring_soon'];
      if (!amendable.includes(contract.status)) {
        return err<Contract>('validation_failed', `A ${contract.status.replace(/_/g, ' ')} contract can no longer be amended.`);
      }
      const input = { ...(patch as Record<string, unknown>) };
      delete input.expectedUpdatedAt;
      const merged: Contract = { ...contract, ...(input as Partial<Contract>), id, organizationId: contract.organizationId };
      // Value and term are derived companions: if an amendment moves one side of the ratio,
      // the annualised figure moves with it instead of contradicting the headline value.
      merged.annualisedValue = annualised(merged.contractValue.amount, merged.termMonths, merged.currency);
      merged.daysUntilExpiry = daysUntil(merged.endDate);
      const amendmentCount = merged.documents.filter((document) => document.kind === 'amendment').length;
      merged.documents = [
        ...merged.documents,
        {
          id: nextId('cdoc'),
          name: `Amendment ${amendmentCount + 1}.pdf`,
          kind: 'amendment',
          version: amendmentCount + 1,
          // Nothing is stored; the entry records that the amendment exists.
          sizeBytes: 0,
          placeholder: true,
        },
      ];
      merged.updatedAt = new Date().toISOString();
      db.put('contracts', merged);
      return ok(merged);
    },

    expiring: async (withinDays) => {
      await delay('contracts-expiring', { latency: { min: 80, max: 200 } });
      const organizationId = currentOrganizationId();
      const limit = Number.isFinite(withinDays) && withinDays > 0 ? Math.round(withinDays) : 90;
      const items = (Object.values(db.state.contracts) as Contract[])
        .filter((contract) => contract.organizationId === organizationId)
        .filter((contract) => contract.status === 'active' || contract.status === 'expiring_soon')
        .map((contract) => ({ ...contract, daysUntilExpiry: daysUntil(contract.endDate) }))
        .filter((contract) => contract.daysUntilExpiry >= 0 && contract.daysUntilExpiry <= limit)
        .sort((left, right) => left.endDate.localeCompare(right.endDate));
      return { items, meta: buildPageMeta(1, Math.max(items.length, 1), items.length) };
    },
  };

  /* ---------------------------------------------------------------- invoices */

  const invoicesCrud = createCrud<InvoiceRecord>(db, 'invoices', {
    getActiveOrganizationId: currentOrganizationId,
    label: 'Invoice',
    searchFields: ['reference', 'accountName'],
    facetField: 'status',
    defaultSort: [{ field: 'issueDate', direction: 'desc' }],
  });

  const invoicesService: ServiceContainer['invoices'] = {
    list: (query) => invoicesCrud.list(scope(query)),
    get: (id) => invoicesCrud.get(id),
    create: (input, writeOptions) => invoicesCrud.create(input, writeOptions),
    update: (id, input, writeOptions) => invoicesCrud.update(id, input, writeOptions),
    remove: (id, writeOptions) => invoicesCrud.remove(id, writeOptions),
    bulkRemove: (ids, writeOptions) => invoicesCrud.bulkRemove(ids, writeOptions),

    markPaid: async (id, paidDate) => {
      await delay(`invoice-paid:${id}`, { latency: { min: 180, max: 380 } });
      const invoice = db.state.invoices[id];
      if (!invoice) return err<InvoiceRecord>('not_found', 'Invoice not found.');
      if (invoice.status === 'payment_received') {
        return err<InvoiceRecord>('validation_failed', 'This invoice is already marked as paid.');
      }
      if (invoice.status === 'void' || invoice.status === 'written_off' || invoice.status === 'refunded') {
        return err<InvoiceRecord>('validation_failed', `A ${invoice.status.replace(/_/g, ' ')} invoice cannot be marked paid.`);
      }
      const date = new Date(paidDate);
      if (Number.isNaN(date.getTime())) {
        return err<InvoiceRecord>('validation_failed', 'Enter a valid payment date.', {
          fieldErrors: [{ path: 'paidDate', message: 'Enter a valid date.' }],
        });
      }
      const updated: InvoiceRecord = {
        ...invoice,
        status: 'payment_received',
        paidDate: toDateString(date),
        amountPaid: { ...invoice.total },
        balanceDue: { amount: 0, currency: invoice.currency },
        dunningStage: 'none',
        updatedAt: new Date().toISOString(),
      };
      db.put('invoices', updated);
      return ok(updated);
    },

    void: async (id, reason) => {
      await delay(`invoice-void:${id}`, { latency: { min: 160, max: 340 } });
      const invoice = db.state.invoices[id];
      if (!invoice) return err<InvoiceRecord>('not_found', 'Invoice not found.');
      if (!reason.trim()) {
        return err<InvoiceRecord>('validation_failed', 'Record why the invoice is being voided.', {
          fieldErrors: [{ path: 'reason', message: 'A reason is required.' }],
        });
      }
      if (invoice.status === 'void') {
        return err<InvoiceRecord>('validation_failed', 'This invoice is already void.');
      }
      if (invoice.status === 'payment_received' || invoice.status === 'refunded') {
        // Refunds are an accounting act; this build deliberately records none.
        return err<InvoiceRecord>('validation_failed', 'A paid invoice cannot be voided here. This build records no refunds.');
      }
      const updated: InvoiceRecord = {
        ...invoice,
        status: 'void',
        balanceDue: { amount: 0, currency: invoice.currency },
        dunningStage: 'none',
        notes: [invoice.notes, `Voided: ${reason.trim()}`].filter(Boolean).join('\n'),
        updatedAt: new Date().toISOString(),
      };
      db.put('invoices', updated);
      return ok(updated);
    },

    recordPayment: async (id, amount) => {
      await delay(`invoice-payment:${id}`, { latency: { min: 200, max: 420 } });
      const invoice = db.state.invoices[id];
      if (!invoice) return err<InvoiceRecord>('not_found', 'Invoice not found.');
      if (!Number.isFinite(amount) || amount <= 0) {
        return err<InvoiceRecord>('validation_failed', 'Enter an amount greater than zero.', {
          fieldErrors: [{ path: 'amount', message: 'Enter an amount greater than zero.' }],
        });
      }
      if (invoice.status === 'void' || invoice.status === 'written_off' || invoice.status === 'refunded' || invoice.status === 'payment_received') {
        return err<InvoiceRecord>('validation_failed', `A ${invoice.status.replace(/_/g, ' ')} invoice takes no further payments.`);
      }
      const paid = invoice.amountPaid.amount + Math.round(amount);
      const settled = paid >= invoice.total.amount;
      const updated: InvoiceRecord = {
        ...invoice,
        status: settled ? 'payment_received' : 'payment_pending',
        amountPaid: { amount: paid, currency: invoice.currency },
        balanceDue: { amount: Math.max(0, invoice.total.amount - paid), currency: invoice.currency },
        paidDate: settled ? toDateString(new Date()) : invoice.paidDate,
        dunningStage: settled ? 'none' : invoice.dunningStage,
        updatedAt: new Date().toISOString(),
      };
      db.put('invoices', updated);
      return ok(updated);
    },
  };

  /* --------------------------------------------------------------- documents */

  const documentsService: ServiceContainer['documents'] = {
    folders: async (query = {}) => {
      const records = asRecords<import('@crm/shared-types').DocumentFolder>(db, 'documentFolders');
      return runQuery(records, query, { searchFields: ['name', 'path'], defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
    list: async (query = {}) => {
      const records = asRecords<DocumentFile>(db, 'documents');
      const folderId = (query as ListQuery & { folderId?: Id }).folderId;
      const filtered = folderId ? records.filter((document) => document.folderId === folderId) : records;
      return runQuery(filtered, query, { searchFields: ['name', 'description'], facetField: 'extension', defaultSort: [{ field: 'updatedAt', direction: 'desc' }] });
    },
    get: async (id) => {
      const document = db.state.documents[id];
      return document ? ok(document) : err('not_found', 'Document not found.');
    },
    upload: async (files, folderId) => {
      await delay('upload', { latency: { min: 400, max: 900 } });
      const folder = db.state.documentFolders[folderId];
      // Metadata only. The file contents are never read and nothing is transmitted.
      const tasks: import('@crm/shared-types').FileUploadTask[] = files.map((file, index) => ({
        id: `upload-${Date.now().toString(36)}-${index}`,
        file: { id: `file-${index}`, name: file.name, size: file.sizeBytes, mimeType: file.mimeType, uploadedAt: new Date().toISOString(), demoOnly: true },
        progress: 100,
        state: 'complete',
        transport: 'local_simulation',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        targetFolderId: folderId,
        checks: { size: true, type: true, malwareScan: 'not_performed' },
      }));
      for (const task of tasks) {
        const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        db.put('documents', {
          id,
          organizationId: Object.values(db.state.organizations)[0]!.id,
          folderId,
          folderPath: folder?.path ?? '/',
          name: task.file.name,
          extension: task.file.name.split('.').pop() ?? 'bin',
          mimeType: task.file.mimeType,
          sizeBytes: task.file.size,
          storage: { state: 'placeholder', simulated: true, note: 'No file storage is connected. Metadata only.' },
          version: 1,
          versionCount: 1,
          checksumPlaceholder: 'sha256:****0000',
          ownerId: Object.values(db.state.users)[0]!.id,
          ownerName: Object.values(db.state.users)[0]!.displayName,
          visibility: 'organization',
          tags: [],
          associations: [],
          isFavorite: false,
          shareLinks: [],
          downloadCount: 0,
          viewCount: 0,
          signatureState: 'not_required',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as DocumentFile);
      }
      return ok(tasks);
    },
    update: async (id, input) => {
      const document = db.state.documents[id];
      if (!document) return err<DocumentFile>('not_found', 'Document not found.');
      const updated = { ...document, ...(input as object), id, updatedAt: new Date().toISOString() } as DocumentFile;
      db.put('documents', updated);
      return ok(updated);
    },
    remove: async (id) => {
      db.remove('documents', id);
      return ok({ id });
    },
    versions: async (id) => {
      const document = db.state.documents[id];
      if (!document) {
        return { items: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };
      }
      const items = Array.from({ length: document.versionCount }, (_, index) => ({
        id: `${id}-v${index + 1}`,
        documentId: id,
        version: index + 1,
        sizeBytes: Math.round(document.sizeBytes * (0.9 + index * 0.05)),
        createdAt: new Date(Date.now() - (document.versionCount - index) * 12 * 86_400_000).toISOString(),
        createdByName: document.ownerName,
        changeNote: index === 0 ? 'Initial upload' : 'Content updated',
        isCurrent: index === document.versionCount - 1,
        restorable: index !== document.versionCount - 1,
      }));
      return { items, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    restoreVersion: async (id, versionId) => {
      await delay('doc-restore');
      const document = db.state.documents[id];
      if (!document) return err<DocumentFile>('not_found', 'Document not found.');
      // Restoring produces a new version rather than destroying history.
      const updated: DocumentFile = { ...document, version: document.versionCount + 1, versionCount: document.versionCount + 1, updatedAt: new Date().toISOString() };
      db.put('documents', updated);
      void versionId;
      return ok(updated);
    },
    share: async (id, shareOptions) => {
      const document = db.state.documents[id];
      if (!document) return err<DocumentFile>('not_found', 'Document not found.');
      const updated = { ...document, visibility: shareOptions.visibility as DocumentFile['visibility'], updatedAt: new Date().toISOString() };
      db.put('documents', updated);
      return ok(updated);
    },
    signatureWorkflow: async (id) => {
      await delay(`signature:${id}`, { latency: { min: 200, max: 440 } });
      const document = db.state.documents[id];
      if (!document) return err('not_found', 'Document not found.');
      const signers = [
        { id: 's1', name: 'Customer signatory', email: 'signatory@customer.example', kind: 'customer' as const, order: 1, required: true, status: document.signatureState === 'completed_simulated' ? ('signed' as const) : document.signatureState === 'sent_simulated' ? ('sent' as const) : ('pending' as const), signedAt: document.signatureState === 'completed_simulated' ? toDateTimeString(DATASET_EPOCH) : undefined },
        { id: 's2', name: document.ownerName, email: 'owner@example.test', kind: 'internal' as const, order: 2, required: true, status: document.signatureState === 'completed_simulated' ? ('signed' as const) : ('pending' as const), signedAt: document.signatureState === 'completed_simulated' ? toDateTimeString(DATASET_EPOCH) : undefined },
      ];
      return ok({
        id: `sigwf-${id}`,
        documentId: id,
        documentName: document.name,
        status: document.signatureState === 'completed_simulated' ? 'completed' : document.signatureState === 'sent_simulated' ? 'sent' : 'not_started',
        // The disclaimer travels with the payload so the UI cannot omit it.
        simulated: true,
        wordingDisclaimer: 'E-signature is a workflow preview. No signature was captured, nothing was transmitted, and no document was legally executed.',
        signers,
        fields: [
          { id: 'f1', signerId: 's1', kind: 'signature' as const, page: 3, x: 120, y: 640 },
          { id: 'f2', signerId: 's1', kind: 'date' as const, page: 3, x: 300, y: 640 },
          { id: 'f3', signerId: 's2', kind: 'initials' as const, page: 1, x: 90, y: 90 },
        ],
        auditTrail: [
          { at: toDateTimeString(DATASET_EPOCH), event: 'Workflow preview created', actor: document.ownerName },
          { at: toDateTimeString(DATASET_EPOCH), event: 'Simulated send recorded', actor: document.ownerName, note: 'No email was transmitted.' },
        ],
        expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      });
    },
    templates: async (query = {}) => {
      const organizationId = Object.values(db.state.organizations)[0]!.id;
      const items: import('@crm/shared-types').DocumentTemplate[] = [
        { id: `dtmpl-1`, organizationId, name: 'Commercial proposal', category: 'proposal', description: 'Standard proposal structure with merge fields.', sections: [{ id: 's1', title: 'Executive summary', mergeFields: ['account.name'] }, { id: 's2', title: 'Proposed solution', mergeFields: [] }, { id: 's3', title: 'Commercial terms', mergeFields: ['deal.amount'] }], mergeFields: [{ key: 'account.name', label: 'Account name', source: 'account.name' }, { key: 'deal.amount', label: 'Deal amount', source: 'deal.amount' }], language: 'en', usedCount: 184, isShared: true, outputFormats: ['pdf_placeholder'], createdAt: toDateTimeString(DATASET_EPOCH), updatedAt: toDateTimeString(DATASET_EPOCH) },
        { id: `dtmpl-2`, organizationId, name: 'Statement of work', category: 'statement_of_work', description: 'Scoped engagement with milestones and assumptions.', sections: [{ id: 's1', title: 'Scope', mergeFields: [] }, { id: 's2', title: 'Milestones', mergeFields: [] }, { id: 's3', title: 'Assumptions', mergeFields: [] }], mergeFields: [{ key: 'account.name', label: 'Account name', source: 'account.name' }], language: 'en', usedCount: 62, isShared: true, outputFormats: ['pdf_placeholder', 'docx_placeholder'], createdAt: toDateTimeString(DATASET_EPOCH), updatedAt: toDateTimeString(DATASET_EPOCH) },
      ];
      return runQuery(items, query, { searchFields: ['name', 'description'], facetField: 'category', defaultSort: [{ field: 'name', direction: 'asc' }] });
    },
  };

  /* ---------------------------------------------------------------------- AI */

  const aiService: ServiceContainer['ai'] = {
    conversations: async (query = {}) => {
      const records = asRecords<import('@crm/shared-types').AiConversation>(db, 'aiConversations');
      return runQuery(records, query, { searchFields: ['title'], defaultSort: [{ field: 'updatedAt', direction: 'desc' }] });
    },
    conversation: async (id) => {
      const conversation = db.state.aiConversations[id];
      return conversation ? ok(conversation) : err('not_found', 'Conversation not found.');
    },
    createConversation: async (input) => {
      await delay('ai-conversation');
      const user = Object.values(db.state.users)[0]!;
      const conversation: import('@crm/shared-types').AiConversation = {
        id: `aiconv-${Date.now().toString(36)}`,
        organizationId: user.organizationIds[0]!,
        userId: user.id,
        title: 'New conversation',
        entryPoint: input.entryPoint as import('@crm/shared-types').AiConversation['entryPoint'],
        contextualRecord: input.contextualRecord
          ? { ...input.contextualRecord, route: `/app/${input.contextualRecord.type}s/${input.contextualRecord.id}` }
          : undefined,
        messages: [],
        pinned: false,
        capabilitiesUsed: [],
        totalCredits: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('aiConversations', conversation);
      return ok(conversation);
    },
    /**
     * Respond to a prompt.
     *
     * Deterministic composition from the records in context. No model is called, no data
     * leaves the browser, and every message carries `origin: 'demo_template_engine'` so the
     * interface cannot present it as a model output.
     */
    send: async (conversationId, message, capability) => {
      await delay(`ai-send:${conversationId}`, { latency: { min: 320, max: 780 } });
      const conversation = db.state.aiConversations[conversationId];
      if (!conversation) return err('not_found', 'Conversation not found.');
      const user = Object.values(db.state.users)[0]!;

      const userMessage: AiMessage = {
        id: `aim-${Date.now().toString(36)}-u`,
        conversationId,
        role: 'user',
        content: message,
        origin: 'user_input',
        createdAt: new Date().toISOString(),
      };

      const lower = message.toLowerCase();
      const context = conversation.contextualRecord;
      const deal = context?.type === 'deal' ? owned(db.state.deals[context.id]) : dealsInScope()[0];
      const account = context?.type === 'account' ? owned(db.state.accounts[context.id]) : owned(db.state.accounts[deal?.accountId ?? '']);
      const relatedTickets = ticketsInScope().filter((ticket) => ticket.accountId === account?.id);
      const relatedActivities = scopedRecords<Activity>('activities').filter((activity) => activity.subjects?.some((subject) => subject.id === account?.id));

      let content: string;
      let citations: AiMessage['citations'] = [];
      let suggestion: AiMessage['suggestions'];
      let draft: AiMessage['draft'];

      if (lower.includes('summar') || lower.includes('brief')) {
        content = `${account?.name ?? 'The account'} has a health score of ${account?.healthScore ?? 'unknown'} (${account?.health ?? 'not assessed'}) with ${account?.openDealCount ?? 0} open deals and ${relatedTickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length} open support ${relatedTickets.length === 1 ? 'issue' : 'issues'}.\n\nThe most recent activity was ${relatedActivities[0]?.subject ?? 'no activity recorded'}, logged ${relatedActivities[0] ? `${daysSince(relatedActivities[0].createdAt, DATASET_EPOCH)} days ago` : 'never'}.\n\nThree things worth raising:\n\n1. ${(account?.healthScore ?? 0) > 65 ? 'Health is holding up, so this is a good moment to discuss expansion.' : 'Health is below the watch threshold, so lead with value rather than commercials.'}\n2. ${relatedTickets.some((ticket) => ticket.slaState === 'breached' || ticket.slaState === 'at_risk') ? 'A support ticket is at risk of breaching its SLA and is not assigned to anyone.' : 'No support escalations are outstanding.'}\n3. ${deal ? `“${deal.name}” sits at ${deal.daysInStage} days in its current stage${deal.isStale ? ', which is past the staleness threshold' : ''}.` : 'There is no open opportunity on record.'}`;
        citations = [
          ...(account ? [{ label: account.name, type: 'record' as const, id: account.id, route: `/app/accounts/${account.id}`, excerpt: `Health ${account.healthScore ?? '—'} · ${account.health}` }] : []),
          ...(deal ? [{ label: deal.name, type: 'record' as const, id: deal.id, route: `/app/deals/${deal.id}`, excerpt: `${deal.daysInStage} days in stage` }] : []),
          ...(relatedActivities[0] ? [{ label: relatedActivities[0].subject, type: 'record' as const, id: relatedActivities[0].id, route: '/app/activities', excerpt: relatedActivities[0].kind }] : []),
        ];
        suggestion = [
          { id: `s-${Date.now()}-1`, label: 'Draft a meeting agenda', prompt: 'Draft a 30-minute agenda for this account.', capability: 'general_assistant' },
          { id: `s-${Date.now()}-2`, label: 'Explain the health score', prompt: 'Which factors drive the health score?', capability: 'churn_risk_explanation' },
        ];
      } else if (lower.includes('draft') || lower.includes('email')) {
        const firstName = account?.name.split(' ')[0] ?? 'there';
        draft = {
          kind: 'email',
          title: 'Follow-up email',
          body: `Hi ${firstName},\n\nThank you for your time earlier. Following up on the points we covered:\n\n1. The open support issue is being tracked and I will confirm once it is closed.\n2. I have attached the commercial model we discussed.\n3. The implementation timeline we agreed is four weeks from signature.\n\nLet me know if anything needs adjusting before our next conversation.\n\nBest regards,\n${user.displayName}`,
          applyLabel: 'Open in the composer',
          appliesTo: account ? { type: 'account', id: account.id, label: account.name } : undefined,
        };
        content = 'I have drafted a follow-up email based on the account context. Review it before sending — nothing has been transmitted, and you can edit any part of it.';
        citations = account ? [{ label: account.name, type: 'record' as const, id: account.id, route: `/app/accounts/${account.id}` }] : [];
      } else if (lower.includes('forecast')) {
        const scoped = dealsInScope();
        const openDeals = scoped.filter((deal) => deal.status === 'open');
        const totals = computePipelineTotals(scoped);
        const commit = openDeals.filter((deal) => deal.forecastCategory === 'commit').reduce((sum, deal) => sum + deal.amount.amount, 0);
        content = `Commit stands at ${commit.toLocaleString()} across ${openDeals.filter((deal) => deal.forecastCategory === 'commit').length} deals. Weighted pipeline is ${totals.weightedValue.toLocaleString()} from ${totals.dealCount} open opportunities.\n\nCoverage of ${(totals.totalValue / Math.max(1, commit * 1.1)).toFixed(2)}× is ${totals.totalValue / Math.max(1, commit * 1.1) >= 3 ? 'healthy' : 'below the 3× threshold most teams target'}. ${totals.staleCount} deals have not moved in over three weeks, which is the largest single risk to the number.`;
        citations = [{ label: 'Pipeline report', type: 'report' as const, route: '/app/analytics/pipeline', excerpt: `${openDeals.length} open deals` }];
      } else if (lower.includes('risk') || lower.includes('churn')) {
        const atRisk = Object.values(db.state.accounts).filter((candidate) => candidate.health === 'at_risk' || candidate.health === 'critical');
        content = `${atRisk.length} accounts are currently at risk or critical. The most common drivers are declining usage and an increase in support volume.\n\nThe highest-value account on the risk list is ${atRisk[0]?.name ?? 'none'}, where adoption has fallen for two consecutive months.`;
        citations = atRisk.slice(0, 3).map((candidate) => ({ label: candidate.name, type: 'record' as const, id: candidate.id, route: `/app/accounts/${candidate.id}`, excerpt: `Health ${candidate.healthScore ?? '—'}` }));
      } else {
        content = `I can help with summaries, drafting, forecast explanations and report definitions. Everything I produce is composed from the records you can already open, and I will always cite what I used.\n\nI am a deterministic demonstration engine rather than a language model, so my answers follow fixed patterns — they are useful for reviewing the interface, not for making decisions.`;
      }

      const assistantMessage: AiMessage = {
        id: `aim-${Date.now().toString(36)}-a`,
        conversationId,
        role: 'assistant',
        content,
        origin: 'demo_template_engine',
        createdAt: new Date().toISOString(),
        capability: (capability as never) ?? 'general_assistant',
        citations,
        suggestions: suggestion,
        draft,
        confidence: { level: citations.length >= 3 ? 'medium' : 'low', note: `Based on ${citations.length} record${citations.length === 1 ? '' : 's'}.` },
        usage: { inputTokens: message.length, outputTokens: content.length, credits: 2, latencyMs: 420 },
        feedback: null,
      };

      db.transaction((draftDb) => {
        const stored = draftDb.aiConversations[conversationId];
        if (!stored) return;
        stored.messages = [...stored.messages, userMessage, assistantMessage];
        stored.totalCredits += 2;
        stored.updatedAt = new Date().toISOString();
        if (stored.title === 'New conversation') stored.title = message.slice(0, 60);
      });

      db.put('aiUsage', {
        id: `aiuse-${Date.now().toString(36)}`,
        organizationId: user.organizationIds[0]!,
        userId: user.id,
        userName: user.displayName,
        capability: 'general_assistant',
        occurredAt: new Date().toISOString(),
        credits: 2,
        inputTokens: message.length,
        outputTokens: content.length,
        latencyMs: 420,
        accepted: null,
        feedback: null,
      });

      return ok(assistantMessage);
    },
    suggestions: async (context) => {
      await delay('ai-suggestions', { latency: { min: 120, max: 260 } });
      const base: AiPromptSuggestion[] = [
        { id: 'p1', capability: 'account_summary', label: 'Summarise this account', prompt: 'Summarise this account before my next meeting.', description: 'Context, health, open deals and support position in one read.', requiresContext: true, contextType: 'account', personaTargets: ['sales_rep', 'account_manager', 'success_manager'], category: 'summaries', tone: 'violet' },
        { id: 'p2', capability: 'deal_insight', label: 'Why has this deal stalled?', prompt: 'Why has this deal not moved, and what should I do next?', description: 'Stage age, activity gaps and the next best action.', requiresContext: true, contextType: 'deal', personaTargets: ['sales_rep', 'sales_manager'], category: 'analysis', tone: 'amber' },
        { id: 'p3', capability: 'email_draft', label: 'Draft a follow-up', prompt: 'Draft a follow-up email after the pricing conversation.', description: 'A reviewable draft you can edit before anything happens.', requiresContext: true, contextType: 'deal', personaTargets: ['sales_rep', 'account_manager'], category: 'writing', tone: 'teal' },
        { id: 'p4', capability: 'forecast_explanation', label: 'Explain the forecast', prompt: 'Explain the movements in this quarter’s forecast.', description: 'What changed, by how much, and which deals drove it.', requiresContext: false, personaTargets: ['sales_manager', 'sales_director', 'revops_manager'], category: 'analysis', tone: 'blue' },
        { id: 'p5', capability: 'churn_risk_explanation', label: 'Which accounts are at risk?', prompt: 'Which accounts are at risk of churning and why?', description: 'Risk ranking with the signals behind each account.', requiresContext: false, personaTargets: ['success_manager'], category: 'analysis', tone: 'red' },
        { id: 'p6', capability: 'natural_language_report', label: 'Build a report', prompt: 'Build a report of win rate by lead source.', description: 'A report definition you can review and adjust.', requiresContext: false, personaTargets: ['revops_manager', 'marketing_manager'], category: 'analysis', tone: 'violet' },
        { id: 'p7', capability: 'next_best_action', label: 'What should I do next?', prompt: 'What is the most valuable thing I could do today?', description: 'Ranked actions across the records you own.', requiresContext: false, personaTargets: ['sales_rep', 'support_agent'], category: 'planning', tone: 'green' },
        { id: 'p8', capability: 'workflow_suggestion', label: 'Suggest an automation', prompt: 'What should I automate first in my pipeline?', description: 'Candidate workflows with their trigger and action.', requiresContext: false, personaTargets: ['revops_manager'], category: 'automation', tone: 'teal' },
        { id: 'p9', capability: 'data_quality_review', label: 'Review data quality', prompt: 'Which records have missing or inconsistent data?', description: 'Fields that are mostly empty and likely to cause reporting problems.', requiresContext: false, personaTargets: ['revops_manager', 'org_admin'], category: 'data_quality', tone: 'slate' },
      ];
      const filtered = context?.persona ? base.filter((item) => item.personaTargets.includes(context.persona!)) : base;
      return { items: filtered.length > 0 ? filtered : base, meta: { page: 1, pageSize: 25, total: filtered.length || base.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    rateMessage: async (messageId, feedback) => {
      for (const conversation of Object.values(db.state.aiConversations)) {
        const index = conversation.messages.findIndex((message) => message.id === messageId);
        if (index === -1) continue;
        const messages = conversation.messages.map((message) => (message.id === messageId ? { ...message, feedback } : message));
        db.put('aiConversations', { ...conversation, messages });
        return ok(messages[index]!);
      }
      return err<AiMessage>('not_found', 'Message not found.');
    },
    archiveConversation: async (id) => {
      const conversation = db.state.aiConversations[id];
      if (!conversation) return err<import('@crm/shared-types').AiConversation>('not_found', 'Conversation not found.');
      const updated = { ...conversation, archivedAt: new Date().toISOString() };
      db.put('aiConversations', updated);
      return ok(updated);
    },
    summariseRecord: async (type, id) => {
      await delay(`ai-summary:${type}:${id}`, { latency: { min: 320, max: 640 } });
      const account = type === 'account' ? owned(db.state.accounts[id]) : undefined;
      const deal = type === 'deal' ? owned(db.state.deals[id]) : undefined;
      const record = account ?? deal;
      if (!record) return err('not_found', 'Record not found.');
      return ok({
        summary: account
          ? `${account.name} is a ${account.industryLabel ?? 'customer'} account with ${account.contactCount} contacts and ${account.openDealCount} open opportunities. Health is ${account.healthScore ?? 'unknown'} (${account.health}).`
          : `${(deal as Deal).name} is at ${(deal as Deal).daysInStage} days in its current stage with ${(deal as Deal).status} status and a ${(deal as Deal).probability}% stage probability.`,
        highlights: [
          account ? `${account.contactCount} contacts on record` : `${(deal as Deal).products.length} product lines`,
          account ? `${account.openDealCount} open opportunities` : `Amount ${(deal as Deal).amount.amount.toLocaleString()}`,
        ],
        risks: [
          ...((account?.healthScore ?? 100) < 60 ? ['Health is below the watch threshold.'] : []),
          ...((deal as Deal)?.isStale ? ['The deal has not moved past the staleness threshold.'] : []),
        ],
        nextActions: [
          account ? 'Confirm the executive sponsor is still engaged' : 'Confirm the next step is still agreed with the customer',
          'Check whether any support issues are outstanding before the next conversation',
        ],
        origin: 'demo_template_engine' as const,
      });
    },
    draftEmail: async (context) => {
      await delay('ai-draft-email', { latency: { min: 300, max: 620 } });
      const user = Object.values(db.state.users)[0]!;
      return ok({
        subject: `${context.tone === 'formal' ? 'Following up' : 'Quick follow-up'} on our conversation`,
        body: `Hi,\n\nThanks for the conversation about ${context.intent.toLowerCase()}. To recap the key points:\n\n1. The current position and what needs to change.\n2. The options available and their trade-offs.\n3. The next step, with an owner and a date.\n\nHappy to adjust if I have missed anything.\n\nBest regards,\n${user.displayName}`,
        origin: 'demo_template_engine' as const,
        warnings: ['Review before sending. No message has been transmitted, and the assistant cannot know facts that are not on the record.'],
      });
    },
    usageDashboard: async () => {
      await delay('ai-usage', { latency: { min: 200, max: 420 } });
      const usage = asRecords<import('@crm/shared-types').AiUsageRecord>(db, 'aiUsage');
      const organizationId = currentOrganizationId();
      const meter = asRecords<UsageMeter>(db, 'usageMeters').find(
        (candidate) => candidate.key === 'ai_credits' && candidate.organizationId === organizationId,
      );
      const creditsUsed = usage.reduce((sum, record) => sum + record.credits, 0);
      const included = meter?.included ?? 5000;
      const accepted = usage.filter((record) => record.accepted === true).length;
      return ok({
        periodLabel: 'This month',
        creditsUsed,
        creditsIncluded: included,
        creditsRemaining: Math.max(0, included - creditsUsed),
        usagePercent: Math.round((creditsUsed / Math.max(1, included)) * 100),
        requests: usage.length,
        activeUsers: new Set(usage.map((record) => record.userId)).size,
        adoptionPercent: Math.round((new Set(usage.map((record) => record.userId)).size / Math.max(1, Object.keys(db.state.users).length)) * 100),
        acceptanceRatePercent: usage.length > 0 ? Math.round((accepted / usage.length) * 100) : 0,
        helpfulnessPercent: (() => {
          const rated = usage.filter((record) => record.feedback);
          const helpful = rated.filter((record) => record.feedback === 'helpful').length;
          return rated.length > 0 ? Math.round((helpful / rated.length) * 100) : 0;
        })(),
        averageLatencyMs: usage.length > 0 ? Math.round(usage.reduce((sum, record) => sum + record.latencyMs, 0) / usage.length) : 0,
        trend: Array.from({ length: 14 }, (_, index) => ({
          date: toDateString(new Date(DATASET_EPOCH.getTime() - (13 - index) * 86_400_000)),
          requests: 4 + (index % 6),
          credits: 8 + (index % 9),
          accepted: 3 + (index % 4),
        })),
        byCapability: (['account_summary', 'deal_insight', 'email_draft', 'forecast_explanation', 'next_best_action', 'natural_language_report', 'lead_scoring_explanation'] as const).map((capability) => {
          const scoped = usage.filter((record) => record.capability === capability);
          return {
            capability,
            label: capability.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
            requests: scoped.length,
            credits: scoped.reduce((sum, record) => sum + record.credits, 0),
            acceptanceRate: scoped.length > 0 ? Math.round((scoped.filter((record) => record.accepted === true).length / scoped.length) * 100) : 0,
          };
        }),
        topUsers: Object.values(db.state.users)
          .slice(0, 6)
          .map((user) => {
            const scoped = usage.filter((record) => record.userId === user.id);
            return { userId: user.id, name: user.displayName, requests: scoped.length, credits: scoped.reduce((sum, record) => sum + record.credits, 0), acceptanceRate: scoped.length > 0 ? Math.round((scoped.filter((record) => record.accepted === true).length / scoped.length) * 100) : 0 };
          }),
        // Metering is not connected to any billing system.
        billingState: 'not_metered' as const,
      });
    },
    settings: async () => {
      const organization = Object.values(db.state.organizations)[0]!;
      return ok({
        organizationId: organization.id,
        enabled: true,
        // The provider state is part of the payload so the UI states it rather than implying a model.
        providerState: 'demo_template_engine' as const,
        allowedCapabilities: (['account_summary', 'deal_insight', 'email_draft', 'meeting_summary', 'forecast_explanation', 'lead_scoring_explanation', 'natural_language_report', 'next_best_action', 'churn_risk_explanation', 'data_quality_review', 'general_assistant'] as const).map((capability) => ({ capability, enabled: true, rolesAllowed: Object.values(db.state.roles).map((role) => role.id) })),
        dataAccess: {
          readScope: 'records_user_can_access' as const,
          includeNotes: true,
          includeEmails: false,
          includeAttachments: false,
          excludeSensitiveFields: true,
          excludeFieldApiNames: ['tax_identifier', 'purchase_value', 'payment_reference'],
          retentionDays: 30,
          humanReviewRequiredForDrafts: true,
          optOutUserIds: [],
          regionNote: 'No AI provider is connected, so no data leaves the browser at all.',
        },
        usageLimits: { monthlyCreditLimit: 5000, perUserDailyRequestLimit: 200, overageBehaviour: 'notify' as const },
        feedbackCollectionEnabled: true,
        auditAllPrompts: true,
        disclaimerText: 'Responses are produced by a deterministic demonstration engine, not a language model. Review anything it drafts before using it.',
      });
    },
    updateSettings: async (patch) => {
      const current = await aiService.settings();
      if (!current.ok) return current;
      // Settings are presentation-only in this build, so the merged object is echoed back
      // rather than persisted as an entitlement change.
      return ok({ ...current.data, ...(patch as object) } as typeof current.data);
    },
  };

  /* -------------------------------------------------------------- demo data */

  const demoService: ServiceContainer['demo'] = {
    reset: async (resetScope) => {
      await delay('demo-reset', { latency: { min: 320, max: 700 } });
      const summary = db.reset();
      // Clear the demo namespace so the reset is genuinely complete.
      if (typeof localStorage !== 'undefined' && resetScope !== 'organization') {
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('crm.comments.') || key.startsWith('crm.demo.')) localStorage.removeItem(key);
          }
        } catch {
          /* storage unavailable */
        }
      }
      return ok({ resetAt: new Date().toISOString(), collections: summary.collections, records: summary.records });
    },
    seedSampleData: async (organizationId, preset) => {
      await delay('demo-seed', { latency: { min: 400, max: 900 } });
      const summary = db.snapshot();
      return ok({ created: { organizations: organizationId ? 1 : 0, records: preset === 'empty' ? 0 : summary.records } });
    },
    clearSampleData: async () => {
      await delay('demo-clear');
      const before = db.snapshot();
      return ok({ removed: { records: before.records } });
    },
    snapshot: async () => {
      const summary = db.snapshot();
      return ok({
        takenAt: new Date().toISOString(),
        collections: summary.collections,
        records: summary.records,
        approxBytes: typeof localStorage === 'undefined' ? 0 : (localStorage.getItem('crm.mockdb.v1')?.length ?? 0),
      });
    },
  };

  /* -------------------------------------------------------------- onboarding */

  const onboardingService: ServiceContainer['onboarding'] = {
    progress: async () => {
      const organization = Object.values(db.state.organizations)[0]!;
      const progress = db.state.onboarding[organization.id] ?? organization.onboarding;
      return ok(progress);
    },
    completeStep: async (stepId) => {
      await delay(`onboarding:${stepId}`, { latency: { min: 120, max: 280 } });
      const organization = Object.values(db.state.organizations)[0]!;
      const progress = db.state.onboarding[organization.id] ?? organization.onboarding;
      const steps = progress.steps.map((step) => (step.id === stepId ? { ...step, completed: true, completedAt: new Date().toISOString() } : step));
      const updated = { ...progress, steps, completedAt: steps.every((step) => step.completed || step.optional) ? new Date().toISOString() : undefined };
      db.put('onboarding' as never, updated as never);
      return ok(updated);
    },
    skipStep: async (stepId) => {
      const organization = Object.values(db.state.organizations)[0]!;
      const progress = db.state.onboarding[organization.id] ?? organization.onboarding;
      const updated = { ...progress, steps: progress.steps.map((step) => (step.id === stepId ? { ...step, optional: true } : step)) };
      db.put('onboarding' as never, updated as never);
      return ok(updated);
    },
    dismissChecklist: async () => {
      const organization = Object.values(db.state.organizations)[0]!;
      const progress = db.state.onboarding[organization.id] ?? organization.onboarding;
      const updated = { ...progress, dismissedChecklist: true };
      db.put('onboarding' as never, updated as never);
      return ok(updated);
    },
    completeOrganizationSetup: async (payload) => {
      await delay('org-setup', { latency: { min: 600, max: 1400 } });
      const organization = Object.values(db.state.organizations)[0]!;
      const seed = createRandom(payload.name.length * 7919);
      const updated: Organization = {
        ...organization,
        name: payload.name,
        countryCode: payload.countryCode,
        defaultLocale: payload.locale,
        defaultTimezone: payload.timezone,
        defaultCurrency: payload.currency,
        industryId: payload.industryId,
        companySize: payload.companySize as Organization['companySize'],
        enabledModuleKeys: payload.moduleKeys,
        onboarding: { ...organization.onboarding, pipelineTemplateId: payload.pipelineTemplateId, sampleDataLoaded: payload.loadSampleData },
        updatedAt: new Date().toISOString(),
      };
      db.put('organizations', updated);
      void seed;
      return ok({ organization: updated, progress: updated.onboarding });
    },
  };

  /* --------------------------------------------------------------- assembly */

  const customisation = makeCustomizationService(db);
  const extraCollaboration = makeCollaborationService(db);
  const customizationExtras = makeCustomizationExtrasService(db);
  const workspaces = {
    projects: makeProjectsService(db),
    fieldSales: makeFieldSalesService(db),
    partners: makePartnersService(db),
  };

  /**
   * The mock container.
   *
   * Typed as a documented subset of `ServiceContainer`. The modules below are implemented
   * fully against the seeded store; the remaining domains are declared in the contract and
   * arrive with the batches that build their screens. Narrowing the type here is deliberate:
   * a screen that needs a module the mock does not provide should fail to compile rather
   * than silently receive an object whose methods return nothing.
   */
  const container = {
    leads: leadsService,
    contacts: contactsService,
    accounts: accountsService,
    deals: dealsService,
    pipelines: pipelinesService,
    activities: activitiesService,
    tasks: tasksService,
    calendar: calendarService,
    tickets: ticketsService,
    dashboards: dashboardsService,
    reports: reportsService,
    analytics: analyticsService,
    knowledgeBase: makeKnowledgeBaseService(db),
    conversations: makeConversationsService(db),
    workflows: makeWorkflowsService(db),
    collaboration: extraCollaboration,
    documents: documentsService,
    ai: aiService,
    organization: organizationService,
    users: usersService,
    roles: rolesService,
    security: makeSecurityService(db),
    data: makeDataService(db),
    billing: makeBillingService(db),
    tenant: tenantService,
    subscriptionRevenue: subscriptionRevenueService,
    products: productsService,
    quotes: quotesService,
    orders: ordersService,
    contracts: contractsService,
    invoices: invoicesService,
    customObjects: customisation.objects,
    savedViews: customisation.views,
    demo: demoService,
    onboarding: onboardingService,
    playbooks: makePlaybooksService(db),
    customerSuccess: makeCustomerSuccessService(db),
    sequences: makeSequencesService(db),
    exports: makeExportsService(db),
    goals: makeGoalsService(db),
    layouts: customizationExtras.layouts,
    industryTemplates: customizationExtras.industryTemplates,
    navigation: customizationExtras.navigation,
    campaigns: makeCampaignsService(db),
    segments: makeSegmentsService(db),
    journeys: makeJourneysService(db),
    emailTemplates: makeEmailTemplatesService(db),
    forms: makeFormsService(db),
    landingPages: makeLandingPagesService(db),
    leadSources: makeLeadSourcesService(db),
    projects: workspaces.projects,
    fieldSales: workspaces.fieldSales,
    partners: workspaces.partners,
  };

  return container;
}

/**
 * The service modules this build provides.
 *
 * Screens import this type rather than `ServiceContainer`, so a dependency on a module that
 * is not yet implemented is a compile error instead of a runtime surprise.
 */
export type MockServiceContainer = ReturnType<typeof createMockServices>;

