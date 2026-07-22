import { View } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import Icon, { type IconName } from '../Icon';
import { Press } from '../primitives';
import Txt from '../Txt';

export interface PrayerAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
}

/**
 * Shared empty/permission/error block used by both the Home card and the
 * full screen so every non-ready state looks the same and always offers a
 * way forward (never a blank area).
 */
export default function PrayerStateBlock({
  icon,
  title,
  body,
  actions,
  compact = false,
}: {
  icon: IconName;
  title: string;
  body?: string;
  actions: PrayerAction[];
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? 10 : 22, paddingHorizontal: 4 }}>
      <View
        style={{
          width: compact ? 46 : 60,
          height: compact ? 46 : 60,
          borderRadius: compact ? 14 : 18,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Icon name={icon} size={compact ? 22 : 28} color={colors.emerald} strokeWidth={1.6} />
      </View>
      <Txt size={13.5} weight={700} color={colors.text} align="center" style={{ marginBottom: 6 }}>
        {title}
      </Txt>
      {body ? (
        <Txt size={12.5} lh={1.75} color={colors.text2} align="center" style={{ marginBottom: 14 }}>
          {body}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {actions.map((action) => {
          const primary = action.variant !== 'outline';
          return (
            <Press
              key={action.label}
              onPress={action.onPress}
              accessibilityLabel={action.label}
              style={{
                minHeight: 44,
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: primary ? colors.emerald : 'transparent',
                borderWidth: primary ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Txt size={12.5} weight={600} align="center" color={primary ? '#fff' : colors.text}>
                {action.label}
              </Txt>
            </Press>
          );
        })}
      </View>
    </View>
  );
}
