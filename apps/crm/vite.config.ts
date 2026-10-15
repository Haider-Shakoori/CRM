import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * CRM application build configuration.
 *
 * This is an authenticated single-page application, so it is configured for a client-side
 * router rather than static generation: a deep link such as `/app/deals/deal-1` must resolve
 * to `index.html` and let the router take over. The host must therefore rewrite unknown paths
 * to the entry document, which is documented in the deployment notes rather than assumed.
 *
 * Route-level code splitting keeps the initial bundle to the shell plus the landing screen.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The website links into this application from a different origin during development.
    cors: true,
  },
  preview: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    /**
     * Chunk strategy.
     *
     * Measured against the built sourcemap, the entry chunk was 758 kB and almost all of
     * that was *not* the `@crm/ui` barrel — it was the mock service layer and its seeded
     * dataset, which the composition root imports eagerly. Splitting by dependency group
     * keeps every chunk under the warning threshold, lets the browser parse them in
     * parallel, and means a change to a screen does not invalidate the vendor cache.
     *
     * A dependency only appears here if it is genuinely heavy and shared. Route-level
     * `import()` already separates screens; this separates the libraries beneath them.
     */
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@dnd-kit')) return 'dnd';
          // Workspace packages are source-only, so they resolve to filesystem paths rather
          // than package names. Match on the directory segment, not the specifier.
          // The generated dataset (~2,000 records) is pure data and the largest single
          // contributor, so it gets its own chunk: the service code and the seeds age at
          // different rates, and keeping them apart leaves both well under the warning
          // threshold as further batches add service modules.
          if (id.includes('/packages/mock-services/src/seed/')) return 'mock-seed';
          // The service layer. Loaded once by the composition root.
          if (id.includes('/packages/mock-services/')) return 'mock-services';
          // Reference data: module registry, site IA, plans, industries, locales.
          if (id.includes('/packages/configuration/') || id.includes('/packages/localization/')) return 'reference-data';
          // The design system and its Radix primitives. Shared by the shell and every screen.
          if (id.includes('/packages/ui/') || id.includes('/packages/design-tokens/') || id.includes('@radix-ui/')) return 'ui';
          // Table and query engines are large and used by lists rather than the shell.
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms';
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
