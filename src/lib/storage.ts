import { AppSettings, GeneratedRoute, ScenicMode } from '@/types';
import { dbGet, dbPut, dbDelete, dbGetAll } from './db';

const defaultSettings: AppSettings = {
  voiceEnabled: false,
  voiceStyle: 'concise',
  units: 'km',
  defaultDistance: 5,
  paceSecondsPerKm: 360, // 6:00/km default running pace
  providerBundle: 'open' as const,
  scenicMode: 'standard' as ScenicMode,
};

export interface SavedRoute {
  id: string;
  name?: string; // User-editable name, auto-generated if absent
  route: GeneratedRoute;
  city: string;
  createdAt: string;
  verified?: boolean;
  timesRun?: number;
  avgAdherence?: number;
  lastRunAt?: string;
}

export async function getSettings(): Promise<AppSettings> {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = await dbGet<{ key: string } & AppSettings>('settings', 'app');
    if (!stored) return defaultSettings;
    // Strip the `key` field used by IndexedDB and merge with defaults
    const { key: _key, ...settings } = stored;
    return { ...defaultSettings, ...settings };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await dbPut('settings', { key: 'app', ...settings });
}

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  if (typeof window === 'undefined') return [];
  try {
    return await dbGetAll<SavedRoute>('routes');
  } catch {
    return [];
  }
}

export async function saveRoute(route: GeneratedRoute, city: string, name?: string): Promise<SavedRoute> {
  const autoName = name || `${(route.distance / 1000).toFixed(1)} km route - ${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  const saved: SavedRoute = {
    id: crypto.randomUUID(),
    name: autoName,
    route,
    city,
    createdAt: new Date().toISOString(),
  };
  await dbPut('routes', saved);
  import('@/lib/supabase/sync').then(({ syncRoute }) => syncRoute(saved)).catch(() => {});
  return saved;
}

export async function deleteRoute(id: string): Promise<void> {
  await dbDelete('routes', id);
  import('@/lib/supabase/sync').then(({ deleteRouteFromSupabase }) => deleteRouteFromSupabase(id)).catch(() => {});
}

/**
 * Haversine distance between two points in meters.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find saved routes whose start is near the current position and whose
 * total distance is close to the target distance.
 *
 * @param currentLat  Current latitude
 * @param currentLng  Current longitude
 * @param targetDistanceKm  Desired route length in km
 * @param maxStartDistanceM  Max meters between current position and route start (default 100)
 * @returns Matching GeneratedRoute[] sorted by closest distance match first
 */
export async function findNearbySavedRoutes(
  currentLat: number,
  currentLng: number,
  targetDistanceKm: number,
  maxStartDistanceM: number = 100
): Promise<GeneratedRoute[]> {
  const saved = await getSavedRoutes();
  const targetMeters = targetDistanceKm * 1000;
  const tolerance = 0.2; // 20%

  const matches: { route: GeneratedRoute; distanceDiff: number }[] = [];

  for (const entry of saved) {
    const wps = entry.route.waypoints;
    if (wps.length === 0) continue;

    // Check first waypoint proximity to current position
    const startDist = haversineMeters(
      currentLat,
      currentLng,
      wps[0].lat,
      wps[0].lng
    );
    if (startDist > maxStartDistanceM) continue;

    // Check route distance is within 20% of target
    const routeDistance = entry.route.distance; // meters
    const diff = Math.abs(routeDistance - targetMeters);
    if (diff > targetMeters * tolerance) continue;

    matches.push({ route: entry.route, distanceDiff: diff });
  }

  // Sort by closest distance match
  matches.sort((a, b) => a.distanceDiff - b.distanceDiff);

  return matches.map((m) => m.route);
}
