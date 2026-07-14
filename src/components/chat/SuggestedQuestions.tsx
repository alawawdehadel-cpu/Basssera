import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';

export interface SuggestionCategory {
  key: string;
  label: string;
  questions: readonly string[];
}

interface SuggestedQuestionsProps {
  title: string;
  categories: readonly SuggestionCategory[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

/** Tappable question chips shown before the conversation starts, grouped by category. */
export default function SuggestedQuestions({
  title,
  categories,
  onSelect,
  disabled = false,
}: SuggestedQuestionsProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.categories}>
        {categories.map((cat) => (
          <View key={cat.key} style={styles.categoryBlock}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryDot} />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </View>
            <View style={styles.chipRow}>
              {cat.questions.map((q) => (
                <Pressable
                  key={q}
                  disabled={disabled}
                  onPress={() => onSelect(q)}
                  style={({ pressed }) => [
                    styles.chip,
                    disabled && styles.disabled,
                    pressed && !disabled && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.chipText} numberOfLines={2}>
                    {q}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  title: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.goldDeep,
    marginBottom: SPACING.lg,
  },
  categories: {
    gap: SPACING.lg,
  },
  categoryBlock: {
    gap: SPACING.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  categoryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forest,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.3)',
    backgroundColor: 'rgba(255,253,246,0.8)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.ink,
  },
  disabled: {
    opacity: 0.4,
  },
  chipPressed: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.gold,
  },
});
