# Feature Matrix

**Purpose:** a build-status view of the 384 requirements in
[`FEATURE_INVENTORY.md`](../feature-inventory/FEATURE_INVENTORY.md), grouped by domain.

**Status vocabulary** (identical to `PROJECT_STATUS.md`):

- `Planned` — specified, no code
- `UI skeleton` — route and layout exist, not interactive
- `Interactive mock complete` — works against the mock service layer with loading, empty and error states
- `Tested` — automated coverage recorded in `TEST_REPORT.md`
- `Backend integration pending` — frontend complete, awaiting the REST API

**Nothing below is marked production-functional**, because no backend exists.

---

## 1. Completion summary

This is a **domain-level snapshot as of Batch 17**. It deliberately does not assign a status
to each of the 384 requirement rows: doing that honestly requires walking every row against
the code, and an invented per-row total is worse than an honest domain view. The authoritative
record of what each batch built is in
[`docs/development-progress/`](../development-progress/); `FEATURE_INVENTORY.md` holds the 384
requirement rows themselves.

| Domain | Status | Built so far |
| --- | --- | --- |
| Website & marketing site | Mixed | 4 pages complete (home, pricing, demo, 404); nav, mega menus, pricing and seat calculator complete; 91 routes are honest in-development pages |
| Identity & onboarding | `UI skeleton` | Routes resolve; flows designed in `USER_JOURNEYS.md`, not built |
| Sales: leads, contacts, accounts | `Interactive mock complete` (core) | Lead list / detail / form / conversion; contact directory / detail / form / duplicate review; account list / Customer 360 / hierarchy / form |
| Sales: deals & pipeline | `Interactive mock complete` (core) | Board (drag **and** keyboard), list, detail, form, forecast |
| Sales productivity | `Interactive mock complete` (core) | My work / daily plan; calendar (day/week/month) with deterministic slot suggestions; tasks (six views, bulk actions); sequences with enrolments; playbooks; the goals route remains a placeholder |
| Unified communications | `Interactive mock complete` (core) | Omnichannel inbox queue and conversation detail with reply/internal note, star/snooze and a deterministic summary; the communications timeline merges activities and conversations; shared-inbox administration and saved replies remain planned |
| Marketing automation | `Interactive mock complete` | Campaign list/detail/calendar/form with derived metrics and local-only launch; segments with nested rules and stored preview; journeys with validation and a deterministic entry forecast; email templates with block toggling and local preview; landing pages (`demo_not_hosted` publish); forms with local submission; lead-source attribution |
| Customer support | `Interactive mock complete` (core) | Ticket queue (views, filters, KPIs) and ticket detail with thread, SLA panel, suggested articles and resolve/reopen/escalate; knowledge base list with a derived category view, and a structured article reader with publish/send-for-review and helpfulness voting |
| Customer success | `Interactive mock complete` | Health dashboard (distribution, churn risk, NRR, voice of customer), renewal board, onboarding board, business reviews, account success panel; playbooks with ordered steps and local-only application |
| Products & revenue operations | `Interactive mock complete` (core) | Product catalogue (Catalog / Price books / Categories) with detail and form; quote builder with inline line editing, live totals, approvals and revision history; orders with activation, payment recording and cancellation |
| Projects & delivery | `Interactive mock complete` | Portfolio (board + list) and detail with derived phases, deliverables, timeline, milestones and risks; delivery handoff checklist from a won deal |
| Field sales & territory | `Interactive mock complete` | Overview KPIs and coverage gaps; territories with inline editing; visit plans and logs with reordering and a simulated check-in (`gpsUsed` stays false) |
| Analytics & BI | `Interactive mock complete` | Cross-module overview (funnels, cohorts, win–loss, team performance) with chart-to-table on every visualisation; dashboards; report list, viewer and builder with browser-generated exports (`generatedLocally: true`) |
| Workflow automation | `Interactive mock complete` | Workflow list, detail with validation and deterministic simulation, run history; the canvas is an ordered step list, not a positioned canvas |
| AI assistant | `Interactive mock complete` | Deterministic workspace: conversation list, thread, cited record summaries, reviewable email drafts; every reply is `demo_template_engine`; no model call |
| Collaboration | Partial | Notification centre |
| Documents | Partial | Documents tab on the Customer 360 profile |
| Customization & custom objects | `Interactive mock complete` | Custom objects and field manager, page layouts with preview, saved views; validation rules read-only (no service exists) |
| Industry templates | `Interactive mock complete` | Gallery and detail with `previewChanges` (additions and conflicts); install/uninstall are simulated and say uninstall loses no user data |
| Partner relationship management | `Interactive mock complete` | Directory with tiers, partner detail with onboarding programme and certifications, conflict-advised deal registrations, referrals, a demo commission ledger with calculation notes |
| Customer self-service portal | `Interactive mock complete` (internal preview only) | Tickets (internal notes withheld), published help-centre articles, customer-visible project progress, appointments; no sign-in, no hosting, no write path |
| Organization administration | `Interactive mock complete` | `/app/settings/*`: company profile and branding, business units and teams, user directory, role and permission matrix, security policy and audit log, data management (import history, duplicate rules, retention, demo reset) and billing (plan, seats, add-ons, usage meters, invoice history, payment method). Batch 16 |
| Globalization & internationalization | `Interactive mock complete` (foundations) | 13 locales, Intl formatters, RTL architecture and three dictionaries |
| Multi-tenancy | Partial | Organization switcher, disjoint per-tenant datasets, entitlement-driven navigation |
| Subscriptions & billing | `Interactive mock complete` | Recurring-revenue report with a movement bridge that reconciles, retention, cohorts, plan/segment/region splits and top accounts; contracts with renew / amend / terminate; invoices with partial payment, mark-paid and void (Batch 17). The tenant's own platform subscription — plan, seats, add-ons, usage meters, invoice history — is under `/app/settings/billing` (Batch 16). No payment provider, no invoicing engine and no money movement: every record is labelled a CRM reference, not an accounting document |
| Platform-owner administration | `UI skeleton` | Shell and an honest landing page |
| Integration marketplace | `Planned` | — |
| Developer platform | `Planned` | — |
| Cross-cutting: accessibility, performance, testing | Partial | Strict types, linting (0 errors, 6 informational warnings), 170 automated tests (154 unit + 16 dom, including the first CRM screen tests), link integrity, dependency-group bundling, and a browser smoke pass recorded in `TEST_REPORT.md` — structural only from Batch 17, because this environment cannot dispatch pointer events |

**Nothing in the CRM is production-ready.** Every interactive screen runs against local
synthetic state. When the REST API arrives, each becomes `Backend integration pending` until
the integration is verified.

---

## 2. Website & marketing site

| ID range | Capability | Status | Notes |
| --- | --- | --- | --- |
| WS-001 | Homepage with all 21 required sections | **Interactive mock complete** | Sections 1–21 implemented: announcement bar, sticky nav, hero, value proposition, primary and secondary CTA, product preview, animated dashboard preview, benefits, module overview, pipeline demo, marketing demo, service demo, AI preview, industries, integrations, global capabilities, pricing preview, FAQ, final CTA, footer |
| WS-002 | Sticky navigation with mega menus | **Interactive mock complete** | 8 top-level items; 4 mega menus, 3 dropdowns, 1 direct link |
| WS-003 | Mobile navigation | **Interactive mock complete** | Trigger with `aria-expanded`; `<details>` accordions; body scroll lock; closes on resize to desktop and on Escape |
| WS-004 | Announcement banner | **Interactive mock complete** | Configurable, tone-aware, dismissible with persistence |
| WS-005 | Site footer | **Interactive mock complete** | 6 columns from configuration, honest-labelling block, locale switcher |
| WS-006 | Pricing page | **Interactive mock complete** | Interval toggle, seat slider with numeric entry, currency restatement, 5 plan cards, per-plan limit disclosure, 7 add-ons, guidance, 10-question FAQ |
| WS-007 | Seat calculator | **Interactive mock complete** | Local arithmetic, annual savings calculation, minimum-seat enforcement |
| WS-008 | Plan comparison matrix | **Interactive mock complete** | 55 rows, searchable, progressive disclosure, sticky first column |
| WS-009 | Public interactive demo | **Interactive mock complete** | 6 role scenarios, 8-step guided tour, "what is not real" section, reset control |
| WS-010 | Product interface preview | **Interactive mock complete** | Real design-system components, seeded deterministic data, no screenshot |
| WS-011 | 404 page | **Interactive mock complete** | Search form working without JavaScript, four suggestion columns, industry chips |
| WS-012 | Blog, guides, tutorials, webinars, library | UI skeleton | Routes resolve to the labelled in-development page |
| WS-013 | Help centre and documentation | UI skeleton | As above |
| WS-014 | Changelog, release notes, roadmap | UI skeleton | As above |
| WS-015 | 14 product landing pages | UI skeleton | Generic template pending; routes resolve honestly |
| WS-016 | 19 feature detail pages | UI skeleton | As above |
| WS-017 | 21 industry landing pages | UI skeleton | Configuration data for all 21 exists; page template pending |
| WS-018 | Solution pages by size, team and process | UI skeleton | 18 routes enumerated |
| WS-019 | Company pages | UI skeleton | 8 routes; placeholder content policy documented |
| WS-020 | Legal and trust pages | UI skeleton | 13 routes; each carries a "pending legal review" notice where required |
| WS-021 | Integration marketplace | UI skeleton | Route resolves; catalogue UI pending |
| WS-022 | Developer documentation and API reference | UI skeleton | Routes resolve |
| WS-023 | SEO foundations | **Complete** | Semantic HTML, unique titles, meta descriptions, canonical, Open Graph, Twitter card, sitemap, robots.txt, BreadcrumbList and FAQPage JSON-LD, hreflang, no invented ratings or offers |
| WS-024 | Localized URL structure | Partial | `hreflang` emitted for `en`, `ar`, `es`; locale-prefixed routes not yet generated |
| WS-025 | Contact sales and book-a-demo forms | UI skeleton | Routes resolve; forms pending |

---

## 3. Identity & onboarding

All 22 rows `UI skeleton` — routes resolve to the labelled in-development page. The intended
step sequences are specified in `USER_JOURNEYS.md` journeys 4 and 5.

Signup, sign in, forgot password, reset password, email verification, verification-pending,
invitation acceptance, trial signup, organization creation, company details, country,
timezone, currency, industry, team size, module selection, plan selection, onboarding
completion, Google and Microsoft sign-in options, and the 12-step onboarding wizard.

Every one of these must be labelled as simulated. No credential is transmitted, stored or
validated anywhere in this build.

---

## 4. CRM domains

This section records, for each CRM domain, what is built today and the foundations the
remaining work inherits. It does not repeat the 384 inventory rows.

### Built today (Batches 5–15)

| Domain | Interactive today | Reference |
| --- | --- | --- |
| Leads | List, detail, form, three-step conversion wizard | [`BATCH_05_REPORT.md`](../development-progress/BATCH_05_REPORT.md) |
| Deals | Board (drag and keyboard), list, detail, form, forecast | `BATCH_05_REPORT.md` |
| Activities | My work daily plan with completion and undo | `BATCH_05_REPORT.md` |
| Contacts | Directory, detail, form, duplicate review with field-level merge | [`BATCH_06_REPORT.md`](../development-progress/BATCH_06_REPORT.md) |
| Accounts | List, Customer 360 (health, revenue, hierarchy, buying committee, documents), form | `BATCH_06_REPORT.md` |
| Products | Catalogue (Catalog / Price books / Categories), detail (overview, pricing, deals), form | [`BATCH_07_REPORT.md`](../development-progress/BATCH_07_REPORT.md) |
| Quotes | List, builder with inline line editing and live totals, approvals, revision history, form | `BATCH_07_REPORT.md` |
| Orders | List, detail with activation, payment recording and cancellation | `BATCH_07_REPORT.md` |
| Support | Ticket queue (views, filters, KPIs) and ticket detail with thread, SLA panel, suggested articles, resolve/reopen/escalate | [`BATCH_08_REPORT.md`](../development-progress/BATCH_08_REPORT.md) |
| Knowledge base | Article list with a derived Categories view, and a structured article reader with publish/send-for-review and helpfulness voting | `BATCH_08_REPORT.md` |
| Inbox | Omnichannel queue and conversation detail with reply/internal note, star/snooze and a deterministic summary | `BATCH_08_REPORT.md` |
| Insights | Role-based home dashboards | `BATCH_05_REPORT.md` |
| Customer success | Dashboard (health distribution, churn risk, NRR, voice of customer), renewal board, onboarding board, business reviews, account success panel | [`BATCH_09_REPORT.md`](../development-progress/BATCH_09_REPORT.md) |
| Playbooks | List with purpose/state filters; detail with ordered steps (task-creating vs guidance) and local-only apply | `BATCH_09_REPORT.md` |
| Calendar & tasks | Day/week/month calendar with deterministic slot suggestions; tasks in six views with bulk actions | [`BATCH_10_REPORT.md`](../development-progress/BATCH_10_REPORT.md) |
| Sequences | List and detail with step timeline, enrol dialog, bulk pause/resume/remove | `BATCH_10_REPORT.md` |
| Communications | Unified timeline over activities and conversations, bucketed by channel | `BATCH_10_REPORT.md` |
| Analytics & reporting | Cross-module overview, dashboards, report list/viewer/builder with local exports | No standalone batch report; see [`TEST_REPORT.md`](../testing/TEST_REPORT.md) §8 |
| Workflows | List, detail with validation and deterministic simulation, run history | [`BATCH_12_REPORT.md`](../development-progress/BATCH_12_REPORT.md) |
| AI assistant | Deterministic workspace with cited summaries and reviewable drafts | `BATCH_12_REPORT.md` |
| Customization | Custom objects and fields, page layouts, saved views; validation rules read-only | [`BATCH_13_REPORT.md`](../development-progress/BATCH_13_REPORT.md) |
| Industry templates | Gallery and detail with `previewChanges`; simulated install/uninstall | `BATCH_13_REPORT.md` |
| Marketing | Campaigns, segments, journeys, email templates, landing pages, forms, lead sources | [`BATCH_14_REPORT.md`](../development-progress/BATCH_14_REPORT.md) |
| Projects | Portfolio and detail with derived phases, deliverables, timeline, milestones, risks | [`BATCH_15_REPORT.md`](../development-progress/BATCH_15_REPORT.md) |
| Field sales | Overview, territories, visit plans and logs with simulated check-in | `BATCH_15_REPORT.md` |
| Partners | Directory, detail, registrations, referrals, commissions | `BATCH_15_REPORT.md` |
| Portal preview | Tickets, help centre, project progress and appointments, internal preview only | `BATCH_15_REPORT.md` |
| Organization administration | `/app/settings/*`: profile, branding, business units, users, roles and matrix, security, audit, data, billing (plans, seats, add-ons, usage, invoices) | [`BATCH_16_REPORT.md`](../development-progress/BATCH_16_REPORT.md) |
| Contracts | List with status and expiring-window filters; detail with renew, amend and terminate dialogs and versioned amendment history | [`BATCH_17_REPORT.md`](../development-progress/BATCH_17_REPORT.md) |
| Invoices | List and detail with record payment, mark paid and void | `BATCH_17_REPORT.md` |
| Recurring revenue | KPI strip, reconciling MRR movement bridge, trend, plan / segment / region splits, top accounts, cohort grid | `BATCH_17_REPORT.md` |

Everything else in sections 4.1 through 4.28 of the inventory is `Planned` or, where a route
exists, an honest `ModulePlaceholder` (`UI skeleton`).

### Foundations each domain inherits

| Foundation | Where | Ready |
| --- | --- | --- |
| Domain types for every listed entity | `@crm/shared-types` | Yes — 16 modules, ~340 types |
| Service contract per domain | `@crm/shared-types/services` | Yes — 56 declared interfaces, 53 implemented in the mock container |
| Navigation entry, route, icon, persona defaults, entitlement key | `@crm/configuration/modules` | Yes — 28 modules across 10 sections |
| Navigation resolution by entitlement, permission and interface mode | `resolveNavigation()` | Yes |
| Component primitives | `@crm/ui` | Yes — ~48 components, plus `charts` and `kanban` |
| Design tokens including density and RTL | `@crm/design-tokens` | Yes |
| Honest-labelling vocabulary | `@crm/configuration/demo` | Yes — 18 canonical notices |
| Locale-aware formatters | `@crm/localization` | Yes |
| Synthetic dataset | `@crm/mock-services` | Yes — ~1,900 records, ~60 collections, 53 of 56 declared service modules implemented |

### Per-domain notes on the planned scope

| Domain | Notable requirements captured in the inventory |
| --- | --- |
| Leads | Explainable scoring with weighted factors, response-time SLA, duplicate review, guided conversion with a preview step, import wizard with validation-before-commit |
| Contacts & accounts | Customer 360, relationship graph, per-channel consent, buying-committee roles, parent-child hierarchy, revenue snapshot, health signals |
| Deals & pipeline | Multiple pipelines, weighted totals, required exit criteria, stale detection, forecast categories, accessible non-drag stage moves sharing one write path |
| Sales productivity | Daily plan, activity inbox, meeting preparation brief, sequences, playbooks, goals with pacing |
| Communications | Unified inbox across six channels, shared inboxes, assignment rules, SLA timers on conversations, saved replies, every send labelled simulated |
| Marketing | Nested-rule segments with live preview, block-based email builder, journey canvas with per-node statistics, landing pages, six attribution models, A/B testing |
| Support | Priority-based SLA targets with pause windows, escalation at a percentage of target, internal and public knowledge base with review dates, CSAT/NPS/CES |
| Customer success | Explainable health components, onboarding plans created by the deal-won workflow, renewal pipeline separate from new business, churn risk with playbooks |
| Products & revenue ops | Variants, bundles, recurring lines, multiple price books, quote builder with live totals, discount approval thresholds, revision history, revenue bridge, cohorts |
| Projects | Automatic handoff from a won deal, kanban and timeline, milestones with billing, risks, customer-visible status |
| Field sales | Territories, visit plans with route summaries, check-in that records a chosen label and never reads device coordinates, coverage gaps |
| Analytics | 11 role dashboards, report builder with grouped results and computed columns, chart-to-table on every visualisation, cohort and funnel analysis, forecast accuracy |
| Workflows | Visual canvas, validation that blocks activation, deterministic simulation against a sample record, execution history with retry |
| AI assistant | Deterministic engine, cited records, reviewable drafts, explicit provenance, permission-scoped reads, usage and credit dashboard |
| Collaboration | Feed, mentions, internal comments, shared notes, team spaces, announcements with acknowledgement |
| Documents | Folders, associations, version history, access presentation, signature workflow preview |
| Customization | Custom objects with 24 field types, formula editor with client-side evaluation, drag-and-drop layouts with live preview, conditional visibility, validation rules, saved views |
| Industry templates | 21 profiles with terminology substitution, extra objects, sample pipelines, representative workflows, install and uninstall with conflict preview |
| Partners | Directory with tiers, deal registration with conflict checking, referrals, commission statements |
| Customer portal | Branded self-service with tickets, knowledge, projects, documents, contracts, appointments |
| Organization admin | Company profile, branding editor, business units, teams, user directory, role and permission matrix with field-level controls, security policy, audit log, data management |
| Multi-tenancy | Organization switcher, disjoint datasets per tenant, workspace selection, seat allocation, entitlement-driven navigation |
| Subscriptions & billing | Plan comparison, change preview showing entitlements gained and lost, seat management, add-ons, usage meters, invoices, simulated checkout |
| Platform administration | Tenant directory and detail, plan editor, feature flags, module catalog, localization admin, announcements, audit, support queue, system status |
| Integrations | Catalogue by category with four availability states, connection wizard that requests no credentials, field mapping, sync health, delivery history |
| Developer platform | Scoped API keys with masked display, webhook endpoints with an event catalog and delivery history, request logs, documented endpoint reference |

---

## 5. Globalization

| Capability | Status | Notes |
| --- | --- | --- |
| Locale catalogue with honest completeness | **Interactive mock complete** | 13 locales, each declaring completeness percentage, quality tier and fallback chain |
| Intl-based formatters | **Interactive mock complete** | Dates, times, relative time, durations, numbers, currencies, percentages, phone, address, person names |
| RTL architecture | **Interactive mock complete** | Logical properties, `[dir='rtl']` variants, `logical` helper for JavaScript cases, text isolation |
| RTL translation dictionaries | **Interactive mock complete** | Arabic substantially complete; Dari and Pashto partial |
| Indian number grouping | **Interactive mock complete** | Explicit option, not automatic |
| Address field order by country | **Interactive mock complete** | Postal-code-first for JP, CN, KR, TW |
| Timezone, country, currency, fiscal-year option lists | **Interactive mock complete** | 37 timezones, 69 countries, 35 currencies, 12 fiscal months |
| Locale-prefixed routes | Planned | `hreflang` emitted; routing not generated |
| Regional compliance UI | Planned | Consent and privacy surfaces designed in the type model; screens pending |
| Translation completeness tracking screen | Planned | Data exists in the locale catalogue; the platform-admin screen is not built |

---

## 6. Cross-cutting requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| TypeScript strict mode, zero errors | **Complete** | `npx tsc -p …` clean for 6 packages + 3 apps |
| Internal link integrity | **Complete** | 15,093 / 15,093 resolved |
| Static rendering of the public site | **Complete** | 126 pages, 8.9 s |
| Selective hydration | **Complete** | 6 islands, every one with an explicit directive |
| Reduced motion (OS and in-app) | **Complete** | Two mechanisms in `tokens.css` |
| Keyboard operability of navigation | **Interactive mock complete** | Arrow keys, Escape with focus return, click-outside |
| Focus visibility | **Complete** | Two-layer ring, never removed |
| Density modes | **Complete** | One custom property; three modes |
| High-contrast mode | **Complete** | Token override, separate dark block |
| Theming without re-render | **Complete** | `data-*` attributes plus custom properties |
| Chart-to-table requirement | Contractual | `WidgetOptions.allowTableToggle` is required; the chart families implement it |
| Linting executed | **Complete** | 0 errors, 5 informational `react-hooks/incompatible-library` warnings |
| Automated tests | **Partial** | 170 (154 unit + 16 dom): mock services 151, design tokens 3, kanban 8, CRM screen dialogs 8. ~110 CRM screens and every end-to-end workflow are still uncovered — see `TEST_REPORT.md` |
| CRM browser smoke pass | **Complete** (manual probe) | 26 routes at 1280 px, 0 console errors on every route — `TEST_REPORT.md` §8 |
| Artifact-free of backend code | **Complete** | No `.php`, no migration, no ORM model, no server route in this repository |
| No real credentials anywhere | **Complete** | No secret, token or full API key is modelled in any type |
| No fake success messages | **Complete by construction** | `notify.simulated()` plus `simulated: true` literal types |

---

## 7. How to read this matrix honestly

Three points worth restating, because they are the ones most easily misread:

1. **`UI skeleton` is not "nearly done".** It means a route resolves to a page that states
   it is unfinished. The content, illustrations, forms and internal links are all still to
   be built. It exists so navigation is never broken, and it is excluded from search
   results.

2. **`Interactive mock complete` is not "production ready".** It means the frontend works
   against local synthetic state with the correct loading, empty, error and validation
   behaviour. When the REST API arrives, each of these features becomes
   `Backend integration pending` until the integration is verified.

3. **The `Planned` requirements are not an estimate of effort.** The inventory was written
   before any code existed, from the brief and from competitor research. Some of those
   requirements will merge, and a few will prove unnecessary once the CRM shell exists and
   real workflows can be walked through.
