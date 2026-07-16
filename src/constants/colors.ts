/** Islamic-heritage palette: dark forest green, gold accents, cream parchment. */
export const COLORS = {
  parchment: '#F6F0E1',
  parchmentDeep: '#ECE2CA',
  cream: '#FFFDF6',
  ink: '#29332E',
  inkSoft: '#5F6A63',
  forest: '#0D3A2D',
  forestDeep: '#07271D',
  emerald: '#177552',
  gold: '#B28A3E',
  goldDeep: '#8A682A',
  goldSoft: '#E6D6AE',
  error: '#B91C1C',
  white: '#FFFFFF',
} as const;

export type ColorKey = keyof typeof COLORS;

/**
 * Refined palette for the Mushaf reader only (top bar, banner, page shell,
 * bottom bar, jump sheet). Kept separate from COLORS so the reader can have a
 * calmer, more premium identity without restyling the rest of the app.
 */
export const READING = {
  /** Dark green chrome (top/bottom bars, banner frame). */
  barBg: '#0B2F24',
  barBgDeep: '#123C2D',
  /** Muted green for secondary text/ornament accents. */
  muted: '#5E7D65',
  /** Warm cream reading surface. */
  paper: '#F8F3E7',
  paperWarm: '#FFFDF8',
  /** Warm parchment / sand for the surah banner plaque (elegant, not white). */
  parchment: '#EDE2C2',
  parchmentDeep: '#E4D5AF',
  /** Gold accent for keylines, medallions, emphasis. */
  gold: '#C8A75B',
  /** Deeper gold for metadata text on cream. */
  goldInk: '#8A682A',
  /** Soft parchment border. */
  border: '#D8C9A6',
  /** Primary reading ink. */
  ink: '#102A22',
} as const;
