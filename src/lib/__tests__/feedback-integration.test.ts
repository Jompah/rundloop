/**
 * Integration test: full implicit feedback loop
 *
 * Tests the chain: CompletedRun → computeRunAnalysis → updateRouteStats →
 * buildPromptFeedback, using realistic GPS traces and mocked DB/storage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeRunAnalysis } from '../run-analysis';
import { updateRouteStats } from '../route-library';
import { buildPromptFeedback } from '../prompt-feedback';
import type { CompletedRun, FilteredPosition } from '@/types';
import type { SavedRoute } from '../storage';
import type { RunAnalysis } from '../run-analysis-types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../db', () => ({
  dbPut: vi.fn().mockResolvedValue(undefined),
  dbGetAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../storage', () => ({
  getSavedRoutes: vi.fn().mockResolvedValue([]),
  haversineMeters: (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
}));

// run-analysis imports db dynamically — mock the dynamic import path too
vi.mock('../run-analysis', async (importOriginal) => {
  // We want the real computeAdherence / computeRunAnalysis implementations
  // but mock only the async DB functions that call IndexedDB.
  const actual = await importOriginal<typeof import('../run-analysis')>();
  return {
    ...actual,
    saveRunAnalysis: vi.fn().mockResolvedValue(undefined),
    getAnalysesForRoute: vi.fn().mockResolvedValue([]),
    getAnalysesNear: vi.fn().mockResolvedValue([]),
  };
});

import { getSavedRoutes } from '../storage';
import { dbPut } from '../db';
import { getAnalysesNear } from '../run-analysis';

const mockGetSavedRoutes = vi.mocked(getSavedRoutes);
const mockDbPut = vi.mocked(dbPut);
const mockGetAnalysesNear = vi.mocked(getAnalysesNear);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simple east-west polyline: [[lat, lng], ...] (run-analysis format) */
const POLYLINE: [number, number][] = [
  [59.33, 18.04],
  [59.33, 18.05],
  [59.33, 18.06],
];

/** Compute approximate route distance for the polyline */
function polylineDistanceMeters(poly: [number, number][]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < poly.length; i++) {
    const [lat1, lng1] = poly[i - 1];
    const [lat2, lng2] = poly[i];
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

const ROUTE_DISTANCE_M = polylineDistanceMeters(POLYLINE);

function makePosition(lat: number, lng: number, i: number): FilteredPosition {
  return { lat, lng, accuracy: 5, timestamp: Date.now() + i * 1000, speed: null, heading: null };
}

/** Trace closely following POLYLINE — points within ~5 m of the route */
const CLOSE_TRACE: FilteredPosition[] = [
  makePosition(59.33, 18.04, 0),
  makePosition(59.33, 18.045, 1),
  makePosition(59.33, 18.05, 2),
  makePosition(59.33, 18.055, 3),
  makePosition(59.33, 18.06, 4),
];

/**
 * Trace that deviates significantly: the middle three points are shifted
 * ~555 m north (0.005 lat ≈ 555 m). The first and last points stay on
 * the route so the trace covers the full distance.
 */
const DEVIATING_TRACE: FilteredPosition[] = [
  makePosition(59.33, 18.04, 0),
  makePosition(59.335, 18.045, 1),
  makePosition(59.335, 18.05, 2),
  makePosition(59.335, 18.055, 3),
  makePosition(59.33, 18.06, 4),
];

function makeRun(
  id: string,
  trace: FilteredPosition[],
  routePolyline: [number, number][]
): CompletedRun {
  return {
    id,
    startTime: Date.now() - 3600_000,
    endTime: Date.now(),
    elapsedMs: 3600_000,
    distanceMeters: ROUTE_DISTANCE_M,
    trace,
    routeId: 'route-001',
    routePolyline,
  };
}

function makeSavedRoute(overrides: Partial<SavedRoute> = {}): SavedRoute {
  return {
    id: 'route-001',
    name: 'Test Route',
    city: 'Stockholm',
    createdAt: new Date().toISOString(),
    route: {
      polyline: [[18.04, 59.33]], // [lng, lat] — storage format
      distance: ROUTE_DISTANCE_M,
      waypoints: [
        { lat: 59.33, lng: 18.04 },
        { lat: 59.33, lng: 18.06 },
      ],
      instructions: [],
      surface: [],
    },
    verified: false,
    timesRun: 0,
    avgAdherence: 0,
    ...overrides,
  } as SavedRoute;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. High-adherence run ────────────────────────────────────────────────────

describe('computeRunAnalysis — close trace', () => {
  it('returns adherence > 90 for trace within ~10m of route', () => {
    const run = makeRun('run-close', CLOSE_TRACE, POLYLINE);
    const result = computeRunAnalysis(run);

    expect(result).not.toBeNull();
    expect(result!.adherence).toBeGreaterThan(90);
  });

  it('returns completion > 0.9 for trace covering full route', () => {
    const run = makeRun('run-close', CLOSE_TRACE, POLYLINE);
    const result = computeRunAnalysis(run);

    expect(result).not.toBeNull();
    expect(result!.completion).toBeGreaterThan(0.9);
  });
});

// ── 2. Deviating run ─────────────────────────────────────────────────────────

describe('computeRunAnalysis — deviating trace', () => {
  it('returns adherence < 70 when 3 of 5 points are 555 m off-route', () => {
    const run = makeRun('run-deviate', DEVIATING_TRACE, POLYLINE);
    const result = computeRunAnalysis(run);

    expect(result).not.toBeNull();
    expect(result!.adherence).toBeLessThan(70);
  });

  it('detects at least 1 deviation zone', () => {
    const run = makeRun('run-deviate', DEVIATING_TRACE, POLYLINE);
    const result = computeRunAnalysis(run);

    expect(result).not.toBeNull();
    expect(result!.deviationZones.length).toBeGreaterThanOrEqual(1);
  });
});

// ── 3. updateRouteStats — route becomes verified ──────────────────────────────

describe('updateRouteStats — route becomes verified', () => {
  it('marks route as verified when adherence >= 90 and completion >= 0.9', async () => {
    const route = makeSavedRoute({ verified: false, timesRun: 0, avgAdherence: 0 });
    mockGetSavedRoutes.mockResolvedValue([route]);
    mockDbPut.mockResolvedValue(undefined);

    const analysis: RunAnalysis = {
      id: 'ra-001',
      runId: 'run-close',
      routeId: 'route-001',
      adherence: 95,
      deviationZones: [],
      completion: 0.97,
      computedAt: new Date().toISOString(),
    };

    await updateRouteStats('route-001', analysis);

    expect(mockDbPut).toHaveBeenCalledOnce();
    const saved = mockDbPut.mock.calls[0][1] as SavedRoute;
    expect(saved.verified).toBe(true);
  });
});

// ── 4. buildPromptFeedback — overlapping deviation zones ──────────────────────

describe('buildPromptFeedback — systematic deviation zones', () => {
  it('returns non-empty string when 2 analyses have overlapping deviation zones near start', async () => {
    // Two different analyses, deviation zones starting at almost the same coordinate
    const sharedCoord: [number, number] = [59.33, 18.04];
    const nearbyCoord: [number, number] = [59.3301, 18.0401]; // ~15 m away

    const analysis1: RunAnalysis = {
      id: 'ra-001',
      runId: 'run-001',
      routeId: 'route-001',
      adherence: 60,
      deviationZones: [
        { startCoord: sharedCoord, endCoord: [59.335, 18.045], maxDeviation: 555, length: 300 },
      ],
      completion: 0.8,
      computedAt: new Date().toISOString(),
    };

    const analysis2: RunAnalysis = {
      id: 'ra-002',
      runId: 'run-002',
      routeId: 'route-001',
      adherence: 62,
      deviationZones: [
        { startCoord: nearbyCoord, endCoord: [59.335, 18.045], maxDeviation: 500, length: 280 },
      ],
      completion: 0.82,
      computedAt: new Date().toISOString(),
    };

    mockGetAnalysesNear.mockResolvedValue([analysis1, analysis2]);
    mockGetSavedRoutes.mockResolvedValue([]);

    const feedback = await buildPromptFeedback(59.33, 18.04);

    expect(feedback).not.toBe('');
    expect(feedback.length).toBeGreaterThan(0);
  });

  it('feedback string contains historical context header', async () => {
    const coord: [number, number] = [59.33, 18.04];
    const nearbyCoord: [number, number] = [59.3301, 18.0401];

    const makeDevAnalysis = (id: string, startCoord: [number, number]): RunAnalysis => ({
      id,
      runId: `run-${id}`,
      routeId: 'route-001',
      adherence: 60,
      deviationZones: [
        { startCoord, endCoord: [59.335, 18.045], maxDeviation: 555, length: 300 },
      ],
      completion: 0.8,
      computedAt: new Date().toISOString(),
    });

    mockGetAnalysesNear.mockResolvedValue([
      makeDevAnalysis('ra-a', coord),
      makeDevAnalysis('ra-b', nearbyCoord),
    ]);
    mockGetSavedRoutes.mockResolvedValue([]);

    const feedback = await buildPromptFeedback(59.33, 18.04);

    expect(feedback).toContain('HISTORICAL FEEDBACK');
  });
});
