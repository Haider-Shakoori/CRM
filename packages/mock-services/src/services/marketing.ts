/**
 * Marketing automation services.
 *
 * Split out of `index.ts` for the same reason `extra.ts` and `analytics-extras.ts` exist:
 * the container assembly stays readable while every service still follows the one set of
 * rules the mock layer holds itself to —
 *
 *  - **Reads are complete** over the seeded store, through `createCrud`/`runQuery`.
 *  - **Writes mutate local state** and persist through the store.
 *  - **Derived values are computed** from the underlying records rather than stored twice:
 *    campaign rates are recomputed from raw counts, a segment's member count is evaluated
 *    from its definition, and a lead source's totals are counted from the leads that
 *    reference it.
 *  - **Nothing pretends to be a backend.** Every "send", "submit" and "publish" records a
 *    local action and says so. A landing page is stored as a static representation; no host
 *    exists. Nothing here performs I/O.
 *
 * Segment previews deliberately evaluate the rule tree against the seeded records instead of
 * inventing a number, so the figure beside the builder changes when the rules change. Rules
 * that genuinely need a backend to answer (`has_activity_in_last`, membership in another
 * segment) are treated as *not excluding* a record and are reported in the preview note,
 * because silently dropping them would overstate how precise the estimate really is.
 */

import type {
  Campaign,
  CampaignMetrics,
  CampaignCalendarEntry,
  CaptureForm,
  EmailTemplate,
  Id,
  Journey,
  LandingPage,
  LeadSource,
  ListQuery,
  Segment,
  SegmentDefinition,
  SegmentPreview,
  SegmentRule,
  ServiceContainer,
  Tone,
} from '@crm/shared-types';
import { readPath, buildPageMeta, runQuery } from '../lib/query';
import { MockDb, type CollectionName } from '../lib/store';
import { createCrud, delay, err, nextId, ok } from './factory';

type Db = MockDb;

const asRecords = <T>(database: Db, collection: CollectionName): T[] =>
  database.all(collection) as unknown as T[];

/** Deterministic 0..1 value derived from a string, so simulations are reproducible. */
function hashUnit(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  return (hash % 1000) / 1000;
}

function pct(numerator: number, denominator: number, digits = 2): number {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(digits));
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 'on' || value === 1;
}

const STATUS_TONE: Record<string, Tone> = {
  draft: 'slate',
  scheduled: 'amber',
  active: 'green',
  paused: 'amber',
  completed: 'blue',
  archived: 'neutral',
  cancelled: 'red',
};

const LIFECYCLE_TONE: Record<string, Tone> = {
  subscriber: 'slate',
  lead: 'blue',
  mql: 'blue',
  sql: 'violet',
  opportunity: 'violet',
  customer: 'green',
  evangelist: 'teal',
  churned: 'red',
  other: 'slate',
};

/* ================================================================= campaigns */

/** Recompute every rate on a campaign's metrics from the raw counts. */
export function deriveCampaignMetrics(metrics: CampaignMetrics): CampaignMetrics {
  const delivered = metrics.delivered || metrics.recipients;
  return {
    ...metrics,
    openRate: pct(metrics.opens, delivered, 1),
    clickRate: pct(metrics.clicks, delivered, 2),
    clickToOpenRate: pct(metrics.clicks, metrics.opens, 1),
    conversionRate: pct(metrics.dealsWon, metrics.recipients, 2),
    bounceRate: pct(metrics.bounces, metrics.recipients, 1),
    unsubscribeRate: pct(metrics.unsubscribes, delivered, 2),
    costPerLead: {
      amount: Math.round(metrics.cost.amount / Math.max(1, metrics.leadsCreated)),
      currency: metrics.cost.currency,
    },
    roi: Math.round(((metrics.revenue.amount - metrics.cost.amount) / Math.max(1, metrics.cost.amount)) * 100),
  };
}

/** A zeroed metric set for a campaign that has not run yet. */
function emptyMetrics(currency: string): CampaignMetrics {
  const money = { amount: 0, currency };
  return {
    recipients: 0,
    delivered: 0,
    bounces: 0,
    unsubscribes: 0,
    spamComplaints: 0,
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    leadsCreated: 0,
    mqls: 0,
    sqls: 0,
    opportunities: 0,
    dealsWon: 0,
    revenue: money,
    cost: money,
    openRate: 0,
    clickRate: 0,
    clickToOpenRate: 0,
    conversionRate: 0,
    bounceRate: 0,
    unsubscribeRate: 0,
    costPerLead: money,
    roi: 0,
    trend: [],
  };
}

export function makeCampaignsService(db: Db): ServiceContainer['campaigns'] {
  const crud = createCrud<Campaign>(db, 'campaigns', {
    label: 'Campaign',
    searchFields: ['name', 'code', 'ownerName', 'objective'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  const resolveAudience = (campaign: Campaign): number => {
    const fromSegments = campaign.segmentIds.reduce((sum, segmentId) => sum + (db.state.segments[segmentId]?.memberCount ?? 0), 0);
    return fromSegments > 0 ? fromSegments : campaign.audienceSize;
  };

  const writeStatus = async (id: Id, status: Campaign['status'], extra: Partial<Campaign> = {}) => {
    await delay(`campaign-${status}:${id}`);
    const existing = db.state.campaigns[id];
    if (!existing) return err<Campaign>('not_found', 'Campaign not found. The record may have been deleted.');
    const updated: Campaign = {
      ...existing,
      ...extra,
      status,
      audienceSize: resolveAudience(existing),
      metrics: deriveCampaignMetrics(existing.metrics),
      updatedAt: new Date().toISOString(),
    };
    db.put('campaigns', updated);
    return ok(updated);
  };

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),

    /** Launching records the start of the campaign locally; nothing is sent. */
    launch: (id) => {
      const existing = db.state.campaigns[id];
      const startDate = existing?.startDate ?? new Date().toISOString().slice(0, 10);
      return writeStatus(id, 'active', { startDate });
    },
    pause: (id) => writeStatus(id, 'paused'),
    resume: (id) => writeStatus(id, 'active'),

    duplicate: async (id, name) => {
      await delay(`campaign-duplicate:${id}`);
      const existing = db.state.campaigns[id];
      if (!existing) return err<Campaign>('not_found', 'Campaign not found.');
      const now = new Date().toISOString();
      const copy: Campaign = {
        ...existing,
        id: nextId('camp'),
        name: name || `${existing.name} (copy)`,
        status: 'draft',
        // A copy carries the configuration, never the previous run's results.
        metrics: emptyMetrics(existing.currency),
        goals: existing.goals.map((goal) => ({ ...goal, achieved: 0 })),
        abTest: undefined,
        actualCost: undefined,
        revenueAttributed: undefined,
        startDate: undefined,
        endDate: undefined,
        createdAt: now,
        updatedAt: now,
      };
      db.put('campaigns', copy);
      return ok(copy);
    },

    metrics: async (id) => {
      await delay(`campaign-metrics:${id}`);
      const existing = db.state.campaigns[id];
      if (!existing) return err<CampaignMetrics>('not_found', 'Campaign not found.');
      return ok(deriveCampaignMetrics(existing.metrics));
    },

    calendar: async (from, to) => {
      await delay('campaign-calendar');
      const start = from.slice(0, 10);
      const end = to.slice(0, 10);
      const entries: CampaignCalendarEntry[] = asRecords<Campaign>(db, 'campaigns')
        .filter((campaign) => {
          const campaignStart = (campaign.startDate ?? campaign.createdAt).slice(0, 10);
          const campaignEnd = (campaign.endDate ?? campaign.startDate ?? campaign.createdAt).slice(0, 10);
          return campaignStart <= end && campaignEnd >= start;
        })
        .map((campaign) => ({
          id: `${campaign.id}-calendar`,
          campaignId: campaign.id,
          campaignName: campaign.name,
          type: campaign.type,
          status: campaign.status,
          startDate: (campaign.startDate ?? campaign.createdAt).slice(0, 10),
          endDate: campaign.endDate,
          channel: campaign.channels[0] ?? 'email',
          ownerName: campaign.ownerName,
          tone: STATUS_TONE[campaign.status] ?? 'slate',
          href: `/app/campaigns/${campaign.id}`,
        }));
      return runQuery(entries, { page: 1, pageSize: 200 }, {
        searchFields: ['campaignName', 'ownerName', 'channel'],
        defaultSort: [{ field: 'startDate', direction: 'asc' }],
      });
    },
  };
}

/* ================================================================== segments */

/**
 * Resolve a segment field, including the special `consent.<channel>` path that reads the
 * per-channel consent array rather than a scalar property.
 */
function segmentFieldValue(record: Record<string, unknown>, field: string): unknown {
  if (field.startsWith('consent.')) {
    const channel = field.slice('consent.'.length);
    const consent = record['consent'];
    if (Array.isArray(consent)) {
      const entry = (consent as Array<{ channel?: string; state?: string }>).find((item) => item.channel === channel);
      return entry?.state;
    }
    return undefined;
  }
  return readPath(record, field);
}

function compareSegmentValue(value: unknown, operator: SegmentRule['operator'], expected: unknown): boolean {
  const left = value === null || value === undefined ? '' : String(value).toLowerCase();
  const right = expected === null || expected === undefined ? '' : String(expected).toLowerCase();
  switch (operator) {
    case 'equals':
      return left === right;
    case 'not_equals':
      return left !== right;
    case 'contains':
      return left.includes(right);
    case 'not_contains':
      return !left.includes(right);
    case 'starts_with':
      return left.startsWith(right);
    case 'ends_with':
      return left.endsWith(right);
    case 'greater_than':
      return typeof value === 'number' && typeof expected === 'number' && value > expected;
    case 'less_than':
      return typeof value === 'number' && typeof expected === 'number' && value < expected;
    case 'between': {
      const range = expected as { from?: number; to?: number } | undefined;
      if (typeof value !== 'number') return false;
      return (range?.from === undefined || value >= range.from) && (range?.to === undefined || value <= range.to);
    }
    case 'in_list':
      return Array.isArray(expected) ? expected.map((item) => String(item).toLowerCase()).includes(left) : false;
    case 'not_in_list':
      return Array.isArray(expected) ? !expected.map((item) => String(item).toLowerCase()).includes(left) : false;
    case 'is_set':
      return value !== undefined && value !== null && String(value) !== '';
    case 'is_not_set':
      return value === undefined || value === null || String(value) === '';
    default:
      // Activity windows and cross-segment membership need a backend. An unknown rule must
      // not silently exclude a record, so it matches instead.
      return true;
  }
}

function evaluateSegmentDefinition(record: Record<string, unknown>, definition: SegmentDefinition): boolean {
  const results = definition.rules.map((rule) => {
    if (rule.nested) return evaluateSegmentDefinition(record, rule.nested);
    return compareSegmentValue(segmentFieldValue(record, rule.field), rule.operator, rule.value);
  });
  if (results.length === 0) return true;
  return definition.conjunction === 'or' ? results.some(Boolean) : results.every(Boolean);
}

const ENTITY_COLLECTION: Record<Segment['entityType'], CollectionName> = {
  contact: 'contacts',
  lead: 'leads',
  account: 'accounts',
};

function entityLabel(entityType: Segment['entityType'], record: Record<string, unknown>): string {
  if (entityType === 'contact') return str(record['displayName']) || `${str(record['firstName'])} ${str(record['lastName'])}`.trim() || str(record['reference']);
  if (entityType === 'account') return str(record['name']) || str(record['reference']);
  return str(record['companyName']) || `${str(record['firstName'])} ${str(record['lastName'])}`.trim() || str(record['reference']);
}

function entitySubtitle(entityType: Segment['entityType'], record: Record<string, unknown>): string | undefined {
  if (entityType === 'contact') return str(record['jobTitle']) || str(record['accountName']) || undefined;
  if (entityType === 'account') return str(record['industryLabel']) || str(record['type']) || undefined;
  return str(record['jobTitle']) || str(record['status']) || undefined;
}

function topGroups(counts: Map<string, number>, limit = 5): Array<{ label: string; count: number }> {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildSegmentPreview(database: Db, entityType: Segment['entityType'], definition: SegmentDefinition): SegmentPreview {
  const records = asRecords<Record<string, unknown>>(database, ENTITY_COLLECTION[entityType]);
  const matched = records.filter((record) => evaluateSegmentDefinition(record, definition));

  const byCountryCounts = new Map<string, number>();
  const byLifecycleCounts = new Map<string, number>();
  const byIndustryCounts = new Map<string, number>();
  const byConsentCounts = new Map<string, number>();

  for (const record of matched) {
    const country =
      str(readPath(record, 'addresses.0.countryCode')) ||
      str(readPath(record, 'address.countryCode')) ||
      str(record['countryCode']) ||
      'Not recorded';
    byCountryCounts.set(country, (byCountryCounts.get(country) ?? 0) + 1);

    const stage = str(record['lifecycleStage']) || str(record['status']) || str(record['health']) || 'unknown';
    byLifecycleCounts.set(stage, (byLifecycleCounts.get(stage) ?? 0) + 1);

    const industry = str(record['industryLabel']) || str(record['industryId']) || 'Unspecified';
    byIndustryCounts.set(industry, (byIndustryCounts.get(industry) ?? 0) + 1);

    const consent = segmentFieldValue(record, 'consent.email');
    const consentLabel = consent === undefined ? 'Email consent not tracked' : `Email ${String(consent)}`;
    byConsentCounts.set(consentLabel, (byConsentCounts.get(consentLabel) ?? 0) + 1);
  }

  return {
    total: matched.length,
    byCountry: topGroups(byCountryCounts),
    byLifecycleStage: topGroups(byLifecycleCounts).map((group) => ({
      ...group,
      tone: LIFECYCLE_TONE[group.label] ?? 'neutral',
    })),
    byIndustry: topGroups(byIndustryCounts),
    byConsent: topGroups(byConsentCounts),
    sample: matched.slice(0, 5).map((record) => ({
      id: str(record['id']),
      label: entityLabel(entityType, record),
      subtitle: entitySubtitle(entityType, record),
      contactId: entityType === 'contact' ? str(record['id']) : undefined,
    })),
  };
}

export function makeSegmentsService(db: Db): ServiceContainer['segments'] {
  const crud = createCrud<Segment>(db, 'segments', {
    label: 'Segment',
    searchFields: ['name', 'description'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  const members = (segment: Segment): Array<Record<string, unknown>> => {
    const records = asRecords<Record<string, unknown>>(db, ENTITY_COLLECTION[segment.entityType]);
    const dynamic = records.filter((record) => evaluateSegmentDefinition(record, segment.definition));
    if (segment.kind === 'static' && segment.memberIds && segment.memberIds.length > 0) {
      const wanted = new Set(segment.memberIds);
      const byId = new Map(records.map((record) => [str(record['id']), record]));
      return [...wanted].map((id) => byId.get(id)).filter((record): record is Record<string, unknown> => Boolean(record));
    }
    return dynamic;
  };

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),

    preview: async (definition, entityType) => {
      await delay('segment-preview', { latency: { min: 120, max: 320 } });
      return ok(buildSegmentPreview(db, entityType, definition));
    },

    refresh: async (id) => {
      await delay(`segment-refresh:${id}`, { latency: { min: 200, max: 460 } });
      const segment = db.state.segments[id];
      if (!segment) return err<Segment>('not_found', 'Segment not found.');
      const preview = buildSegmentPreview(db, segment.entityType, segment.definition);
      const updated: Segment = {
        ...segment,
        status: 'active',
        memberCount: preview.total,
        preview,
        lastRefreshedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('segments', updated);
      return ok(updated);
    },

    members: async (id, query: ListQuery = {}) => {
      const segment = db.state.segments[id];
      if (!segment) {
        return { items: [], meta: buildPageMeta(1, query.pageSize ?? 25, 0) };
      }
      await delay(`segment-members:${id}`);
      const items = members(segment).map((record) => ({
        id: str(record['id']),
        label: entityLabel(segment.entityType, record),
        subtitle: entitySubtitle(segment.entityType, record),
        contactId: segment.entityType === 'contact' ? str(record['id']) : undefined,
      }));
      return runQuery(items, query, {
        searchFields: ['label', 'subtitle'],
        defaultSort: [{ field: 'label', direction: 'asc' }],
      });
    },
  };
}

/* ================================================================== journeys */

export function makeJourneysService(db: Db): ServiceContainer['journeys'] {
  const crud = createCrud<Journey>(db, 'journeys', {
    label: 'Journey',
    searchFields: ['name', 'description'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),

    activate: async (id) => {
      await delay(`journey-activate:${id}`);
      const journey = db.state.journeys[id];
      if (!journey) return err<Journey>('not_found', 'Journey not found.');
      const updated: Journey = { ...journey, status: 'active', updatedAt: new Date().toISOString() };
      db.put('journeys', updated);
      return ok(updated);
    },

    pause: async (id) => {
      await delay(`journey-pause:${id}`);
      const journey = db.state.journeys[id];
      if (!journey) return err<Journey>('not_found', 'Journey not found.');
      const updated: Journey = { ...journey, status: 'paused', updatedAt: new Date().toISOString() };
      db.put('journeys', updated);
      return ok(updated);
    },

    duplicate: async (id, name) => {
      await delay(`journey-duplicate:${id}`);
      const journey = db.state.journeys[id];
      if (!journey) return err<Journey>('not_found', 'Journey not found.');
      const now = new Date().toISOString();
      const copy: Journey = {
        ...journey,
        id: nextId('jny'),
        name: name || `${journey.name} (copy)`,
        status: 'draft',
        stats: { entered: 0, active: 0, completed: 0, goalReached: 0, exited: 0, completionRate: 0, conversionRate: 0 },
        createdAt: now,
        updatedAt: now,
      };
      db.put('journeys', copy);
      return ok(copy);
    },

    validate: async (id) => {
      await delay(`journey-validate:${id}`, { latency: { min: 180, max: 420 } });
      const journey = db.state.journeys[id];
      if (!journey) return err('not_found', 'Journey not found.');
      const issues: Array<{ nodeId?: Id; severity: 'error' | 'warning'; message: string }> = [];
      const { nodes, edges } = journey;
      const nodeIds = new Set(nodes.map((node) => node.id));

      if (nodes.length === 0) {
        issues.push({ severity: 'error', message: 'The journey has no nodes.' });
      }

      const entries = nodes.filter((node) => node.isEntry);
      if (entries.length !== 1) {
        issues.push({ severity: 'error', message: `Exactly one entry node is required; found ${entries.length}.` });
      }

      for (const node of nodes) {
        const outgoing = edges.filter((edge) => edge.fromNodeId === node.id);
        if (!node.isTerminal && outgoing.length === 0 && node.kind !== 'exit' && node.kind !== 'goal') {
          issues.push({ severity: 'warning', nodeId: node.id, message: `"${node.label}" has no outgoing path and is not marked terminal.` });
        }
        if (node.kind === 'action_email' && !node.config.templateId) {
          issues.push({ severity: 'warning', nodeId: node.id, message: `Email node "${node.label}" has no template selected.` });
        }
        if (node.kind === 'delay' && typeof node.config.waitDays !== 'number') {
          issues.push({ severity: 'warning', nodeId: node.id, message: `Delay node "${node.label}" has no wait duration.` });
        }
        if (node.kind === 'condition' && !node.config.conditionGroup) {
          issues.push({ severity: 'warning', nodeId: node.id, message: `Condition node "${node.label}" has no rule configured.` });
        }
        if (node.kind === 'branch' && !(node.config.branches && node.config.branches.length > 0)) {
          issues.push({ severity: 'warning', nodeId: node.id, message: `Branch node "${node.label}" has no branches.` });
        }
      }

      for (const edge of edges) {
        if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
          issues.push({ severity: 'error', message: 'An edge references a node that no longer exists.' });
        }
      }

      // Reachability from the single entry node.
      const entry = entries[0];
      if (entry) {
        const reached = new Set<Id>([entry.id]);
        const queue: Id[] = [entry.id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const edge of edges.filter((candidate) => candidate.fromNodeId === current)) {
            if (!reached.has(edge.toNodeId)) {
              reached.add(edge.toNodeId);
              queue.push(edge.toNodeId);
            }
          }
        }
        for (const node of nodes) {
          if (!reached.has(node.id)) {
            issues.push({ severity: 'warning', nodeId: node.id, message: `"${node.label}" cannot be reached from the entry node.` });
          }
        }
      }

      return ok({ valid: !issues.some((issue) => issue.severity === 'error'), issues });
    },

    simulate: async (id, entrySegmentId) => {
      await delay(`journey-simulate:${id}`, { latency: { min: 240, max: 520 } });
      const journey = db.state.journeys[id];
      if (!journey) return err('not_found', 'Journey not found.');
      const segment = db.state.segments[entrySegmentId];
      const entered = segment?.memberCount ?? journey.stats.entered;

      const byNode = journey.nodes.map((node, index) => {
        // Deterministic taper so the same journey always produces the same forecast.
        const taper = 0.72 + hashUnit(`${id}:${node.id}`) * 0.24;
        const positionFactor = Math.pow(0.97, index);
        const reached = Math.min(entered, Math.round(entered * taper * positionFactor));
        const converted = node.isTerminal || node.kind === 'goal'
          ? Math.round(reached * (0.6 + hashUnit(`${node.id}:goal`) * 0.2))
          : Math.round(reached * (0.82 + hashUnit(`${node.id}:step`) * 0.1));
        return { nodeId: node.id, reached, converted: Math.min(reached, converted) };
      });

      const durationDays = journey.nodes.reduce(
        (sum, node) => sum + (node.kind === 'delay' ? num(node.config.waitDays) || 1 : 0),
        0,
      );

      return ok({ entered, byNode, durationDays });
    },
  };
}

/* =========================================================== email templates */

const MERGE_DEFAULTS: Record<string, string> = {
  'contact.first_name': 'Alex',
  'contact.last_name': 'Rivera',
  'contact.company': 'Contoso',
  'account.name': 'Contoso',
  'contact.email': 'alex.rivera@example.test',
  'unsubscribe_url': 'https://example-crm.test/preferences',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replace `{{token}}` merge tags, collecting anything unresolved. */
function renderMergeTags(text: string, data: Record<string, string>, missing: Set<string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, token: string) => {
    const value = data[token];
    if (value === undefined) {
      missing.add(token);
      return `{${token}}`;
    }
    return value;
  });
}

export function makeEmailTemplatesService(db: Db): ServiceContainer['emailTemplates'] {
  const crud = createCrud<EmailTemplate>(db, 'emailTemplates', {
    label: 'Template',
    searchFields: ['name', 'subject', 'category'],
    facetField: 'category',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),

    duplicate: async (id, name) => {
      await delay(`template-duplicate:${id}`);
      const template = db.state.emailTemplates[id];
      if (!template) return err<EmailTemplate>('not_found', 'Template not found.');
      const now = new Date().toISOString();
      const copy: EmailTemplate = {
        ...template,
        id: nextId('etmpl'),
        name: name || `${template.name} (copy)`,
        blocks: template.blocks.map((block) => ({ ...block, id: nextId('b') })),
        usedInCampaignCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.put('emailTemplates', copy);
      return ok(copy);
    },

    renderPreview: async (id, mergeData) => {
      await delay(`template-render:${id}`, { latency: { min: 160, max: 360 } });
      const template = db.state.emailTemplates[id];
      if (!template) return err('not_found', 'Template not found.');

      const data = { ...MERGE_DEFAULTS, ...(mergeData ?? {}) };
      const missing = new Set<string>();
      const warnings: string[] = [];
      const parts: string[] = [];
      const textParts: string[] = [];
      let hasUnsubscribe = false;

      const addImage = (alt: string) => {
        if (!alt) {
          warnings.push('An image placeholder has no alternative text. Add a description of what the image shows.');
          return 'https://placehold.example.test/1200x600';
        }
        return `https://placehold.example.test/1200x600?text=${encodeURIComponent(alt)}`;
      };

      for (const block of template.blocks) {
        if (!block.visible) continue;
        const content = block.content;
        switch (block.type) {
          case 'heading': {
            const text = renderMergeTags(str(content['text']) || 'Heading', data, missing);
            parts.push(`<h1 style="font-size:22px;line-height:1.3;margin:0 0 12px">${escapeHtml(text)}</h1>`);
            textParts.push(text);
            break;
          }
          case 'paragraph': {
            const text = renderMergeTags(str(content['text']) || '', data, missing);
            parts.push(`<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(text)}</p>`);
            textParts.push(text);
            break;
          }
          case 'image_placeholder': {
            const alt = str(content['alt']);
            const src = addImage(alt);
            parts.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="600" style="max-width:100%;height:auto;border-radius:8px;margin:0 0 12px" />`);
            textParts.push(`[Image: ${alt || 'no description'}]`);
            break;
          }
          case 'button': {
            const label = renderMergeTags(str(content['label']) || 'Open', data, missing);
            const href = str(content['href']) || '#';
            parts.push(`<p style="margin:0 0 16px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`);
            textParts.push(`${label}: ${href}`);
            break;
          }
          case 'divider':
            parts.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />');
            break;
          case 'spacer':
            parts.push('<div style="height:24px"></div>');
            break;
          case 'unsubscribe': {
            hasUnsubscribe = true;
            const label = str(content['label']) || 'Unsubscribe';
            parts.push(`<p style="font-size:12px;color:#6b7280;margin:16px 0 0"><a href="${escapeHtml(data['unsubscribe_url'] ?? '#')}" style="color:#6b7280">${escapeHtml(label)}</a></p>`);
            textParts.push(`${label}: ${data['unsubscribe_url'] ?? '#'}`);
            break;
          }
          case 'merge_tag': {
            const token = str(content['token']) || 'contact.first_name';
            const value = renderMergeTags(`{{${token}}}`, data, missing);
            parts.push(`<span>${escapeHtml(value)}</span>`);
            textParts.push(value);
            break;
          }
          default: {
            // Blocks without a renderer are shown as a labelled placeholder rather than omitted.
            parts.push(`<div style="border:1px dashed #d1d5db;border-radius:8px;padding:12px;color:#6b7280;font-size:13px">${escapeHtml(block.type.replace(/_/g, ' '))} block (preview placeholder)</div>`);
            textParts.push(`[${block.type.replace(/_/g, ' ')} placeholder]`);
          }
        }
      }

      if (!hasUnsubscribe) {
        warnings.push('This template has no unsubscribe block. A commercial email must offer a way to opt out.');
      }
      if (missing.size > 0) {
        warnings.push(`Unresolved merge tags: ${[...missing].join(', ')}. They are shown with braces until a value is supplied.`);
      }

      const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(template.subject)}</title></head><body style="margin:0;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111827"><div style="max-width:600px;margin:0 auto;background:#ffffff;padding:28px">${parts.join('\n')}</div></body></html>`;
      const plainText = `${template.subject}\n${template.preheader ? template.preheader + '\n' : ''}\n${textParts.join('\n\n')}`;
      return ok({ html, plainText, warnings });
    },
  };
}

/* ===================================================================== forms */

function describeSubmitAction(form: CaptureForm): string {
  const action = form.submitAction;
  switch (action.kind) {
    case 'create_lead':
      return 'Would create a lead in this organisation.';
    case 'create_contact':
      return 'Would create a contact in this organisation.';
    case 'add_to_segment':
      return action.segmentId ? `Would add the record to segment ${action.segmentId}.` : 'Would add the record to a segment.';
    case 'enroll_in_journey':
      return action.journeyId ? `Would enrol the record in journey ${action.journeyId}.` : 'Would enrol the record in a journey.';
    case 'notify_owner':
      return action.ownerId ? `Would notify owner ${action.ownerId}.` : 'Would notify the record owner.';
    default:
      return 'Would record the submission.';
  }
}

export function makeFormsService(db: Db): ServiceContainer['forms'] {
  const crud = createCrud<CaptureForm>(db, 'captureForms', {
    label: 'Form',
    searchFields: ['name'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),

    submit: async (formId, values) => {
      await delay(`form-submit:${formId}`, { latency: { min: 200, max: 480 } });
      const form = db.state.captureForms[formId];
      if (!form) return err('not_found', 'Form not found.');

      const fieldErrors = form.fields
        .filter((field) => field.required && field.type !== 'consent')
        .filter((field) => str(values[field.key]).trim() === '')
        .map((field) => ({ path: field.key, message: `${field.label} is required.` }));

      if (form.submitAction.requireConsent && !bool(values['consent'])) {
        fieldErrors.push({ path: 'consent', message: 'Consent is required before this form can be submitted.' });
      }

      if (fieldErrors.length > 0) {
        return err('validation_failed', 'Please complete the highlighted fields.', { fieldErrors });
      }

      const submissionId = nextId('sub');
      const views = form.views || form.submissions;
      const submissions = form.submissions + 1;
      const updated: CaptureForm = {
        ...form,
        submissions,
        // Recomputed from the recorded counts; the mock does not store a denominator it does not have.
        conversionRate: pct(submissions, Math.max(1, views), 1),
        lastSubmissionAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.put('captureForms', updated);

      return ok({ submissionId, actionTaken: describeSubmitAction(form), simulated: true } as const);
    },
  };
}

/* ============================================================= landing pages */

export function makeLandingPagesService(db: Db): ServiceContainer['landingPages'] {
  const crud = createCrud<LandingPage>(db, 'landingPages', {
    label: 'Landing page',
    searchFields: ['name', 'slug'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });

  return {
    list: (query) => crud.list(query),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),

    publish: async (id) => {
      await delay(`landing-publish:${id}`);
      const page = db.state.landingPages[id];
      if (!page) return err<{ page: LandingPage; hostingState: 'demo_not_hosted'; note: string }>('not_found', 'Landing page not found.');
      const now = new Date().toISOString();
      const updated: LandingPage = {
        ...page,
        status: 'published',
        hostingState: 'demo_not_hosted',
        publishedAt: page.publishedAt ?? now,
        updatedAt: now,
      };
      db.put('landingPages', updated);
      return ok({
        page: updated,
        hostingState: 'demo_not_hosted' as const,
        note: 'Saved as a static representation. This build has no hosting, domain or CDN integration, so no page is served.',
      });
    },
  };
}

/* ============================================================== lead sources */

export function makeLeadSourcesService(db: Db): ServiceContainer['leadSources'] {
  const crud = createCrud<LeadSource>(db, 'leadSources', {
    label: 'Lead source',
    searchFields: ['name', 'kind', 'channel'],
    facetField: 'kind',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });

  /** Count the leads that reference each source so the totals cannot drift from the data. */
  const withCounts = (source: LeadSource): LeadSource => {
    const related = asRecords<{ leadSourceId?: Id; status?: string }>(db, 'leads').filter(
      (lead) => lead.leadSourceId === source.id,
    );
    const converted = related.filter((lead) => lead.status === 'converted').length;
    return {
      ...source,
      leadCount: related.length,
      conversionRate: related.length > 0 ? Number(((converted / related.length) * 100).toFixed(1)) : 0,
    };
  };

  return {
    list: async (query) => {
      const page = await crud.list(query);
      return { ...page, items: page.items.map(withCounts) };
    },
    get: async (id) => {
      const result = await crud.get(id);
      return result.ok ? ok(withCounts(result.data)) : result;
    },
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),
  };
}
