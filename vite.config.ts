import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Base path configurabile: '/' in locale, '/gymLog/' su GitHub Pages (VITE_BASE).
  const base = loadEnv(mode, '.', 'VITE_').VITE_BASE || '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'gymLog',
          short_name: 'gymLog',
          description: 'Registro allenamenti personale, offline.',
          lang: 'it',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#050408',
          theme_color: '#050408',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      environment: 'node',
      setupFiles: ['./src/test/setup.ts'],
      env: { TZ: 'Europe/Rome' },
      include: ['src/**/*.test.ts'],
    },
  };
});
