import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';

type Variant = 'primary' | 'ghost' | 'goldOutline';
type Size = 'sm' | 'md';

interface AppButtonProps {
  variant?: Variant;
  size?: Size;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export default function AppButton({
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  children,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        SIZE_STYLES[size],
        VARIANT_STYLES[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {typeof children === 'string' ? (
          <Text style={[styles.text, VARIANT_TEXT_STYLES[variant]]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

const SIZE_STYLES: Record<Size, ViewStyle> = {
  sm: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.sm },
  md: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
};

const VARIANT_STYLES: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: COLORS.forest,
    shadowColor: COLORS.forest,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  goldOutline: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.45)',
  },
};

const VARIANT_TEXT_STYLES: Record<Variant, { color: string }> = {
  primary: { color: COLORS.cream },
  ghost: { color: 'rgba(255,253,246,0.9)' },
  goldOutline: { color: COLORS.goldDeep },
};
