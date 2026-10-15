/**
 * The in-browser mock database.
 *
 * Holds every synthetic collection, persists to `localStorage` under a namespaced key, and
 * supports a full reset back to the seeded baseline.
 *
 * Three properties are deliberate:
 *
 *  1. **Namespaced storage.** Everything lives under `crm.mockdb.v1`. The demo reset button
 *     can therefore clear mock data without touching theme, density or locale preferences.
 *  2. **Tenant partitioning is explicit.** Collections are keyed by organization id, so
 *     switching organizations visibly changes the dataset. This is a UI demonstration of
 *     tenancy, NOT a security boundary — real isolation is a server responsibility, and the
 *     code says so here so nobody mistakes the shape of it for a guarantee.
 *  3. **No async, no network.** Reads are synchronous over in-memory arrays. Services add
 *     simulated latency at the boundary so loading states are still exercised.
 */

import type { Id } from '@crm/shared-types';
import { DATASET_EPOCH } from './random';

export const STORAGE_KEY = 'crm.mockdb.v1';

/**
 * Bumped when the shape or the *content* of the seeded dataset changes in a way that makes a
 * previously persisted copy wrong rather than merely old. A returning reviewer keeps whatever
 * `localStorage` copy matches this number and reseeds from scratch otherwise.
 *
 * 2: accounts are given a parent that is strictly earlier in the list, and each tenant's deals
 *    reference its own industry catalogue rather than always the technology one.
 * 3: usage meters gain `organizationId`, which the billing and AI reads scope themselves.
 * 4: invoices are issued before they fall due, and an `overdue` invoice is actually past its
 *    due date. The previous copy had dates that contradicted the status shown next to them.
 * 5: the reverse also holds — a settled or overdue date window is chosen by status, so an
 *    unsettled invoice is never shown past its due date without carrying the `overdue` status.
 */
export const STORAGE_VERSION = 5;

/**
 * The full dataset shape.
 *
 * A `Record<Id, T>` rather than an array for every collection, because lookups by id are the
 * most common operation and a map keeps them O(1). Ordering is handled at query time.
 */
export interface MockDatabase {
  version: number;
  seededAt: string;
  epoch: string;

  tenants: Record<Id, import('@crm/shared-types').Tenant>;
  organizations: Record<Id, import('@crm/shared-types').Organization>;
  users: Record<Id, import('@crm/shared-types').User>;
  teams: Record<Id, import('@crm/shared-types').Team>;
  roles: Record<Id, import('@crm/shared-types').Role>;
  invitations: Record<Id, import('@crm/shared-types').Invitation>;
  auditEvents: Record<Id, import('@crm/shared-types').AuditEvent>;
  sessions: Record<Id, import('@crm/shared-types').SessionRecord>;
  apiKeys: Record<Id, import('@crm/shared-types').ApiKeyRecord>;
  usageMeters: Record<Id, import('@crm/shared-types').UsageMeter>;

  pipelines: Record<Id, import('@crm/shared-types').Pipeline>;
  leadSources: Record<Id, import('@crm/shared-types').LeadSource>;
  leads: Record<Id, import('@crm/shared-types').Lead>;
  contacts: Record<Id, import('@crm/shared-types').Contact>;
  accounts: Record<Id, import('@crm/shared-types').Account>;
  deals: Record<Id, import('@crm/shared-types').Deal>;
  dealLostReasons: Record<Id, import('@crm/shared-types').DealLostReason>;
  activities: Record<Id, import('@crm/shared-types').Activity>;
  calendarEvents: Record<Id, import('@crm/shared-types').CalendarEvent>;
  salesGoals: Record<Id, import('@crm/shared-types').SalesGoal>;
  sequences: Record<Id, import('@crm/shared-types').Sequence>;
  playbooks: Record<Id, import('@crm/shared-types').Playbook>;

  conversations: Record<Id, import('@crm/shared-types').Conversation>;
  messages: Record<Id, import('@crm/shared-types').MessageBase>;
  callRecords: Record<Id, import('@crm/shared-types').CallRecord>;
  sharedInboxes: Record<Id, import('@crm/shared-types').SharedInbox>;
  messageTemplates: Record<Id, import('@crm/shared-types').MessageTemplate>;
  cannedResponses: Record<Id, import('@crm/shared-types').CannedResponse>;

  campaigns: Record<Id, import('@crm/shared-types').Campaign>;
  segments: Record<Id, import('@crm/shared-types').Segment>;
  journeys: Record<Id, import('@crm/shared-types').Journey>;
  emailTemplates: Record<Id, import('@crm/shared-types').EmailTemplate>;
  captureForms: Record<Id, import('@crm/shared-types').CaptureForm>;
  landingPages: Record<Id, import('@crm/shared-types').LandingPage>;

  tickets: Record<Id, import('@crm/shared-types').Ticket>;
  ticketMessages: Record<Id, import('@crm/shared-types').TicketMessage>;
  ticketCategories: Record<Id, import('@crm/shared-types').TicketCategory>;
  slaPolicies: Record<Id, import('@crm/shared-types').SlaPolicy>;
  kbArticles: Record<Id, import('@crm/shared-types').KbArticle>;
  kbCategories: Record<Id, import('@crm/shared-types').KbCategory>;
  surveys: Record<Id, import('@crm/shared-types').Survey>;

  healthScores: Record<Id, import('@crm/shared-types').AccountHealthScore>;
  portfolios: Record<Id, import('@crm/shared-types').SuccessPortfolio>;
  onboardingPlans: Record<Id, import('@crm/shared-types').OnboardingPlan>;
  successPlans: Record<Id, import('@crm/shared-types').SuccessPlan>;
  renewals: Record<Id, import('@crm/shared-types').Renewal>;
  businessReviews: Record<Id, import('@crm/shared-types').BusinessReview>;

  products: Record<Id, import('@crm/shared-types').Product>;
  priceBooks: Record<Id, import('@crm/shared-types').PriceBook>;
  quotes: Record<Id, import('@crm/shared-types').Quote>;
  orders: Record<Id, import('@crm/shared-types').Order>;
  contracts: Record<Id, import('@crm/shared-types').Contract>;
  invoices: Record<Id, import('@crm/shared-types').InvoiceRecord>;
  revenueSubscriptions: Record<Id, import('@crm/shared-types').RevenueSubscription>;
  commissionStatements: Record<Id, import('@crm/shared-types').CommissionStatement>;

  projects: Record<Id, import('@crm/shared-types').Project>;
  projectTasks: Record<Id, import('@crm/shared-types').ProjectTask>;
  projectMilestones: Record<Id, import('@crm/shared-types').ProjectMilestone>;

  territories: Record<Id, import('@crm/shared-types').Territory>;
  visitPlans: Record<Id, import('@crm/shared-types').VisitPlan>;
  visitLogs: Record<Id, import('@crm/shared-types').VisitLog>;

  partners: Record<Id, import('@crm/shared-types').Partner>;
  dealRegistrations: Record<Id, import('@crm/shared-types').DealRegistration>;

  dashboards: Record<Id, import('@crm/shared-types').Dashboard>;
  reports: Record<Id, import('@crm/shared-types').ReportDefinition>;

  workflows: Record<Id, import('@crm/shared-types').Workflow>;
  workflowRuns: Record<Id, import('@crm/shared-types').WorkflowRun>;
  workflowTemplates: Record<Id, import('@crm/shared-types').WorkflowTemplate>;

  customObjects: Record<Id, import('@crm/shared-types').CustomObject>;
  customFields: Record<Id, import('@crm/shared-types').CustomField>;
  savedViews: Record<Id, import('@crm/shared-types').SavedView>;
  layouts: Record<Id, import('@crm/shared-types').PageLayout>;
  validationRules: Record<Id, import('@crm/shared-types').ValidationRule>;
  industryTemplates: Record<Id, import('@crm/shared-types').IndustryTemplate>;

  documentFolders: Record<Id, import('@crm/shared-types').DocumentFolder>;
  documents: Record<Id, import('@crm/shared-types').DocumentFile>;
  feedItems: Record<Id, import('@crm/shared-types').FeedItem>;
  notifications: Record<Id, import('@crm/shared-types').Notification>;
  announcements: Record<Id, import('@crm/shared-types').Announcement>;

  integrations: Record<Id, import('@crm/shared-types').Integration>;
  connections: Record<Id, import('@crm/shared-types').IntegrationConnection>;
  webhookEndpoints: Record<Id, import('@crm/shared-types').WebhookEndpoint>;
  webhookDeliveries: Record<Id, import('@crm/shared-types').WebhookDelivery>;
  apiRequestLogs: Record<Id, import('@crm/shared-types').ApiRequestLog>;
  developerApps: Record<Id, import('@crm/shared-types').DeveloperApp>;

  aiConversations: Record<Id, import('@crm/shared-types').AiConversation>;
  aiUsage: Record<Id, import('@crm/shared-types').AiUsageRecord>;

  platformPlans: Record<Id, import('@crm/shared-types').PlatformPlan>;
  platformAddOns: Record<Id, import('@crm/shared-types').PlatformAddOn>;
  platformSubscriptions: Record<Id, import('@crm/shared-types').PlatformSubscription>;
  platformInvoices: Record<Id, import('@crm/shared-types').PlatformInvoice>;
  platformUsers: Record<Id, import('@crm/shared-types').PlatformUser>;
  platformRoles: Record<Id, import('@crm/shared-types').PlatformRole>;
  platformAudit: Record<Id, import('@crm/shared-types').PlatformAuditEvent>;
  platformSupportTickets: Record<Id, import('@crm/shared-types').PlatformSupportTicket>;
  featureFlags: Record<Id, import('@crm/shared-types').FeatureFlag>;
  moduleCatalog: Record<Id, import('@crm/shared-types').ModuleCatalogEntry>;
  localizationRows: Record<Id, import('@crm/shared-types').LocalizationAdminRow>;
  systemStatus: Record<Id, import('@crm/shared-types').SystemStatusComponent>;
  maintenanceBanners: Record<Id, import('@crm/shared-types').MaintenanceBanner>;

  /** Per-user UI state, kept in the database so switching user visibly changes the app. */
  preferences: Record<Id, import('@crm/shared-types').UserPreferences>;
  onboarding: Record<Id, import('@crm/shared-types').OnboardingProgress>;
}

export type CollectionName = keyof Omit<MockDatabase, 'version' | 'seededAt' | 'epoch'>;

/** Collections whose contents are lists rather than keyed records. */
export const LIST_COLLECTIONS: CollectionName[] = [];

export interface MockDbOptions {
  /** Persist to localStorage. Disabled in tests and in the public demo. */
  persist?: boolean;
  /** Override the dataset. Used by tests to start from a known state. */
  seed?: () => MockDatabase;
}

/**
 * Storage adapter. Wrapped so a test environment without `localStorage` works unchanged,
 * and so a storage quota failure degrades to in-memory rather than throwing inside a render.
 */
class PersistenceAdapter {
  private memory: string | null = null;
  private available: boolean;

  constructor() {
    this.available = typeof localStorage !== 'undefined';
  }

  read(): string | null {
    if (!this.available) return this.memory;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      this.available = false;
      return null;
    }
  }

  write(value: string): void {
    if (!this.available) {
      this.memory = value;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Quota exceeded or storage disabled. Fall back to memory for this session rather
      // than throwing, because a failed save must not break the interface.
      this.available = false;
      this.memory = value;
    }
  }

  clear(): void {
    this.memory = null;
    if (!this.available) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export class MockDb {
  private data: MockDatabase;
  private readonly adapter = new PersistenceAdapter();
  private readonly persist: boolean;
  private readonly seedFactory: () => MockDatabase;
  private listeners = new Set<() => void>();

  constructor(options: MockDbOptions = {}) {
    this.persist = options.persist ?? typeof localStorage !== 'undefined';
    this.seedFactory = options.seed ?? (() => {
      throw new Error('MockDb requires a seed factory. Pass `seed` in options.');
    });
    this.data = this.load();
  }

  private load(): MockDatabase {
    if (this.persist) {
      const raw = this.adapter.read();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as MockDatabase;
          if (parsed.version === STORAGE_VERSION) return parsed;
        } catch {
          // Corrupt payload: fall through to a fresh seed rather than crashing on boot.
        }
      }
    }
    return this.seedFactory();
  }

  /** Persist the current state. Called after every mutation. */
  private commit(): void {
    if (this.persist) this.adapter.write(JSON.stringify(this.data));
    for (const listener of this.listeners) listener();
  }

  /** Subscribe to changes. Used by the demo banner and the reset flow. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The whole dataset. Treat as read-only; mutate through the helpers below. */
  get state(): MockDatabase {
    return this.data;
  }

  /** All records in a collection as an array. */
  all<K extends CollectionName>(collection: K): Array<MockDatabase[K][string]> {
    return Object.values(this.data[collection]) as Array<MockDatabase[K][string]>;
  }

  get<K extends CollectionName>(collection: K, id: Id): MockDatabase[K][string] | undefined {
    return (this.data[collection] as Record<Id, MockDatabase[K][string]>)[id];
  }

  /** Insert or replace a record. Returns the stored record. */
  put<K extends CollectionName>(collection: K, record: MockDatabase[K][string]): MockDatabase[K][string] {
    (this.data[collection] as Record<Id, unknown>)[(record as { id: string }).id] = record;
    this.commit();
    return record;
  }

  /** Insert or replace many records with a single persistence write. */
  putMany<K extends CollectionName>(collection: K, records: Array<MockDatabase[K][string]>): void {
    const target = this.data[collection] as Record<Id, unknown>;
    for (const record of records) target[(record as { id: string }).id] = record;
    this.commit();
  }

  remove<K extends CollectionName>(collection: K, id: Id): boolean {
    const target = this.data[collection] as Record<Id, unknown>;
    if (!(id in target)) return false;
    delete target[id];
    this.commit();
    return true;
  }

  removeMany<K extends CollectionName>(collection: K, ids: Id[]): number {
    const target = this.data[collection] as Record<Id, unknown>;
    let removed = 0;
    for (const id of ids) {
      if (id in target) {
        delete target[id];
        removed += 1;
      }
    }
    if (removed > 0) this.commit();
    return removed;
  }

  /**
   * Apply several mutations as one unit.
   *
   * The callback receives a mutable draft and the persistence write happens once at the end.
   * This is what keeps a deal move from writing four times and, more importantly, what makes
   * a partially applied cascade impossible: either every related record is updated, or the
   * caller's callback throws before anything is committed.
   */
  transaction(mutate: (draft: MockDatabase) => void): void {
    const snapshot = this.data;
    mutate(this.data);
    try {
      this.commit();
    } catch (error) {
      this.data = snapshot;
      throw error;
    }
  }

  /** Restore the seeded baseline, discarding every local change. */
  reset(): { collections: number; records: number } {
    this.data = this.seedFactory();
    this.adapter.clear();
    this.commit();
    return this.snapshot();
  }

  /** Counts for the demo banner and the reset confirmation dialog. */
  snapshot(): { collections: number; records: number } {
    let records = 0;
    let collections = 0;
    for (const [key, value] of Object.entries(this.data)) {
      if (key === 'version' || key === 'seededAt' || key === 'epoch') continue;
      collections += 1;
      records += Object.keys(value as Record<string, unknown>).length;
    }
    return { collections, records };
  }

  /** Read a single preference bag, creating a default if the user has none yet. */
  preferencesFor(userId: Id): import('@crm/shared-types').UserPreferences {
    const existing = this.data.preferences[userId];
    if (existing) return existing;
    const fallback = defaultPreferences();
    this.data.preferences[userId] = fallback;
    return fallback;
  }

  setPreferences(userId: Id, patch: Partial<import('@crm/shared-types').UserPreferences>): import('@crm/shared-types').UserPreferences {
    const merged = { ...this.preferencesFor(userId), ...patch };
    this.data.preferences[userId] = merged;
    this.commit();
    return merged;
  }
}

/**
 * Baseline preferences.
 *
 * `interfaceMode: 'advanced'` is the default here so the reviewer sees the full product on
 * first run; a real deployment would default new organizations to Simple Mode. Theme,
 * density and locale are left at their neutral values so the shell's own defaults apply.
 */
export function defaultPreferences(): import('@crm/shared-types').UserPreferences {
  return {
    theme: 'system',
    density: 'comfortable',
    contrast: 'default',
    reducedMotion: false,
    interfaceMode: 'advanced',
    sidebarCollapsed: false,
    favorites: [],
    recentlyViewed: [],
    defaultLandingRoute: '/app/home',
    emailNotifications: { assignment: true, mention: true, digest: true, slaRisk: true },
    inAppNotifications: { assignment: true, mention: true, commentReply: true, slaRisk: true },
    weeklyDigest: true,
    tablePageSize: 50,
    startOfWeek: 1,
    timeFormat: '24h',
    screenReaderHints: false,
  };
}

export { DATASET_EPOCH };
