# Phase 2H — Lead conversion and configurable Deal outlook

## Delivered

- **Real Lead conversion:** `POST /api/v1/leads/{id}/convert` creates a Contact and either a new Account or a link to an existing organization-visible Account. It retains the original Lead, sets status `converted`, increments its version, writes durable `crm_lead_conversions` linkage and audit events in one PostgreSQL transaction.
- **Safe retries:** concurrent/duplicate conversion requests serialize on the Lead row. Once converted, the same request returns the original conversion link without generating more records. Version conflicts return HTTP 409.
- **Security:** composite organization-level foreign keys for conversion links, authenticated membership + write role middleware, server-side Account lookup, and protected converted Lead deletion and direct status mutations. A foreign Account ID cannot be used.
- **Live frontend:** `/crm/leads` includes Convert with explicit first/last name and new Account name confirmation. Contact email and notes are carried from the Lead. Conversion results link to the live Contact and Account views.
- **Stage weights:** migration adds `probability` to pipeline stages and backfills a stated default assumption (first three stages 10%, 25%, 60%; remaining open stages 25%; Won 100%; Lost 0%). New pipeline stages receive corresponding defaults. Admin/member write roles can modify only open-stage values 0–100 through `PATCH /api/v1/pipelines/{id}/stages/{stageId}/probability`; outcome stage weights are fixed.
- **Currency-separated outlook:** `GET /api/v1/reports/forecast` reports active Deals grouped by original currency, including open value, assumed weighted open value, won/lost opportunity value, and optionally inclusive expected-close-date filters and tenant-visible pipeline selection.
- **Live reporting UI:** `/crm/dashboard` shows the forecast by currency with date filters and editable open-stage assumptions. The existing report and demo remain intact.
- **Verification:** Laravel/PostgreSQL feature tests cover idempotency, rollbacks, role enforcement, cross-organization protection, stale writes, stage-weight edits, date filtering, and currency-safe aggregation. TypeScript API tests cover fail-closed request scoping, CSRF and forecast parameters.

## Explicit limitations / next tasks

- These are **stage-probability assumptions**, not machine-learned forecasts or guaranteed sales. Won Deal amount is not invoiced revenue or cash collected.
- The conversion UI creates a **new** Account. The conversion API also supports an existing Account, but the live UI needs a searchable existing-Account picker and duplicate-contact matching before broad production use.
- No Deal is automatically created during conversion; conversion of linked Activities and downstream history reparenting requires a separately specified workflow.
- Existing Leads whose status was manually set to `converted` before this batch but lack a `crm_lead_conversions` row require review; the conversion endpoint fails closed instead of guessing.
- The more elaborate `/app/*` mock-backed CRM modules remain demo-only. No production deployment has occurred.
- No real multi-user browser E2E with configured staging credentials has yet been performed.

## Verification and release gates

At repo root: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. In `apps/api`: `php artisan test` on a dedicated PostgreSQL test database. Do not merge until all GitHub CI jobs pass. No destructive production migrations.
