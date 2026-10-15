# Batch Report — Batch 6

**Batch:** 6 — Contacts and accounts, and the bundle fix
**Date:** 2026-10-14
**Repository state:** all three applications build; every check green; the 758 kB index chunk is gone
**Prior report:** [`BATCH_05_REPORT.md`](./BATCH_05_REPORT.md)

---

## 1. Features implemented

### Contacts

- **Directory** — 50 seeded contacts with a facet filter bar (lifecycle stage, consent
  state, owner, account), five saved views, free-text search, server-shaped sorting, a
  table/card view toggle and a genuine density toggle. Every state is addressable through
  the URL, so a filtered view is shareable.
- **Detail** — the full person record: lifecycle stage, engagement score, lifetime value,
  every phone, email and channel with its **per-channel consent state** shown as text rather
  than a colour, the unified activity timeline, deals and tickets held, and the account card
  with an "Open Customer 360" link back into the account.
- **Form** — React Hook Form + Zod, with required-field marking, per-field error surfacing,
  inline account creation, and unsaved-changes detection.
- **Duplicate review** — candidate pairs grouped by last name and account, each showing the
  matched fields side by side, with a **human decision per field**. The chosen values are
  written explicitly through `contacts.update`, then the records are merged through
  `contacts.merge(primaryId, [secondaryId], resolvers)`. A `<DemoNotice tone="warning">`
  states plainly that re-pointing related records is a backend operation this demo does not
  perform — the merge is honest about where the frontend's responsibility ends.

### Accounts

- **List** — KPI row (total accounts, key accounts, needs attention, upcoming renewals),
  saved views, filters for health, type, tier and owner, the full table with a health
  indicator, and bulk owner assignment with per-record failure reporting.
- **Customer 360 detail** — the page this batch exists for:
  - **Overview**: relationship health with weighted components (each carrying a rationale
    and a trend), the detected signals with severity and a suggested action, a revenue
    snapshot (won to date, open pipeline, recurring, average deal) with a by-year and
    by-product breakdown drawn as CSS bars, and firmographics.
  - **Customer 360 tab**: one unified timeline across the account, its contacts and its
    deals, plus people, open deals and support activity.
  - **Hierarchy tab**: parent, siblings and subsidiaries, rolled-up revenue that sums each
    account's won-to-date total, open deal count for the group, and a "Move in hierarchy"
    dialog that refuses to make an account its own descendant.
  - **Buying committee**: the influencers on the account with their role and sentiment.
  - **Documents**: real document records associated with the account, filtered client-side
    because the list endpoint does not take an association filter.
- **Form** — RHF + Zod, with parent-account selection that excludes self and descendants.

### Bundle fix

The Batch 5 report recorded a 758.60 kB index chunk and named the `@crm/ui` barrel export as
the cause. That diagnosis was **wrong**, and correcting it is more useful than the fix itself:

- The index chunk was dominated by `@crm/mock-services` (594 kB of TypeScript source plus the
  seed data) and `@crm/configuration` (136 kB), which the shell imports directly. `@crm/ui`
  accounted for 177 kB and `@tanstack/table-core` for 136 kB.
- Two changes were made. `@crm/ui` gained **per-family subpath exports** so a screen can import
  one component family without the barrel. The CRM `vite.config.ts` gained a `manualChunks`
  function that splits by dependency group: `charts`, `dnd`, `mock-services`, `reference-data`,
  `ui`, `tanstack`, `forms`, `vendor`. Workspace packages are source-only and resolve to
  filesystem paths, so the matchers test `/packages/<name>/` rather than the `@crm/*` specifier.
- Result: the index chunk fell from **758.60 kB to 55.00 kB**, no chunk exceeds 500 kB, and Vite
  emits **zero** "larger than 500 kB" warnings.

### Shared component work

- **`@crm/ui` per-family exports** and a `kanban.test.tsx` suite (see §6).
- **`packages/ui/src/vitest-matchers.d.ts`**: an ambient declaration telling TypeScript about
  the jest-dom and vitest-axe matchers that `vitest.setup.ts` registers at run time. The UI
  package's own `tsc` run does not include that setup file, so without this a component test
  would not typecheck.

---

## 2. Pages and routes created

| Surface | Real screens | Routes |
| --- | ---: | ---: |
| CRM application | +6 (contacts ×4, accounts ×3, less shared form) | 28 real, 49 placeholder, 5 redirects |
| Platform admin | unchanged | 1 |
| Public website | unchanged | 126 |

**New real routes:** `/app/contacts`, `/app/contacts/new`, `/app/contacts/:contactId`,
`/app/contacts/:contactId/edit`, `/app/contacts/duplicates`, `/app/accounts`,
`/app/accounts/new`, `/app/accounts/:accountId`, `/app/accounts/:accountId/edit`.

**Still placeholders (49 route entries):** calendar · leads board/sources/import/duplicates ·
contacts import · deals pipelines/lost-reasons · campaigns · tickets · knowledge base ·
customer success · products · quotes · orders · contracts · recurring revenue · inbox ·
documents · projects · analytics · workflows · AI assistant · integrations · developer ·
customization · industry templates · partners · field sales · portal preview · administration.
Each states the module's real name and description from the registry and links onward.

---

## 3. Components created or reused

| Source | Created | Reused |
| --- | ---: | ---: |
| `@crm/ui` | 0 new components (1 test module, 1 ambient type file) | all 48 + `charts` + `kanban` |
| `apps/crm` | 2 screen modules (`ContactsScreens.tsx`, `AccountsScreens.tsx`) | the full shared furniture set |
| `packages/mock-services` | 1 shared helper (`productFamilyFor`, `ProductCatalogItem`) | the query engine and store |

Both screen modules read from the same shared furniture Batch 5 established: `PageHeader`,
`FilterBar`, `RecordHeader`, `ListSkeleton`, `formatMoney`, `formatDate`, the `useAsync` /
`useList` / `useMutation` hooks and the `ServiceProvider` context. No new provider, chart or
table primitive was needed, which is the clearest sign the Batch 5 foundation was the right
shape.

---

## 4. Interactive mock workflows completed

1. Open the contacts directory, filter by facet, pick a saved view, and share the URL.
2. Open a contact and read its per-channel consent state, timeline, deals and tickets.
3. Open the contact's account with one click ("Open Customer 360").
4. Review duplicate candidates, resolve each conflicting field, and merge — then read the
   notice explaining what the demo did *not* do.
5. Create and edit a contact and an account with validation and unsaved-changes protection.
6. Filter accounts by health, type, tier and owner; bulk-assign an owner.
7. Read the account's health components and the signals behind them.
8. Switch to the Hierarchy tab, read the rolled-up revenue, and move an account in the
   hierarchy — confirming the dialog will not offer a descendant as a parent.
9. Read the buying committee and the associated documents.
10. Create an account whose parent is another account.

---

## 5. Files created or modified

| Area | Files |
| --- | ---: |
| `apps/crm/routes` (contacts, accounts) | 2 new |
| `apps/crm/app` (router) | 1 modified |
| `apps/crm` (vite config) | 1 modified |
| `packages/ui` (exports, test, ambient types) | 3 (1 modified, 2 new) |
| `packages/mock-services` (seed, store, tests) | 4 modified |
| **Total** | **11** |

Approximately 3,340 lines of new screen code (1,799 in `ContactsScreens.tsx`, 1,540 in
`AccountsScreens.tsx`) plus a 155-line component test suite.

---

## 6. Tests executed and their results

```
TypeScript (6 packages + 3 apps)   PASS   0 errors
astro check (20 files)             PASS   0 errors, 0 warnings, 0 hints
ESLint (whole repository)          PASS   0 errors, 3 warnings
Vitest unit project                PASS   72 / 72 tests
Vitest dom project                 PASS    8 /  8 tests
astro build — website              PASS   126 pages
check-links — 126 HTML files       PASS   15,093 / 15,093 resolved
vite build — CRM                   PASS   0 chunks over 500 kB
vite build — platform admin        PASS   391 kB single chunk
```

### New tests

- **`packages/ui/src/components/kanban.test.tsx`** (8 tests). jsdom has no layout or
  geometry, so a dnd-kit drop cannot be simulated there. The suite therefore exercises the
  shared `onMove` path through the two input methods that *can* be driven in jsdom — the
  per-card stage controls and the list selector — and asserts they produce **identical**
  service calls. It also covers a rejected move leaving the card in place and announcing the
  reason, a locked column refusing a drop without calling the service, the success
  announcement, the boundary controls being disabled at the ends of the pipeline, the locked
  option being disabled in the list, and an axe smoke pass over `PipelineList` (with the
  `region` and `color-contrast` rules disabled, since jsdom does not compute layout or
  paint).
- **Two seed-integrity tests** in `packages/mock-services` (unit project):
  - **no account is its own ancestor** — walks every parent chain and fails on a cycle;
  - **every deal product line references a product owned by the same tenant** — and asserts
    the three tenants produce at least two distinct catalogue signatures, so the fix is
    observable rather than merely asserted.

### The three ESLint warnings

All three are informational `react-hooks/incompatible-library` findings where the React
Compiler declines to memoise a component: TanStack Table (`data.tsx`), and React Hook Form in
`DealsScreens` and `LeadsScreens`. Two more findings appeared in this batch's own forms
because they used RHF's `watch()`; those were **fixed rather than suppressed** by switching to
`useWatch()`, which returns a value instead of an unmemoizable function. The three that remain
are in code this batch did not introduce.

---

## 7. Defects the tests found, and how they were fixed

Every one of these was a genuine defect, and three of them were only visible by running the
application rather than by type checking it.

| # | Defect | How it surfaced | Fix |
| --- | --- | --- | --- |
| 1 | **The account page crashed with "Invalid array length".** `descendantsOf` walked parent→child links with no cycle guard, so a self-referential account made it loop until the result array overflowed. | Browser smoke test against the dev server — the account detail route rendered React's error boundary. | Rewrote `descendantsOf` with a single parent index and a `seen` set, so the walk is both linear and cycle-safe. |
| 2 | **An account was its own parent.** The generator set `parentAccountId` to `max(1, index - 4)`, which for `index 0` resolved to `1` — the account's own id. | Found while diagnosing #1. | The parent is now required to be strictly earlier (`index >= 1`), and the parent-wiring loop discards any self-reference as a second line of defence. |
| 3 | **Non-technology tenants sold software.** `makeDeals` and `makeProducts` both read the technology catalogue regardless of the tenant's industry, so a manufacturing tenant's deal lines referenced licence SKUs it does not sell. | Caught while reviewing the seeded output for the new screens. | Added `productFamilyFor(industryId)` as the single source of truth in `pools.ts`; both generators call it. Verified by the new product-line ownership test. |
| 4 | **Persisted datasets could keep the bad hierarchy.** `MockDb` keeps a `localStorage` copy and only reseeds when the stored version matches. | Reasoning about returning reviewers. | Bumped `STORAGE_VERSION` to 2 so a stale copy is discarded. |
| 5 | **`kanban.test.tsx` failed to typecheck.** The UI package's `tsc` run does not include the vitest setup file, so jest-dom and vitest-axe matchers were unknown. | `npm run typecheck`. | Added `vitest-matchers.d.ts`, which augments vitest's `Assertion` with the jest-dom and vitest-axe matcher types. |
| 6 | **Two React Compiler findings in the new forms.** RHF's `watch()` returns a function the Compiler cannot memoise. | `npm run lint`. | Replaced `watch('field')` with `useWatch({ control, name })`. |
| 7 | **`records-sales.ts` failed to typecheck after the catalogue change.** `productCatalog` is `as const`, so indexing it by family produced a *union of tuples* that `random.pick` could not pick an element out of. | `npm run typecheck`. | Added `ProductCatalogItem` and annotated the local catalogue as `readonly ProductCatalogItem[]`. |
| 8 | **Account form raised the lint `Alert tone="error"` and dynamic Tailwind classes.** A tone that does not exist, and classes built from strings that Tailwind cannot see. | `npm run typecheck` / review. | Corrected the tone and wrote the visual-state classes out as literal maps (`HEALTH_DOT`). |

---

## 8. Build and typecheck status

| Target | Typecheck | Lint | Tests | Build |
| --- | --- | --- | --- | --- |
| `packages/design-tokens` | PASS | PASS | n/a | n/a |
| `packages/shared-types` | PASS | PASS | n/a | n/a |
| `packages/configuration` | PASS | PASS | n/a | n/a |
| `packages/localization` | PASS | PASS | n/a | n/a |
| `packages/ui` | PASS | PASS | 8 / 8 (dom) | n/a |
| `packages/mock-services` | PASS | PASS | 72 / 72 (unit) | n/a |
| `apps/website` | PASS | PASS | no suites yet | PASS — 126 pages |
| `apps/crm` | PASS | PASS | no suites yet | PASS — no chunk warnings |
| `apps/platform-admin` | PASS | PASS | n/a | PASS |

### Bundle output (CRM) — before and after

```
                       Batch 5        Batch 6
index                  758.60 kB       55.00 kB
mock-services               —        347.68 kB   (own chunk)
ui                          —        302.30 kB   (own chunk)
vendor                 322.91 kB     300.77 kB
charts                 430.11 kB     430.11 kB   (lazy, analytics only)
forms                       —        116.94 kB
reference-data              —         79.93 kB
ContactsScreens             —         47.85 kB   (lazy, new)
dnd                     46.79 kB      46.79 kB   (lazy, deals only)
LeadsScreens            45.08 kB      45.03 kB   (lazy)
DealsScreens            42.02 kB      41.90 kB   (lazy)
AccountsScreens             —         41.88 kB   (lazy, new)
```

The largest chunk is now `charts` at 430 kB, which is lazy and only loaded by analytics.
Vite's "larger than 500 kB" warning is gone.

---

## 9. Responsive and accessibility findings

### Accessibility work in this batch

- The health indicator on the account table is a dot **plus** a text label, never colour
  alone; the same is true of the consent state on a contact.
- Health components and signals each carry their rationale and suggested action as text, so
  the score is explainable without reading a chart.
- The hierarchy "Move in hierarchy" dialog excludes the account itself and its own
  descendants from the parent options, so the destructive choice is not offered rather than
  rejected after the fact.
- The duplicate review writes nothing without an explicit per-field choice and states what it
  does not do.
- Every new icon-only control carries an accessible name; the density toggle is a real
  button with an `aria-pressed` state rather than a decorative icon.

### Verified by running the application

The dev server was driven with a real browser for this batch rather than only type-checked.
Verified with **zero console errors**:

- the accounts list (46 accounts, KPI row, saved views, table);
- an account's Customer 360 detail, and each of its five tabs, including the hierarchy
  roll-up arithmetic ($73,000 + $531,000 = $604,000) and the honest empty "Documents" state;
- the contacts list, a contact detail, the duplicate review, and the account form.

This is also what surfaced defects #1 and #2 above, which no static check would have caught.

### Not measured

Still **no axe run on any CRM screen**, **no Lighthouse run**, and **no responsive overflow
assertion** at the eight target widths. The kanban board's fixed 17rem columns remain the most
likely source of overflow at 360px and are the first thing to check. These are the same gaps
the Batch 5 report recorded and they are not yet closed.

---

## 10. Known issues

### Performance

1. **The charts chunk is 430 kB.** It is lazy, so only analytics pays for it, but Recharts is
   still the single largest dependency for the four chart shapes actually used. Replacing it
   with direct SVG remains worthwhile.
2. **`mock-services` is 347 kB** because it ships the full TypeScript source and the seed
   data. It could be trimmed if the seeded dataset were generated from a more compact
   specification, but source-only packages are a deliberate trade-off.

### Scope

3. **49 CRM routes still render a placeholder.** The remaining modules are roughly two
   fifths built. The service layer for many of them exists; the screens do not.
4. **The product catalogue screen is still not built**, so the deal detail's product table
   remains read-only and says so. With the catalogue now correct per tenant, this is the
   obvious next surface.
5. **Platform administration is still a landing page**, not the console.

### Quality

6. **No automated test for any CRM screen.** The kanban board now has a component test and
   the mock services are covered; nothing above them is. The account hierarchy walk in
   particular was fixed without a regression test on the screen itself.
7. **No screenshot or visual regression testing.**
8. **The organization switcher still reloads the page.** Correct for isolation; better once
   there is a cache to reset.

---

## 11. Remaining frontend work

Ordered by dependency:

1. **Product catalogue screen** — the data is now correct per tenant, and the deal detail
   already renders its lines.
2. **Support screens** (tickets, queue, SLA) — the report's own next candidate: the derived
   SLA states already exist in the service layer.
3. **Analytics screens** — the chart components exist and are already used by the dashboard.
4. **Workflows, AI and integrations screens** — the workflow and AI service layers are
   implemented and tested.
5. **Administration screens** — organization, users, roles, security, data and billing.
6. **Platform-owner console.**
7. **Component and end-to-end test suites**, plus axe and Lighthouse measurement.
8. **Remaining website page templates.**

---

## 12. Suggested next batch

**Batch 7 — the product catalogue, quotes and orders.**

Rationale: the seed now produces the correct catalogue per tenant and the deal detail already
renders product lines, so the read side exists. Building the catalogue surface completes the
connection from a deal line back to the product it references, and it reuses the same
list/detail/form pattern this batch and the previous one established.

Scope:

1. **Products**: catalogue with variants, bundles, recurring lines and multiple price books
   per currency, using the now-correct per-tenant catalogue.
2. **Quotes**: line-item editing with live totals, recurring and one-off lines in one quote,
   and discount thresholds presented as requiring approval (honestly labelled, not simulated
   as an approval workflow).
3. **Orders**: convert an accepted quote into an order and track activation state.
4. **A regression test for the account hierarchy walk**, so defect #1 cannot return, and, if
   time allows, a first axe pass on one CRM screen.

Exit criteria: a deal line links to a real product in its own tenant's catalogue; a quote can
be built from those products and its totals are correct; the bundle stays clear of the 500 kB
warning.
