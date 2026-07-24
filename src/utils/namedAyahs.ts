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
 * once you've confirmed the surah/ayah number(s) against the mushaf.
 *
 * Some nicknames span a RANGE of ayahs (e.g. «خواتيم سورة البقرة» — the
 * last two ayahs, 285–286). `ayahEnd` defaults to `ayah` for single-ayah
 * names, so both a single-ayah caller (resolveNamedAyah) and a range-aware
 * caller (resolveNamedAyahRange) read the same table.
 */
interface NamedAyahEntry {
  alias: string;
  /** Canonical display name (may differ from the matched alias). */
  canonical: string;
  surah: number;
  ayah: number;
  /** Last ayah of the range; omitted = single ayah. */
  ayahEnd?: number;
  /**
   * True when the nickname is genuinely ambiguous (points at more than one
   * well-known reading). Such names are never silently resolved — callers
   * must ask the user to disambiguate. (None today; the flag reserves the
   * behavior the spec requires.)
   */
  ambiguous?: boolean;
}

const NAMED_AYAH_ALIASES: NamedAyahEntry[] = [
  { alias: 'آية الكرسي', canonical: 'آية الكرسي', surah: 2, ayah: 255 },
  // «آية الدين» — Ayat ad-Dayn (the verse of debt contracts), the
  // longest ayah in the Quran. Al-Baqarah 282 is grouped with 283 in
  // the tafsir dataset (one continuous ruling), so resolving to 282
  // surfaces the full combined explanation covering both ayahs.
  { alias: 'آية الدين', canonical: 'آية الدين', surah: 2, ayah: 282, ayahEnd: 283 },
  // «آية النور» — An-Nur 24:35 («الله نور السماوات والأرض»).
  { alias: 'آية النور', canonical: 'آية النور', surah: 24, ayah: 35 },
  // «خواتيم سورة البقرة» / «آخر آيتين من سورة البقرة» — Al-Baqarah 285–286.
  { alias: 'خواتيم سورة البقرة', canonical: 'خواتيم سورة البقرة', surah: 2, ayah: 285, ayahEnd: 286 },
  { alias: 'اواخر سورة البقرة', canonical: 'خواتيم سورة البقرة', surah: 2, ayah: 285, ayahEnd: 286 },
];

const NORMALIZED_ALIASES = NAMED_AYAH_ALIASES.map((entry) => ({
  ...entry,
  normAlias: normalizeText(entry.alias),
  ayahEnd: entry.ayahEnd ?? entry.ayah,
}));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchEntry(normQuery: string): (typeof NORMALIZED_ALIASES)[number] | null {
  const padded = ` ${normQuery} `;
  let best: (typeof NORMALIZED_ALIASES)[number] | null = null;
  for (const entry of NORMALIZED_ALIASES) {
    // Allow a single glued Arabic preposition before the alias, so «لآية
    // الكرسي» / «بآية الكرسي» (normalized «لايه/بايه الكرسي») still match the
    // «ايه الكرسي» alias, not only the bare form.
    const re = new RegExp(`(^|\\s)[لبوفك]?${escapeRegExp(entry.normAlias)}(\\s|$)`);
    if (re.test(padded) || normQuery === entry.normAlias) {
      // Prefer the longest matching alias (e.g. «خواتيم سورة البقرة» over a
      // shorter accidental containment).
      if (!best || entry.normAlias.length > best.normAlias.length) best = entry;
    }
  }
  return best;
}

/**
 * Returns the {surah, ayah} a well-known nickname refers to, if the query
 * mentions one. For a range name, this returns the FIRST ayah — kept for
 * backward compatibility with callers that only expect a single ayah.
 */
export function resolveNamedAyah(normQuery: string): { surah: number; ayah: number } | null {
  const entry = matchEntry(normQuery);
  if (!entry || entry.ambiguous) return null;
  return { surah: entry.surah, ayah: entry.ayah };
}

export interface NamedAyahRange {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  /** Canonical Arabic name of the matched nickname. */
  name: string;
  /** True when the nickname is ambiguous and must not be auto-resolved. */
  ambiguous: boolean;
}

/**
 * Range-aware nickname resolver. Returns the full ayah range plus the
 * canonical name, or null if no nickname matched. An `ambiguous` entry is
 * still returned (with `ambiguous: true`) so the caller can ask the user to
 * clarify rather than silently picking one reading.
 */
export function resolveNamedAyahRange(normQuery: string): NamedAyahRange | null {
  const entry = matchEntry(normQuery);
  if (!entry) return null;
  return {
    surah: entry.surah,
    ayahStart: entry.ayah,
    ayahEnd: entry.ayahEnd,
    name: entry.canonical,
    ambiguous: entry.ambiguous ?? false,
  };
}
