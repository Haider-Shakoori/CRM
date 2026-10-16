# Laravel backend architecture and phased API migration

**Status:** Phase 0 design proposal, not an implemented or deployed backend. Retain the existing React/Vite CRM, Astro public website, and React/Vite platform-owner application. Product identity remains provisional ("CRM Platform"). CRM scope only; do not add ERP, finance general ledger, manufacturing or HR modules.

## Decision record

- **Runtime:** Laravel 12 REST JSON API under `/api/v1`, PHP 8.3+, with versioned OpenAPI contracts and contract tests against the existing `packages/shared-types/src/services.ts`. Verify current Laravel/PHP support policy before implementation.
- **Persistence:** PostgreSQL 17+ as the proposed primary relational store (final vendor choice pending provisioning). UUID/ULID primary IDs, `organization_id` on **every tenant-owned record**, explicit composite unique keys and foreign-key strategy; Redis for queues, rate limiting and ephemeral cache. S3-compatible encrypted object storage for attachments.
- **Isolation:** A shared database with explicit organization boundaries and optional PostgreSQL row-level security as defense in depth. Resolve `organization_id` from authenticated **server-side** membership and authorized active-organization selection. Ignore client-provided organization scope for security decisions. Enforce organization scopes at the repository/query layer plus Laravel policies for every direct `show/update/delete`, nested resource, batch job, report, export, webhook, search result and file download.
- **Authentication:** Laravel Sanctum using first-party secure HttpOnly cookie sessions for the browser; MFA, account recovery, invite acceptance and session revocation. Separate platform-owner guard and permissions; never trust frontend feature flags for authorization. Future OIDC/SAML enterprise options.
- **Contracts:** Preserve UI result envelope (`ok/data` or `ok/error`), page/facet/filter semantics and `expectedUpdatedAt` optimistic concurrency. HTTP status mapping: 401 unauthenticated, 403 forbidden, 404 inaccessible/not found, 409 conflict, 422 validation, 429 rate limit. Use request/trace IDs. Allowlist filter fields and sort fields, limit page sizes and query complexity.
- **Boundaries:** `website` stays content/SEO-first, CDN cacheable; `crm` uses a typed HTTP service adapter behind the existing `ServiceProvider`; `platform-admin` uses a separate role/guard, preferably separate domain, dedicated policies, and audited support access.
- **Localization:** English as initial release quality bar; support locale, IANA timezone and currency per organization/user; store UTC timestamps and monetary amounts in integer minor units with explicit currency codes, without assumed taxes.

## Suggested Laravel domains

`Identity` (users, memberships, roles, invitations, sessions); `Organizations` (tenant preferences, entitlements, audit); `Sales` (leads, contacts, accounts, pipelines, stages, deals, activities); `Products` (catalog, price books, quotes/orders strictly as CRM sales records); `Service` (tickets, messages, SLA); `Communication` (email/calendar integrations, notifications); `Subscriptions` (SaaS plans, invoices and seats); `Platform` (owner audit, tenant lifecycle).

Implement modular namespaces and policy/query boundaries first; do not create dozens of prematurely separated services. Maintain strict CRM product scope.

## API first slice

| Endpoint | Scope and behavior |
| --- | --- |
| `GET /api/v1/me` | Current principal, authorized memberships and capabilities |
| `POST /api/v1/organizations/{organization}/activate` | Verify membership; select active organization in server session |
| `GET/POST /api/v1/leads` | Cursor or page pagination; server tenant constraint; owner/permission guard |
| `GET/PATCH/DELETE /api/v1/leads/{lead}` | Bind record through active tenant; policies; optimistic updates |
| `GET/POST /api/v1/contacts` | Per-tenant search, duplicate handling and consent metadata |
| `GET/POST /api/v1/accounts` | Tenant-scoped hierarchy and contacts |
| `GET/POST /api/v1/deals` | Tenant-scoped pipeline and amount calculations |
| `POST /api/v1/deals/{deal}/move` | Atomic stage move + activity log + recalculated pipeline summary |
| `GET /api/v1/tickets/overview` | Aggregates **only** active-tenant tickets; policies within same tenant |
| `GET /api/v1/health` | Operational health without exposing tenant data |

Every related ID is verified against the current organization, **including nested records and bulk mutation arrays**. Report exports/AI context must be tenant limited. Background jobs carry a signed/authenticated organization context with explicit re-validation.

## Data and audit invariants

1. Membership test precedes any tenant switch. Cross-tenant resource IDs return the same inaccessible response as unknown IDs.
2. Composite foreign keys or explicit validation prevent a deal referencing a foreign account, contact, product, stage or pipeline.
3. Use transactions and idempotency keys for bulk imports, deal conversion, webhooks, invoice issuance, subscription provisioning and other retried commands.
4. Store per-tenant immutable audit events for privileged actions. Encrypt sensitive fields where warranted, redact logs and support GDPR data export/erasure subject to retention requirements.
5. Test with three real isolated tenants; exercise guessed IDs, query-filter tampering, bulk mixed-tenant IDs, unrelated stage/account IDs, exports, attachments, queues and platform-owner escalation.

## Migration stages and acceptance criteria

**Stage A — secure API foundation:** Laravel app under `apps/api` or a clearly versioned backend workspace, migrations, factory fixtures, login/invitations, middleware/policies, CI PHPUnit/Pest + static checks. All tenant-negative tests pass before any UI switch.

**Stage B — CRM sales vertical:** Ship real leads, contacts, accounts, deals/pipelines, activities. Add `createHttpServices` adapter implementing existing interfaces; choose adapter by environment/configuration. Keep mock as explicit demo-only mode; forbid demo seed data in live tenant storage.

**Stage C — SaaS commercialization:** Real organization provisioning, trial/seats, secure payment processor webhook handling, plan enforcement, owner console and subscription ledger for SaaS billing (not a general accounting module).

**Stage D — integrations and operations:** OAuth email/calendar, job workers, search, backups/restores, regional data processing disclosures, audit visibility and telemetry. Progressive rollout and rollback per tenant.

**Global-launch release gate:** Green CI plus deployed E2E, independent penetration/tenant isolation review, restored-backup drill, privacy/terms/DPA review, incident/abuse handling, payment eligibility and live pilot customers. A frontend demo passing Playwright is not evidence of production security.

## Decisions still required before Stage A

Hosting/data residency and budget; PostgreSQL vs MySQL final choice; geographic/legal home of selling entity and payment provider; exact core-user roles; accepted tenancy switching model; supported initial locales; global privacy and retention policy. Record decisions in short ADRs before expanding contracts.
