'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn, focusRing, transitionBase } from '../lib/utils';
import { Button, Skeleton } from './primitives';

/* ------------------------------------------------------------------- Tabs */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-1 overflow-x-auto rounded-lg border border-border-subtle bg-inset p-0.5',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted',
        transitionBase,
        focusRing,
        'hover:text-fg',
        'data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-xs',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4 focus-visible:outline-none', className)} {...props} />;
}

/** Underline variant used on record detail pages where a pill list would look heavy. */
export function UnderlineTabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex items-center gap-1 overflow-x-auto border-b border-border-subtle', className)} {...props} />;
}

export function UnderlineTabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted',
        transitionBase,
        focusRing,
        'hover:text-fg',
        'data-[state=active]:border-brand data-[state=active]:text-fg',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------ Breadcrumbs */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Breadcrumbs. Truncates in the middle on narrow screens rather than hiding the
 * current page, because knowing where you are matters more than seeing the whole path.
 */
export function Breadcrumbs({ items, className, maxVisible = 4 }: { items: BreadcrumbItem[]; className?: string; maxVisible?: number }) {
  if (items.length === 0) return null;
  const collapsed = items.length > maxVisible;
  const head = collapsed ? items.slice(0, 1) : [];
  const tail = collapsed ? items.slice(-(maxVisible - 2)) : items;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {head.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <BreadcrumbEntry item={item} />
            <Separator />
          </li>
        ))}
        {collapsed ? (
          <li className="flex items-center gap-1">
            <span className="px-1 text-subtle" aria-hidden>
              <MoreHorizontal className="size-3.5" />
            </span>
            <Separator />
          </li>
        ) : null}
        {tail.map((item, index) => {
          const isLast = index === tail.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              <BreadcrumbEntry item={item} current={isLast} />
              {!isLast ? <Separator /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BreadcrumbEntry({ item, current }: { item: BreadcrumbItem; current?: boolean }) {
  if (current || !item.href) {
    return (
      <span className="max-w-[14rem] truncate font-medium text-fg" aria-current="page">
        {item.label}
      </span>
    );
  }
  return (
    <a
      href={item.href}
      className={cn('max-w-[12rem] truncate rounded text-muted hover:text-link hover:underline hover:underline-offset-2', focusRing)}
    >
      {item.label}
    </a>
  );
}

function Separator() {
  return <ChevronRight className="size-3 shrink-0 text-faint rtl:rotate-180" aria-hidden />;
}

/* ------------------------------------------------------------- Pagination */

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  /** Shown next to the range, e.g. "of 1,204 filtered". */
  totalLabel?: string;
}

/**
 * Pagination control with a range summary and page-size selector. Keeps the range
 * text visible on mobile (where knowing the total matters most) and hides only the
 * numbered page buttons.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
  className,
  totalLabel,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = React.useMemo(() => {
    const out: Array<number | 'ellipsis'> = [];
    const push = (value: number | 'ellipsis') => out.push(value);
    const window = 1;
    push(1);
    if (page - window > 2) push('ellipsis');
    for (let p = Math.max(2, page - window); p <= Math.min(totalPages - 1, page + window); p += 1) push(p);
    if (page + window < totalPages - 1) push('ellipsis');
    if (totalPages > 1) push(totalPages);
    return out;
  }, [page, totalPages]);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-xs text-muted" aria-live="polite">
        {total === 0 ? 'No records' : `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
        {totalLabel ? <span className="ms-1 text-subtle">{totalLabel}</span> : null}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <label className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className={cn('h-7 rounded-md border border-border bg-surface px-1.5 text-xs text-fg', focusRing)}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <div className="hidden items-center gap-0.5 sm:flex">
            {pages.map((entry, index) =>
              entry === 'ellipsis' ? (
                <span key={`gap-${index}`} className="px-1 text-xs text-subtle">
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => onPageChange(entry)}
                  aria-current={entry === page ? 'page' : undefined}
                  className={cn(
                    'min-w-7 rounded-md px-1.5 py-1 text-xs font-medium tabular-nums',
                    transitionBase,
                    focusRing,
                    entry === page ? 'bg-brand text-brand-contrast' : 'text-muted hover:bg-hover hover:text-fg',
                  )}
                >
                  {entry}
                </button>
              ),
            )}
          </div>
          <span className="text-xs tabular-nums text-muted sm:hidden">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </nav>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Accordion */

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn('border-b border-border-subtle last:border-b-0', className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'group flex flex-1 items-center justify-between gap-3 py-3.5 text-start text-sm font-medium text-fg',
          transitionBase,
          focusRing,
          'hover:text-brand-fg',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="size-4 shrink-0 text-subtle transition-transform duration-200 ease-standard group-data-[state=open]:rotate-180" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn('overflow-hidden text-sm text-muted data-[state=closed]:animate-out data-[state=open]:animate-in', className)}
      {...props}
    >
      <div className="pb-4 pe-6">{children}</div>
    </AccordionPrimitive.Content>
  );
}

/* -------------------------------------------------------------- Sidebar nav */

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number | string;
  /** Nested items render as an expandable group. */
  children?: NavItem[];
  disabled?: boolean;
  tooltip?: string;
  exact?: boolean;
}

export interface SidebarNavProps {
  items: NavItem[];
  currentPath: string;
  collapsed?: boolean;
  onNavigate?: (href: string) => void;
  className?: string;
}

/**
 * Sidebar navigation.
 *
 * Uses logical start/end spacing so the collapsed rail, indentation and active
 * indicator all mirror correctly in RTL. The active item is marked with
 * `aria-current="page"` so assistive technology announces position, not just styling.
 */
export function SidebarNav({ items, currentPath, collapsed, onNavigate, className }: SidebarNavProps) {
  const isActive = (item: NavItem) =>
    item.exact ? currentPath === item.href : currentPath === item.href || currentPath.startsWith(`${item.href}/`);

  return (
    <nav className={cn('space-y-0.5', className)} aria-label="Main">
      {items.map((item) => {
        const active = isActive(item);
        const childActive = item.children?.some(isActive) ?? false;
        const expanded = active || childActive;
        return (
          <div key={item.key}>
            <a
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-expanded={item.children ? expanded : undefined}
              title={collapsed ? item.tooltip ?? item.label : undefined}
              onClick={(event) => {
                if (item.disabled) {
                  event.preventDefault();
                  return;
                }
                onNavigate?.(item.href);
              }}
              className={cn(
                'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
                transitionBase,
                focusRing,
                item.disabled && 'pointer-events-none opacity-45',
                active
                  ? 'bg-selected text-brand-fg'
                  : childActive
                    ? 'text-fg'
                    : 'text-muted hover:bg-hover hover:text-fg',
                collapsed && 'justify-center px-0',
              )}
            >
              {item.icon ? <span className="shrink-0 [&_svg]:size-4" aria-hidden>{item.icon}</span> : null}
              {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
              {!collapsed && item.badge !== undefined && item.badge !== 0 ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
                    typeof item.badge === 'number' && item.badge > 9 ? 'bg-danger text-white' : 'bg-neutral-subtle text-muted',
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </a>
            {!collapsed && item.children && expanded ? (
              <div className="mt-0.5 space-y-0.5 border-s border-border-subtle ps-3.5 ms-2">
                {item.children.map((child) => (
                  <a
                    key={child.key}
                    href={child.href}
                    aria-current={isActive(child) ? 'page' : undefined}
                    onClick={() => onNavigate?.(child.href)}
                    className={cn(
                      'block rounded-md px-2 py-1.5 text-xs',
                      transitionBase,
                      focusRing,
                      isActive(child) ? 'bg-selected text-brand-fg' : 'text-muted hover:bg-hover hover:text-fg',
                    )}
                  >
                    {child.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** Sidebar group heading with optional collapse control. */
export function NavSection({
  title,
  children,
  collapsed,
  className,
}: {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {!collapsed ? (
        <p className="px-2.5 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wider text-faint">{title}</p>
      ) : (
        <div className="mx-2 my-2 h-px bg-border-subtle" aria-hidden />
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ Steps (wizard) */

export interface StepItem {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
}

export function Steps({
  steps,
  currentIndex,
  onStepClick,
  className,
  orientation = 'horizontal',
}: {
  steps: StepItem[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <ol
      className={cn('flex gap-2', orientation === 'horizontal' ? 'flex-row overflow-x-auto' : 'flex-col', className)}
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const state = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
        const clickable = Boolean(onStepClick) && index <= currentIndex;
        return (
          <li key={step.id} className={cn('flex min-w-0 items-start gap-2.5', orientation === 'horizontal' && 'flex-1')}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(index)}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md text-start',
                clickable && cn('cursor-pointer', transitionBase, focusRing),
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold',
                  state === 'complete' && 'border-brand bg-brand text-brand-contrast',
                  state === 'current' && 'border-brand bg-brand-subtle text-brand-fg',
                  state === 'upcoming' && 'border-border bg-surface text-subtle',
                )}
                aria-hidden
              >
                {state === 'complete' ? '✓' : index + 1}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-xs font-medium', state === 'upcoming' ? 'text-subtle' : 'text-fg')}>
                  {step.label}
                </span>
                {step.optional ? <span className="block text-2xs text-faint">Optional</span> : null}
              </span>
            </button>
            {orientation === 'horizontal' && index < steps.length - 1 ? (
              <span className={cn('mt-3 hidden h-px flex-1 sm:block', state === 'complete' ? 'bg-brand' : 'bg-border-subtle')} aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------ Loading shell */

export function PageShellSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Skip link. Always the first focusable element on a page. */
export function SkipLink({ href = '#main', children = 'Skip to main content' }: { href?: string; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      className={cn(
        'absolute left-4 top-4 z-[100] -translate-y-20 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-contrast',
        transitionBase,
        'focus:translate-y-0',
        focusRing,
      )}
    >
      {children}
    </a>
  );
}
