import { getQuranAyahs, getSurahList, getSurahMeta } from '../quranDataLoader';
import { normalizeText } from '../textNormalizer';

/**
 * ============================================================
 *  Verified Quran reference resolution.
 *
 *  Turns free Arabic text into an exact surah/ayah reference using ONLY the
 *  verified local mushaf (src/data/quran/quran.json) — never the tafsir text
 *  and never a guess. Two jobs:
 *    1. resolve a surah NAME → its number (Arabic name variants),
 *    2. resolve a quoted Quran PHRASE → the ayah(s) that contain it.
 *  If a phrase matches more than one distinct ayah, the caller is told it's
 *  ambiguous and must ask the user to disambiguate.
 * ============================================================
 */

/* ------------------------------------------------------------------ */
/* Surah name → number                                                 */
/* ------------------------------------------------------------------ */

let surahNameLookup: Map<string, number> | null = null;

/** normalized-name-variant → surah number (built once from the surah list). */
function ensureSurahNames(): Map<string, number> {
  if (surahNameLookup) return surahNameLookup;
  const map = new Map<string, number>();
  for (const s of getSurahList()) {
    // quran.json names look like «سُورَةُ ٱلْفَاتِحَةِ» → normalize + drop «سوره».
    let name = normalizeText(s.nameArabic).replace(/^سوره\s+/, '').trim();
    if (!name) continue;
    if (!map.has(name)) map.set(name, s.number);
    // Without the definite article: «الفاتحه» → «فاتحه».
    if (name.startsWith('ال') && name.length > 4) {
      const noArticle = name.slice(2);
      if (!map.has(noArticle)) map.set(noArticle, s.number);
    }
  }
  surahNameLookup = map;
  return map;
}

/** Longest surah-name variant contained in `normQuery`, or null. */
export function detectSurahNumber(normQuery: string): number | null {
  const map = ensureSurahNames();
  const padded = ` ${normQuery} `;
  let matched: number | null = null;
  let matchedLen = 0;
  for (const [variant, num] of map) {
    if (variant.length <= matchedLen) continue;
    if (padded.includes(` ${variant} `) || normQuery === variant) {
      matched = num;
      matchedLen = variant.length;
    }
  }
  return matched;
}

/** Display Arabic name for a surah number (without the «سورة» prefix), or null. */
export function surahDisplayName(surah: number): string | null {
  const meta = getSurahMeta(surah);
  if (!meta) return null;
  return meta.nameArabic.replace(/^سُورَةُ?\s+/, '').replace(/^سورة\s+/, '').trim();
}

/** Number of ayahs in a surah (from the verified mushaf), or null. */
export function surahAyahCount(surah: number): number | null {
  return getSurahMeta(surah)?.ayahCount ?? null;
}

/* ------------------------------------------------------------------ */
/* Quran phrase → ayah(s)                                              */
/* ------------------------------------------------------------------ */

interface PhraseIndexEntry {
  surah: number;
  ayah: number;
  norm: string;
}

let phraseIndex: PhraseIndexEntry[] | null = null;

function ensurePhraseIndex(): PhraseIndexEntry[] {
  if (phraseIndex) return phraseIndex;
  phraseIndex = getQuranAyahs().map((a) => ({
    surah: a.surahNumber,
    ayah: a.ayahNumber,
    // Re-normalize the canonical Uthmani text so it matches user input that
    // was passed through the same normalizeText() pipeline.
    norm: normalizeText(a.textUthmani),
  }));
  return phraseIndex;
}

export interface PhraseMatch {
  surah: number;
  ayah: number;
}

export interface PhraseResolution {
  /** All ayahs whose text contains the phrase (capped). */
  matches: PhraseMatch[];
  /** True when the phrase spans/duplicates across more than one distinct ayah. */
  ambiguous: boolean;
}

const MAX_PHRASE_MATCHES = 12;

/**
 * Resolves a Quran phrase (already normalized) to the ayah(s) that contain
 * it. `ambiguous` is true when more than one distinct ayah matches, so the
 * caller can ask the user to name the surah/ayah instead of picking one.
 */
export function resolveQuranPhrase(normPhrase: string): PhraseResolution {
  const phrase = normPhrase.trim();
  if (phrase.length < 3) return { matches: [], ambiguous: false };

  const index = ensurePhraseIndex();
  const matches: PhraseMatch[] = [];
  for (const e of index) {
    if (e.norm.includes(phrase)) {
      matches.push({ surah: e.surah, ayah: e.ayah });
      if (matches.length >= MAX_PHRASE_MATCHES) break;
    }
  }
  return { matches, ambiguous: matches.length > 1 };
}
