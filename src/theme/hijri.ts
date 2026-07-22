
/**
 * Hijri (Umm al-Qura) date label for the Home header, e.g.
 * "الخميس، ٢٢ محرّم ١٤٤٧هـ". Uses Intl's islamic-umalqura calendar when
 * available; falls back to the Gregorian Arabic date rather than guessing
 * a Hijri conversion.
 */
export function getHijriDateLabel(date: Date = new Date(), lang: 'ar' | 'en' = 'ar'): string {
  const locale = lang === 'ar' ? 'ar' : 'en';
  const hijriLocale =
    lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-arab' : 'en-u-ca-islamic-umalqura';
  const suffix = lang === 'ar' ? 'هـ' : ' AH';
  try {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
    const parts = new Intl.DateTimeFormat(hijriLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (day && month && year) {
      return lang === 'ar' ? `${weekday}، ${day} ${month} ${year}${suffix}` : `${weekday}, ${day} ${month} ${year}${suffix}`;
    }
  } catch {
    /* fall through to Gregorian */
  }
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return fmt.format(date);
  } catch {
    return date.toLocaleDateString(locale);
  }
}
