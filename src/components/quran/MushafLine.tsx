import { Platform, Text } from 'react-native';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/typography';

/**
 * numberOfLines={1} compiles to overflow:hidden + text-overflow:ellipsis on
 * web, which breaks complex Arabic shaping in Chromium — and
 * adjustsFontSizeToFit is native-only anyway, so clamp only on native.
 */
const CLAMP_PROPS =
  Platform.OS === 'web'
    ? {}
    : { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 };
import type { MushafLine as MushafLineType } from '../../types/quran.types';

interface MushafLineProps {
  line: MushafLineType;
  fontSize: number;
  onAyahPress?: (surahNumber: number, ayahNumber: number) => void;
}

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toEasternDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => EASTERN_DIGITS[Number(d)] ?? d)
    .join('');
}

/**
 * One physical Mushaf line: continuous justified Uthmani text, with an
 * ayah-end ornament (۝ + Eastern-Arabic ayah number) inline right after
 * the last word of each ayah — never a separate card per ayah.
 */
export default function MushafLine({ line, fontSize, onAyahPress }: MushafLineProps) {
  if (line.isBismillah) {
    return (
      <Text style={[styles(fontSize).bismillah]} {...(Platform.OS === 'web' ? {} : { numberOfLines: 1 })}>
        {line.text}
      </Text>
    );
  }

  return (
    <Text style={styles(fontSize).line} {...CLAMP_PROPS}>
      {line.words.map((word, i) => (
        <Text key={`${word.surahNumber}-${word.ayahNumber}-${word.wordNumber}-${i}`}>
          {word.textUthmani}
          {word.isAyahEnd ? (
            <Text
              style={styles(fontSize).ayahEnd}
              onPress={
                onAyahPress ? () => onAyahPress(word.surahNumber, word.ayahNumber) : undefined
              }
              suppressHighlighting={false}
            >
              {' '}
              ۝{toEasternDigits(word.ayahNumber)}{' '}
            </Text>
          ) : (
            ' '
          )}
        </Text>
      ))}
    </Text>
  );
}

const styles = (fontSize: number) => ({
  line: {
    fontFamily: FONTS.quran,
    fontSize,
    lineHeight: fontSize * 1.85,
    textAlign: 'center' as const,
    writingDirection: 'rtl' as const,
    color: COLORS.forestDeep,
  },
  ayahEnd: {
    fontFamily: FONTS.quranOrnament,
    fontSize: fontSize * 0.72,
    color: COLORS.goldDeep,
  },
  bismillah: {
    fontFamily: FONTS.quran,
    fontSize: fontSize * 0.95,
    lineHeight: fontSize * 1.85,
    textAlign: 'center' as const,
    writingDirection: 'rtl' as const,
    color: COLORS.forest,
  },
});
