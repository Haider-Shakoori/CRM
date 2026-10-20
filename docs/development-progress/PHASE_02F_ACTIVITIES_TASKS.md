# Phase 2F — Live Activities, Tasks and My Work

## Delivered
- Tenant-scoped PostgreSQL Activities and Events tables support Tasks, Calls and Meetings; statuses open, completed and cancelled; due dates, optional reminder dates, completion timestamps, assignees and soft archives.
- Each Activity may link to at most **one** Lead, Contact, Account or Deal. PostgreSQL composite foreign keys and a single-subject CHECK constraint enforce organization consistency even for direct SQL writes.
- Assignment must reference an active membership in the current organization, validated on every write. A composite FK protects organization/user membership identity.
- Laravel API: `GET /activities` (paginated search and kind/status/assignee/mine/due filters), `GET /activities/assignees`, `GET /activities/{id}`, `GET /activities/{id}/events`, `POST /activities`, `PATCH /activities/{id}`, `DELETE /activities/{id}`.
- Laravel write middleware requires verified user and appropriate membership role; viewers cannot mutate. Updates require `expected_version` with HTTP 409 on stale writes.
- Creating, updating, completing/reopening, and archiving Activities produces transactional event history and organization audit events.
- Live React routes `/crm/activities`, `/crm/tasks`, `/crm/my-work` include organization switcher, search/filter/paging, assignee selection, due/reminder inputs, linked record selection, edit, status transitions, event history and archive confirmation.
- Existing demo Activities, Tasks, and My Work screens link to these views and remain mock-backed; the wider demo is not misrepresented as integrated.

## Important limitations
- **Reminders are data fields only.** No scheduler, email, WhatsApp, push notifications or background task runner sends reminders in this batch. Do not advertise automatic notifications yet.
- Calls and meetings are logged CRM activity records, not telephony/dialer/calendar/video integrations.
- A linked CRM record picker initially loads only the first 100 records of the selected type. A searchable paginated selector is required for larger tenants.
- The Activities event endpoint exposes at most 100 newest events. Soft-archived Activity history is retained in storage but not yet available in the live UI.
- There is no real authenticated two-user browser regression against a configured deployment yet. The PostgreSQL feature suite verifies tenant authorization and database constraints; browser CI verifies route rendering without a connected backend.
- No production deployment, no changes to the platform subscription or demo CRM backend contract.

## Validation
Use an **isolated PostgreSQL test database** for `cd apps/api && php artisan test`. At repo root run `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e` and website link audit. Require all GitHub CI jobs to be successful before merging.
