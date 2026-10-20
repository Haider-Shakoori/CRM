# Phase 2J — CRM SaaS subscription and tenant entitlements

## Implemented
- CRM-only subscription plan catalog (Legacy grandfathered, Starter free, Team and Business operator-only placeholders), with plan limits for unique team seats, Leads, Contacts, Accounts, active Deals and active Activities. No plan pricing or paid checkout is asserted.
- Tenant subscription state is stored separately from organization access with a unique tenant subscription, status, optional period end, cancellation marker, optimistic version, and append-only operator event journal.
- Migration backfills **existing tenants to the unrestricted Legacy plan** without changing existing membership or data. New self-registered tenants are assigned Starter **free** automatically.
- Every write route under `organization.write` verifies active/trialing, unexpired subscription. Past-due, canceled, expired or time-lapsed subscriptions retain read access but reject writes with HTTP 409.
- Record creation quotas enforced transactionally and serialized under the tenant DB row lock across **all organizations** sharing the tenant. Lead conversion checks Account, Contact and optional Deal creation atomically so partially created records roll back on quota failures.
- Team seat entitlement in invitation acceptance and organization usage combines plan seat capacity with any tighter existing explicit tenant seat cap.
- `GET /api/v1/organizations/subscription` is owner/admin only, shows actual plan, usage, effective seats, read/write state and no-payment status. `GET /api/v1/subscription/plans` offers only public plan metadata with checkout unavailable.
- Read-only real CRM route `/crm/subscription` displays the current tenant's plan and usage. Authentication, membership, verification and tenant switching are enforced; no fake payment or upgrade actions are shown.
- Operator-only CLI `php artisan crm:subscription:set TENANT_UUID PLAN_CODE STATUS --expected-version=N [--ends=ISO_DATE] [--cancel-at-period-end]` supports controlled manual state transitions with version protection and event history. Requires privileged server console access; **not** exposed as an organization-owner API.

## Deliberate limits
- **No Stripe payments, checkout, subscription billing, invoices, webhooks or scheduled automatic renewal implemented.** Internal operator status updates are not proof of payment and must not be described as paid Stripe entitlements.
- Plan quotas are starter-development defaults and can be adjusted after pricing/customer validation. Team and Business are not publicly purchasable.
- There is no self-serve plan selection or cancellation yet, and no platform-owner web authentication for billing operations. CLI changes require authorized operator access.
- Subscription expiry disables CRM mutations, not reads, to avoid data lockout; account/login verification still works. Subscription periods are not automatically extended.
- Legacy tenants preserve existing unlimited quotas unless the server-side explicit seat cap is tighter. Operator should migrate them after agreement on pricing.
- Resource counts exclude archived Deals and Activities but do not remove historical audit records.
- No production migration or deployment. Do not treat mock-backed CRM pages as live.
- Full authenticated browser two-user staging verification remains a release requirement.

## Verification gates
Require PostgreSQL Laravel tests, TypeScript, ESLint, Vitest, production builds, Playwright Chromium CI. Do not merge until all checks pass and no failed tests remain.
