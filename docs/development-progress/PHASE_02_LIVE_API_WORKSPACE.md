# Phase 2 — Live CRM authentication and Leads workspace

**Scope:** A separate Laravel-backed preview at `/api-sign-in` and `/api-workspace`. Existing `/app/*` CRM screens still use mock services, intentionally, until each domain's HTTP contract is mapped. Do not call the overall CRM production ready.

## Implemented

- Browser sign-in via Laravel Sanctum cookies and CSRF, no token persistence in localStorage.
- `auth/me` fetches **server-approved active memberships**. No arbitrary tenant IDs are trusted.
- Organization selection injects `X-Organization-ID` per request; the backend performs all membership and tenant checks.
- Leads list, create, edit (optimistic `expected_version`), delete (explicit confirmation).
- Viewers cannot use write controls; the Laravel role middleware enforces the boundary on the server.
- Stale results from a prior organization cannot render when switching organization; aborted display updates are ignored.
- 401 expiry redirects to sign-in. Sign-out invalidates the server session.
- Email-verification resend UI; verification is handled by the backend-signed email link and session refresh.
- Non-enumerating forgot-password and reset-password screens using the secure Laravel broker.
- Reset email uses the front-end `FRONTEND_APP_URL`, deep-linking to `/reset-password?token=...&email=...`.

## Configure locally

1. Start PostgreSQL in a **dedicated development environment**. Follow `apps/api/README.md` to install Composer dependencies and migrate. **Never run `migrate:fresh` on production.**
2. In the API's `.env`: set `APP_URL`, `FRONTEND_APP_URL`, `FRONTEND_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`, and appropriate `SESSION_DOMAIN` / secure-cookie settings. Use HTTPS in production.
3. Set `VITE_CRM_API_URL=http://localhost:8000` in `apps/crm/.env.local` for the development SPA. Restart the Vite server afterward.
4. For real recovery/verification emails, configure a working `MAIL_MAILER` and provider. The demo default `MAIL_MAILER=log` does **not** deliver mail.
5. Use a first-party frontend and API domain topology that shares the required cookie scope. The SPA needs to read the non-HttpOnly XSRF cookie to send the `X-XSRF-TOKEN` header, while the session cookie must remain HttpOnly. Cross-site deployments require additional validated cookie/CORS changes.
6. Visit `/api-sign-in`. Verify your email through the signed link, then open `/api-workspace`. Password recovery: `/forgot-password`.

## Verification required before production

- Automated: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`; Laravel `php artisan test` with isolated PostgreSQL.
- Browser + DB: two organizations, two users, and an active viewer. Verify that each API endpoint rejects foreign IDs, that switching organizations hides previous results, that 409 conflicts are visible, that deletion cannot target another organization, and that signing out ends the session.
- Mail: real SMTP test for verification/recovery, signed verification links, reset links, replay protection, and session invalidation policies.
- Security: CSRF/CORS/SameSite on the actual domains, rate limits, password policies, role permissions, audit atomics, backups/restore, and observability.
- The live workspace shows only the **first 100 Leads**, not full pagination. No real Contacts/Accounts/Deals/Activities integration yet.

**Not claimed:** all existing mock CRM pages are integrated, real production delivery, completed security review, Stripe billing, customer-ready SaaS.
