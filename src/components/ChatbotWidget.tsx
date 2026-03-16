// src/components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Send, X, AlertTriangle, Info, ChevronDown } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { novaRAGService } from '../services/novaRAGService';
import { novaChatHistoryService, NovaChatMessage } from '../services/novaChatHistoryService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }

const HDR_H = 64;
const INP_H = 62;

// ── Inline Ghost SVG for the panel — floats with animation, themed to primary/accent
const PanelGhost: React.FC<{ primary: string; accent: string; size: number }> = ({ primary, accent, size }) => {
  function lighten(hex: string, f: number) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return hex;
    return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(c=>`0${Math.round(c+(255-c)*f).toString(16)}`.slice(-2)).join('')}`;
  }
  function darken(hex: string, f: number) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return hex;
    return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(c=>`0${Math.round(c*(1-f)).toString(16)}`.slice(-2)).join('')}`;
  }
  const bodyLight = lighten(primary, 0.38);
  const bodyMid   = lighten(primary, 0.20);
  const bodyDark  = darken(primary, 0.18);
  const uid = `pg-${size}`;
  return (
    <svg width={size} height={Math.round(size * 1.1)} viewBox="0 0 160 170" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ overflow:'visible', display:'block' }}>
      <defs>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={accent}  stopOpacity="0.55"/>
          <stop offset="100%" stopColor={accent}  stopOpacity="0"/>
        </radialGradient>
        <radialGradient id={`${uid}-body`} cx="38%" cy="20%" r="80%" fx="38%" fy="20%">
          <stop offset="0%"   stopColor={bodyLight}/>
          <stop offset="50%"  stopColor={bodyMid}/>
          <stop offset="100%" stopColor={bodyDark}/>
        </radialGradient>
        <filter id={`${uid}-f`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feFlood floodColor={accent} floodOpacity="0.38" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="cb"/>
          <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Ground shadow aura */}
      <ellipse cx="80" cy="164" rx="40" ry="7" fill={`url(#${uid}-glow)`}>
        <animate attributeName="rx"      values="40;50;40"  dur="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
      </ellipse>
      {/* Sparkle dots */}
      <circle cx="130" cy="36" r="3" fill={accent} opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.15;0.8" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="r"       values="3;4.5;3"      dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="144" cy="76" r="2" fill={bodyLight} opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2.3s" repeatCount="indefinite"/>
      </circle>
      <circle cx="16" cy="56" r="2.5" fill={accent} opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="22" cy="110" r="1.8" fill={bodyLight} opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.8s" repeatCount="indefinite"/>
      </circle>
      {/* Floating ghost body group */}
      <g filter={`url(#${uid}-f)`}>
        <animateTransform attributeName="transform" type="translate"
          values="0,0; 0,-13; 0,0" dur="2.5s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0.05 0.55 0.95;0.45 0.05 0.55 0.95"/>
        {/* Body with morph */}
        <path fill={`url(#${uid}-body)`}>
          <animate attributeName="d" dur="2s" repeatCount="indefinite" calcMode="spline"
            keySplines="0.5 0 0.5 1;0.5 0 0.5 1;0.5 0 0.5 1"
            values="
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,130 106,130 C100,130 96,152 80,152 C64,152 60,130 54,130 C48,130 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,128 106,128 C100,128 96,156 80,156 C64,156 60,128 54,128 C48,128 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,132 106,132 C100,132 96,149 80,149 C64,149 60,132 54,132 C48,132 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,130 106,130 C100,130 96,152 80,152 C64,152 60,130 54,130 C48,130 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z"/>
        </path>
        {/* Inner shine */}
        <ellipse cx="58" cy="42" rx="14" ry="18" fill="white" opacity="0.08"/>
        {/* Eyes */}
        <ellipse cx="60"  cy="72" rx="11.5" ry="12" fill="#0f0a1e"/>
        <ellipse cx="64"  cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.65"/>
        <ellipse cx="100" cy="72" rx="11.5" ry="12" fill="#0f0a1e"/>
        <ellipse cx="104" cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.65"/>
        {/* Smile */}
        <path d="M67,102 Q80,116 93,102" stroke="#0f0a1e" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.85"/>
        {/* Blush */}
        <ellipse cx="50"  cy="88" rx="10" ry="6" fill="#f472b6" opacity="0.18"/>
        <ellipse cx="110" cy="88" rx="10" ry="6" fill="#f472b6" opacity="0.18"/>
      </g>
    </svg>
  );
};

// ── Small ghost avatar for header + message bubbles
const MiniGhost: React.FC<{ size: number; primary: string; accent: string }> = ({ size, primary, accent }) => {
  function lighten(hex: string, f: number) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return hex;
    return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(c=>`0${Math.round(c+(255-c)*f).toString(16)}`.slice(-2)).join('')}`;
  }
  function darken(hex: string, f: number) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return hex;
    return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(c=>`0${Math.round(c*(1-f)).toString(16)}`.slice(-2)).join('')}`;
  }
  const uid = `mg-${size}`;
  const top  = lighten(primary, 0.42);
  const mid  = lighten(primary, 0.15);
  const bot  = darken(primary,  0.15);
  return (
    <svg width={size} height={size} viewBox="0 0 60 65" style={{ display:'block', overflow:'visible' }}>
      <defs>
        <radialGradient id={`${uid}-b`} cx="38%" cy="20%" r="80%">
          <stop offset="0%"   stopColor={top}/>
          <stop offset="50%"  stopColor={mid}/>
          <stop offset="100%" stopColor={bot}/>
        </radialGradient>
        <filter id={`${uid}-gf`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feFlood floodColor={accent} floodOpacity="0.45" result="c"/>
          <feComposite in="c" in2="blur" operator="in" result="cb"/>
          <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter={`url(#${uid}-gf)`}>
        <path fill={`url(#${uid}-b)`}
          d="M30,3 C42,3 52,13 52,26 C52,36 52,44 52,48 C52,52 48,52 46,52 C44,52 43,47 41,47 C39,47 38.5,57 30,57 C21.5,57 21,47 19,47 C17,47 16,52 14,52 C12,52 8,52 8,48 C8,44 8,36 8,26 C8,13 18,3 30,3 Z"/>
        <ellipse cx="21" cy="17" rx="5.5" ry="7.5" fill="white" opacity="0.1"/>
        <ellipse cx="22" cy="27" rx="4.5" ry="4.8" fill="#0f0a1e"/>
        <ellipse cx="24.5" cy="24.5" rx="1.5" ry="1.8" fill="white" opacity="0.7"/>
        <ellipse cx="38" cy="27" rx="4.5" ry="4.8" fill="#0f0a1e"/>
        <ellipse cx="40.5" cy="24.5" rx="1.5" ry="1.8" fill="white" opacity="0.7"/>
        <path d="M24,38 Q30,44 36,38" stroke="#0f0a1e" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85"/>
        <ellipse cx="16" cy="33" rx="4" ry="2.5" fill="#f472b6" opacity="0.2"/>
        <ellipse cx="44" cy="33" rx="4" ry="2.5" fill="#f472b6" opacity="0.2"/>
      </g>
    </svg>
  );
};

const TypingDots = ({ accent }: { accent: string }) => (
  <div style={{ display:'flex', gap:5, alignItems:'center', padding:'10px 14px' }}>
    {[0, 0.18, 0.36].map((delay, i) => (
      <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:accent, display:'block', opacity:0.5,
        animation:`aura-bounce 1.3s ease-in-out ${delay}s infinite` }}/>
    ))}
  </div>
);

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ eyeOffset: _eyeOffset }) => {
  const { accentColor, primaryColor, theme, user, siteName } = useDashboard();
  const [isOpen, setIsOpen]               = useState(false);
  const [messages, setMessages]           = useState<NovaChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [inputMessage, setInputMessage]   = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [errorDetails, setErrorDetails]   = useState('');
  const [showInfo, setShowInfo]           = useState(false);
  const [isVisible, setIsVisible]         = useState(false);
  const [isMobile, setIsMobile]           = useState(() => window.innerWidth < 1024);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [vh, setVh]                       = useState(() => window.innerHeight);

  const messagesRef    = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const tapCount       = useRef(0);
  const tapTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlying       = useRef(false);
  const sessionId      = useRef(Date.now().toString(36) + Math.random().toString(36).slice(2,8));

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(isOpen ? 'nova-chat-open' : 'nova-chat-close'));
  }, [isOpen]);

  useEffect(() => {
    const onResize = () => { setIsMobile(window.innerWidth < 1024); setVh(window.innerHeight); };
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

  useEffect(() => {
    const el = messagesRef.current;
    if (!el || (el.scrollHeight - el.scrollTop - el.clientHeight < 100)) scrollToBottom();
    else setShowScrollBtn(true);
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
      setTimeout(() => { scrollToBottom('instant' as ScrollBehavior); inputRef.current?.focus(); }, 80);
    } else { setIsVisible(false); }
  }, [isOpen]);

  useEffect(() => {
    const close = () => { isFlying.current = true; setIsOpen(false); };
    const land  = () => { isFlying.current = false; };
    window.addEventListener('ghost-close-chat', close);
    window.addEventListener('ghost-land', land);
    return () => { window.removeEventListener('ghost-close-chat', close); window.removeEventListener('ghost-land', land); };
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    const text = inputMessage.trim();
    setMessages(p => [...p, { id:`tmp-u-${Date.now()}`, text, sender:'user', timestamp:new Date(), sessionId:sessionId.current }]);
    setInputMessage(''); setIsLoading(true); setErrorDetails('');
    try {
      const res = await novaRAGService.sendMessage(text, user ?? null, sessionId.current, siteName);
      setMessages(p => [...p, { id:`tmp-a-${Date.now()}`, text:res.text, sender:'ai', timestamp:new Date(), sessionId:sessionId.current }]);
      if (res.navigateTo) {
        setIsOpen(false); setIsVisible(false); isFlying.current = false;
        window.dispatchEvent(new CustomEvent('nova-navigate', { detail:{ path:res.navigateTo } }));
        setTimeout(() => window.dispatchEvent(new CustomEvent('ghost-land')), 300);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorDetails(`Error: ${msg}\n\nPossible causes:\n1. No AI key configured (Admin → AI Model Settings → 'chatbot' group)\n2. No vector key configured (Admin → AI Model Settings → 'vector' group)\n3. CORS blocking\n4. Network issue\n5. Rate limit exceeded — failover exhausted`);
      setMessages(p => [...p, { id:`tmp-e-${Date.now()}`, text:'Something went wrong. Tap the info icon for details.', sender:'ai', timestamp:new Date(), sessionId:sessionId.current }]);
    } finally { setIsLoading(false); }
  };

  const handleGhostTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      if (!isOpen) window.dispatchEvent(new CustomEvent('ghost-fly'));
    } else {
      tapTimer.current = setTimeout(() => {
        if (tapCount.current === 1 && !isFlying.current) setIsOpen(p => !p);
        tapCount.current = 0;
      }, 200);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) handleSendMessage();
  };

  const fmt     = (d: Date) => d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const dateSep = (d: Date) => {
    const t = new Date(), y = new Date(t); y.setDate(y.getDate()-1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month:'short', day:'numeric' });
  };

  type DItem = { type:'sep'; label:string; key:string } | { type:'msg'; msg:NovaChatMessage };
  const items: DItem[] = [];
  let lastDate = '';
  for (const m of messages) {
    const ds = m.timestamp.toDateString();
    if (ds !== lastDate) { items.push({ type:'sep', label:dateSep(m.timestamp), key:`sep-${ds}` }); lastDate = ds; }
    items.push({ type:'msg', msg:m });
  }

  // Colors — always dark-onboarding style regardless of app theme
  const accent   = accentColor  || '#c084fc';
  const primary  = primaryColor || '#7c3aed';
  const ar = (() => { const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent);  return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'192,132,252'; })();
  const pr = (() => { const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primary); return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'124,58,237'; })();

  // Dark onboarding palette — always dark
  const panelBg    = 'rgba(14,8,28,0.97)';
  const panelBdr   = `rgba(${pr},0.28)`;
  const surf2      = 'rgba(255,255,255,0.05)';
  const surf3      = 'rgba(255,255,255,0.08)';
  const txtPri     = '#f1f0ff';
  const txtMut     = '#a79fc0';
  const txtDim     = '#6b5f8a';
  const bbAi       = 'rgba(255,255,255,0.06)';
  const bbAiBdr    = `rgba(${pr},0.25)`;
  const gradient   = `linear-gradient(135deg,${primary} 0%,${accent} 100%)`;
  const userBubble = gradient;

  const panelBottom = isMobile ? 156 : 100;
  const topMargin   = 16;
  const maxPanelH   = isMobile ? 460 : 580;
  const panelH      = Math.min(maxPanelH, vh - panelBottom - topMargin);
  const panelW      = isMobile ? Math.min(340, window.innerWidth - 20) : 380;
  const panelRight  = isMobile ? 10 : 20;

  // App theme for modals (they follow app theme)
  const appDark  = theme !== 'light';
  const modalBg  = appDark ? 'rgba(13,16,23,0.98)' : 'rgba(255,255,255,0.97)';
  const modalBdr = appDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
  const mTxtPri  = appDark ? '#f1f5f9' : '#111827';
  const mTxtMut  = appDark ? '#94a3b8' : '#6b7280';
  const mTxtDim  = appDark ? '#475569' : '#9ca3af';
  const mSurf2   = appDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const mSurf3   = appDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  const portal = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');

        @keyframes aura-bounce   { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes aura-pulse    { 0%,100%{filter:drop-shadow(0 0 8px rgba(${ar},.55)) drop-shadow(0 4px 18px rgba(0,0,0,.5))} 50%{filter:drop-shadow(0 0 22px rgba(${ar},.85)) drop-shadow(0 8px 28px rgba(0,0,0,.55))} }
        @keyframes aura-fade     { from{opacity:0} to{opacity:1} }
        @keyframes aura-in       { from{opacity:0;transform:scale(0.93) translateY(12px)} to{opacity:1;transform:none} }
        @keyframes aura-shim     { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes aura-dot      { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        @keyframes aura-fab      { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes aura-star-spin{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        .nvchat-ghost { animation:aura-pulse 3.4s ease-in-out infinite; transition:transform .18s cubic-bezier(.34,1.56,.64,1); background:none!important; border:none!important; padding:0!important; cursor:pointer; display:block; width:72px; height:72px; outline:none }
        .nvchat-ghost:hover { animation:none; transform:scale(1.1) }

        .nvchat-msgs {
          overflow-y:auto!important;
          overflow-x:hidden;
          touch-action:pan-y;
          -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain;
        }
        .nvchat-msgs::-webkit-scrollbar { width:3px }
        .nvchat-msgs::-webkit-scrollbar-track { background:transparent }
        .nvchat-msgs::-webkit-scrollbar-thumb { background:rgba(${pr},0.35); border-radius:3px }

        .nvchat-inp-field { outline:none!important; -webkit-tap-highlight-color:transparent!important; box-shadow:none!important }
        .nvchat-inp-field:focus { outline:none!important; box-shadow:none!important }
        .nvchat-inp-field::placeholder { color:${txtDim} }

        .aura-ibtn { transition:background .12s,color .12s }
        .aura-ibtn:hover { background:rgba(255,255,255,0.08)!important; color:${txtPri}!important }
        .aura-ibtn-close:hover { background:rgba(239,68,68,.15)!important; color:#f87171!important }

        .aura-chip { transition:background .15s,border-color .15s,transform .12s }
        .aura-chip:hover { background:rgba(${pr},0.22)!important; border-color:rgba(${pr},0.5)!important; transform:translateY(-1px) }

        .aura-send-btn { transition:transform .15s cubic-bezier(.34,1.56,.64,1), opacity .15s, box-shadow .15s }
        .aura-send-btn:hover:not(:disabled) { transform:scale(1.1)!important }
      `}</style>

      {/* ── Info Modal ── */}
      {showInfo && (
        <div onClick={()=>setShowInfo(false)} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'aura-fade .14s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:modalBg,backdropFilter:'blur(32px)',border:`1px solid ${modalBdr}`,borderRadius:22,width:'min(400px,100%)',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,.8)',animation:'aura-in .18s cubic-bezier(.34,1.3,.64,1)' }}>
            <div style={{ padding:'14px 16px',borderBottom:`1px solid ${modalBdr}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:28,height:28,borderRadius:9,background:gradient,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden' }}>
                  <MiniGhost size={22} primary={primary} accent={accent}/>
                </div>
                <span style={{ color:mTxtPri,fontWeight:700,fontSize:14,fontFamily:"'Sora',sans-serif" }}>About Aura</span>
              </div>
              <button onClick={()=>setShowInfo(false)} className="aura-ibtn" style={{ width:28,height:28,borderRadius:8,background:mSurf3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:mTxtDim }}><X size={14}/></button>
            </div>
            <div style={{ padding:16,display:'flex',flexDirection:'column',gap:10 }}>
              <p style={{ fontSize:13,color:mTxtMut,lineHeight:1.65,margin:0 }}>Aura is your AI assistant — here to help with platform questions, studies, scheduling, and anything else.</p>
              <div style={{ background:mSurf2,border:`1px solid ${modalBdr}`,borderRadius:12,padding:'12px 14px',fontSize:12.5,color:mTxtMut,lineHeight:1.6 }}>
                <strong style={{ color:mTxtPri,display:'block',marginBottom:6 }}>✦ Capabilities</strong>
                <ul style={{ paddingLeft:15,margin:0,display:'flex',flexDirection:'column',gap:4 }}>
                  <li>Platform navigation & feature help</li>
                  <li>Study guidance & concept explanations</li>
                  <li>Assignment and schedule queries</li>
                  <li>Powered by Admin → AI Model Settings</li>
                </ul>
              </div>
              <div style={{ background:`rgba(${pr},.08)`,border:`1px solid rgba(${pr},.28)`,borderRadius:12,padding:'11px 14px',fontSize:12.5,color:mTxtMut,lineHeight:1.6 }}>
                <strong style={{ color:accent,display:'block',marginBottom:4 }}>💡 Tip</strong>Be specific for the most accurate answers.
              </div>
              <button onClick={()=>setShowInfo(false)} style={{ width:'100%',padding:'10px',borderRadius:12,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:`0 4px 14px rgba(${pr},.45)` }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Modal ── */}
      {errorDetails && (
        <div onClick={()=>setErrorDetails('')} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'aura-fade .14s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:modalBg,backdropFilter:'blur(32px)',border:`1px solid ${modalBdr}`,borderRadius:22,width:'min(400px,100%)',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,.8)',animation:'aura-in .18s cubic-bezier(.34,1.3,.64,1)' }}>
            <div style={{ padding:'14px 16px',borderBottom:`1px solid ${modalBdr}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}><AlertTriangle size={15} style={{ color:'#f87171' }}/><span style={{ color:mTxtPri,fontWeight:700,fontSize:14 }}>Error Details</span></div>
              <button onClick={()=>setErrorDetails('')} className="aura-ibtn" style={{ width:28,height:28,borderRadius:8,background:mSurf3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:mTxtDim }}><X size={14}/></button>
            </div>
            <div style={{ padding:16,display:'flex',flexDirection:'column',gap:10 }}>
              <pre style={{ fontSize:11,color:'#f87171',background:mSurf2,padding:12,borderRadius:10,whiteSpace:'pre-wrap',overflowX:'auto',fontFamily:'ui-monospace,monospace',lineHeight:1.6,border:`1px solid ${modalBdr}`,margin:0 }}>{errorDetails}</pre>
              <button onClick={()=>setErrorDetails('')} style={{ width:'100%',padding:'10px',borderRadius:12,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Panel ── */}
      {isOpen && (
        <div
          style={{
            position:'fixed', zIndex:9999,
            right:panelRight, bottom:panelBottom,
            width:panelW, height:panelH,
            background:panelBg,
            backdropFilter:'blur(40px) saturate(200%)',
            WebkitBackdropFilter:'blur(40px) saturate(200%)',
            border:`1px solid ${panelBdr}`,
            borderRadius:26,
            boxShadow:`0 0 0 1px rgba(${pr},0.12), 0 28px 70px rgba(0,0,0,0.9), 0 8px 28px rgba(${pr},0.15), inset 0 1px 0 rgba(255,255,255,0.06)`,
            overflow:'hidden',
            transformOrigin:'bottom right',
            transition:'opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.3,0.64,1)',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(14px)',
            pointerEvents: isVisible ? 'all' : 'none',
            fontFamily:"'Outfit',sans-serif",
          }}
          role="dialog"
          aria-label="Aura AI assistant"
          onTouchStart={e => e.stopPropagation()}
        >
          {/* Deep purple radial glow top */}
          <div style={{ position:'absolute',top:-60,left:'50%',transform:'translateX(-50%)',width:260,height:180,borderRadius:'50%',
            background:`radial-gradient(circle, rgba(${pr},0.35) 0%, transparent 70%)`,
            pointerEvents:'none', zIndex:0, filter:'blur(28px)' }}/>
          {/* Accent glow bottom-right corner */}
          <div style={{ position:'absolute',bottom:-40,right:-40,width:180,height:180,borderRadius:'50%',
            background:`radial-gradient(circle, rgba(${ar},0.18) 0%, transparent 70%)`,
            pointerEvents:'none', zIndex:0, filter:'blur(24px)' }}/>
          {/* Subtle star grid */}
          <div style={{ position:'absolute',inset:0,pointerEvents:'none',zIndex:0,
            background:`radial-gradient(circle at 20% 20%, rgba(${pr},0.06) 0%, transparent 50%),
                        radial-gradient(circle at 80% 80%, rgba(${ar},0.05) 0%, transparent 50%)`,
            opacity:0.8 }}/>

          {/* ── Header ── */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:HDR_H, zIndex:2,
            display:'flex', alignItems:'center', gap:11, padding:'0 14px',
            background:'rgba(14,8,28,0.85)',
            backgroundImage:`linear-gradient(135deg,rgba(${pr},0.14) 0%,transparent 60%)`,
            borderBottom:`1px solid rgba(${pr},0.25)`,
            backdropFilter:'blur(20px)',
          }}>
            {/* Ghost avatar pill */}
            <div style={{
              width:40, height:40, borderRadius:14, flexShrink:0,
              background:`linear-gradient(135deg,rgba(${pr},0.35),rgba(${ar},0.22))`,
              border:`1px solid rgba(${pr},0.45)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              overflow:'hidden',
              boxShadow:`0 0 16px rgba(${pr},0.35), inset 0 1px 0 rgba(255,255,255,0.1)`
            }}>
              <MiniGhost size={30} primary={primary} accent={accent}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#f1f0ff', letterSpacing:'-0.01em', lineHeight:1.2, fontFamily:"'Sora',sans-serif" }}>Aura</div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80',
                  boxShadow:'0 0 8px rgba(74,222,128,.8)', flexShrink:0, display:'inline-block',
                  animation:'aura-dot 2.2s ease-in-out infinite' }}/>
                <span style={{ fontSize:10.5, color:txtDim, fontWeight:500, letterSpacing:'0.02em' }}>AI Assistant · Online</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:2, flexShrink:0 }}>
              <button onClick={()=>setShowInfo(true)} className="aura-ibtn" style={{ width:30,height:30,borderRadius:9,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}><Info size={13}/></button>
              <button onClick={()=>setIsOpen(false)} className="aura-ibtn aura-ibtn-close" style={{ width:30,height:30,borderRadius:9,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}><X size={13}/></button>
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            className="nvchat-msgs"
            ref={messagesRef}
            style={{ position:'absolute', top:HDR_H, bottom:INP_H, left:0, right:0, zIndex:1, padding:'14px 13px 8px' }}
            onScroll={()=>{ const el=messagesRef.current; if(!el) return; setShowScrollBtn(el.scrollHeight-el.scrollTop-el.clientHeight>100); }}
          >
            {/* Shimmer loading */}
            {!historyLoaded && (
              <div style={{ display:'flex',flexDirection:'column',gap:10,padding:'4px 0' }}>
                {[['52%','flex-start'],['68%','flex-end'],['56%','flex-start'],['44%','flex-end']].map(([w,a],i)=>(
                  <div key={i} style={{ height:36,width:w as string,alignSelf:a as any,borderRadius:14,
                    background:`linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(${pr},0.12) 50%,rgba(255,255,255,0.04) 100%)`,
                    backgroundSize:'200% 100%',animation:'aura-shim 1.5s infinite' }}/>
                ))}
              </div>
            )}

            {/* ── Empty state — Dark Onboarding style ── */}
            {historyLoaded && messages.length === 0 && (
              <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 20px',textAlign:'center',gap:0 }}>
                {/* Floating ghost hero */}
                <div style={{ marginBottom:18 }}>
                  <PanelGhost primary={primary} accent={accent} size={110}/>
                </div>
                {/* Tagline */}
                <div style={{ fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:700,color:'#f1f0ff',lineHeight:1.25,marginBottom:8 }}>
                  Hi, I'm <span style={{ color:accent }}>Aura</span> ✦
                </div>
                <div style={{ fontSize:12.5,color:txtMut,lineHeight:1.6,maxWidth:220,marginBottom:20 }}>
                  Your AI assistant. Ask anything about the platform, your studies, or anything else.
                </div>
                {/* Quick-action chips */}
                <div style={{ display:'flex',flexWrap:'wrap',gap:7,justifyContent:'center' }}>
                  {['Submit an exam?','My schedule','Study help','Platform features'].map(q=>(
                    <button key={q} className="aura-chip"
                      onClick={()=>{ setInputMessage(q); inputRef.current?.focus(); }}
                      style={{
                        padding:'6px 12px', borderRadius:20,
                        background:`rgba(${pr},0.14)`,
                        border:`1px solid rgba(${pr},0.32)`,
                        color:txtMut, fontSize:11.5, fontWeight:500,
                        cursor:'pointer', whiteSpace:'nowrap',
                        fontFamily:"'Outfit',sans-serif"
                      }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Message list ── */}
            {historyLoaded && (() => {
              let prev: string|null = null;
              return items.map((item, idx) => {
                if (item.type === 'sep') {
                  prev = null;
                  return (
                    <div key={item.key} style={{ display:'flex',alignItems:'center',gap:8,margin:'12px 0 5px' }}>
                      <div style={{ flex:1,height:1,background:`rgba(${pr},0.2)` }}/>
                      <span style={{ fontSize:9.5,color:txtDim,fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',whiteSpace:'nowrap' }}>{item.label}</span>
                      <div style={{ flex:1,height:1,background:`rgba(${pr},0.2)` }}/>
                    </div>
                  );
                }
                const { msg } = item;
                const isFirst = msg.sender !== prev; prev = msg.sender;
                const next = items[idx+1];
                const nextSame = next?.type==='msg' && next.msg.sender===msg.sender;
                return (
                  <div key={msg.id} style={{ display:'flex',alignItems:'flex-end',gap:7,flexDirection:msg.sender==='user'?'row-reverse':'row',marginBottom:4,marginTop:isFirst?10:0 }}>
                    {msg.sender==='ai' && (
                      <div style={{
                        width:26, height:26, borderRadius:9, flexShrink:0, alignSelf:'flex-end',
                        background:`linear-gradient(135deg,rgba(${pr},0.35),rgba(${ar},0.22))`,
                        border:`1px solid rgba(${pr},0.38)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        overflow:'hidden',
                        boxShadow:`0 0 10px rgba(${pr},0.25)`,
                        visibility: nextSame ? 'hidden' : 'visible'
                      }}>
                        <MiniGhost size={20} primary={primary} accent={accent}/>
                      </div>
                    )}
                    <div style={{ display:'flex',flexDirection:'column',gap:2,maxWidth:'min(72%,260px)',alignItems:msg.sender==='user'?'flex-end':'flex-start' }}>
                      <div style={{
                        padding:'9px 12px', borderRadius:15, fontSize:13, lineHeight:1.58,
                        wordBreak:'break-word', whiteSpace:'pre-wrap',
                        ...(msg.sender==='ai'
                          ? { background:bbAi, border:`1px solid ${bbAiBdr}`, color:txtPri, borderBottomLeftRadius:4 }
                          : { background:userBubble, color:'#fff', borderBottomRightRadius:4, boxShadow:`0 2px 12px rgba(${ar},0.35)` }
                        )
                      }}>{msg.text}</div>
                      {!nextSame && <span style={{ fontSize:9.5,color:txtDim,padding:'0 3px' }}>{fmt(msg.timestamp)}</span>}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display:'flex',alignItems:'flex-end',gap:7,marginTop:10 }}>
                <div style={{ width:26,height:26,borderRadius:9,flexShrink:0,
                  background:`linear-gradient(135deg,rgba(${pr},0.35),rgba(${ar},0.22))`,
                  border:`1px solid rgba(${pr},0.38)`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  overflow:'hidden', boxShadow:`0 0 10px rgba(${pr},0.25)` }}>
                  <MiniGhost size={20} primary={primary} accent={accent}/>
                </div>
                <div style={{ background:bbAi,border:`1px solid ${bbAiBdr}`,borderRadius:15,borderBottomLeftRadius:4 }}>
                  <TypingDots accent={accent}/>
                </div>
              </div>
            )}

            {/* Scroll to bottom FAB */}
            {showScrollBtn && (
              <button onClick={()=>scrollToBottom()} style={{
                position:'sticky', bottom:4, display:'flex', alignSelf:'center',
                alignItems:'center', gap:5, padding:'5px 12px 5px 10px',
                borderRadius:20, background:'rgba(14,8,28,0.96)',
                border:`1px solid rgba(${pr},0.35)`, color:txtMut,
                fontSize:11.5, fontWeight:600, cursor:'pointer',
                boxShadow:`0 4px 18px rgba(0,0,0,.7), 0 0 12px rgba(${pr},0.2)`,
                animation:'aura-fab .16s ease', whiteSpace:'nowrap',
                fontFamily:"'Outfit',sans-serif", margin:'4px auto 0'
              }}>
                <ChevronDown size={12}/> New messages
              </button>
            )}

            <div ref={messagesEndRef}/>
          </div>

          {/* ── Input bar ── */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:INP_H, zIndex:2,
            padding:'10px 12px 11px',
            background:'rgba(14,8,28,0.90)',
            borderTop:`1px solid rgba(${pr},0.22)`,
            backdropFilter:'blur(20px)',
            display:'flex', flexDirection:'column', gap:5,
          }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.05)',border:`1px solid rgba(${pr},0.25)`,borderRadius:14,padding:'5px 5px 5px 13px' }}>
              <input
                ref={inputRef}
                type="text"
                className="nvchat-inp-field"
                value={inputMessage}
                onChange={e=>setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Aura anything…"
                disabled={isLoading}
                aria-label="Message input"
                style={{ flex:1,minWidth:0,background:'transparent',border:'none',color:txtPri,fontSize:13,fontFamily:"'Outfit',sans-serif",padding:'4px 0',lineHeight:1.4,outline:'none',WebkitTapHighlightColor:'transparent' }}
              />
              <button
                className="aura-send-btn"
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
                style={{
                  width:33, height:33, borderRadius:10, border:'none', cursor:'pointer',
                  background: (!isLoading && inputMessage.trim()) ? gradient : 'rgba(255,255,255,0.07)',
                  color:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  opacity: (!isLoading && inputMessage.trim()) ? 1 : 0.35,
                  boxShadow: (!isLoading && inputMessage.trim()) ? `0 2px 12px rgba(${pr},.55)` : 'none',
                }}
              >
                <Send size={13} strokeWidth={2.2}/>
              </button>
            </div>
            <p style={{ fontSize:9.5,color:txtDim,textAlign:'center',margin:0,fontFamily:"'Outfit',sans-serif",letterSpacing:'0.03em' }}>
              Aura · AI-Powered Assistant
            </p>
          </div>

        </div>
      )}
    </>
  );

  return (
    <>
      <button onClick={handleGhostTap} className="nvchat-ghost" aria-label={isOpen?'Close Aura':'Open Aura'}>
        <GhostIcon size={72} isActive={isOpen}/>
      </button>
      {ReactDOM.createPortal(portal, document.body)}
    </>
  );
};

export default ChatbotWidget;
