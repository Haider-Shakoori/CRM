'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';
import { cn, focusRing, transitionBase, toneClass, type Tone } from '../lib/utils';

/* ---------------------------------------------------------------- Button */

const buttonVariants = cva(
  cn(
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    transitionBase,
    focusRing,
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-contrast shadow-xs hover:bg-brand-hover active:bg-brand-active',
        secondary:
          'border border-border bg-surface text-fg shadow-xs hover:bg-hover hover:border-border-strong active:bg-active',
        outline: 'border border-border bg-transparent text-fg hover:bg-hover active:bg-active',
        ghost: 'bg-transparent text-fg hover:bg-hover active:bg-active',
        subtle: 'bg-neutral-subtle text-fg hover:bg-hover active:bg-active',
        danger: 'bg-danger text-white shadow-xs hover:bg-danger-hover active:opacity-90',
        'danger-outline': 'border border-danger/40 bg-transparent text-danger-fg hover:bg-danger-subtle',
        success: 'bg-success text-white shadow-xs hover:bg-success-hover',
        link: 'h-auto bg-transparent p-0 text-link underline-offset-4 hover:text-link-hover hover:underline',
        inverse: 'bg-inverse text-fg-inverse hover:opacity-90',
      },
      size: {
        xs: 'h-7 px-2 text-xs [&_svg]:size-3.5',
        sm: 'h-[var(--control-h-sm)] px-2.5 text-sm [&_svg]:size-4',
        md: 'h-[var(--control-h-md)] px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-[var(--control-h-lg)] px-5 text-sm [&_svg]:size-[1.125rem]',
        xl: 'h-12 px-6 text-base [&_svg]:size-5',
        'icon-xs': 'size-7 [&_svg]:size-3.5',
        'icon-sm': 'size-[var(--control-h-sm)] [&_svg]:size-4',
        'icon-md': 'size-[var(--control-h-md)] [&_svg]:size-4',
        'icon-lg': 'size-[var(--control-h-lg)] [&_svg]:size-[1.125rem]',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'secondary', size: 'md', fullWidth: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element, keeping the styles. Used for links styled as buttons. */
  asChild?: boolean;
  /** Show a spinner and block interaction. */
  loading?: boolean;
  /** Icon rendered before the label. */
  leadingIcon?: React.ReactNode;
  /** Icon rendered after the label. */
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, asChild, loading, leadingIcon, trailingIcon, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  const content = asChild ? (
    children
  ) : (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : leadingIcon}
      {children}
      {trailingIcon}
    </>
  );
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </Comp>
  );
});

export { buttonVariants };

/* ------------------------------------------------------- IconButton */

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  /** Required: icon-only controls must have an accessible name. */
  label: string;
  icon: React.ReactNode;
  /** Adds a visual tooltip on hover for pointer users. */
  tooltip?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, tooltip, size = 'icon-md', variant = 'ghost', className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      className={className}
      aria-label={label}
      title={tooltip ?? label}
      {...props}
    >
      {icon}
    </Button>
  );
});

/* ----------------------------------------------------------------- Badge */

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-neutral-subtle text-muted',
        outline: 'border-border bg-transparent text-muted',
        brand: 'border-transparent bg-brand-subtle text-brand-fg',
        success: 'border-transparent bg-success-subtle text-success-fg',
        warning: 'border-transparent bg-warning-subtle text-warning-fg',
        danger: 'border-transparent bg-danger-subtle text-danger-fg',
        info: 'border-transparent bg-info-subtle text-info-fg',
        solid: 'border-transparent bg-fg text-fg-inverse',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-2xs',
        md: 'px-2 py-0.5 text-xs',
        lg: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Small leading dot, useful in status lists. */
  dot?: boolean;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? <span className={cn('size-1.5 rounded-full', variant === 'solid' ? 'bg-fg-inverse' : 'bg-current opacity-70')} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Tone-based pill, used for pipeline stages, tags and health bands. */
export function TonePill({ tone, children, className, dot = true }: { tone: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClass(tone, 'bg'),
        toneClass(tone, 'fg'),
        toneClass(tone, 'border'),
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', toneClass(tone, 'dot'))} aria-hidden /> : null}
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- StatusBadge */

const statusTone: Record<string, Tone> = {
  new: 'blue',
  open: 'blue',
  in_progress: 'violet',
  active: 'green',
  activated: 'green',
  won: 'green',
  closed_won: 'green',
  approved: 'green',
  accepted: 'green',
  completed: 'green',
  resolved: 'green',
  paid: 'green',
  healthy: 'green',
  thriving: 'green',
  on_track: 'green',
  connected: 'green',
  sent: 'blue',
  published: 'green',
  pending: 'amber',
  pending_approval: 'amber',
  in_review: 'amber',
  pending_customer: 'amber',
  scheduled: 'amber',
  at_risk: 'amber',
  watch: 'amber',
  past_due: 'amber',
  expiring_soon: 'amber',
  draft: 'slate',
  not_started: 'slate',
  untouched: 'slate',
  unknown: 'slate',
  archived: 'slate',
  paused: 'slate',
  on_hold: 'slate',
  lost: 'red',
  closed_lost: 'red',
  rejected: 'red',
  declined: 'red',
  failed: 'red',
  error: 'red',
  critical: 'red',
  blocked: 'red',
  overdue: 'red',
  breached: 'red',
  churned: 'red',
  cancelled: 'red',
  disconnected: 'red',
  high: 'amber',
  urgent: 'red',
  normal: 'blue',
  low: 'slate',
  hot: 'red',
  warm: 'amber',
  cold: 'blue',
  qualified: 'green',
  unqualified: 'slate',
  nurturing: 'violet',
  contacted: 'blue',
  converted: 'green',
};

export interface StatusBadgeProps {
  /** Machine value; underscores and casing are normalised for the default label. */
  status: string;
  /** Override the displayed label (use for localised strings). */
  label?: string;
  /** Explicit tone override when the status map is not appropriate. */
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Renders a status with a consistent tone across every module. Unknown statuses fall
 * back to neutral rather than guessing, so a new backend status can never be silently
 * misrepresented as good or bad news.
 */
export function StatusBadge({ status, label, tone, size = 'md', className }: StatusBadgeProps) {
  const resolvedTone = tone ?? statusTone[status] ?? 'neutral';
  const display = label ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <TonePill tone={resolvedTone} className={className}>
      <span className={cn(size === 'sm' && 'text-2xs', size === 'lg' && 'text-sm')}>{display}</span>
    </TonePill>
  );
}

/* ------------------------------------------------------------------ Card */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `raised` adds elevation; `flat` relies on a border only. */
  elevation?: 'flat' | 'raised' | 'floating' | 'inset';
  /** Removes the outer border, e.g. when nested inside another surface. */
  borderless?: boolean;
  /** Adds a subtle hover affordance for clickable cards. */
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, elevation = 'flat', borderless, interactive, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg bg-surface',
        !borderless && elevation !== 'inset' && 'border border-border-subtle',
        elevation === 'raised' && 'shadow-sm',
        elevation === 'floating' && 'shadow-lg',
        elevation === 'inset' && 'bg-inset',
        interactive && cn('cursor-pointer', transitionBase, 'hover:border-border-strong hover:shadow-sm'),
        className,
      )}
      {...props}
    />
  );
});

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 px-4 py-3.5 sm:px-5', className)} {...props} />;
}

export function CardTitle({ className, as: Comp = 'h3', ...props }: React.HTMLAttributes<HTMLHeadingElement> & { as?: React.ElementType }) {
  return <Comp className={cn('text-md font-semibold tracking-tight text-fg', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3.5 sm:px-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 border-t border-border-subtle px-4 py-3 sm:px-5', className)} {...props} />;
}

/** Section header used above cards and tables. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
  as: Comp = 'h2',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        <Comp className="text-lg font-semibold tracking-tight text-fg">{title}</Comp>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Avatar */

export interface AvatarProps {
  name: string;
  src?: string;
  /** Pre-computed initials; falls back to deriving them from the name. */
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Deterministic accent derived from the name when no image is available. */
  tone?: Tone;
  className?: string;
  /** Renders a small presence dot. */
  status?: 'online' | 'away' | 'offline';
  /** Accessible context appended to the name, e.g. a job title. */
  subtitle?: string;
}

const avatarSizes = {
  xs: 'size-6 text-2xs',
  sm: 'size-7 text-xs',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
  xl: 'size-14 text-base',
} as const;

export function Avatar({ name, src, initials, size = 'md', tone = 'violet', className, status, subtitle }: AvatarProps) {
  const derived =
    initials ??
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  return (
    <AvatarPrimitive.Root
      className={cn('relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full', avatarSizes[size], className)}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback
        className={cn('flex size-full items-center justify-center font-semibold', toneClass(tone, 'bg'), toneClass(tone, 'fg'))}
        aria-label={subtitle ? `${name} — ${subtitle}` : name}
      >
        {derived || '?'}
      </AvatarPrimitive.Fallback>
      {status ? (
        <span
          className={cn(
            'absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface',
            status === 'online' && 'bg-success',
            status === 'away' && 'bg-warning',
            status === 'offline' && 'bg-subtle',
          )}
          aria-hidden
        />
      ) : null}
    </AvatarPrimitive.Root>
  );
}

export function AvatarGroup({ people, max = 4, size = 'sm' }: { people: Array<{ name: string; src?: string; initials?: string; tone?: Tone }>; max?: number; size?: AvatarProps['size'] }) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          {...person}
          size={size}
          className={cn(index > 0 && '-ms-2 ring-2 ring-[var(--surface-base)]')}
        />
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            '-ms-2 flex size-7 items-center justify-center rounded-full bg-neutral-subtle text-xs font-medium text-muted ring-2 ring-[var(--surface-base)]',
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- Progress */

export interface ProgressProps {
  value: number;
  max?: number;
  /** Tone reflects meaning; `auto` derives from the value where that is meaningful. */
  tone?: Tone | 'auto';
  size?: 'xs' | 'sm' | 'md';
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function Progress({ value, max = 100, tone = 'auto', size = 'sm', label, showValue, className }: ProgressProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const resolvedTone: Tone = tone === 'auto' ? (percent >= 75 ? 'green' : percent >= 40 ? 'amber' : 'red') : tone;
  const heights = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' } as const;
  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          {label ? <span className="text-muted">{label}</span> : <span />}
          {showValue ? <span className="font-medium tabular-nums text-fg">{Math.round(percent)}%</span> : null}
        </div>
      ) : null}
      <ProgressPrimitive.Root
        value={percent}
        className={cn('relative w-full overflow-hidden rounded-full bg-inset', heights[size])}
        aria-label={label}
      >
        <ProgressPrimitive.Indicator
          className={cn('h-full w-full rounded-full transition-transform duration-300 ease-standard', toneClass(resolvedTone, 'solid'))}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}

/** Health/gauge readout with an explicit band label so colour is never the only signal. */
export function ScoreRing({
  score,
  band,
  size = 64,
  label,
}: {
  score: number;
  band?: string;
  size?: number;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, score));
  const tone: Tone = clamped >= 75 ? 'green' : clamped >= 50 ? 'amber' : 'red';
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="inline-flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? 'Score'}: ${clamped} of 100${band ? `, ${band}` : ''}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--chart-grid)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone === 'green' ? 'var(--success)' : tone === 'amber' ? 'var(--warning)' : 'var(--danger)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-[var(--fg)] font-semibold" style={{ fontSize: size * 0.3 }}>
          {clamped}
        </text>
      </svg>
      {band ? <span className={cn('text-sm font-medium', toneClass(tone, 'fg'))}>{band}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------ Separator */

export function Separator({
  orientation = 'horizontal',
  className,
  decorative = true,
  label,
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  decorative?: boolean;
  label?: string;
}) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        'shrink-0 bg-border-subtle',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    >
      {label && !decorative ? <span className="sr-only">{label}</span> : null}
    </SeparatorPrimitive.Root>
  );
}

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-inset motion-reduce:animate-none', className)}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading table">
      <div className="flex gap-4 border-b border-border-subtle pb-2">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 py-1.5">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} className={cn('h-4 flex-1', columnIndex === 0 && 'max-w-[14rem]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={cn('p-5', className)}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-4 h-16 w-full" />
    </Card>
  );
}

/* ---------------------------------------------------------------- Alert */

export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Rendered beneath the body, typically a link or a retry button. */
  action?: React.ReactNode;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  className?: string;
  /** Use `polite` for informational messages, `assertive` only for urgent errors. */
  live?: 'off' | 'polite' | 'assertive';
}

const alertIcons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
  neutral: Info,
} as const;

const alertTones = {
  info: 'bg-info-subtle border-info/25 text-info-fg',
  success: 'bg-success-subtle border-success/25 text-success-fg',
  warning: 'bg-warning-subtle border-warning/30 text-warning-fg',
  danger: 'bg-danger-subtle border-danger/25 text-danger-fg',
  neutral: 'bg-neutral-subtle border-border text-fg',
} as const;

export function Alert({ tone = 'info', title, children, action, onDismiss, icon, className, live = 'off' }: AlertProps) {
  const Icon = alertIcons[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={live === 'off' ? undefined : live}
      className={cn('flex gap-3 rounded-lg border px-3.5 py-3', alertTones[tone], className)}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon ?? <Icon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        {children ? <div className="text-sm text-fg/90 [&_a]:underline [&_a]:underline-offset-2">{children}</div> : null}
        {action ? <div className="pt-1.5">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className={cn('-mt-1 -me-1 shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10', focusRing)}
          aria-label="Dismiss message"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Honest labelling component.
 *
 * Anything the frontend cannot really do must say so at the point of use. This keeps
 * that requirement a one-liner rather than a paragraph of copy repeated everywhere.
 */
export function DemoNotice({ children, tone = 'info', className }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'neutral'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-2xs font-medium uppercase tracking-wide',
        tone === 'warning' && 'border-warning/40 bg-warning-subtle text-warning-fg',
        tone === 'info' && 'border-border-strong bg-neutral-subtle text-muted',
        tone === 'neutral' && 'border-border bg-transparent text-subtle',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden />
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Layout */

/** Marketing-style content container that keeps the three surfaces on the same grid. */
export function Container({
  children,
  width = 'wide',
  className,
  as: Comp = 'div',
}: {
  children: React.ReactNode;
  width?: 'prose' | 'narrow' | 'content' | 'wide' | 'full';
  className?: string;
  as?: React.ElementType;
}) {
  const widths = {
    prose: 'max-w-[var(--container-prose)]',
    narrow: 'max-w-[var(--container-narrow)]',
    content: 'max-w-[var(--container-content)]',
    wide: 'max-w-[var(--container-wide)]',
    full: 'max-w-[var(--w-full)]',
  } as const;
  return <Comp className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', widths[width], className)}>{children}</Comp>;
}

/** Simple responsive grid used by feature lists and KPI rows. */
export function Grid({ children, columns = 3, gap = 'md', className }: { children: React.ReactNode; columns?: 1 | 2 | 3 | 4 | 6; gap?: 'sm' | 'md' | 'lg'; className?: string }) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  } as const;
  const gaps = { sm: 'gap-3', md: 'gap-4 sm:gap-5', lg: 'gap-6 sm:gap-8' } as const;
  return <div className={cn('grid', columnClasses[columns], gaps[gap], className)}>{children}</div>;
}
