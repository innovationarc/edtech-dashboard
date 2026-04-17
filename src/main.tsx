import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// ── Bundled fonts — fully offline, no external requests ──
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import '@fontsource/outfit/900.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';

import './index.css';
import 'katex/dist/katex.min.css';

// ── APK DEBUG OVERLAY — remove before production release ──
// Catches every possible failure type and renders it on screen.
// Web preview is unaffected (errors still show, but web works fine anyway).
(() => {
  const logs: string[] = [];
  const MAX = 60;

  const ts = () => new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm

  const render = () => {
    const el = document.getElementById('__apk_debug__');
    if (el) el.innerText = logs.slice(-MAX).join('\n');
  };

  const push = (line: string) => {
    logs.push(line);
    render();
  };

  // ── Create overlay (always visible, behind app content) ──
  const overlay = document.createElement('pre');
  overlay.id = '__apk_debug__';
  overlay.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
    'z-index:99999', 'margin:0', 'padding:16px',
    'background:#0a0a14', 'color:#e0e0e0',
    'font-size:10px', 'line-height:1.5',
    'white-space:pre-wrap', 'word-break:break-all',
    'overflow-y:auto', 'font-family:monospace',
    'pointer-events:none',   // lets touches pass through to app once it renders
  ].join(';');
  document.body.appendChild(overlay);

  push(`[${ts()}] 🚀 main.tsx executing`);
  push(`[${ts()}] UA: ${navigator.userAgent.slice(0, 80)}`);
  push(`[${ts()}] origin: ${location.origin}  protocol: ${location.protocol}`);
  push(`[${ts()}] hash: ${location.hash || '(none)'}`);

  // ── JS runtime errors ──
  window.addEventListener('error', (e) => {
    push(`[${ts()}] ❌ ERROR: ${e.message}`);
    push(`         at ${e.filename}:${e.lineno}:${e.colno}`);
    if (e.error?.stack) push(`         ${e.error.stack.split('\n').slice(1, 4).join(' | ')}`);
  });

  // ── Unhandled promise rejections ──
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    push(`[${ts()}] ❌ REJECTION: ${reason?.message ?? reason}`);
    if (reason?.stack) push(`         ${reason.stack.split('\n').slice(1, 3).join(' | ')}`);
  });

  // ── Resource load failures (scripts, stylesheets, images) ──
  window.addEventListener('error', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && t !== window && 'src' in t) {
      push(`[${ts()}] ❌ RESOURCE FAIL: <${t.tagName}> src=${( t as HTMLScriptElement).src || (t as HTMLImageElement).src}`);
    }
  }, true /* capture phase — required for resource errors */);

  // ── Console override — capture warn/error/log ──
  const _log  = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _err  = console.error.bind(console);

  const fmt = (args: unknown[]) =>
    args.map(a => (typeof a === 'object' ? JSON.stringify(a)?.slice(0, 200) : String(a))).join(' ');

  console.log   = (...a) => { push(`[${ts()}] 📋 LOG:  ${fmt(a)}`);  _log(...a);  };
  console.warn  = (...a) => { push(`[${ts()}] ⚠️  WARN: ${fmt(a)}`);  _warn(...a); };
  console.error = (...a) => { push(`[${ts()}] 🔴 ERR:  ${fmt(a)}`);  _err(...a);  };

  // ── Network — fetch monkey-patch ──
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    push(`[${ts()}] 🌐 FETCH → ${url.slice(0, 80)}`);
    try {
      const res = await _fetch(input, init);
      push(`[${ts()}] ${res.ok ? '✅' : '⚠️ '} FETCH ← ${res.status} ${url.slice(0, 60)}`);
      return res;
    } catch (err: unknown) {
      push(`[${ts()}] ❌ FETCH FAIL: ${(err as Error)?.message} — ${url.slice(0, 60)}`);
      throw err;
    }
  };

  // ── Firebase Auth state changes ──
  // (fires before React even mounts if Firebase SDK initialises early)
  window.addEventListener('app-auth-success', () => push(`[${ts()}] 🔑 app-auth-success fired`));
  window.addEventListener('app-auth-signout', () => push(`[${ts()}] 🔒 app-auth-signout fired`));

  // ── Capacitor lifecycle ──
  window.addEventListener('pagehide',          () => push(`[${ts()}] 📄 pagehide`));
  window.addEventListener('visibilitychange',  () => push(`[${ts()}] 👁  visibility → ${document.visibilityState}`));
  window.addEventListener('online',            () => push(`[${ts()}] 📶 ONLINE`));
  window.addEventListener('offline',           () => push(`[${ts()}] 📵 OFFLINE`));

  // ── DOM ready checkpoints ──
  push(`[${ts()}] 📌 readyState: ${document.readyState}`);
  document.addEventListener('DOMContentLoaded', () => push(`[${ts()}] ✅ DOMContentLoaded`));
  window.addEventListener('load',              () => push(`[${ts()}] ✅ window.load`));

  // ── React root mount detection ──
  const _origCreateRoot = (window as any).__reactCreateRoot;
  // Fallback: just observe #root for children
  const observer = new MutationObserver(() => {
    const root = document.getElementById('root');
    if (root && root.childElementCount > 0) {
      push(`[${ts()}] ✅ React mounted — #root has children`);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ── Timeout watchdogs ──
  setTimeout(() => {
    const root = document.getElementById('root');
    const hasChildren = root && root.childElementCount > 0;
    push(`[${ts()}] ⏱ 3s watchdog — #root children: ${hasChildren ? 'YES ✅' : 'NO ❌'}`);
  }, 3000);

  setTimeout(() => {
    const root = document.getElementById('root');
    const hasChildren = root && root.childElementCount > 0;
    push(`[${ts()}] ⏱ 8s watchdog — #root children: ${hasChildren ? 'YES ✅' : 'NO ❌'}`);
    if (!hasChildren) push(`[${ts()}] ☠️  App never rendered after 8s — check errors above`);
  }, 8000);

  // Expose log dump to console for adb logcat users
  (window as any).__dumpDebugLog = () => logs.join('\n');
})();
// ── END APK DEBUG OVERLAY ──

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
