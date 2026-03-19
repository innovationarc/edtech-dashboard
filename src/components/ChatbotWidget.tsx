// src/components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Send, X, AlertTriangle, Info, ChevronDown, ChevronLeft, Mic, MicOff, Volume2, Trash2, Minus } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { novaRAGService } from '../services/novaRAGService';
import { novaChatHistoryService, NovaChatMessage } from '../services/novaChatHistoryService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }

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
      <ellipse cx="80" cy="168" rx="42" ry="7" fill={`url(#${uid}-aura)`}>
        <animate attributeName="rx" values="42;56;42" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        <animate attributeName="opacity" values="0.6;1;0.6" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
      </ellipse>
      {[{cx:134,cy:32,r:3.2,d:'1.8s',op:'0.8'},{cx:148,cy:76,r:2,d:'2.4s',op:'0.5'},{cx:12,cy:52,r:2.6,d:'1.6s',op:'0.5'},{cx:18,cy:114,r:1.8,d:'3s',op:'0.4'},{cx:150,cy:130,r:2.2,d:'2.1s',op:'0.45'}].map((s,i)=>(
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={i%2===0 ? accent : bodyLight} opacity={parseFloat(s.op)}>
          <animate attributeName="opacity" values={`${s.op};0.05;${s.op}`} dur={s.d} repeatCount="indefinite"/>
          {i===0 && <animate attributeName="r" values="3.2;5;3.2" dur={s.d} repeatCount="indefinite"/>}
        </circle>
      ))}
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
        <ellipse cx="60"  cy="72" rx="11.5" ry={listening ? '15' : '12'} fill="#08051a">
          {listening && <animate attributeName="ry" values="12;16;12" dur="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>}
        </ellipse>
        <ellipse cx="64"  cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.72"/>
        <ellipse cx="100" cy="72" rx="11.5" ry={listening ? '15' : '12'} fill="#08051a">
          {listening && <animate attributeName="ry" values="12;16;12" dur="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>}
        </ellipse>
        <ellipse cx="104" cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.72"/>
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

const TypingDots: React.FC<{ accent: string }> = ({ accent }) => (
  <div style={{ display:'flex', gap:5, alignItems:'center', padding:'12px 14px' }}>
    {[0,0.18,0.36].map((delay,i)=>(
      <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:accent, display:'block',
        animation:`nv-tdot 1.3s ease-in-out ${delay}s infinite` }}/>
    ))}
  </div>
);

const AuroraWave: React.FC<{ accent: string; active: boolean }> = ({ accent, active }) => (
  <div style={{ display:'flex', alignItems:'center', gap:3, height:36 }}>
    {[1,2,3,4,5,6,7,6,5,4,3,2,1].map((h,i)=>(
      <div key={i} style={{
        width:3, borderRadius:3,
        background: active ? `linear-gradient(to top, ${accent}, ${hexLighten(accent,0.3)})` : accent,
        height: active ? `${h*3+4}px` : '4px',
        opacity: active ? 0.9 : 0.25,
        transition: 'height 0.12s ease, opacity 0.3s ease',
        animation: active ? `nv-wave ${0.38+i*0.06}s ease-in-out infinite alternate` : 'none',
      }}/>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ eyeOffset: _eyeOffset }) => {
  const { accentColor, primaryColor, theme, user, siteName, glitterTheme } = useDashboard();

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

  const [isListening, setIsListening]           = useState(false);
  const [voiceMode, setVoiceMode]               = useState(false);
  const [voiceModeVisible, setVoiceModeVisible] = useState(false);
  const [voiceTranscript, setVoiceTranscript]   = useState('');
  const [isSpeaking, setIsSpeaking]             = useState(false);
  const [voiceConversation, setVoiceConversation] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle'|'listening'|'thinking'|'speaking'>('idle');
  const [micPermission, setMicPermission] = useState<'unknown'|'granted'|'denied'>('unknown');

  const voiceConvRef   = useRef(false);
  const voiceLoopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsPrimedRef   = useRef(false);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voiceStatusRef = useRef<'idle'|'listening'|'thinking'|'speaking'>('idle');

  const messagesRef    = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const tapCount       = useRef(0);
  const tapTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlying       = useRef(false);
  const sessionId      = useRef(Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ── detect mobile / resize ────────────────────────────────────────────
  useEffect(()=>{
    const check = () => { setIsMobile(window.innerWidth < 768); setWinHeight(window.innerHeight); };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  },[]);

  // Keep voiceStatusRef in sync so STT callbacks can read it without stale closure
  useEffect(()=>{ voiceStatusRef.current = voiceStatus; },[voiceStatus]);
  useEffect(()=>{
    if (!window.speechSynthesis) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      // Priority: en-US female > en-US any > en-GB > en any > first available
      const enUS = voices.filter(v => v.lang.startsWith('en-US'));
      const enGB = voices.filter(v => v.lang.startsWith('en-GB'));
      const enAny = voices.filter(v => v.lang.startsWith('en'));
      const femaleKeywords = ['female','woman','zira','samantha','victoria','karen','moira','tessa','fiona'];
      const isFemale = (v: SpeechSynthesisVoice) => femaleKeywords.some(k => v.name.toLowerCase().includes(k));
      preferredVoiceRef.current =
        enUS.find(isFemale) ||
        enUS.find(v => !v.name.toLowerCase().includes('male')) ||
        enUS[0] ||
        enGB[0] ||
        enAny[0] ||
        voices[0] ||
        null;
    };
    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
  },[]);
  useEffect(()=>{
    if (!isMobile) return;
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top      = `-${scrollY}px`;
      document.body.style.width    = '100%';
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top      = '';
        document.body.style.width    = '';
        window.scrollTo(0, scrollY);
      };
    }
  },[isOpen, isMobile]);

  useEffect(()=>{
    window.dispatchEvent(new CustomEvent(isOpen ? 'nova-chat-open' : 'nova-chat-close'));
  },[isOpen]);

  // ── hiddenBefore: messages before this timestamp are hidden from UI (not deleted from DB) ──
  const hiddenBeforeKey = user?.uid ? `nova_hidden_before_${user.uid}` : null;
  const [hiddenBefore, setHiddenBefore] = useState<number>(() => {
    if (!user?.uid) return 0;
    try { return parseInt(localStorage.getItem(`nova_hidden_before_${user.uid}`) || '0', 10); } catch { return 0; }
  });

  useEffect(()=>{
    if (!user?.uid){ setHistoryLoaded(true); return; }
    const hb = (() => {
      try { return parseInt(localStorage.getItem(`nova_hidden_before_${user.uid}`) || '0', 10); } catch { return 0; }
    })();
    setHiddenBefore(hb);
    novaChatHistoryService.getHistory(user.uid)
      .then(h=>{
        // Filter out messages hidden by the user — DB keeps them for admin/logs
        const visible = hb > 0 ? h.filter(m => m.timestamp.getTime() > hb) : h;
        setMessages(visible);
        setHistoryLoaded(true);
      })
      .catch(()=>setHistoryLoaded(true));
  },[user?.uid]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    setShowScrollBtn(false);
  };

  useEffect(()=>{
    const el = messagesRef.current;
    if (!el || (el.scrollHeight - el.scrollTop - el.clientHeight < 100)) scrollToBottom();
    else setShowScrollBtn(true);
  },[messages, isLoading]);

  useEffect(()=>{
    if (isOpen){
      setTimeout(()=>setIsVisible(true), 10);
      setTimeout(()=>{ scrollToBottom('instant' as ScrollBehavior); inputRef.current?.focus(); }, 100);
    } else {
      setIsVisible(false);
      stopListening();
      closeVoiceMode();
    }
  },[isOpen]);

  useEffect(()=>{
    const close = () => { isFlying.current = true; setIsOpen(false); };
    const land  = () => { isFlying.current = false; };
    window.addEventListener('ghost-close-chat', close);
    window.addEventListener('ghost-land', land);
    return () => { window.removeEventListener('ghost-close-chat', close); window.removeEventListener('ghost-land', land); };
  },[]);

  // ── Voice ─────────────────────────────────────────────────────────────

  // Refs that hold live values without stale closures
  const isLoadingRef    = useRef(false);  // mirrors isLoading state — readable inside callbacks
  const stopSpeakingRef = useRef<()=>void>(()=>{});

  const stopListening = useCallback(()=>{
    if (recognitionRef.current){
      try{ recognitionRef.current.abort(); }catch(_){}
      recognitionRef.current = null;
    }
    setIsListening(false);
  },[]);

  const openVoiceMode  = useCallback(()=>{ setVoiceMode(true); setTimeout(()=>setVoiceModeVisible(true), 10); },[]);
  const closeVoiceMode = useCallback(()=>{
    voiceConvRef.current = false;
    setVoiceConversation(false);
    setVoiceStatus('idle');
    setVoiceModeVisible(false);
    if (voiceLoopTimer.current){ clearTimeout(voiceLoopTimer.current); voiceLoopTimer.current = null; }
    setTimeout(()=>{ setVoiceMode(false); setVoiceTranscript(''); }, 320);
  },[]);

  const stopSpeaking = useCallback(()=>{
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  },[]);

  // Keep stopSpeakingRef current so TTS callbacks can call it without stale closure
  useEffect(()=>{ stopSpeakingRef.current = stopSpeaking; },[stopSpeaking]);

  // ── Core STT ──────────────────────────────────────────────────────────
  // Pure function — no dependencies on React state/callbacks.
  // Uses only refs so it never goes stale between re-renders.
  const startListening = useCallback(()=>{
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec){
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // Abort any existing instance cleanly before starting a new one
    if (recognitionRef.current){
      try{ recognitionRef.current.abort(); }catch(_){}
      recognitionRef.current = null;
    }

    const rec = new SpeechRec();
    rec.lang            = 'en-US';
    rec.continuous      = false;   // false is the only reliable mode on Android/mobile
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    let lastTranscript = '';
    let finalFired     = false;
    let didProcess     = false;  // guard: ensure we process at most once per session

    const processTranscript = (text: string) => {
      if (didProcess || !text.trim()) return;
      didProcess = true;
      setVoiceTranscript('');
      if (voiceConvRef.current){
        setVoiceStatus('thinking');
        sendVoiceMessageRef.current(text.trim());
      } else {
        setInputMessage(text.trim());
      }
    };

    rec.onstart = () => {
      setIsListening(true);
      setVoiceStatus('listening');
      lastTranscript = '';
      finalFired     = false;
      didProcess     = false;
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const full = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
      setVoiceTranscript(full);
      lastTranscript = full;

      const latest = e.results[e.results.length - 1];
      if (latest.isFinal && !finalFired){
        finalFired = true;
        processTranscript(full);
      }
    };

    rec.onerror = (e: any) => {
      setIsListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){
        setMicPermission('denied');
        voiceConvRef.current = false;
        setVoiceConversation(false);
        setVoiceStatus('idle');
        return;
      }
      // aborted = we called abort() ourselves — not an error
      if (e.error === 'aborted') return;
      // For any other error, restart if still in conversation mode
      if (voiceConvRef.current){
        const delay = e.error === 'no-speech' ? 50 : 700;
        voiceLoopTimer.current = setTimeout(()=>{ if(voiceConvRef.current) startListening(); }, delay);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      // Android fallback: isFinal never fired but we got a transcript
      if (!didProcess && lastTranscript.trim()){
        processTranscript(lastTranscript);
        return; // processTranscript handles restart via sendVoiceMessageRef
      }
      // If we're still in listening phase (no transcript dispatched), restart loop
      if (voiceConvRef.current && voiceStatusRef.current === 'listening'){
        voiceLoopTimer.current = setTimeout(()=>{ if(voiceConvRef.current) startListening(); }, 100);
      }
    };

    recognitionRef.current = rec;
    try{ rec.start(); }catch(_){ /* already started — ignore */ }
    setIsListening(true);
    setVoiceStatus('listening');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);  // intentionally empty deps — uses only refs, never goes stale

  // ── TTS ───────────────────────────────────────────────────────────────
  const speakText = useCallback((text: string, onDone?: ()=>void)=>{
    if (!window.speechSynthesis){ onDone?.(); return; }
    window.speechSynthesis.cancel();

    // Clean markdown for spoken output
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .replace(/[-•]\s/g, '')
      .trim();

    // In voice mode, cap to 2 sentences to keep replies short and snappy
    const spoken = voiceConvRef.current && clean.length > 300
      ? clean.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
      : clean;

    const doSpeak = () => {
      const utt = new SpeechSynthesisUtterance(spoken);
      utt.rate   = 1.25;
      utt.pitch  = 1.05;
      utt.volume = 1;
      if (preferredVoiceRef.current) utt.voice = preferredVoiceRef.current;

      // Android Chrome: speechSynthesis silently pauses after ~14s — keep alive
      let keepAlive: ReturnType<typeof setInterval> | null = null;

      const onFinished = () => {
        if (keepAlive) clearInterval(keepAlive);
        setIsSpeaking(false);
        onDone?.();
        if (voiceConvRef.current){
          setVoiceStatus('listening');
          // Small gap so browser releases mic before we re-acquire it
          voiceLoopTimer.current = setTimeout(()=>{ if(voiceConvRef.current) startListening(); }, 120);
        } else {
          setVoiceStatus('idle');
        }
      };

      utt.onstart = () => {
        setIsSpeaking(true);
        setVoiceStatus('speaking');
        keepAlive = setInterval(()=>{
          if (!window.speechSynthesis.speaking){ clearInterval(keepAlive!); return; }
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }, 10000);
      };

      // Set onend BEFORE speak() — never overwrite it after
      utt.onend = onFinished;

      utt.onerror = (e) => {
        if ((e as any).error === 'interrupted') return; // normal on cancel()
        onFinished(); // treat errors the same as end — restart loop
      };

      window.speechSynthesis.speak(utt);
    };

    if (!preferredVoiceRef.current && !window.speechSynthesis.getVoices().length){
      const handler = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
        doSpeak();
      };
      window.speechSynthesis.addEventListener('voiceschanged', handler);
      setTimeout(doSpeak, 500); // fallback if event never fires
    } else {
      doSpeak();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);  // intentionally empty deps — uses only refs, never goes stale

  // ── sendVoiceMessageRef ───────────────────────────────────────────────
  // Defined as ref so STT callbacks can call it without stale closure.
  // Wired to handleSendMessage after it's defined below.
  const sendVoiceMessageRef = useRef<(text: string)=>void>(()=>{});

  const sendVoiceMessage = useCallback((text: string)=>{
    sendVoiceMessageRef.current(text);
  },[]);

  // ── Manual send from voice UI (tap arrow button) ──────────────────────
  const handleVoiceSend = useCallback(()=>{
    const text = (voiceTranscript || inputMessage).trim();
    stopListening();
    if (!text){ closeVoiceMode(); return; }
    setVoiceTranscript('');
    setVoiceStatus('thinking');
    sendVoiceMessage(text);
  },[voiceTranscript, inputMessage, stopListening, closeVoiceMode, sendVoiceMessage]);

  // ── Start/stop full conversation mode ─────────────────────────────────
  const startVoiceConversation = useCallback(()=>{
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => {
        // Release the test stream immediately — SpeechRecognition manages its own mic
        stream.getTracks().forEach(t => t.stop());
        setMicPermission('granted');
        // Prime TTS on user gesture so mobile doesn't block it
        if (!ttsPrimedRef.current && window.speechSynthesis){
          ttsPrimedRef.current = true;
          const silent = new SpeechSynthesisUtterance(' ');
          silent.volume = 0;
          window.speechSynthesis.speak(silent);
        }
        voiceConvRef.current = true;
        setVoiceConversation(true);
        setVoiceStatus('listening');
        startListening();
      })
      .catch(()=>{ setMicPermission('denied'); });
  },[startListening]);

  const stopVoiceConversation = useCallback(()=>{
    voiceConvRef.current = false;
    setVoiceConversation(false);
    setVoiceStatus('idle');
    stopListening();
    stopSpeaking();
    if (voiceLoopTimer.current){ clearTimeout(voiceLoopTimer.current); voiceLoopTimer.current = null; }
  },[stopListening, stopSpeaking]);

  // navigateTo suggestions — keyed by message id, shown as "Open" button instead of auto-navigating
  const navSuggestionsRef = useRef<Map<string, string>>(new Map());
  const [navSuggestions, setNavSuggestions] = useState<Map<string, string>>(new Map());

  // Detect if user explicitly asked to navigate to a page
  const isExplicitNavIntent = (msg: string): boolean => {
    const l = msg.toLowerCase();
    return [
      // "open" variants
      'open ','open the','open my',
      // "go" variants
      'go to','go to the','go to my',
      // "take me" variants
      'take me to','take me to the',
      // "navigate" variants
      'navigate to','navigate me to',
      // "bring/redirect/switch"
      'bring me to','redirect me to','switch to',
      // "jump/get/head"
      'jump to','get me to','head to',
      // "show me the page/tab/section"
      'show me the page','show me the tab','show me the section',
      // "i want to go"
      'i want to go to','i want to open','i want to see the',
      // "can you open/take"
      'can you open','can you take me','can you show me the',
      // "let me see/visit"
      'let me see the','let me visit','visit the',
      // direct page references with action
      'launch ','access the','load the',
    ].some(t => l.includes(t));
  };

  const handleSendMessage = useCallback(async (overrideText?: string, speakReply = false) => {
    const text = (overrideText ?? inputMessage).trim();
    if (!text) return;
    // For text chat, block if already loading. For voice, never block — the loop
    // must always be able to send the next message after TTS finishes.
    if (!speakReply && isLoading) return;
    // Also guard against concurrent voice calls via ref
    if (speakReply && isLoadingRef.current) return;

    const explicitNav = isExplicitNavIntent(text);
    setMessages(p=>[...p,{ id:`tmp-u-${Date.now()}`, text, sender:'user', timestamp:new Date(), sessionId:sessionId.current }]);
    setInputMessage('');
    setIsLoading(true);
    isLoadingRef.current = true;
    setErrorDetails('');
    if (speakReply) setVoiceStatus('thinking');
    setTimeout(()=>scrollToBottom('smooth'), 50);
    try {
      const res = await novaRAGService.sendMessage(text, user??null, sessionId.current, siteName, speakReply);
      const aiId = `tmp-a-${Date.now()}`;
      setMessages(p=>[...p,{ id:aiId, text:res.text, sender:'ai', timestamp:new Date(), sessionId:sessionId.current }]);
      if (speakReply){
        setVoiceStatus('speaking');
        speakText(res.text);
      }
      if (res.navigateTo){
        if (explicitNav){
          // User explicitly asked — replace AI text with a clean "Navigated to X" confirmation
          setMessages(p => p.map(m => m.id === aiId
            ? { ...m, text: `Navigated to ${pathName(res.navigateTo!)}` }
            : m
          ));
          setIsOpen(false); setIsVisible(false); isFlying.current = false;
          window.dispatchEvent(new CustomEvent('nova-navigate',{ detail:{ path:res.navigateTo } }));
          setTimeout(()=>window.dispatchEvent(new CustomEvent('ghost-land')), 300);
        } else {
          // AI suggested navigation but user didn't ask — show button, let user decide
          navSuggestionsRef.current = new Map(navSuggestionsRef.current).set(aiId, res.navigateTo);
          setNavSuggestions(new Map(navSuggestionsRef.current));
        }
      }
    } catch(err){
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorDetails(`Error: ${msg}\n\nPossible causes:\n1. No AI key configured (Admin → AI Model Settings → 'chatbot' group)\n2. No vector key configured (Admin → AI Model Settings → 'vector' group)\n3. CORS blocking\n4. Network issue\n5. Rate limit exceeded — failover exhausted`);
      setMessages(p=>[...p,{ id:`tmp-e-${Date.now()}`, text:'Something went wrong. Tap the info icon for details.', sender:'ai', timestamp:new Date(), sessionId:sessionId.current }]);
      if (voiceConvRef.current){
        setVoiceStatus('listening');
        voiceLoopTimer.current = setTimeout(()=>{ if(voiceConvRef.current) startListening(); }, 800);
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
      if (!voiceConvRef.current) setVoiceStatus('idle');
    }
  },[inputMessage, isLoading, user, siteName, speakText, startListening]);

  // Wire sendVoiceMessageRef immediately — NOT in useEffect — so it's always
  // current. useEffect has a render-cycle delay during which stale version fires.
  sendVoiceMessageRef.current = (text: string) => {
    handleSendMessage(text, true);
  };

  const handleGhostTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3){ tapCount.current = 0; if (!isOpen) window.dispatchEvent(new CustomEvent('ghost-fly')); }
    else { tapTimer.current = setTimeout(()=>{ if (tapCount.current===1 && !isFlying.current) setIsOpen(p=>!p); tapCount.current=0; }, 200); }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key==='Enter' && !e.shiftKey && !isLoading) handleSendMessage();
  };

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const dateSep = (d: Date) => {
    const t=new Date(), y=new Date(t); y.setDate(y.getDate()-1);
    if (d.toDateString()===t.toDateString()) return 'Today';
    if (d.toDateString()===y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month:'short', day:'numeric' });
  };

  const pathName = (path: string) => {
    const map: Record<string,string> = {
      '/student-study-plan':'Study Plan', '/student-dashboard':'Dashboard',
      '/dashboard':'Dashboard', '/teacher-dashboard':'Dashboard',
      '/student-tasks':'My Tasks', '/teacher-tasks':'Tasks',
      '/student-qa':'Ask Question', '/teacher-qa':'Questions',
      '/course-enrollment':'Courses', '/content-library':'Library',
      '/progress':'Progress', '/leaderboard':'Leaderboard',
      '/achievements':'Achievements', '/notifications':'Notifications',
      '/settings':'Settings', '/ai-settings':'AI Settings',
      '/exam-evaluation':'Exam Evaluation', '/users':'Users',
      '/analytics':'Analytics', '/announcements':'Announcements',
      '/course-creation':'Course Creation', '/payments':'Payments',
      '/live-classes':'Live Classes', '/live-exams':'Live Exams',
      '/streams':'Live Streams', '/student-live-exams':'Live Exams',
    };
    return map[path] || path.split('/').pop()?.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Page';
  };
  const items: DItem[] = [];
  let lastDate = '';
  for (const m of messages){
    const ds = m.timestamp.toDateString();
    if (ds !== lastDate){ items.push({ type:'sep', label:dateSep(m.timestamp), key:`sep-${ds}` }); lastDate=ds; }
    items.push({ type:'msg', msg:m });
  }

  // ── Theme ─────────────────────────────────────────────────────────────
  const dark    = theme !== 'light';
  const accent  = accentColor  || '#c084fc';
  const primary = primaryColor || '#7c3aed';
  const ar = hexToRgbStr(accent,  '192,132,252');
  const pr = hexToRgbStr(primary, '124,58,237');
  const gradient = `linear-gradient(135deg,${primary} 0%,${accent} 100%)`;

  // ── Exact same theme system as Navigation.tsx ─────────────────────────
  const isLight = theme === 'light';
  const themeBgColor: Record<string, string> = {
    dark:'#0d1117', light:'#ebe8e1', slate:'#0f172a',
    ocean:'#0c1a2e', forest:'#0a1f14', purple:'#1e1b4b',
    pink:'#831843', sunset:'#1c0a00',
  };
  const baseBg = themeBgColor[theme] ?? '#0d1117';

  // Glitter background image — same map as Navigation
  const glitterImageMap: Record<string, string> = {
    silver: isLight ? `
      radial-gradient(ellipse at 20% 20%, rgba(180,180,200,0.10) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 80%, rgba(160,160,180,0.08) 0%, transparent 45%),
      radial-gradient(circle at 30% 50%, rgba(180,180,200,0.75) 1px, transparent 1px),
      radial-gradient(circle at 70% 30%, rgba(160,160,180,0.70) 1px, transparent 1px),
      radial-gradient(circle at 50% 70%, rgba(180,180,200,0.72) 1px, transparent 1px),
      radial-gradient(circle at 15% 80%, rgba(160,160,180,0.65) 1px, transparent 1px),
      radial-gradient(circle at 85% 15%, rgba(180,180,200,0.68) 1px, transparent 1px),
      radial-gradient(circle at 40% 25%, rgba(200,200,220,0.70) 1px, transparent 1px),
      radial-gradient(circle at 65% 55%, rgba(160,160,180,0.60) 1px, transparent 1px),
      radial-gradient(circle at 20% 40%, rgba(180,180,200,0.65) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 20% 20%, rgba(200,200,220,0.08) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 80%, rgba(180,180,200,0.06) 0%, transparent 45%),
      radial-gradient(circle at 30% 50%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 30%, rgba(200,200,220,0.50) 0.5px, transparent 0.5px),
      radial-gradient(circle at 50% 70%, rgba(220,220,240,0.52) 0.5px, transparent 0.5px),
      radial-gradient(circle at 85% 60%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 60% 45%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
      radial-gradient(circle at 40% 15%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
      radial-gradient(circle at 90% 35%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px)
    `,
    gold: isLight ? `
      radial-gradient(ellipse at 15% 15%, rgba(180,130,0,0.09) 0%, transparent 45%),
      radial-gradient(ellipse at 85% 85%, rgba(150,110,0,0.07) 0%, transparent 45%),
      radial-gradient(circle at 25% 35%, rgba(160,120,0,0.72) 1px, transparent 1px),
      radial-gradient(circle at 75% 25%, rgba(180,140,0,0.68) 1px, transparent 1px),
      radial-gradient(circle at 45% 65%, rgba(160,120,0,0.70) 1px, transparent 1px),
      radial-gradient(circle at 80% 70%, rgba(180,140,0,0.62) 1px, transparent 1px),
      radial-gradient(circle at 10% 55%, rgba(160,120,0,0.65) 1px, transparent 1px),
      radial-gradient(circle at 60% 15%, rgba(180,140,0,0.72) 1px, transparent 1px),
      radial-gradient(circle at 35% 85%, rgba(160,120,0,0.58) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 15% 15%, rgba(212,175,55,0.12) 0%, transparent 45%),
      radial-gradient(ellipse at 85% 85%, rgba(180,140,30,0.08) 0%, transparent 45%),
      radial-gradient(circle at 25% 35%, rgba(212,175,55,0.60) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, rgba(255,215,0,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 65%, rgba(212,175,55,0.58) 0.5px, transparent 0.5px),
      radial-gradient(circle at 80% 70%, rgba(255,215,0,0.48) 0.5px, transparent 0.5px),
      radial-gradient(circle at 10% 55%, rgba(212,175,55,0.52) 0.5px, transparent 0.5px),
      radial-gradient(circle at 60% 15%, rgba(255,215,0,0.62) 0.5px, transparent 0.5px),
      radial-gradient(circle at 35% 85%, rgba(212,175,55,0.42) 0.5px, transparent 0.5px)
    `,
    purple: isLight ? `
      radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.10) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(79,70,229,0.08) 0%, transparent 45%),
      radial-gradient(circle at 30% 40%, rgba(99,102,241,0.65) 1px, transparent 1px),
      radial-gradient(circle at 70% 20%, rgba(79,70,229,0.60) 1px, transparent 1px),
      radial-gradient(circle at 55% 70%, rgba(99,102,241,0.62) 1px, transparent 1px),
      radial-gradient(circle at 15% 60%, rgba(79,70,229,0.55) 1px, transparent 1px),
      radial-gradient(circle at 88% 50%, rgba(99,102,241,0.60) 1px, transparent 1px),
      radial-gradient(circle at 45% 15%, rgba(79,70,229,0.65) 1px, transparent 1px),
      radial-gradient(circle at 75% 85%, rgba(99,102,241,0.50) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 20% 30%, rgba(139,92,246,0.12) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(99,102,241,0.10) 0%, transparent 45%),
      radial-gradient(circle at 30% 40%, rgba(200,180,255,0.70) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 20%, rgba(180,160,240,0.62) 0.5px, transparent 0.5px),
      radial-gradient(circle at 55% 70%, rgba(220,200,255,0.68) 0.5px, transparent 0.5px),
      radial-gradient(circle at 15% 60%, rgba(200,180,255,0.58) 0.5px, transparent 0.5px),
      radial-gradient(circle at 88% 50%, rgba(180,160,240,0.64) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 15%, rgba(220,200,255,0.72) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 85%, rgba(200,180,255,0.50) 0.5px, transparent 0.5px)
    `,
  };
  const glitterBgImage = glitterImageMap[glitterTheme] ?? '';
  const glitterBgSize = glitterTheme === 'silver'
    ? 'auto, auto, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px, 100px 100px, 85px 85px, 95px 95px'
    : glitterTheme === 'gold'
    ? 'auto, auto, 60px 60px, 90px 90px, 75px 75px, 110px 110px, 50px 50px, 80px 80px, 95px 95px'
    : glitterTheme === 'purple'
    ? 'auto, auto, 55px 55px, 85px 85px, 70px 70px, 100px 100px, 65px 65px, 90px 90px, 78px 78px'
    : 'auto';

  // Sparkle overlay — same as Navigation sidebar sparkle
  const sbSparkle = glitterBgImage
    ? glitterBgImage
    : `radial-gradient(ellipse at 20% 20%, rgba(${pr},0.18) 0%, transparent 60%),
       radial-gradient(ellipse at 80% 80%, rgba(${pr},0.12) 0%, transparent 50%),
       radial-gradient(ellipse at 50% 50%, ${dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'} 0%, transparent 70%)`;

  // Panel colors — derived from Navigation's exact border/shadow/bg system
  const cosmicBg  = baseBg;
  const cosmicHdr = baseBg;
  const cosmicInp = baseBg;
  const cosmicBdr = dark ? `rgba(${pr},0.22)` : `rgba(255,255,255,0.95)`;
  const panelBorder = dark ? `1px solid rgba(${pr},0.22)` : `1px solid rgba(255,255,255,0.95)`;
  const panelShadow = dark
    ? `0 24px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pr},0.12), 0 0 60px rgba(${pr},0.06)`
    : `0 24px 80px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pr},0.07)`;
  const hdrBorder = dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)';

  // Card surface — matches Settings page card backgrounds per theme
  const themeCardBg: Record<string, string> = {
    dark:'#1a1f2e', light:'#ffffff', slate:'#1e293b',
    ocean:'#0f2744', forest:'#0f2d1e', purple:'#312e81',
    pink:'#9d174d', sunset:'#431407',
  };
  const cardBg  = themeCardBg[theme] ?? '#1a1f2e';
  // Card border — always visible with enough contrast on all themes
  const cardBdr = `rgba(255,255,255,0.12)`;

  // Text colors — always readable on dark/saturated themes
  // All non-light themes are dark-surfaced so we use light text
  const txtPri = theme === 'light' ? '#111827' : '#f1f5f9';
  const txtMut = theme === 'light' ? '#6b7280' : '#94a3b8';
  const txtDim = theme === 'light' ? '#9ca3af' : '#475569';

  // AI message bubbles — white overlay on card for guaranteed lift on all themes
  const bbAi    = theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.10)';
  const bbAiBdr = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  const surf2   = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';
  const mBg  = theme === 'light' ? '#ffffff' : cardBg;
  const mBdr = theme === 'light' ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.12)';
  const mTxt = theme === 'light' ? '#111827' : '#f1f5f9';
  const mMut = theme === 'light' ? '#6b7280' : '#94a3b8';
  const mDim = theme === 'light' ? '#9ca3af' : '#64748b';
  const mS2  = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';
  const mS3  = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.09)';

  const desktopPanelW   = 380;
  const desktopPanelH   = 560;
  const desktopPanelTop = Math.max(16, winHeight - desktopPanelH - 16);

  // ── Portal ────────────────────────────────────────────────────────────
  const portal = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
        @keyframes nv-tdot  { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-7px);opacity:1} }
        @keyframes nv-pulse { 0%,100%{filter:drop-shadow(0 0 8px rgba(${ar},.5))} 50%{filter:drop-shadow(0 0 22px rgba(${ar},.9))} }
        @keyframes nv-fade  { from{opacity:0} to{opacity:1} }
        @keyframes nv-in    { from{opacity:0;transform:scale(0.97) translateY(14px)} to{opacity:1;transform:none} }
        @keyframes nv-shim  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes nv-dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes nv-fab   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes nv-wave  { from{transform:scaleY(0.4)} to{transform:scaleY(1.6)} }
        @keyframes nv-ring  { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.75} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
        @keyframes nv-chip  { 0%{transform:translateY(18px);opacity:0} 100%{transform:none;opacity:1} }
        @keyframes nv-aurora-1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(8px,-10px) scale(1.06)} }
        @keyframes nv-aurora-2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-6px,8px) scale(1.04)} }
        @keyframes nv-aurora-3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(10px,5px) scale(1.05)} }
        @keyframes nv-arc-spin   { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes nv-arc-spin-r { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
        @keyframes nv-arc-pulse  { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
        @keyframes nv-tendril    { 0%{stroke-dashoffset:300;opacity:0} 40%{opacity:0.9} 100%{stroke-dashoffset:0;opacity:0} }
        @keyframes nv-spark      { 0%{opacity:0;transform:scale(0)} 30%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0) translate(var(--sx),var(--sy))} }
        @keyframes nv-plasma     { 0%,100%{d:path('M80,40 Q110,60 80,80 Q50,100 80,120')} 50%{d:path('M80,40 Q50,60 80,80 Q110,100 80,120')} }
        @keyframes nv-energy-rot { 0%{stroke-dashoffset:500} 100%{stroke-dashoffset:0} }
        @keyframes nv-msg-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes nv-voice-slide-in  { from{opacity:0;transform:scale(1.03)} to{opacity:1;transform:none} }
        @keyframes nv-voice-slide-out { from{opacity:1;transform:none} to{opacity:0;transform:scale(1.03)} }
        .nv-ghost { animation:nv-pulse 3.4s ease-in-out infinite; transition:transform .22s cubic-bezier(.34,1.56,.64,1); background:none!important; border:none!important; padding:0!important; cursor:pointer; display:block; width:72px; height:72px; outline:none; }
        .nv-ghost:hover { animation:none; transform:scale(1.13); }
        .nv-msgs { overflow-y:auto!important; overflow-x:hidden; touch-action:pan-y; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
        .nv-msgs::-webkit-scrollbar { width:2px; }
        .nv-msgs::-webkit-scrollbar-track { background:transparent; }
        .nv-msgs::-webkit-scrollbar-thumb { background:rgba(${pr},0.35); border-radius:2px; }
        .nv-inp { outline:none!important; -webkit-tap-highlight-color:transparent!important; box-shadow:none!important; }
        .nv-inp:focus { outline:none!important; box-shadow:none!important; }
        .nv-inp::placeholder { color:${txtDim}; }
        .nv-btn { transition:background .13s,color .13s,transform .13s; }
        .nv-btn:hover { background:rgba(255,255,255,0.09)!important; color:${txtPri}!important; }
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

      {/* ── Clear Confirm Modal ── */}
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
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=mS2;}}>Cancel</button>
              <button onClick={()=>{
                  const now = Date.now();
                  setMessages([]);
                  setShowClearConfirm(false);
                  setHiddenBefore(now);
                  if (hiddenBeforeKey) {
                    try { localStorage.setItem(hiddenBeforeKey, String(now)); } catch {}
                  }
                }}
                style={{ flex:1,padding:'11px',borderRadius:13,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:'0 4px 16px rgba(220,38,38,.4)' }}>Clear Chat</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          AURORA VOICE MODE
          Mobile:  position:fixed top:0 bottom:0 left:0 right:0
          Desktop: floating panel
      ══════════════════════════════════════════════════════════════ */}
      {voiceMode && (
        <div style={{
          position:'fixed',
          ...(isMobile
            ? { top:0, bottom:0, left:0, right:0 }
            : { bottom:16, right:24, width:desktopPanelW, top:desktopPanelTop, borderRadius:28 }),
          zIndex:10002,
          overflow:'hidden',
          backgroundColor: baseBg,
          backgroundImage: glitterBgImage || sbSparkle,
          backgroundSize: glitterBgImage ? glitterBgSize : 'auto',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          fontFamily:"'Outfit',sans-serif",
          animation: voiceModeVisible
            ? 'nv-voice-slide-in 0.32s cubic-bezier(0.22,1,0.36,1) forwards'
            : 'nv-voice-slide-out 0.28s cubic-bezier(0.22,1,0.36,1) forwards',
          ...(!isMobile && { border:`1px solid rgba(${pr},0.35)`, boxShadow:`0 24px 80px rgba(0,0,0,0.9),0 0 40px rgba(${pr},0.2)` }),
        }}>
          {/* ── Electric Aura Background ── */}
          <div style={{ position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden' }}>

            {/* Deep ambient glow — shifts with status */}
            <div style={{ position:'absolute',inset:0,
              background: voiceStatus==='speaking'
                ? `radial-gradient(ellipse at 50% 40%, rgba(${ar},0.28) 0%, rgba(${pr},0.12) 45%, transparent 70%)`
                : voiceStatus==='listening'
                ? `radial-gradient(ellipse at 50% 40%, rgba(${pr},0.32) 0%, rgba(${ar},0.10) 45%, transparent 70%)`
                : `radial-gradient(ellipse at 50% 40%, rgba(${pr},0.18) 0%, transparent 65%)`,
              transition:'background 1.2s ease',
            }}/>

            {/* Rotating electric arc rings — SVG */}
            <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%' }} viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
              {/* Outer slow arc */}
              <circle cx="200" cy="310" r="155" fill="none"
                stroke={`rgba(${pr},0.22)`} strokeWidth="1"
                strokeDasharray="60 440" strokeLinecap="round"
                style={{ animation:'nv-arc-spin 12s linear infinite', transformOrigin:'200px 310px' }}/>
              {/* Mid counter-rotating arc */}
              <circle cx="200" cy="310" r="130" fill="none"
                stroke={`rgba(${ar},0.3)`} strokeWidth="1.5"
                strokeDasharray="40 370 20 370" strokeLinecap="round"
                style={{ animation:'nv-arc-spin-r 8s linear infinite', transformOrigin:'200px 310px' }}/>
              {/* Inner fast arc */}
              <circle cx="200" cy="310" r="108" fill="none"
                stroke={`rgba(${pr},0.35)`} strokeWidth="1"
                strokeDasharray="25 280 15 280" strokeLinecap="round"
                style={{ animation:'nv-arc-spin 5s linear infinite', transformOrigin:'200px 310px' }}/>

              {/* Electric tendrils — active when listening or speaking */}
              {(voiceStatus==='listening'||voiceStatus==='speaking') && [
                {x1:200,y1:180,x2:200+40,y2:130,d:'1.6s',off:'0s'},
                {x1:200,y1:180,x2:200-35,y2:125,d:'2.1s',off:'0.4s'},
                {x1:200,y1:180,x2:200+55,y2:155,d:'1.8s',off:'0.8s'},
                {x1:200,y1:180,x2:200-50,y2:160,d:'2.3s',off:'0.2s'},
                {x1:200,y1:180,x2:200+20,y2:110,d:'1.4s',off:'1.0s'},
              ].map((t,i)=>(
                <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                  stroke={i%2===0 ? `rgba(${ar},0.7)` : `rgba(${pr},0.6)`}
                  strokeWidth="1.2" strokeLinecap="round"
                  strokeDasharray="300" strokeDashoffset="300"
                  style={{ animation:`nv-tendril ${t.d} ease-in-out ${t.off} infinite` }}/>
              ))}

              {/* Energy dots orbiting */}
              {[0,60,120,180,240,300].map((deg,i)=>{
                const rad = deg * Math.PI / 180;
                const r = 140;
                const cx = 200 + r * Math.cos(rad);
                const cy = 310 + r * Math.sin(rad);
                return (
                  <circle key={i} cx={cx} cy={cy} r={i%2===0?2.5:1.5}
                    fill={i%2===0 ? `rgba(${ar},0.8)` : `rgba(${pr},0.6)`}
                    style={{ animation:`nv-arc-pulse ${1.5+i*0.3}s ease-in-out ${i*0.25}s infinite` }}/>
                );
              })}
            </svg>

            {/* Spark particles — burst on listening/speaking */}
            {(voiceStatus==='listening'||voiceStatus==='speaking') && [
              {x:'30%',y:'25%',sx:'−20px',sy:'−30px',d:'1.8s',o:'0s'},
              {x:'70%',y:'20%',sx:'18px', sy:'−25px',d:'2.1s',o:'0.3s'},
              {x:'20%',y:'55%',sx:'−15px',sy:'20px', d:'1.6s',o:'0.7s'},
              {x:'80%',y:'60%',sx:'22px', sy:'18px', d:'2.3s',o:'0.5s'},
              {x:'50%',y:'15%',sx:'0px',  sy:'−28px',d:'1.9s',o:'1.1s'},
              {x:'15%',y:'35%',sx:'−18px',sy:'10px', d:'2.0s',o:'0.9s'},
              {x:'85%',y:'40%',sx:'20px', sy:'−12px',d:'1.7s',o:'0.2s'},
            ].map((s,i)=>(
              <div key={i} style={{
                position:'absolute', left:s.x, top:s.y,
                width:3, height:3, borderRadius:'50%',
                background: i%2===0 ? `rgba(${ar},0.9)` : `rgba(${pr},0.8)`,
                boxShadow: i%2===0 ? `0 0 4px rgba(${ar},0.8)` : `0 0 4px rgba(${pr},0.8)`,
                ['--sx' as any]: s.sx, ['--sy' as any]: s.sy,
                animation:`nv-spark ${s.d} ease-out ${s.o} infinite`,
              }}/>
            ))}

            {/* Subtle corner energy wisps */}
            <div style={{ position:'absolute',top:0,left:0,width:'40%',height:'35%',
              background:`radial-gradient(ellipse at 0% 0%, rgba(${pr},0.18) 0%, transparent 60%)`,
              animation:'nv-aurora-1 7s ease-in-out infinite' }}/>
            <div style={{ position:'absolute',bottom:0,right:0,width:'40%',height:'35%',
              background:`radial-gradient(ellipse at 100% 100%, rgba(${ar},0.15) 0%, transparent 60%)`,
              animation:'nv-aurora-2 9s ease-in-out infinite' }}/>
          </div>

          {/* Header — paddingTop uses safe-area-inset-top */}
          <div style={{
            position:'absolute',top:0,left:0,right:0,
            paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 14px)' : '12px',
            paddingBottom:'10px', paddingLeft:'14px', paddingRight:'14px',
            background: dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)', backdropFilter:'blur(22px)',
            borderBottom: hdrBorder, zIndex:5,
            display:'flex', alignItems:'center', gap:8,
          }}>
            <button onClick={()=>{ stopVoiceConversation(); stopListening(); closeVoiceMode(); }}
              style={{ width:38,height:38,borderRadius:12,background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtMut,flexShrink:0,WebkitTapHighlightColor:'transparent' }}>
              <ChevronLeft size={20} strokeWidth={2.2}/>
            </button>
            <div style={{ width:32,height:32,borderRadius:11,background:`rgba(${pr},0.35)`,border:`1px solid rgba(${pr},0.6)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0 }}>
              <MiniGhost size={24} primary={primary} accent={accent}/>
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontFamily:"'Sora',sans-serif",fontSize:15,fontWeight:700,color:txtPri,lineHeight:1.2 }}>Aura</div>
              <div style={{ fontSize:11,color: dark ? '#a78bfa' : `rgb(${pr})`,fontWeight:500,marginTop:1 }}>
                {voiceStatus==='listening' ? 'Listening…' : voiceStatus==='thinking' ? 'Processing…' : voiceStatus==='speaking' ? 'Speaking…' : voiceConversation ? 'Conversation mode' : 'Voice Mode'}
              </div>
            </div>
            {isSpeaking && (
              <button onClick={()=>{ stopSpeaking(); if(voiceConvRef.current){ setVoiceStatus('listening'); voiceLoopTimer.current = setTimeout(()=>{ if(voiceConvRef.current) startListening(); },200); } }}
                style={{ width:34,height:34,borderRadius:10,background:`rgba(${ar},0.15)`,border:`1px solid rgba(${ar},0.35)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:accent }}>
                <Volume2 size={15}/>
              </button>
            )}
          </div>

          {/* Center content */}
          <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0,paddingTop:60,paddingBottom:100,zIndex:2 }}>

            {/* ── Mic permission denied screen ── */}
            {micPermission === 'denied' ? (
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:16,padding:'0 32px',textAlign:'center' }}>
                <div style={{ width:72,height:72,borderRadius:'50%',background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.4)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <MicOff size={32} color='#f87171'/>
                </div>
                <div style={{ fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:700,color:txtPri }}>
                  Microphone Blocked
                </div>
                <p style={{ fontSize:14,color:txtMut,lineHeight:1.65,margin:0 }}>
                  Aura needs microphone access to hear you. Please allow microphone permission in your browser settings, then try again.
                </p>
                <div style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:14,padding:'12px 16px',fontSize:12.5,color:'#fca5a5',lineHeight:1.6,textAlign:'left',width:'100%' }}>
                  <strong style={{ display:'block',marginBottom:4 }}>How to fix:</strong>
                  Tap the 🔒 lock icon in your browser address bar → Site settings → Microphone → Allow
                </div>
                <button
                  onClick={()=>{ setMicPermission('unknown'); startVoiceConversation(); }}
                  style={{ marginTop:4,padding:'11px 28px',borderRadius:13,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:`0 4px 16px rgba(${pr},0.4)` }}>
                  Try Again
                </button>
              </div>
            ) : (<>
            {/* Ghost + pulse rings */}
            <div style={{ position:'relative',display:'flex',alignItems:'center',justifyContent:'center' }}>
              {(isListening || isSpeaking) && (<>
                <div style={{ position:'absolute',top:'50%',left:'50%',width:isMobile?180:150,height:isMobile?180:150,borderRadius:'50%',border:`1.5px solid rgba(${ar},0.4)`,animation:'nv-ring 1.8s ease-out infinite' }}/>
                <div style={{ position:'absolute',top:'50%',left:'50%',width:isMobile?180:150,height:isMobile?180:150,borderRadius:'50%',border:`1px solid rgba(${ar},0.22)`,animation:'nv-ring 1.8s ease-out 0.65s infinite' }}/>
                <div style={{ position:'absolute',top:'50%',left:'50%',width:isMobile?180:150,height:isMobile?180:150,borderRadius:'50%',border:`1px solid rgba(${ar},0.12)`,animation:'nv-ring 1.8s ease-out 1.3s infinite' }}/>
              </>)}
              <HeroGhost primary={primary} accent={accent} size={isMobile?160:130} listening={isListening||isSpeaking}/>
            </div>

            {/* Status text */}
            <div style={{ fontFamily:"'Sora',sans-serif",fontSize:isMobile?22:18,fontWeight:700,color:txtPri,marginTop:20,textAlign:'center',minHeight:32 }}>
              {voiceStatus==='thinking'
                ? <><span style={{ color:accent }}>Aura</span> is processing…</>
                : voiceStatus==='speaking'
                ? <><span style={{ color:accent }}>Aura</span> is speaking…</>
                : voiceStatus==='listening'
                ? <><span style={{ color:accent }}>Aura</span> is listening…</>
                : voiceConversation
                ? 'Paused'
                : 'Tap to start'}
            </div>

            {/* Live transcript */}
            <div style={{ fontSize:isMobile?15:13,color: dark ? 'rgba(167,139,250,0.85)' : `rgba(${pr},0.7)`,textAlign:'center',maxWidth:isMobile?'80%':'85%',lineHeight:1.55,marginTop:8,padding:`0 ${isMobile?28:18}px`,minHeight:26,fontStyle:'italic' }}>
              {voiceTranscript || (voiceStatus==='listening' ? 'Say something…' : voiceStatus==='thinking' ? 'Processing…' : '')}
            </div>

            {/* Waveform */}
            <div style={{ marginTop:16 }}><AuroraWave accent={accent} active={isListening}/></div>

            {/* ── Buttons ── */}
            <div style={{ display:'flex',gap:isMobile?20:14,alignItems:'center',marginTop:isMobile?28:20 }}>

              {/* End / close */}
              <button onClick={()=>{ stopVoiceConversation(); stopListening(); closeVoiceMode(); setVoiceTranscript(''); }}
                style={{ width:isMobile?54:46,height:isMobile?54:46,borderRadius:'50%',
                  background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                  border: dark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtMut }}>
                <X size={isMobile?20:17}/>
              </button>

              {/* Main action button — big centre button */}
              {voiceConversation ? (
                // In conversation mode: tap to stop the loop
                <button onClick={stopVoiceConversation}
                  style={{ width:isMobile?82:68,height:isMobile?82:68,borderRadius:'50%',border:`3px solid rgba(${ar},0.6)`,cursor:'pointer',
                    background: gradient,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',
                    boxShadow:`0 0 0 6px rgba(${ar},0.18),0 4px 28px rgba(${pr},.65)`,
                    transition:'transform 0.15s cubic-bezier(.34,1.56,.64,1)',animation:'nv-pulse 2s ease-in-out infinite' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.06)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='scale(1)'}>
                  <MicOff size={isMobile?28:24}/>
                </button>
              ) : isListening ? (
                // Manual mode listening: tap to send
                <button onClick={handleVoiceSend}
                  style={{ width:isMobile?82:68,height:isMobile?82:68,borderRadius:'50%',border:'none',cursor:'pointer',
                    background:gradient,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',
                    boxShadow:`0 0 0 6px rgba(${ar},0.22),0 4px 28px rgba(${pr},.65)`,
                    transition:'transform 0.15s cubic-bezier(.34,1.56,.64,1)' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.08)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='scale(1)'}>
                  <Send size={isMobile?28:24}/>
                </button>
              ) : (
                // Idle: tap to start conversation mode
                <button onClick={startVoiceConversation}
                  style={{ width:isMobile?82:68,height:isMobile?82:68,borderRadius:'50%',border:'none',cursor:'pointer',
                    background:gradient,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',
                    boxShadow:`0 4px 28px rgba(${pr},.65),0 0 50px rgba(${ar},.2)`,
                    transition:'transform 0.15s cubic-bezier(.34,1.56,.64,1)' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.08)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='scale(1)'}>
                  <Mic size={isMobile?28:24}/>
                </button>
              )}

              {/* Interrupt / manual single listen */}
              <button
                onClick={()=>{
                  if (voiceConversation){
                    // Interrupt AI speech and start listening immediately
                    stopSpeaking();
                    setVoiceStatus('listening');
                    startListening();
                  } else if (isListening){
                    stopListening();
                  } else {
                    startListening();
                  }
                }}
                style={{ width:isMobile?54:46,height:isMobile?54:46,borderRadius:'50%',
                  background: (isListening && !voiceConversation) ? `rgba(${ar},0.18)` : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                  border: dark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                  color: (isListening && !voiceConversation) ? accent : voiceConversation ? accent : txtMut }}>
                {voiceConversation
                  ? <Mic size={isMobile?20:17}/>
                  : isListening
                  ? <MicOff size={isMobile?20:17}/>
                  : <Mic size={isMobile?20:17}/>}
              </button>
            </div>

            {/* Hint text */}
            <p style={{ fontSize:11,color: dark ? `rgba(${ar},0.55)` : `rgba(${pr},0.5)`,marginTop:16,textAlign:'center',letterSpacing:'0.03em',padding:'0 20px' }}>
              {voiceConversation
                ? isSpeaking
                  ? 'Tap mic to interrupt'
                  : 'Tap stop to end conversation'
                : isListening
                ? 'Tap ↗ to send · tap mic to cancel'
                : 'Tap mic to start a full conversation'}
            </p>
            </>)} {/* end micPermission check */}
          </div>

          {/* Bottom bar */}
          <div style={{
            position:'absolute',bottom:0,left:0,right:0,
            paddingTop:'8px',
            paddingLeft: isMobile ? '18px' : '14px',
            paddingRight: isMobile ? '18px' : '14px',
            paddingBottom: isMobile ? 'max(14px, env(safe-area-inset-bottom, 14px))' : '12px',
            background: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)', backdropFilter:'blur(20px)',
            borderTop: hdrBorder, zIndex:5, textAlign:'center',
          }}>
            <p style={{ fontSize:10,color: dark ? `rgba(${ar},0.45)` : `rgba(${pr},0.55)`,letterSpacing:'0.08em',fontFamily:"'Outfit',sans-serif",margin:0 }}>
              AURA · VOICE ASSISTANT · {voiceConversation ? 'CONVERSATION' : isListening ? 'LIVE' : 'READY'}
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MAIN CHAT PANEL
          Mobile:  position:fixed top:0 bottom:0 left:0 right:0
                   — overlays current page, page is NOT navigated away
                   — scroll position restored exactly on close
          Desktop: floating panel bottom-right
      ══════════════════════════════════════════════════════════════ */}
      {isOpen && (
        <div style={{
          position:'fixed',
          ...(isMobile
            ? { top:0, bottom:0, left:0, right:0 }
            : { bottom:16, right:24, width:desktopPanelW, top:desktopPanelTop, borderRadius:28, border: panelBorder }),
          zIndex:9999,
          backgroundColor: cosmicBg,
          backgroundImage: glitterBgImage || sbSparkle,
          backgroundSize: glitterBgImage ? glitterBgSize : 'auto',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? 'translateY(0) scale(1)'
            : isMobile ? 'translateY(24px)' : 'scale(0.96) translateY(14px)',
          pointerEvents: isVisible ? 'all' : 'none',
          transition:'opacity 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1)',
          fontFamily:"'Outfit',sans-serif",
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          ...(!isMobile && { boxShadow: panelShadow }),
        }}
          role="dialog" aria-label="Aura AI assistant"
          onTouchStart={e=>e.stopPropagation()}
        >
          {/* Noise sparkle texture overlay — same as Navigation sidebar */}
          <div style={{ position:'absolute',inset:0,pointerEvents:'none',zIndex:0,
            background:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            opacity: dark ? 0.04 : 0.025, mixBlendMode:'overlay' as const,
          }}/>
          {/* Color accent glows — same as Navigation sidebar */}
          <div style={{ position:'absolute',top:-30,left:'50%',transform:'translateX(-50%)',width:120,height:120,borderRadius:'50%',background:`radial-gradient(circle,rgba(${pr},${dark?0.28:0.18}) 0%,transparent 70%)`,pointerEvents:'none',zIndex:0,filter:'blur(20px)' }}/>
          <div style={{ position:'absolute',bottom:-20,right:-10,width:100,height:100,borderRadius:'50%',background:`radial-gradient(circle,rgba(${pr},${dark?0.20:0.12}) 0%,transparent 70%)`,pointerEvents:'none',zIndex:0,filter:'blur(18px)' }}/>

          {/* ── HEADER — sticky so it never scrolls away on mobile ── */}
          <div style={{
            position:'sticky', top:0, zIndex:3, flexShrink:0,
            display:'flex', alignItems:'center',
            padding: isMobile ? '0 6px 0 2px' : '0 8px 0 4px',
            paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 14px)' : undefined,
            minHeight: isMobile ? 'calc(64px + env(safe-area-inset-top, 0px) + 14px)' : '58px',
            backgroundColor: cosmicHdr,
            backgroundImage: glitterBgImage || `linear-gradient(135deg,rgba(${pr},0.22) 0%,transparent 60%)`,
            backgroundSize: glitterBgImage ? glitterBgSize : 'auto',
            borderBottom: hdrBorder,
            backdropFilter:'blur(20px)',
            WebkitBackdropFilter:'blur(20px)',
            boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.07)',
          }}>
            <div style={{ width:isMobile?40:34,height:isMobile?40:34,borderRadius:13,flexShrink:0,overflow:'hidden',background:`linear-gradient(135deg,rgba(${pr},0.42),rgba(${ar},0.26))`,border:`1px solid rgba(${pr},0.55)`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 18px rgba(${pr},0.42)`,marginLeft:10,marginRight:10 }}>
              <MiniGhost size={isMobile?30:25} primary={primary} accent={accent}/>
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:isMobile?17:15,fontWeight:700,color:txtPri,fontFamily:"'Sora',sans-serif",letterSpacing:'-0.02em',lineHeight:1.2 }}>Aura</div>
              <div style={{ display:'flex',alignItems:'center',gap:5,marginTop:2 }}>
                <span style={{ width:6,height:6,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 8px rgba(74,222,128,.8)',flexShrink:0,display:'inline-block',animation:'nv-dot 2.2s ease-in-out infinite' }}/>
                <span style={{ fontSize:11,color: dark ? 'rgba(74,222,128,0.8)' : '#16a34a',fontWeight:500,letterSpacing:'0.03em' }}>
                  {isSpeaking?'Speaking…':isListening?'Listening…':'AI Assistant · Online'}
                </span>
              </div>
            </div>
            <div style={{ display:'flex',gap:2,flexShrink:0,alignItems:'center',paddingRight:4 }}>
              {isSpeaking && (
                <button onClick={stopSpeaking} title="Stop speaking"
                  style={{ width:36,height:36,borderRadius:10,background:`rgba(${ar},0.15)`,border:`1px solid rgba(${ar},0.38)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:accent,WebkitTapHighlightColor:'transparent' }}>
                  <Volume2 size={14}/>
                </button>
              )}
              <button onClick={()=>setShowInfo(true)} title="About Aura"
                style={{ width:34,height:34,borderRadius:10,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtMut,WebkitTapHighlightColor:'transparent',transition:'color .15s' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color=txtPri;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color=txtMut;}}>
                <Info size={15}/>
              </button>
              <button onClick={()=>setShowClearConfirm(true)} title="Clear chat"
                style={{ width:34,height:34,borderRadius:10,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtMut,WebkitTapHighlightColor:'transparent',transition:'color .15s,background .15s' }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.color='#f87171'; el.style.background='rgba(239,68,68,0.1)'; }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.color=txtMut; el.style.background='transparent'; }}>
                <Trash2 size={14}/>
              </button>
              <button onClick={()=>setIsOpen(false)} title={isMobile?'Close':'Minimize'}
                style={{ width:34,height:34,borderRadius:10,
                  background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtMut,WebkitTapHighlightColor:'transparent',transition:'background .15s,color .15s' }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.background= dark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.1)'; el.style.color=txtPri; }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.background= dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; el.style.color=txtMut; }}>
                {isMobile ? <X size={15}/> : <Minus size={15} strokeWidth={2.5}/>}
              </button>
            </div>
          </div>

          {/* ── MESSAGES AREA — flex:1 + minHeight:0 fills all remaining space ── */}
          <div className="nv-msgs" ref={messagesRef}
            style={{ flex:1, position:'relative', zIndex:1, padding:'12px 14px 8px', minHeight:0, WebkitOverflowScrolling:'touch' }}
            onScroll={()=>{ const el=messagesRef.current; if(!el) return; setShowScrollBtn(el.scrollHeight-el.scrollTop-el.clientHeight>120); }}>

            {/* Shimmer loading */}
            {!historyLoaded && (
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {[['45%','flex-start'],['68%','flex-end'],['52%','flex-start'],['40%','flex-end']].map(([w,a],i)=>(
                  <div key={i} style={{ height:42,width:w as string,alignSelf:a as any,borderRadius:16,background:`linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(${pr},0.16) 50%,rgba(255,255,255,0.04) 100%)`,backgroundSize:'200% 100%',animation:'nv-shim 1.6s infinite' }}/>
                ))}
              </div>
            )}

            {/* Empty state */}
            {historyLoaded && messages.length===0 && (
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100%',textAlign:'center',padding:'0 20px',gap:0 }}>
                <div style={{ marginBottom:isMobile?16:12 }}>
                  <HeroGhost primary={primary} accent={accent} size={isMobile?130:108} listening={false}/>
                </div>
                <div style={{ fontFamily:"'Sora',sans-serif",fontSize:isMobile?26:22,fontWeight:800,color:txtPri,lineHeight:1.2,marginBottom:10 }}>
                  {(()=>{ const h=new Date().getHours(); return h<12?'Morning':h<17?'Afternoon':'Evening'; })()},{' '}
                  <span style={{ color:accent }}>
                    {user?.surname || user?.name?.split(' ')[0] || 'there'}
                  </span> ✦
                </div>
                <div style={{ fontSize:isMobile?14:12.5,color:txtMut,lineHeight:1.7,maxWidth:280,marginBottom:24 }}>
                  I'm Aura, your AI assistant. Ask me anything or try voice mode!
                </div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:9,justifyContent:'center' }}>
                  {['My schedule','Study help','Submit exam?','Platform guide','🎙 Voice'].map((q,i)=>(
                    <button key={q} className="nv-chip-btn"
                      onClick={()=>{ if (q==='🎙 Voice'){ openVoiceMode(); setTimeout(()=>startVoiceConversation(), 50); return; } setInputMessage(q); setTimeout(()=>handleSendMessage(q),0); }}
                      style={{ padding:'8px 16px',borderRadius:24,background:`rgba(${pr},0.14)`,border:`1px solid rgba(${pr},0.34)`,color:txtMut,fontSize:isMobile?13:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',fontFamily:"'Outfit',sans-serif",animation:`nv-chip 0.4s cubic-bezier(0.22,1,0.36,1) ${i*0.06}s both` }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {historyLoaded && (()=>{
              let prev: string|null = null;
              return items.map((item, idx)=>{
                if (item.type==='sep'){
                  prev = null;
                  return (
                    <div key={item.key} style={{ display:'flex',alignItems:'center',gap:10,margin:'14px 0 6px' }}>
                      <div style={{ flex:1,height:1,background:`rgba(${pr},0.2)` }}/>
                      <span style={{ fontSize:10,color:txtDim,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap' }}>{item.label}</span>
                      <div style={{ flex:1,height:1,background:`rgba(${pr},0.2)` }}/>
                    </div>
                  );
                }
                const { msg } = item;
                const isFirst = msg.sender !== prev; prev = msg.sender;
                const next = items[idx+1];
                const nextSame = next?.type==='msg' && next.msg.sender===msg.sender;
                const isUser = msg.sender==='user';
                return (
                  <div key={msg.id} className="nv-msg-enter"
                    style={{ display:'flex',alignItems:'flex-end',gap:8,flexDirection:isUser?'row-reverse':'row',marginBottom:5,marginTop:isFirst?12:0 }}>
                    {!isUser && (
                      <div style={{ width:28,height:28,borderRadius:9,flexShrink:0,alignSelf:'flex-end',background:`linear-gradient(135deg,rgba(${pr},0.42),rgba(${ar},0.26))`,border:`1px solid rgba(${pr},0.45)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',boxShadow:`0 0 12px rgba(${pr},0.3)`,visibility:nextSame?'hidden':'visible' }}>
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
                      {/* Open [Page] — full-width, matches AI bubble style */}
                      {!isUser && navSuggestions.has(msg.id) && (
                        <button
                          onClick={()=>{
                            const path = navSuggestions.get(msg.id)!;
                            setIsOpen(false); setIsVisible(false); isFlying.current = false;
                            window.dispatchEvent(new CustomEvent('nova-navigate',{ detail:{ path } }));
                            setTimeout(()=>window.dispatchEvent(new CustomEvent('ghost-land')), 300);
                          }}
                          style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            width:'100%', padding:'10px 14px',
                            borderRadius:18, borderBottomLeftRadius:5,
                            background: bbAi,
                            border:`1px solid rgba(${pr},0.45)`,
                            color:txtPri, fontSize:13.5, fontWeight:600,
                            cursor:'pointer', textAlign:'left',
                            fontFamily:"'Outfit',sans-serif",
                            boxShadow:`inset 0 0 0 1px rgba(${pr},0.1)`,
                            transition:'border-color .15s, background .15s',
                          }}
                          onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=`rgba(${pr},0.75)`; el.style.background=`rgba(${pr},0.12)`; }}
                          onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=`rgba(${pr},0.45)`; el.style.background=bbAi; }}>
                          <span>Open {pathName(navSuggestions.get(msg.id)!)}</span>
                          <span style={{ fontSize:15, opacity:0.7 }}>↗</span>
                        </button>
                      )}
                      {(()=>{
                        const prev = items[idx-1];
                        const gap = prev?.type==='msg'
                          ? msg.timestamp.getTime() - prev.msg.timestamp.getTime()
                          : Infinity;
                        return gap > 30 * 60 * 1000
                          ? <span style={{ fontSize:10,color:txtDim,padding:'0 4px' }}>{fmt(msg.timestamp)}</span>
                          : null;
                      })()}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display:'flex',alignItems:'flex-end',gap:8,marginTop:12 }}>
                <div style={{ width:28,height:28,borderRadius:9,flexShrink:0,background:`linear-gradient(135deg,rgba(${pr},0.42),rgba(${ar},0.26))`,border:`1px solid rgba(${pr},0.45)`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
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
                style={{ position:'sticky',bottom:6,display:'flex',alignSelf:'center',alignItems:'center',gap:5,padding:'6px 14px 6px 11px',borderRadius:22,background: dark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)',border:`1px solid rgba(${pr},0.4)`,color:txtMut,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:`0 6px 22px rgba(0,0,0,.4),0 0 14px rgba(${pr},0.24)`,animation:'nv-fab .18s ease',whiteSpace:'nowrap',fontFamily:"'Outfit',sans-serif",margin:'6px auto 0' }}>
                <ChevronDown size={13}/> New messages
              </button>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* ── INPUT BAR — floating card style matching Settings NoAnimCard ── */}
          <div style={{
            position:'relative', zIndex:3, flexShrink:0,
            padding: isMobile ? '10px 12px 14px' : '10px 12px 12px',
            backgroundColor: cosmicInp,
            backgroundImage: glitterBgImage || undefined,
            backgroundSize: glitterBgImage ? glitterBgSize : undefined,
            borderTop: hdrBorder,
            backdropFilter:'blur(20px)',
            WebkitBackdropFilter:'blur(20px)',
          }}>
            {/* Card container — same style as Settings NoAnimCard */}
            <div style={{
              display:'flex', alignItems:'center', gap:10,
              backgroundColor: cardBg,
              border: `1px solid ${cardBdr}`,
              borderRadius: 16,
              padding: '10px 10px 10px 16px',
              boxShadow: theme === 'light'
                ? `0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)`
                : `0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}>
              <input ref={inputRef} type="text" className="nv-inp"
                value={inputMessage}
                onChange={e=>setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Aura anything…"
                disabled={isLoading}
                aria-label="Message input"
                style={{ flex:1, minWidth:0, background:'transparent', border:'none', color:txtPri,
                  fontSize:15, fontFamily:"'Outfit',sans-serif", padding:'2px 0', lineHeight:1.5,
                  outline:'none', WebkitTapHighlightColor:'transparent' }}/>
              <button className={`nv-mic ${isListening?'listening':''}`}
                onClick={()=>{ openVoiceMode(); setTimeout(()=>startVoiceConversation(), 50); }}
                title="Voice conversation"
                style={{ width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer', flexShrink:0,
                  background: isListening ? `rgba(${ar},0.22)` : 'rgba(255,255,255,0.10)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: isListening ? accent : txtMut }}>
                <Mic size={16}/>
              </button>
              <button className="nv-send"
                onClick={()=>handleSendMessage()}
                disabled={isLoading||!inputMessage.trim()}
                style={{ width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer', flexShrink:0,
                  background: (!isLoading&&inputMessage.trim()) ? gradient : 'rgba(255,255,255,0.10)',
                  color: (!isLoading&&inputMessage.trim()) ? '#fff' : txtDim,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  opacity: (!isLoading&&inputMessage.trim()) ? 1 : 0.35,
                  boxShadow: (!isLoading&&inputMessage.trim()) ? `0 2px 12px rgba(${pr},.5)` : 'none',
                  transition:'opacity .15s, box-shadow .15s, background .15s' }}>
                <Send size={15} strokeWidth={2.2}/>
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
        <GhostIcon size={72} isActive={isOpen} isTalking={isSpeaking}/>
      </button>
      {ReactDOM.createPortal(portal, document.body)}
    </>
  );
};

export default ChatbotWidget;
