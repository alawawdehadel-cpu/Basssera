import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { QuranBookmark } from '../types/quran.types';
import { loadBookmarks, toggleBookmark as toggleStoredBookmark } from '../utils/storage';

const NOTES_KEY = 'basirah-verse-notes-v1';
const SAVED_ANSWERS_KEY = 'basirah-saved-answers-v1';
const READING_LOG_KEY = 'basirah-reading-log-v1';
const WIRD_KEY = 'basirah-wird-v1';

/** Daily wird goal, in mushaf pages (per the hero card copy). */
export const WIRD_GOAL_PAGES = 10;

export interface SavedAnswer {
  id: string;
  question: string;
  summary: string;
  createdAt: number;
}

export interface ReadingLogEntry {
  surahNumber: number;
  surahName: string;
  page: number;
  ayahNumber?: number;
  at: number;
}

interface WirdState {
  dateKey: string;
  pages: number[];
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

interface UserDataContextValue {
  bookmarks: QuranBookmark[];
  notes: Record<string, string>;
  savedAnswers: SavedAnswer[];
  readingLog: ReadingLogEntry[];
  /** Pages read today toward the wird goal. */
  wirdPagesRead: number;
  isBookmarked: (surah: number, ayah: number) => boolean;
  /** Returns true when the verse is now bookmarked. */
  toggleVerseBookmark: (b: Omit<QuranBookmark, 'createdAt'>) => Promise<boolean>;
  setNote: (verseId: string, note: string) => void;
  saveAnswer: (question: string, summary: string) => void;
  removeSavedAnswer: (id: string) => void;
  logReading: (entry: Omit<ReadingLogEntry, 'at'>) => void;
  markWirdPage: (page: number) => void;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [readingLog, setReadingLog] = useState<ReadingLogEntry[]>([]);
  const [wird, setWird] = useState<WirdState>({ dateKey: todayKey(), pages: [] });

  useEffect(() => {
    loadBookmarks().then(setBookmarks);
    AsyncStorage.multiGet([NOTES_KEY, SAVED_ANSWERS_KEY, READING_LOG_KEY, WIRD_KEY])
      .then((pairs) => {
        for (const [key, raw] of pairs) {
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (key === NOTES_KEY && parsed && typeof parsed === 'object') setNotes(parsed);
            if (key === SAVED_ANSWERS_KEY && Array.isArray(parsed)) setSavedAnswers(parsed);
            if (key === READING_LOG_KEY && Array.isArray(parsed)) setReadingLog(parsed);
            if (key === WIRD_KEY && parsed && typeof parsed === 'object') {
              const w = parsed as WirdState;
              if (w.dateKey === todayKey() && Array.isArray(w.pages)) setWird(w);
            }
          } catch {
            /* corrupted entry — start fresh for that key */
          }
        }
      })
      .catch(() => {});
  }, []);

  const isBookmarked = useCallback(
    (surah: number, ayah: number) => bookmarks.some((b) => b.surahNumber === surah && b.ayahNumber === ayah),
    [bookmarks],
  );

  const toggleVerseBookmark = useCallback(
    async (b: Omit<QuranBookmark, 'createdAt'>) => {
      const next = await toggleStoredBookmark({ ...b, createdAt: Date.now() });
      setBookmarks(next);
      return next.some((x) => x.id === b.id);
    },
    [],
  );

  const setNote = useCallback((verseId: string, note: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (note.trim()) next[verseId] = note.trim();
      else delete next[verseId];
      AsyncStorage.setItem(NOTES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const saveAnswer = useCallback((question: string, summary: string) => {
    setSavedAnswers((prev) => {
      const next: SavedAnswer[] = [
        { id: `ans-${Date.now()}`, question, summary, createdAt: Date.now() },
        ...prev,
      ].slice(0, 50);
      AsyncStorage.setItem(SAVED_ANSWERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeSavedAnswer = useCallback((id: string) => {
    setSavedAnswers((prev) => {
      const next = prev.filter((a) => a.id !== id);
      AsyncStorage.setItem(SAVED_ANSWERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const logReading = useCallback((entry: Omit<ReadingLogEntry, 'at'>) => {
    setReadingLog((prev) => {
      const top = prev[0];
      // Collapse consecutive entries for the same page into one.
      if (top && top.page === entry.page && top.surahNumber === entry.surahNumber) return prev;
      const next = [{ ...entry, at: Date.now() }, ...prev].slice(0, 60);
      AsyncStorage.setItem(READING_LOG_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const markWirdPage = useCallback((page: number) => {
    setWird((prev) => {
      const key = todayKey();
      const base = prev.dateKey === key ? prev.pages : [];
      if (base.includes(page)) return prev.dateKey === key ? prev : { dateKey: key, pages: base };
      const next = { dateKey: key, pages: [...base, page] };
      AsyncStorage.setItem(WIRD_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<UserDataContextValue>(
    () => ({
      bookmarks,
      notes,
      savedAnswers,
      readingLog,
      wirdPagesRead: wird.dateKey === todayKey() ? wird.pages.length : 0,
      isBookmarked,
      toggleVerseBookmark,
      setNote,
      saveAnswer,
      removeSavedAnswer,
      logReading,
      markWirdPage,
    }),
    [bookmarks, notes, savedAnswers, readingLog, wird, isBookmarked, toggleVerseBookmark, setNote, saveAnswer, removeSavedAnswer, logReading, markWirdPage],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used within a UserDataProvider');
  return ctx;
}
