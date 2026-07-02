import { type NextRequest } from 'next/server';
import {
  type Bbox,
  type LatLng,
  type PerimeterRing,
  centroid,
  downsampleRing,
  haversineKm,
  largestRing,
  nearestDistanceM,
  offsetRing,
  ringPerimeterKm,
  stitchRings,
  touchesBbox,
} from '@/lib/ring-assembly';

interface IslandResult {
  name: string;
  perimeterKm: number;
  outline: LatLng[];
}

interface CacheEntry {
  island: IslandResult | null;
  rings: PerimeterRing[];
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

function elementKind(tags: Record<string, string>): 'island' | 'water' | null {
  if (tags.place === 'island') return 'island';
  if (tags.natural === 'water') return 'water';
  return null;
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
): Promise<{ island: IslandResult | null; rings: PerimeterRing[] }> {
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
);
out geom(${bboxStr});`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpass rejects UA-less requests (406); Node fetch sends none by default.
      'User-Agent': 'Drift/1.0',
    },
    signal: AbortSignal.timeout(8000), // 8s timeout
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  const elements = (data.elements || []) as OverpassElement[];
  const userPos: LatLng = { lat, lng };

  const candidates: Candidate[] = [];
  for (const el of elements) {
    if (!el.tags) continue;
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

  return { island, rings };
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
    return Response.json({ island: cached.island, rings: cached.rings });
  }

  try {
    const { island, rings } = await fetchPerimeterRings(lat, lng, targetKm);

    // Store in cache
    islandCache.set(key, { island, rings, timestamp: Date.now() });

    // Evict old entries
    for (const [k, v] of islandCache) {
      if (Date.now() - v.timestamp > CACHE_TTL_MS * 2) {
        islandCache.delete(k);
      }
    }

    return Response.json({ island, rings });
  } catch (error) {
    console.warn('Island outline fetch failed:', error);
    return Response.json({ island: null, rings: [], error: 'Overpass unavailable' });
  }
}
