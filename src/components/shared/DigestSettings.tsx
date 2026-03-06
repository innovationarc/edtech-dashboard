// src/components/shared/DigestSettings.tsx
// Weekly Digest Settings Panel — enable, schedule, preview, send now, history

import React, { useState, useEffect } from 'react';
import {
  Mail, Loader, CheckCircle2, X, Eye, Bell, BellOff,
  Calendar, Clock, Sparkles, RefreshCw, Send,
  BookOpen, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useDashboard } from '../../contexts/DashboardContext';
import { weeklyDigestService, DigestPreferences, DigestRecord } from '../../services/weeklyDigestService';

const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? 'AM' : 'PM'}`,
}));

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button type="button" onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${value ? 'bg-primary-600' : 'bg-background-600'}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const DigestSettings: React.FC = () => {
  const { user } = useDashboard();

  const defaultPrefs: Omit<DigestPreferences, 'createdAt'> = {
    studentId: user?.uid || '',
    enabled: false,
    deliveryDay: 1,
    deliveryHour: 8,
    email: user?.email || '',
    includeAIInsights: true,
    includeUpcoming: true,
    includeProgress: true,
  };

  const [prefs, setPrefs]             = useState(defaultPrefs);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [sending, setSending]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState('');
  const [history, setHistory]         = useState<DigestRecord[]>([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendResult, setSendResult]   = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([loadPrefs(), loadHistory()]).finally(() => setLoading(false));
  }, [user]);

  const loadPrefs = async () => {
    try {
      const p = await weeklyDigestService.getPreferences(user!.uid);
      if (p) setPrefs({ studentId: p.studentId, enabled: p.enabled, deliveryDay: p.deliveryDay, deliveryHour: p.deliveryHour, email: p.email, includeAIInsights: p.includeAIInsights, includeUpcoming: p.includeUpcoming, includeProgress: p.includeProgress, lastSentAt: p.lastSentAt, nextScheduledAt: p.nextScheduledAt });
    } catch (e: any) { setError(e.message); }
  };

  const loadHistory = async () => {
    try { setHistory(await weeklyDigestService.getDigestHistory(user!.uid, 5)); }
    catch { /* silent */ }
  };

  const set = (key: keyof typeof prefs, value: any) => setPrefs(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true); setError('');
    try {
      await weeklyDigestService.savePreferences({ ...prefs, studentId: user.uid });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      await loadPrefs();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    if (!user) return;
    setPreviewLoading(true); setError('');
    try {
      const p = await weeklyDigestService.previewDigest(user.uid, user.displayName || user.name || 'Student', prefs.email || user.email);
      setPreviewHtml(p.html);
      setShowPreview(true);
    } catch (e: any) { setError('Preview failed: ' + e.message); }
    finally { setPreviewLoading(false); }
  };

  const handleSendNow = async () => {
    if (!user || !prefs.email) return;
    setSending(true); setSendResult(null);
    try {
      const r = await weeklyDigestService.sendDigest(user.uid, user.displayName || user.name || 'Student', prefs.email);
      setSendResult({ success: r.success, msg: r.success ? 'Digest sent successfully!' : r.error || 'Send failed' });
      if (r.success) await loadHistory();
    } catch (e: any) { setSendResult({ success: false, msg: e.message }); }
    finally { setSending(false); }
  };

  const nextDate = prefs.enabled
    ? format(weeklyDigestService.calcNextSendDate(prefs.deliveryDay, prefs.deliveryHour), 'EEE, MMM d · h:mm a')
    : null;

  if (loading) return (
    <div className="flex items-center justify-center py-12"><Loader size={24} className="animate-spin text-primary-500" /></div>
  );

  const sectionCls  = 'bg-background-800 rounded-2xl border border-background-700 p-5';
  const inputCls    = 'w-full bg-background-700 text-white text-sm rounded-xl px-3 py-2.5 border border-background-600 focus:outline-none focus:border-primary-500 transition-colors';
  const labelCls    = 'block text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide';

  return (
    <div className="space-y-5 max-w-xl">

      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Mail size={19} className="text-primary-400" /> Weekly Email Digest
        </h2>
        <p className="text-sm text-gray-400 mt-1">Personalized weekly summary powered by Gemini 2.5 Flash.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle size={14} />{error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {sendResult && (
        <div className={`px-4 py-3 rounded-xl flex items-center gap-2 text-sm border ${sendResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {sendResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {sendResult.msg}
          <button onClick={() => setSendResult(null)} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* Enable */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${prefs.enabled ? 'bg-primary-600/20' : 'bg-background-700'}`}>
              {prefs.enabled ? <Bell size={16} className="text-primary-400" /> : <BellOff size={16} className="text-gray-500" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Weekly Digest</p>
              <p className="text-xs text-gray-400">{prefs.enabled ? 'Active' : 'Disabled'}</p>
            </div>
          </div>
          <Toggle value={prefs.enabled} onChange={v => set('enabled', v)} />
        </div>
        {prefs.enabled && nextDate && (
          <p className="mt-3 pt-3 border-t border-background-700 text-xs text-emerald-300 flex items-center gap-1.5">
            <Calendar size={12} /> Next: <span className="font-semibold">{nextDate}</span>
          </p>
        )}
        {prefs.lastSentAt && (
          <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1.5">
            <CheckCircle2 size={11} /> Last sent: {format(prefs.lastSentAt, 'MMM d, yyyy · h:mm a')}
          </p>
        )}
      </div>

      {/* Email */}
      <div className={sectionCls}>
        <label className={labelCls}>Delivery Email</label>
        <input type="email" value={prefs.email} onChange={e => set('email', e.target.value)}
          placeholder="your@email.com" className={inputCls} />
      </div>

      {/* Schedule */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Clock size={14} className="text-primary-400" /> Delivery Schedule</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Day</label>
            <select value={prefs.deliveryDay} onChange={e => set('deliveryDay', Number(e.target.value) as DigestPreferences['deliveryDay'])} className={inputCls}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <select value={prefs.deliveryHour} onChange={e => set('deliveryHour', Number(e.target.value))} className={inputCls}>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><BookOpen size={14} className="text-primary-400" /> Content Sections</p>
        {([
          { key: 'includeAIInsights', label: 'AI Insights & Tips',  desc: 'Gemini study advice',   icon: <Sparkles size={13} className="text-purple-400" /> },
          { key: 'includeUpcoming',   label: 'Upcoming Events',     desc: 'Your weekly schedule', icon: <Calendar size={13} className="text-blue-400" /> },
          { key: 'includeProgress',   label: 'Progress Summary',    desc: 'Completion & streak',  icon: <CheckCircle2 size={13} className="text-emerald-400" /> },
        ] as const).map(opt => (
          <div key={opt.key} className="flex items-center justify-between py-3 border-b border-background-700 last:border-0">
            <div className="flex items-center gap-2.5">
              {opt.icon}
              <div>
                <p className="text-sm text-white">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
            </div>
            <Toggle value={prefs[opt.key] as boolean} onChange={v => set(opt.key, v)} />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
          {saving ? <Loader size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : null}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button onClick={handlePreview} disabled={previewLoading}
          className="flex items-center gap-2 bg-background-700 hover:bg-background-600 text-gray-300 hover:text-white px-5 py-2.5 rounded-xl text-sm font-medium border border-background-600 transition-all disabled:opacity-50">
          {previewLoading ? <Loader size={13} className="animate-spin" /> : <Eye size={13} />}
          {previewLoading ? 'Building…' : 'Preview'}
        </button>
        <button onClick={handleSendNow} disabled={sending || !prefs.email}
          className="flex items-center gap-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
          {sending ? <Loader size={13} className="animate-spin" /> : <Send size={13} />}
          {sending ? 'Sending…' : 'Send Now'}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className={sectionCls}>
          <p className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><RefreshCw size={13} className="text-gray-400" /> Recent Digests</p>
          <div className="space-y-1">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-background-700 last:border-0">
                <div>
                  <p className="text-sm text-white">{format(h.sentAt, 'MMM d, yyyy')}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{h.emailPreview.slice(0, 70)}…</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${h.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-400'}`}>
                  {h.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <Eye size={15} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">Email Preview</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles size={9} /> AI Generated
                </span>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={15} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe srcDoc={previewHtml} title="Email Preview" className="w-full h-full min-h-[560px] border-0" sandbox="allow-same-origin" />
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">How your digest looks in email clients.</p>
              <button onClick={() => setShowPreview(false)} className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigestSettings;
