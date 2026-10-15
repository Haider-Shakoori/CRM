# User Journeys — CRM Platform

> Temporary development name: **CRM Platform**. This document maps the 15 core journeys across the public website (`apps/website`), the CRM application (`apps/crm`) and the platform-owner console (`apps/platform-admin`). Every step names the screen and route it happens on, using the route inventory in `docs/architecture/SITEMAPS.md`. The final sections define cross-journey UX requirements and the persona emotional arc.

| Field | Value |
| --- | --- |
| Status | Draft — implementation reference |
| Companion documents | `docs/architecture/INFORMATION_ARCHITECTURE.md`, `docs/architecture/SITEMAPS.md` |
| Backend assumption | Frontend-only; all persistence happens in `@crm/mock-services`. Steps that will depend on the future Laravel backend are called out per journey under **Not in this frontend**. |
| Content rule | Any screen showing records, metrics, logos or stories uses synthetic data with a visible demonstration label. No real customers, partners or certifications appear anywhere. |

---

## Journey 1 — Visitor lands on the homepage and starts a free trial

| | |
| --- | --- |
| **Actor** | Anonymous visitor (future business owner, sales leader or administrator) |
| **Goal** | Understand the product quickly, trust it enough to try it, and reach a provisioned trial organization without friction |
| **Entry points** | Homepage hero CTA; mega-menu CTA; `/pricing`; blog/article CTAs; `/demo` exit CTA; campaign links with UTM params |
| **Success criteria** | Trial organization is created in the mock layer, the visitor lands in the app onboarding wizard with a resumable state, and a work email is verified (or verification is honestly pending) before provisioning is shown as complete |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Visitor lands on the homepage and scans the hero, product pillars and a labelled sample dashboard | `/` (website) | Instant static render; islands hydrate progressively for demo teaser; no layout shift |
| 2 | Clicks **Start Free Trial** | `/` → `/signup` | SPA-style island loads with skeleton, then the form |
| 3 | Enters work email and password | `/signup` | Inline field validation on blur; password strength meter; "This is a development build — data is synthetic" note in the footer |
| 4 | Submits the account step | `/signup` → `/signup/verify` | Pending state on the button; on mock resolve, a "Check your email" panel with resend cooldown (~60s) and a code-entry fallback |
| 5 | Opens the verification link (or enters the code) | `/verify-email` | Success state; the wizard resumes at the correct step; an expired token shows a re-send action, not a dead end |
| 6 | Does not verify; returns later | `/verification-pending` | Persistent resume banner; "Change address" option; no repeated nagging toasts |
| 7 | Completes organization details: name, country, locale, currency, subdomain suggestion | `/signup/organization` | Live subdomain availability feedback; invalid locale/currency combinations explained inline |
| 8 | Chooses a plan and seat estimate | `/signup/plan` | Monthly/annual toggle; **illustrative pricing** label; selected plan echoed in a summary rail |
| 9 | Confirms and hands off to provisioning | `/signup/plan` → app `/onboarding/organization` | Explicit provisioning progress ("Creating your organization…"); the app shell loads in **Simple Mode** with a getting-started checklist |
| 10 | Sees the first onboarding screen | `/onboarding/organization` | Welcome state explaining the 10-step setup, estimated time, and skip options; Journey 4 continues from here |

**Failure and edge cases**

- Email already registered: offer sign-in (`/sign-in?next=`) instead of a dead error; never leak whether a password reset is applicable.
- Disposable domain: warn but do not block; record the warning for the mock risk queue.
- Organization subdomain taken: suggest alternatives (`acme-crm`, `acme-team`) with one click.
- Verification link opened in a different browser: treat as first-party flow, verify and route to sign-in with a return path.
- Provisioning mock times out: keep the visitor on a retry screen with a "resume setup" link; never show a success screen for an unconfirmed step.
- Refresh mid-wizard: all steps are routes; state resumes from `tenantOnboarding`.
- Reduced connectivity: verification resend and asset loading show retry affordances; forms keep entered data.

**Metrics to watch**

- Hero CTA click-through rate; signup start → account-completed rate.
- Email verification completion rate and median time to verify.
- Drop-off per signup step (`/signup`, `/signup/verify`, `/signup/organization`, `/signup/plan`).
- Trial activation rate (org created → onboarding started) and median time to first dashboard (Journey 4 handoff).
- Day-1 and Day-7 return rate for new trials; UTM source split.

**Not in this frontend (depends on the future Laravel backend)**

- Account creation, password hashing, email delivery and verification tokens.
- Tenant provisioning, subdomain assignment, plan/entitlement initialization.
- Payment method capture (not collected during trial signup at all).
- Session issuance and cross-app single sign-on between website and CRM app.

---

## Journey 2 — Visitor explores the interactive product demo without signing up

| | |
| --- | --- |
| **Actor** | Anonymous evaluator (often comparing two or three vendors) |
| **Goal** | Feel the product's core workflows on realistic data without creating an account or talking to sales |
| **Entry points** | Header "Product" mega menu → Interactive demo; homepage demo teaser; `/demo?scenario=pipeline`; feature and product page CTAs ("See it in action") |
| **Success criteria** | The visitor completes at least one guided scenario, understands what the product does, and can exit to `/signup` or continue browsing without pressure; the demo never implies real data or a real tenant |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the demo | `/demo` | Persistent banner: "Demonstration environment — sample data, nothing is saved to an account"; island hydrates with a scenario picker |
| 2 | Chooses a scenario | `/demo?scenario=pipeline` (or `support`, `marketing`, `custom-objects`) | Scenario loads instantly from bundled fixtures; a 30-second orientation card explains the scenario and its goal |
| 3 | Follows the guided tour | `/demo?scenario=pipeline&tour=first-deal` | Step chips (1/6…) with progress; each step highlights one control and explains the concept; tour can be skipped or exited at any time |
| 4 | Interacts freely: drags a deal between stages, opens a record, completes a task | `/demo` | Motion-safe drag with keyboard alternative (`Shift+Arrow`); instant local updates; a small "demo" watermark remains visible |
| 5 | Tries a larger action (create account, invite user) | `/demo` | Action allowed on sample data with a note "In a real workspace this creates {object}" and a link explaining the real flow |
| 6 | Resets the scenario after experimenting | `/demo` | Confirmation ("Reset the sample data?") then a quick reset animation; reset never leaves a half-state |
| 7 | Leaves the demo via the exit CTA | `/demo` → `/signup` or back to `/` | CTA carries the scenario as `?intent=demo-pipeline` so the signup wizard can reference what they saw |
| 8 | Re-enters the demo later from a feature page | `/demo?scenario=...` | Demo state is fresh (no saved progress); previously selected scenario remembered locally as a convenience only |

**Failure and edge cases**

- Chart rendering fails: fall back to a labelled static preview image with a note; the tour continues.
- Local storage blocked/incognito: demo runs in memory only with a small "progress will not be remembered" note; no crash.
- `prefers-reduced-motion` set: tours do not auto-advance, no drag animation, transitions are instant.
- Small screens: scenario picker becomes a drawer; the tour uses bottom sheets instead of popovers.
- Visitor attempts to navigate to a real CRM route from the demo: redirected to the corresponding demo screen, never to a sign-in wall mid-demo.
- Time on page exceeds 15 minutes: a single, dismissible "Ready for the real thing?" prompt appears; never repeats in the same session.

**Metrics to watch**

- Demo start rate from each entry point; scenario selection split.
- Tour completion rate per scenario; median interactions per session.
- Demo exit destination split (trial start vs. continue browsing vs. pricing).
- Demo → trial conversion rate; assisted-conversion attribution via `?intent=`.

**Not in this frontend**

- Nothing is required for the demo itself — it is fully client-side by design.
- Optional later: anonymized demo event ingestion, demo-to-CRM lead stitching (would need backend analytics and identity resolution).

---

## Journey 3 — Visitor compares plans, uses the pricing calculator, then contacts sales

| | |
| --- | --- |
| **Actor** | Anonymous evaluator with budget authority or influence (owner, finance, operations) |
| **Goal** | Understand pricing for their size and module needs, then hand the exact configuration to a salesperson without repeating themselves |
| **Entry points** | Header **Pricing**; footer; pricing teasers on product pages; "Contact Sales" CTA in the header and on enterprise pages |
| **Success criteria** | The visitor leaves with a clear estimate (assumptions listed), and if they contact sales, the form arrives pre-filled with their plan, seats and modules, and they receive an honest confirmation state |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the pricing page | `/pricing` | Plan cards render instantly; monthly/annual toggle island hydrates without shift |
| 2 | Compares plans in the full matrix | `/pricing` | Sticky comparison header; module rows grouped by the same taxonomy as the app sidebar; key differences highlighted |
| 3 | Opens the pricing calculator | `/pricing` (calculator island) | Inputs: seats, plan, optional module add-ons, billing period, currency; **illustrative pricing** label visible |
| 4 | Adjusts inputs; reads assumptions | `/pricing` | Estimate updates live; an "Assumptions" expander lists what is and is not included; unsupported currency falls back to USD with a note |
| 5 | Decides the plan is close but has a question | `/pricing` → `/company/contact?intent=sales&plan=growth&seats=25&modules=campaigns,tickets` | Calculator state is serialized into the contact URL |
| 6 | Completes the contact form (name, work email, company, message) | `/company/contact` | Plan/seats/modules pre-filled and visible; validation inline; honeypot/rate-limit protection on the mock layer |
| 7 | Submits the request | `/company/contact` | Pending state, then a confirmation panel: what happens next and an expected response window; **no fake "a representative will call you now"** |
| 8 | Optionally books time while signed in (future) | `/company/contact` | Booking placeholder shown as a labelled preview until a real calendar backend exists |

**Failure and edge cases**

- Form validation fails: errors inline, entries preserved, focus moved to the first error field.
- Rate-limited (repeat submissions): friendly cooldown message with the option to email instead.
- Calculator state lost on refresh: inputs are encoded in the URL so the estimate is shareable and restorable.
- User is signed in already: show "You are signed in as…" and offer "Open a plan change instead" (`/billing/plans`) alongside contact.
- Enterprise-only module selected (e.g. `developer`): calculator notes "requires sales conversation" instead of showing a fake number.

**Metrics to watch**

- Pricing page engagement; calculator open rate and inputs-changed depth.
- Contact-sales submission rate; plan/seat distribution of submissions.
- Pricing → trial vs. pricing → sales split; assisted deals sourced from calculator URLs.

**Not in this frontend**

- Lead creation, routing to the right sales territory, CRM record creation.
- Email delivery of confirmation to the visitor and notification to sales.
- Pricing authority (real prices, discounts, quotes); everything shown is illustrative until launch.
- Meeting scheduling/busy-state checks.

---

## Journey 4 — New organization signs up and completes onboarding

| | |
| --- | --- |
| **Actor** | First administrator of a newly provisioned trial tenant (often the person from Journey 1) |
| **Goal** | Go from an empty tenant to a configured workspace with a first dashboard, realistic sample data and invited teammates, in under 15 minutes |
| **Entry points** | Post-signup provisioning handoff (Journey 1 step 9); `/auth/invitation/:token` acceptance; "Resume setup" from `/getting-started`; direct deep links to any incomplete step |
| **Success criteria** | All ten configuration areas are either completed or explicitly skipped; the tenant has a pipeline and at least one dashboard; invited teammates appear as pending; every skipped step is discoverable later in the getting-started checklist |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Retells organization basics: name, logo placeholder, address, default signature | `/onboarding/organization` | Live preview card of the workspace header; logo upload is mocked and clearly labelled |
| 2 | Sets country, language, timezone, currency and date/number formats | `/onboarding/locale` | Live formatter preview (e.g. `13/10/2026`, `€1.234,56`); RTL preview offer for RTL locales; changing currency notes where it affects displays |
| 3 | Selects the industry | `/onboarding/industry` | Industry seeds a recommended template and sample data; note explains what the choice affects |
| 4 | Selects team size band | `/onboarding/size` | Drives module recommendations ("Most teams your size start with Sales + Service") |
| 5 | Chooses primary goals (multi-select: win more deals, serve customers faster, run campaigns, forecast revenue…) | `/onboarding/goals` | Each goal links to the modules and getting-started tasks it personalizes |
| 6 | Enables modules | `/onboarding/modules` | Entitlement-aware toggles with dependency warnings (e.g. quotes require products); locked modules link to the not-entitled screen |
| 7 | Picks a pipeline template and adjusts stages | `/onboarding/pipeline` | Stage preview with drag and keyboard reorder; validation (no duplicate stages, at least two stages); template source labelled |
| 8 | Invites teammates with roles and teams | `/onboarding/invite` | Seat counter against the plan; pending states per invite; duplicate-email warning; "I'll do this later" leaves the step in the checklist |
| 9 | Imports sample data (opt-in) | `/onboarding/sample-data` | Checkbox sets (sales, service, both); progress with honest counts ("24 accounts, 61 contacts…"); partial failure shows per-set retry; skip is allowed |
| 10 | Lands on the first dashboard | `/onboarding/complete` → `/home` | Success summary (what was configured, what was skipped), getting-started checklist pinned, first dashboard labelled with its data source (sample vs. empty) |

Feedback rules throughout: progress indicator "Step n of 10"; every step can go back without losing input; skipping a step lists its consequence in plain language; the wizard is resumable from any device because step state lives in `tenantOnboarding`; no confetti or fake celebration — completion is stated factually.

**Failure and edge cases**

- Invalid locale/currency/timezone combination: field-level error with a suggested valid alternative.
- Pipeline template application fails mid-way: transactional message with "retry" and "use empty pipeline" options.
- Invitation rate-limited: queue the invites locally with a "will retry" state and a manual retry control.
- Sample-data import partially fails: per-set retry; already-imported sets are not duplicated.
- Invited user accepts before onboarding finishes (Journey 12 overlap): they land in the workspace in Simple Mode with a reduced checklist and no admin steps.
- Refresh or closure mid-onboarding: reopen resumes at the first incomplete step, with a "review previous answers" affordance.
- User switches organization during onboarding: prompt to finish or defer; deferred onboarding reappears in the checklist.

**Metrics to watch**

- Onboarding completion rate; per-step drop-off (steps 6, 8 and 9 are the expected friction points).
- Median time from provisioning to first dashboard; steps skipped and later completed.
- Invites sent per org and acceptance rate; sample-data opt-in rate.
- First-record created by a human (non-sample) within 24h; Day-7 active admin retention.

**Not in this frontend**

- Tenant provisioning, entitlement initialization and plan enforcement.
- Email delivery for invitations and reminders.
- Server-side sample-data generation/import pipelines and duplicate detection at scale.
- Persistence of wizard state beyond the mock service (and later, multi-device resume).

---

## Journey 5 — Sales rep qualifies a lead and converts it to contact + account + deal

| | |
| --- | --- |
| **Actor** | Sales representative |
| **Goal** | Work a new inbound lead, confirm fit, and convert it into the canonical records (account, contact, deal) without duplicate clutter |
| **Entry points** | `/home` "My open leads" widget; notification ("New lead assigned to you"); `/leads` saved view "New this week"; quick-create (`c` → Lead) |
| **Success criteria** | The lead is qualified with required fit fields, conversion produces linked account/contact/deal records, the lead shows a converted banner, and every linked record's timeline references the others |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the leads list and picks a new lead | `/leads?view=lw_new_this_week` | Saved view loads with filters in the URL; SLA/age column shows how long the lead has been waiting |
| 2 | Reviews the lead: source, campaign attribution, notes, activity timeline | `/leads/:leadId` | Timeline shows the inbound email/event source (mock); score breakdown is labelled as a demonstration model |
| 3 | Works the qualification checklist (budget/authority/need/timing-style fields, tenant-configurable) | `/leads/:leadId` | Inline editing; incomplete required fields are flagged before status can advance |
| 4 | Attempts to set status **Qualified** with required fields missing | `/leads/:leadId` | Inline validation explains exactly which fields block the transition; status does not change |
| 5 | Completes the fields, adds a qualification note, sets status **Qualified** | `/leads/:leadId` | Autosaved note ("Draft saved 14:02"); status chip updates; activity logged to the timeline |
| 6 | Starts conversion | `/leads/:leadId/convert` | Wizard step 1: match candidates for existing account and contact, each with a match-confidence explanation (email domain, name, phone) |
| 7 | Chooses "create new account" and confirms the contact details | `/leads/:leadId/convert` | Editable fields seeded from the lead; duplicate warning if a near-match is ignored |
| 8 | Defines the deal: name, amount, close date, pipeline, stage, owner | `/leads/:leadId/convert` | Defaults come from the tenant pipeline template; stage-specific required fields enforced |
| 9 | Confirms the summary | `/leads/:leadId/convert` | Pending state; on mock resolve, a result panel with deep links to all three records; **no success state before the service confirms** |
| 10 | Verifies the outcome | `/leads/:leadId` → `/deals/:dealId` | Lead shows "Converted" banner with links; deal, account and contact timelines all reference the conversion |

**Failure and edge cases**

- Lead already converted: conversion button replaced by links to the existing records; no duplicate creation possible.
- Near-duplicate account ignored by the rep: the new account is created but tagged "possible duplicate" for later merge review.
- Rep lacks permission to create accounts: wizard requires selecting an existing account/contact before the deal step.
- Mid-conversion failure (mock): transactional rollback message; nothing partially created; retry offered.
- Deal step skipped (no `deals` entitlement): conversion still creates account + contact and records the reason.
- Lead assigned to someone else: read-only with "Request ownership" action.
- Conversion while a colleague converts the same lead: conflict notice ("This lead was just converted by…") with links.

**Metrics to watch**

- Lead → qualified rate and median time to qualify.
- Qualification → conversion rate; conversion completion time.
- Duplicate-suggestion acceptance rate; possible-duplicate tags created.
- Converted-deal win rate and value by lead source.

**Not in this frontend**

- Transactional multi-record creation and rollback guarantees.
- Duplicate detection and match scoring services.
- Lead scoring models, assignment/routing rules and SLA clocks.
- Audit trail persistence and data-quality jobs.

---

## Journey 6 — Sales rep works the daily activity plan and completes tasks

| | |
| --- | --- |
| **Actor** | Sales representative |
| **Goal** | Clear today's calls, emails and follow-ups with accurate outcomes, ending the day with a truthful activity record |
| **Entry points** | `/home` "My tasks today"; `/activities?view=today`; calendar reminders; email/the inbox "create task" action; notification digest |
| **Success criteria** | Every task is completed, rescheduled with a reason, or consciously deferred; outcomes are logged; follow-ups exist where needed; the activity record matches what actually happened |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens Home and reviews the day | `/home` | "My tasks today" widget: count, overdue badge, next three items with time hints |
| 2 | Goes to the task list | `/activities?view=today` | Filters in URL; overdue items grouped first with a text+icon badge (not color-only) |
| 3 | Navigates by keyboard | `/activities?view=today` | `j`/`k` moves focus; focused row is visibly outlined; `Enter` opens the task |
| 4 | Completes a call task; outcome required | `/activities/:activityId` | Outcome options (connected, voicemail, no answer, wrong number); completion blocked until an outcome is chosen |
| 5 | Logs the call notes and next step | `/activities/:activityId` | Autosave; on save, offers "Create follow-up task" prefilled with date suggestion |
| 6 | Creates the follow-up | `/activities/:activityId` | Task created and shown in the widget immediately; task appears on the linked record's timeline |
| 7 | Handles an overdue item: reschedules with a reason | `/activities` | Reschedule dialog requires a reason (rep or customer driven); history keeps the original due date |
| 8 | Completes a batch of email tasks | `/activities?view=today` | Row-level checkboxes + bulk "Mark done" with per-row outcome defaults; optimistic update with rollback on mock failure |
| 9 | Ends the day: reviews the summary | `/home` | Counters updated (completed/overdue/remaining); "tomorrow preview" shows the first items |
| 10 | Offline completion (field overlap) | `/activities` | Queued badge "Will sync when online"; items remain editable until synced; conflicts resolved by keeping the latest user action |

**Failure and edge cases**

- Task linked to a record the rep cannot access: masked reference with an explanation instead of a broken link.
- Recurring task completion: completing spawns the next instance with the next due date; a notice confirms the recurrence.
- Mock service failure on complete: optimistic tick rolls back with an error toast and the row stays open with a retry.
- Delegate/out-of-office: tasks can be reassigned; the receiving rep sees "assigned by …" context.
- Duplicate follow-up creation (double click): buttons disable during pending state; one task is created.

**Metrics to watch**

- Tasks completed per rep per day; overdue rate and reschedule reasons.
- Outcome capture completeness (calls with logged outcomes).
- Follow-up creation rate per completed activity.
- Activity volume vs. meetings booked; end-of-day plan adherence.

**Not in this frontend**

- Real email send/receive and calendar sync (tasks are mock records).
- Push/reminder notifications at the OS level.
- Call telephony integration and recording.
- Background sync conflict resolution for offline queues.

---

## Journey 7 — Sales manager reviews the pipeline and forecast, then coaches a rep

| | |
| --- | --- |
| **Actor** | Sales manager (sometimes with the sales director joining) |
| **Goal** | Understand pipeline health this period, challenge the forecast credibly, and leave one specific piece of coaching for a rep |
| **Entry points** | Monday ritual: `/deals` board; forecast reminder notification; `/analytics/forecast`; team dashboard widget |
| **Success criteria** | Stage hygiene issues are resolved or flagged, the forecast submission reflects the manager's judgment, and at least one coaching action is logged against a rep with a scheduled follow-up |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the team pipeline board | `/deals?view=team_this_quarter&layout=board` | Column totals per stage; period and team filters in the URL; personal scope note ("You are viewing: Team West") |
| 2 | Scans for slipping deals (no activity in 14+ days) | `/deals?...&lastActivityBefore=2026-09-29` | Filter chip visible; result count updates; empty state offers to clear the filter if nothing matches |
| 3 | Opens a slipping deal and reviews the next step | `/deals/:dealId` | Next-step field is highlighted if stale; last activity date shown relative ("12 days ago") |
| 4 | Moves the deal back a stage after a customer reset | `/deals/:dealId` (stage menu or drag) | Regression requires a reason from a short list plus optional note; stage history records actor and reason |
| 5 | Flags the deal with an internal note and adds a task for the rep | `/deals/:dealId` | Note saved to the deal timeline; task assigned to the rep appears in their `/activities` |
| 6 | Opens the forecast workspace | `/analytics/forecast?period=this_quarter` | Roll-up by rep and team: commit / best case / pipeline vs. quota; each number drills to the underlying deal list |
| 7 | Adjusts a rep's commit category, adds a judgment note | `/analytics/forecast` | Change is pending → confirmed by mock service; forecast totals recalculate; **no fake "submitted" state** until confirmation |
| 8 | Drills into a rep's numbers | `/analytics/forecast?rep=u_217` | Filtered view with the same columns; "back to team" breadcrumb preserves the period |
| 9 | Reviews the rep's activity pattern | `/analytics?tab=team-activity` (or the rep's activity view) | Calls/meetings/tasks per week with an honest "data as of" timestamp |
| 10 | Schedules a coaching 1:1 and logs the coaching note | `/calendar` → event on `/calendar/events/:eventId`; note logged from the deal or rep context | Event created; coaching note typed as a distinct activity type appears on the rep's record |
| 11 | Shares the forecast view with the director | `/analytics/forecast` | "Copy link" preserves period/team; export is a clearly labelled mock download |

**Failure and edge cases**

- Forecast period locked after the submission deadline: fields become read-only with an explanation and a "request unlock" action (mock).
- Currency-mixed pipeline: totals convert using the tenant display currency with a conversion note; no silent rounding.
- Manager lacks permission for another team's deals: scope selector only lists permitted teams; direct URL deep links show access-denied with context.
- No quota set for a rep: cell shows "—" with a link to set quota (admin) instead of a misleading 0%.
- Drag-and-drop unavailable (keyboard or touch): stage menu provides the identical flow including the reason dialog.
- Conflicting edits (another manager adjusts the same forecast): last-write-wins is rejected — conflict banner shows both values and asks to reconcile.

**Metrics to watch**

- Forecast accuracy (submitted vs. actual at period close, per rep and team).
- Pipeline hygiene: deals with stale next steps, regressions with reasons, coverage ratio.
- Coaching actions logged per rep per month; 1:1 completion; follow-up task completion.
- Time from stage change to next activity on the deal.

**Not in this frontend**

- Quota import and period closing/locking jobs.
- Forecast snapshotting and historical accuracy computation.
- Cross-team data aggregation at real scale (mock returns seeded aggregates).
- Email digests and calendar invites.

---

## Journey 8 — Marketing manager builds a campaign, segments an audience and reviews attribution

| | |
| --- | --- |
| **Actor** | Marketing manager (with a specialist contributing) |
| **Goal** | Launch a targeted campaign to a well-defined segment and understand which pipeline it influenced |
| **Entry points** | `/campaigns` from the sidebar or Home widget; campaign template link; "create campaign from segment" shortcut on `/segments` |
| **Success criteria** | The campaign is configured with a non-empty, consent-respecting audience, scheduled through an honest "simulated" state, and attribution shows which deals were influenced with the model explained |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Creates a campaign | `/campaigns/new` | Form with type/channel, dates, budget, owner; defaults from the last similar campaign offered as a starting point |
| 2 | Names the campaign and sets the goal | `/campaigns/new` | Goal selection (pipeline, leads, awareness) drives which metrics appear later |
| 3 | Builds the audience | `/campaigns/:campaignId?tab=audience` → `/segments/new` style rule builder | Rule builder over standard + custom fields; member count preview updates with a "computed from sample data" note; unsaved rules are guarded |
| 4 | Reviews segment quality | `/segments/:segmentId` | Overlap warnings with other segments; consent exclusions counted ("142 contacts excluded — no marketing consent"); zero-member segments block activation with guidance |
| 5 | Chooses a content template and personalizes it | `/campaigns/:campaignId?tab=content` | Template gallery; variable chips (first name, company); preview per contact; rich editor autosaves draft |
| 6 | Reviews the send summary | `/campaigns/:campaignId?tab=content` | Summary: audience size, exclusions, send window, timezone note; explicit "This frontend does not send email — delivery is simulated" label |
| 7 | Activates the campaign | `/campaigns/:campaignId` | Status becomes "Scheduled (simulated)"; confirmation dialog lists exclusions and totals; **no fake delivery metrics** — delivery columns show "—" with a tooltip until a backend exists |
| 8 | Reviews attribution after sample deals exist | `/campaigns/:campaignId?tab=attribution` | Influenced deals list with model explanation (first touch / last touch, switchable), touch timeline per deal, and a "sample data" label |
| 9 | Shares results with the team | `/analytics/reports/:reportId` (campaign report) | Deep link preserved; export is a labelled mock download |

**Failure and edge cases**

- Segment rules reference a custom field deleted by an admin: rule shows "field missing" and blocks saving until resolved.
- Contact consent missing: excluded from the audience, never silently included; counts visible.
- Campaign dates in the past: warning with a quick fix ("today through +14 days").
- Audience larger than the mock dataset: counts clearly state "based on sample dataset of N contacts".
- User lacks `campaigns.create`: not-entitled or access-denied screens depending on whether the cause is entitlement or role.
- Two specialists edit the same campaign: presence indicator shows the second editor; last edit wins per-field with a conflict note on save.

**Metrics to watch**

- Campaign creation time; segment build time.
- Audience size and exclusion accuracy; overlap warnings actioned.
- Campaigns activated with a defined goal; attribution view usage.
- Attributed pipeline (illustrative in this build, real once the backend exists).
- Segment → campaign reuse rate.

**Not in this frontend**

- Email sending, deliverability, bounce handling and suppression lists.
- Tracking pixels, UTM capture and touchpoint ingestion.
- Attribution model computation at full volume.
- A/B testing and drip sequence execution.

---

## Journey 9 — Support agent triages an inbox, resolves a ticket and updates the knowledge base

| | |
| --- | --- |
| **Actor** | Support agent (service team) |
| **Goal** | Clear the highest-priority ticket in the queue, resolve it with a documented outcome, and turn the solution into a reusable knowledge base article |
| **Entry points** | `/tickets` queue sorted by SLA; `/inbox` triage view; notification "SLA at risk"; customer portal submission (simulated) |
| **Success criteria** | The ticket is classified, answered within SLA targets, resolved with a resolution note, and a KB draft (or published article) exists for the recurring issue |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the ticket queue | `/tickets?queue=frontline&view=sla_risk` | SLA badges with text + icon ("Breach in 42m"); sort and filters in the URL; live-ish counts from mock |
| 2 | Triages the inbox view for channel mix | `/inbox` | Channel tabs (email, chat, portal — labelled simulated channels); unread counts; quick preview without opening |
| 3 | Opens the at-risk ticket | `/tickets/:ticketId` | Thread view with full history; customer and account context cards; SLA timer continues in the page header |
| 4 | Classifies the ticket: queue, priority, type | `/tickets/:ticketId` | Field changes logged to the ticket timeline; reassignment to another queue prompts for a note |
| 5 | Searches the knowledge base for an existing answer | `/tickets/:ticketId` (KB insert dialog) | Results show article excerpt and last-updated date; inserting adds a link without closing the reply |
| 6 | Composes and sends the reply | `/tickets/:ticketId` | Reply saved; status moves to "Pending customer"; pending state until mock send resolves; **never shows "Delivered"** — unresolved sends show "Queued in demo" |
| 7 | Customer replies (simulated) and the ticket reopens | `/tickets/:ticketId` | Notification in the center; ticket returns to the top of the queue with a new SLA segment |
| 8 | Resolves the ticket with a required resolution note | `/tickets/:ticketId` | Resolution required; on save, prompt: "Create a knowledge base draft from this resolution?" |
| 9 | Creates the KB draft from the resolution | `/knowledge` → New article (editor route `/knowledge/articles/:articleId/edit`) | Draft prefilled with title from ticket subject, resolution body, and a link back to the ticket; autosave enabled |
| 10 | Publishes or leaves for review | `/knowledge/articles/:articleId/edit` | Status draft → in review → published (permission-gated); publishing is confirmed by the mock service before the badge changes |

**Failure and edge cases**

- No `knowledge-base` entitlement: the KB insert search is replaced by an inline explanation and upgrade path; the agent can still paste the answer manually.
- Ticket reassigned while the agent is replying: banner shows the new assignee; the draft is preserved and can be handed over.
- SLA breach with no response: breach state uses icon + text, is announced to screen readers, and appears in the manager's queue summary.
- Customer email bounces (mock state): a system note appears on the thread, the agent is prompted to try another channel.
- Ticket reopened after resolution: reopen count tracked; resolution note retained and editable.
- Working two tickets at once (split view): draft autosave keeps both separate; closing one tab does not lose the other's draft.

**Metrics to watch**

- First response time and resolution time (against targets in the mock SLA policy).
- Reopen rate and reopen reasons.
- KB drafts created from resolutions; KB article deflection usage in replies.
- Tickets triaged per agent per day; queue backlog trend.
- CSAT placeholder (survey not in this frontend — the CTA is labelled as a preview).

**Not in this frontend**

- Real email/chat/voice channels and their delivery pipelines.
- SLA clock persistence, breach escalation jobs and business-hours calendars.
- CSAT survey sending and response collection.
- KB publishing pipeline, search indexing and translation workflow.

---

## Journey 10 — Customer success manager reviews health scores and runs a renewal

| | |
| --- | --- |
| **Actor** | Customer success manager |
| **Goal** | Find accounts at risk, understand why, and start (or complete) a renewal with the right context and no last-minute surprises |
| **Entry points** | `/customer-success` portfolio; renewal-due notification; account detail health chip; quarterly business review reminder |
| **Success criteria** | Risk is identified with contributing factors, a renewal is started early with a quote and next steps, and the account's timeline reflects every action taken |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the success portfolio | `/customer-success` | Health distribution (labels + counts, not color-only); renewals due in the next 90 days; filters by owner, segment, health band |
| 2 | Filters to at-risk accounts | `/customer-success?health=at-risk` | Result count and filter chip; "last health update" timestamp is honest about data recency |
| 3 | Opens an at-risk account | `/customer-success/accounts/:accountId` | Health score with an expandable factor breakdown: usage trend, ticket volume, engagement (each factor labelled with its source) |
| 4 | Reviews recent risk signals | Same screen, activity tab | Signals link to the underlying tickets, meetings and notes; risk flags can be acknowledged with a note |
| 5 | Applies a playbook | Same screen → `/customer-success/playbooks` context | Playbook preview lists the tasks it will create; applying creates tasks only after confirmation; tasks appear on `/activities` |
| 6 | Opens the upcoming renewal | `/customer-success/renewals/:renewalId` | Renewal detail: contract dates, historical value, expansion signals, risk summary; stage board position shown |
| 7 | Builds the renewal quote | `/revenue/quotes/new?account=ac_…&renewal=rn_…` | Line items prefilled from the contract; totals and terms editable; approval preview explains who approves what (mock policy) |
| 8 | Sets the renewal stage and next step | `/customer-success/renewals/:renewalId` | Stage moves to "Quote sent" (or "In negotiation"); next step required before leaving the stage |
| 9 | Schedules the renewal conversation | `/calendar` (event) linked from the renewal | Event appears on the calendar and on the renewal timeline |
| 10 | Account health visibly updates the portfolio | `/customer-success` | Acknowledged risks change the account's flag state (acknowledged vs. open); portfolio counts update consistently |

**Failure and edge cases**

- No `revenue-ops` entitlement: the quote step is replaced by a "mark for revenue operations" task; the journey completes without a quote.
- Health score stale (no usage ingestion): the screen states "last computed {date}" and offers manual factors instead of implying real-time scoring.
- Contraction detected (seats/licenses reduced): the renewal defaults to a contraction scenario with an explanatory note.
- Customer already churned: renewal board offers "Mark churned" with a required reason and post-mortem note.
- CSM lacks quote approval permission: submit-for-approval flow (mock) keeps the journey moving.
- Duplicate renewal for the same contract: blocked with a link to the existing renewal.

**Metrics to watch**

- Gross and net renewal rate; on-time renewal start rate (first action ≥60 days before expiry).
- At-risk accounts actioned within N days; playbook completion rate.
- Expansion value attached to renewals; quote → closed-won renewal conversion.
- CSM portfolio size vs. attention distribution (accounts with no touch in 30 days).

**Not in this frontend**

- Product usage ingestion and health score computation.
- Contract e-signature and legally binding quotes.
- Approval workflow enforcement (mock policy only).
- Revenue schedules, invoicing and revenue recognition.

---

## Journey 11 — Revenue operations manager builds a workflow automation and validates it in simulation

| | |
| --- | --- |
| **Actor** | Revenue operations manager |
| **Goal** | Automate a repetitive rule (e.g. "route high-value inbound leads to senior reps") without breaking data, and prove it works before enabling it |
| **Entry points** | `/workflows`; suggestion card in `/home` ("You have 14 manually reassigned leads"); automation template gallery on `/templates` |
| **Success criteria** | The workflow validates with no blocking errors, a simulation over sample records shows the expected matches, the workflow is published with a scope summary, and run history is honest about simulated execution |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the workflow list | `/workflows` | List shows status, owner, last run (labelled simulated), and 7-day run counts |
| 2 | Starts a new workflow from a template | `/workflows/new` | Template picker (lead routing, stale-deal nudge, renewal reminder, CSAT follow-up); template explains trigger, conditions and actions before applying |
| 3 | Defines the trigger | `/workflows/new` (builder canvas) | Trigger options with plain-language descriptions; unsupported trigger combinations are disabled with reasons |
| 4 | Builds conditions | Builder canvas | Condition rows use real field names; unknown field references are flagged immediately |
| 5 | Adds actions: assign owner, create task, notify channel, update field, call webhook (mock) | Builder canvas | Each action shows what it will do and what permissions it needs; reordering via drag or keyboard |
| 6 | Runs validation | Builder canvas | Panel lists blocking errors (missing required config) and warnings (broad conditions, self-triggering risk); publish is disabled until blocking errors are resolved |
| 7 | Opens simulation | `/workflows/:workflowId/simulate` | Choose a sample window ("last 90 days of sample data") and run; label: "Simulation only — no records will be changed" |
| 8 | Reviews matched vs. unmatched records | `/workflows/:workflowId/simulate` | Table of matched records with a step-by-step preview of what *would* happen; unmatched sample for sanity; counts reconciled with the condition summary |
| 9 | Adjusts a condition after seeing false positives | Builder canvas via "edit condition" | Simulation result is invalidated with a notice "results are stale — re-run simulation" |
| 10 | Publishes | `/workflows/:workflowId` | Confirmation dialog summarizing scope (records affected per run, actions, notification recipients); status becomes Active after the mock service confirms |
| 11 | Reviews run history | `/workflows/:workflowId/run-history` | Runs listed as "simulated" with matched counts and per-step outcomes; errors are inspectable and retryable (mock) |
| 12 | Disables the workflow if needed | `/workflows/:workflowId` | Disable is immediate with a confirmation and an audit entry; in-flight simulated runs are marked canceled |

**Failure and edge cases**

- Circular reference (workflow triggers itself via a field update): explicit warning with an explanation and a suggested guard condition.
- Condition references a custom field that was deleted: blocking error with a "fix reference" action.
- Timezone/DST edge in date conditions: builder shows the evaluation timezone and a DST caution where relevant.
- Action requires a permission the publisher lacks (e.g. editing a restricted field): blocking error naming the required permission.
- Simulation dataset smaller than expected: results state the sample size explicitly instead of implying full-population accuracy.
- Two admins edit the same workflow: presence indicator and a save conflict notice; the canvas does not silently overwrite.

**Metrics to watch**

- Time to first published automation per org.
- Simulation-before-publish rate; simulation re-runs per workflow.
- Publish success rate; workflows disabled within 7 days (quality signal).
- Matched vs. expected volume drift after publishing (simulated).
- Manual-rework reduction proxy (reassignments before vs. after).

**Not in this frontend**

- The execution engine: scheduling, retries, idempotency and failure recovery.
- Webhook delivery and third-party API calls.
- Execution audit at scale and alerting on workflow errors.
- Cross-tenant rate limiting and resource quotas.

---

## Journey 12 — Organization administrator invites users, assigns roles and reviews an access/audit view

| | |
| --- | --- |
| **Actor** | Org administrator (with enterprise IT administrator collaborating on security policy) |
| **Goal** | Give the right people the right access quickly, and be able to prove what changed and when |
| **Entry points** | `/admin/users`; getting-started checklist ("Invite your team"); notification "2 invitations pending"; access request from a teammate |
| **Success criteria** | Invitations are sent (pending state visible), a custom role exists with a reviewed permission set, changes are reflected in the audit log with before/after values, and seat usage is accurate |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens user management | `/admin/users` | User table (active, pending, deactivated), seat usage chip ("18 of 25 seats"), filters by role/team/status |
| 2 | Invites teammates (batch by email) | `/admin/users?dialog=invite-user` | Invite dialog: emails, role, team; duplicate email warning; seat-limit warning if the batch exceeds entitlement |
| 3 | Sends invitations | Same dialog | Pending state; on mock resolve, invited users appear as "Invited" with a resend action; **no "email delivered" claim** — status says "Invitation queued (demo)" |
| 4 | Reviews existing roles | `/admin/roles` | Role list with member counts; system roles marked non-deletable; custom roles editable |
| 5 | Clones a role as a starting point | `/admin/roles/:roleId` | "Clone" prefills a new draft role named "Sales rep (copy)"; original untouched |
| 6 | Edits the permission matrix | `/admin/roles/:roleId` | Grouped permissions (records, exports, admin surfaces) with select-all per group; changes are staged until save |
| 7 | Previews the role before saving | `/admin/roles/:roleId` (preview) | "What this role sees" summary: modules visible in nav, read/write scopes, and 2–3 concrete task examples; conflicts (e.g. export without read) blocked |
| 8 | Saves with an audit note | `/admin/roles/:roleId` | Save requires a short note ("Sales reps may not export contacts"); change recorded to audit with actor and note |
| 9 | Changes a user's role to the new role | `/admin/users/:userId` | Role change pending → confirmed; warning if the user is signed in ("takes effect on next session refresh") |
| 10 | Reviews the audit trail | `/admin/audit?actor=me&action=role.updated` | Filtered log rows with timestamp, actor, target; row opens a diff drawer (before/after) |
| 11 | Exports an evidence bundle | `/admin/audit` | "Request export" creates a mock export job with queued → ready states (labelled demo); ready entry offers download |

**Failure and edge cases**

- Removing the last admin: blocked with an explanation ("At least one active administrator is required").
- Deactivating a user with open assignments: prompt to reassign owned records before deactivation.
- Inviting an existing member: offer a role change instead of a duplicate invite.
- Seat limit reached: invites are queued with a clear "over plan seats" state and an upgrade link (no silent failure).
- SSO domain enforcement (IT-admin configured): external-domain invites flagged as "requires SSO account".
- Role still in use: role deletion blocked; offer "deactivate and migrate members".
- Audit export unavailable: the action honestly reports unavailability instead of faking a download.
- Admin edits their own role: extra confirmation ("You are changing your own access") and immediate effect notice.

**Metrics to watch**

- Invite acceptance rate; median time from invite to first sign-in.
- Time to assign the first role in a new org; custom roles created.
- Permission changes with audit notes (adoption of the note field).
- Access requests resolved; deactivated-user cleanup rate.
- Audit export requests (usage of the compliance path).

**Not in this frontend**

- Invitation email delivery, expiry and acceptance tokens.
- SSO/SAML/OIDC configuration and session provisioning.
- Tamper-proof audit storage and retention policies.
- Real seat counting and billing enforcement.

---

## Journey 13 — SaaS platform administrator onboards a new tenant and manages a trial

| | |
| --- | --- |
| **Actor** | SaaS platform administrator (platform staff) |
| **Goal** | Provision a customer tenant correctly on the first attempt, keep the trial healthy, and convert it to a paid subscription |
| **Entry points** | `/dashboard` trial watchlist; `/tenants/new`; support request from a prospective customer; sales handoff task |
| **Success criteria** | The tenant is active with the right plan, region, locale and founding admin; the trial timeline and risks are visible; every platform action is audited; the trial converts or is honestly closed |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Reviews the trial watchlist | `/dashboard` | Cards: trials ending this week, unused-seat trials, support escalations; each drills into the tenant |
| 2 | Creates a tenant | `/tenants/new` | Form: organization name, subdomain, region, locale, currency, plan, trial length, founding admin email; inline availability checks for subdomain |
| 3 | Reviews the provisioning summary | `/tenants/new` | Summary of module entitlements and limits implied by the plan; conflicting inputs (e.g. plan not available in region) block submission with reasons |
| 4 | Confirms and waits | `/tenants/new` → `/tenants/:tenantId` | Honest provisioning steps (creating → entitlements → admin invite queued); no success state until each step resolves |
| 5 | Works the tenant 360 setup checklist | `/tenants/:tenantId` | Checklist shows what still needs attention (admin not yet active, no plan renewal set); item actions deep-link within the console |
| 6 | Extends the trial for an engaged customer | `/tenants/:tenantId?tab=subscription` | Extend dialog requires a reason; new end date previewed; audit entry written immediately |
| 7 | Adds a risk note for a disengaged trial | `/tenants/:tenantId` → note action | Note appears on the activity tab; trial watchlist reflects the risk flag |
| 8 | Investigates a support report by impersonating | `/impersonate/:tenantId` | Reason capture + consent checklist; on confirm, the CRM app opens with a persistent impersonation banner; platform console remains one tab away |
| 9 | Ends impersonation | CRM app → "End impersonation" → `/impersonation-ended` | Session summary and a link to the audit entry; banner disappears only after the session truly ends |
| 10 | Verifies the audit trail | `/audit?target=tenant_…` | All actions from steps 2, 4, 6, 7 and 8 listed with actor, reason and timestamps |
| 11 | Converts the trial to paid | `/subscriptions/:subscriptionId` | Lifecycle action "Convert to paid" with plan/seats confirmation; sequential mock states (pending → active) shown truthfully |

**Failure and edge cases**

- Subdomain collision: alternatives suggested; creation blocked until resolved.
- Region without the selected plan: plan list filtered by region; an explanatory note replaces unavailable options.
- Founding admin email bounce (mock): tenant shows "admin invite queued, not yet delivered" with resend.
- Impersonation denied for the staff role: action hidden or disabled with a permission explanation; direct URL shows access-denied.
- Tenant suspended mid-trial (abuse or non-payment): the CRM app surfaces a suspended-state screen; platform notes explain remediation.
- Trial ends with no engagement: closure flow records the disposition ("expired — no response") instead of silently deleting.
- Concurrent staff edits on the same tenant: conflict notice shows both versions; the audit stream keeps both attempts.

**Metrics to watch**

- Time-to-tenant-active (creation → founding admin first sign-in).
- Trial → paid conversion rate; trial extension rate and reasons.
- Support touches per tenant during trial; impersonation frequency (should be low and justified).
- Audit completeness: percentage of console mutations with actor + reason.

**Not in this frontend**

- Actual tenant provisioning, plan enforcement and quota application.
- Payment capture, invoicing and dunning.
- Real impersonation tokens and security constraints around them.
- Email delivery for founding-admin invitations and lifecycle notifications.

---

## Journey 14 — Field sales representative plans visits and logs a visit

| | |
| --- | --- |
| **Actor** | Field sales representative (mobile web, often spotty connectivity) |
| **Goal** | Plan a realistic day of visits, check in without friction, log outcomes accurately, and leave with clear follow-ups |
| **Entry points** | `/field-sales` from Home; mobile notification "3 visits today"; territory suggestion list; calendar day view |
| **Success criteria** | The day plan is feasible and ordered, each visit is checked in and logged with an outcome, follow-ups exist for every visit that needs one, and any offline work is honestly queued for sync |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the day plan | `/field-sales` | Map/list hybrid: visits ordered with times, account context, status chips (planned / checked in / done) |
| 2 | Adds a stop from nearby accounts | `/field-sales/territories` → "Nearby accounts" | Suggested accounts ranked by proximity (mock geodata) with distance estimates labelled approximate |
| 3 | Reorders stops to reduce travel | `/field-sales` | Reorder via drag or "move up/down" keyboard actions; overlapping time windows warned before confirming |
| 4 | Travels to the first visit; opens it | `/field-sales/visits/:visitId` | Visit card: account, contact, purpose, last visit recap, open opportunities |
| 5 | Checks in | `/field-sales/visits/:visitId` | Location states are honest: "Location shared", "Location denied — logging without coordinates", or "Location unavailable"; check-in never blocks on geolocation |
| 6 | Logs the outcome after the meeting | `/field-sales/visits/:visitId` | Outcome (met, not met, left materials), notes autosaved locally, decision-maker captured, competitor notes optional |
| 7 | Creates the follow-up | `/field-sales/visits/:visitId` | Next step: task, deal update, or quote request; created after confirmation and visible on the account timeline |
| 8 | Loses connectivity mid-visit | `/field-sales/visits/:visitId` | Offline badge "Saved on device — will sync"; logging continues fully; submit is never blocked |
| 9 | Regains connectivity | `/field-sales` / visit | Sync indicator resolves item by item with a summary ("2 visits synced, 1 conflict") |
| 10 | Reviews the day | `/field-sales` | Day summary: visits done, follow-ups created, next-day preview; honest "as of last sync" timestamp |

**Failure and edge cases**

- Duplicate check-in (double tap): prevented; second attempt shows "already checked in at 10:04".
- Wrong account selected: "Change visit target" preserves the logged notes.
- Visit conflicts with a calendar event: warning with a link to the event.
- Offline queue conflicts (same visit edited on desktop): conflict resolution keeps both versions and prompts a choice.
- Geolocation unavailable in the browser: journey proceeds without coordinates; analytics must not treat missing coordinates as failure.
- Territory reassigned while planning: removed stops are flagged; plan updates with a notice.

**Metrics to watch**

- Visits logged per rep per week; plan adherence (planned vs. completed).
- Outcome capture completeness; follow-up creation per visit.
- Offline completion rate and sync conflict rate.
- Travel time estimates vs. plan feasibility (proxy).

**Not in this frontend**

- Maps, geocoding and route optimization services.
- Mobile background sync and push notifications.
- Location history/retention policy enforcement.
- Travel expense and mileage capture.

---

## Journey 15 — Global user switches language to an RTL locale and adapts the workspace

| | |
| --- | --- |
| **Actor** | Any user (e.g. an Arabic-speaking sales manager) working across website and CRM app |
| **Goal** | Use the product in a native-language, right-to-left interface without losing work, data meaning or orientation |
| **Entry points** | Website header/footer language selector; CRM profile menu → Language; `/settings/language`; invitation link with `?lang=ar` |
| **Success criteria** | The interface re-renders in the chosen locale with correct directionality, dates/numbers/currency format natively, user-generated and machine identifiers keep their intrinsic direction, and the preference persists across sessions |

| # | Step | Screen / route | System feedback |
| --- | --- | --- | --- |
| 1 | Opens the language selector | Any CRM screen → profile menu, or `/settings/language` | Locale list shows native names ("العربية", "Deutsch") with the current one checked; a note explains that the switch applies instantly and persists |
| 2 | Selects **العربية** | Same surface | Confirmation applies immediately: interface strings swap, `dir="rtl"` is set, layout mirrors; a toast appears in the new language |
| 3 | Verifies navigation and shell orientation | `/home` | Sidebar moves to the right, breadcrumb and icons follow logical order; directional icons (back, next) mirror, non-directional icons (search, bell) do not |
| 4 | Checks data displays | `/analytics` | Numbers, dates and currency use locale formatters from `@crm/localization` (`٨٤٪` vs `84%` choice is locale-configured); chart axes mirror only where meaning is preserved |
| 5 | Works with mixed-direction content | `/contacts/:contactId` | Emails, URLs, record IDs and Latin names render LTR inside RTL text using direction isolation; phone numbers keep their format |
| 6 | Creates a record in the new locale | `/leads/new` | Form labels align right; email/number inputs stay LTR; validation messages appear in Arabic; keyboard focus order follows DOM order (logical, not mirrored) |
| 7 | Checks a knowledge article with partial translation | `/knowledge/articles/:articleId` | Untranslated sections fall back to the default language with a subtle fallback indicator (visible in Advanced Mode) |
| 8 | Switches to the website to verify continuity | Website `/ar` (or `/` then language switcher) | Locale-prefixed URLs, `hreflang` correct, RTL layout mirrors the marketing pages; the choice persists independently of the app if set separately |
| 9 | Switches back or stays | `/settings/language` | Change persists to the user profile in the mock layer; next sign-in restores the locale; no flash of LTR content before RTL renders |

**Failure and edge cases**

- Missing translation keys: graceful fallback chain (user locale → tenant default → English) with an indicator; never raw keys or blanks.
- RTL + dense tables: horizontal scroll retains logical start alignment; sticky columns stay on the correct side.
- Bidi text injection in user content: isolated with direction spans; no layout breakage from mixed strings.
- Reduced motion + RTL: mirrored animations are disabled under `prefers-reduced-motion`.
- Locale switch during an unsaved form: strings change in place, unsaved values are preserved (the guard is not triggered by a locale change).
- Calendar week start: locale default (Saturday/Sunday/Monday) is applied and clearly shown; user override wins.
- Printing/exporting in RTL: layouts mirror, charts keep readable axis labels.

**Metrics to watch**

- Locale adoption per org; RTL locale share of active users.
- Translation fallback rate per locale (from the localization package instrumentation).
- Task completion parity across locales (same journeys, comparable completion).
- Locale-change undo rate (a signal of accidental switches).
- RTL-specific bug reports per release.

**Not in this frontend**

- Translation delivery pipeline and translator tooling (platform admin manages strings, backend serves them).
- Locale-specific legal/content variants.
- Machine translation services for user content.

---

## Cross-journey UX requirements

These requirements apply to every journey above, in all three apps. They are release blockers, not polish.

### Loading, empty, error and degraded states

| State | Requirement | Applies to |
| --- | --- | --- |
| Loading | Skeletons that mirror the final layout (rows, columns, chart blocks) appear only after ~150ms to avoid flashes; no layout shift when data arrives; lists never show a full-page spinner where a skeleton is possible | All journeys |
| Progressive loading | Paginated lists load the next page in place; the scroll position and focus survive; counts are shown only when known | J6, J7, J9, J12, J13 |
| Empty (true) | Explains what the object is, why it is empty, one primary CTA and one secondary path (per `INFORMATION_ARCHITECTURE.md` §6.5); never the string "No data" | J4–J14 |
| Empty (filtered) | Distinct from true empty: shows the active filter chips and a "Clear filters" CTA | J5–J13 |
| Error (inline) | Field-level and action-level errors preserve input, name the problem, and offer a recovery action; focus moves to the first error | J1, J3, J4, J5, J12, J13 |
| Error (route-level) | A route error boundary renders a recoverable screen (retry, go to Home, copy diagnostics); the sidebar and top bar remain usable | All |
| No permission | Explains the required role, offers "Request access" (creates a notification to admins), and never leaks restricted names, counts or totals | J7, J9, J10, J11, J12 |
| No entitlement | Explains what the module does, links to plan information, and where available offers a demonstration preview; never a blank page or silent redirect | J5, J8, J10, J11, J12 |
| Offline | Persistent, honest banner ("Offline — changes are saved on this device"); read-only data from cache where available; mutations queue with a sync indicator; on reconnect, items sync item-by-item with a summary | J6, J14, J9 (mobile) |
| Suspended/locked tenant | Clear full-workspace state explaining the reason category and the path forward; support link available | J13 and downstream |

### Unsaved-change protection

- Dirty forms block navigation (route change, back, org switch, sign out) with a **Save / Discard / Stay** dialog; `Escape` = Stay; focus starts on Stay.
- Long-form editors (notes, replies, KB articles, campaign content) autosave drafts and restore them after accidental refresh; drafts are per user, never shared.
- Multi-step flows (lead conversion, onboarding, workflow builder) treat each step as a route with preserved state; back never discards entered data.
- Locale, theme and density changes are preferences, not unsaved work — they never trigger the guard.

### Optimistic updates in mock state

- Mutations apply optimistically only when the action is reversible and low-risk (task completion, stage move, favorite, read state, note save). High-risk actions (lead conversion, workflow publish, role changes, tenant lifecycle, plan changes) are **pending-first**: the UI waits for the mock service to confirm.
- Every optimistic update has a defined rollback: the affected rows return to their previous values, an error toast names the failed action, and a retry affordance appears in place.
- Optimistic interactions never fabricate server-derived values: counters, totals and "last updated" timestamps update only from service responses (or are marked "pending").
- Rapid repeated actions are coalesced or serialized (e.g. dragging a deal through two stages sends one final state).

### Cross-record consistency

- A single mock service layer is the source of truth for each record; screens never cache divergent copies. Example: **moving a deal** between stages must update the deal detail, the pipeline board column totals, the account's deal rollup, the forecast (when in scope), the home widgets, the affected dashboards, and search results — all from the same consistent update, visible on next render without a manual refresh.
- Derived values (column totals, health bands, forecast rollups, seat counts, SLA states) recompute from records on every read; they are never stored as independent numbers in components.
- Cross-record links are bidirectional after mutations: converting a lead links account/contact/deal and shows the lead in their timelines; creating a quote from a renewal links both; closing a ticket records the resolution on the customer's timeline.
- Conflict detection: when two sessions edit the same record, the mock layer returns the newer version; the UI explains the conflict and asks the user to reconcile rather than silently overwriting.
- Deletion cascades are previewed ("This will also delete N related items") and are soft by default (archive), never destructive without typed confirmation for admin-level deletes.

### Reduced-motion support

- `prefers-reduced-motion: reduce` disables: drag animations for pipeline/workflow/dashboards, tour auto-advance, chart entry animations, page-transition fades, confetti-like effects and parallax.
- Motion is never required to understand state: drag alternatives (menus, `Shift+Arrow`), progress expressed as text ("Step 3 of 10"), and status expressed with icons + labels.
- Demo and onboarding tours become static highlight steps; nothing auto-advances.
- The preference is honoured from the OS and is never overridden by the app; a manual override is available in `/settings/appearance`.

### Keyboard-only operability

Each journey has a complete keyboard path; the following are guaranteed across all journeys:

| Journey area | Keyboard path |
| --- | --- |
| Navigation | `Ctrl/Cmd+K` palette, `g` chords, `Tab`/`Shift+Tab` through shell chrome |
| Lists and boards | `j`/`k` row focus, `Enter` open, `x` select, `n` new; board moves via record menu (`Shift+Arrow`) with the same reason dialogs |
| Forms | Standard tab order; `Ctrl/Cmd+Enter` submit; `Escape` cancels with the unsaved guard; error focus management |
| Drag surfaces (deals, workflows, dashboards, calendar) | Identical outcomes via keyboard: stage/position menus, move commands, and add/remove actions |
| Overlays | Focus moves in on open, is trapped where modal, returns to the trigger on close; `Escape` always closes with guard rules |
| Media/visual content | Charts expose a data-table alternative (`Show data table`) reachable by keyboard; demo tours are navigable step-by-step |
| Onboarding and tours | All steps operable and skippable; progress announced in a live region |

### Language, direction and content integrity (all journeys)

- Every journey works in both LTR and RTL layouts and in every enabled locale, with formatters applied consistently.
- Demonstration content is labelled wherever it appears; no journey may present synthetic data as real or simulate a success state that has not resolved.

---

## Persona emotional arc

What each persona needs to **feel in control** — used as a review lens for every screen and journey, not as copy.

| Persona | Emotional arc |
| --- | --- |
| Business owner | "I can see whether the business is winning today without asking anyone, and the numbers add up." The home dashboard must answer 'how are we doing?' in five seconds and never show vanity metrics they cannot act on. |
| CEO | "The picture I see is current, consistent and defensible in a board meeting." They need roll-ups they can drill into, forecasts that admit uncertainty, and zero contradictions between dashboards. |
| Sales representative | "My day is planned, the next action is obvious, and the system gets out of my way." Speed, keyboard flow and truthful task lists matter more than dashboards; any extra click feels like a tax. |
| Sales manager | "I know exactly where the quarter stands and what to do about it, and my coaching is remembered." They need pipeline truth they can challenge, forecasts that update as reality changes, and easy ways to turn insight into a rep conversation. |
| Sales director | "I can compare teams calmly and intervene early." They need consistent roll-ups across managers, coverage and risk signals, and confidence that the data they escalate on is the same data everyone sees. |
| Marketing specialist | "Building a campaign feels like assembling, not programming." They need segment counts they can trust, templates that save time, and clear feedback about exclusions before anything is scheduled. |
| Marketing manager | "I can prove marketing's contribution without hand-waving." Attribution must explain its model honestly, and campaign state must never overstate what has actually happened. |
| Support agent | "I can clear the queue without fighting the interface, and my solution helps the next customer too." SLA states must be honest at a glance, replies must never be lost, and knowledge reuse must be one step away. |
| Service manager | "The team's workload and risk are visible before customers feel them." They need backlog, breach and escalate-level views that are trustworthy enough to staff against. |
| Account manager | "Every account's history, promises and money are in one place I can open in a call." Cross-record context — deals, tasks, quotes, tickets — must be immediate and consistent. |
| Customer success manager | "I see risk early and have a play to run, not just a score to watch." Health factors must explain themselves, renewals must start early, and every touch must land on the account timeline. |
| Revenue operations manager | "I can change a process, prove it works, and trust the plumbing." Simulation, validation and rollback capabilities are what make automation feel safe rather than scary. |
| Finance user | "Quotes, orders, contracts and billing states reconcile, and approvals are visible." Numbers must be formatted correctly, totals must tie out, and nothing may look booked that is not confirmed. |
| Field sales representative | "The app works in my pocket, in a basement, and never loses what I typed." Honest offline states, one-thumb interactions and fast visit logging are the difference between adoption and shadow spreadsheets. |
| Org administrator | "I can give access confidently and prove exactly what changed." Role previews, seat awareness, and an audit trail with before/after values turn governance from fear into routine. |
| Enterprise IT administrator | "Security-relevant configuration is explicit, least-privilege by default, and auditable." They need to see what a setting affects before changing it, and to trust that mock limitations are labelled, not hidden. |
| SaaS platform administrator | "I can operate every tenant correctly the first time, and every action is accountable." Honest provisioning states, reasons on sensitive actions, and complete audit entries are the core of that trust. |
