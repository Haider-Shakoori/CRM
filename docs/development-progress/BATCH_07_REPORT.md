# Batch Report — Batch 7

**Batch:** 7 — Products, quotes and orders (and two cross-cutting fixes)
**Date:** 2026-10-14
**Repository state:** all three applications build; every check green; no chunk over 500 kB
**Prior report:** [`BATCH_06_REPORT.md`](./BATCH_06_REPORT.md)

---

## 1. Features implemented

### Products — the catalogue

- **Catalogue** — the per-tenant product catalogue the previous batch's seed work made
  correct. A tabbed surface: **Catalog** (the product table with SKU, family, unit, list
  price, status and a margin column), **Price books** (the books available per currency) and
  **Categories**. A KPI row is derived from `revenueSummary()` — active products, catalogue
  value, products per family — rather than invented.
- **Detail** — Overview (description, family, unit of measure, tax treatment), **Pricing**
  (the price-book entry for the product, with recurring and one-off prices shown separately)
  and **Deals** (every deal line that references the product, proving the deal → product link
  is real and tenant-scoped).
- **Form** — React Hook Form + Zod, with status and unit-of-measure selects driven through
  `useWatch` so the visual state is derived rather than stored.

### Quotes — the builder

- **List** — 20 seeded quotes with a KPI row (total quotes, open, open value, acceptance rate,
  pending approvals), status facets and a table whose status column is text, never colour
  alone.
- **Detail** — the surface this batch exists for:
  - **Line items** edited inline. Each row (`QuoteLineRow`) is a self-contained unit keyed by
    its own identity plus its editable fields, so a re-price remounts the row rather than
    pushing state through an effect.
  - **Live totals** (`TotalsPanel`): subtotal, line discounts, order discount, net subtotal,
    tax and grand total, plus the recurring breakdown (one-off / monthly / quarterly /
    annual / annualised) and a margin line that states its own assumption.
  - **Add a line** from the tenant's catalogue (`AddLineDialog`), with an estimated line net
    shown before committing.
  - **Approval** (`ApprovalPanel`): the seeded approval steps with their state, and an
    Approve / Reject decision per step. Rejecting a step moves the quote to `revised`.
  - **History** (`RevisionHistory`): the version chain produced by `revise`, so a reissued
    quote shows what it replaced.
- **Form** — create/edit a quote header (account, optional deal, dates, contract term,
  currency, billing frequency, notes), with the account chosen from a searchable select.

### Orders — activation and billing state

- **List** — orders created from accepted quotes, with KPIs (all orders, order value,
  awaiting activation, outstanding balance) and a status / payment column pair.
- **Detail** — the order's line items (read-only, because an order is a committed artefact),
  the totals, the billing block (**Billing state, Invoiced, Paid, Balance**) and the
  fulfilment block. Three actions appear only when their precondition holds:
  - **Activate order** — only while the order is awaiting activation;
  - **Record payment** — a dialog that adds to the paid amount and re-derives the balance;
  - **Cancel order** — with a reason.
  The billing and fulfilment blocks each carry an explicit disclaimer: the figures are CRM
  records, not an accounting ledger, and recording a payment does not move money; there is no
  provisioning or service-delivery integration.

### The pricing engine

`priceQuoteLine` and `computeQuoteTotals` (both exported from `@crm/mock-services`) are the
**sole** source of quote and order monetary arithmetic. No screen computes a total in the
browser: every line change calls the service, which re-prices and returns the document, and
the screen renders only what came back. Tax is always zero and carries a `taxNote`; margin
falls back to a stated 40 %-of-list cost rather than pretending to know the real cost.

### Two cross-cutting fixes

- **The `w-full` token collision** (§7, defect 1). A pre-existing design-system bug that made
  every `w-full` element — i.e. every form control, card and table — 1440 px wide.
- **Repository-wide mojibake** (§7, defect 2). Double-encoded UTF-8 (as cp1252) had corrupted
  punctuation and non-Latin text across 26 files.

---

## 2. Pages and routes created

| Surface | Real screens | Routes |
| --- | ---: | ---: |
| CRM application | +10 (products ×4, quotes ×4, orders ×2) | 38 real, 46 placeholder, 5 redirects |
| Platform admin | unchanged | 1 |
| Public website | unchanged | 126 |

**New real routes:** `/app/products`, `/app/products/new`, `/app/products/:productId`,
`/app/products/:productId/edit`; `/app/quotes`, `/app/quotes/new`, `/app/quotes/:quoteId`,
`/app/quotes/:quoteId/edit`; `/app/orders`, `/app/orders/:orderId`.

**New placeholder entries:** `products/*`, `quotes/*`, `orders/*` — each still states the
module's real name and description from the registry and links onward. The three former
top-level placeholders for products, quotes and orders are now real screens.

**Still placeholders (46 entries):** calendar · leads board/sources/import/duplicates ·
contacts import · deals pipelines/lost-reasons · campaigns · tickets · knowledge base ·
customer success · contracts · recurring revenue · inbox · documents · projects · analytics ·
workflows · AI assistant · integrations · developer · customization · industry templates ·
partners · field sales · portal preview · administration.

---

## 3. Components created or reused

| Source | Created | Reused |
| --- | ---: | ---: |
| `@crm/ui` | 0 new components | all 48 + `charts` |
| `apps/crm` | 3 screen modules (`ProductsScreens.tsx`, `QuotesScreens.tsx`, `OrdersScreens.tsx`) | the full shared furniture set |
| `packages/mock-services` | 3 services, 2 exported pure functions | the query engine and store |
| `packages/design-tokens` | 1 regression test | — |

All three screen modules read from the same shared furniture the previous batches
established: `PageHeader`, `RecordHeader` (now with an optional `backTo`), `FilterBar`,
`ListSkeleton`, `formatMoney`, `formatDate`, `formatNumber`, the `useAsync` / `useList` /
`useMutation` hooks and the `ServiceProvider` context. No new provider, chart or table
primitive was needed — the clearest sign the foundation was the right shape.

---

## 4. Interactive mock workflows completed

1. Browse the catalogue, switch between Catalog, Price books and Categories, and filter by
   status.
2. Open a product and read its pricing and the deals that reference it.
3. Create and edit a product with validation.
4. Browse quotes, filter by status, and read the KPIs.
5. Open a quote, edit a line inline, add a line from the catalogue, and apply an order
   discount — watching the totals, the recurring breakdown and the margin re-price each time.
6. Approve an approval step, and confirm that a quote in a non-editable state disables line
   editing.
7. Read a quote's revision history after reissuing it.
8. Create a quote, land on its detail page, and read the honest empty state.
9. Browse orders, filter, and read the KPIs.
10. Activate an order awaiting activation and confirm its status changes and the action
    disappears.
11. Record a payment and confirm the paid amount and balance move by exactly that amount.
12. Read the billing and fulfilment disclaimers on an order.

---

## 5. Files created or modified

| Area | Files |
| --- | ---: |
| `apps/crm/routes` (products, quotes, orders) | 3 new |
| `apps/crm/app` (router) | 1 modified |
| `apps/crm/components` (shared `RecordHeader.backTo`) | 1 modified |
| `packages/mock-services` (services, tests) | 2 modified |
| `packages/shared-types` (revenue, services) | 2 modified |
| `packages/design-tokens` (tokens.css fix + test) | 2 (1 modified, 1 new) |
| `packages/ui` (container variant) | 1 modified |
| `apps/website` (Section container variant) | 1 modified |
| `vitest.config.ts` | 1 modified |
| Repository-wide mojibake repair | 26 modified |
| **Total touched** | **~40** |

Approximately **2,291 lines** of new screen code — 766 in `ProductsScreens.tsx`, 1,094 in
`QuotesScreens.tsx`, 431 in `OrdersScreens.tsx` — plus the mock-service and pricing-engine
work below them.

---

## 6. Tests executed and their results

```
TypeScript (6 packages + 3 apps)   PASS   0 errors
ESLint (whole repository)          PASS   0 errors, 3 warnings
Vitest unit project                PASS   90 / 90 tests
Vitest dom project                 PASS    8 /  8 tests
astro build — website              PASS   126 pages
check-links — 126 HTML files       PASS   15,093 / 15,093 resolved
vite build — CRM                   PASS   0 chunks over 500 kB
vite build — platform admin        PASS   391.01 kB single chunk
```

### New tests

The suite grew from **80 to 98** (unit 72 → 90, dom unchanged at 8).

- **Quote pricing engine** (`packages/mock-services`) — line discount arithmetic, order
  discount applied to the net subtotal, the recurring split, the annualised total, and that
  `computeQuoteTotals` is the single source of truth for a document re-price.
- **Products, quotes and orders** (`packages/mock-services`) — the products list is
  tenant-scoped; `revise` clones forward with a new reference and a version chain;
  `convertToOrder` refuses anything that is not accepted/approved and refuses while an
  approval step is `pending`, returning a typed `validation_failed`; recording a payment
  moves the balance by exactly the amount.
- **Account hierarchy walk** (`packages/mock-services`) — the regression test the Batch 6
  report asked for (its defect 1). It walks every parent chain and fails on a cycle, now
  against the real seeded dataset.
- **Design tokens — Tailwind theme bridge** (`packages/design-tokens`, 3 tests) — a guard
  that fails if a `--container-*` key is reintroduced that shadows a Tailwind static width
  utility (see defect 1). It read the CSS and asserts no collision, so the exact bug cannot
  silently return.

### The three ESLint warnings

All three are informational `react-hooks/incompatible-library` findings where the React
Compiler declines to memoise a component: TanStack Table (`data.tsx`) and React Hook Form in
`DealsScreens` and `LeadsScreens`. Two more findings appeared in this batch's own forms
because they used RHF's `watch()` and one used a `setState`-in-effect; those were **fixed
rather than suppressed** by switching to `useWatch()` and by key-remounting the edited row.
The three that remain are in code this batch did not introduce.

---

## 7. Defects the tests found, and how they were fixed

| # | Defect | How it surfaced | Fix |
| --- | --- | --- | --- |
| 1 | **Every `w-full` element was 1440 px wide** — all form controls, cards and tables overflowed to full viewport width and overlapped. Pre-existing, repository-wide. | Browser smoke test: the create-quote form could not be clicked because a sibling card's field "intercepted pointer events". Measuring showed every control was exactly the viewport width. | The design-tokens bridge exposed `--w-full: 90rem` as `--container-full`. Tailwind v4's `--container-*` namespace feeds **both** `max-w-*` and `w-*`, so it emitted `.w-full { width: 100%; width: var(--w-full) }` — overriding the built-in `w-full` with 90 rem. Removed the `full` key from the bridge (the widest page container now references `max-w-[var(--w-full)]` in the two places that used it) and added a regression test. |
| 2 | **Mojibake across 26 files** — em dashes, curly quotes, arrows, `⌘`, `×`, `▲▼■`, umlauts, and Arabic / Persian / Chinese / Japanese / Devanagari text had been double-encoded as cp1252. | Reading the files and the rendered UI. | A general, RFC-compliant recovery: map each character back to its cp1252 byte, then strict-decode runs of those bytes as UTF-8. 48 distinct transformations, all audited correct; idempotent; legitimately encoded non-Latin text is preserved by construction. |
| 3 | **`QuoteLineRow` pushed state through an effect** to react to a new line total. | `npm run lint`. | The parent now keys the row by its identity plus its editable fields, so the row remounts on a re-price. The effect is gone. |
| 4 | **`QuoteForm` read `Date.now()` during render**, which is impure. | `npm run lint`. | Moved into a `React.useState` lazy initializer so the default dates are computed once. |
| 5 | **Two new forms used RHF's `watch()`**. | `npm run lint`. | Replaced with `useWatch({ control, name })`, which returns a value instead of an unmemoizable function. |
| 6 | **The mock-services unit suite referenced the wrong revenue-overview type.** `revenueSummary()`'s return type is inferred, so importing the named type produced an unused-import error. | `npm run typecheck`. | Dropped the import and let the type be inferred. |

---

## 8. Build and typecheck status

| Target | Typecheck | Lint | Tests | Build |
| --- | --- | --- | --- | --- |
| `packages/design-tokens` | PASS | PASS | 3 / 3 (unit, new) | n/a |
| `packages/shared-types` | PASS | PASS | n/a | n/a |
| `packages/configuration` | PASS | PASS | n/a | n/a |
| `packages/localization` | PASS | PASS | n/a | n/a |
| `packages/ui` | PASS | PASS | 8 / 8 (dom) | n/a |
| `packages/mock-services` | PASS | PASS | 87 / 87 (unit) | n/a |
| `apps/website` | PASS | PASS | no suites yet | PASS — 126 pages |
| `apps/crm` | PASS | PASS | no suites yet | PASS — no chunk warnings |
| `apps/platform-admin` | PASS | PASS | n/a | PASS |

### Bundle output (CRM) — before and after

```
                       Batch 6        Batch 7
index                  55.00 kB       56.08 kB
mock-services         347.68 kB      365.41 kB
ui                    302.30 kB      302.28 kB
vendor                300.77 kB      300.77 kB
charts                430.11 kB      430.11 kB   (lazy, analytics only)
forms                 116.94 kB      116.94 kB
reference-data         79.93 kB       79.93 kB
ContactsScreens        47.85 kB       47.85 kB   (lazy)
dnd                    46.79 kB       46.79 kB   (lazy, deals only)
LeadsScreens           45.03 kB       44.77 kB   (lazy)
DealsScreens           41.90 kB       41.90 kB   (lazy)
AccountsScreens        41.88 kB       41.55 kB   (lazy)
QuotesScreens              —          35.09 kB   (lazy, new)
ProductsScreens            —          25.98 kB   (lazy, new)
OrdersScreens              —          13.77 kB   (lazy, new)
```

The largest chunk is still `charts` at 430 kB, which is lazy and only loaded by analytics.
Vite's "larger than 500 kB" warning remains absent; the three new screens each land in their
own small lazy chunk.

---

## 9. Responsive and accessibility findings

### Accessibility work in this batch

- Status is always text **plus** a tone, never colour alone — true of a product's status, a
  quote's status and an order's status and payment state.
- Every control is offered only when its precondition holds: no "Convert to order" on a
  draft, no "Activate order" on an already-activated order, line editing disabled on a
  non-editable quote. The destructive or invalid choice is absent rather than rejected
  afterwards.
- The payment, cancel and approval dialogs each carry an accessible title and a description;
  the honest disclaimers are real text, not tooltips.
- Every icon-only control carries an accessible name.

### Verified by running the application

The dev server was driven with a real browser. Verified with **zero console errors**:

- the products list (12 active products, KPIs, Catalogue / Price books / Categories tabs) and
  a product detail with its Pricing and Deals tabs;
- the quotes list (20 quotes, KPIs) and a quote detail with its Line items, Approval and
  History tabs, including approving a step and confirming editing then locks;
- the full **create-quote** flow end to end (fill, pick an account from 46 options, submit,
  land on the new draft);
- the orders list (12 orders, KPIs) and an order detail, including **activating** a pending
  order (status flipped, button disappeared) and **recording a payment** (paid +$1,000,
  balance −$1,000, toast shown).

The `w-full` defect (§7, defect 1) was found by exactly this; no static check would have
caught it.

### Not measured

Still **no axe run on any CRM screen**, **no Lighthouse run**, and **no responsive overflow
assertion** at the eight target widths. These remain the same gaps the Batch 5 and 6 reports
recorded.

---

## 10. Known issues

### Correctness

1. **Quotes seed has no `draft` or `revised` quote**, so inline line editing is only reachable
   on a `pending_approval` quote in the seeded data. Creating a quote does produce a draft,
   but the demo would be stronger with a seeded draft and a seeded revised quote.
2. **`convertToOrder` cannot be exercised against the seed** for the same reason — no seed
   quote is in the exact accepted/approved state the guard requires at a moment when no
   approval step is pending.

### Performance

3. **`mock-services` grew to 365 kB** because it ships the full TypeScript source and the seed
   data. Source-only packages remain a deliberate trade-off.
4. **The charts chunk is still 430 kB.** Lazy, but Recharts is still the single largest
   dependency for the four chart shapes actually used.

### Scope

5. **46 CRM routes still render a placeholder.**
6. **Platform administration is still a landing page**, not the console.

### Quality

7. **No automated test for any CRM screen.** The mock services and the token bridge are
   covered; the screens above them still are not.
8. **No screenshot or visual regression testing.** The `w-full` defect is a good argument for
   adding at least one.

---

## 11. Remaining frontend work

Ordered by dependency:

1. **Service and support** (tickets, queues, SLA, knowledge base, inbox) — the service layer
   and the SLA derivation already exist and are tested.
2. **Contracts, recurring revenue and customer success** — completes the post-sale revenue
   lifecycle that quotes and orders opened.
3. **Analytics screens** — the chart components exist and are already used by the dashboard.
4. **Workflows, AI and integrations screens** — the workflow and AI service layers are
   implemented and tested.
5. **Administration screens** — organization, users, roles, security, data and billing.
6. **Platform-owner console.**
7. **Component and end-to-end test suites**, plus axe and Lighthouse measurement, and a first
   visual-regression baseline.
8. **Remaining website page templates.**

---

## 12. Suggested next batch

**Batch 8 — Service and support: the ticket queue with SLA states, the knowledge base, and the
omnichannel inbox.**

Rationale: the tickets, knowledge-base and conversations service layers already exist and are
covered by the unit suite, and the derived SLA states are already computed in the service
layer — so this batch, like Batch 7, is mostly screen work over a tested foundation. It also
exercises a genuinely different screen shape from the commerce surfaces: a queue with timers
and escalation, and a composer.

Scope:

1. **Tickets**: the queue with SLA targets, pause windows and escalation shown honestly, a
   ticket detail with its conversation thread, and priority/assignee changes.
2. **Knowledge base**: article list and reader, with structured blocks and helpfulness voting
   that is recorded rather than faked.
3. **Inbox**: one queue across channels with shared-inbox framing and saved replies, labelled
   so nothing implies a real messaging integration.
4. **If time allows**: the first axe pass on one CRM screen, and a seeded `draft` and
   `revised` quote so Batch 7's `convertToOrder` guard is reachable from the demo.

Exit criteria: a ticket's SLA state is visible and derived, a knowledge article renders its
blocks, the inbox presents one queue across channels without implying a live integration, and
the bundle stays clear of the 500 kB warning.
