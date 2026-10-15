/**
 * Unified communications: inbox, conversations, messages, calls and templates.
 *
 * The whole module is simulated. `delivery` states exist so the UI can be honest
 * about the fact that nothing is transmitted.
 */

import type { Auditable, FileRef, Id, ISODateTimeString, Tag, Tone } from './common';

export type CommChannel = 'email' | 'sms' | 'whatsapp' | 'live_chat' | 'web_chat' | 'social' | 'phone' | 'internal';
export type SocialNetwork = 'linkedin' | 'facebook' | 'instagram' | 'x' | 'tiktok' | 'youtube' | 'other';

export type ConversationStatus = 'open' | 'pending' | 'snoozed' | 'resolved' | 'closed' | 'spam';

export interface SharedInbox extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  address: string;
  channel: CommChannel;
  description?: string;
  /** Routing is described, not enforced: assignment rules are a UI concept here. */
  assignmentStrategy: 'manual' | 'round_robin' | 'least_busy' | 'by_territory' | 'by_language';
  memberIds: Id[];
  defaultAssigneeId?: Id;
  signatureId?: Id;
  businessHoursId?: Id;
  slaPolicyId?: Id;
  autoReplyTemplateId?: Id;
  tone: Tone;
  unreadCount: number;
  openCount: number;
  isActive: boolean;
}

export interface Conversation extends Auditable {
  id: Id;
  organizationId: Id;
  subject: string;
  channel: CommChannel;
  socialNetwork?: SocialNetwork;
  inboxId: Id;
  inboxName: string;
  status: ConversationStatus;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  /** Participants include internal users and external contacts. */
  participants: Array<{
    id: Id;
    kind: 'internal' | 'external';
    name: string;
    handle: string;
    contactId?: Id;
    userId?: Id;
    avatarUrl?: string;
  }>;
  /** Links to whichever CRM records this thread is about. */
  relatedRecords: Array<{ type: 'contact' | 'account' | 'deal' | 'ticket' | 'lead' | 'order' | 'project'; id: Id; label: string }>;
  assigneeId?: Id;
  assigneeName?: string;
  teamId?: Id;
  tags: Tag[];
  messageCount: number;
  unreadCount: number;
  /** SLA clock presentation. */
  firstResponseDueAt?: ISODateTimeString;
  firstRespondedAt?: ISODateTimeString;
  nextResponseDueAt?: ISODateTimeString;
  resolutionDueAt?: ISODateTimeString;
  resolvedAt?: ISODateTimeString;
  snoozedUntil?: ISODateTimeString;
  lastMessageAt: ISODateTimeString;
  lastMessagePreview: string;
  hasAttachments: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  /** Deterministic conversation summary produced by the demo template engine. */
  summary?: string;
  isStarred: boolean;
}

export interface MessageBase extends Auditable {
  id: Id;
  conversationId: Id;
  direction: 'inbound' | 'outbound' | 'internal_note';
  authorKind: 'internal' | 'external' | 'system';
  authorId?: Id;
  authorName: string;
  authorHandle?: string;
  channel: CommChannel;
  body: string;
  bodyFormat: 'plain' | 'html' | 'markdown';
  attachments?: FileRef[];
  delivery: MessageDelivery;
  isRead: boolean;
  /** Internal notes are never sent; the UI labels them clearly. */
  isInternalOnly?: boolean;
}

export interface MessageDelivery {
  state: 'draft' | 'queued' | 'simulated_sent' | 'simulated_delivered' | 'simulated_read' | 'failed' | 'bounced';
  /** Honest labelling is mandatory for this module. */
  simulated: true;
  note?: string;
  failureReason?: string;
  at?: ISODateTimeString;
}

export interface EmailMessage extends MessageBase {
  channel: 'email';
  from: { name: string; address: string };
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  bcc?: Array<{ name?: string; address: string }>;
  subject: string;
  /** Threading headers are modelled so the UI can group without a real mailbox. */
  inReplyTo?: string;
  references?: string[];
  opens?: { count: number; lastAt?: ISODateTimeString; trackingEnabled: boolean };
  clicks?: { count: number; lastAt?: ISODateTimeString };
}

export interface ChatMessage extends MessageBase {
  channel: 'live_chat' | 'web_chat';
  /** Chat transcripts render as a bubble stream rather than an email thread. */
  visitor?: {
    id: Id;
    displayName: string;
    location?: string;
    browser?: string;
    currentPage?: string;
    sessionStartedAt: ISODateTimeString;
    ipMasked?: string;
  };
  typing?: boolean;
}

export interface SocialMessage extends MessageBase {
  channel: 'social';
  network: SocialNetwork;
  postUrlPlaceholder?: string;
  /** Social responses are reviewable before sending in the real product. */
  requiresApproval: boolean;
  approvedById?: Id;
}

export interface CallRecord extends Auditable {
  id: Id;
  organizationId: Id;
  direction: 'inbound' | 'outbound' | 'missed';
  /** No telephony provider is connected — every call is a recording of intent. */
  simulated: true;
  fromNumberMasked: string;
  toNumberMasked: string;
  contactId?: Id;
  contactName?: string;
  accountId?: Id;
  accountName?: string;
  userId: Id;
  userName: string;
  startedAt: ISODateTimeString;
  durationSeconds: number;
  outcome: 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'failed' | 'wrong_number';
  disposition?: string;
  recordingPlaceholder?: { available: boolean; note: string };
  transcript?: Array<{ atSeconds: number; speaker: 'agent' | 'customer'; text: string }>;
  /** Deterministic summary + next steps from the demo template engine. */
  aiSummaryDemo?: { summary: string; actionItems: string[]; sentiment: 'positive' | 'neutral' | 'negative' };
  notes?: string;
  relatedDealId?: Id;
  tags: Tag[];
}

export interface MeetingRecord extends Auditable {
  id: Id;
  organizationId: Id;
  title: string;
  provider: 'in_person' | 'phone' | 'video_conference_demo';
  simulated: true;
  accountId?: Id;
  accountName?: string;
  attendees: Array<{ id: Id; name: string; email?: string; kind: 'internal' | 'external'; attended: boolean }>;
  scheduledAt: ISODateTimeString;
  durationMinutes: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  agenda?: string;
  notes?: string;
  actionItems?: Array<{ id: Id; text: string; ownerId?: Id; ownerName?: string; dueDate?: string; done: boolean }>;
  recordingPlaceholder?: { available: boolean; note: string };
  aiSummaryDemo?: { summary: string; decisions: string[]; risks: string[] };
  relatedRecords: Array<{ type: string; id: Id; label: string }>;
}

export type TemplateKind = 'email' | 'sms' | 'whatsapp' | 'chat' | 'social';

export interface MessageTemplate extends Auditable {
  id: Id;
  organizationId: Id;
  kind: TemplateKind;
  name: string;
  subject?: string;
  body: string;
  /** Variables are declared so the composer can validate before rendering. */
  variables: Array<{
    key: string;
    label: string;
    fallback?: string;
    /** Merged from the linked CRM record at render time. */
    source:
      | 'contact.first_name'
      | 'contact.last_name'
      | 'contact.job_title'
      | 'account.name'
      | 'deal.name'
      | 'deal.amount'
      | 'owner.name'
      | 'organization.name'
      | 'ticket.reference'
      | 'custom';
  }>;
  folder?: string;
  sharedWithTeamIds: Id[];
  usageCount: number;
  lastUsedAt?: ISODateTimeString;
  isActive: boolean;
  /** HTML is sanitised at render; the preview never executes script. */
  category: 'follow_up' | 'introduction' | 'proposal' | 'reminder' | 'renewal' | 'support' | 'marketing' | 'internal' | 'other';
}

export interface CannedResponse extends Auditable {
  id: Id;
  organizationId: Id;
  title: string;
  shortcut: string;
  body: string;
  category?: string;
  scope: 'personal' | 'team' | 'organization';
  teamIds?: Id[];
  usageCount: number;
  isActive: boolean;
}

export interface ConversationAssignmentRule {
  id: Id;
  inboxId: Id;
  name: string;
  /** Simulated evaluation only; ordering matters and is shown in the UI. */
  order: number;
  enabled: boolean;
  conditions: Array<{ field: string; operator: string; value: string }>;
  action: { kind: 'assign_user' | 'assign_team' | 'round_robin' | 'add_tag' | 'set_priority' | 'auto_reply'; targetId?: Id; value?: string };
  matchesLast30Days: number;
}

export interface CommChannelStatus {
  channel: CommChannel;
  label: string;
  /** Nothing is connected in the frontend build; every entry states this. */
  connectionState: 'not_configured' | 'demo';
  simulated: true;
  messagesLast30Days: number;
  responseTimeMinutes: number;
  note?: string;
}

export interface InboxMetrics {
  openConversations: number;
  unreadCount: number;
  awaitingReply: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  slaCompliancePercent: number;
  byChannel: Array<{ channel: CommChannel; open: number; avgResponseMinutes: number }>;
  volumeTrend: Array<{ label: string; inbound: number; outbound: number }>;
}
