/**
 * Service contracts.
 *
 * Every UI feature talks to these interfaces, never to a concrete implementation.
 * Today `@crm/mock-services` satisfies them in the browser; a Laravel REST API will
 * satisfy exactly the same shapes later. That is the whole reason the boundary
 * exists, so the contracts are intentionally explicit about transport-neutral
 * concerns (pagination, filtering, optimistic concurrency, entitlements) and
 * deliberately silent about HTTP.
 */

import type {
  BulkActionOutcome,
  Id,
  ListQuery,
  Paginated,
  Result,
} from './common';
import type {
  Account,
  Contact,
  Deal,
  DealLostReason,
  DealMoveRequest,
  DuplicateCandidate,
  Lead,
  LeadConversionPreview,
  LeadConversionRequest,
  LeadSource,
  Pipeline,
  PipelineSummary,
  Stage,
} from './crm';
import type {
  Activity,
  Calendar,
  CalendarEvent,
  DailyActivityPlan,
  ForecastPeriod,
  MeetingPreparationBrief,
  Playbook,
  SalesGoal,
  Sequence,
  SequenceEnrollment,
  Task,
} from './activity';
import type { Campaign, Journey, LandingPage, Segment, SegmentPreview } from './marketing';
import type { KbArticle, SlaPolicy, SupportOverview, Ticket, TicketCategory, TicketMessage } from './support';
import type { AccountHealthScore, CustomerSuccessOverview, OnboardingPlan, Renewal, SuccessPlan } from './success';
import type { Contract, InvoiceRecord, Product, Quote, RecurringRevenueReport, RevenueOperationsOverview } from './revenue';
import type { Dashboard, DashboardWidget, ReportDefinition, ReportResult, WidgetData, ExportRequest } from './analytics';
import type { Workflow, WorkflowRun, WorkflowSimulation, WorkflowTemplate } from './automation';
import type { CustomField, CustomObject, IndustryTemplate, PageLayout, SavedView } from './customization';
import type { Conversation, MessageTemplate, SharedInbox } from './communication';
import type { Integration, IntegrationConnection } from './platform';
import type {
  AccessDeniedContext,
  AuditEvent,
  Organization,
  Role,
  SecurityPolicy,
  SessionRecord,
  Tenant,
  User,
  UsageMeter,
  Entitlement,
} from './organization';

/* ------------------------------------------------------------- write shapes */

/** Server-owned fields are omitted from create payloads. */
export type CreateInput<T, ServerOwned extends keyof T = never> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | ServerOwned
>;

export type UpdateInput<T> = Partial<CreateInput<T>> & {
  /**
   * Optimistic concurrency. The mock layer rejects stale writes so the UI's
   * conflict handling is exercised before a real API exists.
   */
  expectedUpdatedAt?: string;
};

export interface WriteOptions {
  /** Bubble a toast from the mutation layer when set. */
  quiet?: boolean;
  /** Simulated latency range in ms, used to exercise loading and optimistic states. */
  latency?: { min: number; max: number };
  /** Force a failure to demonstrate error states. */
  simulate?: 'none' | 'validation_error' | 'conflict' | 'forbidden' | 'entitlement_missing' | 'server_error' | 'offline';
}

/* ----------------------------------------------------------- base services */

/**
 * Minimal CRUD contract every collection shares. `TQuery` narrows the filter
 * surface per resource without duplicating the whole interface.
 */
export interface CrudService<T, TCreate = CreateInput<T>, TQuery = ListQuery> {
  list(query?: TQuery): Promise<Paginated<T>>;
  get(id: Id): Promise<Result<T>>;
  create(input: TCreate, options?: WriteOptions): Promise<Result<T>>;
  update(id: Id, input: UpdateInput<T>, options?: WriteOptions): Promise<Result<T>>;
  remove(id: Id, options?: WriteOptions): Promise<Result<{ id: Id }>>;
  bulkRemove(ids: Id[], options?: WriteOptions): Promise<Result<BulkActionOutcome>>;
}

export interface ArchiveableService<T> {
  archive(id: Id): Promise<Result<T>>;
  restore(id: Id): Promise<Result<T>>;
}

export interface DuplicateDetectionService<T> {
  findDuplicates(candidate: Partial<T>): Promise<Paginated<DuplicateCandidate>>;
  merge(primaryId: Id, mergeIds: Id[], resolvers: Record<string, Id>): Promise<Result<T>>;
}

/* ------------------------------------------------------------------- sales */

export interface LeadQuery extends ListQuery {
  status?: string[];
  rating?: string[];
  ownerIds?: Id[];
  sourceIds?: Id[];
  minScore?: number;
  maxScore?: number;
  territory?: string[];
  unresponded?: boolean;
}

export interface LeadsService extends CrudService<Lead, CreateInput<Lead>, LeadQuery>, ArchiveableService<Lead>, DuplicateDetectionService<Lead> {
  assign(ids: Id[], ownerId: Id, teamId?: Id): Promise<Result<BulkActionOutcome>>;
  updateStatus(ids: Id[], status: Lead['status']): Promise<Result<BulkActionOutcome>>;
  updateRating(ids: Id[], rating: Lead['rating']): Promise<Result<BulkActionOutcome>>;
  addTag(ids: Id[], tagId: Id): Promise<Result<BulkActionOutcome>>;
  /** Preview must be computed without writing so the wizard can render it before submit. */
  previewConversion(id: Id, request: LeadConversionRequest): Promise<Result<LeadConversionPreview>>;
  convert(request: LeadConversionRequest): Promise<Result<LeadConversionPreview>>;
  rescore(ids: Id[]): Promise<Result<BulkActionOutcome>>;
  enrollInSequence(ids: Id[], sequenceId: Id): Promise<Result<BulkActionOutcome>>;
  sources(): Promise<Paginated<LeadSource>>;
  /** Import wizard: validate first, then commit as a separate step. */
  validateImport(rows: Array<Record<string, string>>, mapping: Record<string, string>): Promise<Result<{ valid: number; invalid: number; errors: Array<{ row: number; field: string; message: string }>; sample: Array<Record<string, string>> }>>;
  commitImport(rows: Array<Record<string, string>>, mapping: Record<string, string>, options: { skipDuplicates: boolean; assignOwnerId?: Id; addToCampaignId?: Id }): Promise<Result<{ created: number; skipped: number; failed: number; leadIds: Id[] }>>;
}

export interface ContactQuery extends ListQuery {
  lifecycleStages?: string[];
  accountIds?: Id[];
  ownerIds?: Id[];
  tags?: Id[];
  consentChannel?: string;
  consentState?: string;
  hasOpenDeal?: boolean;
  hasOpenTicket?: boolean;
}

export interface ContactsService extends CrudService<Contact, CreateInput<Contact>, ContactQuery>, ArchiveableService<Contact>, DuplicateDetectionService<Contact> {
  assign(ids: Id[], ownerId: Id): Promise<Result<BulkActionOutcome>>;
  updateLifecycle(ids: Id[], stage: Contact['lifecycleStage']): Promise<Result<BulkActionOutcome>>;
  updateConsent(ids: Id[], record: { channel: string; state: string; jurisdiction?: string }): Promise<Result<BulkActionOutcome>>;
  addToCampaign(ids: Id[], campaignId: Id): Promise<Result<BulkActionOutcome>>;
  addToSegment(ids: Id[], segmentId: Id): Promise<Result<BulkActionOutcome>>;
  /** Used by the Customer 360 page and the AI summary panel. */
  timeline(id: Id, query?: ListQuery): Promise<Paginated<Activity>>;
  relatedDeals(id: Id): Promise<Paginated<Deal>>;
  relatedTickets(id: Id): Promise<Paginated<Ticket>>;
  export(ids: Id[], format: 'csv' | 'xlsx'): Promise<Result<{ exportId: Id; rowCount: number; generatedLocally: boolean }>>;
}

export interface AccountQuery extends ListQuery {
  types?: string[];
  industries?: Id[];
  health?: string[];
  ownerIds?: Id[];
  parentId?: Id;
  tier?: string[];
  territories?: string[];
  minRevenue?: number;
  renewalWithinDays?: number;
}

export interface AccountsService extends CrudService<Account, CreateInput<Account>, AccountQuery>, ArchiveableService<Account> {
  hierarchy(rootId?: Id): Promise<Result<Array<{ id: Id; name: string; parentId?: Id; depth: number; health: string }>>>;
  moveAccount(id: Id, newParentId: Id | null): Promise<Result<Account>>;
  revenueSnapshot(id: Id): Promise<Result<import('./crm').AccountRevenueSnapshot>>;
  contacts(id: Id, query?: ListQuery): Promise<Paginated<Contact>>;
  deals(id: Id, query?: ListQuery): Promise<Paginated<Deal>>;
  tickets(id: Id, query?: ListQuery): Promise<Paginated<Ticket>>;
  healthScore(id: Id): Promise<Result<AccountHealthScore>>;
}

export interface DealsService extends CrudService<Deal, CreateInput<Deal>, ListQuery> {
  /** The single write path for stage changes; the kanban and the detail form both call it. */
  move(request: DealMoveRequest): Promise<Result<{ deal: Deal; summary: PipelineSummary }>>;
  bulkMove(ids: Id[], toStageId: Id, options?: { lostReasonId?: Id; note?: string }): Promise<Result<{ outcome: BulkActionOutcome; summary: PipelineSummary }>>;
  assign(ids: Id[], ownerId: Id): Promise<Result<BulkActionOutcome>>;
  updateForecastCategory(ids: Id[], category: Deal['forecastCategory']): Promise<Result<BulkActionOutcome>>;
  addProduct(dealId: Id, line: Omit<import('./crm').DealProductLine, 'id'>): Promise<Result<Deal>>;
  updateProductLine(dealId: Id, lineId: Id, patch: Partial<import('./crm').DealProductLine>): Promise<Result<Deal>>;
  removeProductLine(dealId: Id, lineId: Id): Promise<Result<Deal>>;
  addTeamMember(dealId: Id, userId: Id, role: Deal['teamMembers'][number]['role']): Promise<Result<Deal>>;
  addCompetitor(dealId: Id, competitorId: Id): Promise<Result<Deal>>;
  lostReasons(): Promise<Paginated<DealLostReason>>;
  /** Server-computed rollups so the UI never re-derives pipeline totals in two places. */
  pipelineSummary(pipelineId: Id, query?: ListQuery): Promise<Result<PipelineSummary>>;
  forecast(pipelineId?: Id, period?: string): Promise<Result<ForecastPeriod>>;
}

export interface PipelinesService {
  list(): Promise<Paginated<Pipeline>>;
  get(id: Id): Promise<Result<Pipeline>>;
  create(input: CreateInput<Pipeline>): Promise<Result<Pipeline>>;
  update(id: Id, input: UpdateInput<Pipeline>): Promise<Result<Pipeline>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  createStage(pipelineId: Id, input: CreateInput<Stage>): Promise<Result<Stage>>;
  updateStage(pipelineId: Id, stageId: Id, input: UpdateInput<Stage>): Promise<Result<Stage>>;
  reorderStages(pipelineId: Id, orderedIds: Id[]): Promise<Result<Stage[]>>;
  removeStage(pipelineId: Id, stageId: Id, moveDealsTo: Id): Promise<Result<{ moved: number }>>;
  setDefault(pipelineId: Id): Promise<Result<Pipeline>>;
}

/* -------------------------------------------------------------- activities */

export interface ActivitiesService extends CrudService<Activity, CreateInput<Activity>, ListQuery> {
  forRecord(type: string, id: Id, query?: ListQuery): Promise<Paginated<Activity>>;
  complete(ids: Id[], outcome?: Activity['outcome']): Promise<Result<BulkActionOutcome>>;
  reopen(ids: Id[]): Promise<Result<BulkActionOutcome>>;
  snooze(ids: Id[], until: string): Promise<Result<BulkActionOutcome>>;
  /** Powers My Work; computed server-side so the planner is cheap to render. */
  dailyPlan(userId: Id, date: string): Promise<Result<DailyActivityPlan>>;
  overdueForUser(userId: Id): Promise<Paginated<Activity>>;
}

export interface CalendarService {
  events(query: ListQuery & { from?: string; to?: string; calendarIds?: Id[] }): Promise<Paginated<CalendarEvent>>;
  calendars(): Promise<Paginated<Calendar>>;
  create(event: CreateInput<CalendarEvent>): Promise<Result<CalendarEvent>>;
  update(id: Id, input: UpdateInput<CalendarEvent>): Promise<Result<CalendarEvent>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  reschedule(id: Id, startAt: string, endAt: string): Promise<Result<CalendarEvent>>;
  /** Deterministic slot suggestions so the mock is testable. */
  suggestSlots(attendeeIds: Id[], durationMinutes: number, within: { from: string; to: string }): Promise<Result<CalendarEvent['suggestedSlots']>>;
  preparationBrief(eventId: Id): Promise<Result<MeetingPreparationBrief>>;
}

export interface TasksService extends CrudService<Task, CreateInput<Task>, ListQuery> {
  complete(id: Id): Promise<Result<Task>>;
  toggleChecklistItem(taskId: Id, itemId: Id): Promise<Result<Task>>;
  reassign(ids: Id[], ownerId: Id): Promise<Result<BulkActionOutcome>>;
  createFromTemplate(templateId: Id, target: { type: string; id: Id }): Promise<Result<Task[]>>;
}

export interface SequencesService extends CrudService<Sequence, CreateInput<Sequence>, ListQuery> {
  enroll(sequenceId: Id, records: Array<{ type: 'lead' | 'contact'; id: Id }>): Promise<Result<BulkActionOutcome>>;
  pauseEnrollments(ids: Id[]): Promise<Result<BulkActionOutcome>>;
  resumeEnrollments(ids: Id[]): Promise<Result<BulkActionOutcome>>;
  removeEnrollment(id: Id): Promise<Result<{ id: Id }>>;
  enrollments(sequenceId: Id, query?: ListQuery): Promise<Paginated<SequenceEnrollment>>;
}

export interface PlaybooksService extends CrudService<Playbook, CreateInput<Playbook>, ListQuery> {
  apply(playbookId: Id, target: { type: string; id: Id }): Promise<Result<{ tasksCreated: number }>>;
}

export interface GoalsService extends CrudService<SalesGoal, CreateInput<SalesGoal>, ListQuery> {
  forUser(userId: Id, period: string): Promise<Paginated<SalesGoal>>;
}

/* ----------------------------------------------------------- communications */

export interface ConversationsService {
  list(query: ListQuery & { inboxId?: Id; statuses?: string[]; channels?: string[]; assigneeIds?: Id[]; unreadOnly?: boolean; starredOnly?: boolean }): Promise<Paginated<Conversation>>;
  get(id: Id): Promise<Result<Conversation>>;
  messages(conversationId: Id, query?: ListQuery): Promise<Paginated<import('./communication').MessageBase>>;
  /** Outbound sends are simulated; the returned delivery state says so. */
  reply(conversationId: Id, body: string, options?: { templateId?: Id; isInternalNote?: boolean; attachments?: string[] }): Promise<Result<import('./communication').MessageBase>>;
  updateStatus(ids: Id[], status: Conversation['status']): Promise<Result<BulkActionOutcome>>;
  assign(ids: Id[], assigneeId: Id | null): Promise<Result<BulkActionOutcome>>;
  snooze(ids: Id[], until: string): Promise<Result<BulkActionOutcome>>;
  star(id: Id, starred: boolean): Promise<Result<Conversation>>;
  addTag(ids: Id[], tagId: Id): Promise<Result<BulkActionOutcome>>;
  inboxes(): Promise<Paginated<SharedInbox>>;
  templates(query?: ListQuery): Promise<Paginated<MessageTemplate>>;
  /** Deterministic summary used by the conversation side panel. */
  summarise(id: Id): Promise<Result<{ summary: string; origin: 'demo_template_engine'; suggestedReplies: string[] }>>;
}

/* -------------------------------------------------------------- marketing */

export interface CampaignsService extends CrudService<Campaign, CreateInput<Campaign>, ListQuery> {
  launch(id: Id): Promise<Result<Campaign>>;
  pause(id: Id): Promise<Result<Campaign>>;
  resume(id: Id): Promise<Result<Campaign>>;
  duplicate(id: Id, name: string): Promise<Result<Campaign>>;
  /** Statistics are derived from the shared synthetic dataset. */
  metrics(id: Id): Promise<Result<Campaign['metrics']>>;
  calendar(from: string, to: string): Promise<Paginated<import('./marketing').CampaignCalendarEntry>>;
}

export interface SegmentsService extends CrudService<Segment, CreateInput<Segment>, ListQuery> {
  preview(definition: Segment['definition'], entityType: Segment['entityType']): Promise<Result<SegmentPreview>>;
  refresh(id: Id): Promise<Result<Segment>>;
  members(id: Id, query?: ListQuery): Promise<Paginated<{ id: Id; label: string; subtitle?: string; contactId?: Id }>>;
}

export interface JourneysService extends CrudService<Journey, CreateInput<Journey>, ListQuery> {
  activate(id: Id): Promise<Result<Journey>>;
  pause(id: Id): Promise<Result<Journey>>;
  duplicate(id: Id, name: string): Promise<Result<Journey>>;
  /** Validates reachability, orphan nodes and missing configuration. */
  validate(id: Id): Promise<Result<{ valid: boolean; issues: Array<{ nodeId?: Id; severity: 'error' | 'warning'; message: string }> }>>;
  /** Deterministic enrolment forecast for the selected audience. */
  simulate(id: Id, entrySegmentId: Id): Promise<Result<{ entered: number; byNode: Array<{ nodeId: Id; reached: number; converted: number }>; durationDays: number }>>;
}

export interface EmailTemplatesService extends CrudService<import('./marketing').EmailTemplate, CreateInput<import('./marketing').EmailTemplate>, ListQuery> {
  renderPreview(id: Id, mergeData?: Record<string, string>): Promise<Result<{ html: string; plainText: string; warnings: string[] }>>;
  duplicate(id: Id, name: string): Promise<Result<import('./marketing').EmailTemplate>>;
}

export interface FormsService extends CrudService<import('./marketing').CaptureForm, CreateInput<import('./marketing').CaptureForm>, ListQuery> {
  /** Submissions are recorded locally and never transmitted. */
  submit(formId: Id, values: Record<string, unknown>): Promise<Result<{ submissionId: Id; actionTaken: string; simulated: true }>>;
}

export interface LandingPagesService extends CrudService<LandingPage, CreateInput<LandingPage>, ListQuery> {
  publish(id: Id): Promise<Result<{ page: LandingPage; hostingState: 'demo_not_hosted'; note: string }>>;
}

export type LeadSourcesService = CrudService<LeadSource, CreateInput<LeadSource>, ListQuery>;

/* ----------------------------------------------------------------- support */

export interface TicketsService extends CrudService<Ticket, CreateInput<Ticket>, ListQuery> {
  assign(ids: Id[], assigneeId: Id | null, teamId?: Id): Promise<Result<BulkActionOutcome>>;
  updateStatus(ids: Id[], status: Ticket['status']): Promise<Result<BulkActionOutcome>>;
  updatePriority(ids: Id[], priority: Ticket['priority']): Promise<Result<BulkActionOutcome>>;
  escalate(ids: Id[], reason: string): Promise<Result<BulkActionOutcome>>;
  merge(primaryId: Id, mergeIds: Id[]): Promise<Result<Ticket>>;
  messages(ticketId: Id): Promise<Paginated<TicketMessage>>;
  reply(ticketId: Id, body: string, options?: { isInternalNote?: boolean; templateId?: Id; timeSpentMinutes?: number }): Promise<Result<TicketMessage>>;
  resolve(id: Id, summary: string, rootCause?: string): Promise<Result<Ticket>>;
  reopen(id: Id, reason: string): Promise<Result<Ticket>>;
  categories(): Promise<Paginated<TicketCategory>>;
  slaPolicies(): Promise<Paginated<SlaPolicy>>;
  overview(query?: ListQuery): Promise<Result<SupportOverview>>;
}

export interface KnowledgeBaseService extends CrudService<KbArticle, CreateInput<KbArticle>, ListQuery> {
  publish(id: Id): Promise<Result<KbArticle>>;
  submitForReview(id: Id, reviewerId: Id): Promise<Result<KbArticle>>;
  vote(id: Id, helpful: boolean): Promise<Result<KbArticle>>;
  /** Used by the support workspace to suggest articles while typing a reply. */
  suggestForTicket(ticketId: Id, queryText: string): Promise<Paginated<KbArticle>>;
}

/* --------------------------------------------------------- customer success */

export interface CustomerSuccessService {
  overview(query?: ListQuery): Promise<Result<CustomerSuccessOverview>>;
  healthScores(query: ListQuery): Promise<Paginated<AccountHealthScore>>;
  healthScore(accountId: Id): Promise<Result<AccountHealthScore>>;
  recomputeHealth(accountIds: Id[]): Promise<Result<BulkActionOutcome>>;
  portfolios(query?: ListQuery): Promise<Paginated<import('./success').SuccessPortfolio>>;
  successPlans(query?: ListQuery): Promise<Paginated<SuccessPlan>>;
  updateObjective(planId: Id, objectiveId: Id, patch: Partial<import('./success').SuccessObjective>): Promise<Result<SuccessPlan>>;
  onboardingPlans(query?: ListQuery): Promise<Paginated<OnboardingPlan>>;
  updateOnboardingTask(planId: Id, taskId: Id, patch: Partial<import('./success').OnboardingTask>): Promise<Result<OnboardingPlan>>;
  renewals(query?: ListQuery): Promise<Paginated<Renewal>>;
  updateRenewal(id: Id, patch: UpdateInput<Renewal>): Promise<Result<Renewal>>;
  churnRisk(query?: ListQuery): Promise<Paginated<import('./success').ChurnRiskRow>>;
  businessReviews(query?: ListQuery): Promise<Paginated<import('./success').BusinessReview>>;
  voiceOfCustomer(): Promise<Result<import('./success').VoiceOfCustomerOverview>>;
}

/* -------------------------------------------------------- revenue operations */

export interface ProductsService extends CrudService<Product, CreateInput<Product>, ListQuery> {
  categories(): Promise<Paginated<import('./revenue').ProductCategory>>;
  priceBooks(): Promise<Paginated<import('./revenue').PriceBook>>;
  updatePriceBookEntry(priceBookId: Id, entryId: Id, patch: Partial<import('./revenue').PriceBookEntry>): Promise<Result<import('./revenue').PriceBook>>;
  revenueSummary(query?: ListQuery): Promise<Result<RevenueOperationsOverview>>;
}

export interface QuotesService extends CrudService<Quote, CreateInput<Quote>, ListQuery> {
  addLineItem(quoteId: Id, item: Omit<import('./revenue').QuoteLineItem, 'id'>): Promise<Result<Quote>>;
  updateLineItem(quoteId: Id, itemId: Id, patch: Partial<import('./revenue').QuoteLineItem>): Promise<Result<Quote>>;
  removeLineItem(quoteId: Id, itemId: Id): Promise<Result<Quote>>;
  applyOrderDiscount(quoteId: Id, percent: number, reason: string): Promise<Result<Quote>>;
  /** Pricing is computed locally; the totals object is returned recomputed. */
  recalculate(quoteId: Id): Promise<Result<Quote>>;
  submitForApproval(quoteId: Id): Promise<Result<Quote>>;
  decideApproval(quoteId: Id, stepId: Id, decision: 'approved' | 'rejected', comment?: string): Promise<Result<Quote>>;
  revise(quoteId: Id): Promise<Result<Quote>>;
  markSent(quoteId: Id): Promise<Result<Quote>>;
  accept(quoteId: Id): Promise<Result<Quote>>;
  decline(quoteId: Id, reason: string): Promise<Result<Quote>>;
  convertToOrder(quoteId: Id): Promise<Result<{ quote: Quote; order: import('./revenue').Order }>>;
  convertToContract(quoteId: Id, termMonths: number): Promise<Result<{ quote: Quote; contract: Contract }>>;
}

export interface OrdersService extends CrudService<import('./revenue').Order, CreateInput<import('./revenue').Order>, ListQuery> {
  activate(id: Id): Promise<Result<import('./revenue').Order>>;
  cancel(id: Id, reason: string): Promise<Result<import('./revenue').Order>>;
  recordPayment(id: Id, amount: number, method: string): Promise<Result<import('./revenue').Order>>;
}

export interface ContractsService extends CrudService<Contract, CreateInput<Contract>, ListQuery> {
  renew(id: Id, patch: { termMonths: number; startDate: string; value: number }): Promise<Result<Contract>>;
  terminate(id: Id, reason: string): Promise<Result<Contract>>;
  amendment(id: Id, patch: UpdateInput<Contract>): Promise<Result<Contract>>;
  /** Returns contracts approaching their notice window so renewal tasks can be generated. */
  expiring(withinDays: number): Promise<Paginated<Contract>>;
}

export interface InvoicesService extends CrudService<InvoiceRecord, CreateInput<InvoiceRecord>, ListQuery> {
  markPaid(id: Id, paidDate: string): Promise<Result<InvoiceRecord>>;
  void(id: Id, reason: string): Promise<Result<InvoiceRecord>>;
  recordPayment(id: Id, amount: number): Promise<Result<InvoiceRecord>>;
}

export interface SubscriptionRevenueService {
  list(query?: ListQuery): Promise<Paginated<import('./revenue').RevenueSubscription>>;
  update(id: Id, patch: UpdateInput<import('./revenue').RevenueSubscription>): Promise<Result<import('./revenue').RevenueSubscription>>;
  report(period: string): Promise<Result<RecurringRevenueReport>>;
  commissionStatements(query?: ListQuery): Promise<Paginated<import('./revenue').CommissionStatement>>;
}

/* --------------------------------------------------------------- analytics */

export interface DashboardsService {
  list(query?: ListQuery): Promise<Paginated<Dashboard>>;
  get(id: Id): Promise<Result<Dashboard>>;
  create(input: CreateInput<Dashboard>): Promise<Result<Dashboard>>;
  update(id: Id, input: UpdateInput<Dashboard>): Promise<Result<Dashboard>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  duplicate(id: Id, name: string): Promise<Result<Dashboard>>;
  setDefault(id: Id): Promise<Result<Dashboard>>;
  /** Layout updates are debounced by the UI and persisted as one call. */
  saveLayout(id: Id, widgets: Array<Pick<DashboardWidget, 'id' | 'position'>>): Promise<Result<Dashboard>>;
  addWidget(id: Id, widget: CreateInput<DashboardWidget>): Promise<Result<Dashboard>>;
  updateWidget(id: Id, widgetId: Id, patch: UpdateInput<DashboardWidget>): Promise<Result<Dashboard>>;
  removeWidget(id: Id, widgetId: Id): Promise<Result<Dashboard>>;
  /** One resolver for every widget kind keeps chart data consistent app-wide. */
  widgetData(id: Id, widgetId: Id): Promise<Result<WidgetData>>;
  widgetDataBatch(id: Id): Promise<Result<WidgetData[]>>;
}

export interface ReportsService {
  list(query?: ListQuery): Promise<Paginated<ReportDefinition>>;
  get(id: Id): Promise<Result<ReportDefinition>>;
  create(input: CreateInput<ReportDefinition>): Promise<Result<ReportDefinition>>;
  update(id: Id, input: UpdateInput<ReportDefinition>): Promise<Result<ReportDefinition>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  run(id: Id, overrides?: Partial<import('./analytics').ReportConfig>): Promise<Result<ReportResult>>;
  /** Unsaved definitions can be run so the builder shows a live preview. */
  previewDefinition(config: import('./analytics').ReportConfig, columnSet: import('./analytics').ReportColumn[]): Promise<Result<ReportResult>>;
  schedule(id: Id, schedule: Omit<import('./analytics').ReportSchedule, 'id'>): Promise<Result<ReportDefinition>>;
  unschedule(id: Id): Promise<Result<ReportDefinition>>;
  /** Natural-language report builder: deterministic, labelled as generated. */
  interpretPrompt(prompt: string, source: string): Promise<Result<{ config: import('./analytics').ReportConfig; columnSet: import('./analytics').ReportColumn[]; explanation: string; origin: 'demo_template_engine'; confidence: 'high' | 'medium' | 'low' }>>;
}

export interface ExportsService {
  request(input: Omit<ExportRequest, 'id' | 'requestedAt' | 'state' | 'generatedLocally'>): Promise<Result<ExportRequest>>;
  list(query?: ListQuery): Promise<Paginated<ExportRequest>>;
  /** Generated in-browser for the demonstration; nothing is emailed. */
  generate(id: Id): Promise<Result<{ id: Id; filename: string; content: string; mimeType: string }>>;
}

export interface AnalyticsService {
  overview(query?: ListQuery): Promise<Result<import('./analytics').AnalyticsOverview>>;
  teamPerformance(query?: ListQuery): Promise<Paginated<import('./analytics').TeamPerformanceRow>>;
  forecast(query?: ListQuery): Promise<Result<ForecastPeriod>>;
  forecastAccuracy(): Promise<Paginated<import('./analytics').ForecastAccuracyRow>>;
  /** One entry point for the executive, sales, marketing, service and success dashboards. */
  dashboardForAudience(audience: Dashboard['audience'], userId: Id): Promise<Result<Dashboard>>;
}

/* -------------------------------------------------------------- automation */

export interface WorkflowsService extends CrudService<Workflow, CreateInput<Workflow>, ListQuery> {
  activate(id: Id): Promise<Result<Workflow>>;
  pause(id: Id): Promise<Result<Workflow>>;
  validate(id: Id): Promise<Result<Workflow['validation']>>;
  /** Validation of an unsaved definition, so the builder blocks activation early. */
  validateDraft(workflow: Pick<Workflow, 'target' | 'triggers' | 'nodes' | 'edges' | 'settings'>): Promise<Result<Workflow['validation']>>;
  simulate(id: Id, sampleRecordId?: Id): Promise<Result<WorkflowSimulation>>;
  runs(query: ListQuery & { workflowId?: Id; state?: string }): Promise<Paginated<WorkflowRun>>;
  retryRun(runId: Id): Promise<Result<WorkflowRun>>;
  templates(): Promise<Paginated<WorkflowTemplate>>;
  installTemplate(templateId: Id, name: string): Promise<Result<Workflow>>;
  duplicate(id: Id, name: string): Promise<Result<Workflow>>;
  overview(): Promise<Result<import('./automation').AutomationOverview>>;
}

/* ----------------------------------------------------------- customization */

export interface CustomObjectsService {
  list(query?: ListQuery): Promise<Paginated<CustomObject>>;
  get(idOrApiName: string): Promise<Result<CustomObject>>;
  create(input: CreateInput<CustomObject>): Promise<Result<CustomObject>>;
  update(id: Id, input: UpdateInput<CustomObject>): Promise<Result<CustomObject>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  toggleFeature(id: Id, feature: keyof CustomObject['features'], enabled: boolean): Promise<Result<CustomObject>>;
  fields(objectApiName: string, query?: ListQuery): Promise<Paginated<CustomField>>;
  createField(objectApiName: string, input: CreateInput<CustomField>): Promise<Result<CustomField>>;
  updateField(fieldId: Id, input: UpdateInput<CustomField>): Promise<Result<CustomField>>;
  removeField(fieldId: Id): Promise<Result<{ id: Id }>>;
  /** Used by the field editor to render a live sample value. */
  evaluateFormula(fieldId: Id, expression: string, sampleRecordId?: Id): Promise<Result<import('./customization').FormulaEditorState>>;
  usageWarnings(objectApiName?: string): Promise<Paginated<import('./customization').FieldUsageWarning>>;
  relationships(objectApiName?: string): Promise<Paginated<import('./customization').ObjectRelationship>>;
}

export interface LayoutsService {
  list(objectApiName?: string): Promise<Paginated<PageLayout>>;
  get(id: Id): Promise<Result<PageLayout>>;
  create(input: CreateInput<PageLayout>): Promise<Result<PageLayout>>;
  update(id: Id, input: UpdateInput<PageLayout>): Promise<Result<PageLayout>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  assign(id: Id, assignment: PageLayout['assignment']): Promise<Result<PageLayout>>;
  /** Renders the layout against a synthetic record so previews are always live. */
  preview(id: Id, options?: { recordId?: Id; roleId?: Id; device?: 'desktop' | 'tablet' | 'mobile' }): Promise<Result<import('./customization').LayoutPreviewModel>>;
}

export interface SavedViewsService {
  list(objectApiName?: string): Promise<Paginated<SavedView>>;
  get(id: Id): Promise<Result<SavedView>>;
  create(input: CreateInput<SavedView>): Promise<Result<SavedView>>;
  update(id: Id, input: UpdateInput<SavedView>): Promise<Result<SavedView>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  setDefault(id: Id): Promise<Result<SavedView>>;
  toggleFavorite(id: Id): Promise<Result<SavedView>>;
}

export interface IndustryTemplatesService {
  list(query?: ListQuery): Promise<Paginated<IndustryTemplate>>;
  get(id: Id): Promise<Result<IndustryTemplate>>;
  /** Installation applies the template to the mock organization state. */
  install(id: Id, options: { applySampleData: boolean; overwriteExisting: boolean }): Promise<Result<{ templateId: Id; applied: { fields: number; objects: number; pipelines: number; workflows: number; dashboards: number } }>>;
  previewChanges(id: Id): Promise<Result<{ additions: Array<{ kind: string; label: string; count: number }>; conflicts: Array<{ kind: string; label: string; existingLabel: string }> }>>;
  uninstall(id: Id): Promise<Result<{ templateId: Id; removed: number; retained: number }>>;
}

export interface NavigationService {
  get(): Promise<Result<import('./customization').CustomNavigationPreview>>;
  update(items: Array<{ key: string; visible: boolean; order: number; section: string; label?: string }>): Promise<Result<import('./customization').CustomNavigationPreview>>;
  reset(): Promise<Result<import('./customization').CustomNavigationPreview>>;
}

/* --------------------------------------------------------------- documents */

export interface DocumentsService {
  folders(query?: ListQuery): Promise<Paginated<import('./collaboration').DocumentFolder>>;
  list(query: ListQuery & { folderId?: Id; associations?: string }): Promise<Paginated<import('./collaboration').DocumentFile>>;
  get(id: Id): Promise<Result<import('./collaboration').DocumentFile>>;
  /** Metadata-only creation: no bytes are stored. */
  upload(files: Array<{ name: string; sizeBytes: number; mimeType: string }>, folderId: Id, options?: WriteOptions): Promise<Result<import('./collaboration').FileUploadTask[]>>;
  update(id: Id, input: UpdateInput<import('./collaboration').DocumentFile>): Promise<Result<import('./collaboration').DocumentFile>>;
  remove(id: Id): Promise<Result<{ id: Id }>>;
  versions(id: Id): Promise<Paginated<import('./collaboration').DocumentVersion>>;
  restoreVersion(id: Id, versionId: Id): Promise<Result<import('./collaboration').DocumentFile>>;
  share(id: Id, options: { visibility: string; roleIds?: Id[] }): Promise<Result<import('./collaboration').DocumentFile>>;
  signatureWorkflow(id: Id): Promise<Result<import('./collaboration').SignatureWorkflowPreview>>;
  templates(query?: ListQuery): Promise<Paginated<import('./collaboration').DocumentTemplate>>;
}

export interface CollaborationService {
  feed(query: ListQuery & { scope?: string; teamId?: Id; kinds?: string[] }): Promise<Paginated<import('./collaboration').FeedItem>>;
  feedForRecord(type: string, id: Id, query?: ListQuery): Promise<Paginated<import('./collaboration').FeedItem>>;
  comments(parentType: string, parentId: Id): Promise<Paginated<import('./collaboration').Comment>>;
  addComment(parentType: string, parentId: Id, body: string, options?: { mentions?: Id[]; isInternal?: boolean }): Promise<Result<import('./collaboration').Comment>>;
  resolveComment(id: Id): Promise<Result<import('./collaboration').Comment>>;
  react(targetType: string, targetId: Id, emoji: string): Promise<Result<{ added: boolean }>>;
  notifications(query?: ListQuery & { unreadOnly?: boolean }): Promise<Paginated<import('./collaboration').Notification>>;
  markRead(ids: Id[]): Promise<Result<BulkActionOutcome>>;
  markAllRead(): Promise<Result<BulkActionOutcome>>;
  mentions(): Promise<Paginated<import('./collaboration').MentionSummary>>;
  teamSpaces(): Promise<Paginated<import('./collaboration').TeamSpace>>;
  announcements(): Promise<Paginated<import('./collaboration').Announcement>>;
  acknowledgeAnnouncement(id: Id): Promise<Result<import('./collaboration').Announcement>>;
}

/* -------------------------------------------------------- projects/field/PRM */

export interface ProjectsService extends CrudService<import('./delivery').Project, CreateInput<import('./delivery').Project>, ListQuery> {
  overview(): Promise<Result<import('./delivery').ProjectOverview>>;
  acceptHandoff(id: Id, checklistPatch?: Record<string, boolean>): Promise<Result<import('./delivery').Project>>;
  phases(projectId: Id): Promise<Paginated<import('./delivery').ProjectPhase>>;
  tasks(projectId: Id, query?: ListQuery): Promise<Paginated<import('./delivery').ProjectTask>>;
  createTask(projectId: Id, input: CreateInput<import('./delivery').ProjectTask>): Promise<Result<import('./delivery').ProjectTask>>;
  updateTask(taskId: Id, patch: UpdateInput<import('./delivery').ProjectTask>): Promise<Result<import('./delivery').ProjectTask>>;
  moveTask(taskId: Id, status: import('./delivery').ProjectTask['status']): Promise<Result<import('./delivery').ProjectTask>>;
  milestones(projectId: Id): Promise<Paginated<import('./delivery').ProjectMilestone>>;
  completeMilestone(projectId: Id, milestoneId: Id): Promise<Result<import('./delivery').ProjectMilestone>>;
  deliverables(projectId: Id): Promise<Paginated<import('./delivery').ProjectDeliverable>>;
  risks(projectId: Id): Promise<Paginated<import('./delivery').ProjectRisk>>;
  timeline(projectId: Id): Promise<Result<import('./delivery').ProjectTimeline>>;
}

export interface FieldSalesService {
  overview(query?: ListQuery): Promise<Result<import('./delivery').FieldSalesOverview>>;
  territories(query?: ListQuery): Promise<Paginated<import('./delivery').Territory>>;
  updateTerritory(id: Id, patch: UpdateInput<import('./delivery').Territory>): Promise<Result<import('./delivery').Territory>>;
  assignAccounts(territoryId: Id, accountIds: Id[]): Promise<Result<import('./delivery').Territory>>;
  visitPlans(query?: ListQuery): Promise<Paginated<import('./delivery').VisitPlan>>;
  createVisitPlan(input: CreateInput<import('./delivery').VisitPlan>): Promise<Result<import('./delivery').VisitPlan>>;
  reorderStops(planId: Id, orderedStopIds: Id[]): Promise<Result<import('./delivery').VisitPlan>>;
  /** Check-in records a label, never device coordinates. */
  checkIn(stopId: Id, payload: { locationLabel: string; locationSource: 'manual_selection' | 'typed_address' }): Promise<Result<import('./delivery').VisitLog>>;
  completeVisit(logId: Id, payload: Partial<import('./delivery').VisitLog>): Promise<Result<import('./delivery').VisitLog>>;
  visitLogs(query?: ListQuery): Promise<Paginated<import('./delivery').VisitLog>>;
}

export interface PartnersService {
  overview(query?: ListQuery): Promise<Result<import('./delivery').PartnerOverview>>;
  list(query?: ListQuery): Promise<Paginated<import('./delivery').Partner>>;
  get(id: Id): Promise<Result<import('./delivery').Partner>>;
  update(id: Id, patch: UpdateInput<import('./delivery').Partner>): Promise<Result<import('./delivery').Partner>>;
  completeOnboardingStep(partnerId: Id, stepId: Id): Promise<Result<import('./delivery').Partner>>;
  registrations(query?: ListQuery): Promise<Paginated<import('./delivery').DealRegistration>>;
  submitRegistration(input: CreateInput<import('./delivery').DealRegistration>): Promise<Result<import('./delivery').DealRegistration>>;
  decideRegistration(id: Id, decision: 'approved' | 'rejected', notes?: string): Promise<Result<import('./delivery').DealRegistration>>;
  convertRegistration(id: Id): Promise<Result<{ registration: import('./delivery').DealRegistration; deal: Deal }>>;
  referrals(query?: ListQuery): Promise<Paginated<import('./delivery').Referral>>;
  updateReferral(id: Id, patch: UpdateInput<import('./delivery').Referral>): Promise<Result<import('./delivery').Referral>>;
  commissions(query?: ListQuery): Promise<Paginated<import('./delivery').PartnerCommission>>;
}

/* ------------------------------------------------------------- integrations */

export interface IntegrationsService {
  catalog(query: ListQuery & { category?: string; availability?: string; featuredOnly?: boolean }): Promise<Paginated<Integration>>;
  get(slug: string): Promise<Result<Integration>>;
  connections(query?: ListQuery): Promise<Paginated<IntegrationConnection>>;
  connection(id: Id): Promise<Result<IntegrationConnection>>;
  /** Starting the wizard never authenticates; it returns a simulated session. */
  startConnection(integrationId: Id): Promise<Result<{ wizardId: Id; state: import('./platform').ConnectionWizardState }>>;
  advanceWizard(wizardId: Id, patch: Partial<import('./platform').ConnectionWizardState>): Promise<Result<import('./platform').ConnectionWizardState>>;
  finishWizard(wizardId: Id): Promise<Result<IntegrationConnection>>;
  updateConnection(id: Id, patch: UpdateInput<IntegrationConnection>): Promise<Result<IntegrationConnection>>;
  disconnect(id: Id, reason?: string): Promise<Result<{ id: Id; retainedRecords: number }>>;
  runSync(id: Id): Promise<Result<IntegrationConnection>>;
  retryFailed(id: Id): Promise<Result<BulkActionOutcome>>;
  overview(): Promise<Result<import('./platform').IntegrationOverview>>;
}

export interface DeveloperPlatformService {
  overview(): Promise<Result<import('./platform').DeveloperOverview>>;
  apiKeys(query?: ListQuery): Promise<Paginated<import('./organization').ApiKeyRecord>>;
  /** Returns a masked key plus a one-time display placeholder that is never valid. */
  createApiKey(input: { name: string; scopes: string[]; expiresAt?: string }): Promise<Result<{ record: import('./organization').ApiKeyRecord; oneTimeDisplay: string; note: string }>>;
  revokeApiKey(id: Id): Promise<Result<import('./organization').ApiKeyRecord>>;
  webhooks(query?: ListQuery): Promise<Paginated<import('./platform').WebhookEndpoint>>;
  createWebhook(input: CreateInput<import('./platform').WebhookEndpoint>): Promise<Result<import('./platform').WebhookEndpoint>>;
  updateWebhook(id: Id, patch: UpdateInput<import('./platform').WebhookEndpoint>): Promise<Result<import('./platform').WebhookEndpoint>>;
  removeWebhook(id: Id): Promise<Result<{ id: Id }>>;
  testWebhook(id: Id, eventKey: string): Promise<Result<import('./platform').WebhookDelivery>>;
  deliveries(query: ListQuery & { endpointId?: Id; state?: string }): Promise<Paginated<import('./platform').WebhookDelivery>>;
  redeliver(deliveryId: Id): Promise<Result<import('./platform').WebhookDelivery>>;
  eventCatalog(): Promise<Paginated<import('./platform').WebhookEventDefinition>>;
  requestLogs(query?: ListQuery): Promise<Paginated<import('./platform').ApiRequestLog>>;
  apps(query?: ListQuery): Promise<Paginated<import('./platform').DeveloperApp>>;
  installApp(appId: Id, scopes: string[]): Promise<Result<{ app: import('./platform').DeveloperApp; installed: true; simulated: true }>>;
  uninstallApp(appId: Id): Promise<Result<{ app: import('./platform').DeveloperApp; revokedTokens: number }>>;
  documentation(group?: string): Promise<Paginated<import('./platform').ApiDocEndpoint>>;
}

/* --------------------------------------------------------------------- AI */

export interface AiAssistantService {
  conversations(query?: ListQuery): Promise<Paginated<import('./platform').AiConversation>>;
  conversation(id: Id): Promise<Result<import('./platform').AiConversation>>;
  createConversation(input: { entryPoint: string; contextualRecord?: { type: string; id: Id; label: string } }): Promise<Result<import('./platform').AiConversation>>;
  /** Deterministic reply. The response is always labelled `demo_template_engine`. */
  send(conversationId: Id, message: string, capability?: string): Promise<Result<import('./platform').AiMessage>>;
  suggestions(context?: { recordType?: string; recordId?: Id; persona?: string }): Promise<Paginated<import('./platform').AiPromptSuggestion>>;
  rateMessage(messageId: Id, feedback: 'helpful' | 'not_helpful'): Promise<Result<import('./platform').AiMessage>>;
  archiveConversation(id: Id): Promise<Result<import('./platform').AiConversation>>;
  summariseRecord(type: string, id: Id): Promise<Result<{ summary: string; highlights: string[]; risks: string[]; nextActions: string[]; origin: 'demo_template_engine' }>>;
  draftEmail(context: { recordType: string; recordId: Id; intent: string; tone: string }): Promise<Result<{ subject: string; body: string; origin: 'demo_template_engine'; warnings: string[] }>>;
  usageDashboard(period?: string): Promise<Result<import('./platform').AiUsageDashboard>>;
  settings(): Promise<Result<import('./platform').AiSettings>>;
  updateSettings(patch: UpdateInput<import('./platform').AiSettings>): Promise<Result<import('./platform').AiSettings>>;
}

/* ------------------------------------------------- organization administration */

export interface OrganizationService {
  get(): Promise<Result<Organization>>;
  update(patch: UpdateInput<Organization>): Promise<Result<Organization>>;
  updateBranding(branding: Organization['branding']): Promise<Result<Organization>>;
  fiscalYear(settings: { startMonth: number; weekStartsOn: 0 | 1 | 6 }): Promise<Result<Organization>>;
  hierarchy(): Promise<Result<Organization['hierarchy']>>;
  createOrgNode(input: CreateInput<import('./organization').OrgNode>): Promise<Result<import('./organization').OrgNode>>;
  updateOrgNode(id: Id, patch: UpdateInput<import('./organization').OrgNode>): Promise<Result<import('./organization').OrgNode>>;
  removeOrgNode(id: Id): Promise<Result<{ id: Id }>>;
}

export interface UsersService extends CrudService<User, CreateInput<User>, ListQuery> {
  invite(input: { email: string; firstName: string; lastName: string; roleIds: Id[]; teamIds: Id[]; message?: string }): Promise<Result<import('./organization').Invitation>>;
  invitations(query?: ListQuery): Promise<Paginated<import('./organization').Invitation>>;
  revokeInvitation(id: Id): Promise<Result<import('./organization').Invitation>>;
  resendInvitation(id: Id): Promise<Result<{ id: Id; simulated: true; note: string }>>;
  activate(id: Id): Promise<Result<User>>;
  suspend(id: Id, reason: string): Promise<Result<User>>;
  reactivate(id: Id): Promise<Result<User>>;
  changeRole(id: Id, roleIds: Id[]): Promise<Result<User>>;
  changeSeatType(id: Id, seatType: User['seatType']): Promise<Result<User>>;
  /** Used by the persona switcher; presentation only, never authorization. */
  setActivePersona(id: Id, persona: User['persona']): Promise<Result<User>>;
  groups(): Promise<Paginated<import('./organization').UserGroup>>;
  createGroup(input: CreateInput<import('./organization').UserGroup>): Promise<Result<import('./organization').UserGroup>>;
  updateGroup(id: Id, patch: UpdateInput<import('./organization').UserGroup>): Promise<Result<import('./organization').UserGroup>>;
  teams(): Promise<Paginated<import('./organization').Team>>;
  createTeam(input: CreateInput<import('./organization').Team>): Promise<Result<import('./organization').Team>>;
  updateTeam(id: Id, patch: UpdateInput<import('./organization').Team>): Promise<Result<import('./organization').Team>>;
  accessOverview(query?: ListQuery): Promise<Paginated<import('./organization').AccessReviewRow>>;
}

export interface RolesService extends CrudService<Role, CreateInput<Role>, ListQuery> {
  permissionsCatalog(): Promise<Paginated<import('./organization').PermissionDescriptor>>;
  updatePermissions(roleId: Id, grants: Role['permissions']): Promise<Result<Role>>;
  clone(roleId: Id, name: string): Promise<Result<Role>>;
  fieldMatrix(roleId: Id, objectApiName: string): Promise<Paginated<import('./customization').PermissionFieldMatrixRow>>;
  /** Explains the effective permission set including inheritance. */
  effectivePermissions(roleId: Id): Promise<Result<{ roleId: Id; resolved: Role['permissions']; inheritedFrom?: Id; overrides: Role['permissions'] }>>;
  accessReview(roleId: Id): Promise<Paginated<import('./organization').AccessReviewRow>>;
}

export interface SecurityService {
  policy(): Promise<Result<SecurityPolicy>>;
  updatePolicy(patch: UpdateInput<SecurityPolicy>): Promise<Result<SecurityPolicy>>;
  sessions(query?: ListQuery): Promise<Paginated<SessionRecord>>;
  /** Cannot terminate anything real; returns the simulated outcome and says so. */
  revokeSession(id: Id): Promise<Result<{ id: Id; simulated: true; note: string }>>;
  revokeAllOtherSessions(): Promise<Result<{ revoked: number; note: string }>>;
  devices(): Promise<Paginated<import('./organization').TrustedDevice>>;
  revokeDevice(id: Id): Promise<Result<{ id: Id }>>;
  auditEvents(query: ListQuery & { category?: string; actorId?: Id; severity?: string }): Promise<Paginated<AuditEvent>>;
  exportAuditEvents(from: string, to: string): Promise<Result<{ exportId: Id; rowCount: number; generatedLocally: boolean }>>;
}

export interface DataManagementService {
  /** Import pipeline: upload → map → validate → commit, each a separate call. */
  startImport(input: { resource: string; fileName: string; rowCount: number }): Promise<Result<{ jobId: Id }>>;
  suggestMapping(jobId: Id, headers: string[]): Promise<Result<{ mappings: Array<{ sourceHeader: string; targetField: string | null; confidence: number; sample: string[] }>; unmappedHeaders: string[] }>>;
  validateImport(jobId: Id, mappings: Array<{ sourceHeader: string; targetField: string }>): Promise<Result<{ valid: number; invalid: number; warnings: number; errors: Array<{ row: number; field: string; message: string }> }>>;
  commitImport(jobId: Id, mappings: Array<{ sourceHeader: string; targetField: string }>, options: { onDuplicate: 'skip' | 'update' | 'create_anyway'; assignOwnerId?: Id }): Promise<Result<{ created: number; updated: number; skipped: number; failed: number; jobId: Id }>>;
  importJobs(query?: ListQuery): Promise<Paginated<{ id: Id; resource: string; state: string; createdAt: string; createdBy: string; totalRows: number; processedRows: number; failedRows: number }>>;
  duplicateCandidates(query?: ListQuery): Promise<Paginated<DuplicateCandidate>>;
  resolveDuplicate(id: Id, resolution: 'merged' | 'ignored' | 'not_duplicate'): Promise<Result<DuplicateCandidate>>;
  mergeRecords(candidate: DuplicateCandidate): Promise<Result<{ primaryId: Id; mergedIds: Id[]; movedRelations: number }>>;
  retentionPolicy(): Promise<Result<{ rules: Array<{ id: Id; resource: string; retentionDays: number; action: 'archive' | 'anonymize' | 'delete'; enabled: boolean; legalHoldExempt: boolean }>; lastReviewedAt?: string }>>;
  updateRetentionPolicy(rules: Array<{ id: Id; retentionDays: number; enabled: boolean }>): Promise<Result<{ updated: number }>>;
  backupStatus(): Promise<Result<{ state: 'not_connected'; lastBackupAt?: string; note: string; requestedRestores: Array<{ id: Id; requestedAt: string; state: string; scope: string }> }>>;
  requestRestore(scope: string, reason: string): Promise<Result<{ id: Id; state: 'requested'; note: string }>>;
  deletionRequests(query?: ListQuery): Promise<Paginated<{ id: Id; subjectLabel: string; requestedAt: string; requestedBy: string; scope: string; state: 'received' | 'verifying' | 'approved' | 'rejected' | 'completed'; dueAt: string; note: string }>>;
  consentOverview(): Promise<Result<{ byChannel: Array<{ channel: string; granted: number; denied: number; withdrawn: number; pending: number }>; byJurisdiction: Array<{ jurisdiction: string; contacts: number; granted: number; withdrawn: number }>; changes30d: number }>>;
}

export interface BillingService {
  subscription(): Promise<Result<import('./platform').PlatformSubscription>>;
  plans(): Promise<Paginated<import('./platform').PlatformPlan>>;
  addOns(): Promise<Paginated<import('./platform').PlatformAddOn>>;
  /** Entitlement preview for a plan change, so upgrade prompts are accurate. */
  previewPlanChange(planId: Id, seats: number, interval: 'month' | 'year'): Promise<Result<{ planId: Id; seats: number; interval: 'month' | 'year'; amountDueNow: number; recurringAmount: number; currency: string; effectiveDate: string; prorationNote: string; entitlementsGained: Entitlement[]; entitlementsLost: Entitlement[] }>>;
  changePlan(planId: Id, seats: number, interval: 'month' | 'year', options?: WriteOptions): Promise<Result<import('./platform').PlatformSubscription>>;
  updateSeats(seats: number): Promise<Result<import('./platform').PlatformSubscription>>;
  setAddOn(addOnId: Id, quantity: number): Promise<Result<import('./platform').PlatformSubscription>>;
  cancel(reason: string, effective: 'immediately' | 'end_of_period'): Promise<Result<import('./platform').PlatformSubscription>>;
  reactivate(): Promise<Result<import('./platform').PlatformSubscription>>;
  paymentMethods(): Promise<Result<Array<{ id: Id; label: string; brand: string; last4Masked: string; expiresAt: string; isDefault: boolean; state: 'not_connected' | 'expiring_soon' | 'expired' }>>>;
  invoices(query?: ListQuery): Promise<Paginated<import('./platform').PlatformInvoice>>;
  usage(): Promise<Result<UsageMeter[]>>;
  entitlements(): Promise<Result<Entitlement[]>>;
  /** Simulated checkout: returns a confirmation without charging anything. */
  checkoutPreview(
    planId: Id,
    seats: number,
    interval: 'month' | 'year',
    promoCode?: string,
  ): Promise<
    Result<{
      reference: string;
      lines: Array<{ label: string; amount: number }>;
      subtotal: number;
      discount: number;
      total: number;
      currency: string;
      paymentProviderState: 'not_connected';
      simulated: true;
    }>
  >;
  applyPromoCode(code: string): Promise<Result<{ valid: boolean; kind: 'percent' | 'amount'; value: number; description: string; note: string }>>;
}

/* ------------------------------------------------------------- tenant state */

export interface TenantContextService {
  tenants(): Promise<Paginated<Tenant>>;
  currentTenant(): Promise<Result<Tenant>>;
  organizations(tenantId?: Id): Promise<Paginated<Organization>>;
  switchOrganization(organizationId: Id): Promise<Result<{ organization: Organization; user: User }>>;
  switchTenant(tenantId: Id): Promise<Result<{ tenant: Tenant; organizations: Organization[] }>>;
  workspaces(): Promise<Paginated<import('./organization').Workspace>>;
  currentUser(): Promise<Result<User>>;
  updatePreferences(patch: Partial<User['preferences']>): Promise<Result<User>>;
  favorites(): Promise<Result<User['preferences']['favorites']>>;
  toggleFavorite(entry: { kind: string; label: string; path: string; id?: Id }): Promise<Result<User['preferences']['favorites']>>;
  recentItems(): Promise<Result<User['preferences']['recentlyViewed']>>;
  recordRecentView(entry: { kind: string; label: string; path: string; id?: Id }): Promise<Result<User['preferences']['recentlyViewed']>>;
  accessDeniedContext(reason: AccessDeniedContext['reason'], resource?: string): Promise<Result<AccessDeniedContext>>;
}

/* ---------------------------------------------------------- platform owner */

export interface PlatformAdminService {
  overview(): Promise<Result<import('./platform').PlatformOverview>>;
  tenants(query: ListQuery & { status?: string; planId?: Id; region?: string }): Promise<Paginated<import('./platform').PlatformTenantRow>>;
  tenant(id: Id): Promise<Result<Tenant>>;
  updateTenant(id: Id, patch: UpdateInput<Tenant>): Promise<Result<Tenant>>;
  suspendTenant(id: Id, reason: string): Promise<Result<Tenant>>;
  reactivateTenant(id: Id): Promise<Result<Tenant>>;
  extendTrial(id: Id, days: number): Promise<Result<Tenant>>;
  convertTrial(id: Id, planId: Id, seats: number): Promise<Result<Tenant>>;
  setTenantModules(id: Id, moduleKeys: string[]): Promise<Result<Tenant>>;
  setTenantFlag(id: Id, flagKey: string, enabled: boolean): Promise<Result<Tenant>>;
  addSupportNote(id: Id, body: string): Promise<Result<Tenant>>;
  tenantsCsv(query?: ListQuery): Promise<Result<{ filename: string; content: string; generatedLocally: boolean }>>;

  plans(query?: ListQuery): Promise<Paginated<import('./platform').PlatformPlan>>;
  createPlan(input: CreateInput<import('./platform').PlatformPlan>): Promise<Result<import('./platform').PlatformPlan>>;
  updatePlan(id: Id, patch: UpdateInput<import('./platform').PlatformPlan>): Promise<Result<import('./platform').PlatformPlan>>;
  archivePlan(id: Id): Promise<Result<import('./platform').PlatformPlan>>;
  addOns(query?: ListQuery): Promise<Paginated<import('./platform').PlatformAddOn>>;
  createAddOn(input: CreateInput<import('./platform').PlatformAddOn>): Promise<Result<import('./platform').PlatformAddOn>>;
  updateAddOn(id: Id, patch: UpdateInput<import('./platform').PlatformAddOn>): Promise<Result<import('./platform').PlatformAddOn>>;

  subscriptions(query?: ListQuery): Promise<Paginated<import('./platform').PlatformSubscription>>;
  subscription(id: Id): Promise<Result<import('./platform').PlatformSubscription>>;
  updateSubscription(id: Id, patch: UpdateInput<import('./platform').PlatformSubscription>): Promise<Result<import('./platform').PlatformSubscription>>;
  expiringSubscriptions(withinDays: number): Promise<Paginated<import('./platform').PlatformSubscription>>;
  failedPayments(query?: ListQuery): Promise<Paginated<import('./platform').PlatformInvoice>>;
  invoices(query?: ListQuery): Promise<Paginated<import('./platform').PlatformInvoice>>;
  requestRefund(invoiceId: Id, amount: number, reason: string): Promise<Result<{ invoice: import('./platform').PlatformInvoice; refundState: 'requested' | 'pending_approval'; paymentProviderState: 'not_connected'; note: string }>>;
  retryPayment(invoiceId: Id): Promise<Result<{ invoiceId: Id; attempt: number; state: 'simulated_retry'; note: string }>>;

  featureFlags(query?: ListQuery): Promise<Paginated<import('./platform').FeatureFlag>>;
  createFeatureFlag(input: CreateInput<import('./platform').FeatureFlag>): Promise<Result<import('./platform').FeatureFlag>>;
  updateFeatureFlag(id: Id, patch: UpdateInput<import('./platform').FeatureFlag>): Promise<Result<import('./platform').FeatureFlag>>;
  toggleFeatureFlag(id: Id, status: import('./platform').FeatureFlag['status'], note?: string): Promise<Result<import('./platform').FeatureFlag>>;

  moduleCatalog(query?: ListQuery): Promise<Paginated<import('./platform').ModuleCatalogEntry>>;
  updateModule(key: string, patch: Partial<import('./platform').ModuleCatalogEntry>): Promise<Result<import('./platform').ModuleCatalogEntry>>;

  localizationRows(): Promise<Paginated<import('./platform').LocalizationAdminRow>>;
  updateLocalization(locale: string, patch: Partial<import('./platform').LocalizationAdminRow>): Promise<Result<import('./platform').LocalizationAdminRow>>;
  downloadTranslations(locale: string): Promise<Result<{ locale: string; content: string; generatedLocally: true }>>;

  notificationTemplates(query?: ListQuery): Promise<Paginated<import('./platform').PlatformNotificationTemplate>>;
  updateNotificationTemplate(id: Id, patch: UpdateInput<import('./platform').PlatformNotificationTemplate>): Promise<Result<import('./platform').PlatformNotificationTemplate>>;
  previewNotification(id: Id, locale: string, variables: Record<string, string>): Promise<Result<{ subject: string; body: string; simulated: true }>>;

  announcements(query?: ListQuery): Promise<Paginated<import('./collaboration').Announcement>>;
  createAnnouncement(input: CreateInput<import('./collaboration').Announcement>): Promise<Result<import('./collaboration').Announcement>>;
  updateAnnouncement(id: Id, patch: UpdateInput<import('./collaboration').Announcement>): Promise<Result<import('./collaboration').Announcement>>;
  maintenanceBanners(): Promise<Paginated<import('./platform').MaintenanceBanner>>;
  setMaintenanceBanner(input: CreateInput<import('./platform').MaintenanceBanner>): Promise<Result<import('./platform').MaintenanceBanner>>;
  clearMaintenanceBanner(id: Id): Promise<Result<{ id: Id }>>;

  auditEvents(query?: ListQuery): Promise<Paginated<import('./platform').PlatformAuditEvent>>;
  supportTickets(query?: ListQuery): Promise<Paginated<import('./platform').PlatformSupportTicket>>;
  updateSupportTicket(id: Id, patch: UpdateInput<import('./platform').PlatformSupportTicket>): Promise<Result<import('./platform').PlatformSupportTicket>>;
  addSupportTicketMessage(id: Id, body: string, internal: boolean): Promise<Result<import('./platform').PlatformSupportTicket>>;

  platformUsers(query?: ListQuery): Promise<Paginated<import('./platform').PlatformUser>>;
  invitePlatformUser(input: { email: string; name: string; team: import('./platform').PlatformUser['team']; roleIds: Id[] }): Promise<Result<import('./platform').PlatformUser>>;
  updatePlatformUser(id: Id, patch: UpdateInput<import('./platform').PlatformUser>): Promise<Result<import('./platform').PlatformUser>>;
  platformRoles(): Promise<Paginated<import('./platform').PlatformRole>>;
  createPlatformRole(input: CreateInput<import('./platform').PlatformRole>): Promise<Result<import('./platform').PlatformRole>>;
  updatePlatformRole(id: Id, patch: UpdateInput<import('./platform').PlatformRole>): Promise<Result<import('./platform').PlatformRole>>;

  systemStatus(): Promise<Paginated<import('./platform').SystemStatusComponent>>;
  productUsage(): Promise<Result<{ activeUsersDaily: Array<{ date: string; users: number; sessions: number }>; featureAdoption: Array<{ moduleKey: string; label: string; tenantsEnabled: number; activeUsers: number; adoptionPercent: number }>; topScreens: Array<{ route: string; label: string; views: number; uniqueUsers: number; avgSeconds: number }>; retention: Array<{ week: string; cohorts: number[] }>; generatedAt: string }>>;
  integrationCatalogAdmin(): Promise<Paginated<Integration>>;
  updateIntegrationAdmin(id: Id, patch: UpdateInput<Integration>): Promise<Result<Integration>>;
}

/* --------------------------------------------------------- demonstration UX */

export interface DemoDataService {
  /** Resets every mock store back to the seeded baseline. */
  reset(scope?: 'organization' | 'all'): Promise<Result<{ resetAt: string; collections: number; records: number }>>;
  seedSampleData(organizationId: Id, preset: 'empty' | 'starter' | 'full' | 'industry'): Promise<Result<{ created: Record<string, number> }>>;
  clearSampleData(organizationId: Id): Promise<Result<{ removed: Record<string, number> }>>;
  snapshot(): Promise<Result<{ takenAt: string; collections: number; records: number; approxBytes: number }>>;
}

export interface OnboardingService {
  progress(): Promise<Result<import('./organization').OnboardingProgress>>;
  completeStep(stepId: string): Promise<Result<import('./organization').OnboardingProgress>>;
  skipStep(stepId: string): Promise<Result<import('./organization').OnboardingProgress>>;
  dismissChecklist(): Promise<Result<import('./organization').OnboardingProgress>>;
  completeOrganizationSetup(payload: {
    name: string;
    countryCode: string;
    locale: string;
    timezone: string;
    currency: string;
    industryId: Id;
    companySize: string;
    goals: string[];
    moduleKeys: string[];
    pipelineTemplateId?: Id;
    invitedEmails?: string[];
    loadSampleData: boolean;
  }): Promise<Result<{ organization: Organization; progress: import('./organization').OnboardingProgress }>>;
}

/* --------------------------------------------------------------- container */

/**
 * The single object the UI receives. Swapping `createMockServices()` for a
 * Laravel-backed implementation is the only change required later.
 */
export interface ServiceContainer {
  leads: LeadsService;
  contacts: ContactsService;
  accounts: AccountsService;
  deals: DealsService;
  pipelines: PipelinesService;
  activities: ActivitiesService;
  calendar: CalendarService;
  tasks: TasksService;
  sequences: SequencesService;
  playbooks: PlaybooksService;
  goals: GoalsService;
  conversations: ConversationsService;
  campaigns: CampaignsService;
  segments: SegmentsService;
  journeys: JourneysService;
  emailTemplates: EmailTemplatesService;
  forms: FormsService;
  landingPages: LandingPagesService;
  leadSources: LeadSourcesService;
  tickets: TicketsService;
  knowledgeBase: KnowledgeBaseService;
  customerSuccess: CustomerSuccessService;
  products: ProductsService;
  quotes: QuotesService;
  orders: OrdersService;
  contracts: ContractsService;
  invoices: InvoicesService;
  subscriptionRevenue: SubscriptionRevenueService;
  dashboards: DashboardsService;
  reports: ReportsService;
  exports: ExportsService;
  analytics: AnalyticsService;
  workflows: WorkflowsService;
  customObjects: CustomObjectsService;
  layouts: LayoutsService;
  savedViews: SavedViewsService;
  industryTemplates: IndustryTemplatesService;
  navigation: NavigationService;
  documents: DocumentsService;
  collaboration: CollaborationService;
  projects: ProjectsService;
  fieldSales: FieldSalesService;
  partners: PartnersService;
  integrations: IntegrationsService;
  developer: DeveloperPlatformService;
  ai: AiAssistantService;
  organization: OrganizationService;
  users: UsersService;
  roles: RolesService;
  security: SecurityService;
  data: DataManagementService;
  billing: BillingService;
  tenant: TenantContextService;
  platformAdmin: PlatformAdminService;
  demo: DemoDataService;
  onboarding: OnboardingService;
}

/** Injection key for the React context provider that hands out the container. */
export const SERVICE_CONTAINER_KEY = 'crm.services';
