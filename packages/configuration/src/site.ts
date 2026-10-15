/**
 * Public website information architecture: navigation, mega menus, footer and the
 * canonical route list.
 *
 * The website is presentation-oriented, so it gets its own navigation model rather
 * than reusing the CRM module registry. Routes live here so that the sitemap, the
 * internal-link checker and the navigation components cannot drift apart.
 */

export interface SiteNavLink {
  label: string;
  href: string;
  description?: string;
  /** Marks a page whose content is clearly-labelled demonstration material. */
  demoContent?: boolean;
  badge?: string;
}

export interface SiteNavGroup {
  label: string;
  links: SiteNavLink[];
  /** Promotional column rendered at the end of a mega menu. */
  feature?: { title: string; body: string; href: string; ctaLabel: string };
}

export interface SiteNavItem {
  label: string;
  href: string;
  /** Present when the item opens a mega menu. */
  groups?: SiteNavGroup[];
  /** Simple dropdown for short lists. */
  dropdown?: SiteNavLink[];
  columns?: 2 | 3 | 4;
  /** Optional promotional panel rendered alongside the mega menu columns. */
  feature?: { title: string; body: string; href: string; ctaLabel: string };
}

export const primaryNav: SiteNavItem[] = [
  {
    label: 'Product',
    href: '/product',
    columns: 4,
    groups: [
      {
        label: 'Platform',
        links: [
          { label: 'CRM overview', href: '/product', description: 'What the platform covers end to end.' },
          { label: 'Enterprise CRM', href: '/product/enterprise-crm', description: 'Governance, scale and administration.' },
          { label: 'Customization platform', href: '/product/customization', description: 'Objects, fields and layouts.' },
          { label: 'Integration ecosystem', href: '/product/integrations', description: 'Marketplace, APIs and webhooks.' },
          { label: 'Mobile CRM', href: '/product/mobile', description: 'Responsive access anywhere.' },
        ],
      },
      {
        label: 'By function',
        links: [
          { label: 'Sales CRM', href: '/product/sales-crm', description: 'Pipeline, forecasting and productivity.' },
          { label: 'Marketing CRM', href: '/product/marketing-crm', description: 'Campaigns, audiences and journeys.' },
          { label: 'Customer service CRM', href: '/product/customer-service-crm', description: 'Tickets, SLAs and knowledge.' },
          { label: 'Customer success', href: '/product/customer-success', description: 'Health, onboarding and renewals.' },
          { label: 'Revenue operations', href: '/product/revenue-operations', description: 'Quotes, contracts and recurring revenue.' },
        ],
      },
      {
        label: 'Capabilities',
        links: [
          { label: 'AI and automation', href: '/product/ai-and-automation', description: 'Assistant, insights and workflow builder.' },
          { label: 'Analytics and reporting', href: '/product/analytics', description: 'Dashboards, reports and forecasts.' },
          { label: 'Workflow automation', href: '/product/workflow-automation', description: 'A visual no-code builder.' },
          { label: 'Omnichannel communication', href: '/product/omnichannel', description: 'One inbox for every channel.' },
        ],
      },
    ],
  },
  {
    label: 'Solutions',
    href: '/solutions',
    columns: 3,
    groups: [
      {
        label: 'By business size',
        links: [
          { label: 'Individuals & freelancers', href: '/solutions/individuals' },
          { label: 'Startups', href: '/solutions/startups' },
          { label: 'Small business', href: '/solutions/small-business' },
          { label: 'Mid-market', href: '/solutions/mid-market' },
          { label: 'Enterprise', href: '/solutions/enterprise' },
          { label: 'International organisations', href: '/solutions/international' },
        ],
      },
      {
        label: 'By team',
        links: [
          { label: 'Sales teams', href: '/solutions/sales-teams' },
          { label: 'Marketing teams', href: '/solutions/marketing-teams' },
          { label: 'Support teams', href: '/solutions/support-teams' },
          { label: 'Customer success teams', href: '/solutions/customer-success-teams' },
          { label: 'Field sales teams', href: '/solutions/field-sales' },
          { label: 'Revenue operations', href: '/solutions/revenue-operations' },
        ],
      },
      {
        label: 'By process',
        links: [
          { label: 'B2B sales', href: '/solutions/b2b' },
          { label: 'B2C and high volume', href: '/solutions/b2c' },
          { label: 'Subscription business', href: '/solutions/subscription-business' },
          { label: 'Channel and partner sales', href: '/solutions/partner-sales' },
          { label: 'Project-based delivery', href: '/solutions/project-delivery' },
          { label: 'Migrate from another CRM', href: '/solutions/migration' },
        ],
      },
    ],
    feature: {
      title: 'Enterprise functionality without enterprise complexity',
      body: 'Start with an industry template, then remove what you do not need. Simple Mode keeps the interface small until the team asks for more.',
      href: '/product',
      ctaLabel: 'See the platform',
    },
  },
  {
    label: 'Industries',
    href: '/industries',
    columns: 3,
    groups: [
      {
        label: 'Popular',
        links: [
          { label: 'Technology & SaaS', href: '/industries/technology-saas' },
          { label: 'Professional services', href: '/industries/professional-services' },
          { label: 'Real estate', href: '/industries/real-estate' },
          { label: 'Manufacturing', href: '/industries/manufacturing' },
          { label: 'Marketing agencies', href: '/industries/marketing-agency' },
          { label: 'Recruitment', href: '/industries/recruitment' },
        ],
      },
      {
        label: 'Regulated & specialist',
        links: [
          { label: 'Financial services', href: '/industries/financial-services' },
          { label: 'Insurance', href: '/industries/insurance' },
          { label: 'Healthcare', href: '/industries/healthcare' },
          { label: 'Nonprofits', href: '/industries/nonprofit' },
        ],
      },
      {
        label: 'More industries',
        links: [
          { label: 'Education & admissions', href: '/industries/education' },
          { label: 'Wholesale & distribution', href: '/industries/wholesale-distribution' },
          { label: 'Retail & e-commerce', href: '/industries/retail-ecommerce' },
          { label: 'Automotive', href: '/industries/automotive' },
          { label: 'Logistics & freight', href: '/industries/logistics' },
          { label: 'Construction', href: '/industries/construction' },
          { label: 'Hospitality', href: '/industries/hospitality' },
          { label: 'Travel agencies', href: '/industries/travel' },
          { label: 'Telecommunications', href: '/industries/telecommunications' },
          { label: 'View all industries', href: '/industries' },
        ],
      },
    ],
  },
  {
    label: 'Features',
    href: '/features',
    columns: 3,
    groups: [
      {
        label: 'Sell',
        links: [
          { label: 'Lead management', href: '/features/lead-management' },
          { label: 'Contact management', href: '/features/contact-management' },
          { label: 'Account management', href: '/features/account-management' },
          { label: 'Pipeline management', href: '/features/pipeline-management' },
          { label: 'Sales forecasting', href: '/features/sales-forecasting' },
        ],
      },
      {
        label: 'Engage',
        links: [
          { label: 'Customer 360 view', href: '/features/customer-360' },
          { label: 'Campaign management', href: '/features/campaign-management' },
          { label: 'Customer segmentation', href: '/features/customer-segmentation' },
          { label: 'Email automation', href: '/features/email-automation' },
          { label: 'Help desk', href: '/features/help-desk' },
        ],
      },
      {
        label: 'Operate',
        links: [
          { label: 'Workflow builder', href: '/features/workflow-builder' },
          { label: 'Dashboard builder', href: '/features/dashboard-builder' },
          { label: 'Report builder', href: '/features/report-builder' },
          { label: 'Custom fields', href: '/features/custom-fields' },
          { label: 'Team collaboration', href: '/features/team-collaboration' },
          { label: 'Mobile access', href: '/features/mobile-access' },
          { label: 'Enterprise administration', href: '/features/enterprise-administration' },
          { label: 'AI assistant', href: '/features/ai-assistant' },
        ],
      },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  {
    label: 'Integrations',
    href: '/integrations',
    dropdown: [
      { label: 'Browse the marketplace', href: '/integrations' },
      { label: 'Email & calendar', href: '/integrations?category=email' },
      { label: 'Messaging', href: '/integrations?category=messaging' },
      { label: 'Payments & accounting', href: '/integrations?category=payments' },
      { label: 'E-commerce', href: '/integrations?category=ecommerce' },
      { label: 'Developer platform', href: '/developers' },
    ],
  },
  {
    label: 'Resources',
    href: '/resources',
    columns: 3,
    groups: [
      {
        label: 'Learn',
        links: [
          { label: 'Blog', href: '/blog' },
          { label: 'CRM guides', href: '/resources/guides' },
          { label: 'Product tutorials', href: '/resources/tutorials' },
          { label: 'Webinars', href: '/resources/webinars' },
          { label: 'Resource library', href: '/resources/library' },
        ],
      },
      {
        label: 'Support',
        links: [
          { label: 'Help centre', href: '/resources/help-center' },
          { label: 'Documentation', href: '/docs' },
          { label: 'Developer documentation', href: '/developers/docs' },
          { label: 'Changelog', href: '/changelog' },
          { label: 'Release notes', href: '/changelog/releases' },
          { label: 'Product roadmap', href: '/roadmap' },
        ],
      },
      {
        label: 'Proof',
        links: [
          { label: 'Customer stories', href: '/customers', demoContent: true },
          { label: 'Interactive demo', href: '/demo' },
          { label: 'Trust centre', href: '/trust' },
          { label: 'Security overview', href: '/trust/security' },
        ],
      },
    ],
  },
  {
    label: 'Company',
    href: '/company',
    dropdown: [
      { label: 'About', href: '/company/about' },
      { label: 'Contact', href: '/company/contact' },
      { label: 'Careers', href: '/company/careers', demoContent: true },
      { label: 'Partnerships', href: '/company/partnerships' },
      { label: 'Become a partner', href: '/company/become-a-partner' },
      { label: 'Affiliate programme', href: '/company/affiliate' },
      { label: 'Press', href: '/company/press', demoContent: true },
      { label: 'Brand assets', href: '/company/brand-assets' },
    ],
  },
];

export interface FooterColumn {
  title: string;
  links: SiteNavLink[];
}

export const footerColumns: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'CRM overview', href: '/product' },
      { label: 'Sales CRM', href: '/product/sales-crm' },
      { label: 'Marketing CRM', href: '/product/marketing-crm' },
      { label: 'Customer service CRM', href: '/product/customer-service-crm' },
      { label: 'Customer success', href: '/product/customer-success' },
      { label: 'Revenue operations', href: '/product/revenue-operations' },
      { label: 'AI and automation', href: '/product/ai-and-automation' },
      { label: 'Analytics and reporting', href: '/product/analytics' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Interactive demo', href: '/demo' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Small business', href: '/solutions/small-business' },
      { label: 'Mid-market', href: '/solutions/mid-market' },
      { label: 'Enterprise', href: '/solutions/enterprise' },
      { label: 'Sales teams', href: '/solutions/sales-teams' },
      { label: 'Support teams', href: '/solutions/support-teams' },
      { label: 'Field sales', href: '/solutions/field-sales' },
      { label: 'Channel and partner sales', href: '/solutions/partner-sales' },
      { label: 'Migrate from another CRM', href: '/solutions/migration' },
    ],
  },
  {
    title: 'Industries',
    links: [
      { label: 'Technology & SaaS', href: '/industries/technology-saas' },
      { label: 'Professional services', href: '/industries/professional-services' },
      { label: 'Real estate', href: '/industries/real-estate' },
      { label: 'Manufacturing', href: '/industries/manufacturing' },
      { label: 'Financial services', href: '/industries/financial-services' },
      { label: 'Healthcare', href: '/industries/healthcare' },
      { label: 'Retail & e-commerce', href: '/industries/retail-ecommerce' },
      { label: 'All industries', href: '/industries' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'CRM guides', href: '/resources/guides' },
      { label: 'Tutorials', href: '/resources/tutorials' },
      { label: 'Webinars', href: '/resources/webinars' },
      { label: 'Help centre', href: '/resources/help-center' },
      { label: 'Documentation', href: '/docs' },
      { label: 'Developer docs', href: '/developers/docs' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'API reference', href: '/developers/reference' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/company/about' },
      { label: 'Contact', href: '/company/contact' },
      { label: 'Contact sales', href: '/contact-sales' },
      { label: 'Book a demo', href: '/book-a-demo' },
      { label: 'Careers', href: '/company/careers', demoContent: true },
      { label: 'Partnerships', href: '/company/partnerships' },
      { label: 'Become a partner', href: '/company/become-a-partner' },
      { label: 'Affiliate programme', href: '/company/affiliate' },
      { label: 'Customer stories', href: '/customers', demoContent: true },
      { label: 'Press', href: '/company/press', demoContent: true },
      { label: 'Brand assets', href: '/company/brand-assets' },
    ],
  },
  {
    title: 'Trust & legal',
    links: [
      { label: 'Trust centre', href: '/trust' },
      { label: 'Security overview', href: '/trust/security' },
      { label: 'Compliance overview', href: '/trust/compliance' },
      { label: 'Subprocessors', href: '/trust/subprocessors' },
      { label: 'Data residency', href: '/trust/data-residency' },
      { label: 'Service status', href: '/trust/status' },
      { label: 'Privacy policy', href: '/legal/privacy' },
      { label: 'Terms of service', href: '/legal/terms' },
      { label: 'Cookie policy', href: '/legal/cookies' },
      { label: 'Data processing agreement', href: '/legal/dpa' },
      { label: 'Service level agreement', href: '/legal/sla' },
      { label: 'Acceptable use policy', href: '/legal/acceptable-use' },
    ],
  },
];

/** Application entry points referenced by website CTAs. */
export const appLinks = {
  login: '/signin',
  signup: '/signup',
  trial: '/signup',
  demo: '/demo',
  crm: '/app/home',
  platformAdmin: '/platform',
  portal: '/portal',
} as const;

/** Product and feature landing pages, generated from configuration for consistency. */
export const productPages = [
  { slug: '', title: 'CRM overview', summary: 'One configurable platform for the whole customer lifecycle.', icon: 'LayoutDashboard', audience: 'Everyone evaluating the platform' },
  { slug: 'sales-crm', title: 'Sales CRM', summary: 'Leads, contacts, accounts, pipeline, forecasting and sales productivity.', icon: 'TrendingUp', audience: 'Sales leaders and representatives' },
  { slug: 'marketing-crm', title: 'Marketing CRM', summary: 'Campaigns, audiences, journeys, forms, attribution and ROI.', icon: 'Megaphone', audience: 'Marketing teams' },
  { slug: 'customer-service-crm', title: 'Customer service CRM', summary: 'Tickets, queues, SLAs, escalation, knowledge base and satisfaction.', icon: 'LifeBuoy', audience: 'Support and service leaders' },
  { slug: 'customer-success', title: 'Customer success', summary: 'Health scores, onboarding, renewals, churn risk and expansion.', icon: 'HeartHandshake', audience: 'Customer success teams' },
  { slug: 'revenue-operations', title: 'Revenue operations', summary: 'Products, quotes, orders, contracts and recurring revenue analysis.', icon: 'Repeat', audience: 'Finance and revenue operations' },
  { slug: 'ai-and-automation', title: 'AI and automation', summary: 'A deterministic assistant and a visual no-code workflow builder.', icon: 'Sparkles', audience: 'Operations and enablement' },
  { slug: 'analytics', title: 'Analytics and reporting', summary: 'Dashboards, a report builder, forecasts, cohorts and attribution.', icon: 'BarChart3', audience: 'Analysts and leadership' },
  { slug: 'customization', title: 'Customization platform', summary: 'Custom objects, fields, layouts, rules and saved views.', icon: 'Blocks', audience: 'Administrators and RevOps' },
  { slug: 'enterprise-crm', title: 'Enterprise CRM', summary: 'Identity, permission, audit and data-governance surfaces at scale.', icon: 'Building2', audience: 'IT and security stakeholders' },
  { slug: 'mobile', title: 'Mobile CRM', summary: 'A responsive interface designed for phones and tablets.', icon: 'Smartphone', audience: 'Field and mobile teams' },
  { slug: 'omnichannel', title: 'Omnichannel communication', summary: 'Email, SMS, WhatsApp, chat and calls in one queue.', icon: 'MessagesSquare', audience: 'Support and inside sales' },
  { slug: 'workflow-automation', title: 'Workflow automation', summary: 'Triggers, conditions, branches, delays and approvals with simulation.', icon: 'Workflow', audience: 'Operations teams' },
  { slug: 'integrations', title: 'Integration ecosystem', summary: 'A marketplace, connection wizards, field mapping and sync health.', icon: 'Blocks', audience: 'Technical evaluators' },
] as const;

export const featurePages = [
  { slug: 'lead-management', title: 'Lead management', summary: 'Capture, score, qualify and convert with a full audit trail.' },
  { slug: 'contact-management', title: 'Contact management', summary: 'People, relationships, consent and every interaction in one profile.' },
  { slug: 'account-management', title: 'Account management', summary: 'Hierarchies, health, revenue snapshots and buying committees.' },
  { slug: 'pipeline-management', title: 'Pipeline management', summary: 'Multiple pipelines, weighted totals and accessible stage moves.' },
  { slug: 'sales-forecasting', title: 'Sales forecasting', summary: 'Commit, best case and pipeline with rep rollups and coverage.' },
  { slug: 'workflow-builder', title: 'Workflow builder', summary: 'A visual canvas validated before it can be switched on.' },
  { slug: 'email-automation', title: 'Email automation', summary: 'Templates, sequences and journeys with honest delivery states.' },
  { slug: 'customer-360', title: 'Customer 360 view', summary: 'Deals, tickets, documents and conversations on one timeline.' },
  { slug: 'help-desk', title: 'Help desk', summary: 'Queues, priorities, SLAs, escalation and agent performance.' },
  { slug: 'campaign-management', title: 'Campaign management', summary: 'Plan, execute and measure campaigns against revenue.' },
  { slug: 'customer-segmentation', title: 'Customer segmentation', summary: 'Nested AND/OR rules with a live audience preview.' },
  { slug: 'report-builder', title: 'Report builder', summary: 'Grouped results, computed columns, comparisons and exports.' },
  { slug: 'dashboard-builder', title: 'Dashboard builder', summary: 'Drag widgets, resize them and save layouts per role.' },
  { slug: 'ai-assistant', title: 'AI assistant', summary: 'Summaries, drafting and insights that cite their sources.' },
  { slug: 'custom-fields', title: 'Custom fields', summary: 'Every field type you need, with conditional visibility.' },
  { slug: 'team-collaboration', title: 'Team collaboration', summary: 'Feeds, mentions, shared notes and record-level discussion.' },
  { slug: 'integrations', title: 'Integrations', summary: 'Connect the tools your teams already live in.' },
  { slug: 'mobile-access', title: 'Mobile access', summary: 'A real responsive application, not a shrunken desktop.' },
  { slug: 'enterprise-administration', title: 'Enterprise administration', summary: 'Roles, permissions, security policy and audit.' },
] as const;

/** Trust/compliance pages that must render a visible pending-review notice. */
export const legalPagesRequiringReview = new Set([
  'privacy',
  'terms',
  'cookies',
  'dpa',
  'sla',
  'acceptable-use',
]);

export function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

/** Every static route the website is expected to render — used by the link checker. */
export function allStaticWebsiteRoutes(): string[] {
  const routes = new Set<string>([
    '/',
    '/pricing',
    '/demo',
    '/integrations',
    '/developers',
    '/developers/docs',
    '/developers/reference',
    '/blog',
    '/docs',
    '/changelog',
    '/changelog/releases',
    '/roadmap',
    '/customers',
    '/trust',
    '/trust/security',
    '/trust/compliance',
    '/trust/subprocessors',
    '/trust/data-residency',
    '/trust/status',
    '/contact-sales',
    '/book-a-demo',
    '/signin',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/verify-email/pending',
    '/accept-invitation',
    '/legal/privacy',
    '/legal/terms',
    '/legal/cookies',
    '/legal/cookie-preferences',
    '/legal/dpa',
    '/legal/sla',
    '/legal/acceptable-use',
    '/company/about',
    '/company/contact',
    '/company/careers',
    '/company/partnerships',
    '/company/become-a-partner',
    '/company/affiliate',
    '/company/press',
    '/company/brand-assets',
    '/resources',
    '/resources/guides',
    '/resources/tutorials',
    '/resources/webinars',
    '/resources/library',
    '/resources/help-center',
    '/industries',
    '/solutions',
    '/features',
  ]);
  for (const p of productPages) routes.add(p.slug ? `/product/${p.slug}` : '/product');
  for (const p of featurePages) routes.add(`/features/${p.slug}`);
  return [...routes].sort();
}
