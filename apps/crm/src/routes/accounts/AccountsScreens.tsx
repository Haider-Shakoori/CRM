'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Building2,
  FileText,
  Mail,
  Phone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { Account, AccountHealth, AccountType, Tone } from '@crm/shared-types';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DemoNotice,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  MultiSelect,
  Pagination,
  Progress,
  Select,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TonePill,
  Tooltip,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatMoney } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Account screens, including Customer 360.
 *
 * Customer 360 exists to answer one question in one screen: "what is the state of this
 * relationship?" It therefore combines records that live in four different services — the
 * account, its deals, its tickets, its documents and its people — rather than making the
 * reader open five tabs in five modules.
 *
 * The hierarchy tab is a list rather than a canvas for the same reason it is on contacts:
 * rolled-up revenue has to be readable and reachable by keyboard, and a link is easier to
 * follow than a node.
 */

/* ------------------------------------------------------------------ helpers */

const HEALTH_TONE: Record<AccountHealth, Tone> = {
  thriving: 'green',
  healthy: 'green',
  watch: 'amber',
  at_risk: 'red',
  critical: 'red',
  unknown: 'neutral',
};

const HEALTH_LABEL: Record<AccountHealth, string> = {
  thriving: 'Thriving',
  healthy: 'Healthy',
  watch: 'Watch',
  at_risk: 'At risk',
  critical: 'Critical',
  unknown: 'Not scored',
};

/**
 * Literal class strings per health band.
 *
 * Tailwind scans source for complete class names, so a class assembled at runtime
 * (`bg-${tone}-fg`) is never emitted. Every visual state is therefore written out.
 */
const HEALTH_DOT: Record<AccountHealth, string> = {
  thriving: 'bg-tone-green',
  healthy: 'bg-tone-green',
  watch: 'bg-tone-amber',
  at_risk: 'bg-tone-red',
  critical: 'bg-tone-red',
  unknown: 'bg-tone-slate',
};

const ACCOUNT_TYPE_TONE: Record<AccountType, Tone> = {
  customer: 'green',
  prospect: 'blue',
  partner: 'violet',
  reseller: 'teal',
  vendor: 'slate',
  competitor: 'red',
  other: 'neutral',
};

const SENTIMENT_TONE: Record<string, Tone> = {
  advocate: 'green',
  neutral: 'slate',
  skeptic: 'amber',
  unknown: 'neutral',
};

const TIERS = ['enterprise', 'mid_market', 'smb', 'startup'] as const;
const RATINGS = ['strategic', 'high', 'medium', 'low'] as const;
const ACCOUNT_TYPES: AccountType[] = ['customer', 'prospect', 'partner', 'reseller', 'vendor', 'competitor', 'other'];
const COMPANY_SIZES = ['solo', '2-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+'] as const;

const NEEDS_ATTENTION: AccountHealth[] = ['watch', 'at_risk', 'critical'];

function healthTone(account: Account): Tone {
  return HEALTH_TONE[account.health];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function primaryPhone(account: Account): string | undefined {
  return (account.phones.find((phone) => phone.isPrimary) ?? account.phones[0])?.value;
}

function primaryEmail(account: Account): string | undefined {
  return (account.emails.find((email) => email.isPrimary) ?? account.emails[0])?.value;
}

/**
 * Every account beneath `id`, at any depth.
 *
 * Two things matter here. The parent index is built once rather than re-scanning the whole
 * list for every node, and a `seen` set makes the walk safe against a cycle in the hierarchy
 * data. Seed and imported hierarchies can contain a parent loop, and an unguarded walk turns
 * that into an infinite loop that terminates only when the array length overflows — which is
 * exactly the crash a user would see instead of an account page.
 */
function descendantsOf(id: string, all: Account[]): Account[] {
  const byParent = new Map<string, Account[]>();
  for (const account of all) {
    if (!account.parentAccountId) continue;
    const siblings = byParent.get(account.parentAccountId);
    if (siblings) siblings.push(account);
    else byParent.set(account.parentAccountId, [account]);
  }

  const result: Account[] = [];
  const seen = new Set<string>([id]);
  const queue = [...(byParent.get(id) ?? [])];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    result.push(node);
    queue.push(...(byParent.get(node.id) ?? []));
  }
  return result;
}

function rolledUpRevenue(account: Account, all: Account[]): number {
  const descendants = descendantsOf(account.id, all);
  return [account, ...descendants].reduce((sum, entry) => sum + (entry.totalRevenueWon?.amount ?? 0), 0);
}

/* -------------------------------------------------------------------- list */

const ACCOUNT_VIEWS = [
  { id: 'all', name: 'All accounts', description: 'Every account in the organization.' },
  { id: 'customers', name: 'Customers', description: 'Accounts with a customer relationship.' },
  { id: 'key', name: 'Key accounts', description: 'Accounts flagged for account-based selling.' },
  { id: 'attention', name: 'Needs attention', description: 'Accounts whose health is watch, at risk or critical.' },
  { id: 'renewals', name: 'Renewing in 90 days', description: 'Accounts whose contract renews within the next quarter.' },
];

export default function AccountsList() {
  const services = useServices();
  const navigate = useNavigate();

  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [healthFilter, setHealthFilter] = React.useState<string[]>([]);
  const [typeFilter, setTypeFilter] = React.useState<string[]>([]);
  const [tierFilter, setTierFilter] = React.useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = React.useState<string[]>([]);
  const [view, setView] = React.useState<'all' | 'customers' | 'key' | 'attention' | 'renewals'>('all');
  const [now] = React.useState(() => Date.now());

  const users = useList(() => services.users.list({ pageSize: 100 }), []);

  const query = React.useMemo(() => {
    const clauses: Array<{ field: string; operator: 'eq' | 'in'; value: unknown }> = [];
    if (healthFilter.length > 0) clauses.push({ field: 'health', operator: 'in', value: healthFilter });
    if (typeFilter.length > 0) clauses.push({ field: 'type', operator: 'in', value: typeFilter });
    if (tierFilter.length > 0) clauses.push({ field: 'tier', operator: 'in', value: tierFilter });
    if (ownerFilter.length > 0) clauses.push({ field: 'ownerId', operator: 'in', value: ownerFilter });
    if (view === 'customers') clauses.push({ field: 'type', operator: 'eq', value: 'customer' });
    if (view === 'key') clauses.push({ field: 'isKeyAccount', operator: 'eq', value: true });
    return {
      page: view === 'all' ? page : 1,
      pageSize: view === 'all' ? pageSize : 500,
      q: search || undefined,
      sort: [{ field: 'name', direction: 'asc' as const }],
      filter: clauses.length > 0 ? { id: 'accounts', conjunction: 'and' as const, clauses: clauses as never } : undefined,
    };
  }, [page, pageSize, search, healthFilter, typeFilter, tierFilter, ownerFilter, view]);

  const accounts = useList(() => services.accounts.list(query), [JSON.stringify(query)]);
  const allAccounts = useList(() => services.accounts.list({ pageSize: 500 }), []);

  const filtered = React.useMemo(() => {
    if (view === 'attention') {
      return accounts.items.filter((account) => NEEDS_ATTENTION.includes(account.health));
    }
    if (view === 'renewals') {
      return accounts.items.filter((account) => {
        if (!account.renewalDate) return false;
        const days = (new Date(account.renewalDate).getTime() - now) / 86_400_000;
        return days >= 0 && days <= 90;
      });
    }
    return accounts.items;
  }, [accounts.items, view, now]);

  const summary = React.useMemo(() => {
    const rows = allAccounts.items;
    return {
      total: rows.length,
      key: rows.filter((account) => account.isKeyAccount).length,
      attention: rows.filter((account) => NEEDS_ATTENTION.includes(account.health)).length,
      renewals: rows.filter((account) => {
        if (!account.renewalDate) return false;
        const days = (new Date(account.renewalDate).getTime() - now) / 86_400_000;
        return days >= 0 && days <= 90;
      }).length,
    };
  }, [allAccounts.items, now]);

  const assignOwner = useMutation(
    (input: { ids: string[]; ownerId: string }) => services.accounts.update(input.ids[0] ?? '', { ownerId: input.ownerId } as never),
    {
      successMessage: 'Owner updated.',
      onSuccess: () => {
        accounts.reload();
        setSelected([]);
      },
    },
  );

  const clearFilters = React.useCallback(() => {
    setHealthFilter([]);
    setTypeFilter([]);
    setTierFilter([]);
    setOwnerFilter([]);
    setSearch('');
    setView('all');
    setPage(1);
  }, []);

  const columns = React.useMemo<ColumnDef<Account, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Account',
        accessorKey: 'name',
        cell: ({ row }) => {
          const account = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar name={account.name} size="sm" tone="violet" />
              <div className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <Link
                    to={`/app/accounts/${account.id}`}
                    className="truncate text-xs font-medium text-fg hover:text-link hover:underline"
                  >
                    {account.name}
                  </Link>
                  {account.isKeyAccount ? (
                    <Tooltip content="Flagged as a key account">
                      <span className="text-tone-amber" aria-label="Key account">
                        <Sparkles className="size-3" aria-hidden />
                      </span>
                    </Tooltip>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[0.6875rem] text-subtle">
                  {account.parentAccountName ? `${account.parentAccountName} · ` : ''}
                  {account.industryLabel ?? 'Industry not set'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        cell: ({ row }) => (
          <TonePill tone={ACCOUNT_TYPE_TONE[row.original.type]}>{row.original.type.replace(/_/g, ' ')}</TonePill>
        ),
      },
      {
        id: 'health',
        header: 'Health',
        accessorFn: (account) => account.healthScore ?? 0,
        cell: ({ row }) => {
          const account = row.original;
          return (
            <span className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', HEALTH_DOT[account.health])} aria-hidden />
              <span className="text-[0.6875rem] font-medium text-fg">{HEALTH_LABEL[account.health]}</span>
              {account.healthScore !== undefined ? (
                <span className="text-[0.6875rem] tabular-nums text-muted">{account.healthScore}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'tier',
        header: 'Tier',
        accessorKey: 'tier',
        cell: ({ row }) => (row.original.tier ? <Badge variant="outline" size="sm">{row.original.tier.replace(/_/g, ' ')}</Badge> : <span className="text-subtle">—</span>),
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorKey: 'ownerId',
        cell: ({ row }) => {
          const owner = (users.items ?? []).find((user) => user.id === row.original.ownerId);
          return <span className="truncate text-[0.6875rem] text-muted">{owner?.displayName ?? 'Unassigned'}</span>;
        },
      },
      {
        id: 'open',
        header: 'Open',
        accessorFn: (account) => account.openDealCount + account.openTicketCount,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 text-[0.6875rem] tabular-nums text-muted">
            <span title="Open deals">{row.original.openDealCount} deals</span>
            <span className="text-faint" aria-hidden>·</span>
            <span title="Contacts">{row.original.contactCount} contacts</span>
          </span>
        ),
      },
      {
        id: 'revenue',
        header: 'Won to date',
        accessorFn: (account) => account.totalRevenueWon?.amount ?? 0,
        cell: ({ row }) => {
          const money = row.original.totalRevenueWon;
          return (
            <span className="text-xs font-medium tabular-nums text-fg">
              {money ? formatMoney(money.amount, money.currency) : '—'}
            </span>
          );
        },
      },
      {
        id: 'renewal',
        header: 'Renewal',
        accessorKey: 'renewalDate',
        cell: ({ row }) => (
          <span className="text-[0.6875rem] text-muted">{formatDate(row.original.renewalDate, 'short')}</span>
        ),
      },
    ],
    [users.items],
  );

  const resultCount = `${filtered.length} ${filtered.length === 1 ? 'account' : 'accounts'}`;
  const activeView = ACCOUNT_VIEWS.find((entry) => entry.id === view) ?? ACCOUNT_VIEWS[0]!;

  return (
    <div className="pb-6">
      <PageHeader
        title="Accounts"
        description="The organizations you sell to and support, with a health score derived from usage, support and relationship signals."
        actions={
          <Button variant="primary" size="sm" asChild>
            <Link to="/app/accounts/new">New account</Link>
          </Button>
        }
      />

      <div className="grid gap-3 border-b border-border-subtle px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <SummaryStat label="Accounts" value={summary.total} hint="In this organization" />
        <SummaryStat label="Key accounts" value={summary.key} hint="Flagged for account-based selling" />
        <SummaryStat
          label="Needs attention"
          value={summary.attention}
          hint="Watch, at risk or critical"
          tone={summary.attention > 0 ? 'warning' : 'neutral'}
        />
        <SummaryStat label="Renewing in 90 days" value={summary.renewals} hint="Contracts up for renewal" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search accounts by name, industry or domain"
        resultCount={resultCount}
        viewNote={activeView.description}
        chips={[
          ...healthFilter.map((health) => ({
            id: `health-${health}`,
            label: `Health: ${health.replace(/_/g, ' ')}`,
            onRemove: () => setHealthFilter((current) => current.filter((entry) => entry !== health)),
          })),
          ...typeFilter.map((type) => ({
            id: `type-${type}`,
            label: `Type: ${type}`,
            onRemove: () => setTypeFilter((current) => current.filter((entry) => entry !== type)),
          })),
          ...tierFilter.map((tier) => ({
            id: `tier-${tier}`,
            label: `Tier: ${tier.replace(/_/g, ' ')}`,
            onRemove: () => setTierFilter((current) => current.filter((entry) => entry !== tier)),
          })),
        ]}
        onClearFilters={healthFilter.length + typeFilter.length + tierFilter.length + ownerFilter.length > 0 ? clearFilters : undefined}
        actions={
          selected.length > 0 ? (
            <span className="text-[0.6875rem] text-muted">
              {selected.length} selected ·{' '}
              <button
                type="button"
                className="text-link hover:underline"
                onClick={() => void assignOwner.run({ ids: selected, ownerId: (users.items ?? [])[0]?.id ?? '' })}
              >
                assign to first owner
              </button>
            </span>
          ) : null
        }
      />

      <div className="border-b border-border-subtle bg-inset/40 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-faint">Saved views</span>
          <ul className="flex flex-wrap items-center gap-1.5">
            {ACCOUNT_VIEWS.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setView(entry.id as typeof view);
                    setPage(1);
                  }}
                  aria-pressed={entry.id === view}
                  title={entry.description}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-2xs transition-colors',
                    entry.id === view
                      ? 'border-brand/40 bg-brand-subtle font-medium text-brand-fg'
                      : 'border-border-subtle bg-inset text-muted hover:border-border-strong hover:text-fg',
                  )}
                >
                  {entry.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="w-40">
              <MultiSelect
                values={healthFilter}
                onChange={(value) => {
                  setHealthFilter(value);
                  setPage(1);
                }}
                placeholder="Health"
                options={(['thriving', 'healthy', 'watch', 'at_risk', 'critical'] as AccountHealth[]).map((health) => ({
                  value: health,
                  label: HEALTH_LABEL[health],
                }))}
              />
            </div>
            <div className="w-40">
              <MultiSelect
                values={typeFilter}
                onChange={(value) => {
                  setTypeFilter(value);
                  setPage(1);
                }}
                placeholder="Type"
                options={ACCOUNT_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </div>
            <div className="w-40">
              <MultiSelect
                values={tierFilter}
                onChange={(value) => {
                  setTierFilter(value);
                  setPage(1);
                }}
                placeholder="Tier"
                options={TIERS.map((tier) => ({ value: tier, label: tier.replace(/_/g, ' ') }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {accounts.loading ? (
          <ListSkeleton rows={10} columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No accounts match these filters"
            body="Accounts are created when a lead converts, when a customer is imported, or by hand."
            hints={[
              'Clear the filters to see every account in the organization',
              'Open an account to see its Customer 360 profile',
              'Health, renewals and committee sentiment are derived from the records below',
            ]}
            action={
              <>
                <Button variant="primary" size="sm" asChild>
                  <Link to="/app/accounts/new">Create an account</Link>
                </Button>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            selectable
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            onRowClick={(account) => navigate(`/app/accounts/${account.id}`)}
            getRowId={(account) => account.id}
            footer={
              view === 'all' && accounts.meta ? (
                <Pagination
                  page={accounts.meta.page}
                  pageSize={accounts.meta.pageSize}
                  total={accounts.meta.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : (
                <p className="px-3 py-2 text-[0.6875rem] text-subtle">
                  {activeView.description} Narrow the view to page through the full directory.
                </p>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint: string;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <Card className="p-3.5">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', tone === 'warning' ? 'text-warning-fg' : 'text-fg')}>{value}</p>
      <p className="mt-0.5 text-[0.625rem] text-subtle">{hint}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ detail */

export function AccountDetail() {
  const services = useServices();
  const { accountId } = useParams<{ accountId: string }>();

  const account = useAsync(() => services.accounts.get(accountId ?? ''), [accountId], { skip: !accountId });
  const health = useAsync(() => services.accounts.healthScore(accountId ?? ''), [accountId], { skip: !accountId });
  const revenue = useAsync(() => services.accounts.revenueSnapshot(accountId ?? ''), [accountId], { skip: !accountId });
  const hierarchy = useAsync(() => services.accounts.hierarchy(), []);
  const allAccounts = useList(() => services.accounts.list({ pageSize: 500 }), []);
  const contacts = useList(() => services.accounts.contacts(accountId ?? '', { pageSize: 50 }), [accountId], { skip: !accountId });
  const deals = useList(() => services.accounts.deals(accountId ?? '', { pageSize: 25 }), [accountId], { skip: !accountId });
  const tickets = useList(() => services.accounts.tickets(accountId ?? '', { pageSize: 25 }), [accountId], { skip: !accountId });
  const timeline = useList(() => services.activities.forRecord('account', accountId ?? '', { pageSize: 25 }), [accountId], { skip: !accountId });
  const documents = useList(() => services.documents.list({ pageSize: 100 }), []);

  const [moveOpen, setMoveOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);

  const addNote = useMutation(
    (body: string) =>
      services.activities.create({
        kind: 'note',
        subject: 'Note added',
        subjects: [{ type: 'account', id: accountId ?? '', label: account.data?.name ?? 'Account' }],
        body,
        status: 'completed',
        priority: 'normal',
        ownerId: account.data?.ownerId ?? '',
        ownerName: 'You',
        visibility: 'team',
        source: 'user',
        organizationId: account.data?.organizationId ?? '',
      } as never),
    {
      successMessage: 'Note added to the account timeline.',
      onSuccess: () => {
        setNoteOpen(false);
        timeline.reload();
      },
    },
  );

  const moveParent = useMutation(
    (newParentId: string | null) => services.accounts.moveAccount(accountId ?? '', newParentId),
    {
      successMessage: 'Hierarchy updated.',
      onSuccess: () => {
        setMoveOpen(false);
        account.reload();
        hierarchy.reload();
        allAccounts.reload();
      },
    },
  );

  if (account.loading) return <ListSkeleton rows={12} columns={3} />;
  if (account.error || !account.data) {
    return (
      <div className="p-6">
        <EmptyState
          title="This account could not be found"
          body={account.error ?? 'It may have been archived or merged into another record.'}
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/accounts">Back to accounts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const record = account.data;
  const descendants = descendantsOf(record.id, allAccounts.items);
  const parent = hierarchy.data?.find((node) => node.id === record.parentAccountId);
  const children = hierarchy.data?.filter((node) => node.parentId === record.id) ?? [];
  const rolled = rolledUpRevenue(record, allAccounts.items);
  const accountDocuments = documents.items.filter((document) =>
    document.associations.some((association) => association.type === 'account' && association.id === record.id),
  );

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Accounts', to: '/app/accounts' }, { label: record.name }]}
        title={record.name}
        description={[record.industryLabel, record.companySize ? `${record.employeeCount ?? record.companySize} people` : undefined]
          .filter(Boolean)
          .join(' · ') || 'No industry or size recorded'}
        backTo={{ to: '/app/accounts', label: 'Accounts' }}
        sample
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(true)}>
              Log a note
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to={`/app/accounts/${record.id}/edit`}>Edit</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {NEEDS_ATTENTION.includes(record.health) ? (
          <Alert
            tone={record.health === 'critical' ? 'danger' : 'warning'}
            title={`${HEALTH_LABEL[record.health]} account`}
          >
            {health.data?.signals.find((signal) => signal.direction === 'negative')?.label ??
              'Review the health signals below before the next customer conversation.'}
          </Alert>
        ) : null}

        <RecordHeader
          title={record.name}
          reference={record.reference}
          subtitle={record.description ?? 'No description recorded.'}
          badges={
            <>
              <TonePill tone={ACCOUNT_TYPE_TONE[record.type]}>{record.type}</TonePill>
              <TonePill tone={healthTone(record)}>{HEALTH_LABEL[record.health]}</TonePill>
              {record.isKeyAccount ? <TonePill tone="amber">Key account</TonePill> : null}
              {record.rating ? <Badge variant="outline" size="sm">{record.rating}</Badge> : null}
            </>
          }
          facts={[
            { label: 'Owner', value: record.ownerId ? record.ownerId : 'Unassigned' },
            { label: 'Tier', value: record.tier?.replace(/_/g, ' ') ?? 'Not set' },
            { label: 'Employees', value: record.employeeCount?.toLocaleString() ?? record.companySize ?? 'Not set' },
            {
              label: 'Annual revenue',
              value: record.annualRevenue ? formatMoney(record.annualRevenue.amount, record.annualRevenue.currency) : 'Not set',
            },
            {
              label: 'Renewal',
              value: record.renewalDate ? formatDate(record.renewalDate, 'short') : 'Not set',
            },
          ]}
          favourite={{ active: false, onToggle: () => notify.info('Favourites', 'Pinning records is not part of this demonstration.') }}
        />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="customer360">Customer 360</TabsTrigger>
            <TabsTrigger value="hierarchy">Hierarchy ({children.length})</TabsTrigger>
            <TabsTrigger value="committee">Buying committee ({record.buyingCommittee?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({accountDocuments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-fg">Relationship health</h2>
                    <p className="mt-0.5 text-2xs text-muted">
                      {health.data ? health.data.modelLabel : 'No health score has been computed yet.'}
                    </p>
                  </div>
                  {health.data ? (
                    <div className="text-end">
                      <p className="text-2xl font-semibold tabular-nums text-fg">{health.data.score}</p>
                      <p
                        className={cn(
                          'flex items-center justify-end gap-1 text-2xs font-medium',
                          health.data.delta >= 0 ? 'text-success-fg' : 'text-danger-fg',
                        )}
                      >
                        {health.data.delta >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                        {health.data.delta >= 0 ? '+' : ''}
                        {health.data.delta} vs last period
                      </p>
                    </div>
                  ) : null}
                </div>

                {health.loading ? (
                  <ListSkeleton rows={4} columns={2} />
                ) : health.data ? (
                  <>
                    <ul className="mt-4 space-y-3">
                      {health.data.components.map((component) => (
                        <li key={component.key}>
                          <div className="flex items-center justify-between gap-2">
                            <Tooltip content={component.rationale}>
                              <span className="text-[0.6875rem] font-medium text-fg underline decoration-dotted decoration-border-strong underline-offset-2">
                                {component.label}
                              </span>
                            </Tooltip>
                            <span className="text-[0.6875rem] tabular-nums text-muted">
                              {component.score}
                              <span className="text-faint"> · weight {Math.round(component.weight * 100)}%</span>
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <Progress
                              value={component.score}
                              size="xs"
                              tone={component.score >= 70 ? 'green' : component.score >= 45 ? 'amber' : 'red'}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>

                    {health.data.signals.length > 0 ? (
                      <div className="mt-4 border-t border-border-subtle pt-3">
                        <h3 className="text-2xs font-semibold uppercase tracking-wide text-faint">Signals</h3>
                        <ul className="mt-2 space-y-1.5">
                          {health.data.signals.map((signal) => (
                            <li key={signal.id} className="flex items-start gap-2 text-[0.6875rem]">
                              <span
                                className={cn(
                                  'mt-1 size-1.5 shrink-0 rounded-full',
                                  signal.direction === 'positive'
                                    ? 'bg-tone-green'
                                    : signal.direction === 'negative'
                                      ? 'bg-tone-red'
                                      : 'bg-tone-slate',
                                )}
                                aria-hidden
                              />
                              <span className="text-muted">
                                {signal.label}
                                {signal.suggestedAction ? (
                                  <span className="mt-0.5 block text-faint">Suggested: {signal.suggestedAction}</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-4 text-xs text-muted">
                    No health score has been computed for this account. Scores appear once usage and support data exist.
                  </p>
                )}
              </Card>

              <Card className="p-4">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Revenue</h2>
                {revenue.loading ? (
                  <ListSkeleton rows={3} columns={2} />
                ) : revenue.data ? (
                  <>
                    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <RevenueStat label="Won to date" money={revenue.data.wonToDate} />
                      <RevenueStat label="Open pipeline" money={revenue.data.openPipeline} />
                      <RevenueStat label="Recurring" money={revenue.data.recurringRevenue} />
                      <RevenueStat label="Average deal" money={revenue.data.averageDealSize} />
                    </dl>

                    <div className="mt-5">
                      <h3 className="text-2xs font-semibold uppercase tracking-wide text-faint">Won and pipeline by year</h3>
                      <div className="mt-2 space-y-2">
                        {revenue.data.byYear.map((year) => {
                          const max = Math.max(...revenue.data!.byYear.map((entry) => Math.max(entry.won, entry.pipeline)), 1);
                          return (
                            <div key={year.year} className="grid grid-cols-[2.5rem_1fr] items-center gap-2">
                              <span className="text-[0.6875rem] tabular-nums text-muted">{year.year}</span>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2 rounded-full bg-tone-green/70"
                                    style={{ width: `${Math.round((year.won / max) * 100)}%` }}
                                    aria-hidden
                                  />
                                  <span className="text-[0.625rem] tabular-nums text-subtle">
                                    won {formatMoney(year.won, revenue.data!.currency)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2 rounded-full bg-tone-violet/50"
                                    style={{ width: `${Math.round((year.pipeline / max) * 100)}%` }}
                                    aria-hidden
                                  />
                                  <span className="text-[0.625rem] tabular-nums text-subtle">
                                    pipeline {formatMoney(year.pipeline, revenue.data!.currency)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {revenue.data.byProduct.length > 0 ? (
                      <div className="mt-5 border-t border-border-subtle pt-3">
                        <h3 className="text-2xs font-semibold uppercase tracking-wide text-faint">Won by product</h3>
                        <ul className="mt-2 space-y-1.5">
                          {revenue.data.byProduct.map((line) => (
                            <li key={`${line.productId}-${line.amount}`} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                              <span className="truncate text-muted">{line.productName}</span>
                              <span className="tabular-nums text-fg">{formatMoney(line.amount, revenue.data!.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-xs text-muted">{revenue.error ?? 'No revenue has been recorded against this account yet.'}</p>
                )}
              </Card>

              <Card className="p-4 lg:col-span-2">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Firmographics</h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <FactItem label="Legal name" value={record.legalName ?? record.name} />
                  <FactItem label="Website" value={record.website ? <a className="text-link hover:underline" href={record.website} target="_blank" rel="noreferrer noopener">{record.website}</a> : 'Not set'} />
                  <FactItem label="Email" value={primaryEmail(record) ?? 'Not set'} />
                  <FactItem label="Phone" value={primaryPhone(record) ?? 'Not set'} />
                  <FactItem label="Founded" value={record.foundedYear?.toString() ?? 'Not set'} />
                  <FactItem label="Registration" value={record.registrationNumber ?? 'Not set'} />
                  <FactItem label="Territory" value={record.territory ?? 'Not set'} />
                  <FactItem label="Contract start" value={formatDate(record.contractStartDate, 'short')} />
                </dl>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="customer360" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <Card>
                <div className="border-b border-border-subtle px-4 py-3">
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Everything that has happened</h2>
                  <p className="mt-0.5 text-2xs text-muted">
                    Emails, calls, meetings and notes recorded against the account, its contacts and its deals share one timeline.
                  </p>
                </div>
                {timeline.loading ? (
                  <ListSkeleton rows={6} columns={2} />
                ) : timeline.items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted">Nothing has been logged against this account yet.</p>
                ) : (
                  <ol className="divide-y divide-[var(--border-subtle)]">
                    {timeline.items.map((activity) => (
                      <li key={activity.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 text-subtle" aria-hidden>
                          {activity.kind === 'email' ? (
                            <Mail className="size-3.5" />
                          ) : activity.kind === 'call' ? (
                            <Phone className="size-3.5" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-fg">{activity.subject}</span>
                            <Badge variant="outline" size="sm">{activity.kind.replace(/_/g, ' ')}</Badge>
                          </div>
                          {activity.body ? <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted">{activity.body}</p> : null}
                          <p className="mt-1 text-[0.625rem] text-faint">
                            {activity.ownerName} · {formatDate(activity.createdAt, 'relative')}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              <div className="space-y-5">
                <Card>
                  <div className="border-b border-border-subtle px-4 py-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                      <Users className="size-4 text-subtle" aria-hidden />
                      People ({contacts.items.length})
                    </h2>
                  </div>
                  {contacts.loading ? (
                    <ListSkeleton rows={3} columns={2} />
                  ) : contacts.items.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-muted">No contacts are attached to this account.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {contacts.items.slice(0, 8).map((contact) => (
                        <li key={contact.id} className="flex items-center gap-3 px-4 py-2.5">
                          <Avatar name={contact.displayName} size="xs" tone="teal" />
                          <div className="min-w-0 flex-1">
                            <Link to={`/app/contacts/${contact.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                              {contact.displayName}
                            </Link>
                            <span className="text-[0.625rem] text-faint">{contact.jobTitle ?? 'Title not set'}</span>
                          </div>
                          <TonePill tone={contact.lifecycleStage === 'customer' ? 'green' : 'slate'}>
                            {contact.lifecycleStage.replace(/_/g, ' ')}
                          </TonePill>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <div className="border-b border-border-subtle px-4 py-3">
                    <h2 className="text-sm font-semibold tracking-tight text-fg">Open deals ({deals.items.filter((deal) => deal.status === 'open').length})</h2>
                  </div>
                  {deals.loading ? (
                    <ListSkeleton rows={3} columns={2} />
                  ) : deals.items.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-muted">No deals are associated with this account.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {deals.items.slice(0, 6).map((deal) => (
                        <li key={deal.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <Link to={`/app/deals/${deal.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                              {deal.name}
                            </Link>
                            <span className="text-[0.625rem] text-faint">{deal.reference}</span>
                          </div>
                          <StatusBadge status={deal.status} size="sm" />
                          <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(deal.amount.amount, deal.amount.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <div className="border-b border-border-subtle px-4 py-3">
                    <h2 className="text-sm font-semibold tracking-tight text-fg">Support ({tickets.items.length})</h2>
                  </div>
                  {tickets.loading ? (
                    <ListSkeleton rows={3} columns={2} />
                  ) : tickets.items.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-muted">No tickets have been raised by this account.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {tickets.items.slice(0, 6).map((ticket) => (
                        <li key={ticket.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-fg">{ticket.subject}</p>
                            <span className="text-[0.625rem] text-faint">{ticket.reference}</span>
                          </div>
                          <StatusBadge status={ticket.slaState ?? ticket.status} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hierarchy" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <Card>
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-fg">Account hierarchy</h2>
                    <p className="mt-0.5 text-2xs text-muted">
                      Parent, siblings and subsidiaries. Rolled-up revenue includes every account beneath this one.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setMoveOpen(true)}>
                    Move in hierarchy
                  </Button>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <h3 className="text-2xs font-semibold uppercase tracking-wide text-faint">Parent</h3>
                    {parent ? (
                      <Link to={`/app/accounts/${parent.id}`} className="mt-2 flex items-center gap-2 text-xs font-medium text-fg hover:text-link hover:underline">
                        <Building2 className="size-3.5 text-subtle" aria-hidden />
                        {parent.name}
                      </Link>
                    ) : (
                      <p className="mt-2 text-xs text-muted">This is a top-level account.</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-2xs font-semibold uppercase tracking-wide text-faint">
                      Subsidiaries ({children.length})
                    </h3>
                    {children.length === 0 ? (
                      <p className="mt-2 text-xs text-muted">No accounts sit beneath this one.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
                        {children.map((child) => (
                          <li key={child.id} className="flex items-center gap-3 py-2">
                            <span
                              className={cn('size-2 rounded-full', child.health ? HEALTH_DOT[child.health as AccountHealth] : 'bg-tone-slate')}
                              aria-hidden
                            />
                            <Link to={`/app/accounts/${child.id}`} className="min-w-0 flex-1 truncate text-xs font-medium text-fg hover:text-link hover:underline">
                              {child.name}
                            </Link>
                            <span className="text-[0.625rem] text-faint">depth {child.depth}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Rolled-up revenue</h2>
                <p className="mt-0.5 text-2xs text-muted">This account plus {descendants.length} {descendants.length === 1 ? 'subsidiary' : 'subsidiaries'}.</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums text-fg">
                  {formatMoney(rolled, record.totalRevenueWon?.currency ?? 'USD')}
                </p>
                <dl className="mt-4 space-y-2 text-xs">
                  <FactItem label="This account" value={formatMoney(record.totalRevenueWon?.amount ?? 0, record.totalRevenueWon?.currency ?? 'USD')} />
                  <FactItem
                    label="From subsidiaries"
                    value={formatMoney(rolled - (record.totalRevenueWon?.amount ?? 0), record.totalRevenueWon?.currency ?? 'USD')}
                  />
                  <FactItem label="Open deals (group)" value={String(record.openDealCount + descendants.reduce((sum, entry) => sum + entry.openDealCount, 0))} />
                </dl>
                <DemoNotice tone="neutral">
                  Rolled-up revenue sums each account's won-to-date total. When a hierarchy service exists, one query will replace this
                  client-side roll-up.
                </DemoNotice>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="committee" className="pt-4">
            <Card>
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-fg">Buying committee</h2>
                <p className="mt-0.5 text-2xs text-muted">
                  Who influences decisions here, and which way they lean. Sentiment is stored on the account rather than inferred.
                </p>
              </div>
              {!record.buyingCommittee || record.buyingCommittee.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">
                  No buying committee has been recorded. Add committee members from the account edit form.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {record.buyingCommittee.map((member) => (
                    <li key={member.contactId} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={member.name} size="sm" tone="violet" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/app/contacts/${member.contactId}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                          {member.name}
                        </Link>
                        <span className="text-[0.625rem] text-faint">{member.role ?? 'Role not set'}</span>
                      </div>
                      <TonePill tone={SENTIMENT_TONE[member.sentiment] ?? 'neutral'}>{member.sentiment}</TonePill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="pt-4">
            <Card>
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-fg">Documents</h2>
                  <p className="mt-0.5 text-2xs text-muted">Files associated with this account.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => notify.info('Documents', 'Uploading files is part of the documents module, which this build does not yet include.')}>
                  Associate a document
                </Button>
              </div>
              {documents.loading ? (
                <ListSkeleton rows={4} columns={3} />
              ) : accountDocuments.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">
                  No documents are associated with this account. Documents store metadata only in this demonstration — no file
                  content is ever uploaded.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {accountDocuments.map((document) => (
                    <li key={document.id} className="flex items-center gap-3 px-4 py-3">
                      <FileText className="size-4 text-subtle" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-fg">{document.name}</p>
                        <span className="text-[0.625rem] text-faint">
                          {document.folderPath} · {formatBytes(document.sizeBytes)} · v{document.version} · updated{' '}
                          {formatDate(document.updatedAt, 'relative')}
                        </span>
                      </div>
                      <Badge variant="outline" size="sm">{document.extension}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent
          title="Log a note"
          description={`Adds a plain note to ${record.name}'s timeline.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setNoteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="account-note-form" loading={addNote.pending}>
                Add note
              </Button>
            </>
          }
        >
          <form
            id="account-note-form"
            onSubmit={(event) => {
              event.preventDefault();
              const body = new FormData(event.currentTarget).get('body');
              if (typeof body !== 'string' || !body.trim()) {
                notify.warning('Write something first.');
                return;
              }
              void addNote.run(body.trim());
            }}
          >
            <Field label="Note" htmlFor="account-note" required>
              <Textarea id="account-note" name="body" rows={4} placeholder="What happened, and what is the next step?" />
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent
          title="Move in hierarchy"
          description="Choose a new parent account, or detach this account to make it top-level."
          footer={
            <>
              <Button variant="secondary" onClick={() => setMoveOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="move-parent-form" loading={moveParent.pending}>
                Move account
              </Button>
            </>
          }
        >
          <form
            id="move-parent-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('parent');
              if (typeof value !== 'string') return;
              void moveParent.run(value === '' ? null : value);
            }}
          >
            {moveParent.error ? <Alert tone="danger" title="The move was rejected">{moveParent.error}</Alert> : null}
            <Field label="Parent account" htmlFor="move-parent" hint="Accounts that would create a cycle are rejected.">
              <Select
                id="move-parent"
                name="parent"
                searchable
                placeholder="No parent (top-level)"
                options={[
                  { value: '', label: 'No parent (top-level)' },
                  ...allAccounts.items
                    .filter((candidate) => candidate.id !== record.id && !descendants.some((child) => child.id === candidate.id))
                    .map((candidate) => ({ value: candidate.id, label: candidate.name })),
                ]}
              />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RevenueStat({ label, money }: { label: string; money: { amount: number; currency: string } }) {
  return (
    <div>
      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-fg">{formatMoney(money.amount, money.currency)}</dd>
    </div>
  );
}

function FactItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-xs text-fg">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------- form */

const accountSchema = z.object({
  name: z.string().min(1, 'An account name is required.'),
  legalName: z.string(),
  type: z.string(),
  industry: z.string(),
  companySize: z.string(),
  employeeCount: z.string().refine((value) => value === '' || /^\d+$/.test(value), 'Enter a whole number or leave blank.'),
  website: z.string().refine((value) => value === '' || /^https?:\/\/.+/.test(value), 'Enter a full URL beginning with http:// or https://'),
  phone: z.string(),
  tier: z.string(),
  rating: z.string(),
  ownerId: z.string(),
  parentAccountId: z.string(),
  description: z.string(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export function AccountForm() {
  const services = useServices();
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();
  const isEdit = Boolean(accountId);

  const account = useAsync(() => services.accounts.get(accountId ?? ''), [accountId], { skip: !isEdit });
  const users = useList(() => services.users.list({ pageSize: 100 }), []);
  const accounts = useList(() => services.accounts.list({ pageSize: 500 }), []);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      legalName: '',
      type: 'prospect',
      industry: '',
      companySize: '',
      employeeCount: '',
      website: '',
      phone: '',
      tier: '',
      rating: '',
      ownerId: '',
      parentAccountId: '',
      description: '',
    },
  });

  const currentType = useWatch({ control, name: 'type' });
  const currentSize = useWatch({ control, name: 'companySize' });
  const currentTier = useWatch({ control, name: 'tier' });
  const currentRating = useWatch({ control, name: 'rating' });
  const currentOwner = useWatch({ control, name: 'ownerId' });
  const currentParent = useWatch({ control, name: 'parentAccountId' });

  React.useEffect(() => {
    if (!isEdit || !account.data) return;
    const record = account.data;
    reset({
      name: record.name,
      legalName: record.legalName ?? '',
      type: record.type,
      industry: record.industryLabel ?? '',
      companySize: record.companySize ?? '',
      employeeCount: record.employeeCount ? String(record.employeeCount) : '',
      website: record.website ?? '',
      phone: primaryPhone(record) ?? '',
      tier: record.tier ?? '',
      rating: record.rating ?? '',
      ownerId: record.ownerId ?? '',
      parentAccountId: record.parentAccountId ?? '',
      description: record.description ?? '',
    });
  }, [account.data, isEdit, reset]);

  const save = useMutation(
    (values: AccountFormValues) => {
      const payload = {
        name: values.name.trim(),
        legalName: values.legalName.trim() || undefined,
        type: values.type as AccountType,
        industryLabel: values.industry.trim() || undefined,
        companySize: values.companySize || undefined,
        employeeCount: values.employeeCount ? Number(values.employeeCount) : undefined,
        website: values.website.trim() || undefined,
        tier: (values.tier || undefined) as Account['tier'],
        rating: (values.rating || undefined) as Account['rating'],
        ownerId: values.ownerId || undefined,
        parentAccountId: values.parentAccountId || undefined,
        description: values.description.trim() || undefined,
      } as unknown as Partial<Account>;
      return isEdit ? services.accounts.update(accountId ?? '', payload) : services.accounts.create(payload as never);
    },
    {
      successMessage: isEdit ? 'Account updated.' : 'Account created.',
      onSuccess: (record) => navigate(`/app/accounts/${record.id}`),
    },
  );

  if (isEdit && account.loading) return <ListSkeleton rows={8} columns={2} />;

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/app/home' },
          { label: 'Accounts', to: '/app/accounts' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        title={isEdit ? 'Edit account' : 'New account'}
        description={
          isEdit
            ? 'Update the firmographic details. Health and revenue are derived from records, not entered here.'
            : 'Create an account directly. Converting a lead creates the contact and account together.'
        }
        backTo={{ to: isEdit ? `/app/accounts/${accountId}` : '/app/accounts', label: 'Accounts' }}
      />

      <form className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6" onSubmit={handleSubmit((values) => void save.run(values))}>
        {save.error ? <Alert tone="danger" title="The account could not be saved">{save.error}</Alert> : null}

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Identity</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Account name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" {...register('name')} aria-invalid={Boolean(errors.name)} />
            </Field>
            <Field label="Legal name" htmlFor="legalName">
              <Input id="legalName" {...register('legalName')} />
            </Field>
            <Field label="Type" htmlFor="type">
              <Select
                id="type"
                value={currentType}
                onValueChange={(value) => setValue('type', value, { shouldDirty: true })}
                options={ACCOUNT_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </Field>
            <Field label="Industry" htmlFor="industry">
              <Input id="industry" {...register('industry')} placeholder="e.g. Manufacturing" />
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Size and ownership</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Company size" htmlFor="companySize">
              <Select
                id="companySize"
                value={currentSize}
                onValueChange={(value) => setValue('companySize', value, { shouldDirty: true })}
                placeholder="Not set"
                options={COMPANY_SIZES.map((size) => ({ value: size, label: size }))}
              />
            </Field>
            <Field label="Employee count" htmlFor="employeeCount" error={errors.employeeCount?.message}>
              <Input id="employeeCount" inputMode="numeric" {...register('employeeCount')} />
            </Field>
            <Field label="Tier" htmlFor="tier">
              <Select
                id="tier"
                value={currentTier}
                onValueChange={(value) => setValue('tier', value, { shouldDirty: true })}
                placeholder="Not set"
                options={TIERS.map((tier) => ({ value: tier, label: tier.replace(/_/g, ' ') }))}
              />
            </Field>
            <Field label="Rating" htmlFor="rating">
              <Select
                id="rating"
                value={currentRating}
                onValueChange={(value) => setValue('rating', value, { shouldDirty: true })}
                placeholder="Not set"
                options={RATINGS.map((rating) => ({ value: rating, label: rating }))}
              />
            </Field>
            <Field label="Owner" htmlFor="ownerId">
              <Select
                id="ownerId"
                value={currentOwner}
                onValueChange={(value) => setValue('ownerId', value, { shouldDirty: true })}
                searchable
                placeholder="Unassigned"
                options={(users.items ?? []).map((user) => ({ value: user.id, label: user.displayName }))}
              />
            </Field>
            <Field label="Parent account" htmlFor="parentAccountId">
              <Select
                id="parentAccountId"
                value={currentParent}
                onValueChange={(value) => setValue('parentAccountId', value, { shouldDirty: true })}
                searchable
                placeholder="No parent (top-level)"
                options={accounts.items
                  .filter((candidate) => candidate.id !== accountId)
                  .map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              />
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Contact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Website" htmlFor="website" error={errors.website?.message}>
              <Input id="website" {...register('website')} placeholder="https://" />
            </Field>
            <Field label="Main phone" htmlFor="phone">
              <Input id="phone" type="tel" {...register('phone')} />
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Notes</h2>
          <Field label="Description" htmlFor="description" className="mt-3">
            <Textarea id="description" rows={3} {...register('description')} placeholder="Context worth keeping: how they buy, who decides, what they care about." />
          </Field>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" type="button" asChild>
            <Link to={isEdit ? `/app/accounts/${accountId}` : '/app/accounts'}>Cancel</Link>
          </Button>
          <Button variant="primary" type="submit" loading={isSubmitting || save.pending}>
            {isEdit ? 'Save changes' : 'Create account'}
          </Button>
        </div>
      </form>
    </div>
  );
}
