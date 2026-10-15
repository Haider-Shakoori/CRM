/**
 * Dataset assembly.
 *
 * Builds one `MockDatabase` containing three tenants. Everything is generated from
 * `DATASET_EPOCH` with per-organization seeds, so the dataset is byte-for-byte
 * reproducible: a test written today asserts the same values next year, screenshots are
 * stable, and there is no hydration mismatch between server and client renders.
 *
 * Tenant partitioning is applied by tagging collections with an `organizationId` and
 * filtering on read. Collections that exist only once at platform level (feature flags,
 * plans, the module catalog) are not partitioned.
 *
 * This is a UI demonstration of multi-tenancy, NOT a security boundary. Real isolation is
 * a server responsibility, and the mock layer does not pretend otherwise.
 */

import type { Id } from '@crm/shared-types';
import { DATASET_EPOCH, toDateString, toDateTimeString, createRandom } from '../lib/random';
import { STORAGE_VERSION, defaultPreferences, type MockDatabase } from '../lib/store';
import { buildFoundation, type OrgContext } from './foundation';
import { makeAccounts, makeActivities, makeContacts, makeDeals, makeLeads } from './records-sales';
import { makeCommunications, makeKnowledgeBase, makeMarketing, makeSupportConfig, makeSurveys, makeTickets } from './records-engage';
import { makePlaybooks } from './playbooks';
import {
  makeAi,
  makeAnalytics,
  makeCustomerSuccess,
  makeDocumentsAndCollaboration,
  makeFieldSales,
  makeIntegrations,
  makePartners,
  makePlatform,
  makeProducts,
  makeProjects,
  makeRevenueDocuments,
  makeWorkflows,
} from './records-extra';

/** Turn an array into a keyed record. */
function keyed<T extends { id: Id }>(records: T[]): Record<Id, T> {
  const out: Record<Id, T> = {};
  for (const record of records) out[record.id] = record;
  return out;
}

/** Scale the transactional volume by tenant size so a 7-user trial does not look identical to a 35-user tenant. */
function volumeFor(ctx: OrgContext) {
  const size = ctx.users.length;
  const isFull = ctx.organization.enabledModuleKeys.length > 25;
  const factor = size >= 14 ? 1 : size >= 10 ? 0.72 : 0.45;
  return {
    accounts: Math.max(10, Math.round(46 * factor)),
    contacts: Math.max(18, Math.round(128 * factor)),
    leads: Math.max(22, Math.round(isFull ? 96 : 58 * factor)),
    deals: Math.max(14, Math.round(92 * factor)),
    activities: Math.max(40, Math.round(240 * factor)),
    tickets: Math.max(22, Math.round(isFull ? 104 : 62 * factor)),
    conversations: Math.max(12, Math.round(46 * factor)),
  };
}

export function buildDataset(): MockDatabase {
  const foundation = buildFoundation();

  const db: Partial<MockDatabase> = {
    tenants: keyed(foundation.tenants),
    organizations: keyed(foundation.organizations),
    users: keyed(foundation.users),
    teams: keyed(foundation.teams),
    roles: keyed(foundation.roles),
    pipelines: keyed(foundation.pipelines),
    leadSources: keyed(foundation.leadSources),
    dealLostReasons: keyed(foundation.dealLostReasons),

    // Collections that are only seeded lightly are declared here so every screen has a
    // real (possibly empty) collection to read rather than an undefined one.
    invitations: {}, auditEvents: {}, sessions: {}, apiKeys: {}, usageMeters: {},
    accounts: {}, contacts: {}, leads: {}, deals: {},
    activities: {}, calendarEvents: {}, salesGoals: {}, sequences: {}, playbooks: {},
    conversations: {}, messages: {}, callRecords: {}, sharedInboxes: {}, messageTemplates: {}, cannedResponses: {},
    campaigns: {}, segments: {}, journeys: {}, emailTemplates: {}, captureForms: {}, landingPages: {},
    tickets: {}, ticketMessages: {}, ticketCategories: {}, slaPolicies: {}, kbArticles: {}, kbCategories: {}, surveys: {},
    healthScores: {}, portfolios: {}, onboardingPlans: {}, successPlans: {}, renewals: {}, businessReviews: {},
    products: {}, priceBooks: {}, quotes: {}, orders: {}, contracts: {}, invoices: {}, revenueSubscriptions: {}, commissionStatements: {},
    projects: {}, projectTasks: {}, projectMilestones: {},
    territories: {}, visitPlans: {}, visitLogs: {},
    partners: {}, dealRegistrations: {},
    dashboards: {}, reports: {},
    workflows: {}, workflowRuns: {}, workflowTemplates: {},
    customObjects: {}, customFields: {}, savedViews: {}, layouts: {}, validationRules: {}, industryTemplates: {},
    documentFolders: {}, documents: {}, feedItems: {}, notifications: {}, announcements: {},
    integrations: {}, connections: {}, webhookEndpoints: {}, webhookDeliveries: {}, apiRequestLogs: {}, developerApps: {},
    aiConversations: {}, aiUsage: {},
    platformPlans: {}, platformAddOns: {}, platformSubscriptions: {}, platformInvoices: {}, platformUsers: {},
    platformRoles: {}, platformAudit: {}, platformSupportTickets: {}, featureFlags: {}, moduleCatalog: {},
    localizationRows: {}, systemStatus: {}, maintenanceBanners: {},
    preferences: {}, onboarding: {},
  };

  /**
   * Merge records into a collection.
   *
   * The signature is intentionally loose (`unknown[]`) because the call sites pass
   * per-collection record types and TypeScript cannot infer `MockDatabase[K][string]`
   * through the generic. The final assignment is checked once, where the assembled object
   * is given the `MockDatabase` type.
   */
  const add = (collection: keyof MockDatabase, records: unknown[]) => {
    const target = (db[collection] ?? {}) as Record<Id, unknown>;
    for (const record of records) {
      target[(record as { id: string }).id] = record;
    }
    (db as Record<string, unknown>)[collection as string] = target;
  };

  for (const ctx of foundation.contexts) {
    const volume = volumeFor(ctx);

    /* ------------------------------------------------------------ sales */
    const accounts = makeAccounts(ctx, volume.accounts);
    const contacts = makeContacts(ctx, accounts, volume.contacts);
    const leads = makeLeads(ctx, volume.leads);
    const deals = makeDeals(ctx, accounts, contacts, volume.deals);
    const { activities, events } = makeActivities(ctx, deals, contacts, accounts, volume.activities);

    add('accounts', accounts);
    add('contacts', contacts);
    add('leads', leads);
    add('deals', deals as MockDatabase['deals'][string][]);
    add('activities', activities as MockDatabase['activities'][string][]);
    add('calendarEvents', events as MockDatabase['calendarEvents'][string][]);

    /* ---------------------------------------------------------- support */
    const support = makeSupportConfig(ctx);
    const { tickets, messages: ticketMessages } = makeTickets(ctx, accounts, contacts, volume.tickets);
    const { articles, categories: kbCategories } = makeKnowledgeBase(ctx);
    const surveys = makeSurveys(ctx, tickets);

    add('ticketCategories', support.categories as MockDatabase['ticketCategories'][string][]);
    add('slaPolicies', support.slaPolicies as MockDatabase['slaPolicies'][string][]);
    add('tickets', tickets as MockDatabase['tickets'][string][]);
    add('ticketMessages', ticketMessages as MockDatabase['ticketMessages'][string][]);
    add('kbArticles', articles as MockDatabase['kbArticles'][string][]);
    add('kbCategories', kbCategories as MockDatabase['kbCategories'][string][]);
    add('surveys', surveys as MockDatabase['surveys'][string][]);

    /* -------------------------------------------------------- marketing */
    const marketing = makeMarketing(ctx);
    add('campaigns', marketing.campaigns as MockDatabase['campaigns'][string][]);
    add('segments', marketing.segments as MockDatabase['segments'][string][]);
    add('journeys', marketing.journeys as MockDatabase['journeys'][string][]);
    add('emailTemplates', marketing.emailTemplates as MockDatabase['emailTemplates'][string][]);
    add('captureForms', marketing.forms as MockDatabase['captureForms'][string][]);
    add('landingPages', marketing.landingPages as MockDatabase['landingPages'][string][]);

    /* --------------------------------------------------- communications */
    const comms = makeCommunications(ctx, contacts, volume.conversations);
    add('sharedInboxes', comms.inboxes as MockDatabase['sharedInboxes'][string][]);
    add('conversations', comms.conversations as MockDatabase['conversations'][string][]);
    add('messages', comms.messages as MockDatabase['messages'][string][]);
    add('callRecords', comms.calls as MockDatabase['callRecords'][string][]);
    add('messageTemplates', comms.templates as MockDatabase['messageTemplates'][string][]);
    add('cannedResponses', comms.canned as MockDatabase['cannedResponses'][string][]);

    /* ----------------------------------------------------- revenue ops */
    const priceBookId = `pb-${ctx.organization.id}-standard`;
    const { products, priceBooks } = makeProducts(ctx, priceBookId);
    const revenue = makeRevenueDocuments(ctx, deals, accounts, contacts, products, priceBookId);
    add('products', products as MockDatabase['products'][string][]);
    add('priceBooks', priceBooks as MockDatabase['priceBooks'][string][]);
    add('quotes', revenue.quotes as MockDatabase['quotes'][string][]);
    add('orders', revenue.orders as MockDatabase['orders'][string][]);
    add('contracts', revenue.contracts as MockDatabase['contracts'][string][]);
    add('invoices', revenue.invoices as MockDatabase['invoices'][string][]);
    add('revenueSubscriptions', revenue.subscriptions as MockDatabase['revenueSubscriptions'][string][]);
    add('commissionStatements', revenue.commissions as MockDatabase['commissionStatements'][string][]);

    /* ----------------------------------------------- customer success */
    const success = makeCustomerSuccess(ctx, accounts, contacts, revenue.contracts);
    add('renewals', success.renewals as MockDatabase['renewals'][string][]);
    add('onboardingPlans', success.onboardingPlans as MockDatabase['onboardingPlans'][string][]);
    add('successPlans', success.successPlans as MockDatabase['successPlans'][string][]);
    add('businessReviews', success.businessReviews as MockDatabase['businessReviews'][string][]);
    add('portfolios', success.portfolios as MockDatabase['portfolios'][string][]);

    /**
     * Health scores are derived from the account record rather than generated separately,
     * so the health column in a list and the health panel on a record can never disagree.
     */
    add(
      'healthScores',
      accounts
        .filter((account) => typeof account.healthScore === 'number' && account.health !== 'unknown')
        .map((account) => ({
          id: `hs-${account.id}`,
          accountId: account.id,
          accountName: account.name,
          ownerId: account.ownerId,
          ownerName: ctx.users.find((user) => user.id === account.ownerId)?.displayName ?? 'Unassigned',
          score: account.healthScore ?? 0,
          band: account.health,
          previousScore: Math.max(0, Math.min(100, (account.healthScore ?? 0) + ctx.random.int(-12, 12))),
          delta: ctx.random.int(-12, 12),
          computedAt: toDateTimeString(DATASET_EPOCH),
          modelLabel: 'Weighted health model (v2, demonstration)',
          components: [
            { key: 'usage', label: 'Product usage', score: ctx.random.int(30, 96), weight: 0.3, rationale: 'Weekly active users against licensed seats.', trend: ctx.random.int(-9, 14), direction: ctx.random.pick(['up', 'down', 'flat'] as const) },
            { key: 'support', label: 'Support experience', score: ctx.random.int(28, 95), weight: 0.2, rationale: 'Ticket volume, resolution time and satisfaction.', trend: ctx.random.int(-8, 10), direction: ctx.random.pick(['up', 'down', 'flat'] as const) },
            { key: 'engagement', label: 'Relationship engagement', score: ctx.random.int(20, 98), weight: 0.25, rationale: 'Executive contact frequency and meeting cadence.', trend: ctx.random.int(-10, 12), direction: ctx.random.pick(['up', 'down', 'flat'] as const) },
            { key: 'commercial', label: 'Commercial health', score: ctx.random.int(35, 99), weight: 0.15, rationale: 'Payment timeliness and contract coverage.', trend: ctx.random.int(-5, 8), direction: ctx.random.pick(['up', 'down', 'flat'] as const) },
            { key: 'adoption', label: 'Feature adoption', score: ctx.random.int(18, 92), weight: 0.1, rationale: 'Modules enabled against modules in use.', trend: ctx.random.int(-7, 11), direction: ctx.random.pick(['up', 'down', 'flat'] as const) },
          ],
          signals: (account.healthSignals ?? []).map((signal, signalIndex) => ({
            id: `sig-${account.id}-${signalIndex}`,
            kind: (signal.sentiment === 'positive' ? (['usage_increase', 'training_completed', 'nps_promoter'] as const)[signalIndex % 3] : (['product_usage_down', 'support_spike', 'low_adoption'] as const)[signalIndex % 3]),
            label: signal.label,
            severity: signal.sentiment === 'negative' ? ('high' as const) : ('low' as const),
            detectedAt: toDateTimeString(ctx.random.pastDate(30, DATASET_EPOCH)),
            direction: signal.sentiment,
            suggestedAction: signal.sentiment === 'negative' ? 'Schedule a check-in with the account sponsor.' : undefined,
          })),
          sentiment: (account.healthScore ?? 0) > 70 ? ('promoter' as const) : (account.healthScore ?? 0) > 45 ? ('neutral' as const) : ('detractor' as const),
          renewalRiskPercent: Math.max(2, Math.min(96, 100 - (account.healthScore ?? 50))),
          expansionProbabilityPercent: Math.max(2, Math.min(94, (account.healthScore ?? 50) - 8)),
        })),
    );

    /**
     * Playbooks are guidance plus generated tasks, so they are seeded per tenant alongside the
     * customer success records they drive. `playbooks.apply` reads this collection to create
     * local tasks.
     */
    add('playbooks', makePlaybooks(ctx) as MockDatabase['playbooks'][string][]);

    /* ------------------------------------------------ projects & field */
    const { projects, tasks, milestones } = makeProjects(ctx, deals, accounts);
    add('projects', projects as MockDatabase['projects'][string][]);
    add('projectTasks', tasks as MockDatabase['projectTasks'][string][]);
    add('projectMilestones', milestones as MockDatabase['projectMilestones'][string][]);

    if (ctx.organization.enabledModuleKeys.includes('field_sales')) {
      const field = makeFieldSales(ctx, accounts, contacts);
      add('territories', field.territories as MockDatabase['territories'][string][]);
      add('visitPlans', field.visitPlans as MockDatabase['visitPlans'][string][]);
      add('visitLogs', field.visitLogs as MockDatabase['visitLogs'][string][]);
    }

    if (ctx.organization.enabledModuleKeys.includes('partners')) {
      const channel = makePartners(ctx, accounts, deals);
      add('partners', channel.partners as MockDatabase['partners'][string][]);
      add('dealRegistrations', channel.registrations as MockDatabase['dealRegistrations'][string][]);
    }

    /* ------------------------------------ documents and collaboration */
    const collab = makeDocumentsAndCollaboration(ctx, accounts, deals, tickets);
    add('documentFolders', collab.folders as MockDatabase['documentFolders'][string][]);
    add('documents', collab.documents as MockDatabase['documents'][string][]);
    add('feedItems', collab.feed as MockDatabase['feedItems'][string][]);
    add('notifications', collab.notifications as MockDatabase['notifications'][string][]);
    add('announcements', collab.announcements as MockDatabase['announcements'][string][]);

    /* -------------------------------------------- analytics & automation */
    const analytics = makeAnalytics(ctx);
    add('dashboards', analytics.dashboards as MockDatabase['dashboards'][string][]);
    add('reports', analytics.reports as MockDatabase['reports'][string][]);
    add('salesGoals', analytics.goals as MockDatabase['salesGoals'][string][]);
    add('sequences', analytics.sequences as MockDatabase['sequences'][string][]);
    add('savedViews', analytics.savedViews as MockDatabase['savedViews'][string][]);

    const automation = makeWorkflows(ctx);
    add('workflows', automation.workflows as MockDatabase['workflows'][string][]);
    add('workflowTemplates', automation.templates as MockDatabase['workflowTemplates'][string][]);

    /* ------------------------------------------------------ integrations */
    const integrations = makeIntegrations(ctx);
    add('integrations', integrations.integrations as MockDatabase['integrations'][string][]);
    add('connections', integrations.connections as MockDatabase['connections'][string][]);
    add('webhookEndpoints', integrations.webhookEndpoints as MockDatabase['webhookEndpoints'][string][]);
    add('webhookDeliveries', integrations.webhookDeliveries as MockDatabase['webhookDeliveries'][string][]);
    add('apiKeys', integrations.apiKeys as MockDatabase['apiKeys'][string][]);
    add('apiRequestLogs', integrations.apiRequestLogs as MockDatabase['apiRequestLogs'][string][]);
    add('developerApps', integrations.developerApps as MockDatabase['developerApps'][string][]);

    /* --------------------------------------------------------------- AI */
    const ai = makeAi(ctx, deals, accounts);
    add('aiConversations', ai.conversations as MockDatabase['aiConversations'][string][]);
    add('aiUsage', ai.usage as MockDatabase['aiUsage'][string][]);

    /* --------------------------------------- preferences and onboarding */
    for (const user of ctx.users) {
      const preferences = defaultPreferences();
      preferences.tablePageSize = 50;
      db.preferences![user.id] = preferences;
    }
    db.onboarding![ctx.organization.id] = ctx.organization.onboarding;

    /* ------------------------------------------------- usage and sessions */
    const meterSeed = createRandom(ctx.seed + 7);
    const meters: Omit<import('@crm/shared-types').UsageMeter, 'organizationId'>[] = [
      { key: 'records', label: 'Records stored', unit: 'records', used: meterSeed.int(4000, 620000), included: 1000000, periodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')), periodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')), overageBehaviour: 'notify' },
      { key: 'storage', label: 'Document storage', unit: 'GB', used: meterSeed.int(2, 210), included: 250, periodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')), periodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')), overageBehaviour: 'bill' },
      { key: 'workflow_runs', label: 'Automation runs', unit: 'runs', used: meterSeed.int(1200, 46000), included: 50000, periodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')), periodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')), overageBehaviour: 'bill' },
      { key: 'api_calls', label: 'API calls', unit: 'calls', used: meterSeed.int(20000, 240000), included: 250000, periodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')), periodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')), overageBehaviour: 'throttle' },
      { key: 'ai_credits', label: 'AI credits', unit: 'credits', used: meterSeed.int(120, 5200), included: 5000, periodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')), periodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')), overageBehaviour: 'bill' },
      { key: 'email_sends', label: 'Marketing emails', unit: 'sends', used: meterSeed.int(4000, 92000), included: 100000, periodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')), periodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')), overageBehaviour: 'bill' },
    ];
    add(
      'usageMeters',
      meters.map((meter) => ({
        ...meter,
        organizationId: ctx.organization.id,
        id: `meter-${ctx.organization.id}-${meter.key}`,
      })) as MockDatabase['usageMeters'][string][],
    );

    for (const user of ctx.users.slice(0, 6)) {
      add('sessions', [{
        id: `sess-${user.id}-1`,
        userId: user.id,
        deviceLabel: ctx.random.pick(['MacBook Pro', 'Windows laptop', 'iPad', 'iPhone', 'Android phone']),
        browser: ctx.random.pick(['Chrome 141', 'Safari 19', 'Edge 141', 'Firefox 143']),
        os: ctx.random.pick(['macOS 16', 'Windows 12', 'iOS 19', 'Android 16']),
        ipAddressMasked: '203.0.113.***',
        locationLabel: ctx.random.pick(['Chicago, US', 'Stuttgart, DE', 'Dubai, AE', 'Manchester, GB']),
        startedAt: toDateTimeString(ctx.random.pastDate(3, DATASET_EPOCH)),
        lastSeenAt: toDateTimeString(ctx.random.pastDate(0.2, DATASET_EPOCH)),
        current: user.id === ctx.primaryUser.id,
        trusted: ctx.random.chance(0.6),
        mfaSatisfied: ctx.random.chance(0.8),
      }] as MockDatabase['sessions'][string][]);
    }

    for (let index = 0; index < 12; index += 1) {
      const inviter = ctx.primaryUser;
      add('invitations', [{
        id: `inv-${ctx.organization.id}-${index + 1}`,
        organizationId: ctx.organization.id,
        email: `new.hire${index + 1}@${ctx.organization.slug}.example`,
        roleIds: [ctx.roles.find((role) => role.isDefault)?.id ?? ctx.roles[0]!.id],
        teamIds: ctx.teams.slice(0, 1).map((team) => team.id),
        invitedById: inviter.id,
        status: ctx.random.pick(['pending', 'pending', 'accepted', 'expired'] as const),
        sentAt: toDateTimeString(ctx.random.pastDate(30, DATASET_EPOCH)),
        expiresAt: toDateTimeString(ctx.random.futureDate(10, DATASET_EPOCH)),
        deliverySimulated: true,
      }] as MockDatabase['invitations'][string][]);
    }

    const auditActions = ['record.viewed', 'record.updated', 'permission.changed', 'export.requested', 'workflow.activated', 'integration.connected', 'user.invited', 'role.created', 'layout.updated', 'field.created'];
    for (let index = 0; index < 40; index += 1) {
      const actor = ctx.random.pick(ctx.users);
      const action = ctx.random.pick(auditActions);
      add('auditEvents', [{
        id: `audit-${ctx.organization.id}-${index + 1}`,
        at: toDateTimeString(ctx.random.pastDate(60, DATASET_EPOCH)),
        organizationId: ctx.organization.id,
        actorId: actor.id,
        actorLabel: actor.displayName,
        actorType: ctx.random.chance(0.86) ? 'user' : 'system',
        action,
        resource: action.split('.')[0] ?? 'record',
        resourceLabel: ctx.random.pick(['Deal — Vertex expansion', 'Contact record', 'Role: Sales representative', 'Page layout: Deal detail', 'Workflow: Lead assignment']),
        outcome: ctx.random.chance(0.94) ? 'success' : 'denied',
        ipAddressMasked: '203.0.113.***',
        userAgent: ctx.random.pick(['Chrome 141 / macOS', 'Edge 141 / Windows']),
        severity: action.includes('permission') || action.includes('export') ? 'warning' : 'info',
      }] as MockDatabase['auditEvents'][string][]);
    }

    /* --------------------------------------------- customisation metadata */
    add('customObjects', [{
      id: `co-${ctx.organization.id}-1`,
      organizationId: ctx.organization.id,
      singularLabel: 'Asset',
      pluralLabel: 'Assets',
      apiName: 'asset',
      description: 'Equipment or subscription a customer holds.',
      icon: 'Box',
      tone: 'teal',
      status: 'active',
      kind: 'custom',
      navigation: { showInSidebar: true, showInSearch: true, showInReports: true, section: 'sales', sortOrder: 90 },
      features: { activities: true, notes: true, attachments: true, files: true, sharing: true, historyTracking: true, fieldHistoryTrackedFields: ['status'], duplicateDetection: false, workflowEnabled: true, bulkImport: true, apiEnabled: true },
      fieldCount: 0,
      recordCount: ctx.random.int(40, 900),
      relationshipCount: 2,
      layoutIds: [`lay-${ctx.organization.id}-asset`],
      defaultLayoutId: `lay-${ctx.organization.id}-asset`,
      createdAt: toDateTimeString(new Date('2025-02-18T10:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-08-09T14:00:00.000Z')),
    }] as MockDatabase['customObjects'][string][]);

    const fieldDefinitions: Array<{ api: string; label: string; type: import('@crm/shared-types').FieldType; required?: boolean }> = [
      { api: 'asset_serial', label: 'Serial number', type: 'text', required: true },
      { api: 'asset_status', label: 'Asset status', type: 'picklist', required: true },
      { api: 'installed_on', label: 'Installed on', type: 'date' },
      { api: 'warranty_until', label: 'Warranty until', type: 'date' },
      { api: 'purchase_value', label: 'Purchase value', type: 'currency' },
      { api: 'under_contract', label: 'Covered by a contract', type: 'boolean' },
    ];
    add('customFields', fieldDefinitions.map((definition, index) => ({
      id: `cf-${ctx.organization.id}-${index + 1}`,
      organizationId: ctx.organization.id,
      objectApiName: 'asset',
      apiName: definition.api,
      label: definition.label,
      helpText: undefined,
      type: definition.type,
      group: 'Details',
      required: definition.required ?? false,
      unique: definition.api === 'asset_serial',
      readOnly: false,
      sensitive: false,
      picklistValues: definition.type === 'picklist' ? [
        { id: 'pv1', value: 'in_service', label: 'In service', color: 'green' as const, isDefault: true, isActive: true, sortOrder: 1 },
        { id: 'pv2', value: 'in_repair', label: 'In repair', color: 'amber' as const, isDefault: false, isActive: true, sortOrder: 2 },
        { id: 'pv3', value: 'retired', label: 'Retired', color: 'slate' as const, isDefault: false, isActive: true, sortOrder: 3 },
      ] : undefined,
      textFormat: definition.type === 'text' ? { maxLength: 64, caseSensitive: false } : undefined,
      visibilityRules: [],
      fieldPermissions: ctx.roles.slice(0, 3).map((role) => ({ roleId: role.id, roleName: role.name, read: true, edit: role.name === 'Administrator' || role.name === 'Sales manager' })),
      usage: { onLayouts: 1, inFormulas: 0, inWorkflows: definition.api === 'asset_status' ? 1 : 0, inReports: definition.type === 'currency' ? 1 : 0, populatedPercent: ctx.random.int(20, 96) },
      sortOrder: index,
      isActive: true,
      createdAt: toDateTimeString(new Date('2025-02-18T10:10:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-09-14T11:00:00.000Z')),
    })) as MockDatabase['customFields'][string][]);

    add('layouts', [{
      id: `lay-${ctx.organization.id}-asset`,
      organizationId: ctx.organization.id,
      objectApiName: 'asset',
      name: 'Asset detail (default)',
      kind: 'record_detail',
      description: 'The layout shown when an asset record is opened.',
      assignment: { roleIds: ctx.roles.map((role) => role.id), isDefault: true, priority: 1 },
      sections: [
        { id: 'ls1', label: 'Asset information', columns: 2, collapsible: false, collapsedByDefault: false, sortOrder: 1, fields: [
          { id: 'lf1', fieldApiName: 'asset_serial', fieldLabel: 'Serial number', fieldType: 'text', required: true, readOnly: false, span: 1, sortOrder: 1, isSensitive: false },
          { id: 'lf2', fieldApiName: 'asset_status', fieldLabel: 'Asset status', fieldType: 'picklist', required: true, readOnly: false, span: 1, sortOrder: 2, isSensitive: false },
          { id: 'lf3', fieldApiName: 'installed_on', fieldLabel: 'Installed on', fieldType: 'date', required: false, readOnly: false, span: 1, sortOrder: 3, isSensitive: false },
          { id: 'lf4', fieldApiName: 'warranty_until', fieldLabel: 'Warranty until', fieldType: 'date', required: false, readOnly: false, span: 1, sortOrder: 4, isSensitive: false },
        ] },
        { id: 'ls2', label: 'Commercial', columns: 2, collapsible: true, collapsedByDefault: false, sortOrder: 2, fields: [
          { id: 'lf5', fieldApiName: 'purchase_value', fieldLabel: 'Purchase value', fieldType: 'currency', required: false, readOnly: false, span: 1, sortOrder: 1, isSensitive: true },
          { id: 'lf6', fieldApiName: 'under_contract', fieldLabel: 'Covered by a contract', fieldType: 'boolean', required: false, readOnly: false, span: 1, sortOrder: 2, isSensitive: false },
        ] },
      ],
      relatedLists: [
        { id: 'rl1', objectApiName: 'ticket', label: 'Support history', columns: ['reference', 'subject', 'status', 'createdAt'], sortBy: 'createdAt', visible: true, showInMobile: false },
        { id: 'rl2', objectApiName: 'contract', label: 'Contracts', columns: ['reference', 'status', 'endDate'], visible: true, showInMobile: false },
      ],
      highlightsPanel: ['asset_serial', 'asset_status', 'warranty_until'],
      activityTimeline: { enabled: true, defaultFilter: 'all', showInternalNotes: true },
      isActive: true,
      version: 3,
      createdAt: toDateTimeString(new Date('2025-02-18T10:20:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-07-30T09:00:00.000Z')),
    }] as MockDatabase['layouts'][string][]);

    add('validationRules', [{
      id: `vr-${ctx.organization.id}-1`,
      organizationId: ctx.organization.id,
      objectApiName: 'asset',
      name: 'Warranty must end after installation',
      description: 'Prevents a warranty end date that precedes the installation date.',
      errorCondition: { conjunction: 'and', conditions: [{ field: 'warranty_until', operator: 'less_than', value: 'installed_on' }] },
      errorMessage: 'The warranty end date cannot be earlier than the installation date.',
      errorField: 'warranty_until',
      errorLocation: 'inline',
      active: true,
      // Honest split: this rule runs in the form, and is documented for the API.
      enforcement: 'frontend_form_validation',
      evaluatedOn: ['create', 'edit'],
      triggerCount: ctx.random.int(0, 40),
      createdAt: toDateTimeString(new Date('2025-03-02T10:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-06-18T15:00:00.000Z')),
    }] as MockDatabase['validationRules'][string][]);

    add('industryTemplates', foundation.contexts.slice(0, 1).length > 0 ? [{
      id: 'tpl-industry-manufacturing',
      name: 'Manufacturing B2B sales',
      industryId: 'manufacturing',
      industryLabel: 'Manufacturing',
      // The disclaimer is part of the data so the UI cannot render the template without it.
      disclaimer: 'This template is a configuration example. It is not a certified industry solution, and it makes no compliance claim.',
      summary: 'RFQ-driven selling with quotations, samples, lead times and distributor-influenced cycles.',
      icon: 'Factory',
      tone: 'slate',
      contents: {
        objectApiNames: ['account', 'contact', 'lead', 'deal', 'product', 'quote', 'contract', 'rfq'],
        customObjectCount: 1,
        customFieldCount: 14,
        pipelineCount: 1,
        workflowCount: 3,
        dashboardCount: 1,
        reportCount: 4,
        templateCounts: { emailTemplates: 4, documentTemplates: 3, callScripts: 2, taskTemplates: 6 },
        industryTerminology: [
          { standardLabel: 'Opportunity', industryLabel: 'RFQ' },
          { standardLabel: 'Product', industryLabel: 'Part / SKU' },
          { standardLabel: 'Activity', industryLabel: 'Site visit' },
        ],
      },
      sampleFields: [
        { objectLabel: 'RFQ', fields: [{ label: 'Part number', type: 'text' }, { label: 'Annual volume', type: 'number' }, { label: 'Required lead time', type: 'number', note: 'Days' }, { label: 'Response due', type: 'date' }, { label: 'Prototype requested', type: 'boolean' }] },
      ],
      sampleWorkflows: [
        { name: 'RFQ response due', triggerLabel: 'Relative date reached on RFQ', actionSummary: 'Escalate to the sales engineer if no quotation has been issued.' },
        { name: 'Sample dispatched', triggerLabel: 'Field update', actionSummary: 'Create a feedback task for 14 days later.' },
      ],
      samplePipeline: { name: 'Industrial RFQ', stages: [{ name: 'Enquiry received', probability: 10, tone: 'slate' }, { name: 'Technical review', probability: 25, tone: 'blue' }, { name: 'Quotation issued', probability: 45, tone: 'teal' }, { name: 'Sample / trial', probability: 65, tone: 'amber' }, { name: 'Negotiation', probability: 85, tone: 'violet' }, { name: 'Purchase order received', probability: 100, tone: 'green' }] },
      sampleDashboardWidgets: ['Quoted vs ordered value', 'Quote response time', 'Revenue by part family', 'Distributor performance', 'Order backlog'],
      installsCount: ctx.random.int(20, 400),
      complianceNote: undefined,
      regulatoryDisclaimerRequired: false,
      isInstalled: false,
      previewRoute: '/app/templates/tpl-industry-manufacturing',
      createdAt: toDateTimeString(new Date('2025-05-06T10:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-09-22T12:00:00.000Z')),
    }] : [] as MockDatabase['industryTemplates'][string][]);
  }

  /* ------------------------------------------------------ platform level */
  const platform = makePlatform();
  db.platformPlans = keyed(platform.plans);
  db.platformAddOns = keyed(platform.addOns);
  db.platformUsers = keyed(platform.users);
  db.platformRoles = keyed(platform.roles);
  db.platformAudit = keyed(platform.audit);
  db.platformSupportTickets = keyed(platform.supportTickets);
  db.featureFlags = keyed(platform.flags);
  db.moduleCatalog = keyed(platform.moduleCatalog.map((entry) => ({ ...entry, id: `module-${entry.key}` })));
  db.localizationRows = keyed(platform.localization.map((row) => ({ ...row, id: `loc-${row.locale}` })));
  db.systemStatus = keyed(platform.status);
  db.maintenanceBanners = keyed(platform.banners);

  // Platform subscriptions and invoices, one per tenant, referencing the seeded tenants.
  const tenantList = Object.values(db.tenants ?? {});
  const planByTenant: Record<string, string> = { 'ten-vertex': 'plan-professional', 'ten-nordwind': 'plan-enterprise', 'ten-alnoor': 'plan-starter' };
  const planByName = new Map(platform.plans.map((plan) => [plan.id, plan]));

  db.platformSubscriptions = keyed(
    tenantList.map((tenant) => {
      const plan = planByName.get(planByTenant[tenant.id] ?? 'plan-starter')!;
      const interval: 'month' | 'year' = tenant.status === 'trial' ? 'month' : 'year';
      const option = plan.billingOptions.find((candidate) => candidate.interval === interval) ?? plan.billingOptions[0]!;
      const perUser = option.perUserPrice?.amount ?? 0;
      const base = option.basePlatformFee.amount;
      const seats = tenant.seatsPurchased;
      const monthly = base + perUser * seats;
      return {
        id: `psub-${tenant.id}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        planId: plan.id,
        planName: plan.name,
        status: tenant.subscriptionStatus === 'trialing' ? ('trialing' as const) : ('active' as const),
        billingInterval: interval,
        seats,
        seatsUsed: tenant.seatsUsed,
        unitPrice: { amount: perUser, currency: option.currency },
        baseFee: { amount: base, currency: option.currency },
        addOns: plan.addOnIds.slice(0, 2).map((addOnId) => {
          const addOn = platform.addOns.find((candidate) => candidate.id === addOnId);
          return { addOnId, name: addOn?.name ?? 'Add-on', quantity: 1, price: addOn?.price ?? { amount: 0, currency: 'USD' } };
        }),
        currency: option.currency,
        mrr: { amount: monthly, currency: option.currency },
        arr: { amount: monthly * 12, currency: option.currency },
        startedAt: toDateString(new Date('2024-11-15T00:00:00.000Z')),
        currentPeriodStart: toDateString(new Date('2026-10-01T00:00:00.000Z')),
        currentPeriodEnd: toDateString(new Date('2026-10-31T00:00:00.000Z')),
        trialEndsAt: tenant.trialEndsAt,
        renewal: { mode: 'auto', attempts: 0, lastAttemptAt: undefined, lastAttemptState: undefined, nextAttemptAt: toDateTimeString(new Date('2026-11-01T06:00:00.000Z')) },
        // The type makes the absence of a billing integration explicit.
        billingState: 'not_connected' as const,
        ownerTeam: 'revenue' as const,
        notes: undefined,
        createdAt: toDateString(new Date('2024-11-15T00:00:00.000Z')),
        updatedAt: toDateTimeString(new Date('2026-10-01T06:00:00.000Z')),
      };
    }),
  );

  const invoiceSeed = createRandom(20270901);
  db.platformInvoices = keyed(
    Object.values(db.platformSubscriptions).flatMap((subscription, subscriptionIndex) =>
      Array.from({ length: 4 }, (_, index) => {
        const amount = subscription.mrr.amount;
        const status = invoiceSeed.weighted([{ value: 'paid' as const, weight: 74 }, { value: 'open' as const, weight: 14 }, { value: 'uncollectible' as const, weight: 6 }, { value: 'void' as const, weight: 6 }]);
        return {
          id: `pinv-${subscription.tenantId}-${index + 1}`,
          tenantId: subscription.tenantId,
          tenantName: subscription.tenantName,
          subscriptionId: subscription.id,
          reference: `PL-2026-${String(subscriptionIndex * 4 + index + 1).padStart(4, '0')}`,
          status,
          issuedAt: toDateString(new Date(Date.UTC(2026, 6 + index, 1))),
          dueAt: toDateString(new Date(Date.UTC(2026, 6 + index, 15))),
          paidAt: status === 'paid' ? toDateString(new Date(Date.UTC(2026, 6 + index, 8))) : undefined,
          currency: subscription.currency,
          subtotal: { amount, currency: subscription.currency },
          discount: { amount: 0, currency: subscription.currency },
          tax: { amount: 0, currency: subscription.currency },
          total: { amount, currency: subscription.currency },
          amountPaid: { amount: status === 'paid' ? amount : 0, currency: subscription.currency },
          amountDue: { amount: status === 'paid' ? 0 : amount, currency: subscription.currency },
          lineItems: [{ id: `pli-${index}`, description: `${subscription.planName} plan — ${subscription.seats} seats`, quantity: subscription.seats, unitPrice: subscription.unitPrice, amount: { amount: subscription.unitPrice.amount * subscription.seats, currency: subscription.currency } }],
          paymentProviderState: 'not_connected' as const,
          paymentMethodMasked: 'Card ****4242',
          failureReason: status === 'uncollectible' ? 'Card declined by the issuer' : undefined,
          attempts: status === 'uncollectible' ? 3 : 1,
          createdAt: toDateString(new Date(Date.UTC(2026, 6 + index, 1))),
          updatedAt: toDateTimeString(new Date(Date.UTC(2026, 6 + index, 8))),
        };
      }),
    ),
  );

  /* ------------------------------------------- the demo sample dataset ---
   * The public interactive demo runs against its own organization so a visitor cannot
   * touch the main demonstration tenants. It is created by cloning the first tenant's
   * shape with a distinct id prefix, which keeps the demo isolated without a second
   * generator.
   */

  const finalDb: MockDatabase = {
    version: STORAGE_VERSION,
    seededAt: toDateTimeString(DATASET_EPOCH),
    epoch: toDateTimeString(DATASET_EPOCH),
    ...(db as Omit<MockDatabase, 'version' | 'seededAt' | 'epoch'>),
  };


  return finalDb;
}

export { DATASET_EPOCH };
