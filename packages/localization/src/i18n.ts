/**
 * i18n configuration and RTL helpers.
 *
 * The i18n instance is created framework-agnostically so the same setup serves the
 * Astro website, the CRM application and the platform admin console. React bindings
 * (`react-i18next`) simply consume the instance.
 *
 * Missing keys fall back to English and, in development, log a warning rather than
 * rendering a raw key into the interface.
 */

import i18next, { type i18n as I18nInstance } from 'i18next';
import { crmLocales, getLocale, isRtl, locales, referenceLocale, websiteLocales, type Direction } from './locales';
import { namespace, resources } from './translations';

export interface CreateI18nOptions {
  /** Locale to start in. Defaults to the reference locale on the server. */
  locale?: string;
  /** Which locale set is selectable. */
  surface?: 'website' | 'crm' | 'portal' | 'admin';
  /** Detect the browser language when no explicit locale is provided. */
  detectBrowserLanguage?: boolean;
  /** Log a console warning when a key is missing. Enabled outside production builds. */
  warnOnMissingKeys?: boolean;
}

function selectableLocales(surface: CreateI18nOptions['surface']) {
  switch (surface) {
    case 'website':
      return websiteLocales;
    case 'crm':
      return crmLocales;
    case 'portal':
      return locales.filter((l) => l.portal);
    default:
      return locales.filter((l) => l.crm);
  }
}

/** Match a browser language tag to the closest supported locale. */
export function negotiateLocale(candidates: string[], available: string[]): string {
  for (const candidate of candidates) {
    const exact = available.find((a) => a.toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
    const base = candidate.split('-')[0]?.toLowerCase();
    if (!base) continue;
    const partial = available.find((a) => a.toLowerCase() === base || a.toLowerCase().startsWith(`${base}-`));
    if (partial) return partial;
  }
  return referenceLocale;
}

export function createI18n(options: CreateI18nOptions = {}): I18nInstance {
  const surface = options.surface ?? 'crm';
  const available = selectableLocales(surface).map((l) => l.code);
  let initial = options.locale ?? referenceLocale;

  if (!available.includes(initial) && options.detectBrowserLanguage && typeof navigator !== 'undefined') {
    initial = negotiateLocale([...(navigator.languages ?? [navigator.language])], available);
  }
  if (!available.includes(initial)) initial = referenceLocale;

  const instance = i18next.createInstance();

  instance.init({
    lng: initial,
    fallbackLng: referenceLocale,
    supportedLngs: [...new Set([...available, referenceLocale])],
    defaultNS: namespace,
    ns: [namespace],
    resources: Object.fromEntries(
      Object.entries(resources).map(([code, entry]) => [code, { [namespace]: entry.translation }]),
    ),
    interpolation: {
      // React and Astro already escape output; double escaping would corrupt entities.
      escapeValue: false,
    },
    returnNull: false,
    saveMissing: false,
    missingKeyHandler: options.warnOnMissingKeys
      ? (_lngs, ns, key) => {
          console.warn(`[i18n] missing key "${key}" in namespace "${ns}"`);
        }
      : undefined,
    react: { useSuspense: false },
  });

  return instance;
}

/** Locale metadata for the current language of an instance. */
export function currentLocaleMeta(instance: I18nInstance) {
  const code = instance.resolvedLanguage ?? instance.language ?? referenceLocale;
  return {
    ...getLocale(code),
    /** True when the requested language is being served by a fallback dictionary. */
    isFallback: !resources[instance.language ?? ''] ,
  };
}

export interface DirectionContext {
  locale: string;
  direction: Direction;
  /** Tailwind/logical-property friendly attribute values for the document element. */
  attributes: Record<string, string>;
  /** Localized date/time/number/currency defaults for the locale. */
  formatting: {
    currency: string;
    timezone: string;
    weekStartsOn: 0 | 1 | 6;
    numberFormat: 'standard' | 'indian';
  };
}

export function directionContext(locale: string): DirectionContext {
  const meta = getLocale(locale);
  return {
    locale: meta.intlCode,
    direction: meta.direction,
    attributes: {
      lang: meta.intlCode,
      dir: meta.direction,
      'data-locale': meta.code,
      'data-direction': meta.direction,
    },
    formatting: {
      currency: meta.suggestedCurrency,
      timezone: meta.suggestedTimezone,
      weekStartsOn: meta.weekStartsOn,
      // Indian digit grouping is a user preference, not an automatic locale behaviour.
      numberFormat: meta.code === 'hi' ? 'indian' : 'standard',
    },
  };
}

/**
 * Logical-property helpers.
 *
 * RTL support must not be fragile. Components use Tailwind logical utilities
 * (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`) which
 * flip automatically. These helpers exist only for the handful of cases where a real
 * value is needed in JavaScript — SVG coordinates, chart margins, canvas node offsets.
 */
export const logical = {
  /** Inline-start offset in a given direction. */
  inlineStart: (direction: Direction): 'left' | 'right' => (direction === 'rtl' ? 'right' : 'left'),
  inlineEnd: (direction: Direction): 'left' | 'right' => (direction === 'rtl' ? 'left' : 'right'),
  /** Chart margins: a y-axis on the reading-start side must move in RTL. */
  chartMargin: (direction: Direction, base: { top: number; right: number; bottom: number; left: number }) =>
    direction === 'rtl' ? { ...base, left: base.right, right: base.left } : base,
  /** Mirror a percentage position within a container. */
  mirrorPercent: (percent: number, direction: Direction): string =>
    direction === 'rtl' ? `${100 - percent}%` : `${percent}%`,
  /** Directional icons that must not be rotated in RTL (chevrons do; clocks do not). */
  shouldMirrorIcon: (name: string): boolean =>
    ['ArrowLeft', 'ArrowRight', 'ChevronLeft', 'ChevronRight', 'ArrowUpRight', 'CornerDownRight', 'IndentIncrease', 'Reply'].includes(name),
  /** Text direction for a single value that may differ from the document (e.g. a phone number). */
  isolate: (value: string): string => `\u2068${value}\u2069`,
} as const;

export { locales, crmLocales, websiteLocales, getLocale, isRtl, referenceLocale };
export type { Direction };
