import type { RoutingEngine, LatLng, ProviderRoute, ProviderInstruction } from '../types';

function decodeGooglePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

function mapManeuver(maneuver?: string): ProviderInstruction['type'] {
  if (!maneuver) return 'continue';
  if (maneuver.includes('left')) return 'turn-left';
  if (maneuver.includes('right')) return 'turn-right';
  if (maneuver.includes('uturn')) return 'u-turn';
  return 'continue';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export { decodeGooglePolyline };

interface GoogleStep {
  polyline: { points: string };
  html_instructions: string;
  distance: { value: number };
  start_location: { lat: number; lng: number };
  maneuver?: string;
  duration: { value: number };
}

interface GoogleLeg {
  steps: GoogleStep[];
  distance: { value: number };
  duration: { value: number };
}

interface GoogleRoute {
  legs: GoogleLeg[];
  overview_polyline: { points: string };
}

interface GoogleDirectionsResponse {
  routes: GoogleRoute[];
  status: string;
}

function normalizeGoogleRoute(route: GoogleRoute, paceSecondsPerKm: number): ProviderRoute {
  const allCoords: [number, number][] = [];
  const instructions: ProviderInstruction[] = [];

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      const stepCoords = decodeGooglePolyline(step.polyline.points);
      allCoords.push(...stepCoords);

      instructions.push({
        type: mapManeuver(step.maneuver),
        text: stripHtml(step.html_instructions),
        distance: step.distance.value,
        location: [step.start_location.lng, step.start_location.lat],
      });
    }
  }

  const totalDistanceM = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
  const runningDuration = (totalDistanceM / 1000) * paceSecondsPerKm;

  return {
    polyline: allCoords,
    distance: totalDistanceM,
    duration: runningDuration,
    instructions,
  };
}

export class GoogleRouter implements RoutingEngine {
  async getRoute(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

    const params = new URLSearchParams({ origin, destination });
    if (waypoints.length > 2) {
      const viaPoints = waypoints.slice(1, -1).map(w => `${w.lat},${w.lng}`).join('|');
      params.set('waypoints', viaPoints);
    }

    const res = await fetch(`/api/google/directions?${params.toString()}`);
    const data: GoogleDirectionsResponse = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Google Directions API error: ${data.status}`);
    }

    return normalizeGoogleRoute(data.routes[0], paceSecondsPerKm);
  }

  async getRouteWithAlternatives(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute[]> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

    const params = new URLSearchParams({ origin, destination });
    if (waypoints.length > 2) {
      const viaPoints = waypoints.slice(1, -1).map(w => `${w.lat},${w.lng}`).join('|');
      params.set('waypoints', viaPoints);
    }

    const res = await fetch(`/api/google/directions?${params.toString()}`);
    const data: GoogleDirectionsResponse = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Google Directions API error: ${data.status}`);
    }

    return data.routes.map(route => normalizeGoogleRoute(route, paceSecondsPerKm));
  }
}
