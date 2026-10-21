# Phase 2O — In-Record Follow-up Logging & Completion

## Delivered

- Expanded the authenticated, organization-scoped **customer timeline** to show accurate per-record totals: notes, all logged activities, open and completed activities, open follow-up tasks, overdue activities and the next upcoming due date. These counts are calculated server-side against *all records*, not just the current 25-entry page.
- Added `GET /api/v1/timeline/summary?subject_type=lead|contact|account|deal&subject_id=UUID`, reusing the existing fail-closed subject validation, membership-checked request context and organization filters. An unknown/foreign subject is rejected; metrics do not aggregate across tenants.
- Included `version`, `due_at` and `completed_at` in each activity timeline entry while preserving the union with notes. Existing list chronology remains ordered by **log creation time**, not the due date.
- Built a **Log call, meeting or task** form inside `/crm/timeline`. Uses existing authenticated `POST /api/v1/activities` with a single server-validated CRM subject link, status, text details/outcome, optional planned/reference due date and a selected *active organization member* as assignee. Empty assignee defaults to the current user.
- Users with write permission can complete or reopen linked activities inline. Every change calls the existing version-checked `PATCH /api/v1/activities/{id}` endpoint; stale versions return HTTP 409 and reload the timeline.
- Views remain read-only for CRM viewer roles; the organization selector is validated against the current authenticated user's memberships and all API calls remain tenant-scoped. Server subscriptions/quotas continue to gate writes.
- The UI clearly distinguishes a due/reference timestamp from an actual communication time. It does not claim that a scheduled task sends a reminder, starts a phone call or syncs a calendar event.
- Added Laravel PostgreSQL assertions for aggregate totals, true overdue counts, next due time, archive behavior and cross-tenant restrictions; React interaction tests cover creating a linked follow-up, assignee scoping and marking it completed without navigating away.

## Explicit limitations

- Activity logging is **manual**. No messages, voice calls, meeting invitations, emails, push notifications or reminders are sent by this workflow.
- Follow-up completion is a logged user action, not a verified external communication event. The `completed_at` timestamp records the status transition.
- This batch reuses `crm_activities` schema and Phase 2N notes. It does not add a new activity storage table or change Stripe, pricing, subscriptions or live deployment.
- Date/time input is interpreted in the current browser's timezone and stored as ISO UTC; organization-defined timezone presentation can be unified later.
- The timeline still shows up to 25 records per page; summary counters always cover the entire linked record history. The existing standalone Activities page remains available for full management and archived history.
- Authenticated multi-user staging testing, cross-device accessibility, deployment configuration, backups and live data verification remain production release prerequisites.

## Required verification
Run `cd apps/api && php artisan test` on isolated PostgreSQL, then `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. Merge only with a green GitHub Actions run.
