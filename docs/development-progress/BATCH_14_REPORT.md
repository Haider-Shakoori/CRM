# Batch Report — Batch 14

**Batch:** 14 — Marketing automation
**Status:** Implemented. Verified in the end-of-run consolidated pass.
**Preceding batch:** [`BATCH_13_REPORT.md`](./BATCH_13_REPORT.md)

Batch 14 turns the marketing module from a single placeholder route into the full
campaign → audience → message → journey → attribution chain. All seven service modules
behind it were built in this batch, and all of them run against the synthetic dataset
that already existed.

---

## 1. Features implemented

### Campaigns — plan, audience and derived performance

- Campaign list with search, status filter and paging, plus a page-scope KPI strip
  (campaigns, leads, attributed revenue, ROI) that says which rows it covers.
- Campaign detail with the attributed-revenue panel, goal progress, a funnel over the
  derived counts and the full metric set (delivery, opens, clicks, bounces, unsubscribes,
  spam complaints, conversions).
- Draft creation (`CampaignForm`) and duplication without scheduling.
- `launch`, `pause` and `resume` change local status only. The screen states this in an
  `Alert`-level demo notice and the mutations carry `simulated: true`, so the toast reads
  as a simulation notice rather than a delivery confirmation.
- A campaign calendar over `campaigns.calendar(from, to)`.

### Audiences — segments with nested rules

- Segment list with kind, entity, refresh cadence and campaign usage.
- Rule tree rendering that recurses into `rule.nested`, so `(A and B) or (C and D)` is
  displayed as authored rather than flattened.
- The stored `preview` breakdown (lifecycle stage, country, industry, consent) renders
  beside the rules, with the sample member list and a paged member reader.

### Journeys

- Journey list with node count, entry type, entered volume and goal rate.
- Journey detail renders every node in order with its kind badge, entry/terminal marks and
  per-node statistics.
- **Validate** surfaces reachability and configuration issues with severity, and an
  explicit “validation passed” state when there are none.
- **Simulate entry** produces a deterministic enrolment forecast (entered, per-node
  reached/converted, duration) and labels it as an estimate rather than a live enrolment.

### Templates, landing pages, forms and attribution

- **Email templates**: block list with per-block visibility toggling through
  `emailTemplates.update`, plus a locally rendered preview (plain text and warnings).
  Preview HTML is never injected into the DOM.
- **Landing pages**: section composer view, section ordering by `sortOrder`, and
  `publish` returning the honest `demo_not_hosted` hosting state.
- **Forms**: field-rendering playground and a test submission that calls `forms.submit`
  and reports the local `submissionId` and the *described but not performed* action.
- **Lead sources**: attributed source table with kind, active state, lead volume,
  conversion rate and illustrative cost per lead.

### Honesty controls in this batch

Every simulated capability is labelled at the point of use:

| Capability | Wording used |
| --- | --- |
| Campaign send / schedule | “Launch, pause and resume only change the status stored in this browser. No audience is contacted.” |
| Metrics | `DemoNotice tone="info"` — generated from the demonstration dataset, not a provider |
| Attribution | “Attribution assigns revenue to touchpoints by rule. Different models give different answers.” |
| Email preview | “Preview HTML is generated in the browser from local blocks. No email is sent.” |
| Landing page publish | `demo_not_hosted` badge plus “not hosted, and no public URL exists” |
| Form submission | `Alert` — “Recorded locally, not transmitted” |
| Journey activation | “Activating one changes local status only.” |
| Lead-source cost | “Cost per lead is illustrative and is not a real advertising cost.” |

## 2. Pages and routes created

| Route | Screen |
| --- | --- |
| `/app/campaigns` | Campaign list |
| `/app/campaigns/new` | Draft campaign form |
| `/app/campaigns/calendar` | Campaign calendar |
| `/app/campaigns/segments` | Segment library with rule tree and preview |
| `/app/campaigns/journeys` | Journey list |
| `/app/campaigns/journeys/:journeyId` | Journey detail, validation and forecast |
| `/app/campaigns/templates` | Email templates with block toggling and preview |
| `/app/campaigns/landing-pages` | Landing page composer |
| `/app/campaigns/forms` | Form playground with local submission |
| `/app/campaigns/:campaignId` | Campaign detail |
| `/app/leads/sources` | Lead-source attribution (replaces a placeholder) |

A `campaigns/*` fallback remains for anything not yet built.

## 3. Components created or reused

Reused from `@crm/ui`: `DataTable`, `Card`, `Badge`, `StatusBadge`, `TonePill`, `Button`,
`Field`, `Input`, `Textarea`, `Select`, `Alert`, `DemoNotice`, `MiniStat`, `InlineBar`,
`Pagination`, `Dialog`/`DialogContent`, `notify`, `cn`.

Reused from the app: `PageHeader`, `RecordHeader`, `FilterBar`, `ListSkeleton` and the
formatting helpers in `components/shared.tsx`; `useAsync`, `useList`, `useMutation` and
`useServices` from `app/ServiceProvider.tsx`.

No new shared component was added — the batch is composition over the existing kit.

## 4. Interactive mock workflows completed

1. Create a draft campaign, open it, launch it (simulated), pause it, resume it, duplicate it.
2. Read a campaign's funnel from recipients to deals won and its goal attainment.
3. Open a segment, read its nested rules and preview breakdown, page its members, open a member contact.
4. Open a journey, validate it, read the issue list, and simulate an entry forecast.
5. Toggle an email template block's visibility and read the rendered preview and warnings.
6. Publish a landing page and read the `demo_not_hosted` state.
7. Submit a form and read the locally recorded submission id and described action.
8. Sort lead sources by volume and read conversion and illustrative cost per lead.

## 5. Files created or modified

**Created**

- `packages/mock-services/src/services/marketing.ts`
- `apps/crm/src/routes/marketing/CampaignScreens.tsx`
- `apps/crm/src/routes/marketing/MarketingScreens.tsx`
- `docs/development-progress/BATCH_14_REPORT.md`

**Modified**

- `packages/mock-services/src/services/index.ts` — imports and the seven container keys
  (`campaigns`, `segments`, `journeys`, `emailTemplates`, `forms`, `landingPages`,
  `leadSources`).
- `apps/crm/src/app/router.tsx` — the marketing route block above, plus the replaced
  `leads/sources` placeholder.

## 6. Tests executed and their results

**Passed** in the consolidated end-of-run pass, which ran once over batches 9–15.

| Check | Result |
| --- | --- |
| TypeScript and ESLint | PASS — 0 errors; 5 informational warnings repository-wide |
| Vitest unit / dom | PASS — 129 / 129 (4 files) and 8 / 8 |
| CRM build | PASS — 0 chunks over 500 kB; `MarketingScreens` 27.73 kB and `CampaignScreens` 17.06 kB lazy chunks |
| Browser smoke (dev server, 1280 px) | PASS — `/app/campaigns` 25 rows, `/app/campaigns/segments` 9 rows, `/app/campaigns/journeys` 6 rows, `/app/campaigns/templates` 18 rows, `/app/leads/sources` 12 rows; `/app/campaigns/landing-pages` and `/app/campaigns/forms` navigated; 0 console errors on every route |

The pass added `packages/mock-services/src/services/modules.test.ts`, whose eight marketing
cases cover campaign listing, derived metrics and the local-only launch; the campaign
calendar; segment preview and members; journey validation and simulation; the local email
preview; a simulated form submission; `demo_not_hosted` publishing; and lead-source figures.

## 7. Defects the tests found, and how they were fixed

Two authoring defects were caught and fixed during review before the consolidated pass:

1. A malformed funnel row rendered an undefined helper instead of the stage label and
   value. Replaced with a keyed label/value pair.
2. The campaign form bound `defaultValue` on a `Select`, which is not part of the
   component's contract. Converted to a controlled `value`/`onValueChange` pair.

The consolidated pass found one further defect in this batch's screens: the email-template
screen synchronised block visibility with a `setState`-in-effect. It now derives each block's
visibility from a local `blockOverrides` map applied where the blocks render
(`apps/crm/src/routes/marketing/MarketingScreens.tsx`), so the effect is gone rather than
suppressed.

## 8. Build and typecheck status

**Passed.** `MarketingScreens` emitted as a 27.73 kB lazy chunk and `CampaignScreens` as
17.06 kB; the CRM build reported 0 chunks over 500 kB and typechecking passed with 0 errors.
The browser smoke pass exercised the seven marketing routes listed in §6 with 0 console errors.

## 9. Responsive and accessibility findings

- Tables use `DataTable` with an accessible `Pagination` footer; the rule tree and journey
  steps are semantic lists, not decorative stacks.
- Block visibility buttons expose `aria-pressed`, so their state is announced rather than
  implied by colour.
- The journey validate/simulate results are rendered in `Alert` regions with headings,
  and `useMutation` announces outcomes through the shared notification layer.
- The funnel labels are text; no meaning depends on bar length alone.
- Layouts fall back to a single column below `lg`.

## 10. Known issues

- **Journey canvas.** The detail view is a faithful ordered step list rather than a
  draggable canvas. The node coordinates ship in the data, but a positioned canvas with
  accessible keyboard editing is a larger component than this batch budgeted.
- **Template detail route.** `/app/campaigns/templates/:templateId` is not a distinct
  screen; template selection happens inside the list screen.
- **Member counts.** Segment member lists are read live from the seeded records, so a
  “dynamic” segment's stored `memberCount` can differ from the readable sample.
- **Campaign KPIs** are page-scope and labelled as such; there is no campaign overview
  aggregate endpoint.

## 11. Remaining frontend work

- A positioned journey canvas with keyboard-accessible node editing.
- A dedicated email block editor route with block insertion and reordering.
- Campaign approvals and a send-review step.
- Batch 16+ (tenant administration, subscription administration, platform console,
  integrations/developer experience, globalization completion, final QA).

## 12. Suggested next batch

**Batch 15 — Additional workspaces (projects, partners, field sales, portal)**, which is
already implemented in the same run and reports separately in
[`BATCH_15_REPORT.md`](./BATCH_15_REPORT.md).
