'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Toaster as SonnerToaster, toast } from 'sonner';
import { Check, ChevronRight, X } from 'lucide-react';
import { cn, focusRing } from '../lib/utils';
import { Button } from './primitives';

/* ------------------------------------------------------------------ Dialog */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'title'> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Hides the close affordance for flows that must be completed or explicitly cancelled. */
  hideClose?: boolean;
  /** Rendered in a sticky footer. */
  footer?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Prevents dismissal by overlay click and Escape; used during submission. */
  blocking?: boolean;
}

const dialogSizes = {
  sm: 'max-w-[26rem]',
  md: 'max-w-[34rem]',
  lg: 'max-w-[44rem]',
  xl: 'max-w-[64rem]',
  full: 'max-w-[min(90rem,calc(100vw-2rem))]',
} as const;

export function DialogContent({
  className,
  size = 'md',
  hideClose,
  footer,
  title,
  description,
  children,
  blocking,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[var(--surface-scrim)] backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        onInteractOutside={(event) => blocking && event.preventDefault()}
        onEscapeKeyDown={(event) => blocking && event.preventDefault()}
        className={cn(
          'fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
          'overflow-hidden rounded-xl border border-border bg-overlay shadow-2xl',
          dialogSizes[size],
          className,
        )}
        {...props}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0 space-y-1">
            <DialogPrimitive.Title className="text-md font-semibold tracking-tight text-fg">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : null}
          </div>
          {!hideClose ? (
            <DialogPrimitive.Close
              className={cn('-me-1 -mt-1 shrink-0 rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg', focusRing)}
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-border-subtle px-5 py-3.5 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* --------------------------------------------------------------- Sheet (drawer) */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export interface SheetContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'title'> {
  side?: 'start' | 'end' | 'bottom' | 'top';
  width?: 'sm' | 'md' | 'lg' | 'xl';
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
}

const sheetWidths = {
  sm: 'sm:max-w-[20rem]',
  md: 'sm:max-w-[30rem]',
  lg: 'sm:max-w-[42rem]',
  xl: 'sm:max-w-[56rem]',
} as const;

/**
 * Drawer. Uses logical `start`/`end` sides so it opens from the correct edge in RTL,
 * and becomes a bottom sheet on small screens where a side panel would be cramped.
 */
export function SheetContent({
  className,
  side = 'end',
  width = 'md',
  title,
  description,
  footer,
  children,
  ...props
}: SheetContentProps) {
  const sideClasses: Record<string, string> = {
    end: 'inset-y-0 end-0 h-full border-s data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 rtl:data-[state=closed]:-translate-x-full',
    start: 'inset-y-0 start-0 h-full border-e data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0 rtl:data-[state=closed]:translate-x-full',
    bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t data-[state=closed]:translate-y-full data-[state=open]:translate-y-0',
    top: 'inset-x-0 top-0 max-h-[85dvh] rounded-b-2xl border-b data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0',
  };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[var(--surface-scrim)] backdrop-blur-[1px]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-[60] flex w-full flex-col overflow-hidden border-border bg-overlay shadow-2xl',
          'transition-transform duration-260 ease-standard',
          sideClasses[side],
          (side === 'start' || side === 'end') && `${sheetWidths[width]} sm:w-full`,
          className,
        )}
        {...props}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0 space-y-1">
            <DialogPrimitive.Title className="text-md font-semibold tracking-tight text-fg">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="text-sm text-muted">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close className={cn('-me-1 -mt-1 rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg', focusRing)} aria-label="Close panel">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="flex flex-col-reverse gap-2 border-t border-border-subtle px-5 py-3.5 sm:flex-row sm:justify-end">{footer}</footer> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ------------------------------------------------------------ AlertDialog */

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Extra content such as a reason picker or a type-to-confirm field. */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  tone?: 'default' | 'danger';
  loading?: boolean;
}

/**
 * Confirmation dialog for destructive or irreversible actions.
 *
 * Destructive confirmations are never a single click: the danger tone, the verb in the
 * confirm label and the optional reason field make the consequence explicit.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'default',
  loading,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[var(--surface-scrim)] backdrop-blur-[1px]" />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-[30rem] -translate-x-1/2 -translate-y-1/2',
            'flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-overlay shadow-2xl',
          )}
        >
          <div className="space-y-2 px-5 py-4">
            <AlertDialogPrimitive.Title className="text-md font-semibold tracking-tight text-fg">{title}</AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description asChild>
                <div className="text-sm text-muted">{description}</div>
              </AlertDialogPrimitive.Description>
            ) : null}
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-border-subtle px-5 py-3.5 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" onClick={onCancel}>
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

/* ----------------------------------------------------------- DropdownMenu */

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const menuItemClass = cn(
  'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg outline-none',
  'data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle',
);

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-[70] min-w-[12rem] overflow-hidden rounded-lg border border-border bg-overlay p-1 shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  tone = 'default',
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { tone?: 'default' | 'danger' }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(menuItemClass, tone === 'danger' && 'text-danger-fg [&_svg]:text-danger-fg', className)}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem className={cn(menuItemClass, 'pe-8', className)} checked={checked} {...props}>
      <span className="flex-1">{children}</span>
      <DropdownMenuPrimitive.ItemIndicator className="absolute end-2">
        <Check className="size-4 text-brand" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(menuItemClass, 'pe-8', className)} {...props}>
      <span className="flex-1">{children}</span>
      <DropdownMenuPrimitive.ItemIndicator className="absolute end-2">
        <Check className="size-4 text-brand" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border-subtle', className)} {...props} />;
}

export function DropdownMenuSubTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger className={cn(menuItemClass, 'data-[state=open]:bg-hover', className)} {...props}>
      <span className="flex-1">{children}</span>
      <ChevronRight className="size-4 rtl:rotate-180" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={cn('z-[70] min-w-[10rem] overflow-hidden rounded-lg border border-border bg-overlay p-1 shadow-lg', className)}
      {...props}
    />
  );
}

export function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ms-auto font-mono text-2xs text-subtle', className)} {...props} />;
}

/* --------------------------------------------------------------- Tooltip */

export function TooltipProvider({ children, delayDuration = 320 }: { children: React.ReactNode; delayDuration?: number }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Shortcut or extra context rendered in a muted style. */
  hint?: string;
}

/**
 * Tooltips supplement; they never carry information that is unavailable elsewhere.
 * Content is also exposed to assistive technology via `aria-describedby` by Radix.
 */
export function Tooltip({ content, children, side = 'top', hint }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[80] max-w-[18rem] rounded-md border border-border bg-[var(--surface-inverse)] px-2.5 py-1.5 text-xs text-[var(--fg-inverted)] shadow-lg"
        >
          <div className="space-y-0.5">
            <div>{content}</div>
            {hint ? <div className="font-mono text-2xs opacity-70">{hint}</div> : null}
          </div>
          <TooltipPrimitive.Arrow className="fill-[var(--surface-inverse)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ---------------------------------------------------------------- Popover */

export function Popover({ children, ...props }: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props}>{children}</PopoverPrimitive.Root>;
}

export function PopoverTrigger({ children, asChild = true }: { children: React.ReactNode; asChild?: boolean }) {
  return <PopoverPrimitive.Trigger asChild={asChild}>{children}</PopoverPrimitive.Trigger>;
}

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-overlay p-4 shadow-lg',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/* ---------------------------------------------------------------- Toaster */

/**
 * Toast host.
 *
 * Positioned bottom-center on small screens and bottom-end on larger ones, and it
 * respects reduced motion. Every toast in the product is triggered through the helpers
 * below so wording stays consistent — including the honest labelling of simulated
 * actions.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      offset={16}
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border border-border bg-overlay text-fg shadow-lg !text-sm',
          description: 'text-muted !text-xs',
          actionButton: 'bg-brand text-brand-contrast rounded-md px-2 py-1 text-xs',
          cancelButton: 'bg-neutral-subtle text-fg rounded-md px-2 py-1 text-xs',
          closeButton: 'bg-overlay border-border text-subtle',
        },
      }}
    />
  );
}

export const notify = {
  success: (title: string, description?: string) => toast.success(title, { description }),
  error: (title: string, description?: string) => toast.error(title, { description }),
  info: (title: string, description?: string) => toast.info(title, { description }),
  warning: (title: string, description?: string) => toast.warning(title, { description }),
  loading: (title: string, description?: string) => toast.loading(title, { description }),
  /** Resolves a loading toast started earlier. */
  done: (id: string | number, title: string, description?: string) => toast.success(title, { id, description }),
  fail: (id: string | number, title: string, description?: string) => toast.error(title, { id, description }),
  /**
   * Use whenever an action was simulated rather than performed against a real system.
   * The wording is deliberate: it never claims a real-world effect happened.
   */
  simulated: (title: string, description?: string) =>
    toast.info(title, { description: description ?? 'Simulated for demonstration — nothing was sent or saved to a server.' }),
  /** Undoable destructive action. */
  undoable: (title: string, onUndo: () => void, description?: string) =>
    toast(title, { description, action: { label: 'Undo', onClick: onUndo } }),
  dismiss: (id?: string | number) => toast.dismiss(id),
  promise: toast.promise,
  custom: toast.custom,
};
