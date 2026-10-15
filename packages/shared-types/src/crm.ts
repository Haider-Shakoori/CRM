/**
 * Core sales domain: leads, contacts, accounts, opportunities and pipelines.
 *
 * These are the records the CRM is really about. Field naming stays close to the
 * vocabulary every sales team already uses so the future API mapping is obvious.
 */

import type {
  Address,
  Auditable,
  Archivable,
  ConsentRecord,
  CurrencyCode,
  CustomFieldBag,
  EmailAddress,
  FileRef,
  Id,
  ISODateString,
  ISODateTimeString,
  Money,
  Ownable,
  PhoneNumber,
  Tag,
  Tone,
  WebsiteRef,
} from './common';

/* -------------------------------------------------------------------- leads */

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'nurturing'
  | 'qualified'
  | 'unqualified'
  | 'converted'
  | 'recycled'
  | 'disqualified';

export type LeadRating = 'hot' | 'warm' | 'cold' | 'unrated';

export interface LeadScoring {
  /** 0-100. Composite of fit (firmographic) and engagement signals. */
  score: number;
  fitScore: number;
  engagementScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'unrated';
  /** Human-readable reasons, so scoring is explainable rather than a black box. */
  factors: Array<{
    key: string;
    label: string;
    contribution: number;
    direction: 'positive' | 'negative' | 'neutral';
  }>;
  modelLabel: string;
  updatedAt: ISODateTimeString;
}

export interface Lead extends Auditable, Archivable, Ownable {
  id: Id;
  organizationId: Id;
  /** Human-friendly reference shown in tables, e.g. `L-10432`. */
  reference: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  emails: EmailAddress[];
  phones: PhoneNumber[];
  website?: string;
  address?: Address;
  status: LeadStatus;
  rating: LeadRating;
  scoring?: LeadScoring;
  /** `leadSourceId` resolves against the lead-source dictionary. */
  leadSourceId?: Id;
  leadSourceDetail?: string;
  campaignId?: Id;
  industryId?: Id;
  companySize?: string;
  annualRevenue?: Money;
  employeeCount?: number;
  estimatedValue?: Money;
  territory?: string;
  tags: Tag[];
  ownerTeamId?: Id;
  /** Agents have historically owned leads; the model keeps both for flexibility. */
  lastActivityAt?: ISODateTimeString;
  nextActivityAt?: ISODateTimeString;
  /** SLA clock used by the "respond within" business rule. */
  responseDueAt?: ISODateTimeString;
  firstRespondedAt?: ISODateTimeString;
  qualifiedAt?: ISODateTimeString;
  disqualifiedReason?: string;
  nurtureSequenceId?: Id;
  /** Set when the lead was promoted into contact/account/deal records. */
  convertedAt?: ISODateTimeString;
  convertedTo?: {
    contactId?: Id;
    accountId?: Id;
    dealId?: Id;
  };
  /**
   * Deterministic duplicate linkage. The UI shows candidates for human review and
   * never auto-merges.
   */
  duplicateOfId?: Id;
  duplicateScore?: number;
  notes?: string;
  customFields: CustomFieldBag;
}

export interface LeadSource {
  id: Id;
  name: string;
  kind:
    | 'web_form'
    | 'paid_search'
    | 'paid_social'
    | 'organic'
    | 'referral'
    | 'event'
    | 'outbound'
    | 'partner'
    | 'import'
    | 'manual'
    | 'other';
  /** Attribution-dependent grouping; cost data is illustrative only. */
  channel?: string;
  costPerLead?: Money;
  defaultOwnerId?: Id;
  isActive: boolean;
  leadCount: number;
  conversionRate: number;
}

export interface LeadConversionRequest {
  leadId: Id;
  /** Each target may be an existing record or a new one created during conversion. */
  contactAccountAction: 'create_new' | 'link_existing' | 'link_and_create';
  existingContactId?: Id;
  existingAccountId?: Id;
  createDeal: boolean;
  dealName?: string;
  pipelineId?: Id;
  stageId?: Id;
  dealAmount?: Money;
  expectedCloseDate?: ISODateString;
  ownerId?: Id;
  copyNotes: boolean;
  copyActivities: boolean;
  /** Task templates are attached automatically after conversion. */
  followUpTaskTemplateId?: Id;
}

export interface LeadConversionPreview {
  leadId: Id;
  contact: { willCreate: boolean; existingId?: Id; displayName: string; fieldDiffs: FieldDiff[] };
  account: { willCreate: boolean; existingId?: Id; displayName: string; fieldDiffs: FieldDiff[] };
  deal?: { willCreate: boolean; displayName: string; amount?: Money };
  duplicateWarnings: Array<{ kind: 'contact' | 'account'; existingId: Id; label: string; score: number }>;
}

export interface FieldDiff {
  field: string;
  label: string;
  leadValue?: string;
  existingValue?: string;
  conflict: boolean;
}

/* ----------------------------------------------------------------- contacts */

export type LifecycleStage =
  | 'subscriber'
  | 'lead'
  | 'mql'
  | 'sql'
  | 'opportunity'
  | 'customer'
  | 'evangelist'
  | 'churned'
  | 'other';

export interface Contact extends Auditable, Archivable, Ownable {
  id: Id;
  organizationId: Id;
  reference: string;
  firstName: string;
  lastName: string;
  displayName: string;
  salutation?: string;
  preferredName?: string;
  jobTitle?: string;
  department?: string;
  seniority?: 'individual' | 'manager' | 'director' | 'vp' | 'c_level' | 'owner';
  accountId?: Id;
  accountName?: string;
  emails: EmailAddress[];
  phones: PhoneNumber[];
  /** Secondary contact used for WhatsApp/Telegram-style channels. */
  messagingHandles?: Array<{ channel: string; handle: string; verified: boolean }>;
  preferredChannel?: 'email' | 'phone' | 'sms' | 'whatsapp' | 'chat';
  preferredLanguage?: string;
  addresses: Address[];
  birthday?: ISODateString;
  timezone?: string;
  socialProfiles?: WebsiteRef[];
  lifecycleStage: LifecycleStage;
  /** Explicit consent state per channel. Never inferred. */
  consent: ConsentRecord[];
  communicationPreferences?: {
    doNotCall: boolean;
    doNotEmail: boolean;
    doNotSms: boolean;
    unsubscribeAll: boolean;
    notes?: string;
  };
  tags: Tag[];
  /** Relationship graph so we can render "influencer", "decision maker", "champion". */
  relationships: ContactRelationship[];
  engagementScore?: number;
  lastActivityAt?: ISODateTimeString;
  lastEmailAt?: ISODateTimeString;
  lastMeetingAt?: ISODateTimeString;
  openDealCount: number;
  openTicketCount: number;
  lifetimeValue?: Money;
  ownerTeamId?: Id;
  ownerId: Id;
  duplicateOfId?: Id;
  description?: string;
  customFields: CustomFieldBag;
}

export type ContactRelationshipKind =
  | 'reports_to'
  | 'assistant'
  | 'decision_maker'
  | 'influencer'
  | 'champion'
  | 'billing_contact'
  | 'technical_contact'
  | 'related_to'
  | 'referred_by';

export interface ContactRelationship {
  id: Id;
  kind: ContactRelationshipKind;
  /** Either a contact or an account can be on the other end of a relationship. */
  targetType: 'contact' | 'account';
  targetId: Id;
  targetLabel: string;
  note?: string;
  strength?: 'strong' | 'moderate' | 'weak' | 'unknown';
}

export interface ContactMergeRequest {
  primaryContactId: Id;
  mergeContactIds: Id[];
  /** Field-level resolution map: `field -> sourceContactId`. */
  resolvers: Record<string, Id>;
  keepAllEmails: boolean;
  moveRelatedRecords: boolean;
  deleteAfterMerge: boolean;
}

/* ----------------------------------------------------------------- accounts */

export type AccountType =
  | 'customer'
  | 'prospect'
  | 'partner'
  | 'reseller'
  | 'vendor'
  | 'competitor'
  | 'other';

export type AccountHealth = 'thriving' | 'healthy' | 'watch' | 'at_risk' | 'critical' | 'unknown';

export interface Account extends Auditable, Archivable, Ownable {
  id: Id;
  organizationId: Id;
  reference: string;
  name: string;
  legalName?: string;
  tradingName?: string;
  type: AccountType;
  industryId?: Id;
  /** Taxonomy can be tenant-specific, so the label is stored alongside the id. */
  industryLabel?: string;
  subIndustry?: string;
  companySize?: 'solo' | '2-10' | '11-50' | '51-200' | '201-1000' | '1001-5000' | '5000+';
  employeeCount?: number;
  annualRevenue?: Money;
  foundedYear?: number;
  registrationNumber?: string;
  taxIdentifier?: string;
  website?: string;
  domains: string[];
  emails: EmailAddress[];
  phones: PhoneNumber[];
  addresses: Address[];
  parentAccountId?: Id;
  parentAccountName?: string;
  childAccountIds: Id[];
  /** Hierarchy depth mirrors the org tree so the UI can render a tree view. */
  hierarchyDepth: number;
  ownerId: Id;
  ownerTeamId?: Id;
  territory?: string;
  rating?: 'strategic' | 'high' | 'medium' | 'low';
  tier?: 'enterprise' | 'mid_market' | 'smb' | 'startup';
  health: AccountHealth;
  healthScore?: number;
  healthSignals?: Array<{ key: string; label: string; value: string; sentiment: 'positive' | 'neutral' | 'negative' }>;
  tags: Tag[];
  lastActivityAt?: ISODateTimeString;
  nextActivityAt?: ISODateTimeString;
  contractStartDate?: ISODateString;
  contractEndDate?: ISODateString;
  renewalDate?: ISODateString;
  openDealCount: number;
  openTicketCount: number;
  contactCount: number;
  totalRevenueWon?: Money;
  lifetimeValue?: Money;
  /** Account-based-selling view state, persisted per user in the real product. */
  isKeyAccount: boolean;
  buyingCommittee?: Array<{ contactId: Id; name: string; role?: string; sentiment: 'advocate' | 'neutral' | 'skeptic' | 'unknown' }>;
  description?: string;
  customFields: CustomFieldBag;
}

export interface AccountRevenueSnapshot {
  accountId: Id;
  currency: CurrencyCode;
  wonToDate: Money;
  openPipeline: Money;
  recurringRevenue: Money;
  averageDealSize: Money;
  dealCount: number;
  byYear: Array<{ year: number; won: number; pipeline: number }>;
  byProduct: Array<{ productId: Id; productName: string; amount: number }>;
}

/* -------------------------------------------------------------- provisions */

export type PipelineKind = 'sales' | 'renewal' | 'partnership' | 'custom';

export interface Pipeline extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  kind: PipelineKind;
  description?: string;
  currency: CurrencyCode;
  isDefault: boolean;
  isActive: boolean;
  stages: Stage[];
  /** Ordering for the pipeline switcher. */
  sortOrder: number;
  /** Which record types this pipeline applies to. */
  recordTypes: Array<'deal' | 'ticket' | 'onboarding' | 'renewal' | 'partner_deal'>;
  /** Presentation preferences the kanban reads directly. */
  settings: {
    showStageTotals: boolean;
    showWeightedValue: boolean;
    requireLostReason: boolean;
    requireNextStep: boolean;
    staleDealDays: number;
    defaultStageId?: Id;
  };
}

export interface Stage {
  id: Id;
  pipelineId: Id;
  name: string;
  /** 0-100. Feeds weighted pipeline and forecast calculations. */
  probability: number;
  forecastCategory: ForecastCategory;
  kind: 'open' | 'won' | 'lost';
  sortOrder: number;
  /** Visual token only — the kanban never hardcodes a colour. */
  tone: Tone;
  description?: string;
  /** Rotting alert: deals older than this many days are flagged. */
  warningAfterDays?: number;
  /**
   * Non-drag alternatives to the kanban stay in sync because both write through the
   * same move operation. Exit conditions make progression rules explicit.
   */
  exitCriteria?: Array<{ key: string; label: string; required: boolean }>;
  automationCount?: number;
  dealCount?: number;
  dealValue?: Money;
}

export type ForecastCategory = 'pipeline' | 'best_case' | 'commit' | 'closed_won' | 'closed_lost' | 'omitted';

/* --------------------------------------------------------------- deals */

export type DealStatus = 'open' | 'won' | 'lost' | 'abandoned';

export interface DealProductLine {
  id: Id;
  productId: Id;
  productName: string;
  sku?: string;
  priceBookEntryId?: Id;
  quantity: number;
  unitPrice: Money;
  discountPercent: number;
  discountAmount?: Money;
  taxPercent?: number;
  /** Recurring lines describe subscription revenue rather than one-off sales. */
  billing: 'one_time' | 'monthly' | 'quarterly' | 'annual' | 'usage';
  termMonths?: number;
  lineTotal: Money;
  description?: string;
  sortOrder: number;
}

export interface Deal extends Auditable, Archivable {
  id: Id;
  organizationId: Id;
  reference: string;
  name: string;
  accountId: Id;
  accountName: string;
  primaryContactId?: Id;
  primaryContactName?: string;
  pipelineId: Id;
  stageId: Id;
  status: DealStatus;
  amount: Money;
  /** Present when the deal sells in a different currency from the pipeline default. */
  pipelineCurrency: CurrencyCode;
  exchangeRateUsed?: number;
  probability: number;
  forecastCategory: ForecastCategory;
  expectedCloseDate: ISODateString;
  actualCloseDate?: ISODateString;
  /** Duration in days from creation to close, computed by the mock layer. */
  cycleTimeDays?: number;
  leadSourceId?: Id;
  campaignId?: Id;
  dealType?: 'new_business' | 'expansion' | 'renewal' | 'upsell' | 'cross_sell';
  ownerId: Id;
  ownerTeamId?: Id;
  /** Multiple owners beyond the primary one. */
  teamMembers: Array<{ userId: Id; name: string; role: 'owner' | 'contributor' | 'executive_sponsor' | 'technical' | 'legal' }>;
  products: DealProductLine[];
  competitorIds: Id[];
  competitors?: Array<{ id: Id; name: string; threat: 'high' | 'medium' | 'low'; strength?: string; weakness?: string }>;
  /** Loss analysis drives the "why we lose" report. */
  lostReasonId?: Id;
  lostReasonLabel?: string;
  lostNotes?: string;
  wonNotes?: string;
  nextStep?: string;
  nextActivityAt?: ISODateTimeString;
  lastActivityAt?: ISODateTimeString;
  stageEnteredAt: ISODateTimeString;
  /** Days sitting in the current stage; drives the rotting indicator. */
  daysInStage: number;
  isStale: boolean;
  approvalState?: 'not_required' | 'pending' | 'approved' | 'rejected';
  quoteCount?: number;
  contractId?: Id;
  projectId?: Id;
  /** Free-text used by the AI summary panel; explicitly a demo field. */
  notes?: string;
  tags: Tag[];
  customFields: CustomFieldBag;
}

export interface DealLostReason {
  id: Id;
  label: string;
  category: 'price' | 'product_gap' | 'timing' | 'competitor' | 'no_decision' | 'relationship' | 'process' | 'other';
  dealCount: number;
  totalValue: number;
  winRateImpact: number;
  isActive: boolean;
}

export interface PipelineStageSummary {
  stageId: Id;
  stageName: string;
  tone: Tone;
  probability: number;
  dealCount: number;
  totalValue: Money;
  weightedValue: Money;
  averageAgeDays: number;
  staleCount: number;
}

export interface PipelineSummary {
  pipelineId: Id;
  pipelineName: string;
  currency: CurrencyCode;
  totalDeals: number;
  totalValue: Money;
  weightedValue: Money;
  averageDealSize: Money;
  averageCycleTimeDays: number;
  winRate: number;
  stages: PipelineStageSummary[];
}

export interface DealMoveRequest {
  dealId: Id;
  toStageId: Id;
  /** Recorded for the audit trail and to make the reason visible in history. */
  lostReasonId?: Id;
  note?: string;
  /** Optimistic UI flag so the mock layer can simulate latency and rollback. */
  optimistic?: boolean;
}

/* -------------------------------------------------------- duplicate review */

export interface DuplicateCandidate {
  id: Id;
  entityKind: 'lead' | 'contact' | 'account';
  score: number;
  matchedOn: Array<{ field: string; valueA: string; valueB: string }>;
  recordA: { id: Id; label: string; subtitle?: string };
  recordB: { id: Id; label: string; subtitle?: string };
  status: 'pending' | 'merged' | 'ignored' | 'not_duplicate';
  detectedAt: ISODateTimeString;
}

/* ------------------------------------------------------------------ shared */

export interface RecordAttachmentRef {
  id: Id;
  file: FileRef;
  /** Which record the file is attached to. */
  ownerType: 'lead' | 'contact' | 'account' | 'deal' | 'ticket' | 'campaign' | 'contract' | 'project';
  ownerId: Id;
  category?: string;
}
