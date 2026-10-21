# Phase 2S — Real CRM custom fields (Stripe deferred)

## Scope delivered

- Added organization-specific custom field definitions for Leads, Contacts, Accounts and Deals. Types: short text (2,000 characters), finite numbers, strict ISO date, boolean and enumerated select with up to 20 unique choices. Keys use stable machine names.
- PostgreSQL enforces unique organization + object type + normalized field key, an allowed type/object check, exactly one linked CRM record per value, and composite (organization + record) foreign keys.
- Owner/admin define fields and can change their display label or active state. The machine key, type, and select choices intentionally stay immutable after creation, avoiding silent reinterpretation of stored values. Member users may set allowed values, viewer users are read-only.
- `GET /api/v1/custom-fields?object_type=lead`, `POST /api/v1/custom-fields`, `PATCH /api/v1/custom-fields/{id}`, `GET /api/v1/custom-fields/values?subject_type=lead&subject_id=...`, and `PUT /api/v1/custom-fields/values`. All require verified current organization membership and scoped Laravel requests; writes use existing role/subscription controls.
- Value writes serialize per organization, accept a correct expected version (null on first create), refuse stale updates with HTTP 409, validate the type server-side, and write audit events without copying sensitive value contents into metadata.
- Deactivation hides no historical value: it preserves previously saved values for authorized readers and disallows new writes until reactivation. Field definitions are limited to 100 per object type to bound schema/UX growth.
- The live `/crm/custom-fields` page offers field-definition administration, record search/selection and typed value editors. Live `/app/settings/custom-fields` and `/app/custom-fields` route to it when opting in to live mode; existing mock UI remains separate by default.
- Deletion guards protect linked custom-value records and give a clear HTTP 409 instead of database FK failure.
- PHPUnit covers data types, tenant/role isolation, concurrency, deactivation and record deletion. Vitest covers role behavior and tenant-scoped browser transport. Playwright confirms the live screen fails closed without a connected backend.

## Known limitations / future phases

- This phase does **not** add custom field query filtering, report dimensions, CSV import/export or marketing automation. Those require explicit backend query and security design; do not claim custom fields automatically appear in dashboards.
- Existing option sets and types are immutable; changing them requires a future migration / mapping feature. This also prevents historical invalid values.
- Individual stored custom values can be replaced, but clearing an already assigned value is not yet exposed. Records with custom values cannot be hard deleted until the values are intentionally removed through a controlled future retention/deletion workflow.
- No custom field permissions narrower than the existing organization roles. There is no production deployment or live staging with real customers.
- Stripe remains postponed; no billing changes, checkout actions, webhooks, pricing or payment activation are in this PR. Subscription read-only constraints still apply to custom-field mutations.

## Release gates

Run Laravel/PostgreSQL feature tests, TypeScript, ESLint, Vitest, all production builds, Playwright and website link audit. Do not merge until GitHub CI is all green. Configure HTTPS, Sanctum cookies and authenticated multi-user cross-tenant staging verification separately.
