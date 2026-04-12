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
      registerType: 'prompt', // Show update prompt to user, don't auto-replace
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
          {
            src: 'icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: 'icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: 'icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: 'icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: 'icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
          },
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['education'],
        lang: 'en',
        dir: 'ltr',
      },

      workbox: {
        // Cache name versioning
        cacheId: 'pie-academy-v1',

        // Files to precache (your built app shell)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],

        // Skip waiting — new SW activates after user confirms update prompt
        skipWaiting: false,
        clientsClaim: true,

        // 2.5 MiB — covers index chunk (shared app shell ~2.37 MB)
        maximumFileSizeToCacheInBytes: 2.5 * 1024 * 1024,

        // Runtime caching strategies
        runtimeCaching: [
          // ── Google Fonts ── Cache First
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

          // ── Images (CDN, Bunny, Firebase Storage) ── Cache First
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|avif)(\?.*)?$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Firebase Storage (notes, PDFs, lesson assets) ── Cache First
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Bunny CDN (video thumbnails, assets) ── Cache First
          {
            urlPattern: /^https:\/\/.*\.b-cdn\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bunny-cdn-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Firestore REST API ── Network First with offline fallback
          // (IndexedDB handles actual data caching; this just handles network errors)
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

          // ── Firebase Auth ── Network First
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

          // ── All other API calls ── Network Only (AI, streaming, live)
          // These fall through to network and fail gracefully via OfflineBanner
        ],

        // Offline fallback — serve cached app shell for all navigation
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          // Don't intercept API calls
          /^\/api\//,
          /^\/favicon\.ico/,
        ],
      },

      // Development mode — enable SW in dev for testing
      devOptions: {
        enabled: false, // Set to true when testing SW locally
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

          // ── AI / Gemini SDK ──
          if (id.includes('node_modules/@google')) return 'vendor-ai';

          // ── UI utilities ──
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
          if (id.includes('node_modules/date-fns')) return 'vendor-datefns';

          // ── Math rendering ──
          if (id.includes('node_modules/katex') || id.includes('node_modules/react-katex')) return 'vendor-katex';

          // ── Sanitization ──
          if (id.includes('node_modules/dompurify') || id.includes('node_modules/DOMPurify')) return 'vendor-dompurify';

          // ── HTTP ──
          if (id.includes('node_modules/axios')) return 'vendor-http';

          // ── 100ms video SDK (very heavy) ──
          if (id.includes('node_modules/@100mslive')) return 'vendor-100ms';

          // ── Tesseract OCR (very heavy) ──
          if (id.includes('node_modules/tesseract.js')) return 'vendor-tesseract';

          // ── Supabase ──
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';

          // ── PDF generation ──
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'vendor-pdf';

          // ── Video streaming ──
          if (id.includes('node_modules/hls.js')) return 'vendor-hls';

          // ── Charts ──
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) return 'vendor-charts';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3') || id.includes('node_modules/d3-')) return 'vendor-d3';

          // ── Stripe ──
          if (id.includes('node_modules/@stripe')) return 'vendor-stripe';

          // ── Barcode / QR ──
          if (id.includes('node_modules/bwip-js') || id.includes('node_modules/qrcode')) return 'vendor-barcode';

          // ── Crypto ──
          if (id.includes('node_modules/crypto-js')) return 'vendor-crypto';

          // ── Misc UI components ──
          if (id.includes('node_modules/react-calendar')) return 'vendor-calendar';
          if (id.includes('node_modules/react-google-recaptcha')) return 'vendor-recaptcha';

          // ── Storage / DB ──
          if (id.includes('node_modules/dexie')) return 'vendor-dexie';

          // ── UUID / clsx / small utils ──
          if (id.includes('node_modules/uuid') || id.includes('node_modules/clsx')) return 'vendor-utils';

          // ── Everything else in node_modules ──
          if (id.includes('node_modules')) return 'vendor-misc';
        },
      },
    },
  },
});
