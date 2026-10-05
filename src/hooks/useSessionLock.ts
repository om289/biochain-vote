/**
 * useSessionLock.ts — Inactivity auto-lock hook
 *
 * After `timeoutMs` of no user activity, calls `onLock()`.
 * Default: 10 minutes.
 */

import { useEffect, useRef, useCallback } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

export function useSessionLock(
  onLock: () => void,
  timeoutMs: number = 10 * 60 * 1000,
  enabled: boolean = true
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled) return;
    timerRef.current = setTimeout(onLock, timeoutMs);
  }, [onLock, timeoutMs, enabled]);

  useEffect(() => {
    if (!enabled) return;

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset, enabled]);
}
