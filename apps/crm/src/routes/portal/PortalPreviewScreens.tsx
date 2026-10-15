'use client';

import * as React from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  FolderKanban,
  Lock,
  Search,
  TriangleAlert,
} from 'lucide-react';
import type { CalendarEvent, KbBlock, Project, ProjectPhase, Ticket } from '@crm/shared-types';
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
  MiniStat,
  Progress,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TonePill,
  cn,
  focusRing,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordEmptyState, formatDate, formatNumber, initialsOf } from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';

/**
 * Customer portal preview.
 *
 * This is a **preview**, not a portal. There is no customer login, no hosted subdomain and no
 * data boundary between tenants here: every list below is read straight from the same mock
 * services the internal workspace uses. The screen says so at the top, and each panel adds the
 * one fact a reviewer would otherwise have to guess — that ticket submission, appointment
 * booking and e-signature are not implemented, and that a real portal would show a narrower
 * slice of these records than the internal workspace does.
 *
 * The panels reuse the internal services deliberately, so what a customer would see is
 * derived from the same seeded records rather than a parallel set of fake portal data.
 */

/* ------------------------------------------------------------------ vocab */

const PRIORITY_TONE: Record<Ticket['priority'], Tone> = {
  critical: 'red',
  high: 'amber',
  normal: 'blue',
  low: 'slate',
};

const EVENT_KIND_LABEL: Record<CalendarEvent['kind'], string> = {
  meeting: 'Meeting',
  call: 'Call',
  demo: 'Demo',
  visit: 'Visit',
};

const PHASE_STATUS_LABEL: Record<ProjectPhase['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

function humanise(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatDateTime(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/* ------------------------------------------------------------- small parts */

/** A repeated honesty note. Kept in one place so the wording cannot drift between panels. */
function PreviewNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-inset p-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
      <p className="text-[0.6875rem] leading-relaxed text-faint">{children}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- tickets */

function TicketPanel() {
  const services = useServices();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const tickets = useList(
    () => services.tickets.list({ pageSize: 50, sort: [{ field: 'updatedAt', direction: 'desc' as const }] }),
    [],
  );

  const selected = selectedId ? tickets.items.find((ticket) => ticket.id === selectedId) ?? null : null;

  const messages = useList(
    () => services.tickets.messages(selectedId ?? ''),
    [selectedId],
    { skip: !selectedId },
  );

  return (
    <div className="space-y-4">
      <Alert tone="warning" title="Ticket submission is not implemented in this preview">
        Raising, replying to and closing tickets need a customer identity and a backend. This panel reads the support
        queue in the demo dataset and is read-only.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="lg:max-h-[32rem] lg:overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Your tickets</CardTitle>
            <Badge variant="neutral" size="sm">{formatNumber(tickets.items.length)}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {tickets.loading ? (
              <div className="p-4">
                <ListSkeleton rows={5} columns={1} />
              </div>
            ) : tickets.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No tickets are recorded in the demo dataset.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {tickets.items.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(ticket.id)}
                      aria-pressed={selectedId === ticket.id}
                      className={cn(
                        'w-full px-4 py-3 text-start transition-colors',
                        focusRing,
                        selectedId === ticket.id ? 'bg-brand-subtle' : 'hover:bg-inset',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-fg">{ticket.subject}</span>
                        <StatusBadge status={ticket.status} size="sm" />
                      </span>
                      <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                        {ticket.reference} · updated {formatDate(ticket.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div>
          {!selected ? (
            <RecordEmptyState
              title="Choose a ticket"
              body="Select a ticket on the left to read the conversation a customer would see in the portal."
            />
          ) : (
            <Card>
              <CardHeader className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{selected.subject}</CardTitle>
                  <StatusBadge status={selected.status} size="sm" />
                  <TonePill tone={PRIORITY_TONE[selected.priority]} dot={false}>
                    {selected.priority}
                  </TonePill>
                </div>
                <p className="text-2xs text-muted">
                  {selected.reference} · raised via {humanise(selected.channel)} · {selected.requesterName}
                  {selected.categoryLabel ? ` · ${selected.categoryLabel}` : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted">{selected.description}</p>

                <div className="space-y-3">
                  <p className="text-2xs font-medium uppercase tracking-wide text-faint">Conversation</p>
                  {messages.loading ? (
                    <ListSkeleton rows={3} columns={1} />
                  ) : messages.items.length === 0 ? (
                    <p className="text-xs text-muted">No messages are recorded against this ticket.</p>
                  ) : (
                    <ol className="space-y-3">
                      {messages.items
                        .filter((message) => message.kind !== 'internal_note')
                        .map((message) => (
                          <li
                            key={message.id}
                            className={cn(
                              'rounded-lg border p-3',
                              message.isFromCustomer ? 'border-border-subtle bg-inset' : 'border-brand/20 bg-brand-subtle',
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-medium text-fg">{message.authorName}</span>
                              <span className="text-2xs text-faint">{formatDateTime(message.createdAt)}</span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted">{message.body}</p>
                            {message.delivery?.state === 'simulated_sent' ? (
                              <p className="mt-1 text-[0.625rem] uppercase tracking-wide text-faint">Delivery simulated</p>
                            ) : null}
                          </li>
                        ))}
                    </ol>
                  )}
                </div>

                <PreviewNote>
                  Internal notes are hidden here, because a real customer portal would never display them. Replies sent from
                  the internal workspace are marked <span className="font-mono">simulated_sent</span>; no email is delivered.
                </PreviewNote>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- knowledge */

function KnowledgePanel() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Only published, public articles are shown — the same two conditions the portal would apply.
  const filter = React.useMemo(
    () => ({
      id: 'portal-kb',
      conjunction: 'and' as const,
      clauses: [
        { field: 'scope', operator: 'eq' as const, value: 'public' },
        { field: 'status', operator: 'eq' as const, value: 'published' },
      ],
    }),
    [],
  );

  const articles = useList(
    () => services.knowledgeBase.list({ pageSize: 100, sort: [{ field: 'views', direction: 'desc' as const }], filter: filter as never }),
    [filter],
  );

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return articles.items;
    return articles.items.filter((article) =>
      `${article.title} ${article.summary} ${article.categoryLabel}`.toLowerCase().includes(term),
    );
  }, [articles.items, search]);

  const selected = selectedId ? articles.items.find((article) => article.id === selectedId) ?? null : null;

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search the help centre"
        resultCount={`${formatNumber(visible.length)} article${visible.length === 1 ? '' : 's'}`}
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="lg:max-h-[34rem] lg:overflow-y-auto">
          <CardHeader>
            <CardTitle>Help centre</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {articles.loading ? (
              <div className="p-4">
                <ListSkeleton rows={5} columns={1} />
              </div>
            ) : visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No published articles match that search.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {visible.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(article.id)}
                      aria-pressed={selectedId === article.id}
                      className={cn(
                        'w-full px-4 py-3 text-start transition-colors',
                        focusRing,
                        selectedId === article.id ? 'bg-brand-subtle' : 'hover:bg-inset',
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-fg">{article.title}</span>
                          <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                            {article.categoryLabel} · {formatNumber(article.views)} views
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div>
          {!selected ? (
            <RecordEmptyState
              title="Choose an article"
              body="Select an article to read it as it would appear in the help centre."
            />
          ) : (
            <Card>
              <CardHeader className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle>{selected.title}</CardTitle>
                    <p className="mt-0.5 text-2xs text-muted">
                      {selected.categoryLabel}
                      {selected.publishedAt ? ` · published ${formatDate(selected.publishedAt)}` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="xs" leadingIcon={<ArrowLeft className="size-3.5" />} onClick={() => setSelectedId(null)}>
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted">{selected.summary}</p>
                <PortalBlocks blocks={selected.blocks} />
                <PreviewNote>
                  Articles are stored as structured blocks and rendered by a closed switch — there is no raw HTML and no
                  sanitiser to get wrong. Voting and comment features are not part of this preview.
                </PreviewNote>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A minimal block renderer for the preview.
 *
 * The internal knowledge-base screen already has one, but a route module does not import from
 * another route module in this codebase, so this stays self-contained.
 */
function PortalBlocks({ blocks }: { blocks: KbBlock[] }) {
  const headingClass: Record<number, string> = {
    2: 'mt-6 text-lg font-semibold tracking-tight text-fg first:mt-0',
    3: 'mt-5 text-base font-semibold text-fg',
    4: 'mt-4 text-sm font-semibold text-fg',
  };

  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted">
      {blocks.map((block) => {
        switch (block.type) {
          case 'heading':
            return (
              <h2 key={block.id} className={headingClass[block.level] ?? headingClass[3]}>
                {block.text}
              </h2>
            );
          case 'paragraph':
            return <p key={block.id}>{block.text}</p>;
          case 'list':
            return block.ordered ? (
              <ol key={block.id} className="ms-5 list-decimal space-y-1">
                {block.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul key={block.id} className="ms-5 list-disc space-y-1">
                {block.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            );
          case 'steps':
            return (
              <ol key={block.id} className="space-y-2">
                {block.items.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-2xs font-semibold text-brand-fg" aria-hidden>
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          case 'callout':
            return (
              <Alert key={block.id} tone={block.tone}>
                {block.text}
              </Alert>
            );
          case 'code':
            return (
              <pre key={block.id} className="overflow-x-auto rounded-md border border-border-subtle bg-inset p-3 text-xs">
                <code>{block.code}</code>
              </pre>
            );
          case 'table':
            return (
              <div key={block.id} className="overflow-x-auto rounded-md border border-border-subtle">
                <table className="w-full text-xs">
                  <thead className="bg-inset">
                    <tr>
                      {block.headers.map((header, index) => (
                        <th key={index} scope="col" className="px-3 py-2 text-start font-medium text-fg">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-border-subtle">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'image_placeholder':
            return (
              <figure key={block.id} className="rounded-md border border-dashed border-border-strong bg-inset p-6 text-center">
                <figcaption className="text-xs text-faint">{block.alt}</figcaption>
                {block.caption ? <p className="mt-1 text-[0.6875rem] text-faint">{block.caption}</p> : null}
              </figure>
            );
          case 'video_placeholder':
            return (
              <div key={block.id} className="flex items-center justify-center rounded-md border border-dashed border-border-strong bg-inset p-8 text-xs text-faint">
                {block.caption}
              </div>
            );
          case 'divider':
            return <hr key={block.id} className="border-border-subtle" />;
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- projects */

const PROJECT_HEALTH_TONE: Record<Project['health'], Tone> = {
  on_track: 'green',
  at_risk: 'amber',
  off_track: 'red',
  blocked: 'red',
};

function ProjectsPanel() {
  const services = useServices();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const projects = useList(
    () => services.projects.list({ pageSize: 100, sort: [{ field: 'updatedAt', direction: 'desc' as const }] }),
    [],
  );

  // A real portal only ever shows projects flagged customer-visible.
  const visible = React.useMemo(() => projects.items.filter((project) => project.customerVisible), [projects.items]);
  const selected = selectedId ? visible.find((project) => project.id === selectedId) ?? null : null;

  const phases = useList(() => services.projects.phases(selectedId ?? ''), [selectedId], { skip: !selectedId });

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Only customer-visible projects appear here">
        The internal workspace shows every project. This preview filters to the records flagged customer-visible, which is
        the subset a portal would expose.
      </Alert>

      {projects.loading ? (
        <ListSkeleton rows={4} columns={3} />
      ) : visible.length === 0 ? (
        <RecordEmptyState
          title="No projects are shared with customers"
          body="No project in the demo dataset is flagged customer-visible, so there is nothing to show in the portal."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <Card key={project.id}>
              <CardHeader className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm">{project.name}</CardTitle>
                  <TonePill tone={PROJECT_HEALTH_TONE[project.health]} dot={false}>
                    {humanise(project.health)}
                  </TonePill>
                </div>
                <p className="text-2xs text-muted">
                  {project.reference} · {project.accountName} · target {formatDate(project.targetEndDate)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={project.progressPercent} tone="auto" label="Progress" showValue />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-2xs text-faint">
                    {project.completedMilestoneCount} of {project.milestoneCount} milestones complete
                  </span>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => setSelectedId(project.id === selectedId ? null : project.id)}
                  >
                    {selectedId === project.id ? 'Hide phases' : 'View phases'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{selected.name} — delivery phases</CardTitle>
            <Badge variant="neutral" size="sm">Derived from the schedule</Badge>
          </CardHeader>
          <CardContent>
            {phases.loading ? (
              <ListSkeleton rows={4} columns={2} />
            ) : phases.items.length === 0 ? (
              <p className="text-xs text-muted">No phases could be derived for this project window.</p>
            ) : (
              <ol className="space-y-3">
                {phases.items.map((phase) => (
                  <li key={phase.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-fg">
                        <span className="me-1.5 text-faint">{phase.order}.</span>
                        {phase.name}
                      </span>
                      <span className="text-2xs text-faint">
                        {formatDate(phase.startDate)} – {formatDate(phase.endDate)} · {PHASE_STATUS_LABEL[phase.status]}
                      </span>
                    </div>
                    <Progress value={phase.progressPercent} tone={phase.tone} size="xs" />
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3">
              <PreviewNote>
                Phases are derived by the mock service from the project's start and target dates. Risk notes, budgets and
                team allocation stay in the internal workspace and are not shown to a customer.
              </PreviewNote>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ appointments */

/**
 * The portal preview pins “now” once per page load.
 *
 * Reading the clock inside render would make the component impure (and the React Compiler
 * linter rejects it), so the reference instant is captured at module scope instead.
 */
const PREVIEW_NOW = Date.now();

function AppointmentsPanel() {
  const services = useServices();

  const events = useList(
    () => services.calendar.events({ pageSize: 200, sort: [{ field: 'startAt', direction: 'asc' as const }] }),
    [],
  );

  const now = PREVIEW_NOW;
  const { upcoming, past } = React.useMemo(() => {
    const upcomingList: CalendarEvent[] = [];
    const pastList: CalendarEvent[] = [];
    for (const event of events.items) {
      if (!event.startAt) continue;
      if (new Date(event.startAt).getTime() >= now) upcomingList.push(event);
      else pastList.push(event);
    }
    return { upcoming: upcomingList, past: pastList };
  }, [events.items, now]);

  return (
    <div className="space-y-4">
      <Alert tone="warning" title="Appointment booking is not implemented">
        There is no customer identity to book against and no calendar provider to write to. This panel lists entries from
        the demo calendar so the presentation can be reviewed; it cannot create, move or cancel anything.
      </Alert>

      {events.loading ? (
        <ListSkeleton rows={5} columns={2} />
      ) : events.items.length === 0 ? (
        <RecordEmptyState title="No appointments" body="The demo calendar has no entries to show." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Upcoming</CardTitle>
              <Badge variant="neutral" size="sm">{formatNumber(upcoming.length)}</Badge>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-xs text-muted">Nothing is scheduled from today onward.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {upcoming.map((event) => (
                    <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-fg">{event.subject}</p>
                        <p className="mt-0.5 text-[0.6875rem] text-faint">
                          {formatDateTime(event.startAt)}
                          {event.location ? ` · ${event.location}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" size="sm">{EVENT_KIND_LABEL[event.kind]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Past</CardTitle>
              <Badge variant="neutral" size="sm">{formatNumber(past.length)}</Badge>
            </CardHeader>
            <CardContent>
              {past.length === 0 ? (
                <p className="text-xs text-muted">No appointments have taken place yet.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {past.slice(0, 20).map((event) => (
                    <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-muted">{event.subject}</p>
                        <p className="mt-0.5 text-[0.6875rem] text-faint">
                          {formatDateTime(event.startAt)}
                          {event.ownerName ? ` · ${event.ownerName}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" size="sm">{EVENT_KIND_LABEL[event.kind]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ screen */

export function PortalPreviewScreen() {
  const services = useServices();
  const user = useAsync(() => services.tenant.currentUser(), []);
  const organizations = useList(() => services.tenant.organizations(), []);

  const activeId = user.data?.activeOrganizationId ?? organizations.items[0]?.id;
  const organization = organizations.items.find((candidate) => candidate.id === activeId);
  const displayName = organization?.branding.productDisplayName ?? organization?.name ?? 'Customer portal';
  const welcomeMessage = organization?.branding.productDisplayName
    ? `Welcome to ${displayName} support.`
    : `Welcome to the self-service portal for ${displayName}.`;

  return (
    <div className="pb-8">
      <PageHeader
        title="Customer portal preview"
        description="The branded self-service experience a customer would see: their tickets, the public help centre, shared project progress and appointments."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customer portal preview' }]}
      />

      <div className="space-y-5 p-4 sm:p-6">
        <Alert tone="warning" title="This is a preview, not a live portal">
          No customer is signed in, nothing is hosted on a subdomain, and no data is isolated by customer. Every panel
          below reads the same demo dataset the internal workspace uses. Ticket submission, appointment booking and
          e-signature are not implemented.
        </Alert>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-fg" aria-hidden>
              {initialsOf(displayName)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">{displayName}</p>
              <p className="text-xs text-muted">{welcomeMessage}</p>
            </div>
            <div className="ms-auto flex items-center gap-2">
              <DemoNotice tone="warning">Preview over synthetic data</DemoNotice>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Brand shown" value={organization ? displayName : 'Default'} tone="violet" />
          <MiniStat label="Branding source" value={organization?.branding.accentPresetId ?? 'Organization default'} tone="slate" />
          <MiniStat label="Support" value="Read-only" tone="blue" />
          <MiniStat label="Sign-in" value="Not implemented" tone="amber" />
        </div>

        <Tabs defaultValue="tickets">
          <TabsList aria-label="Portal sections">
            <TabsTrigger value="tickets">
              <Lock className="size-4" aria-hidden />
              Support tickets
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <BookOpen className="size-4" aria-hidden />
              Help centre
            </TabsTrigger>
            <TabsTrigger value="projects">
              <FolderKanban className="size-4" aria-hidden />
              Projects
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <CalendarDays className="size-4" aria-hidden />
              Appointments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets">
            <TicketPanel />
          </TabsContent>
          <TabsContent value="knowledge">
            <KnowledgePanel />
          </TabsContent>
          <TabsContent value="projects">
            <ProjectsPanel />
          </TabsContent>
          <TabsContent value="appointments">
            <AppointmentsPanel />
          </TabsContent>
        </Tabs>

        <PreviewNote>
          <span className="inline-flex items-center gap-1.5">
            <Search className="size-3.5" aria-hidden />
            Everything here is read from the local mock services at render time; no request leaves the browser and no
            customer-facing system is contacted.
          </span>
        </PreviewNote>
      </div>
    </div>
  );
}
