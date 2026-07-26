/**
 * Locale-aware Arabic-Indic numeral formatting (٠١٢٣٤٥٦٧٨٩).
 * Per the design handoff, every displayed number (page, ayah, counters,
 * times) uses Arabic-Indic digits — never hardcoded per screen.
 */

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Digit locale for display. Set once by the language provider so formatting
 * helpers stay synchronous and callers don't have to thread `lang` through
 * every component. Pure helpers below still accept an explicit language.
 */
let numeralLanguage: 'ar' | 'en' = 'ar';

export function setNumeralLanguage(lang: 'ar' | 'en'): void {
  numeralLanguage = lang;
}

export function getNumeralLanguage(): 'ar' | 'en' {
  return numeralLanguage;
}

/** Arabic-Indic digits in Arabic, Latin digits in English. */
export function formatNumber(value: number | string, lang: 'ar' | 'en' = numeralLanguage): string {
  return lang === 'ar' ? toArabicDigits(value) : String(value);
}

export function toArabicDigits(value: number | string): string {
  return String(value)
    .split('')
    .map((ch) => {
      const d = ch.charCodeAt(0) - 48;
      return d >= 0 && d <= 9 ? EASTERN_DIGITS[d] : ch;
    })
    .join('');
}

/** Arabic-Indic form of an ayah number (alias of toArabicDigits, spec name). */
export function toArabicIndicNumber(value: number): string {
  return toArabicDigits(value);
}

/**
 * The decorated Quran ayah marker, e.g. ﴿٢﴾. One shared formatter used for
 * every verse the chatbot renders, so numbering is consistent everywhere.
 */
export function formatAyahMarker(ayahNumber: number): string {
  return `﴿${toArabicDigits(ayahNumber)}﴾`;
}

/**
 * Removes a trailing ayah-number ornament (﴿٢﴾ / ۝٢ / a bare trailing number)
 * some stored texts already carry, so a marker is never rendered twice.
 */
export function stripExistingAyahMarker(text: string): string {
  return text.replace(/[﴿۝]\s*[٠-٩0-9]+\s*﴾?\s*$/u, '').trimEnd();
}

/**
 * A single verse followed by exactly one decorated ayah marker. Applied at the
 * point a Quran reference's text is built, so the renderer stays dumb and no
 * verse is ever numbered twice.
 */
export function withAyahMarker(text: string, ayahNumber: number): string {
  return `${stripExistingAyahMarker(text)} ${formatAyahMarker(ayahNumber)}`;
}

/** "٤:١٢" style playback time. */
export function toArabicTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${toArabicDigits(m)}:${toArabicDigits(String(r).padStart(2, '0'))}`;
}

/** "٦٤٪" style percentage. */
export function toArabicPercent(fraction: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return `${toArabicDigits(pct)}٪`;
}

/**
 * Removes a leading "سورة"/"سُورَةُ" prefix so callers can prepend their own
 * "سورة " without doubling it (mushaf-pages.json names embed the prefix,
 * quran.json names do not).
 */
export function stripSurahPrefix(name: string): string {
  return name.replace(/^\s*سُورَةُ?\s+/, '').replace(/^\s*سورة\s+/, '').trim();
}
