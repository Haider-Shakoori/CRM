'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock,
  CalendarCheck,
  CheckCircle2,
  CircleSlash,
  ClipboardList,
  Link2,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Task } from '@crm/shared-types';
import type { Tone } from '@crm/ui';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  IconButton,
  MiniStat,
  Pagination,
  Progress,
  Select,
  StatusBadge,
  cn,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Tasks.
 *
 * Tasks are `Activity` records with `kind: 'task'`, so the list reads the `activities`
 * collection through the `tasks` service rather than a separate store. Three decisions are
 * deliberate:
 *
 *   - **Views are query clauses, not client-side filters.** Each view becomes a filter on the
 *     `ListQuery`, so the numbers the screen shows are the numbers the future API would return
 *     and pagination stays correct when a view matches more rows than one page.
 *   - **Overdue and due-today compare date-only strings.** The seeded tasks carry a `dueDate`
 *     in `YYYY-MM-DD`, and the query engine parses date strings to epoch millis on both sides
 *     of the comparison, so the boundary is exact rather than timezone-dependent.
 *   - **Bulk complete goes through the activity service.** `TasksService` completes one task at
 *     a time (`tasks.complete(id)`); there is no bulk form, so the selection toolbar calls
 *     `activities.complete(ids)`, which is the same underlying write the single-task path uses.
 */

type TaskView = 'my_open' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'all';

const TASK_VIEWS: Array<{ id: TaskView; label: string; description: string }> = [
  { id: 'my_open', label: 'Assigned to me', description: 'Open and in-progress tasks owned by the signed-in user.' },
  { id: 'today', label: 'Due today', description: 'Tasks whose due date is today, regardless of status.' },
  { id: 'overdue', label: 'Overdue', description: 'Open tasks whose due date has already passed.' },
  { id: 'upcoming', label: 'Upcoming', description: 'Open tasks due today or later.' },
  { id: 'completed', label: 'Completed', description: 'Tasks that have been marked complete.' },
  { id: 'all', label: 'Everything', description: 'Every task, whatever its status.' },
];

const OPEN_STATUSES = ['open', 'in_progress', 'deferred'];

/** Date-only key in UTC, matching how the seed writes `dueDate`. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The due date a task actually carries; `dueDate` when present, otherwise the `dueAt` day. */
function dueDay(task: Task): string {
  return task.dueDate ?? (task.dueAt ? task.dueAt.slice(0, 10) : '');
}

function relatedLabel(task: Task): string {
  const subject = task.subjects.find((entry) => entry.type !== 'deal') ?? task.subjects[0];
  return subject?.label ?? 'No linked record';
}

function subjectPath(type: string, id: string): string {
  if (type === 'account') return `/app/accounts/${id}`;
  if (type === 'contact') return `/app/contacts/${id}`;
  if (type === 'lead') return `/app/leads/${id}`;
  if (type === 'deal') return `/app/deals/${id}`;
  if (type === 'ticket') return `/app/tickets/${id}`;
  if (type === 'project') return `/app/projects/${id}`;
  return '/app/activities/all';
}

function relatedPath(task: Task): string {
  const subject = task.subjects.find((entry) => entry.type !== 'deal') ?? task.subjects[0];
  return subject ? subjectPath(subject.type, subject.id) : '/app/activities/all';
}

const PRIORITY_TONE: Record<string, Tone> = {
  urgent: 'red',
  high: 'amber',
  normal: 'blue',
  low: 'slate',
};

/* --------------------------------------------------------------- task dialog */

function TaskFact({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-faint">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 truncate text-end font-medium text-fg">{value}</dd>
    </div>
  );
}

function TaskDialog({
  task,
  onChanged,
  onClose,
}: {
  task: Task;
  onChanged: () => void;
  onClose: () => void;
}) {
  const services = useServices();
  const [record, setRecord] = React.useState<Task>(task);
  const [reassigning, setReassigning] = React.useState(false);

  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const complete = useMutation((id: string) => services.tasks.complete(id), {
    successMessage: 'Task marked complete.',
    onSuccess: (updated) => {
      setRecord(updated);
      onChanged();
    },
  });
  const toggle = useMutation(
    (input: { taskId: string; itemId: string }) => services.tasks.toggleChecklistItem(input.taskId, input.itemId),
    {
      successMessage: 'Checklist updated.',
      onSuccess: (updated) => {
        setRecord(updated);
        onChanged();
      },
    },
  );
  const reassign = useMutation(
    (input: { ids: string[]; ownerId: string }) => services.tasks.reassign(input.ids, input.ownerId),
    {
      successMessage: (result) => `Reassigned ${result.succeeded} of ${result.requested} task(s).`,
      onSuccess: () => {
        setReassigning(false);
        onChanged();
        onClose();
      },
    },
  );

  const checklist = record.checklist ?? [];
  const doneCount = checklist.filter((item) => item.done).length;
  const isDone = record.status === 'completed' || record.status === 'cancelled';

  return (
    <DialogContent
      title={record.subject}
      description={relatedLabel(record)}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<CheckCircle2 className="size-3.5" />}
            loading={complete.pending}
            disabled={isDone}
            onClick={() => void complete.run(record.id)}
          >
            {isDone ? 'Completed' : 'Mark complete'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <dl className="grid gap-2.5 rounded-lg border border-border-subtle bg-inset p-3 text-xs">
          <TaskFact label="Status" value={<StatusBadge status={record.status} size="sm" />} />
          <TaskFact label="Priority" value={<StatusBadge status={record.priority} size="sm" />} />
          <TaskFact label="Owner" value={record.ownerName} icon={<UserRound className="size-3.5 text-subtle" aria-hidden />} />
          <TaskFact label="Due" value={formatDate(record.dueAt)} icon={<AlarmClock className="size-3.5 text-subtle" aria-hidden />} />
          <TaskFact label="Completed" value={record.completedAt ? formatDate(record.completedAt) : 'Not yet'} />
          <TaskFact label="Provenance" value={record.source} />
        </dl>

        {record.body ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{record.body}</p> : null}

        {checklist.length > 0 ? (
          <div className="space-y-2.5">
            <Progress value={doneCount} max={checklist.length} tone="green" size="sm" label="Checklist" />
            <p className="text-[0.6875rem] text-faint">
              {doneCount} of {checklist.length} items complete
            </p>
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item.id}>
                  <Checkbox
                    id={`checklist-${item.id}`}
                    checked={item.done}
                    label={item.label}
                    disabled={toggle.pending}
                    onCheckedChange={() => void toggle.run({ taskId: record.id, itemId: item.id })}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs italic text-faint">This task carries no checklist.</p>
        )}

        <div className="space-y-2.5">
          <p className="text-2xs font-semibold uppercase tracking-wide text-faint">Linked records</p>
          <ul className="space-y-1.5">
            {record.subjects.map((subject) => (
              <li key={`${subject.type}-${subject.id}`}>
                <Link
                  to={subjectPath(subject.type, subject.id)}
                  className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-hover"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Link2 className="size-3.5 shrink-0 text-subtle" aria-hidden />
                    <span className="truncate text-muted">{subject.label}</span>
                  </span>
                  <Badge variant="outline" size="sm">
                    {subject.type}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {reassigning ? (
          <div className="space-y-2 rounded-lg border border-border-subtle bg-surface p-3">
            <Field label="Reassign this task to" htmlFor="task-reassign-owner">
              <Select
                id="task-reassign-owner"
                value={record.ownerId}
                onValueChange={(value) => void reassign.run({ ids: [record.id], ownerId: value })}
                options={users.items.map((user) => ({ value: user.id, label: user.displayName }))}
                selectSize="sm"
                searchable
              />
            </Field>
            {reassign.error ? <Alert tone="danger" title="The task could not be reassigned">{reassign.error}</Alert> : null}
          </div>
        ) : (
          <Button variant="ghost" size="sm" leadingIcon={<UserRound className="size-3.5" />} onClick={() => setReassigning(true)}>
            Reassign
          </Button>
        )}

        <DemoNotice tone="neutral">
          Completing or reassigning a task changes this browser only. No reminder is scheduled and no notification is sent.
        </DemoNotice>
      </div>
    </DialogContent>
  );
}

/* ----------------------------------------------------------------- the list */

export default function TaskList() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [view, setView] = React.useState<TaskView>('my_open');
  const [priorityFilter, setPriorityFilter] = React.useState('all');
  const [ownerFilter, setOwnerFilter] = React.useState('all');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [openTask, setOpenTask] = React.useState<Task | null>(null);
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reassignTarget, setReassignTarget] = React.useState('');

  /**
   * The clock is read once per mount, not during render. A cell or query calling `new Date()`
   * on every pass is impure and lets the overdue count disagree with the overdue view.
   */
  const [today] = React.useState(() => isoDay(new Date()));

  const currentUser = useAsync(() => services.tenant.currentUser(), []);
  const currentUserId = currentUser.data?.id;
  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const query = React.useMemo(() => {
    const clauses: Array<{ field: string; operator: string; value?: unknown }> = [];
    if (view === 'my_open' && currentUserId) {
      clauses.push({ field: 'ownerId', operator: 'eq', value: currentUserId });
      clauses.push({ field: 'status', operator: 'in', value: OPEN_STATUSES });
    }
    if (view === 'today') clauses.push({ field: 'dueDate', operator: 'eq', value: today });
    if (view === 'overdue') {
      clauses.push({ field: 'dueDate', operator: 'lt', value: today });
      clauses.push({ field: 'status', operator: 'in', value: OPEN_STATUSES });
    }
    if (view === 'upcoming') {
      clauses.push({ field: 'dueDate', operator: 'gte', value: today });
      clauses.push({ field: 'status', operator: 'in', value: OPEN_STATUSES });
    }
    if (view === 'completed') clauses.push({ field: 'status', operator: 'eq', value: 'completed' });
    if (priorityFilter !== 'all') clauses.push({ field: 'priority', operator: 'eq', value: priorityFilter });
    if (ownerFilter !== 'all') clauses.push({ field: 'ownerId', operator: 'eq', value: ownerFilter });

    return {
      page,
      pageSize: 40,
      q: search || undefined,
      sort: [{ field: 'dueAt', direction: 'asc' as const }],
      filter: clauses.length > 0 ? { id: 'task-filters', conjunction: 'and' as const, clauses } : undefined,
    };
  }, [page, search, view, priorityFilter, ownerFilter, today, currentUserId]);

  const tasks = useList(() => services.tasks.list(query as never), [JSON.stringify(query)]);
  const all = useList(() => services.tasks.list({ pageSize: 200, sort: [{ field: 'dueAt', direction: 'asc' }] }), []);

  const metrics = React.useMemo(() => {
    const items = all.items;
    const open = items.filter((task) => OPEN_STATUSES.includes(task.status));
    return {
      total: items.length,
      open: open.length,
      overdue: open.filter((task) => dueDay(task) !== '' && dueDay(task) < today).length,
      today: open.filter((task) => dueDay(task) === today).length,
      completed: items.filter((task) => task.status === 'completed').length,
      mine: currentUserId ? open.filter((task) => task.ownerId === currentUserId).length : 0,
    };
  }, [all.items, today, currentUserId]);

  const bulkComplete = useMutation((ids: string[]) => services.activities.complete(ids), {
    // `TasksService` has no bulk complete, so this goes through the activity service.
    successMessage: (result) => `${result.succeeded} of ${result.requested} task(s) completed.`,
    onSuccess: () => {
      tasks.reload();
      all.reload();
      setSelected([]);
    },
  });
  const bulkReassign = useMutation(
    (input: { ids: string[]; ownerId: string }) => services.tasks.reassign(input.ids, input.ownerId),
    {
      successMessage: (result) => `${result.succeeded} of ${result.requested} task(s) reassigned.`,
      onSuccess: () => {
        tasks.reload();
        all.reload();
        setSelected([]);
        setReassignOpen(false);
      },
    },
  );
  const bulkDelete = useMutation((ids: string[]) => services.tasks.bulkRemove(ids), {
    successMessage: (result) => `${result.succeeded} of ${result.requested} task(s) deleted.`,
    onSuccess: () => {
      tasks.reload();
      all.reload();
      setSelected([]);
      setDeleteOpen(false);
    },
  });

  const completeOne = useMutation((id: string) => services.tasks.complete(id), {
    successMessage: 'Task marked complete.',
    onSuccess: () => {
      tasks.reload();
      all.reload();
      setOpenTask(null);
    },
  });

  const reloadTask = React.useCallback(() => {
    tasks.reload();
    all.reload();
  }, [tasks, all]);

  const columns = React.useMemo<ColumnDef<Task, unknown>[]>(
    () => [
      {
        id: 'subject',
        header: 'Task',
        accessorKey: 'subject',
        cell: ({ row }) => (
          <div className="min-w-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenTask(row.original);
              }}
              className="block max-w-full truncate text-start text-xs font-medium text-fg hover:text-link hover:underline"
            >
              {row.original.subject}
            </button>
            <span className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-faint">
              <Link2 className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{relatedLabel(row.original)}</span>
            </span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'priority',
        header: 'Priority',
        accessorKey: 'priority',
        cell: ({ row }) => <StatusBadge status={row.original.priority} size="sm" />,
      },
      { id: 'owner', header: 'Owner', accessorKey: 'ownerName', cell: ({ row }) => <span className="truncate text-xs text-muted">{row.original.ownerName}</span> },
      {
        id: 'due',
        header: 'Due',
        accessorKey: 'dueAt',
        cell: ({ row }) => {
          const overdue = OPEN_STATUSES.includes(row.original.status) && dueDay(row.original) !== '' && dueDay(row.original) < today;
          return (
            <span className={cn('text-[0.6875rem]', overdue ? 'font-medium text-danger-fg' : 'text-muted')}>
              {formatDate(row.original.dueAt, 'short')}
              {overdue ? ' · overdue' : ''}
            </span>
          );
        },
      },
      {
        id: 'checklist',
        header: 'Checklist',
        cell: ({ row }) => {
          const checklist = row.original.checklist ?? [];
          if (checklist.length === 0) return <span className="text-[0.6875rem] text-faint">—</span>;
          const done = checklist.filter((item) => item.done).length;
          return (
            <span className="text-[0.6875rem] tabular-nums text-muted">
              {done} / {checklist.length}
            </span>
          );
        },
      },
      {
        id: 'complete',
        header: '',
        cell: ({ row }) => {
          const isDone = row.original.status === 'completed' || row.original.status === 'cancelled';
          return (
            <IconButton
              label={isDone ? 'Already complete' : `Mark ${row.original.subject} complete`}
              icon={<CheckCircle2 />}
              size="icon-xs"
              disabled={isDone}
              onClick={(event) => {
                event.stopPropagation();
                void completeOne.run(row.original.id);
              }}
            />
          );
        },
      },
    ],
    [today, completeOne],
  );

  const activeView = TASK_VIEWS.find((entry) => entry.id === view) ?? TASK_VIEWS[0]!;

  return (
    <div className="pb-8">
      <PageHeader
        title="Tasks"
        description="Every task across the organization, filtered by owner, due date and priority. Completing one records the change locally."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'My Work', to: '/app/activities' }, { label: 'Tasks' }]}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild><Link to="/crm/tasks">Live Tasks (Laravel)</Link></Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/activities/all">Activities</Link>
            </Button>
            <IconButton label="Refresh tasks" icon={<RefreshCw className={cn(tasks.loading && 'animate-spin')} />} size="icon-sm" onClick={() => reloadTask()} />
          </>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search tasks"
            resultCount={tasks.meta ? `${tasks.meta.total.toLocaleString()} tasks` : undefined}
            chips={[
              ...(priorityFilter !== 'all' ? [{ id: 'priority', label: `Priority: ${priorityFilter}`, tone: 'brand' as const, onRemove: () => setPriorityFilter('all') }] : []),
              ...(ownerFilter !== 'all'
                ? [{ id: 'owner', label: `Owner: ${users.items.find((user) => user.id === ownerFilter)?.displayName ?? ownerFilter}`, tone: 'brand' as const, onRemove: () => setOwnerFilter('all') }]
                : []),
            ]}
            onClearFilters={() => {
              setPriorityFilter('all');
              setOwnerFilter('all');
              setSearch('');
            }}
            actions={
              <>
                <Select
                  value={view}
                  onValueChange={(value) => {
                    setView(value as TaskView);
                    setPage(1);
                  }}
                  options={TASK_VIEWS.map((entry) => ({ value: entry.id, label: entry.label }))}
                  selectSize="sm"
                  className="w-[12rem]"
                  aria-label="Task view"
                />
                <Select
                  value={priorityFilter}
                  onValueChange={(value) => {
                    setPriorityFilter(value);
                    setPage(1);
                  }}
                  options={[{ value: 'all', label: 'All priorities' }, ...['urgent', 'high', 'normal', 'low'].map((value) => ({ value, label: value }))]}
                  selectSize="sm"
                  className="w-[10rem]"
                  aria-label="Filter by priority"
                />
                <Select
                  value={ownerFilter}
                  onValueChange={(value) => {
                    setOwnerFilter(value);
                    setPage(1);
                  }}
                  options={[{ value: 'all', label: 'All owners' }, ...users.items.map((user) => ({ value: user.id, label: user.displayName }))]}
                  selectSize="sm"
                  className="w-[11rem]"
                  searchable
                  aria-label="Filter by owner"
                />
              </>
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Tasks" value={formatNumber(metrics.total)} tone="violet" />
          <MiniStat label="Open" value={formatNumber(metrics.open)} tone="blue" />
          <MiniStat label="Overdue" value={formatNumber(metrics.overdue)} tone="red" />
          <MiniStat label="Due today" value={formatNumber(metrics.today)} tone="amber" />
          <MiniStat label="Assigned to me" value={formatNumber(metrics.mine)} tone="teal" />
        </div>

        <p className="text-[0.6875rem] leading-relaxed text-faint">
          Showing: <span className="font-medium text-muted">{activeView.description}</span>
          {currentUser.data ? <> Signed in as {currentUser.data.displayName}.</> : null}
        </p>

        <DemoNotice tone="neutral">
          Tasks are seeded sample records. Completing, reassigning or deleting one changes this browser only — no connected calendar,
          mailbox or workflow scheduler is affected.
        </DemoNotice>

        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-subtle/60 px-3 py-2">
            <span className="text-xs font-medium text-fg">
              {selected.length} {selected.length === 1 ? 'task' : 'tasks'} selected
            </span>
            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              <Button variant="secondary" size="sm" loading={bulkComplete.pending} onClick={() => void bulkComplete.run(selected)}>
                Complete
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setReassignOpen(true)}>
                Reassign
              </Button>
              <Button variant="danger-outline" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {tasks.loading ? (
          <ListSkeleton rows={10} columns={7} />
        ) : (
          <DataTable
            columns={columns}
            data={tasks.items}
            selectable
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            onRowClick={(task) => setOpenTask(task)}
            getRowId={(task) => task.id}
            emptyState={
              <div className="p-10 text-center">
                <CircleSlash className="mx-auto mb-2 size-6 text-faint" aria-hidden />
                <p className="text-sm font-medium text-fg">No tasks match this view</p>
                <p className="mt-1 text-xs text-muted">Try a different view, or clear the priority and owner filters.</p>
              </div>
            }
            footer={tasks.meta ? <Pagination page={tasks.meta.page} pageSize={tasks.meta.pageSize} total={tasks.meta.total} onPageChange={setPage} /> : null}
          />
        )}

        <Card className="border-dashed">
          <CardHeader className="flex-row items-center gap-2">
            <ClipboardList className="size-3.5 text-subtle" aria-hidden />
            <CardTitle>How these views are built</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs text-muted sm:grid-cols-2">
            <p className="flex items-start gap-2">
              <CalendarCheck className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
              Each view is a filter on the query, not a browser-side pass over the loaded page, so the totals stay correct as you page.
            </p>
            <p className="flex items-start gap-2">
              <AlarmClock className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
              Overdue compares the date-only <span className="mx-1 font-mono text-[0.6875rem]">dueDate</span> against today; no background clock advances a task’s state.
            </p>
          </CardContent>
        </Card>
      </div>

      {openTask ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setOpenTask(null))}>
          <TaskDialog key={openTask.id} task={openTask} onChanged={reloadTask} onClose={() => setOpenTask(null)} />
        </Dialog>
      ) : null}

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent
          title={`Reassign ${selected.length} task${selected.length === 1 ? '' : 's'}`}
          description="Moves the selected tasks to another owner. Nothing is notified."
          size="sm"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setReassignOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={bulkReassign.pending}
                disabled={!reassignTarget}
                onClick={() => void bulkReassign.run({ ids: selected, ownerId: reassignTarget })}
              >
                Reassign
              </Button>
            </>
          }
        >
          <Field label="New owner" htmlFor="bulk-reassign-owner">
            <Select
              id="bulk-reassign-owner"
              value={reassignTarget}
              onValueChange={setReassignTarget}
              options={users.items.map((user) => ({ value: user.id, label: user.displayName }))}
              placeholder="Choose an owner"
              searchable
            />
          </Field>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected.length} task${selected.length === 1 ? '' : 's'}?`}
        description="The selected tasks are removed from this browser session's demo store. This cannot be undone here."
        confirmLabel="Delete tasks"
        tone="danger"
        loading={bulkDelete.pending}
        onConfirm={() => void bulkDelete.run(selected)}
      />
    </div>
  );
}

export { TaskList, TASK_VIEWS, TaskDialog, PRIORITY_TONE, relatedPath, subjectPath };
