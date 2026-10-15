/**
 * Workflow automation: triggers, conditions, actions, simulation and run history.
 *
 * The runtime in `@crm/mock-services` evaluates these definitions in the browser.
 * Nothing is executed on a server, and every execution record is labelled as a
 * simulation so the UI never implies production automation.
 */

import type { Auditable, Id, ISODateTimeString, Tone } from './common';

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'error' | 'archived';

export interface Workflow extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  status: WorkflowStatus;
  /** Which record type the workflow runs against. */
  target: WorkflowTarget;
  /** Simple mode uses a guided trigger/condition/action form. */
  builderMode: 'simple' | 'advanced';
  triggers: WorkflowTrigger[];
  /** Ordered steps. The canvas visualises these; the list view edits them. */
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** Guard rails shown in the UI. */
  settings: {
    runOncePerRecord: boolean;
    allowReentry: boolean;
    reentryDelayHours?: number;
    runAsUserId?: Id;
    stopOnError: boolean;
    timezone: string;
    maxRunsPerDay?: number;
    /** Prevents accidental loops; validation surfaces violations before saving. */
    allowRecursive: boolean;
  };
  /** Simulation output — deterministic and reproducible in the browser. */
  simulation: WorkflowSimulation | null;
  stats: {
    runCount: number;
    successCount: number;
    failureCount: number;
    skippedCount: number;
    successRate: number;
    averageDurationMs: number;
    lastRunAt?: ISODateTimeString;
    lastRunStatus?: 'success' | 'failed';
  };
  ownerId: Id;
  ownerName: string;
  version: number;
  templatesDerivedFromId?: Id;
  /** Validation is a first-class concept: a workflow cannot be enabled while invalid. */
  validation: WorkflowValidation;
  category: 'sales' | 'marketing' | 'service' | 'success' | 'revenue' | 'operations' | 'data_quality' | 'custom';
  tags: string[];
}

export type WorkflowTarget =
  | 'lead'
  | 'contact'
  | 'account'
  | 'deal'
  | 'activity'
  | 'ticket'
  | 'campaign_member'
  | 'contract'
  | 'subscription'
  | 'renewal'
  | 'quote'
  | 'custom_object';

export interface WorkflowTrigger {
  id: Id;
  kind:
    | 'record_created'
    | 'record_updated'
    | 'field_changed'
    | 'record_deleted'
    | 'stage_changed'
    | 'date_reached'
    | 'relative_date'
    | 'inactivity'
    | 'schedule'
    | 'webhook_received_placeholder'
    | 'form_submitted'
    | 'manual'
    | 'email_event_placeholder'
    | 'sla_threshold';
  label: string;
  description: string;
  config: {
    watchedFields?: string[];
    fromStageId?: Id;
    toStageId?: Id;
    field?: string;
    operator?: string;
    value?: string;
    daysOffset?: number;
    direction?: 'before' | 'after';
    cronPlaceholder?: string;
    inactivityDays?: number;
    /** Scheduled triggers are not evaluated by a real scheduler. */
    schedulerState: 'simulated' | 'not_configured';
  };
}

export type WorkflowNodeKind =
  | 'trigger'
  | 'condition'
  | 'branch'
  | 'action_update_field'
  | 'action_create_record'
  | 'action_create_task'
  | 'action_assign_owner'
  | 'action_send_email'
  | 'action_send_sms'
  | 'action_send_notification'
  | 'action_webhook_placeholder'
  | 'action_call_integration_placeholder'
  | 'action_add_to_campaign'
  | 'action_add_to_journey'
  | 'action_change_stage'
  | 'action_escalate'
  | 'action_request_approval'
  | 'action_create_project'
  | 'action_score_update'
  | 'delay'
  | 'wait_until'
  | 'goal'
  | 'end';

export interface WorkflowNode {
  id: Id;
  kind: WorkflowNodeKind;
  label: string;
  description?: string;
  position: { x: number; y: number };
  config: WorkflowNodeConfig;
  /** Per-node run statistics, surfaced on the canvas. */
  stats?: { executed: number; succeeded: number; failed: number; skipped: number };
  /** Condition-label helpers shown on outgoing edges. */
  isEntry?: boolean;
  isTerminal?: boolean;
}

export interface WorkflowNodeConfig {
  /** Conditions */
  conditionGroup?: WorkflowConditionGroup;
  /** Field updates */
  fieldUpdates?: Array<{ field: string; fieldLabel: string; operation: 'set' | 'clear' | 'increment' | 'decrement' | 'append' | 'prepend'; value: string; valueType: 'literal' | 'field' | 'formula' }>;
  /** Record creation */
  createRecord?: { target: WorkflowTarget; fieldMappings: Array<{ targetField: string; source: 'field' | 'literal' | 'parent'; value: string }>; linkToParent: boolean };
  /** Tasks */
  task?: { title: string; description?: string; assignToKind: 'owner' | 'user' | 'role' | 'team' | 'manager_of_owner'; assignToId?: Id; dueInDays: number; priority: 'urgent' | 'high' | 'normal' | 'low'; templateId?: Id };
  /** Assignment */
  assignment?: { strategy: 'user' | 'team' | 'round_robin' | 'least_loaded' | 'territory_based' | 'owner_manager'; targetId?: Id; onlyIfUnassigned: boolean };
  /** Messaging */
  message?: { templateId?: Id; templateName?: string; toKind: 'record_email' | 'record_phone' | 'owner' | 'literal'; literalAddress?: string; /** Nothing is transmitted. */ transport: 'simulated_only' };
  /** Notifications */
  notification?: { recipientKind: 'owner' | 'user' | 'role' | 'team' | 'record_followers'; recipientId?: Id; title: string; body: string; channel: 'in_app' | 'email_simulated' };
  /** Stage changes */
  stageChange?: { toStageId: Id; enforceRequiredFields: boolean; skipValidation: boolean };
  /** Escalation */
  escalation?: { targetKind: 'manager' | 'team' | 'queue' | 'user'; targetId?: Id; raisePriority: boolean; note: string };
  /** Approvals */
  approval?: { approverKind: 'user' | 'role' | 'manager' | 'team'; approverId?: Id; dueInDays: number; onReject: 'stop' | 'continue' | 'notify' };
  /** Projects */
  createProject?: { templateId?: Id; nameTemplate: string; managerKind: 'owner' | 'user'; managerId?: Id };
  /** Scoring */
  scoringUpdate?: { model: string; adjustment: number; reason: string };
  /** Delays */
  delay?: { durationValue: number; durationUnit: 'minutes' | 'hours' | 'days' | 'weeks'; businessHoursOnly: boolean };
  waitUntil?: { conditionGroup: WorkflowConditionGroup; timeoutDays: number; onTimeout: 'continue' | 'exit' };
  /** External calls are placeholders with explicit notes. */
  webhook?: { urlPlaceholder: string; method: 'POST' | 'PUT' | 'PATCH'; headers?: Array<{ key: string; valuePlaceholder: string }>; bodyTemplatePlaceholder: string; note: string };
  integrationAction?: { providerLabel: string; actionLabel: string; note: string };
  /** Marketing */
  campaignAction?: { campaignId: Id; action: 'add' | 'remove' };
  journeyAction?: { journeyId: Id; action: 'enroll' | 'unenroll' };
}

export interface WorkflowConditionGroup {
  id: Id;
  conjunction: 'and' | 'or';
  /** Group-level negation lets a rule express "none of these are true". */
  negate: boolean;
  rules: WorkflowConditionRule[];
  groups?: WorkflowConditionGroup[];
}

export interface WorkflowConditionRule {
  id: Id;
  field: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'picklist' | 'multipicklist' | 'user' | 'relationship';
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'greater_than'
    | 'greater_or_equal'
    | 'less_than'
    | 'less_or_equal'
    | 'is_empty'
    | 'is_not_empty'
    | 'was_changed'
    | 'was_set_to'
    | 'in_list'
    | 'in_last_days'
    | 'before_date'
    | 'after_date';
  value?: string | number | boolean | string[];
  /** Related-record conditions traverse a relationship. */
  relatedPath?: string;
}

export interface WorkflowEdge {
  id: Id;
  fromNodeId: Id;
  toNodeId: Id;
  /** `true` / `false` for conditions, custom labels for branches. */
  fromPort: string;
  label?: string;
  tone?: Tone;
}

export interface WorkflowValidation {
  valid: boolean;
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
}

export interface WorkflowValidationIssue {
  id: Id;
  code:
    | 'missing_trigger'
    | 'missing_action'
    | 'orphan_node'
    | 'condition_without_branches'
    | 'recursive_loop'
    | 'unreachable_node'
    | 'missing_required_config'
    | 'duplicate_trigger'
    | 'message_without_template'
    | 'stage_change_to_unknown_stage'
    | 'no_owner_for_assignment'
    | 'webhook_placeholder_only';
  severity: 'error' | 'warning';
  message: string;
  nodeId?: Id;
  /** Clicking the issue focuses the offending node. */
  fixHint?: string;
}

export interface WorkflowSimulation {
  id: Id;
  workflowId: Id;
  /** The sample record whose field values drive the simulation. */
  sampleRecord: { target: WorkflowTarget; recordId: Id; recordLabel: string };
  createdAt: ISODateTimeString;
  createdById: Id;
  state: 'running' | 'completed' | 'failed';
  steps: WorkflowSimulationStep[];
  totalDurationMs: number;
  recordsAffected: number;
  emailsSimulated: number;
  tasksCreated: number;
  /** Explicit disclaimer rendered in the UI. */
  disclaimer: string;
}

export interface WorkflowSimulationStep {
  id: Id;
  nodeId: Id;
  nodeLabel: string;
  nodeKind: WorkflowNodeKind;
  order: number;
  outcome: 'passed' | 'failed' | 'skipped' | 'waited' | 'branched';
  /** Human-readable explanation of the decision. */
  detail: string;
  evaluation?: { field: string; actualValue: string; expectedValue: string; result: boolean };
  durationMs: number;
  simulatedAt: ISODateTimeString;
}

export interface WorkflowRun extends Auditable {
  id: Id;
  workflowId: Id;
  workflowName: string;
  organizationId: Id;
  /** Every run is explicitly simulated in this build. */
  mode: 'simulation' | 'simulated_schedule';
  simulated: true;
  triggerKind: WorkflowTrigger['kind'];
  recordType: WorkflowTarget;
  recordId: Id;
  recordLabel: string;
  state: 'success' | 'failed' | 'partial' | 'skipped' | 'running';
  startedAt: ISODateTimeString;
  finishedAt?: ISODateTimeString;
  durationMs: number;
  steps: Array<{
    id: Id;
    nodeId: Id;
    nodeLabel: string;
    outcome: WorkflowSimulationStep['outcome'];
    detail: string;
    durationMs: number;
    errorMessage?: string;
  }>;
  errorSummary?: string;
  /** Retry is a UI affordance only. */
  retryable: boolean;
  initiatedByName: string;
}

export interface WorkflowTemplate {
  id: Id;
  name: string;
  category: Workflow['category'];
  description: string;
  /** The scenarios named in the brief are shipped as ready-made templates. */
  scenario: string;
  target: WorkflowTarget;
  nodeCount: number;
  installsCount: number;
  definition: Pick<Workflow, 'triggers' | 'nodes' | 'edges' | 'settings' | 'category' | 'target'>;
  requiredModuleKeys: string[];
  tone: Tone;
}

export interface AutomationOverview {
  activeWorkflows: number;
  pausedWorkflows: number;
  draftWorkflows: number;
  erroringWorkflows: number;
  runsLast24h: number;
  runsLast7d: number;
  successRate: number;
  failedRunsLast7d: number;
  timeSavedEstimateHours: number;
  topWorkflows: Array<{ workflowId: Id; name: string; runs: number; successRate: number; status: WorkflowStatus; category: Workflow['category'] }>;
  runsTrend: Array<{ date: string; success: number; failed: number; skipped: number }>;
  runsByCategory: Array<{ category: Workflow['category']; label: string; runs: number; tone: Tone }>;
  recentFailures: Array<{ runId: Id; workflowName: string; recordLabel: string; errorSummary: string; at: ISODateTimeString }>;
}
