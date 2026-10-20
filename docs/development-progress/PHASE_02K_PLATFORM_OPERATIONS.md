# Phase 2K — Platform-owner tenant console (Stripe deferred)

## Implemented

- Added a **separate platform-operator security boundary**. Only a verified existing CRM user with an active server-granted `crm_platform_operators` role may use `/api/v1/platform/*`; being a tenant/organization owner, admin, or even owning many tenants grants **no** platform privileges.
- Roles: `viewer` reads tenant directory/details; `operator` also makes explicit subscription changes. Unauthorized, unverified, revoked or non-operator users receive 403 before any tenant metadata is queried.
- Trusted **server-console-only** bootstrap: `php artisan crm:platform:grant EMAIL [viewer|operator]` and `php artisan crm:platform:revoke EMAIL`. No public grant endpoint. Case-insensitive verified email matching; updating a grant preserves its record ID.
- REST API: `GET /platform/me`, `GET /platform/plans`, `GET /platform/tenants` (paginated/searchable), `GET /platform/tenants/{uuid}` (organization summary, current subscription, usage and history), `PATCH /platform/tenants/{uuid}/subscription` (operator role).
- Manual subscription updates require **expected_version**, explicit acknowledgment, known plan/status, and a period end for trials or scheduled cancellation. Tenant row and subscription row are transactionally locked, so stale writes produce 409.
- Each authorized change writes both a subscription lifecycle event and a platform-administration event with the authenticated actor ID and change metadata. No Stripe API, charge, invoice, payment assertion or checkout occurs.
- Separate **platform-admin** application gains a real tenant directory, search, plan/status displays, usage, organization list, audit history and explicit manual subscription edit. It uses session cookies and CSRF; no bearer tokens or secrets stored client-side. The old honest demo remains the default when `VITE_CRM_API_URL` is unset.

## Boundaries and requirements

- No tenant suspension UI, support impersonation, feature flags, pricing editor, reconciliation, automatic renewal, Stripe, email alerts, or mass updates in this batch.
- Operators must already have a verified CRM identity; granting and revoking platform access requires privileged shell access. The grant CLI is a bootstrap mechanism and is not a self-service platform permissions UI. Restrict shell access and log command execution operationally.
- **Production access depends on proper cookie security**: deploy platform and Laravel API on controlled HTTPS first-party origins; set Laravel Sanctum's stateful domains and session cookie scope so cookies/CSRF work for the separate platform subdomain. The browser may not access an XSRF cookie set only for another hostname. Verify this in staging.
- Keep backend authorization authoritative: hiding the platform UI is not sufficient protection. Never expose a platform-role grant or mutation endpoint under regular organization membership.
- Manual operator changes are NOT proof of payment. Subscription status may enable tenant writes according to Phase 2J entitlements. Require business approval and an audit trail before changing an actual customer's entitlements.
- No production deployment, production migration or payment collection performed. Full authenticated cross-user staging browser verification remains outstanding.

## Validation gates
Laravel PostgreSQL: `cd apps/api && php artisan test`. Frontend: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. Require all GitHub CI jobs to pass before merging.
