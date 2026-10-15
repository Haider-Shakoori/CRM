/**
 * Cross-cutting primitives shared by every domain model.
 *
 * These types are the contract between the UI, the mock service layer, and the
 * future Laravel REST API. Nothing here assumes a transport, a database, or an
 * identifier format — only that IDs are opaque strings.
 */

/** Opaque opaque identifier. Server-side may use UUID, ULID or an integer. */
export type Id = string;
export type ISODateString = string;
export type ISODateTimeString = string;
export type CurrencyCode = string;
export type LanguageTag = string;

/* ------------------------------------------------------------------ results */

export interface Ok<T> {
  ok: true;
  data: T;
}

export interface Err {
  ok: false;
  error: AppErrorBody;
}

export type Result<T> = Ok<T> | Err;

export type AppErrorCode =
  | 'not_found'
  | 'validation_failed'
  | 'conflict'
  | 'duplicate'
  | 'forbidden'
  | 'unauthenticated'
  | 'entitlement_missing'
  | 'rate_limited'
  | 'offline'
  | 'unexpected';

export interface FieldError {
  /** Dot-path to the offending field, e.g. `addresses[0].postalCode`. */
  path: string;
  message: string;
  code?: string;
}

export interface AppErrorBody {
  code: AppErrorCode;
  /** Message intended for end users; already localized where a locale was supplied. */
  message: string;
  fieldErrors?: FieldError[];
  /** Correlates the UI error with a server log entry once the API exists. */
  traceId?: string;
  retryable: boolean;
}

/* -------------------------------------------------------------------- money */

export interface Money {
  /** Decimal amount, not minor units, so the UI never guesses the exponent. */
  amount: number;
  currency: CurrencyCode;
}

export interface ExchangeRateRef {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  /** Provenance matters: exchange rates are explicitly out of frontend scope. */
  source: 'organization_default' | 'price_book' | 'manual_demo' | 'unknown';
  asOf: ISODateString;
}

/* ------------------------------------------------------------------- people */

export interface Address {
  id?: Id;
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  /** Region/first-level administrative division, used where ISO codes are insufficient. */
  administrativeArea?: string;
}

export interface PhoneNumber {
  id?: Id;
  label?: string;
  /** Full E.164 form when known, otherwise a raw national string. */
  value: string;
  countryCode?: string;
  extension?: string;
  isPrimary?: boolean;
}

export interface EmailAddress {
  id?: Id;
  label?: string;
  value: string;
  isPrimary?: boolean;
  /** Consent is tracked per channel; the UI never infers it. */
  consent?: ConsentRecord;
}

export interface WebsiteRef {
  label?: string;
  url: string;
}

/* ------------------------------------------------------------------ consent */

export type ConsentChannel = 'email' | 'sms' | 'phone' | 'whatsapp' | 'post' | 'profiling';
export type ConsentState = 'granted' | 'denied' | 'withdrawn' | 'pending' | 'not_asked';

export interface ConsentRecord {
  channel: ConsentChannel;
  state: ConsentState;
  /** Jurisdiction tag only. Legal interpretation belongs to the backend/legal review. */
  jurisdiction?: string;
  lawfulBasis?: 'consent' | 'contract' | 'legitimate_interest' | 'legal_obligation' | 'unspecified';
  capturedAt?: ISODateTimeString;
  capturedVia?: string;
  expiresAt?: ISODateTimeString;
  note?: string;
}

/* ------------------------------------------------------------------- common */

export interface Tag {
  id: Id;
  label: string;
  color: Tone;
}

export type Tone =
  | 'violet'
  | 'teal'
  | 'amber'
  | 'green'
  | 'red'
  | 'blue'
  | 'slate'
  | 'neutral';

export interface ImageRef {
  id: Id;
  /** Path to a locally generated placeholder asset — never a hotlinked third-party image. */
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface FileRef {
  id: Id;
  name: string;
  /** Bytes. */
  size: number;
  mimeType: string;
  uploadedAt: ISODateTimeString;
  uploadedBy?: Id;
  url?: string;
  /** Mock storage is always flagged so the UI can label it as demonstration data. */
  demoOnly?: boolean;
}

/* --------------------------------------------------------------- audit base */

export interface Auditable {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  createdBy?: Id;
  updatedBy?: Id;
}

export interface Archivable {
  archivedAt?: ISODateTimeString;
  archivedBy?: Id;
}

export interface Ownable {
  ownerId: Id;
}

export interface NamedEntity {
  id: Id;
  name: string;
}

/* -------------------------------------------------------------- data access */

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  field: string;
  direction: SortDirection;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is_empty'
  | 'is_not_empty';

export interface FilterClause {
  field: string;
  operator: FilterOperator;
  value?: unknown;
  /** Groups allow the saved-view builder to express AND/OR blocks. */
  groupId?: string;
}

export interface FilterGroup {
  id: string;
  conjunction: 'and' | 'or';
  clauses: Array<FilterClause | FilterGroup>;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: SortSpec[];
  /** Free-text search term. */
  q?: string;
  filter?: FilterGroup;
  /** Convenience shortcuts the UI uses for saved views and quick filters. */
  ids?: Id[];
  includeArchived?: boolean;
  /** Locale hint so the mock layer can sort and format like the server will. */
  locale?: LanguageTag;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
  /** Facet counts mirror the future API so filter chips can show result counts. */
  facets?: Record<string, Array<{ value: string; label: string; count: number }>>;
}

/* --------------------------------------------------------------- timestamps */

export interface DateRange {
  from?: ISODateString;
  to?: ISODateString;
}

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'last_30_days'
  | 'last_90_days'
  | 'next_quarter'
  | 'custom';

export interface PeriodSelection {
  preset: PeriodPreset;
  range?: DateRange;
}

/* -------------------------------------------------------- custom field values */

export type CustomFieldValue = string | number | boolean | null | ISODateString | string[];

export interface CustomFieldBag {
  /** Keyed by `CustomField.key`. Values are untyped here on purpose: the UI reads
   *  the field definition from the customization service before rendering. */
  [key: string]: CustomFieldValue;
}

/* --------------------------------------------------------------- selectors */

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: Tone;
  group?: string;
}

export interface BulkActionOutcome {
  requested: number;
  succeeded: number;
  failed: number;
  failures: Array<{ id: Id; reason: string }>;
}

/* ------------------------------------------------------------------ metrics */

export interface Delta {
  value: number;
  unit: 'percent' | 'absolute' | 'currency';
  direction: 'up' | 'down' | 'flat';
  /** Whether the movement is good news. Not inferable from direction alone. */
  sentiment: 'positive' | 'negative' | 'neutral';
  comparisonLabel?: string;
}

export interface MetricPoint {
  label: string;
  date?: ISODateString;
  value: number;
  secondary?: number;
}

export interface SeriesDefinition {
  id: string;
  label: string;
  colorToken?: string;
  type?: 'line' | 'area' | 'bar' | 'stacked_bar' | 'scatter';
  axis?: 'left' | 'right';
  data: MetricPoint[];
}
