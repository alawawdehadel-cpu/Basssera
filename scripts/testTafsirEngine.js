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
    const r = searchAnswer('ما تفسير الآية 1 من سورة الإخلاص؟', saadi, 'ar', {
      selectedSources: ['al_tabari'],
    });
    console.log('١٢ب) نص حقيقي من المصدر المطلوب');
    const m = (r.tafsirMatches || [])[0];
    check('card source is al_tabari', !!m && m.source === 'al_tabari', m && m.source);
    check('card has verbatim tafsir text', !!m && !m.notFound && m.explanation.length > 0);
  }

  // ---- display layer (buildChatAnswer → grouped source cards) ----

  // 13) الجميع → three grouped cards in fixed order, one passage each
  {
    const r = searchAnswer('ما تفسير الآية 255 من سورة البقرة؟', saadi, 'ar', {
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
    const r = searchAnswer('ما تفسير الآية 255 من سورة البقرة؟', saadi, 'ar', {
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
    const r = searchAnswer('ما تفسير الآيات من 1 إلى 5 من سورة الفاتحة؟', saadi, 'ar', {
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
    const rS = buildChatAnswer(searchAnswer('ما تفسير السعدي لآية الكرسي؟', saadi, 'ar', { selectedSources: ['al_saadi', 'ibn_kathir', 'al_tabari'] }), 'ar');
    check('single-source explanation present', !!rS.assistantExplanation);
    check('based on al_saadi only', setEq(rS.assistantExplanation.basedOnSources, ['al_saadi']), (rS.assistantExplanation.basedOnSources || []).join(','));
    check('flagged extractive (not AI)', rS.assistantExplanation.extractive === true);
    check('title = شرح المساعد', rS.assistantExplanation.title === 'شرح المساعد');
    // all three
    const rAll = buildChatAnswer(searchAnswer('ما تفسير آية الكرسي؟', saadi, 'ar', { selectedSources: ['al_saadi', 'ibn_kathir', 'al_tabari'] }), 'ar');
    check('all-source explanation based on three', setEq(rAll.assistantExplanation.basedOnSources, ['al_saadi', 'ibn_kathir', 'al_tabari']));
    // comparison of two
    const rCmp = buildChatAnswer(searchAnswer('قارن بين السعدي وابن كثير في الفاتحة', saadi, 'ar'), 'ar');
    check('comparison explanation based on the two named', setEq(rCmp.assistantExplanation.basedOnSources, ['al_saadi', 'ibn_kathir']), (rCmp.assistantExplanation.basedOnSources || []).join(','));
  }

  // 19) missing source → missingSources metadata + explanation excludes it
  {
    console.log('١٩) مصدر مفقود في البيانات الوصفية');
    const r = buildChatAnswer(searchAnswer('ما تفسير الآية 900 من سورة الإخلاص؟', saadi, 'ar', { selectedSources: ['al_saadi', 'ibn_kathir'] }), 'ar');
    check('missingSources lists both', setEq(r.missingSources || [], ['al_saadi', 'ibn_kathir']), (r.missingSources || []).join(','));
    check('no explanation when nothing found', !r.assistantExplanation);
  }

  console.log('────────────────────────────────────────────');
  console.log(`النتيجة: ${passed} ناجحًا، ${failed} فاشلًا.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
