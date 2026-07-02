import { NextRequest, NextResponse } from 'next/server';
import { overpassQuery } from '@/lib/overpass-client';
import type { ScenicFeature, ScenicFeatureType } from '@/lib/scenic';

// Overpass failover can take up to ~14s (6s primary + 8s mirror).
export const maxDuration = 30;

interface CacheEntry {
  features: ScenicFeature[];
  timestamp: number;
}

// In-memory cache keyed by grid cell (~1km resolution) + radius
const scenicCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const MAX_POINTS_PER_WAY = 40;
const MAX_FEATURES = 60;

// Priority order when capping the number of features (lower = more important)
const TYPE_PRIORITY: Record<ScenicFeatureType, number> = {
  coastline: 0,
  beach: 1,
  waterway: 2,
  water: 3,
  park: 4,
  forest: 5,
  landmark: 6,
};

function gridKey(lat: number, lng: number, radiusM: number): string {
  // ~1km grid cells: round to 2 decimal places (~1.1km at equator)
  const gridLat = Math.floor(lat * 100) / 100;
  const gridLng = Math.floor(lng * 100) / 100;
  return `${gridLat},${gridLng},${radiusM}`;
}

interface OverpassRelationMember {
  type: string;
  ref: number;
  role?: string;
  // Null entries occur when geometry is bbox-clipped by Overpass.
  geometry?: ({ lat: number; lon: number } | null)[];
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: OverpassRelationMember[];
}

const MAX_MEMBERS_PER_RELATION = 10;

function mapType(tags: Record<string, string>): ScenicFeatureType | null {
  if (tags.natural === 'coastline') return 'coastline';
  if (tags.natural === 'beach') return 'beach';
  if (tags.natural === 'water') return 'water';
  if (tags.waterway === 'river' || tags.waterway === 'canal') return 'waterway';
  if (tags.leisure === 'park' || tags.leisure === 'nature_reserve') return 'park';
  if (tags.highway === 'pedestrian') return 'park'; // named pedestrian streets count as pleasant corridors
  return null;
}

function downsample(points: [number, number][], maxPoints: number): [number, number][] {
  if (points.length <= maxPoints) return points;
  const result: [number, number][] = [];
  const stride = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(points[Math.round(i * stride)]);
  }
  result.push(points[points.length - 1]); // always keep last point
  return result;
}

async function fetchFromOverpass(lat: number, lng: number, radiusM: number): Promise<ScenicFeature[]> {
  // Bounding box for clipping relation geometry — large water bodies (lakes,
  // bays) can otherwise return megabytes of coordinates far outside the area.
  const latDelta = radiusM / 111320;
  const lngDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lat - latDelta},${lng - lngDelta},${lat + latDelta},${lng + lngDelta}`;

  // NOTE: relations get a separate out-statement. Overpass sorts relations
  // after ways within a set, so inside the union they would be silently
  // truncated by the 200-element cap whenever ways fill the quota.
  const query = `
    [out:json][timeout:8];
    (
      way["natural"="coastline"](around:${radiusM},${lat},${lng});
      way["natural"="beach"](around:${radiusM},${lat},${lng});
      way["natural"="water"][!"water"](around:${radiusM},${lat},${lng});
      way["natural"="water"]["water"!~"^(fountain|pond|reflecting_pool|swimming_pool|basin)$"](around:${radiusM},${lat},${lng});
      way["waterway"~"^(river|canal)$"](around:${radiusM},${lat},${lng});
      way["leisure"~"^(park|nature_reserve)$"](around:${radiusM},${lat},${lng});
      way["highway"="pedestrian"]["name"](around:${radiusM},${lat},${lng});
    );
    out geom 200;
    relation["natural"="water"]["water"!~"^(fountain|pond|reflecting_pool|swimming_pool|basin)$"](around:${radiusM},${lat},${lng});
    out geom(${bbox}) 20;
  `;

  const data = (await overpassQuery(query)) as { elements?: OverpassElement[] };

  const features: ScenicFeature[] = [];
  for (const el of data.elements || []) {
    if (!el.tags) continue;

    const type = mapType(el.tags);
    if (!type) continue;

    const name = el.tags.name;

    if (el.type === 'way' && el.geometry) {
      const points: [number, number][] = el.geometry
        .filter(p => typeof p.lat === 'number' && typeof p.lon === 'number')
        .map(p => [p.lat, p.lon]);
      if (points.length < 2) continue;

      const feature: ScenicFeature = {
        id: `way/${el.id}`,
        type,
        points: downsample(points, MAX_POINTS_PER_WAY),
      };
      if (name) feature.name = name;

      features.push(feature);
    } else if (el.type === 'relation' && el.members) {
      // Multipolygon relations (e.g. large water bodies): flatten outer way
      // members into individual features, keeping the longest ones.
      const memberPoints: { index: number; points: [number, number][] }[] = [];
      for (let i = 0; i < el.members.length; i++) {
        const member = el.members[i];
        if (member.type !== 'way' || !member.geometry) continue;
        if (member.role && member.role !== 'outer') continue;

        // Bbox-clipped geometry contains null entries for out-of-view points.
        const points: [number, number][] = member.geometry
          .filter((p): p is { lat: number; lon: number } =>
            p != null && typeof p.lat === 'number' && typeof p.lon === 'number')
          .map(p => [p.lat, p.lon]);
        if (points.length < 2) continue;

        memberPoints.push({ index: i, points });
      }

      memberPoints.sort((a, b) => b.points.length - a.points.length);
      for (const { index, points } of memberPoints.slice(0, MAX_MEMBERS_PER_RELATION)) {
        const feature: ScenicFeature = {
          id: `relation/${el.id}/${index}`,
          type,
          points: downsample(points, MAX_POINTS_PER_WAY),
        };
        if (name) feature.name = name;

        features.push(feature);
      }
    }
  }

  // Sort by priority, then cap
  features.sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]);
  return features.slice(0, MAX_FEATURES);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const radius = parseInt(searchParams.get('radius') || '2000', 10);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const clampedRadius = Math.min(isNaN(radius) ? 2000 : radius, 5000);
  const key = gridKey(lat, lng, clampedRadius);

  // Check cache
  const cached = scenicCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ features: cached.features, cached: true });
  }

  try {
    const features = await fetchFromOverpass(lat, lng, clampedRadius);

    // Store in cache
    scenicCache.set(key, { features, timestamp: Date.now() });

    // Evict old entries (simple cleanup)
    for (const [k, v] of scenicCache) {
      if (Date.now() - v.timestamp > CACHE_TTL_MS * 2) {
        scenicCache.delete(k);
      }
    }

    return NextResponse.json({ features, cached: false });
  } catch (error) {
    console.warn('Overpass scenic fetch failed:', error);
    return NextResponse.json({ features: [], cached: false, error: 'Overpass unavailable' });
  }
}
