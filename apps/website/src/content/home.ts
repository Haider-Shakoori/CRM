/**
 * Homepage content.
 *
 * Copy is separated from markup so it can be reviewed, localised and edited without
 * touching a component. Every number here is synthetic and is labelled as such where
 * it is displayed — the site never presents invented figures as real results.
 */

export const hero = {
  eyebrow: 'Multi-tenant CRM platform · Frontend demonstration build',
  title: 'The customer platform your whole company can actually use',
  body: 'Sales, marketing, service, revenue operations and customer success in one configurable platform — without the enterprise complexity that slows teams down.',
  primaryCta: { label: 'Start free trial', href: '/signup' },
  secondaryCta: { label: 'Explore the interactive demo', href: '/demo' },
  supporting: 'No credit card required · Set up an organization in a few minutes · Full interface, synthetic data',
  stats: [
    { value: '11', label: 'role-based dashboards' },
    { value: '28', label: 'configurable modules' },
    { value: '21', label: 'industry templates' },
    { value: '13', label: 'interface languages, 3 right-to-left' },
  ],
};

export const announcements = [
  {
    id: 'demo',
    label: 'New',
    title: 'Interactive product demo',
    body: 'Explore leads, pipeline, tickets and reporting in your browser — no account, and you can reset the data at any time.',
    href: '/demo',
  },
  {
    id: 'builder',
    label: 'Preview',
    title: 'Visual workflow builder',
    body: 'Triggers, conditions, branches and delays on a canvas that is validated before it can be switched on.',
    href: '/product/workflow-automation',
  },
  {
    id: 'rtl',
    label: 'Global',
    title: 'Right-to-left by design',
    body: 'Arabic, Dari and Pashto are first-class layouts: navigation, tables, forms and charts all mirror correctly.',
    href: '/features/enterprise-administration',
  },
];

export const benefits = [
  {
    id: 'same-record',
    title: 'One record, every team',
    body: 'Support, marketing and sales all read and write the same account. No synchronisation, no “whose version is right”.',
    points: ['Shared timeline across modules', 'Consent state visible where it matters', 'Cross-record consistency by construction'],
    accented: true,
  },
  {
    id: 'configure',
    title: 'Configurable without a developer',
    body: 'Add objects, fields, layouts, validation rules and saved views from the interface, with live previews before you save.',
    points: ['Custom objects and field types', 'Drag-and-drop page layouts', 'Conditional field visibility'],
  },
  {
    id: 'modes',
    title: 'Simple Mode and Advanced Mode',
    body: 'Start with a short sidebar and comfortable density. Reveal pipelines, workflows and customisation when the team is ready.',
    points: ['Per-user interface mode', 'Compact and comfortable density', 'Entitlement-driven navigation'],
  },
  {
    id: 'honest',
    title: 'Honest about what is real',
    body: 'Every simulated action in this build says so. Nothing claims to have sent an email, taken a payment or called an AI service.',
    points: ['Labelled demonstration data', 'No fake success messages', 'Explicit integration availability'],
  },
];

export const modules = [
  { key: 'leads', name: 'Lead management', summary: 'Capture, score explainably, qualify and convert with duplicate review.', href: '/features/lead-management', icon: 'UserPlus' },
  { key: 'pipeline', name: 'Pipeline management', summary: 'Multiple pipelines, weighted totals and accessible stage moves.', href: '/features/pipeline-management', icon: 'KanbanSquare' },
  { key: 'campaigns', name: 'Marketing automation', summary: 'Segments, email building, journeys and attribution.', href: '/product/marketing-crm', icon: 'Megaphone' },
  { key: 'service', name: 'Customer service', summary: 'Queues, SLAs, escalation, knowledge base and satisfaction.', href: '/product/customer-service-crm', icon: 'LifeBuoy' },
  { key: 'success', name: 'Customer success', summary: 'Health scoring, onboarding plans, renewals and churn risk.', href: '/product/customer-success', icon: 'HeartHandshake' },
  { key: 'revenue', name: 'Revenue operations', summary: 'Products, quotes, approvals, orders and recurring revenue.', href: '/product/revenue-operations', icon: 'Repeat' },
  { key: 'workflows', name: 'Workflow automation', summary: 'A visual builder with simulation and execution history.', href: '/features/workflow-builder', icon: 'Workflow' },
  { key: 'ai', name: 'AI assistant', summary: 'Summaries, drafting and insights that cite their records.', href: '/features/ai-assistant', icon: 'Sparkles' },
  { key: 'analytics', name: 'Analytics and reporting', summary: 'Dashboards, a report builder, forecasts and cohorts.', href: '/product/analytics', icon: 'BarChart3' },
  { key: 'customization', name: 'Customization', summary: 'Objects, fields, layouts, rules and saved views.', href: '/product/customization', icon: 'Blocks' },
  { key: 'omnichannel', name: 'Omnichannel inbox', summary: 'Email, SMS, WhatsApp, chat and calls in one queue.', href: '/product/omnichannel', icon: 'MessagesSquare' },
  { key: 'admin', name: 'Administration', summary: 'People, roles, permission matrix, security and audit.', href: '/features/enterprise-administration', icon: 'Settings' },
];

export const differentiators = [
  {
    title: 'A pipeline that respects the keyboard',
    body: 'Drag and drop is available, but every stage move also works from the record, the row menu and the keyboard, and both paths write through the same operation — so the board and the totals can never disagree.',
  },
  {
    title: 'Explanation instead of a black box',
    body: 'Lead scores and account health show the weighted factors behind the number, with a plain-language reason for every signal. A score you cannot interrogate is a score nobody trusts.',
  },
  {
    title: 'Global from the first render',
    body: 'Logical CSS properties throughout, three right-to-left locales, locale-aware dates, numbers, currencies and phone formats, and per-organization fiscal year and week-start settings.',
  },
];

export const aiPreview = {
  title: 'An assistant that shows its work',
  body: 'Summaries and drafts are produced by a deterministic engine in this build, labelled as such, and always cite the records they used. Applying a draft is an explicit action you can undo.',
  prompts: [
    'Summarise this account before my meeting tomorrow',
    'Why did this deal move into negotiation?',
    'Draft a follow-up after the pricing call',
    'Explain the movements in this quarter’s forecast',
    'Which accounts are at risk and why?',
    'Build a report of win rate by lead source',
  ],
  outputs: [
    { label: 'Cited records', value: 'Every claim links to the deal, ticket or activity it came from.' },
    { label: 'Reviewable drafts', value: 'Nothing is sent, saved or applied without a second, reversible click.' },
    { label: 'Explicit provenance', value: 'Responses are marked as generated by a demonstration engine.' },
    { label: 'Permission-aware', value: 'The assistant reads only what the signed-in role could already open.' },
  ],
};

export const globalCapabilities = [
  { title: 'Localization', body: '13 interface languages with per-language completeness tracking and English fallback.' },
  { title: 'Right-to-left', body: 'Arabic, Dari and Pashto with mirrored navigation, tables, drawers and charts.' },
  { title: 'Regional formatting', body: 'Dates, times, time zones, numbers, currencies, phone numbers and addresses.' },
  { title: 'Multiple currencies', body: 'Records can hold different currencies, with illustrative display conversion only.' },
  { title: 'Fiscal settings', body: 'Per-organization fiscal year start, week start and date-format preferences.' },
  { title: 'Data residency', body: 'Residency is presented as a product option; no certification or guarantee is claimed.' },
];

export const integrationsTeaser = {
  title: 'Connect the tools your teams already live in',
  body: 'Browse by category, follow a guided connection wizard, map fields and review sync health. Every provider states plainly whether it is a demonstration, planned, or unavailable.',
  categories: [
    { name: 'Email & calendar', examples: 'Google Workspace · Microsoft 365 · Gmail · Outlook · Google Calendar' },
    { name: 'Messaging', examples: 'WhatsApp Business · Slack · Microsoft Teams' },
    { name: 'Payments & accounting', examples: 'Stripe · PayPal · QuickBooks · Xero' },
    { name: 'E-commerce', examples: 'Shopify · WooCommerce' },
    { name: 'Automation & development', examples: 'Zapier · Make · REST API · Webhooks' },
  ],
};

export const faq = [
  {
    question: 'Is this a working product or a design prototype?',
    answer:
      'It is a working frontend. Every screen is real code you can click through, with realistic flows and synthetic data held in your browser. No backend, database, authentication service or payment provider is connected, and the interface says so wherever that matters.',
  },
  {
    question: 'Can I try it without signing up?',
    answer:
      'Yes. The interactive demo runs entirely in your browser with isolated sample data, needs no account, and can be reset at any time from the demo toolbar.',
  },
  {
    question: 'How is this different from the well-known CRM platforms?',
    answer:
      'Three deliberate choices: configuration that a business administrator can do without a developer, a Simple Mode that keeps the interface small until you need more, and a pipeline that is fully operable from the keyboard as well as by drag and drop.',
  },
  {
    question: 'What happens to data I enter in the demo?',
    answer:
      'It stays in your browser’s local storage. Nothing is transmitted anywhere. Clearing the demo data or resetting the demo removes it entirely.',
  },
  {
    question: 'Is the AI assistant a real model?',
    answer:
      'No. It is a deterministic template engine so the interface, provenance labelling and review flow can be designed honestly. No AI provider is called and no data leaves your browser.',
  },
  {
    question: 'Which languages and regions are supported?',
    answer:
      'Thirteen interface languages are wired up, with Arabic, Dari and Pashto using full right-to-left layouts. English is the only complete translation set; every other language shows its own completeness figure and falls back to English for missing strings.',
  },
  {
    question: 'Can I migrate from another CRM?',
    answer:
      'The import wizard supports field mapping, validation before commit and duplicate handling. The mapping catalogue and migration guidance pages describe the intended flow; the actual data transfer will be handled by the backend integration.',
  },
  {
    question: 'Are the prices on this site real?',
    answer:
      'No. Plan names, prices and limits are illustrative placeholders used to design the pricing interface. No commercial offering has been finalised and nothing here should be treated as an offer.',
  },
];

export const finalCta = {
  title: 'Start with the interface. Prove the workflow.',
  body: 'Create a workspace, load a sample dataset and run your own process through it. Nothing is charged and nothing is committed.',
  primary: { label: 'Start free trial', href: '/signup' },
  secondary: { label: 'Book a guided demo', href: '/book-a-demo' },
};
