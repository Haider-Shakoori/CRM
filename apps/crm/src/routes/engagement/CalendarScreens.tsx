'use client';

import * as React from 'react';
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import type { CalendarEvent } from '@crm/shared-types';
import type { Tone } from '@crm/ui';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DemoNotice,
  Dialog,
  DialogContent,
  IconButton,
  MiniStat,
  Select,
  Switch,
  TonePill,
  cn,
  focusRing,
  toneClass,
} from '@crm/ui';
import { ListSkeleton, PageHeader, ViewSwitcher, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Calendar.
 *
 * Day, week and month views over the seeded meetings, demos and visits that live in the
 * `calendarEvents` collection. Three things are deliberate:
 *
 *   - **The range is queried, not filtered in the browser.** The visible window becomes the
 *     `from`/`to` arguments to `services.calendar.events`, so the screen obeys the same
 *     contract the future API will.
 *   - **Suggestions are suggestions.** `services.calendar.suggestSlots` returns a fixed,
 *     deterministic set of slots computed locally. The panel says so on every row and never
 *     presents a slot as confirmed availability; recording one only rewrites the local event.
 *   - **Calendars are not connected.** The seeded events carry no calendar provider link, so
 *     the sidebar groups them into "My calendar" and "Team calendar" by organiser and states
 *     that this is a demonstration grouping.
 */

type CalendarView = 'day' | 'week' | 'month';

const EVENT_LABEL: Record<string, string> = {
  meeting: 'Meeting',
  call: 'Call',
  demo: 'Demo',
  visit: 'Visit',
};

const EVENT_TONE: Record<string, Tone> = {
  meeting: 'violet',
  call: 'teal',
  demo: 'amber',
  visit: 'green',
};

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ------------------------------------------------------------------- dates */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/** ISO weeks start on Monday; JavaScript's `getDay` starts on Sunday. */
function startOfWeek(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -offset);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function keyOfEvent(event: CalendarEvent): string {
  return event.startAt ? dayKey(new Date(event.startAt)) : '';
}

function timeOf(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** The window each view shows, plus the individual days to render in the grid. */
function windowFor(view: CalendarView, anchor: Date): { from: Date; to: Date; days: Date[] } {
  if (view === 'day') {
    const day = startOfDay(anchor);
    return { from: day, to: addDays(day, 1), days: [day] };
  }
  if (view === 'week') {
    const start = startOfWeek(anchor);
    return { from: start, to: addDays(start, 7), days: Array.from({ length: 7 }, (_, index) => addDays(start, index)) };
  }
  const gridStart = startOfWeek(startOfMonth(anchor));
  return { from: gridStart, to: addDays(gridStart, 42), days: Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)) };
}

/* ----------------------------------------------------------------- chunks */

function EventChip({ event, onSelect, withTime }: { event: CalendarEvent; onSelect: (event: CalendarEvent) => void; withTime?: boolean }) {
  const tone = EVENT_TONE[event.kind] ?? 'slate';
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        'flex w-full items-start gap-1.5 rounded-md border px-1.5 py-1 text-start text-[0.6875rem] leading-tight',
        toneClass(tone, 'border'),
        toneClass(tone, 'bg'),
        'hover:border-border-strong hover:brightness-[0.99]',
        focusRing,
      )}
    >
      <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', toneClass(tone, 'dot'))} aria-hidden />
      <span className="min-w-0 flex-1">
        {withTime ? <span className="block truncate font-medium tabular-nums text-muted">{timeOf(event.startAt)}</span> : null}
        <span className="block truncate font-medium text-fg">{event.subject}</span>
        {withTime && event.location ? <span className="block truncate text-faint">{event.location}</span> : null}
      </span>
    </button>
  );
}

function MonthGrid({
  days,
  anchor,
  today,
  byDay,
  onSelect,
  onShowDay,
}: {
  days: Date[];
  anchor: Date;
  today: Date;
  byDay: Map<string, CalendarEvent[]>;
  onSelect: (event: CalendarEvent) => void;
  onShowDay: (day: Date) => void;
}) {
  const todayKey = dayKey(today);
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
      <div className="grid grid-cols-7 border-b border-border-subtle bg-inset">
        {WEEKDAYS_SHORT.map((name) => (
          <div key={name} className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day);
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          return (
            <div key={key} className={cn('min-h-[7.5rem] border-e border-b border-border-subtle p-1.5 last:border-e-0', !inMonth && 'bg-neutral-subtle')}>
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className={cn('text-2xs tabular-nums', isToday ? 'font-semibold text-brand-fg' : inMonth ? 'text-muted' : 'text-faint')}>{day.getDate()}</span>
                {isToday ? (
                  <Badge variant="brand" size="sm">
                    Today
                  </Badge>
                ) : null}
              </div>
              <ul className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <li key={event.id}>
                    <EventChip event={event} onSelect={onSelect} />
                  </li>
                ))}
                {dayEvents.length > 3 ? (
                  <li>
                    <button type="button" onClick={() => onShowDay(day)} className={cn('w-full rounded px-1 py-0.5 text-start text-[0.6875rem] text-link hover:underline', focusRing)}>
                      +{dayEvents.length - 3} more
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  today,
  byDay,
  onSelect,
  onShowDay,
}: {
  days: Date[];
  today: Date;
  byDay: Map<string, CalendarEvent[]>;
  onSelect: (event: CalendarEvent) => void;
  onShowDay: (day: Date) => void;
}) {
  const todayKey = dayKey(today);
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const key = dayKey(day);
        const dayEvents = byDay.get(key) ?? [];
        const isToday = key === todayKey;
        return (
          <div key={key} className={cn('flex min-h-[10rem] flex-col rounded-lg border p-2', isToday ? 'border-brand/40 bg-brand-subtle' : 'border-border-subtle bg-surface')}>
            <div className="mb-2 flex items-baseline justify-between gap-1">
              <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">{WEEKDAYS_SHORT[(day.getDay() + 6) % 7]}</span>
              <span className={cn('text-xs tabular-nums', isToday ? 'font-semibold text-brand-fg' : 'text-muted')}>{day.getDate()}</span>
            </div>
            {dayEvents.length === 0 ? (
              <button type="button" onClick={() => onShowDay(day)} className={cn('text-start text-[0.6875rem] italic text-faint hover:text-muted', focusRing)}>
                No events
              </button>
            ) : (
              <ul className="space-y-1.5">
                {dayEvents.map((event) => (
                  <li key={event.id}>
                    <EventChip event={event} onSelect={onSelect} withTime />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayAgenda({ day, events, onSelect }: { day: Date; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  const sorted = [...events].sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{formatDate(day.toISOString(), 'long')}</CardTitle>
        <span className="text-2xs text-faint">
          {sorted.length} event{sorted.length === 1 ? '' : 's'}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">Nothing is scheduled on this day.</p>
        ) : (
          sorted.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event)}
              className={cn('flex w-full items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3 text-start hover:border-border-strong hover:bg-hover', focusRing)}
            >
              <span className="w-14 shrink-0 text-xs font-medium tabular-nums text-muted">{timeOf(event.startAt)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{event.subject}</span>
                <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                  {EVENT_LABEL[event.kind] ?? event.kind} · {event.durationMinutes ?? 30} min
                  {event.location ? ` · ${event.location}` : ''}
                </span>
              </span>
              <TonePill tone={EVENT_TONE[event.kind] ?? 'slate'}>{EVENT_LABEL[event.kind] ?? event.kind}</TonePill>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- event dialog */

type SuggestedSlot = { startAt: string; endAt: string; conflicts: number };

function EventDialog({
  event,
  rangeFrom,
  rangeTo,
  onChanged,
  onClose,
}: {
  event: CalendarEvent;
  rangeFrom: string;
  rangeTo: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const services = useServices();
  const brief = useAsync(() => services.calendar.preparationBrief(event.id), [event.id]);
  const [duration, setDuration] = React.useState(String(event.durationMinutes ?? 30));
  const [generated, setGenerated] = React.useState<SuggestedSlot[] | null>(null);

  const suggest = useMutation(
    (minutes: number) => services.calendar.suggestSlots((event.attendees ?? []).map((attendee) => attendee.id), minutes, { from: rangeFrom, to: rangeTo }),
    {
      simulated: true,
      successMessage: 'Suggested times generated by the demo helper.',
      onSuccess: (data) => setGenerated(data ?? []),
    },
  );
  const reschedule = useMutation(
    (slot: SuggestedSlot) => services.calendar.reschedule(event.id, slot.startAt, slot.endAt),
    {
      simulated: true,
      successMessage: 'New time recorded in this browser only.',
      onSuccess: () => onChanged(),
    },
  );

  return (
    <DialogContent
      title={event.subject}
      description={`${EVENT_LABEL[event.kind] ?? event.kind} · ${formatDate(event.startAt)} ${timeOf(event.startAt)}`}
      size="lg"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <dl className="space-y-2.5 rounded-lg border border-border-subtle bg-inset p-3 text-xs">
            <FactRow label="Starts" value={`${formatDate(event.startAt)} ${timeOf(event.startAt)}`} icon={<CalendarClock className="size-3.5 text-subtle" aria-hidden />} />
            <FactRow label="Duration" value={`${event.durationMinutes ?? 30} min`} icon={<Clock className="size-3.5 text-subtle" aria-hidden />} />
            <FactRow label="Organiser" value={event.ownerName} />
            <FactRow label="Show as" value={event.showAs.replace(/_/g, ' ')} />
            <FactRow label="Timezone" value={event.timezone} />
          </dl>
          <div className="space-y-2.5">
            {event.location ? (
              <p className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface p-3 text-xs text-muted">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
                {event.location}
              </p>
            ) : null}
            {event.conferencing ? (
              <div className="rounded-lg border border-border-subtle bg-surface p-3 text-xs text-muted">
                <p className="flex items-center gap-2 font-medium text-fg">
                  <Video className="size-3.5 text-subtle" aria-hidden />
                  {event.conferencing.provider}
                </p>
                <p className="mt-1 break-all font-mono text-[0.6875rem] text-faint">{event.conferencing.joinUrlPlaceholder}</p>
                <p className="mt-1 text-[0.6875rem] text-faint">Placeholder link — the conference is never joined.</p>
              </div>
            ) : null}
            {event.attendees && event.attendees.length > 0 ? (
              <div className="rounded-lg border border-border-subtle bg-surface p-3">
                <p className="flex items-center gap-2 text-xs font-medium text-fg">
                  <Users className="size-3.5 text-subtle" aria-hidden />
                  Attendees
                </p>
                <ul className="mt-2 space-y-1.5">
                  {event.attendees.map((attendee) => (
                    <li key={attendee.id} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                      <span className="min-w-0 truncate text-muted">{attendee.name}</span>
                      <Badge variant="outline" size="sm">
                        {attendee.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Sparkles className="size-3.5 text-subtle" aria-hidden />
            <CardTitle>Preparation brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {brief.loading ? (
              <ListSkeleton rows={4} columns={2} />
            ) : brief.error || !brief.data ? (
              <p className="text-xs text-muted">{brief.error ?? 'No brief is available for this event.'}</p>
            ) : (
              <>
                <DemoNotice tone="neutral">Composed by the demo template engine from the seeded account, deals and tickets. No model was called.</DemoNotice>
                <BriefSection title="Agenda" items={brief.data.agenda} />
                {brief.data.talkingPoints.length > 0 ? <BriefSection title="Talking points" items={brief.data.talkingPoints} /> : null}
                {brief.data.openIssues.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-faint">Open issues</p>
                    <ul className="space-y-1.5">
                      {brief.data.openIssues.map((issue) => (
                        <li key={issue.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-muted">{issue.label}</span>
                          <Badge variant={issue.severity === 'high' ? 'danger' : 'warning'} size="sm">
                            {issue.severity}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {brief.data.risks.length > 0 ? <BriefSection title="Risks" items={brief.data.risks} /> : null}
                {brief.data.suggestedQuestions.length > 0 ? <BriefSection title="Suggested questions" items={brief.data.suggestedQuestions} /> : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Find another time</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={duration}
                onValueChange={setDuration}
                options={['15', '30', '45', '60', '90'].map((value) => ({ value, label: `${value} min` }))}
                selectSize="sm"
                className="w-[7rem]"
                aria-label="Meeting duration"
              />
              <Button variant="secondary" size="sm" leadingIcon={<Sparkles className="size-3.5" />} loading={suggest.pending} onClick={() => void suggest.run(Number(duration))}>
                Suggest times
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <DemoNotice tone="neutral">
              Suggestions are computed locally from a deterministic demo helper. They are <strong>not</strong> real availability and no attendee calendar is read.
            </DemoNotice>
            {generated === null ? (
              <p className="text-xs text-muted">Choose a duration and generate a few candidate times.</p>
            ) : generated.length === 0 ? (
              <p className="text-xs text-muted">No candidate times were produced for this window.</p>
            ) : (
              <ul className="space-y-1.5">
                {generated.map((slot) => (
                  <li key={slot.startAt} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface p-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-fg">
                        {formatDate(slot.startAt)} · {timeOf(slot.startAt)}–{timeOf(slot.endAt)}
                      </p>
                      <p className="text-[0.6875rem] text-faint">
                        {slot.conflicts === 0 ? 'No seeded conflicts' : `${slot.conflicts} seeded conflict${slot.conflicts === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={reschedule.pending}
                      onClick={() => void reschedule.run(slot)}
                    >
                      Use this time
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {reschedule.error ? <Alert tone="danger" title="The time could not be recorded">{reschedule.error}</Alert> : null}
          </CardContent>
        </Card>
      </div>
    </DialogContent>
  );
}

function BriefSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wide text-faint">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2 text-xs leading-relaxed text-muted">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FactRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
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

/* ------------------------------------------------------------------- screen */

export default function CalendarScreen() {
  const services = useServices();
  const [view, setView] = React.useState<CalendarView>('month');
  const [anchor, setAnchor] = React.useState<Date>(() => new Date());
  const [showMine, setShowMine] = React.useState(true);
  const [showTeam, setShowTeam] = React.useState(true);
  const [selected, setSelected] = React.useState<CalendarEvent | null>(null);

  const range = React.useMemo(() => windowFor(view, anchor), [view, anchor]);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const events = useList(
    () => services.calendar.events({ from: fromIso, to: toIso, pageSize: 200, sort: [{ field: 'startAt', direction: 'asc' }] }),
    [fromIso, toIso],
  );
  const calendars = useList(() => services.calendar.calendars(), []);
  const currentUser = useAsync(() => services.tenant.currentUser(), []);

  const currentUserId = currentUser.data?.id;
  const isMine = React.useCallback(
    (event: CalendarEvent) => Boolean(currentUserId) && (event.organizerId === currentUserId || event.ownerId === currentUserId),
    [currentUserId],
  );

  const visibleEvents = React.useMemo(
    () => events.items.filter((event) => (isMine(event) ? showMine : showTeam)),
    [events.items, isMine, showMine, showTeam],
  );

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) {
      const key = keyOfEvent(event);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [visibleEvents]);

  const metrics = React.useMemo(() => {
    const items = events.items;
    const minutes = items.reduce((sum, event) => sum + (event.durationMinutes ?? 0), 0);
    return {
      inView: visibleEvents.length,
      meetings: items.filter((event) => event.kind === 'meeting').length,
      demos: items.filter((event) => event.kind === 'demo').length,
      visits: items.filter((event) => event.kind === 'visit').length,
      hours: minutes / 60,
    };
  }, [events.items, visibleEvents]);

  const [today] = React.useState(() => new Date());
  const firstDay = range.days[0] ?? anchor;
  const lastDay = range.days[range.days.length - 1] ?? anchor;
  const rangeLabel =
    view === 'day'
      ? formatDate(firstDay.toISOString(), 'long')
      : view === 'week'
        ? `${formatDate(firstDay.toISOString())} – ${formatDate(lastDay.toISOString())}`
        : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(anchor);

  const shift = (direction: -1 | 1) => {
    setAnchor((current) => {
      if (view === 'day') return addDays(current, direction);
      if (view === 'week') return addDays(current, direction * 7);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  };

  const openDay = (day: Date) => {
    setAnchor(day);
    setView('day');
  };

  return (
    <div className="pb-8">
      <PageHeader
        title="Calendar"
        description="Meetings, demos and visits on a day, week or month view. Suggested times are deterministic demo recommendations, not real availability."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Calendar' }]}
        actions={
          <IconButton label="Refresh events" icon={<RefreshCw className={cn(events.loading && 'animate-spin')} />} size="icon-sm" onClick={() => events.reload()} />
        }
        footer={
          <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle bg-surface px-4 py-2 sm:px-6">
            <div className="inline-flex items-center gap-1">
              <IconButton label="Previous period" icon={<ChevronLeft className="rtl:rotate-180" />} size="icon-sm" onClick={() => shift(-1)} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAnchor(new Date())}
              >
                Today
              </Button>
              <IconButton label="Next period" icon={<ChevronRight className="rtl:rotate-180" />} size="icon-sm" onClick={() => shift(1)} />
            </div>
            <h2 className="text-sm font-semibold text-fg">{rangeLabel}</h2>
            <div className="ms-auto">
              <ViewSwitcher
                value={view}
                onChange={setView}
                label="Calendar view"
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
              />
            </div>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Events in view" value={formatNumber(metrics.inView)} tone="violet" />
          <MiniStat label="Meetings" value={formatNumber(metrics.meetings)} tone="violet" />
          <MiniStat label="Demos" value={formatNumber(metrics.demos)} tone="amber" />
          <MiniStat label="Visits" value={formatNumber(metrics.visits)} tone="green" />
          <MiniStat label="Scheduled time" value={`${formatNumber(metrics.hours)} h`} tone="teal" />
        </div>

        <DemoNotice tone="warning">
          The calendar is a front-end demonstration over seeded events. No calendar provider is connected, invitations are not sent, and recording a new time changes this browser only.
        </DemoNotice>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            {events.loading ? (
              <div className="rounded-lg border border-border-subtle bg-surface p-3">
                <ListSkeleton rows={8} columns={4} />
              </div>
            ) : view === 'month' ? (
              <MonthGrid days={range.days} anchor={anchor} today={today} byDay={byDay} onSelect={setSelected} onShowDay={openDay} />
            ) : view === 'week' ? (
              <WeekGrid days={range.days} today={today} byDay={byDay} onSelect={setSelected} onShowDay={openDay} />
            ) : (
              <DayAgenda day={firstDay} events={byDay.get(dayKey(firstDay)) ?? []} onSelect={setSelected} />
            )}
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <CalendarDays className="size-3.5 text-subtle" aria-hidden />
                <CardTitle>Calendars</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Switch id="calendar-show-mine" checked={showMine} onCheckedChange={setShowMine} label="My calendar" description="Events you organise in the seeded data." />
                <Switch id="calendar-show-team" checked={showTeam} onCheckedChange={setShowTeam} label="Team calendar" description="Events organised by other reps." />
                <ul className="space-y-2 border-t border-border-subtle pt-3">
                  {calendars.loading ? (
                    <li className="text-[0.6875rem] text-faint">Loading calendars…</li>
                  ) : (
                    calendars.items.map((calendar) => (
                      <li key={calendar.id} className="flex items-center gap-2 text-xs">
                        <span className={cn('size-2.5 shrink-0 rounded-full', toneClass(calendar.color, 'dot'))} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-muted">{calendar.name}</span>
                        <Badge variant="outline" size="sm">
                          {calendar.kind}
                        </Badge>
                      </li>
                    ))
                  )}
                </ul>
                <DemoNotice tone="neutral">
                  Seeded events are grouped into My calendar and Team calendar by their organiser. The Company holidays calendar has no events in this dataset.
                </DemoNotice>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>This window</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2.5 text-xs">
                  <FactRow label="From" value={formatDate(fromIso)} />
                  <FactRow label="To" value={formatDate(toIso)} />
                  <FactRow label="Loaded" value={`${formatNumber(events.items.length)} events`} />
                  <FactRow label="Shown" value={`${formatNumber(visibleEvents.length)} events`} />
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {selected ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setSelected(null))}>
          <EventDialog
            key={selected.id}
            event={selected}
            rangeFrom={fromIso}
            rangeTo={toIso}
            onChanged={() => events.reload()}
            onClose={() => setSelected(null)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}

export { CalendarScreen, MonthGrid, WeekGrid, DayAgenda, windowFor, EVENT_LABEL, EVENT_TONE };
