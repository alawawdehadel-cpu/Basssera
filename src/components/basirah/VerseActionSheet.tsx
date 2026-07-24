import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, TextInput, View } from 'react-native';
import { usePlayback, RECITERS } from '../../hooks/usePlayback';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { useUserData } from '../../hooks/useUserData';
import { FONT } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';
import type { QuranAyah } from '../../types/quran.types';
import { formatNumber, stripSurahPrefix } from '../../utils/numerals';
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
  const { t } = useAppLanguage();
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
  const refLabel = `${t('common.surah')} ${surahLabel} • ${t('common.ayah')} ${formatNumber(verse.ayahNumber)}`;

  const toggleBm = async () => {
    const added = await toggleVerseBookmark({
      id: verseId,
      surahNumber: verse.surahNumber,
      ayahNumber: verse.ayahNumber,
      surahNameArabic: verse.surahNameArabic,
      surahNameEnglish: verse.surahNameEnglish,
    });
    showToast(added ? t('bookmark.added') : t('bookmark.removed'));
  };

  const actions: { label: string; icon: IconName; filled?: boolean; gold?: boolean; onPress: () => void }[] = [
    {
      label: t('verse.listen'),
      icon: 'play',
      onPress: () => {
        const meta = getSurahMeta(verse.surahNumber);
        startTrack({
          surahNumber: verse.surahNumber,
          surahName: verse.surahNameArabic,
          ayahCount: meta?.ayahCount ?? 10,
          reciter: RECITERS[1],
        });
        showToast(t('playback.starting'));
        onClose();
      },
    },
    {
      label: t('verse.tafsir'),
      icon: 'book',
      onPress: () => {
        onClose();
        router.push({
          pathname: '/tafsir',
          params: { surah: String(verse.surahNumber), ayah: String(verse.ayahNumber) },
        });
      },
    },
    { label: t('verse.save'), icon: 'bookmark', filled: bookmarked, gold: bookmarked, onPress: toggleBm },
    { label: t('verse.note'), icon: 'pencil', onPress: () => setNoteOpen((v) => !v) },
    { label: t('verse.repeat'), icon: 'repeat', onPress: () => showToast(t('verse.repeatHint')) },
    {
      label: t('verse.copy'),
      icon: 'copy',
      onPress: async () => {
        try {
          await Clipboard.setStringAsync(`${verse.textUthmani}\n${refLabel}`);
          showToast(t('common.copied'));
        } catch {
          showToast(t('common.copyFailed'));
        }
        onClose();
      },
    },
    {
      label: t('verse.share'),
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
      label: t('verse.ask'),
      icon: 'spark',
      onPress: () => {
        onClose();
        router.push({
          pathname: '/(tabs)/assistant',
          params: { ask: t('verse.askTafsirOf', { ayah: formatNumber(verse.ayahNumber), surah: surahLabel }) },
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
            {t('verse.personalNote')}
          </Txt>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder={t('verse.notePlaceholder')}
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
            title={t('verse.saveNote')}
            height={44}
            onPress={() => {
              setNote(verseId, noteDraft);
              setNoteOpen(false);
              showToast(noteDraft.trim() ? t('verse.noteSaved') : t('verse.noteRemoved'));
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
            {t('verse.repeatSettings')}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Txt size={12.5} color={colors.text2}>
            {t('verse.repeatCount')}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Press
              onPress={() => setRepeatCount((c) => Math.max(1, c - 1))}
              accessibilityLabel={t('verse.less')}
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
              {formatNumber(repeatCount)}
            </Txt>
            <Press
              onPress={() => setRepeatCount((c) => Math.min(9, c + 1))}
              accessibilityLabel={t('verse.more')}
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
            {t('verse.pauseBetween')}
          </Txt>
          <Txt size={12.5} weight={700} color={colors.emerald}>
            {t('verse.seconds', { n: formatNumber(2) })}
          </Txt>
        </View>
      </View>
    </BottomSheet>
  );
}
