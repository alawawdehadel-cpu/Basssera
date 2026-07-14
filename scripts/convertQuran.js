const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "..", "raw-quran.json");
const outputDir = path.join(__dirname, "..", "src", "data", "quran");
const outputPath = path.join(outputDir, "quran.json");

function normalizeArabicText(text) {
    return text
        .replace(/[\u064B-\u065F\u0670]/g, "")
        .replace(/[إأآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/[^\u0600-\u06FF\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

if (!input.data || !Array.isArray(input.data.surahs)) {
    throw new Error("Invalid raw-quran.json format");
}

const quran = [];

for (const surah of input.data.surahs) {
    for (const ayah of surah.ayahs) {
        quran.push({
            id: `${surah.number}:${ayah.numberInSurah}`,
            surahNumber: surah.number,
            surahNameArabic: surah.name,
            surahNameEnglish: surah.englishName,
            ayahNumber: ayah.numberInSurah,

            // هذا هو النص المهم للقراءة بالرسم العثماني
            textUthmani: ayah.text,

            // للبحث العادي
            textSimple: normalizeArabicText(ayah.text),

            // للبحث الذكي
            textNormalized: normalizeArabicText(ayah.text),

            juz: ayah.juz,
            page: ayah.page,
            hizbQuarter: ayah.hizbQuarter,
            sajda: ayah.sajda,
        });
    }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(quran, null, 2), "utf8");

console.log("Done!");
console.log("Total ayahs:", quran.length);
console.log("Saved to:", outputPath);

if (quran.length !== 6236) {
    console.warn("Warning: Expected 6236 ayahs. Please verify the source file.");
}