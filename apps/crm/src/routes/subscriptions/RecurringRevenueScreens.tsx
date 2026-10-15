'use client';

import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { RevenueSubscription } from '@crm/shared-types';
import {
  Button,
  Card,
  DataTable,
  DemoNotice,
  InlineBar,
  KpiCard,
  KpiRow,
  Pagination,
  Select,
  Sparkline,
  StatusBadge,
  cn,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';

/**
 * Recurring revenue screen.
 *
 * The honesty split is stated on the page itself, because the service behind it makes two
 * different kinds of number:
 *
 *   - **Record-derived:** the MRR/ARR totals, the movement bridge, the plan breakdown and
 *     the top accounts are computed from the active organization's subscription records.
 *   - **Illustrative:** the monthly trend, cohort grid, segment/region splits and renewal
 *     projections are shaped for layout demonstration. They are labelled where they appear,
 *     not implied to be ledger truth.
 *
 * There is deliberately no period selector: the service reports a trailing-twelve-month
 * window, and a control that changed nothing would be a lie.
 */

export default function RecurringRevenue() {
  const services = useServices();
  const navigate = useNavigate();
  const report = useAsync(() => services.subscriptionRevenue.report('ttm'), []);

  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('all');

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 25,
      q: search || undefined,
      sort: [{ field: 'mrr', direction: 'desc' as const }],
      filter:
        statusFilter === 'all'
          ? undefined
          : {
              id: 'subscription-status',
              conjunction: 'and' as const,
              clauses: [{ field: 'status', operator: 'eq' as const, value: statusFilter }] as never,
            },
    }),
    [page, search, statusFilter],
  );
  const subscriptions = useList(() => services.subscriptionRevenue.list(query), [JSON.stringify(query)]);

  const columns = React.useMemo<ColumnDef<RevenueSubscription, unknown>[]>(
    () => [
      {
        id: 'reference',
        header: 'Subscription',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate font-mono text-xs font-medium text-fg">{row.original.reference}</span>
            <Link to={`/app/accounts/${row.original.accountId}`} className="mt-0.5 block truncate text-[0.6875rem] text-faint hover:text-link hover:underline">
              {row.original.accountName}
            </Link>
          </div>
        ),
      },
      { id: 'plan', header: 'Plan', accessorKey: 'planName', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.planName}</span> },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'mrr',
        header: 'MRR',
        accessorFn: (subscription) => subscription.mrr.amount,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.mrr.amount, row.original.currency)}</span>,
      },
      { id: 'movement', header: 'Movement', accessorKey: 'movement', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.movement ?? '—'}</span> },
      {
        id: 'renewal',
        header: 'Renews',
        accessorKey: 'renewalDate',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.renewalDate ? formatDate(row.original.renewalDate) : '—'}</span>,
      },
    ],
    [],
  );

  if (report.loading) return <div className="p-6"><ListSkeleton rows={12} columns={4} /></div>;
  if (report.error || !report.data) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">The revenue report could not be computed</h2>
            <p className="text-xs text-muted">{report.error ?? 'Try reloading the page.'}</p>
          </div>
        </Card>
      </div>
    );
  }

  const data = report.data;
  const metrics = data.metrics;
  const money = (amount: number, compact = false) => formatMoney(amount, data.currency, compact);
  const bridgeMax = Math.max(...data.movementBridge.map((row) => Math.abs(row.value)), 1);

  return (
    <div className="pb-10">
      <PageHeader
        title="Recurring revenue"
        description={`${data.periodLabel} · computed from the subscription records of the current organization.`}
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Recurring revenue' }]}
        actions={
          <Button variant="secondary" size="sm" asChild leadingIcon={<Receipt className="size-3.5" />}>
            <Link to="/app/subscriptions/invoices">Invoices</Link>
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <KpiRow>
          <KpiCard label="MRR" value={money(metrics.mrr.amount, true)} hint={`ARR ${money(metrics.arr.amount, true)} · live subscriptions only`} />
          <KpiCard label="Net revenue retention" value={`${metrics.netRevenueRetention}%`} hint={`Gross ${metrics.grossRevenueRetention}%`} />
          <KpiCard label="Net new MRR" value={money(metrics.netNewMrr.amount, true)} hint={`New ${money(metrics.newMrr.amount, true)} · expansion ${money(metrics.expansionMrr.amount, true)}`} />
          <KpiCard
            label="Churn rate"
            value={`${metrics.churnRate}%`}
            hint={`Churned MRR ${money(metrics.churnedMrr.amount, true)}`}
            attention={metrics.churnRate > 8 ? 'warning' : undefined}
          />
        </KpiRow>
        <KpiRow>
          <KpiCard
            label="Lifetime value"
            value={money(metrics.customerLifetimeValue.amount, true)}
            hint={`Average revenue per account × an assumed ${formatNumber(metrics.averageLifetimeMonths)}-month lifetime`}
          />
          <KpiCard label="Avg revenue / account" value={money(metrics.averageRevenuePerAccount.amount, true)} hint={`Logo retention ${metrics.logoRetention}%`} />
          <KpiCard
            label="Payback"
            value={`${formatNumber(metrics.paybackMonths)} months`}
            hint="Assumed input — no acquisition cost is recorded in this build"
          />
          <KpiCard label="Contraction" value={money(metrics.contractionMrr.amount, true)} hint={`Reactivation ${money(metrics.reactivationMrr.amount, true)}`} />
        </KpiRow>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight text-fg">MRR movement bridge</h2>
              <p className="mt-0.5 text-[0.6875rem] text-faint">Opening to closing MRR across new, expansion, contraction and churn.</p>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {data.movementBridge.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className={cn('w-32 shrink-0 text-xs', row.kind === 'start' || row.kind === 'end' ? 'font-semibold text-fg' : 'text-muted')}>{row.label}</span>
                  <span className="min-w-0 flex-1">
                    <InlineBar value={Math.abs(row.value)} max={bridgeMax} tone={row.kind === 'positive' ? 'green' : row.kind === 'negative' ? 'red' : 'violet'} />
                  </span>
                  <span
                    className={cn(
                      'w-24 shrink-0 text-end text-xs font-medium tabular-nums',
                      row.kind === 'positive' ? 'text-success-fg' : row.kind === 'negative' ? 'text-danger-fg' : 'text-fg',
                    )}
                  >
                    {row.kind === 'positive' ? '+' : ''}
                    {money(row.value, true)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-fg">MRR trend</h2>
                <p className="mt-0.5 text-[0.6875rem] text-faint">{data.trend.length} months</p>
              </div>
              <Sparkline points={data.trend.map((row) => row.mrr)} tone="violet" width={120} height={32} />
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <caption className="sr-only">Monthly recurring revenue trend</caption>
                <thead>
                  <tr>
                    {['Month', 'MRR', 'New', 'Expansion', 'Churned', 'Net new'].map((heading, index) => (
                      <th
                        key={heading}
                        scope="col"
                        className={cn(
                          'sticky top-0 border-b border-border-subtle bg-surface px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted',
                          index > 0 ? 'text-end' : 'text-start',
                        )}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.trend.map((row) => (
                    <tr key={row.date} className="border-b border-border-subtle last:border-b-0">
                      <td className="px-2 py-1.5 text-muted">{formatDate(row.date)}</td>
                      <td className="px-2 py-1.5 text-end tabular-nums text-fg">{money(row.mrr, true)}</td>
                      <td className="px-2 py-1.5 text-end tabular-nums text-success-fg">+{money(row.newMrr, true)}</td>
                      <td className="px-2 py-1.5 text-end tabular-nums text-success-fg">+{money(row.expansionMrr, true)}</td>
                      <td className="px-2 py-1.5 text-end tabular-nums text-danger-fg">−{money(row.churnedMrr, true)}</td>
                      <td className="px-2 py-1.5 text-end tabular-nums text-fg">{money(row.netNew, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DemoNotice tone="neutral" className="mt-3">
              The monthly shape is illustrative; only the headline totals are record-derived.
            </DemoNotice>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight text-fg">By plan</h2>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {data.byPlan.map((row) => (
                <li key={row.planName} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-fg">{row.planName}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {money(row.mrr, true)} · {row.sharePercent}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <InlineBar value={row.sharePercent} tone="violet" />
                    <span className="text-[0.625rem] text-faint">
                      {formatNumber(row.accounts)} accounts · {row.churnRate}% churn
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight text-fg">By segment</h2>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {data.bySegment.map((row) => (
                <li key={row.segment} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-fg">{row.segment}</p>
                    <p className="mt-0.5 text-[0.625rem] text-faint">{formatNumber(row.accounts)} accounts · NRR {row.nrr}%</p>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-fg">{money(row.mrr, true)}</span>
                </li>
              ))}
            </ul>
            <DemoNotice tone="neutral" className="m-3">
              Segment and region splits are illustrative shapings.
            </DemoNotice>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight text-fg">By region</h2>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {data.byRegion.map((row) => (
                <li key={row.region} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-fg">{row.region}</p>
                    <p className="mt-0.5 text-[0.625rem] text-faint">
                      {formatNumber(row.accounts)} accounts · {row.growth}% growth
                    </p>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-fg">{money(row.mrr, true)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Top accounts by MRR</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <caption className="sr-only">Top accounts by monthly recurring revenue</caption>
                <thead>
                  <tr>
                    {['Account', 'Health', 'MRR', 'ARR', 'Renews'].map((heading, index) => (
                      <th
                        key={heading}
                        scope="col"
                        className={cn(
                          'border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted',
                          index === 2 || index === 3 ? 'text-end' : 'text-start',
                        )}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.topAccountsByMrr.map((account) => (
                    <tr key={account.accountId} className="border-b border-border-subtle last:border-b-0">
                      <td className="px-3 py-2">
                        <Link className="font-medium text-fg hover:text-link hover:underline" to={`/app/accounts/${account.accountId}`}>
                          {account.accountName}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={account.health} size="sm" />
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums text-fg">{money(account.mrr.amount)}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-muted">{money(account.arr.amount, true)}</td>
                      <td className="px-3 py-2 text-muted">{account.renewalDate ? formatDate(account.renewalDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Cohort retention</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">Cohort revenue retention by month</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-start text-2xs font-semibold uppercase tracking-wide text-muted">
                        Cohort
                      </th>
                      {data.cohortRetention[0]?.values.map((_, index) => (
                        <th key={index} scope="col" className="border-b border-border-subtle bg-inset px-2 py-2 text-end text-2xs font-semibold uppercase tracking-wide text-muted">
                          M{index}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohortRetention.map((cohort) => (
                      <tr key={cohort.cohortLabel} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-3 py-2">
                          <span className="block font-medium text-fg">{cohort.cohortLabel}</span>
                          <span className="block text-[0.625rem] tabular-nums text-faint">{money(cohort.startMrr, true)}</span>
                        </td>
                        {cohort.values.map((value, index) => (
                          <td key={index} className="px-2 py-2 text-end">
                            <span
                              className={cn(
                                'inline-block min-w-10 rounded px-1.5 py-0.5 text-[0.6875rem] tabular-nums',
                                value >= 90 ? 'bg-success-subtle text-success-fg' : value >= 75 ? 'bg-inset text-fg' : 'bg-warning-subtle text-warning-fg',
                              )}
                            >
                              {value}%
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DemoNotice tone="neutral" className="m-3">
                Cohort values are illustrative; the dataset spans a single period per subscription.
              </DemoNotice>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Upcoming renewals</h2>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {data.upcomingRenewals.map((row) => (
                  <li key={row.month} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-fg">{row.month}</p>
                      <p className="mt-0.5 text-[0.625rem] text-faint">{formatNumber(row.count)} renewals · at risk {money(row.atRiskValue, true)}</p>
                    </div>
                    <span className="text-xs font-medium tabular-nums text-fg">{money(row.value, true)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Subscriptions</h2>
          </div>
          <div className="border-b border-border-subtle px-4 py-3">
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder="Search reference, account or plan"
              resultCount={subscriptions.meta ? `${subscriptions.meta.total.toLocaleString()} subscriptions` : undefined}
              chips={statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, tone: 'brand', onRemove: () => setStatusFilter('all') }] : []}
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
                  options={['all', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired'].map((value) => ({
                    value,
                    label: value === 'all' ? 'All statuses' : value.replace(/_/g, ' '),
                  }))}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Filter by status"
                />
              }
            />
          </div>
          {subscriptions.loading ? (
            <div className="p-4">
              <ListSkeleton rows={8} columns={6} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={subscriptions.items}
              onRowClick={(subscription) => navigate(`/app/accounts/${subscription.accountId}`)}
              getRowId={(subscription) => subscription.id}
              footer={
                subscriptions.meta ? (
                  <Pagination page={subscriptions.meta.page} pageSize={subscriptions.meta.pageSize} total={subscriptions.meta.total} onPageChange={setPage} />
                ) : null
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
}
