// src/services/aiModelConfigService.ts
// Multi-provider AI config — stored in Firestore, admin-only
// Supports: Gemini · Groq · OpenAI · Anthropic · DeepSeek

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type ProviderKey = 'gemini' | 'groq' | 'openai' | 'anthropic' | 'deepseek';

export interface ModelOption {
  id: string;
  label: string;
  notes?: string;
  recommended?: boolean;
}

export interface ProviderInfo {
  key: ProviderKey;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  docsUrl: string;
  models: ModelOption[];
}

export const AI_PROVIDERS: ProviderInfo[] = [
  {
    key: 'gemini',
    name: 'Google Gemini',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    docsUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash',      recommended: true, notes: 'Fast, cheap, great for all tasks' },
      { id: 'gemini-1.5-flash',       label: 'Gemini 1.5 Flash',      notes: 'Reliable, lower cost' },
      { id: 'gemini-1.5-pro',         label: 'Gemini 1.5 Pro',        notes: 'Most capable Gemini' },
      { id: 'gemini-2.0-flash-lite',  label: 'Gemini 2.0 Flash Lite', notes: 'Fastest & cheapest' },
    ],
  },
  {
    key: 'groq',
    name: 'Groq',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    docsUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',        recommended: true, notes: 'Best quality on Groq' },
      { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Instant', notes: 'Fastest response' },
      { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',         notes: 'Great context window' },
      { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',           notes: 'Lightweight & capable' },
    ],
  },
  {
    key: 'openai',
    name: 'OpenAI / GPT',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini',   label: 'GPT-4o Mini',   recommended: true, notes: 'Best value from OpenAI' },
      { id: 'gpt-4o',        label: 'GPT-4o',         notes: 'Most capable, higher cost' },
      { id: 'gpt-4-turbo',   label: 'GPT-4 Turbo',    notes: 'Powerful with vision' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo',  notes: 'Cheapest OpenAI option' },
    ],
  },
  {
    key: 'anthropic',
    name: 'Anthropic (Claude)',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku',  recommended: true, notes: 'Fast & affordable' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', notes: 'High quality balanced' },
      { id: 'claude-3-opus-20240229',     label: 'Claude 3 Opus',     notes: 'Most powerful Claude' },
      { id: 'claude-3-haiku-20240307',    label: 'Claude 3 Haiku',    notes: 'Cheapest Claude option' },
    ],
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat',     label: 'DeepSeek Chat',     recommended: true, notes: 'Best value, very capable' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', notes: 'Chain-of-thought reasoning' },
    ],
  },
];

export interface AIModelConfig {
  provider: ProviderKey;
  model: string;
  apiKey: string;
  testStatus?: 'ok' | 'fail' | null;
  testError?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

const FIRESTORE_DOC = 'aiModelConfig/current';
const CACHE_TTL_MS  = 5 * 60 * 1000;

let _cache: AIModelConfig | null = null;
let _cacheTs = 0;

export const aiModelConfigService = {
  async getConfig(): Promise<AIModelConfig> {
    if (_cache && Date.now() - _cacheTs < CACHE_TTL_MS) return _cache;
    try {
      const snap = await getDoc(doc(db, FIRESTORE_DOC));
      if (snap.exists()) {
        _cache = snap.data() as AIModelConfig;
        _cacheTs = Date.now();
        return _cache;
      }
    } catch (e) {
      console.error('[AIModelConfig] Firestore read failed:', e);
    }
    // Only fall back to env var Gemini if NO config has ever been saved
    // This prevents silently reverting to Gemini after you've saved a different provider
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const fallback: AIModelConfig = { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: envKey };
    // Do NOT cache the fallback — retry Firestore next call
    return fallback;
  },

  async saveConfig(config: AIModelConfig, adminUid: string): Promise<void> {
    const toSave = { ...config, updatedAt: new Date().toISOString(), updatedBy: adminUid };
    await setDoc(doc(db, FIRESTORE_DOC), toSave);
    _cache = toSave; _cacheTs = Date.now();
  },

  async testConfig(config: AIModelConfig): Promise<string | null> {
    try {
      const result = await callProviderDirect('Reply with exactly the word: OK', config, 20, 0.0);
      return result.trim() ? null : 'Empty response from API';
    } catch (e: any) {
      return e?.message || 'Unknown error';
    }
  },

  bustCache() { _cache = null; _cacheTs = 0; },
};

export async function callProviderDirect(
  prompt: string,
  config: AIModelConfig,
  maxTokens = 2048,
  temp = 0.7
): Promise<string> {
  const { provider, model, apiKey } = config;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    const d = await res.json();
    return d.content?.[0]?.text || '';
  }

  const COMPAT_URLS: Record<string, string> = {
    groq:     'https://api.groq.com/openai/v1/chat/completions',
    openai:   'https://api.openai.com/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
  };
  const url = COMPAT_URLS[provider];
  if (!url) throw new Error(`Unknown provider: ${provider}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: temp, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || '';
}
