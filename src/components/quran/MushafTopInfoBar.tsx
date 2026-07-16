import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, READING } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import FontSizeControl from './FontSizeControl';
import type { JumpTab } from './MushafJumpModal';
import type { UIStrings } from '../../utils/strings';

interface MushafTopInfoBarProps {
  juz: number | null;
  pageNumber: number;
  surahName: string | null;
  bookmarked: boolean;
  fontSize: number;
  strings: UIStrings;
  onBack: () => void;
  onToggleBookmark: () => void;
  /** Opens the jump sheet on a specific tab (from the chips or the pill). */
  onOpenJump: (tab: JumpTab) => void;
  onFontSizeChange: (size: number) => void;
}

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toEastern = (n: number) =>
  String(n)
    .split('')
    .map((d) => EASTERN_DIGITS[Number(d)] ?? d)
    .join('');

function BackIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path
        d="M15 18l-6-6 6-6"
        stroke={COLORS.cream}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg viewBox="0 0 24 24" width={19} height={19}>
      <Path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.8-4.6 6.6-.9z"
        fill={filled ? READING.gold : 'none'}
        stroke={READING.gold}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function JumpIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16}>
      {/* stacked pages / index */}
      <Path
        d="M5 5h9M5 9h9M5 13h6"
        stroke={READING.barBg}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M14 17l3 3 3-3M17 20v-9"
        stroke={READING.barBg}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Info chip: emphasized (gold-filled, e.g. page number) or outlined. Tappable — opens the jump sheet. */
function Chip({
  label,
  value,
  emphasized,
  onPress,
  accessibilityLabel,
}: {
  label?: string;
  value: string;
  emphasized?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        emphasized ? styles.chipEmph : styles.chipOutline,
        pressed && styles.chipPressed,
      ]}
    >
      {label ? (
        <Text style={[styles.chipLabel, emphasized && styles.chipLabelEmph]}>{label}</Text>
      ) : null}
      <Text style={[styles.chipValue, emphasized && styles.chipValueEmph]} numberOfLines={1}>
        {value}
      </Text>
      <ChevronDown emphasized={emphasized} />
    </Pressable>
  );
}

/** Tiny caret hinting the chip opens a selector. */
function ChevronDown({ emphasized }: { emphasized?: boolean }) {
  return (
    <Svg viewBox="0 0 24 24" width={11} height={11}>
      <Path
        d="M6 9l6 6 6-6"
        stroke={emphasized ? READING.barBg : READING.gold}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Premium top information bar for the Mushaf reader. Row 1 holds the chrome
 * controls (back, font size, bookmark, jump); row 2 shows structured info
 * chips — Juz, the emphasized page number, and the current surah — all
 * RTL-friendly. A slim gold hairline separates it from the reading page.
 */
export default function MushafTopInfoBar({
  juz,
  pageNumber,
  surahName,
  bookmarked,
  fontSize,
  strings,
  onBack,
  onToggleBookmark,
  onOpenJump,
  onFontSizeChange,
}: MushafTopInfoBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={strings.back}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <BackIcon />
        </Pressable>

        <View style={styles.controlsRight}>
          <FontSizeControl size={fontSize} onChange={onFontSizeChange} strings={strings} />
          <Pressable
            onPress={onToggleBookmark}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={strings.bookmarkPage}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <StarIcon filled={bookmarked} />
          </Pressable>
          <Pressable
            onPress={() => onOpenJump('surah')}
            accessibilityRole="button"
            accessibilityLabel={strings.jumpToPage}
            style={({ pressed }) => [styles.jumpButton, pressed && styles.jumpButtonPressed]}
          >
            <JumpIcon />
            <Text style={styles.jumpText}>{strings.jumpAction}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chipsRow}>
        {juz !== null && (
          <Chip
            label={strings.juzLabel}
            value={toEastern(juz)}
            onPress={() => onOpenJump('juz')}
            accessibilityLabel={`${strings.juzLabel} ${juz}`}
          />
        )}
        <Chip
          label={strings.pageLabel}
          value={toEastern(pageNumber)}
          emphasized
          onPress={() => onOpenJump('page')}
          accessibilityLabel={`${strings.pageLabel} ${pageNumber}`}
        />
        {surahName ? (
          <Chip
            value={surahName}
            onPress={() => onOpenJump('surah')}
            accessibilityLabel={surahName}
          />
        ) : null}
      </View>

      <View style={styles.hairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: READING.barBg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: 'rgba(255,253,246,0.1)',
  },
  jumpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: READING.gold,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
  },
  jumpButtonPressed: {
    opacity: 0.85,
  },
  jumpText: {
    fontSize: 12,
    fontWeight: '700',
    color: READING.barBg,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    maxWidth: 170,
  },
  chipOutline: {
    borderWidth: 1,
    borderColor: 'rgba(200,167,91,0.5)',
    backgroundColor: 'rgba(200,167,91,0.08)',
  },
  chipEmph: {
    backgroundColor: READING.gold,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: READING.border,
  },
  chipLabelEmph: {
    color: 'rgba(11,47,36,0.75)',
  },
  chipValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.cream,
  },
  chipValueEmph: {
    color: READING.barBg,
    fontSize: 14,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(200,167,91,0.35)',
  },
});
