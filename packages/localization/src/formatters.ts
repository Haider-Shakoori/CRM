/**
 * Locale-aware formatters built on the platform `Intl` APIs.
 *
 * Nothing here maintains its own number/date tables: correctness comes from `Intl`,
 * and the only product decisions are *presentation defaults* (which currency, which
 * grouping style, how compact large figures get). Keeping it that way means adding a
 * locale is a configuration change rather than a formatting-code change.
 */

import type { LanguageTag } from '@crm/shared-types';

export type NumberFormatStyle = 'standard' | 'indian' | 'space' | 'plain';

export interface FormatContext {
  locale: string;
  timezone?: string;
  currency?: string;
  numberFormat?: NumberFormatStyle;
  /** `12h` or `24h`. Defaults to the locale's own preference. */
  timeFormat?: '12h' | '24h';
  /** Digits used for numerals. Eastern Arabic digits are optional, not automatic. */
  numberingSystem?: 'latn' | 'arab' | 'arabext';
  /** Display the currency code alongside the symbol when ambiguity is likely. */
  showCurrencyCode?: boolean;
  /** Maximum fraction digits for currencies without minor units. */
  currencyDecimalDigits?: number;
}

const DEFAULT_CTX: FormatContext = { locale: 'en', numberFormat: 'standard', showCurrencyCode: false };

/* ------------------------------------------------------------------ numbers */

function groupingFor(style: NumberFormatStyle | undefined): 'indian' | 'standard' | undefined {
  if (style === 'indian') return 'indian';
  if (style === 'space') return 'standard';
  return undefined;
}

export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions & { maximumFractionDigits?: number } = {},
  ctx: FormatContext = DEFAULT_CTX,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const intlLocale = ctx.numberingSystem === 'arab' ? `${ctx.locale}-u-nu-arab` : ctx.numberingSystem === 'arabext' ? `${ctx.locale}-u-nu-arabext` : ctx.locale;
  // `useGrouping: 'always'` (ES2023) forces grouping even for 4-digit numbers, which is
  // the correct behaviour for financial tables. Typed as `boolean` here because the
  // declared lib target predates the string form, so we narrow through `unknown`.
  const useGrouping = (groupingFor(ctx.numberFormat) ? 'always' : 'auto') as unknown as boolean | undefined;
  return new Intl.NumberFormat(intlLocale, {
    useGrouping,
    ...options,
  }).format(value);
}

/**
 * Compact figure for KPI tiles: 1.2M, 45.3K. Uses the locale's own compact rules so
 * abbreviations are correct per language rather than invented.
 */
export function formatCompact(
  value: number | null | undefined,
  ctx: FormatContext = DEFAULT_CTX,
  options: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (Math.abs(value) < 10000) return formatNumber(value, { maximumFractionDigits: 0, ...options }, ctx);
  return new Intl.NumberFormat(ctx.locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string,
  ctx: FormatContext = DEFAULT_CTX,
  options: Intl.NumberFormatOptions = {},
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const zeroDecimalCurrencies = new Set(['JPY', 'KRW', 'VND', 'CLP', 'IDR', 'AFN', 'IRR', 'NGN', 'PKR', 'TWD']);
  const digits = ctx.currencyDecimalDigits ?? (zeroDecimalCurrencies.has(currency) ? 0 : 2);
  const formatted = new Intl.NumberFormat(ctx.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    ...options,
  }).format(amount);
  if (!ctx.showCurrencyCode) return formatted;
  return currency === 'USD' ? `${formatted} USD` : `${formatted} ${currency}`;
}

export function formatCompactCurrency(
  amount: number | null | undefined,
  currency: string,
  ctx: FormatContext = DEFAULT_CTX,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  if (Math.abs(amount) < 10000) return formatCurrency(amount, currency, ctx);
  return new Intl.NumberFormat(ctx.locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatPercent(
  value: number | null | undefined,
  ctx: FormatContext = DEFAULT_CTX,
  options: { alreadyFraction?: boolean; maximumFractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const normalised = options.alreadyFraction ? value : value / 100;
  return new Intl.NumberFormat(ctx.locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
  }).format(normalised);
}

export function formatDelta(
  value: number | null | undefined,
  direction: 'up' | 'down' | 'flat',
  ctx: FormatContext = DEFAULT_CTX,
  unit: 'percent' | 'absolute' | 'currency' = 'percent',
  currency = 'USD',
): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { text: '—', direction: 'flat' };
  }
  const sign = value > 0 ? '+' : '';
  let text: string;
  if (unit === 'percent') text = `${sign}${formatPercent(Math.abs(value), ctx)}`;
  else if (unit === 'currency') text = `${sign}${formatCurrency(Math.abs(value), currency, ctx)}`;
  else text = `${sign}${formatNumber(Math.abs(value), {}, ctx)}`;
  return { text, direction };
}

/* -------------------------------------------------------------------- dates */

export function formatDate(
  value: string | Date | null | undefined,
  ctx: FormatContext = DEFAULT_CTX,
  style: 'short' | 'medium' | 'long' | 'full' | 'dayMonth' | 'monthYear' | 'weekdayShort' | 'relative' = 'medium',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const common = { timeZone: ctx.timezone } as Intl.DateTimeFormatOptions;

  switch (style) {
    case 'short':
      return new Intl.DateTimeFormat(ctx.locale, { ...common, year: '2-digit', month: 'numeric', day: 'numeric' }).format(date);
    case 'long':
      return new Intl.DateTimeFormat(ctx.locale, { ...common, year: 'numeric', month: 'long', day: 'numeric' }).format(date);
    case 'full':
      return new Intl.DateTimeFormat(ctx.locale, { ...common, dateStyle: 'full' }).format(date);
    case 'dayMonth':
      return new Intl.DateTimeFormat(ctx.locale, { ...common, month: 'short', day: 'numeric' }).format(date);
    case 'monthYear':
      return new Intl.DateTimeFormat(ctx.locale, { ...common, year: 'numeric', month: 'short' }).format(date);
    case 'weekdayShort':
      return new Intl.DateTimeFormat(ctx.locale, { ...common, weekday: 'short' }).format(date);
    case 'relative':
      return formatRelativeTime(date, ctx);
    default:
      return new Intl.DateTimeFormat(ctx.locale, { ...common, year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }
}

export function formatTime(
  value: string | Date | null | undefined,
  ctx: FormatContext = DEFAULT_CTX,
  options: { withSeconds?: boolean } = {},
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(ctx.locale, {
    timeZone: ctx.timezone,
    hour: 'numeric',
    minute: '2-digit',
    ...(options.withSeconds ? { second: '2-digit' } : {}),
    ...(ctx.timeFormat ? { hour12: ctx.timeFormat === '12h' } : {}),
  }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  ctx: FormatContext = DEFAULT_CTX,
  options: { relative?: boolean; withSeconds?: boolean } = {},
): string {
  if (!value) return '—';
  if (options.relative) return formatRelativeTime(value, ctx);
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(date, ctx, 'medium')} · ${formatTime(date, ctx, { withSeconds: options.withSeconds })}`;
}

/** Relative time using `Intl.RelativeTimeFormat`, so units localise correctly. */
export function formatRelativeTime(value: string | Date, ctx: FormatContext = DEFAULT_CTX, base: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = date.getTime() - base.getTime();
  const rtf = new Intl.RelativeTimeFormat(ctx.locale, { numeric: 'auto' });
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (abs < minute) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  if (abs < week) return rtf.format(Math.round(diffMs / day), 'day');
  if (abs < month) return rtf.format(Math.round(diffMs / week), 'week');
  if (abs < year) return rtf.format(Math.round(diffMs / month), 'month');
  return rtf.format(Math.round(diffMs / year), 'year');
}

/** Duration in a human-readable form, e.g. `2d 4h` or `12m 30s`. */
export function formatDuration(
  seconds: number | null | undefined,
  ctx: FormatContext = DEFAULT_CTX,
  style: 'short' | 'long' = 'short',
): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (style === 'short') {
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
  const parts: string[] = [];
  if (h > 0) parts.push(`${formatNumber(h, {}, ctx)} ${h === 1 ? 'hour' : 'hours'}`);
  if (m > 0) parts.push(`${formatNumber(m, {}, ctx)} ${m === 1 ? 'minute' : 'minutes'}`);
  if (h === 0 && (m === 0 || s > 0)) parts.push(`${formatNumber(s, {}, ctx)} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

/**
 * Days elapsed as a business-friendly label. Used by the rotting-deal indicator and
 * SLA counters.
 */
export function formatDaysElapsed(days: number | null | undefined, ctx: FormatContext = DEFAULT_CTX): string {
  if (days === null || days === undefined || Number.isNaN(days)) return '—';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${formatNumber(days, {}, ctx)} days`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${formatNumber(weeks, {}, ctx)} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const months = Math.round(days / 30);
  return `${formatNumber(months, {}, ctx)} ${months === 1 ? 'month' : 'months'}`;
}

/** Countdown used for trial banners and SLA timers. */
export function formatCountdown(target: string | Date, ctx: FormatContext = DEFAULT_CTX, base: Date = new Date()): string {
  const date = typeof target === 'string' ? new Date(target) : target;
  const diff = date.getTime() - base.getTime();
  if (Number.isNaN(diff)) return '—';
  if (diff <= 0) return 'expired';
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) {
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    return `${formatNumber(days, {}, ctx)}d ${formatNumber(hours, {}, ctx)}h`;
  }
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${formatNumber(hours, {}, ctx)}h ${formatNumber(minutes, {}, ctx)}m`;
}

/* ------------------------------------------------------------------- ranges */

export function formatDateRange(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
  ctx: FormatContext = DEFAULT_CTX,
  style: 'short' | 'medium' = 'medium',
): string {
  if (!from && !to) return '—';
  if (from && !to) return formatDate(from, ctx, style);
  if (!from && to) return formatDate(to, ctx, style);
  const a = typeof from === 'string' ? new Date(from) : from!;
  const b = typeof to === 'string' ? new Date(to) : to!;
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  const fmtStart = new Intl.DateTimeFormat(ctx.locale, {
    timeZone: ctx.timezone,
    year: sameYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const fmtEnd = new Intl.DateTimeFormat(ctx.locale, {
    timeZone: ctx.timezone,
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${fmtStart.format(a)} – ${fmtEnd.format(b)}`;
}

/* -------------------------------------------------------------------- misc */

/** Relative day labels used by the calendar and the daily planner. */
export function relativeDayLabel(date: string | Date, ctx: FormatContext = DEFAULT_CTX, base: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffDays = Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86_400_000,
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return new Intl.DateTimeFormat(ctx.locale, { weekday: 'long' }).format(d);
  return formatDate(d, ctx, 'medium');
}

/**
 * Build the 12-hour or 24-hour hour list for time pickers, honouring the locale's
 * own preference when the user has not chosen.
 */
export function hourOptions(ctx: FormatContext = DEFAULT_CTX): Array<{ value: string; label: string }> {
  const twelveHour = ctx.timeFormat ? ctx.timeFormat === '12h' : new Intl.DateTimeFormat(ctx.locale, { hour: 'numeric' }).resolvedOptions().hour12 !== false;
  const out: Array<{ value: string; label: string }> = [];
  for (let h = 0; h < 24; h += 1) {
    const label = twelveHour
      ? `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`
      : `${String(h).padStart(2, '0')}:00`;
    out.push({ value: `${String(h).padStart(2, '0')}:00`, label });
  }
  return out;
}

export const weekdayOptions = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

/* ------------------------------------------------------------------ people */

/** Name order follows the locale, not the storage order. */
export function formatPersonName(
  person: { firstName?: string; lastName?: string; displayName?: string },
  locale: LanguageTag = 'en',
): string {
  if (person.displayName) return person.displayName;
  const first = person.firstName ?? '';
  const last = person.lastName ?? '';
  if (!first && !last) return '—';
  // East Asian naming convention places the family name first.
  if (locale.startsWith('zh') || locale.startsWith('ja') || locale.startsWith('ko')) {
    return `${last}${first}`.trim();
  }
  return `${first} ${last}`.trim();
}

export function initialsOf(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/* ------------------------------------------------------------- phone/address */

/**
 * Phone formatting is permissive on purpose: the mock data includes international
 * numbers, and inventing strict rules per country would produce wrong output. We
 * normalise the display shape and never claim validation.
 */
export function formatPhoneDisplay(value: string, countryCode?: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return digits.replace(/(\+\d{1,3})(\d{2,4})(\d{3,4})(\d{0,4})/, (_m, a, b, c, d) => [a, b, c, d].filter(Boolean).join(' '));
  }
  if (countryCode === 'US' && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

export function formatAddress(
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  },
  style: 'inline' | 'multiline' = 'inline',
  countryNameResolver?: (code: string) => string | undefined,
): string {
  const parts: string[] = [];
  if (address.line1) parts.push(address.line1);
  if (address.line2) parts.push(address.line2);
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
  if (cityLine) parts.push(cityLine);
  const country = address.countryCode ? countryNameResolver?.(address.countryCode) ?? address.countryCode : undefined;
  if (country) parts.push(country);
  return parts.join(style === 'multiline' ? '\n' : ', ');
}

/** Street-address field ordering differs by region; callers use this for form layout. */
export function addressFieldOrder(countryCode?: string): Array<'line1' | 'line2' | 'city' | 'state' | 'postalCode'> {
  // Japan, China and Korea conventionally start with the postal code.
  if (countryCode && ['JP', 'CN', 'KR', 'TW'].includes(countryCode)) {
    return ['postalCode', 'state', 'city', 'line1', 'line2'];
  }
  return ['line1', 'line2', 'city', 'state', 'postalCode'];
}
