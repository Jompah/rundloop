import { RouteWaypoint, GeneratedRoute, TurnInstruction } from '@/types';
import { countShortSegments } from '@/lib/route-quality';

const OSRM_BASE = 'https://router.project-osrm.org';

interface OSRMStep {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
    instruction?: string;
  };
  name: string;
}

interface OSRMRoute {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  legs: {
    steps: OSRMStep[];
    distance: number;
    duration: number;
  }[];
}

function mapManeuverType(type: string, modifier?: string): TurnInstruction['type'] {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (type === 'turn' || type === 'end of road' || type === 'fork') {
    if (modifier?.includes('left')) return 'turn-left';
    if (modifier?.includes('right')) return 'turn-right';
    if (modifier?.includes('uturn') || modifier?.includes('u-turn')) return 'u-turn';
  }
  return 'straight';
}

function formatInstruction(step: OSRMStep): string {
  const { maneuver, name } = step;
  const streetName = name || 'the path';

  switch (maneuver.type) {
    case 'depart':
      return `Start on ${streetName}`;
    case 'arrive':
      return 'You have arrived';
    case 'turn':
    case 'end of road':
      if (maneuver.modifier?.includes('left')) return `Turn left onto ${streetName}`;
      if (maneuver.modifier?.includes('right')) return `Turn right onto ${streetName}`;
      return `Continue onto ${streetName}`;
    case 'fork':
      if (maneuver.modifier?.includes('left')) return `Keep left onto ${streetName}`;
      if (maneuver.modifier?.includes('right')) return `Keep right onto ${streetName}`;
      return `Continue onto ${streetName}`;
    case 'roundabout':
      return `Enter roundabout, then continue on ${streetName}`;
    default:
      return `Continue on ${streetName}`;
  }
}

/**
 * Route waypoints via OSRM foot profile.
 * @param waypoints - Array of lat/lng waypoints
 * @param paceSecondsPerKm - Running pace in seconds per km (default 360 = 6:00/km).
 *   OSRM returns walking pace (~5 km/h) which gives unrealistic running times.
 *   We keep OSRM's accurate distance but override duration with this pace.
 */
export async function routeViaOSRM(waypoints: RouteWaypoint[], paceSecondsPerKm: number = 360): Promise<GeneratedRoute> {
  if (waypoints.length < 2) {
    throw new Error('Need at least 2 waypoints for routing');
  }

  // Build coordinates string for OSRM (lng,lat format)
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

  const url = `${OSRM_BASE}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
  } catch (fetchErr: unknown) {
    const err = fetchErr as { name?: string; message?: string } | null;
    if (err?.name === 'AbortError') {
      throw new Error('Route server timed out. Check your internet connection and try again.');
    }
    throw new Error(`Could not reach route server: ${err?.message || 'network error'}. Check your internet connection.`);
  }

  if (!res.ok) {
    throw new Error(`OSRM routing failed (${res.status})`);
  }

  interface OSRMResponse {
    code: string;
    routes?: OSRMRoute[];
  }

  let data: OSRMResponse;
  try {
    data = (await res.json()) as OSRMResponse;
  } catch {
    throw new Error('Invalid response from route server');
  }

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(`OSRM could not find a route: ${data.code}`);
  }

  const route: OSRMRoute = data.routes[0];

  // Extract turn-by-turn instructions from all legs
  const instructions: TurnInstruction[] = [];
  for (const leg of route.legs) {
    for (const step of leg.steps) {
      if (step.distance < 5 && step.maneuver.type !== 'arrive' && step.maneuver.type !== 'depart') {
        continue; // Skip very short steps
      }
      instructions.push({
        text: formatInstruction(step),
        distance: step.distance,
        location: step.maneuver.location,
        type: mapManeuverType(step.maneuver.type, step.maneuver.modifier),
      });
    }
  }

  // Override OSRM walking duration with running pace estimate.
  // OSRM foot profile returns ~5 km/h (walking), which gives unrealistic running times.
  // Keep OSRM's accurate distance, just recalculate time based on running pace.
  const runningDuration = (route.distance / 1000) * paceSecondsPerKm;

  // Log short segment analysis for debugging route quality
  const polyline = route.geometry.coordinates as [number, number][];
  const shortCount = countShortSegments(polyline, 50);
  const totalSegments = Math.max(polyline.length - 1, 1);
  if (shortCount > 0) {
    console.log(
      `[OSRM] Korta segment (<50m): ${shortCount}/${totalSegments} (${((shortCount / totalSegments) * 100).toFixed(1)}%)`
    );
  }

  return {
    waypoints,
    polyline,
    distance: route.distance,
    duration: runningDuration,
    instructions,
  };
}
