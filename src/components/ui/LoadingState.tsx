import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../constants/spacing';

interface LoadingStateProps {
  label: string;
}

export default function LoadingState({ label }: LoadingStateProps) {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={COLORS.forest} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xxl,
  },
  text: {
    fontSize: 13,
    color: COLORS.inkSoft,
  },
});
