#!/usr/bin/env node
/**
 * Validates every bundled tafsir dataset WITHOUT modifying it.
 *
 * Mirrors the runtime adapter rules (src/utils/tafsirAdapters.ts): a record is
 * valid when it has a surah 1..114, ayah_start > 0, ayah_end >= ayah_start,
 * and a non-empty explanation. Reports totals, coverage, duplicates, invalid
 * ranges, empty explanations, missing surahs, and file size — per source.
 *
 * Usage: npm run validate:tafsir
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const SOURCES = [
  { id: 'al_saadi', name: 'تفسير السعدي', file: 'tafseer_saadi.json' },
  { id: 'ibn_kathir', name: 'تفسير ابن كثير', file: 'tafseer_ibn_kathir.json' },
  { id: 'al_tabari', name: 'تفسير الطبري', file: 'tafseer_tabari.json' },
];

const SURAH_KEYS = ['surah', 'surah_number', 'surahNumber', 'sura', 'chapter'];
const AYAH_START_KEYS = ['ayah_start', 'ayahStart', 'ayah', 'ayah_number', 'ayahNumber', 'verse', 'verse_number', 'aya'];
const AYAH_END_KEYS = ['ayah_end', 'ayahEnd', 'ayah_to', 'to'];
const EXPLANATION_KEYS = ['explanation', 'tafsir', 'tafseer', 'content', 'text', 'commentary'];

function pickNumber(o, keys) {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}
function pickString(o, keys) {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return null;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateSource(src) {
  const filePath = path.join(DATA_DIR, src.file);
  const report = {
    id: src.id,
    name: src.name,
    file: src.file,
    exists: false,
    sizeBytes: 0,
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    invalidSurah: 0,
    invalidRange: 0,
    emptyExplanation: 0,
    surahsFound: new Set(),
    issues: [],
  };

  if (!fs.existsSync(filePath)) {
    report.issues.push('file not found');
    return report;
  }
  report.exists = true;
  report.sizeBytes = fs.statSync(filePath).size;

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    report.issues.push(`JSON parse error: ${e.message}`);
    return report;
  }
  if (!Array.isArray(raw)) {
    report.issues.push('dataset root is not an array');
    return report;
  }

  report.total = raw.length;
  const seen = new Set();
  for (const rec of raw) {
    if (typeof rec !== 'object' || rec === null) {
      report.invalid += 1;
      continue;
    }
    const surah = pickNumber(rec, SURAH_KEYS);
    const start = pickNumber(rec, AYAH_START_KEYS);
    const endRaw = pickNumber(rec, AYAH_END_KEYS);
    const end = endRaw === null ? start : endRaw;
    const expl = pickString(rec, EXPLANATION_KEYS);

    let bad = false;
    if (surah === null || !Number.isInteger(surah) || surah < 1 || surah > 114) {
      report.invalidSurah += 1;
      bad = true;
    }
    if (start === null || !Number.isInteger(start) || start < 1 || end === null || end < start) {
      report.invalidRange += 1;
      bad = true;
    }
    if (!expl || expl.trim().length === 0) {
      report.emptyExplanation += 1;
      bad = true;
    }
    if (bad) {
      report.invalid += 1;
      continue;
    }

    const key = `${surah}:${start}-${end}`;
    if (seen.has(key)) {
      report.duplicates += 1;
      continue;
    }
    seen.add(key);
    report.valid += 1;
    report.surahsFound.add(surah);
  }
  return report;
}

function missingSurahs(found) {
  const missing = [];
  for (let n = 1; n <= 114; n++) if (!found.has(n)) missing.push(n);
  return missing;
}

function printReport(r) {
  console.log('────────────────────────────────────────────');
  console.log(`المصدر: ${r.name}  (${r.id})`);
  console.log(`الملف: ${r.file}`);
  if (!r.exists) {
    console.log('⚠️  الملف غير موجود — أضِف بيانات هذا المصدر لتفعيله.');
    return;
  }
  console.log(`الحجم: ${humanSize(r.sizeBytes)}`);
  console.log(`إجمالي السجلات: ${r.total}`);
  console.log(`الصحيحة: ${r.valid}`);
  console.log(`غير الصحيحة: ${r.invalid} (أرقام سور خاطئة: ${r.invalidSurah}، نطاقات خاطئة: ${r.invalidRange}، تفسير فارغ: ${r.emptyExplanation})`);
  console.log(`المكررة: ${r.duplicates}`);
  console.log(`السور المغطاة: ${r.surahsFound.size} / 114`);
  const missing = missingSurahs(r.surahsFound);
  if (r.total > 0) {
    console.log(
      missing.length === 0
        ? 'السور المفقودة: لا شيء ✅'
        : `السور المفقودة (${missing.length}): ${missing.slice(0, 25).join(', ')}${missing.length > 25 ? ' …' : ''}`,
    );
  }
  if (r.issues.length) console.log(`ملاحظات: ${r.issues.join(' | ')}`);
}

function main() {
  console.log('══════ التحقق من بيانات التفاسير ══════');
  const reports = SOURCES.map(validateSource);
  reports.forEach(printReport);

  console.log('────────────────────────────────────────────');
  const totalValid = reports.reduce((s, r) => s + r.valid, 0);
  const totalSize = reports.reduce((s, r) => s + r.sizeBytes, 0);
  console.log(`الإجمالي: ${totalValid} سجلًا صحيحًا عبر ${reports.length} مصادر، الحجم الكلي ${humanSize(totalSize)}.`);

  // Non-zero exit only on a hard structural problem (parse error / bad root),
  // never merely because an optional source is still empty.
  const hardError = reports.some((r) => r.exists && r.issues.length > 0);
  process.exit(hardError ? 1 : 0);
}

main();
