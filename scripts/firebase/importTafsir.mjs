#!/usr/bin/env node
/**
 * Imports the tafsir corpus into Cloud Firestore.
 *
 * Runs OUTSIDE the Expo runtime with the Admin SDK. The Admin SDK must never
 * appear in the mobile app — it bypasses security rules by design.
 *
 * Safety properties:
 *   - Document ids are content-addressed (sha256 of the text), so the import is
 *     idempotent: re-running an unchanged corpus converges to identical bytes,
 *     and a crashed run is always safe to simply re-run.
 *   - --dry-run and --self-check need no credentials and write nothing.
 *   - --self-check proves the Firestore model is LOSSLESS against the local
 *     JSON before a single byte is uploaded.
 *   - The largest document is written first as a canary, so the missing index
 *     exemption is caught on write #1 rather than after 4,000 documents.
 *   - Original tafsir text is never modified, summarised or re-wrapped.
 *
 * Usage:
 *   node scripts/firebase/importTafsir.mjs --self-check
 *   node scripts/firebase/importTafsir.mjs --all --dry-run
 *   node scripts/firebase/importTafsir.mjs --source=al_saadi --dry-run
 *   node scripts/firebase/importTafsir.mjs --source=al_saadi
 *   node scripts/firebase/importTafsir.mjs --all
 *   node scripts/firebase/importTafsir.mjs --source=al_saadi --verify
 *
 * Credentials:
 *   set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  REPO_ROOT,
  SOURCES,
  SOURCE_IDS,
  SCHEMA_VERSION,
  buildContentModel,
  contentDocId,
  formatBytes,
  readSourceRecords,
  sourceById,
  validateSource,
} from './lib/tafsirModel.mjs';

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (name) => argv.find((a) => a.startsWith(`${name}=`))?.split('=')[1];

const OPTS = {
  all: has('--all'),
  source: valueOf('--source'),
  dryRun: has('--dry-run'),
  selfCheck: has('--self-check'),
  verify: has('--verify'),
  resume: !has('--no-resume'),
};

if (OPTS.source && !SOURCE_IDS.includes(OPTS.source)) {
  console.error(`مصدر غير معروف: ${OPTS.source}\nالمتاح: ${SOURCE_IDS.join(', ')}`);
  process.exit(1);
}
if (!OPTS.all && !OPTS.source && !OPTS.selfCheck) {
  console.error(
    'حدّد مصدرًا أو استخدم --all.\n' +
      '  node scripts/firebase/importTafsir.mjs --all --dry-run\n' +
      '  node scripts/firebase/importTafsir.mjs --self-check',
  );
  process.exit(1);
}

const targets = OPTS.source ? [sourceById(OPTS.source)] : SOURCES;

/* ------------------------------------------------------------------ */
/* Model building (shared by every mode)                               */
/* ------------------------------------------------------------------ */

function buildModel(sourceId) {
  const { records, sizeBytes } = readSourceRecords(sourceId);
  const { report, accepted } = validateSource(sourceId, records);
  if (report.rangeRecords > 0 || report.oversized > 0 || report.duplicates > 0) {
    console.error(`✗ ${sourceId}: بيانات غير صالحة — شغّل firebase:tafsir:validate أولًا.`);
    for (const issue of report.issues.slice(0, 10)) console.error(`   • ${issue}`);
    process.exit(1);
  }
  const model = buildContentModel(accepted);
  return { records, accepted, report, sizeBytes, ...model };
}

/* ------------------------------------------------------------------ */
/* --self-check : prove the model is lossless, offline                 */
/* ------------------------------------------------------------------ */

/**
 * Rebuilds every (surah, ayah) -> text pair from ONLY the manifest runs and the
 * content map — i.e. exactly what the app will have after migration — and diffs
 * it against the original JSON. Any mismatch means the model would lose or
 * corrupt scripture, so it exits non-zero.
 */
function selfCheck() {
  console.log('فحص ذاتي: هل يسترجع النموذج النص الأصلي حرفيًا؟\n');
  let failures = 0;

  for (const src of SOURCES) {
    const { accepted, contents, runs } = buildModel(src.id);

    // Reconstruct from runs + contents, the way the client will.
    const rebuilt = new Map();
    for (const [surah, encoded] of Object.entries(runs)) {
      for (const part of encoded.split(';')) {
        const [range, hash] = part.split(':');
        const [start, end] = range.split('-').map(Number);
        for (let ayah = start; ayah <= end; ayah += 1) {
          rebuilt.set(`${surah}:${ayah}`, contents.get(hash)?.text);
        }
      }
    }

    let mismatched = 0;
    let missing = 0;
    for (const rec of accepted) {
      const got = rebuilt.get(`${rec.surah}:${rec.ayah}`);
      if (got === undefined) missing += 1;
      else if (got !== rec.text) mismatched += 1;
    }

    const ok = mismatched === 0 && missing === 0 && rebuilt.size === accepted.length;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? '✓' : '✗'} ${src.arabicName.padEnd(16)} ` +
        `أعيد بناء ${rebuilt.size}/${accepted.length}  ` +
        `مفقود=${missing}  مختلف=${mismatched}`,
    );
  }

  if (failures > 0) {
    console.error('\n✗ النموذج غير مطابق للأصل. لا تستورد.');
    process.exit(1);
  }
  console.log('\n✓ النموذج يسترجع النص الأصلي حرفيًا لكل آية.');
}

/* ------------------------------------------------------------------ */
/* Checkpoints                                                         */
/* ------------------------------------------------------------------ */

function checkpointPath(sourceId) {
  return path.join(REPO_ROOT, `.tafsir-import-${sourceId}.json`);
}

function readCheckpoint(sourceId) {
  if (!OPTS.resume) return new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(checkpointPath(sourceId), 'utf8'));
    return new Set(Array.isArray(raw.writtenHashes) ? raw.writtenHashes : []);
  } catch {
    return new Set();
  }
}

function writeCheckpoint(sourceId, written) {
  try {
    fs.writeFileSync(
      checkpointPath(sourceId),
      JSON.stringify({ sourceId, updatedAt: new Date().toISOString(), writtenHashes: [...written] }),
      'utf8',
    );
  } catch {
    /* a failed checkpoint only costs speed on resume, never correctness */
  }
}

/* ------------------------------------------------------------------ */
/* Firestore                                                           */
/* ------------------------------------------------------------------ */

async function connectFirestore() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      '✗ لم يُضبط GOOGLE_APPLICATION_CREDENTIALS.\n' +
        '  نزّل مفتاح حساب الخدمة من:\n' +
        '  Firebase Console → Project settings → Service accounts → Generate new private key\n' +
        '  ثم:  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json',
    );
    process.exit(1);
  }
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
  return getFirestore();
}

const INDEX_EXEMPTION_HELP = [
  '',
  '  السبب الأرجح: لم تُضبط استثناءات الفهرسة.',
  '  Firestore يفهرس كل حقل تلقائيًا ويحدّ حجم مُدخل الفهرس، ونصوص التفاسير',
  '  تتجاوز ذلك الحد بكثير (حتى 145.9 كيلوبايت).',
  '',
  '  في Firebase Console → Firestore → Indexes → Single field → Add exemption:',
  '    Collection: tafsir_content   Field: t       عطّل Ascending / Descending / Array contains',
  '    Collection: tafsir_index     Field: runs    عطّل الثلاثة أيضًا',
  '',
  '  أو انشر الاستثناءات:  firebase deploy --only firestore:indexes',
  '',
].join('\n');

async function importSource(db, src) {
  const { contents, runs, runCount, accepted, sizeBytes } = buildModel(src.id);

  let uniqueBytes = 0;
  for (const c of contents.values()) uniqueBytes += c.bytes;

  console.log('─'.repeat(64));
  console.log(`${src.arabicName}  (${src.id})`);
  console.log('─'.repeat(64));
  console.log(`  المصدر            ${formatBytes(sizeBytes)}  ${accepted.length} آية`);
  console.log(`  نصوص فريدة        ${contents.size}   (${formatBytes(uniqueBytes)})`);
  console.log(`  مقاطع الفهرس      ${runCount}`);

  if (OPTS.dryRun) {
    console.log(`  الكتابات المتوقعة ${contents.size + 1}`);
    console.log('  (تجربة جافة — لم يُكتب شيء)\n');
    return { written: 0, skipped: 0 };
  }

  const done = readCheckpoint(src.id);
  const pending = [...contents.entries()].filter(([hash]) => !done.has(hash));
  if (done.size > 0) {
    console.log(`  استئناف           ${done.size} مستند مكتوب سابقًا`);
  }

  // Canary: the largest document first, so a missing index exemption fails on
  // write #1 instead of part-way through the corpus.
  pending.sort((a, b) => b[1].bytes - a[1].bytes);
  if (pending.length > 0) {
    const [hash, entry] = pending[0];
    try {
      await db
        .collection('tafsir_content')
        .doc(contentDocId(src.id, hash))
        .set({ t: entry.text, n: entry.bytes, v: SCHEMA_VERSION });
      done.add(hash);
      console.log(`  ✓ مستند الاختبار   ${formatBytes(entry.bytes)}`);
    } catch (error) {
      console.error(`\n✗ فشلت كتابة أكبر مستند (${formatBytes(entry.bytes)}): ${error.message}`);
      console.error(INDEX_EXEMPTION_HELP);
      process.exit(1);
    }
  }

  const bulk = db.bulkWriter();
  bulk.onWriteError((error) => error.failedAttempts < 5);

  let written = 1;
  const rest = pending.slice(1);
  const CHUNK = 500;

  for (let i = 0; i < rest.length; i += CHUNK) {
    const slice = rest.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(([hash, entry]) =>
        bulk
          .set(db.collection('tafsir_content').doc(contentDocId(src.id, hash)), {
            t: entry.text,
            n: entry.bytes,
            v: SCHEMA_VERSION,
          })
          .then(() => {
            done.add(hash);
            written += 1;
          }),
      ),
    );
    await bulk.flush();
    writeCheckpoint(src.id, done);
    const pct = Math.round(((i + slice.length) / Math.max(rest.length, 1)) * 100);
    process.stdout.write(`\r  الكتابة           ${written}/${pending.length}  (${pct}%)`);
  }
  await bulk.close();
  process.stdout.write('\n');

  // Server-side manifest override (the app bundles its own copy; this exists so
  // a corpus correction can ship without an app-store release).
  await db.collection('tafsir_index').doc(src.id).set({
    v: SCHEMA_VERSION,
    source: src.id,
    contentCount: contents.size,
    runCount,
    runs,
    updatedAt: new Date().toISOString(),
  });

  try {
    fs.unlinkSync(checkpointPath(src.id));
  } catch {
    /* nothing to clean up */
  }

  console.log(`  ✓ اكتمل           ${written} مستند\n`);
  return { written, skipped: contents.size - written };
}

async function verifySource(db, src) {
  const { contents } = buildModel(src.id);
  const hashes = [...contents.keys()];
  const sample = [];
  for (let i = 0; i < Math.min(15, hashes.length); i += 1) {
    sample.push(hashes[Math.floor((i / 15) * hashes.length)]);
  }
  let ok = 0;
  let bad = 0;
  for (const hash of sample) {
    const snap = await db.collection('tafsir_content').doc(contentDocId(src.id, hash)).get();
    if (snap.exists && snap.get('t') === contents.get(hash).text) ok += 1;
    else bad += 1;
  }
  console.log(`  ${bad === 0 ? '✓' : '✗'} ${src.arabicName}: ${ok}/${sample.length} مطابق`);
  return bad === 0;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  if (OPTS.selfCheck) {
    selfCheck();
    if (!OPTS.all && !OPTS.source) return;
  }

  if (OPTS.dryRun) {
    console.log('تجربة جافة — لن تُكتب أي بيانات\n');
    for (const src of targets) await importSource(null, src);
    console.log('شغّل الأمر نفسه بدون --dry-run للاستيراد الفعلي.');
    return;
  }

  const db = await connectFirestore();

  if (OPTS.verify) {
    console.log('التحقق من البيانات المرفوعة\n');
    let allOk = true;
    for (const src of targets) allOk = (await verifySource(db, src)) && allOk;
    process.exit(allOk ? 0 : 1);
  }

  console.log('استيراد التفاسير إلى Firestore\n');
  let total = 0;
  for (const src of targets) {
    const { written } = await importSource(db, src);
    total += written;
  }

  await db.collection('tafsir_meta').doc('current').set({
    v: SCHEMA_VERSION,
    dataVersion: SCHEMA_VERSION,
    sources: SOURCE_IDS,
    updatedAt: new Date().toISOString(),
  });

  console.log(`تم. ${total} مستند.`);
  console.log('للتأكد:  node scripts/firebase/importTafsir.mjs --all --verify');
}

main().catch((error) => {
  console.error('\n✗ فشل الاستيراد:', error?.message ?? error);
  process.exit(1);
});
