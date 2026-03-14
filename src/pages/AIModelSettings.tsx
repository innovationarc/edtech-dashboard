// src/pages/AIModelSettings.tsx
// Admin Panel — AI Model Settings v2
// Tab 1: Key Groups  — create/manage groups of API keys with rate limits & failover
// Tab 2: Feature Assignments — assign groups to platform AI features
// Tab 3: Legacy Config — single-provider config (v1, backwards compat)
// Tab 4: Error Logs — real-time failover error history


import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Key, Check, Loader, AlertTriangle, ExternalLink,
  Eye, EyeOff, Zap, RefreshCw, Shield, Info,
  CheckCircle2, XCircle, Settings, Plus, Trash2,
  ChevronDown, ChevronUp, Copy, AlertCircle, Layers,
  BarChart2, ListChecks, X, RotateCcw, Pencil,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import {
  aiModelConfigService,
  aiKeyGroupService,
  callWithFailover,
  AI_PROVIDERS,
  AI_FEATURE_LABELS,
  TIER_ORDER,
  AIModelConfig,
  APIKeyEntry,
  APIKeyGroup,
  FeatureAssignment,
  KeyGroupsConfig,
  AIErrorLog,
  AIFeatureId,
  ProviderKey,
  ModelTier,
} from '../services/aiModelConfigService';

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-background-800 text-white rounded-lg py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-background-700 focus:border-primary-500 transition-colors text-sm placeholder-gray-500';

const inputSmCls =
  'bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary-500 border border-background-700 focus:border-primary-500 transition-colors text-xs placeholder-gray-500';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function providerColor(p: ProviderKey) {
  const map: Record<ProviderKey, string> = {
    gemini: 'text-blue-400', groq: 'text-orange-400',
    openai: 'text-green-400', anthropic: 'text-purple-400', deepseek: 'text-cyan-400',
  };
  return map[p] || 'text-gray-400';
}

const TIER_COLOR: Record<ModelTier, string> = {
  nano: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  mid:  'bg-blue-500/15 text-blue-300 border-blue-500/20',
  high: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
};
const TIER_LABEL: Record<ModelTier, string> = { nano: '⚡ Nano', mid: '🧠 Mid', high: '🚀 High' };

/** Returns a warning string if the best active key in a group is under-spec for a feature, or null if all good. */
function getGroupTierWarning(
  groupId: string,
  featureId: AIFeatureId,
  groups: APIKeyGroup[]
): string | null {
  const group = groups.find(g => g.id === groupId);
  if (!group) return null;
  const featureMeta = AI_FEATURE_LABELS[featureId];
  const required    = TIER_ORDER[featureMeta.minModelTier];

  const activeKeys = group.keys.filter(k => !k.isDisabled);
  if (activeKeys.length === 0) return 'No active keys in this group.';

  const allModelTiers = activeKeys.map(k => {
    const m = AI_PROVIDERS.flatMap(p => p.models).find(m => m.id === k.model);
    return TIER_ORDER[m?.tier ?? 'mid'];
  });

  const bestTier = Math.max(...allModelTiers);
  if (bestTier < required) {
    const tierName = featureMeta.minModelTier;
    return `All keys are below the required "${tierName}" tier for this feature — output quality may suffer.`;
  }

  const hasGoodTier = allModelTiers.some(t => t >= required);
  const overSpecOnly = hasGoodTier && allModelTiers.every(t => t > required);
  if (overSpecOnly) {
    return `All keys exceed the required tier — consider adding a lighter model to conserve costs.`;
  }

  if (featureMeta.preferNoDailyLimit) {
    const hasNoDailyLimit = activeKeys.some(k => {
      const m = AI_PROVIDERS.flatMap(p => p.models).find(m => m.id === k.model);
      return m?.noDailyLimit;
    });
    if (!hasNoDailyLimit) {
      return `This feature is high-volume. Consider adding a Groq compound-beta key (no daily limit) to this group.`;
    }
  }

  return null;
}

const BLANK_KEY = (): APIKeyEntry => ({
  id: genId(), label: '', provider: 'gemini', model: 'gemini-2.0-flash',
  apiKey: '', priority: 5, rpm: 0, rpd: 0, tpm: 0, tpd: 0,
  errorCount: 0, isDisabled: false,
});

// ─── Key Editor Modal ─────────────────────────────────────────────────────────

interface KeyEditorProps {
  entry: APIKeyEntry;
  onSave: (e: APIKeyEntry) => void;
  onClose: () => void;
}

const KeyEditorModal: React.FC<KeyEditorProps> = ({ entry, onSave, onClose }) => {
  const [form, setForm] = useState<APIKeyEntry>({ ...entry });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [testError, setTestError] = useState('');

  const set = (k: keyof APIKeyEntry, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleProviderChange = (p: ProviderKey) => {
    const pInfo = AI_PROVIDERS.find(x => x.key === p)!;
    const rec   = pInfo.models.find(m => m.recommended) ?? pInfo.models[0];
    setForm(f => ({ ...f, provider: p, model: rec.id }));
  };

  const handleTest = async () => {
    if (!form.apiKey.trim()) { setTestResult('fail'); setTestError('Enter an API key first.'); return; }
    setTesting(true); setTestResult(null); setTestError('');
    try {
      const err = await aiModelConfigService.testConfig({ provider: form.provider, model: form.model, apiKey: form.apiKey });
      if (err) { setTestResult('fail'); setTestError(err); } else { setTestResult('ok'); }
    } catch (e: any) {
      setTestResult('fail'); setTestError(e?.message || 'Connection failed');
    } finally { setTesting(false); }
  };

  const models = AI_PROVIDERS.find(p => p.key === form.provider)?.models || [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-700">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Key size={14} className="text-primary-400" />
            {entry.label ? `Edit: ${entry.label}` : 'Add API Key'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Label <span className="text-red-400">*</span></label>
            <input value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="e.g. Groq Primary, Gemini Backup…" className={inputCls} />
          </div>

          {/* Provider */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Provider</label>
            <div className="grid grid-cols-5 gap-2">
              {AI_PROVIDERS.map(p => (
                <button key={p.key} onClick={() => handleProviderChange(p.key)}
                  className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all text-center ${
                    form.provider === p.key
                      ? 'border-primary-500 bg-primary-500/10 text-white'
                      : 'border-background-700 bg-background-800 text-gray-400 hover:border-background-600'
                  }`}>
                  {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Model</label>
            <select value={form.model} onChange={e => set('model', e.target.value)}
              className={inputCls + ' cursor-pointer'}>
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label}{m.recommended ? ' ★' : ''} [{m.tier.toUpperCase()}] {m.noDailyLimit ? '(∞)' : ''}{m.notes ? ` — ${m.notes}` : ''}
                </option>
              ))}
            </select>
            {/* Show tier badge for selected model */}
            {(() => {
              const sel = models.find(m => m.id === form.model);
              if (!sel) return null;
              return (
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_COLOR[sel.tier]}`}>{TIER_LABEL[sel.tier]}</span>
                  <span className="text-xs text-gray-500">Cost weight: {sel.costWeight}/10</span>
                  {sel.noDailyLimit && <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">∞ No daily limit</span>}
                </div>
              );
            })()}
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400">API Key <span className="text-red-400">*</span></label>
              <a href={AI_PROVIDERS.find(p => p.key === form.provider)?.docsUrl}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                Get key <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={form.apiKey}
                onChange={e => set('apiKey', e.target.value)}
                placeholder="Paste your API key…" className={inputCls + ' pr-10'} autoComplete="off" />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-lg border p-3 flex items-start gap-2 text-xs ${
              testResult === 'ok' ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-300'
                                  : 'border-red-500/30 bg-red-500/8 text-red-300'}`}>
              {testResult === 'ok' ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />
                                   : <XCircle size={13} className="mt-0.5 flex-shrink-0" />}
              <span>{testResult === 'ok' ? 'Connection successful' : testError || 'Connection failed'}</span>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Priority (1 = highest, tried first)</label>
            <input type="number" min={1} max={99} value={form.priority}
              onChange={e => set('priority', parseInt(e.target.value) || 1)} className={inputCls} />
          </div>

          {/* Rate limits */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Rate Limits <span className="text-gray-600">(0 = unlimited)</span></label>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['rpm', 'Requests / Minute'],
                ['rpd', 'Requests / Day'],
                ['tpm', 'Tokens / Minute'],
                ['tpd', 'Tokens / Day'],
              ] as [keyof APIKeyEntry, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input type="number" min={0} value={form[field] as number}
                    onChange={e => set(field, parseInt(e.target.value) || 0)}
                    placeholder="0" className={inputCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Disabled toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => set('isDisabled', !form.isDisabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${form.isDisabled ? 'bg-red-500/60' : 'bg-emerald-500/60'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${form.isDisabled ? 'translate-x-0.5' : 'translate-x-4'}`} />
            </div>
            <span className="text-xs text-gray-300">{form.isDisabled ? 'Key disabled (skipped in failover)' : 'Key enabled'}</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-background-700 justify-end">
          <button onClick={handleTest} disabled={testing || !form.apiKey.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-background-800 border border-background-700 text-white rounded-lg text-xs font-medium hover:bg-background-700 transition-colors disabled:opacity-50">
            {testing ? <Loader size={12} className="animate-spin" /> : <Zap size={12} />}
            Test
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-background-800 border border-background-700 text-white rounded-lg text-xs font-medium hover:bg-background-700 transition-colors">
            Cancel
          </button>
          <button onClick={() => { if (!form.label.trim() || !form.apiKey.trim()) return; onSave(form); }}
            disabled={!form.label.trim() || !form.apiKey.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-primary-700 hover:to-purple-700 transition-all disabled:opacity-50">
            <Check size={12} /> Save Key
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'groups' | 'assignments' | 'legacy' | 'logs';

const AIModelSettings: React.FC = () => {
  const { user } = useDashboard();

  const [activeTab, setActiveTab] = useState<Tab>('groups');

  // ── Groups state ─────────────────────────────────────────────────────────────
  const [groupsConfig, setGroupsConfig] = useState<KeyGroupsConfig>({ groups: [], assignments: [], updatedAt: '' });
  const [savingGroups, setSavingGroups] = useState(false);
  const [groupsSaved, setGroupsSaved]   = useState(false);

  // New group form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Key editor
  const [editingKey, setEditingKey]   = useState<{ groupId: string; key: APIKeyEntry } | null>(null);

  // Group name/description inline editor
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; description: string } | null>(null);

  // ── Feature assignments state ─────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<FeatureAssignment[]>([]);

  // ── Legacy config state ───────────────────────────────────────────────────────
  const [legacyLoading, setLegacyLoading]     = useState(true);
  const [legacySaving, setLegacySaving]       = useState(false);
  const [legacyTesting, setLegacyTesting]     = useState(false);
  const [legacySaved, setLegacySaved]         = useState(false);
  const [legacyProvider, setLegacyProvider]   = useState<ProviderKey>('gemini');
  const [legacyModel, setLegacyModel]         = useState('gemini-2.0-flash');
  const [legacyApiKey, setLegacyApiKey]       = useState('');
  const [legacyShowKey, setLegacyShowKey]     = useState(false);
  const [legacyTestStatus, setLegacyTestStatus] = useState<'untested' | 'passed' | 'failed'>('untested');
  const [legacyTestError, setLegacyTestError] = useState('');
  const [legacyLastSaved, setLegacyLastSaved] = useState<string | null>(null);

  // ── Error logs state ──────────────────────────────────────────────────────────
  const [logs, setLogs]               = useState<AIErrorLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // ── Load on mount ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [gc, legacy] = await Promise.all([
          aiKeyGroupService.getConfig(),
          aiModelConfigService.getConfig(),
        ]);
        setGroupsConfig(gc);
        setAssignments(gc.assignments || []);
        setLegacyProvider(legacy.provider || 'gemini');
        setLegacyModel(legacy.model || 'gemini-2.0-flash');
        setLegacyApiKey(legacy.apiKey || '');
        setLegacyTestStatus((legacy.testStatus as any) || 'untested');
        setLegacyTestError(legacy.testError || '');
        if (legacy.updatedAt) setLegacyLastSaved(new Date(legacy.updatedAt).toLocaleString());
      } catch { /* use defaults */ }
      setLegacyLoading(false);
    })();
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try { setLogs(await aiKeyGroupService.getErrorLogs()); } catch { /* */ }
    setLogsLoading(false);
  }, []);

  useEffect(() => { if (activeTab === 'logs') loadLogs(); }, [activeTab, loadLogs]);

  // ── Groups CRUD ───────────────────────────────────────────────────────────────

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const g: APIKeyGroup = {
      id: genId(), name: newGroupName.trim(), description: newGroupDesc.trim(),
      keys: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const updated: KeyGroupsConfig = { ...groupsConfig, groups: [...groupsConfig.groups, g] };
    setGroupsConfig(updated);
    setExpandedGroups(s => new Set([...s, g.id]));
    setNewGroupName(''); setNewGroupDesc('');
  };

  const deleteGroup = (groupId: string) => {
    if (!confirm('Delete this group and all its keys?')) return;
    setGroupsConfig(c => ({
      ...c,
      groups: c.groups.filter(g => g.id !== groupId),
      assignments: c.assignments.filter(a => a.groupId !== groupId),
    }));
    setAssignments(a => a.filter(x => x.groupId !== groupId));
  };

  const updateGroup = async (id: string, name: string, description: string) => {
    if (!user?.uid || !name.trim()) return;
    const updatedConfig: KeyGroupsConfig = {
      ...groupsConfig,
      assignments,
      groups: groupsConfig.groups.map(g =>
        g.id !== id ? g : { ...g, name: name.trim(), description: description.trim(), updatedAt: new Date().toISOString() }
      ),
    };
    setGroupsConfig(updatedConfig);
    setEditingGroup(null);
    try {
      await aiKeyGroupService.saveConfig(updatedConfig, user.uid);
      aiKeyGroupService.bustCache();
    } catch (e: any) {
      alert('Failed to save group name: ' + (e?.message || 'unknown error'));
    }
  };

  const saveKey = (groupId: string, key: APIKeyEntry) => {
    setGroupsConfig(c => ({
      ...c,
      groups: c.groups.map(g =>
        g.id !== groupId ? g : {
          ...g,
          keys: g.keys.some(k => k.id === key.id)
            ? g.keys.map(k => k.id === key.id ? key : k)
            : [...g.keys, key],
          updatedAt: new Date().toISOString(),
        }
      ),
    }));
    setEditingKey(null);
  };

  const deleteKey = (groupId: string, keyId: string) => {
    setGroupsConfig(c => ({
      ...c,
      groups: c.groups.map(g =>
        g.id !== groupId ? g : { ...g, keys: g.keys.filter(k => k.id !== keyId) }
      ),
    }));
  };

  const saveGroupsConfig = async () => {
    if (!user?.uid) return;
    setSavingGroups(true);
    try {
      const merged: KeyGroupsConfig = { ...groupsConfig, assignments };
      await aiKeyGroupService.saveConfig(merged, user.uid);
      aiKeyGroupService.bustCache();
      setGroupsSaved(true);
      setTimeout(() => setGroupsSaved(false), 3000);
    } catch (e: any) { alert('Failed to save: ' + (e?.message || 'unknown error')); }
    setSavingGroups(false);
  };

  // ── Legacy handlers ───────────────────────────────────────────────────────────

  const handleLegacyProviderChange = (p: ProviderKey) => {
    setLegacyProvider(p);
    const meta = AI_PROVIDERS.find(x => x.key === p)!;
    const rec  = meta.models.find(m => m.recommended) ?? meta.models[0];
    setLegacyModel(rec.id);
    setLegacyTestStatus('untested'); setLegacyTestError('');
  };

  const handleLegacyTest = async () => {
    if (!legacyApiKey.trim()) { setLegacyTestStatus('failed'); setLegacyTestError('Enter an API key first.'); return; }
    setLegacyTesting(true); setLegacyTestStatus('untested'); setLegacyTestError('');
    try {
      const err = await aiModelConfigService.testConfig({ provider: legacyProvider, model: legacyModel, apiKey: legacyApiKey });
      if (err) { setLegacyTestStatus('failed'); setLegacyTestError(err); } else { setLegacyTestStatus('passed'); }
    } catch (e: any) { setLegacyTestStatus('failed'); setLegacyTestError(e?.message || 'Connection failed'); }
    setLegacyTesting(false);
  };

  const handleLegacySave = async () => {
    if (!user?.uid) return;
    setLegacySaving(true); setLegacySaved(false);
    try {
      const cfg: AIModelConfig = { provider: legacyProvider, model: legacyModel, apiKey: legacyApiKey, testStatus: legacyTestStatus as any, testError: legacyTestError };
      await aiModelConfigService.saveConfig(cfg, user.uid);
      aiModelConfigService.bustCache();
      setLegacySaved(true); setLegacyLastSaved(new Date().toLocaleString());
      setTimeout(() => setLegacySaved(false), 3000);
    } catch (e: any) { alert('Failed to save: ' + (e?.message || 'unknown error')); }
    setLegacySaving(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'groups',      label: 'Key Groups',          icon: <Layers size={14} /> },
    { id: 'assignments', label: 'Feature Assignments', icon: <ListChecks size={14} /> },
    { id: 'legacy',      label: 'Legacy Config',       icon: <Settings size={14} /> },
    { id: 'logs',        label: 'Error Logs',          icon: <AlertCircle size={14} /> },
  ];

  const currentLegacyProvider = AI_PROVIDERS.find(p => p.key === legacyProvider)!;

  return (
    <div className="max-w-4xl mx-auto space-y-5 py-6 px-4">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-600 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Brain size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Model Settings</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Manage API key groups with automatic failover, rate limits, and feature-level model assignments.
          </p>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <Shield size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/80 leading-relaxed">
          API keys are stored in Firestore with admin-only access rules and called client-side.
          Never share your admin credentials. Use the Legacy Config tab as a fallback if no groups are assigned.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-background-900 border border-background-700 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === t.id
                ? 'bg-primary-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-background-800'
            }`}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Key Groups ──────────────────────────────────────────────────── */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Create group */}
          <div className="rounded-xl border border-background-700 bg-background-900 p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Plus size={14} className="text-primary-400" /> New Group
            </h2>
            <div className="flex gap-3">
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="Group name (e.g. Study Planner Pool, Chatbot Keys…)"
                className={inputCls + ' flex-1'} onKeyDown={e => e.key === 'Enter' && addGroup()} />
              <input value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)}
                placeholder="Description (optional)" className={inputCls + ' flex-1 hidden md:block'} />
              <button onClick={addGroup} disabled={!newGroupName.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* Groups list */}
          {groupsConfig.groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-background-600 bg-background-900/50 p-10 text-center">
              <Layers size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No key groups yet.</p>
              <p className="text-gray-600 text-xs mt-1">Create a group above and add your API keys to it.</p>
            </div>
          ) : groupsConfig.groups.map(group => {
            const isExpanded = expandedGroups.has(group.id);
            return (
              <div key={group.id} className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
                {/* Group header */}
                {editingGroup?.id === group.id ? (
                  /* ── Inline edit form ── */
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-background-700 bg-background-800/50"
                    onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editingGroup.name}
                      onChange={e => setEditingGroup(g => g ? { ...g, name: e.target.value } : g)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateGroup(editingGroup.id, editingGroup.name, editingGroup.description);
                        if (e.key === 'Escape') setEditingGroup(null);
                      }}
                      placeholder="Group name"
                      className={inputSmCls + ' flex-1 min-w-0'}
                    />
                    <input
                      value={editingGroup.description}
                      onChange={e => setEditingGroup(g => g ? { ...g, description: e.target.value } : g)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateGroup(editingGroup.id, editingGroup.name, editingGroup.description);
                        if (e.key === 'Escape') setEditingGroup(null);
                      }}
                      placeholder="Description (optional)"
                      className={inputSmCls + ' flex-1 min-w-0 hidden md:block'}
                    />
                    <button
                      onClick={() => updateGroup(editingGroup.id, editingGroup.name, editingGroup.description)}
                      disabled={!editingGroup.name.trim()}
                      className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-40">
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingGroup(null)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-background-700 rounded-lg transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-background-800/50 transition-colors"
                  onClick={() => setExpandedGroups(s => { const n = new Set(s); n.has(group.id) ? n.delete(group.id) : n.add(group.id); return n; })}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{group.name}</span>
                      <span className="text-xs bg-background-700 text-gray-400 px-2 py-0.5 rounded-full">
                        {group.keys.length} key{group.keys.length !== 1 ? 's' : ''}
                      </span>
                      {group.keys.filter(k => !k.isDisabled).length === 0 && group.keys.length > 0 && (
                        <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">All disabled</span>
                      )}
                    </div>
                    {group.description && <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); setEditingGroup({ id: group.id, name: group.name, description: group.description || '' }); }}
                      className="p-1.5 text-gray-600 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteGroup(group.id); }}
                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                </div>
                )}

                {/* Keys */}
                {isExpanded && (
                  <div className="border-t border-background-700 p-4 space-y-2">
                    {group.keys.length === 0 && (
                      <p className="text-xs text-gray-600 text-center py-2">No keys yet — add one below.</p>
                    )}
                    {group.keys.map(k => {
                      const modelMeta = AI_PROVIDERS.flatMap(p => p.models).find(m => m.id === k.model);
                      return (
                      <div key={k.id} className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        k.isDisabled ? 'border-background-700 bg-background-800/30 opacity-60' : 'border-background-700 bg-background-800'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-white">{k.label}</span>
                            <span className={`text-xs font-mono ${providerColor(k.provider)}`}>{k.provider}</span>
                            <span className="text-xs text-gray-600 truncate">{k.model}</span>
                            {/* Tier badge */}
                            {modelMeta && (
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${TIER_COLOR[modelMeta.tier]}`}>
                                {TIER_LABEL[modelMeta.tier]}
                              </span>
                            )}
                            {/* No daily limit badge */}
                            {modelMeta?.noDailyLimit && (
                              <span className="text-xs px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">∞ no daily limit</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                            <span>Priority: {k.priority}</span>
                            {modelMeta && <span>Cost: {modelMeta.costWeight}/10</span>}
                            {k.rpm > 0 && <span>{k.rpm} rpm</span>}
                            {k.rpd > 0 && <span>{k.rpd} rpd</span>}
                            {k.tpd > 0 && <span>{(k.tpd/1000).toFixed(0)}k tpd</span>}
                            {k.errorCount > 0 && (
                              <span className="text-amber-500">{k.errorCount} error{k.errorCount !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEditingKey({ groupId: group.id, key: k })}
                            className="p-1.5 text-gray-500 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors text-xs">
                            Edit
                          </button>
                          <button onClick={() => deleteKey(group.id, k.id)}
                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      );
                    })}

                    <button
                      onClick={() => setEditingKey({ groupId: group.id, key: { ...BLANK_KEY(), priority: group.keys.length + 1 } })}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-background-600 text-gray-500 hover:text-primary-400 hover:border-primary-500/40 transition-colors text-xs">
                      <Plus size={12} /> Add Key to Group
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Save button */}
          {groupsConfig.groups.length > 0 && (
            <div className="flex justify-end">
              <button onClick={saveGroupsConfig} disabled={savingGroups}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-lg text-sm font-semibold transition-all shadow-lg disabled:opacity-50">
                {savingGroups ? <><Loader size={14} className="animate-spin" /> Saving…</>
                  : groupsSaved ? <><Check size={14} /> Saved!</>
                  : <><Check size={14} /> Save Groups</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Feature Assignments ─────────────────────────────────────── */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">

          {/* How the intelligence works */}
          <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4 space-y-2">
            <p className="text-xs font-semibold text-primary-300 flex items-center gap-2">
              <Brain size={13} /> How smart routing works
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Each feature has a required model tier. When a request fires, the system scores every key in the
              group and picks the best fit — considering tier match, daily-limit preference, current usage, cost,
              and error history. A <span className="text-emerald-400 font-medium">perfect-tier</span> key always
              beats an over-spec one, which beats an under-spec one. Within the same tier, cheaper and more
              available keys win. Warnings below alert you when a group can't properly serve a feature.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              {(['nano', 'mid', 'high'] as ModelTier[]).map(t => (
                <span key={t} className={`px-2 py-0.5 rounded-full border ${TIER_COLOR[t]}`}>{TIER_LABEL[t]}</span>
              ))}
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">Tier badge = what the feature needs minimum</span>
            </div>
          </div>

          <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-background-700">
              <h2 className="text-sm font-semibold text-white">Feature → Key Group Assignments</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Unassigned features fall back to Legacy Config.
              </p>
            </div>
            <div className="p-5 space-y-3">
              {(Object.entries(AI_FEATURE_LABELS) as [AIFeatureId, typeof AI_FEATURE_LABELS[AIFeatureId]][]).map(([fid, meta]) => {
                const assignedGroupId = assignments.find(a => a.featureId === fid)?.groupId || '';
                const warning = assignedGroupId
                  ? getGroupTierWarning(assignedGroupId, fid, groupsConfig.groups)
                  : null;

                return (
                  <div key={fid} className={`rounded-xl border p-4 transition-colors ${
                    warning ? 'border-amber-500/30 bg-amber-500/5' : 'border-background-700 bg-background-800'
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{meta.label}</span>
                          {/* Min model tier badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_COLOR[meta.minModelTier]}`}>
                            {TIER_LABEL[meta.minModelTier]}
                          </span>
                          {/* High-volume badge */}
                          {meta.preferNoDailyLimit && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-300 border-orange-500/20">
                              🔥 High-volume
                            </span>
                          )}
                          {/* Token cost badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            meta.tokenCost === 'high'   ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            meta.tokenCost === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            {meta.tokenCost === 'high' ? '💸 High tokens' : meta.tokenCost === 'medium' ? '🪙 Mid tokens' : '✅ Low tokens'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{meta.description}</p>

                        {/* Smart warning */}
                        {warning && (
                          <p className="text-xs text-amber-400 mt-2 flex items-start gap-1.5">
                            <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                            {warning}
                          </p>
                        )}

                        {/* Smart confirmation — show which key will be used first */}
                        {assignedGroupId && !warning && (() => {
                          const group = groupsConfig.groups.find(g => g.id === assignedGroupId);
                          if (!group) return null;
                          const best = [...group.keys]
                            .filter(k => !k.isDisabled)
                            .map(k => {
                              const m = AI_PROVIDERS.flatMap(p => p.models).find(m => m.id === k.model);
                              const tierMatch = TIER_ORDER[m?.tier ?? 'mid'] === TIER_ORDER[meta.minModelTier] ? 'perfect' :
                                               TIER_ORDER[m?.tier ?? 'mid'] >  TIER_ORDER[meta.minModelTier] ? 'over' : 'under';
                              const score = (tierMatch === 'perfect' ? 400 : tierMatch === 'over' ? 200 : 0)
                                + (meta.preferNoDailyLimit && m?.noDailyLimit ? 200 : meta.preferNoDailyLimit ? 0 : 100)
                                + (10 - (m?.costWeight ?? 5)) * 10
                                - k.errorCount * 40
                                - Math.min(k.priority - 1, 9) * 5;
                              return { key: k, score, model: m };
                            })
                            .sort((a, b) => b.score - a.score)[0];
                          if (!best) return null;
                          return (
                            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
                              <CheckCircle2 size={11} className="flex-shrink-0" />
                              Will use <span className="font-medium">{best.key.label}</span>
                              {' '}({best.key.provider}/{best.key.model}) first — score {best.score}
                            </p>
                          );
                        })()}
                      </div>

                      {/* Group selector */}
                      <select
                        value={assignedGroupId}
                        onChange={e => {
                          const groupId = e.target.value;
                          setAssignments(prev =>
                            groupId
                              ? [...prev.filter(a => a.featureId !== fid), { featureId: fid, groupId }]
                              : prev.filter(a => a.featureId !== fid)
                          );
                        }}
                        className="bg-background-900 border border-background-600 text-white text-xs rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[160px] cursor-pointer flex-shrink-0"
                      >
                        <option value="">— Use Legacy Config —</option>
                        {groupsConfig.groups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.keys.filter(k => !k.isDisabled).length} active)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {groupsConfig.groups.length === 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80">No key groups exist yet. Go to the Key Groups tab to create one first.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={saveGroupsConfig} disabled={savingGroups}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-lg text-sm font-semibold transition-all shadow-lg disabled:opacity-50">
              {savingGroups ? <><Loader size={14} className="animate-spin" /> Saving…</>
                : groupsSaved ? <><Check size={14} /> Saved!</>
                : <><Check size={14} /> Save Assignments</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Legacy Config ───────────────────────────────────────────────── */}
      {activeTab === 'legacy' && (
        legacyLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader size={24} className="animate-spin text-primary-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-background-700 bg-background-900/50 p-4 flex items-start gap-3">
              <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300/80 leading-relaxed">
                Legacy Config is a single provider/model used as a fallback when no Key Group is assigned to a feature.
                For full failover and rate limiting, use the Key Groups tab instead.
              </p>
            </div>

            {/* Provider */}
            <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-background-700">
                <span className="text-sm font-semibold text-white">Provider</span>
              </div>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {AI_PROVIDERS.map(p => (
                  <button key={p.key} onClick={() => handleLegacyProviderChange(p.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-2 transition-all text-center ${
                      legacyProvider === p.key
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-background-700 bg-background-800 hover:border-background-600'
                    }`}>
                    <span className={`text-lg ${p.color} font-bold`}>{p.name[0]}</span>
                    <span className="text-xs font-medium text-white leading-tight">{p.name}</span>
                    {legacyProvider === p.key && <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Active</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-background-700">
                <span className="text-sm font-semibold text-white">Model</span>
              </div>
              <div className="p-5 space-y-2">
                {currentLegacyProvider.models.map(m => (
                  <label key={m.id} className={`flex items-center gap-4 rounded-xl border p-3 cursor-pointer transition-all ${
                    legacyModel === m.id ? 'border-primary-500 bg-primary-500/10' : 'border-background-700 bg-background-800 hover:border-background-600'
                  }`}>
                    <input type="radio" name="legacyModel" value={m.id} checked={legacyModel === m.id}
                      onChange={() => setLegacyModel(m.id)} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${legacyModel === m.id ? 'border-primary-500' : 'border-gray-600'}`}>
                      {legacyModel === m.id && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{m.label}</span>
                        {m.recommended && <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">Recommended</span>}
                      </div>
                      {m.notes && <p className="text-xs text-gray-500 mt-0.5">{m.id} · {m.notes}</p>}
                    </div>
                    {legacyModel === m.id && <Check size={14} className="text-primary-400 flex-shrink-0" />}
                  </label>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-background-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">API Key</span>
                <a href={currentLegacyProvider.docsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
                  Get key <ExternalLink size={11} />
                </a>
              </div>
              <div className="p-5">
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type={legacyShowKey ? 'text' : 'password'} value={legacyApiKey}
                    onChange={e => { setLegacyApiKey(e.target.value); setLegacyTestStatus('untested'); }}
                    placeholder="Paste your API key…" className={inputCls + ' pl-9 pr-10'} autoComplete="off" />
                  <button type="button" onClick={() => setLegacyShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                    {legacyShowKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {legacyTestStatus !== 'untested' && (
              <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                legacyTestStatus === 'passed' ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-red-500/30 bg-red-500/8'}`}>
                {legacyTestStatus === 'passed'
                  ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className={`text-sm font-semibold ${legacyTestStatus === 'passed' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {legacyTestStatus === 'passed' ? 'Connection successful' : 'Connection failed'}
                  </p>
                  {legacyTestStatus === 'failed' && legacyTestError && (
                    <p className="text-xs text-red-400/80 mt-0.5 font-mono">{legacyTestError}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 justify-end">
              <button onClick={handleLegacyTest} disabled={legacyTesting || !legacyApiKey.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-background-800 border border-background-700 text-white rounded-lg text-sm font-medium hover:bg-background-700 transition-colors disabled:opacity-50">
                {legacyTesting ? <><Loader size={14} className="animate-spin" /> Testing…</> : <><Zap size={14} /> Test</>}
              </button>
              <button onClick={handleLegacySave} disabled={legacySaving || !legacyApiKey.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-lg text-sm font-semibold transition-all shadow-lg disabled:opacity-50">
                {legacySaving ? <><Loader size={14} className="animate-spin" /> Saving…</>
                  : legacySaved ? <><Check size={14} /> Saved!</>
                  : <><Check size={14} /> Save & Apply</>}
              </button>
            </div>
            {legacyLastSaved && <p className="text-center text-xs text-gray-600">Last saved {legacyLastSaved}</p>}
          </div>
        )
      )}

      {/* ── Tab: Error Logs ──────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Auto-logged when a key fails during failover. Stores last {200} entries.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={loadLogs} disabled={logsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background-800 border border-background-700 text-white rounded-lg text-xs hover:bg-background-700 transition-colors">
                <RefreshCw size={11} className={logsLoading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={async () => { if (!confirm('Clear all logs?')) return; setClearingLogs(true); await aiKeyGroupService.clearLogs(); setLogs([]); setClearingLogs(false); }}
                disabled={clearingLogs || logs.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50">
                <RotateCcw size={11} /> Clear
              </button>
            </div>
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader size={20} className="animate-spin text-primary-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-background-600 bg-background-900/50 p-10 text-center">
              <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No errors logged.</p>
              <p className="text-gray-600 text-xs mt-1">Errors are recorded here when a key fails during an AI request.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className={`rounded-xl border p-4 ${
                  log.resolved ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {log.resolved
                        ? <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        : <XCircle      size={14} className="text-red-400 flex-shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white">{log.keyLabel}</span>
                          <span className={`text-xs ${providerColor(log.provider as ProviderKey)}`}>{log.provider}/{log.model}</span>
                          <span className="text-xs text-gray-500 bg-background-700 px-1.5 py-0.5 rounded">{log.featureId}</span>
                          <span className="text-xs text-gray-600">{log.groupName}</span>
                          {log.resolved && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Failover succeeded</span>}
                          {!log.resolved && <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">All keys failed</span>}
                        </div>
                        <p className="text-xs text-red-300/80 mt-1 font-mono break-all">{log.error}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Editor Modal */}
      {editingKey && (
        <KeyEditorModal
          entry={editingKey.key}
          onSave={key => saveKey(editingKey.groupId, key)}
          onClose={() => setEditingKey(null)}
        />
      )}
    </div>
  );
};

export default AIModelSettings;
