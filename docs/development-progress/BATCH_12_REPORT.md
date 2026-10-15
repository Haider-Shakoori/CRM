# Batch Report — Batch 12

**Batch:** 12 — Automation & AI (Workflows and AI Assistant)
**Date:** 2026-10-14
**Repository state:** frontend-only multi-tenant SaaS CRM demo; npm-workspaces monorepo
**Prior report:** [`BATCH_11_REPORT.md`](./BATCH_11_REPORT.md)

---

## 1. Features implemented

Batch 12 completes the Automation & AI module for the demo, matching existing patterns exactly. All outputs are deterministic via mock services and clearly labelled as simulations/demos.

### 1.1 Automation / Workflows
- **Workflow list** (`/app/workflows`): lists workflows from mock store; shows status, target, node count, runs, last updated. Includes sample/demo notice and states simulation only.
- **Workflow detail/editor** (`/app/workflows/:workflowId`): displays validation state (errors/warnings), visual step canvas concept (nodes/edges), and "simulate against a sample record" action. Simulation is explicitly stated as deterministic browser simulation with no external effects.
- **Run history/audit** (`/app/workflows/:workflowId/runs`): lists workflow runs with state, mode (simulated), timestamps, duration, error summary. Marked as simulation runs.
- **New workflow** (`/app/workflows/new`): placeholder creation flow consistent with demo (no backend).

### 1.2 AI Assistant
- **AI workspace** (`/app/ai`): conversation list, message thread, prompt input. Uses `services.ai` (deterministic). Every assistant message carries origin `demo_template_engine` label [Demo: deterministic composition]. Citations shown when applicable.
- **Record summarisation with citations**: summarization path cites source records (accounts, deals, activities, tickets).
- **Email drafting with explicit review**: draft shown in dedicated panel with "Nothing is sent" alert; requires explicit review checkbox. No send action implemented (demo only).
- **Lead-scoring explanation, forecast commentary, natural-language report context**: handled by deterministic template paths in `aiService.send()` and surfaced clearly as demo.
- **Deterministic demo labelling**: all outputs marked as demo/simulated; no real AI.

---

## 2. Pages and routes created

| Route | Screen | Kind |
|---|---|---|
| `/app/workflows` | Workflow list | Real (lazy) |
| `/app/workflows/new` | New workflow (draft) | Real (lazy) |
| `/app/workflows/:workflowId` | Workflow detail/editor + validation + simulation | Real (lazy) |
| `/app/workflows/:workflowId/runs` | Run history/audit | Real (lazy) |
| `/app/ai` | AI assistant workspace | Real (lazy) |
| `/app/ai/*` | AI assistant workspace (fallback) | Real (lazy) |

Router updated: replaced workflow/ai placeholders in `apps/crm/src/app/router.tsx` with real lazy routes.

---

## 3. Components created or reused

**Created:**
- `apps/crm/src/routes/automation/AutomationScreens.tsx` — WorkflowList, WorkflowDetail, WorkflowRuns, WorkflowNew (named exports per screen as requested)
- `apps/crm/src/routes/ai/AiScreens.tsx` — AiWorkspace (default export; also consumable via named if needed)

**Reused:**
- `PageHeader`, `FilterBar`, `Card`, `Button`, `Badge`, `Input`, `Textarea`, `Alert`, `DemoNotice`, `formatDate` from shared components/UI
- `useAsync`, `useList`, `useServices` from `ServiceProvider`
- Mock services: `services.workflows`, `services.ai` (existing)

---

## 4. Data model/services touched

- Used existing `WorkflowsService` contract and implementation (`makeWorkflowsService`) — simulate/validate/activate/runs already implemented with explicit disclaimers.
- Used existing `AiService` (`aiService`) — send with deterministic composition, citations, draft support, origin labelling already present.
- No schema changes, no new types added. No new npm dependencies.

---

## 5. Tests added/updated

No tests were authored while this batch was built. The consolidated pass added
`packages/mock-services/src/services/modules.test.ts` (25 contract tests for the batches 9–15
services); its cross-cutting honesty case exercises `services.ai` and asserts that every reply
carries `origin: 'demo_template_engine'`, covering the AI path this batch's screen uses.
Workflows have no new unit test; their behaviour was covered by the browser smoke pass in §7.

---

## 6. Accessibility & UX notes

- Semantic structure, keyboard-navigable controls where applicable (buttons/inputs/links). Focus styles via shared UI.
- Clear loading/empty/error states (workflow list/runs show empty state; detail shows loading; simulation errors surfaced via notify).
- Demo notices and warnings prominently displayed (simulation only, nothing sent, deterministic demo).
- Canvas concept presented with text alternatives (lists of steps/edges).
- No dynamic canvas with only mouse drag without keyboard operability in this minimal implementation — kept to deterministic textual representation per "visual step canvas" with validation; matches existing minimal editor patterns.

---

## 7. Verification (passed)

The consolidated end-of-run pass ran typecheck, lint, the test suite, the CRM build and a
26-route browser smoke pass; all passed.

| Check | Result |
| --- | --- |
| TypeScript and ESLint | PASS — 0 errors; 5 informational warnings repository-wide |
| Vitest unit / dom | PASS — 129 / 129 (4 files) and 8 / 8 |
| CRM build | PASS — 0 chunks over 500 kB; `AutomationScreens` 8.75 kB and `AiScreens` 4.49 kB lazy chunks |
| Browser smoke | PASS — `/app/workflows` and `/app/ai` navigated at 1280 px with 0 console errors each; the 26-route pass reported 0 console errors everywhere |

---

## 8. Assumptions / Risks

- Created `automation/` and `ai/` route directories (may not have existed). No existing files overwritten.
- Router uses lazy imports with `.then` for named exports where appropriate. Module keys `workflows`/`ai` already exist in config; no new keys added.
- AI workspace creates conversations via `services.ai.createConversation` and sends via `services.ai.send()` — both exist and return deterministic results. Email draft extraction depends on `assistant.draft?.kind === 'email'`.
- Simulation uses existing `workflows.simulate()` which returns disclaimer and step-by-step trace as implemented.
- No real AI usage anywhere; all labels match required "simulated"/"demo" terminology.

---

## 9. Files created

- `apps/crm/src/routes/automation/AutomationScreens.tsx` (new)
- `apps/crm/src/routes/ai/AiScreens.tsx` (new)

## 10. Files modified

- `apps/crm/src/app/router.tsx` — wired `/app/workflows`, `/app/workflows/new`, `/app/workflows/:workflowId`, `/app/workflows/:workflowId/runs`, `/app/workflows/*`, `/app/ai`, `/app/ai/*` to real routes

## 11. Rollback notes

Revert router changes to restore placeholders; remove created route files if needed.

## 12. Final message (as requested)

**Final message:**
- Created: `apps/crm/src/routes/automation/AutomationScreens.tsx` (WorkflowList, WorkflowDetail, WorkflowRuns, WorkflowNew), `apps/crm/src/routes/ai/AiScreens.tsx` (AiWorkspace). Directories `apps/crm/src/routes/automation/` and `apps/crm/src/routes/ai/` created if missing.
- Router changes (`apps/crm/src/app/router.tsx`): replaced `/app/workflows` and `/app/workflows/*` placeholders with real routes: `/app/workflows` (list), `/app/workflows/new`, `/app/workflows/:workflowId` (detail/editor + validation + simulate), `/app/workflows/:workflowId/runs` (history/audit), and fallback `workflows/*` to list. Replaced `/app/ai` and `/app/ai/*` with real lazy routes to AiWorkspace. Reused existing module keys `workflows`/`ai` (no new moduleRouteManifest keys added). Used named exports via `.then` where appropriate.
- Assumptions/risks: no new deps; used only existing exports (services.workflows, services.ai, shared UI). All outputs deterministically labelled (simulation/demo). Email drafting shows "nothing is sent" state and requires review (no send implemented). Canvas kept text-based for accessibility/simplicity. Verification passed in the consolidated pass: typecheck and lint clean, 129 / 129 unit and 8 / 8 dom tests, the CRM build with no chunk over 500 kB, and 0 console errors on `/app/workflows` and `/app/ai`.
