# Phase 2C — CRM Leads entry and server-side listing

## Delivered in this batch
- Existing **demo CRM** Leads header now has a clear **Live Leads (Laravel)** action. The demo retains its mock records, scoring and conversion workflows; none are falsely presented as real.
- First-party authenticated route: `/crm/leads`. It uses the same CRM React project and a dedicated live workspace with real organization membership selection; **not** the demo shell's mock organization switcher.
- After successful Laravel sign-in, the user lands on `/crm/leads`. The prior `/api-workspace` route redirects there to preserve old links.
- The live list requests real Laravel `GET /api/v1/leads` with page 1–N, page size 25, literal name search, and status filtering, and renders server-returned total/page controls.
- List state is keyed to organization + filters + pagination + refresh revision, masking previous organization and stale filter data. In-flight requests are discarded on effect cleanup.
- Existing Laravel lead creation, editing (with optimistic `expected_version`), deletion and read-only viewer behavior remain intact.
- Route smoke tests verify the demo→live entry and legacy route redirect; HTTP-client tests cover query-string filters and server pagination metadata.

## Important boundary and next steps
Only the **live Leads slice** is database-backed. All other `/app/*` pages including the advanced demo Leads screens still read browser mock data. A full HTTP adapter for the original Lead domain model is **not** ready: Laravel's initial `Lead` schema only holds `name, email, status, notes, version`; mock Leads include scoring, conversion, activities, ownership, source and other fields. Implement those schema/API contracts, authorizations and transactional flows before replacing those screens.

Do not enable real-data mode globally. No production deployment in this batch. Organization isolation must still be validated against a real PostgreSQL instance with two users and organizations, including API requests with forged/foreign IDs, plus browser login/logout and email verification. Maintain separate development and production database credentials.

Verification commands at repository root: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`; backend CI runs Laravel PostgreSQL tests. See `docs/development-progress/PHASE_02_LIVE_API_WORKSPACE.md` for configuration.
