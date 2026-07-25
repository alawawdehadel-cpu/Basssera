#!/usr/bin/env node
/**
 * Validates the three tafsir datasets and reports exactly what a Firestore
 * import would produce — before anything is written or uploaded.
 *
 * Reads only. Never modifies the source JSON.
 *
 * Usage:
 *   npm run firebase:tafsir:validate
 *   node scripts/firebase/validateTafsir.mjs --source=ibn_kathir
 */

import {
  SOURCES,
  SOURCE_IDS,
  SEARCHED_SOURCE,
  buildContentModel,
  buildSearchIndex,
  formatBytes,
  readSourceRecords,
  validateSource,
  MAX_MANIFEST_BYTES,
} from './lib/tafsirModel.mjs';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--source='))?.split('=')[1];

if (only && !SOURCE_IDS.includes(only)) {
  console.error(`مصدر غير معروف: ${only}\nالمصادر المتاحة: ${SOURCE_IDS.join(', ')}`);
  process.exit(1);
}

const targets = only ? SOURCES.filter((s) => s.id === only) : SOURCES;

console.log('التحقق من بيانات التفاسير قبل الرفع إلى Firestore\n');

let hardFailure = false;
let totalContentDocs = 0;
let totalStoredBytes = 0;

for (const src of targets) {
  console.log('─'.repeat(64));
  console.log(`${src.arabicName}  (${src.id})`);
  console.log('─'.repeat(64));

  let loaded;
  try {
    loaded = readSourceRecords(src.id);
  } catch (error) {
    console.error(`  ✗ ${error.message}`);
    hardFailure = true;
    continue;
  }

  const { records, absPath, sizeBytes } = loaded;
  const { report, accepted } = validateSource(src.id, records);
  const { contents, runs, runCount } = buildContentModel(accepted);

  let uniqueBytes = 0;
  for (const c of contents.values()) uniqueBytes += c.bytes;

  const manifestBytes = Buffer.byteLength(JSON.stringify({ v: 1, runs }), 'utf8');

  console.log(`  الملف                    ${absPath.replace(process.cwd(), '.')}`);
  console.log(`  حجم الملف                ${formatBytes(sizeBytes)}`);
  console.log(`  السجلات                  ${report.total}`);
  console.log(`  صالحة                    ${report.valid}`);
  console.log(
    `  غير صالحة                ${
      report.invalidSurah + report.invalidAyah + report.emptyExplanation + report.rangeRecords
    }` +
      `  (سورة: ${report.invalidSurah}, آية: ${report.invalidAyah}, ` +
      `نص فارغ: ${report.emptyExplanation}, نطاق: ${report.rangeRecords})`,
  );
  console.log(`  مكررة                    ${report.duplicates}`);
  console.log(`  السور المغطاة            ${report.surahsFound.size} / 114`);
  if (report.missingSurahs.length > 0) {
    const preview = report.missingSurahs.slice(0, 12).join(', ');
    const more = report.missingSurahs.length > 12 ? ` … (+${report.missingSurahs.length - 12})` : '';
    console.log(`  سور مفقودة               ${preview}${more}`);
  }
  console.log(`  أرقام الآيات             ${report.minAyah} – ${report.maxAyah}`);
  console.log(`  أكبر نص                  ${formatBytes(report.largestBytes)} @ ${report.largestRef}`);
  console.log(`  سجلات تحتاج تقسيمًا      ${report.oversized}`);
  console.log('');
  console.log(`  نصوص فريدة               ${contents.size} من ${report.valid}` +
    `  (تكرار ${(100 - (contents.size / Math.max(report.valid, 1)) * 100).toFixed(0)}%)`);
  console.log(`  حجم النصوص كاملة         ${formatBytes(report.totalBytes)}`);
  console.log(`  حجم النصوص الفريدة       ${formatBytes(uniqueBytes)}   ← ما سيُخزَّن فعليًا`);
  console.log('');
  console.log(`  مستندات المحتوى          ${contents.size}`);
  console.log(`  مقاطع الفهرس (runs)      ${runCount}`);
  console.log(`  حجم الفهرس المرفق        ${formatBytes(manifestBytes)}`);
  console.log(`  عمليات الكتابة المقدَّرة  ${contents.size}`);

  if (manifestBytes > MAX_MANIFEST_BYTES) {
    console.log(`  ✗ الفهرس أكبر من الحد المسموح (${formatBytes(MAX_MANIFEST_BYTES)})`);
    hardFailure = true;
  }
  if (report.oversized > 0 || report.rangeRecords > 0) {
    console.log('');
    console.log('  مشكلات بنيوية توقف الاستيراد:');
    for (const issue of report.issues.slice(0, 10)) console.log(`    • ${issue}`);
    hardFailure = true;
  }

  if (src.id === SEARCHED_SOURCE) {
    const index = buildSearchIndex(accepted, records);
    const indexBytes = Buffer.byteLength(JSON.stringify(index), 'utf8');
    console.log('');
    console.log('  فهرس البحث المحلي (يبقى داخل التطبيق):');
    console.log(`    مستندات               ${index.stats.docs}`);
    console.log(`    كلمات مفهرسة          ${index.stats.tokens}`);
    console.log(`    مواضع                 ${index.stats.postings}`);
    console.log(`    الحجم                 ${formatBytes(indexBytes)}`);
  }

  totalContentDocs += contents.size;
  totalStoredBytes += uniqueBytes;
  console.log('');
}

if (!only) {
  console.log('═'.repeat(64));
  console.log('الإجمالي');
  console.log('═'.repeat(64));
  console.log(`  مستندات المحتوى          ${totalContentDocs}`);
  console.log(`  الحجم المخزَّن             ${formatBytes(totalStoredBytes)}`);
  console.log(`  عمليات الكتابة           ${totalContentDocs + SOURCES.length + 1}`);
  console.log('');
  console.log(`  الحصة اليومية المجانية: 20,000 كتابة، 1 غيغابايت تخزين.`);
  console.log(
    `  ${totalContentDocs + SOURCES.length + 1 <= 20000 ? '✓' : '✗'} الاستيراد يقع ضمن الحصة المجانية.`,
  );
}

if (hardFailure) {
  console.log('\n✗ فشل التحقق. لا تُشغّل الاستيراد قبل معالجة ما سبق.');
  process.exit(1);
}
console.log('\n✓ البيانات صالحة للاستيراد.');
