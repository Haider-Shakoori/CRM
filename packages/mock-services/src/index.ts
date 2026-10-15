/**
 * `@crm/mock-services` — the browser-side implementation of the CRM service contracts.
 *
 * Every screen reads through this layer, so replacing it with an HTTP client against the
 * future Laravel API is a one-line change in an application's composition root.
 *
 * Honesty contract:
 *   - Nothing performs I/O. No request leaves the browser.
 *   - Anything that would need a backend returns a typed failure rather than a fabricated
 *     success, and the UI renders that failure.
 *   - Derived values (pipeline totals, health scores, SLA states, campaign funnels) are
 *     computed from their underlying records, never stored twice.
 *   - The dataset is generated from a fixed epoch with per-tenant seeds, so it is
 *     reproducible across reloads and in tests.
 */

export { MockDb, STORAGE_KEY, STORAGE_VERSION, defaultPreferences, type MockDatabase, type CollectionName } from './lib/store';
export { createRandom, DATASET_EPOCH, addDays, toDateString, toDateTimeString, daysBetween, type Random } from './lib/random';
export {
  runQuery,
  buildFacets,
  matchesClause,
  matchesGroup,
  applySort,
  buildPageMeta,
  filterGroup,
  clause,
  readPath,
  type QueryOptions,
} from './lib/query';
export {
  createCrud,
  computePipelineTotals,
  daysSince,
  distinctValues,
  delay,
  err,
  ok,
  simulatedFailure,
  nextId,
  type CrudOptions,
  type PipelineTotals,
} from './services/factory';
export { buildDataset } from './seed';
export { createMockServices, type MockServiceContainer } from './services/index';
