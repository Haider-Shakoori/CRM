# CRM Platform — Work Summary and Handoff

**Document purpose.** A single place that answers two questions: *what has been built so
far*, and *what is left*. Written to be read cold — no prior context required.

**Last updated:** after Batch 17 (subscription and SaaS administration) was implemented **and
verified** in the same session.
**Verification state:** Batches 1–17 are verified. Batch 16 was implemented unverified in an
earlier run; its deferred pass ran on 2026-10-15, found nine defects and fixed all of them.
Batch 17 ran its verification inside the batch and found nine more — see §5 and §7.

---

## 0. What this project is

A frontend-only, enterprise-grade, multi-tenant SaaS CRM demonstration, built as an
npm-workspaces monorepo. It contains three experiences:

| Surface | App | Purpose |
| --- | --- | --- |
| Public marketing website | `apps/website` | Astro + Tailwind. 126 built pages. |
| The CRM application | `apps/crm` | React + Vite + React Router. The main product surface. |
| Platform-owner console | `apps/platform-admin` | React + Vite. Currently a landing page only. |

**There is no backend, and none is faked.** No database, no server auth, no real OAuth, no
payment provider, no messaging provider, no telephony, no GPS, no e-signature, no real AI
model, and no production webhooks. Every such capability is either absent from the UI or
explicitly labelled in the interface. Synthetic data is generated deterministically from a
fixed dataset epoch so the demo is reproducible, and the honesty guarantees are enforced in
code (literal `simulated: true` / `origin: 'demo_template_engine'` /
`hostingState: 'demo_not_hosted'` types) rather than only in copy.

---

## 1. Where the build stands

| Batch | Name | State |
| --- | --- | --- |
| 1 | Research and architecture | **Complete** |
| 2 | Design system | **Complete** |
| 3 | Public website foundation | **Complete** |
| 4 | Mock service layer, tooling and test coverage | **Complete** |
| 5 | CRM shell and core screens | **Complete** |
| 6 | Contacts and accounts (+ bundle fix) | **Complete** |
| 7 | Products, quotes and orders | **Complete** |
| 8 | Service and support (tickets, knowledge base, inbox) | **Complete** |
| 9 | Customer success | **Complete** |
| 10 | Activities and unified communications | **Complete** |
| 11 | Analytics and reporting | **Complete** |
| 12 | Workflow automation and AI assistant | **Complete** |
| 13 | Customization and industry templates | **Complete** |
| 14 | Marketing automation | **Complete** |
| 15 | Additional workspaces (projects, partners, field sales, portal) | **Complete** |
| 16 | Tenant administration | **Complete** — verified 2026-10-15 |
| 17 | Subscription and SaaS administration | **Complete** — verified 2026-10-15 |
| 18 | Platform-owner console | **Not started** |
| 19 | Integrations and developer experience | **Not started** |
| 20 | Globalization and responsive completion | **Partial** — architecture, tokens, 13 locales and RTL helpers exist; the completion pass is outstanding |
| 21 | Final QA and release readiness | **Not started** |
| — | Website product / industry / resource / company pages | **Partial** — 4 pages complete, 91 honest in-development pages |

**Headline numbers**

| Measure | Value |
| --- | --- |
| Service modules implemented | **53 of 56** |
| CRM routes | **114 real screens**, 25 honest placeholders, 8 redirects (147 path-bearing route objects, counted from `router.tsx`) |
| CRM screens | 27 route modules in `apps/crm/src/routes` |
| Automated tests (verified 2026-10-15) | **170** — 154 unit + 16 DOM, 7 files |
| CRM production build | 0 chunks over 500 kB (largest `charts` 430.11 kB; `mock-services` 276.79 kB + `mock-seed` 224.98 kB) |
| Website | 126 pages, 15,093 internal links, 0 broken (link check last re-run at Batch 16) |
| Overall completion | ~55–65% of the feature inventory by weighted effort (estimate) |

> **Correction worth noting:** earlier documentation said "60 service modules" and "60
> service interfaces". The service container actually declares **56** services; ~60 is the
> number of seeded *collections* in the mock store. The figures above use 56.

---

## 2. Repository shape

```
D:\Projects\CRM
├─ apps/
│  ├─ website/          Astro + Tailwind           (126 built pages)
│  ├─ crm/              React + Vite               (the product)
│  └─ platform-admin/   React + Vite               (landing page only)
├─ packages/
│  ├─ design-tokens/    OKLCH tokens, 6 layers, density, accents  (@crm/design-tokens)
│  ├─ ui/               ~48 components + charts + kanban          (@crm/ui)
│  ├─ shared-types/     16 domain modules, ~340 types, 56 services(@crm/shared-types)
│  ├─ configuration/    branding, plans, modules, industries, IA  (@crm/configuration)
│  ├─ localization/     13 locales, Intl formatters, RTL helpers  (@crm/localization)
│  └─ mock-services/    the deterministic in-browser backend      (@crm/mock-services)
├─ docs/                see §9
├─ scripts/             check-links.mjs and friends
└─ vitest.config.ts     two projects: `unit` (node) and `dom` (jsdom)
```

Shared packages are **source-only**: their `exports` point at `./src/*.ts` with no build
step. Every app that styles shared UI must therefore declare
`@source '../../../packages/ui/src';` in its stylesheet, or Tailwind v4 will not emit the
shared component classes.

---

## 3. What is built, by surface

### 3.1 Foundations and tooling — complete

npm workspaces; TypeScript strict (including `noUncheckedIndexedAccess`) across all
packages; ESLint flat config; Prettier with the Astro plugin; root scripts `build`,
`typecheck`, `lint`, `test`, `test:e2e`, `verify`; Vitest split into a `unit` project
(node) and a `dom` project (jsdom + Testing Library + vitest-axe).

The design system provides an OKLCH palette, six token layers, light/dark, three densities
driven by a single `--density-factor`, high-contrast mode, seven accent presets, and a unit
test that guards the Tailwind v4 token bridge against utility-name collisions.

### 3.2 Public website (`apps/website`) — 126 pages

Built and complete: base layout, SEO head, JSON-LD, hreflang, pre-paint theme script;
sticky header with accessible mega menus and mobile navigation; dismissible announcement
bar; six-column footer with an honest-labelling block; the full 21-section homepage; a
product-interface preview using real components against seeded data; the public demo
launcher with six role scenarios; the demo page with a guided tour and a truthful "what is
not real" section; the pricing page (seat calculator, interval toggle, currency
restatement, plan cards); the full plan-comparison matrix; the pricing FAQ; the 404 page;
`robots.txt` and a generated sitemap.

**Remaining on the website:** 91 routes render an honest, labelled, `noindex`
in-development page (product, feature, industry, solution, resource, company, legal, trust
and auth areas), and the brand assets are generated placeholders. The website track is
deliberately unnumbered and runs in parallel with the batch roadmap.

### 3.3 CRM application (`apps/crm`) — the main surface

Complete and interactive: the application shell (pre-paint theme/density/direction, error
boundary), entitlement-resolved navigation, organization switcher, command palette,
notification centre, the role-based home dashboard with editable widget layout, the four
boundary states, and the help centre.

Fully built modules:

- **Sales:** leads (list, detail, form, conversion wizard), deals (board, list, detail,
  form, forecast), contacts (directory, detail, form, duplicate review with field-level
  merge), accounts (list, Customer 360 detail, form).
- **Revenue:** products (catalogue, price books, categories, detail, form), quotes (builder
  with inline line editing and live totals, approvals, revision history, form), orders
  (list, detail, activation, payment recording, cancellation), contracts (list with status
  and expiring-window filters, detail with renew / amend / terminate dialogs and versioned
  amendment history), invoices (list, detail, record payment, mark paid, void) and the
  recurring-revenue report (reconciling MRR bridge, retention, cohorts, plan/segment/region
  splits, top accounts).
- **Service and support:** tickets (queue with views/filters/KPIs; detail with thread, SLA
  panel, suggested articles, resolve/reopen/escalate), knowledge base (article list with
  derived category view; structured reader with publish/send-for-review and voting), inbox
  (omnichannel queue; conversation detail with reply/internal note, star/snooze, deterministic
  summary).
- **Customer success:** health dashboard (weighted, explainable scores; churn-risk list),
  renewal board (kept separate from new business), onboarding board, business reviews,
  account success panel, and playbooks with ordered steps.
- **Engagement:** calendar (day/week/month with deterministic slot suggestions), tasks (six
  views, bulk actions), sequences (list/detail with enrolments, simulated sends),
  communications (unified cross-channel timeline over activities and conversations).
- **Insight:** analytics overview (funnels, cohort retention, win–loss by reason, team
  performance, retention strip), dashboards (with a chart-to-table switch on every widget),
  reports (list, viewer, builder), and browser-local exports.
- **Automation and AI:** workflow list, detail/editor with validation before enabling,
  deterministic simulation against a sample record, run history; AI workspace with cited
  summaries, review-before-send drafts, lead-scoring explanation, forecast commentary and a
  natural-language report builder — every reply stamped `demo_template_engine`.
- **Customization:** custom objects and fields, page-layout editor with live preview,
  saved views, industry-template gallery with pre-install preview (validation rules are
  read-only; see §6).
- **Marketing:** campaigns (list, detail, calendar, draft form), segments with nested rule
  builder and member preview, journeys with validation and enrolment forecast, email
  templates with a block editor and local preview, landing pages, capture forms with local
  submission, and lead-source attribution.
- **Delivery workspaces:** projects (portfolio and detail with derived phases, deliverables,
  timeline, milestones, risks, handoff checklist), partners (directory, detail, deal
  registrations, referrals, commissions), field sales (overview, territories, visit plans
  and logs with simulated check-in, coverage gaps), and the customer-portal preview.

**Batch 16 adds** the administration surface: organization profile and branding, business
units and teams, the user directory, the role and permission matrix, security policy and
audit log, data management (import/export history, duplicate rules, retention, demo reset)
and billing (plan, seats, add-ons, usage meters, invoice history). These screens are wired and
were verified on 2026-10-15; the four defects that pass found in this surface are in §7.

**Batch 17 adds** the subscription and SaaS surface: the `contracts` and `invoices` service
modules with real lifecycle writes (renew links a successor and closes the original, amendments
are versioned and re-derive the annualised value, termination requires a reason and blocks
further lifecycle actions; invoices settle through mark-paid, partial payment or void), the
recurring-revenue report over `subscriptionRevenue`, and the screens for contracts (list with an
expiring-window filter, detail with three dialogs), invoices (list and detail with three dialogs)
and the revenue report. Verification ran inside the batch and found nine defects — see §7.

**Still placeholders:** documents, goals, integrations, developer, administration and the
remaining module sub-features — 25 honest `ModulePlaceholder` routes that name the real module
and link onward. Since Batch 17, the contracts and recurring-revenue catch-alls only catch
deeper paths and state which surfaces are built; `/app/subscriptions/commissions` is one of them.

### 3.4 Platform administration (`apps/platform-admin`)

Bootstrap plus a landing page. The app builds and the page names the planned console scope
and links to what works, rather than presenting a dashboard of invented tenant counts. The
console itself is Batch 18.

### 3.5 Mock service layer (`packages/mock-services`)

A deterministic in-browser backend: a query engine, tenant-partitioned collections,
`localStorage` persistence with a versioned reset, and ~1,900 seeded records across ~60
collections for three tenants with genuinely different configuration.

**53 of 56 service modules are implemented.** The three outstanding modules are exactly the
remaining roadmap batches:

| Missing service | Belongs to |
| --- | --- |
| `platformAdmin` | Batch 18 |
| `integrations`, `developer` | Batch 19 |

Because the container is typed as a documented subset, a screen that needs a module the
mock does not provide **fails to compile** rather than silently receiving an object whose
methods return nothing.

---

## 4. Data and honesty model (do not break these)

- **Determinism.** All synthetic data derives from a fixed `DATASET_EPOCH`
  (`2026-10-13T09:00:00.000Z`) with per-tenant seeds. No `Math.random()` anywhere. Two
  builds produce identical content, which is what makes tests, screenshots and SSR safe.
- **Tenancy is a UI demonstration, not a security boundary.** Collections carry an
  `organizationId` and reads filter on it. The code says so, so nobody mistakes the shape
  for a guarantee. Switching organization performs a full page reload.
- **Honest labelling is enforced in types**, not just in sentences: `simulated: true`,
  `origin: 'demo_template_engine'`, `documentKind: 'crm_reference_only'`,
  `hostingState: 'demo_not_hosted'`, `generatedLocally: true`. Simulated actions go through
  `notify.simulated()` and `<DemoNotice>`.
- **No invented prices presented as offers**, no claimed certifications or compliance, no
  fabricated testimonials, and no fake success messages for integrations that do not exist.
- **Every visible control either performs its advertised action or states that it is
  unavailable.**

---

## 5. Verification state

**Everything below was measured on 2026-10-15, on the Batch 17 code base** (documented in
`docs/testing/TEST_REPORT.md`; per-batch detail in
`docs/development-progress/BATCH_17_REPORT.md` §6–§8):

```
TypeScript check      PASS   6 packages + 3 apps, 0 errors
Astro check           PASS   20 files, 0 errors / 0 warnings / 0 hints   [carried from Batch 8 — not re-run]
ESLint                PASS   0 errors, 6 warnings (informational)
Vitest unit           PASS   154 / 154  (4 files)
Vitest dom            PASS    16 /  16  (3 files)
Website build         PASS   126 pages
Internal link check   PASS   15,093 / 15,093 resolved, 0 broken          [re-run at Batch 16 — not re-run for 17]
CRM build             PASS   0 chunks over 500 kB (max: charts 430.11 kB; mock-services 276.79 kB + mock-seed 224.98 kB)
Platform-admin build  PASS   rebuilt as part of `npm run build`
Browser smoke         PARTIAL  5 new routes, 0 console errors, all figures read from the rendered DOM —
                             no interaction could be dispatched (see the note below)
```

Batch 16 was implemented unverified in an earlier run and needed a deferred consolidated pass;
Batch 17 ran its verification inside the batch. **It did not start green either** — the shipped
code, not the tests, contained nine defects: a revenue read that crossed tenants, an invented
opening-MRR figure that made the movement bridge fail to sum, cancelled subscriptions counted
inside the run rate they were also being churned out of, hardcoded per-plan churn percentages,
assumed LTV and payback presented as measurements, invoices falling due before they were issued,
a bridge with no churn in the dataset to show, unsettled invoices sitting months past their due
date, and screen tests that did not typecheck under the app's own `tsc` run. All nine are fixed
and every row above was re-measured afterwards.

The standing rule holds: **run the pass inside the batch that changes code, not at the end.**
The commands are unchanged:

```bash
npm run typecheck                                   # 6 packages + 3 apps
npm run lint
npx vitest run                                      # both projects
npm run build                                       # website, CRM, platform-admin
```

…followed by a browser smoke test of the new routes — numeric probes and console-error counts
rather than screenshots. **The smoke step is currently limited to structural reads in this
environment:** the Qoder in-app browsing surface stays hidden (`visibilityState: 'hidden'`), so
Chromium dispatches no pointer events, clicks report success without reaching React, and
`take_screenshot` fails with `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`. Navigation, accessibility
snapshots and pure-expression script evaluation still work, and the limitation reproduced against
dialogs shipped in earlier batches, so it is environmental. Playwright's browsers are not
installed. Consequence for Batch 17: **every write path was verified by driving the real dialogs
with `userEvent` in jsdom** rather than in a browser, and real-browser interaction, dialog focus
order and pointer-driven responsive behaviour remain unmeasured.

---

## 6. What remains

### Batch 17 — Subscription and SaaS administration — complete

Implemented and verified 2026-10-15: the `contracts` and `invoices` service modules, the
contracts list/detail screens with renew, amend and terminate, the invoice list/detail screens
with record payment, mark paid and void, the recurring-revenue report over `subscriptionRevenue`,
and the replacement of the contracts and subscriptions placeholders. The tenant's own platform
subscription administration (plan, seats, add-ons, usage) was already shipped in the Batch 16
billing settings surface, so this batch did not duplicate it. See
`docs/development-progress/BATCH_17_REPORT.md`.

### Batch 18 — Platform-owner console (`apps/platform-admin`)

- Implement the `platformAdmin` service module.
- Build the console: tenant directory and detail, provisioning and suspension, plan and
  module assignment, platform-level metrics, feature flags, and a support/impersonation
  flow that is explicitly labelled as a demonstration.
- This is the only batch that lives in the third app, which is currently a landing page.

### Batch 19 — Integrations and developer experience

- Implement the `integrations` and `developer` service modules.
- Screens: an integration marketplace browsable by category with **honest availability
  labels** (available / requires backend / not implemented), a guided connection wizard that
  requests nothing, field mapping, and sync health; a developer platform with scoped API
  keys, webhook endpoints plus an event catalogue and delivery history, request logs, and a
  documented endpoint reference.
- Replace the `integrations` and `developer` placeholders.

### Batch 20 — Globalization and responsive completion

- Complete the RTL pass end to end (the tokens, helpers and three RTL dictionaries exist).
- Finish locale coverage honestly: 13 locales are declared; English is complete and the
  others are tracked as partial rather than claimed as done.
- Responsive completion across CRM screens at mobile/tablet widths, compact and comfortable
  density, and high-contrast mode.
- An axe accessibility audit and a Lighthouse pass on the website and the CRM.
- Optionally, convert the 91 honest in-development website routes into real pages.

### Batch 21 — Final QA and release readiness

- The full verification suite above, run green, with results recorded in
  `docs/testing/TEST_REPORT.md`.
- Final documentation pass; brand-asset and naming placeholder review; removal of stray
  artifacts (**note: `quote-new-form.png` is a leftover screenshot at the repo root and
  should be deleted**).
- An honest release-readiness statement: what is demonstrable, what is simulated, and what
  would need a backend.

### Accepted gaps carried forward

1. **`tickets.overview()` and `tickets.slaPolicies()` aggregate across tenants.** The ticket
   *list* is correctly organization-scoped, but those two aggregates are not. This is
   pre-existing behaviour recorded by a test with a comment; it is not fixed.
2. **The journey view is an accessible step list, not a positioned canvas.** Node
   coordinates ship in the data; the canvas is a larger component than was budgeted.
3. **No distinct industry-template detail route** — selection happens inside the list.
4. **Campaign KPIs are page-scope**, and there is no campaign overview aggregate endpoint.
5. **Validation rules are read-only** — there is no validation-rules service.
6. **`/app/goals` is a placeholder** even though the `goals` service is implemented and tested.
7. **Report scheduling and exports are records, not artefacts** — an export request creates
   a local record and reports a row count; no file is generated.

---

## 7. Defects found and fixed (so they are not reintroduced)

| Defect | Resolution |
| --- | --- |
| Tailwind v4 `--container-*` namespacing made `--container-full` override the built-in `w-full` | The bridge key was **removed**, not renamed. A guard test in `packages/design-tokens` fails if the collision returns. |
| Mojibake in 26 files (246 replacements) | Repaired with a general byte-level recovery (cp1252 byte map → strict UTF-8 decode), idempotent. |
| `DataTable` defaulted `getRowId` to `String(row.id ?? '')`, so any table over pre-aggregated rows with no `id` collapsed every row onto the empty-string React key | Fixed at source: the default falls back to the row index and the prop type accepts an index. |
| A duplicate `SequenceDetail` export, a conditional `useMemo`, a set-state-in-effect, a render-time `Date.now()`, an uncontrolled `Select`, and a malformed funnel row | All found by the consolidated pass and fixed. |
| A claimed-but-missing `BATCH_11_REPORT.md` | Authored and the two references corrected. |
| **Batch 16:** `roles.fieldMatrix()` read `customFields` and `roles` across **all** tenants, so the settings role matrix listed another organization's fields — and collapsed them onto duplicate React keys | Both reads go through `tenantRecords`. Rows 24 → 12 for the active tenant. A unit test cannot see this: every test run has one active organization. |
| **Batch 16:** the header "Change plan" button opened its dialog without seeding seats, so `Number('') === 0` and the preview priced Enterprise at the platform fee alone | The button seeds the current seats and billing interval, and `previewPlanChange` refuses fewer than one seat with a typed field error, the way `updateSeats` already did. |
| **Batch 16:** `plan-enterprise` grants `moduleKeys: ['*']` and nothing expanded it. The preview showed "Entitlements gained: `*`" and listed all 26 modules the tenant held as **lost**; the Plans tab read "1 modules" | `expandModuleKeys()` in `administration.ts:1389` expands the wildcard over catalog ∪ plan ∪ add-on keys, used by `previewPlanChange` and `entitlements()`. Note that the module **catalog is not the universe** — six keys plans grant (`activities`, `calendar`, `knowledge_base`, `orders`, `documents`, `billing`) are not catalog entries, hence the union. Two contract tests pin it. |
| **Batch 16:** usage meters had no tenant field, so `billing.usage()` matched them by id prefix | `UsageMeter` carries `organizationId`, the seed stamps it, the read filters on it, and `STORAGE_VERSION` moved to **3** because persisted v2 stores lack the field and are discarded rather than half-read. |
| **Batch 16:** both settings `useForm` calls omitted `defaultValues`, producing seven React uncontrolled→controlled warnings | Defaults added to both forms. |
| **Batch 17:** `subscriptionRevenue.list()` and `.report()` read the whole `revenueSubscriptions` collection, so one tenant's revenue report included the others' | Both go through `tenantRecords`, like the batch 9–16 modules. Same root cause as the Batch 16 role-matrix defect, and again invisible to a single-tenant unit test. |
| **Batch 17:** the MRR bridge invented its opening figure (`closing × 0.72`), so the columns did not sum to the closing total the same screen displayed | Opening MRR is derived from closing and the movements, and a test recomputes every column independently and asserts `bridge[0] + Σ movements === closing`. Measured before the fix: $109K + $42.8K − $1.8K − $60.5K against a $151.4K headline. |
| **Batch 17:** headline MRR counted `cancelled` subscriptions while a separate churn figure counted them again | Live and churned sets are now disjoint; MRR, ARR, ARPA, LTV, logo retention and top accounts read live only, and the MRR card says "live subscriptions only". |
| **Batch 17:** per-plan churn was hardcoded (2.1 / 4.8 / 9.2%) and LTV/payback were shown as metrics though both depend on inputs this build does not hold | Churn is derived from each plan's records. LTV reads "× an assumed 34-month lifetime" and payback "Assumed input — no acquisition cost is recorded in this build". |
| **Batch 17:** invoice dates were drawn independently, so the list showed invoices due before they were issued, and an `overdue` invoice could sit inside its due date | Dates derive from one another and the window is chosen by status: settled anywhere in the last six months, overdue back-dated past due, unsettled-and-not-overdue dated so the due date has not arrived. `STORAGE_VERSION` moved **3 → 4 → 5**, and a test asserts both directions. |
| **Batch 17:** the dataset could seed zero churned subscriptions, leaving the movement bridge's churn column empty and retention at a suspicious 100% | One subscription is forced to `cancelled` with a `churn` movement and a reason. |
| **Batch 17:** the new screen tests failed the app's own `tsc` run — `toBeInTheDocument` was unknown because `vitest.setup.ts` is outside that project, and two files carried an unused `React` import | `apps/crm/src/vitest-matchers.d.ts` references the jest-dom matcher types, mirroring `packages/ui/src/vitest-matchers.d.ts`; dead imports removed. |

---

## 8. Conventions to preserve

These exist because something broke without them:

1. **No dynamic Tailwind class names.** Visual-state classes must be literal strings.
   Conditional class *values* go through `cn(...)` with complete literals.
2. **Token utilities, not raw colours:** `bg-surface`, `bg-raised`, `bg-inset`, `bg-hover`,
   `bg-sunken`, `tone-{violet,teal,amber,green,red,blue,slate}` and their `-bg` variants,
   plus `success-fg`/`warning-fg`/`danger-fg`/`info-fg`.
3. **`@source '../../../packages/ui/src';`** must stay in every app stylesheet.
4. **Services are reached only through `ServiceProvider`** (`useServices`, `useAsync`,
   `useList`, `useMutation`). No screen imports `@crm/mock-services` directly, so swapping
   the mock for Laravel is a change to one file.
5. **Loading is derived, not stored**, inside `useAsync`/`useList`. Do not add a
   `setLoading(true)` effect; the React Compiler linter rejects synchronous set-state in
   effects, and it is right to.
6. **`useMutation` unwraps `Result`**, so `onSuccess(result.data, input)`. Its pending flag
   is `pending`, not `loading`.
7. **A service module that is not implemented must stay out of the container** so the
   consuming screen fails to compile.
8. **`write` to a collection goes through `db.transaction` / `createCrud`**; reads use
   `runQuery` and the existing tenancy-scoping helpers. Never add collections to the store
   without checking it first — most already exist.
9. **Batch reports are the authoritative per-batch record.** `FEATURE_MATRIX.md` §1 is an
   honest domain-level snapshot, not a per-batch ledger.
10. **Documentation states measured values only.** If something was not run, say so.

---

## 9. Documentation map

| Document | What it holds |
| --- | --- |
| `docs/development-progress/WORK_SUMMARY.md` | **This file** — the whole-project handoff |
| `docs/development-progress/PROJECT_STATUS.md` | Canonical status: per-surface state, verified results, known issues, next batch |
| `docs/development-progress/BATCH_01_TO_03_REPORT.md` … `BATCH_17_REPORT.md` | One report per batch, 12 sections each. Each is the authoritative record for its batch. |
| `docs/testing/TEST_REPORT.md` | Test counts, what is covered, browser-smoke evidence, bundle sizes, defects |
| `docs/feature-inventory/FEATURE_MATRIX.md` | Requirement domains against build status |
| `docs/feature-inventory/FEATURE_INVENTORY.md` | 384 requirement rows with IDs, priority, surface, persona, status |
| `docs/architecture/FRONTEND_ARCHITECTURE.md` | Package layout, bundling strategy, service-module groups, the `DataTable` contract |
| `docs/architecture/INFORMATION_ARCHITECTURE.md`, `SITEMAPS.md`, `USER_JOURNEYS.md` | Navigation, personas, shortcuts, all three route maps, 15 journeys |
| `docs/design-system/DESIGN_SYSTEM.md` | Tokens, components, density, accessibility rules |
| `docs/api-contracts/API_CONTRACTS.md` | The service contracts a real backend would implement |
| `docs/competitor-analysis/COMPETITOR_MATRIX.md` | 61 capabilities × 11 platforms, every claim cited |

---

## 10. Running it

```bash
npm install                 # once
npm run dev                 # workspace dev servers
npm run typecheck           # 6 packages + 3 apps
npm run lint
npx vitest run              # unit + dom
npm run build               # website + apps
```

Deterministic fixtures reset from the app's own controls; mock data lives in
`localStorage` under `crm.mockdb.v1`, so clearing it restores the seeded baseline without
touching theme, density or locale preferences. The key name is fixed; the payload carries a
separate `STORAGE_VERSION` (`packages/mock-services/src/lib/store.ts:33`, currently **3**,
bumped when `UsageMeter` gained `organizationId`). A stored payload at any other version is
discarded and reseeded rather than read half-populated — so changing a seeded record's *shape*
means bumping that version in the same change.
