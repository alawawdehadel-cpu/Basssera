import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import type { AnswerSource } from '../../types/answer.types';

interface SourceBadgeProps {
  source: AnswerSource;
}

/** Per-type palette: Quran gold, tafsir muted green, everything else neutral gold-grey. */
const PALETTE: Record<AnswerSource['type'], { bg: string; border: string; text: string; dot: string }> = {
  quran: { bg: 'rgba(178,138,62,0.14)', border: 'rgba(178,138,62,0.4)', text: COLORS.goldDeep, dot: COLORS.gold },
  tafsir: { bg: 'rgba(23,117,82,0.1)', border: 'rgba(23,117,82,0.35)', text: COLORS.emerald, dot: COLORS.emerald },
  qa: { bg: 'rgba(178,138,62,0.1)', border: 'rgba(178,138,62,0.3)', text: COLORS.goldDeep, dot: COLORS.gold },
  analytics: { bg: 'rgba(13,58,45,0.08)', border: 'rgba(13,58,45,0.25)', text: COLORS.forest, dot: COLORS.forest },
  metadata: { bg: 'rgba(178,138,62,0.1)', border: 'rgba(178,138,62,0.3)', text: COLORS.goldDeep, dot: COLORS.gold },
  other: { bg: 'rgba(95,106,99,0.1)', border: 'rgba(95,106,99,0.3)', text: COLORS.inkSoft, dot: COLORS.inkSoft },
};

/** Small labeled pill naming where an answer came from — never mixes sources without one of these. */
export default function SourceBadge({ source }: SourceBadgeProps) {
  const palette = PALETTE[source.type] ?? PALETTE.other;
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={[styles.dot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.text, { color: palette.text }]}>{source.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
