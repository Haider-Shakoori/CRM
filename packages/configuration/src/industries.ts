/**
 * Industry catalogue and template gallery metadata.
 *
 * The product must not hardcode one industry's workflow. Every industry is a
 * *configuration profile*: terminology substitutions, extra fields, a sample
 * pipeline and a few representative workflows. The types make clear that these are
 * configuration examples, not certified vertical solutions, and regulated
 * industries carry an explicit "no compliance claim" flag.
 */

import type { FieldType, Tone } from '@crm/shared-types';

export interface IndustryDefinition {
  id: string;
  label: string;
  /** Short label for filter chips and badges. */
  shortLabel: string;
  description: string;
  /** What the CRM calls the core record types in this industry. */
  terminology: Array<{ standard: string; industry: string }>;
  /** Salesforce-like record naming so reports read naturally. */
  primaryObjectLabel: string;
  tone: Tone;
  /** Example objects the template would add or extend. */
  extraObjects: Array<{ label: string; apiName: string; description: string; fields: Array<{ label: string; type: FieldType; note?: string }> }>;
  /** Typical process stages. Probabilities are illustrative. */
  pipeline: { name: string; stages: Array<{ name: string; probability: number; tone: Tone }> };
  /** Representative automations, described honestly as configuration examples. */
  sampleWorkflows: Array<{ name: string; trigger: string; action: string }>;
  dashboardWidgets: string[];
  commonIntegrations: string[];
  /** Regulated industries require a visible disclaimer wherever the template appears. */
  regulatoryDisclaimerRequired: boolean;
  complianceNote?: string;
  /** Where the template is offered. */
  surfaces: Array<'website' | 'crm'>;
  featured: boolean;
}

export const industries: IndustryDefinition[] = [
  {
    id: 'technology_saas',
    label: 'Technology & SaaS',
    shortLabel: 'Technology',
    description: 'Subscription software sales with expansion revenue, trials and product-led signals feeding the pipeline.',
    terminology: [
      { standard: 'Account', industry: 'Company' },
      { standard: 'Opportunity', industry: 'Deal' },
      { standard: 'Product', industry: 'Plan' },
      { standard: 'Ticket', industry: 'Support request' },
    ],
    primaryObjectLabel: 'Company',
    tone: 'violet',
    extraObjects: [
      {
        label: 'Subscription',
        apiName: 'subscription',
        description: 'Recurring revenue associated with an account.',
        fields: [
          { label: 'Plan name', type: 'text' },
          { label: 'Seats', type: 'number' },
          { label: 'MRR', type: 'currency' },
          { label: 'Billing frequency', type: 'picklist' },
          { label: 'Renewal date', type: 'date' },
          { label: 'Auto-renew', type: 'boolean' },
        ],
      },
      {
        label: 'Product usage signal',
        apiName: 'usage_signal',
        description: 'Adoption metrics that indicate expansion or churn risk.',
        fields: [
          { label: 'Feature', type: 'picklist' },
          { label: 'Weekly active users', type: 'number' },
          { label: 'Adoption trend', type: 'picklist' },
          { label: 'Detected on', type: 'date' },
        ],
      },
    ],
    pipeline: {
      name: 'SaaS new business',
      stages: [
        { name: 'Trial / free', probability: 10, tone: 'slate' },
        { name: 'Discovery', probability: 25, tone: 'blue' },
        { name: 'Technical validation', probability: 45, tone: 'teal' },
        { name: 'Business case', probability: 65, tone: 'violet' },
        { name: 'Negotiation', probability: 80, tone: 'amber' },
        { name: 'Closed won', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Trial started', trigger: 'Product event received', action: 'Create a lead, assign the regional rep and create a day-2 follow-up task.' },
      { name: 'Usage drop detected', trigger: 'Usage signal updated below threshold', action: 'Raise a churn-risk signal and notify the customer success manager.' },
      { name: 'Deal won', trigger: 'Deal stage becomes Closed won', action: 'Create the onboarding project and schedule a kickoff task.' },
    ],
    dashboardWidgets: ['MRR and ARR', 'Net revenue retention', 'Trial conversion rate', 'Expansion pipeline', 'Feature adoption', 'Churn risk list'],
    commonIntegrations: ['google_workspace', 'microsoft_365', 'slack', 'stripe', 'zapier'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'professional_services',
    label: 'Professional Services',
    shortLabel: 'Services',
    description: 'Proposal-led selling where utilisation, statements of work and delivery handover matter as much as the close.',
    terminology: [
      { standard: 'Opportunity', industry: 'Engagement' },
      { standard: 'Product', industry: 'Service line' },
      { standard: 'Project', industry: 'Engagement delivery' },
    ],
    primaryObjectLabel: 'Client',
    tone: 'teal',
    extraObjects: [
      {
        label: 'Statement of work',
        apiName: 'sow',
        description: 'Scoped engagement defining deliverables and commercials.',
        fields: [
          { label: 'Scope summary', type: 'textarea' },
          { label: 'Fixed fee', type: 'currency' },
          { label: 'Estimated hours', type: 'number' },
          { label: 'Start date', type: 'date' },
          { label: 'Signed', type: 'boolean' },
        ],
      },
    ],
    pipeline: {
      name: 'Consulting engagement',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Scoping call', probability: 30, tone: 'blue' },
        { name: 'Proposal sent', probability: 50, tone: 'teal' },
        { name: 'Commercial review', probability: 70, tone: 'violet' },
        { name: 'Verbal agreement', probability: 85, tone: 'amber' },
        { name: 'Won', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Engagement won', trigger: 'Deal stage becomes Won', action: 'Create the delivery project and request an SOW document.' },
      { name: 'Proposal idle for 10 days', trigger: 'No activity in 10 days', action: 'Create a follow-up task for the account manager.' },
    ],
    dashboardWidgets: ['Proposal win rate', 'Average engagement value', 'Utilisation', 'Delivery on-time rate', 'Revenue by service line'],
    commonIntegrations: ['google_workspace', 'microsoft_365', 'quickbooks', 'xero', 'dropbox'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    shortLabel: 'Real estate',
    description: 'Fast lead capture, viewing scheduling and a listing pipeline shared between agents and branches.',
    terminology: [
      { standard: 'Lead', industry: 'Enquiry' },
      { standard: 'Opportunity', industry: 'Deal' },
      { standard: 'Product', industry: 'Listing' },
      { standard: 'Activity', industry: 'Viewing' },
    ],
    primaryObjectLabel: 'Vendor / Buyer',
    tone: 'amber',
    extraObjects: [
      {
        label: 'Listing',
        apiName: 'listing',
        description: 'A property available for sale or rent.',
        fields: [
          { label: 'Reference', type: 'auto_number' },
          { label: 'Property type', type: 'picklist' },
          { label: 'Bedrooms', type: 'number' },
          { label: 'Asking price', type: 'currency' },
          { label: 'Listing status', type: 'picklist' },
          { label: 'Available from', type: 'date' },
        ],
      },
      {
        label: 'Viewing',
        apiName: 'viewing',
        description: 'A scheduled or completed property visit.',
        fields: [
          { label: 'Listing', type: 'lookup' },
          { label: 'Attendee', type: 'lookup' },
          { label: 'Scheduled at', type: 'datetime' },
          { label: 'Outcome', type: 'picklist' },
          { label: 'Feedback', type: 'textarea' },
        ],
      },
    ],
    pipeline: {
      name: 'Transaction',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Viewing booked', probability: 30, tone: 'blue' },
        { name: 'Offer made', probability: 55, tone: 'amber' },
        { name: 'Offer accepted', probability: 75, tone: 'violet' },
        { name: 'Legal / conveyancing', probability: 90, tone: 'teal' },
        { name: 'Completed', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'New enquiry received', trigger: 'Lead created', action: 'Assign to the branch agent with the fewest open enquiries and schedule a call within two hours.' },
      { name: 'Viewing completed', trigger: 'Viewing outcome updated', action: 'Create a follow-up task and request written feedback.' },
    ],
    dashboardWidgets: ['Enquiries by source', 'Viewings booked', 'Listings by status', 'Offer conversion rate', 'Branch leaderboard'],
    commonIntegrations: ['google_calendar', 'gmail', 'whatsapp_business', 'meta_ads'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'financial_services',
    label: 'Financial Services',
    shortLabel: 'Financial',
    description: 'Advice-led selling with suitability records, relationship hierarchies and long approval cycles.',
    terminology: [
      { standard: 'Account', industry: 'Household' },
      { standard: 'Contact', industry: 'Client' },
      { standard: 'Opportunity', industry: 'Advice case' },
    ],
    primaryObjectLabel: 'Household',
    tone: 'blue',
    extraObjects: [
      {
        label: 'Advice case',
        apiName: 'advice_case',
        description: 'A recorded advice journey for a client household.',
        fields: [
          { label: 'Case type', type: 'picklist' },
          { label: 'Risk profile', type: 'picklist' },
          { label: 'Assets under advice', type: 'currency' },
          { label: 'Next review date', type: 'date' },
          { label: 'Suitability recorded', type: 'boolean' },
        ],
      },
    ],
    pipeline: {
      name: 'Advice case',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Fact find', probability: 30, tone: 'blue' },
        { name: 'Recommendation prepared', probability: 55, tone: 'teal' },
        { name: 'Client meeting', probability: 75, tone: 'violet' },
        { name: 'Compliance review', probability: 88, tone: 'amber' },
        { name: 'Implemented', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Annual review due', trigger: 'Relative date reached', action: 'Create a review task and add a reminder to the adviser calendar.' },
      { name: 'High-value case opened', trigger: 'Advice case assets above threshold', action: 'Notify the practice manager for oversight.' },
    ],
    dashboardWidgets: ['Assets under advice', 'New cases', 'Review compliance', 'Adviser productivity', 'Advice case cycle time'],
    commonIntegrations: ['microsoft_365', 'docuSign_placeholder', 'salesforce_data_placeholder'],
    regulatoryDisclaimerRequired: true,
    complianceNote:
      'Financial services are regulated. This template demonstrates configurable record-keeping and workflow patterns only. It makes no claim of regulatory compliance, suitability, record-retention or reporting approval in any jurisdiction.',
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'insurance',
    label: 'Insurance',
    shortLabel: 'Insurance',
    description: 'Broker and agency workflows: policy pipelines, renewal dates and claim-related communication.',
    terminology: [
      { standard: 'Account', industry: 'Policy holder' },
      { standard: 'Opportunity', industry: 'Quote' },
      { standard: 'Product', industry: 'Policy' },
    ],
    primaryObjectLabel: 'Policy holder',
    tone: 'violet',
    extraObjects: [
      {
        label: 'Policy',
        apiName: 'policy',
        description: 'An active or quoted insurance policy.',
        fields: [
          { label: 'Policy number', type: 'text' },
          { label: 'Line of business', type: 'picklist' },
          { label: 'Premium', type: 'currency' },
          { label: 'Effective date', type: 'date' },
          { label: 'Renewal date', type: 'date' },
          { label: 'Status', type: 'picklist' },
        ],
      },
    ],
    pipeline: {
      name: 'Policy quote',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Risk information gathered', probability: 35, tone: 'blue' },
        { name: 'Quoted', probability: 55, tone: 'teal' },
        { name: 'Underwriting', probability: 75, tone: 'amber' },
        { name: 'Bound', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Renewal approaching', trigger: 'Relative date reached before renewal', action: 'Create a renewal task 60 days ahead and start a renewal sequence.' },
      { name: 'Quote issued', trigger: 'Opportunity stage becomes Quoted', action: 'Simulate a document send and schedule a follow-up call.' },
    ],
    dashboardWidgets: ['Premium written', 'Renewal retention', 'Quotes outstanding', 'Loss ratio presentation', 'Broker performance'],
    commonIntegrations: ['microsoft_365', 'twilio_placeholder', 'xero', 'quickbooks'],
    regulatoryDisclaimerRequired: true,
    complianceNote:
      'Insurance is regulated. This template illustrates configurable data capture and workflow patterns and makes no claim of regulatory or licensing compliance.',
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    shortLabel: 'Healthcare',
    description: 'Patient enquiry and referral follow-up, appointment coordination and clinic relationship management for non-clinical teams.',
    terminology: [
      { standard: 'Contact', industry: 'Patient' },
      { standard: 'Opportunity', industry: 'Treatment enquiry' },
      { standard: 'Activity', industry: 'Appointment' },
    ],
    primaryObjectLabel: 'Patient',
    tone: 'green',
    extraObjects: [
      {
        label: 'Referral',
        apiName: 'referral_source',
        description: 'Inbound referral from a clinic, physician or partner.',
        fields: [
          { label: 'Referral source', type: 'lookup' },
          { label: 'Referral date', type: 'date' },
          { label: 'Reason for referral', type: 'textarea' },
          { label: 'Status', type: 'picklist' },
        ],
      },
    ],
    pipeline: {
      name: 'Patient enquiry',
      stages: [
        { name: 'Enquiry received', probability: 15, tone: 'slate' },
        { name: 'Contacted', probability: 35, tone: 'blue' },
        { name: 'Consultation booked', probability: 60, tone: 'teal' },
        { name: 'Consultation attended', probability: 80, tone: 'violet' },
        { name: 'Treatment plan accepted', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Enquiry not contacted in 4 hours', trigger: 'No activity within 4 hours of creation', action: 'Escalate to the clinic coordinator.' },
      { name: 'Consultation attended', trigger: 'Appointment marked complete', action: 'Create a follow-up task and prepare a treatment plan checklist.' },
    ],
    dashboardWidgets: ['Enquiries by referral source', 'Consultation conversion', 'Time to first contact', 'Clinic performance'],
    commonIntegrations: ['microsoft_365', 'google_calendar', 'twilio_placeholder'],
    regulatoryDisclaimerRequired: true,
    complianceNote:
      'Healthcare data is subject to strict regulation. This template demonstrates non-clinical enquiry and coordination workflows only. It is not a clinical record system and makes no claim of health-data compliance.',
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'education',
    label: 'Education & Admissions',
    shortLabel: 'Education',
    description: 'Admissions funnels, applicant nurturing and programme enquiry management across intakes.',
    terminology: [
      { standard: 'Lead', industry: 'Prospective student' },
      { standard: 'Opportunity', industry: 'Application' },
      { standard: 'Product', industry: 'Programme' },
      { standard: 'Campaign', industry: 'Intake' },
    ],
    primaryObjectLabel: 'Applicant',
    tone: 'blue',
    extraObjects: [
      {
        label: 'Application',
        apiName: 'application',
        description: 'A submitted programme application.',
        fields: [
          { label: 'Programme', type: 'lookup' },
          { label: 'Intake', type: 'picklist' },
          { label: 'Application status', type: 'picklist' },
          { label: 'Documents received', type: 'boolean' },
          { label: 'Decision date', type: 'date' },
        ],
      },
    ],
    pipeline: {
      name: 'Admissions',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Nurturing', probability: 25, tone: 'blue' },
        { name: 'Application started', probability: 45, tone: 'teal' },
        { name: 'Application submitted', probability: 65, tone: 'violet' },
        { name: 'Offer made', probability: 85, tone: 'amber' },
        { name: 'Enrolled', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Application idle', trigger: 'No activity in 7 days on an open application', action: 'Enrol the applicant in a nurture journey and create a counsellor task.' },
      { name: 'Offer accepted', trigger: 'Application status becomes Enrolled', action: 'Create an onboarding plan and issue the welcome checklist.' },
    ],
    dashboardWidgets: ['Enquiries by channel', 'Application conversion by programme', 'Intake progress', 'Counsellor performance', 'Cost per enrolment'],
    commonIntegrations: ['google_workspace', 'zoom', 'mailchimp_placeholder', 'whatsapp_business'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing & Industrial',
    shortLabel: 'Manufacturing',
    description: 'Long, distributor-influenced B2B cycles with quotes, specifications, samples and delivery commitments.',
    terminology: [
      { standard: 'Account', industry: 'Customer or distributor' },
      { standard: 'Opportunity', industry: 'RFQ' },
      { standard: 'Product', industry: 'Part / SKU' },
      { standard: 'Activity', industry: 'Site visit' },
    ],
    primaryObjectLabel: 'Customer',
    tone: 'slate',
    extraObjects: [
      {
        label: 'Request for quote',
        apiName: 'rfq',
        description: 'A customer request requiring pricing and lead-time response.',
        fields: [
          { label: 'Part number', type: 'text' },
          { label: 'Annual volume', type: 'number' },
          { label: 'Required lead time', type: 'number' },
          { label: 'Response due', type: 'date' },
          { label: 'Prototype requested', type: 'boolean' },
        ],
      },
    ],
    pipeline: {
      name: 'Industrial RFQ',
      stages: [
        { name: 'Enquiry received', probability: 10, tone: 'slate' },
        { name: 'Technical review', probability: 25, tone: 'blue' },
        { name: 'Quotation issued', probability: 45, tone: 'teal' },
        { name: 'Sample / trial', probability: 65, tone: 'amber' },
        { name: 'Commercial negotiation', probability: 85, tone: 'violet' },
        { name: 'Purchase order received', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'RFQ response due', trigger: 'Relative date reached on RFQ', action: 'Escalate to the sales engineer if no quotation has been issued.' },
      { name: 'Sample dispatched', trigger: 'Field update', action: 'Create a feedback task for 14 days later.' },
    ],
    dashboardWidgets: ['Quoted vs ordered value', 'Quote response time', 'Revenue by part family', 'Distributor performance', 'Order backlog'],
    commonIntegrations: ['sap_placeholder', 'microsoft_365', 'quickbooks', 'xero'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'wholesale_distribution',
    label: 'Wholesale & Distribution',
    shortLabel: 'Wholesale',
    description: 'Volume pricing, repeat ordering, territory coverage and account-level margin management.',
    terminology: [
      { standard: 'Account', industry: 'Trade account' },
      { standard: 'Opportunity', industry: 'Order opportunity' },
      { standard: 'Activity', industry: 'Visit' },
    ],
    primaryObjectLabel: 'Trade account',
    tone: 'teal',
    extraObjects: [
      {
        label: 'Trade agreement',
        apiName: 'trade_agreement',
        description: 'Negotiated terms for a trade account.',
        fields: [
          { label: 'Discount tier', type: 'picklist' },
          { label: 'Payment terms', type: 'picklist' },
          { label: 'Minimum order value', type: 'currency' },
          { label: 'Agreement expiry', type: 'date' },
        ],
      },
    ],
    pipeline: {
      name: 'Trade opportunity',
      stages: [
        { name: 'Identified', probability: 15, tone: 'slate' },
        { name: 'Terms discussed', probability: 35, tone: 'blue' },
        { name: 'Quotation issued', probability: 60, tone: 'teal' },
        { name: 'Trial order placed', probability: 80, tone: 'amber' },
        { name: 'Agreement signed', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Trade account dormant', trigger: 'No order in 60 days', action: 'Create a visit task for the territory representative.' },
      { name: 'Margin threshold breached', trigger: 'Order margin below threshold', action: 'Request pricing approval before confirming.' },
    ],
    dashboardWidgets: ['Revenue by territory', 'Margin by account', 'Order frequency', 'Coverage gaps', 'Top SKUs'],
    commonIntegrations: ['sap_placeholder', 'shopify', 'woocommerce', 'quickbooks'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'retail_ecommerce',
    label: 'Retail & E-commerce',
    shortLabel: 'Retail',
    description: 'Combining online order behaviour with service cases so support and marketing see the same customer.',
    terminology: [
      { standard: 'Contact', industry: 'Shopper' },
      { standard: 'Account', industry: 'Customer profile' },
      { standard: 'Product', industry: 'SKU' },
      { standard: 'Ticket', industry: 'Service case' },
    ],
    primaryObjectLabel: 'Customer',
    tone: 'amber',
    extraObjects: [
      {
        label: 'Order',
        apiName: 'retail_order',
        description: 'An online or in-store order.',
        fields: [
          { label: 'Order reference', type: 'text' },
          { label: 'Channel', type: 'picklist' },
          { label: 'Item count', type: 'number' },
          { label: 'Order value', type: 'currency' },
          { label: 'Fulfilment status', type: 'picklist' },
        ],
      },
    ],
    pipeline: {
      name: 'Customer journey',
      stages: [
        { name: 'First visit', probability: 5, tone: 'slate' },
        { name: 'Browsed', probability: 15, tone: 'blue' },
        { name: 'Added to basket', probability: 35, tone: 'teal' },
        { name: 'First order', probability: 60, tone: 'amber' },
        { name: 'Repeat customer', probability: 85, tone: 'violet' },
        { name: 'Advocate', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Abandoned basket', trigger: 'Basket event received', action: 'Enrol in a two-step recovery journey with a consent check.' },
      { name: 'Service case raised', trigger: 'Ticket created', action: 'Attach the recent order history and notify the fulfilment team.' },
    ],
    dashboardWidgets: ['Customer lifetime value', 'Repeat purchase rate', 'Service cases by reason', 'Campaign ROI', 'Cohort retention'],
    commonIntegrations: ['shopify', 'woocommerce', 'stripe', 'meta_ads', 'google_analytics_placeholder'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'automotive',
    label: 'Automotive',
    shortLabel: 'Automotive',
    description: 'Vehicle enquiry management, test drives, trade-ins and workshop relationships.',
    terminology: [
      { standard: 'Lead', industry: 'Enquiry' },
      { standard: 'Product', industry: 'Vehicle' },
      { standard: 'Activity', industry: 'Test drive' },
    ],
    primaryObjectLabel: 'Customer',
    tone: 'blue',
    extraObjects: [
      {
        label: 'Vehicle',
        apiName: 'vehicle',
        description: 'A vehicle in stock or on order.',
        fields: [
          { label: 'Stock reference', type: 'text' },
          { label: 'Make', type: 'picklist' },
          { label: 'Model', type: 'text' },
          { label: 'Condition', type: 'picklist' },
          { label: 'List price', type: 'currency' },
          { label: 'Available from', type: 'date' },
        ],
      },
      {
        label: 'Test drive',
        apiName: 'test_drive',
        description: 'A scheduled vehicle demonstration.',
        fields: [
          { label: 'Vehicle', type: 'lookup' },
          { label: 'Customer', type: 'lookup' },
          { label: 'Scheduled at', type: 'datetime' },
          { label: 'Licence verified', type: 'boolean' },
          { label: 'Outcome', type: 'picklist' },
        ],
      },
    ],
    pipeline: {
      name: 'Vehicle sale',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Contacted', probability: 25, tone: 'blue' },
        { name: 'Test drive booked', probability: 45, tone: 'teal' },
        { name: 'Test drive completed', probability: 65, tone: 'violet' },
        { name: 'Finance arranged', probability: 82, tone: 'amber' },
        { name: 'Delivered', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Test drive reminder', trigger: 'Relative date before appointment', action: 'Create a reminder task and simulate a confirmation message.' },
      { name: 'Enquiry not contacted', trigger: 'No activity within one hour during opening hours', action: 'Escalate to the sales manager.' },
    ],
    dashboardWidgets: ['Enquiries by model', 'Test drive conversion', 'Stock ageing', 'Finance penetration', 'Salesperson performance'],
    commonIntegrations: ['google_calendar', 'whatsapp_business', 'twilio_placeholder', 'meta_ads'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'logistics',
    label: 'Logistics & Freight',
    shortLabel: 'Logistics',
    description: 'Contract freight sales, rate cards and account-level service performance.',
    terminology: [
      { standard: 'Account', industry: 'Shipper' },
      { standard: 'Opportunity', industry: 'Lane / contract' },
      { standard: 'Ticket', industry: 'Shipment issue' },
    ],
    primaryObjectLabel: 'Shipper',
    tone: 'slate',
    extraObjects: [
      {
        label: 'Rate card',
        apiName: 'rate_card',
        description: 'Agreed lane pricing for a shipper.',
        fields: [
          { label: 'Origin', type: 'text' },
          { label: 'Destination', type: 'text' },
          { label: 'Equipment type', type: 'picklist' },
          { label: 'Rate', type: 'currency' },
          { label: 'Valid until', type: 'date' },
        ],
      },
    ],
    pipeline: {
      name: 'Freight contract',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Rate requested', probability: 30, tone: 'blue' },
        { name: 'Rate submitted', probability: 50, tone: 'teal' },
        { name: 'Trial lane agreed', probability: 70, tone: 'amber' },
        { name: 'Contract negotiation', probability: 85, tone: 'violet' },
        { name: 'Contract signed', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Rate card expiring', trigger: 'Relative date before expiry', action: 'Create a renewal task for the account manager.' },
      { name: 'Shipment issue logged', trigger: 'Ticket created with a service category', action: 'Notify the account manager and attach the service performance summary.' },
    ],
    dashboardWidgets: ['Revenue per lane', 'Contract win rate', 'Service performance', 'Volume by shipper', 'Rate card coverage'],
    commonIntegrations: ['sap_placeholder', 'microsoft_365', 'quickbooks'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'construction',
    label: 'Construction & Trades',
    shortLabel: 'Construction',
    description: 'Project bids, subcontractor coordination and long-cycle negotiation with progress-based billing.',
    terminology: [
      { standard: 'Opportunity', industry: 'Bid' },
      { standard: 'Project', industry: 'Site job' },
      { standard: 'Product', industry: 'Package' },
    ],
    primaryObjectLabel: 'Client',
    tone: 'amber',
    extraObjects: [
      {
        label: 'Site job',
        apiName: 'site_job',
        description: 'An active construction or installation job.',
        fields: [
          { label: 'Site address', type: 'address' },
          { label: 'Contract value', type: 'currency' },
          { label: 'Progress percent', type: 'percent' },
          { label: 'Retention percent', type: 'percent' },
          { label: 'Practical completion', type: 'date' },
        ],
      },
    ],
    pipeline: {
      name: 'Bid pipeline',
      stages: [
        { name: 'Invitation to bid', probability: 10, tone: 'slate' },
        { name: 'Site survey', probability: 30, tone: 'blue' },
        { name: 'Estimate prepared', probability: 50, tone: 'teal' },
        { name: 'Bid submitted', probability: 65, tone: 'violet' },
        { name: 'Negotiation', probability: 80, tone: 'amber' },
        { name: 'Contract awarded', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Bid submitted', trigger: 'Deal stage becomes Bid submitted', action: 'Create a 7-day follow-up task and attach the estimate document.' },
      { name: 'Job completion milestone', trigger: 'Milestone marked complete', action: 'Create a progress invoice reference and notify finance.' },
    ],
    dashboardWidgets: ['Bid win rate by client', 'Pipeline value', 'Site job progress', 'Retention outstanding', 'Estimator performance'],
    commonIntegrations: ['quickbooks', 'xero', 'dropbox', 'microsoft_365'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'hospitality',
    label: 'Hospitality',
    shortLabel: 'Hospitality',
    description: 'Group bookings, event enquiries and guest relationship management across venues.',
    terminology: [
      { standard: 'Lead', industry: 'Enquiry' },
      { standard: 'Opportunity', industry: 'Booking' },
      { standard: 'Activity', industry: 'Site visit' },
    ],
    primaryObjectLabel: 'Guest account',
    tone: 'rose' as Tone,
    extraObjects: [
      {
        label: 'Event booking',
        apiName: 'event_booking',
        description: 'A group or event booking.',
        fields: [
          { label: 'Venue', type: 'picklist' },
          { label: 'Event date', type: 'date' },
          { label: 'Guest count', type: 'number' },
          { label: 'Package value', type: 'currency' },
          { label: 'Deposit received', type: 'boolean' },
        ],
      },
    ],
    pipeline: {
      name: 'Event enquiry',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Availability check', probability: 30, tone: 'blue' },
        { name: 'Proposal sent', probability: 50, tone: 'teal' },
        { name: 'Site visit', probability: 70, tone: 'amber' },
        { name: 'Provisional hold', probability: 85, tone: 'violet' },
        { name: 'Contracted', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Proposal not answered', trigger: 'No activity in 5 days', action: 'Create a follow-up call task for the events coordinator.' },
      { name: 'Event confirmed', trigger: 'Booking stage becomes Contracted', action: 'Create a run-sheet task set and notify operations.' },
    ],
    dashboardWidgets: ['Event enquiries', 'Conversion rate', 'Revenue per venue', 'Average booking value', 'Repeat guest accounts'],
    commonIntegrations: ['google_calendar', 'stripe', 'whatsapp_business', 'meta_ads'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'travel',
    label: 'Travel Agencies',
    shortLabel: 'Travel',
    description: 'Itinerary-driven selling with supplier relationships, seasonal demand and repeat travellers.',
    terminology: [
      { standard: 'Opportunity', industry: 'Itinerary' },
      { standard: 'Product', industry: 'Package' },
      { standard: 'Contact', industry: 'Traveller' },
    ],
    primaryObjectLabel: 'Traveller',
    tone: 'teal',
    extraObjects: [
      {
        label: 'Itinerary',
        apiName: 'itinerary',
        description: 'A quoted or booked travel itinerary.',
        fields: [
          { label: 'Destination', type: 'text' },
          { label: 'Travel dates', type: 'date' },
          { label: 'Travellers', type: 'number' },
          { label: 'Itinerary value', type: 'currency' },
          { label: 'Supplier', type: 'lookup' },
        ],
      },
    ],
    pipeline: {
      name: 'Itinerary sale',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Requirements gathered', probability: 30, tone: 'blue' },
        { name: 'Itinerary proposed', probability: 50, tone: 'teal' },
        { name: 'Revisions requested', probability: 65, tone: 'amber' },
        { name: 'Deposit paid', probability: 90, tone: 'violet' },
        { name: 'Booked', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Itinerary proposed', trigger: 'Deal stage becomes Itinerary proposed', action: 'Simulate sending the itinerary and schedule a courtesy call.' },
      { name: 'Travellers returning', trigger: 'Relative date after travel end date', action: 'Create a post-travel review task and request feedback.' },
    ],
    dashboardWidgets: ['Itinerary conversion', 'Revenue by destination', 'Seasonal demand', 'Supplier performance', 'Repeat traveller rate'],
    commonIntegrations: ['google_workspace', 'stripe', 'whatsapp_business', 'zoom'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    shortLabel: 'Recruitment',
    description: 'Candidate and client sides running in parallel: vacancies, shortlists and placements.',
    terminology: [
      { standard: 'Contact', industry: 'Candidate' },
      { standard: 'Account', industry: 'Client company' },
      { standard: 'Opportunity', industry: 'Vacancy' },
      { standard: 'Activity', industry: 'Interview' },
    ],
    primaryObjectLabel: 'Candidate',
    tone: 'violet',
    extraObjects: [
      {
        label: 'Vacancy',
        apiName: 'vacancy',
        description: 'A role being recruited on behalf of a client.',
        fields: [
          { label: 'Client', type: 'lookup' },
          { label: 'Role title', type: 'text' },
          { label: 'Salary range', type: 'text' },
          { label: 'Placement fee percent', type: 'percent' },
          { label: 'Shortlist due', type: 'date' },
        ],
      },
      {
        label: 'Placement',
        apiName: 'placement',
        description: 'A confirmed candidate placement.',
        fields: [
          { label: 'Candidate', type: 'lookup' },
          { label: 'Vacancy', type: 'lookup' },
          { label: 'Start date', type: 'date' },
          { label: 'Fee value', type: 'currency' },
          { label: 'Guarantee expires', type: 'date' },
        ],
      },
    ],
    pipeline: {
      name: 'Recruitment',
      stages: [
        { name: 'Vacancy intake', probability: 15, tone: 'slate' },
        { name: 'Sourcing', probability: 30, tone: 'blue' },
        { name: 'Shortlist shared', probability: 50, tone: 'teal' },
        { name: 'Client interviews', probability: 70, tone: 'violet' },
        { name: 'Offer stage', probability: 87, tone: 'amber' },
        { name: 'Placed', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Shortlist overdue', trigger: 'Relative date reached on vacancy', action: 'Escalate to the delivery manager.' },
      { name: 'Guarantee period ending', trigger: 'Relative date before guarantee expiry', action: 'Create a courtesy check-in task.' },
    ],
    dashboardWidgets: ['Vacancies by stage', 'Placements this month', 'Fee revenue', 'Time to shortlist', 'Consultant performance'],
    commonIntegrations: ['linkedin_placeholder', 'microsoft_365', 'google_calendar', 'zoom'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'marketing_agency',
    label: 'Marketing Agencies',
    shortLabel: 'Agency',
    description: 'Retainer and project revenue, scope management and client reporting cycles.',
    terminology: [
      { standard: 'Account', industry: 'Client' },
      { standard: 'Opportunity', industry: 'Pitch' },
      { standard: 'Project', industry: 'Campaign delivery' },
    ],
    primaryObjectLabel: 'Client',
    tone: 'rose' as Tone,
    extraObjects: [
      {
        label: 'Retainer',
        apiName: 'retainer',
        description: 'A recurring service agreement with scope.',
        fields: [
          { label: 'Monthly fee', type: 'currency' },
          { label: 'Included hours', type: 'number' },
          { label: 'Hours used', type: 'number' },
          { label: 'Billing day', type: 'number' },
          { label: 'Next review', type: 'date' },
        ],
      },
    ],
    pipeline: {
      name: 'Agency pitch',
      stages: [
        { name: 'Inbound enquiry', probability: 10, tone: 'slate' },
        { name: 'Discovery call', probability: 25, tone: 'blue' },
        { name: 'Proposal drafted', probability: 45, tone: 'teal' },
        { name: 'Pitch presented', probability: 65, tone: 'violet' },
        { name: 'Scope negotiation', probability: 85, tone: 'amber' },
        { name: 'Retainer signed', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Retainer hours exceeded', trigger: 'Field update above included hours', action: 'Notify the account director and create a scope-change task.' },
      { name: 'Monthly report due', trigger: 'Scheduled date', action: 'Create a reporting task set for each active client.' },
    ],
    dashboardWidgets: ['Retainer revenue', 'Scope overrun hours', 'Pitch win rate', 'Client profitability', 'Delivery capacity'],
    commonIntegrations: ['slack', 'google_workspace', 'stripe', 'xero', 'zapier'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: true,
  },
  {
    id: 'telecommunications',
    label: 'Telecommunications',
    shortLabel: 'Telecom',
    description: 'High-volume B2B connectivity sales with service assurance and contract commitments.',
    terminology: [
      { standard: 'Account', industry: 'Subscriber' },
      { standard: 'Opportunity', industry: 'Connection order' },
      { standard: 'Ticket', industry: 'Fault' },
    ],
    primaryObjectLabel: 'Subscriber',
    tone: 'blue',
    extraObjects: [
      {
        label: 'Service line',
        apiName: 'service_line',
        description: 'An active connectivity or voice service.',
        fields: [
          { label: 'Service type', type: 'picklist' },
          { label: 'Circuit reference', type: 'text' },
          { label: 'Monthly charge', type: 'currency' },
          { label: 'Contracted until', type: 'date' },
          { label: 'Service status', type: 'picklist' },
        ],
      },
    ],
    pipeline: {
      name: 'Connectivity order',
      stages: [
        { name: 'Enquiry', probability: 10, tone: 'slate' },
        { name: 'Feasibility check', probability: 30, tone: 'blue' },
        { name: 'Quoted', probability: 50, tone: 'teal' },
        { name: 'Order placed', probability: 70, tone: 'violet' },
        { name: 'Provisioning', probability: 90, tone: 'amber' },
        { name: 'Activated', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Fault raised on contracted account', trigger: 'Ticket created with priority critical', action: 'Notify the account manager and raise an assurance task.' },
      { name: 'Contract ending', trigger: 'Relative date before contracted until', action: 'Create a renewal task and start a retention sequence.' },
    ],
    dashboardWidgets: ['MRR by service type', 'Churn risk', 'Fault rate per account', 'Provisioning cycle time', 'Contract renewals'],
    commonIntegrations: ['twilio_placeholder', 'microsoft_365', 'sap_placeholder', 'slack'],
    regulatoryDisclaimerRequired: false,
    surfaces: ['website', 'crm'],
    featured: false,
  },
  {
    id: 'nonprofit',
    label: 'Nonprofits',
    shortLabel: 'Nonprofit',
    description: 'Donor relationships, grants, programme delivery and volunteer engagement.',
    terminology: [
      { standard: 'Contact', industry: 'Donor' },
      { standard: 'Opportunity', industry: 'Grant or appeal' },
      { standard: 'Account', industry: 'Organization / foundation' },
    ],
    primaryObjectLabel: 'Supporter',
    tone: 'green',
    extraObjects: [
      {
        label: 'Donation',
        apiName: 'donation',
        description: 'A one-off or recurring gift.',
        fields: [
          { label: 'Amount', type: 'currency' },
          { label: 'Frequency', type: 'picklist' },
          { label: 'Appeal', type: 'lookup' },
          { label: 'Restricted to programme', type: 'lookup' },
          { label: 'Receipt issued', type: 'boolean' },
        ],
      },
      {
        label: 'Grant',
        apiName: 'grant',
        description: 'A funded programme agreement.',
        fields: [
          { label: 'Funder', type: 'lookup' },
          { label: 'Programme', type: 'picklist' },
          { label: 'Award amount', type: 'currency' },
          { label: 'Reporting due', type: 'date' },
          { label: 'Status', type: 'picklist' },
        ],
      },
    ],
    pipeline: {
      name: 'Fundraising',
      stages: [
        { name: 'Identified', probability: 10, tone: 'slate' },
        { name: 'Cultivation', probability: 25, tone: 'blue' },
        { name: 'Solicitation', probability: 45, tone: 'teal' },
        { name: 'Pledged', probability: 70, tone: 'amber' },
        { name: 'Agreement signed', probability: 88, tone: 'violet' },
        { name: 'Funds received', probability: 100, tone: 'green' },
      ],
    },
    sampleWorkflows: [
      { name: 'Grant reporting due', trigger: 'Relative date before reporting due', action: 'Create a reporting task and assign it to the programme lead.' },
      { name: 'Donor lapsed', trigger: 'No donation in 12 months', action: 'Enrol the supporter in a reactivation journey.' },
    ],
    dashboardWidgets: ['Donations by appeal', 'Recurring donor retention', 'Grant pipeline', 'Programme spend', 'Volunteer engagement'],
    commonIntegrations: ['stripe', 'paypal', 'mailchimp_placeholder', 'google_workspace'],
    regulatoryDisclaimerRequired: true,
    complianceNote:
      'Charitable fundraising and donation receipting are regulated and jurisdiction-specific. This template demonstrates relationship and programme management patterns only.',
    surfaces: ['website', 'crm'],
    featured: false,
  },
];

export const industryById = new Map(industries.map((i) => [i.id, i]));

export function getIndustry(id: string): IndustryDefinition | undefined {
  return industryById.get(id);
}

export const featuredIndustries = industries.filter((i) => i.featured);

/** Used by onboarding and the industry template gallery. */
export const companySizeOptions = [
  { value: 'solo', label: 'Just me' },
  { value: '2-10', label: '2–10 people' },
  { value: '11-50', label: '11–50 people' },
  { value: '51-200', label: '51–200 people' },
  { value: '201-1000', label: '201–1,000 people' },
  { value: '1001-5000', label: '1,001–5,000 people' },
  { value: '5000+', label: 'More than 5,000 people' },
] as const;

/** Primary CRM goals offered during onboarding; they select default modules. */
export const onboardingGoals = [
  { id: 'organise_pipeline', label: 'Organise our sales pipeline', description: 'See every deal, its stage and its owner in one place.', moduleKeys: ['deals', 'accounts', 'contacts', 'activities', 'analytics'] },
  { id: 'capture_leads', label: 'Capture and qualify leads faster', description: 'Never lose an inbound enquiry and respond first.', moduleKeys: ['leads', 'campaigns', 'inbox', 'activities'] },
  { id: 'track_customers', label: 'Keep a single record of every customer', description: 'One profile for contacts, accounts, deals and history.', moduleKeys: ['contacts', 'accounts', 'documents', 'inbox'] },
  { id: 'automate_followups', label: 'Automate follow-ups and reminders', description: 'Let the platform create the next task for the team.', moduleKeys: ['workflows', 'activities', 'campaigns'] },
  { id: 'support_customers', label: 'Support customers after the sale', description: 'Tickets, SLAs, a knowledge base and satisfaction tracking.', moduleKeys: ['tickets', 'knowledge_base', 'inbox', 'portal'] },
  { id: 'grow_revenue', label: 'Grow revenue from existing customers', description: 'Expansion, renewals and churn-risk management.', moduleKeys: ['customer_success', 'subscriptions', 'contracts', 'analytics'] },
  { id: 'forecast_accurately', label: 'Forecast accurately', description: 'Weighted pipeline, commit versus best case and coverage.', moduleKeys: ['deals', 'analytics', 'activities'] },
  { id: 'quote_faster', label: 'Quote and contract faster', description: 'Product catalog, quotes, approvals and orders.', moduleKeys: ['products', 'quotes', 'orders', 'contracts'] },
  { id: 'manage_projects', label: 'Manage delivery and projects', description: 'Hand a won deal straight into a delivery plan.', moduleKeys: ['projects', 'documents', 'orders'] },
  { id: 'run_field_team', label: 'Run a field sales team', description: 'Territories, visit plans and coverage reporting.', moduleKeys: ['field_sales', 'accounts', 'calendar', 'analytics'] },
  { id: 'report_leadership', label: 'Report to leadership confidently', description: 'Dashboards and reports that leadership actually trusts.', moduleKeys: ['analytics', 'deals', 'home'] },
  { id: 'customise_process', label: 'Adapt the CRM to our own process', description: 'Custom objects, fields, layouts and automation.', moduleKeys: ['customization', 'workflows', 'templates'] },
] as const;
