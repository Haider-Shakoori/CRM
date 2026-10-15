'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Clock,
  Globe,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Conversation, MessageBase } from '@crm/shared-types';
import type { Tone } from '@crm/ui';
import {
  Alert,
  Avatar,
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
  Select,
  StatusBadge,
  Textarea,
  TonePill,
  cn,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Omnichannel inbox.
 *
 * Every channel here is simulated, and the interface keeps saying so: the composer records
 * replies locally, the delivery chip reads "Recorded, not sent", and the demo summary is
 * labelled with the template engine that produced it. Consolidating channels is honest only
 * if the same screen is equally clear that none of them are connected.
 */

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  live_chat: 'Live chat',
  web_chat: 'Web chat',
  social: 'Social',
  phone: 'Phone',
  internal: 'Internal',
};

const CHANNEL_TONE: Record<string, Tone> = {
  email: 'blue',
  sms: 'teal',
  whatsapp: 'green',
  live_chat: 'violet',
  web_chat: 'violet',
  social: 'amber',
  phone: 'slate',
  internal: 'neutral',
};

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const props = { className: cn('size-3.5', className), 'aria-hidden': true } as const;
  if (channel === 'email') return <Mail {...props} />;
  if (channel === 'phone') return <Phone {...props} />;
  if (channel === 'sms' || channel === 'whatsapp') return <MessageSquare {...props} />;
  if (channel === 'social') return <Globe {...props} />;
  return <MessageCircle {...props} />;
}

/* ---------------------------------------------------------------------- list */

export default function InboxList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [inboxFilter, setInboxFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('open');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [starredOnly, setStarredOnly] = React.useState(false);

  const inboxes = useList(() => services.conversations.inboxes(), []);
  const all = useList(() => services.conversations.list({ pageSize: 200 }), []);

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 40,
      q: search || undefined,
      inboxId: inboxFilter === 'all' ? undefined : inboxFilter,
      statuses: statusFilter === 'all' ? undefined : [statusFilter],
      unreadOnly: unreadOnly || undefined,
      starredOnly: starredOnly || undefined,
      sort: [{ field: 'lastMessageAt', direction: 'desc' as const }],
    }),
    [page, search, inboxFilter, statusFilter, unreadOnly, starredOnly],
  );

  const conversations = useList(() => services.conversations.list(query), [JSON.stringify(query)]);

  const metrics = React.useMemo(() => {
    const items = all.items;
    return {
      open: items.filter((item) => item.status === 'open' || item.status === 'pending').length,
      unread: items.reduce((sum, item) => sum + item.unreadCount, 0),
      awaiting: items.filter((item) => item.status === 'open' && !item.firstRespondedAt).length,
      snoozed: items.filter((item) => item.status === 'snoozed').length,
      starred: items.filter((item) => item.isStarred).length,
    };
  }, [all.items]);

  const columns = React.useMemo<ColumnDef<Conversation, unknown>[]>(
    () => [
      {
        id: 'subject',
        header: 'Conversation',
        accessorKey: 'subject',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-start gap-2">
            {row.original.isStarred ? <Star className="mt-0.5 size-3.5 shrink-0 fill-current text-warning" aria-label="Starred" /> : null}
            <div className="min-w-0">
              <Link to={`/app/inbox/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                {row.original.subject}
              </Link>
              <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.lastMessagePreview}</span>
            </div>
            {row.original.unreadCount > 0 ? (
              <Badge variant="brand" size="sm" className="ms-auto shrink-0">
                {row.original.unreadCount}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: 'channel',
        header: 'Channel',
        accessorKey: 'channel',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-muted">
            <ChannelIcon channel={row.original.channel} />
            {CHANNEL_LABEL[row.original.channel] ?? row.original.channel}
          </span>
        ),
      },
      {
        id: 'participants',
        header: 'Contact',
        accessorFn: (conversation) => conversation.participants[0]?.name ?? '',
        cell: ({ row }) => {
          const external = row.original.participants.find((participant) => participant.kind === 'external');
          return <span className="block truncate text-xs text-muted">{external?.name ?? 'Unknown'}</span>;
        },
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: 'priority', header: 'Priority', accessorKey: 'priority', cell: ({ row }) => <StatusBadge status={row.original.priority} size="sm" /> },
      {
        id: 'assignee',
        header: 'Assignee',
        accessorKey: 'assigneeName',
        cell: ({ row }) =>
          row.original.assigneeName ? <span className="text-xs text-muted">{row.original.assigneeName}</span> : <span className="text-xs italic text-faint">Unassigned</span>,
      },
      { id: 'lastMessage', header: 'Last message', accessorKey: 'lastMessageAt', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.lastMessageAt, 'relative')}</span> },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Omnichannel inbox"
        description="Email, SMS, WhatsApp and chat conversations in one queue. Every channel is simulated — nothing is connected."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Inbox' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search conversations"
            resultCount={conversations.meta ? `${conversations.meta.total.toLocaleString()} conversations` : undefined}
            chips={[
              ...(inboxFilter !== 'all' ? [{ id: 'inbox', label: `Inbox: ${inboxes.items.find((inbox) => inbox.id === inboxFilter)?.name ?? ''}`, tone: 'brand' as const, onRemove: () => setInboxFilter('all') }] : []),
              ...(unreadOnly ? [{ id: 'unread', label: 'Unread only', tone: 'brand' as const, onRemove: () => setUnreadOnly(false) }] : []),
              ...(starredOnly ? [{ id: 'starred', label: 'Starred only', tone: 'brand' as const, onRemove: () => setStarredOnly(false) }] : []),
            ]}
            onClearFilters={() => {
              setInboxFilter('all');
              setStatusFilter('open');
              setUnreadOnly(false);
              setStarredOnly(false);
              setSearch('');
            }}
            actions={
              <>
                <Select
                  value={inboxFilter}
                  onValueChange={(value) => {
                    setInboxFilter(value);
                    setPage(1);
                  }}
                  options={[{ value: 'all', label: 'All inboxes' }, ...inboxes.items.map((inbox) => ({ value: inbox.id, label: inbox.name }))]}
                  selectSize="sm"
                  className="w-[12rem]"
                  aria-label="Filter by inbox"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  options={[{ value: 'all', label: 'All statuses' }, ...['open', 'pending', 'snoozed', 'resolved', 'closed', 'spam'].map((value) => ({ value, label: value }))]}
                  selectSize="sm"
                  className="w-[10rem]"
                  aria-label="Filter by status"
                />
                <Button variant={unreadOnly ? 'primary' : 'ghost'} size="sm" onClick={() => setUnreadOnly((value) => !value)}>
                  Unread
                </Button>
                <Button variant={starredOnly ? 'primary' : 'ghost'} size="sm" onClick={() => setStarredOnly((value) => !value)}>
                  Starred
                </Button>
              </>
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Open" value={formatNumber(metrics.open)} tone="blue" />
          <MiniStat label="Unread" value={formatNumber(metrics.unread)} tone="violet" />
          <MiniStat label="Awaiting reply" value={formatNumber(metrics.awaiting)} tone="amber" />
          <MiniStat label="Snoozed" value={formatNumber(metrics.snoozed)} tone="slate" />
          <MiniStat label="Starred" value={formatNumber(metrics.starred)} tone="teal" />
        </div>

        <DemoNotice tone="warning">
          The unified inbox is a front-end demonstration. No email, SMS, WhatsApp, chat or social channel is connected, and nothing sent from here leaves the browser.
        </DemoNotice>

        {conversations.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={conversations.items}
            onRowClick={(conversation) => navigate(`/app/inbox/${conversation.id}`)}
            getRowId={(conversation) => conversation.id}
            emptyState={
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-fg">Nothing in this queue</p>
                <p className="mt-1 text-xs text-muted">Try a different inbox or clear the unread and starred filters.</p>
              </div>
            }
            footer={conversations.meta ? <Pagination page={conversations.meta.page} pageSize={conversations.meta.pageSize} total={conversations.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function ConversationDetail() {
  const services = useServices();
  const { conversationId } = useParams<{ conversationId: string }>();
  const id = conversationId ?? '';

  const conversation = useAsync(() => services.conversations.get(id), [id], { skip: !id });
  const messages = useList(() => services.conversations.messages(id), [id], { skip: !id });
  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const [draft, setDraft] = React.useState('');
  const [internal, setInternal] = React.useState(false);
  const [summary, setSummary] = React.useState<{ summary: string; suggestedReplies: string[] } | null>(null);
  const [snoozeOpen, setSnoozeOpen] = React.useState(false);
  const [snoozeChoice, setSnoozeChoice] = React.useState('tomorrow');

  const reload = React.useCallback(() => {
    conversation.reload();
    messages.reload();
  }, [conversation, messages]);

  const reply = useMutation(
    (input: { body: string; internal: boolean }) => services.conversations.reply(id, input.body, { isInternalNote: input.internal }),
    {
      simulated: true,
      successMessage: (_, input) => (input.internal ? 'Internal note added.' : 'Reply recorded.'),
      onSuccess: () => {
        setDraft('');
        reload();
      },
    },
  );
  const setStatus = useMutation((status: Conversation['status']) => services.conversations.updateStatus([id], status), {
    successMessage: 'Status updated.',
    onSuccess: () => reload(),
  });
  const assign = useMutation((assigneeId: string | null) => services.conversations.assign([id], assigneeId), {
    successMessage: 'Assignee updated.',
    onSuccess: () => reload(),
  });
  const star = useMutation((starred: boolean) => services.conversations.star(id, starred), { onSuccess: () => reload() });
  const summarise = useMutation(() => services.conversations.summarise(id), {
    simulated: true,
    successMessage: 'Summary generated from the thread.',
    onSuccess: (data) => setSummary({ summary: data.summary, suggestedReplies: data.suggestedReplies }),
  });
  const snooze = useMutation((until: string) => services.conversations.snooze([id], until), {
    successMessage: 'Conversation snoozed.',
    onSuccess: () => {
      setSnoozeOpen(false);
      reload();
    },
  });

  const record = conversation.data;

  if (conversation.loading) return <ListSkeleton rows={12} columns={2} />;
  if (conversation.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This conversation could not be found</h2>
            <p className="text-xs text-muted">{conversation.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/inbox">Back to the inbox</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const external = record.participants.find((participant) => participant.kind === 'external');
  const snoozeUntil = () => {
    const days = snoozeChoice === 'tomorrow' ? 1 : snoozeChoice === 'three_days' ? 3 : 7;
    return new Date(Date.now() + days * 86_400_000).toISOString();
  };

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/inbox', label: 'Inbox' }}
          title={record.subject}
          subtitle={`${external?.name ?? 'Unknown contact'} · ${record.inboxName}`}
          badges={
            <>
              <TonePill tone={CHANNEL_TONE[record.channel] ?? 'neutral'}>
                <ChannelIcon channel={record.channel} />
                {CHANNEL_LABEL[record.channel] ?? record.channel}
              </TonePill>
              <StatusBadge status={record.status} />
              <StatusBadge status={record.priority} />
            </>
          }
          favourite={{ active: record.isStarred, onToggle: () => void star.run(!record.isStarred) }}
          facts={[
            { label: 'Inbox', value: record.inboxName },
            { label: 'Assignee', value: record.assigneeName ?? 'Unassigned' },
            { label: 'Messages', value: formatNumber(record.messageCount) },
            { label: 'First response', value: record.firstRespondedAt ? formatDate(record.firstRespondedAt, 'relative') : 'Not yet' },
            { label: 'Last activity', value: formatDate(record.lastMessageAt, 'relative') },
          ]}
          actions={
            <>
              <Button variant="secondary" size="sm" loading={summarise.pending} leadingIcon={<Sparkles className="size-3.5" />} onClick={() => void summarise.run(undefined)}>
                Summarise
              </Button>
              {record.status !== 'resolved' && record.status !== 'closed' ? (
                <Button variant="ghost" size="sm" onClick={() => void setStatus.run('resolved')} leadingIcon={<Lock className="size-3.5" />}>
                  Resolve
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => void setStatus.run('open')}>
                  Reopen
                </Button>
              )}
            </>
          }
        />
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Thread</CardTitle>
            <span className="text-2xs text-faint">{messages.meta?.total ?? 0} messages</span>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {messages.loading ? (
              <ListSkeleton rows={5} columns={2} />
            ) : (
              messages.items.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
          </CardContent>

          <div className="space-y-2 border-t border-border-subtle p-4 sm:p-5">
            <div className="inline-flex rounded-md border border-border-subtle bg-inset p-0.5" role="group" aria-label="Message type">
              <button
                type="button"
                onClick={() => setInternal(false)}
                aria-pressed={!internal}
                className={cn('rounded px-2 py-1 text-2xs font-medium', !internal ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg')}
              >
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
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder={internal ? 'Add a note only your team can see…' : `Reply on ${CHANNEL_LABEL[record.channel] ?? record.channel}…`}
              aria-label={internal ? 'Internal note' : 'Reply'}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.6875rem] text-faint">{internal ? 'Internal notes are never sent.' : 'Recorded locally. No message is transmitted.'}</p>
              <Button
                variant="primary"
                size="sm"
                loading={reply.pending}
                disabled={draft.trim().length < 2}
                leadingIcon={<Send className="size-3.5" />}
                onClick={() => void reply.run({ body: draft.trim(), internal })}
              >
                {internal ? 'Add note' : 'Send'}
              </Button>
            </div>
            {reply.error ? <Alert tone="danger" title="The message could not be recorded">{reply.error}</Alert> : null}
          </div>
        </Card>

        <div className="space-y-5">
          {summary ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <Sparkles className="size-3.5 text-subtle" aria-hidden />
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-relaxed text-muted">{summary.summary}</p>
                <div className="space-y-1.5">
                  <p className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Suggested replies</p>
                  {summary.suggestedReplies.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setDraft(suggestion);
                        setInternal(false);
                      }}
                      className="block w-full rounded-md border border-border-subtle p-2 text-start text-[0.6875rem] text-muted hover:border-border-strong hover:bg-hover"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <DemoNotice tone="neutral">Produced by a template engine from the thread text. No model was called.</DemoNotice>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Status" htmlFor="conv-status">
                <Select
                  id="conv-status"
                  value={record.status}
                  onValueChange={(value) => void setStatus.run(value as Conversation['status'])}
                  options={['open', 'pending', 'snoozed', 'resolved', 'closed', 'spam'].map((value) => ({ value, label: value }))}
                  selectSize="sm"
                />
              </Field>
              <Field label="Assignee" htmlFor="conv-assignee">
                <Select
                  id="conv-assignee"
                  value={record.assigneeId ?? ''}
                  onValueChange={(value) => void assign.run(value === '' ? null : value)}
                  options={[{ value: '', label: 'Unassigned' }, ...users.items.map((user) => ({ value: user.id, label: user.displayName }))]}
                  selectSize="sm"
                  searchable
                />
              </Field>
              <Button variant="ghost" size="sm" className="w-full justify-start" leadingIcon={<Clock className="size-3.5" />} onClick={() => setSnoozeOpen(true)}>
                Snooze conversation
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Users className="size-3.5 text-subtle" aria-hidden />
              <CardTitle>Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {record.participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-2">
                  <Avatar name={participant.name} size="sm" tone={participant.kind === 'external' ? 'blue' : 'violet'} />
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-fg">{participant.name}</span>
                    <span className="block truncate text-[0.6875rem] text-faint">{participant.handle}</span>
                  </div>
                  <Badge variant="outline" size="sm" className="ms-auto">
                    {participant.kind === 'external' ? 'Customer' : 'Team'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {record.relatedRecords.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Linked records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {record.relatedRecords.map((related) => (
                  <span key={`${related.type}-${related.id}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted">{related.label}</span>
                    <Badge variant="outline" size="sm">
                      {related.type}
                    </Badge>
                  </span>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <DemoNotice tone="warning">
            Conversations are seeded sample data. No mailbox, phone number, WhatsApp Business account or chat widget is connected to this build.
          </DemoNotice>
        </div>
      </div>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent
          title="Snooze this conversation"
          description="Snoozing sets the status to snoozed and records when it should reappear. No scheduler runs."
          size="sm"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setSnoozeOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={snooze.pending} onClick={() => void snooze.run(snoozeUntil())}>
                Snooze
              </Button>
            </>
          }
        >
          <Field label="Wake up" htmlFor="snooze-choice">
            <Select
              id="snooze-choice"
              value={snoozeChoice}
              onValueChange={setSnoozeChoice}
              options={[
                { value: 'tomorrow', label: 'Tomorrow' },
                { value: 'three_days', label: 'In three days' },
                { value: 'next_week', label: 'Next week' },
              ]}
              selectSize="sm"
            />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function MessageBubble({ message }: { message: MessageBase }) {
  const isInternal = message.direction === 'internal_note' || message.isInternalOnly;
  const isInbound = message.direction === 'inbound';

  return (
    <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div className={cn('max-w-[85%] rounded-lg border p-3', isInternal ? 'border-warning/30 bg-warning-subtle' : isInbound ? 'border-border-subtle bg-inset' : 'border-brand/30 bg-brand-subtle')}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-fg">{message.authorName}</span>
          <span className="text-[0.6875rem] text-faint">{formatDate(message.createdAt)}</span>
          {isInternal ? null : (
            <TonePill tone={message.delivery.state === 'failed' ? 'red' : 'slate'} className="ms-auto text-2xs">
              {message.delivery.state === 'simulated_sent' ? 'Recorded, not sent' : message.delivery.state.replace(/_/g, ' ')}
            </TonePill>
          )}
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">{message.body}</p>
        {isInternal ? <p className="mt-1.5 text-[0.6875rem] text-warning-fg">Internal — never sent to the customer.</p> : null}
      </div>
    </div>
  );
}

export { ChannelIcon, CHANNEL_LABEL };
