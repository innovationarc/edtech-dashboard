// ============================================================
// CourseEnrollment.tsx  — PART 1 of 3
// Paste parts 1→2→3 back-to-back into a single file.
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import courseEnrollmentService, {
  Course,
  Enrollment,
  EnrollmentCalculation,
  AppliedCoupon,
} from '../services/courseEnrollmentService';

// ─── Global CSS injected once ────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

:root {
  --ce-bg:        #0d0f14;
  --ce-surface:   #141720;
  --ce-surface2:  #1c2030;
  --ce-surface3:  #232840;
  --ce-border:    rgba(255,255,255,0.07);
  --ce-border2:   rgba(255,255,255,0.12);
  --ce-text:      #e8eaf0;
  --ce-text2:     #9399b2;
  --ce-text3:     #5c6285;
  --ce-accent:    #5b6ef5;
  --ce-accent2:   #7c8fff;
  --ce-teal:      #20c997;
  --ce-teal2:     #12a57c;
  --ce-rose:      #f05e7e;
  --ce-gold:      #f5a623;
  --ce-radius:    14px;
  --ce-shadow:    0 4px 24px rgba(0,0,0,0.4);
  --ce-shadow2:   0 2px 12px rgba(0,0,0,0.3);
  --font-body:    'Plus Jakarta Sans', sans-serif;
  --font-head:    'Space Grotesk', sans-serif;
}

/* ── Base ─────────────────────────────────────────────────── */
.ce-wrap { font-family: var(--font-body); color: var(--ce-text); min-height:100vh; background:var(--ce-bg); padding-bottom:80px; }

/* ── Summary pills ───────────────────────────────────────── */
.ce-summary { display:flex; gap:10px; flex-wrap:nowrap; padding:20px 16px 0; overflow-x:auto; scrollbar-width:none; }
.ce-summary::-webkit-scrollbar { display:none; }
.ce-pill {
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 14px; border-radius:999px; font-size:13px; font-weight:600;
  white-space:nowrap; cursor:pointer; transition:all .18s ease;
  border:1.5px solid var(--ce-border2);
  background:var(--ce-surface); color:var(--ce-text2);
  flex-shrink:0;
}
.ce-pill svg { width:14px; height:14px; flex-shrink:0; }
.ce-pill.active { background:var(--ce-accent); border-color:var(--ce-accent); color:#fff; }
.ce-pill.saved.active { background:var(--ce-rose); border-color:var(--ce-rose); color:#fff; }
.ce-pill-count {
  background:rgba(255,255,255,0.15); color:inherit;
  border-radius:999px; padding:1px 7px; font-size:11px; font-weight:700;
}

/* ── Tabs ─────────────────────────────────────────────────── */
.ce-tabs { display:flex; gap:0; border-bottom:1.5px solid var(--ce-border); margin:18px 16px 0; }
.ce-tab {
  display:inline-flex; align-items:center; gap:7px;
  padding:10px 16px; font-size:14px; font-weight:600;
  cursor:pointer; border:none; background:none;
  color:var(--ce-text3); position:relative; transition:color .18s;
  font-family:var(--font-body);
}
.ce-tab svg { width:15px; height:15px; }
.ce-tab .ce-tab-badge {
  background:var(--ce-surface3); color:var(--ce-text2);
  border-radius:999px; padding:1px 7px; font-size:11px; font-weight:700;
  transition:all .18s;
}
.ce-tab.active { color:var(--ce-accent); }
.ce-tab.active .ce-tab-badge { background:var(--ce-accent); color:#fff; }
.ce-tab.active::after {
  content:''; position:absolute; bottom:-1.5px; left:0; right:0;
  height:2.5px; background:var(--ce-accent); border-radius:2px;
}

/* ── Toolbar (view toggle + filter trigger) ──────────────── */
.ce-toolbar { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 0; gap:10px; }
.ce-search-row { display:flex; align-items:center; gap:8px; flex:1; }
.ce-search-box {
  flex:1; display:flex; align-items:center; gap:8px;
  background:var(--ce-surface); border:1.5px solid var(--ce-border2);
  border-radius:10px; padding:9px 14px;
}
.ce-search-box input {
  background:none; border:none; outline:none;
  color:var(--ce-text); font-size:14px; font-family:var(--font-body); width:100%;
}
.ce-search-box input::placeholder { color:var(--ce-text3); }
.ce-search-box svg { width:15px; height:15px; color:var(--ce-text3); flex-shrink:0; }
.ce-filter-btn {
  width:40px; height:40px; border-radius:10px; border:1.5px solid var(--ce-border2);
  background:var(--ce-surface); display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all .18s; flex-shrink:0;
  color:var(--ce-text2);
}
.ce-filter-btn.active { background:var(--ce-accent); border-color:var(--ce-accent); color:#fff; }
.ce-filter-btn svg { width:16px; height:16px; }
.ce-view-toggle { display:flex; background:var(--ce-surface); border-radius:10px; border:1.5px solid var(--ce-border); overflow:hidden; flex-shrink:0; }
.ce-view-btn {
  padding:8px 12px; border:none; background:none; cursor:pointer;
  color:var(--ce-text3); transition:all .18s; display:flex; align-items:center; justify-content:center;
}
.ce-view-btn svg { width:16px; height:16px; }
.ce-view-btn.active { background:var(--ce-accent); color:#fff; }

/* ── Filter panel ─────────────────────────────────────────── */
.ce-filters {
  margin:10px 16px 0; overflow:hidden;
  transition:max-height .28s ease, opacity .22s ease;
}
.ce-filters.open { max-height:600px; opacity:1; }
.ce-filters.closed { max-height:0; opacity:0; }
.ce-filters-inner {
  background:var(--ce-surface); border:1.5px solid var(--ce-border2);
  border-radius:var(--ce-radius); padding:14px; display:flex; flex-direction:column; gap:8px;
}
/* always-visible on desktop */
@media(min-width:768px){
  .ce-filters { max-height:none !important; opacity:1 !important; margin-top:12px; }
  .ce-filter-btn { display:none !important; }
}

/* ── Custom Dropdown ──────────────────────────────────────── */
.ce-select-wrap { position:relative; }
.ce-select-trigger {
  width:100%; display:flex; align-items:center; justify-content:space-between;
  padding:10px 14px; border-radius:10px; border:1.5px solid var(--ce-border2);
  background:var(--ce-surface2); cursor:pointer; transition:border-color .18s;
  font-size:13.5px; font-family:var(--font-body); color:var(--ce-text);
}
.ce-select-trigger:hover { border-color:var(--ce-accent); }
.ce-select-trigger svg { width:14px; height:14px; color:var(--ce-text3); transition:transform .18s; flex-shrink:0; }
.ce-select-trigger.open svg { transform:rotate(180deg); }
.ce-select-menu {
  position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:200;
  background:var(--ce-surface2); border:1.5px solid var(--ce-border2);
  border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,0.5);
  overflow:hidden; max-height:260px; overflow-y:auto;
}
.ce-select-menu::-webkit-scrollbar { width:4px; }
.ce-select-menu::-webkit-scrollbar-thumb { background:var(--ce-border2); border-radius:4px; }
.ce-select-option {
  padding:11px 16px; font-size:13.5px; font-family:var(--font-body);
  cursor:pointer; transition:background .14s; color:var(--ce-text);
  display:flex; align-items:center; justify-content:space-between;
}
.ce-select-option:hover { background:var(--ce-surface3); }
.ce-select-option.selected { color:var(--ce-accent); background:rgba(91,110,245,0.1); }
.ce-select-option + .ce-select-option { border-top:1px solid var(--ce-border); }

/* ── Saved strip ─────────────────────────────────────────── */
.ce-saved-strip {
  margin:10px 16px 0; padding:10px 14px;
  background:rgba(240,94,126,0.1); border:1.5px solid rgba(240,94,126,0.25);
  border-radius:10px; display:flex; align-items:center; justify-content:space-between;
  font-size:13px; color:var(--ce-rose); font-weight:500;
}
.ce-saved-strip button { background:none; border:none; color:var(--ce-rose); font-size:12px; cursor:pointer; font-weight:600; opacity:.8; }
.ce-saved-strip button:hover { opacity:1; }

/* ── Course grid / list ───────────────────────────────────── */
.ce-courses { padding:14px 16px 0; }
.ce-grid { display:grid; gap:16px; grid-template-columns:1fr; }
@media(min-width:480px){ .ce-grid { grid-template-columns:repeat(2,1fr); } }
@media(min-width:900px){ .ce-grid { grid-template-columns:repeat(3,1fr); } }
@media(min-width:1280px){ .ce-grid { grid-template-columns:repeat(4,1fr); } }

.ce-list-view { display:flex; flex-direction:column; gap:12px; }

/* ── CARD (grid) ─────────────────────────────────────────── */
.ce-card {
  background:var(--ce-surface); border:1.5px solid var(--ce-border);
  border-radius:var(--ce-radius); overflow:hidden;
  transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  display:flex; flex-direction:column;
}
.ce-card:hover { transform:translateY(-3px); box-shadow:var(--ce-shadow); border-color:var(--ce-border2); }

.ce-card-thumb {
  position:relative; width:100%; padding-top:52%;
  background:var(--ce-surface2); overflow:hidden;
}
.ce-card-thumb img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.ce-card-thumb-placeholder {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
}
.ce-card-thumb-placeholder svg { width:36px; height:36px; color:var(--ce-text3); opacity:.35; }
.ce-card-level {
  position:absolute; bottom:10px; left:10px; padding:3px 10px; border-radius:999px;
  font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase;
}
.lvl-beginner   { background:rgba(32,201,151,.18); color:#20c997; border:1px solid rgba(32,201,151,.3); }
.lvl-intermediate { background:rgba(91,110,245,.18); color:#7c8fff; border:1px solid rgba(91,110,245,.3); }
.lvl-advanced   { background:rgba(240,94,126,.18); color:#f05e7e; border:1px solid rgba(240,94,126,.3); }
.lvl-unspecified { background:rgba(147,153,178,.12); color:#9399b2; border:1px solid rgba(147,153,178,.2); }

.ce-save-btn {
  position:absolute; top:10px; right:10px;
  width:34px; height:34px; border-radius:999px; border:none;
  background:rgba(13,15,20,0.7); backdrop-filter:blur(8px);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all .18s; color:var(--ce-text2);
}
.ce-save-btn:hover { background:rgba(13,15,20,0.9); }
.ce-save-btn.saved { background:var(--ce-rose); color:#fff; }
.ce-save-btn svg { width:15px; height:15px; }

.ce-card-body { padding:14px; flex:1; display:flex; flex-direction:column; gap:6px; }
.ce-card-meta { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--ce-text3); }
.ce-card-meta-dot { width:3px; height:3px; border-radius:50%; background:var(--ce-text3); flex-shrink:0; }
.ce-card-title { font-family:var(--font-head); font-size:15px; font-weight:600; color:var(--ce-text); line-height:1.35; }
.ce-card-sub { font-size:12px; color:var(--ce-text3); }
.ce-card-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:2px; }
.ce-chip {
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 9px; border-radius:6px; font-size:11px; font-weight:500;
  background:rgba(91,110,245,.12); color:var(--ce-accent2); border:1px solid rgba(91,110,245,.2);
}
.ce-chip svg { width:10px; height:10px; }
.ce-card-price { display:flex; align-items:center; gap:8px; margin-top:4px; }
.ce-price-now { font-family:var(--font-head); font-size:17px; font-weight:700; color:var(--ce-teal); }
.ce-price-free { font-family:var(--font-head); font-size:17px; font-weight:700; color:var(--ce-teal); }
.ce-price-orig { font-size:13px; color:var(--ce-text3); text-decoration:line-through; }
.ce-price-disc-badge {
  font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
  background:rgba(245,166,35,.15); color:var(--ce-gold); border:1px solid rgba(245,166,35,.25);
}

.ce-card-actions { display:flex; gap:8px; padding:10px 14px 14px; }
.ce-btn-overview {
  flex:1; padding:9px; border-radius:9px; border:1.5px solid var(--ce-border2);
  background:none; color:var(--ce-text2); font-size:13px; font-weight:600;
  cursor:pointer; transition:all .18s; display:flex; align-items:center; justify-content:center; gap:6px;
  font-family:var(--font-body);
}
.ce-btn-overview:hover { background:var(--ce-surface2); color:var(--ce-text); border-color:var(--ce-border2); }
.ce-btn-overview svg { width:14px; height:14px; }
.ce-btn-enroll {
  flex:2; padding:9px 16px; border-radius:9px; border:none;
  background:var(--ce-teal); color:#fff; font-size:13px; font-weight:700;
  cursor:pointer; transition:all .18s; display:flex; align-items:center; justify-content:center; gap:6px;
  font-family:var(--font-body);
}
.ce-btn-enroll:hover { background:var(--ce-teal2); }
.ce-btn-enroll svg { width:14px; height:14px; }
.ce-btn-continue {
  flex:1; padding:9px 16px; border-radius:9px; border:none;
  background:var(--ce-accent); color:#fff; font-size:13px; font-weight:700;
  cursor:pointer; transition:all .18s; display:flex; align-items:center; justify-content:center; gap:6px;
  font-family:var(--font-body);
}
.ce-btn-continue:hover { background:var(--ce-accent2); }

/* ── LIST ROW ─────────────────────────────────────────────── */
.ce-list-row {
  background:var(--ce-surface); border:1.5px solid var(--ce-border);
  border-radius:var(--ce-radius); overflow:hidden;
  display:flex; gap:0; transition:border-color .18s;
}
.ce-list-row:hover { border-color:var(--ce-border2); }
.ce-list-thumb {
  width:120px; min-width:120px; background:var(--ce-surface2);
  position:relative; display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
@media(min-width:600px){ .ce-list-thumb { width:160px; min-width:160px; } }
.ce-list-thumb img { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; }
.ce-list-thumb svg { width:28px; height:28px; color:var(--ce-text3); opacity:.35; }
.ce-list-body { flex:1; padding:14px; display:flex; flex-direction:column; gap:6px; min-width:0; }
.ce-list-title { font-family:var(--font-head); font-size:15px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ce-list-sub { font-size:12px; color:var(--ce-text3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ce-list-row-actions { display:flex; align-items:center; gap:8px; padding:14px 14px 14px 0; flex-shrink:0; flex-direction:column; justify-content:center; }
@media(max-width:500px){
  .ce-list-row { flex-direction:column; }
  .ce-list-thumb { width:100%; min-width:unset; height:160px; }
  .ce-list-row-actions { flex-direction:row; padding:0 14px 14px; }
}

/* ── Progress bar (enrolled) ─────────────────────────────── */
.ce-progress-wrap { margin-top:4px; }
.ce-progress-bar { height:4px; background:var(--ce-surface3); border-radius:4px; overflow:hidden; }
.ce-progress-fill { height:100%; background:var(--ce-teal); border-radius:4px; transition:width .3s; }
.ce-progress-label { font-size:11px; color:var(--ce-text3); margin-top:3px; }

/* ── Empty state ─────────────────────────────────────────── */
.ce-empty { text-align:center; padding:60px 20px; color:var(--ce-text3); }
.ce-empty svg { width:48px; height:48px; margin:0 auto 16px; opacity:.3; }
.ce-empty-title { font-family:var(--font-head); font-size:18px; font-weight:600; color:var(--ce-text2); margin-bottom:6px; }
.ce-empty-sub { font-size:14px; }

/* ── Status banner ───────────────────────────────────────── */
.ce-banner {
  margin:16px 16px 0; padding:14px 16px; border-radius:var(--ce-radius);
  font-size:14px; font-weight:500; display:flex; align-items:flex-start; gap:10px;
}
.ce-banner svg { width:18px; height:18px; flex-shrink:0; margin-top:1px; }
.ce-banner.success { background:rgba(32,201,151,.1); border:1.5px solid rgba(32,201,151,.25); color:#20c997; }
.ce-banner.error   { background:rgba(240,94,126,.1); border:1.5px solid rgba(240,94,126,.25); color:var(--ce-rose); }
.ce-banner.warning { background:rgba(245,166,35,.1); border:1.5px solid rgba(245,166,35,.25); color:var(--ce-gold); }
.ce-banner.info    { background:rgba(91,110,245,.1); border:1.5px solid rgba(91,110,245,.25); color:var(--ce-accent2); }

/* ── Loading skeleton ─────────────────────────────────────── */
.ce-skeleton-grid { display:grid; gap:16px; grid-template-columns:1fr; padding:14px 16px 0; }
@media(min-width:480px){ .ce-skeleton-grid { grid-template-columns:repeat(2,1fr); } }
@media(min-width:900px){ .ce-skeleton-grid { grid-template-columns:repeat(3,1fr); } }
.ce-skeleton { background:var(--ce-surface); border-radius:var(--ce-radius); overflow:hidden; }
.ce-skeleton-thumb { height:160px; background:var(--ce-surface2); animation:ce-shimmer 1.6s ease-in-out infinite; }
.ce-skeleton-body { padding:14px; display:flex; flex-direction:column; gap:8px; }
.ce-skeleton-line { height:12px; border-radius:6px; background:var(--ce-surface2); animation:ce-shimmer 1.6s ease-in-out infinite; }
@keyframes ce-shimmer {
  0%,100% { opacity:.6; } 50% { opacity:.3; }
}

/* ── OVERVIEW MODAL ───────────────────────────────────────── */
.ce-overlay {
  position:fixed; inset:0; z-index:1000;
  background:rgba(0,0,0,0.65); backdrop-filter:blur(4px);
  display:flex; align-items:flex-start; justify-content:center;
  padding-top:max(env(safe-area-inset-top,0px) + 70px, 76px);
  overflow-y:auto;
}
.ce-modal {
  width:100%; max-width:640px; margin:0 16px 40px;
  background:var(--ce-surface); border:1.5px solid var(--ce-border2);
  border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,0.6);
  display:flex; flex-direction:column;
}
.ce-modal-header {
  padding:20px 20px 0; display:flex; align-items:flex-start; justify-content:space-between;
  border-bottom:1px solid var(--ce-border); padding-bottom:16px;
}
.ce-modal-header-text { flex:1; min-width:0; }
.ce-modal-label { font-size:10px; font-weight:700; letter-spacing:1.5px; color:var(--ce-accent); text-transform:uppercase; margin-bottom:4px; }
.ce-modal-title { font-family:var(--font-head); font-size:20px; font-weight:700; color:var(--ce-text); line-height:1.2; }
.ce-modal-by { font-size:13px; color:var(--ce-text3); margin-top:4px; }
.ce-modal-close {
  width:36px; height:36px; border-radius:9px; border:1.5px solid var(--ce-border2);
  background:var(--ce-surface2); cursor:pointer; display:flex; align-items:center; justify-content:center;
  color:var(--ce-text2); flex-shrink:0; margin-left:12px; transition:all .18s;
}
.ce-modal-close:hover { background:var(--ce-surface3); color:var(--ce-text); }
.ce-modal-close svg { width:16px; height:16px; }
.ce-modal-body { padding:16px 20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; }
.ce-modal-footer { padding:16px 20px 20px; border-top:1px solid var(--ce-border); }
.ce-modal-cta {
  width:100%; padding:14px; border-radius:12px; border:none;
  background:var(--ce-teal); color:#fff; font-size:15px; font-weight:700;
  cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
  font-family:var(--font-body); transition:background .18s;
}
.ce-modal-cta:hover { background:var(--ce-teal2); }
.ce-modal-cta svg { width:16px; height:16px; }

/* ── Overview sections ───────────────────────────────────── */
.ce-ov-meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.ce-ov-meta-card {
  background:var(--ce-surface2); border:1px solid var(--ce-border);
  border-radius:10px; padding:12px 14px;
}
.ce-ov-meta-label { font-size:10px; font-weight:700; letter-spacing:1px; color:var(--ce-text3); text-transform:uppercase; margin-bottom:5px; }
.ce-ov-meta-value { font-size:14px; font-weight:600; color:var(--ce-text); }

.ce-ov-section { background:var(--ce-surface2); border:1px solid var(--ce-border); border-radius:10px; padding:14px; }
.ce-ov-section-title { font-size:10px; font-weight:700; letter-spacing:1px; color:var(--ce-text3); text-transform:uppercase; margin-bottom:10px; }
.ce-ov-chip-list { display:flex; flex-wrap:wrap; gap:6px; }
.ce-ov-chip {
  padding:4px 10px; border-radius:7px; font-size:12px; font-weight:500;
  background:rgba(91,110,245,.1); color:var(--ce-accent2); border:1px solid rgba(91,110,245,.2);
}
.ce-ov-list { display:flex; flex-direction:column; gap:6px; list-style:none; padding:0; margin:0; }
.ce-ov-list li { display:flex; gap:8px; font-size:13px; color:var(--ce-text2); }
.ce-ov-list li::before { content:''; width:6px; height:6px; border-radius:50%; background:var(--ce-teal); flex-shrink:0; margin-top:6px; }

/* ── Price breakdown box ─────────────────────────────────── */
.ce-price-box { background:var(--ce-surface2); border:1px solid var(--ce-border); border-radius:10px; padding:14px; }
.ce-price-row { display:flex; align-items:center; justify-content:space-between; }
.ce-price-row + .ce-price-row { margin-top:8px; padding-top:8px; border-top:1px solid var(--ce-border); }
.ce-price-row-label { font-size:13px; color:var(--ce-text2); display:flex; align-items:center; gap:7px; }
.ce-price-row-label svg { width:14px; height:14px; flex-shrink:0; }
.ce-price-row-val { font-size:14px; font-weight:600; }
.ce-price-row-val.disc { color:#4caf7d; }
.ce-price-row-val.base { color:var(--ce-text); }
.ce-price-row-val.final { font-size:18px; font-weight:700; color:var(--ce-teal); }
.ce-badge-inline {
  font-size:10px; font-weight:700; padding:2px 8px; border-radius:5px;
  background:rgba(91,110,245,.15); color:var(--ce-accent2); border:1px solid rgba(91,110,245,.2);
}

/* ── Validity block ──────────────────────────────────────── */
.ce-validity-block {
  display:flex; align-items:center; gap:10px; padding:12px 14px;
  background:rgba(91,110,245,.07); border:1px solid rgba(91,110,245,.18); border-radius:10px;
  font-size:13px; color:var(--ce-text2);
}
.ce-validity-block svg { width:16px; height:16px; color:var(--ce-accent); flex-shrink:0; }
.ce-validity-block strong { color:var(--ce-text); }

/* ── ENROLLMENT MODAL ─────────────────────────────────────── */
.ce-enroll-overlay {
  position:fixed; inset:0; z-index:1100;
  background:rgba(0,0,0,0.7); backdrop-filter:blur(6px);
  display:flex; align-items:flex-end; justify-content:center;
  padding-top:max(env(safe-area-inset-top,0px) + 70px, 76px);
}
@media(min-width:640px){
  .ce-enroll-overlay { align-items:center; }
}
.ce-enroll-modal {
  width:100%; max-width:480px; margin:0;
  background:var(--ce-surface); border-radius:20px 20px 0 0;
  box-shadow:0 -20px 60px rgba(0,0,0,0.5);
  display:flex; flex-direction:column; max-height:90vh; overflow:hidden;
}
@media(min-width:640px){
  .ce-enroll-modal { border-radius:18px; margin:16px; max-height:85vh; }
}
.ce-enroll-header { padding:20px 20px 16px; border-bottom:1px solid var(--ce-border); }
.ce-enroll-title { font-family:var(--font-head); font-size:17px; font-weight:700; color:var(--ce-text); margin-bottom:2px; }
.ce-enroll-sub { font-size:13px; color:var(--ce-text3); }
.ce-enroll-body { padding:16px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; flex:1; }
.ce-enroll-footer { padding:14px 20px 20px; border-top:1px solid var(--ce-border); }

.ce-coupon-wrap { display:flex; gap:8px; }
.ce-coupon-input {
  flex:1; padding:10px 14px; border-radius:10px; border:1.5px solid var(--ce-border2);
  background:var(--ce-surface2); color:var(--ce-text); font-size:13px;
  font-family:var(--font-body); outline:none; transition:border-color .18s;
}
.ce-coupon-input:focus { border-color:var(--ce-accent); }
.ce-coupon-input::placeholder { color:var(--ce-text3); }
.ce-coupon-btn {
  padding:10px 16px; border-radius:10px; border:none;
  background:var(--ce-accent); color:#fff; font-size:13px; font-weight:600;
  cursor:pointer; transition:background .18s; white-space:nowrap; font-family:var(--font-body);
}
.ce-coupon-btn:hover { background:var(--ce-accent2); }
.ce-coupon-btn:disabled { opacity:.5; cursor:not-allowed; }
.ce-applied-coupons { display:flex; flex-direction:column; gap:6px; }
.ce-applied-coupon {
  display:flex; align-items:center; justify-content:space-between;
  padding:8px 12px; background:rgba(32,201,151,.08); border:1px solid rgba(32,201,151,.2);
  border-radius:8px; font-size:13px;
}
.ce-applied-coupon-code { font-weight:600; color:var(--ce-teal); }
.ce-applied-coupon-val { color:var(--ce-teal); font-weight:600; }
.ce-remove-coupon { background:none; border:none; color:var(--ce-rose); cursor:pointer; font-size:16px; line-height:1; padding:0 0 0 8px; }

.ce-pay-btn {
  width:100%; padding:14px; border-radius:12px; border:none;
  background:var(--ce-teal); color:#fff; font-size:15px; font-weight:700;
  cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
  font-family:var(--font-body); transition:background .18s;
}
.ce-pay-btn:hover { background:var(--ce-teal2); }
.ce-pay-btn:disabled { opacity:.5; cursor:not-allowed; }
.ce-pay-btn svg { width:17px; height:17px; }

.ce-alert { padding:10px 12px; border-radius:9px; font-size:13px; font-weight:500; }
.ce-alert.err  { background:rgba(240,94,126,.1); color:var(--ce-rose); border:1px solid rgba(240,94,126,.2); }
.ce-alert.ok   { background:rgba(32,201,151,.1); color:var(--ce-teal); border:1px solid rgba(32,201,151,.2); }

/* ── Spinner ──────────────────────────────────────────────── */
.ce-spin {
  width:18px; height:18px; border:2px solid rgba(255,255,255,.3);
  border-top-color:#fff; border-radius:50%; animation:ce-rotate .7s linear infinite;
}
@keyframes ce-rotate { to { transform:rotate(360deg); } }

/* ── Section header ───────────────────────────────────────── */
.ce-page-header { padding:20px 16px 0; }
.ce-page-title { font-family:var(--font-head); font-size:24px; font-weight:700; }
.ce-page-sub { font-size:14px; color:var(--ce-text3); margin-top:4px; }
`;

// ─── SVG Icons (no emojis anywhere) ──────────────────────────────────────────
const Ico = {
  book:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  graduation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  bookmark:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
  bookmarkFill:<svg viewBox="0 0 24 24" fill="currentColor" strokeWidth="0"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
  search:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  filter:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>,
  grid:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  chevDown:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  x:          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  eye:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  arrow:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  play:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  tag:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  calendar:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  star:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  users:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  ai:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4v1h1a3 3 0 110 6h-1v1a4 4 0 01-8 0v-1H7a3 3 0 110-6h1V6a4 4 0 014-4z"/></svg>,
  sparkles:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/><path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/></svg>,
  info:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  tick:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = 'grid' | 'list';
type ActiveTab = 'available' | 'enrolled';

interface SelectOption { value: string; label: string; }
interface FilterState {
  category: string;
  classVal: string;
  level: string;
  price: string;
  sort: string;
  search: string;
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────
const CustomSelect: React.FC<{
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, options, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = options.find(o => o.value === value)?.label || placeholder || 'Select';

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="ce-select-wrap" ref={ref}>
      <div className={`ce-select-trigger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        {Ico.chevDown}
      </div>
      {open && (
        <div className="ce-select-menu">
          {options.map(opt => (
            <div
              key={opt.value}
              className={`ce-select-option${opt.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span style={{color:'var(--ce-accent)',fontSize:12}}>{Ico.check}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}
function isDiscountValid(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d > new Date();
}
function levelClass(level: string): string {
  const map: Record<string,string> = { beginner:'lvl-beginner', intermediate:'lvl-intermediate', advanced:'lvl-advanced', unspecified:'lvl-unspecified' };
  return map[level] || 'lvl-unspecified';
}
function levelLabel(level: string): string {
  const map: Record<string,string> = { beginner:'Beginner', intermediate:'Intermediate', advanced:'Advanced', unspecified:'All Levels' };
  return map[level] || level;
}
function getSpecialFeatures(course: Course): string[] {
  const f: string[] = [];
  if (course.hasAiQnA) f.push('AI Q&A Support');
  if (course.hasHumanQnA) f.push('Human Q&A Support');
  if (course.hasStudyPlanner) f.push('Study Planner');
  if (course.hasQnA) f.push('Q&A Forum');
  return f;
}

// ─── Price helpers for card display ──────────────────────────────────────────
function getCardPriceInfo(course: Course): { discounted: boolean; finalPrice: number; label: string; showOrig: boolean; } {
  const base = course.price;
  const extraOk = isDiscountValid(course.extraDiscountValidUntil) && (course.extraDiscount || 0) > 0;
  const extraAmt = extraOk ? Math.min(course.extraDiscount!, base) : 0;
  const finalPrice = Math.max(0, base - extraAmt);
  const discounted = extraAmt > 0;
  return {
    discounted,
    finalPrice,
    label: finalPrice === 0 ? 'Free' : `৳${finalPrice}`,
    showOrig: discounted && base > finalPrice,
  };
}
// ============================================================
// END OF PART 1
// ============================================================
// ============================================================
// CourseEnrollment.tsx  — PART 2 of 3
// ============================================================

// ─── Overview Modal ───────────────────────────────────────────────────────────
const OverviewModal: React.FC<{
  course: Course;
  calculation: EnrollmentCalculation | null;
  onClose: () => void;
  onEnroll: () => void;
  isEnrolled: boolean;
  onContinue: () => void;
}> = ({ course, calculation, onClose, onEnroll, isEnrolled, onContinue }) => {
  const extraOk = isDiscountValid(course.extraDiscountValidUntil) && (course.extraDiscount || 0) > 0;
  const features = getSpecialFeatures(course);
  const base = course.price;
  const prevDisc = calculation?.previousStudentDiscount || 0;
  const extraDisc = extraOk ? (calculation?.extraDiscount || 0) : 0;
  const afterDisc = Math.max(0, base - prevDisc - extraDisc);
  const hasPrev = (course.previousStudentDiscount || 0) > 0;

  return (
    <div className="ce-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ce-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ce-modal-header">
          <div className="ce-modal-header-text">
            <div className="ce-modal-label">Course Overview</div>
            <div className="ce-modal-title">{course.title}</div>
            {course.instructor && <div className="ce-modal-by">by {course.instructor}</div>}
          </div>
          <button className="ce-modal-close" onClick={onClose}>{Ico.x}</button>
        </div>

        {/* Body */}
        <div className="ce-modal-body">
          {/* Meta grid — CLASS, CATEGORY, LEVEL, STUDENTS */}
          <div className="ce-ov-meta-grid">
            {course.class && (
              <div className="ce-ov-meta-card">
                <div className="ce-ov-meta-label">Class</div>
                <div className="ce-ov-meta-value">{course.class}</div>
              </div>
            )}
            {course.category && (
              <div className="ce-ov-meta-card">
                <div className="ce-ov-meta-label">Category</div>
                <div className="ce-ov-meta-value">{course.category}</div>
              </div>
            )}
            {course.level && course.level !== 'unspecified' && (
              <div className="ce-ov-meta-card">
                <div className="ce-ov-meta-label">Level</div>
                <div className="ce-ov-meta-value">
                  <span className={`ce-card-level ${levelClass(course.level)}`} style={{position:'static',padding:'3px 10px'}}>
                    {levelLabel(course.level)}
                  </span>
                </div>
              </div>
            )}
            {course.studentCount > 0 && (
              <div className="ce-ov-meta-card">
                <div className="ce-ov-meta-label">Students</div>
                <div className="ce-ov-meta-value" style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:16,height:16,display:'inline-flex'}}>{Ico.users}</span>
                  {course.studentCount}
                </div>
              </div>
            )}
          </div>

          {/* Special features */}
          {features.length > 0 && (
            <div className="ce-ov-section">
              <div className="ce-ov-section-title">Special Features</div>
              <div className="ce-ov-chip-list">
                {features.map(f => (
                  <span key={f} className="ce-ov-chip" style={{display:'inline-flex',alignItems:'center',gap:5}}>
                    <span style={{width:12,height:12,display:'inline-flex'}}>{Ico.sparkles}</span>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Price breakdown */}
          <div className="ce-price-box">
            <div className="ce-price-row">
              <span className="ce-price-row-label">Course Price</span>
              <span className="ce-price-row-val base">৳{base}</span>
            </div>

            {/* Previous student discount — always show if exists, note eligibility */}
            {hasPrev && (
              <div className="ce-price-row">
                <span className="ce-price-row-label">
                  <span style={{width:14,height:14,display:'inline-flex',color:'var(--ce-teal)'}}>{Ico.tick}</span>
                  Previous Student
                  <span className="ce-badge-inline">Eligible users only</span>
                </span>
                <span className="ce-price-row-val disc">-৳{course.previousStudentDiscount}</span>
              </div>
            )}

            {/* Limited time discount — only show if NOT expired */}
            {extraOk && (
              <div className="ce-price-row">
                <span className="ce-price-row-label">
                  <span style={{width:14,height:14,display:'inline-flex',color:'var(--ce-gold)'}}>{Ico.tag}</span>
                  Limited Time
                  <span style={{fontSize:10,padding:'2px 7px',borderRadius:5,background:'rgba(245,166,35,.12)',color:'var(--ce-gold)',border:'1px solid rgba(245,166,35,.2)',fontWeight:700}}>
                    Until {fmtDate(course.extraDiscountValidUntil)}
                  </span>
                </span>
                <span className="ce-price-row-val disc">-৳{course.extraDiscount}</span>
              </div>
            )}

            {/* After discount total */}
            {(hasPrev || extraOk) && (
              <div className="ce-price-row">
                <span className="ce-price-row-label" style={{fontWeight:600,color:'var(--ce-text)'}}>After Discount</span>
                <span className="ce-price-row-val final">
                  {afterDisc === 0 ? 'Free' : `৳${afterDisc}`}
                </span>
              </div>
            )}

            {!hasPrev && !extraOk && (
              <div className="ce-price-row">
                <span className="ce-price-row-label" style={{fontWeight:600,color:'var(--ce-text)'}}>You Pay</span>
                <span className="ce-price-row-val final">
                  {base === 0 ? 'Free' : `৳${base}`}
                </span>
              </div>
            )}
          </div>

          {/* Validity */}
          {course.validity && (
            <div className="ce-validity-block">
              {Ico.calendar}
              <span>Enrollment open until <strong>{fmtDate(course.validity)}</strong></span>
            </div>
          )}

          {/* Subjects */}
          {course.subjects && course.subjects.length > 0 && (
            <div className="ce-ov-section">
              <div className="ce-ov-section-title">Subjects</div>
              <div className="ce-ov-chip-list">
                {course.subjects.map(s => <span key={s} className="ce-ov-chip">{s}</span>)}
              </div>
            </div>
          )}

          {/* What you'll learn */}
          {course.whatYouWillLearn && course.whatYouWillLearn.length > 0 && (
            <div className="ce-ov-section">
              <div className="ce-ov-section-title">What You'll Learn</div>
              <ul className="ce-ov-list">
                {course.whatYouWillLearn.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* Requirements */}
          {course.requirements && course.requirements.length > 0 && (
            <div className="ce-ov-section">
              <div className="ce-ov-section-title">Requirements</div>
              <ul className="ce-ov-list">
                {course.requirements.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* Routine files */}
          {course.routineFiles && course.routineFiles.length > 0 && (
            <div className="ce-ov-section">
              <div className="ce-ov-section-title">Course Files</div>
              <div className="ce-ov-chip-list">
                {course.routineFiles.map(f => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="ce-ov-chip" style={{textDecoration:'none'}}>
                    {f.fileName}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {course.description && (
            <div className="ce-ov-section">
              <div className="ce-ov-section-title">About this course</div>
              <p style={{margin:0,fontSize:13,color:'var(--ce-text2)',lineHeight:1.6}}>{course.description}</p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="ce-modal-footer">
          {isEnrolled ? (
            <button className="ce-modal-cta" style={{background:'var(--ce-accent)'}} onClick={() => { onContinue(); onClose(); }}>
              {Ico.play} Continue Learning
            </button>
          ) : (
            <button className="ce-modal-cta" onClick={() => { onClose(); onEnroll(); }}>
              {Ico.arrow}
              {afterDisc === 0 && (hasPrev || extraOk || base === 0) ? 'Enroll for Free' : `Enroll for ৳${base === 0 ? 0 : afterDisc}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Enrollment Modal ─────────────────────────────────────────────────────────
const EnrollModal: React.FC<{
  course: Course;
  calculation: EnrollmentCalculation;
  couponInput: string;
  setCouponInput: (v: string) => void;
  onAddCoupon: () => void;
  onRemoveCoupon: (code: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  couponLoading: boolean;
  error?: string;
}> = ({ course, calculation, couponInput, setCouponInput, onAddCoupon, onRemoveCoupon, onConfirm, onClose, loading, couponLoading, error }) => (
  <div className="ce-enroll-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ce-enroll-modal" onClick={e => e.stopPropagation()}>
      <div className="ce-enroll-header">
        <div className="ce-enroll-title">{course.title}</div>
        <div className="ce-enroll-sub">Review your enrollment details below</div>
      </div>

      <div className="ce-enroll-body">
        {/* Price breakdown */}
        <div className="ce-price-box">
          <div className="ce-price-row">
            <span className="ce-price-row-label">Base Price</span>
            <span className="ce-price-row-val base">৳{calculation.basePrice}</span>
          </div>
          {calculation.previousStudentDiscount > 0 && (
            <div className="ce-price-row">
              <span className="ce-price-row-label">{Ico.tick} Previous Student</span>
              <span className="ce-price-row-val disc">-৳{calculation.previousStudentDiscount}</span>
            </div>
          )}
          {calculation.extraDiscount > 0 && calculation.isExtraDiscountValid && (
            <div className="ce-price-row">
              <span className="ce-price-row-label">{Ico.tag} Limited Offer</span>
              <span className="ce-price-row-val disc">-৳{calculation.extraDiscount}</span>
            </div>
          )}
          {calculation.couponDiscount > 0 && (
            <div className="ce-price-row">
              <span className="ce-price-row-label">{Ico.tag} Coupon Discount</span>
              <span className="ce-price-row-val disc">-৳{calculation.couponDiscount}</span>
            </div>
          )}
          <div className="ce-price-row">
            <span className="ce-price-row-label" style={{fontWeight:700,color:'var(--ce-text)'}}>Total</span>
            <span className="ce-price-row-val final">
              {calculation.finalPrice === 0 ? 'Free' : `৳${calculation.finalPrice}`}
            </span>
          </div>
        </div>

        {/* Applied coupons */}
        {calculation.appliedCoupons.length > 0 && (
          <div className="ce-applied-coupons">
            {calculation.appliedCoupons.map(ac => (
              <div key={ac.couponCode} className="ce-applied-coupon">
                <span className="ce-applied-coupon-code">{ac.couponCode}</span>
                <span style={{display:'flex',alignItems:'center',gap:8}}>
                  <span className="ce-applied-coupon-val">-৳{ac.discount}</span>
                  <button className="ce-remove-coupon" onClick={() => onRemoveCoupon(ac.couponCode)}>×</button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Coupon input */}
        <div className="ce-coupon-wrap">
          <input
            className="ce-coupon-input"
            placeholder="Enter coupon code"
            value={couponInput}
            onChange={e => setCouponInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && onAddCoupon()}
          />
          <button className="ce-coupon-btn" onClick={onAddCoupon} disabled={couponLoading || !couponInput.trim()}>
            {couponLoading ? <span className="ce-spin"/> : 'Apply'}
          </button>
        </div>

        {/* Coupon error/success */}
        {calculation.couponError && <div className="ce-alert err">{calculation.couponError}</div>}
        {calculation.couponSuccessMessage && !calculation.couponError && (
          <div className="ce-alert ok">{calculation.couponSuccessMessage}</div>
        )}
        {error && <div className="ce-alert err">{error}</div>}
      </div>

      <div className="ce-enroll-footer">
        <button className="ce-pay-btn" onClick={onConfirm} disabled={loading}>
          {loading ? <span className="ce-spin"/> : (
            calculation.finalPrice === 0
              ? <>{Ico.check} Enroll for Free</>
              : <>{Ico.arrow} Pay ৳{calculation.finalPrice}</>
          )}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const CourseEnrollment: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();

  // ── Core data ──────────────────────────────────────────────────────────────
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

  // ── Filter / view ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    category: '', classVal: '', level: '', price: '', sort: 'popular', search: '',
  });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<ActiveTab>('available');
  const [showFilters, setShowFilters] = useState(false);

  // ── Favorites ──────────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [overviewCourse, setOverviewCourse] = useState<Course | null>(null);
  const [overviewCalc, setOverviewCalc] = useState<EnrollmentCalculation | null>(null);
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null);
  const [calculation, setCalculation] = useState<EnrollmentCalculation | null>(null);

  // ── Coupon state ───────────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  // ── Status banners ─────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [guaranteedEnrolledCourseId, setGuaranteedEnrolledCourseId] = useState<string | null>(null);

  // ── CSS inject ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = 'ce-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id; el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadCourses = useCallback(async (guaranteedId?: string | null) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [courses, enrollments] = await Promise.all([
        courseEnrollmentService.getPublishedCourses(),
        courseEnrollmentService.getStudentEnrollments(currentUser.uid),
      ]);
      setAllCourses(courses);
      const ids = new Set(enrollments.map(e => e.courseId));
      if (guaranteedId) ids.add(guaranteedId);
      setEnrolledCourseIds(ids);
      setEnrolledCourses(enrollments);
    } catch (e: any) {
      setErrorMsg('Failed to load courses. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  // ── Load favorites from Firebase ───────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'userFavourites', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setFavorites(new Set(data.courseIds || []));
        }
      } catch { /* non-fatal */ }
    })();
  }, [currentUser]);

  // ── Payment return handler ─────────────────────────────────────────────────
  useEffect(() => {
    const status = searchParams.get('status');
    const tranId = searchParams.get('tran_id') || searchParams.get('tranId');
    if (!status || !currentUser) return;

    (async () => {
      if (status === 'success' && tranId) {
        setInfoMsg('Verifying your payment...');
        try {
          const result = await courseEnrollmentService.verifyPaymentAndGetEnrollment(tranId, currentUser.uid);
          if (result.verified) {
            setSuccessMsg(result.message);
            if (result.courseId) setGuaranteedEnrolledCourseId(result.courseId);
            if (result.isReplay) setWarningMsg('Note: This transaction was already processed.');
            await loadCourses(result.courseId);
          } else {
            if (result.status === 'validating') setWarningMsg(result.message);
            else if (result.status === 'pending') setInfoMsg(result.message);
            else setErrorMsg(result.message);
            if (result.courseId) await loadCourses(result.courseId);
          }
        } catch (e: any) {
          setErrorMsg('Payment verification failed. Please contact support.');
        } finally {
          setInfoMsg('');
        }
      } else if (status === 'failed') {
        setErrorMsg('Payment failed. Please try again.');
      } else if (status === 'cancelled') {
        setWarningMsg('Payment was cancelled.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle favorite ────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(async (courseId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentUser) return;
    const next = new Set(favorites);
    if (next.has(courseId)) next.delete(courseId); else next.add(courseId);
    setFavorites(next);
    try {
      const ref = doc(db, 'userFavourites', currentUser.uid);
      if (next.size === 0) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { courseIds: Array.from(next), updatedAt: new Date() }, { merge: true });
      }
    } catch { /* non-fatal */ }
  }, [currentUser, favorites]);

  // ── Filter options ─────────────────────────────────────────────────────────
  const categories = ['', ...Array.from(new Set(allCourses.map(c => c.category).filter(Boolean)))];
  const classes    = ['', ...Array.from(new Set(allCourses.map(c => c.class).filter(Boolean)))];

  const catOptions: SelectOption[] = [
    { value: '', label: 'All Categories' },
    ...categories.slice(1).map(c => ({ value: c, label: c })),
  ];
  const classOptions: SelectOption[] = [
    { value: '', label: 'All Classes' },
    ...classes.slice(1).map(c => ({ value: c, label: c })),
  ];
  const levelOptions: SelectOption[] = [
    { value: '', label: 'All Levels' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];
  const priceOptions: SelectOption[] = [
    { value: '', label: 'Any Price' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
  ];
  const sortOptions: SelectOption[] = [
    { value: 'popular', label: 'Most Popular' },
    { value: 'newest', label: 'Newest' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
  ];

  // ── Derived: available courses with filters ────────────────────────────────
  const availableCourses = React.useMemo(() => {
    let list = allCourses.filter(c => !enrolledCourseIds.has(c.id));
    if (showSavedOnly) list = list.filter(c => favorites.has(c.id));
    const q = filters.search.toLowerCase();
    if (q) list = list.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.instructor?.toLowerCase().includes(q) ||
      c.subjects?.some(s => s.toLowerCase().includes(q)) ||
      c.tags?.some(t => t.toLowerCase().includes(q))
    );
    if (filters.category) list = list.filter(c => c.category === filters.category);
    if (filters.classVal) list = list.filter(c => c.class === filters.classVal);
    if (filters.level) list = list.filter(c => c.level === filters.level);
    if (filters.price === 'free') list = list.filter(c => c.price === 0);
    if (filters.price === 'paid') list = list.filter(c => c.price > 0);
    if (filters.sort === 'popular') list = [...list].sort((a,b) => (b.studentCount||0)-(a.studentCount||0));
    if (filters.sort === 'newest') list = [...list].sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
    if (filters.sort === 'price_asc') list = [...list].sort((a,b) => a.price-b.price);
    if (filters.sort === 'price_desc') list = [...list].sort((a,b) => b.price-a.price);
    return list;
  }, [allCourses, enrolledCourseIds, filters, showSavedOnly, favorites]);

  // ── Enrolled tab: enrich with course info ─────────────────────────────────
  const enrichedEnrollments = React.useMemo(() => {
    return enrolledCourses.map(e => {
      const course = allCourses.find(c => c.id === e.courseId);
      return { enrollment: e, course };
    }).filter(x => x.course || guaranteedEnrolledCourseId === x.enrollment.courseId);
  }, [enrolledCourses, allCourses, guaranteedEnrolledCourseId]);

  // ── Open overview ──────────────────────────────────────────────────────────
  const handleCourseClick = async (course: Course) => {
    setOverviewCourse(course);
    if (currentUser) {
      try {
        const calc = await courseEnrollmentService.calculateEnrollmentPrice(course.id, currentUser.uid, []);
        setOverviewCalc(calc);
      } catch { setOverviewCalc(null); }
    }
  };

  // ── Open enrollment modal ─────────────────────────────────────────────────
  const handleEnrollClick = async (course: Course) => {
    if (!currentUser) { setErrorMsg('Please sign in to enroll.'); return; }
    setEnrollCourse(course);
    setEnrollError('');
    setCouponInput('');
    try {
      const calc = await courseEnrollmentService.calculateEnrollmentPrice(course.id, currentUser.uid, []);
      setCalculation(calc);
    } catch (e: any) {
      setEnrollError(e.message);
    }
  };

  // ── Add coupon ─────────────────────────────────────────────────────────────
  const addCoupon = async () => {
    if (!currentUser || !enrollCourse || !couponInput.trim() || !calculation) return;
    setCouponLoading(true);
    try {
      const codes = [...calculation.appliedCoupons.map(c => c.couponCode), couponInput.trim().toUpperCase()];
      const calc = await courseEnrollmentService.calculateEnrollmentPrice(enrollCourse.id, currentUser.uid, codes);
      setCalculation(calc);
      if (!calc.couponError) setCouponInput('');
    } catch { /* non-fatal */ }
    setCouponLoading(false);
  };

  const removeCoupon = async (code: string) => {
    if (!currentUser || !enrollCourse || !calculation) return;
    const codes = calculation.appliedCoupons.filter(c => c.couponCode !== code).map(c => c.couponCode);
    try {
      const calc = await courseEnrollmentService.calculateEnrollmentPrice(enrollCourse.id, currentUser.uid, codes);
      setCalculation(calc);
    } catch { /* non-fatal */ }
  };

  const resetCouponInput = () => { setCouponInput(''); };

  // ── Confirm enrollment ─────────────────────────────────────────────────────
  const handleProceedToPayment = async () => {
    if (!currentUser || !enrollCourse || !calculation) return;
    setEnrollLoading(true);
    setEnrollError('');
    try {
      const studentData: any = {};
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) Object.assign(studentData, snap.data());
      } catch { /* non-fatal */ }

      const response = await courseEnrollmentService.enrollStudent({
        courseId: enrollCourse.id,
        studentId: currentUser.uid,
        studentName: studentData.name || studentData.displayName || currentUser.displayName || 'Student',
        studentEmail: studentData.email || currentUser.email || '',
        studentPhone: studentData.phone || studentData.phoneNumber || '',
        studentSurname: studentData.surname || studentData.lastName || '',
        studentUserId: studentData.userId || studentData.customId || '',
        calculation,
      });

      if (response.gatewayUrl) {
        window.location.href = response.gatewayUrl;
        return;
      }
      if (response.success) {
        setSuccessMsg(response.message || 'Enrolled successfully!');
        setEnrollCourse(null);
        await loadCourses();
        setActiveTab('enrolled');
      } else {
        setEnrollError(response.userMessage || response.error || 'Enrollment failed.');
      }
    } catch (e: any) {
      setEnrollError(e.message || 'Enrollment failed.');
    } finally {
      setEnrollLoading(false);
    }
  };

  // ── Continue learning ──────────────────────────────────────────────────────
  const handleContinueLearning = (courseId: string) => {
    navigate(`/courses/${courseId}/learn`);
  };
// ============================================================
// END OF PART 2
// ============================================================
// ============================================================
// CourseEnrollment.tsx  — PART 3 of 3
// ============================================================

  // ── Card renderer ──────────────────────────────────────────────────────────
  const renderCourseCard = (course: Course) => {
    const isSaved = favorites.has(course.id);
    const { discounted, finalPrice, label: priceLabel, showOrig } = getCardPriceInfo(course);
    const features = getSpecialFeatures(course);

    if (viewMode === 'list') {
      return (
        <div key={course.id} className="ce-list-row">
          {/* Thumbnail */}
          <div className="ce-list-thumb">
            {course.thumbnailUrl || course.thumbnail
              ? <img src={course.thumbnailUrl || course.thumbnail} alt={course.title} />
              : Ico.book
            }
          </div>

          {/* Body */}
          <div className="ce-list-body">
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span className={`ce-card-level ${levelClass(course.level)}`} style={{position:'static',padding:'2px 9px'}}>
                {levelLabel(course.level)}
              </span>
            </div>
            <div className="ce-list-title">{course.title}</div>
            <div className="ce-list-sub">{[course.class, course.category].filter(Boolean).join(' · ')}</div>
            {features.length > 0 && (
              <div className="ce-card-chips">
                {features.slice(0,2).map(f => (
                  <span key={f} className="ce-chip"><span style={{width:10,height:10}}>{Ico.sparkles}</span>{f}</span>
                ))}
              </div>
            )}
            <div className="ce-card-price">
              <span className={finalPrice === 0 ? 'ce-price-free' : 'ce-price-now'}>{priceLabel}</span>
              {showOrig && <span className="ce-price-orig">৳{course.price}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="ce-list-row-actions">
            <button
              className={`ce-save-btn${isSaved ? ' saved' : ''}`}
              style={{position:'static',width:34,height:34}}
              onClick={e => toggleFavorite(course.id, e)}
            >
              {isSaved ? Ico.bookmarkFill : Ico.bookmark}
            </button>
            <button className="ce-btn-overview" style={{minWidth:80}} onClick={() => handleCourseClick(course)}>
              {Ico.eye} <span>Overview</span>
            </button>
            <button className="ce-btn-enroll" style={{minWidth:80}} onClick={() => handleEnrollClick(course)}>
              {Ico.arrow} <span>Enroll</span>
            </button>
          </div>
        </div>
      );
    }

    // Grid card
    return (
      <div key={course.id} className="ce-card">
        <div className="ce-card-thumb">
          {course.thumbnailUrl || course.thumbnail
            ? <img src={course.thumbnailUrl || course.thumbnail} alt={course.title} />
            : <div className="ce-card-thumb-placeholder">{Ico.book}</div>
          }
          <span className={`ce-card-level ${levelClass(course.level)}`}>{levelLabel(course.level)}</span>
          <button className={`ce-save-btn${isSaved ? ' saved' : ''}`} onClick={e => toggleFavorite(course.id, e)}>
            {isSaved ? Ico.bookmarkFill : Ico.bookmark}
          </button>
        </div>

        <div className="ce-card-body">
          <div className="ce-card-meta">
            <span style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{width:12,height:12}}>{Ico.users}</span>
              {course.studentCount || 0}
            </span>
            {course.class && <><span className="ce-card-meta-dot"/><span>{course.class}</span></>}
          </div>

          <div className="ce-card-title">{course.title}</div>
          {course.category && <div className="ce-card-sub">{course.category}</div>}

          {features.length > 0 && (
            <div className="ce-card-chips">
              {features.slice(0,2).map(f => (
                <span key={f} className="ce-chip"><span style={{width:10,height:10}}>{Ico.sparkles}</span>{f}</span>
              ))}
            </div>
          )}

          <div className="ce-card-price">
            <span className={finalPrice === 0 ? 'ce-price-free' : 'ce-price-now'}>{priceLabel}</span>
            {showOrig && <span className="ce-price-orig">৳{course.price}</span>}
            {/* Only show sale badge if it's a LIMITED TIME discount (not just any discount) */}
            {discounted && (
        <span className="ce-sale-badge">Limited Time</span>
)}
        </div>

        <div className="ce-card-actions">
          <button className="ce-btn-overview" onClick={() => handleCourseClick(course)}>
            {Ico.eye} Overview
          </button>
          <button className="ce-btn-enroll" onClick={() => handleEnrollClick(course)}>
            {Ico.arrow} Enroll
          </button>
        </div>
        </div>
      </div>
    );
  };

  // ── Enrolled card ──────────────────────────────────────────────────────────
  const renderEnrolledCard = ({ enrollment, course }: { enrollment: Enrollment; course?: Course }) => {
    const title = course?.title || 'Course';
    const thumbnail = course?.thumbnailUrl || course?.thumbnail;
    const progress = enrollment.progress || 0;

    if (viewMode === 'list') {
      return (
        <div key={enrollment.id} className="ce-list-row">
          <div className="ce-list-thumb">
            {thumbnail ? <img src={thumbnail} alt={title} /> : Ico.book}
          </div>
          <div className="ce-list-body">
            <div className="ce-list-title">{title}</div>
            {course && <div className="ce-list-sub">{[course.class, course.category].filter(Boolean).join(' · ')}</div>}
            <div className="ce-progress-wrap">
              <div className="ce-progress-bar"><div className="ce-progress-fill" style={{width:`${progress}%`}}/></div>
              <div className="ce-progress-label">{progress}% complete</div>
            </div>
          </div>
          <div className="ce-list-row-actions">
            <button className="ce-btn-continue" onClick={() => course && handleContinueLearning(course.id)}>
              {Ico.play} <span>Continue</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={enrollment.id} className="ce-card">
        <div className="ce-card-thumb">
          {thumbnail ? <img src={thumbnail} alt={title} /> : <div className="ce-card-thumb-placeholder">{Ico.book}</div>}
          {course && <span className={`ce-card-level ${levelClass(course.level)}`}>{levelLabel(course.level)}</span>}
        </div>
        <div className="ce-card-body">
          <div className="ce-card-title">{title}</div>
          {course && course.category && <div className="ce-card-sub">{course.category}</div>}
          <div className="ce-progress-wrap">
            <div className="ce-progress-bar"><div className="ce-progress-fill" style={{width:`${progress}%`}}/></div>
            <div className="ce-progress-label">{progress}% complete</div>
          </div>
          {enrollment.amountPaid !== undefined && (
            <div style={{fontSize:12,color:'var(--ce-text3)',marginTop:2}}>
              Paid: {enrollment.amountPaid === 0 ? 'Free' : `৳${enrollment.amountPaid}`}
            </div>
          )}
        </div>
        <div className="ce-card-actions">
          {course && (
            <button className="ce-btn-overview" onClick={() => handleCourseClick(course)}>
              {Ico.eye} Overview
            </button>
          )}
          <button className="ce-btn-continue" onClick={() => course && handleContinueLearning(course.id)}>
            {Ico.play} Continue
          </button>
        </div>
      </div>
    );
  };

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="ce-wrap">
      <div className="ce-page-header">
        <div className="ce-page-title">Courses</div>
        <div className="ce-page-sub">Loading your courses...</div>
      </div>
      <div className="ce-skeleton-grid">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="ce-skeleton">
            <div className="ce-skeleton-thumb"/>
            <div className="ce-skeleton-body">
              <div className="ce-skeleton-line" style={{width:'60%'}}/>
              <div className="ce-skeleton-line" style={{width:'90%'}}/>
              <div className="ce-skeleton-line" style={{width:'40%'}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="ce-wrap">

      {/* Page header */}
      <div className="ce-page-header">
        <div className="ce-page-title">Courses</div>
        <div className="ce-page-sub">Discover and enroll in courses tailored for you</div>
      </div>

      {/* Status banners */}
      {successMsg && (
        <div className="ce-banner success">
          {Ico.tick}
          <div>
            <div style={{fontWeight:600}}>{successMsg}</div>
            {warningMsg && <div style={{fontSize:12,marginTop:4,opacity:.8}}>{warningMsg}</div>}
          </div>
        </div>
      )}
      {errorMsg && <div className="ce-banner error">{Ico.info}<div>{errorMsg}</div></div>}
      {infoMsg && !successMsg && <div className="ce-banner info">{Ico.info}<div>{infoMsg}</div></div>}
      {warningMsg && !successMsg && <div className="ce-banner warning">{Ico.info}<div>{warningMsg}</div></div>}

      {/* Summary pills */}
      <div className="ce-summary">
        <div
          className={`ce-pill${activeTab === 'available' && !showSavedOnly ? ' active' : ''}`}
          onClick={() => { setActiveTab('available'); setShowSavedOnly(false); }}
        >
          {Ico.book}
          Available
          <span className="ce-pill-count">{allCourses.filter(c => !enrolledCourseIds.has(c.id)).length}</span>
        </div>
        <div
          className={`ce-pill${activeTab === 'enrolled' ? ' active' : ''}`}
          onClick={() => setActiveTab('enrolled')}
        >
          {Ico.graduation}
          Enrolled
          <span className="ce-pill-count">{enrolledCourses.length}</span>
        </div>
        <div
          className={`ce-pill saved${showSavedOnly ? ' active' : ''}`}
          onClick={() => { setShowSavedOnly(s => !s); setActiveTab('available'); }}
        >
          {Ico.bookmarkFill}
          Saved
          <span className="ce-pill-count">{favorites.size}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="ce-tabs">
        <button className={`ce-tab${activeTab === 'available' ? ' active' : ''}`} onClick={() => setActiveTab('available')}>
          {Ico.book}
          Available
          <span className="ce-tab-badge">{availableCourses.length}</span>
        </button>
        <button className={`ce-tab${activeTab === 'enrolled' ? ' active' : ''}`} onClick={() => setActiveTab('enrolled')}>
          {Ico.graduation}
          Enrolled
          <span className="ce-tab-badge">{enrichedEnrollments.length}</span>
        </button>
      </div>

      {activeTab === 'available' && (
        <>
          {/* Toolbar */}
          <div className="ce-toolbar">
            <div className="ce-search-row">
              <div className="ce-search-box">
                {Ico.search}
                <input
                  placeholder="Search courses, instructors, topics..."
                  value={filters.search}
                  onChange={e => setFilters(f => ({...f, search: e.target.value}))}
                />
              </div>
              {/* Mobile filter button */}
              <button
                className={`ce-filter-btn${showFilters ? ' active' : ''}`}
                onClick={() => setShowFilters(s => !s)}
              >
                {Ico.filter}
              </button>
            </div>
            <div className="ce-view-toggle">
              <button className={`ce-view-btn${viewMode==='grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}>{Ico.grid}</button>
              <button className={`ce-view-btn${viewMode==='list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>{Ico.list}</button>
            </div>
          </div>

          {/* Filter panel — hidden on mobile until filter btn clicked, always visible on desktop */}
          <div className={`ce-filters${showFilters ? ' open' : ' closed'}`}>
            <div className="ce-filters-inner">
              <CustomSelect value={filters.category} options={catOptions} onChange={v => setFilters(f => ({...f, category:v}))} />
              <CustomSelect value={filters.classVal} options={classOptions} onChange={v => setFilters(f => ({...f, classVal:v}))} />
              <CustomSelect value={filters.level} options={levelOptions} onChange={v => setFilters(f => ({...f, level:v}))} />
              <CustomSelect value={filters.price} options={priceOptions} onChange={v => setFilters(f => ({...f, price:v}))} />
              <CustomSelect value={filters.sort} options={sortOptions} onChange={v => setFilters(f => ({...f, sort:v}))} />
            </div>
          </div>

          {/* Saved strip */}
          {showSavedOnly && (
            <div className="ce-saved-strip">
              <span style={{display:'flex',alignItems:'center',gap:7}}>{Ico.bookmarkFill} Showing saved courses only</span>
              <button onClick={() => setShowSavedOnly(false)}>× Clear</button>
            </div>
          )}

          {/* Course grid / list */}
          <div className="ce-courses">
            {availableCourses.length === 0 ? (
              <div className="ce-empty">
                {Ico.book}
                <div className="ce-empty-title">
                  {showSavedOnly ? 'No saved courses' : 'No courses found'}
                </div>
                <div className="ce-empty-sub">
                  {showSavedOnly ? 'Save courses with the bookmark button to see them here.' : 'Try adjusting your search or filters.'}
                </div>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'ce-grid' : 'ce-list-view'}>
                {availableCourses.map(c => renderCourseCard(c))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'enrolled' && (
        <>
          <div className="ce-toolbar">
            <div style={{flex:1}}/>
            <div className="ce-view-toggle">
              <button className={`ce-view-btn${viewMode==='grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}>{Ico.grid}</button>
              <button className={`ce-view-btn${viewMode==='list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>{Ico.list}</button>
            </div>
          </div>
          <div className="ce-courses">
            {enrichedEnrollments.length === 0 ? (
              <div className="ce-empty">
                {Ico.graduation}
                <div className="ce-empty-title">No enrolled courses yet</div>
                <div className="ce-empty-sub">Browse available courses and enroll to get started.</div>
                <button
                  onClick={() => setActiveTab('available')}
                  style={{marginTop:16,padding:'10px 20px',borderRadius:9,border:'none',background:'var(--ce-accent)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-body)'}}
                >
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'ce-grid' : 'ce-list-view'}>
                {enrichedEnrollments.map(e => renderEnrolledCard(e))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Overview Modal */}
      {overviewCourse && (
        <OverviewModal
          course={overviewCourse}
          calculation={overviewCalc}
          onClose={() => { setOverviewCourse(null); setOverviewCalc(null); }}
          onEnroll={() => handleEnrollClick(overviewCourse)}
          isEnrolled={enrolledCourseIds.has(overviewCourse.id)}
          onContinue={() => handleContinueLearning(overviewCourse.id)}
        />
      )}

      {/* Enrollment Modal */}
      {enrollCourse && calculation && (
        <EnrollModal
          course={enrollCourse}
          calculation={calculation}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          onAddCoupon={addCoupon}
          onRemoveCoupon={removeCoupon}
          onConfirm={handleProceedToPayment}
          onClose={() => { setEnrollCourse(null); setCalculation(null); resetCouponInput(); setEnrollError(''); }}
          loading={enrollLoading}
          couponLoading={couponLoading}
          error={enrollError}
        />
      )}
    </div>
  );
};

export default CourseEnrollment;
// ============================================================
// END OF PART 3
// ============================================================
