import { View } from 'react-native';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';
import { FONT } from '../../../theme/fonts';
import type { ThemeTokens } from '../../../theme/tokens';
import { toArabicDigits } from '../../../utils/numerals';
import Txt from '../Txt';

/**
 * Colors for the printed-mushaf ornaments (frame, banner, rosettes),
 * modeled on the classic Madani mushaf page: maroon/gold outer keylines,
 * a woven brown lattice band, green banner end-caps, and teal-centered
 * gold star rosettes. Adapts to dark mode without pure black/white.
 */
export interface OrnamentPalette {
  paper: string;
  ink: string;
  frameEdge: string;
  frameGold: string;
  bandBg: string;
  bandMotif: string;
  bannerGreen: string;
  bannerGreenDeep: string;
  bannerGold: string;
  cartouche: string;
  rosetteStar: string;
  rosetteGold: string;
  rosetteCenter: string;
  rosetteNum: string;
}

export function ornamentPalette(c: ThemeTokens, isDark: boolean): OrnamentPalette {
  if (isDark) {
    return {
      paper: c.readerPaper,
      ink: c.readerText,
      frameEdge: '#6E2A2A',
      frameGold: c.gold,
      bandBg: '#16483A',
      bandMotif: '#2E6650',
      bannerGreen: '#12603E',
      bannerGreenDeep: '#0C4630',
      bannerGold: c.gold,
      cartouche: c.surface,
      rosetteStar: c.gold,
      rosetteGold: c.goldSoft,
      rosetteCenter: '#215247',
      rosetteNum: c.readerText,
    };
  }
  return {
    paper: c.readerPaper,
    ink: c.readerText,
    frameEdge: '#8A1C1C',
    frameGold: '#B58A2E',
    bandBg: '#CBAA6B',
    bandMotif: '#6E4A22',
    bannerGreen: '#0F6B3F',
    bannerGreenDeep: '#0A4D2E',
    bannerGold: '#B58A2E',
    cartouche: '#FCF9EE',
    rosetteStar: '#8A5A2B',
    rosetteGold: '#B58A2E',
    rosetteCenter: '#A6D9CE',
    rosetteNum: '#5E3D1E',
  };
}

/* ------------------------------------------------------------------ */
/* Ayah rosette — 8-point gold star with a teal center + number        */
/* ------------------------------------------------------------------ */

function starPoints(cx: number, cy: number, outer: number, inner: number, spikes = 8): string {
  const step = Math.PI / spikes;
  let rot = -Math.PI / 2;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(rot) * r).toFixed(2)},${(cy + Math.sin(rot) * r).toFixed(2)}`);
    rot += step;
  }
  return pts.join(' ');
}

export function AyahRosette({
  number,
  size,
  palette,
}: {
  number: number;
  size: number;
  palette: OrnamentPalette;
}) {
  const s = Math.max(20, size);
  const cx = s / 2;
  const outer = s / 2;
  const inner = outer * 0.66;
  const centerR = outer * 0.52;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ position: 'absolute' }}>
        <Polygon
          points={starPoints(cx, cx, outer, inner)}
          fill={palette.rosetteGold}
          stroke={palette.rosetteStar}
          strokeWidth={s * 0.04}
          strokeLinejoin="round"
        />
        <Circle cx={cx} cy={cx} r={centerR} fill={palette.rosetteCenter} stroke={palette.rosetteStar} strokeWidth={s * 0.03} />
      </Svg>
      <Txt
        size={s * 0.34}
        weight={700}
        align="center"
        color={palette.rosetteNum}
        style={{ fontFamily: FONT.ui700, lineHeight: s * 0.34 * 1.05 }}
      >
        {toArabicDigits(number)}
      </Txt>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Small roundel used inside the banner end-caps (juz / ayah count)    */
/* ------------------------------------------------------------------ */

function Roundel({ label, value, palette }: { label: string; value: string; palette: OrnamentPalette }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: palette.cartouche,
          borderWidth: 1,
          borderColor: palette.bannerGold,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt size={11} weight={700} align="center" color={palette.bannerGreenDeep} style={{ fontFamily: FONT.ui700 }}>
          {value}
        </Txt>
      </View>
      <Txt size={7} weight={600} align="center" color="rgba(255,255,255,.85)" style={{ marginTop: 1 }}>
        {label}
      </Txt>
    </View>
  );
}

/** Small gold arabesque flourish drawn beside the surah name. */
function Flourish({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16" style={{ transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <G stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round">
        <Path d="M2 8 C 6 8, 6 3, 10 3 S 16 8, 20 8" />
        <Path d="M2 8 C 6 8, 6 13, 10 13 S 16 8, 20 8" />
        <Circle cx={20} cy={8} r={1.6} fill={color} stroke="none" />
      </G>
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Surah banner — cartouche with green end-caps + juz/ayah roundels    */
/* ------------------------------------------------------------------ */

export function SurahBanner({
  surahName,
  juz,
  ayahCount,
  palette,
}: {
  surahName: string;
  juz: number;
  ayahCount: number;
  palette: OrnamentPalette;
}) {
  const EndCap = ({ children, side }: { children: React.ReactNode; side: 'right' | 'left' }) => (
    <View
      style={{
        width: 66,
        backgroundColor: palette.bannerGreen,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        ...(side === 'right'
          ? { borderTopRightRadius: 7, borderBottomRightRadius: 7 }
          : { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 }),
      }}
    >
      {children}
    </View>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        height: 50,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: palette.bannerGold,
        backgroundColor: palette.cartouche,
        overflow: 'hidden',
        marginBottom: 14,
      }}
    >
      {/* right end-cap (RTL leading): ayah count */}
      <EndCap side="right">
        <Roundel label="آية" value={toArabicDigits(ayahCount)} palette={palette} />
      </EndCap>

      {/* center cartouche with surah name */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Flourish color={palette.bannerGold} />
        <Txt
          size={19}
          align="center"
          color={palette.bannerGreenDeep}
          style={{ fontFamily: FONT.quran, lineHeight: 30 }}
          numberOfLines={1}
        >
          {surahName}
        </Txt>
        <Flourish color={palette.bannerGold} flip />
      </View>

      {/* left end-cap (RTL trailing): juz */}
      <EndCap side="left">
        <Roundel label="جزء" value={toArabicDigits(juz)} palette={palette} />
      </EndCap>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Decorative page frame — woven lattice band between gold keylines     */
/* ------------------------------------------------------------------ */

const FRAME_PAD = 18;

/** Zigzag polyline across a horizontal band (peaks alternate top/bottom). */
function hZig(x0: number, x1: number, yTop: number, yBot: number, step: number, startTop: boolean): string {
  let up = startTop;
  let x = x0;
  let d = `M${x.toFixed(1)} ${(up ? yTop : yBot).toFixed(1)}`;
  while (x < x1) {
    x = Math.min(x + step, x1);
    up = !up;
    d += ` L${x.toFixed(1)} ${(up ? yTop : yBot).toFixed(1)}`;
  }
  return d;
}

/** Zigzag polyline across a vertical band (peaks alternate left/right). */
function vZig(y0: number, y1: number, xL: number, xR: number, step: number, startL: boolean): string {
  let left = startL;
  let y = y0;
  let d = `M${(left ? xL : xR).toFixed(1)} ${y.toFixed(1)}`;
  while (y < y1) {
    y = Math.min(y + step, y1);
    left = !left;
    d += ` L${(left ? xL : xR).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

const WEAVE_LEN = 2600; // long enough to overflow any screen; clipped by the strip

/** One horizontal woven strip (top/bottom band): fixed-length zigzags, clipped. */
function HStrip({ band, palette, pos }: { band: number; palette: OrnamentPalette; pos: 'top' | 'bottom' }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, height: band, overflow: 'hidden', [pos]: 0 }}
    >
      <Svg width={WEAVE_LEN} height={band}>
        <G stroke={palette.bandMotif} strokeWidth={1.6} fill="none" strokeLinejoin="round">
          <Path d={hZig(0, WEAVE_LEN, 0.5, band - 0.5, band, true)} />
          <Path d={hZig(0, WEAVE_LEN, 0.5, band - 0.5, band, false)} />
        </G>
      </Svg>
    </View>
  );
}

/** One vertical woven strip (left/right band): fixed-length zigzags, clipped. */
function VStrip({ band, palette, pos }: { band: number; palette: OrnamentPalette; pos: 'left' | 'right' }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, bottom: 0, width: band, overflow: 'hidden', [pos]: 0 }}
    >
      <Svg width={band} height={WEAVE_LEN}>
        <G stroke={palette.bandMotif} strokeWidth={1.6} fill="none" strokeLinejoin="round">
          <Path d={vZig(0, WEAVE_LEN, 0.5, band - 0.5, band, true)} />
          <Path d={vZig(0, WEAVE_LEN, 0.5, band - 0.5, band, false)} />
        </G>
      </Svg>
    </View>
  );
}

export function MushafFrame({
  palette,
  children,
}: {
  palette: OrnamentPalette;
  children: React.ReactNode;
}) {
  const band = 12;
  return (
    // maroon outer edge
    <View style={{ borderRadius: 8, borderWidth: 2, borderColor: palette.frameEdge }}>
      {/* gold outer keyline */}
      <View style={{ borderRadius: 6, borderWidth: 1.2, borderColor: palette.frameGold }}>
        {/* tan woven band ring (padding = ring thickness) */}
        <View style={{ padding: band, backgroundColor: palette.bandBg, position: 'relative' }}>
          <HStrip band={band} palette={palette} pos="top" />
          <HStrip band={band} palette={palette} pos="bottom" />
          <VStrip band={band} palette={palette} pos="left" />
          <VStrip band={band} palette={palette} pos="right" />
          {/* inner gold keyline + cream paper */}
          <View style={{ borderWidth: 1.2, borderColor: palette.frameGold, backgroundColor: palette.paper }}>
            <View style={{ padding: FRAME_PAD, backgroundColor: palette.paper }}>{children}</View>
          </View>
        </View>
      </View>
    </View>
  );
}
