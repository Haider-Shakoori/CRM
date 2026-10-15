/**
 * `@crm/ui` — the shared design-system component library.
 *
 * Import everything from the package root. Components read their colours, spacing and
 * radii from `@crm/design-tokens`, so a tenant-level re-brand requires no code change
 * here.
 *
 * Application shells (`apps/website`, `apps/crm`, `apps/platform-admin`) must include
 * `@crm/design-tokens/tokens.css` before their own styles and must declare
 * `@source "../../../packages/ui/src"` so Tailwind scans these classes.
 */

export * from './lib/utils';
export * from './theme';
export * from './components/primitives';
export * from './components/forms';
export * from './components/overlays';
export * from './components/data';
export * from './components/navigation';
export * from './components/charts';
export * from './components/kanban';
