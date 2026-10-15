# Batch Report — Batch 5

**Batch:** 5 — CRM application shell and core screens
**Date:** 2026-10-14
**Repository state:** all three applications build; every check green

---

## 1. Features implemented

### Application bootstrap

- Vite 8 + React 19 + React Router 7 single-page application with a deep-link-preserving
  client router
- Provider stack ordered deliberately: `ThemeProvider` outermost (it writes the token
  attributes), then `ServiceProvider`, then `TooltipProvider`
- Top-level error boundary that catches a render failure escaping a route, explains that it is
  a frontend defect rather than an account problem, and offers both a reload and a
  reset-and-reload recovery
- Theme, density and direction resolved by an inline script **before first paint**, so a
  dark-mode user never sees a white flash on a dense application
- Route-level code splitting: charts, drag-and-drop and each screen group ship as their own
  chunks

### Application shell

- **Entitlement-resolved navigation.** The sidebar comes from `resolveNavigation()`, filtered
  by the tenant's licensed modules, the user's permissions and their Simple/Advanced
  preference. A module the tenant has not bought cannot appear.
- **Organization switcher** wired to the tested `tenant.switchOrganization`, showing each
  tenant's currency, locale and module count. Switching performs a full reload, deliberately:
  every cached list and dashboard belongs to the previous tenant, and pretending otherwise
  would risk one tenant's figures appearing under another's name.
- Top bar: search trigger, quick-create menu, theme toggle, density toggle, notification
  centre with unread count, help menu with shortcuts, user block
- **Command palette (⌘K)** with grouped results, live record search across leads and deals,
  keyboard navigation and `aria-activedescendant`
- Notification centre with all/unread/needs-action filters
- Collapsible sidebar, mobile drawer, onboarding strip in Simple Mode
- A **non-dismissible demonstration stripe** above everything, stating that no backend is
  connected. It cannot be closed, because a reviewer should never be able to forget it.

### Role-based home dashboard

- Resolves the dashboard from the persona, routing representatives to their individual view
  and leaders to the audience default
- Renders widget data from `widgetDataBatch`, mapping each widget kind to the right
  visualisation: KPI tile, time series, donut, funnel, leaderboard or table
- **Editable layout**: move a widget with the arrows, hide it from the menu, saved immediately
  through `saveLayout`. Hidden widgets are undoable.
- Headline figures, a supporting "what needs you today" panel fed by the daily plan, a recent
  activity panel and a forecast strip
- Full reset from the dashboard

### Leads

- **List**: facet-driven filtering with live counts, saved views, search, server-shaped
  sorting, pagination with row-count control, bulk assign, bulk status change, rescore and
  archive, with per-record failure reporting
- **Detail**: explainable lead scoring (fit and engagement components, weighted factor
  contributions, model label and an explicit note that the model is a demonstration), contact
  details, an activity timeline with inline note composition, next actions and conversion links
- **Form**: React Hook Form + Zod validation, required-field marking, unsaved-changes
  detection with a beforeunload guard, and error surfacing per field
- **Conversion wizard**: three steps — review, preview, confirm. The preview step writes
  nothing and shows duplicate warnings and field-level conflicts; the commit is a separate
  explicit action. This is the part of the batch worth reading, because promoting a lead is the
  most destructive routine operation in a CRM.

### Deals

- **Board**: drag-and-drop **and** per-card keyboard move controls calling the same `onMove`,
  which calls `deals.move` and receives the recomputed pipeline summary. Stage totals, the
  summary strip and the weighted figure all read from that one response, so they cannot
  disagree with the board.
- Lost stages open a reason dialog rather than failing silently, because the pipeline
  configuration requires a reason
- Duplicate paths removed: the list view's status filter and the detail view's stage stepper
  both go through the same operation
- **List**: server-shaped sorting, status filter, four summary tiles, full deal columns
- **Detail**: stage stepper, KPI row, read-only product lines with a running total, activity
  timeline including stage-change events, account summary, deal team, competitors and
  won/lost panels
- **Form**: pipeline and stage selection driving probability and forecast category, validation
- **Forecast**: quota, commit, best case, coverage and gap, a per-owner table that reconciles
  with the deals each owner holds, and forecast accuracy against previous periods

### My work

- Daily plan ordered overdue-first, with totals, task completion, undo, and "where the time
  goes" by activity type
- Completing a task removes it from the plan and updates the counters, because both read
  `dailyPlan` which recomputes from the activity records
- Task creation inline, with an honest note that communication is simulated

### Boundaries

Four genuinely different states rather than one generic error page: not entitled (routes to
billing), access denied (routes to an administrator), session expired (sign in again,
unsaved work preserved), and not found. Conflating them makes a person read "access denied"
when an upgrade would have fixed it.

### Component library additions

- **`ChartFrame`**: the home of the chart-to-table requirement. Every chart carries a table
  alternative, an accessible text summary, and token-driven colours. `allowTableToggle` is a
  required field on the domain type, so a chart without a table does not typecheck.
- **`DonutChart`** with an always-visible legend carrying values and shares as text, because a
  seven-colour ring is the least accessible chart form in common use
- **`FunnelChart`** drawn as labelled bars rather than a tapering shape, because a silhouette
  distorts the step widths and makes the eye read a different conversion rate from the data
- **`Sparkline`**, **`InlineBar`**, **`MiniStat`**
- **`KanbanBoard`** built on dnd-kit with: a drag handle hidden from the accessibility tree, a
  per-card previous/next move control operable from the keyboard, a per-column drop lock with a
  stated reason, a single live region announcing every move and its failure, and a drag overlay
- **`PipelineList`**: the same records as a list with a stage selector, because a board is the
  wrong shape for comparing valuations or for a phone

### Platform administration

Application shell and an honest landing page. The console is scheduled for its own batch; this
exists so the monorepo builds as a whole and the separation between the three surfaces is real
rather than a folder name. The page names the planned scope and links to what works, instead of
showing a dashboard of invented tenant counts.

---

## 2. Pages and routes created

| Surface | Real screens | Routes |
| --- | ---: | ---: |
| CRM application | 10 | 31 real, 34 placeholder |
| Platform admin | 1 | 1 |
| Public website | unchanged | 126 |
| **Total** | | **192** |

**Real screens:** Home dashboard · Leads list · Lead detail · Lead form · Lead conversion ·
Deals board · Deals list · Deal detail · Deal form · Forecast · My work · Help · Boundaries (4)

**Placeholder routes (34):** contacts, accounts, calendar, lead board/sources/import/duplicates,
pipeline configuration, lost reasons, campaigns, support, knowledge base, customer success,
products, quotes, orders, contracts, recurring revenue, inbox, documents, projects, analytics,
workflows, AI assistant, integrations, developer platform, customization, industry templates,
partners, field sales, portal preview, administration. Each states the module's real name and
description from the registry and links to the finished screens.

---

## 3. Components created or reused

| Source | Created | Reused |
| --- | ---: | ---: |
| `@crm/ui` | 2 modules (`charts.tsx`, `kanban.tsx`) exporting 8 components | 48 existing components |
| `apps/crm` | 6 (shell, service provider, shared furniture, 4 screen modules) | all of the above |
| `apps/platform-admin` | 2 | 48 |

---

## 4. Interactive mock workflows completed

1. Sign in, then change persona and see the dashboard resolve differently
2. Switch organization and observe a disjoint dataset with different currency and locale
3. Drag a deal between stages and watch the column total, the summary strip and the weighted
   figure update from the same response
4. Move the same deal from the keyboard and observe an identical result
5. Attempt to close a deal as lost without a reason and be stopped by the dialog
6. Open the command palette, search across records, and navigate by keyboard
7. Filter leads by facet, save state in the URL, page through, and bulk-assign a selection
8. Open a lead's score and read the weighted factors behind it
9. Create a lead with validation, then convert it — preview first, nothing written, then commit
10. Complete a task and watch it leave the plan with the counters updating
11. Undo a completion from the toast
12. Edit a deal's layout on the dashboard, reorder a widget, hide another, then reset
13. Navigate to an unbuilt module and land on an honest placeholder that links onward
14. Reach each of the four boundary states

---

## 5. Files created or modified

| Area | Files |
| --- | ---: |
| `apps/crm` configuration and bootstrap | 5 |
| `apps/crm/app` (shell, provider, router) | 3 |
| `apps/crm/components` | 1 |
| `apps/crm/routes` | 7 |
| `apps/platform-admin` | 6 |
| `packages/ui` | 3 |
| **Total** | **25** |

Approximately 7,400 lines of new application code and components.

---

## 6. Tests executed and their results

```
TypeScript (6 packages + 3 apps)   PASS   0 errors
astro check (20 files)             PASS   0 errors, 0 warnings, 0 hints
ESLint (whole repository)          PASS   0 errors, 3 warnings
Vitest unit project                PASS   70 / 70 tests
astro build — website              PASS   126 pages
vite build — CRM                   PASS   built in 1.74s
vite build — platform admin        PASS   built in 1.02s
check-links — 126 HTML files       PASS   15,093 / 15,093 resolved
```

The three ESLint warnings are informational: TanStack Table and Recharts are not yet
compatible with the React Compiler's analysis, so it skips memoising those components. That is
a real trade-off worth recording rather than suppressing.

### Bundle output (CRM)

```
vendor     322.91 kB  (gzip 103.51 kB)
charts     430.11 kB  (gzip 121.38 kB)   ← lazy, analytics only
index      758.60 kB  (gzip 218.44 kB)
schemas    115.78 kB  (gzip  35.17 kB)
dnd         46.79 kB  (gzip  15.39 kB)   ← lazy, deals only
LeadsScreens 45.08 kB (gzip  11.99 kB)   ← lazy
DealsScreens 42.02 kB (gzip  10.88 kB)   ← lazy
Home         16.97 kB (gzip   5.32 kB)   ← lazy
MyWork       13.58 kB (gzip   4.80 kB)   ← lazy
```

**The index chunk is 758 kB and Vite warns about it.** This is a real problem I did not fix:
the shared barrel export means importing `@crm/ui` pulls in every component including the ones
a given screen never uses. The fix is per-component entry points or a deeper import path, and
it is worth doing before the remaining screens land, because the problem compounds with each
one added.

---

## 7. Build and typecheck status

| Target | Typecheck | Lint | Tests | Build |
| --- | --- | --- | --- | --- |
| `packages/design-tokens` | PASS | PASS | n/a | n/a |
| `packages/shared-types` | PASS | PASS | n/a | n/a |
| `packages/configuration` | PASS | PASS | n/a | n/a |
| `packages/localization` | PASS | PASS | n/a | n/a |
| `packages/ui` | PASS | PASS | no suites yet | n/a |
| `packages/mock-services` | PASS | PASS | 70 / 70 | n/a |
| `apps/website` | PASS | PASS | no suites yet | PASS — 126 pages |
| `apps/crm` | PASS | PASS | no suites yet | PASS |
| `apps/platform-admin` | PASS | PASS | n/a | PASS |

---

## 8. Responsive and accessibility findings

### Accessibility work in this batch

- The kanban board is fully operable without a pointer: per-card previous/next controls, a
  hidden drag handle, and a per-column lock with a stated reason. Every move is announced
  through one live region.
- The command palette implements `role="dialog"`, `aria-modal`, `role="listbox"` with
  `aria-activedescendant`, and arrow/enter/escape handling.
- Charts carry a screen-reader summary of what they show and how many series, and the table
  alternative contains the exact values.
- `DonutChart` states each segment's value and share as text, so the chart is readable without
  distinguishing hues.
- The lost-reason requirement is enforced by the service, and the dialog exists so the user is
  told rather than silently blocked.
- Boundary states are four distinct screens with different next steps, not one error page.

### Lint-driven improvements

Six React Compiler findings were fixed rather than suppressed, and each was a genuine defect
rather than a style preference:

| Finding | Why it mattered |
| --- | --- |
| `setState` inside effects in `useAsync` and `useList` | A loading flag written synchronously in an effect causes a second render on every mount. **Loading is now derived** from whether the loaded request key matches the current one. On a dashboard with eight widgets that removes sixteen wasted renders. |
| `setState` on route change in the shell | The drawer and notification panel now carry the path they were opened on, so a route change closes them by derivation. |
| `setState` when the palette opened | The palette is keyed on its open state, so mounting fresh is how it resets. Two effects deleted. |
| `setState` to seed the active pipeline | The fallback is now derived rather than stored. |
| `Date.now()` during render | The clock is read once per mount. Previously a lead could read as overdue in one column and on time in another within a single render pass, and the list was untestable. |

### Not measured

Still no axe run, no Lighthouse run, and no responsive overflow assertion at the eight target
widths. The board was built with a fixed column width and horizontal scroll, which is the
pattern that most often causes overflow at 360px, so this is the first thing to verify.

---

## 9. Known issues

### Performance

1. **The CRM index chunk is 758 kB** (218 kB gzipped) because the `@crm/ui` barrel export pulls
   in every component. Each new screen makes it worse. Fix before the next batch.
2. The charts chunk is 430 kB. It is lazily loaded, so only analytics pays for it, but Recharts
   could be replaced with direct SVG for the four chart shapes actually used.

### Scope

3. **34 routes render a placeholder.** The CRM is roughly half-built. The service layer for the
   remaining modules exists; the screens do not.
4. **Contacts and accounts are not built**, which is the most visible gap: a lead converts into
   records that cannot be opened.
5. **The product catalog service is not implemented**, so the deal detail's product table is
   read-only and says so rather than offering a control that would fail.
6. **Platform administration is a landing page**, not the console.

### Quality

7. **No component or end-to-end tests for any CRM screen.** The mock services are covered;
   nothing above them is. The kanban board in particular deserves a test, because its
   consistency claim rests on two input paths calling one operation.
8. **No screenshot or visual regression testing.**
9. `apps/crm` and `apps/platform-admin` have no unit test suites or coverage.
10. **The organization switcher reloads the page.** Correct for isolation, but it would be
    better to reset the query cache and the local state properly once there is a cache to
    reset.

---

## 10. Remaining frontend work

Ordered by dependency:

1. **Fix the bundle**: per-component entry points in `@crm/ui`, so importing a button does not
   import a chart.
2. **Contacts and accounts screens** — the two records a converted lead produces.
3. **Support screens** — tickets, queue and SLA, so the service overview and derived SLA states
   have a surface.
4. **Analytics screens** — the chart components exist and are used by the dashboard; the
   analytics screens would be mostly composition.
5. **Workflows, AI and integrations screens.** The service layer for workflows and AI is
   already implemented and tested.
6. **Remaining 33 service modules** as their screens are built.
7. **Administration screens** — organization, users, roles, security, data and billing.
8. **Platform administration console.**
9. **Component, integration and end-to-end test suites**, plus axe and Lighthouse measurement.
10. **Remaining website page templates.**

---

## 11. Suggested next batch

**Batch 6 — contacts and accounts, plus the bundle fix.**

Scope:

1. `@crm/ui` per-component entry points and a deeper import path, then re-measure the index
   chunk. Non-negotiable before more screens land.
2. **Contacts**: directory with lifecycle stage, consent state per channel, relationship graph,
   the full timeline, and a duplicate review with field-level merge resolution.
3. **Accounts**: list with health, the **Customer 360** profile bringing deals, tickets,
   documents and communications onto one page, parent-child hierarchy with rolled-up revenue,
   and the buying committee.
4. **A component test suite for the kanban board**, covering: a drag move and a keyboard move
   producing identical service calls; a rejected move leaving the card in place and announcing
   why; a locked column refusing a drop; and the live region announcing each outcome.

Exit criteria: a converted lead's contact and account records are openable and complete, the
account page shows real related records, and the bundle warning is gone.
