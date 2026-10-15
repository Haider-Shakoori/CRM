'use client';

import * as React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { CreditCard, FileText, Gauge, Info, PackagePlus } from 'lucide-react';
import type { PlatformAddOn, PlatformInvoice, PlatformPlan } from '@crm/shared-types';
import type { ColumnDef } from '@tanstack/react-table';
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
  Dialog,
  DialogContent,
  Field,
  Input,
  MiniStat,
  Progress,
  Select,
  StatusBadge,
  TableWrap,
  Td,
  Textarea,
  Th,
  TonePill,
  Tr,
  cn,
  focusRing,
} from '@crm/ui';
import { ListSkeleton, PageHeader, RecordErrorState, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';
import { useActiveOrganization } from './SettingsScreens';

/**
 * The tenant’s own subscription.
 *
 * Billing is where a demonstration can most easily mislead, so this file holds one rule: **no
 * figure shown here is a charge.** Every amount is a record on a subscription that carries
 * `billingState: 'not_connected'`; no card is stored, no payment provider is contacted and no
 * invoice is payable. A plan change or seat change really does update the subscription record in
 * this browser, and the toast says the change was simulated rather than paid for.
 */

const BILLING_SECTIONS = [
  { key: 'subscription', label: 'Subscription', to: '/app/settings/billing' },
  { key: 'plans', label: 'Plans', to: '/app/settings/billing/plans' },
  { key: 'usage', label: 'Usage', to: '/app/settings/billing/usage' },
  { key: 'invoices', label: 'Invoices', to: '/app/settings/billing/invoices' },
  { key: 'payment-method', label: 'Payment method', to: '/app/settings/billing/payment-method' },
];

const INTERVALS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Annual' },
];

function BillingNav() {
  return (
    <nav aria-label="Billing sections" className="flex flex-wrap gap-x-4 gap-y-1">
      {BILLING_SECTIONS.map((entry) => (
        <NavLink
          key={entry.key}
          to={entry.to}
          end
          className={({ isActive }) =>
            cn(
              '-mb-px whitespace-nowrap border-b-2 px-0.5 pb-2 text-xs font-medium',
              isActive ? 'border-brand text-fg' : 'border-transparent text-muted hover:text-fg',
              focusRing,
            )
          }
        >
          {entry.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function BillingScreen() {
  const services = useServices();
  const { section } = useParams<{ section?: string }>();
  const active = useActiveOrganization();
  const activeKey = BILLING_SECTIONS.some((entry) => entry.key === section) ? section! : 'subscription';

  const subscription = useAsync(() => services.billing.subscription(), []);
  const plans = useList(() => services.billing.plans(), []);
  const addOns = useList(() => services.billing.addOns(), []);
  const usage = useAsync(() => services.billing.usage(), []);
  const entitlements = useAsync(() => services.billing.entitlements(), []);
  const paymentMethods = useAsync(() => services.billing.paymentMethods(), []);
  const tenants = useList(() => services.tenant.tenants(), []);

  const [invoicePage, setInvoicePage] = React.useState(1);
  const invoices = useList(() => services.billing.invoices({ pageSize: 25, page: invoicePage }), [invoicePage]);

  const [changeOpen, setChangeOpen] = React.useState(false);
  const [changePlanId, setChangePlanId] = React.useState('');
  const [changeSeats, setChangeSeats] = React.useState('');
  const [changeInterval, setChangeInterval] = React.useState<'month' | 'year'>('month');
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelEffective, setCancelEffective] = React.useState<'immediately' | 'end_of_period'>('end_of_period');
  const [invoiceDetail, setInvoiceDetail] = React.useState<PlatformInvoice | null>(null);
  const [seatDraft, setSeatDraft] = React.useState('');
  const [addOnDraft, setAddOnDraft] = React.useState<Record<string, string>>({});

  const record = subscription.data;

  // The drafts are seeded during render when the subscription record changes identity —
  // including after a save reloads it — instead of being synced from an effect.
  const [seededFrom, setSeededFrom] = React.useState(record);
  if (record !== seededFrom) {
    setSeededFrom(record);
    setSeatDraft(record ? String(record.seats) : '');
    const next: Record<string, string> = {};
    for (const entry of record?.addOns ?? []) next[entry.addOnId] = String(entry.quantity);
    setAddOnDraft(next);
  }

  const reloadSubscription = () => {
    subscription.reload();
    entitlements.reload();
  };

  const updateSeats = useMutation((seats: number) => services.billing.updateSeats(seats), {
    simulated: true,
    successMessage: 'Seat count updated',
    onSuccess: reloadSubscription,
  });

  const setAddOn = useMutation((input: { addOnId: string; quantity: number }) => services.billing.setAddOn(input.addOnId, input.quantity), {
    simulated: true,
    successMessage: 'Add-on updated',
    onSuccess: reloadSubscription,
  });

  const [previewRequest, setPreviewRequest] = React.useState<
    { planId: string; seats: number; interval: 'month' | 'year' } | undefined
  >(undefined);
  const previewChange = useAsync(
    () =>
      services.billing.previewPlanChange(
        previewRequest?.planId ?? '',
        previewRequest?.seats ?? 0,
        previewRequest?.interval ?? 'month',
      ),
    [previewRequest],
    { skip: previewRequest === undefined },
  );

  const changePlan = useMutation(
    (input: { planId: string; seats: number; interval: 'month' | 'year' }) => services.billing.changePlan(input.planId, input.seats, input.interval),
    {
      simulated: true,
      successMessage: 'Plan change recorded',
      onSuccess: () => {
        setChangeOpen(false);
        setPreviewRequest(undefined);
        reloadSubscription();
      },
    },
  );

  const cancelSubscription = useMutation(
    (input: { reason: string; effective: 'immediately' | 'end_of_period' }) => services.billing.cancel(input.reason, input.effective),
    {
      simulated: true,
      successMessage: 'Cancellation recorded',
      onSuccess: () => {
        setCancelOpen(false);
        setCancelReason('');
        reloadSubscription();
      },
    },
  );

  const reactivate = useMutation(() => services.billing.reactivate(), {
    simulated: true,
    successMessage: 'Subscription reactivated',
    onSuccess: reloadSubscription,
  });

  const invoiceColumns: ColumnDef<PlatformInvoice, unknown>[] = [
    {
      id: 'reference',
      header: 'Invoice',
      accessorKey: 'reference',
      cell: ({ row }) => (
        <span className="block font-mono text-xs font-medium text-fg">{row.original.reference}</span>
      ),
    },
    {
      id: 'issuedAt',
      header: 'Issued',
      accessorKey: 'issuedAt',
      cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.issuedAt)}</span>,
    },
    {
      id: 'dueAt',
      header: 'Due',
      accessorKey: 'dueAt',
      cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.dueAt)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
    },
    {
      id: 'total',
      header: 'Total',
      accessorFn: (invoice) => invoice.total.amount,
      meta: { align: 'end' },
      cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.total.amount, row.original.currency)}</span>,
    },
    {
      id: 'due',
      header: 'Outstanding',
      accessorFn: (invoice) => invoice.amountDue.amount,
      meta: { align: 'end' },
      cell: ({ row }) => (
        <span className={cn('text-xs tabular-nums', row.original.amountDue.amount > 0 ? 'text-warning-fg' : 'text-muted')}>
          {formatMoney(row.original.amountDue.amount, row.original.currency)}
        </span>
      ),
    },
  ];

  if (subscription.loading) return <ListSkeleton rows={10} columns={4} />;
  if (subscription.error || !record) {
    return (
      <div className="pb-8">
        <PageHeader title="Billing" tabs={<BillingNav />} />
        <div className="p-4 sm:p-6">
          <RecordErrorState message={subscription.error ?? 'No subscription is held for this organization.'} onRetry={subscription.reload} />
        </div>
      </div>
    );
  }

  const activeTenant = tenants.items.find((tenant) => tenant.id === active.active?.tenantId);
  const compatibleAddOns = addOns.items.filter((addOn) => addOn.compatiblePlanIds.includes(record.planId));
  const seatDirty = String(record.seats) !== seatDraft;
  const seatPercent = record.seats > 0 ? Math.round((record.seatsUsed / record.seats) * 100) : 0;
  const preview = previewChange.data;

  return (
    <div className="pb-10">
      <PageHeader
        title="Billing"
        description="The subscription this tenant holds, its seats and add-ons, usage against its meters, and the invoice record."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Settings' }, { label: 'Billing' }]}
        tabs={<BillingNav />}
        actions={
          record.status === 'canceled' || record.status === 'paused' ? (
            <Button variant="primary" size="sm" loading={reactivate.pending} onClick={() => void reactivate.run(undefined)}>
              Reactivate subscription
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setChangeSeats(String(record.seats));
                setChangeInterval(record.billingInterval);
                setPreviewRequest(undefined);
                setChangeOpen(true);
              }}
              leadingIcon={<PackagePlus className="size-3.5" />}
            >
              Change plan
            </Button>
          )
        }
      />

      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <Alert tone="warning" title="No payment provider is connected">
          This is a record-keeping view. No card is stored, no charge is made, no invoice is payable and no dunning process runs. The
          subscription record itself carries <span className="font-mono text-[0.6875rem]">billingState: not_connected</span>.
        </Alert>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Plan" value={record.planName} tone="violet" />
          <MiniStat label="Seats" value={`${formatNumber(record.seatsUsed)} / ${formatNumber(record.seats)}`} tone={seatPercent >= 90 ? 'amber' : 'teal'} />
          <MiniStat label="Monthly total" value={formatMoney(record.mrr.amount, record.currency)} tone="blue" />
          <MiniStat label="Renews" value={formatDate(record.currentPeriodEnd)} tone="green" />
        </div>

        {activeKey === 'subscription' ? (
          <>
            <Card>
              <CardHeader className="flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>{record.planName}</CardTitle>
                  <p className="mt-1 text-xs text-muted">
                    {record.billingInterval === 'year' ? 'Annual' : 'Monthly'} · {record.tenantName} · started {formatDate(record.startedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={record.status} />
                  <TonePill tone={record.status === 'canceled' ? 'red' : 'green'}>{record.billingState.replace(/_/g, ' ')}</TonePill>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
                  {[
                    { label: 'Current period', value: `${formatDate(record.currentPeriodStart)} → ${formatDate(record.currentPeriodEnd)}` },
                    { label: 'Unit price', value: `${formatMoney(record.unitPrice.amount, record.currency)} per seat` },
                    { label: 'Platform fee', value: formatMoney(record.baseFee.amount, record.currency) },
                    { label: 'Annualised', value: formatMoney(record.arr.amount, record.currency) },
                    { label: 'Renewal', value: record.renewal.mode === 'auto' ? 'Automatic' : 'Manual' },
                    { label: 'Owner team', value: record.ownerTeam.replace(/_/g, ' ') },
                  ].map((fact) => (
                    <div key={fact.label} className="min-w-0">
                      <dt className="text-2xs font-medium uppercase tracking-wide text-faint">{fact.label}</dt>
                      <dd className="mt-0.5 truncate font-medium text-fg">{fact.value}</dd>
                    </div>
                  ))}
                </dl>

                {record.cancelReason ? (
                  <Alert tone="danger" title="This subscription is cancelled">
                    {record.cancelReason} · effective {formatDate(record.cancellationEffectiveAt)}
                  </Alert>
                ) : null}

                <div className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4">
                  <Field label="Seats" htmlFor="seat-count" hint={`${formatNumber(record.seatsUsed)} in use`} className="w-[10rem]">
                    <Input id="seat-count" inputMode="numeric" value={seatDraft} onChange={(event) => setSeatDraft(event.target.value)} />
                  </Field>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!seatDirty}
                    loading={updateSeats.pending}
                    onClick={() => void updateSeats.run(Number(seatDraft))}
                  >
                    Update seats
                  </Button>
                  <p className="max-w-md text-[0.6875rem] leading-relaxed text-faint">
                    The seat count is stored on the subscription record. No invoice is raised and no proration is applied — the change
                    is a local demonstration, which the confirmation says.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-fg">Seat utilisation</p>
                    <p className="mt-0.5 text-[0.6875rem] text-muted">
                      {formatNumber(record.seatsUsed)} of {formatNumber(record.seats)} seats are held by active users.
                    </p>
                  </div>
                  <div className="w-full max-w-xs">
                    <Progress value={Math.min(100, seatPercent)} tone={seatPercent >= 90 ? 'amber' : 'teal'} size="sm" />
                  </div>
                </div>

                <div className="flex justify-end">
                  {record.status === 'canceled' ? null : (
                    <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
                      Cancel subscription
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Add-ons</CardTitle>
                <span className="text-2xs text-faint">{compatibleAddOns.length} compatible with this plan</span>
              </CardHeader>
              <CardContent className="space-y-3">
                {addOns.loading ? (
                  <ListSkeleton rows={3} columns={3} />
                ) : compatibleAddOns.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted">No add-on is compatible with the {record.planName} plan.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {compatibleAddOns.map((addOn: PlatformAddOn) => {
                      const active = record.addOns.find((entry) => entry.addOnId === addOn.id);
                      const draft = addOnDraft[addOn.id] ?? '0';
                      return (
                        <li key={addOn.id} className="flex flex-wrap items-end gap-x-4 gap-y-2 py-3">
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-medium text-fg">{addOn.name}</span>
                            <span className="mt-0.5 block text-[0.6875rem] text-muted">{addOn.description}</span>
                            <span className="mt-0.5 block text-[0.625rem] text-faint">
                              {formatMoney(addOn.price.amount, addOn.currency)} · {addOn.pricingModel.replace(/_/g, ' ')}
                              {addOn.unitLabel ? ` · per ${addOn.unitLabel}` : ''}
                              {active ? ' · active' : ''}
                            </span>
                          </div>
                          <Field label={`Quantity for ${addOn.name}`} htmlFor={`addon-${addOn.id}`} className="w-[7rem]">
                            <Input
                              id={`addon-${addOn.id}`}
                              inputMode="numeric"
                              value={draft}
                              onChange={(event) => setAddOnDraft((current) => ({ ...current, [addOn.id]: event.target.value }))}
                            />
                          </Field>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={draft === String(active?.quantity ?? 0)}
                            loading={setAddOn.pending}
                            onClick={() => void setAddOn.run({ addOnId: addOn.id, quantity: Number(draft) })}
                          >
                            Apply
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <DemoNotice tone="neutral">
                  Add-on prices are illustrative and the totals on this page are computed from the record, not from a price list held
                  by a billing system.
                </DemoNotice>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Entitlements</CardTitle>
                <span className="text-2xs text-faint">{entitlements.data?.length ?? 0} modules</span>
              </CardHeader>
              <CardContent>
                {entitlements.loading ? (
                  <ListSkeleton rows={4} columns={3} />
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {(entitlements.data ?? []).map((entitlement) => (
                      <li key={entitlement.moduleKey} className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-2.5 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-fg">{entitlement.label}</span>
                        <Badge variant={entitlement.source === 'plan' ? 'outline' : 'brand'} size="sm">
                          {entitlement.source}
                        </Badge>
                        {entitlement.trialEndsAt ? <Badge variant="warning" size="sm">Trial</Badge> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
                  Entitlements drive navigation and upgrade prompts only. Nothing in this frontend enforces a module limit.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}

        {activeKey === 'plans' ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Plans</CardTitle>
              <span className="text-2xs text-faint">provisional pricing — not a quote</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {plans.loading ? (
                <ListSkeleton rows={4} columns={3} />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {plans.items.map((plan: PlatformPlan) => {
                    const option = plan.billingOptions.find((candidate) => candidate.interval === record.billingInterval);
                    const perSeat = option?.perUserPrice?.amount ?? 0;
                    const base = option?.basePlatformFee.amount ?? 0;
                    const monthly = base + perSeat * record.seats;
                    const isCurrent = plan.id === record.planId;
                    return (
                      <li key={plan.id} className={cn('rounded-lg border p-3', isCurrent ? 'border-brand/40 bg-brand-subtle/40' : 'border-border-subtle bg-surface')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-fg">{plan.name}</span>
                          {isCurrent ? <Badge variant="brand" size="sm">Current plan</Badge> : null}
                          <Badge variant="outline" size="sm">
                            {plan.visibility}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">{plan.description}</p>
                        <p className="mt-2 text-md font-semibold tabular-nums tracking-tight text-fg">
                          {formatMoney(monthly, option?.currency ?? record.currency)}
                          <span className="ms-1 text-2xs font-normal text-faint">/ month at {record.seats} seats</span>
                        </p>
                        <p className="mt-0.5 text-[0.625rem] text-faint">
                          {plan.moduleKeys.includes('*') ? 'All modules' : `${plan.moduleKeys.length} modules`} ·{' '}
                          {plan.billingOptions.map((entry) => entry.interval).join(' / ')} billing · commercial
                          state {plan.commercialState.replace(/_/g, ' ')}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Button
                            variant={isCurrent ? 'ghost' : 'secondary'}
                            size="xs"
                            onClick={() => {
                              setChangePlanId(plan.id);
                              setChangeSeats(String(record.seats));
                              setChangeInterval(record.billingInterval);
                              setPreviewRequest(undefined);
                              setChangeOpen(true);
                            }}
                          >
                            {isCurrent ? 'Preview a seat change' : 'Preview a switch'}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <DemoNotice tone="neutral">
                Plan prices are provisional commercial categories for the demonstration. There is no pricing service, no tax calculation
                and no checkout behind “change plan”.
              </DemoNotice>
            </CardContent>
          </Card>
        ) : null}

        {activeKey === 'usage' ? (
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Gauge className="size-4 text-subtle" aria-hidden />
              <CardTitle>Usage meters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {usage.loading ? (
                <ListSkeleton rows={5} columns={2} />
              ) : (usage.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">No usage meters are held for this organization.</p>
              ) : (
                (usage.data ?? []).map((meter) => {
                  const percent = meter.included > 0 ? Math.min(100, Math.round((meter.used / meter.included) * 100)) : 0;
                  const overage = meter.overage ?? 0;
                  return (
                    <div key={meter.key} className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-fg">{meter.label}</span>
                        <span className="text-[0.6875rem] text-muted">
                          {formatNumber(meter.used)} / {formatNumber(meter.included)} {meter.unit}
                          {overage > 0 ? ` · ${formatNumber(overage)} over the included allowance` : ''}
                        </span>
                      </div>
                      <Progress value={percent} tone={percent >= 90 ? 'red' : percent >= 70 ? 'amber' : 'teal'} size="sm" />
                      <p className="text-[0.625rem] text-faint">
                        {meter.periodStart} → {meter.periodEnd} · overage behaviour: {meter.overageBehaviour}
                      </p>
                    </div>
                  );
                })
              )}
              <Alert tone="info" title="Meters are illustrative">
                The readings are seeded synthetic figures. Usage is not metered from real traffic and nothing here feeds an invoice.
              </Alert>
            </CardContent>
          </Card>
        ) : null}

        {activeKey === 'invoices' ? (
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <FileText className="size-4 text-subtle" aria-hidden />
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoices.loading ? (
                <ListSkeleton rows={5} columns={6} />
              ) : (
                <DataTable
                  columns={invoiceColumns}
                  data={invoices.items}
                  getRowId={(invoice) => invoice.id}
                  onRowClick={(invoice) => setInvoiceDetail(invoice)}
                  footer={
                    invoices.meta ? (
                      <div className="flex items-center justify-between gap-2 text-2xs text-muted">
                        <span>
                          {formatNumber(invoices.meta.total)} invoices · page {invoices.meta.page} of {invoices.meta.totalPages}
                        </span>
                        <span className="flex gap-1">
                          <Button variant="ghost" size="xs" disabled={!invoices.meta.hasPrev} onClick={() => setInvoicePage((page) => Math.max(1, page - 1))}>
                            Previous
                          </Button>
                          <Button variant="ghost" size="xs" disabled={!invoices.meta.hasNext} onClick={() => setInvoicePage((page) => page + 1)}>
                            Next
                          </Button>
                        </span>
                      </div>
                    ) : null
                  }
                />
              )}
              <DemoNotice tone="neutral">
                Invoices are records in this browser. They cannot be paid, downloaded as a PDF or disputed from here, and the payment
                state on each one is <span className="font-mono text-[0.6875rem]">not_connected</span>.
              </DemoNotice>
            </CardContent>
          </Card>
        ) : null}

        {activeKey === 'payment-method' ? (
          <>
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <CreditCard className="size-4 text-subtle" aria-hidden />
                <CardTitle>Payment method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {paymentMethods.loading ? (
                  <ListSkeleton rows={2} columns={3} />
                ) : (
                  <ul className="space-y-2">
                    {(paymentMethods.data ?? []).map((method) => (
                      <li key={method.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-inset p-3">
                        <span className="flex size-8 items-center justify-center rounded-md bg-neutral-subtle text-[0.625rem] font-semibold text-muted" aria-hidden>
                          {method.brand.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-fg">{method.label}</span>
                          <span className="mt-0.5 block text-[0.6875rem] text-muted">
                            {method.brand} · {method.last4Masked}
                            {method.expiresAt ? ` · expires ${method.expiresAt}` : ''}
                          </span>
                        </span>
                        <StatusBadge status={method.state} label="Not connected" size="sm" />
                        {method.isDefault ? <Badge variant="outline" size="sm">Default</Badge> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <Alert tone="warning" title="Nothing is stored">
                  There is no card, bank account, mandate or token anywhere in this build — not even a masked one beyond the
                  placeholder above. Adding a payment method would require the payment provider this demonstration does not have.
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <Info className="size-4 text-subtle" aria-hidden />
                <CardTitle>Billing contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-2xs font-medium uppercase tracking-wide text-faint">Contact email</dt>
                    <dd className="mt-0.5 truncate font-medium text-fg">{activeTenant?.contactEmail ?? 'Not recorded'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-2xs font-medium uppercase tracking-wide text-faint">Contracting entity</dt>
                    <dd className="mt-0.5 truncate font-medium text-fg">{activeTenant?.name ?? record.tenantName}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-2xs font-medium uppercase tracking-wide text-faint">Billing currency</dt>
                    <dd className="mt-0.5 truncate font-medium text-fg">{activeTenant?.billingCurrency ?? record.currency}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-2xs font-medium uppercase tracking-wide text-faint">Billing country</dt>
                    <dd className="mt-0.5 truncate font-medium text-fg">{activeTenant?.countryCode ?? 'Not recorded'}</dd>
                  </div>
                </dl>
                <DemoNotice tone="neutral">
                  This card is read-only. Changing a billing contact belongs to the platform-owner console, which is not built in this
                  deliverable, so no edit control is offered rather than one that does nothing.
                </DemoNotice>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* ------------------------------------------------------ change plan */}
      <Dialog
        open={changeOpen}
        onOpenChange={(open) => {
          setChangeOpen(open);
          if (!open) setPreviewRequest(undefined);
        }}
      >
        <DialogContent
          title="Change plan"
          description="Preview first: the amounts are illustrative and the entitlement differences are computed from the plan records."
          size="lg"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setChangeOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!preview || !changePlanId}
                loading={changePlan.pending}
                onClick={() => void changePlan.run({ planId: changePlanId, seats: Number(changeSeats), interval: changeInterval })}
              >
                Record the change
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Plan" htmlFor="change-plan">
                <Select
                  id="change-plan"
                  value={changePlanId}
                  onValueChange={(value) => {
                    setChangePlanId(value);
                    setPreviewRequest(undefined);
                  }}
                  options={plans.items.map((plan) => ({ value: plan.id, label: plan.name }))}
                />
              </Field>
              <Field label="Seats" htmlFor="change-seats">
                <Input id="change-seats" inputMode="numeric" value={changeSeats} onChange={(event) => setChangeSeats(event.target.value)} />
              </Field>
              <Field label="Billing interval" htmlFor="change-interval">
                <Select
                  id="change-interval"
                  value={changeInterval}
                  onValueChange={(value) => setChangeInterval(value as 'month' | 'year')}
                  options={INTERVALS}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={previewChange.loading}
                onClick={() => setPreviewRequest({ planId: changePlanId, seats: Number(changeSeats), interval: changeInterval })}
              >
                Preview the change
              </Button>
              {previewChange.error ? <span className="text-xs text-danger-fg">{previewChange.error}</span> : null}
            </div>

            {preview ? (
              <div className="space-y-3">
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Amount</Th>
                      <Th align="end">Value</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <Tr>
                      <Td>Recurring per {preview.interval === 'year' ? 'year' : 'month'}</Td>
                      <Td align="end">{formatMoney(preview.recurringAmount, preview.currency)}</Td>
                    </Tr>
                    <Tr>
                      <Td>Due now (illustrative proration)</Td>
                      <Td align="end">{formatMoney(preview.amountDueNow, preview.currency)}</Td>
                    </Tr>
                    <Tr>
                      <Td>Effective</Td>
                      <Td align="end">{formatDate(preview.effectiveDate)}</Td>
                    </Tr>
                  </tbody>
                </TableWrap>
                <p className="text-[0.6875rem] leading-relaxed text-muted">{preview.prorationNote}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-fg">Entitlements gained</p>
                    {preview.entitlementsGained.length === 0 ? (
                      <p className="mt-1 text-[0.6875rem] text-faint">None — this plan adds no module.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-[0.6875rem] text-muted">
                        {preview.entitlementsGained.map((entitlement) => (
                          <li key={entitlement.moduleKey}>{entitlement.label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-fg">Entitlements lost</p>
                    {preview.entitlementsLost.length === 0 ? (
                      <p className="mt-1 text-[0.6875rem] text-faint">None — this plan removes no module.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-[0.6875rem] text-warning-fg">
                        {preview.entitlementsLost.map((entitlement) => (
                          <li key={entitlement.moduleKey}>{entitlement.label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <Alert tone="warning" title="Recording the change is simulated">
                  The subscription record in this browser is updated; no invoice is raised, no payment is taken and the platform-owner
                  console is not notified.
                </Alert>
              </div>
            ) : (
              <p className="text-xs text-muted">Run the preview to see the recurring amount, the proration note and what each plan adds or removes.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------- cancel */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent
          title="Cancel this subscription"
          description="The record is marked cancelled in this browser. Nothing is billed, refunded or prorated."
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>
                Keep subscription
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={cancelReason.trim().length < 4}
                loading={cancelSubscription.pending}
                onClick={() => void cancelSubscription.run({ reason: cancelReason.trim(), effective: cancelEffective })}
              >
                Record cancellation
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Reason" htmlFor="cancel-sub-reason" required>
              <Textarea id="cancel-sub-reason" rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Moving to a different vendor, project ended…" />
            </Field>
            <Field label="Effective" htmlFor="cancel-sub-effective">
              <Select
                id="cancel-sub-effective"
                value={cancelEffective}
                onValueChange={(value) => setCancelEffective(value as 'immediately' | 'end_of_period')}
                options={[
                  { value: 'end_of_period', label: `At the end of the current period (${formatDate(record.currentPeriodEnd)})` },
                  { value: 'immediately', label: 'Immediately' },
                ]}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- invoice detail */}
      <Dialog open={invoiceDetail !== null} onOpenChange={(open) => !open && setInvoiceDetail(null)}>
        <DialogContent
          title={invoiceDetail?.reference ?? 'Invoice'}
          description={invoiceDetail ? `${invoiceDetail.status} · issued ${formatDate(invoiceDetail.issuedAt)} · due ${formatDate(invoiceDetail.dueAt)}` : undefined}
          size="lg"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setInvoiceDetail(null)}>
              Close
            </Button>
          }
        >
          {invoiceDetail ? (
            <div className="space-y-4">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Line</Th>
                    <Th align="end">Qty</Th>
                    <Th align="end">Unit</Th>
                    <Th align="end">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceDetail.lineItems.map((line) => (
                    <Tr key={line.id}>
                      <Td>{line.description}</Td>
                      <Td align="end">{line.quantity}</Td>
                      <Td align="end">{formatMoney(line.unitPrice.amount, invoiceDetail.currency)}</Td>
                      <Td align="end">{formatMoney(line.amount.amount, invoiceDetail.currency)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
              <dl className="space-y-1.5 text-xs">
                {[
                  { label: 'Subtotal', value: formatMoney(invoiceDetail.subtotal.amount, invoiceDetail.currency) },
                  { label: 'Discount', value: formatMoney(invoiceDetail.discount.amount, invoiceDetail.currency) },
                  { label: 'Tax', value: formatMoney(invoiceDetail.tax.amount, invoiceDetail.currency) },
                  { label: 'Total', value: formatMoney(invoiceDetail.total.amount, invoiceDetail.currency) },
                  { label: 'Paid', value: formatMoney(invoiceDetail.amountPaid.amount, invoiceDetail.currency) },
                  { label: 'Outstanding', value: formatMoney(invoiceDetail.amountDue.amount, invoiceDetail.currency) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="font-medium tabular-nums text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-1 text-[0.6875rem] text-muted">
                <p>
                  Payment provider: <span className="font-mono">{invoiceDetail.paymentProviderState}</span>
                  {invoiceDetail.paymentMethodMasked ? ` · ${invoiceDetail.paymentMethodMasked}` : ''}
                </p>
                <p>Attempts recorded: {invoiceDetail.attempts}</p>
                {invoiceDetail.failureReason ? <p className="text-danger-fg">{invoiceDetail.failureReason}</p> : null}
              </div>
              <DemoNotice tone="neutral">
                Tax is zero and stated as such rather than estimated. This invoice is a record, not a document: it cannot be paid or
                downloaded as a PDF from here.
              </DemoNotice>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
