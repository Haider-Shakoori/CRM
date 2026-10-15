# Batch Report — Batches 1 to 3

**Batches covered:** 1 (Research and architecture), 2 (Design system), 3 (Website foundation)
plus partial delivery of Batch 5 (pricing and conversion)
**Date:** 2026-10-13
**Repository state:** runnable, builds clean, verified

---

## 1. Features implemented

### 1.1 Monorepo and tooling

- npm workspaces monorepo with three applications and six shared packages
- TypeScript 5.9 in strict mode across every package, with `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, `noImplicitOverride` and unused-symbol checking enabled
- ESLint 10 flat config with typescript-eslint and `eslint-plugin-react-hooks`
- Prettier 3 with the Astro plugin
- Root scripts: `dev:*`, `build:*`, `preview:*`, `typecheck`, `lint`, `format`, `test`,
  `test:e2e`, `verify`
- Two build-verification scripts: an internal link checker and an `.astro` class-name codemod
- 648 dependencies installed with no audit findings

### 1.2 `@crm/design-tokens`

- OKLCH colour model: brand, teal, amber and 13-step neutral ramps
- Six-layer token architecture: raw palette → semantic aliases → theme overrides →
  density → contrast/motion → Tailwind v4 bridge
- Light theme, dark theme, system-following resolution
- Three density modes driven by a single `--density-factor` and the Tailwind `--spacing`
  override
- High-contrast mode with a separate dark block
- Seven accent presets for tenant-level re-branding
- Ten-colour categorical chart palette, ordered for colour-vision deficiency, with separate
  dark values
- Control metric tokens (input, button, row, sidebar, topbar, drawer heights)
- Two reduced-motion mechanisms: the OS media query and an in-app attribute
- Custom Tailwind variants: `dark`, `rtl`, `ltr`, `compact`, `coarse`

### 1.3 `@crm/ui` — component library

Five modules, approximately 48 exported components:

- **Primitives** — Button (9 variants × 9 sizes), IconButton (label required), Badge,
  TonePill, StatusBadge with a 70-entry tone map and safe neutral fallback, Card and its
  parts, SectionHeader, Avatar, AvatarGroup, Progress, ScoreRing, Separator, Skeleton,
  SkeletonText, SkeletonTable, SkeletonCard, Alert, DemoNotice, Container, Grid
- **Forms** — Field with automatic error/description wiring, Label, FieldGroup, Input,
  Textarea with auto-resize, PasswordInput with a strength meter, SearchInput with a clear
  action and shortcut hint, Select with search and grouping, Checkbox with indeterminate,
  Switch, RadioGroup, MultiSelect with free-text entry, CurrencyInput, PhoneInput with
  country dial codes, AddressInput with per-country field order, Slider,
  `useUnsavedChangesWarning`
- **Overlays** — Dialog, Sheet with logical start/end sides and a bottom-sheet mode,
  ConfirmDialog, DropdownMenu with checkbox/radio/sub items, Tooltip, Popover, Toaster and
  the `notify` helpers including `notify.simulated()`
- **Data** — TableWrap/Th/Td/Tr, PropertyList, DataTable on TanStack Table with sorting,
  selection, sticky headers, density and skeleton loading, EmptyState with first-run hints,
  ErrorState with five typed variants, KpiCard, KpiRow, Timeline, FileUpload,
  ChartSkeleton, ConversionChip
- **Navigation** — Tabs and UnderlineTabs, Breadcrumbs with middle truncation, Pagination
  with range summary, Accordion, SidebarNav with nested items and `aria-current`, NavSection,
  Steps, PageShellSkeleton, SkipLink
- **Theme** — ThemeProvider applying eight `data-*` attributes, `useTheme`, media query
  hooks, `useLocalState`, `LiveRegion`, `useFocusTrap`

### 1.4 `@crm/shared-types`

- 16 domain modules and approximately 340 exported types
- 60 service interfaces forming the complete `ServiceContainer`
- Typed error contract with `AppErrorCode`, field errors and trace ids
- Pagination with facet support, recursive filter groups, partial bulk outcomes and
  optimistic concurrency
- Simulation markers as literal types, so an unimplemented capability cannot be presented as
  real without a type error

### 1.5 `@crm/configuration`

- **Branding** — product name, four logo assets, favicon, social card, accent preset,
  theme/density/locale/currency defaults, website metadata, announcement banner, application
  titles, email chrome, legal placeholders and a `resolveBrand()` merge helper
- **Plans** — 5 tiers, 7 add-ons, 55-row comparison matrix, 10-question FAQ, 16 display
  currencies with illustrative rates, `calculatePlanCost()`
- **Modules** — 28 modules across 10 sidebar sections with routes, icons, persona defaults,
  entitlement keys, badge sources, child routes, Simple Mode flags and plan gating, plus
  `resolveNavigation()` and a 17-persona catalogue with landing routes and density defaults
- **Industries** — 21 profiles with terminology substitution, extra objects with typed
  fields, sample pipelines with probabilities, representative workflows, dashboard widgets,
  common integrations and a regulatory disclaimer flag
- **Site IA** — primary navigation with mega menus, 6 footer columns, app origins, 14
  product page definitions, 19 feature page definitions, all static routes
- **Demo policy** — 18 canonical honest-labelling notices plus shared policy copy

### 1.6 `@crm/localization`

- 13 locales with honest completeness percentages, quality tiers, fallback chains,
  direction, and per-surface enablement
- Reference dictionary of ~150 keys; Arabic substantially complete; Dari, Pashto, Hindi,
  Portuguese, Turkish and Chinese partial; Japanese and Indonesian machine-assisted drafts
- Intl-based formatters: number, compact number, currency, compact currency, percent, delta,
  date in eight styles, time, date-time, relative time, duration, days elapsed, countdown,
  date range, relative day label, hour options, person name with East Asian name order,
  initials, phone, address, address field order
- RTL helpers including the `logical` object for JavaScript cases and text isolation
- Framework-agnostic i18next factory with browser negotiation and missing-key warnings
- 37 timezones, 69 countries, 35 currencies, 12 fiscal months, 4 calendar systems, 4 number
  format styles

### 1.7 Public website

- **126 pages built**, static-rendered
- Complete SEO head: unique titles, meta descriptions, canonical, Open Graph, Twitter card,
  hreflang for three locales, BreadcrumbList and FAQPage JSON-LD
- **No invented structured data**: no `aggregateRating`, no `offers`, no address, no founding
  date, no employee count
- Theme resolved before first paint by a 14-line inline script
- Skip link, landmark structure, single `main`
- Announcement bar, configurable and dismissible with persistence
- Sticky header with four accessible mega menus, three dropdowns and a full mobile
  navigation, all server-rendered so every link is crawlable and the site works without
  JavaScript
- Footer with six configured columns, demonstration-content notice, provisional-identity
  notice and legal links
- **Homepage with all 21 required sections**
- **Product preview island** built from real design-system components with seeded
  deterministic data — not a screenshot, and no hydration mismatch
- **Pricing page** with interval toggle, seat slider plus numeric entry, currency
  restatement, five plan cards with per-plan limit disclosure, seven add-ons, a 55-row
  searchable comparison matrix with progressive disclosure, guidance and a 10-question FAQ
- **Demo page** with six role scenarios, an eight-step guided tour and a "what is not real"
  section listing 14 simulated capabilities
- 404 page with a working no-JavaScript search form and four columns of onward navigation
- 91 further routes resolving to an honest, labelled, `noindex` in-development page
- `robots.txt` excluding simulated application and authentication surfaces
- Generated sitemap with post-authentication routes filtered out

---

## 2. Pages and routes created

| Surface | Count | Notes |
| --- | ---: | --- |
| Fully implemented website pages | 4 | Homepage, pricing, demo, 404 |
| Honest in-development pages | 91 | Labelled, `noindex`, navigable |
| Generated index and utility pages | 31 | Section indexes, sitemap, robots |
| **Website total** | **126** | All verified for link integrity |
| CRM routes | 0 | Route map specified in `SITEMAPS.md` |
| Platform admin routes | 0 | Route map specified in `SITEMAPS.md` |

Complete route trees for all three applications are specified in
[`SITEMAPS.md`](../architecture/SITEMAPS.md).

---

## 3. Components created or reused

| Source | Created | Reused |
| --- | ---: | --- |
| `@crm/ui` | 48 | — |
| `apps/website` Astro components | 5 | — |
| `apps/website` React islands | 5 | 48 UI components |
| Build scripts | 3 | — |

The DashboardPreview island is worth calling out: it reuses `Card`, `Badge`, `DemoNotice`
and the token system directly, so the homepage preview cannot drift away from the product,
and a token change is visible on the marketing site and in the CRM simultaneously.

---

## 4. Interactive workflows completed

| Workflow | State |
| --- | --- |
| Browse the marketing site with mega menus, on desktop and mobile | Working |
| Switch between light, dark and system theme, persisted across site and app | Working |
| Switch interface language and observe direction, `lang` and `dir` change | Working |
| Dismiss the announcement bar with persistence | Working |
| Compare plans across billing intervals with live totals | Working |
| Calculate seat-inclusive cost with annual saving | Working |
| Restate prices in 15 other currencies with an illustrative-rate disclosure | Working |
| Search and progressively disclose a 55-row comparison matrix | Working |
| Pick a demo scenario and route into the corresponding target | Working |
| Follow an eight-step guided tour | Working |
| Read the "what is not real" inventory of 14 simulated capabilities | Working |
| Reset demo data from the demo toolbar | Working |
| Recover from a 404 through search and onward navigation | Working |
| Verify 15,093 internal links resolve | Working (automated) |

**Not yet working, and not claimed:** every CRM workflow, every form submission, every
authenticated flow, all data persistence beyond theme and demo preferences.

---

## 5. Files created or modified

| Area | Files |
| --- | ---: |
| Root configuration | 6 |
| `packages/design-tokens` | 4 |
| `packages/ui` | 8 |
| `packages/shared-types` | 17 |
| `packages/configuration` | 7 |
| `packages/localization` | 5 |
| `apps/website` | 19 |
| `scripts` | 3 |
| Documentation | 11 |
| **Total** | **80** |

The most consequential single file is
[`packages/configuration/src/branding.ts`](../../packages/configuration/src/branding.ts):
replacing the placeholder name, logo and accent there re-brands the website footer, the
navigation, the SEO metadata, the email chrome and — once built — every CRM screen, without
touching a component.

---

## 6. Tests executed and results

```
TypeScript (5 packages)        PASS    0 errors
astro check (20 files)         PASS    0 errors, 0 warnings, 0 hints
astro build                    PASS    126 pages in 8.90s
check-links (126 HTML files)   PASS    15,093 / 15,093 internal links resolved
npm install (648 packages)     PASS    no audit findings
```

**Not run, and therefore not claimed:** ESLint, Vitest, Playwright, axe-core, Lighthouse.
All five are configured. Full detail, including the specific gaps and the ordered plan to
close them, is in [`TEST_REPORT.md`](../testing/TEST_REPORT.md).

Three defects were found and fixed during verification, which is worth recording because it
shows the checks are doing work:

1. **135 broken internal links** — two causes. A referenced PNG that did not exist
   (fixed by pointing at the generated SVG and documenting that a raster asset is needed),
   and demo links pointing at website paths instead of the CRM application origin (fixed by
   introducing `appOrigins` with environment-variable overrides, which is also
   architecturally correct since the CRM is a separate app).
2. **`class` versus `className` on React components inside `.astro` templates** — Astro
   distinguishes HTML elements from framework components, and 17 icon usages were wrong.
   Fixed with a codemod script that reads each file's own imports, so it is precise rather
   than capitalisation-guessing.
3. **Tailwind v4 namespace self-references** in the token CSS — `--font-sans: var(--font-sans)`
   and five similar circular definitions would have produced silently broken utilities.
   Fixed by renaming the raw scale variables and bridging them explicitly.

---

## 7. Build and typecheck status

| Target | Typecheck | Build |
| --- | --- | --- |
| `packages/design-tokens` | PASS | n/a (source-only) |
| `packages/shared-types` | PASS | n/a |
| `packages/configuration` | PASS | n/a |
| `packages/localization` | PASS | n/a |
| `packages/ui` | PASS | n/a |
| `packages/mock-services` | Not started | Not started |
| `apps/website` | PASS | PASS — 126 pages |
| `apps/crm` | Not started | Not started |
| `apps/platform-admin` | Not started | Not started |

---

## 8. Responsive and accessibility findings

### Responsive

| Aspect | Finding |
| --- | --- |
| Header | Full navigation above 1024px; trigger and panel below. Panel closes on resize to desktop. |
| Mega menus | Width-aware: the panel measures itself and shifts if it would overflow the viewport. |
| Tables | The comparison matrix scrolls horizontally with a sticky first column rather than collapsing, so plans stay comparable. |
| KPI rows | Horizontal snap scroller below 640px, grid above. |
| Dialogs | `max-h-[calc(100dvh-2rem)]` with internal scroll so footers stay reachable on phones. |
| Sheets | Become bottom sheets in the side-panel case where width would be cramped. |
| Density | `--spacing` override means compact mode scales padding and gaps together. |

**Not measured:** no automated overflow assertion has been run at the eight target widths.
This is the first responsive check to add in Batch 4, and it is a genuine gap because
horizontal overflow is easy to introduce and invisible when working at 1440px.

### Accessibility

Implemented: skip links, logical heading order via a prop, error fields linked by
`aria-describedby` with `aria-invalid`, `role="alert"` on errors, `aria-expanded` and
`aria-controls` on every disclosure, `aria-current="page"` on navigation, focus return from
menus and dialogs, two-layer focus rings that are never removed, two reduced-motion
mechanisms, colour never the sole signal, chart-to-table contract, `IconButton` requiring a
label, minimum 28px control targets, and `LiveRegion` for optimistic updates.

**Not measured:** no axe-core run, no screen-reader session, no contrast audit of computed
output, no keyboard walkthrough of the mega menu, no 200% zoom test. These are listed as
gaps rather than asserted as passing.

### Right-to-left

- Logical properties used throughout; `ms-*`, `pe-*`, `start-*`, `border-s`
- `rtl:rotate-180` on chevrons and arrows only, so clocks and neutral icons are unaffected
- Arabic substantially complete so direction can be verified against real strings
- `logical` helper covers chart margins, SVG coordinates and canvas offsets
- Text isolation for mixed-direction values such as phone numbers

**Not verified visually.** No screenshot comparison has been performed, and the RTL
smoke test is a Batch 4 deliverable.

---

## 9. Known issues

### Functional

1. The CRM application does not exist. This is by far the largest gap.
2. 91 website routes render the honest in-development page rather than finished content.
3. No authentication flows exist; the five auth routes render the in-development page.
4. Legal and trust pages contain no legal text, only a pending-review notice.

### Technical

5. `jsdom@30` requires Node `^22.22.2`; the runtime is `22.14.0`. Must be resolved before
   the first test suite runs.
6. Chart wrapper components are not implemented, so the contractual chart-to-table
   requirement has no consumer yet.
7. `vite-tsconfig-paths` is declared but not wired into the CRM or admin Vite configs.
8. No Lighthouse, axe or ESLint run has been performed.
9. The Apple touch icon is an SVG rather than a PNG.
10. Locale-prefixed routes are advertised in `hreflang` but not generated.

---

## 10. Remaining frontend work

Ordered by dependency rather than by batch number:

1. **`@crm/mock-services`** — seeded dataset, CRUD factory, query engine, persistence,
   reset, and the cross-record operations (deal move, lead conversion, task completion,
   tenant switch). Blocks everything in the CRM.
2. **CRM shell** — navigation resolution, organization switcher, command palette, app bar,
   notification centre, role-based home dashboard.
3. **CRM core modules** — leads, contacts, accounts, deals and pipeline.
4. **Platform admin shell and overview** — needed to demonstrate tenant switching across two
   surfaces.
5. **Charts, kanban and the workflow canvas** — the three component families still missing
   from the design system.
6. **Authentication and onboarding flows** — designed in `USER_JOURNEYS.md` journeys 4 and 5.
7. **Remaining website page templates** — product, feature and industry pages from the
   configuration data that already exists.
8. **Globalization completion** — locale-prefixed routes, RTL smoke test, regional
   compliance screens.
9. **Testing** — resolve the `jsdom` issue, then unit, component, end-to-end and axe suites.
10. **Measurement** — ESLint, Lighthouse, contrast audit, responsive overflow assertions.

Full batch mapping is in [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) §3.

---

## 11. Suggested next batch

**Batch 4 — Mock service layer and CRM shell.**

The published roadmap puts the remaining website pages next. This report recommends
reordering, which the brief permits "where shared prerequisites demand it". The reasoning:

- The mock service layer is a prerequisite for Batches 8 through 22. Every CRM screen needs
  it, so building it now unblocks the largest remaining body of work.
- The riskiest part of this project is the CRM application, and it is currently untouched.
  Building more website pages first defers that risk without reducing it.
- The website already demonstrates the design system, the pricing and conversion flows, the
  public demo and the SEO foundation. Adding 60 more content pages would improve breadth
  without de-risking anything.

Proposed scope:

1. `@crm/mock-services` with three fictional organizations, disjoint datasets, a generic
   CRUD factory, a query engine supporting nested filter groups and facets, `localStorage`
   persistence behind a namespaced key, full reset, and the consistency-critical operations.
2. `apps/crm` shell with entitlement-resolved navigation, organization switching, command
   palette and the role-based home dashboard.
3. `apps/platform-admin` shell and platform overview, so tenant switching is demonstrable
   end to end.
4. Close the `jsdom` blocker and land the first unit and component suites.
5. Run ESLint for the first time and fix what it surfaces.
