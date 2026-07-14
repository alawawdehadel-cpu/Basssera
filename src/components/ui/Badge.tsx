import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';

interface BadgeProps {
  label: string;
}

export default function Badge({ label }: BadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.35)',
    backgroundColor: 'rgba(178,138,62,0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.goldDeep,
  },
});
