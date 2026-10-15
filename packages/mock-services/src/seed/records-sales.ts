/**
 * Sales records: accounts, contacts, leads, deals and the activity stream.
 *
 * These generator functions produce the data every CRM screen reads. Relationships are
 * wired up properly — a contact belongs to a real account, a deal belongs to a real contact
 * and account, and activities reference real deals — because a dataset with broken links
 * would produce a UI that looks fine and behaves nonsensically.
 */

import type {
  Account,
  Activity,
  CalendarEvent,
  Contact,
  Deal,
  DealProductLine,
  Lead,
  Tag,
} from '@crm/shared-types';
import { DATASET_EPOCH, toDateString, toDateTimeString, addDays } from '../lib/random';
import { cities, competitors, dealNamePatterns, industriesForAccounts, jobTitles, productCatalog, productFamilyFor, tags } from './pools';
import type { ProductCatalogItem } from './pools';
import type { OrgContext } from './foundation';

function pickTags(random: OrgContext['random'], count: number): Tag[] {
  return random.sample(tags as unknown as Tag[], count);
}

function addressFor(random: OrgContext['random'], pool: readonly { city: string; state: string; postal: string; country: string }[], streetNames: readonly string[]) {
  const place = random.pick(pool);
  return {
    id: `addr-${random.int(100000, 999999)}`,
    label: 'Head office',
    line1: `${random.int(1, 400)} ${random.pick(streetNames)}`,
    city: place.city,
    state: place.state,
    postalCode: place.postal,
    countryCode: place.country,
  };
}

/* ---------------------------------------------------------------- accounts */

export function makeAccounts(ctx: OrgContext, count: number): Account[] {
  const { random, organization, users } = ctx;
  const assignable = users.filter((user) => user.persona !== 'org_admin' || users.length < 3);
  const stems =
    organization.industryId === 'manufacturing'
      ? ['Stahlwerk', 'Eisenbach', 'Kranzler', 'Werkmann', 'Rothstein', 'Hochfeld', 'Metallbau', 'Zellwerk']
      : organization.industryId === 'wholesale_distribution'
        ? ['Al Noor', 'Al Manara', 'Gulf Crescent', 'Emirates Orient', 'Falcon Bay', 'Pearl Marina']
        : ['Northgate', 'Clearpath', 'Bluewave', 'Parallax', 'Sierra', 'Ironclad', 'Aperture', 'Ridgeline', 'Cadence', 'Halcyon', 'Copperline', 'Orbital'];

  const suffixes = organization.industryId === 'manufacturing' ? ['GmbH', 'AG', 'GmbH & Co. KG'] : organization.industryId === 'wholesale_distribution' ? ['FZE', 'LLC', 'Trading LLC'] : ['Ltd', 'Inc', 'LLC', 'PLC', 'B.V.'];

  const accounts: Account[] = [];
  for (let index = 0; index < count; index += 1) {
    const stem = stems[index % stems.length]!;
    const suffix = random.pick(suffixes);
    const name = `${stem} ${suffix}`;
    const place = random.pick(cities.us);
    const health = random.weighted([
      { value: 'thriving' as const, weight: 14 },
      { value: 'healthy' as const, weight: 38 },
      { value: 'watch' as const, weight: 24 },
      { value: 'at_risk' as const, weight: 17 },
      { value: 'critical' as const, weight: 5 },
      { value: 'unknown' as const, weight: 2 },
    ]);
    const healthScore =
      health === 'thriving' ? random.int(86, 96)
        : health === 'healthy' ? random.int(72, 85)
          : health === 'watch' ? random.int(58, 71)
            : health === 'at_risk' ? random.int(40, 57)
              : health === 'unknown' ? 0
                : random.int(18, 39);

    const isParent = index < Math.max(2, Math.floor(count / 12)) && random.chance(0.6);
    const address = addressFor(random, ctx.organization.countryCode === 'DE' ? cities.de : ctx.organization.countryCode === 'AE' ? cities.ae : cities.us, ctx.organization.countryCode === 'DE' ? ['Lindenstrasse', 'Werkstrasse', 'Hafenallee'] : ['Harrow Court', 'Foundry Lane', 'Kestrel Rise']);

    accounts.push({
      id: `acc-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `A-${String(10000 + index * 7).padStart(5, '0')}`,
      name,
      legalName: name,
      type: random.weighted([
        { value: 'customer' as const, weight: 62 },
        { value: 'prospect' as const, weight: 26 },
        { value: 'partner' as const, weight: 6 },
        { value: 'reseller' as const, weight: 4 },
        { value: 'vendor' as const, weight: 2 },
      ]),
      industryId: undefined,
      industryLabel: random.pick(industriesForAccounts),
      companySize: random.pick(['11-50', '51-200', '201-1000', '1001-5000'] as const),
      employeeCount: random.int(24, 6400),
      annualRevenue: { amount: random.int(2, 480) * 1_000_000, currency: organization.defaultCurrency },
      foundedYear: random.int(1958, 2019),
      website: `https://${stem.toLowerCase().replace(/[^a-z]/g, '')}.example`,
      domains: [`${stem.toLowerCase().replace(/[^a-z]/g, '')}.example`],
      emails: [{ id: `em-${index}`, label: 'General', value: `info@${stem.toLowerCase().replace(/[^a-z]/g, '')}.example`, isPrimary: true }],
      phones: [{ id: `ph-${index}`, label: 'Main', value: `+${random.int(1, 49)} ${random.int(200, 989)} ${random.int(100000, 999999)}`, isPrimary: true }],
      addresses: [address],
      // A parent must be a *strictly earlier* account. `index - 4` clamped to 1 pointed
      // account 1 at itself, which is both wrong data and an infinite loop for any walker
      // that does not guard against cycles.
      parentAccountId: isParent && index >= 1 ? `acc-${organization.id}-${Math.max(1, index - 4)}` : undefined,
      childAccountIds: [],
      hierarchyDepth: isParent ? 0 : random.chance(0.3) ? 1 : 0,
      ownerId: random.pick(assignable).id,
      ownerTeamId: ctx.teams[0]?.id,
      territory: `ter-${organization.id}-${random.int(1, 3)}`,
      rating: random.pick(['strategic', 'high', 'medium', 'low'] as const),
      tier: random.pick(['enterprise', 'mid_market', 'smb', 'startup'] as const),
      health,
      healthScore,
      healthSignals: [
        { key: 'usage', label: 'Product usage', value: `${random.int(38, 94)}% of licensed seats active`, sentiment: healthScore > 65 ? 'positive' : 'negative' },
        { key: 'support', label: 'Support load', value: `${random.int(0, 9)} open tickets in 30 days`, sentiment: random.chance(0.5) ? 'neutral' : 'negative' },
        { key: 'engagement', label: 'Executive engagement', value: random.chance(0.6) ? 'Sponsor active' : 'No sponsor identified', sentiment: random.chance(0.6) ? 'positive' : 'negative' },
      ],
      tags: pickTags(random, random.int(0, 2)),
      lastActivityAt: toDateTimeString(random.pastDate(21, DATASET_EPOCH)),
      nextActivityAt: toDateTimeString(random.futureDate(14, DATASET_EPOCH)),
      contractStartDate: toDateString(random.pastDate(700, DATASET_EPOCH)),
      contractEndDate: toDateString(random.futureDate(500, DATASET_EPOCH)),
      renewalDate: toDateString(random.futureDate(365, DATASET_EPOCH)),
      openDealCount: 0,
      openTicketCount: 0,
      contactCount: 0,
      totalRevenueWon: { amount: random.int(20, 900) * 1000, currency: organization.defaultCurrency },
      lifetimeValue: { amount: random.int(45, 2400) * 1000, currency: organization.defaultCurrency },
      isKeyAccount: random.chance(0.22),
      buyingCommittee: [],
      description: `${random.pick(industriesForAccounts)} organisation headquartered in ${place.city}.`,
      customFields: {},
      createdAt: toDateTimeString(random.pastDate(900, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(12, DATASET_EPOCH)),
    });
  }

  // Wire the parent-child relationships in both directions so the hierarchy view works.
  // A self-reference is discarded here as well as in the generator, so an imported or
  // hand-edited hierarchy can never present an account as its own parent.
  for (const account of accounts) {
    if (!account.parentAccountId || account.parentAccountId === account.id) {
      account.parentAccountId = undefined;
      continue;
    }
    const parent = accounts.find((candidate) => candidate.id === account.parentAccountId);
    if (parent) parent.childAccountIds.push(account.id);
    else account.parentAccountId = undefined;
  }

  return accounts;
}

/* ---------------------------------------------------------------- contacts */

export function makeContacts(ctx: OrgContext, accounts: Account[], count: number): Contact[] {
  const { random, organization } = ctx;
  const contacts: Contact[] = [];

  for (let index = 0; index < count; index += 1) {
    const account = random.pick(accounts);
    const first = random.pick(['Amelia', 'Noah', 'Priya', 'Lucas', 'Marta', 'Idris', 'Sofia', 'Tomas', 'Elena', 'Jonas', 'Clara', 'Rafael', 'Ingrid', 'Mateo', 'Freya', 'Anton']);
    const last = random.pick(['Whitfield', 'Marchetti', 'Ndoye', 'Lindqvist', 'Okonkwo', 'Duarte', 'Halloran', 'Vasquez', 'Petrova', 'Bergström', 'Aubert', 'Novak']);
    const domain = account.domains[0] ?? 'example.test';
    const lifecycle = random.weighted([
      { value: 'customer' as const, weight: 48 },
      { value: 'opportunity' as const, weight: 18 },
      { value: 'sql' as const, weight: 12 },
      { value: 'mql' as const, weight: 10 },
      { value: 'lead' as const, weight: 8 },
      { value: 'churned' as const, weight: 4 },
    ]);

    const contact: Contact = {
      id: `con-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `C-${String(50000 + index * 3).padStart(5, '0')}`,
      firstName: first,
      lastName: last,
      displayName: `${first} ${last}`,
      jobTitle: random.pick(jobTitles),
      department: random.pick(['Operations', 'IT', 'Finance', 'Procurement', 'Executive', 'Customer Experience']),
      seniority: random.pick(['individual', 'manager', 'director', 'vp', 'c_level'] as const),
      accountId: account.id,
      accountName: account.name,
      emails: [{ id: `cem-${index}`, label: 'Work', value: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`, isPrimary: true }],
      phones: [{ id: `cph-${index}`, label: 'Direct', value: `+${random.int(1, 49)} ${random.int(200, 989)} ${random.int(100000, 999999)}`, isPrimary: true }],
      preferredChannel: random.pick(['email', 'phone', 'sms', 'whatsapp'] as const),
      preferredLanguage: organization.defaultLocale,
      addresses: [],
      timezone: organization.defaultTimezone,
      socialProfiles: [],
      lifecycleStage: lifecycle,
      consent: [
        { channel: 'email', state: random.chance(0.86) ? 'granted' : random.chance(0.5) ? 'denied' : 'withdrawn', lawfulBasis: 'consent', capturedAt: toDateTimeString(random.pastDate(400, DATASET_EPOCH)), capturedVia: 'web form', jurisdiction: organization.countryCode },
        { channel: 'phone', state: random.chance(0.7) ? 'granted' : 'not_asked', lawfulBasis: 'legitimate_interest', capturedAt: toDateTimeString(random.pastDate(400, DATASET_EPOCH)) },
        { channel: 'sms', state: random.chance(0.45) ? 'granted' : 'not_asked', lawfulBasis: 'consent' },
      ],
      communicationPreferences: {
        doNotCall: random.chance(0.08),
        doNotEmail: random.chance(0.07),
        doNotSms: random.chance(0.18),
        unsubscribeAll: random.chance(0.03),
      },
      tags: pickTags(random, random.int(0, 2)),
      relationships: [],
      engagementScore: random.int(12, 98),
      lastActivityAt: toDateTimeString(random.pastDate(30, DATASET_EPOCH)),
      lastEmailAt: toDateTimeString(random.pastDate(20, DATASET_EPOCH)),
      lastMeetingAt: random.chance(0.6) ? toDateTimeString(random.pastDate(60, DATASET_EPOCH)) : undefined,
      openDealCount: 0,
      openTicketCount: 0,
      lifetimeValue: { amount: random.int(4, 620) * 1000, currency: organization.defaultCurrency },
      ownerId: random.pick(ctx.users.filter((user) => user.persona !== 'org_admin' || ctx.users.length < 3)).id,
      ownerTeamId: ctx.teams[0]?.id,
      description: undefined,
      customFields: {},
      createdAt: toDateTimeString(random.pastDate(820, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(9, DATASET_EPOCH)),
    };

    contacts.push(contact);
  }

  // Relationship graph: report-to links and buying-committee membership.
  for (let index = 0; index < contacts.length; index += 1) {
    const contact = contacts[index]!;
    if (index % 4 !== 0) continue;
    const sibling = contacts.find((candidate, candidateIndex) => candidateIndex > index && candidate.accountId === contact.accountId);
    if (!sibling) continue;
    contact.relationships.push({
      id: `rel-${contact.id}-1`,
      kind: random.pick(['reports_to', 'influencer', 'decision_maker', 'billing_contact'] as const),
      targetType: 'contact',
      targetId: sibling.id,
      targetLabel: sibling.displayName,
      strength: random.pick(['strong', 'moderate', 'weak', 'unknown'] as const),
    });
  }

  for (const account of accounts) {
    const members = contacts.filter((contact) => contact.accountId === account.id).slice(0, 4);
    account.contactCount = contacts.filter((contact) => contact.accountId === account.id).length;
    account.buyingCommittee = members.map((member) => ({
      contactId: member.id,
      name: member.displayName,
      role: member.jobTitle,
      sentiment: random.pick(['advocate', 'neutral', 'skeptic', 'unknown'] as const),
    }));
  }

  return contacts;
}

/* ------------------------------------------------------------------- leads */

export function makeLeads(ctx: OrgContext, count: number): Lead[] {
  const { random, organization } = ctx;
  const sourceIds = ['src-web-form', 'src-paid-search', 'src-paid-social', 'src-referral', 'src-event', 'src-outbound', 'src-partner', 'src-manual', 'src-content-download'];
  const leads: Lead[] = [];

  for (let index = 0; index < count; index += 1) {
    const first = random.pick(['Kim', 'Alex', 'Sam', 'Rowan', 'Nadia', 'Theo', 'Iris', 'Milo', 'Zara', 'Elias', 'Nora', 'Ravi']);
    const last = random.pick(['Ainsworth', 'Castellano', 'Ferreira', 'Grimaldi', 'Ilyas', 'Jansen', 'Okafor', 'Petrides', 'Quiroga', 'Sorensen']);
    const companyStem = random.pick(['Brightline', 'Clearview', 'Dunmore', 'Eastgate', 'Fairhaven', 'Glenmore', 'Harborview', 'Inglewood']);
    const status = random.weighted([
      { value: 'new' as const, weight: 26 },
      { value: 'contacted' as const, weight: 20 },
      { value: 'nurturing' as const, weight: 15 },
      { value: 'qualified' as const, weight: 14 },
      { value: 'unqualified' as const, weight: 8 },
      { value: 'converted' as const, weight: 11 },
      { value: 'recycled' as const, weight: 6 },
    ]);
    const fitScore = random.int(30, 96);
    const engagementScore = random.int(8, 92);
    const score = Math.round(fitScore * 0.42 + engagementScore * 0.58);
    const createdAt = random.pastDate(90, DATASET_EPOCH);
    const responseDue = addDays(createdAt, 1);
    const responded = status !== 'new';

    leads.push({
      id: `lead-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `L-${String(20000 + index * 3).padStart(5, '0')}`,
      firstName: first,
      lastName: last,
      companyName: `${companyStem} ${random.pick(['Group', 'Holdings', 'Industries', 'Partners', 'Systems'])}`,
      jobTitle: random.pick(jobTitles),
      emails: [{ id: `lem-${index}`, label: 'Work', value: `${first.toLowerCase()}.${last.toLowerCase()}@${companyStem.toLowerCase()}.example`, isPrimary: true }],
      phones: [{ id: `lph-${index}`, label: 'Mobile', value: `+${random.int(1, 49)} ${random.int(200, 989)} ${random.int(100000, 999999)}`, isPrimary: true }],
      website: `https://${companyStem.toLowerCase()}.example`,
      status,
      rating: score >= 78 ? 'hot' : score >= 55 ? 'warm' : score >= 30 ? 'cold' : 'unrated',
      scoring: {
        score,
        fitScore,
        engagementScore,
        grade: score >= 80 ? 'A' : score >= 62 ? 'B' : score >= 42 ? 'C' : 'D',
        factors: [
          { key: 'company_size', label: 'Company size within target range', contribution: Math.round(fitScore * 0.22), direction: fitScore > 55 ? 'positive' : 'negative' },
          { key: 'industry_fit', label: 'Industry matches an ideal profile', contribution: Math.round(fitScore * 0.26), direction: fitScore > 50 ? 'positive' : 'neutral' },
          { key: 'budget_signal', label: 'Indicated budget on the enquiry form', contribution: Math.round(fitScore * 0.18), direction: fitScore > 60 ? 'positive' : 'neutral' },
          { key: 'website_activity', label: 'Visited pricing and security pages', contribution: Math.round(engagementScore * 0.3), direction: engagementScore > 55 ? 'positive' : 'negative' },
          { key: 'email_opens', label: 'Opened 3 of 4 nurture emails', contribution: Math.round(engagementScore * 0.28), direction: engagementScore > 45 ? 'positive' : 'negative' },
        ],
        modelLabel: 'Fit + engagement (v3, demonstration model)',
        updatedAt: toDateTimeString(random.pastDate(4, DATASET_EPOCH)),
      },
      leadSourceId: random.pick(sourceIds),
      campaignId: undefined,
      industryId: undefined,
      companySize: random.pick(['11-50', '51-200', '201-1000'] as const),
      annualRevenue: { amount: random.int(3, 240) * 1_000_000, currency: organization.defaultCurrency },
      employeeCount: random.int(18, 3200),
      estimatedValue: { amount: random.int(12, 320) * 1000, currency: organization.defaultCurrency },
      territory: `ter-${organization.id}-${random.int(1, 3)}`,
      tags: pickTags(random, random.int(0, 2)),
      ownerTeamId: ctx.teams[0]?.id,
      lastActivityAt: responded ? toDateTimeString(random.pastDate(14, DATASET_EPOCH)) : undefined,
      nextActivityAt: status === 'nurturing' || status === 'qualified' ? toDateTimeString(random.futureDate(7, DATASET_EPOCH)) : undefined,
      responseDueAt: toDateTimeString(responseDue),
      firstRespondedAt: responded ? toDateTimeString(addDays(createdAt, random.float(0.02, 0.9, 3))) : undefined,
      qualifiedAt: status === 'qualified' || status === 'converted' ? toDateTimeString(random.pastDate(30, DATASET_EPOCH)) : undefined,
      disqualifiedReason: status === 'unqualified' ? random.pick(['No budget this year', 'Outside our target segment', 'Duplicate of an existing customer', 'Went with a competitor']) : undefined,
      convertedAt: status === 'converted' ? toDateTimeString(random.pastDate(20, DATASET_EPOCH)) : undefined,
      tags2: undefined,
      duplicateOfId: undefined,
      notes: random.chance(0.4) ? random.pick(['Asked for pricing on the call.', 'Referred by an existing customer.', 'Downloaded the migration guide.', 'Wants a workshop before deciding.']) : undefined,
      customFields: {},
      createdAt: toDateTimeString(createdAt),
      updatedAt: toDateTimeString(random.pastDate(3, DATASET_EPOCH)),
    } as Lead & { tags2?: undefined });
  }

  return leads;
}

/* ------------------------------------------------------------------- deals */

export function makeDeals(ctx: OrgContext, accounts: Account[], contacts: Contact[], count: number): Deal[] {
  const { random, organization, users, pipelines } = ctx;
  const pipeline = pipelines[0]!;
  const openStages = pipeline.stages.filter((stage) => stage.kind === 'open');
  const wonStage = pipeline.stages.find((stage) => stage.kind === 'won')!;
  const lostStage = pipeline.stages.find((stage) => stage.kind === 'lost')!;
  const owners = users.filter((user) => user.persona === 'sales_rep' || user.persona === 'sales_manager' || user.persona === 'account_manager');
  const assignable = owners.length > 0 ? owners : users;
  const catalog: readonly ProductCatalogItem[] = productCatalog[productFamilyFor(organization.industryId)];
  const deals: Deal[] = [];

  for (let index = 0; index < count; index += 1) {
    const account = random.pick(accounts);
    const accountContacts = contacts.filter((contact) => contact.accountId === account.id);
    const primary = accountContacts.length > 0 ? random.pick(accountContacts) : undefined;
    const status = random.weighted([
      { value: 'open' as const, weight: 58 },
      { value: 'won' as const, weight: 26 },
      { value: 'lost' as const, weight: 16 },
    ]);
    const stage = status === 'won' ? wonStage : status === 'lost' ? lostStage : random.pick(openStages);
    const stageEntered = random.pastDate(status === 'open' ? 70 : 220, DATASET_EPOCH);
    const daysInStage = Math.floor((DATASET_EPOCH.getTime() - stageEntered.getTime()) / 86_400_000);
    const isStale = status === 'open' && daysInStage > pipeline.settings.staleDealDays;
    const amount = random.int(12, 480) * 1000;
    const owner = random.pick(assignable);
    const expectedClose = random.futureDate(status === 'open' ? 120 : -30, DATASET_EPOCH);

    const lineCount = random.int(1, 3);
    const products: DealProductLine[] = [];
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const item = random.pick(catalog);
      const quantity = random.int(4, 220);
      const discountPercent = random.pick([0, 0, 0, 5, 8, 10, 12, 15, 20]);
      const unitPrice = item.price;
      const gross = quantity * unitPrice;
      const discountAmount = Math.round(gross * (discountPercent / 100));
      products.push({
        id: `dline-${organization.id}-${index}-${lineIndex}`,
        productId: `prod-${organization.id}-${catalog.indexOf(item) + 1}`,
        productName: item.name,
        sku: item.sku,
        quantity,
        unitPrice: { amount: unitPrice, currency: organization.defaultCurrency },
        discountPercent,
        discountAmount: { amount: discountAmount, currency: organization.defaultCurrency },
        billing: item.billing,
        termMonths: item.billing === 'annual' ? 12 : undefined,
        lineTotal: { amount: gross - discountAmount, currency: organization.defaultCurrency },
        sortOrder: lineIndex,
      });
    }

    const competitorCount = random.chance(0.42) ? random.int(1, 2) : 0;

    deals.push({
      id: `deal-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `D-${String(70000 + index * 5).padStart(5, '0')}`,
      name: `${account.name.split(' ')[0]} — ${random.pick(dealNamePatterns)}`,
      accountId: account.id,
      accountName: account.name,
      primaryContactId: primary?.id,
      primaryContactName: primary?.displayName,
      pipelineId: pipeline.id,
      stageId: stage.id,
      status,
      amount: { amount, currency: organization.defaultCurrency },
      pipelineCurrency: pipeline.currency,
      probability: stage.probability,
      forecastCategory: stage.forecastCategory,
      expectedCloseDate: toDateString(expectedClose),
      actualCloseDate: status === 'open' ? undefined : toDateString(random.pastDate(60, DATASET_EPOCH)),
      cycleTimeDays: status === 'open' ? undefined : random.int(28, 210),
      leadSourceId: random.pick(['src-web-form', 'src-referral', 'src-outbound', 'src-event', 'src-partner']),
      dealType: random.pick(['new_business', 'expansion', 'renewal', 'upsell'] as const),
      ownerId: owner.id,
      ownerTeamId: ctx.teams[0]?.id,
      teamMembers: [
        { userId: owner.id, name: owner.displayName, role: 'owner' },
        ...(random.chance(0.6) ? [{ userId: random.pick(assignable).id, name: random.pick(assignable).displayName, role: 'technical' as const }] : []),
      ],
      products,
      competitorIds: [],
      competitors: random.sample(competitors, competitorCount).map((name, competitorIndex) => ({
        id: `comp-${index}-${competitorIndex}`,
        name,
        threat: random.pick(['high', 'medium', 'low'] as const),
        strength: 'Incumbent at the account',
        weakness: random.chance(0.5) ? 'Weaker service response times' : undefined,
      })),
      lostReasonId: status === 'lost' ? random.pick(['lost-price', 'lost-competitor', 'lost-timing', 'lost-no-decision', 'lost-product-gap']) : undefined,
      lostReasonLabel: undefined,
      nextStep: status === 'open' ? random.pick(['Confirm the security review owner', 'Share the commercial model', 'Book the technical workshop', 'Agree the legal redlines', 'Present the rollout plan']) : undefined,
      nextActivityAt: status === 'open' ? toDateTimeString(random.futureDate(10, DATASET_EPOCH)) : undefined,
      lastActivityAt: toDateTimeString(random.pastDate(35, DATASET_EPOCH)),
      stageEnteredAt: toDateTimeString(stageEntered),
      daysInStage,
      isStale,
      approvalState: random.pick(['not_required', 'not_required', 'approved'] as const),
      quoteCount: random.int(0, 2),
      notes: undefined,
      tags: pickTags(random, random.int(0, 2)),
      customFields: {},
      createdAt: toDateTimeString(random.pastDate(340, DATASET_EPOCH)),
      updatedAt: toDateTimeString(random.pastDate(5, DATASET_EPOCH)),
    });
  }

  return deals;
}

/* -------------------------------------------------------------- activities */

export function makeActivities(ctx: OrgContext, deals: Deal[], contacts: Contact[], accounts: Account[], count: number): { activities: Activity[]; events: CalendarEvent[] } {
  const { random, organization, users } = ctx;
  const activities: Activity[] = [];
  const events: CalendarEvent[] = [];
  const callOutcomes: Array<NonNullable<Activity['outcome']>['disposition']> = ['connected', 'no_answer', 'left_voicemail', 'busy', 'rescheduled'];

  for (let index = 0; index < count; index += 1) {
    const kind = random.weighted([
      { value: 'task' as const, weight: 34 },
      { value: 'call' as const, weight: 20 },
      { value: 'email' as const, weight: 16 },
      { value: 'meeting' as const, weight: 12 },
      { value: 'note' as const, weight: 8 },
      { value: 'demo' as const, weight: 6 },
      { value: 'visit' as const, weight: 4 },
    ]);
    const deal = random.pick(deals);
    const contact = random.pick(contacts);
    const account = accounts.find((candidate) => candidate.id === deal.accountId) ?? random.pick(accounts);
    const owner = random.pick(users);
    const completed = random.chance(0.55);
    const dueAt = completed ? random.pastDate(45, DATASET_EPOCH) : random.futureDate(21, DATASET_EPOCH);
    const priority = random.weighted([
      { value: 'normal' as const, weight: 52 },
      { value: 'high' as const, weight: 26 },
      { value: 'urgent' as const, weight: 10 },
      { value: 'low' as const, weight: 12 },
    ]);

    const title =
      kind === 'task' ? random.pick(['Prepare the value case', 'Follow up on the proposal', 'Confirm the technical workshop', 'Chase the security questionnaire', 'Send the renewal summary', 'Book the quarterly review', 'Update the forecast category'])
        : kind === 'call' ? random.pick(['Discovery call', 'Pricing discussion', 'Check-in call', 'Renewal call', 'Technical scoping call'])
          : kind === 'email' ? random.pick(['Proposal sent', 'Follow-up after the demo', 'Introduction email', 'Meeting recap sent'])
            : kind === 'meeting' ? random.pick(['Solution walkthrough', 'Commercial review', 'Executive alignment', 'Technical deep dive'])
              : kind === 'demo' ? random.pick(['Product demonstration', 'Technical demo', 'Admin walkthrough'])
                : kind === 'visit' ? random.pick(['On-site review', 'Site walkthrough', 'Quarterly business review'])
                  : random.pick(['Call notes', 'Account context', 'Meeting minutes', 'Internal note']);

    const activity: Activity = {
      id: `act-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      kind,
      subject: title,
      subjects: [
        { type: 'deal', id: deal.id, label: deal.name },
        { type: 'contact', id: contact.id, label: contact.displayName },
        { type: 'account', id: account.id, label: account.name },
      ],
      body: random.pick([
        'Discussed the rollout timeline and agreed to revisit after the budget cycle.',
        'Customer asked for a comparison against their incumbent tooling.',
        'Confirmed the technical requirements; no blockers identified.',
        'Requested a revised commercial model with a longer term.',
        'Agreed next step and owner for each open item.',
      ]),
      status: completed ? 'completed' : random.chance(0.85) ? 'open' : 'in_progress',
      priority,
      ownerId: owner.id,
      ownerName: owner.displayName,
      createdByName: random.pick(users).displayName,
      dueAt: toDateTimeString(dueAt),
      dueDate: toDateString(dueAt),
      startAt: kind === 'meeting' || kind === 'demo' || kind === 'visit' ? toDateTimeString(dueAt) : undefined,
      endAt: kind === 'meeting' || kind === 'demo' || kind === 'visit' ? toDateTimeString(addDays(dueAt, 0)) : undefined,
      durationMinutes: random.pick([15, 30, 45, 60, 90]),
      completedAt: completed ? toDateTimeString(dueAt) : undefined,
      completedById: completed ? owner.id : undefined,
      outcome: completed && (kind === 'call' || kind === 'meeting')
        ? { disposition: random.pick(callOutcomes), sentiment: random.pick(['positive', 'neutral', 'negative'] as const), summary: 'Outcome recorded for demonstration purposes.', nextStep: random.pick(['Send the summary', 'Schedule the workshop', 'Confirm pricing']) }
        : undefined,
      reminders: [{ id: `rem-${index}`, minutesBefore: random.pick([10, 30, 60, 1440]), sent: completed }],
      attendees: kind === 'meeting' || kind === 'demo'
        ? [
            { id: owner.id, kind: 'internal', name: owner.displayName, userId: owner.id, status: 'accepted', isOrganizer: true },
            { id: contact.id, kind: 'external', name: contact.displayName, contactId: contact.id, status: random.pick(['accepted', 'tentative', 'awaiting'] as const) },
          ]
        : undefined,
      attachments: [],
      checklist: kind === 'task' ? [
        { id: `chk-${index}-1`, label: 'Gather the figures', done: completed },
        { id: `chk-${index}-2`, label: 'Review with the account team', done: completed && random.chance(0.7) },
      ] : undefined,
      visibility: random.pick(['team', 'team', 'team', 'private'] as const),
      tags: [],
      delivery: kind === 'email' ? { state: 'simulated_sent', note: 'Recorded locally — no email was transmitted.' } : undefined,
      source: random.chance(0.82) ? 'user' : 'automation',
      automationRunId: undefined,
      createdAt: toDateTimeString(addDays(dueAt, -random.int(2, 25))),
      updatedAt: toDateTimeString(addDays(dueAt, -random.int(0, 2))),
    };

    activities.push(activity);

    if (kind === 'meeting' || kind === 'demo' || kind === 'visit') {
      events.push({
        ...activity,
        kind: kind === 'visit' ? 'visit' : kind === 'demo' ? 'demo' : 'meeting',
        location: kind === 'visit' ? `${account.addresses[0]?.line1 ?? 'Customer site'}, ${account.addresses[0]?.city ?? ''}`.trim() : undefined,
        conferencing: kind === 'visit' ? undefined : { provider: 'Video conferencing (placeholder)', joinUrlPlaceholder: 'https://meet.example-crm.test/placeholder', demoOnly: true },
        showAs: 'busy',
        organizerId: owner.id,
        isAllDay: false,
        timezone: organization.defaultTimezone,
      } as CalendarEvent);
    }
  }

  // Keep the account and contact counters consistent with the generated records.
  for (const account of accounts) {
    account.openDealCount = deals.filter((deal) => deal.accountId === account.id && deal.status === 'open').length;
  }
  for (const contact of contacts) {
    contact.openDealCount = deals.filter((deal) => deal.primaryContactId === contact.id && deal.status === 'open').length;
  }

  return { activities, events };
}
