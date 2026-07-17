import { Platform, Text, type TextStyle } from 'react-native';
import { COLORS } from '../../constants/colors';
import { QURAN_TYPOGRAPHY } from '../../constants/quranTypography';
import QuranText from './QuranText';
import type { MushafLine as MushafLineType } from '../../types/quran.types';

/**
 * numberOfLines={1} compiles to overflow:hidden + text-overflow:ellipsis on
 * web, which breaks complex Arabic shaping in Chromium — and
 * adjustsFontSizeToFit is native-only anyway, so clamp only on native.
 *
 * minimumFontScale is intentionally HIGH (mushafMinFontScale, 0.9) so a line
 * that is a hair too wide only shrinks a touch — every line stays visually the
 * same size, instead of the old 0.6 that made some lines look much smaller.
 */
const CLAMP_PROPS =
  Platform.OS === 'web'
    ? {}
    : {
        numberOfLines: 1,
        adjustsFontSizeToFit: true,
        minimumFontScale: QURAN_TYPOGRAPHY.mushafMinFontScale,
      };

// Web-only: widen the gaps between words so dense harakat don't make adjacent
// words look merged at small sizes. wordSpacing only affects the U+0020 spaces
// between words — unlike letterSpacing, which would break Arabic cursive
// joining inside each word.
const webWordSpacing = (fontSize: number): TextStyle =>
  (Platform.OS === 'web' ? { wordSpacing: `${fontSize * 0.15}px` } : {}) as TextStyle;

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
 * One physical Mushaf line: continuous justified Uthmani text rendered in the
 * single Quran font. The ayah-end medallion is the Unicode END OF AYAH mark
 * (U+06DD) followed by the ayah number — the Quran font draws the number
 * enclosed inside an ornate rosette, exactly like a printed Mushaf. The font
 * never switches between ayahs; the medallion is the same typeface, only
 * tinted gold. Never a separate card per ayah.
 */
export default function MushafLine({ line, fontSize, onAyahPress }: MushafLineProps) {
  if (line.isBismillah) {
    return (
      <QuranText
        variant="bismillah"
        size={fontSize}
        align="center"
        color={COLORS.forest}
        {...(Platform.OS === 'web' ? {} : { numberOfLines: 1 })}
      >
        {line.text}
      </QuranText>
    );
  }

  return (
    <QuranText
      variant="mushaf"
      size={fontSize}
      align="center"
      style={webWordSpacing(fontSize)}
      {...CLAMP_PROPS}
    >
      {line.words.map((word, i) => (
        <Text key={`${word.surahNumber}-${word.ayahNumber}-${word.wordNumber}-${i}`}>
          {word.textUthmani}
          {word.isAyahEnd ? (
            <Text
              style={{ color: COLORS.goldDeep }}
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
    </QuranText>
  );
}
