# Batch Report — Batch 16

**Batch:** 16 — Tenant administration (security, data management and the tenant's own billing)
**Date:** 2026-10-15
**Repository state:** frontend-only; deterministic in-browser mock services; **verified 2026-10-15
(§6 and §8) — the deferred consolidated pass ran, found nine defects, and all are fixed**
**Prior report:** [`BATCH_15_REPORT.md`](./BATCH_15_REPORT.md)

---

## 1. Features implemented

Batch 16 is a **service-plus-screens** batch. It adds the three remaining container services
(`security`, `data`, `billing`) and the seven settings surfaces that sit on them, replacing the
single `/app/settings/*` placeholder that has stood since the first batch.

### Service layer

- **`packages/mock-services/src/services/administration.ts`** implements every method of
  `SecurityService` (9), `DataManagementService` (14) and `BillingService` (15) — 38 methods in
  total, exported as `makeSecurityService(db)`, `makeDataService(db)` and `makeBillingService(db)`.
- **Scoping.** All three services resolve the *active* organization from the signed-in user's
  `activeOrganizationId` (falling back to the first seeded organization), mirroring the list
  scoping in `index.ts`. Switching organization in the shell therefore re-scopes the policy, the
  data view and the subscription.
- **Derived, not seeded.** Several interface shapes have no seeded collection. Rather than adding
  collections, each is derived from records that *are* seeded and the derivation is disclosed on
  the screen:
  - **Trusted devices** are sessions whose `trusted` flag is set. Revoking one clears that flag —
    a real local write. (No `trustedDevices` collection exists.)
  - **Duplicate candidates** are grouped from contacts (last name + account), leads (company name)
    and accounts (name); resolutions are held in closure state for the session.
  - **Deletion requests** are derived from contacts carrying a *withdrawn* consent entry, because
    that is the only data-subject signal this browser actually holds.
  - **Consent overview** is counted directly from the consent entries on seeded contacts.
  - **Import history** includes two illustrative completed jobs per organization whose row counts
    are the real counts of the seeded contacts and accounts.
  - **The security policy baseline** is derived from MFA coverage in the directory and the
    tenant's account tier; the **retention baseline** derives its audit-retention rule from the
    same policy value the Security screen edits.
- **Local-only configuration.** A security policy, a retention override, duplicate match rules,
  a restore request and the duplicate resolutions are stored in `localStorage` under the
  `crm.demo.` namespace — the namespace `services.demo.reset()` already clears — with an in-memory
  fallback for environments without storage. **No new collection was added to the store.**
- **Honest failures and notes.** `revokeSession` cannot end the session in use (`forbidden`);
  `changePlan`/`updateSeats` refuse to go below `seatsUsed`; `setAddOn` refuses an add-on that is
  not compatible with the plan; `cancel` requires a reason and rejects a second cancellation;
  single sign-on cannot be enabled through `updatePolicy` at all (`forbidden`, with the reason in
  the message). Session revocation, restore requests and audit exports return payloads/notes that
  state in words that nothing real was terminated, restored or exported.

### Settings screens (`/app/settings/*`)

- **Organization** (`/app/settings/organization`): company profile over `services.organization`,
  branding over `updateBranding` (accent preset, theme, density, sign-in background, generated
  initial mark or a URL placeholder), and the fiscal calendar over `fiscalYear`. A note on the
  screen discloses that the company-profile service resolves the first seeded organization while
  the record lists follow the organization switcher.
- **Business units & teams** (`/app/settings/business-units`): the reporting tree over
  `hierarchy` / `createOrgNode` / `updateOrgNode` / `removeOrgNode`, with child creation, per-node
  manager, country, fiscal-year and currency overrides, and a client-side guard that a unit with
  children cannot be removed from this screen. Teams are created and edited over
  `users.createTeam` / `users.updateTeam`.
- **Users** (`/app/settings/users`): the organization directory (filtered by membership, because
  `users.list` is not tenant-scoped), invite / revoke / resend invitations, activate, suspend with
  a reason, reactivate, change roles and change seat type. The invitation dialog states before the
  button is pressed that no email is sent and no account is provisioned.
- **Roles & permissions** (`/app/settings/roles`): the role list, a **capability × role matrix**
  for one resource at a time (view / create / edit / delete / export as the catalogue exposes
  them) with a per-role scope select, staged edits saved one write per changed role, role
  creation with optional permission clone, rename/inherit editing, deletion (refused for system
  roles and for roles still assigned — the service's own guard), effective-permission resolution
  and the **field-level matrix** for the `asset` custom object (read-only, because no write path
  exists), plus an access-review table of the people holding the selected role.
- **Security** (`/app/settings/security`): the policy over `services.security` — MFA requirement
  and methods, password rules, session timeouts, IP allow/deny lists and country allow-list, and
  data-governance switches. Sessions and trusted devices are listed with revocation, and the
  single-sign-on card states plainly that no identity provider is connected. The page banner says
  the controls are local-only and enforce nothing.
- **Audit log** (`/app/settings/audit`): the audit viewer with severity, category and actor
  filters and a change-diff dialog, over `security.auditEvents`; export recording over
  `exportAuditEvents`. A banner states the log is local records, not a tamper-evident trail.
- **Data management** (`/app/settings/data`): the dataset snapshot (`demo.snapshot()`) and usage
  meters, import history and a step-by-step **demonstration importer** (start → suggest mapping →
  validate → commit), export history with local file generation, duplicate candidates with merge
  and review actions, a local-only match-rule panel, the retention policy editor, consent and
  deletion overviews, backup status with a restore request, and **Reset demo data** over the
  existing `services.demo.reset('all')` with a destructive confirmation.
- **Billing** (`/app/settings/billing` plus section routes): the tenant's own subscription — plan,
  status, seats with an editable seat count, add-ons with quantities, entitlements, an illustrative
  plan-change preview with gained/lost entitlements, cancellation and reactivation, usage meters,
  invoice history with a line-item dialog, and a payment-method placeholder that returns
  `state: 'not_connected'` rather than a fabricated card. A read-only billing-contact card states
  that editing it belongs to the platform-owner console, which is not built.

### Honesty controls in this batch

- **No identity provider, no SSO, no enforcement.** The Security banner, the SSO card and the
  service guard all say so; the policy is stored in the browser and the screen repeats that.
- **No payment provider.** Every amount is a record; `billingState: 'not_connected'` is part of
  the subscription payload; the payment-method list contains a single placeholder; the plan-change
  and seat-change toasts go through `notify.simulated()`.
- **No real audit trail and no backup.** Both screens carry a warning banner; a recorded audit
  export returns a row count and says no file was produced; a restore request returns a note that
  nothing was restored.
- **No email or provisioning.** Invitations carry `deliverySimulated`; the resend action surfaces
  the service's own note; the dialog states that no email is sent.
- **The importer never reads a file.** Headers and row counts are typed by the reviewer, the
  service composes records from the file name and row number (capped at 200 rows so a large file
  cannot freeze the tab), and every created record carries a description saying exactly that.
- **Illustrative figures are described as synthetic.** Meters, import history counts, consent
  totals and audit entries are all labelled as seeded/derived rather than measured.

---

## 2. Pages and routes created/edited

**New files:**

- `apps/crm/src/routes/settings/SettingsScreens.tsx` — exports `SettingsPageNav`,
  `useActiveOrganization`, `OrganizationScreen`, `BusinessUnitsScreen`, `UsersScreen`.
- `apps/crm/src/routes/settings/RoleScreens.tsx` — exports `RolesScreen`.
- `apps/crm/src/routes/settings/SecurityScreens.tsx` — exports `SecurityScreen`, `AuditLogScreen`.
- `apps/crm/src/routes/settings/DataScreens.tsx` — exports `DataScreen`.
- `apps/crm/src/routes/settings/BillingScreens.tsx` — exports `BillingScreen`.

**Edited:** `apps/crm/src/app/router.tsx`. The `/app/settings/*` placeholder is replaced by:

| Route | Screen | Kind |
| --- | --- | --- |
| `/app/settings` | Redirect to `/app/settings/organization` | Redirect |
| `/app/settings/organization` | Company profile, branding, fiscal year | Real |
| `/app/settings/business-units` | Reporting tree and teams | Real |
| `/app/settings/users` | Directory and invitations | Real |
| `/app/settings/roles` | Roles, permission matrix, field matrix | Real |
| `/app/settings/security` | Security policy, sessions, devices | Real |
| `/app/settings/audit` | Audit log viewer | Real |
| `/app/settings/data` | Data management and reset | Real |
| `/app/settings/billing` | Subscription | Real |
| `/app/settings/billing/:section` | Plans / usage / invoices / payment-method sections | Real |
| `/app/settings/branding` | Redirect to organization (registry addresses it separately) | Redirect |
| `/app/settings/structure` | Redirect to business-units (registry label) | Redirect |
| `/app/settings/consent` | Redirect to data management | Redirect |
| `/app/settings/help` | Help centre — **unchanged** | Real |
| `/app/settings/*` | Narrowed placeholder for localization and the module catalogue | Placeholder |

`moduleRouteManifest` needed no new entry: every new path sits under the existing
`/app/settings → org_admin` prefix, and the `/app/settings/help → null` entry remains first and
unchanged. The `/app/settings/billing/plans` link that `Boundaries.tsx` and
`tenant.accessDeniedContext` already point at now resolves to the real billing screen rather than
the old generic placeholder.

---

## 3. Components created or reused

No new `@crm/ui` primitives were required, and **no new npm dependency was added**.

- **Reused from `@crm/ui`:** `Alert`, `Badge`, `Button`, `Card`/`CardContent`/`CardHeader`/
  `CardTitle`, `Checkbox`, `ConfirmDialog`, `DataTable`, `DemoNotice`, `Dialog`, `DialogContent`,
  `Field`, `IconButton`, `Input`, `MiniStat`, `MultiSelect`, `Progress`, `Select`, `Slider`,
  `StatusBadge`, `Switch`, `TableWrap`, `Td`, `Textarea`, `Th`, `TonePill`, `Tr`, `cn`,
  `focusRing`, `notify`.
- **Reused from `components/shared`:** `PageHeader`, `FilterBar`-style controls, `ListSkeleton`,
  `RecordEmptyState`, `RecordErrorState`, `formatDate`, `formatMoney`, `formatNumber`,
  `initialsOf`.
- **Local to the settings module:** `SettingsPageNav` and `useActiveOrganization`
  (`SettingsScreens.tsx`, shared by the other four files in the same route folder), `BillingNav`,
  `OrgNodeForm`, `TeamForm`, `InviteForm`, `RoleDialog`, `ImportWizard`.
- **Accessibility conventions applied:** matrix cell checkboxes carry an `sr-only` label so every
  cell has an accessible name; the retention `Switch` is labelled the same way; every filter
  select carries an `aria-label` or a bound `Field` label; the permission matrix and the
  capability tables use `caption`/`scope` and are keyboard operable through the primitives.

---

## 4. Interactive mock workflows completed

1. Edit the company profile, branding and fiscal year and save each; the read-only facts update.
2. Add, edit and remove a business unit (including a child), and create/edit a team.
3. Filter the user directory, then invite a user (roles, teams, message) — the toast is a
   simulated-delivery toast and the invitation carries `deliverySimulated`.
4. Revoke and resend a pending invitation; suspend a user with a reason, then reactivate them;
   change a user's roles and seat type.
5. Select a role, change capabilities and scopes across the role columns, save, and watch the
   effective-permission counts update; clone a system role and delete an unattached custom role.
6. Review field-level read/edit/mask flags and the access-review list for the selected role.
7. Edit the security policy and save it; attempt an out-of-range value and read the validation
   error; switch to another organization and see a different derived baseline.
8. End a session (refused for the current one), clear other sessions, and remove device trust.
9. Filter the audit log, open an event's change diff, and record an audit export.
10. Run the demonstration import end to end: source → suggested mapping (with samples drawn from
    real records) → validation summary with rejected rows → commit with a duplicate policy.
11. Request an export and generate/download the CSV produced in the browser.
12. Review, ignore or merge duplicate candidates; re-point related records during a merge.
13. Edit and save the retention policy; save the local duplicate match rules.
14. Request a restore (and read the note that nothing was restored); review consent and deletion
    derivations.
15. Preview a plan change (recurring amount, proration note, entitlements gained/lost) and record
    it; change seats and add-on quantities; cancel and reactivate the subscription; open an
    invoice's line items.
16. Reset the demonstration data and confirm the reload restores the seeded baseline.

---

## 5. Files created or modified

**Created**

- `packages/mock-services/src/services/administration.ts` (~1,620 lines) — `makeSecurityService`,
  `makeDataService`, `makeBillingService`.
- `apps/crm/src/routes/settings/SettingsScreens.tsx` (~1,485 lines)
- `apps/crm/src/routes/settings/DataScreens.tsx` (~1,095 lines)
- `apps/crm/src/routes/settings/BillingScreens.tsx` (~850 lines)
- `apps/crm/src/routes/settings/SecurityScreens.tsx` (~830 lines)
- `apps/crm/src/routes/settings/RoleScreens.tsx` (~720 lines)
- `docs/development-progress/BATCH_16_REPORT.md` (this file)

**Modified**

- `packages/mock-services/src/services/index.ts` — imported the three factories from
  `./administration` and added the container keys **`security`, `data`, `billing`** (after
  `roles`, before `tenant`).
- `apps/crm/src/app/router.tsx` — the `settings/*` placeholder replaced by the routes in §2,
  keeping the `/app/settings` redirect and `/app/settings/help` exactly as they were.

Nothing else was touched: `HelpCentre.tsx` and every other test file are unmodified.
`packages/mock-services/src/services/modules.test.ts` was left alone by the implementing run and
gained its 14 Batch 16 tests during the verification pass (§6).

---

## 6. Tests executed and their results

**Executed on 2026-10-15.** This section was written as "deferred to the end-of-run consolidated
pass"; that pass has now run, over Batch 16, and this is what it measured. Full recorded output
is in [`TEST_REPORT.md`](../testing/TEST_REPORT.md) §2.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | **PASS** — 0 errors, 6 packages + 3 apps |
| Lint | `npm run lint` | **PASS** — 0 errors, 6 warnings (all informational `react-hooks/incompatible-library`) |
| Unit and DOM tests | `npx vitest run` | **PASS** — 151 tests, 5 files (143 unit + 8 dom) |
| CRM production build | `npx vite build` (in `apps/crm`) | **PASS** — no chunk over 500 kB; largest `mock-services` 494.08 kB |
| Website build | `npm run build:website` | **PASS** — 126 pages |
| Link check | `node scripts/check-links.mjs apps/website/dist` | **PASS** — 15,093 / 15,093 internal links resolved |
| Platform-admin build | `npx vite build` (in `apps/platform-admin`) | **PASS** — 391.01 kB single chunk |
| Browser smoke | dev server, 13 settings surfaces probed | **PASS** — 0 console errors after the §7 fixes |

The first run of the pass did **not** pass: 28 typecheck errors across the five settings screen
files, 6 `react-hooks/set-state-in-effect` lint errors, and two defects only a browser shows
(§7). All were fixed, then everything above was re-run.

### Contract tests added for the three new services

`packages/mock-services/src/services/modules.test.ts` gained a
`describe('tenant administration services (batch 16)')` block of **14 tests**, covering exactly
the cases this section asked for: policy derivation and a local edit, the SSO refusal, session
scoping with the current session refused and `simulated: true` on revocation, devices derived
from trusted sessions, the `generatedLocally` audit export, retention validation and persistence,
duplicate candidates and the merge cascade, consent counted from seeded contacts, usage meters
scoped to the active organization (re-checked after switching organization), the subscription's
tenant and `billingState`, seat/add-on refusals, the simulated checkout preview, cancel-then-
conflict-then-reactivate, the `'*'` plan wildcard, and the zero-seat preview refusal.

### Static self-review performed before execution

Before the pass ran, the following were checked by reading:

- Every imported identifier in the six new files is referenced after its import block.
- Every top-level local declaration is referenced at least once (this caught an unused
  `planById`/`currentPlan` pair in `BillingScreens.tsx`, removed before completion).
- Every interface method on the three services is present, with matching names and argument
  counts, and the payloads returned match the contract shapes.
- No `any`, no `==`/`!=`, no `console.*` in the new code; index accesses are guarded or use the
  repo's existing non-null assertion pattern where the length is checked first.
- No new dependency, and no new collection in `MockDb`.

---

## 7. Defects the tests found, and how they were fixed

Found by the verification pass described in §6, after the self-review list below:

1. **28 typecheck errors across the five settings screens.** Four causes, all mechanical:
   `Paginated` reads were passed to `useAsync` instead of `useList`; arguments were supplied to
   contract methods that take none (`plans()`, `addOns()`); `useMutation.data` was read, which
   that hook does not expose; and a retention draft used `days` where the contract says
   `retentionDays`. The change-plan preview became a `useAsync` call driven by a
   `previewRequest` state value, so a preview is fetched, not mutated into existence.
2. **6 `react-hooks/set-state-in-effect` errors.** Each screen synced a freshly loaded record
   into a draft inside an effect. All now use the repo's guarded render-time seed — write the
   draft only when the loaded object identity changes — or derive the value outright, which
   convention #5 already requires.
3. **Two `noUnusedLocals` errors in files this batch added**, found when typecheck ran: a
   `notify` import in `BillingScreens.tsx` and a `MultiSelect` used but not imported in
   `SettingsScreens.tsx`.
4. **A cross-tenant leak in the permission matrix** (browser-found). `roles.fieldMatrix()` read
   `customFields` and `roles` from the whole store rather than the active organization, so
   `/app/settings/roles` listed 24 rows for a tenant owning 12 fields — another organization's
   configuration, visible to the signed-in user. Both reads now go through `tenantRecords`;
   rows 24 → 12, console clean. No unit test could see it, because each test run has one active
   organization.
5. **Seven React "uncontrolled → controlled" warnings on `/app/settings/organization`**
   (browser-found). Both `useForm` calls lacked `defaultValues`, so the selects mounted empty and
   received a value on the next render. Defaults added; the warnings are gone.
6. **The change-plan dialog opened unseeded and priced a change at zero seats** (browser-found).
   The header button set only `changeOpen`, while the per-plan button seeded plan, seats and
   interval — so `Number(changeSeats)` was `Number('') === 0` and the preview showed Enterprise at
   the $1,200 platform fee with no seat cost. The header button now seeds from the record, and
   `previewPlanChange` refuses fewer than one seat with a typed field error, as `updateSeats`
   already did.
7. **The `'*'` plan wildcard was shown to the user as a module** (browser-found).
   `plan-enterprise` grants `moduleKeys: ['*']` and nothing expanded it: the preview reported
   "Entitlements gained: `*`" and listed all 26 modules the tenant held as **lost**, and the Plans
   tab read "1 modules". `expandModuleKeys()` in `administration.ts:1389` now expands the
   wildcard over the catalog ∪ plan ∪ add-on keys and feeds `previewPlanChange` and
   `entitlements()`; the tab says "All modules". The catalog alone is not the universe — six keys
   plans grant (`activities`, `calendar`, `knowledge_base`, `orders`, `documents`, `billing`) are
   not catalog entries. Two §6 tests cover the expansion and the refusal.
8. **Usage meters had no tenant field**, so `billing.usage()` matched them by id prefix.
   `UsageMeter` now carries `organizationId`, the seed stamps it, and the read filters on it.
   Because persisted v2 stores lack the field, `STORAGE_VERSION` moved to **3** and old browser
   data is discarded on load rather than read half-populated.
9. **The AI usage-meter lookup was unscoped** — found in the same audit as (4) and now resolved
   through `currentOrganizationId()`.

Defects found by self-review and fixed before submission:

1. **`BillingScreens.tsx` computed a current-plan lookup that nothing used.** `planById` and
   `currentPlan` were left over from an earlier draft; with `noUnusedLocals` on, that is a
   typecheck failure. Removed.
2. **`DataScreens.tsx` sent the wrong retention field name.** The local draft uses `days`, while
   `updateRetentionPolicy` expects `retentionDays`; the mutation now maps between them.
3. **`roles.create` payload was missing the required `userCount`.** `userCount` is a required
   field on `Role`, so `CreateInput<Role>` requires it; the create path now passes `0`.
4. **The billing section key did not match the route.** The registry path is
   `/app/settings/billing/payment-method`; the section key was `payment`, which made the screen
   fall back to the subscription tab. The key is now `payment-method`.
5. **Matrix scope select read the wrong grant.** It displayed the scope of the `view` grant
   rather than of the first grant for the resource, which could disagree with the value the
   select would write. It now reads the first grant for the resource.
6. **The retention `Switch` had no accessible name.** It uses an `sr-only` label so the control
   is announced with the resource it governs.
7. **The export request was missing a required contract field.** `ExportsService.request()` takes
   `Omit<ExportRequest, 'id' | 'requestedAt' | 'state' | 'generatedLocally'>`, which still
   requires `requestedById`; the Data management screen now supplies the signed-in user's id,
   which is why `useActiveOrganization` returns the resolved user as well as the organization.
8. **A `Field` label pointed at a non-labelable element.** The branding preview panel used
   `htmlFor` on a `<div>`; the label association was removed so no invalid association is
   advertised to assistive technology.

---

## 8. Build and typecheck status

**Measured.** Typecheck `npm run typecheck` reports 0 errors across 6 packages and 3 apps.
ESLint reports 0 errors and 6 informational warnings. `npx vitest run` reports 151 passing tests
in 5 files. The CRM build emits no chunk over 500 kB (largest: `mock-services` 494.08 kB, then
`charts` 430.11 kB, `ui` 315.93 kB, `vendor` 300.77 kB, `index` 66.35 kB); the five settings
screen chunks are 40.97, 32.37, 26.88, 26.82 and 18.89 kB, all lazy. The website builds 126 pages
and its link check resolves 15,093 of 15,093 internal links. Platform-admin builds to a single
391.01 kB chunk.

---

## 9. Responsive and accessibility findings

### Accessibility work in this batch

- Every control has an accessible name: icon-only buttons carry `aria-label`; the matrix cells and
  the retention switches use `sr-only` labels so an accessible name exists without visual noise;
  filters and selects carry `aria-label` or a bound `Field` label.
- Status is conveyed by text as well as colour (`StatusBadge`, `TonePill`, `Badge`), and the
  honesty notes are body text, so a screen reader hears "not connected" rather than relying on a
  green or amber dot.
- The permission matrix is a real `<table>` with a `caption`, `scope="col"` headers and
  `aria-pressed` role buttons in the list; the billing tabs are links with a visible focus ring
  and an `aria-label` on the navigation group.
- Loading, empty and error states exist on every list and detail read (`ListSkeleton`,
  `RecordEmptyState`, `RecordErrorState`), including for the derived consent/deletion lists.
- Destructive actions are two-step: `ConfirmDialog` with a danger tone and an explicit verb for
  role deletion, unit removal, record merge and the demo reset.

### Measured in the verification pass

- Console output on all 13 settings surfaces at 1280 px: **0 errors** after the §7 fixes. The
  pass is what found defects 4, 5, 6 and 7 — none reachable from a typecheck or the unit suite.
- One write path driven end to end: Change plan → preview Enterprise for the seeded seat count.
  It returns amounts, an effective date and five named entitlements, and still states the change
  is simulated.

### Not measured

- axe-core and Lighthouse were still **not** run; the WCAG 2.2 AA target remains an architectural
  claim, not a measurement.
- Responsive behaviour at the eight target widths was not asserted. The permission matrix (one
  column per role) and the retention table are the most likely horizontal-overflow points on
  narrow screens; both sit inside `overflow-x-auto` containers.
- RTL and the 13 locales were not re-exercised against these screens.

---

## 10. Known issues

### Correctness

- **Two billing methods are unreachable from the UI.** `checkoutPreview` and `applyPromoCode` are
  implemented because the contract requires them, but the screen does not offer a checkout step —
  there is no payment provider to check out against, and a form that produced a "confirmation"
  without one would be exactly the kind of fabricated success this build avoids.
- **`security.updatePolicy` refuses to touch SSO.** Enabling SSO (or changing its protocol)
  returns `forbidden` with the reason in the message, so a "connected" identity state cannot be
  written into the local policy at all.
- **The permission catalogue is not organization-scoped.** `roles.permissionsCatalog()` (existing
  code) enumerates `organizations[0]`'s modules. After switching organization the matrix can list
  resources the active tenant has not licensed; those rows simply have no grants. Pre-existing,
  not introduced here.
- **`users.list`, `users.invitations` and `users.teams` are not tenant-scoped** (existing code),
  so this batch filters them client-side by membership of the active organization. With a page
  size of 200/100 the seeded volumes fit, but a larger tenant would undercount.
- **Derived lists are read-only by design.** Duplicate candidates, deletion requests, consent
  figures, import history and usage meters are computed; the screens say "derived" rather than
  implying stored records.
- **Retention, the duplicate rules, the security policy and restore requests live in
  `localStorage`** under `crm.demo.`. They survive a reload but are cleared by the demo reset (or
  by clearing site data). This is stated on each screen.
- **`users.groups()` still returns empty and `createGroup`/`updateGroup` still return
  un-implemented failures** (existing code, out of this batch's scope); the Users screen therefore
  offers no group control rather than one that does nothing.
- **A recorded audit export produces no file.** `exportAuditEvents` returns a row count and an
  id; the screen says plainly that no download is produced, because the service holds none.

### Performance

- The import wizard and the matrix keep small drafts in component state; no unbounded lists are
  introduced. The duplicate candidate derivation scans the organization's contacts, leads and
  accounts on each call, which is a linear scan of a few hundred records — acceptable at the
  seeded volumes, not a pattern for production.

### Scope

- No screens were built for localization (`/app/settings/localization`), the module catalogue
  (`/app/settings/modules`) or plan checkout; the narrowed `settings/*` placeholder names what
  remains and the rest of the administration surface is real.
- The field-level permission matrix is display-only because `RolesService` exposes no write path
  for it; the card says so.

### Quality

- `administration.ts` is ~1,620 lines because the three interfaces are cohesive and share the
  same helper set (scoping, local settings, audit append); splitting it would need a shared
  internal module. `SettingsScreens.tsx` (~1,485 lines) contains three screens, matching the
  module-per-file convention.

---

## 11. Remaining frontend work

With Batch 16 the tenant-administration surface is mock-complete. What remains from
`PROJECT_STATUS.md`:

- **The platform-owner console** — the largest outstanding surface: cross-tenant overview,
  tenant provisioning and lifecycle, plans and add-ons administration, feature flags, the module
  catalogue, localization administration, platform audit, support tickets and system status. The
  store already seeds `platform*` collections, so the work is service-plus-screens.
- **Integrations and developer experience** — the marketplace, connection wizards, webhooks and
  the endpoint reference.
- **Documents, contracts, recurring revenue and projects** detail screens that are still
  placeholders.
- **Cross-cutting QA:** a real axe-core/Lighthouse run, a full RTL and locale pass, and
  responsive overflow assertions at the eight target widths.

---

## 12. Suggested next batch

**Batch 17 — platform-owner administration.** It is the last large reserved surface, the seeded
`platformPlans`, `platformAddOns`, `platformSubscriptions`, `platformInvoices`, `platformUsers`,
`platformRoles`, `platformAudit`, `platformSupportTickets`, `featureFlags`, `moduleCatalog`,
`localizationRows`, `systemStatus` and `maintenanceBanners` collections already exist, and the
`PlatformAdminService` contract is fully declared. It also closes two deliberate gaps recorded in
§10 — localization and the module catalogue — and gives the billing screen's platform-side
counterpart somewhere to live. If the run ends before that batch, the same scope becomes the
first item of the final QA pass.
