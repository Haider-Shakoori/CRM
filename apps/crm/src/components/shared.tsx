'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  DemoNotice,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  IconButton,
  SearchInput,
  cn,
  focusRing,
  notify,
} from '@crm/ui';

/**
 * Shared screen furniture.
 *
 * Every CRM screen is a variation on the same four things: a header with a title and actions,
 * a filter bar, a list or board, and a set of states for when there is nothing to show. These
 * live here so the fifty-first screen looks like the first, and so a fix to the empty state
 * lands everywhere at once.
 */

export interface PageHeaderProps {
  title: React.ReactNode;
  /** One-line explanation. Keep it short: this is an application, not a document. */
  description?: React.ReactNode;
  /** Breadcrumbs are rendered by the caller from real route data. */
  breadcrumbs?: Array<{ label: string; to?: string }>;
  /** Rendered on the trailing edge. */
  actions?: React.ReactNode;
  /** Rendered beneath the title, e.g. a set of tabs. */
  tabs?: React.ReactNode;
  /** Rendered beneath everything, e.g. a summary strip. */
  footer?: React.ReactNode;
  /** Adds a back control for detail screens. */
  backTo?: { to: string; label: string };
  /** Marks synthetic content without repeating the wording everywhere. */
  sample?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  tabs,
  footer,
  backTo,
  sample,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('border-b border-border-subtle bg-surface', className)}>
      <div className="px-4 pt-3.5 sm:px-6">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-[0.6875rem]">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {crumb.to ? (
                    <Link to={crumb.to} className={cn('rounded text-subtle hover:text-link hover:underline', focusRing)}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-muted" aria-current="page">
                      {crumb.label}
                    </span>
                  )}
                  {index < breadcrumbs.length - 1 ? <span className="text-faint" aria-hidden>/</span> : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-start gap-2">
            {backTo ? (
              <Link
                to={backTo.to}
                className={cn(
                  'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-fg',
                  focusRing,
                )}
                aria-label={`Back to ${backTo.label}`}
              >
                <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            ) : null}
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-fg">{title}</h1>
                {sample ? <DemoNotice tone="neutral">Sample data</DemoNotice> : null}
              </div>
              {description ? <p className="max-w-2xl text-xs leading-relaxed text-muted">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
        </div>

        {tabs ? <div className="-mb-px">{tabs}</div> : null}
      </div>
      {footer}
    </header>
  );
}

/* ---------------------------------------------------------------- filter bar */

export interface FilterChip {
  id: string;
  label: string;
  /** Removes the filter. */
  onRemove?: () => void;
  tone?: 'neutral' | 'brand' | 'warning';
}

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  onClearFilters?: () => void;
  /** Result count, already formatted. */
  resultCount?: string;
  /** Rendered on the trailing edge, typically a view switcher or density control. */
  actions?: React.ReactNode;
  /** Explains what the current view is showing, e.g. a saved view description. */
  viewNote?: string;
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  chips = [],
  onClearFilters,
  resultCount,
  actions,
  viewNote,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface px-4 py-2 sm:px-6', className)}>
      <div className="min-w-[12rem] flex-1 sm:max-w-xs">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange('')}
          placeholder={searchPlaceholder}
          inputSize="sm"
          aria-label={searchPlaceholder}
        />
      </div>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <li key={chip.id}>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs',
                  chip.tone === 'brand'
                    ? 'border-brand/30 bg-brand-subtle text-brand-fg'
                    : chip.tone === 'warning'
                      ? 'border-warning/30 bg-warning-subtle text-warning-fg'
                      : 'border-border bg-inset text-muted',
                )}
              >
                {chip.label}
                {chip.onRemove ? (
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className={cn('rounded p-0.5 hover:opacity-70', focusRing)}
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            </li>
          ))}
          {onClearFilters ? (
            <li>
              <button
                type="button"
                onClick={onClearFilters}
                className={cn('rounded px-1.5 py-0.5 text-2xs text-subtle hover:text-fg hover:underline', focusRing)}
              >
                Clear all
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="ms-auto flex items-center gap-2">
        {resultCount ? (
          <p className="text-2xs tabular-nums text-subtle" aria-live="polite">
            {resultCount}
          </p>
        ) : null}
        {actions}
      </div>

      {viewNote ? (
        <p className="w-full text-[0.6875rem] leading-relaxed text-faint">{viewNote}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- view switcher */

export function ViewSwitcher<T extends string>({
  value,
  onChange,
  options,
  label = 'View',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-inset p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-medium transition-colors',
            value === option.value ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg',
            focusRing,
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- list toolbar */

export interface ListToolbarProps {
  onRefresh?: () => void;
  refreshing?: boolean;
  onExport?: () => void;
  onDensityToggle?: () => void;
  density?: 'comfortable' | 'compact';
  /** Extra menu items. */
  children?: React.ReactNode;
}

export function ListToolbar({ onRefresh, refreshing, onExport, onDensityToggle, density, children }: ListToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      {onDensityToggle ? (
        <Button variant="ghost" size="xs" onClick={onDensityToggle}>
          {density === 'compact' ? 'Comfortable' : 'Compact'}
        </Button>
      ) : null}
      {onRefresh ? (
        <IconButton
          label="Refresh"
          icon={<RefreshCw className={cn(refreshing && 'animate-spin')} />}
          size="icon-xs"
          onClick={onRefresh}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="More actions" icon={<MoreHorizontal />} size="icon-xs" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {children}
          {onExport ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  onExport();
                  // Generated in the browser. Saying so is required.
                  notify.simulated('Export prepared', 'Generated locally in your browser. Nothing was uploaded or emailed.');
                }}
                className="gap-2"
              >
                <Download className="size-4" aria-hidden />
                Export this view
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* -------------------------------------------------------------- record header */

export interface RecordHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** The reference, shown in monospace so it is easy to compare with a ticket or email. */
  reference?: string;
  /** Status and other badges. */
  badges?: React.ReactNode;
  /** Key facts rendered as a compact definition list. */
  facts?: Array<{ label: string; value: React.ReactNode }>;
  actions?: React.ReactNode;
  /** Adds a back control for detail screens. */
  backTo?: { to: string; label: string };
  /** Renders a favourite toggle. */
  favourite?: { active: boolean; onToggle: () => void };
  className?: string;
}

export function RecordHeader({
  title,
  subtitle,
  reference,
  badges,
  facts,
  actions,
  backTo,
  favourite,
  className,
}: RecordHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {backTo ? (
            <Link
              to={backTo.to}
              className={cn(
                'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-fg',
                focusRing,
              )}
              aria-label={`Back to ${backTo.label}`}
            >
              <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          ) : null}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-fg">{title}</h1>
                {reference ? (
                  <span className="rounded border border-border-subtle bg-inset px-1.5 py-0.5 font-mono text-[0.6875rem] text-subtle">
                    {reference}
                  </span>
                ) : null}
                {badges}
                {favourite ? (
                  <IconButton
                    label={favourite.active ? 'Remove from favourites' : 'Add to favourites'}
                    icon={<Star className={cn(favourite.active && 'fill-current text-warning')} />}
                    size="icon-xs"
                    onClick={favourite.onToggle}
                  />
                ) : null}
              </div>
              {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
        </div>

      {facts && facts.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-lg border border-border-subtle bg-inset p-3 sm:grid-cols-3 lg:grid-cols-5">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-faint">{fact.label}</dt>
              <dd className="mt-0.5 truncate text-xs font-medium text-fg">{fact.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- states */

/**
 * Loading placeholder for a list, matching the final row count so the layout does not jump.
 */
export function ListSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-1.5 p-3" role="status" aria-label="Loading records">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-3">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <div
              key={columnIndex}
              className={cn('h-6 animate-pulse rounded bg-inset', columnIndex === 0 ? 'w-1/4' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface RecordEmptyStateProps {
  title: string;
  body: string;
  /** Concrete first actions, not a generic "get started". */
  hints?: string[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function RecordEmptyState({ title, body, hints, primaryAction, secondaryAction }: RecordEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      body={body}
      hints={hints}
      action={
        <>
          {primaryAction ? (
            <Button variant="primary" size="sm" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button variant="secondary" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </>
      }
    />
  );
}

export function RecordErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <ErrorState title="Could not load this view" message={message} onRetry={onRetry} />;
}

/* ------------------------------------------------------------------- helpers */

/** Format a money value without pulling the localization package into a hot render path. */
export function formatMoney(amount: number, currency = 'USD', compact = false): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount);
}

export function formatNumber(value: number, compact = false): string {
  return new Intl.NumberFormat('en', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatDate(value: string | undefined, style: 'short' | 'long' | 'relative' = 'short'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (style === 'relative') {
    const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days === -1) return 'tomorrow';
    if (days > 1 && days < 30) return `${days} days ago`;
    if (days < -1 && days > -30) return `in ${Math.abs(days)} days`;
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
  }
  return new Intl.DateTimeFormat('en', { dateStyle: style }).format(date);
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** A saved view selector, rendered consistently wherever lists appear. */
export function SavedViewPicker({
  views,
  activeId,
  onChange,
  onSaveAs,
}: {
  views: Array<{ id: string; name: string; isPinned?: boolean }>;
  activeId: string;
  onChange: (id: string) => void;
  onSaveAs?: () => void;
}) {
  const active = views.find((view) => view.id === activeId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" trailingIcon={<ChevronDown className="size-3.5" />} leadingIcon={<SlidersHorizontal className="size-3.5" />}>
          <span className="max-w-[10rem] truncate">{active?.name ?? 'All records'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[16rem]">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        {views.map((view) => (
          <DropdownMenuItem key={view.id} onSelect={() => onChange(view.id)} className="gap-2">
            <span className="min-w-0 flex-1 truncate">{view.name}</span>
            {view.id === activeId ? <Badge variant="brand" size="sm">Active</Badge> : null}
          </DropdownMenuItem>
        ))}
        {onSaveAs ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSaveAs} className="gap-2">
              <Filter className="size-4" aria-hidden />
              Save current filters as a view
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Search, Download, Filter, ArrowLeft };
