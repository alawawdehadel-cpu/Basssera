/**
 * بصيرة (Basirah) design tokens — transcribed 1:1 from the design handoff
 * (design_handoff_basirah_app). Gold is reserved for verse numbers,
 * active/selected states and small highlights — never body text.
 */

export interface ThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  text3: string;
  border: string;
  emerald: string;
  emerald2: string;
  emerald3: string;
  gold: string;
  goldSoft: string;
  success: string;
  error: string;
  navBg: string;
  navActive: string;
  shadow: string;
  heroFrom: string;
  heroTo: string;
  readerPaper: string;
  readerText: string;
  /** Soft tints used for icon tiles / chips. */
  emeraldTint: string;
  goldTint: string;
  goldTintStrong: string;
}

export const LIGHT: ThemeTokens = {
  bg: '#F7F5ED',
  surface: '#FFFDF8',
  surface2: '#F0EDE3',
  text: '#0D1B2A',
  text2: '#68736E',
  text3: '#9AA39E',
  border: '#E4DED0',
  emerald: '#0F6B50',
  emerald2: '#084C3C',
  emerald3: '#06362D',
  gold: '#C9A227',
  goldSoft: '#DFC96C',
  success: '#2E7D64',
  error: '#B64D4D',
  navBg: '#FFFDF8',
  navActive: 'rgba(15,107,80,.10)',
  shadow: 'rgba(13,27,42,.5)',
  heroFrom: '#0F6B50',
  heroTo: '#084C3C',
  readerPaper: '#FBF8EF',
  readerText: '#10241C',
  emeraldTint: 'rgba(15,107,80,.12)',
  goldTint: 'rgba(201,162,39,.14)',
  goldTintStrong: 'rgba(201,162,39,.16)',
};

export const DARK: ThemeTokens = {
  bg: '#071F1A',
  surface: '#0D3028',
  surface2: '#153C33',
  text: '#F7F2E5',
  text2: '#A9B7AE',
  text3: '#7C8B82',
  border: 'rgba(247,242,229,.10)',
  emerald: '#148C69',
  emerald2: '#0D3028',
  emerald3: '#071F1A',
  gold: '#D8B84A',
  goldSoft: '#E4CE7A',
  success: '#4BAE8C',
  error: '#D07C7C',
  navBg: '#0A2620',
  navActive: 'rgba(20,140,105,.22)',
  shadow: 'rgba(0,0,0,.6)',
  heroFrom: '#0D3028',
  heroTo: '#06362D',
  readerPaper: '#0A241D',
  readerText: '#EFE7D2',
  emeraldTint: 'rgba(20,140,105,.16)',
  goldTint: 'rgba(216,184,74,.14)',
  goldTintStrong: 'rgba(216,184,74,.18)',
};

/** Screen horizontal margin per spec, 8pt scale elsewhere. */
export const LAYOUT = {
  screenX: 20,
  radiusCard: 16,
  radiusCardLg: 20,
  radiusButton: 14,
  radiusPill: 20,
  touchTarget: 44,
} as const;
