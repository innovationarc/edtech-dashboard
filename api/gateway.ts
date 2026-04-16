// api/gateway.ts
// Single entry point for the Pie Academy Android app.
// The APK only knows this one URL — all secrets stay server-side on Vercel.
//
// SECURITY:
//   - Every request must include X-App-Key header matching GATEWAY_APP_KEY env var
//   - Requests without a valid key are rejected with 401
//   - All internal API routes are proxied here — APK never calls them directly
//
// ROUTES (sent via `route` field in request body or query param):
//   user-search        → /api/user-search
//   password-reset     → /api/password-reset
//   create-user        → /api/create-user
//   delete-user        → /api/delete-user
//   generate-id        → /api/generate-id
//   sms                → /api/sms
//   upload             → /api/upload
//   verify-recaptcha   → /api/verify-recaptcha
//   payment            → /api/payment (with ?action= passthrough)
//   video-stream       → /api/videoStream (with ?action= passthrough)
//
// USAGE FROM APP:
//   POST https://your-vercel-url/api/gateway
//   Headers: { "X-App-Key": "<GATEWAY_APP_KEY>", "Content-Type": "application/json" }
//   Body: { "route": "user-search", "payload": { ...original request body } }
//
// For GET-based routes (video-stream, payment callback):
//   GET  https://your-vercel-url/api/gateway?route=video-stream&action=meta&videoId=xxx
//   Headers: { "X-App-Key": "<GATEWAY_APP_KEY>" }

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Config ────────────────────────────────────────────────────────────────────
const GATEWAY_APP_KEY = process.env.GATEWAY_APP_KEY || '';
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.FRONTEND_URL || 'https://edtech-dashboard-alpha.vercel.app';

// Routes that use GET method internally
const GET_ROUTES = new Set(['video-stream', 'payment-callback']);

// Map of route names to internal API paths
const ROUTE_MAP: Record<string, string> = {
  'user-search':      '/api/user-search',
  'password-reset':   '/api/password-reset',
  'create-user':      '/api/create-user',
  'delete-user':      '/api/delete-user',
  'generate-id':      '/api/generate-id',
  'sms':              '/api/sms',
  'upload':           '/api/upload',
  'verify-recaptcha': '/api/verify-recaptcha',
  'payment':          '/api/payment',
  'video-stream':     '/api/videoStream',
};

// ─── CORS ──────────────────────────────────────────────────────────────────────
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key, Authorization');
}

// ─── Auth check ────────────────────────────────────────────────────────────────
function isAuthorized(req: VercelRequest): boolean {
  if (!GATEWAY_APP_KEY) {
    // If no key is configured, allow all (dev mode)
    console.warn('[gateway] GATEWAY_APP_KEY not set — running in open mode');
    return true;
  }
  const key = req.headers['x-app-key'] as string | undefined;
  return key === GATEWAY_APP_KEY;
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Auth check
  if (!isAuthorized(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — invalid or missing X-App-Key header'
    });
  }

  // Determine route
  const route = (
    (req.method === 'GET' ? req.query.route : req.body?.route) as string | undefined
  )?.toLowerCase();

  if (!route) {
    return res.status(400).json({
      success: false,
      error: 'Missing route. Provide "route" in body (POST) or query (GET).',
      availableRoutes: Object.keys(ROUTE_MAP)
    });
  }

  const internalPath = ROUTE_MAP[route];
  if (!internalPath) {
    return res.status(404).json({
      success: false,
      error: `Unknown route: "${route}"`,
      availableRoutes: Object.keys(ROUTE_MAP)
    });
  }

  try {
    // ── Build internal URL ───────────────────────────────────────────────────
    let internalUrl = `${BASE_URL}${internalPath}`;

    // Pass through query params for routes that need them (payment action, video action, etc.)
    const forwardParams = new URLSearchParams();
    for (const [key, val] of Object.entries(req.query)) {
      if (key === 'route') continue; // Don't forward gateway's own route param
      if (val) forwardParams.set(key, Array.isArray(val) ? val[0] : val);
    }
    const qs = forwardParams.toString();
    if (qs) internalUrl += `?${qs}`;

    // ── Determine method ─────────────────────────────────────────────────────
    const isGetRoute = GET_ROUTES.has(route) || req.method === 'GET';
    const method = isGetRoute ? 'GET' : 'POST';

    // ── Build headers ────────────────────────────────────────────────────────
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Forward origin so internal CORS checks pass
      'Origin': BASE_URL,
    };

    // Forward any special headers the internal API needs
    const headersToForward = [
      'x-security-string',
      'x-stream-token',
      'x-chunk-token',
      'x-video-time',
      'x-video-sig',
      'range',
      'authorization',
    ];
    for (const h of headersToForward) {
      const val = req.headers[h];
      if (val) headers[h] = Array.isArray(val) ? val[0] : val;
    }

    // ── Payload ──────────────────────────────────────────────────────────────
    // The app sends: { route: "user-search", payload: { ...actual body } }
    // We forward only the payload to the internal API
    const payload = req.body?.payload ?? req.body ?? {};
    // Remove gateway-specific keys
    const { route: _r, ...cleanPayload } = payload;

    // ── Call internal API ────────────────────────────────────────────────────
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST') {
      fetchOptions.body = JSON.stringify(cleanPayload);
    }

    console.log(`[gateway] ${method} ${route} → ${internalUrl}`);

    const internalRes = await fetch(internalUrl, fetchOptions);

    // ── Stream response back ─────────────────────────────────────────────────
    const contentType = internalRes.headers.get('content-type') || 'application/json';

    // Handle redirects (e.g. payment callback redirects to /course-enrollment)
    if (internalRes.redirected || (internalRes.status >= 300 && internalRes.status < 400)) {
      const location = internalRes.headers.get('location') || internalRes.url;
      return res.status(internalRes.status).setHeader('Location', location).end();
    }

    // Forward status + body
    res.status(internalRes.status);
    res.setHeader('Content-Type', contentType);

    // Forward special response headers (for video streaming)
    const responseHeadersToForward = [
      'content-range',
      'content-length',
      'accept-ranges',
      'x-next-chunk-token',
      'x-chunk-index',
      'x-is-last-chunk',
    ];
    for (const h of responseHeadersToForward) {
      const val = internalRes.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    if (contentType.includes('application/json')) {
      const data = await internalRes.json();
      return res.json(data);
    } else if (contentType.startsWith('video/') || contentType.startsWith('application/octet')) {
      // Stream binary (video chunks)
      const buffer = await internalRes.arrayBuffer();
      return res.end(Buffer.from(buffer));
    } else {
      const text = await internalRes.text();
      return res.send(text);
    }

  } catch (err: any) {
    console.error('[gateway] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Gateway error — internal request failed',
      details: err.message
    });
  }
}
