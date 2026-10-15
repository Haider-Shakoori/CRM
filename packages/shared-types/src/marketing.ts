/**
 * Marketing automation: campaigns, segments, templates, journeys, forms, landing
 * pages and attribution.
 *
 * Every "send" in this module is simulated. Campaign statistics are deterministic
 * synthetic values so charts and reports stay internally consistent.
 */

import type {
  Auditable,
  CurrencyCode,
  Id,
  ISODateString,
  ISODateTimeString,
  Money,
  Tag,
  Tone,
} from './common';

export type CampaignType =
  | 'email'
  | 'newsletter'
  | 'drip'
  | 'event'
  | 'webinar'
  | 'paid_advertising'
  | 'social'
  | 'content'
  | 'direct_mail'
  | 'referral'
  | 'product_launch'
  | 'upsell';

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived' | 'cancelled';

export interface Campaign extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  code?: string;
  type: CampaignType;
  status: CampaignStatus;
  objective: 'lead_generation' | 'nurturing' | 'awareness' | 'retention' | 'upsell' | 're_engagement' | 'event_promotion';
  description?: string;
  startDate?: ISODateString;
  endDate?: ISODateString;
  ownerId: Id;
  ownerName: string;
  teamId?: Id;
  budgetedCost?: Money;
  actualCost?: Money;
  currency: CurrencyCode;
  /** Audience linkage. Segments are reusable across campaigns. */
  segmentIds: Id[];
  audienceSize: number;
  tags: Tag[];
  goals: CampaignGoal[];
  /** Aggregate performance is derived, never hand-entered. */
  metrics: CampaignMetrics;
  abTest?: AbTestSummary;
  relatedDealIds?: Id[];
  revenueAttributed?: Money;
  /** Attribution model used for the numbers shown. */
  attributionModel: AttributionModel;
  utmDefaults?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string };
  channels: Array<'email' | 'social' | 'paid_search' | 'paid_social' | 'web' | 'event' | 'direct_mail' | 'sms'>;
  notes?: string;
}

export type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'last_non_direct';

export interface CampaignGoal {
  id: Id;
  metric: 'leads' | 'mqls' | 'sqls' | 'deals' | 'revenue' | 'meetings' | 'registrations' | 'opens' | 'clicks';
  target: number;
  achieved: number;
}

export interface CampaignMetrics {
  recipients: number;
  delivered: number;
  bounces: number;
  unsubscribes: number;
  spamComplaints: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  replies?: number;
  leadsCreated: number;
  mqls: number;
  sqls: number;
  opportunities: number;
  dealsWon: number;
  revenue: Money;
  cost: Money;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  conversionRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  costPerLead: Money;
  roi: number;
  /** Daily series keeps every chart on the campaign page consistent. */
  trend: Array<{ date: ISODateString; sent: number; opens: number; clicks: number; leads: number; revenue: number }>;
  byChannel?: Array<{ channel: string; spend: number; leads: number; revenue: number; roi: number }>;
  byDevice?: Array<{ device: 'desktop' | 'mobile' | 'tablet'; opens: number; clicks: number }>;
  byCountry?: Array<{ countryCode: string; country: string; leads: number; revenue: number }>;
  byLink?: Array<{ url: string; label: string; clicks: number; uniqueClicks: number }>;
}

export interface AbTestSummary {
  id: Id;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'stopped';
  metric: 'open_rate' | 'click_rate' | 'conversion_rate' | 'reply_rate';
  confidencePercent: number;
  sampleSize: number;
  winnerVariantId?: Id;
  /** Minimum sample before declaring a winner; the UI blocks premature conclusions. */
  minimumSampleReached: boolean;
  variants: Array<{
    id: Id;
    name: string;
    subjectLine?: string;
    contentPreview?: string;
    recipients: number;
    conversions: number;
    rate: number;
    isControl: boolean;
    improvementOverControl: number;
  }>;
}

/* -------------------------------------------------------------- segmentation */

export type SegmentStatus = 'active' | 'refreshing' | 'draft' | 'paused' | 'error';

export interface Segment extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  kind: 'dynamic' | 'static' | 'lookalike';
  entityType: 'contact' | 'lead' | 'account';
  status: SegmentStatus;
  memberCount: number;
  /** Tree so the builder can render nested AND/OR groups. */
  definition: SegmentDefinition;
  /** Static lists keep explicit membership. */
  memberIds?: Id[];
  lastRefreshedAt?: ISODateTimeString;
  refreshCadence: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  usedInCampaignIds: Id[];
  ownerId: Id;
  tags: Tag[];
  /** Breakdown preview shown next to the builder so users can sanity-check a segment. */
  preview?: SegmentPreview;
}

export interface SegmentDefinition {
  conjunction: 'and' | 'or';
  rules: SegmentRule[];
}

export interface SegmentRule {
  id: Id;
  /** Field paths map to the contact/lead field catalogue. */
  field: string;
  label: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'between'
    | 'in_list'
    | 'not_in_list'
    | 'is_set'
    | 'is_not_set'
    | 'has_activity_in_last'
    | 'has_no_activity_in_last'
    | 'is_in_segment'
    | 'is_not_in_segment';
  value?: string | number | boolean | string[] | { from?: string; to?: string } | { days: number };
  /** Nested groups enable "(A and B) or (C and D)". */
  nested?: SegmentDefinition;
}

export interface SegmentPreview {
  total: number;
  byCountry: Array<{ label: string; count: number }>;
  byLifecycleStage: Array<{ label: string; count: number; tone: Tone }>;
  byIndustry: Array<{ label: string; count: number }>;
  byConsent: Array<{ label: string; count: number }>;
  sample: Array<{ id: Id; label: string; subtitle?: string; contactId?: Id }>;
}

export interface MailingList extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  // Lists and segments overlap in every real CRM; keeping both mirrors reality.
  segmentIds: Id[];
  staticMemberIds: Id[];
  subscriberCount: number;
  confirmedSubscribers: number;
  unsubscribedCount: number;
  bouncedCount: number;
  doubleOptIn: boolean;
  subscriptionPreferenceCenterId?: Id;
  isPublic: boolean;
}

/* ------------------------------------------------------- email + templates */

export interface EmailTemplate extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  category: 'newsletter' | 'promotional' | 'transactional' | 'nurture' | 'announcement' | 'onboarding' | 'other';
  subject: string;
  preheader?: string;
  /** Blocks make the template editable in a structured editor. */
  blocks: EmailBlock[];
  thumbnailTone: Tone;
  isShared: boolean;
  usedInCampaignCount: number;
  brandKitApplied: boolean;
  /** Rendering is local preview HTML only. */
  renderMode: 'demo_preview';
}

export type EmailBlockType =
  | 'heading'
  | 'paragraph'
  | 'image_placeholder'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'columns'
  | 'social_links'
  | 'product_card'
  | 'quote'
  | 'footer'
  | 'unsubscribe'
  | 'merge_tag';

export interface EmailBlock {
  id: Id;
  type: EmailBlockType;
  /** Content shape depends on type; the editor validates per type. */
  content: Record<string, unknown>;
  styles?: Record<string, string>;
  padding?: { top: number; right: number; bottom: number; left: number };
  backgroundColor?: string;
  visible: boolean;
}

/* ---------------------------------------------------------------- journeys */

export type JourneyStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Journey extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  status: JourneyStatus;
  entryType: 'segment' | 'form' | 'manual' | 'api_event' | 'deal_stage' | 'ticket_created';
  entrySegmentId?: Id;
  entryFormId?: Id;
  reEntryRule: 'never' | 'once_after_exit' | 'always' | 'after_delay';
  reEntryDelayDays?: number;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  goalDefinition?: { metric: 'purchase' | 'meeting' | 'form_submit' | 'stage_reached'; targetLabel: string };
  /** Aggregate path performance for the analytics overlay on the canvas. */
  stats: {
    entered: number;
    active: number;
    completed: number;
    goalReached: number;
    exited: number;
    completionRate: number;
    conversionRate: number;
  };
  ownerId: Id;
}

export type JourneyNodeKind =
  | 'trigger'
  | 'action_email'
  | 'action_sms'
  | 'action_whatsapp'
  | 'action_task'
  | 'action_webhook_placeholder'
  | 'action_field_update'
  | 'action_assign'
  | 'condition'
  | 'branch'
  | 'delay'
  | 'goal'
  | 'exit'
  | 'ab_split'
  | 'wait_until_event';

export interface JourneyNode {
  id: Id;
  kind: JourneyNodeKind;
  label: string;
  description?: string;
  /** Canvas coordinates persisted so layouts survive reloads. */
  position: { x: number; y: number };
  config: JourneyNodeConfig;
  /** The node where enrolment begins. Exactly one per journey. */
  isEntry?: boolean;
  /** A node with no outgoing path. */
  isTerminal?: boolean;
  stats?: { entered: number; completed: number; branched: number; failed: number };
}

export interface JourneyNodeConfig {
  templateId?: Id;
  segmentIds?: Id[];
  waitDays?: number;
  waitUntilTime?: string;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  branches?: Array<{ id: Id; label: string; tone: Tone }>;
  assignmentTargetIds?: Id[];
  fieldUpdates?: Array<{ field: string; value: string }>;
  splitPercentages?: [number, number];
  webhookPlaceholderNote?: string;
  /** Task nodes reference the same shape the workflow engine uses. */
  task?: { title: string; description: string; assignToKind: string; dueInDays: number; priority: string };
  /** Condition nodes reuse the workflow condition group. */
  conditionGroup?: { id: string; conjunction: 'and' | 'or'; negate: boolean; rules: Array<{ id: string; field: string; fieldLabel: string; fieldType: string; operator: string; value: string | number | boolean }> };
}

export interface JourneyEdge {
  id: Id;
  fromNodeId: Id;
  toNodeId: Id;
  /** Outgoing port on the source node; conditions and branches have several. */
  fromPort?: string;
  label?: string;
  tone?: Tone;
}

/* ------------------------------------------------------------------- forms */

export interface CaptureForm extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  status: 'draft' | 'published' | 'unpublished';
  fields: FormField[];
  submitAction: {
    kind: 'create_lead' | 'create_contact' | 'add_to_segment' | 'enroll_in_journey' | 'notify_owner';
    segmentId?: Id;
    journeyId?: Id;
    ownerId?: Id;
    /** Consent capture is explicit and never preselected. */
    requireConsent: boolean;
    consentText?: string;
  };
  /** Honest configuration: nothing posts anywhere in this build. */
  integrationState: 'demo_only';
  submissions: number;
  conversionRate: number;
  views: number;
  lastSubmissionAt?: ISODateTimeString;
  redirectUrlPlaceholder?: string;
  utmPassthrough: boolean;
}

export interface FormField {
  id: Id;
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'number' | 'country' | 'company' | 'hidden' | 'consent';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: { minLength?: number; maxLength?: number; pattern?: string; min?: number; max?: number };
  width: 'full' | 'half' | 'third';
  sortOrder: number;
  hiddenValue?: string;
}

/* ----------------------------------------------------------- landing pages */

export interface LandingPage extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  /** Section-based composition so the builder can offer a structured canvas. */
  sections: LandingPageSection[];
  formId?: Id;
  campaignId?: Id;
  seo: { title?: string; description?: string; ogImagePlaceholder?: string; noIndex: boolean };
  theme: { layout: 'centered' | 'split' | 'full_width' | 'sidebar'; heroStyle: 'gradient' | 'solid' | 'image_placeholder'; accentPresetId?: string };
  views: number;
  submissions: number;
  conversionRate: number;
  /** Published pages are stored as static representation only; no hosting exists. */
  hostingState: 'demo_not_hosted';
  publishedAt?: ISODateTimeString;
}

export interface LandingPageSection {
  id: Id;
  type: 'hero' | 'value_props' | 'feature_grid' | 'testimonial_placeholder' | 'logos_placeholder' | 'form' | 'faq' | 'cta' | 'countdown_placeholder' | 'video_placeholder' | 'stats' | 'steps';
  heading?: string;
  subheading?: string;
  body?: string;
  items?: Array<{ id: Id; title?: string; description?: string; icon?: string }>;
  backgroundColor?: string;
  visible: boolean;
  sortOrder: number;
}

/* -------------------------------------------------------------- attribution */

export interface AttributionRow {
  touchpointId: Id;
  label: string;
  kind: 'campaign' | 'channel' | 'content' | 'referrer' | 'event' | 'direct';
  touches: number;
  firstTouchDeals: number;
  lastTouchDeals: number;
  linearDeals: number;
  attributedRevenue: Money;
  attributedPipeline: Money;
  costPerAcquisition?: Money;
  roi?: number;
}

export interface AttributionReport {
  model: AttributionModel;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  currency: CurrencyCode;
  totalRevenue: Money;
  totalDeals: number;
  rows: AttributionRow[];
  /** Multi-touch paths, in order, with conversion counts. */
  topPaths: Array<{ path: string[]; conversions: number; revenue: Money }>;
  byModel: Array<{ model: AttributionModel; revenue: Money; dealCount: number }>;
}

export interface CampaignCalendarEntry {
  id: Id;
  campaignId: Id;
  campaignName: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: ISODateString;
  endDate?: ISODateString;
  channel: string;
  ownerName: string;
  tone: Tone;
  /** Clicking an entry opens the matching campaign or activity. */
  href: string;
}

export interface MarketingOverview {
  currency: CurrencyCode;
  periodLabel: string;
  metrics: {
    leads: number;
    mqls: number;
    sqls: number;
    opportunities: number;
    customers: number;
    revenue: Money;
    spend: Money;
    roi: number;
    costPerLead: Money;
    costPerAcquisition: Money;
  };
  trend: Array<{ date: ISODateString; leads: number; mqls: number; revenue: number; spend: number }>;
  byChannel: Array<{ channel: string; leads: number; revenue: number; spend: number; roi: number }>;
  byCampaign: Array<{ campaignId: Id; name: string; leads: number; revenue: number; roi: number; status: CampaignStatus }>;
  funnel: Array<{ label: string; count: number; conversionFromPrevious: number }>;
  topContent: Array<{ id: Id; title: string; type: string; views: number; conversions: number }>;
}
