# Phase 2P — Tenant-safe global CRM search

## Delivered
- **Read-only GET /api/v1/search** behind existing Sanctum authentication, verified email, active organization membership and X-Organization-ID middleware. Reads only through organization-scoped Eloquent models.
- Searches Leads (name and email), Contacts (first name, last name, full name, email, phone), Accounts (name) and Deals (name). Matching is case-insensitive PostgreSQL ILIKE. Literal wildcard escaping prevents user-supplied % and _ from becoming unbounded search patterns.
- Per-type results default to 10, capped at 25. Each group includes its total count and has_more boolean; deterministic sorting and stable record IDs. Soft-deleted Deals are not returned; no cross-organization aggregations or result caching.
- Input validation requires a 2–120-character query; blank or malformed inputs are rejected rather than matching every customer.
- A new **/crm/search** screen searches real records within the authenticated, selected organization. It shows grouped counts, truncated-result warnings, and deep links to the appropriate real /crm/timeline?type=...&id=... record history.
- Tenant preference across live CRM modules remains a session-only convenience; restored preference must match the current /auth/me organization memberships. On org switches, results from the previous org are hidden immediately and stale async requests cannot appear under the new org.
- /app/search forwards to /crm/search when VITE_CRM_DATA_MODE=live. Dashboard and customer timelines link to search; the default demo is unchanged.
- PHPUnit/PostgreSQL tests cover all types, tenant viewer permissions, foreign org blocking, literal wildcard matching, result caps and archived Deal suppression. Vitest checks selected-org request header, fail-closed client behavior and switching. Chromium verifies no fake records without a configured API.

## Deliberate limitations / follow-up
- This is a **bounded CRM navigation search**, not a full-text search engine or cross-tenant platform directory. It does not include communications content, documents, ticket systems, unlinked Activities, fuzzy deduplication or relevance ranking.
- Up to 10 rows per type are displayed by default, with totals and links to full core module screens. This does not paginate each result group; large datasets may eventually need dedicated PostgreSQL trigram indexes or indexed full-text search.
- No email, telephony or messaging side effects, no Stripe changes, no production migrations or deployment.
- Full browser validation under real authenticated multi-user staging sessions remains a release prerequisite.

## Verification and release gate
On a dedicated PostgreSQL test database: `cd apps/api && php artisan test`.
Frontend: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`.
Merge only after all GitHub Actions checks are green.
