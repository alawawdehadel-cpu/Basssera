import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Alert as RNAlert,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MushafPageView from '../../../src/components/quran/MushafPageView';
import MushafTopInfoBar from '../../../src/components/quran/MushafTopInfoBar';
import MushafBottomBar from '../../../src/components/quran/MushafBottomBar';
import MushafJumpModal, { type JumpTab } from '../../../src/components/quran/MushafJumpModal';
import PageTurnTransition, {
  type PageTurnDirection,
} from '../../../src/components/quran/PageTurnTransition';
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

// Web-only: stop mouse-drag swipes from selecting Quran text mid-gesture.
// `userSelect` isn't in RN's ViewStyle but react-native-web honors it.
const WEB_NO_SELECT: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ userSelect: 'none' } as unknown as ViewStyle) : undefined;

export default function MushafReaderScreen() {
  const { strings } = useAppLanguage();
  const params = useLocalSearchParams<{ pageNumber: string }>();
  const total = getTotalMushafPages();

  // Page changes are driven by local state (not route navigation) so the
  // reader stays mounted and the page-turn animation can play. The route
  // param seeds the initial page for deep links / bookmarks.
  const [pageNumber, setPageNumber] = useState(() =>
    Math.min(Math.max(1, Number(params.pageNumber) || 1), getTotalMushafPages()),
  );
  const directionRef = useRef<PageTurnDirection>('none');

  const [fontSize, setFontSize] = useState(26);
  const [bookmarked, setBookmarked] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [jumpTab, setJumpTab] = useState<JumpTab>('page');

  const page = useMemo(() => getMushafPage(pageNumber), [pageNumber]);
  const surahName = page?.surahs?.[0] ?? null;

  useEffect(() => {
    let mounted = true;
    loadFontSize().then((s) => mounted && setFontSize(s));
    return () => {
      mounted = false;
    };
  }, []);

  const openJump = useCallback((tab: JumpTab) => {
    setJumpTab(tab);
    setShowJump(true);
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
    (n: number, direction: PageTurnDirection) => {
      if (n < 1 || n > total || n === pageNumber) return;
      directionRef.current = direction;
      setPageNumber(n);
    },
    [total, pageNumber],
  );

  const handleNext = useCallback(() => {
    const next = getNextPage(pageNumber);
    if (next) goToPage(next, 'next');
  }, [pageNumber, goToPage]);

  const handlePrevious = useCallback(() => {
    const prev = getPreviousPage(pageNumber);
    if (prev) goToPage(prev, 'previous');
  }, [pageNumber, goToPage]);

  const handleJumpSelect = useCallback(
    (n: number) => goToPage(n, n > pageNumber ? 'next' : 'previous'),
    [goToPage, pageNumber],
  );

  // Keep the latest handlers reachable from the (once-created) PanResponder.
  const handleNextRef = useRef(handleNext);
  const handlePreviousRef = useRef(handlePrevious);
  handleNextRef.current = handleNext;
  handlePreviousRef.current = handlePrevious;

  // Swipe to turn pages (PanResponder is part of React Native core — no new
  // dependency, works in Expo Go). Only claims clearly horizontal drags so it
  // never steals vertical scrolling on packed Juz-Amma pages. RTL: swipe left
  // → next page, swipe right → previous.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderRelease: (_e, g) => {
        const SWIPE = 50;
        if (g.dx <= -SWIPE) handleNextRef.current();
        else if (g.dx >= SWIPE) handlePreviousRef.current();
      },
    }),
  ).current;

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

      <View style={[styles.flex, WEB_NO_SELECT]} {...panResponder.panHandlers}>
        <PageTurnTransition pageNumber={pageNumber} direction={directionRef.current}>
          <MushafPageView
            page={page}
            pageNumber={pageNumber}
            fontSize={fontSize}
            strings={strings}
            onAyahPress={handleAyahPress}
          />
        </PageTurnTransition>
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
          onClose={() => setShowJump(false)}
          onSelectPage={handleJumpSelect}
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
