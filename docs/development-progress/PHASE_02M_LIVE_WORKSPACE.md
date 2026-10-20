# Phase 2M — Opt-in Laravel CRM navigation and live calendar

## Why the batch is called 2M
The repository's current `main` already included PR #14 (`phase-2l-stripe-billing-foundation`) when this work began. The user has explicitly deferred Stripe. This batch neither configures, enables, alters nor deploys billing.

## Delivered
- **Opt-in actual-CRM mode** via `VITE_CRM_DATA_MODE=live` and `VITE_CRM_API_URL=https://<laravel-api-origin>`. The default without `VITE_CRM_DATA_MODE` remains the existing visibly labeled demo. No production environment or credentials changed.
- In live mode the React router REPLACES the entire demo AppShell `/app/*` subtree, and the top-level React tree DOES NOT mount `ServiceProvider` or instantiate `@crm/mock-services`. This protects against showing synthetic tenant data alongside real records.
- Explicit route bridge (live mode only): `/app/home` → `/crm/dashboard`, `/app/leads`, `/app/contacts`, `/app/accounts`, `/app/deals`, `/app/deals/list`, `/app/deals/forecast`, `/app/activities`, `/app/activities/all`, `/app/tasks` and `/app/calendar` route to their working Laravel counterparts.
- Unsupported `/app/*` routes including import, deep edit, advanced marketing, automation and revenue modules display a **clearly disabled live-only explanation**, not the seeded demo and not a guessed detail page. If API URL is missing, fail closed with an explicit setup message.
- Current organization selection is retained across the Laravel-backed Leads, Contacts, Accounts, Deals, Tasks/Activities, Dashboard and Subscription views. The selected UUID is a **session-only preference**, accepted only if the new `auth/me` response confirms a CURRENT authorized membership. PostgreSQL request scope and role middleware remain authoritative.
- Added `/crm/calendar`, showing actual due Tasks/Calls/Meetings in a local-browser-time-zone monthly calendar and selected-day agenda. Month reads use server-enforced `due_from` inclusive and `due_to` exclusive date filters, including optional kind filter. The existing full activity view remains the place for edit/creation. No fake calendar entries or claimed notification delivery.
- Calendar requests pages of 100 and caps at 1,000 displayed due activities for a month, **clearly warning** when the month has more; it does not claim completeness if truncated.
- Live sign-in enters the live Dashboard in this mode, without a demo shortcut. Demo shortcuts in existing Laravel-backed screens are hidden in live mode and retained in default demo mode.
- PHPUnit/PostgreSQL regression tests cover date-range boundaries, invalid date filters and tenant isolation. Vitest tests verify authorized org preference, safe unsupported path matching and calendar scope when switching tenants.

## Outstanding scope / restrictions
- This is **not** a wholesale replacement of the 100+ advanced mock-backed routes. Supported live core workflows are explicitly enumerated above; everything else is disabled in live mode rather than faked. Deep record page adapters, full command palette, marketing automations, support modules and all CRM service contracts require separate implementation.
- Live Calendar currently groups due activities according to the **browser's local time zone**. The reporting dashboard uses an organization's configured timezone; aligning both is a future task.
- `VITE_CRM_DATA_MODE` is a build-time Vite environment value. Changing it requires rebuilding/restarting the frontend. This is NOT a runtime toggle that can safely promote mock-created records into real data.
- Do not reuse demo localStorage records or attempt to sync them: they are synthetic. Real records are only read/written through Laravel's cookie/CSRF and `X-Organization-ID` checks.
- Staging verification with multiple authenticated users, cookie domains, CSRF, permissions, organization switching, and database backups remains a release gate. No production deployment; billing/Stripe deferred.

## Development verification
Use isolated PostgreSQL and `cd apps/api && php artisan test`. Use `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. To validate opt-in live routing locally, launch a **separate** Vite dev server with both `VITE_CRM_DATA_MODE=live` and `VITE_CRM_API_URL` set; never use real customer credentials in that test.
