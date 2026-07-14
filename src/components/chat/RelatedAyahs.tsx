import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import { FONTS } from '../../constants/typography';
import { QURAN_SOURCE_LABEL, type QuranReference } from '../../types/answer.types';
import type { UIStrings } from '../../utils/strings';

interface RelatedAyahsProps {
  references: QuranReference[];
  strings: UIStrings;
}

const CLAMP_THRESHOLD = 300;
const CLAMP_LINES = 6;

function AyahCard({ reference, strings }: { reference: QuranReference; strings: UIStrings }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = reference.text.length > CLAMP_THRESHOLD;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.ornament}>۞</Text>
        <Text style={styles.headerLabel}>{QURAN_SOURCE_LABEL}</Text>
        {reference.surah ? (
          <>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.headerLabel}>
              {strings.surahLabel} {reference.surah}
            </Text>
          </>
        ) : null}
        {reference.ayah && reference.ayah !== '—' && (
          <>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.headerLabel}>
              {strings.ayahLabel} {reference.ayah}
            </Text>
          </>
        )}
      </View>
      <View style={styles.body}>
        <Text
          style={styles.ayahText}
          numberOfLines={isLong && !expanded ? CLAMP_LINES : undefined}
        >
          {reference.text}
        </Text>
        {isLong && (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
            <Text style={styles.linkText}>{expanded ? strings.readLess : strings.readMore}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Related Quran ayahs cited in support of an answer — cream cards, larger Uthmani-weight text, always labeled "القرآن الكريم". */
export default function RelatedAyahs({ references, strings }: RelatedAyahsProps) {
  if (references.length === 0) return null;
  return (
    <View style={styles.wrapper}>
      {references.map((ref, i) => (
        <AyahCard key={i} reference={ref} strings={strings} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: SPACING.sm,
  },
  card: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.35)',
    backgroundColor: COLORS.parchment,
    overflow: 'hidden',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(178,138,62,0.22)',
    backgroundColor: 'rgba(178,138,62,0.12)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  ornament: {
    color: COLORS.gold,
    fontSize: 13,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldDeep,
  },
  dot: {
    fontSize: 12,
    color: 'rgba(138,104,42,0.4)',
  },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
  },
  ayahText: {
    fontFamily: FONTS.quran,
    fontSize: 19,
    lineHeight: 36,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: COLORS.forest,
  },
  linkText: {
    marginTop: SPACING.xs,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.goldDeep,
    textDecorationLine: 'underline',
  },
});
