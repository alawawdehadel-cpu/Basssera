import type { AnswerReference, TafseerGroup } from '../types/data.types';
import type { AppLanguage, MessageStats } from '../types/chat.types';
import { normalizeText, stripTashkeel } from './textNormalizer';
import { withAyahMarker } from './numerals';
import {
  getQuranAyahs,
  getQuranValidation,
  getSurahList,
} from './quranDataLoader';

/**
 * ============================================================
 *  Quran text analytics — answers counting/locating/comparison
 *  questions such as «كم مرة ذكرت كلمة الله», «أين وردت كلمة
 *  الصبر» or «ما أطول آية في القرآن؟» by scanning the mushaf
 *  text bundled in the local dataset. Pure computation over
 *  local data, never generated knowledge; every answer states
 *  its counting rule and carries a methodology note, because
 *  published Quran-statistics references differ by counting
 *  method, and figures/verses are never fabricated.
 * ============================================================
 */

export interface AnalyticsEntry {
  group: TafseerGroup;
  /** ayah_text run through normalizeText (tashkeel stripped, alef unified…) */
  normAyahText: string;
}

/** Resolve a normalized candidate name to a surah number, or null. */
export type SurahLookup = (normName: string) => number | null;

export type AnalyticsOutcome =
  | {
      kind: 'answer';
      title: string;
      answer: string;
      note: string;
      stats?: MessageStats;
      references?: AnswerReference[];
    }
  | { kind: 'clarify'; answer: string }
  | null;

/* ------------------------------------------------------------------ */
/* Vocabulary (all keys are in normalizeText space: ة→ه, أإآٱ→ا, …)     */
/* ------------------------------------------------------------------ */

const AR_TRIGGER = /(^|\s)كم(\s|$)/;
const EN_TRIGGER = /(^|\s)(how many|count|number of)(\s|$)/;

/** «أين وردت كلمة …», «اعرض الآيات التي فيها كلمة …» */
const LOCATION_TRIGGER = /(^|\s)اين(\s|$)|اعرض\s+الايات|فيها\s+كلمه|which ayahs|where.*mentioned|show.*verses/;

/** «أول موضع ذكرت فيه …», «آخر موضع ذكرت فيه …» */
const FIRST_LAST_TRIGGER = /(اول|اخر)\s*(موضع|مره)|first occurrence|last occurrence|first time|last time/;

/** «ما أطول آية؟», «ما أقصر سورة؟», «أكبر/أصغر سورة», «أكثر السور آياتٍ» */
const SUPERLATIVE_TRIGGER =
  /اطول|اقصر|اكبر|اصغر|اكثر|اقل|longest|shortest|largest|smallest|most|least|(^|\s)تحتوي\s+اكبر/;

/** «أيهما أكثر ذكرًا: … أم …», «قارن بين ذكر … و…» */
const COMPARISON_TRIGGER =
  /ايهما اكثر|ايهما اقل|قارن|مقارنه|الفرق بين|compare|comparison|which is more|which is less/;

/** Explicit request to include the matching ayahs, not only a count. */
const WANTS_DETAILS_RE = /مع\s*الايات|اعرض\s*الايات|مع\s*النص|with (the )?verses|show (the )?ayahs/;

const DATA_UNAVAILABLE_AR =
  'لا يمكن حساب هذه المعلومة بدقة لأن بيانات القرآن الكاملة غير متوفرة داخل التطبيق.';
const DATA_UNAVAILABLE_EN =
  'This cannot be calculated accurately because the complete Quran data is not available in the app.';

/** Generic words that carry no target information. */
const BASIC_FILLERS = new Set([
  'كم', 'في', 'من', 'القران', 'الكريم', 'المصحف', 'النص', 'كله', 'كاملا',
  'كامل', 'هل', 'يوجد', 'توجد', 'هناك', 'ما', 'التي', 'الذي', 'هو', 'هي',
  'how', 'many', 'much', 'count', 'number', 'total', 'the', 'in', 'is',
  'are', 'there', 'of', 'all', 'whole', 'entire', 'quran', 'koran',
]);

/** Words that introduce a word-count question but are not the target. */
const COUNT_FILLERS = new Set([
  'مره', 'مرات', 'المرات', 'عدد', 'ذكرت', 'ذكر', 'ذكرها', 'وردت', 'ورد',
  'جاءت', 'جاء', 'تكررت', 'تكرر', 'كلمه', 'الكلمه', 'لفظ', 'اللفظ', 'اسم',
  'times', 'time', 'word', 'words', 'mentioned', 'mention', 'mentions',
  'appear', 'appears', 'appeared', 'occurrence', 'occurrences', 'repeated',
  'does', 'do', 'did', 'was', 'were', 'it',
]);

/** Extra structural words used by location / first-last phrasing. */
const LOCATION_FILLERS = new Set(
  [
    'اين', 'التي', 'فيها', 'فيه', 'به', 'اعرض', 'الايات', 'ايات', 'موضع', 'مواضع',
    'اول', 'اخر', 'الاولى', 'الاخيره', 'مع', 'النص',
    'show', 'where', 'which', 'contains', 'first', 'last', 'place',
    'position', 'positions', 'ayahs', 'verses', 'occurrence',
  ].map(normalizeText),
);

/** Well-known synonyms that are safe, purely lexical substitutions. */
const WORD_ALIASES: Record<string, string> = {
  'الجلاله': 'الله', // لفظ الجلالة
};

interface CountableChars {
  chars: string[];
  labelAr: string;
  labelEn: string;
  /** How the counted glyphs are described inside the answer. */
  ruleAr: string;
  ruleEn: string;
}

/** Diacritic-name → codepoints (keys normalized; sukun has two glyphs). */
const DIACRITICS: Record<string, CountableChars> = {
  'شده': {
    chars: ['ّ'],
    labelAr: 'الشدّة', labelEn: 'shadda',
    ruleAr: 'علامة الشدّة (ّ)', ruleEn: 'the shadda mark (ّ)',
  },
  'فتحه': {
    chars: ['َ'],
    labelAr: 'الفتحة', labelEn: 'fatha',
    ruleAr: 'علامة الفتحة (َ)', ruleEn: 'the fatha mark (َ)',
  },
  'ضمه': {
    chars: ['ُ'],
    labelAr: 'الضمة', labelEn: 'damma',
    ruleAr: 'علامة الضمة (ُ)', ruleEn: 'the damma mark (ُ)',
  },
  'كسره': {
    chars: ['ِ'],
    labelAr: 'الكسرة', labelEn: 'kasra',
    ruleAr: 'علامة الكسرة (ِ)', ruleEn: 'the kasra mark (ِ)',
  },
  'سكون': {
    chars: ['ْ', 'ۡ'],
    labelAr: 'السكون', labelEn: 'sukun',
    ruleAr: 'علامة السكون برسمَيها (ْ / ۡ)',
    ruleEn: 'the sukun mark in both of its glyph forms (ْ / ۡ)',
  },
  'تنوين': {
    chars: ['ً', 'ٌ', 'ٍ'],
    labelAr: 'التنوين', labelEn: 'tanween',
    ruleAr: 'التنوين بأنواعه الثلاثة (ً ٌ ٍ)',
    ruleEn: 'all three tanween marks (ً ٌ ٍ)',
  },
  'مده': {
    chars: ['ٓ'],
    labelAr: 'المدّة', labelEn: 'maddah',
    ruleAr: 'علامة المدّة (ٓ)', ruleEn: 'the maddah mark (ٓ)',
  },
  'همزه': {
    chars: ['ء', 'أ', 'ؤ', 'إ', 'ئ'],
    labelAr: 'الهمزة', labelEn: 'hamza',
    ruleAr: 'الهمزة بجميع صورها (ء أ ؤ إ ئ)',
    ruleEn: 'hamza in all of its written forms (ء أ ؤ إ ئ)',
  },
};

const DIACRITIC_EN_KEYS: Record<string, string> = {
  shadda: 'شده', shaddah: 'شده', shaddas: 'شده',
  fatha: 'فتحه', fathah: 'فتحه',
  damma: 'ضمه', dammah: 'ضمه',
  kasra: 'كسره', kasrah: 'كسره',
  sukun: 'سكون', sukoon: 'سكون',
  tanween: 'تنوين', tanwin: 'تنوين',
  maddah: 'مده', madda: 'مده',
  hamza: 'همزه', hamzah: 'همزه',
};

/** Letter-name → glyphs counted in the raw mushaf text. */
const LETTERS: Record<string, CountableChars> = {
  'الف': {
    chars: ['ا', 'أ', 'إ', 'آ', 'ٱ'],
    labelAr: 'الألف', labelEn: 'alif',
    ruleAr: 'حرف الألف بجميع صوره (ا أ إ آ ٱ)',
    ruleEn: 'the letter alif in all of its forms (ا أ إ آ ٱ)',
  },
  'همزه': {
    chars: ['ء', 'أ', 'ؤ', 'إ', 'ئ'],
    labelAr: 'الهمزة', labelEn: 'hamza',
    ruleAr: 'الهمزة بجميع صورها (ء أ ؤ إ ئ)',
    ruleEn: 'hamza in all of its forms (ء أ ؤ إ ئ)',
  },
  'ياء': {
    chars: ['ي', 'ى'],
    labelAr: 'الياء', labelEn: 'yaa',
    ruleAr: 'حرف الياء بصورتَيه (ي ى)',
    ruleEn: 'the letter yaa in both forms (ي ى)',
  },
  'با': single('ب', 'الباء', 'baa'),
  'باء': single('ب', 'الباء', 'baa'),
  'تاء': single('ت', 'التاء', 'taa'),
  'ثاء': single('ث', 'الثاء', 'thaa'),
  'جيم': single('ج', 'الجيم', 'jeem'),
  'حاء': single('ح', 'الحاء', 'haa'),
  'خاء': single('خ', 'الخاء', 'khaa'),
  'دال': single('د', 'الدال', 'dal'),
  'ذال': single('ذ', 'الذال', 'dhal'),
  'راء': single('ر', 'الراء', 'raa'),
  'زاي': single('ز', 'الزاي', 'zay'),
  'زاء': single('ز', 'الزاي', 'zay'),
  'سين': single('س', 'السين', 'seen'),
  'شين': single('ش', 'الشين', 'sheen'),
  'صاد': single('ص', 'الصاد', 'saad'),
  'ضاد': single('ض', 'الضاد', 'daad'),
  'طاء': single('ط', 'الطاء', 'taa (emphatic)'),
  'ظاء': single('ظ', 'الظاء', 'dhaa'),
  'عين': single('ع', 'العين', 'ayn'),
  'غين': single('غ', 'الغين', 'ghayn'),
  'فاء': single('ف', 'الفاء', 'faa'),
  'قاف': single('ق', 'القاف', 'qaf'),
  'كاف': single('ك', 'الكاف', 'kaf'),
  'لام': single('ل', 'اللام', 'lam'),
  'ميم': single('م', 'الميم', 'meem'),
  'نون': single('ن', 'النون', 'noon'),
  'هاء': single('ه', 'الهاء', 'haa (round)'),
  'واو': single('و', 'الواو', 'waw'),
};

function single(ch: string, labelAr: string, labelEn: string): CountableChars {
  return {
    chars: [ch],
    labelAr,
    labelEn,
    ruleAr: `حرف ${labelAr} (${ch})`,
    ruleEn: `the letter ${labelEn} (${ch})`,
  };
}

const TOTAL_SETS: Record<'ayahs' | 'surahs' | 'words' | 'letters', Set<string>> = {
  ayahs: new Set(['ايه', 'ايات', 'الايات', 'ayah', 'ayahs', 'aya', 'ayat', 'verse', 'verses']),
  surahs: new Set(['سوره', 'سور', 'السور', 'surah', 'surahs', 'sura', 'suras', 'chapter', 'chapters']),
  words: new Set(['كلمه', 'كلمات', 'الكلمات', 'word', 'words']),
  letters: new Set(['حرف', 'حروف', 'الحروف', 'letter', 'letters']),
};

const ARABIC_CHAR_RE = /[ء-يٱ]/;
const LATIN_RE = /[a-z]/;
/** A single Arabic (or numeral) "word" token, used to parse comparison targets. */
const WORD_TOKEN = '[ء-يٱ0-9]+';

/* ------------------------------------------------------------------ */
/* Counting helpers                                                    */
/* ------------------------------------------------------------------ */

function countSub(haystack: string, needle: string): number {
  let n = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    n += 1;
    pos = haystack.indexOf(needle, pos + needle.length);
  }
  return n;
}

/**
 * Count occurrences of `needle` whose preceding character is NOT in
 * `excludedPrev`. Used for elided-lam forms: «لله» must match in
 * «ولله / فلله / لله» but never inside «الله / بالله» (which the plain
 * target match already covers).
 */
function countSubExcludingPrev(
  haystack: string,
  needle: string,
  excludedPrev: string,
): number {
  let n = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    if (pos === 0 || !excludedPrev.includes(haystack[pos - 1])) n += 1;
    pos = haystack.indexOf(needle, pos + 1);
  }
  return n;
}

function countChars(text: string, chars: string[]): number {
  let n = 0;
  for (const c of text) if (chars.includes(c)) n += 1;
  return n;
}

/**
 * Reusable, explicit counters (§7). Word/character counts default to the
 * NORMALIZED Quran text (diacritics, tatweel and punctuation removed, alef
 * unified) so the same rule applies to every ayah and surah.
 */
export function countWords(text: string): number {
  return normalizeText(text).split(' ').filter(Boolean).length;
}

/** Characters excluding spaces, punctuation, ayah-number ornaments and diacritics. */
export function countCharacters(text: string): number {
  return normalizeText(text).replace(/\s/g, '').length;
}

/** Exact-word occurrences of `target` (whole normalized token), the default match mode. */
export function countExactWordOccurrences(text: string, target: string): number {
  const t = normalizeText(target);
  if (!t) return 0;
  let n = 0;
  for (const w of normalizeText(text).split(' ')) if (w === t) n += 1;
  return n;
}

/** Raw substring occurrences of `target` (opt-in mode). */
export function countSubstringOccurrences(text: string, target: string): number {
  return countSub(normalizeText(text), normalizeText(target));
}

/**
 * When لام الجر attaches to a word starting with «ال», the alef is
 * elided in the mushaf orthography: الرحمن ← للرحمن (article lam kept,
 * jar lam added), but words already opening with doubled lam contract
 * to two written lams: الله ← لله. A plain substring match cannot see
 * those forms, so this returns the extra glued-form needle to count
 * explicitly (or null when the target doesn't take this shape).
 */
function computeElided(target: string): string | null {
  return target.startsWith('ال') && target.length > 3
    ? target.startsWith('الل')
      ? target.slice(1)
      : `ل${target.slice(1)}`
    : null;
}

/** Total occurrences of `target` (incl. glued/elided forms) inside `normText`. */
function countTargetOccurrences(normText: string, target: string, elided: string | null): number {
  let occurrences = countSub(normText, target);
  if (elided) occurrences += countSubExcludingPrev(normText, elided, 'ا');
  return occurrences;
}

interface ScopedCount {
  total: number;
  perSurah: Map<number, { name: string; nameEn: string; value: number }>;
}

function countOverEntries(
  entries: AnalyticsEntry[],
  scope: number | null,
  counter: (e: AnalyticsEntry) => number,
): ScopedCount {
  const perSurah: ScopedCount['perSurah'] = new Map();
  let total = 0;
  for (const e of entries) {
    if (scope !== null && e.group.surah !== scope) continue;
    const v = counter(e);
    if (v === 0) continue;
    total += v;
    const existing = perSurah.get(e.group.surah);
    if (existing) existing.value += v;
    else
      perSurah.set(e.group.surah, {
        name: e.group.surah_name,
        nameEn: e.group.surah_transliteration,
        value: v,
      });
  }
  return { total, perSurah };
}

function topSurahStats(
  counted: ScopedCount,
  lang: AppLanguage,
): MessageStats | undefined {
  if (counted.perSurah.size < 2) return undefined;
  const items = [...counted.perSurah.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((s) => ({
      label: lang === 'ar' ? `سورة ${s.name}` : `Surah ${s.nameEn}`,
      value: s.value,
    }));
  return {
    title: lang === 'ar' ? 'أكثر السور ورودًا' : 'Top surahs by occurrences',
    items,
  };
}

/* ------------------------------------------------------------------ */
/* Per-ayah helpers — needed for location / first-last / superlative   */
/* ------------------------------------------------------------------ */

interface AyahRef {
  surahNum: number;
  surahName: string;
  surahNameEn: string;
  ayahNumber: number;
  text: string;
  normText: string;
}

/** Flattens grouped entries into individual ayahs (respecting an optional surah scope). */
function collectAyahs(entries: AnalyticsEntry[], scope: number | null): AyahRef[] {
  const result: AyahRef[] = [];
  for (const e of entries) {
    if (scope !== null && e.group.surah !== scope) continue;
    for (const a of e.group.ayahs) {
      result.push({
        surahNum: e.group.surah,
        surahName: e.group.surah_name,
        surahNameEn: e.group.surah_transliteration,
        ayahNumber: a.number,
        text: a.text,
        normText: normForMatch(a.text),
      });
    }
  }
  return result;
}

function ayahReference(a: AyahRef, lang: AppLanguage): AnswerReference {
  return {
    type: 'quran',
    surah: lang === 'ar' ? a.surahName : a.surahNameEn,
    ayah: String(a.ayahNumber),
    text: withAyahMarker(a.text, a.ayahNumber),
  };
}

const MAX_LOCATION_RESULTS = 15;

/** Extracts the remaining target word(s) from tokens after removing structural fillers. */
function extractTarget(tokens: string[], extraFillers: Set<string>): string | null {
  const targetTokens = tokens.filter((t) => !COUNT_FILLERS.has(t) && !extraFillers.has(t));
  if (targetTokens.length === 0 || targetTokens.length > 4) return null;
  let target = targetTokens.join(' ');
  target = WORD_ALIASES[target] ?? target;
  return target;
}

function arabicScriptClarify(lang: AppLanguage): AnalyticsOutcome {
  return {
    kind: 'clarify',
    answer:
      lang === 'ar'
        ? 'لأبحث عن كلمة في القرآن أحتاجها بالرسم العربي. اكتب الكلمة بالعربية.'
        : 'To search for a word in the Quran I need it written in Arabic script.',
  };
}

/* ------------------------------------------------------------------ */
/* 1) Location questions — «أين وردت كلمة …»                           */
/* ------------------------------------------------------------------ */

function handleLocation(
  tokens: string[],
  entries: AnalyticsEntry[],
  scope: number | null,
  scopeName: string,
  lang: AppLanguage,
  note: string,
  title: string,
): AnalyticsOutcome {
  const target = extractTarget(tokens, LOCATION_FILLERS);
  if (!target) return null;
  if (LATIN_RE.test(target)) return arabicScriptClarify(lang);
  if (target.length < 2) return null;

  const elided = computeElided(target);
  const ayahs = collectAyahs(entries, scope);
  const matches = ayahs.filter((a) => countTargetOccurrences(a.normText, target, elided) > 0);

  if (matches.length === 0) {
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `لم أجد كلمة «${target}» في نص القرآن الكريم المتوفر لديّ${scopeName}.`
          : `I could not find the word «${target}» in the Quran text available to me${scopeName}.`,
    };
  }

  const shown = matches.slice(0, MAX_LOCATION_RESULTS);
  const truncated = matches.length > shown.length;
  const listAr = shown.map((a) => `سورة ${a.surahName} — آية ${a.ayahNumber}`).join('، ');
  const listEn = shown.map((a) => `Surah ${a.surahNameEn} (ayah ${a.ayahNumber})`).join(', ');

  return {
    kind: 'answer', title, note,
    answer:
      lang === 'ar'
        ? `وردت كلمة «${target}»${scopeName} في ${matches.length} موضعًا${truncated ? ` (يُعرض أول ${shown.length} منها)` : ''}: ${listAr}.`
        : `The word «${target}»${scopeName} appears in ${matches.length} place(s)${truncated ? ` (showing the first ${shown.length})` : ''}: ${listEn}.`,
    references: shown.map((a) => ayahReference(a, lang)),
  };
}

/* ------------------------------------------------------------------ */
/* 2) First / last occurrence                                          */
/* ------------------------------------------------------------------ */

function handleFirstLast(
  normQuery: string,
  tokens: string[],
  entries: AnalyticsEntry[],
  scope: number | null,
  scopeName: string,
  lang: AppLanguage,
  note: string,
  title: string,
): AnalyticsOutcome {
  const wantFirst = /اول/.test(normQuery) || /first/.test(normQuery);
  const target = extractTarget(tokens, LOCATION_FILLERS);
  if (!target) return null;
  if (LATIN_RE.test(target)) return arabicScriptClarify(lang);
  if (target.length < 2) return null;

  const elided = computeElided(target);
  const ayahs = collectAyahs(entries, scope);
  const matches = ayahs.filter((a) => countTargetOccurrences(a.normText, target, elided) > 0);

  if (matches.length === 0) {
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `لم أجد كلمة «${target}» في نص القرآن الكريم المتوفر لديّ${scopeName}.`
          : `I could not find the word «${target}» in the Quran text available to me${scopeName}.`,
    };
  }

  const hit = wantFirst ? matches[0] : matches[matches.length - 1];
  const whichAr = wantFirst ? 'أول موضع' : 'آخر موضع';
  const whichEn = wantFirst ? 'first place' : 'last place';

  return {
    kind: 'answer', title, note,
    answer:
      lang === 'ar'
        ? `${whichAr} وردت فيه كلمة «${target}»${scopeName} هو سورة ${hit.surahName}، الآية ${hit.ayahNumber}.`
        : `The ${whichEn} the word «${target}»${scopeName} is mentioned is Surah ${hit.surahNameEn}, ayah ${hit.ayahNumber}.`,
    references: [ayahReference(hit, lang)],
  };
}

/* ------------------------------------------------------------------ */
/* 3) Longest / shortest ayah or surah                                  */
/* ------------------------------------------------------------------ */

type SuperlativeMetric = 'ayahs' | 'words' | 'characters';

/** Which extreme + which metric a superlative question asks for. */
function superlativeIntent(normQuery: string): {
  wantMax: boolean;
  metric: SuperlativeMetric | null;
} {
  const wantMax = /اطول|اكبر|اكثر|longest|largest|most|تحتوي\s+اكبر/.test(normQuery);
  let metric: SuperlativeMetric | null = null;
  if (/كلمه|كلمات|words?|word/.test(normQuery)) metric = 'words';
  else if (/احرف|حروف|الاحرف|الحروف|حرف|character|letter/.test(normQuery)) metric = 'characters';
  else if (/ايه|اية|الايات|ايات|ayah|verse/.test(normQuery)) metric = 'ayahs';
  return { wantMax, metric };
}

const METRIC_LABEL: Record<SuperlativeMetric, { ar: string; en: string }> = {
  ayahs: { ar: 'عدد الآيات', en: 'number of ayahs' },
  words: { ar: 'عدد الكلمات', en: 'number of words' },
  characters: { ar: 'عدد الأحرف (بعد إزالة التشكيل والمسافات)', en: 'character count (diacritics & spaces removed)' },
};

/** Items sharing the extreme (max or min) value — ties are never hidden (§5). */
function extremes<T>(items: T[], value: (t: T) => number, wantMax: boolean): { value: number; matches: T[] } {
  const vals = items.map(value);
  const extreme = wantMax ? Math.max(...vals) : Math.min(...vals);
  return { value: extreme, matches: items.filter((t) => value(t) === extreme) };
}

function handleSuperlative(
  normQuery: string,
  entries: AnalyticsEntry[],
  scope: number | null,
  scopeName: string,
  lang: AppLanguage,
  note: string,
  title: string,
): AnalyticsOutcome {
  const { wantMax, metric } = superlativeIntent(normQuery);
  // A superlative about a SURAH ("... سورة ...") vs an AYAH ("... آية ...").
  const wantsSurah = /سوره|surah/.test(normQuery);
  const wantsAyah = !wantsSurah && /ايه|اية|ayah|verse/.test(normQuery);

  const supAr = wantMax ? 'أطول' : 'أقصر';
  const supEn = wantMax ? 'longest' : 'shortest';

  if (wantsSurah) {
    // Surah superlative — default metric is number of ayahs (§4/§5).
    const m: SuperlativeMetric = metric === 'words' || metric === 'characters' ? metric : 'ayahs';
    const perSurah = new Map<number, { name: string; nameEn: string; value: number }>();
    for (const e of entries) {
      const value =
        m === 'ayahs'
          ? e.group.ayahs.length
          : m === 'words'
            ? countWords(e.group.ayah_text)
            : countCharacters(e.group.ayah_text);
      const existing = perSurah.get(e.group.surah);
      if (existing) existing.value += value;
      else perSurah.set(e.group.surah, { name: e.group.surah_name, nameEn: e.group.surah_transliteration, value });
    }
    const list = [...perSurah.values()];
    if (list.length === 0) return null;
    const { value, matches } = extremes(list, (s) => s.value, wantMax);
    const namesAr = matches.map((s) => `سورة ${s.name}`).join('، ');
    const namesEn = matches.map((s) => `Surah ${s.nameEn}`).join(', ');
    const tie = matches.length > 1;
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `${supAr} ${tie ? 'سور' : 'سورة'} في القرآن من حيث ${METRIC_LABEL[m].ar}${scopeName} هي ${namesAr}، ${tie ? 'ولكلٍّ منها' : 'وعددها'} ${value} ${m === 'ayahs' ? ayahUnitAr(value) : m === 'words' ? 'كلمة' : 'حرفًا'}.`
          : `The ${supEn} surah${tie ? 's' : ''} in the Quran by ${METRIC_LABEL[m].en}${scopeName} ${tie ? 'are' : 'is'} ${namesEn}, ${tie ? 'each with' : 'with'} ${value} ${m === 'ayahs' ? 'ayahs' : m === 'words' ? 'words' : 'characters'}.`,
    };
  }

  if (wantsAyah) {
    // Ayah superlative — default metric is characters; words if asked.
    const m: SuperlativeMetric = metric === 'words' ? 'words' : 'characters';
    const ayahs = collectAyahs(entries, scope);
    if (ayahs.length === 0) return null;
    const value = (a: AyahRef) => (m === 'words' ? countWords(a.text) : countCharacters(a.text));
    const { value: extreme, matches } = extremes(ayahs, value, wantMax);
    const shown = matches.slice(0, MAX_LOCATION_RESULTS);
    const tie = matches.length > 1;
    const listAr = shown.map((a) => `الآية ${a.ayahNumber} من سورة ${a.surahName}`).join('، ');
    const listEn = shown.map((a) => `ayah ${a.ayahNumber} of Surah ${a.surahNameEn}`).join(', ');
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `${supAr} ${tie ? 'آيات' : 'آية'}${scopeName} في القرآن من حيث ${METRIC_LABEL[m].ar} ${tie ? 'هي' : 'هي'} ${listAr}، ${tie ? 'ولكلٍّ منها' : 'وعددها'} ${extreme} ${m === 'words' ? 'كلمة' : 'حرفًا'}.${tie && matches.length > shown.length ? ` (يُعرض ${shown.length} من ${matches.length})` : ''}`
          : `The ${supEn} ayah${tie ? 's' : ''}${scopeName} in the Quran by ${METRIC_LABEL[m].en} ${tie ? 'are' : 'is'} ${listEn}, ${tie ? 'each with' : 'with'} ${extreme} ${m === 'words' ? 'words' : 'characters'}.`,
      references: shown.map((a) => ayahReference(a, lang)),
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* 4) Comparison questions — «أيهما أكثر ذكرًا: … أم …»                  */
/* ------------------------------------------------------------------ */

function parseComparisonTargets(normQuery: string): [string, string] | null {
  let m = normQuery.match(new RegExp(`(${WORD_TOKEN})\\s+(?:ام|او|or)\\s+(${WORD_TOKEN})`));
  if (m) return [m[1], m[2]];
  // "قارن بين ذكر الدنيا والآخرة" — the second word absorbs a glued "و" (and).
  m = normQuery.match(new RegExp(`(?:ذكر|بين)\\s+(${WORD_TOKEN})\\s+و(${WORD_TOKEN})`));
  if (m) return [m[1], m[2]];
  return null;
}

function handleComparison(
  normQuery: string,
  entries: AnalyticsEntry[],
  scope: number | null,
  scopeName: string,
  lang: AppLanguage,
  note: string,
  title: string,
): AnalyticsOutcome {
  const targets = parseComparisonTargets(normQuery);
  if (!targets) {
    return {
      kind: 'clarify',
      answer:
        lang === 'ar'
          ? 'حدّد الكلمتين اللتين تريد مقارنتهما، مثال: «أيهما أكثر ذكرًا: الجنة أم النار؟»'
          : 'Please specify the two words to compare, e.g. "Which is mentioned more: Paradise or Hellfire?"',
    };
  }

  const [rawA, rawB] = targets;
  const wordA = WORD_ALIASES[rawA] ?? rawA;
  const wordB = WORD_ALIASES[rawB] ?? rawB;
  const elidedA = computeElided(wordA);
  const elidedB = computeElided(wordB);

  const countedA = countOverEntries(entries, scope, (e) =>
    countTargetOccurrences(e.normAyahText, wordA, elidedA),
  );
  const countedB = countOverEntries(entries, scope, (e) =>
    countTargetOccurrences(e.normAyahText, wordB, elidedB),
  );

  if (countedA.total === 0 && countedB.total === 0) {
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `لم أجد أيًا من الكلمتين «${wordA}» أو «${wordB}»${scopeName} في نص القرآن الكريم المتوفر لديّ.`
          : `I could not find either «${wordA}» or «${wordB}»${scopeName} in the Quran text available to me.`,
    };
  }

  const winner = countedA.total === countedB.total ? null : countedA.total > countedB.total ? wordA : wordB;

  return {
    kind: 'answer', title, note,
    answer:
      lang === 'ar'
        ? `وردت كلمة «${wordA}»${scopeName} ${countedA.total} مرة، ووردت كلمة «${wordB}»${scopeName} ${countedB.total} مرة. ${
            winner ? `الأكثر ورودًا: «${winner}».` : 'الكلمتان متساويتان في عدد الورود.'
          }`
        : `«${wordA}»${scopeName} appears ${countedA.total} time(s), and «${wordB}»${scopeName} appears ${countedB.total} time(s). ${
            winner ? `More frequent: «${winner}».` : 'Both words occur an equal number of times.'
          }`,
    stats: {
      title: lang === 'ar' ? 'مقارنة عدد الورود' : 'Occurrence comparison',
      items: [
        { label: wordA, value: countedA.total },
        { label: wordB, value: countedB.total },
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Quran-dataset feed (source of truth = quran.json, NOT tafsir)        */
/*                                                                     */
/* The analytics handlers all consume AnalyticsEntry[] (one synthetic  */
/* per-surah "group" of ayahs) + a surah-name lookup. Building these    */
/* from quran.json makes every statistic independent of tafsir loading  */
/* — they now work even when Tafsir data is null or fails to load.      */
/* ------------------------------------------------------------------ */

/** Per-ayah juz/page, keyed `${surah}:${ayah}` — enables Juz/page scoping. */
const ayahMeta = new Map<string, { juz: number; page: number }>();
let cachedEntries: AnalyticsEntry[] | null = null;
let cachedLookup: SurahLookup | null = null;

function ayahKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

/**
 * Match-normalization for Quran text: normalizeText PLUS collapsing the
 * Uthmani «ءا» (hamza+alef) that renders «آ». Without this «الآخرة» (which a
 * user types, normalizing to «الاخره») would never match the mushaf spelling
 * «ٱلْءَاخِرَةِ» → «الءاخره». Only the hamza-then-alef sequence collapses, so
 * «ماء»/«شيء» (alef-then-hamza) are untouched. Applied symmetrically to the
 * corpus below; user targets already normalize «آ»→«ا», so they need nothing.
 */
function normForMatch(text: string): string {
  return normalizeText(text).replace(/ءا/g, 'ا');
}

/** Arabic ayah unit: 3–10 take the plural «آيات», otherwise «آية». */
function ayahUnitAr(n: number): string {
  return n >= 3 && n <= 10 ? 'آيات' : 'آية';
}

/** Builds (once) the analytics entries + surah lookup + juz/page map from quran.json. */
function buildQuranAnalytics(): void {
  if (cachedEntries && cachedLookup) return;

  const ayahs = getQuranAyahs();
  const surahList = getSurahList();
  const meta = new Map(surahList.map((s) => [s.number, s]));

  // Group ayahs into one synthetic TafseerGroup-shaped entry per surah.
  const bySurah = new Map<number, { number: number; text: string }[]>();
  ayahMeta.clear();
  for (const a of ayahs) {
    let list = bySurah.get(a.surahNumber);
    if (!list) {
      list = [];
      bySurah.set(a.surahNumber, list);
    }
    list.push({ number: a.ayahNumber, text: a.textUthmani });
    ayahMeta.set(ayahKey(a.surahNumber, a.ayahNumber), { juz: a.juz, page: a.page });
  }

  const entries: AnalyticsEntry[] = [];
  for (const [surahNumber, list] of [...bySurah.entries()].sort((x, y) => x[0] - y[0])) {
    list.sort((x, y) => x.number - y.number);
    const info = meta.get(surahNumber);
    // Clean display name: drop the «سُورَةُ» prefix and tashkeel so answers
    // read «سورة البقرة» (matching the spec) rather than «سورة البَقَرَةِ».
    const nameArabic = stripTashkeel(info?.nameArabic ?? `سورة ${surahNumber}`)
      .replace(/^سُورَةُ?\s+/, '')
      .replace(/^سورة\s+/, '')
      .trim();
    const ayahText = list.map((a) => a.text).join(' ');
    const group: TafseerGroup = {
      surah: surahNumber,
      surah_name: nameArabic,
      surah_transliteration: info?.nameEnglish ?? `Surah ${surahNumber}`,
      surah_type: '',
      ayah_start: list[0]?.number ?? 1,
      ayah_end: list[list.length - 1]?.number ?? list.length,
      ayahs: list,
      ayah_text: ayahText,
      explanation: '',
    };
    entries.push({ group, normAyahText: normForMatch(ayahText) });
  }
  cachedEntries = entries;

  // Surah-name lookup: normalized Arabic name (± article) + english + number.
  const lookup = new Map<string, number>();
  for (const s of surahList) {
    const norm = normalizeText(s.nameArabic).replace(/^سوره\s+/, '').trim();
    if (norm && !lookup.has(norm)) lookup.set(norm, s.number);
    if (norm.startsWith('ال') && norm.length > 4) {
      const noArticle = norm.slice(2);
      if (!lookup.has(noArticle)) lookup.set(noArticle, s.number);
    }
    const en = normalizeText(s.nameEnglish).replace(/\s+/g, '');
    if (en && !lookup.has(en)) lookup.set(en, s.number);
  }
  cachedLookup = (name: string) => lookup.get(name) ?? null;
}

/** AnalyticsEntry[] derived from quran.json (cached). The analytics source of truth. */
export function getQuranAnalyticsEntries(): AnalyticsEntry[] {
  buildQuranAnalytics();
  return cachedEntries!;
}

/** Surah-name → number resolver derived from quran.json (cached). */
export function getAnalyticsSurahLookup(): SurahLookup {
  buildQuranAnalytics();
  return cachedLookup!;
}

/** juz/page for an ayah (from quran.json), or null. */
function ayahScopeMeta(surah: number, ayah: number): { juz: number; page: number } | null {
  buildQuranAnalytics();
  return ayahMeta.get(ayahKey(surah, ayah)) ?? null;
}

/**
 * Whether the bundled Quran dataset is complete (6236 ayahs). A Quran-wide
 * statistic is never computed from partial data — the caller returns a clear
 * message instead.
 */
export function isQuranDataComplete(): boolean {
  const v = getQuranValidation();
  return v.valid && v.count === 6236;
}

export const QURAN_INCOMPLETE_AR =
  'تعذر إجراء الإحصاء بدقة لأن بيانات القرآن داخل التطبيق غير مكتملة.';
export const QURAN_INCOMPLETE_EN =
  'The statistic could not be computed accurately because the Quran data in the app is incomplete.';

/* ------------------------------------------------------------------ */
/* Juz / page scope (fields present in quran.json — §8)                 */
/* ------------------------------------------------------------------ */

/** Single-word Arabic ordinals/cardinals → number (1–30), for «الجزء الثلاثين». */
const NUMBER_WORDS: Record<string, number> = {
  الاول: 1, الاولى: 1, اول: 1, واحد: 1,
  الثاني: 2, الثانيه: 2, اثنان: 2, اثنين: 2,
  الثالث: 3, الثالثه: 3, ثلاثه: 3, ثلاث: 3,
  الرابع: 4, الرابعه: 4, اربعه: 4, اربع: 4,
  الخامس: 5, الخامسه: 5, خمسه: 5, خمس: 5,
  السادس: 6, السادسه: 6, سته: 6, ست: 6,
  السابع: 7, السابعه: 7, سبعه: 7, سبع: 7,
  الثامن: 8, الثامنه: 8, ثمانيه: 8, ثمان: 8,
  التاسع: 9, التاسعه: 9, تسعه: 9, تسع: 9,
  العاشر: 10, العاشره: 10, عشره: 10, عشر: 10,
  العشرون: 20, العشرين: 20, عشرون: 20, عشرين: 20,
  الثلاثون: 30, الثلاثين: 30, ثلاثون: 30, ثلاثين: 30,
};

/** Arabic-Indic → Western digits (normalizeText already does this, but keep a public seam). */
export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Reads a number written as a Western digit or a supported Arabic word. */
function parseScopeNumber(token: string | undefined): number | null {
  if (!token) return null;
  const digits = normalizeDigits(token).match(/\d+/);
  if (digits) return Number(digits[0]);
  return NUMBER_WORDS[token] ?? null;
}

export interface JuzPageScope {
  juz?: number;
  page?: number;
}

/**
 * Extracts a juz/page scope from the padded normalized query and returns the
 * query with the matched scope phrase removed (so token-based logic below never
 * mistakes «الجزء» / «الثلاثين» for a target word).
 */
function resolveJuzPageScope(paddedQuery: string): { scope: JuzPageScope; q: string } {
  let q = paddedQuery;
  const scope: JuzPageScope = {};

  const juzMatch = q.match(/\s(الجزء|جزء|juz)\s+(\S+)/);
  if (juzMatch) {
    const n = parseScopeNumber(juzMatch[2]);
    if (n !== null) {
      scope.juz = n;
      q = q.replace(juzMatch[0], ' ');
    }
  }
  const pageMatch = q.match(/\s(الصفحه|صفحه|page)\s+(\S+)/);
  if (pageMatch) {
    const n = parseScopeNumber(pageMatch[2]);
    if (n !== null) {
      scope.page = n;
      q = q.replace(pageMatch[0], ' ');
    }
  }
  return { scope, q };
}

/** Filters entries to only the ayahs inside the given juz/page (empty groups dropped). */
function filterEntriesByJuzPage(entries: AnalyticsEntry[], scope: JuzPageScope): AnalyticsEntry[] {
  const out: AnalyticsEntry[] = [];
  for (const e of entries) {
    const kept = e.group.ayahs.filter((a) => {
      const m = ayahScopeMeta(e.group.surah, a.number);
      if (!m) return false;
      if (scope.juz !== undefined && m.juz !== scope.juz) return false;
      if (scope.page !== undefined && m.page !== scope.page) return false;
      return true;
    });
    if (kept.length === 0) continue;
    const ayahText = kept.map((a) => a.text).join(' ');
    out.push({
      group: { ...e.group, ayahs: kept, ayah_text: ayahText },
      normAyahText: normForMatch(ayahText),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

export function tryAnalytics(
  normQuery: string,
  entries: AnalyticsEntry[],
  lookupSurah: SurahLookup,
  lang: AppLanguage,
): AnalyticsOutcome {
  const hasCountTrigger = AR_TRIGGER.test(normQuery) || EN_TRIGGER.test(normQuery);
  const hasLocationTrigger = LOCATION_TRIGGER.test(normQuery);
  const hasFirstLastTrigger = FIRST_LAST_TRIGGER.test(normQuery);
  const hasSuperlativeTrigger = SUPERLATIVE_TRIGGER.test(normQuery);
  const hasComparisonTrigger = COMPARISON_TRIGGER.test(normQuery);
  const isAnalyticsQuery =
    hasCountTrigger || hasLocationTrigger || hasFirstLastTrigger || hasSuperlativeTrigger || hasComparisonTrigger;

  if (!isAnalyticsQuery) return null;

  // Missing/incomplete local data — never guess a number or reference.
  if (entries.length === 0) {
    return { kind: 'clarify', answer: lang === 'ar' ? DATA_UNAVAILABLE_AR : DATA_UNAVAILABLE_EN };
  }

  // Never compute a Quran-wide statistic from partial data (§14).
  if (!isQuranDataComplete()) {
    return { kind: 'clarify', answer: lang === 'ar' ? QURAN_INCOMPLETE_AR : QURAN_INCOMPLETE_EN };
  }

  // Western digits in both languages: clearer at small sizes and
  // consistent with ayah numbers elsewhere in the UI.
  const fmt = (n: number) => n.toLocaleString('en-US');
  const note =
    lang === 'ar'
      ? 'حُسبت هذه الأرقام آليًا من نص المصحف المعتمد المضمّن في بيانات التطبيق، وقد تختلف يسيرًا عن كتب إحصاء القرآن بحسب منهج العدّ وقواعد الرسم.'
      : 'Computed automatically from the approved mushaf text bundled with this app; figures may differ slightly from published Quran-statistics references depending on counting methodology and orthography.';
  const title =
    lang === 'ar' ? 'إحصاء من نص القرآن الكريم' : 'Statistics from the Quran text';

  // ---- optional juz/page scope (§8): «... في الجزء الثلاثين», «... في الصفحة 42»
  let q = ` ${normQuery} `;
  let scope: number | null = null;
  let scopeName = '';

  const { scope: jp, q: qAfterJuz } = resolveJuzPageScope(q);
  q = qAfterJuz;
  if (jp.juz !== undefined || jp.page !== undefined) {
    if (jp.juz !== undefined && (jp.juz < 1 || jp.juz > 30)) {
      return {
        kind: 'clarify',
        answer:
          lang === 'ar'
            ? 'رقم الجزء غير صحيح؛ أجزاء القرآن من ١ إلى ٣٠.'
            : 'Invalid juz number; the Quran has 30 juz (1–30).',
      };
    }
    if (jp.page !== undefined && (jp.page < 1 || jp.page > 604)) {
      return {
        kind: 'clarify',
        answer:
          lang === 'ar'
            ? 'رقم الصفحة غير صحيح؛ صفحات المصحف من ١ إلى ٦٠٤.'
            : 'Invalid page number; the mushaf has pages 1–604.',
      };
    }
    entries = filterEntriesByJuzPage(entries, jp);
    if (entries.length === 0) {
      return {
        kind: 'answer',
        title,
        note,
        answer:
          lang === 'ar'
            ? `لا توجد آيات ضمن ${jp.juz !== undefined ? `الجزء ${jp.juz}` : `الصفحة ${jp.page}`} في بيانات التطبيق.`
            : `No ayahs found within ${jp.juz !== undefined ? `Juz ${jp.juz}` : `page ${jp.page}`} in the app data.`,
      };
    }
    scopeName =
      lang === 'ar'
        ? jp.juz !== undefined
          ? ` في الجزء ${jp.juz}`
          : ` في الصفحة ${jp.page}`
        : jp.juz !== undefined
          ? ` in Juz ${jp.juz}`
          : ` in page ${jp.page}`;
  }

  // ---- optional surah scope: «... في سورة مريم» / "... in surah maryam"
  const scopeMatch = q.match(/\s(سوره|سورت|surah|surat|sura)\s+(\S+)(?:\s+(\S+))?/);
  if (scopeMatch) {
    const kw = scopeMatch[1];
    const two = scopeMatch[3] ? `${scopeMatch[2]} ${scopeMatch[3]}` : null;
    const twoNum = two ? lookupSurah(two) : null;
    const oneNum = lookupSurah(scopeMatch[2]);
    if (two && twoNum !== null) {
      scope = twoNum;
      q = q.replace(` ${kw} ${two}`, ' ');
    } else if (oneNum !== null) {
      scope = oneNum;
      q = q.replace(` ${kw} ${scopeMatch[2]}`, ' ');
    }
  }
  if (scope !== null) {
    const g = entries.find((e) => e.group.surah === scope);
    if (g) {
      scopeName +=
        lang === 'ar'
          ? ` في سورة ${g.group.surah_name}`
          : ` in Surah ${g.group.surah_transliteration}`;
    }
  }

  const rawTokens = q.split(' ').filter(Boolean);
  const tokens = rawTokens.filter((t) => !BASIC_FILLERS.has(t));
  if (tokens.length === 0) return null;

  // ---- extended analytics: location / first-last / superlative / comparison
  if (hasSuperlativeTrigger) {
    const result = handleSuperlative(normQuery, entries, scope, scopeName, lang, note, title);
    if (result) return result;
  }
  if (hasComparisonTrigger) {
    const result = handleComparison(normQuery, entries, scope, scopeName, lang, note, title);
    if (result) return result;
  }
  if (hasFirstLastTrigger) {
    const result = handleFirstLast(normQuery, tokens, entries, scope, scopeName, lang, note, title);
    if (result) return result;
  }
  if (hasLocationTrigger) {
    const result = handleLocation(tokens, entries, scope, scopeName, lang, note, title);
    if (result) return result;
  }

  // Extended trigger matched but no handler produced a conclusive result —
  // do not fall through into the plain "كم" counting logic below, which
  // assumes a different question shape and could misfire.
  if (!hasCountTrigger) return null;

  // ---- dataset totals: «كم آية في القرآن», "how many surahs" -------
  for (const key of ['ayahs', 'surahs', 'words', 'letters'] as const) {
    if (!tokens.every((t) => TOTAL_SETS[key].has(t))) continue;
    switch (key) {
      case 'ayahs': {
        const counted = countOverEntries(entries, scope, (e) =>
          e.group.ayahs?.length ?? e.group.ayah_end - e.group.ayah_start + 1,
        );
        return {
          kind: 'answer', title, note,
          answer:
            lang === 'ar'
              ? `يحتوي نص القرآن الكريم المتوفر لديّ${scopeName} على ${fmt(counted.total)} آية.`
              : `The Quran text available to me${scopeName} contains ${fmt(counted.total)} ayahs.`,
        };
      }
      case 'surahs': {
        const n = new Set(entries.map((e) => e.group.surah)).size;
        return {
          kind: 'answer', title, note,
          answer:
            lang === 'ar'
              ? `تحتوي بياناتي على ${fmt(n)} سورة كاملة.`
              : `My data contains ${fmt(n)} complete surahs.`,
        };
      }
      case 'words': {
        const counted = countOverEntries(entries, scope, (e) =>
          e.normAyahText ? e.normAyahText.split(' ').length : 0,
        );
        return {
          kind: 'answer', title, note,
          answer:
            lang === 'ar'
              ? `عدد كلمات نص القرآن الكريم المتوفر لديّ${scopeName}: ${fmt(counted.total)} كلمة (بالفصل على المسافات).`
              : `The Quran text available to me${scopeName} contains ${fmt(counted.total)} words (split on spaces).`,
        };
      }
      case 'letters': {
        const counted = countOverEntries(
          entries,
          scope,
          (e) => (e.group.ayah_text.match(/[ء-يٱ]/g) ?? []).length,
        );
        return {
          kind: 'answer', title, note,
          answer:
            lang === 'ar'
              ? `عدد حروف نص القرآن الكريم المتوفر لديّ${scopeName}: ${fmt(counted.total)} حرفًا (دون احتساب الحركات والمسافات).`
              : `The Quran text available to me${scopeName} contains ${fmt(counted.total)} letters (excluding diacritics and spaces).`,
        };
      }
    }
  }

  // ---- diacritic counts: «كم شدة», "how many sukun" ----------------
  for (const t of tokens) {
    const key =
      DIACRITICS[t] ? t
      : DIACRITICS[t.replace(/^ال/, '')] ? t.replace(/^ال/, '')
      : DIACRITIC_EN_KEYS[t];
    if (!key || !DIACRITICS[key]) continue;
    const d = DIACRITICS[key];
    const counted = countOverEntries(entries, scope, (e) =>
      countChars(e.group.ayah_text, d.chars),
    );
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `عدد مواضع ${d.ruleAr} في نص القرآن الكريم المتوفر لديّ${scopeName}: ${fmt(counted.total)}.`
          : `Occurrences of ${d.ruleEn} in the Quran text available to me${scopeName}: ${fmt(counted.total)}.`,
      stats: scope === null ? topSurahStats(counted, lang) : undefined,
    };
  }

  // ---- letter counts: «كم حرف الألف», "how many letter ق" ----------
  const letterKwIdx = tokens.findIndex((t) => t === 'حرف' || t === 'letter');
  if (letterKwIdx !== -1 && tokens[letterKwIdx + 1]) {
    const raw = tokens[letterKwIdx + 1];
    const nameKey = LETTERS[raw]
      ? raw
      : LETTERS[raw.replace(/^ال/, '')]
        ? raw.replace(/^ال/, '')
        : null;
    const def: CountableChars | null = nameKey
      ? LETTERS[nameKey]
      : raw.length === 1 && ARABIC_CHAR_RE.test(raw)
        ? single(raw, raw, raw)
        : null;
    if (def) {
      const counted = countOverEntries(entries, scope, (e) =>
        countChars(e.group.ayah_text, def.chars),
      );
      return {
        kind: 'answer', title, note,
        answer:
          lang === 'ar'
            ? `ورد ${def.ruleAr} في نص القرآن الكريم المتوفر لديّ${scopeName} ${fmt(counted.total)} مرة.`
            : `${def.ruleEn} appears ${fmt(counted.total)} times in the Quran text available to me${scopeName}.`,
        stats: scope === null ? topSurahStats(counted, lang) : undefined,
      };
    }
  }

  // ---- word counts: «كم مرة ذكرت كلمة الله» -------------------------
  const targetTokens = tokens.filter((t) => !COUNT_FILLERS.has(t));
  if (targetTokens.length === 0 || targetTokens.length > 4) return null;
  let target = targetTokens.join(' ');
  target = WORD_ALIASES[target] ?? target;

  if (LATIN_RE.test(target)) return arabicScriptClarify(lang);
  if (target.length < 2) return null;

  const elided = computeElided(target);

  let standalone = 0;
  const counted = countOverEntries(entries, scope, (e) => {
    standalone += countSub(` ${e.normAyahText} `, ` ${target} `);
    return countTargetOccurrences(e.normAyahText, target, elided);
  });
  const within = counted.total - standalone;

  if (counted.total === 0) {
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `لم أجد كلمة «${target}» في نص القرآن الكريم المتوفر لديّ${scopeName} (بعد توحيد الرسم وإزالة التشكيل).`
          : `I could not find the word «${target}» in the Quran text available to me${scopeName} (after normalizing spelling and removing diacritics).`,
    };
  }

  // Optional detail: "مع الآيات" / "اعرض الآيات" attaches the matching
  // ayah references (surah + ayah number) instead of only the count.
  let references: AnswerReference[] | undefined;
  if (WANTS_DETAILS_RE.test(normQuery)) {
    const ayahs = collectAyahs(entries, scope);
    const matches = ayahs.filter((a) => countTargetOccurrences(a.normText, target, elided) > 0);
    references = matches.slice(0, MAX_LOCATION_RESULTS).map((a) => ayahReference(a, lang));
  }

  return {
    kind: 'answer', title, note,
    answer:
      lang === 'ar'
        ? `وردت كلمة «${target}»${scopeName} ${fmt(standalone)} مرة كلمةً مستقلة، و${fmt(within)} مرة متصلةً بحروف أو ضمن كلمات أخرى (مثل الواو والباء ولام الجر) — بمجموع ${fmt(counted.total)} موضعًا، بعد إزالة التشكيل وتوحيد رسم الألف.`
        : `The word «${target}» appears${scopeName} ${fmt(standalone)} times as a standalone word and ${fmt(within)} times attached to particles or inside other words (e.g. with waw, baa or the preposition lam) — ${fmt(counted.total)} positions in total, after removing diacritics and unifying alif forms.`,
    stats: scope === null ? topSurahStats(counted, lang) : undefined,
    references,
  };
}
