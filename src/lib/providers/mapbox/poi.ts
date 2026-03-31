import type { POIProvider, LatLng, POI, Polygon } from '../types';
import { fetchLandmarksNearRoute } from '@/lib/overpass';

const LANDMARK_EMOJIS: Record<string, string> = {
  museum: '🏛️',
  monument: '🗿',
  viewpoint: '👁️',
  park: '🌳',
  church: '⛪',
  historic: '🏰',
  artwork: '🎨',
  fountain: '⛲',
  ruins: '🏚️',
  castle: '🏰',
  landmark: '📍',
};

export class MapboxPOIProvider implements POIProvider {
  async getNaturePOIs(center: LatLng, radiusKm: number): Promise<POI[]> {
    try {
      const radiusM = Math.round(radiusKm * 1000);
      const res = await fetch(`/api/pois?lat=${center.lat}&lng=${center.lng}&radius=${radiusM}`);
      const data = await res.json();

      return (data.pois || []).map((p: { name: string; lat: number; lng: number; type: string }) => ({
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        emoji: LANDMARK_EMOJIS[p.type] || '🌿',
      }));
    } catch {
      return [];
    }
  }

  async getLandmarks(polyline: [number, number][], bufferMeters: number = 300): Promise<POI[]> {
    try {
      const landmarks = await fetchLandmarksNearRoute(polyline, bufferMeters);
      return landmarks.map((lm) => ({
        name: lm.name,
        type: lm.type,
        lat: lm.lat,
        lng: lm.lng,
        emoji: LANDMARK_EMOJIS[lm.type] || '📍',
        metadata: { description: lm.description, distance: lm.distance, id: lm.id },
      }));
    } catch {
      return [];
    }
  }

  async getIslandOutline(lat: number, lng: number): Promise<Polygon | null> {
    try {
      const res = await fetch(`/api/island-outline?lat=${lat}&lng=${lng}`);
      const data = await res.json();

      if (!data.island) return null;

      return {
        points: data.island.outline.map((p: { lat: number; lng: number }) => ({
          lat: p.lat,
          lng: p.lng,
        })),
      };
    } catch {
      return null;
    }
  }
}
