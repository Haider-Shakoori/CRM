import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * Platform administration console build configuration.
 *
 * A separate application from the CRM because it is a separate trust domain: a platform
 * operator is not a tenant user, and nothing should make the tenant administration panel
 * look like a menu item inside the console that manages the platform itself.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5174, cors: true },
  preview: { port: 5174 },
  build: { outDir: 'dist', sourcemap: true },
});
