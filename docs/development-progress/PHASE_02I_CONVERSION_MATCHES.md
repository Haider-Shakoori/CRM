# Phase 2I — Duplicate review, existing Account reuse, optional Deal creation

## Delivered
- New authenticated **GET /api/v1/leads/{id}/matches** shows up to 15 possible duplicate Contacts and Leads matching the current Lead's trimmed, case-insensitive email *inside the selected organization only*. It does not silently merge records or compare just names.
- The Lead conversion endpoint refuses to create an additional Contact if an email-matching Contact exists without explicit `allow_duplicate_contact` acknowledgment. A second request with the acknowledgment can create an intentionally separate Contact. Preview failure blocks the live UI; the backend also checks at write time.
- New Account names are checked against normalized names in the organization. When an Account has the same name, the server requires selection of the existing Account. The live conversion form supports both new Account and search-for-existing Account (25 results per search).
- Optional `deal` in conversion creates a tenant-scoped Deal with chosen pipeline/stage, amount/currency, expected close date and audit event **within the same transaction** as the Contact, Account and conversion link. Invalid stages cause the entire conversion to roll back. `crm_lead_conversions.deal_id` is a nullable, composite tenant-scoped foreign key.
- Already-converted Leads are idempotent: repeated requests return the same conversion record, Contact, Account and optional Deal rather than creating duplicates.
- Contacts linked to a conversion cannot be deleted; attempts return HTTP 409 instead of an unhandled SQL foreign-key error.
- Separate React conversion component presents email matches, explicit review acknowledgment, Account search and choice, optional Deal inputs, form validation and server errors. It is mounted on the real `/crm/leads` page; demo pages remain untouched.

## Caveats and next work
- Duplicate detection is **exact email only** and is *advisory* for matching Leads; it does not yet fuzzy-match names, addresses or telephone numbers, nor merge existing Contacts. Account name checking is a transactional precondition, **not a global uniqueness guarantee** for concurrent conversions from different Leads. An additional normalized uniqueness mechanism and general Contact/Account merge workflow may be designed after confirming requirements.
- Converted Contacts can be renamed and reparented through general Contact editing; a follow-up must define how conversions should handle that historical relationship.
- The UI searches 25 Accounts at a time. Email-based duplicate preview shows up to 15 Contacts and Leads.
- No automatic creation of Deals unless specifically opted in. Won opportunities are not cash receipts.
- All data access is authenticated, authorized and tenant-scoped by the server. No staging/live deployment or multi-user browser E2E against real authenticated users in this batch.
- The advanced mock-backed app is still separate from the Laravel-backed core.

## Verification
Use isolated PostgreSQL for `cd apps/api && php artisan test`. Frontend: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, and `npm run test:e2e`. Require green GitHub Actions before merging.
