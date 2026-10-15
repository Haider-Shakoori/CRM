'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import type { Dashboard, WidgetData } from '@crm/shared-types';
import {
  Badge,
  Button,
  Card,
  ChartFrame,
  DemoNotice,
  DonutChart,
  FunnelChart,
  KpiCard,
  MiniStat,
  Select,
  Skeleton,
  cn,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
  RecordEmptyState,
  ViewSwitcher,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../components/shared';
import { useAsync, useList, useServices } from '../../app/ServiceProvider';

/**
 * Dashboard screens.
 *
 * A dashboard is a saved arrangement of widgets, each bound to a source and resolved by the
 * mock layer through `widgetDataBatch`. Two rules shape this file:
 *
 *   - **Every visualisation has a table alternative.** `ChartFrame` provides the toggle for
 *     line, bar and area charts. The donut and funnel widgets did not come with one, so the
 *     local `SegmentPanel` adds the same chart/table switch rather than relying on colour and
 *     a legend alone.
 *   - **Refresh is simulated and says so.** Re-fetching recomputes from the same seeded records;
 *     no request leaves the browser. The affordance announces that plainly instead of implying
 *     a live backend.
 */

const AUDIENCE_LABELS: Record<Dashboard['audience'], string> = {
  executive: 'Executive',
  sales: 'Sales',
  sales_individual: 'Individual',
  marketing: 'Marketing',
  service: 'Service',
  success: 'Customer success',
  revenue_ops: 'Revenue operations',
  team: 'Team',
  custom: 'Custom',
};

/* ---------------------------------------------------------------------- list */

export default function DashboardsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [audience, setAudience] = React.useState('all');
  const [page, setPage] = React.useState(1);

  const query = React.useMemo(
    () => ({ page, pageSize: 24, q: search || undefined }),
    [page, search],
  );

  const dashboards = useList(() => services.dashboards.list(query), [JSON.stringify(query)]);

  const filtered = React.useMemo(
    () => (audience === 'all' ? dashboards.items : dashboards.items.filter((dashboard) => dashboard.audience === audience)),
    [dashboards.items, audience],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Dashboards"
        description="Saved arrangements of widgets, each bound to a seeded source. Every figure is generated from the same synthetic dataset as the rest of the application."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Analytics', to: '/app/analytics' }, { label: 'Dashboards' }]}
        sample
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search dashboards"
            resultCount={dashboards.meta ? `${filtered.length.toLocaleString()} shown` : undefined}
            chips={audience !== 'all' ? [{ id: 'audience', label: `Audience: ${AUDIENCE_LABELS[audience as Dashboard['audience']]}`, tone: 'brand', onRemove: () => setAudience('all') }] : []}
            onClearFilters={() => {
              setAudience('all');
              setSearch('');
            }}
            actions={
              <Select
                value={audience}
                onValueChange={(value) => setAudience(value)}
                options={[{ value: 'all', label: 'All audiences' }, ...Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({ value, label }))]}
                selectSize="sm"
                className="w-[12rem]"
                aria-label="Filter by audience"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniStat label="Dashboards" value={formatNumber(dashboards.meta?.total ?? 0)} tone="violet" />
          <MiniStat label="System dashboards" value={formatNumber(dashboards.items.filter((dashboard) => dashboard.kind === 'system').length)} tone="blue" />
          <MiniStat label="Widgets across view" value={formatNumber(dashboards.items.reduce((sum, dashboard) => sum + dashboard.widgets.length, 0))} tone="teal" />
        </div>

        {dashboards.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <RecordEmptyState
            title="No dashboards match this filter"
            body="Dashboards arrive with the seeded organization. Clear the audience filter or the search term to see them again."
            primaryAction={{ label: 'Clear filters', onClick: () => { setAudience('all'); setSearch(''); } }}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((dashboard) => (
              <li key={dashboard.id}>
                <Card
                  className="flex h-full flex-col gap-3 p-4"
                  interactive
                  onClick={() => navigate(`/app/analytics/dashboards/${dashboard.id}`)}
                  tabIndex={0}
                  role="link"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/app/analytics/dashboards/${dashboard.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{dashboard.name}</h2>
                      <p className="mt-0.5 line-clamp-2 text-2xs leading-snug text-muted">{dashboard.description}</p>
                    </div>
                    <LayoutDashboard className="size-4 shrink-0 text-subtle" aria-hidden />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="sm">{AUDIENCE_LABELS[dashboard.audience]}</Badge>
                    <Badge variant="neutral" size="sm">{dashboard.kind}</Badge>
                    {dashboard.isDefault ? <Badge variant="brand" size="sm">Default</Badge> : null}
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-2xs">
                    <div>
                      <dt className="text-faint">Widgets</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-fg">{dashboard.widgets.length}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Period</dt>
                      <dd className="mt-0.5 truncate font-medium capitalize text-fg">{dashboard.period.preset.replace(/_/g, ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Updated</dt>
                      <dd className="mt-0.5 truncate font-medium text-fg">{formatDate(dashboard.updatedAt, 'relative')}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function DashboardView() {
  const services = useServices();
  const { dashboardId } = useParams<{ dashboardId: string }>();

  const dashboard = useAsync(() => services.dashboards.get(dashboardId ?? ''), [dashboardId], { skip: !dashboardId });
  const widgetData = useAsync(() => services.dashboards.widgetDataBatch(dashboardId ?? ''), [dashboardId], { skip: !dashboardId || !dashboard.data });

  const dataByWidget = React.useMemo(() => {
    const map = new Map<string, WidgetData>();
    for (const entry of widgetData.data ?? []) map.set(entry.widgetId, entry);
    return map;
  }, [widgetData.data]);

  const record = dashboard.data;

  const refresh = () => {
    widgetData.reload();
    notify.simulated(
      'Dashboard refreshed',
      'Widget figures were recomputed from the seeded dataset in this browser. No request was sent to a server.',
    );
  };

  if (dashboard.loading) return <ListSkeleton rows={10} columns={3} />;
  if (dashboard.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This dashboard could not be found</h2>
            <p className="text-xs text-muted">{dashboard.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/analytics/dashboards">Back to dashboards</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const widgets = [...record.widgets].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  return (
    <div className="pb-10">
      <PageHeader
        title={record.name}
        description={record.description}
        backTo={{ to: '/app/analytics/dashboards', label: 'Dashboards' }}
        actions={
          <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className={cn('size-3.5', widgetData.refreshing && 'animate-spin')} />} onClick={refresh} loading={widgetData.refreshing}>
            Refresh
          </Button>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-4 py-1.5 sm:px-6">
            <Badge variant="outline" size="sm">{AUDIENCE_LABELS[record.audience]}</Badge>
            <span className="text-[0.6875rem] text-subtle">
              {record.widgets.length} widgets · {record.period.preset.replace(/_/g, ' ')} · updated {formatDate(record.updatedAt, 'relative')}
            </span>
            <span className="ms-auto flex items-center gap-2 text-[0.6875rem] text-faint">
              <DemoNotice tone="neutral">Synthetic</DemoNotice>
              Refresh recomputes the same seeded records; nothing is fetched.
            </span>
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {widgetData.loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: Math.min(4, widgets.length || 4) }).map((_, index) => (
              <Skeleton key={index} className="h-56" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {widgets.map((widget) => (
              <WidgetSlot key={widget.id} data={dataByWidget.get(widget.id)} title={widget.title} subtitle={widget.subtitle} kind={widget.kind} />
            ))}
          </div>
        )}

        <DemoNotice tone="neutral">
          Every value on this dashboard is derived from the seeded dataset. The refresh control re-runs the derivation
          locally, and the timestamps show the last time the browser did so.
        </DemoNotice>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- widget slot */

function WidgetSlot({ data, title, subtitle, kind }: { data: WidgetData | undefined; title: string; subtitle?: string; kind: WidgetData['kind'] }) {
  if (!data || data.state === 'empty' || data.state === 'error' || data.state === 'not_entitled' || data.state === 'loading') {
    return (
      <div className="flex flex-col rounded-lg border border-border-subtle bg-surface">
        <header className="border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-2xs text-muted">{subtitle}</p> : null}
        </header>
        <p className="flex flex-1 items-center justify-center px-4 py-10 text-center text-xs text-muted">
          {data?.state === 'error'
            ? 'This widget could not be computed.'
            : data?.state === 'not_entitled'
              ? 'This widget needs a module your plan does not include.'
              : data?.state === 'loading'
                ? 'Loading widget…'
                : 'No data for this period and filter combination.'}
        </p>
      </div>
    );
  }

  const format = (value: number) => (data.format === 'currency' ? formatMoney(value, data.currency ?? 'USD', true) : formatNumber(value, true));

  if (kind === 'metric_kpi' || kind === 'goal_progress' || kind === 'gauge') {
    return (
      <KpiCard
        label={title}
        value={data.value !== undefined ? format(data.value) : '—'}
        hint={subtitle}
        delta={
          data.delta
            ? { text: format(data.delta.value), direction: data.delta.direction, sentiment: data.delta.sentiment, comparisonLabel: 'vs previous period' }
            : undefined
        }
        sample
      />
    );
  }

  if (kind === 'donut_chart' || kind === 'pie_chart' || kind === 'funnel') {
    return (
      <SegmentPanel
        title={title}
        description={subtitle}
        variant={kind === 'funnel' ? 'funnel' : 'donut'}
        segments={(data.segments ?? []).map((segment) => ({ label: segment.label, value: segment.value, tone: segment.tone }))}
        formatValue={format}
        insight={data.insight}
      />
    );
  }

  if (kind === 'leaderboard' || kind === 'table' || kind === 'task_list' || kind === 'activity_feed') {
    return (
      <figure className="flex flex-col rounded-lg border border-border-subtle bg-surface">
        <header className="border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-2xs text-muted">{subtitle}</p> : null}
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0">
              <tr>
                {(data.columns ?? []).map((column) => (
                  <th key={column.key} scope="col" className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', column.align === 'end' ? 'text-end' : 'text-start')}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.rows ?? []).map((row, index) => (
                <tr key={index} className="border-b border-border-subtle last:border-b-0">
                  {(data.columns ?? []).map((column) => {
                    const raw = row[column.key];
                    return (
                      <td key={column.key} className={cn('px-3 py-1.5 text-fg', column.align === 'end' ? 'text-end tabular-nums' : 'text-start')}>
                        {typeof raw === 'number' ? (column.format === 'currency' ? formatMoney(raw, data.currency ?? 'USD', true) : formatNumber(raw, true)) : (raw ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.insight ? <p className="border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed text-muted">{data.insight}</p> : null}
      </figure>
    );
  }

  // Time-series default.
  const series = (data.series ?? []).map((entry, index) => ({ id: entry.id, label: entry.label, colour: `var(--chart-${(index % 10) + 1})`, dashed: entry.id.includes('target') }));
  const points = (() => {
    if (!data.series || data.series.length === 0) return [];
    const labels = new Set<string>();
    for (const entry of data.series) for (const point of entry.data) labels.add(point.label);
    return [...labels].map((label) => {
      const row: { label: string } & Record<string, string | number> = { label };
      for (const entry of data.series ?? []) {
        const match = entry.data.find((point) => point.label === label);
        if (match) row[entry.id] = match.value;
      }
      return row;
    });
  })();

  const chartKind = kind === 'bar_chart' ? 'bar' : kind === 'horizontal_bar_chart' ? 'horizontal_bar' : kind === 'stacked_bar_chart' ? 'stacked_bar' : kind === 'line_chart' ? 'line' : 'area';

  return (
    <ChartFrame
      title={title}
      description={subtitle}
      series={series}
      data={points}
      kind={chartKind}
      formatValue={format}
      insight={data.insight}
      className="h-full"
    />
  );
}

/* --------------------------------------------------------- segment (donut/funnel) */

interface Segment {
  label: string;
  value: number;
  tone: NonNullable<WidgetData['segments']>[number]['tone'];
}

/**
 * Donut or funnel with an explicit chart-to-table switch.
 *
 * `DonutChart` and `FunnelChart` carry accessible legends, but a table is still the most
 * reliable way to read exact figures. Rather than rely on the legend, this renders a real
 * table alternative behind the same toggle `ChartFrame` uses for line and bar charts.
 */
function SegmentPanel({
  title,
  description,
  variant,
  segments,
  formatValue,
  insight,
}: {
  title: string;
  description?: string;
  variant: 'donut' | 'funnel';
  segments: Segment[];
  formatValue: (value: number) => string;
  insight?: string;
}) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart');

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
    if (variant === 'funnel') {
      return (
        <FunnelChart
          title={title}
          description={description}
          actions={toggle}
          stages={segments.map((segment) => ({ label: segment.label, count: segment.value }))}
          insight={insight}
        />
      );
    }
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    return (
      <DonutChart
        title={title}
        description={description}
        actions={toggle}
        segments={segments}
        centreValue={formatValue(total)}
        centreLabel="Total"
        formatValue={formatValue}
        insight={insight}
      />
    );
  }

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <figure className="flex flex-col rounded-lg border border-border-subtle bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <figcaption className="text-sm font-semibold tracking-tight text-fg">{title}</figcaption>
          {description ? <p className="text-2xs leading-snug text-muted">{description}</p> : null}
        </div>
        <div className="shrink-0">{toggle}</div>
      </header>
      <div className="max-h-[22rem] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{title}. {description ?? ''}</caption>
          <thead className="sticky top-0">
            <tr>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted text-start">Segment</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted text-end">Value</th>
              <th scope="col" className="border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted text-end">Share</th>
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
      {insight ? <p className="border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed text-muted">{insight}</p> : null}
    </figure>
  );
}
