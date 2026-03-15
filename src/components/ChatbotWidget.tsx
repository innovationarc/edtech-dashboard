// src/components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Send, X, AlertTriangle, Info, Sparkles, Zap, ChevronDown } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { novaRAGService } from '../services/novaRAGService';
import { novaChatHistoryService, NovaChatMessage } from '../services/novaChatHistoryService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }

const TypingIndicator = () => (
  <div className="nv-typing">
    <span /><span /><span />
  </div>
);

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ eyeOffset }) => {
  const { accentColor, user, siteName } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<NovaChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlying = useRef(false);
  const sessionId = useRef<string>(
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!user?.uid) { setHistoryLoaded(true); return; }
    novaChatHistoryService.getHistory(user.uid)
      .then(h => { setMessages(h); setHistoryLoaded(true); })
      .catch(() => setHistoryLoaded(true));
  }, [user?.uid]);

  const isNearBottom = () => {
    const el = messagesRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollBtn(false);
  };

  useEffect(() => {
    if (isNearBottom()) scrollToBottom();
    else setShowScrollBtn(true);
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
      setTimeout(() => { scrollToBottom('instant' as ScrollBehavior); inputRef.current?.focus(); }, 60);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const close = () => { isFlying.current = true; setIsOpen(false); };
    const land = () => { isFlying.current = false; };
    window.addEventListener('ghost-close-chat', close);
    window.addEventListener('ghost-land', land);
    return () => { window.removeEventListener('ghost-close-chat', close); window.removeEventListener('ghost-land', land); };
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    const text = inputMessage.trim();
    const userMsg: NovaChatMessage = { id: `tmp-u-${Date.now()}`, text, sender: 'user', timestamp: new Date(), sessionId: sessionId.current };
    setMessages(p => [...p, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    setErrorDetails('');
    try {
      const res = await novaRAGService.sendMessage(text, user ?? null, sessionId.current, siteName);
      const aiMsg: NovaChatMessage = { id: `tmp-a-${Date.now()}`, text: res.text, sender: 'ai', timestamp: new Date(), sessionId: sessionId.current };
      setMessages(p => [...p, aiMsg]);
      if (res.navigateTo) {
        setIsOpen(false); setIsVisible(false); isFlying.current = false;
        window.dispatchEvent(new CustomEvent('nova-navigate', { detail: { path: res.navigateTo } }));
        setTimeout(() => window.dispatchEvent(new CustomEvent('ghost-land')), 300);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorDetails(`Error: ${msg}\n\nPossible causes:\n1. No AI key configured (Admin → AI Model Settings → 'chatbot' group)\n2. No vector key configured (Admin → AI Model Settings → 'vector' group)\n3. CORS blocking\n4. Network issue\n5. Rate limit exceeded — failover exhausted`);
      setMessages(p => [...p, { id: `tmp-e-${Date.now()}`, text: 'Something went wrong. Tap the info icon for details.', sender: 'ai', timestamp: new Date(), sessionId: sessionId.current }]);
    } finally { setIsLoading(false); }
  };

  const handleGhostTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) { tapCount.current = 0; window.dispatchEvent(new CustomEvent('ghost-fly')); }
    else tapTimer.current = setTimeout(() => { if (tapCount.current === 1 && !isFlying.current) setIsOpen(p => !p); tapCount.current = 0; }, 200);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) handleSendMessage();
  };

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const dateSep = (d: Date) => {
    const t = new Date(), y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  type DisplayItem =
    | { type: 'sep'; label: string; key: string }
    | { type: 'msg'; msg: NovaChatMessage };

  const items: DisplayItem[] = [];
  let lastDate = '';
  for (const m of messages) {
    const ds = m.timestamp.toDateString();
    if (ds !== lastDate) { items.push({ type: 'sep', label: dateSep(m.timestamp), key: `sep-${ds}` }); lastDate = ds; }
    items.push({ type: 'msg', msg: m });
  }

  const accent = accentColor || '#6366f1';
  const panelBottom = isMobile ? 160 : 104;

  // Derive a slightly lighter/darker accent for gradient
  const accentRgb = (() => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '99,102,241';
  })();

  const portal = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        /* ── Variables ── */
        .nv-root {
          --nv-accent: ${accent};
          --nv-accent-rgb: ${accentRgb};
          --nv-bg: #09090b;
          --nv-surface: #111113;
          --nv-surface2: #18181b;
          --nv-surface3: #1f1f23;
          --nv-border: rgba(255,255,255,0.06);
          --nv-border2: rgba(255,255,255,0.10);
          --nv-text: #fafafa;
          --nv-text2: #a1a1aa;
          --nv-text3: #71717a;
          --nv-radius: 22px;
          --nv-font: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
          font-family: var(--nv-font);
        }
        .nv-root * { box-sizing: border-box; font-family: var(--nv-font); }

        /* ── Ghost btn ── */
        @keyframes nv-pulse {
          0%,100% { filter: drop-shadow(0 0 8px rgba(var(--nv-accent-rgb),0.45)) drop-shadow(0 4px 18px rgba(0,0,0,0.5)); }
          50%      { filter: drop-shadow(0 0 20px rgba(var(--nv-accent-rgb),0.75)) drop-shadow(0 8px 26px rgba(0,0,0,0.55)); }
        }
        .nv-ghost-btn {
          animation: nv-pulse 3.4s ease-in-out infinite;
          transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
          background: none !important; border: none !important; padding: 0 !important;
          cursor: pointer; display: block; width: 72px; height: 72px; outline: none;
        }
        .nv-ghost-btn:hover { animation: none; transform: scale(1.1); filter: drop-shadow(0 0 26px rgba(var(--nv-accent-rgb),0.85)); }

        /* ── Panel shell — FIXED height, flex column, never expands ── */
        .nv-panel {
          position: fixed; z-index: 49;
          right: 20px;
          /* Width */
          width: min(400px, calc(100vw - 40px));
          /* Height: capped at 600px, never overflows viewport */
          height: min(600px, calc(100dvh - 140px));
          /* Flex column: header + messages(flex:1,scroll) + input — each fixed */
          display: flex; flex-direction: column;
          background: var(--nv-bg);
          border: 1px solid var(--nv-border2);
          border-radius: var(--nv-radius);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 24px 60px rgba(0,0,0,0.7),
            0 8px 24px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.05);
          overflow: hidden;
          transform-origin: bottom right;
          transition: opacity 0.22s ease, transform 0.28s cubic-bezier(.34,1.3,.64,1);
          /* Prevent ANY content from breaking out */
          contain: layout;
        }
        .nv-panel.open  { opacity: 1; transform: scale(1) translateY(0); pointer-events: all; }
        .nv-panel.close { opacity: 0; transform: scale(0.93) translateY(14px); pointer-events: none; }

        /* Mobile */
        @media (max-width: 1023px) {
          .nv-panel {
            left: 10px; right: 10px; width: auto;
            border-radius: 20px;
            height: min(560px, calc(100dvh - 224px));
          }
        }
        @media (max-height: 600px) {
          .nv-panel { height: calc(100dvh - 160px); }
        }

        /* ── Header — flex-shrink:0, never squished ── */
        .nv-header {
          flex: 0 0 auto;
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px;
          background: var(--nv-surface);
          border-bottom: 1px solid var(--nv-border);
          /* Subtle gradient band */
          background-image: linear-gradient(135deg, rgba(var(--nv-accent-rgb),0.06) 0%, transparent 60%);
        }
        .nv-avatar {
          width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--nv-accent), rgba(var(--nv-accent-rgb),0.6));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 12px rgba(var(--nv-accent-rgb),0.4), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .nv-header-info { flex: 1; min-width: 0; }
        .nv-header-name { font-size: 13.5px; font-weight: 700; color: var(--nv-text); letter-spacing: -0.01em; line-height: 1.2; }
        .nv-header-status { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
        .nv-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #22c55e;
          box-shadow: 0 0 6px #22c55eaa;
          animation: nv-dot-pulse 2.2s ease-in-out infinite;
        }
        @keyframes nv-dot-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.85)} }
        .nv-header-sub { font-size: 10.5px; color: var(--nv-text3); font-weight: 500; }
        .nv-header-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .nv-icon-btn {
          width: 30px; height: 30px; border-radius: 8px;
          background: transparent; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--nv-text3); transition: background 0.12s, color 0.12s;
          outline: none;
        }
        .nv-icon-btn:hover { background: rgba(255,255,255,0.07); color: var(--nv-text); }

        /* ── Messages area — THE KEY: flex:1 + min-height:0 + overflow-y:auto ── */
        .nv-messages-wrap {
          flex: 1 1 0;       /* grow to fill, shrink, base 0 */
          min-height: 0;     /* CRITICAL: allows shrinking below content */
          position: relative;
          overflow: hidden;  /* clip, actual scroll is on .nv-messages */
        }
        .nv-messages {
          position: absolute; inset: 0; /* fill wrapper exactly */
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px 14px;
          display: flex; flex-direction: column; gap: 4px;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .nv-messages::-webkit-scrollbar { width: 3px; }
        .nv-messages::-webkit-scrollbar-track { background: transparent; }
        .nv-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .nv-messages::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

        /* Scroll to bottom FAB */
        .nv-scroll-fab {
          position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
          background: var(--nv-surface3); border: 1px solid var(--nv-border2);
          color: var(--nv-text2); border-radius: 20px; padding: 5px 12px 5px 10px;
          display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600;
          cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          animation: nv-fab-in 0.18s ease; z-index: 2; white-space: nowrap;
          transition: background 0.12s, box-shadow 0.12s;
        }
        .nv-scroll-fab:hover { background: var(--nv-surface3); box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
        @keyframes nv-fab-in { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

        /* ── Date separator ── */
        .nv-sep {
          display: flex; align-items: center; gap: 8px;
          margin: 10px 0 6px;
        }
        .nv-sep::before, .nv-sep::after { content:''; flex:1; height:1px; background: var(--nv-border); }
        .nv-sep span { font-size: 10px; color: var(--nv-text3); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }

        /* ── Message rows ── */
        .nv-row { display: flex; align-items: flex-end; gap: 7px; margin-bottom: 2px; }
        .nv-row.user { flex-direction: row-reverse; }

        /* Group consecutive messages from same sender */
        .nv-row + .nv-row.ai   { margin-top: 1px; }
        .nv-row + .nv-row.user { margin-top: 1px; }
        .nv-row.first-in-group { margin-top: 10px; }

        .nv-mini-av {
          width: 24px; height: 24px; border-radius: 8px; flex-shrink: 0; align-self: flex-end;
          background: linear-gradient(135deg, var(--nv-accent), rgba(var(--nv-accent-rgb),0.6));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(var(--nv-accent-rgb),0.35);
        }
        .nv-mini-av.hidden { visibility: hidden; }

        .nv-bubble-wrap { display: flex; flex-direction: column; gap: 2px; max-width: min(72%, 280px); }
        .nv-row.user .nv-bubble-wrap { align-items: flex-end; }
        .nv-row.ai  .nv-bubble-wrap  { align-items: flex-start; }

        .nv-bubble {
          padding: 9px 13px; border-radius: 16px;
          font-size: 13.5px; line-height: 1.55; word-break: break-word; white-space: pre-wrap;
          position: relative;
        }
        .nv-bubble.ai {
          background: var(--nv-surface2);
          border: 1px solid var(--nv-border);
          color: var(--nv-text);
          border-bottom-left-radius: 4px;
        }
        .nv-bubble.user {
          background: var(--nv-accent);
          color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 12px rgba(var(--nv-accent-rgb),0.35);
        }
        /* Tail for first bubble in group */
        .nv-row.first-in-group .nv-bubble.ai  { border-bottom-left-radius: 4px; }
        .nv-row.first-in-group .nv-bubble.user{ border-bottom-right-radius: 4px; }

        .nv-ts { font-size: 9.5px; color: var(--nv-text3); padding: 0 3px; }

        /* ── Typing ── */
        .nv-typing {
          display: flex; gap: 3px; align-items: center; padding: 10px 14px;
        }
        .nv-typing span {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--nv-text3); display: block;
          animation: nv-bounce 1.3s ease-in-out infinite;
        }
        .nv-typing span:nth-child(2) { animation-delay: 0.16s; }
        .nv-typing span:nth-child(3) { animation-delay: 0.32s; }
        @keyframes nv-bounce {
          0%,60%,100% { transform: translateY(0); opacity: 0.35; }
          30%          { transform: translateY(-5px); opacity: 1; }
        }

        /* ── Empty / shimmer ── */
        .nv-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 24px 20px; text-align: center; gap: 14px;
        }
        .nv-empty-icon {
          width: 52px; height: 52px; border-radius: 16px;
          background: rgba(var(--nv-accent-rgb),0.1);
          border: 1px solid rgba(var(--nv-accent-rgb),0.25);
          display: flex; align-items: center; justify-content: center;
          color: var(--nv-accent);
          box-shadow: 0 0 24px rgba(var(--nv-accent-rgb),0.12);
        }
        .nv-empty-title { font-size: 15px; font-weight: 700; color: var(--nv-text); margin-bottom: 4px; }
        .nv-empty-sub   { font-size: 12.5px; color: var(--nv-text3); line-height: 1.5; max-width: 220px; }
        .nv-chips { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 4px; }
        .nv-chip {
          padding: 5px 11px; border-radius: 18px;
          background: var(--nv-surface2); border: 1px solid var(--nv-border2);
          color: var(--nv-text2); font-size: 11.5px; font-weight: 500; cursor: pointer;
          transition: all 0.13s; white-space: nowrap;
        }
        .nv-chip:hover { background: rgba(var(--nv-accent-rgb),0.12); border-color: rgba(var(--nv-accent-rgb),0.35); color: var(--nv-text); }

        .nv-shimmer-wrap { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; width: 100%; }
        .nv-shimmer {
          height: 38px; border-radius: 14px;
          background: linear-gradient(90deg, var(--nv-surface2) 0%, var(--nv-surface3) 50%, var(--nv-surface2) 100%);
          background-size: 200% 100%;
          animation: nv-shim 1.5s infinite;
        }
        .nv-shimmer.s { width: 52%; }
        .nv-shimmer.l { width: 78%; align-self: flex-end; }
        .nv-shimmer.m { width: 62%; }
        @keyframes nv-shim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* ── Input area — flex-shrink:0, always visible ── */
        .nv-input-area {
          flex: 0 0 auto;
          padding: 10px 12px 12px;
          background: var(--nv-surface);
          border-top: 1px solid var(--nv-border);
        }
        .nv-input-row {
          display: flex; align-items: center; gap: 8px;
          background: var(--nv-surface2);
          border: 1px solid var(--nv-border2);
          border-radius: 14px; padding: 5px 5px 5px 13px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .nv-input-row:focus-within {
          border-color: rgba(var(--nv-accent-rgb),0.5);
          box-shadow: 0 0 0 3px rgba(var(--nv-accent-rgb),0.1);
        }
        .nv-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--nv-text); font-size: 13.5px; font-family: var(--nv-font);
          padding: 5px 0; line-height: 1.4; min-width: 0;
        }
        .nv-input::placeholder { color: var(--nv-text3); }
        .nv-input:disabled { opacity: 0.4; }
        .nv-send {
          width: 34px; height: 34px; border-radius: 10px; border: none; cursor: pointer;
          background: var(--nv-accent); color: #fff; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s cubic-bezier(.34,1.56,.64,1), box-shadow 0.15s, opacity 0.15s;
          box-shadow: 0 2px 10px rgba(var(--nv-accent-rgb),0.45);
        }
        .nv-send:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 4px 16px rgba(var(--nv-accent-rgb),0.6); }
        .nv-send:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }
        .nv-hint { font-size: 10px; color: var(--nv-text3); text-align: center; margin-top: 7px; letter-spacing: 0.01em; }

        /* ── Modals ── */
        .nv-overlay {
          position: fixed; inset: 0; z-index: 51;
          background: rgba(0,0,0,0.72); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
          animation: nv-fade 0.14s ease;
        }
        @keyframes nv-fade { from{opacity:0} to{opacity:1} }
        .nv-modal {
          background: var(--nv-surface); border: 1px solid var(--nv-border2);
          border-radius: 20px; width: min(420px, 100%); overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04);
          animation: nv-modal-in 0.18s cubic-bezier(.34,1.3,.64,1);
        }
        @keyframes nv-modal-in { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:none} }
        .nv-modal-head {
          padding: 16px 18px; border-bottom: 1px solid var(--nv-border);
          display: flex; align-items: center; justify-content: space-between;
        }
        .nv-modal-body { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
        .nv-card {
          background: var(--nv-surface2); border: 1px solid var(--nv-border);
          border-radius: 12px; padding: 12px 14px;
          font-size: 12.5px; color: var(--nv-text2); line-height: 1.6;
        }
        .nv-card strong { color: var(--nv-text); display: block; margin-bottom: 6px; }
        .nv-primary-btn {
          width: 100%; padding: 10px; border-radius: 11px; border: none; cursor: pointer;
          background: var(--nv-accent); color: #fff; font-size: 13.5px; font-weight: 600;
          font-family: var(--nv-font); transition: opacity 0.13s;
          box-shadow: 0 2px 10px rgba(var(--nv-accent-rgb),0.35);
        }
        .nv-primary-btn:hover { opacity: 0.87; }
      `}</style>

      {/* ── Info Modal ── */}
      {showInfo && (
        <div className="nv-overlay nv-root" onClick={() => setShowInfo(false)}>
          <div className="nv-modal" onClick={e => e.stopPropagation()}>
            <div className="nv-modal-head">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Sparkles size={16} style={{ color: accent }} />
                <span style={{ color:'var(--nv-text)', fontWeight:700, fontSize:14 }}>About Nova</span>
              </div>
              <button className="nv-icon-btn" onClick={() => setShowInfo(false)}><X size={16} /></button>
            </div>
            <div className="nv-modal-body">
              <p style={{ fontSize:12.5, color:'var(--nv-text2)', lineHeight:1.6 }}>
                Nova is your AI assistant — here to help with platform questions, studies, scheduling, and anything else.
              </p>
              <div className="nv-card">
                <strong>✦ Capabilities</strong>
                <ul style={{ paddingLeft:14, display:'flex', flexDirection:'column', gap:3 }}>
                  <li>Platform navigation & feature help</li>
                  <li>Study guidance & concept explanations</li>
                  <li>Assignment and schedule queries</li>
                  <li>Powered by Admin → AI Model Settings</li>
                </ul>
              </div>
              <div className="nv-card" style={{ borderColor:`rgba(${accentRgb},0.3)`, background:`rgba(${accentRgb},0.06)` }}>
                <strong style={{ color: accent }}>💡 Tip</strong>
                Be specific in your questions for the most accurate answers.
              </div>
              <button className="nv-primary-btn" onClick={() => setShowInfo(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Modal ── */}
      {errorDetails && (
        <div className="nv-overlay nv-root" onClick={() => setErrorDetails('')}>
          <div className="nv-modal" onClick={e => e.stopPropagation()}>
            <div className="nv-modal-head">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <AlertTriangle size={16} style={{ color:'#f87171' }} />
                <span style={{ color:'var(--nv-text)', fontWeight:700, fontSize:14 }}>Error Details</span>
              </div>
              <button className="nv-icon-btn" onClick={() => setErrorDetails('')}><X size={16} /></button>
            </div>
            <div className="nv-modal-body">
              <pre style={{ fontSize:11.5, color:'#f87171', background:'var(--nv-surface2)', padding:'12px', borderRadius:10, whiteSpace:'pre-wrap', overflowX:'auto', fontFamily:'ui-monospace,monospace', lineHeight:1.6, border:'1px solid var(--nv-border)' }}>{errorDetails}</pre>
              <button className="nv-primary-btn" onClick={() => setErrorDetails('')}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Panel ── */}
      {isOpen && (
        <div
          className={`nv-panel nv-root ${isVisible ? 'open' : 'close'}`}
          style={{ bottom: panelBottom }}
          role="dialog"
          aria-label="Nova AI assistant"
        >
          {/* Header */}
          <div className="nv-header">
            <div className="nv-avatar">
              <Zap size={17} color="#fff" strokeWidth={2.5} />
            </div>
            <div className="nv-header-info">
              <div className="nv-header-name">Nova</div>
              <div className="nv-header-status">
                <div className="nv-dot" />
                <span className="nv-header-sub">AI Assistant · Online</span>
              </div>
            </div>
            <div className="nv-header-actions">
              <button className="nv-icon-btn" onClick={() => setShowInfo(true)} aria-label="About Nova"><Info size={15} /></button>
              <button className="nv-icon-btn" onClick={() => setIsOpen(false)} aria-label="Close"><X size={15} /></button>
            </div>
          </div>

          {/* Messages wrapper — scroll container */}
          <div className="nv-messages-wrap">
            <div
              className="nv-messages"
              ref={messagesRef}
              onScroll={() => {
                const el = messagesRef.current;
                if (!el) return;
                const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                setShowScrollBtn(!near);
              }}
            >
              {/* Shimmer */}
              {!historyLoaded && (
                <div className="nv-shimmer-wrap">
                  <div className="nv-shimmer s" />
                  <div className="nv-shimmer l" />
                  <div className="nv-shimmer m" />
                  <div className="nv-shimmer s" />
                </div>
              )}

              {/* Empty state */}
              {historyLoaded && messages.length === 0 && (
                <div className="nv-empty">
                  <div className="nv-empty-icon"><Sparkles size={24} /></div>
                  <div>
                    <div className="nv-empty-title">Hi, I'm Nova ✦</div>
                    <div className="nv-empty-sub">Your AI assistant. Ask anything about the platform, your studies, or anything else.</div>
                  </div>
                  <div className="nv-chips">
                    {['Submit an exam?', 'My schedule', 'Study help', 'Platform features'].map(q => (
                      <button key={q} className="nv-chip" onClick={() => { setInputMessage(q); inputRef.current?.focus(); }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {historyLoaded && (() => {
                let prevSender: string | null = null;
                return items.map((item, idx) => {
                  if (item.type === 'sep') {
                    prevSender = null;
                    return <div key={item.key} className="nv-sep"><span>{item.label}</span></div>;
                  }
                  const { msg } = item;
                  const isFirst = msg.sender !== prevSender;
                  prevSender = msg.sender;
                  // peek at next item — hide avatar if same sender follows
                  const nextItem = items[idx + 1];
                  const nextIsSame = nextItem?.type === 'msg' && nextItem.msg.sender === msg.sender;
                  return (
                    <div key={msg.id} className={`nv-row ${msg.sender}${isFirst ? ' first-in-group' : ''}`}>
                      {msg.sender === 'ai' && (
                        <div className={`nv-mini-av${nextIsSame ? ' hidden' : ''}`}>
                          <Zap size={11} color="#fff" strokeWidth={2.5} />
                        </div>
                      )}
                      <div className="nv-bubble-wrap">
                        <div className={`nv-bubble ${msg.sender}`}>{msg.text}</div>
                        {/* Show timestamp only on last in group */}
                        {!nextIsSame && <span className="nv-ts">{fmt(msg.timestamp)}</span>}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Typing */}
              {isLoading && (
                <div className="nv-row ai first-in-group">
                  <div className="nv-mini-av"><Zap size={11} color="#fff" strokeWidth={2.5} /></div>
                  <div className="nv-bubble-wrap">
                    <div className="nv-bubble ai" style={{ padding:'6px 10px' }}><TypingIndicator /></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} style={{ height: 1 }} />
            </div>

            {/* Scroll-to-bottom FAB */}
            {showScrollBtn && (
              <button className="nv-scroll-fab" onClick={() => scrollToBottom()}>
                <ChevronDown size={13} />
                New messages
              </button>
            )}
          </div>

          {/* Input */}
          <div className="nv-input-area">
            <div className="nv-input-row">
              <input
                ref={inputRef}
                type="text"
                className="nv-input"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Nova anything…"
                disabled={isLoading}
                aria-label="Message input"
              />
              <button className="nv-send" onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()} aria-label="Send">
                <Send size={14} strokeWidth={2.2} />
              </button>
            </div>
            <p className="nv-hint">Nova · AI-Powered Assistant</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <button
        onClick={handleGhostTap}
        className="nv-ghost-btn nv-root"
        style={{ ['--nv-accent' as any]: accent, ['--nv-accent-rgb' as any]: accentRgb }}
        aria-label={isOpen ? 'Close Nova' : 'Open Nova'}
      >
        <GhostIcon size={72} isActive={isOpen} />
      </button>
      {ReactDOM.createPortal(portal, document.body)}
    </>
  );
};

export default ChatbotWidget;
