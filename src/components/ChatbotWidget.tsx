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
  <div className="nv-typing"><span /><span /><span /></div>
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
  // Track viewport height in state so panel height updates on resize/orientation change
  const [vh, setVh] = useState(() => window.innerHeight);
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
    const onResize = () => {
      setIsMobile(window.innerWidth < 1024);
      setVh(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!user?.uid) { setHistoryLoaded(true); return; }
    novaChatHistoryService.getHistory(user.uid)
      .then(h => { setMessages(h); setHistoryLoaded(true); })
      .catch(() => setHistoryLoaded(true));
  }, [user?.uid]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollBtn(false);
  };

  const isNearBottom = () => {
    const el = messagesRef.current;
    return !el || (el.scrollHeight - el.scrollTop - el.clientHeight < 100);
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
    setMessages(p => [...p, { id: `tmp-u-${Date.now()}`, text, sender: 'user', timestamp: new Date(), sessionId: sessionId.current }]);
    setInputMessage('');
    setIsLoading(true);
    setErrorDetails('');
    try {
      const res = await novaRAGService.sendMessage(text, user ?? null, sessionId.current, siteName);
      setMessages(p => [...p, { id: `tmp-a-${Date.now()}`, text: res.text, sender: 'ai', timestamp: new Date(), sessionId: sessionId.current }]);
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

  type DItem = { type: 'sep'; label: string; key: string } | { type: 'msg'; msg: NovaChatMessage };
  const items: DItem[] = [];
  let lastDate = '';
  for (const m of messages) {
    const ds = m.timestamp.toDateString();
    if (ds !== lastDate) { items.push({ type: 'sep', label: dateSep(m.timestamp), key: `sep-${ds}` }); lastDate = ds; }
    items.push({ type: 'msg', msg: m });
  }

  const accent = accentColor || '#6366f1';
  const accentRgb = (() => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '99,102,241';
  })();

  // Compute panel dimensions entirely in JS — no CSS calc() surprises
  const panelBottom = isMobile ? 160 : 104;
  const panelTopMargin = 20; // minimum gap from top of viewport
  const maxPanelH = isMobile ? 520 : 600;
  const panelH = Math.min(maxPanelH, vh - panelBottom - panelTopMargin);

  const portal = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        /* Ghost button */
        @keyframes nv-pulse {
          0%,100% { filter: drop-shadow(0 0 8px rgba(${accentRgb},0.5)) drop-shadow(0 4px 18px rgba(0,0,0,0.5)); }
          50%      { filter: drop-shadow(0 0 20px rgba(${accentRgb},0.8)) drop-shadow(0 8px 26px rgba(0,0,0,0.55)); }
        }
        .nv-ghost-btn {
          animation: nv-pulse 3.4s ease-in-out infinite;
          transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
          background: none !important; border: none !important; padding: 0 !important;
          cursor: pointer; display: block; width: 72px; height: 72px; outline: none;
        }
        .nv-ghost-btn:hover { animation: none; transform: scale(1.1); }

        /* Panel — height set via inline style in JS */
        .nv-panel {
          position: fixed;
          z-index: 49;
          right: 20px;
          width: 390px;
          /* height injected via style prop */
          display: flex;
          flex-direction: column;
          background: #09090b;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 22px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.75), 0 8px 24px rgba(0,0,0,0.5);
          overflow: hidden;
          transform-origin: bottom right;
          transition: opacity 0.22s ease, transform 0.28s cubic-bezier(.34,1.3,.64,1);
          font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
        }
        .nv-panel * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif; }
        .nv-panel.nv-open  { opacity: 1;  transform: scale(1)    translateY(0);    pointer-events: all; }
        .nv-panel.nv-close { opacity: 0;  transform: scale(0.94) translateY(12px); pointer-events: none; }

        @media (max-width: 1023px) {
          .nv-panel { left: 10px; right: 10px; width: auto; border-radius: 20px; }
        }

        /* Header — fixed size, never shrinks */
        .nv-hdr {
          flex-shrink: 0;
          display: flex; align-items: center; gap: 10px;
          padding: 13px 15px;
          background: #111113;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background-image: linear-gradient(135deg, rgba(${accentRgb},0.08) 0%, transparent 55%);
        }
        .nv-av {
          width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
          background: linear-gradient(135deg, ${accent}, rgba(${accentRgb},0.55));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 12px rgba(${accentRgb},0.4), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .nv-hinfo { flex: 1; min-width: 0; }
        .nv-hname { font-size: 13.5px; font-weight: 700; color: #fafafa; letter-spacing: -0.01em; line-height: 1.2; }
        .nv-hrow  { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
        .nv-dot   {
          width: 6px; height: 6px; border-radius: 50%; background: #22c55e;
          box-shadow: 0 0 6px rgba(34,197,94,0.7);
          animation: nv-dot 2.2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes nv-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(0.82)} }
        .nv-hsub { font-size: 10.5px; color: #52525b; font-weight: 500; }
        .nv-hbtns { display: flex; gap: 2px; flex-shrink: 0; }
        .nv-ibtn {
          width: 30px; height: 30px; border-radius: 8px;
          background: transparent; border: none; cursor: pointer; outline: none;
          display: flex; align-items: center; justify-content: center;
          color: #52525b; transition: background 0.12s, color 0.12s;
        }
        .nv-ibtn:hover { background: rgba(255,255,255,0.07); color: #fafafa; }

        /* Messages scroll area
           flex: 1 1 0 + min-height: 0 is THE pattern for scrollable flex children.
           The explicit height on the panel (set via inline style) gives flex something
           concrete to distribute from — this is what was missing before. */
        .nv-msgs {
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 14px 13px 6px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .nv-msgs::-webkit-scrollbar { width: 3px; }
        .nv-msgs::-webkit-scrollbar-track { background: transparent; }
        .nv-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

        /* Scroll FAB */
        .nv-fab {
          position: sticky; bottom: 4px; align-self: center; z-index: 2;
          background: #1f1f23; border: 1px solid rgba(255,255,255,0.1);
          color: #a1a1aa; border-radius: 20px; padding: 5px 11px 5px 9px;
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 600; cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
          animation: nv-fab-in 0.16s ease; white-space: nowrap;
          font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
        }
        @keyframes nv-fab-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

        /* Date separator */
        .nv-sep {
          display: flex; align-items: center; gap: 8px;
          margin: 10px 0 4px; flex-shrink: 0;
        }
        .nv-sep::before,.nv-sep::after { content:''; flex:1; height:1px; background: rgba(255,255,255,0.06); }
        .nv-sep span { font-size: 9.5px; color: #3f3f46; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }

        /* Message rows */
        .nv-row { display: flex; align-items: flex-end; gap: 7px; flex-shrink: 0; }
        .nv-row.user { flex-direction: row-reverse; }
        .nv-row.nv-fg { margin-top: 10px; }

        .nv-mav {
          width: 24px; height: 24px; border-radius: 8px; flex-shrink: 0; align-self: flex-end;
          background: linear-gradient(135deg, ${accent}, rgba(${accentRgb},0.6));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(${accentRgb},0.3);
        }
        .nv-mav.nv-hide { visibility: hidden; }

        .nv-bwrap { display: flex; flex-direction: column; gap: 2px; max-width: min(72%, 270px); }
        .nv-row.user .nv-bwrap { align-items: flex-end; }
        .nv-row.ai   .nv-bwrap { align-items: flex-start; }

        .nv-bbl {
          padding: 9px 13px; border-radius: 16px;
          font-size: 13.5px; line-height: 1.58; word-break: break-word; white-space: pre-wrap;
        }
        .nv-bbl.ai   { background: #18181b; border: 1px solid rgba(255,255,255,0.06); color: #fafafa; border-bottom-left-radius: 5px; }
        .nv-bbl.user { background: ${accent}; color: #fff; border-bottom-right-radius: 5px; box-shadow: 0 2px 12px rgba(${accentRgb},0.32); }
        .nv-ts { font-size: 9.5px; color: #3f3f46; padding: 0 3px; }

        /* Typing */
        .nv-typing { display: flex; gap: 4px; align-items: center; padding: 10px 13px; }
        .nv-typing span { width: 5px; height: 5px; border-radius: 50%; background: #52525b; display: block; animation: nv-bounce 1.3s ease-in-out infinite; }
        .nv-typing span:nth-child(2) { animation-delay: 0.17s; }
        .nv-typing span:nth-child(3) { animation-delay: 0.34s; }
        @keyframes nv-bounce { 0%,60%,100%{transform:translateY(0);opacity:0.35} 30%{transform:translateY(-5px);opacity:1} }

        /* Empty state */
        .nv-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px 16px; text-align:center; gap:14px; }
        .nv-eico { width:50px; height:50px; border-radius:16px; background:rgba(${accentRgb},0.1); border:1px solid rgba(${accentRgb},0.22); display:flex; align-items:center; justify-content:center; color:${accent}; }
        .nv-etit { font-size:14.5px; font-weight:700; color:#fafafa; margin-bottom:4px; }
        .nv-esub { font-size:12px; color:#52525b; line-height:1.55; max-width:210px; }
        .nv-chips { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-top:2px; }
        .nv-chip { padding:5px 10px; border-radius:18px; background:#18181b; border:1px solid rgba(255,255,255,0.1); color:#a1a1aa; font-size:11.5px; font-weight:500; cursor:pointer; transition:all 0.13s; white-space:nowrap; font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif; }
        .nv-chip:hover { background:rgba(${accentRgb},0.12); border-color:rgba(${accentRgb},0.32); color:#fafafa; }

        /* Shimmer */
        .nv-shims { display:flex; flex-direction:column; gap:10px; padding:4px 0; width:100%; }
        .nv-shim { height:38px; border-radius:14px; flex-shrink:0; background:linear-gradient(90deg,#18181b 0%,#1f1f23 50%,#18181b 100%); background-size:200% 100%; animation:nv-shim 1.5s infinite; }
        .nv-shim.s { width:50%; } .nv-shim.l { width:76%; align-self:flex-end; } .nv-shim.m { width:62%; }
        @keyframes nv-shim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* Input area — fixed size, never shrinks */
        .nv-inp-area {
          flex-shrink: 0;
          padding: 10px 12px 12px;
          background: #111113;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .nv-irow {
          display: flex; align-items: center; gap: 8px;
          background: #18181b; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; padding: 5px 5px 5px 13px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .nv-irow:focus-within { border-color: rgba(${accentRgb},0.5); box-shadow: 0 0 0 3px rgba(${accentRgb},0.1); }
        .nv-input {
          flex: 1; min-width: 0; background: transparent; border: none; outline: none;
          color: #fafafa; font-size: 13.5px; font-family: 'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;
          padding: 5px 0; line-height: 1.4;
        }
        .nv-input::placeholder { color: #3f3f46; }
        .nv-input:disabled { opacity: 0.4; }
        .nv-send {
          width: 34px; height: 34px; border-radius: 10px; border: none; cursor: pointer; outline: none;
          background: ${accent}; color: #fff; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s cubic-bezier(.34,1.56,.64,1), opacity 0.15s;
          box-shadow: 0 2px 10px rgba(${accentRgb},0.4);
        }
        .nv-send:hover:not(:disabled) { transform: scale(1.08); }
        .nv-send:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }
        .nv-hint { font-size: 10px; color: #3f3f46; text-align: center; margin: 7px 0 0; }

        /* Modals */
        .nv-ov { position:fixed; inset:0; z-index:51; background:rgba(0,0,0,0.72); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; animation:nv-fade 0.14s ease; font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif; }
        @keyframes nv-fade { from{opacity:0} to{opacity:1} }
        .nv-mdl { background:#111113; border:1px solid rgba(255,255,255,0.1); border-radius:20px; width:min(420px,100%); overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04); animation:nv-min 0.18s cubic-bezier(.34,1.3,.64,1); }
        @keyframes nv-min { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:none} }
        .nv-mdl * { box-sizing:border-box; font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif; }
        .nv-mhd { padding:15px 17px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; }
        .nv-mbd { padding:17px; display:flex; flex-direction:column; gap:11px; }
        .nv-card { background:#18181b; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:12px 13px; font-size:12.5px; color:#a1a1aa; line-height:1.6; }
        .nv-card strong { color:#fafafa; display:block; margin-bottom:5px; }
        .nv-pbtn { width:100%; padding:10px; border-radius:11px; border:none; cursor:pointer; background:${accent}; color:#fff; font-size:13.5px; font-weight:600; font-family:inherit; transition:opacity 0.13s; box-shadow:0 2px 10px rgba(${accentRgb},0.35); }
        .nv-pbtn:hover { opacity:0.87; }
        .nv-mibtn { width:30px; height:30px; border-radius:8px; background:transparent; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#52525b; transition:background 0.12s,color 0.12s; }
        .nv-mibtn:hover { background:rgba(255,255,255,0.07); color:#fafafa; }
      `}</style>

      {/* Info Modal */}
      {showInfo && (
        <div className="nv-ov" onClick={() => setShowInfo(false)}>
          <div className="nv-mdl" onClick={e => e.stopPropagation()}>
            <div className="nv-mhd">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Sparkles size={16} style={{ color: accent }} />
                <span style={{ color:'#fafafa', fontWeight:700, fontSize:14 }}>About Nova</span>
              </div>
              <button className="nv-mibtn" onClick={() => setShowInfo(false)}><X size={16} /></button>
            </div>
            <div className="nv-mbd">
              <p style={{ fontSize:12.5, color:'#a1a1aa', lineHeight:1.6, margin:0 }}>Nova is your AI assistant — here to help with platform questions, studies, scheduling, and anything else.</p>
              <div className="nv-card">
                <strong>✦ Capabilities</strong>
                <ul style={{ paddingLeft:14, margin:0, display:'flex', flexDirection:'column', gap:3 }}>
                  <li>Platform navigation & feature help</li><li>Study guidance & concept explanations</li>
                  <li>Assignment and schedule queries</li><li>Powered by Admin → AI Model Settings</li>
                </ul>
              </div>
              <div className="nv-card" style={{ borderColor:`rgba(${accentRgb},0.28)`, background:`rgba(${accentRgb},0.07)` }}>
                <strong style={{ color: accent }}>💡 Tip</strong>Be specific for the most accurate answers.
              </div>
              <button className="nv-pbtn" onClick={() => setShowInfo(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorDetails && (
        <div className="nv-ov" onClick={() => setErrorDetails('')}>
          <div className="nv-mdl" onClick={e => e.stopPropagation()}>
            <div className="nv-mhd">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <AlertTriangle size={16} style={{ color:'#f87171' }} />
                <span style={{ color:'#fafafa', fontWeight:700, fontSize:14 }}>Error Details</span>
              </div>
              <button className="nv-mibtn" onClick={() => setErrorDetails('')}><X size={16} /></button>
            </div>
            <div className="nv-mbd">
              <pre style={{ fontSize:11, color:'#f87171', background:'#18181b', padding:'12px', borderRadius:10, whiteSpace:'pre-wrap', overflowX:'auto', fontFamily:'ui-monospace,monospace', lineHeight:1.6, border:'1px solid rgba(255,255,255,0.06)', margin:0 }}>{errorDetails}</pre>
              <button className="nv-pbtn" onClick={() => setErrorDetails('')}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel — height set via inline style, computed in JS */}
      {isOpen && (
        <div
          className={`nv-panel ${isVisible ? 'nv-open' : 'nv-close'}`}
          style={{ bottom: panelBottom, height: panelH }}
          role="dialog"
          aria-label="Nova AI assistant"
        >
          {/* Header */}
          <div className="nv-hdr">
            <div className="nv-av"><Zap size={17} color="#fff" strokeWidth={2.5} /></div>
            <div className="nv-hinfo">
              <div className="nv-hname">Nova</div>
              <div className="nv-hrow">
                <div className="nv-dot" />
                <span className="nv-hsub">AI Assistant · Online</span>
              </div>
            </div>
            <div className="nv-hbtns">
              <button className="nv-ibtn" onClick={() => setShowInfo(true)} aria-label="About Nova"><Info size={15} /></button>
              <button className="nv-ibtn" onClick={() => setIsOpen(false)} aria-label="Close"><X size={15} /></button>
            </div>
          </div>

          {/* Messages — flex:1 min-height:0 overflow-y:auto */}
          <div
            className="nv-msgs"
            ref={messagesRef}
            onScroll={() => {
              const el = messagesRef.current;
              if (!el) return;
              setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
            }}
          >
            {!historyLoaded && (
              <div className="nv-shims">
                <div className="nv-shim s" /><div className="nv-shim l" />
                <div className="nv-shim m" /><div className="nv-shim s" />
              </div>
            )}

            {historyLoaded && messages.length === 0 && (
              <div className="nv-empty">
                <div className="nv-eico"><Sparkles size={22} /></div>
                <div>
                  <div className="nv-etit">Hi, I'm Nova ✦</div>
                  <div className="nv-esub">Your AI assistant. Ask anything about the platform, your studies, or anything else.</div>
                </div>
                <div className="nv-chips">
                  {['Submit an exam?', 'My schedule', 'Study help', 'Platform features'].map(q => (
                    <button key={q} className="nv-chip" onClick={() => { setInputMessage(q); inputRef.current?.focus(); }}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {historyLoaded && (() => {
              let prev: string | null = null;
              return items.map((item, idx) => {
                if (item.type === 'sep') { prev = null; return <div key={item.key} className="nv-sep"><span>{item.label}</span></div>; }
                const { msg } = item;
                const isFirst = msg.sender !== prev; prev = msg.sender;
                const next = items[idx + 1];
                const nextSame = next?.type === 'msg' && next.msg.sender === msg.sender;
                return (
                  <div key={msg.id} className={`nv-row ${msg.sender}${isFirst ? ' nv-fg' : ''}`}>
                    {msg.sender === 'ai' && <div className={`nv-mav${nextSame ? ' nv-hide' : ''}`}><Zap size={11} color="#fff" strokeWidth={2.5} /></div>}
                    <div className="nv-bwrap">
                      <div className={`nv-bbl ${msg.sender}`}>{msg.text}</div>
                      {!nextSame && <span className="nv-ts">{fmt(msg.timestamp)}</span>}
                    </div>
                  </div>
                );
              });
            })()}

            {isLoading && (
              <div className="nv-row ai nv-fg">
                <div className="nv-mav"><Zap size={11} color="#fff" strokeWidth={2.5} /></div>
                <div className="nv-bwrap"><div className="nv-bbl ai" style={{ padding:'7px 12px' }}><TypingIndicator /></div></div>
              </div>
            )}

            {showScrollBtn && (
              <button className="nv-fab" onClick={() => scrollToBottom()}>
                <ChevronDown size={13} /> New messages
              </button>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="nv-inp-area">
            <div className="nv-irow">
              <input ref={inputRef} type="text" className="nv-input" value={inputMessage}
                onChange={e => setInputMessage(e.target.value)} onKeyPress={handleKeyPress}
                placeholder="Ask Nova anything…" disabled={isLoading} aria-label="Message input" />
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
      <button onClick={handleGhostTap} className="nv-ghost-btn" aria-label={isOpen ? 'Close Nova' : 'Open Nova'}>
        <GhostIcon size={72} isActive={isOpen} />
      </button>
      {ReactDOM.createPortal(portal, document.body)}
    </>
  );
};

export default ChatbotWidget;
