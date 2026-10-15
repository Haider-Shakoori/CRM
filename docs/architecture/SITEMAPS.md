# Sitemaps and Route Maps — CRM Platform

> Temporary development name: **CRM Platform**. This document is the complete route inventory for the three frontend experiences. Key rules: every route below resolves to a real, implemented screen; dynamic segments are single template routes (not one route per item); there are no placeholder route farms.

| Field | Value |
| --- | --- |
| Status | Draft — implementation reference |
| Companion documents | `docs/architecture/INFORMATION_ARCHITECTURE.md` (nav model, URL conventions), `docs/architecture/USER_JOURNEYS.md` (task flows) |
| Apps covered | `apps/website` (`/` root, Astro), `apps/crm` (React Router, `/` root), `apps/platform-admin` (React Router, `/` root) |
| Backend assumption | All data comes from `@crm/mock-services`; service keys in the tables are defined in `INFORMATION_ARCHITECTURE.md` §7.5 |

## Legend

| Symbol / value | Meaning |
| --- | --- |
| ◆ | Page displays **clearly-labelled demonstration content** (synthetic data, illustrative examples, sample records). The label must be visible on the page, not only in a tooltip. |
| — | No demonstration content; the page is functional (forms, utility, navigation) or makes no data claims |
| SSG | Statically generated at build time |
| SSG + island | Static page with one or more hydrated React islands (filters, calculators, demo widgets) |
| Island (client:only) | Interactive-first page rendered by React on the client (wizard, auth form) |
| index / noindex | Robots directive; `noindex` pages are excluded from `sitemap.xml` |
| Template route | One route implementation rendering many content items via a content collection or mock dataset |

**Demonstration-content labelling standard (website):** every ◆ page carries a visible "Demonstration content" note (e.g. a caption under illustrated UI captures: "Interface shown with sample data for demonstration"). Customer stories, press, careers, roadmap and resource articles are explicitly labelled as illustrative examples; no real customer logos, names, testimonials, metrics or compliance certifications may appear anywhere.

---

## 1. Public website sitemap

Base URL: `/` — default locale `en` is unprefixed; every route is also generated under each enabled locale prefix (`/de/...`, `/es/...`, `/ar/...`). RTL locales (`ar`, `he`) render `dir="rtl"` and mirrored layout. All routes emit `hreflang` alternates + `x-default`. Interactive islands hydrate with `client:load` unless noted.

### 1.1 Homepage and product

| Route | Page title | Rendering | Primary CTA | Robots | Demo | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | CRM Platform — the CRM your whole revenue team will actually use | SSG + island | Start Free Trial | index | ◆ | Hero, product pillars, interactive demo teaser, integration wall, sample dashboards labelled as demonstration data |
| `/product` | Product overview | SSG | Start Free Trial | index | ◆ | Hub linking all 14 product pages; grouped Sell / Market / Serve / Platform |
| `/product/crm` | CRM overview | SSG + island | Start Free Trial | index | ◆ | Full-product tour with labelled sample UI |
| `/product/sales-crm` | Sales CRM | SSG + island | Start Free Trial | index | ◆ | Pipeline and lead-to-cash story; sample pipeline screenshots |
| `/product/marketing-crm` | Marketing CRM | SSG + island | Start Free Trial | index | ◆ | Campaign and segmentation story |
| `/product/service-crm` | Service CRM | SSG + island | See demo | index | ◆ | Help desk, SLA and KB story |
| `/product/customer-success` | Customer success | SSG + island | See demo | index | ◆ | Health scores, renewals, playbooks story |
| `/product/revenue-operations` | Revenue operations | SSG + island | See demo | index | ◆ | Quotes, orders, contracts, forecasting story |
| `/product/ai-automation` | AI and automation | SSG + island | See demo | index | ◆ | Assistant and workflow examples labelled as demonstrations |
| `/product/analytics-reporting` | Analytics and reporting | SSG + island | Start Free Trial | index | ◆ | Report builder and dashboards with labelled sample charts |
| `/product/customization-platform` | Customization platform | SSG + island | See demo | index | ◆ | Custom objects, fields, layouts examples |
| `/product/enterprise-crm` | Enterprise CRM | SSG + island | Contact Sales | index | ◆ | Administration, governance, scale story; no certification claims |
| `/product/mobile-crm` | Mobile CRM | SSG + island | Start Free Trial | index | ◆ | Mobile frames with labelled sample data |
| `/product/omnichannel-communication` | Omnichannel communication | SSG + island | See demo | index | ◆ | Inbox unification story across email/chat/voice (mock channels) |
| `/product/workflow-automation` | Workflow automation | SSG + island | See demo | index | ◆ | Visual builder preview, simulation example |
| `/product/integration-ecosystem` | Integration ecosystem | SSG + island | Browse integrations | index | ◆ | Links to `/integrations`; illustrative catalog, no partnership claims |
| `/solutions` | Solutions finder | SSG + island | Start Free Trial | index | ◆ | Filter by team/need into product, feature and industry pages; reusable template |
| `/industries` | Industries overview | SSG | Contact Sales | index | ◆ | Hub linking all 12 industry pages |
| `/industries/technology-saas` | CRM for technology and SaaS | SSG + island | Start Free Trial | index | ◆ | Configurable template; sample metrics labelled |
| `/industries/professional-services` | CRM for professional services | SSG + island | Start Free Trial | index | ◆ | Configurable template |
| `/industries/real-estate` | CRM for real estate | SSG + island | Start Free Trial | index | ◆ | Configurable template |
| `/industries/financial-services` | CRM for financial services | SSG | Contact Sales | index | ◆ | Regulated: capabilities described, **no compliance claim**; template copy, legal review required |
| `/industries/insurance` | CRM for insurance | SSG | Contact Sales | index | ◆ | Regulated: capabilities described, **no compliance claim** |
| `/industries/healthcare` | CRM for healthcare | SSG | Contact Sales | index | ◆ | Regulated: capabilities described, **no compliance claim**; no clinical-data claims |
| `/industries/education` | CRM for education | SSG + island | Start Free Trial | index | ◆ | Configurable template |
| `/industries/manufacturing` | CRM for manufacturing | SSG + island | Contact Sales | index | ◆ | Configurable template |
| `/industries/wholesale-distribution` | CRM for wholesale distribution | SSG + island | Contact Sales | index | ◆ | Configurable template |
| `/industries/retail-ecommerce` | CRM for retail and e-commerce | SSG + island | Start Free Trial | index | ◆ | Configurable template |
| `/industries/logistics` | CRM for logistics | SSG + island | Contact Sales | index | ◆ | Configurable template |
| `/industries/hospitality` | CRM for hospitality | SSG + island | Start Free Trial | index | ◆ | Configurable template |
| `/features` | Features overview | SSG | Start Free Trial | index | ◆ | Hub linking all 19 feature pages |
| `/features/lead-management` | Lead management | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/contact-management` | Contact management | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/account-management` | Account management | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/pipeline-management` | Pipeline management | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/sales-forecasting` | Sales forecasting | SSG + island | See demo | index | ◆ | Configurable feature template |
| `/features/workflow-builder` | Workflow builder | SSG + island | See demo | index | ◆ | Builder screenshots labelled as demonstrations |
| `/features/email-automation` | Email automation | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/customer-360` | Customer 360 | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/help-desk` | Help desk | SSG + island | See demo | index | ◆ | Configurable feature template |
| `/features/campaign-management` | Campaign management | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/customer-segmentation` | Customer segmentation | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/report-builder` | Report builder | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/dashboard-builder` | Dashboard builder | SSG + island | See demo | index | ◆ | Configurable feature template |
| `/features/ai-assistant` | AI assistant | SSG + island | See demo | index | ◆ | Sample conversations labelled as generated demonstrations |
| `/features/custom-fields` | Custom fields | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/team-collaboration` | Team collaboration | SSG + island | Start Free Trial | index | ◆ | Configurable feature template |
| `/features/integrations` | Integrations (feature) | SSG | Browse integrations | index | ◆ | Summarises `/integrations` |
| `/features/mobile-access` | Mobile access | SSG + island | Start Free Trial | index | ◆ | Device frames with labelled sample data |
| `/features/enterprise-administration` | Enterprise administration | SSG + island | Contact Sales | index | ◆ | Governance story; no certification claims |

### 1.2 Pricing, demo, signup and auth

| Route | Page title | Rendering | Primary CTA | Robots | Demo | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/pricing` | Pricing | SSG + island | Start Free Trial | index | ◆ | Plan toggle (monthly/annual) and pricing calculator island; prices labelled illustrative until launch |
| `/demo` | Interactive product demo | Island (client:only) | Start Free Trial | index | ◆ | Fully client-side sandbox with persistent "demonstration environment" banner; scenario deep links via `?scenario=`; no signup required; reset action |
| `/signup` | Start your free trial | Island (client:only) | Continue | noindex | — | Wizard step 1: work email + password; inline validation |
| `/signup/verify` | Verify your email | Island (client:only) | Resend email | noindex | — | Step 2; 60s resend cooldown; code entry fallback |
| `/signup/organization` | Tell us about your organization | Island (client:only) | Continue | noindex | — | Step 3: organization name, country, locale, currency, subdomain suggestion |
| `/signup/plan` | Choose your plan | Island (client:only) | Start free trial | noindex | ◆ | Step 4: plan + seat estimate; illustrative pricing label |
| `/sign-in` | Sign in | Island (client:only) | Sign in | noindex | — | Redirects to app session on success; `?next=` honoured |
| `/forgot-password` | Reset your password | Island (client:only) | Send reset link | noindex | — | Always shows neutral confirmation (no account enumeration) |
| `/reset-password` | Choose a new password | Island (client:only) | Update password | noindex | — | Token via `?token=`; expired-token state with re-request |
| `/verify-email` | Email verification | Island (client:only) | Continue to sign in | noindex | — | Token via `?token=`; success/failure states |
| `/verification-pending` | Verification pending | Island (client:only) | Resend email / Change address | noindex | — | Explains what to check; resend cooldown |
| `/invitation/:token` | You have been invited | Island (client:only) | Accept invitation | noindex | ◆ | Shows inviting organization (sample-safe); expired/revoked states |
| `/search` | Search the site | Island (client:only) | — | noindex | ◆ | Client-side content search; results labelled by type |

### 1.3 Company pages

| Route | Page title | Rendering | Primary CTA | Robots | Demo | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/company/about` | About CRM Platform | SSG | Start Free Trial | index | ◆ | Illustrative company narrative labelled as placeholders; no fabricated history presented as fact |
| `/company/contact` | Contact us | SSG + island | Send message | index | — | `?intent=sales|support|partnership|demo` preselects the form; routed through mock capture |
| `/company/careers` | Careers | SSG | View open roles | index | ◆ | Roles are illustrative examples, labelled |
| `/company/careers/:jobSlug` | Job detail | SSG | Apply (mock) | index | ◆ | Application form is a non-submitting demonstration unless backend later exists |
| `/company/partnerships` | Partnerships | SSG | Explore partner programs | index | ◆ | No named real partners |
| `/company/become-a-partner` | Become a partner | SSG + island | Submit partner application | index | — | Mock submission |
| `/company/affiliate-program` | Affiliate program | SSG + island | Join waitlist | index | ◆ | Illustrative commission examples labelled |
| `/company/customer-stories` | Customer stories | SSG | Start Free Trial | index | ◆ | **All stories are composite illustrations**, clearly labelled; no real customers |
| `/company/press` | Press and media | SSG | Contact press | index | ◆ | Illustrative announcements labelled; no real press coverage |
| `/company/brand-assets` | Brand assets | SSG | Download assets | index | ◆ | Temporary-name logo pack; note that branding is a development placeholder |

### 1.4 Resources

| Route | Page title | Rendering | Primary CTA | Robots | Demo | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/resources` | Resources hub | SSG + island | Browse resources | index | ◆ | Featured cards from fixtures |
| `/resources/blog` | Blog | SSG + island | Subscribe (mock) | index | ◆ | Articles are synthetic examples, labelled at article level |
| `/resources/blog/category/:categorySlug` | Blog category | SSG | Back to blog | index | ◆ | Template route over categories |
| `/resources/blog/:slug` | Blog article | SSG | Start Free Trial | index | ◆ | Synthetic author names labelled as illustrative |
| `/resources/guides` | Guides | SSG + island | Download guide (mock) | index | ◆ | Template route; gated download uses mock email capture |
| `/resources/guides/:slug` | Guide detail | SSG | Download guide | index | ◆ | — |
| `/resources/tutorials` | Tutorials | SSG + island | Start tutorial | index | ◆ | Video placeholders labelled |
| `/resources/tutorials/:slug` | Tutorial detail | SSG | Watch / read | index | ◆ | — |
| `/resources/webinars` | Webinars | SSG + island | Register (mock) | index | ◆ | Upcoming sessions are illustrative |
| `/resources/webinars/:slug` | Webinar detail | SSG + island | Register (mock) | index | ◆ | — |
| `/resources/library` | Resource library | SSG + island | Filter by type | index | ◆ | Faceted index over all resource types |
| `/resources/library/:slug` | Library item | SSG | Read / download | index | ◆ | Canonical home for downloadable assets |
| `/resources/help-center` | Help center | SSG + island | Search help | index | ◆ | Sample articles labelled; distinct from in-app dynamic KB |
| `/resources/help-center/articles/:slug` | Help article | SSG | Was this helpful? (mock) | index | ◆ | — |
| `/resources/docs` | Product documentation | SSG + island | Start reading | index | ◆ | Synthetic documentation describing planned behavior, labelled as draft |
| `/resources/docs/:section` | Docs section | SSG | Next article | index | ◆ | — |
| `/resources/docs/:section/:slug` | Docs article | SSG | Next article | index | ◆ | — |
| `/resources/developer-docs` | Developer documentation | SSG + island | Read API reference | index | ◆ | Mock endpoints documented as future/planned; no live API claims |
| `/resources/developer-docs/:section/:slug` | Developer docs article | SSG | Copy snippet | index | ◆ | Snippets are illustrative |
| `/resources/changelog` | Changelog | SSG | Subscribe (mock) | index | ◆ | Entries are synthetic examples labelled |
| `/resources/changelog/:version` | Changelog entry | SSG | — | index | ◆ | — |
| `/resources/release-notes` | Release notes | SSG | Subscribe (mock) | index | ◆ | Synthetic entries labelled |
| `/resources/release-notes/:entrySlug` | Release note | SSG | — | index | ◆ | — |
| `/resources/roadmap` | Roadmap | SSG + island | Vote (mock) | index | ◆ | Clearly labelled "illustrative roadmap; not a commitment" |

### 1.5 Integrations, legal, trust and utility

| Route | Page title | Rendering | Primary CTA | Robots | Demo | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/integrations` | Integrations directory | SSG + island | Connect (goes to signup) | index | ◆ | Illustrative catalog; no real partnership or certification claims |
| `/integrations/:slug` | Integration detail | SSG + island | Start Free Trial | index | ◆ | Logos are generic placeholders unless usage is legally cleared |
| `/legal/privacy` | Privacy policy | SSG | — | index | ◆ | Template copy; legal review required before launch |
| `/legal/terms` | Terms of service | SSG | — | index | ◆ | Template copy; legal review required |
| `/legal/cookies` | Cookie policy | SSG | Manage preferences | index | ◆ | Template copy; matches actual cookie usage once known |
| `/legal/cookie-preferences` | Cookie preferences | Island (client:only) | Save preferences | noindex | — | Functional consent management; also offered as a footer dialog |
| `/legal/dpa` | Data processing addendum | SSG | — | index | ◆ | Template copy; legal review required |
| `/legal/sla` | Service level agreement | SSG | — | index | ◆ | Template copy; no uptime guarantees presented as fact |
| `/legal/acceptable-use` | Acceptable use policy | SSG | — | index | ◆ | Template copy; legal review required |
| `/trust` | Trust center | SSG + island | Request security info (mock) | index | ◆ | Describes program structure; **no certification claims**; labels all sample documents |
| `/trust/security` | Security overview | SSG | — | index | ◆ | Capabilities described; no audit/certification claims |
| `/trust/subprocessors` | Subprocessors | SSG | — | index | ◆ | Illustrative list labelled; no real vendor commitments |
| `/trust/compliance` | Compliance overview | SSG | — | index | ◆ | Framework mapping described; **no certification claims** |
| `/trust/data-residency` | Data residency | SSG | Contact Sales | index | ◆ | Regions described as planned/illustrative |
| `/404` | Page not found | SSG | Back to homepage | noindex | — | Served for all unmatched routes; global search offered |
| `/500` | Something went wrong | SSG | Retry / homepage | noindex | — | Friendly error with status link |
| `/*` (fallback) | — | — | — | — | — | Exactly one 404 handler: unknown paths render `/404` content with the same URL preserved |

Website route coverage notes:

- Query-string state is non-canonical on the website (filters on `/integrations`, `/resources/library`, calculator inputs on `/pricing`, demo scenario on `/demo`). These get `?` variants but are not separate sitemap entries; they are `noindex, follow` where they duplicate content.
- Locale prefixes duplicate every indexable route: e.g. `/de/pricing`, `/ar/product/sales-crm`. Utility and noindex routes (`/sign-in`, `/signup/*`, `/404`, `/500`, `/search`, `/legal/cookie-preferences`) are generated per locale but always `noindex`.
- `sitemap.xml` is generated from the route manifest + content collections and excludes every `noindex` route.

---

## 2. CRM application route map

App: `apps/crm`. All authenticated routes render inside the app shell (sidebar + top bar). Check order on every route: session → entitlement → permission → record visibility (see `INFORMATION_ARCHITECTURE.md` §6.8).

Legend for the "Entitlement / role" column: `ent:` = module entitlement key required; roles are illustrative policy names mirrored by the future Laravel backend.

### 2.1 Shell, auth and system states

| Route pattern | Screen name | Key interactions | Mock services | Entitlement / role |
| --- | --- | --- | --- | --- |
| `/auth/sign-in` | Sign in | Email+password, SSO placeholder button (labelled unavailable?), error states, `?next=` | `session` | Public |
| `/auth/forgot-password` | Forgot password | Email capture, neutral confirmation | `session` | Public |
| `/auth/reset-password` | Reset password | Token via `?token=`, strength meter, expired state | `session` | Public |
| `/auth/verify-email` | Verify email | Token verification, resend fallback | `session` | Public |
| `/auth/invitation/:token` | Accept invitation | Preview org/role, accept → session + onboarding-aware redirect | `session`, `orgAdmin` | Public (token) |
| `/session-expired` | Session expired | Re-authentication with return path; restored draft notice | `session` | Public |
| `/orgs` | Your organizations | Membership list, roles, switch, leave (guarded) | `memberships` | Signed in |
| `/orgs/new` | Create organization | Name, country, locale, currency; plan gate | `memberships`, `billing` | `ent: org-admin` (multi-org plans only) |
| `/orgs/switch` | Switching organization | Progress/confirmation overlay route, then redirect to `/home` or last route | `memberships`, `preferences` | Signed in |
| `/onboarding` | Onboarding start | Redirects to first incomplete step | `tenantOnboarding` | `orgAdmin.invite` or owner |
| `/onboarding/:step` | Onboarding wizard step | Steps: `organization`, `locale`, `industry`, `size`, `goals`, `modules`, `pipeline`, `invite`, `sample-data`, `complete`; resumable, deep-linkable, skippable with consequences | `tenantOnboarding`, `templates` | Owner / OA |
| `/getting-started` | Getting started checklist | Checklist with progress, dismissible, deep links into modules | `tenantOnboarding` | Any (read) |
| `/home` | Home dashboard | Persona default widgets, period switcher, widget quick actions | `dashboards`, `analytics` | `ent: home` |
| `/home/dashboards/:dashboardId` | Dashboard view | Filters, drill-through to reports, share/export (mock), full screen | `dashboards` | `ent: home` |
| `/home/dashboards/:dashboardId/edit` | Dashboard editor | Add/arrange widgets (dnd-kit), save/publish, reset | `dashboards` | `home.edit` |
| `/notifications` | Notification center (full page) | Tabs, mark read, filters, deep links, preferences link | `notifications`, `preferences` | Any |
| `/settings/profile` | Profile settings | Name, avatar (mock upload), timezone, signature | `preferences` | Any |
| `/settings/appearance` | Appearance settings | Theme, density, Simple/Advanced mode, reduced motion override | `preferences` | Any |
| `/settings/language` | Language settings | Locale list with native names, RTL preview note, fallback indicator (Advanced) | `preferences` | Any |
| `/settings/notifications` | Notification preferences | Per-type channels and frequency (mock) | `preferences` | Any |
| `/settings/security` | Personal security | Sessions list, sign out everywhere, password change | `session` | Any |
| `/search` | Search results | Full-page results grouped by type; filters; save as view where supported | `search` | Any (results permission-filtered) |
| `/access-denied` | Access denied | Required role/scope explanation, "Request access" action, back link | `orgAdmin` (request) | Any signed in |
| `/not-entitled/:moduleKey` | Module not entitled | Module description, plan snippet, "Request upgrade", demonstration preview link where available | `entitlements` | Any signed in |
| `*` | Not found | Single catch-all; offers search and Home | — | Any signed in |

Org switcher note: org switching is a shell control (sidebar header); `/orgs*` routes exist for management, cold deep links and post-expiry recovery. `/orgs/switch` is an overlay route used only when a full-page confirmation is needed.

### 2.2 Sales

| Route pattern | Screen name | Key interactions | Mock services | Entitlement / role |
| --- | --- | --- | --- | --- |
| `/leads` | Leads list | Saved views, search, filters, inline status change, bulk assign, export (mock), `layout` table/board | `leads` | `ent: leads`; read = sales roles, create = `leads.create` |
| `/leads/new` | Create lead | Full form, duplicate warning, source/campaign attribution | `leads`, `campaigns` | `leads.create` |
| `/leads/:leadId` | Lead detail | Timeline, notes, tasks, emails, score breakdown, status/owner change, related records | `leads`, `activities`, `inbox` | read |
| `/leads/:leadId/edit` | Edit lead | Same form as create, dirty guard, field history (mock) | `leads` | `leads.update` |
| `/leads/:leadId/convert` | Convert lead wizard | Steps: match/create account + contact → create deal (or skip) → confirm; dedupe suggestions; result links | `leads`, `accounts`, `contacts`, `deals` | `leads.convert`; deal step needs `ent: deals` |
| `/contacts` | Contacts list | Saved views, filters (owner, tag, account), bulk actions | `contacts` | `ent: contacts` |
| `/contacts/new` | Create contact | Form, account linking, dedupe by email/phone | `contacts`, `accounts` | `contacts.create` |
| `/contacts/:contactId` | Contact detail | Timeline, related deals/tickets/cases, consent fields, merge action | `contacts`, `activities`, `tickets` | read |
| `/contacts/:contactId/edit` | Edit contact | Field edits, consent changes logged | `contacts` | `contacts.update` |
| `/accounts` | Accounts list | Saved views, health/owner filters, saved export (mock) | `accounts` | `ent: accounts` |
| `/accounts/new` | Create account | Form, parent account, territory assignment | `accounts`, `territories` | `accounts.create` |
| `/accounts/:accountId` | Account detail | Tabs: overview, people, deals, activities, tickets, files, hierarchy; health chip | `accounts`, `deals`, `activities`, `tickets`, `documents` | read |
| `/accounts/:accountId/edit` | Edit account | Field edits, hierarchy changes (cycle guard) | `accounts` | `accounts.update` |
| `/deals` | Deals pipeline | Board/list toggle (`layout`), drag stage with permission + reason dialog, filters (pipeline, stage, owner, period), totals per column | `deals`, `analytics` | `ent: deals` |
| `/deals/new` | Create deal | Form, inline account/contact creation, products preview (mock totals) | `deals`, `products` | `deals.create` |
| `/deals/:dealId` | Deal detail | Stage history, products/line items, approvals (mock), activities, quotes link | `deals`, `products`, `quotes` | read |
| `/deals/:dealId/edit` | Edit deal | Field edits, amount/date change with forecast impact notice | `deals` | `deals.update` |
| `/partners` | Partners list | Partner types, tiers, status, owner | `partners` | `ent: partners` |
| `/partners/:partnerId` | Partner detail | Registrations, influenced deals, agreement notes | `partners`, `deals` | `ent: partners` |
| `/partners/registrations` | Deal registrations | Approve/reject registrations with reason | `partners`, `deals` | `partners.approve` |
| `/field-sales` | Field sales today | Day plan map/list, check-in state, route summary | `fieldSales`, `calendar` | `ent: field-sales` |
| `/field-sales/visits` | Visit list | Filters by rep/status/date; log completion | `fieldSales` | `ent: field-sales` |
| `/field-sales/visits/new` | Log a visit | Account/contact, window, purpose, outcome, next step, follow-up task | `fieldSales`, `activities` | `field-sales.create` |
| `/field-sales/visits/:visitId` | Visit detail | Check-in/out, notes, outcome, follow-up | `fieldSales` | read |
| `/field-sales/territories` | Territories | Territory tree, assignment rules, coverage view | `territories` | `field-sales.manage` |

### 2.3 Marketing, service and success

| Route pattern | Screen name | Key interactions | Mock services | Entitlement / role |
| --- | --- | --- | --- | --- |
| `/campaigns` | Campaigns list | Status filters, channel, owner, performance columns (mock metrics) | `campaigns` | `ent: campaigns` |
| `/campaigns/new` | Create campaign | Type/channel, dates, budget, target segment, template choice | `campaigns`, `segments` | `campaigns.create` |
| `/campaigns/:campaignId` | Campaign detail | Tabs via `?tab=`: overview, audience, content, attribution; member add/remove; "scheduled" state is mock and labelled | `campaigns`, `segments`, `deals` | read |
| `/segments` | Segments list | Saved segments, member counts, refresh (mock) | `segments`, `contacts` | `ent: campaigns` (segmentation) |
| `/segments/:segmentId` | Segment builder | Rule builder over standard + custom fields, preview count, overlap warning | `segments`, `customization` | `campaigns.create` |
| `/tickets` | Ticket list | Queue tabs, SLA badges (text+icon), bulk assign/priority | `tickets` | `ent: tickets` |
| `/tickets/new` | Create ticket | Contact/account link, channel, priority, queue routing | `tickets` | `tickets.create` |
| `/tickets/:ticketId` | Ticket detail | Thread, SLA timer, internal notes, reassign, resolve with required resolution, KB insert | `tickets`, `knowledgeBase`, `inbox` | read |
| `/tickets/queues/:queueId` | Queue view | Filtered list by queue, workload summary | `tickets` | `ent: tickets` |
| `/knowledge` | Knowledge base | Collections tree, article status (draft/published), internal vs public flag | `knowledgeBase` | `ent: knowledge-base` |
| `/knowledge/articles/:articleId` | Article view | Read, helpfulness (mock), history, translation status | `knowledgeBase` | read |
| `/knowledge/articles/:articleId/edit` | Article editor | Rich text, variables, visibility, review workflow, autosave draft | `knowledgeBase` | `knowledge-base.edit` |
| `/knowledge/categories/:categoryId` | Category manager | Reorder, visibility, ownership | `knowledgeBase` | `knowledge-base.manage` |
| `/customer-success` | Success portfolio | Health distribution, renewals due, risk flags, portfolio filters | `customerSuccess` | `ent: customer-success` |
| `/customer-success/accounts/:accountId` | Success workspace | Health score factors, usage trend (mock), risks, success plan, plays | `customerSuccess`, `activities` | read |
| `/customer-success/renewals` | Renewals board | Stage board, at-risk column, due dates | `renewals` | `ent: customer-success` |
| `/customer-success/renewals/:renewalId` | Renewal detail | Review signals → build quote → set outcome; next steps | `renewals`, `quotes` | `renewals.update` |
| `/customer-success/playbooks` | Playbooks | Playbook templates, applied plays, run history | `customerSuccess` | `customer-success.manage` |
| `/portal-preview` | Portal preview home | Device frame, persona switcher, preview banner; demonstration content only | `portal` | `ent: portal-preview` |
| `/portal-preview/portal` | Portal home preview | Navigate tenant's portal surfaces read-only | `portal` | read |
| `/portal-preview/portal/tickets/:ticketId` | Portal ticket preview | Customer-view ticket rendering | `portal`, `tickets` | read |

### 2.4 Revenue, productivity and insights

| Route pattern | Screen name | Key interactions | Mock services | Entitlement / role |
| --- | --- | --- | --- | --- |
| `/products` | Products list | Price books, active/archived, currency columns | `products` | `ent: products` |
| `/products/new` | Create product | Form, pricing model, tax category (mock) | `products` | `products.manage` |
| `/products/:productId` | Product detail | Price books, usage in quotes, history | `products` | read |
| `/revenue/quotes` | Quotes list | Status filters, expiry, approval state | `quotes` | `ent: revenue-ops` |
| `/revenue/quotes/new` | Create quote | Line items from products, totals, terms, approval preview | `quotes`, `products` | `quotes.create` |
| `/revenue/quotes/:quoteId` | Quote detail | Edit line items, versions, send/accept (mock states labelled) | `quotes` | read/edit |
| `/revenue/orders` | Orders list | Fulfilment status, source quote | `orders` | `ent: revenue-ops` |
| `/revenue/orders/:orderId` | Order detail | Line items, dates, related contract | `orders` | read |
| `/revenue/contracts` | Contracts list | Renewal dates, status, value | `contracts` | `ent: revenue-ops` |
| `/revenue/contracts/:contractId` | Contract detail | Terms, linked orders, renewal link | `contracts`, `renewals` | read |
| `/activities` | Activities & tasks | Views (today, overdue, mine, team), inline complete, bulk reschedule | `activities` | `ent: activities` |
| `/activities/:activityId` | Activity detail | Notes, outcome, related records, follow-up creation | `activities` | read |
| `/calendar` | Calendar | Day/week/month (`?view=`), drag reschedule with permission, agenda list | `calendar` | `ent: calendar` |
| `/calendar/events/:eventId` | Event detail | Attendees, related records, meeting notes capture | `calendar` | read |
| `/inbox` | Unified inbox | Channel tabs (mock channels), filters, thread list, keyboard triage | `inbox` | `ent: inbox` |
| `/inbox/:conversationId` | Conversation | Reply, internal note, link to record, assign, snooze | `inbox`, `contacts` | read |
| `/inbox/compose` | Compose | Deep-linkable composer, templates, record linking, draft autosave | `inbox`, `templates` | `inbox.send` |
| `/projects` | Projects list | Status, progress, team, linked account | `projects` | `ent: projects` |
| `/projects/new` | Create project | Template choice, team, dates, linked records | `projects`, `templates` | `projects.create` |
| `/projects/:projectId` | Project detail | Tabs: tasks, timeline, files, team; task board | `projects`, `activities` | read |
| `/documents` | Documents | Folders, recent, shared; version chips | `documents` | `ent: documents` |
| `/documents/:documentId` | Document viewer | Preview, versions, link to records, comments | `documents` | read |
| `/analytics` | Analytics overview | KPI cards, drill-through, period compare | `analytics`, `dashboards` | `ent: analytics` |
| `/analytics/reports` | Report library | Search, folders, ownership, run | `analytics` | read |
| `/analytics/reports/:reportId` | Report viewer | Filters, grouping, column config, export (mock), share | `analytics` | read; edit = authoring role in Advanced Mode |
| `/analytics/reports/new` | Report builder | Choose source, metrics, dimensions, filters; save with visibility | `analytics` | `analytics.create` |
| `/analytics/forecast` | Forecast | Team/rep roll-up, commit/best case/pipeline, submit lock (mock), drill to deals | `analytics`, `deals` | `ent: deals` + manager role |

### 2.5 Automation, customize, admin, billing

| Route pattern | Screen name | Key interactions | Mock services | Entitlement / role |
| --- | --- | --- | --- | --- |
| `/workflows` | Workflows list | Status, runs today (mock), owner, enable/disable with confirmation | `workflows` | `ent: workflows` |
| `/workflows/new` | Workflow builder | Trigger → conditions → actions canvas (dnd-kit), validation before save | `workflows` | `workflows.create` |
| `/workflows/:workflowId` | Workflow editor | Edit graph, version history, publish with scope summary | `workflows` | `workflows.update` |
| `/workflows/:workflowId/simulate` | Simulation | Dry run over sample of last N records; matched/unmatched table; clearly labelled simulation | `workflows`, `automationRuns` | `workflows.update` |
| `/workflows/:workflowId/run-history` | Run history | Run list, step attempts, errors, retry (mock) | `automationRuns` | read |
| `/ai` | AI assistant | Conversations, context picker, prompt starters; output labelled AI-drafted | `assistant` | `ent: ai` |
| `/ai/conversations/:conversationId` | Assistant conversation | Continue/resume, cite records, apply suggestions explicitly | `assistant` | read |
| `/customization` | Customization hub | Object list, usage counts, mode note | `customization` | `ent: customization` + Advanced Mode |
| `/customization/objects` | Custom objects | Create object, record counts, dependency warnings | `customization` | `customization.manage` |
| `/customization/objects/:objectKey` | Object detail | Tabs: fields, relationships, layouts, permissions, records preview | `customization` | `customization.manage` |
| `/customization/layouts` | Layouts | Page layouts per object, drag sections, role visibility | `customization` | `customization.manage` |
| `/records/:objectKey` | Custom object records list | Saved views, filters, bulk actions for tenant-defined objects | `customization` (data) | `ent: customization` + object read policy |
| `/records/:objectKey/new` | Create custom record | Dynamic form from field definitions | `customization` | object create policy |
| `/records/:objectKey/:recordId` | Custom record detail | Timeline, related lists, same shell grammar as built-ins | `customization` | object read policy |
| `/templates` | Industry templates | Gallery, filters, preview, apply wizard | `templates` | `ent: templates`; apply = OA |
| `/templates/:templateKey` | Template detail | Contents preview, what will be created, apply with dry-run summary | `templates` | OA |
| `/integrations` | Integrations | Connected/available tabs, connect flow (mock OAuth), health | `integrations` | `ent: integrations` |
| `/integrations/:integrationKey` | Integration detail | Configuration, field mappings (mock), logs link | `integrations` | `integrations.manage` |
| `/developer/api-keys` | API keys | Create key (shown once, mock), scopes, revoke | `developer` | `ent: developer` + ITA/OA |
| `/developer/webhooks` | Webhooks | Endpoint config, event selection, test delivery (mock) | `developer` | `developer.manage` |
| `/developer/apps` | Apps and sandbox | Sandbox org switch, app registrations (mock) | `developer` | `developer.manage` |
| `/admin` | Organization settings hub | Section cards with permission-aware links | `orgAdmin` | `ent: org-admin`; OA/ITA |
| `/admin/organization` | Organization profile | Name, logo (mock), addresses, fiscal year, locale defaults | `orgAdmin` | `org-admin.update` |
| `/admin/users` | User management | Invite, deactivate, change role, seat usage, filters | `orgAdmin` | `org-admin.users` |
| `/admin/users/:userId` | User detail | Profile, roles, teams, recent activity, deactivate | `orgAdmin`, `audit` | `org-admin.users` |
| `/admin/roles` | Roles & permissions | Role list, clone, member counts | `orgAdmin` | `org-admin.roles` |
| `/admin/roles/:roleId` | Role editor | Permission matrix, preview "what this role sees", save with audit note | `orgAdmin`, `audit` | `org-admin.roles` |
| `/admin/security` | Security settings | Session policy, password policy, IP allowlist (mock), MFA placeholder labelled "frontend preview" | `orgAdmin` | `org-admin.security` |
| `/admin/audit` | Audit log | Filters (actor, action, object, date), row diff drawer, export request (mock) | `audit` | `org-admin.audit` |
| `/admin/data` | Data management | Import wizard (mock), export requests, duplicates, field usage, storage (mock) | `orgAdmin`, `customization` | `org-admin.data` |
| `/admin/modules` | Modules & entitlements | Plan/module matrix, trial states, request change, dependency warnings | `entitlements` | `org-admin.modules` |
| `/billing` | Billing overview | Plan, next invoice, seats, usage alerts | `billing`, `usage` | `ent: billing`; OWN/CEO/FIN/OA |
| `/billing/plans` | Change plan | Plan comparison, upgrade/downgrade preview (mock proration), confirm | `plans`, `billing` | `billing.manage` |
| `/billing/usage` | Usage | Metered usage table, thresholds, projected bill (mock) | `usage` | read |
| `/billing/invoices` | Invoices | List, status, download (mock), dispute link | `billing` | read |
| `/billing/payment-methods` | Payment methods | Add card form (never stores real data; clearly mock), default selection | `billing` | `billing.manage` |

Route-map rules:

- Every detail route accepts `?tab=` for pane state, `?view=` for the list it was opened from (to power "back to list"), and `?highlight=` to scroll to a related row.
- Drag interactions (deals board, workflow canvas, dashboard widgets, calendar) always expose a keyboard-accessible alternative (move via menu or `Shift+Arrow`), and stage regressions require a reason.
- Modules not listed above do not exist; there are no hidden placeholder routes. Modules gated by entitlement appear only via `/not-entitled/:moduleKey`.

---

## 3. Platform administration route map

App: `apps/platform-admin`. Same column structure. All mutations are audit-logged with actor + reason.

### 3.1 Shell, tenants and subscriptions

| Route pattern | Screen name | Key interactions | Mock services | Entitlement / role |
| --- | --- | --- | --- | --- |
| `/sign-in` | Platform sign in | Staff sign in (mock), MFA placeholder labelled | `platform.session` | Public |
| `/session-expired` | Session expired | Re-auth with return path | `platform.session` | Public |
| `/dashboard` | Platform dashboard | Tenant growth, trial watchlist, MRR/churn, open incidents; drill-throughs | `platform.tenants`, `platform.revenue`, `platform.status` | Platform staff (all roles) |
| `/tenants` | Tenant directory | Search/filter (plan, status, region), bulk actions, export request | `platform.tenants` | `platform.tenants.read` |
| `/tenants/new` | Create tenant | Manual provisioning, plan + trial config, founding admin invite, region/locale | `platform.tenants`, `platform.plans` | `platform.tenants.create` |
| `/tenants/:tenantId` | Tenant 360 | Tabs via `?tab=`: overview, users, subscription, entitlements, health, activity; suspend (typed confirm), extend trial, change plan, impersonate | `platform.tenants`, `platform.subscriptions`, `platform.audit` | `platform.tenants.read`; mutations per action |
| `/subscriptions` | Subscriptions | Lifecycle states incl. dunning; filters; bulk note | `platform.subscriptions` | `platform.subscriptions.read` |
| `/subscriptions/:subscriptionId` | Subscription detail | Plan/seats/dates, invoice history, lifecycle actions with reason, entitlement snapshot | `platform.subscriptions`, `platform.revenue` | `platform.subscriptions.manage` |
| `/impersonate/:tenantId` | Impersonation start | Reason capture + consent checklist, then handout to CRM app with banner; ends back here | `platform.tenants`, `platform.audit` | `platform.impersonate` |
| `/impersonation-ended` | Return state | Summary of session, audit entry link | `platform.audit` | Platform staff |

### 3.2 Revenue, platform configuration and operations

| Route pattern | Screen name | Key interactions | Mock services | Entitlement / role |
| --- | --- | --- | --- | --- |
| `/plans` | Plan catalog | Plan list, module matrix preview, regions, self-serve eligibility | `platform.plans` | `platform.plans.read` |
| `/plans/new` | Create plan | Editor with limits, included modules, trial length, price points | `platform.plans` | `platform.plans.manage` |
| `/plans/:planId` | Plan editor | Edit, deprecate (with migration notice), audit trail | `platform.plans`, `platform.audit` | `platform.plans.manage` |
| `/revenue` | Revenue overview | MRR/ARR movement, expansion/contraction/churn, collections | `platform.revenue` | `platform.revenue.read` |
| `/revenue/invoices` | Invoice register | Status filters, failed payments queue | `platform.revenue` | `platform.revenue.read` |
| `/revenue/invoices/:invoiceId` | Invoice detail | Line items, retry payment (mock), credit note (mock) | `platform.revenue` | `platform.revenue.manage` |
| `/feature-flags` | Feature flags | Environment, rollout state, linked module, search | `platform.flags` | `platform.flags.read` |
| `/feature-flags/:flagKey` | Flag detail | Targeting rules, rollout %, change history, kill switch | `platform.flags`, `platform.audit` | `platform.flags.manage` |
| `/module-catalog` | Module catalog | Canonical module list, entitlement keys, dependencies, plan inclusion | `platform.catalog` | `platform.catalog.read` |
| `/module-catalog/:moduleKey` | Module detail | Metadata, default nav label/icon, availability matrix, deprecation state | `platform.catalog` | `platform.catalog.manage` |
| `/localization` | Localization admin | Locale list, coverage %, publish state, fallback chains | `platform.localization` | `platform.localization.read` |
| `/localization/:localeCode` | Locale workbench | Missing-key queue, RTL flag, formatter defaults, translation editor | `platform.localization` | `platform.localization.manage` |
| `/announcements` | Announcements | List, targeting summary, schedule state | `platform.announcements` | `platform.announcements.read` |
| `/announcements/new` | Create announcement | Author, target (plan/region/locale), schedule, preview, publish | `platform.announcements` | `platform.announcements.manage` |
| `/announcements/:announcementId` | Announcement editor | Edit, retract, delivery stats (mock) | `platform.announcements` | `platform.announcements.manage` |
| `/notification-templates` | Notification templates | Template list per event type and locale | `platform.notificationTemplates` | `platform.templates.read` |
| `/notification-templates/:templateId` | Template editor | Variables, locale variants, preview, test send (mock), publish state | `platform.notificationTemplates` | `platform.templates.manage` |
| `/integrations-catalog` | Integrations catalog | Curated list, categories, plan/region availability | `platform.catalog` | `platform.catalog.read` |
| `/integrations-catalog/:integrationKey` | Integration detail | Metadata, OAuth scopes (mock), catalog state, tenant adoption | `platform.catalog` | `platform.catalog.manage` |
| `/support` | Platform support inbox | Tenant requests, priority, assignment, SLA note | `platform.support` | `platform.support.read` |
| `/support/tickets/:ticketId` | Support request detail | Thread, linked tenant, escalation, resolution | `platform.support` | `platform.support.manage` |
| `/audit` | Platform audit log | Filters, row diff drawer, export request (mock) | `platform.audit` | `platform.audit.read` |
| `/system-status` | System status | Region/service health, maintenance windows, draft communications | `platform.status` | `platform.status.read` |
| `/system-status/incidents/:incidentId` | Incident detail | Timeline, affected components, tenant notifications, postmortem stub | `platform.status` | `platform.status.manage` |
| `/internal-users` | Internal users | Staff directory, roles, MFA status, session revoke (mock), access review prompt | `platform.internalUsers` | `platform.users.read` |
| `/internal-users/:userId` | Internal user detail | Permissions, recent actions, deactivate | `platform.internalUsers`, `platform.audit` | `platform.users.manage` |
| `/platform-roles` | Platform roles | Least-privilege roles, member counts | `platform.internalUsers` | `platform.roles.read` |
| `/platform-roles/:roleId` | Platform role editor | Clone role, permission matrix, preview effective access | `platform.internalUsers` | `platform.roles.manage` |
| `/access-denied` | Access denied | Required platform role explanation, request access | `platform.internalUsers` | Platform staff |
| `*` | Not found | Single catch-all | — | — |

Platform console rules: no tenant context switcher; scope is always in the page header; destructive actions require typed confirmation and a reason; impersonation always shows a banner and writes to `/audit`; nothing renders real customer PII — tenant data shown to platform staff is synthetic mock data.

---

## 4. Route coverage rules

1. **No dead links.** Every link rendered anywhere (website header/footer/mega menus, in-app sidebar, command palette, page CTAs, empty states, emails/previews, documentation cross-references) must resolve to a route in this document. Nav items are generated from the same route manifest used for coverage tests, so a nav entry cannot exist without a screen. A CI check walks the manifest and fails on links to unknown patterns.
2. **Exactly one 404 handler per app.** Website: all unmatched paths render the `/404` route content (preserving the URL for analytics); CRM and platform admin: a single `*` catch-all renders the not-found screen (which is *not* the access-denied or not-entitled screen). `not-entitled` and `access-denied` are explicit, informative states, never substitutes for 404 and never blank.
3. **Lazy route loading.** CRM and platform admin load every route group lazily (route-level code splitting). The suspense fallback is the screen's skeleton, not a full-page spinner. Builder canvases, charting and the rich-text editor are loaded only when their route mounts. The website ships islands only where interactivity is required; static content stays static.
4. **Every navigable route resolves to a real screen.** Dynamic segments are **one template route** rendering many items (e.g. `/industries/:slug`, `/resources/blog/:slug`, `/records/:objectKey/:recordId`), never one hard-coded route per content item. No route may render a bare "coming soon" placeholder; if a feature is not implemented, its nav entry does not exist (or the module is entitlement-locked with a real not-entitled screen). The target is a route inventory in the low hundreds, with zero placeholder farms.
5. **Route manifest is the single source of truth.** `@crm/configuration` exposes a typed route manifest (path, module key, entitlement, required permission, breadcrumb builder, palette entry). Sidebar, command palette, breadcrumbs, `sitemap.xml`, robots directives and the coverage tests all read from it.
6. **Deep links survive.** Every route listed here must cold-load correctly: session check → entitlement → permission → record fetch, with skeleton states, and the degradation rules in `INFORMATION_ARCHITECTURE.md` §6.8. A deep link never silently redirects to Home; it explains where the user landed and why.
7. **Canonical URLs.** Query-string variants (`?view=`, `?tab=`, `?layout=`, filters) are the same route; canonical copies strip transient params (`dialog`, `ai`, `highlight`, `tour`). App routes are never indexed; website routes follow the `Robots` column and the sitemap excludes every `noindex` route.
