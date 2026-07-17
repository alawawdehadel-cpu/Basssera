import { toArabicDigits } from '../utils/numerals';

/**
 * Hijri (Umm al-Qura) date label for the Home header, e.g.
 * "الخميس، ٢٢ محرّم ١٤٤٧هـ". Uses Intl's islamic-umalqura calendar when
 * available; falls back to the Gregorian Arabic date rather than guessing
 * a Hijri conversion.
 */
export function getHijriDateLabel(date: Date = new Date()): string {
  try {
    const weekday = new Intl.DateTimeFormat('ar', { weekday: 'long' }).format(date);
    const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (day && month && year) {
      return `${weekday}، ${day} ${month} ${year}هـ`;
    }
  } catch {
    /* fall through to Gregorian */
  }
  try {
    const fmt = new Intl.DateTimeFormat('ar', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return fmt.format(date);
  } catch {
    return toArabicDigits(date.toLocaleDateString('ar'));
  }
}
