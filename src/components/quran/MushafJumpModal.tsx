import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS, READING } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { getSurahList } from '../../utils/quranDataLoader';
import { normalizeText } from '../../utils/textNormalizer';

export type JumpTab = 'page' | 'surah' | 'juz';

interface MushafJumpModalProps {
  visible: boolean;
  total: number;
  currentPage: number;
  /** Which tab to show when the sheet opens (from the tapped chip). */
  initialTab?: JumpTab;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  onClose: () => void;
  onSelectPage: (page: number) => void;
}

/** Standard Madani-mushaf first page of each juz (index 0 = Juz 1). */
const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toEastern = (n: number) =>
  String(n)
    .split('')
    .map((d) => EASTERN_DIGITS[Number(d)] ?? d)
    .join('');

export default function MushafJumpModal({
  visible,
  total,
  currentPage,
  initialTab = 'page',
  soundEnabled,
  onToggleSound,
  onClose,
  onSelectPage,
}: MushafJumpModalProps) {
  const { strings, lang } = useAppLanguage();
  const [tab, setTab] = useState<JumpTab>(initialTab);
  const [pageInput, setPageInput] = useState('');
  const [query, setQuery] = useState('');

  // Open on the tab matching the chip the user tapped.
  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  const surahs = useMemo(() => getSurahList(), []);
  const filteredSurahs = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        normalizeText(s.nameArabic).includes(q) ||
        s.nameEnglish.toLowerCase().includes(query.trim().toLowerCase()) ||
        String(s.number).includes(q),
    );
  }, [surahs, query]);

  const pick = (page: number) => {
    if (page < 1 || page > total) return;
    onSelectPage(page);
    onClose();
  };

  const submitPage = () => {
    const n = Number(pageInput);
    if (!Number.isFinite(n) || n < 1 || n > total) return;
    setPageInput('');
    pick(n);
  };

  const tabs: { key: JumpTab; label: string }[] = [
    { key: 'page', label: strings.jumpTabPage },
    { key: 'surah', label: strings.jumpTabSurah },
    { key: 'juz', label: strings.jumpTabJuz },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>{strings.jumpTitle}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={strings.close}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.segment}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'page' && (
          <View style={styles.pagePane}>
            <TextInput
              value={pageInput}
              onChangeText={setPageInput}
              placeholder={strings.jumpToPagePlaceholder}
              placeholderTextColor={READING.muted}
              keyboardType="number-pad"
              style={styles.pageInput}
              textAlign="center"
              onSubmitEditing={submitPage}
            />
            <Pressable onPress={submitPage} style={styles.goButton}>
              <Text style={styles.goText}>{strings.go}</Text>
            </Pressable>
            <Text style={styles.hint}>{strings.pageOf(currentPage, total)}</Text>
          </View>
        )}

        {tab === 'surah' && (
          <View style={styles.listPane}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={strings.searchSurahPlaceholder}
              placeholderTextColor={READING.muted}
              style={styles.search}
              textAlign="right"
            />
            <FlatList
              data={filteredSurahs}
              style={styles.flexList}
              keyExtractor={(s) => String(s.number)}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={14}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pick(item.firstPage)}
                  style={({ pressed }) => [styles.surahRow, pressed && styles.rowPressed]}
                >
                  <View style={styles.surahNumBadge}>
                    <Text style={styles.surahNumText}>{toEastern(item.number)}</Text>
                  </View>
                  <View style={styles.surahInfo}>
                    <Text style={styles.surahName} numberOfLines={1}>
                      {lang === 'ar' ? item.nameArabic : item.nameEnglish}
                    </Text>
                    <Text style={styles.surahMeta}>
                      {`${strings.ayahCountSuffix(item.ayahCount)} • ${strings.pageLabel} ${toEastern(item.firstPage)}`}
                    </Text>
                  </View>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        )}

        {tab === 'juz' && (
          <FlatList
            data={JUZ_START_PAGES}
            numColumns={5}
            style={styles.flexList}
            keyExtractor={(_, i) => String(i + 1)}
            contentContainerStyle={styles.juzGrid}
            columnWrapperStyle={styles.juzRow}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [styles.juzCell, pressed && styles.rowPressed]}
              >
                <Text style={styles.juzNum}>{toEastern(index + 1)}</Text>
                <Text style={styles.juzPage}>{`${strings.pageLabel} ${toEastern(item)}`}</Text>
              </Pressable>
            )}
          />
        )}

        <View style={styles.soundRow}>
          <Text style={styles.soundLabel}>{strings.pageTurnSound}</Text>
          <Switch
            value={soundEnabled}
            onValueChange={onToggleSound}
            trackColor={{ false: READING.border, true: READING.barBg }}
            thumbColor={soundEnabled ? READING.gold : '#f4f3f4'}
            accessibilityLabel={strings.pageTurnSound}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216,201,166,0.6)',
  },
  soundLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: READING.ink,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,27,20,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '82%',
    backgroundColor: READING.paperWarm,
    borderTopLeftRadius: RADIUS.xl + 4,
    borderTopRightRadius: RADIUS.xl + 4,
    borderTopWidth: 2,
    borderColor: READING.gold,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: READING.border,
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: READING.ink,
  },
  close: {
    fontSize: 16,
    fontWeight: '700',
    color: READING.muted,
    paddingHorizontal: SPACING.xs,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(94,125,101,0.14)',
    borderRadius: RADIUS.md,
    padding: 3,
    gap: 3,
    marginBottom: SPACING.lg,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm + 2,
  },
  segmentItemActive: {
    backgroundColor: READING.barBg,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: READING.ink,
  },
  segmentTextActive: {
    color: COLORS.cream,
  },
  pagePane: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  pageInput: {
    width: '70%',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: READING.border,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    fontSize: 18,
    fontWeight: '700',
    color: READING.ink,
  },
  goButton: {
    backgroundColor: READING.barBg,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xxl,
  },
  goText: {
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: READING.muted,
    fontWeight: '600',
  },
  listPane: {
    flex: 1,
  },
  flexList: {
    flex: 1,
  },
  search: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: READING.border,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: READING.ink,
    marginBottom: SPACING.sm,
  },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xs,
  },
  rowPressed: {
    backgroundColor: 'rgba(200,167,91,0.14)',
    borderRadius: RADIUS.sm,
  },
  surahNumBadge: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: READING.barBg,
    borderWidth: 1,
    borderColor: READING.gold,
  },
  surahNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: READING.gold,
  },
  surahInfo: {
    flex: 1,
  },
  surahName: {
    fontSize: 15,
    fontWeight: '700',
    color: READING.ink,
    textAlign: 'right',
  },
  surahMeta: {
    marginTop: 2,
    fontSize: 11,
    color: READING.muted,
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(216,201,166,0.5)',
  },
  juzGrid: {
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  juzRow: {
    gap: SPACING.sm,
  },
  juzCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: READING.border,
    backgroundColor: COLORS.white,
    gap: 2,
  },
  juzNum: {
    fontSize: 16,
    fontWeight: '800',
    color: READING.ink,
  },
  juzPage: {
    fontSize: 9,
    color: READING.muted,
    fontWeight: '600',
  },
});
