# Batch Report — Batch 17: Subscription and SaaS administration

**Scope:** contract lifecycle (renew, amend, terminate, expiring window), invoice settlement
(mark paid, record payment, void), the recurring-revenue report, and the screens over them.
**Date implemented:** 2026-10-15. **Date verified:** 2026-10-15, in the same session —
the verification pass ran while the batch was still open, as Batch 16 established.
**Status: Complete** against the brief's "Interactive mock" bar. No backend exists and none is
claimed: money does not move, documents are not stored, and no payment provider is called.

Every number in §6–§8 below was measured on 2026-10-15 on this code. Where something was not
run, the row says so instead of carrying a figure forward.

---

## 1. Features implemented

### Service layer (`packages/mock-services`)

Two modules whose interfaces were declared but unimplemented, and one whose read was rewritten.

| Module | Methods | Notes |
| --- | --- | --- |
| `contracts` | `list, get, create, update, remove, bulkRemove, renew, terminate, amendment, expiring` | CRUD comes from `createCrud`; the four lifecycle verbs are hand-written ([`services/index.ts:3504`](../../packages/mock-services/src/services/index.ts#L3504)). `renew` writes a successor record and closes the original (`status: 'renewed'`, `renewalId` on the original, `previousContractId` on the renewal). `terminate` requires a reason, sets `autoRenew: false` and blocks every further lifecycle verb. `amendment` appends a versioned entry and re-derives `annualisedValue` from the new value and term. `expiring(withinDays)` returns in-window contracts for the active organization, soonest first. |
| `invoices` | `list, get, create, update, remove, bulkRemove, markPaid, void, recordPayment` | [`services/index.ts:3649`](../../packages/mock-services/src/services/index.ts#L3649). `markPaid` settles the balance and refuses to run twice. `recordPayment` accumulates partial payments, moves the invoice to `payment_pending` and settles it when the balance reaches zero, clearing `dunningStage`. `void` requires a reason, zeroes the balance and refuses a settled invoice — voiding money that has already been recorded would be a claim about a refund that did not happen. |
| `subscriptionRevenue` | `list, update, report` | [`services/index.ts:2669`](../../packages/mock-services/src/services/index.ts#L2669). The read was scoped to the active tenant and `report()` rewritten; see §7. |

Wired into the container at [`services/index.ts:4334`](../../packages/mock-services/src/services/index.ts#L4334), taking the implemented count from 51 to **53 of 56**. The three
still unimplemented — `integrations`, `developer`, `platformAdmin` — stay declared so a screen
that needs one fails to compile rather than quietly receiving an empty object.

### Screens

| Screen | What it does |
| --- | --- |
| Contracts list (`/app/contracts`) | Search, status filter, an expiring-window filter (30/60/90 days, composed as `status in [active, expiring_soon]` + `daysUntilExpiry` bounds), sortable columns, removable filter chips, four `MiniStat`s (active contracts, active value, expiring in 90 days, auto-renew %) and pagination. Rendered 18 rows for the Vertex tenant. |
| Contract detail (`/app/contracts/:contractId`) | Record header with lifecycle status and signature state, value/annualised/term/ends/owner strip, an expiry alert naming the notice period, terms property list, document entries (metadata only, each marked `placeholder`), amendment history with version, previous/renewal links, and the three lifecycle dialogs. |
| Invoices list (`/app/subscriptions/invoices`) | Search, status filter, columns for status, dunning, issued, due, total and balance; `MiniStat`s for outstanding, overdue amount, overdue count and collected this period. Rendered 14 rows. |
| Invoice detail (`/app/subscriptions/invoices/:invoiceId`) | Amounts property list (subtotal, discounts, tax, total, paid, balance, paid date), account/contract/order links, payment method and masked reference, the overdue alert when the balance is past due, and the three settlement dialogs. Settled invoices lose the controls entirely. |
| Recurring revenue (`/app/subscriptions`) | Two `KpiRow`s (MRR/ARR, NRR/GRR, net new, churn rate, LTV, average revenue per account, payback, contraction), the MRR movement bridge, a 12-month trend table, by-plan / by-segment / by-region splits, top accounts by MRR and a cohort retention grid. |

### Honesty controls added in this batch

- The MRR bridge reconciles by construction: opening + movements = closing, asserted in a unit
  test that recomputes the columns independently ([`modules.test.ts`](../../packages/mock-services/src/services/modules.test.ts)).
- Headline MRR, ARR, average revenue per account, LTV and top accounts are computed over **live
  subscriptions only**; cancelled and expired ones sit in churn, not in the run rate. The MRR
  card says `live subscriptions only`.
- LTV is labelled as what it is: "Average revenue per account × an assumed 34-month lifetime".
  Payback says "Assumed input — no acquisition cost is recorded in this build".
- Trend, cohort, segment and region views keep the standing caption: the monthly shape is
  illustrative and only the headline totals are record-derived.
- Contract document rows are metadata only — "NOTHING IS STORED, PREVIEWED OR DOWNLOADED", and
  signature states are simulated with no e-signature provider connected.
- Invoice detail states that it is a CRM reference record, not an accounting document, and that
  recording a payment updates CRM state only — it does not move money.
- No invented tax: `taxTotal` is $0 and the tax note says tax is recorded by the accounting
  system, not calculated here.
- No fake success: each dialog closes only after the service returns, and the record shown is
  the record the service wrote.

---

## 2. Pages and routes created or edited

| Route | Element | Change |
| --- | --- | --- |
| `/app/contracts` | `ContractsScreens` (default export, list) | new |
| `/app/contracts/:contractId` | `ContractDetail` | new |
| `/app/contracts/*` | `notBuilt` | text updated to name the surfaces that are now built |
| `/app/subscriptions` | `RecurringRevenueScreens` | new |
| `/app/subscriptions/invoices` | `InvoicesScreens` (default export, list) | new |
| `/app/subscriptions/invoices/:invoiceId` | `InvoiceDetail` | new |
| `/app/subscriptions/*` | `notBuilt` | text updated; `/app/subscriptions/commissions` remains an honest placeholder |

Router: [`apps/crm/src/app/router.tsx:261`](../../apps/crm/src/app/router.tsx#L261) and
[:270](../../apps/crm/src/app/router.tsx#L270). Counted from that file: **147** route entries
carry an explicit `path:` — 114 load a lazily-bundled screen, 25 render an honest placeholder,
8 redirect. There is no `/app/contracts/expiring` route; the expiring window is a filter on the
list, and a deep link to that path falls through to the detail screen's "contract could not be
found" state.

---

## 3. Components created or reused

No new `@crm/ui` primitives were needed. Reused: `PageHeader`, `RecordHeader`, `FilterBar`,
`Select`, `DataTable`, `Pagination`, `MiniStat`, `KpiCard`, `KpiRow`, `InlineBar`, `Sparkline`,
`PropertyList`, `Alert`, `Badge`, `StatusBadge`, `Button`, `Field`, `Input`, `Dialog` /
`DialogContent`, `ListSkeleton`, `EmptyState`, `DemoNotice`.

The only file added to the app outside `routes/` is
[`apps/crm/src/vitest-matchers.d.ts`](../../apps/crm/src/vitest-matchers.d.ts), which mirrors
the UI package's matcher typing so the screen tests typecheck (§7, item 8).

---

## 4. Interactive mock workflows completed

Each of the write paths below is exercised by a test that drives the real dialog with
`userEvent`, not by a direct service call:

1. **Renew** — open the dialog, set term, start date and value, submit. The successor links back
   to the original, the original becomes `renewed`, and the Renew control is gone.
2. **Amend** — a new contract value appends an amendment and re-derives the annualised value
   (`round(value × 12 / termMonths)`), verified against an independent recomputation.
3. **Terminate** — blank reason leaves the dialog open and the record untouched (asserted, not
   assumed); a typed reason sets `terminated`, clears `autoRenew` and removes the actions.
4. **Record payment** — a partial payment accumulates into `amountPaid` and reduces `balanceDue`
   without settling; the second, larger payment settles it and clears dunning.
5. **Mark paid** — settles at the due date given and hides the settlement controls.
6. **Void** — requires a reason, records it in `notes`, zeroes the balance, and refuses an
   invoice that has already been paid.
7. **Expiring window** — the 30/60/90-day filter narrows the list to `active`/`expiring_soon`
   records inside the window and shows a removable chip naming it.
8. **Revenue report** — the bridge, retention percentages, per-plan churn and top accounts all
   read from the current organization's subscription records.

---

## 5. Files created or modified

| Path | Change |
| --- | --- |
| `packages/mock-services/src/services/index.ts` | `contracts` and `invoices` modules; container entries; `subscriptionRevenue.report()` rewritten to scope, to separate live from churned MRR, to reconcile the bridge and to derive per-plan churn |
| `packages/mock-services/src/seed/records-extra.ts` | invoice issue/due/paid dates derived from status; one subscription guaranteed to be churned so the bridge is demonstrable |
| `packages/mock-services/src/lib/store.ts` | `STORAGE_VERSION` 3 → **5**, with a changelog line per bump |
| `packages/mock-services/src/services/modules.test.ts` | batch-17 describe: 11 tests covering both modules, the scoped report and invoice date coherence |
| `packages/shared-types/src/revenue.ts` | contract/invoice/subscription fields the lifecycle writes need (`renewalId`, `previousContractId`, amendment document kinds, `RecurringRevenueReport.movementBridge`) |
| `apps/crm/src/routes/contracts/ContractsScreens.tsx` | new — list + detail + three dialogs |
| `apps/crm/src/routes/invoices/InvoicesScreens.tsx` | new — list + detail + three dialogs |
| `apps/crm/src/routes/subscriptions/RecurringRevenueScreens.tsx` | new — the report screen |
| `apps/crm/src/routes/contracts/ContractsScreens.test.tsx` | new — 5 tests |
| `apps/crm/src/routes/invoices/InvoicesScreens.test.tsx` | new — 3 tests |
| `apps/crm/src/vitest-matchers.d.ts` | new — jest-dom matcher types for the app's `tsc` run |
| `apps/crm/src/app/router.tsx` | five routes wired, two catch-all texts corrected |
| `packages/configuration/src/modules.ts` | `contracts` and `subscriptions` registry entries describe the built behaviour, and `subscriptions` gains children for the report, invoices and the still-unbuilt commissions path |
| `vitest.config.ts` | the `dom` project now includes `apps/crm/src/**/*.test.tsx` and inlines the `@crm/*` workspace packages so Vite transforms their TypeScript sources |

---

## 6. Tests executed and their results

```
npx vitest run              170 passed / 170   7 files   38.47s
  unit project              154 passed         4 files
  dom project                16 passed         3 files  (kanban 8, contracts 5, invoices 3)
npm run lint                  0 errors, 6 warnings (the pre-existing react-hooks/incompatible-library
                              findings on TanStack Table and React Hook Form)
npm run typecheck (per workspace)  0 errors — shared-types, ui, mock-services, crm, platform-admin
npm run build                 0 errors, 0 chunks over 500 kB
```

Batch-17 service tests (11): organization scoping, renew linkage, renewal refused on an
unsellable term or value, terminate records the reason and blocks further lifecycle actions,
amendment versioning and re-derivation, `expiring` window and ordering, `markPaid` settling and
refusing a second run, `recordPayment` accumulation, `void` reason + refusal on paid, invoice
date coherence, and the scoped subscription list + report.

Screen tests (8): the five contract cases in §4 items 1–3 plus the list render, and the three
invoice cases in items 4–6.

**Flake note.** In one combined run before the final fixes, `keeps every AI reply labelled as
coming from the demo engine` failed; it passed in isolation and in both full runs since. It
belongs to the same timing-sensitive family as Batch 16's kanban/timer flake and is recorded
rather than hidden.

### Static self-review before execution

The same checks as previous batches: every visible control traced to the service call it
advertises; no new raw colour (all styling through token utilities); no dynamic Tailwind class
names; services reached only through `ServiceProvider`; loading and derived values computed at
render, not pushed into state from an effect; every simulated or assumed figure labelled on the
screen that shows it.

---

## 7. Defects the verification found, and how they were fixed

The pass did not start green. Nine findings, all in the shipped code rather than the tests:

1. **`subscriptionRevenue` read across tenants.** The list and report used the whole
   `revenueSubscriptions` collection. Both now go through `tenantRecords`, matching how the
   batch 9–16 modules scope themselves. A single-tenant test cannot see this; the browser probe
   could.
2. **The bridge opened on an invented number.** `openingMrr` was `mrrTotal * 0.72`. With the
   real movements that produced a bridge whose columns did not sum to its own closing figure —
   measured as $109K + $42.8K − $1.8K − $60.5K against a headline of $151.4K. Opening MRR is now
   *derived* from closing and the movements, and a test recomputes each column independently and
   asserts `bridge[0] + Σ movements === closing`.
3. **Cancelled subscriptions were counted as run rate.** Headline MRR summed active, trialing,
   past-due **and cancelled** records while a separate churn figure also counted them. Live and
   churned sets are now disjoint, and every dependent metric (MRR, ARR, ARPA, LTV, logo
   retention, top accounts) reads the live set.
4. **Per-plan churn was hardcoded** at 2.1 / 4.8 / 9.2 percent while the screen presented those
   as plan figures. Now derived from the plan's own records: Starter 14.3%, Enterprise and
   Professional 0% for the Vertex tenant.
5. **LTV and payback were presented as measured metrics.** Both are functions of inputs this
   build does not hold (an assumed lifetime, no acquisition cost at all). The values are kept
   because the card shape demands a number, but the hints now name the assumption.
6. **Invoices fell due before they were issued.** The seed drew both dates independently, so the
   list — which shows them side by side — displayed records like issued 9/8/26, due 5/21/26.
   Dates are now derived from each other, `overdue` invoices are issued at least 45 days before
   the epoch so they are genuinely past due, and `STORAGE_VERSION` went to 4 because a returning
   reviewer's persisted copy was wrong, not merely old.
7. **The bridge had no churn column.** The dataset could seed zero cancelled subscriptions, which
   made the flagship screen render an empty movement and 100% retention. One subscription is now
   forced to `cancelled` with a `churn` movement and a reason.
8. **An unsettled invoice could sit past its due date without being overdue.** After the date
   fix, several `payment_pending` / `issued` / `draft` records were months past due while the
   overdue summary showed one. The date window is now chosen by status — settled invoices may sit
   anywhere in the last six months, overdue invoices are back-dated past their due date, and
   anything unsettled and not overdue is dated so its due date has not arrived.
   `STORAGE_VERSION` went to **5** and the date-coherence test asserts both directions.
9. **The new screen tests did not typecheck** under `apps/crm`'s own `tsc` run: `toBeInTheDocument`
   was unknown because the vitest setup file is outside that project, and two files carried an
   unused `React` import. Fixed by the matcher-typing declaration described in §3, matching the
   UI package's existing pattern, and by dropping the dead imports.

Tooling finding: `vitest --reporter=basic` no longer exists in vitest 5 and fails to load; the
runs above use the default reporter.

---

## 8. Build and typecheck status

`npm run build` (website, CRM, platform-admin) exits 0. CRM production build, largest chunks:

```
charts           430.11 kB  (lazy — only analytics pays for it)
ui               316.18 kB
vendor           300.77 kB
mock-services    276.79 kB
mock-seed        224.98 kB
forms            116.94 kB
reference-data    79.92 kB
index (entry)     67.11 kB
dnd               46.79 kB
```

No chunk exceeds 500 kB. The `mock-services` chunk is no longer the threshold risk it was at
Batch 16 (494.08 kB, 6 kB from the warning): the seed records now split into their own
`mock-seed` chunk, so `mock-services` sits at 276.79 kB and the entry at 67.11 kB.

Measured browser figures (Vertex tenant, 1280 px, dev server on port 5173):

| Screen | Measurement |
| --- | --- |
| `/app/contracts` | 18 rows, 1–18 of 18; active contracts 14, active value $4.6M, expiring in 90 days 4, auto-renew 50% |
| `/app/contracts/ctr-org-vertex-3` | CT-40004 Expiring Soon, value $561,000, annualised $280,500 over a 24-month term, ends 11/4/26, "Expiring in 22 days", Renew / Amend / Terminate present |
| `/app/subscriptions/invoices` | 14 rows; outstanding $240.9K, overdue $79.4K, overdue count 1, collected this period $126.5K. Balances sum to the outstanding figure exactly ($22,065 + $13,086 + $55,423 + $10,998 + $60,003 + $79,364 = $240,939) |
| `/app/subscriptions/invoices/inv-org-vertex-6` | INV-2026-0006 Overdue, final notice, total $79,364, paid $0, balance $79,364, issued 8/3/26, due 9/2/26, three settlement controls |
| `/app/subscriptions` | Bridge Opening $108.6K → New +$22.8K → Expansion +$5.5K → Reactivation +$14.5K → Contraction −$0 → Churn −$17.1K → Closing $134.3K (reconciles). MRR $134.3K, ARR $1.6M, NRR 123.7%, GRR 84.3%, net new $25.7K, churn rate 7.7% / $17.1K, LTV $380.5K, ARPA $11.2K, logo retention 92.3%, payback 14 months. By plan: Starter $94K / 70% / 14.3% churn, Professional $37.4K / 28%, Enterprise $2.9K / 2% |
| Console | 0 errors and 0 warnings on every route visited |

---

## 9. Responsive and accessibility findings

**Measured:** every screen renders at 1280 px against the dev server; the list tables paginate
rather than overflow at that width; the dialogs are Radix primitives, so focus trap, `Escape`
dismissal and portal containment come from the component rather than from screen code; required
`Field`s render a `*` with an sr-only "(required)" marker, and the terminate/void dialogs refuse
a blank reason instead of accepting a click.

**Not measured:** the batch did not run axe on the new screens, did not assert overflow at the
eight target widths, and did not re-run Lighthouse. The `vitest-axe` coverage in the dom project
still belongs to the kanban suite only.

---

## 10. What could not be verified in the browser, and why

The batch's browser smoke run could not dispatch input at all. The Qoder in-app browsing surface
stays hidden (`document.visibilityState === 'hidden'`), and Chromium delivers no pointer events
to a hidden page: `click` reported success, the Radix dialogs never opened, and `take_screenshot`
returned `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`. That is an environment limit, not a product
defect — it reproduced identically against dialogs that shipped in earlier batches (the Orders
activation dialog, the header Create menu, the theme and density toggles), which rules out
anything specific to Batch 17.

Consequently:

- **Verified in the browser:** navigation, server-rendered structure, every figure in the §8
  table, and the console-error count. Structural probes ran through accessibility snapshots and
  pure-expression script evaluation.
- **Not verified in the browser:** any interaction. Every write path in §4 was instead driven
  through the real components with `userEvent` in jsdom, which is why the `dom` test project now
  covers `apps/crm` screens and why those tests exist at all.
- **Still unverified:** real-browser layout of the new dialogs, focus order inside them, and
  pointer-driven responsive behaviour. A run against a visible browser (or Playwright, whose
  browsers are not installed here) is the outstanding check.

---

## 11. Known issues left by this batch

1. **No dedicated expiring report.** `contracts.expiring(withinDays)` exists and is covered by a
   test, but the list screen reaches the same window through `list()` filter clauses so that it
   composes with search, status and pagination. There is no `/app/contracts/expiring` route.
2. **The contract `MiniStat` strip reads `products.revenueSummary().contracts`**, not the
   contracts module, so the summary figures are the pricing engine's aggregate of the same
   records. Consistent today; worth consolidating when the overview work lands.
3. **Trend, cohort, segment and region views are illustrative shapings** — labelled on the
   screen. Only the headline KPIs and the movement bridge are record-derived.
4. **`/app/subscriptions/commissions` is unbuilt** and renders the honest catch-all.
5. **Dunning stages are presentation only.** The invoice detail says no reminders are sent by
   this build.
6. **Invoice creation has no screen.** `invoices.create` exists in the container; nothing in the
   UI calls it. Recorded so the next billing pass either builds the form or removes the surface
   from expectations.

---

## 12. Remaining frontend work

The three unimplemented service modules — `integrations`, `developer`, `platformAdmin` — and the
25 router placeholders that name them plus documents, goals and module sub-features. Batch 20's
globalization completion and Batch 21's final QA (axe across screens, responsive overflow
assertions, Lighthouse, and a real-browser interaction pass once an interactive surface exists)
are unaffected by this batch.

---

## 13. Suggested next batch

**Batch 18 — platform-owner console (`apps/platform-admin`).** The store already seeds
`platformPlans`, `platformAddOns`, `platformSubscriptions`, `platformInvoices`, `platformUsers`,
`platformRoles`, `platformAudit`, `platformSupportTickets`, `featureFlags`, `moduleCatalog`,
`localizationRows`, `systemStatus` and `maintenanceBanners`, and `PlatformAdminService` is fully
declared, so the work is service-plus-screens: cross-tenant overview, tenant provisioning and
lifecycle, plan and add-on administration, feature flags, the module catalogue, localization
administration, platform audit, support tickets and system status. Implementing it moves the
container from 53 to 54 of 56 and gives the tenant billing screen's platform-side counterpart
somewhere to live. Run the verification pass inside the batch, as Batches 16 and 17 both showed
what deferring hides.
