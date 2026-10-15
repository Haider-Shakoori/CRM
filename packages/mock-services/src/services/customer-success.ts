/**
 * Customer success services.
 *
 * Split from `index.ts` for the same reason the other service families are: the container
 * assembly stays readable and one domain's derived maths lives beside itself.
 *
 * Three rules shape this file.
 *
 *  1. **Health is a weighted model, and the weights are the point.** Every score carries its
 *     components, each component carries a weight that sums to 1 across the model, and each
 *     component carries the rationale that explains what fed it. A screen can therefore show
 *     *why* an account is amber instead of only asserting that it is. This is a demonstration
 *     model (`modelLabel` says so) — it is computed from the seeded account signals, ticket
 *     counts and touch recency, not from a prediction service.
 *  2. **Derived values are computed, never stored twice.** The renewal pipeline, the churn
 *     risk rows, the portfolio rollups and the overview all read the same seeded collections
 *     through one set of helpers, so a figure shown in two places cannot disagree.
 *  3. **Writes mutate the local store and say so.** `recomputeHealth` overwrites the local
 *     health snapshot; `apply` on a playbook genuinely creates local task records. Neither
 *     reaches a server, and the wording of every result reflects that.
 *
 * `Math.random` is not used anywhere. All variation comes from `createRandom` seeded by a
 * stable hash of the record id and the dataset epoch, so a score is identical across reloads
 * and across test runs.
 */

import type {
  Account,
  AccountHealthScore,
  ActivitySubject,
  BusinessReview,
  ChurnRiskRow,
  CustomerSuccessOverview,
  HealthBand,
  HealthComponent,
  Id,
  ListQuery,
  OnboardingPlan,
  OnboardingTask,
  Playbook,
  Renewal,
  ServiceContainer,
  SuccessPlan,
  SuccessPortfolio,
  Survey,
  Task,
  VoiceOfCustomerOverview,
} from '@crm/shared-types';
import { DATASET_EPOCH, addDays, createRandom, toDateString, toDateTimeString, type Random } from '../lib/random';
import { runQuery } from '../lib/query';
import { MockDb } from '../lib/store';
import { createCrud, delay, err, nextId, ok } from './factory';

type Db = MockDb;

/* --------------------------------------------------------------- primitives */

/** The five weighted components of the demonstration health model. They sum to 1. */
const HEALTH_WEIGHTS = {
  usage: 0.3,
  support: 0.2,
  engagement: 0.25,
  commercial: 0.15,
  adoption: 0.1,
} as const;

const GUARDED_BANDS: HealthBand[] = ['thriving', 'healthy', 'watch', 'at_risk', 'critical'];

const POSITIVE_SIGNAL_KINDS = ['usage_increase', 'training_completed', 'nps_promoter'] as const;
const NEGATIVE_SIGNAL_KINDS = ['product_usage_down', 'support_spike', 'low_adoption'] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** FNV-1a. A stable number per string, so a seeded generator is reproducible. */
function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The organization a request belongs to. Mirrors the container's own resolution. */
function currentOrganizationId(db: Db): Id {
  return Object.values(db.state.users)[0]?.activeOrganizationId ?? Object.values(db.state.organizations)[0]?.id ?? 'org-vertex';
}

function readOrganizationId(query: ListQuery): Id | undefined {
  return (query as ListQuery & { organizationId?: Id }).organizationId;
}

function scopedQuery(db: Db, query: ListQuery = {}): ListQuery {
  const organizationId = readOrganizationId(query) ?? currentOrganizationId(db);
  return { ...query, organizationId } as ListQuery & { organizationId: Id };
}

function accountsInScope(db: Db, organizationId: Id): Account[] {
  return (db.all('accounts') as unknown as Account[]).filter((account) => account.organizationId === organizationId);
}

/** Whole days between an ISO value and the dataset epoch. */
function daysBeforeEpoch(value: string | undefined): number {
  if (!value) return 90;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 90;
  return Math.max(0, Math.floor((DATASET_EPOCH.getTime() - then) / 86_400_000));
}

/** Map a 0–100 score onto the shared health bands. */
function bandForScore(score: number): HealthBand {
  if (score >= 80) return 'thriving';
  if (score >= 65) return 'healthy';
  if (score >= 50) return 'watch';
  if (score >= 35) return 'at_risk';
  return 'critical';
}

function toneForBand(band: HealthBand): import('@crm/shared-types').Tone {
  switch (band) {
    case 'thriving':
      return 'green';
    case 'healthy':
      return 'teal';
    case 'watch':
      return 'amber';
    case 'at_risk':
      return 'red';
    case 'critical':
      return 'red';
    default:
      return 'slate';
  }
}

function bandLabel(band: HealthBand): string {
  switch (band) {
    case 'at_risk':
      return 'At risk';
    case 'unknown':
      return 'Unknown';
    default:
      return band.charAt(0).toUpperCase() + band.slice(1);
  }
}

/* ------------------------------------------------------------ health model */

/**
 * Build the five weighted components for an account.
 *
 * The score is a blend of the deterministic seeded base and the account's own signals, open
 * tickets and last-touch recency. Everything the number depends on is named in `rationale`.
 */
function healthComponents(account: Account, random: Random): HealthComponent[] {
  const signals = account.healthSignals ?? [];
  const positive = signals.filter((signal) => signal.sentiment === 'positive').length;
  const negative = signals.filter((signal) => signal.sentiment === 'negative').length;
  const signalDelta = positive * 6 - negative * 9;
  const openTickets = account.openTicketCount ?? 0;
  const activityGap = daysBeforeEpoch(account.lastActivityAt);
  const recencyScore = clamp(96 - Math.round(activityGap / 2), 12, 98);

  const usage = clamp(random.int(46, 92) + signalDelta, 8, 100);
  const support = clamp(97 - openTickets * 7 + positive * 3, 10, 100);
  const engagement = clamp(Math.round((recencyScore + random.int(40, 96)) / 2) + positive * 2 - negative * 3, 8, 100);
  const commercial = clamp((account.renewalDate ? 84 : 68) + signalDelta + random.int(-6, 8), 10, 100);
  const adoption = clamp(random.int(34, 90) + positive * 4 - negative * 4, 6, 100);

  return [
    {
      key: 'usage',
      label: 'Product usage',
      score: usage,
      weight: HEALTH_WEIGHTS.usage,
      rationale: `Weekly active users against licensed seats, adjusted by ${positive + negative} account signal(s).`,
      trend: random.int(-9, 14),
      direction: random.pick(['up', 'down', 'flat'] as const),
    },
    {
      key: 'support',
      label: 'Support experience',
      score: support,
      weight: HEALTH_WEIGHTS.support,
      rationale: `${openTickets} open support ticket(s) at the reference date.`,
      trend: random.int(-8, 10),
      direction: random.pick(['up', 'down', 'flat'] as const),
    },
    {
      key: 'engagement',
      label: 'Relationship engagement',
      score: engagement,
      weight: HEALTH_WEIGHTS.engagement,
      rationale: `Last recorded touch ${activityGap} day(s) before the reference date.`,
      trend: random.int(-10, 12),
      direction: random.pick(['up', 'down', 'flat'] as const),
    },
    {
      key: 'commercial',
      label: 'Commercial health',
      score: commercial,
      weight: HEALTH_WEIGHTS.commercial,
      rationale: account.renewalDate
        ? `Contract coverage through ${account.renewalDate}.`
        : 'No renewal date is recorded on the account.',
      trend: random.int(-5, 8),
      direction: random.pick(['up', 'down', 'flat'] as const),
    },
    {
      key: 'adoption',
      label: 'Feature adoption',
      score: adoption,
      weight: HEALTH_WEIGHTS.adoption,
      rationale: `Modules in routine use against modules enabled, adjusted by ${positive} positive signal(s).`,
      trend: random.int(-7, 11),
      direction: random.pick(['up', 'down', 'flat'] as const),
    },
  ];
}

function buildSignals(account: Account, random: Random): AccountHealthScore['signals'] {
  const out: AccountHealthScore['signals'] = [];

  (account.healthSignals ?? []).forEach((signal, index) => {
    const positive = signal.sentiment === 'positive';
    const negative = signal.sentiment === 'negative';
    const kind = positive
      ? POSITIVE_SIGNAL_KINDS[index % POSITIVE_SIGNAL_KINDS.length]!
      : negative
        ? NEGATIVE_SIGNAL_KINDS[index % NEGATIVE_SIGNAL_KINDS.length]!
        : 'low_adoption';
    out.push({
      id: `sig-${account.id}-${index}`,
      kind,
      label: signal.label,
      severity: negative ? 'high' : 'low',
      detectedAt: toDateTimeString(new Date(DATASET_EPOCH.getTime() - random.int(1, 30) * 86_400_000)),
      direction: positive ? 'positive' : negative ? 'negative' : 'neutral',
      suggestedAction: negative
        ? 'Schedule a check-in with the account sponsor.'
        : positive
          ? undefined
          : 'Confirm the reporting cadence with the champion.',
    });
  });

  const openTickets = account.openTicketCount ?? 0;
  if (openTickets >= 4) {
    out.push({
      id: `sig-${account.id}-tickets`,
      kind: 'support_spike',
      label: `${openTickets} open support tickets`,
      severity: 'high',
      detectedAt: toDateTimeString(DATASET_EPOCH),
      direction: 'negative',
      suggestedAction: 'Review the open incidents with the support lead.',
    });
  }

  return out;
}

/**
 * Compute a complete, explainable health score for an account.
 *
 * `computedAt` defaults to the dataset epoch so a derived score is stable in tests. A
 * recompute passes the real clock so the interface can say "recomputed just now".
 */
function buildHealthScore(db: Db, account: Account, computedAt: string = toDateTimeString(DATASET_EPOCH)): AccountHealthScore {
  const random = createRandom(hashSeed(`health:${account.id}:${DATASET_EPOCH.toISOString()}`));
  const components = healthComponents(account, random);
  const score = Math.round(components.reduce((sum, component) => sum + component.score * component.weight, 0));
  const previousScore = clamp(score + random.int(-12, 12), 0, 100);

  return {
    id: `hs-${account.id}`,
    accountId: account.id,
    accountName: account.name,
    ownerId: account.ownerId,
    ownerName: db.state.users[account.ownerId]?.displayName ?? 'Unassigned',
    score,
    band: bandForScore(score),
    previousScore,
    delta: score - previousScore,
    computedAt,
    modelLabel: 'Weighted health model (v3, demonstration)',
    components,
    signals: buildSignals(account, random),
    sentiment: score > 70 ? 'promoter' : score > 45 ? 'neutral' : 'detractor',
    renewalRiskPercent: clamp(100 - score, 2, 96),
    expansionProbabilityPercent: clamp(score - 8, 2, 94),
  };
}

/** Stored snapshots keyed by account, so a list does not recompute what the seed wrote. */
function storedHealthByAccount(db: Db): Map<Id, AccountHealthScore> {
  const map = new Map<Id, AccountHealthScore>();
  for (const record of db.all('healthScores') as unknown as AccountHealthScore[]) {
    map.set(record.accountId, record);
  }
  return map;
}

/* --------------------------------------------------------- churn and voice */

function buildChurnRows(db: Db, organizationId: Id): ChurnRiskRow[] {
  const accounts = accountsInScope(db, organizationId);
  const stored = storedHealthByAccount(db);
  const renewals = (db.all('renewals') as unknown as Renewal[]).filter((renewal) => renewal.organizationId === organizationId);
  const tickets = db.all('tickets') as unknown as Array<{ accountId?: Id; status: string }>;
  const playbooks = db.all('playbooks') as unknown as Playbook[];

  return accounts
    .map((account) => {
      const health = stored.get(account.id) ?? buildHealthScore(db, account);
      const renewal = renewals.find((candidate) => candidate.accountId === account.id);
      const openTickets = tickets.filter(
        (ticket) => ticket.accountId === account.id && ticket.status !== 'resolved' && ticket.status !== 'closed',
      ).length;
      const weakest = [...health.components].sort((a, b) => a.score - b.score)[0];
      const riskPlaybook = playbooks.find((playbook) => playbook.purpose === 'renewal') ?? playbooks.find((playbook) => playbook.purpose === 'win_back');

      return {
        accountId: account.id,
        accountName: account.name,
        ownerId: account.ownerId,
        ownerName: health.ownerName,
        healthScore: health.score,
        healthBand: health.band,
        arr: account.lifetimeValue ?? { amount: 0, currency: 'USD' },
        renewalDate: renewal?.renewalDate ?? account.renewalDate,
        riskPercent: health.renewalRiskPercent,
        primaryRiskFactor: weakest ? `${weakest.label} is the weakest component (${weakest.score}/100).` : 'No material risk identified.',
        riskFactorCount: health.signals.filter((signal) => signal.direction === 'negative').length + (renewal?.riskFactors.length ?? 0),
        monthsAsCustomer: account.contractStartDate ? Math.max(1, Math.round(daysBeforeEpoch(account.contractStartDate) / 30)) : 12,
        usageChangePercent: health.components.find((component) => component.key === 'usage')?.trend ?? 0,
        openTickets,
        sentiment: health.sentiment,
        recommendedPlaybookId: health.renewalRiskPercent >= 50 ? riskPlaybook?.id : undefined,
        recommendedPlaybookName: health.renewalRiskPercent >= 50 ? riskPlaybook?.name : undefined,
      };
    })
    .sort((a, b) => b.riskPercent - a.riskPercent);
}

/** Keyword catalogue used to turn survey comments into themes. Deterministic, not a model. */
const THEME_CATALOGUE: Array<{ label: string; keywords: string[] }> = [
  { label: 'Onboarding speed', keywords: ['onboarding', 'setup', 'kickoff', 'implementation', 'migration'] },
  { label: 'Support responsiveness', keywords: ['support', 'ticket', 'response', 'slow', 'escalation'] },
  { label: 'Reporting and analytics', keywords: ['report', 'dashboard', 'analytics', 'export', 'metric'] },
  { label: 'Performance and reliability', keywords: ['performance', 'reliable', 'outage', 'crash', 'uptime'] },
  { label: 'Pricing and value', keywords: ['price', 'pricing', 'cost', 'value', 'expensive'] },
];

function buildVoiceOfCustomer(db: Db, organizationId: Id): VoiceOfCustomerOverview {
  const surveys = (db.all('surveys') as unknown as Survey[]).filter((survey) => survey.organizationId === organizationId);
  const npsSurvey = surveys.find((survey) => survey.kind === 'nps');
  const csatSurvey = surveys.find((survey) => survey.kind === 'csat');
  const cesSurvey = surveys.find((survey) => survey.kind === 'ces');

  const npsResponses = npsSurvey?.responses ?? [];
  const promoters = npsResponses.filter((response) => response.score >= 9).length;
  const detractors = npsResponses.filter((response) => response.score <= 6).length;
  const passives = Math.max(0, npsResponses.length - promoters - detractors);

  const npsScoreFromResponses = npsResponses.length > 0 ? Math.round(((promoters - detractors) / npsResponses.length) * 100) : 0;

  const segmentMap = new Map<string, { score: number; responses: number }>();
  for (const response of npsResponses) {
    const label = response.agentName ?? response.contactLabel ?? 'Unassigned';
    const entry = segmentMap.get(label) ?? { score: 0, responses: 0 };
    entry.score += response.score >= 9 ? 100 : response.score <= 6 ? 0 : 50;
    entry.responses += 1;
    segmentMap.set(label, entry);
  }

  const csatResponses = csatSurvey?.responses ?? [];
  const distribution = [1, 2, 3, 4, 5].map((score) => ({ score, count: csatResponses.filter((response) => Math.round(response.score) === score).length }));

  const comments = npsResponses
    .filter((response) => typeof response.comment === 'string' && response.comment.trim().length > 0)
    .map((response) => ({
      id: response.id,
      score: response.score,
      category: (response.score >= 9 ? 'promoter' : response.score <= 6 ? 'detractor' : 'passive') as 'promoter' | 'passive' | 'detractor',
      comment: response.comment!.trim(),
      accountLabel: response.contactLabel ?? 'Customer',
      submittedAt: response.submittedAt,
    }));

  const allComments = surveys.flatMap((survey) => survey.responses).filter((response) => typeof response.comment === 'string' && response.comment!.trim().length > 0);

  const themes = THEME_CATALOGUE.map((theme) => {
    const matches = allComments.filter((response) => {
      const text = response.comment!.toLowerCase();
      return theme.keywords.some((keyword) => text.includes(keyword));
    });
    const average = matches.length > 0 ? matches.reduce((sum, response) => sum + response.score, 0) / matches.length : 0;
    const random = createRandom(hashSeed(`theme:${organizationId}:${theme.label}`));
    return {
      label: theme.label,
      mentions: matches.length,
      sentiment: (average >= 8 ? 'positive' : average >= 5 ? 'neutral' : 'negative') as 'positive' | 'neutral' | 'negative',
      changePercent: random.int(-24, 38),
      sampleComments: matches.slice(0, 2).map((response) => response.comment!.trim()),
    };
  })
    .filter((theme) => theme.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);

  return {
    periodLabel: 'Last 90 days',
    nps: {
      score: npsSurvey?.npsScore ?? npsScoreFromResponses,
      responses: npsResponses.length,
      responseRate: npsSurvey?.responseRate ?? 0,
      promoters,
      passives,
      detractors,
      previousScore: Math.max(-100, Math.min(100, (npsSurvey?.npsScore ?? npsScoreFromResponses) - 6)),
      trend: (npsSurvey?.trend ?? []).map((point) => ({
        date: point.date,
        score: Math.round(point.average * 10),
        responses: point.responses,
      })),
      bySegment: [...segmentMap.entries()].map(([label, entry]) => ({
        label,
        score: entry.responses > 0 ? Math.round(entry.score / entry.responses) : 0,
        responses: entry.responses,
      })),
      comments,
    },
    csat: {
      score: csatSurvey?.averageScore ?? 0,
      responses: csatResponses.length,
      trend: (csatSurvey?.trend ?? []).map((point) => ({ date: point.date, score: point.average, responses: point.responses })),
      distribution,
    },
    ces: cesSurvey ? { score: cesSurvey.averageScore, responses: cesSurvey.responseCount } : undefined,
    themes,
  };
}

/* --------------------------------------------------------------- overview */

function buildOverview(db: Db, organizationId: Id): CustomerSuccessOverview {
  const organization = db.state.organizations[organizationId];
  const currency = organization?.defaultCurrency ?? 'USD';
  const accounts = accountsInScope(db, organizationId);
  const stored = storedHealthByAccount(db);
  const health = accounts.map((account) => stored.get(account.id) ?? buildHealthScore(db, account));
  const renewals = (db.all('renewals') as unknown as Renewal[]).filter((renewal) => renewal.organizationId === organizationId);
  const onboarding = (db.all('onboardingPlans') as unknown as OnboardingPlan[]).filter((plan) => plan.organizationId === organizationId);
  const reviews = (db.all('businessReviews') as unknown as BusinessReview[]).filter((review) => review.organizationId === organizationId);
  const portfolios = (db.all('portfolios') as unknown as SuccessPortfolio[]).filter((portfolio) => portfolio.organizationId === organizationId);

  const totalArr = accounts.reduce((sum, account) => sum + (account.lifetimeValue?.amount ?? 0), 0);
  const averageHealthScore = health.length > 0 ? Math.round(health.reduce((sum, row) => sum + row.score, 0) / health.length) : 0;
  const accountsAtRisk = health.filter((row) => row.band === 'at_risk' || row.band === 'critical').length;

  const recurring = renewals.filter((renewal) => renewal.termMonths > 0);
  const baseValue = recurring.reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);
  const retained = recurring.filter((renewal) => renewal.changeKind !== 'churn');
  const retainedValue = retained.reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);
  const expansionValue = recurring
    .filter((renewal) => renewal.changeKind === 'expansion')
    .reduce((sum, renewal) => sum + Math.max(0, renewal.changeAmount.amount), 0);
  const contractionValue = recurring
    .filter((renewal) => renewal.changeKind === 'contraction')
    .reduce((sum, renewal) => sum + Math.abs(Math.min(0, renewal.changeAmount.amount)), 0);
  const grr = baseValue > 0 ? clamp(Math.round((retainedValue / baseValue) * 1000) / 10, 0, 100) : 0;
  const nrr = baseValue > 0 ? clamp(Math.round(((retainedValue + expansionValue - contractionValue) / baseValue) * 1000) / 10, 0, 140) : 0;
  const logoRetentionPercent = recurring.length > 0 ? Math.round((retained.length / recurring.length) * 1000) / 10 : 0;

  const due90 = renewals.filter((renewal) => renewal.daysUntilRenewal >= 0 && renewal.daysUntilRenewal <= 90);
  const valueDue90 = due90.reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);

  const timeToValueSamples = onboarding
    .map((plan) => plan.timeToFirstValueDays)
    .filter((value): value is number => typeof value === 'number');
  const timeToValueDays = timeToValueSamples.length > 0 ? Math.round(timeToValueSamples.reduce((sum, value) => sum + value, 0) / timeToValueSamples.length) : 0;

  const healthDistribution = GUARDED_BANDS.map((band) => {
    const rows = health.filter((row) => row.band === band);
    const arr = accounts
      .filter((account) => rows.some((row) => row.accountId === account.id))
      .reduce((sum, account) => sum + (account.lifetimeValue?.amount ?? 0), 0);
    return { band, label: bandLabel(band), count: rows.length, arr, tone: toneForBand(band) };
  });

  const countBands = (band: HealthBand) => health.filter((row) => row.band === band).length;
  const healthTrend = Array.from({ length: 8 }, (_, index) => {
    const date = toDateString(new Date(DATASET_EPOCH.getTime() - (7 - index) * 7 * 86_400_000));
    const factor = 0.85 + (index / 7) * 0.15;
    const jitter = (band: HealthBand) => createRandom(hashSeed(`trend:${organizationId}:${band}:${index}`)).int(-2, 2);
    return {
      date,
      thriving: Math.max(0, Math.round(countBands('thriving') * factor + jitter('thriving'))),
      healthy: Math.max(0, Math.round(countBands('healthy') * factor + jitter('healthy'))),
      watch: Math.max(0, Math.round(countBands('watch') * factor + jitter('watch'))),
      atRisk: Math.max(0, Math.round(countBands('at_risk') * factor + jitter('at_risk'))),
      critical: Math.max(0, Math.round(countBands('critical') * factor + jitter('critical'))),
    };
  });

  const renewalsByMonth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(DATASET_EPOCH.getUTCFullYear(), DATASET_EPOCH.getUTCMonth() + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const inMonth = renewals.filter((renewal) => renewal.renewalDate.slice(0, 7) === key);
    return {
      month: `${date.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${String(date.getUTCFullYear()).slice(2)}`,
      count: inMonth.length,
      value: inMonth.reduce((sum, renewal) => sum + renewal.currentValue.amount, 0),
      atRiskValue: inMonth
        .filter((renewal) => renewal.healthBand === 'at_risk' || renewal.healthBand === 'critical')
        .reduce((sum, renewal) => sum + renewal.currentValue.amount, 0),
    };
  });

  const portfolioPerformance = portfolios.map((portfolio) => {
    const members = portfolio.accountIds
      .map((accountId) => health.find((row) => row.accountId === accountId))
      .filter((row): row is AccountHealthScore => Boolean(row));
    return {
      portfolioId: portfolio.id,
      name: portfolio.name,
      ownerName: portfolio.ownerName,
      accounts: members.length,
      averageHealth: members.length > 0 ? Math.round(members.reduce((sum, row) => sum + row.score, 0) / members.length) : 0,
      arr: accounts
        .filter((account) => portfolio.accountIds.includes(account.id))
        .reduce((sum, account) => sum + (account.lifetimeValue?.amount ?? 0), 0),
      atRisk: members.filter((row) => row.band === 'at_risk' || row.band === 'critical').length,
      renewals90: renewals.filter(
        (renewal) => portfolio.accountIds.includes(renewal.accountId) && renewal.daysUntilRenewal >= 0 && renewal.daysUntilRenewal <= 90,
      ).length,
    };
  });

  const owners = new Map<Id, AccountHealthScore[]>();
  for (const row of health) {
    const list = owners.get(row.ownerId) ?? [];
    list.push(row);
    owners.set(row.ownerId, list);
  }

  const successManagerPerformance = [...owners.entries()]
    .map(([userId, rows]) => {
      const ownerRenewals = renewals.filter((renewal) => renewal.ownerId === userId);
      const ownerBase = ownerRenewals.reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);
      const ownerRetained = ownerRenewals
        .filter((renewal) => renewal.changeKind !== 'churn')
        .reduce((sum, renewal) => sum + renewal.currentValue.amount, 0);
      const npsRandom = createRandom(hashSeed(`nps:${userId}`));
      return {
        userId,
        name: db.state.users[userId]?.displayName ?? 'Unassigned',
        portfolios: portfolios.filter((portfolio) => portfolio.ownerId === userId).length,
        accounts: rows.length,
        averageHealth: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
        reviewsCompleted: reviews.filter((review) => review.ownerId === userId && review.status === 'completed').length,
        renewalsWon: ownerRenewals.filter((renewal) => renewal.stage === 'won').length,
        nrr: ownerBase > 0 ? clamp(Math.round((ownerRetained / ownerBase) * 1000) / 10, 0, 140) : 0,
        nps: npsRandom.int(-20, 72),
      };
    })
    .sort((a, b) => b.accounts - a.accounts);

  const churnReasonMap = new Map<string, { reason: string; count: number; arrLost: number }>();
  for (const renewal of renewals) {
    if (renewal.changeKind !== 'churn' && renewal.changeKind !== 'contraction') continue;
    const reason = renewal.riskFactors.find((factor) => factor.severity === 'high')?.label ?? renewal.riskFactors[0]?.label ?? 'Reason not recorded';
    const entry = churnReasonMap.get(reason) ?? { reason, count: 0, arrLost: 0 };
    entry.count += 1;
    entry.arrLost += Math.abs(Math.min(0, renewal.changeAmount.amount));
    churnReasonMap.set(reason, entry);
  }
  const churnReasons = [...churnReasonMap.values()].sort((a, b) => b.arrLost - a.arrLost);

  const expansionKinds = ['upsell', 'cross_sell', 'seat_expansion', 'tier_upgrade', 'module_add'] as const;
  const expansionOpportunities = health
    .filter((row) => row.expansionProbabilityPercent >= 58)
    .sort((a, b) => b.expansionProbabilityPercent - a.expansionProbabilityPercent)
    .slice(0, 8)
    .map((row, index) => {
      const account = accounts.find((candidate) => candidate.id === row.accountId);
      const strongest = [...row.components].sort((a, b) => b.score - a.score)[0];
      return {
        id: `exp-${row.accountId}`,
        accountId: row.accountId,
        accountName: row.accountName,
        kind: expansionKinds[index % expansionKinds.length]!,
        estimatedValue: { amount: Math.round((account?.lifetimeValue?.amount ?? 0) * 0.22), currency },
        probability: row.expansionProbabilityPercent,
        ownerName: row.ownerName,
        rationale: `Health ${row.score}/100 with ${row.sentiment} sentiment; ${strongest?.label ?? 'product usage'} is the strongest component.`,
        identifiedAt: row.computedAt,
      };
    });

  const enabledModules = new Set(organization?.enabledModuleKeys ?? []);
  const adoptionRandom = createRandom(hashSeed(`adoption:${organizationId}`));
  const featureCatalogue: Array<{ featureKey: string; label: string; moduleKey: string }> = [
    { featureKey: 'pipeline_automation', label: 'Pipeline automation', moduleKey: 'deals' },
    { featureKey: 'email_sequences', label: 'Email sequences', moduleKey: 'campaigns' },
    { featureKey: 'reporting', label: 'Reporting and dashboards', moduleKey: 'analytics' },
    { featureKey: 'integrations', label: 'Integrations', moduleKey: 'integrations' },
    { featureKey: 'portal', label: 'Customer portal', moduleKey: 'portal' },
    { featureKey: 'workflow_rules', label: 'Workflow rules', moduleKey: 'workflows' },
  ];
  const byFeature = featureCatalogue.map((feature) => ({
    featureKey: feature.featureKey,
    label: feature.label,
    adoptionPercent: enabledModules.has(feature.moduleKey)
      ? clamp(Math.round(averageHealthScore * 0.7 + adoptionRandom.int(5, 30)), 5, 98)
      : clamp(adoptionRandom.int(2, 12), 1, 20),
    trend: adoptionRandom.int(-6, 12),
  }));

  const cohorts = ['Week 0', 'Week 2', 'Week 4', 'Week 6', 'Week 8', 'Week 12'].map((cohortLabel, index) => ({
    cohortLabel,
    size: Math.max(2, Math.round(accounts.length / (index + 2))),
    values: Array.from({ length: 6 }, (_, week) =>
      clamp(Math.round(100 - week * 3 - index * 2 + createRandom(hashSeed(`cohort:${organizationId}:${index}:${week}`)).int(-3, 3)), 40, 100),
    ),
  }));

  return {
    currency,
    periodLabel: 'Trailing 90 days',
    metrics: {
      totalAccounts: accounts.length,
      accountsAtRisk,
      averageHealthScore,
      arr: { amount: totalArr, currency },
      nrr,
      grr,
      logoRetentionPercent,
      renewalsDue90Days: due90.length,
      renewalsDue90DaysValue: { amount: valueDue90, currency },
      completedReviews: reviews.filter((review) => review.status === 'completed').length,
      overdueReviews: reviews.filter((review) => review.status === 'scheduled' && new Date(review.scheduledAt).getTime() < DATASET_EPOCH.getTime()).length,
      timeToValueDays,
      onboardingOnTrack: onboarding.filter((plan) => plan.status === 'in_progress' || plan.status === 'completed').length,
      onboardingAtRisk: onboarding.filter((plan) => plan.status === 'blocked' || plan.status === 'paused').length,
    },
    healthDistribution,
    healthTrend,
    renewalsByMonth,
    portfolioPerformance,
    successManagerPerformance,
    churnReasons,
    expansionOpportunities,
    adoption: {
      averageFeatureAdoptionPercent:
        byFeature.length > 0 ? Math.round(byFeature.reduce((sum, feature) => sum + feature.adoptionPercent, 0) / byFeature.length) : 0,
      byFeature,
      cohorts,
    },
  };
}

/* --------------------------------------------------------------- services */

export function makeCustomerSuccessService(db: Db): ServiceContainer['customerSuccess'] {
  const portfoliosCrud = createCrud<SuccessPortfolio>(db, 'portfolios', {
    label: 'Portfolio',
    searchFields: ['name', 'ownerName', 'description'],
    facetField: 'segment',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });
  const successPlansCrud = createCrud<SuccessPlan>(db, 'successPlans', {
    label: 'Success plan',
    searchFields: ['name', 'accountName', 'ownerName'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });
  const onboardingCrud = createCrud<OnboardingPlan>(db, 'onboardingPlans', {
    label: 'Onboarding plan',
    searchFields: ['accountName', 'managerName', 'templateName'],
    facetField: 'status',
    defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
  });
  const renewalsCrud = createCrud<Renewal>(db, 'renewals', {
    label: 'Renewal',
    searchFields: ['accountName', 'contractReference', 'ownerName'],
    facetField: 'stage',
    defaultSort: [{ field: 'daysUntilRenewal', direction: 'asc' }],
  });
  const reviewsCrud = createCrud<BusinessReview>(db, 'businessReviews', {
    label: 'Business review',
    searchFields: ['accountName', 'ownerName'],
    facetField: 'status',
    defaultSort: [{ field: 'scheduledAt', direction: 'asc' }],
  });

  return {
    overview: async (query = {}) => {
      const organizationId = readOrganizationId(query) ?? currentOrganizationId(db);
      await delay(`cs-overview:${organizationId}`, { latency: { min: 160, max: 380 } });
      return ok(buildOverview(db, organizationId));
    },

    healthScores: async (query = {}) => {
      const organizationId = readOrganizationId(query) ?? currentOrganizationId(db);
      const accounts = accountsInScope(db, organizationId);
      const stored = storedHealthByAccount(db);
      const rows = accounts.map((account) => stored.get(account.id) ?? buildHealthScore(db, account));
      await delay(`cs-health:${organizationId}`, { latency: { min: 70, max: 220 } });
      return runQuery(rows, query, {
        searchFields: ['accountName', 'ownerName'],
        facetField: 'band',
        defaultSort: [{ field: 'score', direction: 'asc' }],
      });
    },

    healthScore: async (accountId) => {
      await delay(`cs-health-account:${accountId}`, { latency: { min: 60, max: 180 } });
      const stored = db.state.healthScores[`hs-${accountId}`] ?? Object.values(db.state.healthScores).find((record) => record.accountId === accountId);
      if (stored) return ok(stored);
      const account = db.state.accounts[accountId];
      if (!account) return err<AccountHealthScore>('not_found', 'No health score or account exists for that id.');
      return ok(buildHealthScore(db, account));
    },

    recomputeHealth: async (accountIds) => {
      await delay('cs-recompute', { latency: { min: 220, max: 520 } });
      const failures: Array<{ id: Id; reason: string }> = [];
      const records: AccountHealthScore[] = [];
      for (const id of accountIds) {
        const account = db.state.accounts[id];
        if (!account) {
          failures.push({ id, reason: 'Account not found' });
          continue;
        }
        records.push(buildHealthScore(db, account, new Date().toISOString()));
      }
      if (records.length > 0) db.putMany('healthScores', records as never);
      return ok({ requested: accountIds.length, succeeded: records.length, failed: failures.length, failures });
    },

    portfolios: (query) => portfoliosCrud.list(scopedQuery(db, query)),

    successPlans: (query) => successPlansCrud.list(scopedQuery(db, query)),

    updateObjective: async (planId, objectiveId, patch) => {
      await delay(`cs-objective:${planId}`);
      const plan = db.state.successPlans[planId];
      if (!plan) return err<SuccessPlan>('not_found', 'Success plan not found.');
      let found = false;
      const objectives = plan.objectives.map((objective) => {
        if (objective.id !== objectiveId) return objective;
        found = true;
        return { ...objective, ...patch, id: objective.id };
      });
      if (!found) return err<SuccessPlan>('not_found', 'That objective is not on this plan.');
      const overallProgress = Math.round(objectives.reduce((sum, objective) => sum + objective.progressPercent, 0) / Math.max(1, objectives.length));
      const updated: SuccessPlan = { ...plan, objectives, overallProgress, updatedAt: new Date().toISOString() };
      db.put('successPlans', updated as never);
      return ok(updated);
    },

    onboardingPlans: (query) => onboardingCrud.list(scopedQuery(db, query)),

    updateOnboardingTask: async (planId, taskId, patch) => {
      await delay(`cs-onboarding-task:${planId}`);
      const plan = db.state.onboardingPlans[planId];
      if (!plan) return err<OnboardingPlan>('not_found', 'Onboarding plan not found.');
      let found = false;
      const phases = plan.phases.map((phase) => {
        const tasks = phase.tasks.map((task) => {
          if (task.id !== taskId) return task;
          found = true;
          const merged: OnboardingTask = { ...task, ...patch, id: task.id };
          if (merged.status === 'completed' && !merged.completedAt) merged.completedAt = new Date().toISOString();
          if (merged.status !== 'completed') merged.completedAt = undefined;
          return merged;
        });
        const completed = tasks.filter((task) => task.status === 'completed').length;
        const progressPercent = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : phase.progressPercent;
        const status: OnboardingPlan['phases'][number]['status'] =
          tasks.length > 0 && completed === tasks.length
            ? 'completed'
            : tasks.some((task) => task.status === 'blocked')
              ? 'blocked'
              : tasks.some((task) => task.status !== 'not_started')
                ? 'in_progress'
                : 'not_started';
        return { ...phase, tasks, progressPercent, status };
      });
      if (!found) return err<OnboardingPlan>('not_found', 'That task is not on this plan.');
      const progressPercent = Math.round(phases.reduce((sum, phase) => sum + phase.progressPercent, 0) / Math.max(1, phases.length));
      const status: OnboardingPlan['status'] =
        progressPercent >= 100 ? 'completed' : plan.status === 'blocked' ? 'blocked' : plan.status === 'paused' ? 'paused' : 'in_progress';
      const updated: OnboardingPlan = { ...plan, phases, progressPercent, status, updatedAt: new Date().toISOString() };
      db.put('onboardingPlans', updated as never);
      return ok(updated);
    },

    renewals: (query) => renewalsCrud.list(scopedQuery(db, query)),

    updateRenewal: (id, patch) => renewalsCrud.update(id, patch),

    churnRisk: async (query = {}) => {
      const organizationId = readOrganizationId(query) ?? currentOrganizationId(db);
      const rows = buildChurnRows(db, organizationId);
      await delay(`cs-churn:${organizationId}`, { latency: { min: 90, max: 240 } });
      return runQuery(rows, query, {
        searchFields: ['accountName', 'ownerName', 'primaryRiskFactor'],
        facetField: 'healthBand',
        defaultSort: [{ field: 'riskPercent', direction: 'desc' }],
      });
    },

    businessReviews: (query) => reviewsCrud.list(scopedQuery(db, query)),

    voiceOfCustomer: async () => {
      const organizationId = currentOrganizationId(db);
      await delay(`cs-voc:${organizationId}`, { latency: { min: 200, max: 420 } });
      return ok(buildVoiceOfCustomer(db, organizationId));
    },
  };
}

/* -------------------------------------------------------------- playbooks */

function firstUserForOrganization(db: Db, organizationId: Id) {
  return (
    Object.values(db.state.users).find(
      (user) => user.activeOrganizationId === organizationId || user.organizationIds?.includes(organizationId),
    ) ?? Object.values(db.state.users)[0]
  );
}

export function makePlaybooksService(db: Db): ServiceContainer['playbooks'] {
  const crud = createCrud<Playbook>(db, 'playbooks', {
    label: 'Playbook',
    searchFields: ['name', 'description'],
    facetField: 'purpose',
    defaultSort: [{ field: 'name', direction: 'asc' }],
  });

  return {
    list: (query) => crud.list(scopedQuery(db, query)),
    get: (id) => crud.get(id),
    create: (input, options) => crud.create(input, options),
    update: (id, input, options) => crud.update(id, input, options),
    remove: (id, options) => crud.remove(id, options),
    bulkRemove: (ids, options) => crud.bulkRemove(ids, options),

    /**
     * Apply a playbook to a target record.
     *
     * This creates one real task per step that is marked `createsTask`, stored in the local
     * `activities` collection so the My Work planner genuinely sees them. Nothing is emailed,
     * scheduled or sent to a workflow engine, and the returned count is the honest number of
     * local records written.
     */
    apply: async (playbookId, target) => {
      await delay(`playbook-apply:${playbookId}`, { latency: { min: 240, max: 560 } });
      const playbook = db.state.playbooks[playbookId];
      if (!playbook) return err<{ tasksCreated: number }>('not_found', 'Playbook not found.');

      const owner = firstUserForOrganization(db, playbook.organizationId);
      const now = new Date().toISOString();
      const subjects: ActivitySubject[] = [{ type: target.type as ActivitySubject['type'], id: target.id, label: 'Linked record' }];

      const tasks: Task[] = playbook.steps
        .filter((step) => step.createsTask)
        .map((step) => ({
          id: nextId('task'),
          organizationId: playbook.organizationId,
          kind: 'task',
          subject: `${playbook.name}: ${step.title}`,
          subjects,
          body: step.guidance,
          status: 'open',
          priority: step.required ? 'high' : 'normal',
          ownerId: owner?.id ?? 'unassigned',
          ownerName: owner?.displayName ?? 'Unassigned',
          dueAt: toDateTimeString(addDays(DATASET_EPOCH, step.taskDueOffsetDays ?? 3)),
          visibility: 'team',
          tags: ['playbook', playbook.purpose],
          source: 'user',
          isBlocked: false,
          templateId: playbook.id,
          createdAt: now,
          updatedAt: now,
        }));

      if (tasks.length > 0) db.putMany('activities', tasks as never);
      const updated: Playbook = { ...playbook, timesUsed: playbook.timesUsed + 1, updatedAt: now };
      db.put('playbooks', updated as never);
      return ok({ tasksCreated: tasks.length });
    },
  };
}

/** Exposed for the screen layer so band wording and tone stay in one place. */
export { bandForScore, bandLabel, toneForBand, HEALTH_WEIGHTS };
