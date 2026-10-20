'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Activity } from '@crm/shared-types';
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
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  MiniStat,
  Pagination,
  PropertyList,
  Select,
  StatusBadge,
  Textarea,
  TonePill,
  cn,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Activities.
 *
 * An activity is anything a person did or must do, and the seeded store already holds them.
 * This module is deliberately read-and-act rather than read-and-create: a new activity in the
 * real product arrives from a call logger, an email sync or a workflow, and the mock contract
 * would need a full record (owner, subject links, visibility, provenance) that a demo form
 * would only fabricate. So the screens here surface what exists, let a reviewer complete,
 * reopen and snooze it, and say plainly that nothing is transmitted.
 *
 * The activity *inbox* itself stays where it was — `/app/activities` renders My Work. This
 * module adds the record-level list and detail views beside it.
 */

const KIND_LABEL: Record<string, string> = {
  task: 'Task',
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  note: 'Note',
  chat: 'Chat',
  social: 'Social',
  demo: 'Demo',
  visit: 'Visit',
  stage_change: 'Stage change',
  field_change: 'Field change',
  system: 'System',
  approval: 'Approval',
  document: 'Document',
  payment: 'Payment',
  signature: 'Signature',
};

const KIND_TONE: Record<string, Tone> = {
  task: 'blue',
  call: 'teal',
  meeting: 'violet',
  email: 'blue',
  sms: 'green',
  whatsapp: 'green',
  note: 'slate',
  demo: 'amber',
  visit: 'amber',
  approval: 'amber',
  system: 'slate',
};

function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const props = { className: cn('size-3.5', className), 'aria-hidden': true } as const;
  if (kind === 'call') return <Phone {...props} />;
  if (kind === 'email') return <Mail {...props} />;
  if (kind === 'sms' || kind === 'whatsapp' || kind === 'chat') return <MessageSquare {...props} />;
  if (kind === 'meeting' || kind === 'demo') return <Users {...props} />;
  if (kind === 'visit') return <MapPin {...props} />;
  if (kind === 'task') return <ClipboardList {...props} />;
  return <CalendarClock {...props} />;
}

function relatedPath(type: string, id: string): string {
  if (type === 'account') return `/app/accounts/${id}`;
  if (type === 'contact') return `/app/contacts/${id}`;
  if (type === 'lead') return `/app/leads/${id}`;
  if (type === 'deal') return `/app/deals/${id}`;
  if (type === 'ticket') return `/app/tickets/${id}`;
  return '/app/activities/all';
}

/* ---------------------------------------------------------------------- list */

export default function ActivitiesList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [kindFilter, setKindFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 40,
      q: search || undefined,
      sort: [{ field: 'dueAt', direction: 'desc' as const }],
      filter:
        kindFilter === 'all' && statusFilter === 'all'
          ? undefined
          : {
              id: 'activity-filter',
              conjunction: 'and' as const,
              clauses: [
                ...(kindFilter !== 'all' ? [{ field: 'kind', operator: 'eq' as const, value: kindFilter }] : []),
                ...(statusFilter !== 'all' ? [{ field: 'status', operator: 'eq' as const, value: statusFilter }] : []),
              ] as never,
            },
    }),
    [page, search, kindFilter, statusFilter],
  );

  const activities = useList(() => services.activities.list(query), [JSON.stringify(query)]);
  const all = useList(() => services.activities.list({ pageSize: 200 }), []);

  const metrics = React.useMemo(() => {
    const items = all.items;
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: items.length,
      open: items.filter((activity) => activity.status === 'open' || activity.status === 'in_progress').length,
      overdue: items.filter((activity) => activity.status !== 'completed' && activity.status !== 'cancelled' && (activity.dueDate ?? '') !== '' && (activity.dueDate ?? '') < today).length,
      completed: items.filter((activity) => activity.status === 'completed').length,
      meetings: items.filter((activity) => activity.kind === 'meeting' || activity.kind === 'demo').length,
    };
  }, [all.items]);

  const columns = React.useMemo<ColumnDef<Activity, unknown>[]>(
    () => [
      {
        id: 'subject',
        header: 'Activity',
        accessorKey: 'subject',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={`/app/activities/${row.original.id}`}
              className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
            >
              {row.original.subject}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
              {row.original.subjects[0]?.label ?? 'No linked record'}
            </span>
          </div>
        ),
      },
      {
        id: 'kind',
        header: 'Type',
        accessorKey: 'kind',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-muted">
            <KindIcon kind={row.original.kind} />
            {KIND_LABEL[row.original.kind] ?? row.original.kind}
          </span>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: 'priority', header: 'Priority', accessorKey: 'priority', cell: ({ row }) => <StatusBadge status={row.original.priority} size="sm" /> },
      { id: 'owner', header: 'Owner', accessorKey: 'ownerName', cell: ({ row }) => <span className="truncate text-xs text-muted">{row.original.ownerName}</span> },
      { id: 'due', header: 'Due', accessorKey: 'dueAt', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.dueAt)}</span> },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Activities"
        description="Every logged call, email, meeting, note and task on a record, with the record links preserved."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Activities' }]}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild><Link to="/crm/activities">Live Activities (Laravel)</Link></Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/tasks">Tasks</Link>
            </Button>
          </>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search activities"
            resultCount={activities.meta ? `${activities.meta.total.toLocaleString()} activities` : undefined}
            chips={[
              ...(kindFilter !== 'all' ? [{ id: 'kind', label: `Type: ${KIND_LABEL[kindFilter] ?? kindFilter}`, tone: 'brand' as const, onRemove: () => setKindFilter('all') }] : []),
              ...(statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, tone: 'brand' as const, onRemove: () => setStatusFilter('all') }] : []),
            ]}
            onClearFilters={() => {
              setKindFilter('all');
              setStatusFilter('all');
              setSearch('');
            }}
            actions={
              <>
                <Select
                  value={kindFilter}
                  onValueChange={(value) => {
                    setKindFilter(value);
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All types' },
                    ...['task', 'call', 'meeting', 'email', 'note', 'demo', 'visit'].map((value) => ({ value, label: KIND_LABEL[value] ?? value })),
                  ]}
                  selectSize="sm"
                  className="w-[10rem]"
                  aria-label="Filter by type"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    ...['open', 'in_progress', 'completed', 'deferred', 'cancelled'].map((value) => ({ value, label: value.replace(/_/g, ' ') })),
                  ]}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Filter by status"
                />
              </>
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Activities" value={formatNumber(metrics.total)} tone="violet" />
          <MiniStat label="Open" value={formatNumber(metrics.open)} tone="blue" />
          <MiniStat label="Overdue" value={formatNumber(metrics.overdue)} tone="red" />
          <MiniStat label="Completed" value={formatNumber(metrics.completed)} tone="green" />
          <MiniStat label="Meetings & demos" value={formatNumber(metrics.meetings)} tone="teal" />
        </div>

        <DemoNotice tone="neutral">
          Activities are seeded sample records. Completing, reopening or snoozing one updates this browser only — nothing is
          synced to a calendar, mailbox or telephony provider.
        </DemoNotice>

        {activities.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={activities.items}
            onRowClick={(activity) => navigate(`/app/activities/${activity.id}`)}
            getRowId={(activity) => activity.id}
            emptyState={
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-fg">No activities match these filters</p>
                <p className="mt-1 text-xs text-muted">Clear a filter or widen the search.</p>
              </div>
            }
            footer={activities.meta ? <Pagination page={activities.meta.page} pageSize={activities.meta.pageSize} total={activities.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function ActivityDetail() {
  const services = useServices();
  const { activityId } = useParams<{ activityId: string }>();
  const id = activityId ?? '';

  const activity = useAsync(() => services.activities.get(id), [id], { skip: !id });
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [snoozeOpen, setSnoozeOpen] = React.useState(false);
  const [disposition, setDisposition] = React.useState('completed');
  const [summary, setSummary] = React.useState('');
  const [snoozeChoice, setSnoozeChoice] = React.useState('tomorrow');

  const complete = useMutation(
    (input: { disposition: string; summary: string }) =>
      services.activities.complete([id], { disposition: input.disposition as never, summary: input.summary || undefined }),
    {
      successMessage: 'Activity marked complete.',
      onSuccess: () => {
        setCompleteOpen(false);
        setSummary('');
        activity.reload();
      },
    },
  );
  const reopen = useMutation(() => services.activities.reopen([id]), {
    successMessage: 'Activity reopened.',
    onSuccess: () => activity.reload(),
  });
  const snooze = useMutation(
    (until: string) => services.activities.snooze([id], until),
    {
      successMessage: 'Activity snoozed.',
      onSuccess: () => {
        setSnoozeOpen(false);
        activity.reload();
      },
    },
  );

  const record = activity.data;

  if (activity.loading) return <ListSkeleton rows={12} columns={3} />;
  if (activity.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This activity could not be found</h2>
            <p className="text-xs text-muted">{activity.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/activities/all">Back to activities</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isDone = record.status === 'completed' || record.status === 'cancelled';
  const snoozeUntil = () => {
    const days = snoozeChoice === 'tomorrow' ? 1 : snoozeChoice === 'three_days' ? 3 : 7;
    return new Date(Date.now() + days * 86_400_000).toISOString();
  };

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/activities/all', label: 'Activities' }}
          title={record.subject}
          subtitle={record.subjects.map((subject) => subject.label).join(' · ')}
          badges={
            <>
              <TonePill tone={KIND_TONE[record.kind] ?? 'neutral'}>
                <KindIcon kind={record.kind} />
                {KIND_LABEL[record.kind] ?? record.kind}
              </TonePill>
              <StatusBadge status={record.status} />
              <StatusBadge status={record.priority} />
              {record.source === 'automation' ? <Badge variant="outline" size="sm">Automation</Badge> : null}
            </>
          }
          facts={[
            { label: 'Owner', value: record.ownerName },
            { label: 'Due', value: formatDate(record.dueAt) },
            { label: 'Duration', value: record.durationMinutes ? `${record.durationMinutes} min` : '—' },
            { label: 'Visibility', value: record.visibility },
            { label: 'Created', value: formatDate(record.createdAt) },
          ]}
          actions={
            <>
              {!isDone ? (
                <Button variant="primary" size="sm" leadingIcon={<CheckCircle2 className="size-3.5" />} onClick={() => setCompleteOpen(true)}>
                  Mark complete
                </Button>
              ) : (
                <Button variant="secondary" size="sm" loading={reopen.pending} leadingIcon={<RotateCcw className="size-3.5" />} onClick={() => void reopen.run(undefined)}>
                  Reopen
                </Button>
              )}
              {!isDone ? (
                <Button variant="ghost" size="sm" leadingIcon={<CalendarClock className="size-3.5" />} onClick={() => setSnoozeOpen(true)}>
                  Snooze
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {record.body ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{record.body}</p> : <p className="text-xs italic text-faint">No notes were recorded for this activity.</p>}

              {record.delivery ? (
                <Alert tone={record.delivery.state === 'failed' ? 'danger' : 'neutral'} title="Email delivery">
                  {record.delivery.state === 'simulated_sent'
                    ? 'Recorded locally. No email was transmitted from this build.'
                    : record.delivery.note ?? record.delivery.state.replace(/_/g, ' ')}
                </Alert>
              ) : null}

              {record.checklist && record.checklist.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-faint">Checklist</p>
                  <ul className="space-y-1.5">
                    {record.checklist.map((item) => (
                      <li key={item.id}>
                        <Checkbox checked={item.done} disabled label={item.label} />
                      </li>
                    ))}
                  </ul>
                  <p className="text-[0.6875rem] text-faint">Checklist items are shown for context; tasks carry the interactive checklist.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {record.attendees && record.attendees.length > 0 ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <Users className="size-3.5 text-subtle" aria-hidden />
                <CardTitle>Attendees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {record.attendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-medium text-fg">{attendee.name}</span>
                      <span className="block truncate text-[0.6875rem] text-faint">{attendee.kind === 'internal' ? 'Team' : 'Customer'}</span>
                    </div>
                    <StatusBadge status={attendee.status} size="sm" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <PropertyList
                items={[
                  { label: 'Type', value: KIND_LABEL[record.kind] ?? record.kind },
                  { label: 'Status', value: <StatusBadge status={record.status} size="sm" /> },
                  { label: 'Priority', value: <StatusBadge status={record.priority} size="sm" /> },
                  { label: 'Owner', value: record.ownerName },
                  { label: 'Due', value: formatDate(record.dueAt) },
                  { label: 'Completed', value: record.completedAt ? formatDate(record.completedAt) : 'Not yet' },
                  { label: 'Provenance', value: record.source },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {record.subjects.map((subject) => (
                <Link
                  key={`${subject.type}-${subject.id}`}
                  to={relatedPath(subject.type, subject.id)}
                  className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-hover"
                >
                  <span className="truncate text-muted">{subject.label}</span>
                  <Badge variant="outline" size="sm">
                    {subject.type}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          {record.outcome ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <Sparkles className="size-3.5 text-subtle" aria-hidden />
                <CardTitle>Outcome</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted">
                  <span className="font-medium text-fg">Disposition:</span> {record.outcome.disposition.replace(/_/g, ' ')}
                </p>
                {record.outcome.summary ? <p className="text-xs leading-relaxed text-muted">{record.outcome.summary}</p> : null}
                {record.outcome.nextStep ? <p className="text-[0.6875rem] text-faint">Next step: {record.outcome.nextStep}</p> : null}
              </CardContent>
            </Card>
          ) : null}

          <DemoNotice tone="warning">
            This build has no calendar, mailbox, telephony or automation integration. Status changes persist to this browser only.
          </DemoNotice>
        </div>
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent
          title="Mark this activity complete"
          description="Records an outcome on the activity. Nothing is sent to the customer or synced elsewhere."
          footer={
            <>
              <Button variant="secondary" onClick={() => setCompleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="activity-complete-form" loading={complete.pending}>
                Mark complete
              </Button>
            </>
          }
        >
          <form
            id="activity-complete-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void complete.run({ disposition, summary });
            }}
          >
            <Field label="Disposition" htmlFor="activity-disposition">
              <Select
                id="activity-disposition"
                value={disposition}
                onValueChange={setDisposition}
                options={['completed', 'connected', 'no_answer', 'left_voicemail', 'busy', 'wrong_number', 'rescheduled', 'no_show'].map((value) => ({
                  value,
                  label: value.replace(/_/g, ' '),
                }))}
              />
            </Field>
            <Field label="Summary" htmlFor="activity-summary" hint="Optional">
              <Textarea id="activity-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} placeholder="What happened, and what is the next step?" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent
          title="Snooze this activity"
          description="Records a later due time. No reminder scheduler runs in this build."
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSnoozeOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={snooze.pending} onClick={() => void snooze.run(snoozeUntil())}>
                Snooze
              </Button>
            </>
          }
        >
          <Field label="Wake up" htmlFor="activity-snooze">
            <Select
              id="activity-snooze"
              value={snoozeChoice}
              onValueChange={setSnoozeChoice}
              options={[
                { value: 'tomorrow', label: 'Tomorrow' },
                { value: 'three_days', label: 'In three days' },
                { value: 'next_week', label: 'Next week' },
              ]}
            />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { KindIcon, KIND_LABEL, KIND_TONE };
