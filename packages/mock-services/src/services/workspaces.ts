/**
 * Workspaces services: projects & delivery, field sales, and partner relationship
 * management.
 *
 * Split from `index.ts` for the same reason as `extra.ts`: the container assembly stays
 * readable. Everything here follows the established rules — reads are complete over the
 * seeded store, writes mutate local state through `db.put`/`db.transaction`, and derived
 * values are computed rather than stored twice.
 *
 * Two honesty constraints are baked into the shapes and honoured here:
 *
 *   - **Field check-in is simulated.** `VisitLog.checkIn.gpsUsed` is always `false` and the
 *     note says a label was chosen rather than a device location read. No map or routing
 *     provider is contacted; route distance is the seeded local estimate.
 *   - **Partner commissions and certifications are demonstration data.** Every derived
 *     commission carries `calculationState: 'demo_local_calculation'`, and certification
 *     issuer labels are `internal_program` (no third-party accreditation is implied).
 *
 * Collections that exist in the contract but are not separately seeded (project phases,
 * deliverables, risks, referrals, commissions) are derived deterministically from the
 * records that *are* seeded, matching how `extra.ts` derives relationships and usage
 * warnings rather than inventing a second source of truth.
 */

import type {
  Deal,
  DealProductLine,
  FieldSalesOverview,
  Id,
  ListQuery,
  Money,
  Partner,
  PartnerCommission,
  PartnerOverview,
  Project,
  ProjectDeliverable,
  ProjectMilestone,
  ProjectOverview,
  ProjectPhase,
  ProjectRisk,
  ProjectTask,
  ProjectTimeline,
  Referral,
  ServiceContainer,
  Territory,
  Tone,
  VisitLog,
  VisitPlan,
} from '@crm/shared-types';
import { DATASET_EPOCH, toDateString } from '../lib/random';
import { runQuery } from '../lib/query';
import type { CollectionName, MockDb } from '../lib/store';
import { createCrud, daysSince, delay, err, nextId, ok } from './factory';

type Db = MockDb;

const asRecords = <T>(database: Db, collection: CollectionName): T[] =>
  database.all(collection) as unknown as T[];

/** Small deterministic hash so derived records are stable across renders and reloads. */
function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 100_000;
  }
  return result;
}

const money = (amount: number, currency: Money['currency']): Money => ({ amount, currency });

/** Build an `and` filter group for a single equality clause. */
function equalsClause(field: string, value: unknown, tag: string): ListQuery {
  return {
    filter: { id: `filter-${tag}`, conjunction: 'and', clauses: [{ field, operator: 'eq', value }] },
  };
}

/* ------------------------------------------------------------------ projects */

const PROJECT_STATUS_META: Array<{ status: Project['status']; label: string; tone: Tone }> = [
  { status: 'planning', label: 'Planning', tone: 'slate' },
  { status: 'not_started', label: 'Not started', tone: 'slate' },
  { status: 'in_progress', label: 'In progress', tone: 'blue' },
  { status: 'blocked', label: 'Blocked', tone: 'red' },
  { status: 'on_hold', label: 'On hold', tone: 'amber' },
  { status: 'at_risk', label: 'At risk', tone: 'amber' },
  { status: 'completed', label: 'Completed', tone: 'green' },
  { status: 'cancelled', label: 'Cancelled', tone: 'slate' },
];

const RISK_TITLES = [
  'Customer data extract has not arrived',
  'Integration credentials expire before go-live',
  'Key customer stakeholder changed role',
  'Training capacity is over-committed this month',
  'Scope added after contract signature',
];
const ISSUE_TITLES = [
  'Migration mapping conflicts discovered',
  'Go-live rehearsal failed on the sandbox',
  'Invoicing milestone dispute raised by the customer',
];

const PHASE_DEFS: Array<{ name: string; tone: Tone }> = [
  { name: 'Discovery & planning', tone: 'violet' },
  { name: 'Configuration', tone: 'blue' },
  { name: 'Data migration', tone: 'teal' },
  { name: 'Go-live & handover', tone: 'green' },
];

/** Whole days between two ISO dates; never negative. */
function daySpan(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function addDaysIso(iso: string, days: number): string {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) return iso;
  return toDateString(new Date(base.getTime() + days * 86_400_000));
}

export function makeProjectsService(db: Db): ServiceContainer['projects'] {
  const projectsCrud = createCrud<Project>(db, 'projects', {
    label: 'Project',
    searchFields: ['name', 'reference', 'accountName'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });
  const tasksCrud = createCrud<ProjectTask>(db, 'projectTasks', {
    label: 'Project task',
    searchFields: ['title', 'reference', 'assigneeName'],
    facetField: 'status',
    defaultSort: [{ field: 'order', direction: 'asc' }],
  });
  const milestonesCrud = createCrud<ProjectMilestone>(db, 'projectMilestones', {
    label: 'Project milestone',
    searchFields: ['name'],
    facetField: 'status',
    defaultSort: [{ field: 'dueDate', direction: 'asc' }],
  });

  const projectById = (id: Id): Project | undefined => db.state.projects[id];
  const tasksFor = (projectId: Id): ProjectTask[] =>
    asRecords<ProjectTask>(db, 'projectTasks').filter((task) => task.projectId === projectId);
  const milestonesFor = (projectId: Id): ProjectMilestone[] =>
    asRecords<ProjectMilestone>(db, 'projectMilestones').filter((milestone) => milestone.projectId === projectId);

  /** Phases are derived from the project window so they can never contradict the timeline. */
  function phasesFor(project: Project): ProjectPhase[] {
    const span = Math.max(28, daySpan(project.startDate, project.targetEndDate));
    const chunk = Math.round(span / PHASE_DEFS.length);
    return PHASE_DEFS.map((definition, index) => {
      const start = addDaysIso(project.startDate, index * chunk);
      const end = addDaysIso(project.startDate, (index + 1) * chunk - 1);
      const windowStart = index * (100 / PHASE_DEFS.length);
      const progress = Math.max(0, Math.min(100, Math.round(((project.progressPercent - windowStart) / (100 / PHASE_DEFS.length)) * 100)));
      const status: ProjectPhase['status'] =
        progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started';
      return {
        id: `phase-${project.id}-${index + 1}`,
        projectId: project.id,
        name: definition.name,
        order: index + 1,
        startDate: start,
        endDate: end,
        status: project.health === 'blocked' && status === 'in_progress' ? 'blocked' : status,
        progressPercent: progress,
        tone: definition.tone,
      };
    });
  }

  /** One deliverable per milestone, which is where a signed-off deliverable actually sits. */
  function deliverablesFor(project: Project): ProjectDeliverable[] {
    return milestonesFor(project.id).map((milestone, index) => ({
      id: `pdv-${project.id}-${index + 1}`,
      projectId: project.id,
      milestoneId: milestone.id,
      name: `${milestone.name} — deliverable`,
      description: 'Recorded against the milestone; the document itself is metadata only.',
      kind: index === 2 ? 'training' : index === 1 ? 'report' : 'service',
      status:
        milestone.status === 'completed'
          ? 'accepted'
          : milestone.status === 'at_risk'
            ? 'in_review'
            : milestone.status === 'in_progress'
              ? 'in_progress'
              : 'not_started',
      dueDate: milestone.dueDate,
      deliveredAt: milestone.completedAt,
      acceptedAt: milestone.customerApprovedAt,
      documentId: undefined,
      customerVisible: project.customerVisible,
    }));
  }

  /**
   * Risks and issues are derived from the project's own counts. The subject matter is a
   * stable set so the board does not churn between renders.
   */
  function risksFor(project: Project): ProjectRisk[] {
    const seed = hash(project.id);
    const risks: ProjectRisk[] = [];
    for (let index = 0; index < project.riskCount; index += 1) {
      const title = RISK_TITLES[(seed + index) % RISK_TITLES.length]!;
      risks.push({
        id: `prisk-${project.id}-${index + 1}`,
        projectId: project.id,
        kind: 'risk',
        title,
        description: 'Identified during delivery review. Mitigation is tracked against this record.',
        probability: (['high', 'medium', 'low'] as const)[(seed + index) % 3]!,
        impact: (['high', 'medium', 'low'] as const)[(seed + index + 1) % 3]!,
        severity: (['critical', 'high', 'medium', 'low'] as const)[(seed + index) % 4]!,
        status: (['open', 'mitigating', 'accepted', 'closed'] as const)[(seed + index) % 4]!,
        ownerId: project.managerId,
        ownerName: project.managerName,
        raisedAt: project.createdAt,
        targetResolutionDate: addDaysIso(project.startDate, 30 + index * 10),
        mitigationPlan: 'Owner assigned; reviewed at the next delivery checkpoint.',
        customerVisible: index === 0,
      });
    }
    for (let index = 0; index < project.issueCount; index += 1) {
      risks.push({
        id: `pissue-${project.id}-${index + 1}`,
        projectId: project.id,
        kind: 'issue',
        title: ISSUE_TITLES[(seed + index) % ISSUE_TITLES.length]!,
        description: 'Raised during delivery and currently being worked.',
        probability: 'high',
        impact: 'medium',
        severity: 'high',
        status: 'open',
        ownerId: project.managerId,
        ownerName: project.managerName,
        raisedAt: project.createdAt,
        targetResolutionDate: addDaysIso(project.startDate, 14 + index * 7),
        mitigationPlan: undefined,
        customerVisible: true,
      });
    }
    return risks;
  }

  return {
    list: (query) => projectsCrud.list(query),
    get: (id) => projectsCrud.get(id),
    create: (input, options) => projectsCrud.create(input, options),
    update: (id, input, options) => projectsCrud.update(id, input, options),
    remove: (id, options) => projectsCrud.remove(id, options),
    bulkRemove: (ids, options) => projectsCrud.bulkRemove(ids, options),

    overview: async () => {
      await delay('projects-overview');
      const projects = asRecords<Project>(db, 'projects');
      const activeStatuses: Project['status'][] = ['planning', 'not_started', 'in_progress', 'at_risk', 'blocked', 'on_hold'];
      const active = projects.filter((project) => activeStatuses.includes(project.status));
      const atRisk = projects.filter((project) => project.status === 'at_risk' || project.health === 'at_risk' || project.health === 'off_track');
      const blocked = projects.filter((project) => project.status === 'blocked' || project.health === 'blocked');
      const completed = projects.filter((project) => project.status === 'completed');
      const currency = projects[0]?.currency ?? 'USD';
      const totalBudget = projects.reduce((sum, project) => sum + (project.budget?.amount ?? 0), 0);
      const budgetSpent = projects.reduce((sum, project) => sum + (project.budgetSpent?.amount ?? 0), 0);
      const durations = projects.map((project) => daySpan(project.startDate, project.actualEndDate ?? project.targetEndDate));
      const onTime = completed.filter((project) => !project.actualEndDate || project.actualEndDate <= project.targetEndDate);
      const allocations = projects.flatMap((project) => project.teamMembers.map((member) => member.allocationPercent ?? 0));

      const managerIds = [...new Set(projects.map((project) => project.managerId))];
      const byManager = managerIds.map((managerId) => {
        const owned = projects.filter((project) => project.managerId === managerId);
        const ownedCompleted = owned.filter((project) => project.status === 'completed');
        const ownedOnTime = ownedCompleted.filter((project) => !project.actualEndDate || project.actualEndDate <= project.targetEndDate);
        const managerAllocations = owned.flatMap((project) => project.teamMembers.map((member) => member.allocationPercent ?? 0));
        return {
          userId: managerId,
          name: owned[0]?.managerName ?? 'Manager',
          projects: owned.length,
          onTimePercent: ownedCompleted.length > 0 ? Math.round((ownedOnTime.length / ownedCompleted.length) * 100) : 0,
          atRisk: owned.filter((project) => project.health === 'at_risk' || project.health === 'off_track').length,
          utilizationPercent: managerAllocations.length > 0 ? Math.round(managerAllocations.reduce((sum, value) => sum + value, 0) / managerAllocations.length) : 0,
        };
      });

      const trend = Array.from({ length: 14 }, (_, index) => {
        const day = toDateString(new Date(DATASET_EPOCH.getTime() - (13 - index) * 86_400_000));
        return {
          date: day,
          started: projects.filter((project) => project.startDate === day).length,
          completed: projects.filter((project) => project.actualEndDate === day).length,
          overdue: projects.filter((project) => project.status !== 'completed' && project.status !== 'cancelled' && project.targetEndDate < day).length,
        };
      });

      const upcoming = asRecords<ProjectMilestone>(db, 'projectMilestones')
        .filter((milestone) => milestone.status !== 'completed')
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
        .slice(0, 6)
        .map((milestone) => {
          const project = projectById(milestone.projectId);
          return {
            id: milestone.id,
            projectId: milestone.projectId,
            projectName: project?.name ?? 'Project',
            name: milestone.name,
            dueDate: milestone.dueDate,
            status: milestone.status,
            billableAmount: milestone.billableAmount,
          };
        });

      const overview: ProjectOverview = {
        activeProjects: active.length,
        atRiskProjects: atRisk.length,
        blockedProjects: blocked.length,
        completedThisPeriod: completed.length,
        averageDurationDays: durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
        onTimeDeliveryPercent: completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0,
        totalBudget: money(totalBudget, currency),
        budgetConsumedPercent: totalBudget > 0 ? Math.round((budgetSpent / totalBudget) * 100) : 0,
        utilizationPercent: allocations.length > 0 ? Math.round(allocations.reduce((sum, value) => sum + value, 0) / allocations.length) : 0,
        byStatus: PROJECT_STATUS_META.map((meta) => ({
          status: meta.status,
          label: meta.label,
          count: projects.filter((project) => project.status === meta.status).length,
          tone: meta.tone,
        })),
        byManager,
        deliveryTrend: trend,
        upcomingMilestones: upcoming,
        timeToValueTrend: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((month, index) => ({
          month,
          days: Math.max(10, 96 - index * 9),
        })),
      };
      return ok(overview);
    },

    acceptHandoff: async (id, checklistPatch) => {
      await delay(`project-handoff:${id}`);
      const project = projectById(id);
      if (!project) return err<Project>('not_found', 'Project not found.');

      const checklist = project.handoff.checklist.map((item) => ({
        ...item,
        done: checklistPatch?.[item.id] !== undefined ? Boolean(checklistPatch[item.id]) : item.done,
      }));
      const allDone = checklist.every((item) => item.done);
      const updated: Project = {
        ...project,
        handoff: {
          ...project.handoff,
          checklist,
          // The state only advances once every checklist item is genuinely complete.
          state: allDone && project.handoff.state === 'pending' ? 'accepted' : project.handoff.state,
        },
        updatedAt: new Date().toISOString(),
      };
      db.put('projects', updated);
      return ok(updated);
    },

    phases: async (projectId) => {
      await delay(`project-phases:${projectId}`);
      const project = projectById(projectId);
      const items = project ? phasesFor(project) : [];
      return { items, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },

    tasks: (projectId, query) => tasksCrud.list({ ...(query ?? {}), ...equalsClause('projectId', projectId, `tasks-${projectId}`) }),

    createTask: async (projectId, input) => {
      const project = projectById(projectId);
      if (!project) return err<ProjectTask>('not_found', 'Project not found.');
      return tasksCrud.create({ ...(input as object), projectId, projectName: project.name } as unknown as ProjectTask);
    },

    updateTask: (taskId, patch) => tasksCrud.update(taskId, patch),

    moveTask: async (taskId, status) => {
      await delay(`project-task-move:${taskId}`);
      const task = db.state.projectTasks[taskId];
      if (!task) return err<ProjectTask>('not_found', 'Task not found.');
      const updated: ProjectTask = {
        ...task,
        status,
        completedAt: status === 'done' ? new Date().toISOString() : task.completedAt,
        progressPercent: status === 'done' ? 100 : task.progressPercent,
        updatedAt: new Date().toISOString(),
      };
      db.put('projectTasks', updated);
      return ok(updated);
    },

    milestones: (projectId) => milestonesCrud.list(equalsClause('projectId', projectId, `ms-${projectId}`)),

    completeMilestone: async (projectId, milestoneId) => {
      await delay(`project-milestone:${milestoneId}`);
      const milestone = db.state.projectMilestones[milestoneId];
      if (!milestone || milestone.projectId !== projectId) return err<ProjectMilestone>('not_found', 'Milestone not found.');
      const updated: ProjectMilestone = {
        ...milestone,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.transaction((draft) => {
        draft.projectMilestones[milestoneId] = updated;
        const project = draft.projects[projectId];
        if (project) {
          project.completedMilestoneCount = Math.min(project.milestoneCount, project.completedMilestoneCount + 1);
          project.updatedAt = new Date().toISOString();
        }
      });
      return ok(updated);
    },

    deliverables: async (projectId) => {
      await delay(`project-deliverables:${projectId}`);
      const project = projectById(projectId);
      const items = project ? deliverablesFor(project) : [];
      return { items, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },

    risks: async (projectId) => {
      await delay(`project-risks:${projectId}`);
      const project = projectById(projectId);
      const items = project ? risksFor(project) : [];
      return { items, meta: { page: 1, pageSize: 25, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } };
    },

    timeline: async (projectId) => {
      await delay(`project-timeline:${projectId}`);
      const project = projectById(projectId);
      if (!project) return err<ProjectTimeline>('not_found', 'Project not found.');

      const phaseBars: ProjectTimeline['bars'] = phasesFor(project).map((phase) => ({
        id: phase.id,
        kind: 'phase',
        label: phase.name,
        startDate: phase.startDate ?? project.startDate,
        endDate: phase.endDate ?? project.targetEndDate,
        progressPercent: phase.progressPercent,
        tone: phase.tone,
        dependsOnIds: [],
        depth: 0,
        parentId: undefined,
        status: phase.status,
      }));

      const milestoneBars: ProjectTimeline['bars'] = milestonesFor(project.id).map((milestone) => ({
        id: milestone.id,
        kind: 'milestone',
        label: milestone.name,
        startDate: addDaysIso(milestone.dueDate, -5),
        endDate: milestone.dueDate,
        progressPercent: milestone.status === 'completed' ? 100 : milestone.status === 'at_risk' ? 50 : 0,
        tone: milestone.status === 'completed' ? 'green' : milestone.status === 'at_risk' ? 'amber' : 'slate',
        dependsOnIds: [],
        depth: 1,
        parentId: phaseBars[phaseBars.length - 1]?.id,
        status: milestone.status,
      }));

      const taskBars: ProjectTimeline['bars'] = tasksFor(project.id)
        .filter((task) => task.status !== 'cancelled')
        .map((task) => ({
          id: task.id,
          kind: 'task',
          label: task.title,
          startDate: task.startDate ?? project.startDate,
          endDate: task.dueDate ?? project.targetEndDate,
          progressPercent: task.progressPercent,
          tone: task.status === 'blocked' ? 'red' : task.status === 'done' ? 'green' : 'blue',
          dependsOnIds: task.dependsOnIds,
          depth: 2,
          parentId: task.phaseId,
          status: task.status,
        }));

      const timeline: ProjectTimeline = {
        projectId,
        startDate: project.startDate,
        endDate: project.targetEndDate,
        bars: [...phaseBars, ...milestoneBars, ...taskBars],
        todayMarker: toDateString(DATASET_EPOCH),
        criticalPathIds: taskBars.filter((bar) => bar.status !== 'done').map((bar) => bar.id),
      };
      return ok(timeline);
    },
  };
}

/* ---------------------------------------------------------------- field sales */

const OUTCOME_META: Array<{ outcome: VisitLog['outcome']; label: string; tone: Tone }> = [
  { outcome: 'positive', label: 'Positive', tone: 'green' },
  { outcome: 'neutral', label: 'Neutral', tone: 'slate' },
  { outcome: 'follow_up_required', label: 'Follow-up required', tone: 'amber' },
  { outcome: 'negative', label: 'Negative', tone: 'red' },
  { outcome: 'no_contact', label: 'No contact', tone: 'red' },
];

export function makeFieldSalesService(db: Db): ServiceContainer['fieldSales'] {
  const territoriesCrud = createCrud<Territory>(db, 'territories', {
    label: 'Territory',
    searchFields: ['name', 'code', 'description'],
    facetField: 'kind',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });
  const visitPlansCrud = createCrud<VisitPlan>(db, 'visitPlans', {
    label: 'Visit plan',
    searchFields: ['name', 'userName', 'territoryName'],
    facetField: 'status',
    defaultSort: [{ field: 'date', direction: 'desc' }],
  });

  const accountsInScope = () => asRecords<import('@crm/shared-types').Account>(db, 'accounts');
  const visitLogsAll = () => asRecords<VisitLog>(db, 'visitLogs');

  /** Accounts explicitly assigned through `assignAccounts`, kept for this session. */
  const assignedAccounts = new Map<Id, Set<Id>>();

  return {
    overview: async (_query) => {
      await delay('field-sales-overview');
      const territories = asRecords<Territory>(db, 'territories');
      const plans = asRecords<VisitPlan>(db, 'visitPlans');
      const logs = visitLogsAll();
      const accounts = accountsInScope();
      const currency = territories[0]?.wonValue.currency ?? 'USD';
      const monthStart = toDateString(new Date(DATASET_EPOCH.getTime() - 30 * 86_400_000));
      const recentLogs = logs.filter((log) => log.checkIn.at.slice(0, 10) >= monthStart);
      const plannedStops = plans.reduce((sum, plan) => sum + plan.stops.length, 0);
      const completedStops = plans.reduce((sum, plan) => sum + plan.stops.filter((stop) => stop.status === 'visited').length, 0);
      const reps = [...new Set(plans.map((plan) => plan.userId))];
      const orders = recentLogs.filter((log) => log.orderPlaced);
      const revenueFromVisits = orders.reduce((sum, log) => sum + (log.orderPlaced?.value.amount ?? 0), 0);
      const coveredAccountIds = new Set(recentLogs.map((log) => log.accountId));
      const totalAccounts = territories.reduce((sum, territory) => sum + territory.accountCount, 0);

      const byRep = reps.map((userId) => {
        const ownPlans = plans.filter((plan) => plan.userId === userId);
        const ownLogs = recentLogs.filter((log) => log.userId === userId);
        const ownPlanned = ownPlans.reduce((sum, plan) => sum + plan.stops.length, 0);
        const ownCompleted = ownPlans.reduce((sum, plan) => sum + plan.stops.filter((stop) => stop.status === 'visited').length, 0);
        const repOrders = ownLogs.filter((log) => log.orderPlaced);
        return {
          userId,
          name: ownPlans[0]?.userName ?? 'Representative',
          visits: ownLogs.length,
          targetVisits: ownPlanned,
          completionPercent: ownPlanned > 0 ? Math.round((ownCompleted / ownPlanned) * 100) : 0,
          accountsVisited: new Set(ownLogs.map((log) => log.accountId)).size,
          orders: repOrders.length,
          revenue: repOrders.reduce((sum, log) => sum + (log.orderPlaced?.value.amount ?? 0), 0),
          durationMinutes: ownLogs.reduce((sum, log) => sum + log.durationMinutes, 0),
        };
      });

      const visitTrend = Array.from({ length: 14 }, (_, index) => {
        const day = toDateString(new Date(DATASET_EPOCH.getTime() - (13 - index) * 86_400_000));
        return {
          date: day,
          planned: plans.filter((plan) => plan.date === day).reduce((sum, plan) => sum + plan.stops.length, 0),
          completed: logs.filter((log) => log.checkIn.at.slice(0, 10) === day).length,
          orders: logs.filter((log) => log.checkIn.at.slice(0, 10) === day && log.orderPlaced).length,
        };
      });

      const byTerritory = territories.map((territory) => {
        const memberLogs = logs.filter((log) => territory.memberIds.includes(log.userId));
        return {
          territoryId: territory.id,
          name: territory.name,
          accounts: territory.accountCount,
          contacts: accounts.filter((account) => account.ownerId && territory.memberIds.includes(account.ownerId)).length,
          visits: memberLogs.length,
          targetVisits: territory.visitTargetPerMonth,
          coveragePercent: territory.coveragePercent,
          wonValue: territory.wonValue,
          quota: territory.quota ?? money(0, currency),
          attainmentPercent: territory.attainmentPercent,
          tone: territory.tone,
          memberCount: territory.memberIds.length,
        };
      });

      // Coverage gaps: covered accounts older than 30 days or never visited.
      const coverageGaps = accounts
        .map((account) => {
          const lastLog = [...logs].filter((log) => log.accountId === account.id).sort((a, b) => (a.checkIn.at < b.checkIn.at ? 1 : -1))[0];
          const territory = territories.find((candidate) => account.ownerId && candidate.memberIds.includes(account.ownerId));
          return {
            accountId: account.id,
            accountName: account.name,
            territoryName: territory?.name ?? 'Unassigned',
            daysSinceLastVisit: lastLog ? daysSince(lastLog.checkIn.at, DATASET_EPOCH) : 999,
            potentialValue: account.totalRevenueWon ?? money(0, currency),
            isTerritory: Boolean(territory),
          };
        })
        .filter((entry) => entry.isTerritory && entry.daysSinceLastVisit > 30)
        .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)
        .slice(0, 10)
        .map(({ isTerritory: _ignored, ...entry }) => entry);

      const topAccountsByActivity = [...new Set(logs.map((log) => log.accountId))]
        .map((accountId) => {
          const accountLogs = logs.filter((log) => log.accountId === accountId);
          return {
            accountId,
            accountName: accountLogs[0]?.accountName ?? 'Account',
            visits: accountLogs.length,
            lastVisitAt: accountLogs.map((log) => log.checkIn.at).sort().at(-1),
            revenue: accountLogs.reduce((sum, log) => sum + (log.orderPlaced?.value.amount ?? 0), 0),
          };
        })
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 8);

      const overview: FieldSalesOverview = {
        currency,
        periodLabel: 'Last 30 days',
        metrics: {
          visitsCompleted: completedStops,
          visitsPlanned: plannedStops,
          visitCompletionPercent: plannedStops > 0 ? Math.round((completedStops / plannedStops) * 100) : 0,
          averageVisitsPerRep: reps.length > 0 ? Math.round((completedStops / reps.length) * 10) / 10 : 0,
          averageVisitDurationMinutes: logs.length > 0 ? Math.round(logs.reduce((sum, log) => sum + log.durationMinutes, 0) / logs.length) : 0,
          accountsCovered: coveredAccountIds.size,
          coveragePercent: totalAccounts > 0 ? Math.round((coveredAccountIds.size / totalAccounts) * 100) : 0,
          ordersFromVisits: orders.length,
          revenueFromVisits: money(revenueFromVisits, currency),
          territoryAttainmentPercent: territories.length > 0 ? Math.round(territories.reduce((sum, territory) => sum + territory.attainmentPercent, 0) / territories.length) : 0,
          travelMinutesPerVisit: plans.length > 0 ? Math.round(plans.reduce((sum, plan) => sum + plan.route.estimatedDriveMinutes, 0) / Math.max(1, completedStops)) : 0,
        },
        byTerritory,
        byRep,
        visitTrend,
        outcomesBreakdown: OUTCOME_META.map((meta) => ({
          outcome: meta.outcome,
          label: meta.label,
          count: logs.filter((log) => log.outcome === meta.outcome).length,
          tone: meta.tone,
        })),
        topAccountsByActivity,
        coverageGaps,
      };
      return ok(overview);
    },

    territories: (query) => territoriesCrud.list(query),
    updateTerritory: (id, patch) => territoriesCrud.update(id, patch),

    assignAccounts: async (territoryId, accountIds) => {
      await delay(`territory-assign:${territoryId}`);
      const territory = db.state.territories[territoryId];
      if (!territory) return err<Territory>('not_found', 'Territory not found.');
      const existing = assignedAccounts.get(territoryId) ?? new Set<Id>();
      let added = 0;
      for (const accountId of accountIds) {
        if (!existing.has(accountId)) {
          existing.add(accountId);
          added += 1;
        }
      }
      assignedAccounts.set(territoryId, existing);
      const updated: Territory = {
        ...territory,
        accountCount: territory.accountCount + added,
        updatedAt: new Date().toISOString(),
      };
      db.put('territories', updated);
      return ok(updated);
    },

    visitPlans: (query) => visitPlansCrud.list(query),
    createVisitPlan: (input) => visitPlansCrud.create(input),

    reorderStops: async (planId, orderedStopIds) => {
      await delay(`visit-plan-reorder:${planId}`);
      const plan = db.state.visitPlans[planId];
      if (!plan) return err<VisitPlan>('not_found', 'Visit plan not found.');
      const ranked = [...plan.stops].sort((a, b) => {
        const aIndex = orderedStopIds.indexOf(a.id);
        const bIndex = orderedStopIds.indexOf(b.id);
        return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
      });
      const stops = ranked.map((stop, index) => ({ ...stop, order: index + 1 }));
      const updated: VisitPlan = { ...plan, stops, updatedAt: new Date().toISOString() };
      db.put('visitPlans', updated);
      return ok(updated);
    },

    checkIn: async (stopId, payload) => {
      await delay(`visit-checkin:${stopId}`);
      // Resolve the stop from its plan so the log carries the real account and contact.
      const plan = asRecords<VisitPlan>(db, 'visitPlans').find((candidate) => candidate.stops.some((stop) => stop.id === stopId));
      const stop = plan?.stops.find((candidate) => candidate.id === stopId);
      if (!plan || !stop) return err<VisitLog>('not_found', 'That scheduled stop could not be found.');

      const now = new Date().toISOString();
      const log: VisitLog = {
        id: nextId('vlog'),
        organizationId: plan.organizationId,
        accountId: stop.accountId,
        accountName: stop.accountName,
        contactId: stop.contactId,
        contactName: stop.contactName,
        userId: plan.userId,
        userName: plan.userName,
        visitPlanId: plan.id,
        visitStopId: stop.id,
        checkIn: {
          at: now,
          locationLabel: payload.locationLabel,
          locationSource: payload.locationSource,
          coordinatesPlaceholder: undefined,
          // Explicit: nothing read a device location.
          gpsUsed: false,
          note: 'Location label recorded manually. No device location was collected and no map provider was contacted.',
        },
        checkOut: undefined,
        durationMinutes: 0,
        purpose: stop.purpose,
        outcome: 'neutral',
        summary: 'Checked in. Visit notes have not been completed yet.',
        productsDiscussed: [],
        competitorsMentioned: undefined,
        samplesGiven: undefined,
        orderPlaced: undefined,
        issuesRaised: [],
        nextSteps: [],
        followUpTaskId: undefined,
        photos: undefined,
        signatureCapture: undefined,
        expenseTotal: undefined,
        createdAt: now,
        updatedAt: now,
      };

      db.transaction((draft) => {
        draft.visitLogs[log.id] = log;
        const targetPlan = draft.visitPlans[plan.id];
        if (targetPlan) {
          targetPlan.stops = targetPlan.stops.map((candidate) =>
            candidate.id === stop.id ? { ...candidate, status: 'visited', visitLogId: log.id } : candidate,
          );
          targetPlan.status = 'in_progress';
          targetPlan.updatedAt = now;
        }
      });
      return ok(log);
    },

    completeVisit: async (logId, payload) => {
      await delay(`visit-complete:${logId}`);
      const log = db.state.visitLogs[logId];
      if (!log) return err<VisitLog>('not_found', 'Visit log not found.');
      const startedAt = new Date(log.checkIn.at).getTime();
      const durationMinutes =
        payload.durationMinutes ?? (Number.isNaN(startedAt) ? 0 : Math.max(1, Math.round((Date.now() - startedAt) / 60_000)));
      const updated: VisitLog = {
        ...log,
        ...payload,
        id: log.id,
        checkIn: log.checkIn,
        checkOut: { at: new Date().toISOString(), durationMinutes },
        durationMinutes,
        updatedAt: new Date().toISOString(),
      };
      db.put('visitLogs', updated);
      return ok(updated);
    },

    visitLogs: async (query) => {
      const all = visitLogsAll();
      return runQuery(all, query ?? {}, {
        searchFields: ['accountName', 'userName', 'summary'],
        facetField: 'outcome',
        defaultSort: [{ field: 'createdAt', direction: 'desc' }],
      });
    },
  };
}

/* ------------------------------------------------------------------ partners */

const TIER_LABELS: Record<Partner['tier'], string> = {
  registered: 'Registered',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  strategic: 'Strategic',
};
const TIER_TONES: Record<Partner['tier'], Tone> = {
  registered: 'slate',
  silver: 'slate',
  gold: 'amber',
  platinum: 'teal',
  strategic: 'violet',
};
const TYPE_LABELS: Record<Partner['type'], string> = {
  reseller: 'Reseller',
  referral: 'Referral',
  distributor: 'Distributor',
  technology: 'Technology',
  implementation: 'Implementation',
  agency: 'Agency',
  consulting: 'Consulting',
};

export function makePartnersService(db: Db): ServiceContainer['partners'] {
  const partnersCrud = createCrud<Partner>(db, 'partners', {
    label: 'Partner',
    searchFields: ['name', 'type', 'region'],
    facetField: 'tier',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });

  const partnersAll = () => asRecords<Partner>(db, 'partners');
  const registrationsAll = () => asRecords<import('@crm/shared-types').DealRegistration>(db, 'dealRegistrations');
  const dealsAll = () => asRecords<Deal>(db, 'deals');

  /** Referrals are derived once, then read from this cache so updates persist for the session. */
  const referralOverrides = new Map<Id, Referral>();
  let referralCache: Referral[] | null = null;

  function deriveReferrals(): Referral[] {
    if (referralCache) return referralCache;
    const accounts = asRecords<import('@crm/shared-types').Account>(db, 'accounts');
    const partners = partnersAll();
    referralCache = partners.flatMap((partner, partnerIndex) =>
      Array.from({ length: (hash(partner.id) % 3) + 1 }, (_, index) => {
        const account = accounts[(partnerIndex + index * 3) % Math.max(1, accounts.length)];
        const status = (['new', 'contacted', 'qualified', 'converted', 'rejected'] as const)[(hash(partner.id) + index) % 5]!;
        const receivedAt = new Date(DATASET_EPOCH.getTime() - ((hash(partner.id) + index * 5) % 90) * 86_400_000).toISOString();
        const referral: Referral = {
          id: `ref-${partner.id}-${index + 1}`,
          organizationId: partner.organizationId,
          reference: `REF-${String(1000 + partnerIndex * 10 + index)}`,
          referrerKind: 'partner',
          referrerId: partner.id,
          referrerName: partner.name,
          referredCompanyName: account?.name ?? `${partner.name} referral`,
          referredContactName: 'Named contact on the referral',
          referredEmail: `referral@${(account?.domains[0] ?? 'example.com').replace(/^https?:\/\//, '')}`,
          status,
          receivedAt,
          leadId: undefined,
          dealId: undefined,
          rewardAmount: partner.tier === 'registered' ? undefined : money(250 + (hash(partner.id) % 6) * 100, partner.currency),
          rewardStatus: status === 'converted' ? 'paid' : status === 'qualified' ? 'approved' : status === 'rejected' ? 'declined' : 'pending',
          notes: undefined,
          createdAt: receivedAt,
          updatedAt: receivedAt,
        };
        return referral;
      }),
    );
    return referralCache;
  }

  return {
    overview: async (_query) => {
      await delay('partners-overview');
      const partners = partnersAll();
      const registrations = registrationsAll();
      const currency = partners[0]?.currency ?? 'USD';
      const approved = registrations.filter((registration) => registration.status === 'approved' || registration.status === 'converted');
      const sourced = partners.reduce((sum, partner) => sum + partner.metrics.revenueClosed.amount, 0);
      const influenced = partners.reduce((sum, partner) => sum + partner.metrics.revenueInfluenced.amount, 0);
      const commissionsAccrued = partners.reduce((sum, partner) => sum + partner.metrics.commissionEarned.amount, 0);
      const commissionsPending = partners.reduce((sum, partner) => sum + partner.metrics.commissionPending.amount, 0);
      const totalRevenue = Math.max(1, sourced + influenced);

      const tiers = Object.keys(TIER_LABELS) as Partner['tier'][];
      const types = Object.keys(TYPE_LABELS) as Partner['type'][];
      const registrationsByDay = Array.from({ length: 14 }, (_, index) => {
        const day = toDateString(new Date(DATASET_EPOCH.getTime() - (13 - index) * 86_400_000));
        return {
          date: day,
          submitted: registrations.filter((registration) => registration.submittedAt.slice(0, 10) === day).length,
          approved: approved.filter((registration) => (registration.reviewedAt ?? '').slice(0, 10) === day).length,
          rejected: registrations.filter((registration) => registration.status === 'rejected' && (registration.reviewedAt ?? '').slice(0, 10) === day).length,
        };
      });

      const overview: PartnerOverview = {
        currency,
        periodLabel: 'This quarter',
        metrics: {
          activePartners: partners.filter((partner) => partner.status === 'active').length,
          partnersOnboarding: partners.filter((partner) => partner.status === 'onboarding').length,
          registrationsSubmitted: registrations.length,
          registrationsApproved: approved.length,
          approvalRate: registrations.length > 0 ? Math.round((approved.length / registrations.length) * 100) : 0,
          partnerSourcedRevenue: money(sourced, currency),
          partnerInfluencedRevenue: money(influenced, currency),
          partnerRevenueSharePercent: Math.round((sourced / totalRevenue) * 100),
          commissionsAccrued: money(commissionsAccrued, currency),
          commissionsPending: money(commissionsPending, currency),
          averageDealSize: money(
            partners.length > 0 ? Math.round(sourced / Math.max(1, partners.reduce((sum, partner) => sum + partner.metrics.wonDeals, 0))) : 0,
            currency,
          ),
          partnerWinRate: partners.length > 0 ? Math.round(partners.reduce((sum, partner) => sum + partner.metrics.winRate, 0) / partners.length) : 0,
        },
        byTier: tiers.map((tier) => {
          const scoped = partners.filter((partner) => partner.tier === tier);
          return {
            tier,
            label: TIER_LABELS[tier],
            partners: scoped.length,
            revenue: scoped.reduce((sum, partner) => sum + partner.metrics.revenueClosed.amount, 0),
            deals: scoped.reduce((sum, partner) => sum + partner.metrics.wonDeals, 0),
            tone: TIER_TONES[tier],
          };
        }),
        byType: types.map((type) => {
          const scoped = partners.filter((partner) => partner.type === type);
          return {
            type,
            label: TYPE_LABELS[type],
            partners: scoped.length,
            revenue: scoped.reduce((sum, partner) => sum + partner.metrics.revenueClosed.amount, 0),
          };
        }),
        byRegion: [...new Set(partners.map((partner) => partner.region))].map((region) => {
          const scoped = partners.filter((partner) => partner.region === region);
          return {
            region,
            partners: scoped.length,
            revenue: scoped.reduce((sum, partner) => sum + partner.metrics.revenueClosed.amount, 0),
            growthPercent: ((hash(region) % 24) - 6),
          };
        }),
        leaderboard: [...partners]
          .sort((a, b) => b.metrics.revenueClosed.amount - a.metrics.revenueClosed.amount)
          .slice(0, 8)
          .map((partner) => ({
            partnerId: partner.id,
            name: partner.name,
            tier: partner.tier,
            revenue: partner.metrics.revenueClosed,
            deals: partner.metrics.wonDeals,
            winRate: partner.metrics.winRate,
            registrations: partner.metrics.registeredDeals,
          })),
        registrationTrend: registrationsByDay,
        revenueTrend: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((month, index) => ({
          month,
          sourced: Math.round((sourced / 6) * (0.7 + index * 0.12)),
          influenced: Math.round((influenced / 6) * (0.7 + index * 0.12)),
        })),
        topRegistrations: [...registrations].sort((a, b) => b.estimatedValue.amount - a.estimatedValue.amount).slice(0, 5),
        sampleProducts: dealsAll().flatMap((deal) => deal.products).slice(0, 8) as DealProductLine[],
      };
      return ok(overview);
    },

    list: (query) => partnersCrud.list(query),
    get: (id) => partnersCrud.get(id),
    update: (id, input) => partnersCrud.update(id, input),

    completeOnboardingStep: async (partnerId, stepId) => {
      await delay(`partner-step:${partnerId}`);
      const partner = db.state.partners[partnerId];
      if (!partner) return err<Partner>('not_found', 'Partner not found.');
      const checklist = partner.onboarding.checklist.map((item) => (item.id === stepId ? { ...item, done: true } : item));
      const done = checklist.filter((item) => item.done).length;
      const required = checklist.filter((item) => item.required);
      const requiredDone = required.every((item) => item.done);
      const updated: Partner = {
        ...partner,
        onboarding: {
          checklist,
          progressPercent: checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0,
          state: requiredDone && done === checklist.length ? 'completed' : 'in_progress',
        },
        updatedAt: new Date().toISOString(),
      };
      db.put('partners', updated);
      return ok(updated);
    },

    registrations: async (query) => {
      const all = registrationsAll();
      return runQuery(all, query ?? {}, {
        searchFields: ['reference', 'dealName', 'partnerName', 'accountName'],
        facetField: 'status',
        defaultSort: [{ field: 'submittedAt', direction: 'desc' }],
      });
    },

    submitRegistration: async (input) => {
      await delay('partner-registration');
      const candidate = input as unknown as Omit<import('@crm/shared-types').DealRegistration, 'id' | 'createdAt' | 'updatedAt'>;
      const accountId = candidate.accountId;
      const conflicts: import('@crm/shared-types').DealRegistration['conflictChecks'] = [];

      const rival = registrationsAll().find(
        (registration) =>
          registration.accountId === accountId &&
          ['submitted', 'under_review', 'approved', 'converted'].includes(registration.status) &&
          registration.partnerId !== candidate.partnerId,
      );
      if (rival) {
        conflicts.push({
          kind: 'existing_registration',
          severity: 'blocking',
          label: `An active registration for this account already exists (${rival.reference}).`,
          referenceId: rival.id,
          referenceLabel: rival.partnerName,
        });
      }

      const openDeal = dealsAll().find((deal) => deal.accountId === accountId && deal.status === 'open');
      if (openDeal) {
        conflicts.push({
          kind: 'existing_deal',
          severity: 'warning',
          label: `An open deal already exists for this account: ${openDeal.name}.`,
          referenceId: openDeal.id,
          referenceLabel: openDeal.name,
        });
      }

      const account = db.state.accounts[accountId];
      if (account?.ownerId) {
        conflicts.push({
          kind: 'existing_account_owner',
          severity: 'info',
          label: 'The account is already owned by an internal representative.',
          referenceId: account.ownerId,
          referenceLabel: db.state.users[account.ownerId]?.displayName,
        });
      }

      const blocking = conflicts.some((conflict) => conflict.severity === 'blocking');
      const id = nextId('dr');
      const registration: import('@crm/shared-types').DealRegistration = {
        ...candidate,
        id,
        reference: candidate.reference || `DR-${id.slice(-6).toUpperCase()}`,
        status: blocking ? 'conflict' : 'submitted',
        submittedAt: new Date().toISOString(),
        conflictChecks: conflicts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('dealRegistrations', registration);
      return ok(registration);
    },

    decideRegistration: async (id, decision, notes) => {
      await delay(`partner-registration-decide:${id}`);
      const registration = db.state.dealRegistrations[id];
      if (!registration) return err<import('@crm/shared-types').DealRegistration>('not_found', 'Registration not found.');
      const updated: import('@crm/shared-types').DealRegistration = {
        ...registration,
        status: decision,
        reviewNotes: notes,
        reviewedById: Object.keys(db.state.users)[0],
        reviewedAt: new Date().toISOString(),
        protectionExpiresAt:
          decision === 'approved'
            ? toDateString(new Date(DATASET_EPOCH.getTime() + registration.protectionDays * 86_400_000))
            : registration.protectionExpiresAt,
        updatedAt: new Date().toISOString(),
      };
      db.put('dealRegistrations', updated);
      return ok(updated);
    },

    convertRegistration: async (id) => {
      await delay(`partner-registration-convert:${id}`, { latency: { min: 240, max: 520 } });
      const registration = db.state.dealRegistrations[id];
      if (!registration) return err<{ registration: import('@crm/shared-types').DealRegistration; deal: Deal }>('not_found', 'Registration not found.');
      if (registration.status === 'rejected' || registration.status === 'expired') {
        return err<{ registration: import('@crm/shared-types').DealRegistration; deal: Deal }>(
          'validation_failed',
          'Only a submitted, approved or under-review registration can become a deal.',
        );
      }

      const pipeline = Object.values(db.state.pipelines)[0];
      if (!pipeline) return err<{ registration: import('@crm/shared-types').DealRegistration; deal: Deal }>('not_found', 'No pipeline is configured.');
      const stage = pipeline.stages.find((candidate) => candidate.kind === 'open') ?? pipeline.stages[0];
      if (!stage) return err<{ registration: import('@crm/shared-types').DealRegistration; deal: Deal }>('validation_failed', 'This pipeline has no stages.');

      const now = new Date().toISOString();
      const dealId = nextId('deal');
      const deal: Deal = {
        id: dealId,
        organizationId: registration.organizationId,
        reference: `D-${dealId.slice(-6).toUpperCase()}`,
        name: registration.dealName,
        accountId: registration.accountId,
        accountName: registration.accountName,
        pipelineId: pipeline.id,
        stageId: stage.id,
        status: 'open',
        amount: registration.estimatedValue,
        pipelineCurrency: pipeline.currency,
        probability: stage.probability,
        forecastCategory: stage.forecastCategory,
        expectedCloseDate: registration.expectedCloseDate,
        dealType: 'new_business',
        ownerId: registration.reviewedById ?? Object.keys(db.state.users)[0]!,
        teamMembers: [],
        products: [],
        competitorIds: [],
        stageEnteredAt: now,
        daysInStage: 0,
        isStale: false,
        tags: [],
        customFields: {},
        notes: `Created from partner registration ${registration.reference}.`,
        createdAt: now,
        updatedAt: now,
      };
      const updatedRegistration: import('@crm/shared-types').DealRegistration = {
        ...registration,
        status: 'converted',
        convertedDealId: dealId,
        updatedAt: now,
      };

      db.transaction((draft) => {
        draft.deals[dealId] = deal;
        draft.dealRegistrations[id] = updatedRegistration;
      });
      return ok({ registration: updatedRegistration, deal });
    },

    referrals: async (query) => {
      const overrides = referralOverrides;
      const all = deriveReferrals().map((referral) => overrides.get(referral.id) ?? referral);
      return runQuery(all, query ?? {}, {
        searchFields: ['reference', 'referrerName', 'referredCompanyName'],
        facetField: 'status',
        defaultSort: [{ field: 'receivedAt', direction: 'desc' }],
      });
    },

    updateReferral: async (id, patch) => {
      await delay(`referral-update:${id}`);
      const existing = referralOverrides.get(id) ?? deriveReferrals().find((referral) => referral.id === id);
      if (!existing) return err<Referral>('not_found', 'Referral not found.');
      const updated: Referral = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
      referralOverrides.set(id, updated);
      return ok(updated);
    },

    commissions: async (query) => {
      await delay('partner-commissions');
      const partners = partnersAll();
      const periodStart = toDateString(new Date(DATASET_EPOCH.getTime() - 90 * 86_400_000));
      const periodEnd = toDateString(DATASET_EPOCH);
      const items: PartnerCommission[] = partners.map((partner, index) => {
        const basisAmount = partner.metrics.revenueClosed;
        const ratePercent = 5 + (hash(partner.id) % 5);
        const status = (['accrued', 'pending_approval', 'approved', 'invoiced', 'paid', 'disputed'] as const)[(hash(partner.id) + index) % 6]!;
        return {
          id: `pcm-${partner.id}`,
          organizationId: partner.organizationId,
          partnerId: partner.id,
          partnerName: partner.name,
          dealId: undefined,
          dealName: undefined,
          accountName: undefined,
          periodStart,
          periodEnd,
          basis: 'revenue',
          basisAmount,
          ratePercent,
          amount: money(Math.round((basisAmount.amount * ratePercent) / 100), partner.currency),
          status,
          approvedByName: status === 'accrued' || status === 'pending_approval' ? undefined : partner.programManagerName,
          paidAt: status === 'paid' ? new Date(DATASET_EPOCH.getTime() - 20 * 86_400_000).toISOString() : undefined,
          currency: partner.currency,
          // Presentation-only: no finance system calculated this.
          calculationState: 'demo_local_calculation',
          createdAt: partner.partnerSince ?? partner.createdAt,
          updatedAt: partner.updatedAt,
        };
      });
      return runQuery(items, query ?? {}, {
        searchFields: ['partnerName'],
        facetField: 'status',
        defaultSort: [{ field: 'periodEnd', direction: 'desc' }],
      });
    },
  };
}
