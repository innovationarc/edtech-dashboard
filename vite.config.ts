import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Network-only routes — require live internet, show offline banner
const NETWORK_ONLY_ROUTES = [
  /\/live-classes/,
  /\/student-live-classes/,
  /\/live-class-settings/,
  /\/streams/,
  /\/student-streams/,
  /\/stream-settings/,
  /\/live-exams/,
  /\/student-live-exams/,
  /\/exam\//,
  /\/content-library\/exam\//,
  /\/nova-context/,
  /\/firebase-monitor/,
  /\/ai-model-settings/,
];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],

      manifest: {
        name: 'pie Academy',
        short_name: 'pieAcademy',
        description: 'pie Academy — Your intelligent learning platform by pieOS',
        theme_color: '#6366f1',
        background_color: '#0f0f1a',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: 'icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['education'],
        lang: 'en',
        dir: 'ltr',
      },

      workbox: {
        cacheId: 'pie-academy-v1',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        skipWaiting: false,
        clientsClaim: true,
        // Default 2 MiB limit — chunks must stay under this
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|avif)(\?.*)?$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.b-cdn\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bunny-cdn-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-auth-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/favicon\.ico/],
      },

      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],

  optimizeDeps: {
    exclude: ['lucide-react'],
  },

  build: {
    chunkSizeWarningLimit: 1000, // warn at 1 MB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ── Firebase — split each sub-package individually (they're huge) ──
          if (id.includes('node_modules/@firebase/firestore')) return 'firebase-firestore';
          if (id.includes('node_modules/@firebase/auth')) return 'firebase-auth';
          if (id.includes('node_modules/@firebase/storage')) return 'firebase-storage';
          if (id.includes('node_modules/@firebase/functions')) return 'firebase-functions';
          if (id.includes('node_modules/@firebase/messaging')) return 'firebase-messaging';
          if (id.includes('node_modules/@firebase/analytics')) return 'firebase-analytics';
          if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'firebase-core';

          // ── React core ──
          if (id.includes('node_modules/react-dom')) return 'vendor-react-dom';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-is')) return 'vendor-react';

          // ── React Router ──
          if (id.includes('node_modules/react-router')) return 'vendor-router';

          // ── Framer Motion ──
          if (id.includes('node_modules/framer-motion')) return 'vendor-framer';

          // ── Charts ──
          if (id.includes('node_modules/recharts')) return 'vendor-recharts';
          if (id.includes('node_modules/d3') || id.includes('node_modules/d3-')) return 'vendor-d3';

          // ── AI / Groq / Gemini SDKs ──
          if (id.includes('node_modules/@google') || id.includes('node_modules/groq')) return 'vendor-ai';

          // ── UI utilities ──
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
          if (id.includes('node_modules/date-fns')) return 'vendor-datefns';

          // ── Everything else in node_modules ──
          if (id.includes('node_modules')) return 'vendor-misc';
        },
      },
    },
  },
});
