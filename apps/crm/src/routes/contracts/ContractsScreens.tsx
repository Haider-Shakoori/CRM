'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FilePenLine, RefreshCw, XCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Contract } from '@crm/shared-types';
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
 * Contract screens.
 *
 * A contract is the commercial memory of an account, so the file is deliberate about
 * three things:
 *
 *   - **The lifecycle is explicit.** Renewal creates a linked successor record and closes
 *     the old one; termination and amendment refuse to run on a closed contract. Nothing
 *     moves status behind the user's back.
 *   - **Derived figures stay derived.** Annualised value and days-to-expiry are recomputed
 *     by the service on every amendment, so the header cannot contradict the terms.
 *   - **Signature and documents are labelled.** Every document is a placeholder entry and
 *     the signature state is simulated; the screen says so next to the figures.
 */

const LIFECYCLE_STATUSES = ['draft', 'in_review', 'awaiting_signature', 'active', 'expiring_soon', 'expired', 'terminated', 'renewed', 'cancelled'] as const;
const OPEN_STATUSES: readonly Contract['status'][] = ['draft', 'in_review', 'awaiting_signature', 'active', 'expiring_soon'];

/* ---------------------------------------------------------------------- list */

export default function ContractsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [expiringWithin, setExpiringWithin] = React.useState('all');

  const query = React.useMemo(() => {
    const clauses: Array<Record<string, unknown>> = [];
    if (statusFilter !== 'all') clauses.push({ field: 'status', operator: 'eq', value: statusFilter });
    if (expiringWithin !== 'all') {
      clauses.push({ field: 'status', operator: 'in', value: ['active', 'expiring_soon'] });
      clauses.push({ field: 'daysUntilExpiry', operator: 'gte', value: 0 });
      clauses.push({ field: 'daysUntilExpiry', operator: 'lte', value: Number(expiringWithin) });
    }
    return {
      page,
      pageSize: 50,
      q: search || undefined,
      sort: [{ field: 'endDate', direction: 'asc' as const }],
      filter: clauses.length > 0 ? ({ id: 'contract-filters', conjunction: 'and' as const, clauses: clauses as never }) : undefined,
    };
  }, [page, search, statusFilter, expiringWithin]);

  const contracts = useList(() => services.contracts.list(query), [JSON.stringify(query)]);
  const summary = useAsync(() => services.products.revenueSummary(), []);

  const columns = React.useMemo<ColumnDef<Contract, unknown>[]>(
    () => [
      {
        id: 'reference',
        header: 'Contract',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/contracts/${row.original.id}`} className="block truncate font-mono text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.reference}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.accountName}</span>
          </div>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'endDate',
        header: 'Ends',
        accessorKey: 'endDate',
        cell: ({ row }) => (
          <div>
            <span className="block text-[0.6875rem] text-muted">{formatDate(row.original.endDate)}</span>
            {row.original.daysUntilExpiry >= 0 && OPEN_STATUSES.includes(row.original.status) ? (
              <span className="block text-[0.625rem] text-faint">in {formatNumber(row.original.daysUntilExpiry)} days</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'value',
        header: 'Value',
        accessorFn: (contract) => contract.contractValue.amount,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <div className="text-end">
            <span className="block text-xs font-medium tabular-nums text-fg">{formatMoney(row.original.contractValue.amount, row.original.currency)}</span>
            <span className="block text-[0.625rem] tabular-nums text-faint">{formatMoney(row.original.annualisedValue.amount, row.original.currency, true)}/yr</span>
          </div>
        ),
      },
      {
        id: 'autoRenew',
        header: 'Auto-renew',
        accessorKey: 'autoRenew',
        cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.autoRenew ? `Yes · ${formatNumber(row.original.noticePeriodDays)}d notice` : 'No'}</span>,
      },
      { id: 'owner', header: 'Owner', accessorKey: 'ownerName', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{row.original.ownerName}</span> },
    ],
    [],
  );

  const chips = [
    ...(statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, tone: 'brand' as const, onRemove: () => setStatusFilter('all') }] : []),
    ...(expiringWithin !== 'all' ? [{ id: 'expiring', label: `Expiring within ${expiringWithin} days`, tone: 'warning' as const, onRemove: () => setExpiringWithin('all') }] : []),
  ];

  return (
    <div className="pb-8">
      <PageHeader
        title="Contracts"
        description="Subscription and service agreements with an explicit renewal, amendment and termination lifecycle."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Contracts' }]}
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search reference, title or account"
            resultCount={contracts.meta ? `${contracts.meta.total.toLocaleString()} contracts` : undefined}
            chips={chips}
            onClearFilters={() => {
              setStatusFilter('all');
              setExpiringWithin('all');
              setSearch('');
            }}
            actions={
              <>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  options={['all', ...LIFECYCLE_STATUSES].map((value) => ({ value, label: value === 'all' ? 'All statuses' : value.replace(/_/g, ' ') }))}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Filter by status"
                />
                <Select
                  value={expiringWithin}
                  onValueChange={(value) => {
                    setExpiringWithin(value);
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'Any end date' },
                    { value: '30', label: 'Expiring in 30 days' },
                    { value: '60', label: 'Expiring in 60 days' },
                    { value: '90', label: 'Expiring in 90 days' },
                  ]}
                  selectSize="sm"
                  className="w-[11rem]"
                  aria-label="Filter by expiry window"
                />
              </>
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Active contracts" value={formatNumber(summary.data?.contracts.activeCount ?? 0)} tone="violet" />
          <MiniStat label="Active value" value={formatMoney(summary.data?.contracts.totalValue.amount ?? 0, summary.data?.currency ?? 'USD', true)} tone="blue" />
          <MiniStat
            label="Expiring in 90 days"
            value={formatNumber(summary.data?.contracts.expiringIn90Days ?? 0)}
            tone={summary.data && summary.data.contracts.expiringIn90Days > 0 ? 'amber' : 'teal'}
          />
          <MiniStat label="Auto-renew" value={`${summary.data?.contracts.autoRenewPercent ?? 0}%`} tone="teal" />
        </div>

        {contracts.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={contracts.items}
            onRowClick={(contract) => navigate(`/app/contracts/${contract.id}`)}
            getRowId={(contract) => contract.id}
            footer={contracts.meta ? <Pagination page={contracts.meta.page} pageSize={contracts.meta.pageSize} total={contracts.meta.total} onPageChange={setPage} /> : null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function ContractDetail() {
  const services = useServices();
  const { contractId } = useParams<{ contractId: string }>();

  const contract = useAsync(() => services.contracts.get(contractId ?? ''), [contractId], { skip: !contractId });
  const record = contract.data;

  const [renewOpen, setRenewOpen] = React.useState(false);
  const [amendOpen, setAmendOpen] = React.useState(false);
  const [terminateOpen, setTerminateOpen] = React.useState(false);
  const [amendAutoRenew, setAmendAutoRenew] = React.useState<'yes' | 'no'>('yes');
  const [seededFor, setSeededFor] = React.useState<string>();
  if (record && seededFor !== record.id) {
    setSeededFor(record.id);
    setAmendAutoRenew(record.autoRenew ? 'yes' : 'no');
  }

  const renew = useMutation((input: { termMonths: number; startDate: string; value: number }) => services.contracts.renew(contractId ?? '', input), {
    successMessage: 'Renewal contract created.',
    onSuccess: () => {
      setRenewOpen(false);
      contract.reload();
    },
  });
  const amend = useMutation((patch: Record<string, unknown>) => services.contracts.amendment(contractId ?? '', patch), {
    successMessage: 'Amendment recorded.',
    onSuccess: () => {
      setAmendOpen(false);
      contract.reload();
    },
  });
  const terminate = useMutation((reason: string) => services.contracts.terminate(contractId ?? '', reason), {
    successMessage: 'Contract terminated.',
    onSuccess: () => {
      setTerminateOpen(false);
      contract.reload();
    },
  });

  if (contract.loading) return <ListSkeleton rows={12} columns={3} />;
  if (contract.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This contract could not be found</h2>
            <p className="text-xs text-muted">{contract.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/contracts">Back to contracts</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const lifecycleOpen = OPEN_STATUSES.includes(record.status);
  const amendments = record.documents.filter((document) => document.kind === 'amendment');
  const sizeLabel = (bytes: number) => (bytes === 0 ? 'not stored' : bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1_000)} KB`);

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/contracts', label: 'Contracts' }}
          title={record.reference}
          subtitle={record.title}
          badges={
            <>
              <StatusBadge status={record.status} />
              <Badge variant="outline" size="sm">
                Signature: {record.signatureState.replace(/_/g, ' ')}
              </Badge>
            </>
          }
          facts={[
            { label: 'Value', value: formatMoney(record.contractValue.amount, record.currency) },
            { label: 'Annualised', value: formatMoney(record.annualisedValue.amount, record.currency) },
            { label: 'Term', value: `${formatNumber(record.termMonths)} months` },
            { label: 'Ends', value: formatDate(record.endDate) },
            { label: 'Owner', value: record.ownerName },
          ]}
          actions={
            <>
              {lifecycleOpen ? (
                <Button variant="primary" size="sm" loading={renew.pending} onClick={() => setRenewOpen(true)} leadingIcon={<RefreshCw className="size-3.5" />}>
                  Renew
                </Button>
              ) : null}
              {lifecycleOpen ? (
                <Button variant="secondary" size="sm" onClick={() => setAmendOpen(true)} leadingIcon={<FilePenLine className="size-3.5" />}>
                  Amend
                </Button>
              ) : null}
              {lifecycleOpen ? (
                <Button variant="ghost" size="sm" onClick={() => setTerminateOpen(true)} leadingIcon={<XCircle className="size-3.5" />}>
                  Terminate
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {record.status === 'terminated' ? (
          <Alert tone="danger" title="This contract was terminated">
            {record.terminationReason ?? 'No reason was recorded.'}
            {record.terminatedAt ? ` Terminated ${formatDate(record.terminatedAt)}.` : ''}
          </Alert>
        ) : null}

        {record.status === 'renewed' && record.renewalId ? (
          <Alert tone="info" title="This contract was renewed">
            <Link className="underline" to={`/app/contracts/${record.renewalId}`}>
              Open the renewal contract
            </Link>
          </Alert>
        ) : null}

        {record.status === 'expiring_soon' ? (
          <Alert tone="warning" title={`Expiring in ${formatNumber(record.daysUntilExpiry)} days`}>
            The notice period is {formatNumber(record.noticePeriodDays)} days.{' '}
            {record.autoRenew ? 'The contract renews automatically unless notice is given.' : 'The contract lapses unless it is renewed.'}
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Terms</h2>
              <PropertyList
                className="mt-3"
                columns={2}
                items={[
                  { label: 'Account', value: <Link className="text-link hover:underline" to={`/app/accounts/${record.accountId}`}>{record.accountName}</Link> },
                  { label: 'Type', value: record.type.replace(/_/g, ' ') },
                  { label: 'Start', value: formatDate(record.startDate) },
                  { label: 'End', value: formatDate(record.endDate) },
                  { label: 'Notice period', value: `${formatNumber(record.noticePeriodDays)} days` },
                  { label: 'Auto-renew', value: record.autoRenew ? 'Yes' : 'No' },
                  { label: 'Billing frequency', value: record.billingFrequency.replace(/_/g, ' ') },
                  { label: 'Payment terms', value: record.paymentTerms.replace(/_/g, ' ') },
                ]}
              />
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Documents and amendment history</h2>
              </div>
              {record.documents.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">No documents are recorded against this contract.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {record.documents.map((document) => (
                    <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-fg">{document.name}</p>
                        <p className="mt-0.5 text-[0.625rem] text-faint">
                          {document.kind.replace(/_/g, ' ')} · v{document.version} · {sizeLabel(document.sizeBytes)}
                        </p>
                      </div>
                      <Badge variant="outline" size="sm">
                        placeholder
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-border-subtle px-4 py-3">
                <DemoNotice tone="neutral">
                  Document entries are metadata placeholders — nothing is stored, previewed or downloaded. Signature states
                  are simulated; no e-signature provider is connected.
                </DemoNotice>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">Commercials</h2>
              <dl className="mt-3 divide-y divide-[var(--border-subtle)]">
                {[
                  { label: 'Contract value', value: formatMoney(record.contractValue.amount, record.currency) },
                  { label: 'Annualised value', value: formatMoney(record.annualisedValue.amount, record.currency) },
                  { label: 'Term', value: `${formatNumber(record.termMonths)} months` },
                  {
                    label: 'Days to expiry',
                    value: record.daysUntilExpiry >= 0 ? formatNumber(record.daysUntilExpiry) : `Expired ${formatNumber(Math.abs(record.daysUntilExpiry))} days ago`,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
                    <dt className="text-xs text-muted">{row.label}</dt>
                    <dd className="text-xs font-medium tabular-nums text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold tracking-tight text-fg">History</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Amendments</dt>
                  <dd className="font-medium text-fg">{formatNumber(amendments.length)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Previous contract</dt>
                  <dd className="font-medium text-fg">
                    {record.previousContractId ? (
                      <Link className="text-link hover:underline" to={`/app/contracts/${record.previousContractId}`}>
                        Open
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Renewal contract</dt>
                  <dd className="font-medium text-fg">
                    {record.renewalId ? (
                      <Link className="text-link hover:underline" to={`/app/contracts/${record.renewalId}`}>
                        Open
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {record.quoteId ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">Source quote</dt>
                    <dd className="font-medium text-fg">
                      <Link className="text-link hover:underline" to={`/app/quotes/${record.quoteId}`}>
                        Open
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {record.orderId ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">Source order</dt>
                    <dd className="font-medium text-fg">
                      <Link className="text-link hover:underline" to={`/app/orders/${record.orderId}`}>
                        Open
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent
          title="Renew this contract"
          description="Creates a linked renewal contract and marks this one as renewed. The renewal starts unsigned."
          footer={
            <>
              <Button variant="secondary" onClick={() => setRenewOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="contract-renew-form" loading={renew.pending}>
                Create renewal
              </Button>
            </>
          }
        >
          <form
            id="contract-renew-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const termMonths = Number(data.get('termMonths'));
              const value = Number(data.get('value'));
              const startDate = String(data.get('startDate') ?? '');
              if (!Number.isFinite(termMonths) || termMonths < 1) {
                notify.warning('Enter a term of one month or more.');
                return;
              }
              if (!Number.isFinite(value) || value < 0) {
                notify.warning('Enter a renewal value of zero or more.');
                return;
              }
              if (!startDate) {
                notify.warning('Choose a start date.');
                return;
              }
              void renew.run({ termMonths, startDate, value });
            }}
          >
            <Field label="Term (months)" htmlFor="renew-term" required>
              <Input id="renew-term" name="termMonths" inputMode="numeric" defaultValue={String(record.termMonths)} />
            </Field>
            <Field label="Start date" htmlFor="renew-start" required hint={`Current term ends ${formatDate(record.endDate)}`}>
              <Input id="renew-start" name="startDate" type="date" defaultValue={record.endDate} />
            </Field>
            <Field label="Renewal value" htmlFor="renew-value" required hint={`Current value ${formatMoney(record.contractValue.amount, record.currency)}`}>
              <Input id="renew-value" name="value" inputMode="decimal" defaultValue={String(record.contractValue.amount)} />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent
          title="Amend this contract"
          description="Records an amendment entry and re-derives the annualised value and expiry countdown. Only changed fields are applied."
          footer={
            <>
              <Button variant="secondary" onClick={() => setAmendOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="contract-amend-form" loading={amend.pending}>
                Record amendment
              </Button>
            </>
          }
        >
          <form
            id="contract-amend-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const patch: Record<string, unknown> = {};
              const value = Number(data.get('value'));
              const termMonths = Number(data.get('termMonths'));
              const endDate = String(data.get('endDate') ?? '');
              const noticePeriodDays = Number(data.get('noticePeriodDays'));
              if (Number.isFinite(value) && value >= 0 && value !== record.contractValue.amount) {
                patch.contractValue = { amount: Math.round(value), currency: record.currency };
              }
              if (Number.isFinite(termMonths) && termMonths >= 1 && termMonths !== record.termMonths) patch.termMonths = Math.round(termMonths);
              if (endDate && endDate !== record.endDate) patch.endDate = endDate;
              if (Number.isFinite(noticePeriodDays) && noticePeriodDays >= 0 && noticePeriodDays !== record.noticePeriodDays) {
                patch.noticePeriodDays = Math.round(noticePeriodDays);
              }
              if ((amendAutoRenew === 'yes') !== record.autoRenew) patch.autoRenew = amendAutoRenew === 'yes';
              if (Object.keys(patch).length === 0) {
                notify.warning('Change at least one field to record an amendment.');
                return;
              }
              void amend.run(patch);
            }}
          >
            <Field label="Contract value" htmlFor="amend-value">
              <Input id="amend-value" name="value" inputMode="decimal" defaultValue={String(record.contractValue.amount)} />
            </Field>
            <Field label="Term (months)" htmlFor="amend-term">
              <Input id="amend-term" name="termMonths" inputMode="numeric" defaultValue={String(record.termMonths)} />
            </Field>
            <Field label="End date" htmlFor="amend-end">
              <Input id="amend-end" name="endDate" type="date" defaultValue={record.endDate} />
            </Field>
            <Field label="Notice period (days)" htmlFor="amend-notice">
              <Input id="amend-notice" name="noticePeriodDays" inputMode="numeric" defaultValue={String(record.noticePeriodDays)} />
            </Field>
            <Field label="Auto-renew" htmlFor="amend-autorenew">
              <Select
                id="amend-autorenew"
                value={amendAutoRenew}
                onValueChange={(value) => setAmendAutoRenew(value === 'yes' ? 'yes' : 'no')}
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
              />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent
          title="Terminate this contract"
          description="Ends the contract early and records why. A terminated contract cannot be renewed or amended."
          footer={
            <>
              <Button variant="secondary" onClick={() => setTerminateOpen(false)}>
                Keep contract
              </Button>
              <Button variant="danger" type="submit" form="contract-terminate-form" loading={terminate.pending}>
                Terminate contract
              </Button>
            </>
          }
        >
          <form
            id="contract-terminate-form"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
              if (!reason) {
                notify.warning('Record why the contract is being terminated.');
                return;
              }
              void terminate.run(reason);
            }}
          >
            <Field label="Reason" htmlFor="terminate-reason" required>
              <Textarea id="terminate-reason" name="reason" rows={3} placeholder="Customer consolidated vendors, breached terms, duplicate contract…" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
