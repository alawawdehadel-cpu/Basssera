import { FONTS } from '../constants/typography';
import type { QuranAyah } from '../types/quran.types';

let alreadyRan = false;

/**
 * Dev-only sanity check for the Quran reader's rendering contract. Runs once
 * per session and logs a concise report confirming that:
 *   - a dedicated Quran font (not the UI font) is configured,
 *   - the data actually carries `textUthmani`, and
 *   - the reader is displaying Uthmani text, never the simplified/normalized
 *     variants (those are for search only).
 * No-op in production. Never mutates data.
 */
export function runQuranRenderCheck(sample: QuranAyah[] | undefined, fontsLoaded: boolean): void {
  if (!__DEV__ || alreadyRan) return;
  alreadyRan = true;

  const first = sample?.[0];
  const report = {
    quranFont: FONTS.quran,
    fontLoaded: fontsLoaded,
    usesDedicatedFont: FONTS.quran !== FONTS.base && FONTS.quran !== FONTS.arabic,
    hasUthmani: Boolean(first?.textUthmani),
    uthmaniDiffersFromSimple: Boolean(first) && first!.textUthmani !== first!.textSimple,
  };

  if (!report.fontLoaded)
    console.warn('[QuranRenderCheck] Quran font not loaded yet — Quran text should not render until it is.');
  if (!report.usesDedicatedFont)
    console.warn('[QuranRenderCheck] Quran text is not using a dedicated Quran font.');
  if (first && !report.hasUthmani)
    console.warn('[QuranRenderCheck] Ayah is missing textUthmani — display would be broken.');
  if (first && !report.uthmaniDiffersFromSimple)
    console.warn('[QuranRenderCheck] textUthmani equals textSimple — check the reader is not showing normalized text.');

  console.log('[QuranRenderCheck]', report);
}
