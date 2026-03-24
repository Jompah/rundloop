import { NextRequest, NextResponse } from 'next/server';

interface CachedPOI {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: string;
}

interface CacheEntry {
  pois: CachedPOI[];
  timestamp: number;
}

// In-memory cache keyed by grid cell (~1km resolution)
const poiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function gridKey(lat: number, lng: number): string {
  // ~1km grid cells: round to 2 decimal places (~1.1km at equator)
  const gridLat = Math.floor(lat * 100) / 100;
  const gridLng = Math.floor(lng * 100) / 100;
  return `${gridLat},${gridLng}`;
}

async function fetchFromOverpass(lat: number, lng: number, radiusM: number): Promise<CachedPOI[]> {
  const query = `
    [out:json][timeout:10];
    (
      node["leisure"~"park|garden|nature_reserve"](around:${radiusM},${lat},${lng});
      way["leisure"~"park|garden|nature_reserve"](around:${radiusM},${lat},${lng});
      node["natural"~"water|wood|beach"](around:${radiusM},${lat},${lng});
      way["natural"~"water|wood|beach"](around:${radiusM},${lat},${lng});
      node["waterway"~"river|canal|stream"]["name"](around:${radiusM},${lat},${lng});
      way["waterway"~"river|canal|stream"]["name"](around:${radiusM},${lat},${lng});
      node["landuse"~"forest|recreation_ground"](around:${radiusM},${lat},${lng});
      way["landuse"~"forest|recreation_ground"](around:${radiusM},${lat},${lng});
    );
    out center body;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(15000), // 15s timeout
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();

  const pois: CachedPOI[] = [];
  for (const el of data.elements || []) {
    const name = el.tags?.name;
    if (!name) continue;

    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (!elLat || !elLng) continue;

    let type = 'nature';
    if (el.tags?.leisure === 'park') type = 'park';
    else if (el.tags?.leisure === 'garden') type = 'garden';
    else if (el.tags?.natural === 'water') type = 'water';
    else if (el.tags?.waterway) type = 'waterway';
    else if (el.tags?.landuse === 'forest' || el.tags?.natural === 'wood') type = 'forest';

    pois.push({ id: el.id, name, lat: elLat, lng: elLng, type });
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return pois.filter(p => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const radius = parseInt(searchParams.get('radius') || '2000', 10);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const key = gridKey(lat, lng);

  // Check cache
  const cached = poiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ pois: cached.pois, cached: true });
  }

  try {
    const pois = await fetchFromOverpass(lat, lng, Math.min(radius, 5000));

    // Store in cache
    poiCache.set(key, { pois, timestamp: Date.now() });

    // Evict old entries (simple cleanup)
    for (const [k, v] of poiCache) {
      if (Date.now() - v.timestamp > CACHE_TTL_MS * 2) {
        poiCache.delete(k);
      }
    }

    return NextResponse.json({ pois, cached: false });
  } catch (error) {
    console.warn('Overpass POI fetch failed:', error);
    return NextResponse.json({ pois: [], cached: false, error: 'Overpass unavailable' });
  }
}
