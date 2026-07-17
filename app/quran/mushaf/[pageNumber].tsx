import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert as RNAlert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MushafPageView from '../../../src/components/quran/MushafPageView';
import MushafTopInfoBar from '../../../src/components/quran/MushafTopInfoBar';
import MushafBottomBar from '../../../src/components/quran/MushafBottomBar';
import MushafJumpModal, { type JumpTab } from '../../../src/components/quran/MushafJumpModal';
import RealBookPageFlip from '../../../src/components/quran/RealBookPageFlip';
import { READING } from '../../../src/constants/colors';
import { useAppLanguage } from '../../../src/hooks/useAppLanguage';
import {
  getMushafPage,
  getNextPage,
  getPreviousPage,
  getTotalMushafPages,
} from '../../../src/utils/mushafLayout';
import { getSurahMeta } from '../../../src/utils/quranDataLoader';
import {
  loadFontSize,
  loadMushafPageBookmarks,
  saveFontSize,
  saveLastMushafPage,
  toggleBookmark,
  toggleMushafPageBookmark,
} from '../../../src/utils/storage';
import {
  getPageTurnSoundEnabled,
  playPageTurnSound,
  preloadPageTurnSound,
  setPageTurnSoundEnabled,
  unloadPageTurnSound,
} from '../../../src/utils/pageTurnSound';
import type { MushafPage } from '../../../src/types/quran.types';

export default function MushafReaderScreen() {
  const { strings } = useAppLanguage();
  const params = useLocalSearchParams<{ pageNumber: string }>();
  const total = getTotalMushafPages();

  // Page changes are driven by local state (not route navigation) so the
  // reader stays mounted and the page-flip animation can play. The route
  // param seeds the initial page for deep links / bookmarks.
  const [pageNumber, setPageNumber] = useState(() =>
    Math.min(Math.max(1, Number(params.pageNumber) || 1), getTotalMushafPages()),
  );

  const [fontSize, setFontSize] = useState(26);
  const [bookmarked, setBookmarked] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [jumpTab, setJumpTab] = useState<JumpTab>('page');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const page = useMemo(() => getMushafPage(pageNumber), [pageNumber]);
  const surahName = page?.surahs?.[0] ?? null;

  // Neighbouring pages, pre-loaded so the book flip can reveal real content
  // beneath the leaf without any work happening mid-drag.
  const nextNumber = pageNumber < total ? pageNumber + 1 : null;
  const prevNumber = pageNumber > 1 ? pageNumber - 1 : null;
  const nextData = useMemo(() => (nextNumber ? getMushafPage(nextNumber) : null), [nextNumber]);
  const prevData = useMemo(() => (prevNumber ? getMushafPage(prevNumber) : null), [prevNumber]);

  useEffect(() => {
    let mounted = true;
    loadFontSize().then((s) => mounted && setFontSize(s));
    // Preload the page-turn cue + user preference; release it on unmount.
    preloadPageTurnSound().then(() => mounted && setSoundEnabled(getPageTurnSoundEnabled()));
    return () => {
      mounted = false;
      unloadPageTurnSound();
    };
  }, []);

  const openJump = useCallback((tab: JumpTab) => {
    setJumpTab(tab);
    setShowJump(true);
  }, []);

  const handleToggleSound = useCallback((value: boolean) => {
    setSoundEnabled(value);
    setPageTurnSoundEnabled(value);
  }, []);

  useEffect(() => {
    saveLastMushafPage(pageNumber);
    let mounted = true;
    loadMushafPageBookmarks().then(
      (list) => mounted && setBookmarked(list.some((b) => b.pageNumber === pageNumber)),
    );
    return () => {
      mounted = false;
    };
  }, [pageNumber]);

  const goToPage = useCallback(
    (n: number) => {
      // Single choke point for every page change (buttons, swipe/flip, jump,
      // surah, juz). Guards against no-op / out-of-range so the cue only plays
      // when the page actually changes — never on initial load or invalid input.
      if (n < 1 || n > total || n === pageNumber) return;
      setPageNumber(n);
      playPageTurnSound();
    },
    [total, pageNumber],
  );

  const handleNext = useCallback(() => {
    const next = getNextPage(pageNumber);
    if (next) goToPage(next);
  }, [pageNumber, goToPage]);

  const handlePrevious = useCallback(() => {
    const prev = getPreviousPage(pageNumber);
    if (prev) goToPage(prev);
  }, [pageNumber, goToPage]);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    saveFontSize(size);
  }, []);

  const handleTogglePageBookmark = useCallback(() => {
    toggleMushafPageBookmark(pageNumber).then((list) =>
      setBookmarked(list.some((b) => b.pageNumber === pageNumber)),
    );
  }, [pageNumber]);

  const handleAyahPress = useCallback(
    (surahNumber: number, ayahNumber: number) => {
      const meta = getSurahMeta(surahNumber);
      if (!meta) return;
      toggleBookmark({
        id: `${surahNumber}:${ayahNumber}`,
        surahNumber,
        ayahNumber,
        surahNameArabic: meta.nameArabic,
        surahNameEnglish: meta.nameEnglish,
        createdAt: Date.now(),
      }).then(() => {
        RNAlert.alert('', strings.pageBookmarked);
      });
    },
    [strings],
  );

  const renderPage = useCallback(
    (data: MushafPage | null, n: number) => (
      <MushafPageView
        page={data}
        pageNumber={n}
        fontSize={fontSize}
        strings={strings}
        onAyahPress={handleAyahPress}
      />
    ),
    [fontSize, strings, handleAyahPress],
  );

  const currentEl = useMemo(() => renderPage(page, pageNumber), [renderPage, page, pageNumber]);
  const nextEl = useMemo(
    () => (nextNumber ? renderPage(nextData, nextNumber) : undefined),
    [renderPage, nextData, nextNumber],
  );
  const prevEl = useMemo(
    () => (prevNumber ? renderPage(prevData, prevNumber) : undefined),
    [renderPage, prevData, prevNumber],
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <MushafTopInfoBar
        juz={page?.juz ?? null}
        pageNumber={pageNumber}
        surahName={surahName}
        bookmarked={bookmarked}
        fontSize={fontSize}
        strings={strings}
        onBack={() => router.back()}
        onToggleBookmark={handleTogglePageBookmark}
        onOpenJump={openJump}
        onFontSizeChange={handleFontSizeChange}
      />

      <View style={styles.flex}>
        <RealBookPageFlip
          pageNumber={pageNumber}
          currentPage={currentEl}
          nextPage={nextEl}
          previousPage={prevEl}
          onNextPage={handleNext}
          onPreviousPage={handlePrevious}
          canGoNext={pageNumber < total}
          canGoPrevious={pageNumber > 1}
        />
      </View>

      <MushafBottomBar
        page={pageNumber}
        total={total}
        onPrevious={handlePrevious}
        onNext={handleNext}
        strings={strings}
        disabledPrevious={pageNumber <= 1}
        disabledNext={pageNumber >= total}
        onRequestJump={() => openJump('page')}
      />

      {showJump && (
        <MushafJumpModal
          visible
          total={total}
          currentPage={pageNumber}
          initialTab={jumpTab}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onClose={() => setShowJump(false)}
          onSelectPage={goToPage}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: READING.barBg,
  },
});
