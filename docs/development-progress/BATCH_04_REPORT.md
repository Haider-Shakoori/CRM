# Batch Report — Batch 4

**Batch:** 4 (reordered) — Mock service layer, verification infrastructure and test coverage
**Date:** 2026-10-14
**Repository state:** runnable, all checks green

> **Departure from the published roadmap, stated up front.** The roadmap put "Website product
> and industry pages" next. I built the mock service layer instead, for the reason given in
> the Batch 1–3 report: it is a prerequisite for Batches 8–22, and building sixty more
> content pages would have improved breadth without reducing the project's largest risk.
> This report also says clearly what I did **not** get to.

---

## 1. Features implemented

### `@crm/mock-services` — the browser-side service layer

A complete implementation of the parts of the service contract the CRM reads through, built
so the HTTP swap is a composition-root change.

| Area | What was built |
| --- | --- |
| Query engine | Filter groups (recursive AND/OR), 16 operators, free-text search, multi-key sort, pagination with clamping, facet counting over the filtered set |
| Store | Keyed collections, `localStorage` persistence behind `crm.mockdb.v1`, subscription, snapshot, full reset, per-user preference bags |
| Seeded dataset | Three tenants with disjoint data, ~1,900 records across 60 collections |
| Generators | Accounts, contacts, leads (with explainable scoring), deals (with product lines), activities and calendar events, tickets (with derived SLA states and message threads), knowledge base, surveys, campaigns (metrics derived from audience), segments, journeys, forms, landing pages, conversations and messages, calls, templates, canned responses, products, price books, quotes, orders, contracts, invoices, subscriptions, commissions, renewals, onboarding plans, success plans, business reviews, health scores, portfolios, projects, tasks, milestones, territories, visit plans, visit logs, partners, deal registrations, documents, feed, notifications, announcements, dashboards, reports, goals, sequences, saved views, workflows and templates, custom objects and fields, layouts, validation rules, industry templates, integrations, connections, webhooks, deliveries, API logs, developer apps, AI conversations and usage, platform plans, add-ons, subscriptions, invoices, users, roles, audit, support tickets, flags, module catalog, localization rows, system status |
| Services | 27 service modules: leads, contacts, accounts, deals, pipelines, activities, tasks, calendar, tickets, dashboards, reports, analytics, knowledge base, conversations, workflows, collaboration, documents, AI, organization, users, roles, tenant, subscription revenue, custom objects, saved views, demo data, onboarding |

### Behaviours that are genuinely implemented, not stubbed

- **Deal stage movement** through one operation that returns the updated deal *and* the
  recomputed pipeline summary. Drag-and-drop, the row menu and the detail view all call it, so
  the board and the totals cannot disagree. Lost stages require a reason and reject the move
  without one. Every move writes a stage-change event onto the record timeline.
- **Lead conversion** with a preview step that writes nothing, then a commit that creates
  contact, account and deal atomically, marks the lead converted and keeps the audit trail.
- **Pipeline totals** computed by one function: weighted value from stage probability,
  stale detection against the pipeline's own threshold, per-stage rollups where open stages
  reconcile with the open total and closed stages with closed deals.
- **SLA states** derived from each ticket's timestamps against its policy, never stored.
- **Campaign metrics** derived from audience size so the funnel reconciles.
- **Tenant scoping** applied at the query layer, so a list cannot accidentally return another
  organization's records.
- **Optimistic concurrency** via `expectedUpdatedAt`, with a real conflict response.
- **Six simulated failure modes** (`validation_error`, `conflict`, `forbidden`,
  `entitlement_missing`, `server_error`, `offline`) producing typed errors that the UI has
  states for, without mutating anything.
- **Workflow validation** that blocks activation on structural errors and warns on
  unreachable nodes, plus a **deterministic simulation** that evaluates conditions against a
  sample record and labels every step as simulated.
- **AI responses** composed from the records in context, carrying `origin: 'demo_template_engine'`
  and citations with routes, so the interface cannot present them as model output.
- **Role protection**: system roles cannot be deleted, roles held by users cannot be deleted,
  and cloning produces a custom copy.
- **Field deletion** blocked when the field is referenced in a layout, formula, workflow or
  report, with the reference count in the message.

### Tooling and verification infrastructure

- Vitest configured with two projects (`unit` in Node, `dom` in jsdom + Testing Library +
  vitest-axe) and a shared setup that stubs only the two browser APIs the design system
  genuinely uses
- `jsdom` pinned to a version compatible with the installed Node runtime
- `scripts/strip-bom.ps1` — normalises files to UTF-8 without a BOM
- `scripts/check-links.mjs` — internal link integrity against built output
- ESLint executed for the first time and brought to zero errors

---

## 2. Pages and routes created

None. This batch is infrastructure and services. The website still serves 126 pages; the CRM
and platform-admin applications are unchanged.

---

## 3. Components created or reused

| Change | Detail |
| --- | --- |
| `packages/ui/src/theme.tsx` | Reworked: system preference and media-query state now initialise during render rather than in an effect, removing a cascading render on mount. Removed a redundant `color-scheme` assignment the token stylesheet already handles. |
| `packages/ui/src/components/forms.tsx` | `CurrencyInput` reworked to be genuinely controlled: a local draft exists only while the user types and clears on blur, so a value changed elsewhere appears immediately without a prop-to-state effect. |
| No new components | This batch needed none. |

---

## 4. Interactive mock workflows completed

The following now work end to end against real local state, and are covered by tests:

1. Move a deal between stages and see the pipeline summary recompute in the same response
2. Bulk-move deals with per-record failure reporting
3. Attempt to close a deal as lost without a reason and be told why, with the deal untouched
4. Preview a lead conversion without writing anything, then commit it
5. Complete a task and have it leave the daily plan
6. Switch organization and observe a disjoint dataset
7. Trigger each of the six simulated failure modes and receive the matching typed error
8. Attempt a stale write and receive a conflict instead of silently winning
9. Reset the demo data and get the seeded baseline back, byte-for-byte
10. Validate a workflow, be blocked from activating it while invalid, then simulate it
11. Ask the assistant for a summary and receive a cited, labelled response
12. Read derived support metrics that reconcile with the underlying tickets
13. Execute a report and get rows plus a matching chart series
14. Load all widgets on a dashboard in one call, each with a state and a format

---

## 5. Files created or modified

| Area | Files | Notes |
| --- | ---: | --- |
| `packages/mock-services/src/lib` | 4 | `random.ts`, `query.ts`, `store.ts`, `query.test.ts` |
| `packages/mock-services/src/seed` | 5 | `pools.ts`, `foundation.ts`, `records-sales.ts`, `records-engage.ts`, `records-extra.ts`, `index.ts` |
| `packages/mock-services/src/services` | 4 | `factory.ts`, `index.ts`, `extra.ts`, `index.test.ts` |
| `packages/mock-services` root | 1 | `index.ts` barrel |
| Root configuration | 3 | `vitest.config.ts`, `vitest.setup.ts`, `eslint.config.js` |
| Scripts | 2 | `strip-bom.ps1`, `fix-mock-seed.ps1` (and `check-links.mjs` corrected) |
| `packages/shared-types` | 4 | Type corrections the implementation surfaced (see §7) |
| `packages/ui` | 2 | Lint-driven rework of `theme.tsx` and `CurrencyInput` |
| **Total** | **~29** | |

Estimated 6,500 lines of new source and tests.

---

## 6. Tests executed and their results

```
TypeScript (6 packages)          PASS    0 errors
astro check (20 files)           PASS    0 errors, 0 warnings, 0 hints
ESLint (whole repository)        PASS    0 errors, 1 warning
Vitest unit project              PASS    70 / 70 tests, 2 files
astro build — website            PASS    126 pages
check-links — 126 HTML files     PASS    15,093 / 15,093 resolved, 0 broken
```

The single ESLint warning is informational: TanStack Table is not yet compatible with the
React Compiler's analysis, so the compiler skips memoising that component. It is a real
trade-off worth recording rather than suppressing.

### Reproduce

```bash
npm run typecheck
npm run lint
npx vitest run --project unit
npm run build:website
node scripts/check-links.mjs apps/website/dist
```

### What the 70 tests cover

| Suite | Tests | Focus |
| --- | ---: | --- |
| `lib/query.test.ts` | 29 | Nested filter groups, all operators, date-string comparison, empty-value handling, unknown-operator safety, multi-key sort, immutability, pagination metadata and clamping, search field scoping, facet counting before pagination |
| `services/index.test.ts` | 41 | Determinism, tenant partitioning and disjointness, relationship integrity, health-score consistency, deal movement and its side effects, pipeline maths, lead conversion with and without a deal, task completion, optimistic concurrency, all six failure modes, reset, read paths, report execution, widget data, workflow validation and simulation, AI provenance, role protection, field-level masking |

---

## 7. Defects the tests found, and how they were fixed

This is the part of the report worth reading, because it is the evidence that the tests are
doing work rather than confirming what was already believed.

| # | Defect | How it surfaced | Fix |
| --- | --- | --- | --- |
| 1 | A leftover line in `moveDeal` wrote an `undefined` record into `dealLostReasons`, throwing on every stage move | Four deal-movement tests failed with "cannot read properties of undefined" | Removed. It served no purpose. |
| 2 | **Lists were not tenant-scoped at all.** The `scope()` helper passed the query through unchanged, so switching organization changed nothing observable | Tenant-isolation test reported 163 records leaking across tenants | Scoping applied at the query layer: the tenant clause is ANDed onto any caller filter, so a saved view cannot widen a result beyond the current tenant |
| 3 | The pipeline summary reported `totalDeals` from one population and `totalValue` from another (all deals versus open deals) | Test asserted the count matched the open set | Count and value now come from the same population — precisely the class of inconsistency this project is about |
| 4 | Switching organization updated a different user than the one reads were scoped to, so the switch had no effect | Isolation test failed on `switched.ok` | The signed-in user is users[0]; switching moves that user's active organization, and a non-member receives a typed `forbidden` |
| 5 | The seeded signed-in user belonged to only one organization, so the switcher had nothing legitimate to switch to | Followed from #4 | The first user is now a group administrator with membership of all three tenants — realistic for a consultant or group admin, and it makes the isolation demonstrable |
| 6 | Closed pipeline stages always reported a deal count of zero, because the weighted calculation only considers open deals | Deal-movement test asserted the won stage grew | Closed stages are counted separately and documented, so a closed column never reads as "no deals" when it means "not weighted" |
| 7 | The `SupportOverview` service returned a flat shape while the contract declares a `metrics` bag | `tsc` rejected the type | Implementation conformed to the contract |
| 8 | The root `package.json` had acquired a UTF-8 BOM, which npm tolerates but Vite's resolver rejects | The website build failed outright | `scripts/strip-bom.ps1` added and run; 42 files normalised |

### Type corrections the implementation forced back into the contracts

Writing the implementations surfaced four places where the contracts were wrong or
incomplete. Each was fixed at the contract rather than worked around:

1. `PlatformPlan.billingOptions[].maximumSeats` now allows `null`, because "no cap" is
   different from "unspecified".
2. `PlatformAddOn` and `FeatureFlag` are `Auditable`, matching every other platform record.
3. `SavedView` filter values allow numbers and booleans, not only strings — a saved view on
   `isStale` is a boolean filter.
4. `JourneyNode` gained `isEntry`/`isTerminal` and its config gained `task` and
   `conditionGroup`, because a journey diagram that cannot mark its start or its conditions is
   not a diagram.

---

## 8. Build and typecheck status

| Target | Typecheck | Lint | Tests | Build |
| --- | --- | --- | --- | --- |
| `packages/design-tokens` | PASS | PASS | n/a | n/a |
| `packages/shared-types` | PASS | PASS | n/a | n/a |
| `packages/configuration` | PASS | PASS | n/a | n/a |
| `packages/localization` | PASS | PASS | n/a | n/a |
| `packages/ui` | PASS | PASS | configured, no suites yet | n/a |
| `packages/mock-services` | PASS | PASS | 70 / 70 | n/a |
| `apps/website` | PASS | PASS | no suites yet | PASS — 126 pages |
| `apps/crm` | not started | — | — | — |
| `apps/platform-admin` | not started | — | — | — |

---

## 9. Responsive and accessibility findings

No UI changed in this batch, so there is nothing new to report on either. The two
accessibility-relevant changes were both improvements found by lint:

- `useMediaQuery` and the system-theme state now read their initial value during render. The
  previous version rendered once with a wrong assumption and then corrected itself, which on
  a themed surface is a visible flash.
- `CurrencyInput` is now genuinely controlled. Previously, a parent changing the value while
  the field was mounted could be overwritten by a stale draft for one render.

---

## 10. Known issues

### Scope

1. **The CRM application still does not exist.** This remains the largest gap. The service
   layer it needs is now built and tested, so the remaining work is composition.
2. **The mock container implements 27 of the 60 service modules.** The remaining 33 are
   declared in the contract and deliberately excluded from the mock's type, so a screen that
   needs one fails to compile rather than silently receiving an object whose methods return
   nothing. Still to implement: sequences, playbooks, goals, campaigns, segments, journeys,
   email templates, forms, landing pages, lead sources, customer success, products, quotes,
   orders, contracts, invoices, exports, layouts, industry templates, navigation, projects,
   field sales, partners, integrations, developer platform, security, data management,
   billing, platform admin. Most will be thin over the generators that already exist, but they
   are not written.
3. **`MockDb.transaction` mutates in place.** It snapshots before the callback and restores if
   the commit throws, but a callback that throws *partway through* leaves earlier mutations
   applied. Deep-cloning the whole database on every write would be prohibitive at this
   dataset size. The honest position: the callback must not throw, and callers currently
   validate before entering it. This should be either enforced or properly implemented.
4. **`createCrud` is not used consistently.** Some services use it; others read
   `db.all(collection)` directly. Both work, but the inconsistency will drift.

### Verification

5. **No component tests yet.** The `dom` project is configured but has no suites. The design
   system is untested.
6. **No end-to-end tests.** Playwright is configured, nothing written.
7. **No axe-core results.** No accessibility measurement exists on any page.
8. **No Lighthouse run.** Performance claims remain architectural.
9. **No responsive overflow assertions** at the eight target widths.
10. **The link checker does not validate fragments** or external links.

### Data

11. **Seed depth is uneven.** Sales, support, marketing and communications are rich; the
    operational and platform collections carry a small representative set. Every screen has
    records to render, but volume is not yet realistic for pagination and performance work.
12. **Date handling uses a fixed epoch.** Deliberate for reproducibility, but a long-lived
    session will show "days ago" figures that stop advancing.

---

## 11. Remaining frontend work

Ordered by dependency:

1. **`apps/crm`** — shell, entitlement-resolved navigation, organization switcher, command
   palette, role-based dashboards. The largest remaining item and the next batch.
2. **CRM core modules** — leads, contacts, accounts, deals and pipeline screens.
3. **`apps/platform-admin`** — shell and overview, so tenant switching is demonstrable across
   two surfaces.
4. **Remaining 33 service modules**, as their screens are built.
5. **Chart, kanban and canvas component families** in `@crm/ui`.
6. **Component and end-to-end test suites.**
7. **Measurement** — Lighthouse, axe, responsive overflow.
8. **Remaining website page templates**, from the configuration data that already exists.

---

## 12. Suggested next batch

**Batch 5 — the CRM application shell and its core screens.**

Scope:

1. `apps/crm` bootstrap: Vite config, router, `ServiceContainer` provider, theme provider,
   error boundaries, route-level code splitting.
2. Application shell: collapsible sidebar driven by `resolveNavigation()`, organization
   switcher wired to `tenant.switchOrganization`, top bar with global search trigger,
   notification centre, quick-create menu, favourites, recently viewed, user menu, theme and
   language controls, Simple/Advanced mode toggle.
3. Role-based home dashboard rendering `dashboards.dashboardForAudience` and
   `widgetDataBatch`, with a chart-to-table toggle on every chart widget.
4. Leads: list with saved views and filters, detail with the timeline, creation form with
   Zod validation, and the conversion wizard using the preview-then-commit flow.
5. Deals: kanban board with `dnd-kit` plus keyboard-operable stage moves through the same
   `deals.move` operation, and a detail view with products, team and competitors.

Exit criteria: a reviewer can sign in as a persona, switch organization and see the data
change, move a deal and watch the totals update, create and convert a lead, and complete a
task — with loading, empty and error states throughout.

After that, Batch 6 should be `apps/platform-admin`, because tenant switching is only
convincingly demonstrated across two surfaces.
