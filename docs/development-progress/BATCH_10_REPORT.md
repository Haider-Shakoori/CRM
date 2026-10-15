# Batch Report — Batch 10
**Batch:** 10 — Engagement: Calendar, Tasks, Sequences, Communications
**Date:** 2026-10-14
**Repository state:** changes complete in the working tree; **verified in the end-of-run consolidated pass**
**Prior report:** [`BATCH_09_REPORT.md`](./BATCH_09_REPORT.md)

## 1. Features implemented

Batch 10 completes the engagement domain (calendar, tasks, sequences, communications). All four screens run entirely against existing services, components and types — no new npm dependencies.

### Calendar (`/app/calendar`)
- Day, week and month views over `services.calendar.events` with a queried window (`from`/`to`), not client-side truncation.
- Sidebar groups "My calendar" and "Team calendar" by organiser (`organizerId`/`ownerId` === current user), with Switches to filter.
- Stats: events in view, meetings, demos, visits, scheduled time (hours).
- Event dialog: preparation brief (demo template engine), and "Find another time" panel using `services.calendar.suggestSlots` (deterministic, labelled **suggestions**, not availability) and `services.calendar.reschedule` (both marked simulated).
- Explicit demo notices: no provider connected; recording a new time changes this browser only.

### Tasks (`/app/tasks`)
- Views: Assigned to me (my_open), Due today, Overdue, Upcoming, Completed, Everything. Each view becomes filter clauses on the query.
- Overdue/due-today compare date-only strings (`dueDate` vs pinned `todayIso`); pinned with `React.useState(() => ...)` to avoid render-time `new Date()` purity issues.
- Bulk actions: Complete (via `services.activities.complete(ids)` since TasksService has no bulk), Reassign (`tasks.reassign`), Delete (`tasks.bulkRemove`). Single-row "Mark complete" via `tasks.complete(id)`.
- Row dialog: status/priority/owner/dates, checklist with `tasks.toggleChecklistItem`, linked records with navigation, optional single-task reassignment.
- Filters by priority and owner; DataTable with selection, pagination, loading skeletons and empty state.
- Honest demo notices; completion/reassignment/deletion change this browser only.

### Sequences (`/app/sequences` and `/app/sequences/:sequenceId`)
- List: status filter, KPIs (total, active, paused, enrolled, avg reply rate). Click row navigates to detail.
- Detail: status toggle (Pause/Resume), step timeline (1-based, ordered) with per-step stats and "Send this step now" (simulated toast). "Send next step" simulated.
- Enrolments: derived from counters (not a stored collection); list with status/current step/next/enrolled, bulk Pause/Resume, Remove (single) — all mutate locally. About panel explains derivation.
- Enrol dialog: MultiSelect over leads/contacts matched to `targetType`; `sequences.enroll` records in this browser session only. Send window and aggregate KPIs shown.

### Communications (`/app/communications`)
- Unified timeline merging `services.activities` (kinds: email/call/meeting/note/sms/whatsapp/chat/social/demo/visit) and `services.conversations` (channels: email/sms/whatsapp/live_chat/web_chat/social/phone/internal).
- Bucketed by channel: Email/Call/Meeting/Short message/Note/Other; channel + source filters, search.
- Each entry labelled as a synthetic communication record; Timeline items set `simulated: true`; page-level demo notice states no real sending/receiving and no provider connected.
- Grouped by day; per-entry actions include "Open activity"/"Open conversation", status/unread badges.

## 2. Pages and routes created/modified
| Route | Screen | Kind |
|---|---|---|
| `/app/calendar` | Calendar (day/week/month) | Real (replaced placeholder) |
| `/app/tasks` | Tasks | Real |
| `/app/sequences` | Sequences list | Real |
| `/app/sequences/:sequenceId` | Sequence detail | Real |
| `/app/communications` | Communications timeline | Real |

Module route manifest updated with prefixes:
- `/app/calendar` → `calendar`
- `/app/tasks` → `activities`
- `/app/sequences` → `campaigns`
- `/app/communications` → `inbox`

No new modules added; existing module keys reused per plan.

## 3. Components created/reused
No new `@crm/ui` primitives. Reused: `DataTable`, `Pagination`, `PageHeader`, `RecordHeader`, `FilterBar`, `ListSkeleton`, `MiniStat`, `Card`, `Button`, `Badge`, `StatusBadge`, `TonePill`, `Progress`, `Select`, `Switch`, `Dialog`, `DialogContent`, `ConfirmDialog`, `Field`, `Checkbox`, `MultiSelect`, `Timeline`, `DemoNotice`, `Alert`, `IconButton`, `Avatar`, and `formatDate`/`formatNumber`/`formatMoney` helpers.

## 4. Interactive mock workflows completed
1. Navigate calendar by day/week/month; filter My/Team.
2. Open event; read preparation brief; generate deterministic suggestions; "Use this time" records locally (simulated).
3. Switch task views; filter by priority/owner; select multiple and bulk Complete/Reassign/Delete; single complete; toggle checklist in dialog.
4. Browse sequences; open detail; toggle Pause/Resume; simulate "Send next step" and "Send this step now"; enrol records; bulk Pause/Resume; Remove enrolment.
5. Browse communications timeline; filter by channel/source; read synthetic entries; open linked records.

## 5. Files created or modified
**Created:**
- `apps/crm/src/routes/engagement/CommunicationsScreens.tsx`

**Modified:**
- `apps/crm/src/app/router.tsx` — replaced calendar placeholder with real routes; added `/app/tasks`, `/app/sequences`, `/app/sequences/:sequenceId`, `/app/communications`; added manifest prefixes for those four.
- `apps/crm/src/routes/engagement/TaskScreens.tsx` — added `subjectPath` to named exports.
- `docs/development-progress/BATCH_10_REPORT.md` (this file)

**Already present (written in this session earlier):**
- `apps/crm/src/routes/engagement/CalendarScreens.tsx`
- `apps/crm/src/routes/engagement/TaskScreens.tsx`
- `apps/crm/src/routes/engagement/SequenceScreens.tsx`

## 6. Tests and verification status
**Verification passed** in the consolidated end-of-run pass, run once over batches 9–15. Typecheck, lint and the test suite are green; the CRM build has 0 chunks over 500 kB.

| Check | Result |
|---|---|
| TypeScript and ESLint | PASS — 0 errors; 5 informational warnings repository-wide |
| Vitest unit / dom | PASS — 129 / 129 (4 files) and 8 / 8 |
| CRM build | PASS — 0 chunks over 500 kB; `CalendarScreens` 18.88 kB, `TaskScreens` 17.00 kB, `SequenceScreens` 19.20 kB, `CommunicationsScreens` 10.00 kB |
| Browser smoke | PASS — `/app/calendar`, `/app/tasks`, `/app/sequences` and `/app/communications` navigated at 1280 px; 0 console errors on each |

No tests were authored in this batch, but the consolidated pass added
`packages/mock-services/src/services/modules.test.ts`, whose two `sequences` cases cover the
seeded list and enrolments, and the guarantee that enrolling records an enrolment without
contacting anyone.

## 7. Defects / notes
- **Duplicate export removed.** `SequenceScreens.tsx` exported `SequenceDetail` twice; the consolidated pass collapsed it to a single export. TypeScript caught it, not a runtime test.
- The task, sequence and activity tables pass explicit `getRowId` values, and the calendar and communications screens render no `DataTable`, so the `DataTable` default-key defect found in Batch 15 did not affect them (see [`BATCH_15_REPORT.md`](./BATCH_15_REPORT.md) §7).
- `Select` silently drops `aria-label`; screens use `Field` with `htmlFor` where practical (Task reassignment, sequence enrol, etc.). Where used directly in filter bars, `aria-label` is present on the element passed to Select API but note the known behavior.
- `Progress` gets accessible name from `label` (visible); no `aria-label` prop.
- Date comparison uses date-only ISO strings for tasks; pinned `todayIso` once per mount.
- Conversations not org-scoped in service layer; Communications screen filters conversations by `organizationId` when current user is known.
- DataTable selection uses `onSelectedIdsChange` receiving selected ids array.

## 8. Build and typecheck status
**Passed.** `CalendarScreens` (18.88 kB), `TaskScreens` (17.00 kB), `SequenceScreens` (19.20 kB) and `CommunicationsScreens` (10.00 kB) all emitted as lazy chunks; the build reported 0 chunks over 500 kB. The browser smoke pass navigated each of the four routes with 0 console errors and recorded the communications timeline at roughly 50,000 characters of rendered history.

## 9. Accessibility and responsiveness
- Semantic headings, cards, tables, lists. Keyboard-accessible controls.
- Demo labels are explicit (text + notices). No hidden simulated claims.
- Color not sole channel for status; status badges use text labels.
- Focus ring utility used on interactive buttons.
- Responsive grids; tables may scroll on small screens.

## 10. Known issues
None blocking. Batch 10 meets stated scope. The consolidated pass found no further blocking issue; the only batch-specific fix was the duplicate export in §7.

## 11. Remaining frontend work
As per Batch 9, major areas: Reporting/Analytics depth, Automation/Workflows screens (canvas), Administration, Contracts/Recurring/Projects detail, Platform console breadth, RTL/locales, axe/Lighthouse.

## 12. Suggested next batch
**Batch 11 — Analytics and reporting.** The `dashboards`, `reports` and `analytics` services already exist and are seeded; the batch adds the `exports` and `goals` service modules and builds the cross-module overview, dashboard view (with a chart-to-table switch on every widget), report list, report builder and report viewer. See [`BATCH_11_REPORT.md`](./BATCH_11_REPORT.md).