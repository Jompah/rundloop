'use client';

import { useReducer, useRef, useState, useEffect, useCallback } from 'react';
import type { FilteredPosition, ActiveRunSnapshot, CompletedRun } from '@/types';
import { watchFilteredPosition } from '@/lib/gps-filter';
import {
  startSnapshotSchedule,
  stopSnapshotSchedule,
  onPointAccepted,
} from '@/lib/crash-recovery';
import {
  acquireWakeLock,
  releaseWakeLock,
  setupVisibilityReacquire,
} from '@/lib/wake-lock';
import { dbPut } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunStatus = 'idle' | 'active' | 'paused' | 'completed';

export type RunAction =
  | { type: 'START'; runId: string; startTime: number }
  | { type: 'PAUSE'; elapsedMs: number }
  | { type: 'RESUME' }
  | { type: 'END'; elapsedMs: number; distanceMeters: number }
  | { type: 'RECOVER'; snapshot: ActiveRunSnapshot }
  | { type: 'RESET' };

export interface RunState {
  status: RunStatus;
  runId: string | null;
  startTime: number;
  elapsedMs: number;
  distanceMeters: number;
  routeId: string | null;
}

export interface UseRunSessionReturn {
  status: RunStatus;
  elapsedMs: number;
  distanceMeters: number;
  trace: FilteredPosition[];
  startRun: (routeId: string | null) => void;
  pauseRun: () => void;
  resumeRun: () => void;
  endRun: () => Promise<CompletedRun>;
  recoverRun: (snapshot: ActiveRunSnapshot) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: RunState = {
  status: 'idle',
  runId: null,
  startTime: 0,
  elapsedMs: 0,
  distanceMeters: 0,
  routeId: null,
};

// ---------------------------------------------------------------------------
// Pure reducer (exported for testing)
// ---------------------------------------------------------------------------

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'START':
      if (state.status !== 'idle') return state;
      return {
        ...state,
        status: 'active',
        runId: action.runId,
        startTime: action.startTime,
        elapsedMs: 0,
        distanceMeters: 0,
      };

    case 'PAUSE':
      if (state.status !== 'active') return state;
      return {
        ...state,
        status: 'paused',
        elapsedMs: action.elapsedMs,
      };

    case 'RESUME':
      if (state.status !== 'paused') return state;
      return {
        ...state,
        status: 'active',
      };

    case 'END':
      if (state.status !== 'active' && state.status !== 'paused') return state;
      return {
        ...state,
        status: 'completed',
        elapsedMs: action.elapsedMs,
        distanceMeters: action.distanceMeters,
      };

    case 'RECOVER':
      if (state.status !== 'idle') return state;
      return {
        ...state,
        status: 'active',
        runId: action.snapshot.id,
        startTime: action.snapshot.startTime,
        elapsedMs: action.snapshot.elapsedMs,
        routeId: action.snapshot.routeId,
      };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Haversine distance (inline copy, same as gps-filter.ts)
// ---------------------------------------------------------------------------

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// computeDistance (exported for testing)
// ---------------------------------------------------------------------------

export function computeDistance(trace: FilteredPosition[]): number {
  if (trace.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < trace.length; i++) {
    total += haversineMeters(
      trace[i - 1].lat,
      trace[i - 1].lng,
      trace[i].lat,
      trace[i].lng,
    );
  }
  return total;
}

// ---------------------------------------------------------------------------
// useRunSession hook
// ---------------------------------------------------------------------------

export function useRunSession(): UseRunSessionReturn {
  const [state, dispatch] = useReducer(runReducer, initialState);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);

  // Mutable refs for data that changes frequently without triggering re-renders
  const traceRef = useRef<FilteredPosition[]>([]);
  const startTimeRef = useRef(0);
  const pausedDurationRef = useRef(0);
  const pauseStartRef = useRef(0);
  const elapsedRef = useRef(0);
  const routeIdRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const visibilityCleanupRef = useRef<(() => void) | null>(null);

  // ---- getSnapshot helper for crash recovery ----
  const getSnapshot = useCallback((): ActiveRunSnapshot => {
    return {
      id: runIdRef.current ?? '',
      startTime: startTimeRef.current,
      elapsedMs: elapsedRef.current,
      paused: state.status === 'paused',
      routeId: routeIdRef.current,
      trace: traceRef.current,
    };
  }, [state.status]);

  // ---- GPS effect: start/stop watcher based on status ----
  useEffect(() => {
    if (state.status !== 'active') return;

    const watchId = watchFilteredPosition(
      (pos: FilteredPosition) => {
        traceRef.current.push(pos);
        const newDist = computeDistance(traceRef.current);
        setDistanceMeters(newDist);
        onPointAccepted(() => ({
          id: runIdRef.current ?? '',
          startTime: startTimeRef.current,
          elapsedMs: elapsedRef.current,
          paused: false,
          routeId: routeIdRef.current,
          trace: traceRef.current,
        }));
      },
      () => {
        // onRejected -- no action needed in the hook
      },
      (err) => {
        console.error('GPS error during run:', err);
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [state.status]);

  // ---- Timer effect: update elapsed display ----
  useEffect(() => {
    if (state.status !== 'active') return;

    const interval = setInterval(() => {
      elapsedRef.current =
        Date.now() - startTimeRef.current - pausedDurationRef.current;
      setElapsedMs(elapsedRef.current);
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [state.status]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      stopSnapshotSchedule();
      releaseWakeLock();
      visibilityCleanupRef.current?.();
    };
  }, []);

  // ---- Transition functions ----

  const startRun = useCallback((routeId: string | null) => {
    if (state.status !== 'idle') return;

    const runId = crypto.randomUUID();
    const startTime = Date.now();

    runIdRef.current = runId;
    startTimeRef.current = startTime;
    routeIdRef.current = routeId;
    traceRef.current = [];
    pausedDurationRef.current = 0;
    pauseStartRef.current = 0;
    elapsedRef.current = 0;

    dispatch({ type: 'START', runId, startTime });

    // Side effects
    acquireWakeLock();
    visibilityCleanupRef.current = setupVisibilityReacquire();
    startSnapshotSchedule(() => ({
      id: runId,
      startTime,
      elapsedMs: elapsedRef.current,
      paused: false,
      routeId,
      trace: traceRef.current,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const pauseRun = useCallback(() => {
    if (state.status !== 'active') return;

    const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
    elapsedRef.current = elapsed;
    pauseStartRef.current = Date.now();

    dispatch({ type: 'PAUSE', elapsedMs: elapsed });

    stopSnapshotSchedule();
    releaseWakeLock();
    visibilityCleanupRef.current?.();
    visibilityCleanupRef.current = null;
  }, [state.status]);

  const resumeRun = useCallback(() => {
    if (state.status !== 'paused') return;

    pausedDurationRef.current += Date.now() - pauseStartRef.current;
    pauseStartRef.current = 0;

    dispatch({ type: 'RESUME' });

    acquireWakeLock();
    visibilityCleanupRef.current = setupVisibilityReacquire();
    startSnapshotSchedule(() => ({
      id: runIdRef.current ?? '',
      startTime: startTimeRef.current,
      elapsedMs: elapsedRef.current,
      paused: false,
      routeId: routeIdRef.current,
      trace: traceRef.current,
    }));
  }, [state.status]);

  const endRun = useCallback(async (): Promise<CompletedRun> => {
    if (state.status !== 'active' && state.status !== 'paused') {
      throw new Error(`Cannot end run in status: ${state.status}`);
    }

    // If paused, account for final paused duration
    if (state.status === 'paused') {
      pausedDurationRef.current += Date.now() - pauseStartRef.current;
    }

    const finalElapsed =
      Date.now() - startTimeRef.current - pausedDurationRef.current;
    const finalDistance = computeDistance(traceRef.current);

    dispatch({ type: 'END', elapsedMs: finalElapsed, distanceMeters: finalDistance });

    stopSnapshotSchedule();
    releaseWakeLock();
    visibilityCleanupRef.current?.();
    visibilityCleanupRef.current = null;

    const completedRun: CompletedRun = {
      id: runIdRef.current ?? '',
      startTime: startTimeRef.current,
      endTime: Date.now(),
      elapsedMs: finalElapsed,
      distanceMeters: finalDistance,
      trace: [...traceRef.current],
      routeId: routeIdRef.current,
    };

    await dbPut('runs', completedRun);
    return completedRun;
  }, [state.status]);

  const recoverRun = useCallback((snapshot: ActiveRunSnapshot) => {
    if (state.status !== 'idle') return;

    runIdRef.current = snapshot.id;
    startTimeRef.current = snapshot.startTime;
    routeIdRef.current = snapshot.routeId;
    traceRef.current = [...snapshot.trace];
    elapsedRef.current = snapshot.elapsedMs;
    // Compute paused duration from snapshot data
    pausedDurationRef.current =
      Date.now() - snapshot.startTime - snapshot.elapsedMs;
    pauseStartRef.current = 0;

    dispatch({ type: 'RECOVER', snapshot });

    acquireWakeLock();
    visibilityCleanupRef.current = setupVisibilityReacquire();
    startSnapshotSchedule(() => ({
      id: snapshot.id,
      startTime: snapshot.startTime,
      elapsedMs: elapsedRef.current,
      paused: false,
      routeId: snapshot.routeId,
      trace: traceRef.current,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    traceRef.current = [];
    startTimeRef.current = 0;
    pausedDurationRef.current = 0;
    pauseStartRef.current = 0;
    elapsedRef.current = 0;
    runIdRef.current = null;
    routeIdRef.current = null;
    setElapsedMs(0);
    setDistanceMeters(0);
  }, []);

  return {
    status: state.status,
    elapsedMs,
    distanceMeters,
    trace: traceRef.current,
    startRun,
    pauseRun,
    resumeRun,
    endRun,
    recoverRun,
    reset,
  };
}
