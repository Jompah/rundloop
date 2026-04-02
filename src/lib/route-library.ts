import { getSavedRoutes } from './storage';
import type { SavedRoute } from './storage';
import type { RunAnalysis } from './run-analysis-types';
import { dbPut } from './db';

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

  candidates.sort((a, b) => a.distanceDiff - b.distanceDiff);
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
}
