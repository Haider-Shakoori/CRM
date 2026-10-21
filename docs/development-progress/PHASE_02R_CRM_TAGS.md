# Phase 2R — Tenant-scoped CRM tags and segments

## Delivered

- `crm_tags` stores an organization-scoped name, validated six-digit color and optimistic version. PostgreSQL enforces `unique(organization_id, lower(trim(name)))`, preventing case-only duplicate tags even under racing requests.
- `crm_tag_links` links a tag to exactly one Lead, Contact, Account or Deal via composite `(organization_id, subject_id)` foreign keys and an exactly-one-subject CHECK. Cross-tenant associations are blocked at both HTTP validation and PostgreSQL constraint level. Each record/tag combination is unique.
- Live API `GET /api/v1/tags`, `GET /api/v1/tag-links`, `GET /api/v1/tags/{id}/records`, `POST/PATCH/DELETE /api/v1/tags` and `POST/DELETE /api/v1/tag-links`. Tag directory queries and per-tag CRM segments are bounded and paginated, never cross-organization aggregations.
- Organization owner/admin may create, rename, recolor or delete tag definitions. Verified members with write permission may assign and unassign existing tags. Viewer users can read tags and segments but cannot mutate. Writes remain gated by the existing subscription entitlement and membership middleware.
- Tag version checks return 409 if stale; duplicates and existing assignments return explicit conflicts. Tag deletion is rejected until all assigned records are unlinked. Deleting an otherwise unreferenced Lead/Contact/Account cleans its tag links; archived Deals are hidden from normal segment queries.
- Each create/edit/delete/assign/unassign action emits existing tenant-scoped CRM audit events, recording the actor and record/tag IDs. No arbitrary user, org, tenant or version fields can be supplied by a client.
- New **/crm/tags** provides search, paginated directory, color-coded definitions, permission-aware management, per-tag segments for each CRM record type, searching/assigning a real record, safe unlinking and direct links to the real customer timeline.
- Live Dashboard and `/app/tags` (when `VITE_CRM_DATA_MODE=live`) link to this page. Default mock demo routes remain separate; a missing configured Laravel API does not fabricate tags or assignments.
- PostgreSQL tests cover duplicate names, tenant isolation, all four record types, immutable links, viewer/member/admin permissions, 409 conflicts and parent deletion. React and client tests cover secure UI roles, tenant-scoped requests and CSRF, plus browser no-API fail-closed smoke.

## Explicit boundaries

- This is manual CRM segmentation, not automated campaign enrollment, lead scoring, rules, calculated segments or outbound messaging. Tags are internal labels, not a workflow automation engine.
- No merging of tags, mass assignment to entire search results, CSV tags import/export, scheduled background processing or full-text tag search indexing in this phase.
- Tag directory fetches max 100 at a time, UI uses 50; record search shows 25 matching records, and tagged segment pages show 25 records at once.
- Tag assignment is tenant-scoped but is *not* copied across related Contact/Account/Deal records automatically. Cross-entity relationship semantics require product-specific decisions.
- PII access still requires existing Laravel organization membership; avoid sharing exported segment membership lists with unauthorized parties.
- No deployment, production migration, customer-record changes, payment charge, Stripe integration or other accounting/ERP scope changes in this phase.
- Before production, verify browser-session cookies/CSRF, real multi-user tenant isolation, backups, full staging regression and rollout plan.

## Required verification

Isolated PostgreSQL: `cd apps/api && php artisan test`; frontend: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. Merge only after all GitHub Actions checks pass.
