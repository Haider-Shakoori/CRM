'use client';

import * as React from 'react';
import { createMockServices, type MockServiceContainer } from '@crm/mock-services';
import { LiveRegion, notify } from '@crm/ui';

/**
 * Service provider.
 *
 * The application receives the service container through context, so no view imports
 * `@crm/mock-services` directly. Swapping the mock for an HTTP client against the future
 * Laravel API is therefore a change to this file and nothing else.
 *
 * The container is created once per session. Re-creating it on every render would rebuild
 * the seeded dataset, which is expensive and would discard the reviewer's changes.
 */

const ServiceContext = React.createContext<MockServiceContainer | null>(null);

export interface ServiceProviderProps {
  children: React.ReactNode;
  /** Allows a test to inject a container built from a known database. */
  services?: MockServiceContainer;
  /** Persist mock data to localStorage. Disabled inside the public demo. */
  persist?: boolean;
}

export function ServiceProvider({ children, services, persist = true }: ServiceProviderProps) {
  const container = React.useMemo(() => services ?? createMockServices({ persist }), [services, persist]);
  return <ServiceContext.Provider value={container}>{children}</ServiceContext.Provider>;
}

export function useServices(): MockServiceContainer {
  const container = React.useContext(ServiceContext);
  if (!container) {
    throw new Error('useServices must be used inside a <ServiceProvider>.');
  }
  return container;
}

/* ------------------------------------------------------------------- queries */

/**
 * Read a `Result`-returning service method.
 *
 * `loading` is **derived**, not stored: the hook remembers which request key produced the
 * data it holds, and is loading whenever that key differs from the current one. Writing a
 * loading flag synchronously inside the effect would trigger a second render on every mount,
 * which the React Compiler flags for good reason — and which on a dashboard with eight
 * widgets is sixteen wasted renders.
 *
 * The service contract wraps failures in a typed `Result` rather than throwing, so this hook
 * unwraps that shape. A thrown error means the mock itself broke, which is a defect rather
 * than a modelled failure, so it is surfaced rather than swallowed.
 */
export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  /** True while a refetch is in flight but previous data is still shown. */
  refreshing: boolean;
  reload: () => void;
}

interface LoadedOnce<T> {
  key: string;
  data: T | undefined;
  error: string | undefined;
}

export function useAsync<T>(
  loader: () => Promise<import('@crm/shared-types').Result<T>>,
  deps: React.DependencyList,
  options: { skip?: boolean } = {},
): AsyncState<T> {
  const [nonce, setNonce] = React.useState(0);
  const requestKey = `${JSON.stringify(deps)}#${nonce}`;
  const [loaded, setLoaded] = React.useState<LoadedOnce<T> | undefined>(undefined);

  React.useEffect(() => {
    // When skipped there is nothing to load, and the derived loading flag below already
    // reports false for that case.
    if (options.skip) return;

    let cancelled = false;
    loader()
      .then((result) => {
        if (cancelled) return;
        setLoaded({
          key: requestKey,
          data: result.ok ? result.data : undefined,
          error: result.ok ? undefined : result.error.message,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoaded({
          key: requestKey,
          data: undefined,
          error: error instanceof Error ? error.message : 'The request could not be completed.',
        });
      });

    return () => {
      cancelled = true;
    };
    // `requestKey` encodes every dependency, so the effect only re-runs when one changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, options.skip]);

  const reload = React.useCallback(() => setNonce((value) => value + 1), []);

  // The first load for a key shows a skeleton; a later load keeps the previous data visible
  // and reports itself as refreshing instead.
  const isCurrent = loaded?.key === requestKey;
  return {
    data: loaded?.data,
    error: loaded?.error,
    loading: !options.skip && !isCurrent,
    refreshing: !isCurrent && loaded !== undefined,
    reload,
  };
}

/**
 * Read a `Paginated` service method.
 *
 * Separate from `useAsync` because a list never returns a `Result`: pagination failure is not
 * a modelled state, so the hook keeps the simpler shape. Loading is derived for the same
 * reason as above.
 */
export function useList<T>(
  loader: () => Promise<import('@crm/shared-types').Paginated<T>>,
  deps: React.DependencyList,
  options: { skip?: boolean } = {},
): {
  items: T[];
  meta: import('@crm/shared-types').PageMeta | undefined;
  facets: import('@crm/shared-types').Paginated<T>['facets'];
  loading: boolean;
  reload: () => void;
} {
  const [nonce, setNonce] = React.useState(0);
  const requestKey = `${JSON.stringify(deps)}#${nonce}`;
  const [loaded, setLoaded] = React.useState<
    { key: string; items: T[]; meta: import('@crm/shared-types').PageMeta | undefined; facets: import('@crm/shared-types').Paginated<T>['facets'] } | undefined
  >(undefined);

  React.useEffect(() => {
    if (options.skip) return;
    let cancelled = false;
    loader()
      .then((page) => {
        if (cancelled) return;
        setLoaded({ key: requestKey, items: page.items, meta: page.meta, facets: page.facets });
      })
      .catch(() => {
        if (cancelled) return;
        // An empty list is the honest result of a failed read: the screen shows its empty
        // state rather than a partially populated one that implies success.
        setLoaded({ key: requestKey, items: [], meta: undefined, facets: undefined });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, options.skip]);

  return {
    items: loaded?.items ?? [],
    meta: loaded?.meta,
    facets: loaded?.facets,
    loading: !options.skip && loaded?.key !== requestKey,
    reload: React.useCallback(() => setNonce((value) => value + 1), []),
  };
}

/**
 * Run a mutating service method.
 *
 * Owns the three things every write needs and nothing else: a pending flag so the control can
 * show its own spinner, toast feedback that is honest about simulated actions, and a typed
 * error surfaced for inline display.
 */
export function useMutation<TInput, TOutput>(
  mutate: (input: TInput) => Promise<import('@crm/shared-types').Result<TOutput>>,
  options: {
    successMessage?: string | ((result: TOutput, input: TInput) => string);
    /** Wording used when the action is simulated rather than performed against a backend. */
    simulated?: boolean;
    onSuccess?: (result: TOutput, input: TInput) => void;
    onError?: (message: string, input: TInput) => void;
  } = {},
): {
  run: (input: TInput) => Promise<TOutput | undefined>;
  pending: boolean;
  error: string | undefined;
  fieldErrors: import('@crm/shared-types').FieldError[] | undefined;
  reset: () => void;
} {
  const [state, setState] = React.useState<{
    pending: boolean;
    error: string | undefined;
    fieldErrors: import('@crm/shared-types').FieldError[] | undefined;
  }>({ pending: false, error: undefined, fieldErrors: undefined });

  const run = React.useCallback(
    async (input: TInput) => {
      setState({ pending: true, error: undefined, fieldErrors: undefined });
      try {
        const result = await mutate(input);
        if (!result.ok) {
          setState({ pending: false, error: result.error.message, fieldErrors: result.error.fieldErrors });
          options.onError?.(result.error.message, input);
          if (!options.onError) notify.error(result.error.message);
          return undefined;
        }

        setState({ pending: false, error: undefined, fieldErrors: undefined });
        const message =
          typeof options.successMessage === 'function'
            ? options.successMessage(result.data, input)
            : options.successMessage;
        if (message) {
          if (options.simulated) notify.simulated(message);
          else notify.success(message);
        }
        options.onSuccess?.(result.data, input);
        return result.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The action could not be completed.';
        setState({ pending: false, error: message, fieldErrors: undefined });
        notify.error(message);
        return undefined;
      }
    },
    [mutate, options],
  );

  return {
    ...state,
    run,
    reset: React.useCallback(() => setState({ pending: false, error: undefined, fieldErrors: undefined }), []),
  };
}

/**
 * Announce a message to assistive technology.
 *
 * Used after optimistic updates and simulated actions, where the visual change may be subtle
 * or off-screen for the person who triggered it.
 */
export function useAnnouncer() {
  const [message, setMessage] = React.useState('');
  const announce = React.useCallback((next: string) => {
    // Clearing first guarantees a repeat of the same message is still announced.
    setMessage('');
    window.setTimeout(() => setMessage(next), 50);
  }, []);
  const region = <LiveRegion message={message} />;
  return { announce, region };
}

/** Format a date for display. Kept here so screens do not each invent their own. */
export function formatDate(value: string | undefined, style: 'short' | 'relative' = 'short'): string {
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
  }
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}
