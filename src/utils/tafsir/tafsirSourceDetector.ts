import type { TafsirSourceId } from '../../types/data.types';
import { normalizeText } from '../textNormalizer';
import { ALL_TAFSIR_SOURCE_IDS, normalizeSourceList } from '../tafsirSources';

/**
 * ============================================================
 *  Tafsir source & comparison detection.
 *
 *  Recognizes, in a normalized Arabic query, WHICH tafsir source(s) the
 *  user named and WHETHER they asked to compare them. Purely lexical — it
 *  never touches the datasets and never decides an answer. Detection order
 *  is longest-alias-first so «تفسير ابن كثير» is matched as Ibn Kathir, not
 *  as a bare mention that could collide with anything else.
 * ============================================================
 */

/** Aliases per source (raw Arabic; normalized once below). */
const SOURCE_ALIASES: Record<TafsirSourceId, string[]> = {
  al_saadi: ['تفسير السعدي', 'تيسير الكريم الرحمن', 'السعدي', 'السعدى'],
  ibn_kathir: ['تفسير ابن كثير', 'ابن كثير', 'ابن‌كثير', 'ابنكثير', 'ابن كثيّر'],
  al_tabari: ['تفسير الطبري', 'جامع البيان', 'الطبري', 'الطبرى'],
};

/** Phrases that mean "all three sources". */
const ALL_SOURCES_ALIASES = [
  'جميع التفاسير',
  'التفاسير الثلاثة',
  'كل التفاسير',
  'الثلاثة',
  'ماذا قال المفسرون',
  'اقوال المفسرين',
  'كل المفسرين',
];

/** Comparison trigger phrases. */
const COMPARE_ALIASES = [
  'قارن',
  'مقارنه',
  'ما الفرق',
  'الفرق بين',
  'اوجه الاتفاق',
  'اوجه الاختلاف',
  'ماذا قال كل مفسر',
  'قال كل مفسر',
  'بين الطبري والسعدي',
  'بين ابن كثير والطبري',
  'بين السعدي وابن كثير',
  'التفاسير الثلاثه',
];

/** Summary / simplification trigger phrases. */
const SUMMARY_ALIASES = ['لخص', 'ملخص', 'باختصار', 'اختصر', 'اختصرها', 'مختصر'];
const SIMPLIFY_ALIASES = ['بسط', 'بسّط', 'ابسط', 'وضح', 'بشكل مبسط', 'بطريقه سهله', 'سهله'];

const normList = (arr: string[]) => arr.map(normalizeText).filter(Boolean);

const NORM_SOURCE_ALIASES: { id: TafsirSourceId; alias: string }[] = (
  Object.keys(SOURCE_ALIASES) as TafsirSourceId[]
)
  .flatMap((id) => SOURCE_ALIASES[id].map((a) => ({ id, alias: normalizeText(a) })))
  .filter((e) => e.alias.length > 0)
  // longest alias first so "تفسير ابن كثير" wins over "ابن كثير"
  .sort((a, b) => b.alias.length - a.alias.length);

const NORM_ALL_ALIASES = normList(ALL_SOURCES_ALIASES);
const NORM_COMPARE_ALIASES = normList(COMPARE_ALIASES);
const NORM_SUMMARY_ALIASES = normList(SUMMARY_ALIASES);
const NORM_SIMPLIFY_ALIASES = normList(SIMPLIFY_ALIASES);

function includesPhrase(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function anyPhrase(haystack: string, needles: string[]): boolean {
  return needles.some((n) => includesPhrase(haystack, n));
}

export interface DetectedSources {
  /** Explicitly named sources, in canonical order (empty if none named). */
  sources: TafsirSourceId[];
  /** True when the user asked for "all"/"the three tafsirs". */
  all: boolean;
}

/**
 * Which tafsir source(s) the query explicitly names. Returns all three when
 * an "all sources" phrase is present. Empty `sources` means the caller should
 * fall back to the UI selection (or all three) — never a silent single guess.
 */
export function detectRequestedSources(normQuery: string): DetectedSources {
  if (anyPhrase(normQuery, NORM_ALL_ALIASES)) {
    return { sources: [...ALL_TAFSIR_SOURCE_IDS], all: true };
  }

  const found = new Set<TafsirSourceId>();
  // Consume matched aliases so a longer alias's leftover doesn't double-count.
  // Allow an optional leading «و» (the Arabic "and" is glued to the next word,
  // e.g. «الطبري والسعدي»), and match on word boundaries otherwise.
  let scan = ` ${normQuery} `;
  for (const { id, alias } of NORM_SOURCE_ALIASES) {
    const re = new RegExp(`(^|\\s)و?${escapeRegExp(alias)}(\\s|$)`);
    if (re.test(scan)) {
      found.add(id);
      scan = scan.replace(re, '  ');
    }
  }

  // "التفاسير الثلاثة" style also implies all, even without the exact "all" alias.
  if (found.size === 0 && includesPhrase(normQuery, normalizeText('الثلاثة'))) {
    return { sources: [...ALL_TAFSIR_SOURCE_IDS], all: true };
  }

  return { sources: normalizeSourceList([...found]), all: false };
}

/** True when the query asks to compare tafsir sources. */
export function detectComparison(normQuery: string): boolean {
  if (anyPhrase(normQuery, NORM_COMPARE_ALIASES)) return true;
  // "بين X و Y" with two named sources is also a comparison.
  const named = detectRequestedSources(normQuery);
  if (named.sources.length >= 2 && includesPhrase(normQuery, normalizeText('بين'))) {
    return true;
  }
  return false;
}

export function detectSummaryRequest(normQuery: string): boolean {
  return anyPhrase(normQuery, NORM_SUMMARY_ALIASES);
}

export function detectSimplificationRequest(normQuery: string): boolean {
  return anyPhrase(normQuery, NORM_SIMPLIFY_ALIASES);
}
