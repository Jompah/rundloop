import { type NextRequest } from 'next/server';

interface LatLng {
  lat: number;
  lng: number;
}

interface IslandResult {
  name: string;
  perimeterKm: number;
  outline: LatLng[];
}

interface CacheEntry {
  result: IslandResult | null;
  timestamp: number;
}

// In-memory cache keyed by rounded lat/lng (2 decimals)
const islandCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function calcPerimeter(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    total += haversineDistance(points[i], points[next]);
  }
  return total;
}

function centroid(points: LatLng[]): LatLng {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

function samplePoints(points: LatLng[], maxPoints: number): LatLng[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const sampled: LatLng[] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(points[Math.floor(i * step)]);
  }
  return sampled;
}

async function fetchIslands(lat: number, lng: number): Promise<IslandResult | null> {
  const south = lat - 0.03;
  const north = lat + 0.03;
  const west = lng - 0.05;
  const east = lng + 0.05;

  const query = `[out:json][timeout:5];way["place"="island"](${south},${west},${north},${east});out geom;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  const elements = data.elements || [];

  if (elements.length === 0) return null;

  const userPos: LatLng = { lat, lng };
  let closest: IslandResult | null = null;
  let closestDist = Infinity;

  for (const el of elements) {
    const geometry: LatLng[] | undefined = el.geometry?.map(
      (g: { lat: number; lon: number }) => ({ lat: g.lat, lng: g.lon })
    );
    if (!geometry || geometry.length === 0) continue;

    const center = centroid(geometry);
    const dist = haversineDistance(userPos, center);

    if (dist < closestDist) {
      closestDist = dist;
      const perimeterKm = Math.round(calcPerimeter(geometry) * 100) / 100;
      const outline = samplePoints(geometry, 30);
      const name = el.tags?.name || 'Unknown island';

      closest = { name, perimeterKm, outline };
    }
  }

  return closest;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ error: 'lat and lng query params required' }, { status: 400 });
  }

  const key = cacheKey(lat, lng);

  // Check cache
  const cached = islandCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Response.json({ island: cached.result });
  }

  try {
    const result = await fetchIslands(lat, lng);

    // Store in cache
    islandCache.set(key, { result, timestamp: Date.now() });

    // Evict old entries
    for (const [k, v] of islandCache) {
      if (Date.now() - v.timestamp > CACHE_TTL_MS * 2) {
        islandCache.delete(k);
      }
    }

    return Response.json({ island: result });
  } catch (error) {
    console.warn('Island outline fetch failed:', error);
    return Response.json({ island: null, error: 'Overpass unavailable' });
  }
}
