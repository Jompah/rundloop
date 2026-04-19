import { RouteWaypoint, GeneratedRoute, TurnInstruction } from '@/types';

function decodePolyline(encoded: string): [number, number][] {
  // Standard Google polyline decoder — returns [lng, lat] pairs
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

function mapGoogleManeuver(maneuver?: string): TurnInstruction['type'] {
  if (!maneuver) return 'straight';
  if (maneuver.includes('LEFT') || maneuver.includes('left')) return 'turn-left';
  if (maneuver.includes('RIGHT') || maneuver.includes('right')) return 'turn-right';
  if (maneuver.includes('U_TURN') || maneuver.includes('uturn')) return 'u-turn';
  return 'straight';
}

export async function routeViaGoogle(
  waypoints: RouteWaypoint[],
  paceSecondsPerKm: number = 360
): Promise<GeneratedRoute> {
  if (waypoints.length < 2) {
    throw new Error('Need at least 2 waypoints');
  }

  const origin = { location: { latLng: { latitude: waypoints[0].lat, longitude: waypoints[0].lng } } };
  const destination = { location: { latLng: { latitude: waypoints[waypoints.length - 1].lat, longitude: waypoints[waypoints.length - 1].lng } } };
  const intermediates = waypoints.slice(1, -1).map(w => ({
    location: { latLng: { latitude: w.lat, longitude: w.lng } }
  }));

  type LatLngLocation = { location: { latLng: { latitude: number; longitude: number } } };
  interface GoogleRoutesBody {
    origin: LatLngLocation;
    destination: LatLngLocation;
    travelMode: 'WALK' | 'DRIVE' | 'BICYCLE' | 'TWO_WHEELER' | 'TRANSIT';
    intermediates?: LatLngLocation[];
  }

  const body: GoogleRoutesBody = {
    origin,
    destination,
    travelMode: 'WALK',
  };
  if (intermediates.length > 0) {
    body.intermediates = intermediates;
  }

  const res = await fetch('/api/google/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    throw new Error(data.error || `Google Routes failed (${res.status})`);
  }

  const data = await res.json();

  if (!data.routes?.length) {
    throw new Error('Google Routes returned no routes');
  }

  const route = data.routes[0];
  const polyline = route.polyline?.encodedPolyline
    ? decodePolyline(route.polyline.encodedPolyline)
    : [];

  const distance = route.distanceMeters || 0;
  const runningDuration = (distance / 1000) * paceSecondsPerKm;

  // Extract turn instructions from steps
  const instructions: TurnInstruction[] = [];
  if (route.legs) {
    for (const leg of route.legs) {
      if (leg.steps) {
        for (const step of leg.steps) {
          const nav = step.navigationInstruction;
          if (nav) {
            instructions.push({
              text: nav.instructions || '',
              distance: step.distanceMeters || 0,
              location: step.startLocation?.latLng
                ? [step.startLocation.latLng.longitude, step.startLocation.latLng.latitude]
                : [0, 0],
              type: mapGoogleManeuver(nav.maneuver),
            });
          }
        }
      }
    }
  }

  return {
    waypoints,
    polyline,
    distance,
    duration: runningDuration,
    instructions,
  };
}
