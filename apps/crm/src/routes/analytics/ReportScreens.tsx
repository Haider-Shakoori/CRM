'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, FileSpreadsheet, Play, Save } from 'lucide-react';
import type {
  ChartKind,
} from '@crm/ui';
import type {
  ExportRequest,
  ReportColumn,
  ReportConfig,
  ReportDefinition,
  ReportResult,
  WidgetBinding,
} from '@crm/shared-types';
import {
  Badge,
  Button,
  Card,
  ChartFrame,
  Checkbox,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  Input,
  Select,
  StatusBadge,
  cn,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
  RecordEmptyState,
  RecordErrorState,
  RecordHeader,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Report screens: list, viewer and builder.
 *
 * A report is a saved configuration — a source, a set of dimensions and measures — run by the
 * mock engine into a table. Two honesty rules are visible here:
 *
 *   - **Exports are simulated and the interface says so before the click.** The export dialog
 *     states that the file is produced in the browser, and the export job records
 *     `generatedLocally: true`. Nothing is emailed or uploaded.
 *   - **The builder runs what it will save.** The preview and the saved report pass through the
 *     same engine, so the table is not a separate estimate.
 */

/* ------------------------------------------------------------- shared helpers */

/** Render one report cell. `null` is a genuine "no value", not a zero. */
function formatReportCell(value: string | number | null, format: ReportColumn['format']): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return formatMoney(value, 'USD');
    case 'percent':
      return `${value}%`;
    case 'duration_days':
      return `${value}d`;
    case 'number':
    case 'delta':
    default:
      return formatNumber(value);
  }
}

/** A browser download. This is a local file operation, not a server fetch. */
function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const CHART_KIND_FOR: Partial<Record<ReportConfig['chartType'], ChartKind>> = {
  line_chart: 'line',
  bar_chart: 'bar',
  stacked_bar_chart: 'stacked_bar',
  horizontal_bar_chart: 'horizontal_bar',
};

/* ---------------------------------------------------------------------- list */

export default function ReportsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [page, setPage] = React.useState(1);

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 25,
      q: search || undefined,
      sort: [{ field: 'name', direction: 'asc' as const }],
    }),
    [page, search],
  );

  const reports = useList(() => services.reports.list(query), [JSON.stringify(query)]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const report of reports.items) set.add(report.category);
    return [...set].sort();
  }, [reports.items]);

  const filtered = React.useMemo(
    () => (category === 'all' ? reports.items : reports.items.filter((report) => report.category === category)),
    [reports.items, category],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Reports"
        description="Saved configurations of a source, dimensions and measures. Running one renders the same table the export produces."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Analytics', to: '/app/analytics' }, { label: 'Reports' }]}
        sample
        actions={
          <Button variant="primary" size="sm" asChild leadingIcon={<FileSpreadsheet className="size-3.5" />}>
            <Link to="/app/analytics/reports/new">New report</Link>
          </Button>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search reports"
            resultCount={reports.meta ? `${filtered.length.toLocaleString()} shown` : undefined}
            chips={category !== 'all' ? [{ id: 'category', label: `Category: ${category.replace(/_/g, ' ')}`, tone: 'brand', onRemove: () => setCategory('all') }] : []}
            onClearFilters={() => {
              setCategory('all');
              setSearch('');
            }}
            actions={
              <Select
                value={category}
                onValueChange={setCategory}
                options={[{ value: 'all', label: 'All categories' }, ...categories.map((value) => ({ value, label: value.replace(/_/g, ' ') }))]}
                selectSize="sm"
                className="w-[13rem]"
                aria-label="Filter by category"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {reports.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : filtered.length === 0 ? (
          <RecordEmptyState
            title="No reports match this filter"
            body="Reports arrive with the seeded organization. Clear the category filter or the search term to see them, or build a new one."
            primaryAction={{ label: 'New report', onClick: () => navigate('/app/analytics/reports/new') }}
            secondaryAction={{ label: 'Clear filters', onClick: () => { setCategory('all'); setSearch(''); } }}
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {filtered.map((report) => (
              <li key={report.id}>
                <Card
                  className="flex h-full flex-col gap-3 p-4"
                  interactive
                  onClick={() => navigate(`/app/analytics/reports/${report.id}`)}
                  tabIndex={0}
                  role="link"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/app/analytics/reports/${report.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{report.name}</h2>
                      <p className="mt-0.5 line-clamp-2 text-2xs leading-snug text-muted">{report.description}</p>
                    </div>
                    {report.isFavorite ? <Badge variant="warning" size="sm">Favourite</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="sm">{report.category.replace(/_/g, ' ')}</Badge>
                    <Badge variant="neutral" size="sm">{report.kind}</Badge>
                    <Badge variant="neutral" size="sm">Source: {report.source}</Badge>
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-2xs">
                    <div>
                      <dt className="text-faint">Last rows</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-fg">{report.lastRun ? formatNumber(report.lastRun.rowCount) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Schedule</dt>
                      <dd className="mt-0.5 truncate font-medium capitalize text-fg">{report.schedule ? report.schedule.kind : 'On demand'}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Updated</dt>
                      <dd className="mt-0.5 truncate font-medium text-fg">{formatDate(report.updatedAt, 'relative')}</dd>
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

/* ------------------------------------------------------------------- viewer */

export function ReportViewer() {
  const services = useServices();
  const { reportId } = useParams<{ reportId: string }>();

  const report = useAsync(() => services.reports.get(reportId ?? ''), [reportId], { skip: !reportId });
  const user = useAsync(() => services.tenant.currentUser(), []);
  const run = useAsync(() => services.reports.run(reportId ?? ''), [reportId, report.data?.updatedAt], { skip: !reportId || !report.data });

  const [exportOpen, setExportOpen] = React.useState(false);
  const [format, setFormat] = React.useState<ExportRequest['format']>('csv');
  const [scope, setScope] = React.useState<ExportRequest['scope']>('all_matching_filter');
  const [includeHidden, setIncludeHidden] = React.useState(false);
  const [includeCustom, setIncludeCustom] = React.useState(false);
  const [lastExport, setLastExport] = React.useState<{ filename: string; rowCount: number; format: ExportRequest['format'] } | undefined>(undefined);

  const createExport = useMutation(
    (input: Omit<ExportRequest, 'id' | 'requestedAt' | 'state' | 'generatedLocally'>) => services.exports.request(input),
    {
      onSuccess: async (request) => {
        // The job exists in this browser. Generating it produces the file; nothing is emailed.
        const generated = await services.exports.generate(request.id);
        if (!generated.ok) {
          notify.error(generated.error.message);
          return;
        }
        downloadTextFile(generated.data.filename, generated.data.content, generated.data.mimeType);
        setLastExport({ filename: generated.data.filename, rowCount: request.rowCount, format: request.format });
        setExportOpen(false);
        notify.simulated(
          'Export generated locally',
          `${generated.data.filename} was created in your browser and downloaded. Nothing was uploaded or emailed.`,
        );
      },
    },
  );

  const record = report.data;
  const result = run.data;

  if (report.loading) return <ListSkeleton rows={10} columns={4} />;
  if (report.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This report could not be found</h2>
            <p className="text-xs text-muted">{report.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/analytics/reports">Back to reports</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const chartKind = result?.chart ? CHART_KIND_FOR[result.chart.kind] : undefined;

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/analytics/reports', label: 'Reports' }}
          title={record.name}
          subtitle={record.description}
          badges={
            <>
              <Badge variant="outline" size="sm">{record.category.replace(/_/g, ' ')}</Badge>
              <Badge variant="neutral" size="sm">{record.kind}</Badge>
              {record.schedule ? <StatusBadge status="scheduled" size="sm" /> : <Badge variant="neutral" size="sm">On demand</Badge>}
            </>
          }
          facts={[
            { label: 'Source', value: record.source },
            { label: 'Rows', value: result ? formatNumber(result.meta.rowCount) : '—' },
            { label: 'Period', value: record.config.period.preset.replace(/_/g, ' ') },
            { label: 'Measure', value: `${record.config.measure.aggregation} of ${record.config.measure.field}` },
            { label: 'Last run', value: record.lastRun ? formatDate(record.lastRun.ranAt, 'relative') : '—' },
          ]}
          actions={
            <>
              <Button variant="secondary" size="sm" leadingIcon={<Play className="size-3.5" />} loading={run.loading || run.refreshing} onClick={() => run.reload()}>
                Run
              </Button>
              <Button variant="primary" size="sm" leadingIcon={<Download className="size-3.5" />} onClick={() => setExportOpen(true)}>
                Export
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {lastExport ? (
          <DemoNotice tone="neutral">
            Last export: {lastExport.filename} ({lastExport.format.toUpperCase()}, {formatNumber(lastExport.rowCount)} rows) — generated locally.
          </DemoNotice>
        ) : null}

        {run.loading ? (
          <ListSkeleton rows={8} columns={5} />
        ) : run.error || !result ? (
          <RecordErrorState message={run.error ?? 'The report could not be run.'} onRetry={run.reload} />
        ) : (
          <>
            {result.chart && chartKind ? (
              <ChartFrame
                title={`${record.name} — chart`}
                description={`A ${result.chart.kind.replace(/_/g, ' ')} of ${record.config.measure.label}. Use the table view for exact values.`}
                kind={chartKind}
                series={result.chart.series.map((entry, index) => ({ id: entry.id, label: entry.label, colour: `var(--chart-${(index % 10) + 1})` }))}
                data={result.chart.categories.map((label) => {
                  const row: { label: string } & Record<string, string | number> = { label };
                  for (const entry of result.chart!.series) {
                    const match = entry.data.find((point) => point.label === label);
                    if (match) row[entry.id] = match.value;
                  }
                  return row;
                })}
                formatValue={(value) => formatNumber(value)}
                insight={`${formatNumber(result.meta.rowCount)} rows in ${result.meta.periodLabel}.`}
              />
            ) : (
              <DemoNotice tone="neutral">
                This report&apos;s chart type ({record.config.chartType.replace(/_/g, ' ')}) has no dedicated renderer yet, so it is shown as a table.
              </DemoNotice>
            )}

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Result table</h2>
                <p className="text-2xs text-muted">
                  {formatNumber(result.meta.rowCount)} rows{result.meta.truncated ? ' (truncated to the configured limit)' : ''} · generated {formatDate(result.meta.generatedAt, 'relative')}
                </p>
              </div>
              {result.rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-muted">The report ran successfully but produced no rows for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <caption className="sr-only">{record.name} results</caption>
                    <thead className="sticky top-0">
                      <tr>
                        {result.columns.filter((column) => column.visible).map((column) => (
                          <th key={column.key} scope="col" className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', column.align === 'end' ? 'text-end' : 'text-start')}>
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, index) => (
                        <tr key={index} className="border-b border-border-subtle last:border-b-0">
                          {result.columns.filter((column) => column.visible).map((column) => (
                            <td key={column.key} className={cn('px-3 py-1.5 text-fg', column.align === 'end' ? 'text-end tabular-nums' : 'text-start')}>
                              {formatReportCell(row[column.key] ?? null, column.format)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {result.totals ? (
                      <tfoot>
                        <tr>
                          {result.columns.filter((column) => column.visible).map((column, index) => {
                            const total = result.totals?.[column.field];
                            return (
                              <td key={column.key} className={cn('border-t border-border-strong px-3 py-2 font-semibold text-fg', column.align === 'end' ? 'text-end tabular-nums' : 'text-start')}>
                                {index === 0 ? 'Total' : total !== undefined ? formatReportCell(total, column.format) : ''}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent
          title={`Export “${record.name}”`}
          description="The file is produced in your browser from the rows shown. Nothing is uploaded, emailed or stored on a server."
          footer={
            <>
              <Button variant="secondary" onClick={() => setExportOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={createExport.pending}
                onClick={() =>
                  void createExport.run({
                    resource: record.name,
                    format,
                    scope,
                    rowCount: result?.meta.rowCount ?? 0,
                    includeHiddenColumns: includeHidden,
                    includeCustomFields: includeCustom,
                    requestedById: user.data?.id ?? '',
                    containsPersonalData: false,
                    requiresApproval: false,
                    note: 'Requested from the report viewer.',
                  })
                }
              >
                Generate and download
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <DemoNotice tone="info">
              Demonstration export. The file is built locally and is labelled inside its first lines. No export service or
              email delivery is connected.
            </DemoNotice>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Format" htmlFor="export-format">
                <Select
                  id="export-format"
                  value={format}
                  onValueChange={(value) => setFormat(value as ExportRequest['format'])}
                  options={[
                    { value: 'csv', label: 'CSV' },
                    { value: 'json', label: 'JSON' },
                    { value: 'xlsx', label: 'Excel (CSV placeholder)' },
                    { value: 'pdf', label: 'PDF (not supported)' },
                  ]}
                />
              </Field>
              <Field label="Scope" htmlFor="export-scope">
                <Select
                  id="export-scope"
                  value={scope}
                  onValueChange={(value) => setScope(value as ExportRequest['scope'])}
                  options={[
                    { value: 'all_matching_filter', label: 'All rows in the current filter' },
                    { value: 'current_view', label: 'Current view only' },
                    { value: 'selected_rows', label: 'Selected rows' },
                    { value: 'all_records', label: 'All records' },
                  ]}
                />
              </Field>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-fg">
                <Checkbox checked={includeHidden} onCheckedChange={(value) => setIncludeHidden(value === true)} aria-label="Include hidden columns" />
                Include hidden columns
              </label>
              <label className="flex items-center gap-2 text-xs text-fg">
                <Checkbox checked={includeCustom} onCheckedChange={(value) => setIncludeCustom(value === true)} aria-label="Include custom fields" />
                Include custom fields
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ builder */

interface SourceOption {
  value: WidgetBinding['source'];
  label: string;
  category: ReportDefinition['category'];
  dimensions: Array<{ field: string; label: string }>;
  measures: Array<{ field: string; label: string; currency: boolean }>;
}

const SOURCE_OPTIONS: SourceOption[] = [
  {
    value: 'deals',
    label: 'Deals',
    category: 'pipeline',
    dimensions: [
      { field: 'stageId', label: 'Stage' },
      { field: 'ownerId', label: 'Owner' },
      { field: 'accountName', label: 'Account' },
      { field: 'status', label: 'Status' },
    ],
    measures: [
      { field: 'amount', label: 'Deal value', currency: true },
      { field: 'probability', label: 'Probability', currency: false },
      { field: 'daysInStage', label: 'Days in stage', currency: false },
    ],
  },
  {
    value: 'leads',
    label: 'Leads',
    category: 'marketing',
    dimensions: [
      { field: 'status', label: 'Status' },
      { field: 'rating', label: 'Rating' },
      { field: 'leadSourceId', label: 'Lead source' },
    ],
    measures: [
      { field: 'id', label: 'Lead count', currency: false },
      { field: 'estimatedValue', label: 'Estimated value', currency: true },
      { field: 'score', label: 'Score', currency: false },
    ],
  },
  {
    value: 'accounts',
    label: 'Accounts',
    category: 'revenue',
    dimensions: [
      { field: 'name', label: 'Account' },
      { field: 'industryLabel', label: 'Industry' },
      { field: 'ownerId', label: 'Owner' },
    ],
    measures: [
      { field: 'lifetimeValue', label: 'Lifetime value', currency: true },
      { field: 'healthScore', label: 'Health score', currency: false },
      { field: 'employeeCount', label: 'Employees', currency: false },
    ],
  },
  {
    value: 'activities',
    label: 'Activities',
    category: 'activity',
    dimensions: [
      { field: 'kind', label: 'Activity type' },
      { field: 'ownerId', label: 'Owner' },
      { field: 'status', label: 'Status' },
    ],
    measures: [
      { field: 'id', label: 'Activity count', currency: false },
      { field: 'durationMinutes', label: 'Duration', currency: false },
    ],
  },
  {
    value: 'tickets',
    label: 'Tickets',
    category: 'service',
    dimensions: [
      { field: 'categoryLabel', label: 'Category' },
      { field: 'priority', label: 'Priority' },
      { field: 'status', label: 'Status' },
    ],
    measures: [
      { field: 'id', label: 'Ticket count', currency: false },
      { field: 'resolutionHours', label: 'Resolution hours', currency: false },
    ],
  },
  {
    value: 'campaigns',
    label: 'Campaigns',
    category: 'campaign',
    dimensions: [{ field: 'name', label: 'Campaign' }, { field: 'status', label: 'Status' }],
    measures: [{ field: 'revenueAttributed', label: 'Attributed revenue', currency: true }],
  },
  {
    value: 'subscriptions',
    label: 'Subscriptions',
    category: 'revenue',
    dimensions: [{ field: 'planName', label: 'Plan' }, { field: 'status', label: 'Status' }],
    measures: [{ field: 'mrr', label: 'Monthly recurring revenue', currency: true }],
  },
  {
    value: 'renewals',
    label: 'Renewals',
    category: 'retention',
    dimensions: [{ field: 'renewalDate', label: 'Renewal month' }, { field: 'status', label: 'Status' }],
    measures: [{ field: 'currentValue', label: 'Renewal value', currency: true }],
  },
];

export function ReportBuilder() {
  const services = useServices();
  const navigate = useNavigate();

  const org = useAsync(() => services.organization.get(), []);

  const [name, setName] = React.useState('Untitled report');
  const [sourceValue, setSourceValue] = React.useState<WidgetBinding['source']>('deals');
  const [dimensionField, setDimensionField] = React.useState('stageId');
  const [measureField, setMeasureField] = React.useState('amount');
  const [aggregation, setAggregation] = React.useState<WidgetBinding['aggregation']>('sum');
  const [chartType, setChartType] = React.useState<ReportConfig['chartType']>('bar_chart');
  const [limit, setLimit] = React.useState('50');
  const [preview, setPreview] = React.useState<ReportResult | undefined>(undefined);
  const [previewError, setPreviewError] = React.useState<string | undefined>(undefined);

  const sourceOption = SOURCE_OPTIONS.find((option) => option.value === sourceValue) ?? SOURCE_OPTIONS[0]!;
  const dimension = sourceOption.dimensions.find((candidate) => candidate.field === dimensionField) ?? sourceOption.dimensions[0]!;
  const measure = sourceOption.measures.find((candidate) => candidate.field === measureField) ?? sourceOption.measures[0]!;

  // Changing the source resets the field selection to that source's first options, so the
  // builder can never hold a dimension that does not belong to the chosen source.
  const selectSource = (next: WidgetBinding['source']) => {
    const option = SOURCE_OPTIONS.find((candidate) => candidate.value === next) ?? SOURCE_OPTIONS[0]!;
    setSourceValue(next);
    setDimensionField(option.dimensions[0]!.field);
    setMeasureField(option.measures[0]!.field);
    setPreview(undefined);
  };

  const buildConfig = React.useCallback((): ReportConfig => {
    const isDate = dimension.field.toLowerCase().includes('date') || dimension.field.toLowerCase().includes('at');
    return {
      period: { preset: 'this_quarter' },
      groupBy: [{ id: 'g1', field: dimension.field, label: dimension.label, dateBucket: isDate ? 'month' : undefined, sort: 'desc', limit: 25 }],
      measure: { field: measure.field, aggregation, label: measure.label },
      sort: [{ field: measure.field, direction: 'desc' }],
      limit: Math.max(1, Number(limit) || 50),
      includeChart: true,
      chartType,
      currencyDisplay: 'organization',
      comparisons: ['previous_period'],
    };
  }, [aggregation, chartType, dimension, limit, measure]);

  const buildColumns = React.useCallback((): ReportColumn[] => {
    return [
      { key: dimension.field, label: dimension.label, field: dimension.field, kind: 'dimension', align: 'start', visible: true, sortable: true },
      { key: measure.field, label: measure.label, field: measure.field, kind: 'measure', format: measure.currency ? 'currency' : 'number', align: 'end', visible: true, sortable: true },
      { key: `${measure.field}__delta`, label: 'Change', field: `${measure.field}__delta`, kind: 'comparison', format: 'delta', align: 'end', visible: true, sortable: false },
    ];
  }, [dimension, measure]);

  const runPreview = useMutation(
    () => services.reports.previewDefinition(buildConfig(), buildColumns()),
    {
      onSuccess: (result) => {
        setPreview(result);
        setPreviewError(undefined);
      },
      onError: (message) => setPreviewError(message),
    },
  );

  const save = useMutation(
    (definition: CreateReport) => services.reports.create(definition),
    {
      successMessage: (created) => `“${created.name}” saved.`,
      onSuccess: (created) => navigate(`/app/analytics/reports/${created.id}`),
    },
  );

  type CreateReport = Parameters<typeof services.reports.create>[0];

  const onSave = () => {
    if (name.trim().length === 0) {
      notify.warning('Give the report a name before saving.');
      return;
    }
    if (!org.data) {
      notify.error('The organization is still loading. Try again in a moment.');
      return;
    }
    void save.run({
      organizationId: org.data.id,
      name: name.trim(),
      description: `${sourceOption.label} ${measure.label.toLowerCase()} grouped by ${dimension.label.toLowerCase()} for the selected period.`,
      category: sourceOption.category,
      kind: 'custom',
      source: sourceValue,
      config: buildConfig(),
      columnSet: buildColumns(),
      isFavorite: false,
      sharedWithRoleIds: [],
      viewCount: 0,
    });
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="New report"
        description="Choose a source, a dimension and a measure. The preview runs through the same engine the saved report uses."
        backTo={{ to: '/app/analytics/reports', label: 'Reports' }}
        actions={
          <>
            <Button variant="secondary" size="sm" leadingIcon={<Play className="size-3.5" />} loading={runPreview.pending} onClick={() => void runPreview.run(undefined)}>
              Preview
            </Button>
            <Button variant="primary" size="sm" leadingIcon={<Save className="size-3.5" />} loading={save.pending} onClick={onSave}>
              Save report
            </Button>
          </>
        }
      />

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[20rem_1fr]">
        <Card className="space-y-4 p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Definition</h2>
          <Field label="Name" htmlFor="report-name" required>
            <Input id="report-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Pipeline by stage" />
          </Field>
          <Field label="Source" htmlFor="report-source">
            <Select
              id="report-source"
              value={sourceValue}
              onValueChange={(value) => selectSource(value as WidgetBinding['source'])}
              options={SOURCE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
          </Field>
          <Field label="Group by (dimension)" htmlFor="report-dimension">
            <Select
              id="report-dimension"
              value={dimension.field}
              onValueChange={(value) => {
                setDimensionField(value);
                setPreview(undefined);
              }}
              options={sourceOption.dimensions.map((option) => ({ value: option.field, label: option.label }))}
            />
          </Field>
          <Field label="Measure" htmlFor="report-measure">
            <Select
              id="report-measure"
              value={measure.field}
              onValueChange={(value) => {
                setMeasureField(value);
                setPreview(undefined);
              }}
              options={sourceOption.measures.map((option) => ({ value: option.field, label: option.label }))}
            />
          </Field>
          <Field label="Aggregation" htmlFor="report-aggregation">
            <Select
              id="report-aggregation"
              value={aggregation}
              onValueChange={(value) => {
                setAggregation(value as WidgetBinding['aggregation']);
                setPreview(undefined);
              }}
              options={[
                { value: 'sum', label: 'Sum' },
                { value: 'count', label: 'Count' },
                { value: 'average', label: 'Average' },
                { value: 'min', label: 'Minimum' },
                { value: 'max', label: 'Maximum' },
                { value: 'distinct_count', label: 'Distinct count' },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chart" htmlFor="report-chart">
              <Select
                id="report-chart"
                value={chartType}
                onValueChange={(value) => setChartType(value as ReportConfig['chartType'])}
                options={[
                  { value: 'bar_chart', label: 'Bar' },
                  { value: 'line_chart', label: 'Line' },
                  { value: 'stacked_bar_chart', label: 'Stacked bar' },
                  { value: 'horizontal_bar_chart', label: 'Horizontal bar' },
                  { value: 'donut_chart', label: 'Donut' },
                  { value: 'funnel', label: 'Funnel' },
                ]}
              />
            </Field>
            <Field label="Row limit" htmlFor="report-limit">
              <Input id="report-limit" inputMode="numeric" value={limit} onChange={(event) => setLimit(event.target.value)} />
            </Field>
          </div>
          <DemoNotice tone="neutral">
            The preview reads the seeded dataset through the mock report engine. It is not a query against a database and
            no SQL is generated.
          </DemoNotice>
        </Card>

        <div className="space-y-4">
          {runPreview.pending ? (
            <ListSkeleton rows={8} columns={3} />
          ) : previewError ? (
            <RecordErrorState message={previewError} onRetry={() => void runPreview.run(undefined)} />
          ) : !preview ? (
            <RecordEmptyState
              title="Nothing previewed yet"
              body="Set the definition and choose Preview to run it. The saved report runs the same configuration."
              primaryAction={{ label: 'Preview', onClick: () => void runPreview.run(undefined) }}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Preview</h2>
                <p className="text-2xs text-muted">{formatNumber(preview.meta.rowCount)} rows · {preview.meta.periodLabel}</p>
              </div>
              {preview.rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-muted">No rows for this configuration and period.</p>
              ) : (
                <div className="max-h-[32rem] overflow-auto">
                  <table className="w-full border-collapse text-xs">
                    <caption className="sr-only">Report preview</caption>
                    <thead className="sticky top-0">
                      <tr>
                        {preview.columns.filter((column) => column.visible).map((column) => (
                          <th key={column.key} scope="col" className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', column.align === 'end' ? 'text-end' : 'text-start')}>
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, index) => (
                        <tr key={index} className="border-b border-border-subtle last:border-b-0">
                          {preview.columns.filter((column) => column.visible).map((column) => (
                            <td key={column.key} className={cn('px-3 py-1.5 text-fg', column.align === 'end' ? 'text-end tabular-nums' : 'text-start')}>
                              {formatReportCell(row[column.key] ?? null, column.format)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
