'use client';

import * as React from 'react';
import { cn } from './lib/utils';

/* ---------------------------------------------------------------- theming */

export type ThemePreference = 'light' | 'dark' | 'system';
export type DensityPreference = 'comfortable' | 'compact' | 'spacious';
export type Direction = 'ltr' | 'rtl';
export type AccentPreset =
  | 'violet'
  | 'teal'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate';

export interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
  density: DensityPreference;
  setDensity: (density: DensityPreference) => void;
  contrast: 'default' | 'high';
  setContrast: (contrast: 'default' | 'high') => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  direction: Direction;
  setDirection: (direction: Direction) => void;
  locale: string;
  setLocale: (locale: string) => void;
  accent: AccentPreset;
  setAccent: (accent: AccentPreset) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'crm.ui.preferences';

interface StoredPreferences {
  theme?: ThemePreference;
  density?: DensityPreference;
  contrast?: 'default' | 'high';
  reducedMotion?: boolean;
  accent?: AccentPreset;
  locale?: string;
}

function readStored(): StoredPreferences {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPreferences) : {};
  } catch {
    // Corrupt or unavailable storage must never break rendering.
    return {};
  }
}

function writeStored(patch: StoredPreferences) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...patch }));
  } catch {
    /* storage disabled — preferences simply do not persist */
  }
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemePreference;
  defaultDensity?: DensityPreference;
  defaultDirection?: Direction;
  defaultLocale?: string;
  defaultAccent?: AccentPreset;
  /** Element that receives the data attributes. Defaults to `document.documentElement`. */
  target?: HTMLElement | null;
  /** Persist to localStorage. Disabled inside the public interactive demo. */
  persist?: boolean;
}

/**
 * Applies theme, density, contrast, motion, direction, locale and accent to the DOM
 * through data attributes. Because every token in the design system is a CSS custom
 * property scoped to those attributes, changing a preference never requires a re-render
 * of the component tree.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultDensity = 'comfortable',
  defaultDirection = 'ltr',
  defaultLocale = 'en',
  defaultAccent = 'violet',
  target,
  persist = true,
}: ThemeProviderProps) {
  const stored = React.useMemo(() => (persist ? readStored() : {}), [persist]);
  const [theme, setThemeState] = React.useState<ThemePreference>(stored.theme ?? defaultTheme);
  const [density, setDensityState] = React.useState<DensityPreference>(stored.density ?? defaultDensity);
  const [contrast, setContrastState] = React.useState<'default' | 'high'>(stored.contrast ?? 'default');
  const [reducedMotion, setReducedMotionState] = React.useState<boolean>(stored.reducedMotion ?? false);
  const [accent, setAccentState] = React.useState<AccentPreset>(stored.accent ?? defaultAccent);
  const [direction, setDirectionState] = React.useState<Direction>(defaultDirection);
  const [locale, setLocaleState] = React.useState<string>(stored.locale ?? defaultLocale);
  // The initial value is read during render rather than assigned inside an effect, which
  // avoids a cascading render on mount. Subscription handles later changes.
  const [systemDark, setSystemDark] = React.useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  // Track the OS preference so `theme: 'system'` stays live.
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  React.useEffect(() => {
    const el = target ?? (typeof document === 'undefined' ? null : document.documentElement);
    if (!el) return;
    el.setAttribute('data-theme', resolvedTheme);
    el.setAttribute('data-density', density);
    el.setAttribute('data-contrast', contrast);
    el.setAttribute('data-reduced-motion', String(reducedMotion));
    el.setAttribute('data-accent', accent);
    el.setAttribute('dir', direction);
    el.setAttribute('lang', locale);
  }, [target, resolvedTheme, density, contrast, reducedMotion, accent, direction, locale]);

  const setTheme = React.useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      if (persist) writeStored({ theme: next });
    },
    [persist],
  );
  const setDensity = React.useCallback(
    (next: DensityPreference) => {
      setDensityState(next);
      if (persist) writeStored({ density: next });
    },
    [persist],
  );
  const setContrast = React.useCallback(
    (next: 'default' | 'high') => {
      setContrastState(next);
      if (persist) writeStored({ contrast: next });
    },
    [persist],
  );
  const setReducedMotion = React.useCallback(
    (next: boolean) => {
      setReducedMotionState(next);
      if (persist) writeStored({ reducedMotion: next });
    },
    [persist],
  );
  const setAccent = React.useCallback(
    (next: AccentPreset) => {
      setAccentState(next);
      if (persist) writeStored({ accent: next });
    },
    [persist],
  );
  const setLocale = React.useCallback(
    (next: string) => {
      setLocaleState(next);
      if (persist) writeStored({ locale: next });
    },
    [persist],
  );
  const setDirection = React.useCallback((next: Direction) => setDirectionState(next), []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      density,
      setDensity,
      contrast,
      setContrast,
      reducedMotion,
      setReducedMotion,
      direction,
      setDirection,
      locale,
      setLocale,
      accent,
      setAccent,
    }),
    [theme, resolvedTheme, setTheme, density, setDensity, contrast, setContrast, reducedMotion, setReducedMotion, direction, setDirection, locale, setLocale, accent, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside a <ThemeProvider>.');
  }
  return context;
}

/** Non-throwing variant for components that may render outside a provider (e.g. Astro islands). */
export function useOptionalTheme(): ThemeContextValue | null {
  return React.useContext(ThemeContext);
}

/* ------------------------------------------------------------------ hooks */

/** Tailwind-aligned media query hook so JS behaviour matches the CSS breakpoints. */
export function useMediaQuery(query: string): boolean {
  // Initial value comes from the current match, so there is no extra render on mount and
  // no flash of the wrong layout.
  const [matches, setMatches] = React.useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export const breakpointQueries = {
  xs: '(min-width: 22.5rem)',
  mobile: '(min-width: 26.875rem)',
  tablet: '(min-width: 48rem)',
  tabletLg: '(min-width: 64rem)',
  laptop: '(min-width: 85.375rem)',
  desktop: '(min-width: 90rem)',
  coarsePointer: '(pointer: coarse)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

export function useIsMobile(): boolean {
  return !useMediaQuery(breakpointQueries.tablet);
}

export function usePrefersReducedMotion(): boolean {
  const systemPrefers = useMediaQuery(breakpointQueries.reducedMotion);
  const { reducedMotion } = useTheme();
  return systemPrefers || reducedMotion;
}

/**
 * Persisted local UI state.
 *
 * Used for column widths, dismissed banners, saved view selections and the demo-mode
 * preferences. It is namespaced and resettable, and it never stores anything sensitive.
 */
export function useLocalState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = React.useState<T>(() => {
    if (typeof localStorage === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(`crm.local.${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = React.useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        try {
          localStorage.setItem(`crm.local.${key}`, JSON.stringify(next));
        } catch {
          /* ignore quota or privacy-mode failures */
        }
        return next;
      });
    },
    [key],
  );

  const reset = React.useCallback(() => {
    try {
      localStorage.removeItem(`crm.local.${key}`);
    } catch {
      /* ignore */
    }
    setState(initial);
  }, [key, initial]);

  return [state, set, reset];
}

/** Scroll-position helper used by sticky marketing headers. */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/**
 * Announce content to screen readers without moving focus.
 * Used for optimistic updates, reconciliation results and simulated actions.
 */
export function LiveRegion({ message, className }: { message: string; className?: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className={cn('sr-only', className)}>
      {message}
    </div>
  );
}

/** Focus trap fallback for overlay primitives that render outside Radix. */
export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>, restoreFocus = true) {
  React.useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    focusables[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      if (restoreFocus) previouslyFocused?.focus?.();
    };
  }, [active, containerRef, restoreFocus]);
}
