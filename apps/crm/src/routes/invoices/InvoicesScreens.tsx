'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, CircleDollarSign, XCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { InvoiceRecord } from '@crm/shared-types';
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
  PropertyList,
  Select,
  StatusBadge,
  Textarea,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Invoice screens.
 *
 * These are CRM-visible billing records — `documentKind: 'crm_reference_only'` is on every
 * record and the screens repeat it: recording a payment here changes CRM state, not money.
 * The lifecycle is deliberately small and honest:
 *
 *   - **Payments accumulate.** Partial payments move an invoice to `payment_pending`;
 *     settling the balance moves it to `payment_received` and clears dunning.
 *   - **Voiding is for unpaid invoices.** A paid invoice cannot be voided, because a refund
 *     is an accounting act this build does not record — the screen says so.
 *   - **Tax is not invented.** `taxTotal` is zero and the seeded `taxNote` explains that the
 *     accounting system owns tax.
 */

const INVOICE_STATUSES = ['draft', 'issued', 'payment_pending', 'payment_received', 'overdue', 'void', 'refunded', 'written_off'] as const;
const PAYABLE_STATUSES: readonly InvoiceRecord['status'][] = ['draft', 'issued', 'payment_pending', 'overdue'];

/* ---------------------------------------------------------------------- list */

export default function InvoicesList() {
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
      sort: [{ field: 'issueDate', direction: 'desc' as const }],
      filter:
        statusFilter === 'all'
          ? undefined
          : {
              id: 'invoice-status',
              conjunction: 'and' as const,
              clauses: [{ field: 'status', operator: 'eq' as const, value: statusFilter }] as never,
            },
    }),
    [page, search, statusFilter],
  );

  const invoices = useList(() => services.invoices.list(query), [JSON.stringify(query)]);
  const summary = useAsync(() => services.products.revenueSummary(), []);

  const columns = React.useMemo<ColumnDef<InvoiceRecord, unknown>[]>(
    () => [
      {
        id: 'reference',
        header: 'Invoice',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/subscriptions/invoices/${row.original.id}`} className="block truncate font-mono text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.reference}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.accountName}</span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'dunning',
        header: 'Dunning',
        accessorKey: 'dunningStage',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.dunningStage === 'none' ? '—' : row.original.dunningStage.replace(/_/g, ' ')}</span>,
      },
      { id: 'issueDate', header: 'Issued', accessorKey: 'issueDate', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.issueDate)}</span> },
      { id: 'dueDate', header: 'Due', accessorKey: 'dueDate', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.dueDate)}</span> },
      {
        id: 'total',
        header: 'Total',
        accessorFn: (invoice) => invoice.total.amount,
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.total.amount, row.original.currency)}</span>,
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorFn: (invoice) => invoice.balanceDue.amount,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className={row.original.balanceDue.amount > 0 ? 'text-xs font-medium tabular-nums text-warning-fg' : 'text-xs tabular-nums text-faint'}>
            {formatMoney(row.original.balanceDue.amount, row.original.currency)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Invoices"
        description="CRM-visible billing records linked to contracts and orders. They are reference records, not accounting documents."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Recurring revenue', to: '/app/subscriptions' }, { label: 'Invoices' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search reference or account"
            resultCount={invoices.meta ? `${invoices.meta.total.toLocaleString()} invoices` : undefined}
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
                options={['all', ...INVOICE_STATUSES].map((value) => ({ value, label: value === 'all' ? 'All statuses' : value.replace(/_/g, ' ') }))}
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
          <MiniStat label="Outstanding" value={formatMoney(summary.data?.invoices.outstandingValue.amount ?? 0, summary.data?.currency ?? 'USD', true)} tone="blue" />
          <MiniStat label="Overdue" value={formatMoney(summary.data?.invoices.overdueValue.amount ?? 0, summary.data?.currency ?? 'USD', true)} tone="amber" />
          <MiniStat label="Overdue count" value={formatNumber(summary.data?.invoices.overdueCount ?? 0)} tone={summary.data && summary.data.invoices.overdueCount > 0 ? 'red' : 'teal'} />
          <MiniStat label="Collected this period" value={formatMoney(summary.data?.invoices.collectedThisPeriod.amount ?? 0, summary.data?.currency ?? 'USD', true)} tone="teal" />
        </div>

        {invoices.loading ? (
          <ListSkeleton rows={10} columns={7} />
        ) : (
          <DataTable
            columns={columns}
            data={invoices.items}
            onRowClick={(invoice) => navigate(`/app/subscriptions/invoices/${invoice.id}`)}
            getRowId={(invoice) => invoice.id}
            footer={invoices.meta ? <Pagination page={invoices.meta.page} pageSize={invoices.meta.pageSize} total={invoices.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function InvoiceDetail() {
  const services = useServices();
  const { invoiceId } = useParams<{ invoiceId: string }>();

  const invoice = useAsync(() => services.invoices.get(invoiceId ?? ''), [invoiceId], { skip: !invoiceId });
  const record = invoice.data;

  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [markPaidOpen, setMarkPaidOpen] = React.useState(false);
  const [voidOpen, setVoidOpen] = React.useState(false);

  const pay = useMutation((amount: number) => services.invoices.recordPayment(invoiceId ?? '', amount), {
    successMessage: 'Payment recorded.',
    onSuccess: () => {
      setPaymentOpen(false);
      invoice.reload();
    },
  });
  const markPaid = useMutation((paidDate: string) => services.invoices.markPaid(invoiceId ?? '', paidDate), {
    successMessage: 'Invoice marked as paid.',
    onSuccess: () => {
      setMarkPaidOpen(false);
      invoice.reload();
    },
  });
  const voidInvoice = useMutation((reason: string) => services.invoices.void(invoiceId ?? '', reason), {
    successMessage: 'Invoice voided.',
    onSuccess: () => {
      setVoidOpen(false);
      invoice.reload();
    },
  });

  if (invoice.loading) return <ListSkeleton rows={12} columns={3} />;
  if (invoice.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This invoice could not be found</h2>
            <p className="text-xs text-muted">{invoice.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/subscriptions/invoices">Back to invoices</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const payable = PAYABLE_STATUSES.includes(record.status) && record.balanceDue.amount > 0;
  const voidable = record.status !== 'void' && record.status !== 'payment_received' && record.status !== 'refunded';

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/subscriptions/invoices', label: 'Invoices' }}
          title={record.reference}
          subtitle={record.accountName}
          badges={
            <>
              <StatusBadge status={record.status} />
              {record.dunningStage !== 'none' ? (
                <Badge variant="outline" size="sm">
                  {record.dunningStage.replace(/_/g, ' ')}
                </Badge>
              ) : null}
            </>
          }
          facts={[
            { label: 'Total', value: formatMoney(record.total.amount, record.currency) },
            { label: 'Paid', value: formatMoney(record.amountPaid.amount, record.currency) },
            { label: 'Balance', value: formatMoney(record.balanceDue.amount, record.currency) },
            { label: 'Issued', value: formatDate(record.issueDate) },
            { label: 'Due', value: formatDate(record.dueDate) },
          ]}
          actions={
            <>
              {payable ? (
                <Button variant="primary" size="sm" loading={pay.pending} onClick={() => setPaymentOpen(true)} leadingIcon={<CircleDollarSign className="size-3.5" />}>
                  Record payment
                </Button>
              ) : null}
              {payable ? (
                <Button variant="secondary" size="sm" onClick={() => setMarkPaidOpen(true)} leadingIcon={<BadgeCheck className="size-3.5" />}>
                  Mark paid
                </Button>
              ) : null}
              {voidable ? (
                <Button variant="ghost" size="sm" onClick={() => setVoidOpen(true)} leadingIcon={<XCircle className="size-3.5" />}>
                  Void
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {record.status === 'void' ? (
          <Alert tone="danger" title="This invoice is void">
            {record.notes ?? 'No reason was recorded.'}
          </Alert>
        ) : null}
        {record.status === 'overdue' ? (
          <Alert tone="warning" title="This invoice is overdue">
            The balance of {formatMoney(record.balanceDue.amount, record.currency)} was due {formatDate(record.dueDate)}. Dunning stage:{' '}
            {record.dunningStage.replace(/_/g, ' ')} — shown for presentation; no reminders are sent by this build.
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Amounts</h2>
            <dl className="mt-3 divide-y divide-[var(--border-subtle)]">
              {[
                { label: 'Subtotal', value: formatMoney(record.subtotal.amount, record.currency) },
                { label: 'Discounts', value: `−${formatMoney(record.discountTotal.amount, record.currency)}` },
                { label: 'Tax', value: formatMoney(record.taxTotal.amount, record.currency) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="text-xs font-medium tabular-nums text-fg">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1 text-[0.625rem] leading-relaxed text-faint">{record.taxNote}</p>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border-subtle pt-2">
              <span className="text-xs font-medium text-fg">Total</span>
              <span className="text-base font-semibold tabular-nums tracking-tight text-fg">{formatMoney(record.total.amount, record.currency)}</span>
            </div>
            <dl className="mt-3 divide-y divide-[var(--border-subtle)] border-t border-border-subtle">
              {[
                { label: 'Amount paid', value: formatMoney(record.amountPaid.amount, record.currency) },
                { label: 'Balance due', value: formatMoney(record.balanceDue.amount, record.currency) },
                { label: 'Paid date', value: record.paidDate ? formatDate(record.paidDate) : '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="text-xs font-medium tabular-nums text-fg">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <DemoNotice tone="neutral">
                This is a CRM reference record, not an accounting document. Recording a payment updates CRM state only — it
                does not move money.
              </DemoNotice>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Details</h2>
              <PropertyList
                className="mt-3"
                items={[
                  { label: 'Account', value: <Link className="text-link hover:underline" to={`/app/accounts/${record.accountId}`}>{record.accountName}</Link> },
                  {
                    label: 'Contract',
                    value: record.contractId ? (
                      <Link className="text-link hover:underline" to={`/app/contracts/${record.contractId}`}>
                        Open contract
                      </Link>
                    ) : (
                      '—'
                    ),
                  },
                  {
                    label: 'Order',
                    value: record.orderId ? (
                      <Link className="text-link hover:underline" to={`/app/orders/${record.orderId}`}>
                        Open order
                      </Link>
                    ) : (
                      '—'
                    ),
                  },
                  { label: 'Payment method', value: record.paymentMethodLabel ?? '—' },
                  { label: 'Payment reference', value: record.paymentReferenceMasked ?? '—' },
                  { label: 'Tax jurisdiction', value: record.taxJurisdiction ?? '—' },
                ]}
              />
            </Card>

            {record.notes && record.status !== 'void' ? (
              <Card className="p-4">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Notes</h2>
                <p className="mt-2 whitespace-pre-line text-xs text-muted">{record.notes}</p>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent
          title="Record a payment"
          description="Adds to the paid amount on this invoice. It does not process or settle a real transaction."
          footer={
            <>
              <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="invoice-payment-form" loading={pay.pending}>
                Record payment
              </Button>
            </>
          }
        >
          <form
            id="invoice-payment-form"
            onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(new FormData(event.currentTarget).get('amount'));
              if (!Number.isFinite(amount) || amount <= 0) {
                notify.warning('Enter an amount greater than zero.');
                return;
              }
              void pay.run(Math.round(amount));
            }}
          >
            <Field label="Amount" htmlFor="invoice-payment-amount" required hint={`Balance ${formatMoney(record.balanceDue.amount, record.currency)}`}>
              <Input id="invoice-payment-amount" name="amount" inputMode="decimal" defaultValue={String(record.balanceDue.amount)} />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent
          title="Mark this invoice as paid"
          description="Settles the full balance and clears dunning. Use this when the payment is recorded elsewhere."
          footer={
            <>
              <Button variant="secondary" onClick={() => setMarkPaidOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="invoice-paid-form" loading={markPaid.pending}>
                Mark paid
              </Button>
            </>
          }
        >
          <form
            id="invoice-paid-form"
            onSubmit={(event) => {
              event.preventDefault();
              const paidDate = String(new FormData(event.currentTarget).get('paidDate') ?? '');
              if (!paidDate) {
                notify.warning('Choose a payment date.');
                return;
              }
              void markPaid.run(paidDate);
            }}
          >
            <Field label="Payment date" htmlFor="invoice-paid-date" required>
              <Input id="invoice-paid-date" name="paidDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent
          title="Void this invoice"
          description="Cancels the outstanding balance and records why. A paid invoice cannot be voided — this build records no refunds."
          footer={
            <>
              <Button variant="secondary" onClick={() => setVoidOpen(false)}>
                Keep invoice
              </Button>
              <Button variant="danger" type="submit" form="invoice-void-form" loading={voidInvoice.pending}>
                Void invoice
              </Button>
            </>
          }
        >
          <form
            id="invoice-void-form"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
              if (!reason) {
                notify.warning('Record why the invoice is being voided.');
                return;
              }
              void voidInvoice.run(reason);
            }}
          >
            <Field label="Reason" htmlFor="invoice-void-reason" required>
              <Textarea id="invoice-void-reason" name="reason" rows={3} placeholder="Raised against the wrong contract, duplicate invoice, pricing error…" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
