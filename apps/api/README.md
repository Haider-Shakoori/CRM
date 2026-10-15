# CRM API — Laravel 12 foundation

This is the **new real backend**, not the existing browser mock service layer. It is an initial production-oriented foundation, **not yet a complete SaaS**.

## Getting started

Requires PHP 8.2+, Composer 2, PostgreSQL 15+ and required PHP database extensions.

```sh
cd apps/api
composer install
cp .env.example .env
php artisan key:generate
# Create the PostgreSQL database and set DB_* credentials in .env
php artisan migrate
php artisan serve
```

Dev frontend: keep the React SPA and Astro site on their existing ports. Use Sanctum **cookie/session auth** from the first-party browser: fetch `GET /sanctum/csrf-cookie` with credentials, submit `POST /api/v1/auth/register` or `/login` with credentials and the CSRF header/cookie, then call `GET /api/v1/auth/me`. Set `SANCTUM_STATEFUL_DOMAINS` and `FRONTEND_ORIGINS` explicitly. Do not create personal-access tokens for the browser or store secrets in localStorage.

The initial registration flow creates a **new tenant, organization and owner membership** within a DB transaction. It sends an email verification notification. **Verified users** may include `X-Organization-ID: <membership organization UUID>` on tenant-sensitive endpoints. The backend checks membership and tenant/organization status; unspecified, inactive and foreign organizations fail closed. Org selection is per-request and is **not** a global singleton.

### Current endpoints

- `GET /api/v1/health`: public health status (no secrets)
- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`: browser session auth
- `POST /api/v1/auth/verification-notification`, signed `GET /email/verify/{id}/{hash}`
- `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`: email recovery, hashed short-lived single-use tokens
- `POST /api/v1/organizations/invitations`: owner/admin invitations (7-day expiry, hashed email-bound token)
- `POST /api/v1/invitations/accept`: verified email recipient accepts an invitation once
- `GET /api/v1/organizations/usage`, `GET /api/v1/organizations/audit`: owner/admin seat usage and organization audit events
- `GET /api/v1/auth/me`: membership/organization list
- `GET /api/v1/organizations/current`: authenticated, verified, scoped
- `GET/POST /api/v1/leads`, `GET/PATCH/DELETE /api/v1/leads/{uuid}`: real database lead vertical slice, verified+scoped; updates require `expected_version`.

Example:
```http
GET /api/v1/leads?pageSize=25
Cookie: crm_session=...
X-Organization-ID: 00000000-0000-0000-0000-000000000000
Accept: application/json
```

## Testing

GitHub Actions runs PostgreSQL-backed feature tests; local DB test credentials can be configured by overriding `phpunit.xml` environment values. Execute `php artisan test` with a dedicated test DB.

### Security properties covered so far

- Unverified and anonymous users cannot access CRM organization data.
- The organization header cannot grant membership: only active organization memberships for the authenticated user are accepted.
- A request without valid membership cannot read/write/see records of other organizations.
- All lead queries have a fail-closed global scope, including when a background job lacks an organization context.
- POST/PATCH cannot choose or change `organization_id` or `tenant_id`.
- Lead edits require optimistic concurrency version checks.
- Schema uses UUIDs and tenant-inclusive indexes, including UUID polymorphic IDs in Sanctum.
- Tenant seat limits are enforced on invitation acceptance using a tenant-level database row lock; an unset limit is deliberately unrestricted until billing.
- Sensitive lead and invitation actions append organization-scoped audit events.

### Not implemented yet

Full CRM HTTP contracts, frontend mock-to-HTTP adapter, granular permissions/roles, invitation/registration UI, rate-limited exports, paid subscription entitlements, platform-owner console APIs, OAuth, billing, queue jobs, transactional audit writes on all lifecycle actions, recovery-session invalidation across devices, and production monitoring. Do not deploy as commercial SaaS before those gates are passed.

**Reproducibility:** `apps/api/composer.lock` is committed, and the GitHub Actions Laravel job uses it for clean installs. Do not manually edit the generated lockfile.
