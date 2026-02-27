// public/video-sw.js — Video Stream Protection Service Worker v1
//
// WHY THIS STOPS IDM:
//   The <video> element makes Range requests from inside the page context.
//   Those go through this SW which adds HMAC signature headers.
//   IDM is a separate process — its requests bypass this SW entirely.
//   No signature → server returns 403.
//
// FLOW:
//   1. Page registers this SW on mount (navigator.serviceWorker.register)
//   2. After /meta call, page posts { type:'VSW_INIT', secret, videoId }
//   3. video.src is set → Range requests fly through SW → signed → server validates

'use strict';

let _secret  = null;
let _videoId = null;

self.addEventListener('install',  ()  => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'VSW_INIT') {
    _secret  = event.data.secret  || null;
    _videoId = event.data.videoId || null;
  }
  if (event.data?.type === 'VSW_CLEAR') {
    _secret = null; _videoId = null;
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.pathname !== '/api/videoStream') return;
  if (url.searchParams.get('action') !== 'play') return;

  if (!_secret || !_videoId) {
    event.respondWith(new Response('SW not initialised', { status: 503 }));
    return;
  }
  event.respondWith(signAndFetch(req));
});

async function signAndFetch(request) {
  const timestamp = Date.now();
  const range     = request.headers.get('Range') || '';
  const message   = `${timestamp}:${range}:${_videoId}`;
  let sigHex;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(_secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const raw = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    sigHex = Array.from(new Uint8Array(raw))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('[video-sw] crypto error:', err);
    return new Response('SW crypto error', { status: 503 });
  }
  const headers = new Headers(request.headers);
  headers.set('X-Video-Time', String(timestamp));
  headers.set('X-Video-Sig',  sigHex);
  return fetch(new Request(request.url, {
    method: 'GET', headers,
    credentials: 'same-origin',
    mode: 'same-origin',
    cache: 'no-store',
  }));
}
