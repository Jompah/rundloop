import { type NextRequest } from 'next/server';
import { overpassQuery } from '@/lib/overpass-client';
import {
  type Bbox,
  type BridgeCrossing,
  type BridgeWay,
  type LatLng,
  type PerimeterRing,
  centroid,
  detectBridgeCrossings,
  downsampleRing,
  haversineKm,
  largestRing,
  nearestDistanceM,
  offsetRing,
  ringPerimeterKm,
  stitchRings,
  touchesBbox,
} from '@/lib/ring-assembly';

// Overpass failover can take up to ~14s (6s primary + 8s mirror).
export const maxDuration = 30;

interface IslandResult {
  name: string;
  perimeterKm: number;
  outline: LatLng[];
}

interface CacheEntry {
  island: IslandResult | null;
  rings: PerimeterRing[];
  bridges: BridgeCrossing[];
  timestamp: number;
}

// In-memory cache keyed by rounded lat/lng (2 decimals) + rounded targetKm
const islandCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const MAX_RINGS = 3;
const MAX_OUTLINE_POINTS = 80;
const OFFSET_METERS = 30;
const MAX_DISTANCE_M = 1200; // query point must be within this of the ring
const PERIMETER_MIN_FACTOR = 0.55;
const PERIMETER_MAX_FACTOR = 1.45;
const BBOX_EDGE_EPSILON_DEG = 1e-3; // ~110 m — clipped geometry hugs the bbox edge

function cacheKey(lat: number, lng: number, targetKm: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(targetKm)}`;
}

// Overpass geometry: bbox-clipped vertices come back as null entries.
type OverpassPoint = { lat: number; lon: number } | null;

interface OverpassRelationMember {
  type: string;
  ref: number;
  role?: string;
  geometry?: OverpassPoint[];
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassPoint[];
  members?: OverpassRelationMember[];
}

function toLatLngs(geometry: OverpassPoint[]): { points: LatLng[]; clipped: boolean } {
  const points: LatLng[] = [];
  let clipped = false;
  for (const p of geometry) {
    if (p == null || typeof p.lat !== 'number' || typeof p.lon !== 'number') {
      clipped = true;
      continue;
    }
    points.push({ lat: p.lat, lng: p.lon });
  }
  return { points, clipped };
}

/**
 * Split bbox-clipped Overpass geometry at null vertices into contiguous
 * polyline runs. Naively stripping the nulls would join two shore pieces
 * with a fake segment across the clip — splitting keeps each shoreline
 * fragment honest.
 */
function splitAtNulls(geometry: OverpassPoint[]): LatLng[][] {
  const runs: LatLng[][] = [];
  let current: LatLng[] = [];
  for (const p of geometry) {
    if (p == null || typeof p.lat !== 'number' || typeof p.lon !== 'number') {
      if (current.length >= 2) runs.push(current);
      current = [];
      continue;
    }
    current.push({ lat: p.lat, lng: p.lon });
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

function elementKind(tags: Record<string, string>): 'island' | 'water' | null {
  if (tags.place === 'island') return 'island';
  if (tags.natural === 'water') return 'water';
  return null;
}

/**
 * Water geometry used ONLY for the bridge-crossing test ("corridor water"):
 * clipped giants (Mälaren, the Charles) can never become rings, but their
 * shoreline fragments tell us which bridges actually span water.
 */
function isCorridorWater(tags: Record<string, string>): boolean {
  return tags.natural === 'water' || tags.waterway === 'riverbank';
}

// Foot-passable highway classes for bridge candidates. Excludes
// motorway/trunk/construction and everything else not listed.
const WALKABLE_HIGHWAYS = new Set([
  'footway',
  'cycleway',
  'path',
  'pedestrian',
  'residential',
  'unclassified',
  'tertiary',
  'secondary',
  'primary',
]);
// Explicit foot access overrides the highway class in both directions:
// Longfellow Bridge is highway=trunk + foot=yes (field-verified 2026-07-22),
// while some primary carriageways carry foot=no.
const FOOT_ALLOWED = new Set(['yes', 'designated', 'permissive']);
const FOOT_FORBIDDEN = new Set(['no', 'private']);

function isWalkableBridge(tags: Record<string, string>): boolean {
  if (tags.bridge !== 'yes' || !tags.highway) return false;
  const foot = tags.foot || '';
  if (FOOT_FORBIDDEN.has(foot)) return false;
  return WALKABLE_HIGHWAYS.has(tags.highway) || FOOT_ALLOWED.has(foot);
}

/**
 * Build a single ring (not closed: first != last) from an Overpass element,
 * or null when the element is open, clipped by the bbox, or has no geometry.
 */
function buildRing(el: OverpassElement, bbox: Bbox): LatLng[] | null {
  if (el.type === 'way' && el.geometry) {
    const { points, clipped } = toLatLngs(el.geometry);
    if (clipped || points.length < 4) return null;
    const first = points[0];
    const last = points[points.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) return null; // open way
    const ring = points.slice(0, -1);
    if (touchesBbox(ring, bbox, BBOX_EDGE_EPSILON_DEG)) return null;
    return ring;
  }

  if (el.type === 'relation' && el.members) {
    const outerWays: LatLng[][] = [];
    for (const member of el.members) {
      if (member.type !== 'way' || !member.geometry) continue;
      if (member.role !== 'outer') continue;
      const { points, clipped } = toLatLngs(member.geometry);
      // Any clipped member means the relation extends past the bbox —
      // too large for the target distance (e.g. Mälaren). Discard.
      if (clipped) return null;
      if (points.length >= 2) outerWays.push(points);
    }
    if (outerWays.length === 0) return null;

    // A relation can yield several rings (multiple outers) — keep the largest.
    const ring = largestRing(stitchRings(outerWays));
    if (!ring || touchesBbox(ring, bbox, BBOX_EDGE_EPSILON_DEG)) return null;
    return ring;
  }

  return null;
}

interface Candidate {
  kind: 'island' | 'water';
  name: string | null;
  ring: LatLng[];
  perimeterKm: number;
  distanceM: number;
}

async function fetchPerimeterRings(
  lat: number,
  lng: number,
  targetKm: number
): Promise<{ island: IslandResult | null; rings: PerimeterRing[]; bridges: BridgeCrossing[] }> {
  // Bbox half-size scaled to the target distance: a targetKm loop has a
  // radius of roughly targetKm / (2π) ≈ 0.16 × targetKm, so ±0.35 × targetKm
  // comfortably contains any ring worth suggesting while keeping payloads small.
  const halfKm = targetKm * 0.35;
  const latDelta = halfKm / 111.32;
  const lngDelta = halfKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const bbox: Bbox = {
    south: lat - latDelta,
    west: lng - lngDelta,
    north: lat + latDelta,
    east: lng + lngDelta,
  };
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  // out geom(bbox) clips geometry: objects whose ring touches the bbox edge
  // (or comes back with null vertices) are too large and get discarded.
  const query = `[out:json][timeout:8];
(
  way["place"="island"](${bboxStr});
  relation["place"="island"](${bboxStr});
  way["natural"="water"]["name"](${bboxStr});
  relation["natural"="water"]["name"](${bboxStr});
  way["waterway"="riverbank"](${bboxStr});
  relation["waterway"="riverbank"](${bboxStr});
  way["bridge"="yes"]["highway"](${bboxStr});
);
out geom(${bboxStr});`;

  const data = (await overpassQuery(query)) as { elements?: OverpassElement[] };
  const elements = data.elements || [];
  const userPos: LatLng = { lat, lng };

  const candidates: Candidate[] = [];
  // Shoreline fragments for the bridge-crossing test. Unlike ring candidates,
  // bbox-clipped water (Mälaren, the Charles) is KEPT here — its null-stripped
  // geometry runs are exactly the shorelines a real bridge must cross twice.
  const waterSegments: LatLng[][] = [];
  const bridgeWays: BridgeWay[] = [];

  for (const el of elements) {
    if (!el.tags) continue;

    // Bridge candidates: bridge=yes with a foot-passable highway class.
    if (el.tags.bridge === 'yes' && el.tags.highway) {
      if (!isWalkableBridge(el.tags) || !el.geometry) continue;
      // Prefer the bridge's own name over the road's (e.g. bridge:name=
      // "Andrew McArdle Bridge" on ways named "Meridian Street").
      const name = el.tags['bridge:name'] || el.tags.name || null;
      // A bridge clipped by the bbox still yields usable runs.
      for (const run of splitAtNulls(el.geometry)) {
        bridgeWays.push({ name, points: run });
      }
      continue;
    }

    // Corridor water: collect ALL geometry runs (ways and relation members,
    // outer and inner — inner shorelines matter for bridges via mid-river
    // islands), clipped or not. Used only for the bridge test.
    if (isCorridorWater(el.tags)) {
      if (el.type === 'way' && el.geometry) {
        waterSegments.push(...splitAtNulls(el.geometry));
      } else if (el.type === 'relation' && el.members) {
        for (const member of el.members) {
          if (member.type !== 'way' || !member.geometry) continue;
          waterSegments.push(...splitAtNulls(member.geometry));
        }
      }
    }

    const kind = elementKind(el.tags);
    if (!kind) continue;

    const ring = buildRing(el, bbox);
    if (!ring) continue;

    candidates.push({
      kind,
      name: el.tags.name || null,
      ring,
      perimeterKm: Math.round(ringPerimeterKm(ring) * 100) / 100,
      distanceM: Math.round(nearestDistanceM(userPos, ring)),
    });
  }

  const bridges = detectBridgeCrossings(bridgeWays, waterSegments, userPos);

  // Backwards-compatible `island` field: nearest place=island regardless of
  // the perimeter filter, same shape as the old response.
  let island: IslandResult | null = null;
  let islandCentroidDist = Infinity;
  for (const c of candidates) {
    if (c.kind !== 'island') continue;
    const dist = haversineKm(userPos, centroid(c.ring));
    if (dist < islandCentroidDist) {
      islandCentroidDist = dist;
      island = {
        name: c.name || 'Unknown island',
        perimeterKm: c.perimeterKm,
        outline: downsampleRing(offsetRing(c.ring, OFFSET_METERS, 'inward'), 30),
      };
    }
  }

  const rings: PerimeterRing[] = candidates
    .filter(
      c =>
        c.perimeterKm >= PERIMETER_MIN_FACTOR * targetKm &&
        c.perimeterKm <= PERIMETER_MAX_FACTOR * targetKm &&
        c.distanceM <= MAX_DISTANCE_M
    )
    .sort(
      (a, b) =>
        Math.abs(a.perimeterKm - targetKm) - Math.abs(b.perimeterKm - targetKm)
    )
    .slice(0, MAX_RINGS)
    .map(c => ({
      kind: c.kind,
      name: c.name,
      perimeterKm: c.perimeterKm,
      distanceM: c.distanceM,
      // Islands: runner is on the island — nudge onto land (inward).
      // Water: runner is on the shore outside the water — nudge outward.
      outline: downsampleRing(
        offsetRing(c.ring, OFFSET_METERS, c.kind === 'island' ? 'inward' : 'outward'),
        MAX_OUTLINE_POINTS
      ),
    }));

  return { island, rings, bridges };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const targetKmRaw = parseFloat(searchParams.get('targetKm') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ error: 'lat and lng query params required' }, { status: 400 });
  }

  const targetKm = Math.min(Math.max(isNaN(targetKmRaw) ? 5 : targetKmRaw, 1), 42);

  const key = cacheKey(lat, lng, targetKm);

  // Check cache
  const cached = islandCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Response.json({
      island: cached.island,
      rings: cached.rings,
      bridges: cached.bridges,
    });
  }

  try {
    const { island, rings, bridges } = await fetchPerimeterRings(lat, lng, targetKm);

    // Store in cache
    islandCache.set(key, { island, rings, bridges, timestamp: Date.now() });

    // Evict old entries
    for (const [k, v] of islandCache) {
      if (Date.now() - v.timestamp > CACHE_TTL_MS * 2) {
        islandCache.delete(k);
      }
    }

    return Response.json({ island, rings, bridges });
  } catch (error) {
    console.warn('Island outline fetch failed:', error);
    return Response.json({ island: null, rings: [], bridges: [], error: 'Overpass unavailable' });
  }
}
