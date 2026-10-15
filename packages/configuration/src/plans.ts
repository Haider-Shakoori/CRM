/**
 * Plans, add-ons, limits and pricing presentation.
 *
 * COMMERCIAL STATUS: no pricing strategy has been finalised. Every number here is an
 * illustrative placeholder used to exercise the pricing UI, the seat calculator, the
 * upgrade prompts and the platform-owner plan editor. The type system keeps that
 * honest by labelling the commercial state on the object itself, and the UI renders
 * a "illustrative pricing" notice wherever these values appear.
 *
 * Amounts are stored in minor-friendly plain decimals plus an explicit currency code.
 * Nothing here configures a payment provider.
 */

import type { CurrencyCode } from '@crm/shared-types';

export type PlanId = 'free' | 'starter' | 'professional' | 'enterprise' | 'custom_enterprise';
export type BillingInterval = 'month' | 'year';

export interface PlanPrice {
  interval: BillingInterval;
  currency: CurrencyCode;
  /** Flat platform fee per interval. */
  basePlatformFee: number;
  /** Per-seat charge per interval; 0 when the plan does not charge per seat. */
  perUserPrice: number;
  minimumSeats: number;
  includedSeats: number;
  maximumSeats: number | null;
  /** Applied when paying annually, expressed as a percentage off the monthly total. */
  annualDiscountPercent: number;
}

export interface PlanLimit {
  key: string;
  label: string;
  unit: string;
  /** null means unlimited. */
  included: number | null;
  /** Displayed as the honest behaviour when the limit is reached. */
  overageBehaviour: 'block' | 'bill' | 'throttle' | 'notify' | 'unlimited';
  note?: string;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Provisional positioning copy. Not a marketing commitment. */
  tagline: string;
  description: string;
  audience: string;
  /** Marks the plan promoted in the pricing UI. */
  recommended: boolean;
  badge?: string;
  order: number;
  prices: PlanPrice[];
  moduleKeys: string[];
  limits: PlanLimit[];
  highlights: string[];
  /** Features deliberately excluded, shown in the comparison matrix as "—". */
  exclusions: string[];
  supportTier: string;
  onboardingTier: string;
  trial: { enabled: boolean; days: number; requiresCard: boolean } | null;
  ctaLabel: string;
  ctaRoute: string;
  commercialState: 'illustrative_not_final';
  /** Entitlement flags that drive feature gating in the UI. */
  entitlements: Record<string, boolean>;
}

export interface AddOnDefinition {
  id: string;
  name: string;
  description: string;
  moduleKeys: string[];
  pricingModel: 'flat_monthly' | 'per_user_monthly' | 'per_unit' | 'one_time' | 'custom_contract';
  price: number;
  currency: CurrencyCode;
  unitLabel?: string;
  includedQuantity?: number;
  compatiblePlans: PlanId[];
  requiresSalesContact: boolean;
  highlight: string;
}

export const defaultCurrency: CurrencyCode = 'USD';

export const plans: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For individuals getting organised',
    description:
      'Core contact, account and pipeline management for a single user who needs a real CRM without a budget cycle.',
    audience: 'Individual professionals, freelancers, first-time CRM users',
    recommended: false,
    order: 10,
    prices: [
      { interval: 'month', currency: 'USD', basePlatformFee: 0, perUserPrice: 0, minimumSeats: 1, includedSeats: 1, maximumSeats: 1, annualDiscountPercent: 0 },
      { interval: 'year', currency: 'USD', basePlatformFee: 0, perUserPrice: 0, minimumSeats: 1, includedSeats: 1, maximumSeats: 1, annualDiscountPercent: 0 },
    ],
    moduleKeys: ['home', 'activities', 'calendar', 'contacts', 'accounts', 'deals'],
    limits: [
      { key: 'records', label: 'Records (contacts + accounts + deals)', unit: 'records', included: 1500, overageBehaviour: 'block', note: 'Contact us to extend the limit before you hit it.' },
      { key: 'storage', label: 'Document storage', unit: 'GB', included: 1, overageBehaviour: 'notify' },
      { key: 'workflow_runs', label: 'Automation runs', unit: 'runs/month', included: 0, overageBehaviour: 'block' },
      { key: 'email_sends', label: 'Marketing emails (simulated)', unit: 'sends/month', included: 0, overageBehaviour: 'block' },
      { key: 'api_calls', label: 'API calls', unit: 'calls/day', included: 1000, overageBehaviour: 'throttle' },
      { key: 'ai_credits', label: 'AI credits', unit: 'credits/month', included: 0, overageBehaviour: 'block' },
    ],
    highlights: [
      'Contact, account and deal management',
      'One configurable pipeline',
      'Tasks, notes and a personal calendar',
      'Mobile-friendly responsive interface',
      'Community documentation and help centre',
    ],
    exclusions: ['Automation', 'Campaigns', 'Support desk', 'Analytics beyond the basic dashboard', 'Custom objects', 'API webhooks'],
    supportTier: 'Community help centre',
    onboardingTier: 'Guided in-product checklist',
    trial: null,
    ctaLabel: 'Start for free',
    ctaRoute: '/signup?plan=free',
    commercialState: 'illustrative_not_final',
    entitlements: { workflows: false, campaigns: false, support: false, customObjects: false, api: false, ai: false, sso: false, multiCurrency: true, forecasting: false, sandbox: false },
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For small teams replacing spreadsheets',
    description:
      'A shared workspace with lead management, a light support desk, reporting and enough automation to stop the manual follow-ups.',
    audience: 'Small businesses and startups of 2–10 people',
    recommended: false,
    order: 20,
    prices: [
      { interval: 'month', currency: 'USD', basePlatformFee: 0, perUserPrice: 29, minimumSeats: 2, includedSeats: 2, maximumSeats: 50, annualDiscountPercent: 17 },
      { interval: 'year', currency: 'USD', basePlatformFee: 0, perUserPrice: 24, minimumSeats: 2, includedSeats: 2, maximumSeats: 50, annualDiscountPercent: 0 },
    ],
    moduleKeys: ['home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'products', 'documents', 'analytics', 'knowledge_base'],
    limits: [
      { key: 'records', label: 'Records', unit: 'records', included: 100000, overageBehaviour: 'notify' },
      { key: 'storage', label: 'Document storage', unit: 'GB', included: 25, overageBehaviour: 'notify' },
      { key: 'workflow_runs', label: 'Automation runs', unit: 'runs/month', included: 2500, overageBehaviour: 'notify' },
      { key: 'email_sends', label: 'Marketing emails (simulated)', unit: 'sends/month', included: 5000, overageBehaviour: 'notify' },
      { key: 'api_calls', label: 'API calls', unit: 'calls/day', included: 25000, overageBehaviour: 'throttle' },
      { key: 'ai_credits', label: 'AI credits', unit: 'credits/month', included: 200, overageBehaviour: 'bill' },
      { key: 'dashboards', label: 'Custom dashboards', unit: 'dashboards', included: 5, overageBehaviour: 'block' },
    ],
    highlights: [
      'Everything in Free, plus:',
      'Lead capture, scoring and conversion',
      'Shared pipelines and team assignment',
      'Basic support desk with queues',
      'Product catalog and documents',
      'Standard sales and pipeline reports',
      'Email support with a one-business-day target',
    ],
    exclusions: ['Multi-step journeys', 'Custom objects', 'Webhooks', 'SSO', 'Sandbox', 'Partner management'],
    supportTier: 'Email support',
    onboardingTier: 'Self-serve with template library',
    trial: { enabled: true, days: 14, requiresCard: false },
    ctaLabel: 'Start free trial',
    ctaRoute: '/signup?plan=starter',
    commercialState: 'illustrative_not_final',
    entitlements: { workflows: true, campaigns: false, support: true, customObjects: false, api: false, ai: true, sso: false, multiCurrency: true, forecasting: true, sandbox: false },
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For growing teams running a real process',
    description:
      'The full operating system for revenue: marketing automation, service SLAs, quotes and contracts, journeys, workflows and customisation.',
    audience: 'Medium businesses of 11–200 people',
    recommended: true,
    badge: 'Most popular starting point',
    order: 30,
    prices: [
      { interval: 'month', currency: 'USD', basePlatformFee: 99, perUserPrice: 65, minimumSeats: 5, includedSeats: 5, maximumSeats: 500, annualDiscountPercent: 17 },
      { interval: 'year', currency: 'USD', basePlatformFee: 990, perUserPrice: 54, minimumSeats: 5, includedSeats: 5, maximumSeats: 500, annualDiscountPercent: 0 },
    ],
    moduleKeys: [
      'home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'campaigns', 'tickets',
      'knowledge_base', 'products', 'quotes', 'orders', 'contracts', 'inbox', 'documents', 'projects',
      'analytics', 'workflows', 'ai', 'integrations', 'customization', 'templates', 'portal', 'org_admin', 'billing',
    ],
    limits: [
      { key: 'records', label: 'Records', unit: 'records', included: 1000000, overageBehaviour: 'notify' },
      { key: 'storage', label: 'Document storage', unit: 'GB', included: 250, overageBehaviour: 'bill' },
      { key: 'workflow_runs', label: 'Automation runs', unit: 'runs/month', included: 50000, overageBehaviour: 'bill' },
      { key: 'email_sends', label: 'Marketing emails (simulated)', unit: 'sends/month', included: 100000, overageBehaviour: 'bill' },
      { key: 'api_calls', label: 'API calls', unit: 'calls/day', included: 250000, overageBehaviour: 'throttle' },
      { key: 'ai_credits', label: 'AI credits', unit: 'credits/month', included: 5000, overageBehaviour: 'bill' },
      { key: 'dashboards', label: 'Custom dashboards', unit: 'dashboards', included: null, overageBehaviour: 'unlimited' },
      { key: 'custom_objects', label: 'Custom objects', unit: 'objects', included: 25, overageBehaviour: 'block' },
      { key: 'custom_fields', label: 'Custom fields per object', unit: 'fields', included: 150, overageBehaviour: 'block' },
    ],
    highlights: [
      'Everything in Starter, plus:',
      'Marketing automation with journeys and A/B tests',
      'Service desk with SLA policies and escalation',
      'Quotes, orders, contracts and approvals',
      'Visual workflow builder with simulation',
      'Custom objects, fields and page layouts',
      'Unified inbox across email, SMS, WhatsApp and chat',
      'Industry template library',
      'AI assistant and usage controls',
    ],
    exclusions: ['SSO / SAML', 'Dedicated sandbox', 'Custom data residency', 'Partner relationship management', 'Contractual uptime commitment'],
    supportTier: 'Priority email and chat',
    onboardingTier: 'Guided onboarding session',
    trial: { enabled: true, days: 14, requiresCard: false },
    ctaLabel: 'Start free trial',
    ctaRoute: '/signup?plan=professional',
    commercialState: 'illustrative_not_final',
    entitlements: { workflows: true, campaigns: true, support: true, customObjects: true, api: true, ai: true, sso: false, multiCurrency: true, forecasting: true, sandbox: false },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For organisations with governance requirements',
    description:
      'Adds identity federation, advanced security controls, sandbox environments, partner management and enterprise onboarding.',
    audience: 'Large organisations of 200+ people',
    recommended: false,
    order: 40,
    prices: [
      { interval: 'month', currency: 'USD', basePlatformFee: 1200, perUserPrice: 110, minimumSeats: 25, includedSeats: 25, maximumSeats: null, annualDiscountPercent: 17 },
      { interval: 'year', currency: 'USD', basePlatformFee: 12000, perUserPrice: 91, minimumSeats: 25, includedSeats: 25, maximumSeats: null, annualDiscountPercent: 0 },
    ],
    moduleKeys: [
      'home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'campaigns', 'tickets',
      'knowledge_base', 'customer_success', 'products', 'quotes', 'orders', 'contracts', 'subscriptions',
      'inbox', 'documents', 'projects', 'field_sales', 'partners', 'analytics', 'workflows', 'ai',
      'integrations', 'customization', 'templates', 'developer', 'portal', 'org_admin', 'billing',
    ],
    limits: [
      { key: 'records', label: 'Records', unit: 'records', included: null, overageBehaviour: 'unlimited' },
      { key: 'storage', label: 'Document storage', unit: 'GB', included: 2000, overageBehaviour: 'bill' },
      { key: 'workflow_runs', label: 'Automation runs', unit: 'runs/month', included: 500000, overageBehaviour: 'bill' },
      { key: 'email_sends', label: 'Marketing emails (simulated)', unit: 'sends/month', included: 1000000, overageBehaviour: 'bill' },
      { key: 'api_calls', label: 'API calls', unit: 'calls/day', included: null, overageBehaviour: 'unlimited' },
      { key: 'ai_credits', label: 'AI credits', unit: 'credits/month', included: 50000, overageBehaviour: 'bill' },
      { key: 'dashboards', label: 'Custom dashboards', unit: 'dashboards', included: null, overageBehaviour: 'unlimited' },
      { key: 'custom_objects', label: 'Custom objects', unit: 'objects', included: 200, overageBehaviour: 'block' },
      { key: 'custom_fields', label: 'Custom fields per object', unit: 'fields', included: 500, overageBehaviour: 'block' },
      { key: 'sandboxes', label: 'Sandbox environments', unit: 'environments', included: 2, overageBehaviour: 'block' },
    ],
    highlights: [
      'Everything in Professional, plus:',
      'Single sign-on (SAML / OIDC) configuration surfaces',
      'Advanced session, IP and password policy controls',
      'Custom objects and fields at scale',
      'Customer success, renewals and churn management',
      'Partner relationship management and deal registration',
      'Field sales territories and visit planning',
      'Developer platform with scoped API keys and webhooks',
      'Dedicated onboarding and a named technical contact',
    ],
    exclusions: ['Negotiated volume pricing', 'Custom contractual terms', 'Bespoke data residency guarantees', 'Custom development work'],
    supportTier: 'Priority support with escalation path',
    onboardingTier: 'Dedicated onboarding and quarterly reviews',
    trial: { enabled: true, days: 30, requiresCard: false },
    ctaLabel: 'Start enterprise trial',
    ctaRoute: '/signup?plan=enterprise',
    commercialState: 'illustrative_not_final',
    entitlements: { workflows: true, campaigns: true, support: true, customObjects: true, api: true, ai: true, sso: true, multiCurrency: true, forecasting: true, sandbox: true },
  },
  {
    id: 'custom_enterprise',
    name: 'Custom Enterprise',
    tagline: 'Negotiated terms for the largest deployments',
    description:
      'Volume pricing, contractual commitments, custom data regions, private connectivity discussions and bespoke onboarding programmes.',
    audience: 'International enterprises and regulated organisations',
    recommended: false,
    order: 50,
    prices: [],
    moduleKeys: ['*'],
    limits: [
      { key: 'everything', label: 'All limits', unit: 'negotiated', included: null, overageBehaviour: 'unlimited', note: 'Commercial limits are defined in the order form, not in the product UI.' },
    ],
    highlights: [
      'Everything in Enterprise, plus:',
      'Negotiated per-seat and platform pricing',
      'Contractual data residency discussions',
      'Custom environment and release considerations',
      'Solution architecture review',
      'Bespoke onboarding and migration programme',
      'Named account team and quarterly business reviews',
    ],
    exclusions: [],
    supportTier: 'Contractual support terms',
    onboardingTier: 'Bespoke programme',
    trial: null,
    ctaLabel: 'Talk to sales',
    ctaRoute: '/contact-sales?plan=custom_enterprise',
    commercialState: 'illustrative_not_final',
    entitlements: { workflows: true, campaigns: true, support: true, customObjects: true, api: true, ai: true, sso: true, multiCurrency: true, forecasting: true, sandbox: true },
  },
];

export const addOns: AddOnDefinition[] = [
  {
    id: 'addon-ai-credits',
    name: 'AI credit pack',
    description: 'Additional monthly AI credits for high-volume summary, drafting and reporting use.',
    moduleKeys: ['ai'],
    pricingModel: 'per_unit',
    price: 149,
    currency: 'USD',
    unitLabel: '10,000 credits / month',
    includedQuantity: 10000,
    compatiblePlans: ['starter', 'professional', 'enterprise'],
    requiresSalesContact: false,
    highlight: 'For teams that use the assistant daily',
  },
  {
    id: 'addon-field-sales',
    name: 'Field sales & territories',
    description: 'Territory assignment, visit planning, check-in flows and coverage analysis.',
    moduleKeys: ['field_sales'],
    pricingModel: 'per_user_monthly',
    price: 18,
    currency: 'USD',
    unitLabel: 'per field user / month',
    compatiblePlans: ['professional', 'enterprise'],
    requiresSalesContact: false,
    highlight: 'For teams that sell in person',
  },
  {
    id: 'addon-partners',
    name: 'Partner relationship management',
    description: 'Partner directory, deal registration with conflict checks, referrals and commission statements.',
    moduleKeys: ['partners'],
    pricingModel: 'flat_monthly',
    price: 249,
    currency: 'USD',
    compatiblePlans: ['professional', 'enterprise'],
    requiresSalesContact: false,
    highlight: 'For channel-led revenue',
  },
  {
    id: 'addon-portal',
    name: 'Customer self-service portal',
    description: 'A branded portal for tickets, knowledge articles, project status, documents and appointments.',
    moduleKeys: ['portal'],
    pricingModel: 'flat_monthly',
    price: 79,
    currency: 'USD',
    compatiblePlans: ['starter', 'professional', 'enterprise'],
    requiresSalesContact: false,
    highlight: 'Deflect repeat questions and show delivery progress',
  },
  {
    id: 'addon-premium-support',
    name: 'Premium support',
    description: 'Faster response targets, a named technical contact and scheduled technical reviews.',
    moduleKeys: [],
    pricingModel: 'per_user_monthly',
    price: 12,
    currency: 'USD',
    unitLabel: 'per user / month',
    compatiblePlans: ['professional', 'enterprise'],
    requiresSalesContact: true,
    highlight: 'Terms are confirmed in the order form',
  },
  {
    id: 'addon-sandbox',
    name: 'Additional sandbox',
    description: 'An extra isolated environment for configuration testing and training.',
    moduleKeys: [],
    pricingModel: 'flat_monthly',
    price: 199,
    currency: 'USD',
    compatiblePlans: ['enterprise'],
    requiresSalesContact: false,
    highlight: 'Test layouts and workflows safely',
  },
  {
    id: 'addon-data-residency',
    name: 'Data residency selection',
    description: 'Choose a hosting region for your organization. Availability and terms depend on the contract.',
    moduleKeys: [],
    pricingModel: 'custom_contract',
    price: 0,
    currency: 'USD',
    compatiblePlans: ['enterprise', 'custom_enterprise'],
    requiresSalesContact: true,
    highlight: 'Discuss regional requirements with sales',
  },
];

/** Feature comparison matrix rows for the pricing page. */
export interface PlanComparisonRow {
  category: string;
  feature: string;
  description?: string;
  /** Per-plan availability. `true` means included, a string is a value, null is not available. */
  values: Record<PlanId, boolean | string | null>;
  /** Rows shown when the visitor collapses "show all features". */
  highlighted: boolean;
}

export const planComparison: PlanComparisonRow[] = [
  { category: 'Core CRM', feature: 'Contacts, accounts and deals', values: { free: true, starter: true, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Core CRM', feature: 'Configurable pipelines', values: { free: '1', starter: '3', professional: '10', enterprise: 'Unlimited', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Core CRM', feature: 'Tasks, notes and calendar', values: { free: true, starter: true, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Core CRM', feature: 'Lead management and scoring', values: { free: false, starter: true, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Core CRM', feature: 'Duplicate detection and merge review', values: { free: false, starter: 'Basic', professional: 'Advanced', enterprise: 'Advanced', custom_enterprise: 'Advanced' }, highlighted: false },
  { category: 'Core CRM', feature: 'Multi-currency records', values: { free: true, starter: true, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Sales', feature: 'Sales forecasting', values: { free: false, starter: 'Basic', professional: 'Full', enterprise: 'Full with rollups', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Sales', feature: 'Sales sequences and playbooks', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Sales', feature: 'Products and price books', values: { free: false, starter: '1 price book', professional: 'Multiple', enterprise: 'Multiple with regions', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Sales', feature: 'Quotes with approval workflow', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Sales', feature: 'Contracts and renewal tracking', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Marketing', feature: 'Email campaigns', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Marketing', feature: 'Audience segments', values: { free: false, starter: 'Static lists', professional: 'Dynamic segments', enterprise: 'Dynamic + lookalike', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Marketing', feature: 'Multi-step journeys', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Marketing', feature: 'Landing pages and capture forms', values: { free: false, starter: 'Forms', professional: 'Forms + pages', enterprise: 'Forms + pages', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Marketing', feature: 'Attribution modelling', values: { free: false, starter: false, professional: 'Three models', enterprise: 'All models', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Service', feature: 'Support desk and queues', values: { free: false, starter: 'Single queue', professional: 'Multiple queues', enterprise: 'Multiple queues', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Service', feature: 'SLA policies and escalation', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Service', feature: 'Knowledge base with review workflow', values: { free: false, starter: 'Internal only', professional: 'Internal + public', enterprise: 'Internal + public', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Service', feature: 'CSAT and NPS surveys', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Service', feature: 'Customer self-service portal', values: { free: false, starter: 'Add-on', professional: 'Add-on', enterprise: 'Add-on', custom_enterprise: 'Included' }, highlighted: false },
  { category: 'Success', feature: 'Customer health scoring', values: { free: false, starter: false, professional: false, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Success', feature: 'Onboarding plans', values: { free: false, starter: false, professional: false, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Success', feature: 'Renewal pipeline and churn risk', values: { free: false, starter: false, professional: false, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Revenue', feature: 'Recurring revenue reporting', values: { free: false, starter: false, professional: false, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Revenue', feature: 'Commission statements', values: { free: false, starter: false, professional: false, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Productivity', feature: 'Unified inbox', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Productivity', feature: 'Projects and delivery handoff', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Productivity', feature: 'Documents with version history', values: { free: false, starter: true, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Insights', feature: 'Dashboards', values: { free: '1', starter: '5 custom', professional: 'Unlimited', enterprise: 'Unlimited', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Insights', feature: 'Report builder', values: { free: false, starter: 'Standard reports', professional: 'Custom builder', enterprise: 'Custom builder', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Insights', feature: 'Scheduled report delivery', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Insights', feature: 'Cohort and retention analysis', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Automation', feature: 'Visual workflow builder', values: { free: false, starter: 'Simple rules', professional: 'Full builder', enterprise: 'Full builder', custom_enterprise: 'Full builder' }, highlighted: true },
  { category: 'Automation', feature: 'Workflow simulation and execution history', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Automation', feature: 'AI assistant', values: { free: false, starter: 'Limited credits', professional: 'Included credits', enterprise: 'High-volume credits', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Automation', feature: 'Natural-language report builder', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Customisation', feature: 'Custom fields', values: { free: 'Standard only', starter: 'Standard only', professional: '150 per object', enterprise: '500 per object', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Customisation', feature: 'Custom objects', values: { free: false, starter: false, professional: '25', enterprise: '200', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Customisation', feature: 'Drag-and-drop page layouts', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Customisation', feature: 'Validation rules', values: { free: false, starter: 'Basic', professional: 'Advanced', enterprise: 'Advanced', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Customisation', feature: 'Industry template library', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Administration', feature: 'User directory and seat management', values: { free: '1 user', starter: 'Up to 50', professional: 'Up to 500', enterprise: 'Unlimited', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Administration', feature: 'Roles and permission matrix', values: { free: 'Fixed', starter: '3 custom roles', professional: 'Unlimited roles', enterprise: 'Unlimited + field level', custom_enterprise: 'Custom' }, highlighted: true },
  { category: 'Administration', feature: 'Audit log', values: { free: false, starter: '30 days', professional: '1 year', enterprise: 'Configurable', custom_enterprise: 'Contractual' }, highlighted: false },
  { category: 'Administration', feature: 'Data import and export wizards', values: { free: 'Basic', starter: 'Field mapping', professional: 'Field mapping + scheduling', enterprise: 'Field mapping + scheduling', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Administration', feature: 'Multi-language interface', values: { free: 'English', starter: 'English', professional: 'All available', enterprise: 'All available + RTL', custom_enterprise: 'Custom translations' }, highlighted: false },
  { category: 'Security', feature: 'Multi-factor authentication', values: { free: true, starter: true, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Security', feature: 'Single sign-on (SAML / OIDC)', values: { free: false, starter: false, professional: false, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Security', feature: 'IP allowlist and country restrictions', values: { free: false, starter: false, professional: false, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Security', feature: 'Sandbox environments', values: { free: false, starter: false, professional: false, enterprise: '2 included', custom_enterprise: 'Custom' }, highlighted: false },
  { category: 'Integrations', feature: 'Integration marketplace', values: { free: false, starter: 'Limited', professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Integrations', feature: 'REST API access', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: true },
  { category: 'Integrations', feature: 'Webhooks', values: { free: false, starter: false, professional: true, enterprise: true, custom_enterprise: true }, highlighted: false },
  { category: 'Integrations', feature: 'Partner relationship management', values: { free: false, starter: false, professional: 'Add-on', enterprise: 'Add-on', custom_enterprise: 'Included' }, highlighted: false },
  { category: 'Integrations', feature: 'Field sales and territories', values: { free: false, starter: false, professional: 'Add-on', enterprise: 'Add-on', custom_enterprise: 'Included' }, highlighted: false },
  { category: 'Support', feature: 'Support channel', values: { free: 'Help centre', starter: 'Email', professional: 'Priority email and chat', enterprise: 'Priority + escalation path', custom_enterprise: 'Contractual' }, highlighted: true },
  { category: 'Support', feature: 'Onboarding', values: { free: 'Self-serve', starter: 'Self-serve + templates', professional: 'Guided session', enterprise: 'Dedicated onboarding', custom_enterprise: 'Bespoke programme' }, highlighted: true },
];

/** Pricing FAQ content, kept in configuration so it can be localized. */
export const pricingFaq: Array<{ id: string; question: string; answer: string }> = [
  {
    id: 'faq-pricing-status',
    question: 'Are these the final prices?',
    answer:
      'No. Every price, limit and plan name on this site is an illustrative placeholder used to design and test the pricing interface. No commercial offering has been finalised, and nothing here should be treated as an offer.',
  },
  {
    id: 'faq-billing',
    question: 'How does per-user billing work?',
    answer:
      'Seats are priced per user per month or per year. Each plan has a minimum seat count and an included seat allowance. The seat calculator above shows how the total changes as you add or remove people, including the effect of annual billing.',
  },
  {
    id: 'faq-modules',
    question: 'Do I pay extra for modules like marketing or support?',
    answer:
      'Some capabilities are included in a plan tier and some are available as add-ons. The comparison table marks each capability as included, add-on, or unavailable so you can see the difference before choosing.',
  },
  {
    id: 'faq-trial',
    question: 'What happens at the end of a trial?',
    answer:
      'You choose a plan, or your workspace becomes read-only until you do. Nothing is deleted automatically during the grace period shown in the trial banner. This behaviour is described here for design purposes; no billing system is connected yet.',
  },
  {
    id: 'faq-usage',
    question: 'What counts as an automation run or an AI credit?',
    answer:
      'One automation run is one full execution of a workflow against one record. One AI credit is one assistant request, and each response shows the credits it used. The usage dashboard reconciles both against your plan allowance.',
  },
  {
    id: 'faq-payment',
    question: 'Can I pay by invoice?',
    answer:
      'Annual contracts on Enterprise plans are typically invoiced. Payment methods, currencies and invoicing arrangements are agreed during the sales process; no payment provider is integrated in this build.',
  },
  {
    id: 'faq-change',
    question: 'Can I change plan later?',
    answer:
      'Yes. Changing plan shows a preview of what you gain and what you lose, plus the effective date and proration note, before you confirm. Upgrades apply immediately and downgrades apply at the end of the period.',
  },
  {
    id: 'faq-currency',
    question: 'Which currencies do you support?',
    answer:
      'Prices are displayed in United States dollars by default, and the currency selector on this page restates them using illustrative conversion rates. Regional pricing is configured per plan; settlement currency is agreed commercially.',
  },
  {
    id: 'faq-nonprofit',
    question: 'Is there a discount for non-profits or education?',
    answer:
      'Discount programmes are not finalised. The pricing page includes a placeholder for promotional codes and a sales contact route so the flow exists before the policy does.',
  },
  {
    id: 'faq-data',
    question: 'Where is my data stored?',
    answer:
      'Data residency options are presented as a product concept. Specific regions, guarantees and contractual commitments would be confirmed during the sales process and in the order form, not by the interface.',
  },
];

/** Display currencies for the public pricing selector. Values are illustrative. */
export const displayCurrencies: Array<{ code: string; label: string; symbol: string; /** Illustrative only. */ illustrativeRateFromUsd: number; decimalDigits: number }> = [
  { code: 'USD', label: 'US Dollar', symbol: '$', illustrativeRateFromUsd: 1, decimalDigits: 2 },
  { code: 'EUR', label: 'Euro', symbol: '€', illustrativeRateFromUsd: 0.92, decimalDigits: 2 },
  { code: 'GBP', label: 'British Pound', symbol: '£', illustrativeRateFromUsd: 0.79, decimalDigits: 2 },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ', illustrativeRateFromUsd: 3.67, decimalDigits: 2 },
  { code: 'SAR', label: 'Saudi Riyal', symbol: 'ر.س', illustrativeRateFromUsd: 3.75, decimalDigits: 2 },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', illustrativeRateFromUsd: 83.2, decimalDigits: 0 },
  { code: 'TRY', label: 'Turkish Lira', symbol: '₺', illustrativeRateFromUsd: 32.4, decimalDigits: 0 },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$', illustrativeRateFromUsd: 5.42, decimalDigits: 2 },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$', illustrativeRateFromUsd: 1.52, decimalDigits: 2 },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$', illustrativeRateFromUsd: 1.36, decimalDigits: 2 },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$', illustrativeRateFromUsd: 1.34, decimalDigits: 2 },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R', illustrativeRateFromUsd: 18.6, decimalDigits: 0 },
  { code: 'NGN', label: 'Nigerian Naira', symbol: '₦', illustrativeRateFromUsd: 1450, decimalDigits: 0 },
  { code: 'PKR', label: 'Pakistani Rupee', symbol: '₨', illustrativeRateFromUsd: 278, decimalDigits: 0 },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥', illustrativeRateFromUsd: 152, decimalDigits: 0 },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥', illustrativeRateFromUsd: 7.24, decimalDigits: 2 },
];

export function getPlan(id: PlanId): PlanDefinition | undefined {
  return plans.find((p) => p.id === id);
}

export function planPrice(planId: PlanId, interval: BillingInterval, currency: CurrencyCode = defaultCurrency): PlanPrice | undefined {
  return getPlan(planId)?.prices.find((p) => p.interval === interval && p.currency === currency);
}

/** Seat-inclusive cost for a plan, before tax and discounts. Illustrative maths only. */
export function calculatePlanCost(
  planId: PlanId,
  seats: number,
  interval: BillingInterval,
): { monthly: number; billingTotal: number; interval: BillingInterval; seatsBilled: number; savingsVsMonthly: number; currency: CurrencyCode } | null {
  const price = planPrice(planId, interval);
  if (!price) return null;
  const seatsBilled = Math.max(seats, price.minimumSeats);
  const intervalMultiplier = interval === 'year' ? 12 : 1;
  const monthly = price.basePlatformFee + price.perUserPrice * seatsBilled;
  const billingTotal = monthly * intervalMultiplier;
  const monthlyPrice = planPrice(planId, 'month');
  const monthlyComparable = monthlyPrice ? (monthlyPrice.basePlatformFee + monthlyPrice.perUserPrice * seatsBilled) * 12 : billingTotal;
  return {
    monthly,
    billingTotal,
    interval,
    seatsBilled,
    savingsVsMonthly: Math.max(0, monthlyComparable - billingTotal),
    currency: price.currency,
  };
}
