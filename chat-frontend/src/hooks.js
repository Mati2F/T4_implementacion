import { useCallback, useEffect, useRef } from "react";

export function usePolling(fn, intervalMs, enabled, key) {
  const saved = useRef(fn);
  saved.current = fn;
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer;
    cancelledRef.current = false;

    const tick = async () => {
      if (!document.hidden) {
        try {
          await saved.current(() => cancelled);
        } catch {
          /* cada fn maneja sus errores */
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, intervalMs, key]);

  return useCallback(() => saved.current(() => false), []);
}
