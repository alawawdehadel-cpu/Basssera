#!/usr/bin/env node
/**
 * Inspects the SHAPE of each tafsir dataset (no validation, no mutation).
 * Prints, per source: file size, record count, the detected top-level keys of
 * the first record, and which canonical field each key maps to — so you can
 * confirm a new Ibn Kathir / Al-Tabari file before wiring its adapter.
 *
 * Usage: npm run inspect:tafsir
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

const FIELD_MAP = {
  surah: ['surah', 'surah_number', 'surahNumber', 'sura', 'chapter'],
  ayah_start: ['ayah_start', 'ayahStart', 'ayah', 'ayah_number', 'ayahNumber', 'verse', 'verse_number', 'aya'],
  ayah_end: ['ayah_end', 'ayahEnd', 'ayah_to', 'to'],
  explanation: ['explanation', 'tafsir', 'tafseer', 'content', 'text', 'commentary'],
  ayah_text: ['ayah_text', 'ayahText', 'verse_text', 'quran_text', 'arabic'],
};

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectMapping(keys) {
  const out = {};
  for (const [canonical, candidates] of Object.entries(FIELD_MAP)) {
    const hit = candidates.find((c) => keys.includes(c));
    out[canonical] = hit || '—(مفقود)';
  }
  return out;
}

function inspect(src) {
  const filePath = path.join(DATA_DIR, src.file);
  console.log('────────────────────────────────────────────');
  console.log(`المصدر: ${src.name}  (${src.id})  —  ${src.file}`);
  if (!fs.existsSync(filePath)) {
    console.log('⚠️  الملف غير موجود.');
    return;
  }
  console.log(`الحجم: ${humanSize(fs.statSync(filePath).size)}`);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.log(`تعذّر تحليل JSON: ${e.message}`);
    return;
  }
  if (!Array.isArray(raw)) {
    console.log('البنية الجذرية ليست مصفوفة.');
    return;
  }
  console.log(`عدد السجلات: ${raw.length}`);
  if (raw.length === 0) {
    console.log('لا توجد سجلات بعد (ملف مبدئي فارغ).');
    return;
  }
  const first = raw[0];
  const keys = Object.keys(first);
  console.log(`مفاتيح أول سجل: ${keys.join(', ')}`);
  const mapping = detectMapping(keys);
  console.log('التطابق مع الحقول القياسية:');
  for (const [canonical, detected] of Object.entries(mapping)) {
    console.log(`   ${canonical.padEnd(12)} ← ${detected}`);
  }
  const explKey = FIELD_MAP.explanation.find((c) => keys.includes(c));
  if (explKey && typeof first[explKey] === 'string') {
    console.log(`مقتطف التفسير (أول 80 حرفًا): ${first[explKey].slice(0, 80)}…`);
  }
}

console.log('══════ فحص بنية بيانات التفاسير ══════');
SOURCES.forEach(inspect);
console.log('────────────────────────────────────────────');
