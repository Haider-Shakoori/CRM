'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Lock, MessageSquare, Repeat, Send, ShieldAlert } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Ticket, TicketMessage } from '@crm/shared-types';
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
  Dialog,
  DialogContent,
  Field,
  MiniStat,
  Pagination,
  Progress,
  Select,
  StatusBadge,
  Textarea,
  TonePill,
  cn,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Support screens.
 *
 * The service desk is where a demo most easily drifts into make-believe, so this file is
 * strict about three things:
 *
 *   - **SLA timers are derived, not maintained.** The state shown is computed by the mock
 *     service from the policy and the timestamps; no background clock runs and the panel
 *     says so. That keeps the two places a breach could be computed from disagreeing.
 *   - **Outbound replies are recorded, never transmitted.** The composer labels this before
 *     a keystroke and the success toast says the message was recorded locally.
 *   - **Controls appear only when their precondition holds.** Resolve is offered on an open
 *     ticket; reopen only on a resolved or closed one; escalate only on a live one.
 */

const SLA_TONE: Record<string, Tone> = {
  on_track: 'green',
  at_risk: 'amber',
  breached: 'red',
  met: 'green',
  not_applicable: 'neutral',
};

const SLA_LABEL: Record<string, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
  met: 'Met',
  not_applicable: 'No policy',
};

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  web_portal: 'Web portal',
  phone: 'Phone',
  chat: 'Chat',
  social: 'Social',
  api: 'API',
  internal: 'Internal',
  field_visit: 'Field visit',
};

const OPEN_STATUSES = ['new', 'open', 'pending_customer', 'pending_internal', 'on_hold', 'reopened'];

/** Share of the resolution window that has elapsed, clamped to 0–100. */
function elapsedPercent(startedAt: string, dueAt: string | undefined, nowMs: number): number {
  if (!dueAt) return 0;
  const start = new Date(startedAt).getTime();
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return 0;
  const pct = ((nowMs - start) / (due - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/* ---------------------------------------------------------------------- list */

export default function TicketsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [priorityFilter, setPriorityFilter] = React.useState('all');
  const [view, setView] = React.useState<'open' | 'unassigned' | 'breached' | 'all'>('open');

  const currentUser = useAsync(() => services.tenant.currentUser(), []);

  const filter = React.useMemo(() => {
    const clauses: Array<{ field: string; operator: 'eq' | 'in' | 'is_empty'; value?: unknown }> = [];
    if (view === 'open') clauses.push({ field: 'status', operator: 'in', value: OPEN_STATUSES });
    if (view === 'unassigned') clauses.push({ field: 'assigneeId', operator: 'is_empty' });
    if (view === 'breached') clauses.push({ field: 'slaState', operator: 'eq', value: 'breached' });
    if (statusFilter !== 'all') clauses.push({ field: 'status', operator: 'eq', value: statusFilter });
    if (priorityFilter !== 'all') clauses.push({ field: 'priority', operator: 'eq', value: priorityFilter });
    return clauses.length > 0 ? { id: 'ticket-filters', conjunction: 'and' as const, clauses } : undefined;
  }, [view, statusFilter, priorityFilter]);

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 50,
      q: search || undefined,
      sort: [{ field: 'updatedAt', direction: 'desc' as const }],
      filter: filter as never,
    }),
    [page, search, filter],
  );

  const tickets = useList(() => services.tickets.list(query), [JSON.stringify(query)]);
  const overview = useAsync(() => services.tickets.overview(), []);

  const columns = React.useMemo<ColumnDef<Ticket, unknown>[]>(
    () => [
      {
        id: 'subject',
        header: 'Ticket',
        accessorKey: 'subject',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={`/app/tickets/${row.original.id}`}
              className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
            >
              {row.original.subject}
            </Link>
            <span className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-faint">
              <span className="font-mono">{row.original.reference}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{row.original.accountName ?? 'No account'}</span>
            </span>
          </div>
        ),
      },
      {
        id: 'requester',
        header: 'Requester',
        accessorKey: 'requesterName',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs text-fg">{row.original.requesterName}</span>
            <span className="block truncate text-[0.6875rem] text-faint">{CHANNEL_LABEL[row.original.channel] ?? row.original.channel}</span>
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
      {
        id: 'sla',
        header: 'SLA',
        accessorKey: 'slaState',
        cell: ({ row }) => <StatusBadge status={row.original.slaState ?? 'not_applicable'} label={SLA_LABEL[row.original.slaState ?? 'not_applicable']} size="sm" />,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        accessorKey: 'assigneeName',
        cell: ({ row }) =>
          row.original.assigneeName ? (
            <span className="text-xs text-muted">{row.original.assigneeName}</span>
          ) : (
            <span className="text-xs italic text-faint">Unassigned</span>
          ),
      },
      {
        id: 'updated',
        header: 'Updated',
        accessorKey: 'updatedAt',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.updatedAt, 'relative')}</span>,
      },
    ],
    [],
  );

  const metrics = overview.data?.metrics;

  return (
    <div className="pb-8">
      <PageHeader
        title="Support"
        description="Ticket queues with SLA states derived from the policy, plus the knowledge base and inbox that surround them."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Support' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search subject, requester or reference"
            resultCount={tickets.meta ? `${tickets.meta.total.toLocaleString()} tickets` : undefined}
            chips={[
              ...(statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, tone: 'brand' as const, onRemove: () => setStatusFilter('all') }] : []),
              ...(priorityFilter !== 'all' ? [{ id: 'priority', label: `Priority: ${priorityFilter}`, tone: 'brand' as const, onRemove: () => setPriorityFilter('all') }] : []),
            ]}
            onClearFilters={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setSearch('');
            }}
            actions={
              <>
                <Select
                  value={view}
                  onValueChange={(value) => {
                    setView(value as typeof view);
                    setPage(1);
                  }}
                  options={[
                    { value: 'open', label: 'Open tickets' },
                    { value: 'unassigned', label: 'Unassigned' },
                    { value: 'breached', label: 'Breached SLA' },
                    { value: 'all', label: 'Everything' },
                  ]}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Queue view"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  options={[{ value: 'all', label: 'All statuses' }, ...['new', 'open', 'pending_customer', 'pending_internal', 'on_hold', 'resolved', 'closed', 'reopened'].map((value) => ({ value, label: value.replace(/_/g, ' ') }))]}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Filter by status"
                />
                <Select
                  value={priorityFilter}
                  onValueChange={(value) => {
                    setPriorityFilter(value);
                    setPage(1);
                  }}
                  options={[{ value: 'all', label: 'All priorities' }, ...['critical', 'high', 'normal', 'low'].map((value) => ({ value, label: value }))]}
                  selectSize="sm"
                  className="w-[10rem]"
                  aria-label="Filter by priority"
                />
              </>
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Open tickets" value={formatNumber(metrics?.openTickets ?? 0)} tone="blue" />
          <MiniStat label="Unassigned" value={formatNumber(metrics?.unassigned ?? 0)} tone="amber" />
          <MiniStat label="Breached SLA" value={formatNumber(metrics?.overdue ?? 0)} tone="red" />
          <MiniStat label="First response" value={metrics ? `${formatNumber(metrics.avgFirstResponseMinutes)} min` : '—'} tone="teal" />
          <MiniStat label="CSAT" value={metrics ? `${metrics.csat.toFixed(2)} / 5` : '—'} tone="violet" />
        </div>

        <p className="text-[0.6875rem] leading-relaxed text-faint">
          Showing: <span className="font-medium text-muted">{view === 'open' ? 'open tickets' : view === 'unassigned' ? 'tickets with no assignee' : view === 'breached' ? 'tickets that breached their SLA target' : 'every ticket'}</span>. Currently signed in as {currentUser.data?.displayName ?? 'a demo user'}.
        </p>

        {tickets.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={tickets.items}
            onRowClick={(ticket) => navigate(`/app/tickets/${ticket.id}`)}
            getRowId={(ticket) => ticket.id}
            emptyState={
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-fg">No tickets match this queue</p>
                <p className="mt-1 text-xs text-muted">Adjust the view or filters, or clear the search.</p>
              </div>
            }
            footer={tickets.meta ? <Pagination page={tickets.meta.page} pageSize={tickets.meta.pageSize} total={tickets.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

type TicketDialog = 'resolve' | 'reopen' | 'escalate' | null;

export function TicketDetail() {
  const services = useServices();
  const { ticketId } = useParams<{ ticketId: string }>();
  const id = ticketId ?? '';

  const ticket = useAsync(() => services.tickets.get(id), [id], { skip: !id });
  const messages = useList(() => services.tickets.messages(id), [id], { skip: !id });
  const users = useList(() => services.users.list({ pageSize: 100 }), []);
  const suggestions = useList(() => services.knowledgeBase.suggestForTicket(id, ticket.data?.subject ?? ''), [id, ticket.data?.subject]);

  const [dialog, setDialog] = React.useState<TicketDialog>(null);
  const [summary, setSummary] = React.useState('');
  const [rootCause, setRootCause] = React.useState('');
  const [reason, setReason] = React.useState('');

  const reload = React.useCallback(() => {
    ticket.reload();
    messages.reload();
  }, [ticket, messages]);

  const setStatus = useMutation((status: Ticket['status']) => services.tickets.updateStatus([id], status), {
    successMessage: 'Status updated.',
    onSuccess: () => reload(),
  });
  const setPriority = useMutation((priority: Ticket['priority']) => services.tickets.updatePriority([id], priority), {
    successMessage: 'Priority updated.',
    onSuccess: () => reload(),
  });
  const assign = useMutation((assigneeId: string | null) => services.tickets.assign([id], assigneeId), {
    successMessage: 'Assignee updated.',
    onSuccess: () => reload(),
  });
  const resolve = useMutation(
    (input: { summary: string; rootCause: string }) => services.tickets.resolve(id, input.summary, input.rootCause || undefined),
    {
      successMessage: 'Ticket resolved.',
      onSuccess: () => {
        setDialog(null);
        setSummary('');
        setRootCause('');
        reload();
      },
    },
  );
  const reopen = useMutation((value: string) => services.tickets.reopen(id, value), {
    successMessage: 'Ticket reopened.',
    onSuccess: () => {
      setDialog(null);
      setReason('');
      reload();
    },
  });
  const escalate = useMutation((value: string) => services.tickets.escalate([id], value), {
    successMessage: 'Ticket escalated.',
    onSuccess: () => {
      setDialog(null);
      setReason('');
      reload();
    },
  });

  const record = ticket.data;

  if (ticket.loading) return <ListSkeleton rows={12} columns={3} />;
  if (ticket.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This ticket could not be found</h2>
            <p className="text-xs text-muted">{ticket.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/tickets">Back to support</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isResolved = record.status === 'resolved' || record.status === 'closed';
  const isLive = !isResolved;

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/tickets', label: 'Support' }}
          title={record.subject}
          reference={record.reference}
          subtitle={`${record.requesterName}${record.accountName ? ` · ${record.accountName}` : ''}`}
          badges={
            <>
              <StatusBadge status={record.status} />
              <StatusBadge status={record.priority} />
              <StatusBadge status={record.slaState ?? 'not_applicable'} label={SLA_LABEL[record.slaState ?? 'not_applicable']} />
            </>
          }
          facts={[
            { label: 'Channel', value: CHANNEL_LABEL[record.channel] ?? record.channel },
            { label: 'Category', value: record.categoryLabel ?? '—' },
            { label: 'Assignee', value: record.assigneeName ?? 'Unassigned' },
            { label: 'Created', value: formatDate(record.createdAt) },
            { label: 'Resolution due', value: formatDate(record.resolutionDueAt) },
          ]}
          actions={
            <>
              {isLive ? (
                <Button variant="primary" size="sm" onClick={() => setDialog('resolve')} leadingIcon={<CheckCircle2 className="size-3.5" />}>
                  Resolve
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setDialog('reopen')} leadingIcon={<Repeat className="size-3.5" />}>
                  Reopen
                </Button>
              )}
              {isLive && record.escalationLevel === 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setDialog('escalate')} leadingIcon={<ShieldAlert className="size-3.5" />}>
                  Escalate
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Conversation</CardTitle>
              <span className="text-2xs text-faint">{messages.meta?.total ?? 0} messages</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {messages.loading ? (
                <ListSkeleton rows={4} columns={2} />
              ) : messages.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">No messages have been recorded on this ticket yet.</p>
              ) : (
                messages.items.map((message) => <TicketMessageRow key={message.id} message={message} />)
              )}
            </CardContent>
            <div className="border-t border-border-subtle p-4 sm:p-5">
              <TicketComposer ticketId={id} onSent={reload} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SlaMeter
                label="First response"
                dueAt={record.firstResponseDueAt}
                metAt={record.firstRespondedAt}
                startedAt={record.createdAt}
              />
              <SlaMeter label="Resolution" dueAt={record.resolutionDueAt} metAt={record.resolvedAt} startedAt={record.createdAt} />
              <DemoNotice tone="neutral">
                SLA states and the bars above are derived from the policy and the record timestamps. The demo runs no background timer.
              </DemoNotice>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Status" htmlFor="ticket-status">
                <Select
                  id="ticket-status"
                  value={record.status}
                  onValueChange={(value) => void setStatus.run(value as Ticket['status'])}
                  options={['new', 'open', 'pending_customer', 'pending_internal', 'on_hold', 'resolved', 'closed', 'reopened'].map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
                  selectSize="sm"
                />
              </Field>
              <Field label="Priority" htmlFor="ticket-priority">
                <Select
                  id="ticket-priority"
                  value={record.priority}
                  onValueChange={(value) => void setPriority.run(value as Ticket['priority'])}
                  options={['critical', 'high', 'normal', 'low'].map((value) => ({ value, label: value }))}
                  selectSize="sm"
                />
              </Field>
              <Field label="Assignee" htmlFor="ticket-assignee">
                <Select
                  id="ticket-assignee"
                  value={record.assigneeId ?? ''}
                  onValueChange={(value) => void assign.run(value === '' ? null : value)}
                  options={[{ value: '', label: 'Unassigned' }, ...users.items.map((user) => ({ value: user.id, label: user.displayName }))]}
                  selectSize="sm"
                  searchable
                />
              </Field>
              <dl className="space-y-2 border-t border-border-subtle pt-3 text-xs">
                <FactRow label="Type" value={record.type.replace(/_/g, ' ')} />
                <FactRow label="Severity" value={record.severity ?? '—'} />
                <FactRow label="Impacts" value={record.impactedUsers ? `${formatNumber(record.impactedUsers)} users` : '—'} />
                <FactRow label="Reopened" value={`${record.reopenCount}×`} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <BookOpen className="size-3.5 text-subtle" aria-hidden />
              <CardTitle>Suggested articles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.loading ? (
                <ListSkeleton rows={3} columns={1} />
              ) : suggestions.items.length === 0 ? (
                <p className="text-xs text-muted">No knowledge article matched this subject.</p>
              ) : (
                suggestions.items.slice(0, 4).map((article) => (
                  <Link
                    key={article.id}
                    to={`/app/knowledge-base/${article.id}`}
                    className="block rounded-md border border-border-subtle p-2.5 hover:border-border-strong hover:bg-hover"
                  >
                    <span className="block truncate text-xs font-medium text-fg">{article.title}</span>
                    <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{article.categoryLabel}</span>
                  </Link>
                ))
              )}
              <DemoNotice tone="neutral">Matches are scored from the synthetic article text, not a search service.</DemoNotice>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialog === 'resolve'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent
          title="Resolve this ticket"
          description="The resolution summary is stored on the ticket and shown to the requester in the real product."
          size="md"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={summary.trim().length < 4}
                loading={resolve.pending}
                onClick={() => void resolve.run({ summary: summary.trim(), rootCause: rootCause.trim() })}
              >
                Mark resolved
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Resolution summary" htmlFor="resolve-summary" required>
              <Textarea
                id="resolve-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
                placeholder="What fixed the issue, in one or two sentences."
              />
            </Field>
            <Field label="Root cause" htmlFor="resolve-cause" hint="Optional. Recorded for reporting, not shown to the requester.">
              <Textarea id="resolve-cause" value={rootCause} onChange={(event) => setRootCause(event.target.value)} rows={2} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'reopen'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent
          title="Reopen this ticket"
          description="Reopening returns the ticket to the queue and restarts its SLA clock."
          size="md"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={reason.trim().length < 4}
                loading={reopen.pending}
                onClick={() => void reopen.run(reason.trim())}
              >
                Reopen
              </Button>
            </>
          }
        >
          <Field label="Why is this being reopened?" htmlFor="reopen-reason" required>
            <Textarea id="reopen-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </Field>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'escalate'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent
          title="Escalate this ticket"
          description="Escalation raises the priority to critical and records the reason on the ticket timeline."
          size="md"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={reason.trim().length < 4}
                loading={escalate.pending}
                onClick={() => void escalate.run(reason.trim())}
              >
                Escalate
              </Button>
            </>
          }
        >
          <Field label="Escalation reason" htmlFor="escalate-reason" required>
            <Textarea id="escalate-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="truncate font-medium text-fg">{value}</dd>
    </div>
  );
}

function SlaMeter({ label, dueAt, metAt, startedAt }: { label: string; dueAt?: string; metAt?: string; startedAt: string }) {
  // Captured once per mount. Reading the clock during render is impure, and an SLA bar in a
  // demonstration does not need to tick live.
  const [nowMs] = React.useState(() => Date.now());
  const met = Boolean(metAt);
  const percent = met ? 100 : elapsedPercent(startedAt, dueAt, nowMs);
  const tone: Tone = met ? 'green' : percent >= 100 ? 'red' : percent >= 70 ? 'amber' : 'teal';
  const breached = !met && Boolean(dueAt) && new Date(dueAt!).getTime() < nowMs;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-fg">{label}</span>
        <span className="text-[0.6875rem] text-muted">
          {met ? `Met ${formatDate(metAt, 'relative')}` : breached ? `Overdue since ${formatDate(dueAt)}` : `Due ${formatDate(dueAt)}`}
        </span>
      </div>
      <Progress value={percent} tone={tone} size="sm" />
    </div>
  );
}

function TicketMessageRow({ message }: { message: TicketMessage }) {
  const isInternal = message.kind === 'internal_note';
  const isSystem = message.kind === 'system';
  const fromCustomer = message.isFromCustomer;

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 text-[0.6875rem] text-faint">
        <span className="h-px flex-1 bg-border-subtle" aria-hidden />
        <span>{message.body}</span>
        <span className="h-px flex-1 bg-border-subtle" aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border p-3', isInternal ? 'border-warning/30 bg-warning-subtle' : 'border-border-subtle bg-surface')}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-fg">{message.authorName}</span>
        <Badge variant="outline" size="sm">
          {fromCustomer ? 'Customer' : isInternal ? 'Internal note' : 'Agent'}
        </Badge>
        <time className="text-[0.6875rem] text-faint" dateTime={message.createdAt}>
          {formatDate(message.createdAt)}
        </time>
        {message.delivery ? (
          <TonePill tone={message.delivery.state === 'failed' ? 'red' : 'slate'} className="ms-auto text-2xs">
            {message.delivery.state === 'simulated_sent' ? 'Recorded, not sent' : message.delivery.state.replace(/_/g, ' ')}
          </TonePill>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">{message.body}</p>
      {isInternal ? <p className="mt-2 text-[0.6875rem] text-warning-fg">Internal — never shown to the requester.</p> : null}
    </div>
  );
}

function TicketComposer({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const services = useServices();
  const [body, setBody] = React.useState('');
  const [internal, setInternal] = React.useState(false);

  const reply = useMutation(
    (input: { body: string; internal: boolean }) =>
      services.tickets.reply(ticketId, input.body, { isInternalNote: input.internal, timeSpentMinutes: input.internal ? undefined : 5 }),
    {
      simulated: true,
      successMessage: (_, input) => (input.internal ? 'Internal note added.' : 'Reply recorded.'),
      onSuccess: () => {
        setBody('');
        onSent();
      },
    },
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border-subtle bg-inset p-0.5" role="group" aria-label="Message type">
          <button
            type="button"
            onClick={() => setInternal(false)}
            aria-pressed={!internal}
            className={cn('rounded px-2 py-1 text-2xs font-medium', !internal ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg')}
          >
            <MessageSquare className="me-1 inline size-3" aria-hidden />
            Reply
          </button>
          <button
            type="button"
            onClick={() => setInternal(true)}
            aria-pressed={internal}
            className={cn('rounded px-2 py-1 text-2xs font-medium', internal ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg')}
          >
            <Lock className="me-1 inline size-3" aria-hidden />
            Internal note
          </button>
        </div>
      </div>

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        placeholder={internal ? 'Add a note only your team can see…' : 'Write a reply to the requester…'}
        aria-label={internal ? 'Internal note' : 'Reply'}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.6875rem] text-faint">
          {internal ? 'Internal notes are stored on the ticket and never sent.' : 'Replies are recorded in the demo. No email or message is actually transmitted.'}
        </p>
        <Button
          variant="primary"
          size="sm"
          loading={reply.pending}
          disabled={body.trim().length < 2}
          leadingIcon={<Send className="size-3.5" />}
          onClick={() => void reply.run({ body: body.trim(), internal })}
        >
          {internal ? 'Add note' : 'Send reply'}
        </Button>
      </div>
      {reply.error ? <Alert tone="danger" title="The message could not be recorded">{reply.error}</Alert> : null}
    </div>
  );
}

/* Re-exported for the support overview tab other batches may add. */
export { SLA_TONE, SLA_LABEL, CHANNEL_LABEL, elapsedPercent };
