'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { cn, toneClass, type Tone } from '../lib/utils';
import { Button } from './primitives';

/**
 * Chart components.
 *
 * Every chart in the product renders through `ChartFrame`, which owns three things the
 * brief makes non-negotiable:
 *
 *   1. **A table alternative.** `allowTableToggle` is a required field on
 *      `WidgetOptions` in the domain types, so a chart without a table does not typecheck.
 *      `ChartFrame` is where that requirement is actually satisfied.
 *   2. **An accessible summary.** Colour is never the only signal: each chart carries a
 *      text description of what it shows and the shape of the data.
 *   3. **Consistent tokens.** Fill and stroke come from `--chart-*` custom properties, so a
 *      tenant accent change re-colours every chart with no code change and dark mode works
 *      without per-chart overrides.
 *
 * Recharts is used directly rather than wrapped in a DSL, because a chart definition that
 * cannot express what a report builder needs is worse than no abstraction.
 */

export type ChartKind = 'line' | 'area' | 'bar' | 'stacked_bar' | 'horizontal_bar';

export interface ChartPoint {
  label: string;
  /** One value per series, keyed by series id. */
  [seriesId: string]: string | number;
}

export interface ChartSeries {
  id: string;
  label: string;
  kind?: ChartKind;
  /** Palette index or an explicit CSS colour. */
  colour?: string;
  /** Renders as a dashed line, used for targets and forecasts. */
  dashed?: boolean;
}

export interface ChartFrameProps {
  title: string;
  /** One line explaining what the chart shows, shown beneath the title. */
  description?: string;
  /** Rendered to the right of the title. */
  actions?: React.ReactNode;
  series?: ChartSeries[];
  data?: ChartPoint[];
  kind?: ChartKind;
  height?: number;
  /** Rows shown in the table alternative. Beyond this the table scrolls. */
  tableColumns?: Array<{ key: string; label: string; align?: 'start' | 'end' }>;
  /** Value formatter used by both the tooltip and the table. */
  formatValue?: (value: number) => string;
  /** Rendered when there is no data, instead of an empty plot area. */
  emptyState?: React.ReactNode;
  /** Locks the view to the table, e.g. for print or a high-density preference. */
  defaultView?: 'chart' | 'table';
  /** Deterministic commentary rendered beneath the chart. */
  insight?: string;
  className?: string;
  loading?: boolean;
  tone?: Tone;
}

/** Read a CSS custom property so charts follow the active theme and accent. */
function chartColour(index: number): string {
  return `var(--chart-${(index % 10) + 1})`;
}

export function ChartFrame({
  title,
  description,
  actions,
  series = [],
  data = [],
  kind = 'area',
  height = 240,
  tableColumns,
  formatValue = (value) => value.toLocaleString(),
  emptyState,
  defaultView = 'chart',
  insight,
  className,
  loading,
  tone = 'violet',
}: ChartFrameProps) {
  const [view, setView] = React.useState<'chart' | 'table'>(defaultView);
  const regionId = React.useId();

  const resolvedColumns =
    tableColumns ??
    [
      { key: 'label', label: 'Period', align: 'start' as const },
      ...series.map((entry) => ({ key: entry.id, label: entry.label, align: 'end' as const })),
    ];

  const isEmpty = data.length === 0;

  if (loading) {
    return (
      <div className={cn('rounded-lg border border-border-subtle bg-surface p-4', className)} role="status" aria-label={`Loading ${title}`}>
        <div className="h-4 w-32 animate-pulse rounded bg-inset" />
        <div className="mt-4 animate-pulse rounded bg-inset" style={{ height }} />
      </div>
    );
  }

  return (
    <figure className={cn('flex flex-col rounded-lg border border-border-subtle bg-surface', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <figcaption className="text-sm font-semibold tracking-tight text-fg">{title}</figcaption>
          {description ? <p className="text-2xs leading-snug text-muted">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {/* The toggle is always present: a chart without a table is a chart some people cannot read. */}
          <div className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-inset p-0.5" role="group" aria-label="Display format">
            <button
              type="button"
              onClick={() => setView('chart')}
              aria-pressed={view === 'chart'}
              aria-controls={regionId}
              className={cn(
                'inline-flex size-6 items-center justify-center rounded transition-colors',
                view === 'chart' ? 'bg-surface text-fg shadow-xs' : 'text-subtle hover:text-fg',
              )}
              title="Chart view"
            >
              <BarChart3 className="size-3.5" aria-hidden />
              <span className="sr-only">Chart view</span>
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              aria-controls={regionId}
              className={cn(
                'inline-flex size-6 items-center justify-center rounded transition-colors',
                view === 'table' ? 'bg-surface text-fg shadow-xs' : 'text-subtle hover:text-fg',
              )}
              title="Table view"
            >
              <Table2 className="size-3.5" aria-hidden />
              <span className="sr-only">Table view</span>
            </button>
          </div>
        </div>
      </header>

      <div id={regionId} className="min-w-0 flex-1">
        {isEmpty ? (
          <div className="flex items-center justify-center px-4" style={{ height }}>
            {emptyState ?? <p className="text-xs text-muted">No data for this period.</p>}
          </div>
        ) : view === 'chart' ? (
          <>
            {/* Screen readers get the summary and the table; the SVG is decorative to them. */}
            <p className="sr-only">
              {description ?? `${title}. `} Showing {data.length} data points across {series.length} series. Use the table view for exact values.
            </p>
            <div aria-hidden style={{ height }} className="px-1 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart(kind, data, series, formatValue)}
              </ResponsiveContainer>
            </div>
            {series.length > 1 ? (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 pt-1">
                {series.map((entry, index) => (
                  <li key={entry.id} className="inline-flex items-center gap-1.5 text-2xs text-muted">
                    <span className="size-2 rounded-sm" style={{ background: entry.colour ?? chartColour(index) }} aria-hidden />
                    {entry.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="max-h-[22rem] overflow-auto">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">{title}. {description}</caption>
              <thead className="sticky top-0">
                <tr>
                  {resolvedColumns.map((column) => (
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
                {data.map((row, rowIndex) => (
                  <tr key={`${row.label}-${rowIndex}`} className="border-b border-border-subtle last:border-b-0">
                    {resolvedColumns.map((column) => {
                      const raw = row[column.key];
                      const isNumber = typeof raw === 'number';
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            'px-3 py-1.5 text-fg',
                            column.align === 'end' ? 'text-end tabular-nums' : 'text-start',
                          )}
                        >
                          {isNumber ? formatValue(raw) : (raw ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {insight ? (
        <p className={cn('border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed', toneClass(tone, 'fg'))}>
          {insight}
        </p>
      ) : null}
    </figure>
  );
}

function renderChart(
  kind: ChartKind,
  data: ChartPoint[],
  series: ChartSeries[],
  formatValue: (value: number) => string,
) {
  const axisProps = {
    stroke: 'var(--chart-axis)',
    fontSize: 11,
    tickLine: false,
    axisLine: false,
  } as const;

  const tooltipStyle = {
    background: 'var(--chart-tooltip-surface)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: '0.5rem',
    fontSize: 12,
    padding: '6px 10px',
  } as const;

  const shared = (
    <>
      <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid)" vertical={false} />
      <XAxis dataKey="label" {...axisProps} />
      <YAxis {...axisProps} width={48} tickFormatter={(value: number) => formatValue(Number(value))} />
      <Tooltip
        contentStyle={tooltipStyle}
        formatter={(value: unknown, name: unknown) => [formatValue(Number(value ?? 0)), String(name ?? '')]}
        labelStyle={{ color: 'var(--fg)', fontWeight: 600 }}
      />
    </>
  );

  if (kind === 'bar' || kind === 'stacked_bar') {
    return (
      <BarChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        {shared}
        {series.map((entry, index) => (
          <Bar
            key={entry.id}
            dataKey={entry.id}
            name={entry.label}
            stackId={kind === 'stacked_bar' ? 'stack' : undefined}
            fill={entry.colour ?? chartColour(index)}
            radius={kind === 'stacked_bar' ? undefined : [3, 3, 0, 0]}
          />
        ))}
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /> : null}
      </BarChart>
    );
  }

  if (kind === 'horizontal_bar') {
    return (
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid)" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(value: number) => formatValue(Number(value))} />
        <YAxis type="category" dataKey="label" {...axisProps} width={120} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown, name: unknown) => [formatValue(Number(value ?? 0)), String(name ?? '')]} />
        {series.map((entry, index) => (
          <Bar key={entry.id} dataKey={entry.id} name={entry.label} fill={entry.colour ?? chartColour(index)} radius={[0, 3, 3, 0]} />
        ))}
      </BarChart>
    );
  }

  if (kind === 'line') {
    return (
      <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        {shared}
        {series.map((entry, index) => (
          <Line
            key={entry.id}
            type="monotone"
            dataKey={entry.id}
            name={entry.label}
            stroke={entry.colour ?? chartColour(index)}
            strokeWidth={2}
            strokeDasharray={entry.dashed ? '4 4' : undefined}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /> : null}
      </LineChart>
    );
  }

  return (
    <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
      <defs>
        {series.map((entry, index) => (
          <linearGradient key={entry.id} id={`fill-${entry.id}-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={entry.colour ?? chartColour(index)} stopOpacity={0.28} />
            <stop offset="100%" stopColor={entry.colour ?? chartColour(index)} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>
      {shared}
      {series.map((entry, index) => (
        <Area
          key={entry.id}
          type="monotone"
          dataKey={entry.id}
          name={entry.label}
          stroke={entry.colour ?? chartColour(index)}
          strokeWidth={2}
          strokeDasharray={entry.dashed ? '4 4' : undefined}
          fill={`url(#fill-${entry.id}-${index})`}
        />
      ))}
      {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /> : null}
    </AreaChart>
  );
}

/* ------------------------------------------------------------------- donut */

export interface DonutSegment {
  label: string;
  value: number;
  tone: Tone;
}

export interface DonutChartProps {
  title: string;
  description?: string;
  segments: DonutSegment[];
  /** The figure shown inside the ring, e.g. a total or a rate. */
  centreValue?: string;
  centreLabel?: string;
  height?: number;
  formatValue?: (value: number) => string;
  actions?: React.ReactNode;
  className?: string;
  insight?: string;
}

/**
 * Donut with an always-visible legend.
 *
 * The legend carries the value and the share as text, so the chart is readable without
 * distinguishing hues — which matters because a seven-colour ring is the least accessible
 * chart form in common use.
 */
export function DonutChart({
  title,
  description,
  segments,
  centreValue,
  centreLabel,
  height = 220,
  formatValue = (value) => value.toLocaleString(),
  actions,
  className,
  insight,
}: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <figure className={cn('flex flex-col rounded-lg border border-border-subtle bg-surface', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <figcaption className="text-sm font-semibold tracking-tight text-fg">{title}</figcaption>
          {description ? <p className="text-2xs leading-snug text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>

      {segments.length === 0 ? (
        <div className="flex items-center justify-center px-4" style={{ height }}>
          <p className="text-xs text-muted">No data for this period.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-4 sm:flex-row">
          <div className="relative shrink-0" style={{ width: height, height }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="94%"
                  paddingAngle={2}
                  stroke="var(--surface-base)"
                  strokeWidth={2}
                >
                  {segments.map((segment, index) => (
                    <Cell key={segment.label} fill={chartColour(index)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--chart-tooltip-surface)',
                    border: '1px solid var(--chart-tooltip-border)',
                    borderRadius: '0.5rem',
                    fontSize: 12,
                    padding: '6px 10px',
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    const numeric = Number(value ?? 0);
                    const share = total > 0 ? ((numeric / total) * 100).toFixed(1) : '0';
                    return [formatValue(numeric) + ' · ' + share + '%', String(name ?? '')];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {centreValue ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-semibold tabular-nums tracking-tight text-fg">{centreValue}</span>
                {centreLabel ? <span className="text-2xs text-subtle">{centreLabel}</span> : null}
              </div>
            ) : null}
          </div>

          <ul className="min-w-0 flex-1 space-y-1.5">
            {segments.map((segment, index) => (
              <li key={segment.label} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: chartColour(index) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-muted">{segment.label}</span>
                <span className="shrink-0 font-medium tabular-nums text-fg">{formatValue(segment.value)}</span>
                <span className="w-10 shrink-0 text-end tabular-nums text-subtle">
                  {total > 0 ? `${((segment.value / total) * 100).toFixed(0)}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insight ? (
        <p className="border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed text-muted">{insight}</p>
      ) : null}
    </figure>
  );
}

/* ------------------------------------------------------------------ funnel */

export interface FunnelStage {
  label: string;
  count: number;
  value?: string;
  conversionFromPrevious?: number;
}

/**
 * Funnel rendered as stacked bars rather than a tapering shape.
 *
 * A true funnel silhouette distorts the step widths, which makes the conversion rate the
 * eye reads different from the one in the data. Familiar bars with explicit percentages
 * are less decorative and more truthful.
 */
export function FunnelChart({
  title,
  description,
  stages,
  actions,
  className,
  insight,
}: {
  title: string;
  description?: string;
  stages: FunnelStage[];
  actions?: React.ReactNode;
  className?: string;
  insight?: string;
}) {
  const max = Math.max(1, ...stages.map((stage) => stage.count));

  return (
    <figure className={cn('flex flex-col rounded-lg border border-border-subtle bg-surface', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <figcaption className="text-sm font-semibold tracking-tight text-fg">{title}</figcaption>
          {description ? <p className="text-2xs leading-snug text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>

      <ol className="space-y-2.5 p-4">
        {stages.map((stage, index) => {
          const width = (stage.count / max) * 100;
          const conversion = stage.conversionFromPrevious ?? (index === 0 ? 100 : stages[index - 1]!.count > 0 ? (stage.count / stages[index - 1]!.count) * 100 : 0);
          return (
            <li key={stage.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium text-fg">{stage.label}</span>
                <span className="tabular-nums text-muted">
                  {stage.count.toLocaleString()}
                  {stage.value ? <span className="ms-1.5 text-subtle">{stage.value}</span> : null}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-inset">
                  <div
                    className={cn('h-full rounded-full', toneClass((['violet', 'blue', 'teal', 'amber', 'green'] as Tone[])[index % 5]!, 'solid'))}
                    style={{ width: `${Math.max(width, 1.5)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-end text-2xs tabular-nums text-subtle">{conversion.toFixed(0)}%</span>
              </div>
            </li>
          );
        })}
      </ol>

      {insight ? (
        <p className="border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed text-muted">{insight}</p>
      ) : null}
    </figure>
  );
}

/* -------------------------------------------------------------- sparkline */

/**
 * Inline trend line for KPI tiles and table cells.
 *
 * Deliberately has no axes, no labels and no legend: it communicates direction and shape,
 * and the exact values live in the parent tile. Marked `aria-hidden` because it carries no
 * information that is not already in the surrounding text.
 */
export function Sparkline({
  points,
  tone = 'violet',
  width = 96,
  height = 28,
  className,
}: {
  points: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const path = points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * step} ${height - ((value - min) / span) * height}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} aria-hidden focusable="false">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={toneClass(tone, 'fg')} />
    </svg>
  );
}

/** Progress bar used inside tables for attainment columns. */
export function InlineBar({ value, max = 100, tone = 'auto' }: { value: number; max?: number; tone?: Tone | 'auto' }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const resolved: Tone = tone === 'auto' ? (percent >= 75 ? 'green' : percent >= 40 ? 'amber' : 'red') : tone;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-inset" aria-hidden>
        <span className={cn('block h-full rounded-full', toneClass(resolved, 'solid'))} style={{ width: `${percent}%` }} />
      </span>
      <span className="text-2xs tabular-nums text-muted">{percent.toFixed(0)}%</span>
    </span>
  );
}

/** Small labelled figure used in dashboard widget groups. */
export function MiniStat({
  label,
  value,
  delta,
  tone = 'violet',
  className,
}: {
  label: string;
  value: string;
  delta?: { text: string; direction: 'up' | 'down' | 'flat' };
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-border-subtle bg-surface p-3', className)}>
      <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 text-md font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      {delta ? (
        <p
          className={cn(
            'mt-0.5 text-2xs font-medium',
            delta.direction === 'up' ? 'text-success-fg' : delta.direction === 'down' ? 'text-danger-fg' : 'text-muted',
          )}
        >
          {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '■'} {delta.text}
        </p>
      ) : (
        <span className={cn('mt-1 inline-block h-0.5 w-8 rounded-full', toneClass(tone, 'solid'))} aria-hidden />
      )}
    </div>
  );
}

export { Button };