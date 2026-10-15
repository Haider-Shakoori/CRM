# Information Architecture — CRM Platform

> Temporary development name: **CRM Platform**. No permanent brand has been chosen; do not introduce one. This document describes the navigation, navigation chrome and URL conventions shared by the three frontend experiences: `apps/website` (Astro), `apps/crm` (React + Vite + React Router) and `apps/platform-admin` (React + Vite SPA).

| Field | Value |
| --- | --- |
| Status | Draft — implementation reference |
| Scope | Navigation models, shell chrome, persona mapping, navigation rules, URL conventions |
| Companion documents | `docs/architecture/SITEMAPS.md` (route inventory), `docs/architecture/USER_JOURNEYS.md` (task flows) |
| Backend assumption | Frontend-only for now; every data shape comes from `@crm/mock-services` and is designed to map 1:1 to a future Laravel REST API |
| Branding rule | Never invent a permanent product name, real customer logo, real testimonial or compliance certification |

---

## 1. Design principles

**Guiding philosophy: "Enterprise functionality without enterprise complexity."**
The product competes on depth — sales, marketing, service, success, revenue ops, automation, AI and tenant administration — but the interface must never feel like an administrator's toolkit. Depth is layered, not dumped. Every screen answers one primary question first and makes depth available one deliberate step away. A power user should be able to work entirely by keyboard; a first-week user should never need to open a builder, a permission matrix or a settings page to complete a daily task.

| # | Principle | What it means in practice | Testable check |
| --- | --- | --- | --- |
| P1 | Progressive disclosure | Task-critical fields, actions and metrics are visible by default; secondary controls live behind inline "More", collapsible sections, tabbed detail panes or a drawer. Nothing *required* is ever behind a disclosure. | A first-time user can complete the primary task of every screen without opening a secondary panel. |
| P2 | Simple Mode vs Advanced Mode | A per-user, per-device toggle (default: Simple) hides builders, developer surfaces, custom-object authoring and deep configuration. Advanced Mode reveals everything the role/entitlement allows. Nothing is permanently unreachable — Advanced Mode is one toggle away. | Switching modes never deletes, hides permanently or 404s data; only chrome and authoring surfaces change. |
| P3 | One cohesive system, not disconnected admin templates | Website, CRM app and platform admin share `@crm/design-tokens` and `@crm/ui`. The platform-admin console is visually related but intentionally a different console (different accent usage, denser chrome, "Platform" badge). Shell patterns — empty, loading, error, confirm, toast — are the same grammar everywhere. | The same concept (e.g. an empty list) never appears in two visually unrelated forms across the three apps. |
| P4 | Keyboard-first productivity | Every core action is reachable without a pointer: command palette (`Ctrl/Cmd+K`), `g` chord navigation, list `j`/`k` movement, `Enter` to open, `Escape` to dismiss. Focus is always visible; no hover-only affordances; shortcuts are discoverable in-product via `?`. | Every journey in `USER_JOURNEYS.md` has a documented keyboard-only path. |
| P5 | Information density with breathing room | Tables default to a comfortable density (40px rows) with a compact option (32px). The spacing scale is a 4px grid; typography carries hierarchy instead of borders everywhere. Dense ≠ cramped, airy ≠ empty. | No list screen shows more than 3 simultaneous font weights or more than 2 border colors in a row. |
| P6 | No fake success states | Toasts, checkmarks and "Saved" states appear only after the mock service resolves. Pending states are explicit ("Saving…"), failures are recoverable and never discard input. Simulations and previews are labelled as such. Disabled controls explain why. | A user can never see a success state for a mutation that did not resolve in `@crm/mock-services`. |
| P7 | Everything reusable for a future Laravel backend | `@crm/mock-services` mirrors REST resource paths and Laravel-style policies; entitlement checks mirror a module registry; permission checks mirror role policies; page state lives in the URL wherever it is shareable. No business invariant exists only in a React component. | Every module route maps to a documented mock service key and a future `/api/v1/...` resource (Section 7.5). |

### 1.1 Mode and density as independent axes

| Axis | Values | Default | Where changed | Effect |
| --- | --- | --- | --- | --- |
| Mode | Simple / Advanced | Simple | Profile menu, `/settings/appearance`, palette action | Hides builders, developer tools, custom-object authoring, deep settings |
| Density | Comfortable / Compact | Comfortable | `/settings/appearance`, palette action | Row height, padding scale, chart label density |
| Appearance | Light / Dark / System | System | Profile menu, `Shift+D`, `/settings/appearance` | Token theme |
| Language | Any enabled locale | Tenant default | Profile menu, `/settings/language`, website header | i18n strings, formatters, RTL direction |

---

## 2. Public website navigation

### 2.1 Top-level navigation model

The website header is sticky, condenses on scroll (reduced height, logo only at small widths) and collapses to a full-screen drawer under `lg`.

| # | Nav item | Pattern | Route | Contents | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Product | Mega menu | `/product` | 14 product pages grouped into Sell / Market / Serve / Platform | Every group ends with "Product overview" |
| 2 | Solutions | Mega menu (or hub link while fewer than 3 solution pages exist) | `/solutions` | Solution finder by team and need; links into product, feature and industry pages | Solutions reuse the product/feature templates |
| 3 | Industries | Mega menu | `/industries` | 12 industry pages in 3 groups: Growth, Regulated, Operations | Regulated group carries the "capabilities described, no compliance claim" label |
| 4 | Features | Mega menu | `/features` | 19 feature pages in 4 groups | Descriptions under each link |
| 5 | Pricing | Direct link | `/pricing` | Plans, comparison table, pricing calculator island | No mega menu — single destination |
| 6 | Integrations | Direct link | `/integrations` | Directory with search/filter island | No mega menu — faceted list |
| 7 | Resources | Mega menu | `/resources` | Blog, guides, tutorials, webinars, library, help center, docs, developer docs, changelog, release notes, roadmap | Largest menu; 3 columns max |
| 8 | Company | Small dropdown | `/company/about` | About, Contact, Careers, Partnerships, Affiliate program, Customer stories, Press, Brand assets | Not a mega menu (fewer than 8 stable destinations) |
| — | Contact Sales | Button (secondary) | `/company/contact?intent=sales` | — | Prefills intent |
| — | Log In | Link | CRM app `/auth/sign-in` | — | Leaves marketing site; `rel="noopener"` |
| — | Start Free Trial | Button (primary) | `/signup` | — | Dominant CTA; repeated in hero, pricing, footer |

Footer groups: Product, Solutions, Industries, Resources, Company, Legal, Trust & compliance; plus locale selector, system status badge, social/community links (generic), and the "demonstration content" notice for pages that embed synthetic data.

### 2.2 When mega menus are appropriate

Use a mega menu **only** when all of the following hold:

1. There are 8–30 stable destinations that group naturally into 2–4 columns with meaningful headings.
2. The taxonomy is unlikely to churn month to month (menus that change weekly should be flat pages instead).
3. Users scan rather than decide — the menu's job is wayfinding, not conversion.
4. Each destination has a stable, indexable hub page reachable directly (mega menus never contain the only path to a page).

Do **not** use a mega menu for: fewer than 6 destinations (use a dropdown or direct link); flat, ungroupable lists (use a faceted index page); time-sensitive promotions (use the header CTA slot); deep hierarchies that need a fourth column (use a hub page).

Current application: mega menus for **Product, Solutions, Industries, Features, Resources**; direct links for **Pricing** and **Integrations**; small dropdown for **Company**.

### 2.3 Mega menu accessibility rules

| # | Rule | Detail |
| --- | --- | --- |
| A1 | Keyboard operable | `Tab` reaches the trigger, `Enter`/`Space` opens the panel, arrow keys move between columns (Down/Up within a column, Left/Right between columns, Home/End to first/last item), `Tab` from the last item closes the panel and continues to the next header control. |
| A2 | Escape closes | `Escape` closes the open panel and returns focus to the trigger. It never closes the page, never scrolls, never bounces focus to the top of the document. |
| A3 | Focus trap management | On desktop the panel is a **non-modal disclosure**: do not trap focus; focus is allowed to leave, and leaving closes the panel after the blur grace period. If the mobile drawer implements the menu as a modal dialog, then trap focus inside, expose `role="dialog"` + `aria-modal="true"`, and restore focus to the trigger on close. |
| A4 | No hover-only interaction | Hover may open the panel only as progressive enhancement (200ms intent delay). Click, tap and keyboard toggle must always work. No destination may be reachable only by hovering. |
| A5 | ARIA state | Trigger is a `button` (or a link plus adjacent toggle for the hub page) with `aria-expanded` true/false, `aria-haspopup="true"` and `aria-controls` pointing at the panel id. The panel is labelled by its trigger. |
| A6 | One panel at a time | Opening a panel closes any other. Panels close on outside click, on route change and on `Escape`. |
| A7 | Touch and zoom | Panel fits one viewport at 1280×720 and remains usable at 200% zoom with no horizontal scrolling; touch targets ≥44px; hover-only affordances are not used to reveal hidden links. |
| A8 | Motion | Entrance animation is `opacity + 4px translate` ≤150ms and is disabled under `prefers-reduced-motion`. |
| A9 | Content parity | Every mega-menu link also exists in the footer or on a hub page, so the menu is a convenience, never the only route to content. |
| A10 | Focus visibility | Focus rings follow the shared `@crm/ui` focus token and are never suppressed for the trigger or panel items. |

---

## 3. CRM navigation structure

### 3.1 Module registry and sidebar tree

Module keys are canonical identifiers used by routing, the entitlement registry in `@crm/configuration`, the command palette and analytics. Labels are the sidebar text. Persona codes are defined in the legend below the table.

**Persona legend:** OWN = Business owner, CEO = CEO, SR = Sales representative, SM = Sales manager, SD = Sales director, MKS = Marketing specialist, MKM = Marketing manager, SA = Support agent, SVM = Service manager, AM = Account manager, CSM = Customer success manager, RVO = Revenue operations manager, FIN = Finance user, FSR = Field sales representative, OA = Org administrator, ITA = Enterprise IT administrator.

| Section | Module key | Nav label | Route | Icon (Lucide) | Personas needing it by default | Hidden in Simple Mode |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace | `home` | Home | `/home` | `LayoutDashboard` | All | No |
| Sales | `leads` | Leads | `/leads` | `UserPlus` | SR, SM, SD, AM, MKS, OA | No |
| Sales | `contacts` | Contacts | `/contacts` | `Users` | SR, SM, SD, AM, CSM, SA, FSR | No |
| Sales | `accounts` | Accounts | `/accounts` | `Building2` | SR, SM, SD, AM, CSM, SA, FSR, OWN, CEO | No |
| Sales | `deals` | Deals | `/deals` | `Target` | SR, SM, SD, AM, OWN, CEO, FIN | No |
| Sales | `partners` | Partners | `/partners` | `Handshake` | SD, AM, OA, partner-facing managers | Yes |
| Sales | `field-sales` | Field Sales | `/field-sales` | `MapPin` | FSR, SM, SD | Yes (hidden unless entitled) |
| Marketing | `campaigns` | Campaigns | `/campaigns` | `Megaphone` | MKS, MKM, RVO | No |
| Service | `tickets` | Tickets | `/tickets` | `LifeBuoy` | SA, SVM, CSM | No |
| Service | `knowledge-base` | Knowledge Base | `/knowledge` | `BookOpen` | SA, SVM, MKS, CSM | No |
| Service | `customer-success` | Customer Success | `/customer-success` | `HeartHandshake` | CSM, AM, SVM, CEO | Yes |
| Service | `portal-preview` | Portal Preview | `/portal-preview` | `MonitorSmartphone` | OA, CSM, SVM, MKM | Yes |
| Revenue | `products` | Products | `/products` | `Package` | RVO, FIN, SD, AM | No (read-only subset in Simple) |
| Revenue | `revenue-ops` | Quotes, Orders & Contracts | `/revenue/quotes` | `FileSignature` | RVO, FIN, AM, SD | Yes |
| Productivity | `activities` | Activities | `/activities` | `ListChecks` | All | No |
| Productivity | `calendar` | Calendar | `/calendar` | `CalendarDays` | SR, SM, SA, CSM, FSR, AM | No |
| Productivity | `inbox` | Inbox | `/inbox` | `Inbox` | SR, SM, SA, CSM, AM, MKM | No |
| Productivity | `projects` | Projects | `/projects` | `FolderKanban` | SVM, CSM, AM, OA | Yes |
| Productivity | `documents` | Documents | `/documents` | `FolderOpen` | All | No |
| Insights | `analytics` | Analytics | `/analytics` | `BarChart3` | SM, SD, MKS, MKM, RVO, CEO, OWN, FIN, CSM | No (authoring hidden in Simple) |
| Automation | `workflows` | Workflows | `/workflows` | `Workflow` | RVO, MKM, SVM, OA | Yes |
| Automation | `ai` | AI Assistant | `/ai` | `Sparkles` | All | No |
| Customize | `customization` | Customization | `/customization` | `Blocks` | OA, ITA, RVO | Yes |
| Customize | `templates` | Industry Templates | `/templates` | `LayoutTemplate` | OA, CEO, SD | Yes (surfaced during onboarding) |
| Customize | `integrations` | Integrations | `/integrations` | `Puzzle` | OA, ITA, RVO | Yes |
| Customize | `developer` | Developer | `/developer` | `Code2` | ITA, OA (technical), RVO | Yes |
| Admin | `org-admin` | Organization Settings | `/admin` | `Settings` | OA, ITA, OWN, CEO | Partially (organization, users only) |
| Admin | `billing` | Billing & Subscription | `/billing` | `CreditCard` | OWN, CEO, FIN, OA | No (read-only subset in Simple) |

Notes:

- `deals` is commonly called "Pipeline" in dashboards and empty states; the nav label stays "Deals" for vertical consistency with record nouns.
- `revenue-ops` renders three sibling list routes under `/revenue` (quotes, orders, contracts); the sidebar entry expands to those three.
- `portal-preview` renders the tenant's customer-portal surfaces with demonstration content and a persistent preview banner; it is never the live portal.
- Icons are suggestions from `lucide-react`; final glyph choice belongs to the design system, but each module keeps one icon everywhere (sidebar, palette, favorites, notifications).

### 3.2 Sidebar grouping

- Sections render in this order, always: **Workspace → Sales → Marketing → Service → Revenue → Productivity → Insights → Automation → Customize → Admin**.
- A section header is visible only when at least one of its children is visible to the current user (role + entitlement + mode). Empty sections collapse out entirely; they never render as dead headings.
- Favorites sit in a pinned block between Workspace and Sales; Recently viewed lives at the bottom of the sidebar, above the collapse control.
- Section order is fixed. Users personalize by pinning favorites, not by reordering the taxonomy, so that support articles and screenshots stay valid.
- The Admin section is visually separated (hairline above) because it is configuration, not daily work.

### 3.3 Collapsible sidebar behaviour

| Behaviour | Specification |
| --- | --- |
| Expanded width | 240px; section labels visible; item hit area full-width |
| Rail width | 64px icon rail; icons centered; group separators become hairline gaps |
| Toggle | Header chevron and the `[` shortcut; state persisted per user/device |
| Per-section collapse | Each section can collapse independently (chevron); state persisted; collapsed sections show a count badge of contained items on hover |
| Rail behaviour | Hover or keyboard focus on a rail icon opens a flyout with module label and its primary sub-routes; flyouts follow the mega-menu rules (A1–A10) |
| Keyboard | Up/Down moves through items; Right expands a section or enters it; Left collapses or exits; Home/End jump; the currently focused item is scrolled into view |
| Responsive | Below `lg` the sidebar becomes an overlay drawer with `Escape` to close and focus returned to the toggle; it never overlays a modal twice |
| State signals | Active route is highlighted; modules with trials show a countdown chip; locked modules show a lock glyph and route to `/not-entitled/:moduleKey` |
| No hover-only | Collapsed-mode flyouts must open on focus for keyboard users, not only on hover |

### 3.4 Workspace / organization switcher placement

- Location: sidebar header, above section groups (expanded) or at the top of the rail (collapsed). It is the first focusable control in the sidebar.
- Contents: organization avatar + name, current role badge, environment chip (`Production`, `Sandbox`), plan/trial chip when relevant.
- Dropdown lists every membership with role and (if multi-org) switch affordance; actions: "Manage organizations" (`/orgs`), "Create organization" (`/orgs/new`, entitlement-gated), "Organization settings" (`/admin/organization`, permission-gated).
- Switching organization performs a soft reload of tenant-scoped data, keeps the user's route if it exists in the target org (else lands on `/home`) and shows an explicit switch confirmation in the notification center, never a silent context change.
- Impersonated sessions (platform admin only) render a persistent amber banner with "You are viewing this organization as platform support" and an "End impersonation" action.

### 3.5 Top bar composition

Left to right, 56px height, sticky, one row at desktop:

1. Sidebar toggle (mobile: drawer trigger).
2. Breadcrumbs (detail routes) or the current page title (list routes); truncated with tooltip.
3. Global search / command palette trigger (`Ctrl/Cmd+K`, `/`), rendered as a search field at `xl` widths.
4. Quick-create `+` menu (`c`).
5. AI Assistant button (sparkle icon; opens the side panel).
6. Notification bell with unread badge.
7. Help `?` menu.
8. Language selector (only when more than one locale is enabled).
9. Theme toggle (`Shift+D`).
10. Profile avatar menu.

The top bar never contains module navigation (that is the sidebar's job) and never accumulates page-specific actions (those live in the page header, Section 6.2).

### 3.6 Command palette (`Ctrl/Cmd+K`)

Single overlay, ARIA combobox/listbox pattern, max 8 results per group, recents first when the query is empty.

| Group | Contents | Notes |
| --- | --- | --- |
| Go to | Every enabled module route, saved views, dashboards, settings pages, platform routes (in platform admin) | Respects entitlements and permissions |
| Create | Quick-create types filtered by permission and entitlement (Lead, Contact, Account, Deal, Task, Event, Ticket, Note; custom objects if pinned) | Opens quick-create modal |
| Search records | Debounced text search over entitled modules; each result shows type, owner, and a "open in new tab" affordance | Backed by the mock `search` service; degrades to per-module search if unavailable |
| Actions | Toggle theme, toggle density, toggle Simple/Advanced, switch organization, invite user (permission-gated), sign out | Destructive actions require confirmation |
| Ask AI | Sends the current query to `/ai` as a new conversation with context | Generated content is labelled |
| Help | Keyboard cheat sheet, help center links, contact support, system status | Opens in-place or new tab |

Prefix grammar: `>` filters to actions, `#` filters to records, `?` opens the keyboard cheat sheet. No prefix = mixed results in group order above.

### 3.7 Notification center

- Bell in the top bar with unread count; popover with tabs **All / Mentions / Assigned / System**; grouping by Today / Earlier.
- Item anatomy: type icon, title, actor, relative timestamp, deep link to the exact record or route.
- Mark-as-read on open; "Mark all as read"; per-type preferences link to `/settings/notifications`; full page at `/notifications`.
- New notifications announced via a polite live region, throttled to one announcement per 10 seconds; toasts are reserved for results of user-initiated actions, never for ambient notifications.
- Empty state explains which events will arrive here, with a link to notification settings.

### 3.8 Quick-create menu

- Trigger: `+` button or `c` key when no input is focused.
- Lists record types filtered by module entitlement and create permission; ordering is by user frequency, then alphabetically.
- Each item opens a lightweight modal with only the fields required to create a valid record, plus "Open full form".
- On save: pending state → mock service resolves → navigate to the new record with a back link to the origin route; failure keeps the modal open with inline errors. **No optimistic "Created" toast** unless the service confirms.

### 3.9 Favorites and recently viewed

| Surface | Behaviour | Rules |
| --- | --- | --- |
| Favorites | Star icon on records, saved views, dashboards, reports, workflows; pinned block in the sidebar | Per-user, never shared; max 30 items with a "manage" view; removal via star or from the manage view |
| Recently viewed | Last 12 records/routes for the current user; sidebar section and palette shortcuts | Stored per user in the mock preferences service; "Clear recents" action; never visible to other users; excluded from audit surfaces |
| Deep links | Both surfaces deep-link to canonical routes with preserved query state | Removing a favorite never deletes the record |

### 3.10 AI assistant entry point

- Persistent sparkle button in the top bar, an "Ask AI" group in the command palette, and contextual actions on records ("Summarize account", "Draft follow-up", "Explain this report").
- Opens a right-side panel that does not obscure the record it references; `/ai` is the full-page equivalent, and the panel may deep-link as `?ai=open` on the current route.
- Context passing is explicit: the panel header states which record/screen the assistant can see. Generated output is labelled "AI-drafted — review before use"; nothing is ever sent or saved without an explicit apply action.
- Simulation and mock-driven answers state their data source; the assistant never claims live data it cannot see.

### 3.11 Help menu

Items: In-product help search (links to website `/resources/help-center`), Keyboard shortcuts (`?`), What's new (website `/resources/changelog`), Contact support (creates a request via the mock `support` service; offers to create a ticket when `tickets` is entitled), System status (website `/trust` status section), Send feedback (mock capture). External links open in a new tab with `rel="noopener"`. Help never traps the user in a tour they did not ask for.

### 3.12 Profile menu

Avatar → display name, email, organization. Items: My profile (`/settings/profile`), Notification settings (`/settings/notifications`), Appearance (`/settings/appearance`: theme, density, mode), Language (`/settings/language`), Personal security (`/settings/security`: sessions list, sign out everywhere — mock), Switch organization (when multi-org), Sign out. Sign out is a plain confirmation; if a form has unsaved changes, the guard from Section 6.6 applies first.

### 3.13 Language selector

- Appears in the profile menu and at `/settings/language`; shows each language in its own script (e.g. "Deutsch", "العربية") with the current selection checked.
- Switching updates i18n resources (`@crm/localization`) immediately, re-formats dates/numbers/currency, and flips document direction for RTL locales (layout mirrors via logical CSS properties; charts mirror axes only where meaning is preserved).
- The choice persists to the user profile in the mock layer and is reflected on next sign-in. The website offers the same selector in the footer and header; geo-suggested language never force-redirects — it shows a dismissible banner and honours a "stay here" choice.
- Locale fallback (missing translation → tenant default → English) is visible in Advanced Mode only, as a small fallback indicator, so translators can spot gaps without distracting regular users.

### 3.14 Theme selector

Light / Dark / System, applied through `@crm/design-tokens`. Theme is applied before first paint (stored preference read early), toggled by `Shift+D`, and persisted per user and device. No theme flash on route transitions; charts and empty-state illustrations follow the theme.

### 3.15 Module enablement driven by tenant entitlements

- Source of truth: the module registry in `@crm/configuration`; each tenant carries entitlement states: `enabled`, `trial` (with end date), `locked`, `hidden`.
- Nav rendering: `enabled` and `trial` render normally (trial adds a countdown chip); `locked` renders with a lock glyph and opens `/not-entitled/:moduleKey`; `hidden` is omitted entirely and direct URLs still resolve to the not-entitled screen (never a 404, never a redirect loop).
- Dependency rules live in the registry (e.g. quotes/orders/contracts require products and deals; workflows require at least one record module). Disabling keeps data (hide, never delete) and warns when another entitled module depends on it.
- Admin surface: `/admin/modules` shows the plan/module matrix, dependency warnings and "Request change" submissions; platform-side changes arrive through the mock entitlement service and invalidate navigation queries without a full reload.
- Every entitlement-driven navigation change does not alter the URL structure; entitlements change visibility and access, not routes.

---

## 4. Platform administration navigation structure

A distinct console (`apps/platform-admin`) for SaaS platform owners. Same design tokens; denser chrome; a persistent "Platform" badge and a dev-time banner when running against mock data. Impersonation, feature flags and module catalog are the only places where platform staff touch tenant-visible behavior, and every such action is audit-logged.

| Section | Route | Console screen | Purpose |
| --- | --- | --- | --- |
| Overview | `/dashboard` | Platform dashboard | Tenant growth, MRR movement, trial watchlist, churn risk, open incidents |
| Customers | `/tenants` | Tenant directory | Search/filter by plan, status, region, owner; bulk actions; export requests |
| Customers | `/tenants/new` | Create tenant | Manual provisioning, trial configuration, founding admin invitation |
| Customers | `/tenants/:tenantId` | Tenant 360 | Tabs: overview, users, subscription, entitlements, health, activity; suspend, extend trial, impersonate, change plan |
| Customers | `/subscriptions` | Subscription operations | Lifecycle across tenants: active, trialing, past due, canceled, dunning |
| Customers | `/subscriptions/:subscriptionId` | Subscription detail | Plan, seats, dates, renewal, invoice history, entitlement snapshot, lifecycle actions |
| Customers | `/support` | Platform support inbox | Tenant-raised requests to platform staff; internal priority and assignment |
| Customers | `/support/tickets/:ticketId` | Support request detail | Thread, linked tenant, escalation, resolution notes |
| Revenue | `/plans` | Plan catalog | Plan definitions, feature/module matrix, pricing, regional availability |
| Revenue | `/plans/new`, `/plans/:planId` | Plan editor | Create/edit plan, limits, included modules, trial length, self-serve eligibility |
| Revenue | `/revenue` | Revenue overview | MRR/ARR movement, expansion, contraction, churn, collections |
| Revenue | `/revenue/invoices`, `/revenue/invoices/:invoiceId` | Invoice register | Issued invoices, failed payments, credits, refunds (mock) |
| Platform | `/feature-flags` | Feature flag list | Flags per feature, environment, rollout state, linked module |
| Platform | `/feature-flags/:flagKey` | Flag detail | Targeting rules, rollout percentage, change history, audit note |
| Platform | `/module-catalog` | Module catalog | Canonical module list, entitlement keys, dependencies, default plan inclusion |
| Platform | `/module-catalog/:moduleKey` | Module detail | Module metadata, nav label/icon defaults, availability matrix, deprecation state |
| Platform | `/localization` | Localization admin | Locale list, translation coverage, publish state, fallback chains |
| Platform | `/localization/:localeCode` | Locale detail | Per-locale string workbench, missing-key queue, RTL flag, formatter defaults |
| Platform | `/announcements` | Announcements | In-app banners and email announcements to tenants, targeting, scheduling |
| Platform | `/announcements/new`, `/announcements/:announcementId` | Announcement editor | Author, target (plan/region/locale), schedule, preview, publish/retract |
| Platform | `/notification-templates` | Notification templates | Email and in-app templates per event and locale |
| Platform | `/notification-templates/:templateId` | Template editor | Variables, locale variants, preview, test send (mock), publish state |
| Platform | `/integrations-catalog` | Integrations catalog | Curated third-party integrations, categories, regional/plan availability |
| Platform | `/integrations-catalog/:integrationKey` | Integration detail | Metadata, OAuth scopes (mock), catalog state, tenant adoption count |
| Operations | `/audit` | Platform audit log | Every platform action: actor, action, target tenant, before/after, timestamp |
| Operations | `/system-status` | System status | Region/service health, maintenance windows, communication drafts |
| Operations | `/system-status/incidents/:incidentId` | Incident detail | Timeline, affected components, tenant notifications, postmortem stub |
| Internal | `/internal-users` | Internal users | Platform staff accounts, role assignment, MFA status, session revoke (mock) |
| Internal | `/internal-users/:userId` | Internal user detail | Permissions, recent actions, access review prompt |
| Internal | `/platform-roles` | Platform roles | Least-privilege staff roles and the permission matrix |
| Internal | `/platform-roles/:roleId` | Role editor | Clone role, adjust permissions, preview effective access |
| Utility | `/sign-in`, `/session-expired`, `/access-denied` | Auth and error states | Platform staff authentication and error recovery |
| Utility | `/impersonate/:tenantId` | Impersonation start | Consent + reason capture, audit entry, then hands off to the CRM app with the impersonation banner |
| Utility | `*` → `/not-found` | Not found | Single catch-all for unknown platform routes |

Console chrome rules: sidebar sections collapsible and persisted; a global tenant context switcher is **not** present (platform staff work across tenants per screen, and scope is always visible in the page header); destructive operations use typed confirmation; every mutation writes to the audit stream with an actor and reason.

---

## 5. Persona-to-navigation matrix

Density describes the default density setting for the persona (users can change it). Widgets are the default Home dashboard blocks; all are entitlement/permission aware.

| Persona | Surface | Default landing route | Primary modules | Information density | Default widgets |
| --- | --- | --- | --- | --- | --- |
| Business owner | Website + CRM app | `/home` | home, deals, accounts, analytics, billing | Comfortable | Cash-in forecast, open pipeline value, top 5 deals, team activity snapshot |
| CEO | Website + CRM app | `/home` | home, analytics, deals, accounts, campaigns, customer-success | Comfortable | Revenue attainment vs target, forecast by team, at-risk accounts, campaign influence |
| Sales representative | CRM app | `/home` | leads, contacts, accounts, deals, activities, calendar, inbox, ai | Compact | My tasks today, my open leads, my pipeline by stage, recent records |
| Sales manager | CRM app | `/deals` (board) | deals, leads, activities, analytics, field-sales, inbox | Compact | Team pipeline by stage, slipping deals, rep activity leaderboard, forecast submission status |
| Sales director | CRM app | `/analytics` | analytics, deals, accounts, field-sales, partners, revenue-ops | Comfortable | Forecast roll-up by team, coverage ratio, win/loss reasons, territory attainment |
| Marketing specialist | CRM app | `/campaigns` | campaigns, leads, contacts, calendar, activities | Comfortable | My campaigns and tasks, audience sizes, new leads by source, channel snapshot |
| Marketing manager | CRM app | `/campaigns` | campaigns, analytics, leads, contacts | Comfortable | Campaign ROI roll-up, MQL→SQL trend, attribution by channel, audience overlap warnings |
| Support agent | CRM app | `/tickets` | tickets, inbox, knowledge-base, contacts, accounts, activities | Compact | My queue, SLA at risk, recent tickets, suggested knowledge base articles |
| Service manager | CRM app | `/tickets` (queues) | tickets, knowledge-base, analytics, projects, portal-preview | Comfortable | SLA compliance, backlog by queue, agent workload, escalation aging |
| Account manager | CRM app | `/accounts` | accounts, deals, activities, revenue-ops, customer-success, calendar | Compact | My accounts, renewal pipeline, open opportunities, account activity feed |
| Customer success manager | CRM app | `/customer-success` | customer-success, accounts, tickets, activities, projects, analytics | Compact | Portfolio health distribution, renewals due, at-risk accounts, onboarding progress |
| Revenue operations manager | CRM app | `/workflows` (`/analytics` in Simple Mode) | workflows, analytics, revenue-ops, products, customization, integrations | Compact | Automation run health, data-quality flags, forecast coverage, pipeline hygiene checks |
| Finance user | CRM app | `/billing/invoices` | billing, revenue-ops, products, analytics, accounts | Compact | Booked revenue, invoice status, quotes awaiting approval, contracts expiring |
| Field sales representative | CRM app + mobile web | `/field-sales` | field-sales, accounts, contacts, calendar, activities, deals | Compact | Today's visits, route summary, nearby accounts, visit log drafts |
| Org administrator | CRM app | `/admin/organization` | org-admin, billing, customization, integrations, templates, analytics | Comfortable | Seat and user usage, recent security events, integration health, audit highlights |
| Enterprise IT administrator | CRM app + platform console link | `/admin/security` | org-admin, developer, integrations, customization, portal-preview | Compact | SSO/security posture checklist, API and webhook health, entitlement usage, audit export queue |
| SaaS platform administrator | Platform admin | `/dashboard` | All platform-admin sections | Compact | Tenant growth, trial watchlist, MRR and churn, open incidents |

Rules:

- Landing routes are defaults, not mandates: if a persona lacks entitlement to the default route, they land on the nearest entitled workspace (`/home` as fallback), and the app records a single `fallback_landing` telemetry event.
- Density defaults are applied on first sign-in only; later user changes are never overridden by persona config.
- Widgets are named in the registry (shared with analytics workbooks) so the same widget can appear on a persona home and a custom dashboard.

---

## 6. Global navigation rules

### 6.1 Breadcrumbs

- Rendered on all detail, editor and settings routes; hidden on top-level list routes where the title is the root.
- Anatomy: `Home / {Collection} / {Record name}` — maximum 4 crumbs; parent crumbs preserve the list's query state so "back" lands on the same filtered view.
- The last crumb is the current page and is not a link (`aria-current="page"`). Middle crumbs are links. Overflow collapses to an ellipsis menu at 3+ hidden levels.
- Wrapper: `<nav aria-label="Breadcrumb">` with ordered list semantics; record names truncate at 24 chars with the full value in `title` and an accessible tooltip.
- Breadcrumbs never encode drag state, open dialogs or unsaved edits.

### 6.2 Page headers with actions

| Element | Rule |
| --- | --- |
| Title | Record name or screen name; editable inline on records the user can edit (click-to-edit with Enter/Escape) |
| Status | Record status as a chip with text label (never color-only); click opens a status menu when the user has transition permission |
| Primary action | Exactly one primary button (e.g. "Save", "Convert", "Send"); permission-disabled with explanatory tooltip when the user cannot act |
| Secondary actions | Grouped to the right; max 2 visible, the rest move into an overflow `…` menu that never contains the primary action |
| Metadata row | Owner, key dates, tags; consistent order per object type across the app |
| Sticky mode | Header actions stick on scroll for long records; the title compresses but never disappears |
| Small screens | Primary action becomes a full-width bottom bar on editors; overflow menu keeps all secondary actions |

### 6.3 Back behaviour

- Browser back restores the previous route *and* the previous list state because filters, sort, pagination, view and tab all live in the URL (Section 7.2). Scroll position is restored for list routes.
- Opening a record from a list: back returns to the same filtered list. Opening a record from a notification, palette or AI reference: back returns to the originating screen, and the record offers a "Back to {origin}" affordance when unambiguous.
- Route-backed overlays (dialogs opened via `?dialog=`): clicking a link uses `push` so back closes the dialog; opening the same overlay from the command palette uses `replace` so history does not fill with palette noise.
- Guarded navigation: when a form is dirty, back triggers the unsaved-changes guard (Section 6.6) instead of silently discarding edits.
- Back never restarts a multi-step wizard from step 1: wizard steps are routes, so back steps to the previous step with entered data intact.

### 6.4 Deep-linking requirements

| Requirement | Detail |
| --- | --- |
| Shareable state | Every filter, saved view, sort, pagination, tab, layout and comparison selection is encoded in the URL and survives a copy/paste into a new session and a new browser |
| Canonical URLs | Transient params (`dialog`, `ai`, `highlight`, `tour`) are stripped from canonical/copied links but preserved during the session; unknown params are dropped rather than silently persisting |
| Record routes | Stable, human-readable resource paths (`/deals/de_7f3k2`); IDs are opaque prefixed strings, never sequential integers |
| Cross-org links | A link to a record the viewer cannot access renders the access-denied or not-entitled screen with the original destination shown, never a blank page or a redirect loop |
| Server-shareable | Deep links must be resolvable by a cold load (respecting session), so nothing required for a screen's meaning may live only in memory |
| Print/export | Deep-linked screens are the same screens used for print/PDF export; no separate hidden export route |

### 6.5 Empty-state CTAs

Every empty state follows the same four-part pattern: **what this is → why it is empty → one primary CTA → one secondary path**. No empty state may read "No data".

| Empty context | Primary CTA | Secondary path |
| --- | --- | --- |
| True empty list (no records at all) | Create first record (respecting create permission) | Import data, view template gallery, watch a 60-second walkthrough |
| Filtered empty (records exist, none match) | Clear filters | Save this filter as a view, adjust search |
| Permission-limited empty | Request access (routes to access request flow) | View a demonstration preview where available |
| Entitlement-locked module | View plan / request upgrade | See what the module does (marketing link) |
| Search miss | Clear search, search everywhere | Create record from query text (e.g. "Create lead: Acme") |
| Offline empty | Retry when back online | Work from cached recents; queued actions explanation |

### 6.6 Unsaved-changes guards

- Any dirty form blocks navigation (in-app link, back, org switch, sign out) with a confirmation dialog: **Save / Discard / Stay**.
- Dialog names the form and, when known, the specific dirty field count; `Escape` = Stay (safe default); focus starts on Stay.
- Route-level blocker is the only interception mechanism; `beforeunload` fires for full page unloads (browser refresh/close).
- Long-form editors (notes, email composer, knowledge articles) autosave drafts to the mock service every 5 seconds and show a discreet "Draft saved 12:04" line; drafts restore from the same route after an accidental refresh.
- No guard for idempotent background saves; no modal fatigue: a guard appears once per navigation attempt.

### 6.7 Keyboard shortcuts

All shortcuts are active unless focus is inside a text input; single-letter shortcuts never fire mid-typing. The cheat sheet (`?`) is the canonical in-product reference and is generated from the shortcut registry, not hand-written docs.

| Shortcut | Scope | Purpose |
| --- | --- | --- |
| `Ctrl/Cmd + K` | Global | Open command palette |
| `/` | Global (no input focused) | Focus global search |
| `?` | Global (no input focused) | Open keyboard shortcut cheat sheet |
| `c` | Global (no input focused) | Open quick-create menu |
| `Esc` | Global | Close overlay/dialog; if none, clear search input; never discards dirty form data without the guard |
| `g h` | Global | Go to Home |
| `g l` | Global | Go to Leads |
| `g c` | Global | Go to Contacts |
| `g a` | Global | Go to Accounts |
| `g d` | Global | Go to Deals |
| `g e` | Global | Go to Calendar |
| `g i` | Global | Go to Inbox |
| `g t` | Global | Go to Activities |
| `g s` | Global | Go to Tickets |
| `g m` | Global | Go to Campaigns |
| `g r` | Global | Go to Analytics |
| `g w` | Global | Go to Workflows |
| `g b` | Global | Go to Knowledge Base |
| `g p` | Global | Go to Projects |
| `g u` | Global | Go to Organization Settings → Users |
| `j` / `k` | Lists, boards, palettes | Move focus to next/previous row |
| `Enter` | Lists, boards | Open the focused record |
| `x` | Lists | Toggle row selection for bulk actions |
| `n` | Lists | Create a new record in the current collection |
| `e` | Record pages | Edit record (when permitted) |
| `f` | Record pages | Toggle favorite |
| `m` | Record pages | Compose an email to the record's primary contact |
| `Ctrl/Cmd + Enter` | Forms | Submit/save the current form |
| `Ctrl/Cmd + S` | Escaped to app | Save with the same validation and guard rules as the primary button |
| `[` | Global | Collapse/expand sidebar |
| `Shift + D` | Global | Toggle light/dark theme |
| `Shift + ?` | Global | Toggle Simple/Advanced mode (with confirmation) |

Chord behaviour: `g` opens a chord state with a 1.5s timeout, announced in a small status hint; any non-chord key cancels.

### 6.8 How routes degrade without entitlement or permission

Checks run in order: **session → entitlement → role/permission → record visibility**. The first failing check determines the screen.

| Situation | Nav behaviour | Route behaviour | Screen shown |
| --- | --- | --- | --- |
| Module `hidden` for tenant | Omitted entirely | Direct URL still routes to `/not-entitled/:moduleKey`; never 404 | Not-entitled explanation with marketing link; no upsell nagging in Simple Mode |
| Module `locked` for tenant | Shown with lock glyph in Advanced Mode only | `/not-entitled/:moduleKey` | Module description, plan comparison snippet, "Request upgrade" (mock request), optional demonstration preview |
| Module `trial` | Normal with countdown chip | Normal | Trial banner with end date and upgrade path |
| Entitled, role lacks access | Hidden when the role has no read permission anywhere; shown otherwise | `/access-denied?from={attempted}` | Explanation, required role, "Request access" notifies org admins via mock notification; back to last allowed route |
| Entitled, read-only role | Shown; create/edit actions disabled | Detail route renders read-only | Inline banner "View only — {role} cannot edit", disabled controls with tooltips |
| Record not visible (sharing rules) | n/a | `/access-denied?from={attempted}&reason=sharing` | Same access-denied screen without leaking counts, sums or names |
| Not signed in | n/a | Redirect to app `/auth/sign-in?next={attempted}` | After sign-in, resume original destination |
| Session expired mid-action | n/a | Redirect to `/session-expired` with return path | Re-authenticate to resume; unsaved form data restored from draft |

Rules: never a blank page, never a redirect loop, never leak restricted data into breadcrumbs, counts or the palette (search results are filtered server-side by the same policy as reads).

---

## 7. URL and route conventions

### 7.1 Path naming rules

1. Lowercase, hyphenated, plural collection nouns: `/leads`, `/projects`, `/revenue/contracts`.
2. No verbs in paths for CRUD; explicit action sub-resources only when the action is a real workflow: `/leads/:leadId/convert`, `/workflows/:workflowId/simulate`.
3. One canonical location per screen; aliases are redirects only, never duplicated renders.
4. Detail routes use the resource id as the last segment: `/accounts/:accountId`.
5. Sub-areas are real path segments, not query-string state: `/revenue/quotes`, `/field-sales/visits`.
6. Settings under `/admin/*` (organization scope) and `/settings/*` (personal scope); the split is semantic: `/admin` affects others, `/settings` affects you.
7. Custom objects use the generic namespace `/records/:objectKey` (list), `/records/:objectKey/new` and `/records/:objectKey/:recordId` (detail) so tenants can add objects without new route code.
8. Route names in the router mirror module keys (`leads.list`, `leads.detail`, `deals.board`) for analytics and breadcrumb generation.

### 7.2 Query parameters

Shareable view state is always in the query string. Params are whitelisted per screen; unknown params are dropped on canonicalization.

| Param | Type | Applies to | Example | Rules |
| --- | --- | --- | --- | --- |
| `q` | string | List/search screens | `?q=acme` | Debounced 300ms; trimmed; max 120 chars; never indexable in app |
| `view` | saved view id | Lists, boards | `?view=lw_open_this_week` | Unknown id → fallback to default view with a toast |
| `layout` | `table \| board \| list \| calendar` | Screens with multiple layouts | `?layout=board` | Invalid value ignored, default used |
| `tab` | enum per object | Detail screens | `?tab=timeline` | Deep-links to a tab; default tab is omitted from canonical URL |
| `sort` | comma list, `-` prefix = desc | Lists | `?sort=-amount,close_date` | Max 3 keys; unknown keys ignored |
| `page`, `perPage` | int; enum 25/50/100/200 | Lists | `?page=2&perPage=50` | `page` is 1-based; resets when filters change |
| Filter params | typed, whitelisted per screen | Lists, boards, calendars | `?status=open&owner=me&stage=negotiation&pipeline=default&createdFrom=2026-10-01` | `me` resolves to current user; dates ISO `YYYY-MM-DD`; multi-value via comma or repetition |
| `from`, `to` | ISO date | Calendar, analytics | `?from=2026-10-13&to=2026-10-19` | Inclusive ranges; invalid range shows inline error |
| `highlight` | record id | Lists, related lists | `?highlight=de_7f3k2` | Scrolls to and pulses the row (motion-safe); stripped from canonical URL |
| `dialog` | enum | Any | `?dialog=invite-user` | Route-backed overlays; `push` when opened by click, `replace` when opened via palette |
| `ai` | `open` | Any | `?ai=open` | Opens the assistant panel without losing page context |
| `tour` | string | Onboarding surfaces | `?tour=first-deal` | Starts a guided tour; transient |

Formatting rules: parameters are alphabetically ordered in canonical URLs; empty/default values are omitted; filter chips and URL stay in sync bidirectionally (editing either updates the other without page reloads).

### 7.3 Locale prefixing for the public website

- Default locale `en` is **unprefixed** at the root (`/pricing`). Every other locale is prefixed: `/de/preise`, `/ar/الأسعار`-free ASCII slugs (`/ar/pricing` is also acceptable — keep slugs ASCII and stable; translated slugs are an optional enhancement with redirects from the ASCII slug).
- Every page emits `hreflang` alternates for all enabled locales plus `x-default` → the `en` URL; `<html lang>` and `<html dir>` are derived from `@crm/localization` (`ar`, `he`, `fa` = RTL).
- Locale-prefixed routes are statically generated for SSG pages; the locale prefix is never used for CRM apps (their locale is a user preference, not a URL segment).
- `/signup`, `/sign-in` and verification flows remain unprefixed-but-locale-aware where practical; auth links handed to the app include the locale as a query hint (`?lang=de`), because the app decides its own rendering locale.
- Moving between locales preserves the current page identity: header/footer language links map route-to-route (via the route table), never blanket-redirect to the homepage.

### 7.4 Record detail route patterns

| Pattern | Example | Notes |
| --- | --- | --- |
| `/{collection}/:recordId` | `/deals/de_7f3k2` | Canonical detail route for standard records |
| `/{collection}/:recordId/edit` | `/deals/de_7f3k2/edit` | Full-page editor; quick edits happen inline |
| `/{collection}/:recordId/{subresource}` | `/accounts/ac_2m9x/contacts` | Related lists are sub-routes or tabs; use `?tab=` when the content is a pane, a sub-route when it is a list with its own state |
| `/records/:objectKey/:recordId` | `/records/site_audit/ra_8k11` | Custom-object records; same detail chrome as built-ins |
| Module sub-area | `/revenue/contracts/ct_3k9` | Nested modules keep their prefix |
| Prefixed ids | `ld_`, `co_`, `ac_`, `de_`, `tk_`, `wp_`, `prj_`, `cmp_`, `prd_`, `qt_`, `or_`, `ct_`, `iv_`, `sv_` | Opaque base62 payload; ids never sequential, never reused |
| Stable under mode changes | `/leads/ld_7f3k2` must render identically in Simple and Advanced Mode (only chrome differs) | Deep links survive mode toggles, org switches and locale changes |

### 7.5 Mock services to future Laravel API mapping

Every screen's data comes from a named key in `@crm/mock-services`; the same key documents the future backend resource. Method shapes follow REST verbs (`list`, `get`, `create`, `update`, `remove`, custom actions), and errors follow a single envelope (`{ code, message, fieldErrors? }`) that a Laravel API can produce directly.

| Mock service key | CRM module(s) | Future REST resource (illustrative) |
| --- | --- | --- |
| `session`, `memberships`, `preferences` | Shell, org switcher, settings | `/api/v1/session`, `/api/v1/memberships`, `/api/v1/me/preferences` |
| `tenantOnboarding` | Onboarding, getting started | `/api/v1/onboarding/*` |
| `leads`, `contacts`, `accounts`, `deals` | Core CRM | `/api/v1/leads`, `/contacts`, `/accounts`, `/deals` (+ `/leads/{id}/convert`) |
| `activities`, `calendar`, `notifications` | Productivity and shell | `/api/v1/activities`, `/events`, `/notifications` |
| `inbox`, `campaigns`, `segments` | Marketing and communications | `/api/v1/threads`, `/campaigns`, `/segments` |
| `tickets`, `knowledgeBase`, `portal` | Service and portal preview | `/api/v1/tickets`, `/knowledge/articles`, `/portal-preview` |
| `customerSuccess`, `renewals` | Customer success | `/api/v1/success/portfolio`, `/renewals` |
| `products`, `quotes`, `orders`, `contracts` | Revenue operations | `/api/v1/products`, `/quotes`, `/orders`, `/contracts` |
| `projects`, `fieldSales`, `territories` | Projects and field | `/api/v1/projects`, `/visits`, `/territories` |
| `analytics`, `dashboards` | Insights | `/api/v1/reports`, `/dashboards`, `/metrics` |
| `workflows`, `automationRuns` | Automation | `/api/v1/workflows`, `/workflows/{id}/runs` |
| `assistant` | AI | `/api/v1/ai/conversations` |
| `documents`, `partners` | Documents, partners | `/api/v1/documents`, `/partners` |
| `customization`, `templates` | Customize | `/api/v1/objects`, `/fields`, `/layouts`, `/templates` |
| `integrations`, `developer` | Integrations, developer | `/api/v1/integrations`, `/api-keys`, `/webhooks` |
| `orgAdmin`, `audit`, `entitlements` | Admin and degradation | `/api/v1/users`, `/roles`, `/audit`, `/entitlements` |
| `billing`, `plans`, `usage` | Billing | `/api/v1/subscription`, `/invoices`, `/usage` |
| `search` | Palette and global search | `/api/v1/search` |
| `platform.*` (tenants, plans, subscriptions, flags, modules, localization, announcements, notificationTemplates, audit, support, status, internalUsers) | Platform admin | `/api/v1/platform/*` mirroring each console section |

Rule: no component may call HTTP directly; all access flows through these typed services so the Laravel swap is a package-level replacement, not a refactor.
