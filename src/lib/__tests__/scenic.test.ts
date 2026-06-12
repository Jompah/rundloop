import { describe, it, expect } from 'vitest';
import {
  scenicScore,
  findScenicAnchor,
  buildCorridorWaypoints,
  describeAnchor,
  haversineM,
  ScenicFeature,
} from '../scenic';

// Rimini-like setup: start near the beach, straight north-south coastline
// ~200 m east of the start.
const START_LAT = 44.06;
const START_LNG = 12.57;

// 200 m east at lat 44.06 ≈ 0.0025 degrees of longitude.
const COAST_LNG = 12.5725;

/** Straight N-S coastline from lat 44.03 to 44.09 (~6.7 km), vertices ~55 m apart. */
function makeCoastline(): ScenicFeature {
  const points: [number, number][] = [];
  for (let lat = 44.03; lat <= 44.09 + 1e-9; lat += 0.0005) {
    points.push([Number(lat.toFixed(6)), COAST_LNG]);
  }
  return { id: 'way/123', type: 'coastline', name: 'Lungomare', points };
}

describe('findScenicAnchor', () => {
  it('finds the coastline ~200 m east of the start', () => {
    const anchor = findScenicAnchor(START_LAT, START_LNG, [makeCoastline()]);
    expect(anchor).not.toBeNull();
    expect(anchor!.distanceM).toBeGreaterThan(160);
    expect(anchor!.distanceM).toBeLessThan(240);
    // Due east
    expect(anchor!.bearingDeg).toBeGreaterThan(70);
    expect(anchor!.bearingDeg).toBeLessThan(110);
    // Coastline runs north-south → orientation ~0 (normalized 0-180)
    const orientation = anchor!.orientationDeg;
    const distToNS = Math.min(orientation, Math.abs(180 - orientation));
    expect(distToNS).toBeLessThanOrEqual(20);
    expect(anchor!.feature.id).toBe('way/123');
  });

  it('ignores non-water features', () => {
    const park: ScenicFeature = {
      id: 'way/9',
      type: 'park',
      points: [[START_LAT, START_LNG + 0.001]],
    };
    expect(findScenicAnchor(START_LAT, START_LNG, [park])).toBeNull();
  });

  it('returns null when nothing is within maxDistanceM', () => {
    const farWater: ScenicFeature = {
      id: 'way/10',
      type: 'waterway',
      points: [[START_LAT + 0.1, START_LNG]], // ~11 km away
    };
    expect(findScenicAnchor(START_LAT, START_LNG, [farWater])).toBeNull();
  });

  it('skips tiny water features (fountains) in favor of a farther coastline', () => {
    // Fountain-sized 'water' feature ~10 m from the start, bbox ~20 m.
    const fountain: ScenicFeature = {
      id: 'way/20',
      type: 'water',
      name: 'Sergelfontänen',
      points: [
        [START_LAT, START_LNG + 0.0001],
        [START_LAT + 0.0001, START_LNG + 0.0002],
        [START_LAT + 0.00015, START_LNG + 0.0001],
      ],
    };
    const anchor = findScenicAnchor(START_LAT, START_LNG, [
      fountain,
      makeCoastline(),
    ]);
    expect(anchor).not.toBeNull();
    expect(anchor!.feature.id).toBe('way/123'); // coastline, not the fountain
    expect(anchor!.distanceM).toBeGreaterThan(160);
  });

  it('accepts water features with large extent (>150 m) as anchor', () => {
    // N-S lake shore ~220 m long, ~40 m east of the start.
    const points: [number, number][] = [];
    for (let lat = START_LAT - 0.001; lat <= START_LAT + 0.001 + 1e-9; lat += 0.0005) {
      points.push([Number(lat.toFixed(6)), START_LNG + 0.0005]);
    }
    const lake: ScenicFeature = { id: 'way/21', type: 'water', points };
    const anchor = findScenicAnchor(START_LAT, START_LNG, [lake]);
    expect(anchor).not.toBeNull();
    expect(anchor!.feature.id).toBe('way/21');
    expect(anchor!.distanceM).toBeLessThan(80);
  });

  it('prefers a long coastline farther away over a short fragment nearby', () => {
    // Short coastline fragment (~50 m, 3 vertices) ~300 m east of the start.
    const shortFragment: ScenicFeature = {
      id: 'way/30',
      type: 'coastline',
      points: [
        [START_LAT, START_LNG + 0.00375],
        [START_LAT + 0.00022, START_LNG + 0.00375],
        [START_LAT + 0.00045, START_LNG + 0.00375],
      ],
    };
    // Long coastline (~1 km N-S) ~800 m east of the start.
    const longPoints: [number, number][] = [];
    for (let lat = START_LAT - 0.0045; lat <= START_LAT + 0.0045 + 1e-9; lat += 0.0005) {
      longPoints.push([Number(lat.toFixed(6)), START_LNG + 0.01]);
    }
    const longCoast: ScenicFeature = {
      id: 'way/31',
      type: 'coastline',
      points: longPoints,
    };

    const anchor = findScenicAnchor(START_LAT, START_LNG, [
      shortFragment,
      longCoast,
    ]);
    expect(anchor).not.toBeNull();
    expect(anchor!.feature.id).toBe('way/31'); // the long one, despite being farther
    expect(anchor!.distanceM).toBeGreaterThan(600);
    expect(anchor!.distanceM).toBeLessThan(1000);
  });

  it('falls back to the nearest short fragment when no long feature is in reach', () => {
    // Two short coastline fragments (extent < 400 m), nothing longer around.
    const near: ScenicFeature = {
      id: 'way/40',
      type: 'coastline',
      points: [
        [START_LAT, START_LNG + 0.00375],
        [START_LAT + 0.00045, START_LNG + 0.00375],
      ],
    };
    const far: ScenicFeature = {
      id: 'way/41',
      type: 'coastline',
      points: [
        [START_LAT, START_LNG + 0.0075],
        [START_LAT + 0.00045, START_LNG + 0.0075],
      ],
    };
    const anchor = findScenicAnchor(START_LAT, START_LNG, [far, near]);
    expect(anchor).not.toBeNull();
    expect(anchor!.feature.id).toBe('way/40'); // nearest fragment, not null
    expect(anchor!.distanceM).toBeLessThan(400);
  });
});

describe('buildCorridorWaypoints', () => {
  it('starts and ends at the start point', () => {
    const anchor = findScenicAnchor(START_LAT, START_LNG, [makeCoastline()])!;
    const wps = buildCorridorWaypoints(START_LAT, START_LNG, anchor, 5);

    expect(wps.length).toBeGreaterThanOrEqual(3);
    expect(wps[0].lat).toBeCloseTo(START_LAT, 10);
    expect(wps[0].lng).toBeCloseTo(START_LNG, 10);
    expect(wps[wps.length - 1].lat).toBeCloseTo(START_LAT, 10);
    expect(wps[wps.length - 1].lng).toBeCloseTo(START_LNG, 10);
  });

  it('keeps intermediate waypoints close to the coastline', () => {
    const coast = makeCoastline();
    const anchor = findScenicAnchor(START_LAT, START_LNG, [coast])!;
    const wps = buildCorridorWaypoints(START_LAT, START_LNG, anchor, 5);

    const intermediate = wps.slice(1, -1);
    expect(intermediate.length).toBeGreaterThan(0);
    for (const wp of intermediate) {
      // Min distance to any coastline vertex (vertices are ~55 m apart so
      // vertex granularity adds at most ~28 m).
      let min = Infinity;
      for (const [lat, lng] of coast.points) {
        min = Math.min(min, haversineM(wp.lat, wp.lng, lat, lng));
      }
      expect(min).toBeLessThanOrEqual(80);
    }
  });

  it('produces a plausible total path length for a 5 km run', () => {
    const anchor = findScenicAnchor(START_LAT, START_LNG, [makeCoastline()])!;
    const wps = buildCorridorWaypoints(START_LAT, START_LNG, anchor, 5);

    let total = 0;
    for (let i = 0; i < wps.length - 1; i++) {
      total += haversineM(wps[i].lat, wps[i].lng, wps[i + 1].lat, wps[i + 1].lng);
    }
    // Straight-line waypoint length; OSRM adds street detours on top.
    expect(total).toBeGreaterThan(2500);
    expect(total).toBeLessThan(6000);
  });
});

describe('scenicScore', () => {
  it('scores a coast-hugging polyline high', () => {
    const coast = makeCoastline();
    // Polyline (GeoJSON [lng, lat]) running right along the coastline,
    // ~30 m inland, for ~2.2 km.
    const polyline: [number, number][] = [];
    for (let lat = 44.05; lat <= 44.07 + 1e-9; lat += 0.001) {
      polyline.push([COAST_LNG - 0.0004, Number(lat.toFixed(6))]);
    }
    expect(scenicScore(polyline, [coast])).toBeGreaterThanOrEqual(0.85);
  });

  it('scores an inland polyline low', () => {
    const coast = makeCoastline();
    // Same shape but ~1 km further inland (west).
    const polyline: [number, number][] = [];
    for (let lat = 44.05; lat <= 44.07 + 1e-9; lat += 0.001) {
      polyline.push([COAST_LNG - 0.0125, Number(lat.toFixed(6))]);
    }
    expect(scenicScore(polyline, [coast])).toBeLessThanOrEqual(0.15);
  });

  it('returns 0 for empty features or empty polyline', () => {
    const coast = makeCoastline();
    expect(scenicScore([], [coast])).toBe(0);
    expect(scenicScore([[12.57, 44.06]], [])).toBe(0);
  });

  it('counts landmarks within 120 m regardless of thresholdM', () => {
    const landmark: ScenicFeature = {
      id: 'node/1',
      type: 'landmark',
      name: 'Arco di Augusto',
      points: [[44.0590, 12.5710]],
    };
    // Single-point polyline ~110 m south of the landmark.
    const near: [number, number][] = [[12.571, 44.058]];
    expect(scenicScore(near, [landmark], 10)).toBe(1);
  });
});

describe('describeAnchor', () => {
  it('mentions distance and compass direction', () => {
    const anchor = findScenicAnchor(START_LAT, START_LNG, [makeCoastline()])!;
    const text = describeAnchor(anchor);

    expect(text).toContain('VERIFIED GEOGRAPHY');
    expect(text).toContain('coastline');
    // Distance ~200 m
    expect(text).toMatch(/\b(19\d|20\d|21\d) m\b/);
    // Compass direction east of the start
    expect(text).toMatch(/\bm E of the start\b/);
    // N-S oriented coastline
    expect(text).toContain('N-S');
  });
});
