import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { READING } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import QuranText from './QuranText';

interface DecorativeSurahBannerProps {
  surahNumber: number;
  surahNameArabic: string;
  ayahCount?: number;
  revelationType?: 'meccan' | 'medinan' | string;
}

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toEastern = (n: number) =>
  String(n)
    .split('')
    .map((d) => EASTERN_DIGITS[Number(d)] ?? d)
    .join('');

function revelationLabel(type?: string): string | null {
  if (type === 'meccan') return 'مكية';
  if (type === 'medinan') return 'مدنية';
  return type ?? null;
}

/**
 * A slim arabesque flourish — gold rosette + tendrils with tiny deep-green
 * leaf accents — sized to read cleanly on a warm-white plaque. Mirrored for
 * the opposite side. Vector only, no image assets.
 */
function Flourish({ side }: { side: 'left' | 'right' }) {
  const cx = 13;
  const cy = 22;
  return (
    <Svg width={46} height={44} viewBox="0 0 46 44">
      <G transform={side === 'left' ? 'scale(-1,1) translate(-46,0)' : undefined}>
        <Path
          d="M20 22 C30 12 38 13 45 16"
          stroke={READING.gold}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M20 22 C30 32 38 31 45 28"
          stroke={READING.gold}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <Ellipse cx={34} cy={14} rx={3.4} ry={2} fill={READING.barBg} opacity={0.9} transform="rotate(-26 34 14)" />
        <Ellipse cx={34} cy={30} rx={3.4} ry={2} fill={READING.barBg} opacity={0.9} transform="rotate(26 34 30)" />
        {[0, 45, 90, 135].map((deg) => (
          <Ellipse
            key={deg}
            cx={cx}
            cy={cy - 6.5}
            rx={2}
            ry={5.8}
            fill={READING.gold}
            opacity={0.9}
            rotation={deg}
            origin={`${cx}, ${cy}`}
          />
        ))}
        <Circle cx={cx} cy={cy} r={4} fill={READING.parchment} stroke={READING.gold} strokeWidth={1.3} />
        <Circle cx={cx} cy={cy} r={1.7} fill={READING.barBg} />
      </G>
    </Svg>
  );
}

/**
 * Premium Mushaf-style surah plaque: a warm parchment panel with a muted-gold
 * frame and a thin deep-green inner keyline, the surah name centered in the
 * Quran font between two slim gold/green flourishes, with quiet gold-brown
 * metadata below. Rich and calm — no harsh white, no heavy dark block.
 */
export default function DecorativeSurahBanner({
  surahNumber,
  surahNameArabic,
  ayahCount,
  revelationType,
}: DecorativeSurahBannerProps) {
  const place = revelationLabel(revelationType);
  return (
    <View style={styles.outer}>
      <View style={styles.plaque}>
        <View style={styles.keyline}>
          <View style={styles.row}>
            <Flourish side="right" />
            <View style={styles.center}>
              <QuranText variant="surahTitle" align="center" color={READING.barBg}>
                {surahNameArabic}
              </QuranText>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{`السورة ${toEastern(surahNumber)}`}</Text>
                {typeof ayahCount === 'number' && (
                  <>
                    <Text style={styles.metaDot}>◦</Text>
                    <Text style={styles.metaText}>{`${toEastern(ayahCount)} آية`}</Text>
                  </>
                )}
                {place && (
                  <>
                    <Text style={styles.metaDot}>◦</Text>
                    <Text style={styles.metaText}>{place}</Text>
                  </>
                )}
              </View>
            </View>
            <Flourish side="left" />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingVertical: SPACING.xs,
  },
  plaque: {
    // Warm parchment plaque (not white) with a muted-gold frame — elegant and
    // calm, coordinated with the cream reading page.
    backgroundColor: READING.parchment,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: READING.gold,
    // soft, subtle lift
    shadowColor: READING.barBg,
    shadowOpacity: 0.14,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  keyline: {
    // A thin deep-green inner keyline for richness against the gold frame.
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(11,47,36,0.22)',
    backgroundColor: 'rgba(255,253,248,0.35)',
    margin: 3,
    paddingVertical: SPACING.xs + 1,
    paddingHorizontal: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  center: {
    flex: 1,
    maxWidth: 260,
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: READING.goldInk,
    letterSpacing: 0.2,
  },
  metaDot: {
    fontSize: 10,
    color: READING.gold,
  },
});
