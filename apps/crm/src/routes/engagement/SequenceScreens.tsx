'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  Mail,
  MessageSquare,
  Pause,
  Phone,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Sequence, SequenceEnrollment, SequenceStep } from '@crm/shared-types';
import type { Tone } from '@crm/ui';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  IconButton,
  MiniStat,
  MultiSelect,
  Pagination,
  PropertyList,
  Select,
  TonePill,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Sales sequences (cadences).
 *
 * Two facts shape these screens:
 *
 *   - **Enrolments are derived, not stored.** The seeded store keeps aggregate counters on a
 *     sequence but no per-record rows, so `services.sequences.enrollments` derives a stable set
 *     from the sequence's own counters and the lead/contact pool. The detail screen states this
 *     rather than implying a real cadence engine filled the list.
 *   - **A sequence never sends anything here.** Step "send" controls are labelled simulated and
 *     only raise a toast; there is no transport, so the UI never claims a message left the
 *     browser.
 */

const SEQUENCE_STATUS_TONE: Record<string, Tone> = {
  draft: 'slate',
  active: 'green',
  paused: 'amber',
  archived: 'neutral',
};

const ENROLLMENT_STATUS_TONE: Record<string, Tone> = {
  active: 'green',
  paused: 'amber',
  completed: 'blue',
  replied: 'teal',
  bounced: 'red',
  opted_out: 'slate',
  failed: 'red',
};

const STEP_TONE: Record<string, Tone> = {
  email: 'blue',
  call: 'teal',
  task: 'violet',
  linkedin: 'blue',
  sms: 'green',
  whatsapp: 'green',
  wait: 'slate',
};

function StepIcon({ kind, className }: { kind: string; className?: string }) {
  const props = { className: cn('size-3.5', className), 'aria-hidden': true } as const;
  if (kind === 'email') return <Mail {...props} />;
  if (kind === 'call') return <Phone {...props} />;
  if (kind === 'task') return <ClipboardList {...props} />;
  if (kind === 'linkedin') return <Users {...props} />;
  if (kind === 'sms' || kind === 'whatsapp') return <MessageSquare {...props} />;
  return <Clock {...props} />;
}

function waitLabel(step: SequenceStep): string {
  if (step.order === 1 && step.waitDays === 0) return 'Sent immediately';
  if (step.waitDays === 0) return 'No wait';
  return `Wait ${step.waitDays} day${step.waitDays === 1 ? '' : 's'}`;
}

function targetLabel(type: string): string {
  return type === 'lead' ? 'Leads' : 'Contacts';
}

/* ---------------------------------------------------------------------- list */

export default function SequenceList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('all');

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 20,
      q: search || undefined,
      sort: [{ field: 'updatedAt', direction: 'desc' as const }],
      filter:
        statusFilter === 'all'
          ? undefined
          : { id: 'sequence-status', conjunction: 'and' as const, clauses: [{ field: 'status', operator: 'eq' as const, value: statusFilter }] as never },
    }),
    [page, search, statusFilter],
  );

  const sequences = useList(() => services.sequences.list(query), [JSON.stringify(query)]);
  const all = useList(() => services.sequences.list({ pageSize: 200 }), []);

  const metrics = React.useMemo(() => {
    const items = all.items;
    const enrolled = items.reduce((sum, sequence) => sum + sequence.enrolledCount, 0);
    const active = items.reduce((sum, sequence) => sum + sequence.activeCount, 0);
    const replyRate = items.length > 0 ? items.reduce((sum, sequence) => sum + sequence.replyRate, 0) / items.length : 0;
    return {
      total: items.length,
      active: items.filter((sequence) => sequence.status === 'active').length,
      paused: items.filter((sequence) => sequence.status === 'paused').length,
      enrolled,
      activeEnrolments: active,
      replyRate,
    };
  }, [all.items]);

  const columns = React.useMemo<ColumnDef<Sequence, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Sequence',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/sequences/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.name}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.description ?? 'No description'}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <TonePill tone={SEQUENCE_STATUS_TONE[row.original.status] ?? 'neutral'}>{row.original.status}</TonePill>
        ),
      },
      { id: 'target', header: 'Targets', accessorKey: 'targetType', cell: ({ row }) => <span className="text-xs text-muted">{targetLabel(row.original.targetType)}</span> },
      {
        id: 'steps',
        header: 'Steps',
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.steps.length}</span>,
      },
      {
        id: 'enrolled',
        header: 'Enrolled',
        accessorKey: 'enrolledCount',
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.enrolledCount)}</span>,
      },
      {
        id: 'activeCount',
        header: 'Active',
        accessorKey: 'activeCount',
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.activeCount)}</span>,
      },
      {
        id: 'replyRate',
        header: 'Reply rate',
        accessorKey: 'replyRate',
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.replyRate.toFixed(1)}%</span>,
      },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Sequences"
        description="Multi-step outbound cadences over leads and contacts. Steps are seeded, and no message is transmitted from this build."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Sequences' }]}
        actions={<IconButton label="Refresh sequences" icon={<RefreshCw className={cn(sequences.loading && 'animate-spin')} />} size="icon-sm" onClick={() => sequences.reload()} />}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search sequences"
            resultCount={sequences.meta ? `${sequences.meta.total.toLocaleString()} sequences` : undefined}
            chips={statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter}`, tone: 'brand' as const, onRemove: () => setStatusFilter('all') }] : []}
            onClearFilters={() => {
              setStatusFilter('all');
              setSearch('');
            }}
            actions={
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                options={[{ value: 'all', label: 'All statuses' }, ...['draft', 'active', 'paused', 'archived'].map((value) => ({ value, label: value }))]}
                selectSize="sm"
                className="w-[11rem]"
                aria-label="Filter by status"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Sequences" value={formatNumber(metrics.total)} tone="violet" />
          <MiniStat label="Active" value={formatNumber(metrics.active)} tone="green" />
          <MiniStat label="Paused" value={formatNumber(metrics.paused)} tone="amber" />
          <MiniStat label="Enrolled" value={formatNumber(metrics.enrolled)} tone="blue" />
          <MiniStat label="Avg. reply rate" value={`${metrics.replyRate.toFixed(1)}%`} tone="teal" />
        </div>

        <DemoNotice tone="neutral">
          Sequences and their aggregate counters are seeded sample data. Enrolment rows are derived deterministically from those
          counters, and every change made here is held in this browser session only.
        </DemoNotice>

        {sequences.loading ? (
          <ListSkeleton rows={8} columns={7} />
        ) : (
          <DataTable
            columns={columns}
            data={sequences.items}
            onRowClick={(sequence) => navigate(`/app/sequences/${sequence.id}`)}
            getRowId={(sequence) => sequence.id}
            emptyState={
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-fg">No sequences match these filters</p>
                <p className="mt-1 text-xs text-muted">Clear the status filter or widen the search.</p>
              </div>
            }
            footer={sequences.meta ? <Pagination page={sequences.meta.page} pageSize={sequences.meta.pageSize} total={sequences.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function SequenceDetail() {
  const services = useServices();
  const { sequenceId } = useParams<{ sequenceId: string }>();
  const id = sequenceId ?? '';

  const sequence = useAsync(() => services.sequences.get(id), [id], { skip: !id });

  const [enrolPage, setEnrolPage] = React.useState(1);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [enrolOpen, setEnrolOpen] = React.useState(false);
  const [enrolChoice, setEnrolChoice] = React.useState<string[]>([]);
  const [removeOpen, setRemoveOpen] = React.useState(false);

  const enrolQuery = React.useMemo(
    () => ({ page: enrolPage, pageSize: 15, sort: [{ field: 'enrolledAt', direction: 'desc' as const }] }),
    [enrolPage],
  );
  const enrolments = useList(() => services.sequences.enrollments(id, enrolQuery), [id, JSON.stringify(enrolQuery)], { skip: !id });

  const record = sequence.data;

  // Only load the pool that the sequence targets, so the enrol dialog matches its contract.
  const leads = useList(() => services.leads.list({ pageSize: 200 }), []);
  const contacts = useList(() => services.contacts.list({ pageSize: 200 }), []);

  const reload = React.useCallback(() => {
    sequence.reload();
    enrolments.reload();
  }, [sequence, enrolments]);

  const setStatus = useMutation((status: Sequence['status']) => services.sequences.update(id, { status }), {
    successMessage: (result) => `Sequence ${result.status === 'active' ? 'resumed' : 'paused'}.`,
    onSuccess: () => sequence.reload(),
  });
  const pauseSelected = useMutation((ids: string[]) => services.sequences.pauseEnrollments(ids), {
    successMessage: (result) => `${result.succeeded} of ${result.requested} enrolment(s) paused.`,
    onSuccess: () => {
      reload();
      setSelected([]);
    },
  });
  const resumeSelected = useMutation((ids: string[]) => services.sequences.resumeEnrollments(ids), {
    successMessage: (result) => `${result.succeeded} of ${result.requested} enrolment(s) resumed.`,
    onSuccess: () => {
      reload();
      setSelected([]);
    },
  });
  const removeSelected = useMutation((ids: string[]) => services.sequences.removeEnrollment(ids[0] ?? ''), {
    successMessage: 'Enrolment removed from this session.',
    onSuccess: () => {
      reload();
      setSelected([]);
      setRemoveOpen(false);
    },
  });
  const enroll = useMutation(
    (ids: string[]) => services.sequences.enroll(id, ids.map((recordId) => ({ type: (record?.targetType ?? 'lead') as 'lead' | 'contact', id: recordId }))),
    {
      successMessage: (result) => `${result.succeeded} record(s) enrolled in this session.`,
      onSuccess: () => {
        reload();
        setEnrolOpen(false);
        setEnrolChoice([]);
      },
    },
  );

  const pool = record?.targetType === 'contact' ? contacts.items : leads.items;
  const poolOptions = React.useMemo(
    () =>
      pool.map((item) => ({
        value: item.id,
        label: 'displayName' in item ? item.displayName : [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || item.companyName || item.reference,
      })),
    [pool],
  );

  const enrollmentColumns = React.useMemo<ColumnDef<SequenceEnrollment, unknown>[]>(
    () => [
      {
        id: 'record',
        header: 'Record',
        accessorKey: 'recordLabel',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.recordLabel}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.recordType}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <TonePill tone={ENROLLMENT_STATUS_TONE[row.original.status] ?? 'neutral'}>{row.original.status.replace(/_/g, ' ')}</TonePill>,
      },
      {
        id: 'step',
        header: 'Current step',
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">Step {row.original.currentStepOrder}</span>,
      },
      {
        id: 'next',
        header: 'Next step',
        accessorKey: 'nextStepAt',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.nextStepAt ? formatDate(row.original.nextStepAt, 'relative') : '—'}</span>,
      },
      {
        id: 'enrolledAt',
        header: 'Enrolled',
        accessorKey: 'enrolledAt',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.enrolledAt, 'relative')}</span>,
      },
    ],
    [],
  );

  if (sequence.loading) return <ListSkeleton rows={12} columns={3} />;
  if (sequence.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This sequence could not be found</h2>
            <p className="text-xs text-muted">{sequence.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/sequences">Back to sequences</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const steps = [...record.steps].sort((a, b) => a.order - b.order);

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/sequences', label: 'Sequences' }}
          title={record.name}
          subtitle={record.description}
          badges={
            <>
              <TonePill tone={SEQUENCE_STATUS_TONE[record.status] ?? 'neutral'}>{record.status}</TonePill>
              <Badge variant="outline" size="sm">
                {targetLabel(record.targetType)}
              </Badge>
            </>
          }
          facts={[
            { label: 'Steps', value: String(record.steps.length) },
            { label: 'Enrolled', value: formatNumber(record.enrolledCount) },
            { label: 'Active', value: formatNumber(record.activeCount) },
            { label: 'Completed', value: formatNumber(record.completedCount) },
            { label: 'Owner', value: record.ownerId },
          ]}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<UserPlus className="size-3.5" />}
                onClick={() => setEnrolOpen(true)}
              >
                Enrol records
              </Button>
              {record.status === 'active' ? (
                <Button variant="ghost" size="sm" loading={setStatus.pending} leadingIcon={<Pause className="size-3.5" />} onClick={() => void setStatus.run('paused')}>
                  Pause
                </Button>
              ) : (
                <Button variant="ghost" size="sm" loading={setStatus.pending} leadingIcon={<Play className="size-3.5" />} onClick={() => void setStatus.run('active')}>
                  Resume
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Send className="size-3.5" />}
                onClick={() => notify.simulated('Next step queued', 'Recorded in this browser only. No email, call or message was transmitted, and no scheduler runs.')}
              >
                Send next step
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Enrolled" value={formatNumber(record.enrolledCount)} tone="blue" />
          <MiniStat label="Active" value={formatNumber(record.activeCount)} tone="green" />
          <MiniStat label="Reply rate" value={`${record.replyRate.toFixed(1)}%`} tone="teal" />
          <MiniStat label="Open rate" value={`${record.openRate.toFixed(1)}%`} tone="violet" />
          <MiniStat label="Meeting rate" value={`${record.meetingRate.toFixed(1)}%`} tone="amber" />
        </div>

        <DemoNotice tone="warning">
          This is a front-end demonstration of a cadence. No email, dialler or messaging account is connected, and the “Send next
          step” control records nothing outside this browser.
        </DemoNotice>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Steps</CardTitle>
                <span className="text-2xs text-faint">{steps.length} steps</span>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {steps.map((step) => {
                    const tone = STEP_TONE[step.kind] ?? 'slate';
                    return (
                      <li key={step.id} className="flex gap-3">
                        <span className="flex flex-col items-center">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface font-medium tabular-nums text-subtle">
                            <StepIcon kind={step.kind} />
                          </span>
                          <span className="mt-1 text-[0.625rem] tabular-nums text-faint">{step.order}</span>
                        </span>
                        <div className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <TonePill tone={tone}>{step.kind}</TonePill>
                            <span className="text-xs font-medium text-fg">{step.name}</span>
                            <span className="ms-auto text-[0.6875rem] text-faint">{waitLabel(step)}</span>
                          </div>
                          {step.subject ? <p className="mt-1.5 truncate text-xs text-muted">{step.subject}</p> : null}
                          {step.taskTitle ? <p className="mt-1.5 text-xs text-muted">Creates task: {step.taskTitle}</p> : null}
                          {step.bodyPreview ? <p className="mt-1 text-[0.6875rem] leading-relaxed text-faint">{step.bodyPreview}</p> : null}
                          {step.stats ? (
                            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border-subtle pt-2 text-[0.6875rem]">
                              <div className="flex gap-1">
                                <dt className="text-faint">Sent</dt>
                                <dd className="tabular-nums text-muted">{formatNumber(step.stats.sent)}</dd>
                              </div>
                              <div className="flex gap-1">
                                <dt className="text-faint">Opened</dt>
                                <dd className="tabular-nums text-muted">{formatNumber(step.stats.opened)}</dd>
                              </div>
                              <div className="flex gap-1">
                                <dt className="text-faint">Replied</dt>
                                <dd className="tabular-nums text-muted">{formatNumber(step.stats.replied)}</dd>
                              </div>
                              <div className="flex gap-1">
                                <dt className="text-faint">Meetings</dt>
                                <dd className="tabular-nums text-muted">{formatNumber(step.stats.meetings)}</dd>
                              </div>
                            </dl>
                          ) : null}
                          {step.kind !== 'wait' ? (
                            <div className="mt-2.5">
                              <Button
                                variant="ghost"
                                size="xs"
                                leadingIcon={<Send className="size-3" />}
                                onClick={() => notify.simulated(`“${step.name}” queued`, 'Simulated for demonstration — the step was not sent to anyone.')}
                              >
                                Send this step now
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Enrolments</CardTitle>
                <span className="text-2xs text-faint">{enrolments.meta ? `${formatNumber(enrolments.meta.total)} rows` : ''}</span>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-subtle/60 px-3 py-2">
                    <span className="text-xs font-medium text-fg">
                      {selected.length} selected
                    </span>
                    <div className="ms-auto flex flex-wrap items-center gap-1.5">
                      <Button variant="secondary" size="sm" loading={pauseSelected.pending} onClick={() => void pauseSelected.run(selected)}>
                        Pause
                      </Button>
                      <Button variant="secondary" size="sm" loading={resumeSelected.pending} onClick={() => void resumeSelected.run(selected)}>
                        Resume
                      </Button>
                      <Button variant="danger-outline" size="sm" disabled={selected.length !== 1} onClick={() => setRemoveOpen(true)}>
                        Remove
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : null}

                {enrolments.loading ? (
                  <ListSkeleton rows={6} columns={5} />
                ) : (
                  <DataTable
                    columns={enrollmentColumns}
                    data={enrolments.items}
                    selectable
                    selectedIds={selected}
                    onSelectedIdsChange={setSelected}
                    getRowId={(enrolment) => enrolment.id}
                    emptyState={
                      <div className="p-8 text-center">
                        <p className="text-sm font-medium text-fg">No enrolments to show</p>
                        <p className="mt-1 text-xs text-muted">Enrolment rows are derived from the sequence counters; there are none in view.</p>
                      </div>
                    }
                    footer={
                      enrolments.meta ? (
                        <Pagination page={enrolments.meta.page} pageSize={enrolments.meta.pageSize} total={enrolments.meta.total} onPageChange={setEnrolPage} />
                      ) : null
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <PropertyList
                  items={[
                    { label: 'Status', value: <TonePill tone={SEQUENCE_STATUS_TONE[record.status] ?? 'neutral'}>{record.status}</TonePill> },
                    { label: 'Targets', value: targetLabel(record.targetType) },
                    { label: 'Exit on reply', value: record.exitOnReply ? 'Yes' : 'No' },
                    { label: 'Exit on meeting', value: record.exitOnMeeting ? 'Yes' : 'No' },
                    { label: 'Reply rate', value: `${record.replyRate.toFixed(1)}%` },
                    { label: 'Open rate', value: `${record.openRate.toFixed(1)}%` },
                    { label: 'Meeting rate', value: `${record.meetingRate.toFixed(1)}%` },
                    { label: 'Updated', value: formatDate(record.updatedAt, 'relative') },
                  ]}
                />
              </CardContent>
            </Card>

            {record.sendWindow ? (
              <Card>
                <CardHeader className="flex-row items-center gap-2">
                  <Clock className="size-3.5 text-subtle" aria-hidden />
                  <CardTitle>Send window</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted">
                  <p>
                    {record.sendWindow.startHour}:00–{record.sendWindow.endHour}:00, {record.sendWindow.timezone}
                  </p>
                  <p>
                    Days: {record.sendWindow.days.map((day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day - 1] ?? day).join(', ')}
                  </p>
                  <DemoNotice tone="neutral">The send window is descriptive here; no scheduler enforces it in this build.</DemoNotice>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <Sparkles className="size-3.5 text-subtle" aria-hidden />
                <CardTitle>About these rows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-relaxed text-muted">
                <p>The seeded store keeps sequence counters, not per-record enrolments.</p>
                <p>
                  This list is derived deterministically from those counters and the seeded {record.targetType} pool, so the same
                  sequence always produces the same rows. Pause, resume and remove are held in this browser session.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={enrolOpen} onOpenChange={setEnrolOpen}>
        <DialogContent
          title={`Enrol ${targetLabel(record.targetType).toLowerCase()}`}
          description="Adds records to this sequence for this browser session only. Nothing is emailed and no cadence engine runs."
          size="md"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setEnrolOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={enroll.pending} disabled={enrolChoice.length === 0} onClick={() => void enroll.run(enrolChoice)}>
                Enrol {enrolChoice.length > 0 ? `${enrolChoice.length} ` : ''}records
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label={`Choose ${targetLabel(record.targetType).toLowerCase()}`} htmlFor="sequence-enrol-pool">
              <MultiSelect id="sequence-enrol-pool" values={enrolChoice} onChange={setEnrolChoice} options={poolOptions} placeholder="Search records…" />
            </Field>
            <p className="text-[0.6875rem] leading-relaxed text-faint">
              {poolOptions.length} {record.targetType === 'contact' ? 'contacts' : 'leads'} are available from the seeded dataset.
            </p>
            {enroll.error ? <Alert tone="danger" title="The records could not be enrolled">{enroll.error}</Alert> : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove this enrolment?"
        description="The enrolment is hidden from this browser session's derived list. The seeded counters are not rewritten."
        confirmLabel="Remove enrolment"
        tone="danger"
        loading={removeSelected.pending}
        onConfirm={() => void removeSelected.run(selected)}
      />
    </div>
  );
}

export { SequenceList, SEQUENCE_STATUS_TONE, ENROLLMENT_STATUS_TONE, STEP_TONE, StepIcon };
