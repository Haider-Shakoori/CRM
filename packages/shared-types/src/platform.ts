/**
 * Integration marketplace, developer platform, AI assistant and the
 * platform-owner (SaaS super-admin) domain.
 *
 * Two hard rules are encoded in the types themselves:
 *   1. Integrations can never report a real connection — every provider is
 *      `demo` or `planned`, and credentials are never modelled on the client.
 *   2. The AI assistant is deterministic. Its messages carry an explicit origin
 *      so the UI can label them as generated demonstration content.
 */

import type { Auditable, CurrencyCode, Id, ISODateString, ISODateTimeString, Money, Tone } from './common';

/* ------------------------------------------------------- integration catalog */

export type IntegrationCategory =
  | 'email'
  | 'calendar'
  | 'messaging'
  | 'telephony'
  | 'payments'
  | 'ecommerce'
  | 'accounting'
  | 'erp'
  | 'marketing'
  | 'analytics'
  | 'productivity'
  | 'document_management'
  | 'identity'
  | 'communication'
  | 'developer_tools'
  | 'data_warehouse';

export type IntegrationAvailability = 'demo' | 'planned' | 'coming_soon' | 'unavailable';

export interface Integration {
  id: Id;
  slug: string;
  name: string;
  vendorLabel: string;
  category: IntegrationCategory;
  tagline: string;
  description: string;
  /** Honest availability label. `demo` means the UI exists but nothing connects. */
  availability: IntegrationAvailability;
  availabilityNote: string;
  /** Generated mark, never a vendor logo asset. */
  mark: { initials: string; tone: Tone; generated: true };
  capabilities: Array<{ key: string; label: string; direction: 'inbound' | 'outbound' | 'bidirectional' | 'none'; note?: string }>;
  objects: Array<'contacts' | 'accounts' | 'leads' | 'deals' | 'activities' | 'tasks' | 'tickets' | 'products' | 'quotes' | 'invoices' | 'campaigns' | 'documents' | 'calendar_events' | 'messages' | 'payments' | 'orders'>;
  authModel: 'oauth2' | 'api_key' | 'webhook_only' | 'none';
  /** OAuth is described, never implemented. */
  oauthState: 'not_implemented' | 'not_applicable';
  setupSteps: Array<{ id: Id; title: string; description: string; kind: 'connect' | 'authorize_placeholder' | 'map_fields' | 'choose_sync' | 'test' | 'done' }>;
  requiredScopes?: Array<{ scope: string; label: string; sensitive: boolean }>;
  documentationUrlPlaceholder?: string;
  pricingNote?: string;
  isFeatured: boolean;
  installsCount: number;
  rating: { average: number; count: number; /** Sample data, labelled in the UI. */ sampleData: true };
  verifiedByPlatform: boolean;
  developerName: string;
  versionLabel: string;
  lastUpdatedAt: ISODateTimeString;
  setupTimeMinutes: number;
  requiresPlanModuleKey?: string;
  supportedRegions?: string[];
}

export interface IntegrationConnection extends Auditable {
  id: Id;
  organizationId: Id;
  integrationId: Id;
  integrationName: string;
  integrationSlug: string;
  category: IntegrationCategory;
  /** Any non-disconnected state is a local simulation. */
  status: 'not_connected' | 'connected_demo' | 'needs_attention_demo' | 'paused_demo' | 'error_demo' | 'disconnected';
  simulated: true;
  connectedByName?: string;
  connectedAt?: ISODateTimeString;
  /** Never a credential. A masked label is all the client ever holds. */
  accountReferenceMasked?: string;
  configuration: Array<{ id: Id; key: string; label: string; valueDisplay: string; sensitive: boolean; description?: string }>;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  syncFrequency: 'realtime_placeholder' | 'every_15_min' | 'hourly' | 'daily' | 'manual';
  /** Which user or team owns mapping conflicts. */
  fieldMappings: Array<{ id: Id; localField: string; remoteField: string; direction: 'inbound' | 'outbound' | 'both'; transformNote?: string; status: 'mapped' | 'unmapped' | 'conflict' }>;
  lastSyncAt?: ISODateTimeString;
  nextSyncAt?: ISODateTimeString;
  syncStats: { success: number; failed: number; skipped: number; last30Days: number };
  /** Sync records are illustrative. */
  recentRuns: Array<{
    id: Id;
    startedAt: ISODateTimeString;
    finishedAt?: ISODateTimeString;
    direction: string;
    state: 'success_demo' | 'failed_demo' | 'running_demo';
    recordsRead: number;
    recordsWritten: number;
    recordsFailed: number;
    errorSummary?: string;
  }>;
  errorState?: { since: ISODateTimeString; message: string; hint: string; affectedRecords: number };
  healthTrend: Array<{ date: ISODateString; success: number; failed: number }>;
}

export interface ConnectionWizardState {
  integrationId: Id;
  currentStepIndex: number;
  steps: Array<{ id: Id; title: string; description: string; state: 'pending' | 'active' | 'complete' | 'error' | 'skipped'; canSkip: boolean }>;
  scopesAccepted: boolean;
  /** The wizard cannot authenticate; it explains what the real flow will do. */
  authSimulated: true;
  fieldMappings: IntegrationConnection['fieldMappings'];
  syncSettings: { direction: IntegrationConnection['syncDirection']; frequency: IntegrationConnection['syncFrequency'] };
  testResult?: { state: 'not_run' | 'passed_demo' | 'failed_demo'; message: string; checkedAt: ISODateTimeString };
  validationErrors: Array<{ stepId: Id; field: string; message: string }>;
}

export interface IntegrationOverview {
  totalAvailable: number;
  connectedDemo: number;
  needsAttention: number;
  notConnected: number;
  planned: number;
  byCategory: Array<{ category: IntegrationCategory; label: string; available: number; connected: number; tone: Tone }>;
  recentActivity: Array<{ id: Id; integrationName: string; summary: string; at: ISODateTimeString; tone: Tone }>;
  featured: Integration[];
}

/* ------------------------------------------------------ developer platform */

export interface WebhookEndpoint extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  /** Displayed as a placeholder host; no endpoint is provisioned. */
  urlPlaceholder: string;
  urlHostLabel: string;
  status: 'active' | 'paused' | 'disabled';
  events: Array<{ key: string; label: string; category: string; enabled: boolean }>;
  /** The signing secret is never present on the client. */
  signingSecretMasked: string;
  signingSecretRotatedAt?: ISODateTimeString;
  apiVersion: string;
  customHeaders: Array<{ key: string; valueMasked: string; sensitive: boolean }>;
  deliveryStats: { total: number; succeeded: number; failed: number; successRate: number; avgResponseMs: number; last30Days: number };
  lastDeliveryAt?: ISODateTimeString;
  lastFailureAt?: ISODateTimeString;
  /** Delivery simulation is explicit. */
  deliveryMode: 'simulated';
  createdAt: ISODateString;
}

export interface WebhookDelivery {
  id: Id;
  endpointId: Id;
  endpointName: string;
  eventKey: string;
  eventLabel: string;
  state: 'success_demo' | 'failed_demo' | 'retrying_demo' | 'discarded';
  attempt: number;
  maxAttempts: number;
  requestBodyPreview: string;
  responseStatus?: number;
  responseBodyPreview?: string;
  durationMs: number;
  at: ISODateTimeString;
  nextRetryAt?: ISODateTimeString;
  errorSummary?: string;
  recordLabel?: string;
}

export interface WebhookEventDefinition {
  key: string;
  label: string;
  category: string;
  description: string;
  payloadFields: string[];
  examplePayloadPreview: string;
  isBeta: boolean;
}

export interface ApiRequestLog {
  id: Id;
  at: ISODateTimeString;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  statusCode: number;
  durationMs: number;
  apiKeyMasked: string;
  apiKeyName: string;
  userAgent: string;
  ipMasked: string;
  rateLimitRemaining: number;
  /** Request bodies for sensitive resources are redacted, always. */
  requestBodyRedacted?: string;
  responseSummary: string;
  scopeUsed: string;
}

export interface DeveloperOverview {
  organizationId: Id;
  apiKeys: number;
  activeApiKeys: number;
  webhookEndpoints: number;
  activeWebhooks: number;
  apiCallsLast30Days: number;
  apiCallsQuota: number;
  errorRatePercent: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  webhookDeliveries30Days: number;
  webhookSuccessRate: number;
  sandboxEnabled: boolean;
  quota: { used: number; included: number; unit: string; resetsAt: ISODateTimeString };
  usageTrend: Array<{ date: ISODateString; calls: number; errors: number; webhooks: number }>;
  topEndpoints: Array<{ path: string; method: string; calls: number; errorRate: number; avgLatencyMs: number }>;
  topErrors: Array<{ statusCode: number; title: string; count: number; hint: string }>;
  recentActivity: Array<{ id: Id; kind: 'key_created' | 'key_revoked' | 'webhook_created' | 'webhook_failed' | 'app_installed' | 'quota_warning' | 'version_migrated'; label: string; detail: string; at: ISODateTimeString; tone: Tone }>;
}

export interface DeveloperApp extends Auditable {
  id: Id;
  organizationId?: Id;
  name: string;
  slug: string;
  description: string;
  publisherLabel: string;
  kind: 'first_party' | 'partner' | 'private' | 'community';
  status: 'draft' | 'in_review' | 'published' | 'installed' | 'installing_demo' | 'uninstalled';
  category: IntegrationCategory;
  permissions: Array<{ key: string; label: string; description: string; sensitive: boolean; required: boolean }>;
  installScope: 'organization' | 'user' | 'both';
  version: string;
  installsCount: number;
  rating: { average: number; count: number; sampleData: true };
  mark: { initials: string; tone: Tone; generated: true };
  pricingLabel: string;
  isFeatured: boolean;
  lastUpdatedAt: ISODateTimeString;
  reviews: Array<{ id: Id; authorLabel: string; rating: number; body: string; at: ISODateTimeString; /** Illustrative content. */ sampleData: true }>;
}

export interface ApiDocEndpoint {
  id: Id;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  group: string;
  summary: string;
  description: string;
  requiredScope: string;
  pathParams: Array<{ name: string; type: string; required: boolean; description: string }>;
  queryParams: Array<{ name: string; type: string; required: boolean; description: string; example?: string }>;
  requestBodySchema?: Array<{ name: string; type: string; required: boolean; description: string; example?: string }>;
  responseSchema: Array<{ name: string; type: string; required: boolean; description: string }>;
  exampleRequest: string;
  exampleResponse: string;
  rateLimit: string;
  /** The endpoint contract is planned; no server implements it in this deliverable. */
  implementationState: 'contract_documented' | 'planned';
}

/* --------------------------------------------------------------- AI module */

export type AiCapability =
  | 'account_summary'
  | 'deal_insight'
  | 'email_draft'
  | 'meeting_summary'
  | 'call_summary'
  | 'forecast_explanation'
  | 'lead_scoring_explanation'
  | 'natural_language_report'
  | 'next_best_action'
  | 'workflow_suggestion'
  | 'data_quality_review'
  | 'ticket_summary'
  | 'churn_risk_explanation'
  | 'general_assistant';

export interface AiMessage {
  id: Id;
  conversationId: Id;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Deterministic provenance. The UI must render this honestly. */
  origin: 'user_input' | 'demo_template_engine' | 'system_notice';
  createdAt: ISODateTimeString;
  capability?: AiCapability;
  /** Structured attachments a real assistant would return. */
  citations?: Array<{ label: string; type: 'record' | 'report' | 'article' | 'definition'; id?: Id; route?: string; excerpt?: string }>;
  suggestions?: Array<{ id: Id; label: string; prompt: string; capability: AiCapability }>;
  /** Draft artefacts the user must review; never auto-applied. */
  draft?: {
    kind: 'email' | 'task' | 'note' | 'report_definition' | 'workflow_sketch' | 'list_of_actions';
    title: string;
    body: string;
    /** Applying a draft is an explicit, reversible user action. */
    applyLabel: string;
    appliesTo?: { type: string; id: Id; label: string };
  };
  confidence?: { level: 'high' | 'medium' | 'low'; note: string };
  /** Token/credit accounting is synthetic. */
  usage?: { inputTokens: number; outputTokens: number; credits: number; latencyMs: number };
  feedback?: 'helpful' | 'not_helpful' | null;
  isStreamingSimulated?: boolean;
  errorState?: { code: string; message: string; retryable: boolean };
}

export interface AiConversation extends Auditable {
  id: Id;
  organizationId: Id;
  userId: Id;
  title: string;
  /** Where the conversation was started, so context is obvious. */
  entryPoint: 'side_panel' | 'workspace' | 'record_page' | 'report_builder' | 'command_palette';
  contextualRecord?: { type: string; id: Id; label: string; route: string };
  messages: AiMessage[];
  pinned: boolean;
  archivedAt?: ISODateTimeString;
  capabilitiesUsed: AiCapability[];
  totalCredits: number;
}

export interface AiPromptSuggestion {
  id: Id;
  capability: AiCapability;
  label: string;
  prompt: string;
  description: string;
  /** Whether the prompt needs a record in context to be meaningful. */
  requiresContext: boolean;
  contextType?: string;
  personaTargets: string[];
  category: 'summaries' | 'planning' | 'writing' | 'analysis' | 'data_quality' | 'automation';
  tone: Tone;
}

export interface AiUsageRecord {
  id: Id;
  organizationId: Id;
  userId: Id;
  userName: string;
  capability: AiCapability;
  occurredAt: ISODateTimeString;
  credits: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  accepted: boolean | null;
  feedback: 'helpful' | 'not_helpful' | null;
}

export interface AiUsageDashboard {
  periodLabel: string;
  creditsUsed: number;
  creditsIncluded: number;
  creditsRemaining: number;
  usagePercent: number;
  requests: number;
  activeUsers: number;
  adoptionPercent: number;
  acceptanceRatePercent: number;
  helpfulnessPercent: number;
  averageLatencyMs: number;
  trend: Array<{ date: ISODateString; requests: number; credits: number; accepted: number }>;
  byCapability: Array<{ capability: AiCapability; label: string; requests: number; credits: number; acceptanceRate: number }>;
  topUsers: Array<{ userId: Id; name: string; requests: number; credits: number; acceptanceRate: number }>;
  /** Credit consumption is synthetic; no AI provider is called. */
  billingState: 'not_metered';
}

export interface AiSettings {
  organizationId: Id;
  enabled: boolean;
  /** Deterministic demo engine only — no model hosting or provider keys. */
  providerState: 'demo_template_engine' | 'not_configured';
  allowedCapabilities: Array<{ capability: AiCapability; enabled: boolean; rolesAllowed: Id[] }>;
  dataAccess: {
    /** Explanations shown to admins so expectations are correct. */
    readScope: 'records_user_can_access' | 'selected_modules' | 'none';
    includeNotes: boolean;
    includeEmails: boolean;
    includeAttachments: boolean;
    excludeSensitiveFields: boolean;
    excludeFieldApiNames: string[];
    retentionDays: number;
    humanReviewRequiredForDrafts: boolean;
    optOutUserIds: Id[];
    regionNote: string;
  };
  usageLimits: { monthlyCreditLimit: number; perUserDailyRequestLimit: number; overageBehaviour: 'block' | 'notify' | 'allow' };
  feedbackCollectionEnabled: boolean;
  auditAllPrompts: boolean;
  disclaimerText: string;
}

/* ------------------------------------------------- platform-owner (super admin) */

export interface PlatformOverview {
  generatedAt: ISODateTimeString;
  currency: CurrencyCode;
  /** Every figure is synthetic and labelled as such in the UI. */
  dataState: 'synthetic';
  tenants: { total: number; active: number; trial: number; paying: number; pastDue: number; suspended: number; churned: number; newThisMonth: number; newLastMonth: number };
  users: { total: number; activeLast30Days: number; invited: number; byPersona: Array<{ persona: string; label: string; count: number }> };
  revenue: { mrr: number; arr: number; netNewMrr: number; expansionMrr: number; contractionMrr: number; churnedMrr: number; arpu: number; arpa: number; averageContractMonths: number };
  retention: { trialToPaidPercent: number; logoRetention: number; netRevenueRetention: number; grossChurnPercent: number; monthlyChurnPercent: number };
  growth: { mrrTrend: Array<{ month: string; mrr: number; newMrr: number; churnedMrr: number; tenants: number }>; tenantGrowth: Array<{ month: string; tenants: number; trials: number; churned: number }>; signupTrend: Array<{ date: ISODateString; signups: number; activations: number; conversions: number }> };
  subscriptionMix: Array<{ planId: Id; planName: string; tenants: number; mrr: number; sharePercent: number; tone: Tone }>;
  modulesMix: Array<{ moduleKey: string; label: string; tenantsEnabled: number; adoptionPercent: number; tone: Tone }>;
  regions: Array<{ region: string; label: string; tenants: number; users: number; mrr: number; churnPercent: number }>;
  plans: Array<{ planId: Id; planName: string; tenants: number; mrr: number; arpa: number; trialConversion: number }>;
  support: { openTickets: number; avgFirstResponseMinutes: number; avgResolutionHours: number; slaCompliancePercent: number; csat: number; escalated: number; byPriority: Array<{ priority: string; count: number }> };
  usage: { apiCalls: number; storageGb: number; emailsSimulated: number; activeUsersDaily: Array<{ date: ISODateString; users: number; sessions: number }>; platformUptimeStated: string; uptimeClaim: 'not_claimed' };
  recentActivity: Array<{ id: Id; kind: 'tenant_created' | 'plan_changed' | 'trial_started' | 'trial_converted' | 'payment_failed' | 'tenant_suspended' | 'flag_toggled' | 'support_ticket' | 'new_user'; label: string; tenantName: string; at: ISODateTimeString; tone: Tone }>;
  alerts: Array<{ id: Id; severity: 'info' | 'warning' | 'critical'; title: string; detail: string; href?: string; raisedAt: ISODateTimeString }>;
}

export interface PlatformTenantRow {
  tenantId: Id;
  name: string;
  slug: string;
  status: string;
  planName: string;
  subscriptionStatus: string;
  countryCode: string;
  region: string;
  seatsPurchased: number;
  seatsUsed: number;
  seatUtilisationPercent: number;
  mrr: number;
  arr: number;
  currency: CurrencyCode;
  createdAt: ISODateString;
  trialEndsAt?: ISODateTimeString;
  renewsAt?: ISODateTimeString;
  daysUntilRenewal?: number;
  lastActiveAt?: ISODateTimeString;
  healthScore: number;
  modulesEnabled: number;
  openTickets: number;
  failedPayments: number;
  usage: { apiCalls30d: number; storageGb: number; activeUsers30d: number };
}

export interface PlatformPlan extends Auditable {
  id: Id;
  name: string;
  code: string;
  description: string;
  /** Provisional commercial categories — no final pricing strategy is set. */
  commercialState: 'illustrative_not_final';
  visibility: 'public' | 'private' | 'legacy' | 'internal';
  sortOrder: number;
  tone: Tone;
  billingOptions: Array<{
    interval: 'month' | 'year';
    basePlatformFee: Money;
    /** Per-seat, per-unit and usage pricing may all coexist. */
    pricingModel: 'per_user' | 'flat' | 'per_user_plus_flat' | 'usage_based' | 'feature_based' | 'module_based' | 'custom_contract';
    perUserPrice?: Money;
    minimumSeats?: number;
    maximumSeats?: number | null;
    includedSeats?: number;
    usageIncluded?: { unit: string; quantity: number; overageUnitPrice?: Money };
    annualDiscountPercent?: number;
    currency: CurrencyCode;
  }>;
  seatLimits: { min: number | null; max: number | null; includedUsers: number | null; includedViewers: number | null };
  featureLimits: Array<{ key: string; label: string; unit: string; included: number | null; unlimited: boolean; overageAllowed: boolean }>;
  moduleKeys: string[];
  addOnIds: Id[];
  trial: { enabled: boolean; days: number; requiresCard: boolean; convertibleTo: Id[] };
  availability: { regions: string[]; countryAllowlist: string[]; excludedCountries: string[]; availableFrom?: ISODateString; availableUntil?: ISODateString };
  /** Regional price presentation, not a payment configuration. */
  regionalPricing: Array<{ region: string; currency: CurrencyCode; priceMultiplier: number; note: string }>;
  tenantCount: number;
  mrrContribution: Money;
  isDefault: boolean;
  isArchived: boolean;
}

export interface PlatformAddOn extends Auditable {
  id: Id;
  name: string;
  code: string;
  description: string;
  moduleKeys: string[];
  pricingModel: 'flat_monthly' | 'per_user_monthly' | 'per_unit' | 'one_time' | 'custom_contract';
  price: Money;
  currency: CurrencyCode;
  unitLabel?: string;
  includedQuantity?: number;
  compatiblePlanIds: Id[];
  tenantCount: number;
  mrrContribution: Money;
  isActive: boolean;
  tone: Tone;
}

export interface PlatformSubscription extends Auditable {
  id: Id;
  tenantId: Id;
  tenantName: string;
  planId: Id;
  planName: string;
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';
  billingInterval: 'month' | 'year';
  seats: number;
  seatsUsed: number;
  unitPrice: Money;
  baseFee: Money;
  addOns: Array<{ addOnId: Id; name: string; quantity: number; price: Money }>;
  discount?: { kind: 'percent' | 'amount'; value: number; code?: string; expiresAt?: ISODateString; reason: string };
  currency: CurrencyCode;
  mrr: Money;
  arr: Money;
  startedAt: ISODateString;
  currentPeriodStart: ISODateString;
  currentPeriodEnd: ISODateString;
  trialEndsAt?: ISODateTimeString;
  canceledAt?: ISODateTimeString;
  cancelReason?: string;
  cancellationEffectiveAt?: ISODateString;
  renewal: { mode: 'auto' | 'manual'; attempts: number; lastAttemptAt?: ISODateTimeString; lastAttemptState?: 'succeeded' | 'failed'; nextAttemptAt?: ISODateTimeString; failureReason?: string };
  /** Billing is never real. */
  billingState: 'not_connected';
  ownerTeam: 'revenue' | 'customer_success' | 'support' | 'none';
  notes?: string;
}

export interface PlatformInvoice extends Auditable {
  id: Id;
  tenantId: Id;
  tenantName: string;
  subscriptionId: Id;
  reference: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | 'refunded';
  issuedAt: ISODateString;
  dueAt: ISODateString;
  paidAt?: ISODateString;
  currency: CurrencyCode;
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  amountPaid: Money;
  amountDue: Money;
  lineItems: Array<{ id: Id; description: string; quantity: number; unitPrice: Money; amount: Money }>;
  /** This is a record-keeping view; no payment provider is integrated. */
  paymentProviderState: 'not_connected';
  paymentMethodMasked?: string;
  failureReason?: string;
  attempts: number;
  creditNoteOf?: Id;
}

export interface FeatureFlag extends Auditable {
  id: Id;
  key: string;
  name: string;
  description: string;
  category: 'platform' | 'crm' | 'marketing' | 'service' | 'ai' | 'integration' | 'experiment' | 'infrastructure';
  status: 'off' | 'on' | 'partial' | 'internal_only' | 'deprecated';
  /** Rollout configuration. */
  rollout: {
    kind: 'all_tenants' | 'specific_tenants' | 'percentage' | 'plan_based' | 'region_based' | 'internal_users';
    percentage?: number;
    tenantIds?: Id[];
    planIds?: Id[];
    regions?: string[];
  };
  ownerTeam: string;
  /** Flags are evaluated locally for demonstration. */
  evaluationState: 'simulated';
  affectedTenants: number;
  createdByName: string;
  lastToggledAt?: ISODateTimeString;
  lastToggledByName?: string;
  expiresAt?: ISODateString;
  auditTrail: Array<{ id: Id; at: ISODateTimeString; actorName: string; change: string; note?: string }>;
}

export interface ModuleCatalogEntry {
  key: string;
  name: string;
  description: string;
  section: string;
  icon: string;
  tone: Tone;
  category: 'core' | 'sales' | 'marketing' | 'service' | 'success' | 'operations' | 'platform' | 'addon';
  /** Which surfaces the module introduces. */
  surfaces: Array<'crm' | 'portal' | 'admin' | 'website'>;
  status: 'ga' | 'beta' | 'preview' | 'planned' | 'deprecated' | 'retired';
  /** Entitlement metadata the CRM shell reads. */
  entitlement: { unit: 'seat' | 'tenant' | 'usage' | 'included'; defaultPlans: Id[]; requiresAddOn: boolean; usageMetricKey?: string };
  dependencies: string[];
  sideEffects: string[];
  dataRetentionNote?: string;
  screenshotsPlaceholder: number;
  tenantAdoption: number;
  documentationUrlPlaceholder?: string;
  sortOrder: number;
  isEnabledGlobally: boolean;
}

export interface LocalizationAdminRow {
  locale: string;
  languageName: string;
  englishName: string;
  direction: 'ltr' | 'rtl';
  /** Completion percentages are measured against the reference string set. */
  translationCompletenessPercent: number;
  missingKeys: number;
  reviewedPercent: number;
  translators: string[];
  isEnabledForWebsite: boolean;
  isEnabledForCrm: boolean;
  fallbackLocale: string;
  pluralRulesMissing: number;
  status: 'reference' | 'complete' | 'in_progress' | 'community' | 'machine_draft' | 'planned';
  lastUpdatedAt?: ISODateTimeString;
  /** Honest note about machine vs human translation. */
  qualityNote: string;
}

export interface PlatformNotificationTemplate {
  id: Id;
  key: string;
  name: string;
  channel: 'email' | 'in_app' | 'both';
  audience: 'tenant_admin' | 'tenant_users' | 'platform_users' | 'billing_contact';
  trigger: string;
  subjectTemplate: string;
  bodyTemplate: string;
  locales: Array<{ locale: string; subject: string; body: string; complete: boolean }>;
  variables: Array<{ key: string; description: string }>;
  /** Nothing is delivered; templates are edited and previewed only. */
  deliveryState: 'not_connected';
  lastEditedByName: string;
  lastEditedAt: ISODateTimeString;
  isActive: boolean;
}

export interface SystemStatusComponent {
  id: Id;
  name: string;
  group: 'application' | 'api' | 'integrations' | 'infrastructure' | 'developer_platform';
  /** Status is illustrative; no monitoring integration exists. */
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance' | 'unknown';
  state: 'synthetic';
  uptimePercent30d: number;
  uptimeClaim: 'not_claimed';
  latencyP95Ms?: number;
  region?: string;
  incidents: Array<{ id: Id; title: string; severity: 'minor' | 'major' | 'critical' | 'maintenance'; startedAt: ISODateTimeString; resolvedAt?: ISODateTimeString; summary: string; updates: Array<{ at: ISODateTimeString; message: string; state: string }> }>;
  scheduledMaintenance?: Array<{ id: Id; title: string; startsAt: ISODateTimeString; endsAt: ISODateTimeString; impact: string; regions: string[] }>;
}

export interface PlatformUser extends Auditable {
  id: Id;
  name: string;
  email: string;
  initials: string;
  team: 'revenue' | 'support' | 'engineering' | 'customer_success' | 'marketing' | 'leadership' | 'security';
  platformRoleIds: Id[];
  platformRoleNames: string[];
  status: 'active' | 'invited' | 'suspended';
  lastActiveAt?: ISODateTimeString;
  mfaEnabled: boolean;
  /** Sensitive-data access is permissioned, not implied by role name. */
  sensitiveDataAccess: boolean;
  assignedTenantIds: Id[];
  accessReviewedAt?: ISODateString;
}

export interface PlatformRole extends Auditable {
  id: Id;
  name: string;
  description: string;
  kind: 'system' | 'custom';
  permissions: Array<{ key: string; label: string; category: string; effect: 'allow' | 'deny' }>;
  userCount: number;
  /** Actions that always require a second approver regardless of role. */
  dualApprovalActions: string[];
  isDefault: boolean;
}

export interface PlatformAuditEvent {
  id: Id;
  at: ISODateTimeString;
  actorId: Id;
  actorName: string;
  actorType: 'platform_user' | 'tenant_user' | 'system' | 'automation';
  action: string;
  category: 'tenant' | 'billing' | 'plan' | 'flag' | 'user' | 'security' | 'data' | 'support' | 'integration' | 'localization';
  targetLabel: string;
  targetId?: Id;
  tenantId?: Id;
  tenantName?: string;
  outcome: 'success' | 'failure' | 'denied' | 'pending_approval';
  severity: 'info' | 'notice' | 'warning' | 'critical';
  changes?: Array<{ field: string; before?: string; after?: string }>;
  ipMasked?: string;
  userAgent?: string;
  /** Second-approver state for dual-control actions. */
  approval?: { required: boolean; approvedByName?: string; approvedAt?: ISODateTimeString; reason?: string };
}

export interface PlatformSupportTicket extends Auditable {
  id: Id;
  reference: string;
  tenantId: Id;
  tenantName: string;
  requesterName: string;
  requesterEmail: string;
  subject: string;
  status: 'new' | 'open' | 'waiting_on_tenant' | 'waiting_on_platform' | 'escalated' | 'resolved' | 'closed';
  priority: 'critical' | 'high' | 'normal' | 'low';
  category: 'billing' | 'technical' | 'onboarding' | 'feature_request' | 'data_request' | 'security' | 'migration' | 'other';
  assigneeName?: string;
  slaState: 'on_track' | 'at_risk' | 'breached' | 'none';
  firstResponseAt?: ISODateTimeString;
  resolutionAt?: ISODateTimeString;
  messages: Array<{ id: Id; at: ISODateTimeString; authorName: string; authorKind: 'platform' | 'tenant' | 'system'; body: string; internal: boolean }>;
  internalNotes: Array<{ id: Id; at: ISODateTimeString; authorName: string; body: string }>;
  escalationReason?: string;
  linkedTenantTicketId?: Id;
}

export interface MaintenanceBanner {
  id: Id;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  startsAt: ISODateTimeString;
  endsAt: ISODateTimeString;
  surfaces: Array<'crm' | 'platform_admin' | 'website' | 'portal'>;
  locales: Array<{ locale: string; message: string }>;
  dismissible: boolean;
  isActive: boolean;
  createdByName: string;
}
