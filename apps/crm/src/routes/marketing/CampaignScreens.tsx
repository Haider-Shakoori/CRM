import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Megaphone, Pause, Play, Copy, CalendarClock } from 'lucide-react';
import type { Campaign, CampaignMetrics } from '@crm/shared-types';
import {
  Badge,
  Button,
  Card,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  InlineBar,
  Input,
  MiniStat,
  Pagination,
  Progress,
  Select,
  StatusBadge,
  Textarea,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Campaign screens.
 *
 * A campaign is a plan, an audience and a set of derived numbers. Three choices are visible:
 *
 *   - **Sending is simulated.** Nothing leaves the browser. `launch`, `pause` and `resume`
 *     change local state and say so; the toast is a simulation notice, not a delivery
 *     confirmation.
 *   - **Metrics are shown as synthetic.** Every figure comes from the shared dataset with no
 *     provider behind it, and the panel states that plainly rather than implying a live feed.
 *   - **Attribution is a model, not a fact.** The campaign names the model it uses so the
 *     revenue attributed to it can be read with the right caveat.
 */

const STATUSES = ['all', 'draft', 'scheduled', 'active', 'paused', 'completed', 'archived', 'cancelled'] as const;

/* ---------------------------------------------------------------------- list */

export default function CampaignsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<string>('all');

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 25,
      q: search || undefined,
      sort: [{ field: 'name', direction: 'asc' as const }],
      filter:
        status === 'all'
          ? undefined
          : {
              id: 'campaign-status',
              conjunction: 'and' as const,
              clauses: [{ field: 'status', operator: 'eq' as const, value: status }] as never,
            },
    }),
    [page, search, status],
  );

  const campaigns = useList(() => services.campaigns.list(query), [JSON.stringify(query)]);

  const pageTotals = React.useMemo(() => {
    const items = campaigns.items;
    const revenue = items.reduce((sum, item) => sum + (item.metrics.revenue.amount || 0), 0);
    const spend = items.reduce((sum, item) => sum + (item.metrics.cost.amount || 0), 0);
    const leads = items.reduce((sum, item) => sum + item.metrics.leadsCreated, 0);
    return { revenue, spend, leads, roi: spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : 0 };
  }, [campaigns.items]);

  const columns = React.useMemo<ColumnDef<Campaign, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Campaign',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/campaigns/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.name}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] capitalize text-faint">
              {row.original.type.replace(/_/g, ' ')} · {row.original.ownerName}
            </span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'audience',
        header: 'Audience',
        accessorFn: (campaign) => campaign.audienceSize,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-[0.6875rem] tabular-nums text-muted">{formatNumber(row.original.audienceSize)}</span>,
      },
      {
        id: 'leads',
        header: 'Leads',
        accessorFn: (campaign) => campaign.metrics.leadsCreated,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-[0.6875rem] tabular-nums text-muted">{formatNumber(row.original.metrics.leadsCreated)}</span>,
      },
      {
        id: 'revenue',
        header: 'Attributed',
        accessorFn: (campaign) => campaign.metrics.revenue.amount,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.metrics.revenue.amount, row.original.currency)}</span>
        ),
      },
      {
        id: 'roi',
        header: 'ROI',
        accessorFn: (campaign) => campaign.metrics.roi,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className={cn('text-[0.6875rem] font-medium tabular-nums', row.original.metrics.roi >= 0 ? 'success-fg' : 'danger-fg')}>
            {row.original.metrics.roi}%
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Campaigns"
        description="Plan an audience, compose a message and read back synthetic performance. Nothing here is sent to a real recipient."
        breadcrumbs={[{ to: '/app/home', label: 'Home' }, { label: 'Campaigns' }]}
        actions={
          <Button variant="primary" size="sm" asChild>
            <Link to="/app/campaigns/new">New campaign</Link>
          </Button>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onClearFilters={() => {
              setStatus('all');
              setSearch('');
            }}
            chips={status === 'all' ? [] : [{ id: 'status', label: `Status: ${status}`, onRemove: () => setStatus('all') }]}
            actions={
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={STATUSES.map((value) => ({ value, label: value === 'all' ? 'All statuses' : value.replace(/_/g, ' ') }))}
                selectSize="sm"
                className="w-[12rem]"
                aria-label="Filter by status"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Campaigns" value={formatNumber(campaigns.meta?.total ?? campaigns.items.length)} />
          <MiniStat label="Leads (page)" value={formatNumber(pageTotals.leads)} tone="violet" />
          <MiniStat label="Attributed (page)" value={formatMoney(pageTotals.revenue, 'USD')} tone="teal" />
          <MiniStat label="ROI (page)" value={`${pageTotals.roi}%`} tone={pageTotals.roi >= 0 ? 'green' : 'red'} />
        </div>

        <DemoNotice tone="info">
          Campaign metrics are generated from the demonstration dataset. They are not read from an email
          provider, and no message is delivered, opened or clicked anywhere. Totals labelled “page” cover only
          the rows currently loaded.
        </DemoNotice>

        {campaigns.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={campaigns.items}
            onRowClick={(campaign) => navigate(`/app/campaigns/${campaign.id}`)}
            footer={
              campaigns.meta ? (
                <Pagination page={campaigns.meta.page} pageSize={campaigns.meta.pageSize} total={campaigns.meta.total} onPageChange={setPage} />
              ) : null
            }
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function CampaignDetail() {
  const services = useServices();
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [duplicateOpen, setDuplicateOpen] = React.useState(false);

  const campaign = useAsync(() => services.campaigns.get(campaignId ?? ''), [campaignId], { skip: !campaignId });
  const record = campaign.data;

  const launch = useMutation(() => services.campaigns.launch(campaignId ?? ''), {
    successMessage: 'Campaign marked active (simulated).',
    simulated: true,
    onSuccess: () => campaign.reload(),
  });
  const pause = useMutation(() => services.campaigns.pause(campaignId ?? ''), {
    successMessage: 'Campaign paused (simulated).',
    simulated: true,
    onSuccess: () => campaign.reload(),
  });
  const resume = useMutation(() => services.campaigns.resume(campaignId ?? ''), {
    successMessage: 'Campaign resumed (simulated).',
    simulated: true,
    onSuccess: () => campaign.reload(),
  });
  const duplicate = useMutation((name: string) => services.campaigns.duplicate(campaignId ?? '', name), {
    successMessage: 'A copy was created (simulated).',
    simulated: true,
    onSuccess: (created) => {
      setDuplicateOpen(false);
      if (created) navigate(`/app/campaigns/${created.id}`);
    },
  });

  if (campaign.loading) return <ListSkeleton rows={12} columns={3} />;
  if (campaign.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This campaign could not be found</h2>
            <p className="text-xs text-muted">{campaign.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/campaigns">Back to campaigns</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const metrics: CampaignMetrics = record.metrics;

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/campaigns', label: 'Campaigns' }}
          title={record.name}
          subtitle={`${record.type.replace(/_/g, ' ')} · ${record.objective.replace(/_/g, ' ')}`}
          badges={
            <>
              <StatusBadge status={record.status} />
              <Badge variant="outline" size="sm">
                {record.attributionModel.replace(/_/g, ' ')} attribution
              </Badge>
            </>
          }
          facts={[
            { label: 'Owner', value: record.ownerName },
            { label: 'Audience', value: formatNumber(record.audienceSize) },
            { label: 'Starts', value: formatDate(record.startDate) },
            { label: 'Ends', value: formatDate(record.endDate) },
            { label: 'Currency', value: record.currency },
          ]}
          actions={
            <>
              {record.status === 'draft' || record.status === 'scheduled' ? (
                <Button variant="primary" size="sm" loading={launch.pending} onClick={() => void launch.run(undefined)} leadingIcon={<Play className="size-3.5" />}>
                  Launch
                </Button>
              ) : null}
              {record.status === 'active' ? (
                <Button variant="secondary" size="sm" loading={pause.pending} onClick={() => void pause.run(undefined)} leadingIcon={<Pause className="size-3.5" />}>
                  Pause
                </Button>
              ) : null}
              {record.status === 'paused' ? (
                <Button variant="secondary" size="sm" loading={resume.pending} onClick={() => void resume.run(undefined)} leadingIcon={<Play className="size-3.5" />}>
                  Resume
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setDuplicateOpen(true)} leadingIcon={<Copy className="size-3.5" />}>
                Duplicate
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <DemoNotice tone="warning">
          Launch, pause and resume only change the status stored in this browser. No audience is contacted, and no
          email, SMS or ad is delivered by this build.
        </DemoNotice>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Recipients" value={formatNumber(metrics.recipients)} />
          <MiniStat label="Open rate" value={`${metrics.openRate}%`} tone="violet" />
          <MiniStat label="Click rate" value={`${metrics.clickRate}%`} tone="blue" />
          <MiniStat label="ROI" value={`${metrics.roi}%`} tone={metrics.roi >= 0 ? 'green' : 'red'} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Performance</h2>
              <Badge variant="outline" size="sm">Synthetic</Badge>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {[
                { label: 'Delivered', value: formatNumber(metrics.delivered) },
                { label: 'Bounces', value: formatNumber(metrics.bounces) },
                { label: 'Unsubscribes', value: formatNumber(metrics.unsubscribes) },
                { label: 'Spam complaints', value: formatNumber(metrics.spamComplaints) },
                { label: 'Unique opens', value: formatNumber(metrics.uniqueOpens) },
                { label: 'Unique clicks', value: formatNumber(metrics.uniqueClicks) },
                { label: 'Click-to-open', value: `${metrics.clickToOpenRate}%` },
                { label: 'Conversion', value: `${metrics.conversionRate}%` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border-subtle py-1 last:border-b-0">
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="text-xs font-medium tabular-nums text-fg">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[0.625rem] leading-relaxed text-faint">
              Rates are computed from synthetic counts. “Open rate” is unique opens over delivered.
            </p>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Attribution</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Model</dt>
                  <dd className="font-medium capitalize text-fg">{record.attributionModel.replace(/_/g, ' ')}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Attributed revenue</dt>
                  <dd className="font-medium tabular-nums text-fg">{formatMoney(metrics.revenue.amount, record.currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Cost</dt>
                  <dd className="font-medium tabular-nums text-fg">{formatMoney(metrics.cost.amount, record.currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Cost per lead</dt>
                  <dd className="font-medium tabular-nums text-fg">{formatMoney(metrics.costPerLead.amount, record.currency)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[0.625rem] leading-relaxed text-faint">
                Attribution assigns revenue to touchpoints by rule. Different models give different answers for the
                same journey.
              </p>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Goals</h2>
              {record.goals.length === 0 ? (
                <p className="mt-3 text-xs text-muted">No goals are set for this campaign.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {record.goals.map((goal) => (
                    <li key={goal.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted capitalize">{goal.metric}</span>
                        <span className="tabular-nums text-fg">
                          {formatNumber(goal.achieved)} / {formatNumber(goal.target)}
                        </span>
                      </div>
                      <Progress value={goal.achieved} max={Math.max(goal.target, 1)} tone="violet" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Funnel</h2>
          <ul className="mt-3 space-y-2">
            {[
              { label: 'Recipients', value: metrics.recipients },
              { label: 'Delivered', value: metrics.delivered },
              { label: 'Opened', value: metrics.uniqueOpens },
              { label: 'Clicked', value: metrics.uniqueClicks },
              { label: 'Leads created', value: metrics.leadsCreated },
              { label: 'Opportunities', value: metrics.opportunities },
              { label: 'Deals won', value: metrics.dealsWon },
            ].map((stage) => (
              <li key={stage.label} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3">
                <span className="text-xs text-muted">{stage.label}</span>
                <InlineBar value={stage.value} max={Math.max(metrics.recipients, 1)} tone="auto" />
                <span className="text-end text-[0.6875rem] tabular-nums text-muted">{formatNumber(stage.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent
          title="Duplicate this campaign"
          description="Creates a draft copy with the same audience and content. It is not scheduled or sent."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDuplicateOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="duplicate-campaign-form" loading={duplicate.pending}>
                Create copy
              </Button>
            </>
          }
        >
          <form
            id="duplicate-campaign-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
              if (!name) {
                notify.warning('Give the copy a name.');
                return;
              }
              void duplicate.run(name);
            }}
          >
            <Field label="Copy name" htmlFor="duplicate-name" required>
              <Input id="duplicate-name" name="name" defaultValue={`${record.name} (copy)`} />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------------------- form */

export function CampaignForm() {
  const services = useServices();
  const navigate = useNavigate();
  const [type, setType] = React.useState('email');
  const [objective, setObjective] = React.useState('lead_generation');

  const create = useMutation((input: Partial<Campaign>) => services.campaigns.create(input as never), {
    successMessage: 'Draft campaign created.',
    onSuccess: (created) => {
      if (created) navigate(`/app/campaigns/${created.id}`);
    },
  });

  return (
    <div className="pb-10">
      <RecordHeader
        backTo={{ to: '/app/campaigns', label: 'Campaigns' }}
        title="New campaign"
        subtitle="Create a draft. You can add a segment and a message after it exists."
      />

      <div className="p-4 sm:p-6">
        <form
          className="max-w-2xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = String(data.get('name') ?? '').trim();
            if (!name) {
              notify.warning('Give the campaign a name.');
              return;
            }
            void create.run({
              name,
              type: type as Campaign['type'],
              status: 'draft',
              objective: objective as Campaign['objective'],
              description: String(data.get('description') ?? '').trim() || undefined,
              currency: 'USD',
            });
          }}
        >
          <Field label="Name" htmlFor="campaign-name" required>
            <Input id="campaign-name" name="name" placeholder="Q4 pipeline acceleration" />
          </Field>

          <Field label="Type" htmlFor="campaign-type" required>
            <Select
              id="campaign-type"
              value={type}
              onValueChange={setType}
              options={['email', 'newsletter', 'drip', 'event', 'webinar', 'paid_advertising', 'social', 'content', 'direct_mail', 'referral', 'product_launch', 'upsell'].map((value) => ({
                value,
                label: value.replace(/_/g, ' '),
              }))}
            />
          </Field>

          <Field label="Objective" htmlFor="campaign-objective" required>
            <Select
              id="campaign-objective"
              value={objective}
              onValueChange={setObjective}
              options={['lead_generation', 'nurturing', 'awareness', 'retention', 'upsell', 're_engagement', 'event_promotion'].map((value) => ({
                value,
                label: value.replace(/_/g, ' '),
              }))}
            />
          </Field>

          <Field label="Description" htmlFor="campaign-description" hint="Optional">
            <Textarea id="campaign-description" name="description" rows={3} placeholder="What this campaign is for." />
          </Field>

          <div className="flex items-center gap-2">
            <Button variant="primary" type="submit" loading={create.pending} leadingIcon={<Megaphone className="size-3.5" />}>
              Create draft
            </Button>
            <Button variant="ghost" type="button" asChild>
              <Link to="/app/campaigns">Cancel</Link>
            </Button>
          </div>

          <DemoNotice tone="neutral">
            Sending is not implemented in this build. A campaign can be planned and its status changed, but no message
            reaches a recipient.
          </DemoNotice>
        </form>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- calendar slot */

export function CampaignCalendar() {
  const services = useServices();
  const [range] = React.useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  });

  const entries = useList(() => services.campaigns.calendar(range.from, range.to), [range.from, range.to]);

  return (
    <div className="pb-10">
      <PageHeader
        title="Campaign calendar"
        description={`Campaigns scheduled between ${formatDate(range.from)} and ${formatDate(range.to)}.`}
        breadcrumbs={[{ to: '/app/campaigns', label: 'Campaigns' }, { label: 'Calendar' }]}
      />
      <div className="space-y-3 p-4 sm:p-6">
        {entries.loading ? (
          <ListSkeleton rows={8} columns={4} />
        ) : entries.items.length === 0 ? (
          <Card className="p-10 text-center text-xs text-muted">
            <CalendarClock className="mx-auto size-5 text-faint" aria-hidden />
            <p className="mt-2">No campaigns are scheduled in this window.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {entries.items.map((entry) => (
              <li key={entry.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <Link to={entry.href} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                      {entry.campaignName}
                    </Link>
                    <span className="mt-0.5 block text-[0.6875rem] text-faint">
                      {formatDate(entry.startDate)} → {entry.endDate ? formatDate(entry.endDate) : 'open'} · {entry.channel} · {entry.ownerName}
                    </span>
                  </div>
                  <StatusBadge status={entry.status} size="sm" />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
