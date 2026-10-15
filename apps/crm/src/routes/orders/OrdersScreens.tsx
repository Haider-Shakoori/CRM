'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleDollarSign, PackageCheck, XCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Order, QuoteLineItem } from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  Field,
  Input,
  MiniStat,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Order screens.
 *
 * An order is the point at which a quote becomes a commitment, so this file is deliberately
 * conservative about state:
 *
 *   - **Activation is explicit.** An order stays `pending_signature` until someone activates it;
 *     nothing activates itself.
 *   - **Billing and payment are presentation, not a ledger.** `invoicedAmount` and `paidAmount`
 *     are recorded figures; the panel says the platform is not an accounting system.
 *   - **Fulfilment is not integrated.** The order records that no shipment or provisioning
 *     system is connected rather than showing a fake tracking state.
 */

/* ---------------------------------------------------------------------- list */

export default function OrdersList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('all');

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 50,
      q: search || undefined,
      sort: [{ field: 'orderDate', direction: 'desc' as const }],
      filter:
        statusFilter === 'all'
          ? undefined
          : {
              id: 'order-status',
              conjunction: 'and' as const,
              clauses: [{ field: 'status', operator: 'eq' as const, value: statusFilter }] as never,
            },
    }),
    [page, search, statusFilter],
  );

  const orders = useList(() => services.orders.list(query), [JSON.stringify(query)]);
  const summary = useAsync(() => services.products.revenueSummary(), []);

  const columns = React.useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      {
        id: 'reference',
        header: 'Order',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/orders/${row.original.id}`} className="block truncate font-mono text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.reference}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.accountName}</span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'payment',
        header: 'Payment',
        accessorKey: 'paymentState',
        cell: ({ row }) => <StatusBadge status={row.original.paymentState} size="sm" />,
      },
      { id: 'billing', header: 'Billing', accessorKey: 'billingState', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.billingState.replace(/_/g, ' ')}</span> },
      { id: 'orderDate', header: 'Ordered', accessorKey: 'orderDate', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.orderDate)}</span> },
      {
        id: 'total',
        header: 'Value',
        accessorFn: (order) => order.totals.grandTotal.amount,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.totals.grandTotal.amount, row.original.currency)}</span>,
      },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Orders"
        description="Orders created from accepted quotes, with an explicit activation step and CRM-visible billing state."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Orders' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search order reference or account"
            resultCount={orders.meta ? `${orders.meta.total.toLocaleString()} orders` : undefined}
            chips={statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, tone: 'brand', onRemove: () => setStatusFilter('all') }] : []}
            onClearFilters={() => {
              setStatusFilter('all');
              setSearch('');
            }}
            actions={
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                options={['all', 'draft', 'pending_signature', 'activated', 'partially_fulfilled', 'fulfilled', 'completed', 'cancelled'].map((value) => ({
                  value,
                  label: value === 'all' ? 'All statuses' : value.replace(/_/g, ' '),
                }))}
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
          <MiniStat label="Orders" value={formatNumber(summary.data?.orders.count ?? 0)} tone="violet" />
          <MiniStat label="Order value" value={formatMoney(summary.data?.orders.value.amount ?? 0, summary.data?.currency ?? 'USD', true)} tone="blue" />
          <MiniStat label="Awaiting activation" value={formatNumber(summary.data?.orders.pendingActivation ?? 0)} tone="amber" />
          <MiniStat label="Outstanding" value={formatMoney(summary.data?.orders.outstandingValue.amount ?? 0, summary.data?.currency ?? 'USD', true)} tone="teal" />
        </div>

        {orders.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={orders.items}
            onRowClick={(order) => navigate(`/app/orders/${order.id}`)}
            getRowId={(order) => order.id}
            footer={orders.meta ? <Pagination page={orders.meta.page} pageSize={orders.meta.pageSize} total={orders.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function OrderDetail() {
  const services = useServices();
  const { orderId } = useParams<{ orderId: string }>();

  const order = useAsync(() => services.orders.get(orderId ?? ''), [orderId], { skip: !orderId });
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [method, setMethod] = React.useState('Bank transfer');
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const record = order.data;

  const activate = useMutation(() => services.orders.activate(orderId ?? ''), { successMessage: 'Order activated.', onSuccess: () => order.reload() });
  const cancel = useMutation((reason: string) => services.orders.cancel(orderId ?? '', reason), { successMessage: 'Order cancelled.', onSuccess: () => { setCancelOpen(false); order.reload(); } });
  const pay = useMutation(
    (input: { amount: number; method: string }) => services.orders.recordPayment(orderId ?? '', input.amount, input.method),
    { successMessage: 'Payment recorded.', onSuccess: () => { setPaymentOpen(false); order.reload(); } },
  );

  if (order.loading) return <ListSkeleton rows={12} columns={3} />;
  if (order.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This order could not be found</h2>
            <p className="text-xs text-muted">{order.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/orders">Back to orders</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const canActivate = record.status === 'draft' || record.status === 'pending_signature';
  const canCancel = record.status !== 'cancelled' && record.status !== 'completed';
  const balance = Math.max(0, record.invoicedAmount.amount - record.paidAmount.amount);

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/orders', label: 'Orders' }}
          title={record.reference}
          subtitle={record.accountName}
          badges={
            <>
              <StatusBadge status={record.status} />
              <StatusBadge status={record.paymentState} />
              {record.quoteId ? <Badge variant="outline" size="sm">From quote</Badge> : null}
            </>
          }
          facts={[
            { label: 'Value', value: formatMoney(record.totals.grandTotal.amount, record.currency) },
            { label: 'Ordered', value: formatDate(record.orderDate) },
            { label: 'Effective', value: formatDate(record.effectiveDate) },
            { label: 'Billing', value: record.billingFrequency.replace(/_/g, ' ') },
            { label: 'Owner', value: record.ownerName },
          ]}
          actions={
            <>
              {canActivate ? (
                <Button variant="primary" size="sm" loading={activate.pending} onClick={() => void activate.run(undefined)} leadingIcon={<PackageCheck className="size-3.5" />}>
                  Activate order
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setPaymentOpen(true)} leadingIcon={<CircleDollarSign className="size-3.5" />} disabled={record.status === 'cancelled'}>
                Record payment
              </Button>
              {canCancel ? (
                <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)} leadingIcon={<XCircle className="size-3.5" />}>
                  Cancel order
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {record.status === 'cancelled' ? (
          <Alert tone="danger" title="This order was cancelled">
            {record.cancelReason ?? 'No reason was recorded.'}
          </Alert>
        ) : null}

        {record.quoteId ? (
          <Alert tone="info" title="Created from a quote">
            <Link className="underline" to={`/app/quotes/${record.quoteId}`}>
              Open the source quote
            </Link>
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Line items</h2>
            </div>
            {record.lineItems.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted">This order carries no line items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">Order line items</caption>
                  <thead>
                    <tr>
                      {['Product', 'Qty', 'Unit price', 'Discount', 'Net'].map((heading, index) => (
                        <th
                          key={heading}
                          scope="col"
                          className={cn(
                            'border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted',
                            index > 0 ? 'text-end' : 'text-start',
                          )}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {record.lineItems.map((line: QuoteLineItem) => (
                      <tr key={line.id} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-3 py-2">
                          <p className="font-medium text-fg">{line.productName}</p>
                          <p className="mt-0.5 font-mono text-[0.625rem] text-faint">
                            {line.sku} · {line.billing.replace(/_/g, ' ')}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{line.quantity}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{formatMoney(line.unitPrice.amount, record.currency)}</td>
                        <td className="px-3 py-2 text-end tabular-nums text-muted">{line.discountPercent}%</td>
                        <td className="px-3 py-2 text-end font-medium tabular-nums text-fg">{formatMoney(line.netTotal.amount, record.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Totals</h2>
              <dl className="mt-3 divide-y divide-[var(--border-subtle)]">
                {[
                  { label: 'Subtotal', value: formatMoney(record.totals.subtotal.amount, record.currency) },
                  { label: 'Line discounts', value: `−${formatMoney(record.totals.lineDiscountTotal.amount, record.currency)}` },
                  { label: 'Order discount', value: `−${formatMoney(record.totals.orderDiscountAmount.amount, record.currency)}` },
                  { label: 'Tax', value: formatMoney(record.totals.taxTotal.amount, record.currency) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 py-1">
                    <dt className="text-xs text-muted">{row.label}</dt>
                    <dd className="text-xs font-medium tabular-nums text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-1 text-[0.625rem] leading-relaxed text-faint">{record.totals.taxNote}</p>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-border-subtle pt-2">
                <span className="text-xs font-medium text-fg">Grand total</span>
                <span className="text-base font-semibold tabular-nums tracking-tight text-fg">{formatMoney(record.totals.grandTotal.amount, record.currency)}</span>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Billing &amp; payment</h2>
              <dl className="mt-3 space-y-2 text-xs">
                {[
                  { label: 'Billing state', value: record.billingState.replace(/_/g, ' ') },
                  { label: 'Invoiced', value: formatMoney(record.invoicedAmount.amount, record.currency) },
                  { label: 'Paid', value: formatMoney(record.paidAmount.amount, record.currency) },
                  { label: 'Balance', value: formatMoney(balance, record.currency) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="font-medium capitalize text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3">
                <DemoNotice tone="neutral">
                  Billing and payment figures are records this CRM holds, not an accounting ledger. Recording a payment
                  here does not move money.
                </DemoNotice>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Fulfilment</h2>
              <p className="mt-2 text-xs text-muted">{record.fulfilment?.statusNote ?? 'No fulfilment record.'}</p>
              <div className="mt-3">
                <DemoNotice tone="neutral">
                  This build has no shipment, provisioning or service-delivery integration. Fulfilment is tracked as a CRM
                  note only.
                </DemoNotice>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent
          title="Record a payment"
          description="Adds to the paid amount on this order. It does not process or settle a real transaction."
          footer={
            <>
              <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="order-payment-form" loading={pay.pending}>
                Record payment
              </Button>
            </>
          }
        >
          <form
            id="order-payment-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const amount = Number(data.get('amount'));
              if (!Number.isFinite(amount) || amount <= 0) {
                notify.warning('Enter an amount greater than zero.');
                return;
              }
              void pay.run({ amount, method });
            }}
          >
            <Field label="Amount" htmlFor="payment-amount" required hint={`Balance ${formatMoney(balance, record.currency)}`}>
              <Input id="payment-amount" name="amount" inputMode="decimal" placeholder={String(balance)} />
            </Field>
            <Field label="Method" htmlFor="payment-method">
              <Select
                id="payment-method"
                value={method}
                onValueChange={setMethod}
                options={['Bank transfer', 'Card', 'ACH', 'Cheque', 'Other'].map((value) => ({ value, label: value }))}
              />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent
          title="Cancel this order"
          description="Records that the order was cancelled and why. A cancelled order cannot be activated."
          footer={
            <>
              <Button variant="secondary" onClick={() => setCancelOpen(false)}>
                Keep order
              </Button>
              <Button variant="danger" type="submit" form="cancel-order-form" loading={cancel.pending}>
                Cancel order
              </Button>
            </>
          }
        >
          <form
            id="cancel-order-form"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
              if (!reason) {
                notify.warning('Add a reason.');
                return;
              }
              void cancel.run(reason);
            }}
          >
            <Field label="Reason" htmlFor="cancel-reason" required>
              <Textarea id="cancel-reason" name="reason" rows={3} placeholder="Customer withdrew, duplicate order, pricing error…" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
