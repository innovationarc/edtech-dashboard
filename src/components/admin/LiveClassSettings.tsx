// src/components/admin/LiveClassSettings.tsx
import React, { useState, useEffect } from 'react';
import {
  Video, Server, Key, Plus, Trash2, Save, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Loader,
  Eye, EyeOff, RotateCcw,
} from 'lucide-react';
import { liveClassSettingsService } from '../../services/liveClassService';
import { LiveClassSettings as ISettings, HMSKey, JitsiKey } from '../../types/liveClassTypes';
import { useDashboard } from '../../contexts/DashboardContext';
import { Timestamp } from 'firebase/firestore';

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const MinutesBar: React.FC<{ used: number; limit: number }> = ({ used, limit }) => {
  const pct = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const color =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">
          {used.toLocaleString()} / {limit.toLocaleString()} mins
        </span>
        <span
          className={pct >= 90 ? 'text-red-400 font-semibold' : 'text-gray-400'}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ─── HMS Key Row ──────────────────────────────────────────────────────────────

interface HMSKeyRowProps {
  keyData: HMSKey;
  isActive: boolean;
  onUpdate: (updated: HMSKey) => void;
  onDelete: () => void;
  onSetActive: () => void;
  onResetCounter: () => void;
}

const HMSKeyRow: React.FC<HMSKeyRowProps> = ({
  keyData, isActive, onUpdate, onDelete, onSetActive, onResetCounter,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const pct = (keyData.minutesUsed / Math.max(keyData.minutesLimit, 1)) * 100;

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        isActive ? 'border-primary-500 bg-primary-900/10' : 'border-gray-700 bg-gray-800/50'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => setExpanded(!expanded)} className="flex-1 flex items-center gap-3 text-left">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white text-sm">{keyData.label}</span>
              {isActive && (
                <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Active</span>
              )}
              {!keyData.isActive && (
                <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">Disabled</span>
              )}
              {pct >= 90 && (
                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle size={10} /> Near Limit
                </span>
              )}
            </div>
            <MinutesBar used={keyData.minutesUsed} limit={keyData.minutesLimit} />
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
        </button>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Label</label>
              <input
                value={keyData.label}
                onChange={(e) => onUpdate({ ...keyData, label: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Minutes Limit</label>
              <input
                type="number"
                value={keyData.minutesLimit}
                onChange={(e) => onUpdate({ ...keyData, minutesLimit: parseInt(e.target.value) || 10000 })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">App Key</label>
              <input
                value={keyData.appKey}
                onChange={(e) => onUpdate({ ...keyData, appKey: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
                placeholder="100ms App Key"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">App Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={keyData.appSecret}
                  onChange={(e) => onUpdate({ ...keyData, appSecret: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-10 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
                  placeholder="100ms App Secret"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Template ID</label>
              <input
                value={keyData.templateId}
                onChange={(e) => onUpdate({ ...keyData, templateId: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
                placeholder="100ms Template ID"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onUpdate({ ...keyData, isActive: !keyData.isActive })}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                keyData.isActive
                  ? 'bg-gray-600 hover:bg-gray-500 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {keyData.isActive ? 'Disable' : 'Enable'}
            </button>
            {!isActive && keyData.isActive && (
              <button
                onClick={onSetActive}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
              >
                <CheckCircle size={12} /> Set Active
              </button>
            )}
            <button
              onClick={onResetCounter}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 transition-colors"
            >
              <RotateCcw size={12} /> Reset Counter
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 ml-auto transition-colors"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Jitsi Server Row ─────────────────────────────────────────────────────────

interface JitsiRowProps {
  keyData: JitsiKey;
  isActive: boolean;
  onUpdate: (updated: JitsiKey) => void;
  onDelete: () => void;
  onSetActive: () => void;
}

const JitsiRow: React.FC<JitsiRowProps> = ({
  keyData, isActive, onUpdate, onDelete, onSetActive,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-xl overflow-hidden ${
        isActive ? 'border-primary-500 bg-primary-900/10' : 'border-gray-700 bg-gray-800/50'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => setExpanded(!expanded)} className="flex-1 flex items-center gap-3 text-left">
          <Server size={16} className="text-gray-400 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white text-sm">{keyData.label}</span>
              {isActive && <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Active</span>}
              {!keyData.isActive && <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">Disabled</span>}
            </div>
            <span className="text-xs text-gray-400">{keyData.domain}</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Label</label>
              <input
                value={keyData.label}
                onChange={(e) => onUpdate({ ...keyData, label: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Domain</label>
              <input
                value={keyData.domain}
                onChange={(e) => onUpdate({ ...keyData, domain: e.target.value })}
                placeholder="meet.yourserver.com"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Room Prefix</label>
              <input
                value={keyData.roomPrefix}
                onChange={(e) => onUpdate({ ...keyData, roomPrefix: e.target.value })}
                placeholder="myplatform-"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onUpdate({ ...keyData, isActive: !keyData.isActive })}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${keyData.isActive ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
            >
              {keyData.isActive ? 'Disable' : 'Enable'}
            </button>
            {!isActive && keyData.isActive && (
              <button onClick={onSetActive} className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white">
                Set Active
              </button>
            )}
            <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 ml-auto">
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LiveClassSettings: React.FC = () => {
  const { user } = useDashboard();
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    liveClassSettingsService.get().then((s) => {
      setSettings(
        s ?? {
          provider: 'jitsi',
          jitsiKeys: [
            { id: 'jitsi_1', label: 'Public Server', domain: 'meet.jit.si', roomPrefix: '', isActive: true, usageCount: 0 },
          ],
          activeJitsiKeyId: 'jitsi_1',
          hmsKeys: [],
          activeHmsKeyId: '',
          hmsRotationMode: 'manual',
          bunny: { libraryId: '', apiKey: '', cdnUrl: '' },
        }
      );
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settings || !user) return;
    setSaving(true);
    try {
      await liveClassSettingsService.save(settings, user.uid);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      (window as any).addNotification?.('Live class settings saved successfully!', 'success');
    } catch {
      (window as any).addNotification?.('Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addHMSKey = () => {
    if (!settings) return;
    const id = `hms_${Date.now()}`;
    setSettings({
      ...settings,
      hmsKeys: [
        ...settings.hmsKeys,
        { id, label: `Account ${settings.hmsKeys.length + 1}`, appKey: '', appSecret: '', templateId: '', isActive: true, minutesUsed: 0, minutesLimit: 10000 },
      ],
    });
  };

  const addJitsiKey = () => {
    if (!settings) return;
    const id = `jitsi_${Date.now()}`;
    setSettings({
      ...settings,
      jitsiKeys: [
        ...settings.jitsiKeys,
        { id, label: `Server ${settings.jitsiKeys.length + 1}`, domain: 'meet.jit.si', roomPrefix: '', isActive: true, usageCount: 0 },
      ],
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video size={24} className="text-primary-400" />
            Live Class Settings
          </h2>
          <p className="text-gray-400 mt-1 text-sm">Configure video providers, API keys, and recording.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          {saving ? <Loader size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Provider Selector */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-white">Active Provider</h3>
        <div className="grid grid-cols-2 gap-3">
          {(['jitsi', '100ms'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSettings({ ...settings, provider: p })}
              className={`p-4 rounded-xl border-2 transition-all ${
                settings.provider === p
                  ? 'border-primary-500 bg-primary-900/20'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-800'
              }`}
            >
              <p className="font-semibold text-white capitalize">{p === '100ms' ? '100ms (HMS)' : 'Jitsi Meet'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {p === '100ms' ? 'Managed SaaS · 10k free mins/account' : 'Open source WebRTC · Free or self-hosted'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 100ms Keys */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Key size={16} className="text-yellow-400" /> 100ms Accounts
          </h3>
          <button onClick={addHMSKey} className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300">
            <Plus size={14} /> Add Account
          </button>
        </div>

        {/* Rotation mode */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Rotation:</span>
          {(['manual', 'auto'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSettings({ ...settings, hmsRotationMode: m })}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                settings.hmsRotationMode === m ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {m === 'auto' ? 'Auto (swap at limit)' : 'Manual'}
            </button>
          ))}
        </div>

        {settings.hmsKeys.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-600 rounded-xl">
            No 100ms accounts added yet. Click "Add Account" to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {settings.hmsKeys.map((key, i) => (
              <HMSKeyRow
                key={key.id}
                keyData={key}
                isActive={settings.activeHmsKeyId === key.id}
                onUpdate={(updated) => {
                  const next = [...settings.hmsKeys];
                  next[i] = updated;
                  setSettings({ ...settings, hmsKeys: next });
                }}
                onDelete={() => {
                  const next = settings.hmsKeys.filter((_, j) => j !== i);
                  setSettings({ ...settings, hmsKeys: next });
                }}
                onSetActive={() => setSettings({ ...settings, activeHmsKeyId: key.id })}
                onResetCounter={() => {
                  const next = [...settings.hmsKeys];
                  next[i] = { ...key, minutesUsed: 0, resetAt: Timestamp.now() };
                  setSettings({ ...settings, hmsKeys: next });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Jitsi Servers */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Server size={16} className="text-blue-400" /> Jitsi Servers
          </h3>
          <button onClick={addJitsiKey} className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300">
            <Plus size={14} /> Add Server
          </button>
        </div>
        <div className="space-y-2">
          {settings.jitsiKeys.map((key, i) => (
            <JitsiRow
              key={key.id}
              keyData={key}
              isActive={settings.activeJitsiKeyId === key.id}
              onUpdate={(updated) => {
                const next = [...settings.jitsiKeys];
                next[i] = updated;
                setSettings({ ...settings, jitsiKeys: next });
              }}
              onDelete={() => {
                const next = settings.jitsiKeys.filter((_, j) => j !== i);
                setSettings({ ...settings, jitsiKeys: next });
              }}
              onSetActive={() => setSettings({ ...settings, activeJitsiKeyId: key.id })}
            />
          ))}
        </div>
      </div>

      {/* Bunny.net */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white">🐰 Bunny.net Recording Storage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Stream Library ID</label>
            <input
              value={settings.bunny.libraryId}
              onChange={(e) => setSettings({ ...settings, bunny: { ...settings.bunny, libraryId: e.target.value } })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
              placeholder="123456"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              value={settings.bunny.apiKey}
              onChange={(e) => setSettings({ ...settings, bunny: { ...settings.bunny, apiKey: e.target.value } })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
              placeholder="••••••••••••"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">CDN URL Template</label>
            <input
              value={settings.bunny.cdnUrl}
              onChange={(e) => setSettings({ ...settings, bunny: { ...settings.bunny, cdnUrl: e.target.value } })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary-500"
              placeholder="https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}"
            />
          </div>
        </div>
      </div>

      {/* Save Button (bottom) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl transition-colors font-medium"
        >
          {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
};

export default LiveClassSettings;
