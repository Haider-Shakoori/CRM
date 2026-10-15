# Batch Report — Batch 13

**Batch:** 13 — Customization (custom objects/fields, page layouts, validation rules, saved views, industry templates)
**Date:** 2026-10-14
**Repository state:** no backend; deterministic in-browser mock services
**Prior report:** [`BATCH_12_REPORT.md`](./BATCH_12_REPORT.md)

---

## 1. Features implemented

Batch 13 implements the customization and templates modules as frontend-only screens, using existing mock services.

### Customization — objects, fields, layouts, validation, saved views

- **Custom objects & fields** (`/app/customization/objects`): lists custom objects with label, API name, field count, record count, status, kind; clicking an object navigates to the field manager.
- **Field manager** (`/app/customization/objects/:objectId`): lists fields for the selected object showing API name, type (mapped from `FieldType`), required/read-only flags, usage reference count, and simulated actions (Add/Edit/Delete field).
- **Page layouts** (`/app/customization/layouts`): grid view of existing layouts showing object, kind, version, section count, highlights count, active status; simulated edit and live preview actions.
- **Validation rules** (`/app/customization/validation`): an honest notice that no validation-rules service exists, so a rule cannot be stored or enforced; the manager is deliberately read-only.
- **Saved views** (`/app/customization/views`): lists saved views with object, scope, default/pinned flags, column count; simulated edit/delete actions.

### Industry templates — gallery + preview

- **Template gallery** (`/app/templates`): shows industry templates with industry, status (Installed/Not installed), summary (clamped), and counts for objects/fields/workflows. Actions: Preview, Install (simulated), Uninstall (simulated). Includes DemoNotice about simulation and an explicit Alert: "Uninstall does not lose your own data. Only template-defined artifacts are marked as removed in the simulation; any records, fields, or configurations you created remain intact."
- **Template detail** (`/app/templates/:templateId`): shows template summary (industry, status, installs, updated), a "What this template adds" preview fetched via `services.industryTemplates.previewChanges()` displaying additions (objects, fields, pipelines, workflows, dashboards, reports, templates) and any conflicts (Custom object/field conflicts with existing labels/API names). Includes a detailed contents table. Both Install and Uninstall actions explicitly state they are simulated and that uninstall does not lose your own data.

### Honesty controls

- All "Add/Edit/Delete/Install/Uninstall/Preview" actions use `notify.simulated()` to clearly label effects as simulated.
- Template uninstall explicitly states: "does not lose your own data" in UI text (both gallery context and detail view), matching the required honesty rule.
- Layouts screen marks actions as simulated and preview uses mock data; no real persistence implied.
- Fields screen notes deletion "conflicts are not actually checked" in simulated message (honest about simulation limits).

---

## 2. Pages and routes created/edited

**New files:**

- `apps/crm/src/routes/customization/CustomizationScreens.tsx` — exports `ObjectsScreen`, `ObjectDetailScreen`, `LayoutsScreen`, `ValidationRulesScreen`, `SavedViewsScreen`, `CustomizationScreens` (default ObjectsScreen).
- `apps/crm/src/routes/customization/TemplateScreens.tsx` — exports `TemplateGallery`, `TemplateDetail`, `TemplateScreens` (default TemplateGallery).

**Edited:**

- `apps/crm/src/app/router.tsx` — replaced placeholder routes:
  - `/app/customization` → `<Navigate to="/app/customization/objects" replace />` (already existed; now target is real child)
  - `/app/customization/*` placeholder removed and replaced with real routes:
    - `/app/customization/objects` (lazy loads `CustomizationScreens.ObjectsScreen`)
    - `/app/customization/objects/:objectId` (lazy loads `CustomizationScreens.ObjectDetailScreen`)
    - `/app/customization/layouts` (lazy loads `CustomizationScreens.LayoutsScreen`)
    - `/app/customization/validation` (lazy loads `CustomizationScreens.ValidationRulesScreen`)
    - `/app/customization/views` (lazy loads `CustomizationScreens.SavedViewsScreen`)
  - `/app/templates` placeholder removed, replaced with:
    - `/app/templates` (lazy loads `TemplateScreens.TemplateGallery`)
  - added `/app/templates/:templateId` (lazy loads `TemplateScreens.TemplateDetail`)

Router module keys reused from existing lazy patterns; no new modules required.

---

## 3. Components created or reused

**Reused from `@crm/ui`:** `Alert`, `Badge`, `Button`, `Card`, `DemoNotice`, `Dialog` (components present), `EmptyState`, `Field`, `Input`, `Select`, `TableWrap/Th/Tr/Td`, `IconButton`, `cn`, `notify`.
**Reused from shared components:** `FilterBar`, `ListSkeleton`, `PageHeader`, `formatDate`.
**Icons from `lucide-react`:** `Plus`, `Edit`, `Trash2`, `Eye`, `Save`, `Columns3`, `ListChecks`, `FileText`, `CheckCircle`, `Download`, `AlertTriangle`, `Package`, `Layers`, `Workflow`.

No new UI primitives added. No new npm dependencies.

---

## 4. Interactive mock workflows completed

1. **Browse custom objects** — lists from `services.customObjects.list()`; filters by search.
2. **View object fields** — navigates to detail, loads `services.customObjects.get()` and `services.customObjects.fields()`.
3. **Browse layouts** — lists via `services.layouts.list()`; shows counts and statuses.
4. **Validation rules** — renders an honest notice that no validation-rules service exists; the manager is deliberately read-only, and its simulated buttons say that no rule was created.
5. **Saved views manager** — lists via `services.savedViews.list()`; shows scope/default/pinned.
6. **Browse templates gallery** — lists via `services.industryTemplates.list()`; displays installation state.
7. **Preview template changes** — detail screen fetches `services.industryTemplates.previewChanges()` and renders additions/conflicts exactly as returned.
8. **Simulated install/uninstall** — both routes show honest simulated messages; uninstall message explicitly states no loss of user data.

All reads use existing mock services; writes are not performed (only simulated notifications per requirements).

---

## 5. Accessibility considerations

- Interactive elements use semantic buttons/links; card with onClick also supports keyboard (Enter/Space) in similar patterns where used elsewhere (layouts grid actions are buttons/links).
- Icon buttons include `aria-label` (e.g., Edit, Delete).
- Tables use proper headers (`Th` with scope semantics via `@crm/ui`).
- Status conveyed via text + Badge (not color alone).
- Demo notices and alerts provide context; loading states via `ListSkeleton`.
- Focus styles provided by `focusRing` on interactive elements.

---

## 6. Assumptions and risks

**Assumptions:**
- `services.customObjects`, `services.savedViews`, `services.layouts`, `services.industryTemplates` exist and behave as per mock contracts (confirmed in codebase: `extra.ts`, `customization-extras.ts`, container wiring).
- `CustomizationScreens` subcomponents (`ObjectsScreen`, `ObjectDetailScreen`, `LayoutsScreen`, `ValidationRulesScreen`, `SavedViewsScreen`) and `TemplateScreens` subcomponents (`TemplateGallery`, `TemplateDetail`) are exported as specified so router can lazy-load them.
- No validation rules service method exists in the mock container. The consolidated pass replaced the screen's stub with an honest notice: the route states that no validation-rules service exists, so a rule cannot be stored or enforced, and the manager is deliberately read-only (its buttons say so rather than pretending a rule was created).
- `FieldType` values map to labels as defined in `@crm/shared-types/customization.ts`.

**Risks:**
- Validation rules are read-only. If a `validationRules` service arrives with a later batch, the screen needs a full editor; for now it states plainly what it cannot do, because a control that only simulated persistence would imply it worked.
- Object field delete in demo simulates without checking usage conflicts (honestly noted). Real enforcement would require calling the actual service method.
- Router changes affect customization/templates routes; placeholders removed — existing deep links to old placeholder behavior are replaced by real screens.

---

## 7. Verification

**Passed** in the consolidated end-of-run pass.

| Check | Result |
| --- | --- |
| TypeScript and ESLint | PASS — 0 errors; 5 informational warnings repository-wide |
| Vitest unit / dom | PASS — 129 / 129 (4 files) and 8 / 8; the new `modules.test.ts` adds two customization-extras cases (layouts listed and previewed, industry templates listed) |
| CRM build | PASS — 0 chunks over 500 kB; `CustomizationScreens` 12.42 kB and `TemplateScreens` 10.90 kB lazy chunks |
| Browser smoke | PASS — `/app/customization/objects`, `/app/customization/layouts` and `/app/templates` navigated at 1280 px with 0 console errors each |

The consolidated pass also replaced the validation-rules stub with the read-only notice
described in §6, and removed unused imports and variables across the batches 9–15 screens.
