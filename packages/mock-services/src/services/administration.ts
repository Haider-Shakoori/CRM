/**
 * Tenant administration services: security, data management and the tenant's own billing.
 *
 * The three modules are grouped because they answer the same question — "what is configured
 * for this tenant, and where is that configuration actually stored?" — and because the honest
 * answer differs per module:
 *
 *   - **Security policy, retention rules and duplicate rules are not seeded collections.**
 *     Nothing in the dataset holds them, so the baseline is derived from the records that
 *     *are* seeded (users, sessions, audit events, contacts, documents) and an explicit edit is
 *     kept in `localStorage` under the `crm.demo.` namespace — the namespace
 *     `services.demo.reset()` already clears. No new collection is invented for a config shape
 *     the seed never produces.
 *   - **Sessions, audit events, usage meters, plans, subscriptions and invoices are seeded**,
 *     so those reads are real over the store and the permitted writes mutate it.
 *   - **Nothing here is a security boundary or a payment system.** A session record can be
 *     removed from this browser but no real session is terminated; no identity provider, backup
 *     service or payment provider is connected; and every payload or note that could be mistaken
 *     for one of those says so in words.
 *
 * Everything is scoped to the signed-in user's *active* organization, mirroring the list
 * scoping in `index.ts`, so switching organization through the shell genuinely changes the
 * policy, the data view and the subscription these screens read.
 */

import type {
  AuditEvent,
  Contact,
  CurrencyCode,
  DuplicateCandidate,
  Entitlement,
  Id,
  Lead,
  ListQuery,
  Money,
  Organization,
  PlatformInvoice,
  PlatformPlan,
  PlatformSubscription,
  SecurityPolicy,
  ServiceContainer,
  SessionRecord,
  Tenant,
  TrustedDevice,
  UsageMeter,
  User,
} from '@crm/shared-types';
import { DATASET_EPOCH, toDateString } from '../lib/random';
import { readPath, runQuery } from '../lib/query';
import type { CollectionName, MockDb } from '../lib/store';
import { delay, err, nextId, ok, simulatedFailure } from './factory';

type Db = MockDb;

const asRecords = <T>(database: Db, collection: CollectionName): T[] =>
  database.all(collection) as unknown as T[];

/* ------------------------------------------------------------------- scope */

/**
 * The organization administration acts on: the signed-in user's active organization,
 * falling back to the first seeded organization. This mirrors `currentOrganizationId()` in
 * `index.ts` so a tenant switch re-scopes these screens exactly like every record list.
 */
function activeOrganizationId(db: Db): Id {
  return Object.values(db.state.users)[0]?.activeOrganizationId ?? Object.values(db.state.organizations)[0]!.id;
}

function activeOrganization(db: Db): Organization | undefined {
  return db.state.organizations[activeOrganizationId(db)];
}

/** Users who belong to the organization, which is a membership test rather than a tenant key. */
function usersInOrganization(db: Db, organizationId: Id): User[] {
  return Object.values(db.state.users).filter((user) => user.organizationIds.includes(organizationId));
}

function signedInUser(db: Db): User | undefined {
  return Object.values(db.state.users)[0];
}

function tenantForOrganization(db: Db, organizationId: Id): Tenant | undefined {
  const organization = db.state.organizations[organizationId];
  return organization ? db.state.tenants[organization.tenantId] : undefined;
}

/* ------------------------------------------- local-only configuration storage */

/**
 * Configuration that has no collection is held in this browser.
 *
 * The key namespace is `crm.demo.`, which `services.demo.reset()` clears — so a reviewer can
 * always get back to the derived baseline without touching the rest of the store. When
 * `localStorage` is unavailable the value still lives for the session in `memoryOverrides`,
 * which keeps the interfaces working in tests and in privacy-restricted browsers.
 */
const memoryOverrides = new Map<string, unknown>();

function readLocalSetting<T>(key: string): T | undefined {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* unreadable payload: fall through to the in-memory copy */
    }
  }
  return memoryOverrides.get(key) as T | undefined;
}

function writeLocalSetting(key: string, value: unknown): void {
  memoryOverrides.set(key, value);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled storage: the session copy above remains authoritative */
  }
}

/** Deterministic hash so derived records are stable across renders and reloads. */
function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 1_000_003;
  }
  return result;
}

function money(amount: number, currency: Money['currency']): Money {
  return { amount, currency };
}

/**
 * Append an entry to the local audit list.
 *
 * The log is a local demonstration record, not an immutable trail — the screen says so — but a
 * configuration change that leaves no trace at all would be worse, so administrative writes
 * record themselves here.
 */
function appendAuditEvent(
  db: Db,
  input: {
    organizationId: Id;
    action: string;
    resource: string;
    resourceLabel: string;
    severity: AuditEvent['severity'];
    changes?: AuditEvent['changes'];
  },
): void {
  const actor = signedInUser(db);
  const event: AuditEvent = {
    id: nextId('audit'),
    at: new Date().toISOString(),
    organizationId: input.organizationId,
    actorId: actor?.id,
    actorLabel: actor?.displayName ?? 'System',
    actorType: 'user',
    action: input.action,
    resource: input.resource,
    resourceLabel: input.resourceLabel,
    outcome: 'success',
    // Masked exactly like the seeded events: a full address is never held on the client.
    ipAddressMasked: '203.0.113.***',
    userAgent: 'Local administration interface',
    changes: input.changes,
    severity: input.severity,
  };
  db.put('auditEvents', event);
}

/* ================================================================= SECURITY */

const POLICY_SETTING_PREFIX = 'crm.demo.security-policy.';

/**
 * Baseline security policy.
 *
 * Derived from the records that are seeded: how many people in this organization have MFA, and
 * the data-region the tenant was provisioned in. The values are demonstration defaults, not a
 * security certification, and the screen states that.
 */
function baselinePolicy(db: Db, organization: Organization): SecurityPolicy {
  const users = usersInOrganization(db, organization.id);
  const mfaEnabled = users.filter((user) => user.mfaEnabled).length;
  const mfaCoverage = users.length > 0 ? mfaEnabled / users.length : 0;
  const tenant = db.state.tenants[organization.tenantId];

  return {
    organizationId: organization.id,
    mfa: {
      // Derived: a directory that already has most users on MFA is shown asking for it widely.
      enforcement: mfaCoverage >= 0.9 ? 'all_users' : mfaCoverage >= 0.5 ? 'admins_only' : 'risk_based',
      allowedMethods: ['totp', 'webauthn'],
      gracePeriodDays: 7,
      rememberDeviceDays: 30,
    },
    sso: {
      // No identity provider is connected anywhere in this build.
      enabled: false,
      protocol: 'none',
      enforceForAllUsers: false,
      jitProvisioning: false,
    },
    password: {
      minLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: true,
      expiryDays: null,
      preventReuse: 5,
      lockoutAttempts: tenant?.accountTier === 'enterprise' ? 5 : 10,
    },
    sessions: {
      idleTimeoutMinutes: tenant?.accountTier === 'enterprise' ? 30 : 60,
      absoluteTimeoutHours: 720,
      concurrentSessionLimit: null,
      requireReauthForSensitiveActions: true,
    },
    network: {
      ipAllowlist: [],
      ipDenylist: [],
      countryAllowlist: [],
      blockTorExitNodes: false,
    },
    dataGovernance: {
      exportRequiresApproval: false,
      maskSensitiveFieldsForNonAdmins: true,
      auditRetentionDays: 365,
      recordRetentionYears: 7,
    },
  };
}

/** Human-readable field paths for policy validation errors. */
function validatePolicy(policy: SecurityPolicy): Array<{ path: string; message: string }> {
  const problems: Array<{ path: string; message: string }> = [];
  if (policy.password.minLength < 8 || policy.password.minLength > 64) {
    problems.push({ path: 'password.minLength', message: 'Use a minimum length between 8 and 64 characters.' });
  }
  if (policy.password.preventReuse < 0 || policy.password.preventReuse > 24) {
    problems.push({ path: 'password.preventReuse', message: 'Prevent reuse of between 0 and 24 previous passwords.' });
  }
  if (policy.password.lockoutAttempts < 1 || policy.password.lockoutAttempts > 50) {
    problems.push({ path: 'password.lockoutAttempts', message: 'Lock out after between 1 and 50 failed attempts.' });
  }
  if (policy.sessions.idleTimeoutMinutes < 5 || policy.sessions.idleTimeoutMinutes > 1440) {
    problems.push({ path: 'sessions.idleTimeoutMinutes', message: 'An idle timeout between 5 and 1440 minutes is accepted.' });
  }
  if (policy.sessions.absoluteTimeoutHours < 1 || policy.sessions.absoluteTimeoutHours > 2160) {
    problems.push({ path: 'sessions.absoluteTimeoutHours', message: 'An absolute timeout between 1 and 2160 hours is accepted.' });
  }
  if (policy.sessions.concurrentSessionLimit !== null && policy.sessions.concurrentSessionLimit < 1) {
    problems.push({ path: 'sessions.concurrentSessionLimit', message: 'A concurrent session limit must be at least 1, or left unlimited.' });
  }
  if (policy.mfa.gracePeriodDays < 0 || policy.mfa.gracePeriodDays > 365) {
    problems.push({ path: 'mfa.gracePeriodDays', message: 'A grace period between 0 and 365 days is accepted.' });
  }
  if (policy.mfa.rememberDeviceDays < 0 || policy.mfa.rememberDeviceDays > 365) {
    problems.push({ path: 'mfa.rememberDeviceDays', message: 'Remember-a-device between 0 and 365 days is accepted.' });
  }
  if (policy.dataGovernance.auditRetentionDays < 30 || policy.dataGovernance.auditRetentionDays > 3650) {
    problems.push({ path: 'dataGovernance.auditRetentionDays', message: 'Keep audit records for between 30 and 3650 days.' });
  }
  if (policy.dataGovernance.recordRetentionYears < 1 || policy.dataGovernance.recordRetentionYears > 25) {
    problems.push({ path: 'dataGovernance.recordRetentionYears', message: 'Record retention must be between 1 and 25 years.' });
  }
  const invalidIp = [...policy.network.ipAllowlist, ...policy.network.ipDenylist].find(
    (entry) => entry.trim().length > 0 && !/^[0-9a-fA-F.:]+\/\d{1,3}$/.test(entry.trim()),
  );
  if (invalidIp) {
    problems.push({ path: 'network.ipAllowlist', message: `“${invalidIp}” is not a CIDR range, for example 203.0.113.0/24.` });
  }
  return problems;
}

export function makeSecurityService(db: Db): ServiceContainer['security'] {
  const policyKey = (organizationId: Id) => `${POLICY_SETTING_PREFIX}${organizationId}`;

  const storedPolicy = (organization: Organization): SecurityPolicy =>
    readLocalSetting<SecurityPolicy>(policyKey(organization.id)) ?? baselinePolicy(db, organization);

  const sessionsFor = (organizationId: Id): SessionRecord[] => {
    const memberIds = new Set(usersInOrganization(db, organizationId).map((user) => user.id));
    return asRecords<SessionRecord>(db, 'sessions').filter((session) => memberIds.has(session.userId));
  };

  /**
   * Trusted devices are derived from the sessions that are marked trusted.
   *
   * There is no `trustedDevices` collection, and inventing one would put a device list in the
   * store that the seed never produced. A device therefore *is* its trusted session, and
   * revoking one clears that session's trust flag — a real local write.
   */
  const devicesFor = (organizationId: Id): TrustedDevice[] =>
    sessionsFor(organizationId)
      .filter((session) => session.trusted)
      .map((session) => {
        const started = new Date(session.startedAt).getTime();
        const expires = Number.isNaN(started) ? undefined : new Date(started + 90 * 86_400_000).toISOString();
        return {
          id: `device-${session.id}`,
          userId: session.userId,
          label: `${session.deviceLabel} · ${session.browser}`,
          addedAt: session.startedAt,
          lastUsedAt: session.lastSeenAt,
          expiresAt: expires,
          platform: session.os,
        };
      });

  return {
    policy: async () => {
      await delay('security-policy');
      const organization = activeOrganization(db);
      if (!organization) return err('not_found', 'No organization is available to configure.');
      return ok(storedPolicy(organization));
    },

    updatePolicy: async (patch) => {
      await delay('security-policy-update', { latency: { min: 200, max: 460 } });
      const organization = activeOrganization(db);
      if (!organization) return err('not_found', 'No organization is available to configure.');

      const baseline = storedPolicy(organization);
      // Merge one level deep per section so a partial patch cannot drop the rest of a section.
      const merged: SecurityPolicy = {
        ...baseline,
        ...(patch as Partial<SecurityPolicy>),
        organizationId: organization.id,
        mfa: { ...baseline.mfa, ...(patch as Partial<SecurityPolicy>).mfa },
        sso: { ...baseline.sso, ...(patch as Partial<SecurityPolicy>).sso },
        password: { ...baseline.password, ...(patch as Partial<SecurityPolicy>).password },
        sessions: { ...baseline.sessions, ...(patch as Partial<SecurityPolicy>).sessions },
        network: { ...baseline.network, ...(patch as Partial<SecurityPolicy>).network },
        dataGovernance: { ...baseline.dataGovernance, ...(patch as Partial<SecurityPolicy>).dataGovernance },
      };

      const problems = validatePolicy(merged);
      if (problems.length > 0) {
        return err<SecurityPolicy>('validation_failed', 'Some values are outside the accepted range.', {
          fieldErrors: problems,
        });
      }

      // Single sign-on cannot be switched on from here: no identity provider exists to point
      // at, and accepting the write would put a "connected" state in the policy that nothing
      // could honour.
      if (merged.sso.enabled !== baseline.sso.enabled || merged.sso.protocol !== baseline.sso.protocol) {
        return err<SecurityPolicy>(
          'forbidden',
          'Single sign-on cannot be configured in this build. No identity provider, metadata or signing certificate is connected.',
        );
      }

      writeLocalSetting(policyKey(organization.id), merged);
      appendAuditEvent(db, {
        organizationId: organization.id,
        action: 'permission.changed',
        resource: 'security_policy',
        resourceLabel: 'Security policy updated',
        severity: 'warning',
        changes: [{ field: 'mfa.enforcement', after: merged.mfa.enforcement }, { field: 'sessions.idleTimeoutMinutes', after: String(merged.sessions.idleTimeoutMinutes) }],
      });
      return ok(merged);
    },

    sessions: async (query = {}) => {
      await delay('security-sessions', { latency: { min: 80, max: 200 } });
      const organization = activeOrganization(db);
      if (!organization) return emptyPage<SessionRecord>(query);
      const records = sessionsFor(organization.id);
      return runQuery(records, query, {
        searchFields: ['deviceLabel', 'browser', 'os', 'locationLabel'],
        facetField: 'trusted',
        defaultSort: [{ field: 'lastSeenAt', direction: 'desc' }],
      });
    },

    revokeSession: async (id) => {
      await delay(`session-revoke:${id}`, { latency: { min: 180, max: 380 } });
      const session = db.state.sessions[id];
      if (!session) return err('not_found', 'That session is no longer listed.');
      if (session.current) {
        return err('forbidden', 'The session you are using cannot be ended from here.');
      }
      db.remove('sessions', id);
      return ok({
        id,
        simulated: true as const,
        note: 'The session record was removed from this browser’s demonstration data. No real session was terminated and no server was contacted.',
      });
    },

    revokeAllOtherSessions: async () => {
      await delay('session-revoke-all', { latency: { min: 260, max: 520 } });
      const user = signedInUser(db);
      if (!user) return err<{ revoked: number; note: string }>('not_found', 'No signed-in user is available.');
      const others = asRecords<SessionRecord>(db, 'sessions').filter((session) => session.userId === user.id && !session.current);
      db.removeMany(
        'sessions',
        others.map((session) => session.id),
      );
      return ok({
        revoked: others.length,
        note:
          others.length === 0
            ? 'No other sessions were listed for this user.'
            : `${others.length} session record${others.length === 1 ? '' : 's'} were removed from this browser. No real session was terminated.`,
      });
    },

    devices: async () => {
      await delay('security-devices', { latency: { min: 80, max: 200 } });
      const organization = activeOrganization(db);
      const items = organization ? devicesFor(organization.id) : [];
      return {
        items,
        meta: { page: 1, pageSize: 50, total: items.length, totalPages: 1, hasNext: false, hasPrev: false },
      };
    },

    revokeDevice: async (id) => {
      await delay(`device-revoke:${id}`, { latency: { min: 160, max: 340 } });
      const sessionId = id.startsWith('device-') ? id.slice('device-'.length) : id;
      const session = db.state.sessions[sessionId];
      if (!session) return err<{ id: Id }>('not_found', 'That device is no longer listed as trusted.');
      db.put('sessions', { ...session, trusted: false });
      return ok({ id });
    },

    auditEvents: async (query) => {
      await delay('security-audit', { latency: { min: 80, max: 220 } });
      const organization = activeOrganization(db);
      if (!organization) return emptyPage<AuditEvent>(query);
      const filters = (query ?? {}) as ListQuery & { category?: string; actorId?: Id; severity?: string };
      let records = asRecords<AuditEvent>(db, 'auditEvents').filter((event) => event.organizationId === organization.id);
      if (filters.actorId) records = records.filter((event) => event.actorId === filters.actorId);
      if (filters.severity) records = records.filter((event) => event.severity === filters.severity);
      if (filters.category) {
        // The contract calls this `category`; the seeded records express it as the action
        // namespace (`permission.changed` → `permission`) or as the resource key.
        records = records.filter(
          (event) => event.action.startsWith(filters.category!) || event.resource === filters.category,
        );
      }
      return runQuery(records, query, {
        searchFields: ['action', 'resourceLabel', 'actorLabel', 'userAgent'],
        facetField: 'severity',
        defaultSort: [{ field: 'at', direction: 'desc' }],
      });
    },

    exportAuditEvents: async (from, to) => {
      await delay('security-audit-export', { latency: { min: 240, max: 560 } });
      const organization = activeOrganization(db);
      if (!organization) return err('not_found', 'No organization is available to export.');
      const records = asRecords<AuditEvent>(db, 'auditEvents').filter(
        (event) => event.organizationId === organization.id && event.at >= from && event.at <= to,
      );
      appendAuditEvent(db, {
        organizationId: organization.id,
        action: 'export.requested',
        resource: 'audit_event',
        resourceLabel: `Audit export ${from} to ${to}`,
        severity: 'warning',
      });
      // Generated in the browser; nothing is emailed or uploaded.
      return ok({ exportId: nextId('audit-export'), rowCount: records.length, generatedLocally: true as const });
    },
  };
}

function emptyPage<T>(query: ListQuery | undefined): import('@crm/shared-types').Paginated<T> {
  const page = Math.max(1, query?.page ?? 1);
  const pageSize = Math.max(1, query?.pageSize ?? 25);
  return { items: [], meta: { page, pageSize, total: 0, totalPages: 1, hasNext: false, hasPrev: false } };
}

/* =========================================================== DATA MANAGEMENT */

const DATA_SETTING_PREFIX = 'crm.demo.data-management.';

/** A synthetic import job, held for the session in closure state like export requests are. */
interface ImportJobInternal {
  id: Id;
  organizationId: Id;
  resource: string;
  fileName: string;
  state: 'mapping' | 'validated' | 'completed' | 'failed';
  createdAt: string;
  createdBy: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  created: number;
  updated: number;
  skipped: number;
  predictedInvalid: number;
  headers: string[];
  mappings: Array<{ sourceHeader: string; targetField: string | null }>;
}

/** The resource catalogue the demonstration importer understands. */
const IMPORT_RESOURCES: Array<{
  key: string;
  label: string;
  fields: Array<{ targetField: string; label: string; required: boolean; aliases: string[] }>;
}> = [
  {
    key: 'contacts',
    label: 'Contacts',
    fields: [
      { targetField: 'firstName', label: 'First name', required: false, aliases: ['first name', 'given name', 'forename'] },
      { targetField: 'lastName', label: 'Last name', required: true, aliases: ['last name', 'surname', 'family name'] },
      { targetField: 'email', label: 'Work email', required: false, aliases: ['email', 'e mail', 'work email', 'email address'] },
      { targetField: 'phone', label: 'Phone', required: false, aliases: ['phone', 'telephone', 'mobile', 'direct dial'] },
      { targetField: 'jobTitle', label: 'Job title', required: false, aliases: ['job title', 'title', 'role', 'position'] },
      { targetField: 'accountName', label: 'Account name', required: false, aliases: ['account', 'company', 'company name', 'organization'] },
    ],
  },
  {
    key: 'leads',
    label: 'Leads',
    fields: [
      { targetField: 'companyName', label: 'Company name', required: true, aliases: ['company', 'company name', 'organisation', 'organization'] },
      { targetField: 'firstName', label: 'First name', required: false, aliases: ['first name', 'given name', 'forename'] },
      { targetField: 'lastName', label: 'Last name', required: false, aliases: ['last name', 'surname', 'family name'] },
      { targetField: 'email', label: 'Email', required: false, aliases: ['email', 'e mail', 'email address'] },
      { targetField: 'phone', label: 'Phone', required: false, aliases: ['phone', 'telephone', 'mobile'] },
      { targetField: 'jobTitle', label: 'Job title', required: false, aliases: ['job title', 'title', 'role'] },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    fields: [
      { targetField: 'name', label: 'Account name', required: true, aliases: ['account', 'account name', 'company', 'company name'] },
      { targetField: 'website', label: 'Website', required: false, aliases: ['website', 'domain', 'url', 'web'] },
      { targetField: 'industry', label: 'Industry', required: false, aliases: ['industry', 'sector'] },
      { targetField: 'phone', label: 'Phone', required: false, aliases: ['phone', 'telephone', 'main number'] },
    ],
  },
];

function normalizeHeader(header: string): string {
  return header
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function importResource(resource: string) {
  return IMPORT_RESOURCES.find((entry) => entry.key === resource);
}

/** Sample values are read from existing records of the same resource — never invented. */
function sampleValues(db: Db, organizationId: Id, resource: string, targetField: string): string[] {
  const read = (record: Record<string, unknown>): string | undefined => {
    switch (targetField) {
      case 'email': {
        const emails = record['emails'] as Array<{ value?: string }> | undefined;
        return emails?.[0]?.value;
      }
      case 'phone': {
        const phones = record['phones'] as Array<{ value?: string }> | undefined;
        return phones?.[0]?.value;
      }
      case 'website': {
        const domains = record['domains'] as string[] | undefined;
        return domains?.[0];
      }
      default:
        return readPath(record, targetField) as string | undefined;
    }
  };

  if (resource === 'contacts') {
    return asRecords<Contact>(db, 'contacts')
      .filter((contact) => contact.organizationId === organizationId)
      .map((contact) => read(contact as unknown as Record<string, unknown>))
      .filter((value): value is string => Boolean(value))
      .slice(0, 3);
  }
  if (resource === 'leads') {
    return asRecords<Lead>(db, 'leads')
      .filter((lead) => lead.organizationId === organizationId)
      .map((lead) => read(lead as unknown as Record<string, unknown>))
      .filter((value): value is string => Boolean(value))
      .slice(0, 3);
  }
  if (resource === 'accounts') {
    return asRecords<import('@crm/shared-types').Account>(db, 'accounts')
      .filter((account) => account.organizationId === organizationId)
      .map((account) => read(account as unknown as Record<string, unknown>))
      .filter((value): value is string => Boolean(value))
      .slice(0, 3);
  }
  return [];
}

/** Rows a demonstration import will not attempt to write, so a large file cannot freeze the tab. */
const IMPORT_ROW_CAP = 200;

interface RetentionRuleInternal {
  id: Id;
  resource: string;
  retentionDays: number;
  action: 'archive' | 'anonymize' | 'delete';
  enabled: boolean;
  legalHoldExempt: boolean;
}

interface RestoreRequestInternal {
  id: Id;
  requestedAt: string;
  state: string;
  scope: string;
}

interface LocalDataSettings {
  retention?: Array<{ id: Id; retentionDays: number; enabled: boolean }>;
  restores?: RestoreRequestInternal[];
}

export function makeDataService(db: Db): ServiceContainer['data'] {
  const settingKey = (organizationId: Id) => `${DATA_SETTING_PREFIX}${organizationId}`;
  const jobs = new Map<Id, ImportJobInternal>();
  const duplicateResolutions = new Map<Id, DuplicateCandidate>();

  const settingsFor = (organizationId: Id): LocalDataSettings => readLocalSetting<LocalDataSettings>(settingKey(organizationId)) ?? {};

  const updateSettings = (organizationId: Id, patch: Partial<LocalDataSettings>): LocalDataSettings => {
    const merged = { ...settingsFor(organizationId), ...patch };
    writeLocalSetting(settingKey(organizationId), merged);
    return merged;
  };

  /** Baseline retention rules, one per resource the seeded dataset actually holds. */
  function baselineRetention(organizationId: Id): RetentionRuleInternal[] {
    const organization = db.state.organizations[organizationId];
    const policy = organization
      ? readLocalSetting<SecurityPolicy>(`${POLICY_SETTING_PREFIX}${organizationId}`)
      : undefined;
    const auditDays = policy?.dataGovernance.auditRetentionDays ?? 365;
    return [
      { id: `retention-${organizationId}-activities`, resource: 'Activities', retentionDays: 1095, action: 'archive', enabled: true, legalHoldExempt: true },
      { id: `retention-${organizationId}-tickets`, resource: 'Tickets', retentionDays: 1825, action: 'archive', enabled: true, legalHoldExempt: false },
      { id: `retention-${organizationId}-deals`, resource: 'Deals', retentionDays: 2555, action: 'anonymize', enabled: false, legalHoldExempt: false },
      { id: `retention-${organizationId}-contacts`, resource: 'Contacts', retentionDays: 2555, action: 'anonymize', enabled: false, legalHoldExempt: false },
      { id: `retention-${organizationId}-documents`, resource: 'Documents', retentionDays: 3650, action: 'delete', enabled: false, legalHoldExempt: false },
      // Derived from the security policy so the two administration screens cannot disagree.
      { id: `retention-${organizationId}-audit`, resource: 'Audit events', retentionDays: auditDays, action: 'archive', enabled: true, legalHoldExempt: true },
    ];
  }

  function currentRetention(organizationId: Id): RetentionRuleInternal[] {
    const overrides = settingsFor(organizationId).retention ?? [];
    return baselineRetention(organizationId).map((rule) => {
      const override = overrides.find((candidate) => candidate.id === rule.id);
      return override ? { ...rule, retentionDays: override.retentionDays, enabled: override.enabled } : rule;
    });
  }

  /** Derived duplicate candidates over the seeded records, with session resolutions applied. */
  function deriveCandidates(organizationId: Id): DuplicateCandidate[] {
    const candidates: DuplicateCandidate[] = [];

    const contacts = asRecords<Contact>(db, 'contacts').filter((contact) => contact.organizationId === organizationId);
    const contactGroups = new Map<string, Contact[]>();
    for (const contact of contacts) {
      const key = `${contact.lastName.toLowerCase()}|${contact.accountId ?? ''}`;
      contactGroups.set(key, [...(contactGroups.get(key) ?? []), contact]);
    }
    for (const group of contactGroups.values()) {
      const [a, b] = group as [Contact | undefined, Contact | undefined];
      if (!a || !b) continue;
      candidates.push({
        id: `dup-contact-${a.id}-${b.id}`,
        entityKind: 'contact',
        score: 78,
        matchedOn: [
          { field: 'lastName', valueA: a.lastName, valueB: b.lastName },
          { field: 'account', valueA: a.accountName ?? '—', valueB: b.accountName ?? '—' },
        ],
        recordA: { id: a.id, label: a.displayName, subtitle: a.emails[0]?.value },
        recordB: { id: b.id, label: b.displayName, subtitle: b.emails[0]?.value },
        status: 'pending',
        detectedAt: DATASET_EPOCH.toISOString(),
      });
    }

    const leads = asRecords<Lead>(db, 'leads').filter((lead) => lead.organizationId === organizationId);
    const leadGroups = new Map<string, Lead[]>();
    for (const lead of leads) {
      if (!lead.companyName) continue;
      const key = lead.companyName.trim().toLowerCase();
      leadGroups.set(key, [...(leadGroups.get(key) ?? []), lead]);
    }
    for (const group of leadGroups.values()) {
      const [a, b] = group as [Lead | undefined, Lead | undefined];
      if (!a || !b) continue;
      candidates.push({
        id: `dup-lead-${a.id}-${b.id}`,
        entityKind: 'lead',
        score: 86,
        matchedOn: [{ field: 'companyName', valueA: a.companyName ?? '—', valueB: b.companyName ?? '—' }],
        recordA: { id: a.id, label: a.companyName ?? a.reference, subtitle: a.reference },
        recordB: { id: b.id, label: b.companyName ?? b.reference, subtitle: b.reference },
        status: 'pending',
        detectedAt: DATASET_EPOCH.toISOString(),
      });
    }

    const accounts = asRecords<import('@crm/shared-types').Account>(db, 'accounts').filter(
      (account) => account.organizationId === organizationId,
    );
    const accountGroups = new Map<string, import('@crm/shared-types').Account[]>();
    for (const account of accounts) {
      const key = account.name.trim().toLowerCase();
      accountGroups.set(key, [...(accountGroups.get(key) ?? []), account]);
    }
    for (const group of accountGroups.values()) {
      const [a, b] = group as [import('@crm/shared-types').Account | undefined, import('@crm/shared-types').Account | undefined];
      if (!a || !b) continue;
      candidates.push({
        id: `dup-account-${a.id}-${b.id}`,
        entityKind: 'account',
        score: 91,
        matchedOn: [{ field: 'name', valueA: a.name, valueB: b.name }],
        recordA: { id: a.id, label: a.name, subtitle: a.domains[0] },
        recordB: { id: b.id, label: b.name, subtitle: b.domains[0] },
        status: 'pending',
        detectedAt: DATASET_EPOCH.toISOString(),
      });
    }

    return candidates
      .map((candidate) => {
        const resolution = duplicateResolutions.get(candidate.id);
        return resolution ? { ...candidate, status: resolution.status } : candidate;
      })
      .slice(0, 40);
  }

  /** Synthesize one importable record. Values are composed from the file name, never read from it. */
  function createSyntheticRecord(
    resource: string,
    organizationId: Id,
    stem: string,
    key: string,
    index: number,
  ): void {
    const now = new Date().toISOString();
    const owner = signedInUser(db);
    if (resource === 'contacts') {
      const contact: Contact = {
        id: nextId('con-import'),
        organizationId,
        reference: `C-IMP-${String(index + 1).padStart(4, '0')}`,
        firstName: 'Imported',
        lastName: key,
        displayName: `Imported ${key}`,
        jobTitle: undefined,
        accountId: undefined,
        accountName: undefined,
        emails: [],
        phones: [],
        addresses: [],
        lifecycleStage: 'lead',
        consent: [],
        tags: [],
        relationships: [],
        openDealCount: 0,
        openTicketCount: 0,
        ownerTeamId: undefined,
        ownerId: owner?.id ?? '',
        description: `Created by the demonstration import “${stem}”. File contents were never read; values are composed locally.`,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      };
      db.put('contacts', contact);
      return;
    }
    if (resource === 'leads') {
      const lead: Lead = {
        id: nextId('lead-import'),
        organizationId,
        reference: `L-IMP-${String(index + 1).padStart(4, '0')}`,
        firstName: 'Imported',
        lastName: key,
        companyName: key,
        emails: [],
        phones: [],
        status: 'new',
        rating: 'unrated',
        tags: [],
        ownerTeamId: undefined,
        ownerId: owner?.id ?? '',
        notes: `Created by the demonstration import “${stem}”. File contents were never read; values are composed locally.`,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      };
      db.put('leads', lead);
      return;
    }
    const account: import('@crm/shared-types').Account = {
      id: nextId('acc-import'),
      organizationId,
      reference: `A-IMP-${String(index + 1).padStart(4, '0')}`,
      name: key,
      type: 'prospect',
      domains: [],
      emails: [],
      phones: [],
      addresses: [],
      childAccountIds: [],
      hierarchyDepth: 0,
      ownerId: owner?.id ?? '',
      health: 'unknown',
      tags: [],
      openDealCount: 0,
      openTicketCount: 0,
      contactCount: 0,
      isKeyAccount: false,
      buyingCommittee: [],
      customFields: {},
      description: `Created by the demonstration import “${stem}”. File contents were never read; values are composed locally.`,
      createdAt: now,
      updatedAt: now,
    };
    db.put('accounts', account);
  }

  /** The de-duplication key a synthesized record would carry for a resource. */
  function keyOfRecord(resource: string, record: Record<string, unknown>): string | undefined {
    if (resource === 'contacts') return typeof record['displayName'] === 'string' ? record['displayName'] : undefined;
    if (resource === 'leads') return typeof record['companyName'] === 'string' ? record['companyName'] : undefined;
    return typeof record['name'] === 'string' ? record['name'] : undefined;
  }

  function recordsOfResource(organizationId: Id, resource: string): Array<Record<string, unknown>> {
    if (resource === 'contacts') {
      return (asRecords<Contact>(db, 'contacts').filter((record) => record.organizationId === organizationId) as unknown as Array<Record<string, unknown>>);
    }
    if (resource === 'leads') {
      return (asRecords<Lead>(db, 'leads').filter((record) => record.organizationId === organizationId) as unknown as Array<Record<string, unknown>>);
    }
    return (asRecords<import('@crm/shared-types').Account>(db, 'accounts').filter(
      (record) => record.organizationId === organizationId,
    ) as unknown as Array<Record<string, unknown>>);
  }

  return {
    startImport: async (input) => {
      await delay(`import-start:${input.resource}`, { latency: { min: 180, max: 420 } });
      const organizationId = activeOrganizationId(db);
      const resource = importResource(input.resource);
      if (!resource) {
        return err<{ jobId: Id }>('validation_failed', `“${input.resource}” is not a resource the demonstration importer understands.`);
      }
      if (!input.fileName.trim()) {
        return err<{ jobId: Id }>('validation_failed', 'Provide the file name that is being demonstrated.', {
          fieldErrors: [{ path: 'fileName', message: 'A file name is required.' }],
        });
      }
      if (!Number.isFinite(input.rowCount) || input.rowCount < 1) {
        return err<{ jobId: Id }>('validation_failed', 'The row count must be at least one.', {
          fieldErrors: [{ path: 'rowCount', message: 'Enter the number of rows in the file.' }],
        });
      }
      const jobId = nextId('imp');
      jobs.set(jobId, {
        id: jobId,
        organizationId,
        resource: resource.key,
        fileName: input.fileName,
        state: 'mapping',
        createdAt: new Date().toISOString(),
        createdBy: signedInUser(db)?.displayName ?? 'Operator',
        totalRows: Math.floor(input.rowCount),
        processedRows: 0,
        failedRows: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        predictedInvalid: 0,
        headers: [],
        mappings: [],
      });
      return ok({ jobId });
    },

    suggestMapping: async (jobId, headers) => {
      await delay(`import-map:${jobId}`, { latency: { min: 200, max: 460 } });
      const job = jobs.get(jobId);
      if (!job) return err('not_found', 'That import job is no longer held in this session.');
      const resource = importResource(job.resource);
      if (!resource) return err('validation_failed', 'The job references an unknown resource.');

      const normalized = headers.map((header) => ({ header, key: normalizeHeader(header) }));
      const mappings = normalized.map((entry) => {
        const exact = resource.fields.find(
          (field) => normalizeHeader(field.targetField) === entry.key || field.aliases.some((alias) => normalizeHeader(alias) === entry.key),
        );
        const partial = exact
          ? undefined
          : resource.fields.find((field) =>
              field.aliases.some((alias) => entry.key.includes(normalizeHeader(alias)) || normalizeHeader(alias).includes(entry.key)),
            );
        const field = exact ?? partial;
        return {
          sourceHeader: entry.header,
          targetField: field?.targetField ?? null,
          confidence: exact ? 1 : partial ? 0.65 : 0,
          // Samples are read from existing records of the same resource, so they are real
          // values rather than invented ones. Unmapped headers carry no sample.
          sample: field ? sampleValues(db, job.organizationId, job.resource, field.targetField) : [],
        };
      });
      const unmappedHeaders = mappings.filter((mapping) => !mapping.targetField).map((mapping) => mapping.sourceHeader);

      job.headers = [...headers];
      job.mappings = mappings.map((mapping) => ({ sourceHeader: mapping.sourceHeader, targetField: mapping.targetField }));
      job.state = 'mapping';

      return ok({ mappings, unmappedHeaders });
    },

    validateImport: async (jobId, mappings) => {
      await delay(`import-validate:${jobId}`, { latency: { min: 240, max: 560 } });
      const job = jobs.get(jobId);
      if (!job) return err('not_found', 'That import job is no longer held in this session.');
      const resource = importResource(job.resource);
      if (!resource) return err('validation_failed', 'The job references an unknown resource.');

      const mappedFields = new Set(mappings.map((mapping) => mapping.targetField));
      const missingRequired = resource.fields.filter((field) => field.required && !mappedFields.has(field.targetField));
      const missingOptional = resource.fields.filter((field) => !field.required && !mappedFields.has(field.targetField));

      const errors: Array<{ row: number; field: string; message: string }> = missingRequired.map((field) => ({
        row: 1,
        field: field.targetField,
        message: `No source column is mapped to “${field.label}”, so every row would be rejected.`,
      }));

      // Row-level rejections are derived deterministically from the row count so the same file
      // always reports the same result. Nothing here inspects the file, because no file is read.
      const rowRejections = missingRequired.length > 0 ? job.totalRows : Math.min(job.totalRows, Math.floor(job.totalRows / 37));
      if (rowRejections > 0 && missingRequired.length === 0) {
        for (let index = 0; index < Math.min(5, rowRejections); index += 1) {
          const row = 12 + index * 37;
          if (row > job.totalRows) break;
          errors.push({ row, field: missingRequired[0]?.targetField ?? 'row', message: 'A required value is empty in this row.' });
        }
      }

      const invalid = rowRejections;
      const valid = Math.max(0, job.totalRows - invalid);
      const warnings = missingOptional.length > 0 ? job.totalRows : 0;

      job.mappings = mappings.map((mapping) => ({ sourceHeader: mapping.sourceHeader, targetField: mapping.targetField }));
      job.predictedInvalid = invalid;
      job.state = 'validated';

      return ok({ valid, invalid, warnings, errors: errors.slice(0, 50) });
    },

    commitImport: async (jobId, mappings, options) => {
      await delay(`import-commit:${jobId}`, { latency: { min: 320, max: 760 } });
      const job = jobs.get(jobId);
      if (!job) return err('not_found', 'That import job is no longer held in this session.');
      const resource = importResource(job.resource);
      if (!resource) return err('validation_failed', 'The job references an unknown resource.');

      const mappedFields = new Set(mappings.map((mapping) => mapping.targetField));
      const missingRequired = resource.fields.filter((field) => field.required && !mappedFields.has(field.targetField));
      if (missingRequired.length > 0) {
        return err<{ created: number; updated: number; skipped: number; failed: number; jobId: Id }>(
          'validation_failed',
          `Map “${missingRequired[0]!.label}” before committing, or every row will be rejected.`,
        );
      }

      const stem = job.fileName.replace(/\.[a-z0-9]+$/i, '').trim() || 'import';
      const validRows = Math.max(0, job.totalRows - job.predictedInvalid);
      const attempted = Math.min(validRows, IMPORT_ROW_CAP);
      const existing = recordsOfResource(job.organizationId, job.resource);

      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (let index = 0; index < attempted; index += 1) {
        // Key composed from the file name and the row number. It is what makes `skip` and
        // `update` meaningful without ever reading a file the browser does not hold.
        const key = `${stem} ${index + 1}`;
        const keyedField = job.resource === 'contacts' ? `Imported ${key}` : key;
        const match = existing.find((record) => keyOfRecord(job.resource, record) === keyedField);
        if (match && options.onDuplicate === 'skip') {
          skipped += 1;
          continue;
        }
        if (match && options.onDuplicate === 'update') {
          const collection: CollectionName = job.resource === 'contacts' ? 'contacts' : job.resource === 'leads' ? 'leads' : 'accounts';
          db.put(collection, { ...match, updatedAt: new Date().toISOString() } as never);
          updated += 1;
          continue;
        }
        createSyntheticRecord(job.resource, job.organizationId, stem, keyedField, index);
        created += 1;
      }

      const capSkipped = validRows - attempted;
      job.created = created;
      job.updated = updated;
      job.skipped = skipped + capSkipped;
      job.processedRows = attempted;
      job.failedRows = job.predictedInvalid;
      job.state = 'completed';
      job.mappings = mappings.map((mapping) => ({ sourceHeader: mapping.sourceHeader, targetField: mapping.targetField }));

      appendAuditEvent(db, {
        organizationId: job.organizationId,
        action: 'record.updated',
        resource: job.resource,
        resourceLabel: `Demonstration import “${job.fileName}”`,
        severity: 'info',
      });

      return ok({ created, updated, skipped: job.skipped, failed: job.failedRows, jobId });
    },

    importJobs: async (query = {}) => {
      await delay('import-jobs', { latency: { min: 80, max: 200 } });
      const organizationId = activeOrganizationId(db);
      const items: Array<{
        id: Id;
        resource: string;
        state: string;
        createdAt: string;
        createdBy: string;
        totalRows: number;
        processedRows: number;
        failedRows: number;
      }> = [];

      // Historical jobs are derived from the seeded records rather than invented: the row
      // counts are the real counts of the contacts and accounts that exist for this
      // organization, and the screen labels them as illustrative history.
      const organization = db.state.organizations[organizationId];
      const contacts = asRecords<Contact>(db, 'contacts').filter((contact) => contact.organizationId === organizationId);
      const accounts = asRecords<import('@crm/shared-types').Account>(db, 'accounts').filter(
        (account) => account.organizationId === organizationId,
      );
      const seededBy = signedInUser(db)?.displayName ?? 'Operator';
      const historyAt = organization?.createdAt ?? DATASET_EPOCH.toISOString();
      if (contacts.length > 0) {
        items.push({
          id: `imp-history-${organizationId}-contacts`,
          resource: 'contacts',
          state: 'completed',
          createdAt: historyAt,
          createdBy: seededBy,
          totalRows: contacts.length,
          processedRows: contacts.length,
          failedRows: contacts.filter((contact) => contact.emails.length === 0).length,
        });
      }
      if (accounts.length > 0) {
        items.push({
          id: `imp-history-${organizationId}-accounts`,
          resource: 'accounts',
          state: 'completed',
          createdAt: historyAt,
          createdBy: seededBy,
          totalRows: accounts.length,
          processedRows: accounts.length,
          failedRows: 0,
        });
      }

      for (const job of jobs.values()) {
        if (job.organizationId !== organizationId) continue;
        items.push({
          id: job.id,
          resource: job.resource,
          state: job.state,
          createdAt: job.createdAt,
          createdBy: job.createdBy,
          totalRows: job.totalRows,
          processedRows: job.processedRows,
          failedRows: job.failedRows,
        });
      }

      return runQuery(items, query, {
        searchFields: ['resource', 'state', 'createdBy'],
        facetField: 'state',
        defaultSort: [{ field: 'createdAt', direction: 'desc' }],
      });
    },

    duplicateCandidates: async (query = {}) => {
      await delay('duplicate-candidates', { latency: { min: 120, max: 300 } });
      const organizationId = activeOrganizationId(db);
      const candidates = deriveCandidates(organizationId);
      return runQuery(candidates, query, {
        searchFields: ['recordA.label', 'recordB.label'],
        facetField: 'status',
        defaultSort: [{ field: 'score', direction: 'desc' }],
      });
    },

    resolveDuplicate: async (id, resolution) => {
      await delay(`duplicate-resolve:${id}`, { latency: { min: 160, max: 340 } });
      const candidate = deriveCandidates(activeOrganizationId(db)).find((entry) => entry.id === id);
      if (!candidate) return err<DuplicateCandidate>('not_found', 'That candidate is no longer in the list.');
      const resolved = { ...candidate, status: resolution };
      duplicateResolutions.set(id, resolved);
      return ok(resolved);
    },

    mergeRecords: async (candidate) => {
      await delay(`duplicate-merge:${candidate.id}`, { latency: { min: 260, max: 560 } });
      const derived = deriveCandidates(activeOrganizationId(db)).find((entry) => entry.id === candidate.id) ?? candidate;
      const primaryId = derived.recordA.id;
      const secondaryId = derived.recordB.id;
      let movedRelations = 0;

      if (derived.entityKind === 'contact') {
        if (!db.state.contacts[primaryId] || !db.state.contacts[secondaryId]) {
          return err<{ primaryId: Id; mergedIds: Id[]; movedRelations: number }>('not_found', 'One of the records has already been removed.');
        }
        // Related deals are genuinely re-pointed, so the merge is a real local cascade.
        for (const deal of Object.values(db.state.deals)) {
          if (deal.primaryContactId === secondaryId) {
            db.put('deals', { ...deal, primaryContactId: primaryId, updatedAt: new Date().toISOString() });
            movedRelations += 1;
          }
        }
        db.remove('contacts', secondaryId);
      } else if (derived.entityKind === 'lead') {
        if (!db.state.leads[primaryId] || !db.state.leads[secondaryId]) {
          return err<{ primaryId: Id; mergedIds: Id[]; movedRelations: number }>('not_found', 'One of the records has already been removed.');
        }
        db.remove('leads', secondaryId);
      } else {
        if (!db.state.accounts[primaryId] || !db.state.accounts[secondaryId]) {
          return err<{ primaryId: Id; mergedIds: Id[]; movedRelations: number }>('not_found', 'One of the records has already been removed.');
        }
        for (const deal of Object.values(db.state.deals)) {
          if (deal.accountId === secondaryId) {
            db.put('deals', { ...deal, accountId: primaryId, updatedAt: new Date().toISOString() });
            movedRelations += 1;
          }
        }
        for (const contact of Object.values(db.state.contacts)) {
          if (contact.accountId === secondaryId) {
            db.put('contacts', { ...contact, accountId: primaryId, updatedAt: new Date().toISOString() });
            movedRelations += 1;
          }
        }
        db.remove('accounts', secondaryId);
      }

      duplicateResolutions.set(derived.id, { ...derived, status: 'merged' });
      return ok({ primaryId, mergedIds: [secondaryId], movedRelations });
    },

    retentionPolicy: async () => {
      await delay('retention-policy', { latency: { min: 120, max: 280 } });
      const organizationId = activeOrganizationId(db);
      const rules = currentRetention(organizationId).map((rule) => ({
        id: rule.id,
        resource: rule.resource,
        retentionDays: rule.retentionDays,
        action: rule.action,
        enabled: rule.enabled,
        legalHoldExempt: rule.legalHoldExempt,
      }));
      const reviewed = settingsFor(organizationId).retention
        ? toDateString(new Date())
        : toDateString(DATASET_EPOCH);
      return ok({ rules, lastReviewedAt: reviewed });
    },

    updateRetentionPolicy: async (rules) => {
      await delay('retention-update', { latency: { min: 220, max: 460 } });
      const organizationId = activeOrganizationId(db);
      const invalid = rules.find((rule) => rule.retentionDays < 30 || rule.retentionDays > 3650);
      if (invalid) {
        return err<{ updated: number }>('validation_failed', 'Retention must be between 30 and 3650 days.', {
          fieldErrors: [{ path: 'retentionDays', message: 'Use a value between 30 and 3650 days.' }],
        });
      }
      const existing = settingsFor(organizationId).retention ?? [];
      const merged = rules.map((rule) => ({ id: rule.id, retentionDays: rule.retentionDays, enabled: rule.enabled }));
      const next = [...existing.filter((rule) => !merged.some((candidate) => candidate.id === rule.id)), ...merged];
      updateSettings(organizationId, { retention: next });
      appendAuditEvent(db, {
        organizationId,
        action: 'permission.changed',
        resource: 'retention_policy',
        resourceLabel: 'Retention rules updated',
        severity: 'warning',
      });
      return ok({ updated: merged.length });
    },

    backupStatus: async () => {
      await delay('backup-status', { latency: { min: 100, max: 240 } });
      const organizationId = activeOrganizationId(db);
      const restores = settingsFor(organizationId).restores ?? [];
      return ok({
        // The type itself makes the absence of a backup integration explicit.
        state: 'not_connected' as const,
        lastBackupAt: undefined,
        note:
          'No backup service is connected. There is no snapshot, no point-in-time recovery and no off-site copy — this browser’s localStorage is the only persistence.',
        requestedRestores: restores,
      });
    },

    requestRestore: async (scope, reason) => {
      await delay('backup-restore-request', { latency: { min: 220, max: 480 } });
      const organizationId = activeOrganizationId(db);
      const request: RestoreRequestInternal = {
        id: nextId('restore'),
        requestedAt: new Date().toISOString(),
        state: 'requested',
        scope,
      };
      const restores = [...(settingsFor(organizationId).restores ?? []), request];
      updateSettings(organizationId, { restores: restores.slice(-10) });
      return ok({
        id: request.id,
        state: 'requested' as const,
        note: `Request recorded for “${scope}” (${reason || 'no reason given'}). No backup exists to restore from, so nothing was restored.`,
      });
    },

    deletionRequests: async (query = {}) => {
      await delay('deletion-requests', { latency: { min: 120, max: 300 } });
      const organizationId = activeOrganizationId(db);
      const contacts = asRecords<Contact>(db, 'contacts').filter((contact) => contact.organizationId === organizationId);
      const states: Array<'received' | 'verifying' | 'approved' | 'rejected' | 'completed'> = [
        'received',
        'verifying',
        'approved',
        'rejected',
        'completed',
      ];

      // Derived from withdrawn consent entries: a withdrawal on the record is the signal this
      // browser actually holds. No privacy workflow or regulator connection exists.
      const items = contacts
        .filter((contact) => contact.consent.some((entry) => entry.state === 'withdrawn'))
        .map((contact) => {
          const withdrawn = contact.consent.find((entry) => entry.state === 'withdrawn');
          const requestedAt = withdrawn?.capturedAt ?? DATASET_EPOCH.toISOString();
          const dueAt = new Date(new Date(requestedAt).getTime() + 30 * 86_400_000).toISOString();
          return {
            id: `delreq-${contact.id}`,
            subjectLabel: contact.displayName,
            requestedAt,
            requestedBy: `Consent withdrawal (${withdrawn?.channel ?? 'unknown channel'})`,
            scope: 'contact_record',
            state: states[hash(contact.id) % states.length]!,
            dueAt: Number.isNaN(new Date(dueAt).getTime()) ? DATASET_EPOCH.toISOString() : dueAt,
            note: 'Derived from the withdrawn consent entry on this contact. No privacy workflow is connected and nothing was deleted.',
          };
        })
        .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));

      return runQuery(items, query, {
        searchFields: ['subjectLabel', 'requestedBy', 'scope', 'state'],
        facetField: 'state',
        defaultSort: [{ field: 'requestedAt', direction: 'desc' }],
      });
    },

    consentOverview: async () => {
      await delay('consent-overview', { latency: { min: 160, max: 360 } });
      const organizationId = activeOrganizationId(db);
      const contacts = asRecords<Contact>(db, 'contacts').filter((contact) => contact.organizationId === organizationId);
      const channels = ['email', 'sms', 'phone', 'whatsapp', 'post', 'profiling'] as const;

      const byChannel = channels.map((channel) => {
        const entries = contacts
          .map((contact) => contact.consent.find((record) => record.channel === channel))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        return {
          channel,
          granted: entries.filter((entry) => entry.state === 'granted').length,
          denied: entries.filter((entry) => entry.state === 'denied').length,
          withdrawn: entries.filter((entry) => entry.state === 'withdrawn').length,
          pending: entries.filter((entry) => entry.state === 'pending' || entry.state === 'not_asked').length,
        };
      });

      const jurisdictions = [...new Set(contacts.flatMap((contact) => contact.consent.map((entry) => entry.jurisdiction)).filter((value): value is string => Boolean(value)))];
      const byJurisdiction = jurisdictions.map((jurisdiction) => {
        const scoped = contacts.filter((contact) => contact.consent.some((entry) => entry.jurisdiction === jurisdiction));
        const entries = scoped.flatMap((contact) => contact.consent.filter((entry) => entry.jurisdiction === jurisdiction));
        return {
          jurisdiction,
          contacts: scoped.length,
          granted: entries.filter((entry) => entry.state === 'granted').length,
          withdrawn: entries.filter((entry) => entry.state === 'withdrawn').length,
        };
      });

      const thirtyDaysAgo = new Date(DATASET_EPOCH.getTime() - 30 * 86_400_000).toISOString();
      const changes30d = contacts.reduce(
        (sum, contact) => sum + contact.consent.filter((entry) => (entry.capturedAt ?? '') >= thirtyDaysAgo).length,
        0,
      );

      return ok({ byChannel, byJurisdiction, changes30d });
    },
  };
}

/* ================================================================== BILLING */

/** The current billed amount for a subscription interval, with add-ons included. */
function pricedSubscription(db: Db, subscription: PlatformSubscription): PlatformSubscription {
  const addOnMonthly = subscription.addOns.reduce((sum, entry) => {
    const addOn = db.state.platformAddOns[entry.addOnId];
    const recurring =
      addOn?.pricingModel === 'flat_monthly' || addOn?.pricingModel === 'per_user_monthly' || addOn?.pricingModel === 'per_unit';
    // A recurring add-on price is treated as a monthly amount per quantity unit.
    return sum + (recurring ? entry.price.amount * entry.quantity : 0);
  }, 0);
  const monthly = subscription.baseFee.amount + subscription.unitPrice.amount * subscription.seats + addOnMonthly;
  return {
    ...subscription,
    mrr: money(monthly, subscription.currency),
    // Annualised from the monthly figure. An annual discount is described on the plan, not
    // applied here, and the screen says so.
    arr: money(monthly * 12, subscription.currency),
  };
}

function planPrice(plan: PlatformPlan, seats: number, interval: 'month' | 'year'): {
  base: number;
  perSeat: number;
  recurring: number;
  currency: CurrencyCode;
  annualDiscountPercent?: number;
} | null {
  const option = plan.billingOptions.find((candidate) => candidate.interval === interval) ?? plan.billingOptions[0];
  if (!option) return null;
  const base = option.basePlatformFee.amount;
  const perSeat = option.perUserPrice?.amount ?? 0;
  const monthly = base + perSeat * seats;
  if (interval === 'year') {
    const discountPercent = option.annualDiscountPercent;
    const gross = monthly * 12;
    const discount = discountPercent ? Math.round((gross * discountPercent) / 100) : 0;
    return { base, perSeat, recurring: gross - discount, currency: option.currency, annualDiscountPercent: discountPercent };
  }
  return { base, perSeat, recurring: monthly, currency: option.currency };
}

function entitlementFor(db: Db, moduleKey: string, included: boolean, source: Entitlement['source'], trialEndsAt?: string): Entitlement {
  const catalogEntry = Object.values(db.state.moduleCatalog).find((entry) => entry.key === moduleKey);
  return {
    moduleKey,
    label: catalogEntry?.name ?? moduleKey.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
    included,
    limits: {},
    source,
    trialEndsAt,
  };
}

/**
 * A plan may grant `'*'` instead of enumerating modules. Any read that names modules to a user
 * has to expand it first, otherwise the wildcard itself is shown as a module and the modules the
 * tenant already holds look like they were lost. The universe is every key the platform sells —
 * the catalog plus what plans and add-ons actually grant — because the catalog alone omits six
 * keys that plans reference, such as `orders` and `documents`.
 */
function expandModuleKeys(db: Db, keys: readonly string[]): string[] {
  if (!keys.includes('*')) return [...keys];
  const universe = new Set<string>(Object.values(db.state.moduleCatalog).map((entry) => entry.key));
  for (const plan of Object.values(db.state.platformPlans)) {
    for (const moduleKey of plan.moduleKeys) if (moduleKey !== '*') universe.add(moduleKey);
  }
  for (const addOn of Object.values(db.state.platformAddOns)) {
    for (const moduleKey of addOn.moduleKeys) universe.add(moduleKey);
  }
  return [...universe];
}

/** Demonstration promotion codes. No payment provider validates them. */
const PROMO_CODES: Record<string, { kind: 'percent' | 'amount'; value: number; description: string }> = {
  DEMO20: { kind: 'percent', value: 20, description: '20% off the first period (demonstration code).' },
  WELCOME100: { kind: 'amount', value: 100, description: '100 off the first period (demonstration code).' },
  ANNUAL15: { kind: 'percent', value: 15, description: '15% off annual billing (demonstration code).' },
};

export function makeBillingService(db: Db): ServiceContainer['billing'] {
  const subscriptionFor = (organizationId: Id): PlatformSubscription | undefined => {
    const tenant = tenantForOrganization(db, organizationId);
    if (!tenant) return undefined;
    return (
      db.state.platformSubscriptions[`psub-${tenant.id}`] ??
      Object.values(db.state.platformSubscriptions).find((subscription) => subscription.tenantId === tenant.id)
    );
  };

  const writeSubscription = (organizationId: Id, next: PlatformSubscription): PlatformSubscription => {
    const tenant = tenantForOrganization(db, organizationId);
    db.transaction((draft) => {
      draft.platformSubscriptions[next.id] = next;
      // Keep the tenant record's plan and seat counts aligned so the two cannot disagree.
      if (tenant) {
        const stored = draft.tenants[tenant.id];
        if (stored) {
          stored.planId = next.planId;
          stored.seatsPurchased = next.seats;
          stored.subscriptionStatus = next.status;
          stored.updatedAt = new Date().toISOString();
        }
      }
    });
    return db.state.platformSubscriptions[next.id]!;
  };

  return {
    subscription: async () => {
      await delay('billing-subscription', { latency: { min: 120, max: 300 } });
      const organizationId = activeOrganizationId(db);
      const subscription = subscriptionFor(organizationId);
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      return ok(pricedSubscription(db, subscription));
    },

    plans: async (query = {}) => {
      await delay('billing-plans', { latency: { min: 100, max: 240 } });
      const records = Object.values(db.state.platformPlans).filter((plan) => !plan.isArchived);
      return runQuery(records, query, {
        searchFields: ['name', 'code', 'description'],
        facetField: 'visibility',
        defaultSort: [{ field: 'sortOrder', direction: 'asc' }],
      });
    },

    addOns: async (query = {}) => {
      await delay('billing-addons', { latency: { min: 100, max: 240 } });
      const records = Object.values(db.state.platformAddOns).filter((addOn) => addOn.isActive);
      return runQuery(records, query, {
        searchFields: ['name', 'code', 'description'],
        defaultSort: [{ field: 'name', direction: 'asc' }],
      });
    },

    previewPlanChange: async (planId, seats, interval) => {
      await delay(`billing-preview:${planId}`, { latency: { min: 240, max: 520 } });
      const organizationId = activeOrganizationId(db);
      const subscription = subscriptionFor(organizationId);
      const plan = db.state.platformPlans[planId];
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      if (!plan) return err('not_found', 'That plan is not available.');
      if (!Number.isFinite(seats) || seats < 1) {
        return err('validation_failed', 'At least one seat is required.', {
          fieldErrors: [{ path: 'seats', message: 'Enter a seat count of one or more.' }],
        });
      }

      const price = planPrice(plan, seats, interval);
      if (!price) return err('validation_failed', 'That plan has no billing options configured.');

      const currentPlan = db.state.platformPlans[subscription.planId];
      const current = pricedSubscription(db, subscription);
      const currentPerInterval = subscription.billingInterval === 'year' ? current.arr.amount : current.mrr.amount;
      const isUpgrade = price.recurring > currentPerInterval;

      const periodEnd = new Date(subscription.currentPeriodEnd).getTime();
      const periodStart = new Date(subscription.currentPeriodStart).getTime();
      const now = Date.now();
      const remainingDays = Number.isFinite(periodEnd) && periodEnd > now ? Math.ceil((periodEnd - now) / 86_400_000) : 0;
      const periodDays =
        Number.isFinite(periodEnd) && Number.isFinite(periodStart) && periodEnd > periodStart
          ? Math.ceil((periodEnd - periodStart) / 86_400_000)
          : 30;

      // Illustration only: a real provider computes proration on invoicing rules this
      // frontend does not hold. The wording says which figure is an estimate.
      const amountDueNow = isUpgrade && remainingDays > 0
        ? Math.max(0, Math.round(((price.recurring - currentPerInterval) * remainingDays) / periodDays))
        : 0;

      const newModules = new Set(expandModuleKeys(db, plan.moduleKeys));
      const oldModules = new Set(expandModuleKeys(db, currentPlan?.moduleKeys ?? []));
      const gained = [...newModules].filter((key) => !oldModules.has(key)).map((key) => entitlementFor(db, key, true, 'plan'));
      const lost = [...oldModules].filter((key) => !newModules.has(key)).map((key) => entitlementFor(db, key, false, 'plan'));

      return ok({
        planId,
        seats,
        interval,
        amountDueNow,
        recurringAmount: price.recurring,
        currency: price.currency,
        effectiveDate: isUpgrade ? toDateString(new Date(now)) : subscription.currentPeriodEnd,
        prorationNote: isUpgrade
          ? `Illustrative proration over the ${remainingDays} day${remainingDays === 1 ? '' : 's'} left in the current period. No invoice is raised and no card is charged.`
          : `This change takes effect at the end of the current period on ${subscription.currentPeriodEnd}. Nothing is charged or credited now.`,
        entitlementsGained: gained,
        entitlementsLost: lost,
      });
    },

    changePlan: async (planId, seats, interval, options) => {
      const failure = simulatedFailure<PlatformSubscription>(options);
      if (failure) {
        await delay(`billing-change-fail:${planId}`, options);
        return failure;
      }
      await delay(`billing-change:${planId}`, { latency: { min: 320, max: 720 } });
      const organizationId = activeOrganizationId(db);
      const subscription = subscriptionFor(organizationId);
      const plan = db.state.platformPlans[planId];
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      if (!plan) return err('not_found', 'That plan is not available.');
      if (seats < subscription.seatsUsed) {
        return err<PlatformSubscription>('validation_failed', `${subscription.seatsUsed} seats are in use, so the plan cannot be reduced below that.`);
      }
      const price = planPrice(plan, seats, interval);
      if (!price) return err<PlatformSubscription>('validation_failed', 'That plan has no billing options configured.');

      const next = {
        ...subscription,
        planId: plan.id,
        planName: plan.name,
        billingInterval: interval,
        seats,
        unitPrice: money(price.perSeat, price.currency),
        baseFee: money(price.base, price.currency),
        currency: price.currency,
        // The billing integration state is part of the record, not an assumption.
        billingState: 'not_connected' as const,
        updatedAt: new Date().toISOString(),
      };
      return ok(writeSubscription(organizationId, pricedSubscription(db, next)));
    },

    updateSeats: async (seats) => {
      await delay('billing-seats', { latency: { min: 220, max: 480 } });
      const organizationId = activeOrganizationId(db);
      const subscription = subscriptionFor(organizationId);
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      if (!Number.isFinite(seats) || seats < 1) {
        return err<PlatformSubscription>('validation_failed', 'At least one seat is required.', {
          fieldErrors: [{ path: 'seats', message: 'Enter a seat count of one or more.' }],
        });
      }
      if (seats < subscription.seatsUsed) {
        return err<PlatformSubscription>('validation_failed', `${subscription.seatsUsed} seats are in use. Deactivate users before reducing below that.`);
      }
      const plan = db.state.platformPlans[subscription.planId];
      const option = plan?.billingOptions.find((candidate) => candidate.interval === subscription.billingInterval);
      const maximum = option?.maximumSeats ?? plan?.seatLimits.max ?? null;
      if (maximum !== null && maximum !== undefined && seats > maximum) {
        return err<PlatformSubscription>('validation_failed', `This plan accepts at most ${maximum} seats.`);
      }
      const next = { ...subscription, seats: Math.floor(seats), updatedAt: new Date().toISOString() };
      return ok(writeSubscription(organizationId, pricedSubscription(db, next)));
    },

    setAddOn: async (addOnId, quantity) => {
      await delay(`billing-addon:${addOnId}`, { latency: { min: 220, max: 480 } });
      const organizationId = activeOrganizationId(db);
      const subscription = subscriptionFor(organizationId);
      const addOn = db.state.platformAddOns[addOnId];
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      if (!addOn) return err('not_found', 'That add-on is not available.');
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 100) {
        return err<PlatformSubscription>('validation_failed', 'Quantity must be between 0 and 100.', {
          fieldErrors: [{ path: 'quantity', message: 'Enter a quantity between 0 and 100.' }],
        });
      }
      if (!addOn.compatiblePlanIds.includes(subscription.planId)) {
        return err<PlatformSubscription>('validation_failed', `${addOn.name} is not available on the ${subscription.planName} plan.`);
      }

      const others = subscription.addOns.filter((entry) => entry.addOnId !== addOnId);
      const addOns =
        quantity === 0
          ? others
          : [
              ...others,
              {
                addOnId,
                name: addOn.name,
                quantity: Math.floor(quantity),
                price: money(addOn.price.amount, addOn.currency),
              },
            ];
      const next = { ...subscription, addOns, updatedAt: new Date().toISOString() };
      return ok(writeSubscription(organizationId, pricedSubscription(db, next)));
    },

    cancel: async (reason, effective) => {
      await delay('billing-cancel', { latency: { min: 260, max: 560 } });
      const organizationId = activeOrganizationId(db);
      const subscription = subscriptionFor(organizationId);
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      if (subscription.status === 'canceled') {
        return err<PlatformSubscription>('conflict', 'This subscription is already cancelled.');
      }
      if (!reason.trim()) {
        return err<PlatformSubscription>('validation_failed', 'A reason is required to cancel.', {
          fieldErrors: [{ path: 'reason', message: 'Explain why the subscription is being cancelled.' }],
        });
      }
      const now = new Date().toISOString();
      const next: PlatformSubscription = {
        ...subscription,
        status: 'canceled',
        canceledAt: now,
        cancelReason: reason.trim(),
        cancellationEffectiveAt: effective === 'immediately' ? toDateString(new Date()) : subscription.currentPeriodEnd,
        updatedAt: now,
      };
      return ok(writeSubscription(organizationId, pricedSubscription(db, next)));
    },

    reactivate: async () => {
      await delay('billing-reactivate', { latency: { min: 240, max: 520 } });
      const organizationId = activeOrganizationId(db);
      const subscription = subscriptionFor(organizationId);
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      if (subscription.status !== 'canceled' && subscription.status !== 'paused') {
        return err<PlatformSubscription>('conflict', 'This subscription is already active.');
      }
      const next: PlatformSubscription = {
        ...subscription,
        status: 'active',
        canceledAt: undefined,
        cancelReason: undefined,
        cancellationEffectiveAt: undefined,
        updatedAt: new Date().toISOString(),
      };
      return ok(writeSubscription(organizationId, pricedSubscription(db, next)));
    },

    paymentMethods: async () => {
      await delay('billing-payment-methods', { latency: { min: 120, max: 300 } });
      // One placeholder record rather than a fabricated card. The state field makes the
      // absence explicit and the screen renders it as “not connected”.
      return ok([
        {
          id: 'pm-not-connected',
          label: 'No payment method is connected',
          brand: 'Not connected',
          last4Masked: '••••',
          expiresAt: '',
          isDefault: true,
          state: 'not_connected' as const,
        },
      ]);
    },

    invoices: async (query = {}) => {
      await delay('billing-invoices', { latency: { min: 120, max: 300 } });
      const organizationId = activeOrganizationId(db);
      const tenant = tenantForOrganization(db, organizationId);
      const records: PlatformInvoice[] = tenant
        ? Object.values(db.state.platformInvoices).filter((invoice) => invoice.tenantId === tenant.id)
        : [];
      return runQuery(records, query, {
        searchFields: ['reference', 'status', 'failureReason'],
        facetField: 'status',
        defaultSort: [{ field: 'issuedAt', direction: 'desc' }],
      });
    },

    usage: async () => {
      await delay('billing-usage', { latency: { min: 120, max: 280 } });
      const organizationId = activeOrganizationId(db);
      const meters = asRecords<UsageMeter>(db, 'usageMeters')
        .filter((meter) => meter.organizationId === organizationId)
        .map((meter) => ({
          ...meter,
          overage: meter.included > 0 && meter.used > meter.included ? meter.used - meter.included : 0,
        }));
      return ok(meters);
    },

    entitlements: async () => {
      await delay('billing-entitlements', { latency: { min: 120, max: 280 } });
      const organizationId = activeOrganizationId(db);
      const tenant = tenantForOrganization(db, organizationId);
      const subscription = subscriptionFor(organizationId);
      if (!subscription) return err('not_found', 'No subscription record is held for this organization.');
      const plan = db.state.platformPlans[subscription.planId];
      const source: Entitlement['source'] = subscription.status === 'trialing' ? 'trial' : 'plan';
      const items = expandModuleKeys(db, plan?.moduleKeys ?? tenant?.enabledModuleKeys ?? []).map((moduleKey) =>
        entitlementFor(db, moduleKey, true, source, subscription.trialEndsAt),
      );
      for (const entry of subscription.addOns) {
        const addOn = db.state.platformAddOns[entry.addOnId];
        for (const moduleKey of addOn?.moduleKeys ?? []) {
          if (!items.some((item) => item.moduleKey === moduleKey)) {
            items.push(entitlementFor(db, moduleKey, true, 'addon'));
          }
        }
      }
      return ok(items);
    },

    checkoutPreview: async (planId, seats, interval, promoCode) => {
      await delay(`billing-checkout:${planId}`, { latency: { min: 280, max: 620 } });
      const plan = db.state.platformPlans[planId];
      if (!plan) return err('not_found', 'That plan is not available.');
      const price = planPrice(plan, seats, interval);
      if (!price) return err('validation_failed', 'That plan has no billing options configured.');

      const lines = [
        { label: `${plan.name} — platform fee (${interval})`, amount: interval === 'year' ? price.base * 12 : price.base },
        {
          label: `${seats} × ${price.perSeat === 0 ? 'flat rate' : 'per seat'}`,
          amount: interval === 'year' ? price.perSeat * seats * 12 : price.perSeat * seats,
        },
      ];
      const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
      const discountPercent = price.annualDiscountPercent ?? 0;
      const annualDiscount = interval === 'year' && discountPercent > 0 ? Math.round((subtotal * discountPercent) / 100) : 0;
      const promo = promoCode ? PROMO_CODES[promoCode.trim().toUpperCase()] : undefined;
      const promoDiscount = promo ? (promo.kind === 'percent' ? Math.round((subtotal * promo.value) / 100) : promo.value) : 0;
      const discount = Math.min(subtotal, annualDiscount + promoDiscount);

      return ok({
        reference: nextId('sim-checkout'),
        lines,
        subtotal,
        discount,
        total: Math.max(0, subtotal - discount),
        currency: price.currency,
        paymentProviderState: 'not_connected' as const,
        simulated: true as const,
      });
    },

    applyPromoCode: async (code) => {
      await delay('billing-promo', { latency: { min: 120, max: 300 } });
      const promo = PROMO_CODES[code.trim().toUpperCase()];
      if (!promo) {
        return ok({
          valid: false,
          kind: 'percent' as const,
          value: 0,
          description: 'Not a recognised demonstration code.',
          note: 'Only demonstration codes are recognised, and they discount an illustrative total only — no payment provider validates them.',
        });
      }
      return ok({
        valid: true,
        kind: promo.kind,
        value: promo.value,
        description: promo.description,
        note: 'Applied to the illustrative total only. No payment provider is connected and no charge is made.',
      });
    },
  };
}
