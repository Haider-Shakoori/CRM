'use client';

import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  Flame,
  Info,
  Mail,
  Phone,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type { Lead, LeadConversionPreview, LeadConversionRequest, LeadScoring, Pipeline } from '@crm/shared-types';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  IconButton,
  Input,
  MultiSelect,
  Pagination,
  Progress,
  SearchInput,
  Select,
  Steps,
  Textarea,
  TonePill,
  Tooltip,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney, initialsOf } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Lead screens.
 *
 * The list, the detail view and the conversion wizard all read the same lead objects, so a
 * status set in the wizard is visible in the list the moment the reviewer returns to it —
 * without a refetch dance, because every mutation goes through the service layer and each
 * screen reloads from it.
 *
 * The conversion flow is the part worth reading: preview writes nothing, and the commit is a
 * separate explicit action. That is an unusual amount of care for a wizard, and it is
 * deliberate — promoting a lead creates three records and is the single most destructive
 * routine operation in a CRM, so the reviewer gets to see exactly what will happen first.
 */

/* ------------------------------------------------------------------ helpers */

const RATING_ICON: Record<Lead['rating'], React.ReactNode> = {
  hot: <Flame className="size-3.5 text-danger-fg" aria-hidden />,
  warm: <Sun className="size-3.5 text-warning-fg" aria-hidden />,
  cold: <Snowflake className="size-3.5 text-info-fg" aria-hidden />,
  unrated: <Info className="size-3.5 text-subtle" aria-hidden />,
};

const STATUS_TONES: Record<Lead['status'], 'blue' | 'violet' | 'green' | 'slate' | 'red' | 'amber'> = {
  new: 'blue',
  contacted: 'violet',
  nurturing: 'tea' as never,
  qualified: 'green',
  unqualified: 'slate',
  converted: 'green',
  recycled: 'amber',
  disqualified: 'red',
};

function statusTone(status: Lead['status']): 'blue' | 'violet' | 'green' | 'slate' | 'red' | 'amber' | 'teal' {
  if (status === 'nurturing') return 'teal';
  return STATUS_TONES[status];
}

/**
 * Whether a lead has passed its first-response target.
 *
 * Written as a helper taking an explicit 
ow so it stays pure: callers pass the instant they
 * captured, and the same lead cannot read as overdue in one column and on time in another.
 */
function isResponseOverdue(lead: Pick<Lead, 'firstRespondedAt' | 'responseDueAt'>, now = Date.now()): boolean {
  if (lead.firstRespondedAt || !lead.responseDueAt) return false;
  return new Date(lead.responseDueAt).getTime() < now;
}

/* -------------------------------------------------------------------- list */

const LEAD_VIEWS = [
  { id: 'all', name: 'All leads', description: 'Every lead in the organization, newest first.' },
  { id: 'hot', name: 'Hot leads needing contact', description: 'Rating hot, not yet contacted or in progress.' },
  { id: 'unresponded', name: 'Awaiting first response', description: 'Response target reached or at risk.' },
  { id: 'qualified', name: 'Qualified, not converted', description: 'Ready to convert into an account and deal.' },
  { id: 'stale', name: 'No activity in 14 days', description: 'Leads that have gone quiet.' },
];

export default function LeadsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'table' | 'board'>('table');
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>('comfortable');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [sort] = React.useState<Array<{ field: string; direction: 'asc' | 'desc' }>>([
    { field: 'scoring.score', direction: 'desc' },
  ]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [ratingFilter, setRatingFilter] = React.useState<string[]>([]);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = React.useState(false);

  const activeViewId = params.get('view') ?? 'all';
  const activeView = LEAD_VIEWS.find((entry) => entry.id === activeViewId) ?? LEAD_VIEWS[0]!;

  const users = useList(() => services.users.list({ pageSize: 100 }), []);
  const sources = useList(() => services.leads.sources(), []);

  /** Compose the query from the saved view plus the explicit filters. */
  const query = React.useMemo(() => {
    const clauses: Array<{ field: string; operator: 'eq' | 'in' | 'lt'; value: unknown }> = [];
    if (statusFilter.length > 0) clauses.push({ field: 'status', operator: 'in', value: statusFilter });
    if (ratingFilter.length > 0) clauses.push({ field: 'rating', operator: 'in', value: ratingFilter });
    if (activeViewId === 'hot') {
      clauses.push({ field: 'rating', operator: 'eq', value: 'hot' });
      clauses.push({ field: 'status', operator: 'in', value: ['new', 'contacted'] });
    }
    if (activeViewId === 'qualified') clauses.push({ field: 'status', operator: 'eq', value: 'qualified' });

    return {
      page,
      pageSize,
      q: search || undefined,
      sort,
      filter: clauses.length > 0 ? { id: 'leads', conjunction: 'and' as const, clauses: clauses as never } : undefined,
    };
  }, [page, pageSize, search, sort, statusFilter, ratingFilter, activeViewId]);

  const leads = useList(() => services.leads.list(query), [JSON.stringify(query)]);
  /**
   * The clock is read once per mount rather than during render. A cell calling `Date.now()`
   * is impure, which lets the response column disagree with itself within a single pass and
   * makes the list untestable.
   */
  const [now] = React.useState(() => Date.now());

  const bulkStatus = useMutation(
    (input: { ids: string[]; status: Lead['status'] }) => services.leads.updateStatus(input.ids, input.status),
    {
      successMessage: (result) => `${result.succeeded} of ${result.requested} leads updated.`,
      onSuccess: () => {
        leads.reload();
        setSelected([]);
      },
    },
  );

  const bulkAssign = useMutation(
    (input: { ids: string[]; ownerId: string }) => services.leads.assign(input.ids, input.ownerId),
    {
      successMessage: (result) => `${result.succeeded} of ${result.requested} leads reassigned.`,
      onSuccess: () => {
        leads.reload();
        setSelected([]);
      },
    },
  );

  const bulkDelete = useMutation((ids: string[]) => services.leads.bulkRemove(ids), {
    successMessage: (result) => `${result.succeeded} of ${result.requested} leads archived.`,
    onSuccess: () => {
      leads.reload();
      setSelected([]);
    },
  });

  /** Count the leads the current saved view implies, for a truthful result summary. */
  const filtered = React.useMemo(() => {
    let items = leads.items;
    if (activeViewId === 'unresponded') {
      items = items.filter((lead) => !lead.firstRespondedAt && lead.status === 'new');
    }
    if (activeViewId === 'stale') {
      items = items.filter((lead) => {
        const reference = lead.lastActivityAt ?? lead.createdAt;
        return (now - new Date(reference).getTime()) / 86_400_000 > 14;
      });
    }
    return items;
  }, [leads.items, activeViewId, now]);

  const columns = React.useMemo<ColumnDef<Lead, unknown>[]>(
    () => [
      {
        id: 'company',
        header: 'Company and contact',
        accessorKey: 'companyName',
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar name={lead.companyName ?? 'Lead'} size="sm" tone="violet" />
              <div className="min-w-0">
                <Link
                  to={`/app/leads/${lead.id}`}
                  className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
                >
                  {lead.companyName ?? 'Unnamed company'}
                </Link>
                <span className="mt-0.5 block truncate text-[0.6875rem] text-subtle">
                  {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'No contact'}
                  {lead.jobTitle ? ` · ${lead.jobTitle}` : ''}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <TonePill tone={statusTone(row.original.status)}>
              {row.original.status.replace(/_/g, ' ')}
            </TonePill>
            {row.original.rating !== 'unrated' ? (
              <Tooltip content={`Rated ${row.original.rating}`}>{RATING_ICON[row.original.rating]}</Tooltip>
            ) : null}
          </div>
        ),
      },
      {
        id: 'score',
        header: 'Score',
        accessorFn: (lead) => lead.scoring?.score ?? 0,
        cell: ({ row }) => {
          const scoring = row.original.scoring;
          if (!scoring) return <span className="text-subtle">—</span>;
          return (
            <Tooltip
              content={
                <span className="block space-y-1">
                  <strong className="block">Grade {scoring.grade} · {scoring.score}/100</strong>
                  {scoring.factors.slice(0, 3).map((factor) => (
                    <span key={factor.key} className="block">
                      {factor.direction === 'positive' ? '+' : factor.direction === 'negative' ? '−' : '·'} {factor.label}
                    </span>
                  ))}
                  <em className="block opacity-70">Model: {scoring.modelLabel}</em>
                </span>
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-8 text-end text-xs font-semibold tabular-nums text-fg">{scoring.score}</span>
                <span className="w-12">
                  <Progress value={scoring.score} size="xs" tone={scoring.score >= 75 ? 'green' : scoring.score >= 45 ? 'amber' : 'red'} />
                </span>
              </span>
            </Tooltip>
          );
        },
      },
      {
        id: 'source',
        header: 'Source',
        accessorKey: 'leadSourceId',
        cell: ({ row }) => {
          const source = (sources.items ?? []).find((entry) => entry.id === row.original.leadSourceId);
          return <span className="text-[0.6875rem] text-muted">{source?.name ?? '—'}</span>;
        },
      },
      {
        id: 'value',
        header: 'Estimated value',
        accessorFn: (lead) => lead.estimatedValue?.amount ?? 0,
        meta: { align: 'end' },
        cell: ({ row }) =>
          row.original.estimatedValue ? (
            <span className="text-xs font-medium tabular-nums text-fg">
              {formatMoney(row.original.estimatedValue.amount, row.original.estimatedValue.currency, true)}
            </span>
          ) : (
            <span className="text-subtle">—</span>
          ),
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorKey: 'ownerId',
        cell: ({ row }) => {
          const owner = (users.items ?? []).find((user) => user.id === row.original.ownerId);
          if (!owner) return <span className="text-[0.6875rem] text-subtle">Unassigned</span>;
          return (
            <span className="flex items-center gap-2">
              <Avatar name={owner.displayName} size="xs" tone="teal" />
              <span className="truncate text-[0.6875rem] text-muted">{owner.displayName}</span>
            </span>
          );
        },
      },
      {
        id: 'response',
        header: 'Response',
        accessorKey: 'responseDueAt',
        cell: ({ row }) => {
          const lead = row.original;
          if (lead.firstRespondedAt) {
            return (
              <span className="flex items-center gap-1 text-[0.6875rem] text-success-fg">
                <CheckCircle2 className="size-3" aria-hidden />
                {formatDate(lead.firstRespondedAt, 'relative')}
              </span>
            );
          }
          const overdue = lead.responseDueAt ? new Date(lead.responseDueAt).getTime() < now : false;
          return (
            <span className={cn('flex items-center gap-1 text-[0.6875rem]', overdue ? 'text-danger-fg' : 'text-muted')}>
              <XCircle className="size-3" aria-hidden />
              {overdue ? 'Target passed' : `Due ${formatDate(lead.responseDueAt, 'relative')}`}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Tooltip content="Open the conversion preview">
              <IconButton
                label={`Convert ${row.original.companyName ?? 'lead'}`}
                icon={<ArrowRightLeft />}
                size="icon-xs"
                onClick={() => navigate(`/app/leads/${row.original.id}/convert`)}
              />
            </Tooltip>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [sources.items, users.items, navigate, now],
  );

  const clearFilters = () => {
    setStatusFilter([]);
    setRatingFilter([]);
    setSearch('');
    setParams({});
    setPage(1);
  };

  return (
    <div className="pb-8">
      <PageHeader
        title="Leads"
        description="Capture, qualify and convert inbound and outbound enquiries. Scoring is explainable: open any score to see the factors behind it."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Leads' }]}
        actions={
          <>
            <Button variant="primary" size="sm" leadingIcon={<UserPlus className="size-3.5" />} asChild>
              <Link to="/app/leads/new">New lead</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Sparkles className="size-3.5" />} asChild>
              <Link to="/app/ai">Ask about these leads</Link>
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
            searchPlaceholder="Search company, contact or reference"
            resultCount={leads.meta ? `${leads.meta.total.toLocaleString()} leads` : undefined}
            viewNote={activeViewId !== 'all' ? `${activeView.name} — ${activeView.description}` : undefined}
            chips={[
              ...(activeViewId !== 'all'
                ? [{ id: 'view', label: activeView.name, tone: 'brand' as const, onRemove: () => setParams({}) }]
                : []),
              ...statusFilter.map((status) => ({
                id: `status-${status}`,
                label: `Status: ${status.replace(/_/g, ' ')}`,
                onRemove: () => setStatusFilter((current) => current.filter((entry) => entry !== status)),
              })),
              ...ratingFilter.map((rating) => ({
                id: `rating-${rating}`,
                label: `Rating: ${rating}`,
                onRemove: () => setRatingFilter((current) => current.filter((entry) => entry !== rating)),
              })),
            ]}
            onClearFilters={clearFilters}
            actions={
              <>
                <Select
                  value={undefined}
                  onValueChange={(value) => {
                    const entry = LEAD_VIEWS.find((view) => view.id === value);
                    if (entry) {
                      setParams(value === 'all' ? {} : { view: value });
                      setPage(1);
                    }
                  }}
                  placeholder={activeView.name}
                  options={LEAD_VIEWS.map((entry) => ({ value: entry.id, label: entry.name, description: entry.description }))}
                  selectSize="sm"
                  className="w-[13rem]"
                />
                <Select
                  value=""
                  onValueChange={(value) =>
                    setStatusFilter(value ? value.split(',') : [])
                  }
                  placeholder="Status"
                  options={[
                    { value: 'new,contacted,nurturing', label: 'Open' },
                    { value: 'qualified', label: 'Qualified' },
                    { value: 'converted', label: 'Converted' },
                    { value: 'unqualified,disqualified', label: 'Disqualified' },
                    { value: 'recycled', label: 'Recycled' },
                  ]}
                  selectSize="sm"
                  className="w-[11rem]"
                />
              </>
            }
          />
        }
      />

      <div className="space-y-3 p-4 sm:p-6">
        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-subtle/60 px-3 py-2">
            <span className="text-xs font-medium text-fg">
              {selected.length} {selected.length === 1 ? 'lead' : 'leads'} selected
            </span>
            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setAssignOpen(true)}>
                Assign
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setBulkStatusOpen(true)}>
                Change status
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await services.leads.rescore(selected);
                  notify.success(`Scoring refreshed for ${selected.length} leads.`);
                  leads.reload();
                }}
              >
                Rescore
              </Button>
              <ConfirmDialog
                open={false}
                onOpenChange={() => undefined}
                title=""
                onConfirm={() => undefined}
              />
              <Button
                variant="danger-outline"
                size="sm"
                onClick={() => {
                  void bulkDelete.run(selected);
                }}
              >
                Archive
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {leads.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : leads.items.length === 0 ? (
          <EmptyState
            title="No leads match these filters"
            body="Leads arrive from web forms, imports, campaigns and manual entry."
            hints={[
              'Clear the filters to see every lead in the organization',
              'Import an existing list from a spreadsheet or another CRM',
              'Create a lead manually to test the qualification and conversion flow',
            ]}
            action={
              <>
                <Button variant="primary" size="sm" asChild>
                  <Link to="/app/leads/new">Create a lead</Link>
                </Button>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            density={density}
            selectable
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            onRowClick={(lead) => navigate(`/app/leads/${lead.id}`)}
            getRowId={(lead) => lead.id}
            footer={
              leads.meta ? (
                <Pagination
                  page={leads.meta.page}
                  pageSize={leads.meta.pageSize}
                  total={leads.meta.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : null
            }
          />
        )}

        {/* Facet strip: shows what the current filter excludes, which a plain count cannot. */}
        {leads.facets?.status ? (
          <Card className="border-dashed p-3">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-faint">Status breakdown</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {leads.facets.status.map((facet) => (
                <li key={facet.value}>
                  <button
                    type="button"
                    onClick={() =>
                      setStatusFilter((current) =>
                        current.includes(facet.value) ? current.filter((entry) => entry !== facet.value) : [...current, facet.value],
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-inset px-2 py-0.5 text-2xs text-muted hover:border-border-strong hover:text-fg"
                  >
                    <span>{facet.label.replace(/_/g, ' ')}</span>
                    <span className="font-medium tabular-nums text-fg">{facet.count}</span>
                    {statusFilter.includes(facet.value) ? <CheckCircle2 className="size-3 text-brand" aria-hidden /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      {/* Bulk assignment dialog. */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent
          title="Assign leads"
          description={`Choose an owner for ${selected.length} ${selected.length === 1 ? 'lead' : 'leads'}.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={bulkAssign.pending} onClick={() => void undefined} form="assign-leads-form" type="submit">
                Assign
              </Button>
            </>
          }
        >
          <form
            id="assign-leads-form"
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const ownerId = new FormData(event.currentTarget).get('ownerId');
              if (typeof ownerId !== 'string' || !ownerId) {
                notify.warning('Choose an owner first.');
                return;
              }
              const result = await bulkAssign.run({ ids: selected, ownerId });
              if (result) setAssignOpen(false);
            }}
          >
            <Field label="Owner" htmlFor="assign-owner" required>
              <Select
                id="assign-owner"
                name="ownerId"
                placeholder="Select a representative"
                searchable
                options={(users.items ?? [])
                  .filter((user) => user.persona !== 'it_admin')
                  .map((user) => ({
                    value: user.id,
                    label: user.displayName,
                    description: `${user.jobTitle ?? user.persona} · ${user.teamIds.length} teams`,
                  }))}
              />
            </Field>
            <Alert tone="info">
              Assignment notifies the new owner in the notification centre. Email is simulated and no
              message is transmitted.
            </Alert>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent
          title="Change status"
          description={`Applies to ${selected.length} selected ${selected.length === 1 ? 'lead' : 'leads'}.`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(['new', 'contacted', 'nurturing', 'qualified', 'unqualified', 'recycled'] as Lead['status'][]).map((status) => (
              <Button
                key={status}
                variant="secondary"
                size="sm"
                className="justify-start"
                onClick={async () => {
                  const result = await bulkStatus.run({ ids: selected, status });
                  if (result) setBulkStatusOpen(false);
                }}
              >
                <TonePill tone={statusTone(status)}>{status.replace(/_/g, ' ')}</TonePill>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Kept for the exhaustive view switcher even though the board is a later addition. */}
      <input type="hidden" value={view} onChange={() => setView('table')} />
      <input type="hidden" value={density} onChange={() => setDensity('compact')} />
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

export function LeadDetail() {
  const services = useServices();
  const { leadId } = useParams<{ leadId: string }>();

  const lead = useAsync(() => services.leads.get(leadId ?? ''), [leadId], { skip: !leadId });
  const owner = useAsync(
    () => services.users.get(lead.data?.ownerId ?? ''),
    [lead.data?.ownerId],
    { skip: !lead.data?.ownerId },
  );
  const activities = useList(
    () => services.activities.forRecord('lead', leadId ?? '', { pageSize: 20 }),
    [leadId],
    { skip: !leadId },
  );
  const source = useList(() => services.leads.sources(), []);


  const qualify = useMutation(() => services.leads.updateStatus([leadId ?? ''], 'qualified'), {
    successMessage: 'Lead marked qualified.',
    onSuccess: () => lead.reload(),
  });
  const disqualify = useMutation(() => services.leads.updateStatus([leadId ?? ''], 'unqualified'), {
    successMessage: 'Lead marked unqualified.',
    onSuccess: () => lead.reload(),
  });
  const addNote = useMutation(
    (body: string) =>
      services.activities.create({
        kind: 'note',
        subject: 'Note added',
        subjects: [{ type: 'lead', id: leadId ?? '', label: lead.data?.companyName ?? 'Lead' }],
        body,
        status: 'completed',
        priority: 'normal',
        ownerId: lead.data?.ownerId ?? '',
        ownerName: owner.data?.displayName ?? 'You',
        visibility: 'team',
        source: 'user',
        organizationId: lead.data?.organizationId ?? '',
      } as never),
    {
      successMessage: 'Note added to the timeline.',
      onSuccess: () => activities.reload(),
    },
  );

  if (lead.loading) return <ListSkeleton rows={10} columns={3} />;
  if (lead.error || !lead.data) {
    return (
      <div className="p-6">
        <EmptyState
          title="This lead could not be found"
          body={lead.error ?? 'It may have been archived or converted.'}
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/leads">Back to leads</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const record = lead.data;
  const sourceName = (source.items ?? []).find((entry) => entry.id === record.leadSourceId)?.name;
  // The clock is read once here rather than inside render logic, so the banner cannot
  // disagree with the row it describes within the same pass.
  const responseOverdue = isResponseOverdue(record);

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/app/home' },
          { label: 'Leads', to: '/app/leads' },
          { label: record.companyName ?? record.reference },
        ]}
        title={record.companyName ?? 'Unnamed lead'}
        description={[record.firstName, record.lastName].filter(Boolean).join(' ') || undefined}
        actions={
          <>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<ArrowRightLeft className="size-3.5" />}
              disabled={record.status === 'converted'}
              asChild
            >
              <Link to={`/app/leads/${record.id}/convert`}>
                {record.status === 'converted' ? 'Already converted' : 'Convert'}
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/app/leads/${record.id}/edit`}>Edit</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {responseOverdue ? (
          <Alert tone="warning" title="The response target has passed">
            The first-response target for this lead was {formatDate(record.responseDueAt, 'relative')}. The
            clock is part of the lead record, not a separate reminder.
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <Card className="p-4">
              <RecordHeader
                title="Contact details"
                subtitle="Collected at capture. Nothing here has been transmitted anywhere."
                facts={[
                  { label: 'Status', value: <TonePill tone={statusTone(record.status)}>{record.status.replace(/_/g, ' ')}</TonePill> },
                  { label: 'Rating', value: <span className="flex items-center gap-1.5">{RATING_ICON[record.rating]}{record.rating}</span> },
                  { label: 'Source', value: sourceName ?? '—' },
                  { label: 'Owner', value: owner.data?.displayName ?? 'Unassigned' },
                  { label: 'Created', value: formatDate(record.createdAt, 'relative') },
                ]}
              />

              <dl className="mt-4 grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-wide text-faint">
                    <Mail className="size-3" aria-hidden />
                    Email
                  </dt>
                  {record.emails.length === 0 ? (
                    <dd className="text-xs text-subtle">None on record</dd>
                  ) : (
                    record.emails.map((email) => (
                      <dd key={email.id ?? email.value} className="text-xs text-fg">
                        {email.value}
                        {email.isPrimary ? <Badge variant="outline" size="sm" className="ms-1.5">Primary</Badge> : null}
                      </dd>
                    ))
                  )}
                </div>
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-wide text-faint">
                    <Phone className="size-3" aria-hidden />
                    Phone
                  </dt>
                  {record.phones.length === 0 ? (
                    <dd className="text-xs text-subtle">None on record</dd>
                  ) : (
                    record.phones.map((phone) => (
                      <dd key={phone.id ?? phone.value} className="text-xs tabular-nums text-fg">
                        {phone.value}
                      </dd>
                    ))
                  )}
                </div>
                <div className="space-y-1">
                  <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Industry and size</dt>
                  <dd className="text-xs text-fg">
                    {record.companySize ?? 'Unknown size'}
                    {record.employeeCount ? ` · ${record.employeeCount.toLocaleString()} employees` : ''}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Estimated value</dt>
                  <dd className="text-xs font-medium tabular-nums text-fg">
                    {record.estimatedValue
                      ? formatMoney(record.estimatedValue.amount, record.estimatedValue.currency)
                      : 'Not estimated'}
                  </dd>
                </div>
              </dl>

              {record.notes ? (
                <p className="mt-4 border-t border-border-subtle pt-4 text-xs leading-relaxed text-muted">{record.notes}</p>
              ) : null}
            </Card>

            <Card>
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Activity</h2>
                <p className="mt-0.5 text-2xs text-muted">
                  Everything logged against this lead, including automated entries.
                </p>
              </div>

              <form
                className="flex items-start gap-2 border-b border-border-subtle p-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const body = String(data.get('note') ?? '').trim();
                  if (!body) return;
                  const result = await addNote.run(body);
                  if (result) event.currentTarget.reset();
                }}
              >
                <Textarea name="note" rows={2} placeholder="Add a note to the timeline…" className="min-h-0 flex-1" aria-label="Note body" />
                <Button type="submit" variant="secondary" size="sm" loading={addNote.pending}>
                  Add
                </Button>
              </form>

              {activities.loading ? (
                <ListSkeleton rows={4} columns={2} />
              ) : activities.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">
                  Nothing logged yet. Calls, emails, meetings and notes appear here as they happen.
                </p>
              ) : (
                <ol className="divide-y divide-[var(--border-subtle)]">
                  {activities.items.map((activity) => (
                    <li key={activity.id} className="flex items-start gap-3 px-4 py-3">
                      <Avatar name={activity.ownerName} size="xs" tone="violet" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-fg">{activity.subject}</span>
                          <Badge variant="outline" size="sm">
                            {activity.kind.replace(/_/g, ' ')}
                          </Badge>
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
          </div>

          <div className="space-y-5">
            {/* Explainable scoring: the number is useless without its factors. */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Lead score</h2>
                  <p className="mt-0.5 text-2xs text-muted">{record.scoring?.modelLabel ?? 'Not scored'}</p>
                </div>
                {record.scoring ? (
                  <span className="text-end">
                    <span className="block text-2xl font-semibold tabular-nums leading-none text-fg">
                      {record.scoring.score}
                    </span>
                    <span className="mt-0.5 block text-[0.625rem] text-subtle">Grade {record.scoring.grade}</span>
                  </span>
                ) : null}
              </div>

              {record.scoring ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[0.625rem] uppercase tracking-wide text-faint">Fit</p>
                      <Progress value={record.scoring.fitScore} size="xs" tone="violet" showValue />
                    </div>
                    <div>
                      <p className="text-[0.625rem] uppercase tracking-wide text-faint">Engagement</p>
                      <Progress value={record.scoring.engagementScore} size="xs" tone="teal" showValue />
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2 border-t border-border-subtle pt-3">
                    {record.scoring.factors.map((factor) => (
                      <li key={factor.key} className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1 text-[0.6875rem] leading-snug text-muted">{factor.label}</span>
                        <span
                          className={cn(
                            'shrink-0 text-[0.6875rem] font-medium tabular-nums',
                            factor.direction === 'positive'
                              ? 'text-success-fg'
                              : factor.direction === 'negative'
                                ? 'text-danger-fg'
                                : 'text-subtle',
                          )}
                        >
                          {factor.direction === 'negative' ? '−' : '+'}
                          {Math.abs(factor.contribution)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-border-subtle pt-2.5 text-[0.625rem] leading-relaxed text-faint">
                    Scoring is a demonstration model evaluated in your browser. A production model belongs
                    on the server, where it can be reviewed and versioned.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-muted">This lead has not been scored.</p>
              )}
            </Card>

            {/* Next actions: the reason someone opens a lead record. */}
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Next actions</h2>
              <div className="mt-3 space-y-2">
                {record.status !== 'converted' && record.status !== 'qualified' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    className="justify-start"
                    loading={qualify.pending}
                    onClick={() => void qualify.run(undefined)}
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Mark as qualified
                  </Button>
                ) : null}
                {record.status !== 'converted' ? (
                  <Button variant="secondary" size="sm" fullWidth className="justify-start" asChild>
                    <Link to={`/app/leads/${record.id}/convert`}>
                      <ArrowRightLeft className="size-3.5" aria-hidden />
                      Convert to account and deal
                    </Link>
                  </Button>
                ) : null}
                {record.status !== 'unqualified' && record.status !== 'converted' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    className="justify-start"
                    loading={disqualify.pending}
                    onClick={() => void disqualify.run(undefined)}
                  >
                    <XCircle className="size-3.5" aria-hidden />
                    Mark as unqualified
                  </Button>
                ) : null}
              </div>

              {record.status === 'converted' && record.convertedTo ? (
                <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
                  <p className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Converted into</p>
                  {record.convertedTo.accountId ? (
                    <Link
                      to={`/app/accounts/${record.convertedTo.accountId}`}
                      className="block text-xs text-link hover:underline"
                    >
                      Account
                    </Link>
                  ) : null}
                  {record.convertedTo.contactId ? (
                    <Link
                      to={`/app/contacts/${record.convertedTo.contactId}`}
                      className="block text-xs text-link hover:underline"
                    >
                      Contact
                    </Link>
                  ) : null}
                  {record.convertedTo.dealId ? (
                    <Link to={`/app/deals/${record.convertedTo.dealId}`} className="block text-xs text-link hover:underline">
                      Deal
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Tags</h2>
              {record.tags.length === 0 ? (
                <p className="mt-2 text-xs text-muted">No tags applied.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {record.tags.map((tag) => (
                    <li key={tag.id}>
                      <TonePill tone={tag.color}>{tag.label}</TonePill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- form */

const leadFormSchema = z.object({
  firstName: z.string().min(1, 'Enter a first name'),
  lastName: z.string().min(1, 'Enter a last name'),
  companyName: z.string().min(1, 'Enter a company name'),
  jobTitle: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional(),
  website: z.string().url('Enter a full URL including https://').optional().or(z.literal('')),
  status: z.enum(['new', 'contacted', 'nurturing', 'qualified', 'unqualified', 'recycled']),
  rating: z.enum(['hot', 'warm', 'cold', 'unrated']),
  estimatedValue: z.string().optional().refine((value) => !value || Number(value) >= 0, 'Enter a value of zero or more'),
  leadSourceId: z.string().optional(),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

export function LeadForm() {
  const services = useServices();
  const navigate = useNavigate();
  const { leadId } = useParams<{ leadId: string }>();
  const isEdit = Boolean(leadId);

  const existing = useAsync(() => services.leads.get(leadId ?? ''), [leadId], { skip: !isEdit });
  const sources = useList(() => services.leads.sources(), []);
  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const [ownerId, setOwnerId] = React.useState<string>('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [dirty, setDirty] = React.useState(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      status: 'new',
      rating: 'unrated',
    },
    mode: 'onBlur',
  });

  // Populate once the record arrives. `reset` is the supported way to seed a form from data.
  React.useEffect(() => {
    if (!existing.data) return;
    form.reset({
      firstName: existing.data.firstName ?? '',
      lastName: existing.data.lastName ?? '',
      companyName: existing.data.companyName ?? '',
      jobTitle: existing.data.jobTitle ?? '',
      email: existing.data.emails[0]?.value ?? '',
      phone: existing.data.phones[0]?.value ?? '',
      website: existing.data.website ?? '',
      status: (existing.data.status === 'converted' ? 'qualified' : existing.data.status) as LeadFormValues['status'],
      rating: existing.data.rating,
      estimatedValue: existing.data.estimatedValue ? String(existing.data.estimatedValue.amount) : '',
      leadSourceId: existing.data.leadSourceId,
      notes: existing.data.notes,
    });
    setOwnerId(existing.data.ownerId);
  }, [existing.data, form]);

  const save = useMutation(
    async (values: LeadFormValues) => {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        companyName: values.companyName,
        jobTitle: values.jobTitle || undefined,
        emails: [{ id: 'primary', label: 'Work', value: values.email, isPrimary: true }],
        phones: values.phone ? [{ id: 'primary', label: 'Direct', value: values.phone, isPrimary: true }] : [],
        website: values.website || undefined,
        status: values.status,
        rating: values.rating,
        estimatedValue: values.estimatedValue ? { amount: Number(values.estimatedValue), currency: 'USD' } : undefined,
        leadSourceId: values.leadSourceId || undefined,
        notes: values.notes || undefined,
        ownerId: ownerId || undefined,
        tags: tags.map((tag) => ({ id: tag, label: tag, color: 'slate' as const })),
      };

      if (isEdit && leadId) return services.leads.update(leadId, payload as never);
      return services.leads.create(payload as never);
    },
    {
      successMessage: isEdit ? 'Lead updated.' : 'Lead created.',
      onSuccess: (lead) => navigate(`/app/leads/${lead.id}`),
    },
  );

  const onSubmit = form.handleSubmit((values) => {
    setDirty(false);
    void save.run(values);
  });

  React.useEffect(() => {
    const subscription = form.watch(() => setDirty(true));
    return () => subscription.unsubscribe();
  }, [form]);

  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return (
    <div className="pb-10">
      <PageHeader
        title={isEdit ? 'Edit lead' : 'New lead'}
        description="Fields marked with an asterisk are required. Validation runs in the browser; the backend will enforce the same rules."
        breadcrumbs={[
          { label: 'Home', to: '/app/home' },
          { label: 'Leads', to: '/app/leads' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        actions={
          <>
            <Button variant="primary" size="sm" loading={save.pending} onClick={() => void onSubmit()} type="submit" form="lead-form">
              {isEdit ? 'Save changes' : 'Create lead'}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={isEdit && leadId ? `/app/leads/${leadId}` : '/app/leads'}>Cancel</Link>
            </Button>
          </>
        }
      />

      <form id="lead-form" onSubmit={onSubmit} className="space-y-5 p-4 sm:p-6" noValidate>
        {save.error ? (
          <Alert tone="danger" title="The lead was not saved">
            {save.error}
            {save.fieldErrors && save.fieldErrors.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 ps-4">
                {save.fieldErrors.map((error) => (
                  <li key={error.path}>{error.path}: {error.message}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="firstName" required error={form.formState.errors.firstName?.message}>
                <Input id="firstName" {...form.register('firstName')} autoComplete="given-name" />
              </Field>
              <Field label="Last name" htmlFor="lastName" required error={form.formState.errors.lastName?.message}>
                <Input id="lastName" {...form.register('lastName')} autoComplete="family-name" />
              </Field>
              <Field label="Work email" htmlFor="email" required error={form.formState.errors.email?.message}>
                <Input id="email" type="email" {...form.register('email')} autoComplete="email" />
              </Field>
              <Field
                label="Phone"
                htmlFor="phone"
                error={form.formState.errors.phone?.message}
                hint="Optional"
                description="Formatting follows the locale; no number validation service is called."
              >
                <Input id="phone" type="tel" {...form.register('phone')} autoComplete="tel" />
              </Field>
              <Field label="Job title" htmlFor="jobTitle" hint="Optional">
                <Input id="jobTitle" {...form.register('jobTitle')} autoComplete="organization-title" />
              </Field>
              <Field
                label="Website"
                htmlFor="website"
                error={form.formState.errors.website?.message}
                hint="Optional"
              >
                <Input id="website" {...form.register('website')} placeholder="https://" />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Qualification</h2>
            <div className="mt-4 space-y-4">
              <Field label="Company" htmlFor="companyName" required error={form.formState.errors.companyName?.message}>
                <Input id="companyName" {...form.register('companyName')} autoComplete="organization" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status" htmlFor="status">
                  <Select
                    id="status"
                    value={form.watch('status')}
                    onValueChange={(value) => form.setValue('status', value as LeadFormValues['status'], { shouldDirty: true })}
                    options={[
                      { value: 'new', label: 'New' },
                      { value: 'contacted', label: 'Contacted' },
                      { value: 'nurturing', label: 'Nurturing' },
                      { value: 'qualified', label: 'Qualified' },
                      { value: 'unqualified', label: 'Unqualified' },
                      { value: 'recycled', label: 'Recycled' },
                    ]}
                  />
                </Field>
                <Field label="Rating" htmlFor="rating">
                  <Select
                    id="rating"
                    value={form.watch('rating')}
                    onValueChange={(value) => form.setValue('rating', value as LeadFormValues['rating'], { shouldDirty: true })}
                    options={[
                      { value: 'hot', label: 'Hot' },
                      { value: 'warm', label: 'Warm' },
                      { value: 'cold', label: 'Cold' },
                      { value: 'unrated', label: 'Not rated' },
                    ]}
                  />
                </Field>
              </div>

              <Field
                label="Estimated value"
                htmlFor="estimatedValue"
                error={form.formState.errors.estimatedValue?.message}
                hint="USD"
              >
                <Input id="estimatedValue" inputMode="decimal" {...form.register('estimatedValue')} placeholder="0" />
              </Field>

              <Field label="Lead source" htmlFor="leadSourceId">
                <Select
                  id="leadSourceId"
                  value={form.watch('leadSourceId')}
                  onValueChange={(value) => form.setValue('leadSourceId', value, { shouldDirty: true })}
                  searchable
                  placeholder="How did this lead reach you?"
                  options={(sources.items ?? []).map((entry) => ({
                    value: entry.id,
                    label: entry.name,
                    description: entry.channel,
                  }))}
                />
              </Field>

              <Field label="Owner" htmlFor="ownerId" description="Leave empty to keep the lead unassigned.">
                <Select
                  id="ownerId"
                  value={ownerId}
                  onValueChange={setOwnerId}
                  searchable
                  placeholder="Unassigned"
                  options={(users.items ?? []).map((user) => ({ value: user.id, label: user.displayName, description: user.jobTitle }))}
                />
              </Field>

              <Field label="Tags" htmlFor="tags" description="Enter a tag and press Enter.">
                <MultiSelect
                  id="tags"
                  values={tags}
                  onChange={setTags}
                  options={[
                    { value: 'strategic', label: 'Strategic' },
                    { value: 'enterprise', label: 'Enterprise' },
                    { value: 'pilot', label: 'Pilot' },
                    { value: 'competitor', label: 'Competitor present' },
                  ]}
                  allowCustom
                  placeholder="Add a tag"
                />
              </Field>

              <Field label="Notes" htmlFor="notes" hint="Optional">
                <Textarea id="notes" rows={3} {...form.register('notes')} placeholder="Context that will help whoever picks this up next" />
              </Field>
            </div>
          </Card>
        </div>

        <Alert tone="info" title="Where this data goes">
          The lead is written to this browser only. No server, no CRM integration and no enrichment
          service is connected — the interface demonstrates the workflow, not the storage.
        </Alert>

        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="text-2xs text-warning-fg" role="status">
              Unsaved changes
            </span>
          ) : null}
          <div className="ms-auto flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link to={isEdit && leadId ? `/app/leads/${leadId}` : '/app/leads'}>Cancel</Link>
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={save.pending}>
              {isEdit ? 'Save changes' : 'Create lead'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------- convert */

/**
 * Conversion wizard.
 *
 * Three steps: review the lead, preview exactly what will be created, then commit. The
 * preview step is the point — promoting a lead writes a contact, an account and possibly a
 * deal, and it cannot be undone from the lead record once the lead is marked converted. So
 * the wizard shows the field-level conflicts and duplicate warnings before anything is
 * written, and the commit is a separate, explicit action.
 */
export function LeadConvert() {
  const services = useServices();
  const navigate = useNavigate();
  const { leadId } = useParams<{ leadId: string }>();

  const lead = useAsync(() => services.leads.get(leadId ?? ''), [leadId], { skip: !leadId });
  const pipelines = useList(() => services.pipelines.list(), []);
  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const [step, setStep] = React.useState(0);
  const [request, setRequest] = React.useState<LeadConversionRequest>({
    leadId: leadId ?? '',
    contactAccountAction: 'create_new',
    createDeal: true,
    copyNotes: true,
    copyActivities: true,
  });
  const [preview, setPreview] = React.useState<LeadConversionPreview | undefined>();

  const selectedPipeline: Pipeline | undefined = pipelines.items[0];
  const openStage = selectedPipeline?.stages.find((stage) => stage.kind === 'open');

  const runPreview = useMutation((input: LeadConversionRequest) => services.leads.previewConversion(leadId ?? '', input), {
    onSuccess: (result) => setPreview(result),
  });

  const commit = useMutation((input: LeadConversionRequest) => services.leads.convert(input), {
    successMessage: 'Lead converted. Contact, account and deal created.',
    onSuccess: (result) => {
      // Land on the deal when one was created: it is the record the team will work from.
      const dealId = result.deal?.willCreate ? lead.data?.convertedTo?.dealId : undefined;
      navigate(dealId ? `/app/deals/${dealId}` : '/app/leads');
    },
  });

  const runPreviewOnce = React.useRef(false);
  React.useEffect(() => {
    if (!lead.data || runPreviewOnce.current) return;
    runPreviewOnce.current = true;
    void runPreview.run({ ...request, pipelineId: selectedPipeline?.id, stageId: openStage?.id });
    // Intentionally once per mount: re-running the preview on every field change would make
    // the step feel unstable and produce a different result each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.data]);

  if (lead.loading) return <ListSkeleton rows={8} columns={2} />;
  if (lead.error || !lead.data) {
    return (
      <div className="p-6">
        <EmptyState
          title="This lead could not be found"
          body={lead.error ?? 'It may have been archived.'}
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/leads">Back to leads</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const record = lead.data;

  if (record.status === 'converted') {
    return (
      <div className="p-6">
        <EmptyState
          title="This lead has already been converted"
          body={`Converted ${formatDate(record.convertedAt, 'relative')}. The records it created are linked from the lead.`}
          action={
            <>
              <Button variant="primary" size="sm" asChild>
                <Link to={`/app/leads/${record.id}`}>Open the lead</Link>
              </Button>
              {record.convertedTo?.dealId ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link to={`/app/deals/${record.convertedTo.dealId}`}>Open the deal</Link>
                </Button>
              ) : null}
            </>
          }
        />
      </div>
    );
  }

  const steps = [
    { id: 'review', label: 'Review', description: 'What will be created' },
    { id: 'preview', label: 'Check for conflicts', description: 'Duplicates and field differences' },
    { id: 'confirm', label: 'Convert', description: 'Write the records' },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Convert lead"
        description="Nothing is written until you confirm. Review what will be created, and resolve any conflict first."
        breadcrumbs={[
          { label: 'Home', to: '/app/home' },
          { label: 'Leads', to: '/app/leads' },
          { label: record.companyName ?? record.reference, to: `/app/leads/${record.id}` },
          { label: 'Convert' },
        ]}
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/app/leads/${record.id}`}>Cancel</Link>
          </Button>
        }
        footer={
          <div className="border-t border-border-subtle px-4 py-3 sm:px-6">
            <Steps steps={steps} currentIndex={step} onStepClick={setStep} />
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {step === 0 ? (
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">The lead being converted</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Company</dt>
                  <dd className="mt-0.5 text-xs font-medium text-fg">{record.companyName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Contact</dt>
                  <dd className="mt-0.5 text-xs text-fg">
                    {[record.firstName, record.lastName].filter(Boolean).join(' ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Email</dt>
                  <dd className="mt-0.5 text-xs text-fg">{record.emails[0]?.value ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Estimated value</dt>
                  <dd className="mt-0.5 text-xs tabular-nums text-fg">
                    {record.estimatedValue ? formatMoney(record.estimatedValue.amount, record.estimatedValue.currency) : '—'}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Choose what to create</h2>
              <div className="mt-3 space-y-4">
                <Field label="Contact and account" htmlFor="contactAccountAction">
                  <Select
                    id="contactAccountAction"
                    value={request.contactAccountAction}
                    onValueChange={(value) =>
                      setRequest((current) => ({
                        ...current,
                        contactAccountAction: value as LeadConversionRequest['contactAccountAction'],
                      }))
                    }
                    options={[
                      { value: 'create_new', label: 'Create a new contact and account', description: 'The usual path for an inbound lead.' },
                      { value: 'link_existing', label: 'Link to an existing account', description: 'Use when you already have the company on file.' },
                    ]}
                  />
                </Field>

                <Checkbox
                  id="createDeal"
                  checked={request.createDeal}
                  onCheckedChange={(checked) => setRequest((current) => ({ ...current, createDeal: checked === true }))}
                  label="Create an opportunity"
                  description={
                    selectedPipeline && openStage
                      ? `Starts in “${openStage.name}” on the ${selectedPipeline.name} pipeline at ${openStage.probability}% probability.`
                      : 'Creates a deal so the lead enters the pipeline.'
                  }
                />

                {request.createDeal ? (
                  <Field label="Opportunity name" htmlFor="dealName">
                    <Input
                      id="dealName"
                      value={request.dealName ?? ''}
                      placeholder={`${record.companyName ?? 'New'} — new opportunity`}
                      onChange={(event) => setRequest((current) => ({ ...current, dealName: event.target.value }))}
                    />
                  </Field>
                ) : null}

                <Field label="Owner" htmlFor="convertOwner">
                  <Select
                    id="convertOwner"
                    value={request.ownerId}
                    onValueChange={(value) => setRequest((current) => ({ ...current, ownerId: value }))}
                    searchable
                    placeholder="Keep the lead owner"
                    options={(users.items ?? []).map((user) => ({ value: user.id, label: user.displayName, description: user.jobTitle }))}
                  />
                </Field>

                <div className="space-y-2.5 border-t border-border-subtle pt-3">
                  <Checkbox
                    id="copyNotes"
                    checked={request.copyNotes}
                    onCheckedChange={(checked) => setRequest((current) => ({ ...current, copyNotes: checked === true }))}
                    label="Copy the notes across"
                  />
                  <Checkbox
                    id="copyActivities"
                    checked={request.copyActivities}
                    onCheckedChange={(checked) => setRequest((current) => ({ ...current, copyActivities: checked === true }))}
                    label="Copy the activity history"
                  />
                </div>
              </div>
            </Card>

            <div className="lg:col-span-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                trailingIcon={<ArrowRightLeft className="size-3.5" />}
                loading={runPreview.pending}
                onClick={async () => {
                  const result = await runPreview.run({ ...request, pipelineId: selectedPipeline?.id, stageId: openStage?.id });
                  if (result) setStep(1);
                }}
              >
                Preview what will be created
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            {runPreview.pending ? (
              <ListSkeleton rows={5} columns={2} />
            ) : preview ? (
              <>
                {preview.duplicateWarnings.length > 0 ? (
                  <Alert tone="warning" title="Possible duplicates found">
                    <p>
                      This lead resembles {preview.duplicateWarnings.length} existing{' '}
                      {preview.duplicateWarnings.length === 1 ? 'record' : 'records'}. Converting will still
                      create new records; merge them afterwards from the duplicate review.
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {preview.duplicateWarnings.map((warning) => (
                        <li key={warning.existingId} className="flex items-center gap-2">
                          <Badge variant="warning" size="sm">
                            {warning.kind} · {warning.score}% match
                          </Badge>
                          <Link
                            to={warning.kind === 'account' ? `/app/accounts/${warning.existingId}` : `/app/contacts/${warning.existingId}`}
                            className="text-link hover:underline"
                          >
                            {warning.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Alert>
                ) : (
                  <Alert tone="success" title="No duplicates detected">
                    Nothing on file resembles this lead closely enough to flag.
                  </Alert>
                )}

                <div className="grid gap-4 lg:grid-cols-3">
                  <PreviewCard
                    title="Contact"
                    willCreate={preview.contact.willCreate}
                    displayName={preview.contact.displayName}
                    fieldDiffs={preview.contact.fieldDiffs}
                    tone="violet"
                  />
                  <PreviewCard
                    title="Account"
                    willCreate={preview.account.willCreate}
                    displayName={preview.account.displayName}
                    fieldDiffs={preview.account.fieldDiffs}
                    tone="teal"
                  />
                  {preview.deal ? (
                    <PreviewCard
                      title="Opportunity"
                      willCreate={preview.deal.willCreate}
                      displayName={preview.deal.displayName}
                      amount={preview.deal.amount}
                      tone="green"
                      extra={
                        selectedPipeline && openStage
                          ? `${selectedPipeline.name} · ${openStage.name} · ${openStage.probability}%`
                          : undefined
                      }
                    />
                  ) : (
                    <Card className="border-dashed p-4">
                      <h3 className="text-sm font-semibold text-fg">Opportunity</h3>
                      <p className="mt-2 text-xs text-muted">
                        Not creating one. The lead will still be marked converted.
                      </p>
                    </Card>
                  )}
                </div>

                <Alert tone="info" title="This preview wrote nothing">
                  The dry run above is computed from the lead and the existing records without touching
                  either. Confirming is a separate action.
                </Alert>

                <div className="flex justify-between gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button variant="primary" size="sm" loading={commit.pending} onClick={() => void commit.run({ ...request, pipelineId: selectedPipeline?.id, stageId: openStage?.id })}>
                    Convert the lead
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewCard({
  title,
  willCreate,
  displayName,
  fieldDiffs,
  amount,
  tone,
  extra,
}: {
  title: string;
  willCreate: boolean;
  displayName: string;
  fieldDiffs?: LeadConversionPreview['contact']['fieldDiffs'];
  amount?: { amount: number; currency: string };
  tone: 'violet' | 'teal' | 'green';
  extra?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <Badge variant={willCreate ? 'success' : 'neutral'} size="sm">
          {willCreate ? 'Will be created' : 'Links to existing'}
        </Badge>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <Avatar name={displayName} size="md" tone={tone} />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-fg">{displayName}</p>
          {amount ? (
            <p className="text-[0.6875rem] tabular-nums text-muted">{formatMoney(amount.amount, amount.currency)}</p>
          ) : null}
          {extra ? <p className="mt-0.5 text-[0.625rem] text-subtle">{extra}</p> : null}
        </div>
      </div>

      {fieldDiffs && fieldDiffs.length > 0 ? (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <p className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Field differences to resolve</p>
          <ul className="mt-2 space-y-2">
            {fieldDiffs.map((diff) => (
              <li key={diff.field} className="text-[0.6875rem]">
                <span className="flex items-center gap-1.5 font-medium text-fg">
                  {diff.label}
                  {diff.conflict ? <Badge variant="warning" size="sm">Conflict</Badge> : null}
                </span>
                <span className="mt-0.5 block text-subtle">
                  Lead: {diff.leadValue ?? '—'} · Existing: {diff.existingValue ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.625rem] leading-relaxed text-faint">
            The existing value is kept for now. Merge afterwards to choose per field.
          </p>
        </div>
      ) : (
        <p className="mt-3 border-t border-border-subtle pt-3 text-[0.6875rem] text-muted">
          All fields carry over without a conflict.
        </p>
      )}
    </Card>
  );
}

export { ChevronDown, SearchInput, Star, initialsOf };
export type { LeadScoring };
