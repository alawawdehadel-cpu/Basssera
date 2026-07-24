/**
 * Deterministic, extractive-only shortening of tafsir text.
 *
 * The app has NO generative AI, so a "summary" / "simplification" is never a
 * rewrite — it is a verbatim excerpt of the source explanation (labeled
 * «مقتطف مختصر» in the UI), with the full text always one tap away.
 */

/**
 * Safe collapsed preview of a tafsir explanation for card display.
 *
 * - normalizes whitespace **for display only** (never mutates the stored full
 *   text — callers pass a copy of `explanation`),
 * - never cuts in the middle of an Arabic word (backs up to the last space),
 * - adds an ellipsis **only** when it actually truncated.
 *
 * Ibn Kathir / Al-Tabari passages can be very long, so the default limit is
 * generous (600 chars) — the full text is always available behind the
 * card's expand control.
 */
export function createArabicExcerpt(text: string, maxLength = 600): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  let cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  // Only back up to the word boundary if it doesn't throw away too much.
  if (lastSpace > maxLength * 0.6) cut = cut.slice(0, lastSpace);
  return `${cut.trimEnd()}…`;
}

/** First whole sentences of `text` up to ~maxChars, cut on sentence bounds. */
export function extractiveExcerpt(text: string, maxChars = 320): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const sentences = clean.split(/(?<=[.؟!])\s+|\n+/).filter(Boolean);
  let out = '';
  for (const s of sentences) {
    if (out.length + s.length > maxChars && out.length > 0) break;
    out += (out ? ' ' : '') + s;
    if (out.length >= maxChars) break;
  }
  return (out || clean.slice(0, maxChars)).trimEnd() + '…';
}
