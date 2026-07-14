import type { AnswerReference, TafseerGroup } from '../types/data.types';
import type { AppLanguage, MessageStats } from '../types/chat.types';
import { normalizeText } from './textNormalizer';

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

/** «ما أطول آية؟», «ما أقصر سورة؟» */
const SUPERLATIVE_TRIGGER = /اطول|اقصر|longest|shortest/;

/** «أيهما أكثر ذكرًا: … أم …», «قارن بين ذكر … و…» */
const COMPARISON_TRIGGER = /ايهما اكثر|قارن|compare|which is more/;

/** «… في جزء …», «… في صفحة …» — scope this app's dataset does not carry. */
const JUZ_PAGE_SCOPE_RE = /(^|\s)(جزء|الجزء|صفحه|الصفحه|juz|page)(\s|$)/;

/** Explicit request to include the matching ayahs, not only a count. */
const WANTS_DETAILS_RE = /مع\s*الايات|اعرض\s*الايات|مع\s*النص|with (the )?verses|show (the )?ayahs/;

const DATA_UNAVAILABLE_AR =
  'لا يمكن حساب هذه المعلومة بدقة لأن بيانات القرآن الكاملة غير متوفرة داخل التطبيق.';
const DATA_UNAVAILABLE_EN =
  'This cannot be calculated accurately because the complete Quran data is not available in the app.';

/** Generic words that carry no target information. */
const BASIC_FILLERS = new Set([
  'كم', 'في', 'من', 'القران', 'الكريم', 'المصحف', 'النص', 'كله', 'كاملا',
  'كامل', 'هل', 'يوجد', 'توجد', 'هناك',
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
        normText: normalizeText(a.text),
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
    text: a.text,
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

function handleSuperlative(
  normQuery: string,
  tokens: string[],
  entries: AnalyticsEntry[],
  scope: number | null,
  scopeName: string,
  lang: AppLanguage,
  note: string,
  title: string,
): AnalyticsOutcome {
  const wantLongest = /اطول|longest/.test(normQuery);
  const wantsAyah = tokens.some((t) => TOTAL_SETS.ayahs.has(t));
  const wantsSurah = tokens.some((t) => TOTAL_SETS.surahs.has(t));

  if (wantsAyah && !wantsSurah) {
    const ayahs = collectAyahs(entries, scope);
    if (ayahs.length === 0) return null;
    let best = ayahs[0];
    for (const a of ayahs) {
      const better = wantLongest ? a.text.length > best.text.length : a.text.length < best.text.length;
      if (better) best = a;
    }
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `${wantLongest ? 'أطول' : 'أقصر'} آية${scopeName} في البيانات المتوفرة لديّ (بعدد الأحرف كما وردت في المصحف) هي الآية ${best.ayahNumber} من سورة ${best.surahName}، وعدد أحرفها ${best.text.length}.`
          : `The ${wantLongest ? 'longest' : 'shortest'} ayah${scopeName} in the data available to me (by character count as written in the mushaf) is ayah ${best.ayahNumber} of Surah ${best.surahNameEn}, with ${best.text.length} characters.`,
      references: [ayahReference(best, lang)],
    };
  }

  if (wantsSurah) {
    const perSurah = new Map<number, { name: string; nameEn: string; ayahCount: number }>();
    for (const e of entries) {
      const existing = perSurah.get(e.group.surah);
      const count = e.group.ayahs.length;
      if (existing) existing.ayahCount += count;
      else
        perSurah.set(e.group.surah, {
          name: e.group.surah_name,
          nameEn: e.group.surah_transliteration,
          ayahCount: count,
        });
    }
    if (perSurah.size === 0) return null;
    let bestSurah: { name: string; nameEn: string; ayahCount: number } | null = null;
    for (const s of perSurah.values()) {
      if (
        !bestSurah ||
        (wantLongest ? s.ayahCount > bestSurah.ayahCount : s.ayahCount < bestSurah.ayahCount)
      ) {
        bestSurah = s;
      }
    }
    if (!bestSurah) return null;
    return {
      kind: 'answer', title, note,
      answer:
        lang === 'ar'
          ? `${wantLongest ? 'أطول' : 'أقصر'} سورة في البيانات المتوفرة لديّ (بعدد الآيات) هي سورة ${bestSurah.name}، وعدد آياتها ${bestSurah.ayahCount}.`
          : `The ${wantLongest ? 'longest' : 'shortest'} surah in the data available to me (by ayah count) is Surah ${bestSurah.nameEn}, with ${bestSurah.ayahCount} ayahs.`,
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

  // This dataset only carries surah/ayah boundaries — no juz or page data.
  if (JUZ_PAGE_SCOPE_RE.test(normQuery)) {
    return { kind: 'clarify', answer: lang === 'ar' ? DATA_UNAVAILABLE_AR : DATA_UNAVAILABLE_EN };
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

  // ---- optional surah scope: «... في سورة مريم» / "... in surah maryam"
  let q = ` ${normQuery} `;
  let scope: number | null = null;
  let scopeName = '';
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
      scopeName =
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
    const result = handleSuperlative(normQuery, tokens, entries, scope, scopeName, lang, note, title);
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
