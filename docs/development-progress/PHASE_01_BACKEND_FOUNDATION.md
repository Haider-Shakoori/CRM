# Phase 1 — Laravel SaaS Backend Foundation

**Status:** implementation on branch `phase-1-laravel-saas-foundation`; review is required before merge.
**Base:** `phase-0-security-ci-architecture` (PR #1, not merged at branch creation).
**UI:** no frontend replacement; React and Astro still run their mock-data previews until Phase 2 API integration.

## Implemented and verifiable

| Area | Implemented |
| --- | --- |
| Laravel infrastructure | Standalone `apps/api` Laravel 12 app, versioned `/api/v1` routes, environment settings, GitHub CI |
| Persistence | PostgreSQL: tenants, organizations, users, memberships, sessions, Sanctum UUID tokens, invitations, leads, audit events |
| Tenant boundaries | Authenticated organization header validated against active membership and active tenant; fail-closed Lead global scope |
| Identity | Registration/organization provisioning, session login/logout, verified email access, email verification notifications |
| Account recovery | Non-enumerating forgot-password, broker tokens, reset and personal-access-token revocation |
| Team invitations | Owner/admin invitation, mail notification, hashed 7-day token, matching verified user, single-use atomic acceptance |
| Seat controls | Nullable tenant seat cap, unique active users across organizations, transactional row lock on invite acceptance |
| CRUD foundation | Leads pagination, create/read/update/delete, server-set ownership, UUID route constraints, optimistic version checking |
| Audit | Append-only organization event rows; authenticated owner/admin audit and usage endpoints |
| Tests | PostgreSQL integration tests for isolation, spoofing, unverified users, revoked memberships, version conflicts, invitations, seat limits, admin controls and password recovery |
| CI | Composer locked install, PHP lint, migrate:fresh and feature suite; existing frontend/Playwright jobs retained |

### API security model

A user must authenticate, verify their email, and present `X-Organization-ID` for business routes. The server resolves membership and tenant status, then binds request-local `OrganizationContext`. A forged tenant/organization ID in a lead mutation is rejected. Foreign IDs and malformed UUIDs receive controlled not-found responses.

Read access is granted to active organization members. In the current slice, `owner`, `admin`, and `member` can modify leads, while `viewer` can read only. Invitation sending and audit/seat usage require owner/admin. This is initial role enforcement, **not** the full customizable permission system.

### How to verify

1. In `apps/api`, run `composer install` and configure `.env` for PostgreSQL.
2. Run `php artisan migrate:fresh` on an **empty development/test** database, never on production customer data.
3. Run `php artisan test` with the PostgreSQL test database (CI uses PostgreSQL 16).
4. Execute the existing frontend checks from repository root: `npm ci`, `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build` and `npm run test:e2e`.
5. In a browser, enable credentials with Sanctum CSRF cookies before auth POSTs; a successful login is **not** permission to choose an arbitrary organization's ID.

## Acceptance gates and scope limitations

- Changes are committed to a **stacked PR**, not deployed or merged.
- All API mutation tests must pass in PostgreSQL and the unchanged frontend builds must remain green.
- Existing CRM frontend still uses `@crm/mock-services`; the real Laravel-backed UI switch belongs to Phase 2, with gradual per-module adapters and contract tests.
- Not implemented: real subscriptions, billing/taxes, platform-admin APIs, full RBAC, API version compatibility suite, realtime messaging, complete imports, comprehensive GDPR workflows, operational backups, disaster recovery and end-user UI for invitation/verification.
- Current PHP/DB app is a foundation; security review and production controls are still required before selling globally.

### Follow-on batch

**Phase 2:** implement a contract-compatible TypeScript HTTP service client for Leads → Contacts → Accounts → Deals → Activities, extend Laravel models/controllers, and verify real multi-user persistence and tenant isolation across the existing React workflows.
