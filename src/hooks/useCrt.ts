// Typewriter hook for the CRT terminal.
// Renders a single <pre>-style monospace node via textContent (React-escaped by
// construction — no per-character setState, no dangerouslySetInnerHTML).
// Batched: <=2000 chars per animation frame; >50k backlog → catch-up dump
// (5k-10k chars/frame). Blinking block cursor is pure CSS ::after.

import { useCallback, useEffect, useRef } from 'react';

const NORMAL_BATCH = 2000;
const CATCHUP_THRESHOLD = 50_000;
const CATCHUP_BATCH_MIN = 5000;
const CATCHUP_BATCH_MAX = 10_000;

export interface CrtHandle {
  print: (text: string) => void;
  clear: () => void;
}

export function useCrt(): {
  preRef: React.RefObject<HTMLPreElement>;
  textRef: React.RefObject<HTMLSpanElement>;
  print: (text: string) => void;
  clear: () => void;
} {
  const preRef = useRef<HTMLPreElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const bufferRef = useRef('');
  const shownRef = useRef(0);
  const rafRef = useRef(0);
  const runningRef = useRef(false);

  const frame = useCallback(() => {
    const el = textRef.current;
    const pre = preRef.current;
    if (!el) {
      runningRef.current = false;
      return;
    }
    const remaining = bufferRef.current.length - shownRef.current;
    if (remaining <= 0) {
      runningRef.current = false;
      return;
    }
    let batch: number;
    if (remaining > CATCHUP_THRESHOLD) {
      batch = Math.min(CATCHUP_BATCH_MAX, Math.max(CATCHUP_BATCH_MIN, remaining));
    } else {
      batch = Math.min(NORMAL_BATCH, remaining);
    }
    const next = Math.min(bufferRef.current.length, shownRef.current + batch);
    el.textContent = bufferRef.current.slice(0, next);
    shownRef.current = next;
    if (pre) pre.scrollTop = pre.scrollHeight; // vertical autoscroll only
    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const pump = useCallback(() => {
    if (!runningRef.current) {
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(frame);
    }
  }, [frame]);

  const print = useCallback(
    (text: string) => {
      if (!text) return;
      bufferRef.current += text;
      pump();
    },
    [pump],
  );

  const clear = useCallback(() => {
    bufferRef.current = '';
    shownRef.current = 0;
    if (textRef.current) textRef.current.textContent = '';
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { preRef, textRef, print, clear };
}
