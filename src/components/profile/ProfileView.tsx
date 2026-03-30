// src/components/profile/ProfileView.tsx — v3 Matte Crystal Sparkle Design
import { useEffect, useRef, useState, useCallback } from 'react';
import { UserProfile } from '../../services/authService';
import { useDashboard } from '../../contexts/DashboardContext';
import QRCode from 'qrcode';
import {
  User, Mail, Phone, MapPin, GraduationCap, Building,
  Calendar, Users, Droplet, Shield, FileText, CreditCard,
  Edit, Lock, X, Clock, CheckSquare, BarChart2, Award,
  BookOpen, Flame, Zap
} from 'lucide-react';

interface ProfileViewProps {
  user: UserProfile;
  onEdit: () => void;
  onChangePassword: () => void;
  onClose?: () => void;
}

/* ─── tiny helpers ─── */
const hexRgb = (hex = '#6366f1') => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
};

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const SPARK_COLORS = ['#a5b4fc', '#c4b5fd', '#fbcfe8', '#fde68a', '#6ee7b7', 'rgba(255,255,255,0.9)'];

/* ─── Sparkle hook ─── */
function useSparkle() {
  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:30;overflow:hidden;border-radius:inherit';
    el.appendChild(layer);
    for (let i = 0; i < 12; i++) {
      const sp = document.createElement('div');
      const size = 2 + Math.random() * 4;
      const x = 5 + Math.random() * 90;
      const y = 5 + Math.random() * 90;
      const dx = `${(Math.random() - 0.5) * 40}px`;
      const dy = `${-(10 + Math.random() * 30)}px`;
      const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
      const delay = Math.random() * 0.25;
      sp.style.cssText = `
        position:absolute;border-radius:50%;
        width:${size}px;height:${size}px;
        left:${x}%;top:${y}%;
        background:${color};
        box-shadow:0 0 ${size * 2}px ${color};
        animation:spPop 0.75s ${delay}s ease-out forwards;
        --dx:${dx};--dy:${dy};
      `;
      layer.appendChild(sp);
    }
    setTimeout(() => layer.remove(), 1100);
  }, []);
}

/* ─── Glass card wrapper ─── */
const GlassCard = ({
  children, style, className = '', onMouseEnter,
}: { children: React.ReactNode; style?: React.CSSProperties; className?: string; onMouseEnter?: React.MouseEventHandler<HTMLDivElement> }) => (
  <div
    className={className}
    onMouseEnter={onMouseEnter}
    style={{
      position: 'relative', isolation: 'isolate', overflow: 'hidden',
      background: 'rgba(22,26,40,0.82)',
      backdropFilter: 'blur(32px) saturate(180%)',
      WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.09)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)',
      borderRadius: 24,
      fontFamily: "'Outfit',sans-serif",
      ...style,
    }}
  >
    {/* Top shimmer edge */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
      borderRadius: '24px 24px 0 0', pointerEvents: 'none', zIndex: 20,
      background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15)30%,rgba(255,255,255,0.32)50%,rgba(255,255,255,0.15)70%,transparent)',
    }} />
    {/* Noise texture */}
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'inherit',
      pointerEvents: 'none', zIndex: 1,
      background: NOISE, opacity: 0.04, mixBlendMode: 'overlay',
    }} />
    {children}
  </div>
);

/* ─── Info Row ─── */
const InfoRow = ({
  icon: Icon, label, value, accent = 'rgba(99,102,241,0.14)',
}: { icon: React.ElementType; label: string; value?: string; accent?: string }) => {
  if (!value) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
      position: 'relative', zIndex: 4,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={13} color="#94a3b8" />
      </div>
      <div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#cbd5e1' }}>{value}</div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
const ProfileView = ({ user, onEdit, onChangePassword, onClose }: ProfileViewProps) => {
  const { primaryColor = '#6366f1' } = useDashboard();
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [profileCompletion, setProfileCompletion] = useState(0);
  const spawnSparkle = useSparkle();
  const pRgb = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor},#8b5cf6)`;

  /* QR code */
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/verify-profile?uid=${user.uid}`, {
      width: 300, margin: 1, color: { dark: '#1a1a1a', light: '#ffffff' },
    }).then(setQrCodeUrl).catch(console.error);
  }, [user.uid]);

  /* Profile completion */
  useEffect(() => {
    const fields = [
      user.name, user.surname, user.email, user.phoneNumber,
      user.address, user.dob, user.gender, user.bloodGroup,
      user.religion, user.profilePictureUrl, user.class,
      user.school, user.college, user.mobileNumber,
      user.guardianPhone, user.classGrade,
    ];
    const pct = Math.round(fields.filter(f => f && String(f).trim()).length / fields.length * 100);
    setProfileCompletion(pct);
  }, [user]);

  const handlePrintProfile = () => window.print();

  const handlePrintIDCard = () => {
    const w = window.open('', '', 'width=1000,height=700');
    if (!w) return;
    const html = `<!DOCTYPE html><html><head><title>ID Card</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}
    @page{size:85.6mm 53.98mm landscape;margin:0}
    body{font-family:'Inter',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f3f4f6;padding:20px}
    .card{width:85.6mm;height:53.98mm;background:linear-gradient(135deg,#312e81,#4f46e5,#7c3aed);border-radius:8px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative;display:flex;flex-direction:column}
    .inner{padding:8px 10px;display:flex;flex-direction:column;height:100%}
    .hd{font-size:7px;color:rgba(255,255,255,.8);font-weight:700;margin-bottom:2px}
    .body{display:flex;gap:8px;flex:1;align-items:center}
    .photo{width:38px;height:38px;border-radius:6px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0}
    .photo img{width:100%;height:100%;object-fit:cover}
    .det{flex:1}
    .name{font-size:9px;font-weight:800;color:#fff;margin-bottom:3px}
    .row{font-size:7px;color:rgba(255,255,255,.75);margin-bottom:1px}
    .ft{font-size:6px;color:rgba(255,255,255,.5);margin-top:auto}
    </style></head><body>
    <div class="card"><div class="inner">
    <div class="hd">Learning Management Portal — Official ${user.role?.toUpperCase()} ID</div>
    <div class="body">
    <div class="photo">${user.profilePictureUrl ? `<img src="${user.profilePictureUrl}"/>` : (user.name?.charAt(0) || 'U')}</div>
    <div class="det">
    <div class="name">${user.surname || ''} ${user.name || ''}</div>
    <div class="row">ID: ${user.userId || ''}</div>
    ${user.phoneNumber ? `<div class="row">Mobile: +880${user.phoneNumber}</div>` : ''}
    ${user.bloodGroup ? `<div class="row">Blood: ${user.bloodGroup}</div>` : ''}
    ${user.classGrade ? `<div class="row">Class: ${user.classGrade}</div>` : ''}
    ${qrCodeUrl ? `<img src="${qrCodeUrl}" style="width:32px;height:32px;margin-top:3px"/>` : ''}
    </div></div>
    <div class="ft">Valid Until: ${new Date(Date.now() + 365 * 86400000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
    </div></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),600)};window.onafterprint=()=>setTimeout(()=>window.close(),100)</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const getRoleBadgeColor = (role: string) => {
    const map: Record<string, string> = {
      admin: '#ef4444', manager: '#3b82f6', coordinator: '#f59e0b',
      teacher: '#10b981', parent: '#8b5cf6', student: primaryColor,
    };
    return map[role] || '#6b7280';
  };

  /* ── Hover tilt handler ── */
  const makeTiltHandlers = () => ({
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const rx = ((y - r.height / 2) / r.height) * -10;
      const ry = ((x - r.width / 2) / r.width) * 10;
      el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px) scale(1.02)`;
      el.style.boxShadow = '0 20px 48px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.10)';
      el.style.borderColor = 'rgba(255,255,255,0.14)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)';
      el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.06)';
      el.style.borderColor = 'rgba(255,255,255,0.08)';
    },
  });

  const tilt = makeTiltHandlers();

  return (
    <>
      {/* ── Keyframes injected once ── */}
      <style>{`
        @keyframes spPop {
          0%   { transform: scale(0) translate(0,0); opacity: 1; }
          60%  { opacity: 0.8; }
          100% { transform: scale(0) translate(var(--dx),var(--dy)); opacity: 0; }
        }
        @keyframes avSpin   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes avPulse  { 0%,100% { opacity:.5;transform:scale(1) } 50% { opacity:.9;transform:scale(1.1) } }
        @keyframes lvSweep  { 0% { transform:translateX(-100%) } 100% { transform:translateX(100%) } }
        @keyframes fpRise   { 0% { transform:translateY(0) scale(1);opacity:.9 } 100% { transform:translateY(-220px) scale(.2);opacity:0 } }
        @keyframes sdPulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.2)} }
        @keyframes btnSweep { 0% { transform:translateX(-120%) } 100% { transform:translateX(120%) } }
        .pv-btn-sweep::after {
          content:''; position:absolute; inset:0; border-radius:12px;
          background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.18)50%,transparent 70%);
          animation:none; pointer-events:none;
        }
        .pv-btn-sweep:hover::after { animation:btnSweep 0.5s ease forwards; }
        .pv-card-sweep::after {
          content:''; position:absolute; inset:0; border-radius:inherit;
          background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.06)50%,transparent 65%);
          transform:translateX(-100%); transition:transform 0.55s ease;
          pointer-events:none; z-index:3;
        }
        .pv-card-sweep:hover::after { transform:translateX(100%); }
        @media print {
          body * { visibility:hidden }
          #pv-printable, #pv-printable * { visibility:visible }
          #pv-printable { position:absolute;left:0;top:0;width:100%;background:white!important;padding:20px }
          .no-print { display:none!important }
        }
        @media (max-width: 600px) {
          .pv-stats-grid { grid-template-columns: 1fr !important; gap: 10px !important; padding: 16px 16px 0 !important; }
          .pv-id-grid { grid-template-columns: 1fr !important; gap: 10px !important; padding: 12px 16px 0 !important; }
          .pv-badge-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .pv-subject-grid { grid-template-columns: repeat(2,1fr) !important; gap: 8px !important; }
          .pv-info-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .pv-identity-row { flex-direction: column !important; align-items: center !important; padding: 0 16px !important; margin-top: -48px !important; }
          .pv-name-block { padding-bottom: 12px !important; text-align: center !important; width: 100% !important; }
          .pv-name-block > div:first-child { font-size: 18px !important; }
          .pv-badges-row { justify-content: center !important; }
          .pv-level-row { justify-content: center !important; }
          .pv-action-btns { padding: 12px 16px 20px !important; gap: 8px !important; }
          .pv-action-btns button { flex: 1 1 calc(50% - 8px) !important; min-width: 0 !important; padding: 8px 10px !important; font-size: 12px !important; justify-content: center !important; }
          .pv-section-pad { padding: 14px 16px !important; }
          .pv-banner { height: 140px !important; }
          .pv-avatar-wrap { width: 84px !important; height: 84px !important; border-radius: 18px !important; }
          .pv-semester-pad { padding: 16px 16px !important; }
          .pv-stats-card { padding: 12px 14px !important; }
          .pv-stat-num { font-size: 22px !important; }
          .pv-info-card { padding: 14px 16px !important; }
          .pv-info-header span { font-size: 12px !important; }
        }
      `}</style>

      <div id="pv-printable" style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: "'Outfit',sans-serif" }}>

        {/* ══════════════════════════════════════
            BANNER CARD
        ══════════════════════════════════════ */}
        <GlassCard>
          {/* ── Hero banner with starfield GIF ── */}
          <div className="pv-banner" style={{ position: 'relative', height: 190, overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
            {/* Starfield GIF background */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'url(/assets/starfield-banner.gif)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }} />
            {/* Subtle overlay for better text readability */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(49,46,129,0.3) 0%, rgba(0,0,0,0.2) 100%)',
            }} />
            {/* Top shimmer */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.5)35%,rgba(255,255,255,.95)50%,rgba(255,255,255,.5)65%,transparent)',
            }} />
            {/* Close btn */}
            {onClose && (
              <button onClick={onClose} className="no-print" style={{
                position: 'absolute', top: 14, right: 14, zIndex: 30,
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)',
                fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Outfit',sans-serif",
              }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* ── Identity row ── */}
          <div className="pv-identity-row" style={{ padding: '0 28px', marginTop: -55, position: 'relative', zIndex: 5, display: 'flex', alignItems: 'flex-end', gap: 22 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {/* Glow pulse */}
              <div style={{
                position: 'absolute', inset: -10, borderRadius: 30,
                background: `radial-gradient(circle,rgba(${pRgb},0.6)0%,transparent 70%)`,
                filter: 'blur(12px)', animation: 'avPulse 2.8s ease-in-out infinite', zIndex: 0,
              }} />
              {/* Spinning ring */}
              <div style={{
                position: 'absolute', inset: -4, borderRadius: 26,
                background: `conic-gradient(from 0deg,${primaryColor} 0%,#8b5cf6 33%,#a855f7 66%,${primaryColor} 100%)`,
                animation: 'avSpin 5s linear infinite', zIndex: 1, filter: 'blur(0.5px)',
              }} />
              {/* Ring mask */}
              <div style={{ position: 'absolute', inset: -2, borderRadius: 24, background: '#16182a', zIndex: 2 }} />
              {/* Avatar itself */}
              <div className="pv-avatar-wrap" style={{
                width: 108, height: 108, borderRadius: 22, overflow: 'hidden',
                position: 'relative', zIndex: 3,
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
              }}>
                {user.profilePictureUrl ? (
                  <img src={user.profilePictureUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 42, fontWeight: 900, color: '#fff',
                  }}>
                    {(user.name?.charAt(0) || user.surname?.charAt(0) || 'U').toUpperCase()}
                  </div>
                )}
              </div>
              {/* Badge */}
              <div style={{
                position: 'absolute', bottom: -5, right: -5, zIndex: 10,
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                border: '2.5px solid #16182a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                boxShadow: '0 3px 12px rgba(245,158,11,0.5)',
              }}>🏆</div>
            </div>

            {/* Name + badges + level bar */}
            <div className="pv-name-block" style={{ paddingBottom: 16, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 8 }}>
                {user.surname} {user.name}
              </div>
              <div className="pv-badges-row" style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 13 }}>
                {/* Role badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: `rgba(${pRgb},0.18)`, color: '#a5b4fc',
                  border: `1px solid rgba(${pRgb},0.3)`,
                }}>🎓 {user.role?.charAt(0).toUpperCase()}{user.role?.slice(1)}</span>
                {user.classGrade && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}>{user.classGrade} · {user.class}</span>
                )}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(16,185,129,0.12)', color: '#34d399',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'sdPulse 2s infinite' }} />
                  Active
                </span>
              </div>
              {/* Profile level bar */}
              <div className="pv-level-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Profile Level</span>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%', width: `${profileCompletion}%`, borderRadius: 4,
                    background: `linear-gradient(90deg,${primaryColor},#8b5cf6,#a855f7)`,
                    boxShadow: `0 0 12px rgba(${pRgb},0.6)`, position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)',
                      animation: 'lvSweep 2.2s ease-in-out infinite',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#818cf8', whiteSpace: 'nowrap' }}>{profileCompletion}%</span>
              </div>
            </div>
          </div>

          {/* ── Stats grid ── */}
          <div className="pv-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, padding: '20px 28px 0' }}>
            {[
              { icon: Clock,       num: '4.5h',  lbl: 'Study Hours Today',  delta: '↑ +12% this week', dColor: '#34d399', dBg: 'rgba(16,185,129,0.12)',  glow: `rgba(${pRgb},0.5)`, iconBg: `rgba(${pRgb},0.14)` },
              { icon: CheckSquare, num: '24',    lbl: 'Assignments Done',   delta: '↑ +5 this week',   dColor: '#34d399', dBg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.5)', iconBg: 'rgba(16,185,129,0.14)' },
              { icon: BarChart2,   num: '91%',   lbl: 'Attendance Rate',    delta: '⚠ 3 days missed',  dColor: '#fbbf24', dBg: 'rgba(245,158,11,0.12)', glow: 'rgba(245,158,11,0.45)', iconBg: 'rgba(245,158,11,0.14)' },
            ].map(({ icon: Icon, num, lbl, delta, dColor, dBg, glow, iconBg }, i) => (
              <div key={i}
                className="pv-card-sweep pv-stats-card"
                onMouseEnter={spawnSparkle}
                {...tilt}
                style={{
                  borderRadius: 18, padding: '16px 18px', position: 'relative', overflow: 'hidden', isolation: 'isolate', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.035)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.06)',
                  transition: 'transform 0.25s cubic-bezier(0.34,1.25,0.64,1),box-shadow 0.25s ease,border-color 0.25s ease',
                  transformStyle: 'preserve-3d',
                }}
              >
                <div style={{ position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: glow, filter: 'blur(24px)', opacity: 0.35, zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 4 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Icon size={17} color="#94a3b8" />
                  </div>
                  <div className="pv-stat-num" style={{ fontSize: 26, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1 }}>{num}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginTop: 4 }}>{lbl}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginTop: 8, display: 'inline-block', background: dBg, color: dColor }}>{delta}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── ID chips ── */}
          <div className="pv-id-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '14px 28px 0' }}>
            {[
              { lbl: 'Student ID',   val: user.userId },
              { lbl: 'Reg. Number',  val: user.registrationNumber || user.userId },
            ].map(({ lbl, val }) => (
              <div key={lbl} style={{
                padding: '13px 18px', borderRadius: 15,
                background: `rgba(${pRgb},0.07)`,
                border: `1px solid rgba(${pRgb},0.18)`,
                transition: 'all 0.2s ease',
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em', fontFamily: "'Courier New',monospace" }}>{val || '—'}</div>
              </div>
            ))}
          </div>

          {/* ── Action buttons ── */}
          <div className="no-print pv-action-btns" style={{ display: 'flex', gap: 10, padding: '14px 28px 24px', flexWrap: 'wrap' }}>
            {[
              { label: '✏️ Edit Profile',   onClick: onEdit,              primary: true  },
              { label: '🔒 Password',        onClick: onChangePassword,    primary: false },
              { label: '🖨 Print Profile',   onClick: handlePrintProfile,  primary: false },
              { label: '💳 Print ID Card',   onClick: handlePrintIDCard,   primary: false },
            ].map(({ label, onClick, primary }) => (
              <button key={label}
                onClick={onClick}
                onMouseEnter={spawnSparkle}
                className="pv-btn-sweep"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px', borderRadius: 12,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                  fontFamily: "'Outfit',sans-serif", position: 'relative', overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.34,1.25,0.64,1)',
                  ...(primary
                    ? { background: gradient, color: '#fff', boxShadow: `0 4px 18px rgba(${pRgb},0.45)` }
                    : { background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.10)' }
                  ),
                }}
                onMouseEnterCapture={e => {
                  const el = e.currentTarget;
                  if (primary) {
                    el.style.transform = 'translateY(-3px) scale(1.05)';
                    el.style.boxShadow = `0 12px 30px rgba(${pRgb},0.55)`;
                  } else {
                    el.style.transform = 'translateY(-2px) scale(1.04)';
                    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
                    el.style.background = 'rgba(255,255,255,0.08)';
                  }
                }}
                onMouseLeaveCapture={e => {
                  const el = e.currentTarget;
                  el.style.transform = '';
                  el.style.boxShadow = primary ? `0 4px 18px rgba(${pRgb},0.45)` : '0 2px 10px rgba(0,0,0,0.25)';
                  if (!primary) el.style.background = 'rgba(255,255,255,0.05)';
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ══════════════════════════════════════
            ACHIEVEMENT BADGES
        ══════════════════════════════════════ */}
        <div className="pv-badge-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[
            { icon: Award,    em: '🏆', title: 'Top Student',   sub: 'Rank #7 this month',    bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)',  glow: 'rgba(245,158,11,0.3)'  },
            { icon: Flame,    em: '🔥', title: '7-Day Streak',  sub: 'Study consistency',      bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.20)',   glow: 'rgba(239,68,68,0.25)'  },
            { icon: BookOpen, em: '📚', title: 'Fast Learner',  sub: '3 courses this term',    bg: `rgba(${pRgb},0.08)`,    border: `rgba(${pRgb},0.22)`,    glow: `rgba(${pRgb},0.25)`   },
          ].map(({ em, title, sub, bg, border, glow }, i) => (
            <div key={i}
              className="pv-card-sweep"
              onMouseEnter={spawnSparkle}
              style={{
                borderRadius: 18, padding: '14px 16px', position: 'relative', overflow: 'hidden', isolation: 'isolate', cursor: 'pointer',
                background: bg, backdropFilter: 'blur(24px)',
                border: `1px solid ${border}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 13,
                transition: 'transform 0.25s cubic-bezier(0.34,1.25,0.64,1),box-shadow 0.25s ease',
              }}
              onMouseEnterCapture={e => { e.currentTarget.style.transform = 'translateY(-5px) scale(1.03)'; e.currentTarget.style.boxShadow = `0 16px 38px ${glow}`; }}
              onMouseLeaveCapture={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.06)'; }}
            >
              {/* Gold orb */}
              {i === 0 && <div style={{ position: 'absolute', bottom: -15, right: -15, width: 80, height: 80, borderRadius: '50%', background: 'rgba(245,158,11,0.3)', filter: 'blur(20px)' }} />}
              <div style={{ fontSize: 24, flexShrink: 0, position: 'relative', zIndex: 4 }}>{em}</div>
              <div style={{ position: 'relative', zIndex: 4 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#e2e8f0' }}>{title}</div>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════
            SEMESTER PROGRESS
        ══════════════════════════════════════ */}
        <GlassCard className="pv-semester-pad" style={{ padding: '20px 22px' }}>
          {/* Corner glow */}
          <div style={{
            position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%',
            background: `radial-gradient(circle,rgba(${pRgb},0.12)0%,transparent 70%)`,
            filter: 'blur(24px)', zIndex: 0,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={15} color="#818cf8" /> Semester Progress
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Week 14 of 22</span>
            </div>
            {/* Bar */}
            <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%', width: '62%', borderRadius: 6,
                background: `linear-gradient(90deg,${primaryColor},#8b5cf6,#a855f7)`,
                boxShadow: `0 0 14px rgba(${pRgb},0.5)`, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation: 'lvSweep 2.5s ease-in-out infinite' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#334155' }}>Semester Start</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#818cf8' }}>62% Complete</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#334155' }}>Finals</span>
            </div>
            {/* Subject pills */}
            <div className="pv-subject-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { name: 'Mathematics', grade: 'A+', pct: 95, bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.18)', color: '#34d399', fill: '#10b981' },
                { name: 'Physics',     grade: 'B+', pct: 78, bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.18)', color: '#60a5fa', fill: '#3b82f6' },
                { name: 'Biology',     grade: 'A',  pct: 87, bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.18)', color: '#34d399', fill: '#10b981' },
                { name: 'Chemistry',   grade: 'B',  pct: 72, bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.18)', color: '#fbbf24', fill: '#f59e0b' },
              ].map(({ name, grade, pct, bg, border, color, fill }) => (
                <div key={name} style={{
                  borderRadius: 12, padding: '10px 12px', textAlign: 'center',
                  background: bg, border: `1px solid ${border}`,
                  transition: 'transform 0.2s ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{name}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color }}>{grade}</div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: fill }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* ══════════════════════════════════════
            INFO GRID
        ══════════════════════════════════════ */}
        <div className="pv-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            {
              title: 'Personal Information', icon: User, cls: 's-ind',
              glowColor: `rgba(${pRgb},0.15)`, iconAccent: `rgba(${pRgb},0.14)`,
              rows: [
                { icon: User,     label: 'Full Name',     value: user.name },
                { icon: User,     label: 'Surname',       value: user.surname },
                { icon: Mail,     label: 'Email',         value: user.email },
                { icon: Calendar, label: 'Date of Birth', value: user.dob ? new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined },
                { icon: Users,    label: 'Gender',        value: user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : undefined },
                { icon: Droplet,  label: 'Blood Group',   value: user.bloodGroup },
                { icon: Shield,   label: 'Religion',      value: user.religion },
              ],
            },
            {
              title: 'Contact Information', icon: Phone, cls: 's-pur',
              glowColor: 'rgba(139,92,246,0.15)', iconAccent: 'rgba(139,92,246,0.14)',
              rows: [
                { icon: Phone,  label: 'Phone Number',   value: user.phoneNumber ? `+880${user.phoneNumber}` : undefined },
                { icon: Phone,  label: 'Mobile Number',  value: user.mobileNumber },
                { icon: Users,  label: 'Guardian Phone', value: user.guardianPhone ? `+880${user.guardianPhone}` : undefined },
                { icon: MapPin, label: 'Address',        value: user.address },
              ],
            },
            {
              title: 'Educational Information', icon: GraduationCap, cls: 's-grn',
              glowColor: 'rgba(16,185,129,0.12)', iconAccent: 'rgba(16,185,129,0.14)',
              rows: [
                { icon: GraduationCap, label: 'Class / Grade',     value: user.classGrade },
                { icon: GraduationCap, label: 'Current Class',     value: user.class },
                { icon: Building,      label: 'School',            value: user.school },
                { icon: GraduationCap, label: 'College/University',value: user.college },
              ],
            },
            {
              title: 'Account Information', icon: Shield, cls: 's-blu',
              glowColor: 'rgba(59,130,246,0.12)', iconAccent: 'rgba(59,130,246,0.14)',
              rows: [
                { icon: Shield,   label: 'Account Type', value: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : undefined },
                { icon: Shield,   label: 'Status',       value: user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Active' },
                { icon: Calendar, label: 'Member Since', value: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined },
              ],
            },
          ].map(({ title, icon: SectionIcon, glowColor, iconAccent, rows }) => (
            <div key={title}
              className="pv-card-sweep pv-info-card"
              onMouseEnter={spawnSparkle}
              style={{
                borderRadius: 20, padding: '18px 20px', position: 'relative', overflow: 'hidden', isolation: 'isolate', cursor: 'pointer',
                background: 'rgba(255,255,255,0.032)', backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.06)',
                transition: 'transform 0.25s cubic-bezier(0.34,1.25,0.64,1),box-shadow 0.25s ease,border-color 0.25s ease',
                transformStyle: 'preserve-3d',
              }}
              onMouseEnterCapture={e => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 20px 48px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.10)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
              }}
              onMouseLeaveCapture={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              {/* Corner glow */}
              <div style={{ position: 'absolute', top: -35, right: -35, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${glowColor} 0%,transparent 70%)`, filter: 'blur(22px)', zIndex: 0 }} />
              {/* Top shimmer */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.10)40%,rgba(255,255,255,0.20)50%,rgba(255,255,255,0.10)60%,transparent)', zIndex: 2 }} />
              {/* Noise */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1, background: NOISE, opacity: 0.04, mixBlendMode: 'overlay' }} />
              {/* Header */}
              <div className="pv-info-header" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, position: 'relative', zIndex: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: iconAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SectionIcon size={14} color="#94a3b8" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{title}</span>
              </div>
              {/* Rows */}
              {rows.map(r => <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} accent={iconAccent} />)}
            </div>
          ))}
        </div>

      </div>{/* /pv-printable */}
    </>
  );
};

export default ProfileView;
