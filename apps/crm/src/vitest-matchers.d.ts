/// <reference types="@testing-library/jest-dom/vitest" />

/**
 * Test matcher types for the CRM screen tests, which run in vitest's `dom` project.
 *
 * `vitest.setup.ts` registers the jest-dom matchers at run time, but this package's own `tsc`
 * run does not include that setup file, so without this reference the screen tests would not
 * typecheck. Mirrors `packages/ui/src/vitest-matchers.d.ts`.
 */
