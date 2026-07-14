import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppButton from '../src/components/ui/AppButton';
import AppCard from '../src/components/ui/AppCard';
import { COLORS } from '../src/constants/colors';
import { SPACING } from '../src/constants/spacing';
import { useAppLanguage } from '../src/hooks/useAppLanguage';

export default function SecurityScreen() {
  const { strings } = useAppLanguage();
  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{strings.securityTitle}</Text>
        <AppCard style={styles.card}>
          <Text style={styles.body}>{strings.securityBody}</Text>
        </AppCard>
        <AppButton variant="goldOutline" onPress={() => router.back()} style={styles.backButton}>
          {strings.navHome}
        </AppButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.parchment },
  scroll: { flexGrow: 1, padding: SPACING.xl },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.forest, marginBottom: SPACING.lg },
  card: { padding: SPACING.lg },
  body: { fontSize: 15, lineHeight: 26, color: COLORS.ink },
  backButton: { marginTop: SPACING.xl, alignSelf: 'center' },
});
