import { describe, it, expect } from 'vitest';
import type { ActiveRunSnapshot, FilteredPosition } from '@/types';

// Import the pure functions we will test directly (no React needed)
import { runReducer, computeDistance } from '../useRunSession';

// --- Helpers ---

function makeIdleState() {
  return {
    status: 'idle' as const,
    runId: null as string | null,
    startTime: 0,
    elapsedMs: 0,
    distanceMeters: 0,
    routeId: null as string | null,
  };
}

function makeActiveState(overrides: Record<string, unknown> = {}) {
  return {
    ...makeIdleState(),
    status: 'active' as const,
    runId: 'run-123',
    startTime: 1000000,
    ...overrides,
  };
}

function makePausedState(overrides: Record<string, unknown> = {}) {
  return {
    ...makeActiveState(),
    status: 'paused' as const,
    elapsedMs: 5000,
    ...overrides,
  };
}

function makeCompletedState(overrides: Record<string, unknown> = {}) {
  return {
    ...makeActiveState(),
    status: 'completed' as const,
    elapsedMs: 30000,
    distanceMeters: 5000,
    ...overrides,
  };
}

// --- Reducer tests ---

describe('runReducer', () => {
  it('START from idle -> status becomes active, runId and startTime set', () => {
    const state = makeIdleState();
    const next = runReducer(state, { type: 'START', runId: 'run-abc', startTime: 999 });
    expect(next.status).toBe('active');
    expect(next.runId).toBe('run-abc');
    expect(next.startTime).toBe(999);
  });

  it('START from non-idle -> state unchanged (guard rejects)', () => {
    const active = makeActiveState();
    const next = runReducer(active, { type: 'START', runId: 'run-new', startTime: 999 });
    expect(next).toBe(active); // same reference = no change
  });

  it('PAUSE from active -> status becomes paused, elapsedMs captured', () => {
    const state = makeActiveState();
    const next = runReducer(state, { type: 'PAUSE', elapsedMs: 12345 });
    expect(next.status).toBe('paused');
    expect(next.elapsedMs).toBe(12345);
  });

  it('PAUSE from non-active -> state unchanged (guard rejects)', () => {
    const idle = makeIdleState();
    const next = runReducer(idle, { type: 'PAUSE', elapsedMs: 100 });
    expect(next).toBe(idle);

    const paused = makePausedState();
    const next2 = runReducer(paused, { type: 'PAUSE', elapsedMs: 100 });
    expect(next2).toBe(paused);
  });

  it('RESUME from paused -> status becomes active', () => {
    const state = makePausedState();
    const next = runReducer(state, { type: 'RESUME' });
    expect(next.status).toBe('active');
  });

  it('RESUME from non-paused -> state unchanged (guard rejects)', () => {
    const idle = makeIdleState();
    const next = runReducer(idle, { type: 'RESUME' });
    expect(next).toBe(idle);

    const active = makeActiveState();
    const next2 = runReducer(active, { type: 'RESUME' });
    expect(next2).toBe(active);
  });

  it('END from active -> status becomes completed', () => {
    const state = makeActiveState();
    const next = runReducer(state, { type: 'END', elapsedMs: 30000, distanceMeters: 5000 });
    expect(next.status).toBe('completed');
    expect(next.elapsedMs).toBe(30000);
    expect(next.distanceMeters).toBe(5000);
  });

  it('END from paused -> status becomes completed', () => {
    const state = makePausedState();
    const next = runReducer(state, { type: 'END', elapsedMs: 30000, distanceMeters: 5000 });
    expect(next.status).toBe('completed');
  });

  it('END from idle -> state unchanged (guard rejects)', () => {
    const idle = makeIdleState();
    const next = runReducer(idle, { type: 'END', elapsedMs: 0, distanceMeters: 0 });
    expect(next).toBe(idle);
  });

  it('RECOVER from idle -> status becomes active, snapshot data restored', () => {
    const state = makeIdleState();
    const snapshot: ActiveRunSnapshot = {
      id: 'recovered-id',
      startTime: 500000,
      elapsedMs: 15000,
      paused: false,
      routeId: 'route-1',
      trace: [],
    };
    const next = runReducer(state, { type: 'RECOVER', snapshot });
    expect(next.status).toBe('active');
    expect(next.runId).toBe('recovered-id');
    expect(next.startTime).toBe(500000);
    expect(next.elapsedMs).toBe(15000);
    expect(next.routeId).toBe('route-1');
  });

  it('RESET from completed -> status becomes idle', () => {
    const state = makeCompletedState();
    const next = runReducer(state, { type: 'RESET' });
    expect(next.status).toBe('idle');
    expect(next.runId).toBeNull();
    expect(next.startTime).toBe(0);
    expect(next.elapsedMs).toBe(0);
    expect(next.distanceMeters).toBe(0);
    expect(next.routeId).toBeNull();
  });
});

// --- computeDistance tests ---

describe('computeDistance', () => {
  it('returns correct distance for known trace points', () => {
    // Two points ~500m apart in Stockholm
    const trace: FilteredPosition[] = [
      { lat: 59.3293, lng: 18.0686, accuracy: 5, timestamp: 1000, speed: 3 },
      { lat: 59.3338, lng: 18.0686, accuracy: 5, timestamp: 2000, speed: 3 },
    ];
    const dist = computeDistance(trace);
    // Haversine: ~500m (0.0045 deg lat ~ 500m)
    expect(dist).toBeGreaterThan(490);
    expect(dist).toBeLessThan(510);
  });

  it('returns 0 for empty trace', () => {
    expect(computeDistance([])).toBe(0);
  });

  it('returns 0 for single-point trace', () => {
    const trace: FilteredPosition[] = [
      { lat: 59.3293, lng: 18.0686, accuracy: 5, timestamp: 1000, speed: 3 },
    ];
    expect(computeDistance(trace)).toBe(0);
  });

  it('accumulates distance over multiple segments', () => {
    const trace: FilteredPosition[] = [
      { lat: 59.3293, lng: 18.0686, accuracy: 5, timestamp: 1000, speed: 3 },
      { lat: 59.3338, lng: 18.0686, accuracy: 5, timestamp: 2000, speed: 3 },
      { lat: 59.3383, lng: 18.0686, accuracy: 5, timestamp: 3000, speed: 3 },
    ];
    const dist = computeDistance(trace);
    // Should be roughly 2x the single-segment distance (~1000m)
    expect(dist).toBeGreaterThan(980);
    expect(dist).toBeLessThan(1020);
  });
});
