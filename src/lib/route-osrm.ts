import { RouteWaypoint, GeneratedRoute, TurnInstruction } from '@/types';

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

export async function routeViaOSRM(waypoints: RouteWaypoint[]): Promise<GeneratedRoute> {
  if (waypoints.length < 2) {
    throw new Error('Need at least 2 waypoints for routing');
  }

  // Build coordinates string for OSRM
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

  const url = `${OSRM_BASE}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM routing failed (${res.status})`);
  }

  const data = await res.json();

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

  return {
    waypoints,
    polyline: route.geometry.coordinates,
    distance: route.distance,
    duration: route.duration,
    instructions,
  };
}
