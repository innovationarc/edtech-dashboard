// src/components/ChatbotWidget.tsx 
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Send, X, AlertTriangle, Info, Sparkles, ChevronDown } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { novaRAGService } from '../services/novaRAGService';
import { novaChatHistoryService, NovaChatMessage } from '../services/novaChatHistoryService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }

// Fixed pixel heights — MUST match .nvchat-hdr and .nvchat-inp heights in CSS
const HDR_H = 58;
const INP_H = 60;

// ── Ghost Avatar ── renders the ghost head scaled for header/bubble use
// dark=true  → deep purple body (for dark mode panel)
// dark=false → lavender-to-white body (for light mode panel)
const GhostAvatar: React.FC<{ size: number; dark: boolean; primary: string; accent: string }> = ({ size, dark, primary, accent }) => {
  // Derive body gradient stops from primaryColor
  function lighten(hex: string, f: number) {
    const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return hex;
    const blend=(c:number)=>Math.round(c+(255-c)*f);
    return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(c=>`0${blend(c).toString(16)}`.slice(-2)).join('')}`;
  }
  function darken(hex: string, f: number) {
    const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) return hex;
    const blend=(c:number)=>Math.round(c*(1-f));
    return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(c=>`0${blend(c).toString(16)}`.slice(-2)).join('')}`;
  }

  // Light mode: white/lavender feel  |  Dark mode: rich primary-toned ghost
  const bodyTop    = dark ? lighten(primary, 0.30) : '#ffffff';
  const bodyMid    = dark ? lighten(primary, 0.10) : lighten(primary, 0.55);
  const bodyBottom = dark ? darken(primary, 0.18)  : lighten(primary, 0.30);
  const eyeColor   = dark ? '#0f0a1e'              : '#1a1a2e';
  const glowColor  = dark ? accent                 : primary;
  const uid = `ga-${size}-${dark?'d':'l'}`;

  return (
    <svg width={size} height={size} viewBox="0 0 60 65" style={{ overflow:'visible', display:'block', flexShrink:0 }}>
      <defs>
        <radialGradient id={`${uid}-body`} cx="38%" cy="22%" r="78%">
          <stop offset="0%"   stopColor={bodyTop}    />
          <stop offset="48%"  stopColor={bodyMid}    />
          <stop offset="100%" stopColor={bodyBottom} />
        </radialGradient>
        <radialGradient id={`${uid}-aura`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={glowColor} stopOpacity="0.45"/>
          <stop offset="100%" stopColor={glowColor} stopOpacity="0"  />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feFlood floodColor={glowColor} floodOpacity={dark ? '0.4' : '0.25'} result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="cb"/>
          <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* subtle aura disk behind the ghost */}
      <ellipse cx="30" cy="61" rx="16" ry="4" fill={`url(#${uid}-aura)`}/>
      <g filter={`url(#${uid}-glow)`}>
        {/* Ghost body — same path family as GhostIcon.tsx */}
        <path fill={`url(#${uid}-body)`}
          d="M30,3 C42,3 52,12 52,26 C52,36 52,43 52,48 C52,52 48,52 46,52 C44,52 43,47 41,47 C39,47 38.5,57 30,57 C21.5,57 21,47 19,47 C17,47 16,52 14,52 C12,52 8,52 8,48 C8,43 8,36 8,26 C8,12 18,3 30,3 Z"/>
        {/* Light inner highlight on body — adds depth in both modes */}
        <ellipse cx="22" cy="18" rx="6" ry="8"
          fill="white" opacity={dark ? 0.07 : 0.45}/>
        {/* Eyes */}
        <ellipse cx="22" cy="27" rx="4.5" ry="4.8" fill={eyeColor}/>
        <ellipse cx="24.5" cy="24.8" rx="1.5" ry="1.8" fill="white" opacity="0.7"/>
        <ellipse cx="38" cy="27" rx="4.5" ry="4.8" fill={eyeColor}/>
        <ellipse cx="40.5" cy="24.8" rx="1.5" ry="1.8" fill="white" opacity="0.7"/>
        {/* Smile */}
        <path d="M24,38 Q30,44 36,38" stroke={eyeColor} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.8"/>
        {/* Blush — soft cheek tint */}
        <ellipse cx="17" cy="33" rx="4" ry="2.5" fill={dark ? '#f472b6' : primary} opacity="0.15"/>
        <ellipse cx="43" cy="33" rx="4" ry="2.5" fill={dark ? '#f472b6' : primary} opacity="0.15"/>
      </g>
    </svg>
  );
};

const TypingDots = () => (
  <div style={{ display:'flex', gap:4, alignItems:'center', padding:'9px 12px' }}>
    {[0,0.17,0.34].map((delay,i) => (
      <span key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#475569', display:'block', animation:`nvchat-bounce 1.3s ease-in-out ${delay}s infinite` }}/>
    ))}
  </div>
);

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ eyeOffset }) => {
  const { accentColor, primaryColor, theme, user, siteName } = useDashboard();
  const [isOpen, setIsOpen]           = useState(false);
  const [messages, setMessages]       = useState<NovaChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [showInfo, setShowInfo]       = useState(false);
  const [isVisible, setIsVisible]     = useState(false);
  const [isMobile, setIsMobile]       = useState(() => window.innerWidth < 1024);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [vh, setVh]                   = useState(() => window.innerHeight);

  const messagesRef    = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const tapCount       = useRef(0);
  const tapTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlying       = useRef(false);
  const sessionId      = useRef(Date.now().toString(36) + Math.random().toString(36).slice(2,8));

  // Notify DashboardLayout so it blocks ghost drag while panel is open
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
      if (!isOpen) window.dispatchEvent(new CustomEvent('ghost-fly')); // no fly when chat open
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

  const dark    = theme !== 'light';
  const accent  = accentColor  || '#6366f1';
  const primary = primaryColor || accent;
  const ar = (() => { const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent);  return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'99,102,241'; })();
  const pr = (() => { const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primary); return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'99,102,241'; })();
  const gradient = `linear-gradient(135deg,${primary} 0%,${accent} 100%)`;

  // Exact same color values as Navigation.tsx sidebar
  const bg      = dark ? 'rgba(13,16,23,0.98)'           : 'rgba(255,255,255,0.97)';
  const border  = dark ? 'rgba(255,255,255,0.06)'         : 'rgba(0,0,0,0.08)';
  const surf2   = dark ? 'rgba(255,255,255,0.05)'         : 'rgba(0,0,0,0.04)';
  const surf3   = dark ? 'rgba(255,255,255,0.07)'         : 'rgba(0,0,0,0.05)';
  const txtPri  = dark ? '#f1f5f9'                        : '#111827';
  const txtMut  = dark ? '#94a3b8'                        : '#6b7280';
  const txtDim  = dark ? '#475569'                        : '#9ca3af';
  const bbAi    = dark ? 'rgba(255,255,255,0.06)'         : 'rgba(0,0,0,0.05)';
  const bbAiBdr = dark ? 'rgba(255,255,255,0.08)'         : 'rgba(0,0,0,0.08)';

  // All dimensions in JS — bulletproof, no CSS calc
  const panelBottom = isMobile ? 156 : 100;
  const topMargin   = 16;
  const maxPanelH   = isMobile ? 450 : 560;
  const panelH      = Math.min(maxPanelH, vh - panelBottom - topMargin);
  const panelW      = isMobile ? Math.min(330, window.innerWidth - 20) : 370;
  const panelRight  = isMobile ? 10 : 20;

  const portal = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        @keyframes nvchat-bounce{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-5px);opacity:1}}
        @keyframes nvchat-pulse{0%,100%{filter:drop-shadow(0 0 8px rgba(${ar},.5)) drop-shadow(0 4px 18px rgba(0,0,0,.5))}50%{filter:drop-shadow(0 0 20px rgba(${ar},.8)) drop-shadow(0 8px 26px rgba(0,0,0,.55))}}
        @keyframes nvchat-fade{from{opacity:0}to{opacity:1}}
        @keyframes nvchat-min{from{opacity:0;transform:scale(0.93) translateY(10px)}to{opacity:1;transform:none}}
        @keyframes nvchat-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes nvchat-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.82)}}
        @keyframes nvchat-fab{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}

        .nvchat-ghost{animation:nvchat-pulse 3.4s ease-in-out infinite;transition:transform .18s cubic-bezier(.34,1.56,.64,1);background:none!important;border:none!important;padding:0!important;cursor:pointer;display:block;width:72px;height:72px;outline:none}
        .nvchat-ghost:hover{animation:none;transform:scale(1.1)}

        /* Messages scroll — touch-action:pan-y enables native scroll, stops ghost drag */
        .nvchat-msgs{
          overflow-y:auto!important;
          overflow-x:hidden;
          touch-action:pan-y;
          -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain;
        }
        .nvchat-msgs::-webkit-scrollbar{width:3px}
        .nvchat-msgs::-webkit-scrollbar-track{background:transparent}
        .nvchat-msgs::-webkit-scrollbar-thumb{background:${dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)'};border-radius:3px}

        /* Kill focus ring on input */
        .nvchat-inp-field{outline:none!important;-webkit-tap-highlight-color:transparent!important;box-shadow:none!important}
        .nvchat-inp-field:focus{outline:none!important;box-shadow:none!important}

        /* Hover states for icon buttons */
        .nvchat-ibtn{transition:background .12s,color .12s}
        .nvchat-ibtn:hover{background:${surf3}!important;color:${txtPri}!important}
        .nvchat-ibtn-close:hover{background:rgba(239,68,68,.12)!important;color:#f87171!important}
      `}</style>

      {/* ── Info Modal ── */}
      {showInfo && (
        <div onClick={()=>setShowInfo(false)} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'nvchat-fade .14s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:bg,backdropFilter:'blur(32px)',border:`1px solid ${border}`,borderRadius:20,width:'min(400px,100%)',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,.75)',animation:'nvchat-min .18s cubic-bezier(.34,1.3,.64,1)',fontFamily:"'Outfit',sans-serif" }}>
            <div style={{ padding:'13px 15px',borderBottom:`1px solid ${border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}><Sparkles size={15} style={{ color:accent }}/><span style={{ color:txtPri,fontWeight:700,fontSize:13.5 }}>About Nova</span></div>
              <button onClick={()=>setShowInfo(false)} className="nvchat-ibtn" style={{ width:28,height:28,borderRadius:8,background:surf3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}><X size={14}/></button>
            </div>
            <div style={{ padding:15,display:'flex',flexDirection:'column',gap:10 }}>
              <p style={{ fontSize:12.5,color:txtMut,lineHeight:1.6,margin:0 }}>Nova is your AI assistant — here to help with platform questions, studies, scheduling, and anything else.</p>
              <div style={{ background:surf2,border:`1px solid ${border}`,borderRadius:12,padding:'11px 13px',fontSize:12.5,color:txtMut,lineHeight:1.6 }}>
                <strong style={{ color:txtPri,display:'block',marginBottom:5 }}>✦ Capabilities</strong>
                <ul style={{ paddingLeft:14,margin:0,display:'flex',flexDirection:'column',gap:3 }}><li>Platform navigation & feature help</li><li>Study guidance & concept explanations</li><li>Assignment and schedule queries</li><li>Powered by Admin → AI Model Settings</li></ul>
              </div>
              <div style={{ background:`rgba(${pr},.07)`,border:`1px solid rgba(${pr},.25)`,borderRadius:12,padding:'11px 13px',fontSize:12.5,color:txtMut,lineHeight:1.6 }}>
                <strong style={{ color:primary,display:'block',marginBottom:4 }}>💡 Tip</strong>Be specific for the most accurate answers.
              </div>
              <button onClick={()=>setShowInfo(false)} style={{ width:'100%',padding:'9px',borderRadius:11,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:13.5,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:`0 2px 10px rgba(${pr},.35)` }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Modal ── */}
      {errorDetails && (
        <div onClick={()=>setErrorDetails('')} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'nvchat-fade .14s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:bg,backdropFilter:'blur(32px)',border:`1px solid ${border}`,borderRadius:20,width:'min(400px,100%)',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,.75)',animation:'nvchat-min .18s cubic-bezier(.34,1.3,.64,1)',fontFamily:"'Outfit',sans-serif" }}>
            <div style={{ padding:'13px 15px',borderBottom:`1px solid ${border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}><AlertTriangle size={15} style={{ color:'#f87171' }}/><span style={{ color:txtPri,fontWeight:700,fontSize:13.5 }}>Error Details</span></div>
              <button onClick={()=>setErrorDetails('')} className="nvchat-ibtn" style={{ width:28,height:28,borderRadius:8,background:surf3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}><X size={14}/></button>
            </div>
            <div style={{ padding:15,display:'flex',flexDirection:'column',gap:10 }}>
              <pre style={{ fontSize:11,color:'#f87171',background:surf2,padding:12,borderRadius:10,whiteSpace:'pre-wrap',overflowX:'auto',fontFamily:'ui-monospace,monospace',lineHeight:1.6,border:`1px solid ${border}`,margin:0 }}>{errorDetails}</pre>
              <button onClick={()=>setErrorDetails('')} style={{ width:'100%',padding:'9px',borderRadius:11,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:13.5,fontWeight:700,fontFamily:"'Outfit',sans-serif" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Panel
           Layout: position:relative on panel + position:absolute on children.
           This is the only approach guaranteed to work in every browser —
           no flex distribution, no CSS calc, just concrete pixel coordinates.
      ── */}
      {isOpen && (
        <div
          style={{
            position:'fixed', zIndex:9999,
            right:panelRight, bottom:panelBottom,
            width:panelW, height:panelH,
            // Use relative so absolute children are contained
            background:bg,
            backdropFilter:'blur(32px) saturate(180%)',
            WebkitBackdropFilter:'blur(32px) saturate(180%)',
            border:`1px solid ${border}`,
            borderRadius:22,
            boxShadow: dark
              ? `0 0 0 1px rgba(255,255,255,0.04),0 24px 60px rgba(0,0,0,0.82),0 8px 24px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,255,255,0.06)`
              : `0 0 0 1px rgba(0,0,0,0.06),0 24px 60px rgba(0,0,0,0.18),0 8px 24px rgba(0,0,0,0.1)`,
            overflow:'hidden',
            transformOrigin:'bottom right',
            transition:'opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.3,0.64,1)',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
            pointerEvents: isVisible ? 'all' : 'none',
            fontFamily:"'Outfit',sans-serif",
          }}
          role="dialog"
          aria-label="Nova AI assistant"
          // Stop touch events from reaching window listeners (blocks ghost drag while scrolling)
          onTouchStart={e => e.stopPropagation()}
        >
          {/* Noise overlay — same as sidebar */}
          <div style={{ position:'absolute',inset:0,borderRadius:22,pointerEvents:'none',zIndex:0,
            background:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            opacity:dark?0.04:0.025, mixBlendMode:'overlay' as any }}/>
          {/* Glow orb — same as sidebar */}
          <div style={{ position:'absolute',top:-30,left:'50%',transform:'translateX(-50%)',width:120,height:120,borderRadius:'50%',
            background:`radial-gradient(circle,rgba(${pr},${dark?0.22:0.14}) 0%,transparent 70%)`,
            pointerEvents:'none',zIndex:0,filter:'blur(20px)' }}/>

          {/* ── Header: position absolute, top 0, exact height ── */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:HDR_H, zIndex:2,
            display:'flex', alignItems:'center', gap:10, padding:'0 13px',
            background:bg,
            backgroundImage:`linear-gradient(135deg,rgba(${pr},${dark?0.08:0.05}) 0%,transparent 55%)`,
            borderBottom:`1px solid ${border}`,
          }}>
            <div style={{ width:36,height:36,borderRadius:12,flexShrink:0,background:dark?`rgba(${pr},.18)`:`rgba(${pr},.1)`,border:`1px solid rgba(${pr},.22)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
              <GhostAvatar size={28} dark={dark} primary={primary} accent={accent}/>
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:13,fontWeight:700,color:txtPri,letterSpacing:'-0.01em',lineHeight:1.2 }}>Nova</div>
              <div style={{ display:'flex',alignItems:'center',gap:5,marginTop:1 }}>
                <span style={{ width:6,height:6,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 6px rgba(34,197,94,.7)',flexShrink:0,animation:'nvchat-dot 2.2s ease-in-out infinite',display:'inline-block' }}/>
                <span style={{ fontSize:10,color:txtDim,fontWeight:500 }}>AI Assistant · Online</span>
              </div>
            </div>
            <div style={{ display:'flex',gap:2,flexShrink:0 }}>
              <button onClick={()=>setShowInfo(true)} className="nvchat-ibtn" style={{ width:28,height:28,borderRadius:8,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}><Info size={13}/></button>
              <button onClick={()=>setIsOpen(false)} className="nvchat-ibtn nvchat-ibtn-close" style={{ width:28,height:28,borderRadius:8,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}><X size={13}/></button>
            </div>
          </div>

          {/* ── Messages: position absolute, top=HDR_H, bottom=INP_H, overflow-y:auto ── */}
          <div
            className="nvchat-msgs"
            ref={messagesRef}
            style={{
              position:'absolute',
              top:HDR_H,
              bottom:INP_H,
              left:0,
              right:0,
              zIndex:1,
              padding:'12px 11px 6px',
            }}
            onScroll={()=>{ const el=messagesRef.current; if(!el) return; setShowScrollBtn(el.scrollHeight-el.scrollTop-el.clientHeight>100); }}
          >
            {/* Shimmer */}
            {!historyLoaded && (
              <div style={{ display:'flex',flexDirection:'column',gap:9,padding:'4px 0' }}>
                {[['50%','flex-start'],['70%','flex-end'],['58%','flex-start'],['46%','flex-end']].map(([w,a],i)=>(
                  <div key={i} style={{ height:34,width:w as string,alignSelf:a as any,borderRadius:13,background:`linear-gradient(90deg,${surf2} 0%,${surf3} 50%,${surf2} 100%)`,backgroundSize:'200% 100%',animation:'nvchat-shim 1.5s infinite' }}/>
                ))}
              </div>
            )}

            {/* Empty state */}
            {historyLoaded && messages.length === 0 && (
              <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px 16px',textAlign:'center',gap:12 }}>
                <div style={{ width:56,height:56,borderRadius:18,background:dark?`rgba(${pr},.16)`:`rgba(${pr},.09)`,border:`1px solid rgba(${pr},.22)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
                  <GhostAvatar size={40} dark={dark} primary={primary} accent={accent}/>
                </div>
                <div>
                  <div style={{ fontSize:14,fontWeight:800,color:txtPri,marginBottom:4 }}>Hi, I'm Nova ✦</div>
                  <div style={{ fontSize:11.5,color:txtDim,lineHeight:1.55,maxWidth:195 }}>Your AI assistant. Ask anything about the platform, your studies, or anything else.</div>
                </div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginTop:2 }}>
                  {['Submit an exam?','My schedule','Study help','Platform features'].map(q=>(
                    <button key={q} onClick={()=>{ setInputMessage(q); inputRef.current?.focus(); }}
                      style={{ padding:'5px 10px',borderRadius:18,background:surf2,border:`1px solid ${dark?'rgba(255,255,255,0.09)':'rgba(0,0,0,0.08)'}`,color:txtMut,fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',fontFamily:"'Outfit',sans-serif" }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {historyLoaded && (() => {
              let prev: string|null = null;
              return items.map((item,idx) => {
                if (item.type==='sep') {
                  prev = null;
                  return (
                    <div key={item.key} style={{ display:'flex',alignItems:'center',gap:8,margin:'10px 0 4px' }}>
                      <div style={{ flex:1,height:1,background:border }}/><span style={{ fontSize:9,color:txtDim,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap' }}>{item.label}</span><div style={{ flex:1,height:1,background:border }}/>
                    </div>
                  );
                }
                const { msg } = item;
                const isFirst = msg.sender !== prev; prev = msg.sender;
                const next = items[idx+1];
                const nextSame = next?.type==='msg' && next.msg.sender===msg.sender;
                return (
                  <div key={msg.id} style={{ display:'flex',alignItems:'flex-end',gap:6,flexDirection:msg.sender==='user'?'row-reverse':'row',marginBottom:3,marginTop:isFirst?8:0 }}>
                    {msg.sender==='ai' && (
                      <div style={{ width:24,height:24,borderRadius:8,flexShrink:0,alignSelf:'flex-end',background:dark?`rgba(${pr},.18)`:`rgba(${pr},.1)`,border:`1px solid rgba(${pr},.2)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',visibility:nextSame?'hidden':'visible' }}>
                        <GhostAvatar size={18} dark={dark} primary={primary} accent={accent}/>
                      </div>
                    )}
                    <div style={{ display:'flex',flexDirection:'column',gap:2,maxWidth:'min(72%,255px)',alignItems:msg.sender==='user'?'flex-end':'flex-start' }}>
                      <div style={{
                        padding:'8px 11px',borderRadius:14,fontSize:13,lineHeight:1.55,wordBreak:'break-word',whiteSpace:'pre-wrap',
                        ...(msg.sender==='ai'
                          ? { background:bbAi,border:`1px solid ${bbAiBdr}`,color:txtPri,borderBottomLeftRadius:4 }
                          : { background:accent,color:'#fff',borderBottomRightRadius:4,boxShadow:`0 2px 8px rgba(${ar},.28)` }
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
              <div style={{ display:'flex',alignItems:'flex-end',gap:6,marginTop:8 }}>
                <div style={{ width:24,height:24,borderRadius:8,flexShrink:0,background:dark?`rgba(${pr},.18)`:`rgba(${pr},.1)`,border:`1px solid rgba(${pr},.2)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}><GhostAvatar size={18} dark={dark} primary={primary} accent={accent}/></div>
                <div style={{ background:bbAi,border:`1px solid ${bbAiBdr}`,borderRadius:14,borderBottomLeftRadius:4 }}><TypingDots/></div>
              </div>
            )}

            {/* Scroll FAB */}
            {showScrollBtn && (
              <button onClick={()=>scrollToBottom()} style={{ position:'sticky',bottom:4,display:'flex',alignSelf:'center',alignItems:'center',gap:4,padding:'4px 10px 4px 8px',borderRadius:18,background:dark?'rgba(20,23,30,0.95)':'rgba(245,245,248,0.95)',border:`1px solid ${border}`,color:txtMut,fontSize:11,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 14px rgba(0,0,0,.4)',animation:'nvchat-fab .16s ease',whiteSpace:'nowrap',fontFamily:"'Outfit',sans-serif",margin:'4px auto 0' }}>
                <ChevronDown size={12}/> New messages
              </button>
            )}

            <div ref={messagesEndRef}/>
          </div>

          {/* ── Input: position absolute, bottom 0, exact height ── */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:INP_H, zIndex:2,
            padding:'9px 11px 10px',
            background:bg,
            borderTop:`1px solid ${border}`,
            display:'flex', flexDirection:'column', gap:5,
          }}>
            <div style={{ display:'flex',alignItems:'center',gap:7,background:surf2,border:`1px solid ${border}`,borderRadius:12,padding:'4px 4px 4px 12px' }}>
              <input
                ref={inputRef}
                type="text"
                className="nvchat-inp-field"
                value={inputMessage}
                onChange={e=>setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Nova anything…"
                disabled={isLoading}
                aria-label="Message input"
                style={{ flex:1,minWidth:0,background:'transparent',border:'none',color:txtPri,fontSize:13,fontFamily:"'Outfit',sans-serif",padding:'4px 0',lineHeight:1.4,outline:'none',WebkitTapHighlightColor:'transparent' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading||!inputMessage.trim()}
                style={{ width:30,height:30,borderRadius:8,border:'none',cursor:'pointer',
                  background:(!isLoading&&inputMessage.trim())?gradient:surf3,
                  color:'#fff',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                  transition:'transform .15s cubic-bezier(.34,1.56,.64,1),opacity .15s',
                  opacity:(!isLoading&&inputMessage.trim())?1:0.35,
                  boxShadow:(!isLoading&&inputMessage.trim())?`0 2px 8px rgba(${pr},.4)`:'none',
                }}
                onMouseEnter={e=>{ if(!isLoading&&inputMessage.trim()) (e.currentTarget as HTMLElement).style.transform='scale(1.08)'; }}
                onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.transform='none'; }}
              >
                <Send size={12} strokeWidth={2.2}/>
              </button>
            </div>
            <p style={{ fontSize:9.5,color:txtDim,textAlign:'center',margin:0,fontFamily:"'Outfit',sans-serif" }}>Nova · AI-Powered Assistant</p>
          </div>

        </div>
      )}
    </>
  );

  return (
    <>
      <button onClick={handleGhostTap} className="nvchat-ghost" aria-label={isOpen?'Close Nova':'Open Nova'}>
        <GhostIcon size={72} isActive={isOpen}/>
      </button>
      {ReactDOM.createPortal(portal, document.body)}
    </>
  );
};

export default ChatbotWidget;
