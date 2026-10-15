# Project Status

**Last updated:** Batch 17 (subscription and SaaS administration) **verified** — 2026-10-15
**Product name:** provisional — `CRM Platform` (see [`branding.ts`](../../packages/configuration/src/branding.ts))
**Overall frontend completion:** approximately 55–60% of the feature inventory by weighted build
effort (an estimate — see [`FEATURE_MATRIX.md`](../feature-inventory/FEATURE_MATRIX.md) for the
row-level view)

> **Read this first.** This is a frontend-only deliverable. No backend, database,
> authentication service, payment provider, messaging provider or AI service is connected,
> and none is simulated in a way that claims a real-world effect occurred. Every such
> capability is either absent or explicitly labelled in the interface.

---

## 1. Status vocabulary

Used consistently in this document and in `FEATURE_MATRIX.md`:

| Status | Meaning |
| --- | --- |
| **Planned** | Specified in the inventory. No code. |
| **UI skeleton** | Route and layout exist; not interactive. |
| **Interactive mock complete** | Works end to end against the mock service layer, with loading, empty and error states. |
| **Tested** | Has automated coverage recorded in `TEST_REPORT.md`. |
| **Backend integration pending** | Frontend complete; awaiting the REST API. |

A feature is never marked production-functional on the basis of its frontend alone.

---

## 2. What exists and runs today

### 2.1 Monorepo and tooling — complete

| Item | State |
| --- | --- |
| npm workspaces monorepo | Complete |
| TypeScript strict mode across all packages | Complete; zero errors |
| ESLint flat config (typescript-eslint, react-hooks) | Complete; 0 errors, 6 informational warnings |
| Prettier with Astro plugin | Complete |
| Root scripts: `build`, `typecheck`, `lint`, `test`, `test:e2e`, `verify` | Complete |
| Dependency install | Complete |
| Vitest, split into a `unit` and a `dom` project | Complete |

### 2.2 Shared packages

| Package | State | Notes |
| --- | --- | --- |
| `@crm/design-tokens` | **Interactive mock complete** | OKLCH palette, 6 token layers, light/dark, 3 densities, high contrast, accent presets, Tailwind v4 bridge, and a unit test guarding the bridge against utility-name collisions |
| `@crm/ui` | **Interactive mock complete** | 8 component modules, ~48 components, plus the `charts` and `kanban` families and per-family subpath exports |
| `@crm/shared-types` | **Interactive mock complete** | 16 domain modules, ~340 exported types, 56 service interfaces |
| `@crm/configuration` | **Interactive mock complete** | Branding, 5 plans + 7 add-ons + 55-row comparison, 28-module registry, 21 industry profiles, site IA, demo policy |
| `@crm/localization` | **Interactive mock complete** | 13 locales, Intl formatters, RTL helpers, i18n factory. English complete; others tracked honestly. |
| `@crm/mock-services` | **Interactive mock complete (partial surface)** | Deterministic multi-tenant dataset (~1,900 records across ~60 collections), query engine, persistence with versioned reset, and **53 of 56 service modules** implemented — including the products / quotes / orders pricing engine, the 18 batches 9–15 modules (customer success, playbooks, sequences, exports, goals, layouts, industry templates, navigation, campaigns, segments, journeys, email templates, forms, landing pages, lead sources, projects, field sales, partners), the batch 16 administration modules (security, data, billing) and the batch 17 revenue modules (contracts, invoices, subscription revenue). The three remaining modules — `integrations`, `developer`, `platformAdmin` — keep their contracts so an unimplemented screen fails to compile. Note: earlier revisions of this document said “60 service modules”; the container declares 56 services and ~60 *collections*. |

### 2.3 Public website (`apps/website`)

**126 pages build successfully.** Static-rendered, 15,093 internal links verified, zero
broken links.

| Area | State |
| --- | --- |
| Base layout, SEO head, JSON-LD, hreflang, theme pre-paint script | **Interactive mock complete** |
| Sticky header with accessible mega menus + mobile navigation | **Interactive mock complete** |
| Announcement bar (dismissible, persisted) | **Interactive mock complete** |
| Footer with 6 configured columns and honest-labelling block | **Interactive mock complete** |
| Homepage — all 21 required sections | **Interactive mock complete** |
| Product interface preview (real components, seeded synthetic data) | **Interactive mock complete** |
| Public demo launcher (6 role scenarios) | **Interactive mock complete** |
| Demo page with guided tour and truthful "what is not real" section | **Interactive mock complete** |
| Pricing page: seat calculator, interval toggle, currency restatement, plan cards | **Interactive mock complete** |
| Full plan comparison matrix with search and progressive disclosure | **Interactive mock complete** |
| Pricing FAQ (10 questions, in configuration) | **Interactive mock complete** |
| 404 page with search and onward navigation | **Interactive mock complete** |
| `robots.txt` and generated sitemap | **Complete** |
| 91 further routes (product, feature, industry, solution, resource, company, legal, trust, auth) | **UI skeleton** — honest in-development page, `noindex`, with onward links |
| Brand assets | **Placeholder** — generated SVG mark, wordmark, favicon, social card |

### 2.4 CRM application (`apps/crm`)

**Substantially built.** Counted from `router.tsx`: **147** route entries carry an explicit
`path:` — 114 load a lazily-bundled screen, 25 render an honest placeholder for unbuilt deep
paths, and 8 redirect; plus the `/app` shell layout. Every screen runs against the mock service
layer with loading, empty, error and entitlement states.

| Area | State |
| --- | --- |
| Application shell, pre-paint theme/density/direction, error boundary | **Interactive mock complete** |
| Entitlement-resolved navigation, organization switcher, command palette, notification centre | **Interactive mock complete** |
| Role-based home dashboard with an editable widget layout | **Interactive mock complete** |
| Leads: list, detail, form, conversion wizard | **Interactive mock complete** |
| Deals: board, list, detail, form, forecast | **Interactive mock complete** |
| Contacts: directory, detail, form, duplicate review with field-level merge | **Interactive mock complete** |
| Accounts: list, Customer 360 detail (health, revenue, hierarchy, buying committee, documents), form | **Interactive mock complete** |
| Products: catalogue, price books, categories, detail (overview, pricing, deals), form | **Interactive mock complete** |
| Quotes: list, builder with inline line editing and live totals, approvals, revision history, form | **Interactive mock complete** |
| Orders: list, detail with activation, payment recording and cancellation | **Interactive mock complete** |
| Contracts: list with status and expiring-window filters, detail with renew / amend / terminate dialogs and versioned amendment history | **Interactive mock complete** — 18 seeded contracts for the Vertex tenant, 14 active, $4.6M active value, 4 expiring within 90 days, 50% auto-renew. Renewal writes a linked successor and closes the original; termination requires a reason; documents are metadata placeholders and signature state is labelled simulated |
| Invoices (`/app/subscriptions/invoices`): list, detail, record payment, mark paid, void | **Interactive mock complete** — 14 invoices, $240.9K outstanding of which one $79.4K record is genuinely past due; every amount is a CRM reference record, not an accounting document, and the screen says so |
| Recurring revenue: KPI strip, MRR movement bridge, trend, plan / segment / region splits, top accounts, cohort grid | **Interactive mock complete** — Opening $108.6K + $22.8K new + $5.5K expansion + $14.5K reactivation − $17.1K churn = Closing $134.3K, reconciled by test; headline metrics read live subscriptions only, and trend/cohort/segment/region are captioned as illustrative |
| Tickets: queue with views, filters and KPIs; detail with thread, SLA panel, suggested articles and resolve/reopen/escalate | **Interactive mock complete** |
| Knowledge base: article list with a derived category view; structured article reader with publish/send-for-review and voting | **Interactive mock complete** |
| Inbox: omnichannel queue and conversation detail with reply/internal note, star/snooze and a deterministic summary | **Interactive mock complete** |
| My work (daily plan) and the four boundary states | **Interactive mock complete** |
| Help centre | **Interactive mock complete** |
| Customer success: dashboard (health distribution, churn risk, NRR, voice of customer), renewal board, onboarding board, business reviews, account success panel | **Interactive mock complete** — `/app/customer-success` rendered 25 churn-risk rows and the health KPI strip; every score carries its components |
| Playbooks: list and detail with ordered steps (task-creating vs guidance), apply | **Interactive mock complete** — 8 seeded playbooks; applying creates local tasks and reports that nothing was emailed, scheduled or sent |
| Calendar, tasks, sequences and communications | **Interactive mock complete** — day/week/month calendar with deterministic slot suggestions; six task views with bulk actions; sequence list/detail with enrolments; the communications timeline renders ~50,000 characters of history |
| Analytics: cross-module overview (funnels, cohorts, win–loss, team performance), dashboards, report list, viewer and builder | **Interactive mock complete** — `/app/analytics` rendered 23 rows; exports are generated in the browser (`generatedLocally: true`) |
| Workflow automation: list, detail with validation and deterministic simulation, run history, new-workflow draft | **Interactive mock complete** |
| AI assistant: deterministic workspace, cited summaries, reviewable drafts | **Interactive mock complete** — every reply is labelled `demo_template_engine`; no model is called |
| Customization: custom objects and fields, page layouts, saved views; validation rules read-only | **Interactive mock complete** |
| Industry templates: gallery and detail with `previewChanges`, simulated install/uninstall | **Interactive mock complete** |
| Marketing automation: campaigns (list, detail, calendar, new), segments with nested rules, journeys with validation and forecast, email templates, landing pages, forms, lead sources | **Interactive mock complete** — campaigns 25 rows, segments 9, journeys 6, templates 18, lead sources 12 |
| Projects: portfolio and detail with derived phases, deliverables, timeline, milestones and risks; handoff checklist | **Interactive mock complete** |
| Partners: directory, detail, registrations, referrals, commissions | **Interactive mock complete** — 12 partners |
| Field sales: overview, territories, visit plans and logs with simulated check-in | **Interactive mock complete** |
| Customer portal preview: tickets, help centre, projects, appointments | **Interactive mock complete (preview only)** — no customer is signed in and there is no write path |
| Remaining placeholders: documents, goals, integrations, developer, administration and module sub-features | **UI skeleton** — 25 honest `ModulePlaceholder` routes naming the module and linking onward, each attached as a `/*` catch-all behind a real list/detail pair. Since Batch 17 the contracts and recurring-revenue catch-alls name what is built: the contract surfaces are the list and detail with renew, amend and terminate, and the revenue surfaces are the report and invoices. The `/app/settings/*` catch-all is one of them and now only catches unknown settings paths; every named settings surface is built. |

### 2.5 Platform administration (`apps/platform-admin`)

**Bootstrap + landing page.** The application shell builds and the page names the planned
console scope and links to what works, rather than presenting a dashboard of invented tenant
counts. The console itself is a later batch.

---

## 3. Batch-by-batch progress

The published batch order was reordered where shared prerequisites demanded it: the mock
service layer became an early batch because every CRM screen depends on it.

| Batch | Name | State |
| --- | --- | --- |
| 1 | Research and architecture | **Complete** |
| 2 | Design system | **Complete** |
| 3 | Public website foundation | **Complete** |
| 4 | Mock service layer, tooling and test coverage | **Complete** — [`BATCH_04_REPORT.md`](./BATCH_04_REPORT.md) |
| 5 | CRM shell and core screens (home, leads, deals, my work, boundaries) | **Complete** — [`BATCH_05_REPORT.md`](./BATCH_05_REPORT.md) |
| 6 | Contacts and accounts, and the bundle fix | **Complete** — [`BATCH_06_REPORT.md`](./BATCH_06_REPORT.md) |
| — | Website product, industry, resource and company pages | Partial — 4 pages complete, 91 honest in-development |
| 7 | Products, quotes and orders | **Complete** — [`BATCH_07_REPORT.md`](./BATCH_07_REPORT.md) |
| 8 | Service and support (tickets, knowledge base, omnichannel inbox) | **Complete** — [`BATCH_08_REPORT.md`](./BATCH_08_REPORT.md) |
| 9 | Customer success (health, renewals, onboarding, playbooks) | **Complete** — [`BATCH_09_REPORT.md`](./BATCH_09_REPORT.md) |
| 10 | Activities and unified communications (calendar, tasks, sequences, communications) | **Complete** — [`BATCH_10_REPORT.md`](./BATCH_10_REPORT.md) |
| 11 | Analytics and reporting (overview, dashboards, reports, local exports) | **Complete** — [`BATCH_11_REPORT.md`](./BATCH_11_REPORT.md) |
| 12 | Workflow automation and AI assistant | **Complete** — [`BATCH_12_REPORT.md`](./BATCH_12_REPORT.md) |
| 13 | Customization and industry templates | **Complete** — [`BATCH_13_REPORT.md`](./BATCH_13_REPORT.md) |
| 14 | Marketing automation | **Complete** — [`BATCH_14_REPORT.md`](./BATCH_14_REPORT.md) |
| 15 | Additional workspaces (projects, partners, field sales, portal) | **Complete** — [`BATCH_15_REPORT.md`](./BATCH_15_REPORT.md) |
| 16 | Tenant administration | **Complete** — implemented in the prior run, verified 2026-10-15; [`BATCH_16_REPORT.md`](./BATCH_16_REPORT.md) |
| 17 | Subscription and SaaS administration | **Complete** — [`BATCH_17_REPORT.md`](./BATCH_17_REPORT.md) |
| 18 | Platform-owner console | Not started |
| 19 | Integrations and developer experience | Not started |
| 20 | Globalization and responsive completion | Partial — architecture, tokens, locales, RTL helpers and 3 RTL dictionaries complete; verification pending |
| 21 | Final QA and release readiness | Not started |

---

## 4. Verified results

```
TypeScript check      PASS   6 packages + 3 apps, 0 errors (re-run at Batch 17)
Astro check           PASS   20 files, 0 errors, 0 warnings, 0 hints (carried from Batch 8; not re-run)
ESLint                PASS   0 errors, 6 warnings (informational) (re-run at Batch 17)
Vitest unit           PASS   154 / 154 tests across 4 files (was 143 / 4)
Vitest dom            PASS    16 /  16 tests across 3 files (was 8 / 1)
CRM build             PASS   0 chunks over 500 kB (largest: charts 430.11 kB, ui 316.18 kB,
                             mock-services 276.79 kB, mock-seed 224.98 kB, entry 67.11 kB)
Browser smoke         PARTIAL  5 new routes navigated, 0 console errors, all figures read from
                             the rendered DOM — but no interaction could be dispatched (§4 note)
Website build         PASS   126 pages (re-run at Batch 17)
Internal link check   PASS   15,093 / 15,093 resolved, 0 broken (carried from Batch 16; not re-run)
Platform-admin build  PASS   (re-built at Batch 17 as part of `npm run build`)
```

Typecheck, lint, both vitest projects, the CRM build, the website build and the platform-admin
build were re-run on 2026-10-15 for Batch 17. `astro check` and the link checker were not. The
Batch 17 pass found nine defects in shipped code — a cross-tenant revenue read, an invented
opening-MRR figure, cancelled subscriptions counted inside the run rate, hardcoded per-plan
churn, assumed LTV and payback presented as measurements, invoices falling due before they were
issued, a movement bridge with no churn to show, unsettled invoices sitting past their due date,
and screen tests that did not typecheck. All nine are fixed and re-measured; see
[`BATCH_17_REPORT.md`](./BATCH_17_REPORT.md) §7.

**The browser smoke run could not dispatch input.** The Qoder in-app browsing surface stays
hidden (`document.visibilityState === 'hidden'`), so Chromium delivers no pointer events; clicks
report success while nothing in the app responds, and `take_screenshot` fails with
`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`. This reproduced against dialogs shipped in earlier
batches, so it is an environment limit rather than a Batch 17 defect. Navigation, structure and
figures were verified in the browser; **every write path was verified instead by driving the
real dialogs with `userEvent` in jsdom**, which is why the `dom` project now covers `apps/crm`
screens. Real-browser interaction, dialog focus order and responsive behaviour remain unverified.

Reproduce with:

```bash
npm run typecheck
npm run lint
npx vitest run                       # both projects
npm run build
```

The browser smoke pass is a manual probe against the CRM dev server (routes navigated at
1280 px, numeric row/probe checks, console-error count), not a committed script. Playwright's
browsers are not installed in this environment, and the available in-app browser cannot dispatch
input, so the probe is limited to structural reads.

---

## 5. Documentation produced

| Document | State |
| --- | --- |
| `docs/competitor-analysis/COMPETITOR_MATRIX.md` | Complete — 61 capabilities × 11 platforms, every claim cited |
| `docs/feature-inventory/FEATURE_INVENTORY.md` | Complete — 384 requirement rows with IDs, priority, surface, persona, status |
| `docs/feature-inventory/FEATURE_MATRIX.md` | Complete — build-status view by requirement domain |
| `docs/architecture/INFORMATION_ARCHITECTURE.md` | Complete — navigation, personas, shortcuts, route conventions |
| `docs/architecture/SITEMAPS.md` | Complete — all three route maps |
| `docs/architecture/USER_JOURNEYS.md` | Complete — 15 journeys with edge cases |
| `docs/architecture/FRONTEND_ARCHITECTURE.md` | Complete — includes the CRM bundling strategy |
| `docs/design-system/DESIGN_SYSTEM.md` | Complete |
| `docs/api-contracts/API_CONTRACTS.md` | Complete |
| `docs/testing/TEST_REPORT.md` | Complete — updated for Batch 17 |
| `docs/development-progress/BATCH_01_TO_03_REPORT.md` | Complete |
| `docs/development-progress/BATCH_04_REPORT.md` | Complete |
| `docs/development-progress/BATCH_05_REPORT.md` | Complete |
| `docs/development-progress/BATCH_06_REPORT.md` | Complete |
| `docs/development-progress/BATCH_07_REPORT.md` | Complete |
| `docs/development-progress/BATCH_08_REPORT.md` | Complete |
| `docs/development-progress/BATCH_09_REPORT.md` | Complete |
| `docs/development-progress/BATCH_10_REPORT.md` | Complete |
| `docs/development-progress/BATCH_11_REPORT.md` | Complete — analytics and reporting |
| `docs/development-progress/BATCH_12_REPORT.md` | Complete |
| `docs/development-progress/BATCH_13_REPORT.md` | Complete |
| `docs/development-progress/BATCH_14_REPORT.md` | Complete |
| `docs/development-progress/BATCH_15_REPORT.md` | Complete |
| `docs/development-progress/BATCH_16_REPORT.md` | Complete — tenant administration |
| `docs/development-progress/BATCH_17_REPORT.md` | Complete — subscription and SaaS administration |

---

## 6. Known issues

### Functional

1. **25 CRM routes render an honest placeholder.** They resolve, name the real module and
   link onward — but they are not finished screens. Each sits behind a real list/detail pair as
   a `/*` catch-all. The remaining set is documents, goals, integrations, developer,
   administration and module sub-features (lead board/import/duplicates, pipeline
   configuration, queues, the campaigns catch-all, commissions, settings). Contracts and
   recurring revenue stopped being placeholders in Batch 17; their catch-alls now only catch
   deeper paths and say which surfaces are built. The service layer for many of them already
   exists.
2. **91 website routes render the honest in-development page.** Deliberate: the alternative
   was either 404s or placeholder pages presented as complete. Unchanged by batches 9–17.
3. **No authentication flows.** `/signin`, `/signup`, `/forgot-password`, `/reset-password`
   and `/verify-email` render the in-development page. The intended sequences are designed in
   `USER_JOURNEYS.md`.
4. **Legal and trust pages contain no legal text.** Each carries a visible "pending legal
   review" notice. Writing policy text without counsel would be worse than not writing it.
5. **3 of the 56 services the mock container declares are unimplemented** (`integrations`,
   `developer`, `platformAdmin`); 53 are implemented. Their screens are placeholders or absent;
   the container still declares the full target contract so a screen cannot quietly depend on a
   missing module.
6. **The support overview still aggregates across tenants.** `services.tickets.overview()` and
   `tickets.slaPolicies()` read the whole ticket collection (`ticketsInScope()` is
   `db.all('tickets')`), so the ticket KPI strip counts other tenants' tickets. The ticket
   *list* is correctly scoped, so the queue a user sees is right. This is pre-existing, and it
   was carried over as a Batch 9 scope item that did not ship: a test still records the
   unscoped behaviour rather than asserting it away. Fixing it means deciding whether the
   support overview is per-organization — a mock-layer decision (see
   [`BATCH_08_REPORT.md`](./BATCH_08_REPORT.md) §7 and §10).
7. **The journey canvas is an ordered step list, not a positioned canvas.** The node
   coordinates ship in the data, but a draggable, keyboard-editable canvas was not in the
   batch budget; the step list carries the validation and simulation results instead.
8. **No distinct email-template detail route.** `/app/campaigns/templates/:templateId` is not
   implemented; selection and block toggling happen inside the list screen.
9. **Campaign KPIs are page-scope.** There is no campaign overview aggregate endpoint, so the
   KPI strip covers the loaded page and says so.
10. **Validation rules are read-only.** No `validationRules` service exists, so the screen
    states that rules cannot be stored or enforced rather than offering an editor that would
    only simulate persistence.
11. **The revenue surfaces are deliberately narrower than the service contract.** Batch 17
    shipped `contracts.create`, `invoices.create` and `subscriptionRevenue.update` without
    screens, kept the expiring window as a list filter rather than a `/app/contracts/expiring`
    report, and left the contract `MiniStat` strip reading `products.revenueSummary()` — the
    pricing engine's aggregate of the same records — instead of a contracts-module endpoint.
    None of it fabricates an affordance: there is no button that pretends to create an invoice.

### Technical

12. **The `charts` chunk is 430.11 kB.** It is lazy, so only analytics pays for it, but Recharts
    is the largest dependency for the four chart shapes actually used.
13. **The `mock-services` bundle is split but still large:** `mock-services` 276.79 kB plus
    `mock-seed` 224.98 kB. The Batch 16 warning — 494.08 kB, 6 kB under Vite's 500 kB threshold,
    with the next service module crossing it — no longer applies, because the seed records build
    into their own chunk. Measured at Batch 17; the architecture doc carries the full table.
14. **No `axe` results or Lighthouse scores recorded.** The architecture targets WCAG 2.2 AA
    and Lighthouse 90+, but these are architectural claims, not measurements. Only one
    component-level axe smoke test exists (in the kanban suite, with layout/paint rules
    disabled under jsdom).
15. **No responsive overflow assertion** at the eight target widths. The kanban board's fixed
    17rem columns are the most likely source of overflow at 360px.
16. **Screen coverage exists for two CRM surfaces only.** `apps/crm/src/routes/contracts` and
    `routes/invoices` are covered by 8 component tests that drive the real dialogs, and vitest's
    `dom` project now includes `apps/crm/src/**/*.test.tsx`. The other ~110 screens still have
    no component or end-to-end tests; the batches 9–16 browser smoke pass is a manual probe
    recorded in `TEST_REPORT.md`, not an automated suite.
17. **Browser interaction cannot be verified in this environment.** The Qoder in-app browsing
    surface stays hidden, so Chromium dispatches no pointer events and screenshots fail; the
    probe is limited to navigation, accessibility snapshots and pure-expression script reads.
    Playwright is configured (`npm run test:e2e`) but its browsers are not installed. Real-browser
    interaction, dialog focus order and pointer-driven responsive behaviour are therefore
    unmeasured for every batch, and the Batch 17 write paths were verified in jsdom instead.
18. **The organization switcher reloads the page.** Correct for tenant isolation, but it
    would be better to reset the query cache properly once there is a cache to reset.
19. **No screenshot or visual regression testing.**

---

## 7. Decisions taken, and why

Where the brief left a detail unspecified, the choice and its rationale:

| Decision | Rationale |
| --- | --- |
| Base font size 14px in the CRM, larger on the website | An application is not an article. 14px fits materially more rows on a 1366px laptop, which is where sales and support teams work. |
| System font stack, no web font | Removes a render-blocking request and a layout shift, and avoids a third-party dependency for a core visual element. |
| OKLCH rather than hex | Perceptually uniform lightness, which makes dark mode derivable and keeps contrast consistent between themes. |
| Violet accent as the default | Distinct from the blue and orange used by the best-known CRM platforms, without being eccentric. Configurable per tenant. |
| Source-only workspace packages, no build step | Instant HMR across all three apps; no stale `dist/`. Trade-off documented in the architecture doc. |
| Three separate applications, not one | Incompatible optimisations and separate trust domains. Sharing tokens, types and configuration keeps them one product. |
| 91 website routes resolve to an honest in-development page | The brief forbids placeholder pages presented as complete *and* forbids hundreds of non-functional routes. An honest, `noindex`, navigable placeholder satisfies both constraints and keeps the link checker meaningful. |
| `DemoNotice` as a component | Makes honest labelling the path of least resistance rather than something to remember. |
| `StatusBadge` falls back to neutral | An unrecognised backend status must never render as green. |
| Charts require a table toggle in the type system | Chart accessibility stops being optional. |
| Demo/test datasets generated from a fixed seed | Server and client render identically, which prevents hydration mismatch and layout shift. |
| No AI, at all | A model call is out of scope. A deterministic engine labelled as such lets the interface, provenance and review flow be designed honestly. |
| `@crm/ui` exports per component family, and the CRM chunks by dependency group | Importing a button must not import a chart. Measured, not assumed: the index chunk fell from 758.60 kB to 55.00 kB. |
| Contact merge writes field values, then merges, and says what it did not do | Re-pointing related records is a backend operation. The screen performs the part the frontend genuinely owns and labels the rest rather than implying it happened. |
| The hierarchy walker guards against cycles | A malformed hierarchy is data, not a reason to crash. The reader defends itself; the generator is also fixed so the data is correct. |
| `STORAGE_VERSION` bumped when seed *content* changes | A returning reviewer must not keep a persisted dataset that is wrong rather than merely old. |
| React Compiler findings fixed, not suppressed | Every finding so far has been a genuine defect (wasted renders, stale clocks). Where the fix was a better API — `useWatch` over `watch` — it was taken. |
| The `--container-full` bridge key was removed rather than renamed | Tailwind v4's `--container-*` namespace feeds **both** `max-w-*` and `w-*`, so any `full` key silently overrides the built-in `w-full` and blows every `w-full` element out to 90 rem. The widest page container now references `max-w-[var(--w-full)]` directly, and a unit test fails if the collision returns. |
| Mojibake repaired with a general byte-level recovery, not a find-and-replace | The damage was double-encoded UTF-8 stored as cp1252. A signature-based replacement misses whole classes of characters; mapping each character back to its byte and strict-decoding runs as UTF-8 is reversible, audited, and idempotent. |
| Batch 8 is a screens batch — the services already existed | `tickets`, `knowledgeBase` and `conversations` were already implemented and seeded in the mock layer, so the batch added screens and tests rather than a service module; that is why the service-module count is unchanged at 30 of 60. |
| Support overview aggregates across tenants: recorded by a test, not fixed | The bug is pre-existing, and fixing it means deciding whether the support overview is meant to be per-organization — a mock-layer decision, not a screen one. The test documents the real behaviour so the gap stays visible rather than being silently accepted. |
| KB categories and the inbox/KB KPIs are derived client-side from a 200-item page rather than new service endpoints | Keeps the batch screen-only and avoids widening the service contract. The cost — a doubled read on those two routes, and possible undercounting if a tenant exceeds the page size — is stated on the screens and in the batch report. |
| Batches 9–15 add service modules only where the contract has no implementation | `sequences`, `exports`/`goals`, the customization extras, the seven marketing modules and the three workspace modules are new; Batch 12 built screens over `workflows` and `ai`, which already existed. The mock container states its subset explicitly, so an unimplemented screen fails to compile rather than to run. |
| The new service modules read the already-seeded collections | The 60-collection dataset already held projects, territories, partners, campaigns and the rest; only `playbooks` needed a new seed module. Deriving from one seed keeps a figure from disagreeing with itself across screens. |
| `DataTable` falls back to the row index when a row has no `id` | Derived summaries — the partner leaderboard (`partnerId`), territory performance (`territoryId`), coverage gaps (`accountId`) — have no `id` field; a stable index key renders them correctly, while tables over real records still pass their own `getRowId`. The empty-string fallback it replaced collapsed those rows onto one React key and produced duplicate-key errors on `/app/partners` and `/app/field-sales`. |
| Journey and workflow visualisations are step lists, not positioned canvases | A draggable canvas with keyboard-accessible node editing is a larger component than these batches budgeted; the ordered list carries the same validation, statistics and simulation results, and the node coordinates remain in the data for a future canvas. |
| Validation rules are read-only, not a simulated editor | No service can store or enforce a rule, so the screen states that rather than offering controls whose only effect would be a notification. |
| The revenue report derives opening MRR instead of assuming it | A bridge is the one figure on that screen a reader can add up by hand. Deriving `opening = closing − new − expansion − reactivation + contraction + churn` makes it reconcile by construction and by test; the previous `closing × 0.72` did not, and the discrepancy was visible in the shipped UI. |
| Live and churned subscriptions are disjoint sets | Including cancelled records in headline MRR *and* in churn double-counted the same money. Headline metrics now read live subscriptions only, and the card says so. |
| Assumed inputs are labelled as assumptions on the card, not hidden | LTV multiplies average revenue by an assumed lifetime and payback has no acquisition cost anywhere in this build. The numbers stay because the card shape needs one, but each hint names the assumption rather than implying measurement. |
| Seed content that contradicts itself gets a `STORAGE_VERSION` bump | Invoice dates running backwards, and unsettled invoices sitting past their due date, were both visible on the new screens. A returning reviewer must not keep a dataset that is wrong rather than merely old, so the version moved 3 → 4 → 5 with a changelog line each time. |
| One subscription is forced to churn in the seed | A movement bridge with an empty churn column demonstrates nothing, and 100% retention reads as a bug in the maths rather than a gap in the data. |
| Screen write paths are tested in jsdom because the browser cannot be driven | The in-app browsing surface delivers no pointer events, so `userEvent` against the real dialogs is the only way to prove renew / amend / terminate / pay / void do what the buttons say. Extending the `dom` project to `apps/crm` was the cheaper option than leaving the controls unverified. |

---

## 8. Next batch

**Batch 18 — platform-owner administration.** The last large reserved surface. The store already
seeds `platformPlans`, `platformAddOns`, `platformSubscriptions`, `platformInvoices`,
`platformUsers`, `platformRoles`, `platformAudit`, `platformSupportTickets`, `featureFlags`,
`moduleCatalog`, `localizationRows`, `systemStatus` and `maintenanceBanners`, and the
`PlatformAdminService` contract is fully declared, so the work is service-plus-screens: cross-tenant
overview, tenant provisioning and lifecycle, plan and add-on administration, feature flags, the
module catalogue, localization administration, platform audit, support tickets and system status.
It also gives the tenant billing screen's platform-side counterpart somewhere to live.

Scope:

1. **Implement `PlatformAdminService`** against the seeded `platform*` collections, replacing the
   `platformAdmin` entry in the container so the implemented-service count moves from 53 to 54.
2. **Screens** for the console, using the existing registry and shell, with loading, empty and
   error states.
3. **Honesty controls**: platform figures are seeded demonstration data; nothing here provisions a
   real tenant, and every simulated action says so.
4. **Exit criteria**: the console is navigable by section, no chunk exceeds 500 kB, and the
   verification pass stays green — run in the batch, not deferred, as the Batch 16 and Batch 17
   passes each showed what deferring hides.
