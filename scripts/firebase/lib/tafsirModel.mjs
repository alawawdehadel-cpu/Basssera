/**
 * Shared model for the tafsir → Firestore pipeline.
 *
 * Used by validateTafsir.mjs, buildTafsirAssets.mjs and importTafsir.mjs so the
 * three agree on every rule: document ids, validation, the run-length manifest
 * and the search-index encoding. Nothing here touches the network.
 *
 * DESIGN NOTES (measured, not assumed — see scripts/firebase/measureSearchIndex.js)
 *
 *  - All 18,708 records across the three sources are SINGLE-ayah
 *    (ayah_start === ayah_end). Retrieval is a pure key-value lookup.
 *  - Explanation text is heavily duplicated: Ibn Kathir has 1,911 distinct
 *    texts for 6,236 records, Tabari 3,636. The text is passage-level and was
 *    flattened per-ayah by copying. Content-addressing recovers that structure
 *    and cuts stored bytes ~60% without inventing passage boundaries.
 *  - The largest single explanation is 145.9 KB against Firestore's ~1 MiB
 *    limit, so no document needs chunking. The guard below exists so that if a
 *    future corpus breaks that assumption the import STOPS rather than silently
 *    truncating scripture.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');

/* ------------------------------------------------------------------ */
/* Load the app's REAL normalizeText                                   */
/* ------------------------------------------------------------------ */

/**
 * The search index must tokenize exactly the way the running app does, or a
 * query would look up terms the index never stored. Rather than copy the
 * normalizer (and let it drift), transpile the real TypeScript on the fly —
 * the same trick scripts/testTafsirEngine.js uses.
 */
function loadNormalizeText() {
  const ts = require('typescript');
  globalThis.__DEV__ = false;
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
  return require(path.join(REPO_ROOT, 'src/utils/textNormalizer.ts')).normalizeText;
}

export const normalizeText = loadNormalizeText();

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export const SOURCES = [
  { id: 'al_saadi', arabicName: 'تفسير السعدي', file: 'src/data/tafseer_saadi.json' },
  { id: 'ibn_kathir', arabicName: 'تفسير ابن كثير', file: 'src/data/tafseer_ibn_kathir.json' },
  { id: 'al_tabari', arabicName: 'تفسير الطبري', file: 'src/data/tafseer_tabari.json' },
];

export const SOURCE_IDS = SOURCES.map((s) => s.id);

/** The one source the local keyword/topic/word-meaning search runs against. */
export const SEARCHED_SOURCE = 'al_saadi';

export function sourceById(id) {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown tafsir source: ${id}`);
  return found;
}

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

/** Firestore's hard per-document limit is 1 MiB; stay well inside it. */
export const MAX_EXPLANATION_BYTES = 900_000;
/** A manifest larger than this would be a poor thing to bundle. */
export const MAX_MANIFEST_BYTES = 800_000;

export const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Content-addressed ids make the import idempotent (re-running converges to
 * identical bytes), make a crashed run safe to simply re-run, and make cached
 * passages immutable — a cached entry can never go stale, because changed text
 * produces a different id.
 */
export function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 20);
}

export function contentDocId(sourceId, hash) {
  return `${sourceId}__${hash}`;
}

export function utf8Bytes(text) {
  return Buffer.byteLength(text, 'utf8');
}

/* ------------------------------------------------------------------ */
/* Reading + validation                                                */
/* ------------------------------------------------------------------ */

export function readSourceRecords(sourceId) {
  const src = sourceById(sourceId);
  const abs = path.join(REPO_ROOT, src.file);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing dataset: ${src.file}`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`${src.file}: expected a JSON array at the root`);
  }
  return { records: raw, absPath: abs, sizeBytes: fs.statSync(abs).size };
}

/** Ayah counts per surah, taken from the verified mushaf rather than hardcoded. */
let ayahCounts = null;
export function ayahCountFor(surah) {
  if (!ayahCounts) {
    const quran = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'src/data/quran/quran.json'), 'utf8'),
    );
    ayahCounts = new Map();
    for (const a of quran) {
      const s = a.surahNumber;
      ayahCounts.set(s, Math.max(ayahCounts.get(s) ?? 0, a.ayahNumber));
    }
  }
  return ayahCounts.get(surah) ?? null;
}

/**
 * Validates one source and returns both a report and the records that passed.
 * Structural problems are collected rather than thrown so a caller can print a
 * full report; the caller decides whether to abort.
 */
export function validateSource(sourceId, records) {
  const report = {
    sourceId,
    total: records.length,
    valid: 0,
    invalidSurah: 0,
    invalidAyah: 0,
    emptyExplanation: 0,
    rangeRecords: 0,
    duplicates: 0,
    oversized: 0,
    surahsFound: new Set(),
    minAyah: Infinity,
    maxAyah: -Infinity,
    largestBytes: 0,
    largestRef: null,
    totalBytes: 0,
    issues: [],
  };

  const seen = new Set();
  const accepted = [];

  for (const r of records) {
    const surah = r?.surah;
    const start = r?.ayah_start;
    const end = r?.ayah_end;
    const text = typeof r?.explanation === 'string' ? r.explanation : '';

    if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
      report.invalidSurah += 1;
      continue;
    }
    const maxAyah = ayahCountFor(surah);
    if (!Number.isInteger(start) || start < 1 || (maxAyah && start > maxAyah)) {
      report.invalidAyah += 1;
      continue;
    }
    if (!text.trim()) {
      report.emptyExplanation += 1;
      continue;
    }

    // The whole model assumes one record == one ayah. If that ever changes the
    // import must stop, not guess how to spread a passage across ayahs.
    if (end !== start) {
      report.rangeRecords += 1;
      report.issues.push(`range record at ${surah}:${start}-${end}`);
      continue;
    }

    const key = `${surah}:${start}`;
    if (seen.has(key)) {
      report.duplicates += 1;
      continue;
    }
    seen.add(key);

    const bytes = utf8Bytes(text);
    if (bytes > MAX_EXPLANATION_BYTES) {
      report.oversized += 1;
      report.issues.push(`oversized explanation at ${surah}:${start} (${bytes} bytes)`);
      continue;
    }

    if (bytes > report.largestBytes) {
      report.largestBytes = bytes;
      report.largestRef = `${surah}:${start}`;
    }
    report.totalBytes += bytes;
    report.surahsFound.add(surah);
    report.minAyah = Math.min(report.minAyah, start);
    report.maxAyah = Math.max(report.maxAyah, start);
    report.valid += 1;

    accepted.push({ surah, ayah: start, text });
  }

  if (report.minAyah === Infinity) report.minAyah = 0;
  if (report.maxAyah === -Infinity) report.maxAyah = 0;

  report.missingSurahs = [];
  for (let s = 1; s <= 114; s += 1) {
    if (!report.surahsFound.has(s)) report.missingSurahs.push(s);
  }

  return { report, accepted };
}

/* ------------------------------------------------------------------ */
/* Content set + manifest                                              */
/* ------------------------------------------------------------------ */

/**
 * Groups accepted records into distinct content documents and a per-surah
 * run-length manifest.
 *
 * Manifest encoding — one string per surah:
 *     "start-end:hash;start-end:hash"
 * Firestore forbids nested arrays, and a string is also the most compact form
 * to bundle. Runs are built only from CONSECUTIVE ayahs sharing a hash, so
 * non-contiguous repeats simply become two runs pointing at the same content
 * document. The model never assumes passages are contiguous — only that
 * duplicated text is byte-identical.
 */
export function buildContentModel(accepted) {
  const contents = new Map(); // hash -> { text, bytes, refs }
  const bySurah = new Map(); // surah -> [{ ayah, hash }]

  for (const rec of accepted) {
    const hash = hashText(rec.text);
    const existing = contents.get(hash);
    if (existing) existing.refs += 1;
    else contents.set(hash, { text: rec.text, bytes: utf8Bytes(rec.text), refs: 1 });

    if (!bySurah.has(rec.surah)) bySurah.set(rec.surah, []);
    bySurah.get(rec.surah).push({ ayah: rec.ayah, hash });
  }

  const runs = {};
  let runCount = 0;
  for (const [surah, list] of bySurah) {
    list.sort((a, b) => a.ayah - b.ayah);
    const parts = [];
    let start = list[0].ayah;
    let end = list[0].ayah;
    let hash = list[0].hash;
    for (let i = 1; i < list.length; i += 1) {
      const item = list[i];
      if (item.hash === hash && item.ayah === end + 1) {
        end = item.ayah;
      } else {
        parts.push(`${start}-${end}:${hash}`);
        start = item.ayah;
        end = item.ayah;
        hash = item.hash;
      }
    }
    parts.push(`${start}-${end}:${hash}`);
    runCount += parts.length;
    runs[String(surah)] = parts.join(';');
  }

  return { contents, runs, runCount };
}

/* ------------------------------------------------------------------ */
/* Search index (As-Sa'di only)                                        */
/* ------------------------------------------------------------------ */

/**
 * Mirrors chatbotSearch.tokenize(): tokens of length >= 2 that are not pure
 * digits. Stopword filtering is deliberately NOT applied here — the runtime
 * applies its own STOPWORDS set to the QUERY, and keeping every token in the
 * index means the candidate set stays exact rather than approximate.
 */
export function indexTokens(text) {
  return normalizeText(text)
    .split(' ')
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t));
}

/** countOccurrences() in chatbotSearch.ts stops counting at 6. */
export const MAX_TOKEN_COUNT = 6;

/**
 * Builds the bundled search index for the searched source.
 *
 * Encoding, one token per line:
 *     token:delta,delta.count,delta
 * `delta` is the gap from the previous document index; `.count` is omitted when
 * the count is 1 (the common case). Document indexes refer to `refs`, which
 * lists "surah:ayah" in the same order.
 *
 * `ayahText` carries each record's NORMALIZED ayah text. It is bundled rather
 * than read from quran.json because they disagree for 406 of 6,236 ayahs —
 * quran.json prepends the basmala to first ayahs and spells hamza differently
 * (الءاخر vs الاخر). Using the tafsir's own text keeps scoring byte-identical
 * to the current behaviour.
 */
export function buildSearchIndex(accepted, records) {
  const byRef = new Map();
  for (const r of records) {
    if (Number.isInteger(r?.surah) && Number.isInteger(r?.ayah_start)) {
      byRef.set(`${r.surah}:${r.ayah_start}`, r.ayah_text ?? '');
    }
  }

  const refs = [];
  const ayahText = [];
  const postings = new Map();

  accepted.forEach((rec, docIndex) => {
    const ref = `${rec.surah}:${rec.ayah}`;
    refs.push(ref);
    ayahText.push(normalizeText(byRef.get(ref) ?? ''));

    const counts = new Map();
    for (const token of indexTokens(rec.text)) {
      counts.set(token, Math.min((counts.get(token) ?? 0) + 1, MAX_TOKEN_COUNT));
    }
    for (const [token, count] of counts) {
      let list = postings.get(token);
      if (!list) {
        list = [];
        postings.set(token, list);
      }
      list.push([docIndex, count]);
    }
  });

  const lines = [];
  let totalPostings = 0;
  for (const [token, list] of postings) {
    let prev = 0;
    const parts = list.map(([doc, count]) => {
      const delta = doc - prev;
      prev = doc;
      return count === 1 ? String(delta) : `${delta}.${count}`;
    });
    totalPostings += list.length;
    lines.push(`${token}:${parts.join(',')}`);
  }

  return {
    v: SCHEMA_VERSION,
    source: SEARCHED_SOURCE,
    refs: refs.join(','),
    ayahText: ayahText.join('\n'),
    tokens: lines.join('\n'),
    stats: { docs: refs.length, tokens: postings.size, postings: totalPostings },
  };
}

/* ------------------------------------------------------------------ */
/* Output paths                                                        */
/* ------------------------------------------------------------------ */

export const ASSET_DIR = path.join(REPO_ROOT, 'src/data/tafsir-index');

export function manifestPath(sourceId) {
  return path.join(ASSET_DIR, `${sourceId}.manifest.json`);
}

export function searchIndexPath() {
  return path.join(ASSET_DIR, 'saadi.search.json');
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}
