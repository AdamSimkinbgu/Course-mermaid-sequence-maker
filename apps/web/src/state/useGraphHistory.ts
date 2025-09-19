import { useCallback, useMemo, useRef, useState } from 'react';

import { serializeGraphSnapshot } from './snapshot';
import type { GraphSnapshot } from './types';

type HistoryGuardMode = 'idle' | 'drag' | 'input';

interface HistoryEntry {
  snapshot: GraphSnapshot;
  serialized: string;
}

interface UseGraphHistoryOptions {
  debounceMs: number;
}

interface UseGraphHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  isRestoring: () => boolean;
  hasInitialized: () => boolean;
  notifyChange: (snapshot: GraphSnapshot) => void;
  beginTransient: (mode: Exclude<HistoryGuardMode, 'idle'>) => void;
  scheduleTransientCommit: () => void;
  endTransient: () => void;
  flushTransient: () => void;
  cancelTransient: () => void;
  undo: (restore: (snapshot: GraphSnapshot) => void) => void;
  redo: (restore: (snapshot: GraphSnapshot) => void) => void;
  initialize: (snapshot: GraphSnapshot) => void;
}

export function useGraphHistory({ debounceMs }: UseGraphHistoryOptions): UseGraphHistoryResult {
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const latestEntryRef = useRef<HistoryEntry | null>(null);
  const guardModeRef = useRef<HistoryGuardMode>('idle');
  const transientTimerRef = useRef<number | null>(null);
  const pendingInputCommitRef = useRef(false);
  const isRestoringRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const updateHistoryState = useCallback(() => {
    const index = historyIndexRef.current;
    const history = historyRef.current;
    setHistoryState({ canUndo: index > 0, canRedo: index >= 0 && index < history.length - 1 });
  }, []);

  const pushEntry = useCallback(
    (entry: HistoryEntry) => {
      const history = historyRef.current.slice(0, historyIndexRef.current + 1);
      const current = history[history.length - 1];
      if (current && current.serialized === entry.serialized) {
        latestEntryRef.current = current;
        return;
      }

      history.push(entry);
      historyRef.current = history;
      historyIndexRef.current = history.length - 1;
      latestEntryRef.current = entry;
      hasInitializedRef.current = true;
      pendingInputCommitRef.current = false;
      updateHistoryState();
    },
    [updateHistoryState],
  );

  const commitLatestEntry = useCallback(() => {
    const entry = latestEntryRef.current;
    if (!entry) return;
    guardModeRef.current = 'idle';
    pushEntry(entry);
  }, [pushEntry]);

  const cancelTransient = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (transientTimerRef.current !== null) {
      window.clearTimeout(transientTimerRef.current);
      transientTimerRef.current = null;
    }
    pendingInputCommitRef.current = false;
  }, []);

  const scheduleTransientCommit = useCallback(() => {
    if (typeof window === 'undefined') return;
    cancelTransient();
    guardModeRef.current = 'input';
    pendingInputCommitRef.current = true;
    transientTimerRef.current = window.setTimeout(() => {
      transientTimerRef.current = null;
      if (guardModeRef.current !== 'input') {
        pendingInputCommitRef.current = false;
        return;
      }
      if (!pendingInputCommitRef.current) {
        guardModeRef.current = 'idle';
        return;
      }
      pendingInputCommitRef.current = false;
      commitLatestEntry();
    }, debounceMs);
  }, [cancelTransient, commitLatestEntry, debounceMs]);

  const flushTransient = useCallback(() => {
    if (guardModeRef.current === 'idle') {
      cancelTransient();
      return;
    }

    cancelTransient();
    guardModeRef.current = 'idle';
    pendingInputCommitRef.current = false;
    commitLatestEntry();
  }, [cancelTransient, commitLatestEntry]);

  const beginTransient = useCallback((mode: Exclude<HistoryGuardMode, 'idle'>) => {
    if (mode === 'drag') {
      cancelTransient();
      guardModeRef.current = 'drag';
    } else {
      scheduleTransientCommit();
    }
  }, [cancelTransient, scheduleTransientCommit]);

  const endTransient = useCallback(() => {
    if (guardModeRef.current === 'drag') {
      guardModeRef.current = 'idle';
      commitLatestEntry();
    }
  }, [commitLatestEntry]);

  const notifyChange = useCallback(
    (snapshot: GraphSnapshot) => {
      const entry: HistoryEntry = {
        snapshot,
        serialized: serializeGraphSnapshot(snapshot),
      };
      latestEntryRef.current = entry;

      if (isRestoringRef.current) {
        return;
      }

      if (!hasInitializedRef.current) {
        pushEntry(entry);
        return;
      }

      switch (guardModeRef.current) {
        case 'idle':
          pushEntry(entry);
          break;
        case 'input':
          pendingInputCommitRef.current = true;
          break;
        case 'drag':
          // drag snapshots are committed once the drag completes
          break;
      }
    },
    [pushEntry],
  );

  const initialize = useCallback(
    (snapshot: GraphSnapshot) => {
      const entry: HistoryEntry = {
        snapshot,
        serialized: serializeGraphSnapshot(snapshot),
      };
      historyRef.current = [entry];
      historyIndexRef.current = 0;
      latestEntryRef.current = entry;
      hasInitializedRef.current = true;
      guardModeRef.current = 'idle';
      pendingInputCommitRef.current = false;
      cancelTransient();
      updateHistoryState();
    },
    [cancelTransient, updateHistoryState],
  );

  const undo = useCallback(
    (restore: (snapshot: GraphSnapshot) => void) => {
      flushTransient();
      if (historyIndexRef.current <= 0) return;
      historyIndexRef.current -= 1;
      const entry = historyRef.current[historyIndexRef.current];
      if (!entry) return;
      latestEntryRef.current = entry;
      isRestoringRef.current = true;
      restore(entry.snapshot);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
      updateHistoryState();
    },
    [flushTransient, updateHistoryState],
  );

  const redo = useCallback(
    (restore: (snapshot: GraphSnapshot) => void) => {
      flushTransient();
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      const entry = historyRef.current[historyIndexRef.current];
      if (!entry) return;
      latestEntryRef.current = entry;
      isRestoringRef.current = true;
      restore(entry.snapshot);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
      updateHistoryState();
    },
    [flushTransient, updateHistoryState],
  );

  return useMemo(
    () => ({
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
      isRestoring: () => isRestoringRef.current,
      hasInitialized: () => hasInitializedRef.current,
      notifyChange,
      beginTransient,
      scheduleTransientCommit,
      endTransient,
      flushTransient,
      cancelTransient,
      undo,
      redo,
      initialize,
    }),
    [beginTransient, cancelTransient, endTransient, flushTransient, historyState, initialize, notifyChange, redo, scheduleTransientCommit, undo],
  );
}
