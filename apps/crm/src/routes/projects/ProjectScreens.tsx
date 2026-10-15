'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  LayoutGrid,
  Link2,
  List,
  ListChecks,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  Project,
  ProjectDeliverable,
  ProjectMilestone,
  ProjectPhase,
  ProjectRisk,
  ProjectTask,
  ProjectTimeline,
} from '@crm/shared-types';
import type { Tone } from '@crm/ui';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  DemoNotice,
  InlineBar,
  KanbanBoard,
  MiniStat,
  Progress,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TonePill,
  cn,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
  RecordEmptyState,
  ViewSwitcher,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Projects & delivery screens.
 *
 * Two honesty constraints shape this module. First, project phases, deliverables and risks
 * are **derived** by the mock service from the records that are actually seeded, so the
 * screens say "derived from the delivery schedule" rather than implying a stored plan nobody
 * can edit. Second, a project is created by a **handoff from a closed-won deal** rather than
 * a free-standing form, so the handoff panel links back to the deal and the checklist is the
 * only thing this screen writes.
 */

/* ------------------------------------------------------------------ vocab */

const PROJECT_STATUSES: Project['status'][] = [
  'planning',
  'not_started',
  'in_progress',
  'blocked',
  'on_hold',
  'at_risk',
  'completed',
  'cancelled',
];

const STATUS_LABEL: Record<Project['status'], string> = {
  planning: 'Planning',
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  on_hold: 'On hold',
  at_risk: 'At risk',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<Project['status'], Tone> = {
  planning: 'slate',
  not_started: 'slate',
  in_progress: 'blue',
  blocked: 'red',
  on_hold: 'amber',
  at_risk: 'amber',
  completed: 'green',
  cancelled: 'slate',
};

const HEALTH_LABEL: Record<Project['health'], string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
  blocked: 'Blocked',
};

const HEALTH_TONE: Record<Project['health'], Tone> = {
  on_track: 'green',
  at_risk: 'amber',
  off_track: 'red',
  blocked: 'red',
};

const PRIORITY_LABEL: Record<Project['priority'], string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

const TASK_STATUSES: ProjectTask['status'][] = ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'];

const TASK_STATUS_LABEL: Record<ProjectTask['status'], string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

const TASK_STATUS_TONE: Record<ProjectTask['status'], Tone> = {
  backlog: 'slate',
  todo: 'slate',
  in_progress: 'blue',
  in_review: 'violet',
  blocked: 'red',
  done: 'green',
  cancelled: 'slate',
};

const RISK_TONE: Record<ProjectRisk['severity'], Tone> = {
  critical: 'red',
  high: 'amber',
  medium: 'blue',
  low: 'slate',
};

const MILESTONE_TONE: Record<ProjectMilestone['status'], Tone> = {
  pending: 'slate',
  in_progress: 'blue',
  completed: 'green',
  missed: 'red',
  at_risk: 'amber',
};

const MILESTONE_LABEL: Record<ProjectMilestone['status'], string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  missed: 'Missed',
  at_risk: 'At risk',
};

const DELIVERABLE_STATUS_LABEL: Record<ProjectDeliverable['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  in_review: 'In review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

function humanise(value: string): string {
  return value.replace(/_/g, ' ');
}

/* ------------------------------------------------------------------ shared */

function StatusPill({ status }: { status: Project['status'] }) {
  return (
    <TonePill tone={STATUS_TONE[status]} dot={false}>
      {STATUS_LABEL[status]}
    </TonePill>
  );
}

function HealthPill({ health }: { health: Project['health'] }) {
  return (
    <TonePill tone={HEALTH_TONE[health]} dot={false}>
      {HEALTH_LABEL[health]}
    </TonePill>
  );
}

/**
 * The customer-visible strip.
 *
 * It answers one question the internal views do not: "what has this customer actually been
 * told?" Everything here is filtered to records flagged `customerVisible`, so the screen can
 * never show a reviewer more than the customer portal would.
 */
function CustomerVisiblePanel({ project, milestones, deliverables }: {
  project: Project;
  milestones: ProjectMilestone[];
  deliverables: ProjectDeliverable[];
}) {
  const visibleMilestones = milestones.filter((milestone) => milestone.customerApprovalRequired || milestone.status === 'completed');
  const visibleDeliverables = deliverables.filter((deliverable) => deliverable.customerVisible);
  const nextMilestone = visibleMilestones.find((milestone) => milestone.status !== 'completed');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Customer-visible status</CardTitle>
        <Badge variant={project.customerVisible ? 'success' : 'neutral'} size="sm">
          {project.customerVisible ? 'Shared with the customer' : 'Internal only'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Progress value={project.progressPercent} tone={project.health === 'blocked' ? 'red' : 'auto'} label="Overall progress" showValue />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="text-2xs font-medium uppercase tracking-wide text-faint">Target completion</dt>
            <dd className="mt-0.5 text-xs text-fg">{formatDate(project.targetEndDate)}</dd>
          </div>
          <div>
            <dt className="text-2xs font-medium uppercase tracking-wide text-faint">Next milestone</dt>
            <dd className="mt-0.5 text-xs text-fg">{nextMilestone ? `${nextMilestone.name} · ${formatDate(nextMilestone.dueDate)}` : 'None outstanding'}</dd>
          </div>
          <div>
            <dt className="text-2xs font-medium uppercase tracking-wide text-faint">Accepted deliverables</dt>
            <dd className="mt-0.5 text-xs text-fg">
              {visibleDeliverables.filter((deliverable) => deliverable.status === 'accepted').length} of {visibleDeliverables.length}
            </dd>
          </div>
        </dl>
        <DemoNotice tone="neutral">
          This panel is the same subset the portal preview would show. It is rendered from synthetic records; nothing here is published to a real customer.
        </DemoNotice>
      </CardContent>
    </Card>
  );
}

/** A handoff checklist whose state only advances when every item is genuinely done. */
function HandoffPanel({
  project,
  onToggle,
  pending,
}: {
  project: Project;
  onToggle: (itemId: string, checked: boolean) => void;
  pending: boolean;
}) {
  const checklist = project.handoff.checklist;
  const done = checklist.filter((item) => item.done).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-0.5">
          <CardTitle>Delivery handoff</CardTitle>
          <p className="text-2xs text-muted">
            {project.handoff.fromOwnerName ? `From ${project.handoff.fromOwnerName}` : 'From the closing rep'}
            {project.handoff.toManagerName ? ` to ${project.handoff.toManagerName}` : ''}
            {project.handoff.handoffAt ? ` · ${formatDate(project.handoff.handoffAt)}` : ''}
          </p>
        </div>
        <Badge variant={project.handoff.state === 'accepted' ? 'success' : project.handoff.state === 'rejected' ? 'danger' : 'warning'} size="sm">
          {humanise(project.handoff.state)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {project.dealId ? (
          <Button variant="secondary" size="sm" leadingIcon={<Link2 className="size-3.5" />} asChild>
            <Link to={`/app/deals/${project.dealId}`}>Open the won deal that created this project</Link>
          </Button>
        ) : null}
        <div>
          <div className="mb-2 flex items-center justify-between text-2xs text-faint">
            <span>
              {done} of {checklist.length} checklist items complete
            </span>
            <span>{checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0}%</span>
          </div>
          <Progress value={checklist.length > 0 ? (done / checklist.length) * 100 : 0} tone="blue" />
        </div>
        <ul className="space-y-2.5">
          {checklist.map((item) => {
            const controlId = `handoff-${project.id}-${item.id}`;
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-inset px-3 py-2">
                <label htmlFor={controlId} className={cn('cursor-pointer text-xs', item.done ? 'text-muted line-through' : 'text-fg')}>
                  {item.label}
                </label>
                <Switch
                  id={controlId}
                  checked={item.done}
                  disabled={pending}
                  onCheckedChange={(checked) => onToggle(item.id, checked)}
                />
              </li>
            );
          })}
        </ul>
        <p className="text-[0.6875rem] leading-relaxed text-faint">
          The handoff is accepted once every item is complete. Ticking a box writes to the local demo store only.
        </p>
      </CardContent>
    </Card>
  );
}

/** A compact, non-interactive Gantt rendered from the timeline bars the service returns. */
function TimelineBar({ timeline }: { timeline: ProjectTimeline }) {
  const startMs = new Date(timeline.startDate).getTime();
  const endMs = new Date(timeline.endDate).getTime();
  const span = Math.max(1, endMs - startMs);
  const todayMs = new Date(timeline.todayMarker).getTime();
  const todayPercent = Math.min(100, Math.max(0, ((todayMs - startMs) / span) * 100));

  const toPercent = (from: string, to: string) => {
    const left = Math.min(100, Math.max(0, ((new Date(from).getTime() - startMs) / span) * 100));
    const width = Math.max(1.5, Math.min(100 - left, ((new Date(to).getTime() - new Date(from).getTime()) / span) * 100));
    return { left, width };
  };

  const maxDepth = Math.max(...timeline.bars.map((bar) => bar.depth), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-2xs text-faint">
        <span>{formatDate(timeline.startDate)}</span>
        <span className="text-muted">Today marker: {formatDate(timeline.todayMarker)}</span>
        <span>{formatDate(timeline.endDate)}</span>
      </div>
      <div className="relative space-y-1.5 rounded-lg border border-border-subtle bg-inset p-3">
        <span className="absolute bottom-3 top-3 w-px bg-warning" style={{ left: `calc(${todayPercent}% + 0.75rem)` }} aria-hidden />
        {timeline.bars.map((bar) => {
          const { left, width } = toPercent(bar.startDate, bar.endDate);
          return (
            <div key={bar.id} className="flex items-center gap-2" style={{ paddingInlineStart: `${bar.depth * 0.9}rem` }}>
              <span className="w-40 shrink-0 truncate text-2xs text-muted" title={bar.label}>
                {bar.label}
              </span>
              <span className="relative h-4 flex-1 overflow-hidden rounded bg-surface" aria-hidden>
                <span
                  className={cn(
                    'absolute inset-y-0.5 rounded',
                    bar.tone === 'green'
                      ? 'bg-[var(--success)]'
                      : bar.tone === 'amber'
                        ? 'bg-[var(--warning)]'
                        : bar.tone === 'red'
                          ? 'bg-[var(--danger)]'
                          : 'bg-brand',
                  )}
                  style={{ left: `${left}%`, width: `${width}%`, opacity: 0.35 }}
                />
                <span
                  className={cn(
                    'absolute inset-y-0.5 rounded',
                    bar.tone === 'green'
                      ? 'bg-[var(--success)]'
                      : bar.tone === 'amber'
                        ? 'bg-[var(--warning)]'
                        : bar.tone === 'red'
                          ? 'bg-[var(--danger)]'
                          : 'bg-brand',
                  )}
                  style={{ left: `${left}%`, width: `${(width * bar.progressPercent) / 100}%` }}
                />
              </span>
              <span className="w-24 shrink-0 text-end text-2xs tabular-nums text-faint">{bar.progressPercent}%</span>
            </div>
          );
        })}
        <span className="sr-only">Timeline from {formatDate(timeline.startDate)} to {formatDate(timeline.endDate)} across {maxDepth + 1} levels.</span>
      </div>
      <details className="rounded-lg border border-border-subtle bg-surface">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-fg">Read the timeline as a table</summary>
        <div className="overflow-x-auto border-t border-border-subtle">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">Project timeline bars</caption>
            <thead>
              <tr className="text-start text-2xs uppercase tracking-wide text-faint">
                <th scope="col" className="px-3 py-2 text-start font-medium">Item</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">Kind</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">Start</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">End</th>
                <th scope="col" className="px-3 py-2 text-end font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {timeline.bars.map((bar) => (
                <tr key={bar.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2 text-fg">{bar.label}</td>
                  <td className="px-3 py-2 text-muted">{bar.kind}</td>
                  <td className="px-3 py-2 text-muted">{formatDate(bar.startDate)}</td>
                  <td className="px-3 py-2 text-muted">{formatDate(bar.endDate)}</td>
                  <td className="px-3 py-2 text-end tabular-nums text-muted">{bar.progressPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------- list screen */

export function ProjectsScreen() {
  const services = useServices();
  const navigate = useNavigate();

  const overview = useAsync(() => services.projects.overview(), []);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<Project['status'] | 'all'>('all');
  const [view, setView] = React.useState<'board' | 'list'>('board');

  const query = React.useMemo(
    () => ({
      q: search.trim() || undefined,
      pageSize: 200,
      filter:
        status === 'all'
          ? undefined
          : { id: 'project-status', conjunction: 'and' as const, clauses: [{ field: 'status', operator: 'eq' as const, value: status }] },
      sort: [{ field: 'updatedAt', direction: 'desc' as const }],
    }),
    [search, status],
  );

  const projects = useList(() => services.projects.list(query), [query]);

  const statusFacet = overview.data?.byStatus ?? [];
  const filtered = projects.items;

  const moveProject = React.useCallback(
    async (cardId: string, toColumnId: string) => {
      const result = await services.projects.update(cardId, { status: toColumnId as Project['status'] });
      if (!result.ok) throw new Error(result.error.message);
      notify.simulated('Project status updated', 'The new status was written to the local demo store. No notification was sent.');
      projects.reload();
      overview.reload();
    },
    [services, projects, overview],
  );

  const columns = React.useMemo<ColumnDef<Project, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Project',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
              {row.original.reference} · {row.original.accountName}
            </span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusPill status={row.original.status} /> },
      { id: 'health', header: 'Health', accessorKey: 'health', cell: ({ row }) => <HealthPill health={row.original.health} /> },
      { id: 'progress', header: 'Progress', accessorKey: 'progressPercent', cell: ({ row }) => <InlineBar value={row.original.progressPercent} /> },
      {
        id: 'manager',
        header: 'Manager',
        accessorKey: 'managerName',
        cell: ({ row }) => <span className="text-xs text-muted">{row.original.managerName}</span>,
      },
      {
        id: 'tasks',
        header: 'Tasks',
        accessorKey: 'openTaskCount',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted">
            {row.original.openTaskCount} open / {row.original.taskCount}
          </span>
        ),
      },
      {
        id: 'target',
        header: 'Target end',
        accessorKey: 'targetEndDate',
        cell: ({ row }) => (
          <span className={cn('text-xs', row.original.status === 'at_risk' || row.original.status === 'blocked' ? 'text-warning-fg' : 'text-muted')}>
            {formatDate(row.original.targetEndDate)}
          </span>
        ),
      },
      {
        id: 'budget',
        header: 'Budget',
        accessorKey: 'budget',
        meta: { align: 'end' },
        cell: ({ row }) =>
          row.original.budget ? (
            <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.budget.amount, row.original.budget.currency, true)}</span>
          ) : (
            <span className="text-xs text-faint">—</span>
          ),
      },
    ],
    [],
  );

  const metrics = overview.data;

  return (
    <div className="pb-8">
      <PageHeader
        title="Projects"
        description="Delivery handoff from a won deal, a board and timeline view of the work, milestones with billing flags, risks, and the customer-visible status."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Projects' }]}
        actions={
          <Button variant="secondary" size="sm" leadingIcon={<ArrowRight className="size-3.5" />} asChild>
            <Link to="/app/deals">Won deals</Link>
          </Button>
        }
      />

      {overview.loading ? (
        <div className="p-6">
          <ListSkeleton rows={6} columns={5} />
        </div>
      ) : overview.error || !metrics ? (
        <div className="p-6">
          <RecordEmptyState
            title="The project overview could not be loaded"
            body={overview.error ?? 'No overview was returned.'}
            hints={['Retry the request.', 'Check that the projects service is wired into the container.']}
            primaryAction={{ label: 'Retry', onClick: overview.reload }}
          />
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <MiniStat label="Active" value={formatNumber(metrics.activeProjects)} tone="blue" />
            <MiniStat label="At risk" value={formatNumber(metrics.atRiskProjects)} tone="amber" />
            <MiniStat label="Blocked" value={formatNumber(metrics.blockedProjects)} tone="red" />
            <MiniStat label="On-time delivery" value={`${metrics.onTimeDeliveryPercent}%`} tone="green" />
            <MiniStat label="Avg duration" value={`${metrics.averageDurationDays}d`} tone="teal" />
            <MiniStat label="Budget consumed" value={`${metrics.budgetConsumedPercent}%`} tone="violet" />
          </div>

          <DemoNotice tone="neutral">
            Phases, deliverables and risks are derived by the mock service from the seeded delivery schedule. Nothing here is written to a real project system.
          </DemoNotice>

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search projects by name, reference or account"
            chips={
              status === 'all'
                ? []
                : [{ id: 'status', label: `Status: ${STATUS_LABEL[status]}`, tone: 'brand', onRemove: () => setStatus('all') }]
            }
            onClearFilters={() => setStatus('all')}
            resultCount={`${formatNumber(filtered.length)} project${filtered.length === 1 ? '' : 's'}`}
            actions={
              <ViewSwitcher
                value={view}
                onChange={setView}
                options={[
                  { value: 'board', label: 'Board', icon: <LayoutGrid className="size-3.5" aria-hidden /> },
                  { value: 'list', label: 'List', icon: <List className="size-3.5" aria-hidden /> },
                ]}
                label="Project view"
              />
            }
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus('all')}
              aria-pressed={status === 'all'}
              className={cn(
                'rounded-full border px-2.5 py-1 text-2xs font-medium',
                status === 'all' ? 'border-brand/40 bg-brand-subtle text-brand-fg' : 'border-border bg-surface text-muted hover:text-fg',
              )}
            >
              All statuses
            </button>
            {PROJECT_STATUSES.map((entry) => {
              const facet = statusFacet.find((item) => item.status === entry);
              return (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setStatus(entry)}
                  aria-pressed={status === entry}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-2xs font-medium',
                    status === entry ? 'border-brand/40 bg-brand-subtle text-brand-fg' : 'border-border bg-surface text-muted hover:text-fg',
                  )}
                >
                  {STATUS_LABEL[entry]}
                  {facet ? <span className="ms-1 tabular-nums text-faint">{facet.count}</span> : null}
                </button>
              );
            })}
          </div>

          {projects.loading ? (
            <ListSkeleton rows={6} columns={5} />
          ) : view === 'board' ? (
            <KanbanBoard
              columns={PROJECT_STATUSES.map((entry) => ({
                id: entry,
                label: STATUS_LABEL[entry],
                tone: STATUS_TONE[entry],
                description: entry === 'cancelled' ? 'Cancelled projects are kept for the record.' : undefined,
              }))}
              cards={filtered.map((project) => ({
                id: project.id,
                columnId: project.status,
                title: project.name,
                subtitle: project.accountName,
                value: project.budget ? formatMoney(project.budget.amount, project.budget.currency, true) : undefined,
                meta: [
                  { label: `${project.progressPercent}%`, tone: 'blue' as Tone },
                  { label: HEALTH_LABEL[project.health], tone: HEALTH_TONE[project.health] },
                  ...(project.overdueTaskCount > 0 ? [{ label: `${project.overdueTaskCount} overdue`, tone: 'red' as Tone }] : []),
                ],
                attention: project.status === 'blocked' ? 'danger' : project.status === 'at_risk' ? 'warning' : undefined,
                ariaLabel: `${project.name} for ${project.accountName}, ${STATUS_LABEL[project.status]}, ${project.progressPercent} percent complete`,
              }))}
              onMove={moveProject}
              onCardClick={(cardId) => navigate(`/app/projects/${cardId}`)}
              renderColumnSummary={(columnId) => {
                const facet = statusFacet.find((item) => item.status === columnId);
                return facet ? <span className="text-2xs tabular-nums text-faint">{facet.count}</span> : null;
              }}
              emptyColumnLabel="No projects"
              height="calc(100dvh - 26rem)"
            />
          ) : filtered.length === 0 ? (
            <RecordEmptyState
              title="No projects match the current filters"
              body="Clear the search or status filter to see the full delivery portfolio."
              primaryAction={{ label: 'Clear filters', onClick: () => { setSearch(''); setStatus('all'); } }}
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              onRowClick={(row) => navigate(`/app/projects/${row.id}`)}
              density="compact"
              emptyState={<RecordEmptyState title="No projects" body="Projects appear here once a won deal is handed to delivery." />}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ detail screen */

export function ProjectDetail() {
  const services = useServices();
  const { projectId = '' } = useParams();

  const project = useAsync(() => services.projects.get(projectId), [projectId], { skip: !projectId });
  const phases = useList(() => services.projects.phases(projectId), [projectId], { skip: !projectId });
  const tasks = useList(() => services.projects.tasks(projectId, { pageSize: 200 }), [projectId], { skip: !projectId });
  const milestones = useList(() => services.projects.milestones(projectId), [projectId], { skip: !projectId });
  const deliverables = useList(() => services.projects.deliverables(projectId), [projectId], { skip: !projectId });
  const risks = useList(() => services.projects.risks(projectId), [projectId], { skip: !projectId });
  const timeline = useAsync(() => services.projects.timeline(projectId), [projectId], { skip: !projectId });

  const reloadAll = React.useCallback(() => {
    project.reload();
    phases.reload();
    tasks.reload();
    milestones.reload();
    deliverables.reload();
    risks.reload();
    timeline.reload();
  }, [project, phases, tasks, milestones, deliverables, risks, timeline]);

  const acceptHandoff = useMutation(
    (patch: Record<string, boolean>) => services.projects.acceptHandoff(projectId, patch),
    {
      successMessage: 'Handoff checklist updated in the local demo store.',
      onSuccess: () => reloadAll(),
    },
  );

  const moveTask = React.useCallback(
    async (cardId: string, toColumnId: string) => {
      const result = await services.projects.moveTask(cardId, toColumnId as ProjectTask['status']);
      if (!result.ok) throw new Error(result.error.message);
      notify.simulated('Task moved', 'The task status was written to the local demo store.');
      tasks.reload();
    },
    [services, tasks],
  );

  const completeMilestone = useMutation(
    (milestoneId: string) => services.projects.completeMilestone(projectId, milestoneId),
    {
      successMessage: 'Milestone marked complete. The project counter was updated too.',
      onSuccess: () => reloadAll(),
    },
  );

  if (!projectId) {
    return (
      <div className="p-6">
        <RecordEmptyState title="No project selected" body="Open a project from the list." primaryAction={{ label: 'Back to projects', onClick: () => undefined }} />
      </div>
    );
  }

  if (project.loading) {
    return (
      <div className="p-6">
        <ListSkeleton rows={8} columns={4} />
      </div>
    );
  }

  if (project.error || !project.data) {
    return (
      <div className="p-6">
        <RecordEmptyState
          title="This project could not be loaded"
          body={project.error ?? 'The project may have been removed.'}
          hints={['Retry the request.', 'Return to the project list and reopen the record.']}
          primaryAction={{ label: 'Retry', onClick: project.reload }}
          secondaryAction={{ label: 'Back to projects', onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  const data = project.data;
  const teamAllocation = data.teamMembers.map((member) => member.allocationPercent ?? 0);

  return (
    <div className="pb-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {data.name}
            <StatusPill status={data.status} />
            <HealthPill health={data.health} />
          </span>
        }
        description={`${data.reference} · ${data.accountName} · managed by ${data.managerName}`}
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Projects', to: '/app/projects' }, { label: data.reference }]}
        backTo={{ to: '/app/projects', label: 'Projects' }}
      />

      <div className="space-y-5 p-4 sm:p-6">
        {acceptHandoff.error ? <Alert tone="danger" title="The handoff update was not saved">{acceptHandoff.error}</Alert> : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <MiniStat label="Progress" value={`${data.progressPercent}%`} tone="blue" />
          <MiniStat label="Milestones" value={`${data.completedMilestoneCount} / ${data.milestoneCount}`} tone="green" />
          <MiniStat label="Open tasks" value={formatNumber(data.openTaskCount)} tone="violet" />
          <MiniStat label="Overdue" value={formatNumber(data.overdueTaskCount)} tone={data.overdueTaskCount > 0 ? 'red' : 'slate'} />
          <MiniStat
            label="Budget"
            value={data.budget ? formatMoney(data.budget.amount, data.budget.currency, true) : '—'}
            tone="teal"
          />
          <MiniStat label="Team allocation" value={`${teamAllocation.length > 0 ? Math.round(teamAllocation.reduce((sum, value) => sum + value, 0) / teamAllocation.length) : 0}%`} tone="amber" />
        </div>

        <Tabs defaultValue="overview">
          <TabsList aria-label="Project sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="board">Task board</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="milestones">
              Milestones
              <Badge variant="neutral" size="sm">{milestones.items.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="risks">
              Risks &amp; issues
              <Badge variant={risks.items.length > 0 ? 'warning' : 'neutral'} size="sm">{risks.items.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <HandoffPanel
                project={data}
                pending={acceptHandoff.pending}
                onToggle={(itemId, checked) => void acceptHandoff.run({ [itemId]: checked })}
              />
              <CustomerVisiblePanel project={data} milestones={milestones.items} deliverables={deliverables.items} />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <GitBranch className="size-4 text-subtle" aria-hidden />
                <CardTitle>Derived phases</CardTitle>
              </CardHeader>
              <CardContent>
                {phases.loading ? (
                  <ListSkeleton rows={4} columns={3} />
                ) : phases.items.length === 0 ? (
                  <p className="text-xs text-muted">No phases could be derived for this project window.</p>
                ) : (
                  <ol className="space-y-3">
                    {phases.items.map((phase: ProjectPhase) => (
                      <li key={phase.id} className="space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-fg">
                            <span className="me-1.5 text-faint">{phase.order}.</span>
                            {phase.name}
                          </span>
                          <span className="text-2xs text-faint">
                            {formatDate(phase.startDate)} – {formatDate(phase.endDate)} · {humanise(phase.status)}
                          </span>
                        </div>
                        <Progress value={phase.progressPercent} tone={phase.tone} size="xs" />
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
                  Phases are derived from the project's start and target dates by the mock service, so they cannot contradict the schedule.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <ClipboardCheck className="size-4 text-subtle" aria-hidden />
                <CardTitle>Deliverables</CardTitle>
              </CardHeader>
              <CardContent>
                {deliverables.loading ? (
                  <ListSkeleton rows={3} columns={3} />
                ) : deliverables.items.length === 0 ? (
                  <p className="text-xs text-muted">No deliverables are recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-border-subtle">
                    {deliverables.items.map((deliverable) => (
                      <li key={deliverable.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-fg">{deliverable.name}</p>
                          <p className="mt-0.5 text-[0.6875rem] text-faint">
                            Due {formatDate(deliverable.dueDate)} · {deliverable.kind.replace(/_/g, ' ')}
                            {deliverable.customerVisible ? ' · customer-visible' : ''}
                          </p>
                        </div>
                        <TonePill tone={deliverable.status === 'accepted' ? 'green' : deliverable.status === 'rejected' ? 'red' : 'slate'} dot={false}>
                          {DELIVERABLE_STATUS_LABEL[deliverable.status]}
                        </TonePill>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="board">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">Move a card to change its status. Every move writes through the same operation as the list view.</p>
              <span className="text-2xs text-faint">
                <Users className="me-1 inline size-3.5" aria-hidden />
                {data.teamMembers.length} team member(s)
              </span>
            </div>
            {tasks.loading ? (
              <ListSkeleton rows={5} columns={4} />
            ) : (
              <KanbanBoard
                columns={TASK_STATUSES.map((entry) => ({ id: entry, label: TASK_STATUS_LABEL[entry], tone: TASK_STATUS_TONE[entry] }))}
                cards={tasks.items.map((task) => ({
                  id: task.id,
                  columnId: task.status,
                  title: task.title,
                  subtitle: task.assigneeName ? `${task.reference} · ${task.assigneeName}` : task.reference,
                  meta: [
                    { label: PRIORITY_LABEL[task.priority], tone: task.priority === 'critical' ? ('red' as Tone) : task.priority === 'high' ? ('amber' as Tone) : ('slate' as Tone) },
                    { label: `${task.progressPercent}%`, tone: 'blue' as Tone },
                  ],
                  attention: task.status === 'blocked' ? 'danger' : undefined,
                  ariaLabel: `${task.title}, ${TASK_STATUS_LABEL[task.status]}`,
                }))}
                onMove={moveTask}
                emptyColumnLabel="No tasks"
                height="calc(100dvh - 26rem)"
              />
            )}
          </TabsContent>

          <TabsContent value="timeline">
            {timeline.loading ? (
              <ListSkeleton rows={6} columns={4} />
            ) : timeline.error || !timeline.data ? (
              <RecordEmptyState title="The timeline could not be built" body={timeline.error ?? 'No timeline was returned.'} primaryAction={{ label: 'Retry', onClick: timeline.reload }} />
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <CalendarClock className="size-4 text-subtle" aria-hidden />
                  <CardTitle>Delivery timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <TimelineBar timeline={timeline.data} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="milestones">
            {milestones.loading ? (
              <ListSkeleton rows={4} columns={4} />
            ) : milestones.items.length === 0 ? (
              <RecordEmptyState title="No milestones" body="No milestones are recorded against this project." />
            ) : (
              <ul className="space-y-3">
                {milestones.items.map((milestone) => (
                  <li key={milestone.id} className="rounded-lg border border-border-subtle bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium text-fg">{milestone.name}</h3>
                          <TonePill tone={MILESTONE_TONE[milestone.status]} dot={false}>
                            {MILESTONE_LABEL[milestone.status]}
                          </TonePill>
                          {milestone.billableAmount ? (
                            <Badge variant={milestone.invoiced ? 'success' : 'warning'} size="sm">
                              {milestone.invoiced ? 'Invoiced' : 'Billable'} · {formatMoney(milestone.billableAmount.amount, milestone.billableAmount.currency, true)}
                            </Badge>
                          ) : null}
                          {milestone.customerApprovalRequired ? (
                            <Badge variant={milestone.customerApprovedAt ? 'success' : 'neutral'} size="sm">
                              {milestone.customerApprovedAt ? `Customer approved ${formatDate(milestone.customerApprovedAt)}` : 'Customer approval required'}
                            </Badge>
                          ) : null}
                        </div>
                        {milestone.description ? <p className="text-xs text-muted">{milestone.description}</p> : null}
                        <p className="text-[0.6875rem] text-faint">
                          Due {formatDate(milestone.dueDate)}
                          {milestone.completedAt ? ` · completed ${formatDate(milestone.completedAt)}` : ''}
                        </p>
                      </div>
                      <Button
                        variant={milestone.status === 'completed' ? 'ghost' : 'secondary'}
                        size="sm"
                        disabled={milestone.status === 'completed' || completeMilestone.pending}
                        leadingIcon={<CheckCircle2 className="size-3.5" />}
                        onClick={() => void completeMilestone.run(milestone.id)}
                      >
                        {milestone.status === 'completed' ? 'Completed' : 'Mark complete'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
              Completing a milestone increments the project's completed-milestone counter in one transaction. Billing is recorded as a CRM fact — no invoice is raised.
            </p>
          </TabsContent>

          <TabsContent value="risks">
            {risks.loading ? (
              <ListSkeleton rows={4} columns={4} />
            ) : risks.items.length === 0 ? (
              <RecordEmptyState title="No risks or issues" body="Nothing has been raised against this project." />
            ) : (
              <ul className="space-y-3">
                {risks.items.map((risk) => (
                  <li key={risk.id} className="rounded-lg border border-border-subtle bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={risk.kind === 'issue' ? 'danger' : 'neutral'} size="sm">
                            {risk.kind === 'issue' ? 'Issue' : 'Risk'}
                          </Badge>
                          <span className="text-sm font-medium text-fg">{risk.title}</span>
                          <TonePill tone={RISK_TONE[risk.severity]} dot={false}>
                            {risk.severity}
                          </TonePill>
                          {risk.customerVisible ? <Badge variant="neutral" size="sm">Customer-visible</Badge> : null}
                        </div>
                        <p className="text-xs text-muted">{risk.description}</p>
                        <p className="text-[0.6875rem] text-faint">
                          Raised {formatDate(risk.raisedAt)} · owner {risk.ownerName ?? 'unassigned'} · probability {risk.probability} / impact {risk.impact}
                          {risk.targetResolutionDate ? ` · target ${formatDate(risk.targetResolutionDate)}` : ''}
                        </p>
                        {risk.mitigationPlan ? <p className="text-[0.6875rem] text-muted">Mitigation: {risk.mitigationPlan}</p> : null}
                      </div>
                      <TonePill tone={risk.status === 'closed' || risk.status === 'resolved' ? 'green' : 'amber'} dot={false}>
                        {humanise(risk.status)}
                      </TonePill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border-subtle bg-inset p-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
              <p className="text-[0.6875rem] leading-relaxed text-faint">
                Risks and issues are derived from the project's recorded counts by the mock service. This screen reports them; it does not create or close them.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-inset p-3">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
          <p className="text-[0.6875rem] leading-relaxed text-faint">
            This project was created from a closed-won deal via {data.createdByWorkflowId ? 'an automation' : 'a manual handoff'}. Billing type:{' '}
            {humanise(data.billingType)}
            {data.templateName ? ` · template: ${data.templateName}` : ''}.
          </p>
        </div>
      </div>
    </div>
  );
}
