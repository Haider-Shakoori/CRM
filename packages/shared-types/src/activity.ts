/**
 * Activities, tasks, calendar and sales-productivity primitives.
 *
 * An "activity" is anything a human did or must do. Tasks are activities with an
 * owner and a due date; meetings and calls carry richer payloads. Keeping one
 * base shape lets the timeline, the activity inbox and the calendar all read from
 * a single collection without special cases.
 */

import type {
  Auditable,
  FileRef,
  Id,
  ISODateString,
  ISODateTimeString,
  Money,
  Tone,
} from './common';

export type ActivityKind =
  | 'task'
  | 'call'
  | 'meeting'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'note'
  | 'chat'
  | 'social'
  | 'demo'
  | 'visit'
  | 'stage_change'
  | 'field_change'
  | 'system'
  | 'approval'
  | 'document'
  | 'payment'
  | 'signature';

export type ActivityStatus = 'open' | 'in_progress' | 'completed' | 'cancelled' | 'deferred';

export type ActivityPriority = 'urgent' | 'high' | 'normal' | 'low';

/** Polymorphic link so any record can host a timeline. */
export interface ActivitySubject {
  type:
    | 'lead'
    | 'contact'
    | 'account'
    | 'deal'
    | 'ticket'
    | 'campaign'
    | 'contract'
    | 'quote'
    | 'project'
    | 'partner'
    | 'renewal'
    | 'general';
  id: Id;
  label: string;
}

export interface Activity extends Auditable {
  id: Id;
  organizationId: Id;
  kind: ActivityKind;
  subject: string;
  /** Full record links so one activity can appear on several related timelines. */
  subjects: ActivitySubject[];
  body?: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  ownerId: Id;
  ownerName: string;
  createdByName?: string;
  dueAt?: ISODateTimeString;
  /** Date-only tasks avoid timezone drift in the "My Work" planner. */
  dueDate?: ISODateString;
  startAt?: ISODateTimeString;
  endAt?: ISODateTimeString;
  durationMinutes?: number;
  completedAt?: ISODateTimeString;
  completedById?: Id;
  outcome?: ActivityOutcome;
  /** Reminders are relative offsets in the real product; minutes here. */
  reminders?: Array<{ id: Id; minutesBefore: number; sent: boolean }>;
  attendees?: ActivityAttendee[];
  attachments?: FileRef[];
  checklist?: ChecklistItem[];
  /** Visibility drives the "private note" affordance without implying enforcement. */
  visibility: 'team' | 'private' | 'organization';
  tags?: string[];
  /** Present for logged emails so the timeline can show delivery state honestly. */
  delivery?: { state: 'drafted' | 'queued' | 'simulated_sent' | 'failed'; note?: string };
  isRecurring?: boolean;
  recurrenceRule?: string;
  /**
   * The mock layer marks generated/system entries so the UI can distinguish a real
   * user action from a simulated automation result.
   */
  source: 'user' | 'automation' | 'integration' | 'system';
  automationRunId?: Id;
}

export interface ActivityOutcome {
  disposition:
    | 'connected'
    | 'no_answer'
    | 'left_voicemail'
    | 'busy'
    | 'wrong_number'
    | 'rescheduled'
    | 'completed'
    | 'no_show'
    | 'cancelled_by_customer';
  sentiment?: 'positive' | 'neutral' | 'negative';
  summary?: string;
  nextStep?: string;
  followedUpAt?: ISODateTimeString;
}

export interface ActivityAttendee {
  id: Id;
  kind: 'internal' | 'external';
  name: string;
  email?: string;
  contactId?: Id;
  userId?: Id;
  status: 'accepted' | 'declined' | 'tentative' | 'awaiting' | 'organizer';
  isOrganizer?: boolean;
}

export interface ChecklistItem {
  id: Id;
  label: string;
  done: boolean;
  required?: boolean;
}

export interface Task extends Activity {
  kind: 'task';
  /** Task templates keep playbooks reusable across teams. */
  templateId?: Id;
  parentTaskId?: Id;
  subtaskIds?: Id[];
  estimateMinutes?: number;
  actualMinutes?: number;
  blockedBy?: Id[];
  isBlocked: boolean;
}

export interface CalendarEvent extends Activity {
  kind: 'meeting' | 'call' | 'demo' | 'visit';
  calendarId?: Id;
  /** Where the meeting happens; location or a simulated conferencing label. */
  location?: string;
  conferencing?: {
    provider: string;
    joinUrlPlaceholder: string;
    /** Never a real join link — the demo states this in the UI. */
    demoOnly: true;
  };
  /** Busy/free state powers the scheduling assistant mock. */
  showAs: 'busy' | 'free' | 'tentative' | 'out_of_office';
  organizerId: Id;
  isAllDay: boolean;
  /** Timezone of the organizer so cross-region meetings render correctly. */
  timezone: string;
  /** Proposed alternative slots produced by the mock scheduling helper. */
  suggestedSlots?: Array<{ startAt: ISODateTimeString; endAt: ISODateTimeString; conflicts: number }>;
}

export interface Calendar {
  id: Id;
  organizationId: Id;
  name: string;
  ownerId?: Id;
  kind: 'personal' | 'team' | 'shared' | 'resource';
  color: Tone;
  visible: boolean;
  isDefault: boolean;
  /** Shared calendars may be read-only for some roles. */
  permission: 'read' | 'write' | 'manage';
}

/* -------------------------------------------------------------- sequences */

export interface Sequence extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  /** Sequences target leads, contacts, or both. */
  targetType: 'lead' | 'contact';
  /** Steps are ordered; each has its own wait time. */
  steps: SequenceStep[];
  enrolledCount: number;
  activeCount: number;
  completedCount: number;
  replyRate: number;
  openRate: number;
  meetingRate: number;
  exitOnReply: boolean;
  exitOnMeeting: boolean;
  sendWindow?: { days: number[]; startHour: number; endHour: number; timezone: string };
  ownerId: Id;
  teamId?: Id;
}

export interface SequenceStep {
  id: Id;
  /** 1-based order shown in the builder. */
  order: number;
  kind: 'email' | 'call' | 'task' | 'linkedin' | 'sms' | 'whatsapp' | 'wait';
  name: string;
  /** Wait steps use `waitDays`; message steps use `waitDays` as the delay before sending. */
  waitDays: number;
  templateId?: Id;
  subject?: string;
  bodyPreview?: string;
  taskTitle?: string;
  callScriptId?: Id;
  /** Reply/open metrics per step so the builder can show performance inline. */
  stats?: { sent: number; opened: number; replied: number; meetings: number };
}

export interface SequenceEnrollment {
  id: Id;
  sequenceId: Id;
  recordType: 'lead' | 'contact';
  recordId: Id;
  recordLabel: string;
  currentStepOrder: number;
  status: 'active' | 'paused' | 'completed' | 'replied' | 'bounced' | 'opted_out' | 'failed';
  enrolledAt: ISODateTimeString;
  nextStepAt?: ISODateTimeString;
  lastStepAt?: ISODateTimeString;
  ownerId: Id;
}

/* --------------------------------------------------------------- playbooks */

export interface Playbook extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description: string;
  /** Playbooks are guidance + generated tasks, not hidden automation. */
  purpose: 'qualification' | 'discovery' | 'objection_handling' | 'onboarding' | 'renewal' | 'win_back' | 'escalation' | 'custom';
  steps: PlaybookStep[];
  applicableStageIds?: Id[];
  ownerTeamIds: Id[];
  timesUsed: number;
  avgCompletionRate: number;
  isActive: boolean;
}

export interface PlaybookStep {
  id: Id;
  order: number;
  title: string;
  guidance?: string;
  /** Content blocks let a playbook link to talk tracks, docs or snippets. */
  resources?: Array<{ kind: 'doc' | 'link' | 'script' | 'template' | 'video_placeholder'; label: string; href?: string }>;
  createsTask: boolean;
  taskDueOffsetDays?: number;
  required: boolean;
  completionCount?: number;
}

export interface SalesGoal extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  metric: 'revenue' | 'deals_won' | 'activities' | 'meetings_booked' | 'new_logos' | 'renewal_rate' | 'pipeline_created';
  scope: 'individual' | 'team' | 'organization';
  ownerId?: Id;
  teamId?: Id;
  period: 'month' | 'quarter' | 'year';
  periodStart: ISODateString;
  periodEnd: ISODateString;
  target: Money | number;
  achieved: Money | number;
  /** Pacing compares elapsed time with attainment, which is what reps actually ask about. */
  pacePercent: number;
  attainmentPercent: number;
  currency?: string;
  breakdown?: Array<{ key: string; label: string; target: number; achieved: number }>;
}

export interface ForecastPeriod {
  id: Id;
  label: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  currency: string;
  quota: Money;
  commit: Money;
  bestCase: Money;
  pipeline: Money;
  closedWon: Money;
  gapToQuota: Money;
  coverageRatio: number;
  confidence: 'high' | 'medium' | 'low';
  /** Deterministic narrative produced by the mock insight engine. */
  commentary?: string;
  byRep?: Array<{ userId: Id; name: string; quota: number; commit: number; bestCase: number; closedWon: number; attainmentPercent: number }>;
  byTeam?: Array<{ teamId: Id; name: string; quota: number; commit: number; bestCase: number; closedWon: number; attainmentPercent: number }>;
  history?: Array<{ label: string; quota: number; closedWon: number; forecast: number }>;
}

/** One row per working day used by the daily planner and the coaching views. */
export interface DailyActivityPlan {
  date: ISODateString;
  userId: Id;
  items: Array<{
    id: Id;
    activityId?: Id;
    kind: ActivityKind;
    title: string;
    startAt?: ISODateTimeString;
    endAt?: ISODateTimeString;
    priority: ActivityPriority;
    status: ActivityStatus;
    recordLabel?: string;
    recordPath?: string;
    /** Suggested because of stage age, SLA risk or sequence step due. */
    reason?: string;
    estimatedMinutes?: number;
  }>;
  totals: { planned: number; completed: number; overdue: number; plannedMinutes: number };
}

export interface MeetingPreparationBrief {
  eventId: Id;
  accountId?: Id;
  accountName?: string;
  /** Deterministic, template-composed summary — explicitly a demo, not real AI. */
  generatedBy: 'demo_template_engine';
  agenda: string[];
  attendeesBrief: Array<{ id: Id; name: string; role?: string; lastTouch?: ISODateString; note?: string }>;
  openIssues: Array<{ id: Id; label: string; severity: 'high' | 'medium' | 'low' }>;
  talkingPoints: string[];
  risks: string[];
  suggestedQuestions: string[];
  relatedRecords: Array<{ type: string; id: Id; label: string; path: string }>;
}
