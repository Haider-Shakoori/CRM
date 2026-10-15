// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * Public website build configuration.
 *
 * Static output is the default: every marketing, resource, legal and pricing page is
 * pre-rendered for SEO and Core Web Vitals. Only the genuinely interactive islands
 * (mobile navigation, the pricing calculator, the public demo) ship JavaScript, and
 * each is loaded with `client:visible` or `client:idle` so it stays off the critical
 * path.
 *
 * The production domain is a configuration placeholder. It is read from an environment
 * variable at build time so the final domain can be set without touching source.
 */
const site = process.env.PUBLIC_SITE_URL ?? 'https://example-crm.test';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
    format: 'directory',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'viewport',
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
  integrations: [
    react(),
    sitemap({
      // Legal placeholders and demo-only pages must not be indexed as if final.
      filter: (page) =>
        !page.includes('/verify-email') &&
        !page.includes('/reset-password') &&
        !page.includes('/accept-invitation'),
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
});
