import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPromptFeedback } from '../prompt-feedback';

// Mock dependencies
vi.mock('../run-analysis', () => ({
  getAnalysesNear: vi.fn(),
}));

vi.mock('../storage', () => ({
  getSavedRoutes: vi.fn(),
  haversineMeters: vi.fn((lat1: number, lng1: number, lat2: number, lng2: number) => {
    // Real haversine approximation for test purposes
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }),
}));

import { getAnalysesNear } from '../run-analysis';
import { getSavedRoutes } from '../storage';

const mockGetAnalysesNear = vi.mocked(getAnalysesNear);
const mockGetSavedRoutes = vi.mocked(getSavedRoutes);

const START_LAT = 59.335;
const START_LNG = 18.042;

function makeAnalysis(
  id: string,
  deviationZones: { startCoord: [number, number]; endCoord: [number, number] }[]
) {
  return {
    id,
    runId: `run-${id}`,
    routeId: `route-${id}`,
    adherence: 80,
    deviationZones: deviationZones.map((z) => ({
      ...z,
      maxDeviation: 150,
      length: 200,
    })),
    completion: 0.9,
    computedAt: new Date().toISOString(),
  };
}

function makeRoute(
  id: string,
  verified: boolean,
  startLat: number,
  startLng: number
) {
  return {
    id,
    route: {
      waypoints: [
        { lat: startLat, lng: startLng },
        { lat: startLat + 0.01, lng: startLng + 0.01 },
      ],
      distance: 5000,
      polyline: [],
    },
    city: 'Stockholm',
    createdAt: new Date().toISOString(),
    verified,
    timesRun: 3,
    avgAdherence: 92,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildPromptFeedback', () => {
  it('returns empty string when no analyses nearby', async () => {
    mockGetAnalysesNear.mockResolvedValue([]);
    mockGetSavedRoutes.mockResolvedValue([]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toBe('');
  });

  it('returns empty string when analyses have no deviation zones', async () => {
    mockGetAnalysesNear.mockResolvedValue([
      makeAnalysis('a1', []),
      makeAnalysis('a2', []),
    ]);
    mockGetSavedRoutes.mockResolvedValue([]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toBe('');
  });

  it('returns deviation warning when 2+ analyses share a deviation zone within 100m', async () => {
    // Two analyses, each with a deviation zone at nearly the same coord
    const sharedCoord: [number, number] = [59.335, 18.042];
    const nearbyCoord: [number, number] = [59.3351, 18.0421]; // ~14m away

    mockGetAnalysesNear.mockResolvedValue([
      makeAnalysis('a1', [{ startCoord: sharedCoord, endCoord: [59.336, 18.043] }]),
      makeAnalysis('a2', [{ startCoord: nearbyCoord, endCoord: [59.336, 18.043] }]),
    ]);
    mockGetSavedRoutes.mockResolvedValue([]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toContain('HISTORICAL FEEDBACK');
    expect(result).toContain('Avoid area near');
    expect(result).toContain('runners consistently deviate here');
  });

  it('does not flag deviation when zones come from the same analysis', async () => {
    const coord: [number, number] = [59.335, 18.042];
    const nearbyCoord: [number, number] = [59.3351, 18.0421];

    // Both zones are from the same analysis — should NOT be flagged as systematic
    mockGetAnalysesNear.mockResolvedValue([
      makeAnalysis('a1', [
        { startCoord: coord, endCoord: [59.336, 18.043] },
        { startCoord: nearbyCoord, endCoord: [59.336, 18.043] },
      ]),
    ]);
    mockGetSavedRoutes.mockResolvedValue([]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toBe('');
  });

  it('returns preferred path when verified route exists nearby', async () => {
    mockGetAnalysesNear.mockResolvedValue([]);
    mockGetSavedRoutes.mockResolvedValue([
      makeRoute('r1', true, START_LAT, START_LNG), // verified, at start
    ]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toContain('HISTORICAL FEEDBACK');
    expect(result).toContain('Preferred path');
    expect(result).toContain('high adherence verified route');
  });

  it('does not include non-verified routes', async () => {
    mockGetAnalysesNear.mockResolvedValue([]);
    mockGetSavedRoutes.mockResolvedValue([
      makeRoute('r1', false, START_LAT, START_LNG), // not verified
    ]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toBe('');
  });

  it('does not include verified routes that are far away (>1km)', async () => {
    mockGetAnalysesNear.mockResolvedValue([]);
    // ~5 km north
    mockGetSavedRoutes.mockResolvedValue([
      makeRoute('r1', true, START_LAT + 0.045, START_LNG),
    ]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toBe('');
  });

  it('caps feedback at 5 points', async () => {
    // Create 4 systematic deviation pairs (each pair from 2 different analyses)
    const analyses = [];
    for (let i = 0; i < 4; i++) {
      const lat = 59.335 + i * 0.0001;
      const coord: [number, number] = [lat, 18.042];
      const nearCoord: [number, number] = [lat + 0.00001, 18.042];
      analyses.push(makeAnalysis(`a${i * 2}`, [{ startCoord: coord, endCoord: [59.34, 18.05] }]));
      analyses.push(makeAnalysis(`a${i * 2 + 1}`, [{ startCoord: nearCoord, endCoord: [59.34, 18.05] }]));
    }
    mockGetAnalysesNear.mockResolvedValue(analyses);

    // Also add 3 verified routes
    mockGetSavedRoutes.mockResolvedValue([
      makeRoute('r1', true, START_LAT, START_LNG),
      makeRoute('r2', true, START_LAT, START_LNG),
      makeRoute('r3', true, START_LAT, START_LNG),
    ]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    const lines = result
      .split('\n')
      .filter((l) => l.startsWith('- '));
    expect(lines.length).toBeLessThanOrEqual(5);
  });

  it('includes both deviation warnings and preferred paths in one response', async () => {
    const coord: [number, number] = [59.335, 18.042];
    const nearCoord: [number, number] = [59.3351, 18.0421];

    mockGetAnalysesNear.mockResolvedValue([
      makeAnalysis('a1', [{ startCoord: coord, endCoord: [59.336, 18.043] }]),
      makeAnalysis('a2', [{ startCoord: nearCoord, endCoord: [59.336, 18.043] }]),
    ]);
    mockGetSavedRoutes.mockResolvedValue([
      makeRoute('r1', true, START_LAT, START_LNG),
    ]);

    const result = await buildPromptFeedback(START_LAT, START_LNG);
    expect(result).toContain('Avoid area near');
    expect(result).toContain('Preferred path');
  });
});
