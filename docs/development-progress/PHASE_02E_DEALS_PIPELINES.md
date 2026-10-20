# Phase 2E — Live Deals and Sales Pipelines

## What is implemented

- Laravel/PostgreSQL tables for organization-scoped Pipelines, ordered Stages (open, won, lost), Deals, and immutable Deal Events.
- Pipelines can be created with default Prospecting → Qualification → Proposal → Won/Lost stages, and new stages can be appended with explicit outcome type.
- Deals support creation, searchable/paginated lists, detail, edits with `expected_version`, account linkage, archival via soft deletion, and explicit stage movement with optimistic version checks.
- A deal can only move within its own Pipeline. The PostgreSQL composite foreign key `(organization_id, pipeline_id, stage_id)` prevents cross-tenant/cross-pipeline stage links even if a database writer bypasses the API.
- Account links are likewise constrained to the Deal's organization. Accounts used by active **or archived** Deals cannot be deleted without a future designed re-assignment/retention workflow.
- Deal create/update/move/archive generate audit records and Deal Events in the same transaction. Readers can view the latest 100 events for a non-archived Deal. Events survive Deal archival, for future audit/recovery implementations.
- Existing Laravel membership resolution, verified sessions, viewer read-only restriction and fail-closed Eloquent scoping apply across all Deal and Pipeline routes.
- New authenticated React view `/crm/deals` includes organization and pipeline selection, creation of pipelines/stages, deal forms, paginated stage board (100 per page), searchable deals, stage moves, deal history, and archival.
- The existing rich mock Deal board and list link explicitly to the Laravel page. Lead, Account, and Contact live pages also link to this view.
- PostgreSQL feature tests cover authorization, conflict versions, forged foreign IDs, stage creation, movement history, Account-delete conflicts, and archival retention. TypeScript API tests and browser route smoke tests cover clients/navigation.

## Limits and future work

- **Not** full Deal module parity: richer mock workflows (forecasting, weighted probabilities, approval chains, communications, general Activities, probability/expected-revenue calculations, and full sales reporting) are not yet backed by Laravel.
- The board currently lists up to 100 Deal records *per page* and displays per-stage counts for the current page, not absolute per-stage totals.
- Account dropdown is limited to 100 records; implement a server-side searchable picker for large tenants.
- Pipeline/stage rename, reorder, delete and controlled stage archiving require additional business rules before shipping. Deal archived-event history is retained in storage but not accessible from the live active-Deal timeline endpoint.
- Browser regression tests do not yet exercise the API with an actual configured session against a live PostgreSQL instance. Dedicated cross-organization user/browser and email tests remain essential for production.
- No production deployment. Keep the public demo clearly labeled; no global replacement of mock services.

## Verification

Run `php artisan test` in `apps/api` against an **isolated PostgreSQL test database**, then at root `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, and `npm run test:e2e`. Require CI to pass all Laravel/Frontend/Chromium checks before merge.
