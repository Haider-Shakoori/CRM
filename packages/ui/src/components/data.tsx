'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FileUp,
  Inbox,
  Lock,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { cn, safePercent, transitionBase } from '../lib/utils';
import { Alert, Button, Card, DemoNotice, Skeleton, SkeletonTable } from './primitives';
import { Checkbox } from './forms';

/* ------------------------------------------------------------------ Table */

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border-subtle bg-surface', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  sortable,
  sorted,
  onSort,
  align = 'start',
  scope = 'col',
}: {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: (event: unknown) => void;
  align?: 'start' | 'end' | 'center';
  scope?: 'col' | 'row';
}) {
  const ariaSort = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : sortable ? 'none' : undefined;
  return (
    <th
      scope={scope}
      aria-sort={ariaSort}
      className={cn(
        'sticky top-0 z-[10] border-b border-border-subtle bg-inset px-3 py-2 text-xs font-semibold text-muted',
        align === 'start' && 'text-start',
        align === 'end' && 'text-end',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn('inline-flex items-center gap-1.5 rounded text-inherit hover:text-fg', 'px-0.5')}
        >
          {children}
          {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'start',
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'center';
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'border-b border-border-subtle px-3 py-2 align-middle text-fg',
        align === 'start' && 'text-start',
        align === 'end' && 'text-end tabular-nums',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  interactive,
  selected,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean; selected?: boolean }) {
  return (
    <tr
      className={cn(
        transitionBase,
        selected && 'bg-selected',
        interactive && 'cursor-pointer hover:bg-hover',
        className,
      )}
      aria-selected={selected}
      {...props}
    >
      {children}
    </tr>
  );
}

/** Compact property list used on record detail sidebars. */
export function PropertyList({
  items,
  className,
  columns = 1,
}: {
  items: Array<{ label: string; value: React.ReactNode; action?: React.ReactNode }>;
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">{item.label}</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-sm text-fg">
            <span className="min-w-0 break-words">{item.value ?? <span className="text-faint">—</span>}</span>
            {item.action}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------- DataTable */

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /**
   * Stable row id. Defaults to the row's `id`, falling back to the row index so that a
   * pre-aggregated table (whose rows carry no id of their own) still gets unique keys
   * rather than collapsing every row onto the same empty string.
   */
  getRowId?: (row: TData, index: number) => string;
  loading?: boolean;
  /** Selection enables bulk actions; the header checkbox selects the current page. */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onRowClick?: (row: TData) => void;
  emptyState?: React.ReactNode;
  /** Sticky header is the default for long record lists. */
  stickyHeader?: boolean;
  className?: string;
  /** Row density. Compact is used by sales and service workspaces. */
  density?: 'comfortable' | 'compact';
  /** Footer, typically a pagination control. */
  footer?: React.ReactNode;
  /**
   * Column visibility is controlled externally so saved views can persist it.
   */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (state: VisibilityState) => void;
}

/**
 * Generic record table.
 *
 * The CRM lists are dozens of near-identical tables, so they all render through this
 * component: sorting, selection, sticky headers, density, skeleton loading and empty
 * states are implemented once. Virtualisation is intentionally not enabled by default
 * — the lists paginate — but the component is structured so a virtualiser can wrap the
 * body without changing call sites.
 */
export function DataTable<TData>({
  columns,
  data,
  getRowId = (row, index) => String((row as { id?: string }).id ?? index),
  loading,
  selectable,
  selectedIds = [],
  onSelectedIdsChange,
  onRowClick,
  emptyState,
  stickyHeader = true,
  className,
  density = 'comfortable',
  footer,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = React.useState<VisibilityState>({});

  const selectionColumn = React.useMemo<ColumnDef<TData, unknown>>(
    () => ({
      id: '__select',
      size: 36,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          aria-label={`Select row ${row.index + 1}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    [],
  );

  const allColumns = React.useMemo(() => (selectable ? [selectionColumn, ...columns] : columns), [selectable, selectionColumn, columns]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      rowSelection: Object.fromEntries(selectedIds.map((id) => [id, true])),
      columnVisibility: columnVisibility ?? internalVisibility,
    },
    getRowId,
    enableRowSelection: selectable,
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnVisibility ?? internalVisibility) : updater;
      if (onColumnVisibilityChange) onColumnVisibilityChange(next);
      else setInternalVisibility(next);
    },
    onRowSelectionChange: (updater) => {
      const current = Object.fromEntries(selectedIds.map((id) => [id, true]));
      const next = typeof updater === 'function' ? updater(current) : updater;
      onSelectedIdsChange?.(Object.keys(next).filter((key) => next[key]));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  if (loading) {
    return (
      <div className={cn('rounded-lg border border-border-subtle bg-surface p-4', className)}>
        <SkeletonTable rows={8} columns={Math.min(columns.length + (selectable ? 1 : 0), 6)} />
      </div>
    );
  }

  const rowHeight = density === 'compact' ? 'h-[var(--row-h)]' : 'h-[calc(var(--row-h)+0.25rem)]';

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border-subtle bg-surface', className)}>
      <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className={cn(stickyHeader && 'sticky top-0 z-[10]')}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const align = (header.column.columnDef.meta as { align?: 'start' | 'end' | 'center' } | undefined)?.align;
                  return (
                    <Th
                      key={header.id}
                      sortable={header.column.getCanSort()}
                      sorted={header.column.getIsSorted()}
                      onSort={header.column.getToggleSortingHandler()}
                      align={align}
                      className={cn(header.column.id === '__select' && 'w-9')}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </Th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className="p-0">
                  {emptyState ?? <EmptyState title="No records" body="Nothing matches the current filters." />}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  aria-selected={row.getIsSelected()}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    rowHeight,
                    'border-b border-border-subtle',
                    transitionBase,
                    row.getIsSelected() && 'bg-selected',
                    onRowClick && 'cursor-pointer hover:bg-hover',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = (cell.column.columnDef.meta as { align?: 'start' | 'end' | 'center' } | undefined)?.align;
                    return (
                      <Td key={cell.id} align={align} className={cn(cell.column.id === '__select' && 'w-9')}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-border-subtle bg-surface px-3 py-2">{footer}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- States */

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Renders inside a bordered surface by default. */
  variant?: 'card' | 'plain' | 'inline';
  className?: string;
  /** Extra guidance, e.g. the three suggested first steps. */
  hints?: string[];
}

export function EmptyState({ title, body, icon, action, variant = 'card', className, hints }: EmptyStateProps) {
  const content = (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', variant === 'inline' && 'py-6', className)}>
      <span
        className="flex size-11 items-center justify-center rounded-xl border border-border-subtle bg-inset text-subtle [&_svg]:size-5"
        aria-hidden
      >
        {icon ?? <Inbox />}
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {body ? <p className="text-sm text-muted">{body}</p> : null}
      </div>
      {hints && hints.length > 0 ? (
        <ul className="mt-1 space-y-1 text-start text-xs text-muted">
          {hints.map((hint) => (
            <li key={hint} className="flex items-start gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
              {hint}
            </li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );

  if (variant === 'card') return <Card className="border-dashed">{content}</Card>;
  return content;
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Correlates the message with a log entry once a backend exists. */
  traceId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  variant?: 'error' | 'forbidden' | 'not-found' | 'offline' | 'not-entitled';
  /** Rendered for the `not-entitled` variant. */
  upgradeAction?: React.ReactNode;
}

const errorVariants = {
  error: { icon: TriangleAlert, title: 'Something went wrong', body: 'The request could not be completed.' },
  forbidden: { icon: ShieldAlert, title: 'Access restricted', body: 'Your role does not include access to this area. An administrator can grant it.' },
  'not-found': { icon: Inbox, title: 'Not found', body: 'This record may have been deleted, or the link is incorrect.' },
  offline: { icon: RefreshCw, title: 'You appear to be offline', body: 'Reconnect to continue. Your unsaved changes are kept in this browser.' },
  'not-entitled': { icon: Lock, title: 'Not included in your current plan', body: 'This module is available on a higher plan or as an add-on.' },
} as const;

export function ErrorState({ title, message, traceId, onRetry, retryLabel = 'Try again', className, variant = 'error', upgradeAction }: ErrorStateProps) {
  const preset = errorVariants[variant];
  const Icon = preset.icon;
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)} role="alert">
      <span className="flex size-11 items-center justify-center rounded-xl border border-danger/25 bg-danger-subtle text-danger-fg [&_svg]:size-5" aria-hidden>
        <Icon />
      </span>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-fg">{title ?? preset.title}</p>
        <p className="text-sm text-muted">{message ?? preset.body}</p>
        {traceId ? <p className="pt-1 font-mono text-2xs text-faint">Reference: {traceId}</p> : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {variant === 'not-entitled' ? upgradeAction : null}
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry} leadingIcon={<RefreshCw className="size-4" />}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ KPI widgets */

export interface KpiCardProps {
  label: string;
  value: string;
  /** Delta object rendered with an arrow, colour and a comparison label. */
  delta?: { text: string; direction: 'up' | 'down' | 'flat'; sentiment?: 'positive' | 'negative' | 'neutral'; comparisonLabel?: string };
  /** Small sparkline or progress element. */
  visual?: React.ReactNode;
  /** Target attainment shown as a bar. */
  target?: { label: string; percent: number };
  hint?: string;
  onClick?: () => void;
  className?: string;
  /** Marks a figure that is synthetic in this build. */
  sample?: boolean;
  /** Warning stripe for metrics that need attention. */
  attention?: 'warning' | 'danger';
}

/**
 * KPI tile.
 *
 * Colour is never the only signal: every delta carries a direction word in its
 * accessible name, and target bars show the percentage numerically.
 */
export function KpiCard({ label, value, delta, visual, target, hint, onClick, className, sample, attention }: KpiCardProps) {
  const sentiment = delta?.sentiment ?? (delta?.direction === 'up' ? 'positive' : delta?.direction === 'down' ? 'negative' : 'neutral');
  const deltaColor = sentiment === 'positive' ? 'text-success-fg' : sentiment === 'negative' ? 'text-danger-fg' : 'text-muted';
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-3 rounded-lg border bg-surface p-4 text-start',
        attention === 'danger' ? 'border-danger/30' : attention === 'warning' ? 'border-warning/30' : 'border-border-subtle',
        onClick && cn('cursor-pointer', transitionBase, 'hover:border-border-strong hover:shadow-sm'),
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
        {sample ? <DemoNotice tone="neutral">Sample</DemoNotice> : null}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</p>
        {delta ? (
          <p className={cn('flex flex-wrap items-center gap-1.5 text-xs', deltaColor)}>
            <span aria-hidden>{delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '■'}</span>
            <span className="font-medium tabular-nums">{delta.text}</span>
            <span className="sr-only">{delta.direction === 'up' ? 'increase' : delta.direction === 'down' ? 'decrease' : 'no change'}</span>
            {delta.comparisonLabel ? <span className="text-subtle">{delta.comparisonLabel}</span> : null}
          </p>
        ) : null}
      </div>
      {visual ? <div className="min-h-0">{visual}</div> : null}
      {target ? (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between text-2xs text-muted">
            <span>{target.label}</span>
            <span className="tabular-nums">{Math.round(target.percent)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-inset">
            <div
              className={cn('h-full rounded-full', target.percent >= 75 ? 'bg-success' : target.percent >= 40 ? 'bg-warning' : 'bg-danger')}
              style={{ width: `${Math.min(100, Math.max(0, target.percent))}%` }}
            />
          </div>
        </div>
      ) : null}
      {hint ? <p className="text-2xs text-subtle">{hint}</p> : null}
    </Wrapper>
  );
}

/** Row of KPI tiles that collapses to a horizontal scroller on small screens. */
export function KpiRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- Timeline */

export interface TimelineItem {
  id: string;
  kind: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  timestamp: string;
  /** ISO-8601 relative or absolute label already formatted by the caller. */
  timeLabel: string;
  icon?: React.ReactNode;
  tone?: 'violet' | 'teal' | 'amber' | 'green' | 'red' | 'blue' | 'slate' | 'neutral';
  actor?: { name: string; initials: string; src?: string };
  /** Marks an entry produced by the simulated automation engine. */
  simulated?: boolean;
  actions?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}

/**
 * Activity timeline. Groups by day implicitly through the `timeLabel` the caller
 * provides, and keeps the newest item first so the "what happened last" question is
 * always answered without scrolling.
 */
export function Timeline({ items, className, emptyState }: { items: TimelineItem[]; className?: string; emptyState?: React.ReactNode }) {
  if (items.length === 0) {
    return <div className={className}>{emptyState ?? <EmptyState variant="inline" title="No activity yet" body="Logged calls, emails, meetings and notes appear here." />}</div>;
  }
  return (
    <ol className={cn('relative space-y-0', className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-4">
          {index !== items.length - 1 ? (
            <span className="absolute start-[0.6875rem] top-7 bottom-0 w-px bg-border-subtle" aria-hidden />
          ) : null}
          <span
            className={cn(
              'relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-subtle [&_svg]:size-3',
            )}
            aria-hidden
          >
            {item.icon ?? <span className="size-1.5 rounded-full bg-brand" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-fg">{item.title}</span>
              <time className="text-2xs text-subtle" dateTime={item.timestamp}>
                {item.timeLabel}
              </time>
              {item.simulated ? <DemoNotice tone="neutral">Simulated</DemoNotice> : null}
            </div>
            {item.description ? <div className="text-sm text-muted">{item.description}</div> : null}
            {item.actions ? <div className="flex flex-wrap gap-2 pt-0.5">{item.actions}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ File upload */

export interface FileUploadProps {
  onFiles: (files: Array<{ name: string; sizeBytes: number; mimeType: string }>) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  className?: string;
  helperText?: string;
  /** Explicitly states that nothing is uploaded anywhere. */
  storageNotice?: boolean;
}

/**
 * File drop zone.
 *
 * The interface is real; the upload is not. Files are read only for their name, size
 * and type, and the user is told plainly that no storage is connected.
 */
export function FileUpload({ onFiles, accept, multiple = true, maxSizeMb = 25, className, helperText, storageNotice = true }: FileUploadProps) {
  const [dragging, setDragging] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handle = (fileList: FileList | null) => {
    if (!fileList) return;
    const next: Array<{ name: string; sizeBytes: number; mimeType: string }> = [];
    const problems: string[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > maxSizeMb * 1024 * 1024) {
        problems.push(`${file.name} is larger than ${maxSizeMb} MB.`);
        continue;
      }
      next.push({ name: file.name, sizeBytes: file.size, mimeType: file.type || 'application/octet-stream' });
    }
    setErrors(problems);
    if (next.length > 0) onFiles(next);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handle(event.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center',
          transitionBase,
          dragging ? 'border-brand bg-brand-subtle' : 'border-border-strong bg-inset',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-lg border border-border-subtle bg-surface text-subtle [&_svg]:size-4" aria-hidden>
          <FileUp />
        </span>
        <p className="text-sm font-medium text-fg">Drop files here, or choose from your device</p>
        {helperText ? <p className="text-xs text-muted">{helperText}</p> : <p className="text-xs text-muted">Up to {maxSizeMb} MB per file.</p>}
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(event) => handle(event.target.files)}
        />
      </div>
      {storageNotice ? (
        <Alert tone="warning">
          No file storage is connected. File names and sizes are recorded in this browser only — nothing is uploaded, and the file contents are never read.
        </Alert>
      ) : null}
      {errors.length > 0 ? (
        <Alert tone="danger" title="Some files could not be added">
          <ul className="list-disc space-y-0.5 ps-4">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}

/** Shared loading placeholder for chart and widget surfaces. */
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="space-y-2" style={{ height }} role="status" aria-label="Loading chart">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

/** Percentage chip used in funnel and conversion displays. */
export function ConversionChip({ numerator, denominator, label }: { numerator: number; denominator: number; label?: string }) {
  const percent = safePercent(numerator, denominator);
  return (
    <span className="inline-flex items-baseline gap-1 text-xs text-muted">
      <span className="font-medium tabular-nums text-fg">{percent}%</span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
