# Batch Report — Batch 9

**Batch:** 9 — Customer success (health scores, renewals, onboarding, playbooks)
**Date:** 2026-10-14
**Repository state:** changes complete in the working tree; **verified in the end-of-run consolidated pass** (see §6 and §8)
**Prior report:** [`BATCH_08_REPORT.md`](./BATCH_08_REPORT.md)

---

## 1. Features implemented

Batch 9 builds the customer success domain — the areas Batch 8 identified as the next
service-plus-screens batch. It is the first batch since Batch 7 to add a new service family to
the container: `customerSuccess` and `playbooks` are new keys on `MockServiceContainer`, and a
new seed module fills the previously empty `playbooks` collection.

The guiding rule for the whole module is that **a health score is never shown alone**. Every
place a number appears, the weighted components that produced it, the rationale for each
component and the signals that moved it appear alongside it. The score is explicitly a
demonstration model (`modelLabel`), computed from seeded signals, not a prediction.

### Health and the customer success dashboard

- **Dashboard** at `/app/customer-success` with six derived KPIs (accounts, at risk, average
  health, ARR, NRR, renewals due in 90 days), a donut of the health distribution by band, an
  illustrative weekly trend strip, a paginated churn-risk table, portfolio and success-manager
  performance tables, feature adoption bars, and a voice-of-customer card (NPS, CSAT,
  promoters/passives/detractors, keyword themes) built from the seeded surveys.
- **Recompute health** writes a fresh snapshot to the local demo store only, and its
  confirmation says so: *"Recomputed N of M health score(s) in the local demo store."*
- **Account success panel** at `/app/customer-success/accounts/:accountId`: the score ring, the
  full "Why this score" component breakdown (with weights shown as percentages so the reader can
  confirm they sum to 100%), the movement signals with severity and suggested action, the success
  plans with per-objective status selects, business reviews and linked renewals.

### Renewals

- **Renewal board** at `/app/customer-success/renewals`, grouped into its own seven columns
  (upcoming, outreach, negotiation, commit, won, lost, churned) and kept visibly separate from
  new-business deals. Value, value-at-risk and 30-day columns are derived from the loaded page;
  each card can move stage, which records the change in the local store only.

### Onboarding

- **Onboarding board** at `/app/customer-success/onboarding`: plans created from won deals, with
  their phases, per-task owner kind (customer/internal), milestone flags, blockers and progress.
  Marking a task changes the record locally and the panel says no workflow runs and no
  notification is sent.

### Business reviews

- **Reviews board** at `/app/customer-success/reviews`: quarterly, executive and onboarding
  reviews, each showing its agenda (with presenters and durations) and its action items with
  owners.

### Playbooks

- **Playbook list** at `/app/customer-success/playbooks`: search plus purpose and active-state
  filters, KPI strip, and a table with purpose, step count (and how many of those steps create a
  task), times used, average completion and state.
- **Playbook detail** at `/app/customer-success/playbooks/:playbookId`: an ordered step timeline
  that distinguishes **"Creates a task"** from **"Guidance only"** on every step, plus an
  apply panel. Applying creates one local task per task-creating step and reports the honest
  count: *"Created N task(s) in the local demo store. Nothing was emailed, scheduled or sent to a
  workflow engine."*

### Honesty controls in this batch

- The health model is labelled a weighted demonstration model everywhere it appears, and every
  score carries its components and rationale.
- The weekly trend strip is captioned as an *illustrative* series derived from the current band
  distribution, "not a measured history", and offers the same numbers to a screen reader.
- Adoption figures are described as derived from the seeded dataset, "not a usage-metering
  service". Voice-of-customer themes are "counted from seeded survey comments by keyword, not by
  a language model".
- Applying a playbook and recomputing health both carry `DemoNotice` copy stating that only local
  demo records change.
- No "New playbook" control is shown, because the create path is not part of this batch and a
  control that did nothing would break the honesty rule.

---

## 2. Pages and routes created

| Route | Screen | Kind |
| --- | --- | --- |
| `/app/customer-success` | Customer success dashboard | Real |
| `/app/customer-success/renewals` | Renewal board | Real |
| `/app/customer-success/onboarding` | Onboarding board | Real |
| `/app/customer-success/reviews` | Business reviews board | Real |
| `/app/customer-success/accounts/:accountId` | Account success panel | Real |
| `/app/customer-success/playbooks` | Playbook list | Real |
| `/app/customer-success/playbooks/:playbookId` | Playbook detail + apply | Real |
| `/app/customer-success/*` | Health, churn-risk, voice-of-customer sub-features | Placeholder |

Route totals, counted from `router.tsx`: **51 real (`lazyScreen`)**, **43 placeholder
(`notBuilt`)**, **5 redirects (`<Navigate>`)** — 99 path entries, plus the `AppShell` layout
route and one `index` redirect. This is **+7 real, −1 placeholder and +6 entries** against the
44 / 44 / 5 measured after Batch 8: the two customer-success placeholders were replaced by seven
real routes and the one wildcard placeholder retained for the unbuilt sub-features.

Because `packages/configuration/src/modules.ts` lists `customer_success` children that the
sidebar does not render (children are only linked from `ModulePlaceholder`), the sub-screens are
reached from the dashboard's secondary action buttons — the same convention the deals module
uses — rather than from a new sidebar entry.

---

## 3. Components created or reused

No new `@crm/ui` primitives were required.

- **Reused:** `DataTable`, `Pagination`, `PageHeader`, `RecordHeader`, `FilterBar`, `ListSkeleton`,
  `MiniStat`, `Card`/`CardHeader`/`CardContent`/`CardTitle`, `Button`, `Badge`, `StatusBadge`,
  `TonePill`, `Progress`, `InlineBar`, `DonutChart`, `ScoreRing`, `Select`, `DemoNotice`, `Alert`,
  and the `formatDate`/`formatMoney`/`formatNumber` helpers.
- **Local to the customer success module:** `BandPill`, `DeltaChip`, `HealthComponents`,
  `HealthSignals`, `HealthTrendStrip`.
- **Local to the playbook module:** `StepRow` (the ordered timeline row).

`ScoreRing`, `DonutChart` and `InlineBar` already existed, so the health vocabulary needed no new
charting work.

---

## 4. Interactive mock workflows completed

1. Read the dashboard KPIs, health distribution, churn-risk table and voice-of-customer card.
2. Recompute the health scores for every account in view and watch the confirmation count.
3. Open an account success panel and read the component breakdown, rationales and signals.
4. Change a success-plan objective's status; the plan's overall progress recomputes.
5. Filter the renewal board by stage and move a renewal between stages.
6. Filter the onboarding board by status and mark an onboarding task complete / blocked.
7. Filter the business-reviews board by status and read an agenda and its action items.
8. Search and filter playbooks by purpose and active state.
9. Open a playbook and read its ordered steps, distinguishing task-creating steps from guidance.
10. Apply a playbook to an account; one local task is created per task-creating step and the
    honest count is reported.

---

## 5. Files created or modified

**Created**

- `packages/mock-services/src/services/customer-success.ts` (903 lines) — the `customerSuccess`
  and `playbooks` services.
- `packages/mock-services/src/seed/playbooks.ts` (176 lines) — eight deterministic playbooks per
  organization, each from `createRandom` and the fixed `DATASET_EPOCH`.
- `apps/crm/src/routes/customer-success/CustomerSuccessScreens.tsx` (~1,287 lines) — dashboard,
  renewal board, onboarding board, business-reviews board and account success panel.
- `apps/crm/src/routes/customer-success/PlaybookScreens.tsx` (~505 lines) — playbook list and
  detail.
- `docs/development-progress/BATCH_09_REPORT.md` (this file).

**Modified**

- `apps/crm/src/app/router.tsx` — two customer-success placeholders replaced by seven real
  routes; the wildcard placeholder retained.
- `packages/mock-services/src/services/index.ts` — imports `makeCustomerSuccessService` and
  `makePlaybooksService`; adds the `playbooks` and `customerSuccess` keys to the assembled
  container.
- `packages/mock-services/src/seed/index.ts` — imports `makePlaybooks`; calls `add('playbooks',
  ...)` once per organization inside the existing tenant loop, alongside the customer success
  records the playbooks drive.
- `apps/crm/src/routes/customer-success/CustomerSuccessScreens.tsx` — dashboard gained a named
  export (kept alongside the default export) and secondary action buttons linking to the
  onboarding, renewals, reviews and playbooks sub-screens.

---

## 6. Tests executed and their results

**Verification passed** in the consolidated end-of-run pass, run once over batches 9–15.

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | PASS — 6 packages + 3 apps, 0 errors |
| ESLint (`npm run lint`) | PASS — 0 errors, 5 informational warnings |
| Vitest unit | PASS — 129 / 129 across 4 files (was 104 across 3 before batches 9–15) |
| Vitest dom | PASS — 8 / 8 |
| CRM build (`npx vite build` in `apps/crm`) | PASS — 0 chunks over 500 kB; `CustomerSuccessScreens` 39.43 kB and `PlaybookScreens` 12.38 kB lazy chunks |
| Browser smoke (dev server, 1280 px, Playwright) | PASS — `/app/customer-success` rendered 25 churn-risk rows and the health KPI text, `/app/customer-success/playbooks` 8 rows; 0 console errors on both, in a 26-route pass with 0 console errors everywhere |

No tests were authored while the batch was being built, but the consolidated pass added
`packages/mock-services/src/services/modules.test.ts` — 25 contract-level tests for the
batches 9–15 services — five of which cover this batch: the overview, org-scoped and
explainable health scores, churn risk and renewals, onboarding / success plans / business
reviews, and applying a playbook as a local write. The pre-existing `index.test.ts`
collection-count assertions remain lower bounds, as predicted here, so the new `playbooks`
seed did not disturb them.

---

## 7. Defects the tests found, and how they were fixed

None in this batch's service logic: the consolidated pass found no defect in the customer
success or playbook modules. Every `DataTable` in the customer success screens passes an
explicit `getRowId`, so the `DataTable` default-key defect found in Batch 15 did not affect
these screens — see [`BATCH_15_REPORT.md`](./BATCH_15_REPORT.md) §7.

---

## 8. Build and typecheck status

**Passed.** The consolidated pass emitted `CustomerSuccessScreens` as a 39.43 kB lazy chunk and
`PlaybookScreens` as 12.38 kB; the CRM build reported 0 chunks over 500 kB (largest overall:
`mock-services` 457.16 kB, `charts` 430.11 kB), and typechecking passed across the six packages
and three apps with 0 errors.

### Browser smoke test

Run in the consolidated pass (dev server, 1280 px, Playwright, numeric probes):
`/app/customer-success` rendered 25 churn-risk table rows and the health KPI text;
`/app/customer-success/playbooks` rendered 8 rows. Both reported 0 console errors, and the
26-route pass reported 0 console errors on every route.

---

## 9. Responsive and accessibility findings

### Accessibility work in this batch

- The health explanation is text-first: components, weights, scores and rationales are real
  content, so "why is this account amber" is answerable without sight.
- The illustrative trend strip renders an `sr-only` list carrying the same numbers as the bars, so
  the chart's meaning does not depend on colour or on the visual stack.
- Health movement signals pair a coloured dot with the signal label, severity and detection date
  in text — colour is never the only channel.
- The playbook step badges read "Creates a task" / "Guidance only" and "Required" / "Optional" as
  words, not as colour alone.
- The renewal "apply target" select has a real `<label htmlFor>` rather than the `aria-label` the
  `Select` component silently drops; other selects carry `aria-label` (the existing pattern), and
  each renewal card's stage select is named for its account.
- Interactive controls are keyboard-operable `Button`s and `Select`s; links use real anchors.

### Not measured

- axe-core and Lighthouse were not run; the accessibility statement remains "planned", not
  "verified".
- RTL and the 13 locales were not re-exercised against the new screens.
- The renewal board uses a horizontally-wrapping grid of stage columns rather than a true
  drag-and-drop kanban; it is responsive to the viewport but was not measured at every breakpoint.

---

## 10. Known issues

### Correctness

- **`recomputeHealth` stamps `new Date()`.** Unlike the seeded baseline (pinned to
  `DATASET_EPOCH`), a recompute writes the real wall-clock time into `computedAt`, so a recomputed
  snapshot is not reproducible across runs. This matches the existing mock convention for
  user-triggered writes and is labelled a local demo write, but it means the health snapshot is
  no longer bit-identical to the seed after the first recompute.
- **The renewals page fetches up to 200 records to derive its columns and KPIs client-side.**
  There is no service endpoint for renewal rollups, so the board loads the page and groups it
  itself. If an organization has more renewals than the page size, the column totals would
  undercount. The same trade applies to the dashboard's `healthScores` read (200 rows).

### Scope

- Playbook **creation and editing** are not offered; the list and detail screens are read/apply
  only, so no "New" control is shown.
- The dashboard's **success-plan, onboarding and review** editing is limited to objective status
  (on the account panel) and onboarding task status (on the onboarding board); there is no plan or
  review editor.
- Health, churn-risk and voice-of-customer remain at the dashboard level; the narrower
  `/app/customer-success/health`, `/churn-risk` and `/voice-of-customer` routes still render the
  placeholder.

### Quality

- `CustomerSuccessScreens.tsx` carries five screens in one file (~1,287 lines). That mirrors the
  other domain files (tickets, inbox) and keeps the shared band vocabulary local, but it is close
  to the point where splitting the account panel into its own file would help.

---

## 11. Remaining frontend work

With Batch 9 the customer success domain is mock-complete. The largest remaining areas are:

- **Reporting and analytics** depth beyond the current dashboards.
- **Automation and workflows** (rules, approvals, orchestration).
- **Administration** at organization level (users, roles, fields, layouts, audit).
- **Contracts, recurring revenue and projects** detail screens.
- The **platform-owner console** breadth.
- Cross-cutting: a full RTL and locale pass over every batch's screens, and a real axe/Lighthouse
  run.

---

## 12. Suggested next batch

**Batch 10 — Automation and workflows.** The workflow service is already implemented and seeded
(activation guards, validation warnings, and a simulation that labels every step), but the
screens sit behind the `/app/workflows/*` placeholder. A screens batch over the existing service
would turn triggers, conditions, actions and the step-by-step simulation into a working canvas
without new service work — the same shape as the Batch 8 support batch. It is also the natural
complement to customer success: health signals, renewal stages and onboarding blockers are the
sorts of events a rule would react to.
