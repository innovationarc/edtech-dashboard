// src/services/aiModelConfigService.ts
// Multi-provider AI config — stored in Firestore, admin-only
// v3: Real-pricing scoring · Deprecation flags · Updated model roster (Mar 2026)
//     API Key Groups · Smart Failover · Rate Limiting · Error Logs
// Supports: Gemini · Groq · OpenAI · Anthropic · DeepSeek
// All v1 exports preserved — 100% backwards compatible
//
// Pricing verified Mar 10 2026 against:
//   DeepSeek  → api-docs.deepseek.com/quick_start/pricing  (no rate limits)
//   Groq      → groq.com/pricing                           (no RPD, only RPM)
//   OpenAI    → openai.com/api/pricing                     (tier-based)
//   Anthropic → platform.claude.com/docs/en/about-claude/pricing
//   Gemini    → ai.google.dev/gemini-api/docs/pricing

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
  /**
   * True for providers/models with NO enforced daily limits.
   * Groq: no RPD enforcement (just RPM).
   * DeepSeek: zero rate limits of any kind.
   * Gemini/OpenAI/Anthropic: have hard daily/tier limits.
   */
  noDailyLimit?: boolean;
  /**
   * Actual output token price per 1M tokens (USD), sourced from live pricing pages.
   * Used for accurate cost scoring in the smart failover algorithm.
   * Examples: Groq Llama 8B = $0.08, GPT-5 mini = $2.00, Claude Opus 4.6 = $25.00
   */
  outputPricePerMTok: number;
  /**
   * 1–9 display cost tier derived from outputPricePerMTok — shown in UI badges.
   * 1 = ≤$0.50/M · 3 = ≤$2/M · 5 = ≤$10/M · 7 = ≤$25/M · 9 = >$50/M
   */
  costWeight: number;
  /**
   * True when the model has been officially deprecated or announced for shutdown.
   * Deprecated models receive a -400 pt penalty in scoring but remain selectable
   * as an absolute last resort so existing configs don't hard-break.
   */
  deprecated?: boolean;
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
  // ─────────────────────────────────────────────────────────────────────────
  // GOOGLE GEMINI
  // Pricing source: https://ai.google.dev/gemini-api/docs/pricing (Mar 2026)
  // Rate limits (free tier): 2.5 Pro: 5 RPM/100 RPD · 2.5 Flash: 10 RPM/250 RPD
  //                          2.5 Flash-Lite: 15 RPM/1000 RPD
  // Paid Tier 1: 150–300 RPM, 1,500 RPD
  // NOTE: gemini-2.0-flash and gemini-2.0-flash-lite are DEPRECATED (EOL Jun 1 2026)
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'gemini',
    name: 'Google Gemini',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    docsUrl: 'https://aistudio.google.com/apikey',
    models: [
      // nano tier — cheapest, high throughput
      {
        id: 'gemini-2.5-flash-lite',
        label: 'Gemini 2.5 Flash-Lite',
        notes: 'Cheapest Gemini — $0.10 in / $0.40 out per 1M',
        tier: 'nano', outputPricePerMTok: 0.40, costWeight: 1,
        recommended: false,
      },
      {
        id: 'gemini-2.0-flash-lite',
        label: 'Gemini 2.0 Flash-Lite (deprecated)',
        notes: '⚠ DEPRECATED — EOL Jun 1 2026. Migrate to 2.5 Flash-Lite',
        tier: 'nano', outputPricePerMTok: 0.30, costWeight: 1,
        deprecated: true,
      },
      // mid tier — balanced quality/cost
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        notes: 'Best current Gemini mid — $0.30 in / $2.50 out per 1M, 1M ctx',
        tier: 'mid', outputPricePerMTok: 2.50, costWeight: 3,
        recommended: true,
      },
      {
        id: 'gemini-3-flash-preview',
        label: 'Gemini 3 Flash Preview',
        notes: 'Next-gen Flash — $0.50 in / $3.00 out per 1M, superior search',
        tier: 'mid', outputPricePerMTok: 3.00, costWeight: 3,
      },
      {
        id: 'gemini-2.0-flash',
        label: 'Gemini 2.0 Flash (deprecated)',
        notes: '⚠ DEPRECATED — EOL Jun 1 2026. Migrate to 2.5 Flash',
        tier: 'mid', outputPricePerMTok: 0.40, costWeight: 2,
        deprecated: true,
      },
      // high tier — powerful reasoning
      {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        notes: 'Best reasoning Gemini — $1.25 in / $10.00 out per 1M, 1M ctx',
        tier: 'high', outputPricePerMTok: 10.00, costWeight: 5,
      },
      {
        id: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro Preview',
        notes: 'Latest gen Gemini Pro — $2.00 in / $12.00 out per 1M',
        tier: 'high', outputPricePerMTok: 12.00, costWeight: 6,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GROQ
  // Pricing source: https://groq.com/pricing (Mar 2026)
  // Rate limits: Groq enforces RPM/TPM but NO RPD limits.
  //              All Groq models are noDailyLimit: true.
  //              Free tier: ~30 RPM for most models. Paid: 100–1000 RPM.
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'groq',
    name: 'Groq',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    docsUrl: 'https://console.groq.com/keys',
    models: [
      // nano tier
      {
        id: 'llama-3.1-8b-instant',
        label: 'Llama 3.1 8B Instant',
        notes: 'Fastest Groq — $0.05 in / $0.08 out per 1M, 840 TPS',
        tier: 'nano', outputPricePerMTok: 0.08, costWeight: 1,
        noDailyLimit: true,
      },
      {
        id: 'meta-llama/llama-4-scout-17b-16e-instruct',
        label: 'Llama 4 Scout (17B×16E)',
        notes: 'New Llama 4 — $0.11 in / $0.34 out per 1M, 594 TPS',
        tier: 'nano', outputPricePerMTok: 0.34, costWeight: 1,
        noDailyLimit: true, recommended: true,
      },
      {
        id: 'openai/gpt-oss-20b',
        label: 'GPT-OSS 20B (on Groq)',
        notes: 'OpenAI OSS on Groq HW — $0.075 in / $0.30 out per 1M, 1000 TPS',
        tier: 'nano', outputPricePerMTok: 0.30, costWeight: 1,
        noDailyLimit: true,
      },
      // mid tier
      {
        id: 'compound-beta-mini',
        label: 'Compound Beta Mini',
        notes: 'Built-in web search · no daily limit · ideal for chatbot',
        tier: 'mid', outputPricePerMTok: 0.34, costWeight: 1,
        noDailyLimit: true,
      },
      {
        id: 'qwen/qwen3-32b',
        label: 'Qwen 3 32B',
        notes: 'Strong reasoning — $0.29 in / $0.59 out per 1M, 662 TPS',
        tier: 'mid', outputPricePerMTok: 0.59, costWeight: 2,
        noDailyLimit: true,
      },
      {
        id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        label: 'Llama 4 Maverick (17B×128E)',
        notes: 'New flagship mid — $0.20 in / $0.60 out per 1M, 562 TPS',
        tier: 'mid', outputPricePerMTok: 0.60, costWeight: 2,
        noDailyLimit: true, recommended: true,
      },
      {
        id: 'compound-beta',
        label: 'Compound Beta',
        notes: 'Built-in web search, full power · no daily limit',
        tier: 'mid', outputPricePerMTok: 0.60, costWeight: 2,
        noDailyLimit: true,
      },
      {
        id: 'openai/gpt-oss-120b',
        label: 'GPT-OSS 120B (on Groq)',
        notes: 'Large OSS on Groq HW — $0.15 in / $0.60 out per 1M, 500 TPS',
        tier: 'high', outputPricePerMTok: 0.60, costWeight: 2,
        noDailyLimit: true,
      },
      // high tier
      {
        id: 'llama-3.3-70b-versatile',
        label: 'Llama 3.3 70B Versatile',
        notes: 'Best OSS quality on Groq — $0.59 in / $0.79 out per 1M',
        tier: 'high', outputPricePerMTok: 0.79, costWeight: 2,
        noDailyLimit: true, recommended: true,
      },
      {
        id: 'moonshotai/kimi-k2-instruct-0905',
        label: 'Kimi K2 1T (256k ctx)',
        notes: 'Moonshot 1T MoE — $1.00 in / $3.00 out per 1M, 256k ctx',
        tier: 'high', outputPricePerMTok: 3.00, costWeight: 4,
        noDailyLimit: true,
      },
      // Legacy Groq models (kept for backwards compat — may be removed)
      {
        id: 'gemma2-9b-it',
        label: 'Gemma 2 9B (legacy)',
        notes: 'Legacy Groq model — check availability',
        tier: 'nano', outputPricePerMTok: 0.20, costWeight: 1,
        noDailyLimit: true, deprecated: true,
      },
      {
        id: 'mixtral-8x7b-32768',
        label: 'Mixtral 8x7B (legacy)',
        notes: 'Legacy Groq model — check availability',
        tier: 'mid', outputPricePerMTok: 0.27, costWeight: 1,
        noDailyLimit: true, deprecated: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // OPENAI / GPT
  // Pricing source: https://openai.com/api/pricing (Mar 2026 — via IntuitionLabs)
  // Rate limits: Tier-based (Free → Tier 5). Free = ~3 RPM. Tier 1+ = 500–5000 RPM.
  //              Has both RPM and TPM limits. No noDailyLimit — has monthly caps.
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'openai',
    name: 'OpenAI / GPT',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      // nano tier
      {
        id: 'gpt-5-nano',
        label: 'GPT-5 Nano',
        notes: 'Fastest OpenAI model — $0.05 in / $0.40 out per 1M',
        tier: 'nano', outputPricePerMTok: 0.40, costWeight: 1,
      },
      // mid tier
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        notes: 'Proven value pick — $0.15 in / $0.60 out per 1M',
        tier: 'mid', outputPricePerMTok: 0.60, costWeight: 2,
        recommended: true,
      },
      {
        id: 'gpt-5-mini',
        label: 'GPT-5 Mini',
        notes: 'New gen mid-tier — $0.25 in / $2.00 out per 1M',
        tier: 'mid', outputPricePerMTok: 2.00, costWeight: 3,
      },
      // high tier
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        notes: 'Proven high-tier — $2.50 in / $10.00 out per 1M',
        tier: 'high', outputPricePerMTok: 10.00, costWeight: 5,
      },
      {
        id: 'gpt-5',
        label: 'GPT-5',
        notes: 'New flagship — $1.25 in / $10.00 out per 1M',
        tier: 'high', outputPricePerMTok: 10.00, costWeight: 5,
        recommended: true,
      },
      {
        id: 'gpt-5.2',
        label: 'GPT-5.2',
        notes: 'Premium reasoning — $1.75 in / $14.00 out per 1M',
        tier: 'high', outputPricePerMTok: 14.00, costWeight: 6,
      },
      // Legacy models (still work, but old generation)
      {
        id: 'gpt-3.5-turbo',
        label: 'GPT-3.5 Turbo (legacy)',
        notes: 'Legacy — consider gpt-5-nano instead',
        tier: 'nano', outputPricePerMTok: 1.50, costWeight: 2,
        deprecated: true,
      },
      {
        id: 'gpt-4-turbo',
        label: 'GPT-4 Turbo (legacy)',
        notes: 'Legacy — consider gpt-4o or gpt-5 instead',
        tier: 'high', outputPricePerMTok: 30.00, costWeight: 8,
        deprecated: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ANTHROPIC (CLAUDE)
  // Pricing source: https://platform.claude.com/docs/en/about-claude/pricing (Mar 2026)
  // Rate limits: Tier 1–4 system. Has both RPM and TPM limits per tier.
  //              No noDailyLimit — strict per-tier enforcement.
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'anthropic',
    name: 'Anthropic (Claude)',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      // nano tier
      {
        id: 'claude-haiku-3',
        label: 'Claude Haiku 3',
        notes: 'Cheapest Claude — $0.25 in / $1.25 out per 1M',
        tier: 'nano', outputPricePerMTok: 1.25, costWeight: 2,
      },
      // mid tier
      {
        id: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        notes: 'Current recommended Haiku — $1.00 in / $5.00 out per 1M',
        tier: 'mid', outputPricePerMTok: 5.00, costWeight: 4,
        recommended: true,
      },
      // high tier
      {
        id: 'claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        notes: 'Current flagship mid — $3.00 in / $15.00 out per 1M',
        tier: 'high', outputPricePerMTok: 15.00, costWeight: 6,
        recommended: true,
      },
      {
        id: 'claude-opus-4-6',
        label: 'Claude Opus 4.6',
        notes: 'Most powerful Claude — $5.00 in / $25.00 out per 1M',
        tier: 'high', outputPricePerMTok: 25.00, costWeight: 7,
      },
      // Legacy 3.x / 3.5 models (kept for backwards compat)
      {
        id: 'claude-3-haiku-20240307',
        label: 'Claude 3 Haiku (legacy)',
        notes: 'Legacy — use Haiku 4.5 instead',
        tier: 'nano', outputPricePerMTok: 1.25, costWeight: 2,
        deprecated: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        label: 'Claude 3.5 Haiku (legacy)',
        notes: 'Legacy — $0.80 in / $4.00 out per 1M',
        tier: 'mid', outputPricePerMTok: 4.00, costWeight: 3,
        deprecated: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        label: 'Claude 3.5 Sonnet (legacy)',
        notes: 'Legacy — use Sonnet 4.6 instead',
        tier: 'high', outputPricePerMTok: 15.00, costWeight: 6,
        deprecated: true,
      },
      {
        id: 'claude-3-opus-20240229',
        label: 'Claude 3 Opus (legacy)',
        notes: 'Legacy — $15 in / $75 out per 1M. Use Opus 4.6 instead',
        tier: 'high', outputPricePerMTok: 75.00, costWeight: 9,
        deprecated: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DEEPSEEK
  // Pricing source: https://api-docs.deepseek.com/quick_start/pricing (Mar 2026)
  // Rate limits: NONE — DeepSeek explicitly states no rate limit enforcement.
  //              All models are noDailyLimit: true.
  // Pricing: $0.28/1M input (cache miss), $0.028 (cache hit), $0.42/1M output
  //          Both deepseek-chat and deepseek-reasoner share the same price.
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'deepseek',
    name: 'DeepSeek',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      {
        id: 'deepseek-chat',
        label: 'DeepSeek Chat (V3.2)',
        notes: 'No rate limits · $0.28 in / $0.42 out per 1M · 128k ctx',
        tier: 'mid', outputPricePerMTok: 0.42, costWeight: 1,
        noDailyLimit: true, recommended: true,
      },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner (V3.2)',
        notes: 'No rate limits · Chain-of-thought · $0.28 in / $0.42 out per 1M',
        tier: 'high', outputPricePerMTok: 0.42, costWeight: 1,
        noDailyLimit: true,
      },
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
  | 'study_prioritize'
  | 'qa_solve'       // Q&A: initial AI answer (may include image)
  | 'qa_followup';   // Q&A: follow-up clarification (text only)

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

  // ── Q&A features ───────────────────────────────────────────────────────────
  qa_solve: {
    label: 'Q&A AI Solve-mate',
    description: 'Initial AI answer for student Q&A — text + optional image (vision)',
    tier: 'advanced',
    minModelTier: 'mid',        // needs solid reasoning; vision when image attached
    preferNoDailyLimit: true,   // called for every AI solve click across all students
    tokenCost: 'medium',
  },
  qa_followup: {
    label: 'Q&A Follow-up',
    description: 'Follow-up clarification in Q&A — text only, lighter model ok',
    tier: 'basic',
    minModelTier: 'nano',
    preferNoDailyLimit: true,   // follow-ups can be frequent
    tokenCost: 'low',
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
  temp: number,
  imageBase64?: string,   // optional raw base64 image (no data: prefix)
  imageMimeType?: string  // e.g. 'image/jpeg', 'image/png', 'image/heic'
): Promise<{ text: string; tokens: number }> {
  const { provider, model, apiKey } = entry;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const parts: any[] = [{ text: prompt }];
    if (imageBase64 && imageMimeType) {
      parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
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
    const userContent: any = imageBase64 && imageMimeType
      ? [
          { type: 'image', source: { type: 'base64', media_type: imageMimeType, data: imageBase64 } },
          { type: 'text', text: prompt },
        ]
      : prompt;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: userContent }] }),
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

  // OpenAI-compatible vision: content array with image_url + text
  const msgContent: any = imageBase64 && imageMimeType
    ? [
        { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
        { type: 'text', text: prompt },
      ]
    : prompt;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: temp, messages: [{ role: 'user', content: msgContent }] }),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const d = await res.json();
  const text = d.choices?.[0]?.message?.content || '';
  const tokens = d.usage?.total_tokens || estimateTokens(prompt + text);
  return { text, tokens };
}

// ─── v2: Smart failover caller ────────────────────────────────────────────────

// ─── v2: Scoring constants (from live pricing pages) ─────────────────────────
// Sources reviewed March 10 2026:
//   DeepSeek:  api-docs.deepseek.com/quick_start/pricing  — no rate limits at all
//   Groq:      groq.com/pricing                           — no RPD, only RPM/TPM
//   OpenAI:    openai.com/api/pricing (via IntuitionLabs) — tier-based RPM+TPM
//   Anthropic: platform.claude.com/docs/en/about-claude/pricing — tier-based
//   Gemini:    ai.google.dev/gemini-api/docs/pricing      — strict free-tier RPD

/**
 * scoreKey — the intelligence layer.
 *
 * Scores a key 0–900+ (higher = better fit for this feature).
 * Deprecated models start at -400 (still considered, never preferred).
 *
 * ┌────────────────────────────┬──────────┬───────────────────────────────┐
 * │ Factor                     │ Points   │ Key insight                   │
 * ├────────────────────────────┼──────────┼───────────────────────────────┤
 * │ 1. Tier fit                │ 0–400    │ Quality match is #1 priority  │
 * │ 2. Rate-limit risk         │ 0–200    │ Groq/DeepSeek win high-freq   │
 * │ 3. Live availability       │ 0–150    │ RPM window vs. RPD hard cap   │
 * │ 4. Real cost               │ 0–150    │ Actual $/1M output tokens     │
 * │ 5. Reliability             │ −200–0   │ Penalise recent failures      │
 * │ 6. Deprecation             │ −400     │ Steer away from EOL models    │
 * │ 7. Admin priority          │ −50–0    │ Tiebreaker only               │
 * └────────────────────────────┴──────────┴───────────────────────────────┘
 *
 * Perfect score (no deprecated, no errors, priority 1):
 *   Tier(400) + RateRisk(200) + Avail(150) + Cost(150) = 900 pts
 */
function scoreKey(key: APIKeyEntry, featureMeta: AIFeatureMeta): number {
  const modelInfo = AI_PROVIDERS
    .flatMap(p => p.models)
    .find(m => m.id === key.model);

  const keyTier      = modelInfo?.tier              ?? 'mid';
  const noDailyLimit = modelInfo?.noDailyLimit       ?? false;
  const outputPrice  = modelInfo?.outputPricePerMTok ?? 5.0;
  const isDeprecated = modelInfo?.deprecated         ?? false;

  let score = 0;

  // ── 0. Deprecation pre-penalty ────────────────────────────────────────────
  // Applied first so deprecated models lose rank across ALL other factors.
  // They are NOT blocked — still used as absolute last resort.
  if (isDeprecated) score -= 400;

  // ── 1. Tier fit (0–400) ───────────────────────────────────────────────────
  // Perfect tier match = highest value. Over-spec wastes cost; under-spec hurts quality.
  const required = TIER_ORDER[featureMeta.minModelTier];
  const actual   = TIER_ORDER[keyTier];
  const diff = actual - required;

  if      (diff === 0)  score += 400; // perfect match — always first choice
  else if (diff === 1)  score += 220; // 1 tier over (e.g. mid for nano task) — acceptable
  else if (diff >= 2)   score += 100; // 2+ tiers over — significant waste, last resort
  else if (diff === -1) score += 50;  // 1 tier under — quality degraded but may work
  //  diff <= -2: 0 pts — very under-spec, only attempted if nothing else works

  // ── 2. Rate-limit risk (0–200) ────────────────────────────────────────────
  // Real-world insight: DeepSeek has ZERO rate limits. Groq has NO daily limits
  // (only RPM). Gemini/OpenAI/Anthropic have strict tier-based daily limits.
  // High-traffic features (chatbot, study_insights) must prefer no-daily-limit keys.
  if (featureMeta.preferNoDailyLimit) {
    // Feature gets called many times / day — prioritise keys that won't get exhausted
    score += noDailyLimit ? 200 : 0;
  } else {
    // Feature doesn't stress daily limits — neutral bonus so all keys compete fairly
    score += 100;
  }

  // ── 3. Live availability right now (0–150) ────────────────────────────────
  // Checks in-memory usage windows (reset every minute / midnight).
  const u      = getUsage(key.id);
  const overRPM = key.rpm > 0 && u.requestsThisMinute >= key.rpm;
  const overRPD = key.rpd > 0 && u.requestsToday      >= key.rpd;
  const overTPD = key.tpd > 0 && u.tokensToday        >= key.tpd;

  if (!overRPM && !overRPD && !overTPD) {
    score += 150;       // fully available — ideal
  } else if (overRPM && !overRPD && !overTPD) {
    score += 60;        // only RPM exceeded — recovers in < 60 s, still viable
  }
  // RPD or TPD exceeded → 0 pts. Key is effectively dead for the day.

  // ── 4. Real cost score (0–150) ────────────────────────────────────────────
  // Based on ACTUAL $/1M output tokens sourced from live pricing pages Mar 2026.
  // Groq models: $0.08–$0.79/M  |  DeepSeek: $0.42/M  |  OpenAI: $0.40–$14/M
  // Anthropic: $1.25–$75/M       |  Gemini:  $0.40–$12/M
  if      (outputPrice <= 0.50)  score += 150; // Groq all models, DeepSeek
  else if (outputPrice <= 2.00)  score += 120; // Groq Kimi K2, GPT-5 nano, Claude Haiku 3
  else if (outputPrice <= 5.00)  score += 85;  // GPT-5 mini, Claude Haiku 4.5, Gemini 2.5 Flash
  else if (outputPrice <= 15.00) score += 45;  // GPT-4o, GPT-5, Gemini 2.5 Pro, Claude Sonnet
  else if (outputPrice <= 30.00) score += 15;  // GPT-5.2 ($14), Claude Opus 4.6 ($25)
  else                            score += 5;   // Claude Opus 4.1 ($75), GPT-5.2 Pro ($168)

  // ── 5. Reliability (−200–0) ───────────────────────────────────────────────
  // Each recent error costs -40 pts. Caps at -200 so even flaky keys get tried
  // when everything else is exhausted.
  score -= Math.min(key.errorCount * 40, 200);

  // ── 6. Admin priority tiebreaker (−50–0) ─────────────────────────────────
  // Only influences outcome when two keys have identical scores on all other factors.
  // priority 1 = 0 penalty, priority 10 = -45 penalty.
  score -= Math.min(key.priority - 1, 9) * 5;

  return score;
}

export async function callWithFailover(
  prompt: string,
  featureId: AIFeatureId,
  maxTokens = 2048,
  temp = 0.7,
  imageBase64?: string,   // optional base64 image for vision features (e.g. qa_solve)
  imageMimeType?: string  // e.g. 'image/jpeg', 'image/png', 'image/heic'
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
      const { text, tokens } = await callProviderWithUsage(prompt, key, maxTokens, temp, imageBase64, imageMimeType);
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
