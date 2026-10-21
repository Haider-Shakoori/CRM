# Phase 2Q — Tenant-safe CRM CSV Import and Export

## Implemented

- Live `/crm/data-transfer` for **Leads, Contacts and Accounts** (not Deals). Access requires a verified, active organization owner or administrator, enforced server-side even if a client bypasses the UI.
- File parser handles quoted commas/newlines, doubled quotes, UTF-8 BOM and Windows or Unix line breaks. Headers are allowlisted; required columns are checked. Each upload is capped at **100 nonblank data records and 256 KB**, preventing unbounded synchronous write jobs.
- **Preview** `POST /api/v1/data-transfer/preview` validates the submitted rows and reports field-level issues. It does not create any records. A passing preview does not reserve quotas or guarantee later success: COMMIT must recheck.
- **Commit** `POST /api/v1/data-transfer/import` requires server-side membership and subscription write access. Uses the existing tenant-serialized quota lock and re-runs every validation/duplicate check inside a single PostgreSQL transaction. Any invalid row, duplicate email, foreign Account, disallowed column or quota failure blocks **the entire batch**, so partial rows cannot be silently imported.
- Duplicate detection within the CSV and selected organization: normalized name for Accounts, normalized non-empty email for Contacts and Leads. Existing cross-tenant matches do not count as duplicates.
- Server ownership/version/record IDs are generated exclusively on the backend. Client inputs cannot set `organization_id`, `tenant_id`, IDs or versions.
- **Export** `GET /api/v1/data-transfer/export` returns a tenant-scoped, 100-record page of only approved business fields, with audit events. No internal UUIDs, ownership IDs, actor IDs or audit internals appear in the CSV.
- Frontend downloads up to 1,000 records per CSV part, with an explicit message and next page number when more rows exist. Formula-like spreadsheet values are prefixed with an apostrophe and every field is CSV-escaped.
- Live Dashboard and `/app/import`, `/app/export` routes link to the real transfer screen in opt-in live mode. Existing advanced demo screens stay separate.

## Explicit limitations

- This is **create-only import**, not update/upsert, merge, contact dedup remediation, Deal import or activity/attachment migration.
- Preview is advisory: a competing import may change duplicates or available subscription capacity. COMMIT revalidates atomically and can return 409/422 after a successful preview.
- Case-insensitive duplicate matching is exact normalized email/name, not fuzzy person matching. Email-less Leads/Contacts may legitimately share a name.
- Synchronous 100-row import is a deliberate first release limit, not a million-row ETL pipeline. Large imports require dedicated queued jobs, idempotency keys and upload storage design.
- CSV export includes customer PII for authorized admins. Secure downloaded files per the organization's policies, and avoid opening untrusted CSV directly in spreadsheet programs without reviewing formula-protection practices.
- Payment/Stripe is not touched. No production deployment, secrets or customer data changed.
- Multi-user staging, backups, import dry-run on realistic data, retry/timeout behavior and GDPR-style data handling require a separate production-release review.

## Verification

Run `cd apps/api && php artisan test` against isolated PostgreSQL, `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. All required GitHub CI jobs must be green before merging.
