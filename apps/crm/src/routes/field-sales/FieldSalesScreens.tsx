'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Car,
  CircleDot,
  ClipboardList,
  Gauge,
  MapPin,
  Navigation,
  Route,
  ShieldAlert,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  Account,
  CreateInput,
  FieldSalesOverview,
  Territory,
  VisitLog,
  VisitPlan,
  VisitStop,
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
  ChartFrame,
  DataTable,
  DemoNotice,
  DonutChart,
  Field,
  InlineBar,
  Input,
  MiniStat,
  MultiSelect,
  Progress,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TonePill,
} from '@crm/ui';
import {
  FilterBar,
  ListSkeleton,
  PageHeader,
  RecordEmptyState,
  formatDate,
  formatMoney,
  formatNumber,
} from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Field sales screens: territories, day plans with route summaries, check-in and visit logs,
 * and coverage-gap analysis.
 *
 * The single honesty constraint that shapes this module is that **check-in is simulated**.
 * `VisitLog.checkIn.gpsUsed` is always `false`; the log carries a manually chosen location
 * label and says so in its own note. Route distance and drive time are seeded local
 * estimates, and the route summary states that no routing provider is contacted. Nothing in
 * this module reads a device location or calls a map service.
 */

/* ------------------------------------------------------------------ vocab */

const TERRITORY_KIND_LABEL: Record<Territory['kind'], string> = {
  geographic: 'Geographic',
  industry: 'Industry',
  named_account: 'Named accounts',
  product: 'Product',
  hybrid: 'Hybrid',
};

const PLAN_STATUS_LABEL: Record<VisitPlan['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PLAN_STATUS_TONE: Record<VisitPlan['status'], Tone> = {
  planned: 'blue',
  in_progress: 'amber',
  completed: 'green',
  cancelled: 'slate',
};

const STOP_STATUS_LABEL: Record<VisitStop['status'], string> = {
  planned: 'Planned',
  visited: 'Visited',
  skipped: 'Skipped',
  rescheduled: 'Rescheduled',
};

const STOP_STATUS_TONE: Record<VisitStop['status'], Tone> = {
  planned: 'slate',
  visited: 'green',
  skipped: 'amber',
  rescheduled: 'violet',
};

const PURPOSE_LABEL: Record<VisitStop['purpose'], string> = {
  check_in: 'Check-in',
  demo: 'Demo',
  review: 'Review',
  training: 'Training',
  delivery: 'Delivery',
  collection: 'Collection',
  relationship: 'Relationship',
  onboarding: 'Onboarding',
  renewal: 'Renewal',
};

const OUTCOME_LABEL: Record<VisitLog['outcome'], string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  no_contact: 'No contact',
  follow_up_required: 'Follow-up required',
};

const OUTCOME_TONE: Record<VisitLog['outcome'], Tone> = {
  positive: 'green',
  neutral: 'slate',
  negative: 'red',
  no_contact: 'red',
  follow_up_required: 'amber',
};

const LOCATION_SOURCE_LABEL: Record<VisitLog['checkIn']['locationSource'], string> = {
  manual_selection: 'Chosen from a list',
  typed_address: 'Typed address',
};

const ROUTE_NOTE = 'No routing or map provider is connected. Distance and drive time are estimates computed locally for demonstration.';

function formatTime(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/* ------------------------------------------------------------- overview */

export function FieldSalesScreen() {
  const services = useServices();
  const overview = useAsync(() => services.fieldSales.overview(), []);

  if (overview.loading) {
    return (
      <div className="p-6">
        <ListSkeleton rows={6} columns={5} />
      </div>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <div className="p-6">
        <RecordEmptyState
          title="The field-sales overview could not be loaded"
          body={overview.error ?? 'No overview was returned.'}
          hints={['Retry the request.', 'Check that the field-sales service is wired into the container.']}
          primaryAction={{ label: 'Retry', onClick: overview.reload }}
        />
      </div>
    );
  }

  const data = overview.data;
  const { metrics } = data;

  const territoryColumns: ColumnDef<FieldSalesOverview['byTerritory'][number], unknown>[] = [
    {
      id: 'name',
      header: 'Territory',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link to="/app/field-sales/territories" className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
            {row.original.name}
          </Link>
          <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.memberCount} rep(s) assigned</span>
        </div>
      ),
    },
    {
      id: 'accounts',
      header: 'Accounts',
      accessorKey: 'accounts',
      meta: { align: 'end' },
      cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.accounts)}</span>,
    },
    {
      id: 'visits',
      header: 'Visits vs target',
      accessorKey: 'visits',
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted">
          {formatNumber(row.original.visits)} / {formatNumber(row.original.targetVisits)}
        </span>
      ),
    },
    { id: 'coverage', header: 'Coverage', accessorKey: 'coveragePercent', cell: ({ row }) => <InlineBar value={row.original.coveragePercent} /> },
    { id: 'attainment', header: 'Quota attainment', accessorKey: 'attainmentPercent', cell: ({ row }) => <InlineBar value={row.original.attainmentPercent} /> },
    {
      id: 'won',
      header: 'Won value',
      accessorKey: 'wonValue',
      meta: { align: 'end' },
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.wonValue.amount, row.original.wonValue.currency, true)}</span>
      ),
    },
  ];

  return (
    <div className="pb-8">
      <PageHeader
        title="Field sales"
        description="Territories, day plans with route summaries, simulated check-in and visit logs, and coverage-gap analysis."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Field sales' }]}
        actions={
          <>
            <Button variant="secondary" size="sm" leadingIcon={<MapPin className="size-3.5" />} asChild>
              <Link to="/app/field-sales/territories">Territories</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Route className="size-3.5" />} asChild>
              <Link to="/app/field-sales/visit-plans">Visit plans</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <Alert tone="info" title="Check-in and routes are simulated">
          A check-in records a manually chosen location label — no device location is read and no map or routing provider is
          contacted. Route distance and drive time are local estimates over seeded data.
        </Alert>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <MiniStat label="Visits completed" value={formatNumber(metrics.visitsCompleted)} tone="green" />
          <MiniStat label="Visits planned" value={formatNumber(metrics.visitsPlanned)} tone="blue" />
          <MiniStat label="Completion" value={`${metrics.visitCompletionPercent}%`} tone="teal" />
          <MiniStat label="Accounts covered" value={formatNumber(metrics.accountsCovered)} tone="violet" />
          <MiniStat label="Coverage" value={`${metrics.coveragePercent}%`} tone="amber" />
          <MiniStat
            label="Revenue from visits"
            value={formatMoney(metrics.revenueFromVisits.amount, metrics.revenueFromVisits.currency, true)}
            tone="green"
          />
          <MiniStat label="Orders from visits" value={formatNumber(metrics.ordersFromVisits)} tone="violet" />
          <MiniStat label="Avg visit duration" value={`${metrics.averageVisitDurationMinutes} min`} tone="blue" />
          <MiniStat label="Visits per rep" value={formatNumber(metrics.averageVisitsPerRep)} tone="teal" />
          <MiniStat label="Territory attainment" value={`${metrics.territoryAttainmentPercent}%`} tone="amber" />
          <MiniStat label="Travel per visit" value={`${metrics.travelMinutesPerVisit} min`} tone="slate" />
          <MiniStat label="Period" value={data.periodLabel} tone="slate" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartFrame
            className="lg:col-span-2"
            title="Visits over the last 14 days"
            description="Stops planned against stops actually logged, with the orders that came out of them."
            kind="bar"
            series={[
              { id: 'planned', label: 'Planned', colour: 'var(--chart-4)' },
              { id: 'completed', label: 'Completed', colour: 'var(--chart-1)' },
              { id: 'orders', label: 'Orders', colour: 'var(--chart-3)' },
            ]}
            data={data.visitTrend.map((point) => ({
              label: formatDate(point.date),
              planned: point.planned,
              completed: point.completed,
              orders: point.orders,
            }))}
            formatValue={(value) => formatNumber(value)}
            insight="Completed counts come from visit logs, so a planned stop only moves the bar once a check-in is recorded."
          />
          <DonutChart
            title="Visit outcomes"
            description="How logged visits concluded across the period."
            segments={data.outcomesBreakdown.filter((entry) => entry.count > 0).map((entry) => ({ label: entry.label, value: entry.count, tone: entry.tone }))}
            centreValue={formatNumber(metrics.visitsCompleted)}
            centreLabel="visits"
            formatValue={(value) => formatNumber(value)}
            insight={`Average visit duration is ${metrics.averageVisitDurationMinutes} minutes across the logged visits.`}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="size-4 text-subtle" aria-hidden />
            <CardTitle>Territory performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.byTerritory.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No territories are configured.</p>
            ) : (
              <DataTable
                columns={territoryColumns}
                data={data.byTerritory}
                density="compact"
                emptyState={<RecordEmptyState title="No territories" body="No territories are configured yet." />}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <ShieldAlert className="size-4 text-subtle" aria-hidden />
              <CardTitle>Coverage gaps</CardTitle>
            </CardHeader>
            <CardContent>
              {data.coverageGaps.length === 0 ? (
                <p className="text-xs text-muted">Every assigned account has been visited within the last 30 days.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {data.coverageGaps.map((gap, index) => (
                    <li key={`${gap.accountId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-fg">{gap.accountName}</p>
                        <p className="mt-0.5 text-[0.6875rem] text-faint">
                          {gap.territoryName} · {gap.daysSinceLastVisit >= 999 ? 'never visited' : `${gap.daysSinceLastVisit} days since last visit`}
                        </p>
                      </div>
                      <TonePill tone={gap.daysSinceLastVisit >= 999 ? 'red' : 'amber'} dot={false}>
                        {formatMoney(gap.potentialValue.amount, gap.potentialValue.currency, true)}
                      </TonePill>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
                An account appears here when it is assigned to a territory but has no visit log within 30 days. The value shown is the
                account's recorded won revenue.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Gauge className="size-4 text-subtle" aria-hidden />
              <CardTitle>Most active accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topAccountsByActivity.length === 0 ? (
                <p className="text-xs text-muted">No visits have been logged yet.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {data.topAccountsByActivity.map((entry, index) => (
                    <li key={`${entry.accountId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-fg">{entry.accountName}</p>
                        <p className="mt-0.5 text-[0.6875rem] text-faint">
                          {formatNumber(entry.visits)} visits · last {entry.lastVisitAt ? formatDate(entry.lastVisitAt) : 'unknown'}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums text-muted">{formatMoney(entry.revenue, data.currency, true)}</span>
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

/* ------------------------------------------------------------- territories */

function TerritoryEditor({ territory, accounts }: { territory: Territory; accounts: Account[] }) {
  const services = useServices();
  const [visitTarget, setVisitTarget] = React.useState(String(territory.visitTargetPerMonth));
  const [active, setActive] = React.useState(territory.isActive);
  const [assigned, setAssigned] = React.useState<string[]>([]);

  const save = useMutation(
    (patch: { visitTargetPerMonth: number; isActive: boolean }) => services.fieldSales.updateTerritory(territory.id, patch),
    {
      simulated: true,
      successMessage: 'Territory settings written to the local demo store.',
      onSuccess: () => undefined,
    },
  );

  const assign = useMutation((accountIds: string[]) => services.fieldSales.assignAccounts(territory.id, accountIds), {
    simulated: true,
    successMessage: (result) => `${result.accountCount} account(s) are now counted against ${result.name} in the local demo store.`,
    onSuccess: () => setAssigned([]),
  });

  const targetNumber = Number(visitTarget);
  const canSave = Number.isFinite(targetNumber) && targetNumber >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-0.5">
          <CardTitle>{territory.name}</CardTitle>
          <p className="text-2xs text-muted">
            {territory.code} · {TERRITORY_KIND_LABEL[territory.kind]} · owned by {territory.ownerName ?? 'unassigned'}
          </p>
        </div>
        <TonePill tone={territory.tone} dot={false}>
          {formatNumber(territory.accountCount)} accounts
        </TonePill>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-2xs font-medium uppercase tracking-wide text-faint">Coverage</p>
            <Progress value={territory.coveragePercent} tone="auto" showValue />
          </div>
          <div className="space-y-1">
            <p className="text-2xs font-medium uppercase tracking-wide text-faint">Quota attainment</p>
            <Progress value={territory.attainmentPercent} tone="auto" showValue />
          </div>
          <div className="space-y-1">
            <p className="text-2xs font-medium uppercase tracking-wide text-faint">Won value</p>
            <p className="text-xs font-medium text-fg">{formatMoney(territory.wonValue.amount, territory.wonValue.currency, true)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-lg border border-border-subtle bg-inset p-3 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Regions</dt>
            <dd className="mt-0.5 truncate text-xs text-fg">{territory.geography.regions.join(', ') || '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Countries</dt>
            <dd className="mt-0.5 truncate text-xs text-fg">{territory.geography.countryCodes.join(', ') || '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Postal prefixes</dt>
            <dd className="mt-0.5 truncate text-xs text-fg">{territory.geography.postalCodePrefixes.join(', ') || 'None'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Members</dt>
            <dd className="mt-0.5 truncate text-xs text-fg">{territory.memberIds.length}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Visits (30 days)</dt>
            <dd className="mt-0.5 truncate text-xs text-fg">{formatNumber(territory.visitsLast30Days)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">Quota</dt>
            <dd className="mt-0.5 truncate text-xs text-fg">
              {territory.quota ? formatMoney(territory.quota.amount, territory.quota.currency, true) : 'Not set'}
            </dd>
          </div>
        </dl>

        <form
          className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSave) return;
            void save.run({ visitTargetPerMonth: targetNumber, isActive: active });
          }}
        >
          <Field label="Visit target per month" htmlFor={`territory-target-${territory.id}`} hint="Visits">
            <Input
              id={`territory-target-${territory.id}`}
              type="number"
              min={0}
              value={visitTarget}
              onChange={(event) => setVisitTarget(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id={`territory-active-${territory.id}`} checked={active} onCheckedChange={setActive} />
              <label htmlFor={`territory-active-${territory.id}`} className="cursor-pointer text-xs text-fg">
                Active territory
              </label>
            </div>
            <Button type="submit" variant="primary" size="sm" loading={save.pending} disabled={!canSave}>
              Save settings
            </Button>
          </div>
        </form>
        {save.error ? (
          <p role="alert" className="text-xs text-danger-fg">
            {save.error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Field
            label="Assign accounts"
            htmlFor={`territory-assign-${territory.id}`}
            description="Assigning an account increments this territory's account count. Accounts are not tracked per territory in the demo store, so re-adding the same account does not double-count within a session."
          >
            <MultiSelect
              id={`territory-assign-${territory.id}`}
              values={assigned}
              onChange={setAssigned}
              options={accounts.map((account) => ({ value: account.id, label: account.name }))}
              placeholder="Search accounts to assign"
              max={50}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={assign.pending}
              disabled={assigned.length === 0 || assign.pending}
              onClick={() => void assign.run(assigned)}
            >
              Assign {assigned.length > 0 ? assigned.length : ''} account(s)
            </Button>
            {assign.error ? (
              <p role="alert" className="text-xs text-danger-fg">
                {assign.error}
              </p>
            ) : null}
          </div>
        </div>

        <DemoNotice tone="neutral">
          Territory membership and coverage in this build are synthetic. Assigning an account writes to the local demo store only and does
          not contact any geocoding or territory service.
        </DemoNotice>
      </CardContent>
    </Card>
  );
}

export function TerritoriesScreen() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [kind, setKind] = React.useState<Territory['kind'] | 'all'>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const query = React.useMemo(
    () => ({
      q: search.trim() || undefined,
      pageSize: 200,
      filter:
        kind === 'all'
          ? undefined
          : { id: 'territory-kind', conjunction: 'and' as const, clauses: [{ field: 'kind', operator: 'eq' as const, value: kind }] },
      sort: [{ field: 'name', direction: 'asc' as const }],
    }),
    [search, kind],
  );

  const territories = useList(() => services.fieldSales.territories(query), [query]);
  const accounts = useList(() => services.accounts.list({ pageSize: 200 }), []);

  const selected = selectedId ? territories.items.find((territory) => territory.id === selectedId) ?? null : null;

  const columns = React.useMemo<ColumnDef<Territory, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Territory',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
              {row.original.code} · {TERRITORY_KIND_LABEL[row.original.kind]}
            </span>
          </div>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorKey: 'ownerName',
        cell: ({ row }) => <span className="text-xs text-muted">{row.original.ownerName ?? 'Unassigned'}</span>,
      },
      {
        id: 'accounts',
        header: 'Accounts',
        accessorKey: 'accountCount',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.accountCount)}</span>,
      },
      {
        id: 'target',
        header: 'Visit target',
        accessorKey: 'visitTargetPerMonth',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.visitTargetPerMonth)}/mo</span>,
      },
      {
        id: 'visits',
        header: 'Visits (30d)',
        accessorKey: 'visitsLast30Days',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.visitsLast30Days)}</span>,
      },
      { id: 'coverage', header: 'Coverage', accessorKey: 'coveragePercent', cell: ({ row }) => <InlineBar value={row.original.coveragePercent} /> },
      { id: 'attainment', header: 'Attainment', accessorKey: 'attainmentPercent', cell: ({ row }) => <InlineBar value={row.original.attainmentPercent} /> },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'isActive',
        cell: ({ row }) => (
          <TonePill tone={row.original.isActive ? 'green' : 'slate'} dot={false}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </TonePill>
        ),
      },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Territories"
        description="Territory definitions with coverage and quota attainment. Edit the visit target, pause a territory, or assign accounts to it."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Field sales', to: '/app/field-sales' }, { label: 'Territories' }]}
        backTo={{ to: '/app/field-sales', label: 'Field sales' }}
      />

      <div className="space-y-5 p-4 sm:p-6">
        <DemoNotice tone="neutral">
          Geographic fields describe a territory; no map provider or postal-code lookup is used. Coverage is derived from the seeded visit
          logs.
        </DemoNotice>

        {selected ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Manage “{selected.name}”</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                Close editor
              </Button>
            </div>
            <TerritoryEditor key={selected.id} territory={selected} accounts={accounts.items} />
          </div>
        ) : null}

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search territories by name, code or description"
          chips={kind === 'all' ? [] : [{ id: 'kind', label: `Kind: ${TERRITORY_KIND_LABEL[kind]}`, tone: 'brand', onRemove: () => setKind('all') }]}
          onClearFilters={() => setKind('all')}
          resultCount={`${formatNumber(territories.items.length)} territor${territories.items.length === 1 ? 'y' : 'ies'}`}
          actions={
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as Territory['kind'] | 'all')}
              options={[
                { value: 'all', label: 'All kinds' },
                ...(Object.keys(TERRITORY_KIND_LABEL) as Territory['kind'][]).map((entry) => ({ value: entry, label: TERRITORY_KIND_LABEL[entry] })),
              ]}
              placeholder="Filter by kind"
              selectSize="sm"
              aria-label="Filter territories by kind"
            />
          }
        />

        {territories.loading ? (
          <ListSkeleton rows={4} columns={6} />
        ) : territories.items.length === 0 ? (
          <RecordEmptyState
            title="No territories match the current filters"
            body="Clear the search or kind filter to see every territory."
            primaryAction={{
              label: 'Clear filters',
              onClick: () => {
                setSearch('');
                setKind('all');
              },
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={territories.items}
            density="compact"
            onRowClick={(row) => setSelectedId(row.id)}
            emptyState={<RecordEmptyState title="No territories" body="No territories are configured yet." />}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- visit plans */

interface RepOption {
  value: string;
  label: string;
}

function CheckInForm({ stop, onDone }: { stop: VisitStop; onDone: () => void }) {
  const services = useServices();
  const [label, setLabel] = React.useState(stop.addressLabel);
  const [source, setSource] = React.useState<VisitLog['checkIn']['locationSource']>('manual_selection');

  const checkIn = useMutation(
    (input: { stopId: string; locationLabel: string; locationSource: VisitLog['checkIn']['locationSource'] }) =>
      services.fieldSales.checkIn(input.stopId, { locationLabel: input.locationLabel, locationSource: input.locationSource }),
    {
      simulated: true,
      successMessage: (result) => `Check-in recorded at ${result.checkIn.locationLabel}. No device location was collected.`,
      onSuccess: () => onDone(),
    },
  );

  return (
    <form
      className="mt-2 space-y-3 rounded-md border border-border-subtle bg-inset p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!label.trim()) return;
        void checkIn.run({ stopId: stop.id, locationLabel: label.trim(), locationSource: source });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Location label" htmlFor={`checkin-label-${stop.id}`} required hint="Recorded as text">
          <Input id={`checkin-label-${stop.id}`} value={label} onChange={(event) => setLabel(event.target.value)} required />
        </Field>
        <Field label="How was it chosen?" htmlFor={`checkin-source-${stop.id}`}>
          <Select
            id={`checkin-source-${stop.id}`}
            value={source}
            onValueChange={(value) => setSource(value as VisitLog['checkIn']['locationSource'])}
            options={[
              { value: 'manual_selection', label: LOCATION_SOURCE_LABEL.manual_selection },
              { value: 'typed_address', label: LOCATION_SOURCE_LABEL.typed_address },
            ]}
            selectSize="sm"
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" loading={checkIn.pending} disabled={!label.trim()}>
          Record check-in
        </Button>
        {checkIn.error ? (
          <p role="alert" className="text-xs text-danger-fg">
            {checkIn.error}
          </p>
        ) : null}
      </div>
      <p className="text-[0.6875rem] leading-relaxed text-faint">
        Check-in is simulated: a label is stored, <span className="font-mono">gpsUsed</span> stays false, and no coordinates or map provider are
        involved.
      </p>
    </form>
  );
}

function CreatePlanForm({
  organizationId,
  reps,
  territories,
  accounts,
  onDone,
}: {
  organizationId: string | undefined;
  reps: RepOption[];
  territories: Territory[];
  accounts: Account[];
  onDone: () => void;
}) {
  const services = useServices();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [date, setDate] = React.useState('');
  const [repId, setRepId] = React.useState('');
  const [territoryId, setTerritoryId] = React.useState('');
  const [accountIds, setAccountIds] = React.useState<string[]>([]);

  const create = useMutation(
    (input: CreateInput<VisitPlan>) => services.fieldSales.createVisitPlan(input),
    {
      simulated: true,
      successMessage: (result) => `Visit plan “${result.name}” was created in the local demo store.`,
      onSuccess: () => {
        setName('');
        setDate('');
        setRepId('');
        setTerritoryId('');
        setAccountIds([]);
        setOpen(false);
        onDone();
      },
    },
  );

  const rep = reps.find((candidate) => candidate.value === repId);
  const territory = territories.find((candidate) => candidate.id === territoryId);
  const canSubmit = Boolean(organizationId && name.trim() && date && repId && accountIds.length > 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !organizationId || !rep || accountIds.length === 0) return;

    const startTime = new Date(`${date}T09:00:00`);
    const stops: VisitStop[] = accountIds.map((accountId, index) => {
      const account = accounts.find((candidate) => candidate.id === accountId);
      const address = account?.addresses[0];
      return {
        id: `stop-new-${Date.now()}-${index}`,
        order: index + 1,
        accountId,
        accountName: account?.name ?? 'Account',
        addressLabel: address ? `${address.line1}${address.city ? `, ${address.city}` : ''}` : 'Address not recorded',
        contactId: undefined,
        contactName: undefined,
        plannedStartAt: new Date(startTime.getTime() + index * 60 * 60_000).toISOString(),
        plannedDurationMinutes: 45,
        purpose: 'check_in',
        status: 'planned',
        visitLogId: undefined,
        priority: 'normal',
      };
    });

    void create.run({
      organizationId,
      name: name.trim(),
      userId: rep.value,
      userName: rep.label,
      date,
      territoryId: territory?.id,
      territoryName: territory?.name,
      status: 'planned',
      stops,
      route: {
        totalDistanceKm: 0,
        estimatedDriveMinutes: 0,
        routingState: 'not_configured',
        mapPlaceholderNote: ROUTE_NOTE,
      },
      notes: undefined,
    });
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" leadingIcon={<ClipboardList className="size-3.5" />} onClick={() => setOpen(true)} disabled={!organizationId}>
        New visit plan
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>New visit plan</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Plan name" htmlFor="plan-name" required>
            <Input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Metro north — Tuesday" required />
          </Field>
          <Field label="Date" htmlFor="plan-date" required>
            <Input id="plan-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </Field>
          <Field label="Representative" htmlFor="plan-rep" required>
            <Select
              id="plan-rep"
              value={repId}
              onValueChange={setRepId}
              options={reps}
              placeholder="Choose a representative"
              searchable
            />
          </Field>
          <Field label="Territory" htmlFor="plan-territory">
            <Select
              id="plan-territory"
              value={territoryId}
              onValueChange={setTerritoryId}
              options={territories.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              placeholder="Optional territory"
              searchable
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Stops" htmlFor="plan-stops" required description="Each selected account becomes a stop, in the order shown.">
              <MultiSelect
                id="plan-stops"
                values={accountIds}
                onChange={setAccountIds}
                options={accounts.map((account) => ({ value: account.id, label: account.name }))}
                placeholder="Add accounts to visit"
                max={12}
              />
            </Field>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" size="sm" loading={create.pending} disabled={!canSubmit}>
              Create plan
            </Button>
            {create.error ? (
              <p role="alert" className="text-xs text-danger-fg">
                {create.error}
              </p>
            ) : null}
          </div>
        </form>
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
          A route is recorded with distance and drive time set to zero: no routing provider is connected, so the plan states that the estimate
          is unavailable rather than inventing one.
        </p>
      </CardContent>
    </Card>
  );
}

function CompleteVisitForm({ log, onDone }: { log: VisitLog; onDone: () => void }) {
  const services = useServices();
  const [outcome, setOutcome] = React.useState<VisitLog['outcome']>(log.outcome === 'neutral' ? 'positive' : log.outcome);
  const [summary, setSummary] = React.useState(log.summary);
  const [duration, setDuration] = React.useState('45');

  const complete = useMutation(
    (input: { outcome: VisitLog['outcome']; summary: string; durationMinutes: number }) =>
      services.fieldSales.completeVisit(log.id, { outcome: input.outcome, summary: input.summary, durationMinutes: input.durationMinutes }),
    {
      simulated: true,
      successMessage: 'Visit closed in the local demo store. A check-out time was recorded locally.',
      onSuccess: () => onDone(),
    },
  );

  const durationNumber = Number(duration);
  const canSubmit = summary.trim().length > 0 && Number.isFinite(durationNumber) && durationNumber >= 0;

  return (
    <form
      className="mt-2 space-y-3 rounded-md border border-border-subtle bg-inset p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        void complete.run({ outcome, summary: summary.trim(), durationMinutes: durationNumber });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Outcome" htmlFor={`complete-outcome-${log.id}`}>
          <Select
            id={`complete-outcome-${log.id}`}
            value={outcome}
            onValueChange={(value) => setOutcome(value as VisitLog['outcome'])}
            options={(Object.keys(OUTCOME_LABEL) as VisitLog['outcome'][]).map((entry) => ({ value: entry, label: OUTCOME_LABEL[entry] }))}
            selectSize="sm"
          />
        </Field>
        <Field label="Duration (minutes)" htmlFor={`complete-duration-${log.id}`}>
          <Input
            id={`complete-duration-${log.id}`}
            type="number"
            min={0}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Visit summary" htmlFor={`complete-summary-${log.id}`} required>
            <Textarea
              id={`complete-summary-${log.id}`}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              required
            />
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" loading={complete.pending} disabled={!canSubmit}>
          Close visit
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        {complete.error ? (
          <p role="alert" className="text-xs text-danger-fg">
            {complete.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function PlanDetail({
  plan,
  onBack,
  onChanged,
}: {
  plan: VisitPlan;
  onBack: () => void;
  onChanged: () => void;
}) {
  const services = useServices();
  const [checkInStopId, setCheckInStopId] = React.useState<string | null>(null);

  const reorder = useMutation(
    (input: { planId: string; orderedStopIds: string[] }) => services.fieldSales.reorderStops(input.planId, input.orderedStopIds),
    {
      simulated: true,
      successMessage: 'Stop order updated in the local demo store.',
      onSuccess: () => onChanged(),
    },
  );

  const move = (stopId: string, direction: -1 | 1) => {
    const ids = plan.stops.map((stop) => stop.id);
    const index = ids.indexOf(stopId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ids.length) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(index, 1);
    if (moved === undefined) return;
    reordered.splice(target, 0, moved);
    void reorder.run({ planId: plan.id, orderedStopIds: reordered });
  };

  const visited = plan.stops.filter((stop) => stop.status === 'visited').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight text-fg">
            {plan.name}
            <TonePill tone={PLAN_STATUS_TONE[plan.status]} dot={false}>
              {PLAN_STATUS_LABEL[plan.status]}
            </TonePill>
          </h2>
          <p className="mt-0.5 text-2xs text-muted">
            {plan.userName} · {formatDate(plan.date)}
            {plan.territoryName ? ` · ${plan.territoryName}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back to plans
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Stops" value={formatNumber(plan.stops.length)} tone="blue" />
        <MiniStat label="Visited" value={`${visited} / ${plan.stops.length}`} tone="green" />
        <MiniStat label="Distance" value={`${plan.route.totalDistanceKm} km`} tone="violet" />
        <MiniStat label="Drive time" value={`${plan.route.estimatedDriveMinutes} min`} tone="amber" />
      </div>

      <Alert tone="neutral" title="Route summary is a local estimate">
        {plan.route.mapPlaceholderNote}
      </Alert>

      {plan.stops.length === 0 ? (
        <RecordEmptyState title="No stops on this plan" body="This visit plan has no stops recorded against it." />
      ) : (
        <ol className="space-y-3">
          {plan.stops.map((stop, index) => (
            <li key={stop.id} className="rounded-lg border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-2xs font-semibold text-brand-fg"
                    aria-hidden
                  >
                    {stop.order}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-fg">{stop.accountName}</span>
                      <TonePill tone={STOP_STATUS_TONE[stop.status]} dot={false}>
                        {STOP_STATUS_LABEL[stop.status]}
                      </TonePill>
                      <Badge variant="outline" size="sm">
                        {PURPOSE_LABEL[stop.purpose]}
                      </Badge>
                      {stop.priority === 'high' ? (
                        <Badge variant="warning" size="sm">
                          High priority
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[0.6875rem] text-faint">
                      <MapPin className="me-1 inline size-3" aria-hidden />
                      {stop.addressLabel} · {formatTime(stop.plannedStartAt)} · {stop.plannedDurationMinutes} min
                      {stop.contactName ? ` · ${stop.contactName}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => move(stop.id, -1)}
                    disabled={index === 0 || reorder.pending}
                    aria-label={`Move ${stop.accountName} earlier`}
                  >
                    <ArrowUp className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => move(stop.id, 1)}
                    disabled={index === plan.stops.length - 1 || reorder.pending}
                    aria-label={`Move ${stop.accountName} later`}
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                  </Button>
                  {stop.status === 'planned' ? (
                    <Button
                      variant="secondary"
                      size="xs"
                      leadingIcon={<Navigation className="size-3.5" />}
                      onClick={() => setCheckInStopId(checkInStopId === stop.id ? null : stop.id)}
                    >
                      {checkInStopId === stop.id ? 'Cancel' : 'Check in'}
                    </Button>
                  ) : stop.visitLogId ? (
                    <span className="text-2xs text-muted">Visit logged</span>
                  ) : null}
                </div>
              </div>

              {checkInStopId === stop.id ? <CheckInForm stop={stop} onDone={() => { setCheckInStopId(null); onChanged(); }} /> : null}
            </li>
          ))}
        </ol>
      )}

      <DemoNotice tone="neutral">
        Reordering stops changes the presentation order only. Check-in writes a visit log and marks the stop visited in the local demo store.
      </DemoNotice>
    </div>
  );
}

export function VisitPlansScreen() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<VisitPlan['status'] | 'all'>('all');
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);

  const [logSearch, setLogSearch] = React.useState('');
  const [outcome, setOutcome] = React.useState<VisitLog['outcome'] | 'all'>('all');
  const [completingLogId, setCompletingLogId] = React.useState<string | null>(null);

  const plans = useList(() => services.fieldSales.visitPlans({ pageSize: 200, sort: [{ field: 'date', direction: 'desc' as const }] }), []);
  const logs = useList(() => services.fieldSales.visitLogs({ pageSize: 200, sort: [{ field: 'createdAt', direction: 'desc' as const }] }), []);
  const territories = useList(() => services.fieldSales.territories({ pageSize: 200 }), []);
  const accounts = useList(() => services.accounts.list({ pageSize: 200 }), []);

  const reloadAll = React.useCallback(() => {
    plans.reload();
    logs.reload();
  }, [plans, logs]);

  const reps = React.useMemo<RepOption[]>(() => {
    const map = new Map<string, string>();
    for (const plan of plans.items) map.set(plan.userId, plan.userName);
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [plans.items]);

  const organizationId = plans.items[0]?.organizationId ?? territories.items[0]?.organizationId;

  const filteredPlans = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return plans.items.filter((plan) => {
      if (status !== 'all' && plan.status !== status) return false;
      if (!term) return true;
      return `${plan.name} ${plan.userName} ${plan.territoryName ?? ''}`.toLowerCase().includes(term);
    });
  }, [plans.items, search, status]);

  const filteredLogs = React.useMemo(() => {
    const term = logSearch.trim().toLowerCase();
    return logs.items.filter((log) => {
      if (outcome !== 'all' && log.outcome !== outcome) return false;
      if (!term) return true;
      return `${log.accountName} ${log.userName} ${log.summary}`.toLowerCase().includes(term);
    });
  }, [logs.items, logSearch, outcome]);

  const selectedPlan = selectedPlanId ? plans.items.find((plan) => plan.id === selectedPlanId) ?? null : null;

  const planColumns = React.useMemo<ColumnDef<VisitPlan, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Plan',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
              {row.original.userName}
              {row.original.territoryName ? ` · ${row.original.territoryName}` : ''}
            </span>
          </div>
        ),
      },
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'date',
        cell: ({ row }) => <span className="text-xs text-muted">{formatDate(row.original.date)}</span>,
      },
      {
        id: 'stops',
        header: 'Stops',
        accessorKey: 'stops',
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted">
            {row.original.stops.filter((stop) => stop.status === 'visited').length} / {row.original.stops.length}
          </span>
        ),
      },
      {
        id: 'route',
        header: 'Route',
        accessorKey: 'route',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted">
            {row.original.route.totalDistanceKm} km · {row.original.route.estimatedDriveMinutes} min
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <TonePill tone={PLAN_STATUS_TONE[row.original.status]} dot={false}>
            {PLAN_STATUS_LABEL[row.original.status]}
          </TonePill>
        ),
      },
      {
        id: 'open',
        header: '',
        meta: { align: 'end' },
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedPlanId(row.original.id);
            }}
          >
            Open
          </Button>
        ),
      },
    ],
    [],
  );

  const logColumns = React.useMemo<ColumnDef<VisitLog, unknown>[]>(
    () => [
      {
        id: 'account',
        header: 'Account',
        accessorKey: 'accountName',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.accountName}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.userName}</span>
          </div>
        ),
      },
      {
        id: 'checkin',
        header: 'Check-in',
        accessorKey: 'checkIn',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block text-xs text-fg">
              {formatDate(row.original.checkIn.at)} · {formatTime(row.original.checkIn.at)}
            </span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
              {row.original.checkIn.locationLabel} · {LOCATION_SOURCE_LABEL[row.original.checkIn.locationSource]}
            </span>
          </div>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        accessorKey: 'durationMinutes',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.durationMinutes} min</span>,
      },
      {
        id: 'outcome',
        header: 'Outcome',
        accessorKey: 'outcome',
        cell: ({ row }) => (
          <TonePill tone={OUTCOME_TONE[row.original.outcome]} dot={false}>
            {OUTCOME_LABEL[row.original.outcome]}
          </TonePill>
        ),
      },
      {
        id: 'order',
        header: 'Order',
        accessorKey: 'orderPlaced',
        meta: { align: 'end' },
        cell: ({ row }) =>
          row.original.orderPlaced ? (
            <span className="text-xs tabular-nums text-fg">
              {formatMoney(row.original.orderPlaced.value.amount, row.original.orderPlaced.value.currency, true)}
            </span>
          ) : (
            <span className="text-2xs text-faint">—</span>
          ),
      },
      {
        id: 'state',
        header: 'State',
        accessorKey: 'checkOut',
        cell: ({ row }) => {
          const log = row.original;
          if (log.checkOut) {
            return (
              <span className="text-2xs text-muted">Closed · {formatTime(log.checkOut.at)}</span>
            );
          }
          if (completingLogId === log.id) return null;
          return (
            <Button variant="secondary" size="xs" onClick={() => setCompletingLogId(log.id)}>
              Close visit
            </Button>
          );
        },
      },
    ],
    [completingLogId],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Visit plans"
        description="Day plans with route summaries, stop ordering, simulated check-in and the resulting visit logs."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Field sales', to: '/app/field-sales' }, { label: 'Visit plans' }]}
        backTo={{ to: '/app/field-sales', label: 'Field sales' }}
        actions={
          <CreatePlanForm
            organizationId={organizationId}
            reps={reps}
            territories={territories.items}
            accounts={accounts.items}
            onDone={reloadAll}
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <Tabs defaultValue="plans">
          <TabsList aria-label="Visit planning sections">
            <TabsTrigger value="plans">
              Day plans
              <Badge variant="neutral" size="sm">
                {plans.items.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="logs">
              Visit logs
              <Badge variant="neutral" size="sm">
                {logs.items.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            {selectedPlan ? (
              <PlanDetail
                plan={selectedPlan}
                onBack={() => setSelectedPlanId(null)}
                onChanged={() => {
                  plans.reload();
                  logs.reload();
                }}
              />
            ) : plans.loading ? (
              <ListSkeleton rows={6} columns={5} />
            ) : (
              <>
                <DemoNotice tone="neutral">
                  Route distance and drive time are seeded local estimates. Opening a plan lets you reorder stops and record a simulated
                  check-in; nothing is routed or navigated.
                </DemoNotice>

                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search plans by name, rep or territory"
                  chips={status === 'all' ? [] : [{ id: 'status', label: `Status: ${PLAN_STATUS_LABEL[status]}`, tone: 'brand', onRemove: () => setStatus('all') }]}
                  onClearFilters={() => setStatus('all')}
                  resultCount={`${formatNumber(filteredPlans.length)} plan${filteredPlans.length === 1 ? '' : 's'}`}
                  actions={
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as VisitPlan['status'] | 'all')}
                      options={[
                        { value: 'all', label: 'All statuses' },
                        ...(Object.keys(PLAN_STATUS_LABEL) as VisitPlan['status'][]).map((entry) => ({ value: entry, label: PLAN_STATUS_LABEL[entry] })),
                      ]}
                      placeholder="Filter by status"
                      selectSize="sm"
                      aria-label="Filter visit plans by status"
                    />
                  }
                />

                {filteredPlans.length === 0 ? (
                  <RecordEmptyState
                    title="No visit plans match the current filters"
                    body="Clear the search or status filter, or create a new plan."
                    primaryAction={{
                      label: 'Clear filters',
                      onClick: () => {
                        setSearch('');
                        setStatus('all');
                      },
                    }}
                  />
                ) : (
                  <DataTable
                    columns={planColumns}
                    data={filteredPlans}
                    density="compact"
                    onRowClick={(row) => setSelectedPlanId(row.id)}
                    emptyState={<RecordEmptyState title="No visit plans" body="No visit plans have been created yet." />}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Alert tone="info" title="Every check-in here is simulated">
              A log records a chosen location label and leaves <span className="font-mono text-2xs">gpsUsed</span> false. Closing a visit writes an
              outcome and duration to the local demo store; it does not sync to any field application.
            </Alert>

            <FilterBar
              search={logSearch}
              onSearchChange={setLogSearch}
              searchPlaceholder="Search logs by account, rep or summary"
              chips={outcome === 'all' ? [] : [{ id: 'outcome', label: `Outcome: ${OUTCOME_LABEL[outcome]}`, tone: 'brand', onRemove: () => setOutcome('all') }]}
              onClearFilters={() => setOutcome('all')}
              resultCount={`${formatNumber(filteredLogs.length)} log${filteredLogs.length === 1 ? '' : 's'}`}
              actions={
                <Select
                  value={outcome}
                  onValueChange={(value) => setOutcome(value as VisitLog['outcome'] | 'all')}
                  options={[
                    { value: 'all', label: 'All outcomes' },
                    ...(Object.keys(OUTCOME_LABEL) as VisitLog['outcome'][]).map((entry) => ({ value: entry, label: OUTCOME_LABEL[entry] })),
                  ]}
                  placeholder="Filter by outcome"
                  selectSize="sm"
                  aria-label="Filter visit logs by outcome"
                />
              }
            />

            {logs.loading ? (
              <ListSkeleton rows={6} columns={6} />
            ) : filteredLogs.length === 0 ? (
              <RecordEmptyState
                title="No visit logs match the current filters"
                body="Clear the search or outcome filter to see every logged visit."
                primaryAction={{
                  label: 'Clear filters',
                  onClick: () => {
                    setLogSearch('');
                    setOutcome('all');
                  },
                }}
              />
            ) : (
              <>
                <DataTable
                  columns={logColumns}
                  data={filteredLogs}
                  density="compact"
                  emptyState={<RecordEmptyState title="No visit logs" body="Checking in on a planned stop creates a visit log here." />}
                />
                {logs.items
                  .filter((log) => log.id === completingLogId)
                  .map((log) => (
                    <CompleteVisitForm
                      key={log.id}
                      log={log}
                      onDone={() => {
                        setCompletingLogId(null);
                        logs.reload();
                        plans.reload();
                      }}
                    />
                  ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="px-4 sm:px-6">
        <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-inset p-3">
          <Car className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
          <p className="text-[0.6875rem] leading-relaxed text-faint">
            <CircleDot className="me-1 inline size-3" aria-hidden />
            <TriangleAlert className="me-1 inline size-3" aria-hidden />
            <Users className="me-1 inline size-3" aria-hidden />
            <CalendarDays className="me-1 inline size-3" aria-hidden />
            This module reports on synthetic field activity. It does not track locations, calculate real routes, or contact any external
            service.
          </p>
        </div>
      </div>
    </div>
  );
}
