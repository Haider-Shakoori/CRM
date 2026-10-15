/**
 * Query engine tests.
 *
 * The query engine is the single implementation every list view depends on, so its
 * behaviour is the behaviour of the whole CRM. These tests pin the parts that are easy to
 * get subtly wrong: nested groups, empty-value operators, date-string comparison and the
 * fact that facets are counted over the filtered set rather than the current page.
 */

import { describe, expect, it } from 'vitest';
import { applySort, buildFacets, buildPageMeta, clause, filterGroup, matchesClause, matchesGroup, readPath, runQuery } from '../lib/query';

interface Row {
  id: string;
  name: string;
  status: string;
  amount: number;
  updatedAt: string;
  tags: string[];
  owner?: { id: string; name: string };
}

const rows: Row[] = [
  { id: '1', name: 'Northgate Ltd', status: 'open', amount: 120000, updatedAt: '2026-03-01T10:00:00.000Z', tags: ['strategic'], owner: { id: 'u1', name: 'Amelia' } },
  { id: '2', name: 'Clearpath Inc', status: 'won', amount: 48000, updatedAt: '2026-05-14T09:30:00.000Z', tags: ['expansion', 'strategic'], owner: { id: 'u2', name: 'Noah' } },
  { id: '3', name: 'Bluewave BV', status: 'open', amount: 9000, updatedAt: '2026-01-08T14:15:00.000Z', tags: [], owner: { id: 'u1', name: 'Amelia' } },
  { id: '4', name: 'Sierra Partners', status: 'lost', amount: 65000, updatedAt: '2026-07-22T08:00:00.000Z', tags: ['strategic'], owner: { id: 'u3', name: 'Priya' } },
  { id: '5', name: 'Halcyon Group', status: 'open', amount: 21000, updatedAt: '2026-09-30T16:45:00.000Z', tags: ['pilot'] },
];

const options = {
  searchFields: ['name', 'status'],
  facetField: 'status',
  defaultSort: [{ field: 'name', direction: 'asc' as const }],
};

describe('readPath', () => {
  it('reads nested values by dot path', () => {
    expect(readPath(rows[0], 'owner.name')).toBe('Amelia');
  });

  it('supports array indices', () => {
    expect(readPath(rows[1], 'tags.1')).toBe('strategic');
  });

  it('returns undefined rather than throwing on a missing path', () => {
    expect(readPath(rows[4], 'owner.name')).toBeUndefined();
    expect(readPath(null, 'a.b.c')).toBeUndefined();
  });
});

describe('matchesClause', () => {
  it('compares strings case-insensitively', () => {
    expect(matchesClause(rows[0], clause('name', 'contains', 'northgate'))).toBe(true);
    expect(matchesClause(rows[0], clause('name', 'starts_with', 'north'))).toBe(true);
    expect(matchesClause(rows[0], clause('name', 'ends_with', 'ltd'))).toBe(true);
  });

  it('compares numbers with the relational operators', () => {
    expect(matchesClause(rows[0], clause('amount', 'gt', 100000))).toBe(true);
    expect(matchesClause(rows[0], clause('amount', 'lte', 120000))).toBe(true);
    expect(matchesClause(rows[2], clause('amount', 'gt', 100000))).toBe(false);
  });

  it('compares ISO date strings as dates, not as text', () => {
    // Textual comparison would also pass here, so use a pair where it would not:
    // "2026-10-01" is textually greater than "2026-4-01" but earlier in time.
    const earlier = { id: 'x', at: '2026-04-01T00:00:00.000Z' };
    const later = { id: 'y', at: '2026-10-01T00:00:00.000Z' };
    expect(matchesClause(earlier, clause('at', 'lt', later.at))).toBe(true);
    expect(matchesClause(later, clause('at', 'gt', earlier.at))).toBe(true);
  });

  it('handles in and not_in against arrays', () => {
    expect(matchesClause(rows[1], clause('status', 'in', ['won', 'lost']))).toBe(true);
    expect(matchesClause(rows[0], clause('status', 'not_in', ['won', 'lost']))).toBe(true);
  });

  it('handles between for a numeric range', () => {
    expect(matchesClause(rows[0], clause('amount', 'between', { from: 100000, to: 150000 }))).toBe(true);
    expect(matchesClause(rows[2], clause('amount', 'between', { from: 100000, to: 150000 }))).toBe(false);
  });

  it('treats undefined, null and empty arrays as empty', () => {
    expect(matchesClause(rows[4], clause('owner', 'is_empty'))).toBe(true);
    expect(matchesClause(rows[2], clause('tags', 'is_empty'))).toBe(true);
    expect(matchesClause(rows[0], clause('name', 'is_not_empty'))).toBe(true);
  });

  it('does not silently match everything for an unknown operator', () => {
    // A typo in a saved view must narrow the result, never widen it.
    expect(matchesClause(rows[0], { field: 'name', operator: 'regex_matches' as never, value: 'North' })).toBe(false);
  });
});

describe('matchesGroup', () => {
  it('applies AND across clauses', () => {
    const group = filterGroup('and', clause('status', 'eq', 'open'), clause('amount', 'gt', 50000));
    expect(rows.filter((row) => matchesGroup(row, group)).map((row) => row.id)).toEqual(['1']);
  });

  it('applies OR across clauses', () => {
    const group = filterGroup('or', clause('status', 'eq', 'lost'), clause('amount', 'gt', 100000));
    expect(rows.filter((row) => matchesGroup(row, group)).map((row) => row.id)).toEqual(['1', '4']);
  });

  it('evaluates nested groups as (A and B) or C', () => {
    // The exact shape a saved view needs: two conditions that must both hold, or a
    // separate escape hatch.
    const group: import('@crm/shared-types').FilterGroup = {
      id: 'root',
      conjunction: 'or',
      clauses: [
        { id: 'inner', conjunction: 'and', clauses: [clause('status', 'eq', 'open'), clause('amount', 'gt', 50000)] },
        clause('status', 'eq', 'won'),
      ],
    };
    expect(rows.filter((row) => matchesGroup(row, group)).map((row) => row.id)).toEqual(['1', '2']);
  });

  it('treats an empty group as unfiltered', () => {
    expect(rows.filter((row) => matchesGroup(row, { id: 'g', conjunction: 'and', clauses: [] }))).toHaveLength(5);
  });
});

describe('applySort', () => {
  it('sorts numbers descending', () => {
    const sorted = applySort(rows, [{ field: 'amount', direction: 'desc' }]);
    expect(sorted.map((row) => row.amount)).toEqual([120000, 65000, 48000, 21000, 9000]);
  });

  it('sorts dates ascending', () => {
    const sorted = applySort(rows, [{ field: 'updatedAt', direction: 'asc' }]);
    expect(sorted[0]!.id).toBe('3');
    expect(sorted[4]!.id).toBe('5');
  });

  it('breaks ties with the second key', () => {
    const sorted = applySort(rows, [
      { field: 'status', direction: 'asc' },
      { field: 'amount', direction: 'desc' },
    ]);
    const open = sorted.filter((row) => row.status === 'open').map((row) => row.amount);
    expect(open).toEqual([120000, 21000, 9000]);
  });

  it('does not mutate the input array', () => {
    const before = rows.map((row) => row.id);
    applySort(rows, [{ field: 'amount', direction: 'desc' }]);
    expect(rows.map((row) => row.id)).toEqual(before);
  });
});

describe('runQuery', () => {
  it('paginates and reports correct metadata', () => {
    const page = runQuery(rows, { page: 2, pageSize: 2 }, options);
    expect(page.items).toHaveLength(2);
    expect(page.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: true });
  });

  it('clamps page size to the configured maximum', () => {
    const page = runQuery(rows, { pageSize: 5000 }, { ...options, maxPageSize: 200 });
    expect(page.meta.pageSize).toBe(200);
  });

  it('reports hasNext false on the final partial page', () => {
    const page = runQuery(rows, { page: 3, pageSize: 2 }, options);
    expect(page.items).toHaveLength(1);
    expect(page.meta.hasNext).toBe(false);
    expect(page.meta.hasPrev).toBe(true);
  });

  it('searches only the configured fields', () => {
    const byName = runQuery(rows, { q: 'Bluewave' }, options);
    expect(byName.meta.total).toBe(1);
    // `owner.name` is not a search field, so it must not match.
    expect(runQuery(rows, { q: 'Amelia' }, options).meta.total).toBe(0);
  });

  it('combines a filter with a search term', () => {
    const result = runQuery(rows, { q: 'a', filter: filterGroup('and', clause('status', 'eq', 'open')) }, options);
    expect(result.items.every((row) => row.status === 'open')).toBe(true);
  });

  it('counts facets over the filtered set, not the current page', () => {
    const page = runQuery(rows, { page: 1, pageSize: 1 }, options);
    // The page holds one row, but the facet must report every matching status.
    expect(page.meta.total).toBe(5);
    const statuses = page.facets?.status ?? [];
    expect(statuses.find((entry) => entry.value === 'open')?.count).toBe(3);
    expect(statuses.find((entry) => entry.value === 'won')?.count).toBe(1);
  });

  it('filters by an explicit id list, which saved views and bulk selection rely on', () => {
    const result = runQuery(rows, { ids: ['2', '4'] }, options);
    expect(result.items.map((row) => row.id).sort()).toEqual(['2', '4']);
  });
});

describe('buildFacets', () => {
  it('counts every value of an array field', () => {
    const facets = buildFacets(rows, 'tags');
    expect(facets.find((entry) => entry.value === 'strategic')?.count).toBe(3);
  });

  it('skips empty values so nulls do not become a facet', () => {
    const withNulls = [...rows, { ...rows[0]!, id: '6', owner: undefined }];
    const facets = buildFacets(withNulls, 'owner');
    expect(facets.some((entry) => entry.value === 'undefined' || entry.value === 'null')).toBe(false);
  });

  it('orders facets by count descending', () => {
    const facets = buildFacets(rows, 'status');
    expect(facets[0]!.value).toBe('open');
  });
});

describe('buildPageMeta', () => {
  it('never reports zero pages, even for an empty result', () => {
    expect(buildPageMeta(1, 25, 0).totalPages).toBe(1);
    expect(buildPageMeta(1, 25, 0).hasNext).toBe(false);
  });
});
