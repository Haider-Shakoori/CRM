# Phase 2N — Real CRM notes and customer communication timelines

## Implemented
- Laravel/PostgreSQL `crm_notes` with exactly one linked CRM Lead, Contact, Account or Deal. Composite `(organization_id, subject_id)` database foreign keys and a check constraint prevent cross-organization links and multi-subject notes even in raw SQL.
- `CrmNote` uses the existing fail-closed organization Eloquent global scope. Authenticated `/api/v1/notes` create/read/update/archive endpoints enforce verified active memberships, write-role checks and subscription read-only rules. Note author and target subject are immutable; edit uses `expected_version`, with 409 on stale writes.
- Audit events and append-only `crm_note_events` record creation, edit metadata and archive. Note body text is not duplicated into audit metadata. Archive soft-deletes visible notes without erasing event history.
- `GET /api/v1/timeline?subject_type=...&subject_id=...` validates tenant ownership and returns a unified server-paginated reverse-chronological list of notes and logged activities (tasks, calls, meetings). Default 25, maximum 100 records per page, stable ID ordering. Historical activity entries use their log creation time, not upcoming due dates.
- Notes prevent hard deletion of referenced Leads, Contacts and Accounts (including archived notes); explicit HTTP 409 instead of silent SQL constraint crashes. Deals use soft-delete and preserve history.
- Live React route `/crm/timeline` supports selecting/searching live Leads/Contacts/Accounts/Deals, optional deep links by `?type=contact&id=...`, viewing the timeline, adding/editing/archiving notes, pagination and clear errors.
- Record names on the real Leads, Contacts, Accounts and Deals screens link directly to their real timeline. Live Communications `/app/communications` route maps to the real timeline in opt-in live mode. Activities and Dashboard include navigation to the timeline.
- PHPUnit, Vitest and Playwright tests cover tenant isolation, forged IDs, read-only users, note version conflicts, safe archive, browsing real timeline and no-API fail-closed handling.

## Boundaries
- **This is manual activity logging and customer history; it is not an email sender, SMS sender, WhatsApp client, telephony integration, calendar synchronization or automatic interaction capture.** Calls/meetings/tasks are logged using the existing Live Activities screen. Do not claim messages were delivered.
- The existing advanced mock-backed Communications/Inbox/marketing modules are not connected. In live mode other unsupported modules continue to fail closed rather than display synthetic data.
- Notes are currently unmetered by subscription quotas; plan-wide entitlements for communication storage can be added after validated pricing.
- Audit event content tracks actions and changed-field metadata, not every previous note body (retaining prior sensitive note text forever would require separate explicit data-retention consent/policy).
- A note archived on a soft-deleted Deal remains in PostgreSQL and the operator's audit history; the ordinary timeline for that Deal requires an active record. Record restoration and retention policies remain outstanding.
- No production migration/deployment, credential changes, Stripe integration or payment actions. Require authenticated, cross-tenant staging checks and secure HTTPS/Sanctum configuration before release.

## Verification commands
Isolated PostgreSQL: `cd apps/api && php artisan test`.
Frontend: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`.
Merge only after GitHub's Laravel, frontend and Chromium jobs succeed.
