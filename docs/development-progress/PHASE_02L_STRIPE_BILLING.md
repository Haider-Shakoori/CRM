# Phase 2L — Stripe Billing (test-mode implementation; credentials later)

## Scope delivered
- Server-only Stripe Checkout Session and Billing Customer Portal Session creation using Laravel's HTTP client and Stripe REST endpoints; **no Stripe SDK dependency, browser secret, test/live key, real Stripe transaction, or production deploy**.
- New tenant-scoped `crm_stripe_checkout_intents`, `crm_stripe_subscription_links`, and unique `crm_stripe_webhook_events` ledger.
- Required browser auth + verified email + **organization owner/admin** access to POST `/api/v1/organizations/billing/checkout` and POST `/api/v1/organizations/billing/portal`. Every request is scoped to the active `X-Organization-ID` membership. Browser requests use Sanctum cookies and CSRF.
- Public webhook POST `/api/v1/billing/stripe/webhook` requires raw-payload Stripe HMAC SHA-256 signature, 5-minute replay tolerance, valid test-mode event format, and configured signing secret. Duplicate event IDs are idempotent in PostgreSQL transactions. Provider API failures do not expose upstream details.
- Checkout creates subscriptions using **server-side recurring Stripe Price IDs only**, referencing an unguessable locally persisted intent and tenant metadata. Browser-supplied amounts, currency, Price IDs and tenant IDs are prohibited. The Checkout success redirect never changes tenant entitlements.
- Recognizes and links `checkout.session.completed` (audit only) and `checkout.session.expired` (verified release of a pending attempt), as well as `customer.subscription.created`, `updated`, and `deleted` (tenant entitlement reconciliation). Signed `invoice.paid` and `invoice.payment_failed` are journaled as signals but do not independently grant access.
- Provider `active` or `trialing` status **with a future subscription period end** is required before paid entitlement activation. Failure/expiry/cancelation triggers existing Phase 2J read-only enforcement where appropriate. An **incomplete first payment leaves an existing free Starter plan unchanged** until activated.
- Checkout attempts are single-flight per tenant: an open session cannot be replaced merely due to elapsed time; only a matching **signed expiration** releases a pending attempt. This prevents simultaneous Checkout sessions and accidental duplicate purchases. A created intent that never got a provider session is allowed to be retried after a short recovery window.
- An existing Stripe customer can use Portal for management, and a canceled/expired tenant can create a new Checkout using the same customer ID. New subscription activation atomically replaces the former link; invalid/new subscription claims never silently overwrite it.
- Manual subscription changes via platform-admin and the privileged CLI are blocked for Stripe-linked tenants to avoid conflicts with authoritative Stripe subscription state.
- React CRM Subscription & Usage page has **test-mode-only** Checkout and Portal actions, conditional on server configuration. When no keys are configured it remains a fully functional read-only usage page with no payable controls.
- Tenant tests run using fake Stripe HTTP responses and cryptographically signed synthetic webhooks. No real Stripe account was connected or charged.

## Later: exact configuration required
1. In the Stripe Dashboard **test mode**, create recurring Prices for Team and Business in the same Stripe account intended to serve this SaaS. Decide actual currencies, intervals and billing rules; DO NOT invent these values.
2. Add secrets to **server deployment secrets**, not GitHub, chat or browser JavaScript:
   - `CRM_STRIPE_SECRET_KEY=sk_test_...`
   - `CRM_STRIPE_WEBHOOK_SECRET=whsec_...`
   - `CRM_STRIPE_PRICE_TEAM=price_...`
   - `CRM_STRIPE_PRICE_BUSINESS=price_...`
3. Set `CRM_STRIPE_RETURN_URL=https://your-crm-domain.example/crm/subscription` and use controlled first-party HTTPS origins. Configure `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, `SESSION_SECURE_COOKIE=true` and CORS for the CRM and API origins. Test CSRF and authenticated organization switching in the real browser.
4. Register the exact public callback URL `https://your-api-domain.example/api/v1/billing/stripe/webhook` in Stripe test mode for: `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copy that endpoint's signing secret.
5. Configure the Stripe Customer Portal for that test account. **Disable portal plan switching until cross-price subscription changes and entitlements are explicitly supported**; card update/cancellation are the intended initial functions.
6. Keep `CRM_STRIPE_MODE=test`; then explicitly set `CRM_STRIPE_ENABLED=true`. This implementation **intentionally refuses `sk_live_` and `CRM_STRIPE_MODE=live`**.
7. Confirm all smoke tests, renewal, failed payment, portal cancellation, stale event, recovery and entitlement tests against **actual Stripe test events** (not only fakes).
8. From trusted server shell only, publish plan(s) after the test setup passes:
   - `php artisan crm:stripe:publish-plan team`
   - `php artisan crm:stripe:publish-plan business`
   - `php artisan crm:stripe:publish-plan team --revoke` disables new purchase without changing existing subscriptions.
9. Use Stripe Dashboard's event history to investigate any ignored or stale webhook outcome before changing entitlements. Never treat a callback redirect or an `invoice.paid` event alone as sufficient activation proof.

## Intentional limits before live launch
- **No live payments enabled**. No credentials or Price IDs have been added; test/real Stripe Dashboard transactions have not been executed in this batch.
- Invoice storage/reconciliation, chargebacks/refunds, provider API reconciliation after webhook outages, subscription changes to a different Price in the Customer Portal, proration, trial billing settings, tier-specific annual vs monthly variants, tax and dunning policy are not implemented yet.
- Provider webhook state is trusted only after signature, tenant-intent and expected Price validation. There is no manual browser override of billing state.
- At most one Stripe subscription ID is linked to a tenant at a time; canceled/expired subscriptions can be replaced only via a new locally initiated Checkout with the same Stripe customer.
- Partial outages may require an operator to inspect pending checkout/webhook state. Do not bypass the payment guard by manually changing Stripe-linked tenant entitlements.
- No production deployment, secret uploads, portal or Stripe account changes.

## Verification
Run `cd apps/api && php artisan test` with dedicated PostgreSQL, `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build` and `npm run test:e2e`. Require green CI and separate authenticated staging + actual Stripe test-event verification before enabling credentials.
