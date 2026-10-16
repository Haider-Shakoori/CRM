/**
 * Service implementation helpers.
 *
 * The mock layer satisfies the same contracts the future REST API will, which means it has
 * to reproduce the parts of a real API that the UI genuinely depends on:
 *
 *  - **Simulated latency.** Every call resolves after a short, deterministic delay so
 *    loading skeletons and optimistic updates are exercised rather than theoretically
 *    supported.
 *  - **Typed failures.** `WriteOptions.simulate` can force a validation error, a conflict,
 *    a permission denial, a missing entitlement, a server error or an offline response.
 *    This is how error states get built and reviewed before a real server can produce them.
 *  - **Optimistic concurrency.** `expectedUpdatedAt` is compared and rejected when stale, so
 *    the conflict path is real rather than decorative.
 *  - **Partial bulk outcomes.** Bulk operations report per-record failures instead of a
 *    single boolean.
 *
 * Nothing here performs I/O, and nothing pretends to.
 */

import type {
  AppErrorBody,
  AppErrorCode,
  BulkActionOutcome,
  Id,
  ListQuery,
  Paginated,
  Result,
  WriteOptions,
} from '@crm/shared-types';
import { runQuery, type QueryOptions } from '../lib/query';
import type { CollectionName, MockDb } from '../lib/store';

/** Deterministic latency derived from a seed so runs are reproducible. */
export function latencyFor(seed: string, options?: WriteOptions): number {
  const min = options?.latency?.min ?? 90;
  const max = options?.latency?.max ?? options?.latency ? options.latency.max! : 260;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  const span = Math.max(0, max - min);
  return min + (hash % (span + 1));
}

/** Wait for the simulated latency. Deterministic per operation key. */
export function delay(key: string, options?: WriteOptions): Promise<void> {
  if (options?.latency?.min === 0 && options?.latency?.max === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, latencyFor(key, options)));
}

/* ------------------------------------------------------------------ results */

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(code: AppErrorCode, message: string, extra?: Partial<AppErrorBody>): Result<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: code === 'unexpected' || code === 'offline' || code === 'rate_limited',
      ...extra,
    },
  };
}

/**
 * Resolve a `WriteOptions.simulate` request into a failure, or `null` to proceed.
 *
 * This exists so every mutation shares one implementation of the failure modes. A feature
 * that wants to demonstrate a conflict does not need its own fake-error branch.
 */
export function simulatedFailure<T>(options: WriteOptions | undefined, fieldPath = 'name'): Result<T> | null {
  switch (options?.simulate) {
    case 'validation_error':
      return err<T>('validation_failed', 'Please correct the highlighted fields.', {
        fieldErrors: [{ path: fieldPath, message: 'This value is not accepted in the current configuration.' }],
      });
    case 'conflict':
      return err<T>('conflict', 'This record was changed by someone else while you were editing it.', {
        traceId: 'conflict-demo',
      });
    case 'forbidden':
      return err<T>('forbidden', 'Your role does not include permission to make this change.');
    case 'entitlement_missing':
      return err<T>('entitlement_missing', 'This capability is not included in your current plan.');
    case 'server_error':
      return err<T>('unexpected', 'The request could not be completed.', { traceId: 'server-error-demo' });
    case 'offline':
      return err<T>('offline', 'You appear to be offline. Your changes are held in this browser.');
    default:
      return null;
  }
}

/* --------------------------------------------------------------- factories */

export interface CrudOptions<T> {
  /** Human label used in error messages. */
  label: string;
  /** Resolve the current organization for tenant-scoped collections. */
  activeOrganizationId?: () => Id;
  /** Fields included in free-text search. */
  searchFields: Array<keyof T | string>;
  facetField?: string;
  defaultSort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  /** Applied on create when the caller omits them. */
  defaultsFor?: (input: unknown, db: MockDb) => Partial<T>;
  /** Server-owned fields stripped from create input. */
  serverOwned?: string[];
  /** Validate before writing. Returning a string rejects the write. */
  validate?: (input: unknown) => string | null;
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function nowIso(): string {
  // The dataset uses a fixed epoch for seeded records, but records created during a session
  // are stamped with the real time so "just now" is truthful in the interface.
  return new Date().toISOString();
}

/**
 * The generic CRUD service.
 *
 * Every collection in the CRM is a list view over a keyed record set, so the read path is
 * identical for all of them. Domain-specific behaviour is layered on top by the container
 * rather than duplicated per service.
 */
export function createCrud<T extends { id: Id; createdAt?: string; updatedAt?: string }>(
  db: MockDb,
  collection: CollectionName,
  options: CrudOptions<T>,
) {
  const queryOptions: QueryOptions<T> = {
    searchFields: options.searchFields,
    facetField: options.facetField,
    defaultSort: options.defaultSort ?? [{ field: 'updatedAt', direction: 'desc' }],
  };

  const belongsToActiveOrganization = (record: T | undefined): record is T =>
    Boolean(record && (!options.activeOrganizationId ||
      (record as T & { organizationId: Id }).organizationId === options.activeOrganizationId()));
  const all = () => (db.all(collection) as unknown as T[]).filter(belongsToActiveOrganization);
  const ownedRecord = (id: Id): T | undefined => {
    const record = db.get(collection, id) as unknown as T | undefined;
    return belongsToActiveOrganization(record) ? record : undefined;
  };

  return {
    async list(query: ListQuery = {}): Promise<Paginated<T>> {
      const scope = query as ListQuery & { organizationId?: Id };
      let records = all();
      if (scope.organizationId) {
        records = records.filter((record) => (record as { organizationId?: Id }).organizationId === scope.organizationId);
      }
      if (query.includeArchived === false) {
        records = records.filter((record) => !(record as { archivedAt?: string }).archivedAt);
      }
      await delay(`list:${String(collection)}:${query.page ?? 1}`, { latency: { min: 60, max: 200 } });
      return runQuery(records, query, queryOptions);
    },

    async get(id: Id): Promise<Result<T>> {
      await delay(`get:${String(collection)}:${id}`, { latency: { min: 40, max: 140 } });
      const record = ownedRecord(id);
      if (!record) {
        return err<T>('not_found', `${options.label} not found. The record may have been deleted.`, { traceId: `nf-${id}` });
      }
      return ok(record);
    },

    async create(input: unknown, writeOptions?: WriteOptions): Promise<Result<T>> {
      const failure = simulatedFailure<T>(writeOptions);
      if (failure) {
        await delay(`create-fail:${String(collection)}`, writeOptions);
        return failure;
      }
      await delay(`create:${String(collection)}`, writeOptions);

      const validationMessage = options.validate?.(input);
      if (validationMessage) {
        return err<T>('validation_failed', validationMessage, { fieldErrors: [{ path: 'name', message: validationMessage }] });
      }

      const requestedOrganizationId = (input as { organizationId?: Id }).organizationId;
      if (options.activeOrganizationId && requestedOrganizationId && requestedOrganizationId !== options.activeOrganizationId()) {
        return err<T>('forbidden', 'A record cannot be created for another organization.');
      }
      const stamped = {
        ...(options.defaultsFor?.(input, db) ?? {}),
        ...(input as Record<string, unknown>),
        ...(options.activeOrganizationId ? { organizationId: options.activeOrganizationId() } : {}),
      } as T;

      const record = {
        ...stamped,
        id: (stamped as { id?: Id }).id ?? nextId(String(collection).slice(0, 4)),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } as T;

      db.put(collection, record as never);
      return ok(record);
    },

    async update(id: Id, input: unknown, writeOptions?: WriteOptions): Promise<Result<T>> {
      const failure = simulatedFailure<T>(writeOptions);
      if (failure) {
        await delay(`update-fail:${String(collection)}`, writeOptions);
        return failure;
      }
      await delay(`update:${String(collection)}`, writeOptions);

      const existing = ownedRecord(id);
      if (!existing) {
        return err<T>('not_found', `${options.label} not found.`);
      }

      // Optimistic concurrency: reject a write built on a stale copy.
      const expected = (input as { expectedUpdatedAt?: string }).expectedUpdatedAt;
      if (expected && existing.updatedAt && expected !== existing.updatedAt) {
        return err<T>('conflict', 'This record changed while you were editing it. Reload to see the current values.', {
          traceId: `conflict-${id}`,
        });
      }

      const patch = { ...(input as Record<string, unknown>) };
      delete patch.expectedUpdatedAt;
      delete patch.organizationId;
      delete patch.id;
      delete patch.createdAt;

      const updated = { ...existing, ...patch, id, updatedAt: nowIso() } as T;
      db.put(collection, updated as never);
      return ok(updated);
    },

    async remove(id: Id, writeOptions?: WriteOptions): Promise<Result<{ id: Id }>> {
      const failure = simulatedFailure<{ id: Id }>(writeOptions);
      if (failure) return failure;
      await delay(`remove:${String(collection)}`, writeOptions);
      if (!ownedRecord(id)) {
        return err<{ id: Id }>('not_found', `${options.label} not found.`);
      }
      db.remove(collection, id);
      return ok({ id });
    },

    async bulkRemove(ids: Id[], writeOptions?: WriteOptions): Promise<Result<BulkActionOutcome>> {
      await delay(`bulk-remove:${String(collection)}`, writeOptions);
      const failures: Array<{ id: Id; reason: string }> = [];
      const removable: Id[] = [];
      for (const id of ids) {
        if (ownedRecord(id)) removable.push(id);
        else failures.push({ id, reason: 'Record not found' });
      }
      const removed = db.removeMany(collection, removable);
      return ok({ requested: ids.length, succeeded: removed, failed: failures.length, failures });
    },

    async archive(id: Id): Promise<Result<T>> {
      await delay(`archive:${String(collection)}`);
      const existing = ownedRecord(id);
      if (!existing) return err<T>('not_found', `${options.label} not found.`);
      const archived = { ...existing, archivedAt: nowIso(), updatedAt: nowIso() } as T;
      db.put(collection, archived as never);
      return ok(archived);
    },

    async restore(id: Id): Promise<Result<T>> {
      await delay(`restore:${String(collection)}`);
      const existing = ownedRecord(id);
      if (!existing) return err<T>('not_found', `${options.label} not found.`);
      const restored = { ...existing, archivedAt: undefined, updatedAt: nowIso() } as T;
      db.put(collection, restored as never);
      return ok(restored);
    },

    /** Apply the same patch to several records. Used by every bulk action. */
    async bulkPatch(ids: Id[], patch: Record<string, unknown>, label: string): Promise<Result<BulkActionOutcome>> {
      await delay(`bulk-patch:${String(collection)}:${label}`);
      const failures: Array<{ id: Id; reason: string }> = [];
      let succeeded = 0;
      const safePatch = { ...patch };
      delete safePatch.organizationId;
      delete safePatch.id;
      delete safePatch.createdAt;
      for (const id of ids) {
        const existing = ownedRecord(id);
        if (!existing) {
          failures.push({ id, reason: 'Record not found' });
          continue;
        }
        db.put(collection, { ...existing, ...safePatch, id, updatedAt: nowIso() } as never);
        succeeded += 1;
      }
      return ok({ requested: ids.length, succeeded, failed: failures.length, failures });
    },

    /** Read tenant-scoped records without pagination or sorting. */
    raw(): T[] {
      return all();
    },
  };
}

/* ------------------------------------------------------------ rollup helpers */

export interface PipelineTotals {
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  averageAgeDays: number;
  staleCount: number;
  byStage: Array<{ stageId: Id; dealCount: number; totalValue: number; weightedValue: number; averageAgeDays: number; staleCount: number }>;
}

/**
 * Recompute pipeline totals from the current deal set.
 *
 * The single most important consistency rule in the product: the kanban board, the stage
 * headers, the weighted pipeline figure and the forecast all read from this one function.
 * Computing a total in more than one place is how a UI ends up contradicting itself.
 */
export function computePipelineTotals(
  deals: Array<{ stageId: Id; status: string; amount: { amount: number }; probability: number; daysInStage: number; isStale: boolean }>,
): PipelineTotals {
  const open = deals.filter((deal) => deal.status === 'open');
  const byStageMap = new Map<Id, { count: number; value: number; weighted: number; ageTotal: number; stale: number }>();

  for (const deal of open) {
    const entry = byStageMap.get(deal.stageId) ?? { count: 0, value: 0, weighted: 0, ageTotal: 0, stale: 0 };
    entry.count += 1;
    entry.value += deal.amount.amount;
    entry.weighted += (deal.amount.amount * deal.probability) / 100;
    entry.ageTotal += deal.daysInStage;
    if (deal.isStale) entry.stale += 1;
    byStageMap.set(deal.stageId, entry);
  }

  const totalValue = open.reduce((sum, deal) => sum + deal.amount.amount, 0);
  const weightedValue = open.reduce((sum, deal) => sum + (deal.amount.amount * deal.probability) / 100, 0);
  const ageTotal = open.reduce((sum, deal) => sum + deal.daysInStage, 0);

  return {
    dealCount: open.length,
    totalValue,
    weightedValue: Math.round(weightedValue),
    averageAgeDays: open.length > 0 ? Math.round(ageTotal / open.length) : 0,
    staleCount: open.filter((deal) => deal.isStale).length,
    byStage: [...byStageMap.entries()].map(([stageId, entry]) => ({
      stageId,
      dealCount: entry.count,
      totalValue: entry.value,
      weightedValue: Math.round(entry.weighted),
      averageAgeDays: entry.count > 0 ? Math.round(entry.ageTotal / entry.count) : 0,
      staleCount: entry.stale,
    })),
  };
}

/** Whole days between an ISO timestamp and the dataset epoch. */
export function daysSince(iso: string, from: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((from.getTime() - then) / 86_400_000));
}

/** Distinct values of a field, for filter option lists. */
export function distinctValues<T>(records: T[], field: keyof T | string): string[] {
  const seen = new Set<string>();
  for (const record of records) {
    const value = (record as Record<string, unknown>)[field as string];
    if (typeof value === 'string' && value) seen.add(value);
  }
  return [...seen].sort();
}
