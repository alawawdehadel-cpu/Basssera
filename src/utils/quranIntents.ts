import type { AnswerReference, TafseerGroup } from '../types/data.types';
import type { WordMeaningsMap, QuranTopicsMap } from '../types/data.types';
import type { AppLanguage } from '../types/chat.types';
import { normalizeText } from './textNormalizer';
import { resolveNamedAyah } from './namedAyahs';
import wordMeaningsRaw from '../data/wordMeanings.json';
import quranTopicsRaw from '../data/quranTopics.json';

/**
 * ============================================================
 *  Extended Quran/Tafseer intents — everything beyond plain
 *  counting analytics (see quranAnalytics.ts) and the
 *  surah/ayah reference + keyword search already handled in
 *  chatbotSearch.ts: tafsir explanation of a quoted phrase,
 *  word-meaning lookup, topic/prophet-story ayah collections,
 *  surah metadata, phrase location, prev/next ayah, starts/ends
 *  -with search, exact-phrase counting, and extractive summaries.
 *
 *  Every answer is either a literal excerpt of the local dataset
 *  (src/data/tafseer_saadi.json) or a clear "not found" message —
 *  nothing here ever generates Quran text or tafsir content.
 * ============================================================
 */

const wordMeanings = wordMeaningsRaw as WordMeaningsMap;
const quranTopics = quranTopicsRaw as QuranTopicsMap;

export interface IntentResult {
  kind: 'answer' | 'clarify';
  source?: 'tafseer' | 'metadata';
  title?: string;
  answer?: string;
  references?: AnswerReference[];
  note?: string;
}

const MISSING_DATA_AR =
  'لم أجد مصدرًا كافيًا داخل بيانات التطبيق للإجابة على هذا السؤال.';
const MISSING_DATA_EN =
  'I could not find a sufficient source within the app data to answer this question.';

function missingData(lang: AppLanguage): IntentResult {
  return { kind: 'clarify', answer: lang === 'ar' ? MISSING_DATA_AR : MISSING_DATA_EN };
}

function arabicScriptClarify(lang: AppLanguage): IntentResult {
  return {
    kind: 'clarify',
    answer:
      lang === 'ar'
        ? 'أحتاج الكلمة أو العبارة بالرسم العربي لأبحث عنها في القرآن.'
        : 'I need the word or phrase written in Arabic script to search the Quran.',
  };
}

const LATIN_RE = /[a-z]/;

/* ------------------------------------------------------------------ */
/* Lazily-built flattened per-ayah index + surah metadata               */
/* ------------------------------------------------------------------ */

interface FlatAyah {
  surah: number;
  surahName: string;
  surahNameEn: string;
  ayahNumber: number;
  text: string;
  normText: string;
  /** normText with internal (non-word-initial) alifs collapsed — see looseAlifKey(). */
  looseText: string;
  /** Index into the source `groups` array of the owning tafsir group. */
  groupIdx: number;
}

/**
 * Collapses internal (non-word-initial) alifs so a phrase typed with
 * standard modern spelling (e.g. «العالمين», «الكتاب») can still match
 * Quranic rasm text, which sometimes omits the letter alif in favor of
 * a diacritic mark that normalizeText strips without replacement (e.g.
 * the dataset's own normalized form is «العلمين», «الكتب»). Applied
 * symmetrically to both the corpus and the user's query so exact
 * counting elsewhere (quranAnalytics.ts) is left untouched — this is a
 * local, looser fallback used only for the phrase-search intents below.
 */
function looseAlifKey(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === 'ا' && i > 0 && s[i - 1] !== ' ') continue;
    out += ch;
  }
  return out;
}

/** True if `phrase` occurs in `a.normText`, or its loose (alif-insensitive) form does. */
function ayahContainsPhrase(a: FlatAyah, phrase: string, loosePhrase: string): boolean {
  return a.normText.includes(phrase) || a.looseText.includes(loosePhrase);
}

interface SurahMeta {
  number: number;
  name: string;
  nameEn: string;
  type: string;
  ayahCount: number;
}

let flatAyahs: FlatAyah[] = [];
let surahMetaMap = new Map<number, SurahMeta>();
let surahNameLookup = new Map<string, number>();
let indexedSource: TafseerGroup[] | null = null;

/** Generate matchable name variants for a surah (Arabic + transliteration). */
function surahNameVariants(g: TafseerGroup): string[] {
  const variants = new Set<string>();
  const arabic = normalizeText(g.surah_name);
  if (arabic) {
    variants.add(arabic);
    if (arabic.startsWith('ال') && arabic.length > 4) variants.add(arabic.slice(2));
  }
  const translit = normalizeText(g.surah_transliteration ?? '');
  if (translit) {
    variants.add(translit);
    const compact = translit.replace(/\s+/g, '');
    variants.add(compact);
    const noArticle = compact.replace(/^a([lstdrzn])\1?/, '').replace(/^al/, '');
    if (noArticle.length > 3) {
      variants.add(noArticle);
      if (noArticle.endsWith('h')) variants.add(noArticle.slice(0, -1));
    }
  }
  return [...variants];
}

function ensureIndex(groups: TafseerGroup[]): void {
  if (indexedSource === groups) return;
  flatAyahs = [];
  surahMetaMap = new Map();
  surahNameLookup = new Map();

  groups.forEach((g, groupIdx) => {
    for (const a of g.ayahs) {
      flatAyahs.push({
        surah: g.surah,
        surahName: g.surah_name,
        surahNameEn: g.surah_transliteration,
        ayahNumber: a.number,
        text: a.text,
        normText: normalizeText(a.text),
        looseText: looseAlifKey(normalizeText(a.text)),
        groupIdx,
      });
    }
    const meta = surahMetaMap.get(g.surah);
    if (meta) meta.ayahCount += g.ayahs.length;
    else
      surahMetaMap.set(g.surah, {
        number: g.surah,
        name: g.surah_name,
        nameEn: g.surah_transliteration,
        type: g.surah_type,
        ayahCount: g.ayahs.length,
      });
    for (const variant of surahNameVariants(g)) {
      if (!surahNameLookup.has(variant)) surahNameLookup.set(variant, g.surah);
    }
  });
  indexedSource = groups;
}

/** Longest matching surah-name variant contained in `normQuery`, if any. */
function findSurahInQuery(normQuery: string): number | null {
  let matched: number | null = null;
  let matchedLen = 0;
  for (const [variant, num] of surahNameLookup) {
    if (variant.length <= matchedLen) continue;
    if (` ${normQuery} `.includes(` ${variant} `) || normQuery === variant) {
      matched = num;
      matchedLen = variant.length;
    }
  }
  return matched;
}

function ayahRef(a: FlatAyah, lang: AppLanguage): AnswerReference {
  return {
    type: 'quran',
    surah: lang === 'ar' ? a.surahName : a.surahNameEn,
    ayah: String(a.ayahNumber),
    text: a.text,
  };
}

const MAX_RESULTS = 12;

/* ------------------------------------------------------------------ */
/* Shared token-cleanup fillers                                        */
/* ------------------------------------------------------------------ */

const STRUCTURAL_FILLERS = new Set(
  [
    'اشرح', 'فسر', 'شرح', 'تفسير', 'ما', 'اي', 'أي', 'معنى', 'معني', 'كلمه', 'الكلمه',
    'ماذا', 'تعني', 'تعنى', 'قوله', 'تعالى', 'تعالي', 'اية', 'ايه', 'الايه',
    'الآية', 'آية', 'قصه', 'قصة', 'عن', 'هات', 'ايات', 'الايات', 'آيات',
    'يقول', 'القران', 'الكريم', 'في', 'من', 'سوره', 'سورة', 'لخص', 'ملخص',
    'التي', 'تبدا', 'تبدأ', 'تنتهي', 'بـ', 'ب', 'عباره', 'عبارة', 'جمله',
    'جملة', 'وردت', 'ورد', 'ذكرت', 'ذكر', 'كم', 'مره', 'مرة', 'توجد', 'اين',
    'أين', 'وجدت', 'موجوده',
  ].map(normalizeText),
);

function extractPhrase(normQuery: string, extraStripRegexes: RegExp[] = []): string {
  let q = ` ${normQuery} `;
  for (const re of extraStripRegexes) q = q.replace(re, ' ');
  const words = q
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !STRUCTURAL_FILLERS.has(w));
  return words.join(' ').trim();
}

/* ------------------------------------------------------------------ */
/* 1) Tafsir explanation of a quoted phrase — «اشرح قوله تعالى ...»      */
/* ------------------------------------------------------------------ */

const EXPLAIN_TRIGGER = /(^|\s)(اشرح|فسر)(\s|$)|ما\s*تفسير/;

/** Builds the standard "tafsir of this group's ayah(s)" answer — shared by the phrase-search and named-ayah paths. */
function explainGroup(group: TafseerGroup, lang: AppLanguage): IntentResult {
  const range =
    group.ayah_start === group.ayah_end
      ? `${group.ayah_start}`
      : `${group.ayah_start}–${group.ayah_end}`;

  return {
    kind: 'answer',
    source: 'tafseer',
    title:
      lang === 'ar'
        ? `تفسير سورة ${group.surah_name} — الآية ${range}`
        : `Tafsir of Surah ${group.surah_transliteration} — Ayah ${range}`,
    answer: group.explanation,
    references: [
      {
        type: 'quran',
        surah: lang === 'ar' ? group.surah_name : group.surah_transliteration,
        ayah: range,
        text: group.ayah_text,
      },
    ],
  };
}

function handleExplainPhrase(
  normQuery: string,
  groups: TafseerGroup[],
  lang: AppLanguage,
): IntentResult | null {
  if (!EXPLAIN_TRIGGER.test(normQuery)) return null;

  // Well-known nicknames (e.g. «آية الكرسي») resolve directly — the
  // nickname never literally appears inside the ayah's own text, so
  // the phrase search below would never find it on its own.
  const named = resolveNamedAyah(normQuery);
  if (named) {
    const hit = flatAyahs.find((a) => a.surah === named.surah && a.ayahNumber === named.ayah);
    if (hit) return explainGroup(groups[hit.groupIdx], lang);
  }

  // Surah/ayah-number style references are already handled upstream by
  // searchByReference in chatbotSearch.ts — only handle the "quoted
  // phrase, no reference given" case here.
  if (/\d/.test(normQuery)) return null;
  if (findSurahInQuery(normQuery) !== null) return null;

  const phrase = extractPhrase(normQuery);
  if (!phrase || phrase.length < 2) return null;
  if (LATIN_RE.test(phrase)) return arabicScriptClarify(lang);

  const loosePhrase = looseAlifKey(phrase);
  const hit = flatAyahs.find((a) => ayahContainsPhrase(a, phrase, loosePhrase));
  if (!hit) return missingData(lang);

  return explainGroup(groups[hit.groupIdx], lang);
}

/* ------------------------------------------------------------------ */
/* 2) Word meaning — «ما معنى كلمة ...»                                 */
/* ------------------------------------------------------------------ */

const MEANING_TRIGGER = /معنى|معني|تعني|تعنى/;

function handleWordMeaning(
  normQuery: string,
  groups: TafseerGroup[],
  lang: AppLanguage,
): IntentResult | null {
  if (!MEANING_TRIGGER.test(normQuery)) return null;

  const word = extractPhrase(normQuery);
  if (!word || word.length < 2) return null;
  if (LATIN_RE.test(word)) return arabicScriptClarify(lang);

  // 1) curated meanings file (empty today; populate src/data/wordMeanings.json)
  const curated = wordMeanings[word];
  if (curated) {
    return {
      kind: 'answer',
      source: 'tafseer',
      answer: curated,
      note:
        lang === 'ar'
          ? 'المعنى من قائمة معاني الكلمات المعتمدة داخل التطبيق.'
          : 'Meaning from the app’s curated word-meanings list.',
    };
  }

  // 2) fall back to searching the tafsir explanation text for the word.
  const looseWord = looseAlifKey(word);
  let best: { entry: FlatAyah; score: number } | null = null;
  for (const a of flatAyahs) {
    if (!ayahContainsPhrase(a, word, looseWord)) continue;
    const score = a.normText === word ? 3 : 1;
    if (!best || score > best.score) best = { entry: a, score };
  }
  if (!best) return missingData(lang);

  const group = groups[best.entry.groupIdx];
  return {
    kind: 'answer',
    source: 'tafseer',
    title:
      lang === 'ar'
        ? `معنى «${word}» في سياق سورة ${best.entry.surahName}`
        : `Meaning of "${word}" in the context of Surah ${best.entry.surahNameEn}`,
    answer: group.explanation,
    note:
      lang === 'ar'
        ? 'المعنى مستخرج من نص التفسير المحلي، وليس قاموسًا مستقلًا.'
        : 'Meaning extracted from the local tafsir text, not a standalone dictionary.',
    references: [ayahRef(best.entry, lang)],
  };
}

/* ------------------------------------------------------------------ */
/* 3+4) Topic / prophet-story questions — «آيات عن ...», «قصة موسى»     */
/* ------------------------------------------------------------------ */

const TOPIC_TRIGGER = /(^|\s)(ايات عن|هات ايات|قصه|قصة|اين ذكرت قصه)|what does the quran say about|verses about|story of/;

function handleTopicOrStory(
  normQuery: string,
  groups: TafseerGroup[],
  lang: AppLanguage,
): IntentResult | null {
  if (!TOPIC_TRIGGER.test(normQuery)) return null;

  const topic = extractPhrase(normQuery);
  if (!topic || topic.length < 2) return null;
  if (LATIN_RE.test(topic)) return arabicScriptClarify(lang);

  // 1) curated topics file (empty today; populate src/data/quranTopics.json)
  const curatedRefs = quranTopics[topic];
  if (curatedRefs && curatedRefs.length > 0) {
    const references: AnswerReference[] = [];
    for (const r of curatedRefs.slice(0, MAX_RESULTS)) {
      const hit = flatAyahs.find((a) => a.surah === r.surah && a.ayahNumber === r.ayah);
      if (hit) references.push(ayahRef(hit, lang));
    }
    if (references.length > 0) {
      return {
        kind: 'answer',
        source: 'tafseer',
        answer:
          lang === 'ar'
            ? `آيات متعلقة بموضوع «${topic}» من قائمة المواضيع المعتمدة داخل التطبيق.`
            : `Ayahs related to "${topic}" from the app's curated topics list.`,
        references,
      };
    }
  }

  // 2) fall back to searching ayah text + tafsir explanation for the topic word.
  const looseTopic = looseAlifKey(topic);
  const matches = flatAyahs.filter((a) => ayahContainsPhrase(a, topic, looseTopic));
  if (matches.length === 0) {
    // widen to tafsir explanations too, in case the word appears only in the commentary.
    const explMatches: FlatAyah[] = [];
    groups.forEach((g, groupIdx) => {
      if (normalizeText(g.explanation).includes(topic)) {
        const first = flatAyahs.find((a) => a.groupIdx === groupIdx);
        if (first) explMatches.push(first);
      }
    });
    if (explMatches.length === 0) return missingData(lang);
    const shown = explMatches.slice(0, MAX_RESULTS);
    return {
      kind: 'answer',
      source: 'tafseer',
      answer:
        lang === 'ar'
          ? `وجدت ذكرًا لموضوع «${topic}» في تفسير ${shown.length} موضعًا من القرآن الكريم.`
          : `Found mentions related to "${topic}" in the tafsir of ${shown.length} place(s) in the Quran.`,
      references: shown.map((a) => ayahRef(a, lang)),
      note:
        lang === 'ar'
          ? 'نتائج من نص التفسير (وليست من نص الآيات مباشرة).'
          : 'Results from the tafsir text (not the ayah text directly).',
    };
  }

  const shown = matches.slice(0, MAX_RESULTS);
  const truncated = matches.length > shown.length;
  return {
    kind: 'answer',
    source: 'tafseer',
    answer:
      lang === 'ar'
        ? `آيات ذات صلة بـ«${topic}» من نص القرآن الكريم المتوفر لديّ${truncated ? ` (يُعرض أول ${shown.length} من ${matches.length})` : ''}.`
        : `Ayahs related to "${topic}" from the Quran text available to me${truncated ? ` (showing the first ${shown.length} of ${matches.length})` : ''}.`,
    references: shown.map((a) => ayahRef(a, lang)),
  };
}

/* ------------------------------------------------------------------ */
/* 5) Surah metadata — «كم عدد آيات سورة ...», «مكية أم مدنية؟»          */
/* ------------------------------------------------------------------ */

const META_AYAH_COUNT_RE = /عدد\s*(ال)?ايات/;
const META_TYPE_RE = /مكيه|مدنيه|meccan|medinan/;
const META_ORDER_RE = /ترتيب/;
const META_BY_NUMBER_RE = /السوره\s*رقم\s*(\d+)|surah\s*(number|#)?\s*(\d+)/;

function handleSurahMetadata(
  normQuery: string,
  lang: AppLanguage,
): IntentResult | null {
  const numberMatch = normQuery.match(META_BY_NUMBER_RE);
  if (numberMatch) {
    const n = Number(numberMatch[1] ?? numberMatch[3]);
    const meta = surahMetaMap.get(n);
    if (!meta) return missingData(lang);
    return {
      kind: 'answer',
      source: 'metadata',
      answer:
        lang === 'ar'
          ? `السورة رقم ${n} في ترتيب المصحف هي سورة ${meta.name}، وعدد آياتها ${meta.ayahCount}، وهي ${meta.type === 'meccan' ? 'مكية' : 'مدنية'}.`
          : `Surah number ${n} in the mushaf order is Surah ${meta.nameEn}, with ${meta.ayahCount} ayahs, and it is ${meta.type === 'meccan' ? 'Meccan' : 'Medinan'}.`,
    };
  }

  const isAyahCount = META_AYAH_COUNT_RE.test(normQuery);
  const isType = META_TYPE_RE.test(normQuery);
  const isOrder = META_ORDER_RE.test(normQuery);
  if (!isAyahCount && !isType && !isOrder) return null;

  const surahNum = findSurahInQuery(normQuery);
  if (surahNum === null) return missingData(lang);
  const meta = surahMetaMap.get(surahNum);
  if (!meta) return missingData(lang);

  if (isAyahCount) {
    return {
      kind: 'answer',
      source: 'metadata',
      answer:
        lang === 'ar'
          ? `عدد آيات سورة ${meta.name} هو ${meta.ayahCount} آية.`
          : `Surah ${meta.nameEn} has ${meta.ayahCount} ayahs.`,
    };
  }
  if (isType) {
    return {
      kind: 'answer',
      source: 'metadata',
      answer:
        lang === 'ar'
          ? `سورة ${meta.name} ${meta.type === 'meccan' ? 'مكية' : 'مدنية'}.`
          : `Surah ${meta.nameEn} is ${meta.type === 'meccan' ? 'Meccan' : 'Medinan'}.`,
    };
  }
  // isOrder — the dataset only carries mushaf (compilation) order, not the
  // historical revelation order, and this is stated explicitly.
  return {
    kind: 'answer',
    source: 'metadata',
    answer:
      lang === 'ar'
        ? `ترتيب سورة ${meta.name} في المصحف هو ${meta.number}. (بيانات التطبيق لا تتضمن ترتيب النزول، بل ترتيب المصحف فقط.)`
        : `Surah ${meta.nameEn}'s position in the mushaf order is ${meta.number}. (The app's data does not include revelation order, only mushaf order.)`,
  };
}

/* ------------------------------------------------------------------ */
/* 6) Ayah location by exact phrase — «في أي سورة وردت عبارة ...»       */
/* ------------------------------------------------------------------ */

const LOCATE_PHRASE_TRIGGER = /اي\s*سوره\s*وردت|اين\s*توجد\s*ايه|which surah|where is the ayah/;

function handleLocateByPhrase(normQuery: string, lang: AppLanguage): IntentResult | null {
  if (!LOCATE_PHRASE_TRIGGER.test(normQuery)) return null;

  // Well-known nicknames (e.g. «آية الكرسي») resolve directly — the
  // nickname never literally appears inside the ayah's own text, so
  // the phrase search below would never find it on its own.
  const named = resolveNamedAyah(normQuery);
  const namedHit = named
    ? flatAyahs.find((a) => a.surah === named.surah && a.ayahNumber === named.ayah)
    : undefined;
  if (namedHit) {
    return {
      kind: 'answer',
      source: 'tafseer',
      answer:
        lang === 'ar'
          ? `توجد في: سورة ${namedHit.surahName} — آية ${namedHit.ayahNumber}.`
          : `It is found in: Surah ${namedHit.surahNameEn} (ayah ${namedHit.ayahNumber}).`,
      references: [ayahRef(namedHit, lang)],
    };
  }

  const phrase = extractPhrase(normQuery);
  if (!phrase || phrase.length < 2) return null;
  if (LATIN_RE.test(phrase)) return arabicScriptClarify(lang);

  const loosePhrase = looseAlifKey(phrase);
  const matches = flatAyahs.filter((a) => ayahContainsPhrase(a, phrase, loosePhrase));
  if (matches.length === 0) return missingData(lang);

  const shown = matches.slice(0, MAX_RESULTS);
  const listAr = shown.map((a) => `سورة ${a.surahName} — آية ${a.ayahNumber}`).join('، ');
  const listEn = shown.map((a) => `Surah ${a.surahNameEn} (ayah ${a.ayahNumber})`).join(', ');

  return {
    kind: 'answer',
    source: 'tafseer',
    answer:
      lang === 'ar'
        ? `وردت هذه العبارة في: ${listAr}.`
        : `This phrase appears in: ${listEn}.`,
    references: shown.map((a) => ayahRef(a, lang)),
  };
}

/* ------------------------------------------------------------------ */
/* 7) Previous / next ayah                                              */
/* ------------------------------------------------------------------ */

const PREV_NEXT_TRIGGER = /الايه\s*قبل|الايه\s*بعد|السابقه|اللاحقه|ayah before|ayah after|previous ayah|next ayah/;

function findAyahByNumber(surah: number, ayahNumber: number): FlatAyah | null {
  return flatAyahs.find((a) => a.surah === surah && a.ayahNumber === ayahNumber) ?? null;
}

function handlePrevNextAyah(normQuery: string, lang: AppLanguage): IntentResult | null {
  if (!PREV_NEXT_TRIGGER.test(normQuery)) return null;

  const surahNum = findSurahInQuery(normQuery);
  const numbers = (normQuery.match(/\d+/g) ?? []).map(Number);
  if (surahNum === null || numbers.length === 0) return missingData(lang);

  const ayahNumber = numbers[0];
  const current = findAyahByNumber(surahNum, ayahNumber);
  if (!current) return missingData(lang);

  const wantPrev = /قبل|before|previous/.test(normQuery);
  const wantNext = /بعد|after|next/.test(normQuery);
  const wantBoth = /سابق.*لاحق|لاحق.*سابق/.test(normQuery) || (!wantPrev && !wantNext);

  const prev = findAyahByNumber(surahNum, ayahNumber - 1);
  const next = findAyahByNumber(surahNum, ayahNumber + 1);

  const references: AnswerReference[] = [];
  const parts: string[] = [];

  if ((wantPrev || wantBoth) ) {
    if (prev) {
      references.push(ayahRef(prev, lang));
      parts.push(
        lang === 'ar'
          ? `الآية السابقة (${prev.ayahNumber}): موجودة.`
          : `Previous ayah (${prev.ayahNumber}): found.`,
      );
    } else {
      parts.push(
        lang === 'ar'
          ? 'لا توجد آية سابقة (هذه أول آية في السورة).'
          : 'There is no previous ayah (this is the first ayah of the surah).',
      );
    }
  }
  if ((wantNext || wantBoth)) {
    if (next) {
      references.push(ayahRef(next, lang));
      parts.push(
        lang === 'ar'
          ? `الآية اللاحقة (${next.ayahNumber}): موجودة.`
          : `Next ayah (${next.ayahNumber}): found.`,
      );
    } else {
      parts.push(
        lang === 'ar'
          ? 'لا توجد آية لاحقة (هذه آخر آية في السورة).'
          : 'There is no next ayah (this is the last ayah of the surah).',
      );
    }
  }

  if (references.length === 0) {
    return {
      kind: 'answer',
      source: 'tafseer',
      answer: parts.join(' '),
    };
  }

  return {
    kind: 'answer',
    source: 'tafseer',
    answer: parts.join(' '),
    references,
  };
}

/* ------------------------------------------------------------------ */
/* 8) Starts with / ends with                                           */
/* ------------------------------------------------------------------ */

const STARTS_WITH_RE = /تبدا\s*ب|تبدأ\s*ب|starts? with/;
const ENDS_WITH_RE = /تنتهي\s*ب|ends? with/;

function handleStartsEndsWith(normQuery: string, lang: AppLanguage): IntentResult | null {
  const isStarts = STARTS_WITH_RE.test(normQuery);
  const isEnds = ENDS_WITH_RE.test(normQuery);
  if (!isStarts && !isEnds) return null;

  const phrase = extractPhrase(normQuery);
  if (!phrase || phrase.length < 1) return null;
  if (LATIN_RE.test(phrase)) return arabicScriptClarify(lang);

  const matches = flatAyahs.filter((a) =>
    isStarts ? a.normText.startsWith(phrase) : a.normText.endsWith(phrase),
  );

  const wantsCountOnly = /كم\s*ايه/.test(normQuery) || /how many/.test(normQuery);

  if (matches.length === 0) {
    return {
      kind: 'answer',
      source: 'tafseer',
      answer:
        lang === 'ar'
          ? `لم أجد آيات ${isStarts ? 'تبدأ' : 'تنتهي'} بـ«${phrase}» في البيانات المتوفرة لديّ.`
          : `I could not find ayahs that ${isStarts ? 'start' : 'end'} with «${phrase}» in the data available to me.`,
    };
  }

  if (wantsCountOnly) {
    return {
      kind: 'answer',
      source: 'tafseer',
      answer:
        lang === 'ar'
          ? `عدد الآيات التي ${isStarts ? 'تبدأ' : 'تنتهي'} بـ«${phrase}»: ${matches.length}.`
          : `Number of ayahs that ${isStarts ? 'start' : 'end'} with «${phrase}»: ${matches.length}.`,
    };
  }

  const shown = matches.slice(0, MAX_RESULTS);
  const truncated = matches.length > shown.length;
  return {
    kind: 'answer',
    source: 'tafseer',
    answer:
      lang === 'ar'
        ? `الآيات التي ${isStarts ? 'تبدأ' : 'تنتهي'} بـ«${phrase}» (${matches.length} آية${truncated ? `، يُعرض أول ${shown.length}` : ''}):`
        : `Ayahs that ${isStarts ? 'start' : 'end'} with «${phrase}» (${matches.length} ayah(s)${truncated ? `, showing the first ${shown.length}` : ''}):`,
    references: shown.map((a) => ayahRef(a, lang)),
  };
}

/* ------------------------------------------------------------------ */
/* 9) Exact phrase count — «كم مرة وردت عبارة ...»                       */
/* ------------------------------------------------------------------ */

const PHRASE_COUNT_TRIGGER = /كم\s*مره\s*(وردت|ذكرت)\s*(عباره|جمله)/;

function countSub(haystack: string, needle: string): number {
  let n = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    n += 1;
    pos = haystack.indexOf(needle, pos + needle.length);
  }
  return n;
}

function handlePhraseCount(normQuery: string, lang: AppLanguage): IntentResult | null {
  if (!PHRASE_COUNT_TRIGGER.test(normQuery)) return null;

  const phrase = extractPhrase(normQuery);
  if (!phrase || phrase.length < 2) return null;
  if (LATIN_RE.test(phrase)) return arabicScriptClarify(lang);

  const loosePhrase = looseAlifKey(phrase);
  const matches = flatAyahs.filter((a) => ayahContainsPhrase(a, phrase, loosePhrase));
  const total = matches.reduce(
    (sum, a) => sum + Math.max(countSub(a.normText, phrase), countSub(a.looseText, loosePhrase)),
    0,
  );

  if (total === 0) {
    return {
      kind: 'answer',
      source: 'tafseer',
      answer:
        lang === 'ar'
          ? `لم أجد عبارة «${phrase}» في نص القرآن الكريم المتوفر لديّ.`
          : `I could not find the phrase «${phrase}» in the Quran text available to me.`,
    };
  }

  return {
    kind: 'answer',
    source: 'tafseer',
    answer:
      lang === 'ar'
        ? `وردت عبارة «${phrase}» ${total} مرة، في ${matches.length} آية.`
        : `The phrase «${phrase}» appears ${total} time(s), across ${matches.length} ayah(s).`,
    note:
      lang === 'ar'
        ? 'حُسبت آليًا من نص المصحف المضمّن في بيانات التطبيق بعد إزالة التشكيل.'
        : 'Computed automatically from the mushaf text bundled with this app, after removing diacritics.',
    references: matches.slice(0, MAX_RESULTS).map((a) => ayahRef(a, lang)),
  };
}

/* ------------------------------------------------------------------ */
/* 10) Summarization — «لخص تفسير سورة ...», «لخص تفسير آية ...»          */
/* ------------------------------------------------------------------ */

const SUMMARIZE_TRIGGER = /(^|\s)(لخص|ملخص)(\s|$)/;

/** Extractive-only shortening: first ~2 sentences, never paraphrased. */
function extractiveSummary(text: string, maxChars: number): string {
  const sentences = text.split(/(?<=[.؟!])\s+|\n+/).filter(Boolean);
  let out = '';
  for (const s of sentences) {
    if (out.length + s.length > maxChars && out.length > 0) break;
    out += (out ? ' ' : '') + s;
    if (out.length >= maxChars) break;
  }
  return out || text.slice(0, maxChars);
}

function handleSummarize(
  normQuery: string,
  groups: TafseerGroup[],
  lang: AppLanguage,
): IntentResult | null {
  if (!SUMMARIZE_TRIGGER.test(normQuery)) return null;

  const surahNum = findSurahInQuery(normQuery);
  if (surahNum === null) return missingData(lang);

  const numbers = (normQuery.match(/\d+/g) ?? []).map(Number);
  const surahGroups = groups
    .map((g, idx) => ({ g, idx }))
    .filter(({ g }) => g.surah === surahNum);
  if (surahGroups.length === 0) return missingData(lang);

  // «لخص تفسير آية N من سورة ...» — summarize a single ayah's tafsir group.
  if (numbers.length > 0) {
    const ayahNumber = numbers[0];
    const hit = surahGroups.find(
      ({ g }) => g.ayah_start <= ayahNumber && g.ayah_end >= ayahNumber,
    );
    if (!hit) return missingData(lang);
    const summary = extractiveSummary(hit.g.explanation, 350);
    const range =
      hit.g.ayah_start === hit.g.ayah_end ? `${hit.g.ayah_start}` : `${hit.g.ayah_start}–${hit.g.ayah_end}`;
    return {
      kind: 'answer',
      source: 'tafseer',
      title:
        lang === 'ar'
          ? `ملخص تفسير سورة ${hit.g.surah_name} — الآية ${range}`
          : `Summary of the tafsir of Surah ${hit.g.surah_transliteration} — Ayah ${range}`,
      answer: summary,
      note:
        lang === 'ar'
          ? 'ملخص مقتضب مقتطف حرفيًا من نص التفسير المحلي (وليس صياغة جديدة). لعرض التفسير كاملاً اطلب تفسير الآية مباشرة.'
          : 'A brief extract taken verbatim from the local tafsir text (not a rewritten summary). Ask for the full tafsir of the ayah to see it in full.',
      references: [
        {
          type: 'quran',
          surah: lang === 'ar' ? hit.g.surah_name : hit.g.surah_transliteration,
          ayah: range,
          text: hit.g.ayah_text,
        },
      ],
    };
  }

  // «لخص تفسير سورة ...» — one short extract per group, capped in length.
  const perGroupSummaries = surahGroups
    .slice(0, 6)
    .map(({ g }) => extractiveSummary(g.explanation, 160));
  const meta = surahMetaMap.get(surahNum);
  const truncatedNote =
    surahGroups.length > 6
      ? lang === 'ar'
        ? ` (السورة تحتوي ${surahGroups.length} مقطعًا تفسيريًا؛ عُرضت مقتطفات من أول 6 فقط)`
        : ` (the surah has ${surahGroups.length} tafsir passages; only the first 6 are excerpted)`
      : '';

  return {
    kind: 'answer',
    source: 'tafseer',
    title:
      lang === 'ar'
        ? `ملخص تفسير سورة ${meta?.name ?? surahNum}`
        : `Summary of the tafsir of Surah ${meta?.nameEn ?? surahNum}`,
    answer: perGroupSummaries.join(' … '),
    note:
      lang === 'ar'
        ? `مقتطفات حرفية مختصرة من نص التفسير المحلي، وليست صياغة جديدة.${truncatedNote}`
        : `Brief verbatim excerpts from the local tafsir text, not a rewritten summary.${truncatedNote}`,
  };
}

/* ------------------------------------------------------------------ */
/* Public dispatcher                                                    */
/* ------------------------------------------------------------------ */

/**
 * Tries every extended intent in priority order (most specific first) and
 * returns the first conclusive result, or null if none of these intents
 * were recognized in the query (the caller should then fall back to the
 * generic Q&A / keyword-tafsir search).
 */
export function tryExtendedIntents(
  normQuery: string,
  groups: TafseerGroup[] | null,
  lang: AppLanguage,
): IntentResult | null {
  if (!groups) return null;
  ensureIndex(groups);

  return (
    handleSummarize(normQuery, groups, lang) ??
    handlePrevNextAyah(normQuery, lang) ??
    handleStartsEndsWith(normQuery, lang) ??
    handlePhraseCount(normQuery, lang) ??
    handleSurahMetadata(normQuery, lang) ??
    handleWordMeaning(normQuery, groups, lang) ??
    handleExplainPhrase(normQuery, groups, lang) ??
    handleLocateByPhrase(normQuery, lang) ??
    handleTopicOrStory(normQuery, groups, lang)
  );
}
