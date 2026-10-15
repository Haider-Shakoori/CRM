'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, CalendarCheck, CalendarClock, ListChecks, RefreshCw, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  AccountHealthScore,
  BusinessReview,
  ChurnRiskRow,
  CustomerSuccessOverview,
  HealthBand,
  OnboardingPlan,
  OnboardingTask,
  Renewal,
  SuccessObjective,
  SuccessPlan,
} from '@crm/shared-types';
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
  DonutChart,
  InlineBar,
  MiniStat,
  Pagination,
  Progress,
  ScoreRing,
  Select,
  StatusBadge,
  TonePill,
  cn,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
  RecordEmptyState,
  RecordHeader,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Customer success screens.
 *
 * The health model is the honesty-critical part of this module. Its score never appears alone:
 * every screen that shows a number also shows the weighted components that produced it, the
 * rationale behind each component and the signals that moved it, because a bare "amber" is a
 * claim the interface cannot support. The renewal pipeline is presented as its own board, kept
 * visibly separate from new-business deals.
 *
 * Where the demo derives a trend it cannot fetch, the panel says so rather than implying a
 * measured history.
 */

/* ------------------------------------------------------------------ vocab */

const BAND_LABEL: Record<HealthBand, string> = {
  thriving: 'Thriving',
  healthy: 'Healthy',
  watch: 'Watch',
  at_risk: 'At risk',
  critical: 'Critical',
  unknown: 'Unknown',
};

const BAND_TONE: Record<HealthBand, Tone> = {
  thriving: 'green',
  healthy: 'teal',
  watch: 'amber',
  at_risk: 'red',
  critical: 'red',
  unknown: 'slate',
};

const RENEWAL_STAGES: Renewal['stage'][] = ['upcoming', 'outreach', 'negotiation', 'commit', 'won', 'lost', 'churned'];

const STAGE_LABEL: Record<Renewal['stage'], string> = {
  upcoming: 'Upcoming',
  outreach: 'Outreach',
  negotiation: 'Negotiation',
  commit: 'Commit',
  won: 'Won',
  lost: 'Lost',
  churned: 'Churned',
};

const OBJECTIVE_STATUSES: SuccessObjective['status'][] = ['not_started', 'on_track', 'at_risk', 'off_track', 'achieved'];
const TASK_STATUSES: OnboardingTask['status'][] = ['not_started', 'in_progress', 'blocked', 'completed'];

function humanise(value: string): string {
  return value.replace(/_/g, ' ');
}

function asFilter(id: string, field: string, value: string) {
  return { id, conjunction: 'and' as const, clauses: [{ field, operator: 'eq' as const, value }] };
}

/* ------------------------------------------------------------ shared bits */

function BandPill({ band }: { band: HealthBand }) {
  return (
    <TonePill tone={BAND_TONE[band]} dot={false}>
      {BAND_LABEL[band]}
    </TonePill>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-2xs text-muted">no change</span>;
  const up = delta > 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-2xs font-medium', up ? 'text-success-fg' : 'text-danger-fg')}>
      {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {up ? '+' : ''}
      {delta}
    </span>
  );
}

/**
 * The explainability block: one row per weighted component.
 *
 * The weight is rendered as a percentage so the reader can confirm the model sums to 100.
 */
function HealthComponents({ score }: { score: AccountHealthScore }) {
  const weightTotal = score.components.reduce((sum, component) => sum + component.weight, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-fg">Weighted components</span>
        <span className="text-2xs tabular-nums text-faint">weights total {Math.round(weightTotal * 100)}%</span>
      </div>
      <ul className="space-y-3">
        {score.components.map((component) => (
          <li key={component.key} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-xs font-medium text-fg">
                {component.label}
                <span className="ms-1.5 font-normal text-faint">{Math.round(component.weight * 100)}% weight</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted">{component.score}/100</span>
                <DeltaChip delta={component.trend} />
              </span>
            </div>
            <Progress value={component.score} tone={component.score >= 70 ? 'green' : component.score >= 45 ? 'amber' : 'red'} size="xs" />
            <p className="text-[0.6875rem] leading-relaxed text-faint">{component.rationale}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HealthSignals({ score }: { score: AccountHealthScore }) {
  if (score.signals.length === 0) {
    return <p className="text-xs text-muted">No movement signals are recorded against this account.</p>;
  }
  return (
    <ul className="space-y-2">
      {score.signals.map((signal) => (
        <li key={signal.id} className="flex items-start gap-2.5 rounded-md border border-border-subtle bg-inset p-2.5">
          <span
            className={cn(
              'mt-1 size-2 shrink-0 rounded-full',
              signal.direction === 'positive' ? 'bg-[var(--success)]' : signal.direction === 'negative' ? 'bg-[var(--danger)]' : 'bg-[var(--border-strong)]',
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-fg">{signal.label}</p>
            <p className="mt-0.5 text-[0.6875rem] text-faint">
              {signal.severity} severity · detected {formatDate(signal.detectedAt, 'relative')}
            </p>
            {signal.suggestedAction ? <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">Suggested: {signal.suggestedAction}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Illustrative weekly distribution. Says so, and offers the numbers to a screen reader. */
function HealthTrendStrip({ points }: { points: CustomerSuccessOverview['healthTrend'] }) {
  const max = Math.max(1, ...points.map((point) => point.thriving + point.healthy + point.watch + point.atRisk + point.critical));
  return (
    <figure className="space-y-3" aria-label="Illustrative health band distribution by week">
      <div className="flex items-end gap-2 overflow-x-auto pb-1">
        {points.map((point) => {
          const total = point.thriving + point.healthy + point.watch + point.atRisk + point.critical;
          const scale = total / max;
          return (
            <div key={point.date} className="flex w-11 shrink-0 flex-col items-center gap-1.5">
              <div className="flex w-6 flex-col justify-end overflow-hidden rounded bg-inset" style={{ height: 72 }} aria-hidden>
                <span style={{ height: `${(point.critical / Math.max(1, total)) * 72 * scale}px`, background: 'var(--danger)' }} />
                <span style={{ height: `${(point.atRisk / Math.max(1, total)) * 72 * scale}px`, background: 'var(--warning)' }} />
                <span style={{ height: `${(point.watch / Math.max(1, total)) * 72 * scale}px`, background: 'var(--info, var(--border-strong))' }} />
                <span style={{ height: `${(point.healthy / Math.max(1, total)) * 72 * scale}px`, background: 'var(--success)' }} />
                <span style={{ height: `${(point.thriving / Math.max(1, total)) * 72 * scale}px`, background: 'var(--success)' }} />
              </div>
              <span className="text-[0.625rem] text-faint">{point.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.date}>
            {point.date}: {point.thriving} thriving, {point.healthy} healthy, {point.watch} watch, {point.atRisk} at risk, {point.critical} critical.
          </li>
        ))}
      </ul>
      <figcaption className="text-[0.6875rem] leading-relaxed text-faint">
        The weekly shape is an illustrative series derived from the current band distribution. It is not a measured history.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------- dashboard */

export function CustomerSuccessDashboard() {
  const services = useServices();
  const navigate = useNavigate();

  const overview = useAsync(() => services.customerSuccess.overview(), []);
  const health = useList(() => services.customerSuccess.healthScores({ pageSize: 200, sort: [{ field: 'score', direction: 'asc' }] }), []);
  const [riskPage, setRiskPage] = React.useState(1);
  const churn = useList(() => services.customerSuccess.churnRisk({ page: riskPage, pageSize: 8 }), [riskPage]);
  const voc = useAsync(() => services.customerSuccess.voiceOfCustomer(), []);

  const recompute = useMutation(
    (accountIds: string[]) => services.customerSuccess.recomputeHealth(accountIds),
    {
      simulated: true,
      successMessage: (result) => `Recomputed ${result.succeeded} of ${result.requested} health score(s) in the local demo store.`,
      onSuccess: () => {
        health.reload();
        churn.reload();
        overview.reload();
      },
    },
  );

  const metrics = overview.data?.metrics;

  const churnColumns = React.useMemo<ColumnDef<ChurnRiskRow, unknown>[]>(
    () => [
      {
        id: 'account',
        header: 'Account',
        accessorKey: 'accountName',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={`/app/customer-success/accounts/${row.original.accountId}`}
              onClick={(event) => event.stopPropagation()}
              className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
            >
              {row.original.accountName}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.ownerName}</span>
          </div>
        ),
      },
      {
        id: 'health',
        header: 'Health',
        accessorKey: 'healthScore',
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <BandPill band={row.original.healthBand} />
            <span className="text-2xs tabular-nums text-muted">{row.original.healthScore}</span>
          </span>
        ),
      },
      { id: 'riskbar', header: 'Renewal risk', accessorKey: 'riskPercent', cell: ({ row }) => <InlineBar value={row.original.riskPercent} /> },
      {
        id: 'arr',
        header: 'ARR',
        accessorKey: 'arr',
        cell: ({ row }) => <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.arr.amount, row.original.arr.currency, true)}</span>,
      },
      {
        id: 'renewal',
        header: 'Renewal',
        accessorKey: 'renewalDate',
        cell: ({ row }) => <span className="text-xs text-muted">{row.original.renewalDate ? formatDate(row.original.renewalDate) : '—'}</span>,
      },
      {
        id: 'drivers',
        header: 'Primary risk',
        accessorKey: 'primaryRiskFactor',
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="text-xs text-muted">{row.original.primaryRiskFactor}</span>
            <span className="mt-0.5 text-[0.6875rem] text-faint">
              {row.original.riskFactorCount} factor(s) · {row.original.openTickets} open ticket(s)
            </span>
          </span>
        ),
      },
    ],
    [],
  );

  const portfolioColumns = React.useMemo<ColumnDef<NonNullable<CustomerSuccessOverview['portfolioPerformance']>[number], unknown>[]>(
    () => [
      { id: 'name', header: 'Portfolio', accessorKey: 'name', cell: ({ row }) => <span className="text-xs font-medium text-fg">{row.original.name}</span> },
      { id: 'owner', header: 'Owner', accessorKey: 'ownerName', cell: ({ row }) => <span className="text-xs text-muted">{row.original.ownerName}</span> },
      { id: 'accounts', header: 'Accounts', accessorKey: 'accounts', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.accounts}</span> },
      { id: 'health', header: 'Avg health', accessorKey: 'averageHealth', cell: ({ row }) => <InlineBar value={row.original.averageHealth} /> },
      {
        id: 'arr',
        header: 'ARR',
        accessorKey: 'arr',
        cell: ({ row }) => <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.arr, metrics?.arr.currency ?? 'USD', true)}</span>,
      },
      { id: 'atRisk', header: 'At risk', accessorKey: 'atRisk', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.atRisk}</span> },
      { id: 'due', header: 'Renewals 90d', accessorKey: 'renewals90', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.renewals90}</span> },
    ],
    [metrics?.arr.currency],
  );

  const managerColumns = React.useMemo<ColumnDef<NonNullable<CustomerSuccessOverview['successManagerPerformance']>[number], unknown>[]>(
    () => [
      { id: 'name', header: 'Success manager', accessorKey: 'name', cell: ({ row }) => <span className="text-xs font-medium text-fg">{row.original.name}</span> },
      { id: 'accounts', header: 'Accounts', accessorKey: 'accounts', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.accounts}</span> },
      { id: 'health', header: 'Avg health', accessorKey: 'averageHealth', cell: ({ row }) => <InlineBar value={row.original.averageHealth} /> },
      { id: 'reviews', header: 'Reviews', accessorKey: 'reviewsCompleted', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.reviewsCompleted}</span> },
      { id: 'won', header: 'Renewals won', accessorKey: 'renewalsWon', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.renewalsWon}</span> },
      { id: 'nrr', header: 'NRR', accessorKey: 'nrr', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.nrr}%</span> },
      { id: 'nps', header: 'NPS', accessorKey: 'nps', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.nps}</span> },
    ],
    [],
  );

  if (overview.loading) {
    return (
      <div className="p-6">
        <ListSkeleton rows={8} columns={4} />
      </div>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <div className="p-6">
        <RecordEmptyState
          title="The customer success overview could not be loaded"
          body={overview.error ?? 'No overview was returned.'}
          hints={['Retry the request.', 'Check that the customer success service is wired into the container.']}
          primaryAction={{ label: 'Retry', onClick: overview.reload }}
        />
      </div>
    );
  }

  const data = overview.data;

  return (
    <div className="pb-8">
      <PageHeader
        title="Customer success"
        description="Explainable health scores, an account-level risk list, the renewal pipeline kept separate from new business, and the voice of the customer."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customer success' }]}
        actions={
          <>
            <Button variant="secondary" size="sm" leadingIcon={<Activity className="size-3.5" />} asChild>
              <Link to="/app/customer-success/onboarding">Onboarding</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<CalendarClock className="size-3.5" />} asChild>
              <Link to="/app/customer-success/renewals">Renewals</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<CalendarCheck className="size-3.5" />} asChild>
              <Link to="/app/customer-success/reviews">Reviews</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<ListChecks className="size-3.5" />} asChild>
              <Link to="/app/customer-success/playbooks">Playbooks</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={recompute.pending}
              disabled={health.items.length === 0}
              leadingIcon={<RefreshCw className="size-3.5" />}
              onClick={() => void recompute.run(health.items.map((row) => row.accountId))}
            >
              Recompute health
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <MiniStat label="Accounts" value={formatNumber(data.metrics.totalAccounts)} tone="violet" />
          <MiniStat label="At risk" value={formatNumber(data.metrics.accountsAtRisk)} tone="red" />
          <MiniStat label="Average health" value={`${data.metrics.averageHealthScore}/100`} tone="teal" />
          <MiniStat label="ARR" value={formatMoney(data.metrics.arr.amount, data.metrics.arr.currency, true)} tone="blue" />
          <MiniStat label="NRR" value={`${data.metrics.nrr}%`} tone="green" />
          <MiniStat label="Renewals due 90d" value={formatNumber(data.metrics.renewalsDue90Days)} tone="amber" />
        </div>

        <DemoNotice tone="neutral">
          Health scores are produced by a weighted demonstration model. Recomputing writes a fresh snapshot to the local demo store only; no score is sent anywhere.
        </DemoNotice>

        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart
            title="Health distribution"
            description="Accounts by band, with the ARR each band represents."
            segments={data.healthDistribution.filter((segment) => segment.count > 0).map((segment) => ({ label: segment.label, value: segment.count, tone: segment.tone }))}
            centreValue={formatNumber(data.metrics.totalAccounts)}
            centreLabel="accounts"
            formatValue={(value) => formatNumber(value)}
            insight={`${data.metrics.accountsAtRisk} account(s) sit at risk or critical across ${formatMoney(data.metrics.arr.amount, data.metrics.arr.currency, true)} of ARR.`}
          />
          <Card>
            <CardHeader>
              <CardTitle>Health trend</CardTitle>
            </CardHeader>
            <CardContent>
              <HealthTrendStrip points={data.healthTrend} />
            </CardContent>
          </Card>
        </div>

        <section aria-labelledby="churn-risk-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="churn-risk-heading" className="text-sm font-semibold text-fg">
              Churn risk
            </h2>
            <p className="text-2xs text-faint">Risk is derived from the health model, renewal factors and open tickets.</p>
          </div>
          {churn.loading ? (
            <ListSkeleton rows={6} columns={5} />
          ) : (
            <DataTable
              columns={churnColumns}
              data={churn.items}
              getRowId={(row) => row.accountId}
              onRowClick={(row) => navigate(`/app/customer-success/accounts/${row.accountId}`)}
              emptyState={
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-fg">No accounts carry a renewal risk</p>
                  <p className="mt-1 text-xs text-muted">Either every account is healthy, or no accounts are in scope for this tenant.</p>
                </div>
              }
              footer={churn.meta ? <Pagination page={churn.meta.page} pageSize={churn.meta.pageSize} total={churn.meta.total} onPageChange={setRiskPage} /> : null}
            />
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio performance</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {data.portfolioPerformance.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted">No portfolios are defined for this tenant.</p>
              ) : (
                <DataTable columns={portfolioColumns} data={data.portfolioPerformance} getRowId={(row) => row.portfolioId} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success manager performance</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {data.successManagerPerformance.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted">No accounts are assigned to a success manager.</p>
              ) : (
                <DataTable columns={managerColumns} data={data.successManagerPerformance} getRowId={(row) => row.userId} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Feature adoption</CardTitle>
              <span className="text-2xs tabular-nums text-faint">{data.adoption.averageFeatureAdoptionPercent}% average</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2.5">
                {data.adoption.byFeature.map((feature) => (
                  <li key={feature.featureKey} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted">{feature.label}</span>
                    <InlineBar value={feature.adoptionPercent} />
                  </li>
                ))}
              </ul>
              <DemoNotice tone="neutral">Adoption figures are derived from the seeded dataset, not a usage-metering service.</DemoNotice>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Voice of the customer</CardTitle>
              <span className="text-2xs text-faint">{voc.data?.periodLabel ?? ''}</span>
            </CardHeader>
            <CardContent className="space-y-4">
              {voc.loading ? (
                <ListSkeleton rows={3} columns={2} />
              ) : voc.error || !voc.data ? (
                <Alert tone="warning" title="Survey data could not be loaded">
                  {voc.error ?? 'No response was returned.'}
                </Alert>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="NPS" value={`${voc.data.nps.score}`} tone="violet" delta={{ text: `${voc.data.nps.responses} responses`, direction: 'flat' }} />
                    <MiniStat label="CSAT" value={voc.data.csat.score ? `${voc.data.csat.score.toFixed(2)} / 5` : '—'} tone="teal" />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-fg">Promoters · Passives · Detractors</p>
                    <p className="text-xs tabular-nums text-muted">
                      {voc.data.nps.promoters} · {voc.data.nps.passives} · {voc.data.nps.detractors}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-fg">Themes from comments</p>
                    {voc.data.themes.length === 0 ? (
                      <p className="text-xs text-muted">No free-text comments are available to group into themes.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {voc.data.themes.slice(0, 5).map((theme) => (
                          <li key={theme.label} className="flex items-center justify-between gap-3">
                            <span className="truncate text-xs text-muted">{theme.label}</span>
                            <span className="flex items-center gap-2">
                              <Badge variant={theme.sentiment === 'positive' ? 'success' : theme.sentiment === 'negative' ? 'danger' : 'outline'} size="sm">
                                {theme.mentions}
                              </Badge>
                              <span className="text-2xs tabular-nums text-faint">{theme.changePercent > 0 ? '+' : ''}{theme.changePercent}%</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <DemoNotice tone="neutral">Themes are counted from seeded survey comments by keyword, not by a language model.</DemoNotice>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {data.churnReasons.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Reasons behind contraction and churn</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border-subtle">
                {data.churnReasons.map((reason) => (
                  <li key={reason.reason} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-xs text-muted">{reason.reason}</span>
                    <span className="flex items-center gap-3 text-2xs tabular-nums text-faint">
                      <span>{reason.count} renewal(s)</span>
                      <span className="text-fg">{formatMoney(reason.arrLost, data.metrics.arr.currency, true)} at risk</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/** The dashboard is also the default export, so the index route can import it either way. */
export default CustomerSuccessDashboard;

/* ------------------------------------------------------------ renewals */

export function RenewalBoard() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState<'all' | Renewal['stage']>('all');
  const [page, setPage] = React.useState(1);

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 200,
      q: search || undefined,
      filter: stageFilter !== 'all' ? asFilter('renewal-stage', 'stage', stageFilter) : undefined,
      sort: [{ field: 'daysUntilRenewal', direction: 'asc' as const }],
    }),
    [page, search, stageFilter],
  );

  const renewals = useList(() => services.customerSuccess.renewals(query as never), [JSON.stringify(query)]);

  const moveStage = useMutation(
    (input: { id: string; stage: Renewal['stage'] }) => services.customerSuccess.updateRenewal(input.id, { stage: input.stage }),
    { successMessage: 'Renewal stage updated.', onSuccess: () => renewals.reload() },
  );

  const items = renewals.items;
  const totalValue = items.reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);
  const atRiskValue = items
    .filter((renewal) => renewal.healthBand === 'at_risk' || renewal.healthBand === 'critical')
    .reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);
  const currency = items[0]?.currentValue.currency ?? 'USD';

  const grouped = React.useMemo(() => {
    const map = new Map<Renewal['stage'], Renewal[]>();
    for (const stage of RENEWAL_STAGES) map.set(stage, []);
    for (const renewal of items) map.get(renewal.stage)?.push(renewal);
    return map;
  }, [items]);

  return (
    <div className="pb-8">
      <PageHeader
        title="Renewals"
        description="The renewal pipeline, tracked as its own motion rather than as new-business deals."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customer success', to: '/app/customer-success' }, { label: 'Renewals' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search account, contract or owner"
            resultCount={renewals.meta ? `${renewals.meta.total.toLocaleString()} renewals` : undefined}
            chips={stageFilter !== 'all' ? [{ id: 'stage', label: `Stage: ${STAGE_LABEL[stageFilter]}`, tone: 'brand' as const, onRemove: () => setStageFilter('all') }] : []}
            onClearFilters={() => {
              setStageFilter('all');
              setSearch('');
            }}
            actions={
              <Select
                value={stageFilter}
                onValueChange={(value) => {
                  setStageFilter(value as typeof stageFilter);
                  setPage(1);
                }}
                options={[{ value: 'all', label: 'All stages' }, ...RENEWAL_STAGES.map((stage) => ({ value: stage, label: STAGE_LABEL[stage] }))]}
                selectSize="sm"
                className="w-[11rem]"
                aria-label="Filter renewals by stage"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Renewals in view" value={formatNumber(items.length)} tone="violet" />
          <MiniStat label="Current value" value={formatMoney(totalValue, currency, true)} tone="blue" />
          <MiniStat label="Value at risk" value={formatMoney(atRiskValue, currency, true)} tone="red" />
          <MiniStat
            label="Due within 30 days"
            value={formatNumber(items.filter((renewal) => renewal.daysUntilRenewal >= 0 && renewal.daysUntilRenewal <= 30).length)}
            tone="amber"
          />
        </div>

        <DemoNotice tone="neutral">
          Renewal opportunities are separate from new-business deals by design. Changing a stage records the change in the local demo store only.
        </DemoNotice>

        {renewals.loading ? (
          <ListSkeleton rows={6} columns={4} />
        ) : items.length === 0 ? (
          <RecordEmptyState
            title="No renewals match this view"
            body="Adjust the stage filter or clear the search to see the rest of the renewal pipeline."
            primaryAction={{ label: 'Clear filters', onClick: () => { setStageFilter('all'); setSearch(''); } }}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {RENEWAL_STAGES.map((stage) => {
              const columnItems = grouped.get(stage) ?? [];
              const columnValue = columnItems.reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);
              return (
                <section key={stage} aria-label={STAGE_LABEL[stage]} className="rounded-lg border border-border-subtle bg-inset">
                  <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
                    <span className="text-xs font-semibold text-fg">{STAGE_LABEL[stage]}</span>
                    <span className="text-2xs tabular-nums text-faint">
                      {columnItems.length} · {formatMoney(columnValue, currency, true)}
                    </span>
                  </header>
                  <ul className="space-y-2 p-2">
                    {columnItems.length === 0 ? (
                      <li className="px-1 py-3 text-center text-[0.6875rem] text-faint">Nothing in this stage.</li>
                    ) : (
                      columnItems.map((renewal) => (
                        <li key={renewal.id} className="rounded-md border border-border-subtle bg-surface p-2.5">
                          <Link
                            to={`/app/customer-success/accounts/${renewal.accountId}`}
                            className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
                          >
                            {renewal.accountName}
                          </Link>
                          <p className="mt-0.5 truncate text-[0.6875rem] text-faint">{renewal.contractReference}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <BandPill band={renewal.healthBand} />
                            <Badge variant="outline" size="sm">
                              {renewal.changeKind}
                            </Badge>
                          </div>
                          <dl className="mt-2 space-y-1 text-[0.6875rem]">
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-faint">Value</dt>
                              <dd className="tabular-nums text-fg">{formatMoney(renewal.currentValue.amount, renewal.currentValue.currency, true)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-faint">Renewal</dt>
                              <dd className="text-muted">{formatDate(renewal.renewalDate)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-faint">Probability</dt>
                              <dd className="tabular-nums text-muted">{renewal.probability}%</dd>
                            </div>
                          </dl>
                          <div className="mt-2">
                            <Select
                              value={renewal.stage}
                              onValueChange={(value) => void moveStage.run({ id: renewal.id, stage: value as Renewal['stage'] })}
                              options={RENEWAL_STAGES.map((candidate) => ({ value: candidate, label: STAGE_LABEL[candidate] }))}
                              selectSize="sm"
                              aria-label={`Move ${renewal.accountName} renewal stage`}
                            />
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- account panel */

export function AccountSuccessPanel() {
  const services = useServices();
  const { accountId } = useParams<{ accountId: string }>();
  const id = accountId ?? '';

  const accountFilter = React.useMemo(() => asFilter(`cs-account-${id || 'none'}`, 'accountId', id), [id]);

  const health = useAsync(() => services.customerSuccess.healthScore(id), [id], { skip: !id });
  const plans = useList(() => services.customerSuccess.successPlans({ pageSize: 5, filter: accountFilter }), [id]);
  const onboarding = useList(() => services.customerSuccess.onboardingPlans({ pageSize: 5, filter: accountFilter }), [id]);
  const reviews = useList(() => services.customerSuccess.businessReviews({ pageSize: 10, filter: accountFilter }), [id]);
  const renewals = useList(() => services.customerSuccess.renewals({ pageSize: 10, filter: accountFilter }), [id]);

  const updateObjective = useMutation(
    (input: { planId: string; objectiveId: string; status: SuccessObjective['status'] }) =>
      services.customerSuccess.updateObjective(input.planId, input.objectiveId, { status: input.status }),
    { successMessage: 'Objective status updated.', onSuccess: () => plans.reload() },
  );

  if (!id) {
    return (
      <div className="p-6">
        <RecordEmptyState title="No account was selected" body="Open an account from the churn risk list or the renewal board." />
      </div>
    );
  }

  if (health.loading) {
    return (
      <div className="p-6">
        <ListSkeleton rows={10} columns={3} />
      </div>
    );
  }

  if (health.error || !health.data) {
    return (
      <div className="p-6">
        <RecordEmptyState
          title="The success panel for this account could not be loaded"
          body={health.error ?? 'No health score or account exists for that id.'}
          primaryAction={{ label: 'Back to customer success', onClick: () => undefined }}
        />
      </div>
    );
  }

  const score = health.data;

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/customer-success', label: 'Customer success' }}
          title={score.accountName}
          subtitle={`Owned by ${score.ownerName}`}
          badges={<BandPill band={score.band} />}
          facts={[
            { label: 'Health', value: `${score.score}/100` },
            { label: 'Previous', value: `${score.previousScore}/100` },
            { label: 'Delta', value: <DeltaChip delta={score.delta} /> },
            { label: 'Renewal risk', value: `${score.renewalRiskPercent}%` },
            { label: 'Expansion', value: `${score.expansionProbabilityPercent}%` },
            { label: 'Sentiment', value: score.sentiment },
            { label: 'Computed', value: formatDate(score.computedAt, 'relative') },
          ]}
        />
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Why this score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <HealthComponents score={score} />
              <DemoNotice tone="neutral">{score.modelLabel}. Weights describe the demonstration model, not a prediction.</DemoNotice>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movement signals</CardTitle>
            </CardHeader>
            <CardContent>
              <HealthSignals score={score} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Success plans</CardTitle>
              <span className="text-2xs text-faint">{plans.meta?.total ?? 0} plan(s)</span>
            </CardHeader>
            <CardContent className="space-y-5">
              {plans.loading ? (
                <ListSkeleton rows={3} columns={2} />
              ) : plans.items.length === 0 ? (
                <p className="text-xs text-muted">No success plan is recorded on this account.</p>
              ) : (
                plans.items.map((plan: SuccessPlan) => (
                  <div key={plan.id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-fg">{plan.name}</span>
                      <span className="flex items-center gap-2">
                        <StatusBadge status={plan.status} size="sm" />
                        <span className="text-2xs tabular-nums text-faint">{plan.overallProgress}% overall</span>
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {plan.objectives.map((objective) => (
                        <li key={objective.id} className="rounded-md border border-border-subtle bg-inset p-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-fg">{objective.title}</p>
                              <p className="mt-0.5 text-[0.6875rem] text-faint">
                                {objective.metric}: {objective.currentValue ?? '—'} of {objective.targetValue}
                              </p>
                            </div>
                            <div className="w-36 shrink-0">
                              <Select
                                value={objective.status}
                                onValueChange={(value) =>
                                  void updateObjective.run({ planId: plan.id, objectiveId: objective.id, status: value as SuccessObjective['status'] })
                                }
                                options={OBJECTIVE_STATUSES.map((status) => ({ value: status, label: humanise(status) }))}
                                selectSize="sm"
                                aria-label={`Objective status for ${objective.title}`}
                              />
                            </div>
                          </div>
                          <div className="mt-2">
                            <Progress value={objective.progressPercent} tone={objective.tone} size="xs" showValue />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
              {updateObjective.error ? <Alert tone="danger" title="The objective could not be updated">{updateObjective.error}</Alert> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Business reviews</CardTitle>
              <span className="text-2xs text-faint">{reviews.meta?.total ?? 0} review(s)</span>
            </CardHeader>
            <CardContent>
              {reviews.loading ? (
                <ListSkeleton rows={3} columns={2} />
              ) : reviews.items.length === 0 ? (
                <p className="text-xs text-muted">No business review is scheduled for this account.</p>
              ) : (
                <ul className="space-y-2">
                  {reviews.items.map((review: BusinessReview) => (
                    <li key={review.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-inset p-2.5">
                      <span className="flex items-center gap-2">
                        <CalendarCheck className="size-3.5 text-subtle" aria-hidden />
                        <span className="text-xs text-fg">{humanise(review.kind)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-2xs text-faint">{formatDate(review.scheduledAt)}</span>
                        <StatusBadge status={review.status} size="sm" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Health score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <ScoreRing score={score.score} band={BAND_LABEL[score.band]} size={96} label="Health" />
              <div className="grid w-full grid-cols-2 gap-2">
                <MiniStat label="Renewal risk" value={`${score.renewalRiskPercent}%`} tone="red" />
                <MiniStat label="Expansion" value={`${score.expansionProbabilityPercent}%`} tone="green" />
              </div>
              <p className="text-[0.6875rem] leading-relaxed text-faint">
                {score.modelLabel}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Activity className="size-3.5 text-subtle" aria-hidden />
              <CardTitle>Onboarding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {onboarding.loading ? (
                <ListSkeleton rows={2} columns={1} />
              ) : onboarding.items.length === 0 ? (
                <p className="text-xs text-muted">No onboarding plan is linked to this account.</p>
              ) : (
                onboarding.items.map((plan: OnboardingPlan) => (
                  <div key={plan.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-fg">{plan.templateName ?? 'Onboarding'}</span>
                      <StatusBadge status={plan.status} size="sm" />
                    </div>
                    <Progress value={plan.progressPercent} tone="auto" size="sm" showValue />
                    <ul className="space-y-1.5">
                      {plan.phases.map((phase) => (
                        <li key={phase.id} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                          <span className="truncate text-muted">{phase.name}</span>
                          <span className="shrink-0 text-faint">{phase.progressPercent}%</span>
                        </li>
                      ))}
                    </ul>
                    {plan.blockers.length > 0 ? (
                      <p className="flex items-start gap-1.5 text-[0.6875rem] text-danger-fg">
                        <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {plan.blockers.length} open blocker(s)
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Renewals</CardTitle>
              <span className="text-2xs text-faint">{renewals.items.length}</span>
            </CardHeader>
            <CardContent>
              {renewals.loading ? (
                <ListSkeleton rows={2} columns={1} />
              ) : renewals.items.length === 0 ? (
                <p className="text-xs text-muted">No renewal is recorded for this account.</p>
              ) : (
                <ul className="space-y-2">
                  {renewals.items.map((renewal: Renewal) => (
                    <li key={renewal.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-fg">{renewal.contractReference}</span>
                        <span className="block text-[0.6875rem] text-faint">{formatDate(renewal.renewalDate)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <BandPill band={renewal.healthBand} />
                        <span className="text-2xs tabular-nums text-muted">{formatMoney(renewal.currentValue.amount, renewal.currentValue.currency, true)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- onboarding */

export function OnboardingBoard() {
  const services = useServices();
  const [statusFilter, setStatusFilter] = React.useState<'all' | OnboardingPlan['status']>('all');

  const query = React.useMemo(
    () => ({
      pageSize: 50,
      filter: statusFilter !== 'all' ? asFilter('onboarding-status', 'status', statusFilter) : undefined,
      sort: [{ field: 'updatedAt', direction: 'desc' as const }],
    }),
    [statusFilter],
  );

  const plans = useList(() => services.customerSuccess.onboardingPlans(query as never), [JSON.stringify(query)]);

  const updateTask = useMutation(
    (input: { planId: string; taskId: string; status: OnboardingTask['status'] }) =>
      services.customerSuccess.updateOnboardingTask(input.planId, input.taskId, { status: input.status }),
    { successMessage: 'Onboarding task updated.', onSuccess: () => plans.reload() },
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Onboarding"
        description="Plans created from a won deal, with the phases, tasks and blockers that decide time-to-value."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customer success', to: '/app/customer-success' }, { label: 'Onboarding' }]}
        footer={
          <FilterBar
            search=""
            onSearchChange={() => undefined}
            searchPlaceholder="Onboarding plans are grouped by status"
            resultCount={plans.meta ? `${plans.meta.total.toLocaleString()} plans` : undefined}
            actions={
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'All statuses' },
                  ...(['not_started', 'in_progress', 'blocked', 'paused', 'completed'] as OnboardingPlan['status'][]).map((status) => ({
                    value: status,
                    label: humanise(status),
                  })),
                ]}
                selectSize="sm"
                className="w-[12rem]"
                aria-label="Filter onboarding plans by status"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="neutral">
          Marking a task changes the record in the local demo store. No workflow runs and no notification is sent.
        </DemoNotice>

        {plans.loading ? (
          <ListSkeleton rows={8} columns={3} />
        ) : plans.items.length === 0 ? (
          <RecordEmptyState
            title="No onboarding plans match this view"
            body="Onboarding plans are created when a deal is won. Clear the status filter to see the seeded plans."
            primaryAction={{ label: 'Clear filter', onClick: () => setStatusFilter('all') }}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.items.map((plan: OnboardingPlan) => (
              <Card key={plan.id}>
                <CardHeader className="flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle as="h2">
                      <Link to={`/app/customer-success/accounts/${plan.accountId}`} className="hover:text-link hover:underline">
                        {plan.accountName}
                      </Link>
                    </CardTitle>
                    <p className="mt-0.5 text-[0.6875rem] text-faint">
                      {plan.templateName ?? 'Custom plan'} · manager {plan.managerName} · go-live {formatDate(plan.targetGoLiveDate)}
                    </p>
                  </div>
                  <StatusBadge status={plan.status} size="sm" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={plan.progressPercent} tone="auto" size="sm" showValue />
                  {plan.timeToFirstValueDays ? (
                    <p className="text-2xs text-muted">Time to first value: {plan.timeToFirstValueDays} days</p>
                  ) : null}
                  <div className="space-y-3">
                    {plan.phases.map((phase) => (
                      <div key={phase.id} className="rounded-md border border-border-subtle bg-inset p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-fg">
                            {phase.order}. {phase.name}
                          </span>
                          <StatusBadge status={phase.status} size="sm" />
                        </div>
                        <ul className="mt-2 space-y-2">
                          {phase.tasks.map((task) => (
                            <li key={task.id} className="flex flex-wrap items-center justify-between gap-2">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.6875rem] text-fg">{task.title}</span>
                                <span className="block text-[0.625rem] text-faint">
                                  {task.ownerKind === 'customer' ? 'Customer' : 'Internal'} · {task.ownerName}
                                  {task.isMilestone ? ' · milestone' : ''}
                                </span>
                              </span>
                              <span className="w-32 shrink-0">
                                <Select
                                  value={task.status}
                                  onValueChange={(value) => void updateTask.run({ planId: plan.id, taskId: task.id, status: value as OnboardingTask['status'] })}
                                  options={TASK_STATUSES.map((status) => ({ value: status, label: humanise(status) }))}
                                  selectSize="sm"
                                  aria-label={`Status for ${task.title}`}
                                />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {updateTask.error ? <Alert tone="danger" title="The task could not be updated">{updateTask.error}</Alert> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ business reviews */

export function BusinessReviewsBoard() {
  const services = useServices();
  const [statusFilter, setStatusFilter] = React.useState<'all' | BusinessReview['status']>('all');

  const query = React.useMemo(
    () => ({
      pageSize: 50,
      filter: statusFilter !== 'all' ? asFilter('review-status', 'status', statusFilter) : undefined,
      sort: [{ field: 'scheduledAt', direction: 'asc' as const }],
    }),
    [statusFilter],
  );

  const reviews = useList(() => services.customerSuccess.businessReviews(query as never), [JSON.stringify(query)]);

  const scheduledCount = reviews.items.filter((review) => review.status === 'scheduled').length;
  const completedCount = reviews.items.filter((review) => review.status === 'completed').length;

  return (
    <div className="pb-8">
      <PageHeader
        title="Business reviews"
        description="Quarterly, executive and onboarding reviews, with the agenda and actions recorded against each."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Customer success', to: '/app/customer-success' }, { label: 'Business reviews' }]}
        footer={
          <FilterBar
            search=""
            onSearchChange={() => undefined}
            searchPlaceholder="Business reviews are listed by scheduled date"
            resultCount={reviews.meta ? `${reviews.meta.total.toLocaleString()} reviews` : undefined}
            actions={
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'All statuses' },
                  ...(['scheduled', 'completed', 'draft', 'cancelled'] as BusinessReview['status'][]).map((status) => ({
                    value: status,
                    label: humanise(status),
                  })),
                ]}
                selectSize="sm"
                className="w-[11rem]"
                aria-label="Filter reviews by status"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniStat label="In view" value={formatNumber(reviews.items.length)} tone="violet" />
          <MiniStat label="Scheduled" value={formatNumber(scheduledCount)} tone="blue" />
          <MiniStat label="Completed" value={formatNumber(completedCount)} tone="green" />
        </div>

        {reviews.loading ? (
          <ListSkeleton rows={8} columns={3} />
        ) : reviews.items.length === 0 ? (
          <RecordEmptyState
            title="No business reviews match this view"
            body="Reviews are scheduled against accounts; clear the filter to see the seeded set."
            primaryAction={{ label: 'Clear filter', onClick: () => setStatusFilter('all') }}
          />
        ) : (
          <div className="space-y-3">
            {reviews.items.map((review: BusinessReview) => (
              <Card key={review.id}>
                <CardHeader className="flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle as="h2">
                      <Link to={`/app/customer-success/accounts/${review.accountId}`} className="hover:text-link hover:underline">
                        {review.accountName}
                      </Link>
                    </CardTitle>
                    <p className="mt-0.5 text-[0.6875rem] text-faint">
                      {humanise(review.kind)} · {formatDate(review.scheduledAt)} · {review.durationMinutes} min · {review.ownerName}
                    </p>
                  </div>
                  <StatusBadge status={review.status} size="sm" />
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-fg">Agenda</p>
                    <ul className="space-y-1.5">
                      {review.agendaItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                          <span className="truncate text-muted">{item.title}</span>
                          <span className="shrink-0 text-faint">
                            {item.durationMinutes}m{item.presenter ? ` · ${item.presenter}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-fg">Actions</p>
                    {review.actionItems && review.actionItems.length > 0 ? (
                      <ul className="space-y-1.5">
                        {review.actionItems.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                            <span className="truncate text-muted">{item.text}</span>
                            <Badge variant={item.done ? 'success' : 'outline'} size="sm">
                              {item.done ? 'done' : item.ownerName}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[0.6875rem] text-faint">No actions recorded for this review.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
