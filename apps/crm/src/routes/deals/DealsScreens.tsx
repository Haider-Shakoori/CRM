'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  CalendarClock,
  Columns3,
  Handshake,
  List,
  Plus,
  Target,
  TrendingDown,
  Trophy,
  Users,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Deal, DealLostReason, PipelineSummary } from '@crm/shared-types';
import {
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  DataTable,
  DemoNotice,
  Field,
  InlineBar,
  Input,
  KanbanBoard,
  type KanbanCard,
  type KanbanColumn,
  KpiCard,
  MiniStat,
  Pagination,
  Progress,
  Select,
  StatusBadge,
  Textarea,
  TonePill,
  cn,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Deal screens: the pipeline board, the list, the detail record and the forecast.
 *
 * The board is the part that matters. Three properties are enforced rather than intended:
 *
 *   1. **One write path.** Dragging a card, the per-card move controls, the list's stage
 *      selector and the detail's stepper all call `deals.move`. That operation returns the
 *      recomputed pipeline summary alongside the updated deal, so a column total can never
 *      describe a state the board is not showing.
 *   2. **A rejection rolls back for free.** `onMove` throws when the service refuses the
 *      move — a lost stage without a reason, say — and the board announces why without
 *      moving the card. Nothing was written, so there is nothing to undo.
 *   3. **The keyboard is not a second-class path.** Every move is reachable with tab and
 *      enter, and the totals update identically.
 *
 * Scope note: adding product lines is not available from this build. The catalog service is
 * not implemented yet, so the product table is read-only and says so, rather than offering a
 * control that would fail.
 */

const toneDotClasses: Record<string, string> = {
  violet: 'bg-tone-violet',
  teal: 'bg-tone-teal',
  amber: 'bg-tone-amber',
  green: 'bg-tone-green',
  red: 'bg-tone-red',
  blue: 'bg-tone-blue',
  slate: 'bg-tone-slate',
};

function toneDot(tone: string): string {
  return toneDotClasses[tone] ?? 'bg-tone-slate';
}

/* --------------------------------------------------------------------- board */

export default function DealsBoard() {
  const services = useServices();
  const navigate = useNavigate();

  // Only the explicit choice is stored; the fallback to the first pipeline is derived, so no
  // effect is needed to seed it.
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [ownerFilter, setOwnerFilter] = React.useState('');
  const [summary, setSummary] = React.useState<PipelineSummary | undefined>();
  const [lostDialog, setLostDialog] = React.useState<{ dealId: string; stageId: string; dealName: string } | null>(null);
  const [lostReasonId, setLostReasonId] = React.useState('');
  const [lostNote, setLostNote] = React.useState('');

  const pipelines = useList(() => services.pipelines.list(), []);
  const activePipeline = React.useMemo(() => {
    const items = pipelines.items;
    return items.find((pipeline) => pipeline.id === selectedPipelineId) ?? items[0];
  }, [pipelines.items, selectedPipelineId]);

  const deals = useList(
    () => services.deals.list({ pageSize: 200, q: search || undefined, sort: [{ field: 'amount', direction: 'desc' }] }),
    [search],
  );

  const summaryRequest = useAsync(
    () => services.deals.pipelineSummary(activePipeline?.id ?? ''),
    [activePipeline?.id],
    { skip: !activePipeline },
  );

  // The live summary comes from the last move; the fetched one seeds the first render.
  const liveSummary = summary ?? summaryRequest.data;

  const reasons = useList(() => services.deals.lostReasons(), []);

  const scopedDeals = React.useMemo(
    () =>
      deals.items.filter((deal) => {
        if (activePipeline && deal.pipelineId !== activePipeline.id) return false;
        if (ownerFilter && deal.ownerId !== ownerFilter) return false;
        return true;
      }),
    [deals.items, activePipeline, ownerFilter],
  );

  /**
   * Move a deal.
   *
   * Throws on rejection so the board can announce the reason without moving the card. A lost
   * stage opens the reason dialog first, because the business rule requires it and a silent
   * failure would be worse than a dialog.
   */
  const onMove = React.useCallback(
    async (dealId: string, toStageId: string) => {
      const deal = scopedDeals.find((candidate) => candidate.id === dealId);
      const stage = activePipeline?.stages.find((candidate) => candidate.id === toStageId);
      if (!deal || !stage) return;

      if (stage.kind === 'lost') {
        setLostDialog({ dealId, stageId: toStageId, dealName: deal.name });
        return;
      }

      const result = await services.deals.move({ dealId, toStageId });
      if (!result.ok) throw new Error(result.error.message);

      setSummary(result.data.summary);
      deals.reload();
      summaryRequest.reload();
    },
    [activePipeline, scopedDeals, services.deals, deals, summaryRequest],
  );

  const confirmLost = async () => {
    if (!lostDialog) return;
    if (!lostReasonId) {
      notify.warning('Choose a lost reason before closing the deal.');
      return;
    }
    const result = await services.deals.move({
      dealId: lostDialog.dealId,
      toStageId: lostDialog.stageId,
      lostReasonId,
      note: lostNote || undefined,
    });
    if (!result.ok) {
      notify.error(result.error.message);
      return;
    }
    setSummary(result.data.summary);
    notify.success(`${lostDialog.dealName} closed as lost.`);
    setLostDialog(null);
    setLostReasonId('');
    setLostNote('');
    deals.reload();
  };

  const columns: KanbanColumn[] = (activePipeline?.stages ?? []).map((stage) => ({
    id: stage.id,
    label: stage.name,
    tone: stage.tone,
    probability: stage.probability,
    description: stage.description,
  }));

  const cards: KanbanCard[] = scopedDeals.map((deal) => ({
    id: deal.id,
    columnId: deal.stageId,
    title: deal.name,
    subtitle: deal.accountName,
    value: formatMoney(deal.amount.amount, deal.amount.currency, true),
    meta: [
      ...(deal.isStale ? [{ label: `${deal.daysInStage}d in stage`, tone: 'amber' as const }] : []),
      ...((deal.competitors?.length ?? 0) > 0 ? [{ label: 'Competitor', tone: 'red' as const }] : []),
      ...(deal.approvalState === 'pending' ? [{ label: 'Approval', tone: 'violet' as const }] : []),
    ],
    attention: deal.isStale ? 'warning' : undefined,
    avatar: <Avatar name={deal.teamMembers[0]?.name ?? 'Owner'} size="xs" tone="violet" />,
    ariaLabel: `${deal.name}, ${deal.accountName}, ${formatMoney(deal.amount.amount, deal.amount.currency, true)}, ${deal.daysInStage} days in stage${deal.isStale ? ', not moving' : ''}`,
  }));

  const stageTotals = new Map((liveSummary?.stages ?? []).map((stage) => [stage.stageId, stage]));

  return (
    <div className="flex h-full min-h-0 flex-col pb-4">
      <PageHeader
        title="Pipeline"
        description="Every stage move goes through one operation, so the board and the totals below it cannot disagree. Cards also move from the keyboard."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Deals' }]}
        actions={
          <>
            <Button variant="primary" size="sm" leadingIcon={<Plus className="size-3.5" />} asChild>
              <Link to="/app/deals/new">New deal</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<List className="size-3.5" />} asChild>
              <Link to="/app/deals/list">List view</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Target className="size-3.5" />} asChild>
              <Link to="/app/deals/forecast">Forecast</Link>
            </Button>
          </>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search deals or accounts"
            resultCount={`${cards.length} deals · ${formatMoney(liveSummary?.totalValue.amount ?? 0, liveSummary?.currency ?? 'USD', true)} open`}
            actions={
              <>
                <Select
                  value={activePipeline?.id ?? ''}
                  onValueChange={setSelectedPipelineId}
                  options={pipelines.items.map((pipeline) => ({
                    value: pipeline.id,
                    label: pipeline.name,
                    description: `${pipeline.stages.length} stages · ${pipeline.currency}`,
                  }))}
                  selectSize="sm"
                  className="w-[13rem]"
                  aria-label="Pipeline"
                />
                <OwnerFilter value={ownerFilter} onChange={setOwnerFilter} />
              </>
            }
            viewNote={
              activePipeline
                ? `${activePipeline.name}. Deals older than ${activePipeline.settings.staleDealDays} days in a stage are flagged as not moving.`
                : undefined
            }
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
        <section aria-labelledby="stage-totals-heading" className="shrink-0 space-y-3">
          <h2 id="stage-totals-heading" className="sr-only">
            Pipeline totals by stage
          </h2>

          {summaryRequest.loading && !liveSummary ? (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[4.5rem] animate-pulse rounded-lg bg-inset" />
              ))}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {(liveSummary?.stages ?? []).map((stage) => (
                <div key={stage.stageId} className="rounded-lg border border-border-subtle bg-surface p-2.5">
                  <p className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-wide text-faint">
                    <span className={cn('size-1.5 shrink-0 rounded-full', toneDot(stage.tone))} aria-hidden />
                    <span className="truncate">{stage.stageName}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums leading-none text-fg">
                    {formatMoney(stage.totalValue.amount, liveSummary?.currency ?? 'USD', true)}
                  </p>
                  <p className="mt-1 text-[0.625rem] text-subtle">
                    {stage.dealCount} {stage.dealCount === 1 ? 'deal' : 'deals'}
                    {stage.averageAgeDays > 0 ? ` · avg ${stage.averageAgeDays}d` : ''}
                    {stage.staleCount > 0 ? ` · ${stage.staleCount} stale` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Open value" value={formatMoney(liveSummary?.totalValue.amount ?? 0, liveSummary?.currency ?? 'USD', true)} tone="violet" />
            <MiniStat label="Weighted" value={formatMoney(liveSummary?.weightedValue.amount ?? 0, liveSummary?.currency ?? 'USD', true)} tone="teal" />
            <MiniStat label="Win rate" value={`${liveSummary?.winRate ?? 0}%`} tone="green" />
            <MiniStat
              label="Not moving"
              value={String((liveSummary?.stages ?? []).reduce((sum, stage) => sum + stage.staleCount, 0))}
              tone="amber"
            />
          </div>
        </section>

        {deals.loading ? (
          <div className="grid flex-1 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-full animate-pulse rounded-lg bg-inset" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <Card className="flex flex-1 items-center justify-center p-10">
            <div className="max-w-md space-y-3 text-center">
              <h2 className="text-sm font-semibold text-fg">No deals in this view</h2>
              <p className="text-xs text-muted">
                {search || ownerFilter
                  ? 'Clear the filters to see the whole pipeline.'
                  : 'The pipeline is empty. Create a deal, or convert a qualified lead to populate it.'}
              </p>
              <div className="flex justify-center gap-2">
                {search || ownerFilter ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setOwnerFilter('');
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
                <Button variant="primary" size="sm" asChild>
                  <Link to="/app/deals/new">Create a deal</Link>
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <KanbanBoard
            columns={columns}
            cards={cards}
            onMove={onMove}
            onCardClick={(dealId) => navigate(`/app/deals/${dealId}`)}
            emptyColumnLabel="Drop a deal here, or use a card’s move controls"
            height="calc(100dvh - 29rem)"
            renderColumnSummary={(columnId) => {
              const stage = stageTotals.get(columnId);
              if (!stage) return null;
              return (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.6875rem] font-semibold tabular-nums text-fg">
                    {formatMoney(stage.totalValue.amount, liveSummary?.currency ?? 'USD', true)}
                  </span>
                  <span className="text-[0.625rem] text-subtle">
                    weighted {formatMoney(stage.weightedValue.amount, liveSummary?.currency ?? 'USD', true)}
                  </span>
                </div>
              );
            }}
          />
        )}

        <p className="shrink-0 text-[0.625rem] leading-relaxed text-faint">
          The totals above are recomputed by the service on every move and returned with the updated deal. The board
          never calculates a total of its own, which is why the columns and the summary strip agree.
        </p>
      </div>

      {lostDialog ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--surface-scrim)]"
            aria-label="Cancel closing this deal"
            onClick={() => setLostDialog(null)}
          />
          <div role="dialog" aria-modal="true" aria-label="Close deal as lost" className="relative w-full max-w-md rounded-xl border border-border bg-overlay p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-fg">Close “{lostDialog.dealName}” as lost</h2>
            <p className="mt-1 text-xs text-muted">
              This pipeline requires a reason. It drives the lost-reason analysis, which is the only way the team
              learns why deals are not closing.
            </p>
            <div className="mt-4 space-y-4">
              <Field label="Reason" htmlFor="lostReason" required>
                <Select
                  id="lostReason"
                  value={lostReasonId}
                  onValueChange={setLostReasonId}
                  placeholder="Choose a reason"
                  options={reasons.items.map((reason: DealLostReason) => ({
                    value: reason.id,
                    label: reason.label,
                    description: `${reason.category.replace(/_/g, ' ')} · ${reason.dealCount} deals historically`,
                  }))}
                />
              </Field>
              <Field label="What happened" htmlFor="lostNote" hint="Optional">
                <Textarea
                  id="lostNote"
                  rows={3}
                  value={lostNote}
                  onChange={(event) => setLostNote(event.target.value)}
                  placeholder="Context the next person will want"
                />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setLostDialog(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={() => void confirmLost()}>
                Close as lost
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OwnerFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const services = useServices();
  const users = useList(() => services.users.list({ pageSize: 100 }), []);
  return (
    <Select
      value={value}
      onValueChange={onChange}
      placeholder="All owners"
      searchable
      selectSize="sm"
      className="w-[12rem]"
      aria-label="Filter by owner"
      options={users.items
        .filter((user) => ['sales_rep', 'sales_manager', 'account_manager', 'sales_director'].includes(user.persona))
        .map((user) => ({ value: user.id, label: user.displayName, description: user.jobTitle }))}
    />
  );
}

/* ---------------------------------------------------------------------- list */

export function DealsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('open');

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 50,
      q: search || undefined,
      sort: [{ field: 'amount', direction: 'desc' as const }],
      filter:
        statusFilter === 'all'
          ? undefined
          : {
              id: 'deal-status',
              conjunction: 'and' as const,
              clauses: [{ field: 'status', operator: 'eq' as const, value: statusFilter }] as never,
            },
    }),
    [page, search, statusFilter],
  );

  const deals = useList(() => services.deals.list(query), [JSON.stringify(query)]);

  const columns = React.useMemo<ColumnDef<Deal, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Deal',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/deals/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.name}
            </Link>
            <span className="mt-0.5 block truncate font-mono text-[0.625rem] text-faint">{row.original.reference}</span>
          </div>
        ),
      },
      { id: 'account', header: 'Account', accessorKey: 'accountName', cell: ({ row }) => <span className="truncate text-xs text-muted">{row.original.accountName}</span> },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (deal) => deal.amount.amount,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs font-medium tabular-nums text-fg">
            {formatMoney(row.original.amount.amount, row.original.amount.currency)}
          </span>
        ),
      },
      {
        id: 'probability',
        header: 'Probability',
        accessorKey: 'probability',
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="flex items-center justify-end gap-2">
            <span className="w-10 text-end text-xs tabular-nums text-muted">{row.original.probability}%</span>
            <Progress value={row.original.probability} size="xs" tone="violet" className="w-12" />
          </span>
        ),
      },
      {
        id: 'weighted',
        header: 'Weighted',
        accessorFn: (deal) => (deal.amount.amount * deal.probability) / 100,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs font-medium tabular-nums text-muted">
            {formatMoney((row.original.amount.amount * row.original.probability) / 100, row.original.amount.currency, true)}
          </span>
        ),
      },
      { id: 'close', header: 'Expected close', accessorKey: 'expectedCloseDate', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.expectedCloseDate)}</span> },
      {
        id: 'age',
        header: 'Age',
        accessorKey: 'daysInStage',
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className={cn('text-[0.6875rem] tabular-nums', row.original.isStale ? 'text-warning-fg' : 'text-muted')}>
            {row.original.daysInStage}d
          </span>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorKey: 'ownerId',
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.teamMembers[0]?.name ?? 'Owner'} size="xs" tone="teal" />
            <span className="truncate text-[0.6875rem] text-muted">{row.original.teamMembers[0]?.name ?? '—'}</span>
          </span>
        ),
      },
    ],
    [],
  );

  const valueTotal = deals.items.reduce((sum, deal) => sum + deal.amount.amount, 0);
  const weightedTotal = deals.items.reduce((sum, deal) => sum + (deal.amount.amount * deal.probability) / 100, 0);

  return (
    <div className="pb-8">
      <PageHeader
        title="Deals"
        description="A flat list of the same records the board shows. Useful for comparing values across many deals at once."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Deals' }, { label: 'List' }]}
        actions={
          <>
            <Button variant="primary" size="sm" leadingIcon={<Plus className="size-3.5" />} asChild>
              <Link to="/app/deals/new">New deal</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Columns3 className="size-3.5" />} asChild>
              <Link to="/app/deals">Board view</Link>
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
            searchPlaceholder="Search deal or account"
            resultCount={deals.meta ? `${deals.meta.total.toLocaleString()} deals` : undefined}
            chips={statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter}`, tone: 'brand', onRemove: () => setStatusFilter('all') }] : []}
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
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'won', label: 'Won' },
                  { value: 'lost', label: 'Lost' },
                  { value: 'all', label: 'All statuses' },
                ]}
                selectSize="sm"
                className="w-[10rem]"
                aria-label="Filter by status"
              />
            }
          />
        }
      />

      <div className="space-y-3 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Value in view" value={formatMoney(valueTotal, 'USD', true)} tone="violet" />
          <MiniStat label="Weighted" value={formatMoney(weightedTotal, 'USD', true)} tone="teal" />
          <MiniStat label="Deals in view" value={formatNumber(deals.items.length)} tone="blue" />
          <MiniStat label="Average size" value={formatMoney(deals.items.length > 0 ? valueTotal / deals.items.length : 0, 'USD', true)} tone="amber" />
        </div>

        {deals.loading ? (
          <ListSkeleton rows={10} columns={7} />
        ) : (
          <DataTable
            columns={columns}
            data={deals.items}
            onRowClick={(deal) => navigate(`/app/deals/${deal.id}`)}
            getRowId={(deal) => deal.id}
            footer={deals.meta ? <Pagination page={deals.meta.page} pageSize={deals.meta.pageSize} total={deals.meta.total} onPageChange={setPage} /> : null}
          />
        )}

        <Alert tone="info" title="Sorting is server-shaped">
          The sort specification goes to the service exactly as it will go to the REST API. Sorting only the records
          on the current page would produce a different order from paging through them, which is a defect the
          interface cannot hide.
        </Alert>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function DealDetail() {
  const services = useServices();
  const { dealId } = useParams<{ dealId: string }>();

  const deal = useAsync(() => services.deals.get(dealId ?? ''), [dealId], { skip: !dealId });
  const pipeline = useAsync(() => services.pipelines.get(deal.data?.pipelineId ?? ''), [deal.data?.pipelineId], { skip: !deal.data?.pipelineId });
  const account = useAsync(() => services.accounts.get(deal.data?.accountId ?? ''), [deal.data?.accountId], { skip: !deal.data?.accountId });
  const activities = useList(() => services.activities.forRecord('deal', dealId ?? '', { pageSize: 15 }), [dealId], { skip: !dealId });
  const reasons = useList(() => services.deals.lostReasons(), []);

  const moveStage = useMutation(
    (input: { stageId: string; lostReasonId?: string }) =>
      services.deals.move({ dealId: dealId ?? '', toStageId: input.stageId, lostReasonId: input.lostReasonId }),
    {
      successMessage: (result) => `Moved to ${pipeline.data?.stages.find((stage) => stage.id === result.deal.stageId)?.name ?? 'the new stage'}.`,
      onSuccess: () => deal.reload(),
    },
  );

  if (deal.loading) return <ListSkeleton rows={10} columns={3} />;
  if (deal.error || !deal.data) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This deal could not be found</h2>
            <p className="text-xs text-muted">{deal.error ?? 'It may have been archived or removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/deals">Back to the pipeline</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const record = deal.data;
  const stages = pipeline.data?.stages ?? [];
  const currentIndex = stages.findIndex((stage) => stage.id === record.stageId);
  const nextStage = stages[currentIndex + 1];
  const previousStage = stages[currentIndex - 1];
  const weighted = (record.amount.amount * record.probability) / 100;

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Deals', to: '/app/deals' }, { label: record.name }]}
        title={record.name}
        description={`${record.accountName} · ${pipeline.data?.name ?? 'Pipeline'}`}
        actions={
          <>
            {previousStage ? (
              <Button variant="secondary" size="sm" onClick={() => void moveStage.run({ stageId: previousStage.id })} loading={moveStage.pending}>
                ← {previousStage.name}
              </Button>
            ) : null}
            {nextStage ? (
              <Button
                variant="primary"
                size="sm"
                loading={moveStage.pending}
                onClick={() =>
                  nextStage.kind === 'lost'
                    ? notify.info('Closing as lost needs a reason', 'Use the stage selector below to record why.')
                    : void moveStage.run({ stageId: nextStage.id })
                }
              >
                {nextStage.name} →
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/app/deals/${record.id}/edit`}>Edit</Link>
            </Button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle px-4 py-2 sm:px-6">
            <ol className="flex flex-wrap items-center gap-1.5" aria-label="Pipeline stages">
              {stages.map((stage, index) => {
                const isCurrent = stage.id === record.stageId;
                const isPast = currentIndex > index;
                return (
                  <li key={stage.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => !isCurrent && void moveStage.run({ stageId: stage.id })}
                      disabled={moveStage.pending || isCurrent}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-2xs transition-colors',
                        isCurrent
                          ? 'border-brand/40 bg-brand-subtle font-medium text-brand-fg'
                          : isPast
                            ? 'border-border-subtle bg-inset text-muted hover:border-border-strong'
                            : 'border-dashed border-border-strong text-subtle hover:text-fg',
                      )}
                      title={stage.description}
                    >
                      <span className={cn('size-1.5 rounded-full', toneDot(stage.tone))} aria-hidden />
                      {stage.name}
                      <span className="text-faint">{stage.probability}%</span>
                    </button>
                    {index < stages.length - 1 ? <span className="text-faint" aria-hidden>›</span> : null}
                  </li>
                );
              })}
            </ol>
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {record.isStale ? (
          <Alert tone="warning" title={`This deal has not moved in ${record.daysInStage} days`}>
            The pipeline flags deals older than {pipeline.data?.settings.staleDealDays ?? 21} days in a stage. Set a
            next step so the record does not drift.
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Deal value" value={formatMoney(record.amount.amount, record.amount.currency)} hint={record.products.length > 0 ? `${record.products.length} product lines` : 'Entered directly'} />
          <KpiCard label="Weighted value" value={formatMoney(weighted, record.amount.currency)} visual={<InlineBar value={record.probability} />} />
          <KpiCard
            label="Expected close"
            value={formatDate(record.expectedCloseDate)}
            hint={record.actualCloseDate ? `Closed ${formatDate(record.actualCloseDate)}` : 'Forecast date'}
          />
          <KpiCard label="Days in stage" value={String(record.daysInStage)} hint={`Entered ${formatDate(record.stageEnteredAt, 'relative')}`} attention={record.isStale ? 'warning' : undefined} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <Card>
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Products</h2>
                  <p className="mt-0.5 text-2xs text-muted">
                    The deal amount is the sum of these lines. Editing lines arrives with the products module.
                  </p>
                </div>
                <DemoNotice tone="neutral">Read-only</DemoNotice>
              </div>

              {record.products.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">
                  No product lines on this deal yet. The amount above was entered directly.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <caption className="sr-only">Product lines</caption>
                    <thead>
                      <tr>
                        {['Product', 'Billing', 'Qty', 'Unit price', 'Discount', 'Line total'].map((heading, index) => (
                          <th
                            key={heading}
                            scope="col"
                            className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', index >= 2 ? 'text-end' : 'text-start')}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {record.products.map((line) => (
                        <tr key={line.id} className="border-b border-border-subtle last:border-b-0">
                          <td className="px-3 py-2">
                            <span className="block font-medium text-fg">{line.productName}</span>
                            <span className="block font-mono text-[0.625rem] text-faint">{line.sku}</span>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" size="sm">{line.billing.replace(/_/g, ' ')}</Badge>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums text-muted">{line.quantity}</td>
                          <td className="px-3 py-2 text-end tabular-nums text-muted">{formatMoney(line.unitPrice.amount, line.unitPrice.currency)}</td>
                          <td className="px-3 py-2 text-end tabular-nums text-muted">{line.discountPercent > 0 ? `${line.discountPercent}%` : '—'}</td>
                          <td className="px-3 py-2 text-end font-medium tabular-nums text-fg">{formatMoney(line.lineTotal.amount, line.lineTotal.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-inset">
                        <td colSpan={5} className="px-3 py-2 text-end text-xs font-medium text-muted">Deal amount</td>
                        <td className="px-3 py-2 text-end text-xs font-semibold tabular-nums text-fg">{formatMoney(record.amount.amount, record.amount.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Activity</h2>
                <p className="mt-0.5 text-2xs text-muted">Calls, emails, meetings, stage changes and automated entries.</p>
              </div>
              {activities.loading ? (
                <ListSkeleton rows={4} columns={2} />
              ) : activities.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">Nothing logged against this deal yet.</p>
              ) : (
                <ol className="divide-y divide-[var(--border-subtle)]">
                  {activities.items.map((activity) => (
                    <li key={activity.id} className="flex items-start gap-3 px-4 py-3">
                      <Avatar name={activity.ownerName} size="xs" tone="violet" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-fg">{activity.subject}</span>
                          {activity.kind === 'stage_change' ? <Badge variant="brand" size="sm">Stage</Badge> : null}
                          {activity.source === 'automation' ? <DemoNotice tone="neutral">Automated</DemoNotice> : null}
                        </div>
                        {activity.body ? <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">{activity.body}</p> : null}
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
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Account</h2>
              {account.data ? (
                <>
                  <div className="mt-3 flex items-start gap-3">
                    <Avatar name={account.data.name} size="md" tone="teal" />
                    <div className="min-w-0">
                      <Link to={`/app/accounts/${account.data.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                        {account.data.name}
                      </Link>
                      <p className="mt-0.5 text-[0.6875rem] text-muted">{account.data.industryLabel ?? 'Industry not set'}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border-subtle pt-3">
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">Health</dt>
                      <dd className="mt-0.5 flex items-center gap-2">
                        <StatusBadge status={account.data.health} />
                        <span className="text-xs tabular-nums text-muted">{account.data.healthScore ?? '—'}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">Open deals</dt>
                      <dd className="mt-0.5 text-xs tabular-nums text-fg">{account.data.openDealCount}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted">Loading the account…</p>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                <Users className="size-4 text-subtle" aria-hidden />
                Deal team
              </h2>
              <div className="mt-3">
                <AvatarGroup people={record.teamMembers.map((member) => ({ name: member.name }))} max={4} size="sm" />
              </div>
              <ul className="mt-3 space-y-2 border-t border-border-subtle pt-3">
                {record.teamMembers.map((member) => (
                  <li key={`${member.userId}-${member.role}`} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                    <span className="min-w-0 truncate text-muted">{member.name}</span>
                    <Badge variant="outline" size="sm">{member.role.replace(/_/g, ' ')}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            {(record.competitors?.length ?? 0) > 0 ? (
              <Card className="p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                  <Handshake className="size-4 text-subtle" aria-hidden />
                  Competitors
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {(record.competitors ?? []).map((competitor) => (
                    <li key={competitor.id} className="text-[0.6875rem]">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-fg">{competitor.name}</span>
                        <TonePill tone={competitor.threat === 'high' ? 'red' : competitor.threat === 'medium' ? 'amber' : 'slate'}>
                          {competitor.threat} threat
                        </TonePill>
                      </span>
                      {competitor.strength ? <span className="mt-0.5 block text-subtle">Strength: {competitor.strength}</span> : null}
                      {competitor.weakness ? <span className="block text-subtle">Weakness: {competitor.weakness}</span> : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {record.status === 'lost' ? (
              <Card className="border-danger/30 p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <TrendingDown className="size-4 text-danger-fg" aria-hidden />
                  Lost
                </h2>
                <p className="mt-2 text-xs text-muted">
                  {record.lostReasonLabel ?? reasons.items.find((reason) => reason.id === record.lostReasonId)?.label ?? 'Reason not recorded'}
                </p>
                {record.lostNotes ? <p className="mt-1.5 text-[0.6875rem] text-subtle">{record.lostNotes}</p> : null}
              </Card>
            ) : null}

            {record.status === 'won' ? (
              <Card className="border-success/30 p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Trophy className="size-4 text-success-fg" aria-hidden />
                  Won
                </h2>
                <p className="mt-2 text-xs text-muted">
                  Closed {formatDate(record.actualCloseDate)} after {record.cycleTimeDays ?? '—'} days in the pipeline.
                </p>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- form */

const dealFormSchema = z.object({
  name: z.string().min(3, 'Give the deal a recognisable name'),
  accountId: z.string().min(1, 'Choose an account'),
  amount: z.string().min(1, 'Enter an amount').refine((value) => Number(value) > 0, 'Enter an amount greater than zero'),
  pipelineId: z.string().min(1, 'Choose a pipeline'),
  stageId: z.string().min(1, 'Choose a stage'),
  expectedCloseDate: z.string().min(1, 'Choose an expected close date'),
  probability: z.string().refine((value) => Number(value) >= 0 && Number(value) <= 100, 'Enter a probability between 0 and 100'),
  forecastCategory: z.enum(['pipeline', 'best_case', 'commit', 'closed_won', 'closed_lost', 'omitted']),
  nextStep: z.string().optional(),
  notes: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealFormSchema>;

export function DealForm() {
  const services = useServices();
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId: string }>();
  const isEdit = Boolean(dealId);

  const existing = useAsync(() => services.deals.get(dealId ?? ''), [dealId], { skip: !isEdit });
  const accounts = useList(() => services.accounts.list({ pageSize: 200 }), []);
  const pipelines = useList(() => services.pipelines.list(), []);
  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const [ownerId, setOwnerId] = React.useState('');

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      probability: '15',
      forecastCategory: 'pipeline',
      expectedCloseDate: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
    },
    mode: 'onBlur',
  });

  const watchedPipelineId = form.watch('pipelineId');
  const selectedPipeline =
    pipelines.items.find((pipeline) => pipeline.id === watchedPipelineId) ?? pipelines.items[0];

  React.useEffect(() => {
    if (!existing.data) return;
    form.reset({
      name: existing.data.name,
      accountId: existing.data.accountId,
      amount: String(existing.data.amount.amount),
      pipelineId: existing.data.pipelineId,
      stageId: existing.data.stageId,
      expectedCloseDate: existing.data.expectedCloseDate.slice(0, 10),
      probability: String(existing.data.probability),
      forecastCategory: existing.data.forecastCategory,
      nextStep: existing.data.nextStep,
      notes: existing.data.notes,
    });
    setOwnerId(existing.data.ownerId);
  }, [existing.data, form]);

  // Default the pipeline and stage once the list arrives.
  React.useEffect(() => {
    if (watchedPipelineId || !selectedPipeline) return;
    form.setValue('pipelineId', selectedPipeline.id);
    const firstOpen = selectedPipeline.stages.find((stage) => stage.kind === 'open');
    if (firstOpen) {
      form.setValue('stageId', firstOpen.id);
      form.setValue('probability', String(firstOpen.probability));
      form.setValue('forecastCategory', firstOpen.forecastCategory);
    }
  }, [selectedPipeline, watchedPipelineId, form]);

  const save = useMutation(
    async (values: DealFormValues) => {
      const account = accounts.items.find((candidate) => candidate.id === values.accountId);
      const stage = selectedPipeline?.stages.find((candidate) => candidate.id === values.stageId);
      const payload = {
        name: values.name,
        accountId: values.accountId,
        accountName: account?.name ?? 'Account',
        pipelineId: values.pipelineId,
        stageId: values.stageId,
        status: stage?.kind === 'won' ? 'won' : stage?.kind === 'lost' ? 'lost' : 'open',
        amount: { amount: Number(values.amount), currency: selectedPipeline?.currency ?? 'USD' },
        pipelineCurrency: selectedPipeline?.currency ?? 'USD',
        probability: Number(values.probability),
        forecastCategory: values.forecastCategory,
        expectedCloseDate: values.expectedCloseDate,
        ownerId: ownerId || users.items[0]?.id,
        nextStep: values.nextStep || undefined,
        notes: values.notes || undefined,
        stageEnteredAt: new Date().toISOString(),
        daysInStage: 0,
        isStale: false,
      };
      if (isEdit && dealId) return services.deals.update(dealId, payload as never);
      return services.deals.create(payload as never);
    },
    {
      successMessage: isEdit ? 'Deal updated.' : 'Deal created.',
      onSuccess: (deal) => navigate(`/app/deals/${deal.id}`),
    },
  );

  return (
    <div className="pb-10">
      <PageHeader
        title={isEdit ? 'Edit deal' : 'New deal'}
        description="Choose a pipeline and stage, then set the amount and the expected close date. The stage determines the probability and the forecast category."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Deals', to: '/app/deals' }, { label: isEdit ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button variant="primary" size="sm" loading={save.pending} type="submit" form="deal-form">
              {isEdit ? 'Save changes' : 'Create deal'}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={isEdit && dealId ? `/app/deals/${dealId}` : '/app/deals'}>Cancel</Link>
            </Button>
          </>
        }
      />

      <form id="deal-form" className="space-y-5 p-4 sm:p-6" noValidate onSubmit={form.handleSubmit((values) => void save.run(values))}>
        {save.error ? (
          <Alert tone="danger" title="The deal was not saved">
            {save.error}
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">The opportunity</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Deal name" htmlFor="name" required error={form.formState.errors.name?.message} className="sm:col-span-2">
                <Input id="name" {...form.register('name')} placeholder="Northgate — enterprise roll-out" />
              </Field>

              <Field label="Account" htmlFor="accountId" required error={form.formState.errors.accountId?.message}>
                <Select
                  id="accountId"
                  value={form.watch('accountId')}
                  onValueChange={(value) => form.setValue('accountId', value, { shouldValidate: true })}
                  searchable
                  placeholder="Choose an account"
                  options={accounts.items.map((account) => ({
                    value: account.id,
                    label: account.name,
                    description: `${account.industryLabel ?? 'Industry not set'} · ${account.health}`,
                  }))}
                />
              </Field>

              <Field label="Owner" htmlFor="ownerId">
                <Select
                  id="ownerId"
                  value={ownerId}
                  onValueChange={setOwnerId}
                  searchable
                  placeholder="Choose an owner"
                  options={users.items
                    .filter((user) => ['sales_rep', 'sales_manager', 'account_manager', 'sales_director'].includes(user.persona))
                    .map((user) => ({ value: user.id, label: user.displayName, description: user.jobTitle }))}
                />
              </Field>

              <Field label="Amount" htmlFor="amount" required error={form.formState.errors.amount?.message} hint={selectedPipeline?.currency}>
                <Input id="amount" inputMode="decimal" {...form.register('amount')} placeholder="0" />
              </Field>

              <Field label="Expected close date" htmlFor="expectedCloseDate" required error={form.formState.errors.expectedCloseDate?.message}>
                <Input id="expectedCloseDate" type="date" {...form.register('expectedCloseDate')} />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Pipeline and forecast</h2>
            <div className="mt-4 space-y-4">
              <Field label="Pipeline" htmlFor="pipelineId" required>
                <Select
                  id="pipelineId"
                  value={watchedPipelineId}
                  onValueChange={(value) => {
                    form.setValue('pipelineId', value, { shouldValidate: true });
                    const pipeline = pipelines.items.find((candidate) => candidate.id === value);
                    const firstOpen = pipeline?.stages.find((stage) => stage.kind === 'open');
                    if (firstOpen) {
                      form.setValue('stageId', firstOpen.id);
                      form.setValue('probability', String(firstOpen.probability));
                      form.setValue('forecastCategory', firstOpen.forecastCategory);
                    }
                  }}
                  options={pipelines.items.map((pipeline) => ({
                    value: pipeline.id,
                    label: pipeline.name,
                    description: `${pipeline.stages.length} stages · ${pipeline.currency}`,
                  }))}
                />
              </Field>

              <Field label="Stage" htmlFor="stageId" required description="The stage sets the probability and the forecast category.">
                <Select
                  id="stageId"
                  value={form.watch('stageId')}
                  onValueChange={(value) => {
                    form.setValue('stageId', value, { shouldValidate: true });
                    const stage = selectedPipeline?.stages.find((candidate) => candidate.id === value);
                    if (stage) {
                      form.setValue('probability', String(stage.probability));
                      form.setValue('forecastCategory', stage.forecastCategory);
                    }
                  }}
                  options={(selectedPipeline?.stages ?? []).map((stage) => ({
                    value: stage.id,
                    label: stage.name,
                    description: `${stage.probability}% · ${stage.forecastCategory.replace(/_/g, ' ')}`,
                  }))}
                />
              </Field>

              <Field label="Probability" htmlFor="probability" hint="Driven by the stage">
                <Input id="probability" type="number" min={0} max={100} {...form.register('probability')} />
              </Field>

              <Field label="Forecast category" htmlFor="forecastCategory">
                <Select
                  id="forecastCategory"
                  value={form.watch('forecastCategory')}
                  onValueChange={(value) => form.setValue('forecastCategory', value as DealFormValues['forecastCategory'], { shouldDirty: true })}
                  options={[
                    { value: 'pipeline', label: 'Pipeline', description: 'Early, not yet qualified' },
                    { value: 'best_case', label: 'Best case', description: 'Could close this period' },
                    { value: 'commit', label: 'Commit', description: 'Will close this period' },
                    { value: 'omitted', label: 'Omitted', description: 'Excluded from the forecast' },
                  ]}
                />
              </Field>

              <Field label="Next step" htmlFor="nextStep" hint="Optional">
                <Input id="nextStep" {...form.register('nextStep')} placeholder="What happens next, and who owns it" />
              </Field>

              <Field label="Notes" htmlFor="notes" hint="Optional">
                <Textarea id="notes" rows={3} {...form.register('notes')} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link to={isEdit && dealId ? `/app/deals/${dealId}` : '/app/deals'}>Cancel</Link>
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={save.pending}>
            {isEdit ? 'Save changes' : 'Create deal'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ forecast */

export function Forecast() {
  const services = useServices();
  // Only the explicit choice is stored; the fallback to the first pipeline is derived, so no
  // effect is needed to seed it.
  const [pipelineId, setPipelineId] = React.useState('');

  const pipelines = useList(() => services.pipelines.list(), []);
  const forecast = useAsync(() => services.deals.forecast(pipelineId || undefined), [pipelineId]);
  const accuracy = useList(() => services.analytics.forecastAccuracy(), []);

  return (
    <div className="pb-10">
      <PageHeader
        title="Forecast"
        description="Commit, best case and pipeline rolled up from deal stages. Nothing is entered by hand, which is why it reconciles with the board."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Deals' }, { label: 'Forecast' }]}
        actions={
          <Select
            value={pipelineId}
            onValueChange={setPipelineId}
            placeholder="All pipelines"
            options={pipelines.items.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }))}
            selectSize="sm"
            className="w-[13rem]"
            aria-label="Pipeline"
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {forecast.loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg bg-inset" />
            ))}
          </div>
        ) : forecast.data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Quota" value={formatMoney(forecast.data.quota.amount, forecast.data.currency, true)} hint="Derived from the open pipeline and closed revenue" />
              <KpiCard label="Commit" value={formatMoney(forecast.data.commit.amount, forecast.data.currency, true)} visual={<InlineBar value={(forecast.data.commit.amount / Math.max(1, forecast.data.quota.amount)) * 100} />} />
              <KpiCard label="Best case" value={formatMoney(forecast.data.bestCase.amount, forecast.data.currency, true)} visual={<InlineBar value={(forecast.data.bestCase.amount / Math.max(1, forecast.data.quota.amount)) * 100} />} />
              <KpiCard
                label="Coverage"
                value={`${forecast.data.coverageRatio}×`}
                delta={{ text: `confidence ${forecast.data.confidence}`, direction: 'flat' }}
                hint={`Gap to quota ${formatMoney(forecast.data.gapToQuota.amount, forecast.data.currency, true)}`}
              />
            </div>

            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                <Target className="size-4 text-subtle" aria-hidden />
                By owner
              </h2>
              <p className="mt-1 text-xs text-muted">
                Each row reconciles with the deals that owner holds. Attainment is measured against the quota derived
                from the pipeline, not a figure typed into a spreadsheet.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">Forecast by owner</caption>
                  <thead>
                    <tr>
                      {['Owner', 'Quota', 'Commit', 'Best case', 'Closed won', 'Attainment'].map((heading, index) => (
                        <th
                          key={heading}
                          scope="col"
                          className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', index === 0 ? 'text-start' : 'text-end')}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(forecast.data.byRep ?? []).map((row) => (
                      <tr key={row.userId} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <Avatar name={row.name} size="xs" tone="violet" />
                            <span className="truncate text-xs text-fg">{row.name}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{formatMoney(row.quota, forecast.data!.currency, true)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-fg">{formatMoney(row.commit, forecast.data!.currency, true)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{formatMoney(row.bestCase, forecast.data!.currency, true)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-fg">{formatMoney(row.closedWon, forecast.data!.currency, true)}</td>
                        <td className="px-3 py-2 text-end">
                          <InlineBar value={row.attainmentPercent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {forecast.data.commentary ? (
              <Alert tone="info" title="What the numbers say">
                {forecast.data.commentary}
              </Alert>
            ) : null}

            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                <CalendarClock className="size-4 text-subtle" aria-hidden />
                Forecast accuracy
              </h2>
              <p className="mt-1 text-xs text-muted">
                How close previous commit and forecast submissions were to the revenue that actually closed. Tracking
                this is what makes a forecast trustworthy over time.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">Forecast accuracy by period</caption>
                  <thead>
                    <tr>
                      {['Period', 'Commit at start', 'Forecast at start', 'Closed won', 'Commit accuracy', 'Forecast accuracy'].map((heading, index) => (
                        <th
                          key={heading}
                          scope="col"
                          className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', index === 0 ? 'text-start' : 'text-end')}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accuracy.items.map((row) => (
                      <tr key={row.periodLabel} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-3 py-2 text-xs text-fg">{row.periodLabel}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{formatMoney(row.commitAtPeriodStart, forecast.data!.currency, true)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{formatMoney(row.forecastAtPeriodStart, forecast.data!.currency, true)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-fg">{formatMoney(row.closedWon, forecast.data!.currency, true)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{row.commitAccuracyPercent}%</td>
                        <td className="px-3 py-2 text-end">
                          <InlineBar value={row.forecastAccuracyPercent} tone="teal" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          <Alert tone="warning" title="No forecast available">
            The forecast needs at least one pipeline with open deals.
          </Alert>
        )}

        <p className="text-[0.625rem] leading-relaxed text-faint">
          Forecast arithmetic runs in your browser over the seeded dataset. No forecasting service is called, and
          neither tax nor currency conversion is ever applied to these figures.
        </p>
      </div>
    </div>
  );
}

export { Building2 };
