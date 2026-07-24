import { View } from 'react-native';
import { useAppLanguage } from '../../../hooks/useAppLanguage';
import { useTheme } from '../../../theme/ThemeContext';
import { GRADE_LABEL_KEYS, type HadithGradeCategory } from '../../../types/hadith.types';
import Icon, { type IconName } from '../Icon';
import Txt from '../Txt';

/**
 * The muhaddith's ruling, shown as a category badge plus the verbatim text.
 *
 * The badge never stands alone: Dorar's rulings are prose, and our category
 * is a heuristic, so the scholar's own wording is always printed beside it.
 * Category is carried by label and icon as well as colour, per the app's
 * existing rule that colour is never the only signal.
 */

interface Style {
  fg: string;
  bg: string;
  border: string;
  icon: IconName;
}

export default function HadithGradeBadge({
  category,
  gradeText,
  compact = false,
}: {
  category: HadithGradeCategory;
  gradeText?: string;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  const styleFor = (): Style => {
    switch (category) {
      case 'authentic':
        return { fg: colors.emerald, bg: colors.emeraldTint, border: colors.emerald, icon: 'check' };
      case 'weak':
        return { fg: colors.error, bg: 'rgba(182,77,77,.12)', border: colors.error, icon: 'info' };
      case 'chain':
        return { fg: colors.gold, bg: colors.goldTint, border: colors.gold, icon: 'layers' };
      default:
        return { fg: colors.text2, bg: colors.surface2, border: colors.border, icon: 'info' };
    }
  };

  const s = styleFor();
  const label = t(GRADE_LABEL_KEYS[category]);

  return (
    <View style={{ gap: 6 }}>
      <View
        accessibilityLabel={`${t('hadith.ruling')}: ${label}${gradeText ? ` — ${gradeText}` : ''}`}
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 20,
          backgroundColor: s.bg,
          borderWidth: 1,
          borderColor: s.border,
        }}
      >
        <Icon name={s.icon} size={12} color={s.fg} strokeWidth={2} />
        <Txt size={11} weight={700} color={s.fg}>
          {label}
        </Txt>
      </View>

      {/* The scholar's exact wording — never replaced by our category. */}
      {gradeText && !compact ? (
        <Txt size={11.5} lh={1.7} color={colors.text2}>
          {gradeText}
        </Txt>
      ) : null}
    </View>
  );
}
