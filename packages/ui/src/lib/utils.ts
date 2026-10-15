import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class name composer.
 *
 * `clsx` handles conditional classes; `tailwind-merge` resolves conflicts so a caller
 * can override a component's default padding by passing `px-6` without fighting
 * specificity. Every component in this package routes its className through here.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a value for the `aria-label` of an icon-only control. */
export function screenReaderLabel(label: string, extra?: string): string {
  return extra ? `${label} — ${extra}` : label;
}

/** Stable id generator for form control / label associations in list renders. */
let idCounter = 0;
export function createId(prefix = 'ui'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Build a deterministic, human-readable reference such as `D-10432`.
 * Mirrors the reference format the mock layer generates so UI screenshots match data.
 */
export function formatReference(prefix: string, seed: number): string {
  return `${prefix}-${String(10000 + (seed % 90000)).padStart(5, '0')}`;
}

/** Truncate long text in dense tables without breaking mid-word. */
export function truncate(value: string, max = 60): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

/** Clamp a number into a range; used by progress bars and gauges. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Percentage helper that always returns a finite number. */
export function safePercent(numerator: number, denominator: number, digits = 1): number {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(digits));
}

/**
 * Map a tone token to its Tailwind utility sets.
 *
 * Grouped here so badges, pipeline stages, chart legends and health pills all agree on
 * what "amber" means. Values reference the semantic tokens defined in
 * `@crm/design-tokens`, so dark mode and high-contrast mode work without overrides.
 */
export const toneClasses = {
  violet: { bg: 'bg-tone-violet-bg', fg: 'text-tone-violet', border: 'border-tone-violet/25', dot: 'bg-tone-violet', solid: 'bg-tone-violet' },
  teal: { bg: 'bg-tone-teal-bg', fg: 'text-tone-teal', border: 'border-tone-teal/25', dot: 'bg-tone-teal', solid: 'bg-tone-teal' },
  amber: { bg: 'bg-tone-amber-bg', fg: 'text-tone-amber', border: 'border-tone-amber/25', dot: 'bg-tone-amber', solid: 'bg-tone-amber' },
  green: { bg: 'bg-tone-green-bg', fg: 'text-tone-green', border: 'border-tone-green/25', dot: 'bg-tone-green', solid: 'bg-tone-green' },
  red: { bg: 'bg-tone-red-bg', fg: 'text-tone-red', border: 'border-tone-red/25', dot: 'bg-tone-red', solid: 'bg-tone-red' },
  blue: { bg: 'bg-tone-blue-bg', fg: 'text-tone-blue', border: 'border-tone-blue/25', dot: 'bg-tone-blue', solid: 'bg-tone-blue' },
  slate: { bg: 'bg-tone-slate-bg', fg: 'text-tone-slate', border: 'border-tone-slate/25', dot: 'bg-tone-slate', solid: 'bg-tone-slate' },
  neutral: { bg: 'bg-neutral-subtle', fg: 'text-muted', border: 'border-border', dot: 'bg-subtle', solid: 'bg-subtle' },
} as const;

export type Tone = keyof typeof toneClasses;

export function toneClass(tone: Tone | undefined, part: keyof (typeof toneClasses)['violet']): string {
  return toneClasses[tone ?? 'neutral'][part];
}

/** Standard focus ring used by every interactive element in the design system. */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ring-offset)]';

/** Shared transition timing so hover states feel uniform across the product. */
export const transitionBase = 'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-standard';

/** Convenience: the standard page padding used by CRM views. */
export const pagePadding = 'px-4 sm:px-6 lg:px-8';

/** Standard max widths for the three surfaces. */
export const contentWidth = {
  website: 'mx-auto w-full max-w-[var(--container-wide)]',
  websiteNarrow: 'mx-auto w-full max-w-[var(--container-content)]',
  prose: 'mx-auto w-full max-w-[var(--container-prose)]',
  crm: 'w-full',
  overlay: 'w-[min(42rem,calc(100vw-2rem))]',
} as const;
