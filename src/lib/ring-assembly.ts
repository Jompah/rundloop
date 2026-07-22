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
 * A pedestrian-passable bridge that crosses water near the query point.
 * Serves river cities (Boston/Charles, Stockholm/Årstaviken) where no closed
 * water ring exists — the flagship run is a BRIDGE LOOP: out along one bank,
 * across a bridge, home along the other.
 */
export interface BridgeCrossing {
  name: string | null;
  nearEnd: LatLng; // bridge end on the query point's side of the water
  farEnd: LatLng; // opposite side
  lengthM: number;
  distanceM: number; // query point -> nearEnd
}

/** A candidate bridge way (bridge=yes + walkable highway) from Overpass. */
export interface BridgeWay {
  name: string | null;
  points: LatLng[]; // polyline, >= 2 points
}

/**
 * 2D segment intersection in lat/lng space, with lng scaled by cos(lat) so
 * both axes are approximately metric. Touching endpoints and collinear
 * overlap count as intersecting; parallel non-touching segments do not.
 */
export function segmentsIntersect(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const cosLat = Math.cos(toRad((a.lat + b.lat + c.lat + d.lat) / 4));
  const ax = a.lng * cosLat;
  const ay = a.lat;
  const bx = b.lng * cosLat;
  const by = b.lat;
  const cx = c.lng * cosLat;
  const cy = c.lat;
  const dx = d.lng * cosLat;
  const dy = d.lat;

  const orient = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);

  const d1 = orient(cx, cy, dx, dy, ax, ay);
  const d2 = orient(cx, cy, dx, dy, bx, by);
  const d3 = orient(ax, ay, bx, by, cx, cy);
  const d4 = orient(ax, ay, bx, by, dx, dy);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Collinear / endpoint-touching cases.
  const onSegment = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.min(px, qx) <= rx && rx <= Math.max(px, qx) && Math.min(py, qy) <= ry && ry <= Math.max(py, qy);
  if (d1 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (d2 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  if (d3 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (d4 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  return false;
}

/**
 * Count segment-segment intersections between a polyline and a set of
 * shoreline polylines.
 */
function countShorelineIntersections(polyline: LatLng[], waterSegments: LatLng[][]): number {
  let count = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    for (const shore of waterSegments) {
      for (let j = 0; j < shore.length - 1; j++) {
        if (segmentsIntersect(polyline[i], polyline[i + 1], shore[j], shore[j + 1])) {
          count++;
        }
      }
    }
  }
  return count;
}

function polylineLengthM(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]) * 1000;
  }
  return total;
}

const MAX_BRIDGES = 10;
const MIN_SHORE_INTERSECTIONS = 2; // in and out of the water
const MIN_BRIDGE_LENGTH_M = 30; // tiny pond/lagoon footbridges are useless for loops
const CLUSTER_EPS_M = 50; // same-name parts within this of each other = same bridge

/** Split same-name bridge parts into spatial clusters (connected components
 * over endpoint proximity). A street can cross several things on separate
 * bridge=yes ways (e.g. Massachusetts Avenue over both the Turnpike and the
 * Charles) — merging by name alone would stretch one "bridge" across all of
 * them. Chained parts share endpoints (~0 m) and parallel carriageways sit
 * within a few tens of meters, so 50 m separates real clusters cleanly. */
function clusterParts(parts: BridgeWay[]): BridgeWay[][] {
  const n = parts.length;
  const assigned = new Array<boolean>(n).fill(false);
  const clusters: BridgeWay[][] = [];

  const endpointsOf = (w: BridgeWay) => [w.points[0], w.points[w.points.length - 1]];
  const near = (a: BridgeWay, b: BridgeWay) => {
    for (const p of endpointsOf(a)) {
      for (const q of endpointsOf(b)) {
        if (haversineKm(p, q) * 1000 <= CLUSTER_EPS_M) return true;
      }
    }
    return false;
  };

  for (let i = 0; i < n; i++) {
    if (assigned[i]) continue;
    const cluster: BridgeWay[] = [];
    const queue = [i];
    assigned[i] = true;
    while (queue.length > 0) {
      const cur = queue.pop()!;
      cluster.push(parts[cur]);
      for (let j = 0; j < n; j++) {
        if (!assigned[j] && near(parts[cur], parts[j])) {
          assigned[j] = true;
          queue.push(j);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/**
 * Detect which candidate bridge ways actually cross water.
 *
 * A bridge counts as water-crossing when its polyline intersects the
 * shoreline segments at least twice (into the water and out again). Road
 * viaducts (0 shoreline intersections) are filtered out this way.
 *
 * Multi-part bridges sharing a name are merged first — per spatial cluster,
 * so a bridge split at midspan (each half crossing one shoreline) still
 * reaches 2 intersections, while separate same-name bridges along one street
 * stay separate. The merged ends are the pair of part endpoints farthest
 * apart. `nearEnd` is the end closest to the query point. Crossings shorter
 * than 30 m (pond footbridges) are dropped. Results are sorted by
 * `distanceM` and capped at 10.
 */
export function detectBridgeCrossings(
  bridgeWays: BridgeWay[],
  waterSegments: LatLng[][],
  queryPoint: LatLng
): BridgeCrossing[] {
  const shores = waterSegments.filter(s => s.length >= 2);
  if (shores.length === 0) return [];

  // Group multi-part bridges by name; unnamed ways stay individual.
  const groups = new Map<string, BridgeWay[]>();
  let anonId = 0;
  for (const way of bridgeWays) {
    if (way.points.length < 2) continue;
    const key = way.name != null ? `name:${way.name}` : `anon:${anonId++}`;
    const group = groups.get(key);
    if (group) group.push(way);
    else groups.set(key, [way]);
  }

  const clusters: BridgeWay[][] = [];
  for (const group of groups.values()) {
    clusters.push(...clusterParts(group));
  }

  const crossings: BridgeCrossing[] = [];
  for (const parts of clusters) {
    let intersections = 0;
    for (const part of parts) {
      intersections += countShorelineIntersections(part.points, shores);
      if (intersections >= MIN_SHORE_INTERSECTIONS) break;
    }
    if (intersections < MIN_SHORE_INTERSECTIONS) continue;

    // Merged bridge ends: the pair of part endpoints farthest apart.
    const endpoints: LatLng[] = [];
    for (const part of parts) {
      endpoints.push(part.points[0], part.points[part.points.length - 1]);
    }
    let endA = endpoints[0];
    let endB = endpoints[1];
    let bestSpanKm = -1;
    for (let i = 0; i < endpoints.length; i++) {
      for (let j = i + 1; j < endpoints.length; j++) {
        const span = haversineKm(endpoints[i], endpoints[j]);
        if (span > bestSpanKm) {
          bestSpanKm = span;
          endA = endpoints[i];
          endB = endpoints[j];
        }
      }
    }

    // Span for merged/parallel parts, polyline length for a single curved way
    // — the max of the two is a robust estimate either way.
    const longestPartM = Math.max(...parts.map(p => polylineLengthM(p.points)));
    const lengthM = Math.round(Math.max(bestSpanKm * 1000, longestPartM));
    if (lengthM < MIN_BRIDGE_LENGTH_M) continue;

    const distA = haversineKm(queryPoint, endA) * 1000;
    const distB = haversineKm(queryPoint, endB) * 1000;
    const nearEnd = distA <= distB ? endA : endB;
    const farEnd = distA <= distB ? endB : endA;

    crossings.push({
      name: parts[0].name,
      nearEnd,
      farEnd,
      lengthM,
      distanceM: Math.round(Math.min(distA, distB)),
    });
  }

  return crossings.sort((a, b) => a.distanceM - b.distanceM).slice(0, MAX_BRIDGES);
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
