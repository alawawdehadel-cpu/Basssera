import { normalizeText } from './textNormalizer';

/**
 * Well-known ayahs are commonly called by a nickname rather than by
 * surah name + ayah number (e.g. «آية الكرسي» — Ayat al-Kursi — for
 * Al-Baqarah 255). That nickname does not literally appear as a
 * substring of the ayah's own text, so a plain phrase/keyword search
 * can never find it — it must be recognized as a fixed reference.
 *
 * This is a small, verified lookup table (surah/ayah numbers are
 * public, unambiguous facts), never a guess: add an entry here only
 * once you've confirmed the surah/ayah number against the mushaf.
 */
const NAMED_AYAH_ALIASES: { alias: string; surah: number; ayah: number }[] = [
  { alias: 'آية الكرسي', surah: 2, ayah: 255 },
  // «آية الدين» — Ayat ad-Dayn (the verse of debt contracts), the
  // longest ayah in the Quran. Al-Baqarah 282 is grouped with 283 in
  // the tafsir dataset (one continuous ruling), so resolving to 282
  // surfaces the full combined explanation covering both ayahs.
  { alias: 'آية الدين', surah: 2, ayah: 282 },
];

const NORMALIZED_ALIASES = NAMED_AYAH_ALIASES.map((entry) => ({
  ...entry,
  normAlias: normalizeText(entry.alias),
}));

/** Returns the {surah, ayah} a well-known nickname refers to, if the query mentions one. */
export function resolveNamedAyah(normQuery: string): { surah: number; ayah: number } | null {
  const padded = ` ${normQuery} `;
  for (const entry of NORMALIZED_ALIASES) {
    if (padded.includes(` ${entry.normAlias} `) || normQuery === entry.normAlias) {
      return { surah: entry.surah, ayah: entry.ayah };
    }
  }
  return null;
}
