// src/components/ui/DynamicIsland.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Upload, Mic, CheckCircle, AlertCircle, Info, X, Clock, GraduationCap, Zap, Trophy, Calendar } from 'lucide-react';

export type IslandMode = 'idle' | 'notification' | 'upload' | 'recording' | 'reminder';
export interface DynamicIslandNotification {
  id: string; type: 'success'|'error'|'info'|'warning'|'study'|'achievement';
  title: string; message?: string; duration?: number; progress?: number; isRecording?: boolean;
}

const STYLES = `
  @keyframes di-desktop-open {
    0%   { transform:translateX(-50%) scaleX(0.22) scaleY(0.65); opacity:0.4; }
    45%  { transform:translateX(-50%) scaleX(1.03) scaleY(1.02); opacity:1; }
    70%  { transform:translateX(-50%) scaleX(0.985) scaleY(0.99); }
    100% { transform:translateX(-50%) scaleX(1) scaleY(1); opacity:1; }
  }
  @keyframes di-desktop-close {
    0%   { transform:translateX(-50%) scaleX(1) scaleY(1); opacity:1; }
    40%  { transform:translateX(-50%) scaleX(1.02) scaleY(0.93); }
    100% { transform:translateX(-50%) scaleX(0.04) scaleY(0.35); opacity:0; }
  }
  @keyframes di-mob-open {
    0%   { width:36px; height:36px; border-radius:12px; opacity:0.5; }
    38%  { width:92%; height:52px; border-radius:22px; opacity:1; }
    58%  { width:90%; height:54px; }
    78%  { width:92%; height:52px; }
    100% { width:92%; height:52px; border-radius:20px; opacity:1; }
  }
  @keyframes di-mob-close {
    0%   { width:92%; height:52px; border-radius:20px; opacity:1; }
    60%  { width:36px; height:36px; border-radius:12px; opacity:0.65; }
    100% { width:36px; height:36px; border-radius:12px; opacity:1; }
  }
  @keyframes di-in   { from{opacity:0;transform:scale(0.84) translateY(5px);} to{opacity:1;transform:scale(1) translateY(0);} }
  @keyframes di-logo-out { 0%{transform:scale(1);opacity:1;} 60%{transform:scale(0.5);opacity:0.3;} 100%{transform:scale(0);opacity:0;} }
  @keyframes di-logo-in  { 0%{transform:scale(0);opacity:0;} 65%{transform:scale(1.18);opacity:1;} 100%{transform:scale(1);opacity:1;} }
  @keyframes di-rec { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,0.7);} 50%{transform:scale(1.22);box-shadow:0 0 0 6px rgba(239,68,68,0);} }
  @keyframes di-shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
  .dio { animation: di-desktop-open  0.48s cubic-bezier(0.34,1.3,0.64,1) forwards; }
  .dic { animation: di-desktop-close 0.34s cubic-bezier(0.4,0,0.6,1)    forwards; }
  .dimo { animation: di-mob-open  0.52s cubic-bezier(0.34,1.2,0.64,1) forwards; }
  .dimc { animation: di-mob-close 0.40s cubic-bezier(0.4,0,0.6,1)    forwards; }
  .di-content { animation: di-in 0.30s cubic-bezier(0.34,1.2,0.64,1) forwards; }
  .di-lo { animation: di-logo-out 0.22s ease forwards; }
  .di-li { animation: di-logo-in  0.30s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .di-rd { animation: di-rec 1.1s ease-in-out infinite; }
`;

const accent = (t: string, p: string) =>
  ({success:'#10b981',error:'#ef4444',warning:'#f59e0b',achievement:'#eab308',info:'#3b82f6'}[t] ?? p);

const Ico = ({ type, primary }: { type: string; primary: string }) => {
  const s = 14;
  if (type === 'success')     return <CheckCircle size={s} color="#10b981" />;
  if (type === 'error')       return <AlertCircle size={s} color="#ef4444" />;
  if (type === 'warning')     return <AlertCircle size={s} color="#f59e0b" />;
  if (type === 'study')       return <BookOpen size={s} color={primary} />;
  if (type === 'achievement') return <Trophy size={s} color="#eab308" />;
  return <Info size={s} color="#3b82f6" />;
};

const fmtTime = (s: number) =>
  `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ── Shared island content layouts ─────────────────────────────────────────────
const NotifContent = ({ notif, primary, mobile }: { notif: DynamicIslandNotification; primary: string; mobile?: boolean }) => {
  const ac = accent(notif.type, primary);
  return (
    <div style={{ display:'flex',alignItems:'center',height:'100%',padding:`0 ${mobile?10:14}px`,gap:mobile?8:10 }}>
      <div style={{ width:mobile?28:34,height:mobile?28:34,borderRadius:mobile?9:11,flexShrink:0,background:`${ac}22`,border:`1px solid ${ac}44`,display:'flex',alignItems:'center',justifyContent:'center' }}>
        <Ico type={notif.type} primary={primary} />
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontFamily:"'Outfit',sans-serif",fontSize:mobile?12:13,fontWeight:700,color:'rgba(255,255,255,0.95)',margin:0,lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{notif.title}</p>
        {notif.message && <p style={{ fontFamily:"'Outfit',sans-serif",fontSize:mobile?10:11,color:'rgba(255,255,255,0.45)',margin:'2px 0 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{notif.message}</p>}
      </div>
      <X size={mobile?10:11} color="rgba(255,255,255,0.28)" />
    </div>
  );
};

const UploadContent = ({ notif, progress, primary, pRgb, mobile }: { notif: DynamicIslandNotification; progress: number; primary: string; pRgb: string; mobile?: boolean }) => (
  <div style={{ display:'flex',flexDirection:'column',justifyContent:'center',height:'100%',padding:`0 ${mobile?10:14}px`,gap:mobile?5:8 }}>
    <div style={{ display:'flex',alignItems:'center',gap:mobile?6:8 }}>
      <Upload size={mobile?11:13} color={primary} />
      <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:mobile?11:12,fontWeight:700,color:'rgba(255,255,255,0.9)',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{notif.title}</span>
      <span style={{ fontFamily:'monospace',fontSize:mobile?11:12,fontWeight:700,color:primary }}>{Math.round(progress)}%</span>
    </div>
    <div style={{ height:mobile?3:4,borderRadius:2,background:'rgba(255,255,255,0.1)',overflow:'hidden' }}>
      <div style={{ height:'100%',width:`${progress}%`,borderRadius:2,background:`linear-gradient(90deg,${primary},${primary}bb,${primary})`,backgroundSize:'200% 100%',animation:'di-shimmer 1.5s ease infinite',transition:'width 0.35s ease',boxShadow:`0 0 7px rgba(${pRgb},0.6)` }} />
    </div>
  </div>
);

const RecContent = ({ recTime, mobile }: { recTime: number; mobile?: boolean }) => (
  <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',padding:`0 ${mobile?10:18}px`,gap:mobile?8:12 }}>
    <div className="di-rd" style={{ width:mobile?10:11,height:mobile?10:11,borderRadius:'50%',background:'#ef4444',flexShrink:0 }} />
    <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:mobile?11:12,fontWeight:800,color:'#ef4444',letterSpacing:'0.06em' }}>REC</span>
    <span style={{ fontFamily:"'SF Mono','Fira Mono',monospace",fontSize:mobile?13:16,fontWeight:700,color:'rgba(255,255,255,0.9)',letterSpacing:'0.05em' }}>{fmtTime(recTime)}</span>
    <Mic size={mobile?12:14} color="rgba(255,255,255,0.4)" />
  </div>
);

const ReminderContent = ({ notif, primary, gradient, pRgb, mobile }: { notif: DynamicIslandNotification; primary: string; gradient: string; pRgb: string; mobile?: boolean }) => (
  <div style={{ display:'flex',alignItems:'center',height:'100%',padding:`0 ${mobile?10:14}px`,gap:mobile?8:10 }}>
    <div style={{ width:mobile?30:44,height:mobile?30:44,borderRadius:mobile?9:14,flexShrink:0,background:`rgba(${pRgb},0.18)`,border:`1px solid rgba(${pRgb},0.3)`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 14px rgba(${pRgb},0.2)` }}>
      <Calendar size={mobile?13:20} color={primary} />
    </div>
    <div style={{ flex:1,minWidth:0 }}>
      <div style={{ display:'flex',alignItems:'center',gap:4,marginBottom:2 }}>
        <Clock size={9} color={primary} />
        <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:9,fontWeight:700,color:primary,textTransform:'uppercase',letterSpacing:'0.1em' }}>Study Reminder</span>
      </div>
      <p style={{ fontFamily:"'Outfit',sans-serif",fontSize:mobile?12:13,fontWeight:700,color:'rgba(255,255,255,0.95)',margin:'0 0 1px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{notif.title}</p>
      {notif.message && <p style={{ fontFamily:"'Outfit',sans-serif",fontSize:11,color:'rgba(255,255,255,0.42)',margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{notif.message}</p>}
    </div>
    <div style={{ padding:'5px 9px',borderRadius:9,background:gradient,boxShadow:`0 2px 8px rgba(${pRgb},0.4)`,flexShrink:0 }}>
      <Zap size={11} color="white" strokeWidth={2.5} />
    </div>
  </div>
);

// ── Desktop island (fixed, centered) ─────────────────────────────────────────
interface DProps { notif:DynamicIslandNotification|null; mode:IslandMode; progress:number; recTime:number; primary:string; gradient:string; pRgb:string; onDismiss:()=>void; closing:boolean; }
const DesktopIsland: React.FC<DProps> = ({ notif, mode, progress, recTime, primary, gradient, pRgb, onDismiss, closing }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!closing) { const t = setTimeout(() => setShow(true), 170); return () => clearTimeout(t); }
    setShow(false);
  }, [closing]);
  const w = mode==='upload'?295 : mode==='recording'?215 : mode==='reminder'?335 : 315;
  const h = mode==='reminder'?82 : mode==='upload'?68 : 60;
  return (
    <div className={closing?'dic':'dio'} onClick={onDismiss} style={{ position:'fixed',top:10,left:'50%',transform:'translateX(-50%)',zIndex:99999,width:w,height:h,borderRadius:20,background:'rgba(8,8,10,0.96)',backdropFilter:'blur(30px) saturate(180%)',WebkitBackdropFilter:'blur(30px) saturate(180%)',border:`1px solid rgba(${pRgb},0.28)`,boxShadow:`0 8px 40px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04),0 0 24px rgba(${pRgb},0.14)`,cursor:'pointer',overflow:'hidden' }}>
      <div style={{ position:'absolute',bottom:0,left:'12%',right:'12%',height:1,background:`linear-gradient(90deg,transparent,rgba(${pRgb},0.7),transparent)`,pointerEvents:'none' }} />
      {show && <div className="di-content" style={{ height:'100%' }}>
        {mode==='notification' && notif && <NotifContent notif={notif} primary={primary} />}
        {mode==='upload'       && notif && <UploadContent notif={notif} progress={progress} primary={primary} pRgb={pRgb} />}
        {mode==='recording'           && <RecContent recTime={recTime} />}
        {mode==='reminder'     && notif && <ReminderContent notif={notif} primary={primary} gradient={gradient} pRgb={pRgb} />}
      </div>}
    </div>
  );
};

// ── Mobile island logo (rendered inside Navigation's center logo slot) ─────────
interface MProps { expanded:boolean; closing:boolean; notif:DynamicIslandNotification|null; mode:IslandMode; progress:number; recTime:number; primary:string; gradient:string; pRgb:string; onDismiss:()=>void; }
export const MobileIslandLogo: React.FC<MProps> = ({ expanded, closing, notif, mode, progress, recTime, primary, gradient, pRgb, onDismiss }) => {
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (expanded && !closing) { const t = setTimeout(() => setShowContent(true), 215); return () => clearTimeout(t); }
    setShowContent(false);
  }, [expanded, closing]);

  if (!expanded && !closing) {
    return (
      <div className="di-li" style={{ width:36,height:36,borderRadius:12,background:gradient,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 14px rgba(${pRgb},0.45)`,flexShrink:0 }}>
        <GraduationCap className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div className={closing?'dimc':'dimo'} onClick={expanded?onDismiss:undefined}
      style={{ position:'relative',width:36,height:36,borderRadius:12,background:'rgba(8,8,10,0.96)',backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',border:`1px solid rgba(${pRgb},0.3)`,boxShadow:`0 6px 32px rgba(0,0,0,0.55),0 0 18px rgba(${pRgb},0.14)`,overflow:'hidden',cursor:'pointer',display:'flex',alignItems:'center',transformOrigin:'center center' }}>
      <div style={{ position:'absolute',bottom:0,left:'8%',right:'8%',height:1,background:`linear-gradient(90deg,transparent,rgba(${pRgb},0.7),transparent)`,pointerEvents:'none' }} />
      {showContent && <div className="di-content" style={{ display:'flex',alignItems:'center',width:'100%',height:'100%' }}>
        {mode==='notification' && notif && <NotifContent notif={notif} primary={primary} mobile />}
        {mode==='upload'       && notif && <UploadContent notif={notif} progress={progress} primary={primary} pRgb={pRgb} mobile />}
        {mode==='recording'           && <RecContent recTime={recTime} mobile />}
        {mode==='reminder'     && notif && <ReminderContent notif={notif} primary={primary} gradient={gradient} pRgb={pRgb} mobile />}
      </div>}
    </div>
  );
};

// ── Main controller (manages state, desktop renders here, mobile via events) ──
interface DynamicIslandProps { darkMode?:boolean; primaryColor?:string; gradient?:string; pRgb?:string; }
const DynamicIsland: React.FC<DynamicIslandProps> = ({ primaryColor='#f97316', gradient='linear-gradient(135deg,#f97316,#ef4444)', pRgb='249,115,22' }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [notif, setNotif]       = useState<DynamicIslandNotification|null>(null);
  const [mode, setMode]         = useState<IslandMode>('idle');
  const [progress, setProgress] = useState(0);
  const [recTime, setRecTime]   = useState(0);
  const [visible, setVisible]   = useState(false);
  const [closing, setClosing]   = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const recTimer  = useRef<ReturnType<typeof setInterval>|null>(null);
  const recSecs   = useRef(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const clearAll = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (recTimer.current)  clearInterval(recTimer.current);
  }, []);

  const dismiss = useCallback(() => {
    clearAll(); setClosing(true);
    setTimeout(() => {
      setVisible(false); setClosing(false); setNotif(null); setMode('idle');
      setRecTime(0); recSecs.current = 0;
      window.dispatchEvent(new CustomEvent('di-mobile-idle'));
    }, 450);
  }, [clearAll]);

  const show = useCallback((n: DynamicIslandNotification) => {
    clearAll(); setClosing(false);
    const m: IslandMode = n.isRecording ? 'recording' : n.progress !== undefined ? 'upload' : n.type === 'study' ? 'reminder' : 'notification';
    setNotif(n); setMode(m); setProgress(n.progress ?? 0); setVisible(true);
    recSecs.current = 0; setRecTime(0);
    window.dispatchEvent(new CustomEvent('di-mobile-expand', { detail: { notif: n, mode: m } }));
    if (m !== 'recording') { hideTimer.current = setTimeout(dismiss, n.duration ?? 4500); }
    else { recTimer.current = setInterval(() => { recSecs.current++; setRecTime(recSecs.current); }, 1000); }
  }, [clearAll, dismiss]);

  const updateProg = useCallback((p: number) => {
    setProgress(p);
    if (p >= 100) hideTimer.current = setTimeout(dismiss, 900);
  }, [dismiss]);

  useEffect(() => {
    const onShow = (e: CustomEvent) => show(e.detail);
    const onProg = (e: CustomEvent) => updateProg(e.detail.progress);
    const onDis  = () => dismiss();
    const onStop = () => { if (recTimer.current) clearInterval(recTimer.current); show({ id:Date.now().toString(), type:'success', title:'Recording saved', message:'Your recording is ready', duration:3000 }); };
    window.addEventListener('dynamic-island-show',           onShow as EventListener);
    window.addEventListener('dynamic-island-progress',       onProg as EventListener);
    window.addEventListener('dynamic-island-dismiss',        onDis);
    window.addEventListener('dynamic-island-stop-recording', onStop);
    (window as any).dynamicIsland = { show, progress: updateProg, dismiss };
    return () => {
      window.removeEventListener('dynamic-island-show',           onShow as EventListener);
      window.removeEventListener('dynamic-island-progress',       onProg as EventListener);
      window.removeEventListener('dynamic-island-dismiss',        onDis);
      window.removeEventListener('dynamic-island-stop-recording', onStop);
      clearAll();
    };
  }, [show, updateProg, dismiss, clearAll]);

  return (
    <>
      <style>{STYLES}</style>
      {!isMobile && visible && (
        <DesktopIsland notif={notif} mode={mode} progress={progress} recTime={recTime}
          primary={primaryColor} gradient={gradient} pRgb={pRgb} onDismiss={dismiss} closing={closing} />
      )}
    </>
  );
};

export default DynamicIsland;
export const showDynamicIsland = (n: Omit<DynamicIslandNotification,'id'>) =>
  window.dispatchEvent(new CustomEvent('dynamic-island-show', { detail: { ...n, id: Date.now().toString() } }));
export const updateDynamicIslandProgress = (p: number) =>
  window.dispatchEvent(new CustomEvent('dynamic-island-progress', { detail: { progress: p } }));
export const dismissDynamicIsland = () =>
  window.dispatchEvent(new CustomEvent('dynamic-island-dismiss'));
