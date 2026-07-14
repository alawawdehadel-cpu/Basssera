/**
 * Arabic/English text normalization used by the local search engine.
 * The tafseer source text contains full Quranic diacritics (tashkeel),
 * alef wasla and Quranic annotation marks - all of these must be
 * stripped/unified so plain user input can match it.
 */

/**
 * Tashkeel + Quranic annotation marks:
 * - u0610-u061A : honorific / Quranic marks
 * - u064B-u065F : fathatan...sukun and other harakat
 * - u0670       : superscript alef
 * - u06D6-u06ED : Quranic annotation signs (waqf marks, small high signs)
 * - u08D3-u08FF : extended Arabic marks
 */
const DIACRITICS_RE = new RegExp(
  '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u08D3-\\u08FF]',
  'g',
);

/** Tatweel (kashida) stretching character. */
const TATWEEL_RE = new RegExp('\\u0640', 'g');

/** Arabic-Indic (0660-0669) and Extended Arabic-Indic (06F0-06F9) digits. */
const ARABIC_DIGITS_RE = new RegExp('[\\u0660-\\u0669\\u06F0-\\u06F9]', 'g');

const ARABIC_LETTER_RE = new RegExp('[\\u0600-\\u06FF\\u0750-\\u077F]');

/** Remove all Arabic diacritics / Quranic marks. */
export function stripTashkeel(text: string): string {
  return text.replace(DIACRITICS_RE, '');
}

/** Convert Arabic-Indic numerals to Western digits. */
export function toWesternDigits(text: string): string {
  return text.replace(ARABIC_DIGITS_RE, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Does the text contain any Arabic letters? */
export function containsArabic(text: string): boolean {
  return ARABIC_LETTER_RE.test(text);
}

/**
 * Full normalization pipeline:
 * - strip tashkeel + tatweel
 * - unify alef variants (أ إ آ ٱ -> ا)
 * - unify taa marbuta -> haa, alef maqsura -> yaa
 * - Arabic-Indic digits -> Western digits
 * - lowercase Latin letters
 * - strip punctuation, collapse whitespace
 */
export function normalizeText(text: string): string {
  return toWesternDigits(stripTashkeel(text))
    .replace(TATWEEL_RE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[،؛؟,.;:!?"'«»()\[\]{}–—…\/\\\|*+~^%$#@&_=<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
