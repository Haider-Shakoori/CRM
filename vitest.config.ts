import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration.
 *
 * Two projects:
 *
 *  - `unit` covers the framework-agnostic packages (mock services, localization,
 *    configuration, shared types). It runs in Node because none of them touch the DOM,
 *    which makes it roughly an order of magnitude faster than a jsdom project and keeps
 *    the mock-service tests honest about not depending on browser globals.
 *
 *  - `dom` covers React components and hooks. It uses jsdom, Testing Library and
 *    `vitest-axe` for accessibility assertions. It also covers the CRM application's screens,
 *    which is where a control's write path can be exercised at all: the in-app browser surface
 *    stays hidden during a smoke run, so Chromium delivers no pointer events and nothing that
 *    depends on `onClick` can be verified there.
 *
 * `passWithNoTests` is deliberately NOT set: if a project's include pattern matches
 * nothing, that is a configuration mistake worth failing on rather than silently passing.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'packages/mock-services/src/**/*.test.ts',
            'packages/localization/src/**/*.test.ts',
            'packages/configuration/src/**/*.test.ts',
            'packages/design-tokens/src/**/*.test.ts',
            'packages/shared-types/src/**/*.test.ts',
          ],
          globals: true,
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['packages/ui/src/**/*.test.tsx', 'apps/crm/src/**/*.test.tsx', 'apps/platform-admin/src/**/*.test.tsx'],
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          // The workspace packages export TypeScript source, so they must be transformed by
          // Vite rather than handed to Node, which cannot read `.ts` or `.tsx`.
          server: { deps: { inline: [/@crm\//] } },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', '**/index.ts', '**/*.d.ts'],
      reporter: ['text', 'html'],
    },
  },
});
