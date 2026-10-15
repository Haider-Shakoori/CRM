# Batch Report — Batch 15

**Batch:** 15 — Additional workspaces (projects, partners, field sales, customer portal preview)
**Date:** 2026-10-14
**Repository state:** frontend-only; deterministic in-browser mock services; **verified in the end-of-run consolidated pass**
**Prior report:** [`BATCH_13_REPORT.md`](./BATCH_13_REPORT.md)

---

## 1. Features implemented

Batch 15 is a **service-plus-screens** batch. It adds three new mock services (`projects`,
`fieldSales`, `partners`) and the four workspace surfaces that sit on them, plus the customer
portal preview. It is the batch the roadmap reserved as "additional workspaces".

### Projects & delivery

- **Portfolio** at `/app/projects`: a KPI strip (active, at risk, blocked, on-time delivery,
  average duration, budget consumed), a status facet row with counts, search, and a board / list
  view switcher. The board groups projects by status and moving a card writes the new status
  through the same `projects.update` operation the list uses.
- **Project detail** at `/app/projects/:projectId`: the delivery handoff checklist (whose state
  only advances when every item is genuinely done), the **customer-visible status** panel, the
  **derived phases** timeline, deliverables, a task kanban, a non-interactive Gantt-style
  timeline with a "read as a table" fallback, milestones with billing flags, and risks & issues.
- **Handoff from a won deal, not a form.** A project is created by a handoff from a closed-won
  deal. The screen links back to the originating deal and writes only the checklist; it does not
  pretend to create delivery projects free-standing.

### Field sales

- **Overview** at `/app/field-sales`: twelve KPIs, a 14-day planned/completed/orders bar chart, a
  visit-outcomes donut, a territory-performance table, coverage-gap analysis and most-active
  accounts.
- **Territories** at `/app/field-sales/territories`: a kind facet plus search over a list, with an
  inline editor for the visit target, the active switch, and account assignment.
- **Visit plans** at `/app/field-sales/visit-plans`: a "Day plans" / "Visit logs" tab pair, a
  create-plan form, a plan detail with stop reordering, **simulated check-in** and a
  complete-visit form.

### Partners

- **Directory** at `/app/partners`: KPIs and a tier facet over the partner list, showing tier,
  status, internal certification count, registered deals, win rate and revenue closed.
- **Partner detail** at `/app/partners/:partnerId`: profile facts, onboarding programme checklist,
  certifications and the partner's related records.
- **Deal registrations** at `/app/partners/registrations`: a conflict-checked registration ledger
  with a conflict banner and decide / convert actions where their preconditions hold.
- **Referrals** at `/app/partners/referrals`: referrals tracked through to qualification with a
  demonstration reward status.
- **Commission statements** at `/app/partners/commissions`: a demonstration commission ledger that
  records how each line was calculated, so no figure is ever shown alone.

### Customer portal preview

- **Preview** at `/app/portal-preview`: a branded header derived from the active organization's
  branding, with four tabs — support tickets (with the customer-facing conversation, internal
  notes hidden), the public help centre (published, `public`-scope articles rendered by a local
  structured-block renderer), customer-visible project progress with derived phases, and
  appointments drawn from the demo calendar.

### Service layer

- **`projects`, `fieldSales`, `partners`** implemented in
  `packages/mock-services/src/services/workspaces.ts` against **only the seeded collections**
  (`projects`, `projectTasks`, `projectMilestones`, `territories`, `visitPlans`, `visitLogs`,
  `partners`, `dealRegistrations`).
- **Derived, not seeded:** project phases / deliverables / risks, referrals and commissions are
  computed by the service from seeded records. Referrals are cached in a closure with a
  session-override map so `updateReferral` persists for the session; commissions are derived
  read-only on every call and carry `calculationState: 'demo_local_calculation'`.

### Honesty controls in this batch

- **Check-in is simulated and labelled.** `VisitLog.checkIn.gpsUsed` is always `false`; the log
  carries a manually chosen location label and says so in its own note. No device location is read
  and no map or routing provider is contacted.
- **Routes are local estimates.** Route distance and drive time are seeded local estimates; the
  route summary states that no routing provider is connected, and a newly created plan records a
  zero-distance route that explicitly says the estimate is unavailable rather than inventing one.
- **Territory geography describes, it does not geocode.** Assigning an account writes to the local
  demo store only.
- **Phases, deliverables and risks are derived** from the seeded delivery schedule and the
  project's recorded counts; the screens say "derived" rather than implying a stored plan.
- **Partner certifications are internal only.** The conflict check on a deal registration
  *advises*, it does not enforce exclusivity. Commissions are labelled demonstration calculations.
- **The portal is a preview, not a portal.** No customer is signed in, nothing is hosted on a
  subdomain, no data is isolated by customer, and ticket submission, appointment booking and
  e-signature are stated as not implemented. Internal ticket notes are hidden because a real
  portal would never show them.

---

## 2. Pages and routes created/edited

**New files:**

- `apps/crm/src/routes/projects/ProjectScreens.tsx` — exports `ProjectsScreen`, `ProjectDetail`.
- `apps/crm/src/routes/partners/PartnerScreens.tsx` — exports `PartnersScreen`, `PartnerDetail`,
  `DealRegistrationsScreen`, `ReferralsScreen`, `CommissionStatementsScreen`.
- `apps/crm/src/routes/field-sales/FieldSalesScreens.tsx` — exports `FieldSalesScreen`,
  `TerritoriesScreen`, `VisitPlansScreen`.
- `apps/crm/src/routes/portal/PortalPreviewScreens.tsx` — exports `PortalPreviewScreen`.

**Edited:**

- `apps/crm/src/app/router.tsx` — placeholder routes replaced with real screens:

| Route | Screen | Kind |
| --- | --- | --- |
| `/app/projects` | Project portfolio (board + list + KPIs) | Real |
| `/app/projects/:projectId` | Project detail | Real |
| `/app/partners` | Partner directory | Real |
| `/app/partners/registrations` | Deal registrations | Real |
| `/app/partners/referrals` | Referrals | Real |
| `/app/partners/commissions` | Commission statements | Real |
| `/app/partners/:partnerId` | Partner detail | Real |
| `/app/field-sales` | Field-sales overview | Real |
| `/app/field-sales/territories` | Territories | Real |
| `/app/field-sales/visit-plans` | Visit plans and logs | Real |
| `/app/portal-preview` | Customer portal preview | Real |

Eleven routes moved from `notBuilt(...)` placeholders to lazily imported real screens. The
schedule-domain modules do not cross-import each other, so the portal preview keeps a
self-contained block renderer rather than importing `KbBlocks` from the knowledge-base route.

Counted from `router.tsx` after this batch: **100 real routes (`lazyScreen`), 27 placeholder
routes (`notBuilt`), 5 redirects (`<Navigate>`) and the one `/app` shell layout — 133 route
objects in total, 132 of them carrying an explicit `path:`** (the fifth redirect is the
pathless `/app` index route). This batch moved the eleven routes above from `notBuilt`
placeholders to lazily imported real screens; the removed `partners/*`, `field-sales/*` and
`projects/*` catch-alls are not replaced, so unknown deep paths fall to the shell's `NotFound`.

---

## 3. Components created or reused

No new `@crm/ui` primitives were required, and **no new npm dependency was added**.

- **Reused from `@crm/ui`:** `Alert`, `Badge`, `Button`, `Card`/`CardHeader`/`CardContent`/
  `CardTitle`, `ChartFrame`, `DataTable` (including its `expandedRow` slot), `DemoNotice`,
  `DonutChart`, `Field`, `InlineBar`, `Input`, `KanbanBoard`, `MiniStat`, `MultiSelect`,
  `Progress`, `Select`, `StatusBadge`, `Switch`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`,
  `Textarea`, `TonePill`, `cn`, `focusRing`, `notify`.
- **Reused from `components/shared`:** `FilterBar`, `ListSkeleton`, `PageHeader`,
  `RecordEmptyState`, `ViewSwitcher`, `RecordHeader`, `formatDate`, `formatMoney`,
  `formatNumber`, `initialsOf`.
- **Local to the modules:** `StatusPill`/`HealthPill`/`CustomerVisiblePanel`/`HandoffPanel`/
  `TimelineBar` (projects); `TerritoryEditor`/`CheckInForm`/`CreatePlanForm`/`CompleteVisitForm`/
  `PlanDetail` (field sales); `PortalBlocks`/`PreviewNote` and the four portal panels (portal).

Two conventions were applied where the primitives do not support a direct prop: checklist
controls pair a `Switch` with an external `<label htmlFor>`, because `Switch` does not accept
arbitrary ARIA props; and the portal's block renderer is local, because route modules do not
import from one another.

---

## 4. Interactive mock workflows completed

1. Filter the project portfolio by status and search, and switch between board and list.
2. Move a project card between status columns; the change is written through `projects.update`.
3. Accept a delivery handoff by ticking every checklist item.
4. Read a project's derived phases, deliverables, timeline (as bars or as a table), milestones and
   risks; mark a milestone complete and watch the project counter update.
5. Filter territories by kind and search; edit the visit target, toggle active, and assign
   accounts.
6. Create a visit plan, reorder its stops, record a **simulated** check-in, and close the visit.
7. Browse the partner directory, open a partner, advance an onboarding step.
8. Review deal registrations, decide one, and convert an approved registration.
9. Update a referral's status and read the commission ledger with its calculation notes.
10. Open the portal preview and switch between tickets, help centre, projects and appointments.
11. Read a customer-facing ticket conversation with internal notes withheld.

---

## 5. Files created or modified

**Created**

- `packages/mock-services/src/services/workspaces.ts` (~1,209 lines) — the `projects`,
  `fieldSales` and `partners` service implementations.
- `apps/crm/src/routes/projects/ProjectScreens.tsx` (~1,041 lines)
- `apps/crm/src/routes/partners/PartnerScreens.tsx` (~1,327 lines)
- `apps/crm/src/routes/field-sales/FieldSalesScreens.tsx` (~1,565 lines)
- `apps/crm/src/routes/portal/PortalPreviewScreens.tsx` (~778 lines)
- `docs/development-progress/BATCH_15_REPORT.md` (this file)

**Modified**

- `packages/mock-services/src/services/index.ts` — imported `workspaces.ts`, created the
  `workspaces` object via `makeProjectsService` / `makeFieldSalesService` / `makePartnersService`,
  and exposed the container keys `projects`, `fieldSales`, `partners`.
- `apps/crm/src/app/router.tsx` — eleven placeholder routes replaced with lazily imported named
  exports.

---

## 6. Tests executed and their results

**Passed** in the consolidated end-of-run pass, which ran once over batches 9–15.

| Check | Result |
| --- | --- |
| TypeScript and ESLint | PASS — 0 errors; 5 informational warnings repository-wide |
| Vitest unit / dom | PASS — 129 / 129 (4 files) and 8 / 8 |
| CRM build | PASS — 0 chunks over 500 kB; `FieldSalesScreens` 39.89 kB, `PartnerScreens` 37.39 kB, `ProjectScreens` 28.83 kB and `PortalPreviewScreens` 19.60 kB lazy chunks |
| Browser smoke (dev server, 1280 px, Playwright) | PASS — `/app/partners` 12 rows; `/app/projects`, `/app/field-sales` and `/app/portal-preview` navigated; 0 console errors on every route of a 26-route pass |

The pass added `packages/mock-services/src/services/modules.test.ts`, whose four workspace
cases cover the project overview and timeline, phases / milestones / deliverables / risks,
the partner and field-sales overviews, and the demo-local commission guarantee. The
registration conflict check, referral session override and territory account-count
behaviours remain recorded here rather than asserted. The browser pass also found the
`DataTable` keying defect recorded in §7 — the one finding no static check would have caught.

---

## 7. Defects the tests found, and how they were fixed

1. **`DataTable` collapsed every row without an `id` onto the same React key — found by the
   browser smoke pass, fixed in the consolidated pass.** The default `getRowId` in
   `packages/ui/src/components/data.tsx` was
   `String((row as { id?: string }).id ?? '')`; this batch's partner leaderboard rows carry
   `partnerId` and the field-sales territory-performance rows carry `territoryId` — derived
   rows with no `id` field — so each keyed to `''` and React reported duplicate-key errors on
   `/app/partners` and `/app/field-sales`. The default now falls back to the row index —
   `String((row as { id?: string }).id ?? index)` — and the prop type widened to
   `(row: TData, index: number) => string`. Tables over real records still pass their own
   `getRowId`.
2. **`Date.now()` read during render in the portal preview.** Hoisted to module scope so the
   render stays pure (a React Compiler finding).
3. The new workspace screens also received the shared cleanup of unused imports and variables.

The tables that pass explicit `getRowId` — customer success, tasks, sequences, activities,
playbooks and the analytics team-performance table — were unaffected; the other new screens
either key rows that carry record ids or render no `DataTable`. Only `/app/partners` and
`/app/field-sales` reported duplicate-key errors (see the §7 sections of
[`BATCH_09_REPORT.md`](./BATCH_09_REPORT.md) and [`BATCH_10_REPORT.md`](./BATCH_10_REPORT.md)).

---

## 8. Build and typecheck status

**Passed.** `FieldSalesScreens` (39.89 kB), `PartnerScreens` (37.39 kB), `ProjectScreens`
(28.83 kB) and `PortalPreviewScreens` (19.60 kB) emitted as lazy chunks; the CRM build reported
0 chunks over 500 kB, and typechecking passed across the six packages and three apps with
0 errors. The browser smoke pass navigated all four workspace routes at 1280 px with 0 console
errors, and its duplicate-key finding on `/app/partners` and `/app/field-sales` is recorded in §7.

---

## 9. Responsive and accessibility findings

### Accessibility work in this batch

- Every interactive control has an accessible name: icon-only buttons (stop reorder, refresh)
  carry `aria-label`; selects carry an `aria-label` or a bound `Field` label; checklist `Switch`
  controls are paired with an external `<label htmlFor>` so the visible text is the control's
  name.
- Status and tier are conveyed by text and shape as well as colour — `TonePill`, `Badge` and
  `StatusBadge` all render a label, not a bare colour.
- The project timeline and the visit list offer non-visual equivalents: the timeline has a
  "read the timeline as a table" disclosure and an `sr-only` summary; the visit plan is an ordered
  list.
- Simulated actions are labelled in the accessible text (check-in says `gpsUsed` stays false;
  route notes state no provider is contacted), so the honesty is heard and not only seen.
- Loading, empty and error states are handled on every list and detail screen
  (`ListSkeleton`, `RecordEmptyState`, retry actions).

### Not measured

- axe-core and Lighthouse were **not** run; the WCAG 2.2 AA target remains an architectural
  claim, not a measurement.
- Responsive behaviour at the eight target widths was **not** asserted; the 14-day chart, the
  project timeline and the territory editor are the most likely overflow sources at 360 px.
- RTL and the 13 locales were not re-exercised against these screens.

---

## 10. Known issues

### Correctness

- **Derived collections cannot be edited.** Project phases, deliverables and risks, and the
  commission ledger, are computed by the service and are read-only by design. Screens say so.
- **Referrals are session-only.** `updateReferral` persists in a closure for the session; a reload
  returns the seeded values. This is stated on the screen rather than implied to persist.
- **Territory membership is not modelled.** `Territory` has no account-membership field, so
  `assignAccounts` increments `accountCount` through a session-scoped set to avoid double counting;
  re-adding an account in a later session would count it again.
- **Projects have no archive/restore.** The `ProjectsService` interface exposes none, so no control
  is shown — a control that did nothing would violate the honesty rule.
- **The portal reads the same data as the internal workspace.** There is no `PortalService` and no
  `portalSettings` collection, so branding is derived from the active organization and the panels
  reuse the internal services. This is disclosed at the top of the screen and in each panel.

### Performance

- The field-sales screens fetch a single unfiltered `useList({ pageSize: 200 })` page and filter
  client-side, so that a selected plan or log stays in sync after a mutation. With small seeded
  datasets this is cheaper than a refetch-per-keystroke; with larger data it would not scale.
- The portal's tickets, help-centre and project panels each fetch a page on render; the help
  centre page is capped at 100 articles.

### Scope

- The four workspace cases in `modules.test.ts` cover the service overviews, the derived project lists and the demo-local commission guarantee; the registration conflict check, referral override and territory-count edges remain recorded here, not asserted.
- The portal exposes no write path of any kind, as required: submission, booking and e-signature
  stay absent and are labelled absent.

### Quality

- The field-sales file is large (~1,565 lines) because the module groups its screens by domain
  rather than by screen, matching the existing convention; a reviewer may prefer it split.

---

## 11. Remaining frontend work

With Batch 15 the projects, partners and field-sales domains are mock-complete and the portal is
previewable. The largest remaining areas tracked in `PROJECT_STATUS.md` are:

- Tenant administration (users, roles, permission matrix, audit) and the subscription / SaaS
  administration surface.
- The platform-owner console.
- Integrations and developer experience.
- Cross-cutting: a full RTL and locale pass, a real axe/Lighthouse run, responsive overflow
  assertions, and component/e2e coverage above the mock layer.

---

## 12. Suggested next batch

**Batch 16 — tenant administration.** Build the organization-level administration surface (company
profile and branding, business units and teams, the user directory, a role and permission matrix
with field-level controls, security policy, audit log and data management) behind the
`/app/settings/*` routes that currently render an honest placeholder. It complements the
organization switcher and branding already wired into the shell, and it is the last large surface
before the final QA batch.
