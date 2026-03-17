// src/components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Send, X, AlertTriangle, Info, ChevronDown, ChevronLeft, Mic, MicOff, Volume2, Trash2, Minus } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { novaRAGService } from '../services/novaRAGService';
import { novaChatHistoryService, NovaChatMessage } from '../services/novaChatHistoryService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }

// ── color helpers ──────────────────────────────────────────────────────────────
function hexLighten(hex: string, f: number) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return hex;
  return '#' + [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)]
    .map(c => `0${Math.round(c+(255-c)*f).toString(16)}`.slice(-2)).join('');
}
function hexDarken(hex: string, f: number) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return hex;
  return '#' + [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)]
    .map(c => `0${Math.round(c*(1-f)).toString(16)}`.slice(-2)).join('');
}
function hexToRgbStr(hex: string, fallback: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : fallback;
}

// ── HeroGhost — cosmic full‑size ghost with listening state ───────────────────
const HeroGhost: React.FC<{ primary: string; accent: string; size: number; listening: boolean }> = ({ primary, accent, size, listening }) => {
  const bodyLight = hexLighten(primary, 0.42);
  const bodyMid   = hexLighten(primary, 0.18);
  const bodyDark  = hexDarken(primary,  0.22);
  const uid = 'hg';
  return (
    <svg width={size} height={Math.round(size*1.12)} viewBox="0 0 160 175"
      xmlns="http://www.w3.org/2000/svg" style={{ overflow:'visible', display:'block' }}>
      <defs>
        <radialGradient id={`${uid}-aura`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={accent} stopOpacity={listening ? '0.8' : '0.5'}/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </radialGradient>
        <radialGradient id={`${uid}-body`} cx="38%" cy="20%" r="80%" fx="38%" fy="20%">
          <stop offset="0%"   stopColor={bodyLight}/>
          <stop offset="50%"  stopColor={bodyMid}/>
          <stop offset="100%" stopColor={bodyDark}/>
        </radialGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={listening ? '9' : '5'} result="blur"/>
          <feFlood floodColor={accent} floodOpacity={listening ? '0.6' : '0.4'} result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="cb"/>
          <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* ground shadow */}
      <ellipse cx="80" cy="168" rx="42" ry="7" fill={`url(#${uid}-aura)`}>
        <animate attributeName="rx" values="42;56;42" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        <animate attributeName="opacity" values="0.6;1;0.6" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
      </ellipse>
      {/* sparkles */}
      {[{cx:134,cy:32,r:3.2,d:'1.8s',op:'0.8'},{cx:148,cy:76,r:2,d:'2.4s',op:'0.5'},{cx:12,cy:52,r:2.6,d:'1.6s',op:'0.5'},{cx:18,cy:114,r:1.8,d:'3s',op:'0.4'},{cx:150,cy:130,r:2.2,d:'2.1s',op:'0.45'}].map((s,i)=>(
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={i%2===0 ? accent : bodyLight} opacity={parseFloat(s.op)}>
          <animate attributeName="opacity" values={`${s.op};0.05;${s.op}`} dur={s.d} repeatCount="indefinite"/>
          {i===0 && <animate attributeName="r" values="3.2;5;3.2" dur={s.d} repeatCount="indefinite"/>}
        </circle>
      ))}
      {/* body */}
      <g filter={`url(#${uid}-glow)`}>
        <animateTransform attributeName="transform" type="translate"
          values="0,0; 0,-13; 0,0" dur="2.6s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0.05 0.55 0.95;0.45 0.05 0.55 0.95"/>
        <path fill={`url(#${uid}-body)`}>
          <animate attributeName="d" dur="2.2s" repeatCount="indefinite" calcMode="spline"
            keySplines="0.5 0 0.5 1;0.5 0 0.5 1;0.5 0 0.5 1"
            values="M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,130 106,130 C100,130 96,152 80,152 C64,152 60,130 54,130 C48,130 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,127 106,127 C100,127 96,156 80,156 C64,156 60,127 54,127 C48,127 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,133 106,133 C100,133 96,149 80,149 C64,149 60,133 54,133 C48,133 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,130 106,130 C100,130 96,152 80,152 C64,152 60,130 54,130 C48,130 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z"/>
        </path>
        <ellipse cx="58" cy="38" rx="14" ry="18" fill="white" opacity="0.08"/>
        {/* eyes */}
        <ellipse cx="60"  cy="72" rx="11.5" ry={listening ? '15' : '12'} fill="#08051a">
          {listening && <animate attributeName="ry" values="12;16;12" dur="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>}
        </ellipse>
        <ellipse cx="64"  cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.72"/>
        <ellipse cx="100" cy="72" rx="11.5" ry={listening ? '15' : '12'} fill="#08051a">
          {listening && <animate attributeName="ry" values="12;16;12" dur="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>}
        </ellipse>
        <ellipse cx="104" cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.72"/>
        {/* mouth */}
        {listening
          ? <ellipse cx="80" cy="106" rx="9" ry="10" fill="#08051a" opacity="0.9">
              <animate attributeName="ry" values="7;13;7" dur="0.55s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
            </ellipse>
          : <path d="M67,102 Q80,118 93,102" stroke="#08051a" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.88"/>
        }
        <ellipse cx="50"  cy="88" rx="10" ry="6" fill="#f472b6" opacity="0.2"/>
        <ellipse cx="110" cy="88" rx="10" ry="6" fill="#f472b6" opacity="0.2"/>
      </g>
    </svg>
  );
};

// ── MiniGhost — small avatar ──────────────────────────────────────────────────
const MiniGhost: React.FC<{ size: number; primary: string; accent: string }> = ({ size, primary, accent }) => {
  const top = hexLighten(primary, 0.44);
  const mid = hexLighten(primary, 0.16);
  const bot = hexDarken(primary, 0.16);
  const uid = `mg${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 60 65" style={{ display:'block', overflow:'visible' }}>
      <defs>
        <radialGradient id={`${uid}b`} cx="38%" cy="20%" r="80%">
          <stop offset="0%"   stopColor={top}/>
          <stop offset="55%"  stopColor={mid}/>
          <stop offset="100%" stopColor={bot}/>
        </radialGradient>
        <filter id={`${uid}f`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feFlood floodColor={accent} floodOpacity="0.5" result="c"/>
          <feComposite in="c" in2="blur" operator="in" result="cb"/>
          <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter={`url(#${uid}f)`}>
        <path fill={`url(#${uid}b)`}
          d="M30,3 C42,3 52,13 52,26 C52,36 52,44 52,48 C52,52 48,52 46,52 C44,52 43,47 41,47 C39,47 38.5,57 30,57 C21.5,57 21,47 19,47 C17,47 16,52 14,52 C12,52 8,52 8,48 C8,44 8,36 8,26 C8,13 18,3 30,3 Z"/>
        <ellipse cx="21" cy="17" rx="5.5" ry="7.5" fill="white" opacity="0.1"/>
        <ellipse cx="22" cy="27" rx="4.5" ry="4.8" fill="#08051a"/>
        <ellipse cx="24.5" cy="24.5" rx="1.5" ry="1.8" fill="white" opacity="0.75"/>
        <ellipse cx="38" cy="27" rx="4.5" ry="4.8" fill="#08051a"/>
        <ellipse cx="40.5" cy="24.5" rx="1.5" ry="1.8" fill="white" opacity="0.75"/>
        <path d="M24,38 Q30,44 36,38" stroke="#08051a" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.9"/>
        <ellipse cx="16" cy="33" rx="4" ry="2.5" fill="#f472b6" opacity="0.22"/>
        <ellipse cx="44" cy="33" rx="4" ry="2.5" fill="#f472b6" opacity="0.22"/>
      </g>
    </svg>
  );
};

// ── Typing dots ───────────────────────────────────────────────────────────────
const TypingDots: React.FC<{ accent: string }> = ({ accent }) => (
  <div style={{ display:'flex', gap:5, alignItems:'center', padding:'12px 14px' }}>
    {[0,0.18,0.36].map((delay,i)=>(
      <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:accent, display:'block',
        animation:`nv-tdot 1.3s ease-in-out ${delay}s infinite` }}/>
    ))}
  </div>
);

// ── Aurora Voice Waveform ─────────────────────────────────────────────────────
const AuroraWave: React.FC<{ accent: string; active: boolean }> = ({ accent, active }) => (
  <div style={{ display:'flex', alignItems:'center', gap:3, height:36 }}>
    {[1,2,3,4,5,6,7,6,5,4,3,2,1].map((h,i)=>(
      <div key={i} style={{
        width:3, borderRadius:3,
        background: active
          ? `linear-gradient(to top, ${accent}, ${hexLighten(accent,0.3)})`
          : accent,
        height: active ? `${h*3+4}px` : '4px',
        opacity: active ? 0.9 : 0.25,
        transition: 'height 0.12s ease, opacity 0.3s ease',
        animation: active ? `nv-wave ${0.38+i*0.06}s ease-in-out infinite alternate` : 'none',
      }}/>
    ))}
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ eyeOffset: _eyeOffset }) => {
  const { accentColor, primaryColor, theme, user, siteName } = useDashboard();

  const [isOpen, setIsOpen]               = useState(false);
  const [isVisible, setIsVisible]         = useState(false);
  const [messages, setMessages]           = useState<NovaChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [inputMessage, setInputMessage]   = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [errorDetails, setErrorDetails]   = useState('');
  const [showInfo, setShowInfo]           = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [winHeight, setWinHeight] = useState<number>(() => typeof window !== 'undefined' ? window.innerHeight : 800);
  const [isMobile, setIsMobile]   = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  // Browser chrome offsets — reliable on Android where env(safe-area-inset-*) = 0.
  // Uses visualViewport when available (most accurate).
  const [chromeOffset, setChromeOffset]       = useState<number>(0);
  const [chromeBottomOffset, setChromeBottomOffset] = useState<number>(0);

  // voice state
  const [isListening, setIsListening]         = useState(false);
  const [voiceMode, setVoiceMode]             = useState(false);
  const [voiceModeVisible, setVoiceModeVisible] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isSpeaking, setIsSpeaking]           = useState(false);

  const messagesRef    = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const tapCount       = useRef(0);
  const tapTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlying       = useRef(false);
  const sessionId      = useRef(Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ── detect mobile + browser chrome offsets ───────────────────────────────
  useEffect(()=>{
    const updateOffset = () => {
      const vv = (window as any).visualViewport;
      if (vv) {
        setChromeOffset(Math.round(vv.offsetTop));
        // bottom offset = total screen height minus (viewport top offset + viewport height)
        const bottom = Math.round(window.screen.height - vv.offsetTop - vv.height);
        setChromeBottomOffset(Math.max(0, Math.min(80, bottom)));
      } else {
        const total = window.screen.height - window.innerHeight;
        setChromeOffset(Math.max(0, Math.min(80, total - 20)));
        setChromeBottomOffset(0);
      }
    };
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setWinHeight(window.innerHeight);
      updateOffset();
    };
    check();
    window.addEventListener('resize', check);
    const vv = (window as any).visualViewport;
    if (vv) vv.addEventListener('resize', updateOffset);
    return () => {
      window.removeEventListener('resize', check);
      if (vv) vv.removeEventListener('resize', updateOffset);
    };
  },[]);

  // ── body scroll lock ───────────────────────────────────────────────────────
  useEffect(()=>{
    if (isOpen && isMobile) document.body.style.overflow='hidden';
    else document.body.style.overflow='';
    return ()=>{ document.body.style.overflow=''; };
  },[isOpen,isMobile]);

  useEffect(()=>{
    window.dispatchEvent(new CustomEvent(isOpen?'nova-chat-open':'nova-chat-close'));
  },[isOpen]);

  useEffect(()=>{
    if (!user?.uid){ setHistoryLoaded(true); return; }
    novaChatHistoryService.getHistory(user.uid)
      .then(h=>{ setMessages(h); setHistoryLoaded(true); })
      .catch(()=>setHistoryLoaded(true));
  },[user?.uid]);

  const scrollToBottom = (behavior: ScrollBehavior='smooth')=>{
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollBtn(false);
  };

  useEffect(()=>{
    const el = messagesRef.current;
    if (!el || (el.scrollHeight-el.scrollTop-el.clientHeight < 100)) scrollToBottom();
    else setShowScrollBtn(true);
  },[messages,isLoading]);

  useEffect(()=>{
    if (isOpen){
      setTimeout(()=>setIsVisible(true),10);
      setTimeout(()=>{ scrollToBottom('instant' as ScrollBehavior); inputRef.current?.focus(); },100);
    } else {
      setIsVisible(false);
      stopListening();
      closeVoiceMode();
    }
  },[isOpen]);

  useEffect(()=>{
    const close=()=>{ isFlying.current=true; setIsOpen(false); };
    const land =()=>{ isFlying.current=false; };
    window.addEventListener('ghost-close-chat',close);
    window.addEventListener('ghost-land',land);
    return ()=>{ window.removeEventListener('ghost-close-chat',close); window.removeEventListener('ghost-land',land); };
  },[]);

  // ── Voice ──────────────────────────────────────────────────────────────────
  const stopListening = useCallback(()=>{
    if (recognitionRef.current){ try{ recognitionRef.current.stop(); }catch(_){} recognitionRef.current=null; }
    setIsListening(false);
  },[]);

  const openVoiceMode = useCallback(()=>{
    setVoiceMode(true);
    setTimeout(()=>setVoiceModeVisible(true),10);
  },[]);

  const closeVoiceMode = useCallback(()=>{
    setVoiceModeVisible(false);
    setTimeout(()=>{ setVoiceMode(false); setVoiceTranscript(''); },320);
  },[]);

  const startListening = useCallback(()=>{
    const SpeechRec=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if (!SpeechRec){ alert('Speech recognition not supported. Try Chrome or Edge.'); return; }
    stopListening();
    const rec = new SpeechRec();
    rec.lang='en-US'; rec.continuous=false; rec.interimResults=true;
    rec.onstart=()=>setIsListening(true);
    rec.onresult=(e: SpeechRecognitionEvent)=>{
      const t=Array.from(e.results).map(r=>r[0].transcript).join('');
      setVoiceTranscript(t);
      if (e.results[e.results.length-1].isFinal){ setInputMessage(t); setVoiceTranscript(''); }
    };
    rec.onerror=()=>{ setIsListening(false); };
    rec.onend=()=>setIsListening(false);
    recognitionRef.current=rec;
    rec.start();
    setIsListening(true);
  },[stopListening]);

  const speakText = useCallback((text: string)=>{
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt=new SpeechSynthesisUtterance(text);
    utt.rate=1.05; utt.pitch=1.1;
    utt.onstart=()=>setIsSpeaking(true);
    utt.onend=()=>setIsSpeaking(false);
    utt.onerror=()=>setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  },[]);

  const stopSpeaking = useCallback(()=>{ window.speechSynthesis?.cancel(); setIsSpeaking(false); },[]);

  const handleVoiceSend = useCallback(()=>{
    const text=(voiceTranscript||inputMessage).trim();
    if (text){ setInputMessage(text); setVoiceTranscript(''); }
    stopListening();
    closeVoiceMode();
    if (text) setTimeout(()=>handleSendMessage(text, true),50);
  },[voiceTranscript,inputMessage,stopListening,closeVoiceMode]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (overrideText?: string, speakReply = false)=>{
    const text=(overrideText??inputMessage).trim();
    if (!text||isLoading) return;
    setMessages(p=>[...p,{ id:`tmp-u-${Date.now()}`, text, sender:'user', timestamp:new Date(), sessionId:sessionId.current }]);
    setInputMessage(''); setIsLoading(true); setErrorDetails('');
    try {
      const res=await novaRAGService.sendMessage(text,user??null,sessionId.current,siteName);
      setMessages(p=>[...p,{ id:`tmp-a-${Date.now()}`, text:res.text, sender:'ai', timestamp:new Date(), sessionId:sessionId.current }]);
      if (speakReply) speakText(res.text);
      if (res.navigateTo){
        setIsOpen(false); setIsVisible(false); isFlying.current=false;
        window.dispatchEvent(new CustomEvent('nova-navigate',{ detail:{ path:res.navigateTo } }));
        setTimeout(()=>window.dispatchEvent(new CustomEvent('ghost-land')),300);
      }
    } catch(err){
      const msg=err instanceof Error?err.message:'Unknown error';
      setErrorDetails(`Error: ${msg}\n\nPossible causes:\n1. No AI key configured\n2. No vector key configured\n3. CORS blocking\n4. Network issue\n5. Rate limit exceeded`);
      setMessages(p=>[...p,{ id:`tmp-e-${Date.now()}`, text:'Something went wrong. Tap the info icon for details.', sender:'ai', timestamp:new Date(), sessionId:sessionId.current }]);
    } finally { setIsLoading(false); }
  },[inputMessage,isLoading,user,siteName,speakText]);

  const handleGhostTap=()=>{
    tapCount.current+=1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current>=3){ tapCount.current=0; if(!isOpen) window.dispatchEvent(new CustomEvent('ghost-fly')); }
    else { tapTimer.current=setTimeout(()=>{ if(tapCount.current===1&&!isFlying.current) setIsOpen(p=>!p); tapCount.current=0; },200); }
  };

  const handleKeyPress=(e: React.KeyboardEvent<HTMLInputElement>)=>{
    if (e.key==='Enter'&&!e.shiftKey&&!isLoading) handleSendMessage();
  };

  const fmt=(d:Date)=>d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const dateSep=(d:Date)=>{
    const t=new Date(),y=new Date(t); y.setDate(y.getDate()-1);
    if(d.toDateString()===t.toDateString()) return 'Today';
    if(d.toDateString()===y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([],{month:'short',day:'numeric'});
  };

  type DItem={ type:'sep'; label:string; key:string }|{ type:'msg'; msg:NovaChatMessage };
  const items: DItem[]=[];
  let lastDate='';
  for (const m of messages){
    const ds=m.timestamp.toDateString();
    if(ds!==lastDate){ items.push({type:'sep',label:dateSep(m.timestamp),key:`sep-${ds}`}); lastDate=ds; }
    items.push({type:'msg',msg:m});
  }

  // ── Theme palette ──────────────────────────────────────────────────────────
  const dark    = theme !== 'light';
  const accent  = accentColor  || '#c084fc';
  const primary = primaryColor || '#7c3aed';
  const ar = hexToRgbStr(accent,  '192,132,252');
  const pr = hexToRgbStr(primary, '124,58,237');
  const gradient = `linear-gradient(135deg,${primary} 0%,${accent} 100%)`;

  // ── Light mode palette ─────────────────────────────────────────────────────
  // Chat panel always uses dark cosmic theme (Option 2 style) regardless of app theme
  const cosmicBg    = '#08051a';
  const cosmicHdr   = 'rgba(8,5,26,0.92)';
  const cosmicInp   = 'rgba(8,5,26,0.96)';
  const cosmicBdr   = `rgba(${pr},0.3)`;
  const txtPri      = '#f0eeff';
  const txtMut      = '#a89fc2';
  const txtDim      = '#4a4266';
  const bbAi        = 'rgba(255,255,255,0.07)';
  const bbAiBdr     = `rgba(${pr},0.25)`;
  const surf2       = 'rgba(255,255,255,0.05)';

  // Modal uses app theme
  const mBg   = dark ? 'rgba(12,8,26,0.98)' : 'rgba(255,255,255,0.98)';
  const mBdr  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const mTxt  = dark ? '#f0eeff' : '#111827';
  const mMut  = dark ? '#a89fc2' : '#6b7280';
  const mDim  = dark ? '#695e88' : '#9ca3af';
  const mS2   = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const mS3   = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Desktop floating panel dimensions
  const desktopPanelW = 380;
  const desktopPanelH = 560;
  // Compute top in JS — CSS max() doesn't work in React inline styles
  const desktopPanelTop = Math.max(16, winHeight - desktopPanelH - 16);

  // ── Portal ─────────────────────────────────────────────────────────────────
  const portal = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');

        /* Keyframes */
        @keyframes nv-tdot  { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-7px);opacity:1} }
        @keyframes nv-pulse { 0%,100%{filter:drop-shadow(0 0 8px rgba(${ar},.5))} 50%{filter:drop-shadow(0 0 22px rgba(${ar},.9))} }
        @keyframes nv-fade  { from{opacity:0} to{opacity:1} }
        @keyframes nv-in    { from{opacity:0;transform:scale(0.97) translateY(14px)} to{opacity:1;transform:none} }
        @keyframes nv-out   { from{opacity:1;transform:none} to{opacity:0;transform:scale(0.97) translateY(14px)} }
        @keyframes nv-shim  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes nv-dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes nv-fab   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes nv-wave  { from{transform:scaleY(0.4)} to{transform:scaleY(1.6)} }
        @keyframes nv-ring  { 0%{transform:translate(-50%,-52%) scale(1);opacity:0.75} 100%{transform:translate(-50%,-52%) scale(2.4);opacity:0} }
        @keyframes nv-chip  { 0%{transform:translateY(18px);opacity:0} 100%{transform:none;opacity:1} }
        @keyframes nv-desktop-in { from{opacity:0;transform:scale(0.95) translateY(12px)} to{opacity:1;transform:none} }
        @keyframes nv-desktop-out{ from{opacity:1;transform:none} to{opacity:0;transform:scale(0.95) translateY(12px)} }
        @keyframes nv-aurora-1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(8px,-10px) scale(1.06)} }
        @keyframes nv-aurora-2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-6px,8px) scale(1.04)} }
        @keyframes nv-aurora-3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(10px,5px) scale(1.05)} }
        @keyframes nv-msg-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes nv-voice-slide-in  { from{opacity:0;transform:scale(1.03)} to{opacity:1;transform:none} }
        @keyframes nv-voice-slide-out { from{opacity:1;transform:none} to{opacity:0;transform:scale(1.03)} }

        /* Ghost FAB */
        .nv-ghost { animation:nv-pulse 3.4s ease-in-out infinite; transition:transform .22s cubic-bezier(.34,1.56,.64,1); background:none!important; border:none!important; padding:0!important; cursor:pointer; display:block; width:72px; height:72px; outline:none; }
        .nv-ghost:hover { animation:none; transform:scale(1.13); }

        /* Scrollbar */
        .nv-msgs { overflow-y:auto!important; overflow-x:hidden; touch-action:pan-y; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
        .nv-msgs::-webkit-scrollbar { width:2px; }
        .nv-msgs::-webkit-scrollbar-track { background:transparent; }
        .nv-msgs::-webkit-scrollbar-thumb { background:rgba(${pr},0.35); border-radius:2px; }

        /* Input */
        .nv-inp { outline:none!important; -webkit-tap-highlight-color:transparent!important; box-shadow:none!important; }
        .nv-inp:focus { outline:none!important; box-shadow:none!important; }
        .nv-inp::placeholder { color:${txtDim}; }

        /* Buttons */
        .nv-btn { transition:background .13s,color .13s,transform .13s; }
        .nv-btn:hover { background:rgba(255,255,255,0.09)!important; color:${txtPri}!important; }
        .nv-btn-close:hover { background:rgba(239,68,68,.14)!important; color:#f87171!important; }
        .nv-chip-btn { transition:background .15s,border-color .15s,transform .15s; }
        .nv-chip-btn:hover { background:rgba(${pr},0.26)!important; border-color:rgba(${ar},0.6)!important; transform:translateY(-2px)!important; }
        .nv-send { transition:transform .15s cubic-bezier(.34,1.56,.64,1),opacity .15s; }
        .nv-send:hover:not(:disabled) { transform:scale(1.13)!important; }
        .nv-mic { transition:transform .15s cubic-bezier(.34,1.56,.64,1),box-shadow .2s; position:relative; }
        .nv-mic:hover { transform:scale(1.09)!important; }
        .nv-mic.listening { box-shadow:0 0 0 4px rgba(${ar},0.28),0 0 20px rgba(${ar},0.45)!important; }
        .nv-mic.listening::after { content:''; position:absolute; inset:-8px; border-radius:50%; border:2px solid rgba(${ar},0.45); animation:nv-ring 1.5s ease-out infinite; }
        .nv-msg-enter { animation:nv-msg-in 0.26s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>

      {/* ── Info Modal ── */}
      {showInfo && (
        <div onClick={()=>setShowInfo(false)} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,animation:'nv-fade .16s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:mBg,backdropFilter:'blur(40px)',border:`1px solid ${mBdr}`,borderRadius:24,width:'min(420px,100%)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.85)',animation:'nv-in .22s cubic-bezier(.22,1,.36,1)' }}>
            <div style={{ padding:'16px 18px',borderBottom:`1px solid ${mBdr}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:11 }}>
                <div style={{ width:32,height:32,borderRadius:11,background:gradient,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden',boxShadow:`0 4px 14px rgba(${pr},.5)` }}>
                  <MiniGhost size={24} primary={primary} accent={accent}/>
                </div>
                <span style={{ color:mTxt,fontWeight:700,fontSize:15,fontFamily:"'Sora',sans-serif" }}>About Aura</span>
              </div>
              <button onClick={()=>setShowInfo(false)} className="nv-btn" style={{ width:30,height:30,borderRadius:9,background:mS3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:mDim }}><X size={15}/></button>
            </div>
            <div style={{ padding:18,display:'flex',flexDirection:'column',gap:12 }}>
              <p style={{ fontSize:13.5,color:mMut,lineHeight:1.7,margin:0 }}>Aura is your AI assistant — here to help with platform questions, studies, scheduling, and more. She supports both text and voice!</p>
              <div style={{ background:mS2,border:`1px solid ${mBdr}`,borderRadius:14,padding:'13px 15px',fontSize:13,color:mMut,lineHeight:1.65 }}>
                <strong style={{ color:mTxt,display:'block',marginBottom:7 }}>✦ Capabilities</strong>
                <ul style={{ paddingLeft:16,margin:0,display:'flex',flexDirection:'column',gap:5 }}>
                  <li>Platform navigation &amp; feature help</li>
                  <li>Study guidance &amp; concept explanations</li>
                  <li>Assignment and schedule queries</li>
                  <li>Voice input &amp; text-to-speech responses</li>
                </ul>
              </div>
              <div style={{ background:`rgba(${pr},.09)`,border:`1px solid rgba(${pr},.3)`,borderRadius:14,padding:'12px 15px',fontSize:13,color:mMut,lineHeight:1.65 }}>
                <strong style={{ color:accent,display:'block',marginBottom:5 }}>🎙 Voice tip</strong>
                Tap the mic button to open the Aurora voice interface. Aura listens, responds, and speaks back.
              </div>
              <button onClick={()=>setShowInfo(false)} style={{ width:'100%',padding:'11px',borderRadius:13,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:`0 4px 16px rgba(${pr},.5)` }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Modal ── */}
      {errorDetails && (
        <div onClick={()=>setErrorDetails('')} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,animation:'nv-fade .16s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:mBg,backdropFilter:'blur(40px)',border:`1px solid ${mBdr}`,borderRadius:24,width:'min(420px,100%)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.85)',animation:'nv-in .22s cubic-bezier(.22,1,.36,1)' }}>
            <div style={{ padding:'16px 18px',borderBottom:`1px solid ${mBdr}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:9 }}><AlertTriangle size={16} style={{ color:'#f87171' }}/><span style={{ color:mTxt,fontWeight:700,fontSize:15 }}>Error Details</span></div>
              <button onClick={()=>setErrorDetails('')} className="nv-btn" style={{ width:30,height:30,borderRadius:9,background:mS3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:mDim }}><X size={15}/></button>
            </div>
            <div style={{ padding:18,display:'flex',flexDirection:'column',gap:12 }}>
              <pre style={{ fontSize:11.5,color:'#f87171',background:mS2,padding:13,borderRadius:11,whiteSpace:'pre-wrap',overflowX:'auto',fontFamily:'ui-monospace,monospace',lineHeight:1.65,border:`1px solid ${mBdr}`,margin:0 }}>{errorDetails}</pre>
              <button onClick={()=>setErrorDetails('')} style={{ width:'100%',padding:'11px',borderRadius:13,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Chat Confirm Modal ── */}
      {showClearConfirm && (
        <div onClick={()=>setShowClearConfirm(false)} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,animation:'nv-fade .16s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:mBg,backdropFilter:'blur(40px)',border:`1px solid ${mBdr}`,borderRadius:24,width:'min(340px,100%)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.85)',animation:'nv-in .22s cubic-bezier(.22,1,.36,1)' }}>
            <div style={{ padding:'20px 20px 8px',textAlign:'center' }}>
              <div style={{ width:48,height:48,borderRadius:16,background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px' }}>
                <Trash2 size={22} style={{ color:'#f87171' }}/>
              </div>
              <div style={{ fontFamily:"'Sora',sans-serif",fontSize:17,fontWeight:700,color:mTxt,marginBottom:8 }}>Clear chat history?</div>
              <p style={{ fontSize:13.5,color:mMut,lineHeight:1.6,margin:0 }}>This will remove all messages from this session. This action cannot be undone.</p>
            </div>
            <div style={{ padding:'16px 20px 20px',display:'flex',gap:10 }}>
              <button onClick={()=>setShowClearConfirm(false)}
                style={{ flex:1,padding:'11px',borderRadius:13,border:`1px solid ${mBdr}`,cursor:'pointer',background:mS2,color:mMut,fontSize:14,fontWeight:600,fontFamily:"'Outfit',sans-serif",transition:'background .15s' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=mS3;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=mS2;}}>
                Cancel
              </button>
              <button onClick={()=>{
                  setMessages([]);
                  setShowClearConfirm(false);
                  if (user?.uid) novaChatHistoryService.clearHistory?.(user.uid).catch(()=>{});
                }}
                style={{ flex:1,padding:'11px',borderRadius:13,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:'0 4px 16px rgba(220,38,38,.4)' }}>
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════════
          AURORA VOICE MODE OVERLAY (Option 3 style — slides over chat)
      ══════════════════════════════════════════════════════════════════ */}
      {voiceMode && (
        <div style={{
          position:'fixed',
          ...(isMobile
            ? { top: chromeOffset, left:0, right:0, height: `calc(100dvh - ${chromeOffset}px)` } as React.CSSProperties
            : { bottom:16, right:24, width:desktopPanelW,
                top: desktopPanelTop,
                borderRadius:28 }),
          zIndex:10002,
          overflow:'hidden',
          background:'#040210',
          fontFamily:"'Outfit',sans-serif",
          animation: voiceModeVisible
            ? 'nv-voice-slide-in 0.32s cubic-bezier(0.22,1,0.36,1) forwards'
            : 'nv-voice-slide-out 0.28s cubic-bezier(0.22,1,0.36,1) forwards',
          ...((!isMobile) && { border:`1px solid rgba(${pr},0.35)`, boxShadow:`0 24px 80px rgba(0,0,0,0.9),0 0 40px rgba(${pr},0.2)` }),
        }}>
          {/* Aurora background layers */}
          <div style={{ position:'absolute',inset:0,pointerEvents:'none' }}>
            <div style={{ position:'absolute',width:'70%',height:'70%',left:'-15%',top:'-10%',borderRadius:'50%',
              background:`radial-gradient(circle,rgba(${pr},0.65) 0%,transparent 65%)`,filter:'blur(30px)',
              animation:'nv-aurora-1 6s ease-in-out infinite' }}/>
            <div style={{ position:'absolute',width:'60%',height:'60%',right:'-10%',top:'20%',borderRadius:'50%',
              background:`radial-gradient(circle,rgba(236,72,153,0.45) 0%,transparent 65%)`,filter:'blur(26px)',
              animation:'nv-aurora-2 7s ease-in-out infinite' }}/>
            <div style={{ position:'absolute',width:'55%',height:'55%',left:'10%',bottom:'5%',borderRadius:'50%',
              background:`radial-gradient(circle,rgba(59,130,246,0.35) 0%,transparent 65%)`,filter:'blur(28px)',
              animation:'nv-aurora-3 8s ease-in-out 1s infinite' }}/>
            {/* floating particles */}
            {[{x:'12%',y:'18%',s:2.2,d:'1.9s'},{x:'84%',y:'10%',s:1.6,d:'2.5s'},{x:'72%',y:'38%',s:1.2,d:'1.7s'},{x:'6%',y:'58%',s:1.8,d:'3.1s'},{x:'91%',y:'62%',s:1.4,d:'2.2s'},{x:'50%',y:'88%',s:1,d:'2.8s'}].map((p,i)=>(
              <div key={i} style={{ position:'absolute',left:p.x,top:p.y,width:p.s,height:p.s,borderRadius:'50%',
                background:`rgba(${ar},0.7)`,animation:`nv-dot ${p.d} ease-in-out ${i*0.35}s infinite` }}/>
            ))}
          </div>

          {/* Frosted header */}
          <div style={{ position:'absolute',top:0,left:0,right:0,padding:isMobile?'env(safe-area-inset-top,0px) 14px 10px':'12px 14px 10px',
            background:'rgba(4,2,16,0.65)',backdropFilter:'blur(22px)',
            borderBottom:'1px solid rgba(255,255,255,0.07)',zIndex:5,
            display:'flex',alignItems:'center',gap:8,
            paddingTop: isMobile ? 'calc(env(safe-area-inset-top,0px) + 10px)' : '12px',
          }}>
            <button onClick={()=>{ stopListening(); closeVoiceMode(); }}
              style={{ width:38,height:38,borderRadius:12,background:'rgba(255,255,255,0.08)',border:'none',
                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                color:'rgba(255,255,255,0.65)',flexShrink:0,WebkitTapHighlightColor:'transparent' }}>
              <ChevronLeft size={20} strokeWidth={2.2}/>
            </button>
            <div style={{ width:32,height:32,borderRadius:11,background:`rgba(${pr},0.35)`,
              border:`1px solid rgba(${pr},0.6)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0 }}>
              <MiniGhost size={24} primary={primary} accent={accent}/>
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontFamily:"'Sora',sans-serif",fontSize:15,fontWeight:700,color:'#fff',lineHeight:1.2 }}>Aura</div>
              <div style={{ fontSize:11,color:'#a78bfa',fontWeight:500,marginTop:1 }}>
                {isListening ? 'Listening…' : isSpeaking ? 'Speaking…' : 'Voice Mode'}
              </div>
            </div>
            {isSpeaking && (
              <button onClick={stopSpeaking} style={{ width:34,height:34,borderRadius:10,background:`rgba(${ar},0.15)`,border:`1px solid rgba(${ar},0.35)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:accent }}>
                <Volume2 size={15}/>
              </button>
            )}
          </div>

          {/* Center — ghost + pulse rings */}
          <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0,paddingTop:60,paddingBottom:100,zIndex:2 }}>
            {/* Pulse rings */}
            <div style={{ position:'relative',display:'flex',alignItems:'center',justifyContent:'center' }}>
              {isListening && (<>
                <div style={{ position:'absolute',top:'50%',left:'50%',width:isMobile?200:170,height:isMobile?200:170,borderRadius:'50%',
                  border:`1.5px solid rgba(${ar},0.35)`,animation:'nv-ring 1.8s ease-out infinite' }}/>
                <div style={{ position:'absolute',top:'50%',left:'50%',width:isMobile?200:170,height:isMobile?200:170,borderRadius:'50%',
                  border:`1px solid rgba(${ar},0.2)`,animation:'nv-ring 1.8s ease-out 0.65s infinite' }}/>
                <div style={{ position:'absolute',top:'50%',left:'50%',width:isMobile?200:170,height:isMobile?200:170,borderRadius:'50%',
                  border:`1px solid rgba(${ar},0.12)`,animation:'nv-ring 1.8s ease-out 1.3s infinite' }}/>
              </>)}
              <HeroGhost primary={primary} accent={accent} size={isMobile?160:130} listening={isListening}/>
            </div>

            {/* Status text */}
            <div style={{ fontFamily:"'Sora',sans-serif",fontSize:isMobile?22:18,fontWeight:700,color:'#fff',marginTop:20,textAlign:'center' }}>
              {isListening ? <><span style={{ color:accent }}>Aura</span> is listening…</> : isSpeaking ? <><span style={{ color:accent }}>Aura</span> is speaking…</> : 'Tap mic to speak'}
            </div>

            {/* Transcript */}
            {(voiceTranscript||isListening) && (
              <div style={{ fontSize:isMobile?15:13,color:'rgba(167,139,250,0.85)',textAlign:'center',
                maxWidth:isMobile?'80%':'85%',lineHeight:1.55,marginTop:10,padding:`0 ${isMobile?28:18}px`,
                minHeight:26,fontStyle:voiceTranscript?'normal':'italic' }}>
                {voiceTranscript || 'Say something…'}
              </div>
            )}

            {/* Waveform */}
            <div style={{ marginTop:20 }}>
              <AuroraWave accent={accent} active={isListening}/>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex',gap:isMobile?20:14,alignItems:'center',marginTop:isMobile?32:24 }}>
              {/* Cancel */}
              <button onClick={()=>{ stopListening(); closeVoiceMode(); setVoiceTranscript(''); }}
                className="nv-btn"
                style={{ width:isMobile?54:46,height:isMobile?54:46,borderRadius:'50%',
                  background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.6)' }}>
                <X size={isMobile?20:17}/>
              </button>

              {/* Main mic / send */}
              <button onClick={isListening ? handleVoiceSend : startListening}
                style={{ width:isMobile?76:64,height:isMobile?76:64,borderRadius:'50%',border:'none',cursor:'pointer',
                  background:gradient,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',
                  boxShadow:`0 4px 28px rgba(${pr},.65),0 0 50px rgba(${ar},.2)`,
                  transition:'transform 0.15s cubic-bezier(.34,1.56,.64,1)',
                  ...(isListening && { boxShadow:`0 0 0 6px rgba(${ar},0.22),0 4px 28px rgba(${pr},.65)` }) }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.08)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='scale(1)'}>
                {isListening ? <Send size={isMobile?26:22}/> : <Mic size={isMobile?26:22}/>}
              </button>

              {/* Toggle listen / stop */}
              <button onClick={isListening ? stopListening : startListening}
                className="nv-btn"
                style={{ width:isMobile?54:46,height:isMobile?54:46,borderRadius:'50%',
                  background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                  color:isListening?accent:'rgba(255,255,255,0.5)' }}>
                {isListening ? <MicOff size={isMobile?20:17}/> : <Mic size={isMobile?20:17}/>}
              </button>
            </div>

            {isListening && voiceTranscript && (
              <p style={{ fontSize:11,color:`rgba(${ar},0.6)`,marginTop:14,textAlign:'center',letterSpacing:'0.04em' }}>
                Tap ↗ to send · tap mic to stop
              </p>
            )}
          </div>

          {/* Bottom frosted bar */}
          <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:isMobile?`8px 18px ${chromeBottomOffset + 12}px`:'8px 14px 12px',
            background:'rgba(4,2,16,0.8)',backdropFilter:'blur(20px)',
            borderTop:'1px solid rgba(255,255,255,0.07)',zIndex:5,textAlign:'center' }}>
            <p style={{ fontSize:10,color:`rgba(${ar},0.45)`,letterSpacing:'0.08em',fontFamily:"'Outfit',sans-serif",margin:0 }}>
              AURA · VOICE ASSISTANT · {isListening ? 'LIVE' : 'READY'}
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CHAT PANEL — Option 2: Neon Cosmic
          Mobile: full-screen   Desktop: floating panel (380×560)
      ══════════════════════════════════════════════════════════════════ */}
      {isOpen && (
        <div style={{
          position:'fixed',
          ...(isMobile
            ? { top: chromeOffset, left:0, right:0, height: `calc(100dvh - ${chromeOffset}px)` } as React.CSSProperties
            : { bottom:16, right:24, width:desktopPanelW,
                top: desktopPanelTop,
                borderRadius:28, border:`1px solid rgba(${pr},0.38)` }),
          zIndex:9999,
          background:cosmicBg,
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? 'translateY(0) scale(1)'
            : isMobile ? 'translateY(24px)' : 'scale(0.96) translateY(14px)',
          pointerEvents: isVisible ? 'all' : 'none',
          transition:'opacity 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1)',
          fontFamily:"'Outfit',sans-serif",
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          ...((!isMobile) && { boxShadow:`0 24px 80px rgba(0,0,0,0.85),0 0 40px rgba(${pr},0.25)` }),
        }}
          role="dialog" aria-label="Aura AI assistant"
          onTouchStart={e=>e.stopPropagation()}
        >
          {/* ── Cosmic background atmosphere ── */}
          <div style={{ position:'absolute',inset:0,pointerEvents:'none',zIndex:0 }}>
            {/* Mesh gradients */}
            <div style={{ position:'absolute',top:'-15%',left:'-10%',width:'65%',height:'65%',borderRadius:'50%',
              background:`radial-gradient(circle,rgba(${pr},0.38) 0%,transparent 65%)`,filter:'blur(50px)' }}/>
            <div style={{ position:'absolute',bottom:'-10%',right:'-8%',width:'55%',height:'55%',borderRadius:'50%',
              background:`radial-gradient(circle,rgba(${ar},0.22) 0%,transparent 65%)`,filter:'blur(44px)' }}/>
            <div style={{ position:'absolute',top:'40%',right:'-5%',width:'40%',height:'40%',borderRadius:'50%',
              background:`radial-gradient(circle,rgba(99,102,241,0.2) 0%,transparent 65%)`,filter:'blur(36px)' }}/>
            {/* Star field */}
            {[{x:'10%',y:'8%',s:1.8,d:'2s'},{x:'85%',y:'6%',s:1.4,d:'2.6s'},{x:'68%',y:'22%',s:1,d:'1.7s'},{x:'6%',y:'42%',s:1.6,d:'3.2s'},{x:'92%',y:'55%',s:1.8,d:'2.1s'},{x:'42%',y:'78%',s:1,d:'2.9s'},{x:'75%',y:'85%',s:1.4,d:'1.9s'},{x:'22%',y:'66%',s:1.2,d:'3.4s'}].map((s,i)=>(
              <div key={i} style={{ position:'absolute',left:s.x,top:s.y,width:s.s,height:s.s,borderRadius:'50%',
                background:`rgba(${ar},0.65)`,animation:`nv-dot ${s.d} ease-in-out ${i*0.38}s infinite` }}/>
            ))}
          </div>

          {/* ── HEADER ── */}
          <div style={{
          position:'relative',zIndex:3,flexShrink:0,
            minHeight:isMobile?64:58,
            display:'flex',alignItems:'center',
            padding: isMobile ? '0 6px 0 2px' : '0 8px 0 4px',
            background:cosmicHdr,
            backgroundImage:`linear-gradient(135deg,rgba(${pr},0.22) 0%,transparent 60%)`,
            borderBottom:`1px solid ${cosmicBdr}`,
            backdropFilter:'blur(24px)',
          }}>
            {/* Ghost avatar */}
            <div style={{ width:isMobile?40:34,height:isMobile?40:34,borderRadius:13,flexShrink:0,overflow:'hidden',
              background:`linear-gradient(135deg,rgba(${pr},0.42),rgba(${ar},0.26))`,
              border:`1px solid rgba(${pr},0.55)`,
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:`0 0 18px rgba(${pr},0.42)`,marginLeft:10,marginRight:10 }}>
              <MiniGhost size={isMobile?30:25} primary={primary} accent={accent}/>
            </div>

            {/* Name + status */}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:isMobile?17:15,fontWeight:700,color:txtPri,fontFamily:"'Sora',sans-serif",letterSpacing:'-0.02em',lineHeight:1.2 }}>
                Aura
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:5,marginTop:2 }}>
                <span style={{ width:6,height:6,borderRadius:'50%',background:'#4ade80',
                  boxShadow:'0 0 8px rgba(74,222,128,.8)',flexShrink:0,display:'inline-block',
                  animation:'nv-dot 2.2s ease-in-out infinite' }}/>
                <span style={{ fontSize:11,color:'rgba(74,222,128,0.8)',fontWeight:500,letterSpacing:'0.03em' }}>
                  {isSpeaking?'Speaking…':isListening?'Listening…':'AI Assistant · Online'}
                </span>
              </div>
            </div>

            {/* Right actions */}
            <div style={{ display:'flex',gap:2,flexShrink:0,alignItems:'center',paddingRight:4 }}>
              {isSpeaking && (
                <button onClick={stopSpeaking} title="Stop speaking"
                  style={{ width:36,height:36,borderRadius:10,background:`rgba(${ar},0.15)`,
                    border:`1px solid rgba(${ar},0.38)`,cursor:'pointer',display:'flex',alignItems:'center',
                    justifyContent:'center',color:accent,WebkitTapHighlightColor:'transparent' }}>
                  <Volume2 size={14}/>
                </button>
              )}
              {/* Info */}
              <button onClick={()=>setShowInfo(true)} title="About Aura"
                style={{ width:34,height:34,borderRadius:10,background:'transparent',border:'none',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                  color:'rgba(255,255,255,0.32)',WebkitTapHighlightColor:'transparent',transition:'color .15s' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color=txtMut;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.32)';}}>
                <Info size={15}/>
              </button>
              {/* Clear chat */}
              <button onClick={()=>setShowClearConfirm(true)} title="Clear chat"
                style={{ width:34,height:34,borderRadius:10,background:'transparent',border:'none',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                  color:'rgba(255,255,255,0.32)',WebkitTapHighlightColor:'transparent',transition:'color .15s,background .15s' }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.color='#f87171'; el.style.background='rgba(239,68,68,0.1)'; }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.color='rgba(255,255,255,0.32)'; el.style.background='transparent'; }}>
                <Trash2 size={14}/>
              </button>
              {/* Minimize / close — desktop shows Minus (collapse), mobile shows X */}
              <button onClick={()=>setIsOpen(false)} title={isMobile?'Close':'Minimize'}
                style={{ width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.1)',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                  color:'rgba(255,255,255,0.55)',WebkitTapHighlightColor:'transparent',transition:'background .15s,color .15s' }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.13)'; el.style.color='#fff'; }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.06)'; el.style.color='rgba(255,255,255,0.55)'; }}>
                {isMobile ? <X size={15}/> : <Minus size={15} strokeWidth={2.5}/>}
              </button>
            </div>
          </div>

          {/* ── MESSAGES AREA ── */}
          <div className="nv-msgs" ref={messagesRef}
            style={{ flex:1,position:'relative',zIndex:1,padding:'12px 14px 8px',minHeight:0,WebkitOverflowScrolling:'touch' }}
            onScroll={()=>{ const el=messagesRef.current; if(!el) return; setShowScrollBtn(el.scrollHeight-el.scrollTop-el.clientHeight>120); }}>

            {/* Shimmer loading */}
            {!historyLoaded && (
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {[['45%','flex-start'],['68%','flex-end'],['52%','flex-start'],['40%','flex-end']].map(([w,a],i)=>(
                  <div key={i} style={{ height:42,width:w as string,alignSelf:a as any,borderRadius:16,
                    background:`linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(${pr},0.16) 50%,rgba(255,255,255,0.04) 100%)`,
                    backgroundSize:'200% 100%',animation:'nv-shim 1.6s infinite' }}/>
                ))}
              </div>
            )}

            {/* ── EMPTY STATE — Option 2 hero ghost ── */}
            {historyLoaded && messages.length===0 && (
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                minHeight:'100%',textAlign:'center',padding:'0 20px',gap:0 }}>
                <div style={{ marginBottom:isMobile?16:12 }}>
                  <HeroGhost primary={primary} accent={accent} size={isMobile?130:108} listening={false}/>
                </div>
                <div style={{ fontFamily:"'Sora',sans-serif",fontSize:isMobile?26:22,fontWeight:800,color:txtPri,lineHeight:1.2,marginBottom:10 }}>
                  Morning, <span style={{ color:accent }}>Sophia</span> ✦
                </div>
                <div style={{ fontSize:isMobile?14:12.5,color:txtMut,lineHeight:1.7,maxWidth:280,marginBottom:24 }}>
                  I'm Aura, your AI assistant. Ask me anything or try voice mode!
                </div>
                {/* Quick chips */}
                <div style={{ display:'flex',flexWrap:'wrap',gap:9,justifyContent:'center' }}>
                  {['My schedule','Study help','Submit exam?','Platform guide','🎙 Voice'].map((q,i)=>(
                    <button key={q} className="nv-chip-btn"
                      onClick={()=>{
                        if (q==='🎙 Voice'){ openVoiceMode(); startListening(); return; }
                        setInputMessage(q);
                        setTimeout(()=>handleSendMessage(q),0);
                      }}
                      style={{ padding:'8px 16px',borderRadius:24,
                        background:`rgba(${pr},0.14)`,border:`1px solid rgba(${pr},0.34)`,
                        color:txtMut,fontSize:isMobile?13:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',
                        fontFamily:"'Outfit',sans-serif",
                        animation:`nv-chip 0.4s cubic-bezier(0.22,1,0.36,1) ${i*0.06}s both` }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── MESSAGE LIST ── */}
            {historyLoaded && (()=>{
              let prev: string|null=null;
              return items.map((item,idx)=>{
                if (item.type==='sep'){
                  prev=null;
                  return (
                    <div key={item.key} style={{ display:'flex',alignItems:'center',gap:10,margin:'14px 0 6px' }}>
                      <div style={{ flex:1,height:1,background:`rgba(${pr},0.2)` }}/>
                      <span style={{ fontSize:10,color:txtDim,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap' }}>{item.label}</span>
                      <div style={{ flex:1,height:1,background:`rgba(${pr},0.2)` }}/>
                    </div>
                  );
                }
                const { msg }=item;
                const isFirst=msg.sender!==prev; prev=msg.sender;
                const next=items[idx+1];
                const nextSame=next?.type==='msg'&&next.msg.sender===msg.sender;
                const isUser=msg.sender==='user';
                return (
                  <div key={msg.id} className="nv-msg-enter"
                    style={{ display:'flex',alignItems:'flex-end',gap:8,flexDirection:isUser?'row-reverse':'row',marginBottom:5,marginTop:isFirst?12:0 }}>
                    {!isUser && (
                      <div style={{ width:28,height:28,borderRadius:9,flexShrink:0,alignSelf:'flex-end',
                        background:`linear-gradient(135deg,rgba(${pr},0.42),rgba(${ar},0.26))`,
                        border:`1px solid rgba(${pr},0.45)`,
                        display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',
                        boxShadow:`0 0 12px rgba(${pr},0.3)`,visibility:nextSame?'hidden':'visible' }}>
                        <MiniGhost size={20} primary={primary} accent={accent}/>
                      </div>
                    )}
                    <div style={{ display:'flex',flexDirection:'column',gap:3,maxWidth:'min(78%,480px)',alignItems:isUser?'flex-end':'flex-start' }}>
                      <div style={{ padding:'10px 14px',borderRadius:18,fontSize:13.5,lineHeight:1.65,wordBreak:'break-word',whiteSpace:'pre-wrap',
                        ...(isUser
                          ? { background:`linear-gradient(135deg,${primary},${accent})`,color:'#fff',borderBottomRightRadius:5,boxShadow:`0 2px 16px rgba(${ar},0.38)` }
                          : { background:bbAi,border:`1px solid ${bbAiBdr}`,color:txtPri,borderBottomLeftRadius:5 }) }}>
                        {msg.text}
                      </div>
                      {!nextSame && <span style={{ fontSize:10,color:txtDim,padding:'0 4px' }}>{fmt(msg.timestamp)}</span>}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display:'flex',alignItems:'flex-end',gap:8,marginTop:12 }}>
                <div style={{ width:28,height:28,borderRadius:9,flexShrink:0,
                  background:`linear-gradient(135deg,rgba(${pr},0.42),rgba(${ar},0.26))`,
                  border:`1px solid rgba(${pr},0.45)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
                  <MiniGhost size={20} primary={primary} accent={accent}/>
                </div>
                <div style={{ background:bbAi,border:`1px solid ${bbAiBdr}`,borderRadius:18,borderBottomLeftRadius:5 }}>
                  <TypingDots accent={accent}/>
                </div>
              </div>
            )}

            {/* Scroll FAB */}
            {showScrollBtn && (
              <button onClick={()=>scrollToBottom()}
                style={{ position:'sticky',bottom:6,display:'flex',alignSelf:'center',alignItems:'center',gap:5,
                  padding:'6px 14px 6px 11px',borderRadius:22,
                  background:'rgba(8,5,26,0.95)',border:`1px solid rgba(${pr},0.4)`,
                  color:txtMut,fontSize:12,fontWeight:600,cursor:'pointer',
                  boxShadow:`0 6px 22px rgba(0,0,0,.8),0 0 14px rgba(${pr},0.24)`,
                  animation:'nv-fab .18s ease',whiteSpace:'nowrap',fontFamily:"'Outfit',sans-serif",margin:'6px auto 0' }}>
                <ChevronDown size={13}/> New messages
              </button>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* ── INPUT BAR ── */}
          <div style={{ position:'relative',zIndex:3,flexShrink:0,
            padding: isMobile ? `10px 14px ${chromeBottomOffset + 12}px` : '10px 12px 12px',
            background:cosmicInp,borderTop:`1px solid ${cosmicBdr}`,
            backdropFilter:'blur(24px)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,
              background:surf2,border:`1px solid rgba(${pr},0.3)`,borderRadius:17,
              padding:'8px 8px 8px 14px' }}>
              <input ref={inputRef} type="text" className="nv-inp"
                value={inputMessage}
                onChange={e=>setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Aura anything…"
                disabled={isLoading}
                aria-label="Message input"
                style={{ flex:1,minWidth:0,background:'transparent',border:'none',color:txtPri,
                  fontSize:14,fontFamily:"'Outfit',sans-serif",padding:'3px 0',lineHeight:1.5,outline:'none',
                  WebkitTapHighlightColor:'transparent' }}/>

              {/* Mic — opens Aurora voice mode */}
              <button
                className={`nv-mic ${isListening?'listening':''}`}
                onClick={()=>{ openVoiceMode(); if(!isListening) startListening(); }}
                title="Voice mode"
                style={{ width:36,height:36,borderRadius:11,border:'none',cursor:'pointer',flexShrink:0,
                  background:isListening?`rgba(${ar},0.22)`:'rgba(255,255,255,0.07)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:isListening?accent:'rgba(255,255,255,0.45)' }}>
                <Mic size={15}/>
              </button>

              {/* Send */}
              <button className="nv-send"
                onClick={()=>handleSendMessage()}
                disabled={isLoading||!inputMessage.trim()}
                style={{ width:36,height:36,borderRadius:11,border:'none',cursor:'pointer',flexShrink:0,
                  background:(!isLoading&&inputMessage.trim())?gradient:'rgba(255,255,255,0.07)',
                  color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                  opacity:(!isLoading&&inputMessage.trim())?1:0.32,
                  boxShadow:(!isLoading&&inputMessage.trim())?`0 2px 16px rgba(${pr},.65)`:'none' }}>
                <Send size={14} strokeWidth={2.2}/>
              </button>
            </div>
          </div>

        </div>
      )}
    </>
  );

  return (
    <>
      <button onClick={handleGhostTap} className="nv-ghost" aria-label={isOpen?'Close Aura':'Open Aura'}>
        <GhostIcon size={72} isActive={isOpen}/>
      </button>
      {ReactDOM.createPortal(portal, document.body)}
    </>
  );
};

export default ChatbotWidget;
