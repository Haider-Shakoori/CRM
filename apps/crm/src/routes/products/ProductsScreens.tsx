'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Boxes, Layers, Package, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Deal, PriceBook, Product, ProductCategory } from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
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
  TonePill,
  cn,
  notify,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, formatDate, formatMoney, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Product and price-book screens.
 *
 * Two honest constraints run through this file:
 *
 *   1. **The catalogue is the only source of a price.** A product's list price, a price-book
 *      entry and the price on a quote line all trace back here, so a total can be explained
 *      rather than appearing from nowhere.
 *   2. **Tax is configuration, never a computed figure.** Every product carries
 *      `taxCalculationState: 'not_configured'` and the panels say so, because a platform with
 *      no tax engine must not display a tax number.
 */

const toneDotClasses: Record<string, string> = {
  violet: 'bg-tone-violet',
  teal: 'bg-tone-teal',
  amber: 'bg-tone-amber',
  green: 'bg-tone-green',
  red: 'bg-tone-red',
  blue: 'bg-tone-blue',
  slate: 'bg-tone-slate',
};

/* ---------------------------------------------------------------------- list */

export default function ProductsList() {
  const services = useServices();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState('catalog');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('active');

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 50,
      q: search || undefined,
      sort: [{ field: 'name', direction: 'asc' as const }],
      filter:
        statusFilter === 'all'
          ? undefined
          : {
              id: 'product-status',
              conjunction: 'and' as const,
              clauses: [{ field: 'status', operator: 'eq' as const, value: statusFilter }] as never,
            },
    }),
    [page, search, statusFilter],
  );

  const products = useList(() => services.products.list(query), [JSON.stringify(query)]);
  const summary = useAsync(() => services.products.revenueSummary(), []);

  const columns = React.useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Product',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/products/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.name}
            </Link>
            <span className="mt-0.5 block truncate font-mono text-[0.625rem] text-faint">{row.original.sku}</span>
          </div>
        ),
      },
      { id: 'family', header: 'Family', accessorKey: 'family', cell: ({ row }) => <span className="truncate text-xs text-muted">{row.original.family ?? '—'}</span> },
      { id: 'type', header: 'Type', accessorKey: 'type', cell: ({ row }) => <Badge variant="outline" size="sm">{row.original.type.replace(/_/g, ' ')}</Badge> },
      {
        id: 'billing',
        header: 'Billing',
        accessorKey: 'billingPeriod',
        cell: ({ row }) => (
          <span className="text-[0.6875rem] text-muted">{(row.original.billingPeriod ?? 'one_time').replace(/_/g, ' ')}</span>
        ),
      },
      {
        id: 'price',
        header: 'List price',
        accessorFn: (product) => product.basePrice.amount,
        meta: { align: 'end' },
        cell: ({ row }) => (
          <span className="text-xs font-medium tabular-nums text-fg">
            {formatMoney(row.original.basePrice.amount, row.original.basePrice.currency)}
            <span className="ms-1 text-[0.625rem] font-normal text-faint">/ {row.original.unitOfMeasure}</span>
          </span>
        ),
      },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'won',
        header: 'Deals won',
        accessorKey: 'dealsWonCount',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.dealsWonCount)}</span>,
      },
    ],
    [],
  );

  const recurringCount = products.items.filter((product) => (product.billingPeriod ?? 'one_time') !== 'one_time').length;
  const averagePrice = products.items.length > 0 ? products.items.reduce((sum, product) => sum + product.basePrice.amount, 0) / products.items.length : 0;

  return (
    <div className="pb-8">
      <PageHeader
        title="Products"
        description="The catalogue every quote and order prices from, with its price books and derived categories."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Products' }]}
        actions={
          <Button variant="primary" size="sm" leadingIcon={<Plus className="size-3.5" />} asChild>
            <Link to="/app/products/new">New product</Link>
          </Button>
        }
        footer={
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search product or SKU"
            resultCount={products.meta ? `${products.meta.total.toLocaleString()} products` : undefined}
            chips={statusFilter !== 'active' ? [{ id: 'status', label: `Status: ${statusFilter}`, tone: 'brand', onRemove: () => setStatusFilter('active') }] : []}
            onClearFilters={() => {
              setStatusFilter('active');
              setSearch('');
            }}
            actions={
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'discontinued', label: 'Discontinued' },
                  { value: 'out_of_stock', label: 'Out of stock' },
                  { value: 'all', label: 'All statuses' },
                ]}
                selectSize="sm"
                className="w-[11rem]"
                aria-label="Filter by status"
              />
            }
          />
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Products in view" value={formatNumber(products.items.length)} tone="violet" />
          <MiniStat label="Recurring lines" value={formatNumber(recurringCount)} tone="teal" />
          <MiniStat label="Average list price" value={formatMoney(averagePrice, 'USD', true)} tone="blue" />
          <MiniStat
            label="Open quote value"
            value={formatMoney(summary.data?.quotes.openValue.amount ?? 0, summary.data?.currency ?? 'USD', true)}
            tone="amber"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="catalog">Catalog ({products.meta?.total ?? 0})</TabsTrigger>
            <TabsTrigger value="pricebooks">Price books</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="pt-4">
            {products.loading ? (
              <ListSkeleton rows={10} columns={7} />
            ) : (
              <DataTable
                columns={columns}
                data={products.items}
                onRowClick={(product) => navigate(`/app/products/${product.id}`)}
                getRowId={(product) => product.id}
                footer={products.meta ? <Pagination page={products.meta.page} pageSize={products.meta.pageSize} total={products.meta.total} onPageChange={setPage} /> : null}
              />
            )}
          </TabsContent>

          <TabsContent value="pricebooks" className="pt-4">
            <PriceBooksPanel />
          </TabsContent>

          <TabsContent value="categories" className="pt-4">
            <CategoriesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- price books */

function PriceBooksPanel() {
  const services = useServices();
  const books = useList(() => services.products.priceBooks(), []);
  const [editing, setEditing] = React.useState<{ book: PriceBook; entryId: string; value: string } | null>(null);

  const updateEntry = useMutation(
    (input: { bookId: string; entryId: string; unitPrice: number }) =>
      services.products.updatePriceBookEntry(input.bookId, input.entryId, {
        unitPrice: { amount: input.unitPrice, currency: 'USD' },
      }),
    {
      successMessage: 'Price updated.',
      onSuccess: () => {
        setEditing(null);
        books.reload();
      },
    },
  );

  if (books.loading) return <ListSkeleton rows={6} columns={5} />;

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Prices here are the platform's own list prices">
        Editing an entry changes what a new quote line defaults to. It does not change the price on a quote that has
        already been sent, because a sent document must not move underneath the person reading it.
      </Alert>

      {books.items.map((book) => (
        <Card key={book.id}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                {book.name}
                {book.isStandard ? <Badge variant="brand" size="sm">Standard</Badge> : null}
              </h2>
              <p className="mt-0.5 text-2xs text-muted">
                {book.currency} · {book.entryCount} entries · applies to {book.appliesTo.kinds.join(', ')}
              </p>
            </div>
            <StatusBadge status={book.isActive ? 'active' : 'draft'} size="sm" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">{book.name} entries</caption>
              <thead>
                <tr>
                  {['Product', 'Unit price', 'Volume tiers', ''].map((heading, index) => (
                    <th key={heading || index} scope="col" className={cn('border-b border-border-subtle bg-inset px-3 py-2 text-2xs font-semibold text-muted', index === 1 ? 'text-end' : 'text-start')}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {book.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border-subtle last:border-b-0">
                    <td className="px-3 py-2 font-medium text-fg">{entry.productName}</td>
                    <td className="px-3 py-2 text-end font-medium tabular-nums text-fg">
                      {formatMoney(entry.unitPrice.amount, entry.unitPrice.currency)}
                    </td>
                    <td className="px-3 py-2">
                      {entry.volumeTiers && entry.volumeTiers.length > 0 ? (
                        <ul className="flex flex-wrap gap-1">
                          {entry.volumeTiers.map((tier) => (
                            <li key={tier.minQuantity}>
                              <TonePill tone="slate">{`≥${tier.minQuantity}: −${tier.discountPercent}%`}</TonePill>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-faint">None configured</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditing({ book, entryId: entry.id, value: String(entry.unitPrice.amount) })}
                      >
                        Edit price
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <Dialog open={editing !== null} onOpenChange={(openState) => !openState && setEditing(null)}>
        <DialogContent
          title="Edit list price"
          description="Applies to this price book only. Existing quotes keep the price they were created with."
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="price-entry-form"
                loading={updateEntry.pending}
              >
                Save price
              </Button>
            </>
          }
        >
          <form
            id="price-entry-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editing) return;
              const amount = Number(editing.value);
              if (!Number.isFinite(amount) || amount < 0) {
                notify.warning('Enter a price of zero or more.');
                return;
              }
              void updateEntry.run({ bookId: editing.book.id, entryId: editing.entryId, unitPrice: amount });
            }}
          >
            {updateEntry.error ? <Alert tone="danger" title="The price was not saved">{updateEntry.error}</Alert> : null}
            <Field label="Unit price" htmlFor="price-entry" required hint={editing?.book.currency}>
              <Input
                id="price-entry"
                inputMode="decimal"
                value={editing?.value ?? ''}
                onChange={(event) => setEditing((current) => (current ? { ...current, value: event.target.value } : current))}
              />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------------------------------------- categories */

function CategoriesPanel() {
  const services = useServices();
  const categories = useList(() => services.products.categories(), []);
  const navigate = useNavigate();

  if (categories.loading) return <ListSkeleton rows={4} columns={3} />;

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Categories are derived from the catalogue">
        Each category's count is computed from the products that name it, so the tiles below cannot drift from the
        catalogue. There is no separate category record to keep in sync.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.items.map((category: ProductCategory) => (
          <Card key={category.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <span className={cn('size-2 rounded-full', toneDotClasses[category.tone] ?? 'bg-tone-slate')} aria-hidden />
                {category.name}
              </span>
              <Badge variant="outline" size="sm">{category.productCount}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted">{category.description}</p>
            <Button variant="ghost" size="xs" className="mt-3" onClick={() => navigate('/app/products')}>
              View in catalogue
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- detail */

export function ProductDetail() {
  const services = useServices();
  const { productId } = useParams<{ productId: string }>();

  const product = useAsync(() => services.products.get(productId ?? ''), [productId], { skip: !productId });
  const books = useList(() => services.products.priceBooks(), [], { skip: !productId });
  const deals = useList(() => services.deals.list({ pageSize: 200 }), [productId], { skip: !productId });

  if (product.loading) return <ListSkeleton rows={10} columns={3} />;
  if (product.error || !product.data) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This product could not be found</h2>
            <p className="text-xs text-muted">{product.error ?? 'It may have been removed from the catalogue.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/products">Back to the catalogue</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const record = product.data;
  const relatedBooks = books.items.filter((book) => book.entries.some((entry) => entry.productId === record.id));
  const relatedDeals = deals.items.filter((deal: Deal) => deal.products.some((line) => line.productId === record.id));
  const recurring = (record.billingPeriod ?? 'one_time') !== 'one_time';

  return (
    <div className="pb-10">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Products', to: '/app/products' }, { label: record.name }]}
        title={record.name}
        description={record.description}
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/app/products/${record.id}/edit`}>Edit</Link>
          </Button>
        }
        footer={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t border-border-subtle px-4 py-2 text-2xs sm:px-6">
            <span className="font-mono text-subtle">{record.sku}</span>
            <span className="text-muted">Unit: {record.unitOfMeasure}</span>
            <span className="text-muted">List price: {formatMoney(record.basePrice.amount, record.basePrice.currency)}</span>
            {record.cost ? <span className="text-muted">Cost: {formatMoney(record.cost.amount, record.cost.currency)}</span> : null}
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="List price" value={formatMoney(record.basePrice.amount, record.basePrice.currency)} tone="violet" />
          <MiniStat label="Billing" value={(record.billingPeriod ?? 'one_time').replace(/_/g, ' ')} tone={recurring ? 'teal' : 'slate'} />
          <MiniStat label="Deals won" value={formatNumber(record.dealsWonCount)} tone="green" />
          <MiniStat label="Revenue won" value={record.revenueWon ? formatMoney(record.revenueWon.amount, record.revenueWon.currency, true) : '—'} tone="blue" />
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pricing">Pricing ({relatedBooks.length})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({relatedDeals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                  <Package className="size-4 text-subtle" aria-hidden />
                  Product details
                </h2>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Type', value: record.type.replace(/_/g, ' ') },
                    { label: 'Status', value: record.status.replace(/_/g, ' ') },
                    { label: 'Family', value: record.family ?? 'Not set' },
                    { label: 'Category', value: record.categoryLabel ?? 'Not set' },
                    { label: 'Unit of measure', value: record.unitOfMeasure },
                    { label: 'Billing period', value: (record.billingPeriod ?? 'one_time').replace(/_/g, ' ') },
                    { label: 'Active', value: record.isActive ? 'Yes' : 'No' },
                    { label: 'Updated', value: formatDate(record.updatedAt, 'relative') },
                  ].map((row) => (
                    <div key={row.label}>
                      <dt className="text-[0.625rem] uppercase tracking-wide text-faint">{row.label}</dt>
                      <dd className="mt-0.5 text-xs font-medium capitalize text-fg">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <Alert tone="neutral" title="Tax configuration">
                    {record.taxCalculationState === 'not_configured'
                      ? 'No tax class or rate is configured, and the platform does not calculate tax. Any rate shown on a document is recorded for reference only.'
                      : 'A tax class is configured on this product.'}
                  </Alert>
                </div>
              </Card>

              <div className="space-y-5">
                <Card className="p-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                    <Layers className="size-4 text-subtle" aria-hidden />
                    Variants
                  </h2>
                  {record.variants && record.variants.length > 0 ? (
                    <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
                      {record.variants.map((variant) => (
                        <li key={variant.id} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-fg">{variant.name}</p>
                            <p className="font-mono text-[0.625rem] text-faint">{variant.sku}</p>
                          </div>
                          <span className="text-xs tabular-nums text-muted">
                            {variant.priceAdjustment.amount === 0
                              ? 'No adjustment'
                              : `${variant.priceAdjustment.amount > 0 ? '+' : ''}${formatMoney(variant.priceAdjustment.amount, variant.priceAdjustment.currency)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted">This product has no variants.</p>
                  )}
                </Card>

                <Card className="p-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
                    <Boxes className="size-4 text-subtle" aria-hidden />
                    Bundle contents
                  </h2>
                  {record.bundleItems && record.bundleItems.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {record.bundleItems.map((item) => (
                        <li key={`${item.productId}-${item.productName}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-muted">{item.productName}</span>
                          <span className="shrink-0 text-subtle">
                            ×{item.quantity}
                            {item.isOptional ? ' · optional' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted">This is a standalone product, not a bundle.</p>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="pt-4">
            {relatedBooks.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted">This product is not listed in any price book.</Card>
            ) : (
              <div className="space-y-3">
                {relatedBooks.map((book) => {
                  const entry = book.entries.find((candidate) => candidate.productId === record.id)!;
                  const delta = entry.unitPrice.amount - record.basePrice.amount;
                  return (
                    <Card key={book.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium text-fg">
                          {book.name}
                          {book.isStandard ? <Badge variant="brand" size="sm">Standard</Badge> : null}
                        </p>
                        <p className="mt-0.5 text-2xs text-muted">{book.currency} · {book.description ?? 'No description'}</p>
                      </div>
                      <div className="text-end">
                        <p className="text-sm font-semibold tabular-nums text-fg">{formatMoney(entry.unitPrice.amount, entry.unitPrice.currency)}</p>
                        <p className={cn('text-2xs tabular-nums', delta === 0 ? 'text-subtle' : delta > 0 ? 'text-success-fg' : 'text-danger-fg')}>
                          {delta === 0 ? 'At list price' : `${delta > 0 ? '+' : ''}${formatMoney(delta, entry.unitPrice.currency)} vs list`}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deals" className="pt-4">
            {deals.loading ? (
              <ListSkeleton rows={5} columns={3} />
            ) : relatedDeals.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted">No deal currently lists this product.</Card>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] rounded-lg border border-border-subtle bg-surface">
                {relatedDeals.map((deal: Deal) => (
                  <li key={deal.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link to={`/app/deals/${deal.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
                        {deal.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[0.6875rem] text-muted">{deal.accountName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={deal.status} size="sm" />
                      <span className="text-xs font-medium tabular-nums text-fg">{formatMoney(deal.amount.amount, deal.amount.currency, true)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- form */

const productFormSchema = z.object({
  name: z.string().min(2, 'Give the product a name'),
  sku: z.string().min(2, 'A SKU is required so quotes can reference it'),
  categoryLabel: z.string().optional(),
  family: z.string().optional(),
  type: z.enum(['goods', 'service', 'subscription', 'bundle', 'usage_based', 'donation']),
  status: z.enum(['active', 'draft', 'discontinued', 'out_of_stock']),
  unitOfMeasure: z.enum(['each', 'seat', 'license', 'hour', 'day', 'month', 'year', 'gigabyte', 'transaction']),
  billingPeriod: z.enum(['one_time', 'monthly', 'quarterly', 'annual', 'usage']),
  basePrice: z.string().min(1, 'Enter a list price').refine((value) => Number(value) >= 0, 'Enter a price of zero or more'),
  cost: z.string().optional(),
  description: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export function ProductForm() {
  const services = useServices();
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const isEdit = Boolean(productId);

  const existing = useAsync(() => services.products.get(productId ?? ''), [productId], { skip: !isEdit });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { type: 'subscription', status: 'active', unitOfMeasure: 'seat', billingPeriod: 'monthly', basePrice: '0' },
    mode: 'onBlur',
  });
  const currentType = useWatch({ control: form.control, name: 'type' });
  const currentStatus = useWatch({ control: form.control, name: 'status' });
  const currentUnit = useWatch({ control: form.control, name: 'unitOfMeasure' });
  const currentBilling = useWatch({ control: form.control, name: 'billingPeriod' });

  React.useEffect(() => {
    if (!existing.data) return;
    form.reset({
      name: existing.data.name,
      sku: existing.data.sku,
      categoryLabel: existing.data.categoryLabel,
      family: existing.data.family,
      type: existing.data.type,
      status: existing.data.status,
      unitOfMeasure: existing.data.unitOfMeasure,
      billingPeriod: existing.data.billingPeriod ?? 'one_time',
      basePrice: String(existing.data.basePrice.amount),
      cost: existing.data.cost ? String(existing.data.cost.amount) : undefined,
      description: existing.data.description,
    });
  }, [existing.data, form]);

  const save = useMutation(
    async (values: ProductFormValues) => {
      const currency = existing.data?.basePrice.currency ?? 'USD';
      const organizationId = existing.data?.organizationId;
      const payload = {
        name: values.name,
        sku: values.sku,
        description: values.description || undefined,
        categoryLabel: values.categoryLabel || undefined,
        family: values.family || undefined,
        type: values.type,
        status: values.status,
        unitOfMeasure: values.unitOfMeasure,
        basePrice: { amount: Number(values.basePrice), currency },
        cost: values.cost ? { amount: Number(values.cost), currency } : undefined,
        billingPeriod: values.billingPeriod,
        taxCalculationState: 'not_configured' as const,
        images: [],
        isActive: values.status === 'active',
        priceBookEntryCount: 0,
        dealsWonCount: 0,
        tags: [],
        customFields: {},
        ...(organizationId ? { organizationId } : {}),
      };
      if (isEdit && productId) return services.products.update(productId, payload as never);
      return services.products.create(payload as never);
    },
    {
      successMessage: isEdit ? 'Product updated.' : 'Product created.',
      onSuccess: (product) => navigate(`/app/products/${product.id}`),
    },
  );

  return (
    <div className="pb-10">
      <PageHeader
        title={isEdit ? 'Edit product' : 'New product'}
        description="A product's list price is what a new quote line defaults to. Existing quotes keep the price they were created with."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Products', to: '/app/products' }, { label: isEdit ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button variant="primary" size="sm" loading={save.pending} type="submit" form="product-form">
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={isEdit && productId ? `/app/products/${productId}` : '/app/products'}>Cancel</Link>
            </Button>
          </>
        }
      />

      <form id="product-form" className="space-y-5 p-4 sm:p-6" noValidate onSubmit={form.handleSubmit((values) => void save.run(values))}>
        {save.error ? <Alert tone="danger" title="The product was not saved">{save.error}</Alert> : null}

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Identity</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" required error={form.formState.errors.name?.message} className="sm:col-span-2">
                <Input id="name" {...form.register('name')} placeholder="Professional seat" />
              </Field>
              <Field label="SKU" htmlFor="sku" required error={form.formState.errors.sku?.message}>
                <Input id="sku" {...form.register('sku')} placeholder="PRO-SEAT" />
              </Field>
              <Field label="Category" htmlFor="categoryLabel" hint="Quotes group by this label">
                <Input id="categoryLabel" {...form.register('categoryLabel')} placeholder="Subscriptions" />
              </Field>
              <Field label="Family" htmlFor="family">
                <Input id="family" {...form.register('family')} placeholder="Recurring" />
              </Field>
              <Field label="Description" htmlFor="description" className="sm:col-span-2">
                <Input id="description" {...form.register('description')} placeholder="One line the sales team will read" />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Classification</h2>
            <div className="mt-4 space-y-4">
              <Field label="Type" htmlFor="type" required>
                <Select
                  id="type"
                  value={currentType}
                  onValueChange={(value) => form.setValue('type', value as ProductFormValues['type'], { shouldValidate: true })}
                  options={['goods', 'service', 'subscription', 'bundle', 'usage_based', 'donation'].map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
                />
              </Field>
              <Field label="Status" htmlFor="status" required>
                <Select
                  id="status"
                  value={currentStatus}
                  onValueChange={(value) => form.setValue('status', value as ProductFormValues['status'], { shouldValidate: true })}
                  options={['active', 'draft', 'discontinued', 'out_of_stock'].map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
                />
              </Field>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-fg">Pricing</h2>
          <p className="mt-1 text-2xs text-muted">Recurring products describe how revenue is recognised. One-off products bill once.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="List price" htmlFor="basePrice" required error={form.formState.errors.basePrice?.message}>
              <Input id="basePrice" inputMode="decimal" {...form.register('basePrice')} placeholder="0" />
            </Field>
            <Field label="Cost" htmlFor="cost" hint="Used for the margin panel">
              <Input id="cost" inputMode="decimal" {...form.register('cost')} placeholder="Optional" />
            </Field>
            <Field label="Unit of measure" htmlFor="unitOfMeasure" required>
              <Select
                id="unitOfMeasure"
                value={currentUnit}
                onValueChange={(value) => form.setValue('unitOfMeasure', value as ProductFormValues['unitOfMeasure'], { shouldValidate: true })}
                options={['each', 'seat', 'license', 'hour', 'day', 'month', 'year', 'gigabyte', 'transaction'].map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label="Billing period" htmlFor="billingPeriod" required>
              <Select
                id="billingPeriod"
                value={currentBilling}
                onValueChange={(value) => form.setValue('billingPeriod', value as ProductFormValues['billingPeriod'], { shouldValidate: true })}
                options={['one_time', 'monthly', 'quarterly', 'annual', 'usage'].map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Alert tone="neutral" title="No tax class is configured">
              The platform does not calculate tax. A product created here records `not_configured` for tax and any rate
              on a document is for reference only.
            </Alert>
          </div>
        </Card>
      </form>
    </div>
  );
}
