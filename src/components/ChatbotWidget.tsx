// src/components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Send, X, AlertTriangle, Info, ChevronDown, Mic, MicOff, Volume2 } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { novaRAGService } from '../services/novaRAGService';
import { novaChatHistoryService, NovaChatMessage } from '../services/novaChatHistoryService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }

// ── color helpers ─────────────────────────────────────────────────────────────
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

// ── Large floating ghost (hero in empty state) ────────────────────────────────
const HeroGhost: React.FC<{ primary: string; accent: string; size: number; listening: boolean }> = ({ primary, accent, size, listening }) => {
  const bodyLight = hexLighten(primary, 0.40);
  const bodyMid   = hexLighten(primary, 0.18);
  const bodyDark  = hexDarken(primary,  0.20);
  const uid = 'hg';
  return (
    <svg width={size} height={Math.round(size*1.1)} viewBox="0 0 160 175"
      xmlns="http://www.w3.org/2000/svg" style={{ overflow:'visible', display:'block' }}>
      <defs>
        <radialGradient id={`${uid}-aura`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={accent} stopOpacity={listening ? '0.7' : '0.45'}/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </radialGradient>
        <radialGradient id={`${uid}-body`} cx="38%" cy="20%" r="80%" fx="38%" fy="20%">
          <stop offset="0%"   stopColor={bodyLight}/>
          <stop offset="50%"  stopColor={bodyMid}/>
          <stop offset="100%" stopColor={bodyDark}/>
        </radialGradient>
        <filter id={`${uid}-glow`} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation={listening ? '7' : '5'} result="blur"/>
          <feFlood floodColor={accent} floodOpacity={listening ? '0.55' : '0.38'} result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="cb"/>
          <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* ground shadow */}
      <ellipse cx="80" cy="168" rx="42" ry="7" fill={`url(#${uid}-aura)`}>
        <animate attributeName="rx" values="42;54;42" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
      </ellipse>
      {/* sparkles */}
      {[{cx:132,cy:34,r:3,d:'1.8s',op:'0.8'},{cx:146,cy:78,r:2,d:'2.3s',op:'0.55'},{cx:14,cy:54,r:2.5,d:'1.6s',op:'0.5'},{cx:20,cy:112,r:1.8,d:'2.9s',op:'0.4'}].map((s,i)=>(
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={i%2===0 ? accent : bodyLight} opacity={parseFloat(s.op)}>
          <animate attributeName="opacity" values={`${s.op};0.1;${s.op}`} dur={s.d} repeatCount="indefinite"/>
          {i===0 && <animate attributeName="r" values="3;4.8;3" dur={s.d} repeatCount="indefinite"/>}
        </circle>
      ))}
      {/* body */}
      <g filter={`url(#${uid}-glow)`}>
        <animateTransform attributeName="transform" type="translate"
          values="0,0; 0,-14; 0,0" dur="2.6s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0.05 0.55 0.95;0.45 0.05 0.55 0.95"/>
        <path fill={`url(#${uid}-body)`}>
          <animate attributeName="d" dur="2.2s" repeatCount="indefinite" calcMode="spline"
            keySplines="0.5 0 0.5 1;0.5 0 0.5 1;0.5 0 0.5 1"
            values="
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,130 106,130 C100,130 96,152 80,152 C64,152 60,130 54,130 C48,130 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,127 106,127 C100,127 96,156 80,156 C64,156 60,127 54,127 C48,127 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,133 106,133 C100,133 96,149 80,149 C64,149 60,133 54,133 C48,133 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z;
              M80,12 C112,12 138,36 138,70 C138,96 138,118 138,130 C138,140 128,140 122,140 C116,140 112,130 106,130 C100,130 96,152 80,152 C64,152 60,130 54,130 C48,130 44,140 38,140 C32,140 22,140 22,130 C22,118 22,96 22,70 C22,36 48,12 80,12 Z"/>
        </path>
        <ellipse cx="58" cy="40" rx="14" ry="18" fill="white" opacity="0.08"/>
        {/* eyes — wide open when listening */}
        <ellipse cx="60"  cy="72" rx="11.5" ry={listening ? '14' : '12'} fill="#0f0a1e">
          {listening && <animate attributeName="ry" values="12;15;12" dur="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>}
        </ellipse>
        <ellipse cx="64"  cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.68"/>
        <ellipse cx="100" cy="72" rx="11.5" ry={listening ? '14' : '12'} fill="#0f0a1e">
          {listening && <animate attributeName="ry" values="12;15;12" dur="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>}
        </ellipse>
        <ellipse cx="104" cy="67" rx="3.2" ry="3.8" fill="white" opacity="0.68"/>
        {/* mouth */}
        {listening
          ? <ellipse cx="80" cy="106" rx="9" ry="10" fill="#0f0a1e" opacity="0.9">
              <animate attributeName="ry" values="8;12;8" dur="0.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
            </ellipse>
          : <path d="M67,102 Q80,117 93,102" stroke="#0f0a1e" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.85"/>
        }
        <ellipse cx="50"  cy="88" rx="10" ry="6" fill="#f472b6" opacity="0.18"/>
        <ellipse cx="110" cy="88" rx="10" ry="6" fill="#f472b6" opacity="0.18"/>
      </g>
    </svg>
  );
};

// ── Small ghost for header / message avatars ──────────────────────────────────
const MiniGhost: React.FC<{ size: number; primary: string; accent: string }> = ({ size, primary, accent }) => {
  const top = hexLighten(primary, 0.42);
  const mid = hexLighten(primary, 0.15);
  const bot = hexDarken(primary,  0.15);
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
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feFlood floodColor={accent} floodOpacity="0.45" result="c"/>
          <feComposite in="c" in2="blur" operator="in" result="cb"/>
          <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter={`url(#${uid}f)`}>
        <path fill={`url(#${uid}b)`}
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

// ── Typing dots ───────────────────────────────────────────────────────────────
const TypingDots: React.FC<{ accent: string }> = ({ accent }) => (
  <div style={{ display:'flex', gap:5, alignItems:'center', padding:'11px 14px' }}>
    {[0, 0.18, 0.36].map((delay, i) => (
      <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:accent, display:'block',
        animation:`aura-tdot 1.3s ease-in-out ${delay}s infinite` }}/>
    ))}
  </div>
);

// ── Voice waveform bars ───────────────────────────────────────────────────────
const VoiceWave: React.FC<{ accent: string; active: boolean }> = ({ accent, active }) => (
  <div style={{ display:'flex', alignItems:'center', gap:3, height:28 }}>
    {[1,2,3,4,5,4,3,2,1].map((h, i) => (
      <div key={i} style={{
        width: 3, borderRadius: 2,
        background: accent,
        height: active ? `${h * 4 + 4}px` : '4px',
        opacity: active ? 0.9 : 0.3,
        transition: 'height 0.15s ease, opacity 0.3s ease',
        animation: active ? `aura-wave ${0.4 + i*0.07}s ease-in-out infinite alternate` : 'none',
      }}/>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
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

  // voice state
  const [isListening, setIsListening]     = useState(false);
  const [voiceMode, setVoiceMode]         = useState(false);   // "Aura is listening" full-screen overlay
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isSpeaking, setIsSpeaking]       = useState(false);   // TTS playing

  const messagesRef    = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const tapCount       = useRef(0);
  const tapTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlying       = useRef(false);
  const sessionId      = useRef(Date.now().toString(36) + Math.random().toString(36).slice(2,8));
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef       = useRef<SpeechSynthesisUtterance | null>(null);

  // ── resize lock body scroll when fullscreen open ──────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(isOpen ? 'nova-chat-open' : 'nova-chat-close'));
  }, [isOpen]);

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
      setTimeout(() => { scrollToBottom('instant' as ScrollBehavior); inputRef.current?.focus(); }, 100);
    } else {
      setIsVisible(false);
      stopListening();
      setVoiceMode(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const close = () => { isFlying.current = true; setIsOpen(false); };
    const land  = () => { isFlying.current = false; };
    window.addEventListener('ghost-close-chat', close);
    window.addEventListener('ghost-land', land);
    return () => { window.removeEventListener('ghost-close-chat', close); window.removeEventListener('ghost-land', land); };
  }, []);

  // ── Voice / Speech ────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(_e) { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRec = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
                   || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    stopListening();
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onstart  = () => setIsListening(true);
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setVoiceTranscript(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        setInputMessage(transcript);
        setVoiceTranscript('');
      }
    };
    rec.onerror = () => { setIsListening(false); setVoiceMode(false); };
    rec.onend   = () => { setIsListening(false); };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setVoiceMode(true);
  }, [stopListening]);

  const speakText = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1.1;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend   = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const handleVoiceSend = useCallback(() => {
    if (voiceTranscript.trim()) {
      setInputMessage(voiceTranscript.trim());
      setVoiceTranscript('');
    }
    stopListening();
    setVoiceMode(false);
  }, [voiceTranscript, stopListening]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputMessage).trim();
    if (!text || isLoading) return;
    setMessages(p => [...p, { id:`tmp-u-${Date.now()}`, text, sender:'user', timestamp:new Date(), sessionId:sessionId.current }]);
    setInputMessage(''); setIsLoading(true); setErrorDetails('');
    setVoiceMode(false);
    try {
      const res = await novaRAGService.sendMessage(text, user ?? null, sessionId.current, siteName);
      setMessages(p => [...p, { id:`tmp-a-${Date.now()}`, text:res.text, sender:'ai', timestamp:new Date(), sessionId:sessionId.current }]);
      speakText(res.text);
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
  }, [inputMessage, isLoading, user, siteName, speakText]);

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

  // ── Theme palette ─────────────────────────────────────────────────────────
  const dark    = theme !== 'light';
  const accent  = accentColor  || '#c084fc';
  const primary = primaryColor || '#7c3aed';
  const ar = hexToRgbStr(accent,  '192,132,252');
  const pr = hexToRgbStr(primary, '124,58,237');
  const gradient = `linear-gradient(135deg,${primary} 0%,${accent} 100%)`;

  // Full-screen panel — always dark-onboarding themed
  const panelBg  = dark ? 'rgba(10,6,22,0.98)' : 'rgba(18,10,38,0.97)';
  const hdrBg    = dark ? 'rgba(10,6,22,0.88)' : 'rgba(14,8,30,0.88)';
  const inpBg    = dark ? 'rgba(10,6,22,0.92)' : 'rgba(14,8,30,0.92)';
  const bdr      = `rgba(${pr},0.28)`;
  const txtPri   = '#f0eeff';
  const txtMut   = '#a89fc2';
  const txtDim   = '#695e88';
  const bbAi     = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.10)';
  const bbAiBdr  = `rgba(${pr},0.25)`;
  const surf2    = 'rgba(255,255,255,0.05)';

  // Light-mode modal colors (modals use app theme)
  const mBg   = dark ? 'rgba(12,8,26,0.98)' : 'rgba(255,255,255,0.98)';
  const mBdr  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const mTxt  = dark ? '#f0eeff'               : '#111827';
  const mMut  = dark ? '#a89fc2'               : '#6b7280';
  const mDim  = dark ? '#695e88'               : '#9ca3af';
  const mS2   = dark ? 'rgba(255,255,255,0.05)': 'rgba(0,0,0,0.04)';
  const mS3   = dark ? 'rgba(255,255,255,0.08)': 'rgba(0,0,0,0.06)';

  const HDR_H = 64;

  // ── Portal ────────────────────────────────────────────────────────────────
  const portal = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Outfit:wght@400;500;600;700&display=swap');

        @keyframes aura-tdot  { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-7px);opacity:1} }
        @keyframes aura-pulse { 0%,100%{filter:drop-shadow(0 0 8px rgba(${ar},.55)) drop-shadow(0 4px 18px rgba(0,0,0,.5))} 50%{filter:drop-shadow(0 0 24px rgba(${ar},.9)) drop-shadow(0 8px 28px rgba(0,0,0,.6))} }
        @keyframes aura-fade  { from{opacity:0} to{opacity:1} }
        @keyframes aura-in    { from{opacity:0;transform:scale(0.96) translateY(16px)} to{opacity:1;transform:none} }
        @keyframes aura-out   { from{opacity:1;transform:none} to{opacity:0;transform:scale(0.96) translateY(16px)} }
        @keyframes aura-shim  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes aura-dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(.78)} }
        @keyframes aura-fab   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes aura-wave  { from{transform:scaleY(0.5)} to{transform:scaleY(1.5)} }
        @keyframes aura-ring  { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.2);opacity:0} }
        @keyframes aura-fs-in { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:none} }
        @keyframes aura-chip  { 0%{transform:translateY(20px);opacity:0} 100%{transform:none;opacity:1} }

        .nvchat-ghost { animation:aura-pulse 3.4s ease-in-out infinite; transition:transform .2s cubic-bezier(.34,1.56,.64,1); background:none!important; border:none!important; padding:0!important; cursor:pointer; display:block; width:72px; height:72px; outline:none }
        .nvchat-ghost:hover { animation:none; transform:scale(1.12) }

        .nvchat-msgs { overflow-y:auto!important; overflow-x:hidden; touch-action:pan-y; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
        .nvchat-msgs::-webkit-scrollbar { width:3px }
        .nvchat-msgs::-webkit-scrollbar-track { background:transparent }
        .nvchat-msgs::-webkit-scrollbar-thumb { background:rgba(${pr},0.3); border-radius:3px }

        .aura-inp { outline:none!important; -webkit-tap-highlight-color:transparent!important; box-shadow:none!important; }
        .aura-inp:focus { outline:none!important; box-shadow:none!important; }
        .aura-inp::placeholder { color:${txtDim}; }

        .aura-btn { transition:background .13s,color .13s,transform .13s; }
        .aura-btn:hover { background:rgba(255,255,255,0.09)!important; color:${txtPri}!important; }
        .aura-btn-close:hover { background:rgba(239,68,68,.14)!important; color:#f87171!important; }

        .aura-chip-btn { transition:background .15s,border-color .15s,transform .15s,opacity .15s; }
        .aura-chip-btn:hover { background:rgba(${pr},0.24)!important; border-color:rgba(${ar},0.55)!important; transform:translateY(-2px)!important; }

        .aura-send { transition:transform .15s cubic-bezier(.34,1.56,.64,1),opacity .15s,box-shadow .15s; }
        .aura-send:hover:not(:disabled) { transform:scale(1.12)!important; }

        .aura-mic-btn { transition:transform .15s cubic-bezier(.34,1.56,.64,1),box-shadow .2s; }
        .aura-mic-btn:hover { transform:scale(1.08)!important; }
        .aura-mic-btn.listening { box-shadow:0 0 0 4px rgba(${ar},0.25),0 0 20px rgba(${ar},0.4)!important; }
        .aura-mic-btn.listening::after { content:''; position:absolute; inset:-8px; border-radius:50%; border:2px solid rgba(${ar},0.5); animation:aura-ring 1.5s ease-out infinite; }

        .aura-voice-btn { transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s; position:relative; }
        .aura-voice-btn:hover { transform:scale(1.05)!important; }
        .aura-voice-btn.active { box-shadow:0 0 0 6px rgba(${ar},0.2),0 0 32px rgba(${ar},0.5)!important; }

        .aura-stop-btn { transition:transform .15s,box-shadow .15s; }
        .aura-stop-btn:hover { transform:scale(1.05)!important; box-shadow:0 0 0 4px rgba(239,68,68,0.2)!important; }

        .aura-fullscreen { animation:aura-fs-in 0.35s cubic-bezier(0.22,1,0.36,1) forwards; }

        .aura-msg-enter { animation:aura-in 0.28s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>

      {/* ── Info Modal ── */}
      {showInfo && (
        <div onClick={()=>setShowInfo(false)} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,animation:'aura-fade .16s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:mBg,backdropFilter:'blur(40px)',border:`1px solid ${mBdr}`,borderRadius:24,width:'min(420px,100%)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.85)',animation:'aura-in .2s cubic-bezier(.22,1,.36,1)' }}>
            <div style={{ padding:'16px 18px',borderBottom:`1px solid ${mBdr}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:11 }}>
                <div style={{ width:32,height:32,borderRadius:11,background:gradient,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden',boxShadow:`0 4px 14px rgba(${pr},.5)` }}>
                  <MiniGhost size={24} primary={primary} accent={accent}/>
                </div>
                <span style={{ color:mTxt,fontWeight:700,fontSize:15,fontFamily:"'Sora',sans-serif" }}>About Aura</span>
              </div>
              <button onClick={()=>setShowInfo(false)} className="aura-btn" style={{ width:30,height:30,borderRadius:9,background:mS3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:mDim }}><X size={15}/></button>
            </div>
            <div style={{ padding:18,display:'flex',flexDirection:'column',gap:12 }}>
              <p style={{ fontSize:13.5,color:mMut,lineHeight:1.7,margin:0 }}>Aura is your AI assistant — here to help with platform questions, studies, scheduling, and anything else. She also supports voice chat!</p>
              <div style={{ background:mS2,border:`1px solid ${mBdr}`,borderRadius:14,padding:'13px 15px',fontSize:13,color:mMut,lineHeight:1.65 }}>
                <strong style={{ color:mTxt,display:'block',marginBottom:7 }}>✦ Capabilities</strong>
                <ul style={{ paddingLeft:16,margin:0,display:'flex',flexDirection:'column',gap:5 }}>
                  <li>Platform navigation & feature help</li>
                  <li>Study guidance & concept explanations</li>
                  <li>Assignment and schedule queries</li>
                  <li>Voice input & text-to-speech responses</li>
                  <li>Powered by Admin → AI Model Settings</li>
                </ul>
              </div>
              <div style={{ background:`rgba(${pr},.09)`,border:`1px solid rgba(${pr},.3)`,borderRadius:14,padding:'12px 15px',fontSize:13,color:mMut,lineHeight:1.65 }}>
                <strong style={{ color:accent,display:'block',marginBottom:5 }}>🎙 Voice tip</strong>
                Tap the mic button to speak your question. Aura will respond in voice too.
              </div>
              <button onClick={()=>setShowInfo(false)} style={{ width:'100%',padding:'11px',borderRadius:13,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:`0 4px 16px rgba(${pr},.5)`,letterSpacing:'0.01em' }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Modal ── */}
      {errorDetails && (
        <div onClick={()=>setErrorDetails('')} style={{ position:'fixed',inset:0,zIndex:10001,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,animation:'aura-fade .16s ease',fontFamily:"'Outfit',sans-serif" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:mBg,backdropFilter:'blur(40px)',border:`1px solid ${mBdr}`,borderRadius:24,width:'min(420px,100%)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.85)',animation:'aura-in .2s cubic-bezier(.22,1,.36,1)' }}>
            <div style={{ padding:'16px 18px',borderBottom:`1px solid ${mBdr}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:9 }}><AlertTriangle size={16} style={{ color:'#f87171' }}/><span style={{ color:mTxt,fontWeight:700,fontSize:15 }}>Error Details</span></div>
              <button onClick={()=>setErrorDetails('')} className="aura-btn" style={{ width:30,height:30,borderRadius:9,background:mS3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:mDim }}><X size={15}/></button>
            </div>
            <div style={{ padding:18,display:'flex',flexDirection:'column',gap:12 }}>
              <pre style={{ fontSize:11.5,color:'#f87171',background:mS2,padding:13,borderRadius:11,whiteSpace:'pre-wrap',overflowX:'auto',fontFamily:'ui-monospace,monospace',lineHeight:1.65,border:`1px solid ${mBdr}`,margin:0 }}>{errorDetails}</pre>
              <button onClick={()=>setErrorDetails('')} style={{ width:'100%',padding:'11px',borderRadius:13,border:'none',cursor:'pointer',background:gradient,color:'#fff',fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FULL-SCREEN CHAT PANEL
      ══════════════════════════════════════════════════════════════════════ */}
      {isOpen && (
        <div
          className="aura-fullscreen"
          style={{
            position:'fixed', inset:0, zIndex:9999,
            background:panelBg,
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? 'all' : 'none',
            transition:'opacity 0.3s ease',
            fontFamily:"'Outfit',sans-serif",
            display:'flex', flexDirection:'column',
            overflow:'hidden',
          }}
          role="dialog"
          aria-label="Aura AI assistant"
          onTouchStart={e => e.stopPropagation()}
        >
          {/* ── Background atmosphere ── */}
          <div style={{ position:'absolute',inset:0,pointerEvents:'none',zIndex:0 }}>
            {/* top-left glow */}
            <div style={{ position:'absolute',top:-100,left:-80,width:500,height:500,borderRadius:'50%',
              background:`radial-gradient(circle,rgba(${pr},0.28) 0%,transparent 65%)`,filter:'blur(60px)' }}/>
            {/* bottom-right accent glow */}
            <div style={{ position:'absolute',bottom:-120,right:-80,width:450,height:450,borderRadius:'50%',
              background:`radial-gradient(circle,rgba(${ar},0.18) 0%,transparent 65%)`,filter:'blur(55px)' }}/>
            {/* star field */}
            {[{x:'15%',y:'12%',s:2},{x:'82%',y:'8%',s:1.5},{x:'70%',y:'35%',s:1},{x:'8%',y:'55%',s:1.5},{x:'90%',y:'60%',s:2},{x:'45%',y:'82%',s:1},{x:'28%',y:'70%',s:1.5},{x:'60%',y:'90%',s:1}].map((star,i)=>(
              <div key={i} style={{ position:'absolute',left:star.x,top:star.y,width:star.s,height:star.s,borderRadius:'50%',
                background:`rgba(${ar},0.6)`,animation:`aura-dot ${2+i*0.3}s ease-in-out ${i*0.4}s infinite` }}/>
            ))}
          </div>

          {/* ── HEADER ── */}
          <div style={{
            position:'relative', zIndex:3, flexShrink:0, height:HDR_H,
            display:'flex', alignItems:'center', gap:12, padding:'0 20px',
            background:hdrBg,
            backgroundImage:`linear-gradient(135deg,rgba(${pr},0.16) 0%,transparent 55%)`,
            borderBottom:`1px solid ${bdr}`,
            backdropFilter:'blur(24px)',
          }}>
            <div style={{
              width:42,height:42,borderRadius:15,flexShrink:0,overflow:'hidden',
              background:`linear-gradient(135deg,rgba(${pr},0.38),rgba(${ar},0.24))`,
              border:`1px solid rgba(${pr},0.5)`,
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:`0 0 18px rgba(${pr},0.38),inset 0 1px 0 rgba(255,255,255,0.1)`
            }}>
              <MiniGhost size={32} primary={primary} accent={accent}/>
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:16,fontWeight:700,color:txtPri,fontFamily:"'Sora',sans-serif",letterSpacing:'-0.02em',lineHeight:1.2 }}>Aura</div>
              <div style={{ display:'flex',alignItems:'center',gap:5,marginTop:2 }}>
                <span style={{ width:6,height:6,borderRadius:'50%',background:'#4ade80',
                  boxShadow:'0 0 8px rgba(74,222,128,.8)',flexShrink:0,display:'inline-block',
                  animation:'aura-dot 2.2s ease-in-out infinite' }}/>
                <span style={{ fontSize:11,color:txtDim,fontWeight:500,letterSpacing:'0.03em' }}>
                  {isSpeaking ? 'Speaking…' : isListening ? 'Listening…' : 'AI Assistant · Online'}
                </span>
              </div>
            </div>
            <div style={{ display:'flex',gap:4,flexShrink:0,alignItems:'center' }}>
              {isSpeaking && (
                <button onClick={stopSpeaking} className="aura-btn aura-stop-btn" title="Stop speaking"
                  style={{ width:32,height:32,borderRadius:10,background:`rgba(${ar},0.15)`,border:`1px solid rgba(${ar},0.35)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:accent }}>
                  <Volume2 size={13}/>
                </button>
              )}
              <button onClick={()=>setShowInfo(true)} className="aura-btn"
                style={{ width:32,height:32,borderRadius:10,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}>
                <Info size={14}/>
              </button>
              <button onClick={()=>setIsOpen(false)} className="aura-btn aura-btn-close"
                style={{ width:32,height:32,borderRadius:10,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtDim }}>
                <X size={15}/>
              </button>
            </div>
          </div>

          {/* ── VOICE MODE OVERLAY ── */}
          {voiceMode && (
            <div style={{
              position:'absolute',inset:0,zIndex:10,
              background:panelBg,
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              gap:0,
              animation:'aura-fade 0.25s ease',
            }}>
              {/* bg glows */}
              <div style={{ position:'absolute',inset:0,pointerEvents:'none' }}>
                <div style={{ position:'absolute',top:'10%',left:'50%',transform:'translateX(-50%)',width:400,height:400,borderRadius:'50%',
                  background:`radial-gradient(circle,rgba(${pr},0.3) 0%,transparent 65%)`,filter:'blur(70px)' }}/>
              </div>
              {/* large ghost listening */}
              <div style={{ position:'relative',marginBottom:24 }}>
                <HeroGhost primary={primary} accent={accent} size={160} listening={isListening}/>
                {/* pulse rings when listening */}
                {isListening && (
                  <>
                    <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-52%)',width:200,height:200,borderRadius:'50%',border:`2px solid rgba(${ar},0.35)`,animation:'aura-ring 1.6s ease-out infinite'}}/>
                    <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-52%)',width:200,height:200,borderRadius:'50%',border:`2px solid rgba(${ar},0.2)`,animation:'aura-ring 1.6s ease-out 0.6s infinite'}}/>
                  </>
                )}
              </div>
              {/* status */}
              <div style={{ fontFamily:"'Sora',sans-serif",fontSize:22,fontWeight:700,color:txtPri,marginBottom:8,textAlign:'center' }}>
                {isListening ? <><span style={{ color:accent }}>Aura</span> is listening…</> : 'Tap to speak'}
              </div>
              {/* transcript preview */}
              <div style={{ fontSize:15,color:txtMut,minHeight:28,textAlign:'center',maxWidth:320,lineHeight:1.5,marginBottom:32,padding:'0 24px' }}>
                {voiceTranscript || (isListening ? <span style={{ opacity:0.5 }}>Say something…</span> : '')}
              </div>
              {/* waveform */}
              <div style={{ marginBottom:40 }}>
                <VoiceWave accent={accent} active={isListening}/>
              </div>
              {/* buttons */}
              <div style={{ display:'flex',gap:16,alignItems:'center' }}>
                {/* cancel */}
                <button onClick={()=>{ stopListening(); setVoiceMode(false); setVoiceTranscript(''); }}
                  className="aura-btn"
                  style={{ width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.07)',border:`1px solid rgba(255,255,255,0.14)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:txtMut }}>
                  <X size={20}/>
                </button>
                {/* main mic button */}
                <button
                  className={`aura-voice-btn ${isListening ? 'active' : ''}`}
                  onClick={isListening ? handleVoiceSend : startListening}
                  style={{
                    width:78,height:78,borderRadius:'50%',border:'none',cursor:'pointer',
                    background:gradient,
                    display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',
                    boxShadow:`0 4px 24px rgba(${pr},.6),0 0 0 0 rgba(${ar},.3)`,
                    position:'relative',
                  }}>
                  {isListening ? <Send size={26}/> : <Mic size={26}/>}
                </button>
                {/* mute/unmute */}
                <button
                  className="aura-btn"
                  onClick={isListening ? stopListening : startListening}
                  style={{ width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.07)',border:`1px solid rgba(255,255,255,0.14)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:isListening ? accent : txtMut }}>
                  {isListening ? <MicOff size={20}/> : <Mic size={20}/>}
                </button>
              </div>
              {isListening && voiceTranscript && (
                <p style={{ fontSize:12,color:txtDim,marginTop:20,textAlign:'center' }}>Tap ↗ to send · tap mic to stop</p>
              )}
            </div>
          )}

          {/* ── MESSAGES AREA ── */}
          <div
            className="nvchat-msgs"
            ref={messagesRef}
            style={{ flex:1,position:'relative',zIndex:1,padding:'16px 20px 8px',minHeight:0 }}
            onScroll={()=>{ const el=messagesRef.current; if(!el) return; setShowScrollBtn(el.scrollHeight-el.scrollTop-el.clientHeight>120); }}
          >
            {/* shimmer */}
            {!historyLoaded && (
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {[['45%','flex-start'],['65%','flex-end'],['52%','flex-start'],['40%','flex-end']].map(([w,a],i)=>(
                  <div key={i} style={{ height:42,width:w as string,alignSelf:a as any,borderRadius:16,
                    background:`linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(${pr},0.14) 50%,rgba(255,255,255,0.04) 100%)`,
                    backgroundSize:'200% 100%',animation:'aura-shim 1.6s infinite' }}/>
                ))}
              </div>
            )}

            {/* ── EMPTY STATE ── */}
            {historyLoaded && messages.length === 0 && (
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                minHeight:'100%',textAlign:'center',padding:'0 20px',gap:0 }}>
                <div style={{ marginBottom:20 }}>
                  <HeroGhost primary={primary} accent={accent} size={130} listening={false}/>
                </div>
                <div style={{ fontFamily:"'Sora',sans-serif",fontSize:26,fontWeight:800,color:txtPri,lineHeight:1.2,marginBottom:10 }}>
                  Hi, I'm <span style={{ color:accent }}>Aura</span> ✦
                </div>
                <div style={{ fontSize:14,color:txtMut,lineHeight:1.65,maxWidth:300,marginBottom:28 }}>
                  Your AI assistant. Ask anything about the platform, your studies, or anything else. Try voice too!
                </div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:9,justifyContent:'center' }}>
                  {['Submit an exam?','My schedule','Study help','Platform features','Voice demo'].map((q,i)=>(
                    <button key={q}
                      className="aura-chip-btn"
                      onClick={()=>{
                        if (q === 'Voice demo') { startListening(); return; }
                        setInputMessage(q);
                        setTimeout(()=>handleSendMessage(q),0);
                      }}
                      style={{
                        padding:'8px 16px', borderRadius:24,
                        background:`rgba(${pr},0.14)`,
                        border:`1px solid rgba(${pr},0.32)`,
                        color:txtMut, fontSize:13, fontWeight:500,
                        cursor:'pointer', whiteSpace:'nowrap',
                        fontFamily:"'Outfit',sans-serif",
                        animation:`aura-chip 0.4s cubic-bezier(0.22,1,0.36,1) ${i*0.06}s both`,
                      }}>
                      {q === 'Voice demo' ? '🎙 Voice' : q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── MESSAGE LIST ── */}
            {historyLoaded && (() => {
              let prev: string|null = null;
              return items.map((item, idx) => {
                if (item.type === 'sep') {
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
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className="aura-msg-enter"
                    style={{ display:'flex',alignItems:'flex-end',gap:9,flexDirection:isUser?'row-reverse':'row',marginBottom:5,marginTop:isFirst?12:0 }}>
                    {!isUser && (
                      <div style={{
                        width:30,height:30,borderRadius:10,flexShrink:0,alignSelf:'flex-end',
                        background:`linear-gradient(135deg,rgba(${pr},0.38),rgba(${ar},0.24))`,
                        border:`1px solid rgba(${pr},0.4)`,
                        display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',
                        boxShadow:`0 0 12px rgba(${pr},0.28)`,
                        visibility:nextSame?'hidden':'visible',
                      }}>
                        <MiniGhost size={22} primary={primary} accent={accent}/>
                      </div>
                    )}
                    <div style={{ display:'flex',flexDirection:'column',gap:3,maxWidth:'min(68%,520px)',alignItems:isUser?'flex-end':'flex-start' }}>
                      <div style={{
                        padding:'10px 14px',borderRadius:18,fontSize:14,lineHeight:1.6,
                        wordBreak:'break-word',whiteSpace:'pre-wrap',
                        ...(isUser
                          ? { background:`linear-gradient(135deg,${primary},${accent})`,color:'#fff',borderBottomRightRadius:5,boxShadow:`0 2px 14px rgba(${ar},0.35)` }
                          : { background:bbAi,border:`1px solid ${bbAiBdr}`,color:txtPri,borderBottomLeftRadius:5 }
                        )
                      }}>{msg.text}</div>
                      {!nextSame && <span style={{ fontSize:10,color:txtDim,padding:'0 4px' }}>{fmt(msg.timestamp)}</span>}
                    </div>
                  </div>
                );
              });
            })()}

            {/* typing indicator */}
            {isLoading && (
              <div style={{ display:'flex',alignItems:'flex-end',gap:9,marginTop:12 }}>
                <div style={{ width:30,height:30,borderRadius:10,flexShrink:0,
                  background:`linear-gradient(135deg,rgba(${pr},0.38),rgba(${ar},0.24))`,
                  border:`1px solid rgba(${pr},0.4)`,
                  display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',
                  boxShadow:`0 0 12px rgba(${pr},0.28)` }}>
                  <MiniGhost size={22} primary={primary} accent={accent}/>
                </div>
                <div style={{ background:bbAi,border:`1px solid ${bbAiBdr}`,borderRadius:18,borderBottomLeftRadius:5 }}>
                  <TypingDots accent={accent}/>
                </div>
              </div>
            )}

            {/* scroll FAB */}
            {showScrollBtn && (
              <button onClick={()=>scrollToBottom()}
                style={{ position:'sticky',bottom:6,display:'flex',alignSelf:'center',alignItems:'center',gap:5,
                  padding:'6px 14px 6px 11px',borderRadius:22,
                  background:'rgba(10,6,22,0.95)',border:`1px solid rgba(${pr},0.38)`,
                  color:txtMut,fontSize:12,fontWeight:600,cursor:'pointer',
                  boxShadow:`0 6px 20px rgba(0,0,0,.8),0 0 14px rgba(${pr},0.22)`,
                  animation:'aura-fab .18s ease',whiteSpace:'nowrap',
                  fontFamily:"'Outfit',sans-serif",margin:'6px auto 0' }}>
                <ChevronDown size={13}/> New messages
              </button>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* ── INPUT BAR ── */}
          <div style={{
            position:'relative',zIndex:3,flexShrink:0,
            padding:'12px 20px 16px',
            background:inpBg,
            borderTop:`1px solid ${bdr}`,
            backdropFilter:'blur(24px)',
          }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,
              background:surf2,border:`1px solid rgba(${pr},0.28)`,
              borderRadius:18,padding:'8px 8px 8px 16px',
              boxShadow:`0 0 0 0 rgba(${pr},0)`,
              transition:'box-shadow 0.2s',
            }}>
              <input
                ref={inputRef}
                type="text"
                className="aura-inp"
                value={inputMessage}
                onChange={e=>setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Aura anything…"
                disabled={isLoading}
                aria-label="Message input"
                style={{ flex:1,minWidth:0,background:'transparent',border:'none',color:txtPri,fontSize:14,fontFamily:"'Outfit',sans-serif",padding:'4px 0',lineHeight:1.5,outline:'none',WebkitTapHighlightColor:'transparent' }}
              />
              {/* mic button */}
              <button
                className={`aura-mic-btn ${isListening ? 'listening' : ''}`}
                onClick={()=>{ if(isListening){ stopListening(); setVoiceMode(false); } else { startListening(); } }}
                title="Voice input"
                style={{
                  width:38,height:38,borderRadius:12,border:'none',cursor:'pointer',flexShrink:0,
                  background:isListening ? `rgba(${ar},0.2)` : 'rgba(255,255,255,0.07)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:isListening ? accent : txtDim,
                  position:'relative',
                }}>
                {isListening ? <MicOff size={15}/> : <Mic size={15}/>}
              </button>
              {/* send button */}
              <button
                className="aura-send"
                onClick={()=>handleSendMessage()}
                disabled={isLoading || !inputMessage.trim()}
                style={{
                  width:38,height:38,borderRadius:12,border:'none',cursor:'pointer',flexShrink:0,
                  background:(!isLoading&&inputMessage.trim()) ? gradient : 'rgba(255,255,255,0.07)',
                  color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                  opacity:(!isLoading&&inputMessage.trim()) ? 1 : 0.35,
                  boxShadow:(!isLoading&&inputMessage.trim()) ? `0 2px 14px rgba(${pr},.6)` : 'none',
                }}>
                <Send size={15} strokeWidth={2.2}/>
              </button>
            </div>
            <p style={{ fontSize:10,color:txtDim,textAlign:'center',margin:'8px 0 0',fontFamily:"'Outfit',sans-serif",letterSpacing:'0.04em' }}>
              Aura · AI-Powered Assistant
            </p>
          </div>

        </div>
      )}
    </>
  );

  return (
    <>
      <button onClick={handleGhostTap} className="nvchat-ghost" aria-label={isOpen ? 'Close Aura' : 'Open Aura'}>
        <GhostIcon size={72} isActive={isOpen}/>
      </button>
      {ReactDOM.createPortal(portal, document.body)}
    </>
  );
};

export default ChatbotWidget;
