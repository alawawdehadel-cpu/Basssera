import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLanguage, ChatMessage } from '../types/chat.types';
import type { TafseerGroup } from '../types/data.types';
import { sanitizeInput } from '../utils/inputSanitizer';
import { searchAnswer } from '../utils/chatbotSearch';
import { buildChatAnswer } from '../utils/answerBuilder';
import { loadTafseerData } from '../utils/dataLoader';
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../utils/storage';

/** Client-side rate limiting: min gap between sends + burst window. */
const MIN_SEND_INTERVAL_MS = 900;
const BURST_WINDOW_MS = 15_000;
const BURST_MAX_MESSAGES = 8;

/** Natural "thinking" delay before the bot answers. */
const TYPING_DELAY_MIN_MS = 550;
const TYPING_DELAY_MAX_MS = 1_200;

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

export function useChat(lang: AppLanguage, rateLimitText: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  /** Id of the bot message currently being revealed letter by letter. */
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const lastSendRef = useRef(0);
  const burstRef = useRef<number[]>([]);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted history once on mount.
  useEffect(() => {
    let mounted = true;
    loadChatHistory().then((stored) => {
      if (mounted) {
        setMessages(stored);
        setHistoryLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist history (capped) to AsyncStorage.
  useEffect(() => {
    if (!historyLoaded) return;
    saveChatHistory(messages);
  }, [messages, historyLoaded]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const send = useCallback(
    (raw: string) => {
      const text = sanitizeInput(raw);
      if (!text || isTyping) return;

      // --- rate limiting ---------------------------------------------
      const now = Date.now();
      burstRef.current = burstRef.current.filter((t) => now - t < BURST_WINDOW_MS);
      if (
        now - lastSendRef.current < MIN_SEND_INTERVAL_MS ||
        burstRef.current.length >= BURST_MAX_MESSAGES
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'bot',
            text: rateLimitText,
            source: 'notice',
            timestamp: now,
          },
        ]);
        return;
      }
      lastSendRef.current = now;
      burstRef.current.push(now);

      // --- user message ----------------------------------------------
      // A new question instantly completes any answer still revealing.
      setStreamingId(null);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', text, timestamp: now },
      ]);
      setIsTyping(true);

      const delay =
        TYPING_DELAY_MIN_MS +
        Math.random() * (TYPING_DELAY_MAX_MS - TYPING_DELAY_MIN_MS);
      const startedAt = Date.now();

      // Wait for the dataset (usually already cached) then search locally.
      loadTafseerData()
        .catch((): TafseerGroup[] | null => null)
        .then((groups) => {
          const result = searchAnswer(text, groups, lang);
          const answer = buildChatAnswer(result, lang);
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, delay - elapsed);
          typingTimer.current = setTimeout(() => {
            setIsTyping(false);
            const botId = nextId();
            setMessages((prev) => [
              ...prev,
              {
                id: botId,
                role: 'bot',
                title: answer.title,
                text: answer.summary,
                references: result.references,
                note: result.note,
                stats: answer.stats,
                source:
                  result.kind === 'answer'
                    ? result.source
                    : result.kind,
                quranReferences: answer.quranReferences,
                tafsirReferences: answer.tafsirReferences,
                answerSources: answer.sources,
                safetyNote: answer.safetyNote,
                confidence: answer.confidence,
                timestamp: Date.now(),
              },
            ]);
            setStreamingId(botId);
          }, remaining);
        });
    },
    [isTyping, lang, rateLimitText],
  );

  const clear = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setIsTyping(false);
    setStreamingId(null);
    setMessages([]);
    clearChatHistory();
  }, []);

  const finishStreaming = useCallback(() => setStreamingId(null), []);

  return { messages, isTyping, streamingId, finishStreaming, send, clear };
}
