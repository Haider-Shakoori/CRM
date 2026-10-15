/**
 * Analytics-adjacent services: export jobs and sales goals.
 *
 * Split out of `index.ts` for the same reason `extra.ts` exists: the container assembly
 * stays readable while every service still follows the one set of rules —
 *
 *  - **Reads are complete** over the seeded store, through `createCrud`/`runQuery`.
 *  - **Writes mutate local state** and persist through the store's transaction helper.
 *  - **Derived values are computed** from the underlying records rather than stored twice.
 *  - **Nothing pretends to be a backend.** Export files are generated in the browser and say
 *    so inside the file itself; a goal's attainment is a ratio of two seeded numbers.
 *
 * There is deliberately no `exports` collection in the store. An export job is a UI concept
 * about a file this browser produced, not a record a server would hold, so it lives in
 * closure state for the life of the session rather than in the persisted database.
 */

import type {
  ExportRequest,
  GoalsService,
  Id,
  ListQuery,
  SalesGoal,
  ServiceContainer,
  WriteOptions,
} from '@crm/shared-types';
import { runQuery } from '../lib/query';
import { MockDb } from '../lib/store';
import { createCrud, delay, err, nextId, ok } from './factory';

type Db = MockDb;

/* --------------------------------------------------------------- export jobs */

/**
 * Extra provenance kept beside each request.
 *
 * `ExportRequest.resource` is a display string. When the export was requested from a report
 * we also remember which report and which rows the reviewer was looking at, so `generate`
 * can rebuild the same table in the file instead of inventing one.
 */
interface ExportProvenance {
  reportId?: Id;
  requestedRowCount: number;
}

/** A CSV cell. Values are quoted so a label containing a comma cannot break the file. */
function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Array<string | number | null>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * Group a report's source records into the rows the report table shows.
 *
 * This mirrors `executeReport` in `index.ts` on purpose: the exported file has to contain the
 * same numbers the on-screen table does, so the aggregation rules are the same. It is a small
 * duplication of logic rather than a cross-service call, because the report service is not
 * reachable from here and a shared helper would need a wider refactor than this batch allows.
 */
function reportRows(db: Db, reportId: Id): Array<Array<string | number | null>> | null {
  const report = db.state.reports[reportId];
  if (!report) return null;

  const source = report.source;
  const records: Array<Record<string, unknown>> =
    source === 'deals' ? (db.all('deals') as unknown as Array<Record<string, unknown>>)
      : source === 'leads' ? (db.all('leads') as unknown as Array<Record<string, unknown>>)
        : source === 'contacts' ? (db.all('contacts') as unknown as Array<Record<string, unknown>>)
          : source === 'accounts' ? (db.all('accounts') as unknown as Array<Record<string, unknown>>)
            : source === 'activities' ? (db.all('activities') as unknown as Array<Record<string, unknown>>)
              : source === 'tickets' ? (db.all('tickets') as unknown as Array<Record<string, unknown>>)
                : source === 'campaigns' ? (db.all('campaigns') as unknown as Array<Record<string, unknown>>)
                  : source === 'renewals' ? (db.all('renewals') as unknown as Array<Record<string, unknown>>)
                    : (db.all('revenueSubscriptions') as unknown as Array<Record<string, unknown>>);

  const groupField = report.config.groupBy[0]?.field ?? 'stageId';
  const measureField = report.config.measure.field;
  const aggregation = report.config.measure.aggregation;

  const buckets = new Map<string, { count: number; total: number }>();
  for (const record of records) {
    const key = String(record[groupField] ?? 'Unknown');
    const entry = buckets.get(key) ?? { count: 0, total: 0 };
    entry.count += 1;
    const raw = record[measureField];
    const numeric = typeof raw === 'number' ? raw : raw && typeof raw === 'object' && 'amount' in (raw as object) ? Number((raw as { amount: number }).amount) : 0;
    entry.total += numeric;
    buckets.set(key, entry);
  }

  const visible = report.columnSet.filter((column) => column.visible);
  const header = visible.map((column) => column.label);
  const body = [...buckets.entries()]
    .map(([key, entry]) => {
      const value = aggregation === 'count' ? entry.count : aggregation === 'average' ? (entry.count > 0 ? Math.round(entry.total / entry.count) : 0) : entry.total;
      const values: Record<string, string | number> = { [groupField]: key, [measureField]: value, [`${measureField}__delta`]: 0 };
      return visible.map((column) => values[column.field] ?? values[column.key] ?? '');
    })
    .sort((a, b) => Number(b[b.length - 1] ?? 0) - Number(a[a.length - 1] ?? 0));

  return [header, ...body];
}

export function makeExportsService(db: Db): ServiceContainer['exports'] {
  const requests: ExportRequest[] = [];
  const provenance = new Map<Id, ExportProvenance>();

  const firstUser = Object.values(db.state.users)[0];
  const organization = Object.values(db.state.organizations)[0];

  // A few historical jobs so the list is not empty on first view. They are derived from the
  // seeded reports rather than fabricated, and every one is flagged as locally generated.
  if (firstUser && organization) {
    const reports = Object.values(db.state.reports).slice(0, 3);
    reports.forEach((report, index) => {
      const id = `exp-${organization.id}-history-${index + 1}`;
      const rowCount = report.lastRun?.rowCount ?? 0;
      requests.push({
        id,
        resource: report.name,
        format: index === 2 ? 'xlsx' : 'csv',
        scope: 'all_matching_filter',
        rowCount,
        includeHiddenColumns: false,
        includeCustomFields: false,
        requestedAt: report.updatedAt,
        requestedById: firstUser.id,
        state: 'ready',
        generatedLocally: true,
        containsPersonalData: false,
        requiresApproval: false,
        note: 'Generated in the browser for the demonstration.',
      });
      provenance.set(id, { reportId: report.id, requestedRowCount: rowCount });
    });
  }

  const page = (query: ListQuery | undefined, items: ExportRequest[]): import('@crm/shared-types').Paginated<ExportRequest> => {
    const sorted = [...items].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
    const pageNumber = Math.max(1, query?.page ?? 1);
    const pageSize = Math.max(1, query?.pageSize ?? 25);
    const start = (pageNumber - 1) * pageSize;
    const slice = sorted.slice(start, start + pageSize);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: slice,
      meta: {
        page: pageNumber,
        pageSize,
        total,
        totalPages,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1,
      },
    };
  };

  return {
    request: async (input) => {
      await delay(`export-request:${input.resource}`, { latency: { min: 220, max: 520 } });

      const user = Object.values(db.state.users)[0];
      if (!user) return err('not_found', 'No signed-in user is available for this export.');

      const record: ExportRequest = {
        ...input,
        id: nextId('exp'),
        requestedAt: new Date().toISOString(),
        // Queued, not ready: the file is produced on demand by generate(), and the UI says so.
        state: 'queued',
        generatedLocally: true,
      };
      requests.unshift(record);
      // The report this export came from, when the resource name matches one. This keeps the
      // generated CSV aligned with what the reviewer was reading.
      const match = Object.values(db.state.reports).find((report) => report.name === record.resource);
      provenance.set(record.id, { reportId: match?.id, requestedRowCount: record.rowCount });
      return ok(record);
    },
    list: async (query = {}) => {
      await delay('export-list', { latency: { min: 60, max: 180 } });
      return page(query, requests);
    },
    generate: async (id) => {
      await delay(`export-generate:${id}`, { latency: { min: 260, max: 620 } });
      const request = requests.find((candidate) => candidate.id === id);
      if (!request) return err('not_found', 'That export request is no longer available.');

      const provenanceEntry = provenance.get(id);
      const rows = provenanceEntry?.reportId ? reportRows(db, provenanceEntry.reportId) : null;

      const headerLines: Array<Array<string | number | null>> = [
        ['CRM demonstration export'],
        ['Generated locally in this browser. Nothing was uploaded, emailed or stored on a server.'],
        ['Resource', request.resource],
        ['Requested', request.requestedAt],
        ['Rows', request.rowCount],
        [],
      ];

      const body = rows ?? [
        ['Status', 'No row-level dataset is held in this browser for this export.'],
        ['Note', 'The request is recorded and the file placeholder is produced locally.'],
      ];

      const content = toCsv([...headerLines, ...body]);
      const filenameBase = request.resource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'export';
      const extension = request.format === 'json' ? 'json' : request.format === 'xlsx' ? 'csv' : request.format;
      const mimeType = request.format === 'json' ? 'application/json' : 'text/csv';

      request.state = 'ready';
      request.note = 'Generated in the browser for the demonstration.';
      provenance.set(id, { reportId: provenanceEntry?.reportId, requestedRowCount: request.rowCount });

      return ok({ id, filename: `${filenameBase}-${id}.${extension}`, content, mimeType });
    },
  };
}

/* --------------------------------------------------------------- sales goals */

export function makeGoalsService(db: Db): ServiceContainer['goals'] {
  const crud = createCrud<SalesGoal>(db, 'salesGoals', {
    label: 'Goal',
    searchFields: ['name', 'metric', 'scope'],
    facetField: 'metric',
    defaultSort: [{ field: 'attainmentPercent', direction: 'desc' }],
  });

  const forUser: GoalsService['forUser'] = async (userId, period) => {
    await delay(`goals-for-user:${userId}:${period}`, { latency: { min: 80, max: 200 } });
    const all = crud.raw();
    const scoped = all.filter((goal) => goal.ownerId === userId && (!period || goal.period === period));
    return runQuery(scoped, {}, { searchFields: ['name'], defaultSort: [{ field: 'periodEnd', direction: 'asc' }] });
  };

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids: Id[], options?: WriteOptions) => crud.bulkRemove(ids, options),
    forUser,
  };
}
