import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { usePlayback, RECITERS } from '../../hooks/usePlayback';
import { useToast } from './Toast';
import { FONT } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';
import type { QuranReference } from '../../types/answer.types';
import { getSurahMeta, getSurahList } from '../../utils/quranDataLoader';
import { toArabicDigits } from '../../utils/numerals';
import { Press } from './primitives';
import Txt from './Txt';

/** Parse "الآية ٢٨" / "28" / "2–5" → leading ayah number for actions. */
function firstAyahNumber(ayah: string): number | null {
  const western = ayah.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = western.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function surahNumberByName(name: string): number | null {
  const list = getSurahList();
  const clean = name.replace(/^سورة\s*/, '').replace(/^سُورَةُ\s*/, '').trim();
  const hit = list.find(
    (s) => s.nameArabic === name || s.nameArabic.includes(clean) || clean.includes(s.nameArabic.replace(/^سورة\s*/, '')),
  );
  return hit?.number ?? null;
}

/**
 * A single "الأدلة القرآنية" evidence card with a staggered fade-up
 * entrance, matching the design's AI-answer flow.
 */
export default function EvidenceCard({ reference, index }: { reference: QuranReference; index: number }) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { startTrack } = usePlayback();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay: index * 120,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const surahNumber = surahNumberByName(reference.surah);
  const ayahNumber = firstAyahNumber(reference.ayah);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      <View style={{ padding: 14, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Txt size={12} weight={700} color={colors.emerald}>
            {reference.surah} {reference.ayah ? `• ${toArabicDigits(reference.ayah)}` : ''}
          </Txt>
          <View style={{ backgroundColor: colors.goldTint, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 }}>
            <Txt size={9} weight={700} color={colors.gold}>
              نصّ قرآني
            </Txt>
          </View>
        </View>
        <Txt
          size={18}
          lh={1.9}
          align="center"
          color={colors.readerText}
          style={{ fontFamily: FONT.quran }}
        >
          {reference.text}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
        {[
          {
            label: 'فتح الآية',
            color: colors.emerald,
            onPress: () => {
              if (surahNumber) {
                router.push({ pathname: '/tafsir', params: { surah: String(surahNumber), ayah: String(ayahNumber ?? 1) } });
              }
            },
          },
          {
            label: 'عرض التفسير',
            color: colors.text,
            onPress: () => {
              if (surahNumber) {
                router.push({ pathname: '/tafsir', params: { surah: String(surahNumber), ayah: String(ayahNumber ?? 1) } });
              }
            },
          },
          {
            label: 'استماع',
            color: colors.text,
            onPress: () => {
              if (surahNumber) {
                const meta = getSurahMeta(surahNumber);
                startTrack({
                  surahNumber,
                  surahName: reference.surah.replace(/^سورة\s*/, ''),
                  ayahCount: meta?.ayahCount ?? 10,
                  reciter: RECITERS[1],
                });
                showToast('جارٍ التشغيل');
              }
            },
          },
        ].map((a, i) => (
          <Press
            key={a.label}
            onPress={a.onPress}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              borderLeftWidth: i < 2 ? 1 : 0,
              borderLeftColor: colors.border,
            }}
          >
            <Txt size={11.5} weight={600} color={a.color} align="center">
              {a.label}
            </Txt>
          </Press>
        ))}
      </View>
    </Animated.View>
  );
}
