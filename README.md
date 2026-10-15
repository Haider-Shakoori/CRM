# CRM Platform — Frontend

A multi-tenant SaaS CRM platform covering sales, marketing, customer service, revenue
operations and customer success — delivered as **three connected frontend applications**.

> **This repository contains frontend code only.** There is no server, no database, no
> authentication service, no payment provider and no third-party integration. Every
> capability that would require a backend is either absent or explicitly labelled as
> simulated in the interface. See [Scope](#scope) below.

> **Product name is provisional.** `CRM Platform` is a development placeholder. The final
> name, logo and domain are not decided, and no permanent brand identity has been created.
> Changing them is a configuration edit — see [Re-branding](#re-branding).

---

## Contents

| Application | Path | Stack | Purpose |
| --- | --- | --- | --- |
| Public website | `apps/website` | Astro 7, TypeScript, Tailwind 4 | Marketing, pricing, resources, legal, public demo |
| CRM application | `apps/crm` | Vite, React 19, React Router 7 | The tenant-facing CRM workspace |
| Platform administration | `apps/platform-admin` | Vite, React 19, React Router 7 | SaaS platform-owner console |

| Shared package | Path | Purpose |
| --- | --- | --- |
| `@crm/design-tokens` | `packages/design-tokens` | OKLCH palette, semantic tokens, themes, densities, Tailwind bridge |
| `@crm/ui` | `packages/ui` | ~48 design-system components |
| `@crm/shared-types` | `packages/shared-types` | ~340 domain types, 60 service interfaces |
| `@crm/configuration` | `packages/configuration` | Branding, plans, module registry, industries, site IA, demo policy |
| `@crm/localization` | `packages/localization` | 13 locales, Intl formatters, RTL helpers, i18n factory |
| `@crm/mock-services` | `packages/mock-services` | Browser service implementations and synthetic data (Batch 4) |

---

## Quick start

Requires **Node 20.19+** (22.x recommended) and npm 10+.

```bash
npm install

npm run dev:website   # http://localhost:4321
npm run dev:crm       # http://localhost:5173
npm run dev:admin     # http://localhost:5174
```

## Verification

```bash
npm run typecheck                                          # all packages
npm run build:website                                      # static build
node scripts/check-links.mjs apps/website/dist              # link integrity
```

Current status:

```
TypeScript (5 packages)         PASS    0 errors
astro check (20 files)          PASS    0 errors, 0 warnings
astro build — website           PASS    126 pages in 8.9s
check-links — 126 HTML files    PASS    15,093 / 15,093 resolved, 0 broken
```

Full results, gaps and the ordered plan to close them:
[`docs/testing/TEST_REPORT.md`](docs/testing/TEST_REPORT.md).

---

## Scope

### Built

- Design system with light/dark, three densities, high contrast and seven accent presets
- Public website: 126 static pages, complete SEO foundation, accessible navigation
- Homepage, pricing with a seat calculator and comparison matrix, interactive demo, 404
- Typed domain contracts for every CRM entity and service
- Configuration for branding, plans, 28 modules, 21 industries and the site IA
- Localization for 13 languages including three right-to-left, with real Intl formatting

### Not built, and not simulated as if real

| Capability | Handling |
| --- | --- |
| Backend, API, database | Absent. Service interfaces define the contract. |
| Authentication, sessions, tokens | Simulated. Nothing is transmitted or stored. |
| Payments, billing engine, tax | Absent. Checkout is a labelled preview. |
| OAuth, provider credentials | Absent. The connection wizard requests nothing. |
| Email, SMS, WhatsApp, telephony | Simulated. Delivery states say so. |
| AI models, AI APIs | Absent. A deterministic template engine stands in, labelled. |
| File storage, e-signature | Absent. Placeholder metadata only. |
| GPS and background location | Absent. Check-ins record a chosen label. |
| Backups, monitoring, uptime | Absent. Status figures are labelled synthetic. |
| Compliance certifications | Not claimed anywhere, in any form. |

The rule that keeps this honest is in
[`packages/configuration/src/demo.ts`](packages/configuration/src/demo.ts): 18 canonical
notices, one per unimplemented capability, and `notify.simulated()` for actions. A control
either performs its advertised demonstration action or states plainly that it cannot.

---

## Configuration over code

Four files decide almost everything a user sees. Changing them changes the product.

| File | Decides |
| --- | --- |
| [`branding.ts`](packages/configuration/src/branding.ts) | Product name, logo, favicon, accent, tagline, metadata, footer, email chrome, legal placeholders |
| [`plans.ts`](packages/configuration/src/plans.ts) | Tiers, prices, limits, add-ons, comparison matrix, pricing FAQ, display currencies |
| [`modules.ts`](packages/configuration/src/modules.ts) | Sidebar sections, module routes, icons, persona defaults, entitlements, Simple Mode |
| [`industries.ts`](packages/configuration/src/industries.ts) | 21 industry profiles: terminology, extra objects, sample pipelines, workflows, dashboards |

### Re-branding

Every application, the website metadata, the CRM shell, the customer portal and the email
chrome read from `brandConfig`. To replace the provisional identity:

1. Replace the five files in `apps/website/public/brand/`
2. Update `productDisplayName`, `shortName` and `productTagline` in `branding.ts`
3. Optionally set `colors.accentPresetId` to one of the seven presets
4. Set `PUBLIC_SITE_URL`, `PUBLIC_CRM_URL`, `PUBLIC_PLATFORM_ADMIN_URL` and `PUBLIC_PORTAL_URL`

No component needs editing. Tenant organizations can additionally override the accent and
logo from the in-app branding editor without a redeploy.

---

## Environment variables

All optional; sensible development defaults apply.

| Variable | Used by | Default |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Website build, canonical URLs, sitemap | `https://example-crm.test` |
| `PUBLIC_CRM_URL` | Cross-application links into the CRM | `http://localhost:5173` |
| `PUBLIC_PLATFORM_ADMIN_URL` | Links into the platform console | `http://localhost:5174` |
| `PUBLIC_PORTAL_URL` | Links into the customer portal | `http://localhost:5175` |

Never commit a secret. This repository has no secret to commit: nothing is authenticated and
no credential is modelled on the client.

---

## Architecture

```
Route / page layer      ← owns URL, data loading, page-level states
Feature layer           ← composition, forms, optimistic logic
Design system @crm/ui   ← presentation, keyboard, ARIA, density. Never fetches.
Service contracts       ← the boundary. UI depends on interfaces only.
Implementations         ← mock-services today, HTTP later
Domain types · config · localization · tokens
```

Two rules follow and are worth enforcing in review:

1. A component in `@crm/ui` never imports from `@crm/mock-services`. If it needs data, it
   receives it as props.
2. No view calls `fetch`. Everything goes through a service interface, so replacing the
   mock is a one-line change in a composition root.

Read more: [`docs/architecture/FRONTEND_ARCHITECTURE.md`](docs/architecture/FRONTEND_ARCHITECTURE.md),
[`docs/design-system/DESIGN_SYSTEM.md`](docs/design-system/DESIGN_SYSTEM.md),
[`docs/api-contracts/API_CONTRACTS.md`](docs/api-contracts/API_CONTRACTS.md).

---

## Documentation

| Document | Contents |
| --- | --- |
| [`PROJECT_STATUS.md`](docs/development-progress/PROJECT_STATUS.md) | What exists, what does not, decisions taken, known issues |
| [`BATCH_01_TO_03_REPORT.md`](docs/development-progress/BATCH_01_TO_03_REPORT.md) | Batch-by-batch delivery report |
| [`FRONTEND_ARCHITECTURE.md`](docs/architecture/FRONTEND_ARCHITECTURE.md) | Layering, data flow, shells, performance, risks |
| [`DESIGN_SYSTEM.md`](docs/design-system/DESIGN_SYSTEM.md) | Tokens, themes, density, components, accessibility |
| [`INFORMATION_ARCHITECTURE.md`](docs/architecture/INFORMATION_ARCHITECTURE.md) | Navigation, personas, shortcuts, route conventions |
| [`SITEMAPS.md`](docs/architecture/SITEMAPS.md) | Route maps for all three applications |
| [`USER_JOURNEYS.md`](docs/architecture/USER_JOURNEYS.md) | 15 journeys with edge cases |
| [`API_CONTRACTS.md`](docs/api-contracts/API_CONTRACTS.md) | Payload shapes for the future REST API |
| [`COMPETITOR_MATRIX.md`](docs/competitor-analysis/COMPETITOR_MATRIX.md) | 61 capabilities × 11 platforms, every claim cited |
| [`FEATURE_INVENTORY.md`](docs/feature-inventory/FEATURE_INVENTORY.md) | 384 requirements with IDs and priorities |
| [`FEATURE_MATRIX.md`](docs/feature-inventory/FEATURE_MATRIX.md) | Build status by requirement |
| [`TEST_REPORT.md`](docs/testing/TEST_REPORT.md) | What was verified, and what was not |

---

## Contributing notes

- **Tailwind source scanning.** Each app must declare
  `@source '../../../../../packages/ui/src';` in its stylesheet. Without it the build
  succeeds but components render unstyled — the first thing to check if the CRM looks wrong.
- **`.astro` files distinguish HTML from components.** HTML elements use `class`; imported
  React components use `className`. Two codemod scripts in `scripts/` handle this.
- **Verify before claiming.** Run `npm run typecheck`, `npm run build:website` and
  `node scripts/check-links.mjs apps/website/dist`. Do not report a batch complete without
  them.
- **Never add a fake success state.** If an action cannot reach a real system, call
  `notify.simulated()` and render a `DemoNotice`. This is a correctness requirement, not a
  style preference.
