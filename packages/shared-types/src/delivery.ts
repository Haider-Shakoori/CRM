/**
 * Projects & delivery, field sales & territories, and partner relationship
 * management. Grouped because they share the "work happens away from the desk"
 * pattern: a location, a schedule, and a handoff from a closed sale.
 */

import type { Auditable, CurrencyCode, Id, ISODateString, ISODateTimeString, Money, Tag, Tone } from './common';
import type { DealProductLine } from './crm';

/* ---------------------------------------------------------------- projects */

export type ProjectStatus = 'planning' | 'not_started' | 'in_progress' | 'blocked' | 'on_hold' | 'at_risk' | 'completed' | 'cancelled';

export interface Project extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  name: string;
  description?: string;
  accountId: Id;
  accountName: string;
  /** The closed deal that produced this project, when the handoff was automatic. */
  dealId?: Id;
  contractId?: Id;
  orderId?: Id;
  createdByWorkflowId?: Id;
  handoff: {
    state: 'not_required' | 'pending' | 'accepted' | 'rejected';
    fromOwnerId?: Id;
    fromOwnerName?: string;
    toManagerId?: Id;
    toManagerName?: string;
    handoffAt?: ISODateTimeString;
    checklist: Array<{ id: Id; label: string; done: boolean }>;
  };
  templateId?: Id;
  templateName?: string;
  status: ProjectStatus;
  priority: 'critical' | 'high' | 'normal' | 'low';
  managerId: Id;
  managerName: string;
  teamMembers: Array<{ userId: Id; name: string; role: 'manager' | 'contributor' | 'reviewer' | 'customer_contact'; allocationPercent?: number }>;
  startDate: ISODateString;
  targetEndDate: ISODateString;
  actualEndDate?: ISODateString;
  currency: CurrencyCode;
  budget?: Money;
  budgetSpent?: Money;
  billingType: 'fixed_fee' | 'time_and_materials' | 'milestone' | 'retainer' | 'internal';
  progressPercent: number;
  health: 'on_track' | 'at_risk' | 'off_track' | 'blocked';
  healthReasons?: string[];
  taskCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  milestoneCount: number;
  completedMilestoneCount: number;
  riskCount: number;
  issueCount: number;
  customerVisible: boolean;
  tags: Tag[];
}

export interface ProjectPhase {
  id: Id;
  projectId: Id;
  name: string;
  order: number;
  startDate?: ISODateString;
  endDate?: ISODateString;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  progressPercent: number;
  tone: Tone;
}

export interface ProjectTask extends Auditable {
  id: Id;
  organizationId: Id;
  projectId: Id;
  projectName: string;
  reference: string;
  title: string;
  description?: string;
  phaseId?: Id;
  parentTaskId?: Id;
  milestoneId?: Id;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
  priority: 'critical' | 'high' | 'normal' | 'low';
  assigneeId?: Id;
  assigneeName?: string;
  reporterId?: Id;
  startDate?: ISODateString;
  dueDate?: ISODateString;
  completedAt?: ISODateTimeString;
  estimateHours?: number;
  loggedHours?: number;
  progressPercent: number;
  dependsOnIds: Id[];
  blockedReason?: string;
  labels: string[];
  checklist: Array<{ id: Id; label: string; done: boolean }>;
  customerVisible: boolean;
  commentCount: number;
  attachmentCount: number;
  order: number;
  sprintLabel?: string;
}

export interface ProjectMilestone extends Auditable {
  id: Id;
  projectId: Id;
  name: string;
  description?: string;
  dueDate: ISODateString;
  completedAt?: ISODateTimeString;
  status: 'pending' | 'in_progress' | 'completed' | 'missed' | 'at_risk';
  /** Milestone billing is recorded as a CRM fact, not an invoice. */
  billableAmount?: Money;
  invoiced: boolean;
  deliverableIds: Id[];
  ownerId?: Id;
  customerApprovalRequired: boolean;
  customerApprovedAt?: ISODateTimeString;
}

export interface ProjectDeliverable {
  id: Id;
  projectId: Id;
  milestoneId?: Id;
  name: string;
  description?: string;
  kind: 'document' | 'software_release' | 'service' | 'training' | 'report' | 'other';
  status: 'not_started' | 'in_progress' | 'in_review' | 'accepted' | 'rejected';
  dueDate?: ISODateString;
  deliveredAt?: ISODateTimeString;
  acceptedAt?: ISODateTimeString;
  documentId?: Id;
  customerVisible: boolean;
}

export interface ProjectRisk {
  id: Id;
  projectId: Id;
  kind: 'risk' | 'issue';
  title: string;
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'mitigating' | 'resolved' | 'accepted' | 'closed';
  ownerId?: Id;
  ownerName?: string;
  raisedAt: ISODateTimeString;
  targetResolutionDate?: ISODateString;
  mitigationPlan?: string;
  customerVisible: boolean;
}

export interface ProjectTimeline {
  projectId: Id;
  startDate: ISODateString;
  endDate: ISODateString;
  bars: Array<{
    id: Id;
    kind: 'phase' | 'task' | 'milestone' | 'deliverable';
    label: string;
    startDate: ISODateString;
    endDate: ISODateString;
    progressPercent: number;
    tone: Tone;
    dependsOnIds: Id[];
    depth: number;
    parentId?: Id;
    status: string;
  }>;
  todayMarker: ISODateString;
  criticalPathIds: Id[];
}

export interface ProjectOverview {
  activeProjects: number;
  atRiskProjects: number;
  blockedProjects: number;
  completedThisPeriod: number;
  averageDurationDays: number;
  onTimeDeliveryPercent: number;
  totalBudget: Money;
  budgetConsumedPercent: number;
  utilizationPercent: number;
  byStatus: Array<{ status: ProjectStatus; label: string; count: number; tone: Tone }>;
  byManager: Array<{ userId: Id; name: string; projects: number; onTimePercent: number; atRisk: number; utilizationPercent: number }>;
  deliveryTrend: Array<{ date: ISODateString; started: number; completed: number; overdue: number }>;
  upcomingMilestones: Array<{ id: Id; projectId: Id; projectName: string; name: string; dueDate: ISODateString; status: string; billableAmount?: Money }>;
  timeToValueTrend: Array<{ month: string; days: number }>;
}

/* ------------------------------------------------------------- field sales */

export interface Territory extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  code: string;
  kind: 'geographic' | 'industry' | 'named_account' | 'product' | 'hybrid';
  description?: string;
  /** Geographic definition is descriptive; no map provider is used. */
  geography: { countryCodes: string[]; regions: string[]; postalCodePrefixes: string[]; radiusKm?: number };
  /** A simple polygon is stored for the schematic map placeholder. */
  shapePlaceholder?: Array<{ x: number; y: number }>;
  ownerId?: Id;
  ownerName?: string;
  memberIds: Id[];
  accountCount: number;
  openPipeline: Money;
  wonValue: Money;
  quota?: Money;
  attainmentPercent: number;
  visitTargetPerMonth: number;
  visitsLast30Days: number;
  coveragePercent: number;
  parentTerritoryId?: Id;
  tone: Tone;
  isActive: boolean;
}

export interface VisitPlan extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  userId: Id;
  userName: string;
  date: ISODateString;
  territoryId?: Id;
  territoryName?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  stops: VisitStop[];
  /** Route ordering is a presentation aid, not navigation. */
  route: {
    totalDistanceKm: number;
    estimatedDriveMinutes: number;
    /** No routing service is called; the summary is computed locally. */
    routingState: 'not_configured';
    mapPlaceholderNote: string;
  };
  notes?: string;
}

export interface VisitStop {
  id: Id;
  order: number;
  accountId: Id;
  accountName: string;
  addressLabel: string;
  contactId?: Id;
  contactName?: string;
  plannedStartAt: ISODateTimeString;
  plannedDurationMinutes: number;
  purpose: 'check_in' | 'demo' | 'review' | 'training' | 'delivery' | 'collection' | 'relationship' | 'onboarding' | 'renewal';
  status: 'planned' | 'visited' | 'skipped' | 'rescheduled';
  visitLogId?: Id;
  objetivo?: string;
  priority: 'high' | 'normal' | 'low';
}

export interface VisitLog extends Auditable {
  id: Id;
  organizationId: Id;
  accountId: Id;
  accountName: string;
  contactId?: Id;
  contactName?: string;
  userId: Id;
  userName: string;
  visitPlanId?: Id;
  visitStopId?: Id;
  /** Check-in is a button press with a manually chosen location label. */
  checkIn: {
    at: ISODateTimeString;
    locationLabel: string;
    /** Nominally from coordinates; in this build it is a selected label. */
    locationSource: 'manual_selection' | 'typed_address';
    coordinatesPlaceholder?: { lat: number; lng: number };
    gpsUsed: false;
    note: string;
  };
  checkOut?: { at: ISODateTimeString; durationMinutes: number };
  durationMinutes: number;
  purpose: VisitStop['purpose'];
  outcome: 'positive' | 'neutral' | 'negative' | 'no_contact' | 'follow_up_required';
  summary: string;
  productsDiscussed: Id[];
  competitorsMentioned?: string[];
  samplesGiven?: string[];
  orderPlaced?: { value: Money; orderId?: Id };
  issuesRaised: string[];
  nextSteps: Array<{ id: Id; text: string; dueDate?: ISODateString; ownerName?: string }>;
  followUpTaskId?: Id;
  photos?: Array<{ id: Id; alt: string; placeholder: true }>;
  signatureCapture?: { captured: boolean; simulated: true };
  expenseTotal?: Money;
}

export interface FieldSalesOverview {
  currency: CurrencyCode;
  periodLabel: string;
  metrics: {
    visitsCompleted: number;
    visitsPlanned: number;
    visitCompletionPercent: number;
    averageVisitsPerRep: number;
    averageVisitDurationMinutes: number;
    accountsCovered: number;
    coveragePercent: number;
    ordersFromVisits: number;
    revenueFromVisits: Money;
    territoryAttainmentPercent: number;
    travelMinutesPerVisit: number;
  };
  byTerritory: Array<{
    territoryId: Id;
    name: string;
    accounts: number;
    contacts: number;
    visits: number;
    targetVisits: number;
    coveragePercent: number;
    wonValue: Money;
    quota: Money;
    attainmentPercent: number;
    tone: Tone;
    memberCount: number;
  }>;
  byRep: Array<{
    userId: Id;
    name: string;
    visits: number;
    targetVisits: number;
    completionPercent: number;
    accountsVisited: number;
    orders: number;
    revenue: number;
    durationMinutes: number;
  }>;
  visitTrend: Array<{ date: ISODateString; planned: number; completed: number; orders: number }>;
  outcomesBreakdown: Array<{ outcome: string; label: string; count: number; tone: Tone }>;
  topAccountsByActivity: Array<{ accountId: Id; accountName: string; visits: number; lastVisitAt?: ISODateTimeString; revenue: number }>;
  coverageGaps: Array<{ accountId: Id; accountName: string; territoryName: string; daysSinceLastVisit: number; potentialValue: Money }>;
}

/* ------------------------------------------------------------------ partners */

export type PartnerTier = 'registered' | 'silver' | 'gold' | 'platinum' | 'strategic';

export interface Partner extends Auditable {
  id: Id;
  organizationId: Id;
  accountId: Id;
  name: string;
  type: 'reseller' | 'referral' | 'distributor' | 'technology' | 'implementation' | 'agency' | 'consulting';
  tier: PartnerTier;
  status: 'prospect' | 'onboarding' | 'active' | 'suspended' | 'terminated';
  region: string;
  countryCode: string;
  currency: CurrencyCode;
  programManagerId: Id;
  programManagerName: string;
  partnerSince?: ISODateString;
  agreementSigned: boolean;
  contractId?: Id;
  certifications: Array<{ id: Id; name: string; grantedAt: ISODateString; expiresAt?: ISODateString; level: 'associate' | 'professional' | 'expert'; /** No third-party accreditation is implied. */ issuerLabel: 'internal_program' }>;
  specializationTags: string[];
  tierRequirements: Array<{ id: Id; label: string; target: string; achieved: string; met: boolean }>;
  metrics: {
    registeredDeals: number;
    wonDeals: number;
    winRate: number;
    revenueInfluenced: Money;
    revenueClosed: Money;
    averageDealSize: Money;
    commissionEarned: Money;
    commissionPending: Money;
    leadsReferred: number;
    activeDeals: number;
    customerSatisfaction?: number;
  };
  onboarding: { state: 'not_started' | 'in_progress' | 'completed'; checklist: Array<{ id: Id; label: string; done: boolean; required: boolean }>; progressPercent: number };
  portalAccessEnabled: boolean;
  tags: Tag[];
}

export interface DealRegistration extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  partnerId: Id;
  partnerName: string;
  accountId: Id;
  accountName: string;
  dealName: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'converted' | 'conflict';
  submittedAt: ISODateTimeString;
  submittedByName: string;
  estimatedValue: Money;
  expectedCloseDate: ISODateString;
  currency: CurrencyCode;
  products: Array<{ productId: Id; name: string; quantity: number }>;
  /** Protection window offered to the partner; a commercial policy, not a guarantee. */
  protectionDays: number;
  protectionExpiresAt?: ISODateString;
  /** Conflict detection is a local check against existing registrations, not enforcement. */
  conflictChecks: Array<{ kind: 'existing_registration' | 'existing_deal' | 'existing_account_owner'; severity: 'blocking' | 'warning' | 'info'; label: string; referenceId?: Id; referenceLabel?: string }>;
  reviewNotes?: string;
  reviewedById?: Id;
  reviewedAt?: ISODateTimeString;
  convertedDealId?: Id;
  discountPercent?: number;
}

export interface Referral extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  referrerKind: 'partner' | 'customer' | 'employee' | 'affiliate' | 'other';
  referrerId?: Id;
  referrerName: string;
  referredCompanyName: string;
  referredContactName: string;
  referredEmail: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'rejected' | 'expired';
  receivedAt: ISODateTimeString;
  leadId?: Id;
  dealId?: Id;
  rewardAmount?: Money;
  rewardStatus: 'not_due' | 'pending' | 'approved' | 'paid' | 'declined';
  notes?: string;
}

export interface PartnerCommission extends Auditable {
  id: Id;
  organizationId: Id;
  partnerId: Id;
  partnerName: string;
  dealId?: Id;
  dealName?: string;
  accountName?: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  basis: 'revenue' | 'margin' | 'units';
  basisAmount: Money;
  ratePercent: number;
  amount: Money;
  status: 'accrued' | 'pending_approval' | 'approved' | 'invoiced' | 'paid' | 'disputed' | 'clawed_back';
  approvedByName?: string;
  paidAt?: ISODateTimeString;
  currency: CurrencyCode;
  /** Presentation-only calculation. */
  calculationState: 'demo_local_calculation';
}

export interface PartnerOverview {
  currency: CurrencyCode;
  periodLabel: string;
  metrics: {
    activePartners: number;
    partnersOnboarding: number;
    registrationsSubmitted: number;
    registrationsApproved: number;
    approvalRate: number;
    partnerSourcedRevenue: Money;
    partnerInfluencedRevenue: Money;
    partnerRevenueSharePercent: number;
    commissionsAccrued: Money;
    commissionsPending: Money;
    averageDealSize: Money;
    partnerWinRate: number;
  };
  byTier: Array<{ tier: PartnerTier; label: string; partners: number; revenue: number; deals: number; tone: Tone }>;
  byType: Array<{ type: Partner['type']; label: string; partners: number; revenue: number }>;
  byRegion: Array<{ region: string; partners: number; revenue: number; growthPercent: number }>;
  leaderboard: Array<{ partnerId: Id; name: string; tier: PartnerTier; revenue: Money; deals: number; winRate: number; registrations: number }>;
  registrationTrend: Array<{ date: ISODateString; submitted: number; approved: number; rejected: number }>;
  revenueTrend: Array<{ month: string; sourced: number; influenced: number }>;
  topRegistrations: DealRegistration[];
  /** A sample of the partner deal lines so the portal can render real shapes. */
  sampleProducts: DealProductLine[];
}
