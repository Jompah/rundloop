import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRouteLibrary, updateRouteStats } from '../route-library';
import type { SavedRoute } from '../storage';
import type { RunAnalysis } from '../run-analysis-types';

// Mock dependencies
vi.mock('../storage', () => ({
  getSavedRoutes: vi.fn(),
}));

vi.mock('../db', () => ({
  dbPut: vi.fn(),
}));

import { getSavedRoutes } from '../storage';
import { dbPut } from '../db';

// Helper: build a minimal SavedRoute
function makeRoute(overrides: Partial<SavedRoute> = {}): SavedRoute {
  return {
    id: 'route-001',
    name: 'Test Route',
    city: 'Stockholm',
    createdAt: new Date().toISOString(),
    route: {
      polyline: [[18.04, 59.33]], // [lng, lat]
      distance: 5000,
      waypoints: [],
      instructions: [],
      surface: [],
    },
    ...overrides,
  } as SavedRoute;
}

// Helper: build a minimal RunAnalysis
function makeAnalysis(overrides: Partial<RunAnalysis> = {}): RunAnalysis {
  return {
    id: 'ra-001',
    runId: 'run-001',
    routeId: 'route-001',
    adherence: 92,
    deviationZones: [],
    completion: 0.95,
    computedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── checkRouteLibrary ──────────────────────────────────────────────────────

describe('checkRouteLibrary', () => {
  it('returns null when no verified routes exist', async () => {
    vi.mocked(getSavedRoutes).mockResolvedValue([
      makeRoute({ verified: false }),
      makeRoute({ id: 'route-002', verified: undefined }),
    ]);

    const result = await checkRouteLibrary(59.33, 18.04, 5);
    expect(result).toBeNull();
  });

  it('returns a verified route when start is within 200m and distance within ±15%', async () => {
    const route = makeRoute({ verified: true });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);

    // Start exactly at the route start point (0m away), same distance (5km)
    const result = await checkRouteLibrary(59.33, 18.04, 5);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('route-001');
  });

  it('returns null when start point is more than 200m away', async () => {
    const route = makeRoute({ verified: true });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);

    // ~2.2km north of the route start — well beyond 200m
    const result = await checkRouteLibrary(59.35, 18.04, 5);
    expect(result).toBeNull();
  });

  it('returns null when distance is outside ±15% tolerance', async () => {
    const route = makeRoute({ verified: true }); // route distance = 5000m
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);

    // Request 10km — far outside ±15% of 5km
    const result = await checkRouteLibrary(59.33, 18.04, 10);
    expect(result).toBeNull();
  });

  it('returns closest distance match when multiple verified routes qualify', async () => {
    const route1 = makeRoute({ id: 'route-001', verified: true, route: { polyline: [[18.04, 59.33]], distance: 5000, waypoints: [], instructions: [], surface: [] } });
    const route2 = makeRoute({ id: 'route-002', verified: true, route: { polyline: [[18.04, 59.33]], distance: 5200, waypoints: [], instructions: [], surface: [] } });
    vi.mocked(getSavedRoutes).mockResolvedValue([route2, route1]); // route2 first in array

    // Request exactly 5km — route1 (5000m) is closer match
    const result = await checkRouteLibrary(59.33, 18.04, 5);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('route-001');
  });
});

// ─── updateRouteStats ───────────────────────────────────────────────────────

describe('updateRouteStats', () => {
  it('increments timesRun and updates lastRunAt', async () => {
    const route = makeRoute({ timesRun: 2, avgAdherence: 88, verified: false });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);
    vi.mocked(dbPut).mockResolvedValue(undefined);

    const analysis = makeAnalysis({ adherence: 80, completion: 0.8 });
    await updateRouteStats('route-001', analysis);

    expect(dbPut).toHaveBeenCalledOnce();
    const saved = vi.mocked(dbPut).mock.calls[0][1] as SavedRoute;
    expect(saved.timesRun).toBe(3);
    expect(saved.lastRunAt).toBe(analysis.computedAt);
  });

  it('computes rolling average for avgAdherence', async () => {
    const route = makeRoute({ timesRun: 2, avgAdherence: 80, verified: false });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);
    vi.mocked(dbPut).mockResolvedValue(undefined);

    const analysis = makeAnalysis({ adherence: 95, completion: 0.8 });
    await updateRouteStats('route-001', analysis);

    const saved = vi.mocked(dbPut).mock.calls[0][1] as SavedRoute;
    // Rolling avg: (80*2 + 95) / 3 = 255/3 = 85
    expect(saved.avgAdherence).toBeCloseTo(85, 5);
  });

  it('sets verified=true when adherence >= 90 and completion >= 0.9', async () => {
    const route = makeRoute({ verified: false });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);
    vi.mocked(dbPut).mockResolvedValue(undefined);

    const analysis = makeAnalysis({ adherence: 90, completion: 0.9 });
    await updateRouteStats('route-001', analysis);

    const saved = vi.mocked(dbPut).mock.calls[0][1] as SavedRoute;
    expect(saved.verified).toBe(true);
  });

  it('does NOT set verified when adherence < 90', async () => {
    const route = makeRoute({ verified: false });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);
    vi.mocked(dbPut).mockResolvedValue(undefined);

    const analysis = makeAnalysis({ adherence: 89.9, completion: 0.95 });
    await updateRouteStats('route-001', analysis);

    const saved = vi.mocked(dbPut).mock.calls[0][1] as SavedRoute;
    expect(saved.verified).toBe(false);
  });

  it('does NOT set verified when completion < 0.9', async () => {
    const route = makeRoute({ verified: false });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);
    vi.mocked(dbPut).mockResolvedValue(undefined);

    const analysis = makeAnalysis({ adherence: 95, completion: 0.89 });
    await updateRouteStats('route-001', analysis);

    const saved = vi.mocked(dbPut).mock.calls[0][1] as SavedRoute;
    expect(saved.verified).toBe(false);
  });

  it('does not call dbPut when route is not found', async () => {
    vi.mocked(getSavedRoutes).mockResolvedValue([]);
    vi.mocked(dbPut).mockResolvedValue(undefined);

    const analysis = makeAnalysis();
    await updateRouteStats('route-nonexistent', analysis);

    expect(dbPut).not.toHaveBeenCalled();
  });

  it('preserves verified=true once set, even if new run has low adherence', async () => {
    const route = makeRoute({ verified: true, timesRun: 5, avgAdherence: 92 });
    vi.mocked(getSavedRoutes).mockResolvedValue([route]);
    vi.mocked(dbPut).mockResolvedValue(undefined);

    const analysis = makeAnalysis({ adherence: 70, completion: 0.7 });
    await updateRouteStats('route-001', analysis);

    const saved = vi.mocked(dbPut).mock.calls[0][1] as SavedRoute;
    expect(saved.verified).toBe(true);
  });
});
