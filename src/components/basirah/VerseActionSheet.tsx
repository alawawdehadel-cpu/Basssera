import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, TextInput, View } from 'react-native';
import { usePlayback, RECITERS } from '../../hooks/usePlayback';
import { useUserData } from '../../hooks/useUserData';
import { FONT } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';
import type { QuranAyah } from '../../types/quran.types';
import { stripSurahPrefix, toArabicDigits } from '../../utils/numerals';
import { getSurahMeta } from '../../utils/quranDataLoader';
import BottomSheet from './BottomSheet';
import Icon, { type IconName } from './Icon';
import { AyahBadge, Press, PrimaryButton } from './primitives';
import { useToast } from './Toast';
import Txt from './Txt';

interface VerseActionSheetProps {
  verse: QuranAyah | null;
  onClose: () => void;
}

/**
 * The verse action sheet (design screen 6): ref + gold badge, verse
 * preview, 4×2 action grid, repeat settings block. Opens on any verse
 * tap in the reader.
 */
export default function VerseActionSheet({ verse, onClose }: VerseActionSheetProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { startTrack } = usePlayback();
  const { isBookmarked, toggleVerseBookmark, notes, setNote } = useUserData();
  const [repeatCount, setRepeatCount] = useState(3);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const verseId = verse ? `${verse.surahNumber}:${verse.ayahNumber}` : '';

  useEffect(() => {
    if (verse) {
      setNoteOpen(false);
      setNoteDraft(notes[verseId] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseId]);

  if (!verse) return <BottomSheet visible={false} onClose={onClose}>{null}</BottomSheet>;

  const bookmarked = isBookmarked(verse.surahNumber, verse.ayahNumber);
  const surahLabel = stripSurahPrefix(verse.surahNameArabic);
  const refLabel = `سورة ${surahLabel} • الآية ${toArabicDigits(verse.ayahNumber)}`;

  const toggleBm = async () => {
    const added = await toggleVerseBookmark({
      id: verseId,
      surahNumber: verse.surahNumber,
      ayahNumber: verse.ayahNumber,
      surahNameArabic: verse.surahNameArabic,
      surahNameEnglish: verse.surahNameEnglish,
    });
    showToast(added ? 'تمت إضافة العلامة' : 'أُزيلت العلامة');
  };

  const actions: { label: string; icon: IconName; filled?: boolean; gold?: boolean; onPress: () => void }[] = [
    {
      label: 'استماع',
      icon: 'play',
      onPress: () => {
        const meta = getSurahMeta(verse.surahNumber);
        startTrack({
          surahNumber: verse.surahNumber,
          surahName: verse.surahNameArabic,
          ayahCount: meta?.ayahCount ?? 10,
          reciter: RECITERS[1],
        });
        showToast('جارٍ التشغيل');
        onClose();
      },
    },
    {
      label: 'تفسير',
      icon: 'book',
      onPress: () => {
        onClose();
        router.push({
          pathname: '/tafsir',
          params: { surah: String(verse.surahNumber), ayah: String(verse.ayahNumber) },
        });
      },
    },
    { label: 'حفظ', icon: 'bookmark', filled: bookmarked, gold: bookmarked, onPress: toggleBm },
    { label: 'ملاحظة', icon: 'pencil', onPress: () => setNoteOpen((v) => !v) },
    { label: 'تكرار', icon: 'repeat', onPress: () => showToast('اضبط التكرار أدناه') },
    {
      label: 'نسخ',
      icon: 'copy',
      onPress: async () => {
        try {
          await Clipboard.setStringAsync(`${verse.textUthmani}\n${refLabel}`);
          showToast('تم النسخ');
        } catch {
          showToast('تعذّر النسخ');
        }
        onClose();
      },
    },
    {
      label: 'مشاركة',
      icon: 'share',
      onPress: async () => {
        try {
          await Share.share({ message: `${verse.textUthmani}\n${refLabel}` });
        } catch {
          /* user dismissed */
        }
      },
    },
    {
      label: 'اسأل بصيرة',
      icon: 'spark',
      onPress: () => {
        onClose();
        router.push({
          pathname: '/(tabs)/assistant',
          params: { ask: `ما تفسير الآية ${toArabicDigits(verse.ayahNumber)} من سورة ${surahLabel}؟` },
        });
      },
    },
  ];

  return (
    <BottomSheet visible={!!verse} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Txt size={13} weight={700} color={colors.emerald}>
          {refLabel}
        </Txt>
        <AyahBadge number={verse.ayahNumber} />
      </View>

      <View
        style={{
          borderRadius: 14,
          backgroundColor: colors.goldTint,
          padding: 12,
          marginBottom: 18,
        }}
      >
        <Txt
          size={19}
          lh={1.9}
          align="center"
          color={colors.readerText}
          style={{ fontFamily: FONT.quran }}
          numberOfLines={4}
        >
          {verse.textUthmani}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {actions.map((a) => (
          <Press
            key={a.label}
            onPress={a.onPress}
            style={{
              flexBasis: '22%',
              flexGrow: 1,
              alignItems: 'center',
              gap: 7,
              paddingVertical: 13,
              paddingHorizontal: 4,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bg,
            }}
          >
            <Icon name={a.icon} size={20} color={a.gold ? colors.gold : colors.emerald} filled={a.filled} />
            <Txt size={10.5} weight={600} color={colors.text} align="center" numberOfLines={1}>
              {a.label}
            </Txt>
          </Press>
        ))}
      </View>

      {noteOpen ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.gold,
            padding: 14,
            backgroundColor: colors.bg,
            marginBottom: 14,
            gap: 10,
          }}
        >
          <Txt size={13} weight={700} color={colors.text}>
            ملاحظة شخصية
          </Txt>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder="اكتب ملاحظتك على هذه الآية..."
            placeholderTextColor={colors.text3}
            multiline
            style={{
              minHeight: 70,
              fontFamily: FONT.ui400,
              fontSize: 13,
              lineHeight: 22,
              color: colors.text,
              textAlign: 'right',
              textAlignVertical: 'top',
            }}
          />
          <PrimaryButton
            title="حفظ الملاحظة"
            height={44}
            onPress={() => {
              setNote(verseId, noteDraft);
              setNoteOpen(false);
              showToast(noteDraft.trim() ? 'حُفظت الملاحظة' : 'أُزيلت الملاحظة');
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          backgroundColor: colors.bg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Icon name="repeat" size={17} color={colors.emerald} strokeWidth={1.8} />
          <Txt size={14} weight={700} color={colors.text}>
            إعدادات التكرار
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Txt size={12.5} color={colors.text2}>
            عدد مرات التكرار
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Press
              onPress={() => setRepeatCount((c) => Math.max(1, c - 1))}
              accessibilityLabel="أقل"
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={16} color={colors.text} align="center">
                −
              </Txt>
            </Press>
            <Txt size={14} weight={700} color={colors.text} align="center" style={{ minWidth: 20 }}>
              {toArabicDigits(repeatCount)}
            </Txt>
            <Press
              onPress={() => setRepeatCount((c) => Math.min(9, c + 1))}
              accessibilityLabel="أكثر"
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={16} color={colors.text} align="center">
                +
              </Txt>
            </Press>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt size={12.5} color={colors.text2}>
            وقفة بين التكرارات
          </Txt>
          <Txt size={12.5} weight={700} color={colors.emerald}>
            {toArabicDigits(2)} ث
          </Txt>
        </View>
      </View>
    </BottomSheet>
  );
}
