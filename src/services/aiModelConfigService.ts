// src/services/aiModelConfigService.ts
// AI Model Config — stores provider + model + API key in Firestore (admin-only)
// Supports: Gemini · Groq · OpenAI/GPT · Anthropic/Claude · DeepSeek

import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'groq' | 'openai' | 'anthropic' | 'deepseek';

export interface AIModelOption {
  id: string;
  label: string;
  recommended?: boolean;
  note?: string;
}

export interface AIProviderMeta {
  id: AIProvider;
  label: string;
  logo: string;           // emoji stand-in
  color: string;          // tailwind class for accent
  models: AIModelOption[];
  docsUrl: string;
  keyHint: string;        // placeholder / hint for the API key field
}

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  updatedAt?: any;
  updatedBy?: string;
  testStatus?: 'untested' | 'passed' | 'failed';
  testError?: string;
}

// ─── Provider + Model Catalogue ───────────────────────────────────────────────

export const AI_PROVIDERS: AIProviderMeta[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    logo: '✦',
    color: 'text-blue-400',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'AIza…',
    models: [
      { id: 'gemini-2.0-flash',                label: 'Gemini 2.0 Flash',          recommended: true, note: 'Fast & cheap' },
      { id: 'gemini-2.0-flash-lite',           label: 'Gemini 2.0 Flash Lite',     note: 'Cheapest' },
      { id: 'gemini-1.5-flash',                label: 'Gemini 1.5 Flash',           note: 'Stable' },
      { id: 'gemini-1.5-pro',                  label: 'Gemini 1.5 Pro',             note: 'Most capable' },
      { id: 'gemini-2.5-flash',                label: 'Gemini 2.5 Flash',           note: 'Balanced' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    logo: '⚡',
    color: 'text-orange-400',
    docsUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_…',
    models: [
      { id: 'llama-3.3-70b-versatile',  label: 'LLaMA 3.3 70B',         recommended: true, note: 'Best quality' },
      { id: 'llama-3.1-8b-instant',     label: 'LLaMA 3.1 8B Instant',  note: 'Ultra fast' },
      { id: 'mixtral-8x7b-32768',       label: 'Mixtral 8x7B',           note: 'Long context' },
      { id: 'gemma2-9b-it',             label: 'Gemma 2 9B',             note: 'Google / open' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI / GPT',
    logo: '◎',
    color: 'text-emerald-400',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    models: [
      { id: 'gpt-4o-mini',    label: 'GPT-4o Mini',   recommended: true, note: 'Best value' },
      { id: 'gpt-4o',         label: 'GPT-4o',         note: 'Most capable' },
      { id: 'gpt-4-turbo',    label: 'GPT-4 Turbo',    note: 'Fast + vision' },
      { id: 'gpt-3.5-turbo',  label: 'GPT-3.5 Turbo',  note: 'Cheapest' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic / Claude',
    logo: '◈',
    color: 'text-amber-400',
    docsUrl: 'https://console.anthropic.com/keys',
    keyHint: 'sk-ant-…',
    models: [
      { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',   recommended: true, note: 'Fast & affordable' },
      { id: 'claude-sonnet-4-6',           label: 'Claude Sonnet 4.6',  note: 'Balanced' },
      { id: 'claude-3-5-haiku-20241022',   label: 'Claude 3.5 Haiku',   note: 'Previous gen' },
      { id: 'claude-3-5-sonnet-20241022',  label: 'Claude 3.5 Sonnet',  note: 'Previous gen' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    logo: '◬',
    color: 'text-cyan-400',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-…',
    models: [
      { id: 'deepseek-chat',      label: 'DeepSeek Chat',      recommended: true, note: 'Very cheap' },
      { id: 'deepseek-reasoner',  label: 'DeepSeek Reasoner',  note: 'Thinking model' },
    ],
  },
];

// ─── Firestore helpers ────────────────────────────────────────────────────────

const CONFIG_DOC = () => doc(db, 'aiModelConfig', 'current');

// In-memory cache (5 min TTL) — avoids Firestore read on every AI call
let _cached: AIModelConfig | null = null;
let _cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export const aiModelConfigService = {

  /** Load config from Firestore (cached). Falls back to env-var Gemini if unset. */
  async getConfig(): Promise<AIModelConfig> {
    if (_cached && Date.now() - _cachedAt < CACHE_TTL) return _cached;

    try {
      const snap = await getDoc(CONFIG_DOC());
      if (snap.exists()) {
        _cached = snap.data() as AIModelConfig;
        _cachedAt = Date.now();
        return _cached;
      }
    } catch { /* Firestore unavailable or no permission — fall through */ }

    // Default fallback: use env var with Gemini 2.0 Flash
    return {
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
      testStatus: 'untested',
    };
  },

  /** Save config to Firestore (admin only). Busts cache. */
  async saveConfig(config: AIModelConfig, adminUid: string): Promise<void> {
    await setDoc(CONFIG_DOC(), {
      ...config,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
    _cached = config;
    _cachedAt = Date.now();
  },

  /** Test the config by sending a minimal prompt. Returns null on success, error string on failure. */
  async testConfig(config: AIModelConfig): Promise<string | null> {
    try {
      const result = await callProviderDirect(
        'Reply with exactly: OK',
        config,
        50,
        0.1
      );
      return result.trim() ? null : 'Empty response from model';
    } catch (e: any) {
      return e?.message || 'Unknown error';
    }
  },

  /** Busts the in-memory cache (call after saving). */
  bustCache() {
    _cached = null;
    _cachedAt = 0;
  },

  getProviderMeta(provider: AIProvider): AIProviderMeta {
    return AI_PROVIDERS.find(p => p.id === provider) ?? AI_PROVIDERS[0];
  },
};

// ─── Internal multi-provider caller (exported for aiStudyPlannerService) ─────

export async function callProviderDirect(
  prompt: string,
  config: AIModelConfig,
  maxTokens = 1024,
  temp = 0.7
): Promise<string> {
  const { provider, model, apiKey } = config;

  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}`);

  // ── OpenAI-compatible (Groq, OpenAI, DeepSeek) ───────────────────────────
  const OAI_ENDPOINTS: Partial<Record<AIProvider, string>> = {
    groq:     'https://api.groq.com/openai/v1/chat/completions',
    openai:   'https://api.openai.com/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
  };

  if (provider in OAI_ENDPOINTS) {
    const res = await fetch(OAI_ENDPOINTS[provider]!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: temp,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`${provider} error ${res.status}: ${body}`);
    }
    const d = await res.json();
    return d.choices?.[0]?.message?.content ?? '';
  }

  // ── Anthropic ────────────────────────────────────────────────────────────
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`Anthropic error ${res.status}: ${body}`);
    }
    const d = await res.json();
    return d.content?.[0]?.text ?? '';
  }

  // ── Gemini (default) ─────────────────────────────────────────────────────
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 200)}`);
  }
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
