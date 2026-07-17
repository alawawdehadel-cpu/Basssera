/**
 * Locale-aware Arabic-Indic numeral formatting (٠١٢٣٤٥٦٧٨٩).
 * Per the design handoff, every displayed number (page, ayah, counters,
 * times) uses Arabic-Indic digits — never hardcoded per screen.
 */

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(value: number | string): string {
  return String(value)
    .split('')
    .map((ch) => {
      const d = ch.charCodeAt(0) - 48;
      return d >= 0 && d <= 9 ? EASTERN_DIGITS[d] : ch;
    })
    .join('');
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
