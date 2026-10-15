/**
 * The query engine.
 *
 * One implementation of search, filtering, sorting, pagination and facet counting, used by
 * every list view in the CRM. This mirrors what the future REST API must do, so the
 * behaviour a reviewer sees here is the behaviour the backend should reproduce.
 *
 * Design decisions worth noting:
 *  - Filter groups are recursive, because saved views, segment builders, report definitions
 *    and workflow conditions all need `(A and B) or (C and D)`.
 *  - Facets are computed over the *filtered but unpaginated* set, so a filter chip can show
 *    the true count behind it rather than only what fits on the current page.
 *  - Free-text search writes no index; it scans a configured field list. That is honest:
 *    the real implementation needs a database, and pretending otherwise would hide the
 *    work that migration actually requires.
 */

import type { FilterClause, FilterGroup, ListQuery, PageMeta, Paginated, SortSpec } from '@crm/shared-types';

export interface QueryOptions<T> {
  /** Fields included in free-text search. Dot-paths into nested objects are supported. */
  searchFields: Array<keyof T | string>;
  /** Field used for the facet breakdown, if the caller wants facets. */
  facetField?: string;
  /** Value formatter for facet labels. Defaults to the raw value. */
  facetLabel?: (value: unknown) => string;
  /** Hard ceiling on page size, mirroring the API contract. */
  maxPageSize?: number;
  defaultPageSize?: number;
  defaultSort?: SortSpec[];
}

/** Read a possibly nested value by dot-path. */
export function readPath(source: unknown, path: string): unknown {
  if (source === null || source === undefined) return undefined;
  const segments = path.split('.');
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    // Support `products.0.name` style array access without a full JSON path parser.
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Normalise a value for comparison: strings lowercase, dates to epoch millis. */
function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    // Detect ISO dates so `gt`/`lt` work on date strings, not just Date objects.
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return value.toLowerCase();
  }
  return value;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/** Evaluate one leaf condition. */
export function matchesClause(record: unknown, clause: FilterClause): boolean {
  const actual = readPath(record, clause.field);
  const actualComparable = comparable(actual);
  const expected = clause.value;

  switch (clause.operator) {
    case 'eq':
      return actualComparable === comparable(expected);
    case 'neq':
      return actualComparable !== comparable(expected);
    case 'contains':
      return asString(actual).toLowerCase().includes(asString(expected).toLowerCase());
    case 'not_contains':
      return !asString(actual).toLowerCase().includes(asString(expected).toLowerCase());
    case 'starts_with':
      return asString(actual).toLowerCase().startsWith(asString(expected).toLowerCase());
    case 'ends_with':
      return asString(actual).toLowerCase().endsWith(asString(expected).toLowerCase());
    case 'in':
      return Array.isArray(expected) ? expected.map(comparable).includes(actualComparable) : false;
    case 'not_in':
      return Array.isArray(expected) ? !expected.map(comparable).includes(actualComparable) : true;
    case 'gt':
      return typeof actualComparable === 'number' && typeof comparable(expected) === 'number'
        ? actualComparable > (comparable(expected) as number)
        : false;
    case 'gte':
      return typeof actualComparable === 'number' && typeof comparable(expected) === 'number'
        ? actualComparable >= (comparable(expected) as number)
        : false;
    case 'lt':
      return typeof actualComparable === 'number' && typeof comparable(expected) === 'number'
        ? actualComparable < (comparable(expected) as number)
        : false;
    case 'lte':
      return typeof actualComparable === 'number' && typeof comparable(expected) === 'number'
        ? actualComparable <= (comparable(expected) as number)
        : false;
    case 'between': {
      const range = expected as { from?: unknown; to?: unknown } | undefined;
      if (!range || typeof actualComparable !== 'number') return false;
      const from = comparable(range.from);
      const to = comparable(range.to);
      return (from === undefined || actualComparable >= (from as number)) && (to === undefined || actualComparable <= (to as number));
    }
    case 'is_empty':
      return actual === null || actual === undefined || asString(actual).trim() === '' || (Array.isArray(actual) && actual.length === 0);
    case 'is_not_empty':
      return !(actual === null || actual === undefined || asString(actual).trim() === '' || (Array.isArray(actual) && actual.length === 0));
    default:
      // An unknown operator must not silently match everything.
      return false;
  }
}

function isFilterGroup(value: FilterClause | FilterGroup): value is FilterGroup {
  return typeof (value as FilterGroup).conjunction === 'string' && Array.isArray((value as FilterGroup).clauses);
}

/** Evaluate a recursive filter group. */
export function matchesGroup(record: unknown, group: FilterGroup | undefined): boolean {
  if (!group) return true;
  const clauses = group.clauses ?? [];
  if (clauses.length === 0) return true;
  const results = clauses.map((clause) => (isFilterGroup(clause) ? matchesGroup(record, clause) : matchesClause(record, clause)));
  return group.conjunction === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function compareValues(a: unknown, b: unknown): number {
  const left = comparable(a);
  const right = comparable(b);
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return asString(left).localeCompare(asString(right));
}

/** Apply sorting, honouring multiple keys in order. */
export function applySort<T>(records: T[], sort: SortSpec[] | undefined): T[] {
  if (!sort || sort.length === 0) return records;
  return [...records].sort((a, b) => {
    for (const spec of sort) {
      const result = compareValues(readPath(a, spec.field), readPath(b, spec.field));
      if (result !== 0) return spec.direction === 'desc' ? -result : result;
    }
    return 0;
  });
}

export function buildPageMeta(page: number, pageSize: number, total: number): PageMeta {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Run a full query against an array of records.
 *
 * Order of operations: filter → search → sort → facets → paginate. Facets are computed
 * before pagination on purpose, so counts reflect the whole filtered set.
 */
export function runQuery<T>(records: T[], query: ListQuery = {}, options: QueryOptions<T>): Paginated<T> {
  const page = Math.max(1, query.page ?? 1);
  const requestedSize = query.pageSize ?? options.defaultPageSize ?? 25;
  const pageSize = Math.min(Math.max(1, requestedSize), options.maxPageSize ?? 200);

  let result = records;

  if (query.filter) {
    result = result.filter((record) => matchesGroup(record, query.filter));
  }

  const term = query.q?.trim().toLowerCase();
  if (term) {
    result = result.filter((record) =>
      options.searchFields.some((field) => asString(readPath(record, String(field))).toLowerCase().includes(term)),
    );
  }

  if (query.ids && query.ids.length > 0) {
    const wanted = new Set(query.ids);
    result = result.filter((record) => wanted.has(String((record as { id?: string }).id)));
  }

  result = applySort(result, query.sort ?? options.defaultSort);

  const facets = options.facetField
    ? buildFacets(result, options.facetField, options.facetLabel)
    : undefined;

  const total = result.length;
  const start = (page - 1) * pageSize;

  return {
    items: result.slice(start, start + pageSize),
    meta: buildPageMeta(page, pageSize, total),
    ...(facets ? { facets: { [options.facetField!]: facets } } : {}),
  };
}

/** Count occurrences of a field's value across the result set. */
export function buildFacets<T>(records: T[], field: string, label?: (value: unknown) => string) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const raw = readPath(record, field);
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      const key = String(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: label ? label(value) : value, count }))
    .sort((a, b) => b.count - a.count);
}

/** Convenience builder used by tests and saved views. */
export function filterGroup(conjunction: 'and' | 'or', ...clauses: Array<FilterClause | FilterGroup>): FilterGroup {
  return { id: `g-${conjunction}-${clauses.length}`, conjunction, clauses };
}

export function clause(field: string, operator: FilterClause['operator'], value?: unknown): FilterClause {
  return { field, operator, value };
}
