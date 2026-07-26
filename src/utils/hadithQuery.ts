import { containsArabic, normalizeText } from './textNormalizer';
import type { QuestionIntent } from '../types/intent.types';

/**
 * ============================================================
 *  Turns a chat question into the keyword query sent to Dorar.
 *
 *  Dorar ranks a hadith by how many of the query's words it contains,
 *  so question scaffolding actively hurts. Verified live against the
 *  endpoint: «ما فضل صلاة الفجر؟» and «فضل صلاة الفجر» share only 5 of
 *  their 15 results, because «ما» comes back highlighted as a matched
 *  term in its own right. Stripping the scaffolding leaves the words
 *  that actually carry the question's topic.
 *
 *  Pure and deterministic — no network, no dataset — exactly like
 *  hadithParser.ts and prayerTimeUtils.ts, so it can be checked offline.
 * ============================================================
 */

/** How many of Dorar's 15 results the assistant shows inline. */
export const ASSISTANT_HADITH_COUNT = 3;

/** Beyond this, extra words dilute Dorar's ranking without adding precision. */
const MAX_TERMS = 6;

/** Below this, the query matches almost anything — not worth a request. */
const MIN_QUERY_CHARS = 3;

/* ------------------------------------------------------------------ */
/* Stopwords                                                           */
/*                                                                     */
/* All compared against normalizeText() output, so tashkeel is already */
/* gone and أ/إ/آ/ٱ→ا, ة→ه, ى→ي. The lists below are written in their  */
/* natural spelling and normalized at module load, the same way        */
/* intentDetector.ts handles FATWA_TRIGGERS.                           */
/* ------------------------------------------------------------------ */

/** Question openers — «ما فضل…», «هل ورد…», «كيف كان…». */
const INTERROGATIVES = [
  'ما', 'ماذا', 'من', 'متى', 'أين', 'كيف', 'لماذا', 'هل', 'أي', 'أية', 'ايش', 'وش', 'كم',
  'what', 'which', 'who', 'when', 'where', 'how', 'why', 'is', 'are', 'was', 'were',
  'do', 'does', 'did', 'can', 'could', 'any',
];

/** «أعطني…», «اذكر لي…», «ابحث عن…» — the ask, not the topic. */
const REQUEST_WORDS = [
  'أعطني', 'اعطني', 'هات', 'اذكر', 'أذكر', 'أريد', 'اريد', 'ابحث', 'ابغى', 'ممكن',
  'أخبرني', 'اخبرني', 'قل', 'وضح', 'عايز', 'أبي', 'ابي', 'بدي', 'اشرح', 'فسر',
  'شرح', 'تفسير', 'معنى', 'أعرف', 'اعرف', 'رجاء', 'لو', 'سمحت',
  'tell', 'give', 'show', 'find', 'search', 'explain', 'me', 'my', 'please', 'want', 'know',
];

/**
 * Words that name the *thing being asked for* rather than its subject.
 * «حديث عن الصبر» must reach Dorar as «الصبر» — leaving «حديث» in would
 * rank hadith whose matn literally contains the word "حديث" (observed:
 * «هل ورد حديث في فضل يوم الجمعة» surfaced narrations *about* a hadith).
 */
const HADITH_META = [
  'حديث', 'حديثا', 'أحاديث', 'احاديث', 'الحديث', 'الأحاديث', 'الاحاديث',
  'الحديثية', 'الموسوعة', 'سنة', 'السنة', 'نبوي', 'نبوية', 'النبوية',
  'شريف', 'الشريف', 'ورد', 'وردت', 'يوجد', 'توجد', 'هناك',
  'يتحدث', 'تتحدث', 'يتكلم', 'يخص', 'بخصوص', 'حول',
  'hadith', 'hadiths', 'ahadith', 'sunnah', 'narration', 'narrations',
  // Quran container words: «أعطني آيات عن الصبر» is about الصبر, and asking
  // Dorar for "آيات الصبر" ranks narrations that happen to say "آيات".
  // القرآن itself is deliberately NOT here — «فضل القرآن» is a real hadith
  // topic, not scaffolding.
  'آية', 'آيات', 'الآية', 'الآيات', 'اية', 'ايات', 'سورة', 'السورة',
  'ayah', 'ayat', 'verse', 'verses', 'surah', 'surat',
];

/** High-frequency glue that appears in nearly every hadith — no discriminating power. */
const FUNCTION_WORDS = [
  'عن', 'في', 'على', 'من', 'إلى', 'الى', 'مع', 'عند', 'بين', 'بعد', 'قبل',
  'أن', 'ان', 'إن', 'أنه', 'انه', 'التي', 'الذي', 'اللي', 'هو', 'هي', 'هم',
  'هذا', 'هذه', 'ذلك', 'تلك', 'هنا', 'و', 'أو', 'او', 'ثم', 'قد', 'كان', 'يكون',
  'له', 'لها', 'لك', 'لي', 'به', 'بها', 'كل',
  'the', 'a', 'an', 'about', 'of', 'on', 'in', 'for', 'to', 'and', 'or', 'that', 'this',
];

const STOPWORDS = new Set(
  [...INTERROGATIVES, ...REQUEST_WORDS, ...HADITH_META, ...FUNCTION_WORDS].map(normalizeText),
);

/**
 * Splits on whitespace and punctuation only — Arabic diacritics stay
 * inside their word, so a user pasting a vocalised matn keeps it intact.
 */
const SPLIT_RE = /[\s.,;:!؟?،؛"'“”«»()[\]{}<>/\\|*+~^%$#@&_=–—…-]+/;

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Extracts the topic keywords worth sending to Dorar, or null when the
 * question has nothing searchable left (pure scaffolding like «هل يوجد
 * حديث؟», or a Latin-only query — Dorar indexes Arabic only).
 */
export function buildHadithQuery(raw: string): string | null {
  if (!raw) return null;

  const kept: string[] = [];
  for (const token of raw.split(SPLIT_RE)) {
    if (!token) continue;
    const norm = normalizeText(token);
    // A bare "ال" or a stray single letter carries no search signal.
    if (norm.length < 2 || STOPWORDS.has(norm)) continue;
    kept.push(token);
    if (kept.length === MAX_TERMS) break;
  }

  if (kept.length === 0) return null;

  const query = kept.join(' ');
  // Dorar is an Arabic corpus: a Latin-only query can never match.
  if (!containsArabic(query)) return null;
  if (normalizeText(query).length < MIN_QUERY_CHARS) return null;

  return query;
}

/**
 * Analytical / statistical Quran-data intents. These are answered EXCLUSIVELY
 * by the Quran analytics system — a count, a comparison, a superlative, a
 * first/last occurrence or a word location must never pull in hadith results,
 * even though a topic word (e.g. «الصبر») exists in both corpora.
 */
export function isQuranAnalyticsIntent(intent: QuestionIntent): boolean {
  return intent === 'QURAN_STATS' || intent === 'WORD_LOCATION';
}

/**
 * Whether a question should trigger a hadith lookup at all.
 *
 * Ruling questions are excluded: the app answers those with a referral to
 * scholars, and attaching narrations would read as evidence for a ruling it is
 * refusing to give. Analytical Quran questions are excluded because they are
 * answered only from the Quran analytics system — mixing in hadith would turn a
 * statistic into a general Islamic answer (§1).
 */
export function shouldSearchHadith(intent: QuestionIntent): boolean {
  if (intent === 'FATWA_SAFETY' || intent === 'UNKNOWN') return false;
  if (isQuranAnalyticsIntent(intent)) return false;
  return true;
}
