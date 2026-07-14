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
