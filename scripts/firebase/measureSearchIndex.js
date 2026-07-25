#!/usr/bin/env node
/**
 * Phase 0 measurement: how big is the As-Sa'di keyword index?
 *
 * Moving all tafsir to Firestore removes the full-text scan that
 * searchTafseerKeywords() depends on. The replacement is a bundled inverted
 * index (token -> postings) that resolves a keyword query to ayah references
 * locally; only the winning passage is then fetched remotely.
 *
 * This script does NOT write the index. It measures candidate encodings so we
 * can check them against the 5 MB budget before committing to the approach.
 *
 * Uses the app's REAL normalizeText/tokenize rules (same require-hook trick as
 * scripts/testTafsirEngine.js) so the measurement matches runtime behaviour.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

global.__DEV__ = false;
require.extensions['.ts'] = function (module, filename) {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
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

const { normalizeText } = require('../../src/utils/textNormalizer.ts');

// Mirrors chatbotSearch.tokenize(): length >= 2, no pure digits. Stopwords are
// applied separately below so we can measure their effect.
function tokensOf(text) {
  return normalizeText(text).split(' ').filter((t) => t.length >= 2 && !/^\d+$/.test(t));
}

const SRC = path.resolve(__dirname, '../../src/data/tafseer_saadi.json');
const records = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// token -> Map<docIndex, count>. Counts are capped at 6 because
// countOccurrences() in chatbotSearch.ts stops at 6.
const postings = new Map();
const docRefs = [];

records.forEach((r, i) => {
  docRefs.push([r.surah, r.ayah_start]);
  const seen = new Map();
  for (const t of tokensOf(r.explanation || '')) {
    seen.set(t, Math.min((seen.get(t) || 0) + 1, 6));
  }
  for (const [t, c] of seen) {
    let p = postings.get(t);
    if (!p) { p = []; postings.set(t, p); }
    p.push([i, c]);
  }
});

const docCount = records.length;
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

function measure(label, filterFn) {
  const kept = [...postings.entries()].filter(([tok, p]) => filterFn(tok, p));
  // Compact encoding: one line per token, "token:doc.count,doc.count"
  // Postings delta-encoded; count omitted when 1 (the common case).
  const lines = kept.map(([tok, p]) => {
    let prev = 0;
    const parts = p.map(([d, c]) => {
      const delta = d - prev; prev = d;
      return c === 1 ? String(delta) : `${delta}.${c}`;
    });
    return `${tok}:${parts.join(',')}`;
  });
  const payload = lines.join('\n');
  const bytes = Buffer.byteLength(payload, 'utf8');
  const totalPostings = kept.reduce((s, [, p]) => s + p.length, 0);
  console.log(
    `${label.padEnd(34)} tokens=${String(kept.length).padStart(6)}  ` +
    `postings=${String(totalPostings).padStart(8)}  raw=${mb(bytes).padStart(9)}`
  );
  return { bytes, tokens: kept.length, payload };
}

console.log(`As-Sa'di: ${docCount} records, ${postings.size} distinct tokens\n`);
console.log('Encoding: delta-encoded postings, count elided when 1\n');

measure('all tokens', () => true);
measure('df <= 50% of docs', (_t, p) => p.length <= docCount * 0.5);
const chosen = measure('df <= 20% of docs', (_t, p) => p.length <= docCount * 0.2);
measure('df <= 20%, token length >= 3', (t, p) => p.length <= docCount * 0.2 && t.length >= 3);

// gzip is what actually ships: Metro/Hermes store the asset, but the download
// and the on-disk asset both compress. Measure it to know the real cost.
const zlib = require('zlib');
const gz = zlib.gzipSync(Buffer.from(chosen.payload, 'utf8'), { level: 9 });
console.log(`\ndf<=20% chosen encoding: raw ${mb(chosen.bytes)}, gzipped ${mb(gz.length)}`);
console.log(`BUDGET: 5.00 MB raw  ->  ${chosen.bytes <= 5 * 1048576 ? 'PASS' : 'FAIL'}`);
