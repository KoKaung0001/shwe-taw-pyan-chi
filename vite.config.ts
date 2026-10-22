import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': path.resolve(root, 'src') },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'allow-vite-hmr-websocket-in-development-csp',
      apply: 'serve',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html
            .replace(
              "connect-src 'self' https://*.supabase.co;",
              "connect-src 'self' https://*.supabase.co ws://127.0.0.1:*;",
            )
            .replace("style-src 'self';", "style-src 'self' 'unsafe-inline';");
        },
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
