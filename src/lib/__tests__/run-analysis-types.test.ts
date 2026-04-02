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
