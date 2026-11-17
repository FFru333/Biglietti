import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH viene impostato dal workflow di GitHub Pages (es. "/biglietti/").
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Biglietti',
        short_name: 'Biglietti',
        description: 'Portafoglio personale di biglietti di viaggio. Offline, sul dispositivo.',
        lang: 'it',
        start_url: './',
        scope: './',
        id: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F2EE',
        theme_color: '#F4F2EE',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,woff2,png,svg,webmanifest,wasm,pfb,ttf,gz}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
