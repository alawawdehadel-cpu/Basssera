#!/usr/bin/env node
/**
 * Splits each large tafsir dataset into per-surah JSON chunks for the
 * lazy, low-memory production path (see docs/MULTI_TAFSIR_CHATBOT.md →
 * Performance). Fully offline: it only reshapes bundled JSON — no network,
 * no rewriting of any religious text.
 *
 * Output (created next to the source files):
 *   src/data/tafsir-chunks/<sourceId>/<surah>.json   (114 files per source)
 *   src/data/tafsir-chunks/manifest.json             (counts + sizes)
 *
 * The runtime can then require only the (source, surah) chunk it needs
 * instead of parsing a 60–90 MB file to answer one ayah. This script is
 * OPT-IN — the app works without it (full-file lazy loading) and only needs
 * it when a target device struggles with the full datasets.
 *
 * Usage: npm run build:tafsir-chunks
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const OUT_DIR = path.join(DATA_DIR, 'tafsir-chunks');

const SOURCES = [
  { id: 'al_saadi', file: 'tafseer_saadi.json' },
  { id: 'ibn_kathir', file: 'tafseer_ibn_kathir.json' },
  { id: 'al_tabari', file: 'tafseer_tabari.json' },
];

const SURAH_KEYS = ['surah', 'surah_number', 'surahNumber', 'sura', 'chapter'];
function pickSurah(o) {
  for (const k of SURAH_KEYS) {
    const v = o[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function humanSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function chunkSource(src, manifest) {
  const filePath = path.join(DATA_DIR, src.file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${src.id}: ${src.file} غير موجود — تخطٍّ.`);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(raw)) {
    console.log(`⚠️  ${src.id}: البنية ليست مصفوفة — تخطٍّ.`);
    return;
  }
  const bySurah = new Map();
  for (const rec of raw) {
    if (typeof rec !== 'object' || rec === null) continue;
    const s = pickSurah(rec);
    if (s === null || s < 1 || s > 114) continue;
    if (!bySurah.has(s)) bySurah.set(s, []);
    bySurah.get(s).push(rec);
  }

  const dir = path.join(OUT_DIR, src.id);
  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  let bytes = 0;
  const surahs = [];
  for (const [surah, records] of [...bySurah.entries()].sort((a, b) => a[0] - b[0])) {
    const out = path.join(dir, `${surah}.json`);
    const json = JSON.stringify(records);
    fs.writeFileSync(out, json, 'utf8');
    written += 1;
    bytes += Buffer.byteLength(json);
    surahs.push({ surah, records: records.length, bytes: Buffer.byteLength(json) });
  }
  manifest[src.id] = { files: written, totalBytes: bytes, surahs };
  console.log(`✅ ${src.id}: ${written} ملفًا (${humanSize(bytes)}).`);
}

function main() {
  console.log('══════ توليد مقاطع التفاسير حسب السورة ══════');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { generatedAt: new Date().toISOString(), sources: {} };
  SOURCES.forEach((s) => chunkSource(s, manifest.sources));
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`📄 المخطط: ${path.relative(process.cwd(), path.join(OUT_DIR, 'manifest.json'))}`);
  console.log('البنية: src/data/tafsir-chunks/<sourceId>/<surah>.json');
}

main();
