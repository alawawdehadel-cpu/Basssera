import { useCallback, useRef, useState } from 'react';
import type { ChatAnswer } from '../types/answer.types';
import { buildChatAnswer } from '../utils/answerBuilder';
import { searchAnswer } from '../utils/chatbotSearch';
import { loadTafseerData } from '../utils/dataLoader';
import { sanitizeInput } from '../utils/inputSanitizer';

/**
 * Drives the "اسأل بصيرة" assistant flow used by the design (screens
 * 10–11): a question always shows a brief thinking state before the
 * structured, source-cited answer is revealed — never an instant answer.
 *
 * Every answer comes from the same LOCAL retrieval engine as the rest of
 * the app (chatbotSearch + answerBuilder). There is no generative AI and
 * no external API — "شرح مساعد" is a labeled retrieval summary, never
 * generated religious content.
 */

export interface AssistantTurn {
  id: string;
  question: string;
  /** null while the thinking indicator is showing. */
  answer: ChatAnswer | null;
  feedback?: 'up' | 'down';
}

/** Minimum time the thinking state stays up (design calls for ~1.7s). */
const THINKING_MS = 1700;

let counter = 0;
function nextId() {
  counter += 1;
  return `turn-${Date.now()}-${counter}`;
}

export function useAssistant() {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [thinking, setThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ask = useCallback((raw: string) => {
    const question = sanitizeInput(raw);
    if (!question || thinking) return;

    const id = nextId();
    setTurns((prev) => [...prev, { id, question, answer: null }]);
    setThinking(true);
    const startedAt = Date.now();

    loadTafseerData()
      .catch(() => null)
      .then((groups) => {
        const result = searchAnswer(question, groups, 'ar');
        const answer = buildChatAnswer(result, 'ar');
        const remaining = Math.max(0, THINKING_MS - (Date.now() - startedAt));
        timer.current = setTimeout(() => {
          setThinking(false);
          setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, answer } : t)));
        }, remaining);
      });
  }, [thinking]);

  const setFeedback = useCallback((id: string, feedback: 'up' | 'down') => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, feedback } : t)));
  }, []);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setTurns([]);
    setThinking(false);
  }, []);

  return { turns, thinking, ask, setFeedback, reset };
}
