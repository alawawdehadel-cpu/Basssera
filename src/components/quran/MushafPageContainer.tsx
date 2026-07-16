import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { READING } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';

interface MushafPageContainerProps {
  pageNumber: number;
  children: ReactNode;
}

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toEastern = (n: number) =>
  String(n)
    .split('')
    .map((d) => EASTERN_DIGITS[Number(d)] ?? d)
    .join('');

/**
 * The premium "paper" shell that the Mushaf page content sits on: a warm cream
 * surface with a soft gold keyline, a faint inner border for depth, generous
 * padding, and an ornamented page number in a small cartouche at the foot —
 * echoing a printed Mushaf page without any heavy imagery.
 */
export default function MushafPageContainer({ pageNumber, children }: MushafPageContainerProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.paper}>
        <View style={styles.innerKeyline}>{children}</View>

        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <View style={styles.cartouche}>
            <View style={styles.dot} />
            <Text style={styles.pageNumber}>{toEastern(pageNumber)}</Text>
            <View style={styles.dot} />
          </View>
          <View style={styles.footerRule} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: READING.barBg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  paper: {
    flex: 1,
    backgroundColor: READING.paper,
    borderRadius: RADIUS.lg + 2,
    borderWidth: 1.5,
    borderColor: READING.gold,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  innerKeyline: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(200,167,91,0.28)',
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  footerRule: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(200,167,91,0.5)',
  },
  cartouche: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(200,167,91,0.6)',
    backgroundColor: READING.paperWarm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: READING.gold,
    transform: [{ rotate: '45deg' }],
  },
  pageNumber: {
    fontSize: 12.5,
    fontWeight: '700',
    color: READING.ink,
    letterSpacing: 0.5,
  },
});
