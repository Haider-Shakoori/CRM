/**
 * Customer support: tickets, SLA policy, knowledge base, canned responses,
 * surveys and the customer-facing portal.
 */

import type { Auditable, FileRef, Id, ISODateString, ISODateTimeString, Money, Tag, Tone } from './common';

/* ----------------------------------------------------------------- tickets */

export type TicketStatus = 'new' | 'open' | 'pending_customer' | 'pending_internal' | 'on_hold' | 'resolved' | 'closed' | 'reopened';

export type TicketPriority = 'critical' | 'high' | 'normal' | 'low';

export type TicketChannel = 'email' | 'web_portal' | 'phone' | 'chat' | 'social' | 'api' | 'internal' | 'field_visit';

export interface Ticket extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  /** Who reported it. A ticket may be from a contact or an internal reporter. */
  requesterId?: Id;
  requesterName: string;
  requesterEmail?: string;
  accountId?: Id;
  accountName?: string;
  contactId?: Id;
  /** Classification drives routing and reporting. */
  categoryId?: Id;
  categoryLabel?: string;
  subCategoryLabel?: string;
  type: 'question' | 'incident' | 'problem' | 'feature_request' | 'bug' | 'billing' | 'how_to' | 'other';
  severity?: 'blocker' | 'major' | 'minor' | 'cosmetic';
  /** Assignment */
  assigneeId?: Id;
  assigneeName?: string;
  teamId?: Id;
  groupId?: Id;
  queueId?: Id;
  /** SLA */
  slaPolicyId?: Id;
  firstResponseDueAt?: ISODateTimeString;
  firstRespondedAt?: ISODateTimeString;
  nextResponseDueAt?: ISODateTimeString;
  resolutionDueAt?: ISODateTimeString;
  resolvedAt?: ISODateTimeString;
  closedAt?: ISODateTimeString;
  escalatedAt?: ISODateTimeString;
  escalationLevel: number;
  /** Timers are computed, not stored twice, so the two views never disagree. */
  slaState?: 'on_track' | 'at_risk' | 'breached' | 'met' | 'not_applicable';
  /** Relationships */
  relatedTicketIds: Id[];
  parentTicketId?: Id;
  dealId?: Id;
  contractId?: Id;
  productId?: Id;
  assetId?: Id;
  /** Knowledge */
  kbArticleIds: Id[];
  resolutionSummary?: string;
  rootCause?: string;
  tags: Tag[];
  messageCount: number;
  attachmentCount: number;
  satisfaction?: CustomerSatisfaction;
  reopenCount: number;
  impactedUsers?: number;
  customFields: Record<string, unknown>;
}

export interface TicketMessage {
  id: Id;
  ticketId: Id;
  kind: 'reply' | 'internal_note' | 'system' | 'customer_reply' | 'forward';
  authorId?: Id;
  authorName: string;
  authorKind: 'agent' | 'customer' | 'system';
  body: string;
  attachments: FileRef[];
  createdAt: ISODateTimeString;
  isFromCustomer: boolean;
  /** Outbound replies are simulated; the UI states this. */
  delivery?: { state: 'draft' | 'simulated_sent' | 'failed'; simulated: true };
  timeSpentMinutes?: number;
}

export interface TicketCategory {
  id: Id;
  organizationId: Id;
  name: string;
  parentId?: Id;
  description?: string;
  defaultPriority: TicketPriority;
  defaultAssigneeTeamId?: Id;
  slaPolicyId?: Id;
  isActive: boolean;
  ticketCount: number;
  avgResolutionHours: number;
  tone: Tone;
}

export interface SlaPolicy extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  /** Applies to tickets matching any of these conditions. */
  conditions: Array<{ field: string; operator: string; value: string }>;
  /** Targets are in business hours where the calendar says so. */
  targets: Array<{
    priority: TicketPriority;
    firstResponseMinutes: number;
    resolutionMinutes: number;
    /** Which calendar the clock follows. */
    calendar: '24x7' | 'business_hours' | 'custom';
    businessHoursId?: Id;
  }>;
  escalationRules: SlaEscalationRule[];
  pauseOnStatuses: TicketStatus[];
  isActive: boolean;
  isDefault: boolean;
  ticketsTotal: number;
  ticketsBreached: number;
  compliancePercent: number;
}

export interface SlaEscalationRule {
  id: Id;
  name: string;
  /** Percentage of the target elapsed before firing. */
  triggerAtPercent: number;
  triggerOn: 'first_response' | 'next_response' | 'resolution';
  actions: Array<{ kind: 'notify_user' | 'notify_team' | 'notify_manager' | 'raise_priority' | 'reassign' | 'add_tag'; targetId?: Id; value?: string }>;
  enabled: boolean;
  order: number;
  firedCount: number;
}

export interface BusinessHours {
  id: Id;
  organizationId: Id;
  name: string;
  timezone: string;
  /** 0 = Sunday. Multiple windows per day are allowed. */
  windows: Array<{ day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start: string; end: string }>;
  holidays: Array<{ date: ISODateString; label: string }>;
  isDefault: boolean;
}

export interface SupportQueue {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  memberIds: Id[];
  teamId?: Id;
  ticketCount: number;
  overdueCount: number;
  priority: TicketPriority;
  tone: Tone;
  isActive: boolean;
}

/* ---------------------------------------------------------------- knowledge */

export interface KbCategory {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  parentId?: Id;
  icon?: string;
  sortOrder: number;
  visibility: 'internal' | 'public' | 'both';
  articleCount: number;
  tone: Tone;
}

export interface KbArticle extends Auditable {
  id: Id;
  organizationId: Id;
  title: string;
  slug: string;
  /** Both internal help and public portal content live here. */
  scope: 'internal' | 'public';
  categoryId: Id;
  categoryLabel: string;
  summary: string;
  /** Structured blocks rather than raw HTML so rendering is safe. */
  blocks: KbBlock[];
  status: 'draft' | 'in_review' | 'published' | 'archived';
  visibility: 'organization' | 'team' | 'public';
  authorId: Id;
  authorName: string;
  reviewerId?: Id;
  reviewDueAt?: ISODateString;
  publishedAt?: ISODateTimeString;
  version: number;
  language: string;
  tags: Tag[];
  views: number;
  helpfulCount: number;
  notHelpfulCount: number;
  /** Correlation with tickets proves article value without inventing testimonials. */
  linkedTicketCount: number;
  relatedArticleIds: Id[];
}

export type KbBlock =
  | { id: Id; type: 'heading'; level: 2 | 3 | 4; text: string }
  | { id: Id; type: 'paragraph'; text: string }
  | { id: Id; type: 'list'; ordered: boolean; items: string[] }
  | { id: Id; type: 'callout'; tone: 'info' | 'warning' | 'success' | 'danger'; text: string }
  | { id: Id; type: 'code'; language: string; code: string }
  | { id: Id; type: 'image_placeholder'; alt: string; caption?: string }
  | { id: Id; type: 'table'; headers: string[]; rows: string[][] }
  | { id: Id; type: 'steps'; items: string[] }
  | { id: Id; type: 'video_placeholder'; caption: string }
  | { id: Id; type: 'divider' };

/* --------------------------------------------------------------- surveys */

export interface CustomerSatisfaction {
  id: Id;
  ticketId: Id;
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  submittedAt: ISODateTimeString;
  agentId?: Id;
  agentName?: string;
  channel: string;
}

export interface Survey extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  kind: 'csat' | 'nps' | 'ces';
  status: 'draft' | 'active' | 'paused' | 'completed';
  trigger: 'ticket_resolved' | 'ticket_closed' | 'manual' | 'scheduled' | 'after_purchase' | 'after_onboarding';
  delayMinutes?: number;
  question: string;
  followUpQuestion?: string;
  thanksMessage?: string;
  /** Distribution of collected scores; sample content is labelled as such. */
  responses: Array<{ id: Id; score: number; comment?: string; submittedAt: ISODateTimeString; contactLabel?: string; agentName?: string }>;
  responseCount: number;
  averageScore: number;
  npsScore?: number;
  responseRate: number;
  sentCount: number;
  byAgent?: Array<{ agentId: Id; name: string; responses: number; average: number }>;
  trend: Array<{ date: ISODateString; responses: number; average: number }>;
}

/* -------------------------------------------------------------- portal */

export interface PortalSettings {
  organizationId: Id;
  enabled: boolean;
  subdomainPlaceholder: string;
  displayName: string;
  welcomeMessage: string;
  logoUrl?: string;
  accentPresetId?: string;
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  /** Which features are exposed to customers. */
  features: {
    ticketSubmission: boolean;
    ticketTracking: boolean;
    knowledgeBase: boolean;
    projects: boolean;
    documents: boolean;
    contracts: boolean;
    appointments: boolean;
    communicationHistory: boolean;
    profileSettings: boolean;
  };
  supportedLanguages: string[];
  /** Never presented as hosted or deployed in this build. */
  hostingState: 'demo_not_hosted';
}

export interface PortalAuthPreview {
  organizationId: Id;
  organizationName: string;
  mode: 'sign_in' | 'register' | 'magic_link_placeholder';
  branding: { displayName: string; accentPresetId?: string; logoUrl?: string };
  /** Honest labelling for the simulated portal login. */
  simulated: true;
}

/* --------------------------------------------------------------- analytics */

export interface SupportOverview {
  currency: Money;
  periodLabel: string;
  metrics: {
    openTickets: number;
    newToday: number;
    unassigned: number;
    overdue: number;
    breachRate: number;
    avgFirstResponseMinutes: number;
    avgResolutionHours: number;
    firstContactResolutionPercent: number;
    reopenRate: number;
    csat: number;
    backlogTrend: number;
  };
  byStatus: Array<{ status: TicketStatus; label: string; count: number; tone: Tone }>;
  byPriority: Array<{ priority: TicketPriority; label: string; count: number; tone: Tone }>;
  byChannel: Array<{ channel: TicketChannel; label: string; count: number }>;
  byCategory: Array<{ categoryId: Id; label: string; count: number; avgResolutionHours: number }>;
  volumeTrend: Array<{ date: ISODateString; created: number; resolved: number; backlog: number }>;
  slaTrend: Array<{ date: ISODateString; compliancePercent: number; breaches: number }>;
  agentPerformance: Array<{
    userId: Id;
    name: string;
    assigned: number;
    resolved: number;
    avgResolutionHours: number;
    firstResponseMinutes: number;
    csat: number;
    slaCompliancePercent: number;
    ticketsReopened: number;
  }>;
  csatTrend: Array<{ date: ISODateString; score: number; responses: number }>;
  csatDistribution: Array<{ score: number; label: string; count: number }>;
  topIssues: Array<{ label: string; count: number; trend: number; avgResolutionHours: number }>;
}
