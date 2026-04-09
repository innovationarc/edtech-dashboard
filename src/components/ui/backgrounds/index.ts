// src/components/ui/backgrounds/index.ts
//
// ── How to add a new background ──────────────────────────────────────────────
// 1. Convert your image using the bg-converter.html tool
// 2. Drop the output .txt.json file into this folder
// 3. Done — it's automatically picked up, no code changes needed
// ─────────────────────────────────────────────────────────────────────────────

export interface BgEntry {
  id: string;
  name: string;
  bgPosition?: string;
  data: string; // full data URL: "data:image/webp;base64,..."
}

// Auto-import every .txt.json file in this folder
const modules = import.meta.glob<BgEntry>('./*.txt.json', {
  eager: true,
  import: 'default',
});

export const BG_CATALOG: BgEntry[] = Object.values(modules);
