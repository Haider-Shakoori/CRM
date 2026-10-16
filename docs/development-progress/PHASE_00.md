# Phase 0 changes and remaining release blockers

**Branch:** `feat/phase-00-tenancy-ci-laravel-plan`. This phase adds frontend mock hardening, CI, browser smoke tests and a proposed Laravel architecture. There is still **no production backend**.

### Included

- Core mock CRUD checks active organization on list/get/create/update/delete/bulk delete/archive/restore/bulk patch and raw records for the 11 organization-scoped collections in `services/index.ts`.
- Tickets and deals rollups restricted to active organization; direct lead/contact duplicate/relationship reads scoped; ticket messages, categories and SLA policies scoped; selected merge/move/reply/resolve/reopen operations now check organization ownership.
- Four targeted regression tests demonstrating negative access, immutable ownership, support aggregates and cross-tenant merges.
- GitHub Actions validates TypeScript, ESLint, **both** Vitest projects, builds all three apps and uses Playwright Chromium against the built frontend previews.
- Laravel backend plan under `docs/architecture/LARAVEL_BACKEND_PLAN.md`.

### Important limitations

- `MockDb` still holds multiple tenants in browser memory/localStorage. **Mock scoping is not a security boundary.**
- This is **not** an exhaustive audit of the many custom domain services and direct `db.state` operations; those remain blocked for real customer data until a real server, policies and negative tenancy suite exist.
- Browser tests are smoke checks (load, navigation, error-free shell), not full workflows or cross-browser accessibility validation.
- Live auth, database, payments, provider integrations, webhooks, backups and deployment are not implemented.
- CI runs only when GitHub Actions starts; local or historical checks must not be reported as fresh CI evidence.

### Follow-up acceptance criteria

Audit the custom services for foreign IDs and nested relation checks; verify CI run and correct any failures; review branch protection for required CI status; establish an authenticated Laravel tenancy boundary and real integration test suite before onboarding customers.
