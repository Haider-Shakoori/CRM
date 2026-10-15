/**
 * Module registry.
 *
 * One definition of every capability area in the product. This drives:
 *   - the CRM sidebar (grouping, labels, icons, ordering)
 *   - Simple vs Advanced Mode visibility
 *   - persona default navigation
 *   - entitlement checks and upgrade prompts
 *   - the platform-owner module catalog
 *   - the website's feature/solution page mapping
 *
 * Nothing in navigation or routing should be hardcoded anywhere else.
 */

import type { PersonaKey } from '@crm/shared-types';

export type NavSectionKey =
  | 'workspace'
  | 'sales'
  | 'marketing'
  | 'service'
  | 'revenue'
  | 'productivity'
  | 'insights'
  | 'automation'
  | 'customize'
  | 'admin';

export type ModuleKey =
  | 'home'
  | 'leads'
  | 'contacts'
  | 'accounts'
  | 'deals'
  | 'activities'
  | 'calendar'
  | 'inbox'
  | 'campaigns'
  | 'tickets'
  | 'knowledge_base'
  | 'customer_success'
  | 'products'
  | 'quotes'
  | 'orders'
  | 'contracts'
  | 'subscriptions'
  | 'projects'
  | 'field_sales'
  | 'analytics'
  | 'workflows'
  | 'ai'
  | 'documents'
  | 'partners'
  | 'customization'
  | 'templates'
  | 'integrations'
  | 'developer'
  | 'org_admin'
  | 'billing'
  | 'portal';

export interface NavSection {
  key: NavSectionKey;
  label: string;
  /** Rendered above the group in the sidebar. */
  order: number;
  advancedOnly: boolean;
  description: string;
}

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  shortLabel?: string;
  section: NavSectionKey;
  /** Lucide icon name, resolved by the shell's icon map. */
  icon: string;
  route: string;
  order: number;
  /** One-line description reused by tooltips, upgrade prompts and the module catalog. */
  description: string;
  /** Long-form copy used on the website feature pages. */
  marketingDescription: string;
  /** Hidden in Simple Mode when true. */
  advancedOnly: boolean;
  /** Always available regardless of the tenant's plan — the core CRM shell. */
  alwaysIncluded: boolean;
  /** Shown only when the tenant's role grants the permission. */
  requiredPermission?: string;
  /** Which personas get this module in their default navigation. */
  defaultForPersonas: PersonaKey[];
  /** Related module keys surfaced as cross-links in the UI. */
  relatedModules: ModuleKey[];
  /** Renders an unread/overdue counter in the sidebar. */
  badgeSource?: 'notifications' | 'overdue_tasks' | 'open_tickets' | 'unread_conversations' | 'pending_approvals' | 'none';
  /** Grouped child routes for the mega-nav and the settings tree. */
  children?: Array<{ key: string; label: string; route: string; advancedOnly?: boolean; description?: string }>;
  /** Plan tier that introduces the module, for upgrade messaging. */
  introducedInPlan: 'free' | 'starter' | 'professional' | 'enterprise';
  category: 'core' | 'sales' | 'marketing' | 'service' | 'success' | 'operations' | 'platform' | 'addon';
}

export const navSections: NavSection[] = [
  { key: 'workspace', label: 'Workspace', order: 10, advancedOnly: false, description: 'Your home, activity and personal productivity surfaces.' },
  { key: 'sales', label: 'Sales', order: 20, advancedOnly: false, description: 'Leads, contacts, accounts and the deal pipeline.' },
  { key: 'marketing', label: 'Marketing', order: 30, advancedOnly: false, description: 'Campaigns, audiences, journeys and forms.' },
  { key: 'service', label: 'Service', order: 40, advancedOnly: false, description: 'Support tickets, SLAs and the knowledge base.' },
  { key: 'revenue', label: 'Revenue', order: 50, advancedOnly: false, description: 'Products, quotes, orders, contracts and recurring revenue.' },
  { key: 'productivity', label: 'Productivity', order: 60, advancedOnly: false, description: 'Tasks, calendar, notes and collaboration.' },
  { key: 'insights', label: 'Insights', order: 70, advancedOnly: false, description: 'Dashboards, reports, forecasts and analytics.' },
  { key: 'automation', label: 'Automation', order: 80, advancedOnly: true, description: 'Workflows, rules, AI assistance and the integration catalogue.' },
  { key: 'customize', label: 'Customize', order: 90, advancedOnly: true, description: 'Objects, fields, layouts, views and industry templates.' },
  { key: 'admin', label: 'Administration', order: 100, advancedOnly: false, description: 'Organization, people, security, data and billing settings.' },
];

const ALL_PERSONAS: PersonaKey[] = [
  'business_owner', 'ceo', 'sales_rep', 'sales_manager', 'sales_director', 'marketing_specialist',
  'marketing_manager', 'support_agent', 'service_manager', 'account_manager', 'success_manager',
  'revops_manager', 'finance_user', 'field_rep', 'org_admin', 'it_admin',
];

const SALES_PERSONAS: PersonaKey[] = ['business_owner', 'ceo', 'sales_rep', 'sales_manager', 'sales_director', 'account_manager', 'revops_manager', 'field_rep'];
const MARKETING_PERSONAS: PersonaKey[] = ['business_owner', 'ceo', 'marketing_specialist', 'marketing_manager', 'revops_manager'];
const SERVICE_PERSONAS: PersonaKey[] = ['business_owner', 'ceo', 'support_agent', 'service_manager', 'success_manager'];
const SUCCESS_PERSONAS: PersonaKey[] = ['business_owner', 'ceo', 'account_manager', 'success_manager', 'revops_manager'];
const REVENUE_PERSONAS: PersonaKey[] = ['business_owner', 'ceo', 'finance_user', 'revops_manager', 'account_manager'];
const LEADER_PERSONAS: PersonaKey[] = ['business_owner', 'ceo', 'sales_director', 'revops_manager'];

export const modules: ModuleDefinition[] = [
  /* ---------------------------------------------------------- workspace */
  {
    key: 'home',
    label: 'Home',
    section: 'workspace',
    icon: 'LayoutDashboard',
    route: '/app/home',
    order: 10,
    description: 'Role-based dashboards with the numbers and next actions that matter to you.',
    marketingDescription: 'Eleven role-oriented dashboards — from a rep’s daily view to a board-level revenue summary — all built from the same record data and fully rearrangeable.',
    advancedOnly: false,
    alwaysIncluded: true,
    defaultForPersonas: ALL_PERSONAS,
    relatedModules: ['analytics', 'activities', 'deals'],
    badgeSource: 'none',
    introducedInPlan: 'free',
    category: 'core',
  },
  {
    key: 'activities',
    label: 'My Work',
    section: 'workspace',
    icon: 'ListChecks',
    route: '/app/activities',
    order: 20,
    description: 'Tasks, calls, meetings and follow-ups in one prioritised queue.',
    marketingDescription: 'A single daily plan that combines overdue tasks, sequence steps, meeting preparation and stale-deal reminders, so a rep always knows the next action.',
    advancedOnly: false,
    alwaysIncluded: true,
    defaultForPersonas: ALL_PERSONAS,
    relatedModules: ['calendar', 'deals', 'inbox'],
    badgeSource: 'overdue_tasks',
    introducedInPlan: 'free',
    category: 'core',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    section: 'workspace',
    icon: 'CalendarDays',
    route: '/app/calendar',
    order: 30,
    description: 'Meetings, demos and visit schedules with preparation briefs.',
    marketingDescription: 'Day, week and month views with shared team calendars, deterministic slot suggestions and a preparation brief for every customer meeting.',
    advancedOnly: false,
    alwaysIncluded: true,
    defaultForPersonas: ALL_PERSONAS,
    relatedModules: ['activities', 'inbox', 'field_sales'],
    badgeSource: 'none',
    introducedInPlan: 'free',
    category: 'core',
  },

  /* -------------------------------------------------------------- sales */
  {
    key: 'leads',
    label: 'Leads',
    section: 'sales',
    icon: 'UserPlus',
    route: '/app/leads',
    order: 10,
    description: 'Capture, score, qualify and convert inbound and outbound leads.',
    marketingDescription: 'Explainable lead scoring, response-time SLAs, duplicate review, guided conversion into contact, account and deal, and a full import wizard with field mapping.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: SALES_PERSONAS,
    relatedModules: ['contacts', 'deals', 'campaigns'],
    badgeSource: 'none',
    introducedInPlan: 'starter',
    category: 'sales',
    children: [
      { key: 'leads.list', label: 'All leads', route: '/app/leads' },
      { key: 'leads.board', label: 'Lead board', route: '/app/leads/board' },
      { key: 'leads.sources', label: 'Lead sources', route: '/app/leads/sources' },
      { key: 'leads.import', label: 'Import wizard', route: '/app/leads/import', advancedOnly: true },
      { key: 'leads.duplicates', label: 'Duplicate review', route: '/app/leads/duplicates', advancedOnly: true },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    section: 'sales',
    icon: 'Users',
    route: '/app/contacts',
    order: 20,
    description: 'People, relationships, consent and the full interaction history.',
    marketingDescription: 'A Customer 360 profile that brings together relationships, buying committee roles, consent state per channel, communications, deals, tickets and documents.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...SALES_PERSONAS, ...SERVICE_PERSONAS, ...SUCCESS_PERSONAS],
    relatedModules: ['accounts', 'deals', 'documents'],
    badgeSource: 'none',
    introducedInPlan: 'free',
    category: 'sales',
    children: [
      { key: 'contacts.list', label: 'All contacts', route: '/app/contacts' },
      { key: 'contacts.segments', label: 'Segments', route: '/app/contacts/segments', advancedOnly: true },
      { key: 'contacts.duplicates', label: 'Duplicate review', route: '/app/contacts/duplicates', advancedOnly: true },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    section: 'sales',
    icon: 'Building2',
    route: '/app/accounts',
    order: 30,
    description: 'Companies, hierarchies, health and account-based workspaces.',
    marketingDescription: 'Parent-child hierarchies, revenue snapshots, health signals, contracts and an account-based-selling workspace that puts the buying committee, open deals and support history side by side.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...SALES_PERSONAS, ...SUCCESS_PERSONAS, ...SERVICE_PERSONAS],
    relatedModules: ['contacts', 'deals', 'customer_success'],
    badgeSource: 'none',
    introducedInPlan: 'free',
    category: 'sales',
    children: [
      { key: 'accounts.list', label: 'All accounts', route: '/app/accounts' },
      { key: 'accounts.hierarchy', label: 'Hierarchy', route: '/app/accounts/hierarchy', advancedOnly: true },
    ],
  },
  {
    key: 'deals',
    label: 'Deals',
    shortLabel: 'Pipeline',
    section: 'sales',
    icon: 'KanbanSquare',
    route: '/app/deals',
    order: 40,
    description: 'Multiple pipelines, drag-and-drop stages, products and forecasting.',
    marketingDescription: 'The pipeline is the product. Weighted values update as cards move, every stage can require exit criteria, and accessible non-drag controls stay perfectly in sync with the board.',
    advancedOnly: false,
    alwaysIncluded: true,
    defaultForPersonas: [...SALES_PERSONAS, 'success_manager'],
    relatedModules: ['accounts', 'quotes', 'analytics'],
    badgeSource: 'none',
    introducedInPlan: 'free',
    category: 'sales',
    children: [
      { key: 'deals.board', label: 'Pipeline board', route: '/app/deals' },
      { key: 'deals.list', label: 'Deal list', route: '/app/deals/list' },
      { key: 'deals.forecast', label: 'Forecast', route: '/app/deals/forecast' },
      { key: 'deals.pipelines', label: 'Pipeline configuration', route: '/app/deals/pipelines', advancedOnly: true },
      { key: 'deals.lost-reasons', label: 'Lost reasons', route: '/app/deals/lost-reasons', advancedOnly: true },
    ],
  },

  /* ---------------------------------------------------------- marketing */
  {
    key: 'campaigns',
    label: 'Campaigns',
    section: 'marketing',
    icon: 'Megaphone',
    route: '/app/campaigns',
    order: 10,
    description: 'Campaign management, email building, journeys and attribution.',
    marketingDescription: 'Segment your audience, build emails in a structured editor, design multi-step journeys on a visual canvas and see which touchpoints actually produced revenue.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: MARKETING_PERSONAS,
    relatedModules: ['leads', 'contacts', 'analytics'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'marketing',
    children: [
      { key: 'campaigns.list', label: 'All campaigns', route: '/app/campaigns' },
      { key: 'campaigns.calendar', label: 'Calendar', route: '/app/campaigns/calendar' },
      { key: 'campaigns.templates', label: 'Email templates', route: '/app/campaigns/templates' },
      { key: 'campaigns.segments', label: 'Audiences', route: '/app/campaigns/segments' },
      { key: 'campaigns.journeys', label: 'Journeys', route: '/app/campaigns/journeys' },
      { key: 'campaigns.forms', label: 'Forms & pages', route: '/app/campaigns/forms', advancedOnly: true },
      { key: 'campaigns.attribution', label: 'Attribution', route: '/app/campaigns/attribution', advancedOnly: true },
      { key: 'campaigns.ab-tests', label: 'A/B tests', route: '/app/campaigns/ab-tests', advancedOnly: true },
    ],
  },

  /* ------------------------------------------------------------- service */
  {
    key: 'tickets',
    label: 'Support',
    section: 'service',
    icon: 'LifeBuoy',
    route: '/app/tickets',
    order: 10,
    description: 'Ticket queues, SLAs, escalation and agent performance.',
    marketingDescription: 'Multiple queues, priority-based SLA targets with pause windows and escalation rules, plus agent performance and satisfaction reporting that reflects real ticket data.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: SERVICE_PERSONAS,
    relatedModules: ['knowledge_base', 'contacts', 'inbox'],
    badgeSource: 'open_tickets',
    introducedInPlan: 'professional',
    category: 'service',
    children: [
      { key: 'tickets.list', label: 'Ticket list', route: '/app/tickets' },
      { key: 'tickets.board', label: 'Ticket board', route: '/app/tickets/board' },
      { key: 'tickets.sla', label: 'SLA policies', route: '/app/tickets/sla', advancedOnly: true },
      { key: 'tickets.categories', label: 'Categories & queues', route: '/app/tickets/categories', advancedOnly: true },
      { key: 'tickets.surveys', label: 'Surveys', route: '/app/tickets/surveys', advancedOnly: true },
    ],
  },
  {
    key: 'knowledge_base',
    label: 'Knowledge Base',
    section: 'service',
    icon: 'BookOpen',
    route: '/app/knowledge-base',
    order: 20,
    description: 'Internal and public articles with review workflows.',
    marketingDescription: 'Structured article blocks, review dates, helpfulness voting and article suggestions while composing a reply — so the knowledge base gets used instead of forgotten.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: SERVICE_PERSONAS,
    relatedModules: ['tickets', 'portal'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'service',
  },
  {
    key: 'customer_success',
    label: 'Customer Success',
    section: 'service',
    icon: 'HeartHandshake',
    route: '/app/customer-success',
    order: 30,
    description: 'Health scores, onboarding, renewals and churn risk.',
    marketingDescription: 'Explainable health scoring with weighted components, onboarding plans created automatically when a deal is won, a separate renewal pipeline and churn-risk playbooks.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: SUCCESS_PERSONAS,
    relatedModules: ['accounts', 'contracts', 'analytics'],
    badgeSource: 'none',
    introducedInPlan: 'enterprise',
    category: 'success',
    children: [
      { key: 'success.overview', label: 'Overview', route: '/app/customer-success' },
      { key: 'success.health', label: 'Health scores', route: '/app/customer-success/health' },
      { key: 'success.onboarding', label: 'Onboarding', route: '/app/customer-success/onboarding' },
      { key: 'success.renewals', label: 'Renewals', route: '/app/customer-success/renewals' },
      { key: 'success.churn', label: 'Churn risk', route: '/app/customer-success/churn-risk' },
      { key: 'success.voice', label: 'NPS & CSAT', route: '/app/customer-success/voice-of-customer' },
    ],
  },

  /* ------------------------------------------------------------- revenue */
  {
    key: 'products',
    label: 'Products',
    section: 'revenue',
    icon: 'Package',
    route: '/app/products',
    order: 10,
    description: 'Catalog, variants, bundles and price books.',
    marketingDescription: 'A configurable product catalog with variants, bundles, recurring lines and multiple price books per currency or customer segment.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...REVENUE_PERSONAS, 'sales_manager'],
    relatedModules: ['quotes', 'deals'],
    badgeSource: 'none',
    introducedInPlan: 'starter',
    category: 'operations',
  },
  {
    key: 'quotes',
    label: 'Quotes',
    section: 'revenue',
    icon: 'FileText',
    route: '/app/quotes',
    order: 20,
    description: 'Quote builder with line items, discounts and approvals.',
    marketingDescription: 'Line-item editing with live totals, recurring and one-off billing in one quote, discount thresholds that trigger an approval chain, revision history and a signature workflow preview.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...REVENUE_PERSONAS, 'sales_rep', 'sales_manager'],
    relatedModules: ['products', 'orders', 'contracts'],
    badgeSource: 'pending_approvals',
    introducedInPlan: 'professional',
    category: 'operations',
  },
  {
    key: 'orders',
    label: 'Orders',
    section: 'revenue',
    icon: 'ClipboardList',
    route: '/app/orders',
    order: 30,
    description: 'Order activation, fulfilment and billing presentation.',
    marketingDescription: 'Convert accepted quotes into orders, track activation and payment state at a glance, and hand delivery straight into a project.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...REVENUE_PERSONAS, 'sales_manager'],
    relatedModules: ['quotes', 'contracts', 'projects'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'operations',
  },
  {
    key: 'contracts',
    label: 'Contracts',
    section: 'revenue',
    icon: 'ScrollText',
    route: '/app/contracts',
    order: 40,
    description: 'Terms, renewals, notices and contract documents.',
    marketingDescription: 'Renewal creates a linked successor contract, amendments keep versioned history, and signature state is shown for what it is: simulated.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...REVENUE_PERSONAS, 'success_manager'],
    relatedModules: ['orders', 'customer_success', 'documents'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'operations',
  },
  {
    key: 'subscriptions',
    label: 'Recurring Revenue',
    section: 'revenue',
    icon: 'Repeat',
    route: '/app/subscriptions',
    order: 50,
    description: 'MRR, ARR, movement bridge, retention and cohorts.',
    marketingDescription: 'A revenue bridge that reconciles new, expansion, contraction and churned MRR, with net and gross retention, cohort grids and lifetime-value analysis.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ['business_owner', 'ceo', 'finance_user', 'revops_manager'],
    relatedModules: ['contracts', 'analytics', 'billing'],
    badgeSource: 'none',
    introducedInPlan: 'enterprise',
    category: 'operations',
    children: [
      { key: 'subscriptions.report', label: 'Recurring revenue', route: '/app/subscriptions' },
      { key: 'subscriptions.invoices', label: 'Invoices', route: '/app/subscriptions/invoices' },
      { key: 'subscriptions.commissions', label: 'Commissions', route: '/app/subscriptions/commissions', advancedOnly: true },
    ],
  },

  /* -------------------------------------------------------- productivity */
  {
    key: 'inbox',
    label: 'Inbox',
    section: 'productivity',
    icon: 'Inbox',
    route: '/app/inbox',
    order: 10,
    description: 'Unified email, SMS, WhatsApp and chat conversations.',
    marketingDescription: 'One queue for every channel, with shared inboxes, assignment rules, saved replies, internal notes, SLA timers and a conversation timeline linked to the right records.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...SERVICE_PERSONAS, ...SALES_PERSONAS],
    relatedModules: ['tickets', 'contacts', 'campaigns'],
    badgeSource: 'unread_conversations',
    introducedInPlan: 'professional',
    category: 'service',
    children: [
      { key: 'inbox.email', label: 'Email', route: '/app/inbox' },
      { key: 'inbox.messaging', label: 'Messaging', route: '/app/inbox/messaging' },
      { key: 'inbox.calls', label: 'Calls', route: '/app/inbox/calls' },
      { key: 'inbox.templates', label: 'Templates', route: '/app/inbox/templates', advancedOnly: true },
      { key: 'inbox.inboxes', label: 'Shared inboxes', route: '/app/inbox/inboxes', advancedOnly: true },
    ],
  },
  {
    key: 'documents',
    label: 'Documents',
    section: 'productivity',
    icon: 'FolderOpen',
    route: '/app/documents',
    order: 20,
    description: 'Folders, templates, versions and signature workflows.',
    marketingDescription: 'Folder navigation with record associations, version history, access presentation and a signature workflow preview that is clearly labelled as a preview.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ['business_owner', 'account_manager', 'support_agent', 'revops_manager', 'finance_user'],
    relatedModules: ['contracts', 'quotes', 'projects'],
    badgeSource: 'none',
    introducedInPlan: 'starter',
    category: 'core',
  },
  {
    key: 'projects',
    label: 'Projects',
    section: 'productivity',
    icon: 'FolderKanban',
    route: '/app/projects',
    order: 30,
    description: 'Delivery handoff, tasks, milestones and timelines.',
    marketingDescription: 'When a deal is won a project is created automatically. Delivery teams get kanban and timeline views, milestones, risks and a customer-visible status.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ['business_owner', 'success_manager', 'account_manager'],
    relatedModules: ['orders', 'contracts', 'portal'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'operations',
  },

  /* ------------------------------------------------------------ insights */
  {
    key: 'analytics',
    label: 'Analytics',
    section: 'insights',
    icon: 'BarChart3',
    route: '/app/analytics',
    order: 10,
    description: 'Sales, pipeline, marketing, service and team reporting.',
    marketingDescription: 'Dashboards, a report builder with grouped results, cohort and funnel analysis, forecast accuracy tracking and chart-to-table toggles on every visualisation.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: [...LEADER_PERSONAS, 'sales_manager', 'marketing_manager', 'service_manager', 'success_manager'],
    relatedModules: ['home', 'deals', 'campaigns'],
    badgeSource: 'none',
    introducedInPlan: 'starter',
    category: 'platform',
    children: [
      { key: 'analytics.overview', label: 'Analytics overview', route: '/app/analytics' },
      { key: 'analytics.sales', label: 'Sales reports', route: '/app/analytics/sales' },
      { key: 'analytics.pipeline', label: 'Pipeline reports', route: '/app/analytics/pipeline' },
      { key: 'analytics.forecast', label: 'Forecast', route: '/app/analytics/forecast' },
      { key: 'analytics.marketing', label: 'Marketing reports', route: '/app/analytics/marketing' },
      { key: 'analytics.service', label: 'Service reports', route: '/app/analytics/service' },
      { key: 'analytics.teams', label: 'Team performance', route: '/app/analytics/teams' },
      { key: 'analytics.reports', label: 'Report library', route: '/app/analytics/reports' },
      { key: 'analytics.builder', label: 'Report builder', route: '/app/analytics/reports/builder', advancedOnly: true },
      { key: 'analytics.dashboards', label: 'Dashboard builder', route: '/app/analytics/dashboards', advancedOnly: true },
    ],
  },

  /* ---------------------------------------------------------- automation */
  {
    key: 'workflows',
    label: 'Workflows',
    section: 'automation',
    icon: 'Workflow',
    route: '/app/workflows',
    order: 10,
    description: 'Visual no-code automation with simulation and run history.',
    marketingDescription: 'A visual canvas with conditions, branches, delays and approvals — validated before it can be enabled, simulatable against a sample record, and fully auditable afterwards.',
    advancedOnly: true,
    alwaysIncluded: false,
    defaultForPersonas: ['business_owner', 'revops_manager', 'org_admin', 'it_admin', 'sales_manager', 'service_manager'],
    relatedModules: ['deals', 'tickets', 'customization'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'platform',
    children: [
      { key: 'workflows.list', label: 'All workflows', route: '/app/workflows' },
      { key: 'workflows.templates', label: 'Templates', route: '/app/workflows/templates' },
      { key: 'workflows.runs', label: 'Execution history', route: '/app/workflows/runs' },
    ],
  },
  {
    key: 'ai',
    label: 'AI Assistant',
    section: 'automation',
    icon: 'Sparkles',
    route: '/app/ai',
    order: 20,
    description: 'Summaries, drafting, insights and natural-language reporting.',
    marketingDescription: 'Summaries that cite their records, email drafts you review before anything happens, lead-scoring explanations, forecast commentary and a natural-language report builder.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ALL_PERSONAS,
    relatedModules: ['analytics', 'inbox', 'workflows'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'platform',
    children: [
      { key: 'ai.workspace', label: 'Assistant', route: '/app/ai' },
      { key: 'ai.usage', label: 'Usage & adoption', route: '/app/ai/usage', advancedOnly: true },
      { key: 'ai.settings', label: 'AI settings', route: '/app/ai/settings', advancedOnly: true },
    ],
  },
  {
    key: 'integrations',
    label: 'Integrations',
    section: 'automation',
    icon: 'Blocks',
    route: '/app/integrations',
    order: 30,
    description: 'A marketplace of providers with honest availability labels.',
    marketingDescription: 'Browse by category, connect through a guided wizard, map fields, review sync health and see exactly which providers are demonstrations rather than live connections.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ['business_owner', 'it_admin', 'org_admin', 'revops_manager'],
    relatedModules: ['developer', 'org_admin'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'platform',
  },
  {
    key: 'developer',
    label: 'Developer',
    section: 'automation',
    icon: 'Terminal',
    route: '/app/developer',
    order: 40,
    description: 'API keys, webhooks, delivery logs and the endpoint reference.',
    marketingDescription: 'Scoped API keys, webhook endpoints with an event catalog and delivery history, request logs and a documented endpoint reference describing the future REST API.',
    advancedOnly: true,
    alwaysIncluded: false,
    defaultForPersonas: ['it_admin', 'org_admin', 'revops_manager'],
    relatedModules: ['integrations', 'org_admin'],
    badgeSource: 'none',
    introducedInPlan: 'enterprise',
    category: 'platform',
  },

  /* ----------------------------------------------------------- customize */
  {
    key: 'customization',
    label: 'Customization',
    section: 'customize',
    icon: 'Blocks',
    route: '/app/customization',
    order: 10,
    description: 'Custom objects, fields, layouts, rules and saved views.',
    marketingDescription: 'Add objects and fields without a developer, control conditional visibility, build layouts with drag and drop, and see every change in a live preview.',
    advancedOnly: true,
    alwaysIncluded: false,
    defaultForPersonas: ['org_admin', 'it_admin', 'revops_manager', 'business_owner'],
    relatedModules: ['templates', 'org_admin', 'workflows'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'platform',
    children: [
      { key: 'customization.objects', label: 'Objects & fields', route: '/app/customization/objects' },
      { key: 'customization.layouts', label: 'Page layouts', route: '/app/customization/layouts' },
      { key: 'customization.rules', label: 'Validation rules', route: '/app/customization/rules' },
      { key: 'customization.views', label: 'Saved views', route: '/app/customization/views' },
      { key: 'customization.navigation', label: 'Navigation', route: '/app/customization/navigation' },
      { key: 'customization.formula', label: 'Formula fields', route: '/app/customization/formula' },
    ],
  },
  {
    key: 'templates',
    label: 'Industry Templates',
    section: 'customize',
    icon: 'LayoutTemplate',
    route: '/app/templates',
    order: 20,
    description: 'Pre-built configurations for common industries.',
    marketingDescription: 'Preview what a template actually adds — objects, fields, pipelines, workflows and dashboards — before installing it, and uninstall without losing your own data.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ['business_owner', 'org_admin', 'it_admin', 'revops_manager'],
    relatedModules: ['customization', 'org_admin'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'platform',
  },
  {
    key: 'partners',
    label: 'Partners',
    section: 'sales',
    icon: 'Handshake',
    route: '/app/partners',
    order: 50,
    description: 'Channel partners, deal registration, referrals and commissions.',
    marketingDescription: 'A partner directory with tiers and certifications, conflict-checked deal registration, referral tracking and commission statements.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ['business_owner', 'ceo', 'sales_director', 'revops_manager'],
    relatedModules: ['deals', 'accounts', 'subscriptions'],
    badgeSource: 'none',
    introducedInPlan: 'enterprise',
    category: 'addon',
  },
  {
    key: 'field_sales',
    label: 'Field Sales',
    section: 'sales',
    icon: 'MapPin',
    route: '/app/field-sales',
    order: 60,
    description: 'Territories, visit plans, check-ins and coverage analysis.',
    marketingDescription: 'Territory assignment, day plans with route summaries, check-in and visit logs, plus coverage-gap analysis that shows which accounts have gone quiet.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: ['field_rep', 'sales_manager', 'sales_director', 'business_owner'],
    relatedModules: ['accounts', 'calendar', 'analytics'],
    badgeSource: 'none',
    introducedInPlan: 'enterprise',
    category: 'addon',
  },
  {
    key: 'portal',
    label: 'Customer Portal',
    section: 'service',
    icon: 'Globe',
    route: '/app/portal-preview',
    order: 40,
    description: 'Preview the customer-facing self-service experience.',
    marketingDescription: 'A branded portal where customers raise and track tickets, read knowledge articles, follow project progress, download documents and manage appointments.',
    advancedOnly: false,
    alwaysIncluded: false,
    defaultForPersonas: SERVICE_PERSONAS,
    relatedModules: ['knowledge_base', 'tickets', 'projects'],
    badgeSource: 'none',
    introducedInPlan: 'professional',
    category: 'addon',
  },

  /* --------------------------------------------------------------- admin */
  {
    key: 'org_admin',
    label: 'Settings',
    section: 'admin',
    icon: 'Settings',
    route: '/app/settings',
    order: 10,
    description: 'Organization, people, roles, security and data.',
    marketingDescription: 'Everything an administrator needs in one place: company profile and branding, business units and teams, user directory, a permission matrix, security policy, audit log and data management.',
    advancedOnly: false,
    alwaysIncluded: true,
    requiredPermission: 'settings.view',
    defaultForPersonas: ['org_admin', 'it_admin', 'business_owner'],
    relatedModules: ['billing', 'customization', 'integrations'],
    badgeSource: 'none',
    introducedInPlan: 'free',
    category: 'core',
    children: [
      { key: 'settings.organization', label: 'Organization', route: '/app/settings/organization' },
      { key: 'settings.branding', label: 'Branding', route: '/app/settings/branding' },
      { key: 'settings.structure', label: 'Business units & teams', route: '/app/settings/structure' },
      { key: 'settings.users', label: 'Users', route: '/app/settings/users' },
      { key: 'settings.roles', label: 'Roles & permissions', route: '/app/settings/roles' },
      { key: 'settings.security', label: 'Security', route: '/app/settings/security', advancedOnly: true },
      { key: 'settings.audit', label: 'Audit log', route: '/app/settings/audit', advancedOnly: true },
      { key: 'settings.data', label: 'Data management', route: '/app/settings/data', advancedOnly: true },
      { key: 'settings.consent', label: 'Consent & privacy', route: '/app/settings/consent', advancedOnly: true },
      { key: 'settings.localization', label: 'Localization', route: '/app/settings/localization', advancedOnly: true },
      { key: 'settings.modules', label: 'Modules', route: '/app/settings/modules', advancedOnly: true },
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    section: 'admin',
    icon: 'CreditCard',
    route: '/app/settings/billing',
    order: 20,
    description: 'Plan, seats, modules, usage and invoices.',
    marketingDescription: 'See the current plan and entitlement, change plan or seat count with an honest preview of what is gained and lost, manage add-ons and review usage and invoices.',
    advancedOnly: false,
    alwaysIncluded: false,
    requiredPermission: 'billing.manage',
    defaultForPersonas: ['business_owner', 'ceo', 'finance_user', 'org_admin'],
    relatedModules: ['org_admin', 'subscriptions'],
    badgeSource: 'none',
    introducedInPlan: 'free',
    category: 'core',
    children: [
      { key: 'billing.subscription', label: 'Subscription', route: '/app/settings/billing' },
      { key: 'billing.plans', label: 'Plans', route: '/app/settings/billing/plans' },
      { key: 'billing.usage', label: 'Usage', route: '/app/settings/billing/usage' },
      { key: 'billing.invoices', label: 'Invoices', route: '/app/settings/billing/invoices' },
      { key: 'billing.payment', label: 'Payment method', route: '/app/settings/billing/payment-method', advancedOnly: true },
    ],
  },
];

/* ------------------------------------------------------------------ helpers */

export const moduleByKey = new Map(modules.map((m) => [m.key, m]));

export function getModule(key: ModuleKey): ModuleDefinition | undefined {
  return moduleByKey.get(key);
}

export function modulesForSection(section: NavSectionKey): ModuleDefinition[] {
  return modules.filter((m) => m.section === section).sort((a, b) => a.order - b.order);
}

/**
 * Resolve the navigation a user should see.
 *
 * Entitlement comes from the tenant's subscription, permission from the UI's role
 * presentation, and mode from the user's interface preference. The result is a
 * filtered, ordered tree — the sidebar renders it without further decisions.
 */
export function resolveNavigation(options: {
  enabledModuleKeys: string[];
  grantedPermissions?: string[];
  persona?: PersonaKey;
  interfaceMode: 'simple' | 'advanced';
  includeAdvancedOnly?: boolean;
}): Array<{ section: NavSection; items: ModuleDefinition[] }> {
  const enabled = new Set(options.enabledModuleKeys);
  const granted = new Set(options.grantedPermissions ?? []);
  const advancedAllowed = options.interfaceMode === 'advanced';

  return navSections
    .filter((section) => advancedAllowed || !section.advancedOnly)
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      section,
      items: modulesForSection(section.key).filter((module) => {
        if (!module.alwaysIncluded && !enabled.has(module.key)) return false;
        if (module.advancedOnly && !advancedAllowed) return false;
        if (module.requiredPermission && granted.size > 0 && !granted.has(module.requiredPermission)) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** Persona landing pages, referenced by the shell and by post-login redirects. */
export const personaHomeRoutes: Partial<Record<PersonaKey, string>> = {
  business_owner: '/app/home',
  ceo: '/app/home',
  sales_rep: '/app/activities',
  sales_manager: '/app/deals',
  sales_director: '/app/analytics',
  marketing_specialist: '/app/campaigns',
  marketing_manager: '/app/analytics/marketing',
  support_agent: '/app/inbox',
  service_manager: '/app/tickets',
  account_manager: '/app/accounts',
  success_manager: '/app/customer-success',
  revops_manager: '/app/analytics',
  finance_user: '/app/subscriptions',
  field_rep: '/app/field-sales',
  org_admin: '/app/settings/organization',
  it_admin: '/app/settings/security',
  platform_admin: '/app/home',
};

/** Persona presentation metadata used by the persona switcher and admin UI. */
export const personaCatalog: Array<{ key: PersonaKey; label: string; description: string; density: 'comfortable' | 'compact'; defaultDashboard: string }> = [
  { key: 'business_owner', label: 'Business owner', description: 'Wants revenue, pipeline and customer health at a glance.', density: 'comfortable', defaultDashboard: 'executive' },
  { key: 'ceo', label: 'CEO', description: 'Company-wide performance, forecasts and risk.', density: 'comfortable', defaultDashboard: 'executive' },
  { key: 'sales_rep', label: 'Sales representative', description: 'Lives in tasks, pipeline and conversations.', density: 'compact', defaultDashboard: 'sales_individual' },
  { key: 'sales_manager', label: 'Sales manager', description: 'Coaches the team and owns the forecast.', density: 'compact', defaultDashboard: 'sales' },
  { key: 'sales_director', label: 'Sales director', description: 'Multi-team performance and territory strategy.', density: 'comfortable', defaultDashboard: 'sales' },
  { key: 'marketing_specialist', label: 'Marketing specialist', description: 'Builds campaigns, audiences and journeys.', density: 'comfortable', defaultDashboard: 'marketing' },
  { key: 'marketing_manager', label: 'Marketing manager', description: 'Owns attribution, ROI and pipeline contribution.', density: 'comfortable', defaultDashboard: 'marketing' },
  { key: 'support_agent', label: 'Customer support agent', description: 'Works the queue and resolves tickets quickly.', density: 'compact', defaultDashboard: 'service' },
  { key: 'service_manager', label: 'Customer service manager', description: 'Balances SLA compliance, backlog and satisfaction.', density: 'comfortable', defaultDashboard: 'service' },
  { key: 'account_manager', label: 'Account manager', description: 'Grows named accounts across deals and delivery.', density: 'compact', defaultDashboard: 'sales' },
  { key: 'success_manager', label: 'Customer success manager', description: 'Owns health, adoption and renewals.', density: 'comfortable', defaultDashboard: 'success' },
  { key: 'revops_manager', label: 'Revenue operations manager', description: 'Keeps process, data and automation consistent.', density: 'compact', defaultDashboard: 'revenue_ops' },
  { key: 'finance_user', label: 'Finance user', description: 'Tracks bookings, billing state and recurring revenue.', density: 'compact', defaultDashboard: 'revenue_ops' },
  { key: 'field_rep', label: 'Field sales representative', description: 'Plans visits and works from a phone or tablet.', density: 'comfortable', defaultDashboard: 'sales_individual' },
  { key: 'org_admin', label: 'Organization administrator', description: 'Configures people, access, data and branding.', density: 'compact', defaultDashboard: 'executive' },
  { key: 'it_admin', label: 'Enterprise IT administrator', description: 'Owns security, integrations and compliance surfaces.', density: 'compact', defaultDashboard: 'executive' },
  { key: 'platform_admin', label: 'Platform administrator', description: 'Runs the SaaS platform itself, not a tenant.', density: 'compact', defaultDashboard: 'executive' },
];
