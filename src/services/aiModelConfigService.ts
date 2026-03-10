// src/services/aiModelConfigService.ts
// Multi-provider AI config — stored in Firestore, admin-only
// v2: API Key Groups · Failover · Rate Limiting · Error Logs
// Supports: Gemini · Groq · OpenAI · Anthropic · DeepSeek
// All v1 exports preserved — 100% backwards compatible

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Provider types (unchanged) ───────────────────────────────────────────────

export type ProviderKey = 'gemini' | 'groq' | 'openai' | 'anthropic' | 'deepseek';

/** nano = tiny/cheap (chatbot, tips), mid = capable (chat, digest, insights), high = powerful (schedule, patterns) */
export type ModelTier = 'nano' | 'mid' | 'high';

export interface ModelOption {
  id: string;
  label: string;
  notes?: string;
  recommended?: boolean;
  /** Capability tier — used by smart sort to match the right key to each feature */
  tier: ModelTier;
  /** True for models with no per-day token/request limits (e.g. Groq compound) */
  noDailyLimit?: boolean;
  /** Relative cost weight — 1=cheapest, 10=most expensive — used to minimise spend */
  costWeight: number;
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

// ─── AI_PROVIDERS — every model annotated with tier, noDailyLimit, costWeight ──
// tier:        nano=tiny/cheap  mid=capable  high=powerful
// noDailyLimit: true = Groq compound models (no RPD cap from Groq)
// costWeight:   1=cheapest → 10=most expensive (relative, cross-provider)

export const AI_PROVIDERS: ProviderInfo[] = [
  {
    key: 'gemini',
    name: 'Google Gemini',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    docsUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', notes: 'Fastest & cheapest Gemini',   tier: 'nano', costWeight: 1 },
      { id: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash',      notes: 'Reliable, lower cost',        tier: 'nano', costWeight: 2 },
      { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      notes: 'Fast, balanced, recommended', tier: 'mid',  costWeight: 3, recommended: true },
      { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      notes: 'Latest generation flash',     tier: 'mid',  costWeight: 4 },
      { id: 'gemini-1.5-pro',        label: 'Gemini 1.5 Pro',        notes: 'Most capable Gemini',         tier: 'high', costWeight: 7 },
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
      { id: 'compound-beta-mini',      label: 'Compound Beta Mini',    notes: 'No daily limit — ideal for chatbot', tier: 'nano', costWeight: 1, noDailyLimit: true },
      { id: 'compound-beta',           label: 'Compound Beta',         notes: 'No daily limit, solid quality',      tier: 'mid',  costWeight: 2, noDailyLimit: true },
      { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',           notes: 'Lightweight & capable',              tier: 'nano', costWeight: 1 },
      { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Instant', notes: 'Fastest Groq response',              tier: 'nano', costWeight: 1 },
      { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',         notes: 'Great context window',               tier: 'mid',  costWeight: 2 },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',        notes: 'Best quality on Groq',               tier: 'high', costWeight: 4, recommended: true },
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
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', notes: 'Cheapest OpenAI option',   tier: 'nano', costWeight: 2 },
      { id: 'gpt-4o-mini',   label: 'GPT-4o Mini',   notes: 'Best value — recommended', tier: 'mid',  costWeight: 4, recommended: true },
      { id: 'gpt-4-turbo',   label: 'GPT-4 Turbo',   notes: 'Powerful with vision',     tier: 'high', costWeight: 8 },
      { id: 'gpt-4o',        label: 'GPT-4o',         notes: 'Most capable, higher cost',tier: 'high', costWeight: 9 },
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
      { id: 'claude-3-haiku-20240307',    label: 'Claude 3 Haiku',    notes: 'Cheapest Claude option',     tier: 'nano', costWeight: 2 },
      { id: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku',  notes: 'Fast & affordable',          tier: 'mid',  costWeight: 4, recommended: true },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', notes: 'High quality balanced',      tier: 'high', costWeight: 8 },
      { id: 'claude-3-opus-20240229',     label: 'Claude 3 Opus',     notes: 'Most powerful Claude',       tier: 'high', costWeight: 10 },
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
      { id: 'deepseek-chat',     label: 'DeepSeek Chat',     notes: 'Best value, very capable',        tier: 'mid',  costWeight: 2, recommended: true },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', notes: 'Chain-of-thought, complex tasks', tier: 'high', costWeight: 5 },
    ],
  },
];

// ─── Legacy single-config (v1 — unchanged) ───────────────────────────────────

export interface AIModelConfig {
  provider: ProviderKey;
  model: string;
  apiKey: string;
  testStatus?: 'ok' | 'fail' | null;
  testError?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

const FIRESTORE_DOC  = 'aiModelConfig/current';
const CACHE_TTL_MS   = 5 * 60 * 1000;

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
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const fallback: AIModelConfig = { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: envKey };
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

// ─── v2: Feature IDs ──────────────────────────────────────────────────────────

export type AIFeatureId =
  | 'chatbot'
  | 'study_schedule'
  | 'study_slots'
  | 'study_chat'
  | 'study_draft'
  | 'study_insights'
  | 'study_digest'
  | 'study_patterns'
  | 'study_tips'
  | 'study_prioritize';

export interface AIFeatureMeta {
  label: string;
  description: string;
  tier: 'basic' | 'advanced';
  /**
   * Minimum model tier this feature needs to produce good results.
   * The smart sort will always try to meet or exceed this requirement.
   * nano — simple Q&A, short tips, chat responses
   * mid  — summaries, digests, slot suggestions, event drafts
   * high — multi-day schedule generation, pattern analysis, complex reasoning
   */
  minModelTier: ModelTier;
  /**
   * Whether this feature benefits from no-daily-limit models.
   * High-traffic features (chatbot) should prefer compound-beta over
   * daily-capped models to avoid exhausting limits.
   */
  preferNoDailyLimit: boolean;
  /**
   * Estimated average token spend per call.
   * Used to weigh how aggressively to conserve daily limits.
   * low <500 | medium 500-1500 | high >1500
   */
  tokenCost: 'low' | 'medium' | 'high';
}

// ─── Token cost helper (exported for UI use) ──────────────────────────────────
export const TIER_ORDER: Record<ModelTier, number> = { nano: 0, mid: 1, high: 2 };

export const AI_FEATURE_LABELS: Record<AIFeatureId, AIFeatureMeta> = {
  // ── Basic / nano features ──────────────────────────────────────────────────
  // These don't need heavy models. Prefer no-daily-limit, low cost.
  chatbot: {
    label: 'AI Tutor Chatbot',
    description: 'Student-facing chatbot widget — high call volume, short responses',
    tier: 'basic',
    minModelTier: 'nano',
    preferNoDailyLimit: true,   // called many times per student per session
    tokenCost: 'low',
  },
  study_draft: {
    label: 'Event Auto-Draft',
    description: 'Auto-fill event title/description from a single title string',
    tier: 'basic',
    minModelTier: 'nano',
    preferNoDailyLimit: false,
    tokenCost: 'low',
  },
  study_tips: {
    label: 'Study Tips',
    description: 'Quick subject-specific tips — 3 bullet points',
    tier: 'basic',
    minModelTier: 'nano',
    preferNoDailyLimit: false,
    tokenCost: 'low',
  },
  study_insights: {
    label: 'Personalised Insights',
    description: 'Motivational insight cards — short JSON array',
    tier: 'basic',
    minModelTier: 'nano',
    preferNoDailyLimit: true,   // shown on every dashboard load
    tokenCost: 'low',
  },
  study_prioritize: {
    label: 'Task Prioritizer',
    description: 'Re-rank tasks by urgency — structured JSON',
    tier: 'basic',
    minModelTier: 'nano',
    preferNoDailyLimit: false,
    tokenCost: 'low',
  },

  // ── Mid-tier features ──────────────────────────────────────────────────────
  // Need decent reasoning but not top-tier models.
  study_chat: {
    label: 'Study Planner Chat (Sage)',
    description: 'Multi-turn AI chat inside study planner — context-aware responses',
    tier: 'basic',
    minModelTier: 'mid',
    preferNoDailyLimit: true,   // active during study sessions
    tokenCost: 'medium',
  },
  study_digest: {
    label: 'Weekly Digest',
    description: 'Weekly progress summary — paragraph + tips',
    tier: 'basic',
    minModelTier: 'mid',
    preferNoDailyLimit: false,
    tokenCost: 'medium',
  },
  study_slots: {
    label: 'Time Slot Suggestions',
    description: 'Find optimal time windows given existing commitments',
    tier: 'advanced',
    minModelTier: 'mid',
    preferNoDailyLimit: false,
    tokenCost: 'medium',
  },

  // ── High-tier features ─────────────────────────────────────────────────────
  // Require strong models. Using nano/mid here produces noticeably worse results.
  study_schedule: {
    label: 'Smart Schedule Generator',
    description: 'Multi-day study plan with spaced repetition — complex JSON',
    tier: 'advanced',
    minModelTier: 'high',
    preferNoDailyLimit: false,
    tokenCost: 'high',
  },
  study_patterns: {
    label: 'Study Pattern Analysis',
    description: 'Deep analysis of 30-day session history — structured insights',
    tier: 'advanced',
    minModelTier: 'high',
    preferNoDailyLimit: false,
    tokenCost: 'high',
  },
};

// ─── v2: API Key Group types ──────────────────────────────────────────────────

export interface APIKeyEntry {
  id: string;
  label: string;
  provider: ProviderKey;
  model: string;
  apiKey: string;
  /** Lower number = tried first */
  priority: number;
  /** 0 = unlimited */
  rpm: number;
  /** 0 = unlimited */
  rpd: number;
  /** 0 = unlimited */
  tpm: number;
  /** 0 = unlimited */
  tpd: number;
  /** Consecutive error counter — auto-incremented on failure, decremented on success */
  errorCount: number;
  lastError?: string;
  lastErrorAt?: string;
  isDisabled: boolean;
}

export interface APIKeyGroup {
  id: string;
  name: string;
  description?: string;
  keys: APIKeyEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface FeatureAssignment {
  featureId: AIFeatureId;
  groupId: string;
}

export interface KeyGroupsConfig {
  groups: APIKeyGroup[];
  assignments: FeatureAssignment[];
  updatedAt: string;
  updatedBy?: string;
}

export interface AIErrorLog {
  id: string;
  timestamp: string;
  featureId: string;
  keyLabel: string;
  keyId: string;
  groupName: string;
  provider: string;
  model: string;
  error: string;
  /** true = a subsequent key in the group succeeded after this failure */
  resolved: boolean;
}

// ─── v2: Firestore paths ──────────────────────────────────────────────────────

const GROUPS_DOC  = 'aiModelConfig/keyGroups';
const LOGS_DOC    = 'aiModelConfig/errorLogs';
const MAX_LOGS    = 200;

let _groupsCache: KeyGroupsConfig | null = null;
let _groupsCacheTs = 0;

export const aiKeyGroupService = {
  async getConfig(): Promise<KeyGroupsConfig> {
    if (_groupsCache && Date.now() - _groupsCacheTs < CACHE_TTL_MS) return _groupsCache;
    try {
      const snap = await getDoc(doc(db, GROUPS_DOC));
      if (snap.exists()) {
        _groupsCache = snap.data() as KeyGroupsConfig;
        _groupsCacheTs = Date.now();
        return _groupsCache;
      }
    } catch (e) {
      console.error('[AIKeyGroups] Firestore read failed:', e);
    }
    return { groups: [], assignments: [], updatedAt: '' };
  },

  async saveConfig(config: KeyGroupsConfig, adminUid: string): Promise<void> {
    const toSave: KeyGroupsConfig = { ...config, updatedAt: new Date().toISOString(), updatedBy: adminUid };
    await setDoc(doc(db, GROUPS_DOC), toSave);
    _groupsCache = toSave;
    _groupsCacheTs = Date.now();
  },

  bustCache() { _groupsCache = null; _groupsCacheTs = 0; },

  async getErrorLogs(): Promise<AIErrorLog[]> {
    try {
      const snap = await getDoc(doc(db, LOGS_DOC));
      if (snap.exists()) return (snap.data().logs as AIErrorLog[]) || [];
    } catch (e) {
      console.error('[AIKeyGroups] Logs read failed:', e);
    }
    return [];
  },

  async logError(entry: Omit<AIErrorLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const snap = await getDoc(doc(db, LOGS_DOC));
      const existing: AIErrorLog[] = snap.exists() ? (snap.data().logs || []) : [];
      const newLog: AIErrorLog = {
        ...entry,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
      };
      const logs = [newLog, ...existing].slice(0, MAX_LOGS);
      await setDoc(doc(db, LOGS_DOC), { logs });
    } catch (e) {
      console.error('[AIKeyGroups] Log write failed:', e);
    }
  },

  async clearLogs(): Promise<void> {
    await setDoc(doc(db, LOGS_DOC), { logs: [] });
  },
};

// ─── v2: In-memory usage tracking ────────────────────────────────────────────

interface UsageWindow {
  requestsThisMinute: number;
  requestsToday: number;
  tokensToday: number;
  minuteStart: number;
  dayStart: number;
}

const _usageMap = new Map<string, UsageWindow>();

function getUsage(keyId: string): UsageWindow {
  let u = _usageMap.get(keyId);
  if (!u) {
    u = { requestsThisMinute: 0, requestsToday: 0, tokensToday: 0, minuteStart: Date.now(), dayStart: Date.now() };
    _usageMap.set(keyId, u);
  }
  const now = Date.now();
  if (now - u.minuteStart > 60_000)    { u.requestsThisMinute = 0; u.minuteStart = now; }
  if (now - u.dayStart   > 86_400_000) { u.requestsToday = 0; u.tokensToday = 0; u.dayStart = now; }
  return u;
}

function trackUsage(keyId: string, tokens: number) {
  const u = getUsage(keyId);
  u.requestsThisMinute++;
  u.requestsToday++;
  u.tokensToday += tokens;
}

function isKeyAvailable(entry: APIKeyEntry): boolean {
  if (entry.isDisabled) return false;
  const u = getUsage(entry.id);
  if (entry.rpm > 0 && u.requestsThisMinute >= entry.rpm) return false;
  if (entry.rpd > 0 && u.requestsToday       >= entry.rpd) return false;
  if (entry.tpd > 0 && u.tokensToday         >= entry.tpd) return false;
  return true;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── v2: Call provider and capture token usage ────────────────────────────────

async function callProviderWithUsage(
  prompt: string,
  entry: APIKeyEntry,
  maxTokens: number,
  temp: number
): Promise<{ text: string; tokens: number }> {
  const { provider, model, apiKey } = entry;

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
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokens = d.usageMetadata?.totalTokenCount || estimateTokens(prompt + text);
    return { text, tokens };
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
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    const d = await res.json();
    const text = d.content?.[0]?.text || '';
    const tokens = (d.usage?.input_tokens || 0) + (d.usage?.output_tokens || 0) || estimateTokens(prompt + text);
    return { text, tokens };
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
  const text = d.choices?.[0]?.message?.content || '';
  const tokens = d.usage?.total_tokens || estimateTokens(prompt + text);
  return { text, tokens };
}

// ─── v2: Smart failover caller ────────────────────────────────────────────────

/**
 * scoreKey — the intelligence layer.
 *
 * Scores a key 0-1000 (higher = better fit). Factors in order of importance:
 *
 * 1. TIER FIT (0–400 pts)
 *    - Meets minModelTier              → 400 pts
 *    - Over-spec (tier > required)     → 200 pts (wastes tokens/cost)
 *    - Under-spec (tier < required)    → 0 pts (poor quality — last resort)
 *
 * 2. DAILY LIMIT FIT (0–200 pts)
 *    - Feature preferNoDailyLimit + key.noDailyLimit → 200 pts
 *    - Feature preferNoDailyLimit, key has daily limit → 0 pts
 *    - Feature doesn't prefer no-limit                 → 100 pts (neutral)
 *
 * 3. AVAILABILITY / RATE LIMITS (0–200 pts)
 *    - Fully available (no windows exceeded) → 200 pts
 *    - Over RPM only (minute resets fast)    → 80 pts
 *    - Over RPD/TPD                          → 0 pts
 *
 * 4. COST (0–100 pts)
 *    - Lower costWeight = more pts (conserve expensive keys)
 *    - Formula: (10 - costWeight) * 10
 *
 * 5. RELIABILITY (-200–0 pts penalty)
 *    - errorCount: -40 per error (capped at -200)
 *
 * 6. ADMIN PRIORITY TIEBREAKER (-50–0 pts)
 *    - priority 1 → 0 penalty, priority 10 → -50 penalty
 *    - Only matters when all else is equal
 */
function scoreKey(key: APIKeyEntry, featureMeta: AIFeatureMeta): number {
  const modelInfo = AI_PROVIDERS
    .flatMap(p => p.models)
    .find(m => m.id === key.model);

  const keyTier      = modelInfo?.tier        ?? 'mid';
  const noDailyLimit = modelInfo?.noDailyLimit ?? false;
  const costWeight   = modelInfo?.costWeight   ?? 5;

  let score = 0;

  // ── 1. Tier fit ────────────────────────────────────────────────────────────
  const required = TIER_ORDER[featureMeta.minModelTier];
  const actual   = TIER_ORDER[keyTier];

  if (actual === required)      score += 400; // perfect match
  else if (actual > required)   score += 200; // over-spec — works but wasteful
  else                          score += 0;   // under-spec — last resort only

  // ── 2. Daily limit fit ─────────────────────────────────────────────────────
  if (featureMeta.preferNoDailyLimit) {
    score += noDailyLimit ? 200 : 0;
  } else {
    score += 100; // neutral for features that don't care
  }

  // ── 3. Availability ────────────────────────────────────────────────────────
  const u = getUsage(key.id);
  const overRPM = key.rpm > 0 && u.requestsThisMinute >= key.rpm;
  const overRPD = key.rpd > 0 && u.requestsToday       >= key.rpd;
  const overTPD = key.tpd > 0 && u.tokensToday         >= key.tpd;

  if (!overRPM && !overRPD && !overTPD)  score += 200;
  else if (overRPM && !overRPD && !overTPD) score += 80; // minute resets soon
  else score += 0; // day limit hit — effectively unavailable

  // ── 4. Cost (conserve expensive keys) ────────────────────────────────────
  score += (10 - costWeight) * 10; // 0–100

  // ── 5. Reliability ────────────────────────────────────────────────────────
  score -= Math.min(key.errorCount * 40, 200);

  // ── 6. Admin priority tiebreaker ──────────────────────────────────────────
  score -= Math.min(key.priority - 1, 9) * 5; // priority 1 = 0 penalty, 10 = -45

  return score;
}

export async function callWithFailover(
  prompt: string,
  featureId: AIFeatureId,
  maxTokens = 2048,
  temp = 0.7
): Promise<string> {
  const groupsConfig = await aiKeyGroupService.getConfig();
  const featureMeta  = AI_FEATURE_LABELS[featureId];

  const assignment = groupsConfig.assignments.find(a => a.featureId === featureId);
  if (!assignment) {
    const cfg = await aiModelConfigService.getConfig();
    if (!cfg.apiKey) throw new Error('No AI API key configured. Go to Admin → AI Model Settings.');
    return callProviderDirect(prompt, cfg, maxTokens, temp);
  }

  const group = groupsConfig.groups.find(g => g.id === assignment.groupId);
  if (!group || group.keys.length === 0) {
    const cfg = await aiModelConfigService.getConfig();
    if (!cfg.apiKey) throw new Error('No AI API key configured. Go to Admin → AI Model Settings.');
    return callProviderDirect(prompt, cfg, maxTokens, temp);
  }

  // ── Smart sort: highest score first ────────────────────────────────────────
  const sortedKeys = [...group.keys]
    .filter(k => !k.isDisabled)
    .map(k    => ({ key: k, score: scoreKey(k, featureMeta) }))
    .sort((a, b) => b.score - a.score) // descending — best fit first
    .map(({ key }) => key);

  if (sortedKeys.length === 0) {
    throw new Error(`All API keys in group "${group.name}" are disabled. Please enable at least one key.`);
  }

  // Dev logging so you can see the decision in console
  if ((import.meta as any).env?.DEV) {
    console.groupCollapsed(`[AI Smart Sort] Feature: ${featureId} (needs: ${featureMeta.minModelTier})`);
    [...group.keys].filter(k => !k.isDisabled).forEach(k => {
      console.log(`  ${scoreKey(k, featureMeta).toString().padStart(4)}pts  ${k.label} (${k.provider}/${k.model})`);
    });
    console.groupEnd();
  }

  let lastError: Error | null = null;

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    try {
      const { text, tokens } = await callProviderWithUsage(prompt, key, maxTokens, temp);
      trackUsage(key.id, tokens);
      if (key.errorCount > 0) key.errorCount = Math.max(0, key.errorCount - 1);
      return text;
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const errorMsg = lastError.message;
      key.errorCount = (key.errorCount || 0) + 1;
      key.lastError   = errorMsg;
      key.lastErrorAt = new Date().toISOString();

      const resolved = i < sortedKeys.length - 1;
      aiKeyGroupService.logError({
        featureId,
        keyLabel:  key.label,
        keyId:     key.id,
        groupName: group.name,
        provider:  key.provider,
        model:     key.model,
        error:     errorMsg,
        resolved,
      }).catch(console.error);

      console.warn(`[AI Failover] "${key.label}" (${key.provider}/${key.model}) failed for "${featureId}":`, errorMsg);
    }
  }

  throw lastError || new Error(`All AI keys in group "${group.name}" failed. Check Admin → AI Logs.`);
}

// ─── v1: callProviderDirect (unchanged — kept for backwards compat) ───────────

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
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
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
