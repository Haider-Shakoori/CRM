# Frontend Architecture

**Project:** Multi-tenant SaaS CRM platform — frontend only
**Document status:** current as of Batch 15
**Product name:** provisional (`CRM Platform`). See [`branding.ts`](../../packages/configuration/src/branding.ts).

---

## 1. Scope boundary

This repository contains **frontend code only**. Another workstream owns Laravel, MySQL,
the REST API, authentication services, payment processing, SaaS licensing and third-party
integrations.

### Explicitly not built here

| Concern | Status in this repo |
| --- | --- |
| Server, database, migrations, PHP controllers | Not present. No `.php` file, no migration, no ORM model. |
| Authentication, sessions, tokens | Simulated. Nothing is transmitted or stored. |
| Payment processing | Not present. Checkout screens are labelled previews. |
| OAuth flows, provider credentials | Not present. The connection wizard explains steps and requests nothing. |
| Email / SMS / WhatsApp / telephony delivery | Simulated. Every outbound message carries a `simulated` delivery state. |
| AI model hosting, AI APIs, vector stores | Not present. A deterministic template engine stands in. |
| File storage, e-signature, GPS, backups, monitoring | Not present. Each is modelled as data with an honest label. |

The rule that makes this boundary safe is in
[`packages/configuration/src/demo.ts`](../../packages/configuration/src/demo.ts): every
unimplemented capability has a canonical user-facing notice, and components render that
notice rather than inventing wording. A control either performs its advertised
demonstration action or states plainly that the capability is not available.

---

## 2. Repository layout

```
apps/
  website/          Astro 7 · static-rendered marketing site + public demo
  crm/              Vite + React 19 SPA · the CRM application
  platform-admin/   Vite + React 19 SPA · SaaS platform-owner console
packages/
  design-tokens/    OKLCH palette, semantic tokens, theme/density CSS, Tailwind bridge
  ui/               Shared design-system component library
  shared-types/     Typed domain contracts and service interfaces
  configuration/    Branding, plans, module registry, industries, site IA, demo policy
  localization/     Locale catalogue, Intl formatters, RTL helpers, i18n instance
  mock-services/    Browser-side service implementations + synthetic seed data
docs/               Architecture, design system, competitor analysis, contracts, testing
scripts/            Build verification (link checker, .astro class-name codemod)
```

### Why three applications rather than one

The three surfaces have incompatible optimisations. The website needs static rendering and
near-zero JavaScript for Core Web Vitals and SEO. The CRM needs an authenticated SPA shell
with dense, stateful views. The platform console is a separate trust domain — a platform
operator is not a tenant user, and nothing should make it look like a menu item inside the
CRM.

They share the design system, tokens, types, configuration and localisation, which is what
keeps them one product rather than three.

---

## 3. Package strategy

All shared packages are **source-only**: their `package.json` `exports` point at
`./src/*.ts`, and no build step runs over them.

This works because npm workspaces symlinks packages into `node_modules`, and Vite follows
symlinks to their real path (outside `node_modules`), so esbuild/Vite transpiles them as
first-party source. The benefits:

- editing a shared component produces instant HMR in all three apps
- no stale `dist/` artefacts and no watch-build race conditions
- one edit to a token file visibly changes the website and the CRM at the same time

The trade-off is that consumers must transpile TypeScript from a dependency, so the
packages cannot be published to a registry as-is. That is an acceptable trade for an
internal monorepo and is documented here so it is a decision rather than a surprise.

### Two consequences of source-only packages

**Deep, per-family imports.** `@crm/ui` exposes each component family both through its barrel
and through its own subpath, so a consumer can import a single family. This matters for the
bundle: importing the barrel pulls in every family including the chart and drag-and-drop
dependencies.

**Lazy-loading a named export.** When several screens live in one module and only one route
should load each, the route imports the module and picks the named export:

```ts
const AccountDetail = lazyScreen(() =>
  import('../routes/accounts/AccountsScreens').then((module) => ({ default: module.AccountDetail })),
);
```

This keeps a screen group in one file — where the list, detail and form can share helpers —
without shipping all of them in one chunk.

### Tailwind v4 source scanning

Tailwind's automatic source detection ignores `node_modules`, which would drop every class
used inside `packages/ui`. Each app therefore declares the UI package explicitly:

```css
@source '../../../../../packages/ui/src';
```

Forgetting this line produces a build that succeeds but renders unstyled components — the
kind of failure that wastes an afternoon. It is the first thing to check if the CRM looks
unstyled.

### The Tailwind theme bridge and the `--container-*` collision

Layer 6 of `tokens.css` bridges the raw scale tokens (`--w-*`, `--r-*`, …) into Tailwind's
`@theme inline` namespaces. One of those namespaces is a trap: `--container-*` feeds **both**
the `max-w-*` utilities and the `w-*` utilities. A bridge key named `full` therefore emitted:

```css
.w-full { width: 100%; width: var(--w-full); } /* 90rem = 1440px */
```

The second declaration overrode Tailwind's built-in `w-full { width: 100% }`, blowing every
`w-full` element — every form control, card and table — out to viewport width. It shipped
silently, because the build succeeds either way and no static check notices a CSS cascade
override; it was found only by driving the application in a browser.

The `full` bridge key has been removed. The two places that want the widest page container now
reference the raw token explicitly with `max-w-[var(--w-full)]`
(`apps/website/src/components/site/Section.astro` and
`packages/ui/src/components/primitives.tsx`), and `packages/design-tokens/src/tokens.test.ts`
is a three-case guard that fails if a `--container-*` key shadowing a Tailwind static width
utility is ever reintroduced.

---

## 4. Layering

```
┌──────────────────────────────────────────────────────────────┐
│  Route / page layer                                          │
│  Astro pages · React Router routes                           │
│  Owns: URL, data loading, page-level loading/empty/error UI   │
├──────────────────────────────────────────────────────────────┤
│  Feature layer                                               │
│  Feature folders: leads, deals, tickets, workflows, …         │
│  Owns: composition, forms, local view state, optimistic logic │
├──────────────────────────────────────────────────────────────┤
│  Design system  (@crm/ui)                                    │
│  Owns: presentation, keyboard behaviour, ARIA, density        │
│  Never imports a service. Never fetches anything.             │
├──────────────────────────────────────────────────────────────┤
│  Service contracts  (@crm/shared-types/services)             │
│  Owns: the boundary. UI depends on interfaces only.           │
├──────────────────────────────────────────────────────────────┤
│  Implementations                                             │
│  Today: @crm/mock-services (browser)                          │
│  Later: HTTP client against the Laravel REST API              │
├──────────────────────────────────────────────────────────────┤
│  Domain types  (@crm/shared-types)                           │
│  Configuration  (@crm/configuration) · Localization · Tokens  │
└──────────────────────────────────────────────────────────────┘
```

Two rules follow from this and are worth enforcing in review:

1. **A component in `@crm/ui` never imports from `@crm/mock-services`.** If a component
   needs data it receives it as props. This is what makes the library reusable across all
   three apps and testable without a service layer.
2. **No view calls `fetch`.** Everything goes through a service interface, so swapping the
   mock for HTTP is a one-file change in a composition root.

---

## 5. Data flow: the swap point

`ServiceContainer` (in `shared-types/src/services.ts`) is the single object the UI
receives. It has one member per domain: `leads`, `contacts`, `accounts`, `deals`,
`pipelines`, `activities`, `calendar`, `tasks`, `sequences`, `playbooks`, `goals`,
`conversations`, `campaigns`, `segments`, `journeys`, `emailTemplates`, `forms`,
`landingPages`, `leadSources`, `tickets`, `knowledgeBase`, `customerSuccess`, `products`,
`quotes`, `orders`, `contracts`, `invoices`, `subscriptionRevenue`, `dashboards`, `reports`,
`exports`, `analytics`, `workflows`, `customObjects`, `layouts`, `savedViews`,
`industryTemplates`, `navigation`, `documents`, `collaboration`, `projects`, `fieldSales`,
`partners`, `integrations`, `developer`, `ai`, `organization`, `users`, `roles`, `security`,
`data`, `billing`, `tenant`, `platformAdmin`, `demo` and `onboarding`.

Replacing the mock is therefore:

```ts
// apps/crm/src/main.tsx  — today
const services = createMockServices();

// after the API exists — the only change
const services = createHttpServices({ baseUrl: import.meta.env.VITE_API_URL });
```

### Contracts that anticipate the real API

The interfaces are transport-neutral but deliberately explicit about the concerns the UI
actually has to handle:

- **Pagination and facets.** `list()` returns `Paginated<T>` with `PageMeta` and optional
  facet counts, because filter chips should show result counts without a second request.
- **Filtering.** `FilterGroup` supports nested AND/OR, which is what saved views, segment
  builders and report definitions all need.
- **Optimistic concurrency.** `UpdateInput<T>` carries `expectedUpdatedAt?`, so the UI's
  conflict handling is exercised before a real API can produce a real conflict.
- **Partial failure.** Bulk operations return `BulkActionOutcome` with per-record failures
  rather than a single boolean, because "12 of 15 updated" is a real state.
- **Typed errors.** `Result<T>` with `AppErrorCode` including `entitlement_missing` and
  `offline`, so the shell's blocked-state UI has somewhere to come from.
- **Simulation switches.** `WriteOptions.simulate` can force a validation error, conflict,
  forbidden, entitlement-missing, server error or offline response. This is how error and
  empty states get built and demonstrated instead of being forgotten.

See [`API_CONTRACTS.md`](./API_CONTRACTS.md) for the payload shapes.

### The commerce services and the pricing engine (Batch 7)

Batch 7 added three service modules to the mock container — `products`, `quotes` and `orders`
— registered after `subscriptionRevenue`. They follow the same list/get/create/update/remove
shape as every other module and add the domain operations the screens need:

- **`products`** — CRUD plus `categories()` (derived from the catalogue, never stored twice),
  `priceBooks()`, `updatePriceBookEntry()` and the shared `revenueSummary()` header.
- **`quotes`** — CRUD plus `addLineItem`, `updateLineItem`, `removeLineItem`,
  `applyOrderDiscount`, `recalculate`, `submitForApproval`, `decideApproval`, `revise`,
  `markSent`, `accept`, `decline` and `convertToOrder`.
- **`orders`** — CRUD plus `activate`, `cancel` and `recordPayment`.

Two exported **pure** functions are the sole money path, so a total shown anywhere can never
depend on which code path produced it:

- `priceQuoteLine(line, currency)` prices one line — gross, a clamped percentage discount, the
  discount amount and the net.
- `computeQuoteTotals(lines, currency, orderDiscountPercent, costByProduct?)` prices every
  line, applies the order discount to the net subtotal, computes the recurring split and the
  annualised total, and builds the margin block.

No screen computes a total in the browser. Every line change calls `quotes.updateLineItem` or
`quotes.applyOrderDiscount`, which re-prices through `computeQuoteTotals` and returns the whole
document; the screen renders only what came back. Two deliberate limits are encoded in the
returned document rather than hidden:

- **Tax is always zero.** `taxTotal` is `0` and carries a `taxNote` stating that the platform
  does not calculate tax and any rate shown is recorded for reference only.
- **Margin falls back to a stated 40 %-of-list cost.** When no cost is recorded for a product,
  the margin block uses 40 % of the line's list subtotal rather than claiming a precision the
  input does not support.

`quotes.revise(quoteId)` **clones forward**: it creates a new quote with a new id, a reference
suffixed `-R<version + 1>`, `version + 1`, and the original id appended to
`previousVersionIds`, then marks the original `revised`. Revision history is therefore a real
chain, not a number that increments with nothing behind it.

`quotes.convertToOrder(quoteId)` accepts only a quote whose status is `accepted` or `approved`,
and additionally refuses one with an approval step still `pending`. Both refusals return a
typed `validation_failed` error rather than silently creating an order, because an order
created from a draft would misrepresent a commitment.

### The support screens (Batch 8)

Batch 8's support domain did **not** add a service module. `tickets`, `knowledgeBase` and
`conversations` were already implemented and seeded in `packages/mock-services`, so this is a
screens-plus-tests batch: the queue, detail, reader and inbox views in
`routes/tickets`, `routes/knowledge-base` and `routes/inbox` sit on the existing contracts, and
the service-module count stays at **30 of 60**. Two deliberate trade-offs follow from not
widening the contract, and both are recorded rather than hidden:

- **The knowledge-base category view and the inbox/KB KPI strips are derived client-side.**
  The knowledge-base service exposes articles, not the category table, and neither it nor the
  inbox offers an aggregate endpoint, so the two list screens fetch a second, large page (200
  records) and group or count it in the browser. This keeps the batch screen-only at the cost
  of doubling the read on those two routes, and of undercounting categories if a tenant ever
  holds more articles than the page size.
- **The support overview aggregates across tenants.** `tickets.overview()` and
  `tickets.slaPolicies()` read the whole ticket collection (`ticketsInScope()` is `db.all`),
  so the KPI strip counts other tenants' tickets. The ticket *list* is correctly scoped. This
  is pre-existing, not introduced by Batch 8; a test records the real behaviour and the fix is
  left with the mock layer — see
  [`BATCH_08_REPORT.md`](../development-progress/BATCH_08_REPORT.md) §7 and §10.

### The customer-success services (Batch 9)

`customer-success.ts` implements two container keys:

- **`customerSuccess`** computes explainable health from already-seeded usage and support
  signals. Every score carries its weighted components (so the reader can confirm the weights
  sum to 100 %), a band and a rationale, and the model is labelled a demonstration (`modelLabel`)
  rather than a prediction. Renewals, onboarding plans, success plans and business reviews read
  the collections the seed already filled. The seeded dataset had no playbooks, so this batch
  added `seed/playbooks.ts` — the only new seed module of batches 9–15.
- **`playbooks`** returns ordered steps, each marked task-creating or guidance-only. Applying
  one writes one local task per task-creating step and reports the count, plus the fact that
  nothing was emailed, scheduled or sent to a workflow engine.

### The engagement service (Batch 10)

`engagement.ts` implements `sequences` against the seeded `sequences` collection, with
enrolment counters derived from the stored aggregate counts and the seeded enrolments.
Enrolling records an enrolment in the local store and contacts no one; the screen's send
actions are simulations. The calendar, tasks and communications screens run on the
already-implemented `calendar`, `tasks`, `activities` and `conversations` modules — Batch 10
added no other service.

### Exports and goals (Batch 11)

`analytics-extras.ts` implements two keys over data the seed already provides:

- **`exports`** — export requests carry `generatedLocally: true`; the file is produced in the
  browser and nothing is emailed or uploaded.
- **`goals`** — quota goals for a user and period, derived from the seeded targets and records.

The analytics screens themselves read the existing `analytics`, `dashboards` and `reports`
modules; the two service-module additions here are the `exports` and `goals` keys.

### Customization extras (Batch 13)

`customization-extras.ts` implements `layouts`, `industryTemplates` and `navigation` over the
seeded layout, template and navigation collections:

- `layouts.preview(id)` resolves a layout against a synthetic record and returns the field
  placements the page would render, including the validation rules that apply to the object.
- `industryTemplates.previewChanges(id)` returns the additions and conflicts an install would
  apply; install and uninstall are simulated and say that user-created data is not lost.
- `navigation` exposes the seeded navigation definitions for the customization surface.

There is still no `validationRules` service, which is why the validation-rules screen is
read-only rather than a working editor.

### The marketing services (Batch 14)

`marketing.ts` implements seven keys — `campaigns`, `segments`, `journeys`, `emailTemplates`,
`forms`, `landingPages` and `leadSources` — against collections the seed already filled. The
service derives the campaign funnel and metrics from the seeded engagement counts rather than
storing them twice; launching or pausing a campaign changes local status only. Segments
evaluate their nested rule tree over the seeded records; journeys validate and return a
deterministic enrolment forecast; the email preview, form submission and landing-page publish
each carry the honesty label the screen shows (`generatedLocally`, `simulated: true`,
`demo_not_hosted`).

### The workspace services (Batch 15)

`workspaces.ts` implements `projects`, `fieldSales` and `partners` against only the seeded
collections (`projects`, `projectTasks`, `projectMilestones`, `territories`, `visitPlans`,
`visitLogs`, `partners`, `dealRegistrations`). Project phases, deliverables and risks, the
referrals and the commission ledger are computed from seeded records rather than stored;
commissions carry `calculationState: 'demo_local_calculation'`, and the commission statements
are served by the existing `subscriptionRevenue` module. Check-in records a manually chosen
label with `gpsUsed` always `false`.

### The `DataTable` keying contract (Batch 15)

`@crm/ui`'s `DataTable` accepts `getRowId?: (row: TData, index: number) => string`, defaulting
to `String(row.id ?? index)`. Tables over real records should pass their own `getRowId` (every
CRM table over a domain record does); the index fallback exists for derived summary rows —
the partner leaderboard (`partnerId`), territory performance (`territoryId`), coverage gaps
(`accountId`) — that have no record identity of their own. The original empty-string fallback
collapsed those rows onto a single React key and produced duplicate-key errors on
`/app/partners` and `/app/field-sales`; the browser smoke pass caught it. The index is part of
the callback signature so a caller that needs it to compute a key remains legal.

---

## 6. Application shells

### Website (`apps/website`)

Astro with `output: 'static'`. Every marketing, resource, legal and pricing page is
pre-rendered. JavaScript ships only for genuine islands, each with an explicit hydration
directive:

| Island | Directive | Why |
| --- | --- | --- |
| `ThemeToggle` | `client:load` | Must reflect the server-rendered theme immediately. |
| `LocaleSwitcher` | `client:idle` | Below the fold; no interaction until the user reaches the footer. |
| `DashboardPreview` | `client:visible` | Below the fold, and the animation must not run off-screen. |
| `ProductDemoLauncher` | `client:visible` | Below the fold on both pages that use it. |
| `PricingTable` | `client:visible` | Below the fold on `/pricing`. |
| `PlanComparisonTable` | `client:visible` | Below the fold. |

Mega menus and the mobile navigation are **not** islands. The full navigation is
server-rendered from `@crm/configuration`, so every link is crawlable and the site is
readable with JavaScript disabled. A small inline script adds `aria-expanded`, arrow-key
opening, Escape-to-close, focus-return and click-outside dismissal on top of markup that
already works.

`BaseLayout.astro` resolves the theme with an inline script **before first paint**. Without
it, a dark-mode visitor sees a white flash, which is a Core Web Vitals-adjacent
regression and looks unfinished.

### CRM (`apps/crm`) and Platform admin (`apps/platform-admin`)

Vite + React 19 SPAs with React Router 7. Route-level `React.lazy` keeps the initial
bundle small. The shell owns:

- collapsible sidebar driven by `resolveNavigation()` in `@crm/configuration`, which
  filters by entitlement, permission and interface mode
- organization and workspace switcher
- top bar with global search, command palette, notification centre, quick-create,
  favourites, recently viewed and the AI entry point
- theme, density and language controls writing the same preference key the website uses

#### Routes

The CRM registers **114 real routes, 25 placeholder routes and 8 redirects — 148 route objects,
147 of them with an explicit `path:`** (counted from `apps/crm/src/app/router.tsx`: 114
`lazyScreen` elements, 25 `notBuilt` placeholders, eight `<Navigate>` redirects, plus the
pathless `/app` shell layout that owns the children). The 25 placeholders cover documents,
goals, integrations, developer, administration and module sub-features; each is a `/*` catch-all
behind a real list/detail pair. Contracts and recurring revenue stopped being placeholders in
Batch 17 — their catch-alls now name the surfaces that exist (the contract list and detail with
renew, amend and terminate; the revenue report and invoices) and catch only deeper paths.

Batch 7 added ten real routes — `/app/products` (list, new, detail, edit),
`/app/quotes` (list, new, detail, edit) and `/app/orders` (list, detail) — plus three new
placeholder catch-alls (`products/*`, `quotes/*`, `orders/*`). Batch 8 added six more real
routes — `/app/tickets`, `/app/tickets/:ticketId`, `/app/knowledge-base`,
`/app/knowledge-base/:articleId`, `/app/inbox` and `/app/inbox/:conversationId` — and replaced
the module-wide placeholders that used to cover those modules with four narrower ones
(`/app/tickets/queues`, `/app/tickets/*`, `/app/knowledge-base/*`, `/app/inbox/*`) for the
sub-features that remain unbuilt. Batch 6's counts were 28 real and 49 placeholder; Batch 7's
were 38 and 46; Batch 8's were 44 and 44. Batches 9–15 then moved most of the remaining module
families to real screens: customer success and playbooks, calendar / tasks / sequences /
communications, analytics and reports, workflows and AI, customization and templates,
marketing, and the additional workspaces (projects, partners, field sales, portal preview).
The catch-alls keep every unbuilt sub-path of a module honest while the list, detail and form
routes above them are real screens.

#### Bundle composition

`React.lazy` per screen is necessary but not sufficient: without further splitting, every
route's shared dependencies collapse into one large entry chunk. Batch 6 measured a
**758.60 kB** entry chunk and, on inspection, the cause was not the `@crm/ui` barrel (as
first assumed) but the direct imports of `@crm/mock-services` (594 kB of TypeScript source
plus seed data) and `@crm/configuration` (136 kB). Two changes fixed it:

1. **Dependency-group chunking.** `apps/crm/vite.config.ts` defines a `manualChunks` function
   that assigns a module to a named chunk by dependency group — `charts`, `dnd`,
   `mock-services`, `mock-seed`, `reference-data`, `ui`, `tanstack`, `forms`, `vendor`. The seed
   under `/packages/mock-services/src/seed/` is matched before the rest of the package, which is
   what splits the data from the code. Because workspace packages are source-only they resolve to
   filesystem paths, so the matchers test `/packages/<name>/` rather than the `@crm/*` specifier.
2. **Per-family subpath exports.** `@crm/ui`'s `package.json` exposes each component family
   under its own subpath as well as the barrel, so a screen can import one family without
   pulling in every other. Importing a button no longer imports a chart.

The entry chunk is **67.11 kB** and no chunk exceeds 500 kB, so Vite's "larger than 500 kB"
warning is gone. Measured at the Batch 17 build: `charts` **430.11 kB** is the largest and is
lazy, loaded only by analytics; then `ui` 316.18 kB, `vendor` 300.77 kB, and the mock layer,
which now builds as **two** chunks — `mock-services` 276.79 kB of service code and `mock-seed`
224.98 kB of seeded collections.

That split matters for the account the Batch 16 pass recorded: `mock-services` had grown to
**494.08 kB**, 6 kB under the warning threshold, with the next service module expected to cross
it. Moving the seed records into their own dependency group took the pressure off without
raising the threshold or shrinking the demo, and Batch 17 then added two service modules and three
screens inside the headroom.

Both render inside `ThemeProvider`, which applies theme, density, contrast, motion,
direction, locale and accent as `data-*` attributes on `<html>`. Because every token is a
CSS custom property scoped to those attributes, changing a preference re-colours the whole
application without re-rendering the component tree.

---

## 7. Rendering and data-edge behaviour

- **Route-based code splitting** for every non-initial route.
- **Skeletons, not spinners,** for content-shaped waits: `SkeletonTable`, `SkeletonCard`,
  `PageShellSkeleton`, `ChartSkeleton`. A skeleton communicates what is arriving.
- **Empty states are designed, not defaulted.** `EmptyState` accepts `hints` so a first-run
  screen can suggest three real next actions instead of apologising.
- **Error states are typed.** `ErrorState` has variants for `error`, `forbidden`,
  `not-found`, `offline` and `not-entitled`, each with appropriate copy — an entitlement
  problem must not read like a crash.
- **Virtualisation** is deliberately deferred. Lists paginate at 25–200 rows, which is the
  right default for CRM work (users scan and act, they do not infinite-scroll). The table
  body is structured so a virtualiser can wrap it without changing call sites.

---

## 8. Accessibility architecture

WCAG 2.2 AA is the target, and it is designed in rather than audited on at the end.

- **Tokens, not values.** Component code uses `bg-surface`, `text-muted`,
  `border-subtle`. A palette change is therefore guaranteed to keep contrast relationships,
  and high-contrast mode works by overriding tokens rather than by patching components.
- **Two motion controls.** `prefers-reduced-motion` is honoured globally in
  `tokens.css`, and `[data-reduced-motion='true']` works when the OS preference is unset.
  Both are needed: an in-app preference must not depend on an OS setting the user may not
  control.
- **Radix primitives** for dialogs, menus, popovers, selects, tabs and tooltips. Focus
  trapping, `aria-activedescendant`, typeahead and Escape handling are genuinely hard to
  get right, and re-implementing them would be a source of bugs, not a source of quality.
- **Direction-aware, not direction-duplicated.** Layout uses logical utilities
  (`ms-*`, `pe-*`, `start-*`, `border-s`). `[dir='rtl']` and `:where([dir='rtl'] *)`
  variants handle the exceptions. The `logical` helper in `@crm/localization` covers the
  few JavaScript cases (SVG coordinates, chart margins) where a real value is needed.
- **Colour is never the only signal.** Status badges carry text; KPI deltas include an
  arrow, a signed number and a screen-reader word ("increase"/"decrease"); progress bars
  show their percentage; health scores print the band name next to the ring.
- **Charts have a table.** `WidgetOptions.allowTableToggle` is a required field on every
  chart widget, so chart-to-table is a contract rather than an optional extra.
- **Icon-only controls require a label.** `IconButton` makes `label` mandatory, so the
  pattern that most often produces unlabelled buttons cannot be typed by accident.

---

## 9. Performance architecture

| Technique | Where |
| --- | --- |
| Static rendering | All 126 website pages |
| Selective hydration | Six islands, all with explicit directives |
| Route code splitting | CRM and platform admin |
| No web font request | System font stack with optional Inter; script-appropriate fallbacks for Arabic, Devanagari |
| Deterministic synthetic data | No network round-trips, no watermark re-renders, no hydration mismatch |
| `tabular-nums` on numerals | Prevents layout shift when numbers update |
| Token-driven theming | Preference changes do not re-render the tree |
| Lazy heavy components | Charts, kanban, workflow canvas |

The deterministic-data point deserves emphasis. `DashboardPreview` generates its data from
a fixed seed, so server render and client render produce identical markup. A random data
source here would produce a hydration mismatch and visible layout shift on the homepage —
the exact failure the performance targets are meant to prevent.

---

## 10. Testing strategy

| Layer | Tool | Status |
| --- | --- | --- |
| Type checking | `tsc --noEmit`, `astro check` | Passing across all six packages and the website |
| Linting | ESLint flat config, typescript-eslint, react-hooks | 0 errors, 5 informational warnings |
| Unit and component | Vitest + Testing Library + vitest-axe | 154 unit + 16 dom tests (the dom project covers `@crm/ui` and, from Batch 17, the CRM contracts and invoice screens); contract tests land with each batch's features |
| End-to-end | Playwright + `@axe-core/playwright` | Configured; 18 workflows specified in the brief; a 26-route manual smoke pass is recorded in `TEST_REPORT.md`. Playwright's browsers are not installed here, and the in-app browser surface available to this session stays hidden, so it dispatches no pointer events — from Batch 17 the browser pass is structural only, and dialog write paths are covered by `userEvent` tests in vitest's `dom` project instead |
| Link integrity | `scripts/check-links.mjs` | Passing: 15,093 internal links across 126 pages (last verified Batch 8) |
| Build verification | `npm run build` per app | Website (126 pages), CRM (0 chunks over 500 kB) and platform admin pass |

See [`TEST_REPORT.md`](../testing/TEST_REPORT.md) for current results and known gaps.

---

## 11. Configuration as the contract

Four configuration modules decide almost everything a user sees. Changing them changes the
product; no component needs editing.

| Module | Decides |
| --- | --- |
| `branding.ts` | Product name, logo, favicon, accent, tagline, metadata, footer, email chrome, legal placeholders |
| `plans.ts` | Plan tiers, prices, limits, add-ons, the comparison matrix, pricing FAQ, display currencies |
| `modules.ts` | Sidebar sections, module routes, icons, persona defaults, entitlement keys, Simple Mode visibility |
| `industries.ts` | Twenty-one industry profiles: terminology, extra objects, sample pipeline, workflows, dashboards |

This is what makes the "final name and logo can be replaced without redesigning hundreds of
components" requirement a configuration edit rather than a refactor.

---

## 12. Known architectural risks

1. **Source-only packages** require consumers to transpile dependency TypeScript. If a
   package is ever published or consumed outside this monorepo, it needs a build step.
2. **`@source` in Tailwind** is a manual coupling point between apps and the UI package. A
   new app must remember it.
3. **No memory profiler has been run** against the large-list views, because the mock layer
   currently serves paginated subsets. This should be revisited once the API returns real
   page sizes.
4. **`vite-tsconfig-paths`** is declared but not yet wired into the Vite configs; both apps
   currently resolve `@crm/*` through workspace symlinks. The plugin should be added when
   app-local `@/` aliases are introduced, as the website already uses.
