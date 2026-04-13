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
        // Must be high enough to cover largest individual chunk after splitting
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

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
    chunkSizeWarningLimit: 2000,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── RULE: Only split packages that have NO React hook usage ────────
          // Any package using useState/useEffect/useLayoutEffect etc must NOT
          // be separated from React. Those are left undefined (Vite handles them).
          // The catch-all vendor-misc caused crashes — it is intentionally removed.

          // ── React ecosystem — all in ONE chunk, non-negotiable ─────────────
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-is/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/react-router/')
          ) return 'vendor-react';

          // ── Pure JS — no React hooks, safe to isolate ─────────────────────

          // Firebase (pure JS, no hooks)
          if (id.includes('node_modules/@firebase/firestore'))  return 'firebase-firestore';
          if (id.includes('node_modules/@firebase/auth'))       return 'firebase-auth';
          if (id.includes('node_modules/@firebase/storage'))    return 'firebase-storage';
          if (id.includes('node_modules/@firebase/analytics'))  return 'firebase-analytics';
          if (id.includes('node_modules/@firebase/functions'))  return 'firebase-functions';
          if (id.includes('node_modules/@firebase/messaging'))  return 'firebase-messaging';
          if (
            id.includes('node_modules/@firebase') ||
            id.includes('node_modules/firebase')
          ) return 'firebase-core';

          // Tesseract OCR (pure JS, ~4MB, lazy loaded)
          if (id.includes('node_modules/tesseract.js'))         return 'vendor-tesseract';

          // HLS video (pure JS)
          if (id.includes('node_modules/hls.js'))               return 'vendor-hls';

          // Gemini AI (pure JS)
          if (id.includes('node_modules/@google/generative-ai')) return 'vendor-ai';

          // date-fns (pure JS)
          if (id.includes('node_modules/date-fns'))             return 'vendor-datefns';

          // KaTeX core (pure JS) — react-katex uses hooks so leave it out
          if (id.includes('node_modules/katex/'))               return 'vendor-katex';

          // crypto-js (pure JS)
          if (id.includes('node_modules/crypto-js'))            return 'vendor-crypto';

          // axios (pure JS)
          if (id.includes('node_modules/axios'))                return 'vendor-http';

          // dexie (pure JS)
          if (id.includes('node_modules/dexie'))                return 'vendor-dexie';

          // Supabase (pure JS)
          if (id.includes('node_modules/@supabase'))            return 'vendor-supabase';

          // Stripe (pure JS)
          if (id.includes('node_modules/@stripe'))              return 'vendor-stripe';

          // Barcode/QR (pure JS)
          if (
            id.includes('node_modules/bwip-js') ||
            id.includes('node_modules/qrcode')
          ) return 'vendor-barcode';

          // uuid + clsx (pure JS, tiny)
          if (
            id.includes('node_modules/uuid') ||
            id.includes('node_modules/clsx')
          ) return 'vendor-utils';

          // ── React-dependent packages — DO NOT isolate, let Vite co-locate ──
          // These use React hooks internally and must share React's instance:
          // @100mslive, recharts, d3, chart.js, react-chartjs-2, framer-motion,
          // lucide-react, react-calendar, react-google-recaptcha, react-katex,
          // html2canvas, jspdf, dompurify
          // → returning undefined lets Vite decide where to put them (safe)
        },
      },
    },
  },
});
