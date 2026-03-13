import { useState, useRef } from 'react';
import { Save, Upload, Globe, Mail, BellRing, Lock, Users, Palette, Shield } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import ChangePasswordForm from '../components/profile/ChangePasswordModal';
import {
  saveAppearanceSettings,
  saveGeneralSettings,
  saveNotificationSettings,
  saveSecuritySettings,
  saveUsersPermissionsSettings,
} from '../services/settingsService';

const Settings = () => {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState('general');
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  
  const tabs = [
    { id: 'general', label: 'General', icon: <Globe size={18} />, adminOnly: true },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, adminOnly: false },
    { id: 'password', label: 'Change Password', icon: <Lock size={18} />, adminOnly: false },
    { id: 'notifications', label: 'Notifications', icon: <BellRing size={18} />, adminOnly: false },
    { id: 'security', label: 'Security', icon: <Lock size={18} />, adminOnly: true },
    { id: 'users', label: 'Users & Permissions', icon: <Users size={18} />, adminOnly: true },
  ];

  // Filter tabs based on user role
  const filteredTabs = tabs.filter(tab => {
    if (tab.adminOnly && !isAdmin) return false;
    if (tab.roles && user) {
      return tab.roles.includes(user.role);
    }
    return true;
  });

  // If not admin and trying to access admin-only tab, redirect to general
  if (!isAdmin && ['security', 'users'].includes(activeTab)) {
    setActiveTab('general');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{color:'var(--color-text,#111827)'}}>Settings</h1>
        <p className="text-sm mt-1" style={{color:'var(--color-text2,#6b7280)'}}>
          {isAdmin ? 'Administrator settings' : 'User preferences'}
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-1">
          <Card className="p-0">
            <ul className="py-2">
              {filteredTabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                      activeTab === tab.id
                        ? 'bg-primary-900/40 text-primary-300 border-l-2 border-primary-500'
                        : 'text-gray-300 hover:bg-background-800 hover:text-white'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.adminOnly && (
                      <Shield size={14} className="text-secondary-400 ml-auto" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        
        <div className="lg:col-span-4">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'password' && (
            <Card title="Change Password" subtitle="Update your account password">
              <ChangePasswordForm />
            </Card>
          )}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && isAdmin && <SecuritySettings />}
          {activeTab === 'users' && isAdmin && <UsersPermissionsSettings />}
        </div>
      </div>
    </div>
  );
};

const GeneralSettings = () => {
  const { user } = useDashboard();
  const [siteName, setSiteName] = useState('Learning Management Portal');
  const [siteTagline, setSiteTagline] = useState('Empowering educators, inspiring students');
  const [contactEmail, setContactEmail] = useState('admin@example.com');
  const [timezone, setTimezone] = useState('utc');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveGeneralSettings({ siteName, siteTagline, contactEmail, timezone });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="General Settings">
      <div className="space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Site Name</label>
          <input
            type="text"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Site Tagline</label>
          <input
            type="text"
            value={siteTagline}
            onChange={e => setSiteTagline(e.target.value)}
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
          <div className="flex">
            <div className="flex-shrink-0 bg-background-700 flex items-center px-3 rounded-l">
              <Mail size={18} className="text-gray-400" />
            </div>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="flex-1 bg-background-800 text-white rounded-r py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-3">Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-primary-900 rounded flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-300">L</span>
            </div>
            
            <div className="flex-1">
              <div className="border-2 border-dashed border-background-600 rounded p-4 text-center">
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-400 mb-2">Drag and drop logo file or click to browse</p>
                <button className="text-sm bg-background-800 hover:bg-background-700 text-white py-1 px-3 rounded transition-colors">
                  Upload Logo
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Recommended: 200x200px, PNG or SVG format</p>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="utc">UTC (Coordinated Universal Time)</option>
            <option value="est">EST (Eastern Standard Time)</option>
            <option value="cst">CST (Central Standard Time)</option>
            <option value="mst">MST (Mountain Standard Time)</option>
            <option value="pst">PST (Pacific Standard Time)</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors disabled:opacity-60"
          >
            <Save size={18} />
            <span>{saving ? 'Saving…' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const AppearanceSettings = () => {
  const { 
    theme, 
    setTheme, 
    primaryColor, 
    setPrimaryColor, 
    accentColor, 
    setAccentColor,
    fontFamily,
    setFontFamily,
    glitterTheme,
    setGlitterTheme,
    user,
  } = useDashboard();

  const [colorMode, setColorMode] = useState<'gradient' | 'solid'>('gradient');
  const [saving, setSaving] = useState(false);

  const handleSaveAppearance = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveAppearanceSettings(user.uid, { theme, primaryColor, accentColor, fontFamily, glitterTheme });
    } finally {
      setSaving(false);
    }
  };

  // ── Base themes (light/dark/etc) ──
  const themes = [
    { id: 'light',  name: 'Warm White',  desc: 'Clean parchment',  bg: '#f1eee7', card: '#ffffff', text: '#111827' },
    { id: 'dark',   name: 'Midnight',    desc: 'Deep dark',        bg: '#0d1117', card: '#1a1f2e', text: '#f1f5f9' },
    { id: 'slate',  name: 'Graphite',    desc: 'Minimal pro',      bg: '#0f172a', card: '#1e293b', text: '#e2e8f0' },
    { id: 'ocean',  name: 'Deep Sea',    desc: 'Cool calm',        bg: '#0c1a2e', card: '#0f2744', text: '#bae6fd' },
    { id: 'forest', name: 'Forest',      desc: 'Nature grounded',  bg: '#0a1f14', card: '#0f2d1e', text: '#bbf7d0' },
    { id: 'purple', name: 'Aurora',      desc: 'Indigo galaxy',    bg: '#1e1b4b', card: '#312e81', text: '#c4b5fd' },
    { id: 'pink',   name: 'Blossom',     desc: 'Rose energy',      bg: '#831843', card: '#9d174d', text: '#fce7f3' },
    { id: 'sunset', name: 'Sunset',      desc: 'Warm horizon',     bg: '#1c0a00', card: '#431407', text: '#fed7aa' },
  ];

  // ── Matte gradient palettes ──
  const gradientPalettes = [
    { name: 'Violet Storm',   p: '#7c3aed', a: '#06b6d4', preview: 'linear-gradient(135deg,#7c3aed,#06b6d4)' },
    { name: 'Sunset Glow',    p: '#f97316', a: '#ec4899', preview: 'linear-gradient(135deg,#f97316,#ec4899)' },
    { name: 'Ocean Breeze',   p: '#0ea5e9', a: '#10b981', preview: 'linear-gradient(135deg,#0ea5e9,#10b981)' },
    { name: 'Rose Quartz',    p: '#ec4899', a: '#8b5cf6', preview: 'linear-gradient(135deg,#ec4899,#8b5cf6)' },
    { name: 'Neon Mint',      p: '#10b981', a: '#a78bfa', preview: 'linear-gradient(135deg,#10b981,#a78bfa)' },
    { name: 'Golden Hour',    p: '#f59e0b', a: '#ef4444', preview: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
    { name: 'Arctic',         p: '#6366f1', a: '#22d3ee', preview: 'linear-gradient(135deg,#6366f1,#22d3ee)' },
    { name: 'Matcha',         p: '#059669', a: '#0ea5e9', preview: 'linear-gradient(135deg,#059669,#0ea5e9)' },
  ];

  // ── Solid color palettes (matte flat) ──
  const solidPalettes = [
    { name: 'Indigo',    p: '#6366f1', a: '#6366f1', preview: '#6366f1' },
    { name: 'Violet',    p: '#7c3aed', a: '#7c3aed', preview: '#7c3aed' },
    { name: 'Sky',       p: '#0ea5e9', a: '#0ea5e9', preview: '#0ea5e9' },
    { name: 'Emerald',   p: '#10b981', a: '#10b981', preview: '#10b981' },
    { name: 'Rose',      p: '#f43f5e', a: '#f43f5e', preview: '#f43f5e' },
    { name: 'Amber',     p: '#f59e0b', a: '#f59e0b', preview: '#f59e0b' },
    { name: 'Coral',     p: '#f97316', a: '#f97316', preview: '#f97316' },
    { name: 'Slate',     p: '#64748b', a: '#64748b', preview: '#64748b' },
    { name: 'Teal',      p: '#14b8a6', a: '#14b8a6', preview: '#14b8a6' },
    { name: 'Fuchsia',   p: '#a21caf', a: '#a21caf', preview: '#a21caf' },
    { name: 'Lime',      p: '#65a30d', a: '#65a30d', preview: '#65a30d' },
    { name: 'Crimson',   p: '#dc2626', a: '#dc2626', preview: '#dc2626' },
  ];

  // ── Font options ──
  const fontOptions = [
    { value: 'Outfit',           label: 'Outfit',           desc: 'Friendly & versatile',  cat: 'Sans' },
    { value: 'Sora',             label: 'Sora',             desc: 'Modern & geometric',    cat: 'Sans' },
    { value: 'DM Sans',          label: 'DM Sans',          desc: 'Clean & neutral',       cat: 'Sans' },
    { value: 'Plus Jakarta Sans',label: 'Plus Jakarta Sans',desc: 'Contemporary',          cat: 'Sans' },
    { value: 'Nunito',           label: 'Nunito',           desc: 'Rounded & warm',        cat: 'Sans' },
    { value: 'Raleway',          label: 'Raleway',          desc: 'Elegant & refined',     cat: 'Display' },
    { value: 'Josefin Sans',     label: 'Josefin Sans',     desc: 'Art deco flair',        cat: 'Display' },
    { value: 'Fira Code',        label: 'Fira Code',        desc: 'Monospace code',        cat: 'Mono' },
  ];

  const handleFontChange = (font: string) => {
    setFontFamily(font);
    const fontName = font.replace(/ /g, '+');
    const linkId = `gf-${fontName}`;
    if (!document.getElementById(linkId)) {
      const l = document.createElement('link');
      l.id = linkId; l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(l);
    }
    document.documentElement.style.setProperty('--font-sans', font);
    document.body.style.fontFamily = `'${font}', sans-serif`;
  };

  const isLight = theme === 'light';
  const bg = isLight ? '#f1eee7' : '#0f1117';
  const cardBg = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)';
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  const labelC = isLight ? '#374151' : '#94a3b8';
  const headC  = isLight ? '#111827' : '#f1f5f9';
  const descC  = isLight ? '#6b7280' : '#64748b';

  // Shared section heading style
  const SectionLabel = ({ children }: { children: string }) => (
    <p style={{ fontSize: 11, fontWeight: 700, color: labelC, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>{children}</p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Outfit',sans-serif" }}>

      {/* ── 1. Base Theme ── */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(20px)', boxShadow: isLight ? '0 2px 16px rgba(0,0,0,0.07)' : '0 2px 16px rgba(0,0,0,0.3)' }}>
        <SectionLabel>Environment Theme</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {themes.map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)} style={{
              position: 'relative', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
              border: theme === t.id ? `2px solid ${primaryColor}` : `1px solid ${border}`,
              outline: 'none', transition: 'all 0.18s ease',
              transform: theme === t.id ? 'scale(1.04)' : 'scale(1)',
              boxShadow: theme === t.id ? `0 0 0 3px ${primaryColor}28` : 'none',
            }}>
              {/* Preview swatch */}
              <div style={{ height: 44, background: t.bg, display: 'flex', alignItems: 'flex-end', padding: '0 6px 6px' }}>
                <div style={{ height: 18, flex: 1, borderRadius: 6, background: t.card, opacity: 0.9 }}/>
              </div>
              <div style={{ padding: '6px 8px', background: isLight ? '#fff' : '#1a1f2e' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: headC, margin: 0 }}>{t.name}</p>
                <p style={{ fontSize: 9, color: descC, margin: 0 }}>{t.desc}</p>
              </div>
              {theme === t.id && (
                <div style={{ position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: '50%', background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="8" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Accent Color System ── */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(20px)', boxShadow: isLight ? '0 2px 16px rgba(0,0,0,0.07)' : '0 2px 16px rgba(0,0,0,0.3)' }}>
        <SectionLabel>Accent Color System</SectionLabel>

        {/* Mode toggle: Gradient / Solid */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {(['gradient','solid'] as const).map(m => (
            <button key={m} onClick={() => setColorMode(m)} style={{
              padding: '5px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: colorMode === m ? (isLight ? '#fff' : 'rgba(255,255,255,0.14)') : 'transparent',
              color: colorMode === m ? primaryColor : (isLight ? '#6b7280' : '#64748b'),
              border: 'none', transition: 'all 0.18s ease',
              boxShadow: colorMode === m ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
              textTransform: 'capitalize',
            }}>{m}</button>
          ))}
        </div>

        {/* Gradient palettes */}
        {colorMode === 'gradient' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {gradientPalettes.map(pal => {
              const active = pal.p === primaryColor && pal.a === accentColor;
              return (
                <button key={pal.name} onClick={() => { setPrimaryColor(pal.p); setAccentColor(pal.a); }} style={{
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: active ? `2px solid ${pal.p}` : `1px solid ${border}`,
                  outline: 'none', transition: 'all 0.18s ease', transform: active ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: active ? `0 4px 14px ${pal.p}44` : 'none', background: 'transparent',
                }}>
                  <div style={{ height: 38, background: pal.preview }}/>
                  <div style={{ padding: '5px 8px', background: isLight ? '#fff' : '#1a1f2e' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: headC, margin: 0 }}>{pal.name}</p>
                  </div>
                  {active && (
                    <div style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: pal.p, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>
                      <svg width="7" height="7" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Solid palettes */}
        {colorMode === 'solid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
            {solidPalettes.map(pal => {
              const active = pal.p === primaryColor;
              return (
                <button key={pal.name} onClick={() => { setPrimaryColor(pal.p); setAccentColor(pal.a); }} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '10px 6px', borderRadius: 14, cursor: 'pointer',
                  border: active ? `2px solid ${pal.p}` : `1px solid ${border}`,
                  outline: 'none', transition: 'all 0.18s ease',
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: active ? `0 4px 14px ${pal.p}55` : 'none',
                  background: active ? `${pal.p}14` : (isLight ? '#fff' : 'rgba(255,255,255,0.04)'),
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: pal.preview, boxShadow: `0 2px 8px ${pal.p}55` }}/>
                  <p style={{ fontSize: 9, fontWeight: 600, color: headC, margin: 0, textAlign: 'center' }}>{pal.name}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Custom pickers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          {[{ label: 'Primary', val: primaryColor, set: setPrimaryColor }, { label: 'Accent', val: accentColor, set: setAccentColor }].map(({ label, val, set }) => (
            <div key={label}>
              <p style={{ fontSize: 11, fontWeight: 600, color: labelC, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '8px 10px', border: `1px solid ${border}` }}>
                <input type="color" value={val} onChange={e => set(e.target.value)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', flexShrink: 0 }}/>
                <input type="text" value={val} onChange={e => set(e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontFamily: 'monospace', color: headC }}/>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: val, flexShrink: 0, boxShadow: `0 2px 6px ${val}66` }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Typography ── */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(20px)', boxShadow: isLight ? '0 2px 16px rgba(0,0,0,0.07)' : '0 2px 16px rgba(0,0,0,0.3)' }}>
        <SectionLabel>Typography</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {fontOptions.map(f => {
            const active = fontFamily === f.value;
            return (
              <button key={f.value} onClick={() => handleFontChange(f.value)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                background: active ? `${primaryColor}14` : (isLight ? '#fff' : 'rgba(255,255,255,0.04)'),
                border: active ? `1.5px solid ${primaryColor}66` : `1px solid ${border}`,
                outline: 'none', transition: 'all 0.18s ease',
                boxShadow: active ? `0 4px 12px ${primaryColor}22` : 'none',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: headC, fontFamily: `'${f.value}', sans-serif`, margin: 0 }}>{f.label}</p>
                  <p style={{ fontSize: 10, color: descC, margin: 0 }}>{f.desc}</p>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: f.cat === 'Mono' ? '#854d0e22' : f.cat === 'Display' ? '#6d28d922' : '#1d4ed822', color: f.cat === 'Mono' ? '#b45309' : f.cat === 'Display' ? '#7c3aed' : '#1d4ed8', flexShrink: 0, textTransform: 'uppercase' }}>{f.cat}</span>
              </button>
            );
          })}
        </div>
        {/* Live preview */}
        <div style={{ marginTop: 12, padding: '14px 16px', background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', borderRadius: 14, border: `1px solid ${border}` }}>
          <p style={{ fontSize: 10, color: descC, marginBottom: 6 }}>LIVE PREVIEW</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: headC, fontFamily: `'${fontFamily}', sans-serif`, margin: 0 }}>The quick brown fox</p>
          <p style={{ fontSize: 13, color: labelC, fontFamily: `'${fontFamily}', sans-serif`, margin: 0 }}>jumps over the lazy dog — 1234567890</p>
        </div>
      </div>

      {/* ── 4. Glitter Background ── */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(20px)', boxShadow: isLight ? '0 2px 16px rgba(0,0,0,0.07)' : '0 2px 16px rgba(0,0,0,0.3)' }}>
        <SectionLabel>Glitter Background</SectionLabel>
        <p style={{ fontSize: 12, color: descC, marginBottom: 16, marginTop: -6 }}>
          Adds a sparkling matte particle texture to the dashboard. Automatically adapts to dark &amp; light mode.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            {
              id: 'none',
              name: 'Off',
              desc: 'No texture',
              darkBg: '#0d1117',
              lightBg: '#ebe8e1',
              particles: [],
            },
            {
              id: 'silver',
              name: 'Silver',
              desc: 'Neutral shimmer',
              darkBg: '#0d1117',
              lightBg: '#ebe8e1',
              particles: isLight
                ? ['rgba(80,80,100,0.45)', 'rgba(60,60,80,0.35)', 'rgba(80,80,100,0.40)']
                : ['rgba(220,220,240,0.7)', 'rgba(200,200,220,0.6)', 'rgba(240,240,255,0.65)'],
            },
            {
              id: 'gold',
              name: 'Gold',
              desc: 'Luxury shimmer',
              darkBg: '#13110d',
              lightBg: '#f5f0e8',
              particles: isLight
                ? ['rgba(150,110,0,0.6)', 'rgba(170,130,0,0.5)', 'rgba(140,100,0,0.55)']
                : ['rgba(212,175,55,0.75)', 'rgba(255,215,0,0.65)', 'rgba(200,160,40,0.70)'],
            },
            {
              id: 'purple',
              name: 'Purple Pearl',
              desc: 'Brand shimmer',
              darkBg: '#0e0c14',
              lightBg: '#f0eeff',
              particles: isLight
                ? ['rgba(79,70,229,0.55)', 'rgba(99,102,241,0.45)', 'rgba(79,70,229,0.50)']
                : ['rgba(200,180,255,0.75)', 'rgba(180,160,240,0.65)', 'rgba(220,200,255,0.70)'],
            },
          ].map(opt => {
            const active = glitterTheme === opt.id;
            const previewBg = isLight ? opt.lightBg : opt.darkBg;
            return (
              <button
                key={opt.id}
                onClick={() => setGlitterTheme(opt.id)}
                style={{
                  position: 'relative', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                  border: active ? `2px solid ${primaryColor}` : `1px solid ${border}`,
                  outline: 'none', transition: 'all 0.18s ease',
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                  boxShadow: active ? `0 0 0 3px ${primaryColor}28` : 'none',
                  background: 'transparent',
                }}
              >
                {/* Preview canvas */}
                <div style={{
                  height: 56,
                  background: previewBg,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {opt.particles.length > 0 && (
                    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                      {Array.from({ length: 28 }).map((_, i) => {
                        const col = opt.particles[i % opt.particles.length];
                        const cx = ((i * 37 + 11) % 100);
                        const cy = ((i * 53 + 7) % 100);
                        return <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r="0.8" fill={col} />;
                      })}
                    </svg>
                  )}
                  {opt.id === 'none' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 28, height: 2, background: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
                {/* Label */}
                <div style={{ padding: '6px 8px', background: isLight ? '#fff' : '#1a1f2e' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: headC, margin: 0 }}>{opt.name}</p>
                  <p style={{ fontSize: 9, color: descC, margin: 0 }}>{opt.desc}</p>
                </div>
                {active && (
                  <div style={{
                    position: 'absolute', top: 5, right: 5, width: 16, height: 16,
                    borderRadius: '50%', background: primaryColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Mode-sync badge */}
        <div style={{
          marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: isLight ? 'rgba(99,102,241,0.06)' : 'rgba(139,92,246,0.1)',
          border: `1px solid ${isLight ? 'rgba(99,102,241,0.15)' : 'rgba(139,92,246,0.2)'}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <p style={{ fontSize: 11, color: isLight ? '#4338ca' : '#a5b4fc', margin: 0 }}>
            <strong>Auto-synced</strong> — glitter colors automatically adapt to your current dark / light mode.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSaveAppearance}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer',
            background: `linear-gradient(135deg,${primaryColor},${accentColor})`,
            color: '#fff', fontSize: 14, fontWeight: 700, border: 'none',
            boxShadow: `0 4px 16px ${primaryColor}44`,
            fontFamily: "'Outfit',sans-serif",
            transition: 'all 0.18s ease',
            opacity: saving ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.transform = 'scale(1.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Save size={16}/>
          {saving ? 'Saving…' : 'Save Appearance'}
        </button>
      </div>

    </div>
  );
};
const NotificationSettings = () => {
  const { user } = useDashboard();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    newUserRegistrations: true,
    newContentUploads: true,
    studyPlanUpdates: false,
    systemAlerts: true,
    userActivityUpdates: true,
    contentEngagementMetrics: true,
    weeklySummaryReports: false,
    notificationFrequency: 'immediate' as const,
  });

  const toggle = (key: keyof typeof settings) =>
    setSettings(s => ({ ...s, [key]: !s[key as keyof typeof s] }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveNotificationSettings(user.uid, settings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Notification Settings">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Email Notifications</h3>
          <div className="space-y-3">
            {([
              ['newUserRegistrations', 'New user registrations'],
              ['newContentUploads', 'New content uploads'],
              ['studyPlanUpdates', 'Study plan updates'],
              ['systemAlerts', 'System alerts'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-gray-300 cursor-pointer">
                <span>{label}</span>
                <input type="checkbox" checked={settings[key]} onChange={() => toggle(key)}
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" />
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Dashboard Notifications</h3>
          <div className="space-y-3">
            {([
              ['userActivityUpdates', 'User activity updates'],
              ['contentEngagementMetrics', 'Content engagement metrics'],
              ['weeklySummaryReports', 'Weekly summary reports'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-gray-300 cursor-pointer">
                <span>{label}</span>
                <input type="checkbox" checked={settings[key]} onChange={() => toggle(key)}
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" />
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Notification Frequency</h3>
          <select
            value={settings.notificationFrequency}
            onChange={e => setSettings(s => ({ ...s, notificationFrequency: e.target.value as typeof s.notificationFrequency }))}
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly Digest</option>
            <option value="daily">Daily Digest</option>
            <option value="weekly">Weekly Digest</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors disabled:opacity-60">
            <Save size={18} />
            <span>{saving ? 'Saving…' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const SecuritySettings = () => {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    requireStrongPasswords: true,
    forcePasswordReset90Days: false,
    preventPasswordReuse: true,
    require2FAForAdmins: true,
    allowSMSVerification: true,
    allowAuthenticatorApps: true,
    autoLogoutMinutes: 30,
    allowConcurrentSessions: false,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
  });

  const toggle = (key: keyof typeof settings) =>
    setSettings(s => ({ ...s, [key]: !s[key as keyof typeof s] }));
  const setNum = (key: keyof typeof settings, val: number) =>
    setSettings(s => ({ ...s, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSecuritySettings(settings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Security Settings" subtitle="Administrator access required">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Password Policy</h3>
          <div className="space-y-3">
            {([
              ['requireStrongPasswords', 'Require strong passwords (min. 8 characters with uppercase, number, symbol)'],
              ['forcePasswordReset90Days', 'Force password reset every 90 days'],
              ['preventPasswordReuse', 'Prevent password reuse (last 5 passwords)'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-gray-300 cursor-pointer">
                <span>{label}</span>
                <input type="checkbox" checked={settings[key]} onChange={() => toggle(key)}
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" />
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Two-Factor Authentication</h3>
          <div className="space-y-3">
            {([
              ['require2FAForAdmins', 'Require 2FA for admin accounts'],
              ['allowSMSVerification', 'Allow SMS verification'],
              ['allowAuthenticatorApps', 'Allow authenticator apps'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-gray-300 cursor-pointer">
                <span>{label}</span>
                <input type="checkbox" checked={settings[key]} onChange={() => toggle(key)}
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" />
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Session Management</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Auto-logout after inactivity (minutes)</label>
              <input type="number" value={settings.autoLogoutMinutes} min="5" max="240"
                onChange={e => setNum('autoLogoutMinutes', Number(e.target.value))}
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow multiple concurrent sessions</span>
              <input type="checkbox" checked={settings.allowConcurrentSessions} onChange={() => toggle('allowConcurrentSessions')}
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Login Attempts</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max failed login attempts before lockout</label>
              <input type="number" value={settings.maxFailedLoginAttempts} min="3" max="10"
                onChange={e => setNum('maxFailedLoginAttempts', Number(e.target.value))}
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Account lockout duration (minutes)</label>
              <input type="number" value={settings.lockoutDurationMinutes} min="5" max="60"
                onChange={e => setNum('lockoutDurationMinutes', Number(e.target.value))}
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors disabled:opacity-60">
            <Save size={18} />
            <span>{saving ? 'Saving…' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const UsersPermissionsSettings = () => {
  const [saving, setSaving] = useState(false);
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(true);
  const [requireEmailVerification, setRequireEmailVerification] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUsersPermissionsSettings({
        allowPublicRegistration,
        requireEmailVerification,
        requireAdminApproval: requireApproval,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Users & Permissions Settings" subtitle="Administrator access required">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Role Management</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-background-800">
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Role</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Dashboard</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Users</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Content</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Study Plans</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Analytics</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Settings</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Admin</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Teacher</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Student</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Custom Role</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role Name</label>
              <input
                type="text"
                placeholder="E.g., Content Manager"
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Base Permissions On</label>
              <select className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select a role</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <button className="bg-primary-600 hover:bg-primary-700 text-white py-1.5 px-3 rounded text-sm transition-colors">
              Add Custom Role
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Registration Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow public registration</span>
              <input
                type="checkbox"
                checked={allowPublicRegistration}
                onChange={e => setAllowPublicRegistration(e.target.checked)}
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Require email verification</span>
              <input
                type="checkbox"
                checked={requireEmailVerification}
                onChange={e => setRequireEmailVerification(e.target.checked)}
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <div>
                <span>Require admin approval for new accounts</span>
                <p className="text-xs text-gray-400 mt-1">
                  When enabled, new user registrations will be pending until approved by an admin
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            {requireApproval && (
              <div className="ml-6 p-3 bg-primary-900/20 border border-primary-500/30 rounded-lg">
                <p className="text-sm text-primary-300 font-medium">Admin Approval Enabled</p>
                <p className="text-xs text-gray-400 mt-1">
                  New users will be created with "pending" status and cannot sign in until approved by an admin.
                  Admins will see pending users in the "Manage Users" section.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors disabled:opacity-60">
            <Save size={18} />
            <span>{saving ? 'Saving…' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

export default Settings;
