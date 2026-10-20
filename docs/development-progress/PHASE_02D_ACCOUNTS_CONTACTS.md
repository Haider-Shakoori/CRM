# Phase 2D — Contacts and Accounts (real Laravel vertical slices)

## Implemented

- Added PostgreSQL `crm_accounts` and `crm_contacts` tables with UUIDs, organization ownership, indexes, optimistic row versions, and a **composite foreign key** ensuring Contacts cannot link Accounts outside their own organization, including raw SQL writes.
- Added fail-closed organization-scoped Eloquent models. No organization context means no records can be read.
- Added `/api/v1/accounts` and `/api/v1/contacts` for paginated list, detail, create, update and delete. Search is server-side, record updates use `expected_version` with HTTP 409 conflicts, and all mutations are audit-logged in their database transaction.
- Organization membership, email verification and read-only viewer restrictions are enforced by the same existing Laravel middleware as Leads.
- Explicit 409 prevents an Account with linked Contacts from being deleted.
- Added typed React HTTP methods and **separate authenticated live directory routes** `/crm/accounts` and `/crm/contacts`, with search, pagination, create/edit/delete, optional Contact-to-Account selection (first 100), verified organization switching and stale-request isolation.
- Existing demo Accounts and Contacts modules show links to the live views; demo workflows remain untouched. Live Leads navigation links to both new routes.
- Added Laravel feature tests covering read/write isolation, forged ownership, CRUD, conflict versions, role controls, account relationships and a database-level foreign key; browser and typed-client regressions.
- Excluded installed PHP Composer vendor JavaScript from ESLint, so an installed backend cannot incorrectly fail frontend source lint.

## Important limitations and next

- Existing rich `/app/*` CRM modules remain mock-backed; these live views only implement the first real Accounts and Contacts CRUD contracts.
- Real auth and multi-user browser workflows require a configured first-party Laravel domain, cookie/CORS settings, verified test users and transactional mail provider.
- Accounts choice list in the Contact form initially shows up to 100 accounts; replace with a searchable server-side picker for larger tenants.
- Full tenant/authorization security audit, platform subscriptions, backups and other CRM modules remain future phases.
- No commercial deployment; do not run destructive migrations against live user data.

## Validation

From repository root run `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. In `apps/api` run `php artisan test` using an **isolated PostgreSQL test database**. Merge only after the GitHub CI Laravel / frontend / Playwright jobs are successful.
