import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from '../i18n/translations';
import { HadithError, searchHadith } from '../services/hadithService';
import type { ChatAnswer } from '../types/answer.types';
import type { HadithResult, HadithStatus } from '../types/hadith.types';
import { buildChatAnswer } from '../utils/answerBuilder';
import { searchAnswer } from '../utils/chatbotSearch';
import type { TafsirConversationContext } from '../utils/tafsir/tafsirQuestionAnalyzer';
import type { TafsirSourceId } from '../types/data.types';
import { loadTafseerData } from '../utils/dataLoader';
import { ASSISTANT_HADITH_COUNT, buildHadithQuery, shouldSearchHadith } from '../utils/hadithQuery';
import { detectIntent } from '../utils/intentDetector';
import { sanitizeInput } from '../utils/inputSanitizer';

/**
 * Drives the "اسأل بصيرة" assistant flow used by the design (screens
 * 10–11): a question always shows a brief thinking state before the
 * structured, source-cited answer is revealed — never an instant answer.
 *
 * The explanation itself comes from the same LOCAL retrieval engine as the
 * rest of the app (chatbotSearch + answerBuilder). There is no generative
 * AI — "شرح مساعد" is a labeled retrieval summary, never generated
 * religious content.
 *
 * Related hadith are the one part that leaves the device: they are fetched
 * from الدرر السنية alongside the local answer, never in front of it, so a
 * slow or unreachable network can delay the narrations but can never delay
 * or block the Quran/tafsir answer.
 */

export interface AssistantTurn {
  id: string;
  question: string;
  /** null while the thinking indicator is showing. */
  answer: ChatAnswer | null;
  feedback?: 'up' | 'down';

  // ---- related hadith (الدرر السنية) — resolved independently of `answer` ----
  /** Undefined when this question never triggered a lookup (e.g. a ruling question). */
  hadithStatus?: HadithStatus;
  hadith?: HadithResult[];
  /** The keywords actually sent upstream, shown so the user can see what was searched. */
  hadithQuery?: string;
  /** Error/notice copy, as a key so it renders in the active language. */
  hadithMessageKey?: TranslationKey;
  /** True when the user explicitly asked for a hadith, so an empty result must be reported. */
  hadithLed?: boolean;
}

/** Minimum time the thinking state stays up (design calls for ~1.7s). */
const THINKING_MS = 1700;

/**
 * The assistant asks Dorar for صحيح/حسن only.
 *
 * The dedicated الحديث screen deliberately shows every grade — there, the
 * badge sits next to a result the user went looking for. In a chat the
 * answer reads as an endorsement, so volunteering a موضوع narration in
 * response to a question would be a different act entirely. The badge is
 * still rendered on every card, and one tap opens the same query
 * unfiltered on the hadith screen.
 */
const ASSISTANT_DEGREE = '1' as const;

let counter = 0;
function nextId() {
  counter += 1;
  return `turn-${Date.now()}-${counter}`;
}

export function useAssistant() {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [thinking, setThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** In-flight hadith requests, so unmount/reset can cancel them. */
  const inFlight = useRef(new Set<AbortController>());
  /**
   * Minimal, reference-only follow-up context (surah/ayah/sources of the last
   * tafsir answer) — never any tafsir text. Lets «وماذا قال الطبري؟» keep the
   * previous ayah. Cleared on reset.
   */
  const tafsirContext = useRef<TafsirConversationContext | null>(null);

  const patch = useCallback((id: string, fields: Partial<AssistantTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }, []);

  const cancelHadith = useCallback(() => {
    inFlight.current.forEach((c) => c.abort());
    inFlight.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelHadith();
    };
  }, [cancelHadith]);

  const ask = useCallback(
    (raw: string, selectedSources?: TafsirSourceId[]) => {
      const question = sanitizeInput(raw);
      if (!question || thinking) return;

      const id = nextId();
      const intent = detectIntent(question).intent;
      const hadithLed = intent === 'HADITH_LOOKUP';
      const hadithQuery = shouldSearchHadith(intent) ? buildHadithQuery(question) : null;

      setTurns((prev) => [
        ...prev,
        {
          id,
          question,
          answer: null,
          hadithLed,
          ...(hadithQuery
            ? { hadithStatus: 'loading' as HadithStatus, hadithQuery }
            : // Only say why when the user actually asked for a hadith; on an
              // ordinary question, silence is the right amount of noise.
              hadithLed
              ? { hadithStatus: 'empty' as HadithStatus, hadithMessageKey: 'assistant.hadith.arabicOnly' as TranslationKey }
              : {}),
        },
      ]);
      setThinking(true);
      const startedAt = Date.now();

      // --- local answer (bundled data, no network) -------------------------
      // A hadith request is searched locally by its TOPIC, not its raw
      // wording: «حديث عن بر الوالدين» run verbatim matches the word
      // «الحديث» in لهو الحديث and answers with تفسير لقمان ٦ — about idle
      // talk, not about parents (observed). The extracted keywords find the
      // tafsir the user actually meant. Every other intent is untouched.
      const localQuery = hadithLed && hadithQuery ? hadithQuery : question;

      loadTafseerData()
        .catch(() => null)
        .then((groups) => {
          const result = searchAnswer(localQuery, groups, 'ar', {
            selectedSources,
            conversationContext: tafsirContext.current,
          });
          // Remember only this turn's reference context (never tafsir text)
          // so the next message can be a follow-up. A non-tafsir answer
          // clears it so context never leaks into an unrelated question.
          tafsirContext.current = result.resolvedContext ?? null;
          const answer = buildChatAnswer(result, 'ar');
          const remaining = Math.max(0, THINKING_MS - (Date.now() - startedAt));
          timer.current = setTimeout(() => {
            setThinking(false);
            patch(id, { answer });
          }, remaining);
        });

      // --- related hadith, in parallel -------------------------------------
      if (!hadithQuery) return;

      const controller = new AbortController();
      inFlight.current.add(controller);

      searchHadith({ query: hadithQuery, degree: ASSISTANT_DEGREE, page: 1 }, controller.signal)
        .then(({ page, fromCache }) => {
          if (controller.signal.aborted) return;
          const results = page.results.slice(0, ASSISTANT_HADITH_COUNT);
          patch(id, {
            hadith: results,
            hadithStatus: results.length === 0 ? 'empty' : fromCache ? 'offline' : 'ready',
          });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          patch(id, {
            hadithStatus: 'error',
            hadithMessageKey:
              error instanceof HadithError ? error.messageKey : ('hadith.error' as TranslationKey),
          });
        })
        .finally(() => {
          inFlight.current.delete(controller);
        });
    },
    [thinking, patch],
  );

  const setFeedback = useCallback((id: string, feedback: 'up' | 'down') => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, feedback } : t)));
  }, []);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    cancelHadith();
    setTurns([]);
    setThinking(false);
    tafsirContext.current = null;
  }, [cancelHadith]);

  return { turns, thinking, ask, setFeedback, reset };
}
