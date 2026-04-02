import { describe, it, expect } from 'vitest';
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
    speed: null,
    heading: null,
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
      trace: straightTrace(59.33, 18.03, 59.33, 18.05, 20),
      distanceMeters: 1300,
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
      trace: straightTrace(59.33, 18.03, 59.33, 18.05, 50),
      distanceMeters: 1300,
      routeId: 'route-001',
      routePolyline: polyline,
    } as any;
    const result = computeRunAnalysis(run);
    expect(result).not.toBeNull();
    expect(result!.runId).toBe('run-001');
    expect(result!.routeId).toBe('route-001');
    expect(result!.adherence).toBeGreaterThan(90);
    expect(result!.completion).toBeGreaterThan(0.8);
  });
});
