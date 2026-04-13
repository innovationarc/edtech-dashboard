import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
          { src: 'icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: 'icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,

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
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // ─────────────────────────────────────────────────────────────────
          // RULE: React + React DOM + scheduler + react-router MUST be in the
          // same chunk. Separating them breaks __SECRET_INTERNALS reference.
          // ─────────────────────────────────────────────────────────────────
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-is/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/react-router/')
          ) return 'vendor-react';

          // ── Tesseract OCR (~4MB) — only used on verify-id page ────────────
          if (id.includes('node_modules/tesseract.js'))
            return 'vendor-tesseract';

          // ── 100ms video SDK (~2MB) — only used on live class pages ────────
          if (id.includes('node_modules/@100mslive'))
            return 'vendor-100ms';

          // ── Firebase — split by sub-package (~300-800KB each) ─────────────
          if (id.includes('node_modules/@firebase/firestore'))  return 'firebase-firestore';
          if (id.includes('node_modules/@firebase/auth'))       return 'firebase-auth';
          if (id.includes('node_modules/@firebase/storage'))    return 'firebase-storage';
          if (id.includes('node_modules/@firebase/analytics'))  return 'firebase-analytics';
          if (id.includes('node_modules/@firebase/functions'))  return 'firebase-functions';
          if (id.includes('node_modules/@firebase/messaging'))  return 'firebase-messaging';
          if (id.includes('node_modules/@firebase') ||
              id.includes('node_modules/firebase'))             return 'firebase-core';

          // ── Gemini AI SDK ─────────────────────────────────────────────────
          if (id.includes('node_modules/@google/generative-ai'))
            return 'vendor-ai';

          // ── Supabase ──────────────────────────────────────────────────────
          if (id.includes('node_modules/@supabase'))
            return 'vendor-supabase';

          // ── HLS video player ──────────────────────────────────────────────
          if (id.includes('node_modules/hls.js'))
            return 'vendor-hls';

          // ── PDF generation ────────────────────────────────────────────────
          if (id.includes('node_modules/jspdf') ||
              id.includes('node_modules/html2canvas'))
            return 'vendor-pdf';

          // ── Charts ────────────────────────────────────────────────────────
          if (id.includes('node_modules/chart.js') ||
              id.includes('node_modules/react-chartjs-2'))
            return 'vendor-chartjs';

          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3') ||
              id.includes('node_modules/d3-'))
            return 'vendor-recharts';

          // ── KaTeX math rendering ──────────────────────────────────────────
          if (id.includes('node_modules/katex') ||
              id.includes('node_modules/react-katex'))
            return 'vendor-katex';

          // ── Lucide icons ──────────────────────────────────────────────────
          if (id.includes('node_modules/lucide-react'))
            return 'vendor-lucide';

          // ── Date utilities ────────────────────────────────────────────────
          if (id.includes('node_modules/date-fns'))
            return 'vendor-datefns';

          // ── Stripe ────────────────────────────────────────────────────────
          if (id.includes('node_modules/@stripe'))
            return 'vendor-stripe';

          // ── Barcode / QR ──────────────────────────────────────────────────
          if (id.includes('node_modules/bwip-js') ||
              id.includes('node_modules/qrcode'))
            return 'vendor-barcode';

          // ── IndexedDB ─────────────────────────────────────────────────────
          if (id.includes('node_modules/dexie'))
            return 'vendor-dexie';

          // ── Framer Motion ─────────────────────────────────────────────────
          if (id.includes('node_modules/framer-motion'))
            return 'vendor-framer';

          // ── Small utils (bundle together, they're tiny) ───────────────────
          if (
            id.includes('node_modules/axios') ||
            id.includes('node_modules/crypto-js') ||
            id.includes('node_modules/uuid') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/react-calendar') ||
            id.includes('node_modules/react-google-recaptcha') ||
            id.includes('node_modules/dompurify') ||
            id.includes('node_modules/DOMPurify')
          ) return 'vendor-utils';

          // ── Everything else in node_modules ───────────────────────────────
          if (id.includes('node_modules'))
            return 'vendor-misc';
        },
      },
    },
  },
});
