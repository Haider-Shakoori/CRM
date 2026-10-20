'use client';

import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Building2,
  GitMerge,
  Mail,
  Network,
  Phone,
  ShieldCheck,
  ShieldAlert,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  ConsentChannel,
  ConsentRecord,
  ConsentState,
  Contact,
  ContactRelationship,
  ContactRelationshipKind,
  LifecycleStage,
  Tone,
} from '@crm/shared-types';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  MultiSelect,
  Pagination,
  Progress,
  Select,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TonePill,
  Tooltip,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Contact screens.
 *
 * The directory, the profile and the duplicate review all read the same `Contact` records,
 * so a consent change made on the profile is visible in the list without a refetch dance.
 *
 * Consent is the part worth reading. It is stored per channel and is never inferred: an
 * empty consent list means "we have not asked", which is different from "they said no", and
 * the interface keeps those two apart at every level.
 */

/* ------------------------------------------------------------------ helpers */

const LIFECYCLE_STAGES: LifecycleStage[] = [
  'subscriber',
  'lead',
  'mql',
  'sql',
  'opportunity',
  'customer',
  'evangelist',
  'churned',
  'other',
];

const LIFECYCLE_TONE: Record<LifecycleStage, Tone> = {
  subscriber: 'slate',
  lead: 'blue',
  mql: 'teal',
  sql: 'violet',
  opportunity: 'violet',
  customer: 'green',
  evangelist: 'amber',
  churned: 'red',
  other: 'neutral',
};

const CONSENT_CHANNELS: ConsentChannel[] = ['email', 'sms', 'phone', 'whatsapp', 'post', 'profiling'];

const CONSENT_TONE: Record<ConsentState, Tone> = {
  granted: 'green',
  denied: 'red',
  withdrawn: 'amber',
  pending: 'blue',
  not_asked: 'slate',
};

const CONSENT_LABEL: Record<ConsentState, string> = {
  granted: 'Granted',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
  pending: 'Pending',
  not_asked: 'Not asked',
};

const RELATIONSHIP_LABEL: Record<ContactRelationshipKind, string> = {
  reports_to: 'Reports to',
  assistant: 'Assistant',
  decision_maker: 'Decision maker',
  influencer: 'Influencer',
  champion: 'Champion',
  billing_contact: 'Billing contact',
  technical_contact: 'Technical contact',
  related_to: 'Related to',
  referred_by: 'Referred by',
};

const STRENGTH_TONE: Record<string, Tone> = {
  strong: 'green',
  moderate: 'amber',
  weak: 'slate',
  unknown: 'neutral',
};

const ROLES_WITH_INFLUENCE: ContactRelationshipKind[] = ['decision_maker', 'influencer', 'champion'];

function consentFor(contact: Contact, channel: ConsentChannel): ConsentRecord | undefined {
  return contact.consent.find((entry) => entry.channel === channel);
}

/** How many channels the contact has explicitly permitted, used for the list summary. */
function grantedCount(contact: Contact): number {
  return contact.consent.filter((entry) => entry.state === 'granted').length;
}

function primaryEmail(contact: Contact): string | undefined {
  return (contact.emails.find((email) => email.isPrimary) ?? contact.emails[0])?.value;
}

function primaryPhone(contact: Contact): string | undefined {
  return (contact.phones.find((phone) => phone.isPrimary) ?? contact.phones[0])?.value;
}

/** Whether the contact can lawfully be emailed right now, and why not if they cannot. */
function emailConsentState(contact: Contact): ConsentState {
  return consentFor(contact, 'email')?.state ?? 'not_asked';
}

/* -------------------------------------------------------------------- list */

const CONTACT_VIEWS = [
  { id: 'all', name: 'All contacts', description: 'Every contact in the organization, richest first.' },
  { id: 'customers', name: 'Customers', description: 'Contacts attached to an account at the customer lifecycle stage.' },
  { id: 'influencers', name: 'Decision makers and champions', description: 'Contacts who influence a purchase decision.' },
  { id: 'consent-gap', name: 'Missing email consent', description: 'Contacts who cannot lawfully be emailed, or have withdrawn consent.' },
  { id: 'engaged', name: 'Engaged in the last 30 days', description: 'Contacts with a recorded interaction this month.' },
];

export default function ContactsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'table' | 'cards'>('table');
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>('comfortable');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = React.useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = React.useState<string[]>([]);
  const [stageChangeOpen, setStageChangeOpen] = React.useState(false);

  const activeViewId = params.get('view') ?? 'all';
  const activeView = CONTACT_VIEWS.find((entry) => entry.id === activeViewId) ?? CONTACT_VIEWS[0]!;

  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const query = React.useMemo(() => {
    const clauses: Array<{ field: string; operator: 'eq' | 'in'; value: unknown }> = [];
    if (lifecycleFilter.length > 0) clauses.push({ field: 'lifecycleStage', operator: 'in', value: lifecycleFilter });
    if (ownerFilter.length > 0) clauses.push({ field: 'ownerId', operator: 'in', value: ownerFilter });
    if (activeViewId === 'customers') clauses.push({ field: 'lifecycleStage', operator: 'in', value: ['customer', 'evangelist'] });
    return {
      page: activeViewId === 'all' ? page : 1,
      pageSize: activeViewId === 'all' ? pageSize : 250,
      q: search || undefined,
      sort: [{ field: 'lastActivityAt', direction: 'desc' as const }],
      filter: clauses.length > 0 ? { id: 'contacts', conjunction: 'and' as const, clauses: clauses as never } : undefined,
    };
  }, [page, pageSize, search, lifecycleFilter, ownerFilter, activeViewId]);

  const contacts = useList(() => services.contacts.list(query), [JSON.stringify(query)]);
  const [now] = React.useState(() => Date.now());

  /** The saved views that are not expressible as a server clause are narrowed here. */
  const filtered = React.useMemo(() => {
    if (activeViewId === 'consent-gap') {
      return contacts.items.filter((contact) => emailConsentState(contact) !== 'granted');
    }
    if (activeViewId === 'influencers') {
      return contacts.items.filter((contact) =>
        contact.relationships.some((relationship) => ROLES_WITH_INFLUENCE.includes(relationship.kind)),
      );
    }
    if (activeViewId === 'engaged') {
      return contacts.items.filter((contact) => {
        const reference = contact.lastActivityAt ?? contact.lastEmailAt ?? contact.lastMeetingAt;
        return reference ? (now - new Date(reference).getTime()) / 86_400_000 <= 30 : false;
      });
    }
    return contacts.items;
  }, [contacts.items, activeViewId, now]);

  const changeLifecycle = useMutation(
    (input: { ids: string[]; stage: LifecycleStage }) => services.contacts.updateLifecycle(input.ids, input.stage),
    {
      successMessage: (result) => `${result.succeeded} of ${result.requested} contacts updated.`,
      onSuccess: () => {
        contacts.reload();
        setSelected([]);
      },
    },
  );

  const assignOwner = useMutation(
    (input: { ids: string[]; ownerId: string }) => services.contacts.assign(input.ids, input.ownerId),
    {
      successMessage: (result) => `${result.succeeded} of ${result.requested} contacts reassigned.`,
      onSuccess: () => {
        contacts.reload();
        setSelected([]);
      },
    },
  );

  const clearFilters = React.useCallback(() => {
    setLifecycleFilter([]);
    setOwnerFilter([]);
    setSearch('');
    setParams({}, { replace: true });
    setPage(1);
  }, [setParams]);

  const columns = React.useMemo<ColumnDef<Contact, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Contact',
        accessorKey: 'displayName',
        cell: ({ row }) => {
          const contact = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar name={contact.displayName} size="sm" tone="teal" />
              <div className="min-w-0">
                <Link
                  to={`/app/contacts/${contact.id}`}
                  className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
                >
                  {contact.displayName}
                </Link>
                <span className="mt-0.5 block truncate text-[0.6875rem] text-subtle">
                  {contact.jobTitle ?? 'Job title not set'}
                  {contact.accountName ? ` · ${contact.accountName}` : ''}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'lifecycle',
        header: 'Lifecycle',
        accessorKey: 'lifecycleStage',
        cell: ({ row }) => (
          <TonePill tone={LIFECYCLE_TONE[row.original.lifecycleStage]}>
            {row.original.lifecycleStage.replace(/_/g, ' ')}
          </TonePill>
        ),
      },
      {
        id: 'consent',
        header: 'Consent',
        accessorFn: (contact) => grantedCount(contact),
        cell: ({ row }) => {
          const contact = row.original;
          const state = emailConsentState(contact);
          const granted = grantedCount(contact);
          return (
            <Tooltip
              content={
                <span className="block space-y-1">
                  {CONSENT_CHANNELS.map((channel) => {
                    const record = consentFor(contact, channel);
                    return (
                      <span key={channel} className="block">
                        {channel}: {record ? CONSENT_LABEL[record.state] : 'Not asked'}
                      </span>
                    );
                  })}
                </span>
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {state === 'granted' ? (
                  <ShieldCheck className="size-3.5 text-success-fg" aria-hidden />
                ) : state === 'not_asked' ? (
                  <ShieldAlert className="size-3.5 text-subtle" aria-hidden />
                ) : (
                  <TriangleAlert className="size-3.5 text-warning-fg" aria-hidden />
                )}
                <span className="text-[0.6875rem] text-muted">
                  {granted}/{CONSENT_CHANNELS.length} channels
                </span>
              </span>
            </Tooltip>
          );
        },
      },
      {
        id: 'engagement',
        header: 'Engagement',
        accessorFn: (contact) => contact.engagementScore ?? 0,
        cell: ({ row }) => {
          const score = row.original.engagementScore;
          if (score === undefined) return <span className="text-subtle">—</span>;
          return (
            <span className="flex items-center gap-2">
              <span className="w-7 text-end text-xs font-semibold tabular-nums text-fg">{score}</span>
              <span className="w-12">
                <Progress value={score} size="xs" tone={score >= 70 ? 'green' : score >= 40 ? 'amber' : 'slate'} />
              </span>
            </span>
          );
        },
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorKey: 'ownerId',
        cell: ({ row }) => {
          const owner = (users.items ?? []).find((user) => user.id === row.original.ownerId);
          return (
            <span className="flex items-center gap-2">
              <Avatar name={owner?.displayName ?? 'Unassigned'} size="xs" tone="slate" />
              <span className="truncate text-[0.6875rem] text-muted">{owner?.displayName ?? 'Unassigned'}</span>
            </span>
          );
        },
      },
      {
        id: 'open',
        header: 'Open',
        accessorFn: (contact) => contact.openDealCount + contact.openTicketCount,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 text-[0.6875rem] tabular-nums text-muted">
            <span title="Open deals">{row.original.openDealCount} deals</span>
            <span className="text-faint" aria-hidden>·</span>
            <span title="Open tickets">{row.original.openTicketCount} tickets</span>
          </span>
        ),
      },
      {
        id: 'lastActivity',
        header: 'Last activity',
        accessorKey: 'lastActivityAt',
        cell: ({ row }) => (
          <span className="text-[0.6875rem] text-muted">
            {formatDate(row.original.lastActivityAt ?? row.original.lastEmailAt, 'relative')}
          </span>
        ),
      },
    ],
    [users.items],
  );

  const resultCount = `${filtered.length} ${filtered.length === 1 ? 'contact' : 'contacts'}`;

  return (
    <div className="pb-6">
      <PageHeader
        title="Contacts"
        description="The people on the other side of every deal and ticket, with their consent state recorded per channel."
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/crm/contacts">Live Contacts (Laravel)</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/contacts/duplicates">
                <GitMerge className="size-3.5" aria-hidden />
                Review duplicates
              </Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to="/app/contacts/new">
                <UserPlus className="size-3.5" aria-hidden />
                New contact
              </Link>
            </Button>
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search contacts by name, account, title or email"
        resultCount={resultCount}
        viewNote={activeView.description}
        chips={[
          ...lifecycleFilter.map((stage) => ({
            id: `stage-${stage}`,
            label: `Stage: ${stage.replace(/_/g, ' ')}`,
            onRemove: () => setLifecycleFilter((current) => current.filter((entry) => entry !== stage)),
          })),
          ...ownerFilter.map((ownerId) => ({
            id: `owner-${ownerId}`,
            label: `Owner: ${(users.items ?? []).find((user) => user.id === ownerId)?.displayName ?? ownerId}`,
            onRemove: () => setOwnerFilter((current) => current.filter((entry) => entry !== ownerId)),
          })),
        ]}
        onClearFilters={lifecycleFilter.length + ownerFilter.length > 0 ? clearFilters : undefined}
        actions={
          <>
            {selected.length > 0 ? (
              <>
                <Button variant="secondary" size="xs" onClick={() => setStageChangeOpen(true)}>
                  Change stage ({selected.length})
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    // Bulk assign to the first available owner is deliberately not automatic:
                    // the dialog asks which person, because "assign to me" is not always right.
                    void assignOwner.run({ ids: selected, ownerId: (users.items ?? [])[0]?.id ?? '' });
                  }}
                >
                  Assign to first owner
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setDensity((current) => (current === 'comfortable' ? 'compact' : 'comfortable'))}
              aria-pressed={density === 'compact'}
            >
              {density === 'comfortable' ? 'Compact rows' : 'Comfortable rows'}
            </Button>
            <ViewToggle value={view} onChange={setView} />
          </>
        }
      />

      <div className="border-b border-border-subtle bg-inset/40 px-4 py-2.5 sm:px-6">
        <ViewPicker
          views={CONTACT_VIEWS}
          activeId={activeViewId}
          onChange={(id) => setParams(id === 'all' ? {} : { view: id }, { replace: true })}
          lifecycleFilter={lifecycleFilter}
          setLifecycleFilter={(value) => {
            setLifecycleFilter(value);
            setPage(1);
          }}
          ownerFilter={ownerFilter}
          setOwnerFilter={(value) => {
            setOwnerFilter(value);
            setPage(1);
          }}
          ownerOptions={(users.items ?? []).map((user) => ({ value: user.id, label: user.displayName }))}
        />
      </div>

      <div className="p-4 sm:p-6">
        {contacts.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No contacts match these filters"
            body="Contacts arrive when a lead converts, when an account is imported, or when someone is added by hand."
            hints={[
              'Clear the filters to see every contact in the organization',
              'Convert a qualified lead to create its contact and account together',
              'Review duplicate candidates before importing a new list',
            ]}
            action={
              <>
                <Button variant="primary" size="sm" asChild>
                  <Link to="/app/contacts/new">Create a contact</Link>
                </Button>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            }
          />
        ) : view === 'cards' ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((contact) => (
              <li key={contact.id}>
                <Card className="h-full p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={contact.displayName} size="md" tone="teal" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/app/contacts/${contact.id}`}
                        className="block truncate text-xs font-semibold text-fg hover:text-link hover:underline"
                      >
                        {contact.displayName}
                      </Link>
                      <p className="mt-0.5 truncate text-[0.6875rem] text-muted">
                        {contact.jobTitle ?? 'Job title not set'}
                      </p>
                      {contact.accountName ? (
                        <Link
                          to={`/app/accounts/${contact.accountId}`}
                          className="mt-0.5 flex items-center gap-1 truncate text-[0.6875rem] text-subtle hover:text-link"
                        >
                          <Building2 className="size-3" aria-hidden />
                          {contact.accountName}
                        </Link>
                      ) : null}
                    </div>
                    <TonePill tone={LIFECYCLE_TONE[contact.lifecycleStage]}>
                      {contact.lifecycleStage.replace(/_/g, ' ')}
                    </TonePill>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-center">
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">Consent</dt>
                      <dd className="mt-0.5 text-xs tabular-nums text-fg">{grantedCount(contact)} ch.</dd>
                    </div>
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">Deals</dt>
                      <dd className="mt-0.5 text-xs tabular-nums text-fg">{contact.openDealCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">Tickets</dt>
                      <dd className="mt-0.5 text-xs tabular-nums text-fg">{contact.openTicketCount}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            density={density}
            selectable
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            onRowClick={(contact) => navigate(`/app/contacts/${contact.id}`)}
            getRowId={(contact) => contact.id}
            footer={
              activeViewId === 'all' && contacts.meta ? (
                <Pagination
                  page={contacts.meta.page}
                  pageSize={contacts.meta.pageSize}
                  total={contacts.meta.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : (
                <p className="px-3 py-2 text-[0.6875rem] text-subtle">
                  {activeView.description} Narrow the view to page through the full directory.
                </p>
              )
            }
          />
        )}
      </div>

      <Dialog open={stageChangeOpen} onOpenChange={setStageChangeOpen}>
        <DialogContent
          title="Change lifecycle stage"
          description={`Set a new stage for ${selected.length} ${selected.length === 1 ? 'contact' : 'contacts'}.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setStageChangeOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="change-lifecycle-form" loading={changeLifecycle.pending}>
                Apply
              </Button>
            </>
          }
        >
          <form
            id="change-lifecycle-form"
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const stage = new FormData(event.currentTarget).get('stage');
              if (typeof stage !== 'string' || !stage) {
                notify.warning('Choose a stage first.');
                return;
              }
              const result = await changeLifecycle.run({ ids: selected, stage: stage as LifecycleStage });
              if (result) setStageChangeOpen(false);
            }}
          >
            <Field label="Lifecycle stage" htmlFor="lifecycle-stage" required>
              <Select
                id="lifecycle-stage"
                name="stage"
                placeholder="Select a stage"
                options={LIFECYCLE_STAGES.map((stage) => ({ value: stage, label: stage.replace(/_/g, ' ') }))}
              />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------- list furniture */

function ViewToggle({ value, onChange }: { value: 'table' | 'cards'; onChange: (value: 'table' | 'cards') => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-inset p-0.5" role="group" aria-label="View">
      {(['table', 'cards'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'rounded px-2 py-1 text-2xs font-medium capitalize transition-colors',
            value === option ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ViewPicker({
  views,
  activeId,
  onChange,
  ownerFilter,
  setOwnerFilter,
  ownerOptions,
  lifecycleFilter,
  setLifecycleFilter,
}: {
  views: Array<{ id: string; name: string; description: string }>;
  activeId: string;
  onChange: (id: string) => void;
  ownerFilter: string[];
  setOwnerFilter: (value: string[]) => void;
  ownerOptions: Array<{ value: string; label: string }>;
  lifecycleFilter: string[];
  setLifecycleFilter: (value: string[]) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-faint">Saved views</span>
      <ul className="flex flex-wrap items-center gap-1.5">
        {views.map((view) => (
          <li key={view.id}>
            <button
              type="button"
              onClick={() => onChange(view.id)}
              aria-pressed={view.id === activeId}
              className={cn(
                'rounded-full border px-2 py-0.5 text-2xs transition-colors',
                view.id === activeId
                  ? 'border-brand/40 bg-brand-subtle font-medium text-brand-fg'
                  : 'border-border-subtle bg-inset text-muted hover:border-border-strong hover:text-fg',
              )}
              title={view.description}
            >
              {view.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        <div className="w-44">
          <MultiSelect
            values={lifecycleFilter}
            onChange={setLifecycleFilter}
            placeholder="Lifecycle stage"
            options={LIFECYCLE_STAGES.map((stage) => ({ value: stage, label: stage.replace(/_/g, ' ') }))}
          />
        </div>
        <div className="w-44">
          <MultiSelect
            values={ownerFilter}
            onChange={setOwnerFilter}
            placeholder="Owner"
            options={ownerOptions}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

export function ContactDetail() {
  const services = useServices();
  const { contactId } = useParams<{ contactId: string }>();

  const contact = useAsync(() => services.contacts.get(contactId ?? ''), [contactId], { skip: !contactId });
  const account = useAsync(
    () => services.accounts.get(contact.data?.accountId ?? ''),
    [contact.data?.accountId],
    { skip: !contact.data?.accountId },
  );
  const timeline = useList(() => services.contacts.timeline(contactId ?? '', { pageSize: 20 }), [contactId], { skip: !contactId });
  const deals = useList(() => services.contacts.relatedDeals(contactId ?? ''), [contactId], { skip: !contactId });
  const tickets = useList(() => services.contacts.relatedTickets(contactId ?? ''), [contactId], { skip: !contactId });
  const committee = useList(
    () => services.accounts.contacts(contact.data?.accountId ?? '', { pageSize: 50 }),
    [contact.data?.accountId],
    { skip: !contact.data?.accountId },
  );

  const [noteOpen, setNoteOpen] = React.useState(false);
  const [consentChannel, setConsentChannel] = React.useState<ConsentChannel | null>(null);

  const addNote = useMutation(
    (body: string) =>
      services.activities.create({
        kind: 'note',
        subject: 'Note added',
        subjects: [{ type: 'contact', id: contactId ?? '', label: contact.data?.displayName ?? 'Contact' }],
        body,
        status: 'completed',
        priority: 'normal',
        ownerId: contact.data?.ownerId ?? '',
        ownerName: 'You',
        visibility: 'team',
        source: 'user',
        organizationId: contact.data?.organizationId ?? '',
      } as never),
    {
      successMessage: 'Note added to the timeline.',
      onSuccess: () => {
        setNoteOpen(false);
        timeline.reload();
      },
    },
  );

  const updateConsent = useMutation(
    (input: { channel: ConsentChannel; state: ConsentState }) =>
      services.contacts.updateConsent([contactId ?? ''], { channel: input.channel, state: input.state }),
    {
      successMessage: (_result, input) => `Consent for ${input.channel} recorded as ${CONSENT_LABEL[input.state].toLowerCase()}.`,
      onSuccess: () => {
        setConsentChannel(null);
        contact.reload();
      },
    },
  );

  if (contact.loading) return <ListSkeleton rows={10} columns={3} />;
  if (contact.error || !contact.data) {
    return (
      <div className="p-6">
        <EmptyState
          title="This contact could not be found"
          body={contact.error ?? 'They may have been archived or merged into another record.'}
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/contacts">Back to contacts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const record = contact.data;
  const emailState = emailConsentState(record);
  const missingConsent = CONSENT_CHANNELS.filter((channel) => !consentFor(record, channel));

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Contacts', to: '/app/contacts' }, { label: record.displayName }]}
        title={record.displayName}
        description={[record.jobTitle, record.accountName].filter(Boolean).join(' · ') || 'No account or title recorded'}
        backTo={{ to: '/app/contacts', label: 'Contacts' }}
        sample
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(true)}>
              Log a note
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to={`/app/contacts/${record.id}/edit`}>Edit</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {emailState !== 'granted' ? (
          <Alert
            tone={emailState === 'not_asked' ? 'info' : 'warning'}
            title={emailState === 'not_asked' ? 'Email consent has not been recorded' : `Email consent is ${CONSENT_LABEL[emailState].toLowerCase()}`}
          >
            {emailState === 'not_asked'
              ? 'Nobody has asked this contact to opt in. The interface will not treat silence as permission.'
              : 'Do not add this contact to a mailing list. Record a new consent decision only when one is genuinely given.'}
          </Alert>
        ) : null}

        <RecordHeader
          title={record.displayName}
          reference={record.reference}
          subtitle={record.description ?? 'No description recorded.'}
          badges={
            <>
              <TonePill tone={LIFECYCLE_TONE[record.lifecycleStage]}>{record.lifecycleStage.replace(/_/g, ' ')}</TonePill>
              {record.duplicateOfId ? <TonePill tone="amber">Possible duplicate</TonePill> : null}
            </>
          }
          facts={[
            {
              label: 'Account',
              value: record.accountName ? (
                <Link to={`/app/accounts/${record.accountId}`} className="text-link hover:underline">
                  {record.accountName}
                </Link>
              ) : (
                'No account'
              ),
            },
            { label: 'Job title', value: record.jobTitle ?? 'Not set' },
            { label: 'Department', value: record.department ?? 'Not set' },
            { label: 'Engagement', value: record.engagementScore !== undefined ? `${record.engagementScore}/100` : 'Not scored' },
            {
              label: 'Lifetime value',
              value: record.lifetimeValue ? formatMoney(record.lifetimeValue.amount, record.lifetimeValue.currency) : 'Not set',
            },
          ]}
          favourite={{ active: false, onToggle: () => notify.info('Favourites', 'Pinning records is not part of this demonstration.') }}
        />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline ({timeline.items.length})</TabsTrigger>
            <TabsTrigger value="records">Deals and tickets ({deals.items.length + tickets.items.length})</TabsTrigger>
            <TabsTrigger value="relationships">Relationships ({record.relationships.length})</TabsTrigger>
            <TabsTrigger value="consent">Consent</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Card className="p-4">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Channels</h2>
                <ul className="mt-3 space-y-2.5">
                  {record.emails.map((email) => (
                    <li key={email.value} className="flex items-center gap-2 text-xs">
                      <Mail className="size-3.5 text-subtle" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-fg">{email.value}</span>
                      {email.isPrimary ? <Badge variant="outline" size="sm">Primary</Badge> : null}
                      {email.consent ? <TonePill tone={CONSENT_TONE[email.consent.state]}>{CONSENT_LABEL[email.consent.state]}</TonePill> : null}
                    </li>
                  ))}
                  {record.phones.map((phone) => (
                    <li key={phone.value} className="flex items-center gap-2 text-xs">
                      <Phone className="size-3.5 text-subtle" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-fg">{phone.value}</span>
                      {phone.label ? <Badge variant="outline" size="sm">{phone.label}</Badge> : null}
                    </li>
                  ))}
                  {record.emails.length === 0 && record.phones.length === 0 ? (
                    <li className="text-xs text-muted">No channels recorded yet.</li>
                  ) : null}
                </ul>
                {record.preferredChannel ? (
                  <p className="mt-3 border-t border-border-subtle pt-3 text-[0.6875rem] text-muted">
                    Prefers to be contacted by {record.preferredChannel}.
                  </p>
                ) : null}
              </Card>

              <Card className="p-4">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Key dates</h2>
                <dl className="mt-3 space-y-2.5 text-xs">
                  <FactRow label="Last activity" value={formatDate(record.lastActivityAt, 'relative')} />
                  <FactRow label="Last email" value={formatDate(record.lastEmailAt, 'relative')} />
                  <FactRow label="Last meeting" value={formatDate(record.lastMeetingAt, 'relative')} />
                  <FactRow label="Birthday" value={formatDate(record.birthday, 'short')} />
                  <FactRow label="Timezone" value={record.timezone ?? 'Not set'} />
                  <FactRow label="Preferred language" value={record.preferredLanguage ?? 'Not set'} />
                </dl>
              </Card>

              {account.data ? (
                <Card className="p-4 lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold tracking-tight text-fg">Account</h2>
                    <Button variant="ghost" size="xs" asChild>
                      <Link to={`/app/accounts/${account.data.id}`}>Open Customer 360</Link>
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <Avatar name={account.data.name} size="md" tone="violet" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-fg">{account.data.name}</p>
                      <p className="text-[0.6875rem] text-muted">{account.data.industryLabel ?? 'Industry not set'}</p>
                    </div>
                    <div className="ms-auto flex items-center gap-2">
                      <StatusBadge status={account.data.health} />
                      <span className="text-xs tabular-nums text-muted">{account.data.healthScore ?? '—'}</span>
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="pt-4">
            <Card>
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Interaction history</h2>
                  <p className="mt-0.5 text-2xs text-muted">Calls, emails, meetings and notes recorded against this contact.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setNoteOpen(true)}>
                  Log a note
                </Button>
              </div>
              {timeline.loading ? (
                <ListSkeleton rows={5} columns={2} />
              ) : timeline.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">Nothing has been logged against this contact yet.</p>
              ) : (
                <ol className="divide-y divide-[var(--border-subtle)]">
                  {timeline.items.map((activity) => (
                    <li key={activity.id} className="flex items-start gap-3 px-4 py-3">
                      <Avatar name={activity.ownerName} size="xs" tone="violet" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-fg">{activity.subject}</span>
                          <Badge variant="outline" size="sm">{activity.kind.replace(/_/g, ' ')}</Badge>
                          {activity.source === 'automation' ? <DemoNotice tone="neutral">Automated</DemoNotice> : null}
                        </div>
                        {activity.body ? (
                          <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">{activity.body}</p>
                        ) : null}
                        <p className="mt-1 text-[0.625rem] text-faint">
                          {activity.ownerName} · {formatDate(activity.createdAt, 'relative')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="records" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <div className="border-b border-border-subtle px-4 py-3">
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Deals</h2>
                </div>
                {deals.loading ? (
                  <ListSkeleton rows={3} columns={2} />
                ) : deals.items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted">This contact is not the primary contact on any deal.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {deals.items.map((deal) => (
                      <li key={deal.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <Link to={`/app/deals/${deal.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                            {deal.name}
                          </Link>
                          <span className="text-[0.625rem] text-faint">{deal.reference}</span>
                        </div>
                        <StatusBadge status={deal.status} size="sm" />
                        <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(deal.amount.amount, deal.amount.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <div className="border-b border-border-subtle px-4 py-3">
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Tickets</h2>
                </div>
                {tickets.loading ? (
                  <ListSkeleton rows={3} columns={2} />
                ) : tickets.items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted">No support tickets are associated with this contact.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {tickets.items.map((ticket) => (
                      <li key={ticket.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-fg">{ticket.subject}</p>
                          <span className="text-[0.625rem] text-faint">{ticket.reference}</span>
                        </div>
                        <StatusBadge status={ticket.slaState ?? ticket.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="relationships" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <div className="border-b border-border-subtle px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                    <Network className="size-4 text-subtle" aria-hidden />
                    Relationship graph
                  </h2>
                  <p className="mt-0.5 text-2xs text-muted">
                    Who this contact reports to, influences and works alongside. Rendered as a list rather than a canvas so
                    every relationship is reachable by keyboard and readable by a screen reader.
                  </p>
                </div>
                {record.relationships.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted">No relationships have been recorded for this contact.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {record.relationships.map((relationship) => (
                      <RelationshipRow key={relationship.id} relationship={relationship} />
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <div className="border-b border-border-subtle px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                    <Users className="size-4 text-subtle" aria-hidden />
                    Others at {record.accountName ?? 'this account'}
                  </h2>
                </div>
                {committee.loading ? (
                  <ListSkeleton rows={4} columns={2} />
                ) : committee.items.filter((entry) => entry.id !== record.id).length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted">This is the only contact recorded at the account.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {committee.items
                      .filter((entry) => entry.id !== record.id)
                      .map((entry) => (
                        <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                          <Avatar name={entry.displayName} size="xs" tone="slate" />
                          <div className="min-w-0 flex-1">
                            <Link to={`/app/contacts/${entry.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                              {entry.displayName}
                            </Link>
                            <span className="text-[0.625rem] text-faint">{entry.jobTitle ?? 'Title not set'}</span>
                          </div>
                          <span className="text-[0.625rem] tabular-nums text-subtle">{entry.openDealCount} deals</span>
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="consent" className="pt-4">
            <Card>
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                  <ShieldCheck className="size-4 text-subtle" aria-hidden />
                  Consent per channel
                </h2>
                <p className="mt-0.5 text-2xs text-muted">
                  Consent is recorded per channel and never inferred. An unasked channel stays empty until someone records a
                  decision — silence is not permission.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">Consent state by channel</caption>
                  <thead>
                    <tr>
                      {['Channel', 'State', 'Jurisdiction', 'Captured', 'Recorded via', ''].map((heading, index) => (
                        <th
                          key={heading || index}
                          scope="col"
                          className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', index === 5 ? 'text-end' : 'text-start')}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CONSENT_CHANNELS.map((channel) => {
                      const entry = consentFor(record, channel);
                      return (
                        <tr key={channel} className="border-b border-border-subtle last:border-b-0">
                          <td className="px-3 py-2 capitalize text-fg">{channel}</td>
                          <td className="px-3 py-2">
                            {entry ? (
                              <TonePill tone={CONSENT_TONE[entry.state]}>{CONSENT_LABEL[entry.state]}</TonePill>
                            ) : (
                              <span className="text-subtle">Not asked</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted">{entry?.jurisdiction ?? '—'}</td>
                          <td className="px-3 py-2 text-muted">{entry?.capturedAt ? formatDate(entry.capturedAt, 'short') : '—'}</td>
                          <td className="px-3 py-2 text-muted">{entry?.capturedVia ?? '—'}</td>
                          <td className="px-3 py-2 text-end">
                            <Button variant="ghost" size="xs" onClick={() => setConsentChannel(channel)}>
                              Record decision
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {missingConsent.length > 0 ? (
                <p className="border-t border-border-subtle px-4 py-2.5 text-[0.6875rem] text-muted">
                  {missingConsent.length} {missingConsent.length === 1 ? 'channel has' : 'channels have'} no recorded decision:{' '}
                  {missingConsent.join(', ')}.
                </p>
              ) : null}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent
          title="Log a note"
          description={`Adds a plain note to ${record.displayName}'s timeline.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setNoteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="contact-note-form" loading={addNote.pending}>
                Add note
              </Button>
            </>
          }
        >
          <form
            id="contact-note-form"
            onSubmit={(event) => {
              event.preventDefault();
              const body = new FormData(event.currentTarget).get('body');
              if (typeof body !== 'string' || !body.trim()) {
                notify.warning('Write something first.');
                return;
              }
              void addNote.run(body.trim());
            }}
          >
            <Field label="Note" htmlFor="contact-note" required>
              <Textarea id="contact-note" name="body" rows={4} placeholder="What happened, and what is the next step?" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmConsentDialog
        channel={consentChannel}
        current={consentChannel ? consentFor(record, consentChannel) : undefined}
        pending={updateConsent.pending}
        onCancel={() => setConsentChannel(null)}
        onConfirm={(state) => {
          if (consentChannel) void updateConsent.run({ channel: consentChannel, state });
        }}
      />
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}

function RelationshipRow({ relationship }: { relationship: ContactRelationship }) {
  const target =
    relationship.targetType === 'account' ? (
      <Link to={`/app/accounts/${relationship.targetId}`} className="font-medium text-fg hover:text-link hover:underline">
        {relationship.targetLabel}
      </Link>
    ) : (
      <Link to={`/app/contacts/${relationship.targetId}`} className="font-medium text-fg hover:text-link hover:underline">
        {relationship.targetLabel}
      </Link>
    );
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <span className="text-[0.6875rem] text-muted">{RELATIONSHIP_LABEL[relationship.kind]}</span>
      <span className="text-faint" aria-hidden>→</span>
      {target}
      {relationship.strength ? (
        <TonePill tone={STRENGTH_TONE[relationship.strength] ?? 'neutral'}>{relationship.strength}</TonePill>
      ) : null}
      {relationship.note ? <span className="w-full text-[0.625rem] text-faint">{relationship.note}</span> : null}
    </li>
  );
}

function ConfirmConsentDialog({
  channel,
  current,
  pending,
  onCancel,
  onConfirm,
}: {
  channel: ConsentChannel | null;
  current: ConsentRecord | undefined;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (state: ConsentState) => void;
}) {
  const [state, setState] = React.useState<ConsentState>('granted');
  return (
    <Dialog open={channel !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        title={channel ? `Record consent for ${channel}` : 'Record consent'}
        description="This records the decision a person actually made. It does not ask for it."
        footer={
          <>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={() => onConfirm(state)}>
              Record decision
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {current ? (
            <p className="text-xs text-muted">
              Currently recorded as <strong className="text-fg">{CONSENT_LABEL[current.state]}</strong>
              {current.capturedAt ? ` on ${formatDate(current.capturedAt, 'short')}` : ''}.
            </p>
          ) : (
            <p className="text-xs text-muted">No decision has been recorded for this channel yet.</p>
          )}
          <Field label="New state" htmlFor="consent-state" required>
            <Select
              id="consent-state"
              value={state}
              onValueChange={(value) => setState(value as ConsentState)}
              options={(Object.keys(CONSENT_LABEL) as ConsentState[]).map((key) => ({ value: key, label: CONSENT_LABEL[key] }))}
            />
          </Field>
          <DemoNotice tone="neutral">
            Consent changes are stored in this browser only. No email, SMS or marketing platform is contacted.
          </DemoNotice>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- form */

const contactSchema = z.object({
  firstName: z.string().min(1, 'A first name is required.'),
  lastName: z.string(),
  jobTitle: z.string(),
  department: z.string(),
  accountId: z.string(),
  lifecycleStage: z.string(),
  email: z.string().refine((value) => value === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), 'Enter a valid email address or leave it blank.'),
  phone: z.string(),
  ownerId: z.string(),
  description: z.string(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const services = useServices();
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId: string }>();
  const isEdit = Boolean(contactId);

  const contact = useAsync(() => services.contacts.get(contactId ?? ''), [contactId], { skip: !isEdit });
  const accounts = useList(() => services.accounts.list({ pageSize: 200 }), []);
  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      jobTitle: '',
      department: '',
      accountId: '',
      lifecycleStage: 'lead',
      email: '',
      phone: '',
      ownerId: '',
      description: '',
    },
  });

  const currentAccountId = useWatch({ control, name: 'accountId' });
  const currentOwnerId = useWatch({ control, name: 'ownerId' });
  const currentStage = useWatch({ control, name: 'lifecycleStage' });

  // Seed the form once the record arrives. `reset` rather than per-field effects keeps the
  // form's dirty state honest.
  React.useEffect(() => {
    if (!isEdit || !contact.data) return;
    const record = contact.data;
    reset({
      firstName: record.firstName,
      lastName: record.lastName,
      jobTitle: record.jobTitle ?? '',
      department: record.department ?? '',
      accountId: record.accountId ?? '',
      lifecycleStage: record.lifecycleStage,
      email: primaryEmail(record) ?? '',
      phone: primaryPhone(record) ?? '',
      ownerId: record.ownerId,
      description: record.description ?? '',
    });
  }, [contact.data, isEdit, reset]);

  const save = useMutation(
    (values: ContactFormValues) => {
      const payload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        displayName: [values.firstName, values.lastName].filter(Boolean).join(' ').trim() || values.firstName,
        jobTitle: values.jobTitle.trim() || undefined,
        department: values.department.trim() || undefined,
        accountId: values.accountId || undefined,
        accountName: accounts.items.find((account) => account.id === values.accountId)?.name,
        lifecycleStage: values.lifecycleStage as LifecycleStage,
        ownerId: values.ownerId || undefined,
        description: values.description.trim() || undefined,
      } as unknown as Partial<Contact>;
      return isEdit
        ? services.contacts.update(contactId ?? '', payload)
        : services.contacts.create(payload as never);
    },
    {
      successMessage: isEdit ? 'Contact updated.' : 'Contact created.',
      onSuccess: (record) => navigate(`/app/contacts/${record.id}`),
    },
  );

  if (isEdit && contact.loading) return <ListSkeleton rows={8} columns={2} />;

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/app/home' },
          { label: 'Contacts', to: '/app/contacts' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        title={isEdit ? 'Edit contact' : 'New contact'}
        description={
          isEdit
            ? 'Update the details held about this person. Consent is recorded on the profile, not here.'
            : 'Create a contact directly. Converting a lead creates its contact and account together.'
        }
        backTo={{ to: isEdit ? `/app/contacts/${contactId}` : '/app/contacts', label: 'Contacts' }}
      />

      <form
        className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6"
        onSubmit={handleSubmit((values) => void save.run(values))}
      >
        {save.error ? <Alert tone="danger" title="The contact could not be saved">{save.error}</Alert> : null}

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Identity</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" required error={errors.firstName?.message}>
              <Input id="firstName" {...register('firstName')} aria-invalid={Boolean(errors.firstName)} />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
              <Input id="lastName" {...register('lastName')} />
            </Field>
            <Field label="Job title" htmlFor="jobTitle">
              <Input id="jobTitle" {...register('jobTitle')} />
            </Field>
            <Field label="Department" htmlFor="department">
              <Input id="department" {...register('department')} />
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Account and ownership</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Account" htmlFor="accountId" hint="Leave blank for an individual contact.">
              <Select
                id="accountId"
                value={currentAccountId}
                onValueChange={(value) => setValue('accountId', value, { shouldDirty: true })}
                searchable
                placeholder="No account"
                options={accounts.items.map((account) => ({ value: account.id, label: account.name }))}
              />
            </Field>
            <Field label="Owner" htmlFor="ownerId">
              <Select
                id="ownerId"
                value={currentOwnerId}
                onValueChange={(value) => setValue('ownerId', value, { shouldDirty: true })}
                searchable
                placeholder="Unassigned"
                options={(users.items ?? []).map((user) => ({ value: user.id, label: user.displayName }))}
              />
            </Field>
            <Field label="Lifecycle stage" htmlFor="lifecycleStage">
              <Select
                id="lifecycleStage"
                value={currentStage}
                onValueChange={(value) => setValue('lifecycleStage', value, { shouldDirty: true })}
                options={LIFECYCLE_STAGES.map((stage) => ({ value: stage, label: stage.replace(/_/g, ' ') }))}
              />
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Channels</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" {...register('email')} aria-invalid={Boolean(errors.email)} />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" type="tel" {...register('phone')} />
            </Field>
          </div>
          <Alert tone="info" className="mt-3">
            Adding a channel does not record consent for it. Consent is captured on the contact profile, where the channel and
            the decision are stored together.
          </Alert>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Notes</h2>
          <Field label="Description" htmlFor="description" className="mt-3">
            <Textarea id="description" rows={3} {...register('description')} placeholder="Anything worth remembering before the next conversation." />
          </Field>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" type="button" asChild>
            <Link to={isEdit ? `/app/contacts/${contactId}` : '/app/contacts'}>Cancel</Link>
          </Button>
          <Button variant="primary" type="submit" loading={isSubmitting || save.pending}>
            {isEdit ? 'Save changes' : 'Create contact'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------- duplicates */

/** The fields a reviewer may want to resolve, in the order they are compared. */
const MERGE_FIELDS: Array<{ key: string; label: string; read: (contact: Contact) => string }> = [
  { key: 'firstName', label: 'First name', read: (contact) => contact.firstName },
  { key: 'lastName', label: 'Last name', read: (contact) => contact.lastName },
  { key: 'displayName', label: 'Display name', read: (contact) => contact.displayName },
  { key: 'jobTitle', label: 'Job title', read: (contact) => contact.jobTitle ?? '' },
  { key: 'department', label: 'Department', read: (contact) => contact.department ?? '' },
  { key: 'accountName', label: 'Account', read: (contact) => contact.accountName ?? '' },
  { key: 'lifecycleStage', label: 'Lifecycle stage', read: (contact) => contact.lifecycleStage },
  { key: 'email', label: 'Primary email', read: (contact) => primaryEmail(contact) ?? '' },
  { key: 'phone', label: 'Primary phone', read: (contact) => primaryPhone(contact) ?? '' },
];

export function ContactDuplicates() {
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const reviewId = params.get('candidate');

  const candidates = useList(() => services.contacts.findDuplicates({}), []);

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Contacts', to: '/app/contacts' }, { label: 'Duplicates' }]}
        title="Duplicate review"
        description="Candidate pairs found by comparing names and accounts. A person decides which record to keep and which value wins for each field — nothing merges automatically."
        backTo={{ to: '/app/contacts', label: 'Contacts' }}
        sample
      />

      <div className="space-y-4 p-4 sm:p-6">
        <Alert tone="info" title="How matching works here">
          Candidates are grouped by last name and account. Real duplicate detection uses fuzzy matching across more fields; this
          demonstration keeps the rule simple and visible so you can see exactly why a pair was suggested.
        </Alert>

        {candidates.loading ? (
          <ListSkeleton rows={5} columns={3} />
        ) : candidates.items.length === 0 ? (
          <EmptyState
            title="No duplicate candidates"
            body="No two contacts in this organization share a last name and an account."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link to="/app/contacts">Back to contacts</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {candidates.items.map((candidate) => (
              <li key={candidate.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <Avatar name={candidate.recordA.label} size="sm" tone="teal" />
                        <p className="mt-1 max-w-[9rem] truncate text-[0.6875rem] font-medium text-fg" title={candidate.recordA.label}>
                          {candidate.recordA.label}
                        </p>
                        <p className="text-[0.625rem] text-faint">{candidate.recordA.subtitle ?? '—'}</p>
                      </div>
                      <div className="text-center">
                        <span className="inline-flex size-8 items-center justify-center rounded-full bg-inset text-2xs font-semibold text-muted">
                          {candidate.score}%
                        </span>
                        <p className="mt-1 text-[0.625rem] uppercase tracking-wide text-faint">match</p>
                      </div>
                      <div className="text-center">
                        <Avatar name={candidate.recordB.label} size="sm" tone="violet" />
                        <p className="mt-1 max-w-[9rem] truncate text-[0.6875rem] font-medium text-fg" title={candidate.recordB.label}>
                          {candidate.recordB.label}
                        </p>
                        <p className="text-[0.625rem] text-faint">{candidate.recordB.subtitle ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setParams({ candidate: candidate.id }, { replace: true })}>
                        <GitMerge className="size-3.5" aria-hidden />
                        Review and merge
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
                    {candidate.matchedOn.map((match) => (
                      <li key={match.field}>
                        <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-inset px-2 py-0.5 text-2xs text-muted">
                          <span className="font-medium text-fg">{match.field}</span>
                          <span aria-hidden>·</span>
                          left &ldquo;{match.valueA}&rdquo; right &ldquo;{match.valueB}&rdquo;
                        </span>
                      </li>
                    ))}
                    <li className="text-2xs text-faint">Detected {formatDate(candidate.detectedAt, 'relative')}</li>
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reviewId ? (
        <MergeDialog
          candidate={candidates.items.find((entry) => entry.id === reviewId)}
          onClose={() => setParams({}, { replace: true })}
          onMerged={() => {
            setParams({}, { replace: true });
            candidates.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function MergeDialog({
  candidate,
  onClose,
  onMerged,
}: {
  candidate: { recordA: { id: string; label: string }; recordB: { id: string; label: string } } | undefined;
  onClose: () => void;
  onMerged: () => void;
}) {
  const services = useServices();
  const left = useAsync(() => services.contacts.get(candidate?.recordA.id ?? ''), [candidate?.recordA.id], { skip: !candidate });
  const right = useAsync(() => services.contacts.get(candidate?.recordB.id ?? ''), [candidate?.recordB.id], { skip: !candidate });
  const [choices, setChoices] = React.useState<Record<string, 'left' | 'right'>>({});
  const [keepAllEmails, setKeepAllEmails] = React.useState(true);

  const merge = useMutation<void, Contact>(
    async () => {
      const primary = left.data;
      const secondary = right.data;
      if (!primary || !secondary) throw new Error('Both records must load before merging.');

      // Field-level resolution: the chosen value is written to the record being kept, then the
      // other record is removed. Two explicit steps rather than a hidden "smart merge".
      const patch: Record<string, unknown> = {};
      const resolvers: Record<string, string> = {};
      for (const field of MERGE_FIELDS) {
        const keepRight = choices[field.key] === 'right';
        resolvers[field.key] = keepRight ? secondary.id : primary.id;
        if (!keepRight) continue;
        if (field.key === 'email') {
          const email = primaryEmail(secondary);
          if (email) patch['emails'] = [{ id: `em-${primary.id}`, label: 'Work', value: email, isPrimary: true }];
        } else if (field.key === 'phone') {
          const phone = primaryPhone(secondary);
          if (phone) patch['phones'] = [{ id: `ph-${primary.id}`, label: 'Work', value: phone, isPrimary: true }];
        } else {
          patch[field.key] = (secondary as unknown as Record<string, unknown>)[field.key];
        }
      }
      if (keepAllEmails) {
        const merged = [...primary.emails];
        for (const email of secondary.emails) {
          if (!merged.some((entry) => entry.value === email.value)) merged.push(email);
        }
        patch['emails'] = merged;
      }

      const updated = await services.contacts.update(primary.id, patch as never);
      if (!updated.ok) return updated;
      return services.contacts.merge(primary.id, [secondary.id], resolvers);
    },
    {
      successMessage: 'Records merged.',
      onSuccess: () => onMerged(),
    },
  );

  if (!candidate) return null;

  const ready = left.data && right.data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Review and merge"
        size="lg"
        description="Choose which record to keep and, field by field, which value wins. The record on the left is kept."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={merge.pending}
              disabled={!ready}
              onClick={() => void merge.run(undefined as never)}
            >
              Merge records
            </Button>
          </>
        }
      >
        {!ready ? (
          <ListSkeleton rows={6} columns={3} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-xs font-semibold">
              <div className="rounded-md border border-brand/30 bg-brand-subtle px-3 py-2 text-brand-fg">
                Keep: {left.data!.displayName}
                <span className="mt-0.5 block font-mono text-[0.625rem] text-subtle">{left.data!.reference}</span>
              </div>
              <span className="text-faint" aria-hidden>←→</span>
              <div className="rounded-md border border-border-subtle bg-inset px-3 py-2 text-muted">
                Remove: {right.data!.displayName}
                <span className="mt-0.5 block font-mono text-[0.625rem] text-faint">{right.data!.reference}</span>
              </div>
            </div>

            <fieldset>
              <legend className="sr-only">Field-by-field resolution</legend>
              <div className="overflow-x-auto rounded-lg border border-border-subtle">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">Choose the value to keep for each field</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-start text-2xs font-semibold text-muted">Field</th>
                      <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-start text-2xs font-semibold text-muted">Keep (left)</th>
                      <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-start text-2xs font-semibold text-muted">Remove (right)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MERGE_FIELDS.map((field) => {
                      const leftValue = field.read(left.data!);
                      const rightValue = field.read(right.data!);
                      const differs = leftValue !== rightValue;
                      const choice = choices[field.key] ?? 'left';
                      return (
                        <tr key={field.key} className="border-b border-border-subtle last:border-b-0">
                          <th scope="row" className="px-3 py-2 text-start font-medium text-fg">
                            {field.label}
                            {differs ? <span className="ms-1.5 text-2xs font-normal text-warning-fg">differs</span> : null}
                          </th>
                          {(['left', 'right'] as const).map((side) => {
                            const value = side === 'left' ? leftValue : rightValue;
                            const selected = choice === side;
                            return (
                              <td key={side} className="px-3 py-2">
                                <label
                                  className={cn(
                                    'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1',
                                    selected ? 'border-brand/40 bg-brand-subtle' : 'border-transparent hover:bg-hover',
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name={`merge-${field.key}`}
                                    checked={selected}
                                    onChange={() => setChoices((current) => ({ ...current, [field.key]: side }))}
                                    className="accent-[var(--brand)]"
                                  />
                                  <span className={cn('truncate', value ? 'text-fg' : 'text-faint italic')}>{value || 'empty'}</span>
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-xs text-fg">
              <Checkbox checked={keepAllEmails} onCheckedChange={(checked) => setKeepAllEmails(checked === true)} className="mt-0.5" />
              <span>
                Keep every email address from both records
                <span className="mt-0.5 block text-[0.6875rem] text-muted">
                  {left.data!.emails.length} on the kept record and {right.data!.emails.length} on the record being removed.
                </span>
              </span>
            </label>

            <DemoNotice tone="warning">
              This demonstration writes the chosen values to the kept record and then removes the duplicate from the directory.
              Re-pointing related deals, tickets and activities to the surviving record is a backend operation that this
              demonstration does not perform.
            </DemoNotice>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
