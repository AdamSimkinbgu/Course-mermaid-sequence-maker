import { useCallback, useEffect, useRef, useState } from 'react';

import { serializeGraphSnapshot } from './snapshot';
import type { AutosaveState, GraphSnapshot } from './types';

interface UseGraphAutosaveOptions {
  snapshot: GraphSnapshot | null;
  storageKey: string;
  debounceMs: number;
  isRestoring: boolean;
  enabled: boolean;
}

export function useGraphAutosave({
  snapshot,
  storageKey,
  debounceMs,
  isRestoring,
  enabled,
}: UseGraphAutosaveOptions): AutosaveState {
  const [state, setState] = useState<AutosaveState>('saved');
  const timerRef = useRef<number | null>(null);
  const lastSerializedRef = useRef<string | null>(null);

  const cancelTimer = useCallback(
    (updateState = false) => {
      if (typeof window === 'undefined') return;
      if (timerRef.current === null) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      if (updateState) {
        setState('idle');
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!enabled || !snapshot || isRestoring) {
      cancelTimer();
      return undefined;
    }

    const serialized = serializeGraphSnapshot(snapshot);
    if (serialized === lastSerializedRef.current) {
      return undefined;
    }

    cancelTimer();
    setState('saving');
    timerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, serialized);
        setState('saved');
        lastSerializedRef.current = serialized;
      } catch (error) {
        console.warn('Autosave failed', error);
        setState('idle');
      }
      timerRef.current = null;
    }, debounceMs);

    return () => {
      cancelTimer(true);
    };
  }, [snapshot, storageKey, debounceMs, isRestoring, enabled, cancelTimer]);

  return state;
}

export function loadAutosavedSnapshot(storageKey: string): GraphSnapshot | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GraphSnapshot;
  } catch (error) {
    console.warn('Failed to parse autosaved snapshot', error);
    window.localStorage.removeItem(storageKey);
    return null;
  }
}
