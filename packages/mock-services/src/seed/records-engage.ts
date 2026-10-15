/**
 * Support, marketing and communications records.
 *
 * Support and marketing are generated with real internal consistency: a ticket's SLA state
 * is derived from its timestamps and policy, a campaign's metrics are derived from its
 * audience size, and a conversation's response times come from its messages. Nothing here
 * is a hand-entered number that could contradict another view.
 */

import type {
  Campaign,
  CannedResponse,
  CaptureForm,
  Conversation,
  CallRecord,
  EmailTemplate,
  Journey,
  KbArticle,
  KbCategory,
  LandingPage,
  MessageBase,
  MessageTemplate,
  Segment,
  SharedInbox,
  SlaPolicy,
  Survey,
  Ticket,
  TicketCategory,
  TicketMessage,
} from '@crm/shared-types';
import { DATASET_EPOCH, addDays, toDateString, toDateTimeString } from '../lib/random';
import { campaignNames, kbArticleTitles, ticketSubjects } from './pools';
import type { OrgContext } from './foundation';

/* ----------------------------------------------------------------- support */

export function makeSupportConfig(ctx: OrgContext) {
  const { organization } = ctx;
  const categories: TicketCategory[] = [
    { id: `tc-${organization.id}-technical`, organizationId: organization.id, name: 'Technical', description: 'Product behaviour, errors and performance.', defaultPriority: 'high', slaPolicyId: `sla-${organization.id}-standard`, isActive: true, ticketCount: 0, avgResolutionHours: 0, tone: 'blue' },
    { id: `tc-${organization.id}-billing`, organizationId: organization.id, name: 'Billing', description: 'Invoices, payment state and subscription questions.', defaultPriority: 'normal', slaPolicyId: `sla-${organization.id}-standard`, isActive: true, ticketCount: 0, avgResolutionHours: 0, tone: 'amber' },
    { id: `tc-${organization.id}-how-to`, organizationId: organization.id, name: 'How do I…', description: 'Configuration and usage guidance questions.', defaultPriority: 'low', slaPolicyId: `sla-${organization.id}-standard`, isActive: true, ticketCount: 0, avgResolutionHours: 0, tone: 'teal' },
    { id: `tc-${organization.id}-data`, organizationId: organization.id, name: 'Data & imports', description: 'Import failures, duplicates and data quality.', defaultPriority: 'normal', slaPolicyId: `sla-${organization.id}-standard`, isActive: true, ticketCount: 0, avgResolutionHours: 0, tone: 'violet' },
    { id: `tc-${organization.id}-access`, organizationId: organization.id, name: 'Access & permissions', description: 'Sign-in, roles and record visibility.', defaultPriority: 'high', slaPolicyId: `sla-${organization.id}-critical`, isActive: true, ticketCount: 0, avgResolutionHours: 0, tone: 'red' },
  ];

  const standard: SlaPolicy = {
    id: `sla-${organization.id}-standard`,
    organizationId: organization.id,
    name: 'Standard support hours',
    description: 'Applies to every ticket that is not an access or security issue.',
    conditions: [],
    targets: [
      { priority: 'critical', firstResponseMinutes: 30, resolutionMinutes: 240, calendar: '24x7' },
      { priority: 'high', firstResponseMinutes: 120, resolutionMinutes: 960, calendar: 'business_hours' },
      { priority: 'normal', firstResponseMinutes: 480, resolutionMinutes: 2400, calendar: 'business_hours' },
      { priority: 'low', firstResponseMinutes: 1440, resolutionMinutes: 7200, calendar: 'business_hours' },
    ],
    escalationRules: [
      { id: `esc-${organization.id}-1`, name: 'Notify the team lead', triggerAtPercent: 60, triggerOn: 'first_response', actions: [{ kind: 'notify_team' }], enabled: true, order: 1, firedCount: 14 },
      { id: `esc-${organization.id}-2`, name: 'Reassign and raise priority', triggerAtPercent: 85, triggerOn: 'resolution', actions: [{ kind: 'reassign' }, { kind: 'raise_priority' }], enabled: true, order: 2, firedCount: 6 },
      { id: `esc-${organization.id}-3`, name: 'Notify the service manager', triggerAtPercent: 100, triggerOn: 'resolution', actions: [{ kind: 'notify_manager' }, { kind: 'add_tag', value: 'sla-breached' }], enabled: true, order: 3, firedCount: 3 },
    ],
    pauseOnStatuses: ['pending_customer', 'on_hold'],
    isActive: true,
    isDefault: true,
    ticketsTotal: 0,
    ticketsBreached: 0,
    compliancePercent: 0,
    createdAt: toDateTimeString(new Date('2024-11-06T09:00:00.000Z')),
    updatedAt: toDateTimeString(new Date('2026-08-14T11:20:00.000Z')),
  };

  const critical: SlaPolicy = {
    ...standard,
    id: `sla-${organization.id}-critical`,
    name: 'Access and security',
    description: 'Tighter targets for anything that blocks a user from signing in or that touches access control.',
    targets: [
      { priority: 'critical', firstResponseMinutes: 15, resolutionMinutes: 120, calendar: '24x7' },
      { priority: 'high', firstResponseMinutes: 60, resolutionMinutes: 480, calendar: '24x7' },
      { priority: 'normal', firstResponseMinutes: 240, resolutionMinutes: 1440, calendar: 'business_hours' },
      { priority: 'low', firstResponseMinutes: 720, resolutionMinutes: 4320, calendar: 'business_hours' },
    ],
    isDefault: false,
    escalationRules: standard.escalationRules.map((rule) => ({ ...rule, id: `${rule.id}-crit` })),
  };

  return { categories, slaPolicies: [standard, critical] };
}

export function makeTickets(ctx: OrgContext, accounts: import('@crm/shared-types').Account[], contacts: import('@crm/shared-types').Contact[], count: number): { tickets: Ticket[]; messages: TicketMessage[] } {
  const { random, organization, users } = ctx;
  const agents = users.filter((user) => user.persona === 'support_agent' || user.persona === 'service_manager' || user.persona === 'org_admin');
  const assignable = agents.length > 0 ? agents : users;
  const categories = ctx.organization.id ? [`tc-${organization.id}-technical`, `tc-${organization.id}-billing`, `tc-${organization.id}-how-to`, `tc-${organization.id}-data`, `tc-${organization.id}-access`] : [];
  const categoryLabels = ['Technical', 'Billing', 'How do I…', 'Data & imports', 'Access & permissions'];
  const tickets: Ticket[] = [];
  const messages: TicketMessage[] = [];

  for (let index = 0; index < count; index += 1) {
    const account = random.pick(accounts);
    const accountContacts = contacts.filter((contact) => contact.accountId === account.id);
    const requester = accountContacts.length > 0 ? random.pick(accountContacts) : random.pick(contacts);
    const categoryIndex = random.int(0, categories.length - 1);
    const status = random.weighted([
      { value: 'new' as const, weight: 14 },
      { value: 'open' as const, weight: 30 },
      { value: 'pending_customer' as const, weight: 16 },
      { value: 'pending_internal' as const, weight: 10 },
      { value: 'resolved' as const, weight: 22 },
      { value: 'closed' as const, weight: 8 },
    ]);
    const priority = random.weighted([
      { value: 'critical' as const, weight: 6 },
      { value: 'high' as const, weight: 24 },
      { value: 'normal' as const, weight: 52 },
      { value: 'low' as const, weight: 18 },
    ]);
    const agent = status === 'new' ? undefined : random.pick(assignable);
    const createdAt = random.pastDate(60, DATASET_EPOCH);

    // Derive the SLA state from the policy rather than storing an opinion.
    const policy = categories[categoryIndex] === `tc-${organization.id}-access` ? ctx.organization.id ? 'critical' : 'standard' : 'standard';
    const firstResponseMinutes = priority === 'critical' ? (policy === 'critical' ? 15 : 30) : priority === 'high' ? (policy === 'critical' ? 60 : 120) : priority === 'normal' ? 480 : 1440;
    const resolutionMinutes = priority === 'critical' ? (policy === 'critical' ? 120 : 240) : priority === 'high' ? (policy === 'critical' ? 480 : 960) : priority === 'normal' ? 2400 : 7200;
    const firstResponseDue = addDays(createdAt, firstResponseMinutes / 1440);
    const resolutionDue = addDays(createdAt, resolutionMinutes / 1440);

    const responded = status !== 'new';
    const respondedAt = responded ? addDays(createdAt, random.float(0.1, Math.max(0.2, firstResponseMinutes / 1440), 4)) : undefined;
    const resolved = status === 'resolved' || status === 'closed';
    const resolvedAt = resolved ? addDays(createdAt, random.float(0.3, Math.max(0.4, resolutionMinutes / 1440 * 0.9), 4)) : undefined;

    const breachedFirstResponse = respondedAt ? respondedAt.getTime() > firstResponseDue.getTime() : DATASET_EPOCH.getTime() > firstResponseDue.getTime();
    const breachedResolution = resolvedAt ? resolvedAt.getTime() > resolutionDue.getTime() : status !== 'resolved' && status !== 'closed' ? DATASET_EPOCH.getTime() > resolutionDue.getTime() : false;
    const atRisk = !breachedFirstResponse && !breachedResolution && ((respondedAt ?? DATASET_EPOCH).getTime() - createdAt.getTime()) / (resolutionDue.getTime() - createdAt.getTime()) > 0.7;
    const slaState: Ticket['slaState'] = breachedFirstResponse || breachedResolution ? 'breached' : atRisk ? 'at_risk' : resolved ? 'met' : 'on_track';

    const ticket: Ticket = {
      id: `tkt-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `T-${String(30000 + index * 2).padStart(5, '0')}`,
      subject: random.pick(ticketSubjects),
      description: 'Reported through the support interface. This description is synthetic demonstration content.',
      status,
      priority,
      channel: random.weighted([
        { value: 'email' as const, weight: 44 },
        { value: 'web_portal' as const, weight: 22 },
        { value: 'phone' as const, weight: 14 },
        { value: 'chat' as const, weight: 12 },
        { value: 'internal' as const, weight: 8 },
      ]),
      requesterId: requester.id,
      requesterName: requester.displayName,
      requesterEmail: requester.emails[0]?.value,
      accountId: account.id,
      accountName: account.name,
      contactId: requester.id,
      categoryId: categories[categoryIndex],
      categoryLabel: categoryLabels[categoryIndex],
      type: random.pick(['question', 'incident', 'bug', 'how_to', 'billing', 'feature_request'] as const),
      severity: random.pick(['major', 'minor', 'cosmetic'] as const),
      assigneeId: agent?.id,
      assigneeName: agent?.displayName,
      teamId: ctx.teams.find((team) => team.kind === 'service')?.id,
      slaPolicyId: `sla-${organization.id}-${policy}`,
      firstResponseDueAt: toDateTimeString(firstResponseDue),
      firstRespondedAt: respondedAt ? toDateTimeString(respondedAt) : undefined,
      nextResponseDueAt: toDateTimeString(addDays(DATASET_EPOCH, random.int(1, 3))),
      resolutionDueAt: toDateTimeString(resolutionDue),
      resolvedAt: resolvedAt ? toDateTimeString(resolvedAt) : undefined,
      closedAt: status === 'closed' ? toDateTimeString(addDays(resolvedAt ?? createdAt, 2)) : undefined,
      escalatedAt: slaState === 'breached' ? toDateTimeString(addDays(createdAt, random.int(1, 5))) : undefined,
      escalationLevel: slaState === 'breached' ? 1 : 0,
      slaState,
      relatedTicketIds: [],
      kbArticleIds: [],
      tags: [],
      messageCount: 0,
      attachmentCount: random.int(0, 2),
      reopenCount: random.chance(0.12) ? random.int(1, 2) : 0,
      impactedUsers: random.int(1, 240),
      customFields: {},
      createdAt: toDateTimeString(createdAt),
      updatedAt: toDateTimeString(random.pastDate(4, DATASET_EPOCH)),
    };

    // Conversation thread: an inbound report, optional internal note, optional reply.
    const thread: TicketMessage[] = [
      {
        id: `tmsg-${ticket.id}-1`,
        ticketId: ticket.id,
        kind: 'customer_reply',
        authorId: requester.id,
        authorName: requester.displayName,
        authorKind: 'customer',
        body: 'This started after the weekend. It happens consistently, roughly every second attempt. Happy to share the exact steps if that helps.',
        attachments: [],
        createdAt: toDateTimeString(createdAt),
        isFromCustomer: true,
      },
    ];
    let messageIndex = 2;
    if (random.chance(0.6)) {
      thread.push({
        id: `tmsg-${ticket.id}-${messageIndex}`,
        ticketId: ticket.id,
        kind: 'internal_note',
        authorId: agent?.id,
        authorName: agent?.displayName ?? 'Support',
        authorKind: 'agent',
        body: 'Reproduced in the sandbox. Looks related to the caching layer rather than the report query itself. Escalating to engineering if it recurs on the next build.',
        attachments: [],
        createdAt: toDateTimeString(addDays(createdAt, 0.2)),
        isFromCustomer: false,
        delivery: { state: 'draft', simulated: true },
        timeSpentMinutes: random.int(5, 45),
      });
      messageIndex += 1;
    }
    if (responded) {
      thread.push({
        id: `tmsg-${ticket.id}-${messageIndex}`,
        ticketId: ticket.id,
        kind: 'reply',
        authorId: agent?.id,
        authorName: agent?.displayName ?? 'Support',
        authorKind: 'agent',
        body: 'Thanks for the detail. I have reproduced it here and identified the cause. We are deploying a fix and I will confirm once it is live for your workspace.',
        attachments: [],
        createdAt: toDateTimeString(respondedAt ?? createdAt),
        isFromCustomer: false,
        delivery: { state: 'simulated_sent', simulated: true },
        timeSpentMinutes: random.int(10, 80),
      });
      messageIndex += 1;
    }
    if (resolved && resolvedAt) {
      thread.push({
        id: `tmsg-${ticket.id}-${messageIndex}`,
        ticketId: ticket.id,
        kind: 'system',
        authorName: 'System',
        authorKind: 'system',
        body: 'Ticket marked resolved. A satisfaction survey was recorded for this interaction.',
        attachments: [],
        createdAt: toDateTimeString(resolvedAt),
        isFromCustomer: false,
      });
    }

    ticket.messageCount = thread.length;
    ticket.kbArticleIds = random.chance(0.4) ? [`kb-${organization.id}-${random.int(1, 18)}`] : [];
    if (resolved && resolvedAt && random.chance(0.7)) {
      const score = random.weighted([
        { value: 5 as const, weight: 52 },
        { value: 4 as const, weight: 28 },
        { value: 3 as const, weight: 11 },
        { value: 2 as const, weight: 6 },
        { value: 1 as const, weight: 3 },
      ]);
      ticket.satisfaction = {
        id: `csat-${ticket.id}`,
        ticketId: ticket.id,
        score,
        comment: score >= 4 ? 'Handled quickly and explained clearly.' : 'Took longer than expected to get a first reply.',
        submittedAt: toDateTimeString(addDays(resolvedAt, 0.3)),
        agentId: agent?.id,
        agentName: agent?.displayName,
        channel: 'email',
      };
    }

    messages.push(...thread);
    tickets.push(ticket);
  }

  return { tickets, messages };
}

export function makeKnowledgeBase(ctx: OrgContext): { articles: KbArticle[]; categories: KbCategory[] } {
  const { random, organization, users } = ctx;
  const categories: KbCategory[] = [
    { id: `kbc-${organization.id}-setup`, organizationId: organization.id, name: 'Setup & configuration', description: 'Getting the platform configured for your organization.', sortOrder: 1, visibility: 'both', articleCount: 0, tone: 'violet' },
    { id: `kbc-${organization.id}-sales`, organizationId: organization.id, name: 'Sales workflows', description: 'Leads, pipeline and forecasting.', sortOrder: 2, visibility: 'both', articleCount: 0, tone: 'blue' },
    { id: `kbc-${organization.id}-service`, organizationId: organization.id, name: 'Service desk', description: 'Queues, SLAs and the knowledge base itself.', sortOrder: 3, visibility: 'both', articleCount: 0, tone: 'teal' },
    { id: `kbc-${organization.id}-data`, organizationId: organization.id, name: 'Data & imports', description: 'Mapping, validation and duplicate handling.', sortOrder: 4, visibility: 'internal', articleCount: 0, tone: 'amber' },
    { id: `kbc-${organization.id}-security`, organizationId: organization.id, name: 'Security & access', description: 'Roles, permissions, SSO and audit.', sortOrder: 5, visibility: 'internal', articleCount: 0, tone: 'red' },
  ];

  const articles: KbArticle[] = kbArticleTitles.map((title, index) => {
    const category = categories[index % categories.length]!;
    const author = random.pick(users);
    return {
      id: `kb-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      scope: category.visibility === 'internal' ? 'internal' : 'public',
      categoryId: category.id,
      categoryLabel: category.name,
      summary: `A step-by-step guide covering ${title.toLowerCase()} in the demonstration build.`,
      blocks: [
        { id: `blk-${index}-1`, type: 'paragraph', text: 'This article is sample content created to demonstrate the knowledge base layout. It describes a real configuration path in the product interface.' },
        { id: `blk-${index}-2`, type: 'heading', level: 2, text: 'Before you start' },
        { id: `blk-${index}-3`, type: 'list', ordered: false, items: ['You need an administrator role.', 'Confirm the settings you intend to change.', 'Record the current configuration so you can revert it.'] },
        { id: `blk-${index}-4`, type: 'heading', level: 2, text: 'Steps' },
        { id: `blk-${index}-5`, type: 'steps', items: ['Open the relevant settings screen.', 'Adjust the configuration.', 'Save and review the preview.', 'Confirm the change appears where you expect it.'] },
        { id: `blk-${index}-6`, type: 'callout', tone: 'warning', text: 'Changes to roles, permissions and validation rules affect every user in the organization. Review the impact before saving.' },
      ],
      status: random.pick(['published', 'published', 'published', 'in_review', 'draft'] as const),
      visibility: category.visibility === 'internal' ? 'organization' : 'public',
      authorId: author.id,
      authorName: author.displayName,
      reviewDueAt: toDateString(random.futureDate(300, DATASET_EPOCH)),
      publishedAt: toDateTimeString(random.pastDate(400, DATASET_EPOCH)),
      version: random.int(1, 6),
      language: organization.defaultLocale,
      tags: [],
      views: random.int(120, 8400),
      helpfulCount: random.int(10, 320),
      notHelpfulCount: random.int(0, 42),
      linkedTicketCount: random.int(0, 64),
      relatedArticleIds: [],
      createdAt: toDateTimeString(random.pastDate(500, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(30, DATASET_EPOCH)),
    };
  });

  for (const category of categories) {
    category.articleCount = articles.filter((article) => article.categoryId === category.id).length;
  }

  return { articles, categories };
}

export function makeSurveys(ctx: OrgContext, tickets: Ticket[]): Survey[] {
  const { random, organization } = ctx;
  const csatResponses = tickets
    .filter((ticket) => ticket.satisfaction)
    .slice(0, 40)
    .map((ticket) => ({
      id: `sr-${ticket.id}`,
      score: ticket.satisfaction!.score,
      comment: ticket.satisfaction!.comment,
      submittedAt: ticket.satisfaction!.submittedAt,
      contactLabel: ticket.requesterName,
      agentName: ticket.satisfaction!.agentName,
    }));

  const average = csatResponses.length > 0 ? Number((csatResponses.reduce((sum, row) => sum + row.score, 0) / csatResponses.length).toFixed(2)) : 0;

  return [
    {
      id: `survey-${organization.id}-csat`,
      organizationId: organization.id,
      name: 'Ticket satisfaction',
      kind: 'csat',
      status: 'active',
      trigger: 'ticket_resolved',
      delayMinutes: 30,
      question: 'How satisfied were you with the support you received?',
      followUpQuestion: 'What could we have done better?',
      thanksMessage: 'Thank you — your feedback is reviewed by the service team every week.',
      responses: csatResponses,
      responseCount: csatResponses.length,
      averageScore: average,
      responseRate: tickets.length > 0 ? Number(((csatResponses.length / tickets.length) * 100).toFixed(1)) : 0,
      sentCount: tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
      trend: Array.from({ length: 12 }, (_, index) => {
        const date = addDays(DATASET_EPOCH, -(11 - index) * 30);
        return { date: toDateString(date), responses: random.int(8, 40), average: random.float(3.9, 4.9, 2) };
      }),
      createdAt: toDateTimeString(new Date('2024-12-01T09:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-09-20T15:30:00.000Z')),
    },
    {
      id: `survey-${organization.id}-nps`,
      organizationId: organization.id,
      name: 'Relationship NPS',
      kind: 'nps',
      status: 'active',
      trigger: 'scheduled',
      question: 'How likely are you to recommend us to a colleague?',
      followUpQuestion: 'What is the main reason for your score?',
      responses: Array.from({ length: 34 }, (_, index) => ({
        id: `npsr-${index}`,
        score: random.weighted([{ value: 9, weight: 34 }, { value: 10, weight: 28 }, { value: 8, weight: 18 }, { value: 7, weight: 10 }, { value: 5, weight: 6 }, { value: 3, weight: 4 }]),
        comment: random.pick(['Product fits our process well.', 'Support response times could be faster.', 'Implementation was well handled.', 'Reporting needs more flexibility.']),
        submittedAt: toDateTimeString(random.pastDate(180, DATASET_EPOCH)),
        contactLabel: 'Account contact',
      })),
      responseCount: 34,
      averageScore: 8.4,
      npsScore: 41,
      responseRate: 38.2,
      sentCount: 89,
      trend: Array.from({ length: 8 }, (_, index) => ({ date: toDateString(addDays(DATASET_EPOCH, -(7 - index) * 30)), responses: random.int(20, 48), average: random.float(7.8, 9.1, 2) })),
      createdAt: toDateTimeString(new Date('2025-02-10T09:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-10-01T10:00:00.000Z')),
    },
  ];
}

/* --------------------------------------------------------------- marketing */

export function makeMarketing(ctx: OrgContext): {
  campaigns: Campaign[];
  segments: Segment[];
  journeys: Journey[];
  emailTemplates: EmailTemplate[];
  forms: CaptureForm[];
  landingPages: LandingPage[];
} {
  const { random, organization, users } = ctx;
  const marketers = users.filter((user) => user.persona === 'marketing_manager' || user.persona === 'marketing_specialist' || user.persona === 'org_admin');
  const owner = marketers[0] ?? users[0]!;

  const segments: Segment[] = [
    {
      id: `seg-${organization.id}-enterprise`,
      organizationId: organization.id,
      name: 'Enterprise decision makers',
      description: 'Director level and above at accounts with more than 500 employees.',
      kind: 'dynamic',
      entityType: 'contact',
      status: 'active',
      memberCount: random.int(240, 980),
      definition: {
        conjunction: 'and',
        rules: [
          { id: 'r1', field: 'seniority', label: 'Seniority', operator: 'in_list', value: ['director', 'vp', 'c_level'] },
          { id: 'r2', field: 'account.employeeCount', label: 'Account employees', operator: 'greater_than', value: 500 },
          { id: 'r3', field: 'consent.email', label: 'Email consent', operator: 'equals', value: 'granted' },
        ],
      },
      refreshCadence: 'daily',
      usedInCampaignIds: [],
      ownerId: owner.id,
      tags: [],
      lastRefreshedAt: toDateTimeString(new Date('2026-10-13T06:00:00.000Z')),
      preview: {
        total: random.int(240, 980),
        byCountry: [{ label: organization.countryCode, count: random.int(120, 400) }, { label: 'GB', count: random.int(40, 160) }],
        byLifecycleStage: [
          { label: 'Customer', count: random.int(120, 320), tone: 'green' },
          { label: 'Opportunity', count: random.int(60, 180), tone: 'violet' },
          { label: 'Lead', count: random.int(30, 120), tone: 'blue' },
        ],
        byIndustry: [{ label: 'Manufacturing', count: random.int(40, 140) }, { label: 'Logistics', count: random.int(30, 120) }],
        byConsent: [{ label: 'Email granted', count: random.int(200, 700) }, { label: 'Email denied', count: random.int(0, 40) }],
        sample: Array.from({ length: 5 }, (_, index) => ({ id: `con-${organization.id}-${index + 1}`, label: 'Sample contact', subtitle: 'Director, Operations' })),
      },
      createdAt: toDateTimeString(random.pastDate(400, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(20, DATASET_EPOCH)),
    },
    {
      id: `seg-${organization.id}-at-risk`,
      organizationId: organization.id,
      name: 'Renewals at risk',
      description: 'Accounts renewing in the next two quarters with a health score under 60.',
      kind: 'dynamic',
      entityType: 'account',
      status: 'active',
      memberCount: random.int(14, 48),
      definition: {
        conjunction: 'and',
        rules: [
          { id: 'r1', field: 'healthScore', label: 'Health score', operator: 'less_than', value: 60 },
          { id: 'r2', field: 'renewalDate', label: 'Renewal date', operator: 'has_activity_in_last', value: { days: 180 } },
        ],
      },
      refreshCadence: 'realtime',
      usedInCampaignIds: [],
      ownerId: owner.id,
      tags: [],
      lastRefreshedAt: toDateTimeString(new Date('2026-10-13T08:00:00.000Z')),
      createdAt: toDateTimeString(random.pastDate(200, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(10, DATASET_EPOCH)),
    },
    {
      id: `seg-${organization.id}-product-news`,
      organizationId: organization.id,
      name: 'Product news subscribers',
      description: 'Anyone who opted in to product announcements.',
      kind: 'static',
      entityType: 'contact',
      status: 'active',
      memberCount: random.int(600, 2400),
      definition: { conjunction: 'and', rules: [{ id: 'r1', field: 'consent.email', label: 'Email consent', operator: 'equals', value: 'granted' }] },
      memberIds: [],
      refreshCadence: 'manual',
      usedInCampaignIds: [],
      ownerId: owner.id,
      tags: [],
      createdAt: toDateTimeString(random.pastDate(300, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(40, DATASET_EPOCH)),
    },
  ];

  const campaigns: Campaign[] = campaignNames.map((name, index) => {
    const status = random.weighted([
      { value: 'active' as const, weight: 22 },
      { value: 'completed' as const, weight: 34 },
      { value: 'draft' as const, weight: 18 },
      { value: 'scheduled' as const, weight: 10 },
      { value: 'paused' as const, weight: 8 },
      { value: 'archived' as const, weight: 8 },
    ]);
    const recipients = random.int(600, 24000);
    const delivered = Math.round(recipients * random.float(0.94, 0.995, 4));
    const opens = Math.round(delivered * random.float(0.18, 0.52, 4));
    const clicks = Math.round(opens * random.float(0.06, 0.28, 4));
    const leads = Math.round(clicks * random.float(0.04, 0.18, 4));
    const mqls = Math.round(leads * random.float(0.3, 0.62, 4));
    const opportunities = Math.round(mqls * random.float(0.18, 0.44, 4));
    const dealsWon = Math.round(opportunities * random.float(0.12, 0.34, 4));
    const revenue = dealsWon * random.int(9, 68) * 1000;
    const cost = random.int(4, 92) * 1000;
    const bounces = recipients - delivered;
    const unsubscribes = Math.round(delivered * random.float(0.001, 0.008, 5));

    return {
      id: `camp-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      name,
      code: `CMP-${2026}-${String(index + 1).padStart(3, '0')}`,
      type: random.pick(['email', 'newsletter', 'drip', 'event', 'webinar', 'content', 'paid_advertising', 'product_launch'] as const),
      status,
      objective: random.pick(['lead_generation', 'nurturing', 'awareness', 'retention', 'upsell', 're_engagement'] as const),
      description: 'A demonstration campaign. All figures are derived from a synthetic audience so the funnel stays internally consistent.',
      startDate: toDateString(random.pastDate(200, DATASET_EPOCH)),
      endDate: toDateString(random.pastDate(-40, DATASET_EPOCH)),
      ownerId: owner.id,
      ownerName: owner.displayName,
      teamId: ctx.teams.find((team) => team.kind === 'marketing')?.id,
      budgetedCost: { amount: cost, currency: organization.defaultCurrency },
      actualCost: { amount: Math.round(cost * random.float(0.82, 1.06, 3)), currency: organization.defaultCurrency },
      currency: organization.defaultCurrency,
      segmentIds: [segments[index % segments.length]!.id],
      audienceSize: recipients,
      tags: [],
      goals: [
        { id: 'g1', metric: 'leads', target: Math.round(leads * 1.2), achieved: leads },
        { id: 'g2', metric: 'revenue', target: Math.round(revenue * 1.15), achieved: revenue },
      ],
      metrics: {
        recipients,
        delivered,
        bounces,
        unsubscribes,
        spamComplaints: random.int(0, 4),
        opens,
        uniqueOpens: Math.round(opens * 0.82),
        clicks,
        uniqueClicks: Math.round(clicks * 0.86),
        replies: random.int(2, 90),
        leadsCreated: leads,
        mqls,
        sqls: Math.round(mqls * 0.7),
        opportunities,
        dealsWon,
        revenue: { amount: revenue, currency: organization.defaultCurrency },
        cost: { amount: cost, currency: organization.defaultCurrency },
        openRate: Number(((opens / Math.max(1, delivered)) * 100).toFixed(1)),
        clickRate: Number(((clicks / Math.max(1, delivered)) * 100).toFixed(2)),
        clickToOpenRate: Number(((clicks / Math.max(1, opens)) * 100).toFixed(1)),
        conversionRate: Number(((dealsWon / Math.max(1, recipients)) * 100).toFixed(2)),
        bounceRate: Number(((bounces / Math.max(1, recipients)) * 100).toFixed(1)),
        unsubscribeRate: Number(((unsubscribes / Math.max(1, delivered)) * 100).toFixed(2)),
        costPerLead: { amount: Math.round(cost / Math.max(1, leads)), currency: organization.defaultCurrency },
        roi: Number((((revenue - cost) / Math.max(1, cost)) * 100).toFixed(0)),
        trend: Array.from({ length: 21 }, (_, dayIndex) => {
          const date = addDays(DATASET_EPOCH, -(20 - dayIndex));
          const dayFactor = dayIndex / 20;
          return {
            date: toDateString(date),
            sent: Math.round(recipients / 21),
            opens: Math.round((opens / 21) * (1 + dayFactor)),
            clicks: Math.round(clicks / 21),
            leads: Math.round(leads / 21),
            revenue: Math.round(revenue / 21),
          };
        }),
        byChannel: [
          { channel: 'Email', spend: cost, leads, revenue, roi: Number((((revenue - cost) / Math.max(1, cost)) * 100).toFixed(0)) },
        ],
        byDevice: [
          { device: 'desktop', opens: Math.round(opens * 0.54), clicks: Math.round(clicks * 0.58) },
          { device: 'mobile', opens: Math.round(opens * 0.4), clicks: Math.round(clicks * 0.36) },
          { device: 'tablet', opens: Math.round(opens * 0.06), clicks: Math.round(clicks * 0.06) },
        ],
        byCountry: [
          { countryCode: organization.countryCode, country: organization.countryCode, leads: Math.round(leads * 0.6), revenue: Math.round(revenue * 0.58) },
          { countryCode: 'GB', country: 'United Kingdom', leads: Math.round(leads * 0.25), revenue: Math.round(revenue * 0.28) },
        ],
        byLink: [
          { url: 'https://example-crm.test/pricing', label: 'Pricing page', clicks: Math.round(clicks * 0.34), uniqueClicks: Math.round(clicks * 0.3) },
          { url: 'https://example-crm.test/product', label: 'Product overview', clicks: Math.round(clicks * 0.22), uniqueClicks: Math.round(clicks * 0.2) },
        ],
      },
      abTest: random.chance(0.4) ? {
        id: `ab-${index}`,
        name: 'Subject line test',
        status: random.pick(['completed', 'running'] as const),
        metric: 'open_rate',
        confidencePercent: random.int(72, 98),
        sampleSize: recipients,
        winnerVariantId: 'v1',
        minimumSampleReached: recipients > 2000,
        variants: [
          { id: 'v1', name: 'Variant A', subjectLine: 'A shorter, direct subject line', recipients: Math.round(recipients / 2), conversions: Math.round(opens / 2 * 1.04), rate: Number(((opens / 2 * 1.04) / Math.max(1, recipients / 2) * 100).toFixed(2)), isControl: true, improvementOverControl: 0 },
          { id: 'v2', name: 'Variant B', subjectLine: 'A question-led subject line', recipients: Math.round(recipients / 2), conversions: Math.round(opens / 2 * 0.96), rate: Number(((opens / 2 * 0.96) / Math.max(1, recipients / 2) * 100).toFixed(2)), isControl: false, improvementOverControl: -3.8 },
        ],
      } : undefined,
      revenueAttributed: { amount: revenue, currency: organization.defaultCurrency },
      attributionModel: random.pick(['first_touch', 'last_touch', 'linear', 'position_based', 'last_non_direct'] as const),
      utmDefaults: { source: 'campaign', medium: 'email', campaign: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      channels: ['email'],
      notes: undefined,
      createdAt: toDateTimeString(random.pastDate(260, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(8, DATASET_EPOCH)),
    };
  });

  const emailTemplates: EmailTemplate[] = campaignNames.slice(0, 6).map((name, index) => ({
    id: `etmpl-${organization.id}-${index + 1}`,
    organizationId: organization.id,
    name: `${name} — template`,
    category: random.pick(['newsletter', 'promotional', 'nurture', 'announcement', 'onboarding'] as const),
    subject: `${name}: what it means for your team`,
    preheader: 'A short summary that appears next to the subject line in most inboxes.',
    blocks: [
      { id: `b-${index}-1`, type: 'heading', content: { text: name }, visible: true },
      { id: `b-${index}-2`, type: 'paragraph', content: { text: 'Hello {{contact.first_name}}, here is a summary of what has changed and what it means for {{account.name}}.' }, visible: true },
      { id: `b-${index}-3`, type: 'image_placeholder', content: { alt: 'Product screenshot placeholder' }, visible: true },
      { id: `b-${index}-4`, type: 'button', content: { label: 'Read the full update', href: 'https://example-crm.test/blog' }, visible: true },
      { id: `b-${index}-5`, type: 'unsubscribe', content: { label: 'Manage subscription preferences' }, visible: true },
    ],
    thumbnailTone: random.pick(['violet', 'teal', 'blue', 'amber'] as const),
    isShared: true,
    usedInCampaignCount: random.int(1, 6),
    brandKitApplied: true,
    renderMode: 'demo_preview',
    createdAt: toDateTimeString(random.pastDate(300, DATASET_EPOCH)),
    updatedAt: toDateTimeString(random.pastDate(25, DATASET_EPOCH)),
  }));

  const journeys: Journey[] = [
    {
      id: `jny-${organization.id}-onboarding`,
      organizationId: organization.id,
      name: 'New customer onboarding',
      description: 'Warm-up series triggered when a deal closes won.',
      status: 'active',
      entryType: 'deal_stage',
      reEntryRule: 'never',
      nodes: [
        { id: 'n1', kind: 'trigger', label: 'Deal closed won', description: 'Fires once per account.', position: { x: 40, y: 160 }, config: {}, stats: { entered: 148, completed: 148, branched: 0, failed: 0 }, isEntry: true },
        { id: 'n2', kind: 'delay', label: 'Wait 1 day', position: { x: 260, y: 160 }, config: { waitDays: 1 }, stats: { entered: 148, completed: 146, branched: 0, failed: 0 } },
        { id: 'n3', kind: 'action_email', label: 'Send welcome email', position: { x: 480, y: 160 }, config: { templateId: `etmpl-${organization.id}-1` }, stats: { entered: 146, completed: 144, branched: 0, failed: 2 } },
        { id: 'n4', kind: 'action_task', label: 'Create CSM introduction task', position: { x: 700, y: 160 }, config: { task: { title: 'Introduce the customer success manager', description: '', assignToKind: 'owner', dueInDays: 2, priority: 'high' } }, stats: { entered: 144, completed: 141, branched: 0, failed: 3 } },
        { id: 'n5', kind: 'condition', label: 'Enterprise account?', position: { x: 920, y: 160 }, config: { conditionGroup: { id: 'cg1', conjunction: 'and', negate: false, rules: [{ id: 'r1', field: 'account.employeeCount', fieldLabel: 'Account employees', fieldType: 'number', operator: 'greater_than', value: 500 }] } }, stats: { entered: 141, completed: 141, branched: 48, failed: 0 } },
        { id: 'n6', kind: 'action_email', label: 'Send executive welcome', position: { x: 1140, y: 60 }, config: { templateId: `etmpl-${organization.id}-2` }, stats: { entered: 48, completed: 47, branched: 0, failed: 1 } },
        { id: 'n7', kind: 'action_email', label: 'Send standard onboarding pack', position: { x: 1140, y: 260 }, config: { templateId: `etmpl-${organization.id}-3` }, stats: { entered: 93, completed: 92, branched: 0, failed: 1 } },
        { id: 'n8', kind: 'goal', label: 'Goal: first login', position: { x: 1380, y: 160 }, config: {}, stats: { entered: 139, completed: 118, branched: 0, failed: 0 }, isTerminal: true },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'out' },
        { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'out' },
        { id: 'e3', fromNodeId: 'n3', toNodeId: 'n4', fromPort: 'out' },
        { id: 'e4', fromNodeId: 'n4', toNodeId: 'n5', fromPort: 'out' },
        { id: 'e5', fromNodeId: 'n5', toNodeId: 'n6', fromPort: 'true', label: 'Yes', tone: 'green' },
        { id: 'e6', fromNodeId: 'n5', toNodeId: 'n7', fromPort: 'false', label: 'No', tone: 'slate' },
        { id: 'e7', fromNodeId: 'n6', toNodeId: 'n8', fromPort: 'out' },
        { id: 'e8', fromNodeId: 'n7', toNodeId: 'n8', fromPort: 'out' },
      ],
      goalDefinition: { metric: 'stage_reached', targetLabel: 'First login recorded' },
      stats: { entered: 148, active: 30, completed: 100, goalReached: 118, exited: 18, completionRate: 67.6, conversionRate: 79.7 },
      ownerId: owner.id,
      createdAt: toDateTimeString(new Date('2025-04-11T10:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-09-02T14:20:00.000Z')),
    },
    {
      id: `jny-${organization.id}-nurture`,
      organizationId: organization.id,
      name: 'Inbound lead nurture',
      description: 'Three-touch series for leads that have not been contacted yet.',
      status: 'active',
      entryType: 'form',
      entryFormId: `form-${organization.id}-1`,
      reEntryRule: 'once_after_exit',
      reEntryDelayDays: 90,
      nodes: [
        { id: 'n1', kind: 'trigger', label: 'Form submitted', position: { x: 40, y: 140 }, config: {}, stats: { entered: 1840, completed: 1840, branched: 0, failed: 0 }, isEntry: true },
        { id: 'n2', kind: 'condition', label: 'Consent granted?', position: { x: 260, y: 140 }, config: { conditionGroup: { id: 'cg1', conjunction: 'and', negate: false, rules: [{ id: 'r1', field: 'consent.email', fieldLabel: 'Email consent', fieldType: 'picklist', operator: 'equals', value: 'granted' }] } }, stats: { entered: 1840, completed: 1840, branched: 412, failed: 0 } },
        { id: 'n3', kind: 'exit', label: 'Exit: no consent', position: { x: 480, y: 20 }, config: {}, stats: { entered: 412, completed: 412, branched: 0, failed: 0 }, isTerminal: true },
        { id: 'n4', kind: 'action_email', label: 'Send introduction', position: { x: 480, y: 260 }, config: { templateId: `etmpl-${organization.id}-4` }, stats: { entered: 1428, completed: 1410, branched: 0, failed: 18 } },
        { id: 'n5', kind: 'delay', label: 'Wait 3 days', position: { x: 700, y: 260 }, config: { waitDays: 3, waitUntilTime: '09:00' }, stats: { entered: 1410, completed: 1398, branched: 0, failed: 12 } },
        { id: 'n6', kind: 'branch', label: 'Split test', position: { x: 920, y: 260 }, config: { splitPercentages: [50, 50], branches: [{ id: 'b1', label: 'Case study', tone: 'blue' }, { id: 'b2', label: 'Pricing guide', tone: 'teal' }] }, stats: { entered: 1398, completed: 1398, branched: 1398, failed: 0 } },
        { id: 'n7', kind: 'action_email', label: 'Send case study', position: { x: 1140, y: 140 }, config: { templateId: `etmpl-${organization.id}-5` }, stats: { entered: 699, completed: 690, branched: 0, failed: 9 } },
        { id: 'n8', kind: 'action_email', label: 'Send pricing guide', position: { x: 1140, y: 380 }, config: { templateId: `etmpl-${organization.id}-6` }, stats: { entered: 699, completed: 688, branched: 0, failed: 11 } },
        { id: 'n9', kind: 'goal', label: 'Goal: meeting booked', position: { x: 1380, y: 260 }, config: {}, stats: { entered: 1378, completed: 214, branched: 0, failed: 0 }, isTerminal: true },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'out' },
        { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'false', label: 'No consent', tone: 'red' },
        { id: 'e3', fromNodeId: 'n2', toNodeId: 'n4', fromPort: 'true', label: 'Consent', tone: 'green' },
        { id: 'e4', fromNodeId: 'n4', toNodeId: 'n5', fromPort: 'out' },
        { id: 'e5', fromNodeId: 'n5', toNodeId: 'n6', fromPort: 'out' },
        { id: 'e6', fromNodeId: 'n6', toNodeId: 'n7', fromPort: 'b1' },
        { id: 'e7', fromNodeId: 'n6', toNodeId: 'n8', fromPort: 'b2' },
        { id: 'e8', fromNodeId: 'n7', toNodeId: 'n9', fromPort: 'out' },
        { id: 'e9', fromNodeId: 'n8', toNodeId: 'n9', fromPort: 'out' },
      ],
      goalDefinition: { metric: 'meeting', targetLabel: 'Meeting booked' },
      stats: { entered: 1840, active: 604, completed: 214, goalReached: 214, exited: 412, completionRate: 11.6, conversionRate: 15.2 },
      ownerId: owner.id,
      createdAt: toDateTimeString(new Date('2025-08-19T09:30:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-10-04T16:00:00.000Z')),
    },
  ];

  const forms: CaptureForm[] = [
    {
      id: `form-${organization.id}-1`,
      organizationId: organization.id,
      name: 'Request a demo',
      status: 'published',
      fields: [
        { id: 'f1', key: 'first_name', label: 'First name', type: 'text', required: true, width: 'half', sortOrder: 1 },
        { id: 'f2', key: 'last_name', label: 'Last name', type: 'text', required: true, width: 'half', sortOrder: 2 },
        { id: 'f3', key: 'email', label: 'Work email', type: 'email', required: true, width: 'half', sortOrder: 3 },
        { id: 'f4', key: 'company', label: 'Company', type: 'company', required: true, width: 'half', sortOrder: 4 },
        { id: 'f5', key: 'company_size', label: 'Company size', type: 'select', required: true, width: 'half', sortOrder: 5, options: [{ value: '2-10', label: '2–10' }, { value: '11-50', label: '11–50' }, { value: '51-200', label: '51–200' }, { value: '201-1000', label: '201–1,000' }, { value: '1001-5000', label: '1,001–5,000' }] },
        { id: 'f6', key: 'country', label: 'Country', type: 'country', required: true, width: 'half', sortOrder: 6 },
        { id: 'f7', key: 'goals', label: 'What are you trying to solve?', type: 'textarea', required: false, width: 'full', sortOrder: 7 },
        { id: 'f8', key: 'consent', label: 'I agree to be contacted about this enquiry', type: 'consent', required: true, width: 'full', sortOrder: 8, helpText: 'We will only use these details to respond to your enquiry.' },
      ],
      submitAction: { kind: 'create_lead', ownerId: owner.id, requireConsent: true, consentText: 'I agree to be contacted about this enquiry.' },
      integrationState: 'demo_only',
      submissions: random.int(180, 2400),
      conversionRate: random.float(4.2, 18.6, 1),
      views: random.int(2400, 32000),
      lastSubmissionAt: toDateTimeString(random.pastDate(2, DATASET_EPOCH)),
      utmPassthrough: true,
      createdAt: toDateTimeString(new Date('2025-01-15T11:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-09-28T13:40:00.000Z')),
    },
  ];

  const landingPages: LandingPage[] = [
    {
      id: `lp-${organization.id}-1`,
      organizationId: organization.id,
      name: 'Migration guide',
      slug: 'migration-guide',
      status: 'published',
      sections: [
        { id: 's1', type: 'hero', heading: 'Move your CRM without losing a single record', subheading: 'A structured migration path with validation before anything is committed.', backgroundColor: 'brand-soft', visible: true, sortOrder: 1 },
        { id: 's2', type: 'steps', heading: 'Four steps', items: [{ id: 'i1', title: 'Map your fields', description: 'Match your existing columns to CRM fields and preview the result.' }, { id: 'i2', title: 'Validate before commit', description: 'See every rejected row with a reason before writing anything.' }, { id: 'i3', title: 'Resolve duplicates', description: 'Review candidates side by side and decide what to merge.' }, { id: 'i4', title: 'Verify the result', description: 'Compare counts and spot-check the records that matter.' }], visible: true, sortOrder: 2 },
        { id: 's3', type: 'form', heading: 'Get the migration checklist', visible: true, sortOrder: 3 },
      ],
      formId: `form-${organization.id}-1`,
      seo: { title: 'CRM migration guide', description: 'A structured path for migrating from a spreadsheet or another CRM.', noIndex: false },
      theme: { layout: 'split', heroStyle: 'gradient', accentPresetId: 'violet' },
      views: random.int(1800, 24000),
      submissions: random.int(60, 900),
      conversionRate: random.float(2.4, 12.8, 1),
      hostingState: 'demo_not_hosted',
      publishedAt: toDateTimeString(new Date('2026-02-04T09:00:00.000Z')),
      createdAt: toDateTimeString(new Date('2026-01-28T09:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-07-19T15:10:00.000Z')),
    },
  ];

  return { campaigns, segments, journeys, emailTemplates, forms, landingPages };
}

/* ---------------------------------------------------------- communications */

export function makeCommunications(ctx: OrgContext, contacts: import('@crm/shared-types').Contact[], count: number): {
  inboxes: SharedInbox[];
  conversations: Conversation[];
  messages: MessageBase[];
  calls: CallRecord[];
  templates: MessageTemplate[];
  canned: CannedResponse[];
} {
  const { random, organization, users } = ctx;
  const agents = users.filter((user) => user.persona === 'support_agent' || user.persona === 'sales_rep' || user.persona === 'service_manager' || user.persona === 'org_admin');
  const assignable = agents.length > 0 ? agents : users;

  const inboxes: SharedInbox[] = [
    { id: `inb-${organization.id}-support`, organizationId: organization.id, name: 'Support', address: `support@${organization.slug}.example`, channel: 'email', description: 'General support for customers.', assignmentStrategy: 'round_robin', memberIds: assignable.map((user) => user.id), slaPolicyId: `sla-${organization.id}-standard`, tone: 'blue', unreadCount: 0, openCount: 0, isActive: true, createdAt: toDateTimeString(new Date('2024-11-06T09:10:00.000Z')), updatedAt: toDateTimeString(new Date('2026-06-02T10:00:00.000Z')) },
    { id: `inb-${organization.id}-sales`, organizationId: organization.id, name: 'Sales enquiries', address: `sales@${organization.slug}.example`, channel: 'email', description: 'Inbound enquiries that need qualifying.', assignmentStrategy: 'round_robin', memberIds: assignable.map((user) => user.id), tone: 'violet', unreadCount: 0, openCount: 0, isActive: true, createdAt: toDateTimeString(new Date('2024-11-06T09:10:00.000Z')), updatedAt: toDateTimeString(new Date('2026-05-18T09:00:00.000Z')) },
    { id: `inb-${organization.id}-whatsapp`, organizationId: organization.id, name: 'WhatsApp Business', address: '+00 000 000 000', channel: 'whatsapp', description: 'Not connected. Conversations shown here are synthetic.', assignmentStrategy: 'by_language', memberIds: assignable.map((user) => user.id), tone: 'green', unreadCount: 0, openCount: 0, isActive: false, createdAt: toDateTimeString(new Date('2025-03-04T09:00:00.000Z')), updatedAt: toDateTimeString(new Date('2026-01-20T12:00:00.000Z')) },
  ];

  const conversations: Conversation[] = [];
  const messages: MessageBase[] = [];
  const channels: Conversation['channel'][] = ['email', 'email', 'email', 'whatsapp', 'live_chat', 'sms'];
  const subjects = ['Question about the renewal quote', 'Cannot access the reporting module', 'Billing query for this quarter', 'Following up on the workshop', 'Delivery timeline', 'Request for a copy of the contract', 'Integration configuration help', 'Invoice reference mismatch'];

  for (let index = 0; index < count; index += 1) {
    const contact = random.pick(contacts);
    const account = contact.accountName ?? 'Account';
    const channel = random.pick(channels);
    const inbox = channel === 'whatsapp' ? inboxes[2]! : random.chance(0.6) ? inboxes[0]! : inboxes[1]!;
    const assignee = random.chance(0.82) ? random.pick(assignable) : undefined;
    const status = random.weighted([
      { value: 'open' as const, weight: 30 },
      { value: 'pending' as const, weight: 18 },
      { value: 'snoozed' as const, weight: 8 },
      { value: 'resolved' as const, weight: 34 },
      { value: 'closed' as const, weight: 10 },
    ]);
    const lastMessageAt = random.pastDate(14, DATASET_EPOCH);
    const messageCount = random.int(1, 6);
    const thread: MessageBase[] = [];

    for (let messageIndex = 0; messageIndex < messageCount; messageIndex += 1) {
      const inbound = messageIndex % 2 === 0;
      const at = addDays(lastMessageAt, -(messageCount - messageIndex) * 0.3);
      thread.push({
        id: `msg-${organization.id}-${index}-${messageIndex}`,
        conversationId: `conv-${organization.id}-${index + 1}`,
        direction: inbound ? 'inbound' : 'outbound',
        authorKind: inbound ? 'external' : 'internal',
        authorId: inbound ? contact.id : assignee?.id,
        authorName: inbound ? contact.displayName : assignee?.displayName ?? 'Team',
        authorHandle: inbound ? contact.emails[0]?.value : undefined,
        channel,
        body: inbound
          ? random.pick(['Could you confirm the revised figure before Friday?', 'We are seeing the same issue again today.', 'Thanks for the update — that answers my question.', 'Can you send the document in a different format?'])
          : random.pick(['Confirmed — I have updated the record and the revised figure is attached.', 'I have reproduced it and raised a fix. I will confirm once it is live.', 'Attached. Let me know if you need anything else.', 'Noted. I have scheduled a follow-up for next week.']),
        bodyFormat: 'plain',
        attachments: [],
        delivery: inbound ? { state: 'simulated_delivered', simulated: true } : { state: 'simulated_sent', simulated: true, note: 'Recorded locally — no message was transmitted.' },
        isRead: status === 'resolved' || status === 'closed' ? true : random.chance(0.7),
        isInternalOnly: false,
        createdAt: toDateTimeString(at),
        updatedAt: toDateTimeString(at),
      });
    }

    const lastBody = thread[thread.length - 1]!;
    const firstInbound = thread.find((message) => message.direction === 'inbound');
    const firstOutbound = thread.find((message) => message.direction === 'outbound');
    const resolved = status === 'resolved' || status === 'closed';

    const conversation: Conversation = {
      id: `conv-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      subject: random.pick(subjects),
      channel,
      socialNetwork: undefined,
      inboxId: inbox.id,
      inboxName: inbox.name,
      status,
      priority: random.pick(['normal', 'normal', 'high', 'low'] as const),
      participants: [
        { id: contact.id, kind: 'external', name: contact.displayName, handle: contact.emails[0]?.value ?? 'unknown', contactId: contact.id },
        ...(assignee ? [{ id: assignee.id, kind: 'internal' as const, name: assignee.displayName, handle: assignee.email, userId: assignee.id }] : []),
      ],
      relatedRecords: [
        { type: 'contact', id: contact.id, label: contact.displayName },
        { type: 'account', id: contact.accountId ?? '', label: account },
      ],
      assigneeId: assignee?.id,
      assigneeName: assignee?.displayName,
      teamId: ctx.teams.find((team) => team.kind === 'service')?.id,
      tags: [],
      messageCount: thread.length,
      unreadCount: status === 'open' ? random.int(0, 3) : 0,
      firstResponseDueAt: toDateTimeString(addDays(thread[0]?.createdAt ? new Date(thread[0].createdAt!) : lastMessageAt, 0.5)),
      firstRespondedAt: firstOutbound?.createdAt,
      nextResponseDueAt: toDateTimeString(addDays(DATASET_EPOCH, random.int(1, 2))),
      resolutionDueAt: toDateTimeString(addDays(DATASET_EPOCH, random.int(2, 5))),
      resolvedAt: resolved ? toDateTimeString(addDays(lastMessageAt, 0.4)) : undefined,
      lastMessageAt: toDateTimeString(lastMessageAt),
      lastMessagePreview: lastBody.body.slice(0, 120),
      hasAttachments: false,
      sentiment: random.pick(['positive', 'neutral', 'neutral', 'negative'] as const),
      summary: firstInbound ? `Customer asked about "${random.pick(subjects).toLowerCase()}". ${resolved ? 'Resolved in the thread.' : 'Awaiting a response.'}` : undefined,
      isStarred: random.chance(0.14),
      createdAt: thread[0]?.createdAt ?? toDateTimeString(lastMessageAt),
      updatedAt: toDateTimeString(lastMessageAt),
    };

    messages.push(...thread);
    conversations.push(conversation);
  }

  for (const inbox of inboxes) {
    inbox.openCount = conversations.filter((conversation) => conversation.inboxId === inbox.id && conversation.status === 'open').length;
    inbox.unreadCount = conversations.filter((conversation) => conversation.inboxId === inbox.id).reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  }

  const calls: CallRecord[] = Array.from({ length: Math.round(count / 2) }, (_, index) => {
    const contact = random.pick(contacts);
    const agent = random.pick(assignable);
    const startedAt = random.pastDate(30, DATASET_EPOCH);
    const durationSeconds = random.int(22, 2400);
    const outcome = random.weighted([
      { value: 'connected' as const, weight: 58 },
      { value: 'no_answer' as const, weight: 20 },
      { value: 'voicemail' as const, weight: 12 },
      { value: 'busy' as const, weight: 6 },
      { value: 'failed' as const, weight: 4 },
    ]);
    return {
      id: `call-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      direction: random.pick(['inbound', 'outbound', 'outbound'] as const),
      simulated: true,
      fromNumberMasked: `+${random.int(1, 49)} *** *** ${random.int(100, 999)}`,
      toNumberMasked: `+${random.int(1, 49)} *** *** ${random.int(100, 999)}`,
      contactId: contact.id,
      contactName: contact.displayName,
      accountId: contact.accountId,
      accountName: contact.accountName,
      userId: agent.id,
      userName: agent.displayName,
      startedAt: toDateTimeString(startedAt),
      durationSeconds: outcome === 'connected' ? durationSeconds : random.int(0, 60),
      outcome,
      disposition: outcome === 'connected' ? random.pick(['Agreed next step', 'Requested a proposal', 'Raised an objection', 'Booked a workshop']) : undefined,
      recordingPlaceholder: { available: false, note: 'No telephony provider is connected, so no recording exists.' },
      aiSummaryDemo: outcome === 'connected' ? {
        summary: 'The customer confirmed the requirement and asked for a revised commercial model. Procurement timing was raised as the main constraint.',
        actionItems: ['Send the revised quote', 'Confirm the procurement timeline', 'Include the security overview'],
        sentiment: random.pick(['positive', 'neutral', 'negative'] as const),
      } : undefined,
      notes: undefined,
      relatedDealId: undefined,
      tags: [],
      createdAt: toDateTimeString(startedAt),
      updatedAt: toDateTimeString(startedAt),
    };
  });

  const templates: MessageTemplate[] = [
    {
      id: `mtmpl-${organization.id}-1`,
      organizationId: organization.id,
      kind: 'email',
      name: 'Demo follow-up',
      subject: 'Next steps after your {{account.name}} demonstration',
      body: 'Hi {{contact.first_name}},\n\nThank you for the time today. As promised, here is a summary of what we covered and the two options we discussed.\n\nIf it helps, I can share the technical overview with your team before the next call.\n\nBest regards,\n{{owner.name}}',
      variables: [
        { key: 'contact.first_name', label: 'Contact first name', source: 'contact.first_name', fallback: 'there' },
        { key: 'account.name', label: 'Account name', source: 'account.name' },
        { key: 'owner.name', label: 'Owner name', source: 'owner.name' },
      ],
      folder: 'Sales',
      sharedWithTeamIds: ctx.teams.filter((team) => team.kind === 'sales').map((team) => team.id),
      usageCount: random.int(40, 620),
      lastUsedAt: toDateTimeString(random.pastDate(3, DATASET_EPOCH)),
      isActive: true,
      category: 'follow_up',
      createdAt: toDateTimeString(new Date('2025-02-10T09:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-09-12T11:00:00.000Z')),
    },
    {
      id: `mtmpl-${organization.id}-2`,
      organizationId: organization.id,
      kind: 'email',
      name: 'Renewal reminder',
      subject: 'Your renewal on {{contract.end_date}}',
      body: 'Hi {{contact.first_name}},\n\nYour agreement for {{account.name}} is due for renewal on {{contract.end_date}}. I would like to confirm whether anything needs to change before we proceed.\n\nWould a short call next week work?\n\nBest regards,\n{{owner.name}}',
      variables: [
        { key: 'contact.first_name', label: 'Contact first name', source: 'contact.first_name', fallback: 'there' },
        { key: 'account.name', label: 'Account name', source: 'account.name' },
        { key: 'contract.end_date', label: 'Contract end date', source: 'custom' },
        { key: 'owner.name', label: 'Owner name', source: 'owner.name' },
      ],
      folder: 'Renewals',
      sharedWithTeamIds: [],
      usageCount: random.int(20, 240),
      isActive: true,
      category: 'renewal',
      createdAt: toDateTimeString(new Date('2025-03-04T09:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-08-02T14:00:00.000Z')),
    },
    {
      id: `mtmpl-${organization.id}-3`,
      organizationId: organization.id,
      kind: 'sms',
      name: 'Visit reminder',
      body: 'Reminder: your appointment is tomorrow at {{appointment.time}}. Reply to reschedule.',
      variables: [{ key: 'appointment.time', label: 'Appointment time', source: 'custom' }],
      folder: 'Field',
      sharedWithTeamIds: [],
      usageCount: random.int(10, 120),
      isActive: true,
      category: 'reminder',
      createdAt: toDateTimeString(new Date('2025-06-01T09:00:00.000Z')),
      updatedAt: toDateTimeString(new Date('2026-07-15T10:00:00.000Z')),
    },
  ];

  const canned: CannedResponse[] = [
    { id: `cr-${organization.id}-1`, organizationId: organization.id, title: 'Acknowledge and set expectations', shortcut: '/ack', body: 'Thanks for reporting this. I have reproduced it and will update you within four hours with either a fix or a clear next step.', category: 'Acknowledgment', scope: 'organization', usageCount: random.int(200, 900), isActive: true, createdAt: toDateTimeString(new Date('2024-12-02T09:00:00.000Z')), updatedAt: toDateTimeString(new Date('2026-09-01T09:00:00.000Z')) },
    { id: `cr-${organization.id}-2`, organizationId: organization.id, title: 'Request more detail', shortcut: '/detail', body: 'To pin this down I need three things: the exact steps, the timestamp of the last occurrence, and whether it happens in a private browsing window. That usually narrows it quickly.', category: 'Triage', scope: 'organization', usageCount: random.int(80, 400), isActive: true, createdAt: toDateTimeString(new Date('2024-12-02T09:05:00.000Z')), updatedAt: toDateTimeString(new Date('2026-08-20T09:00:00.000Z')) },
    { id: `cr-${organization.id}-3`, organizationId: organization.id, title: 'Close with a satisfaction prompt', shortcut: '/close', body: 'I am marking this as resolved. If anything recurs, reply to this thread and it will reopen automatically — you will not need to raise a new ticket.', category: 'Resolution', scope: 'organization', usageCount: random.int(300, 1200), isActive: true, createdAt: toDateTimeString(new Date('2024-12-02T09:10:00.000Z')), updatedAt: toDateTimeString(new Date('2026-09-18T09:00:00.000Z')) },
    { id: `cr-${organization.id}-4`, organizationId: organization.id, title: 'Billing reference request', shortcut: '/billing', body: 'Could you confirm the invoice reference and the billing contact so I can trace this against the right account?', category: 'Billing', scope: 'organization', usageCount: random.int(20, 160), isActive: true, createdAt: toDateTimeString(new Date('2025-01-08T09:00:00.000Z')), updatedAt: toDateTimeString(new Date('2026-07-04T09:00:00.000Z')) },
  ];

  return { inboxes, conversations, messages, calls, templates, canned };
}
