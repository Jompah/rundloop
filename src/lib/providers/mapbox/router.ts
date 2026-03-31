import type { RoutingEngine, LatLng, ProviderRoute, ProviderInstruction } from '../types';

interface MapboxManeuver {
  type: string;
  modifier?: string;
  location: [number, number];
  instruction: string;
}

interface MapboxStep {
  maneuver: MapboxManeuver;
  distance: number;
  name: string;
}

interface MapboxLeg {
  steps: MapboxStep[];
}

interface MapboxRoute {
  geometry: {
    coordinates: [number, number][];
  };
  distance: number;
  duration: number;
  legs: MapboxLeg[];
}

interface MapboxDirectionsResponse {
  code: string;
  routes: MapboxRoute[];
}

function mapManeuver(type: string, modifier?: string): ProviderInstruction['type'] {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (type === 'turn' && modifier === 'left') return 'turn-left';
  if (type === 'turn' && modifier === 'right') return 'turn-right';
  if (type === 'uturn') return 'u-turn';
  return 'continue';
}

function normalizeMapboxRoute(route: MapboxRoute, paceSecondsPerKm: number): ProviderRoute {
  const instructions: ProviderInstruction[] = [];

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      // Skip steps shorter than 5m
      if (step.distance < 5) continue;

      instructions.push({
        type: mapManeuver(step.maneuver.type, step.maneuver.modifier),
        text: step.maneuver.instruction,
        distance: step.distance,
        location: step.maneuver.location,
      });
    }
  }

  const runningDuration = (route.distance / 1000) * paceSecondsPerKm;

  return {
    polyline: route.geometry.coordinates,
    distance: route.distance,
    duration: runningDuration,
    instructions,
  };
}

export class MapboxRouter implements RoutingEngine {
  async getRoute(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    const coordinates = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const res = await fetch(`/api/mapbox/directions?coordinates=${coordinates}`);
    const data: MapboxDirectionsResponse = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`Mapbox Directions API error: ${data.code}`);
    }

    return normalizeMapboxRoute(data.routes[0], paceSecondsPerKm);
  }

  async getRouteWithAlternatives(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute[]> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    const coordinates = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const res = await fetch(`/api/mapbox/directions?coordinates=${coordinates}&alternatives=true`);
    const data: MapboxDirectionsResponse = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`Mapbox Directions API error: ${data.code}`);
    }

    return data.routes.map(route => normalizeMapboxRoute(route, paceSecondsPerKm));
  }
}
