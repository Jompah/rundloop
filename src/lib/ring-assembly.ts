/**
 * Pure helpers for assembling closed perimeter rings from OSM/Overpass
 * geometry — used by the island-outline API route to suggest runs AROUND
 * an island (e.g. Kungsholmen) or AROUND a water body (e.g. Riddarfjärden).
 *
 * All functions are pure and unit-tested in __tests__/ring-assembly.test.ts.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PerimeterRing {
  kind: 'island' | 'water';
  name: string | null;
  perimeterKm: number; // ring perimeter BEFORE offset
  distanceM: number; // meters from the query point to the nearest outline point
  outline: LatLng[]; // ordered ring (not closed: first != last), max 80 pts, offset 30 m toward the land side
}

export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Ring perimeter in km, including the closing segment last -> first. */
export function ringPerimeterKm(ring: LatLng[]): number {
  if (ring.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    total += haversineKm(ring[i], ring[(i + 1) % ring.length]);
  }
  return total;
}

/** Minimum haversine distance (meters) from a point to any ring vertex. */
export function nearestDistanceM(point: LatLng, ring: LatLng[]): number {
  let min = Infinity;
  for (const p of ring) {
    const d = haversineKm(point, p) * 1000;
    if (d < min) min = d;
  }
  return min;
}

export function centroid(points: LatLng[]): LatLng {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

function samePoint(a: LatLng, b: LatLng, epsDeg: number): boolean {
  return Math.abs(a.lat - b.lat) <= epsDeg && Math.abs(a.lng - b.lng) <= epsDeg;
}

/**
 * Stitch OSM way segments into closed rings by matching endpoints.
 *
 * Ways sharing an endpoint (identical node coordinates, or within `epsDeg`)
 * are chained together, reversing segment direction where needed. A way that
 * is already closed (first == last point) becomes a ring on its own.
 *
 * For OSM relations: pass only the `role === 'outer'` member geometries.
 * A relation may yield several rings (archipelago-style multipolygons) —
 * callers typically keep the largest via `largestRing`.
 *
 * Returned rings are NOT closed (first != last — the duplicate closing point
 * is dropped). Open chains that cannot be closed are discarded.
 */
export function stitchRings(ways: LatLng[][], epsDeg: number = 1e-6): LatLng[][] {
  const remaining = ways
    .map(w => w.filter((p): p is LatLng => p != null))
    .filter(w => w.length >= 2);

  const rings: LatLng[][] = [];

  while (remaining.length > 0) {
    let chain = remaining.shift()!.slice();

    // Extend the chain until it closes or no continuation exists.
    for (;;) {
      const head = chain[0];
      const tail = chain[chain.length - 1];

      if (chain.length >= 4 && samePoint(head, tail, epsDeg)) {
        // Closed — drop the duplicate closing point.
        const ring = chain.slice(0, -1);
        if (ring.length >= 3) rings.push(ring);
        break;
      }

      let extended = false;
      for (let j = 0; j < remaining.length; j++) {
        const seg = remaining[j];
        if (samePoint(seg[0], tail, epsDeg)) {
          chain = chain.concat(seg.slice(1));
        } else if (samePoint(seg[seg.length - 1], tail, epsDeg)) {
          chain = chain.concat(seg.slice(0, -1).reverse());
        } else if (samePoint(seg[seg.length - 1], head, epsDeg)) {
          chain = seg.slice(0, -1).concat(chain);
        } else if (samePoint(seg[0], head, epsDeg)) {
          chain = seg.slice(1).reverse().concat(chain);
        } else {
          continue;
        }
        remaining.splice(j, 1);
        extended = true;
        break;
      }

      if (!extended) break; // open chain — cannot close, discard
    }
  }

  return rings;
}

/** Pick the ring with the largest perimeter, or null if none. */
export function largestRing(rings: LatLng[][]): LatLng[] | null {
  let best: LatLng[] | null = null;
  let bestPerimeter = -Infinity;
  for (const ring of rings) {
    const p = ringPerimeterKm(ring);
    if (p > bestPerimeter) {
      bestPerimeter = p;
      best = ring;
    }
  }
  return best;
}

/**
 * Move every ring point toward ('inward') or away from ('outward') the ring
 * centroid by `meters`.
 *
 * Islands: 'inward' — the runner is ON the island, so the outline is nudged
 * onto routable land. Water bodies: 'outward' — the runner is on the shore
 * OUTSIDE the water.
 */
export function offsetRing(
  ring: LatLng[],
  meters: number,
  direction: 'inward' | 'outward'
): LatLng[] {
  const cent = centroid(ring);
  const sign = direction === 'inward' ? 1 : -1;
  return ring.map(p => {
    const distKm = haversineKm(p, cent);
    // Point already closer to the centroid than the offset — leave it.
    if (direction === 'inward' && distKm < meters / 1000) return p;
    if (distKm === 0) return p;
    const ratio = (sign * meters) / 1000 / distKm;
    return {
      lat: p.lat + (cent.lat - p.lat) * ratio,
      lng: p.lng + (cent.lng - p.lng) * ratio,
    };
  });
}

/**
 * Resample a ring to at most `maxPoints` points, evenly spaced by arc length
 * (haversine), interpolating linearly along segments. The first point of the
 * input is kept as the first sample. Rings already within the budget are
 * returned unchanged.
 */
export function downsampleRing(ring: LatLng[], maxPoints: number): LatLng[] {
  if (ring.length <= maxPoints || maxPoints < 3) return ring;

  const n = ring.length;
  // Cumulative arc length over segments i -> i+1 (mod n), including the wrap.
  const segLen: number[] = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    segLen[i] = haversineKm(ring[i], ring[(i + 1) % n]);
    total += segLen[i];
  }
  if (total === 0) return ring.slice(0, maxPoints);

  const step = total / maxPoints;
  const result: LatLng[] = [];
  let segIndex = 0;
  let segStart = 0; // cumulative distance at the start of segment segIndex

  for (let k = 0; k < maxPoints; k++) {
    const target = k * step;
    while (segIndex < n - 1 && segStart + segLen[segIndex] < target) {
      segStart += segLen[segIndex];
      segIndex++;
    }
    const a = ring[segIndex];
    const b = ring[(segIndex + 1) % n];
    const t = segLen[segIndex] === 0 ? 0 : (target - segStart) / segLen[segIndex];
    result.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });
  }

  return result;
}

/**
 * True if any ring point lies within `epsilonDeg` of a bbox edge. Used to
 * discard objects whose geometry was clipped by Overpass `out geom(bbox)` —
 * anything touching the bbox edge (e.g. Mälaren) is too large for the target
 * distance anyway.
 */
export function touchesBbox(ring: LatLng[], bbox: Bbox, epsilonDeg: number): boolean {
  for (const p of ring) {
    if (
      Math.abs(p.lat - bbox.south) <= epsilonDeg ||
      Math.abs(p.lat - bbox.north) <= epsilonDeg ||
      Math.abs(p.lng - bbox.west) <= epsilonDeg ||
      Math.abs(p.lng - bbox.east) <= epsilonDeg
    ) {
      return true;
    }
  }
  return false;
}
