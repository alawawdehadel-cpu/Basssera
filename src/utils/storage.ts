import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppLanguage, ChatMessage } from '../types/chat.types';
import type {
  LastMushafPosition,
  LastReadingPosition,
  MushafPageBookmark,
  QuranBookmark,
  QuranReadingMode,
} from '../types/quran.types';

const LANG_KEY = 'tafseer-chat-lang';
const HISTORY_KEY = 'tafseer-chat-history-v1';
const MAX_STORED_MESSAGES = 80;

const BOOKMARKS_KEY = 'quran-bookmarks-v1';
const LAST_POSITION_KEY = 'quran-last-position-v1';
const FONT_SIZE_KEY = 'quran-font-size-v1';

const LAST_MUSHAF_PAGE_KEY = 'quran-last-mushaf-page-v1';
const MUSHAF_PAGE_BOOKMARKS_KEY = 'quran-mushaf-page-bookmarks-v1';
const READING_MODE_KEY = 'quran-reading-mode-v1';

export async function loadStoredLang(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return stored === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export async function saveStoredLang(lang: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

function isChatMessage(m: unknown): m is ChatMessage {
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof (m as ChatMessage).id === 'string' &&
    typeof (m as ChatMessage).text === 'string' &&
    ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'bot')
  );
}

export async function loadChatHistory(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatMessage);
  } catch {
    return [];
  }
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
    );
  } catch {
    /* storage full / unavailable — chat still works in memory */
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Quran bookmarks                                                     */
/* ------------------------------------------------------------------ */

function isQuranBookmark(b: unknown): b is QuranBookmark {
  return (
    typeof b === 'object' &&
    b !== null &&
    typeof (b as QuranBookmark).id === 'string' &&
    typeof (b as QuranBookmark).surahNumber === 'number' &&
    typeof (b as QuranBookmark).ayahNumber === 'number'
  );
}

export async function loadBookmarks(): Promise<QuranBookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQuranBookmark);
  } catch {
    return [];
  }
}

async function saveBookmarks(list: QuranBookmark[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable — bookmark still works for this session */
  }
}

/** Adds the bookmark if not already present, or removes it if it is. Returns the new list. */
export async function toggleBookmark(bookmark: QuranBookmark): Promise<QuranBookmark[]> {
  const current = await loadBookmarks();
  const exists = current.some((b) => b.id === bookmark.id);
  const next = exists
    ? current.filter((b) => b.id !== bookmark.id)
    : [...current, bookmark].sort((a, b) => a.surahNumber - b.surahNumber || a.ayahNumber - b.ayahNumber);
  await saveBookmarks(next);
  return next;
}

/* ------------------------------------------------------------------ */
/* Quran last reading position                                         */
/* ------------------------------------------------------------------ */

function isLastReadingPosition(p: unknown): p is LastReadingPosition {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as LastReadingPosition).surahNumber === 'number' &&
    typeof (p as LastReadingPosition).ayahNumber === 'number'
  );
}

export async function loadLastPosition(): Promise<LastReadingPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_POSITION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isLastReadingPosition(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveLastPosition(position: LastReadingPosition): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_POSITION_KEY, JSON.stringify(position));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Quran reader font size                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_QURAN_FONT_SIZE = 26;
export const MIN_QURAN_FONT_SIZE = 18;
export const MAX_QURAN_FONT_SIZE = 40;

export async function loadFontSize(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(FONT_SIZE_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= MIN_QURAN_FONT_SIZE && n <= MAX_QURAN_FONT_SIZE) return n;
    return DEFAULT_QURAN_FONT_SIZE;
  } catch {
    return DEFAULT_QURAN_FONT_SIZE;
  }
}

export async function saveFontSize(size: number): Promise<void> {
  try {
    await AsyncStorage.setItem(FONT_SIZE_KEY, String(size));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Mushaf mode: last page, page bookmarks, reading-mode preference     */
/* ------------------------------------------------------------------ */

export async function loadLastMushafPage(): Promise<LastMushafPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_MUSHAF_PAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as LastMushafPosition).pageNumber === 'number'
      ? (parsed as LastMushafPosition)
      : null;
  } catch {
    return null;
  }
}

export async function saveLastMushafPage(pageNumber: number): Promise<void> {
  try {
    const position: LastMushafPosition = { pageNumber, updatedAt: Date.now() };
    await AsyncStorage.setItem(LAST_MUSHAF_PAGE_KEY, JSON.stringify(position));
  } catch {
    /* ignore */
  }
}

function isMushafPageBookmark(b: unknown): b is MushafPageBookmark {
  return typeof b === 'object' && b !== null && typeof (b as MushafPageBookmark).pageNumber === 'number';
}

export async function loadMushafPageBookmarks(): Promise<MushafPageBookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(MUSHAF_PAGE_BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMushafPageBookmark);
  } catch {
    return [];
  }
}

/** Adds the page bookmark if not already present, or removes it if it is. Returns the new list. */
export async function toggleMushafPageBookmark(pageNumber: number): Promise<MushafPageBookmark[]> {
  const current = await loadMushafPageBookmarks();
  const exists = current.some((b) => b.pageNumber === pageNumber);
  const next = exists
    ? current.filter((b) => b.pageNumber !== pageNumber)
    : [...current, { pageNumber, createdAt: Date.now() }].sort((a, b) => a.pageNumber - b.pageNumber);
  try {
    await AsyncStorage.setItem(MUSHAF_PAGE_BOOKMARKS_KEY, JSON.stringify(next));
  } catch {
    /* storage full / unavailable — bookmark still works for this session */
  }
  return next;
}

export async function loadReadingMode(): Promise<QuranReadingMode> {
  try {
    const stored = await AsyncStorage.getItem(READING_MODE_KEY);
    return stored === 'surah' ? 'surah' : 'mushaf';
  } catch {
    return 'mushaf';
  }
}

export async function saveReadingMode(mode: QuranReadingMode): Promise<void> {
  try {
    await AsyncStorage.setItem(READING_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
