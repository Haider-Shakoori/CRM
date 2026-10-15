# Design System

**Status:** foundations implemented (Batch 2). Component library covers the primitives,
form controls, overlays, navigation, data display and layout. Chart wrappers, kanban and
the workflow canvas land with the batches that need them.

---

## 1. Visual direction

The brief asks for premium, clean, modern, professional, reliable, information-rich but
minimal, distinctive, international and highly polished — while explicitly forbidding
decoration that competes with task completion.

That resolves to a specific stance:

| We do | We do not |
| --- | --- |
| One accent hue with a perceptual colour model | Gradients on chrome, glassmorphism everywhere |
| Tinted neutrals (a hint of violet in every grey) | Pure `#000`/`#fff` greys that read as defaulted |
| Soft, wide, low-opacity shadows | Hard drop shadows, coloured glows on surfaces |
| Density that a sales team can actually work in | Oversized cards with one number and lots of air |
| Motion that explains a state change | Motion that draws attention to itself |
| Illustration only where a concept needs it | Stock photography and generic 3D blobs |

### Why OKLCH

The palette is authored in OKLCH rather than hex. Lightness in OKLCH is perceptually
uniform across hues, which means:

- dark mode can be derived by moving lightness rather than by hand-picking fifty new hex
  values
- two colours with the same `L` genuinely look equally bright, so contrast between the
  light and dark themes stays consistent
- adding an accent hue produces a usable ramp without a designer iterating on each step

A practical consequence: `oklch(0.556 0.222 285)` and `oklch(0.556 0.222 195)` differ in
hue only. The old hex equivalents did not — the teal read noticeably darker than the violet
at the same nominal brightness, which is exactly the kind of drift that makes status colours
unreliable.

### The accent is a decision, not a default

The primary is a violet-leaning `oklch(0.556 0.222 285)`. It is deliberately not the blue
used by the best-known CRM platforms nor their orange. Seven presets are exposed to tenant
administrators (`violet`, `teal`, `blue`, `emerald`, `amber`, `rose`, `slate`), and the
default is a configuration value in `branding.ts`, not a literal in a component.

---

## 2. Token architecture

Four layers, each with one job:

```
Layer 1  Raw palette            --brand-600, --neutral-150, --green-500
         Static. Never referenced by a component.

Layer 2  Semantic aliases       --surface-base, --fg-muted, --border-subtle, --danger
         The only names components and utilities use.

Layer 3  Theme overrides        [data-theme='dark'], [data-density=…], [data-contrast=…]
         Re-map layer 2. Components are unaware a theme exists.

Layer 4  Tailwind bridge        @theme inline { --color-surface: var(--surface-base); … }
         Turns layer 2 into utilities. `inline` keeps runtime switching working.
```

The payoff of the split: **a component never knows which theme it is rendering in.** There
is no `dark:` variant in a component for colour, and no branch like `isDark ? a : b`. A new
theme is a new layer 3 block.

### Token groups

| Group | Examples | Notes |
| --- | --- | --- |
| Surfaces | `canvas`, `surface`, `raised`, `overlay`, `sunken`, `inset`, `hover`, `active`, `selected` | Ordered back-to-front. Dark mode expresses separation through these steps because shadows carry almost no signal on dark backgrounds. |
| Foreground | `fg`, `muted`, `subtle`, `faint`, `inverse`, `on-brand`, `brand-fg`, `link` | Four levels of de-emphasis. `faint` is for metadata only and is never used for body text. |
| Borders | `border-subtle`, `border`, `border-strong`, `border-brand` | `border-subtle` is the default hairline; `border-strong` is for inputs and interactive edges. |
| Status | `success`, `warning`, `danger`, `info` + `-subtle`, `-fg`, `-hover` | Three roles per status: the fill, the washed background, and the text-on-wash colour. |
| Tones | `tone-violet`, `tone-teal`, `tone-amber`, `tone-green`, `tone-red`, `tone-blue`, `tone-slate` + `-bg` | Used by pipeline stages, tags, health bands and chart legends. |
| Charts | `chart-1` … `chart-10`, `chart-grid`, `chart-axis` | Ten-colour categorical palette, ordered to remain distinguishable under common colour-vision deficiencies. Separate values per theme. |
| Integration | `inactive`, `glass`, `scrim` | Control surfaces grouped with the borders they sit on. |

### Control metrics

`--control-h-sm|md|lg` and `--row-h` are derived from `--density-factor`:

```css
--control-h-md: calc(2.125rem * var(--density-factor));
```

Density is therefore one number, and every control that should resize does so together. A
component that hardcodes `h-9` breaks compact mode; the rule is to use the token.

---

## 3. Themes

### Light / dark / system

`ThemeProvider` resolves `system` against `prefers-color-scheme` and watches for changes, so
a visitor who switches their OS theme at midnight sees the change without reloading. The
resolved value is written to `data-theme`, and `color-scheme` is set so native controls —
scrollbars, date pickers, `select` popups — match.

Both apps and the website persist to the same key (`crm.ui.preferences`), so a theme chosen
on the marketing site applies inside the CRM.

### Density: comfortable, compact, spacious

```css
[data-density='compact'] {
  --density-factor: 0.875;
  --spacing: 0.21875rem; /* 0.25rem × 0.875 */
}
```

Tailwind v4 derives every numeric spacing utility from `--spacing`, so overriding one
custom property rescales padding, gaps and sizes across the entire product. This is the
single highest-leverage token decision in the file: compact mode is one declaration, and it
cannot be applied inconsistently, because a component using `p-3` automatically scales.

Density defaults by persona — sales representatives and support agents get compact because
they scan long lists; executives and field representatives get comfortable.

### High contrast

`[data-contrast='high']` strengthens borders and pushes text to near-black or pure white.
Dark high-contrast has its own block because the two need different adjustments. This is a
token override, not a component variant, so nothing needs to know it exists.

### Accent presets

`data-accent` is applied alongside the theme, and a tenant administrator's choice in the
branding editor is stored on the organization. Because `--brand-*` are custom properties,
a tenant can re-brand without a rebuild or a redeploy.

---

## 4. Typography

System font stack, with optional Inter first in the list. **No web font is downloaded**,
which removes a render-blocking request, a layout shift, and a privacy consideration — and
the fallback stack is tuned so the fallback is genuinely acceptable rather than a visible
downgrade.

Script-appropriate fallbacks are declared for the three non-Latin scripts in scope:

```css
[lang='ar'], [lang='fa-AF'], [lang='ps'], [dir='rtl'] {
  font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, var(--font-family-sans);
}
```

Without this, Arabic text falls back to a Latin face's Arabic glyphs, which look wrong and
set badly.

### Scale

The base size is `0.875rem` (14px), not 16px. A CRM is an application, not an article:
14px with a 1.375 line height fits materially more rows on a 1366px laptop without becoming
cramped, and the marketing site opts into larger sizes per section. Body text never goes
below `0.75rem` (12px), and `0.6875rem` is reserved for overlines and 2xs metadata.

`text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs are set globally —
one line of CSS that removes most orphaned words.

### Numerals

Every figure in a table, KPI or chart axis uses `tabular-nums`. Without it, a number
changing from `1,111` to `2,222` visibly shifts column width, which reads as instability in
a dashboard that is supposed to feel live.

---

## 5. Spacing, radius, elevation, motion

**Spacing** is a 4px scale, overridden in one place per density. Section rhythm on the
website is `py-16 sm:py-20`; CRM views use `px-4 sm:px-6 lg:px-8`.

**Radius** is restrained: `0.375rem` default for controls and cards, `0.5rem` for panels,
`0.875rem`/`1.125rem` only for hero surfaces and marketing cards. Radii above `0.625rem`
inside the CRM would read as decorative.

**Elevation** uses soft, wide, low-opacity shadows. Dark mode swaps them for
border-and-ring separation, because a 0.1-opacity black shadow is invisible on a dark
surface — a genuine mistake that makes dark UIs feel flat and unlayered.

**Motion** has three named easings, with `standard` (`cubic-bezier(0.32, 0.72, 0, 1)`) as
the default. Durations run 80–620ms; anything above 400ms is reserved for deliberate
transitions the user initiated, and nothing decorative exceeds 260ms.

Reduced motion is honoured twice — the OS media query *and* `[data-reduced-motion='true']`
— because an in-app preference must work when the OS setting is unavailable.

---

## 6. Component library

### Structure

```
packages/ui/src/
  lib/utils.ts              cn(), tone helpers, focus ring, content widths
  theme.tsx                 ThemeProvider, useTheme, media queries, LiveRegion
  components/
    primitives.tsx          Button, IconButton, Badge, TonePill, StatusBadge, Card,
                            Avatar, AvatarGroup, Progress, ScoreRing, Separator,
                            Skeleton, Alert, DemoNotice, Container, Grid
    forms.tsx               Field, Label, FieldGroup, Input, Textarea, PasswordInput,
                            SearchInput, Select, Checkbox, Switch, RadioGroup,
                            MultiSelect, CurrencyInput, PhoneInput, AddressInput,
                            Slider, useUnsavedChangesWarning
    overlays.tsx            Dialog, Sheet, ConfirmDialog, DropdownMenu, Tooltip,
                            Popover, Toaster, notify
    data.tsx                TableWrap/Th/Td/Tr, PropertyList, DataTable, EmptyState,
                            ErrorState, KpiCard, KpiRow, Timeline, FileUpload,
                            ChartSkeleton, ConversionChip
    navigation.tsx          Tabs, Breadcrumbs, Pagination, Accordion, SidebarNav,
                            NavSection, Steps, PageShellSkeleton, SkipLink
```

### Conventions worth stating explicitly

**`StatusBadge` cannot silently mislabel a status.** It maps known statuses to tones and
falls back to neutral for anything unrecognised. A new backend status therefore appears as
neutral rather than accidentally rendering as green — a safety property, not a nicety.

**`EmptyState` accepts hints, not just prose.** A first-run screen that says "no leads" is a
dead end; one that suggests "import a list, add a lead, or connect a form" is a next step.

**`ErrorState` distinguishes entitlement from failure.** `not-entitled` renders with an
upgrade action and different copy from `forbidden`. Conflating them is a common and
frustrating product bug.

**`ConfirmDialog` is never a single click for destructive work.** Danger tone, a verb in the
confirm label, and a slot for a reason field or type-to-confirm input.

**`notify.simulated()` exists so nobody has to remember the wording.** Any action that did
not actually reach a real system calls it, and the user is told plainly. This is how the
"never fake success" rule becomes the path of least resistance.

**`DemoNotice` is a component, not a pattern.** One line to label synthetic data, an
unavailable integration or a previewed capability.

**Charts require `allowTableToggle`.** It is a required field on `WidgetOptions`, so a
chart without a table alternative does not typecheck.

**`IconButton` requires `label`.** The most common accessibility defect in application UIs
is an unlabelled icon button; here it is a compile error.

---

## 7. Accessibility standard

Target: **WCAG 2.2 AA**, with the following concrete commitments.

| Requirement | Implementation |
| --- | --- |
| Keyboard operability | Every interactive element reachable and operable; Radix handles composite widgets |
| Visible focus | A two-layer ring (`outline` + `ring-offset`) that survives on any surface; never removed |
| Logical heading order | Heading level is a prop on `Section`, so page structure can be correct even when visual order differs |
| Form errors | Linked by `aria-describedby`, marked with `aria-invalid`, announced via `role="alert"` |
| Skip link | First focusable element in every layout, revealed on focus |
| Live regions | `LiveRegion` for optimistic updates and simulated actions |
| Accessible dialogs | Radix focus trap, `aria-modal`, labelled title and description |
| Reduced motion | OS preference and in-app preference both honoured |
| Colour independence | Text, arrows, signed numbers and screen-reader words accompany colour |
| Target size | Minimum 28×28px for controls; `IconButton` sizes start at 28px and default to 34px |
| Text scaling | `rem` throughout, so browser zoom to 200% does not clip |
| Reflow | No horizontal page scroll at 320px; tables scroll within their own container |
| Chart alternatives | Table toggle is contractually required |

Known gap: automated `axe` runs are wired into Playwright but the suites land with each
batch's features. No page has a completed axe report yet.

---

## 8. Right-to-left

RTL is a layout concern, not a translation afterthought.

- Layout uses logical properties throughout: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`,
  `end-*`, `text-start`, `border-s`.
- `[dir='rtl']` variants handle the genuinely directional exceptions: chevrons rotate,
  arrows flip, and the canonical-favicon-style 1:1 controls are deliberately excluded.
- `logical` in `@crm/localization` covers JavaScript cases: chart margins, canvas node
  offsets, SVG coordinates.
- Text direction is isolated per value, so a Latin phone number inside an Arabic paragraph
  does not reorder (`\u2068…\u2069`).
- Numbers use the locale's own numbering system when requested, with Eastern Arabic digits
  as an explicit opt-in rather than an automatic switch.

Arabic is included as a substantially complete dictionary specifically so direction could be
verified against real strings, long compound words and mixed-direction content.

---

## 9. Honest labelling as a design element

Most design systems treat "this is simulated" as an engineering problem. Here it is part of
the design language:

- `DemoNotice` renders a small dashed-outline pill, visually distinct from status badges so
  it never reads as a state of the data.
- `Badge variant="outline"` with the `Sample` label marks synthetic figures.
- Simulated activity entries in a timeline carry the pill, so a real user action and an
  automation result are distinguishable at a glance.
- `notify.simulated()` produces an info toast that states nothing was sent.
- Every simulated integration connection shows its availability as `demo`, `planned`,
  `coming soon` or `unavailable` — four states, because collapsing them would be dishonest.

The visual consequence is intentional: honesty is visible, not buried in a tooltip.

---

## 10. What is intentionally absent

| Not built | Reason |
| --- | --- |
| Brand identity, logo design, custom illustration set | Prohibited — the final name and mark are not decided. Local placeholders are generated SVG. |
| Illustration library for empty states | One generated placeholder exists; a real set needs the identity first. |
| Icon set | Lucide is used directly. A bespoke set would be premature. |
| Dark-mode-specific illustrations | Nothing to theme yet. |
| Sound, haptics, confetti, celebration animations | Decoration that competes with task completion. |
| Avatar photo service | Initials with deterministic tone avoids an external dependency and a privacy consideration. |
| Glassmorphism, neumorphism, gradient chrome | Explicitly avoided in favour of restrained decoration. |

---

## 11. Further work

1. Chart wrapper components (`LineChart`, `BarChart`, `DonutChart`, `FunnelChart`,
   `CohortGrid`) with the required chart-to-table toggle.
2. Kanban primitives with `dnd-kit`, plus the accessible non-drag alternative and an
   optimistic move that reconciles against pipeline totals.
3. Workflow canvas primitives: node, port, edge, minimap, validation badge.
4. Journey canvas built on the same primitives as the workflow canvas, since the shapes are
   nearly identical and duplicating them would be a mistake.
5. Command palette (⌘K) with grouped results, recent searches and keyboard navigation.
6. Virtualised table body for the one case that genuinely needs it: a 200-row page at
   compact density.
7. `axe-core` results recorded per page in `TEST_REPORT.md`.
8. Contrast audit of every `-fg`-on-`-subtle` pair, recorded as measured ratios rather than
   asserted compliance.
