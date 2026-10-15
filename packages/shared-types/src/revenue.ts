/**
 * Products, price books, quotes, orders, contracts, subscription revenue and
 * commissions.
 *
 * Scope note: this is CRM catalog and revenue-presentation functionality, not an
 * ERP, ledger or billing engine. All monetary arithmetic is local demonstration
 * logic; tax and FX are never calculated as if authoritative.
 */

import type { Auditable, CurrencyCode, Id, ISODateString, ISODateTimeString, Money, Tag, Tone } from './common';

/* ---------------------------------------------------------------- catalogue */

export interface Product extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  sku: string;
  description?: string;
  categoryId?: Id;
  categoryLabel?: string;
  family?: string;
  type: 'goods' | 'service' | 'subscription' | 'bundle' | 'usage_based' | 'donation';
  status: 'active' | 'draft' | 'discontinued' | 'out_of_stock';
  unitOfMeasure: 'each' | 'seat' | 'license' | 'hour' | 'day' | 'month' | 'year' | 'gigabyte' | 'transaction';
  basePrice: Money;
  cost?: Money;
  /** Recurring products describe how revenue is recognised. */
  billingPeriod?: 'one_time' | 'monthly' | 'quarterly' | 'annual' | 'usage';
  /** Present when the product is a bundle. */
  bundleItems?: Array<{ productId: Id; productName: string; quantity: number; isOptional: boolean; priceAdjustment?: Money }>;
  variants?: ProductVariant[];
  taxClass?: string;
  /** No tax rates are computed; the UI shows configuration only. */
  taxCalculationState: 'not_configured';
  images: Array<{ id: Id; alt: string; tone: Tone; /** Generated placeholder, never a stock photo. */ generated: true }>;
  isActive: boolean;
  priceBookEntryCount: number;
  /** Aggregate deal association for the catalog list. */
  dealsWonCount: number;
  revenueWon?: Money;
  tags: Tag[];
  customFields: Record<string, unknown>;
}

export interface ProductVariant {
  id: Id;
  name: string;
  sku: string;
  attributes: Array<{ name: string; value: string }>;
  priceAdjustment: Money;
  isActive: boolean;
}

export interface ProductCategory {
  id: Id;
  organizationId: Id;
  name: string;
  parentId?: Id;
  description?: string;
  productCount: number;
  sortOrder: number;
  tone: Tone;
}

export interface PriceBook extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  currency: CurrencyCode;
  isStandard: boolean;
  isActive: boolean;
  /** Which customers this book applies to, as a configuration statement. */
  appliesTo: { kinds: Array<'all' | 'segment' | 'account' | 'region' | 'channel'>; segmentIds?: Id[]; accountIds?: Id[]; countryCodes?: string[] };
  validFrom?: ISODateString;
  validTo?: ISODateString;
  entries: PriceBookEntry[];
  entryCount: number;
}

export interface PriceBookEntry {
  id: Id;
  priceBookId: Id;
  productId: Id;
  productName: string;
  unitPrice: Money;
  /** Volume discounts are illustrative configuration, not commercial advice. */
  volumeTiers?: Array<{ minQuantity: number; discountPercent: number }>;
  isActive: boolean;
}

export interface DiscountRule {
  id: Id;
  organizationId: Id;
  name: string;
  type: 'percentage' | 'fixed_amount' | 'tiered';
  value: number;
  maxPercent?: number;
  appliesTo: 'product' | 'category' | 'order' | 'quote' | 'contract';
  targetIds?: Id[];
  /** Approval thresholds are described in the UI; nothing is enforced client-side. */
  requiresApprovalAbovePercent?: number;
  requiresApprovalAboveAmount?: Money;
  validFrom?: ISODateString;
  validTo?: ISODateString;
  isActive: boolean;
}

/* -------------------------------------------------------------------- quotes */

export type QuoteStatus = 'draft' | 'in_review' | 'pending_approval' | 'approved' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'revised' | 'cancelled';

export interface Quote extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  name: string;
  accountId: Id;
  accountName: string;
  contactId?: Id;
  contactName?: string;
  dealId?: Id;
  dealName?: string;
  opportunityStageLabel?: string;
  ownerId: Id;
  ownerName: string;
  status: QuoteStatus;
  version: number;
  /** Prior versions stay accessible so revision history is honest. */
  previousVersionIds: Id[];
  priceBookId?: Id;
  currency: CurrencyCode;
  exchangeRateUsed?: number;
  /** Dates */
  issueDate: ISODateString;
  validUntil: ISODateString;
  contractTermMonths: number;
  billingFrequency: 'one_time' | 'monthly' | 'quarterly' | 'annual';
  /** Line items */
  lineItems: QuoteLineItem[];
  /** Totals. Computed by the mock pricing engine and always derived, never stored ad hoc. */
  totals: QuoteTotals;
  /** Approval */
  approvalState: 'not_required' | 'pending' | 'approved' | 'rejected';
  approvalSteps: QuoteApprovalStep[];
  discountApprovalPercent?: number;
  /** Presentation */
  templateId?: Id;
  templateName?: string;
  termsAndConditions?: string;
  notes?: string;
  internalNotes?: string;
  /** E-signature is modelled as a workflow preview only. */
  signatureRequest?: {
    id: Id;
    status: 'not_started' | 'awaiting_customer' | 'signed' | 'declined' | 'expired';
    simulated: true;
    signerCount: number;
    signedCount: number;
    note: string;
  };
  /** Delivery is simulated and labelled. */
  deliveryState: 'draft' | 'not_sent' | 'simulated_sent' | 'simulated_viewed';
  sentAt?: ISODateTimeString;
  viewedAt?: ISODateTimeString;
  acceptedAt?: ISODateTimeString;
  declinedAt?: ISODateTimeString;
  declineReason?: string;
  /** Links */
  orderId?: Id;
  contractId?: Id;
  projectId?: Id;
  /** Set when produced by the quote-clone action. */
  clonedFromId?: Id;
  tags: Tag[];
}

export interface QuoteLineItem {
  id: Id;
  productId: Id;
  productName: string;
  sku: string;
  description?: string;
  quantity: number;
  unitPrice: Money;
  listPrice: Money;
  discountPercent: number;
  discountAmount: Money;
  unitOfMeasure: string;
  billing: 'one_time' | 'monthly' | 'quarterly' | 'annual' | 'usage';
  termMonths?: number;
  /** No tax is calculated; the percentage is displayed for completeness only. */
  taxPercent?: number;
  /** Derived fields populated by the pricing engine. */
  subtotal: Money;
  netTotal: Money;
  isOptional: boolean;
  isRecurring: boolean;
  sortOrder: number;
  bundleParentId?: Id;
  priceBookEntryId?: Id;
  /** Where the price came from, so a mismatch is explainable. */
  priceSource: 'price_book' | 'product_default' | 'manual_override' | 'promotion';
}

export interface QuoteTotals {
  currency: CurrencyCode;
  subtotal: Money;
  lineDiscountTotal: Money;
  orderDiscountPercent: number;
  orderDiscountAmount: Money;
  netSubtotal: Money;
  /** Tax is intentionally not computed; this stays zero and is labelled. */
  taxTotal: Money;
  taxNote: string;
  grandTotal: Money;
  recurring: { oneTime: Money; monthly: Money; quarterly: Money; annual: Money; annualisedTotal: Money };
  margin?: { costTotal: Money; marginAmount: Money; marginPercent: number };
}

export interface QuoteApprovalStep {
  id: Id;
  order: number;
  name: string;
  approverKind: 'user' | 'role' | 'manager';
  approverId?: Id;
  approverName: string;
  thresholdNote?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  decidedAt?: ISODateTimeString;
  comment?: string;
}

/* -------------------------------------------------------------------- orders */

export type OrderStatus = 'draft' | 'pending_signature' | 'activated' | 'fulfilled' | 'partially_fulfilled' | 'cancelled' | 'completed';

export interface Order extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  accountId: Id;
  accountName: string;
  contactId?: Id;
  quoteId?: Id;
  contractId?: Id;
  dealId?: Id;
  ownerId: Id;
  ownerName: string;
  status: OrderStatus;
  orderDate: ISODateString;
  effectiveDate: ISODateString;
  endDate?: ISODateString;
  currency: CurrencyCode;
  lineItems: QuoteLineItem[];
  totals: QuoteTotals;
  /** Billing and payment state is presentation only. */
  billingState: 'not_billed' | 'partially_billed' | 'billed' | 'credited';
  paymentState: 'not_due' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'refunded';
  invoicedAmount: Money;
  paidAmount: Money;
  billingFrequency: 'one_time' | 'monthly' | 'quarterly' | 'annual';
  poNumber?: string;
  /** Fulfilment is tracked as CRM activity, not as an ERP shipment record. */
  fulfilment?: { method: 'none' | 'provisioning' | 'shipment_placeholder' | 'service_delivery'; statusNote?: string };
  projectId?: Id;
  subscriptionId?: Id;
  activatedAt?: ISODateTimeString;
  cancelledAt?: ISODateTimeString;
  cancelReason?: string;
  tags: Tag[];
}

/* ----------------------------------------------------------------- contracts */

export type ContractStatus = 'draft' | 'in_review' | 'awaiting_signature' | 'active' | 'expiring_soon' | 'expired' | 'terminated' | 'renewed' | 'cancelled';

export interface Contract extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  title: string;
  accountId: Id;
  accountName: string;
  contactId?: Id;
  ownerId: Id;
  ownerName: string;
  status: ContractStatus;
  type: 'subscription' | 'service_agreement' | 'sla' | 'nda' | 'statement_of_work' | 'license' | 'maintenance' | 'other';
  currency: CurrencyCode;
  startDate: ISODateString;
  endDate: ISODateString;
  /** Notice period drives the renewal task generation. */
  noticePeriodDays: number;
  autoRenew: boolean;
  termMonths: number;
  contractValue: Money;
  /** Annualised value makes mixed-term contracts comparable. */
  annualisedValue: Money;
  billingFrequency: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  paymentTerms: 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'custom';
  quoteId?: Id;
  orderId?: Id;
  renewalId?: Id;
  previousContractId?: Id;
  /** Documents are placeholders; nothing is stored or signed. */
  documents: Array<{ id: Id; name: string; kind: 'main' | 'amendment' | 'order_form' | 'appendix' | 'dpa'; version: number; sizeBytes: number; placeholder: true }>;
  signatureState: 'not_started' | 'awaiting_customer' | 'awaiting_internal' | 'executed' | 'declined';
  /** Honest labelling: no real e-signature integration exists. */
  signatureSimulated: true;
  milestones?: Array<{ id: Id; label: string; date: ISODateString; amount?: Money; invoiced: boolean }>;
  renewalOwnerId?: Id;
  daysUntilExpiry: number;
  /** Recorded on early termination; absent while the contract runs its natural term. */
  terminatedAt?: ISODateTimeString;
  terminationReason?: string;
  tags: Tag[];
}

/* ------------------------------------------------------ subscription revenue */

export interface RevenueSubscription extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  accountId: Id;
  accountName: string;
  contractId?: Id;
  productId?: Id;
  productName?: string;
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired';
  planName: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: Money;
  billingFrequency: 'monthly' | 'quarterly' | 'annual';
  mrr: Money;
  arr: Money;
  currency: CurrencyCode;
  startDate: ISODateString;
  currentPeriodStart: ISODateString;
  currentPeriodEnd: ISODateString;
  cancelledAt?: ISODateTimeString;
  cancelReason?: string;
  renewalDate?: ISODateString;
  autoRenew: boolean;
  /** Movement classification for the revenue bridge report. */
  movement?: 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation' | 'flat';
  previousMrr?: Money;
  ownerId: Id;
  ownerName: string;
  tags: Tag[];
}

export interface RecurringRevenueReport {
  currency: CurrencyCode;
  periodLabel: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  metrics: {
    mrr: Money;
    arr: Money;
    newMrr: Money;
    expansionMrr: Money;
    contractionMrr: Money;
    churnedMrr: Money;
    reactivationMrr: Money;
    netNewMrr: Money;
    grossRevenueRetention: number;
    netRevenueRetention: number;
    logoRetention: number;
    averageRevenuePerAccount: Money;
    customerLifetimeValue: Money;
    averageLifetimeMonths: number;
    paybackMonths: number;
    churnRate: number;
  };
  trend: Array<{ date: ISODateString; mrr: number; newMrr: number; expansionMrr: number; churnedMrr: number; netNew: number }>;
  movementBridge: Array<{ label: string; value: number; kind: 'start' | 'positive' | 'negative' | 'end' }>;
  byPlan: Array<{ planName: string; accounts: number; mrr: number; sharePercent: number; churnRate: number }>;
  bySegment: Array<{ segment: string; accounts: number; mrr: number; nrr: number }>;
  byRegion: Array<{ region: string; accounts: number; mrr: number; growth: number }>;
  cohortRetention: Array<{ cohortLabel: string; startMrr: number; values: number[] }>;
  topAccountsByMrr: Array<{ accountId: Id; accountName: string; mrr: Money; arr: Money; health: string; renewalDate?: ISODateString }>;
  upcomingRenewals: Array<{ month: string; count: number; value: number; atRiskValue: number }>;
}

/* ---------------------------------------------------------------- invoices */

export interface InvoiceRecord extends Auditable {
  id: Id;
  organizationId: Id;
  reference: string;
  accountId: Id;
  accountName: string;
  contractId?: Id;
  orderId?: Id;
  subscriptionId?: Id;
  status: 'draft' | 'issued' | 'payment_pending' | 'payment_received' | 'overdue' | 'void' | 'refunded' | 'written_off';
  issueDate: ISODateString;
  dueDate: ISODateString;
  paidDate?: ISODateString;
  /** These are CRM-visible records, not accounting documents. */
  documentKind: 'crm_reference_only';
  currency: CurrencyCode;
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  total: Money;
  amountPaid: Money;
  balanceDue: Money;
  /** No tax engine exists; jurisdiction is recorded for presentation. */
  taxJurisdiction?: string;
  taxRateDisplay?: number;
  taxNote: string;
  paymentMethodLabel?: string;
  paymentReferenceMasked?: string;
  dunningStage: 'none' | 'reminder_1' | 'reminder_2' | 'final_notice' | 'collections_placeholder';
  notes?: string;
}

/* -------------------------------------------------------------- commissions */

export interface CommissionPlan extends Auditable {
  id: Id;
  organizationId: Id;
  name: string;
  description?: string;
  appliesToRoleIds: Id[];
  appliesToTeamIds: Id[];
  basis: 'revenue' | 'margin' | 'units' | 'new_logos' | 'renewals' | 'blended';
  currency: CurrencyCode;
  /** Tiers are illustrative configuration, not a commercial commitment. */
  tiers: Array<{
    id: Id;
    order: number;
    label: string;
    thresholdType: 'percent_of_quota' | 'absolute_amount' | 'deal_count';
    thresholdValue: number;
    ratePercent: number;
    accelerator: boolean;
  }>;
  drawAmount?: Money;
  clawbackWindowDays?: number;
  isActive: boolean;
}

export interface CommissionStatement {
  id: Id;
  organizationId: Id;
  planId: Id;
  planName: string;
  userId: Id;
  userName: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid' | 'disputed';
  quotaAttainmentPercent: number;
  bookingsTotal: Money;
  commissionEarned: Money;
  commissionAdjustments: Money;
  commissionPaid: Money;
  commissionPending: Money;
  currency: CurrencyCode;
  lines: Array<{
    id: Id;
    dealId?: Id;
    dealName?: string;
    accountName?: string;
    closedAt?: ISODateString;
    basisAmount: Money;
    ratePercent: number;
    amount: Money;
    kind: 'new_business' | 'expansion' | 'renewal' | 'clawback' | 'bonus' | 'adjustment';
    note?: string;
  }>;
  calculatedAt: ISODateTimeString;
  /** Explicitly a frontend demonstration calculation. */
  calculationState: 'demo_local_calculation';
}

export interface RevenueOperationsOverview {
  currency: CurrencyCode;
  periodLabel: string;
  pipeline: { totalValue: Money; weightedValue: Money; dealCount: number; averageDealSize: Money; averageCycleTimeDays: number; winRate: number };
  bookings: { wonValue: Money; wonCount: number; lostValue: Money; lostCount: number; targetValue: Money; attainmentPercent: number };
  recurring: { mrr: Money; arr: Money; netNewMrr: Money; nrr: number; grr: number; churnRate: number };
  quotes: { openCount: number; openValue: Money; acceptanceRate: number; averageDiscountPercent: number; pendingApprovalCount: number };
  orders: { count: number; value: Money; pendingActivation: number; billedValue: Money; outstandingValue: Money };
  contracts: { activeCount: number; totalValue: Money; expiringIn90Days: number; expiringValue: Money; autoRenewPercent: number };
  invoices: { outstandingValue: Money; overdueValue: Money; overdueCount: number; collectedThisPeriod: Money };
  trend: Array<{ date: ISODateString; bookings: number; billings: number; recurring: number }>;
  byChannel: Array<{ channel: string; wonValue: number; dealCount: number; winRate: number; averageCycleTime: number }>;
}
