/**
 * Collaboration, notifications, documents and file management.
 *
 * No file storage, signing or document verification exists. Every artefact here is
 * metadata plus a generated placeholder so the UI is honest about its state.
 */

import type { Auditable, FileRef, Id, ISODateString, ISODateTimeString, Tag, Tone } from './common';

/* ---------------------------------------------------------------- feed */

export type FeedItemKind =
  | 'record_created'
  | 'field_changed'
  | 'stage_changed'
  | 'note_added'
  | 'comment'
  | 'mention'
  | 'task_created'
  | 'task_completed'
  | 'attachment_added'
  | 'email_logged'
  | 'call_logged'
  | 'meeting_logged'
  | 'deal_won'
  | 'deal_lost'
  | 'ticket_created'
  | 'ticket_resolved'
  | 'workflow_run'
  | 'campaign_launched'
  | 'user_joined'
  | 'announcement'
  | 'document_shared'
  | 'approval_requested'
  | 'approval_granted'
  | 'goal_updated'
  | 'custom';

export interface FeedItem {
  id: Id;
  organizationId: Id;
  kind: FeedItemKind;
  /** Who caused it. Automation and integrations are distinguished from people. */
  actorKind: 'user' | 'system' | 'automation' | 'integration' | 'customer';
  actorId?: Id;
  actorName: string;
  actorInitials: string;
  actorAvatarUrl?: string;
  summary: string;
  detail?: string;
  changes?: Array<{ field: string; label: string; before?: string; after?: string }>;
  relatedRecords: Array<{ type: string; id: Id; label: string; route: string }>;
  /** Visibility controls where the item appears. */
  scope: 'record' | 'team' | 'organization' | 'private';
  teamId?: Id;
  createdAt: ISODateTimeString;
  isPinned: boolean;
  reactions: Array<{ emoji: string; users: Array<{ id: Id; name: string }> }>;
  commentCount: number;
  /** Simulated automation results are visually marked in the feed. */
  simulated?: boolean;
}

export interface Comment extends Auditable {
  id: Id;
  organizationId: Id;
  parentType: 'record' | 'feed_item' | 'task' | 'document' | 'workflow' | 'report' | 'dashboard';
  parentId: Id;
  body: string;
  authorId: Id;
  authorName: string;
  authorInitials: string;
  authorAvatarUrl?: string;
  mentions: Array<{ userId: Id; name: string; notified: boolean }>;
  reactions: Array<{ emoji: string; users: Array<{ id: Id; name: string }> }>;
  replies: Comment[];
  isResolved: boolean;
  isInternal: boolean;
  attachments: FileRef[];
  editedAt?: ISODateTimeString;
}

export interface Notification {
  id: Id;
  organizationId: Id;
  userId: Id;
  kind:
    | 'assignment'
    | 'mention'
    | 'comment_reply'
    | 'task_due'
    | 'task_overdue'
    | 'approval_request'
    | 'approval_result'
    | 'deal_won'
    | 'deal_at_risk'
    | 'deal_stage_changed'
    | 'lead_assigned'
    | 'lead_unresponded'
    | 'ticket_assigned'
    | 'ticket_escalated'
    | 'ticket_sla_breach'
    | 'mention_in_note'
    | 'workflow_failed'
    | 'import_completed'
    | 'export_ready'
    | 'report_scheduled'
    | 'subscription_renewal'
    | 'billing_event'
    | 'security_alert'
    | 'new_device_login'
    | 'announcement'
    | 'goal_milestone'
    | 'document_shared'
    | 'system';
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  relatedRoute?: string;
  relatedId?: Id;
  actorName?: string;
  actorInitials?: string;
  createdAt: ISODateTimeString;
  readAt?: ISODateTimeString;
  /** Which delivery channels were used. Email/push are simulated. */
  channels: { inApp: boolean; emailSimulated: boolean; mobilePushSimulated: boolean };
  requiresAction: boolean;
  actionLabel?: string;
  /** Digest grouping, as a real product would batch low-priority items. */
  groupKey?: string;
}

export interface Announcement extends Auditable {
  id: Id;
  organizationId?: Id;
  /** Platform-wide announcements come from the SaaS owner. */
  scope: 'platform' | 'organization';
  title: string;
  body: string;
  tone: Tone;
  severity: 'info' | 'success' | 'warning' | 'critical';
  /** Where it appears. */
  placement: Array<'in_app_banner' | 'notification_center' | 'login_page' | 'marketing_site_banner' | 'email_placeholder'>;
  audience: { kind: 'all' | 'role' | 'team' | 'persona'; ids?: Id[] };
  startAt: ISODateTimeString;
  endAt?: ISODateTimeString;
  isDismissible: boolean;
  requiresAcknowledgement: boolean;
  ctaLabel?: string;
  ctaRoute?: string;
  state: 'draft' | 'scheduled' | 'active' | 'ended';
  acknowledgedCount: number;
  targetCount: number;
}

export interface TeamSpace extends Auditable {
  id: Id;
  organizationId: Id;
  teamId: Id;
  name: string;
  description?: string;
  memberIds: Id[];
  pinnedRecordIds: Id[];
  pinnedDocumentIds: Id[];
  goals: Array<{ id: Id; label: string; target: string; progress: number; tone: Tone }>;
  isPrivate: boolean;
  lastActivityAt?: ISODateTimeString;
}

export interface MentionSummary {
  id: Id;
  userId: Id;
  mentionedById: Id;
  mentionedByName: string;
  contextLabel: string;
  contextRoute: string;
  excerpt: string;
  createdAt: ISODateTimeString;
  read: boolean;
  replied: boolean;
}

/* ---------------------------------------------------------------- documents */

export interface DocumentFolder extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  parentId?: Id;
  path: string;
  kind: 'folder' | 'template_library' | 'shared' | 'private' | 'contracts' | 'proposals' | 'attachments';
  ownerId?: Id;
  visibility: 'organization' | 'team' | 'private';
  allowedRoleIds?: Id[];
  fileCount: number;
  totalSizeBytes: number;
  tone: Tone;
}

export interface DocumentFile extends Auditable {
  id: Id;
  organizationId: Id;
  folderId: Id;
  folderPath: string;
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  /** No content is stored; a generated preview stands in for the real file. */
  storage: { state: 'placeholder'; simulated: true; note: string };
  version: number;
  versionCount: number;
  checksumPlaceholder: string;
  ownerId: Id;
  ownerName: string;
  visibility: 'organization' | 'team' | 'private' | 'customer_portal';
  allowedRoleIds?: Id[];
  tags: Tag[];
  description?: string;
  /** Association matrix so a document can relate to many records. */
  associations: Array<{ type: 'account' | 'contact' | 'deal' | 'ticket' | 'contract' | 'project' | 'campaign' | 'quote'; id: Id; label: string }>;
  isFavorite: boolean;
  shareLinks: Array<{ id: Id; label: string; expiresAt?: ISODateTimeString; passwordProtected: boolean; placeholder: true; lastAccessedAt?: ISODateTimeString }>;
  downloadCount: number;
  viewCount: number;
  lastViewedAt?: ISODateTimeString;
  /** E-signature state is a workflow preview; nothing is legally executed. */
  signatureState?: 'not_required' | 'draft' | 'sent_simulated' | 'partially_signed_simulated' | 'completed_simulated' | 'declined';
  retentionUntil?: ISODateString;
}

export interface DocumentVersion {
  id: Id;
  documentId: Id;
  version: number;
  sizeBytes: number;
  createdAt: ISODateTimeString;
  createdByName: string;
  changeNote?: string;
  isCurrent: boolean;
  /** Restoring produces a new version rather than destroying history. */
  restorable: boolean;
}

export interface DocumentTemplate extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  category: 'proposal' | 'quote' | 'contract' | 'nda' | 'statement_of_work' | 'onboarding' | 'invoice_reference' | 'report' | 'letter' | 'other';
  description: string;
  /** Structured section outline; no document generation engine exists. */
  sections: Array<{ id: Id; title: string; guidance?: string; mergeFields: string[] }>;
  mergeFields: Array<{ key: string; label: string; source: string; fallback?: string }>;
  language: string;
  usedCount: number;
  isShared: boolean;
  outputFormats: Array<'pdf_placeholder' | 'docx_placeholder'>;
}

export interface SignatureWorkflowPreview {
  id: Id;
  documentId: Id;
  documentName: string;
  status: 'not_started' | 'draft' | 'sent' | 'viewed' | 'partially_signed' | 'completed' | 'declined' | 'expired';
  /** Every step is a UI simulation; no signature is captured. */
  simulated: true;
  wordingDisclaimer: string;
  signers: Array<{
    id: Id;
    name: string;
    email: string;
    kind: 'internal' | 'customer';
    order: number;
    required: boolean;
    status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
    signedAt?: ISODateTimeString;
  }>;
  fields: Array<{ id: Id; signerId: Id; kind: 'signature' | 'initials' | 'date' | 'text'; page: number; x: number; y: number }>;
  auditTrail: Array<{ at: ISODateTimeString; event: string; actor: string; note?: string }>;
  expiresAt?: ISODateTimeString;
}

export interface FileUploadTask {
  id: Id;
  file: FileRef;
  progress: number;
  state: 'queued' | 'validating' | 'uploading' | 'scanning_placeholder' | 'complete' | 'failed' | 'cancelled';
  errorMessage?: string;
  /** Mock uploads resolve locally; no bytes leave the browser. */
  transport: 'local_simulation';
  startedAt: ISODateTimeString;
  finishedAt?: ISODateTimeString;
  targetFolderId?: Id;
  checks: { size: boolean; type: boolean; malwareScan: 'not_performed' };
}
