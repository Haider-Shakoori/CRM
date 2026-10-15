'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, FileText, GitBranch, Plus, Send, Trash2, XCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Account, Deal, Product, Quote, QuoteApprovalStep, QuoteLineItem, QuoteTotals } from '@crm/shared-types';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Quote screens.
 *
 * The quote builder is where the pricing engine becomes visible, so three rules are enforced
 * here rather than left to prose:
 *
 *   1. **Totals are never computed in the browser.** Every line change calls the service, which
 *      re-prices and returns the document. The panel renders what came back, so a displayed
 *      total and a stored total cannot disagree.
 *   2. **Tax is shown as what it is.** `taxTotal` is zero and the row says the platform does not
 *      calculate tax, rather than printing a plausible-looking number.
 *   3. **An action is available only when its preconditions hold.** A draft quote offers no
 *      "Convert to order" button; the service would refuse it, and offering the control anyway
 *      would be a lie about what is possible.
 */

/* ---------------------------------------------------------------------- list */

export default function QuotesList() {
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
      sort: [{ field: 'updatedAt', direction: 'desc' as const }],
      filter:
        statusFilter === 'all'
          ? undefined
          : {
              id: 'quote-status',
              conjunction: 'and' as const,
              clauses: [{ field: 'status', operator: 'eq' as const, value: statusFilter }] as never,
            },
    }),
    [page, search, statusFilter],
  );

  const quotes = useList(() => services.quotes.list(query), [JSON.stringify(query)]);
  const summary = useAsync(() => services.products.revenueSummary(), []);

  const columns = React.useMemo<ColumnDef<Quote, unknown>[]>(
    () => [
      {
        id: 'reference',
        header: 'Quote',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/quotes/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.name}
            </Link>
            <span className="mt-0.5 block truncate font-mono text-[0.625rem] text-faint">
              {row.original.reference}
              {row.original.version > 1 ? ` · v${row.original.version}` : ''}
            </span>
          </div>
        ),
      },
      { id: 'account', header: 'Account', accessorKey: 'accountName', cell: ({ row }) => <span className="truncate text-xs text-muted">{row.original.accountName}</span> },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'approval',
        header: 'Approval',
        accessorKey: 'approvalState',
        cell: ({ row }) =>
          row.original.approvalState === 'pending' ? (
            <Badge variant="warning" size="sm">Pending</Badge>
          ) : (
            <span className="text-[0.6875rem] text-faint">{row.original.approvalState.replace(/_/g, ' ')}</span>
          ),
      },
      { id: 'validUntil', header: 'Valid until', accessorKey: 'validUntil', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.validUntil)}</span> },
      {
        id: 'total',
        header: 'Total',
        accessorFn: (quote) => quote.totals.grandTotal.amount,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs font-medium tabular-nums text-fg">
            {formatMoney(row.original.totals.grandTotal.amount, row.original.currency)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Quotes"
        description="Build a quote from the catalogue, see its totals recomputed as lines change, and route discounts that exceed a threshold for approval."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Quotes' }]}
        actions={
          <Button variant="primary" size="sm" leadingIcon={<Plus className="size-3.5" />} asChild>
            <Link to="/app/quotes/new">New quote</Link>
          </Button>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search quote, account or deal"
            resultCount={quotes.meta ? `${quotes.meta.total.toLocaleString()} quotes` : undefined}
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
                options={['all', 'draft', 'pending_approval', 'approved', 'sent', 'viewed', 'accepted', 'declined', 'revised', 'expired'].map((value) => ({
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
          <MiniStat label="Open quotes" value={formatNumber(summary.data?.quotes.openCount ?? 0)} tone="violet" />
          <MiniStat label="Open value" value={formatMoney(summary.data?.quotes.openValue.amount ?? 0, summary.data?.currency ?? 'USD', true)} tone="blue" />
          <MiniStat label="Acceptance rate" value={`${summary.data?.quotes.acceptanceRate ?? 0}%`} tone="green" />
          <MiniStat label="Awaiting approval" value={formatNumber(summary.data?.quotes.pendingApprovalCount ?? 0)} tone="amber" />
        </div>

        {quotes.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={quotes.items}
            onRowClick={(quote) => navigate(`/app/quotes/${quote.id}`)}
            getRowId={(quote) => quote.id}
            footer={quotes.meta ? <Pagination page={quotes.meta.page} pageSize={quotes.meta.pageSize} total={quotes.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

/** Build a priced line from a catalogue product. The service normalises the arithmetic. */
function lineFromProduct(product: Product, quantity: number, discountPercent: number, currency: string): Omit<QuoteLineItem, 'id'> {
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    description: product.description,
    quantity,
    unitPrice: { amount: product.basePrice.amount, currency },
    listPrice: { amount: product.basePrice.amount, currency },
    discountPercent,
    discountAmount: { amount: 0, currency },
    unitOfMeasure: product.unitOfMeasure,
    billing: product.billingPeriod ?? 'one_time',
    subtotal: { amount: 0, currency },
    netTotal: { amount: 0, currency },
    isOptional: false,
    isRecurring: (product.billingPeriod ?? 'one_time') !== 'one_time',
    sortOrder: 0,
    priceSource: 'product_default',
  };
}

export function QuoteDetail() {
  const services = useServices();
  const navigate = useNavigate();
  const { quoteId } = useParams<{ quoteId: string }>();

  const quote = useAsync(() => services.quotes.get(quoteId ?? ''), [quoteId], { skip: !quoteId });
  const products = useList(() => services.products.list({ pageSize: 200 }), []);
  const [addOpen, setAddOpen] = React.useState(false);
  const [rejectStep, setRejectStep] = React.useState<QuoteApprovalStep | null>(null);
  const [declineOpen, setDeclineOpen] = React.useState(false);

  const record = quote.data;

  const mutate = {
    onSuccess: () => quote.reload(),
  };

  const submit = useMutation(() => services.quotes.submitForApproval(quoteId ?? ''), { successMessage: 'Sent for approval.', ...mutate });
  const send = useMutation(() => services.quotes.markSent(quoteId ?? ''), { successMessage: 'Marked as sent.', simulated: true, ...mutate });
  const accept = useMutation(() => services.quotes.accept(quoteId ?? ''), { successMessage: 'Quote marked accepted.', ...mutate });
  const revise = useMutation(() => services.quotes.revise(quoteId ?? ''), { successMessage: 'Revision created.', onSuccess: (clone) => navigate(`/app/quotes/${clone.id}`) });
  const convertOrder = useMutation(() => services.quotes.convertToOrder(quoteId ?? ''), { successMessage: 'Order created from this quote.', onSuccess: (result) => navigate(`/app/orders/${result.order.id}`) });
  const convertContract = useMutation((term: number) => services.quotes.convertToContract(quoteId ?? '', term), { successMessage: 'Contract drafted from this quote.', ...mutate });
  const removeLine = useMutation((itemId: string) => services.quotes.removeLineItem(quoteId ?? '', itemId), { successMessage: 'Line removed.', ...mutate });
  const approveStep = useMutation(
    (input: { stepId: string; decision: 'approved' | 'rejected'; comment?: string }) =>
      services.quotes.decideApproval(quoteId ?? '', input.stepId, input.decision, input.comment),
    { successMessage: 'Approval recorded.', ...mutate },
  );
  const decline = useMutation((reason: string) => services.quotes.decline(quoteId ?? '', reason), { successMessage: 'Quote declined.', ...mutate });

  if (quote.loading) return <ListSkeleton rows={12} columns={3} />;
  if (quote.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This quote could not be found</h2>
            <p className="text-xs text-muted">{quote.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/quotes">Back to quotes</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const pendingStep = record.approvalSteps.find((step) => step.status === 'pending');
  const canSubmit = ['draft', 'revised'].includes(record.status);
  const canSend = ['draft', 'approved', 'revised'].includes(record.status);
  const canAccept = ['sent', 'viewed', 'approved'].includes(record.status);
  const canDecline = ['sent', 'viewed', 'pending_approval', 'approved'].includes(record.status);
  const canConvert = record.status === 'accepted' || (record.status === 'approved' && !pendingStep);

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/quotes', label: 'Quotes' }}
          title={record.name}
          reference={record.reference}
          subtitle={`${record.accountName}${record.dealName ? ` · ${record.dealName}` : ''}`}
          badges={
            <>
              <StatusBadge status={record.status} />
              {record.version > 1 ? <Badge variant="outline" size="sm">Version {record.version}</Badge> : null}
              {record.approvalState === 'pending' ? <Badge variant="warning" size="sm">Approval pending</Badge> : null}
            </>
          }
          facts={[
            { label: 'Total', value: formatMoney(record.totals.grandTotal.amount, record.currency) },
            { label: 'Valid until', value: formatDate(record.validUntil) },
            { label: 'Term', value: `${record.contractTermMonths} months` },
            { label: 'Billing', value: record.billingFrequency.replace(/_/g, ' ') },
            { label: 'Owner', value: record.ownerName },
          ]}
          actions={
            <>
              {canSubmit ? (
                <Button variant="primary" size="sm" loading={submit.pending} onClick={() => void submit.run(undefined)} leadingIcon={<Send className="size-3.5" />}>
                  Submit for approval
                </Button>
              ) : null}
              {canSend ? (
                <Button variant="secondary" size="sm" loading={send.pending} onClick={() => void send.run(undefined)}>
                  Mark as sent
                </Button>
              ) : null}
              {canAccept ? (
                <Button variant="secondary" size="sm" loading={accept.pending} onClick={() => void accept.run(undefined)} leadingIcon={<CheckCircle2 className="size-3.5" />}>
                  Mark accepted
                </Button>
              ) : null}
              {canDecline ? (
                <Button variant="secondary" size="sm" onClick={() => setDeclineOpen(true)} leadingIcon={<XCircle className="size-3.5" />}>
                  Decline
                </Button>
              ) : null}
              {canConvert ? (
                <Button variant="primary" size="sm" loading={convertOrder.pending} onClick={() => void convertOrder.run(undefined)}>
                  Convert to order
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" loading={revise.pending} onClick={() => void revise.run(undefined)} leadingIcon={<GitBranch className="size-3.5" />}>
                Revise
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {record.status === 'pending_approval' ? (
          <Alert tone="warning" title="This quote is waiting on approval">
            {pendingStep
              ? `${pendingStep.name} is outstanding.${pendingStep.thresholdNote ? ` ${pendingStep.thresholdNote}` : ''} Nothing is sent to the customer until every step is approved.`
              : 'Approval is recorded as pending.'}
          </Alert>
        ) : null}

        {record.orderId ? (
          <Alert tone="success" title="An order has been created from this quote">
            <Link className="underline" to={`/app/orders/${record.orderId}`}>
              Open the order
            </Link>
          </Alert>
        ) : null}

        <Tabs defaultValue="lines">
          <TabsList>
            <TabsTrigger value="lines">Line items ({record.lineItems.length})</TabsTrigger>
            <TabsTrigger value="approval">Approval ({record.approvalSteps.length})</TabsTrigger>
            <TabsTrigger value="history">History ({record.previousVersionIds.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="lines" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                    <FileText className="size-4 text-subtle" aria-hidden />
                    Line items
                  </h2>
                  <Button variant="secondary" size="sm" leadingIcon={<Plus className="size-3.5" />} onClick={() => setAddOpen(true)} disabled={!['draft', 'revised', 'pending_approval'].includes(record.status)}>
                    Add line
                  </Button>
                </div>

                {record.lineItems.length === 0 ? (
                  <p className="px-4 py-10 text-center text-xs text-muted">
                    No lines yet. Add one from the catalogue to start building this quote.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <caption className="sr-only">Quote line items</caption>
                      <thead>
                        <tr>
                          {['Product', 'Qty', 'Unit price', 'Discount', 'Net', ''].map((heading, index) => (
                            <th
                              key={heading || index}
                              scope="col"
                              className={cn(
                                'border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted',
                                index === 1 || index === 2 || index === 3 || index === 4 ? 'text-end' : 'text-start',
                              )}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {record.lineItems.map((line) => (
                          <QuoteLineRow
                            key={`${line.id}-${line.quantity}-${line.discountPercent}`}
                            quoteId={record.id}
                            line={line}
                            currency={record.currency}
                            editable={['draft', 'revised', 'pending_approval'].includes(record.status)}
                            onChanged={() => quote.reload()}
                            onRemove={() => void removeLine.run(line.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <div className="space-y-5">
                <TotalsPanel
                  quoteId={record.id}
                  totals={record.totals}
                  currency={record.currency}
                  editable={['draft', 'revised', 'pending_approval'].includes(record.status)}
                  onChanged={() => quote.reload()}
                />

                <Card className="p-4">
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Delivery &amp; signature</h2>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted">Delivery state</dt>
                      <dd className="font-medium text-fg">{record.deliveryState.replace(/_/g, ' ')}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted">Sent</dt>
                      <dd className="font-medium text-fg">{record.sentAt ? formatDate(record.sentAt, 'relative') : 'Not sent'}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <DemoNotice tone="neutral">
                      Sending, viewing and e-signature are modelled as workflow states. Nothing is emailed and no signature
                      is captured.
                    </DemoNotice>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="approval" className="pt-4">
            <ApprovalPanel
              steps={record.approvalSteps}
              onApprove={(step) => void approveStep.run({ stepId: step.id, decision: 'approved' })}
              onReject={(step) => setRejectStep(step)}
              pending={approveStep.pending}
            />
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <RevisionHistory quote={record} />
          </TabsContent>
        </Tabs>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Draft a subscription from this quote</h2>
          <p className="mt-1 text-xs text-muted">
            Creates a draft contract that references this quote. No real e-signature or legal document is produced.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[12, 24, 36].map((term) => (
              <Button key={term} variant="secondary" size="sm" loading={convertContract.pending} disabled={!canConvert} onClick={() => void convertContract.run(term)}>
                {term}-month contract
              </Button>
            ))}
            {!canConvert ? <span className="text-2xs text-faint">Available once the quote is accepted or fully approved.</span> : null}
          </div>
          {record.contractId ? (
            <p className="mt-2 text-2xs text-muted">A contract already references this quote.</p>
          ) : null}
        </Card>
      </div>

      <AddLineDialog open={addOpen} onOpenChange={setAddOpen} quoteId={record.id} products={products.items} currency={record.currency} onAdded={() => quote.reload()} />

      <Dialog open={rejectStep !== null} onOpenChange={(open) => !open && setRejectStep(null)}>
        <DialogContent
          title="Reject this approval step"
          description="The quote returns to a revised state. The comment is recorded against the step."
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejectStep(null)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit" form="reject-step-form" loading={approveStep.pending}>
                Reject step
              </Button>
            </>
          }
        >
          <form
            id="reject-step-form"
            onSubmit={(event) => {
              event.preventDefault();
              const comment = String(new FormData(event.currentTarget).get('comment') ?? '').trim();
              if (!comment) {
                notify.warning('Add a reason so the requester knows what to change.');
                return;
              }
              if (rejectStep) void approveStep.run({ stepId: rejectStep.id, decision: 'rejected', comment }).then(() => setRejectStep(null));
            }}
          >
            <Field label="Reason" htmlFor="reject-comment" required>
              <Textarea id="reject-comment" name="comment" rows={3} placeholder="What needs to change before this can be approved?" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent
          title="Decline this quote"
          description="Records that the customer declined and why. The quote is kept for reporting."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit" form="decline-quote-form" loading={decline.pending}>
                Decline quote
              </Button>
            </>
          }
        >
          <form
            id="decline-quote-form"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
              if (!reason) {
                notify.warning('Add a reason.');
                return;
              }
              void decline.run(reason).then(() => setDeclineOpen(false));
            }}
          >
            <Field label="Reason" htmlFor="decline-reason" required>
              <Textarea id="decline-reason" name="reason" rows={3} placeholder="Price, timing, competitor, no decision…" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------------- line row */

function QuoteLineRow({
  quoteId,
  line,
  currency,
  editable,
  onChanged,
  onRemove,
}: {
  quoteId: string;
  line: QuoteLineItem;
  currency: string;
  editable: boolean;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const services = useServices();
  const [quantity, setQuantity] = React.useState(String(line.quantity));
  const [discount, setDiscount] = React.useState(String(line.discountPercent));

  // No syncing effect: the parent keys this row by the server values, so a change that comes
  // back from the service remounts the row with fresh inputs rather than writing state in an
  // effect, which would cause a cascading render.

  const update = useMutation(
    (patch: { quantity?: number; discountPercent?: number }) => services.quotes.updateLineItem(quoteId, line.id, patch),
    { onSuccess: onChanged },
  );

  const commit = () => {
    const nextQuantity = Number(quantity);
    const nextDiscount = Number(discount);
    const next = {
      quantity: Number.isFinite(nextQuantity) && nextQuantity > 0 ? nextQuantity : line.quantity,
      discountPercent: Number.isFinite(nextDiscount) ? Math.min(100, Math.max(0, nextDiscount)) : line.discountPercent,
    };
    if (next.quantity === line.quantity && next.discountPercent === line.discountPercent) return;
    void update.run(next);
  };

  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className="px-3 py-2">
        <p className="font-medium text-fg">{line.productName}</p>
        <p className="mt-0.5 font-mono text-[0.625rem] text-faint">
          {line.sku} · {line.billing.replace(/_/g, ' ')}
          {line.priceSource === 'product_default' ? ' · catalogue price' : ''}
        </p>
      </td>
      <td className="px-3 py-2 text-end">
        <Input
          aria-label={`Quantity for ${line.productName}`}
          inputMode="numeric"
          className="ms-auto h-7 w-16 text-end"
          value={quantity}
          disabled={!editable}
          onChange={(event) => setQuantity(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
        />
      </td>
      <td className="px-3 py-2 text-end tabular-nums text-muted">{formatMoney(line.unitPrice.amount, currency)}</td>
      <td className="px-3 py-2 text-end">
        <div className="flex items-center justify-end gap-1">
          <Input
            aria-label={`Discount percent for ${line.productName}`}
            inputMode="numeric"
            className="h-7 w-14 text-end"
            value={discount}
            disabled={!editable}
            onChange={(event) => setDiscount(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => event.key === 'Enter' && commit()}
          />
          <span className="text-2xs text-faint">%</span>
        </div>
        {line.discountPercent > 10 ? <p className="mt-0.5 text-[0.625rem] text-warning-fg">Above 10% — needs approval</p> : null}
      </td>
      <td className="px-3 py-2 text-end font-medium tabular-nums text-fg">{formatMoney(line.netTotal.amount, currency)}</td>
      <td className="px-3 py-2 text-end">
        <Button variant="ghost" size="xs" aria-label={`Remove ${line.productName}`} onClick={onRemove} disabled={!editable}>
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------ totals panel */

function TotalsRow({ label, value, emphasis, muted }: { label: string; value: string; emphasis?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <dt className={cn('text-xs', muted ? 'text-faint' : 'text-muted')}>{label}</dt>
      <dd className={cn('tabular-nums', emphasis ? 'text-sm font-semibold text-fg' : 'text-xs font-medium text-fg')}>{value}</dd>
    </div>
  );
}

function TotalsPanel({
  quoteId,
  totals,
  currency,
  editable,
  onChanged,
}: {
  quoteId: string;
  totals: QuoteTotals;
  currency: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const services = useServices();
  const [discount, setDiscount] = React.useState(String(totals.orderDiscountPercent));
  const [reason, setReason] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const apply = useMutation(
    (input: { percent: number; reason: string }) => services.quotes.applyOrderDiscount(quoteId, input.percent, input.reason),
    { successMessage: 'Order discount applied.', onSuccess: () => { setOpen(false); setReason(''); onChanged(); } },
  );

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold tracking-tight text-fg">Totals</h2>
      <dl className="mt-3 divide-y divide-[var(--border-subtle)]">
        <TotalsRow label="Subtotal" value={formatMoney(totals.subtotal.amount, currency)} />
        <TotalsRow label="Line discounts" value={`−${formatMoney(totals.lineDiscountTotal.amount, currency)}`} muted />
        {totals.orderDiscountAmount.amount > 0 ? (
          <TotalsRow label={`Order discount (${totals.orderDiscountPercent}%)`} value={`−${formatMoney(totals.orderDiscountAmount.amount, currency)}`} muted />
        ) : null}
        <TotalsRow label="Net subtotal" value={formatMoney(totals.netSubtotal.amount, currency)} />
        <TotalsRow label="Tax" value={formatMoney(totals.taxTotal.amount, currency)} muted />
      </dl>
      <p className="mt-1 text-[0.625rem] leading-relaxed text-faint">{totals.taxNote}</p>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border-subtle pt-2">
        <span className="text-xs font-medium text-fg">Grand total</span>
        <span className="text-base font-semibold tabular-nums tracking-tight text-fg">{formatMoney(totals.grandTotal.amount, currency)}</span>
      </div>

      <div className="mt-4 rounded-lg border border-border-subtle bg-inset p-3">
        <p className="text-2xs font-semibold uppercase tracking-wide text-faint">Recurring summary</p>
        <dl className="mt-2 space-y-1">
          <TotalsRow label="One-off" value={formatMoney(totals.recurring.oneTime.amount, currency)} muted />
          <TotalsRow label="Monthly" value={formatMoney(totals.recurring.monthly.amount, currency)} muted />
          <TotalsRow label="Annual" value={formatMoney(totals.recurring.annual.amount, currency)} muted />
          <TotalsRow label="Annualised" value={formatMoney(totals.recurring.annualisedTotal.amount, currency)} />
        </dl>
      </div>

      {totals.margin ? (
        <div className="mt-3 rounded-lg border border-border-subtle p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-2xs font-semibold uppercase tracking-wide text-faint">Margin</span>
            <span className={cn('text-xs font-semibold tabular-nums', totals.margin.marginPercent < 20 ? 'text-warning-fg' : 'text-success-fg')}>
              {totals.margin.marginPercent}%
            </span>
          </div>
          <p className="mt-1 text-[0.625rem] text-muted">
            {formatMoney(totals.margin.marginAmount.amount, currency)} over {formatMoney(totals.margin.costTotal.amount, currency)} cost. Cost is
            taken from the product record where present, otherwise estimated at 40% of list.
          </p>
        </div>
      ) : null}

      <div className="mt-4 border-t border-border-subtle pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Order discount</span>
          <span className="text-xs font-medium tabular-nums text-fg">{totals.orderDiscountPercent}%</span>
        </div>
        <Button variant="secondary" size="sm" className="mt-2 w-full" disabled={!editable} onClick={() => setOpen(true)}>
          Apply order discount
        </Button>
        <p className="mt-2 text-[0.625rem] leading-relaxed text-faint">
          A discount above 20% adds a finance approval step when the quote is submitted. Thresholds are shown so the
          requester knows the consequence; nothing is enforced by a pricing authority in this build.
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Apply an order discount"
          description="Applies to the net subtotal after line discounts. Recorded against the quote with your reason."
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="order-discount-form" loading={apply.pending}>
                Apply discount
              </Button>
            </>
          }
        >
          <form
            id="order-discount-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const percent = Number(discount);
              if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
                notify.warning('Enter a discount between 0 and 100.');
                return;
              }
              void apply.run({ percent, reason });
            }}
          >
            <Field label="Discount percent" htmlFor="order-discount" required hint="0 to 100">
              <Input id="order-discount" inputMode="numeric" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </Field>
            <Field label="Reason" htmlFor="order-discount-reason" hint="Recorded on the quote's internal notes">
              <Input id="order-discount-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Volume commitment, competitive bid…" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------------------------------------------------- approval panel */

function ApprovalPanel({
  steps,
  onApprove,
  onReject,
  pending,
}: {
  steps: QuoteApprovalStep[];
  onApprove: (step: QuoteApprovalStep) => void;
  onReject: (step: QuoteApprovalStep) => void;
  pending: boolean;
}) {
  if (steps.length === 0) {
    return (
      <Card className="p-8 text-center text-xs text-muted">
        No approval is required yet. Submitting the quote builds the approval chain from the discounts on it.
      </Card>
    );
  }

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.id}>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-inset text-[0.625rem] font-semibold text-muted">{step.order}</span>
                {step.name}
              </p>
              <p className="mt-1 text-xs text-muted">{step.approverName}</p>
              {step.thresholdNote ? <p className="mt-0.5 text-[0.6875rem] text-faint">{step.thresholdNote}</p> : null}
              {step.comment ? <p className="mt-1 text-[0.6875rem] text-muted">“{step.comment}”</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={step.status} size="sm" />
              {step.status === 'pending' ? (
                <>
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => onApprove(step)}>
                    Approve
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => onReject(step)}>
                    Reject
                  </Button>
                </>
              ) : step.decidedAt ? (
                <span className="text-[0.6875rem] text-faint">{formatDate(step.decidedAt, 'relative')}</span>
              ) : null}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------- revision history */

function RevisionHistory({ quote }: { quote: Quote }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold tracking-tight text-fg">Revision history</h2>
      {quote.previousVersionIds.length === 0 ? (
        <p className="mt-3 text-xs text-muted">This is the first version of the quote. Revising it creates a new version and keeps this one.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {quote.previousVersionIds.map((id, index) => (
            <li key={id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted">Version {index + 1}</span>
              <Link to={`/app/quotes/${id}`} className="font-mono text-faint hover:text-link hover:underline">
                {id}
              </Link>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-fg">Version {quote.version} (current)</span>
            <span className="font-mono text-faint">{quote.reference}</span>
          </li>
        </ol>
      )}
      <div className="mt-3">
        <DemoNotice tone="neutral">
          Older versions remain readable. Re-pointing downstream records to a new version is a backend operation this
          demonstration does not perform.
        </DemoNotice>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ add line dialog */

function AddLineDialog({
  open,
  onOpenChange,
  quoteId,
  products,
  currency,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  products: Product[];
  currency: string;
  onAdded: () => void;
}) {
  const services = useServices();
  const [productId, setProductId] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [discount, setDiscount] = React.useState('0');

  const add = useMutation(
    (line: Omit<QuoteLineItem, 'id'>) => services.quotes.addLineItem(quoteId, line),
    { successMessage: 'Line added.', onSuccess: () => { onOpenChange(false); setProductId(''); setQuantity('1'); setDiscount('0'); onAdded(); } },
  );

  const product = products.find((candidate) => candidate.id === productId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add a catalogue line"
        description="The line is priced from the product's catalogue price. Volume tiers and promotions are not applied automatically in this build."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="add-line-form" loading={add.pending} disabled={!product}>
              Add line
            </Button>
          </>
        }
      >
        <form
          id="add-line-form"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!product) {
              notify.warning('Choose a product first.');
              return;
            }
            const qty = Math.max(1, Number(quantity) || 1);
            const pct = Math.min(100, Math.max(0, Number(discount) || 0));
            void add.run(lineFromProduct(product, qty, pct, currency));
          }}
        >
          <Field label="Product" htmlFor="add-line-product" required>
            <Select
              id="add-line-product"
              value={productId}
              onValueChange={setProductId}
              placeholder="Choose a product"
              searchable
              options={products.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.name} — ${formatMoney(candidate.basePrice.amount, candidate.basePrice.currency)}`,
                description: candidate.sku,
              }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" htmlFor="add-line-quantity" required>
              <Input id="add-line-quantity" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
            <Field label="Discount percent" htmlFor="add-line-discount" hint="Above 10% needs approval">
              <Input id="add-line-discount" inputMode="numeric" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </Field>
          </div>
          {product ? (
            <p className="text-xs text-muted">
              Estimated line net: <span className="font-medium text-fg">{formatMoney(product.basePrice.amount * (Number(quantity) || 0) * (1 - (Number(discount) || 0) / 100), currency)}</span>
              <span className="ms-1 text-faint">before the service re-prices it.</span>
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------- form */

const quoteFormSchema = z.object({
  name: z.string().min(2, 'Give the quote a name'),
  accountId: z.string().min(1, 'Choose an account'),
  dealId: z.string().optional(),
  issueDate: z.string().min(1, 'Set an issue date'),
  validUntil: z.string().min(1, 'Set a validity date'),
  contractTermMonths: z.string().min(1).refine((value) => Number(value) > 0, 'Enter a term of at least one month'),
  billingFrequency: z.enum(['one_time', 'monthly', 'quarterly', 'annual']),
  currency: z.string().min(3, 'Enter a currency code'),
  notes: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

export function QuoteForm() {
  const services = useServices();
  const navigate = useNavigate();
  const { quoteId } = useParams<{ quoteId: string }>();
  const isEdit = Boolean(quoteId);

  const existing = useAsync(() => services.quotes.get(quoteId ?? ''), [quoteId], { skip: !isEdit });
  const accounts = useList(() => services.accounts.list({ pageSize: 200 }), []);
  const deals = useList(() => services.deals.list({ pageSize: 200 }), []);

  const [defaults] = React.useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const inThirty = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    return { today, inThirty };
  });

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: { issueDate: defaults.today, validUntil: defaults.inThirty, contractTermMonths: '12', billingFrequency: 'annual', currency: 'USD' },
    mode: 'onBlur',
  });
  const accountId = useWatch({ control: form.control, name: 'accountId' });
  const dealId = useWatch({ control: form.control, name: 'dealId' });
  const billingFrequency = useWatch({ control: form.control, name: 'billingFrequency' });

  React.useEffect(() => {
    if (!existing.data) return;
    form.reset({
      name: existing.data.name,
      accountId: existing.data.accountId,
      dealId: existing.data.dealId,
      issueDate: existing.data.issueDate,
      validUntil: existing.data.validUntil,
      contractTermMonths: String(existing.data.contractTermMonths),
      billingFrequency: existing.data.billingFrequency,
      currency: existing.data.currency,
      notes: existing.data.notes,
    });
  }, [existing.data, form]);

  const account = accounts.items.find((candidate) => candidate.id === accountId);
  const dealOptions = React.useMemo(
    () => deals.items.filter((deal: Deal) => !accountId || deal.accountId === accountId).map((deal: Deal) => ({ value: deal.id, label: deal.name })),
    [deals.items, accountId],
  );

  const save = useMutation(
    async (values: QuoteFormValues) => {
      const organizationId = existing.data?.organizationId ?? accounts.items[0]?.organizationId;
      if (!organizationId) throw new Error('No organization is available.');
      const deal = deals.items.find((candidate: Deal) => candidate.id === values.dealId);
      const payload = {
        organizationId,
        name: values.name,
        accountId: values.accountId,
        accountName: account?.name ?? values.accountId,
        dealId: values.dealId || undefined,
        dealName: deal?.name,
        ownerId: existing.data?.ownerId ?? 'user-1',
        ownerName: existing.data?.ownerName ?? 'You',
        status: 'draft' as const,
        version: 1,
        previousVersionIds: [],
        currency: values.currency.toUpperCase(),
        issueDate: values.issueDate,
        validUntil: values.validUntil,
        contractTermMonths: Number(values.contractTermMonths),
        billingFrequency: values.billingFrequency,
        lineItems: existing.data?.lineItems ?? [],
        totals: existing.data?.totals ?? {
          currency: values.currency.toUpperCase(),
          subtotal: { amount: 0, currency: values.currency.toUpperCase() },
          lineDiscountTotal: { amount: 0, currency: values.currency.toUpperCase() },
          orderDiscountPercent: 0,
          orderDiscountAmount: { amount: 0, currency: values.currency.toUpperCase() },
          netSubtotal: { amount: 0, currency: values.currency.toUpperCase() },
          taxTotal: { amount: 0, currency: values.currency.toUpperCase() },
          taxNote: 'Tax is not calculated by the platform. Any rate shown is recorded for reference only.',
          grandTotal: { amount: 0, currency: values.currency.toUpperCase() },
          recurring: {
            oneTime: { amount: 0, currency: values.currency.toUpperCase() },
            monthly: { amount: 0, currency: values.currency.toUpperCase() },
            quarterly: { amount: 0, currency: values.currency.toUpperCase() },
            annual: { amount: 0, currency: values.currency.toUpperCase() },
            annualisedTotal: { amount: 0, currency: values.currency.toUpperCase() },
          },
        },
        approvalState: existing.data?.approvalState ?? ('not_required' as const),
        approvalSteps: existing.data?.approvalSteps ?? [],
        deliveryState: existing.data?.deliveryState ?? ('draft' as const),
        notes: values.notes,
        tags: existing.data?.tags ?? [],
      };
      if (isEdit && quoteId) return services.quotes.update(quoteId, payload as never);
      return services.quotes.create(payload as never);
    },
    {
      successMessage: isEdit ? 'Quote updated.' : 'Quote created. Add line items next.',
      onSuccess: (quote) => navigate(`/app/quotes/${quote.id}`),
    },
  );

  return (
    <div className="pb-10">
      <PageHeader
        title={isEdit ? 'Edit quote' : 'New quote'}
        description="The header captures who the quote is for and its terms. Line items are added on the quote itself, where totals update as you work."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Quotes', to: '/app/quotes' }, { label: isEdit ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button variant="primary" size="sm" loading={save.pending} type="submit" form="quote-form">
              {isEdit ? 'Save changes' : 'Create quote'}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={isEdit && quoteId ? `/app/quotes/${quoteId}` : '/app/quotes'}>Cancel</Link>
            </Button>
          </>
        }
      />

      <form id="quote-form" className="space-y-5 p-4 sm:p-6" noValidate onSubmit={form.handleSubmit((values) => void save.run(values))}>
        {save.error ? <Alert tone="danger" title="The quote was not saved">{save.error}</Alert> : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Customer</h2>
            <div className="mt-4 space-y-4">
              <Field label="Quote name" htmlFor="name" required error={form.formState.errors.name?.message}>
                <Input id="name" {...form.register('name')} placeholder="Annual platform subscription" />
              </Field>
              <Field label="Account" htmlFor="accountId" required error={form.formState.errors.accountId?.message}>
                <Select
                  id="accountId"
                  value={accountId}
                  onValueChange={(value) => {
                    form.setValue('accountId', value, { shouldValidate: true });
                    form.setValue('dealId', '');
                  }}
                  placeholder="Choose an account"
                  searchable
                  options={accounts.items.map((candidate: Account) => ({ value: candidate.id, label: candidate.name }))}
                />
              </Field>
              <Field label="Deal" htmlFor="dealId" hint="Optional — links the quote to an opportunity">
                <Select
                  id="dealId"
                  value={dealId ?? ''}
                  onValueChange={(value) => form.setValue('dealId', value)}
                  placeholder={accountId ? 'Choose a deal' : 'Choose an account first'}
                  searchable
                  options={dealOptions}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Terms</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Issue date" htmlFor="issueDate" required error={form.formState.errors.issueDate?.message}>
                <Input id="issueDate" type="date" {...form.register('issueDate')} />
              </Field>
              <Field label="Valid until" htmlFor="validUntil" required error={form.formState.errors.validUntil?.message}>
                <Input id="validUntil" type="date" {...form.register('validUntil')} />
              </Field>
              <Field label="Contract term (months)" htmlFor="contractTermMonths" required error={form.formState.errors.contractTermMonths?.message}>
                <Input id="contractTermMonths" inputMode="numeric" {...form.register('contractTermMonths')} />
              </Field>
              <Field label="Currency" htmlFor="currency" required error={form.formState.errors.currency?.message}>
                <Input id="currency" {...form.register('currency')} maxLength={3} className="uppercase" />
              </Field>
              <Field label="Billing frequency" htmlFor="billingFrequency" required className="sm:col-span-2">
                <Select
                  id="billingFrequency"
                  value={billingFrequency}
                  onValueChange={(value) => form.setValue('billingFrequency', value as QuoteFormValues['billingFrequency'], { shouldValidate: true })}
                  options={['one_time', 'monthly', 'quarterly', 'annual'].map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
                />
              </Field>
              <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
                <Textarea id="notes" rows={3} {...form.register('notes')} placeholder="Context the customer will see on the quote." />
              </Field>
            </div>
          </Card>
        </div>

        <Alert tone="neutral" title="Totals appear after the header is saved">
          A quote's totals are derived from its line items by the pricing engine, so they are computed on the quote itself
          once you add catalogue lines.
        </Alert>
      </form>
    </div>
  );
}
