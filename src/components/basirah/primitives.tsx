import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { toArabicDigits } from '../../utils/numerals';
import Icon, { type IconName } from './Icon';
import Txt from './Txt';

/** Pressable with the design's gentle press feedback (scale .96). */
export function Press({
  onPress,
  style,
  children,
  disabled,
  accessibilityLabel,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [style, pressed ? { transform: [{ scale: 0.97 }], opacity: 0.92 } : null]}
    >
      {children}
    </Pressable>
  );
}

/** 40×40 bordered square icon button (header actions). */
export function IconButton({
  icon,
  onPress,
  size = 40,
  iconSize = 20,
  color,
  label,
  badge = false,
  filled = false,
}: {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  label?: string;
  badge?: boolean;
  filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={iconSize} color={color ?? colors.text} filled={filled} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            left: 10,
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: colors.gold,
            borderWidth: 1.5,
            borderColor: colors.surface,
          }}
        />
      ) : null}
    </Press>
  );
}

/** Full-width emerald primary button. */
export function PrimaryButton({
  title,
  onPress,
  height = 54,
  style,
}: {
  title: string;
  onPress?: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      style={[
        {
          height,
          borderRadius: 16,
          backgroundColor: colors.emerald,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.emerald,
          shadowOpacity: 0.45,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
        style,
      ]}
    >
      <Txt size={16} weight={700} color="#fff" align="center">
        {title}
      </Txt>
    </Press>
  );
}

/** Thin rounded progress bar. */
export function ProgressBar({
  fraction,
  height = 8,
  track,
  fill,
  gold = false,
}: {
  fraction: number;
  height?: number;
  track?: string;
  fill?: string;
  gold?: boolean;
}) {
  const { colors } = useTheme();
  const pct = Math.min(1, Math.max(0, fraction)) * 100;
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: track ?? colors.surface2,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: height / 2,
          backgroundColor: fill ?? (gold ? colors.gold : colors.emerald),
          alignSelf: 'flex-start',
        }}
      />
    </View>
  );
}

/** Equal-width segmented control (السور/الأجزاء…, المصحف/وضع القراءة). */
export function SegmentedTabs({
  items,
  active,
  onChange,
  height = 38,
}: {
  items: string[];
  active: number;
  onChange: (index: number) => void;
  height?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {items.map((label, i) => (
        <Press
          key={label}
          onPress={() => onChange(i)}
          style={{
            flex: 1,
            height,
            borderRadius: 11,
            backgroundColor: i === active ? colors.emerald : colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={12.5} weight={600} align="center" color={i === active ? '#fff' : colors.text2}>
            {label}
          </Txt>
        </Press>
      ))}
    </View>
  );
}

/** Rounded filter chip (الكل / مكية / مدنية...). */
export function Chip({
  label,
  active = false,
  onPress,
  height = 32,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  height?: number;
}) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      style={{
        height,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: active ? colors.emerald : colors.border,
        backgroundColor: active ? colors.emerald : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={11.5} weight={600} align="center" color={active ? '#fff' : colors.text2}>
        {label}
      </Txt>
    </Press>
  );
}

/** Custom pill switch — emerald when on, per the design (never OS default). */
export function PillSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 46,
        height: 27,
        borderRadius: 14,
        backgroundColor: value ? colors.emerald : colors.border,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 3,
          right: value ? 22 : 3,
          width: 21,
          height: 21,
          borderRadius: 11,
          backgroundColor: '#fff',
        }}
      />
    </Pressable>
  );
}

/** Section heading row with an optional trailing "عرض الكل" action. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  trailing,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <Txt size={17} weight={700} color={colors.text}>
        {title}
      </Txt>
      {actionLabel ? (
        <Press onPress={onAction}>
          <Txt size={12} weight={600} color={colors.emerald}>
            {actionLabel}
          </Txt>
        </Press>
      ) : (
        trailing ?? null
      )}
    </View>
  );
}

/** Gold circular ayah-number badge. */
export function AyahBadge({ number, size = 26 }: { number: number | string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={size * 0.42} weight={700} color="#fff" align="center">
        {toArabicDigits(number)}
      </Txt>
    </View>
  );
}

/** Surface card with border — the default container of the design. */
export function Card({
  children,
  style,
  padding = 16,
  radius = 16,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
