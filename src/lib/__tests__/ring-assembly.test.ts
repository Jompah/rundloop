import { describe, it, expect } from 'vitest';
import {
  stitchRings,
  ringPerimeterKm,
  offsetRing,
  downsampleRing,
  touchesBbox,
  largestRing,
  nearestDistanceM,
  haversineKm,
  centroid,
  LatLng,
} from '../ring-assembly';

// Square at the equator with 0.004° sides (~444.8 m per side, ~1.78 km around).
const A: LatLng = { lat: 0, lng: 0 };
const B: LatLng = { lat: 0.004, lng: 0 };
const C: LatLng = { lat: 0.004, lng: 0.004 };
const D: LatLng = { lat: 0, lng: 0.004 };
const SQUARE: LatLng[] = [A, B, C, D];

/** Circle of `n` points with radius `radiusDeg` around a center. */
function makeCircle(n: number, radiusDeg = 0.01, center: LatLng = { lat: 0, lng: 0 }): LatLng[] {
  const ring: LatLng[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    ring.push({
      lat: center.lat + radiusDeg * Math.sin(angle),
      lng: center.lng + radiusDeg * Math.cos(angle),
    });
  }
  return ring;
}

describe('stitchRings', () => {
  it('stitches two ways sharing endpoints into one ring', () => {
    const way1 = [A, B, C];
    const way2 = [C, D, A];
    const rings = stitchRings([way1, way2]);

    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4); // A B C D, closing point dropped
    // Not closed: first != last
    const first = rings[0][0];
    const last = rings[0][rings[0].length - 1];
    expect(first.lat === last.lat && first.lng === last.lng).toBe(false);
  });

  it('handles unordered and reversed ways', () => {
    const way1 = [A, B, C];
    const way2Reversed = [A, D, C]; // same edge C-D-A but traversed backwards
    const rings = stitchRings([way2Reversed, way1]);

    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    // All four corners present exactly once
    for (const corner of SQUARE) {
      const hits = rings[0].filter(
        p => Math.abs(p.lat - corner.lat) < 1e-9 && Math.abs(p.lng - corner.lng) < 1e-9
      );
      expect(hits).toHaveLength(1);
    }
  });

  it('passes an already-closed way through as one ring', () => {
    const closed = [...SQUARE, A]; // first == last
    const rings = stitchRings([closed]);

    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
  });

  it('discards open chains that cannot be closed', () => {
    const openWay = [A, B, C]; // nothing to close it with
    expect(stitchRings([openWay])).toHaveLength(0);
  });

  it('assembles multiple disjoint rings (relation with several outers)', () => {
    const far = { lat: 1, lng: 1 };
    const square2 = SQUARE.map(p => ({ lat: p.lat + far.lat, lng: p.lng + far.lng }));
    const rings = stitchRings([
      [SQUARE[0], SQUARE[1], SQUARE[2]],
      [SQUARE[2], SQUARE[3], SQUARE[0]],
      [square2[0], square2[1], square2[2]],
      [square2[2], square2[3], square2[0]],
    ]);

    expect(rings).toHaveLength(2);
  });

  it('matches endpoints within tolerance', () => {
    const jitter = 5e-7; // below the 1e-6 default tolerance
    const way1 = [A, B, C];
    const way2 = [{ lat: C.lat + jitter, lng: C.lng - jitter }, D, { lat: A.lat - jitter, lng: A.lng + jitter }];
    expect(stitchRings([way1, way2])).toHaveLength(1);
  });
});

describe('ringPerimeterKm', () => {
  it('computes ~1.78 km for a 444.8 m-sided square at the equator', () => {
    // 0.004° at the equator ≈ 0.004 × 111.195 km ≈ 444.8 m per side.
    const perimeter = ringPerimeterKm(SQUARE);
    expect(perimeter).toBeGreaterThan(1.75);
    expect(perimeter).toBeLessThan(1.81);
  });

  it('includes the closing segment last -> first', () => {
    // Open path A-B-C-D is 3 sides; the ring perimeter must add the 4th.
    let openLength = 0;
    for (let i = 0; i < SQUARE.length - 1; i++) {
      openLength += haversineKm(SQUARE[i], SQUARE[i + 1]);
    }
    expect(ringPerimeterKm(SQUARE)).toBeGreaterThan(openLength * 1.3);
  });

  it('returns 0 for degenerate input', () => {
    expect(ringPerimeterKm([])).toBe(0);
    expect(ringPerimeterKm([A])).toBe(0);
  });
});

describe('offsetRing', () => {
  it('moves points ~30 m toward the centroid when inward', () => {
    const cent = centroid(SQUARE);
    const offset = offsetRing(SQUARE, 30, 'inward');

    for (let i = 0; i < SQUARE.length; i++) {
      const before = haversineKm(SQUARE[i], cent) * 1000;
      const after = haversineKm(offset[i], cent) * 1000;
      expect(before - after).toBeGreaterThan(25);
      expect(before - after).toBeLessThan(35);
    }
  });

  it('moves points ~30 m away from the centroid when outward', () => {
    const cent = centroid(SQUARE);
    const offset = offsetRing(SQUARE, 30, 'outward');

    for (let i = 0; i < SQUARE.length; i++) {
      const before = haversineKm(SQUARE[i], cent) * 1000;
      const after = haversineKm(offset[i], cent) * 1000;
      expect(after - before).toBeGreaterThan(25);
      expect(after - before).toBeLessThan(35);
    }
  });

  it('leaves points closer to the centroid than the offset untouched (inward)', () => {
    const tiny = makeCircle(8, 0.0001); // ~11 m radius
    const offset = offsetRing(tiny, 30, 'inward');
    expect(offset).toEqual(tiny);
  });
});

describe('downsampleRing', () => {
  it('returns the ring unchanged when already within budget', () => {
    const ring = makeCircle(50);
    expect(downsampleRing(ring, 80)).toEqual(ring);
  });

  it('reduces to exactly maxPoints', () => {
    const ring = makeCircle(400);
    expect(downsampleRing(ring, 80)).toHaveLength(80);
  });

  it('samples evenly by arc length (including the wrap segment)', () => {
    // Uneven input: dense on one half, sparse on the other.
    const dense = makeCircle(300).slice(0, 150); // half circle, 150 pts
    const sparse = makeCircle(20).slice(10); // other half, 10 pts
    const ring = [...dense, ...sparse];

    const sampled = downsampleRing(ring, 80);
    expect(sampled).toHaveLength(80);

    const gaps: number[] = [];
    for (let i = 0; i < sampled.length; i++) {
      gaps.push(haversineKm(sampled[i], sampled[(i + 1) % sampled.length]));
    }
    const min = Math.min(...gaps);
    const max = Math.max(...gaps);
    // Even arc-length sampling: all gaps within ~15% of each other.
    expect(max / min).toBeLessThan(1.15);
  });

  it('preserves the approximate perimeter', () => {
    const ring = makeCircle(400);
    const sampled = downsampleRing(ring, 80);
    const ratio = ringPerimeterKm(sampled) / ringPerimeterKm(ring);
    expect(ratio).toBeGreaterThan(0.98);
    expect(ratio).toBeLessThanOrEqual(1.0001);
  });
});

describe('touchesBbox', () => {
  const bbox = { south: -0.05, west: -0.05, north: 0.05, east: 0.05 };

  it('returns false for a ring well inside the bbox', () => {
    expect(touchesBbox(makeCircle(40, 0.01), bbox, 1e-3)).toBe(false);
  });

  it('returns true when a point lies on the bbox edge', () => {
    const ring = [...makeCircle(40, 0.01), { lat: 0.05, lng: 0 }];
    expect(touchesBbox(ring, bbox, 1e-3)).toBe(true);
  });

  it('returns true when a point is within epsilon of an edge', () => {
    const ring = [{ lat: 0, lng: -0.0495 }, { lat: 0.01, lng: 0 }, { lat: -0.01, lng: 0 }];
    expect(touchesBbox(ring, bbox, 1e-3)).toBe(true);
    expect(touchesBbox(ring, bbox, 1e-4)).toBe(false);
  });
});

describe('largestRing', () => {
  it('picks the ring with the largest perimeter', () => {
    const small = makeCircle(20, 0.001);
    const big = makeCircle(20, 0.01);
    expect(largestRing([small, big])).toBe(big);
    expect(largestRing([])).toBeNull();
  });
});

describe('nearestDistanceM', () => {
  it('returns the distance to the closest ring vertex in meters', () => {
    // Query point ~444.8 m west of corner A.
    const point: LatLng = { lat: 0, lng: -0.004 };
    const d = nearestDistanceM(point, SQUARE);
    expect(d).toBeGreaterThan(430);
    expect(d).toBeLessThan(460);
  });
});
