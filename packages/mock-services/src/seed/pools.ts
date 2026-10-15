/**
 * Name and term pools for synthetic data generation.
 *
 * All names are fictional and assembled from common given names and plausible company
 * stems. No real person, company, brand, domain or registered trademark is referenced
 * anywhere in the generated dataset — which is a requirement, not a nicety.
 *
 * Pools are deliberately international: the product is designed for worldwide use, and a
 * dataset of English-only names would hide RTL, diacritic and non-Latin rendering problems
 * rather than surface them.
 */

export const givenNames = {
  western: [
    'Amelia', 'Noah', 'Priya', 'Lucas', 'Marta', 'Idris', 'Sofia', 'Tomas', 'Elena', 'Jonas',
    'Clara', 'Rafael', 'Ingrid', 'Mateo', 'Freya', 'Anton', 'Leila', 'Hugo', 'Nadia', 'Felix',
    'Camille', 'Dmitri', 'Anouk', 'Pablo', 'Sanne', 'Emil', 'Rosa', 'Viktor', 'Juliette', 'Oskar',
  ],
  arabic: [
    'Layla', 'Omar', 'Fatima', 'Yusuf', 'Aisha', 'Khalid', 'Noor', 'Tariq', 'Hana', 'Sami',
    'Rania', 'Imran', 'Zainab', 'Bilal', 'Maryam', 'Adil',
  ],
  germanic: [
    'Annelie', 'Bernd', 'Claudia', 'Dieter', 'Elke', 'Florian', 'Greta', 'Heiko', 'Ilse', 'Jürgen',
    'Katrin', 'Lenz', 'Miriam', 'Nils', 'Petra', 'Rainer', 'Sabine', 'Thorsten', 'Ute', 'Wolfgang',
  ],
  south_asian: [
    'Ananya', 'Rohan', 'Ishita', 'Karthik', 'Meera', 'Arjun', 'Divya', 'Nikhil', 'Sanya', 'Vikram',
  ],
  east_asian: ['Mei', 'Kenji', 'Haruka', 'Wei', 'Sora', 'Jian', 'Yuna', 'Daichi'],
} as const;

export const familyNames = {
  western: [
    'Whitfield', 'Marchetti', 'Ndoye', 'Lindqvist', 'Okonkwo', 'Duarte', 'Halloran', 'Vasquez',
    'Petrova', 'Bergström', 'Aubert', 'Novak', 'Ferrante', 'Kowalski', 'Sandoval', 'Rasmussen',
    'Bianchi', 'Delacroix', 'Mikkelsen', 'Alderete',
  ],
  arabic: ['Al-Rashid', 'Haddad', 'Mansour', 'Nasser', 'El-Amin', 'Kassem', 'Zarour', 'Barakat'],
  germanic: [
    'Brandt', 'Keller', 'Hoffmann', 'Wagner', 'Schreiber', 'Lindemann', 'Vogt', 'Baumann',
    'Reinhardt', 'Kirchner', 'Steinmann', 'Neuhaus',
  ],
  south_asian: ['Sharma', 'Iyer', 'Reddy', 'Balakrishnan', 'Chatterjee', 'Nair', 'Deshpande', 'Rao'],
  east_asian: ['Tanaka', 'Chen', 'Nakamura', 'Zhao', 'Sato', 'Liu', 'Yamada', 'Huang'],
} as const;

/**
 * Fictional company names.
 *
 * Deliberately constructed from invented stems so they cannot collide with a real
 * organisation. Each is paired with the region it is used in so addresses, currencies and
 * tax identifiers stay internally consistent.
 */
export const companyStems = {
  technology: [
    'Vertex', 'Lumen', 'Northgate', 'Clearpath', 'Bluewave', 'Orbital', 'Parallax', 'Sierra',
    'Ironclad', 'Aperture', 'Copperline', 'Flatiron', 'Ridgeline', 'Cadence', 'Pinnacle', 'Halcyon',
  ],
  industrial: [
    'Nordwind', 'Stahlwerk', 'Eisenbach', 'Kranzler', 'Werkmann', 'Bergwerk', 'Rothstein',
    'Hochfeld', 'Metallbau', 'Zellwerk',
  ],
  trading: [
    'Al Noor', 'Al Manara', 'Gulf Crescent', 'Emirates Orient', 'Falcon Bay', 'Pearl Marina',
    'Desert Rose', 'Zayed Star',
  ],
  legal_suffixes: ['Ltd', 'GmbH', 'LLC', 'Inc', 'B.V.', 'SpA', 'AB', 'Pty Ltd', 'FZE', 'LLP'],
} as const;

export const jobTitles = [
  'Head of Operations', 'Chief Technology Officer', 'Procurement Manager', 'IT Director',
  'Operations Director', 'Finance Manager', 'Chief Operating Officer', 'Head of Procurement',
  'Technical Architect', 'Plant Manager', 'Regional Manager', 'Head of Customer Experience',
  'Facilities Manager', 'Head of Compliance', 'Supply Chain Lead', 'Managing Director',
  'Head of Data', 'Service Delivery Manager', 'Head of Facilities', 'Commercial Director',
] as const;

export const industriesForAccounts = [
  'Logistics', 'Manufacturing', 'Financial Services', 'Healthcare', 'Retail', 'Hospitality',
  'Construction', 'Education', 'Energy', 'Public Sector', 'Media', 'Pharmaceuticals',
  'Automotive', 'Telecommunications', 'Agriculture', 'Professional Services',
] as const;

export const cities = {
  us: [
    { city: 'Chicago', state: 'Illinois', postal: '60602', country: 'US' },
    { city: 'Austin', state: 'Texas', postal: '78701', country: 'US' },
    { city: 'Portland', state: 'Oregon', postal: '97204', country: 'US' },
    { city: 'Boston', state: 'Massachusetts', postal: '02108', country: 'US' },
    { city: 'Denver', state: 'Colorado', postal: '80202', country: 'US' },
    { city: 'Atlanta', state: 'Georgia', postal: '30303', country: 'US' },
    { city: 'Seattle', state: 'Washington', postal: '98101', country: 'US' },
  ],
  de: [
    { city: 'Stuttgart', state: 'Baden-Württemberg', postal: '70173', country: 'DE' },
    { city: 'Dortmund', state: 'Nordrhein-Westfalen', postal: '44135', country: 'DE' },
    { city: 'Hannover', state: 'Niedersachsen', postal: '30159', country: 'DE' },
    { city: 'Nürnberg', state: 'Bayern', postal: '90402', country: 'DE' },
    { city: 'Leipzig', state: 'Sachsen', postal: '04109', country: 'DE' },
  ],
  ae: [
    { city: 'Dubai', state: 'Dubai', postal: '00000', country: 'AE' },
    { city: 'Abu Dhabi', state: 'Abu Dhabi', postal: '00000', country: 'AE' },
    { city: 'Sharjah', state: 'Sharjah', postal: '00000', country: 'AE' },
    { city: 'Ajman', state: 'Ajman', postal: '00000', country: 'AE' },
  ],
} as const;

export const streetNames = [
  'Harrow Court', 'Marchetti Way', 'Foundry Lane', 'Kestrel Rise', 'Whitfield Road',
  'Sandpiper Close', 'Ironside Street', 'Bridgewater Way', 'Alder Grove', 'Copperfield Row',
  'Lindenstrasse', 'Werkstrasse', 'Hafenallee', 'Industrieweg', 'Gartenstrasse',
  'Sheikh Zayed Road', 'Corniche Street', 'Al Wasl Road', 'Marina Walk', 'Jumeirah Boulevard',
] as const;

export const dealNamePatterns = [
  'Enterprise platform roll-out', 'Annual platform renewal', 'Multi-site deployment',
  'Pilot programme extension', 'Global framework agreement', 'Digital transformation programme',
  'Service desk expansion', 'Field operations upgrade', 'Data platform consolidation',
  'Regional expansion licence', 'Support contract uplift', 'Automation programme',
  'Compliance readiness project', 'Integration platform licence', 'Training and enablement package',
] as const;

export const tags = [
  { id: 'tag-strategic', label: 'Strategic', color: 'violet' as const },
  { id: 'tag-renewal-risk', label: 'Renewal risk', color: 'amber' as const },
  { id: 'tag-expansion', label: 'Expansion', color: 'green' as const },
  { id: 'tag-enterprise', label: 'Enterprise', color: 'blue' as const },
  { id: 'tag-competitor', label: 'Competitor present', color: 'red' as const },
  { id: 'tag-pilot', label: 'Pilot', color: 'teal' as const },
  { id: 'tag-partner-sourced', label: 'Partner sourced', color: 'slate' as const },
] as const;

export const competitors = [
  'Argos Suite', 'Meridian Cloud', 'Sentinel CX', 'Lighthouse CRM', 'Ironbark Platform', 'Vantage One',
] as const;

export const productCatalog = {
  technology: [
    { name: 'Platform Enterprise Licence', sku: 'PLT-ENT', unit: 'seat' as const, price: 1180, billing: 'annual' as const },
    { name: 'Platform Professional Licence', sku: 'PLT-PRO', unit: 'seat' as const, price: 720, billing: 'annual' as const },
    { name: 'Service Desk Module', sku: 'MOD-SVC', unit: 'seat' as const, price: 240, billing: 'annual' as const },
    { name: 'Marketing Automation Module', sku: 'MOD-MKT', unit: 'seat' as const, price: 320, billing: 'annual' as const },
    { name: 'Field Operations Module', sku: 'MOD-FLD', unit: 'seat' as const, price: 280, billing: 'annual' as const },
    { name: 'Analytics Add-on', sku: 'ADD-ANA', unit: 'seat' as const, price: 180, billing: 'annual' as const },
    { name: 'AI Credits 10k Pack', sku: 'ADD-AI-10', unit: 'each' as const, price: 1490, billing: 'monthly' as const },
    { name: 'Data Residency Surcharge', sku: 'ADD-RES', unit: 'each' as const, price: 3600, billing: 'annual' as const },
    { name: 'Implementation Services', sku: 'SVC-IMP', unit: 'day' as const, price: 1450, billing: 'one_time' as const },
    { name: 'Technical Account Manager', sku: 'SVC-TAM', unit: 'month' as const, price: 2800, billing: 'monthly' as const },
    { name: 'Premium Support Uplift', sku: 'SVC-SUP', unit: 'seat' as const, price: 180, billing: 'annual' as const },
    { name: 'Sandbox Environment', sku: 'ADD-SBX', unit: 'each' as const, price: 1990, billing: 'annual' as const },
  ],
  industrial: [
    { name: 'CNC Precision Unit P-Series', sku: 'CNC-P', unit: 'each' as const, price: 84500, billing: 'one_time' as const },
    { name: 'CNC Precision Unit M-Series', sku: 'CNC-M', unit: 'each' as const, price: 128000, billing: 'one_time' as const },
    { name: 'Hydraulic Press 200T', sku: 'HYD-200', unit: 'each' as const, price: 195000, billing: 'one_time' as const },
    { name: 'Conveyor Line Module 12m', sku: 'CVY-12', unit: 'each' as const, price: 42000, billing: 'one_time' as const },
    { name: 'Preventive Maintenance Contract', sku: 'SVC-PM', unit: 'year' as const, price: 24000, billing: 'annual' as const },
    { name: 'Operator Training Programme', sku: 'SVC-TRN', unit: 'day' as const, price: 1800, billing: 'one_time' as const },
    { name: 'Spare Parts Kit Standard', sku: 'SPR-STD', unit: 'each' as const, price: 6800, billing: 'one_time' as const },
    { name: 'Remote Monitoring Licence', sku: 'LIC-RM', unit: 'each' as const, price: 4200, billing: 'annual' as const },
  ],
  trading: [
    { name: 'Bulk Container Allocation', sku: 'TRD-BLK', unit: 'each' as const, price: 18500, billing: 'one_time' as const },
    { name: 'Pallet Consignment Standard', sku: 'TRD-PLT', unit: 'each' as const, price: 2400, billing: 'one_time' as const },
    { name: 'Expedited Freight Service', sku: 'TRD-EXP', unit: 'each' as const, price: 5400, billing: 'one_time' as const },
    { name: 'Warehouse Storage Monthly', sku: 'TRD-WHS', unit: 'month' as const, price: 3200, billing: 'monthly' as const },
    { name: 'Customs Clearance Service', sku: 'TRD-CUS', unit: 'each' as const, price: 950, billing: 'one_time' as const },
    { name: 'Regional Distribution Agreement', sku: 'TRD-RDA', unit: 'year' as const, price: 145000, billing: 'annual' as const },
  ],
} as const;

/**
 * A single sellable line item, whichever catalogue it came from.
 *
 * `productCatalog` is `as const`, so each family is its own readonly tuple of literal types.
 * Indexing it by family therefore produces a *union of tuples*, and a generic like
 * `random.pick` cannot pick an element out of that. Widening to this union of element types
 * gives the seeders one array shape to work with while keeping the literals intact.
 */
export type ProductCatalogItem = (typeof productCatalog)[keyof typeof productCatalog][number];

/**
 * Which catalogue fits an industry.
 *
 * Kept beside the catalogue rather than in each seeder so the product list a tenant gets and
 * the product lines its deals reference can never disagree about which family it sells. The
 * fallback is the technology catalogue, which is what the first demonstration tenant sells.
 */
export function productFamilyFor(industryId: string): keyof typeof productCatalog {
  if (industryId === 'manufacturing') return 'industrial';
  if (industryId === 'wholesale_distribution') return 'trading';
  return 'technology';
}

export const leadSources = [
  { id: 'src-web-form', name: 'Website form', kind: 'web_form' as const, channel: 'Organic search' },
  { id: 'src-paid-search', name: 'Paid search', kind: 'paid_search' as const, channel: 'Paid search' },
  { id: 'src-paid-social', name: 'Paid social', kind: 'paid_social' as const, channel: 'Paid social' },
  { id: 'src-referral', name: 'Customer referral', kind: 'referral' as const, channel: 'Referral' },
  { id: 'src-event', name: 'Industry event', kind: 'event' as const, channel: 'Events' },
  { id: 'src-outbound', name: 'Outbound prospecting', kind: 'outbound' as const, channel: 'Outbound' },
  { id: 'src-partner', name: 'Partner referral', kind: 'partner' as const, channel: 'Partner' },
  { id: 'src-import', name: 'Data import', kind: 'import' as const, channel: 'Migration' },
  { id: 'src-manual', name: 'Added manually', kind: 'manual' as const, channel: 'Direct' },
  { id: 'src-contact-sales', name: 'Contact sales form', kind: 'web_form' as const, channel: 'Direct' },
  { id: 'src-demo-request', name: 'Demo request', kind: 'web_form' as const, channel: 'Direct' },
  { id: 'src-content-download', name: 'Resource download', kind: 'organic' as const, channel: 'Content' },
] as const;

export const lostReasons = [
  { id: 'lost-price', label: 'Price above budget', category: 'price' as const, weight: 28 },
  { id: 'lost-competitor', label: 'Chose a competitor', category: 'competitor' as const, weight: 22 },
  { id: 'lost-timing', label: 'Timing slipped', category: 'timing' as const, weight: 18 },
  { id: 'lost-no-decision', label: 'No decision made', category: 'no_decision' as const, weight: 14 },
  { id: 'lost-product-gap', label: 'Missing capability', category: 'product_gap' as const, weight: 10 },
  { id: 'lost-relationship', label: 'Existing vendor relationship', category: 'relationship' as const, weight: 5 },
  { id: 'lost-process', label: 'Procurement process failed', category: 'process' as const, weight: 3 },
] as const;

export const ticketSubjects = [
  'Intermittent timeouts on the reporting endpoint',
  'Unable to export contacts to CSV',
  'Two-factor authentication prompt repeating',
  'Bulk import rejected rows without explanation',
  'Dashboard widget shows stale figures',
  'Email delivery marked as failed',
  'Webhook deliveries stopped after configuration change',
  'Permission change not reflected for one user',
  'Duplicate contacts created by the import wizard',
  'Scheduled report not generating',
  'Search returns no results for a known account',
  'Custom field not appearing on the record layout',
  'SLA timer paused unexpectedly',
  'Quote totals differ from the line items',
  'Sandbox refresh request',
  'Request to increase storage quota',
  'Field mapping lost after a sync run',
  'User cannot see records shared with their team',
  'Session expires sooner than expected',
  'Cannot assign a ticket to a shared queue',
] as const;

export const kbArticleTitles = [
  'Configuring an SLA policy with business hours',
  'Mapping fields during a data import',
  'Setting up single sign-on with SAML',
  'Building your first workflow',
  'Understanding lead scoring factors',
  'Managing consent per communication channel',
  'Creating a custom object',
  'Designing a page layout for a sales team',
  'Setting up a shared inbox',
  'Using saved views to standardise reporting',
  'Configuring role-based record visibility',
  'Exporting a dashboard to a spreadsheet',
  'Troubleshooting webhook delivery failures',
  'Understanding the forecast categories',
  'Adding a new currency to a price book',
  'Migrating from a spreadsheet',
  'Best practices for duplicate management',
  'Using sequences without over-contacting',
] as const;

export const campaignNames = [
  'Q4 Enterprise Webinar Series', 'Platform Migration Guide', 'Industry Report Launch',
  'Product Update Announcement', 'Customer Health Check-in', 'Renewal Readiness Programme',
  'Trade Show Follow-up', 'Partner Enablement Push', 'Feature Adoption Nudge',
  'Year-End Data Cleanup', 'Onboarding Welcome Series', 'Win-Back Re-engagement',
] as const;

export const workflowNames = [
  'Lead assignment by territory', 'Deal won to onboarding project', 'Ticket overdue escalation',
  'Inactive customer follow-up', 'Contract nearing expiry renewal task', 'High-value deal approval',
  'New contact welcome sequence', 'Stale deal warning', 'Renewal risk notification',
  'New user onboarding tasks', 'Data quality review on import', 'Quote discount approval routing',
] as const;
