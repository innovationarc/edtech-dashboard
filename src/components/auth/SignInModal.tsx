// src/components/auth/SignInModal.tsx
import { useState, useEffect } from 'react';
import { X, Lock, Loader, CreditCard, AlertCircle, Eye, EyeOff, UserCircle, Shield, ArrowRight } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { AccountStatusError } from '../../services/authService';
import RegisterModal from './RegisterModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import ForgotUserIdModal from './ForgotUserIdModal';
import AccountStatusModal from './AccountStatusModal';

// ─── Self-contained color tokens (no external config needed) ───────────────
const C = {
  primary300: '#a5b4fc',
  primary400: '#818cf8',
  primary500: '#6366f1',
  primary600: '#4f46e5',
  primary700: '#4338ca',
  purple400:  '#c084fc',
  purple500:  '#a855f7',
  purple600:  '#9333ea',
  purple700:  '#7e22ce',
  blue600:    '#2563eb',
  blue700:    '#1d4ed8',
  // text colors
  textWhite:   '#ffffff',
  textGray100: '#f3f4f6',
  textGray200: '#e5e7eb',
  textGray300: '#d1d5db',
  textGray400: '#9ca3af',
  textGray500: '#6b7280',
  red200:      '#fecaca',
  red400:      '#f87171',
  green500:    '#22c55e',
  blueLite:    'rgba(219,234,254,0.9)',
  blueXLite:   '#eff6ff',
} as const;

// ─── Fully scoped styles – zero bleed from/to outside ──────────────────────
const SIGN_IN_STYLES = `
  /* === Scope: [data-sin] === */
  [data-sin] * { box-sizing: border-box; }

  @keyframes sin-shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
  [data-sin] .sin-shake { animation: sin-shake 0.4s ease-in-out; }

  [data-sin] .sin-input:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 4px rgba(99,102,241,0.15) !important;
    outline: none !important;
  }

  [data-sin] .sin-icon-hover:hover { color: #818cf8; }

  [data-sin] .sin-link {
    color: #818cf8 !important;
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;
    background: none !important;
    -webkit-text-fill-color: unset !important;
  }
  [data-sin] .sin-link:hover { color: #a5b4fc !important; }

  [data-sin] .sin-btn-primary {
    background: linear-gradient(to right, #4f46e5, #9333ea, #2563eb);
    transition: background 0.3s, transform 0.15s, box-shadow 0.3s;
  }
  [data-sin] .sin-btn-primary:hover:not(:disabled) {
    background: linear-gradient(to right, #4338ca, #7e22ce, #1d4ed8);
    transform: scale(1.02);
    box-shadow: 0 10px 30px rgba(99,102,241,0.4);
  }
  [data-sin] .sin-btn-primary:active:not(:disabled) { transform: scale(0.98); }
  [data-sin] .sin-btn-primary:disabled {
    background: linear-gradient(to right, #374151, #374151, #374151);
    cursor: not-allowed;
    box-shadow: none;
  }

  [data-sin] .sin-btn-secondary { transition: background 0.2s, border-color 0.2s, transform 0.15s; }
  [data-sin] .sin-btn-secondary:hover:not(:disabled) {
    border-color: rgba(99,102,241,0.5);
    transform: scale(1.02);
  }
  [data-sin] .sin-btn-secondary:active:not(:disabled) { transform: scale(0.98); }

  [data-sin] .sin-account-btn:hover { background: rgba(31,41,55,0.8); }

  [data-sin] .sin-shimmer {
    position: absolute; inset: 0;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
    transform: translateX(-200%);
    transition: transform 1s;
  }
  [data-sin] .sin-btn-primary:hover .sin-shimmer,
  [data-sin] .sin-btn-secondary:hover .sin-shimmer { transform: translateX(200%); }

  [data-sin] .sin-info-box { transition: transform 0.3s; }
  [data-sin] .sin-info-box:hover { transform: scale(1.02); }

  [data-sin] .sin-close-btn:hover { background: rgba(55,65,81,0.5); }

  /* ── Input base resets ── */
  [data-sin] .sin-input {
    width: 100%;
    border-width: 2px;
    border-style: solid;
    border-color: rgba(55,65,81,0.5);
    border-radius: 0.75rem;
    background: rgba(31,41,55,0.5);
    color: #ffffff;
    outline: none;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  [data-sin] .sin-input::placeholder { color: #6b7280; }
  [data-sin] .sin-input:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// ─── Inline style helpers ───────────────────────────────────────────────────
const S = {
  // Layout / container
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 80,
    overflowY: 'auto' as const,
  },
  centerWrap: {
    display: 'flex', justifyContent: 'center',
    minHeight: '100%', padding: '12px',
    alignItems: 'flex-start',
  },
  card: {
    background: 'linear-gradient(to bottom right, #111827, #111827, #1f2937)',
    borderRadius: '1.5rem',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    width: '100%', maxWidth: '448px',
    border: '1px solid rgba(55,65,81,0.5)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  bgGlow: { position: 'absolute' as const, inset: 0, pointerEvents: 'none' as const, background: 'linear-gradient(to bottom right, rgba(99,102,241,0.05), rgba(168,85,247,0.05), rgba(37,99,235,0.05))' },
  glow1: { position: 'absolute' as const, top: -96, right: -96, width: 192, height: 192, borderRadius: '50%', filter: 'blur(48px)', pointerEvents: 'none' as const, background: 'rgba(99,102,241,0.1)' },
  glow2: { position: 'absolute' as const, bottom: -96, left: -96, width: 192, height: 192, borderRadius: '50%', filter: 'blur(48px)', pointerEvents: 'none' as const, background: 'rgba(168,85,247,0.1)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(55,65,81,0.5)' },
  iconBox: { height: 40, width: 40, borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', background: `linear-gradient(to bottom right, ${C.primary500}, ${C.purple600})` },
  headerTitle: { fontSize: '1.25rem', fontWeight: 700, color: C.textWhite, margin: 0 },
  headerSub: { fontSize: '0.75rem', color: C.textGray400, marginTop: 2 },
  closeBtn: { height: 36, width: 36, borderRadius: '0.75rem', background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(55,65,81,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' },
  content: { padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  // Error
  errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 },
  errorText: { fontSize: '0.75rem', color: C.red200, lineHeight: 1.4 },
  // Form group
  label: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, color: C.textGray300, marginBottom: 6 },
  inputWrap: { position: 'relative' as const },
  inputBase: { paddingTop: 10, paddingBottom: 10, paddingLeft: 38, paddingRight: 12, fontSize: '0.875rem', letterSpacing: '0.05em' },
  inputMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  metaText: { fontSize: '0.7rem', color: C.textGray500 },
  iconAbs: { position: 'absolute' as const, left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textGray500, pointerEvents: 'none' as const },
  eyeBtn: { position: 'absolute' as const, right: 10, top: '50%', transform: 'translateY(-50%)', color: C.textGray500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' },
  // Checkbox
  checkLabel: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' as const },
  checkText: { fontSize: '0.8125rem', color: C.textGray400, fontWeight: 500 },
  // Divider
  dividerWrap: { position: 'relative' as const, margin: '4px 0' },
  dividerLine: { position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center' },
  dividerInner: { width: '100%', borderTop: '1px solid rgba(55,65,81,0.5)' },
  dividerText: { position: 'relative' as const, display: 'flex', justifyContent: 'center', fontSize: '0.7rem' },
  dividerSpan: { padding: '0 12px', background: '#111827', color: C.textGray500, fontWeight: 500 },
  // Buttons
  btnPrimary: { width: '100%', color: C.textWhite, padding: '12px 0', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: 'pointer', position: 'relative' as const, overflow: 'hidden' },
  btnSecondary: { width: '100%', background: 'rgba(31,41,55,0.5)', border: '2px solid rgba(55,65,81,0.5)', color: C.textWhite, padding: '12px 0', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', position: 'relative' as const, overflow: 'hidden' },
  createText: { background: `linear-gradient(to right, ${C.primary400}, ${C.purple400})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  // Info box
  infoBox: { marginTop: 4, border: '1px solid rgba(59,130,246,0.2)', borderRadius: '0.75rem', padding: '12px 16px', background: 'linear-gradient(to bottom right, rgba(30,58,138,0.2), rgba(88,28,135,0.2))' },
  infoInner: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  infoIconWrap: { height: 28, width: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'linear-gradient(to bottom right, #3b82f6, #9333ea)' },
  infoTitle: { display: 'block', fontWeight: 600, color: C.blueXLite, marginBottom: 4, fontSize: '0.75rem' },
  infoText: { fontSize: '0.75rem', lineHeight: 1.6, color: C.blueLite },
  // Security
  securityWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  securityText: { fontSize: '0.7rem', color: C.textGray500 },
  // Terms
  termsWrap: { textAlign: 'center' as const, paddingBottom: 4 },
  termsText: { fontSize: '0.7rem', color: C.textGray500, lineHeight: 1.6, padding: '0 4px' },
};

interface SignInModalProps {
  onClose: () => void;
}

const SignInModal = ({ onClose }: SignInModalProps) => {
  const { handleSignIn } = useDashboard();
  
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotUserId, setShowForgotUserId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [displayUserId, setDisplayUserId] = useState('');
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'inactive' | 'pending' | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadRecaptcha = () => {
      if (window.grecaptcha) { setCaptchaLoaded(true); return; }
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}`;
      script.async = true; script.defer = true;
      script.onload = () => setCaptchaLoaded(true);
      document.head.appendChild(script);
    };
    loadRecaptcha();
  }, []);

  useEffect(() => {
    try {
      const savedRememberMe = localStorage.getItem('auth_remember_me');
      const savedUserId = localStorage.getItem('auth_user_id');
      if (savedRememberMe === 'true' && savedUserId) {
        setRememberMe(true); setUserId(savedUserId); setDisplayUserId(savedUserId);
      }
    } catch { /* silent */ }
  }, []);

  const getCaptchaToken = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha || !captchaLoaded) { reject(new Error('reCAPTCHA not loaded')); return; }
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', { action: 'login' })
          .then(resolve).catch(reject);
      });
    });
  };

  const formatUserIdInput = (input: string): { display: string; value: string } => {
    const cleaned = input.replace(/[^a-zA-Z0-9]/g, '');
    let prefix = ''; let yearMonth = ''; let sequence = '';
    if (cleaned.length >= 1) prefix = cleaned.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, '');
    if (cleaned.length > 2) yearMonth = cleaned.substring(prefix.length).substring(0, 4).replace(/[^0-9]/g, '');
    if (cleaned.length > 6) sequence = cleaned.substring(prefix.length + yearMonth.length).substring(0, 5).replace(/[^0-9]/g, '');
    let display = prefix;
    if (yearMonth) display += '-' + yearMonth;
    if (sequence) display += '-' + sequence;
    const value = prefix + (yearMonth ? '-' + yearMonth : '') + (sequence ? '-' + sequence : '');
    return { display, value };
  };

  const handleUserIdChange = (input: string) => {
    const formatted = formatUserIdInput(input);
    setDisplayUserId(formatted.display); setUserId(formatted.value);
    if (error) setError('');
  };

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    if (!userId || !password) { setError('Please fill in all fields'); setLoading(false); return; }
    try { await getCaptchaToken(); } catch {
      setError('Please wait for security verification to load'); setLoading(false); return;
    }
    try {
      await handleSignIn(userId, password, rememberMe); onClose();
    } catch (err: any) {
      if (err instanceof AccountStatusError) {
        setAccountStatus(err.status); setAccountUserId(err.userId); setShowAccountStatusModal(true);
      } else { setError(err.message || 'Invalid credentials'); }
    } finally { setLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); };

  if (showRegister) return <RegisterModal onClose={() => setShowRegister(false)} onSwitchToSignIn={() => setShowRegister(false)} />;
  if (showForgotPassword) return (
    <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} onSwitchToForgotUserId={() => { setShowForgotPassword(false); setShowForgotUserId(true); }} />
  );
  if (showForgotUserId) return <ForgotUserIdModal onClose={() => setShowForgotUserId(false)} />;
  if (showAccountStatusModal && accountStatus) return (
    <AccountStatusModal status={accountStatus} userId={accountUserId} onClose={() => { setShowAccountStatusModal(false); setAccountStatus(null); setAccountUserId(undefined); }} />
  );

  return (
    <div data-sin="" style={S.overlay}>
      <style>{SIGN_IN_STYLES}</style>
      <div style={S.centerWrap}>
        <div style={S.card}>
          {/* Animated background effects */}
          <div style={S.bgGlow} />
          <div style={S.glow1} />
          <div style={S.glow2} />

          <div style={{ position: 'relative' }}>
            {/* Header */}
            <div style={S.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={S.iconBox}>
                  <Lock size={18} color={C.textWhite} />
                </div>
                <div>
                  <h2 style={S.headerTitle}>Welcome Back</h2>
                  <p style={S.headerSub}>Sign in to continue</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="sin-close-btn"
                style={{ ...S.closeBtn, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                aria-label="Close modal"
              >
                <X size={16} color={C.textGray400} />
              </button>
            </div>

            {/* Content */}
            <div style={S.content}>
              {/* Error */}
              {error && (
                <div className="sin-shake" style={S.errorBox}>
                  <AlertCircle size={16} color={C.red400} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={S.errorText}>{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* User ID */}
                <div>
                  <label style={S.label}>
                    <CreditCard size={13} color={C.primary400} />
                    <span>User ID</span>
                  </label>
                  <div style={S.inputWrap}>
                    <input
                      type="text"
                      value={displayUserId}
                      onChange={(e) => handleUserIdChange(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="sin-input"
                      style={{ ...S.inputBase, textTransform: 'uppercase' }}
                      placeholder="ST-2601-00001"
                      disabled={loading}
                      autoComplete="username"
                      maxLength={13}
                    />
                    <CreditCard size={14} className="sin-icon-hover" style={S.iconAbs} color={C.textGray500} />
                  </div>
                  <div style={S.inputMeta}>
                    <span style={S.metaText}>Format: XX-YYMM-XXXXX</span>
                    <button type="button" onClick={() => setShowForgotUserId(true)} className="sin-link" style={{ fontSize: '0.7rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} disabled={loading}>
                      Forgot User ID?
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={S.label}>
                    <Lock size={13} color={C.primary400} />
                    <span>Password</span>
                  </label>
                  <div style={S.inputWrap}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="sin-input"
                      style={{ ...S.inputBase, paddingRight: 38 }}
                      placeholder="Enter your password"
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <Lock size={14} className="sin-icon-hover" style={S.iconAbs} color={C.textGray500} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ ...S.eyeBtn, opacity: loading ? 0.5 : 1 }}
                      disabled={loading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} color={C.textGray500} /> : <Eye size={15} color={C.textGray500} />}
                    </button>
                  </div>
                  <div style={S.inputMeta}>
                    <span style={S.metaText}>Use a strong password</span>
                    <button type="button" onClick={() => setShowForgotPassword(true)} className="sin-link" style={{ fontSize: '0.7rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} disabled={loading}>
                      Forgot Password?
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div>
                  <label style={S.checkLabel}>
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid', transition: 'all 0.3s',
                        borderColor: rememberMe ? C.primary500 : '#4b5563',
                        background: rememberMe ? `linear-gradient(to bottom right, ${C.primary500}, ${C.purple600})` : 'rgba(31,41,55,0.5)',
                        opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => !loading && setRememberMe(v => !v)}
                    >
                      <svg style={{ width: 10, height: 10, opacity: rememberMe ? 1 : 0, transform: rememberMe ? 'scale(1)' : 'scale(0)', transition: 'all 0.2s' }} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="white">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} disabled={loading} />
                    <span style={S.checkText}>Keep me signed in</span>
                  </label>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loading || !captchaLoaded}
                  className="sin-btn-primary"
                  style={S.btnPrimary}
                >
                  <div className="sin-shimmer" />
                  <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {loading && <Loader size={16} color={C.textWhite} style={{ animation: 'spin 1s linear infinite' }} />}
                    <span style={{ color: C.textWhite }}>{loading ? 'Signing In...' : !captchaLoaded ? 'Loading Security...' : 'Sign In'}</span>
                    {!loading && captchaLoaded && <ArrowRight size={16} color={C.textWhite} />}
                  </span>
                </button>
              </form>

              {/* Divider */}
              <div style={S.dividerWrap}>
                <div style={S.dividerLine}><div style={S.dividerInner} /></div>
                <div style={S.dividerText}><span style={S.dividerSpan}>New to our platform?</span></div>
              </div>

              {/* Create Account */}
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="sin-btn-secondary sin-account-btn"
                style={{ ...S.btnSecondary, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                disabled={loading}
              >
                <div className="sin-shimmer" />
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCircle size={16} color={C.primary400} />
                  <span style={S.createText}>Create New Account</span>
                  <ArrowRight size={16} color={C.primary400} />
                </span>
              </button>

              {/* Info Box */}
              <div className="sin-info-box" style={S.infoBox}>
                <div style={S.infoInner}>
                  <div style={S.infoIconWrap}>
                    <span style={{ fontSize: '0.75rem', color: C.textWhite, fontWeight: 700 }}>i</span>
                  </div>
                  <div>
                    <strong style={S.infoTitle}>First time signing in?</strong>
                    <p style={S.infoText}>Use the User ID provided during registration along with your password to access your account.</p>
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              {captchaLoaded && (
                <div style={S.securityWrap}>
                  <Shield size={12} color={C.green500} />
                  <span style={S.securityText}>Protected by reCAPTCHA</span>
                </div>
              )}

              {/* Terms */}
              <div style={S.termsWrap}>
                <p style={S.termsText}>
                  By continuing, you agree to our{' '}
                  <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="sin-link">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="sin-link">Privacy Policy</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInModal;
