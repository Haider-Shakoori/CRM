# API Contracts

**Purpose:** define the payload shapes and behaviours the frontend expects from the future
Laravel REST API, so the mock-to-HTTP swap is a composition-root change rather than a
rewrite.

**Status:** contracts are implemented as TypeScript interfaces in
[`packages/shared-types/src/services.ts`](../../packages/shared-types/src/services.ts). No
server implements them yet. Nothing in this document should be read as a claim that an
endpoint exists.

---

## 1. Principles

1. **The UI depends on interfaces, never on transport.** No view calls `fetch`. Every
   screen receives a `ServiceContainer` and calls methods on it.
2. **Transport-neutral but concern-explicit.** The contracts do not mention HTTP verbs or
   status codes, but they do model pagination, facets, nested filters, partial bulk
   failure, optimistic concurrency and typed errors — because the UI genuinely has to
   handle all five.
3. **Errors are typed, not stringly-typed.** `AppErrorCode` exists so the shell can render
   the right blocked state for `entitlement_missing` versus `forbidden` versus `offline`.
4. **Nothing sensitive is ever modelled on the client.** No password, token, secret,
   certificate or full API key appears in any type in this repository.
5. **Simulated states are part of the contract, not an afterthought.** `simulated: true` is
   a literal type in several places, so a component cannot render a simulated delivery as
   if it were real without a type error.

---

## 2. Envelope conventions

### Success and failure

```ts
type Ok<T>  = { ok: true;  data: T };
type Err    = { ok: false; error: AppErrorBody };
type Result<T> = Ok<T> | Err;

interface AppErrorBody {
  code: AppErrorCode;
  message: string;            // already localised for the request locale
  fieldErrors?: FieldError[]; // path-based, so nested form fields can be highlighted
  traceId?: string;           // correlates with a server log entry
  retryable: boolean;         // drives whether "Try again" is offered
}

type AppErrorCode =
  | 'not_found' | 'validation_failed' | 'conflict' | 'duplicate'
  | 'forbidden' | 'unauthenticated' | 'entitlement_missing'
  | 'rate_limited' | 'offline' | 'unexpected';

interface FieldError {
  path: string;    // dot-path: `addresses[0].postalCode`
  message: string;
  code?: string;
}
```

The `traceId` is rendered in `ErrorState` as "Reference: …" because a support conversation
is far more productive with a correlation id.

### Collections

```ts
interface Paginated<T> {
  items: T[];
  meta: PageMeta;
  facets?: Record<string, Array<{ value: string; label: string; count: number }>>;
}

interface PageMeta {
  page: number; pageSize: number; total: number;
  totalPages: number; hasNext: boolean; hasPrev: boolean;
}
```

Facets are returned with the list so filter chips can display result counts without a
second round trip. Without them, a "Show 42 more" affordance would require N requests.

### Filtering

```ts
interface FilterGroup {
  id: string;
  conjunction: 'and' | 'or';
  clauses: Array<FilterClause | FilterGroup>;  // recursive
}

interface FilterClause {
  field: string;
  operator: FilterOperator;
  value?: unknown;
  groupId?: string;
}

type FilterOperator =
  | 'eq' | 'neq' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
  | 'is_empty' | 'is_not_empty';
```

Recursion is required, not optional: saved views, the segment builder, report definitions
and workflow conditions all need `(A and B) or (C and D)`.

### Writes

```ts
type CreateInput<T, ServerOwned extends keyof T = never> =
  Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | ServerOwned>;

type UpdateInput<T> = Partial<CreateInput<T>> & {
  expectedUpdatedAt?: string;  // optimistic concurrency
};

interface WriteOptions {
  quiet?: boolean;             // suppress the toast; the caller renders inline feedback
  latency?: { min: number; max: number };
  simulate?: 'none' | 'validation_error' | 'conflict' | 'forbidden'
           | 'entitlement_missing' | 'server_error' | 'offline';
}
```

`WriteOptions.simulate` is how error and empty states get built and reviewed before a real
server can produce them. It is a development affordance and will be dropped from production
builds.

`expectedUpdatedAt` exists so the conflict path is exercised from day one. A record edited
by two people is a normal event in a CRM, not an edge case, and a UI that has never been
built to show a conflict will handle it badly.

### Bulk operations

```ts
interface BulkActionOutcome {
  requested: number;
  succeeded: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}
```

Returning a boolean would be a lie. "12 of 15 updated, 3 rows failed because postal code is
required" is the honest and more useful answer.

---

## 3. Resource contracts

Every collection service extends this base:

```ts
interface CrudService<T, TCreate = CreateInput<T>, TQuery = ListQuery> {
  list(query?: TQuery): Promise<Paginated<T>>;
  get(id: string): Promise<Result<T>>;
  create(input: TCreate, options?: WriteOptions): Promise<Result<T>>;
  update(id: string, input: UpdateInput<T>, options?: WriteOptions): Promise<Result<T>>;
  remove(id: string, options?: WriteOptions): Promise<Result<{ id: string }>>;
  bulkRemove(ids: string[], options?: WriteOptions): Promise<Result<BulkActionOutcome>>;
}

interface ArchiveableService<T> {
  archive(id: string): Promise<Result<T>>;
  restore(id: string): Promise<Result<T>>;
}

interface DuplicateDetectionService<T> {
  findDuplicates(candidate: Partial<T>): Promise<Paginated<DuplicateCandidate>>;
  merge(primaryId: string, mergeIds: string[], resolvers: Record<string, string>): Promise<Result<T>>;
}
```

`merge` takes a field-resolution map rather than guessing, because a merge is destructive
and the user must decide which value survives per field.

### Domain services attached

`LeadsService`, `ContactsService`, `AccountsService`, `DealsService`, `PipelinesService`,
`ActivitiesService`, `CalendarService`, `TasksService`, `SequencesService`,
`PlaybooksService`, `GoalsService`, `ConversationsService`, `CampaignsService`,
`SegmentsService`, `JourneysService`, `EmailTemplatesService`, `FormsService`,
`LandingPagesService`, `LeadSourcesService`, `TicketsService`, `KnowledgeBaseService`,
`CustomerSuccessService`, `ProductsService`, `QuotesService`, `OrdersService`,
`ContractsService`, `InvoicesService`, `SubscriptionRevenueService`, `DashboardsService`,
`ReportsService`, `ExportsService`, `AnalyticsService`, `WorkflowsService`,
`CustomObjectsService`, `LayoutsService`, `SavedViewsService`, `IndustryTemplatesService`,
`NavigationService`, `DocumentsService`, `CollaborationService`, `ProjectsService`,
`FieldSalesService`, `PartnersService`, `IntegrationsService`, `DeveloperPlatformService`,
`AiAssistantService`, `OrganizationService`, `UsersService`, `RolesService`,
`SecurityService`, `DataManagementService`, `BillingService`, `TenantContextService`,
`PlatformAdminService`, `DemoDataService`, `OnboardingService`.

Sixty interfaces. The full signatures are in the source file rather than duplicated here.

---

## 4. The operations that must stay consistent

These are the cases where a naive implementation produces a UI that contradicts itself.
Each is contracted as a single operation returning both the changed record and the
recomputed rollup, so the client never has to re-derive a total in two places.

### Moving a deal

```ts
interface DealMoveRequest {
  dealId: string;
  toStageId: string;
  lostReasonId?: string;   // required when the target stage is `lost`
  note?: string;
  optimistic?: boolean;
}

// methods on DealsService
move(request: DealMoveRequest):
  Promise<Result<{ deal: Deal; summary: PipelineSummary }>>;

bulkMove(ids: string[], toStageId: string, options?):
  Promise<Result<{ outcome: BulkActionOutcome; summary: PipelineSummary }>>;
```

**Why it returns the summary:** the kanban board, the stage header totals, the weighted
pipeline figure and the forecast all derive from the same numbers. Computing them
client-side in four places guarantees eventual disagreement. The server is the single
source, and the response carries everything the view needs to repaint.

`PipelineSummary` contains per-stage `dealCount`, `totalValue`, `weightedValue`,
`averageAgeDays` and `staleCount`, plus pipeline-level `winRate` and
`averageCycleTimeDays`.

**Both paths write through the same operation.** Drag-and-drop, the row action menu, the
record's stage selector and the bulk action all call `move`. This is why "accessible non-drag
alternatives stay perfectly in sync" is structurally true rather than carefully maintained.

### Converting a lead

```ts
interface LeadConversionPreview {
  leadId: string;
  contact: { willCreate: boolean; existingId?: string; displayName: string; fieldDiffs: FieldDiff[] };
  account: { willCreate: boolean; existingId?: string; displayName: string; fieldDiffs: FieldDiff[] };
  deal?:    { willCreate: boolean; displayName: string; amount?: Money };
  duplicateWarnings: Array<{ kind: 'contact' | 'account'; existingId: string; label: string; score: number }>;
}

previewConversion(id: string, request: LeadConversionRequest):
  Promise<Result<LeadConversionPreview>>;   // writes nothing

convert(request: LeadConversionRequest):
  Promise<Result<LeadConversionPreview>>;   // commits
```

Preview and commit are separate so the wizard can show field-level conflicts and duplicate
warnings **before** anything is written. `FieldDiff.conflict` marks a field where the lead
and the existing record disagree, and the user resolves each one.

### Mutations that cascade

| Operation | Returns | Why |
| --- | --- | --- |
| `TasksService.complete(id)` | `Task` | The daily plan's totals must update without a second fetch. |
| `ActivitiesService.dailyPlan(userId, date)` | `DailyActivityPlan` | Planner totals computed server-side so the view is cheap to render. |
| `TicketsService.resolve(id, …)` | `Ticket` | Resolution clears SLA timers; the client must not compute that. |
| `CustomerSuccessService.recomputeHealth(ids)` | `BulkActionOutcome` | Health is derived from six weighted components; re-deriving it client-side would diverge from the reports. |
| `QuotesService.recalculate(id)` | `Quote` | Totals, discounts, tax placeholder and recurring rollups are derived together. |
| `QuotesService.convertToOrder(id)` | `{ quote, order }` | Both records change; returning one would leave the other stale. |
| `ProjectsService.acceptHandoff(id, …)` | `Project` | Handoff checklist and status change together. |
| `DashboardsService.saveLayout(id, widgets)` | `Dashboard` | Layout is debounced client-side and persisted as one call. |
| `TenantContextService.switchOrganization(id)` | `{ organization, user }` | Preferences are per-organization; both change. |

### Workflow simulation

```ts
validate(id): Promise<Result<WorkflowValidation>>;
validateDraft(workflow): Promise<Result<WorkflowValidation>>;
simulate(id, sampleRecordId?: string): Promise<Result<WorkflowSimulation>>;
runs(query): Promise<Paginated<WorkflowRun>>;
retryRun(runId): Promise<Result<WorkflowRun>>;
```

`validateDraft` exists so the builder can block activation of an unsaved workflow.
`WorkflowValidationIssue` carries a `nodeId` and a `fixHint`, so clicking an error focuses
the offending node rather than scrolling the user around the canvas.

`WorkflowSimulation` includes a `disclaimer` string that the UI renders verbatim. Nothing
executes outside the browser.

---

## 5. Everything that is simulated, and how the contract says so

The following are typed as explicitly simulated so a component cannot accidentally present
them as real:

| Contract | Literal marker | UI obligation |
| --- | --- | --- |
| `MessageDelivery` | `simulated: true` | Show "nothing was sent" |
| `CallRecord` | `simulated: true` | Label the record |
| `MeetingRecord` | `simulated: true` | Label the record |
| `IntegrationConnection` | `simulated: true` | Show availability as demo/planned |
| `ConnectionWizardState.authSimulated` | `true` | Explain that no credentials are requested |
| `WebhookEndpoint.deliveryMode` | `'simulated'` | State that nothing is delivered |
| `WebhookDelivery.state` | `success_demo` / `failed_demo` | Include "demo" in the label |
| `VisitLog.checkIn.gpsUsed` | `false` | State that no location was collected |
| `InvoiceRecord.documentKind` | `'crm_reference_only'` | Not an accounting document |
| `PlatformInvoice.paymentProviderState` | `'not_connected'` | State that nothing was charged |
| `SignatureWorkflowPreview.simulated` | `true` | "Workflow preview only" |
| `AiMessage.origin` | `'demo_template_engine'` | Attribute the response |
| `CommissionStatement.calculationState` | `'demo_local_calculation'` | Local arithmetic only |
| `DocumentFile.storage` | `{ state: 'placeholder' }` | No file was uploaded |
| `ExportRequest.generatedLocally` | `true` | Generated in the browser |
| `DemoDataService.reset` | — | Full reset available at all times |
| `FeatureFlag.evaluationState` | `'simulated'` | Flags evaluated locally |
| `SystemStatusComponent.state` | `'synthetic'`, `uptimeClaim: 'not_claimed'` | No uptime guarantee |
| `PlatformOverview.dataState` | `'synthetic'` | Figures are illustrative |
| `PlanDefinition.commercialState` | `'illustrative_not_final'` | Prices are placeholders |

The pattern is deliberate: the type system carries the honesty requirement, so a developer
who forgets the label gets a type error rather than shipping a misleading screen.

---

## 6. Cross-cutting behaviours

### Idempotency

Create operations that may be retried (imports, form submissions) should accept an
idempotency key. The frontend generates `submissionId` values for form submissions, which
the API should honour.

### Pagination defaults

- Default `pageSize`: 25
- Maximum `pageSize`: 200
- Default sort: `updatedAt desc` unless the resource documents otherwise

### Partial failure in imports

`commitImport` uses `CreateInput<Lead>` batches and reports:

```ts
{ created: number; skipped: number; failed: number; leadIds: string[] }
```

with per-row errors from `validateImport`:

```ts
Array<{ row: number; field: string; message: string }>
```

A row number plus a field plus a message is the minimum needed for a useful import report.

### Soft delete

Resources that implement `Archivable` use `archivedAt` rather than hard deletion. Leads,
contacts and accounts are archivable; `includeArchived: false` is the list default. The UI
must always offer archive before delete, and delete must require confirmation.

### Tenant scoping

Every request is implicitly scoped to the caller's current organization. The client does
**not** send a tenant id as an authorization claim. Multi-tenant isolation is a server
responsibility; the frontend's organization switcher is a UI context, not a security
boundary. This is stated in the code as well, because it is exactly the kind of thing that
gets conflated.

---

## 7. Mapping from the public website

The website converts through these contract methods:

| Website action | Contract call |
| --- | --- |
| Trial signup | `OnboardingService.completeOrganizationSetup(payload)` |
| Contact sales form | `LeadsService.create({ leadSourceId: 'contact_sales', … })` |
| Demo request | `LeadsService.create({ leadSourceId: 'demo_request', … })` |
| Resource download | `LeadsService.create({ leadSourceId: 'content_download', … })` |
| Newsletter signup | `ContactsService.updateConsent([…], { channel: 'email', state: 'granted' })` |
| Public demo | No call. `DemoDataService` operates on isolated local state. |
| Pricing calculator | No call. Arithmetic is local and labelled illustrative. |

None of these are implemented yet, and every website form that gathers data must state that
submission is simulated.

---

## 8. Open questions for the backend team

1. **Identifier format.** UUID, ULID or integer? The frontend treats ids as opaque strings
   and is unblocked either way.
2. **Money representation.** The contracts use `{ amount: number; currency: string }` with
   decimals rather than minor units. Confirm, or provide `minorUnits` and an exponent and
   the frontend will adapt.
3. **Facets.** Are facet counts affordable per list request, or should they be separate
   calls with a debounce?
4. **Optimistic concurrency.** Is `updatedAt` sufficient as a version token, or is a
   monotonic revision number preferred?
5. **Workflow evaluation.** Will workflows execute server-side with the same node
   vocabulary, so the frontend can render execution history without a translation layer?
6. **Attachment uploads.** Presigned direct-to-storage uploads, or through the API? This
   determines whether the upload progress component reflects real bytes.
7. **Localization.** Locale resolution from `Accept-Language`, or does the client send an
   explicit locale? The error contract assumes the server returns localised messages.
8. **Rate limits.** What headers will be returned, so the UI can show remaining quota
   honestly rather than guessing?
9. **Entitlements.** A single endpoint returning all entitlements for the current tenant,
   so the shell can resolve navigation in one call rather than per module.
10. **Audit export.** Streaming CSV, or a generated file? This affects whether
    `SecurityService.exportAuditEvents` returns content directly.
