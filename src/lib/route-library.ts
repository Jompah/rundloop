import { getSavedRoutes } from './storage';
import type { SavedRoute } from './storage';
import type { RunAnalysis } from './run-analysis-types';
import type { CompletedRun } from '@/types';
import { dbGetAll, dbPut } from './db';
import { simplifyPolyline } from './polyline-simplify';

/**
 * Haversine distance in meters between two [lat, lng] points.
 */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
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
 * Find a verified route near a start point with similar distance.
 *
 * @param startLat  Latitude of the desired start point
 * @param startLng  Longitude of the desired start point
 * @param distanceKm  Desired route length in km
 * @returns The closest matching verified SavedRoute, or null
 */
export async function checkRouteLibrary(
  startLat: number,
  startLng: number,
  distanceKm: number
): Promise<SavedRoute | null> {
  const routes = await getSavedRoutes();

  const targetMeters = distanceKm * 1000;
  const tolerance = 0.15; // ±15%
  const maxStartDistance = 200; // meters

  const candidates: { route: SavedRoute; distanceDiff: number }[] = [];

  for (const saved of routes) {
    if (!saved.verified) continue;

    // polyline[0] is [lng, lat]
    const polyline = saved.route.polyline;
    if (!polyline || polyline.length === 0) continue;

    const [routeStartLng, routeStartLat] = polyline[0];
    const startDist = haversineMeters(startLat, startLng, routeStartLat, routeStartLng);
    if (startDist > maxStartDistance) continue;

    const routeDistanceMeters = saved.route.distance;
    const diff = Math.abs(routeDistanceMeters - targetMeters);
    if (diff > targetMeters * tolerance) continue;

    candidates.push({ route: saved, distanceDiff: diff });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const qa = (a.route.timesRun ?? 0) * (a.route.avgAdherence ?? 0);
    const qb = (b.route.timesRun ?? 0) * (b.route.avgAdherence ?? 0);
    if (qb !== qa) return qb - qa;
    return a.distanceDiff - b.distanceDiff;
  });
  return candidates[0].route;
}

/**
 * Update route stats after a run analysis (rolling average, verification).
 *
 * @param routeId  ID of the route to update
 * @param analysis  RunAnalysis result from the completed run
 */
export async function updateRouteStats(
  routeId: string,
  analysis: RunAnalysis
): Promise<void> {
  const routes = await getSavedRoutes();
  const route = routes.find((r) => r.id === routeId);
  if (!route) return;

  const prevTimesRun = route.timesRun ?? 0;
  const prevAvgAdherence = route.avgAdherence ?? 0;
  const newTimesRun = prevTimesRun + 1;

  // Rolling average: ((prevAvg * prevCount) + newValue) / newCount
  const newAvgAdherence =
    (prevAvgAdherence * prevTimesRun + analysis.adherence) / newTimesRun;

  const shouldVerify =
    analysis.adherence >= 90 && analysis.completion >= 0.9;

  const updated: SavedRoute = {
    ...route,
    timesRun: newTimesRun,
    avgAdherence: newAvgAdherence,
    lastRunAt: analysis.computedAt,
    verified: route.verified || shouldVerify,
  };

  await dbPut('routes', updated);
  import('@/lib/supabase/sync').then(({ syncRoute }) => syncRoute(updated)).catch(() => {});
}

/**
 * Promote a completed (free) run to a verified SavedRoute in the library.
 * If a near-identical route already exists, returns the existing one instead.
 */
export async function promoteRunToRoute(
  run: CompletedRun,
  city: string
): Promise<SavedRoute> {
  if (run.trace.length < 10) {
    throw new Error('Run trace too short to promote to a saved route');
  }
  if (run.distanceMeters < 500) {
    throw new Error('Run distance too short to promote to a saved route');
  }

  const rawPoints: Array<[number, number]> = run.trace.map((p) => [p.lng, p.lat]);
  const stableStart = Math.min(10, Math.floor(rawPoints.length / 20));
  const stableTrace = rawPoints.slice(stableStart);
  const simplified = simplifyPolyline(stableTrace, 5);

  if (simplified.length < 2) {
    throw new Error('Simplified polyline has fewer than 2 points');
  }

  const [newStartLng, newStartLat] = simplified[0];
  const [newEndLng, newEndLat] = simplified[simplified.length - 1];

  const existingRoutes = await dbGetAll<SavedRoute>('routes');
  for (const existing of existingRoutes) {
    const poly = existing.route.polyline;
    if (!poly || poly.length === 0) continue;

    const [exStartLng, exStartLat] = poly[0];
    const startDist = haversineMeters(newStartLat, newStartLng, exStartLat, exStartLng);
    if (startDist > 50) continue;

    const distDiff = Math.abs(existing.route.distance - run.distanceMeters);
    if (distDiff / run.distanceMeters > 0.05) continue;

    return existing;
  }

  const duration = run.elapsedMs > 0 ? Math.round(run.elapsedMs / 1000) : 0;
  const endDate = new Date(run.endTime);
  const dateLabel = endDate.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
  });

  const saved: SavedRoute = {
    id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Fri körning — ${(run.distanceMeters / 1000).toFixed(1)} km — ${dateLabel}`,
    city,
    createdAt: new Date().toISOString(),
    verified: true,
    timesRun: 1,
    avgAdherence: 100,
    lastRunAt: endDate.toISOString(),
    route: {
      waypoints: [
        { lat: newStartLat, lng: newStartLng, label: 'Start' },
        { lat: newEndLat, lng: newEndLng, label: 'End' },
      ],
      polyline: simplified,
      distance: run.distanceMeters,
      duration,
      instructions: [],
      landmarks: [],
    },
  };

  await dbPut('routes', saved);
  import('@/lib/supabase/sync').then(({ syncRoute }) => syncRoute(saved)).catch(() => {});
  return saved;
}

/**
 * Find candidate verified SavedRoutes near a start point with a target distance.
 * Sorted by (timesRun * avgAdherence) descending, with recency tiebreaker.
 */
export async function findCandidateRoutes(
  startLat: number,
  startLng: number,
  targetKm: number,
  maxResults: number = 5
): Promise<SavedRoute[]> {
  const all = await dbGetAll<SavedRoute>('routes');
  const targetMeters = targetKm * 1000;

  const filtered = all.filter((r) => {
    if (r.verified !== true) return false;
    const poly = r.route.polyline;
    if (!poly || poly.length < 2) return false;

    const [startPolyLng, startPolyLat] = poly[0];
    const startDist = haversineMeters(startLat, startLng, startPolyLat, startPolyLng);
    if (startDist > 200) return false;

    const diff = Math.abs(r.route.distance - targetMeters);
    if (diff / targetMeters > 0.15) return false;

    return true;
  });

  filtered.sort((a, b) => {
    const qa = (a.timesRun ?? 1) * (a.avgAdherence ?? 50);
    const qb = (b.timesRun ?? 1) * (b.avgAdherence ?? 50);
    if (qb !== qa) return qb - qa;
    const ta = a.lastRunAt ? Date.parse(a.lastRunAt) : 0;
    const tb = b.lastRunAt ? Date.parse(b.lastRunAt) : 0;
    return tb - ta;
  });

  return filtered.slice(0, maxResults);
}
