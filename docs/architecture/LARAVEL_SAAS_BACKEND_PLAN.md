# Phase 0 — Laravel SaaS Backend Architecture and Contract Plan

**Date:** 2026-10-15  
**Status:** proposed architecture, not an implemented backend  
**Frontend:** keep `apps/website`, `apps/crm`, `apps/platform-admin` and the six shared packages in place.

## 1. Principles and deployment units

- One **Laravel 12** REST API project, initially `apps/api`, with PostgreSQL and Redis; do not introduce a second frontend or rewrite React/Astro.
- One shared PostgreSQL database for the first release. A *tenant* is the paying workspace/account; an *organization* is the CRM data ownership boundary. Define their exact relationship and enforce it on every request, including when a tenant has several business units.
- `tenant_id` and `organization_id` are server-derived from the authenticated context, **not** accepted as client-owned values on records. Client-supplied organization selection must be checked against an active membership.
- The platform-owner console has a distinct guard, roles, routes, sessions and audit policy from tenant CRM users. Never add an owner-only API action to the normal CRM user's token scope.
- Keep the existing `@crm/shared-types` service contracts as a negotiation baseline, not as an excuse to reproduce every simulated field or endpoint unchanged.
- The **demo** remains a deterministic public preview. The **production** app must not ship the mock store as an authentication, tenant isolation, or data authority.

### Diagram

```text
Astro website --signup/billing--+ 
                                +--> Laravel /api/v1 --> Auth + Tenant/Organization context
React CRM ----------------------+                      --> Policies/Policies per resource
React platform console --------+ (separate auth guard) --> Platform authorization
                                                           |
                                      PostgreSQL + Redis queue/cache + object storage
                                                           |
                                     Billing, Mail/Calendar, Audit, Webhook outbox
```

## 2. Data model (first vertical slice)

### Identity and SaaS

- `tenants(id, slug, status, default_region, created_at,...)`
- `organizations(id, tenant_id, slug, name, currency, locale, timezone,...)`
- `users(id, email_normalized UNIQUE, verified_at, password_hash,...)`
- `organization_memberships(id, organization_id, user_id, role_id, status, accepted_at,...)` with unique (organization_id,user_id)
- `roles(id, organization_id, key, name)` and `permissions` / `role_permissions` (use gates/policies rather than trusting frontend entitlements)
- `invitations(id, organization_id, email, role_id, token_hash, expires_at, accepted_at,...)`
- `sessions`, `personal_access_tokens`, `audit_events`, `login_events`
- `plans`, `prices`, `tenant_subscriptions`, `subscription_items`, `entitlements`, `usage_meters`, `billing_events` with provider ID uniqueness/idempotency keys.

### CRM vertical slice

- `pipelines`, `pipeline_stages`, `leads`, `contacts`, `accounts`, `deals`, `deal_stage_history`, `activities`, `notes`, `tags`, `taggables`, `attachments`
- Every business record: `id` (UUID/ULID), `organization_id NOT NULL`, audit timestamps, creator/updater IDs, optional optimistic version.
- Index `(organization_id, created_at)`, `(organization_id, status)`, `(organization_id, owner_id)` and targeted search indexes. Apply tenant-inclusive uniqueness, e.g. `UNIQUE(organization_id, pipeline_slug)`.
- For links across records, validate **both** ends belong to the active organization. Prefer composite `(organization_id,id)` foreign keys when practical.
- Store money as a fixed-precision decimal/integer minor unit **with currency**, never floating-point for persisted billing/quotes.
- Store timestamps in UTC; render in the user's IANA timezone. Separate record currency from subscription billing currency.

## 3. Security and isolation implementation

1. Authenticate with Laravel Sanctum cookie-based SPA sessions (proper CSRF, SameSite, HTTPS and origin configuration) or well-scoped bearer tokens for third-party APIs. Do not put long-lived secrets in localStorage.
2. Explicit organization selection (checked membership) and server-owned request context. A `ResolveOrganization` middleware loads and validates the current organization. Disallow or narrowly isolate platform operations.
3. Enforce Eloquent global tenant scope **and** Laravel policies/queries on `show/update/delete/bulk/export/report`; scoped route bindings must return 404 for foreign IDs. The global scope is defense in depth, not the only guard.
4. Scope queues, scheduled jobs, exports, file paths, events, cache keys, signed URLs, websockets and webhooks with organization/tenant identifiers. Fail closed when context is missing.
5. PostgreSQL RLS may be used as additional protection; test scoped transaction contexts and connection-pool reuse before depending on it.
6. Check ownership of referenced entities: contact → account, deal → account/pipeline, tickets → contacts, parent account → child account. Reject cross-organization references and merges.
7. Use append-only audit events for role changes, exports, impersonation, membership changes and billing. Impersonation should require explicit permission, justification, expiration and prominent marking; forbid covert account access.
8. Parameterized queries, input validation, per-tenant rate limits, security headers, upload inspection, encrypted secrets, and secret rotation are release gates.
9. Separate `platform_admin` authentication and restrict platform endpoints by policy; MFA required for privileged operations.
10. Privacy: retention settings, self-service export/deletion, consent data and subprocessor records must reflect actual behaviour; have counsel review applicable privacy obligations before selling in specific regions.

## 4. API contracts and error model

Preserve `packages/shared-types/src/services.ts` semantics where feasible and maintain an OpenAPI spec as an implementation deliverable.

- Base `/api/v1`; versioned routes; JSON typed `{ok:true,data}` / `{ok:false,error:{code,message,fieldErrors,traceId,retryable}}`.
- Validate pagination, faceted filters, nested AND/OR filter groups, sorting and maximum sizes on the server; allowlist sortable/filterable fields.
- Typed errors: `unauthenticated`, `forbidden`, `not_found`, `validation_failed`, `conflict`, `entitlement_missing`, `rate_limited`.
- Use optimistic versioning/ETags for contested record writes. Atomic transactions for lead conversion, mergers and deal movement.
- Bulk endpoints return requested/succeeded/failed and per-record errors. Never report success when an operation partially fails.
- API resources serialize only authorized fields. Internal `tenant_id`, role claims, billing provider secrets, audit-only fields remain server-owned.
- Replace `createMockServices` in the composition root with `createHttpServices`; supply a demo mode separately. Provide contract tests that can run both implementations against equivalent test fixtures.

## 5. Backend implementation milestones

| Step | Scope | Acceptance gate |
| --- | --- | --- |
| A | Laravel app, configuration, PostgreSQL migrations, CI test DB | Fresh install/migrate + tests green |
| B | Auth, org provisioning, membership/invitations, verified login | Unauthorized/foreign-org requests fail |
| C | Scoped CRM CRUD: accounts, contacts, leads, pipelines, deals, activities | React screens persist across browsers/users |
| D | Deal stage moves, lead conversion, dedup/merge, imports, reports | Atomic writes; aggregate math reconciles |
| E | Subscription/billing adapter + platform console domain | Idempotent webhook, renewal and seat enforcement |
| F | Messaging integrations, queues, event outbox, API keys | Retries, reconciliation and tenant-bound secrets |
| G | Operations: backups/restores, observability, DPA/privacy, load tests | Recovery and security gates passed |

Implement A→D before broadening into marketing automation, AI or field sales. B and C should include factories/seeds and isolation tests for **at least two organizations** from the first PR.

## 6. Non-negotiable test scenarios

- User A cannot list, get, update, delete, archive, merge or export User B's organization records, including guessed IDs and nested resources.
- Changing `organization_id` in any POST/PATCH payload is rejected or ignored; no cross-tenant record mutation.
- A foreign pipeline cannot be attached to a local deal; no foreign parent account, contact or member.
- Aggregate reports, SLA metrics, saved views, full-text search and analytics never include foreign tenant rows.
- A queued background task cannot run without authorized stored tenant context; retries preserve isolation.
- Unpaid, cancelled or suspended subscription states enforce server-side entitlements; webhook duplicates do not double-charge or double-provision.
- Concurrent updates conflict correctly and destructive actions audit the actual actor.
- Backup restore tests exercise point-in-time recovery and media restoration. Privacy exports and deletions are tenant-safe.

## 7. Operational and global SaaS checkpoints

- Launch initially in an intentionally selected hosting region, document data residency and suppliers, and expand to regional deployments only after demand or contracts require it.
- Production environment uses managed secrets, separate staging, zero-downtime migrations and automated rollback playbooks; enable CDN/WAF where appropriate.
- Measure API p95 latency, queue delay, database saturation, integration error rates, tenant-level job backlogs, and billing event reconciliation.
- Define service-level goals and alerts before public billing. No uptime or certification claims before evidence exists.
- Add currencies/timezones/locales without implying support for every jurisdiction's tax or legal requirements.
- Investigate payment provider eligibility for the *actual* selling business; it is not determined merely by choosing a payment SDK.
- Keep the CRM product CRM-focused: no separate accounting, HR, warehouse, manufacturing, or ERP domain in this API.

## 8. Phase 0 handoff and remaining caveats

The Phase 0 changes in this PR tighten the **browser mock** as a regression aid. Its user identity and database are still local browser fixtures and **must not** be deployed as a trusted multi-tenant service. Domain-specific routines outside the generic CRUD layer need their own reviewed authorization tests when replaced with real endpoints.

The first backend task should convert this architecture into a migration plan and HTTP contract for Leads → Contacts → Accounts → Deals → Activities, then hook the corresponding existing React routes to a staging API. Do not mark features production-complete until those paths are verified against live persistent data.
