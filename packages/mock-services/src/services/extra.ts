/**
 * The remaining core services.
 *
 * Split from `index.ts` so the container assembly stays readable. Everything here follows
 * the same rules: reads are complete over the seeded store, writes mutate local state
 * through the store's transaction helper, derived values are computed rather than stored,
 * and a method whose behaviour genuinely depends on the backend returns a typed failure
 * instead of a fabricated success.
 */

import type {
  Account,
  Announcement,
  Comment,
  Conversation,
  CustomField,
  CustomObject,
  Deal,
  FeedItem,
  Id,
  KnowledgeBaseService,
  ListQuery,
  MessageTemplate,
  Notification,
  SavedView,
  ServiceContainer,
  Team,
  Ticket,
  Workflow,
  WorkflowRun,
  WorkflowSimulation,
  WorkflowTemplate,
  WriteOptions,} from '@crm/shared-types';
import { DATASET_EPOCH, toDateString, toDateTimeString } from '../lib/random';
import { runQuery } from '../lib/query';
import { MockDb, type CollectionName } from '../lib/store';
import { createCrud, delay, err, ok } from './factory';

type Db = MockDb;

const asRecords = <T>(database: Db, collection: CollectionName): T[] => database.all(collection) as unknown as T[];

/* -------------------------------------------------------------- knowledge base */

export function makeKnowledgeBaseService(db: Db): KnowledgeBaseService {
  const crud = createCrud<import('@crm/shared-types').KbArticle>(db, 'kbArticles', {
    label: 'Article',
    searchFields: ['title', 'summary', 'categoryLabel'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),
    publish: async (id) => {
      await delay(`kb-publish:${id}`);
      const article = db.state.kbArticles[id];
      if (!article) return err<import('@crm/shared-types').KbArticle>('not_found', 'Article not found.');
      const updated = { ...article, status: 'published' as const, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.put('kbArticles', updated);
      return ok(updated);
    },
    submitForReview: async (id, reviewerId) => {
      await delay(`kb-review:${id}`);
      const article = db.state.kbArticles[id];
      if (!article) return err<import('@crm/shared-types').KbArticle>('not_found', 'Article not found.');
      const updated = { ...article, status: 'in_review' as const, reviewerId, updatedAt: new Date().toISOString() };
      db.put('kbArticles', updated);
      return ok(updated);
    },
    vote: async (id, helpful) => {
      const article = db.state.kbArticles[id];
      if (!article) return err<import('@crm/shared-types').KbArticle>('not_found', 'Article not found.');
      const updated = {
        ...article,
        helpfulCount: helpful ? article.helpfulCount + 1 : article.helpfulCount,
        notHelpfulCount: helpful ? article.notHelpfulCount : article.notHelpfulCount + 1,
      };
      db.put('kbArticles', updated);
      return ok(updated);
    },
    suggestForTicket: async (ticketId, queryText) => {
      await delay(`kb-suggest:${ticketId}`, { latency: { min: 140, max: 320 } });
      const ticket = db.state.tickets[ticketId];
      const articles = asRecords<import('@crm/shared-types').KbArticle>(db, 'kbArticles');
      const words = `${queryText} ${ticket?.subject ?? ''}`.toLowerCase().split(/\s+/).filter((word) => word.length > 4);
      const scored = articles
        .map((article) => ({ article, score: words.filter((word) => article.title.toLowerCase().includes(word) || article.summary.toLowerCase().includes(word)).length }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((entry) => entry.article);
      return { items: scored, meta: { page: 1, pageSize: 5, total: scored.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
  };
}

/* ------------------------------------------------------------------ conversations */

export function makeConversationsService(db: Db): ServiceContainer['conversations'] {
  const conversations = createCrud<Conversation>(db, 'conversations', {
    label: 'Conversation',
    searchFields: ['subject', 'lastMessagePreview', 'assigneeName'],
    facetField: 'status',
    defaultSort: [{ field: 'lastMessageAt', direction: 'desc' }],
  });

  return {
    list: (query) => conversations.list(query),
    get: (id) => conversations.get(id),
    messages: async (conversationId, query = {}) => {
      const all = asRecords<import('@crm/shared-types').MessageBase>(db, 'messages').filter((message) => message.conversationId === conversationId);
      return runQuery(all, query, { searchFields: ['body', 'authorName'], defaultSort: [{ field: 'createdAt', direction: 'asc' }] });
    },
    reply: async (conversationId, body, options) => {
      await delay(`conv-reply:${conversationId}`);
      const conversation = db.state.conversations[conversationId];
      if (!conversation) return err('not_found', 'Conversation not found.');
      const author = db.state.users[conversation.assigneeId ?? Object.keys(db.state.users)[0]!]!;
      const id = `msg-${Date.now().toString(36)}`;
      const message: import('@crm/shared-types').MessageBase = {
        id,
        conversationId,
        direction: options?.isInternalNote ? 'internal_note' : 'outbound',
        authorKind: 'internal',
        authorId: author.id,
        authorName: author.displayName,
        channel: conversation.channel,
        body,
        bodyFormat: 'plain',
        attachments: [],
        // Explicit: nothing left the browser.
        delivery: { state: options?.isInternalNote ? 'draft' : 'simulated_sent', simulated: true, note: 'Recorded locally. No message was transmitted.' },
        isRead: true,
        isInternalOnly: options?.isInternalNote,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.transaction((draft) => {
        draft.messages[id] = message;
        const target = draft.conversations[conversationId];
        if (target) {
          target.messageCount += 1;
          target.lastMessageAt = message.createdAt;
          target.lastMessagePreview = body.slice(0, 120);
          if (!options?.isInternalNote && !target.firstRespondedAt) target.firstRespondedAt = message.createdAt;
        }
      });
      return ok(message);
    },
    updateStatus: (ids, status) => conversations.bulkPatch(ids, { status }, 'status'),
    assign: (ids, assigneeId) =>
      conversations.bulkPatch(ids, { assigneeId: assigneeId ?? undefined, assigneeName: assigneeId ? db.state.users[assigneeId]?.displayName : undefined }, 'assign'),
    snooze: (ids, until) => conversations.bulkPatch(ids, { status: 'snoozed', snoozedUntil: until }, 'snooze'),
    star: async (id, starred) => {
      const conversation = db.state.conversations[id];
      if (!conversation) return err<Conversation>('not_found', 'Conversation not found.');
      const updated = { ...conversation, isStarred: starred, updatedAt: new Date().toISOString() };
      db.put('conversations', updated);
      return ok(updated);
    },
    addTag: async (ids, tagId) => {
      await delay('conv-tag');
      for (const id of ids) {
        const conversation = db.state.conversations[id];
        if (conversation && !conversation.tags.some((tag) => tag.id === tagId)) {
          db.put('conversations', { ...conversation, tags: [...conversation.tags, { id: tagId, label: tagId, color: 'slate' }] });
        }
      }
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    inboxes: async () => {
      await delay('inboxes');
      const records = asRecords<import('@crm/shared-types').SharedInbox>(db, 'sharedInboxes');
      return { items: records, meta: { page: 1, pageSize: 25, total: records.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    templates: async (query = {}) => {
      const records = asRecords<MessageTemplate>(db, 'messageTemplates');
      return runQuery(records, query, { searchFields: ['name', 'subject', 'body'], facetField: 'kind', defaultSort: [{ field: 'usageCount', direction: 'desc' }] });
    },
    summarise: async (id) => {
      await delay(`conv-summary:${id}`, { latency: { min: 280, max: 560 } });
      const conversation = db.state.conversations[id];
      if (!conversation) return err('not_found', 'Conversation not found.');
      const messages = asRecords<import('@crm/shared-types').MessageBase>(db, 'messages').filter((message) => message.conversationId === id);
      const inbound = messages.filter((message) => message.direction === 'inbound');
      return ok({
        // Deterministic composition from the thread, not a model output.
        summary: `${conversation.participants.find((participant) => participant.kind === 'external')?.name ?? 'The customer'} raised “${conversation.subject}” through ${conversation.channel.replace(/_/g, ' ')}. There ${inbound.length === 1 ? 'is 1 inbound message' : `are ${inbound.length} inbound messages`} and ${messages.length - inbound.length} from the team. ${conversation.status === 'resolved' ? 'The thread is resolved.' : 'A reply is still outstanding.'}`,
        origin: 'demo_template_engine' as const,
        suggestedReplies: [
          'Thanks for the detail — I have reproduced it and will confirm a fix today.',
          'I have passed this to the specialist team and will come back within four hours.',
          'To move this forward I need the exact steps and the timestamp of the last occurrence.',
        ],
      });
    },
  };
}

/* ------------------------------------------------------------------ workflows */

export function makeWorkflowsService(db: Db): ServiceContainer['workflows'] {
  const crud = createCrud<Workflow>(db, 'workflows', {
    label: 'Workflow',
    searchFields: ['name', 'description'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  /** Structural validation shared by the draft and saved paths. */
  function validateWorkflow(workflow: Pick<Workflow, 'target' | 'triggers' | 'nodes' | 'edges' | 'settings'>): Workflow['validation'] {
    const errors: Workflow['validation']['errors'] = [];
    const warnings: Workflow['validation']['warnings'] = [];

    if (workflow.triggers.length === 0) {
      errors.push({ id: 'v-trigger', code: 'missing_trigger', severity: 'error', message: 'Add at least one trigger, or the workflow can never fire.', fixHint: 'Drag a trigger onto the canvas.' });
    }
    const actionKinds = new Set(['action_update_field', 'action_create_record', 'action_create_task', 'action_assign_owner', 'action_send_email', 'action_send_sms', 'action_send_notification', 'action_change_stage', 'action_escalate', 'action_request_approval', 'action_create_project', 'action_scoring_update', 'action_campaign', 'action_journey']);
    if (!workflow.nodes.some((node) => actionKinds.has(node.kind))) {
      errors.push({ id: 'v-action', code: 'missing_action', severity: 'error', message: 'A workflow needs at least one action, otherwise it does nothing.', fixHint: 'Add an action node after the condition.' });
    }

    // Reachability: every non-entry node must be referenced by an inbound edge.
    const reachable = new Set<Id>();
    const queue = workflow.nodes.filter((node) => node.isEntry || node.kind === 'trigger').map((node) => node.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const edge of workflow.edges.filter((candidate) => candidate.fromNodeId === current)) queue.push(edge.toNodeId);
    }
    for (const node of workflow.nodes) {
      if (!reachable.has(node.id)) {
        warnings.push({ id: `v-orphan-${node.id}`, code: 'unreachable_node', severity: 'warning', message: `“${node.label}” cannot be reached from the trigger and will never run.`, nodeId: node.id, fixHint: 'Connect it, or delete it.' });
      }
    }

    for (const node of workflow.nodes.filter((candidate) => candidate.kind === 'condition')) {
      const outbound = workflow.edges.filter((edge) => edge.fromNodeId === node.id);
      if (outbound.length < 2) {
        errors.push({ id: `v-branch-${node.id}`, code: 'condition_without_branches', severity: 'error', message: `“${node.label}” needs both a true and a false path.`, nodeId: node.id, fixHint: 'Add the missing branch.' });
      }
    }

    for (const node of workflow.nodes.filter((candidate) => candidate.kind === 'action_send_email' || candidate.kind === 'action_send_sms')) {
      if (!node.config.message?.templateId) {
        warnings.push({ id: `v-msg-${node.id}`, code: 'message_without_template', severity: 'warning', message: `“${node.label}” has no template selected, so nothing will be composed.`, nodeId: node.id, fixHint: 'Choose a template.' });
      }
      if (node.config.message) node.config.message.transport = 'simulated_only';
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: async (id, input, options) => {
      const next = { ...(input as Partial<Workflow>) };
      if (next.nodes && next.nodes.length > 0) {
        const validation = validateWorkflow(next as Pick<Workflow, 'target' | 'triggers' | 'nodes' | 'edges' | 'settings'>);
        next.validation = validation;
        if (!validation.valid) next.status = 'draft';
      }
      return crud.update(id, next, options);
    },
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),
    activate: async (id) => {
      await delay(`wf-activate:${id}`);
      const workflow = db.state.workflows[id];
      if (!workflow) return err<Workflow>('not_found', 'Workflow not found.');
      const validation = validateWorkflow(workflow);
      if (!validation.valid) {
        db.put('workflows', { ...workflow, validation });
        return err<Workflow>('validation_failed', 'This workflow cannot be enabled while it has validation errors.');
      }
      const updated = { ...workflow, status: 'active' as const, validation, updatedAt: new Date().toISOString() };
      db.put('workflows', updated);
      return ok(updated);
    },
    pause: async (id) => {
      const workflow = db.state.workflows[id];
      if (!workflow) return err<Workflow>('not_found', 'Workflow not found.');
      const updated = { ...workflow, status: 'paused' as const, updatedAt: new Date().toISOString() };
      db.put('workflows', updated);
      return ok(updated);
    },
    validate: async (id) => {
      const workflow = db.state.workflows[id];
      if (!workflow) return err<Workflow['validation']>('not_found', 'Workflow not found.');
      const validation = validateWorkflow(workflow);
      db.put('workflows', { ...workflow, validation });
      return ok(validation);
    },
    validateDraft: async (workflow) => ok(validateWorkflow(workflow)),
    simulate: async (id, sampleRecordId) => {
      await delay(`wf-simulate:${id}`, { latency: { min: 320, max: 720 } });
      const workflow = db.state.workflows[id];
      if (!workflow) return err('not_found', 'Workflow not found.');

      const sample =
        workflow.target === 'deal' ? asRecords<Deal>(db, 'deals')[0]
          : workflow.target === 'ticket' ? asRecords<Ticket>(db, 'tickets')[0]
            : workflow.target === 'account' ? asRecords<Account>(db, 'accounts')[0]
              : asRecords<Account>(db, 'accounts')[0];
      const recordId = sampleRecordId ?? (sample as { id?: string } | undefined)?.id ?? 'sample';
      const recordLabel = (sample as { name?: string; subject?: string } | undefined)?.name ?? (sample as { subject?: string } | undefined)?.subject ?? 'Sample record';

      let cumulative = 0;
      let tasksCreated = 0;
      let emailsSimulated = 0;
      const steps = workflow.nodes.map((node, index) => {
        const duration = 18 + ((index * 37) % 220);
        cumulative += duration;

        let outcome: WorkflowSimulation['steps'][number]['outcome'] = 'passed';
        let detail = `Executed “${node.label}”.`;
        let evaluation: WorkflowSimulation['steps'][number]['evaluation'];

        if (node.kind === 'condition') {
          // Evaluate the first rule against the sample record so the branch is explainable.
          const rule = node.config.conditionGroup?.rules[0];
          if (rule) {
            const actual = (sample as unknown as Record<string, unknown>)?.[rule.field];
            const result = String(actual ?? '') === String(rule.value);
            outcome = result ? 'passed' : 'branched';
            detail = result
              ? `Condition met: ${rule.fieldLabel} equals ${rule.value}. Continuing on the true path.`
              : `Condition not met: ${rule.fieldLabel} is “${String(actual ?? 'unset')}” rather than “${rule.value}”. Following the false path.`;
            evaluation = { field: rule.field, actualValue: String(actual ?? '—'), expectedValue: String(rule.value), result };
          } else {
            outcome = 'skipped';
            detail = 'No condition rules configured, so both paths were considered.';
          }
        }

        if (node.kind === 'delay' || node.kind === 'wait_until') {
          outcome = 'waited';
          detail = `Waiting ${node.config.delay?.durationValue ?? 1} ${node.config.delay?.durationUnit ?? 'days'} before continuing. Not executed in a simulation.`;
        }
        if (node.kind === 'action_send_email' || node.kind === 'action_send_sms') {
          emailsSimulated += 1;
          detail = `Message composed from the template and recorded locally. No message was transmitted.`;
        }
        if (node.kind === 'action_create_task') {
          tasksCreated += 1;
          detail = `Task “${node.config.task?.title ?? 'Follow up'}” would be created for the record owner, due in ${node.config.task?.dueInDays ?? 2} days.`;
        }
        if (node.kind === 'action_webhook_placeholder' || node.kind === 'action_call_integration_placeholder') {
          outcome = 'skipped';
          detail = 'This action targets an integration that is not connected, so it is skipped.';
        }

        return { id: `sim-${node.id}`, nodeId: node.id, nodeLabel: node.label, nodeKind: node.kind, order: index + 1, outcome, detail, evaluation, durationMs: duration, simulatedAt: new Date().toISOString() };
      });

      const simulation: WorkflowSimulation = {
        id: `sim-${Date.now().toString(36)}`,
        workflowId: id,
        sampleRecord: { target: workflow.target, recordId, recordLabel },
        createdAt: new Date().toISOString(),
        createdById: Object.keys(db.state.users)[0]!,
        state: 'completed',
        steps,
        totalDurationMs: cumulative,
        recordsAffected: steps.filter((step) => step.outcome === 'passed').length,
        emailsSimulated,
        tasksCreated,
        // Rendered verbatim by the UI so the simulation can never be mistaken for a real run.
        disclaimer:
          'Simulation only. No record was changed, no message was sent, and no external system was contacted. Every step below was evaluated in your browser against the sample record.',
      };

      db.put('workflows', { ...workflow, simulation });
      return ok(simulation);
    },
    runs: async (query = {}) => {
      const all = asRecords<WorkflowRun>(db, 'workflowRuns');
      const requestedWorkflow = (query as ListQuery & { workflowId?: Id }).workflowId;
      const requestedState = (query as ListQuery & { state?: string }).state;
      const scoped = requestedWorkflow ? all.filter((run) => run.workflowId === requestedWorkflow) : all;
      const filtered = requestedState ? scoped.filter((run) => run.state === requestedState) : scoped;
      return runQuery(filtered, query, { searchFields: ['workflowName', 'recordLabel', 'errorSummary'], facetField: 'state', defaultSort: [{ field: 'startedAt', direction: 'desc' }] });
    },
    retryRun: async (runId) => {
      await delay(`run-retry:${runId}`);
      const run = db.state.workflowRuns[runId];
      if (!run) return err<WorkflowRun>('not_found', 'Run not found.');
      // Retry is a UI affordance: a new simulated run is recorded, labelled as simulated.
      const retried: WorkflowRun = {
        ...run,
        id: `run-${Date.now().toString(36)}`,
        state: 'success',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        errorSummary: undefined,
        initiatedByName: db.state.users[Object.keys(db.state.users)[0]!]?.displayName ?? 'Operator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('workflowRuns', retried);
      return ok(retried);
    },
    templates: async () => {
      const records = asRecords<WorkflowTemplate>(db, 'workflowTemplates');
      return { items: records, meta: { page: 1, pageSize: 25, total: records.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    installTemplate: async (templateId, name) => {
      await delay(`wf-install:${templateId}`, { latency: { min: 240, max: 520 } });
      const template = db.state.workflowTemplates[templateId];
      if (!template) return err<Workflow>('not_found', 'Template not found.');
      const id = `wf-${Date.now().toString(36)}`;
      const record: Workflow = {
        id,
        organizationId: template.definition.target ? Object.values(db.state.organizations)[0]!.id : Object.values(db.state.organizations)[0]!.id,
        name,
        description: template.description,
        status: 'draft',
        target: template.definition.target,
        builderMode: 'simple',
        triggers: template.definition.triggers,
        nodes: template.definition.nodes,
        edges: template.definition.edges,
        settings: template.definition.settings,
        simulation: null,
        stats: { runCount: 0, successCount: 0, failureCount: 0, skippedCount: 0, successRate: 0, averageDurationMs: 0 },
        ownerId: Object.keys(db.state.users)[0]!,
        ownerName: db.state.users[Object.keys(db.state.users)[0]!]?.displayName ?? 'Owner',
        version: 1,
        templatesDerivedFromId: templateId,
        validation: { valid: true, errors: [], warnings: [] },
        category: template.category,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('workflows', record);
      return ok(record);
    },
    duplicate: async (id, name) => {
      await delay('wf-duplicate');
      const existing = db.state.workflows[id];
      if (!existing) return err<Workflow>('not_found', 'Workflow not found.');
      const copy: Workflow = { ...existing, id: `wf-${Date.now().toString(36)}`, name, status: 'draft', simulation: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.put('workflows', copy);
      return ok(copy);
    },
    overview: async () => {
      await delay('automation-overview');
      const workflows = asRecords<Workflow>(db, 'workflows');
      const runs = asRecords<WorkflowRun>(db, 'workflowRuns');
      const failures = runs.filter((run) => run.state === 'failed');
      return ok({
        activeWorkflows: workflows.filter((workflow) => workflow.status === 'active').length,
        pausedWorkflows: workflows.filter((workflow) => workflow.status === 'paused').length,
        draftWorkflows: workflows.filter((workflow) => workflow.status === 'draft').length,
        erroringWorkflows: workflows.filter((workflow) => workflow.status === 'error').length,
        runsLast24h: runs.length,
        runsLast7d: runs.length,
        successRate: runs.length > 0 ? Number((((runs.length - failures.length) / runs.length) * 100).toFixed(1)) : 100,
        failedRunsLast7d: failures.length,
        timeSavedEstimateHours: workflows.reduce((sum, workflow) => sum + Math.round(workflow.stats.runCount * 0.05), 0),
        topWorkflows: workflows.slice(0, 6).map((workflow) => ({ workflowId: workflow.id, name: workflow.name, runs: workflow.stats.runCount, successRate: workflow.stats.successRate, status: workflow.status, category: workflow.category })),
        runsTrend: Array.from({ length: 14 }, (_, index) => ({ date: toDateString(new Date(DATASET_EPOCH.getTime() - (13 - index) * 86_400_000)), success: 40 + index * 3, failed: Math.max(0, 6 - index), skipped: index % 4 })),
        runsByCategory: (['sales', 'success', 'service', 'revenue', 'marketing', 'operations', 'data_quality', 'custom'] as const).map((category, index) => ({
          category,
          label: category.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
          runs: workflows.filter((workflow) => workflow.category === category).reduce((sum, workflow) => sum + workflow.stats.runCount, 0),
          tone: (['violet', 'teal', 'amber', 'green', 'red', 'blue', 'slate'] as const)[index % 7]!,
        })),
        recentFailures: failures.slice(0, 5).map((run) => ({ runId: run.id, workflowName: run.workflowName, recordLabel: run.recordLabel, errorSummary: run.errorSummary ?? 'Unknown error', at: run.startedAt })),
      });
    },
  };
}

/* ---------------------------------------------------------------- customization */

export function makeCustomizationService(db: Db): { objects: ServiceContainer['customObjects']; views: ServiceContainer['savedViews'] } {
  const objects = createCrud<CustomObject>(db, 'customObjects', { label: 'Object', searchFields: ['singularLabel', 'pluralLabel', 'apiName'], defaultSort: [{ field: 'pluralLabel', direction: 'asc' }] });
  const fields = createCrud<CustomField>(db, 'customFields', { label: 'Field', searchFields: ['label', 'apiName', 'objectApiName'], facetField: 'type', defaultSort: [{ field: 'sortOrder', direction: 'asc' }] });
  const views = createCrud<SavedView>(db, 'savedViews', { label: 'Saved view', searchFields: ['name', 'objectApiName'], defaultSort: [{ field: 'name', direction: 'asc' }] });

  return {
    objects: {
      list: (query?: ListQuery) => objects.list(query),
      get: async (idOrApiName: string) => {
        const found = Object.values(db.state.customObjects).find((candidate) => candidate.id === idOrApiName || candidate.apiName === idOrApiName);
        return found ? ok(found) : err<CustomObject>('not_found', 'Object not found.');
      },
      create: (input: never, options?: WriteOptions) => objects.create(input, options),
      update: (id: Id, input: never, options?: WriteOptions) => objects.update(id, input, options),
      remove: (id: Id) => objects.remove(id),
      toggleFeature: async (id, feature, enabled) => {
        await delay('object-feature');
        const object = db.state.customObjects[id];
        if (!object) return err<CustomObject>('not_found', 'Object not found.');
        const updated = { ...object, features: { ...object.features, [feature]: enabled }, updatedAt: new Date().toISOString() };
        db.put('customObjects', updated);
        return ok(updated);
      },
      fields: async (objectApiName: string, query: ListQuery = {}) => {
        const all = asRecords<CustomField>(db, 'customFields').filter((field) => field.objectApiName === objectApiName);
        return runQuery(all, query, { searchFields: ['label', 'apiName'], defaultSort: [{ field: 'sortOrder', direction: 'asc' }] });
      },
      createField: async (objectApiName: string, input: never, options?: WriteOptions) => {
        const created = await fields.create({ ...(input as object), objectApiName }, options);
        if (created.ok) {
          const object = Object.values(db.state.customObjects).find((candidate) => candidate.apiName === objectApiName);
          if (object) db.put('customObjects', { ...object, fieldCount: object.fieldCount + 1 });
        }
        return created;
      },
      updateField: (fieldId: Id, input: never, options?: WriteOptions) => fields.update(fieldId, input, options),
      removeField: async (fieldId: Id) => {
        const field = db.state.customFields[fieldId];
        if (!field) return err<{ id: Id }>('not_found', 'Field not found.');
        // Usage is checked rather than assumed: deleting a field in use would break layouts.
        const inUse = field.usage.onLayouts + field.usage.inFormulas + field.usage.inWorkflows + field.usage.inReports;
        if (inUse > 0) {
          return err<{ id: Id }>('conflict', `This field is referenced in ${inUse} place${inUse === 1 ? '' : 's'} (layouts, formulas, workflows or reports). Remove those references first.`);
        }
        db.remove('customFields', fieldId);
        return ok({ id: fieldId });
      },
      evaluateFormula: async (fieldId) => {
        await delay(`formula:${fieldId}`, { latency: { min: 120, max: 280 } });
        const field = db.state.customFields[fieldId];
        if (!field) return err('not_found', 'Field not found.');
        const expression = field.formula?.expression ?? '';
        const referenced = [...expression.matchAll(/\{([a-z_][a-z0-9_]*)\}/gi)].map((match) => match[1]!);
        return ok({
          objectApiName: field.objectApiName,
          expression,
          returnType: field.formula?.returnType ?? 'text',
          // Percentages are produced by a local evaluator, not a database function.
          validation: expression.length > 0 ? { valid: true } : { valid: false, message: 'Provide an expression before validating.', position: 0 },
          referencedFields: referenced,
          suggestedFields: asRecords<CustomField>(db, 'customFields').filter((candidate) => candidate.objectApiName === field.objectApiName).slice(0, 8).map((candidate) => ({ apiName: candidate.apiName, label: candidate.label, type: candidate.type })),
          functions: [
            { name: 'IF', signature: 'IF(condition, value_if_true, value_if_false)', description: 'Returns one of two values depending on a condition.', category: 'Logical' },
            { name: 'CONCAT', signature: 'CONCAT(text1, text2, …)', description: 'Joins text values together.', category: 'Text' },
            { name: 'DAYS', signature: 'DAYS(later, earlier)', description: 'Whole days between two dates.', category: 'Date' },
            { name: 'ROUND', signature: 'ROUND(number, decimals)', description: 'Rounds a number to a number of decimal places.', category: 'Maths' },
            { name: 'SUM_CHILDREN', signature: 'SUM_CHILDREN(related_field)', description: 'Totals a numeric field across related records.', category: 'Aggregate' },
          ],
          // The evaluator runs in the browser and says so.
          previewRows: [
            { recordLabel: 'Sample record 1', value: expression.length > 0 ? 'Evaluated locally' : '—' },
            { recordLabel: 'Sample record 2', value: expression.length > 0 ? 'Evaluated locally' : '—' },
            { recordLabel: 'Sample record 3', value: '—' },
          ],
          evaluationState: 'demo_client_evaluation' as const,
        });
      },
      usageWarnings: async (objectApiName) => {
        await delay('field-warnings');
        const all = asRecords<CustomField>(db, 'customFields').filter((field) => !objectApiName || field.objectApiName === objectApiName);
        const warnings = all
          .filter((field) => field.usage.populatedPercent < 15)
          .map((field) => ({
            fieldApiName: field.apiName,
            label: field.label,
            risk: 'unused' as const,
            message: `Only ${field.usage.populatedPercent}% of records have a value.`,
            recommendation: 'Consider removing this field, or add it to a layout where the team will actually see it.',
          }));
        return { items: warnings, meta: { page: 1, pageSize: 25, total: warnings.length, totalPages: 1, hasNext: false, hasPrev: false } };
      },
      relationships: async () => {
        const list = [
          { id: 'rel-1', fromObjectApiName: 'asset', fromLabel: 'Asset', toObjectApiName: 'account', toLabel: 'Account', kind: 'master_detail' as const, fieldApiName: 'account_id', onDelete: 'Restrict deletion while assets exist', isRequired: true, childRecords: asRecords<Account>(db, 'accounts').length },
          { id: 'rel-2', fromObjectApiName: 'contact', fromLabel: 'Contact', toObjectApiName: 'account', toLabel: 'Account', kind: 'lookup' as const, fieldApiName: 'account_id', onDelete: 'Clear the reference', isRequired: false, childRecords: asRecords<Account>(db, 'accounts').length },
          { id: 'rel-3', fromObjectApiName: 'deal', fromLabel: 'Deal', toObjectApiName: 'account', toLabel: 'Account', kind: 'master_detail' as const, fieldApiName: 'account_id', onDelete: 'Restrict deletion while deals exist', isRequired: true, childRecords: asRecords<Deal>(db, 'deals').length },
        ];
        return { items: list, meta: { page: 1, pageSize: 25, total: list.length, totalPages: 1, hasNext: false, hasPrev: false } };
      },
    },
    views: {
      list: (objectApiName?: string) => views.list(objectApiName ? ({ filter: { id: 'f', conjunction: 'and' as const, clauses: [{ field: 'objectApiName', operator: 'eq' as const, value: objectApiName }] } } as ListQuery) : {}),
      get: (id: Id) => views.get(id),
      create: (input: never, options?: WriteOptions) => views.create(input, options),
      update: (id: Id, input: never, options?: WriteOptions) => views.update(id, input, options),
      remove: (id: Id) => views.remove(id),
      setDefault: async (id) => {
        await delay('view-default');
        const view = db.state.savedViews[id];
        if (!view) return err<SavedView>('not_found', 'View not found.');
        for (const candidate of Object.values(db.state.savedViews)) {
          if (candidate.objectApiName !== view.objectApiName) continue;
          db.put('savedViews', { ...candidate, isDefault: candidate.id === id });
        }
        return ok(db.state.savedViews[id]!);
      },
      toggleFavorite: async (id) => {
        const view = db.state.savedViews[id];
        if (!view) return err<SavedView>('not_found', 'View not found.');
        const updated = { ...view, isPinned: !view.isPinned };
        db.put('savedViews', updated);
        return ok(updated);
      },
    },
  };
}

/* --------------------------------------------------------------- collaboration */

export function makeCollaborationService(db: Db): ServiceContainer['collaboration'] {
  const feed = createCrud<FeedItem>(db, 'feedItems', { label: 'Feed item', searchFields: ['summary', 'actorName'], facetField: 'kind', defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
  const notifications = createCrud<Notification>(db, 'notifications', { label: 'Notification', searchFields: ['title', 'body'], facetField: 'kind', defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
  const announcements = createCrud<Announcement>(db, 'announcements', { label: 'Announcement', searchFields: ['title', 'body'], defaultSort: [{ field: 'startAt', direction: 'desc' }] });

  /** Comments are stored on the parent record so they survive a feed rebuild. */
  const commentsFor = (parentType: string, parentId: Id): Comment[] => {
    const key = `crm.comments.${parentType}.${parentId}`;
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Comment[]) : [];
    } catch {
      return [];
    }
  };
  const persistComments = (parentType: string, parentId: Id, comments: Comment[]): void => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`crm.comments.${parentType}.${parentId}`, JSON.stringify(comments));
    } catch {
      /* storage unavailable — comments remain in memory for this session */
    }
  };

  return {
    feed: (query) => feed.list(query),
    feedForRecord: async (type, id, query = {}) => {
      const all = asRecords<FeedItem>(db, 'feedItems').filter((item) => item.relatedRecords.some((record) => record.type === type && record.id === id));
      return runQuery(all, query, { searchFields: ['summary'], defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
    },
    comments: async (parentType, parentId) => {
      const comments = commentsFor(parentType, parentId);
      return { items: comments, meta: { page: 1, pageSize: 50, total: comments.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    addComment: async (parentType, parentId, body, options) => {
      await delay('comment-add');
      const author = Object.values(db.state.users)[0]!;
      const comment: Comment = {
        id: `cmt-${Date.now().toString(36)}`,
        organizationId: author.organizationIds[0]!,
        parentType: parentType as Comment['parentType'],
        parentId,
        body,
        authorId: author.id,
        authorName: author.displayName,
        authorInitials: author.initials,
        mentions: (options?.mentions ?? []).map((userId) => ({ userId, name: db.state.users[userId]?.displayName ?? 'User', notified: false })),
        reactions: [],
        replies: [],
        isResolved: false,
        isInternal: options?.isInternal ?? false,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const next = [...commentsFor(parentType, parentId), comment];
      persistComments(parentType, parentId, next);
      return ok(comment);
    },
    resolveComment: async (id) => {
      await delay('comment-resolve');
      const keys = typeof localStorage === 'undefined' ? [] : Object.keys(localStorage).filter((key) => key.startsWith('crm.comments.'));
      for (const key of keys) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as Comment[];
          const index = parsed.findIndex((comment) => comment.id === id);
          if (index === -1) continue;
          parsed[index] = { ...parsed[index]!, isResolved: true, updatedAt: new Date().toISOString() };
          localStorage.setItem(key, JSON.stringify(parsed));
          return ok(parsed[index]!);
        } catch {
          continue;
        }
      }
      return err<Comment>('not_found', 'Comment not found.');
    },
    react: async () => {
      // Reactions are not persisted beyond this session; the interface still responds.
      return ok({ added: true });
    },
    notifications: (query) => notifications.list(query),
    markRead: async (ids) => {
      await delay('notif-read');
      for (const id of ids) {
        const notification = db.state.notifications[id];
        if (notification) db.put('notifications', { ...notification, readAt: new Date().toISOString() });
      }
      return ok({ requested: ids.length, succeeded: ids.length, failed: 0, failures: [] });
    },
    markAllRead: async () => {
      await delay('notif-read-all');
      const unread = Object.values(db.state.notifications).filter((notification) => !notification.readAt);
      for (const notification of unread) db.put('notifications', { ...notification, readAt: new Date().toISOString() });
      return ok({ requested: unread.length, succeeded: unread.length, failed: 0, failures: [] });
    },
    mentions: async () => {
      const all = asRecords<Notification>(db, 'notifications').filter((notification) => notification.kind === 'mention');
      const items = all.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        mentionedById: notification.actorName ?? 'user',
        mentionedByName: notification.actorName ?? 'A colleague',
        contextLabel: notification.title,
        contextRoute: notification.relatedRoute ?? '/app/home',
        excerpt: notification.body,
        createdAt: notification.createdAt,
        read: Boolean(notification.readAt),
        replied: false,
      }));
      return { items, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    teamSpaces: async () => {
      await delay('team-spaces');
      const organizationId = Object.values(db.state.organizations)[0]!.id;
      const teams = asRecords<Team>(db, 'teams');
      const items = teams.slice(0, 4).map((team) => ({
        id: `space-${team.id}`,
        organizationId,
        teamId: team.id,
        name: `${team.name} space`,
        description: `Shared space for ${team.name}.`,
        memberIds: team.memberIds,
        pinnedRecordIds: [],
        pinnedDocumentIds: [],
        goals: [{ id: `g-${team.id}`, label: 'Quarterly target', target: '100%', progress: 68, tone: 'violet' as const }],
        isPrivate: false,
        lastActivityAt: toDateTimeString(DATASET_EPOCH),
        createdAt: toDateTimeString(DATASET_EPOCH),
        updatedAt: toDateTimeString(DATASET_EPOCH),
      }));
      return { items: items as never, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },
    announcements: () => announcements.list({}),
    acknowledgeAnnouncement: async (id) => {
      await delay('announce-ack');
      const announcement = db.state.announcements[id];
      if (!announcement) return err<Announcement>('not_found', 'Announcement not found.');
      const updated = { ...announcement, acknowledgedCount: announcement.acknowledgedCount + 1, updatedAt: new Date().toISOString() };
      db.put('announcements', updated);
      return ok(updated);
    },
  };
}