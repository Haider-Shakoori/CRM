'use client';

import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  FileCheck2,
  GitMerge,
  Handshake,
  Percent,
  Receipt,
  ShieldAlert,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  Account,
  CreateInput,
  DealRegistration,
  Partner,
  PartnerCommission,
  Referral,
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
  Field,
  InlineBar,
  Input,
  MiniStat,
  Select,
  TonePill,
  cn,
  notify,
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
 * Partner relationship management.
 *
 * Three things are deliberately hedged. Certifications are labelled as an internal programme
 * (no third-party accreditation is implied). Commissions are a local demonstration
 * calculation, never a finance figure. And conflict detection on a deal registration is a
 * local check against existing registrations and open deals — it advises, it does not enforce
 * exclusivity.
 */

/* ------------------------------------------------------------------ vocab */

const TIER_LABEL: Record<Partner['tier'], string> = {
  registered: 'Registered',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  strategic: 'Strategic',
};

const TIER_TONE: Record<Partner['tier'], Tone> = {
  registered: 'slate',
  silver: 'slate',
  gold: 'amber',
  platinum: 'teal',
  strategic: 'violet',
};

const TYPE_LABEL: Record<Partner['type'], string> = {
  reseller: 'Reseller',
  referral: 'Referral',
  distributor: 'Distributor',
  technology: 'Technology',
  implementation: 'Implementation',
  agency: 'Agency',
  consulting: 'Consulting',
};

const PARTNER_STATUS_TONE: Record<Partner['status'], Tone> = {
  prospect: 'slate',
  onboarding: 'blue',
  active: 'green',
  suspended: 'amber',
  terminated: 'red',
};

const REG_STATUS_LABEL: Record<DealRegistration['status'], string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
  conflict: 'Conflict',
};

const REG_STATUS_TONE: Record<DealRegistration['status'], Tone> = {
  submitted: 'blue',
  under_review: 'violet',
  approved: 'green',
  rejected: 'red',
  expired: 'slate',
  converted: 'teal',
  conflict: 'amber',
};

const REFERRAL_STATUSES: Referral['status'][] = ['new', 'contacted', 'qualified', 'converted', 'rejected', 'expired'];

const REWARD_STATUS_TONE: Record<Referral['rewardStatus'], Tone> = {
  not_due: 'slate',
  pending: 'amber',
  approved: 'blue',
  paid: 'green',
  declined: 'red',
};

const COMMISSION_STATUS_LABEL: Record<PartnerCommission['status'], string> = {
  accrued: 'Accrued',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  invoiced: 'Invoiced',
  paid: 'Paid',
  disputed: 'Disputed',
  clawed_back: 'Clawed back',
};

const COMMISSION_STATUS_TONE: Record<PartnerCommission['status'], Tone> = {
  accrued: 'slate',
  pending_approval: 'amber',
  approved: 'blue',
  invoiced: 'violet',
  paid: 'green',
  disputed: 'red',
  clawed_back: 'red',
};

function humanise(value: string): string {
  return value.replace(/_/g, ' ');
}

function tierLabel(tier: Partner['tier']): string {
  return TIER_LABEL[tier];
}

/* ------------------------------------------------------------- directory */

export function PartnersScreen() {
  const services = useServices();

  const overview = useAsync(() => services.partners.overview(), []);
  const [search, setSearch] = React.useState('');
  const [tier, setTier] = React.useState<Partner['tier'] | 'all'>('all');

  const query = React.useMemo(
    () => ({
      q: search.trim() || undefined,
      pageSize: 200,
      filter:
        tier === 'all'
          ? undefined
          : { id: 'partner-tier', conjunction: 'and' as const, clauses: [{ field: 'tier', operator: 'eq' as const, value: tier }] },
      sort: [{ field: 'name', direction: 'asc' as const }],
    }),
    [search, tier],
  );

  const partners = useList(() => services.partners.list(query), [query]);

  const columns = React.useMemo<ColumnDef<Partner, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Partner',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-medium text-fg">{row.original.name}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
              {TYPE_LABEL[row.original.type]} · {row.original.region}
            </span>
          </div>
        ),
      },
      { id: 'tier', header: 'Tier', accessorKey: 'tier', cell: ({ row }) => <TonePill tone={TIER_TONE[row.original.tier]} dot={false}>{tierLabel(row.original.tier)}</TonePill> },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <TonePill tone={PARTNER_STATUS_TONE[row.original.status]} dot={false}>{humanise(row.original.status)}</TonePill>,
      },
      {
        id: 'certs',
        header: 'Certifications',
        accessorKey: 'certifications',
        cell: ({ row }) =>
          row.original.certifications.length === 0 ? (
            <span className="text-2xs text-faint">None recorded</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-2xs text-muted">
              <BadgeCheck className="size-3.5" aria-hidden />
              {row.original.certifications.length} internal
            </span>
          ),
      },
      {
        id: 'registered',
        header: 'Registered',
        accessorKey: 'metrics.registeredDeals',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.metrics.registeredDeals)}</span>,
      },
      { id: 'winRate', header: 'Win rate', accessorKey: 'metrics.winRate', cell: ({ row }) => <InlineBar value={row.original.metrics.winRate} /> },
      {
        id: 'revenue',
        header: 'Revenue closed',
        accessorKey: 'metrics.revenueClosed',
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-fg">
            {formatMoney(row.original.metrics.revenueClosed.amount, row.original.metrics.revenueClosed.currency, true)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Partners"
        description="A partner directory with tiers and internal certifications, conflict-checked deal registration, referral tracking and demonstration commission statements."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Partners' }]}
        actions={
          <>
            <Button variant="secondary" size="sm" leadingIcon={<FileCheck2 className="size-3.5" />} asChild>
              <Link to="/app/partners/registrations">Registrations</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Handshake className="size-3.5" />} asChild>
              <Link to="/app/partners/referrals">Referrals</Link>
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Receipt className="size-3.5" />} asChild>
              <Link to="/app/partners/commissions">Commissions</Link>
            </Button>
          </>
        }
      />

      {overview.loading ? (
        <div className="p-6">
          <ListSkeleton rows={6} columns={4} />
        </div>
      ) : overview.error || !overview.data ? (
        <div className="p-6">
          <RecordEmptyState
            title="The partner overview could not be loaded"
            body={overview.error ?? 'No overview was returned.'}
            hints={['Retry the request.', 'Check that the partners service is wired into the container.']}
            primaryAction={{ label: 'Retry', onClick: overview.reload }}
          />
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <MiniStat label="Active partners" value={formatNumber(overview.data.metrics.activePartners)} tone="green" />
            <MiniStat label="Onboarding" value={formatNumber(overview.data.metrics.partnersOnboarding)} tone="blue" />
            <MiniStat label="Registrations" value={formatNumber(overview.data.metrics.registrationsSubmitted)} tone="violet" />
            <MiniStat label="Approval rate" value={`${overview.data.metrics.approvalRate}%`} tone="teal" />
            <MiniStat
              label="Sourced revenue"
              value={formatMoney(overview.data.metrics.partnerSourcedRevenue.amount, overview.data.metrics.partnerSourcedRevenue.currency, true)}
              tone="amber"
            />
            <MiniStat label="Avg partner win rate" value={`${overview.data.metrics.partnerWinRate}%`} tone="green" />
          </div>

          <DemoNotice tone="neutral">
            Partner metrics, certifications and commissions are synthetic. Commissions are calculated locally for demonstration and are not a finance record.
          </DemoNotice>

          <div className="grid gap-4 lg:grid-cols-3">
            <DonutChart
              title="Partners by tier"
              description="Distribution across the partner programme."
              segments={overview.data.byTier.filter((entry) => entry.partners > 0).map((entry) => ({ label: entry.label, value: entry.partners, tone: entry.tone }))}
              centreValue={formatNumber(overview.data.metrics.activePartners + overview.data.metrics.partnersOnboarding)}
              centreLabel="partners"
              formatValue={(value) => formatNumber(value)}
              insight={`Sourced revenue share is ${overview.data.metrics.partnerRevenueSharePercent}% of partner-attributed revenue.`}
            />
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2">
                <Users className="size-4 text-subtle" aria-hidden />
                <CardTitle>Leaderboard</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={[
                    {
                      id: 'name',
                      header: 'Partner',
                      accessorKey: 'name',
                      cell: ({ row }) => (
                        <Link
                          to={`/app/partners/${row.original.partnerId}`}
                          className="text-xs font-medium text-fg hover:text-link hover:underline"
                        >
                          {row.original.name}
                        </Link>
                      ),
                    },
                    { id: 'tier', header: 'Tier', accessorKey: 'tier', cell: ({ row }) => <TonePill tone={TIER_TONE[row.original.tier]} dot={false}>{tierLabel(row.original.tier)}</TonePill> },
                    {
                      id: 'revenue',
                      header: 'Revenue closed',
                      accessorKey: 'revenue',
                      meta: { align: 'end' },
                      cell: ({ row }) => (
                        <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.revenue.amount, row.original.revenue.currency, true)}</span>
                      ),
                    },
                    {
                      id: 'deals',
                      header: 'Won deals',
                      accessorKey: 'deals',
                      meta: { align: 'end' },
                      cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.deals)}</span>,
                    },
                  ] as ColumnDef<NonNullable<typeof overview.data>['leaderboard'][number], unknown>[]}
                  data={overview.data.leaderboard}
                  density="compact"
                  emptyState={<RecordEmptyState title="No partners" body="No partners are recorded yet." />}
                />
              </CardContent>
            </Card>
          </div>

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search partners by name, type or region"
            chips={tier === 'all' ? [] : [{ id: 'tier', label: `Tier: ${tierLabel(tier)}`, tone: 'brand', onRemove: () => setTier('all') }]}
            onClearFilters={() => setTier('all')}
            resultCount={`${formatNumber(partners.items.length)} partner${partners.items.length === 1 ? '' : 's'}`}
            actions={
              <Select
                value={tier}
                onValueChange={(value) => setTier(value as Partner['tier'] | 'all')}
                options={[{ value: 'all', label: 'All tiers' }, ...(Object.keys(TIER_LABEL) as Partner['tier'][]).map((entry) => ({ value: entry, label: TIER_LABEL[entry] }))]}
                placeholder="Filter by tier"
                selectSize="sm"
                aria-label="Filter partners by tier"
              />
            }
          />

          {partners.loading ? (
            <ListSkeleton rows={6} columns={6} />
          ) : partners.items.length === 0 ? (
            <RecordEmptyState title="No partners match the current filters" body="Clear the search or tier filter to see the directory." primaryAction={{ label: 'Clear filters', onClick: () => { setSearch(''); setTier('all'); } }} />
          ) : (
            <DataTable
              columns={columns}
              data={partners.items}
              density="compact"
              emptyState={<RecordEmptyState title="No partners" body="No partners are recorded yet." />}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ detail screen */

export function PartnerDetail() {
  const services = useServices();
  const { partnerId = '' } = useParams();

  const partner = useAsync(() => services.partners.get(partnerId), [partnerId], { skip: !partnerId });

  const registrationsQuery = React.useMemo(
    () => ({
      pageSize: 50,
      filter: { id: 'registrations-partner', conjunction: 'and' as const, clauses: [{ field: 'partnerId', operator: 'eq' as const, value: partnerId }] },
      sort: [{ field: 'submittedAt', direction: 'desc' as const }],
    }),
    [partnerId],
  );
  const registrations = useList(() => services.partners.registrations(registrationsQuery), [registrationsQuery], { skip: !partnerId });

  const commissionsQuery = React.useMemo(
    () => ({
      pageSize: 50,
      filter: { id: 'commissions-partner', conjunction: 'and' as const, clauses: [{ field: 'partnerId', operator: 'eq' as const, value: partnerId }] },
      sort: [{ field: 'periodEnd', direction: 'desc' as const }],
    }),
    [partnerId],
  );
  const commissions = useList(() => services.partners.commissions(commissionsQuery), [commissionsQuery], { skip: !partnerId });

  const completeStep = useMutation(
    (stepId: string) => services.partners.completeOnboardingStep(partnerId, stepId),
    {
      successMessage: 'Onboarding step marked complete in the local demo store.',
      onSuccess: () => partner.reload(),
    },
  );

  if (!partnerId) {
    return (
      <div className="p-6">
        <RecordEmptyState title="No partner selected" body="Open a partner from the directory." />
      </div>
    );
  }

  if (partner.loading) {
    return (
      <div className="p-6">
        <ListSkeleton rows={8} columns={4} />
      </div>
    );
  }

  if (partner.error || !partner.data) {
    return (
      <div className="p-6">
        <RecordEmptyState
          title="This partner could not be loaded"
          body={partner.error ?? 'The partner may have been removed.'}
          primaryAction={{ label: 'Retry', onClick: partner.reload }}
          secondaryAction={{ label: 'Back to partners', onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  const data = partner.data;

  return (
    <div className="pb-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {data.name}
            <TonePill tone={TIER_TONE[data.tier]} dot={false}>{tierLabel(data.tier)}</TonePill>
            <TonePill tone={PARTNER_STATUS_TONE[data.status]} dot={false}>{humanise(data.status)}</TonePill>
          </span>
        }
        description={`${TYPE_LABEL[data.type]} · ${data.region} · programme manager ${data.programManagerName}`}
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Partners', to: '/app/partners' }, { label: data.name }]}
        backTo={{ to: '/app/partners', label: 'Partners' }}
      />

      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <MiniStat label="Registered deals" value={formatNumber(data.metrics.registeredDeals)} tone="violet" />
          <MiniStat label="Won deals" value={formatNumber(data.metrics.wonDeals)} tone="green" />
          <MiniStat label="Win rate" value={`${data.metrics.winRate}%`} tone="teal" />
          <MiniStat label="Revenue closed" value={formatMoney(data.metrics.revenueClosed.amount, data.metrics.revenueClosed.currency, true)} tone="blue" />
          <MiniStat label="Commission earned" value={formatMoney(data.metrics.commissionEarned.amount, data.metrics.commissionEarned.currency, true)} tone="amber" />
          <MiniStat label="Active deals" value={formatNumber(data.metrics.activeDeals)} tone="violet" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Onboarding</CardTitle>
              <Badge variant={data.onboarding.state === 'completed' ? 'success' : data.onboarding.state === 'in_progress' ? 'warning' : 'neutral'} size="sm">
                {humanise(data.onboarding.state)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-2xs text-faint">
                <span>{Math.round(data.onboarding.progressPercent)}% complete</span>
                <span>{data.onboarding.checklist.filter((item) => item.done).length} of {data.onboarding.checklist.length}</span>
              </div>
              <ul className="space-y-2.5">
                {data.onboarding.checklist.map((item) => {
                  const controlId = `partner-step-${data.id}-${item.id}`;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-inset px-3 py-2">
                      <label htmlFor={controlId} className={cn('cursor-pointer text-xs', item.done ? 'text-muted line-through' : 'text-fg')}>
                        {item.label}
                        {item.required ? <span className="ms-1 text-danger-fg" aria-hidden>*</span> : null}
                        {item.required ? <span className="sr-only">(required)</span> : null}
                      </label>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={item.done || completeStep.pending}
                        onClick={() => void completeStep.run(item.id)}
                        aria-label={`Mark “${item.label}” complete`}
                      >
                        {item.done ? 'Done' : 'Complete'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[0.6875rem] leading-relaxed text-faint">
                The programme completes once every required item is done. Steps are written to the local demo store only.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <BadgeCheck className="size-4 text-subtle" aria-hidden />
              <CardTitle>Certifications &amp; specialisations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.certifications.length === 0 ? (
                <p className="text-xs text-muted">No certifications are recorded against this partner.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.certifications.map((certification) => (
                    <li key={certification.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-inset px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-fg">{certification.name}</p>
                        <p className="mt-0.5 text-[0.6875rem] text-faint">
                          {humanise(certification.level)} · granted {formatDate(certification.grantedAt)}
                          {certification.expiresAt ? ` · expires ${formatDate(certification.expiresAt)}` : ''}
                        </p>
                      </div>
                      <Badge variant="neutral" size="sm">Internal programme</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-faint">Specialisations</p>
                {data.specializationTags.length === 0 ? (
                  <p className="text-xs text-muted">No specialisations recorded.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {data.specializationTags.map((tag, index) => (
                      <li key={`${tag}-${index}`}>
                        <Badge variant="outline" size="sm">{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-[0.6875rem] leading-relaxed text-faint">
                Certifications belong to an internal partner programme run in this CRM. No third-party accreditation is claimed.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ClipboardList className="size-4 text-subtle" aria-hidden />
            <CardTitle>Tier requirements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">Tier requirements against the achieved value</caption>
              <thead>
                <tr className="border-b border-border-subtle text-2xs uppercase tracking-wide text-faint">
                  <th scope="col" className="px-4 py-2 text-start font-medium">Requirement</th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">Target</th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">Achieved</th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.tierRequirements.map((requirement) => (
                  <tr key={requirement.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-2 text-fg">{requirement.label}</td>
                    <td className="px-4 py-2 tabular-nums text-muted">{requirement.target}</td>
                    <td className="px-4 py-2 tabular-nums text-muted">{requirement.achieved}</td>
                    <td className="px-4 py-2">
                      <TonePill tone={requirement.met ? 'green' : 'amber'} dot={false}>{requirement.met ? 'Met' : 'Not met'}</TonePill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <FileCheck2 className="size-4 text-subtle" aria-hidden />
            <CardTitle>Deal registrations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {registrations.loading ? (
              <div className="p-4"><ListSkeleton rows={3} columns={4} /></div>
            ) : registrations.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No registrations from this partner.</p>
            ) : (
              <DataTable
                columns={[
                  {
                    id: 'reference',
                    header: 'Reference',
                    accessorKey: 'reference',
                    cell: ({ row }) => (
                      <Link to="/app/partners/registrations" className="font-mono text-2xs text-link hover:underline">
                        {row.original.reference}
                      </Link>
                    ),
                  },
                  { id: 'deal', header: 'Deal', accessorKey: 'dealName', cell: ({ row }) => <span className="text-xs text-fg">{row.original.dealName}</span> },
                  {
                    id: 'status',
                    header: 'Status',
                    accessorKey: 'status',
                    cell: ({ row }) => <TonePill tone={REG_STATUS_TONE[row.original.status]} dot={false}>{REG_STATUS_LABEL[row.original.status]}</TonePill>,
                  },
                  {
                    id: 'value',
                    header: 'Estimated value',
                    accessorKey: 'estimatedValue',
                    meta: { align: 'end' },
                    cell: ({ row }) => (
                      <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.estimatedValue.amount, row.original.estimatedValue.currency, true)}</span>
                    ),
                  },
                ] as ColumnDef<DealRegistration, unknown>[]}
                data={registrations.items}
                density="compact"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Receipt className="size-4 text-subtle" aria-hidden />
            <CardTitle>Commission statements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {commissions.loading ? (
              <div className="p-4"><ListSkeleton rows={3} columns={4} /></div>
            ) : commissions.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No commission records for this partner.</p>
            ) : (
              <DataTable
                columns={[
                  {
                    id: 'period',
                    header: 'Period',
                    accessorKey: 'periodEnd',
                    cell: ({ row }) => <span className="text-xs text-muted">{formatDate(row.original.periodStart)} – {formatDate(row.original.periodEnd)}</span>,
                  },
                  { id: 'basis', header: 'Basis', accessorKey: 'basisAmount', cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatMoney(row.original.basisAmount.amount, row.original.basisAmount.currency, true)}</span> },
                  { id: 'rate', header: 'Rate', accessorKey: 'ratePercent', meta: { align: 'end' }, cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.ratePercent}%</span> },
                  {
                    id: 'amount',
                    header: 'Amount',
                    accessorKey: 'amount',
                    meta: { align: 'end' },
                    cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.amount.amount, row.original.amount.currency, true)}</span>,
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    accessorKey: 'status',
                    cell: ({ row }) => <TonePill tone={COMMISSION_STATUS_TONE[row.original.status]} dot={false}>{COMMISSION_STATUS_LABEL[row.original.status]}</TonePill>,
                  },
                ] as ColumnDef<PartnerCommission, unknown>[]}
                data={commissions.items}
                density="compact"
              />
            )}
          </CardContent>
        </Card>

        <DemoNotice tone="neutral">
          Commission amounts are a local demonstration calculation over synthetic partner revenue ({data.certifications.length} internal certification record(s) shown). No finance system produced these figures.
        </DemoNotice>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- deal registrations */

function RegistrationForm({ partners, accounts, onDone }: { partners: Partner[]; accounts: Account[]; onDone: () => void }) {
  const services = useServices();
  const [open, setOpen] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [dealName, setDealName] = React.useState('');
  const [value, setValue] = React.useState('');
  const [closeDate, setCloseDate] = React.useState('');

  const submit = useMutation(
    (input: CreateInput<DealRegistration>) => services.partners.submitRegistration(input),
    {
      simulated: true,
      successMessage: (result) => `Registration ${result.reference} was ${result.status === 'conflict' ? 'flagged with a conflict' : 'recorded'} in the local demo store.`,
      onSuccess: () => {
        setDealName('');
        setValue('');
        setCloseDate('');
        setOpen(false);
        onDone();
      },
    },
  );

  const partner = partners.find((candidate) => candidate.id === partnerId);
  const account = accounts.find((candidate) => candidate.id === accountId);
  const valueNumber = Number(value) || 0;
  const canSubmit = Boolean(partner && account && dealName.trim() && valueNumber > 0 && closeDate);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!partner || !account || !canSubmit) return;
    const now = new Date().toISOString();
    void submit.run({
      organizationId: partner.organizationId,
      reference: '',
      partnerId: partner.id,
      partnerName: partner.name,
      accountId: account.id,
      accountName: account.name,
      dealName: dealName.trim(),
      status: 'submitted',
      submittedAt: now,
      submittedByName: 'Partner portal user',
      estimatedValue: { amount: valueNumber, currency: partner.currency },
      expectedCloseDate: closeDate,
      currency: partner.currency,
      products: [],
      protectionDays: 90,
      protectionExpiresAt: undefined,
      conflictChecks: [],
      reviewNotes: undefined,
      reviewedById: undefined,
      reviewedAt: undefined,
      convertedDealId: undefined,
      discountPercent: undefined,
    });
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" leadingIcon={<GitMerge className="size-3.5" />} onClick={() => setOpen(true)}>
        Register a deal
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Register a deal</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Partner" htmlFor="reg-partner" required>
            <Select
              id="reg-partner"
              value={partnerId}
              onValueChange={setPartnerId}
              options={partners.map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${tierLabel(candidate.tier)}` }))}
              placeholder="Choose a partner"
              searchable
            />
          </Field>
          <Field label="Account" htmlFor="reg-account" required>
            <Select
              id="reg-account"
              value={accountId}
              onValueChange={setAccountId}
              options={accounts.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              placeholder="Choose an account"
              searchable
            />
          </Field>
          <Field label="Deal name" htmlFor="reg-name" required>
            <Input id="reg-name" value={dealName} onChange={(event) => setDealName(event.target.value)} placeholder="New business opportunity" required />
          </Field>
          <Field label="Estimated value" htmlFor="reg-value" required hint={partner ? partner.currency : undefined}>
            <Input id="reg-value" type="number" min={0} step={1000} value={value} onChange={(event) => setValue(event.target.value)} placeholder="0" required />
          </Field>
          <Field label="Expected close date" htmlFor="reg-close" required>
            <Input id="reg-close" type="date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} required />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" size="sm" loading={submit.pending} disabled={!canSubmit}>
              Submit registration
            </Button>
            {submit.error ? <p role="alert" className="text-xs text-danger-fg">{submit.error}</p> : null}
          </div>
        </form>
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
          Submitting runs the local conflict check against existing registrations and open deals. The registration is written to the local demo store only.
        </p>
      </CardContent>
    </Card>
  );
}

export function DealRegistrationsScreen() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<DealRegistration['status'] | 'all'>('all');

  const query = React.useMemo(
    () => ({
      q: search.trim() || undefined,
      pageSize: 200,
      filter:
        status === 'all'
          ? undefined
          : { id: 'registration-status', conjunction: 'and' as const, clauses: [{ field: 'status', operator: 'eq' as const, value: status }] },
      sort: [{ field: 'submittedAt', direction: 'desc' as const }],
    }),
    [search, status],
  );

  const registrations = useList(() => services.partners.registrations(query), [query]);
  const partners = useList(() => services.partners.list({ pageSize: 200 }), []);
  const accounts = useList(() => services.accounts.list({ pageSize: 200 }), []);

  const decide = useMutation(
    (input: { id: string; decision: 'approved' | 'rejected' }) => services.partners.decideRegistration(input.id, input.decision),
    {
      successMessage: (result) => `Registration ${result.reference} is now ${humanise(result.status)}.`,
      onSuccess: () => registrations.reload(),
    },
  );

  const convert = useMutation((id: string) => services.partners.convertRegistration(id), {
    successMessage: (result) => `Converted to deal ${result.deal.reference}. The deal is open in the local demo store.`,
    onSuccess: () => registrations.reload(),
  });

  const conflictRows = registrations.items.filter((registration) => registration.conflictChecks.some((check) => check.severity === 'blocking'));

  const columns = React.useMemo<ColumnDef<DealRegistration, unknown>[]>(
    () => [
      {
        id: 'reference',
        header: 'Registration',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block font-mono text-2xs text-subtle">{row.original.reference}</span>
            <span className="mt-0.5 block truncate text-xs font-medium text-fg">{row.original.dealName}</span>
          </div>
        ),
      },
      {
        id: 'partner',
        header: 'Partner',
        accessorKey: 'partnerName',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/partners/${row.original.partnerId}`} className="block truncate text-xs text-fg hover:text-link hover:underline">
              {row.original.partnerName}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.accountName}</span>
          </div>
        ),
      },
      {
        id: 'value',
        header: 'Estimated value',
        accessorKey: 'estimatedValue',
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.estimatedValue.amount, row.original.estimatedValue.currency, true)}</span>
        ),
      },
      {
        id: 'protection',
        header: 'Protection',
        accessorKey: 'protectionExpiresAt',
        cell: ({ row }) => (
          <span className="text-xs text-muted">
            {row.original.protectionExpiresAt ? `Until ${formatDate(row.original.protectionExpiresAt)}` : `${row.original.protectionDays} days`}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <TonePill tone={REG_STATUS_TONE[row.original.status]} dot={false}>{REG_STATUS_LABEL[row.original.status]}</TonePill>
            {row.original.conflictChecks.length > 0 ? (
              <Badge variant={row.original.conflictChecks.some((check) => check.severity === 'blocking') ? 'danger' : 'warning'} size="sm">
                {row.original.conflictChecks.length} check(s)
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Decision',
        cell: ({ row }) => {
          const registration = row.original;
          const canDecide = registration.status === 'submitted' || registration.status === 'under_review';
          const canConvert = registration.status === 'submitted' || registration.status === 'under_review' || registration.status === 'approved';
          return (
            <div className="flex flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
              {canDecide ? (
                <>
                  <Button variant="secondary" size="xs" disabled={decide.pending} onClick={() => void decide.run({ id: registration.id, decision: 'approved' })}>
                    Approve
                  </Button>
                  <Button variant="ghost" size="xs" disabled={decide.pending} onClick={() => void decide.run({ id: registration.id, decision: 'rejected' })}>
                    Reject
                  </Button>
                </>
              ) : null}
              {canConvert ? (
                <Button variant="primary" size="xs" disabled={convert.pending} loading={convert.pending} onClick={() => void convert.run(registration.id)}>
                  Convert
                </Button>
              ) : null}
              {registration.convertedDealId ? (
                <Link to={`/app/deals/${registration.convertedDealId}`} className="text-2xs text-link hover:underline">
                  Deal
                </Link>
              ) : null}
            </div>
          );
        },
      },
    ],
    [decide, convert],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Deal registrations"
        description="Conflict-checked deal registration. The check compares a submission against existing registrations and open deals; it advises, it does not enforce exclusivity."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Partners', to: '/app/partners' }, { label: 'Registrations' }]}
        backTo={{ to: '/app/partners', label: 'Partners' }}
        actions={<RegistrationForm partners={partners.items} accounts={accounts.items} onDone={registrations.reload} />}
      />

      <div className="space-y-5 p-4 sm:p-6">
        {conflictRows.length > 0 ? (
          <Alert tone="warning" title={`${conflictRows.length} registration(s) carry a blocking conflict`} live="polite">
            <ul className="mt-1 space-y-1">
              {conflictRows.slice(0, 4).map((registration) => (
                <li key={registration.id}>
                  <span className="font-mono text-2xs">{registration.reference}</span> — {registration.conflictChecks.find((check) => check.severity === 'blocking')?.label ?? 'Conflict detected'}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <DemoNotice tone="neutral">
          Conflict detection is a local comparison against this demo database. It is a workflow aid, not an enforcement or legal guarantee of exclusivity.
        </DemoNotice>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search registrations by reference, deal, partner or account"
          chips={status === 'all' ? [] : [{ id: 'status', label: `Status: ${REG_STATUS_LABEL[status]}`, tone: 'brand', onRemove: () => setStatus('all') }]}
          onClearFilters={() => setStatus('all')}
          resultCount={`${formatNumber(registrations.items.length)} registration${registrations.items.length === 1 ? '' : 's'}`}
          actions={
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as DealRegistration['status'] | 'all')}
              options={[
                { value: 'all', label: 'All statuses' },
                ...(Object.keys(REG_STATUS_LABEL) as DealRegistration['status'][]).map((entry) => ({ value: entry, label: REG_STATUS_LABEL[entry] })),
              ]}
              placeholder="Filter by status"
              selectSize="sm"
              aria-label="Filter registrations by status"
            />
          }
        />

        {registrations.loading ? (
          <ListSkeleton rows={6} columns={6} />
        ) : registrations.items.length === 0 ? (
          <RecordEmptyState title="No registrations match the current filters" body="Clear the search or status filter, or register a new deal." primaryAction={{ label: 'Clear filters', onClick: () => { setSearch(''); setStatus('all'); } }} />
        ) : (
          <DataTable
            columns={columns}
            data={registrations.items}
            density="compact"
            emptyState={<RecordEmptyState title="No registrations" body="No partner deal registrations have been submitted yet." />}
          />
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- referrals */

export function ReferralsScreen() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<Referral['status'] | 'all'>('all');

  const query = React.useMemo(
    () => ({
      q: search.trim() || undefined,
      pageSize: 200,
      filter:
        status === 'all'
          ? undefined
          : { id: 'referral-status', conjunction: 'and' as const, clauses: [{ field: 'status', operator: 'eq' as const, value: status }] },
      sort: [{ field: 'receivedAt', direction: 'desc' as const }],
    }),
    [search, status],
  );

  const referrals = useList(() => services.partners.referrals(query), [query]);

  const updateReferral = useMutation(
    (input: { id: string; status: Referral['status'] }) => services.partners.updateReferral(input.id, { status: input.status }),
    {
      successMessage: 'Referral status updated in the local demo store.',
      onSuccess: () => referrals.reload(),
    },
  );

  const columns = React.useMemo<ColumnDef<Referral, unknown>[]>(
    () => [
      {
        id: 'reference',
        header: 'Referral',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block font-mono text-2xs text-subtle">{row.original.reference}</span>
            <span className="mt-0.5 block truncate text-xs font-medium text-fg">{row.original.referredCompanyName}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.referredContactName} · {row.original.referredEmail}</span>
          </div>
        ),
      },
      {
        id: 'referrer',
        header: 'Referrer',
        accessorKey: 'referrerName',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs text-fg">{row.original.referrerName}</span>
            <span className="mt-0.5 block text-[0.6875rem] text-faint">{humanise(row.original.referrerKind)}</span>
          </div>
        ),
      },
      {
        id: 'received',
        header: 'Received',
        accessorKey: 'receivedAt',
        cell: ({ row }) => <span className="text-xs text-muted">{formatDate(row.original.receivedAt)}</span>,
      },
      {
        id: 'reward',
        header: 'Reward',
        accessorKey: 'rewardAmount',
        cell: ({ row }) =>
          row.original.rewardAmount ? (
            <span className="flex flex-col">
              <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.rewardAmount.amount, row.original.rewardAmount.currency, true)}</span>
              <TonePill tone={REWARD_STATUS_TONE[row.original.rewardStatus]} dot={false}>{humanise(row.original.rewardStatus)}</TonePill>
            </span>
          ) : (
            <span className="text-2xs text-faint">No reward</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <Select
            value={row.original.status}
            onValueChange={(value) => void updateReferral.run({ id: row.original.id, status: value as Referral['status'] })}
            options={REFERRAL_STATUSES.map((entry) => ({ value: entry, label: humanise(entry) }))}
            selectSize="sm"
            aria-label={`Change status for referral ${row.original.reference}`}
          />
        ),
      },
    ],
    [updateReferral],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Referrals"
        description="Partner and customer referrals tracked through to qualification, with a demonstration reward status."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Partners', to: '/app/partners' }, { label: 'Referrals' }]}
        backTo={{ to: '/app/partners', label: 'Partners' }}
      />

      <div className="space-y-5 p-4 sm:p-6">
        <DemoNotice tone="neutral">
          Referrals shown here are derived from the partner directory for demonstration. Changing a status writes to the local demo store only.
        </DemoNotice>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search referrals by reference, referrer or company"
          chips={status === 'all' ? [] : [{ id: 'status', label: `Status: ${humanise(status)}`, tone: 'brand', onRemove: () => setStatus('all') }]}
          onClearFilters={() => setStatus('all')}
          resultCount={`${formatNumber(referrals.items.length)} referral${referrals.items.length === 1 ? '' : 's'}`}
          actions={
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as Referral['status'] | 'all')}
              options={[{ value: 'all', label: 'All statuses' }, ...REFERRAL_STATUSES.map((entry) => ({ value: entry, label: humanise(entry) }))]}
              placeholder="Filter by status"
              selectSize="sm"
              aria-label="Filter referrals by status"
            />
          }
        />

        {referrals.loading ? (
          <ListSkeleton rows={6} columns={5} />
        ) : referrals.items.length === 0 ? (
          <RecordEmptyState title="No referrals match the current filters" body="Clear the search or status filter to see all referrals." primaryAction={{ label: 'Clear filters', onClick: () => { setSearch(''); setStatus('all'); } }} />
        ) : (
          <DataTable columns={columns} data={referrals.items} density="compact" emptyState={<RecordEmptyState title="No referrals" body="No referrals are recorded yet." />} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- commissions */

export function CommissionStatementsScreen() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<PartnerCommission['status'] | 'all'>('all');

  const query = React.useMemo(
    () => ({
      q: search.trim() || undefined,
      pageSize: 200,
      filter:
        status === 'all'
          ? undefined
          : { id: 'commission-status', conjunction: 'and' as const, clauses: [{ field: 'status', operator: 'eq' as const, value: status }] },
      sort: [{ field: 'periodEnd', direction: 'desc' as const }],
    }),
    [search, status],
  );

  const commissions = useList(() => services.partners.commissions(query), [query]);

  const totals = React.useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const commission of commissions.items) {
      byCurrency.set(commission.currency, (byCurrency.get(commission.currency) ?? 0) + commission.amount.amount);
    }
    return [...byCurrency.entries()];
  }, [commissions.items]);

  const columns = React.useMemo<ColumnDef<PartnerCommission, unknown>[]>(
    () => [
      {
        id: 'partner',
        header: 'Partner',
        accessorKey: 'partnerName',
        cell: ({ row }) => (
          <Link to={`/app/partners/${row.original.partnerId}`} className="text-xs font-medium text-fg hover:text-link hover:underline">
            {row.original.partnerName}
          </Link>
        ),
      },
      {
        id: 'period',
        header: 'Period',
        accessorKey: 'periodEnd',
        cell: ({ row }) => <span className="text-xs text-muted">{formatDate(row.original.periodStart)} – {formatDate(row.original.periodEnd)}</span>,
      },
      {
        id: 'basis',
        header: 'Basis',
        accessorKey: 'basisAmount',
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="text-xs tabular-nums text-fg">{formatMoney(row.original.basisAmount.amount, row.original.basisAmount.currency, true)}</span>
            <span className="text-[0.6875rem] text-faint">{humanise(row.original.basis)}</span>
          </span>
        ),
      },
      {
        id: 'rate',
        header: 'Rate',
        accessorKey: 'ratePercent',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{row.original.ratePercent}%</span>,
      },
      {
        id: 'amount',
        header: 'Commission',
        accessorKey: 'amount',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.amount.amount, row.original.amount.currency, true)}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <TonePill tone={COMMISSION_STATUS_TONE[row.original.status]} dot={false}>{COMMISSION_STATUS_LABEL[row.original.status]}</TonePill>,
      },
      {
        id: 'calculation',
        header: 'Calculation',
        cell: () => <Badge variant="neutral" size="sm">Demo</Badge>,
      },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Commission statements"
        description="A demonstration commission ledger per partner. Each line records how it was calculated so the figure is never shown alone."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Partners', to: '/app/partners' }, { label: 'Commissions' }]}
        backTo={{ to: '/app/partners', label: 'Partners' }}
      />

      <div className="space-y-5 p-4 sm:p-6">
        <Alert tone="info" title="These are demonstration calculations">
          Every commission is computed locally from synthetic partner revenue and labelled{' '}
          <span className="font-mono text-2xs">demo_local_calculation</span>. No finance system produced these numbers and no payment is implied.
        </Alert>

        {totals.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {totals.map(([currency, amount]) => (
              <MiniStat key={currency} label={`Total (${currency})`} value={formatMoney(amount, currency, true)} tone="amber" />
            ))}
            <MiniStat label="Statements" value={formatNumber(commissions.items.length)} tone="violet" />
          </div>
        ) : null}

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search commissions by partner"
          chips={status === 'all' ? [] : [{ id: 'status', label: `Status: ${COMMISSION_STATUS_LABEL[status]}`, tone: 'brand', onRemove: () => setStatus('all') }]}
          onClearFilters={() => setStatus('all')}
          resultCount={`${formatNumber(commissions.items.length)} statement${commissions.items.length === 1 ? '' : 's'}`}
          actions={
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as PartnerCommission['status'] | 'all')}
              options={[
                { value: 'all', label: 'All statuses' },
                ...(Object.keys(COMMISSION_STATUS_LABEL) as PartnerCommission['status'][]).map((entry) => ({ value: entry, label: COMMISSION_STATUS_LABEL[entry] })),
              ]}
              placeholder="Filter by status"
              selectSize="sm"
              aria-label="Filter commissions by status"
            />
          }
        />

        {commissions.loading ? (
          <ListSkeleton rows={6} columns={6} />
        ) : commissions.items.length === 0 ? (
          <RecordEmptyState title="No commission statements match the current filters" body="Clear the search or status filter." primaryAction={{ label: 'Clear filters', onClick: () => { setSearch(''); setStatus('all'); } }} />
        ) : (
          <DataTable columns={columns} data={commissions.items} density="compact" emptyState={<RecordEmptyState title="No statements" body="No commission statements are recorded yet." />} />
        )}

        <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-inset p-3">
          <Percent className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
          <p className="text-[0.6875rem] leading-relaxed text-faint">
            A commission statement's status mirrors a real approval workflow for realism: accrued → pending approval → approved → invoiced → paid, with disputed and clawed-back as exceptions. The transitions are not enforced here.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Re-exported icons referenced only for the shared illustrations. */
export { Building2, ShieldAlert, TriangleAlert, RecordHeader, notify };
