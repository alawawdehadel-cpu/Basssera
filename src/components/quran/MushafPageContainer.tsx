import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { READING } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';

interface MushafPageContainerProps {
  pageNumber: number;
  children: ReactNode;
}

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toEastern = (n: number) =>
  String(n)
    .split('')
    .map((d) => EASTERN_DIGITS[Number(d)] ?? d)
    .join('');

// Frame geometry (device px from the paper edge, drawn over the cream paper):
// hairline → deep-green ornamental band between two gold keylines → inner hairline.
const OUTER_INSET = 2.5;
const BAND_START = 6;
const BAND_WIDTH = 16;
const BAND_MID = BAND_START + BAND_WIDTH / 2;
const INNER_LINE = BAND_START + BAND_WIDTH + 3.5;
/** Content sits fully inside the drawn frame. */
const CONTENT_INSET = INNER_LINE + 6;

/** Eight-petal gold rosette anchoring each corner of the band. */
function CornerRosette({ x, y }: { x: number; y: number }) {
  return (
    <G>
      {[0, 45, 90, 135].map((deg) => (
        <Ellipse
          key={deg}
          cx={x}
          cy={y - 4.6}
          rx={1.7}
          ry={4.4}
          fill={READING.gold}
          rotation={deg}
          origin={`${x}, ${y}`}
        />
      ))}
      <Circle cx={x} cy={y} r={3} fill={READING.paper} stroke={READING.gold} strokeWidth={1} />
      <Circle cx={x} cy={y} r={1.3} fill={READING.gold} />
    </G>
  );
}

/** Small gold diamond repeated along the band, with a dot between repeats. */
function bandMotifs(
  length: number,
  fixed: number,
  horizontal: boolean,
): { x: number; y: number; dot: boolean }[] {
  const start = BAND_MID + 14; // clear the corner rosettes
  const usable = length - start * 2;
  if (usable < 24) return [];
  const step = usable / Math.max(1, Math.round(usable / 24));
  const out: { x: number; y: number; dot: boolean }[] = [];
  let i = 0;
  for (let p = start; p <= length - start + 0.5; p += step / 2) {
    out.push(
      horizontal ? { x: p, y: fixed, dot: i % 2 === 1 } : { x: fixed, y: p, dot: i % 2 === 1 },
    );
    i += 1;
  }
  return out;
}

/**
 * The full ornamental border drawn to the measured paper size: keylines, the
 * deep-green band, repeating gold diamonds and dots along every side, and a
 * rosette in each corner — a vector echo of a classic printed Mushaf frame.
 */
function OrnamentalFrame({ width, height }: { width: number; height: number }) {
  const motifs = [
    ...bandMotifs(width, BAND_MID, true),
    ...bandMotifs(width, height - BAND_MID, true),
    ...bandMotifs(height, BAND_MID, false),
    ...bandMotifs(height, width - BAND_MID, false),
  ];
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* outer hairline */}
      <Rect
        x={OUTER_INSET}
        y={OUTER_INSET}
        width={width - OUTER_INSET * 2}
        height={height - OUTER_INSET * 2}
        rx={13}
        stroke={READING.gold}
        strokeWidth={1}
        fill="none"
        opacity={0.85}
      />
      {/* deep-green band */}
      <Rect
        x={BAND_MID}
        y={BAND_MID}
        width={width - BAND_MID * 2}
        height={height - BAND_MID * 2}
        rx={10}
        stroke={READING.barBgDeep}
        strokeWidth={BAND_WIDTH}
        fill="none"
      />
      {/* gold keylines on both edges of the band */}
      <Rect
        x={BAND_START}
        y={BAND_START}
        width={width - BAND_START * 2}
        height={height - BAND_START * 2}
        rx={11}
        stroke={READING.gold}
        strokeWidth={1.4}
        fill="none"
      />
      <Rect
        x={BAND_START + BAND_WIDTH}
        y={BAND_START + BAND_WIDTH}
        width={width - (BAND_START + BAND_WIDTH) * 2}
        height={height - (BAND_START + BAND_WIDTH) * 2}
        rx={7}
        stroke={READING.gold}
        strokeWidth={1.4}
        fill="none"
      />
      {/* repeating motifs on the band */}
      {motifs.map((m, i) =>
        m.dot ? (
          <Circle key={i} cx={m.x} cy={m.y} r={1.1} fill={READING.gold} opacity={0.8} />
        ) : (
          <Path
            key={i}
            d={`M${m.x} ${m.y - 3.1} L${m.x + 3.1} ${m.y} L${m.x} ${m.y + 3.1} L${m.x - 3.1} ${m.y} Z`}
            fill={READING.gold}
            opacity={0.92}
          />
        ),
      )}
      {/* corner rosettes */}
      <CornerRosette x={BAND_MID} y={BAND_MID} />
      <CornerRosette x={width - BAND_MID} y={BAND_MID} />
      <CornerRosette x={BAND_MID} y={height - BAND_MID} />
      <CornerRosette x={width - BAND_MID} y={height - BAND_MID} />
      {/* faint inner hairline framing the text field */}
      <Rect
        x={INNER_LINE}
        y={INNER_LINE}
        width={width - INNER_LINE * 2}
        height={height - INNER_LINE * 2}
        rx={5}
        stroke={READING.gold}
        strokeWidth={0.8}
        fill="none"
        opacity={0.45}
      />
    </Svg>
  );
}

/**
 * The "paper" shell the Mushaf page content sits on: warm cream, wrapped in a
 * full traditional ornamental frame (green band, gold keylines, corner
 * rosettes, repeating diamonds), with the page number in a small cartouche at
 * the foot — echoing a printed Mushaf page with vector art only.
 */
export default function MushafPageContainer({ pageNumber, children }: MushafPageContainerProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View style={styles.outer}>
      <View style={styles.paper} onLayout={onLayout}>
        {size.width > 0 && size.height > 0 && (
          <OrnamentalFrame width={size.width} height={size.height} />
        )}
        <View style={styles.content}>
          <View style={styles.flex}>{children}</View>

          <View style={styles.footer}>
            <View style={styles.footerRule} />
            <View style={styles.cartouche}>
              <View style={styles.dot} />
              <Text style={styles.pageNumber}>{toEastern(pageNumber)}</Text>
              <View style={styles.dot} />
            </View>
            <View style={styles.footerRule} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  outer: {
    flex: 1,
    backgroundColor: READING.barBg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  paper: {
    flex: 1,
    backgroundColor: READING.paper,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  content: {
    flex: 1,
    margin: CONTENT_INSET,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  footerRule: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(200,167,91,0.5)',
  },
  cartouche: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(200,167,91,0.6)',
    backgroundColor: READING.paperWarm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: READING.gold,
    transform: [{ rotate: '45deg' }],
  },
  pageNumber: {
    fontSize: 12.5,
    fontWeight: '700',
    color: READING.ink,
    letterSpacing: 0.5,
  },
});
