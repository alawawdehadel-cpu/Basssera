import { normalizeText } from './textNormalizer';
import type { IntentDetectionResult, QuestionIntent } from '../types/intent.types';

/**
 * ============================================================
 *  Intent detection — classifies a question BEFORE any search runs.
 *
 *  This module only recognizes *shape* (trigger words/phrases in the
 *  normalized query); it never inspects the Quran/tafsir datasets and
 *  never decides an answer. The classification is then used by
 *  chatbotSearch.ts to try the right local system first.
 * ============================================================
 */

/* ------------------------------------------------------------------ */
/* Trigger patterns (all matched against normalizeText() output, so    */
/* tashkeel is already stripped and أ/إ/آ/ٱ→ا, ة→ه, ى→ي)                */
/* ------------------------------------------------------------------ */

/** «هل يجوز», «ما حكم», «هل حرام», «هل واجب», «فتوى» … — never answered directly. */
const FATWA_TRIGGERS = [
  'حكم', 'فتوى', 'حلال', 'حرام', 'يجوز', 'لا يجوز', 'واجب', 'مستحب',
  'مكروه', 'هل يجب', 'هل يجوز', 'هل يحرم', 'افتوني', 'أفتوني',
].map(normalizeText);

/** «كم عدد آيات سورة X», «هل سورة X مكية أم مدنية؟», «ما ترتيب سورة X؟», «ما السورة رقم N؟» */
const SURAH_INFO_RE = /عدد\s*(ال)?ايات|مكيه|مدنيه|ترتيب\s*سوره|السوره\s*رقم/;

/** «كم شدة …», «كم مرة ذكرت …», "how many …" — general Quran-text statistics. */
const QURAN_STATS_RE = /(^|\s)كم(\s|$)|(^|\s)(how many|count|number of)(\s|$)/;

/** «أين وردت كلمة …», «اعرض الآيات التي فيها كلمة …» — always anchored on «كلمة». */
const WORD_LOCATION_RE = /(اين|أين)[^.!؟]*كلمه|اعرض\s*الايات[^.!؟]*كلمه|فيها\s*كلمه/;

/** «اشرح …», «فسر …», «ما تفسير …» */
const TAFSIR_EXPLANATION_RE = /(^|\s)(اشرح|فسر)(\s|$)|ما\s*تفسير/;

/** «ما معنى …», «معنى …», «ماذا تعني …» (normalizeText turns ى→ي, so «معنى»→«معني»). */
const WORD_MEANING_RE = /معني|تعني/;

/** «آيات عن …», «هات آيات عن …», «ماذا يقول القرآن عن …», «قصة …» */
const TOPIC_AYAHS_RE = /ايات\s*عن|هات\s*ايات|قصه|ماذا\s*يقول\s*القران\s*عن/;

/** «في أي سورة وردت عبارة …», «أين توجد آية …», «ابحث عن …» */
const AYAH_SEARCH_RE = /في\s*اي\s*سوره\s*وردت|اين\s*توجد\s*ايه|(^|\s)ابحث\s*عن(\s|$)/;

/**
 * «حديث عن الصبر», «ما هو الحديث الذي …», «قال رسول الله …»
 *
 * The only intent whose answer does NOT come from the bundled datasets —
 * it is served from الدرر السنية over the network (see hadithService.ts).
 * Detection stays purely lexical here, as with every other intent.
 */
const HADITH_LOOKUP_RE =
  /(^|\s)(حديث|حديثا|احاديث|الحديث|الاحاديث)(\s|$)|قال\s*رسول\s*الله|قال\s*النبي|عن\s*النبي|عن\s*رسول\s*الله|السنه\s*النبويه|(^|\s)(hadith|hadiths|ahadith|sunnah)(\s|$)/;

function isFatwaRequest(q: string): boolean {
  return FATWA_TRIGGERS.some((t) => ` ${q} `.includes(` ${t} `));
}

function classify(normalizedQuery: string): QuestionIntent {
  // Safety first: a ruling-style question must never be answered as a
  // regular tafsir/meaning/topic lookup, whatever else it also matches.
  if (isFatwaRequest(normalizedQuery)) return 'FATWA_SAFETY';

  // Checked ahead of every Quran matcher: naming a حديث is an unambiguous
  // signal, and none of the local systems below index hadith at all — so
  // "ما تفسير حديث ..." is better served by the narration itself than by a
  // tafsir lookup that can only miss.
  if (HADITH_LOOKUP_RE.test(normalizedQuery)) return 'HADITH_LOOKUP';

  // Checked ahead of the generic «كم» stats trigger: "كم عدد آيات سورة
  // البقرة؟" is about ONE surah's metadata, not a whole-Quran count.
  if (SURAH_INFO_RE.test(normalizedQuery)) return 'SURAH_INFO';

  // Checked ahead of QURAN_STATS too: "أين وردت كلمة..." always implies
  // a single-word location lookup, never a "كم" count, but shares no
  // trigger word with it so order here mainly documents precedence.
  if (WORD_LOCATION_RE.test(normalizedQuery)) return 'WORD_LOCATION';

  if (QURAN_STATS_RE.test(normalizedQuery)) return 'QURAN_STATS';

  if (TAFSIR_EXPLANATION_RE.test(normalizedQuery)) return 'TAFSIR_EXPLANATION';

  if (WORD_MEANING_RE.test(normalizedQuery)) return 'WORD_MEANING';

  if (TOPIC_AYAHS_RE.test(normalizedQuery)) return 'TOPIC_AYAHS';

  if (AYAH_SEARCH_RE.test(normalizedQuery)) return 'AYAH_SEARCH';

  return 'GENERAL_TAFSIR_SEARCH';
}

/**
 * Classifies a raw user question into a QuestionIntent, before any
 * dataset search runs. Pure and synchronous — safe to call on every
 * keystroke's-worth of a submitted question.
 */
export function detectIntent(rawQuery: string): IntentDetectionResult {
  const normalizedQuery = normalizeText(rawQuery);
  const isIntelligible = normalizedQuery.length >= 2 && /[a-z؀-ۿ]/.test(normalizedQuery);

  if (!isIntelligible) {
    return { intent: 'UNKNOWN', normalizedQuery, isIntelligible };
  }

  return { intent: classify(normalizedQuery), normalizedQuery, isIntelligible };
}
