import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { FONT } from '../../../theme/fonts';
import { useTheme } from '../../../theme/ThemeContext';
import type { MushafLine as MushafLineType, MushafPage as MushafPageType } from '../../../types/quran.types';
import { getSurahMeta } from '../../../utils/quranDataLoader';
import { getSurahOpeningMeta, shouldRenderBismillah } from '../../../utils/surahOpening';
import { toArabicDigits } from '../../../utils/numerals';
import { AyahRosette, MushafFrame, ornamentPalette, SurahBanner, type OrnamentPalette } from './ornaments';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

/** A line begins a surah when its first word is that surah's ayah 1, word 1. */
function surahStartOf(line: MushafLineType): number | null {
  if (line.isSurahHeader || line.isBismillah) return null;
  const first = line.words[0];
  if (first && first.ayahNumber === 1 && first.wordNumber === 1) return first.surahNumber;
  return null;
}

/** True when this line carries the final ayah of its surah (→ centered, like print). */
function isSurahLastLine(line: MushafLineType): boolean {
  const last = line.words[line.words.length - 1];
  if (!last || !last.isAyahEnd) return false;
  const meta = getSurahMeta(last.surahNumber);
  return !!meta && last.ayahNumber === meta.ayahCount;
}

interface MushafPageProps {
  page: MushafPageType;
  /** 0–4 reader font step (nudges size within a width-safe range). */
  fontStep: number;
  selectedKey?: string;
  onAyahPress?: (surah: number, ayah: number) => void;
}

/**
 * One printed-mushaf page: the ornate frame + cream paper, a decorative
 * surah banner at each opening, and continuous Uthmani lines that fill the
 * width (each word is its own token so lines justify edge-to-edge, like the
 * printed page), with a gold star rosette at every ayah end.
 */
export default function MushafPage({ page, fontStep, selectedKey, onAyahPress }: MushafPageProps) {
  const { colors, isDark } = useTheme();
  const palette = ornamentPalette(colors, isDark);
  const [contentW, setContentW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== contentW) setContentW(w);
  };

  // Size each word so a full ~9-word line fills the width without clipping;
  // the reader font-size control nudges it within a safe band.
  const base = contentW > 0 ? contentW / 17.5 : 16;
  const fontSize = Math.max(13, Math.min(22, base * (0.9 + fontStep * 0.055)));
  const lineGap = fontSize * 1.15;

  return (
    <MushafFrame palette={palette}>
      <View onLayout={onLayout} style={{ paddingHorizontal: 4 }}>
        {page.lines.map((line) => {
          const start = surahStartOf(line);
          const lineNode = (
            <MushafTextLine
              key={`l-${line.lineNumber}`}
              line={line}
              fontSize={fontSize}
              lineGap={lineGap}
              palette={palette}
              center={isSurahLastLine(line)}
              selectedKey={selectedKey}
              onAyahPress={onAyahPress}
            />
          );
          if (!start) return lineNode;

          const meta = getSurahOpeningMeta(start);
          const surahMeta = getSurahMeta(start);
          return (
            <View key={`s-${line.lineNumber}`}>
              <SurahBanner
                surahName={meta.nameArabic}
                juz={page.juz}
                ayahCount={surahMeta?.ayahCount ?? meta.ayahCount ?? 0}
                palette={palette}
              />
              {shouldRenderBismillah(start) ? (
                <Text
                  style={{
                    fontFamily: FONT.quran,
                    fontSize: fontSize * 0.98,
                    lineHeight: lineGap,
                    color: palette.ink,
                    textAlign: 'center',
                    writingDirection: 'rtl',
                    marginBottom: 4,
                  }}
                >
                  {BISMILLAH}
                </Text>
              ) : null}
              {lineNode}
            </View>
          );
        })}
        <View style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: palette.ink, opacity: 0.45, textAlign: 'center' }}>
            صفحة {toArabicDigits(page.pageNumber)}
          </Text>
        </View>
      </View>
    </MushafFrame>
  );
}

function MushafTextLine({
  line,
  fontSize,
  lineGap,
  palette,
  center,
  selectedKey,
  onAyahPress,
}: {
  line: MushafLineType;
  fontSize: number;
  lineGap: number;
  palette: OrnamentPalette;
  center: boolean;
  selectedKey?: string;
  onAyahPress?: (surah: number, ayah: number) => void;
}) {
  if (line.isBismillah) {
    return (
      <Text
        style={{
          fontFamily: FONT.quran,
          fontSize: fontSize * 0.98,
          lineHeight: lineGap,
          color: palette.ink,
          textAlign: 'center',
          writingDirection: 'rtl',
        }}
      >
        {line.text}
      </Text>
    );
  }

  const wordCount = line.words.filter((w) => !w.isAyahEnd || line.words.length === 1).length;
  // Full lines justify edge-to-edge; short/final lines center (like print).
  const justify = !center && wordCount >= 4;

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: justify ? 'space-between' : 'center',
        columnGap: justify ? 0 : fontSize * 0.28,
        rowGap: 2,
        minHeight: lineGap,
        marginVertical: lineGap * 0.16,
      }}
    >
      {line.words.map((w, i) => {
        const key = `${w.surahNumber}:${w.ayahNumber}`;
        const selected = selectedKey === key;
        return (
          <View key={`${key}:${w.wordNumber}:${i}`} style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            <Text
              onPress={onAyahPress ? () => onAyahPress(w.surahNumber, w.ayahNumber) : undefined}
              suppressHighlighting
              style={{
                fontFamily: FONT.quran,
                fontSize,
                lineHeight: fontSize * 1.5,
                color: palette.ink,
                writingDirection: 'rtl',
                ...(selected ? { backgroundColor: palette.rosetteCenter, borderRadius: 4 } : null),
              }}
            >
              {w.textUthmani}
            </Text>
            {w.isAyahEnd ? (
              <View style={{ marginHorizontal: fontSize * 0.14 }}>
                <AyahRosette number={w.ayahNumber} size={fontSize * 1.25} palette={palette} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
