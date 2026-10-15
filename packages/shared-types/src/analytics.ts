/**
 * Analytics, dashboards, reports and forecasting.
 *
 * Every figure shown anywhere in the product is produced here from one synthetic
 * dataset so that a dashboard, a report and a pipeline view can never disagree.
 */

import type {
  CurrencyCode,
  Id,
  ISODateString,
  MetricPoint,
  PeriodSelection,
  SeriesDefinition,
  Tone,
} from './common';

/* --------------------------------------------------------------- dashboards */

export type DashboardAudience =
  | 'executive'
  | 'sales'
  | 'sales_individual'
  | 'marketing'
  | 'service'
  | 'success'
  | 'revenue_ops'
  | 'team'
  | 'custom';

export interface Dashboard {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  audience: DashboardAudience;
  ownerId?: Id;
  ownerName?: string;
  /** Role-based default dashboards can be cloned but not edited in place. */
  kind: 'system' | 'shared' | 'personal' | 'template';
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  isDefault: boolean;
  period: PeriodSelection;
  currency: CurrencyCode;
  filterPresetIds: Id[];
  createdAt: string;
  updatedAt: string;
  updatedByName: string;
  viewCount: number;
}

export interface DashboardLayout {
  /** 12-column grid, matching every common dashboard builder. */
  columns: 12;
  rowHeight: number;
  compactType: 'vertical' | 'horizontal' | null;
  breakpoints: Array<{ name: 'sm' | 'md' | 'lg' | 'xl'; minWidth: number; columns: number }>;
}

export type WidgetKind =
  | 'metric_kpi'
  | 'line_chart'
  | 'area_chart'
  | 'bar_chart'
  | 'stacked_bar_chart'
  | 'horizontal_bar_chart'
  | 'donut_chart'
  | 'pie_chart'
  | 'funnel'
  | 'gauge'
  | 'table'
  | 'leaderboard'
  | 'activity_feed'
  | 'kanban_summary'
  | 'calendar_summary'
  | 'cohort_grid'
  | 'heatmap'
  | 'goal_progress'
  | 'pipeline_totals'
  | 'text_note'
  | 'quick_actions'
  | 'task_list'
  | 'timeline'
  | 'sparkline_row'
  | 'map_placeholder';

export interface DashboardWidget {
  id: Id;
  kind: WidgetKind;
  title: string;
  subtitle?: string;
  /** Grid placement. */
  position: { x: number; y: number; w: number; h: number };
  /** Data binding contract. The mock layer resolves this to a real series. */
  binding: WidgetBinding;
  options: WidgetOptions;
  /** Entitlement or permission gating means some widgets can be visible-but-locked. */
  requiresPermission?: string;
  requiresModuleKey?: string;
  lastRefreshedAt?: string;
  /** Empty-after-filter states look different from never-configured states. */
  state?: 'ready' | 'loading' | 'empty' | 'error' | 'not_entitled';
}

export interface WidgetBinding {
  source: 'deals' | 'leads' | 'contacts' | 'accounts' | 'activities' | 'tickets' | 'campaigns' | 'revenue' | 'subscriptions' | 'goals' | 'renewals' | 'custom_report';
  /** Aggregation applied to the measure. */
  measure: string;
  aggregation: 'sum' | 'count' | 'average' | 'median' | 'min' | 'max' | 'ratio' | 'distinct_count';
  groupBy?: string;
  /** Series split, e.g. group bars by pipeline. */
  seriesBy?: string;
  filterPresetId?: Id;
  reportId?: Id;
  limit?: number;
  sortBy?: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc' | 'date_asc' | 'date_desc';
  periodOverride?: PeriodSelection;
  /** Comparison line for charts. */
  compareWith?: 'previous_period' | 'previous_year' | 'target' | 'none';
}

export interface WidgetOptions {
  currencyDisplay?: 'organization' | 'pipeline' | 'compact';
  showLegend?: boolean;
  showGrid?: boolean;
  showValues?: boolean;
  showTargetLine?: boolean;
  stacked?: boolean;
  horizontal?: boolean;
  donutThickness?: number;
  colorScheme?: 'categorical' | 'sequential' | 'diverging' | 'single_hue';
  toneOverride?: Tone;
  /** Chart-to-table is a required accessibility feature, not a nice-to-have. */
  allowTableToggle: boolean;
  /** Aggregated data is the default; row-level is opt-in and permission-gated. */
  drilldownLevel: 'none' | 'group' | 'record';
  drilldownRoute?: string;
  numbersCompact: boolean;
  emptyStateMessage?: string;
  maxRows?: number;
  accentPresetId?: string;
}

export interface WidgetData {
  widgetId: Id;
  kind: WidgetKind;
  state: 'ready' | 'loading' | 'empty' | 'error' | 'not_entitled';
  /** KPI widgets use this. */
  value?: number;
  previousValue?: number;
  delta?: { value: number; direction: 'up' | 'down' | 'flat'; sentiment: 'positive' | 'negative' | 'neutral' };
  format?: 'currency' | 'number' | 'percent' | 'duration' | 'text';
  currency?: CurrencyCode;
  series?: SeriesDefinition[];
  categories?: string[];
  /** Table and leaderboard widgets. */
  columns?: Array<{ key: string; label: string; align?: 'start' | 'end' | 'center'; format?: string }>;
  rows?: Array<Record<string, string | number>>;
  /** Funnel and gauge widgets. */
  segments?: Array<{ label: string; value: number; tone: Tone; conversionFromPrevious?: number }>;
  /** Cohorts, heatmaps. */
  grid?: { rowLabels: string[]; columnLabels: string[]; values: Array<Array<number | null>> };
  /** Optional deterministic commentary rendered beneath the visual. */
  insight?: string;
  generatedAt: string;
  /** Honest metadata for the refresh affordance. */
  nextRefreshAt?: string;
}

/* ----------------------------------------------------------------- reports */

export type ReportCategory =
  | 'sales'
  | 'pipeline'
  | 'forecast'
  | 'activity'
  | 'marketing'
  | 'campaign'
  | 'service'
  | 'support_sla'
  | 'success'
  | 'retention'
  | 'revenue'
  | 'product'
  | 'team'
  | 'territory'
  | 'custom';

export interface ReportDefinition {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  category: ReportCategory;
  /** System reports are read-only; copies can be edited. */
  kind: 'system' | 'custom' | 'shared';
  ownerId?: Id;
  ownerName?: string;
  source: WidgetBinding['source'] | 'activities' | 'tickets';
  /** The full builder configuration. */
  config: ReportConfig;
  /** Saved output shape so a report can render without rebuilding. */
  columnSet: ReportColumn[];
  /** Cached last run so the list view shows a preview thumbnail. */
  lastRun?: ReportRunSummary;
  schedule?: ReportSchedule;
  isFavorite: boolean;
  sharedWithRoleIds: Id[];
  createdAt: string;
  updatedAt: string;
  viewCount: number;
}

export interface ReportConfig {
  period: PeriodSelection;
  filterPresetId?: Id;
  groupBy: ReportGrouping[];
  measure: { field: string; aggregation: WidgetBinding['aggregation']; label: string };
  secondaryMeasure?: { field: string; aggregation: WidgetBinding['aggregation']; label: string };
  sort?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  includeChart: boolean;
  chartType: Extract<WidgetKind, 'line_chart' | 'bar_chart' | 'stacked_bar_chart' | 'horizontal_bar_chart' | 'donut_chart' | 'funnel' | 'cohort_grid'>;
  currencyDisplay: 'organization' | 'pipeline';
  /** Comparison columns appear side by side for period-over-period reporting. */
  comparisons: Array<'previous_period' | 'previous_year' | 'target'>;
}

export interface ReportGrouping {
  id: Id;
  field: string;
  label: string;
  /** Date groupings collapse timestamps into buckets. */
  dateBucket?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /** Second-level grouping renders an expandable tree table. */
  children?: ReportGrouping[];
  sort?: 'asc' | 'desc';
  limit?: number;
}

export interface ReportColumn {
  key: string;
  label: string;
  field: string;
  kind: 'dimension' | 'measure' | 'computed' | 'trend' | 'goal' | 'comparison';
  format?: 'currency' | 'number' | 'percent' | 'duration_days' | 'date' | 'text' | 'delta';
  align?: 'start' | 'end' | 'center';
  width?: number;
  /** Computed columns are labelled so users know they are derived. */
  formulaLabel?: string;
  visible: boolean;
  sortable: boolean;
  /** Link target that makes a report actionable. */
  linkedRoute?: string;
}

export interface ReportRunSummary {
  id: Id;
  reportId: Id;
  ranAt: string;
  ranById: Id;
  ranByName: string;
  rowCount: number;
  durationMs: number;
  state: 'success' | 'empty' | 'error' | 'partial';
  errorMessage?: string;
}

export interface ReportResult {
  reportId: Id;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, number>;
  groups?: Array<{ label: string; depth: number; values: Record<string, string | number | null>; children?: ReportResult['groups'] }>;
  chart?: { kind: ReportConfig['chartType']; series: SeriesDefinition[]; categories: string[] };
  meta: { rowCount: number; truncated: boolean; generatedAt: string; periodLabel: string };
}

export interface ReportSchedule {
  id: Id;
  /** Delivery is simulated; the UI states that nothing is emailed. */
  kind: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'on_demand';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  timezone: string;
  recipients: Array<{ kind: 'user' | 'email_placeholder' | 'group'; id?: Id; label: string }>;
  format: 'xlsx_placeholder' | 'csv_placeholder' | 'pdf_placeholder' | 'link';
  active: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  deliveryState: 'simulated' | 'not_configured';
}

export interface ExportRequest {
  id: Id;
  resource: string;
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  scope: 'current_view' | 'selected_rows' | 'all_matching_filter' | 'all_records';
  rowCount: number;
  includeHiddenColumns: boolean;
  includeCustomFields: boolean;
  requestedAt: string;
  requestedById: Id;
  state: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  /** Downloads are generated locally in the browser as a demonstration. */
  generatedLocally: boolean;
  containsPersonalData: boolean;
  requiresApproval: boolean;
  note?: string;
}

/* -------------------------------------------------------------- forecasting */

export interface ForecastSnapshot {
  id: Id;
  organizationId: Id;
  pipelineId?: Id;
  scope: 'organization' | 'pipeline' | 'team' | 'individual';
  scopeLabel: string;
  period: 'month' | 'quarter' | 'year';
  periodStart: ISODateString;
  periodEnd: ISODateString;
  currency: CurrencyCode;
  quota: number;
  commit: number;
  bestCase: number;
  pipeline: number;
  closedWon: number;
  weightedPipeline: number;
  gapToQuota: number;
  coverageRatio: number;
  attainmentPercent: number;
  /** Rows behind the numbers so a forecast is explainable, not just a total. */
  contributors: Array<{
    id: Id;
    label: string;
    quota: number;
    commit: number;
    bestCase: number;
    closedWon: number;
    attainmentPercent: number;
    submissionStatus: 'submitted' | 'pending' | 'not_submitted';
    lastSubmittedAt?: string;
    userName?: string;
  }>;
  history: Array<{ label: string; closedWon: number; forecast: number; quota: number }>;
  commentary?: string;
  method: 'stage_weighted' | 'rep_rollup' | 'historical' | 'blended';
}

export interface ForecastAccuracyRow {
  periodLabel: string;
  commitAtPeriodStart: number;
  forecastAtPeriodStart: number;
  closedWon: number;
  commitAccuracyPercent: number;
  forecastAccuracyPercent: number;
}

/* ---------------------------------------------------------- analytics views */

export interface AnalyticsOverview {
  currency: CurrencyCode;
  periodLabel: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  headline: {
    revenue: number;
    previousRevenue: number;
    dealsWon: number;
    previousDealsWon: number;
    pipelineValue: number;
    previousPipelineValue: number;
    winRate: number;
    previousWinRate: number;
    averageDealSize: number;
    previousAverageDealSize: number;
    salesCycleDays: number;
    previousSalesCycleDays: number;
  };
  revenueTrend: Array<{ date: ISODateString; revenue: number; target: number; previousYear: number }>;
  pipelineByStage: Array<{ stageId: Id; label: string; count: number; value: number; weighted: number; tone: Tone }>;
  winLoss: { won: number; lost: number; noDecision: number; byReason: Array<{ label: string; count: number; value: number }> };
  byOwner: Array<{ userId: Id; name: string; revenue: number; deals: number; quota: number; attainmentPercent: number; winRate: number; activities: number }>;
  byTeam: Array<{ teamId: Id; name: string; revenue: number; deals: number; quota: number; attainmentPercent: number }>;
  byRegion: Array<{ region: string; revenue: number; deals: number; growthPercent: number }>;
  bySource: Array<{ sourceId: Id; label: string; revenue: number; deals: number; costPerAcquisition: number; roi: number }>;
  byIndustry: Array<{ industryLabel: string; revenue: number; deals: number }>;
  conversionFunnel: Array<{ label: string; count: number; conversionFromPrevious: number; conversionFromStart: number }>;
  cohortAnalysis: Array<{ cohortLabel: string; size: number; values: number[] }>;
  retention: { grr: number; nrr: number; logoRetention: number; churnRate: number; expansionRate: number };
  customerLifetimeValue: { average: number; bySegment: Array<{ segment: string; value: number }>; bySource: Array<{ source: string; value: number }> };
  activityEffectiveness: Array<{ activityKind: string; label: string; activities: number; meetingsBooked: number; dealsInfluenced: number; conversionPercent: number; averageTouchCount: number }>;
  heatmap: { rowLabels: string[]; columnLabels: string[]; values: Array<Array<number | null>> };
  insights: string[];
}

export interface TeamPerformanceRow {
  userId: Id;
  name: string;
  persona: string;
  teamName: string;
  periodLabel: string;
  revenue: number;
  quota: number;
  attainmentPercent: number;
  dealsWon: number;
  dealsLost: number;
  winRate: number;
  pipelineCreated: number;
  averageDealSize: number;
  salesCycleDays: number;
  activitiesLogged: number;
  calls: number;
  meetings: number;
  emailsSent: number;
  tasksOverdue: number;
  stageDistribution: Array<{ stageId: Id; label: string; count: number }>;
  trend: MetricPoint[];
}
