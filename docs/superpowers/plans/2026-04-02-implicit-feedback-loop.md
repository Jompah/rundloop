# Implicit Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically analyze completed runs to build a verified route library and feed historical insights into the AI route generator.

**Architecture:** Three new modules — run-analysis.ts (computes adherence/deviations/completion), route-library.ts (manages verified routes and matching), prompt-feedback.ts (builds historical context for AI prompts). Data stored in IndexedDB, computed client-side, designed for future backend sync.

**Tech Stack:** TypeScript, IndexedDB (via existing db.ts helpers), Vitest

---

## Task 1: Types + DB Migration

**Files:**
- Create: `src/lib/run-analysis-types.ts`
- Modify: `src/types/index.ts` — add `analysisId?: string` to CompletedRun
- Modify: `src/lib/storage.ts` — add verified/timesRun/avgAdherence/lastRunAt to SavedRoute
- Modify: `src/lib/db.ts` — bump DB_VERSION to 3, add run_analysis store
- Test: `src/lib/__tests__/run-analysis-types.test.ts` — type assertions

### Steps

- [ ] **1.1** Create test file `src/lib/__tests__/run-analysis-types.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest';
  import type { DeviationZone, RunAnalysis } from '../run-analysis-types';

  describe('run-analysis-types', () => {
    it('DeviationZone has required fields', () => {
      const zone: DeviationZone = {
        startCoord: [59.33, 18.04],
        endCoord: [59.34, 18.05],
        maxDeviation: 120,
        length: 350,
      };
      expect(zone.startCoord).toHaveLength(2);
      expect(zone.endCoord).toHaveLength(2);
      expect(zone.maxDeviation).toBeGreaterThan(0);
      expect(zone.length).toBeGreaterThan(0);
    });

    it('RunAnalysis has required fields', () => {
      const analysis: RunAnalysis = {
        id: 'ra-001',
        runId: 'run-001',
        routeId: 'route-001',
        adherence: 92.5,
        deviationZones: [],
        completion: 0.97,
        computedAt: new Date().toISOString(),
      };
      expect(analysis.id).toBeTruthy();
      expect(analysis.adherence).toBeGreaterThanOrEqual(0);
      expect(analysis.adherence).toBeLessThanOrEqual(100);
      expect(analysis.completion).toBeGreaterThanOrEqual(0);
      expect(analysis.completion).toBeLessThanOrEqual(1);
    });

    it('RunAnalysis allows null routeId', () => {
      const analysis: RunAnalysis = {
        id: 'ra-002',
        runId: 'run-002',
        routeId: null,
        adherence: 0,
        deviationZones: [],
        completion: 0,
        computedAt: new Date().toISOString(),
      };
      expect(analysis.routeId).toBeNull();
    });
  });
  ```
  Run: `npx vitest run src/lib/__tests__/run-analysis-types.test.ts` — expect fail (module not found).

- [ ] **1.2** Create `src/lib/run-analysis-types.ts`:
  ```typescript
  export interface DeviationZone {
    startCoord: [number, number];
    endCoord: [number, number];
    maxDeviation: number;
    length: number;
  }

  export interface RunAnalysis {
    id: string;
    runId: string;
    routeId: string | null;
    adherence: number;
    deviationZones: DeviationZone[];
    completion: number;
    computedAt: string;
  }
  ```
  Run: `npx vitest run src/lib/__tests__/run-analysis-types.test.ts` — expect pass.

- [ ] **1.3** Modify `src/types/index.ts` — add `analysisId?: string` to the `CompletedRun` interface.

- [ ] **1.4** Modify `src/lib/storage.ts` — add the following optional fields to the `SavedRoute` interface:
  ```typescript
  verified?: boolean;
  timesRun?: number;
  avgAdherence?: number;
  lastRunAt?: string;
  ```

- [ ] **1.5** Modify `src/lib/db.ts`:
  - Bump `DB_VERSION` from 2 to 3.
  - In the `onupgradeneeded` handler, add migration for version 3:
    ```typescript
    if (oldVersion < 3) {
      const analysisStore = db.createObjectStore('run_analysis', { keyPath: 'id' });
      analysisStore.createIndex('by_routeId', 'routeId', { unique: false });
      analysisStore.createIndex('by_runId', 'runId', { unique: false });
    }
    ```

- [ ] **1.6** Run all tests: `npx vitest run src/lib/__tests__/run-analysis-types.test.ts` — expect pass.

- [ ] **1.7** Commit: `git commit -m "feat(feedback-loop): add RunAnalysis types and DB migration to v3"`

---

## Task 2: Run Analysis Computation

**Files:**
- Create: `src/lib/run-analysis.ts`
- Test: `src/lib/__tests__/run-analysis.test.ts`

### Steps

- [ ] **2.1** Create test file `src/lib/__tests__/run-analysis.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import {
    pointToSegmentDistance,
    computeAdherence,
    computeCompletion,
    computeRunAnalysis,
  } from '../run-analysis';
  import type { DeviationZone } from '../run-analysis-types';

  // Helper: generate trace along a straight line
  function straightTrace(
    startLat: number, startLng: number,
    endLat: number, endLng: number,
    points: number
  ) {
    return Array.from({ length: points }, (_, i) => ({
      lat: startLat + (endLat - startLat) * (i / (points - 1)),
      lng: startLng + (endLng - startLng) * (i / (points - 1)),
      timestamp: Date.now() + i * 1000,
      accuracy: 5,
    }));
  }

  describe('pointToSegmentDistance', () => {
    it('returns 0 when point is on segment', () => {
      const d = pointToSegmentDistance(
        [59.33, 18.04], [59.33, 18.03], [59.33, 18.05]
      );
      expect(d).toBeLessThan(1); // sub-meter
    });

    it('returns distance to nearest endpoint when projection is outside segment', () => {
      const d = pointToSegmentDistance(
        [59.33, 18.00], [59.33, 18.03], [59.33, 18.05]
      );
      expect(d).toBeGreaterThan(100); // ~200m away
    });
  });

  describe('computeAdherence', () => {
    it('returns ~100% for trace that follows route exactly', () => {
      const polyline: [number, number][] = [
        [59.33, 18.03], [59.33, 18.05],
      ];
      const trace = straightTrace(59.33, 18.03, 59.33, 18.05, 20);
      const result = computeAdherence(trace, polyline);
      expect(result.adherence).toBeGreaterThan(95);
      expect(result.deviationZones).toHaveLength(0);
    });

    it('returns lower adherence for trace that deviates', () => {
      const polyline: [number, number][] = [
        [59.33, 18.03], [59.33, 18.05],
      ];
      // Trace that swings north by ~0.002 lat (~220m)
      const trace = straightTrace(59.332, 18.03, 59.332, 18.05, 20);
      const result = computeAdherence(trace, polyline);
      expect(result.adherence).toBeLessThan(70);
      expect(result.deviationZones.length).toBeGreaterThan(0);
    });
  });

  describe('computeCompletion', () => {
    it('returns ~1.0 for trace covering full route distance', () => {
      const trace = straightTrace(59.33, 18.03, 59.33, 18.05, 50);
      const routeDistance = 1300; // approx distance in meters for this span
      const completion = computeCompletion(trace, routeDistance);
      expect(completion).toBeGreaterThan(0.8);
      expect(completion).toBeLessThanOrEqual(1.0);
    });

    it('returns partial completion for short trace', () => {
      const trace = straightTrace(59.33, 18.03, 59.33, 18.04, 20);
      const routeDistance = 2600; // double the trace distance
      const completion = computeCompletion(trace, routeDistance);
      expect(completion).toBeLessThan(0.6);
    });
  });

  describe('computeRunAnalysis', () => {
    it('returns null when run has no routePolyline', () => {
      const run = {
        id: 'run-001',
        positions: straightTrace(59.33, 18.03, 59.33, 18.05, 20),
        distance: 1300,
        routeId: null,
        routePolyline: undefined,
      } as any;
      const result = computeRunAnalysis(run);
      expect(result).toBeNull();
    });

    it('returns RunAnalysis for valid run with route', () => {
      const polyline: [number, number][] = [
        [59.33, 18.03], [59.33, 18.05],
      ];
      const run = {
        id: 'run-001',
        positions: straightTrace(59.33, 18.03, 59.33, 18.05, 50),
        distance: 1300,
        routeId: 'route-001',
        routePolyline: polyline,
        routeDistance: 1300,
      } as any;
      const result = computeRunAnalysis(run);
      expect(result).not.toBeNull();
      expect(result!.runId).toBe('run-001');
      expect(result!.routeId).toBe('route-001');
      expect(result!.adherence).toBeGreaterThan(90);
      expect(result!.completion).toBeGreaterThan(0.8);
    });
  });
  ```
  Run: `npx vitest run src/lib/__tests__/run-analysis.test.ts` — expect fail (module not found).

- [ ] **2.2** Create `src/lib/run-analysis.ts`:
  ```typescript
  import type { DeviationZone, RunAnalysis } from './run-analysis-types';
  import type { CompletedRun } from '@/types';
  import type { FilteredPosition } from '@/types'; // adjust import path as needed

  /** Haversine distance in meters between two [lat, lng] points */
  function haversineMeters(
    a: [number, number],
    b: [number, number]
  ): number {
    const R = 6371000;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const aVal =
      sinLat * sinLat +
      Math.cos((a[0] * Math.PI) / 180) *
        Math.cos((b[0] * Math.PI) / 180) *
        sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  }

  /**
   * Minimum distance in meters from a point to a line segment.
   * All coords are [lat, lng].
   */
  export function pointToSegmentDistance(
    point: [number, number],
    segStart: [number, number],
    segEnd: [number, number]
  ): number {
    const dx = segEnd[1] - segStart[1];
    const dy = segEnd[0] - segStart[0];
    if (dx === 0 && dy === 0) {
      return haversineMeters(point, segStart);
    }
    let t =
      ((point[0] - segStart[0]) * dy + (point[1] - segStart[1]) * dx) /
      (dy * dy + dx * dx);
    t = Math.max(0, Math.min(1, t));
    const proj: [number, number] = [
      segStart[0] + t * dy,
      segStart[1] + t * dx,
    ];
    return haversineMeters(point, proj);
  }

  /**
   * Compute adherence (%) and deviation zones.
   * Downsamples trace if >200 points. Threshold: 50m from route.
   */
  export function computeAdherence(
    trace: { lat: number; lng: number }[],
    polyline: [number, number][]
  ): { adherence: number; deviationZones: DeviationZone[] } {
    const THRESHOLD_M = 50;
    const MIN_ZONE_LENGTH_M = 100;

    // Downsample
    const step = trace.length > 200 ? 5 : 1;
    const sampled = trace.filter((_, i) => i % step === 0);

    let withinCount = 0;
    const distances: { point: [number, number]; dist: number }[] = [];

    for (const pt of sampled) {
      let minDist = Infinity;
      for (let i = 0; i < polyline.length - 1; i++) {
        const d = pointToSegmentDistance(
          [pt.lat, pt.lng],
          polyline[i],
          polyline[i + 1]
        );
        if (d < minDist) minDist = d;
      }
      distances.push({ point: [pt.lat, pt.lng], dist: minDist });
      if (minDist <= THRESHOLD_M) withinCount++;
    }

    const adherence = sampled.length > 0
      ? (withinCount / sampled.length) * 100
      : 0;

    // Find deviation zones: contiguous stretches >50m for >100m trace distance
    const deviationZones: DeviationZone[] = [];
    let zoneStart: number | null = null;
    let zoneMaxDev = 0;

    for (let i = 0; i < distances.length; i++) {
      if (distances[i].dist > THRESHOLD_M) {
        if (zoneStart === null) zoneStart = i;
        zoneMaxDev = Math.max(zoneMaxDev, distances[i].dist);
      } else if (zoneStart !== null) {
        // Zone ended — check length
        let zoneLength = 0;
        for (let j = zoneStart; j < i; j++) {
          zoneLength += haversineMeters(
            distances[j].point,
            distances[j + 1]?.point ?? distances[j].point
          );
        }
        if (zoneLength >= MIN_ZONE_LENGTH_M) {
          deviationZones.push({
            startCoord: distances[zoneStart].point,
            endCoord: distances[i - 1].point,
            maxDeviation: Math.round(zoneMaxDev),
            length: Math.round(zoneLength),
          });
        }
        zoneStart = null;
        zoneMaxDev = 0;
      }
    }

    // Handle zone that extends to end of trace
    if (zoneStart !== null) {
      let zoneLength = 0;
      for (let j = zoneStart; j < distances.length - 1; j++) {
        zoneLength += haversineMeters(
          distances[j].point,
          distances[j + 1].point
        );
      }
      if (zoneLength >= MIN_ZONE_LENGTH_M) {
        deviationZones.push({
          startCoord: distances[zoneStart].point,
          endCoord: distances[distances.length - 1].point,
          maxDeviation: Math.round(zoneMaxDev),
          length: Math.round(zoneLength),
        });
      }
    }

    return { adherence: Math.round(adherence * 10) / 10, deviationZones };
  }

  /**
   * Compute completion ratio (0–1).
   * trace distance / route distance, capped at 1.0.
   */
  export function computeCompletion(
    trace: { lat: number; lng: number }[],
    routeDistance: number
  ): number {
    if (routeDistance <= 0 || trace.length < 2) return 0;
    let traceDist = 0;
    for (let i = 1; i < trace.length; i++) {
      traceDist += haversineMeters(
        [trace[i - 1].lat, trace[i - 1].lng],
        [trace[i].lat, trace[i].lng]
      );
    }
    return Math.min(1.0, traceDist / routeDistance);
  }

  /**
   * Compute full RunAnalysis for a completed run.
   * Returns null if run has no routePolyline.
   */
  export function computeRunAnalysis(run: CompletedRun): RunAnalysis | null {
    if (!run.routePolyline || run.routePolyline.length < 2) return null;

    const { adherence, deviationZones } = computeAdherence(
      run.positions,
      run.routePolyline
    );
    const completion = computeCompletion(
      run.positions,
      run.routeDistance ?? run.distance
    );

    return {
      id: `ra-${run.id}-${Date.now()}`,
      runId: run.id,
      routeId: run.routeId ?? null,
      adherence,
      deviationZones,
      completion,
      computedAt: new Date().toISOString(),
    };
  }

  /** Persist a RunAnalysis to IndexedDB */
  export async function saveRunAnalysis(analysis: RunAnalysis): Promise<void> {
    const { dbPut } = await import('./db');
    await dbPut('run_analysis', analysis);
  }

  /** Get all analyses for a specific route */
  export async function getAnalysesForRoute(
    routeId: string
  ): Promise<RunAnalysis[]> {
    const { dbGetAllByIndex } = await import('./db');
    return dbGetAllByIndex('run_analysis', 'by_routeId', routeId);
  }

  /** Get all analyses near a point (scan + filter) */
  export async function getAnalysesNear(
    lat: number,
    lng: number,
    radiusM: number
  ): Promise<RunAnalysis[]> {
    const { dbGetAll } = await import('./db');
    const all: RunAnalysis[] = await dbGetAll('run_analysis');
    return all.filter((a) => {
      if (a.deviationZones.length === 0) return false;
      // Use first deviation zone start as proxy for location
      // TODO: store start coord on RunAnalysis for better spatial queries
      return true; // For now return all — Task 4 refines this
    });
  }
  ```
  Run: `npx vitest run src/lib/__tests__/run-analysis.test.ts` — expect pass. Adjust imports/types if `FilteredPosition` differs from `{ lat, lng, timestamp, accuracy }`.

- [ ] **2.3** Verify all existing tests still pass: `npx vitest run`

- [ ] **2.4** Commit: `git commit -m "feat(feedback-loop): run analysis computation with adherence and completion"`

---

## Task 3: Route Library

**Files:**
- Create: `src/lib/route-library.ts`
- Test: `src/lib/__tests__/route-library.test.ts`

### Steps

- [ ] **3.1** Create test file `src/lib/__tests__/route-library.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { checkRouteLibrary, updateRouteStats } from '../route-library';

  // Mock storage module
  vi.mock('../storage', () => ({
    getSavedRoutes: vi.fn(),
    saveRoute: vi.fn(),
  }));

  import { getSavedRoutes, saveRoute } from '../storage';

  const mockRoute = (overrides = {}) => ({
    id: 'route-001',
    name: 'Kungsholmen loop',
    distance: 5.0,
    polyline: [[59.33, 18.03], [59.33, 18.05]] as [number, number][],
    startLat: 59.33,
    startLng: 18.03,
    verified: false,
    timesRun: 0,
    avgAdherence: 0,
    lastRunAt: null,
    ...overrides,
  });

  describe('checkRouteLibrary', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('returns null when no routes exist', async () => {
      (getSavedRoutes as any).mockResolvedValue([]);
      const result = await checkRouteLibrary(59.33, 18.03, 5.0);
      expect(result).toBeNull();
    });

    it('returns matching verified route within 200m and ±15% distance', async () => {
      (getSavedRoutes as any).mockResolvedValue([
        mockRoute({ verified: true, distance: 5.2 }),
      ]);
      const result = await checkRouteLibrary(59.33, 18.03, 5.0);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('route-001');
    });

    it('returns null when route is too far away', async () => {
      (getSavedRoutes as any).mockResolvedValue([
        mockRoute({ verified: true, startLat: 59.34, startLng: 18.10 }),
      ]);
      const result = await checkRouteLibrary(59.33, 18.03, 5.0);
      expect(result).toBeNull();
    });

    it('returns null when route distance differs by >15%', async () => {
      (getSavedRoutes as any).mockResolvedValue([
        mockRoute({ verified: true, distance: 10.0 }),
      ]);
      const result = await checkRouteLibrary(59.33, 18.03, 5.0);
      expect(result).toBeNull();
    });
  });

  describe('updateRouteStats', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('increments timesRun and updates avgAdherence', async () => {
      const route = mockRoute({ timesRun: 2, avgAdherence: 88 });
      (getSavedRoutes as any).mockResolvedValue([route]);

      await updateRouteStats('route-001', {
        id: 'ra-001',
        runId: 'run-001',
        routeId: 'route-001',
        adherence: 94,
        deviationZones: [],
        completion: 0.95,
        computedAt: new Date().toISOString(),
      });

      expect(saveRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          timesRun: 3,
          avgAdherence: 90, // (88*2 + 94) / 3
          verified: true, // adherence >= 90 and completion >= 0.9
        })
      );
    });

    it('does not set verified if adherence < 90', async () => {
      const route = mockRoute({ timesRun: 0, avgAdherence: 0 });
      (getSavedRoutes as any).mockResolvedValue([route]);

      await updateRouteStats('route-001', {
        id: 'ra-002',
        runId: 'run-002',
        routeId: 'route-001',
        adherence: 75,
        deviationZones: [],
        completion: 0.95,
        computedAt: new Date().toISOString(),
      });

      expect(saveRoute).toHaveBeenCalledWith(
        expect.objectContaining({ verified: false })
      );
    });
  });
  ```
  Run: `npx vitest run src/lib/__tests__/route-library.test.ts` — expect fail.

- [ ] **3.2** Create `src/lib/route-library.ts`:
  ```typescript
  import { getSavedRoutes, saveRoute } from './storage';
  import type { SavedRoute } from './storage';
  import type { RunAnalysis } from './run-analysis-types';

  /** Haversine distance in meters */
  function haversineMeters(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Find a verified route within 200m of start and ±15% of requested distance.
   * Returns the best match or null.
   */
  export async function checkRouteLibrary(
    startLat: number,
    startLng: number,
    distanceKm: number
  ): Promise<SavedRoute | null> {
    const routes = await getSavedRoutes();
    const MAX_START_DIST_M = 200;
    const DIST_TOLERANCE = 0.15;

    let bestMatch: SavedRoute | null = null;
    let bestScore = Infinity;

    for (const route of routes) {
      if (!route.verified) continue;

      const startDist = haversineMeters(
        startLat, startLng,
        route.startLat, route.startLng
      );
      if (startDist > MAX_START_DIST_M) continue;

      const distRatio = Math.abs(route.distance - distanceKm) / distanceKm;
      if (distRatio > DIST_TOLERANCE) continue;

      // Score: prefer closer start + closer distance match
      const score = startDist + distRatio * 1000;
      if (score < bestScore) {
        bestScore = score;
        bestMatch = route;
      }
    }

    return bestMatch;
  }

  /**
   * Update route stats after a run analysis.
   * Sets verified = true if adherence >= 90 and completion >= 0.9.
   */
  export async function updateRouteStats(
    routeId: string,
    analysis: RunAnalysis
  ): Promise<void> {
    const routes = await getSavedRoutes();
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const prevRuns = route.timesRun ?? 0;
    const prevAvg = route.avgAdherence ?? 0;
    const newTimesRun = prevRuns + 1;
    const newAvgAdherence = Math.round(
      (prevAvg * prevRuns + analysis.adherence) / newTimesRun
    );

    const shouldVerify =
      analysis.adherence >= 90 && analysis.completion >= 0.9;

    await saveRoute({
      ...route,
      timesRun: newTimesRun,
      avgAdherence: newAvgAdherence,
      lastRunAt: analysis.computedAt,
      verified: shouldVerify || (route.verified ?? false),
    });
  }
  ```
  Run: `npx vitest run src/lib/__tests__/route-library.test.ts` — expect pass. Adjust `SavedRoute` import path if needed.

- [ ] **3.3** Run all tests: `npx vitest run`

- [ ] **3.4** Commit: `git commit -m "feat(feedback-loop): route library with verification and matching"`

---

## Task 4: Prompt Feedback Builder

**Files:**
- Create: `src/lib/prompt-feedback.ts`
- Test: `src/lib/__tests__/prompt-feedback.test.ts`

### Steps

- [ ] **4.1** Create test file `src/lib/__tests__/prompt-feedback.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { buildPromptFeedback } from '../prompt-feedback';

  // Mock dependencies
  vi.mock('../run-analysis', () => ({
    getAnalysesNear: vi.fn(),
  }));
  vi.mock('../storage', () => ({
    getSavedRoutes: vi.fn(),
  }));

  import { getAnalysesNear } from '../run-analysis';
  import { getSavedRoutes } from '../storage';

  describe('buildPromptFeedback', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('returns empty string when no analyses exist', async () => {
      (getAnalysesNear as any).mockResolvedValue([]);
      (getSavedRoutes as any).mockResolvedValue([]);
      const result = await buildPromptFeedback(59.33, 18.03);
      expect(result).toBe('');
    });

    it('includes deviation avoidance when >=2 analyses share similar deviation zones', async () => {
      const sharedZone = {
        startCoord: [59.335, 18.042] as [number, number],
        endCoord: [59.336, 18.043] as [number, number],
        maxDeviation: 150,
        length: 200,
      };
      (getAnalysesNear as any).mockResolvedValue([
        {
          id: 'ra-1', runId: 'r1', routeId: 'rt1',
          adherence: 80, deviationZones: [sharedZone],
          completion: 0.9, computedAt: '2026-03-30T10:00:00Z',
        },
        {
          id: 'ra-2', runId: 'r2', routeId: 'rt1',
          adherence: 78, deviationZones: [{
            ...sharedZone,
            startCoord: [59.3351, 18.0421], // ~10m from first
          }],
          completion: 0.88, computedAt: '2026-03-31T10:00:00Z',
        },
      ]);
      (getSavedRoutes as any).mockResolvedValue([]);

      const result = await buildPromptFeedback(59.33, 18.03);
      expect(result).toContain('HISTORICAL FEEDBACK');
      expect(result).toContain('Avoid area near');
      expect(result).toContain('59.335');
    });

    it('includes preferred path when verified routes exist nearby', async () => {
      (getAnalysesNear as any).mockResolvedValue([]);
      (getSavedRoutes as any).mockResolvedValue([
        {
          id: 'rt-1',
          name: 'Waterfront loop',
          verified: true,
          avgAdherence: 95,
          startLat: 59.33,
          startLng: 18.03,
          polyline: [[59.328, 18.030], [59.327, 18.040]],
        },
      ]);

      const result = await buildPromptFeedback(59.33, 18.03);
      expect(result).toContain('HISTORICAL FEEDBACK');
      expect(result).toContain('Preferred path');
    });

    it('caps feedback at 5 points', async () => {
      const makeZone = (lat: number) => ({
        startCoord: [lat, 18.042] as [number, number],
        endCoord: [lat + 0.001, 18.043] as [number, number],
        maxDeviation: 150,
        length: 200,
      });

      // 6 pairs of analyses with different deviation zones
      const analyses = Array.from({ length: 12 }, (_, i) => ({
        id: `ra-${i}`,
        runId: `r${i}`,
        routeId: 'rt1',
        adherence: 70,
        deviationZones: [makeZone(59.33 + (Math.floor(i / 2)) * 0.005)],
        completion: 0.9,
        computedAt: '2026-03-30T10:00:00Z',
      }));

      (getAnalysesNear as any).mockResolvedValue(analyses);
      (getSavedRoutes as any).mockResolvedValue([]);

      const result = await buildPromptFeedback(59.33, 18.03);
      const lines = result
        .split('\n')
        .filter((l: string) => l.startsWith('- '));
      expect(lines.length).toBeLessThanOrEqual(5);
    });
  });
  ```
  Run: `npx vitest run src/lib/__tests__/prompt-feedback.test.ts` — expect fail.

- [ ] **4.2** Create `src/lib/prompt-feedback.ts`:
  ```typescript
  import { getAnalysesNear } from './run-analysis';
  import { getSavedRoutes } from './storage';
  import type { RunAnalysis, DeviationZone } from './run-analysis-types';

  /** Haversine in meters */
  function haversineM(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  interface FeedbackPoint {
    text: string;
    priority: number; // lower = higher priority
  }

  /**
   * Build historical feedback string for AI route generation prompt.
   * Returns empty string if no relevant data.
   */
  export async function buildPromptFeedback(
    startLat: number,
    startLng: number
  ): Promise<string> {
    const RADIUS_M = 1000;
    const ZONE_CLUSTER_M = 100;
    const MAX_POINTS = 5;

    const [analyses, routes] = await Promise.all([
      getAnalysesNear(startLat, startLng, RADIUS_M),
      getSavedRoutes(),
    ]);

    const feedbackPoints: FeedbackPoint[] = [];

    // 1. Find systematic deviation zones (appear in >=2 analyses within 100m)
    const allZones: { zone: DeviationZone; analysisId: string }[] = [];
    for (const a of analyses) {
      for (const z of a.deviationZones) {
        allZones.push({ zone: z, analysisId: a.id });
      }
    }

    const usedZones = new Set<string>();
    for (let i = 0; i < allZones.length; i++) {
      if (usedZones.has(allZones[i].analysisId + '-' + i)) continue;
      const cluster = [allZones[i]];

      for (let j = i + 1; j < allZones.length; j++) {
        if (allZones[j].analysisId === allZones[i].analysisId) continue;
        const dist = haversineM(
          allZones[i].zone.startCoord[0],
          allZones[i].zone.startCoord[1],
          allZones[j].zone.startCoord[0],
          allZones[j].zone.startCoord[1]
        );
        if (dist <= ZONE_CLUSTER_M) {
          cluster.push(allZones[j]);
          usedZones.add(allZones[j].analysisId + '-' + j);
        }
      }

      if (cluster.length >= 2) {
        const avgLat =
          cluster.reduce((s, c) => s + c.zone.startCoord[0], 0) /
          cluster.length;
        const avgLng =
          cluster.reduce((s, c) => s + c.zone.startCoord[1], 0) /
          cluster.length;
        feedbackPoints.push({
          text: `Avoid area near ${avgLat.toFixed(4)}, ${avgLng.toFixed(4)} (runners consistently deviate here)`,
          priority: 1,
        });
      }
    }

    // 2. Verified routes nearby — extract preferred paths
    const nearbyVerified = routes.filter(
      (r) =>
        r.verified &&
        haversineM(startLat, startLng, r.startLat, r.startLng) <= RADIUS_M
    );

    for (const route of nearbyVerified) {
      if (
        route.polyline &&
        route.polyline.length >= 2 &&
        (route.avgAdherence ?? 0) >= 80
      ) {
        const start = route.polyline[0];
        const end = route.polyline[Math.min(1, route.polyline.length - 1)];
        feedbackPoints.push({
          text: `Preferred path: ${start[0].toFixed(4)},${start[1].toFixed(4)} → ${end[0].toFixed(4)},${end[1].toFixed(4)} along ${route.name || 'verified route'} (high adherence)`,
          priority: 2,
        });
      }
    }

    if (feedbackPoints.length === 0) return '';

    // Sort by priority and cap
    feedbackPoints.sort((a, b) => a.priority - b.priority);
    const capped = feedbackPoints.slice(0, MAX_POINTS);

    return [
      'HISTORICAL FEEDBACK (from real runs near this start):',
      ...capped.map((p) => `- ${p.text}`),
    ].join('\n');
  }
  ```
  Run: `npx vitest run src/lib/__tests__/prompt-feedback.test.ts` — expect pass.

- [ ] **4.3** Run all tests: `npx vitest run`

- [ ] **4.4** Commit: `git commit -m "feat(feedback-loop): prompt feedback builder with deviation avoidance and preferred paths"`

---

## Task 5: Wire Analysis After Run Ends

**Files:**
- Modify: `src/app/page.tsx` — after endRun() returns CompletedRun, compute analysis and update route stats

### Steps

- [ ] **5.1** In `src/app/page.tsx`, add imports at the top:
  ```typescript
  import { computeRunAnalysis, saveRunAnalysis } from '@/lib/run-analysis';
  import { updateRouteStats } from '@/lib/route-library';
  import { dbPut } from '@/lib/db';
  ```

- [ ] **5.2** Search for where `endRun()` or `handleEndRun` is called in `page.tsx`. After the run is saved (i.e., after endRun() returns a CompletedRun), add the following analysis wiring code:
  ```typescript
  // --- Implicit feedback: analyze run and update route stats ---
  try {
    const analysis = computeRunAnalysis(completedRun);
    if (analysis) {
      await saveRunAnalysis(analysis);
      // Link analysis to the completed run
      await dbPut('runs', { ...completedRun, analysisId: analysis.id });

      // Update route stats if this run followed a route
      if (completedRun.routeId) {
        await updateRouteStats(completedRun.routeId, analysis);
      }
    }
  } catch (err) {
    console.error('[feedback-loop] analysis failed (non-blocking):', err);
  }
  ```
  Key rules:
  - All wrapped in try/catch — errors logged but **never block user**
  - `computeRunAnalysis` is synchronous, returns `RunAnalysis | null`
  - `saveRunAnalysis` and `updateRouteStats` are async
  - `dbPut('runs', ...)` updates the CompletedRun with the analysisId

- [ ] **5.3** Run existing tests to verify no regressions: `npx vitest run`

- [ ] **5.4** Commit: `git commit -m "feat(feedback-loop): wire run analysis after endRun"`

---

## Task 6: Wire Library Check + Prompt Feedback Into Route Generation

**Files:**
- Modify: `src/app/page.tsx` — before generateRouteWaypoints, check route library
- Modify: `src/lib/route-ai.ts` — add feedbackContext parameter to buildRoutePrompt and generateRouteWaypoints

### Steps

- [ ] **6.1** In `src/app/page.tsx`, add imports:
  ```typescript
  import { checkRouteLibrary } from '@/lib/route-library';
  import { buildPromptFeedback } from '@/lib/prompt-feedback';
  ```

- [ ] **6.2** In `src/app/page.tsx`, locate the route generation code (around the `generateRouteWaypoints` call, near line 340). Before the generation loop, add:
  ```typescript
  // --- Implicit feedback: check library for verified route ---
  const verifiedRoute = await checkRouteLibrary(startLat, startLng, distance);
  if (verifiedRoute && verifiedRoute.polyline) {
    // Use verified route directly — skip AI generation entirely
    // Set route waypoints/polyline from the library route
    // (adapt to how the surrounding code consumes the generated route)
    console.log('[feedback-loop] using verified route:', verifiedRoute.id);
    // ... wire verifiedRoute.polyline into the route state ...
    // return early or skip the AI generation block
  }

  // No library match — build historical feedback for AI prompt
  const feedbackContext = await buildPromptFeedback(startLat, startLng);
  ```
  Then pass `feedbackContext` to `generateRouteWaypoints`:
  ```typescript
  // Add feedbackContext to the request object passed to generateRouteWaypoints
  const waypoints = await generateRouteWaypoints({
    ...existingRequest,
    feedbackContext,
  });
  ```
  **Note:** The exact wiring depends on how page.tsx structures the route generation call. Adapt the pattern to match the existing code shape.

- [ ] **6.3** In `src/lib/route-ai.ts`, update the `AIRouteRequest` interface (or equivalent request type):
  ```typescript
  // Add optional field to the interface
  feedbackContext?: string;
  ```

- [ ] **6.4** In `src/lib/route-ai.ts`, update `buildRoutePrompt` to inject `feedbackContext`. Insert it after the POI section but before the Requirements section:
  ```typescript
  // Inside buildRoutePrompt, after poiSection and before requirementsSection:
  const feedbackSection = req.feedbackContext
    ? `\n\n${req.feedbackContext}\n`
    : '';

  // Include feedbackSection in the final prompt string
  ```

- [ ] **6.5** In `src/lib/route-ai.ts`, update `generateRouteWaypoints` to pass `feedbackContext` through to `buildRoutePrompt`:
  ```typescript
  // Ensure req.feedbackContext is forwarded when calling buildRoutePrompt
  const prompt = buildRoutePrompt({
    ...req,
    feedbackContext: req.feedbackContext,
  });
  ```

- [ ] **6.6** Run all tests: `npx vitest run`

- [ ] **6.7** Commit: `git commit -m "feat(feedback-loop): wire route library check and prompt feedback into generation"`

---

## Task 7: Final Integration Test

**Files:**
- Create: `src/lib/__tests__/feedback-integration.test.ts`

### Steps

- [ ] **7.1** Create `src/lib/__tests__/feedback-integration.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { computeRunAnalysis, saveRunAnalysis } from '../run-analysis';
  import { updateRouteStats, checkRouteLibrary } from '../route-library';
  import { buildPromptFeedback } from '../prompt-feedback';

  // In-memory storage for db mocks
  let store: Record<string, any[]> = {};

  vi.mock('../db', () => ({
    dbPut: vi.fn(async (storeName: string, value: any) => {
      if (!store[storeName]) store[storeName] = [];
      const idx = store[storeName].findIndex((v: any) => v.id === value.id);
      if (idx >= 0) store[storeName][idx] = value;
      else store[storeName].push(value);
    }),
    dbGetAll: vi.fn(async (storeName: string) => store[storeName] ?? []),
    dbGetAllByIndex: vi.fn(
      async (storeName: string, _index: string, key: string) =>
        (store[storeName] ?? []).filter((v: any) => v.routeId === key)
    ),
  }));

  vi.mock('../storage', () => {
    return {
      getSavedRoutes: vi.fn(async () => store['routes'] ?? []),
      saveRoute: vi.fn(async (route: any) => {
        if (!store['routes']) store['routes'] = [];
        const idx = store['routes'].findIndex((r: any) => r.id === route.id);
        if (idx >= 0) store['routes'][idx] = route;
        else store['routes'].push(route);
      }),
    };
  });

  /** Generate a straight trace between two points */
  function straightTrace(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
    points: number
  ): { lat: number; lng: number; timestamp: number; accuracy: number }[] {
    return Array.from({ length: points }, (_, i) => ({
      lat: lat1 + ((lat2 - lat1) * i) / (points - 1),
      lng: lng1 + ((lng2 - lng1) * i) / (points - 1),
      timestamp: Date.now() + i * 1000,
      accuracy: 5,
    }));
  }

  /** Generate a deviating trace that goes off-route */
  function deviatingTrace(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
    deviationLat: number, deviationLng: number,
    points: number
  ): { lat: number; lng: number; timestamp: number; accuracy: number }[] {
    const mid = Math.floor(points / 2);
    const trace = [];
    for (let i = 0; i < points; i++) {
      let lat: number, lng: number;
      if (i < mid * 0.3) {
        // On route at start
        lat = lat1 + ((deviationLat - lat1) * i) / (mid * 0.3);
        lng = lng1 + ((deviationLng - lng1) * i) / (mid * 0.3);
      } else if (i < mid * 0.7) {
        // Deviating
        lat = deviationLat + (i - mid * 0.3) * 0.001;
        lng = deviationLng + (i - mid * 0.3) * 0.001;
      } else {
        // Back toward end
        const progress = (i - mid * 0.7) / (points - mid * 0.7);
        lat = deviationLat + 0.001 * (mid * 0.4) + (lat2 - deviationLat) * progress;
        lng = deviationLng + 0.001 * (mid * 0.4) + (lng2 - deviationLng) * progress;
      }
      trace.push({ lat, lng, timestamp: Date.now() + i * 1000, accuracy: 5 });
    }
    return trace;
  }

  describe('Feedback Integration', () => {
    beforeEach(() => {
      store = {};
      vi.clearAllMocks();
    });

    it('high-adherence run → route becomes verified → library returns it', async () => {
      // Setup: a saved route
      const polyline: [number, number][] = [
        [59.33, 18.03],
        [59.33, 18.05],
      ];
      store['routes'] = [
        {
          id: 'route-001',
          name: 'Test loop',
          distance: 5.0,
          polyline,
          startLat: 59.33,
          startLng: 18.03,
          verified: false,
          timesRun: 0,
          avgAdherence: 0,
          lastRunAt: null,
        },
      ];

      // Step 1: Create a run that closely follows the polyline
      const completedRun = {
        id: 'run-001',
        positions: straightTrace(59.33, 18.03, 59.33, 18.05, 50),
        distance: 1300,
        routeId: 'route-001',
        routePolyline: polyline,
        routeDistance: 1300,
      } as any;

      // Step 2: Compute analysis — adherence should be >90%
      const analysis = computeRunAnalysis(completedRun);
      expect(analysis).not.toBeNull();
      expect(analysis!.adherence).toBeGreaterThan(90);

      // Step 3: Save analysis and update route stats
      await saveRunAnalysis(analysis!);
      await updateRouteStats('route-001', analysis!);

      // Step 4: Route should now be verified
      const updatedRoute = store['routes']?.find(
        (r: any) => r.id === 'route-001'
      );
      expect(updatedRoute?.verified).toBe(true);
      expect(updatedRoute?.timesRun).toBe(1);

      // Step 5: checkRouteLibrary should return the verified route
      const match = await checkRouteLibrary(59.33, 18.03, 5.0);
      expect(match).not.toBeNull();
      expect(match!.id).toBe('route-001');
    });

    it('deviating run → deviation zones detected', async () => {
      const polyline: [number, number][] = [
        [59.33, 18.03],
        [59.33, 18.05],
      ];

      // Create a run that deviates significantly from the route
      const completedRun = {
        id: 'run-002',
        positions: deviatingTrace(
          59.33, 18.03,
          59.33, 18.05,
          59.335, 18.042, // deviation point ~500m off route
          80
        ),
        distance: 1500,
        routeId: 'route-001',
        routePolyline: polyline,
        routeDistance: 1300,
      } as any;

      const analysis = computeRunAnalysis(completedRun);
      expect(analysis).not.toBeNull();
      expect(analysis!.deviationZones.length).toBeGreaterThan(0);
    });

    it('buildPromptFeedback returns non-empty after 2+ deviating runs', async () => {
      // Setup: two analyses with similar deviation zones in storage
      const sharedZone = {
        startCoord: [59.335, 18.042] as [number, number],
        endCoord: [59.336, 18.043] as [number, number],
        maxDeviation: 150,
        length: 200,
      };

      store['run_analysis'] = [
        {
          id: 'ra-1',
          runId: 'r1',
          routeId: 'rt1',
          adherence: 75,
          deviationZones: [sharedZone],
          completion: 0.9,
          computedAt: '2026-03-30T10:00:00Z',
        },
        {
          id: 'ra-2',
          runId: 'r2',
          routeId: 'rt1',
          adherence: 72,
          deviationZones: [
            {
              ...sharedZone,
              startCoord: [59.3351, 18.0421] as [number, number],
            },
          ],
          completion: 0.88,
          computedAt: '2026-03-31T10:00:00Z',
        },
      ];
      store['routes'] = [];

      const feedback = await buildPromptFeedback(59.33, 18.03);
      expect(feedback).not.toBe('');
      expect(feedback).toContain('HISTORICAL FEEDBACK');
      expect(feedback).toContain('Avoid area near');
    });
  });
  ```
  Run: `npx vitest run src/lib/__tests__/feedback-integration.test.ts` — expect pass.

- [ ] **7.2** Run full test suite: `npx vitest run` — all tests should pass.

- [ ] **7.3** Commit: `git commit -m "test(feedback-loop): integration test for full feedback pipeline"`
