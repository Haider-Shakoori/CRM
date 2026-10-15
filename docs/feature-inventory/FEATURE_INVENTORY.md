# Feature Inventory — "CRM Platform"

**Document type:** numbered functional scope inventory for a frontend-only, multi-tenant SaaS CRM.
**Baseline date:** 2026-10-13.
**Scope of this document:** *what the product is supposed to do.* Requirement IDs are stable and intended to be referenced by design specs, mock implementations, test plans and (later) backend tickets.

> **Everything in this inventory is `Planned` unless the table row says otherwise.** At the time of writing, `apps/website`, `apps/crm` and `apps/platform-admin` contain **only package scaffolding** (`package.json`) — there is no source code to observe, so no item can honestly be described as built, skeletoned, interactive or tested. Do not assume any feature exists until its row is updated.

---

## 1. Requirement ID conventions

### 1.1 ID format

```
<DOMAIN>-<NNN>          e.g. SAL-014, ADM-032, WS-003
```

- **DOMAIN** — a three-letter (occasionally four-letter) code for one functional domain. The domain list is fixed; new domains require a document revision, not an ad-hoc code.
- **NNN** — a zero-padded, monotonically increasing integer within the domain. **IDs are never re-used and never renumbered**, even if the requirement is deleted, deferred or split; a removed item is marked with a status of its own or is superseded via a note in the description.
- **Splitting** a requirement (e.g. `SAL-014` becomes two items) creates new IDs (`SAL-047`, `SAL-048`) and leaves a forwarding note on the original; it never produces `SAL-014a`.
- **Cross-domain dependencies** are written as plain ID references in the description (e.g. "depends on `CUS-004`").

### 1.2 Domain codes

| Code | Domain | Code | Domain |
|---|---|---|---|
| `WS` | Website / marketing site | `COL` | Collaboration |
| `ID` | Identity & onboarding | `DOC` | Documents |
| `SAL` | Sales (leads, contacts, accounts, deals) | `CUS` | Customization & custom objects |
| `SPD` | Sales productivity | `IND` | Industry templates |
| `UC` | Unified communications | `PRM` | Partner relationship management |
| `MA` | Marketing automation | `POR` | Customer self-service portal |
| `CS` | Customer support | `ADM` | Organization administration |
| `CSM` | Customer success | `GLO` | Globalization |
| `PRO` | Products & revenue operations | `TEN` | Multi-tenancy |
| `PRJ` | Projects & delivery | `BIL` | Subscriptions & billing |
| `FLD` | Field sales & territory | `OPS` | Platform-owner admin |
| `BI` | Analytics & BI | `MKT` | Integration marketplace |
| `WF` | Workflow automation | `DEV` | Developer platform |
| `AI` | AI assistant | | |

### 1.3 Attribute definitions

| Attribute | Allowed values | Meaning |
|---|---|---|
| **Priority** | `Must` / `Should` / `Could` | `Must` = release-1 scope for the surface it lives on; `Should` = next; `Could` = backlog / differentiator |
| **Target surface** | `Website` \| `CRM` \| `Platform Admin` \| `Portal` | Which first-party app owns the experience; a row may legitimately list two (e.g. `CRM + Portal`) when the same capability appears on both sides of the tenant boundary |
| **Personas** | See §1.4 | Who the requirement serves (primary first) |
| **Build status** | `Planned` \| `UI skeleton` \| `Interactive mock complete` \| `Tested` \| `Backend integration pending` | Lifecycle position of the *frontend* deliverable |

**Status semantics used in this repository:**

- `Planned` — specified, not started.
- `UI skeleton` — layout/routing exists with placeholder content; no behaviour.
- `Interactive mock complete` — full local behaviour against mock services (create/edit/filter/simulate), no server calls.
- `Tested` — covered by automated tests against mock services.
- `Backend integration pending` — frontend is complete and the only remaining work is wiring a real service. **No row may reach this status in a frontend-only project unless the item's real-service behaviour is explicitly out of scope** (§2) and the row is annotated accordingly.

### 1.4 Persona shorthand

`TA` Tenant Admin · `SR` Sales Rep · `SM` Sales Manager · `SDR` Lead-gen Rep · `SA` Support Agent · `SUP` Support Manager · `CSM` Customer Success Manager · `MM` Marketing Manager · `REV` RevOps/Ops · `FIN` Finance · `FR` Field Rep · `PM` Partner Manager · `DEL` Delivery Manager · `EXEC` Executive · `PO` Platform Owner (our own staff) · `CUST` End Customer · `PART` Partner · `DEV` Developer/Integrator.

---

## 2. Out of scope (frontend-only project)

This document describes the **product surface**, not a full-stack system. The following are explicitly **not built here** and must be represented honestly in the UI:

| Not built | What the frontend must do instead |
|---|---|
| **Laravel / MySQL (or any) backend + database** | All state lives in `packages/mock-services` and local stores; every persistence action is a mock with a visible "demo data" indicator where the distinction matters. |
| **Real authentication** | Signup/login exist as UI flows only. Sessions are simulated; there is no password hashing, no session tokens, no server validation. |
| **Real payments / billing** | Plans, invoices, seats, usage meters and upgrades are fully interactive against fixtures. **No card form may accept or transmit real card data**, and no payment is ever "captured". |
| **Real OAuth / third-party authorisation** | Connector screens demonstrate scopes, consent, sync status and error states. No external authorisation is performed; the connect button must land on a clearly labelled simulated flow. |
| **Real email / SMS / WhatsApp / telephony delivery** | Inbox, composer, campaign sender, dialler and messaging UIs produce *simulated* events. No message leaves the device. Labels such as "demo send", "not delivered" or a persistent demo banner are required. |
| **Real AI inference** | Assistant, summarisation, scoring, forecasting and insight surfaces return scripted or fixture-derived output. AI output must be labelled as simulated and must never be presented as a real model result. |
| **GPS tracking / route optimisation / geofencing** | Map and territory views are illustrative; coordinates are fixtures. No device location is requested. |
| **E-signature with legal validity** | Document signing flows are simulations. No signature pad, audit certificate or completion claim may imply legal enforceability. |
| **Production webhooks / outbound API calls / scheduled jobs** | Event logs, retry queues, rate-limit meters and schedulers are fixtures with a replay/dry-run affordance. Nothing is dispatched. |
| **Real file uploads to object storage** | File pickers, drag-drop zones and attachment lists are mocked; large-file, virus-scan and quota states are simulated copy only. |

> **Hard rule: the frontend must never fake success for these.** No toast, badge, email preview, invoice total, call log, signature or AI answer may claim that a real out-of-scope action happened. If a user would reasonably believe something real occurred, it is a defect — use explicit simulated-state copy, a persistent demo-mode indicator, and a "what would happen in production" hint where it helps comprehension.

---

## 3. Functional inventory

### 3.1 Website / marketing site — `WS`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| WS-001 | Marketing homepage | Public landing page presenting the product value proposition, target segments and a primary trial call to action. | Must | Website | PO, CUST | Planned |
| WS-002 | Product overview pages | One page per product domain (sales, service, marketing, platform) with capability explanations and screenshots of our own UI. | Must | Website | PO, CUST | Planned |
| WS-003 | Pricing page with public list prices | Publishes all plan names, prices, seat rules, AI caps and add-ons without requiring a sales conversation. | Must | Website | CUST, FIN | Planned |
| WS-004 | Plan comparison matrix | Side-by-side feature comparison across plans with explicit "not included" states rather than omissions. | Must | Website | CUST | Planned |
| WS-005 | Free-trial signup entry | Trial form capturing email, company name, tenant subdomain and intended team size, with inline validation. | Must | Website | CUST | Planned |
| WS-006 | Guided product tour | Scripted in-page walkthrough of the core pipeline, inbox and reporting surfaces using demo data. | Should | Website | CUST | Planned |
| WS-007 | Solution / use-case pages | Segment pages (SMB, mid-market, services, retail, B2B distribution) mapping capabilities to common workflows. | Should | Website | PO, CUST | Planned |
| WS-008 | Add-on catalogue pages | Documents optional modules with their prices, prerequisites and plan compatibility. | Should | Website | CUST, FIN | Planned |
| WS-009 | Documentation home | Entry point to product documentation, with searchable navigation and version selector. | Should | Website | CUST, DEV | Planned |
| WS-010 | Help centre & FAQ | Searchable FAQ covering onboarding, billing, security posture and demo-mode limitations. | Must | Website | CUST | Planned |
| WS-011 | Trust & security page | States what the platform does and does not do today (including simulated integrations) without unverifiable certifications. | Must | Website | TA, CUST | Planned |
| WS-012 | Accessibility statement | Publishes our WCAG 2.2 AA target, known gaps, contact route and last-reviewed date. | Must | Website | TA, CUST | Planned |
| WS-013 | Roadmap / changelog | Public changelog of shipped UI increments and a clearly labelled "planned" roadmap. | Should | Website | CUST, PO | Planned |
| WS-014 | Contact & demo request | Form routing demo requests to a simulated pipeline with clear confirmation copy. | Must | Website | CUST | Planned |
| WS-015 | Legal pages | Terms, privacy notice, cookie notice and sub-processor list, written for a demo product with no real data processing. | Must | Website | TA, CUST | Planned |
| WS-016 | Industry landing pages | Template-driven pages per vertical reusing `IND` templates and industry copy blocks. | Could | Website | CUST, MM | Planned |
| WS-017 | Partner programme page | Explains the partner/reseller programme shape and links to partner application. | Could | Website | PART, PM | Planned |
| WS-018 | Blog / resources hub | Article index with categories, tags, estimates reading time and newsletter capture (capture is simulated). | Could | Website | MM, CUST | Planned |

### 3.2 Identity & onboarding — `ID`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| ID-001 | Tenant signup flow | Multi-step creation of a tenant workspace including subdomain choice, plan selection and admin identity. | Must | Website | TA | Planned |
| ID-002 | Dummy sign-in | Credential entry with validation that never leaves the browser, plus a documented demo-credential panel. | Must | CRM + Platform Admin | TA, SR, PO | Planned |
| ID-003 | Simulated SSO entry | SSO button flow that demonstrates redirect, consent and error states without contacting an identity provider. | Should | CRM | TA, SR | Planned |
| ID-004 | Password reset journey | Request, "email sent" and reset screens that explicitly state no email is dispatched in demo mode. | Should | CRM | TA, SR | Planned |
| ID-005 | Invite acceptance | Invite link handling, seat preview and profile completion for a newly invited user. | Must | CRM | TA, SR, SA | Planned |
| ID-006 | Onboarding checklist | Persistent, dismissible first-run checklist tracking tenant setup, data import and first deal creation. | Must | CRM | TA | Planned |
| ID-007 | Guided data import in onboarding | Wizard that imports a sample CSV, maps fields and reports row-level problems. | Must | CRM | TA, REV | Planned |
| ID-008 | Sample data seeding | One-click generation of a realistic demo dataset scoped to the tenant, with clear demo-data labelling. | Must | CRM | TA, PO | Planned |
| ID-009 | Workspace personalisation step | Capture of industry, currency, timezone, week start and language defaults during onboarding. | Must | CRM | TA | Planned |
| ID-010 | Role selection for invited users | Assigns a role preset during invite so permissions are correct before first login. | Must | CRM | TA | Planned |
| ID-011 | Trial status banner | Shows days remaining, plan entitlements and the upgrade path without blocking work. | Must | CRM | TA, EXEC | Planned |
| ID-012 | Demo-mode switch | Explicit, per-session toggle that surfaces which surfaces are simulated and lets reviewers reveal technical notes. | Should | CRM + Platform Admin | PO, DEV | Planned |
| ID-013 | MFA enrolment screen | Authenticator/backup-code setup presented as a mock with a "not enforced in demo" notice. | Could | CRM | TA | Planned |
| ID-014 | Profile & preferences | Per-user name, avatar seed, timezone, notification preferences and default landing surface. | Must | CRM | SR, SA, MM | Planned |
| ID-015 | Tenant switcher | Allows a user who belongs to multiple tenants to switch context with a clear visual boundary per tenant. | Must | CRM + Platform Admin | TA, PO | Planned |
| ID-016 | Offboarding flow | Deactivating a user, reassigning ownership of their records and revoking their access. | Should | CRM | TA | Planned |

### 3.3 Sales — `SAL`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| SAL-001 | Contacts list | Filterable, sortable, savable contact list with column configuration and bulk actions. | Must | CRM | SR, SM | Planned |
| SAL-002 | Contact detail record | Contact profile with timeline, deals, consent, files, related contacts and owner. | Must | CRM | SR, SA | Planned |
| SAL-003 | Contact create/edit form | Inline and full-form creation with required-field rules, validation and duplicate warning. | Must | CRM | SR, SDR | Planned |
| SAL-004 | Contact ownership & assignment | Change owner individually or in bulk with reassignment history. | Must | CRM | SM, REV | Planned |
| SAL-005 | Contact merge | Merge two contacts with a field-by-field winner picker and a merge audit entry. | Should | CRM | REV, SR | Planned |
| SAL-006 | Contact consent & communication preferences | Records lawful basis, channel consent and do-not-contact flags consumed by marketing and inbox surfaces. | Should | CRM | MM, SR | Planned |
| SAL-007 | Companies list | Company list with filters for industry, size band, owner, revenue range and open-deal count. | Must | CRM | SR, SM | Planned |
| SAL-008 | Company detail record | Company profile with hierarchy, contacts, deals, tickets, files and activity roll-up. | Must | CRM | SR, SA, CSM | Planned |
| SAL-009 | Company hierarchy | Parent/child account relationships with roll-up metrics and navigation between levels. | Should | CRM | SM, CSM | Planned |
| SAL-010 | Lead list & inbox | Lead queue with source, score, age, owner and quick actions (call, email, convert, disqualify). | Must | CRM | SDR, SR | Planned |
| SAL-011 | Lead capture from web forms | Maps website form submissions into leads with source, UTM and consent captured. | Must | CRM + Website | MM, SDR | Planned |
| SAL-012 | Lead qualification criteria | Configurable qualification fields (budget, authority, need, timing) with per-pipeline variants. | Should | CRM | SDR, SM | Planned |
| SAL-013 | Lead conversion | Converts a lead into contact + company + deal without data loss and with a conversion log. | Must | CRM | SDR, SR | Planned |
| SAL-014 | Lead routing rules | Rule-based assignment by territory, industry, size, round-robin or named owner with a test mode. | Must | CRM | SM, REV | Planned |
| SAL-015 | Lead disqualification & recycle | Disqualification reasons, nurture/recycle queue and timed return to the active queue. | Should | CRM | SDR | Planned |
| SAL-016 | Deals list | Deal list with stage, value, probability, close date, owner, pipeline and staleness indicators. | Must | CRM | SR, SM | Planned |
| SAL-017 | Deal detail record | Deal workspace with stage rail, contacts, products, quotes, activity, files and next step. | Must | CRM | SR | Planned |
| SAL-018 | Stage model & required fields | Configurable stages with entry/exit rules, required fields and stage-change reasons. | Must | CRM | REV, SM | Planned |
| SAL-019 | Kanban board | Drag-and-drop deal board grouped by stage with column totals and per-column sorting. | Must | CRM | SR, SM | Planned |
| SAL-020 | Stage transition rules | Guards that prevent invalid stage moves and explain what is missing before the move is allowed. | Must | CRM | REV, SR | Planned |
| SAL-021 | Multiple pipelines | Support for several pipelines per tenant with per-pipeline stages, fields and permissions. | Must | CRM | REV, SM | Planned |
| SAL-022 | Deal rot / staleness alerts | Detects deals with no activity past a threshold and surfaces them in a follow-up queue. | Should | CRM | SR, SM | Planned |
| SAL-023 | Deal teams & split ownership | Multiple collaborators on a deal with roles and optional revenue split preview. | Should | CRM | SM, REV | Planned |
| SAL-024 | Products on deals | Add catalogue products with quantity, unit price, discount and computed line totals. | Must | CRM | SR, FIN | Planned |
| SAL-025 | Deal scoring | Deterministic, explainable deal score with contributing factors and a manual override rationale. | Should | CRM | SM, SR | Planned |
| SAL-026 | Deal cloning & templates | Clone a deal (with or without products) and save deal templates for repeatable motions. | Could | CRM | SR | Planned |
| SAL-027 | Lost reason analysis | Structured loss reasons with reporting by reason, competitor and stage. | Should | CRM | SM, EXEC | Planned |
| SAL-028 | Activity capture on records | Logs calls, emails (simulated), meetings, notes and tasks against the right record automatically from the UI. | Must | CRM | SR, SA | Planned |
| SAL-029 | List view bulk operations | Multi-select edit, owner change, tag, stage move, export and delete with confirmation summaries. | Must | CRM | SR, SM | Planned |
| SAL-030 | Record timeline & audit trail | Unified, filterable history of field changes, emails, calls, notes, files and system events per record. | Must | CRM | SR, REV, TA | Planned |

### 3.4 Sales productivity — `SPD`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| SPD-001 | Task list & to-dos | Personal task list with due dates, priorities, linked records and quick completion. | Must | CRM | SR, SDR | Planned |
| SPD-002 | Calendar (month/week/day) | Calendar combining tasks, meetings, deal milestones and campaign sends with drag-to-reschedule. | Must | CRM | SR, SA | Planned |
| SPD-003 | Meeting scheduler | Shareable booking page with availability rules that creates a mock meeting record on selection. | Should | CRM + Website | SR, CUST | Planned |
| SPD-004 | Email templates | Reusable templates with merge tokens, preview against a record and team/private scope. | Must | CRM | SR, SDR | Planned |
| SPD-005 | Email sequence builder | Multi-step cadence with waits, branches, exit criteria, throttles and a per-step preview. | Should | CRM | SDR, MM | Planned |
| SPD-006 | Sequence enrolment | Enrol contacts or leads into a sequence, with a full list of active enrolments and pause/resume controls. | Should | CRM | SDR | Planned |
| SPD-007 | Email tracking states | Simulated open/click/reply/bounce states with honest "simulated" labelling and per-recipient history. | Should | CRM | SDR, SR | Planned |
| SPD-008 | Power dialler queue | Sequential call queue with next-record preview, disposition capture and keyboard-first controls. | Could | CRM | SDR | Planned |
| SPD-009 | Call notes & disposition | Structured call outcome capture that writes to the record timeline. | Must | CRM | SR, SDR | Planned |
| SPD-010 | Sales playbooks | Step-by-step playbooks for discovery, demo, negotiation and renewal with completion tracking. | Should | CRM | SR, SM | Planned |
| SPD-011 | Guided next-best actions | Deterministic suggestion panel (overdue task, stale deal, unanswered message, upcoming renewal). | Should | CRM | SR | Planned |
| SPD-012 | Quota & target tracker | Personal and team quota progress bars driven by deal totals and forecast adjustments. | Should | CRM | SR, SM | Planned |
| SPD-013 | Personal dashboard | "My day" workspace surfacing today's tasks, meetings, hot deals and unanswered messages. | Must | CRM | SR, SDR | Planned |
| SPD-014 | Snippet library | Reusable text snippets (pricing, objection handling, onboarding) available in the composer. | Could | CRM | SR, SDR | Planned |
| SPD-015 | Document share tracking | Share a document link and display simulated view/engagement states against the record. | Could | CRM | SR | Planned |
| SPD-016 | Keyboard command palette | Global ⌘K palette for navigation, record search, create actions and settings jumps. | Should | CRM | SR, SA, TA | Planned |

### 3.5 Unified communications — `UC`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| UC-001 | Shared team inbox | Tenant-wide inbox combining channels with assignment, status, priority and unread semantics. | Must | CRM | SA, SR | Planned |
| UC-002 | Channel: email | Email threads with threading, attachments, canned replies and reply/forward states (simulated delivery). | Must | CRM | SA, SR | Planned |
| UC-003 | Channel: web chat | Live-chat transcript view with visitor identity matching to contacts and handover to tickets. | Should | CRM + Portal | SA | Planned |
| UC-004 | Channel: SMS | SMS thread view with opt-out handling and character/segment counting (simulated sending). | Should | CRM | SA, MM | Planned |
| UC-005 | Channel: WhatsApp | WhatsApp-style conversation view with template messages and a clearly simulated transport. | Should | CRM | SA, SDR | Planned |
| UC-006 | Channel: social | Aggregated social mentions/DMs with routing to tickets or leads. | Could | CRM | MM, SA | Planned |
| UC-007 | Unified conversation timeline per contact | All channel threads for a contact merged into one chronological view. | Must | CRM | SA, SR | Planned |
| UC-008 | Assignment & routing rules | Queue routing by skill/team/availability with load balancing preview and a simulation mode. | Must | CRM | SUP, REV | Planned |
| UC-009 | Conversation statuses | Open / pending / waiting-on-customer / snoozed / resolved with SLA-aware ageing. | Must | CRM | SA, SUP | Planned |
| UC-010 | Canned responses | Shared, permission-scoped reply library with variables and usage analytics. | Should | CRM | SA, SUP | Planned |
| UC-011 | Softphone panel | Dialler UI with keypad, mute, hold, transfer and wrap-up — never places a real call. | Should | CRM | SR, SA | Planned |
| UC-012 | Call log | Inbound/outbound/voicemail records with duration, disposition and record linkage. | Must | CRM | SR, SA | Planned |
| UC-013 | Voicemail transcription (simulated) | Displays a fixture transcript with an explicit "simulated transcription" label. | Could | CRM | SA | Planned |
| UC-014 | Internal notes & @mentions in threads | Private notes distinguishable from customer-visible messages, with mention notifications. | Must | CRM | SA, SR | Planned |
| UC-015 | Contact-level channel preferences | Which channels a contact consents to, preferred language and do-not-contact flags. | Should | CRM | SA, MM | Planned |
| UC-016 | Supervisor wallboard | Live queue metrics (volume, waiting, ageing, agent load) built from simulated event streams. | Should | CRM | SUP | Planned |
| UC-017 | Message templates for compliance | Pre-approved outbound templates (opt-in phrasing, unsubscribe) required for bulk channels. | Should | CRM | MM, SUP | Planned |
| UC-018 | Channel health status | Per-connector status with "simulated / not connected" truth states and reconnection guidance. | Must | CRM | TA, SUP | Planned |

### 3.6 Marketing automation — `MA`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| MA-001 | Email campaign builder | Block-based email composer with subject/preheader, personalisation tokens and a device preview. | Must | CRM | MM | Planned |
| MA-002 | Audience selector | Choose recipients from saved segments with send-size preview and suppression rules applied. | Must | CRM | MM | Planned |
| MA-003 | Test send & proofing | Sends a preview to a chosen address in simulation and lists validation results (links, tokens, images). | Should | CRM | MM | Planned |
| MA-004 | Send schedule & throttling | Schedule sends, set send windows and cap hourly volume, with a countdown and cancel window. | Must | CRM | MM | Planned |
| MA-005 | Campaign record | Campaign object holding goals, budget, members, assets, results and an owner. | Must | CRM | MM | Planned |
| MA-006 | Campaign membership & progression | Add/remove members with statuses (sent, opened, clicked, replied, converted) and manual overrides. | Must | CRM | MM | Planned |
| MA-007 | Segmentation builder | AND/OR rule builder over contact/company/deal fields with live count and save/share. | Must | CRM | MM, REV | Planned |
| MA-008 | Dynamic segment refresh | Scheduled recomputation with last-refresh timestamp and membership-change log. | Should | CRM | MM | Planned |
| MA-009 | Journey canvas | Visual journey editor with triggers, waits, branches, goals and suppression, plus validation. | Should | CRM | MM | Planned |
| MA-010 | Journey enrollment & exit | Enrolment sources, re-enrolment rules, goal exits and per-node analytics. | Should | CRM | MM | Planned |
| MA-011 | Landing page builder | Page composer with sections, forms, thank-you state and publish/unpublish — no real hosting. | Should | CRM + Website | MM | Planned |
| MA-012 | Form builder | Drag-drop form fields with mapping to CRM fields, consent capture and spam-control settings. | Must | CRM + Website | MM | Planned |
| MA-013 | Campaign attribution | First-touch, last-touch and linear attribution views with source drill-down per deal. | Should | CRM | MM, EXEC | Planned |
| MA-014 | Campaign ROI dashboard | Spend vs. influenced pipeline vs. won revenue with editable cost inputs and assumptions shown. | Should | CRM | MM, FIN | Planned |
| MA-015 | A/B test setup | Variant split for subject line or content with winner criteria and a simulated significance readout. | Could | CRM | MM | Planned |
| MA-016 | Lead nurture scoring | Engagement score combining email, web, chat and form actions, with decay rules. | Should | CRM | MM, SDR | Planned |
| MA-017 | Suppression & unsubscribe handling | Global and per-campaign suppression lists with a visible unsubscribe-state banner on records. | Must | CRM | MM, TA | Planned |
| MA-018 | Marketing calendar | Cross-channel calendar of campaigns, journeys, launches and content with overlap warnings. | Should | CRM | MM | Planned |
| MA-019 | Content/asset library | Reusable images, blocks, templates and snippets with usage references and version history. | Should | CRM | MM | Planned |
| MA-020 | Channel: social publishing | Draft, approve and "schedule" social posts with an explicitly simulated publish state. | Could | CRM | MM | Planned |

### 3.7 Customer support — `CS`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| CS-001 | Ticket list & views | Filterable ticket queue with saved views (mine, unassigned, breaching, escalated, by customer). | Must | CRM | SA, SUP | Planned |
| CS-002 | Ticket detail workspace | Ticket with requester context, conversation thread, SLA timer, linked records and side panel. | Must | CRM | SA | Planned |
| CS-003 | Ticket creation (internal & inbound) | Create from the UI or from a simulated inbound email/web form, with required fields per queue. | Must | CRM | SA, CUST | Planned |
| CS-004 | Queues & teams | Queue definitions with membership, visibility rules, default priorities and assignments. | Must | CRM | SUP, TA | Planned |
| CS-005 | Priority & severity model | Configurable priority matrix combining impact and urgency with default calculations. | Should | CRM | SUP, REV | Planned |
| CS-006 | Categorisation & tags | Hierarchical categories (product area, issue type) plus free tags, with required-category rules. | Must | CRM | SA, SUP | Planned |
| CS-007 | SLA policies | Response/resolution targets per priority and channel, with business hours and calendar handling. | Must | CRM | SUP, REV | Planned |
| CS-008 | SLA breach & pause logic | Pause on customer-waiting, warn before breach, record breaches and surface them in reporting. | Must | CRM | SUP, SA | Planned |
| CS-009 | Escalation rules | Time- and priority-based escalation to a queue, a person or a manager with an audit entry. | Should | CRM | SUP | Planned |
| CS-010 | Macros | Multi-action macros (status, priority, tags, reply template, assignment) applied in one step. | Should | CRM | SA | Planned |
| CS-011 | Knowledge base authoring | Article editor with categories, review dates, internal/external visibility and version history. | Must | CRM + Portal | SA, SUP | Planned |
| CS-012 | Article suggestions in tickets | Surfaces likely-relevant articles from title and body keywords (rule-based, explicitly not AI). | Should | CRM | SA | Planned |
| CS-013 | Ticket-to-problem/incident linking | Link many tickets to a parent incident with bulk status propagation. | Should | CRM | SUP | Planned |
| CS-014 | Sentiment & CSAT capture | Survey send on resolve (simulated) and CSAT/NPS results attached to ticket and agent. | Should | CRM | SUP | Planned |
| CS-015 | Agent performance reporting | Volume, first response, resolution time, reopen rate, CSAT and backlog ageing per agent/team. | Must | CRM | SUP, EXEC | Planned |
| CS-016 | Ticket timeline & internal notes | Chronological history including field changes, assignments, escalations and private notes. | Must | CRM | SA, SUP | Planned |
| CS-017 | Bulk ticket actions | Multi-select status, priority, assignment, tag and merge operations with confirmation preview. | Should | CRM | SA, SUP | Planned |
| CS-018 | Ticket merge & split | Merge duplicate tickets and split unrelated issues while preserving history and links. | Could | CRM | SA | Planned |
| CS-019 | Entitlements & contracts | Customer entitlement rules (support tier, hours, response targets) applied automatically to tickets. | Should | CRM | SUP, FIN | Planned |
| CS-020 | Service desk configuration | Admin surface for queues, SLAs, categories, statuses, macros and business calendars. | Must | CRM | SUP, TA | Planned |

### 3.8 Customer success — `CSM`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| CSM-001 | Customer health score | Configurable weighted health model combining usage, support, sentiment and commercial signals. | Must | CRM | CSM, EXEC | Planned |
| CSM-002 | Health score drivers | Explains each score with contributing factor values and trend direction. | Should | CRM | CSM | Planned |
| CSM-003 | Account book of business | CSM's portfolio view with health, ARR, renewal date, open tickets and risk flags. | Must | CRM | CSM | Planned |
| CSM-004 | Success plans | Structured plan per account with objectives, milestones, owners and progress. | Should | CRM | CSM, CUST | Planned |
| CSM-005 | Renewal pipeline | Renewal opportunities with notice dates, forecast categories and uplift/downgrade scenarios. | Must | CRM | CSM, FIN | Planned |
| CSM-006 | Churn risk flags | Deterministic risk indicators (health drop, ticket spike, no login, late payment) with explanations. | Should | CRM | CSM | Planned |
| CSM-007 | Playbook automation for at-risk accounts | Triggers a defined intervention playbook when a risk flag fires. | Should | CRM | CSM | Planned |
| CSM-008 | Expansion signals | Flags usage above entitlement, multi-product interest and cross-sell candidates with a rationale. | Should | CRM | CSM, SR | Planned |
| CSM-009 | QBR workspace | Quarterly business review builder assembling metrics, tickets, usage and roadmap items. | Could | CRM | CSM | Planned |
| CSM-010 | Customer onboarding tracker | Milestone tracking for new customers (kick-off, setup, first value, adoption check). | Should | CRM | CSM, DEL | Planned |
| CSM-011 | Survey roll-ups | NPS/CSAT history per account with response drill-down and trend chart. | Should | CRM | CSM, SUP | Planned |
| CSM-012 | Escalation register | Open escalations for an account with owners, severity, next action and resolution notes. | Should | CRM | CSM, SUP | Planned |

### 3.9 Products & revenue operations — `PRO`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| PRO-001 | Product catalogue | Product records with SKU, description, status, category and default pricing. | Must | CRM | REV, FIN | Planned |
| PRO-002 | Price books | Multiple price books per tenant with currency, effective dates and applicability rules. | Must | CRM | FIN, REV | Planned |
| PRO-003 | Discount rules | Percentage/fixed discount limits by role, with approval thresholds. | Should | CRM | FIN, SM | Planned |
| PRO-004 | Quote builder | Quote editor assembling line items, taxes, terms and a print-ready preview. | Must | CRM | SR, FIN | Planned |
| PRO-005 | Quote versioning | Immutable quote versions with a diff between versions and a status history. | Should | CRM | SR, FIN | Planned |
| PRO-006 | Quote approval flow | Approval routing by discount, value or non-standard terms with approve/reject and comments. | Should | CRM | SM, FIN | Planned |
| PRO-007 | Quote templates | Branded templates with configurable terms, blocks and signature area (signature is simulated). | Should | CRM | REV, MM | Planned |
| PRO-008 | Orders | Order records created from accepted quotes with fulfilment status and owner. | Should | CRM | FIN, DEL | Planned |
| PRO-009 | Invoices | Invoice list and detail with statuses (draft, issued, paid, overdue), all values simulated. | Should | CRM | FIN | Planned |
| PRO-010 | Subscription objects | Recurring products with term, billing frequency, quantity and renewal settings. | Should | CRM | FIN, CSM | Planned |
| PRO-011 | Recurring revenue view | MRR/ARR roll-up by account, product, owner and cohort with change decomposition. | Should | CRM | EXEC, FIN | Planned |
| PRO-012 | Payment-link mock | Generates a demo payment link record and a "would open provider checkout" explanation. | Could | CRM | FIN, SR | Planned |
| PRO-013 | Tax configuration | Tax rates per region/product with inclusive/exclusive handling in quotes and invoices. | Should | CRM | FIN | Planned |
| PRO-014 | Contract records | Contract object holding term, value, entitlements, renewal date and attached documents. | Should | CRM | FIN, CSM | Planned |
| PRO-015 | Revenue recognition flags | Simple deferred/recognised split preview for reporting, clearly marked as indicative only. | Could | CRM | FIN | Planned |
| PRO-016 | Product usage metrics | Metered quantities by account with entitlement comparison and overage warnings. | Could | CRM | CSM, FIN | Planned |

### 3.10 Projects & delivery — `PRJ`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| PRJ-001 | Project records linked to deals | Project created from a won deal carrying scope, owner and customer links. | Should | CRM | DEL, SR | Planned |
| PRJ-002 | Task boards | Kanban and list task views with assignee, status, priority, due date and dependencies. | Should | CRM | DEL | Planned |
| PRJ-003 | Milestones & phases | Project phases with milestone dates, deliverable checklists and completion criteria. | Should | CRM | DEL, CSM | Planned |
| PRJ-004 | Effort & time entries | Lightweight time logging per task with weekly totals and billable/non-billable flags. | Could | CRM | DEL, FIN | Planned |
| PRJ-005 | Project health & RAG status | Delivery RAG derived from schedule variance, blocked tasks and milestone slippage. | Should | CRM | DEL, EXEC | Planned |
| PRJ-006 | Customer-visible delivery view | Portal page showing milestones, open items and approvals without internal notes. | Should | Portal | CUST, DEL | Planned |
| PRJ-007 | Delivery notifications | Digest and event notifications to the project team and customer contact (simulated). | Could | CRM + Portal | DEL | Planned |
| PRJ-008 | Project templates | Reusable project templates with task sets, phases and checklists per service type. | Could | CRM | DEL, REV | Planned |
| PRJ-009 | Resource allocation preview | Illustrative assignment view showing team availability conflicts. | Could | CRM | DEL, SM | Planned |
| PRJ-010 | Handover checklist from sales | Structured handover of deal context (scope, promises, risks) into delivery. | Should | CRM | SR, DEL | Planned |

### 3.11 Field sales & territory — `FLD`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| FLD-001 | Territory tree | Hierarchical territory model (region → district → patch) with ownership and effective dates. | Should | CRM | SM, REV | Planned |
| FLD-002 | Territory assignment rules | Rule-based mapping of accounts and leads to territories with a preview and overlap warnings. | Should | CRM | REV, SM | Planned |
| FLD-003 | Coverage map | Illustrative map view of accounts and territories using fixture coordinates (no GPS, no routing). | Could | CRM | FR, SM | Planned |
| FLD-004 | Visit planning | Weekly visit list with account grouping, last-visit dates and suggested cadence. | Should | CRM | FR, SM | Planned |
| FLD-005 | Check-in / check-out mock | Manual visit start/stop with timestamps the user enters — explicitly not location-based. | Could | CRM | FR | Planned |
| FLD-006 | Route list view | Ordered stop list with manually editable sequence (no automatic route optimisation). | Could | CRM | FR | Planned |
| FLD-007 | Offline-tolerant field view | Mobile-first account and deal view that tolerates stale data and surfaces a "last synced" state. | Should | CRM | FR | Planned |
| FLD-008 | Field activity capture | Fast note, photo-reference and outcome capture designed for one-handed use. | Should | CRM | FR | Planned |
| FLD-009 | Territory performance report | Pipeline, win rate and coverage by territory with period comparison. | Should | CRM | SM, EXEC | Planned |
| FLD-010 | Quota by territory | Assign quota at territory level with progress roll-up and rep-level allocation. | Could | CRM | SM, FIN | Planned |

### 3.12 Analytics & BI — `BI`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| BI-001 | Report library | Curated reports across sales, service, marketing and success, each with a description and owner. | Must | CRM | SM, SUP, MM | Planned |
| BI-002 | Report builder | Group, filter, summarise and sort any permitted object with calculated columns. | Must | CRM | REV, SM | Planned |
| BI-003 | Saved views & sharing | Save report configurations and share with users, roles or teams with permission checks. | Must | CRM | SM, REV | Planned |
| BI-004 | Chart types | Table, bar, stacked bar, line, area, pie/donut, funnel, scatter and KPI single-value widgets. | Should | CRM | REV, EXEC | Planned |
| BI-005 | Dashboard builder | Drag-drop widget grid with resizing, layout presets and per-role default dashboards. | Must | CRM | SM, EXEC | Planned |
| BI-006 | Dashboard filters | Global dashboard filters (period, owner, team, pipeline) applied to every widget. | Must | CRM | SM, EXEC | Planned |
| BI-007 | Drill-down | Click-through from a widget to the underlying record list with the same filter context. | Should | CRM | SM | Planned |
| BI-008 | Snapshot & compare | Save a report snapshot and compare two periods with absolute and percentage deltas. | Should | CRM | EXEC, FIN | Planned |
| BI-009 | Export & scheduled delivery mock | Export to CSV/XLSX and configure a "schedule" that clearly states it does not send in demo mode. | Must | CRM | REV, EXEC | Planned |
| BI-010 | Pipeline analytics | Stage ageing, conversion by stage, velocity, slippage and cohort win rates. | Must | CRM | SM, EXEC | Planned |
| BI-011 | Forecast roll-up dashboard | Manager and executive forecast views by period, owner, pipeline and forecast category. | Should | CRM | SM, EXEC | Planned |
| BI-012 | Service analytics | Ticket volume, SLA attainment, backlog, reopen rate, agent utilisation and CSAT. | Must | CRM | SUP | Planned |
| BI-013 | Marketing analytics | Send performance, funnel conversion, attribution and campaign ROI in one workspace. | Should | CRM | MM | Planned |
| BI-014 | Success analytics | Health distribution, renewal rate, churn reasons, expansion and NPS/CSAT trends. | Should | CRM | CSM, EXEC | Planned |
| BI-015 | Data-quality report | Missing fields, duplicates, orphaned records, stale deals and unowned records as actionable lists. | Should | CRM | REV, TA | Planned |
| BI-016 | Metric definitions reference | In-product glossary defining every KPI's formula and data source to prevent metric disputes. | Should | CRM | REV, EXEC | Planned |

### 3.13 Workflow automation — `WF`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| WF-001 | Automation list & status | Catalogue of automations with owner, trigger type, enabled state, last run and run count. | Must | CRM | REV, TA | Planned |
| WF-002 | Visual workflow builder | Trigger → conditions → actions canvas with branching, grouping and human-readable summaries. | Must | CRM | REV | Planned |
| WF-003 | Record-change triggers | Fire on create, update, delete, field change, stage change or owner change with before/after context. | Must | CRM | REV | Planned |
| WF-004 | Scheduled triggers | Time-based triggers (daily, weekly, cron-style) with timezone handling and next-run preview. | Should | CRM | REV | Planned |
| WF-005 | Condition builder | AND/OR condition groups over record fields, related records and time windows. | Must | CRM | REV | Planned |
| WF-006 | Actions library | Update record, create record, assign owner, send notification, add task, send (simulated) email, call webhook mock. | Must | CRM | REV | Planned |
| WF-007 | Waits & delays | Delay actions with unit selection and "wait until condition" branches. | Should | CRM | REV | Planned |
| WF-008 | Approvals | Human approval steps with approver resolution, deadlines, reminders and audit of decisions. | Should | CRM | SM, FIN | Planned |
| WF-009 | Dry-run & test mode | Run an automation against a chosen record in test mode and show exactly what would change. | Must | CRM | REV, TA | Planned |
| WF-010 | Execution log | Per-run history with trigger context, each step's outcome, timings and failure reasons. | Must | CRM | REV, TA | Planned |
| WF-011 | Error handling & retries | Define retry counts, back-off and fallback actions, with failed runs surfaced for manual replay. | Should | CRM | REV | Planned |
| WF-012 | Versioning & rollback | Immutable versions of an automation with a diff and one-click restore of a prior version. | Should | CRM | REV | Planned |
| WF-013 | Templates & recipes | Reusable automation templates (lead routing, deal rot alert, renewal reminder, escalation). | Should | CRM | REV | Planned |
| WF-014 | Limits & quotas display | Shows remaining automation runs for the plan period with warning thresholds and upgrade guidance. | Must | CRM | TA, REV | Planned |

### 3.14 AI assistant — `AI`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| AI-001 | Assistant panel | Contextual assistant accessible from any record with a scoped prompt box and suggested prompts. | Should | CRM | SR, SA, CSM | Planned |
| AI-002 | Record summarisation | Produces a structured summary of a record's history, explicitly labelled as simulated output. | Should | CRM | SR, SA | Planned |
| AI-003 | Email draft assistance | Suggests draft replies from record context and templates with an "insert" and "edit" step. | Should | CRM | SR, SDR | Planned |
| AI-004 | Meeting preparation brief | Assembles a pre-meeting brief from deal, contact, ticket and activity data (fixture-derived). | Should | CRM | SR | Planned |
| AI-005 | Call summary | Displays a simulated transcript summary with action items the user must confirm before saving. | Could | CRM | SR, SA | Planned |
| AI-006 | Next-best-action explanation | Presents suggested actions with the reasons and data used, and a confidence label. | Should | CRM | SR, CSM | Planned |
| AI-007 | Predictive lead/deal scoring | Deterministic scoring surfaced as a "model output (simulated)" with factor breakdown. | Should | CRM | SM, SDR | Planned |
| AI-008 | Churn/risk insight | Flags at-risk accounts with the signals that fired and suggested interventions. | Should | CRM | CSM | Planned |
| AI-009 | Forecast insight narration | Written commentary on forecast movement with links to the underlying records. | Could | CRM | SM, EXEC | Planned |
| AI-010 | Knowledge article drafting | Drafts an article from a resolved ticket for human review before publishing. | Could | CRM | SA, SUP | Planned |
| AI-011 | Portfolio digest | Personal weekly digest of changes across owned records with attention items first. | Could | CRM | SR, CSM | Planned |
| AI-012 | Prompt library & governance | Admin-managed prompts with allowed data scopes, review status and usage logging. | Should | Platform Admin | TA, REV | Planned |
| AI-013 | AI credit meter | Shows consumed/remaining AI credits per period with per-surface breakdown. | Should | CRM + Platform Admin | TA, FIN | Planned |
| AI-014 | Human-in-the-loop guardrails | Every AI suggestion requires explicit acceptance, is editable and never auto-writes without review. | Must | CRM | TA, SR | Planned |

### 3.15 Collaboration — `COL`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| COL-001 | Record followers | Follow/unfollow records to receive change and comment notifications. | Should | CRM | SR, SA | Planned |
| COL-002 | Comments & threads on records | Threaded comments with mentions, reactions and resolve state, separate from customer-visible notes. | Should | CRM | SR, SA, CSM | Planned |
| COL-003 | @mentions & notifications | Mention a colleague with a link to the record and an in-app notification. | Should | CRM | SR, SA | Planned |
| COL-004 | Notification centre | Grouped, filterable in-app notifications with bulk mark-as-read and mute controls. | Must | CRM | All internal | Planned |
| COL-005 | Watch lists for saved views | Subscribe to a saved view and receive digests when records enter or leave it. | Could | CRM | SM, SUP | Planned |
| COL-006 | Team spaces | Lightweight shared workspace grouping records, views and notes for a team or deal room. | Should | CRM | SM, SR | Planned |
| COL-007 | Shared deal room | Cross-functional view of a strategic deal with participants, documents and decisions. | Could | CRM | SR, SM, DEL | Planned |
| COL-008 | Announcements | Tenant admins publish internal announcements to a selected audience. | Could | CRM | TA | Planned |
| COL-009 | Presence & handover | Shows who is viewing/owning a record to reduce duplicate outreach (simulated presence). | Could | CRM | SA, SR | Planned |
| COL-010 | Escalation discussion thread | Structured thread attached to an escalation with participants, decisions and timeline. | Should | CRM | CSM, SUP | Planned |

### 3.16 Documents — `DOC`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| DOC-001 | Document library | Tenant-wide document list with type, owner, related records, tags and versions. | Should | CRM | SR, FIN | Planned |
| DOC-002 | Record attachments | Attach and categorise files on any record with preview for common types. | Must | CRM | All internal | Planned |
| DOC-003 | Version history | Supersede versions with notes, retention of prior versions and download of any version. | Should | CRM | REV, FIN | Planned |
| DOC-004 | Document templates | Template documents with merge tokens (quote, proposal, contract, onboarding pack). | Should | CRM | SR, MM | Planned |
| DOC-005 | Document generation preview | Renders a merged document preview with token resolution and missing-data warnings. | Should | CRM | SR | Planned |
| DOC-006 | Send-for-signature mock | Simulated signing flow with recipient order, reminders and a clearly fake completion state. | Could | CRM | SR, FIN | Planned |
| DOC-007 | Signing status tracker | Per-recipient status (sent, viewed, signed, declined) generated from simulated events. | Could | CRM | SR, FIN | Planned |
| DOC-008 | Share links with expiry | Generates mock share links with expiry and access rules; explains no real link is issued. | Could | CRM | SR | Planned |
| DOC-009 | Document expiry & renewal | Track validity dates for contracts and certificates with reminders before expiry. | Should | CRM | CSM, FIN | Planned |
| DOC-010 | Storage usage view | Shows storage consumption by object and user against plan limits. | Could | Platform Admin | TA | Planned |

### 3.17 Customization & custom objects — `CUS`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| CUS-001 | Custom object builder | Create objects with name, plural label, description, icon seed and visibility rules. | Must | Platform Admin | TA, REV | Planned |
| CUS-002 | Field types catalogue | Text, long text, number, currency, percent, date, datetime, boolean, picklist, multi-picklist, lookup, user, file. | Must | Platform Admin | TA, REV | Planned |
| CUS-003 | Field-level configuration | Required, unique, default value, help text, validation rule and searchable flag per field. | Must | Platform Admin | TA, REV | Planned |
| CUS-004 | Object relationships | Lookup and master-detail style relationships with cardinality selection and cascade behaviour. | Must | Platform Admin | REV | Planned |
| CUS-005 | Layout editor | Drag-drop record-page layout with sections, columns, tabs and per-role layout variants. | Must | Platform Admin | TA, REV | Planned |
| CUS-006 | List view builder | Configure list columns, filters, sort order, row density and inline-edit fields. | Must | Platform Admin | REV | Planned |
| CUS-007 | Page layout assignment | Assign layouts and record types by role, team, pipeline or record source. | Should | Platform Admin | TA | Planned |
| CUS-008 | Validation rules | Formula-style validation with user-facing error messages at field, object or save level. | Should | Platform Admin | REV | Planned |
| CUS-009 | Formula fields | Read-only calculated fields across fields, related records and simple functions. | Should | Platform Admin | REV | Planned |
| CUS-010 | Picklist management | Central picklist values with dependency rules, active/inactive state and translation labels. | Should | Platform Admin | REV | Planned |
| CUS-011 | Record types | Named record variants per object that select layout, picklists and required fields. | Should | Platform Admin | REV | Planned |
| CUS-012 | Global picklists & shared values | Reusable value sets across objects to prevent duplication. | Could | Platform Admin | REV | Planned |
| CUS-013 | Configuration change history | Every configuration change logged with author, timestamp, diff and rollback action. | Should | Platform Admin | TA, REV | Planned |
| CUS-014 | Sandbox / config preview | Preview configuration changes against sample data before applying to the tenant. | Could | Platform Admin | TA, REV | Planned |
| CUS-015 | Configuration export/import | Export tenant configuration as a file and import into another tenant (demo) environment. | Could | Platform Admin | TA, DEV | Planned |
| CUS-016 | Object usage guardrails | Warn before deleting objects/fields that are referenced elsewhere; show impact analysis. | Must | Platform Admin | TA | Planned |

### 3.18 Industry templates — `IND`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| IND-001 | Template gallery | Catalogue of installable industry templates with scope summary and preview of what will be created. | Should | Platform Admin | TA, REV | Planned |
| IND-002 | Template installer | Applies a template (objects, fields, pipelines, automations, dashboards, sample data) with conflict checks. | Should | Platform Admin | TA | Planned |
| IND-003 | Professional services template | Delivery-oriented pipeline, project objects, utilisation and renewal fields. | Should | CRM | TA, DEL | Planned |
| IND-004 | B2B distribution template | Account hierarchy, reorder cadence, price books and territory mapping suited to repeat sales. | Could | CRM | TA, REV | Planned |
| IND-005 | High-tech / SaaS template | Subscription products, MRR/ARR metrics, churn fields, onboarding milestones. | Should | CRM | TA, CSM | Planned |
| IND-006 | Manufacturing template | Quote-to-order fields, distributor accounts, warranty/service entitlements. | Could | CRM | TA, REV | Planned |
| IND-007 | Financial services template | Suitability fields, consent capture, review cadence and compliance-oriented reminders. | Could | CRM | TA, FIN | Planned |
| IND-008 | Template customisation after install | Editable template artefacts with an "origin" badge and safe-detach from the template. | Should | Platform Admin | TA, REV | Planned |

### 3.19 Partner relationship management — `PRM`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| PRM-001 | Partner accounts | Partner record type with tier, agreement dates, contacts, certifications area and status. | Should | CRM | PM | Planned |
| PRM-002 | Deal registration | Partners register deals; the flow shows conflict checking and approval status. | Should | Portal + CRM | PART, PM | Planned |
| PRM-003 | Partner pipeline visibility | Partner sees only their own registered deals; internal users see the aggregate. | Should | CRM + Portal | PM, PART | Planned |
| PRM-004 | Partner tiers & benefits | Tier model with thresholds and visible benefit entitlements. | Could | CRM | PM | Planned |
| PRM-005 | Partner scorecard | Ranking by sourced pipeline, win rate, activity and responsiveness. | Could | CRM | PM, EXEC | Planned |
| PRM-006 | Co-selling shared workspace | Shared room for a partner and internal team with tasks, documents and decisions. | Could | CRM + Portal | PM, PART | Planned |
| PRM-007 | Partner onboarding checklist | Agreement, training, portal access and first registration as gated milestones. | Should | Portal | PM, PART | Planned |
| PRM-008 | Partner notifications | Deal registration outcomes, tier changes and expiry reminders (simulated delivery). | Could | Portal + CRM | PART, PM | Planned |

### 3.20 Customer self-service portal — `POR`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| POR-001 | Portal sign-in | Separate, clearly branded portal entry with demo-credential guidance. | Must | Portal | CUST | Planned |
| POR-002 | Ticket submission | Customer creates a ticket with category, severity, attachments and expectation messaging. | Must | Portal | CUST | Planned |
| POR-003 | Ticket list & detail | Customer-visible ticket status, thread, SLA expectations and resolution history. | Must | Portal | CUST | Planned |
| POR-004 | Knowledge base browsing | Searchable, category-navigable public articles with helpfulness voting. | Must | Portal | CUST | Planned |
| POR-005 | Account profile | Customer maintains their contacts, addresses, communication preferences and consent. | Should | Portal | CUST | Planned |
| POR-006 | Quote acceptance | Customer reviews and accepts/declines a quote; acceptance is recorded internally as simulated. | Should | Portal | CUST, FIN | Planned |
| POR-007 | Invoice & payment view | Invoice list with statuses and a disabled payment action explaining demo limitations. | Should | Portal | CUST, FIN | Planned |
| POR-008 | Onboarding & success plan view | Customer sees milestones, owners, dates and their responsibilities. | Should | Portal | CUST, CSM | Planned |
| POR-009 | Product/service catalogue view | Read-only view of entitlement and purchased services with renewal dates. | Could | Portal | CUST | Planned |
| POR-010 | Portal branding & configuration | Tenant admin configures portal logo (generated placeholder), colours, domain label and visible modules. | Should | Platform Admin | TA | Planned |

### 3.21 Organization administration — `ADM`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| ADM-001 | User management | List, invite, edit, deactivate and delete users with seat consumption shown. | Must | Platform Admin | TA | Planned |
| ADM-002 | Role definitions | Create roles with granular object, field and action permissions and a readable permission summary. | Must | Platform Admin | TA | Planned |
| ADM-003 | Permission sets | Additional additive permission bundles assignable on top of a role. | Should | Platform Admin | TA | Planned |
| ADM-004 | Record sharing rules | Owner-based, criteria-based and manual sharing rules with an evaluation preview. | Should | Platform Admin | TA, REV | Planned |
| ADM-005 | Field-level security matrix | Grid view of roles × fields with read/edit visibility and bulk toggles. | Must | Platform Admin | TA | Planned |
| ADM-006 | Team & hierarchy management | Define teams, reporting lines and manager visibility with a hierarchy visualisation. | Must | Platform Admin | TA, SM | Planned |
| ADM-007 | Role assignment preview | Shows what a given role can see and do before saving ("view as role" simulation). | Should | Platform Admin | TA | Planned |
| ADM-008 | SSO/MFA configuration | Settings for simulated SAML/OIDC entry, MFA enforcement policy and session timeout. | Should | Platform Admin | TA | Planned |
| ADM-009 | Audit log | Searchable, filterable log of user actions, config changes, permission changes, exports and logins. | Must | Platform Admin | TA, REV | Planned |
| ADM-010 | Retention & export policy | Configure log and data retention windows and produce an auditable export request. | Should | Platform Admin | TA, FIN | Planned |
| ADM-011 | Business hours & holiday calendars | Shared calendars used by SLAs, automations and escalations, with per-team variants. | Must | Platform Admin | SUP, REV | Planned |
| ADM-012 | Currency & exchange rate table | Base currency, enabled currencies and manually maintained rate table for conversions. | Should | Platform Admin | FIN | Planned |
| ADM-013 | Notification policy | Which events trigger email/in-app/mention notifications and who receives digest summaries. | Should | Platform Admin | TA | Planned |
| ADM-014 | Duplicate & merge rules | Matching rules per object, merge behaviour and blocking rules on create. | Should | Platform Admin | REV | Planned |
| ADM-015 | Data import centre | Job history for imports with row-level results, re-run and rollback of the last import. | Must | Platform Admin | TA, REV | Planned |
| ADM-016 | Bulk data export | Object-scoped exports with field selection, filter conditions and audit entry. | Must | Platform Admin | TA, FIN | Planned |
| ADM-017 | Data ownership & reassignment | Find records owned by inactive users and reassign in bulk with a preview. | Should | Platform Admin | TA | Planned |
| ADM-018 | Storage & usage dashboard | Record, file, automation and AI usage against plan limits with overage warnings. | Should | Platform Admin | TA, FIN | Planned |
| ADM-019 | Integration & connector registry | Installed connectors with scopes, connected user, last sync, health and disconnect action. | Should | Platform Admin | TA | Planned |
| ADM-020 | Tenant branding | Name, logo placeholder, colour tokens, email/portal sender label — with an explicit generated/placeholder notice. | Should | Platform Admin | TA | Planned |
| ADM-021 | Domain & locale configuration | Locale, timezone, date/number formats, week start, fiscal year start. | Must | Platform Admin | TA, FIN | Planned |
| ADM-022 | Feature toggles | Enable/disable product areas per tenant (projects, PRM, surveys, portal) with dependency warnings. | Should | Platform Admin | TA | Planned |
| ADM-023 | Approval & delegation settings | Leave/absence delegation of approvals and reassignment of pending decisions. | Could | Platform Admin | SM, TA | Planned |
| ADM-024 | Sandbox / demo environment | A clearly labelled secondary environment for configuration experiments with seeded data. | Could | Platform Admin | TA, REV | Planned |
| ADM-025 | Security posture page | Plain-language summary of active security settings, gaps and recommended next steps. | Should | Platform Admin | TA | Planned |
| ADM-026 | Admin command palette | Keyboard search across settings, users, objects and roles to avoid menu archaeology. | Could | Platform Admin | TA | Planned |

### 3.22 Globalization — `GLO`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| GLO-001 | i18n framework | All user-facing strings externalised with a locale switcher and fallback chain. | Must | CRM + Website + Portal | All | Planned |
| GLO-002 | Locale packs | Shipped labelled locales reusing the shared localization package, with a coverage indicator per locale. | Should | CRM | All | Planned |
| GLO-003 | Date, time & number formatting | Locale-aware formatting for dates, times, durations, numbers and percentages. | Must | CRM + Portal | All | Planned |
| GLO-004 | Timezone handling | Store and display times with per-user timezone and explicit "your time vs tenant time" clarity. | Must | CRM | SR, SA | Planned |
| GLO-005 | Multi-currency display | Currency selection and conversion display with rate source and "indicative conversion" label. | Should | CRM | FIN, SR | Planned |
| GLO-006 | RTL layout support | Full logical-property layout with mirrored navigation, direction-aware icons and bidi-safe inputs. | Must | CRM + Website + Portal | All | Planned |
| GLO-007 | Translation management surface | Admin view of translated vs untranslated keys with export/import of translation files. | Could | Platform Admin | TA, DEV | Planned |
| GLO-008 | Localised email/portal templates | Per-locale template variants with a preview for each active locale. | Should | CRM + Portal | MM, TA | Planned |
| GLO-009 | Address & name formats | Locale-aware address layouts and honorific/name-order handling. | Should | CRM | All | Planned |
| GLO-010 | Regional compliance copy | Region-specific consent, retention and data-notice text blocks selectable by tenant region. | Could | Website + CRM | TA | Planned |

### 3.23 Multi-tenancy — `TEN`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| TEN-001 | Tenant isolation model | Every query, store and UI surface is tenant-scoped with no cross-tenant data leakage by construction. | Must | CRM + Platform Admin | PO, TA | Planned |
| TEN-002 | Tenant context provider | Global context supplying tenant identity, plan, features, locale and branding to all apps. | Must | CRM + Platform Admin | PO | Planned |
| TEN-003 | Tenant switcher | Switch between tenants a user can access with a visible boundary change (colour/label change, not copied branding). | Must | CRM + Platform Admin | TA, PO | Planned |
| TEN-004 | Tenant-scoped search | Search results never cross tenant boundaries; scope is stated in the UI. | Must | CRM | All | Planned |
| TEN-005 | Tenant-scoped configuration | Objects, fields, layouts, automations, pipelines and settings are per tenant. | Must | Platform Admin | TA, REV | Planned |
| TEN-006 | Plan & entitlement enforcement in UI | Feature availability derived from the tenant's plan; gated items explain themselves rather than vanishing. | Must | CRM + Platform Admin | TA, PO | Planned |
| TEN-007 | Tenant-level usage metering | Aggregated seats, records, automations and AI credit usage per tenant period. | Should | Platform Admin | TA, FIN | Planned |
| TEN-008 | Cross-tenant aggregate view (owner only) | Platform-owner view counting tenants, plans and health without exposing tenant record content. | Should | Platform Admin | PO | Planned |
| TEN-009 | Tenant lifecycle states | Trial, active, suspended, archived states that visibly change shell behaviour (read-only, banner). | Should | CRM + Platform Admin | TA, PO | Planned |
| TEN-010 | Tenant data reset | Owner-triggered, confirmation-gated reset of demo data for a tenant. | Should | Platform Admin | PO, TA | Planned |

### 3.24 Subscriptions & billing — `BIL`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| BIL-001 | Plan catalogue | Authoritative in-product plan definitions with prices, inclusions, caps and add-ons. | Must | Platform Admin + CRM | TA, FIN | Planned |
| BIL-002 | Seat management | Add/remove seats with proration preview and effective date selection. | Should | Platform Admin | TA, FIN | Planned |
| BIL-003 | Plan change (upgrade/downgrade) | Plan switching with entitlement diff preview and consequences before confirmation. | Should | Platform Admin | TA | Planned |
| BIL-004 | Add-on management | Attach/detach optional modules with dependency checks and price impact. | Should | Platform Admin | TA, FIN | Planned |
| BIL-005 | AI credit packs | Purchase credit packs in the UI with clear consumption-tracking linkage. | Should | Platform Admin | TA | Planned |
| BIL-006 | Invoice history | Invoice list with period, amount, status and a printable preview (all values simulated). | Should | Platform Admin | FIN | Planned |
| BIL-007 | Payment method placeholder | Displays a "no payment method — demo mode" state and never accepts card details. | Must | Platform Admin | FIN, TA | Planned |
| BIL-008 | Billing contact & address | Legal entity, billing contact, tax identifiers and address details on the tenant. | Should | Platform Admin | FIN | Planned |
| BIL-009 | Tax preview | Shows tax lines as indicative with a clear disclaimer and configuration source. | Could | Platform Admin | FIN | Planned |
| BIL-010 | Renewal & trial countdown | Visible renewal/trial dates with reminders in the tenant admin home. | Must | Platform Admin | TA | Planned |
| BIL-011 | Cancellation/suspension flow | Cancellation request with retention prompts, effective-date explanation and read-only consequences. | Could | Platform Admin | TA | Planned |
| BIL-012 | Entitlement vs. actual usage report | Per-capability comparison of entitled vs. used, with the top three upgrade drivers surfaced. | Should | Platform Admin | TA, EXEC | Planned |

### 3.25 Platform-owner admin — `OPS`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| OPS-001 | Tenant directory | List of all tenants with plan, status, region label, created date and last activity. | Must | Platform Admin | PO | Planned |
| OPS-002 | Tenant provisioning | Create a tenant (name, subdomain, plan, seed profile) through a guided provisioning flow. | Must | Platform Admin | PO | Planned |
| OPS-003 | Tenant detail & health | Tenant profile with usage, feature adoption, support notes and lifecycle actions. | Must | Platform Admin | PO | Planned |
| OPS-004 | Support impersonation (labelled) | Enter a tenant read-only with an unmissable impersonation banner and automatic audit entry. | Should | Platform Admin | PO | Planned |
| OPS-005 | Plan & entitlement manager | Owner-side editing of plan definitions, caps and add-on availability used by all tenants. | Should | Platform Admin | PO | Planned |
| OPS-006 | Feature flag rollout | Percentage/user/tenant-scoped flags for unreleased capability, with a change log. | Should | Platform Admin | PO | Planned |
| OPS-007 | Global template & asset registry | Publish industry templates, email/document templates and mock integration catalogue entries. | Should | Platform Admin | PO | Planned |
| OPS-008 | Mock service registry | Configure which mock services are enabled and their latency/failure simulation profiles. | Should | Platform Admin | PO, DEV | Planned |
| OPS-009 | Global audit stream | Cross-tenant audit events for owner actions, impersonation, flag changes and provisioning. | Should | Platform Admin | PO | Planned |
| OPS-010 | Demo dataset generator | Generate configurable labelled demo datasets (industries, record volumes, scenario seeds). | Must | Platform Admin | PO | Planned |
| OPS-011 | Environment banner control | Force a global "demo environment" banner state and message across all tenants. | Must | Platform Admin | PO | Planned |
| OPS-012 | Announcement broadcast | Send in-app announcements to selected tenant cohorts. | Could | Platform Admin | PO | Planned |
| OPS-013 | Plan-mix reporting | Illustrative distribution of tenants by plan, seats and feature adoption for internal use. | Should | Platform Admin | PO | Planned |
| OPS-014 | Tenant data import/export (owner) | Move a labelled demo dataset between environments for testing. | Could | Platform Admin | PO, DEV | Planned |

### 3.26 Integration marketplace — `MKT`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| MKT-001 | Integration catalogue | Browsable catalogue of integrations with category, capability summary and required scopes. | Must | CRM + Platform Admin | TA, REV | Planned |
| MKT-002 | Integration detail page | Explains what the integration syncs, both directions, data touched, limitations and setup steps. | Must | CRM + Platform Admin | TA, REV | Planned |
| MKT-003 | Connection wizard | Steps through scopes, account selection and field mapping, ending in a simulated success state. | Must | CRM | TA, REV | Planned |
| MKT-004 | Connector health & sync log | Per-connector sync history with record counts, errors, retries and a manual "sync now" simulation. | Must | Platform Admin | TA, REV | Planned |
| MKT-005 | Field mapping editor | Maps external fields to CRM fields with transform options and a sample-value preview. | Should | CRM | REV | Planned |
| MKT-006 | Conflict & duplicate handling | Rules for which system wins on conflict and how duplicates are resolved. | Should | CRM | REV | Planned |
| MKT-007 | Disconnect & data impact | Explains what happens to synced data on disconnect and requires explicit confirmation. | Should | Platform Admin | TA | Planned |
| MKT-008 | Request an integration | Capture user requests for new integrations into a visible backlog list. | Could | CRM + Website | TA, CUST | Planned |

### 3.27 Developer platform — `DEV`

| ID | Title | Description | Priority | Surface | Personas | Status |
|---|---|---|---|---|---|---|
| DEV-001 | Mock API key management | Create, scope, rotate and revoke keys with a last-used display; no real keys are issued. | Should | Platform Admin | DEV, TA | Planned |
| DEV-002 | API reference explorer | Interactive reference for the mock API with example requests and schema definitions. | Should | Website + Platform Admin | DEV | Planned |
| DEV-003 | Webhook event catalogue | Lists available events with payload schemas, sample bodies and delivery guarantees text. | Should | Platform Admin | DEV | Planned |
| DEV-004 | Webhook subscriptions | Create endpoints with event filters, headers and a signing-secret placeholder. | Should | Platform Admin | DEV | Planned |
| DEV-005 | Delivery log & replay mock | Attempt log with response codes, retries and a replay action that only re-simulates. | Should | Platform Admin | DEV | Planned |
| DEV-006 | Rate-limit meter | Shows request quota, consumption and remaining allowance per period. | Should | Platform Admin | DEV, TA | Planned |
| DEV-007 | Sandbox data & tokens | Seeded sandbox records plus clearly fake tokens for building against the mock API. | Could | Platform Admin | DEV | Planned |
| DEV-008 | Object schema export | Export the tenant's object model (JSON) for documentation and local tooling. | Should | Platform Admin | DEV, REV | Planned |
| DEV-009 | Embedded app surface | Demonstrates where a third-party UI panel would render inside a record page. | Could | CRM | DEV, TA | Planned |
| DEV-010 | Developer quickstart docs | Step-by-step mock integration guide with copyable code and expected responses. | Should | Website | DEV | Planned |
| DEV-011 | Mock request inspector | In-app console that shows the exact mock request/response a UI action produced. | Could | Platform Admin | DEV, PO | Planned |
| DEV-012 | Dependency & version policy | Documents mock API versioning, deprecation windows and changelog. | Could | Website | DEV | Planned |

---

## 4. Inventory summary

| Domain | Code | Rows | Must | Should | Could |
|---|---|---|---|---|---|
| Website / marketing site | `WS` | 18 | 10 | 5 | 3 |
| Identity & onboarding | `ID` | 16 | 11 | 4 | 1 |
| Sales | `SAL` | 30 | 20 | 9 | 1 |
| Sales productivity | `SPD` | 16 | 5 | 8 | 3 |
| Unified communications | `UC` | 18 | 8 | 8 | 2 |
| Marketing automation | `MA` | 20 | 8 | 10 | 2 |
| Customer support | `CS` | 20 | 11 | 8 | 1 |
| Customer success | `CSM` | 12 | 3 | 8 | 1 |
| Products & revenue operations | `PRO` | 16 | 3 | 10 | 3 |
| Projects & delivery | `PRJ` | 10 | 0 | 6 | 4 |
| Field sales & territory | `FLD` | 10 | 0 | 6 | 4 |
| Analytics & BI | `BI` | 16 | 8 | 8 | 0 |
| Workflow automation | `WF` | 14 | 8 | 6 | 0 |
| AI assistant | `AI` | 14 | 1 | 9 | 4 |
| Collaboration | `COL` | 10 | 1 | 5 | 4 |
| Documents | `DOC` | 10 | 1 | 5 | 4 |
| Customization & custom objects | `CUS` | 16 | 7 | 6 | 3 |
| Industry templates | `IND` | 8 | 0 | 5 | 3 |
| Partner relationship management | `PRM` | 8 | 0 | 4 | 4 |
| Customer self-service portal | `POR` | 10 | 4 | 5 | 1 |
| Organization administration | `ADM` | 26 | 9 | 14 | 3 |
| Globalization | `GLO` | 10 | 4 | 4 | 2 |
| Multi-tenancy | `TEN` | 10 | 6 | 4 | 0 |
| Subscriptions & billing | `BIL` | 12 | 3 | 7 | 2 |
| Platform-owner admin | `OPS` | 14 | 5 | 7 | 2 |
| Integration marketplace | `MKT` | 8 | 4 | 3 | 1 |
| Developer platform | `DEV` | 12 | 0 | 8 | 4 |
| **Total** | | **384** | **140** | **182** | **62** |

**Build-status snapshot (2026-10-13):** all **384** rows are `Planned`. The repository contains application scaffolding only (package manifests, TypeScript/ESLint/Prettier configuration) and no source files, so no row can be advanced to `UI skeleton` or beyond without an accompanying change to this table.

### 4.1 Suggested release slicing (indicative, not a commitment)

| Slice | Theme | Representative IDs |
|---|---|---|
| R1 | Internal CRM core | `ID-001`…`ID-011`, `SAL-001`…`SAL-030` (minus `SAL-026`), `SPD-001`…`SPD-004`, `SPD-013`, `SPD-016`, `UC-001`…`UC-002`, `ADM-001`…`ADM-008`, `ADM-015`…`ADM-016`, `ADM-021`, `CUS-001`…`CUS-006`, `BI-001`…`BI-003`, `BI-005`…`BI-006`, `WF-001`…`WF-006`, `WF-009`…`WF-010`, `WF-014`, `TEN-001`…`TEN-006` |
| R2 | Service & inbox depth | `CS-001`…`CS-008`, `CS-011`, `CS-015`…`CS-017`, `CS-020`, `UC-003`…`UC-014`, `UC-016`, `UC-018`, `POR-001`…`POR-005` |
| R3 | Revenue & success | `PRO-001`…`PRO-008`, `PRO-014`, `CSM-001`…`CSM-007`, `CSM-011`…`CSM-012`, `BI-010`…`BI-012`, `WF-007`…`WF-008`, `WF-011`…`WF-013`, `SPD-005`…`SPD-012` |
| R4 | Marketing & lifecycle | `MA-001`…`MA-020`, `WS-005`…`WS-010`, `WS-012`, `AI-001`…`AI-007`, `AI-012`…`AI-014` |
| R5 | Platform depth | `CUS-007`…`CUS-016`, `ADM-009`…`ADM-014`, `ADM-017`…`ADM-026`, `TEN-007`…`TEN-010`, `BIL-001`…`BIL-012`, `OPS-001`…`OPS-014`, `MKT-001`…`MKT-008`, `DEV-001`…`DEV-012`, `GLO-001`…`GLO-010`, `IND-001`…`IND-008`, `PRM-001`…`PRM-008`, `PRJ-001`…`PRJ-010`, `FLD-001`…`FLD-010` |

---

## 5. Change control

- IDs are append-only; superseded rows keep their number and gain a note in the description.
- Status changes require the row to cite the artefact that justifies the change (route, component, test file). A screenshotless claim of "done" is not accepted.
- Any new requirement that touches an out-of-scope system (§2) must also state what the frontend shows instead, and must not introduce a fake success state.
- This inventory is the single source of truth for feature naming; design files, mock data and test plans should reference these IDs.

*End of document — baseline 2026-10-13.*

