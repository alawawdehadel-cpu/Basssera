import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 45; // ~22 fps — visually smooth for flowing text
const MS_PER_CHAR = 22;
const MIN_DURATION_MS = 900;
const MAX_DURATION_MS = 6000;

/**
 * Progressive text reveal ("someone is typing" effect).
 *
 * Time-based rather than tick-based: the number of visible characters
 * is a function of elapsed wall-clock time, so the reveal always
 * finishes on schedule (~1–6 s depending on length) even when a tick
 * is delayed — a delayed tick simply jumps ahead to the right position.
 * Short answers stream letter by letter; long tafseer passages reveal
 * proportionally faster.
 */
export function useTypewriter(text: string, active: boolean) {
  const [count, setCount] = useState(() => (active ? 0 : text.length));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!active) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, text.length * MS_PER_CHAR),
    );
    const start = Date.now();

    timerRef.current = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      setCount(Math.floor(progress * text.length));
      if (progress >= 1) stop();
    }, TICK_MS);

    return stop;
  }, [text, active]);

  /** Reveal the full text immediately (user tapped to skip). */
  const skip = useCallback(() => {
    stop();
    setCount(text.length);
  }, [text]);

  return {
    displayed: text.slice(0, count),
    done: count >= text.length,
    skip,
  };
}
