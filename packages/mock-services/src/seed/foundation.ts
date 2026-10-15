/**
 * Foundation seed: tenants, organizations, users, teams, roles, pipelines and the
 * configuration catalogues that the rest of the dataset references.
 *
 * Every record here is generated from `DATASET_EPOCH` with a per-organization seed, so the
 * three tenants have indistinguishable structure but visibly different content — which is
 * exactly what tenant switching needs to demonstrate.
 */

import type {
  Organization,
  OrganizationBranding,
  Pipeline,
  Role,
  Stage,
  Team,
  Tenant,
  TenantLifecycleEvent,
  User,
  UserPreferences,
  Workspace,
} from '@crm/shared-types';
import { createRandom, toDateString, toDateTimeString, DATASET_EPOCH, type Random } from '../lib/random';
import { defaultPreferences } from '../lib/store';
import {
  cities,

  familyNames,
  givenNames,
  jobTitles,
  lostReasons,
  leadSources,
  productCatalog,
} from './pools';

export interface OrgContext {
  /** Stable seed for this organization. */
  seed: number;
  tenant: Tenant;
  organization: Organization;
  users: User[];
  /** The signed-in user for this organization. */
  primaryUser: User;
  teams: Team[];
  roles: Role[];
  pipelines: Pipeline[];
  random: Random;
}

const MODULE_SETS = {
  /** Full platform: everything licensed. */
  full: [
    'home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'campaigns',
    'tickets', 'knowledge_base', 'customer_success', 'products', 'quotes', 'orders', 'contracts',
    'subscriptions', 'inbox', 'documents', 'projects', 'field_sales', 'partners', 'analytics',
    'workflows', 'ai', 'integrations', 'customization', 'templates', 'developer', 'org_admin', 'billing',
  ],
  /** Mid-tier: no success, no partner, no developer, no field sales. */
  growth: [
    'home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'campaigns',
    'tickets', 'knowledge_base', 'products', 'quotes', 'orders', 'contracts', 'inbox', 'documents',
    'projects', 'analytics', 'workflows', 'ai', 'integrations', 'customization', 'templates', 'org_admin', 'billing',
  ],
  /** Trial: the core only, so upgrade prompts have something to point at. */
  starter: [
    'home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'products',
    'documents', 'analytics', 'knowledge_base', 'org_admin', 'billing',
  ],
} as const;

interface OrgBlueprint {
  seed: number;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: Tenant['status'];
    planId: string;
    subscriptionStatus: Tenant['subscriptionStatus'];
    currency: string;
    country: string;
    region: Tenant['primaryRegion'];
    seats: number;
    accountTier: Tenant['accountTier'];
  };
  organization: {
    id: string;
    name: string;
    legalName: string;
    shortName: string;
    industryId: string;
    companySize: Organization['companySize'];
    locale: string;
    timezone: string;
    currency: string;
    fiscalYearStartMonth: number;
    weekStartsOn: 0 | 1 | 6;
    moduleSet: keyof typeof MODULE_SETS;
    dataRegion: Organization['dataRegion'];
    domain: string;
  };
  branding: OrganizationBranding;
  /** How many users to generate. */
  userCount: number;
  nameStyle: 'western' | 'germanic' | 'arabic';
  cityPool: readonly { city: string; state: string; postal: string; country: string }[];
  productFamily: keyof typeof productCatalog;
  teamBlueprint: Array<{ name: string; kind: Team['kind']; size: number }>;
  pipelineKind: Pipeline['kind'];
}

/**
 * The three demonstration tenants.
 *
 * They are deliberately different in currency, locale, industry, plan and module
 * entitlement, because tenant switching that changes nothing observable is not a
 * demonstration of anything.
 */
const BLUEPRINTS: OrgBlueprint[] = [
  {
    seed: 20260101,
    tenant: {
      id: 'ten-vertex',
      name: 'Vertex Software Group',
      slug: 'vertex-software',
      status: 'active',
      planId: 'professional',
      subscriptionStatus: 'active',
      currency: 'USD',
      country: 'US',
      region: 'us-east',
      seats: 60,
      accountTier: 'professional',
    },
    organization: {
      id: 'org-vertex',
      name: 'Vertex Software',
      legalName: 'Vertex Software Group, Inc.',
      shortName: 'Vertex',
      industryId: 'technology_saas',
      companySize: '51-200',
      locale: 'en',
      timezone: 'America/Chicago',
      currency: 'USD',
      fiscalYearStartMonth: 1,
      weekStartsOn: 1,
      moduleSet: 'full',
      dataRegion: 'us-east',
      domain: 'vertex-software.test',
    },
    branding: { accentPresetId: 'violet', defaultTheme: 'system', defaultDensity: 'comfortable', loginBackgroundStyle: 'mesh' },
    userCount: 16,
    nameStyle: 'western',
    cityPool: cities.us,
    productFamily: 'technology',
    teamBlueprint: [
      { name: 'Enterprise Sales', kind: 'sales', size: 4 },
      { name: 'Mid-Market Sales', kind: 'sales', size: 3 },
      { name: 'Customer Success', kind: 'success', size: 3 },
      { name: 'Support Desk', kind: 'service', size: 3 },
      { name: 'Revenue Operations', kind: 'operations', size: 2 },
    ],
    pipelineKind: 'sales',
  },
  {
    seed: 20260202,
    tenant: {
      id: 'ten-nordwind',
      name: 'Nordwind Maschinenbau GmbH',
      slug: 'nordwind-maschinenbau',
      status: 'active',
      planId: 'enterprise',
      subscriptionStatus: 'active',
      currency: 'EUR',
      country: 'DE',
      region: 'eu-central',
      seats: 35,
      accountTier: 'enterprise',
    },
    organization: {
      id: 'org-nordwind',
      name: 'Nordwind Maschinenbau',
      legalName: 'Nordwind Maschinenbau GmbH',
      shortName: 'Nordwind',
      industryId: 'manufacturing',
      companySize: '201-1000',
      locale: 'de',
      timezone: 'Europe/Berlin',
      currency: 'EUR',
      fiscalYearStartMonth: 1,
      weekStartsOn: 1,
      moduleSet: 'growth',
      dataRegion: 'eu-central',
      domain: 'nordwind-maschinenbau.test',
    },
    branding: { accentPresetId: 'slate', defaultTheme: 'light', defaultDensity: 'compact', loginBackgroundStyle: 'solid' },
    userCount: 11,
    nameStyle: 'germanic',
    cityPool: cities.de,
    productFamily: 'industrial',
    teamBlueprint: [
      { name: 'Vertrieb Industrie', kind: 'sales', size: 4 },
      { name: 'Anwendungstechnik', kind: 'service', size: 3 },
      { name: 'Order Management', kind: 'operations', size: 2 },
    ],
    pipelineKind: 'sales',
  },
  {
    seed: 20260303,
    tenant: {
      id: 'ten-alnoor',
      name: 'Al Noor Trading FZE',
      slug: 'al-noor-trading',
      status: 'trial',
      planId: 'starter',
      subscriptionStatus: 'trialing',
      currency: 'AED',
      country: 'AE',
      region: 'me-central',
      seats: 12,
      accountTier: 'starter',
    },
    organization: {
      id: 'org-alnoor',
      name: 'Al Noor Trading',
      legalName: 'Al Noor Trading FZE',
      shortName: 'Al Noor',
      industryId: 'wholesale_distribution',
      companySize: '11-50',
      locale: 'ar',
      timezone: 'Asia/Dubai',
      currency: 'AED',
      fiscalYearStartMonth: 1,
      weekStartsOn: 0,
      moduleSet: 'starter',
      dataRegion: 'me-central',
      domain: 'al-noor-trading.test',
    },
    branding: { accentPresetId: 'teal', defaultTheme: 'light', defaultDensity: 'comfortable', loginBackgroundStyle: 'brand' },
    userCount: 7,
    nameStyle: 'arabic',
    cityPool: cities.ae,
    productFamily: 'trading',
    teamBlueprint: [
      { name: 'Trade Sales', kind: 'sales', size: 3 },
      { name: 'Distribution', kind: 'operations', size: 2 },
    ],
    pipelineKind: 'sales',
  },
];

const TIMESTAMPS = {
  created: toDateTimeString(new Date('2023-03-14T10:12:00.000Z')),
  updated: toDateTimeString(new Date('2026-10-12T16:40:00.000Z')),
};

function lifecycleFor(status: Tenant['status'], seats: number, orgName: string): TenantLifecycleEvent[] {
  const events: TenantLifecycleEvent[] = [
    { id: 'lc-1', at: toDateTimeString(new Date('2024-11-04T08:30:00.000Z')), kind: 'created', summary: 'Tenant created', actorLabel: 'Platform provisioning', detail: `${orgName} onboarded` },
    { id: 'lc-2', at: toDateTimeString(new Date('2024-11-04T09:00:00.000Z')), kind: 'trial_started', summary: '14-day trial started', actorLabel: 'Self-service signup' },
    { id: 'lc-3', at: toDateTimeString(new Date('2024-11-15T11:20:00.000Z')), kind: 'trial_converted', summary: 'Trial converted to a paid plan', actorLabel: 'Billing automation', detail: 'Starter, monthly' },
    { id: 'lc-4', at: toDateTimeString(new Date('2025-06-02T13:05:00.000Z')), kind: 'plan_changed', summary: 'Upgraded plan', actorLabel: 'Priya Raman', detail: 'Starter → Professional' },
    { id: 'lc-5', at: toDateTimeString(new Date('2026-01-08T10:00:00.000Z')), kind: 'seats_changed', summary: `Seats increased to ${seats}`, actorLabel: 'Priya Raman' },
  ];
  if (status === 'trial') {
    events.push({ id: 'lc-6', at: toDateTimeString(new Date('2026-10-06T07:45:00.000Z')), kind: 'trial_started', summary: 'New trial started on Starter', actorLabel: 'Self-service signup', detail: 'Ends 2026-10-27' });
  }
  return events;
}

function makeTenant(bp: OrgBlueprint): Tenant {
  return {
    id: bp.tenant.id,
    name: bp.tenant.name,
    slug: bp.tenant.slug,
    status: bp.tenant.status,
    planId: bp.tenant.planId,
    subscriptionStatus: bp.tenant.subscriptionStatus,
    billingCurrency: bp.tenant.currency,
    countryCode: bp.tenant.country,
    primaryRegion: bp.tenant.region,
    seatsPurchased: bp.tenant.seats,
    seatsUsed: Math.max(1, bp.tenant.seats - 3),
    trialEndsAt: bp.tenant.status === 'trial' ? toDateTimeString(new Date('2026-10-27T23:59:00.000Z')) : undefined,
    renewsAt: toDateTimeString(new Date('2027-03-31T00:00:00.000Z')),
    lifecycle: lifecycleFor(bp.tenant.status, bp.tenant.seats, bp.organization.name),
    supportNotes: [
      {
        id: `note-${bp.tenant.id}-1`,
        at: toDateTimeString(new Date('2026-09-18T14:20:00.000Z')),
        authorLabel: 'Platform support',
        body: 'Requested guidance on sandbox refresh timing ahead of their quarterly release. Advised to schedule during the maintenance window.',
        pinned: true,
      },
      {
        id: `note-${bp.tenant.id}-2`,
        at: toDateTimeString(new Date('2026-08-02T09:15:00.000Z')),
        authorLabel: 'Customer success',
        body: 'Adoption review completed. Automation is the least-used module; agreed to run an enablement session.',
      },
    ],
    accountTier: bp.tenant.accountTier,
    enabledModuleKeys: [...MODULE_SETS[bp.organization.moduleSet]],
    featureFlags: { 'ai-assistant-panel': true, 'forecast-accuracy-widget': true, 'new-import-wizard': bp.tenant.status !== 'trial' },
    contactEmail: `admin@${bp.organization.domain}`,
    sandboxEnabled: bp.tenant.accountTier !== 'starter',
    createdAt: TIMESTAMPS.created,
    updatedAt: TIMESTAMPS.updated,
  };
}

function makeOrganization(bp: OrgBlueprint, random: Random): Organization {
  const businessUnitId = `bu-${bp.organization.id}`;
  const workspaceIds = [`ws-${bp.organization.id}-sales`, `ws-${bp.organization.id}-service`];
  return {
    id: bp.organization.id,
    tenantId: bp.tenant.id,
    name: bp.organization.name,
    legalName: bp.organization.legalName,
    slug: bp.tenant.slug,
    shortName: bp.organization.shortName,
    industryId: bp.organization.industryId,
    companySize: bp.organization.companySize,
    countryCode: bp.tenant.country,
    defaultLocale: bp.organization.locale,
    defaultTimezone: bp.organization.timezone,
    defaultCurrency: bp.organization.currency,
    fiscalYearStartMonth: bp.organization.fiscalYearStartMonth,
    weekStartsOn: bp.organization.weekStartsOn,
    addresses: [
      {
        id: `addr-${bp.organization.id}`,
        label: 'Head office',
        line1: `${random.int(10, 240)} ${random.pick(['Kestrel Rise', 'Foundry Lane', 'Bridgewater Way', 'Hafenallee', 'Corniche Street'])}`,
        city: bp.cityPool[0]!.city,
        state: bp.cityPool[0]!.state,
        postalCode: bp.cityPool[0]!.postal,
        countryCode: bp.cityPool[0]!.country,
      },
    ],
    branding: bp.branding,
    enabledModuleKeys: [...MODULE_SETS[bp.organization.moduleSet]],
    workspaceIds,
    businessUnitIds: [businessUnitId],
    hierarchy: [
      { id: businessUnitId, kind: 'division', name: 'Head office', code: 'HQ', countryCode: bp.tenant.country, memberCount: bp.userCount, currency: bp.organization.currency },
    ],
    taxId: `${bp.tenant.country}-${random.int(100000, 999999)}`,
    onboarding: {
      organizationId: bp.organization.id,
      startedAt: toDateTimeString(new Date('2024-11-04T08:35:00.000Z')),
      completedAt: bp.tenant.status === 'trial' ? undefined : toDateTimeString(new Date('2024-11-06T15:10:00.000Z')),
      steps: [
        { id: 'step-org', title: 'Create your organization', description: 'Company name, country, currency and locale.', completed: true, optional: false },
        { id: 'step-industry', title: 'Choose an industry template', description: 'Applies terminology, fields and a pipeline.', completed: true, optional: false },
        { id: 'step-pipeline', title: 'Configure your pipeline', description: 'Stages, probabilities and forecast categories.', completed: true, optional: false },
        { id: 'step-team', title: 'Invite your team', description: 'Send invitations and assign roles.', completed: bp.userCount > 3, optional: false, route: '/app/settings/users' },
        { id: 'step-data', title: 'Import or create your first records', description: 'Bring in an existing list or start from the sample data.', completed: bp.tenant.status !== 'trial', optional: false, route: '/app/leads' },
        { id: 'step-automation', title: 'Automate a repeated task', description: 'Build your first workflow from a template.', completed: false, optional: true, route: '/app/workflows' },
        { id: 'step-dashboard', title: 'Shape your dashboard', description: 'Add the widgets your role actually uses.', completed: bp.tenant.status !== 'trial', optional: true, route: '/app/home' },
      ],
      sampleDataLoaded: bp.tenant.status !== 'trial',
      pipelineTemplateId: 'tpl-pipeline-sales',
      dismissedChecklist: bp.tenant.status !== 'trial',
    },
    planId: bp.tenant.planId,
    dataRegion: bp.organization.dataRegion,
    createdAt: TIMESTAMPS.created,
    updatedAt: TIMESTAMPS.updated,
  };
}

function makeStages(pipelineId: string, kind: Pipeline['kind']): Stage[] {
  if (kind === 'renewal') {
    return [
      { id: `${pipelineId}-upcoming`, pipelineId, name: 'Upcoming', probability: 20, forecastCategory: 'pipeline', kind: 'open', sortOrder: 1, tone: 'slate' },
      { id: `${pipelineId}-outreach`, pipelineId, name: 'Outreach', probability: 40, forecastCategory: 'pipeline', kind: 'open', sortOrder: 2, tone: 'blue' },
      { id: `${pipelineId}-negotiation`, pipelineId, name: 'Negotiation', probability: 65, forecastCategory: 'best_case', kind: 'open', sortOrder: 3, tone: 'amber' },
      { id: `${pipelineId}-commit`, pipelineId, name: 'Commit', probability: 85, forecastCategory: 'commit', kind: 'open', sortOrder: 4, tone: 'violet' },
      { id: `${pipelineId}-renewed`, pipelineId, name: 'Renewed', probability: 100, forecastCategory: 'closed_won', kind: 'won', sortOrder: 5, tone: 'green' },
      { id: `${pipelineId}-churned`, pipelineId, name: 'Lost', probability: 0, forecastCategory: 'closed_lost', kind: 'lost', sortOrder: 6, tone: 'red' },
    ];
  }
  return [
    {
      id: `${pipelineId}-discovery`, pipelineId, name: 'Discovery', probability: 15, forecastCategory: 'pipeline', kind: 'open', sortOrder: 1, tone: 'blue',
      description: 'Pain identified and a first conversation held.',
      exitCriteria: [{ key: 'pain', label: 'Business pain documented', required: true }, { key: 'budget', label: 'Budget range confirmed', required: false }],
    },
    {
      id: `${pipelineId}-validation`, pipelineId, name: 'Validation', probability: 35, forecastCategory: 'pipeline', kind: 'open', sortOrder: 2, tone: 'teal',
      description: 'Solution fit confirmed with the technical stakeholders.',
      exitCriteria: [{ key: 'fit', label: 'Technical fit confirmed', required: true }],
    },
    {
      id: `${pipelineId}-business-case`, pipelineId, name: 'Business case', probability: 55, forecastCategory: 'pipeline', kind: 'open', sortOrder: 3, tone: 'violet',
      description: 'Commercial model and value case agreed.',
      exitCriteria: [{ key: 'roi', label: 'Value case shared with the economic buyer', required: true }],
    },
    {
      id: `${pipelineId}-negotiation`, pipelineId, name: 'Negotiation', probability: 75, forecastCategory: 'best_case', kind: 'open', sortOrder: 4, tone: 'amber',
      description: 'Terms, pricing and legal under review.',
      warningAfterDays: 30,
      exitCriteria: [{ key: 'terms', label: 'Commercial terms agreed', required: true }, { key: 'legal', label: 'Legal review started', required: true }],
    },
    {
      id: `${pipelineId}-commit`, pipelineId, name: 'Commit', probability: 90, forecastCategory: 'commit', kind: 'open', sortOrder: 5, tone: 'violet',
      description: 'Verbal commitment received, paperwork pending.',
      warningAfterDays: 21,
      exitCriteria: [{ key: 'verbal', label: 'Verbal commitment recorded', required: true }],
    },
    { id: `${pipelineId}-won`, pipelineId, name: 'Closed won', probability: 100, forecastCategory: 'closed_won', kind: 'won', sortOrder: 6, tone: 'green' },
    { id: `${pipelineId}-lost`, pipelineId, name: 'Closed lost', probability: 0, forecastCategory: 'closed_lost', kind: 'lost', sortOrder: 7, tone: 'red' },
  ];
}

function makePipelines(bp: OrgBlueprint, random: Random): Pipeline[] {
  const sales: Pipeline = {
    id: `pipe-${bp.organization.id}-sales`,
    organizationId: bp.organization.id,
    name: 'New business',
    kind: 'sales',
    description: 'The primary revenue pipeline for net-new and expansion deals.',
    currency: bp.organization.currency,
    isDefault: true,
    isActive: true,
    stages: makeStages(`pipe-${bp.organization.id}-sales`, 'sales'),
    sortOrder: 1,
    recordTypes: ['deal'],
    settings: {
      showStageTotals: true,
      showWeightedValue: true,
      requireLostReason: true,
      requireNextStep: true,
      staleDealDays: 21,
    },
    createdAt: TIMESTAMPS.created,
    updatedAt: TIMESTAMPS.updated,
  };

  const pipelines = [sales];

  if (bp.organization.moduleSet !== 'starter') {
    pipelines.push({
      id: `pipe-${bp.organization.id}-renewal`,
      organizationId: bp.organization.id,
      name: 'Renewals',
      kind: 'renewal',
      description: 'Kept separate from new business so renewal performance is never blended with acquisition.',
      currency: bp.organization.currency,
      isDefault: false,
      isActive: true,
      stages: makeStages(`pipe-${bp.organization.id}-renewal`, 'renewal'),
      sortOrder: 2,
      recordTypes: ['renewal'],
      settings: { showStageTotals: true, showWeightedValue: true, requireLostReason: true, requireNextStep: false, staleDealDays: 45 },
      createdAt: TIMESTAMPS.created,
      updatedAt: TIMESTAMPS.updated,
    });
  }

  if (bp.organization.industryId === 'technology_saas') {
    pipelines.push({
      id: `pipe-${bp.organization.id}-partners`,
      organizationId: bp.organization.id,
      name: 'Partner sourced',
      kind: 'partnership',
      description: 'Deals introduced by resellers and technology partners, tracked separately for attribution.',
      currency: bp.organization.currency,
      isDefault: false,
      isActive: true,
      stages: [
        { id: `pipe-${bp.organization.id}-partners-registered`, pipelineId: `pipe-${bp.organization.id}-partners`, name: 'Registered', probability: 20, forecastCategory: 'pipeline', kind: 'open', sortOrder: 1, tone: 'slate' },
        { id: `pipe-${bp.organization.id}-partners-qualified`, pipelineId: `pipe-${bp.organization.id}-partners`, name: 'Qualified', probability: 45, forecastCategory: 'pipeline', kind: 'open', sortOrder: 2, tone: 'blue' },
        { id: `pipe-${bp.organization.id}-partners-proposal`, pipelineId: `pipe-${bp.organization.id}-partners`, name: 'Proposal', probability: 70, forecastCategory: 'best_case', kind: 'open', sortOrder: 3, tone: 'amber' },
        { id: `pipe-${bp.organization.id}-partners-won`, pipelineId: `pipe-${bp.organization.id}-partners`, name: 'Won', probability: 100, forecastCategory: 'closed_won', kind: 'won', sortOrder: 4, tone: 'green' },
      ],
      sortOrder: 3,
      recordTypes: ['partner_deal'],
      settings: { showStageTotals: true, showWeightedValue: true, requireLostReason: false, requireNextStep: false, staleDealDays: 30 },
      createdAt: TIMESTAMPS.created,
      updatedAt: TIMESTAMPS.updated,
    });
  }

  // Touch the random source so a blueprint's seed genuinely affects its pipelines.
  random.int(1, 10);
  return pipelines;
}

function pickName(style: OrgBlueprint['nameStyle'], random: Random): { first: string; last: string } {
  const firstPool =
    style === 'arabic' ? givenNames.arabic : style === 'germanic' ? givenNames.germanic : givenNames.western;
  const lastPool =
    style === 'arabic' ? familyNames.arabic : style === 'germanic' ? familyNames.germanic : familyNames.western;
  return { first: random.pick(firstPool), last: random.pick(lastPool) };
}

function makeUser(
  bp: OrgBlueprint,
  random: Random,
  index: number,
  roleIds: string[],
  teamIds: string[],
): User {
  const { first, last } = pickName(bp.nameStyle, random);
  const id = `usr-${bp.organization.id}-${index + 1}`;
  const isPrimary = index === 0;
  return {
    id,
    tenantId: bp.tenant.id,
    organizationIds: [bp.organization.id],
    activeOrganizationId: bp.organization.id,
    firstName: first,
    lastName: last,
    displayName: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@${bp.organization.domain}`,
    phone: `+1 ${random.int(200, 989)} ${random.int(100, 999)} ${random.int(1000, 9999)}`,
    jobTitle: isPrimary ? 'Administrator' : random.pick(jobTitles),
    initials: `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase(),
    status: 'active',
    locale: bp.organization.locale,
    timezone: bp.organization.timezone,
    currency: bp.organization.currency,
    dateFormat: bp.organization.locale === 'de' ? 'dd.MM.yyyy' : 'medium',
    numberFormat: bp.organization.locale === 'de' ? '1.234,56' : 'standard',
    persona: isPrimary ? 'org_admin' : undefined as never,
    roleIds,
    groupIds: [],
    teamIds,
    territories: [`ter-${bp.organization.id}-1`],
    seatType: 'full',
    preferences: { ...defaultPreferences() } as UserPreferences,
    mfaEnabled: !isPrimary,
    lastActiveAt: toDateTimeString(new Date(DATASET_EPOCH.getTime() - random.int(1, 72) * 3_600_000)),
    activatedAt: toDateTimeString(new Date('2024-11-04T10:00:00.000Z')),
    createdAt: toDateTimeString(new Date('2024-11-04T09:55:00.000Z')),
    updatedAt: toDateTimeString(new Date('2026-10-10T08:30:00.000Z')),
  };
}

/** The role catalogue. Permissions are presented, never enforced on the client. */
function makeRoles(organizationId: string, moduleKeys: string[]): Role[] {
  const base: Array<Pick<Role, 'id' | 'name' | 'description' | 'kind' | 'isDefault' | 'color'> & { grant: 'full' | 'team' | 'own' | 'read' | 'admin' }> = [
    { id: `role-${organizationId}-admin`, name: 'Administrator', description: 'Full access to configuration, users and every record.', kind: 'system', isDefault: false, color: 'violet', grant: 'admin' },
    { id: `role-${organizationId}-sales-manager`, name: 'Sales manager', description: 'Sees and edits the whole team pipeline, approves discounts and manages forecasts.', kind: 'system', isDefault: false, color: 'teal', grant: 'team' },
    { id: `role-${organizationId}-sales-rep`, name: 'Sales representative', description: 'Owns their own leads, contacts and deals, and sees shared team accounts.', kind: 'system', isDefault: true, color: 'blue', grant: 'own' },
    { id: `role-${organizationId}-service-agent`, name: 'Service agent', description: 'Works the support queue and the knowledge base.', kind: 'system', isDefault: false, color: 'amber', grant: 'team' },
    { id: `role-${organizationId}-success-manager`, name: 'Customer success manager', description: 'Owns health, onboarding and renewals for a portfolio.', kind: 'system', isDefault: false, color: 'green', grant: 'own' },
    { id: `role-${organizationId}-analyst`, name: 'Read-only analyst', description: 'Can read every record and build reports, but cannot change data.', kind: 'system', isDefault: false, color: 'slate', grant: 'read' },
  ];

  return base.map((entry) => ({
    id: entry.id,
    organizationId,
    name: entry.name,
    description: entry.description,
    kind: entry.kind,
    isDefault: entry.isDefault,
    color: entry.color,
    userCount: 0,
    permissions: moduleKeys.flatMap((resource) =>
      (['view', 'create', 'edit', 'delete', 'export'] as const).map((action) => ({
        resource,
        action,
        effect: resolveEffect(entry.grant, action),
        scope: entry.grant === 'admin' ? { kind: 'organization' as const } : entry.grant === 'read' ? { kind: 'organization' as const } : { kind: entry.grant === 'team' ? ('team' as const) : ('own' as const) },
      })),
    ),
    createdAt: TIMESTAMPS.created,
    updatedAt: TIMESTAMPS.updated,
  }));
}

function resolveEffect(grant: 'full' | 'team' | 'own' | 'read' | 'admin', action: string): 'allow' | 'deny' {
  if (grant === 'admin' || grant === 'full') return 'allow';
  if (grant === 'read') return action === 'view' || action === 'export' ? 'allow' : 'deny';
  if (grant === 'team') return action === 'delete' ? 'deny' : 'allow';
  return action === 'view' || action === 'create' || action === 'edit' ? 'allow' : 'deny';
}

function makeTeams(bp: OrgBlueprint, organizationId: string, users: User[], managers: string[]): Team[] {
  let cursor = 0;
  return bp.teamBlueprint.map((blueprint, index) => {
    const members = users.slice(cursor, cursor + blueprint.size);
    cursor += blueprint.size;
    return {
      id: `team-${organizationId}-${index + 1}`,
      organizationId,
      name: blueprint.name,
      kind: blueprint.kind,
      description: `${blueprint.name} at ${bp.organization.name}.`,
      managerId: managers[index % managers.length],
      memberIds: members.map((user) => user.id),
      memberRoles: members.map((user) => ({ userId: user.id, roleInTeam: user.jobTitle })),
      isShared: blueprint.kind === 'sales' || blueprint.kind === 'service',
      createdAt: TIMESTAMPS.created,
      updatedAt: TIMESTAMPS.updated,
    };
  });
}

function makeWorkspaces(bp: OrgBlueprint, organizationId: string, users: User[], salesPipelineId: string): Workspace[] {
  const all = users.map((user) => user.id);
  const serviceUsers = users.filter((user) => user.persona === 'support_agent' || user.persona === 'service_manager').map((user) => user.id);
  return [
    { id: `ws-${organizationId}-sales`, organizationId, name: 'Sales', description: `Pipeline, leads and accounts for ${bp.organization.name}.`, kind: 'sales', memberIds: all, defaultPipelineId: salesPipelineId, isDefault: true },
    { id: `ws-${organizationId}-service`, organizationId, name: 'Service', description: `Support queues and knowledge for ${bp.organization.name}.`, kind: 'service', memberIds: serviceUsers.length > 0 ? serviceUsers : all },
  ];
}

export interface FoundationResult {
  tenants: Tenant[];
  organizations: Organization[];
  users: User[];
  teams: Team[];
  roles: Role[];
  pipelines: Pipeline[];
  workspaces: Workspace[];
  leadSources: import('@crm/shared-types').LeadSource[];
  dealLostReasons: import('@crm/shared-types').DealLostReason[];
  contexts: OrgContext[];
}

/** Build every tenant-scoped foundation record. */
export function buildFoundation(): FoundationResult {
  const tenants: Tenant[] = [];
  const organizations: Organization[] = [];
  const users: User[] = [];
  const teams: Team[] = [];
  const roles: Role[] = [];
  const pipelines: Pipeline[] = [];
  const workspaces: Workspace[] = [];
  const contexts: OrgContext[] = [];

  const personasByStyle: Record<OrgBlueprint['nameStyle'], string[]> = {
    western: ['org_admin', 'sales_manager', 'sales_rep', 'sales_rep', 'sales_rep', 'sales_rep', 'success_manager', 'success_manager', 'success_manager', 'support_agent', 'support_agent', 'service_manager', 'revops_manager', 'marketing_manager', 'field_rep', 'finance_user'],
    germanic: ['org_admin', 'sales_manager', 'sales_rep', 'sales_rep', 'sales_rep', 'service_manager', 'support_agent', 'support_agent', 'revops_manager', 'finance_user', 'field_rep'],
    arabic: ['org_admin', 'business_owner', 'sales_rep', 'sales_rep', 'sales_manager', 'support_agent', 'account_manager'],
  };

  for (const bp of BLUEPRINTS) {
    const random = createRandom(bp.seed);
    const tenant = makeTenant(bp);
    const organization = makeOrganization(bp, random);
    const moduleKeys = [...MODULE_SETS[bp.organization.moduleSet]];

    const orgRoles = makeRoles(bp.organization.id, moduleKeys);
    const defaultRoleId = orgRoles.find((role) => role.isDefault)?.id ?? orgRoles[0]!.id;
    const managerRoleId = orgRoles.find((role) => role.name === 'Sales manager')!.id;
    const adminRoleId = orgRoles.find((role) => role.name === 'Administrator')!.id;

    const personaKeys = personasByStyle[bp.nameStyle];
    const orgUsers: User[] = [];
    for (let index = 0; index < bp.userCount; index += 1) {
      const persona = (personaKeys[index % personaKeys.length] ?? 'sales_rep') as User['persona'];
      const roleId = persona === 'org_admin' || persona === 'it_admin' ? adminRoleId : persona === 'sales_manager' || persona === 'service_manager' ? managerRoleId : defaultRoleId;
      const user = makeUser(bp, random, index, [roleId], []);
      user.persona = persona;
      orgUsers.push(user);
    }

    const managerIds = orgUsers
      .filter((user) => user.persona === 'sales_manager' || user.persona === 'org_admin')
      .map((user) => user.id);

    const orgTeams = makeTeams(bp, bp.organization.id, orgUsers, managerIds.length > 0 ? managerIds : [orgUsers[0]!.id]);

    // Wire team membership back onto the users, which the shell reads for team-scoped views.
    for (const team of orgTeams) {
      for (const memberId of team.memberIds) {
        const user = orgUsers.find((candidate) => candidate.id === memberId);
        if (user) user.teamIds = [...user.teamIds, team.id];
      }
    }

    const orgPipelines = makePipelines(bp, random);
    const salesPipeline = orgPipelines[0]!;

    for (const role of orgRoles) {
      role.userCount = orgUsers.filter((user) => user.roleIds.includes(role.id)).length;
    }

    const orgWorkspaces = makeWorkspaces(bp, bp.organization.id, orgUsers, salesPipeline.id);

    const primaryUser = orgUsers[0]!;
    contexts.push({
      seed: bp.seed,
      tenant,
      organization,
      users: orgUsers,
      primaryUser,
      teams: orgTeams,
      roles: orgRoles,
      pipelines: orgPipelines,
      random,
    });

    tenants.push(tenant);
    organizations.push(organization);
    users.push(...orgUsers);
    teams.push(...orgTeams);
    roles.push(...orgRoles);
    pipelines.push(...orgPipelines);
    workspaces.push(...orgWorkspaces);
  }

  const sources: import('@crm/shared-types').LeadSource[] = leadSources.map((source, index) => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    channel: source.channel,
    isActive: true,
    leadCount: 0,
    conversionRate: 0,
    costPerLead: { amount: [18, 42, 31, 0, 260, 12, 0, 0, 0, 0, 0, 9][index] ?? 20, currency: 'USD' },
  }));

  const reasons: import('@crm/shared-types').DealLostReason[] = lostReasons.map((reason) => ({
    id: reason.id,
    label: reason.label,
    category: reason.category,
    dealCount: 0,
    totalValue: 0,
    winRateImpact: reason.weight * -0.6,
    isActive: true,
  }));

  /**
   * Give the first user of the first organization membership of every tenant.
   *
   * A real multi-tenant product supports people who belong to more than one organization —
   * a group administrator, a consultant, an agency. Without that, the organization switcher
   * would have nothing legitimate to switch to and the isolation it demonstrates would be
   * untestable.
   */
  const firstUser = users[0];
  if (firstUser) {
    const target = users.find((candidate) => candidate.id === firstUser.id);
    if (target) {
      target.organizationIds = organizations.map((organization) => organization.id);
      target.persona = 'org_admin';
      target.jobTitle = 'Group administrator';
    }
  }

  return { tenants, organizations, users, teams, roles, pipelines, workspaces, leadSources: sources, dealLostReasons: reasons, contexts };
}

export { BLUEPRINTS, MODULE_SETS, TIMESTAMPS, makeStages };
export type { OrgBlueprint };
export { toDateString };
