/**
 * scripts/fetchMushafLayout.js
 *
 * Fetches real Mushaf page/line layout data (pages 1-604) from a
 * trusted page-layout source and writes it to:
 *
 *   src/data/quran/mushaf-pages.json
 *
 * ============================================================
 * THIS SCRIPT DOES NOT GUESS LINE BREAKS OR FABRICATE LAYOUT.
 * It only reshapes a real API response. If the API is not configured,
 * unreachable, or returns a shape this script doesn't recognize, it
 * prints clear setup instructions and exits WITHOUT writing any file —
 * it never falls back to splitting quran.json into invented lines.
 * ============================================================
 *
 * Trusted source: the Quran.com Content API v4
 * (https://api.quran.com/api/v4), which exposes real per-word
 * `line_number` / `page_number` fields taken directly from the
 * Madani Mushaf typesetting — the same layout data used by QUL and
 * most published Quran apps. You can point this script at another
 * licensed page-layout provider (e.g. the Quran Foundation Page
 * Layout API) by setting MUSHAF_LAYOUT_API_BASE and adjusting only
 * `mapApiPageToMushafPage()` below to match that provider's response
 * shape — every other part of the script (validation, resume support,
 * file writing) stays the same.
 *
 * Usage:
 *   node scripts/fetchMushafLayout.js
 *   npm run build:mushaf
 *
 * Configuration (all optional; sane defaults are used otherwise):
 *   MUSHAF_LAYOUT_API_BASE   API root (default: https://api.quran.com/api/v4)
 *   MUSHAF_LAYOUT_API_KEY    forwarded as `x-auth-token` header, if your
 *                            provider requires authentication
 *   MUSHAF_START_PAGE        first page to fetch (default: 1)
 *   MUSHAF_END_PAGE          last page to fetch (default: 604)
 *
 * Requires Node 18+ (for the built-in global `fetch`).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const TOTAL_MUSHAF_PAGES = 604;

const API_BASE = process.env.MUSHAF_LAYOUT_API_BASE || "https://api.quran.com/api/v4";
const API_KEY = process.env.MUSHAF_LAYOUT_API_KEY || null;
const START_PAGE = Number(process.env.MUSHAF_START_PAGE || 1);
const END_PAGE = Number(process.env.MUSHAF_END_PAGE || TOTAL_MUSHAF_PAGES);

const outputDir = path.join(__dirname, "..", "src", "data", "quran");
const outputPath = path.join(outputDir, "mushaf-pages.json");
const quranJsonPath = path.join(outputDir, "quran.json");

/**
 * Resolves surah numbers to their Arabic names using this repo's own
 * already-verified quran.json (6236-ayah dataset) — a local lookup, not
 * an invented value. Falls back to the numeric string if quran.json is
 * unavailable so the script still runs standalone.
 */
function loadSurahNameMap() {
    const map = new Map();
    try {
        const quran = JSON.parse(fs.readFileSync(quranJsonPath, "utf8"));
        for (const ayah of quran) {
            if (!map.has(ayah.surahNumber)) {
                map.set(ayah.surahNumber, ayah.surahNameArabic);
            }
        }
    } catch {
        // quran.json not readable — surahs[] will fall back to numbers.
    }
    return map;
}

const surahNameMap = loadSurahNameMap();

/**
 * Fetches the raw per-word layout for one Mushaf page from the source API.
 * Adjust ONLY this function (and mapApiPageToMushafPage below) if you
 * switch providers.
 */
async function fetchPageLayout(pageNumber) {
    const url = new URL(`${API_BASE}/verses/by_page/${pageNumber}`);
    url.searchParams.set("words", "true");
    url.searchParams.set(
        "word_fields",
        "text_uthmani,verse_key,position,line_number,page_number,char_type_name",
    );
    url.searchParams.set("fields", "text_uthmani");

    const res = await fetch(url, {
        headers: API_KEY ? { "x-auth-token": API_KEY } : undefined,
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for page ${pageNumber}`);
    }
    return res.json();
}

/**
 * Reshapes ONE provider API response (Quran.com v4 `verses/by_page` shape)
 * into our mushaf-pages.json page shape. This is a pure pass-through
 * mapping — every word's line comes straight from the API's own
 * `line_number` field. Nothing is inferred, split, or guessed here.
 */
function mapApiPageToMushafPage(apiResponse, pageNumber) {
    const verses = apiResponse && apiResponse.verses;
    if (!Array.isArray(verses) || verses.length === 0) {
        throw new Error(
            `Layout source returned no verses for page ${pageNumber} — refusing to guess a layout.`,
        );
    }

    const linesByNumber = new Map();
    const surahNumbers = new Set();
    let juz = null;

    for (const verse of verses) {
        const parts = String(verse.verse_key || "").split(":");
        const surahNumber = Number(parts[0]);
        const ayahNumber = Number(parts[1]);
        if (verse.juz_number) juz = verse.juz_number;

        const words = Array.isArray(verse.words) ? verse.words : [];
        // Drop the small "end of ayah" glyph marker some providers include
        // as a pseudo-word — it is not part of the printed word sequence.
        const contentWords = words.filter((w) => w.char_type_name !== "end");

        contentWords.forEach((w, idx) => {
            const lineNumber = w.line_number;
            if (typeof lineNumber !== "number") {
                throw new Error(
                    `Word missing line_number on page ${pageNumber} (${verse.verse_key}) — ` +
                        "source data is incomplete; refusing to guess a line.",
                );
            }
            if (!linesByNumber.has(lineNumber)) {
                linesByNumber.set(lineNumber, { lineNumber, text: "", words: [] });
            }
            const line = linesByNumber.get(lineNumber);
            const isAyahEnd = idx === contentWords.length - 1;
            line.words.push({
                textUthmani: w.text_uthmani || w.text || "",
                surahNumber,
                ayahNumber,
                wordNumber: w.position || idx + 1,
                ...(isAyahEnd ? { isAyahEnd: true } : {}),
            });
        });

        surahNumbers.add(surahNumber);
    }

    const lines = [...linesByNumber.values()]
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .map((line) => ({
            ...line,
            text: line.words.map((w) => w.textUthmani).join(" "),
        }));

    return {
        pageNumber,
        juz: juz || 0,
        // Arabic surah name(s) present on this page, resolved from this
        // repo's own verified quran.json (falls back to the numeric
        // surah number if that lookup isn't available).
        surahs: [...surahNumbers].map((n) => surahNameMap.get(n) || String(n)),
        lines,
    };
}

function loadExistingPages() {
    if (!fs.existsSync(outputPath)) return new Map();
    try {
        const raw = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        if (!Array.isArray(raw)) return new Map();
        return new Map(raw.map((p) => [p.pageNumber, p]));
    } catch {
        return new Map();
    }
}

function printSetupInstructions(reason) {
    console.error("\n" + "=".repeat(70));
    console.error("Could not fetch Mushaf page layout data.");
    console.error("Reason: " + reason);
    console.error("=".repeat(70));
    console.error(`
No file was written. src/data/quran/mushaf-pages.json is left as-is —
this script never fabricates a layout when the real source is
unavailable.

To fetch real layout data:

  1. Make sure this machine has network access to a trusted Mushaf
     page-layout API. The default is the public Quran.com Content API
     (no key required): https://api.quran.com/api/v4

  2. Optionally point this script at a different licensed provider
     (e.g. the Quran Foundation Page Layout API):

       MUSHAF_LAYOUT_API_BASE=https://your-provider/api \\
       MUSHAF_LAYOUT_API_KEY=your-key \\
       node scripts/fetchMushafLayout.js

     If you switch providers, update mapApiPageToMushafPage() in this
     script so it matches that provider's response shape — the rest of
     the script (page loop, validation, file writing) does not need to
     change.

  3. Run:  node scripts/fetchMushafLayout.js
     or:   npm run build:mushaf

See src/data/quran/README.md for the full explanation of why
quran.json alone cannot produce this layout.
`);
}

async function main() {
    console.log(`Mushaf layout source: ${API_BASE}`);
    console.log(`Fetching pages ${START_PAGE}-${END_PAGE}...`);

    // Fail fast and loudly if the source is not reachable at all, instead
    // of grinding through 604 requests that will all fail the same way.
    try {
        await fetchPageLayout(START_PAGE);
    } catch (err) {
        printSetupInstructions(err.message);
        process.exitCode = 1;
        return;
    }

    const byPage = loadExistingPages();

    for (let pageNumber = START_PAGE; pageNumber <= END_PAGE; pageNumber++) {
        try {
            const raw = await fetchPageLayout(pageNumber);
            const mapped = mapApiPageToMushafPage(raw, pageNumber);
            byPage.set(pageNumber, mapped);
            process.stdout.write(`\r  page ${pageNumber}/${END_PAGE} done`);
        } catch (err) {
            console.error(`\nStopped at page ${pageNumber}: ${err.message}`);
            console.error(
                "Not writing a guessed value for this page. Re-run later with " +
                    `MUSHAF_START_PAGE=${pageNumber} to resume.`,
            );
            break;
        }
    }
    console.log();

    const result = [...byPage.values()].sort((a, b) => a.pageNumber - b.pageNumber);
    if (result.length === 0) {
        printSetupInstructions("No pages were successfully fetched.");
        process.exitCode = 1;
        return;
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    console.log("Done!");
    console.log(`Pages saved: ${result.length}/${TOTAL_MUSHAF_PAGES}`);
    console.log("Saved to:", outputPath);

    if (result.length < TOTAL_MUSHAF_PAGES) {
        console.warn(
            `Warning: ${TOTAL_MUSHAF_PAGES - result.length} page(s) still missing. ` +
                "The Mushaf reader will show \"بيانات تخطيط صفحات المصحف غير مضافة بعد.\" " +
                "for those pages until you re-run this script to fill them in.",
        );
    }
}

main().catch((err) => {
    printSetupInstructions(err.message);
    process.exitCode = 1;
});
