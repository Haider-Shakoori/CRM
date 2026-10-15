# Competitor Analysis & Feature Matrix — "CRM Platform"

**Document type:** functional benchmarking research (frontend-only, multi-tenant SaaS CRM).
**Retrieval date:** **2026-10-13** (all URLs opened on this date).
**Status:** research artefact. Not a specification. Not a design source.

> **All prices, tier names, feature lists and vendor claims change frequently.** Everything below reflects the vendor pages *as retrieved on 2026-10-13* only. Re-verify before any commercial decision.
>
> **Legal / ethical constraint:** this analysis exists **for functional benchmarking only**. We must **never** copy competitor UI assets, screenshots, icon sets, layouts, copy, colour systems or interaction choreography. We may benchmark *what capabilities exist*, *how they are packaged* and *what users expect*; we must design our own interface. No competitor logos, certification badges or customer counts may be reproduced in our product or marketing.

---

## 1. Scope & method

### 1.1 What was researched

| # | Platform / product | Primary artefacts retrieved |
|---|---|---|
| 1 | Salesforce Sales Cloud | public pricing + edition comparison |
| 2 | Salesforce Service Cloud | public pricing + edition comparison |
| 3 | HubSpot CRM + Sales / Service / Marketing Hubs | free-CRM product page, hub product pages with tier summaries |
| 4 | Microsoft Dynamics 365 Sales | public pricing + plan comparison + footnotes |
| 5 | Microsoft Dynamics 365 Customer Service | public pricing + plan comparison |
| 6 | Zoho CRM (and Zoho CRM Plus, Bigin references) | public pricing page with per-edition feature lists + FAQ |
| 7 | Pipedrive | public pricing page + add-ons + FAQ |
| 8 | monday CRM | public pricing page + plan feature lists + FAQ |
| 9 | Freshsales (Freshworks) | public pricing page + add-ons + FAQ |
| 10 | Creatio | corporate/platform page (AI-native, no-code, unlimited-packaging claims) + pricing page |
| 11 | SugarCRM (now "SugarAI") | public pricing/packaging page + FAQ |
| 12 | Bigin by Zoho | public pricing page + full plan comparison table |

Accessibility claims were checked against two vendor statements only (Salesforce, monday.com) plus vendor site footers where visible.

**Not researched in this pass (and therefore not asserted anywhere):** Nitro, oHub, and any other long-tail CRM. Bigin already covers the low-end/low-price segment, so the marginal value of a further low-end vendor was low relative to budget. No claims are made about these products.

### 1.2 How it was researched

1. Targeted web searches (7 searches total) to locate the current official pricing/product pages as of 2026.
2. Direct retrieval (18 successful page fetches) of **vendor-owned** pages: pricing pages, product pages, help/legal pages. Third-party blogs and review sites that appeared in search results were **not** used as evidence for any claim.
3. Only *stated* features were recorded. Where a page did not itemise a capability, the cell says so explicitly instead of inferring.
4. Vendor marketing superlatives (e.g. "#1 CRM", "customers acquire 129% more leads") were **deliberately excluded** — only capability lists, packaging structure and tier names were carried into the matrix.

### 1.3 Limitations (read before using the matrix)

- **Pricing pages are marketing surfaces.** They are optimised for completeness of *upsell*, not for truth about *core* capability. A "✅" means *the vendor states it on a page they control*; it does not mean it is delivered well, unlimited, or available at the cheapest tier.
- **Editions gate features heavily.** Nearly every platform moves its differentiating capabilities into a higher tier or a separately purchased add-on. Where a feature is tier-gated or an add-on, this matrix marks `⚠️`.
- **HubSpot hub pricing pages were not retrievable** on the retrieval date (`/pricing/crm`, `/pricing/sales`, `/pricing/marketing` returned no usable content; the pages are client-rendered). HubSpot tier *names*, headline prices and feature themes were instead taken from the public product pages, which do state them. Any deeper HubSpot packaging detail is marked `❓`.
- **Creatio's pricing page** contains no public list prices (contact-sales pattern), and `https://www.creatio.com/pricing` returned HTTP 404. Creatio figures are therefore described structurally, never numerically.
- **oHub** (`https://ohub.com/pricing/`) returned HTTP 404 and was dropped.
- **UX quality cannot be verified from vendor pages.** Rows such as *dashboard design* and *navigation simplicity* are marked `❓` unless a vendor states a countable structure (e.g. tier limits, workspace counts). We do **not** claim any competitor's UI is "better" or "worse" — only what is packaged.
- **Accessibility:** only Salesforce and monday.com publish an easily retrievable, dated public position in the pages we fetched. For everyone else the cell is `❓ Not confirmed`. Vendors' own conformance claims are **their statements**, not audit results, and are quoted as such.
- **Error/quality, implementation effort, data-migration cost and support quality are out of scope.** Some vendors make claims about these (e.g. SugarAI cites Nucleus Research TCO figures) — we reproduce none of them.

### 1.4 Marker conventions

| Marker | Meaning |
|---|---|
| ✅ | Capability **explicitly stated** by the vendor on a page retrieved for this document |
| ⚠️ | Partial, limited, implied, tier-gated, capped, or available only as a **paid add-on / separate product** |
| ❌ | **No evidence** of the capability was found in the sources consulted for that vendor. This is *not* proof of absence |
| ❓ | Not verified (page did not address it, or the page could not be retrieved) |
| **Target** | What "CRM Platform" intends to do — a product decision, not a competitor fact |

### 1.5 Citation keys

Matrix cells cite short keys so the tables stay readable. **Every key resolves 1:1 to a URL that was actually retrieved**, listed in §7 (and repeated in full in the *Notes per platform* section).

| Key | URL retrieved 2026-10-13 |
|---|---|
| `SF-S` | https://www.salesforce.com/sales/pricing/ |
| `SF-SVC` | https://www.salesforce.com/service/pricing/ |
| `SF-A11Y` | https://www.salesforce.com/company/legal/508_accessibility/ |
| `HS-CRM` | https://www.hubspot.com/products/crm |
| `HS-SALES` | https://www.hubspot.com/products/sales |
| `HS-SVC` | https://www.hubspot.com/products/service |
| `HS-MKT` | https://www.hubspot.com/products/marketing |
| `MS-SALES` | https://www.microsoft.com/en-us/dynamics-365/products/sales/pricing |
| `MS-SVC` | https://www.microsoft.com/en-us/dynamics-365/products/customer-service/pricing |
| `ZO-CRM` | https://www.zoho.com/crm/zohocrm-pricing.html |
| `BIGIN` | https://www.bigin.com/pricing.html |
| `PD` | https://www.pipedrive.com/en/pricing |
| `MON` | https://monday.com/crm/pricing |
| `MON-A11Y` | https://monday.com/accessibility-statement |
| `FS` | https://www.freshworks.com/crm/pricing/ |
| `CR` | https://www.creatio.com/ |
| `CR-P` | https://www.creatio.com/products/pricing |
| `SU` | https://sugarcrm.com/pricing/ |

Column abbreviations: **SF** Salesforce (Sales + Service Cloud), **HS** HubSpot, **MS** Microsoft Dynamics 365 (Sales + Customer Service), **ZO** Zoho CRM, **PD** Pipedrive, **MON** monday CRM, **FS** Freshsales, **CR** Creatio, **SU** SugarCRM/SugarAI, **BIG** Bigin, **Target** CRM Platform.

---

## 2. Feature comparison matrix

### A. Public website, signup & first-run experience

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Public marketing website / site authoring tied to CRM | ⚠️ site exists; site-builder not itemised (`SF-S`) | ✅ free website builder + free web hosting listed (`HS-CRM`) | ❓ | ✅ landing pages in CRM Plus; Zoho Sites/Landingpage in ecosystem (`ZO-CRM`, `BIGIN`) | ⚠️ Web Visitors add-on tracks site visitors, no site builder (`PD`) | ⚠️ Forms/WorkForms only (`MON`) | ❓ | ❓ | ⚠️ Sugar Market marketed as engagement, no site builder (`SU`) | ⚠️ via Zoho Sites/Landingpage (`BIGIN`) | Dedicated marketing site app with pricing, product pages, docs, blog, trial CTA |
| Signup & onboarding / free trial | ✅ 30-day free trial, no credit card (`SF-S`) | ✅ permanent free CRM tier; 14-day hub trials (`HS-CRM`, `HS-SVC`) | ✅ free trial (`MS-SALES`) | ✅ free edition (3 users) + free onboarding + trials (`ZO-CRM`) | ✅ 14-day trial, no credit card (`PD`) | ✅ start free, no credit card; 14-day trial (`MON`) | ✅ 21-day trial (`FS`) | ✅ free-trial terms published (`CR`) | ⚠️ demo/sales-led; trial not stated (`SU`) | ✅ 15-day trial + free onboarding (`BIGIN`) | Self-serve signup with tenant creation, guided first-run checklist |
| Dashboard design (first screen after login) | ✅ customisable reports/dashboards; Sales Workspace, Pipeline Inspection (`SF-S`) | ✅ reporting dashboard in **Free** tier (`HS-CRM`) | ✅ reporting and dashboards in all sales plans (`MS-SALES`) | ✅ reports & dashboards from Standard (`ZO-CRM`) | ✅ AI-assisted report creation from Lite (`PD`) | ✅ 1 → 50 → unlimited custom dashboards by tier (`MON`) | ⚠️ deal insights; dashboards not itemised (`FS`) | ⚠️ analytics stated, detail not itemised (`SU`) | ✅ Analytics from Standard+ (`SU`) | ✅ standard dashboards free; customisable from Premier (`BIGIN`) | Role-aware home: "my day" workspace + KPI band + empty-state guidance. Quality itself is `❓` for every competitor (not verifiable) |
| Navigation simplicity / information architecture | ❓ | ❓ | ❓ | ✅ explicit two-level IA: organisation-level modules vs. team-level modules with **team-user licences** (`ZO-CRM`) | ⚠️ "one simple, intuitive workspace" claimed (`PD`) | ✅ workspaces as the top-level container (1/3/15/unlimited by tier) (`MON`) | ⚠️ "single record for leads, deals, contacts, accounts" (`ZO-CRM` for Zoho; FS: ⚠️) (`FS`) | ❓ | ❓ | ⚠️ module tabs (Pipelines/Contacts/Activities/Notes) (`BIGIN`) | Flat, task-first IA; max. 2 levels; no module-badge noise; ⌘K everywhere. Competitor quality not assessed |

### B. Data model & records

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Contact management | ✅ "Account and Contact Management" (`SF-S`) | ✅ "Contact management" (`HS-CRM`) | ✅ SFA includes contact management (`MS-SALES` fn.1) | ✅ "Contact management" in Free (`ZO-CRM`) | ✅ leads/deals/contacts in one place (`PD`) | ✅ contacts as core records (`MON`) | ⚠️ contacts implied (`FS`) | ⚠️ CRM implied, objects not itemised (`CR`) | ✅ "Complete sales cycle management" (`SU`) | ✅ "Contact & Lead Management" (`BIGIN`) | Contact record with timeline, consent, merge, dedupe |
| Company / account management | ✅ Account management (`SF-S`) | ⚠️ company object implied by buying groups & CRM records (`HS-CRM`, `HS-SALES`) | ✅ account + contact (`MS-SALES` fn.1) | ✅ accounts in lead-to-cash model (`ZO-CRM`) | ⚠️ "organisation"/contacts timeline; account object not itemised (`PD`) | ⚠️ companies implied by CRM boards (`MON`) | ⚠️ account enrichment (company data) implies account object (`PD`, `FS`) | ⚠️ implied (`CR`) | ⚠️ account management implied by FAQ (`SU`) | ⚠️ contacts + companies stated in free tier ("Contacts, Products & Activities Management") (`BIGIN`) | Company/account with hierarchy, relationships, roll-up metrics |
| Custom objects | ✅ record types / unlimited custom applications (`SF-S`) | ✅ custom objects gated to **Enterprise** (`HS-CRM`) | ✅ custom apps via Power Apps (`MS-SALES` fn.4) | ✅ custom modules from Standard (`ZO-CRM`) | ⚠️ not itemised (`PD`) | ⚠️ "boards" as configurable pseudo-objects; 5–75 columns/board caps (`MON`) | ✅ custom modules gated to **Enterprise** (`FS`) | ✅ unlimited custom objects claimed (`CR`) | ⚠️ no/low-code configuration stated, objects not itemised (`SU`) | ⚠️ custom fields only (`BIGIN`) | Custom objects with relationships, layouts, permissions, sample data |
| Custom fields | ✅ (`SF-S`) | ✅ standard + calculated properties (Professional) (`HS-CRM`) | ✅ (`MS-SALES` fn.3) | ✅ extended field types incl. file upload, checkbox, date range (Enterprise) (`ZO-CRM`) | ✅ pipeline-specific + formula fields (Premium) (`PD`) | ✅ dozens of column types (fewer on Basic) (`MON`) | ✅ custom fields in Growth; custom fields listed in Pro (`FS`) | ⚠️ no-code designers stated (`CR`) | ✅ no-code configuration stated (`SU`) | ✅ 10/25/50 per module by tier, lookup/formula/user fields from Premier (`BIGIN`) | Field builder with all standard types + formula + lookup |
| Page layout customisation | ✅ "Customizable Profiles and Page Layouts", Lightning App Builder (`SF-S`) | ⚠️ record layout customisation not itemised (`HS-CRM`) | ✅ `MS-SALES` (customisation/automation row) | ✅ "Self service kiosks" + wizards (Professional/Enterprise) (`ZO-CRM`) | ⚠️ not itemised (`PD`) | ⚠️ board/column configuration as the layout mechanism (`MON`) | ⚠️ not itemised (`FS`) | ✅ no-code visual designers (`CR`) | ✅ no/low-code configuration (`SU`) | ⚠️ limited (`BIGIN`) | Drag-and-drop layout editor with per-role variants |
| Duplicate management | ✅ "Duplicate Blocking" (`SF-S`) | ✅ duplicate management gated to **Professional** (`HS-CRM`) | ⚠️ implied by data quality rules; not itemised (`MS-SALES`) | ⚠️ data enrichment/dedupe not itemised in CRM editions (`ZO-CRM`) | ⚠️ data quality improvements stated; dedupe not itemised (`PD`) | ⚠️ not itemised (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ✅ "Cleanup Duplicates"/"Find and Merge Duplicates" from Premier (`BIGIN`) | Detection rules, side-by-side merge, merge audit |
| Data import / export | ✅ (`SF-S`) | ✅ CRM import tool (`HS-CRM`) | ✅ export to Excel (`MS-SALES` fn.2) | ✅ import from spreadsheets free; capped export on Free (`ZO-CRM`) | ✅ import from spreadsheet/CRM (`PD`) | ⚠️ white-glove migration on Ultimate; self-serve import not itemised (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ migration services implied (`CR`) | ✅ migration programs/services (`SU`) | ✅ import & export in all paid tiers (`BIGIN`) | CSV/XLSX import with field mapper, dry-run, error report; full export |

### C. Lead-to-cash (sales)

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Lead management | ✅ Lead Management, routing, web-to-lead (`SF-S`) | ✅ Lead Management workspace (`HS-SALES`) | ✅ leads, opps, accounts, contacts (`MS-SALES` fn.1) | ✅ leads in Free tier; assignment rules (`ZO-CRM`) | ⚠️ leads managed inside pipelines (`PD`) | ⚠️ "leads, contacts & deals" (`MON`) | ⚠️ lifecycle stages; lead object not itemised (`FS`) | ⚠️ implied by Sales product (`CR`) | ✅ guided sales processes (`SU`) | ✅ lead management (`BIGIN`) | Leads with owner, source, status, convert-to-deal flow |
| Lead scoring | ✅ Lead Scoring **add-on** from Core (`SF-S`) | ✅ standard contact scoring in **Professional** (`HS-CRM`) | ✅ predictive lead & opportunity scoring (Premium) (`MS-SALES` fn.8) | ✅ predictive intelligence: conversion likelihood (Professional+) (`ZO-CRM`) | ✅ custom scoring models (Premium) (`PD`) | ⚠️ AI-powered data fields; explicit scoring not stated (`MON`) | ✅ contact scoring Pro+ (`FS`) | ⚠️ not itemised (`CR`) | ✅ predictive lead scoring (`SU`) | ❌ not found in sources consulted | Rule-based + explainable score with "why this score" |
| Pipeline / opportunity management | ✅ Opportunity Management, Opportunity Scoring, Waterfall, Pipeline Inspection (`SF-S`) | ✅ Deal Pipelines (`HS-SALES`) | ✅ opportunity management (`MS-SALES`) | ✅ "single record for leads, deals, contacts, accounts" (`ZO-CRM`) | ✅ pipeline management (`PD`) | ✅ deal boards with stage columns (`MON`) | ✅ Kanban view (`FS`) | ✅ sales cycle management; opportunity tracking (`SU`, `CR` sales product) | ✅ opportunity tracking (`SU`) | ✅ single/team pipelines with customisable stages (`BIGIN`) | Deal record + stage model with required-field gating |
| Multiple pipelines | ⚠️ multiple sales processes implied by record types; not itemised (`SF-S`) | ⚠️ multiple **ticket** pipelines stated; deal pipelines plural not itemised (`HS-SVC`) | ⚠️ not itemised (`MS-SALES`) | ✅ "Multiple sales pipelines" from Standard (`ZO-CRM`) | ✅ pipeline-specific fields imply >1 pipeline (Premium) (`PD`) | ⚠️ multiple boards implied (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ✅ 1 / 3 / 5 / 15 team pipelines by tier (`BIGIN`) | Unlimited pipelines in one tenant, per-team, no extra licence |
| Drag-and-drop kanban | ⚠️ not itemised on pricing pages (`SF-S`) | ✅ "deal board" referenced; pipeline visualisation (`HS-CRM`, `HS-SALES`) | ⚠️ not itemised (`MS-SALES`) | ⚠️ not itemised (`ZO-CRM`) | ⚠️ pipeline view implied (`PD`) | ✅ Kanban is a named platform feature (`MON`) | ✅ Kanban view (Growth) (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ⚠️ pipeline stages; kanban not named → "Sheet View" only (`BIGIN`) | Kanban as first-class board with keyboard move + drag |
| Sales forecasting | ✅ Advanced Forecast & Pipeline Management; Predictive Forecasting add-on (`SF-S`) | ✅ Forecasting product, AI projections (`HS-SALES`) | ✅ forecasting (advanced SFA) (`MS-SALES` fn.5) | ✅ Sales forecasting from Standard (`ZO-CRM`) | ✅ forecast reports (Growth+) (`PD`) | ⚠️ dashboards only; forecast not itemised (`MON`) | ✅ Forecasting insights (Enterprise) (`FS`) | ⚠️ not itemised (`CR`) | ✅ Forecasting from Advanced+ (`SU`) | ⚠️ Target Meter (goal tracking, not forecast) from Premier (`BIGIN`) | Commit/best-case/pipeline views with adjustments + audit of changes |
| Quotes / CPQ | ✅ Quotes; Revenue Cloud from $200/user/mo (`SF-S`) | ✅ CPQ in **Revenue Hub** (separately purchased) (`HS-SALES`) | ✅ product/price lists, bundles, quotes, orders, invoices (`MS-SALES` fn.1) | ✅ CPQ from Professional (price rules) (`ZO-CRM`) | ✅ quotes/proposals/contracts with built-in e-signature (Premium) (`PD`) | ✅ quotes & invoices, 20/50/250/unlimited per month by tier (`MON`) | ⚠️ branded documents add-on $19/user/mo (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ❌ quotes not offered; invoices via Zoho Books integration (`BIGIN`) | Quote builder with versioning, approvals, PDF preview (mock), tax/discount |
| Products & price books | ✅ "Products and Price Books" (`SF-S`) | ⚠️ line items inside CPQ (`HS-SALES`) | ✅ products and price lists (`MS-SALES` fn.1) | ✅ CPQ price rules + inventory (Professional) (`ZO-CRM`) | ✅ product/subscription tracking (Growth+) (`PD`) | ⚠️ quote line items implied (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ✅ products management from Free (`BIGIN`) | Product catalogue + price books + discount rules |
| Sales automation / sequences | ✅ built-in Sales Flows; Sales Engagement add-on; Agentforce Sales Emails (`SF-S`) | ✅ multi-channel automated outreach, sequences (Professional) (`HS-SALES`) | ✅ Sales Engagement + Sales Accelerator (`MS-SALES` fn.7/fn.8) | ✅ Cadences + workflows from Standard; process automation from Professional (`ZO-CRM`) | ✅ automations & nurturing sequences (Growth+) (`PD`) | ✅ 250 / 25K / unlimited automations; email sequences (Pro+) (`MON`) | ✅ sales sequences (Pro+) (`FS`) | ✅ agentic + workflow automation (`CR`) | ✅ business process management; Smart Guides (Premier+) (`SU`) | ✅ 3 / 30 / 50 / 100 automations by tier (`BIGIN`) | Sequence builder: steps, waits, branches, stop conditions, throttles |
| Email & calendar integration | ✅ Gmail/Outlook integration; Activity Capture (`SF-S`) | ✅ connected email + Sales extensions + meeting scheduler (`HS-SALES`, `HS-CRM`) | ✅ Microsoft 365 interoperation; Copilot in Outlook (`MS-SALES`) | ✅ Gmail/Outlook/Zoho Mail + calendar + Slack/Zoom/Teams (`ZO-CRM`) | ✅ full email sync; meeting scheduler; contacts timeline (`PD`) | ✅ centralised comms hub; AI notetaker; mobile apps (`MON`) | ✅ chat/email/phone; email templates (`FS`) | ⚠️ not itemised (`CR`) | ✅ mail & calendar integration (Advanced+) (`SU`) | ✅ Gmail/Outlook/Google & Microsoft calendar sync (`BIGIN`) | Two-way mock connectors with sync-status UI and conflict states |

### D. Unified communications

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Unified inbox / omnichannel (email, SMS, WhatsApp, chat, social) | ✅ Omni-Channel Routing; Digital Channels add-on; Enhanced Messaging +$75/user/mo (`SF-SVC`) | ✅ shared inbox + omnichannel support + social inbox (`HS-CRM`, `HS-MKT`, `HS-SVC`) | ✅ unified routing; live & persistent chat on messaging and social channels (Premium) (`MS-SVC`) | ✅ multichannel ticketing (email, phone, chat, social) in CRM Plus; WhatsApp in Bigin (`ZO-CRM`, `BIGIN`) | ⚠️ shared team inboxes (Premium) (`PD`) | ✅ "centralised comms hub" (Standard+) (`MON`) | ✅ chat, email, phone channels (`FS`) | ⚠️ omnichannel stated for service product, detail not itemised (`CR`) | ⚠️ engagement across interactions; channels not itemised (`SU`) | ⚠️ WhatsApp Business + Email-In; no unified inbox claim (`BIGIN`) | Single inbox with channel badges, assignment, SLA timers, canned replies |
| Telephony | ✅ contact-center/CCaaS integrations; separate voice pricing (`SF-SVC`) | ✅ call tracking with IVR trees, routing, transfers, power dialer (`HS-SVC`, `HS-SALES`) | ✅ voice channel, inbound routing, outbound calling — Azure Communication Services billed separately (`MS-SVC` fn.7/8) | ✅ built-in calling in CRM (`ZO-CRM`) | ⚠️ no native telephony; CloudTalk partnership discount only (`PD`) | ⚠️ AI calling agent (outbound) + call logging; telephony not native (`MON`) | ⚠️ phone channel listed (`FS`) | ❓ | ⚠️ not itemised (`SU`) | ✅ built-in phone (dial, record, IVR, routing) + 100+ third-party providers (`BIGIN`) | Softphone UI mock (never places a real call); call log & disposition |

### E. Marketing

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Marketing automation | ✅ Marketing Cloud; dynamic email marketing from Starter (`SF-S`) | ✅ Marketing Hub (tiers Free→Enterprise) (`HS-MKT`) | ⚠️ marketing is a separate Dynamics product family, not itemised (`MS-SALES`) | ✅ Zoho Marketing Automation; CRM Plus includes journeys (`ZO-CRM`) | ✅ Campaigns add-on from $13.33 (`PD`) | ✅ monday campaigns product exists; mass email (Pro+) (`MON`) | ⚠️ not itemised (`FS`) | ✅ marketing product ("lead-to-revenue cycle") (`CR`) | ✅ Sugar Market (`SU`) | ⚠️ mass emails + Zoho Campaigns integration (`BIGIN`) | Journey-based automation with triggers, branching, goals, suppression |
| Email campaign builder | ✅ (`SF-S`) | ✅ (`HS-MKT`) | ⚠️ not itemised (`MS-SALES`) | ✅ email marketing + campaigns (`ZO-CRM`) | ✅ Campaigns add-on (`PD`) | ✅ mass emails (Pro+) (`MON`) | ⚠️ templates only (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ✅ mass email, templates, insights (`BIGIN`) | Block-based email builder + preview + send-list selector (mock send) |
| Landing page builder | ❓ | ✅ free landing page builder (`HS-CRM`) | ❓ | ✅ CRM Plus landing pages (`ZO-CRM`) | ❓ | ⚠️ forms (WorkForms) rather than pages (`MON`) | ❓ | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ⚠️ via Zoho Landingpage (`BIGIN`) | Landing page builder with publish states; no real hosting |
| Customer journey builder | ⚠️ Journey Builder exists (Marketing Cloud ACR listed) (`SF-A11Y`) | ✅ "map customer journeys" (Enterprise) + journey reports/Pathfinder (`HS-MKT`) | ⚠️ not itemised (`MS-SALES`) | ✅ Customer journeys (Professional) + journey orchestration (Enterprise) (`ZO-CRM`) | ❌ not found in sources consulted | ❌ not found in sources consulted | ❌ not found in sources consulted | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ⚠️ via Zoho Marketing Automation (`BIGIN`) | Visual journey canvas shared by marketing + lifecycle teams |
| Segmentation / lists | ⚠️ campaigns; list builder not itemised (`SF-S`) | ✅ audience segments + lookalike lists (`HS-MKT`) | ⚠️ not itemised (`MS-SALES`) | ✅ segmentation/filtering; ABM segmentation (Enterprise) (`ZO-CRM`) | ⚠️ filters/labels implied (`PD`) | ⚠️ board filters implied (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ✅ tags for segmentation/filtering (`BIGIN`) | Segment builder (AND/OR groups, saved segments, dynamic refresh) |
| Campaign ROI & attribution | ✅ Campaign Influence (3 campaigns/opportunity on Pro; 5 above) (`SF-S`) | ✅ multi-touch revenue attribution (`HS-MKT`) | ⚠️ not itemised (`MS-SALES`) | ⚠️ cross-functional dashboards; attribution not itemised (`ZO-CRM`) | ⚠️ not itemised (`PD`) | ❌ not found in sources consulted | ❌ not found in sources consulted | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ⚠️ not itemised (`BIGIN`) | First-touch / last-touch / linear attribution views with source drill-down |
| A/B testing | ❓ | ✅ A/B tests (Marketing **Enterprise**) (`HS-MKT`) | ❓ | ✅ A/B testing in CRM Plus (`ZO-CRM`) | ❌ | ❌ | ❌ | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ❌ | Variant testing for email + landing page with winner selection (simulated stats) |

### F. Service & customer success

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Help desk / ticketing | ✅ Case Management, Service Console, auto-assignment, escalation rules/queues (`SF-SVC`) | ✅ ticketing in Free tier; Help Desk Workspace (Professional) (`HS-CRM`, `HS-SVC`) | ✅ case management in all service plans (`MS-SVC`) | ✅ multichannel ticketing + web-to-case (CRM Plus / Professional) (`ZO-CRM`) | ❌ not found in sources consulted | ⚠️ monday service is a separate product (`MON`) | ⚠️ Freshdesk is a separate product (`FS`) | ✅ service product ("delight customers, drive service excellence") (`CR`) | ✅ Sugar Serve (`SU`) | ✅ case/ticket management via Email-In (`BIGIN`) | Ticket object with queues, priorities, SLA, requester↔contact link |
| SLA management | ✅ Service Contracts & Entitlements, Case Milestone Tracker (`SF-SVC`) | ✅ SLA management; conditional SLAs (Enterprise) (`HS-SVC`) | ⚠️ not itemised (`MS-SVC`) | ⚠️ not itemised in CRM editions (`ZO-CRM`) | ❌ | ❌ | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ❌ | SLA policies with business hours, pause conditions, breach warnings |
| Knowledge base | ✅ Knowledge Management (`SF-SVC`) | ✅ Knowledge Base (Professional+) + KB agent (beta) (`HS-SVC`) | ✅ knowledge management incl. authoring (`MS-SVC`) | ⚠️ not itemised in CRM editions (`ZO-CRM`) | ❌ | ⚠️ Workdocs rather than a KB (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ❌ | Article authoring, versioning, permissions, in-ticket suggestions |
| Customer portal | ✅ Help Center included; Authenticated Portal & Customer Community are paid add-ons (`SF-SVC`) | ✅ Customer Portal (Professional+) (`HS-SVC`) | ✅ Portals (Enterprise+) (`MS-SVC`) | ✅ Customer portals (Enterprise) / custom portals (Professional) (`ZO-CRM`) | ❌ | ❌ | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ❌ (Zoho CRM portals used instead) | Authenticated portal surface: tickets, KB, quotes, invoices, entitlements |
| Customer health scoring | ⚠️ not itemised (`SF-SVC`) | ✅ Customer Success Workspace with custom health scores (`HS-SVC`) | ⚠️ not itemised (`MS-SVC`) | ⚠️ churn likelihood prediction (Professional) (`ZO-CRM`) | ❌ | ❌ | ❌ | ⚠️ not itemised (`CR`) | ✅ early churn signals (Precision+ packages) (`SU`) | ✅ Churn Analyzer (`BIGIN`) | Configurable health-score model with weighting + trend + drivers |
| Renewal / churn management | ⚠️ not itemised (`SF-S`) | ✅ deal progression (beta) for retention/upsell; success workspace (`HS-SVC`) | ⚠️ not itemised (`MS-SALES`) | ⚠️ churn prediction (Professional) (`ZO-CRM`) | ⚠️ subscriptions + forecast, no churn workflow (`PD`) | ❌ | ❌ | ⚠️ not itemised (`CR`) | ✅ optimal reorder windows, cross-sell, early churn signals (Precision+) (`SU`) | ✅ CrossSell Genie + Churn Analyzer from Premier (`BIGIN`) | Renewal pipeline, playbooks, risk flags, expansion/contraction tracking |
| NPS / CSAT surveys | ✅ Feedback Management add-on; Surveys/Feedback Management ACR exists (`SF-SVC`, `SF-A11Y`) | ✅ customisable NPS, CSAT & feedback surveys (`HS-SVC`) | ⚠️ not itemised (`MS-SVC`) | ✅ surveys & feedback incl. NPS (CRM Plus) (`ZO-CRM`) | ❌ | ❌ | ❌ | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ❌ | Survey designer + response store + NPS/CSAT rollups on records |

### G. Projects, field sales, partners & documents

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Projects / delivery management | ❓ not itemised on sales/service pricing pages | ❌ not found in sources consulted | ✅ D365 Project Operations is a first-party product (`MS-SALES` nav) | ✅ project & work management in CRM Plus (`ZO-CRM`) | ✅ Projects add-on from $16 (`PD`) | ✅ the platform is a work-management product first; "manage pre- to post-sales" on Ultimate (`MON`) | ❌ not found in sources consulted | ⚠️ not itemised (`CR`) | ❌ not found in sources consulted | ❌ not found in sources consulted | Project objects with tasks, milestones, effort, delivery status linked to deals |
| Field sales & territory management | ✅ Sales Territories; Salesforce Maps / Maps Advanced (add-on, included on Max) (`SF-S`) | ⚠️ "organise teams" (Enterprise); territory model not itemised (`HS-CRM`) | ✅ territory management listed under advanced SFA (`MS-SALES` fn.5) | ✅ Territory management (Enterprise) (`ZO-CRM`) | ❌ not found in sources consulted | ⚠️ not itemised (`MON`) | ✅ territory management (Pro+) (`FS`) | ❌ | ✅ geo mapping (Advanced+) (`SU`) | ❌ not found in sources consulted | Territory tree, assignment rules, coverage map (mock geo), visit planning — no GPS |
| Partner / PRM | ✅ Partner Relationship Management from $10/login/month; Partner Cloud ACR exists (`SF-S`, `SF-A11Y`) | ⚠️ partner *programs* for agencies, not PRM (`HS-CRM`) | ✅ Partner Contact Center add-on; Partner Cloud listed (`MS-SVC`) | ✅ portals can be granted to partners/vendors (`ZO-CRM`) | ❌ | ❌ | ❌ | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ❌ | Partner accounts, deal registration, shared pipeline, partner scorecard |
| Document management & e-signature | ✅ Files; Salesforce Contracts; Document Generation ACR listed (`SF-S`, `SF-A11Y`) | ✅ document sharing, playbooks, document tracking (`HS-SALES`, `HS-CRM`) | ⚠️ not itemised (`MS-SALES`) | ✅ Zoho Sign integration for signing (`BIGIN`); documents in Free (`ZO-CRM`) | ✅ built-in e-signatures on quotes/contracts (Premium); Smart Docs add-on $32.50 (`PD`) | ⚠️ file attachments only; no e-signature statement (`MON`) | ✅ branded documents add-on $19/user/mo (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ✅ Zoho Sign integration (`BIGIN`) | Document library + versioning; e-signature is **mocked** (never claims legal validity) |

### H. Analytics & reporting

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Analytics & reporting | ✅ customisable reports & dashboards; Tableau Next; advanced reporting at higher tiers (`SF-S`) | ✅ reporting dashboard in Free; service & marketing analytics (`HS-CRM`, `HS-SVC`) | ✅ Power BI embedded (separate licence may be required) (`MS-SVC` fn.2) | ✅ reports & dashboards from Standard; unlimited reports from Professional (`ZO-CRM`) | ✅ AI-powered report creation from Lite (`PD`) | ✅ custom dashboards 1/5/50/unlimited by tier (`MON`) | ✅ deal insights; forecasting insights (Enterprise) (`FS`) | ✅ analytics in all Sugar Sell packages (`SU`) | ✅ Analytics (Standard+), AI Analytics (Advanced+) (`SU`) | ✅ charts & KPIs free; customisable from Premier (`BIGIN`) | Report library + ad-hoc explorer + scheduled snapshots (mock scheduling) |
| Custom report builder | ✅ ("Customizable Reports and Dashboards") (`SF-S`) | ✅ custom reporting (Professional+) (`HS-CRM`) | ✅ Power BI authoring (`MS-SALES` fn.2) | ✅ custom reports (`ZO-CRM`) | ✅ custom data/report building (Premium) (`PD`) | ✅ dashboards + board data export implied (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ✅ Analytics + rich reporting (`SU`) | ⚠️ custom dashboards only (`BIGIN`) | Grouping, filters, calculated columns, saved views, export |
| Dashboard builder | ✅ (`SF-S`) | ✅ (`HS-CRM`) | ✅ (`MS-SALES`) | ✅ (`ZO-CRM`) | ✅ (`PD`) | ✅ (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ✅ (`SU`) | ✅ customisable dashboards (Premier+) (`BIGIN`) | Drag-drop widget grid with per-role default dashboards |

### I. Automation & AI

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Workflow / no-code automation builder | ✅ Flow Builder (5 flows/org on Pro Suite, unlimited from Core); approval processes (`SF-S`) | ✅ workflows + workflow customisation (Professional) (`HS-SALES`) | ✅ Power Automate (additional licences may apply) (`MS-SALES` fn.3) | ✅ workflows, process automation, custom functions, wizards, approval process (`ZO-CRM`) | ✅ automations; formula fields; stage rules implied (`PD`) | ✅ 250 / 25K / unlimited custom automations/month; AI workflow builder (Pro+) (`MON`) | ✅ basic workflows (Growth); workflow customisation implied (Pro) (`FS`) | ✅ Business Studio + no-code designers (`CR`) | ✅ business process management; no/low-code configuration (`SU`) | ✅ instant/scheduled automation + **stage transition rules** (Premier+) (`BIGIN`) | Visual automation builder: trigger → conditions → actions, dry-run, version history |
| AI assistant / copilot | ✅ Agentforce for Sales from $125/user/mo; Momentum; Agentforce included on Max (`SF-S`) | ✅ Breeze Assistant (free) + Agent Hub; prospecting/customer agents (`HS-CRM`, `HS-SALES`) | ✅ Copilot in D365, Outlook and Teams (`MS-SALES` fn.9–11) | ✅ Zia AI agents from Standard; AI sales assistant (Enterprise) (`ZO-CRM`) | ✅ AI email tools, Nova meeting intelligence, AI report creation (`PD`) | ✅ Sidekick + named agents (meeting prep, outreach caller, lead sourcer) (`MON`) | ✅ Freddy AI Agent add-on $49/100 sessions (500 free sessions per paid plan) (`FS`) | ✅ AI Studio / AI Twin; agent + assistant model (`CR`) | ✅ Sugar Cube AI assistant, AI summaries, smart prompts (Advanced+) (`SU`) | ✅ AI writing assistant, record summary, reply assistant; MCP support (`BIGIN`) | Assistant panel with context handoff; AI outputs always labelled and editable |
| AI forecasting / insights | ✅ Opportunity Scoring; Deal Insights; Predictive Forecasting (add-on from Core) (`SF-S`) | ✅ AI deal scoring + AI-powered projections (`HS-SALES`) | ✅ conversation intelligence, pipeline intelligence, relationship analytics, predictive forecasting (`MS-SALES` fn.6/fn.8) | ✅ predictive intelligence: conversion/close/churn likelihood (Professional+) (`ZO-CRM`) | ⚠️ meeting intelligence and report generation; forecasting not AI-labelled (`PD`) | ⚠️ AI-powered data fields + meeting prep; forecast not AI-labelled (`MON`) | ✅ deal insights; forecasting insights (Enterprise) (`FS`) | ✅ AI agents across CRM touchpoints; agentic insights (`CR`) | ✅ Sugar Predict (retention/cross-sell/reorder); predictive lead scoring (`SU`) | ✅ Churn Analyzer / CrossSell Genie (`BIGIN`) | Explainable AI insights card: signal, confidence, suggested next action |

### J. Security & administration

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Role & permission management | ✅ Roles and Permissions; profiles; record types (`SF-S`) | ✅ permission sets (Starter); field-level permissions (Enterprise) (`HS-CRM`) | ⚠️ not itemised (`MS-SALES`) | ✅ profiles & roles; reporting hierarchy; field-level encryption (Enterprise) (`ZO-CRM`, `BIGIN`) | ✅ permissions at group and individual level (Premium) (`PD`) | ✅ advanced permissions (Ultimate) (`MON`) | ✅ field-level permissions (Enterprise) (`FS`) | ✅ governance + AI trust/governance model (`CR`) | ⚠️ not itemised (`SU`) | ✅ profiles & roles (`BIGIN`) | RBAC + record-sharing rules + field-level visibility, simulated in UI |
| SSO / MFA | ✅ Salesforce Identity (`SF-SVC`) | ✅ single sign-on (Enterprise) (`HS-CRM`) | ⚠️ present via Microsoft identity platform; not itemised on pricing page (`MS-SALES`) | ⚠️ Zoho Directory integration listed (`BIGIN`); not itemised for CRM (`ZO-CRM`) | ⚠️ password rules, IP/time restrictions, security alerts (Ultimate) (`PD`) | ⚠️ security & governance (Ultimate); SSO not named (`MON`) | ⚠️ not itemised (`FS`) | ❓ | ⚠️ not itemised (`SU`) | ⚠️ Zoho Directory (`BIGIN`) | SSO/MFA configuration screens with **mock** identity provider (no real OAuth) |
| Audit logs | ⚠️ Security Center is an add-on; audit trail not itemised (`SF-S`) | ⚠️ not itemised (`HS-CRM`) | ⚠️ not itemised (`MS-SALES`) | ⚠️ not itemised (`ZO-CRM`) | ⚠️ security alerts only (`PD`) | ✅ advanced log rules (Ultimate) (`MON`) | ✅ audit logs (Enterprise) (`FS`) | ❓ | ⚠️ not itemised (`SU`) | ⚠️ not itemised (`BIGIN`) | Immutable activity log with filters, export, retention policy (seeded data) |
| Multi-tenant administration (customer-visible org/workspace model) | ✅ org-level model with roles, sandboxes (1 partial on Core+, full on Advanced+) (`SF-S`) | ✅ accounts + "organise teams" (Enterprise) (`HS-CRM`) | ⚠️ environment model implied; not itemised (`MS-SALES`) | ✅ two-level model: **org vs team** modules, team-user licences, multi-team management (Enterprise) (`ZO-CRM`) | ⚠️ company account; user groups implied (`PD`) | ✅ workspaces (1/3/15/unlimited by tier) (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ⚠️ not itemised (`BIGIN`) | True tenant isolation in the UI: tenant switcher, tenant-scoped settings, tenant-branded shell |
| Accessibility (vendor states …) | ✅ vendor states: "we strive for conformance with WCAG 2.2 AA"; publishes ACRs incl. Sales Cloud & Service Cloud (`SF-A11Y`) | ❓ not confirmed (page not retrieved) | ❓ not confirmed (page not retrieved) | ❓ not confirmed (page not retrieved) | ❓ not confirmed | ✅ vendor states: platform aiming at WCAG 2.1 AA ("in the process"); website aiming at WCAG 2.0 AA (`MON-A11Y`) | ❓ not confirmed | ❓ not confirmed | ❓ not confirmed | ❓ not confirmed | WCAG 2.2 AA as an engineering gate: keyboard-first, visible focus, ARIA, reduced-motion, contrast |

### K. Globalisation, mobile & industry fit

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mobile experience | ✅ Salesforce mobile app; full offline mobile functionality (`SF-S`) | ✅ iOS + Android app (`HS-CRM`) | ✅ mobile app in all sales plans (`MS-SALES`) | ✅ mobile apps (`ZO-CRM`) | ⚠️ apps exist but not itemised on pricing page (`PD`) | ✅ iOS & Android with offline capability (Standard+) (`MON`) | ⚠️ not itemised (`FS`) | ✅ mobile app store links published (`CR`) | ✅ Mobile in Standard+ (`SU`) | ✅ iOS, iPadOS, Android, macOS (`BIGIN`) | Responsive web app + installable PWA; offline badge, never pretend-sync |
| Multi-currency | ⚠️ not itemised (`SF-S`) | ✅ "multiple currencies" (Starter) (`HS-CRM`) | ⚠️ not itemised (`MS-SALES`) | ⚠️ not itemised (`ZO-CRM`) | ⚠️ not itemised (`PD`) | ⚠️ not itemised (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ not itemised (`CR`) | ⚠️ not itemised (`SU`) | ✅ multiple currencies (Premier+) (`BIGIN`) | Multi-currency records with display currency + rate table (mock rates) |
| Multi-language / localisation | ⚠️ not itemised (`SF-S`) | ⚠️ not itemised (site is localised, product scope unstated) (`HS-CRM`) | ⚠️ not itemised (`MS-SALES`) | ✅ **28 languages** incl. Arabic, Hebrew, Hindi, Thai (`ZO-CRM` FAQ) | ⚠️ not itemised (`PD`) | ⚠️ website localised to 14 languages; product scope unstated (`MON`) | ⚠️ not itemised (`FS`) | ⚠️ website localised (13 languages); product scope unstated (`CR`) | ⚠️ not itemised (`SU`) | ⚠️ not itemised (`BIGIN`) | i18n framework + locale switcher + localised date/number/currency formats |
| RTL support | ❓ vendor help article on RTL language limitations exists (found via search result, page not retrieved in full) (`SF`) | ❓ | ❓ | ⚠️ Arabic and Hebrew supported as languages (`ZO-CRM`); RTL layout mirroring not confirmed | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ | Full logical-property RTL: mirrored layout, direction-aware icons, bidi-safe inputs |
| Industry templates / solutions | ✅ industry clouds listed in ACR index (Financial Services, Health, Education, Communications, Energy, Manufacturing, Media, Public Sector) (`SF-A11Y`) | ⚠️ website templates + marketplace solutions rather than industry data models (`HS-CRM`) | ✅ first-party industry/operations apps in nav (Finance, Supply Chain, Commerce, HR, Project Operations) (`MS-SALES` nav) | ⚠️ verticals implied; not itemised (`ZO-CRM`) | ⚠️ not itemised (`PD`) | ✅ template centre + industry verticals (`MON`) | ⚠️ not itemised (`FS`) | ✅ "industry workflows for 20 verticals" (`CR`) | ✅ industry-specific solutions for manufacturing, wholesale, software, business & financial services (`SU` FAQ) | ✅ pre-built pipeline templates (`BIGIN`) | 3–5 seed industry templates (data model + pipeline + automations + dashboards) |

### L. Commercial packaging & platform surface

| Capability | SF | HS | MS | ZO | PD | MON | FS | CR | SU | BIG | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Integration marketplace | ✅ AppExchange / AgentExchange (`SF-S`) | ✅ Marketplace: 2,000+ apps (`HS-CRM`) | ✅ Microsoft Marketplace + Partner Contact Center partner add-ons (`MS-SALES`, `MS-SVC`) | ⚠️ Zoho Marketplace referenced via product integrations; Zoho Flow listed (`BIGIN`) | ✅ 500+ integrations (`PD`) | ✅ app marketplace (`MON`) | ⚠️ not itemised (`FS`) | ✅ marketplace.creatio.com (`CR`) | ✅ marketplace.sugarai.com + 180+ ERP integrations (`SU`) | ✅ marketplace incl. 100+ telephony providers (`BIGIN`) | Curated integration catalogue with capability badges and install states (mock) |
| Developer platform / APIs / webhooks | ✅ Web Services API (additional $25/user/mo on Pro Suite); Lightning Platform; developer sandboxes (`SF-S`) | ✅ developer tools portal (`HS-CRM`) | ✅ Power Platform + custom apps (`MS-SALES` fn.4) | ✅ APIs with 5,000 calls/day on Free; custom functions/low-code (Enterprise) (`ZO-CRM`) | ⚠️ not itemised (`PD`) | ✅ 25,000 API calls/day (Ultimate); app development program (`MON`) | ⚠️ sandbox (Enterprise); APIs not itemised (`FS`) | ✅ unlimited API calls claimed; marketplace developer registration (`CR`) | ✅ REST + SOAP APIs (`SU`) | ✅ developer APIs; MCP support (`BIGIN`) | Mock API console: keys, scopes, rate-limit meter, webhook event log with replay |
| Subscription billing & licensing (how the vendor charges) | ✅ per-user/month + add-ons + AI "Flex Credits" (500K/1M/2.75M per org/year by tier); annual contracts typical (`SF-S`) | ✅ per-seat tiers + credit allowances (`HS-CRM`) | ✅ per-user/month + **Copilot Credits** (1,000/user/mo on Premium; PAYG or pre-purchase) (`MS-SALES`) | ✅ per-user/month by edition + add-on licences + separately licensed **team users**; monthly or yearly, no lock-in (`ZO-CRM`) | ✅ per-seat/month (annual saves up to 42%) + 5 add-ons priced separately (`PD`) | ✅ per-seat/month with seat step-downs and feature caps (contacts, automations, quotes, API calls) (`MON`) | ✅ per-user/month by edition + add-ons (documents, AI sessions) (`FS`) | ✅ unlimited-user packaging claim; no public list prices (`CR-P`) | ✅ per-user/month by package + Sugar Connect+ at +$20/user/mo; Precision+ on request (`SU`) | ✅ per-user/month by edition + record/pipeline/AI-credit caps; add-ons available (`BIGIN`) | Transparent seat-based plans with metered AI credits, in-app upgrade path, no hidden add-on gates for core CRM |
| Pricing model shape (summary) | suite editions, per user, AI credits metered (`SF-S`) | hub-tiered, per seat, permanent free tier (`HS-CRM`) | per user per edition + Copilot Credits (`MS-SALES`) | 5 CRM editions + add-ons + discounted team-user licence (`ZO-CRM`) | 4 seat tiers + module add-ons (`PD`) | 4 seat tiers with hard usage caps (`MON`) | 3 tiers + add-ons, 21-day trial (`FS`) | gated / no public list price; unlimited-user positioning (`CR-P`) | 3 named packages published + 2 contact-sales packages (`SU`) | 4 tiers incl. free, per user, record caps (`BIGIN`) | Publish list prices; cap AI usage explicitly; never meter core CRM records |

### 2.1 Coverage check against the required capability list

Rows marked in this document: public website/marketing experience, signup & onboarding/trial, dashboard design, navigation simplicity, contact management, company/account management, lead management, lead scoring, pipeline/opportunity management, multiple pipelines, drag-and-drop kanban, sales forecasting, quotes/CPQ, products & price books, sales automation/sequences, email & calendar integration, unified inbox/omnichannel, telephony, marketing automation, email campaign builder, landing page builder, customer journey builder, segmentation/lists, campaign ROI & attribution, A/B testing, help desk/ticketing, SLA management, knowledge base, customer portal, customer health scoring, renewal/churn management, NPS/CSAT surveys, projects/delivery, field sales & territory management, partner/PRM, document management & e-signature, analytics & reporting, custom report builder, dashboard builder, AI assistant/copilot, AI forecasting/insights, workflow/no-code automation builder, custom objects, custom fields, page layout customisation, role & permission management, SSO/MFA, audit logs, data import/export, duplicate management, integration marketplace, developer platform/APIs/webhooks, mobile experience, multi-currency, multi-language/localisation, RTL support, industry templates/solutions, subscription billing & licensing, multi-tenant administration, accessibility, pricing model shape — **61 of 61**.

---

## 3. Notes per platform

### 3.1 Salesforce (Sales Cloud + Service Cloud)

- **Positioning:** enterprise reference point; two separate per-user clouds that share one platform and one data model.
- **Retrieved packaging:** Free Suite $0; Starter Suite $25; Pro Suite $100; **Core $195**; **Advanced $395**; **Max $550** (USD/user/month, billed annually) — <https://www.salesforce.com/sales/pricing/>. Service Cloud follows the same ladder ($25/$100/$195/$395/$550) — <https://www.salesforce.com/service/pricing/>.
- **Strength:** breadth and configurability; explicit territory, forecast, sandbox, role/permission and platform-extension features; separate, dated accessibility conformance reports including Sales Cloud and Service Cloud — <https://www.salesforce.com/company/legal/508_accessibility/>.
- **Weakness (as packaged):** the price of entry for a professional sales process is high; several headline capabilities are add-ons (Lead/Predictive Forecasting on Core, Agentforce from $125/user/month, Revenue Cloud from $200/user/month, PRM from $10/login/month, Enhanced Messaging +$75/user/month on Service Cloud). AI is metered in "Flex Credits".
- **What we should learn:** a clean edition ladder with an obvious "professional" step; strong naming of *capability groups*; make add-on boundaries explicit in the UI (feature discovery must show what plan unlocks what).

### 3.2 HubSpot (CRM + Sales/Service/Marketing/Content/Data/Revenue Hubs)

- **Positioning:** the ease-of-use and time-to-value benchmark; a genuinely free CRM with permanent free tier (up to two users / 1,000 contacts as stated on the page) — <https://www.hubspot.com/products/crm>.
- **Retrieved packaging:** Free CRM; Starter from ~$15/seat/month (CRM page) and hub-specific Starter from ~$10/seat/month; Professional from ~$50–$100/seat/month; Enterprise from ~$75–$150/seat/month — <https://www.hubspot.com/products/crm>, <https://www.hubspot.com/products/sales>, <https://www.hubspot.com/products/service>, <https://www.hubspot.com/products/marketing>. *Hub pricing pages themselves did not render for retrieval; treat exact figures as vendor-stated-on-product-page only.*
- **Strength:** connected objects across marketing/sales/service without an integration; a strong help-desk feature set (help desk workspace, SLA management incl. conditional SLAs at Enterprise, knowledge base, customer portal, success workspace with custom health scores, NPS/CSAT) — <https://www.hubspot.com/products/service>; strong marketing surface (audience segments, lookalike lists, WhatsApp/SMS messaging, multi-touch attribution, A/B tests at Enterprise) — <https://www.hubspot.com/products/marketing>.
- **Weakness (as packaged):** hub-by-hub purchasing means the "cheap" entry is fragmented; custom objects and SSO sit at Enterprise; CPQ requires a Revenue Hub seat — <https://www.hubspot.com/products/sales>.
- **What we should learn:** a free tier that is genuinely usable for 2–3 seats is the best top-of-funnel asset in the category; connect marketing→sales→service on one object graph instead of bolting modules together; wording like "everything in Professional, plus…" makes upgrades legible.

### 3.3 Microsoft Dynamics 365 (Sales + Customer Service)

- **Positioning:** enterprise platform play with the deepest platform-level extensibility (Power Platform, Teams, M365) and AI metering.
- **Retrieved packaging:** Sales Professional $65, Sales Enterprise $105, Sales Premium $150/user/month paid yearly (Microsoft Relationship Sales is variable, 10-seat minimum) — <https://www.microsoft.com/en-us/dynamics-365/products/sales/pricing/>. Customer Service Professional $50, Enterprise $105, Premium $195/user/month paid yearly — <https://www.microsoft.com/en-us/dynamics-365/products/customer-service/pricing/>.
- **Strength:** honest, itemised footnotes describing exactly which capability sits where (conversation intelligence, sales accelerator, predictive lead & opportunity scoring, pipeline intelligence, relationship analytics); Premium bundles 1,000 Copilot Credits/user/month; customer service includes "unlimited named users" and an explicit workforce-engagement suite (forecasting, shift planning, intraday & adherence, quality management, screen recording).
- **Weakness (as packaged):** requires Power Apps/Power Automate licences for the customisation story; contact-center voice is billed through Azure Communication Services; the ecosystem is heavy for a small team.
- **What we should learn:** publish a *footnoted* comparison table — precision builds trust; separate "platform staff" surfaces (workforce management, quality) from "rep" surfaces; make AI credit consumption explicit rather than vague "included AI".

### 3.4 Zoho CRM (and Zoho CRM Plus)

- **Positioning:** the price/feature-density leader; an explicit two-tier licensing model ("org users" vs "team users") that no other vendor in this set uses.
- **Retrieved packaging:** Free (3 users), Standard, Professional, Enterprise, Ultimate, plus Zoho CRM Plus (Starter/Enterprise) and Bigin as the separate low-end product — <https://www.zoho.com/crm/zohocrm-pricing.html>. FAQ confirms **28 supported languages** including Arabic and Hebrew, and "no contracts or commitments" (monthly or yearly).
- **Strength:** CPQ, customer journeys, portals, territory management, wizards/sequential data collection, approval processes, developer sandbox, field-level encryption, custom functions — each with a stated edition; cadences and AI agents from the entry paid tier.
- **Weakness (as packaged):** capability is spread across sibling products (Zoho Desk, Zoho Campaigns, Zoho Analytics, Zoho Bookings are referenced from the CRM pricing page), so the "one platform" claim is an ecosystem claim rather than a single-app claim; team users are powerful but their restrictions (no reports/dashboards, no AI features, no Google/Microsoft integrations) need careful explanation.
- **What we should learn:** a secondary low-cost licence for non-sales staff is a strong, defensible idea — but the restrictions must be visible *before* purchase; publishing "everything in X, plus …" per edition works.

### 3.5 Pipedrive

- **Positioning:** sales-only, workflow-first, transparent add-on economy.
- **Retrieved packaging:** Lite $14, Growth $39, Premium $59, Ultimate $79 per seat/month billed annually (monthly available, annual saves up to 42%); add-ons LeadBooster from $32.50, Projects from $16, Campaigns from $13.33, Web Visitors from $41, Smart Docs from $32.50 — <https://www.pipedrive.com/en/pricing/>.
- **Strength:** crisp tier promises ("Organize your sales", "Automate emails and follow-ups", "Drive success from lead to close", "Optimize performance"); contracts/e-signature appear at Premium; data enrichment, custom scoring and permissions all stated per tier; 14-day trial with no credit card.
- **Weakness (as packaged):** no help desk, no KB, no customer portal, no marketing automation beyond Campaigns add-on; AI is present but not packaged as a named assistant tier.
- **What we should learn:** the clearest "what plan is for me" copy in the set; module-as-add-on pricing lets buyers pay only for what they adopt; keep the pipeline UI as the product's centre of gravity.

### 3.6 monday CRM

- **Positioning:** work-management platform re-skinned as a CRM; AI agents bundled per plan with hard usage caps.
- **Retrieved packaging:** Basic $12, Standard $17, Pro $28 per seat/month (annual; $18/$25/$41 monthly), Ultimate custom; minimum 3 users; functionality is quantified per plan (1 workspace/1 dashboard/1,000 active contacts/20 quotes on Basic → unlimited on Ultimate; 250 → 25K custom automations/month) — <https://monday.com/crm/pricing/>.
- **Strength:** every plan states *how much* you get; AI agents (outreach caller, lead sourcer, meeting prep, notetaker, Sidekick, vibe app builder) bundled from Standard; quotes & invoices included; HIPAA and advanced permissions at Ultimate; publicly published accessibility statement (platform targeting WCAG 2.1 AA, website WCAG 2.0 AA) — <https://monday.com/accessibility-statement>.
- **Weakness (as packaged):** a board-centric model means CRM-specific depth (territory routing, forecasting, SLA/help desk) is thinner than the specialist competitors; caps (columns per board, active contacts) are the main upgrade trigger, which can feel punitive.
- **What we should learn:** quantified plan limits are good for trust — but never cap *records* of core CRM objects; a visible, honest accessibility statement is a differentiator we can match.

### 3.7 Freshsales (Freshworks)

- **Positioning:** mid-market price/performance with a small tier count and an ecosystem neighbour (Freshdesk/Freshservice) for service.
- **Retrieved packaging:** Growth $9, Pro $39, Enterprise $59 per user/month billed annually (annual/monthly toggle, save 20%); add-ons: Branded documents $19/user/month, Freddy AI Agent $49/100 sessions; 500 AI sessions free per account; 21-day trial — <https://www.freshworks.com/crm/pricing/>.
- **Strength:** clear capability steps (kanban + lifecycle + chat/email/phone → scoring, deal insights, territory management, sequences → forecasting, field-level permissions, custom modules, sandbox, audit logs); one of the cheapest credible entry points with a real territory-routing capability at mid tier.
- **Weakness (as packaged):** help desk, KB, portal and surveys live in other Freshworks products; AI is session-metered; marketing automation is not part of the CRM tiering story.
- **What we should learn:** three tiers are enough for an SMB-focused CRM; state the number of AI sessions/credits openly so buyers can model cost; put audit logs + sandbox behind the top tier as an enterprise signal.

### 3.8 Creatio

- **Positioning:** AI-native, no-code-first platform; "no limits" packaging rhetoric.
- **Retrieved evidence:** the corporate page claims **unlimited users, unlimited custom agents, unlimited applications, unlimited workflows, unlimited custom objects and API calls**, industry workflows for 20 verticals, and AI Studio / AI Twin / Business Studio; it also cites Gartner/Forrester placements — <https://www.creatio.com/>. The pricing page publishes **no list prices** (contact-sales pattern) — <https://www.creatio.com/products/pricing>.
- **Strength (as stated):** the strongest no-code configuration narrative in the set; industry workflow library; governance framing for AI ("AI trust and governance").
- **Weakness (as packaged):** no public pricing means no bottom-up cost model; the "unlimited" claims are not comparable with per-seat competitors; concrete CRM feature lists were not retrievable on the pages we fetched (all `⚠️`/`❓` cells reflect that).
- **What we should learn:** "unlimited custom objects/automations" is a compelling packaging idea for our own product narrative; a no-code configuration surface (fields, layouts, automations) should be designed as a first-class product area, not a settings afterthought. Also: we publish prices — opacity is a weakness, not a feature.

### 3.9 SugarCRM / SugarAI

- **Positioning:** mid-market/enterprise "precision selling" with ERP-data intelligence; explicit anti-Salesforce TCO positioning.
- **Retrieved packaging (as published):** Sugar Sell Standard+ $68, Advanced+ $98, Premier+ $155 per user/month billed annually; Sugar Connect+ +$20; Precision+ (Precision sell + Predict) packages on request — <https://sugarcrm.com/pricing/>.
- **Strength:** package names map to outcomes (forecasting, mail/calendar integration, geo mapping, AI summaries, Sugar Cube AI assistant, AI analytics on Advanced+; data enrichment, Smart Guides, Discover, meeting preparation on Premier+); Sugar Predict adds cross-sell recommendations, optimal reorder windows and early churn signals; REST and SOAP APIs; no/low-code configuration; company states ISO 27001 / SOC 2 Type 2 / GDPR alignment and 4,000+ customers, 1M+ users (vendor claims, not independently verified here).
- **Weakness (as packaged):** forecasting and mail/calendar sync are not in the entry package; the precision/ERP narrative assumes an ERP; the brand transition (SugarCRM → SugarAI) creates naming confusion in-market.
- **What we should learn:** outcome-named packages reduce the "which tier?" burden ("Standard+" reads as sales basics, "Advanced+" as guided selling, "Premier+" as full precision); retention/churn intelligence is a purchase driver worth productising early; but avoid the mistake of putting basic email/calendar sync in a higher tier.

### 3.10 Bigin (Zoho)

- **Positioning:** first CRM for spreadsheet-first small businesses; the lowest credible entry price in the set.
- **Retrieved packaging:** Free (single user, 500 records, 1 pipeline), Express $9 (annual $7), Premier $15 ($12), Bigin 360 $21 ($18) per user/month billed yearly; 15-day trial, free onboarding, 100% money-back guarantee — <https://www.bigin.com/pricing.html>.
- **Strength:** very concrete feature accounting (3/5/15 pipelines, 30/50/100 automations, 10/25/50 custom fields, 1,000/3,000 AI credits, 20/50/... quotes); built-in phone with IVR and recording; WhatsApp Business integration; Zoho Sign integration; payment links; Email-In creates records from inbound email; stage transition rules; MCP support for connecting AI tools.
- **Weakness (as packaged):** records are both a cap and the unit of value ("each row … across Pipelines, Contacts, Activities and Notes is a record"), which is confusing and punitive; the CRM is a front door into a large Zoho ecosystem, so "one tool" claims need care.
- **What we should learn:** a single-login, single-pipeline free tier converts; but express limits in objects users understand (contacts, deals, storage, AI actions) rather than a synthetic "record" unit.

### 3.11 CRM Platform (target) — deliberate positioning

Not a competitor. Our intended approach, summarised: **one tenant = one customer organisation**, three first-party surfaces (marketing website, CRM app, platform-admin), a configurable object model with real custom objects from the first release, pipeline + kanban as the centre of gravity, messaging inbox and help desk as first-class modules, transparent seat pricing with explicit AI caps, WCAG 2.2 AA as a gate rather than a promise, and a *mock* integration layer that never misrepresents a simulated action as a real one.

---

## 4. Classification of capabilities

### 4.1 Essential in every serious CRM

Contacts, companies, leads, deals, multiple pipelines, kanban + list views, activity timeline (calls/emails/meetings/notes), tasks and reminders, owner/assignment rules, saved views and filters, search, notes and file attachments, CSV import/export, basic reporting and a dashboard per role, custom fields, user/role management, tenant-scoped admin settings, audit trail of record changes, list/detail record views with inline edit, mobile/responsive access, and email/calendar integration (or at minimum mock connectors with an obvious "not connected" state).

### 4.2 Especially valuable for enterprise buyers

Forecast roll-ups with adjustments and audit, territory/assignment rules, approval workflows, role + field-level permissions, SSO/MFA, sandbox/environments, audit logs with retention, data-quality/duplicate controls, custom objects and page-layout customisation, sandboxed automation testing, per-tenant branding, data-residency/region hints, documented accessibility conformance, API keys/scopes/rate limits, webhook event logs, SLA-managed service desk, entitlement/contract model, and integration governance (who installed which connector). Evidence that these are gate-keepers: Dynamics keeps territory + forecasting in advanced SFA (<https://www.microsoft.com/en-us/dynamics-365/products/sales/pricing/>), HubSpot keeps custom objects and SSO at Enterprise (<https://www.hubspot.com/products/crm>), Freshsales keeps field-level permissions, custom modules, sandbox and audit logs at Enterprise (<https://www.freshworks.com/crm/pricing/>), Zoho keeps approval processes, sandbox and field-level encryption at Enterprise (<https://www.zoho.com/crm/zohocrm-pricing.html>).

### 4.3 Valuable for small business

Free or near-free entry tier with no credit card, one-click import from spreadsheets, single pipeline by default with templates, built-in forms/lead capture, simple mass email with insights, WhatsApp/SMS reach, built-in dialler or a phone-integration directory, tag-based segmentation, duplicate cleanup, simple automation (1–10 rules), a mobile app, invoice/payment links, and human onboarding. Evidence: HubSpot's permanent free tier (<https://www.hubspot.com/products/crm>), Zoho's free edition for 3 users (<https://www.zoho.com/crm/zohocrm-pricing.html>), Bigin's free single-user tier and free onboarding (<https://www.bigin.com/pricing.html>), Pipedrive's no-credit-card trial (<https://www.pipedrive.com/en/pricing/>).

### 4.4 Genuine competitive differentiators (worth designing deliberately)

1. **Free but real** — a permanent free tier that covers core CRM for a small team (HubSpot).
2. **Non-sales seat licence** — a cheap "team user" for support/finance/legal staff with an explicit permission boundary (Zoho).
3. **Quantified plan limits** — stating every cap up front (monday CRM).
4. **Outcome-named packages** — tier names that describe the job, not the feature count (Sugar).
5. **No-code configuration as the product** — unlimited custom objects/workflows as a packaging promise (Creatio).
6. **Evidence-grade accessibility** — published, dated conformance reports (Salesforce) or a public accessibility statement with focus areas (monday).
7. **Bundled AI with visible metering** — credits/sessions per seat rather than an opaque "AI included" claim (Microsoft Copilot Credits, Freshworks sessions, monday AI credits).
8. **Module add-on economy** — projects, campaigns, smart docs, lead booster as separable modules (Pipedrive).
9. **A low-end brand** — a deliberately simpler sibling product for first-time buyers (Bigin).
10. **Honest footnoted comparison tables** — footnotes that admit where a capability is missing (Microsoft).

### 4.5 Better as optional modules

Marketing automation and journeys, email campaign builder, landing pages, A/B testing, campaign attribution, telephony/contact-centre, projects & delivery, field sales/geo, PRM, e-signature, knowledge base, surveys/NPS, billing/invoicing, and industry templates. Every vendor that bundles these has to make them shallow; the vendors that split them (Pipedrive add-ons at <https://www.pipedrive.com/en/pricing/>, Salesforce add-ons at <https://www.salesforce.com/sales/pricing/>) keep the core coherent.

### 4.6 Defer to later releases

Native telephony and SMS delivery, real payments/invoicing, real e-signature, real AI inference, real OAuth connectors, marketing send infrastructure, contact-centre workforce management (shift planning, adherence, screen recording — a Microsoft Premium capability per <https://www.microsoft.com/en-us/dynamics-365/products/customer-service/pricing/>), quality management, complex CPQ approvals, ERP data ingestion (Sugar's Precision+ pattern, <https://sugarcrm.com/pricing/>), and low-end "vibe app builder" style generators.

---

## 5. Design lessons

### 5.1 Patterns worth adopting (described generically, not visually)

1. **One workspace as the home.** A single "my day" surface that merges tasks, deals needing action, unanswered messages and at-risk accounts. monday quantifies dashboards per plan (<https://monday.com/crm/pricing/>) and HubSpot ships a reporting dashboard even on Free (<https://www.hubspot.com/products/crm>); the *pattern* — landing on work, not on a menu — is the lesson.
2. **Pipeline as the centre of gravity.** Keep the deal board one click from anywhere; make stage transitions the primary interaction and require only the fields the stage genuinely needs (Bigin exposes stage-transition rules as a named feature, <https://www.bigin.com/pricing.html>).
3. **Progressive disclosure in records.** Header (identity + owner + value), then tabs: activity, files, related records, details, automations. Salesforce and Dynamics both market "workspaces"/"consoles" rather than raw record forms (<https://www.salesforce.com/sales/pricing/>, <https://www.microsoft.com/en-us/dynamics-365/products/sales/pricing/>).
4. **Plan-aware affordances.** When a user hits a gated capability, show what it is, what it does, and which plan unlocks it — instead of hiding it. Salesforce, HubSpot, Freshworks and Zoho all gate significant capability by tier; the winner on trust will be the one that teaches rather than blocks.
5. **Explicit metering.** Show remaining AI credits / sessions / automations in context. Microsoft (Copilot Credits), Freshworks (bot sessions) and monday (AI credits, automation counts) all meter; buyers reward transparency.
6. **Two-level information architecture.** Modules at level one, records at level two, everything else in a context panel. Zoho's org-modules vs team-modules split is the clearest documented example of deliberately separating "sales data" from "supporting data" (<https://www.zoho.com/crm/zohocrm-pricing.html>).
7. **Configuration as a product area.** Separate "build" surfaces (objects, fields, layouts, automations, permissions) from "do" surfaces (records, inbox, boards), entry-gated by role. Creatio's whole pitch is that configuration is the platform (<https://www.creatio.com/>); Sugar advertises no/low-code configuration as a cost advantage (<https://sugarcrm.com/pricing/>).
8. **Admin console with a change history.** Every settings change should be visible and reversible; monday sells "advanced log rules" and "security & governance" at its top tier (<https://monday.com/crm/pricing/>) — logs are a feature, not plumbing.
9. **Quantified, human-readable limits.** "1,000 active contacts & deals", "250 automations/month" (monday) beats "scalable". But express limits in objects users already understand.
10. **Accessibility as an engineering gate.** Keyboard-first navigation, visible focus, ARIA on dynamic content, contrast, reduced-motion, and a published statement. Salesforce publishes dated conformance reports (<https://www.salesforce.com/company/legal/508_accessibility/>); monday publishes goals and focus areas (<https://monday.com/accessibility-statement>).
11. **Explicit "not connected / demo data" states.** Since our integration and AI layers are mocked, every simulated surface should carry a persistent, non-annoying provenance badge. This is the ethical inverse of a fake success state.
12. **Import-first onboarding.** Every serious CRM treats data import as a first-run step (HubSpot CRM import, <https://www.hubspot.com/products/crm>; Pipedrive import, <https://www.pipedrive.com/en/pricing/>). Show a dry-run, a row-level error report and a rollback option.

### 5.2 Anti-patterns to avoid

1. **Synthetic limit units.** Counting "records" across unrelated objects (as Bigin does, <https://www.bigin.com/pricing.html>) makes limits feel arbitrary. Cap what users can reason about.
2. **Hiding core workflow behind an add-on.** Email/calendar sync, forecasting or basic reporting should never be an upsell — Sugar puts mail/calendar in Advanced+ (<https://sugarcrm.com/pricing/>) and Salesforce charges extra for forecasting on Core (<https://www.salesforce.com/sales/pricing/>); both are friction points users complain about.
3. **Module silos with different navigation.** Multiple products that each have their own nav, search and settings (ecosystem plays in Zoho, Freshworks, HubSpot) force users to learn the same primitives repeatedly.
4. **Pricing opacity.** A public pricing page with no numbers (Creatio, <https://www.creatio.com/products/pricing>) pushes the entire evaluation to a sales call.
5. **Unverifiable superlatives.** Lead with capability and limits, not "#1" or uncited ROI percentages.
6. **Settings sprawl.** Dozens of undifferentiated admin pages with no search. Group settings by domain (people, data, automation, channels, security, branding) and make them searchable.
7. **Fake success.** A toast that says "email sent", "payment captured", "signature completed" or "AI analysed" when nothing happened is the single worst thing a frontend-only build can do. Use "simulated", "queued in demo mode", or an explicit demo badge.
8. **AI as decoration.** Don't put a sparkle icon on deterministic features. Label AI output as a suggestion, show what data it used, and make it editable before it is written to a record.
9. **Modal-first CRUD.** Full-page record editors are a tax on rapid data entry; favour inline edit and a side panel for secondary objects.
10. **Table-only views.** Every list should offer at least a board and a compact list mode.
11. **Uncapped "unlimited" marketing claims.** "Unlimited everything" reads as a red flag to procurement unless it is backed by published terms (Creatio's claims are marketing statements, <https://www.creatio.com/>).
12. **Ignoring RTL until the end.** Every component should be built with logical properties from day one; retrofitting mirroring is disproportionately expensive.

---

## 6. What this means for our scope

- **Ship the essentials end-to-end before adding breadth.** A CRM that nails contacts/companies/deals/pipelines/activity/import/reporting will beat a product with twelve shallow modules.
- **Treat configuration as a first-class surface.** Objects, fields, layouts and automation are the product, not settings.
- **Make the AI, integrations and channel layers explicitly simulated.** Honest provenance is a differentiator we can own in a demo context.
- **Design permissions and tenancy from the first screen.** Role-aware navigation and tenant-scoped data must be structural, not bolted on.
- **Publish prices and caps in the product UI.** Borrow the transparency patterns; avoid the synthetic-unit mistake.
- **Accessibility and RTL are gates.** Logical properties, focus management, keyboard paths and contrast belong in the definition of done from release one.
- **Never reproduce competitor visuals.** Benchmark functionality; design our own everything.

---

## 7. Sources consulted

Every URL below was retrieved on **2026-10-13** and is the sole evidence source for the matrix cells that cite it.

**Salesforce**
1. <https://www.salesforce.com/sales/pricing/> — Sales Cloud editions, prices, feature comparison, add-on prices, trial terms.
2. <https://www.salesforce.com/service/pricing/> — Service Cloud editions, prices, feature comparison, add-on prices.
3. <https://www.salesforce.com/company/legal/508_accessibility/> — accessibility position and conformance-report index.

**HubSpot**
4. <https://www.hubspot.com/products/crm> — free-CRM scope, tier summary, marketplace scale, product surfaces.
5. <https://www.hubspot.com/products/sales> — Sales Hub capabilities and tier prices.
6. <https://www.hubspot.com/products/service> — Service Hub capabilities, SLA/health-score/survey features, tier prices.
7. <https://www.hubspot.com/products/marketing> — Marketing Hub capabilities, WhatsApp/SMS, attribution, A/B tests, tier prices.

**Microsoft**
8. <https://www.microsoft.com/en-us/dynamics-365/products/sales/pricing/> — Sales plans, prices and footnotes.
9. <https://www.microsoft.com/en-us/dynamics-365/products/customer-service/pricing/> — Customer Service plans, prices, footnotes, workforce engagement and contact-centre rows.

**Zoho**
10. <https://www.zoho.com/crm/zohocrm-pricing.html> — CRM editions and per-edition feature lists, team-user licensing, 28 languages, CRM Plus scope, FAQ.
11. <https://www.bigin.com/pricing.html> — Bigin tiers, limits, features, add-ons and integrations.

**Pipedrive**
12. <https://www.pipedrive.com/en/pricing/> — plan contents and prices, add-on prices, integrations count, FAQ.

**monday.com**
13. <https://monday.com/crm/pricing> — plan contents, quantified caps, AI agents, platform feature links, FAQ.
14. <https://monday.com/accessibility-statement> — vendor accessibility goals (dated March 20, 2026).

**Freshworks**
15. <https://www.freshworks.com/crm/pricing/> — Freshsales tiers, add-on prices, trial terms, FAQ.

**Creatio**
16. <https://www.creatio.com/> — platform positioning, "unlimited" claims, no-code/AI surfaces, industries.
17. <https://www.creatio.com/products/pricing> — verification that no list prices are published (contact-sales pattern).

**Sugar**
18. <https://sugarcrm.com/pricing/> — Sugar Sell packages and prices, Connect+ price, Precision+ scope, FAQ, security claims.

### 7.1 URLs attempted but not usable as evidence

| URL | Outcome on 2026-10-13 |
|---|---|
| <https://www.hubspot.com/pricing/crm> | returned no usable content (client-rendered) |
| <https://www.hubspot.com/pricing/sales> | returned no usable content |
| <https://www.hubspot.com/pricing/marketing> | returned no usable content |
| <https://www.creatio.com/pricing> | HTTP 404 |
| <https://ohub.com/pricing/> | HTTP 404 — vendor dropped from scope |

**Search-result-only reference (not fully retrieved, flagged for verification if ever needed):** Salesforce Help article on right-to-left language limitations (`help.salesforce.com/s/articleView?id=sf.search_rtl_limitations.htm`) — surfaced in search results, page body not retrieved; the RTL row in §2.K therefore remains `❓`/`⚠️` and must not be quoted as a vendor commitment.

---

*End of document. Retrieval date: 2026-10-13. Re-verify all pricing and packaging before use.*
