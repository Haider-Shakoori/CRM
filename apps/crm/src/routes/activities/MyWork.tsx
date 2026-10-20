'use client';

import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Circle, Clock, ListChecks, Phone, Plus, RefreshCw, TimerIcon } from 'lucide-react';
import type { Activity, DailyActivityPlan } from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  DemoNotice,
  Field,
  Input,
  KpiCard,
  Select,
  Skeleton,
  Textarea,
  TonePill,
  notify,
} from '@crm/ui';
import { FilterBar, PageHeader, formatDate } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * My work.
 *
 * The screen a representative actually lives in. Its job is to answer one question — what
 * should I do next — so it is ordered by urgency rather than by record type: overdue first,
 * then due today, then the rest of the plan.
 *
 * Two deliberate choices:
 *
 *   - **Completing a task updates the plan totals in the same operation.** The brief is
 *     specific about this: a task marked complete must leave the plan, and the counts must
 *     agree. Both read from `dailyPlan`, which recomputes from the activity records.
 *   - **Every completion is undoable.** Completing the wrong task is common, and an undo
 *     removes the need for a confirmation dialog on a low-stakes action.
 */

const PRIORITY_TONES: Record<Activity['priority'], 'red' | 'amber' | 'blue' | 'slate'> = {
  urgent: 'red',
  high: 'amber',
  normal: 'blue',
  low: 'slate',
};

export default function MyWork() {
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const [composeOpen, setComposeOpen] = React.useState(params.get('new') === '1');
  const [filter, setFilter] = React.useState<'all' | 'overdue' | 'today'>('all');
  const [search, setSearch] = React.useState('');
  const [newPriority, setNewPriority] = React.useState<Activity['priority']>('normal');

  const user = useAsync(() => services.tenant.currentUser(), []);
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const plan = useAsync(
    () => services.activities.dailyPlan(user.data?.id ?? '', today),
    [user.data?.id, today],
    { skip: !user.data },
  );

  /** Everything the user owns that is still open, so the plan is not limited to today. */
  const openActivities = useList(
    () =>
      services.activities.list({
        pageSize: 100,
        q: search || undefined,
        sort: [
          { field: 'priority', direction: 'desc' },
          { field: 'dueAt', direction: 'asc' },
        ],
      }),
    [search],
  );

  const complete = useMutation((id: string) => services.tasks.complete(id), {
    onSuccess: () => {
      plan.reload();
      openActivities.reload();
    },
  });

  const completeActivity = useMutation((id: string) => services.activities.complete([id]), {
    onSuccess: () => {
      plan.reload();
      openActivities.reload();
    },
  });

  const reopen = useMutation((ids: string[]) => services.activities.reopen(ids), {
    successMessage: 'Task reopened.',
    onSuccess: () => {
      plan.reload();
      openActivities.reload();
    },
  });

  const createTask = useMutation(
    (input: { subject: string; dueDate: string; priority: Activity['priority']; body?: string }) =>
      services.activities.create({
        kind: 'task',
        subject: input.subject,
        subjects: [],
        body: input.body,
        status: 'open',
        priority: input.priority,
        ownerId: user.data?.id ?? '',
        ownerName: user.data?.displayName ?? 'You',
        dueAt: new Date(`${input.dueDate}T09:00:00.000Z`).toISOString(),
        dueDate: input.dueDate,
        visibility: 'team',
        source: 'user',
        organizationId: user.data?.organizationIds[0] ?? '',
      } as never),
    {
      successMessage: 'Task created and added to the plan.',
      onSuccess: () => {
        setComposeOpen(false);
        setParams({}, { replace: true });
        plan.reload();
        openActivities.reload();
      },
    },
  );

  const items = plan.data?.items ?? [];
  const filtered = items.filter((item) => {
    if (filter === 'overdue') return item.reason === 'Overdue';
    if (filter === 'today') return item.reason !== 'Overdue';
    return true;
  });

  const overdue = items.filter((item) => item.reason === 'Overdue');
  const plannedMinutes = plan.data?.totals.plannedMinutes ?? 0;

  return (
    <div className="pb-8">
      <PageHeader
        title="My work"
        description="Overdue first, then today. Completing a task removes it from the plan and the counters below update with it."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'My work' }]}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild><Link to="/crm/my-work">Live My Work (Laravel)</Link></Button>
            <Button variant="primary" size="sm" leadingIcon={<Plus className="size-3.5" />} onClick={() => setComposeOpen(true)}>
              New task
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="size-3.5" />} onClick={() => { plan.reload(); openActivities.reload(); }}>
              Refresh
            </Button>
          </>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search your work"
            resultCount={plan.data ? `${plan.data.totals.planned} planned · ${plan.data.totals.overdue} overdue` : undefined}
            chips={
              filter !== 'all'
                ? [{ id: 'filter', label: filter === 'overdue' ? 'Overdue only' : 'Due today', tone: 'brand' as const, onRemove: () => setFilter('all') }]
                : []
            }
            actions={
              <Select
                value={filter}
                onValueChange={(value) => setFilter(value as typeof filter)}
                options={[
                  { value: 'all', label: 'Everything' },
                  { value: 'overdue', label: 'Overdue only' },
                  { value: 'today', label: 'Due today' },
                ]}
                selectSize="sm"
                className="w-[11rem]"
                aria-label="Filter the plan"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Planned"
            value={String(plan.data?.totals.planned ?? 0)}
            hint={`${Math.round(plannedMinutes / 60)}h estimated`}
          />
          <KpiCard
            label="Overdue"
            value={String(plan.data?.totals.overdue ?? 0)}
            attention={(plan.data?.totals.overdue ?? 0) > 0 ? 'danger' : undefined}
            hint="Past the due date and still open"
          />
          <KpiCard label="Completed today" value={String(plan.data?.totals.completed ?? 0)} hint="Counted from the activity records" />
          <KpiCard
            label="Open in total"
            value={String(openActivities.meta?.total ?? 0)}
            hint="Tasks, calls, meetings and follow-ups you own"
          />
        </div>

        {overdue.length > 0 ? (
          <Alert tone="warning" title={`${overdue.length} ${overdue.length === 1 ? 'item is' : 'items are'} past due`}>
            The plan puts these first because a task that has slipped once is the one most likely to slip again.
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-fg">Today’s plan</h2>
                <p className="mt-0.5 text-2xs text-muted">
                  {new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
                </p>
              </div>
              <Badge variant="outline" size="sm">
                {user.data?.timezone ?? 'UTC'}
              </Badge>
            </div>

            {plan.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-11" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <CheckCircle2 className="mx-auto size-6 text-success-fg" aria-hidden />
                <p className="mt-3 text-sm font-medium text-fg">Nothing outstanding</p>
                <p className="mt-1 text-xs text-muted">
                  {filter === 'all'
                    ? 'Your plan is clear. New assignments appear here as records are assigned to you.'
                    : 'Nothing matches this filter. Switch to “Everything” to see the rest of the plan.'}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {filter !== 'all' ? (
                    <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                      Show everything
                    </Button>
                  ) : null}
                  <Button variant="primary" size="sm" onClick={() => setComposeOpen(true)}>
                    Add a task
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const activity = openActivities.items.find((candidate) => candidate.id === item.id);
                        const isTask = activity?.kind === 'task' || !activity;
                        const completed = isTask ? await complete.run(item.id) : await completeActivity.run(item.id);
                        if (completed) {
                          notify.undoable(`“${item.title}” completed`, () => {
                            void reopen.run([item.id]);
                          });
                        }
                      }}
                      className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong text-transparent transition-colors hover:border-success hover:text-success-fg"
                      aria-label={`Mark ${item.title} complete`}
                    >
                      <Circle className="size-3" aria-hidden />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-fg">{item.title}</span>
                        <TonePill tone={PRIORITY_TONES[item.priority]}>{item.priority}</TonePill>
                        {item.reason ? (
                          <Badge variant={item.reason === 'Overdue' ? 'danger' : 'outline'} size="sm">
                            {item.reason}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-subtle">
                        {item.recordPath && item.recordLabel ? (
                          <Link to={item.recordPath} className="text-link hover:underline">
                            {item.recordLabel}
                          </Link>
                        ) : (
                          <span>No linked record</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" aria-hidden />
                          {item.startAt ? formatDate(item.startAt, 'short') : 'No time set'}
                        </span>
                        {item.estimatedMinutes ? <span>{item.estimatedMinutes} min</span> : null}
                        <Badge variant="outline" size="sm">
                          {item.kind.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>

                    {item.kind === 'call' ? (
                      <Button variant="ghost" size="xs" leadingIcon={<Phone className="size-3" />} asChild>
                        <Link to={item.recordPath ?? '/app/activities'}>Log call</Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                <CalendarDays className="size-4 text-subtle" aria-hidden />
                Where the time goes
              </h2>
              {plan.loading ? (
                <Skeleton className="mt-3 h-24" />
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {(['call', 'meeting', 'email', 'task', 'demo', 'visit'] as const).map((kind) => {
                    const count = items.filter((item) => item.kind === kind).length;
                    if (count === 0) return null;
                    const total = items.length || 1;
                    return (
                      <li key={kind}>
                        <div className="flex items-baseline justify-between text-[0.6875rem]">
                          <span className="capitalize text-muted">{kind}s</span>
                          <span className="tabular-nums text-fg">{count}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 border-t border-border-subtle pt-2.5 text-[0.625rem] leading-relaxed text-faint">
                Communicating is simulated. Calls, emails and messages are recorded against the records; nothing is
                transmitted.
              </p>
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                <TimerIcon className="size-4 text-subtle" aria-hidden />
                All open work
              </h2>
              <p className="mt-0.5 text-2xs text-muted">Not only today: everything you own that is still open.</p>
              {openActivities.loading ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-8" />
                  ))}
                </div>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {openActivities.items
                    .filter((activity) => activity.status !== 'completed' && activity.status !== 'cancelled')
                    .slice(0, 10)
                    .map((activity) => (
                      <li key={activity.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-muted">{activity.subject}</span>
                        <span className="shrink-0 text-[0.625rem] tabular-nums text-faint">
                          {activity.dueAt ? formatDate(activity.dueAt, 'relative') : 'No date'}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              {openActivities.meta && openActivities.meta.total > 10 ? (
                <p className="mt-2 text-[0.625rem] text-faint">
                  Showing 10 of {openActivities.meta.total}. Filter the plan to narrow it down.
                </p>
              ) : null}
            </Card>
          </div>
        </div>

        <Card className="border-dashed p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <ListChecks className="size-4 text-subtle" aria-hidden />
            What this screen will grow into
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Activity inbox', note: 'Everything assigned, mentioned or shared with you in one queue.' },
              { label: 'Sequences', note: 'Multi-step outreach with reply detection and per-step performance.' },
              { label: 'Meeting preparation', note: 'A brief per meeting, composed from the account record and open issues.' },
              { label: 'Sales goals', note: 'Quota pacing against activity, pipeline created and revenue.' },
              { label: 'Team view', note: 'A manager view of workload and overdue items across the team.' },
              { label: 'Playbooks', note: 'Guidance and generated tasks for the situations that repeat.' },
            ].map((entry) => (
              <li key={entry.label} className="rounded-lg border border-border-subtle bg-inset p-3">
                <p className="text-xs font-medium text-fg">{entry.label}</p>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">{entry.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {composeOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--surface-scrim)]"
            aria-label="Cancel"
            onClick={() => {
              setComposeOpen(false);
              setParams({}, { replace: true });
            }}
          />
          <div role="dialog" aria-modal="true" aria-label="Create a task" className="relative w-full max-w-md rounded-xl border border-border bg-overlay p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-fg">New task</h2>
            <p className="mt-1 text-xs text-muted">
              Tasks appear in the plan on their due date, and immediately if the date has passed.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                await createTask.run({
                  subject: String(data.get('subject') ?? ''),
                  dueDate: String(data.get('dueDate') ?? today),
                  priority: String(data.get('priority') ?? 'normal') as Activity['priority'],
                  body: String(data.get('body') ?? '') || undefined,
                });
              }}
            >
              <Field label="What needs doing" htmlFor="subject" required>
                <Input id="subject" name="subject" placeholder="Follow up on the proposal" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Due date" htmlFor="dueDate" required>
                  <Input id="dueDate" name="dueDate" type="date" defaultValue={today} required />
                </Field>
                <Field label="Priority" htmlFor="priority">
                  <Select
                    id="priority"
                    name="priority"
                    value={newPriority}
                    onValueChange={(value) => setNewPriority(value as Activity['priority'])}
                    options={[
                      { value: 'urgent', label: 'Urgent' },
                      { value: 'high', label: 'High' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'low', label: 'Low' },
                    ]}
                  />
                </Field>
              </div>
              <Field label="Notes" htmlFor="body" hint="Optional">
                <Textarea id="body" name="body" rows={2} placeholder="Context for whoever picks this up" />
              </Field>
              <div className="flex items-center justify-between gap-2 pt-1">
                <DemoNotice tone="neutral">Saved in this browser only</DemoNotice>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setComposeOpen(false);
                      setParams({}, { replace: true });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={createTask.pending}>
                    Create task
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { DailyActivityPlan };
