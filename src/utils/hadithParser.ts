import {
  HADITH_PAGE_SIZE,
  type HadithGradeCategory,
  type HadithPage,
  type HadithResult,
} from '../types/hadith.types';
import { normalizeText } from './textNormalizer';

/**
 * Parses the Dorar (الدرر السنية) HTML blob into structured hadith records.
 *
 * Pure and deterministic — no network, no clock, no React — so it can be
 * exercised against captured fixtures, the same way prayerTimeUtils.ts is.
 *
 * Shape of the payload (verified live against the real endpoint):
 *
 *   <head><link rel="canonical" …></head>
 *   <div class="hadith">1 -  matn … <span class="search-keys">term</span> …</div>
 *   <div class="hadith-info">
 *       <span class="info-subtitle">الراوي:</span> فلان</span>      ← stray close tag
 *       <span class="info-subtitle">المحدث:</span> فلان
 *       <span class="info-subtitle">المصدر:</span> كتاب
 *       <span class="info-subtitle">الصفحة أو الرقم:</span> 2/25
 *       <span class="info-subtitle">خلاصة حكم المحدث:</span> <span>صحيح</span>
 *   </div>
 *   --------------
 *   …
 *   <a href="…">المزيد</a>          ← trailing "more" link, not a result
 */

/* ------------------------------------------------------------------ */
/* HTML helpers                                                        */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : '';
    });
}

/** Strips tags, decodes entities, drops invisible marks, collapses whitespace. */
function toPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    // LRM/RLM and other zero-width marks Dorar sometimes leaves in the matn.
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reads the value that follows an `info-subtitle` label, up to the next label. */
function readInfoField(infoHtml: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<span[^>]*class="info-subtitle"[^>]*>\\s*${escaped}\\s*:?\\s*</span>([\\s\\S]*?)(?=<span[^>]*class="info-subtitle"|$)`,
  );
  const match = infoHtml.match(re);
  if (!match) return undefined;
  const value = toPlainText(match[1]);
  // Dorar uses a bare "-" when the narrator is unknown.
  if (!value || value === '-' || value === '–') return undefined;
  return value;
}

/* ------------------------------------------------------------------ */
/* Grade classification                                                */
/* ------------------------------------------------------------------ */

/**
 * Order matters and is deliberately weak-first: a ruling like "إسناده ضعيف"
 * mentions both a chain and a weakness, and must never be read as authentic.
 * Anything unrecognised stays `unknown` rather than being guessed upward —
 * calling a weak hadith authentic is the one failure mode worth engineering
 * against.
 */

/** Multi-word rulings, matched against normalized text. */
const WEAK_PHRASES = [
  'لا اصل له',
  'لا يثبت',
  'لا يصح',
  'ليس بصحيح',
  'غير صحيح',
  'لم اره',
  'لم اجده',
  'بلا اسناد',
  'لا اسناد',
  'لم يصح',
];

/** Single tokens (definite article tolerated on the chain side only). */
const WEAK_TOKENS = new Set([
  'ضعيف',
  'ضعيفه',
  'ضعيفا',
  'باطل',
  'موضوع',
  'موضوعه',
  'مكذوب',
  'منكر',
  'منكره',
  'متروك',
  'شاذ',
  'وهم',
  'خطا',
  'اخطا',
  'واهي',
  'مضطرب',
]);

const AUTHENTIC_PHRASES = ['مجمع علي صحته', 'مشهور بالصحه', 'علي شرط', 'متفق عليه'];

const AUTHENTIC_TOKENS = new Set([
  'صحيح',
  'صحيحه',
  'صحاح',
  'ثابت',
  'ثابته',
  'ثبت',
  'حسن',
  'حسنه',
  'صحته',
  'بالصحه',
]);

/** Words that signal the ruling is about the chain rather than the text. */
const CHAIN_MARKERS = ['اسناد', 'رجاله', 'رجال'];

/** Positive words accepted for a chain ruling (definite article tolerated). */
const CHAIN_POSITIVE = new Set(['صحيح', 'صحيحه', 'حسن', 'حسنه', 'جيد', 'جيده', 'ثقات', 'قوي']);

function tokensOf(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean);
}

/** Drops a leading definite article so "الصحيح" can match "صحيح". */
function stripArticle(token: string): string {
  return token.startsWith('ال') && token.length > 3 ? token.slice(2) : token;
}

export function classifyGrade(gradeText: string | undefined): HadithGradeCategory {
  if (!gradeText) return 'unknown';
  const normalized = normalizeText(gradeText);
  if (!normalized) return 'unknown';
  const tokens = tokensOf(normalized);

  // 1. Weakness wins outright.
  if (WEAK_PHRASES.some((p) => normalized.includes(p))) return 'weak';
  if (tokens.some((tk) => WEAK_TOKENS.has(tk))) return 'weak';

  // 2. Chain-level ruling: a chain marker plus a positive word.
  const mentionsChain = CHAIN_MARKERS.some((m) => normalized.includes(m));
  if (mentionsChain && tokens.some((tk) => CHAIN_POSITIVE.has(stripArticle(tk)))) {
    return 'chain';
  }

  // 3. Authentic — exact tokens only, so names like "الحسن" don't promote a
  //    ruling that never actually graded the text.
  if (AUTHENTIC_PHRASES.some((p) => normalized.includes(p))) return 'authentic';
  if (tokens.some((tk) => AUTHENTIC_TOKENS.has(tk))) return 'authentic';

  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const SEPARATOR = '--------------';

const LABELS = {
  narrator: 'الراوي',
  muhaddith: 'المحدث',
  source: 'المصدر',
  pageOrNumber: 'الصفحة أو الرقم',
  grade: 'خلاصة حكم المحدث',
} as const;

/**
 * Parses one page of results. Returns [] for the empty-result payload
 * (which contains only the canonical <head> and a "المزيد" link) and never
 * throws on malformed input.
 */
export function parseDorarResult(html: unknown, page = 1): HadithResult[] {
  if (typeof html !== 'string' || !html.trim()) return [];

  // Drop the canonical <head> block Dorar prefixes to every response.
  const body = html.replace(/<head>[\s\S]*?<\/head>/i, '');

  const results: HadithResult[] = [];
  const blocks = body.split(SEPARATOR);

  blocks.forEach((block, index) => {
    const matnMatch = block.match(/<div[^>]*class="hadith"[^>]*>([\s\S]*?)<\/div>/i);
    // The trailing block holds only the "المزيد" link — no matn, so skip it.
    if (!matnMatch) return;

    const matnHtml = matnMatch[1];
    const highlights = [...matnHtml.matchAll(/<span[^>]*class="search-keys"[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((m) => toPlainText(m[1]))
      .filter(Boolean);

    // Strip the leading ordinal ("1 - ") Dorar prints per page.
    const matn = toPlainText(matnHtml).replace(/^\d+\s*-\s*/, '').trim();
    if (!matn) return;

    const infoMatch = block.match(/<div[^>]*class="hadith-info"[^>]*>([\s\S]*?)<\/div>/i);
    const infoHtml = infoMatch ? infoMatch[1] : '';

    const gradeText = readInfoField(infoHtml, LABELS.grade);

    results.push({
      id: `${page}:${index}`,
      matn,
      highlights: [...new Set(highlights)],
      narrator: readInfoField(infoHtml, LABELS.narrator),
      muhaddith: readInfoField(infoHtml, LABELS.muhaddith),
      source: readInfoField(infoHtml, LABELS.source),
      pageOrNumber: readInfoField(infoHtml, LABELS.pageOrNumber),
      gradeText,
      gradeCategory: classifyGrade(gradeText),
    });
  });

  return results;
}

/** Parses a full response payload into a page, inferring whether more exist. */
export function parseDorarPage(html: unknown, page = 1): HadithPage {
  const results = parseDorarResult(html, page);
  return {
    results,
    hasMore: results.length >= HADITH_PAGE_SIZE,
    fetchedAt: Date.now(),
  };
}

/**
 * Splits a matn into segments so matched terms can be highlighted, mirroring
 * how app/(tabs)/search.tsx highlights Quran matches.
 */
export function splitHighlights(
  matn: string,
  highlights: string[],
): { text: string; match: boolean }[] {
  const terms = [...new Set(highlights.filter((h) => h.trim().length > 1))];
  if (terms.length === 0) return [{ text: matn, match: false }];

  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);

  const segments: { text: string; match: boolean }[] = [];
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(matn)) !== null) {
    if (m.index > cursor) segments.push({ text: matn.slice(cursor, m.index), match: false });
    segments.push({ text: m[0], match: true });
    cursor = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1; // guard against zero-width loops
  }
  if (cursor < matn.length) segments.push({ text: matn.slice(cursor), match: false });
  return segments.length > 0 ? segments : [{ text: matn, match: false }];
}
