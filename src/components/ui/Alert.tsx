import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';

type AlertVariant = 'info' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  children: string;
}

const VARIANT_STYLES: Record<AlertVariant, { border: string; bg: string; text: string }> = {
  info: { border: 'rgba(23,117,82,0.3)', bg: 'rgba(23,117,82,0.08)', text: COLORS.forest },
  warning: { border: 'rgba(178,138,62,0.4)', bg: 'rgba(178,138,62,0.1)', text: COLORS.goldDeep },
  error: { border: 'rgba(185,28,28,0.3)', bg: 'rgba(185,28,28,0.08)', text: '#7A1414' },
};

const ICONS: Record<AlertVariant, string> = {
  info: '۞',
  warning: '؞',
  error: '!',
};

export default function Alert({ variant = 'info', children }: AlertProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[styles.wrapper, { borderColor: v.border, backgroundColor: v.bg }]}>
      <Text style={[styles.icon, { color: v.text }]}>{ICONS[variant]}</Text>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
