'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  LayoutDashboard,
  Pencil,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { personaCatalog } from '@crm/configuration';
import type { Dashboard, DashboardWidget, MetricPoint, WidgetData } from '@crm/shared-types';
import {
  Avatar,
  Badge,
  Button,
  ChartFrame,
  DemoNotice,
  DonutChart,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  IconButton,
  InlineBar,
  KpiCard,
  MiniStat,
  SectionHeader,
  Skeleton,
  StatusBadge,
  cn,
  notify,
} from '@crm/ui';
import { PageHeader, formatDate, formatMoney, formatNumber } from '../components/shared';
import { useAsync, useList, useServices } from '../app/ServiceProvider';

/**
 * Role-based home dashboard.
 *
 * The dashboard a person sees is resolved from their persona rather than fixed, because a
 * sales representative and a revenue operations manager need different first screens and
 * neither should have to hide widgets they never use.
 *
 * Two things are deliberate:
 *
 *   - **Every value is derived.** Widget data, the revenue trend and the task list all come
 *     from the same seeded records the rest of the application reads, so the dashboard can
 *     never disagree with a list view.
 *   - **The layout is editable and the edit is real.** Moving or hiding a widget calls
 *     `saveLayout`, which persists. It is a mock persistence, but the interaction is genuine
 *     rather than decorative — which matters, because a dashboard builder that does not
 *     actually rearrange anything teaches the wrong thing.
 */

const AUDIENCE_LABELS: Record<Dashboard['audience'], string> = {
  executive: 'Executive',
  sales: 'Sales',
  sales_individual: 'My performance',
  marketing: 'Marketing',
  service: 'Service',
  success: 'Customer success',
  revenue_ops: 'Revenue operations',
  team: 'Team',
  custom: 'Custom',
};

export default function Home() {
  const services = useServices();
  const user = useAsync(() => services.tenant.currentUser(), []);
  const [editing, setEditing] = React.useState(false);

  const persona = user.data?.persona ?? 'sales_rep';
  const personaMeta = personaCatalog.find((entry) => entry.key === persona);

  /**
   * Resolve the dashboard for this persona.
   *
   * `sales_rep` and `field_rep` are routed to the individual view even when the caller asks
   * for the team dashboard, because "what are my numbers" is the question a representative
   * actually opens the application to answer.
   */
  const audience: Dashboard['audience'] =
    persona === 'sales_rep' || persona === 'field_rep'
      ? 'sales_individual'
      : persona === 'support_agent' || persona === 'service_manager'
        ? 'service'
        : persona === 'success_manager'
          ? 'success'
          : persona === 'marketing_manager' || persona === 'marketing_specialist'
            ? 'marketing'
            : persona === 'revops_manager' || persona === 'finance_user'
              ? 'revenue_ops'
              : 'executive';

  const dashboard = useAsync(
    () => services.analytics.dashboardForAudience(audience, user.data?.id ?? ''),
    [audience, user.data?.id],
    { skip: !user.data },
  );

  const widgetData = useAsync(
    () => services.dashboards.widgetDataBatch(dashboard.data?.id ?? ''),
    [dashboard.data?.id],
    { skip: !dashboard.data },
  );

  const overview = useAsync(() => services.analytics.overview(), []);
  const forecast = useAsync(() => services.deals.forecast(), []);
  const dailyPlan = useAsync(
    () => services.activities.dailyPlan(user.data?.id ?? '', new Date().toISOString().slice(0, 10)),
    [user.data?.id],
    { skip: !user.data },
  );
  const recentActivity = useList(() => services.activities.list({ pageSize: 6, sort: [{ field: 'createdAt', direction: 'desc' }] }), []);

  const dataByWidget = React.useMemo(() => {
    const map = new Map<string, WidgetData>();
    for (const widget of widgetData.data ?? []) map.set(widget.widgetId, widget);
    return map;
  }, [widgetData.data]);

  const widgets = dashboard.data?.widgets ?? [];
  const loading = dashboard.loading || widgetData.loading;

  const saveLayout = async (next: DashboardWidget[]) => {
    const result = await services.dashboards.saveLayout(
      dashboard.data!.id,
      next.map((widget) => ({ id: widget.id, position: widget.position })),
    );
    if (!result.ok) {
      notify.error(result.error.message);
      return;
    }
    dashboard.reload();
  };

  /** Move a widget one slot earlier or later in the visual order. */
  const moveWidget = (widgetId: string, direction: -1 | 1) => {
    const ordered = [...widgets].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    const index = ordered.findIndex((widget) => widget.id === widgetId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;
    const swapped = [...ordered];
    [swapped[index], swapped[target]] = [swapped[target]!, swapped[index]!];
    // Re-flow the grid so the visual order and the stored order stay the same thing.
    const repositioned = swapped.map((widget, position) => ({
      ...widget,
      position: { ...widget.position, x: (position % 4) * 3, y: Math.floor(position / 4) * 3 },
    }));
    void saveLayout(repositioned);
  };

  const removeWidget = (widgetId: string) => {
    const widget = widgets.find((candidate) => candidate.id === widgetId);
    if (!widget) return;
    void (async () => {
      const result = await services.dashboards.removeWidget(dashboard.data!.id, widgetId);
      if (!result.ok) {
        notify.error(result.error.message);
        return;
      }
      // Removal is reversible from the same menu, so it does not need a confirmation dialog.
      notify.undoable(`“${widget.title}” hidden`, () => {
        void services.dashboards
          .addWidget(dashboard.data!.id, {
            kind: widget.kind,
            title: widget.title,
            subtitle: widget.subtitle,
            position: widget.position,
            binding: widget.binding,
            options: widget.options,
          } as never)
          .then(() => dashboard.reload());
      });
      dashboard.reload();
    })();
  };

  return (
    <div className="pb-8">
      <PageHeader
        title={`Good to see you, ${user.data?.firstName ?? 'there'}`}
        description={
          personaMeta
            ? `${personaMeta.label} view. ${personaMeta.description}`
            : 'Role-based overview of the records you own.'
        }
        actions={
          <>
            <Button
              variant={editing ? 'primary' : 'secondary'}
              size="sm"
              leadingIcon={editing ? <CheckCircle2 className="size-3.5" /> : <Pencil className="size-3.5" />}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? 'Done editing' : 'Edit layout'}
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Sparkles className="size-3.5" />} asChild>
              <Link to="/app/ai">Ask the assistant</Link>
            </Button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-4 py-1.5 sm:px-6">
            <Badge variant="outline" size="sm">
              {AUDIENCE_LABELS[audience]} dashboard
            </Badge>
            {dashboard.data ? (
              <span className="text-[0.6875rem] text-subtle">
                {dashboard.data.name} · {dashboard.data.period.preset.replace(/_/g, ' ')}
              </span>
            ) : null}
            <span className="ms-auto flex items-center gap-2 text-[0.6875rem] text-faint">
              <DemoNotice tone="neutral">Synthetic</DemoNotice>
              Everything on this page is generated from the seeded dataset.
            </span>
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {editing ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand-subtle/60 px-3 py-2.5">
            <GripVertical className="size-4 shrink-0 text-brand-fg" aria-hidden />
            <p className="min-w-0 flex-1 text-xs text-fg">
              Use the arrows on each widget to move it, and the menu to hide it. Changes are saved
              immediately.
            </p>
            <Button
              variant="ghost"
              size="xs"
              leadingIcon={<RotateCcw className="size-3.5" />}
              onClick={async () => {
                const result = await services.demo.reset('organization');
                if (result.ok) {
                  notify.success('Layout and data restored to the seeded baseline.');
                  dashboard.reload();
                  widgetData.reload();
                }
              }}
            >
              Reset everything
            </Button>
          </div>
        ) : null}

        {/* Headline figures: always present, because they answer the first question anyone asks. */}
        <section aria-labelledby="headline-heading">
          <h2 id="headline-heading" className="sr-only">
            Headline figures
          </h2>
          {overview.loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[6.5rem]" />
              ))}
            </div>
          ) : overview.data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Weighted pipeline"
                value={formatMoney(overview.data.headline.pipelineValue, overview.data.currency, true)}
                delta={{
                  text: formatMoney(overview.data.headline.pipelineValue - overview.data.headline.previousPipelineValue, overview.data.currency, true),
                  direction: overview.data.headline.pipelineValue >= overview.data.headline.previousPipelineValue ? 'up' : 'down',
                  comparisonLabel: 'vs last quarter',
                }}
                hint={`${formatNumber(forecast.data?.byRep?.length ?? 0)} owners · coverage ${forecast.data?.coverageRatio ?? '—'}×`}
              />
              <KpiCard
                label="Closed won"
                value={formatMoney(overview.data.headline.revenue, overview.data.currency, true)}
                delta={{
                  text: formatMoney(
                    overview.data.headline.revenue - overview.data.headline.previousRevenue,
                    overview.data.currency,
                    true,
                  ),
                  direction: overview.data.headline.revenue >= overview.data.headline.previousRevenue ? 'up' : 'down',
                  comparisonLabel: 'vs last quarter',
                }}
                hint="Booked revenue in the selected period"
              />
              <KpiCard
                label="Win rate"
                value={`${overview.data.headline.winRate}%`}
                delta={{
                  text: `${overview.data.headline.winRate - overview.data.headline.previousWinRate} pts`,
                  direction: overview.data.headline.winRate >= overview.data.headline.previousWinRate ? 'up' : 'down',
                  comparisonLabel: 'vs last quarter',
                }}
                visual={<InlineBar value={overview.data.headline.winRate} />}
              />
              <KpiCard
                label="Average cycle time"
                value={`${overview.data.headline.salesCycleDays} days`}
                delta={{
                  text: `${overview.data.headline.salesCycleDays - overview.data.headline.previousSalesCycleDays} days`,
                  // Fewer days is better, so the sentiment is inverted from the direction.
                  direction: overview.data.headline.salesCycleDays <= overview.data.headline.previousSalesCycleDays ? 'down' : 'up',
                  sentiment: overview.data.headline.salesCycleDays <= overview.data.headline.previousSalesCycleDays ? 'positive' : 'negative',
                  comparisonLabel: 'vs last quarter',
                }}
              />
            </div>
          ) : null}
        </section>

        {/* Widget grid, driven by the dashboard definition. */}
        <section aria-labelledby="widgets-heading">
          <h2 id="widgets-heading" className="sr-only">
            Dashboard widgets
          </h2>
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-56" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {[...widgets]
                .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
                .map((widget) => (
                  <WidgetSlot
                    key={widget.id}
                    widget={widget}
                    data={dataByWidget.get(widget.id)}
                    editing={editing}
                    onMove={moveWidget}
                    onRemove={removeWidget}
                  />
                ))}
            </div>
          )}
        </section>

        {/* Two supporting panels, so the dashboard answers "what next" as well as "how are we doing". */}
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section aria-labelledby="today-heading" className="rounded-lg border border-border-subtle bg-surface">
            <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div>
                <h2 id="today-heading" className="text-sm font-semibold tracking-tight text-fg">
                  What needs you today
                </h2>
                <p className="mt-0.5 text-2xs text-muted">
                  {dailyPlan.data
                    ? `${dailyPlan.data.totals.planned} planned · ${dailyPlan.data.totals.overdue} overdue · ${Math.round(dailyPlan.data.totals.plannedMinutes / 60)}h of work`
                    : 'Building your plan…'}
                </p>
              </div>
              <Button variant="ghost" size="xs" trailingIcon={<ArrowRight className="size-3.5 rtl:rotate-180" />} asChild>
                <Link to="/app/activities">Open my work</Link>
              </Button>
            </header>

            {dailyPlan.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-9" />
                ))}
              </div>
            ) : (dailyPlan.data?.items.length ?? 0) === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">
                Nothing is scheduled. Your plan fills as records are assigned to you.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {(dailyPlan.data?.items ?? []).slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md',
                        item.status === 'completed' ? 'bg-success-subtle text-success-fg' : 'bg-inset text-subtle',
                      )}
                      aria-hidden
                    >
                      {item.status === 'completed' ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        to={item.recordPath ?? '/app/activities'}
                        className="block truncate text-xs font-medium text-fg hover:text-link hover:underline"
                      >
                        {item.title}
                      </Link>
                      <span className="mt-0.5 block truncate text-[0.6875rem] text-subtle">
                        {item.recordLabel ?? 'No linked record'}
                      </span>
                    </span>
                    {item.reason ? (
                      <Badge variant={item.reason === 'Overdue' ? 'danger' : 'warning'} size="sm">
                        {item.reason}
                      </Badge>
                    ) : null}
                    <span className="w-14 shrink-0 text-end text-[0.6875rem] tabular-nums text-subtle">
                      {item.estimatedMinutes ? `${item.estimatedMinutes}m` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="activity-heading" className="rounded-lg border border-border-subtle bg-surface">
            <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div>
                <h2 id="activity-heading" className="text-sm font-semibold tracking-tight text-fg">
                  Recent activity
                </h2>
                <p className="mt-0.5 text-2xs text-muted">Across every module, newest first</p>
              </div>
              <CalendarClock className="size-4 shrink-0 text-subtle" aria-hidden />
            </header>
            {recentActivity.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {(recentActivity.items ?? []).slice(0, 5).map((activity) => (
                  <li key={activity.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <Avatar name={activity.ownerName} size="xs" tone="teal" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-fg">{activity.subject}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-subtle">
                        {activity.ownerName} · {formatDate(activity.createdAt, 'relative')}
                        {activity.source === 'automation' ? ' · automated' : ''}
                      </span>
                    </span>
                    <Badge variant="outline" size="sm">
                      {activity.kind}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Forecast strip: the number most leaders open the application to check. */}
        {forecast.data ? (
          <section aria-labelledby="forecast-heading" className="rounded-lg border border-border-subtle bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div>
                <h2 id="forecast-heading" className="text-sm font-semibold tracking-tight text-fg">
                  {forecast.data.label} forecast
                </h2>
                <p className="mt-0.5 text-2xs text-muted">
                  Coverage {forecast.data.coverageRatio}× · confidence {forecast.data.confidence}
                </p>
              </div>
              <Button variant="ghost" size="xs" trailingIcon={<TrendingUp className="size-3.5" />} asChild>
                <Link to="/app/deals/forecast">Full forecast</Link>
              </Button>
            </header>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat label="Quota" value={formatMoney(forecast.data.quota.amount, forecast.data.currency, true)} />
              <MiniStat label="Commit" value={formatMoney(forecast.data.commit.amount, forecast.data.currency, true)} />
              <MiniStat label="Best case" value={formatMoney(forecast.data.bestCase.amount, forecast.data.currency, true)} />
              <MiniStat
                label="Gap to quota"
                value={formatMoney(forecast.data.gapToQuota.amount, forecast.data.currency, true)}
                tone="amber"
              />
            </div>
            {forecast.data.commentary ? (
              <p className="border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed text-muted">
                {forecast.data.commentary}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- widget slot */

function WidgetSlot({
  widget,
  data,
  editing,
  onMove,
  onRemove,
}: {
  widget: DashboardWidget;
  data: WidgetData | undefined;
  editing: boolean;
  onMove: (widgetId: string, direction: -1 | 1) => void;
  onRemove: (widgetId: string) => void;
}) {
  /** Turn a widget's series into the chart shape the frame expects. */
  const series = (data?.series ?? []).map((entry, index) => ({
    id: entry.id,
    label: entry.label,
    colour: `var(--chart-${(index % 10) + 1})`,
    dashed: entry.type === 'line' && entry.id.includes('target'),
  }));

  const points: Array<{ label: string } & Record<string, string | number>> = React.useMemo(() => {
    if (!data?.series || data.series.length === 0) return [];
    const labels = new Set<string>();
    for (const entry of data.series) for (const point of entry.data) labels.add(point.label);
    return [...labels].map((label) => {
      const row: { label: string } & Record<string, string | number> = { label };
      for (const entry of data.series!) {
        const match = entry.data.find((point) => point.label === label);
        if (match) row[entry.id] = match.value;
      }
      return row;
    });
  }, [data]);

  const controls = editing ? (
    <div className="flex items-center gap-0.5">
      <IconButton label={`Move ${widget.title} earlier`} icon={<span aria-hidden>↑</span>} size="icon-xs" onClick={() => onMove(widget.id, -1)} />
      <IconButton label={`Move ${widget.title} later`} icon={<span aria-hidden>↓</span>} size="icon-xs" onClick={() => onMove(widget.id, 1)} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={`Widget options for ${widget.title}`} icon={<GripVertical />} size="icon-xs" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{widget.title}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onRemove(widget.id)} className="text-danger-fg">
            Hide this widget
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : undefined;

  if (!data || data.state === 'empty') {
    return (
      <div className="flex flex-col rounded-lg border border-border-subtle bg-surface">
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-fg">{widget.title}</h3>
            {widget.subtitle ? <p className="mt-0.5 text-2xs text-muted">{widget.subtitle}</p> : null}
          </div>
          {controls}
        </header>
        <p className="flex flex-1 items-center justify-center px-4 py-10 text-xs text-muted">
          No data for this period and filter combination.
        </p>
      </div>
    );
  }

  if (widget.kind === 'metric_kpi') {
    return (
      <KpiCard
        label={widget.title}
        value={
          data.format === 'currency' && data.value !== undefined
            ? formatMoney(data.value, data.currency ?? 'USD', true)
            : formatNumber(data.value ?? 0, true)
        }
        delta={
          data.delta
            ? {
                text:
                  data.format === 'currency'
                    ? formatMoney(data.delta.value, data.currency ?? 'USD', true)
                    : formatNumber(data.delta.value, true),
                direction: data.delta.direction,
                sentiment: data.delta.sentiment,
                comparisonLabel: 'vs previous period',
              }
            : undefined
        }
        sample
      />
    );
  }

  if (widget.kind === 'donut_chart' || widget.kind === 'pie_chart') {
    return (
      <DonutChart
        title={widget.title}
        description={widget.subtitle}
        segments={(data.segments ?? []).map((segment) => ({
          label: segment.label,
          value: segment.value,
          tone: segment.tone,
        }))}
        centreValue={formatMoney(
          (data.segments ?? []).reduce((sum, segment) => sum + segment.value, 0),
          data.currency ?? 'USD',
          true,
        )}
        centreLabel="Total"
        formatValue={(value) => (data.format === 'currency' ? formatMoney(value, data.currency ?? 'USD', true) : formatNumber(value))}
        actions={controls}
        insight={data.insight}
        className="h-full"
      />
    );
  }

  if (widget.kind === 'leaderboard' || widget.kind === 'table') {
    return (
      <div className="flex flex-col rounded-lg border border-border-subtle bg-surface">
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-fg">{widget.title}</h3>
            {widget.subtitle ? <p className="mt-0.5 text-2xs text-muted">{widget.subtitle}</p> : null}
          </div>
          {controls}
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">{widget.title}</caption>
            <thead className="sticky top-0">
              <tr>
                {(data.columns ?? []).map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted',
                      column.align === 'end' ? 'text-end' : 'text-start',
                    )}
                  >
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
                      <td
                        key={column.key}
                        className={cn('px-3 py-1.5 text-fg', column.align === 'end' ? 'text-end tabular-nums' : 'text-start')}
                      >
                        {typeof raw === 'number'
                          ? column.format === 'currency'
                            ? formatMoney(raw, data.currency ?? 'USD', true)
                            : formatNumber(raw, true)
                          : (raw ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Time series default.
  const kind = widget.kind === 'bar_chart' ? 'bar' : widget.kind === 'horizontal_bar_chart' ? 'horizontal_bar' : widget.kind === 'stacked_bar_chart' ? 'stacked_bar' : widget.kind === 'line_chart' ? 'line' : 'area';

  return (
    <ChartFrame
      title={widget.title}
      description={widget.subtitle}
      series={series}
      data={points}
      kind={kind}
      actions={controls}
      insight={data.insight}
      formatValue={(value) => (data.format === 'currency' ? formatMoney(value, data.currency ?? 'USD', true) : formatNumber(value, true))}
      className="h-full"
    />
  );
}

export { Clock, LayoutDashboard, StatusBadge, SectionHeader };
export type { MetricPoint };
