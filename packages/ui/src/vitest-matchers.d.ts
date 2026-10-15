/// <reference types="@testing-library/jest-dom/vitest" />

/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- Augmenting vitest's Assertion requires matching its exact generic signature and adding no members of our own. */

import type { AxeMatchers } from 'vitest-axe/matchers';

/**
 * Test matcher types for the `dom` vitest project.
 *
 * `vitest.setup.ts` registers the jest-dom and vitest-axe matchers at run time, but the UI
 * package's own `tsc` run does not include that setup file, so TypeScript would not otherwise
 * know the matchers exist. jest-dom ships a `vitest` entry that augments vitest's `Assertion`
 * directly; vitest-axe only ships a `Vi` global (an older vitest shape), so its matchers are
 * added here against the current module augmentation.
 */
declare module 'vitest' {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
