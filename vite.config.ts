import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/20-number-game/',
  server: {
    port: 5184,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        // Adds the push and notificationclick listeners to the generated
        // worker instead of taking ownership of the whole thing with
        // injectManifest. The precaching and the update handling that
        // src/registerSW.ts drives stay exactly as Workbox writes them.
        importScripts: ['push-sw.js'],
        // ...and it must not also be precached as an ordinary asset: it is
        // already part of the worker script itself.
        globIgnores: ['**/node_modules/**/*', 'push-sw.js'],
      },
      includeAssets: ['favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'],
      manifest: {
        name: 'Order 20',
        short_name: 'Order 20',
        description: 'Roll a number, place it in ascending order across 20 positions.',
        theme_color: '#16131b',
        background_color: '#16131b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
