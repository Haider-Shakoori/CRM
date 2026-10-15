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
- Schema uses UUIDs and tenant-inclusive indexes.

### Not implemented yet

Full CRM HTTP contracts, frontend mock-to-HTTP adapter, role/permission matrices, invitations, password reset UX, rate-limited exports, advanced subscription gating, platform-owner console APIs, OAuth, billing, queue jobs, audit events, and production monitoring. Do not deploy as commercial SaaS before those gates are passed.

**Dependency lockfile:** Phase 1 bootstraps Composer dependencies; a reproducible `composer.lock` must be committed before production deployment. See GitHub CI for fresh-install verification.
