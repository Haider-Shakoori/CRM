import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guard against a silent Tailwind v4 theme collision.
 *
 * Layer 6 of `tokens.css` bridges raw scale tokens (`--w-*`, `--r-*`, ...) into
 * Tailwind's `@theme inline` namespaces. The `--container-*` namespace feeds the
 * `w-*` utilities as well as `max-w-*`, so a key named e.g. `full` overrides
 * Tailwind's built-in `.w-full { width: 100% }` with `var(--w-full)` (90rem) and
 * silently blows every `w-full` element out to 1440px. That shipped once; this
 * test fails fast if it is ever reintroduced.
 */
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

// Names Tailwind already owns as static width utilities (`w-<name>`).
const TAILWIND_STATIC_WIDTH_UTILITIES = ['auto', 'full', 'screen', 'min', 'max', 'fit', 'px'];

// `--container-*` is only ever declared (never read) in this file, so a `:` match
// reliably identifies the bridge keys Tailwind turns into utilities.
const containerKeys = [...css.matchAll(/--container-([a-z0-9-]+)\s*:/g)].map((match) => match[1] ?? '');

describe('design tokens — Tailwind theme bridge', () => {
  it('exposes at least one container key', () => {
    expect(containerKeys.length).toBeGreaterThan(0);
  });

  it('never shadows a Tailwind static width utility', () => {
    const collisions = containerKeys.filter((key) => TAILWIND_STATIC_WIDTH_UTILITIES.includes(key));
    expect(collisions).toEqual([]);
  });

  it('keeps the raw width scale the widest page container references', () => {
    expect(css).toMatch(/--w-full:\s*90rem/);
  });
});
