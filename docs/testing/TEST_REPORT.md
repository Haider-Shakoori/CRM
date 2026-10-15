# Test Report

**Report date:** Batch 17 verified (2026-10-15)
**Environment:** Windows, Node 22.14.0, npm 11.12.1
**Verdict:** type checking, linting, unit and component tests, all three production builds and a
CRM browser structural pass **pass** for batches 9–17. Batch 17 ran its verification inside the
batch; that pass found nine defects in shipped code and fixed all of them (§11). The website link
check and `astro check` figures are still those measured at Batch 16 and Batch 8 respectively —
neither was re-run for Batch 17. Accessibility (axe) and performance (Lighthouse) are still **not
measured** beyond one component-level axe smoke test.

> Nothing in this report is a claim about a test that was not run. Where a suite does not
> exist yet, it says so. Where a number is recorded, it was produced by the command shown.
> **Browser interaction cannot be driven in this environment** — see §8 for what that limits and
> how the Batch 17 write paths were verified instead.

---

## 1. Summary

| Check | Tool | Scope | Result |
| --- | --- | --- | --- |
| TypeScript type checking | `tsc --noEmit` | 6 packages + 3 apps | **PASS** — 0 errors (re-run after Batch 17) |
| Astro type/route checking | `astro check` | 20 website files | **PASS** — 0 errors, 0 warnings, 0 hints (measured at Batch 8; not re-run for Batch 17) |
| Linting | ESLint 10 + typescript-eslint | Whole repository | **PASS** — 0 errors, 6 warnings (re-run after Batch 17) |
| Unit tests | Vitest (`unit` project) | `@crm/mock-services`, `@crm/design-tokens` | **PASS** — 154 / 154 across 4 files |
| Component tests | Vitest (`dom` project) | `@crm/ui` + the CRM contracts and invoices screens | **PASS** — 16 / 16 across 3 files |
| Production build | `vite build` | CRM | **PASS** — 0 chunks over 500 kB (largest `charts` 430.11 kB; `mock-services` 276.79 kB + `mock-seed` 224.98 kB) |
| Browser smoke | Browser automation over the dev server | 5 new Batch 17 routes, structurally | **PARTIAL** — navigation, rendered figures and console-error counts verified; **no click could be dispatched** (§8) |
| Production build | `astro build` | Website | **PASS** — 126 pages (re-run after Batch 17) |
| Internal link integrity | `scripts/check-links.mjs` | 126 HTML files | **PASS** — 15,093 / 15,093 resolved, 0 broken (measured at Batch 16; not re-run for Batch 17) |
| Production build | `vite build` | Platform admin | **PASS** — rebuilt inside `npm run build` after Batch 17; size not re-measured |
| Accessibility audit | `vitest-axe` | Kanban board (1 suite) | **PARTIAL** — see §6 |
| Accessibility audit | `@axe-core/playwright` | Any page | **NOT RUN** — see §6 |
| End-to-end tests | Playwright | Any workflow | **NOT RUN** — see §8 |
| Performance measurement | Lighthouse | Any page | **NOT RUN** — see §7 |

---

## 2. Reproducing these results

```bash
# Type checking, all packages and apps
npm run typecheck

# Linting, whole repository
npm run lint

# Unit tests (mock service layer) and component tests (design system)
npx vitest run                     # both projects
npx vitest run --project unit
npx vitest run --project dom

# Website build and internal link integrity
npm run build:website
node scripts/check-links.mjs apps/website/dist

# Application builds
npx vite build                     # in apps/crm
npx vite build --prefix apps/platform-admin
```

### Recorded output

```
$ npm run typecheck
Result (20 files):
- 0 errors
(6 packages + 3 apps: 0 errors)
```

```
$ npm run lint
✖ 6 problems (0 errors, 6 warnings)
```
The warnings are informational `react-hooks/incompatible-library` findings: the three
pre-existing ones (TanStack Table in `data.tsx`, React Hook Form in `DealsScreens` and
`LeadsScreens`) plus reports from the batches 9–16 screens, where React Compiler notes
TanStack Table's `useReactTable` and React Hook Form's `watch`. All match the pre-existing
pattern; none is suppressed. Batch 7's own forms produced two more React Compiler findings —
RHF's `watch()` and a `setState`-in-effect — and both were fixed (with `useWatch` and a
key-remount) rather than suppressed. The Batch 16 pass found six `react-hooks/set-state-in-effect`
**errors** in the settings screens; they are fixed, not suppressed (see
[`BATCH_16_REPORT.md`](../development-progress/BATCH_16_REPORT.md) §7).

```
$ npx vitest run
 Test Files  7 passed (7)
      Tests  170 passed (170)
   Duration  38.47s
```
By project: the unit project reports **154 / 154** across four files — the mock-services suite
grew from 126 to 140 with the 14 Batch 16 contract tests, then to 151 with the 11 Batch 17 tests
in `modules.test.ts` (§5.3) — and the dom project reports **16 / 16** across three files, the
kanban suite (8) plus the two new CRM screen suites (8).

```
$ node scripts/check-links.mjs apps/website/dist
check-links
  html files:        126
  internal links:    15093
  resolved:          15093
  external links:    386
  in-page anchors:   126

  result: no broken internal links
```
(This block is re-run for Batch 16; the numbers are unchanged because the website was not
touched by batches 9–16.)

```
$ npx vite build      # apps/crm
(no "larger than 500 kB" warning; largest chunk is charts at 430.11 kB, lazy, then ui 316.18 kB,
 vendor 300.77 kB, mock-services 276.79 kB, mock-seed 224.98 kB, entry index 67.11 kB)
```
The `mock-services` chunk is no longer near the threshold: splitting the seed records into their
own `mock-seed` chunk moved the pair from a single 494.08 kB chunk (measured at Batch 16) to
276.79 kB + 224.98 kB.

---

## 3. What the link checker actually verifies

**Verified**

- Every `href` beginning with `/` in every built HTML file resolves to an HTML file that
  exists in `dist/`.
- 15,093 distinct page → target pairs, all resolved.
- Query strings and fragments are stripped before resolution, so `/pricing?plan=x` is
  checked against `/pricing`.
- 386 external URLs are counted and skipped, including the six cross-application links into
  the CRM (`appOrigins.crm`, currently `http://localhost:5173`), which are not website
  routes by design.

**Not verified**

- **Fragment validity.** `href="#section"` is recorded but not checked against an element
  with that `id`. Doing this properly needs a DOM parse of the target page.
- **External link liveness.** No request is made to any external host. A dead external link
  would not be caught, and should not be assumed working.
- **Link *meaningfulness*.** A link to the honest in-development page resolves, and the
  checker counts it as resolved. That is a routing check, not a completeness check. §4
  covers completeness.

---

## 4. Route coverage

| Category | Count | State |
| --- | --- | --- |
| Website routes built | 126 | Resolve correctly |
| — Fully implemented pages | 4 | Homepage, pricing, demo, 404 |
| — Honest in-development pages | 91 | `noindex`, labelled, with onward links |
| — Generated redirect/utility pages | 31 | Sitemap, robots, index routes |
| CRM real routes | 114 | Built screens; the 30 primary nav routes plus 13 settings surfaces were exercised structurally across the batches 9–16 smoke passes, and 5 more routes were added in Batch 17 |
| CRM placeholder routes | 25 | Honest `ModulePlaceholder`, module named, links onward — all attached as `/*` catch-behind a real list/detail pair |
| CRM redirects | 8 | Route entries carrying `element: <Navigate …>`; with the two rows above these sum to the 147 `path:` entries counted in `router.tsx` |
| Platform admin routes | 1 | Landing page |

The in-development and placeholder pages are the deliberate answer to a specific tension in
the brief: it forbids *both* "hundreds of nonfunctional placeholder routes" *and*
"placeholder-only pages presented as complete". A route that resolves, states that it is
unfinished, is excluded from search results where appropriate, and offers a navigable next
step satisfies both. Neither is counted as a completed page anywhere in this documentation.

---

## 5. Unit and component suites

### 5.1 Mock service layer — 151 tests (`unit` project)

Covers the cross-record consistency rules the brief is specific about:

- a deal move reconciles `PipelineSummary` totals exactly (weighted value, per-stage count
  and value, stale count);
- lead conversion creates contact + account + deal atomically and sets
  `convertedAt`/`convertedTo`;
- task completion updates the daily plan totals and clears the overdue flag;
- `filter` handles nested AND/OR groups and every operator in the union;
- pagination maths: `totalPages`, `hasNext`, `hasPrev`, the final partial page;
- `reset()` restores the seeded baseline;
- organization switching returns a disjoint dataset;
- **Batch 6** — no account is its own ancestor (walks every parent chain);
- **Batch 6** — every deal product line references a product owned by the same tenant, and the
  three tenants produce at least two distinct catalogue signatures;
- **Batch 7 — account hierarchy walk (regression)**: the Batch 6 crash cannot return, asserted
  against the real seeded dataset;
- **Batch 7 — quote pricing engine**: line discounts, the order discount applied to the net
  subtotal, the recurring split, the annualised total, and that `computeQuoteTotals` is the
  sole re-pricing path;
- **Batch 7 — products, quotes and orders**: the products list is tenant-scoped; `revise`
  clones forward with a new reference and a version chain; `convertToOrder` refuses a
  non-accepted quote and a quote with a pending approval step (typed `validation_failed`);
  recording a payment moves the balance by exactly the amount.

The Batch 6 tests exist because Batch 6 found two real data defects (see
[`BATCH_06_REPORT.md`](../development-progress/BATCH_06_REPORT.md) §7). The Batch 7 tests cover
the new domain logic and close the regression gap the Batch 6 report flagged. The 14 tests
Batch 8 added to this suite are broken out in §5.2, and the 25 tests batches 9–15, the 14 tests
Batch 16 added and the 11 tests Batch 17 added are in §5.3.

### 5.2 Batch 8 — support, knowledge base and conversations (14 tests)

Batch 8 added no service modules — `tickets`, `knowledgeBase` and `conversations` already
existed and were seeded — so its tests extend the mock-service suite above (87 → 101), in the
same `packages/mock-services/src/services/index.test.ts` file (now 72 tests). Run against the
seeded in-memory database, with no browser storage:

- **tickets** — `list` is tenant-scoped; the queue filters by SLA state; a reply increments
  `messageCount` **and** stamps the first response; an internal note is stored as a `draft` and
  is not from the customer; resolve sets the summary and root cause, and reopen clears
  `resolvedAt` and increments `reopenCount` (so the count stays honest); escalate raises the
  priority to critical and records the level; `slaPolicies` recomputes total and breached from
  the tickets that reference each policy; `overview` metrics agree with the records — and, as
  recorded rather than asserted away, span every tenant.
- **knowledge base** — publish stamps the status and time; `submitForReview` records the
  reviewer and moves the article to `in_review`; a helpful vote increments the count;
  `suggestForTicket` returns at most five articles.
- **conversations** — a reply increments the count, updates the preview, stamps the first
  response and is `simulated_sent`; star, snooze (status plus `snoozedUntil`) and close each
  land; summarise returns `origin: 'demo_template_engine'` with non-empty suggested replies.

### 5.3 Batches 9–17 — service contracts (50 tests)

`packages/mock-services/src/services/modules.test.ts` is new. The twenty-three service modules
added across batches 9–17 read collections that were already seeded (only `playbooks` needed a
new seed module), so the tests are deliberately contract-level: they assert tenant scoping, the
derived numbers the UI reads, and the honesty guarantees — not exact synthetic values, so a
reseed does not make them brittle. They run against a fresh in-memory `MockDb`
(`persist: false`), touching no browser storage and no network. The file holds **50 tests**:
25 from batches 9–15, 14 added for Batch 16 and 11 added for Batch 17.

| Group | Tests | What they assert |
| --- | --- | --- |
| Customer success (batch 9) | 5 | Overview; org-scoped, explainable health scores; churn risk and renewals; onboarding / success plans / business reviews; playbook application as a local write |
| Sequences (batch 10) | 2 | Seeded list and enrolments; enrolling records an enrolment without contacting anyone |
| Exports and goals (batch 11) | 2 | Every export request carries `generatedLocally: true`; goals return for a user and period |
| Customization extras (batch 13) | 2 | Layouts list and preview against a synthetic record; industry templates list with their declared additions |
| Marketing (batch 14) | 8 | Launching a campaign changes local status only; calendar window; segment preview and members; journey validate and simulate; local email preview with warnings; simulated form submission; `demo_not_hosted` publish; lead-source figures |
| Workspaces (batch 15) | 4 | Project overview and timeline; derived phases / milestones / deliverables / risks; partner and field-sales overviews; demo-local commission calculation |
| Tenant administration (batch 16) | 14 | Security policy derived then locally editable, SSO refused as unavailable; sessions scoped to the active organization, the current session refused, revocation returns `simulated: true` with a note; trusted devices derived from those sessions and revocable; audit export carries `generatedLocally: true`; retention rules validated (rejected write leaves the store unchanged) then persisted; duplicate candidates derived and merged with the cascade asserted; consent counts computed from the seeded contacts, not stored; **usage meters scoped to the active organization, re-checked after switching organization**; subscription carries its tenant and `billingState: 'not_connected'`, invoices match; seat and add-on refusals plus a `simulated: true` checkout preview; cancel requires a reason, cancels twice → conflict, then reactivate; **the `'*'` plan wildcard expands to real modules so a switch to Enterprise loses nothing**; **a plan preview for zero seats is refused with a field error** |
| Subscription and SaaS administration (batch 17) | 11 | Contracts and invoices lists are organization-scoped; `renew` creates a linked successor, sets `renewalId` on the original and closes it; a renewal with an unsellable term or value is refused; `terminate` records the reason and then blocks every further lifecycle verb; `amendment` appends versioned history and re-derives `annualisedValue`; `expiring` returns only in-window contracts for the active organization, soonest first; `markPaid` settles and refuses to run twice; `recordPayment` accumulates partials and settles at zero balance, clearing dunning; `void` requires a reason, zeroes the balance and refuses a paid invoice; **invoice dates run in one direction** (due ≥ issued, paid between issue and the dataset epoch, `overdue` ⇒ past due, and an unsettled non-overdue invoice is *not* past due); **the revenue report and subscription list scope to the active organization, and the MRR bridge reconciles** — opening + Σ movements = closing, with net retention recomputed independently |
| Cross-cutting (batches 9–17) | 2 | Switching organization changes the customerSuccess renewal dataset (not just its label); every AI reply is `origin: 'demo_template_engine'` |

### 5.4 CRM screens — 8 tests (`dom` project)

New in Batch 17, and the first component tests anywhere in `apps/crm`. They exist because the
browser pass cannot dispatch input here (§8): a control whose only proof is a manual click would
otherwise be unverified. They render the real screen inside `ServiceProvider` and a
`MemoryRouter`, then drive the real dialog with `userEvent` against a non-persisting
`createMockServices({ persist: false })`.

| Suite | Tests | What they assert |
| --- | --- | --- |
| `routes/contracts/ContractsScreens.test.tsx` | 5 | Renewal opens the dialog, writes and links the successor, flips the original to `renewed` and removes the Renew control; a blank termination reason leaves the dialog open **and the record unchanged**; a typed reason sets `terminated`, clears `autoRenew` and shows the termination alert; an amendment that doubles the value re-derives the annualised figure; the list renders its heading, summary strip and more than one row |
| `routes/invoices/InvoicesScreens.test.tsx` | 3 | Mark-paid settles the balance and removes the settlement controls; a partial payment accumulates without settling; void requires a reason, records it in `notes` and zeroes the balance |

Two conventions these tests had to learn: `Field` labels carry a `*` and an sr-only
"(required)" suffix, so label matchers must be substrings or regexes; and dialog triggers and
submit buttons share accessible names, so lookups are scoped with `within(dialog)`. Nothing is
asserted immediately after a write — services add 200–540 ms of simulated latency, so each test
waits for the dialog to close in the mutation's success handler instead of racing it.

### 5.5 Design system — 8 tests (`dom` project)

`packages/ui/src/components/kanban.test.tsx`. jsdom has no layout or geometry, so a dnd-kit
drop cannot be simulated there. Rather than skip the consistency claim, the suite drives the
two input methods that *can* run in jsdom — the per-card stage controls and the list
selector — and asserts they produce **identical** service calls:

1. a forward move calls `onMove` with the expected arguments;
2. the board control and the list selector produce identical calls;
3. a rejected move leaves the card in place and announces the reason;
4. a locked column refuses a drop without calling the service;
5. a successful move is announced through the live region;
6. the boundary controls are disabled at the ends of a pipeline;
7. the locked column's option is disabled in the list selector;
8. an axe smoke pass over `PipelineList`.

### 5.6 Design tokens — 3 tests (`unit` project)

`packages/design-tokens/src/tokens.test.ts`, added in Batch 7, is a guard rather than a
feature test. It reads `tokens.css` and fails if the Tailwind v4 theme bridge reintroduces the
collision that made every `w-full` element 1440 px wide (see
[`BATCH_07_REPORT.md`](../development-progress/BATCH_07_REPORT.md) §7, defect 1). The
`--container-*` namespace feeds **both** the `max-w-*` and `w-*` utilities, so a bridge key
named `full` emitted `.w-full { width: var(--w-full) }` (90 rem) and overrode Tailwind's
built-in `w-full { width: 100% }`. The three cases assert that:

1. at least one `--container-*` key is declared, so the guard cannot pass vacuously;
2. no `--container-*` key shadows a Tailwind static width utility (`auto`, `full`, `screen`,
   `min`, `max`, `fit`, `px`);
3. the raw `--w-full: 90rem` scale the widest page container references is still present.

Because the test reads the stylesheet directly, the defect cannot silently return.

### 5.7 Test-type support

`packages/ui/src/vitest-matchers.d.ts` declares the jest-dom and vitest-axe matchers to
TypeScript so a component test typechecks without including the vitest setup file in the UI
package's `tsc` run. Batch 17 added `apps/crm/src/vitest-matchers.d.ts` for the same reason on
the app side — `apps/crm`'s `tsc` run excludes `vitest.setup.ts`, so without the reference the
screen tests fail to typecheck on `toBeInTheDocument`.

The `dom` project's include pattern was widened to `apps/crm/src/**/*.test.tsx`, and
`server.deps.inline: [/@crm\//]` was added because the workspace packages export TypeScript
source: handed to Node they would fail on `.ts`/`.tsx`, so Vite must transform them.

---

## 6. Accessibility

### What is architecturally in place

- Radix UI primitives for dialogs, menus, popovers, selects, tabs, tooltips and accordions
- `IconButton` requires an accessible `label` — an unlabelled icon button is a type error
- Form errors linked via `aria-describedby` and marked with `aria-invalid`
- Skip link as the first focusable element in every layout
- `LiveRegion` for optimistic and simulated updates, including kanban moves
- Two-layer focus ring that survives on every surface, never removed
- Reduced motion honoured via both the OS media query and an in-app data attribute
- Logical CSS properties throughout, with `[dir='rtl']` variants for genuine exceptions
- Colour never the only signal: badges carry text, health indicators pair a dot with a label,
  deltas carry direction words, charts require a table toggle by contract

### What has been measured

- **One component-level axe pass**: `PipelineList` in the kanban suite, with the `region` and
  `color-contrast` rules disabled, because jsdom does not compute layout or paint and would
  report false violations for both. This is a smoke check, not a page audit.
- **Structural checks only for the Batch 17 screens.** The 8 screen tests assert roles, accessible
  names, dialog presence and refusal behaviour — `findByRole('dialog')`, `getByLabelText(/Amount/)`,
  `getByRole('button', …)` — so a control that is not discoverable to an assistive technology
  would fail the test. They do **not** run axe, so the contracts and invoice screens have no
  accessibility measurement any more than the earlier batches have.

### What has not been measured

1. **No axe report exists for any page.** Playwright and `@axe-core/playwright` are installed
   but no spec has been written.
2. **Computed contrast ratios.** The token design targets AA, and dark/high-contrast modes
   override tokens deliberately, but no automated contrast check has been run against the
   rendered output. The pairs to measure first are `text-faint` on `bg-inset`,
   `text-muted` on `bg-surface` in dark mode, and every `-fg` on its `-subtle` counterpart.
3. **Screen-reader behaviour.** No NVDA, JAWS or VoiceOver session has been run. ARIA usage
   is conventional (Radix plus explicit labels) but convention is not evidence.
4. **Keyboard traversal of the mega menu.** Implemented, not tested with a keyboard.
5. **Reflow at 320px / 360px.** No measurement of horizontal overflow has been taken at the
   narrowest target widths. The kanban board's fixed 17rem columns are the most likely
   offender.
6. **Zoom to 200%.** Not tested on any page.

---

## 7. Performance

**No Lighthouse run has been performed.** Reporting a score would require inventing it.

### Architectural performance work completed

| Technique | Status |
| --- | --- |
| Static rendering of all marketing pages | Done |
| Selective hydration — 6 islands, all with explicit directives | Done |
| No web font download; script-appropriate fallback stack | Done |
| Deterministic synthetic data from a fixed seed (no hydration mismatch, no layout shift) | Done |
| `tabular-nums` on all figures to prevent column shift | Done |
| Theme resolved before first paint by an inline script (no flash) | Done |
| Token-driven theming so preference changes do not re-render the tree | Done |
| Route-based code splitting | Done — every CRM screen is its own lazy chunk |
| Dependency-group chunking (`manualChunks`) | Done — Batch 6 |
| `@crm/ui` per-family subpath exports | Done — Batch 6 |
| `prefers-reduced-motion` disabling loops globally | Done |

### Measured: bundle size (CRM)

Batch 6 replaced the 758.60 kB index chunk with dependency-group chunks, and each screen batch
since has emitted its own lazy chunks. The figures below are from the `npx vite build` run
performed for the Batch 17 verification pass. No chunk exceeds 500 kB; the largest is `charts`,
which is lazy and only analytics pays for it.

```
charts           430.11 kB   (lazy, analytics only; unchanged since Batch 9)
ui               316.18 kB   (was 315.93 kB at the Batch 16 pass)
vendor           300.77 kB   (unchanged)
mock-services    276.79 kB   (was 494.08 kB — the seed records now build separately)
mock-seed        224.98 kB   (the seeded collections, split out of mock-services)
forms            116.94 kB
reference-data    79.92 kB
index (entry)     67.11 kB   (was 66.35 kB)
dnd               46.79 kB
```

The three new screen chunks from Batch 17, all lazy:

```
ContractsScreens        18.28 kB
RecurringRevenueScreens 15.67 kB
InvoicesScreens         13.29 kB
```

The 494.08 kB `mock-services` chunk recorded at Batch 16 — 6 kB under Vite's warning threshold,
with the next service module expected to cross it — no longer exists as a single chunk. Splitting
the seed into `mock-seed` is what moved it; the pair now totals ~501 kB of lazily-loaded data
across two requests instead of one oversized chunk, and the batch that needed two more service
modules fit without a threshold decision.

Screen chunks carried forward from batches 9–15 measure the same as before except
`ReportScreens` (21.92 → 21.66 kB), `FieldSalesScreens` (39.89 → 39.81 kB), `PartnerScreens`
(37.39 → 37.41 kB) and `TemplateScreens` (10.90 → 10.91 kB). The causes are not isolated; the
deltas are recorded as measured, not explained. Chunks from batches 5–8 other than `forms`,
`reference-data` and `dnd` were last measured at Batch 8 and are not re-quoted. No chunk exceeds
500 kB, so Vite's warning remains gone.

### Not measured

1. Lighthouse performance, accessibility, best-practices or SEO scores on any page.
2. Cumulative Layout Shift on the homepage (the `DashboardPreview` bars animate height).
3. Largest Contentful Paint (the `surface-mesh` layered gradient could affect paint time).
4. Time to Interactive on the CRM.
5. Runtime cost of the mock layer's two data chunks (`mock-services` 276.79 kB + `mock-seed`
   224.98 kB), which are executed, not just downloaded.

---

## 8. Functional verification performed

### Automated

Component-level only: the design-system kanban suite (§5.5) and, from Batch 17, the eight CRM
screen tests that drive the contract and invoice dialogs (§5.4). No end-to-end suite exists.

### Manual, recorded as observation

Batches 6–16 drove the CRM dev server with a real browser as part of development, and these were
exercised. They are recorded as observations, not as passing tests. **From Batch 17 the browser
probe can no longer dispatch input in this environment** — see the Batch 17 entry at the end of
this section.

**Batch 6**

| Behaviour | Observation |
| --- | --- |
| Accounts list renders | 46 accounts, KPI row, saved views, health column — **0 console errors** |
| Account Customer 360 renders | Health components and signals, revenue snapshot, firmographics |
| Account tabs render | Customer 360 timeline, hierarchy roll-up ($73,000 + $531,000 = $604,000), buying committee, documents empty state — **0 console errors** |
| Contacts list renders | 50 contacts, saved views, table/cards toggle, density toggle |
| Contact detail renders | Consent per channel, timeline, deals/tickets, account card |
| Duplicate review renders | Candidate pairs, field conflicts, honest match-rule notice |
| Account form renders | All fields and select options present |
| Previously-crashing route | `/app/accounts/acc-org-vertex-1` — **no crash, 0 console errors** after the cycle fix |

This manual pass is what surfaced the self-parent crash and the hierarchy loop; no static
check would have caught them.

**Batch 7** — products, quotes and orders, all with **0 console errors**:

| Behaviour | Observation |
| --- | --- |
| Products list renders | 12 active products, KPI row, and the Catalogue / Price books / Categories tabs |
| Product detail renders | Overview, Pricing and Deals tabs |
| Quotes list renders | 20 quotes and the KPI row |
| Quote detail renders | Line items, Approval and History tabs |
| Quote approval step | Approving a step moves the quote forward; inline line editing then locks |
| Create-quote flow | Full end to end — fill, pick an account from 46 options, submit, land on the new draft |
| Orders list renders | 12 orders and the KPI row |
| Order activation | Activating a pending order flips its status and the action disappears |
| Record payment | Paid amount rises by $1,000, balance falls by $1,000, confirmation toast shown |

This manual pass is what surfaced Batch 7's `w-full` token collision — every form control was
1440 px wide and a sibling card's field intercepted pointer events (see
[`BATCH_07_REPORT.md`](../development-progress/BATCH_07_REPORT.md) §7, defect 1); no static
check would have caught it.

**Batch 8** — tickets, knowledge base and the inbox, run at 1280 px, all with
**0 console errors**:

| Behaviour | Observation |
| --- | --- |
| Ticket queue renders | 50 rows, five KPI labels, ticket links resolve — **0 console errors** |
| Ticket detail renders | Thread, SLA panel, reply box and suggested articles; posting the smoke reply took the thread from 3 to 4 messages and the new message carried the **"Recorded, not sent"** chip |
| Knowledge base list renders | 40 rows, both Articles/Categories tabs; clicking **Categories** emptied the table and rendered the derived category cards with article counts |
| Article reader renders | 5 block elements and the "Was this helpful?" panel; the **Helpful** vote produced its confirmation |
| Inbox queue renders | 40 rows, KPI labels present, conversation links resolve |
| Conversation detail renders | Thread, composer, participants and internal-note toggle; **Summarise** produced the summary card with three suggested replies |

The Batch 8 pass is what surfaced the impure `Date.now()` read in the SLA bar (see
[`BATCH_08_REPORT.md`](../development-progress/BATCH_08_REPORT.md) §7, defect 1), which a static
check would not have caught.

**Batches 9–15** — 26 routes, run at 1280 px, with numeric probes, **0 console errors on every
route**. The sample figures the run captured are shown; the remainder passed their probe and
are recorded here as the route having been exercised.

| Route | Numeric probe (sample recorded) | Console errors |
| --- | --- | --- |
| `/app/home` | navigated, probe passed | 0 |
| `/app/customer-success` | 25 churn-risk rows; health KPI text | 0 |
| `/app/customer-success/renewals` | navigated, probe passed | 0 |
| `/app/customer-success/playbooks` | 8 rows | 0 |
| `/app/calendar` | navigated, probe passed | 0 |
| `/app/tasks` | navigated, probe passed | 0 |
| `/app/sequences` | navigated, probe passed | 0 |
| `/app/communications` | ~50,000 characters of rendered timeline history | 0 |
| `/app/analytics` | 23 rows | 0 |
| `/app/analytics/reports` | navigated, probe passed | 0 |
| `/app/workflows` | navigated, probe passed | 0 |
| `/app/ai` | navigated, probe passed | 0 |
| `/app/customization/objects` | navigated, probe passed | 0 |
| `/app/customization/layouts` | navigated, probe passed | 0 |
| `/app/templates` | navigated, probe passed | 0 |
| `/app/campaigns` | 25 rows | 0 |
| `/app/campaigns/segments` | 9 rows | 0 |
| `/app/campaigns/journeys` | 6 rows | 0 |
| `/app/campaigns/templates` | 18 rows | 0 |
| `/app/campaigns/landing-pages` | navigated, probe passed | 0 |
| `/app/campaigns/forms` | navigated, probe passed | 0 |
| `/app/leads/sources` | 12 rows | 0 |
| `/app/projects` | navigated, probe passed | 0 |
| `/app/partners` | 12 rows | 0 |
| `/app/field-sales` | navigated, probe passed | 0 |
| `/app/portal-preview` | navigated, probe passed | 0 |

**Defect found and fixed: `DataTable` collapsed rows without an `id` onto one React key.**
`packages/ui/src/components/data.tsx` defaulted `getRowId` to
`String((row as { id?: string }).id ?? '')`. The partner leaderboard rows carry `partnerId`
and the field-sales territory-performance rows carry `territoryId` — derived rows with no `id`
field — so each keyed to `''` and React reported duplicate-key errors on `/app/partners` and
`/app/field-sales`. The default now falls back to the row index —
`String((row as { id?: string }).id ?? index)` — and the prop type is
`(row: TData, index: number) => string`; tables over real records still pass their own
`getRowId`. The browser pass is what surfaced it; no typecheck or unit test could.

**Batch 16** — the eight settings surfaces, the four billing sub-sections and the help page, run
at 1280 px with numeric probes after the fixes below. **0 console errors on every surface.** The
figures are what the probes returned, captured in the same run as the fixes.

| Route | Numeric probe | Console errors |
| --- | --- | --- |
| `/app/settings/organization` | five section headings (Company profile, Branding, Fiscal year, Read-only facts) | 0 |
| `/app/settings/business-units` | 1 reporting unit + 5 teams with member counts and managers | 0 |
| `/app/settings/users` | 16 members, 16 active, 4 pending invitations, 1 user without MFA | 0 |
| `/app/settings/roles` | 12 permission-matrix rows (24 before the tenancy fix below) | 0 |
| `/app/settings/security` | 9 rows across sessions and devices | 0 |
| `/app/settings/audit` | 40 rows | 0 |
| `/app/settings/data` | 54 rows across import jobs, duplicates and retention rules | 0 |
| `/app/settings/billing` | subscription card: Professional, 57/60 seats, $4,397 monthly, renews 10/31/26 | 0 |
| `/app/settings/billing/plans` | 4 plans; Enterprise reads "All modules" after the wildcard fix below | 0 |
| `/app/settings/billing/usage` | 6 meters with readings, period and overage behaviour | 0 |
| `/app/settings/billing/invoices` | 7 rows | 0 |
| `/app/settings/billing/payment-method` | 3 rows | 0 |
| `/app/settings/help` | three sections, incl. "Not built yet" | 0 |

One write path was driven end to end: **Change plan → Preview the change** on Enterprise for 60
seats, annual. The preview returned a recurring amount, an illustrative proration figure, an
effective date and the five modules the switch adds, and it still said the change is simulated.

**Defect found and fixed: the permission matrix leaked fields and roles across tenants.**
`roles.fieldMatrix(objectApiName)` in `packages/mock-services/src/services/index.ts` read
`customFields` and `roles` from the whole store instead of the active organization, so
`/app/settings/roles` rendered 24 matrix rows for a tenant that owns 12 fields and was showing
another organisation's fields to the signed-in user. Both reads now go through `tenantRecords`.
Row count 24 → 12 and the console is clean; a unit test cannot see it, because the tests run
against one active organization.

**Defect found and fixed: the change-plan dialog opened unseeded and priced the change at zero
seats.** The header "Change plan" button set only `changeOpen`, unlike the per-plan button on the
Plans tab, which seeds plan, seats and interval. A blank seat field made `Number(changeSeats)`
evaluate to `0`, so the previewed Enterprise figure was the $1,200 platform fee with no seat
cost — a wrong number presented as an estimate. The header button now seeds the current seat
count and billing interval, and `previewPlanChange` refuses a seat count below 1 with a typed
field error, matching `updateSeats`.

**Defect found and fixed: the `'*'` plan wildcard was rendered as a module.** `plan-enterprise`
grants `moduleKeys: ['*']` rather than enumerating modules, and nothing expanded it. The
change-plan preview therefore reported "Entitlements gained: `*`" and listed **all 26** modules
the tenant already held under "Entitlements lost" — it told the user an upgrade removes
everything — and the Plans tab showed "1 modules" for Enterprise. `expandModuleKeys()` in
`packages/mock-services/src/services/administration.ts:1389` now expands the wildcard over every
key the platform sells (catalog ∪ plans ∪ add-ons) and is used by `previewPlanChange` and
`entitlements()`; the Plans tab says "All modules". The catalog alone is not the universe: six
keys plans grant — `activities`, `calendar`, `knowledge_base`, `orders`, `documents`, `billing` —
are not catalog entries, which is why the expansion takes the union. Two contract tests cover it
(§5.3).

**Defect found and fixed: seven React "uncontrolled → controlled" warnings on the organization
settings form.** `useForm` was called without `defaultValues` in
`apps/crm/src/routes/settings/SettingsScreens.tsx`, so the selects mounted empty and received a
value on the next render. Both forms now declare defaults.

**Batch 17 — structural pass only.** Five routes were navigated at 1280 px against the dev
server and every figure below was read out of the rendered DOM. **0 console errors and 0 warnings
on all five.**

| Route | Numeric probe | Console errors |
| --- | --- | --- |
| `/app/contracts` | 18 rows, "1–18 of 18"; active contracts 14, active value $4.6M, expiring in 90 days 4, auto-renew 50% | 0 |
| `/app/contracts/ctr-org-vertex-3` | CT-40004 Expiring Soon; value $561,000, annualised $280,500 over 24 months, ends 11/4/26, "Expiring in 22 days"; Renew / Amend / Terminate present | 0 |
| `/app/subscriptions/invoices` | 14 rows; outstanding $240.9K, overdue $79.4K, overdue count 1, collected this period $126.5K. The six open balances sum to $240,939, matching the strip | 0 |
| `/app/subscriptions/invoices/inv-org-vertex-6` | INV-2026-0006 Overdue, final notice, total $79,364, paid $0, balance $79,364, issued 8/3/26, due 9/2/26 | 0 |
| `/app/subscriptions` | Bridge $108.6K → +$22.8K → +$5.5K → +$14.5K → −$0 → −$17.1K → $134.3K, which sums. MRR $134.3K, ARR $1.6M, NRR 123.7%, GRR 84.3%, net new $25.7K, churn 7.7% / $17.1K, LTV $380.5K, ARPA $11.2K, logo retention 92.3%, payback 14 months. Plans: Starter $94K / 70% / 14.3% churn, Professional $37.4K / 28%, Enterprise $2.9K / 2% | 0 |

**No interaction could be dispatched in this run, so none of the write paths was verified in the
browser.** The Qoder in-app browsing surface stays hidden (`document.visibilityState ===
'hidden'`) and Chromium delivers no pointer events to a hidden page: `click` reported success, no
React `onClick` fired anywhere in the app, and `take_screenshot` returned
`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`. The finding is environmental, not a Batch 17 defect — it
reproduced identically against shipped controls from earlier batches (the Orders activation
dialog, the header Create menu, the theme and density toggles). The consequence is recorded in
§5.4: every renew / amend / terminate / pay / void path was driven with `userEvent` in jsdom
instead, and real-browser dialog behaviour remains unverified.

Batch 17's nine shipped-code defects, what each one looked like on screen and how it was fixed,
are in [`BATCH_17_REPORT.md`](../development-progress/BATCH_17_REPORT.md) §7 and in
[`WORK_SUMMARY.md`](../../WORK_SUMMARY.md) §7. The three that only a browser pass could see —
the cross-tenant revenue read, the bridge that did not sum, and invoices sitting past their due
date without being flagged — were all found by reading the rendered figures above.

---

## 9. Known test gaps and risks

| Risk | Impact | Mitigation plan |
| --- | --- | --- |
| Almost no CRM screen has an automated test | Regressions below the service layer surface late | **Partial mitigation at Batch 17:** 8 component tests drive the contracts and invoices dialogs (§5.4), and vitest's `dom` project now includes `apps/crm`. ~110 screens remain uncovered. The account-hierarchy walk regression test (§5.1) and the design-token bridge guard (§5.6) close the two defects that motivated this row |
| Browser interaction cannot be driven in this environment | Every click-dependent claim — dialog focus order, menu behaviour, responsive hover states — is unverified rather than passing | Grow the jsdom suites for the write paths that matter; install Playwright's browsers (`npm run test:e2e:install`) and write the first real spec before claiming an interaction works |
| No accessibility measurement on any page | Accessibility claims are architectural, not evidenced | First axe pass on a CRM screen and the four website pages |
| No performance measurement | Brief targets are unverified | Lighthouse run on homepage, pricing and one CRM screen |
| Manual verification only for RTL | Direction bugs are easy to introduce and invisible in LTR | RTL smoke test asserting `dir="rtl"` propagation and no horizontal overflow |
| No responsive overflow assertion | A fixed-width board may overflow at 360px | Assert `scrollWidth <= clientWidth + 1` at the eight target widths |
| Link checker does not validate fragments | Anchor rot is possible | Add fragment validation (DOM parse of the target page) |
| No visual regression testing | Token changes could silently alter many screens | Consider a screenshot baseline now that the shell is stable |

---

## 10. Batch 16 verification — what the plan asked for and what was measured

Batch 16 — tenant administration: the `/app/settings/*` surface (company profile and branding,
business units and teams, the user directory, role and permission matrix, security policy,
audit log, data management, billing). The six screens and the three service modules
(`security`, `data`, `billing`) were implemented in the previous run and explicitly left
unverified; this section records that verification.

| Planned step | Outcome |
| --- | --- |
| Unit tests for the new service modules | **Done** — 14 contract tests in `modules.test.ts` (§5.3), covering scoping, derived figures and the honesty guarantees |
| Keep the `modules.test.ts` contract style | **Done** — shape and invariants, no synthetic exact values |
| Console-error check on each settings page load | **Done** — 13 settings surfaces probed, 0 console errors after the fixes (§8) |
| First automated axe or end-to-end pass on a settings screen | **Not done** — still open, see §6 and §9 |
| Responsive overflow assertion at the eight widths | **Not done** — still open, see §9 |
| Lighthouse run | **Not done** — still open, see §7 |

Four defects were found by running the checks rather than reading the code, and all four are
fixed and re-measured: the cross-tenant permission matrix, the unseeded change-plan dialog
pricing a change at zero seats, the unexpanded `'*'` plan wildcard, and seven
uncontrolled-to-controlled form warnings. None was reachable by typecheck. The first three were
also outside the unit suite as it stood: the matrix leak needs two organizations active at once,
the dialog bug lives in component state, and the wildcard needed a contract test, which §5.3 now
provides.

The consolidated pass itself: typecheck 0 errors, ESLint 0 errors with 6 informational warnings,
151 tests passing (143 unit + 8 dom, 5 files), CRM, website and platform-admin builds clean, and
15,093 internal website links resolving. Commands and recorded output are in §2.

---

## 11. Batch 17 verification — what the plan asked for and what was measured

Batch 17 — subscription and SaaS administration: the `contracts` and `invoices` service modules,
the contracts list and detail with renew / amend / terminate, the invoice list and detail with
record payment / mark paid / void, and the recurring-revenue report over `subscriptionRevenue`.
Verification ran **inside** the batch, which is the standing rule since Batch 16 showed what
deferring produces.

| Planned step | Outcome |
| --- | --- |
| Unit tests for the new service modules | **Done** — 11 contract tests in `modules.test.ts` (§5.3) |
| Component tests for the new screens | **Done, and newly necessary** — 8 tests driving the real dialogs with `userEvent` (§5.4), because the browser pass could not dispatch input |
| Revenue report reconciles and is tenant-scoped | **Done** — the bridge's opening + Σ movements = closing is asserted against an independent recomputation in the test |
| Console-error check on each new route | **Done** — 5 routes, 0 errors and 0 warnings (§8) |
| Interaction smoke in a real browser | **Not possible here** — see §8. Radix owns dialog focus; it is unverified in a browser |
| First automated axe pass on a CRM screen | **Not done** — still open, §6 |
| Responsive overflow assertion at the eight widths | **Not done** — still open, §9 |
| Lighthouse run | **Not done** — still open, §7 |

The pass found nine defects in shipped code, all fixed and re-measured: the cross-tenant revenue
read, the invented opening-MRR figure that broke the bridge's own arithmetic, cancelled
subscriptions counted inside the run rate, hardcoded per-plan churn, assumed LTV and payback
presented as measurements, invoices due before they were issued, a dataset that could contain no
churn at all, unsettled invoices sitting past their due date, and screen tests that failed the
app's own typecheck. Two `STORAGE_VERSION` bumps (3 → 4 → 5) carry the date fixes forward to
returning reviewers. Detail in [`BATCH_17_REPORT.md`](../development-progress/BATCH_17_REPORT.md) §7.

Final measured state of the suite: typecheck 0 errors, ESLint 0 errors with 6 informational
warnings, **170 tests passing (154 unit + 16 dom, 7 files)**, CRM/website/platform-admin builds
clean with no chunk over 500 kB. One intermittent failure was observed in a combined run before
the final fixes — `keeps every AI reply labelled as coming from the demo engine` — and it passed
in isolation and in both full runs afterwards; it is recorded as a flake in the same family as
Batch 16's kanban/timer timing case, not silently dropped. Commands and recorded output are in §2.
