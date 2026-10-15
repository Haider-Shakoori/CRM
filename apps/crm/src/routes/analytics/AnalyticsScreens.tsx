'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { AnalyticsOverview, TeamPerformanceRow, Tone } from '@crm/shared-types';
import {
  Button,
  Card,
  ChartFrame,
  DataTable,
  DemoNotice,
  DonutChart,
  FunnelChart,
  InlineBar,
  KpiCard,
  MiniStat,
  Sparkline,
} from '@crm/ui';
import {
  ListSkeleton,
  PageHeader,
  RecordErrorState,
  ViewSwitcher,
  formatMoney,
  formatNumber,
} from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';

/**
 * Cross-module analytics.
 *
 * This is the screen the analytics placeholder described: conversion funnels, cohort
 * retention, win-loss by reason, team performance and trend charts, each with a table
 * alternative. Everything is read from `analytics.overview` and `analytics.teamPerformance`,
 * which in turn derive from the one synthetic dataset — so a figure here cannot disagree
 * with the same figure on a deal or a dashboard.
 *
 * The only interactive state is the chart/table switch on each visualisation. There is no
 * "generate insight" button: the commentary that appears is deterministic and attributed to
 * the mock composition, not to a model.
 */

export default function AnalyticsOverviewScreen() {
  const services = useServices();
  const [page] = React.useState(1);

  const overview = useAsync(() => services.analytics.overview(), []);
  const team = useList(() => services.analytics.teamPerformance({ page, pageSize: 25, sort: [{ field: 'revenue', direction: 'desc' }] }), [page]);

  const data = overview.data;

  const columns = React.useMemo<ColumnDef<TeamPerformanceRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Representative',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-fg">{row.original.name}</p>
            <p className="mt-0.5 truncate text-[0.6875rem] text-faint">{row.original.teamName}</p>
          </div>
        ),
      },
      {
        id: 'revenue',
        header: 'Revenue',
        accessorKey: 'revenue',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.revenue, 'USD', true)}</span>,
      },
      {
        id: 'attainment',
        header: 'Attainment',
        accessorKey: 'attainmentPercent',
        cell: ({ row }) => <InlineBar value={row.original.attainmentPercent} />,
      },
      {
        id: 'winRate',
        header: 'Win rate',
        accessorKey: 'winRate',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.winRate}%</span>,
      },
      {
        id: 'dealsWon',
        header: 'Won',
        accessorKey: 'dealsWon',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.dealsWon}</span>,
      },
      {
        id: 'averageDealSize',
        header: 'Avg deal',
        accessorKey: 'averageDealSize',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatMoney(row.original.averageDealSize, 'USD', true)}</span>,
      },
      {
        id: 'salesCycleDays',
        header: 'Cycle',
        accessorKey: 'salesCycleDays',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.salesCycleDays}d</span>,
      },
      {
        id: 'activitiesLogged',
        header: 'Activities',
        accessorKey: 'activitiesLogged',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.activitiesLogged)}</span>,
      },
      {
        id: 'trend',
        header: 'Trend',
        cell: ({ row }) => <Sparkline points={row.original.trend.map((point) => point.value)} tone="teal" />,
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Analytics"
        description="Cross-module performance: conversion, retention, win-loss and team output, all derived from the seeded dataset."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Analytics' }]}
        sample
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/analytics/dashboards">Open dashboards</Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {overview.loading ? (
          <ListSkeleton rows={6} columns={4} />
        ) : overview.error || !data ? (
          <RecordErrorState message={overview.error ?? 'The overview could not be computed.'} onRetry={overview.reload} />
        ) : (
          <>
            {/* Headline figures */}
            <section aria-labelledby="analytics-headline">
              <h2 id="analytics-headline" className="sr-only">Headline figures</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Closed won"
                  value={formatMoney(data.headline.revenue, data.currency, true)}
                  delta={{
                    text: formatMoney(data.headline.revenue - data.headline.previousRevenue, data.currency, true),
                    direction: data.headline.revenue >= data.headline.previousRevenue ? 'up' : 'down',
                    comparisonLabel: `vs ${data.periodLabel.toLowerCase()}`,
                  }}
                  sample
                />
                <KpiCard
                  label="Deals won"
                  value={formatNumber(data.headline.dealsWon)}
                  delta={{
                    text: `${data.headline.dealsWon - data.headline.previousDealsWon}`,
                    direction: data.headline.dealsWon >= data.headline.previousDealsWon ? 'up' : 'down',
                    comparisonLabel: `vs ${data.periodLabel.toLowerCase()}`,
                  }}
                  sample
                />
                <KpiCard
                  label="Win rate"
                  value={`${data.headline.winRate}%`}
                  delta={{
                    text: `${data.headline.winRate - data.headline.previousWinRate} pts`,
                    direction: data.headline.winRate >= data.headline.previousWinRate ? 'up' : 'down',
                    comparisonLabel: `vs ${data.periodLabel.toLowerCase()}`,
                  }}
                  visual={<InlineBar value={data.headline.winRate} />}
                  sample
                />
                <KpiCard
                  label="Average deal size"
                  value={formatMoney(data.headline.averageDealSize, data.currency, true)}
                  delta={{
                    text: formatMoney(data.headline.averageDealSize - data.headline.previousAverageDealSize, data.currency, true),
                    direction: data.headline.averageDealSize >= data.headline.previousAverageDealSize ? 'up' : 'down',
                    comparisonLabel: `vs ${data.periodLabel.toLowerCase()}`,
                  }}
                  sample
                />
              </div>
            </section>

            {/* Conversion funnel */}
            <section aria-labelledby="analytics-funnel" className="space-y-3">
              <h2 id="analytics-funnel" className="text-sm font-semibold tracking-tight text-fg">Conversion funnel</h2>
              <FunnelPanel stages={data.conversionFunnel} />
            </section>

            {/* Trend */}
            <section aria-labelledby="analytics-trend" className="space-y-3">
              <h2 id="analytics-trend" className="text-sm font-semibold tracking-tight text-fg">Revenue against target</h2>
              <ChartFrame
                title="Revenue trend"
                description="Closed revenue by month against target and the previous year."
                kind="area"
                series={[
                  { id: 'revenue', label: 'Revenue', colour: 'var(--chart-1)' },
                  { id: 'target', label: 'Target', colour: 'var(--chart-4)', dashed: true },
                  { id: 'previousYear', label: 'Previous year', colour: 'var(--chart-3)' },
                ]}
                data={data.revenueTrend.map((point) => ({ label: point.date.slice(0, 7), revenue: point.revenue, target: point.target, previousYear: point.previousYear }))}
                formatValue={(value) => formatMoney(value, data.currency, true)}
                insight={data.insights[0]}
              />
            </section>

            {/* Win-loss and pipeline */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section aria-labelledby="analytics-winloss" className="space-y-3">
                <h2 id="analytics-winloss" className="text-sm font-semibold tracking-tight text-fg">Win-loss by reason</h2>
                <ToggleableDonut
                  title="Lost value by reason"
                  description="Closed value grouped by the recorded lost reason."
                  segments={data.winLoss.byReason.map((reason) => ({ label: reason.label, value: reason.value, tone: 'red' as Tone }))}
                  formatValue={(value) => formatMoney(value, data.currency, true)}
                />
              </section>
              <section aria-labelledby="analytics-stage" className="space-y-3">
                <h2 id="analytics-stage" className="text-sm font-semibold tracking-tight text-fg">Pipeline by stage</h2>
                <ChartFrame
                  title="Pipeline value by stage"
                  description="Open and closed value currently sitting in each pipeline stage."
                  kind="bar"
                  series={[{ id: 'value', label: 'Value', colour: 'var(--chart-2)' }]}
                  data={data.pipelineByStage.map((stage) => ({ label: stage.label, value: stage.value }))}
                  formatValue={(value) => formatMoney(value, data.currency, true)}
                />
              </section>
            </div>

            {/* Cohort retention */}
            <section aria-labelledby="analytics-cohorts" className="space-y-3">
              <h2 id="analytics-cohorts" className="text-sm font-semibold tracking-tight text-fg">Cohort retention</h2>
              <CohortTable cohorts={data.cohortAnalysis} />
            </section>

            {/* Team performance */}
            <section aria-labelledby="analytics-team" className="space-y-3">
              <h2 id="analytics-team" className="text-sm font-semibold tracking-tight text-fg">Team performance</h2>
              <ChartFrame
                title="Revenue by representative"
                description={`Closed revenue per owner for ${data.periodLabel.toLowerCase()}.`}
                kind="horizontal_bar"
                height={Math.max(220, data.byOwner.length * 32)}
                series={[{ id: 'revenue', label: 'Revenue', colour: 'var(--chart-1)' }]}
                data={data.byOwner.map((owner) => ({ label: owner.name, revenue: owner.revenue }))}
                formatValue={(value) => formatMoney(value, data.currency, true)}
              />
              {team.loading ? (
                <ListSkeleton rows={6} columns={8} />
              ) : (
                <DataTable columns={columns} data={team.items} getRowId={(row) => row.userId} density="compact" />
              )}
            </section>

            {/* Retention and insights */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section aria-labelledby="analytics-retention" className="space-y-3">
                <h2 id="analytics-retention" className="text-sm font-semibold tracking-tight text-fg">Retention</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MiniStat label="Gross revenue retention" value={`${data.retention.grr}%`} tone="teal" />
                  <MiniStat label="Net revenue retention" value={`${data.retention.nrr}%`} tone="green" />
                  <MiniStat label="Logo retention" value={`${data.retention.logoRetention}%`} tone="blue" />
                  <MiniStat label="Churn rate" value={`${data.retention.churnRate}%`} tone="red" />
                </div>
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-fg">Activity effectiveness</h3>
                  <table className="mt-2 w-full border-collapse text-xs">
                    <caption className="sr-only">Activity effectiveness by kind</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="border-b border-border-subtle py-1.5 text-start text-2xs font-semibold text-muted">Activity</th>
                        <th scope="col" className="border-b border-border-subtle py-1.5 text-end text-2xs font-semibold text-muted">Logged</th>
                        <th scope="col" className="border-b border-border-subtle py-1.5 text-end text-2xs font-semibold text-muted">Meetings</th>
                        <th scope="col" className="border-b border-border-subtle py-1.5 text-end text-2xs font-semibold text-muted">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activityEffectiveness.map((entry) => (
                        <tr key={entry.activityKind} className="border-b border-border-subtle last:border-b-0">
                          <td className="py-1.5 text-start text-fg">{entry.label}</td>
                          <td className="py-1.5 text-end tabular-nums text-muted">{formatNumber(entry.activities)}</td>
                          <td className="py-1.5 text-end tabular-nums text-muted">{formatNumber(entry.meetingsBooked)}</td>
                          <td className="py-1.5 text-end tabular-nums text-fg">{entry.conversionPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>

              <section aria-labelledby="analytics-insights" className="space-y-3">
                <h2 id="analytics-insights" className="text-sm font-semibold tracking-tight text-fg">Deterministic commentary</h2>
                <Card className="space-y-3 p-4">
                  <ul className="space-y-2.5">
                    {data.insights.map((insight, index) => (
                      <li key={index} className="flex gap-2 text-xs leading-relaxed text-muted">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                  <DemoNotice tone="neutral">
                    This commentary is composed from the seeded figures by the mock layer. No model is called and no
                    analysis service is connected.
                  </DemoNotice>
                </Card>
              </section>
            </div>

            <DemoNotice tone="neutral">
              Conversion, cohort and win-loss figures are derived from the same synthetic records the lists and
              dashboards read. {data.periodLabel}, currency {data.currency}.
            </DemoNotice>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- funnel panel */

function FunnelPanel({ stages }: { stages: AnalyticsOverview['conversionFunnel'] }) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart');
  const toggle = (
    <ViewSwitcher
      value={view}
      onChange={setView}
      label="Display format for conversion funnel"
      options={[
        { value: 'chart', label: 'Chart' },
        { value: 'table', label: 'Table' },
      ]}
    />
  );

  if (view === 'chart') {
    return (
      <FunnelChart
        title="Lead-to-win conversion"
        description="Each step along the funnel, with the conversion from the step before it."
        actions={toggle}
        stages={stages.map((stage) => ({ label: stage.label, count: stage.count, conversionFromPrevious: stage.conversionFromPrevious }))}
      />
    );
  }

  return (
    <figure className="flex flex-col rounded-lg border border-border-subtle bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <figcaption className="text-sm font-semibold tracking-tight text-fg">Lead-to-win conversion</figcaption>
          <p className="text-2xs leading-snug text-muted">Each step along the funnel, with the conversion from the step before it.</p>
        </div>
        <div className="shrink-0">{toggle}</div>
      </header>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Conversion funnel counts and rates</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-start text-2xs font-semibold text-muted">Step</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-end text-2xs font-semibold text-muted">Count</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-end text-2xs font-semibold text-muted">From previous</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-end text-2xs font-semibold text-muted">From start</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.label} className="border-b border-border-subtle last:border-b-0">
                <td className="px-3 py-1.5 text-start text-fg">{stage.label}</td>
                <td className="px-3 py-1.5 text-end tabular-nums text-fg">{stage.count.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-end tabular-nums text-muted">{stage.conversionFromPrevious}%</td>
                <td className="px-3 py-1.5 text-end tabular-nums text-muted">{stage.conversionFromStart}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------ donut panel */

function ToggleableDonut({
  title,
  description,
  segments,
  formatValue,
}: {
  title: string;
  description?: string;
  segments: Array<{ label: string; value: number; tone: Tone }>;
  formatValue: (value: number) => string;
}) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart');
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const toggle = (
    <ViewSwitcher
      value={view}
      onChange={setView}
      label={`Display format for ${title}`}
      options={[
        { value: 'chart', label: 'Chart' },
        { value: 'table', label: 'Table' },
      ]}
    />
  );

  if (view === 'chart') {
    return (
      <DonutChart
        title={title}
        description={description}
        actions={toggle}
        segments={segments}
        centreValue={formatValue(total)}
        centreLabel="Total"
        formatValue={formatValue}
      />
    );
  }

  return (
    <figure className="flex flex-col rounded-lg border border-border-subtle bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <figcaption className="text-sm font-semibold tracking-tight text-fg">{title}</figcaption>
          {description ? <p className="text-2xs leading-snug text-muted">{description}</p> : null}
        </div>
        <div className="shrink-0">{toggle}</div>
      </header>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-start text-2xs font-semibold text-muted">Reason</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-end text-2xs font-semibold text-muted">Value</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-end text-2xs font-semibold text-muted">Share</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.label} className="border-b border-border-subtle last:border-b-0">
                <td className="px-3 py-1.5 text-start text-fg">{segment.label}</td>
                <td className="px-3 py-1.5 text-end tabular-nums text-fg">{formatValue(segment.value)}</td>
                <td className="px-3 py-1.5 text-end tabular-nums text-subtle">{total > 0 ? `${((segment.value / total) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------ cohort table */

function CohortTable({ cohorts }: { cohorts: AnalyticsOverview['cohortAnalysis'] }) {
  // The retention grid is already tabular. The colour is a redundant cue on top of the
  // percentage in every cell, so it reads correctly without distinguishing hues.
  const maxPeriods = Math.max(0, ...cohorts.map((cohort) => cohort.values.length));

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Cohort retention by month and periods since join</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-start text-2xs font-semibold text-muted">Cohort</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-end text-2xs font-semibold text-muted">Size</th>
              {Array.from({ length: maxPeriods }).map((_, index) => (
                <th key={index} scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-end text-2xs font-semibold text-muted">
                  M{index}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.cohortLabel} className="border-b border-border-subtle last:border-b-0">
                <th scope="row" className="px-3 py-1.5 text-start font-medium text-fg">{cohort.cohortLabel}</th>
                <td className="px-3 py-1.5 text-end tabular-nums text-muted">{cohort.size}</td>
                {Array.from({ length: maxPeriods }).map((_, index) => {
                  const value = cohort.values[index];
                  if (value === undefined) {
                    return <td key={index} className="px-3 py-1.5 text-end text-faint">—</td>;
                  }
                  return (
                    <td key={index} className="px-3 py-1.5 text-end tabular-nums text-fg" style={{ background: `color-mix(in srgb, var(--chart-3) ${Math.min(60, value * 0.6)}%, transparent)` }}>
                      {value}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed text-muted">
        Cells show the percentage of the cohort still active in each period since it joined. The value is written in
        every cell, so the shading is decorative rather than the only signal.
      </p>
    </Card>
  );
}
