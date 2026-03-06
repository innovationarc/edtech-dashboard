// src/pages/AIModelSettings.tsx
// Admin Panel — AI Model Settings
// Lets admin pick provider (Gemini/Groq/GPT/Claude/DeepSeek), model, and API key
// Config is saved to Firestore aiModelConfig/current and used by all AI features

import React, { useState, useEffect } from 'react';
import {
  Brain, Key, Check, Loader, AlertTriangle, ExternalLink,
  Eye, EyeOff, Zap, RefreshCw, ChevronDown, Shield, Info,
  CheckCircle2, XCircle, Settings,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import {
  aiModelConfigService,
  AI_PROVIDERS,
  AIModelConfig,
  AIProvider,
  AIProviderMeta,
} from '../services/aiModelConfigService';

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-background-700 focus:border-primary-500 transition-colors text-sm placeholder-gray-500';

// ─── Component ────────────────────────────────────────────────────────────────

const AIModelSettings: React.FC = () => {
  const { user } = useDashboard();

  // ── Load state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [testing, setTesting]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [provider, setProvider]   = useState<AIProvider>('gemini');
  const [model, setModel]         = useState('gemini-2.0-flash');
  const [apiKey, setApiKey]       = useState('');
  const [showKey, setShowKey]     = useState(false);

  // ── Test result ──────────────────────────────────────────────────────────────
  const [testStatus, setTestStatus] = useState<'untested' | 'passed' | 'failed'>('untested');
  const [testError, setTestError]   = useState('');
  const [lastSaved, setLastSaved]   = useState<string | null>(null);

  const currentProvider: AIProviderMeta = AI_PROVIDERS.find(p => p.id === provider)!;

  // ── Load config on mount ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const cfg = await aiModelConfigService.getConfig();
        setProvider(cfg.provider);
        setModel(cfg.model);
        setApiKey(cfg.apiKey || '');
        setTestStatus(cfg.testStatus || 'untested');
        setTestError(cfg.testError || '');
        if (cfg.updatedAt?.toDate) {
          setLastSaved(cfg.updatedAt.toDate().toLocaleString());
        }
      } catch { /* use defaults */ }
      setLoading(false);
    })();
  }, []);

  // ── When provider changes, auto-select the recommended model ───────────────
  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    const meta = AI_PROVIDERS.find(x => x.id === p)!;
    const rec = meta.models.find(m => m.recommended) ?? meta.models[0];
    setModel(rec.id);
    setTestStatus('untested');
    setTestError('');
  };

  // ── Test connection ─────────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestStatus('failed');
      setTestError('Enter an API key first.');
      return;
    }
    setTesting(true);
    setTestStatus('untested');
    setTestError('');
    try {
      const error = await aiModelConfigService.testConfig({ provider, model, apiKey });
      if (error) {
        setTestStatus('failed');
        setTestError(error);
      } else {
        setTestStatus('passed');
      }
    } catch (e: any) {
      setTestStatus('failed');
      setTestError(e?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  // ── Save config ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const cfg: AIModelConfig = { provider, model, apiKey, testStatus, testError };
      await aiModelConfigService.saveConfig(cfg, user.uid);
      aiModelConfigService.bustCache();
      setSaveSuccess(true);
      setLastSaved(new Date().toLocaleString());
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert('Failed to save: ' + (e?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={24} className="animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-600 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Brain size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Model Settings</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Choose which AI provider and model powers all study planner features.
            Changes apply immediately for all students.
          </p>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <Shield size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/80 leading-relaxed">
          API keys are stored in Firestore with admin-only access rules. They are used
          client-side to call the AI provider directly. Never share your admin credentials.
        </p>
      </div>

      {/* ── Step 1: Provider ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-background-700 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 1</span>
          <span className="text-sm font-semibold text-white">Choose Provider</span>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {AI_PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-2 transition-all text-center ${
                provider === p.id
                  ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10'
                  : 'border-background-700 bg-background-800 hover:border-background-600'
              }`}
            >
              <span className={`text-2xl ${p.color}`}>{p.logo}</span>
              <span className="text-xs font-medium text-white leading-tight">{p.label}</span>
              {provider === p.id && (
                <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Active</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Step 2: Model ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-background-700 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2</span>
          <span className="text-sm font-semibold text-white">Choose Model</span>
        </div>
        <div className="p-5 space-y-3">
          {currentProvider.models.map(m => (
            <label
              key={m.id}
              className={`flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-all ${
                model === m.id
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-background-700 bg-background-800 hover:border-background-600'
              }`}
            >
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={model === m.id}
                onChange={() => setModel(m.id)}
                className="hidden"
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                model === m.id ? 'border-primary-500' : 'border-gray-600'
              }`}>
                {model === m.id && <div className="w-2 h-2 rounded-full bg-primary-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{m.label}</span>
                  {m.recommended && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 font-mono">{m.id}</span>
                  {m.note && <span className="text-xs text-gray-500">· {m.note}</span>}
                </div>
              </div>
              {model === m.id && <Check size={16} className="text-primary-400 flex-shrink-0" />}
            </label>
          ))}
        </div>
      </div>

      {/* ── Step 3: API Key ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-background-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 3</span>
            <span className="text-sm font-semibold text-white">API Key</span>
          </div>
          <a
            href={currentProvider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            Get {currentProvider.label} key <ExternalLink size={11} />
          </a>
        </div>
        <div className="p-5">
          <div className="relative">
            <Key size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setTestStatus('untested'); }}
              placeholder={currentProvider.keyHint + ' (your API key)'}
              className={inputCls + ' pl-10 pr-12'}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {!apiKey && (
            <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
              <Info size={11} /> Enter your {currentProvider.label} API key above to enable AI features.
            </p>
          )}
        </div>
      </div>

      {/* ── Test Result ───────────────────────────────────────────────────────── */}
      {testStatus !== 'untested' && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          testStatus === 'passed'
            ? 'border-emerald-500/30 bg-emerald-500/8'
            : 'border-red-500/30 bg-red-500/8'
        }`}>
          {testStatus === 'passed'
            ? <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            : <XCircle    size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-semibold ${testStatus === 'passed' ? 'text-emerald-300' : 'text-red-300'}`}>
              {testStatus === 'passed' ? 'Connection successful' : 'Connection failed'}
            </p>
            {testStatus === 'failed' && testError && (
              <p className="text-xs text-red-400/80 mt-0.5 font-mono">{testError}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Current config summary ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-background-700 bg-background-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Config</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Provider</p>
            <p className={`text-sm font-bold ${currentProvider.color}`}>
              {currentProvider.logo} {currentProvider.label}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Model</p>
            <p className="text-sm font-bold text-white truncate">{model}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Key Status</p>
            <p className={`text-sm font-bold ${apiKey ? 'text-emerald-400' : 'text-red-400'}`}>
              {apiKey ? '● Set' : '○ Missing'}
            </p>
          </div>
        </div>
        {lastSaved && (
          <p className="mt-3 text-center text-xs text-gray-600">Last saved {lastSaved}</p>
        )}
      </div>

      {/* ── Footer actions ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={handleTest}
          disabled={testing || !apiKey.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-background-800 hover:bg-background-700 border border-background-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing
            ? <><Loader size={14} className="animate-spin" /> Testing…</>
            : <><Zap size={14} /> Test Connection</>
          }
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-lg transition-all text-sm font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? <><Loader size={14} className="animate-spin" /> Saving…</>
            : saveSuccess
            ? <><Check size={14} /> Saved!</>
            : <><Check size={14} /> Save & Apply</>
          }
        </button>
      </div>

    </div>
  );
};

export default AIModelSettings;
