'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Activity, MessageSquare, Mail, Phone, Users, StickyNote } from 'lucide-react';
import type { Tone } from '@crm/ui';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DemoNotice,
  MiniStat,
  Select,
  Timeline,
  cn,
  focusRing,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';

/**
 * Communications.
 *
 * A unified cross-channel timeline of communication events, drawn from two sources:
 * `services.activities` and `services.conversations`. The design priorities are:
 *
 *   - **Honesty about simulation.** Every entry is a synthetic record, no real
 *     email, call or message was ever transmitted. Each timeline item is marked
 *     `simulated: true` and the page-level notice states this plainly.
 *   - **Two sources, one view.** Activities (email/call/meeting/note/demo/visit and
 *     related communication kinds) are merged with conversations, then bucketed by
 *     channel (Email, Call, Meeting, Short message, Note, Other) so the channels
 *     stay comparable.
 *   - **Scoped and deterministic.** The activities list is already scoped to the
 *     active organization by the service layer. Conversations are filtered to the
 *     active organization when the current user is known to keep the timeline
 *     consistent with the tenant context.
 *   - **Accessible filters.** Channel and source filters are presented via a
 *     semantic `Select` with a real label, alongside a search box.
 */

type CommChannelBucket = 'email' | 'call' | 'meeting' | 'message' | 'note' | 'other';

const COMM_ACTIVITY_KINDS = ['email', 'call', 'meeting', 'note', 'sms', 'whatsapp', 'chat', 'social', 'demo', 'visit'];

const ACTIVITY_CHANNEL_MAP: Record<string, CommChannelBucket> = {
  email: 'email',
  call: 'call',
  meeting: 'meeting',
  demo: 'meeting',
  visit: 'meeting',
  note: 'note',
  sms: 'message',
  whatsapp: 'message',
  chat: 'message',
  social: 'message',
};

const CONVERSATION_CHANNEL_MAP: Record<string, CommChannelBucket> = {
  email: 'email',
  phone: 'call',
  sms: 'message',
  whatsapp: 'message',
  live_chat: 'message',
  web_chat: 'message',
  social: 'message',
  internal: 'note',
};

const CHANNEL_LABEL: Record<CommChannelBucket, string> = {
  email: 'Email',
  call: 'Call',
  meeting: 'Meeting',
  message: 'Short message',
  note: 'Note',
  other: 'Other',
};

const CHANNEL_TONE: Record<CommChannelBucket, Tone> = {
  email: 'blue',
  call: 'teal',
  meeting: 'violet',
  message: 'green',
  note: 'slate',
  other: 'neutral',
};

function CommChannelIcon({ channel, className }: { channel: CommChannelBucket; className?: string }) {
  const props = { className: cn('size-3.5', className), 'aria-hidden': true } as const;
  if (channel === 'email') return <Mail {...props} />;
  if (channel === 'call') return <Phone {...props} />;
  if (channel === 'meeting') return <Users {...props} />;
  if (channel === 'message') return <MessageSquare {...props} />;
  if (channel === 'note') return <StickyNote {...props} />;
  return <Activity {...props} />;
}

interface CommEntry {
  id: string;
  source: 'activity' | 'conversation';
  channel: CommChannelBucket;
  title: string;
  preview: string;
  timestamp: string;
  actor: string;
  status: string;
  to: string;
  recordLabel?: string;
  unread?: number;
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function CommunicationsScreen() {
  const services = useServices();
  const currentUser = useAsync(() => services.tenant.currentUser(), []);
  const orgId = currentUser.data?.activeOrganizationId;

  const [search, setSearch] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<'all' | 'activity' | 'conversation'>('all');
  const [channelFilter, setChannelFilter] = React.useState<'all' | CommChannelBucket>('all');

  const activityQuery = React.useMemo(
    () => ({
      page: 1,
      pageSize: 200,
      sort: [{ field: 'createdAt', direction: 'desc' as const }],
      filter: {
        id: 'comms-activities',
        conjunction: 'and' as const,
        clauses: [{ field: 'kind', operator: 'in' as const, value: COMM_ACTIVITY_KINDS }],
      },
    }),
    [],
  );

  const conversationQuery = React.useMemo(
    () => {
      const clauses: Array<{ field: string; operator: string; value?: unknown }> = [];
      if (orgId) {
        clauses.push({ field: 'organizationId', operator: 'eq', value: orgId });
      }
      return {
        page: 1,
        pageSize: 200,
        sort: [{ field: 'lastMessageAt', direction: 'desc' as const }],
        filter: clauses.length > 0 ? { id: 'comms-conversations', conjunction: 'and' as const, clauses } as never : undefined,
      };
    },
    [orgId],
  );

  const activities = useList(() => services.activities.list(activityQuery as never), [JSON.stringify(activityQuery)]);
  const conversations = useList(() => services.conversations.list(conversationQuery), [JSON.stringify(conversationQuery)], { skip: !orgId });

  const isLoading = currentUser.loading || activities.loading || conversations.loading;

  const entries = React.useMemo(() => {
    const list: CommEntry[] = [];
    for (const activity of activities.items) {
      const channel = ACTIVITY_CHANNEL_MAP[activity.kind] ?? 'other';
      const timestamp = activity.completedAt ?? activity.startAt ?? activity.dueAt ?? activity.createdAt;
      const recordLabel =
        activity.subjects.find((subject) => subject.type !== 'deal')?.label ??
        activity.subjects[0]?.label ??
        undefined;

      list.push({
        id: `a-${activity.id}`,
        source: 'activity',
        channel,
        title: activity.subject,
        preview: activity.body ?? '',
        timestamp,
        actor: activity.ownerName,
        status: activity.status,
        to: `/app/activities/${activity.id}`,
        recordLabel,
      });
    }

    for (const conversation of conversations.items) {
      const channel = CONVERSATION_CHANNEL_MAP[conversation.channel] ?? 'other';
      const external = conversation.participants.find((participant) => participant.kind === 'external');
      const actor = conversation.assigneeName ?? 'Unassigned';
      const recordLabel = external?.name ?? conversation.participants[0]?.name ?? undefined;

      list.push({
        id: `c-${conversation.id}`,
        source: 'conversation',
        channel,
        title: conversation.subject,
        preview: conversation.lastMessagePreview,
        timestamp: conversation.lastMessageAt,
        actor,
        status: conversation.status,
        to: `/app/inbox/${conversation.id}`,
        recordLabel,
        unread: conversation.unreadCount,
      });
    }

    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [activities.items, conversations.items]);

  const term = search.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    return entries.filter((entry) => {
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
      if (channelFilter !== 'all' && entry.channel !== channelFilter) return false;
      if (term) {
        const haystack = `${entry.title} ${entry.preview} ${entry.actor} ${entry.recordLabel ?? ''} ${entry.status}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [entries, sourceFilter, channelFilter, term]);

  const groups = React.useMemo(() => {
    const map = new Map<string, CommEntry[]>();
    for (const entry of filtered) {
      const key = entry.timestamp.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [filtered]);

  const metrics = React.useMemo(() => {
    const base = entries;
    const counts = {
      total: base.length,
      email: 0,
      call: 0,
      meeting: 0,
      message: 0,
      note: 0,
      other: 0,
      conversations: base.filter((entry) => entry.source === 'conversation').length,
      unread: base.reduce((sum, entry) => sum + (entry.unread ?? 0), 0),
    };
    for (const entry of base) {
      counts[entry.channel] += 1;
    }
    return counts;
  }, [entries]);

  const channelOptions = React.useMemo(
    () => [
      { value: 'all' as const, label: 'All channels' },
      { value: 'email' as const, label: 'Email' },
      { value: 'call' as const, label: 'Call' },
      { value: 'meeting' as const, label: 'Meeting' },
      { value: 'message' as const, label: 'Short message' },
      { value: 'note' as const, label: 'Note' },
      { value: 'other' as const, label: 'Other' },
    ],
    [],
  );

  const sourceOptions = React.useMemo(
    () => [
      { value: 'all' as const, label: 'All sources' },
      { value: 'activity' as const, label: 'Activities' },
      { value: 'conversation' as const, label: 'Conversations' },
    ],
    [],
  );

  const chips = React.useMemo(() => {
    const result: Array<{ id: string; label: string; tone?: 'brand' | 'warning' | 'neutral'; onRemove?: () => void }> = [];
    if (channelFilter !== 'all') {
      result.push({
        id: 'channel',
        label: `Channel: ${CHANNEL_LABEL[channelFilter]}`,
        tone: 'brand',
        onRemove: () => setChannelFilter('all'),
      });
    }
    if (sourceFilter !== 'all') {
      result.push({
        id: 'source',
        label: `Source: ${sourceFilter === 'activity' ? 'Activities' : 'Conversations'}`,
        tone: 'brand',
        onRemove: () => setSourceFilter('all'),
      });
    }
    if (term) {
      result.push({
        id: 'search',
        label: `Search: ${search.trim().slice(0, 24)}`,
        tone: 'brand',
        onRemove: () => setSearch(''),
      });
    }
    return result;
  }, [channelFilter, sourceFilter, term, search]);

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSourceFilter('all');
    setChannelFilter('all');
  }, []);

  return (
    <div className="pb-8">
      <PageHeader
        title="Communications"
        description="Unified cross-channel timeline of email, calls, meetings, short messages and notes from activities and conversations."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Communications' }]}
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/app/inbox">Inbox</Link>
          </Button>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search communications"
            resultCount={filtered.length ? `${filtered.length.toLocaleString()} entries` : undefined}
            chips={chips}
            onClearFilters={chips.length > 0 ? clearFilters : undefined}
            actions={
              <>
                <Select
                  value={channelFilter === 'all' ? 'all' : channelFilter}
                  onValueChange={(value) => {
                    if (value === 'all') setChannelFilter('all');
                    else setChannelFilter(value as CommChannelBucket);
                  }}
                  options={channelOptions}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Filter by channel"
                />
                <Select
                  value={sourceFilter}
                  onValueChange={(value) => setSourceFilter(value as 'all' | 'activity' | 'conversation')}
                  options={sourceOptions}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Filter by source"
                />
              </>
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <MiniStat label="Total entries" value={formatNumber(metrics.total)} tone="violet" />
          <MiniStat label="Emails" value={formatNumber(metrics.email)} tone="blue" />
          <MiniStat label="Calls" value={formatNumber(metrics.call)} tone="teal" />
          <MiniStat label="Meetings" value={formatNumber(metrics.meeting)} tone="violet" />
          <MiniStat label="Messages" value={formatNumber(metrics.message)} tone="green" />
          <MiniStat label="Notes" value={formatNumber(metrics.note)} tone="slate" />
        </div>

        <DemoNotice tone="warning">
          Every entry below is a synthetic record from the seeded demo dataset. No email, call, meeting
          or short message was ever transmitted or received.
        </DemoNotice>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4">
            {isLoading ? (
              <ListSkeleton rows={8} columns={4} />
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <p className="text-sm font-medium text-fg">No communications match these filters</p>
                  <p className="mt-1 text-xs text-muted">
                    Clear the filters or adjust the search to see entries.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => {
                  const first = group.items[0];
                  if (!first) return null;
                  const dateLabel = formatDate(first.timestamp, 'long');
                  const timelineItems = group.items.map((entry) => ({
                    id: entry.id,
                    kind: entry.channel,
                    title: entry.title,
                    description: (
                      <div className="space-y-1">
                        <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                          {entry.preview || 'No preview available.'}
                        </p>
                        <p className="text-[0.6875rem] text-faint">
                          {CHANNEL_LABEL[entry.channel]} · {entry.actor} · {entry.recordLabel ?? 'No linked record'}
                        </p>
                        <p className="text-[0.6875rem] text-faint">
                          Synthetic communication record — nothing was sent or received.
                        </p>
                      </div>
                    ),
                    timestamp: entry.timestamp,
                    timeLabel: timeOf(entry.timestamp),
                    icon: <CommChannelIcon channel={entry.channel} />,
                    simulated: true,
                    actions: (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" size="sm">
                          {entry.status}
                        </Badge>
                        {entry.unread ? (
                          <Badge variant="brand" size="sm">
                            {entry.unread} unread
                          </Badge>
                        ) : null}
                        <Button asChild variant="ghost" size="xs">
                          <Link to={entry.to}>
                            Open {entry.source === 'conversation' ? 'conversation' : 'activity'}
                          </Link>
                        </Button>
                      </div>
                    ),
                  }));
                  return (
                    <section key={group.key} className="space-y-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                        {dateLabel}
                      </h2>
                      <Timeline items={timelineItems} />
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Channels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {channelOptions.slice(1).map((option) => {
                  const count = metrics[option.value as CommChannelBucket] ?? 0;
                  const isActive = channelFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setChannelFilter(isActive ? 'all' : (option.value as CommChannelBucket))}
                      aria-pressed={isActive}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-start text-xs',
                        isActive ? 'border-brand bg-brand-subtle/60' : 'border-border-subtle bg-surface hover:bg-hover',
                        focusRing,
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CommChannelIcon channel={option.value as CommChannelBucket} />
                        <span className="truncate">{CHANNEL_LABEL[option.value as CommChannelBucket]}</span>
                      </span>
                      <span className="tabular-nums text-muted">{formatNumber(count)}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About this view</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-relaxed text-muted">
                <p>
                  Entries combine activities (email, call, meeting, note, demo, visit, chat, sms, whatsapp,
                  social) with conversations from the inbox. Each row is a synthetic communication record.
                </p>
                <p>
                  Nothing shown here was sent, received, or connected to a real email, dialler, or messaging
                  provider. The timeline only reflects seeded demo data.
                </p>
                <p>
                  Use the channel and source filters to focus on a specific communication stream.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CommunicationsScreen, CommChannelIcon, CHANNEL_LABEL, CHANNEL_TONE, ACTIVITY_CHANNEL_MAP as COMM_ACTIVITY_CHANNEL_MAP, CONVERSATION_CHANNEL_MAP as COMM_CONVERSATION_CHANNEL_MAP };
