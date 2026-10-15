/**
 * Customer success: health scoring, portfolios, onboarding plans, renewals,
 * churn risk, success plans, business reviews and voice-of-customer metrics.
 */

import type { Auditable, CurrencyCode, Id, ISODateString, ISODateTimeString, Money, Tone } from './common';

/* ------------------------------------------------------------ health scores */

export type HealthBand = 'thriving' | 'healthy' | 'watch' | 'at_risk' | 'critical' | 'unknown';

export interface HealthComponent {
  key: string;
  label: string;
  /** 0-100 subscore. */
  score: number;
  weight: number;
  /** Explainability matters more than the number itself. */
  rationale: string;
  trend: number;
  direction: 'up' | 'down' | 'flat';
}

export interface AccountHealthScore {
  id: Id;
  accountId: Id;
  accountName: string;
  ownerId: Id;
  ownerName: string;
  score: number;
  band: HealthBand;
  previousScore: number;
  /** Change over the comparison window. */
  delta: number;
  computedAt: ISODateTimeString;
  modelLabel: string;
  components: HealthComponent[];
  signals: Array<{
    id: Id;
    kind:
      | 'product_usage_down'
      | 'usage_increase'
      | 'support_spike'
      | 'champion_left'
      | 'exec_sponsor_missing'
      | 'payment_late'
      | 'contract_ending'
      | 'nps_detractor'
      | 'nps_promoter'
      | 'low_adoption'
      | 'training_completed'
      | 'integration_lost'
      | 'invoice_overdue'
      | 'expansion_interest';
    label: string;
    severity: 'high' | 'medium' | 'low';
    detectedAt: ISODateTimeString;
    direction: 'positive' | 'negative' | 'neutral';
    suggestedAction?: string;
  }>;
  /** Sentiment of the relationship in plain terms. */
  sentiment: 'promoter' | 'neutral' | 'detractor' | 'unknown';
  renewalRiskPercent: number;
  expansionProbabilityPercent: number;
}

export interface SuccessPortfolio extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  ownerId: Id;
  ownerName: string;
  accountIds: Id[];
  /** Aggregate rollups so the portfolio page needs no client-side heavy maths. */
  summary: {
    accountCount: number;
    totalArr: Money;
    atRiskCount: number;
    healthyCount: number;
    averageHealth: number;
    renewalsNext90Days: number;
    upcomingReviews: number;
  };
  segment?: 'enterprise' | 'mid_market' | 'smb' | 'strategic' | 'custom';
}

/* ------------------------------------------------------------ success plans */

export type SuccessPlanStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'canceled';

export interface SuccessPlan extends Auditable {
  id: Id;
  organizationId: Id;
  accountId: Id;
  accountName: string;
  name: string;
  status: SuccessPlanStatus;
  ownerId: Id;
  ownerName: string;
  startDate: ISODateString;
  targetDate: ISODateString;
  /** Objectives with measurable key results. */
  objectives: SuccessObjective[];
  overallProgress: number;
  customerStakeholders: Array<{ contactId: Id; name: string; role?: string; engagement: 'high' | 'medium' | 'low' | 'unknown' }>;
  internalTeam: Array<{ userId: Id; name: string; role: string }>;
  risks: Array<{ id: Id; label: string; severity: 'high' | 'medium' | 'low'; mitigation?: string; status: 'open' | 'mitigated' | 'accepted' }>;
  notes?: string;
}

export interface SuccessObjective {
  id: Id;
  title: string;
  description?: string;
  metric: string;
  baselineValue?: string;
  targetValue: string;
  currentValue?: string;
  progressPercent: number;
  status: 'on_track' | 'at_risk' | 'off_track' | 'achieved' | 'not_started';
  dueDate?: ISODateString;
  ownerId?: Id;
  tone: Tone;
}

/* ---------------------------------------------------------- onboarding plan */

export interface OnboardingPlan extends Auditable {
  id: Id;
  organizationId: Id;
  accountId: Id;
  accountName: string;
  dealId?: Id;
  /** Set when the plan was created automatically by the "deal won" workflow. */
  createdByWorkflowId?: Id;
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'paused';
  templateId?: Id;
  templateName?: string;
  managerId: Id;
  managerName: string;
  customerTeam: Array<{ contactId: Id; name: string; role: string; lastActiveAt?: ISODateTimeString }>;
  startDate: ISODateString;
  targetGoLiveDate: ISODateString;
  completedAt?: ISODateTimeString;
  progressPercent: number;
  phases: OnboardingPhase[];
  /** Time-to-value metric is the headline number for this module. */
  timeToFirstValueDays?: number;
  blockers: Array<{ id: Id; label: string; raisedAt: ISODateTimeString; owner?: string }>;
}

export interface OnboardingPhase {
  id: Id;
  name: string;
  description?: string;
  order: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  dueDate?: ISODateString;
  tasks: OnboardingTask[];
  progressPercent: number;
}

export interface OnboardingTask {
  id: Id;
  title: string;
  description?: string;
  ownerKind: 'internal' | 'customer';
  ownerName: string;
  dueDate?: ISODateString;
  completedAt?: ISODateTimeString;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  blockedReason?: string;
  dependsOnIds?: Id[];
  isMilestone: boolean;
}

/* ----------------------------------------------------------------- renewals */

export interface Renewal extends Auditable {
  id: Id;
  organizationId: Id;
  accountId: Id;
  accountName: string;
  contractId: Id;
  contractReference: string;
  ownerId: Id;
  ownerName: string;
  /** The renewal pipeline is separate from new business by design. */
  stage: 'upcoming' | 'outreach' | 'negotiation' | 'commit' | 'won' | 'lost' | 'churned';
  renewalDate: ISODateString;
  daysUntilRenewal: number;
  termMonths: number;
  currentValue: Money;
  proposedValue: Money;
  /** Positive = expansion, negative = contraction. */
  changeAmount: Money;
  changePercent: number;
  changeKind: 'expansion' | 'flat' | 'contraction' | 'churn';
  probability: number;
  healthScore: number;
  healthBand: HealthBand;
  riskFactors: Array<{ label: string; severity: 'high' | 'medium' | 'low' }>;
  /** Next action keeps the list actionable rather than report-only. */
  nextStep?: string;
  nextActivityAt?: ISODateTimeString;
  forecastCategory: 'commit' | 'best_case' | 'pipeline' | 'omitted';
  currency: CurrencyCode;
  autoRenew: boolean;
  noticePeriodDays: number;
}

export interface ChurnRiskRow {
  accountId: Id;
  accountName: string;
  ownerId: Id;
  ownerName: string;
  healthScore: number;
  healthBand: HealthBand;
  arr: Money;
  renewalDate?: ISODateString;
  riskPercent: number;
  primaryRiskFactor: string;
  riskFactorCount: number;
  monthsAsCustomer: number;
  usageChangePercent: number;
  openTickets: number;
  sentiment: 'promoter' | 'neutral' | 'detractor' | 'unknown';
  recommendedPlaybookId?: Id;
  recommendedPlaybookName?: string;
}

/* --------------------------------------------------------- business reviews */

export interface BusinessReview extends Auditable {
  id: Id;
  organizationId: Id;
  accountId: Id;
  accountName: string;
  kind: 'qbr' | 'ebr' | 'monthly_checkin' | 'onboarding_review' | 'renewal_review';
  status: 'scheduled' | 'completed' | 'cancelled' | 'draft';
  scheduledAt: ISODateTimeString;
  durationMinutes: number;
  ownerId: Id;
  ownerName: string;
  attendees: Array<{ id: Id; name: string; kind: 'internal' | 'external'; role?: string }>;
  agendaItems: Array<{ id: Id; title: string; durationMinutes: number; presenter?: string; done: boolean }>;
  /** Deterministic deck outline — a genuine placeholder, not a generated file. */
  presentationOutline?: Array<{ title: string; bullets: string[] }>;
  outcomes?: string[];
  actionItems?: Array<{ id: Id; text: string; ownerName: string; dueDate?: string; done: boolean }>;
  nextReviewAt?: ISODateTimeString;
  healthAtReview?: number;
}

/* ------------------------------------------------------- voice of customer */

export interface VoiceOfCustomerOverview {
  periodLabel: string;
  nps: {
    score: number;
    responses: number;
    responseRate: number;
    promoters: number;
    passives: number;
    detractors: number;
    previousScore: number;
    trend: Array<{ date: ISODateString; score: number; responses: number }>;
    bySegment: Array<{ label: string; score: number; responses: number }>;
    comments: Array<{ id: Id; score: number; category: 'promoter' | 'passive' | 'detractor'; comment: string; accountLabel: string; submittedAt: ISODateTimeString }>;
  };
  csat: {
    score: number;
    responses: number;
    trend: Array<{ date: ISODateString; score: number; responses: number }>;
    distribution: Array<{ score: number; count: number }>;
  };
  ces?: { score: number; responses: number };
  themes: Array<{ label: string; mentions: number; sentiment: 'positive' | 'neutral' | 'negative'; changePercent: number; sampleComments: string[] }>;
}

/* ---------------------------------------------------------- success metrics */

export interface CustomerSuccessOverview {
  currency: CurrencyCode;
  periodLabel: string;
  metrics: {
    totalAccounts: number;
    accountsAtRisk: number;
    averageHealthScore: number;
    arr: Money;
    nrr: number;
    grr: number;
    logoRetentionPercent: number;
    renewalsDue90Days: number;
    renewalsDue90DaysValue: Money;
    completedReviews: number;
    overdueReviews: number;
    timeToValueDays: number;
    onboardingOnTrack: number;
    onboardingAtRisk: number;
  };
  healthDistribution: Array<{ band: HealthBand; label: string; count: number; arr: number; tone: Tone }>;
  healthTrend: Array<{ date: ISODateString; thriving: number; healthy: number; watch: number; atRisk: number; critical: number }>;
  renewalsByMonth: Array<{ month: string; count: number; value: number; atRiskValue: number }>;
  portfolioPerformance: Array<{
    portfolioId: Id;
    name: string;
    ownerName: string;
    accounts: number;
    averageHealth: number;
    arr: number;
    atRisk: number;
    renewals90: number;
  }>;
  successManagerPerformance: Array<{
    userId: Id;
    name: string;
    portfolios: number;
    accounts: number;
    averageHealth: number;
    reviewsCompleted: number;
    renewalsWon: number;
    nrr: number;
    nps: number;
  }>;
  churnReasons: Array<{ reason: string; count: number; arrLost: number }>;
  expansionOpportunities: Array<{
    id: Id;
    accountId: Id;
    accountName: string;
    kind: 'upsell' | 'cross_sell' | 'seat_expansion' | 'tier_upgrade' | 'module_add';
    estimatedValue: Money;
    probability: number;
    ownerName: string;
    rationale: string;
    identifiedAt: ISODateTimeString;
  }>;
  adoption: {
    averageFeatureAdoptionPercent: number;
    byFeature: Array<{ featureKey: string; label: string; adoptionPercent: number; trend: number }>;
    /** Cohort grid: weeks since go-live against retention. */
    cohorts: Array<{ cohortLabel: string; size: number; values: number[] }>;
  };
}
