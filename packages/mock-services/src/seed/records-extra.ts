/**
 * Remaining domain records: revenue operations, customer success, delivery, field sales,
 * partners, documents, collaboration, dashboards, reports, automation, customization,
 * integrations, AI and the platform-owner dataset.
 *
 * Scope note. The sales, support, marketing and communication collections are seeded
 * richly because they back the screens a reviewer will actually walk through. These
 * collections are seeded with a smaller representative set, which is enough to prove every
 * screen renders real records and to exercise pagination, filtering and empty states — and
 * honest about the fact that depth here is a later task rather than pretending 400 products
 * exist.
 */

import type {
  Account,
  Announcement,
  BusinessReview,
  CommissionStatement,
  Contract,
  Dashboard,
  Deal,
  DealRegistration,
  DocumentFile,
  DocumentFolder,
  FeedItem,
  InvoiceRecord,
  Notification,
  OnboardingPlan,
  Order,
  Partner,
  PriceBook,
  Product,
  Project,
  ProjectMilestone,
  ProjectTask,
  Quote,
  Renewal,
  ReportDefinition,
  RevenueSubscription,
  SalesGoal,
  SavedView,
  Sequence,
  SuccessPlan,
  Territory,
  VisitLog,
  VisitPlan,
  Workflow,
  WorkflowTemplate,
} from '@crm/shared-types';
import { DATASET_EPOCH, addDays, createRandom, toDateString, toDateTimeString } from '../lib/random';
import { productCatalog, productFamilyFor, workflowNames } from './pools';
import type { ProductCatalogItem } from './pools';
import type { OrgContext } from './foundation';

const stamp = (daysBack: number, ctx: OrgContext) => toDateTimeString(ctx.random.pastDate(daysBack, DATASET_EPOCH));
const future = (days: number, ctx: OrgContext) => toDateTimeString(ctx.random.futureDate(days, DATASET_EPOCH));

/* ------------------------------------------------------- products & pricing */

export function makeProducts(ctx: OrgContext, priceBookId: string): { products: Product[]; priceBooks: PriceBook[] } {
  const { random, organization } = ctx;
  // One source of truth for which catalogue a tenant sells: the deals generator reads the
  // same helper, so product lines can never reference a product this tenant does not list.
  const family: readonly ProductCatalogItem[] = productCatalog[productFamilyFor(organization.industryId)];

  const products: Product[] = family.map((item, index) => ({
    id: `prod-${organization.id}-${index + 1}`,
    organizationId: organization.id,
    name: item.name,
    sku: item.sku,
    description: `Demonstration catalogue item. ${item.name} is licensed per ${item.unit}.`,
    categoryLabel: item.billing === 'one_time' ? 'Services & hardware' : 'Subscriptions',
    family: item.billing === 'one_time' ? 'One-off' : 'Recurring',
    type: item.billing === 'one_time' ? 'service' : 'subscription',
    status: 'active',
    unitOfMeasure: item.unit,
    basePrice: { amount: item.price, currency: organization.defaultCurrency },
    cost: { amount: Math.round(item.price * random.float(0.28, 0.54, 3)), currency: organization.defaultCurrency },
    billingPeriod: item.billing,
    bundleItems: undefined,
    variants: random.chance(0.3) ? [{ id: `var-${index}-1`, name: 'Standard', sku: `${item.sku}-STD`, attributes: [{ name: 'Support', value: 'Standard' }], priceAdjustment: { amount: 0, currency: organization.defaultCurrency }, isActive: true }] : undefined,
    taxCalculationState: 'not_configured',
    images: [{ id: `img-${index}`, alt: `${item.name} placeholder`, tone: random.pick(['violet', 'teal', 'blue', 'slate'] as const), generated: true }],
    isActive: true,
    priceBookEntryCount: 1,
    dealsWonCount: random.int(4, 180),
    revenueWon: { amount: random.int(60, 4200) * 1000, currency: organization.defaultCurrency },
    tags: [],
    customFields: {},
    createdAt: stamp(600, ctx),
    updatedAt: stamp(40, ctx),
  }));

  const priceBooks: PriceBook[] = [
    {
      id: priceBookId,
      organizationId: organization.id,
      name: 'Standard price book',
      description: 'The default list price for every product.',
      currency: organization.defaultCurrency,
      isStandard: true,
      isActive: true,
      appliesTo: { kinds: ['all'] },
      entryCount: products.length,
      entries: products.map((product, index) => ({
        id: `pbe-${organization.id}-${index + 1}`,
        priceBookId,
        productId: product.id,
        productName: product.name,
        unitPrice: product.basePrice,
        volumeTiers: random.chance(0.4) ? [{ minQuantity: 50, discountPercent: 8 }, { minQuantity: 200, discountPercent: 15 }] : undefined,
        isActive: true,
      })),
      createdAt: stamp(600, ctx),
      updatedAt: stamp(60, ctx),
    },
  ];

  return { products, priceBooks };
}

/* ---------------------------------------------------- quotes and contracts */

export function makeRevenueDocuments(ctx: OrgContext, deals: Deal[], accounts: Account[], contacts: import('@crm/shared-types').Contact[], products: Product[], priceBookId: string): {
  quotes: Quote[];
  orders: Order[];
  contracts: Contract[];
  invoices: InvoiceRecord[];
  subscriptions: RevenueSubscription[];
  commissions: CommissionStatement[];
} {
  const { random, organization, users } = ctx;
  const owners = users.filter((user) => user.persona === 'sales_rep' || user.persona === 'sales_manager' || user.persona === 'finance_user' || user.persona === 'org_admin');
  const assignable = owners.length > 0 ? owners : users;

  const buildTotals = (lines: Quote['lineItems'], currency: string) => {
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal.amount, 0);
    const lineDiscountTotal = lines.reduce((sum, line) => sum + line.discountAmount.amount, 0);
    const netSubtotal = subtotal - lineDiscountTotal;
    const monthly = lines.filter((line) => line.billing === 'monthly').reduce((sum, line) => sum + line.netTotal.amount, 0);
    const annual = lines.filter((line) => line.billing === 'annual').reduce((sum, line) => sum + line.netTotal.amount, 0);
    const oneTime = lines.filter((line) => line.billing === 'one_time').reduce((sum, line) => sum + line.netTotal.amount, 0);
    return {
      currency,
      subtotal: { amount: subtotal, currency },
      lineDiscountTotal: { amount: lineDiscountTotal, currency },
      orderDiscountPercent: 0,
      orderDiscountAmount: { amount: 0, currency },
      netSubtotal: { amount: netSubtotal, currency },
      // Tax is never calculated in this build, and the note says so wherever totals appear.
      taxTotal: { amount: 0, currency },
      taxNote: 'Tax is not calculated by the platform. The rate is recorded for reference only.',
      grandTotal: { amount: netSubtotal, currency },
      recurring: {
        oneTime: { amount: oneTime, currency },
        monthly: { amount: monthly, currency },
        quarterly: { amount: 0, currency },
        annual: { amount: annual, currency },
        annualisedTotal: { amount: annual + monthly * 12, currency },
      },
      margin: { costTotal: { amount: Math.round(netSubtotal * 0.4), currency }, marginAmount: { amount: Math.round(netSubtotal * 0.6), currency }, marginPercent: 60 },
    };
  };

  const quotes: Quote[] = deals.slice(0, Math.max(6, Math.round(deals.length * 0.22))).map((deal, index) => {
    const account = accounts.find((candidate) => candidate.id === deal.accountId) ?? accounts[0]!;
    const contact = contacts.find((candidate) => candidate.id === deal.primaryContactId);
    const owner = random.pick(assignable);
    const status = random.weighted([
      { value: 'draft' as const, weight: 16 },
      { value: 'sent' as const, weight: 22 },
      { value: 'pending_approval' as const, weight: 14 },
      { value: 'approved' as const, weight: 14 },
      { value: 'accepted' as const, weight: 24 },
      { value: 'declined' as const, weight: 6 },
      { value: 'expired' as const, weight: 4 },
    ]);
    const currency = organization.defaultCurrency;
    const lineCount = random.int(1, 3);
    const lineItems: Quote['lineItems'] = Array.from({ length: lineCount }, (_, lineIndex) => {
      const product = random.pick(products);
      const quantity = random.int(5, 180);
      const discountPercent = random.pick([0, 0, 5, 10, 15]);
      const gross = quantity * product.basePrice.amount;
      const discountAmount = Math.round(gross * (discountPercent / 100));
      return {
        id: `qli-${organization.id}-${index}-${lineIndex}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity,
        unitPrice: product.basePrice,
        listPrice: product.basePrice,
        discountPercent,
        discountAmount: { amount: discountAmount, currency },
        unitOfMeasure: product.unitOfMeasure,
        billing: product.billingPeriod ?? 'one_time',
        termMonths: product.billingPeriod === 'annual' ? 12 : undefined,
        taxPercent: undefined,
        subtotal: { amount: gross, currency },
        netTotal: { amount: gross - discountAmount, currency },
        isOptional: false,
        isRecurring: product.billingPeriod !== 'one_time',
        sortOrder: lineIndex,
        priceSource: 'price_book',
      };
    });

    const approvalSteps: Quote['approvalSteps'] = [
      { id: `qas-${index}-1`, order: 1, name: 'Sales manager approval', approverKind: 'manager', approverName: 'Line manager', thresholdNote: 'Required above 10% line discount', status: status === 'draft' ? 'pending' : random.pick(['approved', 'pending'] as const), decidedAt: status === 'draft' ? undefined : stamp(30, ctx) },
      { id: `qas-${index}-2`, order: 2, name: 'Finance review', approverKind: 'role', approverName: 'Finance', thresholdNote: 'Required above 20% order discount', status: status === 'pending_approval' ? 'pending' : status === 'draft' ? 'pending' : 'approved', decidedAt: status === 'pending_approval' ? undefined : stamp(25, ctx) },
    ];

    return {
      id: `quo-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `Q-${String(90000 + index * 4).padStart(5, '0')}`,
      name: `${account.name.split(' ')[0]} — commercial proposal`,
      accountId: account.id,
      accountName: account.name,
      contactId: contact?.id,
      contactName: contact?.displayName,
      dealId: deal.id,
      dealName: deal.name,
      opportunityStageLabel: undefined,
      ownerId: owner.id,
      ownerName: owner.displayName,
      status,
      version: random.int(1, 4),
      previousVersionIds: [],
      priceBookId,
      currency,
      issueDate: toDateString(random.pastDate(120, DATASET_EPOCH)),
      validUntil: toDateString(random.futureDate(45, DATASET_EPOCH)),
      contractTermMonths: random.pick([12, 24, 36]),
      billingFrequency: random.pick(['annual', 'monthly', 'one_time'] as const),
      lineItems,
      totals: buildTotals(lineItems, currency),
      approvalState: status === 'pending_approval' ? 'pending' : status === 'approved' || status === 'accepted' ? 'approved' : 'not_required',
      approvalSteps,
      templateId: undefined,
      templateName: 'Standard proposal',
      termsAndConditions: 'Payment terms are agreed in the order form. This document is a demonstration artefact.',
      notes: undefined,
      internalNotes: undefined,
      signatureRequest: { id: `sig-${index}`, status: status === 'accepted' ? 'signed' : status === 'sent' ? 'awaiting_customer' : 'not_started', simulated: true, signerCount: 2, signedCount: status === 'accepted' ? 2 : status === 'sent' ? 1 : 0, note: 'Signature capture is a workflow preview. Nothing is legally executed.' },
      deliveryState: status === 'draft' ? 'draft' : status === 'sent' ? 'simulated_sent' : status === 'accepted' ? 'simulated_viewed' : 'not_sent',
      sentAt: status === 'draft' ? undefined : stamp(60, ctx),
      viewedAt: random.chance(0.6) ? stamp(40, ctx) : undefined,
      acceptedAt: status === 'accepted' ? stamp(20, ctx) : undefined,
      declinedAt: status === 'declined' ? stamp(15, ctx) : undefined,
      declineReason: status === 'declined' ? random.pick(['Budget removed from this year', 'Chose an alternative supplier', 'Project deferred']) : undefined,
      tags: [],
      createdAt: stamp(140, ctx),
      updatedAt: stamp(10, ctx),
    };
  });

  const orders: Order[] = quotes.slice(0, Math.max(3, Math.round(quotes.length * 0.6))).map((quote, index) => {
    const status = random.weighted([
      { value: 'activated' as const, weight: 42 },
      { value: 'fulfilled' as const, weight: 22 },
      { value: 'draft' as const, weight: 14 },
      { value: 'pending_signature' as const, weight: 12 },
      { value: 'cancelled' as const, weight: 10 },
    ]);
    return {
      id: `ord-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `O-${String(60000 + index * 3).padStart(5, '0')}`,
      accountId: quote.accountId,
      accountName: quote.accountName,
      contactId: quote.contactId,
      quoteId: quote.id,
      dealId: quote.dealId,
      ownerId: quote.ownerId,
      ownerName: quote.ownerName,
      status,
      orderDate: toDateString(random.pastDate(90, DATASET_EPOCH)),
      effectiveDate: toDateString(random.pastDate(60, DATASET_EPOCH)),
      endDate: toDateString(random.futureDate(300, DATASET_EPOCH)),
      currency: quote.currency,
      lineItems: quote.lineItems,
      totals: quote.totals,
      billingState: status === 'activated' || status === 'fulfilled' ? 'billed' : 'not_billed',
      paymentState: random.pick(['paid', 'pending', 'partially_paid', 'not_due'] as const),
      invoicedAmount: quote.totals.grandTotal,
      paidAmount: { amount: Math.round(quote.totals.grandTotal.amount * random.float(0.4, 1, 3)), currency: quote.currency },
      billingFrequency: quote.billingFrequency,
      poNumber: random.chance(0.5) ? `PO-${random.int(100000, 999999)}` : undefined,
      fulfilment: { method: 'provisioning', statusNote: 'Provisioning is handled by the future backend integration.' },
      activatedAt: status === 'activated' || status === 'fulfilled' ? stamp(50, ctx) : undefined,
      tags: [],
      createdAt: stamp(100, ctx),
      updatedAt: stamp(15, ctx),
    };
  });

  const contracts: Contract[] = accounts.slice(0, Math.max(8, Math.round(accounts.length * 0.4))).map((account, index) => {
    const status = random.weighted([
      { value: 'active' as const, weight: 58 },
      { value: 'expiring_soon' as const, weight: 18 },
      { value: 'draft' as const, weight: 8 },
      { value: 'awaiting_signature' as const, weight: 8 },
      { value: 'expired' as const, weight: 8 },
    ]);
    const termMonths = random.pick([12, 24, 36]);
    const value = random.int(18, 620) * 1000;
    const endDate = status === 'expiring_soon' ? addDays(DATASET_EPOCH, random.int(20, 88)) : status === 'expired' ? addDays(DATASET_EPOCH, -random.int(10, 180)) : addDays(DATASET_EPOCH, random.int(120, 900));
    return {
      id: `ctr-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `CT-${String(40000 + index * 2).padStart(5, '0')}`,
      title: `${account.name} — subscription agreement`,
      accountId: account.id,
      accountName: account.name,
      ownerId: random.pick(assignable).id,
      ownerName: random.pick(assignable).displayName,
      status,
      type: random.pick(['subscription', 'service_agreement', 'license', 'statement_of_work'] as const),
      currency: organization.defaultCurrency,
      startDate: toDateString(addDays(endDate, -termMonths * 30)),
      endDate: toDateString(endDate),
      noticePeriodDays: random.pick([30, 60, 90]),
      autoRenew: random.chance(0.62),
      termMonths,
      contractValue: { amount: value, currency: organization.defaultCurrency },
      annualisedValue: { amount: Math.round((value / termMonths) * 12), currency: organization.defaultCurrency },
      billingFrequency: random.pick(['annual', 'monthly', 'quarterly'] as const),
      paymentTerms: random.pick(['net_30', 'net_45', 'net_60', 'due_on_receipt'] as const),
      renewalId: undefined,
      documents: [
        { id: `cdoc-${index}-1`, name: 'Main agreement.pdf', kind: 'main', version: random.int(1, 4), sizeBytes: random.int(80_000, 900_000), placeholder: true },
        ...(random.chance(0.4) ? [{ id: `cdoc-${index}-2`, name: 'Order form.pdf', kind: 'order_form' as const, version: 1, sizeBytes: random.int(40_000, 200_000), placeholder: true as const }] : []),
      ],
      signatureState: status === 'awaiting_signature' ? 'awaiting_customer' : status === 'draft' ? 'not_started' : 'executed',
      signatureSimulated: true,
      milestones: undefined,
      renewalOwnerId: random.pick(assignable).id,
      daysUntilExpiry: Math.round((endDate.getTime() - DATASET_EPOCH.getTime()) / 86_400_000),
      tags: [],
      createdAt: stamp(700, ctx),
      updatedAt: stamp(30, ctx),
    };
  });

  const invoices: InvoiceRecord[] = contracts.slice(0, Math.max(6, Math.round(contracts.length * 0.8))).map((contract, index) => {
    const status = random.weighted([
      { value: 'payment_received' as const, weight: 52 },
      { value: 'payment_pending' as const, weight: 16 },
      { value: 'overdue' as const, weight: 14 },
      { value: 'issued' as const, weight: 12 },
      { value: 'draft' as const, weight: 6 },
    ]);
    const total = Math.round(contract.annualisedValue.amount * random.float(0.2, 0.4, 3));
    const paid = status === 'payment_received' ? total : status === 'overdue' ? 0 : Math.round(total * random.float(0, 0.6, 3));
    // Dates and status have to agree, or the outstanding/overdue summary on the invoice screen
    // reads as a mistake. `overdue` is issued far enough back to actually be past its due date;
    // a settled invoice may sit anywhere in the last six months; anything still in draft, only
    // issued, or awaiting clearance is dated so its due date has not arrived yet.
    const issue =
      status === 'overdue'
        ? random.pastDate(135, addDays(DATASET_EPOCH, -45))
        : status === 'payment_received'
          ? random.pastDate(180, DATASET_EPOCH)
          : random.pastDate(29, DATASET_EPOCH);
    const due = addDays(issue, 30);
    const paidAt = new Date(Math.min(addDays(issue, random.int(6, 26)).getTime(), DATASET_EPOCH.getTime()));
    return {
      id: `inv-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `INV-2026-${String(index + 1).padStart(4, '0')}`,
      accountId: contract.accountId,
      accountName: contract.accountName,
      contractId: contract.id,
      orderId: orders[index % Math.max(1, orders.length)]?.id,
      status,
      issueDate: toDateString(issue),
      dueDate: toDateString(due),
      paidDate: status === 'payment_received' ? toDateString(paidAt) : undefined,
      documentKind: 'crm_reference_only',
      currency: organization.defaultCurrency,
      subtotal: { amount: total, currency: organization.defaultCurrency },
      discountTotal: { amount: 0, currency: organization.defaultCurrency },
      taxTotal: { amount: 0, currency: organization.defaultCurrency },
      total: { amount: total, currency: organization.defaultCurrency },
      amountPaid: { amount: paid, currency: organization.defaultCurrency },
      balanceDue: { amount: total - paid, currency: organization.defaultCurrency },
      taxJurisdiction: organization.countryCode,
      taxRateDisplay: undefined,
      taxNote: 'Tax is recorded by the accounting system, not calculated here.',
      paymentMethodLabel: random.pick(['Bank transfer', 'Card', 'Direct debit']),
      paymentReferenceMasked: `REF-****${random.int(1000, 9999)}`,
      dunningStage: status === 'overdue' ? random.pick(['reminder_1', 'reminder_2', 'final_notice'] as const) : 'none',
      notes: undefined,
      createdAt: stamp(200, ctx),
      updatedAt: stamp(12, ctx),
    };
  });

  const subscriptions: RevenueSubscription[] = contracts.slice(0, Math.max(6, Math.round(contracts.length * 0.7))).map((contract, index) => {
    const mrr = Math.round(contract.annualisedValue.amount / 12);
    const status = random.weighted([
      { value: 'active' as const, weight: 78 },
      { value: 'trialing' as const, weight: 8 },
      { value: 'past_due' as const, weight: 6 },
      { value: 'cancelled' as const, weight: 8 },
    ]);
    return {
      id: `sub-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `SUB-${String(1000 + index).padStart(4, '0')}`,
      accountId: contract.accountId,
      accountName: contract.accountName,
      contractId: contract.id,
      productId: undefined,
      productName: 'Platform subscription',
      status,
      planName: random.pick(['Professional', 'Enterprise', 'Starter']),
      quantity: random.int(8, 420),
      unitOfMeasure: 'seat',
      unitPrice: { amount: Math.round(mrr / Math.max(1, random.int(8, 60))), currency: organization.defaultCurrency },
      billingFrequency: random.pick(['annual', 'monthly'] as const),
      mrr: { amount: mrr, currency: organization.defaultCurrency },
      arr: { amount: mrr * 12, currency: organization.defaultCurrency },
      currency: organization.defaultCurrency,
      startDate: contract.startDate,
      currentPeriodStart: toDateString(addDays(DATASET_EPOCH, -30)),
      currentPeriodEnd: toDateString(addDays(DATASET_EPOCH, 30)),
      cancelledAt: status === 'cancelled' ? stamp(60, ctx) : undefined,
      cancelReason: status === 'cancelled' ? random.pick(['Consolidated vendors', 'Budget reduction', 'Merged with another entity']) : undefined,
      renewalDate: contract.endDate,
      autoRenew: contract.autoRenew,
      movement: random.pick(['new', 'expansion', 'contraction', 'flat', 'flat', 'reactivation'] as const),
      previousMrr: { amount: Math.round(mrr * random.float(0.7, 1.1, 3)), currency: organization.defaultCurrency },
      ownerId: contract.ownerId,
      ownerName: contract.ownerName,
      tags: [],
      createdAt: stamp(600, ctx),
      updatedAt: stamp(20, ctx),
    };
  });

  // A movement bridge with an empty churn column demonstrates nothing, and the weighted draw
  // above can and regularly does produce a tenant with no cancelled subscription at all. Every
  // tenant therefore ends with one cancelled subscription, classified as churn.
  if (!subscriptions.some((subscription) => subscription.status === 'cancelled')) {
    const churned = subscriptions[subscriptions.length - 1];
    if (churned) {
      churned.status = 'cancelled';
      churned.movement = 'churn';
      churned.autoRenew = false;
      churned.cancelledAt = toDateTimeString(addDays(DATASET_EPOCH, -45));
      churned.cancelReason = 'Consolidated onto a single vendor at renewal.';
    }
  }

  const commissions: CommissionStatement[] = assignable.slice(0, 6).map((user, index) => {
    const bookings = random.int(180, 2400) * 1000;
    const rate = random.float(0.04, 0.12, 3);
    const earned = Math.round(bookings * rate);
    return {
      id: `comm-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      planId: `cplan-${organization.id}-1`,
      planName: 'New business commission',
      userId: user.id,
      userName: user.displayName,
      periodStart: toDateString(addDays(DATASET_EPOCH, -90)),
      periodEnd: toDateString(addDays(DATASET_EPOCH, -1)),
      status: random.pick(['draft', 'pending_approval', 'approved', 'paid'] as const),
      quotaAttainmentPercent: random.float(48, 186, 1),
      bookingsTotal: { amount: bookings, currency: organization.defaultCurrency },
      commissionEarned: { amount: earned, currency: organization.defaultCurrency },
      commissionAdjustments: { amount: random.chance(0.2) ? -Math.round(earned * 0.05) : 0, currency: organization.defaultCurrency },
      commissionPaid: { amount: Math.round(earned * random.float(0.4, 1, 3)), currency: organization.defaultCurrency },
      commissionPending: { amount: Math.round(earned * random.float(0, 0.5, 3)), currency: organization.defaultCurrency },
      currency: organization.defaultCurrency,
      lines: deals.slice(0, 4).map((deal, lineIndex) => ({
        id: `cl-${index}-${lineIndex}`,
        dealId: deal.id,
        dealName: deal.name,
        accountName: deal.accountName,
        closedAt: deal.actualCloseDate,
        basisAmount: deal.amount,
        ratePercent: rate * 100,
        amount: { amount: Math.round(deal.amount.amount * rate), currency: organization.defaultCurrency },
        kind: deal.dealType === 'renewal' ? ('renewal' as const) : deal.dealType === 'expansion' ? ('expansion' as const) : ('new_business' as const),
        note: undefined,
      })),
      calculatedAt: toDateTimeString(DATASET_EPOCH),
      calculationState: 'demo_local_calculation',
      createdAt: stamp(95, ctx),
      updatedAt: stamp(5, ctx),
    };
  });

  return { quotes, orders, contracts, invoices, subscriptions, commissions };
}

/* --------------------------------------------------------- customer success */

export function makeCustomerSuccess(ctx: OrgContext, accounts: Account[], contacts: import('@crm/shared-types').Contact[], contracts: Contract[]): {
  renewals: Renewal[];
  onboardingPlans: OnboardingPlan[];
  successPlans: SuccessPlan[];
  businessReviews: BusinessReview[];
  portfolios: import('@crm/shared-types').SuccessPortfolio[];
} {
  const { random, organization, users } = ctx;
  const csms = users.filter((user) => user.persona === 'success_manager' || user.persona === 'account_manager' || user.persona === 'org_admin');
  const assignable = csms.length > 0 ? csms : users;

  const renewals: Renewal[] = contracts.map((contract, index) => {
    const account = accounts.find((candidate) => candidate.id === contract.accountId) ?? accounts[0]!;
    const current = contract.annualisedValue;
    const changeKind = random.weighted([
      { value: 'expansion' as const, weight: 34 },
      { value: 'flat' as const, weight: 42 },
      { value: 'contraction' as const, weight: 17 },
      { value: 'churn' as const, weight: 7 },
    ]);
    const factor = changeKind === 'expansion' ? random.float(1.08, 1.42, 3) : changeKind === 'contraction' ? random.float(0.52, 0.92, 3) : changeKind === 'churn' ? 0 : 1;
    const proposed = Math.round(current.amount * factor);
    const days = Math.round((new Date(contract.endDate).getTime() - DATASET_EPOCH.getTime()) / 86_400_000);
    return {
      id: `ren-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      accountId: account.id,
      accountName: account.name,
      contractId: contract.id,
      contractReference: contract.reference,
      ownerId: random.pick(assignable).id,
      ownerName: random.pick(assignable).displayName,
      stage: days < 0 ? random.pick(['lost', 'churned'] as const) : days < 45 ? random.pick(['negotiation', 'commit', 'upcoming'] as const) : random.pick(['upcoming', 'outreach'] as const),
      renewalDate: contract.endDate,
      daysUntilRenewal: days,
      termMonths: contract.termMonths,
      currentValue: current,
      proposedValue: { amount: proposed, currency: organization.defaultCurrency },
      changeAmount: { amount: proposed - current.amount, currency: organization.defaultCurrency },
      changePercent: current.amount > 0 ? Number((((proposed - current.amount) / current.amount) * 100).toFixed(1)) : 0,
      changeKind,
      probability: changeKind === 'churn' ? random.int(5, 25) : random.int(45, 95),
      healthScore: account.healthScore ?? 60,
      healthBand: account.health,
      riskFactors: account.healthScore && account.healthScore < 60
        ? [{ label: 'Support volume increased', severity: 'high' as const }, { label: 'Executive sponsor changed', severity: 'medium' as const }]
        : [{ label: 'No material risk identified', severity: 'low' as const }],
      nextStep: random.pick(['Confirm the renewal owner', 'Schedule the value review', 'Share the renewal proposal', 'Confirm budget availability']),
      nextActivityAt: future(14, ctx),
      forecastCategory: random.pick(['commit', 'best_case', 'pipeline'] as const),
      currency: organization.defaultCurrency,
      autoRenew: contract.autoRenew,
      noticePeriodDays: contract.noticePeriodDays,
      createdAt: stamp(200, ctx),
      updatedAt: stamp(8, ctx),
    };
  });

  const onboardingPlans: OnboardingPlan[] = accounts.slice(0, 8).map((account, index) => {
    const start = addDays(DATASET_EPOCH, -random.int(5, 120));
    const progress = random.int(18, 100);
    const phases: OnboardingPlan['phases'] = [
      { id: `op-${index}-p1`, name: 'Kickoff', description: 'Teams introduced and success criteria agreed.', order: 1, status: progress > 20 ? 'completed' : 'in_progress', dueDate: toDateString(addDays(start, 7)), progressPercent: progress > 20 ? 100 : 40, tasks: [
        { id: `ot-${index}-1`, title: 'Schedule the kickoff call', ownerKind: 'internal', ownerName: 'Customer success', status: progress > 20 ? 'completed' : 'in_progress', isMilestone: false, completedAt: progress > 20 ? toDateTimeString(addDays(start, 5)) : undefined },
        { id: `ot-${index}-2`, title: 'Confirm the customer project team', ownerKind: 'customer', ownerName: 'Customer sponsor', status: progress > 25 ? 'completed' : 'not_started', isMilestone: true },
      ] },
      { id: `op-${index}-p2`, name: 'Configuration', description: 'Objects, fields, layouts and the pipeline configured.', order: 2, status: progress > 55 ? 'completed' : progress > 20 ? 'in_progress' : 'not_started', dueDate: toDateString(addDays(start, 28)), progressPercent: Math.max(0, Math.min(100, progress - 20)), tasks: [
        { id: `ot-${index}-3`, title: 'Configure the pipeline stages', ownerKind: 'internal', ownerName: 'Implementation', status: progress > 55 ? 'completed' : 'in_progress', isMilestone: false },
        { id: `ot-${index}-4`, title: 'Import the existing data', ownerKind: 'customer', ownerName: 'Customer IT', status: progress > 60 ? 'completed' : progress > 30 ? 'in_progress' : 'not_started', isMilestone: true },
        { id: `ot-${index}-5`, title: 'Configure roles and permissions', ownerKind: 'internal', ownerName: 'Implementation', status: progress > 65 ? 'completed' : 'not_started', isMilestone: false },
      ] },
      { id: `op-${index}-p3`, name: 'Enablement', description: 'Team trained and using the platform daily.', order: 3, status: progress >= 100 ? 'completed' : progress > 70 ? 'in_progress' : 'not_started', dueDate: toDateString(addDays(start, 56)), progressPercent: Math.max(0, Math.min(100, progress - 60)), tasks: [
        { id: `ot-${index}-6`, title: 'Run the admin training session', ownerKind: 'internal', ownerName: 'Enablement', status: progress > 80 ? 'completed' : 'not_started', isMilestone: false },
        { id: `ot-${index}-7`, title: 'Hold the go-live review', ownerKind: 'internal', ownerName: 'Customer success', status: progress >= 100 ? 'completed' : 'not_started', isMilestone: true },
      ] },
    ];
    return {
      id: `obp-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      accountId: account.id,
      accountName: account.name,
      dealId: undefined,
      createdByWorkflowId: `wf-${organization.id}-2`,
      status: progress >= 100 ? 'completed' : progress > 40 ? 'in_progress' : 'not_started',
      templateId: undefined,
      templateName: 'Standard 8-week onboarding',
      managerId: random.pick(assignable).id,
      managerName: random.pick(assignable).displayName,
      customerTeam: contacts.filter((contact) => contact.accountId === account.id).slice(0, 3).map((contact) => ({ contactId: contact.id, name: contact.displayName, role: contact.jobTitle ?? 'Stakeholder', lastActiveAt: toDateTimeString(random.pastDate(20, DATASET_EPOCH)) })),
      startDate: toDateString(start),
      targetGoLiveDate: toDateString(addDays(start, 56)),
      completedAt: progress >= 100 ? toDateTimeString(addDays(start, 52)) : undefined,
      progressPercent: progress,
      phases,
      timeToFirstValueDays: progress > 50 ? random.int(9, 48) : undefined,
      blockers: progress < 60 && random.chance(0.5) ? [{ id: `blk-${index}`, label: 'Waiting on customer IT for the data extract', raisedAt: toDateTimeString(addDays(start, 20)), owner: 'Customer IT' }] : [],
      createdAt: toDateTimeString(start),
      updatedAt: stamp(4, ctx),
    };
  });

  const successPlans: SuccessPlan[] = accounts.slice(0, 6).map((account, index) => {
    const objectives: SuccessPlan['objectives'] = [
      { id: `so-${index}-1`, title: 'Increase weekly active users', description: 'Grow adoption across the operations team.', metric: 'Weekly active users', baselineValue: `${random.int(30, 80)}`, targetValue: `${random.int(140, 320)}`, currentValue: `${random.int(40, 200)}`, progressPercent: random.int(20, 95), status: random.pick(['on_track', 'on_track', 'at_risk', 'achieved'] as const), dueDate: toDateString(addDays(DATASET_EPOCH, random.int(30, 180))), tone: 'violet' },
      { id: `so-${index}-2`, title: 'Reduce manual data entry per week', description: 'Replace the spreadsheet handoffs.', metric: 'Hours per week', baselineValue: `${random.int(20, 60)}`, targetValue: `${random.int(2, 10)}`, currentValue: `${random.int(6, 30)}`, progressPercent: random.int(30, 90), status: random.pick(['on_track', 'off_track', 'at_risk'] as const), dueDate: toDateString(addDays(DATASET_EPOCH, random.int(60, 240))), tone: 'teal' },
      { id: `so-${index}-3`, title: 'Achieve first-value milestone', metric: 'Days to first value', baselineValue: 'n/a', targetValue: '30 days', currentValue: `${random.int(12, 60)} days`, progressPercent: random.int(40, 100), status: random.pick(['achieved', 'on_track'] as const), tone: 'green' },
    ];
    return {
      id: `sp-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      accountId: account.id,
      accountName: account.name,
      name: `${account.name.split(' ')[0]} success plan`,
      status: random.pick(['active', 'active', 'on_hold', 'completed'] as const),
      ownerId: random.pick(assignable).id,
      ownerName: random.pick(assignable).displayName,
      startDate: toDateString(random.pastDate(240, DATASET_EPOCH)),
      targetDate: toDateString(addDays(DATASET_EPOCH, random.int(90, 300))),
      objectives,
      overallProgress: Math.round(objectives.reduce((sum, objective) => sum + objective.progressPercent, 0) / objectives.length),
      customerStakeholders: contacts.filter((contact) => contact.accountId === account.id).slice(0, 3).map((contact, stakeholderIndex) => ({ contactId: contact.id, name: contact.displayName, role: contact.jobTitle, engagement: (['high', 'medium', 'low', 'unknown'] as const)[stakeholderIndex % 4]! })),
      internalTeam: [{ userId: random.pick(assignable).id, name: random.pick(assignable).displayName, role: 'Customer success manager' }],
      risks: account.healthScore && account.healthScore < 60
        ? [{ id: `spr-${index}`, label: 'Adoption stalled in the second team', severity: 'high' as const, mitigation: 'Run a targeted enablement session', status: 'mitigated' as const }]
        : [],
      notes: undefined,
      createdAt: stamp(250, ctx),
      updatedAt: stamp(6, ctx),
    };
  });

  const businessReviews: BusinessReview[] = accounts.slice(0, 10).map((account, index) => {
    const scheduled = addDays(DATASET_EPOCH, random.int(-90, 90));
    const completed = scheduled.getTime() < DATASET_EPOCH.getTime();
    return {
      id: `br-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      accountId: account.id,
      accountName: account.name,
      kind: random.pick(['qbr', 'qbr', 'ebr', 'monthly_checkin', 'renewal_review'] as const),
      status: completed ? 'completed' : 'scheduled',
      scheduledAt: toDateTimeString(scheduled),
      durationMinutes: random.pick([45, 60, 90]),
      ownerId: random.pick(assignable).id,
      ownerName: random.pick(assignable).displayName,
      attendees: [
        { id: random.pick(assignable).id, name: random.pick(assignable).displayName, kind: 'internal', role: 'Customer success manager' },
        { id: account.id, name: account.name, kind: 'external', role: 'Customer sponsor' },
      ],
      agendaItems: [
        { id: `ai-${index}-1`, title: 'Adoption and usage review', durationMinutes: 20, presenter: 'Customer success', done: completed },
        { id: `ai-${index}-2`, title: 'Support summary and open issues', durationMinutes: 15, presenter: 'Service', done: completed },
        { id: `ai-${index}-3`, title: 'Roadmap alignment and next steps', durationMinutes: 25, presenter: 'Account team', done: completed },
      ],
      presentationOutline: [
        { title: 'Where we are', bullets: ['Adoption trend over the period', 'Support volume and resolution times', 'Health score movement'] },
        { title: 'What changed', bullets: ['Modules enabled', 'Processes automated', 'Outstanding risks'] },
        { title: 'What is next', bullets: ['Agreed actions with owners', 'Renewal timeline', 'Expansion opportunities'] },
      ],
      outcomes: completed ? ['Customer confirmed the rollout plan for the second region.'] : undefined,
      actionItems: completed ? [{ id: `bi-${index}`, text: 'Share the enablement recording with the regional team', ownerName: 'Customer success', dueDate: toDateString(addDays(scheduled, 14)), done: random.chance(0.5) }] : undefined,
      nextReviewAt: completed ? toDateTimeString(addDays(scheduled, 90)) : undefined,
      healthAtReview: account.healthScore,
      createdAt: toDateTimeString(addDays(scheduled, -30)),
      updatedAt: stamp(5, ctx),
    };
  });

  const portfolios: import('@crm/shared-types').SuccessPortfolio[] = assignable.slice(0, 3).map((user, index) => {
    const owned = accounts.slice(index * 5, index * 5 + 6);
    const arr = owned.reduce((sum, account) => sum + (account.lifetimeValue?.amount ?? 0), 0);
    return {
      id: `pf-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      name: `${user.displayName.split(' ')[0]}'s portfolio`,
      description: 'Accounts assigned to this customer success manager.',
      ownerId: user.id,
      ownerName: user.displayName,
      accountIds: owned.map((account) => account.id),
      summary: {
        accountCount: owned.length,
        totalArr: { amount: arr, currency: organization.defaultCurrency },
        atRiskCount: owned.filter((account) => account.health === 'at_risk' || account.health === 'critical').length,
        healthyCount: owned.filter((account) => account.health === 'healthy' || account.health === 'thriving').length,
        averageHealth: owned.length > 0 ? Math.round(owned.reduce((sum, account) => sum + (account.healthScore ?? 0), 0) / owned.length) : 0,
        renewalsNext90Days: random.int(0, 4),
        upcomingReviews: random.int(0, 5),
      },
      segment: index === 0 ? 'strategic' : 'mid_market',
      createdAt: stamp(400, ctx),
      updatedAt: stamp(20, ctx),
    };
  });

  return { renewals, onboardingPlans, successPlans, businessReviews, portfolios };
}

/* ----------------------------------------------------- projects & delivery */

export function makeProjects(ctx: OrgContext, deals: Deal[], accounts: Account[]): { projects: Project[]; tasks: ProjectTask[]; milestones: ProjectMilestone[] } {
  const { random, organization, users } = ctx;
  const managers = users.filter((user) => user.persona === 'success_manager' || user.persona === 'org_admin' || user.persona === 'account_manager');
  const assignable = managers.length > 0 ? managers : users;
  const wonDeals = deals.filter((deal) => deal.status === 'won').slice(0, 8);

  const projects: Project[] = (wonDeals.length > 0 ? wonDeals : deals.slice(0, 5)).map((deal, index) => {
    const account = accounts.find((candidate) => candidate.id === deal.accountId) ?? accounts[0]!;
    const start = addDays(DATASET_EPOCH, -random.int(20, 220));
    const target = addDays(start, random.int(60, 200));
    const progress = random.int(10, 100);
    const status: Project['status'] = progress >= 100 ? 'completed' : progress > 70 ? random.pick(['in_progress', 'at_risk'] as const) : random.pick(['planning', 'in_progress', 'blocked'] as const);
    const manager = random.pick(assignable);
    return {
      id: `prj-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `P-${String(8000 + index * 3).padStart(4, '0')}`,
      name: `${account.name.split(' ')[0]} — implementation`,
      description: 'Delivery project created from a closed-won deal.',
      accountId: account.id,
      accountName: account.name,
      dealId: deal.id,
      contractId: undefined,
      orderId: undefined,
      createdByWorkflowId: `wf-${organization.id}-2`,
      handoff: {
        state: 'accepted',
        fromOwnerId: deal.ownerId,
        fromOwnerName: deal.teamMembers[0]?.name,
        toManagerId: manager.id,
        toManagerName: manager.displayName,
        handoffAt: toDateTimeString(addDays(start, -3)),
        checklist: [
          { id: `hc-${index}-1`, label: 'Deal summary reviewed', done: true },
          { id: `hc-${index}-2`, label: 'Commercial terms confirmed', done: true },
          { id: `hc-${index}-3`, label: 'Customer stakeholders introduced', done: progress > 30 },
          { id: `hc-${index}-4`, label: 'Delivery schedule agreed', done: progress > 40 },
        ],
      },
      templateName: 'Standard implementation',
      status,
      priority: random.pick(['high', 'normal', 'normal', 'low'] as const),
      managerId: manager.id,
      managerName: manager.displayName,
      teamMembers: [
        { userId: manager.id, name: manager.displayName, role: 'manager', allocationPercent: random.int(20, 80) },
        { userId: random.pick(assignable).id, name: random.pick(assignable).displayName, role: 'contributor', allocationPercent: random.int(10, 60) },
      ],
      startDate: toDateString(start),
      targetEndDate: toDateString(target),
      actualEndDate: progress >= 100 ? toDateString(addDays(target, random.int(-15, 25))) : undefined,
      currency: organization.defaultCurrency,
      budget: { amount: random.int(40, 480) * 1000, currency: organization.defaultCurrency },
      budgetSpent: { amount: random.int(10, 400) * 1000, currency: organization.defaultCurrency },
      billingType: random.pick(['fixed_fee', 'milestone', 'time_and_materials'] as const),
      progressPercent: progress,
      health: status === 'at_risk' ? 'at_risk' : status === 'blocked' ? 'blocked' : progress > 40 ? 'on_track' : 'on_track',
      healthReasons: status === 'at_risk' ? ['Two milestones slipped by more than a week'] : undefined,
      taskCount: 0,
      openTaskCount: 0,
      overdueTaskCount: 0,
      milestoneCount: 3,
      completedMilestoneCount: Math.round((progress / 100) * 3),
      riskCount: random.int(0, 3),
      issueCount: random.int(0, 2),
      customerVisible: true,
      tags: [],
      createdAt: toDateTimeString(addDays(start, -5)),
      updatedAt: stamp(3, ctx),
    };
  });

  const tasks: ProjectTask[] = [];
  const milestones: ProjectMilestone[] = [];
  const taskTitles = ['Configure the workspace', 'Import the customer data', 'Validate the import results', 'Run the admin training session', 'Configure the pipeline stages', 'Set up the integrations', 'Run the user acceptance session', 'Prepare the go-live checklist', 'Hold the go-live review', 'Hand over to support'];

  projects.forEach((project, projectIndex) => {
    const start = new Date(project.startDate);
    for (let index = 0; index < 8; index += 1) {
      const due = addDays(start, (index + 1) * 10);
      const status: ProjectTask['status'] = project.progressPercent > (index + 1) * 12 ? 'done' : project.progressPercent > index * 12 ? 'in_progress' : random.pick(['todo', 'backlog', 'blocked'] as const);
      const assignee = random.pick(project.teamMembers);
      tasks.push({
        id: `ptk-${organization.id}-${projectIndex + 1}-${index + 1}`,
        organizationId: organization.id,
        projectId: project.id,
        projectName: project.name,
        reference: `${project.reference}-T${index + 1}`,
        title: taskTitles[index % taskTitles.length]!,
        description: 'Demonstration delivery task.',
        status,
        priority: random.pick(['normal', 'high', 'low'] as const),
        assigneeId: assignee.userId,
        assigneeName: assignee.name,
        reporterId: project.managerId,
        startDate: toDateString(addDays(due, -7)),
        dueDate: toDateString(due),
        completedAt: status === 'done' ? toDateTimeString(addDays(due, -random.int(0, 3))) : undefined,
        estimateHours: random.pick([2, 4, 8, 16]),
        loggedHours: status === 'done' ? random.int(2, 18) : random.int(0, 6),
        progressPercent: status === 'done' ? 100 : status === 'in_progress' ? random.int(20, 80) : 0,
        dependsOnIds: index > 0 ? [`ptk-${organization.id}-${projectIndex + 1}-${index}`] : [],
        blockedReason: status === 'blocked' ? 'Waiting on the customer for a data extract' : undefined,
        labels: [],
        checklist: [],
        customerVisible: random.chance(0.5),
        commentCount: random.int(0, 6),
        attachmentCount: random.int(0, 3),
        order: index,
        createdAt: toDateTimeString(addDays(due, -14)),
        updatedAt: stamp(2, ctx),
      });
    }

    for (let index = 0; index < 3; index += 1) {
      const due = addDays(start, (index + 1) * 28);
      const completed = project.progressPercent > (index + 1) * 33;
      milestones.push({
        id: `pms-${organization.id}-${projectIndex + 1}-${index + 1}`,
        projectId: project.id,
        name: ['Configuration complete', 'Data imported and validated', 'Go-live accepted'][index]!,
        description: 'Billable milestone tied to the delivery schedule.',
        dueDate: toDateString(due),
        completedAt: completed ? toDateTimeString(addDays(due, -random.int(0, 4))) : undefined,
        status: completed ? 'completed' : due.getTime() < DATASET_EPOCH.getTime() ? 'at_risk' : 'pending',
        billableAmount: { amount: Math.round((project.budget?.amount ?? 0) / 3), currency: organization.defaultCurrency },
        invoiced: completed && random.chance(0.7),
        deliverableIds: [],
        ownerId: project.managerId,
        customerApprovalRequired: index === 2,
        customerApprovedAt: completed && index === 2 ? stamp(10, ctx) : undefined,
        createdAt: toDateTimeString(addDays(due, -40)),
        updatedAt: stamp(4, ctx),
      });
    }

    project.taskCount = tasks.filter((task) => task.projectId === project.id).length;
    project.openTaskCount = tasks.filter((task) => task.projectId === project.id && task.status !== 'done' && task.status !== 'cancelled').length;
    project.overdueTaskCount = tasks.filter((task) => task.projectId === project.id && task.status !== 'done' && new Date(task.dueDate ?? 0).getTime() < DATASET_EPOCH.getTime()).length;
    project.milestoneCount = milestones.filter((milestone) => milestone.projectId === project.id).length;
  });

  return { projects, tasks, milestones };
}

/* ---------------------------------------------------------- field selling */

export function makeFieldSales(ctx: OrgContext, accounts: Account[], contacts: import('@crm/shared-types').Contact[]): { territories: Territory[]; visitPlans: VisitPlan[]; visitLogs: VisitLog[] } {
  const { random, organization, users } = ctx;
  const reps = users.filter((user) => user.persona === 'field_rep' || user.persona === 'sales_rep' || user.persona === 'account_manager' || user.persona === 'org_admin');
  const assignable = reps.length > 0 ? reps : users;

  const territories: Territory[] = [
    { id: `ter-${organization.id}-1`, organizationId: organization.id, name: 'Metro north', code: 'TN-01', kind: 'geographic', description: 'Northern metropolitan accounts.', geography: { countryCodes: [organization.countryCode], regions: ['North'], postalCodePrefixes: ['60', '61'] }, ownerId: assignable[0]?.id, ownerName: assignable[0]?.displayName, memberIds: assignable.slice(0, 2).map((user) => user.id), accountCount: 0, openPipeline: { amount: 0, currency: organization.defaultCurrency }, wonValue: { amount: 0, currency: organization.defaultCurrency }, quota: { amount: random.int(400, 1800) * 1000, currency: organization.defaultCurrency }, attainmentPercent: random.float(52, 142, 1), visitTargetPerMonth: 42, visitsLast30Days: 0, coveragePercent: 0, tone: 'violet', isActive: true, createdAt: stamp(400, ctx), updatedAt: stamp(20, ctx) },
    { id: `ter-${organization.id}-2`, organizationId: organization.id, name: 'Metro south', code: 'TN-02', kind: 'geographic', description: 'Southern metropolitan accounts.', geography: { countryCodes: [organization.countryCode], regions: ['South'], postalCodePrefixes: ['70', '71'] }, ownerId: assignable[1]?.id, ownerName: assignable[1]?.displayName, memberIds: assignable.slice(2, 4).map((user) => user.id), accountCount: 0, openPipeline: { amount: 0, currency: organization.defaultCurrency }, wonValue: { amount: 0, currency: organization.defaultCurrency }, quota: { amount: random.int(400, 1600) * 1000, currency: organization.defaultCurrency }, attainmentPercent: random.float(48, 128, 1), visitTargetPerMonth: 36, visitsLast30Days: 0, coveragePercent: 0, tone: 'teal', isActive: true, createdAt: stamp(400, ctx), updatedAt: stamp(20, ctx) },
    { id: `ter-${organization.id}-3`, organizationId: organization.id, name: 'Regional distributors', code: 'RD-01', kind: 'named_account', description: 'Named distributor accounts regardless of location.', geography: { countryCodes: [organization.countryCode], regions: ['All'], postalCodePrefixes: [] }, ownerId: assignable[0]?.id, ownerName: assignable[0]?.displayName, memberIds: assignable.slice(0, 3).map((user) => user.id), accountCount: 0, openPipeline: { amount: 0, currency: organization.defaultCurrency }, wonValue: { amount: 0, currency: organization.defaultCurrency }, quota: { amount: random.int(600, 2400) * 1000, currency: organization.defaultCurrency }, attainmentPercent: random.float(58, 156, 1), visitTargetPerMonth: 24, visitsLast30Days: 0, coveragePercent: 0, tone: 'amber', isActive: true, createdAt: stamp(400, ctx), updatedAt: stamp(20, ctx) },
  ];

  const visitPlans: VisitPlan[] = [];
  const visitLogs: VisitLog[] = [];

  assignable.slice(0, 4).forEach((rep, repIndex) => {
    for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      const date = addDays(DATASET_EPOCH, dayOffset - 2);
      const stopCount = random.int(3, 6);
      const stops: VisitPlan['stops'] = [];
      let clock = new Date(date);
      clock.setHours(8, 30, 0, 0);
      for (let stopIndex = 0; stopIndex < stopCount; stopIndex += 1) {
        const account = random.pick(accounts);
        const contact = contacts.find((candidate) => candidate.accountId === account.id);
        clock = new Date(clock.getTime() + random.int(45, 150) * 60_000);
        stops.push({
          id: `stop-${organization.id}-${repIndex}-${dayOffset}-${stopIndex}`,
          order: stopIndex + 1,
          accountId: account.id,
          accountName: account.name,
          addressLabel: `${account.addresses[0]?.line1 ?? 'Address'}, ${account.addresses[0]?.city ?? ''}`.trim(),
          contactId: contact?.id,
          contactName: contact?.displayName,
          plannedStartAt: toDateTimeString(clock),
          plannedDurationMinutes: random.pick([30, 45, 60]),
          purpose: random.pick(['check_in', 'demo', 'review', 'training', 'relationship'] as const),
          status: date.getTime() < DATASET_EPOCH.getTime() ? random.pick(['visited', 'visited', 'visited', 'skipped'] as const) : 'planned',
          priority: random.pick(['high', 'normal', 'normal', 'low'] as const),
        });
      }

      const plan: VisitPlan = {
        id: `vp-${organization.id}-${repIndex}-${dayOffset}`,
        organizationId: organization.id,
        name: `${rep.displayName.split(' ')[0]} — ${toDateString(date)}`,
        userId: rep.id,
        userName: rep.displayName,
        date: toDateString(date),
        territoryId: territories[repIndex % territories.length]!.id,
        territoryName: territories[repIndex % territories.length]!.name,
        status: date.getTime() < DATASET_EPOCH.getTime() ? 'completed' : dayOffset === 2 ? 'in_progress' : 'planned',
        stops,
        route: { totalDistanceKm: random.float(18, 164, 1), estimatedDriveMinutes: random.int(45, 240), routingState: 'not_configured', mapPlaceholderNote: 'No routing or map provider is connected. Distance and drive time are estimates computed locally for demonstration.' },
        notes: undefined,
        createdAt: stamp(6, ctx),
        updatedAt: stamp(1, ctx),
      };
      visitPlans.push(plan);

      for (const stop of stops.filter((candidate) => candidate.status === 'visited')) {
        const checkInAt = new Date(stop.plannedStartAt);
        const duration = random.int(18, 95);
        const log: VisitLog = {
          id: `vl-${stop.id}`,
          organizationId: organization.id,
          accountId: stop.accountId,
          accountName: stop.accountName,
          contactId: stop.contactId,
          contactName: stop.contactName,
          userId: rep.id,
          userName: rep.displayName,
          visitPlanId: plan.id,
          visitStopId: stop.id,
          checkIn: {
            at: toDateTimeString(checkInAt),
            locationLabel: stop.addressLabel,
            // The type makes this explicit: a label was chosen, no device location was read.
            locationSource: random.chance(0.7) ? 'manual_selection' : 'typed_address',
            coordinatesPlaceholder: undefined,
            gpsUsed: false,
            note: 'Location label recorded manually. No device location was collected.',
          },
          checkOut: { at: toDateTimeString(addDays(checkInAt, duration / 1440)), durationMinutes: duration },
          durationMinutes: duration,
          purpose: stop.purpose,
          outcome: random.weighted([
            { value: 'positive' as const, weight: 52 },
            { value: 'neutral' as const, weight: 26 },
            { value: 'follow_up_required' as const, weight: 14 },
            { value: 'negative' as const, weight: 8 },
          ]),
          summary: random.pick(['Reviewed the current order pattern and agreed a revised schedule.', 'Discussed the new range and left samples.', 'Raised a service concern that needs following up.', 'Confirmed the quarterly target and agreed next steps.']),
          productsDiscussed: [],
          competitorsMentioned: random.chance(0.4) ? ['Argos Suite'] : undefined,
          samplesGiven: random.chance(0.3) ? ['Sample pack A'] : undefined,
          orderPlaced: random.chance(0.45) ? { value: { amount: random.int(2, 48) * 1000, currency: organization.defaultCurrency } } : undefined,
          issuesRaised: random.chance(0.3) ? ['Delivery timing on the last order'] : [],
          nextSteps: [{ id: `ns-${stop.id}`, text: random.pick(['Send the revised price list', 'Confirm the next delivery slot', 'Arrange a technical review']), dueDate: toDateString(addDays(checkInAt, random.int(3, 14))), ownerName: rep.displayName }],
          photos: undefined,
          signatureCapture: undefined,
          expenseTotal: { amount: random.int(20, 320), currency: organization.defaultCurrency },
          createdAt: toDateTimeString(checkInAt),
          updatedAt: toDateTimeString(checkInAt),
        };
        visitLogs.push(log);
        stop.visitLogId = log.id;
      }
    }
  });

  for (const territory of territories) {
    const members = new Set(territory.memberIds);
    const owned = accounts.filter((account) => account.ownerId && members.has(account.ownerId));
    territory.accountCount = owned.length;
    territory.visitsLast30Days = visitLogs.filter((log) => members.has(log.userId)).length;
    territory.coveragePercent = owned.length > 0 ? Number(((territory.visitsLast30Days / Math.max(1, territory.accountCount * 2)) * 100).toFixed(1)) : 0;
    territory.wonValue = { amount: owned.reduce((sum, account) => sum + (account.totalRevenueWon?.amount ?? 0), 0), currency: organization.defaultCurrency };
  }

  return { territories, visitPlans, visitLogs };
}

/* ------------------------------------------------------------ partner channel */

export function makePartners(ctx: OrgContext, accounts: Account[], deals: Deal[]): { partners: Partner[]; registrations: DealRegistration[] } {
  const { random, organization, users } = ctx;
  const managers = users.filter((user) => user.persona === 'sales_director' || user.persona === 'sales_manager' || user.persona === 'org_admin');
  const assignable = managers.length > 0 ? managers : users;
  const partnerAccounts = accounts.slice(0, 6);

  const partners: Partner[] = partnerAccounts.map((account, index) => {
    const tier = random.pick(['registered', 'silver', 'gold', 'platinum', 'strategic'] as const);
    const registeredDeals = random.int(4, 64);
    const wonDeals = Math.round(registeredDeals * random.float(0.28, 0.72, 3));
    const revenue = wonDeals * random.int(18, 140) * 1000;
    return {
      id: `par-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      accountId: account.id,
      name: `${account.name} (partner)`,
      type: random.pick(['reseller', 'referral', 'distributor', 'technology', 'implementation'] as const),
      tier,
      status: random.pick(['active', 'active', 'onboarding', 'suspended'] as const),
      region: random.pick(['North America', 'EMEA', 'APAC']),
      countryCode: account.addresses[0]?.countryCode ?? organization.countryCode,
      currency: organization.defaultCurrency,
      programManagerId: random.pick(assignable).id,
      programManagerName: random.pick(assignable).displayName,
      partnerSince: toDateString(random.pastDate(1200, DATASET_EPOCH)),
      agreementSigned: random.chance(0.86),
      certifications: random.chance(0.6) ? [{ id: `cert-${index}`, name: 'Platform implementation', grantedAt: toDateString(random.pastDate(500, DATASET_EPOCH)), expiresAt: toDateString(addDays(DATASET_EPOCH, random.int(60, 700))), level: random.pick(['associate', 'professional', 'expert'] as const), issuerLabel: 'internal_program' }] : [],
      specializationTags: random.sample(['Manufacturing', 'Field service', 'Data migration', 'Integration', 'Training'], random.int(1, 3)),
      tierRequirements: [
        { id: `tr-${index}-1`, label: 'Certified consultants', target: '4', achieved: `${random.int(0, 8)}`, met: random.chance(0.6) },
        { id: `tr-${index}-2`, label: 'Annual registered pipeline', target: '$500,000', achieved: `$${random.int(80, 900)},000`, met: random.chance(0.5) },
        { id: `tr-${index}-3`, label: 'Customer satisfaction', target: '4.5 / 5', achieved: `${random.float(3.6, 4.9, 1)} / 5`, met: random.chance(0.7) },
      ],
      metrics: {
        registeredDeals,
        wonDeals,
        winRate: registeredDeals > 0 ? Number(((wonDeals / registeredDeals) * 100).toFixed(1)) : 0,
        revenueInfluenced: { amount: Math.round(revenue * 1.4), currency: organization.defaultCurrency },
        revenueClosed: { amount: revenue, currency: organization.defaultCurrency },
        averageDealSize: { amount: wonDeals > 0 ? Math.round(revenue / wonDeals) : 0, currency: organization.defaultCurrency },
        commissionEarned: { amount: Math.round(revenue * 0.08), currency: organization.defaultCurrency },
        commissionPending: { amount: Math.round(revenue * 0.02), currency: organization.defaultCurrency },
        leadsReferred: random.int(2, 88),
        activeDeals: random.int(1, 22),
        customerSatisfaction: random.float(3.4, 4.9, 1),
      },
      onboarding: {
        state: random.pick(['completed', 'in_progress', 'not_started'] as const),
        checklist: [
          { id: `po-${index}-1`, label: 'Partnership agreement signed', done: random.chance(0.8), required: true },
          { id: `po-${index}-2`, label: 'Portal access issued', done: random.chance(0.7), required: false },
          { id: `po-${index}-3`, label: 'Certification completed', done: random.chance(0.5), required: false },
          { id: `po-${index}-4`, label: 'First deal registered', done: random.chance(0.6), required: false },
        ],
        progressPercent: random.int(25, 100),
      },
      portalAccessEnabled: random.chance(0.7),
      tags: [],
      createdAt: stamp(1200, ctx),
      updatedAt: stamp(30, ctx),
    };
  });

  const registrations: DealRegistration[] = deals.slice(0, 12).map((deal, index) => {
    const partner = random.pick(partners);
    const account = accounts.find((candidate) => candidate.id === deal.accountId) ?? accounts[0]!;
    const status = random.weighted([
      { value: 'submitted' as const, weight: 16 },
      { value: 'under_review' as const, weight: 16 },
      { value: 'approved' as const, weight: 32 },
      { value: 'converted' as const, weight: 20 },
      { value: 'rejected' as const, weight: 8 },
      { value: 'conflict' as const, weight: 8 },
    ]);
    const submitted = random.pastDate(180, DATASET_EPOCH);
    return {
      id: `dr-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      reference: `DR-${String(2000 + index).padStart(4, '0')}`,
      partnerId: partner.id,
      partnerName: partner.name,
      accountId: account.id,
      accountName: account.name,
      dealName: deal.name,
      status,
      submittedAt: toDateTimeString(submitted),
      submittedByName: 'Partner contact',
      estimatedValue: deal.amount,
      expectedCloseDate: deal.expectedCloseDate,
      currency: organization.defaultCurrency,
      products: deal.products.slice(0, 2).map((line) => ({ productId: line.productId, name: line.productName, quantity: line.quantity })),
      protectionDays: random.pick([60, 90, 120]),
      protectionExpiresAt: toDateString(addDays(submitted, random.pick([60, 90, 120]))),
      conflictChecks: status === 'conflict'
        ? [{ kind: 'existing_deal', severity: 'blocking', label: 'An open deal already exists for this account', referenceId: deals[0]?.id, referenceLabel: deals[0]?.name }]
        : [{ kind: 'existing_account_owner', severity: 'info', label: 'Account is already owned by an internal representative' }],
      reviewNotes: status === 'approved' || status === 'converted' ? 'Approved. Protection window confirmed.' : undefined,
      reviewedById: random.pick(assignable).id,
      reviewedAt: status === 'submitted' ? undefined : stamp(60, ctx),
      convertedDealId: status === 'converted' ? deal.id : undefined,
      discountPercent: random.chance(0.4) ? random.int(5, 20) : undefined,
      createdAt: toDateTimeString(submitted),
      updatedAt: stamp(15, ctx),
    };
  });

  return { partners, registrations };
}

/* ------------------------------------------------ documents & collaboration */

export function makeDocumentsAndCollaboration(ctx: OrgContext, accounts: Account[], deals: Deal[], tickets: import('@crm/shared-types').Ticket[]): {
  folders: DocumentFolder[];
  documents: DocumentFile[];
  feed: FeedItem[];
  notifications: Notification[];
  announcements: Announcement[];
} {
  const { random, organization, users } = ctx;
  const rootId = `docf-${organization.id}-root`;
  const folders: DocumentFolder[] = [
    { id: rootId, organizationId: organization.id, name: 'All documents', path: '/', kind: 'folder', visibility: 'organization', fileCount: 0, totalSizeBytes: 0, tone: 'slate', createdAt: stamp(700, ctx), updatedAt: stamp(30, ctx) },
    { id: `docf-${organization.id}-contracts`, organizationId: organization.id, name: 'Contracts', parentId: rootId, path: '/contracts', kind: 'contracts', visibility: 'organization', fileCount: 0, totalSizeBytes: 0, tone: 'violet', createdAt: stamp(700, ctx), updatedAt: stamp(30, ctx) },
    { id: `docf-${organization.id}-proposals`, organizationId: organization.id, name: 'Proposals', parentId: rootId, path: '/proposals', kind: 'proposals', visibility: 'organization', fileCount: 0, totalSizeBytes: 0, tone: 'blue', createdAt: stamp(700, ctx), updatedAt: stamp(30, ctx) },
    { id: `docf-${organization.id}-templates`, organizationId: organization.id, name: 'Template library', parentId: rootId, path: '/templates', kind: 'template_library', visibility: 'organization', fileCount: 0, totalSizeBytes: 0, tone: 'teal', createdAt: stamp(700, ctx), updatedAt: stamp(30, ctx) },
    { id: `docf-${organization.id}-customer`, organizationId: organization.id, name: 'Customer shared', parentId: rootId, path: '/customer-shared', kind: 'shared', visibility: 'team', fileCount: 0, totalSizeBytes: 0, tone: 'amber', createdAt: stamp(700, ctx), updatedAt: stamp(30, ctx) },
  ];

  const documentNames = [
    { name: 'Master services agreement', ext: 'pdf', folder: 'contracts', kind: 'main' as const },
    { name: 'Order form 2026', ext: 'pdf', folder: 'contracts', kind: 'order_form' as const },
    { name: 'Data processing addendum', ext: 'pdf', folder: 'contracts', kind: 'dpa' as const },
    { name: 'Commercial proposal', ext: 'pdf', folder: 'proposals', kind: 'main' as const },
    { name: 'Implementation plan', ext: 'xlsx', folder: 'proposals', kind: 'appendix' as const },
    { name: 'Security overview', ext: 'pdf', folder: 'templates', kind: 'appendix' as const },
    { name: 'Statement of work template', ext: 'docx', folder: 'templates', kind: 'main' as const },
    { name: 'Quarterly business review deck', ext: 'pptx', folder: 'customer-shared', kind: 'appendix' as const },
    { name: 'Onboarding checklist', ext: 'pdf', folder: 'customer-shared', kind: 'appendix' as const },
    { name: 'Service level summary', ext: 'pdf', folder: 'customer-shared', kind: 'main' as const },
  ];

  const documents: DocumentFile[] = documentNames.map((entry, index) => {
    const account = random.pick(accounts);
    const folder = folders.find((candidate) => candidate.path === `/${entry.folder}`) ?? folders[1]!;
    const owner = random.pick(users);
    const version = random.int(1, 5);
    return {
      id: `doc-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      folderId: folder.id,
      folderPath: folder.path,
      name: `${entry.name}.${entry.ext}`,
      extension: entry.ext,
      mimeType: entry.ext === 'pdf' ? 'application/pdf' : entry.ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/octet-stream',
      sizeBytes: random.int(40_000, 4_200_000),
      storage: { state: 'placeholder', simulated: true, note: 'No file storage is connected. This entry records metadata only.' },
      version,
      versionCount: version,
      checksumPlaceholder: `sha256:****${random.int(1000, 9999)}`,
      ownerId: owner.id,
      ownerName: owner.displayName,
      visibility: entry.folder === 'customer-shared' ? 'customer_portal' : 'organization',
      tags: [],
      description: undefined,
      associations: [
        { type: 'account', id: account.id, label: account.name },
        ...(random.chance(0.5) ? [{ type: 'deal' as const, id: random.pick(deals).id, label: random.pick(deals).name }] : []),
      ],
      isFavorite: random.chance(0.2),
      shareLinks: random.chance(0.3) ? [{ id: `sl-${index}`, label: 'Read-only link', expiresAt: future(60, ctx), passwordProtected: random.chance(0.3), placeholder: true as const, lastAccessedAt: stamp(10, ctx) }] : [],
      downloadCount: random.int(0, 180),
      viewCount: random.int(2, 940),
      lastViewedAt: stamp(6, ctx),
      signatureState: entry.folder === 'contracts' ? random.pick(['completed_simulated', 'sent_simulated', 'not_required'] as const) : 'not_required',
      retentionUntil: toDateString(addDays(DATASET_EPOCH, random.int(400, 2400))),
      createdAt: stamp(600, ctx),
      updatedAt: stamp(20, ctx),
    };
  });

  for (const folder of folders) {
    const owned = documents.filter((document) => document.folderId === folder.id);
    folder.fileCount = owned.length;
    folder.totalSizeBytes = owned.reduce((sum, document) => sum + document.sizeBytes, 0);
  }

  const feedVerbs: Array<{ kind: FeedItem['kind']; summary: (label: string) => string }> = [
    { kind: 'stage_changed', summary: (label) => `moved ${label} to a new stage` },
    { kind: 'note_added', summary: (label) => `added a note to ${label}` },
    { kind: 'task_completed', summary: (label) => `completed a task on ${label}` },
    { kind: 'email_logged', summary: (label) => `logged an email on ${label}` },
    { kind: 'call_logged', summary: (label) => `logged a call on ${label}` },
    { kind: 'deal_won', summary: (label) => `closed ${label} as won` },
    { kind: 'ticket_resolved', summary: (label) => `resolved a ticket for ${label}` },
    { kind: 'workflow_run', summary: (label) => `ran an automation against ${label}` },
    { kind: 'comment', summary: (label) => `commented on ${label}` },
  ];

  const feed: FeedItem[] = Array.from({ length: 60 }, (_, index) => {
    const actor = random.pick(users);
    const deal = random.pick(deals);
    const account = accounts.find((candidate) => candidate.id === deal.accountId) ?? accounts[0]!;
    const ticket = random.pick(tickets);
    const verb = random.pick(feedVerbs);
    const isAutomation = verb.kind === 'workflow_run';
    const label = verb.kind === 'ticket_resolved' ? ticket.subject : deal.name;
    return {
      id: `feed-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      kind: verb.kind,
      actorKind: (isAutomation ? 'automation' : 'user') as FeedItem['actorKind'],
      actorId: isAutomation ? undefined : actor.id,
      actorName: isAutomation ? 'Workflow engine' : actor.displayName,
      actorInitials: isAutomation ? 'WF' : actor.initials,
      summary: `${isAutomation ? 'Automation' : actor.displayName} ${verb.summary(label)}`,
      detail: random.chance(0.4) ? random.pick(['Recorded for the account history.', 'Triggered by the configured rule.', 'Reviewed with the account team.']) : undefined,
      changes: verb.kind === 'stage_changed'
        ? [{ field: 'stage', label: 'Stage', before: 'Discovery', after: 'Validation' }]
        : verb.kind === 'field_changed' as FeedItem['kind']
          ? [{ field: 'amount', label: 'Amount', before: '$120,000', after: '$148,000' }]
          : undefined,
      relatedRecords: [
        { type: 'deal', id: deal.id, label: deal.name, route: `/app/deals/${deal.id}` },
        { type: 'account', id: account.id, label: account.name, route: `/app/accounts/${account.id}` },
      ],
      scope: random.pick(['record', 'record', 'team', 'organization'] as const),
      teamId: ctx.teams[0]?.id,
      createdAt: toDateTimeString(random.pastDate(20, DATASET_EPOCH)),
      isPinned: random.chance(0.06),
      reactions: random.chance(0.3) ? [{ emoji: '👍', users: [{ id: random.pick(users).id, name: random.pick(users).displayName }] }] : [],
      commentCount: random.int(0, 8),
      simulated: isAutomation,
    };
  }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const notifications: Notification[] = [];
  const primary = ctx.primaryUser;
  const notificationKinds: Array<Notification['kind']> = ['assignment', 'mention', 'task_due', 'task_overdue', 'deal_won', 'ticket_escalated', 'ticket_sla_breach', 'approval_request', 'comment_reply', 'export_ready', 'security_alert', 'announcement'];
  for (let index = 0; index < 26; index += 1) {
    const kind = random.pick(notificationKinds);
    const deal = random.pick(deals);
    const read = index > 8;
    notifications.push({
      id: `notif-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      userId: primary.id,
      kind,
      title: kind === 'assignment' ? `You were assigned ${deal.name}`
        : kind === 'mention' ? 'You were mentioned in a comment'
          : kind === 'task_due' ? 'A task is due today'
            : kind === 'task_overdue' ? 'A task is overdue'
              : kind === 'deal_won' ? `${deal.name} was closed won`
                : kind === 'ticket_escalated' ? 'An escalations rule fired'
                  : kind === 'ticket_sla_breach' ? 'A ticket is at risk of breaching its SLA'
                    : kind === 'approval_request' ? 'A quote is waiting for your approval'
                      : kind === 'comment_reply' ? 'Someone replied to your comment'
                        : kind === 'export_ready' ? 'Your export is ready'
                          : kind === 'security_alert' ? 'New sign-in from an unrecognised device'
                            : 'Platform announcement',
      body: kind === 'ticket_sla_breach'
        ? 'The first-response target was reached at 85%. Review the queue and reassign if needed.'
        : random.pick(['Open the record to see the full history.', 'Recorded in the audit log.', 'No action needed if you have already handled this.']),
      severity: kind === 'task_overdue' || kind === 'ticket_sla_breach' || kind === 'security_alert' ? 'warning' : kind === 'deal_won' ? 'success' : 'info',
      relatedRoute: `/app/deals/${deal.id}`,
      relatedId: deal.id,
      actorName: random.pick(users).displayName,
      actorInitials: random.pick(users).initials,
      createdAt: toDateTimeString(random.pastDate(7, DATASET_EPOCH)),
      readAt: read ? stamp(3, ctx) : undefined,
      channels: { inApp: true, emailSimulated: random.chance(0.4), mobilePushSimulated: false },
      requiresAction: kind === 'approval_request' || kind === 'task_overdue',
      actionLabel: kind === 'approval_request' ? 'Review the quote' : kind === 'task_overdue' ? 'Open the task' : undefined,
    });
  }
  notifications.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const announcements: Announcement[] = [
    {
      id: `ann-${organization.id}-1`,
      organizationId: organization.id,
      scope: 'organization',
      title: 'Quarterly release: workflow simulation',
      body: 'Workflows can now be simulated against a sample record before activation, and every run shows a step-by-step result. Existing workflows are unaffected.',
      tone: 'violet',
      severity: 'info',
      placement: ['in_app_banner', 'notification_center'],
      audience: { kind: 'all' },
      startAt: toDateTimeString(addDays(DATASET_EPOCH, -12)),
      endAt: toDateTimeString(addDays(DATASET_EPOCH, 18)),
      isDismissible: true,
      requiresAcknowledgement: false,
      ctaLabel: 'See what changed',
      ctaRoute: '/app/workflows',
      state: 'active',
      acknowledgedCount: random.int(20, 140),
      targetCount: ctx.users.length,
      createdAt: stamp(14, ctx),
      updatedAt: stamp(12, ctx),
    },
    {
      id: `ann-${organization.id}-2`,
      organizationId: organization.id,
      scope: 'organization',
      title: 'Data cleanup week — 3 to 7 November',
      body: 'Revenue operations will be reviewing duplicates and unused fields. Expect a short access request if your team owns affected records.',
      tone: 'amber',
      severity: 'warning',
      placement: ['in_app_banner'],
      audience: { kind: 'role', ids: ['role-sales-rep'] },
      startAt: toDateTimeString(addDays(DATASET_EPOCH, -4)),
      endAt: toDateTimeString(addDays(DATASET_EPOCH, 26)),
      isDismissible: true,
      requiresAcknowledgement: true,
      state: 'active',
      acknowledgedCount: random.int(4, 40),
      targetCount: ctx.users.length,
      createdAt: stamp(6, ctx),
      updatedAt: stamp(5, ctx),
    },
  ];

  return { folders, documents, feed, notifications, announcements };
}

/* ------------------------------------------------- dashboards and reporting */

export function makeAnalytics(ctx: OrgContext): { dashboards: Dashboard[]; reports: ReportDefinition[]; goals: SalesGoal[]; sequences: Sequence[]; savedViews: SavedView[] } {
  const { random, organization, users } = ctx;
  const builder = users.find((user) => user.persona === 'revops_manager') ?? users[0]!;

  const widget = (id: string, kind: Dashboard['widgets'][number]['kind'], title: string, x: number, y: number, w: number, h: number, source: Dashboard['widgets'][number]['binding']['source'], measure: string, aggregation: Dashboard['widgets'][number]['binding']['aggregation'], groupBy?: string) => ({
    id,
    kind,
    title,
    position: { x, y, w, h },
    binding: { source, measure, aggregation, groupBy, limit: 8, sortBy: 'value_desc' as const, compareWith: 'previous_period' as const },
    options: {
      currencyDisplay: 'organization' as const,
      showLegend: true,
      showGrid: true,
      showValues: false,
      showTargetLine: true,
      stacked: false,
      horizontal: false,
      colorScheme: 'categorical' as const,
      allowTableToggle: true,
      drilldownLevel: 'group' as const,
      numbersCompact: true,
    },
  });

  const dashboards: Dashboard[] = [
    {
      id: `dash-${organization.id}-executive`,
      organizationId: organization.id,
      name: 'Executive overview',
      description: 'Board-level performance: revenue, pipeline coverage, retention and risk.',
      audience: 'executive',
      ownerId: undefined,
      ownerName: 'Platform default',
      kind: 'system',
      layout: { columns: 12, rowHeight: 40, compactType: 'vertical', breakpoints: [{ name: 'sm', minWidth: 0, columns: 4 }, { name: 'md', minWidth: 768, columns: 8 }, { name: 'lg', minWidth: 1024, columns: 12 }, { name: 'xl', minWidth: 1440, columns: 12 }] },
      widgets: [
        widget('w-revenue', 'metric_kpi', 'Closed won this quarter', 0, 0, 3, 3, 'deals', 'amount', 'sum'),
        widget('w-pipeline', 'metric_kpi', 'Weighted pipeline', 3, 0, 3, 3, 'deals', 'amount', 'sum'),
        widget('w-coverage', 'metric_kpi', 'Pipeline coverage', 6, 0, 3, 3, 'deals', 'amount', 'ratio'),
        widget('w-retention', 'metric_kpi', 'Net revenue retention', 9, 0, 3, 3, 'subscriptions', 'mrr', 'ratio'),
        widget('w-revenue-trend', 'line_chart', 'Revenue against target', 0, 3, 8, 5, 'deals', 'amount', 'sum', 'actualCloseDate'),
        widget('w-pipeline-stages', 'bar_chart', 'Pipeline by stage', 8, 3, 4, 5, 'deals', 'amount', 'sum', 'stageId'),
        widget('w-win-loss', 'donut_chart', 'Win rate', 0, 8, 4, 4, 'deals', 'amount', 'count', 'status'),
        widget('w-top-accounts', 'leaderboard', 'Top accounts by revenue', 4, 8, 4, 4, 'accounts', 'lifetimeValue', 'sum', 'name'),
        widget('w-risk', 'table', 'Accounts needing attention', 8, 8, 4, 4, 'accounts', 'healthScore', 'min', 'health'),
      ],
      isDefault: true,
      period: { preset: 'this_quarter' },
      currency: organization.defaultCurrency,
      filterPresetIds: [],
      viewCount: random.int(120, 900),
      updatedByName: 'Platform default',
      createdAt: stamp(500, ctx),
      updatedAt: stamp(60, ctx),
    },
    {
      id: `dash-${organization.id}-sales`,
      organizationId: organization.id,
      name: 'Sales performance',
      description: 'Team and individual performance against quota, with pipeline health.',
      audience: 'sales',
      ownerName: 'Platform default',
      kind: 'system',
      layout: { columns: 12, rowHeight: 40, compactType: 'vertical', breakpoints: [{ name: 'sm', minWidth: 0, columns: 4 }, { name: 'md', minWidth: 768, columns: 8 }, { name: 'lg', minWidth: 1024, columns: 12 }, { name: 'xl', minWidth: 1440, columns: 12 }] },
      widgets: [
        widget('sw-quota', 'goal_progress', 'Quota attainment', 0, 0, 4, 3, 'goals', 'target', 'sum'),
        widget('sw-won', 'metric_kpi', 'Deals won', 4, 0, 4, 3, 'deals', 'amount', 'count'),
        widget('sw-cycle', 'metric_kpi', 'Average cycle time', 8, 0, 4, 3, 'deals', 'cycleTimeDays', 'average'),
        widget('sw-leaderboard', 'leaderboard', 'Rep leaderboard', 0, 3, 6, 5, 'deals', 'amount', 'sum', 'ownerId'),
        widget('sw-funnel', 'funnel', 'Conversion funnel', 6, 3, 6, 5, 'deals', 'amount', 'count', 'stageId'),
        widget('sw-activities', 'bar_chart', 'Activity volume by type', 0, 8, 6, 4, 'activities', 'kind', 'count', 'kind'),
        widget('sw-stale', 'table', 'Deals not moving', 6, 8, 6, 4, 'deals', 'daysInStage', 'max', 'stageId'),
      ],
      isDefault: false,
      period: { preset: 'this_quarter' },
      currency: organization.defaultCurrency,
      filterPresetIds: [],
      viewCount: random.int(200, 1200),
      updatedByName: 'Platform default',
      createdAt: stamp(500, ctx),
      updatedAt: stamp(60, ctx),
    },
    {
      id: `dash-${organization.id}-individual`,
      organizationId: organization.id,
      name: 'My performance',
      description: 'A representative-focused view: my quota, my pipeline and my next actions.',
      audience: 'sales_individual',
      ownerName: 'Platform default',
      kind: 'system',
      layout: { columns: 12, rowHeight: 40, compactType: 'vertical', breakpoints: [{ name: 'sm', minWidth: 0, columns: 4 }, { name: 'md', minWidth: 768, columns: 8 }, { name: 'lg', minWidth: 1024, columns: 12 }, { name: 'xl', minWidth: 1440, columns: 12 }] },
      widgets: [
        widget('iw-quota', 'goal_progress', 'My quota attainment', 0, 0, 4, 3, 'goals', 'target', 'sum'),
        widget('iw-pipeline', 'metric_kpi', 'My open pipeline', 4, 0, 4, 3, 'deals', 'amount', 'sum'),
        widget('iw-tasks', 'task_list', 'Due today and overdue', 8, 0, 4, 3, 'activities', 'dueAt', 'count'),
        widget('iw-pipeline-list', 'table', 'My deals by stage', 0, 3, 8, 5, 'deals', 'amount', 'sum', 'stageId'),
        widget('iw-recent', 'activity_feed', 'Recent activity on my records', 8, 3, 4, 5, 'activities', 'dueAt', 'count'),
      ],
      isDefault: true,
      period: { preset: 'this_quarter' },
      currency: organization.defaultCurrency,
      filterPresetIds: [],
      viewCount: random.int(400, 2400),
      updatedByName: 'Platform default',
      createdAt: stamp(500, ctx),
      updatedAt: stamp(60, ctx),
    },
  ];

  if (['tickets', 'knowledge_base'].every((key) => organization.enabledModuleKeys.includes(key))) {
    dashboards.push({
      id: `dash-${organization.id}-service`,
      organizationId: organization.id,
      name: 'Service performance',
      description: 'SLA compliance, backlog, satisfaction and agent workload.',
      audience: 'service',
      ownerName: 'Platform default',
      kind: 'system',
      layout: { columns: 12, rowHeight: 40, compactType: 'vertical', breakpoints: [{ name: 'sm', minWidth: 0, columns: 4 }, { name: 'md', minWidth: 768, columns: 8 }, { name: 'lg', minWidth: 1024, columns: 12 }, { name: 'xl', minWidth: 1440, columns: 12 }] },
      widgets: [
        widget('sv-open', 'metric_kpi', 'Open tickets', 0, 0, 3, 3, 'tickets', 'id', 'count'),
        widget('sv-sla', 'metric_kpi', 'SLA compliance', 3, 0, 3, 3, 'tickets', 'slaState', 'ratio'),
        widget('sv-first', 'metric_kpi', 'First response time', 6, 0, 3, 3, 'tickets', 'firstRespondedAt', 'average'),
        widget('sv-csat', 'gauge', 'Satisfaction', 9, 0, 3, 3, 'tickets', 'satisfaction', 'average'),
        widget('sv-volume', 'area_chart', 'Created against resolved', 0, 3, 8, 5, 'tickets', 'createdAt', 'count', 'createdAt'),
        widget('sv-priority', 'donut_chart', 'By priority', 8, 3, 4, 5, 'tickets', 'priority', 'count', 'priority'),
        widget('sv-agents', 'leaderboard', 'Agent performance', 0, 8, 6, 4, 'tickets', 'assigneeId', 'count', 'assigneeId'),
        widget('sv-categories', 'horizontal_bar_chart', 'Volume by category', 6, 8, 6, 4, 'tickets', 'categoryLabel', 'count', 'categoryLabel'),
      ],
      isDefault: true,
      period: { preset: 'last_30_days' },
      currency: organization.defaultCurrency,
      filterPresetIds: [],
      viewCount: random.int(90, 600),
      updatedByName: 'Platform default',
      createdAt: stamp(400, ctx),
      updatedAt: stamp(40, ctx),
    });
  }

  const report = (id: string, name: string, category: ReportDefinition['category'], source: ReportDefinition['source'], measure: string, aggregation: ReportDefinition['config']['measure']['aggregation'], groupByField: string, groupByLabel: string, description: string): ReportDefinition => ({
    id,
    organizationId: organization.id,
    name,
    description,
    category,
    kind: 'system',
    ownerName: 'Platform default',
    source,
    config: {
      period: { preset: 'this_quarter' },
      groupBy: [{ id: `${id}-g1`, field: groupByField, label: groupByLabel, dateBucket: groupByField.includes('At') || groupByField.includes('Date') ? 'month' : undefined, sort: 'desc', limit: 25 }],
      measure: { field: measure, aggregation, label: name },
      sort: [{ field: measure, direction: 'desc' }],
      limit: 500,
      includeChart: true,
      chartType: 'bar_chart',
      currencyDisplay: 'organization',
      comparisons: ['previous_period'],
    },
    columnSet: [
      { key: groupByField, label: groupByLabel, field: groupByField, kind: 'dimension', align: 'start', visible: true, sortable: true },
      { key: measure, label: name, field: measure, kind: 'measure', format: measure.toLowerCase().includes('amount') || measure.toLowerCase().includes('value') || measure.toLowerCase().includes('revenue') || measure.toLowerCase().includes('arr') || measure.toLowerCase().includes('mrr') ? 'currency' : 'number', align: 'end', visible: true, sortable: true },
      { key: `${measure}__delta`, label: 'Change', field: `${measure}__delta`, kind: 'comparison', format: 'delta', align: 'end', visible: true, sortable: false },
    ],
    lastRun: { id: `${id}-run-1`, reportId: id, ranAt: stamp(1, ctx), ranById: builder.id, ranByName: builder.displayName, rowCount: random.int(4, 32), durationMs: random.int(60, 480), state: 'success' },
    isFavorite: random.chance(0.3),
    sharedWithRoleIds: [],
    viewCount: random.int(20, 400),
    createdAt: stamp(420, ctx),
    updatedAt: stamp(50, ctx),
  });

  const reports: ReportDefinition[] = [
    report(`rep-${organization.id}-1`, 'Pipeline by stage', 'pipeline', 'deals', 'amount', 'sum', 'stageId', 'Stage', 'Open and closed value by pipeline stage.'),
    report(`rep-${organization.id}-2`, 'Win rate by owner', 'sales', 'deals', 'amount', 'sum', 'ownerId', 'Owner', 'Won versus lost value for each representative.'),
    report(`rep-${organization.id}-3`, 'Revenue by account', 'revenue', 'deals', 'amount', 'sum', 'accountName', 'Account', 'Closed-won revenue by account for the period.'),
    report(`rep-${organization.id}-4`, 'Activity volume by type', 'activity', 'activities', 'kind', 'count', 'kind', 'Activity type', 'Logged activities grouped by type.'),
    report(`rep-${organization.id}-5`, 'Campaign return on investment', 'campaign', 'campaigns', 'revenueAttributed', 'sum', 'name', 'Campaign', 'Attributed revenue and cost per campaign.'),
    report(`rep-${organization.id}-6`, 'Ticket volume by category', 'service', 'tickets', 'id', 'count', 'categoryLabel', 'Category', 'Ticket counts by category for the period.'),
    report(`rep-${organization.id}-7`, 'SLA compliance by priority', 'support_sla', 'tickets', 'slaState', 'count', 'priority', 'Priority', 'Breach and compliance counts by priority.'),
    report(`rep-${organization.id}-8`, 'Lead conversion by source', 'marketing', 'leads', 'id', 'count', 'leadSourceId', 'Lead source', 'Lead volume and conversion grouped by acquisition source.'),
    report(`rep-${organization.id}-9`, 'Forecast accuracy by period', 'forecast', 'deals', 'amount', 'sum', 'forecastCategory', 'Forecast category', 'Commit and best case against closed-won outcomes.'),
    report(`rep-${organization.id}-10`, 'Recurring revenue by plan', 'revenue', 'subscriptions', 'mrr', 'sum', 'planName', 'Plan', 'Monthly recurring revenue grouped by plan.'),
    report(`rep-${organization.id}-11`, 'Renewal outcomes by month', 'retention', 'renewals', 'currentValue', 'sum', 'renewalDate', 'Renewal month', 'Renewal value retained, expanded and lost by month.'),
    report(`rep-${organization.id}-12`, 'Rep performance scorecard', 'team', 'deals', 'amount', 'sum', 'ownerId', 'Representative', 'Quota, revenue, win rate and activity in one table.'),
  ];

  const goals: SalesGoal[] = users
    .filter((user) => user.persona === 'sales_rep' || user.persona === 'sales_manager' || user.persona === 'account_manager')
    .slice(0, 8)
    .map((user, index) => {
      const target = random.int(280, 1400) * 1000;
      const achieved = Math.round(target * random.float(0.34, 1.24, 3));
      const elapsed = 0.72;
      return {
        id: `goal-${organization.id}-${index + 1}`,
        organizationId: organization.id,
        name: `${user.displayName} — quarterly revenue`,
        metric: 'revenue',
        scope: 'individual',
        ownerId: user.id,
        period: 'quarter',
        periodStart: toDateString(addDays(DATASET_EPOCH, -66)),
        periodEnd: toDateString(addDays(DATASET_EPOCH, 24)),
        target: { amount: target, currency: organization.defaultCurrency },
        achieved: { amount: achieved, currency: organization.defaultCurrency },
        pacePercent: Number(((achieved / target / elapsed) * 100).toFixed(1)),
        attainmentPercent: Number(((achieved / target) * 100).toFixed(1)),
        currency: organization.defaultCurrency,
        breakdown: [
          { key: 'new_business', label: 'New business', target: Math.round(target * 0.6), achieved: Math.round(achieved * 0.62) },
          { key: 'expansion', label: 'Expansion', target: Math.round(target * 0.4), achieved: Math.round(achieved * 0.38) },
        ],
        createdAt: stamp(80, ctx),
        updatedAt: stamp(2, ctx),
      };
    });

  const sequences: Sequence[] = [
    {
      id: `seq-${organization.id}-1`,
      organizationId: organization.id,
      name: 'Enterprise outbound — three touches',
      description: 'A short, low-volume sequence for named enterprise accounts.',
      status: 'active',
      targetType: 'lead',
      steps: [
        { id: 's1', order: 1, kind: 'email', name: 'Introduction', waitDays: 0, templateId: `mtmpl-${organization.id}-1`, subject: 'A thought on {{account.name}}', bodyPreview: 'Short, specific, and references the trigger for outreach.', stats: { sent: 1840, opened: 812, replied: 164, meetings: 38 } },
        { id: 's2', order: 2, kind: 'call', name: 'Call attempt', waitDays: 2, taskTitle: 'Call the primary contact', stats: { sent: 1420, opened: 0, replied: 210, meetings: 22 } },
        { id: 's3', order: 3, kind: 'email', name: 'Follow-up with a case study', waitDays: 3, templateId: `mtmpl-${organization.id}-2`, subject: 'How a similar team approached this', bodyPreview: 'References an industry outcome without inventing a customer name.', stats: { sent: 980, opened: 402, replied: 88, meetings: 14 } },
      ],
      enrolledCount: 1840,
      activeCount: 420,
      completedCount: 1180,
      replyRate: 8.9,
      openRate: 44.1,
      meetingRate: 2.1,
      exitOnReply: true,
      exitOnMeeting: true,
      sendWindow: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17, timezone: organization.defaultTimezone },
      ownerId: builder.id,
      teamId: ctx.teams.find((team) => team.kind === 'sales')?.id,
      createdAt: stamp(300, ctx),
      updatedAt: stamp(20, ctx),
    },
    {
      id: `seq-${organization.id}-2`,
      organizationId: organization.id,
      name: 'Renewal readiness',
      description: 'Runs 120 days before a contract expires.',
      status: 'active',
      targetType: 'contact',
      steps: [
        { id: 's1', order: 1, kind: 'email', name: 'Check-in', waitDays: 0, templateId: `mtmpl-${organization.id}-2`, subject: 'Planning ahead for {{account.name}}', bodyPreview: 'Opens the renewal conversation early.', stats: { sent: 420, opened: 280, replied: 96, meetings: 44 } },
        { id: 's2', order: 2, kind: 'task', name: 'Prepare the value summary', waitDays: 5, taskTitle: 'Prepare the renewal value summary', stats: { sent: 380, opened: 0, replied: 0, meetings: 0 } },
        { id: 's3', order: 3, kind: 'email', name: 'Proposal', waitDays: 7, templateId: `mtmpl-${organization.id}-1`, subject: 'Your renewal proposal', bodyPreview: 'Attaches the proposal generated from the contract.', stats: { sent: 340, opened: 226, replied: 118, meetings: 52 } },
      ],
      enrolledCount: 420,
      activeCount: 180,
      completedCount: 240,
      replyRate: 22.9,
      openRate: 66.7,
      meetingRate: 12.4,
      exitOnReply: true,
      exitOnMeeting: true,
      sendWindow: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17, timezone: organization.defaultTimezone },
      ownerId: builder.id,
      teamId: ctx.teams.find((team) => team.kind === 'success')?.id,
      createdAt: stamp(200, ctx),
      updatedAt: stamp(14, ctx),
    },
  ];

  const savedViews: SavedView[] = [
    {
      id: `sv-${organization.id}-leads-hot`,
      organizationId: organization.id,
      name: 'Hot leads needing contact',
      objectApiName: 'lead',
      scope: 'system',
      sharedWithRoleIds: [],
      sharedWithTeamIds: [],
      isDefault: false,
      isPinned: true,
      filter: { conjunction: 'and', conditions: [{ field: 'rating', operator: 'equals', value: 'hot' }, { field: 'status', operator: 'in', value: 'new,contacted' }] },
      sort: [{ field: 'scoring.score', direction: 'desc' }],
      columns: [
        { field: 'reference', label: 'Reference', visible: true },
        { field: 'companyName', label: 'Company', visible: true },
        { field: 'status', label: 'Status', visible: true },
        { field: 'rating', label: 'Rating', visible: true },
        { field: 'scoring.score', label: 'Score', visible: true },
        { field: 'estimatedValue', label: 'Est. value', visible: true },
        { field: 'ownerId', label: 'Owner', visible: true },
        { field: 'responseDueAt', label: 'Response due', visible: true },
      ],
      display: 'table',
      density: 'compact',
      ownerId: builder.id,
      ownerName: builder.displayName,
      usedByCount: random.int(1, 24),
      icon: 'Flame',
      tone: 'red',
      createdAt: stamp(400, ctx),
      updatedAt: stamp(30, ctx),
    },
    {
      id: `sv-${organization.id}-deals-attention`,
      organizationId: organization.id,
      name: 'Deals needing attention',
      objectApiName: 'deal',
      scope: 'system',
      sharedWithRoleIds: [],
      sharedWithTeamIds: [],
      isDefault: true,
      isPinned: true,
      filter: { conjunction: 'and', conditions: [{ field: 'status', operator: 'equals', value: 'open' }, { field: 'isStale', operator: 'equals', value: true }] },
      sort: [{ field: 'daysInStage', direction: 'desc' }],
      columns: [
        { field: 'name', label: 'Deal', visible: true },
        { field: 'accountName', label: 'Account', visible: true },
        { field: 'amount', label: 'Amount', visible: true },
        { field: 'daysInStage', label: 'Days in stage', visible: true },
        { field: 'nextStep', label: 'Next step', visible: true },
        { field: 'ownerId', label: 'Owner', visible: true },
      ],
      display: 'table',
      density: 'compact',
      ownerId: builder.id,
      ownerName: builder.displayName,
      usedByCount: random.int(4, 40),
      icon: 'AlertTriangle',
      tone: 'amber',
      createdAt: stamp(300, ctx),
      updatedAt: stamp(20, ctx),
    },
    {
      id: `sv-${organization.id}-tickets-breach`,
      organizationId: organization.id,
      name: 'At risk of breaching SLA',
      objectApiName: 'ticket',
      scope: 'system',
      sharedWithRoleIds: [],
      sharedWithTeamIds: [],
      isDefault: false,
      isPinned: true,
      filter: { conjunction: 'and', conditions: [{ field: 'slaState', operator: 'in', value: 'at_risk,breached' }, { field: 'status', operator: 'not_in', value: 'resolved,closed' }] },
      sort: [{ field: 'resolutionDueAt', direction: 'asc' }],
      columns: [
        { field: 'reference', label: 'Reference', visible: true },
        { field: 'subject', label: 'Subject', visible: true },
        { field: 'priority', label: 'Priority', visible: true },
        { field: 'accountName', label: 'Account', visible: true },
        { field: 'slaState', label: 'SLA', visible: true },
        { field: 'assigneeName', label: 'Assignee', visible: true },
      ],
      display: 'table',
      density: 'compact',
      ownerId: builder.id,
      ownerName: builder.displayName,
      usedByCount: random.int(2, 30),
      icon: 'Clock',
      tone: 'red',
      createdAt: stamp(200, ctx),
      updatedAt: stamp(10, ctx),
    },
  ];

  return { dashboards, reports, goals, sequences, savedViews };
}

/* ------------------------------------------------------------- automation */

export function makeWorkflows(ctx: OrgContext): { workflows: Workflow[]; templates: WorkflowTemplate[] } {
  const { random, organization, users } = ctx;
  const owner = users.find((user) => user.persona === 'revops_manager') ?? users[0]!;

  const makeWorkflow = (index: number, name: string, category: Workflow['category'], target: Workflow['target'], status: Workflow['status'], triggerLabel: string, actionLabel: string): Workflow => ({
    id: `wf-${organization.id}-${index + 1}`,
    organizationId: organization.id,
    name,
    description: `Demonstration automation. ${triggerLabel}, then ${actionLabel.toLowerCase()}.`,
    status,
    target,
    builderMode: index % 3 === 0 ? 'advanced' : 'simple',
    triggers: [{
      id: `wft-${index}`,
      kind: index % 4 === 0 ? 'stage_changed' : index % 4 === 1 ? 'record_created' : index % 4 === 2 ? 'inactivity' : 'relative_date',
      label: triggerLabel,
      description: `${triggerLabel} on a ${target} record.`,
      config: { inactivityDays: index % 4 === 2 ? 30 : undefined, daysOffset: index % 4 === 3 ? 60 : undefined, direction: 'before', schedulerState: index % 4 >= 2 ? 'simulated' : 'not_configured' },
    }],
    nodes: [
      { id: 'n1', kind: 'trigger', label: triggerLabel, position: { x: 40, y: 160 }, config: {}, isEntry: true, stats: { executed: random.int(200, 4000), succeeded: random.int(200, 4000), failed: 0, skipped: 0 } },
      { id: 'n2', kind: 'condition', label: 'Does it meet the criteria?', position: { x: 280, y: 160 }, config: { conditionGroup: { id: 'cg1', conjunction: 'and', negate: false, rules: [{ id: 'r1', field: target === 'deal' ? 'amount' : 'status', fieldLabel: target === 'deal' ? 'Amount' : 'Status', fieldType: target === 'deal' ? 'currency' : 'picklist', operator: target === 'deal' ? 'greater_than' : 'equals', value: target === 'deal' ? 50000 : 'new' }] } }, stats: { executed: random.int(200, 4000), succeeded: random.int(180, 3800), failed: random.int(0, 40), skipped: random.int(0, 120) } },
      { id: 'n3', kind: 'action_assign_owner', label: 'Assign an owner', position: { x: 520, y: 60 }, config: { assignment: { strategy: 'round_robin', onlyIfUnassigned: true } }, stats: { executed: random.int(120, 3000), succeeded: random.int(118, 2980), failed: random.int(0, 20), skipped: random.int(0, 80) } },
      { id: 'n4', kind: 'action_create_task', label: 'Create a follow-up task', position: { x: 520, y: 260 }, config: { task: { title: 'Follow up within 48 hours', description: '', assignToKind: 'owner', dueInDays: 2, priority: 'high' } }, stats: { executed: random.int(120, 3000), succeeded: random.int(118, 2980), failed: random.int(0, 20), skipped: random.int(0, 80) } },
      { id: 'n5', kind: 'action_send_notification', label: 'Notify the team', position: { x: 760, y: 160 }, config: { notification: { recipientKind: 'team', title: 'Record needs attention', body: 'A record met the escalation criteria.', channel: 'in_app' } }, stats: { executed: random.int(120, 3000), succeeded: random.int(120, 3000), failed: 0, skipped: random.int(0, 60) } },
      { id: 'n6', kind: 'end', label: 'Finish', position: { x: 1000, y: 160 }, config: {}, isTerminal: true, stats: { executed: random.int(120, 3000), succeeded: random.int(120, 3000), failed: 0, skipped: 0 } },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'out' },
      { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'true', label: 'Yes', tone: 'green' },
      { id: 'e3', fromNodeId: 'n2', toNodeId: 'n4', fromPort: 'false', label: 'No', tone: 'amber' },
      { id: 'e4', fromNodeId: 'n3', toNodeId: 'n5', fromPort: 'out' },
      { id: 'e5', fromNodeId: 'n4', toNodeId: 'n5', fromPort: 'out' },
      { id: 'e6', fromNodeId: 'n5', toNodeId: 'n6', fromPort: 'out' },
    ],
    settings: { runOncePerRecord: true, allowReentry: false, stopOnError: true, timezone: organization.defaultTimezone, allowRecursive: false },
    simulation: null,
    stats: {
      runCount: random.int(120, 4200),
      successCount: random.int(100, 4000),
      failureCount: random.int(0, 60),
      skippedCount: random.int(0, 180),
      successRate: random.float(92, 99.8, 1),
      averageDurationMs: random.int(18, 420),
      lastRunAt: stamp(1, ctx),
      lastRunStatus: random.chance(0.9) ? 'success' : 'failed',
    },
    ownerId: owner.id,
    ownerName: owner.displayName,
    version: random.int(1, 8),
    validation: { valid: true, errors: [], warnings: random.chance(0.3) ? [{ id: 'vw1', code: 'webhook_placeholder_only', severity: 'warning', message: 'One action references an integration that is not connected. It will be skipped at run time.', fixHint: 'Remove the action or mark the workflow as a draft.' }] : [] },
    category,
    tags: [],
    createdAt: stamp(400, ctx),
    updatedAt: stamp(12, ctx),
  });

  const statuses: Workflow['status'][] = ['active', 'active', 'active', 'active', 'active', 'active', 'paused', 'paused', 'draft', 'draft', 'error', 'active'];
  const categories: Workflow['category'][] = ['sales', 'success', 'service', 'sales', 'revenue', 'sales', 'marketing', 'service', 'revenue', 'operations', 'data_quality', 'custom'];
  const targets: Workflow['target'][] = ['lead', 'deal', 'ticket', 'lead', 'contract', 'deal', 'contact', 'ticket', 'quote', 'contact', 'lead', 'deal'];
  const triggers = ['Record created', 'Deal stage changed', 'Ticket created', 'Lead created', 'Contract nearing expiry', 'Deal stage changed', 'Contact created', 'Ticket created', 'Quote submitted for approval', 'Contact created', 'Lead created', 'Deal created'];
  const actions = ['assign a representative by territory', 'create an onboarding project', 'escalate to the service manager', 'start a nurture sequence', 'create a renewal task', 'request a discount approval', 'enrol in a welcome series', 'raise the priority', 'notify the finance team', 'set the lifecycle stage', 'run a duplicate check', 'create a follow-up task'];

  const workflows = workflowNames.map((name, index) => makeWorkflow(index, name, categories[index] ?? 'sales', targets[index] ?? 'lead', statuses[index] ?? 'active', triggers[index] ?? 'Record created', actions[index] ?? 'create a task'));

  const templates: WorkflowTemplate[] = [
    { id: `wftmpl-${organization.id}-1`, name: 'Assign new leads by territory', category: 'sales', description: 'Routes an inbound lead to the representative who owns the territory.', scenario: 'Lead created → assign a representative', target: 'lead', nodeCount: 4, installsCount: random.int(40, 900), definition: { triggers: workflows[0]!.triggers, nodes: workflows[0]!.nodes, edges: workflows[0]!.edges, settings: workflows[0]!.settings, category: 'sales', target: 'lead' }, requiredModuleKeys: ['leads'], tone: 'blue' },
    { id: `wftmpl-${organization.id}-2`, name: 'Deal won to onboarding project', category: 'success', description: 'Creates an onboarding project and a kickoff task when a deal closes won.', scenario: 'Deal won → create an onboarding project', target: 'deal', nodeCount: 5, installsCount: random.int(60, 1200), definition: { triggers: workflows[1]!.triggers, nodes: workflows[1]!.nodes, edges: workflows[1]!.edges, settings: workflows[1]!.settings, category: 'success', target: 'deal' }, requiredModuleKeys: ['deals', 'projects'], tone: 'green' },
    { id: `wftmpl-${organization.id}-3`, name: 'Escalate overdue tickets', category: 'service', description: 'Raises the priority and notifies the manager when a ticket approaches its resolution target.', scenario: 'Ticket overdue → escalate to the manager', target: 'ticket', nodeCount: 5, installsCount: random.int(30, 700), definition: { triggers: workflows[2]!.triggers, nodes: workflows[2]!.nodes, edges: workflows[2]!.edges, settings: workflows[2]!.settings, category: 'service', target: 'ticket' }, requiredModuleKeys: ['tickets'], tone: 'amber' },
    { id: `wftmpl-${organization.id}-4`, name: 'Follow up with inactive customers', category: 'sales', description: 'Creates a follow-up task when an account has had no activity for 30 days.', scenario: 'Customer inactive → schedule a follow-up', target: 'account', nodeCount: 4, installsCount: random.int(20, 480), definition: { triggers: workflows[3]!.triggers, nodes: workflows[3]!.nodes, edges: workflows[3]!.edges, settings: workflows[3]!.settings, category: 'sales', target: 'account' }, requiredModuleKeys: ['accounts'], tone: 'violet' },
    { id: `wftmpl-${organization.id}-5`, name: 'Renewal task before expiry', category: 'revenue', description: 'Creates a renewal task 60 days before a contract ends.', scenario: 'Contract nearing expiry → create a renewal task', target: 'contract', nodeCount: 4, installsCount: random.int(25, 560), definition: { triggers: workflows[4]!.triggers, nodes: workflows[4]!.nodes, edges: workflows[4]!.edges, settings: workflows[4]!.settings, category: 'revenue', target: 'contract' }, requiredModuleKeys: ['contracts', 'customer_success'], tone: 'teal' },
  ];

  return { workflows, templates };
}

/* ------------------------------------------------------------ integrations */

export function makeIntegrations(ctx: OrgContext) {
  const { random, organization } = ctx;

  const catalog = [
    { slug: 'google-workspace', name: 'Google Workspace', vendor: 'Google', category: 'email' as const, tagline: 'Two-way email and calendar sync', initials: 'GW', tone: 'blue' as const },
    { slug: 'microsoft-365', name: 'Microsoft 365', vendor: 'Microsoft', category: 'email' as const, tagline: 'Outlook mail and calendar', initials: 'M365', tone: 'blue' as const },
    { slug: 'slack', name: 'Slack', vendor: 'Slack', category: 'messaging' as const, tagline: 'Notifications and record sharing', initials: 'SL', tone: 'violet' as const },
    { slug: 'microsoft-teams', name: 'Microsoft Teams', vendor: 'Microsoft', category: 'messaging' as const, tagline: 'Channel notifications and meeting links', initials: 'MT', tone: 'violet' as const },
    { slug: 'whatsapp-business', name: 'WhatsApp Business Platform', vendor: 'Meta', category: 'messaging' as const, tagline: 'Customer messaging threads', initials: 'WA', tone: 'green' as const },
    { slug: 'stripe', name: 'Stripe', vendor: 'Stripe', category: 'payments' as const, tagline: 'Payment status on orders and invoices', initials: 'ST', tone: 'violet' as const },
    { slug: 'paypal', name: 'PayPal', vendor: 'PayPal', category: 'payments' as const, tagline: 'Payment presentation', initials: 'PP', tone: 'blue' as const },
    { slug: 'quickbooks', name: 'QuickBooks', vendor: 'Intuit', category: 'accounting' as const, tagline: 'Invoice and customer synchronisation', initials: 'QB', tone: 'green' as const },
    { slug: 'xero', name: 'Xero', vendor: 'Xero', category: 'accounting' as const, tagline: 'Invoice presentation and contact sync', initials: 'XR', tone: 'teal' as const },
    { slug: 'shopify', name: 'Shopify', vendor: 'Shopify', category: 'ecommerce' as const, tagline: 'Order and customer records', initials: 'SH', tone: 'green' as const },
    { slug: 'woocommerce', name: 'WooCommerce', vendor: 'Automattic', category: 'ecommerce' as const, tagline: 'Order and product records', initials: 'WC', tone: 'violet' as const },
    { slug: 'zoom', name: 'Zoom', vendor: 'Zoom', category: 'communication' as const, tagline: 'Meeting creation and recordings', initials: 'ZM', tone: 'blue' as const },
    { slug: 'zapier', name: 'Zapier', vendor: 'Zapier', category: 'developer_tools' as const, tagline: 'Trigger and action automation', initials: 'ZP', tone: 'amber' as const },
    { slug: 'make', name: 'Make', vendor: 'Make', category: 'developer_tools' as const, tagline: 'Visual scenario automation', initials: 'MK', tone: 'amber' as const },
    { slug: 'google-analytics', name: 'Google Analytics', vendor: 'Google', category: 'analytics' as const, tagline: 'Web attribution data', initials: 'GA', tone: 'amber' as const },
    { slug: 'google-ads', name: 'Google Ads', vendor: 'Google', category: 'marketing' as const, tagline: 'Campaign spend and conversions', initials: 'GAD', tone: 'blue' as const },
    { slug: 'meta-ads', name: 'Meta Ads', vendor: 'Meta', category: 'marketing' as const, tagline: 'Paid social campaign data', initials: 'MA', tone: 'blue' as const },
    { slug: 'mailchimp', name: 'Mailchimp', vendor: 'Intuit', category: 'marketing' as const, tagline: 'Audience and campaign sync', initials: 'MC', tone: 'amber' as const },
    { slug: 'twilio', name: 'Twilio', vendor: 'Twilio', category: 'telephony' as const, tagline: 'SMS and voice', initials: 'TW', tone: 'red' as const },
    { slug: 'dropbox', name: 'Dropbox', vendor: 'Dropbox', category: 'document_management' as const, tagline: 'Document storage references', initials: 'DB', tone: 'blue' as const },
    { slug: 'okta', name: 'Okta', vendor: 'Okta', category: 'identity' as const, tagline: 'Identity federation', initials: 'OK', tone: 'blue' as const },
    { slug: 'azure-ad', name: 'Microsoft Entra ID', vendor: 'Microsoft', category: 'identity' as const, tagline: 'Single sign-on and directory sync', initials: 'EA', tone: 'blue' as const },
    { slug: 'snowflake', name: 'Snowflake', vendor: 'Snowflake', category: 'data_warehouse' as const, tagline: 'Warehouse export target', initials: 'SF', tone: 'teal' as const },
  ];

  const integrations: import('@crm/shared-types').Integration[] = catalog.map((entry, index) => {
    const availability: import('@crm/shared-types').Integration['availability'] = index < 6 ? 'demo' : index < 14 ? 'planned' : index < 20 ? 'coming_soon' : 'unavailable';
    return {
      id: `int-${entry.slug}`,
      slug: entry.slug,
      name: entry.name,
      vendorLabel: entry.vendor,
      category: entry.category,
      tagline: entry.tagline,
      description: `${entry.name} integration. ${availability === 'demo' ? 'The connection interface exists in this build; no data is exchanged.' : availability === 'planned' ? 'Planned for a later release. The catalogue entry describes the intended capability.' : availability === 'coming_soon' ? 'In design. Nothing is implemented yet.' : 'Not currently planned. Listed so the catalogue reflects the full landscape.'}`,
      availability,
      availabilityNote: availability === 'demo' ? 'Interface demonstration only. No OAuth flow, credentials or data transfer.' : availability === 'planned' ? 'Planned. No interface or connection exists yet.' : availability === 'coming_soon' ? 'Coming soon. Under consideration.' : 'Unavailable. No timeline.',
      mark: { initials: entry.initials, tone: entry.tone, generated: true },
      capabilities: [
        { key: 'read', label: 'Read records', direction: 'inbound' },
        { key: 'write', label: 'Create records', direction: 'outbound' },
        { key: 'sync', label: 'Scheduled synchronisation', direction: 'bidirectional' },
      ],
      objects: ['contacts', 'accounts', 'activities'],
      authModel: 'oauth2',
      oauthState: 'not_implemented',
      setupSteps: [
        { id: 'st1', title: 'Connect the account', description: 'In the real integration this opens the provider consent screen. Nothing is requested in this build.', kind: 'connect' },
        { id: 'st2', title: 'Choose what to synchronise', description: 'Select the record types and the direction of travel.', kind: 'choose_sync' },
        { id: 'st3', title: 'Map your fields', description: 'Match local fields to the provider fields, with a conflict report.', kind: 'map_fields' },
        { id: 'st4', title: 'Test the connection', description: 'Run a dry run and review the result before enabling.', kind: 'test' },
      ],
      requiredScopes: [
        { scope: 'profile.read', label: 'Read basic profile information', sensitive: false },
        { scope: 'records.read', label: 'Read records you already have access to', sensitive: true },
        { scope: 'records.write', label: 'Create and update records', sensitive: true },
      ],
      isFeatured: index < 4,
      installsCount: availability === 'demo' ? random.int(400, 24000) : random.int(0, 400),
      rating: { average: Number(random.float(3.6, 4.9, 1).toFixed(1)), count: random.int(12, 2400), sampleData: true },
      verifiedByPlatform: index < 6,
      developerName: entry.vendor,
      versionLabel: `${random.int(1, 4)}.${random.int(0, 9)}.${random.int(0, 9)}`,
      lastUpdatedAt: stamp(random.int(20, 300), ctx),
      setupTimeMinutes: random.pick([5, 10, 15, 30]),
      requiresPlanModuleKey: 'integrations',
    };
  });

  const demoSlugs = integrations.filter((integration) => integration.availability === 'demo').slice(0, 3);
  const connections: import('@crm/shared-types').IntegrationConnection[] = demoSlugs.map((integration, index) => {
    const status: import('@crm/shared-types').IntegrationConnection['status'] = index === 0 ? 'connected_demo' : index === 1 ? 'needs_attention_demo' : 'paused_demo';
    return {
      id: `conn-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      integrationId: integration.id,
      integrationName: integration.name,
      integrationSlug: integration.slug,
      category: integration.category,
      status,
      simulated: true,
      connectedByName: ctx.primaryUser.displayName,
      connectedAt: stamp(random.int(60, 400), ctx),
      accountReferenceMasked: `****@${organization.slug}.example`,
      configuration: [
        { id: 'c1', key: 'sync_frequency', label: 'Sync frequency', valueDisplay: index === 0 ? 'Every 15 minutes' : 'Hourly', sensitive: false },
        { id: 'c2', key: 'conflict_policy', label: 'Conflict resolution', valueDisplay: 'Newest change wins', sensitive: false, description: 'Applies when both sides changed the same field since the last run.' },
      ],
      syncDirection: index === 2 ? 'inbound' : 'bidirectional',
      syncFrequency: index === 0 ? 'every_15_min' : 'hourly',
      fieldMappings: [
        { id: 'm1', localField: 'contact.email', remoteField: 'primaryEmail', direction: 'both', status: 'mapped' },
        { id: 'm2', localField: 'contact.phone', remoteField: 'workPhone', direction: 'inbound', status: 'mapped' },
        { id: 'm3', localField: 'contact.jobTitle', remoteField: 'jobTitle', direction: 'both', status: 'mapped' },
        { id: 'm4', localField: 'contact.department', remoteField: 'department', direction: 'inbound', status: index === 0 ? 'mapped' : 'unmapped', status2: undefined } as never,
      ],
      lastSyncAt: stamp(index === 1 ? 4 : 1, ctx),
      nextSyncAt: future(1, ctx),
      syncStats: { success: random.int(400, 12000), failed: index === 1 ? random.int(20, 240) : random.int(0, 30), skipped: random.int(0, 120), last30Days: random.int(200, 6000) },
      recentRuns: Array.from({ length: 8 }, (_, runIndex) => ({
        id: `run-${index}-${runIndex}`,
        startedAt: stamp(runIndex * 0.5 + 0.5, ctx),
        finishedAt: stamp(runIndex * 0.5 + 0.45, ctx),
        direction: 'bidirectional',
        state: index === 1 && runIndex < 2 ? 'failed_demo' as const : 'success_demo' as const,
        recordsRead: random.int(20, 900),
        recordsWritten: random.int(4, 400),
        recordsFailed: index === 1 && runIndex < 2 ? random.int(6, 60) : 0,
        errorSummary: index === 1 && runIndex < 2 ? 'Remote rate limit exceeded. The run will retry automatically.' : undefined,
      })),
      errorState: status === 'needs_attention_demo' ? { since: stamp(5, ctx), message: 'Two recent synchronisations failed with a rate-limit response.', hint: 'Reduce the sync frequency or narrow the mapped record types.', affectedRecords: random.int(20, 240) } : undefined,
      healthTrend: Array.from({ length: 14 }, (_, dayIndex) => ({ date: toDateString(addDays(DATASET_EPOCH, -(13 - dayIndex))), success: random.int(4, 40), failed: index === 1 && dayIndex < 3 ? random.int(1, 6) : 0 })),
      createdAt: stamp(400, ctx),
      updatedAt: stamp(2, ctx),
    };
  });

  const webhookEndpoints: import('@crm/shared-types').WebhookEndpoint[] = [
    {
      id: `wh-${organization.id}-1`,
      organizationId: organization.id,
      name: 'Data warehouse export',
      urlPlaceholder: 'https://warehouse.example.test/hooks/crm',
      urlHostLabel: 'warehouse.example.test',
      status: 'active',
      events: [
        { key: 'deal.won', label: 'Deal won', category: 'Sales', enabled: true },
        { key: 'deal.created', label: 'Deal created', category: 'Sales', enabled: true },
        { key: 'contact.created', label: 'Contact created', category: 'Contacts', enabled: true },
        { key: 'ticket.created', label: 'Ticket created', category: 'Service', enabled: false },
        { key: 'workflow.failed', label: 'Workflow run failed', category: 'Automation', enabled: true },
      ],
      signingSecretMasked: 'whsec_********************7c1f',
      signingSecretRotatedAt: stamp(120, ctx),
      apiVersion: 'v1',
      customHeaders: [{ key: 'X-Environment', valueMasked: 'production', sensitive: false }],
      deliveryStats: { total: random.int(4000, 40000), succeeded: random.int(3800, 39000), failed: random.int(20, 400), successRate: random.float(96, 99.9, 1), avgResponseMs: random.int(80, 640), last30Days: random.int(400, 4000) },
      lastDeliveryAt: stamp(0.05, ctx),
      lastFailureAt: stamp(3, ctx),
      deliveryMode: 'simulated',
      createdAt: stamp(400, ctx),
      updatedAt: stamp(10, ctx),
    },
  ];

  const webhookDeliveries: import('@crm/shared-types').WebhookDelivery[] = Array.from({ length: 40 }, (_, index) => ({
    id: `whd-${organization.id}-${index + 1}`,
    endpointId: webhookEndpoints[0]!.id,
    endpointName: webhookEndpoints[0]!.name,
    eventKey: random.pick(['deal.won', 'deal.created', 'contact.created', 'workflow.failed']),
    eventLabel: random.pick(['Deal won', 'Deal created', 'Contact created', 'Workflow run failed']),
    state: random.weighted([{ value: 'success_demo' as const, weight: 88 }, { value: 'failed_demo' as const, weight: 8 }, { value: 'retrying_demo' as const, weight: 4 }]),
    attempt: random.int(1, 3),
    maxAttempts: 5,
    // Payloads are truncated previews and contain no credentials.
    requestBodyPreview: '{"event":"deal.won","data":{"id":"deal-***","amount":{"amount":48000,"currency":"USD"},"stage":"closed_won"}}',
    responseStatus: random.pick([200, 200, 200, 202, 400, 429, 500]),
    responseBodyPreview: '{"received":true}',
    durationMs: random.int(40, 2400),
    at: stamp(index * 0.3, ctx),
    nextRetryAt: undefined,
    errorSummary: undefined,
    recordLabel: 'Deal',
  }));

  const apiKeys: import('@crm/shared-types').ApiKeyRecord[] = [
    { id: `key-${organization.id}-1`, organizationId: organization.id, name: 'Warehouse export', maskedKey: 'crm_live_****************4f2a', scopes: ['records.read', 'reports.read'], createdById: ctx.primaryUser.id, createdAt: stamp(300, ctx), lastUsedAt: stamp(0.2, ctx), expiresAt: toDateString(addDays(DATASET_EPOCH, 400)), status: 'active', demoOnly: true },
    { id: `key-${organization.id}-2`, organizationId: organization.id, name: 'Migration script', maskedKey: 'crm_live_****************9b77', scopes: ['records.read', 'records.write'], createdById: ctx.primaryUser.id, createdAt: stamp(600, ctx), lastUsedAt: stamp(420, ctx), expiresAt: toDateString(addDays(DATASET_EPOCH, -30)), status: 'expired', demoOnly: true },
  ];

  const apiRequestLogs: import('@crm/shared-types').ApiRequestLog[] = Array.from({ length: 50 }, (_, index) => ({
    id: `log-${organization.id}-${index + 1}`,
    at: stamp(index * 0.08, ctx),
    method: random.pick(['GET', 'GET', 'GET', 'POST', 'PATCH'] as const),
    path: random.pick(['/v1/contacts', '/v1/deals', '/v1/accounts', '/v1/tickets', '/v1/reports/pipeline']),
    statusCode: random.weighted([{ value: 200 as const, weight: 82 }, { value: 201 as const, weight: 8 }, { value: 400 as const, weight: 4 }, { value: 404 as const, weight: 3 }, { value: 429 as const, weight: 2 }, { value: 500 as const, weight: 1 }]),
    durationMs: random.int(24, 1800),
    apiKeyMasked: 'crm_live_****************4f2a',
    apiKeyName: 'Warehouse export',
    userAgent: 'warehouse-sync/1.4',
    ipMasked: `203.0.113.***`,
    rateLimitRemaining: random.int(0, 5000),
    requestBodyRedacted: undefined,
    responseSummary: random.pick(['Returned 1 page of 50 records.', 'Record created.', 'Validation failed: 2 fields.', 'No matching record.', 'Rate limit exceeded.']),
    scopeUsed: 'records.read',
  }));

  const developerApps: import('@crm/shared-types').DeveloperApp[] = [
    { id: `app-${organization.id}-1`, organizationId: organization.id, name: 'Warehouse connector', slug: 'warehouse-connector', description: 'Exports changed records to a data warehouse on a schedule.', publisherLabel: 'Internal engineering', kind: 'private', status: 'installed', category: 'data_warehouse', permissions: [{ key: 'records.read', label: 'Read records', description: 'Read every record the installing user can already access.', sensitive: true, required: true }, { key: 'reports.read', label: 'Read reports', description: 'Read saved report definitions and their results.', sensitive: false, required: false }], installScope: 'organization', version: '1.4.0', installsCount: 1, rating: { average: 0, count: 0, sampleData: true }, mark: { initials: 'WC', tone: 'teal', generated: true }, pricingLabel: 'Internal', isFeatured: false, lastUpdatedAt: stamp(60, ctx), reviews: [], createdAt: stamp(300, ctx), updatedAt: stamp(60, ctx) },
  ];

  return { integrations, connections, webhookEndpoints, webhookDeliveries, apiKeys, apiRequestLogs, developerApps };
}

/* ------------------------------------------------------------------- AI */

export function makeAi(ctx: OrgContext, deals: Deal[], accounts: Account[]): { conversations: import('@crm/shared-types').AiConversation[]; usage: import('@crm/shared-types').AiUsageRecord[] } {
  const { random, organization, users } = ctx;
  const user = ctx.primaryUser;
  const deal = deals[0]!;
  const account = accounts[0]!;

  const conversations: import('@crm/shared-types').AiConversation[] = [
    {
      id: `aiconv-${organization.id}-1`,
      organizationId: organization.id,
      userId: user.id,
      title: 'Account summary before a meeting',
      entryPoint: 'record_page',
      contextualRecord: { type: 'account', id: account.id, label: account.name, route: `/app/accounts/${account.id}` },
      pinned: true,
      capabilitiesUsed: ['account_summary', 'next_best_action'],
      totalCredits: 4,
      messages: [
        { id: 'm1', conversationId: `aiconv-${organization.id}-1`, role: 'user', content: `Summarise ${account.name} before my meeting tomorrow.`, origin: 'user_input', createdAt: stamp(2, ctx), capability: 'account_summary' },
        {
          id: 'm2',
          conversationId: `aiconv-${organization.id}-1`,
          role: 'assistant',
          content: `${account.name} is a ${account.industryLabel ?? 'customer'} account with a health score of ${account.healthScore ?? 'unknown'} (${account.health}). There are ${account.openDealCount} open deals totalling ${account.totalRevenueWon?.amount ? `$${Math.round(account.totalRevenueWon.amount / 1000)}k` : 'an unknown amount'} closed to date.\n\nThree things worth raising:\n\n1. Adoption is the strongest signal you have — usage has risen for three consecutive months.\n2. One support ticket is at risk of breaching its resolution target and is unassigned.\n3. The renewal date falls inside the next two quarters, and no renewal activity has been logged yet.`,
          origin: 'demo_template_engine',
          createdAt: stamp(2, ctx),
          capability: 'account_summary',
          citations: [
            { label: account.name, type: 'record', id: account.id, route: `/app/accounts/${account.id}`, excerpt: `Health ${account.healthScore ?? '—'} · ${account.health}` },
            { label: 'Open deals', type: 'record', id: deal.id, route: `/app/deals/${deal.id}`, excerpt: deal.name },
            { label: 'Renewal record', type: 'record', route: '/app/customer-success/renewals', excerpt: 'No activity logged' },
          ],
          suggestions: [
            { id: 's1', label: 'Draft a meeting agenda', prompt: 'Draft a 30-minute agenda for this account.', capability: 'general_assistant' },
            { id: 's2', label: 'Explain the health score', prompt: 'Which factors are driving the health score?', capability: 'churn_risk_explanation' },
          ],
          confidence: { level: 'medium', note: 'Based on six records. Support volume is a small sample.' },
          usage: { inputTokens: 780, outputTokens: 264, credits: 2, latencyMs: 640 },
          feedback: null,
        },
      ],
      createdAt: stamp(2, ctx),
      updatedAt: stamp(2, ctx),
    },
  ];

  const usage: import('@crm/shared-types').AiUsageRecord[] = Array.from({ length: 80 }, (_, index) => {
    const capability = random.pick(['account_summary', 'deal_insight', 'email_draft', 'forecast_explanation', 'next_best_action', 'natural_language_report', 'lead_scoring_explanation'] as const);
    const credits = random.int(1, 6);
    return {
      id: `aiuse-${organization.id}-${index + 1}`,
      organizationId: organization.id,
      userId: random.pick(users).id,
      userName: random.pick(users).displayName,
      capability,
      occurredAt: stamp(random.int(1, 90), ctx),
      credits,
      inputTokens: random.int(120, 1400),
      outputTokens: random.int(80, 900),
      latencyMs: random.int(180, 2400),
      accepted: random.chance(0.72) ? true : random.chance(0.6) ? false : null,
      feedback: random.chance(0.4) ? random.pick(['helpful', 'not_helpful'] as const) : null,
    };
  });

  return { conversations, usage };
}

/* --------------------------------------------------------------- platform */

export function makePlatform(): {
  plans: import('@crm/shared-types').PlatformPlan[];
  addOns: import('@crm/shared-types').PlatformAddOn[];
  users: import('@crm/shared-types').PlatformUser[];
  roles: import('@crm/shared-types').PlatformRole[];
  audit: import('@crm/shared-types').PlatformAuditEvent[];
  supportTickets: import('@crm/shared-types').PlatformSupportTicket[];
  flags: import('@crm/shared-types').FeatureFlag[];
  moduleCatalog: import('@crm/shared-types').ModuleCatalogEntry[];
  localization: import('@crm/shared-types').LocalizationAdminRow[];
  status: import('@crm/shared-types').SystemStatusComponent[];
  banners: import('@crm/shared-types').MaintenanceBanner[];
} {
  const random = createRandom(20270101);
  const stampAt = (days: number) => toDateTimeString(random.pastDate(days, DATASET_EPOCH));

  const plans: import('@crm/shared-types').PlatformPlan[] = [
    { id: 'plan-free', name: 'Free', code: 'free', description: 'Single-user core CRM.', commercialState: 'illustrative_not_final', visibility: 'public', sortOrder: 1, tone: 'slate', billingOptions: [{ interval: 'month', basePlatformFee: { amount: 0, currency: 'USD' }, pricingModel: 'per_user', perUserPrice: { amount: 0, currency: 'USD' }, minimumSeats: 1, maximumSeats: 1, includedSeats: 1, currency: 'USD' }], seatLimits: { min: 1, max: 1, includedUsers: 1, includedViewers: 0 }, featureLimits: [{ key: 'records', label: 'Records', unit: 'records', included: 1500, unlimited: false, overageAllowed: false }], moduleKeys: ['home', 'activities', 'calendar', 'contacts', 'accounts', 'deals'], addOnIds: [], trial: { enabled: false, days: 0, requiresCard: false, convertibleTo: ['plan-starter'] }, availability: { regions: ['*'], countryAllowlist: [], excludedCountries: [] }, regionalPricing: [{ region: 'Global', currency: 'USD', priceMultiplier: 1, note: 'Illustrative only.' }], tenantCount: 0, mrrContribution: { amount: 0, currency: 'USD' }, isDefault: false, isArchived: false, createdAt: stampAt(800), updatedAt: stampAt(60) },
    { id: 'plan-starter', name: 'Starter', code: 'starter', description: 'Small teams replacing spreadsheets.', commercialState: 'illustrative_not_final', visibility: 'public', sortOrder: 2, tone: 'blue', billingOptions: [{ interval: 'month', basePlatformFee: { amount: 0, currency: 'USD' }, pricingModel: 'per_user', perUserPrice: { amount: 29, currency: 'USD' }, minimumSeats: 2, maximumSeats: 50, includedSeats: 2, currency: 'USD' }, { interval: 'year', basePlatformFee: { amount: 0, currency: 'USD' }, pricingModel: 'per_user', perUserPrice: { amount: 24, currency: 'USD' }, minimumSeats: 2, maximumSeats: 50, includedSeats: 2, annualDiscountPercent: 17, currency: 'USD' }], seatLimits: { min: 2, max: 50, includedUsers: 2, includedViewers: 5 }, featureLimits: [{ key: 'records', label: 'Records', unit: 'records', included: 100000, unlimited: false, overageAllowed: true }], moduleKeys: ['home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'products', 'documents', 'analytics', 'knowledge_base'], addOnIds: ['addon-ai-credits', 'addon-portal'], trial: { enabled: true, days: 14, requiresCard: false, convertibleTo: ['plan-professional'] }, availability: { regions: ['*'], countryAllowlist: [], excludedCountries: [] }, regionalPricing: [{ region: 'Global', currency: 'USD', priceMultiplier: 1, note: 'Illustrative only.' }], tenantCount: 1, mrrContribution: { amount: 348, currency: 'USD' }, isDefault: false, isArchived: false, createdAt: stampAt(800), updatedAt: stampAt(40) },
    { id: 'plan-professional', name: 'Professional', code: 'professional', description: 'The full revenue operating system.', commercialState: 'illustrative_not_final', visibility: 'public', sortOrder: 3, tone: 'violet', billingOptions: [{ interval: 'month', basePlatformFee: { amount: 99, currency: 'USD' }, pricingModel: 'per_user_plus_flat', perUserPrice: { amount: 65, currency: 'USD' }, minimumSeats: 5, maximumSeats: 500, includedSeats: 5, currency: 'USD' }, { interval: 'year', basePlatformFee: { amount: 990, currency: 'USD' }, pricingModel: 'per_user_plus_flat', perUserPrice: { amount: 54, currency: 'USD' }, minimumSeats: 5, maximumSeats: 500, includedSeats: 5, annualDiscountPercent: 17, currency: 'USD' }], seatLimits: { min: 5, max: 500, includedUsers: 5, includedViewers: 25 }, featureLimits: [{ key: 'records', label: 'Records', unit: 'records', included: 1000000, unlimited: false, overageAllowed: true }, { key: 'custom_objects', label: 'Custom objects', unit: 'objects', included: 25, unlimited: false, overageAllowed: false }], moduleKeys: ['home', 'activities', 'calendar', 'leads', 'contacts', 'accounts', 'deals', 'campaigns', 'tickets', 'knowledge_base', 'products', 'quotes', 'orders', 'contracts', 'inbox', 'documents', 'projects', 'analytics', 'workflows', 'ai', 'integrations', 'customization', 'templates', 'portal', 'org_admin', 'billing'], addOnIds: ['addon-ai-credits', 'addon-field-sales', 'addon-partners', 'addon-portal', 'addon-premium-support'], trial: { enabled: true, days: 14, requiresCard: false, convertibleTo: ['plan-enterprise'] }, availability: { regions: ['*'], countryAllowlist: [], excludedCountries: [] }, regionalPricing: [{ region: 'Global', currency: 'USD', priceMultiplier: 1, note: 'Illustrative only.' }, { region: 'EU', currency: 'EUR', priceMultiplier: 0.92, note: 'Illustrative regional presentation.' }], tenantCount: 1, mrrContribution: { amount: 4139, currency: 'USD' }, isDefault: true, isArchived: false, createdAt: stampAt(800), updatedAt: stampAt(20) },
    { id: 'plan-enterprise', name: 'Enterprise', code: 'enterprise', description: 'Governance, identity and scale.', commercialState: 'illustrative_not_final', visibility: 'public', sortOrder: 4, tone: 'teal', billingOptions: [{ interval: 'month', basePlatformFee: { amount: 1200, currency: 'USD' }, pricingModel: 'per_user_plus_flat', perUserPrice: { amount: 110, currency: 'USD' }, minimumSeats: 25, maximumSeats: null, includedSeats: 25, currency: 'USD' }, { interval: 'year', basePlatformFee: { amount: 12000, currency: 'USD' }, pricingModel: 'per_user_plus_flat', perUserPrice: { amount: 91, currency: 'USD' }, minimumSeats: 25, maximumSeats: null, includedSeats: 25, annualDiscountPercent: 17, currency: 'USD' }], seatLimits: { min: 25, max: null, includedUsers: 25, includedViewers: 200 }, featureLimits: [{ key: 'records', label: 'Records', unit: 'records', included: null, unlimited: true, overageAllowed: false }, { key: 'sandboxes', label: 'Sandbox environments', unit: 'environments', included: 2, unlimited: false, overageAllowed: false }], moduleKeys: ['*'], addOnIds: ['addon-premium-support', 'addon-sandbox', 'addon-data-residency'], trial: { enabled: true, days: 30, requiresCard: false, convertibleTo: [] }, availability: { regions: ['*'], countryAllowlist: [], excludedCountries: [] }, regionalPricing: [{ region: 'Global', currency: 'USD', priceMultiplier: 1, note: 'Illustrative only.' }], tenantCount: 1, mrrContribution: { amount: 4850, currency: 'EUR' }, isDefault: false, isArchived: false, createdAt: stampAt(700), updatedAt: stampAt(30) },
  ];

  const addOns: import('@crm/shared-types').PlatformAddOn[] = [
    { id: 'addon-ai-credits', name: 'AI credit pack', code: 'ai-credits', description: 'Additional monthly AI credits.', moduleKeys: ['ai'], pricingModel: 'per_unit', price: { amount: 149, currency: 'USD' }, currency: 'USD', unitLabel: '10,000 credits / month', includedQuantity: 10000, compatiblePlanIds: ['plan-starter', 'plan-professional', 'plan-enterprise'], tenantCount: 12, mrrContribution: { amount: 1788, currency: 'USD' }, isActive: true, tone: 'violet', createdAt: stampAt(500), updatedAt: stampAt(50) },
    { id: 'addon-field-sales', name: 'Field sales & territories', code: 'field-sales', description: 'Territories, visit planning and coverage analysis.', moduleKeys: ['field_sales'], pricingModel: 'per_user_monthly', price: { amount: 18, currency: 'USD' }, currency: 'USD', unitLabel: 'per field user / month', compatiblePlanIds: ['plan-professional', 'plan-enterprise'], tenantCount: 7, mrrContribution: { amount: 1260, currency: 'USD' }, isActive: true, tone: 'amber', createdAt: stampAt(460), updatedAt: stampAt(45) },
    { id: 'addon-partners', name: 'Partner relationship management', code: 'partners', description: 'Partner directory, deal registration and commissions.', moduleKeys: ['partners'], pricingModel: 'flat_monthly', price: { amount: 249, currency: 'USD' }, currency: 'USD', compatiblePlanIds: ['plan-professional', 'plan-enterprise'], tenantCount: 4, mrrContribution: { amount: 996, currency: 'USD' }, isActive: true, tone: 'teal', createdAt: stampAt(400), updatedAt: stampAt(40) },
    { id: 'addon-portal', name: 'Customer self-service portal', code: 'portal', description: 'Branded portal for tickets, knowledge and project status.', moduleKeys: ['portal'], pricingModel: 'flat_monthly', price: { amount: 79, currency: 'USD' }, currency: 'USD', compatiblePlanIds: ['plan-starter', 'plan-professional', 'plan-enterprise'], tenantCount: 18, mrrContribution: { amount: 1422, currency: 'USD' }, isActive: true, tone: 'blue', createdAt: stampAt(360), updatedAt: stampAt(35) },
    { id: 'addon-premium-support', name: 'Premium support', code: 'premium-support', description: 'Faster response targets and a named technical contact.', moduleKeys: [], pricingModel: 'per_user_monthly', price: { amount: 12, currency: 'USD' }, currency: 'USD', unitLabel: 'per user / month', compatiblePlanIds: ['plan-professional', 'plan-enterprise'], tenantCount: 9, mrrContribution: { amount: 3240, currency: 'USD' }, isActive: true, tone: 'green', createdAt: stampAt(340), updatedAt: stampAt(30) },
    { id: 'addon-sandbox', name: 'Additional sandbox', code: 'sandbox', description: 'An extra isolated environment for configuration testing.', moduleKeys: [], pricingModel: 'flat_monthly', price: { amount: 199, currency: 'USD' }, currency: 'USD', compatiblePlanIds: ['plan-enterprise'], tenantCount: 5, mrrContribution: { amount: 995, currency: 'USD' }, isActive: true, tone: 'slate', createdAt: stampAt(300), updatedAt: stampAt(25) },
    { id: 'addon-data-residency', name: 'Data residency selection', code: 'data-residency', description: 'Choose a hosting region. Terms are agreed in the contract.', moduleKeys: [], pricingModel: 'custom_contract', price: { amount: 0, currency: 'USD' }, currency: 'USD', compatiblePlanIds: ['plan-enterprise'], tenantCount: 3, mrrContribution: { amount: 0, currency: 'USD' }, isActive: true, tone: 'violet', createdAt: stampAt(280), updatedAt: stampAt(20) },
  ];

  const platformRoles: import('@crm/shared-types').PlatformRole[] = [
    { id: 'prole-super', name: 'Super administrator', description: 'Every platform capability, including billing overrides and tenant suspension.', kind: 'system', permissions: [{ key: 'tenants.manage', label: 'Manage tenants', category: 'Tenants', effect: 'allow' }, { key: 'billing.manage', label: 'Manage billing', category: 'Billing', effect: 'allow' }, { key: 'security.manage', label: 'Manage platform security', category: 'Security', effect: 'allow' }, { key: 'users.manage', label: 'Manage platform users', category: 'Users', effect: 'allow' }], userCount: 2, dualApprovalActions: ['tenant.suspend', 'invoice.refund', 'plan.archive'], isDefault: false, createdAt: stampAt(800), updatedAt: stampAt(60) },
    { id: 'prole-support', name: 'Support engineer', description: 'Tenant support, notes and read-only billing inspection.', kind: 'system', permissions: [{ key: 'tenants.read', label: 'View tenants', category: 'Tenants', effect: 'allow' }, { key: 'support.manage', label: 'Manage support tickets', category: 'Support', effect: 'allow' }, { key: 'billing.read', label: 'View billing', category: 'Billing', effect: 'allow' }, { key: 'security.manage', label: 'Manage platform security', category: 'Security', effect: 'deny' }], userCount: 5, dualApprovalActions: [], isDefault: true, createdAt: stampAt(800), updatedAt: stampAt(60) },
    { id: 'prole-revenue', name: 'Revenue operations', description: 'Plans, subscriptions, refunds and regional pricing.', kind: 'system', permissions: [{ key: 'billing.manage', label: 'Manage billing', category: 'Billing', effect: 'allow' }, { key: 'plans.manage', label: 'Manage plans', category: 'Plans', effect: 'allow' }, { key: 'tenants.read', label: 'View tenants', category: 'Tenants', effect: 'allow' }], userCount: 3, dualApprovalActions: ['invoice.refund', 'plan.archive'], isDefault: false, createdAt: stampAt(760), updatedAt: stampAt(50) },
    { id: 'prole-localization', name: 'Localization manager', description: 'Translation review and locale enablement.', kind: 'system', permissions: [{ key: 'localization.manage', label: 'Manage localization', category: 'Localization', effect: 'allow' }, { key: 'notifications.manage', label: 'Manage notification templates', category: 'Notifications', effect: 'allow' }], userCount: 1, dualApprovalActions: [], isDefault: false, createdAt: stampAt(600), updatedAt: stampAt(40) },
  ];

  const platformUserNames = [
    { name: 'Ines Marchetti', team: 'leadership' as const, roleId: 'prole-super' },
    { name: 'Rafael Duarte', team: 'engineering' as const, roleId: 'prole-super' },
    { name: 'Hana Kassem', team: 'support' as const, roleId: 'prole-support' },
    { name: 'Tomas Lindqvist', team: 'support' as const, roleId: 'prole-support' },
    { name: 'Priya Iyer', team: 'support' as const, roleId: 'prole-support' },
    { name: 'Dieter Brandt', team: 'revenue' as const, roleId: 'prole-revenue' },
    { name: 'Anouk Delacroix', team: 'revenue' as const, roleId: 'prole-revenue' },
    { name: 'Mei Chen', team: 'marketing' as const, roleId: 'prole-localization' },
  ];

  const platformUsers: import('@crm/shared-types').PlatformUser[] = platformUserNames.map((entry, index) => ({
    id: `puser-${index + 1}`,
    name: entry.name,
    email: `${entry.name.toLowerCase().replace(/\s+/g, '.')}@example-crm.test`,
    initials: entry.name.split(' ').map((part) => part[0] ?? '').join('').toUpperCase(),
    team: entry.team as import('@crm/shared-types').PlatformUser['team'],
    platformRoleIds: [entry.roleId],
    platformRoleNames: [platformRoles.find((role) => role.id === entry.roleId)?.name ?? 'Support engineer'],
    status: index === 7 ? 'invited' : 'active',
    lastActiveAt: stampAt(random.int(0.2, 30)),
    mfaEnabled: index < 6,
    sensitiveDataAccess: entry.roleId === 'prole-super' || entry.roleId === 'prole-revenue',
    assignedTenantIds: [],
    accessReviewedAt: toDateString(random.pastDate(200, DATASET_EPOCH)),
    createdAt: stampAt(800),
    updatedAt: stampAt(40),
  }));

  const auditActions = ['tenant.suspended', 'plan.updated', 'feature_flag.toggled', 'subscription.seats_changed', 'invoice.refunded', 'user.invited', 'localization.updated', 'announcement.published', 'tenant.trial_extended', 'integration.catalog_updated'];
  const audit: import('@crm/shared-types').PlatformAuditEvent[] = Array.from({ length: 60 }, (_, index) => {
    const actor = random.pick(platformUsers);
    const action = random.pick(auditActions);
    return {
      id: `paudit-${index + 1}`,
      at: stampAt(random.int(0.1, 60)),
      actorId: actor.id,
      actorName: actor.name,
      actorType: random.chance(0.9) ? 'platform_user' : 'automation',
      action,
      category: action.startsWith('tenant') ? 'tenant' : action.startsWith('plan') ? 'plan' : action.startsWith('feature') ? 'flag' : action.startsWith('subscription') ? 'billing' : action.startsWith('invoice') ? 'billing' : action.startsWith('user') ? 'user' : action.startsWith('localization') ? 'localization' : 'support',
      targetLabel: random.pick(['Vertex Software Group', 'Nordwind Maschinenbau GmbH', 'Al Noor Trading FZE', 'Professional plan', 'AI assistant panel flag']),
      outcome: random.chance(0.94) ? 'success' : random.chance(0.6) ? 'denied' : 'failure',
      severity: random.weighted([{ value: 'info' as const, weight: 60 }, { value: 'notice' as const, weight: 26 }, { value: 'warning' as const, weight: 11 }, { value: 'critical' as const, weight: 3 }]),
      changes: random.chance(0.5) ? [{ field: 'value', before: 'off', after: 'on' }] : undefined,
      ipMasked: '203.0.113.***',
      userAgent: 'Platform console',
      approval: random.chance(0.15) ? { required: true, approvedByName: random.pick(platformUsers).name, approvedAt: stampAt(10), reason: 'Dual control required for this action.' } : undefined,
    };
  });

  const supportTickets: import('@crm/shared-types').PlatformSupportTicket[] = Array.from({ length: 18 }, (_, index) => {
    const created = random.pastDate(30, DATASET_EPOCH);
    const status = random.weighted([{ value: 'open' as const, weight: 22 }, { value: 'waiting_on_tenant' as const, weight: 18 }, { value: 'waiting_on_platform' as const, weight: 24 }, { value: 'escalated' as const, weight: 10 }, { value: 'resolved' as const, weight: 20 }, { value: 'closed' as const, weight: 6 }]);
    return {
      id: `ptkt-${index + 1}`,
      reference: `PS-${String(4000 + index * 2).padStart(4, '0')}`,
      tenantId: random.pick(['ten-vertex', 'ten-nordwind', 'ten-alnoor']),
      tenantName: random.pick(['Vertex Software Group', 'Nordwind Maschinenbau GmbH', 'Al Noor Trading FZE']),
      requesterName: 'Tenant administrator',
      requesterEmail: 'admin@example.test',
      subject: random.pick(['Request to increase storage quota', 'Sandbox refresh scheduling', 'SSO configuration review', 'Question about regional pricing', 'Bulk import performance', 'Feature flag enablement request']),
      status,
      priority: random.pick(['high', 'normal', 'normal', 'low'] as const),
      category: random.pick(['technical', 'billing', 'onboarding', 'feature_request', 'data_request', 'migration'] as const),
      assigneeName: random.pick(platformUsers).name,
      slaState: random.pick(['on_track', 'on_track', 'at_risk', 'breached', 'none'] as const),
      firstResponseAt: toDateTimeString(addDays(created, random.float(0.05, 0.5, 3))),
      resolutionAt: status === 'resolved' || status === 'closed' ? toDateTimeString(addDays(created, random.float(0.5, 4, 3))) : undefined,
      messages: [
        { id: `pm-${index}-1`, at: toDateTimeString(created), authorName: 'Tenant administrator', authorKind: 'tenant', body: 'We are approaching our storage allowance and would like to understand the options before it becomes an issue.', internal: false },
        { id: `pm-${index}-2`, at: toDateTimeString(addDays(created, 0.2)), authorName: random.pick(platformUsers).name, authorKind: 'platform', body: 'Thanks for the heads up. I can see the current usage and will confirm the available options today.', internal: false },
      ],
      internalNotes: [{ id: `pn-${index}`, at: toDateTimeString(addDays(created, 0.3)), authorName: 'Platform support', body: 'Checked the entitlement. They are at 82% of allowance with three months to run. Recommend offering the next tier before renewal.' }],
      escalationReason: status === 'escalated' ? 'Tenant requested a contractual review' : undefined,
      createdAt: toDateTimeString(created),
      updatedAt: stampAt(random.int(0.5, 10)),
    };
  });

  const flags: import('@crm/shared-types').FeatureFlag[] = [
    { id: 'flag-1', key: 'ai-assistant-panel', name: 'AI assistant side panel', description: 'Shows the assistant panel on record pages.', category: 'ai', status: 'partial', rollout: { kind: 'percentage', percentage: 40 }, ownerTeam: 'AI platform', evaluationState: 'simulated', affectedTenants: 3, createdByName: 'Ines Marchetti', lastToggledAt: stampAt(12), lastToggledByName: 'Rafael Duarte', auditTrail: [{ id: 'fa-1', at: stampAt(12), actorName: 'Rafael Duarte', change: 'Rollout raised from 20% to 40%', note: 'No regressions observed in the first cohort.' }], createdAt: stampAt(200), updatedAt: stampAt(12) },
    { id: 'flag-2', key: 'forecast-accuracy-widget', name: 'Forecast accuracy widget', description: 'Adds forecast accuracy tracking to the analytics dashboard.', category: 'crm', status: 'on', rollout: { kind: 'all_tenants' }, ownerTeam: 'Core CRM', evaluationState: 'simulated', affectedTenants: 3, createdByName: 'Dieter Brandt', lastToggledAt: stampAt(40), lastToggledByName: 'Dieter Brandt', auditTrail: [{ id: 'fa-2', at: stampAt(40), actorName: 'Dieter Brandt', change: 'Enabled for all tenants' }], createdAt: stampAt(180), updatedAt: stampAt(40) },
    { id: 'flag-3', key: 'new-import-wizard', name: 'Rebuilt import wizard', description: 'Validation-before-commit import flow.', category: 'crm', status: 'partial', rollout: { kind: 'specific_tenants', tenantIds: ['ten-vertex', 'ten-nordwind'] }, ownerTeam: 'Data platform', evaluationState: 'simulated', affectedTenants: 2, createdByName: 'Hana Kassem', lastToggledAt: stampAt(20), lastToggledByName: 'Hana Kassem', auditTrail: [{ id: 'fa-3', at: stampAt(20), actorName: 'Hana Kassem', change: 'Added Nordwind to the cohort' }], createdAt: stampAt(150), updatedAt: stampAt(20) },
    { id: 'flag-4', key: 'partner-portal-v2', name: 'Partner portal v2', description: 'Rebuilt partner deal registration experience.', category: 'crm', status: 'off', rollout: { kind: 'internal_users' }, ownerTeam: 'Channel team', evaluationState: 'simulated', affectedTenants: 0, createdByName: 'Tomas Lindqvist', lastToggledAt: stampAt(60), lastToggledByName: 'Tomas Lindqvist', auditTrail: [{ id: 'fa-4', at: stampAt(60), actorName: 'Tomas Lindqvist', change: 'Disabled while a conflict-check bug is investigated' }], createdAt: stampAt(240), updatedAt: stampAt(60) },
    { id: 'flag-5', key: 'regional-price-display', name: 'Regional price presentation', description: 'Shows localized pricing in the subscription screens.', category: 'platform', status: 'deprecated', rollout: { kind: 'plan_based', planIds: ['plan-enterprise'] }, ownerTeam: 'Revenue operations', evaluationState: 'simulated', affectedTenants: 1, createdByName: 'Anouk Delacroix', lastToggledAt: stampAt(120), lastToggledByName: 'Anouk Delacroix', expiresAt: toDateString(addDays(DATASET_EPOCH, 30)), auditTrail: [{ id: 'fa-5', at: stampAt(120), actorName: 'Anouk Delacroix', change: 'Moved to deprecated; superseded by plan-level regional pricing' }], createdAt: stampAt(400), updatedAt: stampAt(120) },
  ];

  const moduleNames: Array<[string, string, string, import('@crm/shared-types').ModuleCatalogEntry['category']]> = [
    ['home', 'Home', 'Role-based dashboards', 'core'],
    ['leads', 'Leads', 'Capture, score and convert', 'sales'],
    ['contacts', 'Contacts', 'People and relationships', 'core'],
    ['accounts', 'Accounts', 'Companies and hierarchies', 'core'],
    ['deals', 'Deals', 'Pipeline and forecasting', 'sales'],
    ['campaigns', 'Marketing', 'Campaigns, audiences, journeys', 'marketing'],
    ['tickets', 'Support', 'Queues, SLAs and escalation', 'service'],
    ['customer_success', 'Customer success', 'Health, onboarding, renewals', 'success'],
    ['products', 'Products', 'Catalog and price books', 'operations'],
    ['quotes', 'Quotes', 'Quoting and approvals', 'operations'],
    ['contracts', 'Contracts', 'Terms and renewals', 'operations'],
    ['subscriptions', 'Recurring revenue', 'MRR, ARR and retention', 'operations'],
    ['inbox', 'Omnichannel inbox', 'Email, SMS, chat and calls', 'service'],
    ['projects', 'Projects', 'Delivery and handoff', 'operations'],
    ['field_sales', 'Field sales', 'Territories and visits', 'addon'],
    ['partners', 'Partners', 'Deal registration and commissions', 'addon'],
    ['analytics', 'Analytics', 'Dashboards and reports', 'platform'],
    ['workflows', 'Workflows', 'No-code automation', 'platform'],
    ['ai', 'AI assistant', 'Summaries, drafting and insights', 'platform'],
    ['customization', 'Customization', 'Objects, fields and layouts', 'platform'],
    ['templates', 'Industry templates', 'Configuration profiles', 'platform'],
    ['integrations', 'Integrations', 'Provider connections', 'platform'],
    ['developer', 'Developer platform', 'API keys and webhooks', 'platform'],
    ['portal', 'Customer portal', 'Self-service experience', 'addon'],
    ['org_admin', 'Administration', 'People, access and data', 'core'],
  ];

  const moduleCatalog: import('@crm/shared-types').ModuleCatalogEntry[] = moduleNames.map(([key, name, description, category], index) => ({
    key,
    name,
    description,
    section: category === 'core' ? 'Workspace' : category === 'sales' ? 'Sales' : category === 'marketing' ? 'Marketing' : category === 'service' ? 'Service' : category === 'success' ? 'Service' : category === 'operations' ? 'Revenue' : 'Automation',
    icon: 'Box',
    tone: (['violet', 'teal', 'blue', 'amber', 'green', 'slate', 'red'] as const)[index % 7]!,
    category,
    surfaces: category === 'addon' && key === 'portal' ? ['portal'] : ['crm'],
    status: index < 20 ? 'ga' : index < 23 ? 'ga' : 'beta',
    entitlement: { unit: key === 'ai' ? 'usage' : 'seat', defaultPlans: index < 6 ? ['plan-free', 'plan-starter', 'plan-professional', 'plan-enterprise'] : index < 13 ? ['plan-starter', 'plan-professional', 'plan-enterprise'] : ['plan-professional', 'plan-enterprise'], requiresAddOn: category === 'addon', usageMetricKey: key === 'ai' ? 'ai_credits' : undefined },
    dependencies: key === 'customer_success' ? ['accounts', 'contracts'] : key === 'quotes' ? ['products', 'deals'] : [],
    sideEffects: key === 'workflows' ? ['Creates tasks and notifications'] : key === 'ai' ? ['Consumes AI credits'] : [],
    screenshotsPlaceholder: 3,
    tenantAdoption: random.int(1, 3),
    documentationUrlPlaceholder: `/docs/${key}`,
    sortOrder: index + 1,
    isEnabledGlobally: index < 23,
  }));

  const localeRows: import('@crm/shared-types').LocalizationAdminRow[] = [
    { locale: 'en', languageName: 'English', englishName: 'English', direction: 'ltr', translationCompletenessPercent: 100, missingKeys: 0, reviewedPercent: 100, translators: ['Platform team'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'en', pluralRulesMissing: 0, status: 'reference', lastUpdatedAt: stampAt(2), qualityNote: 'Reference language. All keys are authored here first.' },
    { locale: 'ar', languageName: 'العربية', englishName: 'Arabic', direction: 'rtl', translationCompletenessPercent: 45, missingKeys: 82, reviewedPercent: 45, translators: ['Community contributor A'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'en', pluralRulesMissing: 0, status: 'in_progress', lastUpdatedAt: stampAt(18), qualityNote: 'RTL reference locale. Direction verified against the shell.' },
    { locale: 'es', languageName: 'Español', englishName: 'Spanish', direction: 'ltr', translationCompletenessPercent: 62, missingKeys: 57, reviewedPercent: 62, translators: ['Community contributor B'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'en', pluralRulesMissing: 0, status: 'in_progress', lastUpdatedAt: stampAt(22), qualityNote: 'Core navigation and record surfaces complete.' },
    { locale: 'fr', languageName: 'Français', englishName: 'French', direction: 'ltr', translationCompletenessPercent: 58, missingKeys: 63, reviewedPercent: 58, translators: ['Community contributor C'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'en', pluralRulesMissing: 0, status: 'in_progress', lastUpdatedAt: stampAt(26), qualityNote: 'Interface complete; help content pending.' },
    { locale: 'de', languageName: 'Deutsch', englishName: 'German', direction: 'ltr', translationCompletenessPercent: 55, missingKeys: 68, reviewedPercent: 55, translators: ['Community contributor D'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'en', pluralRulesMissing: 0, status: 'in_progress', lastUpdatedAt: stampAt(30), qualityNote: 'Narrow-layout testing with compound words still in progress.' },
    { locale: 'fa-AF', languageName: 'دری', englishName: 'Dari', direction: 'rtl', translationCompletenessPercent: 34, missingKeys: 99, reviewedPercent: 20, translators: ['Community contributor E'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'fa', pluralRulesMissing: 0, status: 'community', lastUpdatedAt: stampAt(45), qualityNote: 'Community-contributed. Solar Hijri date presentation requested.' },
    { locale: 'ps', languageName: 'پښتو', englishName: 'Pashto', direction: 'rtl', translationCompletenessPercent: 30, missingKeys: 105, reviewedPercent: 15, translators: ['Community contributor E'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'fa-AF', pluralRulesMissing: 0, status: 'community', lastUpdatedAt: stampAt(52), qualityNote: 'Community-contributed.' },
    { locale: 'zh-Hans', languageName: '简体中文', englishName: 'Chinese (Simplified)', direction: 'ltr', translationCompletenessPercent: 50, missingKeys: 75, reviewedPercent: 50, translators: ['Community contributor F'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'zh', pluralRulesMissing: 0, status: 'in_progress', lastUpdatedAt: stampAt(34), qualityNote: 'No plural forms required.' },
    { locale: 'ja', languageName: '日本語', englishName: 'Japanese', direction: 'ltr', translationCompletenessPercent: 38, missingKeys: 93, reviewedPercent: 0, translators: [], isEnabledForWebsite: false, isEnabledForCrm: true, fallbackLocale: 'en', pluralRulesMissing: 0, status: 'machine_draft', lastUpdatedAt: stampAt(60), qualityNote: 'Machine-assisted draft. Requires native review before website enablement.' },
    { locale: 'hi', languageName: 'हिन्दी', englishName: 'Hindi', direction: 'ltr', translationCompletenessPercent: 42, missingKeys: 87, reviewedPercent: 42, translators: ['Community contributor G'], isEnabledForWebsite: true, isEnabledForCrm: true, fallbackLocale: 'en', pluralRulesMissing: 0, status: 'in_progress', lastUpdatedAt: stampAt(28), qualityNote: 'Indian digit grouping available as a preference.' },
  ];

  const statusComponents: Array<[string, import('@crm/shared-types').SystemStatusComponent['group']]> = [
    ['Web application', 'application'], ['Public website', 'application'], ['REST API', 'api'], ['Webhook delivery', 'api'], ['Background jobs', 'infrastructure'], ['Email delivery', 'integrations'], ['Search index', 'infrastructure'], ['Developer platform', 'developer_platform'],
  ];
  const status: import('@crm/shared-types').SystemStatusComponent[] = statusComponents.map(([name, group], index) => ({
    id: `status-${index + 1}`,
    name,
    group,
    status: index === 3 ? 'degraded' : index === 7 ? 'maintenance' : 'operational',
    state: 'synthetic',
    uptimePercent30d: index === 3 ? Number(random.float(98.4, 99.6, 2).toFixed(2)) : Number(random.float(99.4, 99.99, 2).toFixed(2)),
    // The claim is explicit: no uptime guarantee is made.
    uptimeClaim: 'not_claimed',
    latencyP95Ms: random.int(80, 620),
    region: random.pick(['us-east', 'eu-central', 'me-central']),
    incidents: index === 3
      ? [{ id: 'inc-1', title: 'Elevated webhook delivery latency', severity: 'minor', startedAt: stampAt(2), summary: 'Deliveries are being retried with backoff. No data loss is expected.', updates: [{ at: stampAt(1), message: 'Mitigation applied. Monitoring for 24 hours.', state: 'monitoring' }] }]
      : [],
    scheduledMaintenance: index === 7 ? [{ id: 'maint-1', title: 'Developer platform maintenance', startsAt: toDateTimeString(addDays(DATASET_EPOCH, 12)), endsAt: toDateTimeString(addDays(DATASET_EPOCH, 12.1)), impact: 'Request logs may be delayed. The API remains available.', regions: ['us-east'] }] : [],
  }));

  const banners: import('@crm/shared-types').MaintenanceBanner[] = [
    { id: 'banner-1', message: 'Scheduled maintenance on 25 October, 02:00–04:00 UTC. The application will remain available; scheduled reports may be delayed.', severity: 'info', startsAt: toDateTimeString(addDays(DATASET_EPOCH, 12)), endsAt: toDateTimeString(addDays(DATASET_EPOCH, 12.2)), surfaces: ['crm', 'platform_admin'], locales: [{ locale: 'en', message: 'Scheduled maintenance on 25 October, 02:00–04:00 UTC.' }], dismissible: true, isActive: true, createdByName: 'Rafael Duarte' },
  ];

  return { plans, addOns, users: platformUsers, roles: platformRoles, audit, supportTickets, flags, moduleCatalog, localization: localeRows, status, banners };
}

export { toDateString };
