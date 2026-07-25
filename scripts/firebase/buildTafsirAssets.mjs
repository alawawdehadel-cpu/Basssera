#!/usr/bin/env node
/**
 * Generates the small assets that STAY in the app bundle after the tafsir text
 * moves to Firestore:
 *
 *   src/data/tafsir-index/{source}.manifest.json   ayah -> content-hash runs
 *   src/data/tafsir-index/saadi.search.json        local keyword index
 *
 * Why bundle these instead of fetching them:
 *
 *   - The manifest costs ZERO Firestore reads to locate a passage, and lets the
 *     app tell "this source genuinely has no text for this ayah" from "I cannot
 *     reach the server" while completely offline and having never synced.
 *   - The search index preserves keyword / topic / word-meaning search, which
 *     scans every explanation today and cannot run against a remote key-value
 *     store. It keeps every token, so the candidate set stays exact.
 *
 * Measured total: ~3.2 MB, replacing 163 MB of bundled JSON.
 *
 * Usage:
 *   npm run firebase:tafsir:assets
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  ASSET_DIR,
  SEARCHED_SOURCE,
  SOURCES,
  SCHEMA_VERSION,
  buildContentModel,
  buildSearchIndex,
  formatBytes,
  manifestPath,
  readSourceRecords,
  searchIndexPath,
  validateSource,
} from './lib/tafsirModel.mjs';

fs.mkdirSync(ASSET_DIR, { recursive: true });

console.log('بناء الملفات المرافقة للتطبيق (فهارس محلية)\n');

let totalBytes = 0;

for (const src of SOURCES) {
  const { records } = readSourceRecords(src.id);
  const { report, accepted } = validateSource(src.id, records);

  if (report.rangeRecords > 0 || report.oversized > 0) {
    console.error(`✗ ${src.id}: بيانات غير صالحة. شغّل التحقق أولًا.`);
    process.exit(1);
  }

  const { runs, runCount, contents } = buildContentModel(accepted);

  const manifest = {
    v: SCHEMA_VERSION,
    source: src.id,
    sourceNameArabic: src.arabicName,
    docs: accepted.length,
    contentCount: contents.size,
    runCount,
    runs,
  };

  const out = manifestPath(src.id);
  const json = `${JSON.stringify(manifest)}\n`;
  fs.writeFileSync(out, json, 'utf8');
  totalBytes += Buffer.byteLength(json, 'utf8');
  console.log(
    `  ✓ ${path.relative(process.cwd(), out).padEnd(46)} ` +
      `${String(runCount).padStart(5)} مقطع   ${formatBytes(Buffer.byteLength(json, 'utf8')).padStart(9)}`,
  );

  if (src.id === SEARCHED_SOURCE) {
    const index = buildSearchIndex(accepted, records);
    const idxJson = `${JSON.stringify(index)}\n`;
    const idxOut = searchIndexPath();
    fs.writeFileSync(idxOut, idxJson, 'utf8');
    totalBytes += Buffer.byteLength(idxJson, 'utf8');
    console.log(
      `  ✓ ${path.relative(process.cwd(), idxOut).padEnd(46)} ` +
        `${String(index.stats.tokens).padStart(5)} كلمة    ${formatBytes(Buffer.byteLength(idxJson, 'utf8')).padStart(9)}`,
    );
  }
}

console.log(`\nالإجمالي المرفق بالتطبيق: ${formatBytes(totalBytes)}`);
console.log('(بدلًا من 163 ميغابايت من نصوص التفاسير)');
