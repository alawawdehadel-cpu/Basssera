#!/usr/bin/env node
/**
 * Deterministic tests for the multi-source tafsir engine.
 *
 * Runs the REAL TypeScript modules (analyzer + search) by transpiling them
 * on the fly with the bundled `typescript` compiler — no test framework and
 * no new dependencies. Asserts the behavior the spec requires: intent,
 * surah/ayah resolution, source detection, comparison, follow-up, and the
 * honest "not found" path when a requested source has no matching passage.
 *
 * Usage: npm run test:tafsir
 */
'use strict';

const fs = require('fs');
const ts = require('typescript');

// React Native global used by dataLoader for dev-only logging.
global.__DEV__ = false;

// Transpile .ts on require so we can load the app's real source directly.
require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { analyzeTafsirQuestion } = require('../src/utils/tafsir/tafsirQuestionAnalyzer.ts');
const { searchAnswer } = require('../src/utils/chatbotSearch.ts');
const { buildChatAnswer } = require('../src/utils/answerBuilder.ts');
const { detectIntent } = require('../src/utils/intentDetector.ts');
const { loadTafseerData } = require('../src/utils/dataLoader.ts');
const { resolveRequestedTafsirSources } = require('../src/utils/tafsirSources.ts');
const { planTafsirPassage } = require('../src/utils/tafsir/tafsirPlan.ts');
const { contentIdsFor } = require('../src/utils/tafsir/tafsirSearch.ts');
const { shouldSearchHadith, isQuranAnalyticsIntent } = require('../src/utils/hadithQuery.ts');
const { formatAyahMarker, stripExistingAyahMarker } = require('../src/utils/numerals.ts');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function setEq(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

/* ------------------------------------------------------------------ */
/* Remote-passage injection                                            */
/*                                                                     */
/* Tafsir text is no longer bundled: useAssistant resolves a plan,      */
/* fetches the passages it names, and injects them into searchAnswer.   */
/* These helpers reproduce that here with SYNTHETIC text.               */
/*                                                                     */
/* Synthetic on purpose. That the real corpus round-trips byte-for-byte */
/* is proved separately, over all 18,708 records, by                    */
/*   node scripts/firebase/importTafsir.mjs --self-check                */
/* What this harness must prove is the PLUMBING: that the right source  */
/* gets the right text, that ordering and grouping hold, and above all  */
/* that one scholar's words never appear under another's name. Tagging  */
/* each fixture with its own source id makes that violation visible.    */
/* ------------------------------------------------------------------ */

function planFor(query, opts) {
  return planTafsirPassage(query, detectIntent(query).intent, opts);
}

/** Synthetic passage text for every content id the plan needs. */
function injectionFor(query, opts) {
  const plan = planFor(query, opts);
  if (plan.kind !== 'retrieve') return { plan, prefetchedMatches: new Map() };
  const ids = contentIdsFor(plan.sources, plan.surahNumber, plan.ayahStart, plan.ayahEnd);
  // Long enough (>601 chars) to exercise the excerpt/truncation path, and
  // tagged with the source id so a card showing another scholar's text fails.
  const filler = 'ثم بيّن المفسّر معنى الآية وما تضمنته من الهدى والبيان. '.repeat(14);
  const prefetchedMatches = new Map(
    ids.map((id) => [id, `«${id.split('__')[0]}» نص تفسيري للاختبار (${id.slice(-6)}). ${filler}`]),
  );
  return { plan, prefetchedMatches };
}

/** searchAnswer with the passages this question needs already injected. */
function answerWithPassages(query, opts) {
  return searchAnswer(query, [], 'ar', { ...opts, ...injectionFor(query, opts) });
}

async function main() {
  console.log('══════ اختبارات محرك التفاسير ══════');
  const saadi = await loadTafseerData({ sources: ['al_saadi'] });

  // 1) exact ayah with surah
  {
    const a = analyzeTafsirQuestion('ما تفسير الآية 255 من سورة البقرة؟');
    console.log('١) تفسير آية محددة');
    check('intent = exact_ayah', a.intent === 'exact_ayah', a.intent);
    check('surah = 2', a.surahNumber === 2, String(a.surahNumber));
    check('ayah = 255', a.ayahStart === 255 && a.ayahEnd === 255, `${a.ayahStart}-${a.ayahEnd}`);
    check('no explicit source (uses UI/all)', a.requestedSources.length === 0);
  }

  // 2) named ayah + explicit source
  {
    const a = analyzeTafsirQuestion('اشرح آية الكرسي من تفسير ابن كثير.');
    console.log('٢) آية الكرسي من ابن كثير');
    check('intent = named_ayah', a.intent === 'named_ayah', a.intent);
    check('surah = 2, ayah = 255', a.surahNumber === 2 && a.ayahStart === 255);
    check('source = ibn_kathir only', setEq(a.requestedSources, ['ibn_kathir']), a.requestedSources.join(','));
  }

  // 3) comparison of two named sources, ordinal ayah
  {
    const a = analyzeTafsirQuestion('قارن بين الطبري والسعدي في الآية الأولى من سورة الفاتحة');
    console.log('٣) مقارنة الطبري والسعدي');
    check('intent = compare_tafsir', a.intent === 'compare_tafsir', a.intent);
    check('compareSources = true', a.compareSources === true);
    check('surah = 1, ayah = 1', a.surahNumber === 1 && a.ayahStart === 1, `${a.surahNumber}:${a.ayahStart}`);
    check('sources = tabari + saadi', setEq(a.requestedSources, ['al_tabari', 'al_saadi']), a.requestedSources.join(','));
  }

  // 4) Quran phrase — resolved (not guessed); this phrase is ambiguous.
  {
    const a = analyzeTafsirQuestion('ما تفسير قوله تعالى إن مع العسر يسرا؟');
    console.log('٤) عبارة قرآنية');
    check('intent = quran_phrase', a.intent === 'quran_phrase', a.intent);
    check('did not guess a single ayah (ambiguous)', a.needsClarification === true, `clar=${a.needsClarification}`);
  }

  // 5) surah stats → NOT tafsir
  {
    const intent = detectIntent('كم عدد آيات سورة البقرة؟').intent;
    const r = searchAnswer('كم عدد آيات سورة البقرة؟', saadi, 'ar');
    console.log('٥) عدد آيات سورة');
    check('detected SURAH_INFO', intent === 'SURAH_INFO', intent);
    check('no tafsir cards', !r.tafsirMatches);
  }

  // 6) "open surah" → existing behavior, not multi-source cards
  {
    const r = searchAnswer('افتح سورة الكهف', saadi, 'ar');
    console.log('٦) فتح سورة');
    check('no multi-source tafsir cards', !r.tafsirMatches);
  }

  // 7) hadith
  {
    const intent = detectIntent('حديث عن بر الوالدين').intent;
    console.log('٧) حديث');
    check('detected HADITH_LOOKUP', intent === 'HADITH_LOOKUP', intent);
  }

  // 8) fatwa safety
  {
    const intent = detectIntent('هل هذا حرام؟').intent;
    const r = searchAnswer('هل هذا حرام؟', saadi, 'ar');
    console.log('٨) فتوى');
    check('detected FATWA_SAFETY', intent === 'FATWA_SAFETY', intent);
    check('clarify (referral), no tafsir cards', r.kind === 'clarify' && !r.tafsirMatches);
  }

  // 9) ayah number but no surah, no context → ask for surah
  {
    const a = analyzeTafsirQuestion('فسر الآية 5');
    console.log('٩) رقم آية بدون سورة');
    check('needsClarification (missing surah)', a.needsClarification === true && a.clarificationReason === 'missing_surah', a.clarificationReason);
  }

  // 10) follow-up keeps surah/ayah, switches source
  {
    const first = analyzeTafsirQuestion('ما تفسير آية الكرسي؟');
    const context = {
      lastSurahNumber: first.surahNumber,
      lastSurahName: first.surahName,
      lastAyahStart: first.ayahStart,
      lastAyahEnd: first.ayahEnd,
      lastSources: ['al_saadi'],
      lastWasComparison: false,
    };
    const a = analyzeTafsirQuestion('وماذا قال الطبري؟', context);
    console.log('١٠) سؤال متابعة');
    check('intent = follow_up', a.intent === 'follow_up', a.intent);
    check('kept surah 2 / ayah 255', a.surahNumber === 2 && a.ayahStart === 255, `${a.surahNumber}:${a.ayahStart}`);
    check('source switched to al_tabari', setEq(a.requestedSources, ['al_tabari']), a.requestedSources.join(','));
  }

  // 11) compare all three
  {
    const a = analyzeTafsirQuestion('قارن بين التفاسير الثلاثة في سورة الإخلاص');
    console.log('١١) مقارنة التفاسير الثلاثة');
    check('intent = compare_tafsir', a.intent === 'compare_tafsir', a.intent);
    check('all three sources', setEq(a.requestedSources, ['al_saadi', 'ibn_kathir', 'al_tabari']), a.requestedSources.join(','));
  }

  // 12a) a genuinely absent passage (out-of-range ayah) in a single requested
  // source → honest not-found, never a substitution from another source.
  {
    const r = searchAnswer('ما تفسير الآية 900 من سورة الإخلاص؟', saadi, 'ar', {
      selectedSources: ['ibn_kathir'],
    });
    console.log('١٢) لا نص مطابق في المصدر المطلوب');
    check('has per-source cards', Array.isArray(r.tafsirMatches) && r.tafsirMatches.length > 0);
    check('cards all marked not found', (r.tafsirMatches || []).every((m) => m.notFound), 'a card had text');
    check('only the requested source (no substitution)', (r.tafsirMatches || []).every((m) => m.source === 'ibn_kathir'));
    check('honest message', r.answer === 'لم أجد نصًا مطابقًا في التفسير المحدد داخل بيانات التطبيق.', r.answer);
  }

  // 12b) with real data, a specific source returns THAT source's real text.
  {
    const q = 'ما تفسير الآية 1 من سورة الإخلاص؟';
    const r = answerWithPassages(q, { selectedSources: ['al_tabari'] });
    console.log('١٢ب) نص المصدر المطلوب يصل كما هو');
    const m = (r.tafsirMatches || [])[0];
    check('card source is al_tabari', !!m && m.source === 'al_tabari', m && m.source);
    check('card carries the fetched text', !!m && !m.notFound && m.explanation.length > 0);
    check(
      'text belongs to al_tabari, not another source',
      !!m && m.explanation.includes('al_tabari'),
      m && m.explanation.slice(0, 40),
    );
  }

  // ---- display layer (buildChatAnswer → grouped source cards) ----

  // 13) الجميع → three grouped cards in fixed order, one passage each
  {
    const r = answerWithPassages('ما تفسير الآية 255 من سورة البقرة؟', {
      selectedSources: ['al_tabari', 'ibn_kathir', 'al_saadi'], // deliberately unordered
    });
    const a = buildChatAnswer(r, 'ar');
    console.log('١٣) عرض الجميع مرتبًا في بطاقات منفصلة');
    const ids = (a.tafsirGroups || []).map((g) => g.source);
    check('three groups', ids.length === 3, ids.join(','));
    check('fixed order saadi→ibn_kathir→tabari', ids.join(',') === 'al_saadi,ibn_kathir,al_tabari', ids.join(','));
    check('each group has one passage', (a.tafsirGroups || []).every((g) => g.passages.length === 1));
    check('no group marked missing', (a.tafsirGroups || []).every((g) => !g.notFound));
    check('tafsirReferences empty (no double render)', a.tafsirReferences.length === 0);
  }

  // 14) excerpt is word-safe, bounded, and marks truncation
  {
    const r = answerWithPassages('ما تفسير الآية 255 من سورة البقرة؟', {
      selectedSources: ['ibn_kathir'],
    });
    const a = buildChatAnswer(r, 'ar');
    const p = a.tafsirGroups[0].passages[0];
    console.log('١٤) المقتطف الآمن');
    check('excerpt shorter than full text', p.excerpt.length < p.explanation.length);
    check('excerpt ≤ ~601 chars', p.excerpt.length <= 601, String(p.excerpt.length));
    check('ends with ellipsis when truncated', p.excerpt.endsWith('…'));
    check('full explanation preserved intact', p.explanation.length > 601);
  }

  // 15) ayah range → multiple passages under ONE source card, ayah-sorted
  {
    const r = answerWithPassages('ما تفسير الآيات من 1 إلى 5 من سورة الفاتحة؟', {
      selectedSources: ['al_saadi'],
    });
    const a = buildChatAnswer(r, 'ar');
    const g = (a.tafsirGroups || [])[0];
    console.log('١٥) نطاق آيات في بطاقة مصدر واحدة');
    check('single source card', (a.tafsirGroups || []).length === 1, String((a.tafsirGroups || []).length));
    check('multiple passages under it', !!g && g.passages.length >= 2, g && String(g.passages.length));
    const sorted = g && g.passages.every((p, i, arr) => i === 0 || arr[i - 1].ayahStart <= p.ayahStart);
    check('passages ayah-sorted', !!sorted);
    const keys = g ? new Set(g.passages.map((p) => `${p.ayahStart}-${p.ayahEnd}-${p.explanation}`)) : new Set();
    check('no duplicate passages', g ? keys.size === g.passages.length : false);
  }

  // 16) missing passage → group flagged notFound, others unaffected
  {
    const r = searchAnswer('ما تفسير الآية 900 من سورة الإخلاص؟', saadi, 'ar', {
      selectedSources: ['al_saadi', 'ibn_kathir'],
    });
    const a = buildChatAnswer(r, 'ar');
    console.log('١٦) مصدر بلا نص مطابق');
    check('two groups present', (a.tafsirGroups || []).length === 2);
    check('all flagged notFound with no passages', (a.tafsirGroups || []).every((g) => g.notFound && g.passages.length === 0));
  }

  // 17) resolveRequestedTafsirSources priority (explicit > all > UI > all-three)
  {
    console.log('١٧) دالة ترتيب أولوية المصادر');
    const r = resolveRequestedTafsirSources;
    check('explicit wins over UI', setEq(r({ explicitlyRequestedSources: ['al_tabari'], asksForAllSources: false, uiSelectedSources: ['al_saadi'] }), ['al_tabari']));
    check('all-request → three', r({ explicitlyRequestedSources: [], asksForAllSources: true, uiSelectedSources: ['al_saadi'] }).length === 3);
    check('UI used when none named', setEq(r({ explicitlyRequestedSources: [], asksForAllSources: false, uiSelectedSources: ['ibn_kathir'] }), ['ibn_kathir']));
    check('empty everything → three', r({ explicitlyRequestedSources: [], asksForAllSources: false, uiSelectedSources: [] }).length === 3);
  }

  // 18) شرح المساعد is scoped to EXACTLY the displayed sources
  {
    console.log('١٨) شرح المساعد مبني على المصادر المعروضة فقط');
    // single source
    const rS = buildChatAnswer(answerWithPassages('ما تفسير السعدي لآية الكرسي؟', { selectedSources: ['al_saadi', 'ibn_kathir', 'al_tabari'] }), 'ar');
    check('single-source explanation present', !!rS.assistantExplanation);
    check('based on al_saadi only', setEq(rS.assistantExplanation.basedOnSources, ['al_saadi']), (rS.assistantExplanation.basedOnSources || []).join(','));
    check('flagged extractive (not AI)', rS.assistantExplanation.extractive === true);
    check('title = شرح المساعد', rS.assistantExplanation.title === 'شرح المساعد');
    // all three
    const rAll = buildChatAnswer(answerWithPassages('ما تفسير آية الكرسي؟', { selectedSources: ['al_saadi', 'ibn_kathir', 'al_tabari'] }), 'ar');
    check('all-source explanation based on three', setEq(rAll.assistantExplanation.basedOnSources, ['al_saadi', 'ibn_kathir', 'al_tabari']));
    // comparison of two
    const rCmp = buildChatAnswer(answerWithPassages('قارن بين السعدي وابن كثير في الفاتحة'), 'ar');
    check('comparison explanation based on the two named', setEq(rCmp.assistantExplanation.basedOnSources, ['al_saadi', 'ibn_kathir']), (rCmp.assistantExplanation.basedOnSources || []).join(','));
  }

  // 19) missing source → missingSources metadata + explanation excludes it
  {
    console.log('١٩) مصدر مفقود في البيانات الوصفية');
    const r = buildChatAnswer(searchAnswer('ما تفسير الآية 900 من سورة الإخلاص؟', saadi, 'ar', { selectedSources: ['al_saadi', 'ibn_kathir'] }), 'ar');
    check('missingSources lists both', setEq(r.missingSources || [], ['al_saadi', 'ibn_kathir']), (r.missingSources || []).join(','));
    check('no explanation when nothing found', !r.assistantExplanation);
  }

  // 20) FULL-SURAH request returns EVERY verse, not just verse 1 (§2)
  {
    const a = analyzeTafsirQuestion('تفسير سورة الفاتحة');
    console.log('٢٠) تفسير سورة كاملة');
    check('intent = surah_tafsir', a.intent === 'surah_tafsir', a.intent);
    check('fullSurah flag set', a.fullSurah === true);
    check('scope = whole surah 1..7', a.ayahStart === 1 && a.ayahEnd === 7, `${a.ayahStart}-${a.ayahEnd}`);

    const r = buildChatAnswer(answerWithPassages('تفسير سورة الفاتحة'), 'ar');
    const saadiGroup = (r.tafsirGroups || []).find((g) => g.source === 'al_saadi');
    const startAyahs = saadiGroup ? saadiGroup.passages.map((p) => p.ayahStart) : [];
    check('title says full surah', /\(كامل\)/.test(r.title || ''), r.title);
    check('covers more than verse 1', startAyahs.length > 1, `passages=${startAyahs.length}`);
    check('reaches the final verse (7)', saadiGroup && saadiGroup.passages.some((p) => p.ayahEnd >= 7));
    check('Fatihah bismillah note = verse 1', /البسملة هي الآية الأولى/.test(r.summary || ''), r.summary);
    // Fatihah verse 1's Quran text IS the Basmala (NOT stripped, unlike other surahs).
    const rawFatiha = answerWithPassages('تفسير سورة الفاتحة');
    const v1 = (rawFatiha.tafsirMatches || []).find((m) => m.ayahStart === 1 && m.source === 'al_saadi');
    check('Fatihah v1 text keeps Basmala', !!v1 && /بِسْمِ/.test(v1.ayahText) && !/ٱلْحَمْدُ/.test(v1.ayahText), v1 && v1.ayahText.slice(0, 24));
  }

  // 21) Full-surah Bismillah rules for Baqarah (opening line) and Tawbah (none)
  {
    console.log('٢١) قواعد البسملة في السور الكاملة');
    const rB = buildChatAnswer(answerWithPassages('تفسير سورة البقرة'), 'ar');
    check('Baqarah: opening bismillah note', /تُعرض البسملة في فتح السورة/.test(rB.summary || ''), rB.summary);
    const gB = (rB.tafsirGroups || []).find((g) => g.source === 'al_saadi');
    check('Baqarah does not stop at verse 1', gB && gB.passages.length > 1, gB && String(gB.passages.length));

    const rT = buildChatAnswer(answerWithPassages('تفسير سورة التوبة'), 'ar');
    check('Tawbah: no bismillah note', /لا تُعرض البسملة/.test(rT.summary || ''), rT.summary);
  }

  // 22) Bismillah is stripped from verse-1 tafsir text (non-Fatihah/Tawbah)
  {
    console.log('٢٢) حذف البسملة المكررة من نص الآية الأولى');
    const { getAyah } = require('../src/utils/quranDataLoader.ts');
    const raw = getAyah(2, 1).textUthmani; // Baqarah 1 stored WITH Basmala prefix
    const r = answerWithPassages('ما تفسير الآية 1 من سورة البقرة؟');
    const m = (r.tafsirMatches || []).find((x) => x.ayahStart === 1);
    check('stored text has Basmala prefix', /بِسْمِ/.test(raw));
    check('displayed ayahText has Basmala removed', !!m && !/^﻿?\s*بِسْمِ/.test(m.ayahText), m && m.ayahText.slice(0, 20));
  }

  // 23) UNIFIED scope: every source shows the SAME requested verse heading (§3)
  {
    console.log('٢٣) نطاق موحّد عبر المصادر');
    const r = answerWithPassages('اشرح الآية 2 من سورة البقرة بكل التفاسير', {
      selectedSources: ['al_saadi', 'ibn_kathir', 'al_tabari'],
    });
    const found = (r.tafsirMatches || []).filter((m) => !m.notFound);
    check('all sources heading = requested verse 2', found.length > 0 && found.every((m) => m.ayahStart === 2 && m.ayahEnd === 2), found.map((m) => `${m.source}:${m.ayahStart}-${m.ayahEnd}`).join(' '));
    // Any source whose passage groups a wider range carries the honest note fields.
    const wider = found.filter((m) => m.sourceCoversStart !== undefined);
    check('wider grouped sources record their real range', wider.every((m) => m.sourceCoversStart <= 2 && m.sourceCoversEnd >= 2));
  }

  // 24) Analytical intent routing (§2/§15) — superlatives/comparison/first-last
  {
    console.log('٢٤) تصنيف نية الأسئلة التحليلية');
    check('longest surah → QURAN_STATS', detectIntent('ما أطول سورة في القرآن؟').intent === 'QURAN_STATS');
    check('shortest ayah → QURAN_STATS', detectIntent('ما أقصر آية؟').intent === 'QURAN_STATS');
    check('compare words → QURAN_STATS', detectIntent('قارن بين ذكر الدنيا والآخرة').intent === 'QURAN_STATS');
    check('first occurrence → QURAN_STATS', detectIntent('ما أول موضع وردت فيه كلمة الرحمن؟').intent === 'QURAN_STATS');
    check('word location → WORD_LOCATION', detectIntent('أين وردت كلمة الصبر؟').intent === 'WORD_LOCATION');
    // A tafsir comparison must NOT be hijacked into analytics.
    check('tafsir compare stays tafsir-shaped', detectIntent('قارن بين السعدي وابن كثير في آية الكرسي').intent !== 'QURAN_STATS');
  }

  // 25) Analytics run from quran.json, INDEPENDENT of tafsir groups (§1)
  {
    console.log('٢٥) الإحصاء يعمل بدون بيانات التفسير (groups=null)');
    const r = searchAnswer('ما أطول سورة في القرآن؟', null, 'ar'); // groups === null
    check('answer from analytics source', r.source === 'analytics', r.source);
    check('states the metric (عدد الآيات)', /عدد الآيات/.test(r.answer || ''));
    check('returns Al-Baqarah', /البقرة/.test(r.answer || ''), r.answer);
    check('returns 286', /286/.test(r.answer || ''));
  }

  // 26) Shortest surah returns ALL tied surahs (§5)
  {
    console.log('٢٦) أقصر سورة — التعادل يُعرض كاملًا');
    const r = searchAnswer('ما أقصر سورة في القرآن؟', null, 'ar');
    const names = ['الكوثر', 'العصر', 'النصر'].filter((n) => (r.answer || '').includes(n));
    check('all three tied surahs present', names.length === 3, names.join(','));
    check('states 3 ayahs each', /3 آيات/.test(r.answer || ''));
  }

  // 27) Longest ayah — reference + character rule (§4/§13)
  {
    console.log('٢٧) أطول آية — مرجع وقاعدة العد');
    const r = searchAnswer('ما أطول آية في القرآن؟', null, 'ar');
    check('mentions surah + ayah (البقرة 282)', /البقرة/.test(r.answer || '') && /282/.test(r.answer || ''), r.answer);
    check('states character rule', /الأحرف|أحرف/.test(r.answer || ''));
    check('has a Quran reference', Array.isArray(r.references) && r.references.length > 0);
  }

  // 28) Comparison computes both, same rule (§11)
  {
    console.log('٢٨) مقارنة تحسب الطرفين');
    const r = searchAnswer('قارن بين ذكر الدنيا والآخرة', null, 'ar');
    check('source analytics (not tafsir)', r.source === 'analytics', r.source);
    check('both counted (115 each — famous parity)', /115/.test(r.answer || ''), r.answer);
    check('has comparison stats', !!r.stats && Array.isArray(r.stats.items) && r.stats.items.length === 2);
  }

  // 29) Juz scope from quran.json (§8) — computed without tafsir
  {
    console.log('٢٩) نطاق الجزء من quran.json');
    const r = searchAnswer('كم آية في الجزء الثلاثين؟', null, 'ar');
    check('answer from analytics', r.source === 'analytics', r.source);
    check('scoped to Juz 30', /الجزء 30/.test(r.answer || ''), r.answer);
    check('computed an ayah count', /\d+ آية/.test(r.answer || ''));
  }

  // 30) Surah-scoped exact word count (§7)
  {
    console.log('٣٠) عدّ كلمة ضمن سورة');
    const r = searchAnswer('كم مرة ذكرت كلمة الصبر في سورة البقرة؟', null, 'ar');
    check('scoped to Al-Baqarah', /سورة البقرة/.test(r.answer || ''), r.answer);
    check('source analytics', r.source === 'analytics');
  }

  // 31) Analytical questions NEVER trigger a hadith search (§1)
  {
    console.log('٣١) الأسئلة التحليلية لا تبحث في الحديث');
    check('QURAN_STATS → no hadith', shouldSearchHadith('QURAN_STATS') === false);
    check('WORD_LOCATION → no hadith', shouldSearchHadith('WORD_LOCATION') === false);
    check('isQuranAnalyticsIntent(QURAN_STATS)', isQuranAnalyticsIntent('QURAN_STATS') === true);
    check('FATWA → no hadith', shouldSearchHadith('FATWA_SAFETY') === false);
    // Explicit hadith request still works.
    check('HADITH_LOOKUP → hadith', shouldSearchHadith('HADITH_LOOKUP') === true);
    check('«هات حديثًا عن الصبر» is HADITH_LOOKUP', detectIntent('هات حديثًا عن الصبر').intent === 'HADITH_LOOKUP');
    // Each failing example from the spec must route away from hadith.
    for (const q of [
      'ما أطول سورة في القرآن؟', 'ما أقصر آية؟', 'كم مرة ذكرت كلمة الصبر؟',
      'قارن بين الدنيا والآخرة', 'أين ذكرت كلمة الرحمن؟', 'ما أول موضع وردت فيه كلمة الجنة؟',
    ]) {
      const intent = detectIntent(q).intent;
      check(`«${q}» → no hadith`, shouldSearchHadith(intent) === false, intent);
    }
  }

  // 32) Decorated Arabic-Indic ayah markers (§4)
  {
    console.log('٣٢) علامات الآيات المزخرفة');
    check('formatAyahMarker(1) = ﴿١﴾', formatAyahMarker(1) === '﴿١﴾', formatAyahMarker(1));
    check('formatAyahMarker(12) = ﴿١٢﴾', formatAyahMarker(12) === '﴿١٢﴾', formatAyahMarker(12));
    check('formatAyahMarker(286) = ﴿٢٨٦﴾', formatAyahMarker(286) === '﴿٢٨٦﴾', formatAyahMarker(286));
    check('strips an existing ﴿﴾ marker', stripExistingAyahMarker('نص ﴿٢﴾') === 'نص');
    check('strips an existing ۝ marker', stripExistingAyahMarker('نص ۝٢') === 'نص');
    check('leaves unmarked text alone', stripExistingAyahMarker('نص الآية') === 'نص الآية');
  }

  // 33) Ayah markers appear in analytics + tafsir Quran references
  {
    console.log('٣٣) العلامات تظهر في مراجع القرآن');
    const loc = searchAnswer('أين وردت كلمة الصبر؟', null, 'ar');
    const refs = loc.references || [];
    check('analytics refs carry a marker', refs.length > 0 && refs.every((r) => /﴿[٠-٩]+﴾/.test(r.text)), refs[0] && refs[0].text.slice(-10));
    check('no double marker', refs.every((r) => (r.text.match(/﴿/g) || []).length === 1));

    // Tafsir Quran evidence (verse range 1–3 of Al-Baqarah) — one marker per verse.
    const taf = buildChatAnswer(answerWithPassages('ما تفسير الآيات 1 إلى 3 من سورة البقرة؟'), 'ar');
    const qref = (taf.quranReferences || [])[0];
    const markers = qref ? (qref.text.match(/﴿[٠-٩]+﴾/g) || []) : [];
    check('range evidence has 3 markers', markers.length === 3, `markers=${markers.join('')}`);
    check('markers are ١ ٢ ٣ in order', markers.join('') === '﴿١﴾﴿٢﴾﴿٣﴾', markers.join(''));
  }

  console.log('────────────────────────────────────────────');
  console.log(`النتيجة: ${passed} ناجحًا، ${failed} فاشلًا.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
