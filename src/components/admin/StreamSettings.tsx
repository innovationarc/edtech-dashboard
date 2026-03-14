// src/components/admin/StreamSettings.tsx
import React, { useState, useEffect } from 'react';
import { Radio, Save, CheckCircle, AlertCircle, Loader, Zap, Info, Eye, EyeOff } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { streamingSettingsService } from '../../services/streamService';
import { StreamingSettings, StreamProvider } from '../../types/streamTypes';

const StreamSettings: React.FC = () => {
  const { theme, primaryColor, user } = useDashboard();
  const darkMode = theme !== 'light';

  const [settings, setSettings] = useState<Partial<StreamingSettings>>({
    activeProvider: 'youtube',
    bunny: { apiKey: '', pullZoneHostname: '' },
    cloudflare: { accountId: '', apiToken: '', customerSubdomain: '' },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<StreamProvider | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showBunnyKey, setShowBunnyKey] = useState(false);
  const [showCfToken, setShowCfToken] = useState(false);

  useEffect(() => {
    streamingSettingsService.get()
      .then(s => { if (s) setSettings(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await streamingSettingsService.save(settings, user?.uid ?? 'admin');
      setFeedback({ type: 'success', message: 'Settings saved successfully!' });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const testBunny = async () => {
    if (!settings.bunny?.apiKey) return;
    setTestingProvider('bunny');
    setFeedback(null);
    try {
      // Test Bunny API key by listing libraries
      const res = await fetch('https://video.bunnycdn.com/videolibrary?page=1&itemsPerPage=1', {
        headers: { AccessKey: settings.bunny.apiKey },
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Bunny API key is valid! Connection successful.' });
      } else if (res.status === 401) {
        setFeedback({ type: 'error', message: 'Invalid Bunny API key. Please check and try again.' });
      } else {
        setFeedback({ type: 'error', message: `Bunny API responded with status ${res.status}.` });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Could not reach Bunny API. This may be a CORS issue — keys are usually valid even if test fails here.' });
    } finally {
      setTestingProvider(null);
    }
  };

  const testCloudflare = async () => {
    if (!settings.cloudflare?.accountId || !settings.cloudflare?.apiToken) return;
    setTestingProvider('cloudflare');
    setFeedback(null);
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${settings.cloudflare.accountId}/stream/live_inputs?per_page=1`,
        { headers: { Authorization: `Bearer ${settings.cloudflare.apiToken}` } }
      );
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', message: 'Cloudflare credentials verified! Connection successful.' });
      } else {
        setFeedback({ type: 'error', message: data.errors?.[0]?.message ?? 'Invalid Cloudflare credentials.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Could not reach Cloudflare API. Check your account ID and API token.' });
    } finally {
      setTestingProvider(null);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────

  const surface = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const border = darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
  const textPrimary = darkMode ? 'rgba(255,255,255,0.88)' : '#111827';
  const textSecondary = darkMode ? '#94a3b8' : '#6b7280';
  const textMuted = darkMode ? '#64748b' : '#9ca3af';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
    background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
    color: textPrimary, fontFamily: "'Outfit', sans-serif", outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const cardStyle: React.CSSProperties = {
    background: surface, border, borderRadius: 14, padding: '20px 22px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
  };

  const testBtnStyle = (color: string): React.CSSProperties => ({
    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
    background: `${color}18`, border: `1px solid ${color}40`,
    color, cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
  });

  const providers: { id: StreamProvider; label: string; desc: string; color: string }[] = [
    { id: 'youtube', label: 'YouTube Live', desc: 'Teacher-supplied stream key. Free forever.', color: '#ef4444' },
    { id: 'bunny', label: 'Bunny Stream', desc: 'Platform auto-creates RTMP streams. ~$0.01/GB.', color: '#f59e0b' },
    { id: 'cloudflare', label: 'Cloudflare Stream', desc: 'Auto-creates RTMP + browser streaming. $5/mo.', color: '#f97316' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12 }}>
        <Loader size={26} style={{ color: primaryColor, animation: 'spin 1s linear infinite' }} />
        <p style={{ color: textSecondary, fontSize: 14 }}>Loading settings…</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'Outfit', sans-serif", maxWidth: 740 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'clamp(1.2rem,2.5vw,1.5rem)', fontWeight: 800, color: textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={22} color={primaryColor} /> Stream Settings
        </h1>
        <p style={{ color: textSecondary, marginTop: 4, fontSize: 14 }}>
          Configure providers for live streaming broadcasts to large audiences.
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderRadius: 12,
          background: feedback.type === 'success' ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.28)'}`,
        }}>
          {feedback.type === 'success'
            ? <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0 }} />
            : <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />}
          <span style={{ fontSize: 13, color: feedback.type === 'success' ? '#10b981' : '#ef4444', flex: 1 }}>
            {feedback.message}
          </span>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Active Provider */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: textPrimary, margin: '0 0 14px' }}>
          Active Provider
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {providers.map(p => {
            const active = settings.activeProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSettings(s => ({ ...s, activeProvider: p.id }))}
                style={{
                  flex: 1, minWidth: 160, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, textAlign: 'left',
                  background: active ? `${p.color}1a` : surface,
                  border: active ? `2px solid ${p.color}50` : border.replace('1px', '2px'),
                  color: active ? p.color : textSecondary,
                  transition: 'all 0.15s',
                }}
              >
                <div>{p.label}</div>
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, color: active ? `${p.color}99` : textMuted, lineHeight: 1.4 }}>{p.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* YouTube */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', margin: '0 0 10px' }}>
          YouTube Live
        </h3>
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <Info size={15} style={{ color: '#fca5a5', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: '#fca5a5', margin: 0, lineHeight: 1.6 }}>
            <strong>No platform credentials needed.</strong> Each teacher creates their own stream in YouTube Studio, then pastes their Stream Key and Video ID directly into the stream creation form. Recordings are automatically saved to YouTube after the stream ends — completely free.
          </p>
        </div>
      </div>

      {/* Bunny Stream */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', margin: '0 0 16px' }}>
          Bunny Stream Live
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>API Key</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showBunnyKey ? 'text' : 'password'}
                value={settings.bunny?.apiKey ?? ''}
                onChange={e => setSettings(s => ({ ...s, bunny: { ...s.bunny!, apiKey: e.target.value } }))}
                placeholder="Your Bunny Stream API key"
                style={{ ...inputStyle, paddingRight: 42 }}
              />
              <button
                onClick={() => setShowBunnyKey(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted }}
              >
                {showBunnyKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
              Found in Bunny Dashboard → Account → API
            </p>
          </div>
          <div>
            <label style={labelStyle}>Pull Zone Hostname</label>
            <input
              type="text"
              value={settings.bunny?.pullZoneHostname ?? ''}
              onChange={e => setSettings(s => ({ ...s, bunny: { ...s.bunny!, pullZoneHostname: e.target.value } }))}
              placeholder="e.g. myplatform.b-cdn.net"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
              Your Bunny CDN pull zone hostname for live streams
            </p>
          </div>
          <button
            onClick={testBunny}
            disabled={testingProvider === 'bunny' || !settings.bunny?.apiKey}
            style={{ ...testBtnStyle('#f59e0b'), opacity: !settings.bunny?.apiKey ? 0.5 : 1 }}
          >
            {testingProvider === 'bunny'
              ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <Zap size={12} />}
            Test Bunny Connection
          </button>
        </div>
      </div>

      {/* Cloudflare Stream */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f97316', margin: '0 0 16px' }}>
          Cloudflare Stream
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Account ID</label>
            <input
              type="text"
              value={settings.cloudflare?.accountId ?? ''}
              onChange={e => setSettings(s => ({ ...s, cloudflare: { ...s.cloudflare!, accountId: e.target.value } }))}
              placeholder="Your Cloudflare account ID"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
              Cloudflare Dashboard → Right sidebar → Account ID
            </p>
          </div>
          <div>
            <label style={labelStyle}>API Token</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCfToken ? 'text' : 'password'}
                value={settings.cloudflare?.apiToken ?? ''}
                onChange={e => setSettings(s => ({ ...s, cloudflare: { ...s.cloudflare!, apiToken: e.target.value } }))}
                placeholder="Stream Read & Write API token"
                style={{ ...inputStyle, paddingRight: 42 }}
              />
              <button
                onClick={() => setShowCfToken(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted }}
              >
                {showCfToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
              Create a token with <em>Stream:Read</em> and <em>Stream:Write</em> permissions
            </p>
          </div>
          <div>
            <label style={labelStyle}>Customer Subdomain</label>
            <input
              type="text"
              value={settings.cloudflare?.customerSubdomain ?? ''}
              onChange={e => setSettings(s => ({ ...s, cloudflare: { ...s.cloudflare!, customerSubdomain: e.target.value } }))}
              placeholder="e.g. customer-abc123xyz"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
              Cloudflare Dashboard → Stream → Overview → "Customer subdomain" section
            </p>
          </div>
          <button
            onClick={testCloudflare}
            disabled={testingProvider === 'cloudflare' || !settings.cloudflare?.apiToken || !settings.cloudflare?.accountId}
            style={{ ...testBtnStyle('#f97316'), opacity: (!settings.cloudflare?.apiToken || !settings.cloudflare?.accountId) ? 0.5 : 1 }}
          >
            {testingProvider === 'cloudflare'
              ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <Zap size={12} />}
            Test Cloudflare Connection
          </button>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700,
          background: primaryColor, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: "'Outfit', sans-serif", alignSelf: 'flex-start',
          opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
          boxShadow: `0 4px 16px ${primaryColor}40`,
        }}
      >
        {saving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default StreamSettings;
