import { describe, it, expect } from 'vitest';
import { pickBestRing, buildPerimeterWaypoints, buildBridgeLoopPlans } from '../perimeter';
import { haversineM } from '../scenic';
import type { BridgeCrossing, PerimeterRing } from '../ring-assembly';

// Stockholm-like coordinates.
const BASE_LAT = 59.33;
const BASE_LNG = 18.05;

const M_PER_DEG = (Math.PI * 6371000) / 180; // ~111194.9
const M_PER_DEG_LNG = M_PER_DEG * Math.cos(BASE_LAT * (Math.PI / 180));

/** Convert local meters (x east, y north) relative to BASE to lat/lng. */
function toLatLng(xM: number, yM: number): { lat: number; lng: number } {
  return { lat: BASE_LAT + yM / M_PER_DEG, lng: BASE_LNG + xM / M_PER_DEG_LNG };
}

function makeRing(overrides: Partial<PerimeterRing>): PerimeterRing {
  return {
    kind: 'island',
    name: 'Testholmen',
    perimeterKm: 10,
    distanceM: 200,
    outline: [],
    ...overrides,
  };
}

/** Circular outline: `points` vertices at `radiusM` around local (cxM, cyM). */
function circleOutline(
  cxM: number,
  cyM: number,
  radiusM: number,
  points: number
): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < points; i++) {
    const theta = (2 * Math.PI * i) / points;
    out.push(
      toLatLng(cxM + radiusM * Math.cos(theta), cyM + radiusM * Math.sin(theta))
    );
  }
  return out;
}

/**
 * Rectangular outline (w × h meters, corner at local origin), vertices evenly
 * spaced along the perimeter.
 */
function rectOutline(
  wM: number,
  hM: number,
  points: number
): { lat: number; lng: number }[] {
  const perimeter = 2 * (wM + hM);
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < points; i++) {
    let s = (perimeter * i) / points;
    if (s < wM) {
      out.push(toLatLng(s, 0));
    } else if (s < wM + hM) {
      out.push(toLatLng(wM, s - wM));
    } else if (s < 2 * wM + hM) {
      out.push(toLatLng(wM - (s - wM - hM), hM));
    } else {
      out.push(toLatLng(0, hM - (s - 2 * wM - hM)));
    }
  }
  return out;
}

function pathLengthM(wps: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    total += haversineM(wps[i].lat, wps[i].lng, wps[i + 1].lat, wps[i + 1].lng);
  }
  return total;
}

describe('pickBestRing', () => {
  it('picks the ring whose predicted distance is nearest the target', () => {
    // Target 10 km. A: 9*1.05 + 0.6 = 10.05 km. B: 7.6*1.05 + 0.6 = 8.58 km.
    const a = makeRing({ name: 'A', perimeterKm: 9, distanceM: 300 });
    const b = makeRing({ name: 'B', perimeterKm: 7.6, distanceM: 300 });
    expect(pickBestRing([b, a], 10)?.name).toBe('A');
  });

  it('rejects rings with too large a perimeter', () => {
    // 20*1.05 + 0.4 = 21.4 km > 1.2 * 10.
    const huge = makeRing({ perimeterKm: 20, distanceM: 200 });
    expect(pickBestRing([huge], 10)).toBeNull();
  });

  it('rejects rings with too small a perimeter', () => {
    // 5*1.05 + 0.2 = 5.45 km < 0.8 * 10.
    const tiny = makeRing({ perimeterKm: 5, distanceM: 100 });
    expect(pickBestRing([tiny], 10)).toBeNull();
  });

  it('rejects rings farther than 1200 m away even if the distance fits', () => {
    // 6.5*1.05 + 3.0 = 9.825 km — inside the window, but 1500 m > 1200 m.
    const far = makeRing({ perimeterKm: 6.5, distanceM: 1500 });
    expect(pickBestRing([far], 10)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickBestRing([], 10)).toBeNull();
  });

  it('breaks ties on predicted distance via the connection penalty', () => {
    // Both predict exactly 10 km; B has the shorter connection and must win.
    const a = makeRing({ name: 'A', perimeterKm: 8 / 1.05, distanceM: 1000 });
    const b = makeRing({ name: 'B', perimeterKm: 9.6 / 1.05, distanceM: 200 });
    expect(pickBestRing([a, b], 10)?.name).toBe('B');
    expect(pickBestRing([b, a], 10)?.name).toBe('B');
  });
});

describe('buildPerimeterWaypoints', () => {
  // Circle ~1 km radius (circumference ~6.28 km), 40 vertices, centered on
  // local origin. User 150 m outside the vertex at angle of index 7.
  const CIRCLE = circleOutline(0, 0, 1000, 40);
  const circleRing = makeRing({
    perimeterKm: 6.28,
    distanceM: 150,
    outline: CIRCLE,
  });
  const theta7 = (2 * Math.PI * 7) / 40;
  const outside7 = toLatLng(1150 * Math.cos(theta7), 1150 * Math.sin(theta7));

  it('starts and ends at the start point', () => {
    const wps = buildPerimeterWaypoints(circleRing, outside7.lat, outside7.lng);
    expect(wps.length).toBeGreaterThanOrEqual(3);
    expect(wps[0].lat).toBeCloseTo(outside7.lat, 10);
    expect(wps[0].lng).toBeCloseTo(outside7.lng, 10);
    expect(wps[wps.length - 1].lat).toBeCloseTo(outside7.lat, 10);
    expect(wps[wps.length - 1].lng).toBeCloseTo(outside7.lng, 10);
  });

  it('rotates the ring so the nearest outline point comes first', () => {
    const wps = buildPerimeterWaypoints(circleRing, outside7.lat, outside7.lng);
    expect(wps[1].lat).toBeCloseTo(CIRCLE[7].lat, 9);
    expect(wps[1].lng).toBeCloseTo(CIRCLE[7].lng, 9);
  });

  it('labels the first ring point with the ring name', () => {
    const wps = buildPerimeterWaypoints(circleRing, outside7.lat, outside7.lng);
    expect(wps[1].label).toBe('Testholmen');
  });

  it('distributes ring points evenly along the arc length', () => {
    const wps = buildPerimeterWaypoints(circleRing, outside7.lat, outside7.lng);
    const ringPts = wps.slice(1, -1);
    expect(ringPts.length).toBe(14);

    const gaps: number[] = [];
    for (let i = 0; i < ringPts.length - 1; i++) {
      gaps.push(
        haversineM(
          ringPts[i].lat,
          ringPts[i].lng,
          ringPts[i + 1].lat,
          ringPts[i + 1].lng
        )
      );
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const gap of gaps) {
      expect(Math.abs(gap - mean) / mean).toBeLessThan(0.15);
    }
  });

  it('does not let the last sampled point coincide with the first', () => {
    const wps = buildPerimeterWaypoints(circleRing, outside7.lat, outside7.lng);
    const first = wps[1];
    const last = wps[wps.length - 2];
    // One even spacing (~450 m on this circle) should separate them.
    expect(haversineM(first.lat, first.lng, last.lat, last.lng)).toBeGreaterThan(
      100
    );
  });

  it('respects maxIntermediates', () => {
    const dense = makeRing({
      perimeterKm: 6.28,
      distanceM: 150,
      outline: circleOutline(0, 0, 1000, 80),
    });
    const def = buildPerimeterWaypoints(dense, outside7.lat, outside7.lng);
    expect(def.length - 2).toBeLessThanOrEqual(14);

    const five = buildPerimeterWaypoints(dense, outside7.lat, outside7.lng, 5);
    expect(five.length - 2).toBe(5);
  });

  it('handles an outline with fewer points than maxIntermediates', () => {
    const square = makeRing({
      perimeterKm: 4,
      distanceM: 100,
      outline: [
        toLatLng(0, 0),
        toLatLng(1000, 0),
        toLatLng(1000, 1000),
        toLatLng(0, 1000),
      ],
    });
    const start = toLatLng(500, -100);
    const wps = buildPerimeterWaypoints(square, start.lat, start.lng);
    // 4 ring points + start/finish.
    expect(wps.length).toBe(6);
    for (const wp of wps) {
      expect(Number.isFinite(wp.lat)).toBe(true);
      expect(Number.isFinite(wp.lng)).toBe(true);
    }
  });

  it('handles a start lying on the outline itself (distanceM ≈ 0)', () => {
    const onRing = CIRCLE[7];
    const wps = buildPerimeterWaypoints(circleRing, onRing.lat, onRing.lng);
    expect(wps[0].lat).toBeCloseTo(onRing.lat, 10);
    expect(wps[1].lat).toBeCloseTo(onRing.lat, 10);
    expect(wps[1].lng).toBeCloseTo(onRing.lng, 10);
    expect(wps[wps.length - 1].lng).toBeCloseTo(onRing.lng, 10);
    expect(wps.length).toBe(2 + 14);
  });
});

describe('perimeter loop end to end', () => {
  it('picks a ~10 km island and builds plausible waypoints around it', () => {
    // Rectangular "island" 3 km × 2 km → 10 km perimeter, 80 outline points.
    const outline = rectOutline(3000, 2000, 80);
    let perimeterM = 0;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      perimeterM += haversineM(a.lat, a.lng, b.lat, b.lng);
    }
    // User 200 m south of the midpoint of the southern shore.
    const start = toLatLng(1500, -200);
    const island = makeRing({
      name: 'Kungsholmen',
      perimeterKm: perimeterM / 1000,
      distanceM: 200,
      outline,
    });

    const picked = pickBestRing([island], 10);
    expect(picked).toBe(island);

    const wps = buildPerimeterWaypoints(island, start.lat, start.lng);
    expect(wps.length).toBe(2 + 14);

    // Every ring waypoint sits on the rectangle outline (within vertex
    // granularity, vertices ~125 m apart).
    for (const wp of wps.slice(1, -1)) {
      let min = Infinity;
      for (const p of outline) {
        min = Math.min(min, haversineM(wp.lat, wp.lng, p.lat, p.lng));
      }
      expect(min).toBeLessThanOrEqual(70);
    }

    // Straight-line waypoint length ≈ perimeter plus connections; the road
    // network adds detours on top.
    const total = pathLengthM(wps);
    expect(total).toBeGreaterThan(9000);
    expect(total).toBeLessThan(11500);
  });
});

describe('buildBridgeLoopPlans', () => {
  // Synthetic east-west river: near shore at local y=0, far shore at y=300.
  // Bridges run straight north across the water at various x positions.
  // The user stands 100 m south of the near shore at x=0.
  const START = toLatLng(0, -100);

  /** Bridge crossing at local x, spanning the 300 m river straight north. */
  function makeBridge(name: string | null, xM: number): BridgeCrossing {
    const near = toLatLng(xM, 0);
    const far = toLatLng(xM, 300);
    return {
      name,
      nearEnd: near,
      farEnd: far,
      lengthM: 300,
      distanceM: haversineM(START.lat, START.lng, near.lat, near.lng),
    };
  }

  it('returns [] for empty input and for a single bridge', () => {
    expect(buildBridgeLoopPlans([], START.lat, START.lng, 5)).toEqual([]);
    expect(
      buildBridgeLoopPlans([makeBridge('Solo', 0)], START.lat, START.lng, 5)
    ).toEqual([]);
  });

  it('picks the pair whose predicted loop best matches the target distance', () => {
    // Straight-line loops (before ×1.2): A–B ≈ 100+300+1000+300+1005 ≈ 2.7 km
    // → predicted ≈ 3.25 km; A–C ≈ 5.6 km; B–C ≈ 5.5 km.
    const a = makeBridge('A', 0);
    const b = makeBridge('B', 1000);
    const c = makeBridge('C', 2000);

    const short = buildBridgeLoopPlans([a, b, c], START.lat, START.lng, 3, 1);
    expect(short).toHaveLength(1);
    expect(short[0].label).toBe('A ↔ B');
    expect(short[0].predictedKm).toBeGreaterThan(3 * 0.75);
    expect(short[0].predictedKm).toBeLessThan(3 * 1.25);

    // For a 5.5 km target the B–C loop (~5.5 km) beats A–C (~5.6 km).
    const long = buildBridgeLoopPlans([a, b, c], START.lat, START.lng, 5.5, 1);
    expect(long).toHaveLength(1);
    expect(long[0].label).toBe('B ↔ C');
  });

  it('gates out pairs whose predicted loop is far from the target', () => {
    const a = makeBridge('A', 0);
    const b = makeBridge('B', 1000);
    // Only pair predicts ~3.25 km — far outside [0.75, 1.25] × 10 km.
    expect(buildBridgeLoopPlans([a, b], START.lat, START.lng, 10)).toEqual([]);
  });

  it('skips pairs that are effectively the same crossing (< 300 m apart)', () => {
    // Two parallel walkways of the same bridge, 100 m apart.
    const a = makeBridge('Bron (east way)', 0);
    const b = makeBridge('Bron (west way)', 100);
    expect(buildBridgeLoopPlans([a, b], START.lat, START.lng, 1)).toEqual([]);
  });

  it('orders waypoints start → A.near → A.far → farBankMid → B.far → B.near → start', () => {
    const a = makeBridge('A', 0);
    const b = makeBridge('B', 1000);
    const plans = buildBridgeLoopPlans([a, b], START.lat, START.lng, 3.2);
    expect(plans).toHaveLength(1);

    const wps = plans[0].waypoints;
    expect(wps).toHaveLength(7);
    const expected = [
      START,
      a.nearEnd,
      a.farEnd,
      {
        lat: (a.farEnd.lat + b.farEnd.lat) / 2,
        lng: (a.farEnd.lng + b.farEnd.lng) / 2,
      },
      b.farEnd,
      b.nearEnd,
      START,
    ];
    for (let i = 0; i < expected.length; i++) {
      expect(wps[i].lat).toBeCloseTo(expected[i].lat, 10);
      expect(wps[i].lng).toBeCloseTo(expected[i].lng, 10);
    }
    expect(wps[0].label).toBe('Start');
    expect(wps[6].label).toBe('Finish');
  });

  it('returns at most maxPlans plans, best match first', () => {
    const bridges = [
      makeBridge('A', 0),
      makeBridge('B', 1000),
      makeBridge('C', 1400),
      makeBridge('D', 1800),
    ];
    const plans = buildBridgeLoopPlans(bridges, START.lat, START.lng, 4);
    expect(plans.length).toBeLessThanOrEqual(2);
    expect(plans.length).toBeGreaterThan(0);
    const diffs = plans.map((p) => Math.abs(p.predictedKm - 4));
    for (let i = 1; i < diffs.length; i++) {
      expect(diffs[i]).toBeGreaterThanOrEqual(diffs[i - 1]);
    }
  });
});
