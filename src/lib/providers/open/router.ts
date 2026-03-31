import type { RoutingEngine, LatLng, ProviderRoute, ProviderInstruction } from '../types';
import { routeViaOSRM } from '@/lib/route-osrm';
import type { TurnInstruction } from '@/types';

function mapInstructionType(type: TurnInstruction['type']): ProviderInstruction['type'] {
  if (type === 'straight') return 'continue';
  return type;
}

function toProviderRoute(osrmResult: Awaited<ReturnType<typeof routeViaOSRM>>): ProviderRoute {
  return {
    polyline: osrmResult.polyline,
    distance: osrmResult.distance,
    duration: osrmResult.duration,
    instructions: osrmResult.instructions.map((inst) => ({
      type: mapInstructionType(inst.type),
      text: inst.text,
      distance: inst.distance,
      location: inst.location,
    })),
    metadata: {
      waypoints: osrmResult.waypoints,
      landmarks: osrmResult.landmarks,
      walkToStart: osrmResult.walkToStart,
    },
  };
}

export class OpenRouter implements RoutingEngine {
  async getRoute(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute> {
    const routeWaypoints = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
    const result = await routeViaOSRM(routeWaypoints, paceSecondsPerKm);
    return toProviderRoute(result);
  }

  async getRouteWithAlternatives(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute[]> {
    const route = await this.getRoute(waypoints, paceSecondsPerKm);
    return [route];
  }
}
