# Batch Report — Batch 11

**Batch:** 11 — Analytics and reporting
**Status:** Complete. Verified in the end-of-run consolidated pass.
**Preceding batch:** [`BATCH_10_REPORT.md`](./BATCH_10_REPORT.md)
**Following batch:** [`BATCH_12_REPORT.md`](./BATCH_12_REPORT.md)

Batch 11 turns `/app/analytics` from a placeholder into a three-screen reporting
workspace, and adds the two service modules the screens needed but the mock layer did not
yet provide: exports and goals. Both read collections that were already seeded.

---

## 1. Features implemented

### Cross-module analytics overview (`/app/analytics`)

- **Headline strip** with win rate and its movement against the previous period, rendered
  as a KPI row with direction arrows.
- **Conversion funnel** — lead-to-win, step by step, with the conversion from the previous
  step. The panel carries an explicit display-format switch and a `<table>` fallback under
  a screen-reader caption, so the numbers are readable without the chart.
- **Revenue trend** chart, plus **win-loss by reason** and **pipeline value by stage**.
- **Cohort retention grid** — rendered as a real table (`<th scope="row">` per cohort,
  percentages written out as text) with colour as a redundant cue only, not the sole
  carrier of meaning.
- **Team performance** table with revenue by representative.
- **Retention strip**: gross revenue retention, net revenue retention, logo retention and
  churn rate.
- A closing note states that every conversion, cohort and win-loss figure is derived from
  the same synthetic records the record lists show — it is not a live warehouse.

### Dashboards (`/app/analytics/dashboards`, `/app/analytics/dashboards/:dashboardId`)

- Dashboard list with search and paging.
- Dashboard view renders each widget by kind: line, bar and area go through the shared
  `ChartFrame`; donut and funnel widgets are rendered by a dedicated segment component
  that adds the **chart-to-table switch the shared donut and funnel components did not
  provide**, so the toggle exists on every visualisation rather than only some.
- Simulated refresh: refreshing re-reads the mock data and is labelled as a refresh of
  synthetic numbers, not a live query.

### Reports (`/app/analytics/reports`, `/app/analytics/reports/new`, `/app/analytics/reports/:reportId`)

- **Report list** with search, category filter and paging.
- **Report viewer** runs a saved definition through `services.reports.run` and renders the
  result; the surrounding copy says the preview reads the seeded dataset through the mock
  report engine and that no SQL is generated and no database is queried.
- **Report builder** chooses source, dimensions and measures, switches the display between
  table and funnel, and previews the definition before saving.
- **Export** requests an export job through `services.exports` and is labelled as a
  local-only artefact — the service records `generatedLocally: true` for every request.

### Services added in this batch

| Service | Factory | Notes |
| --- | --- | --- |
| `exports` | `makeExportsService` | Request and list export jobs. Every request is stamped `generatedLocally: true`; nothing is uploaded. |
| `goals` | `makeGoalsService` | Reads the seeded `salesGoals` collection per user and period. |

### Honesty controls in this batch

| Capability | Wording used |
| --- | --- |
| Report preview | "reads the seeded dataset through the mock report engine… no SQL is generated" |
| Export | Local-only artefact; export job records that it was generated in the browser |
| Dashboard refresh | Refresh re-reads synthetic data; not a live connection |
| Charts | Every visualisation offers a table alternative; captions are `sr-only`, not omitted |
| Figures | Stated as derived from the synthetic seed |

## 2. Pages and routes created

| Route | Screen |
| --- | --- |
| `/app/analytics` | Cross-module overview |
| `/app/analytics/dashboards` | Dashboard list |
| `/app/analytics/dashboards/:dashboardId` | Dashboard view with widget switch |
| `/app/analytics/reports` | Report list |
| `/app/analytics/reports/new` | Report builder |
| `/app/analytics/reports/:reportId` | Report viewer |
| `/app/goals` | Still an honest placeholder — the `goals` service exists, the goal screen does not |

The two former `/app/analytics` placeholder entries were replaced; a `placeholder` remains
for the goal screen so the route resolves and names what it will contain.

## 3. Components created or reused

Reused from `@crm/ui`: `ChartFrame`, `DonutChart`, `FunnelChart`, `KpiCard`, `MiniStat`,
`DataTable`, `Card`, `Badge`, `Button`, `Select`, `Pagination`, `DemoNotice`, `Alert`,
`EmptyState`, `TableWrap`/`Th`/`Tr`/`Td`, `InlineBar`, `cn`.

Reused from the app: `PageHeader`, `FilterBar`, `ListSkeleton`, `RecordEmptyState`,
`RecordErrorState` and the formatting helpers; `useAsync`, `useList`, `useMutation`,
`useServices`.

The only new visual behaviour is the table alternative for donut and funnel widgets, which
lives in `DashboardScreens.tsx` rather than in the shared component.

## 4. Interactive mock workflows completed

1. Read the cross-module overview and switch the funnel between chart and table.
2. Read the cohort retention grid.
3. Open a dashboard, read line/bar/area and donut/funnel widgets, and toggle each to a table.
4. Refresh a dashboard and see the synthetic figures re-read.
5. Search, filter and page the report list.
6. Build a report definition, preview it, and save it.
7. Open a saved report, run it, and read the result.
8. Request an export and read the local-only export record.

## 5. Files created or modified

**Created**

- `packages/mock-services/src/services/analytics-extras.ts`
- `apps/crm/src/routes/analytics/AnalyticsScreens.tsx`
- `apps/crm/src/routes/analytics/DashboardScreens.tsx`
- `apps/crm/src/routes/analytics/ReportScreens.tsx`
- `docs/development-progress/BATCH_11_REPORT.md` (this file)

**Modified**

- `packages/mock-services/src/services/index.ts` — imports plus the `exports` and `goals`
  container keys.
- `apps/crm/src/app/router.tsx` — the six analytics routes above and the goal placeholder.
- `packages/mock-services/src/services/modules.test.ts` — export and goal contracts
  (added during the consolidated pass).

## 6. Tests executed and their results

Verification ran once, at the end of the batches 9–15 run:

```
TypeScript check      PASS   6 packages + 3 apps, 0 errors
ESLint                PASS   0 errors, 5 warnings (informational)
Vitest unit           PASS   129 / 129
Vitest dom            PASS     8 /   8
CRM build             PASS   0 chunks over 500 kB
Browser smoke         PASS   /app/analytics and /app/analytics/reports, 0 console errors
```

Batch-specific coverage in `modules.test.ts`:

- `lists export requests as local-only artefacts` — asserts `generatedLocally` is `true`
  for every request, which is the guarantee that makes the export button honest.
- `returns goals for a user and period` — asserts the goal reader returns a page for a
  seeded user.

Browser evidence: `/app/analytics` rendered 23 table rows plus the "SAMPLE DATA" badge and
the overview copy; `/app/analytics/reports` rendered the report list and the runnable
preview panel.

Production chunks: `ReportScreens` 21.92 kB, `AnalyticsScreens` 17.08 kB,
`DashboardScreens` 13.18 kB (the charting library itself stays in the shared `charts`
chunk at 430.11 kB, and no chunk exceeds 500 kB).

## 7. Defects the tests found, and how they were fixed

Three defects in this batch were caught by the consolidated pass and fixed:

1. **`runPreview.loading` did not exist.** The report viewer read `loading` from the
   mutation hook, whose pending flag is named `pending`. Corrected, so the viewer shows a
   skeleton while a report runs instead of rendering the empty state first.
2. **Unused pagination state.** The overview declared `const [page, setPage]` but never
   called `setPage`, which the compiler flagged. Reduced to a read-only `page`.
3. **A conditional hook.** In `DashboardScreens.tsx` a `React.useMemo` sat *after* an early
   return for the table branch, violating the rules of hooks. The memo was replaced with a
   plain in-render computation, since the series it derives is cheap and the hook added no
   value.

## 8. Build and typecheck status

Full results are in [`TEST_REPORT.md`](../testing/TEST_REPORT.md). For this batch:
TypeScript 0 errors; ESLint 0 errors; the three analytics chunks built successfully and
none exceeded the 500 kB budget; the two analytics routes produced zero console errors in
the browser probe.

## 9. Responsive and accessibility findings

- Every visualisation carries a table alternative; the cohort grid is a table first, with
  colour as a redundant cue only.
- The funnel's format switch is a labelled radio group, so the choice is announced rather
  than inferred from a pressed-looking icon.
- Chart captions are `sr-only` `<caption>` elements inside the tables, so a screen reader
  user gets the units and the scope.
- Sections use `aria-labelledby` pointing at their real `<h2>`.
- The report builder is a plain form; the preview is a labelled region.
- Charts sit in fixed-height frames so the layout does not jump between the chart and the
  table.

## 10. Known issues

- **Team performance does not page.** The overview reads a single 25-row page for the team
  table and has no pager. The underlying service supports paging.
- **No goal screen.** `services.goals` is implemented and tested, and `/app/goals` is still
  a placeholder.
- **Report scheduling is presentational.** `reports.schedule` is not surfaced in the
  builder; scheduled deliveries would need a backend and are not implied.
- **Export jobs are recorded, not produced.** An export request creates a local record and
  reports its row count. No file is generated or downloaded.

## 11. Remaining frontend work

- A goal-tracking screen over the `goals` service.
- Paging and column choice on the overview's team table.
- A report detail route with run history.
- Batches 16+ (tenant administration, subscription administration, platform console,
  integrations and developer experience, globalization completion, final QA).

## 12. Suggested next batch

**Batch 12 — workflow automation and AI assistant**, which was implemented in the same run
and reports separately in [`BATCH_12_REPORT.md`](./BATCH_12_REPORT.md).
