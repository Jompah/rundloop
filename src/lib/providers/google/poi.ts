import type { POIProvider, LatLng, POI, Polygon } from '../types';

const GOOGLE_TYPE_MAP: Record<string, string> = {
  park: 'park',
  museum: 'museum',
  church: 'church',
  art_gallery: 'artwork',
  tourist_attraction: 'landmark',
  natural_feature: 'nature',
};

const POI_EMOJIS: Record<string, string> = {
  park: '🌳',
  museum: '🏛️',
  church: '⛪',
  artwork: '🎨',
  landmark: '📍',
  nature: '🌿',
};

function classifyGoogleType(types: string[]): string {
  for (const t of types) {
    if (GOOGLE_TYPE_MAP[t]) return GOOGLE_TYPE_MAP[t];
  }
  return 'landmark';
}

interface GooglePlaceResult {
  name: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
}

interface GooglePlacesResponse {
  results: GooglePlaceResult[];
  status: string;
}

export class GooglePOIProvider implements POIProvider {
  async getNaturePOIs(center: LatLng, radiusKm: number): Promise<POI[]> {
    try {
      const radiusM = Math.round(radiusKm * 1000);
      const res = await fetch(
        `/api/google/places?lat=${center.lat}&lng=${center.lng}&radius=${radiusM}&type=park`
      );
      const data: GooglePlacesResponse = await res.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return [];
      }

      return data.results.map(place => {
        const type = classifyGoogleType(place.types);
        return {
          name: place.name,
          type,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          emoji: POI_EMOJIS[type] || '🌿',
        };
      });
    } catch {
      return [];
    }
  }

  async getLandmarks(polyline: [number, number][], bufferMeters: number = 300): Promise<POI[]> {
    try {
      // Use the midpoint of the polyline as the search center
      if (!polyline.length) return [];

      const midIdx = Math.floor(polyline.length / 2);
      const [lng, lat] = polyline[midIdx];

      // Calculate a radius that covers the route extent
      const lats = polyline.map(p => p[1]);
      const lngs = polyline.map(p => p[0]);
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lngSpan = Math.max(...lngs) - Math.min(...lngs);
      const spanDeg = Math.max(latSpan, lngSpan);
      const radiusM = Math.max(Math.round(spanDeg * 111000 / 2) + bufferMeters, 500);

      const types = ['tourist_attraction', 'museum', 'park'];
      const allPlaces: GooglePlaceResult[] = [];

      for (const type of types) {
        const res = await fetch(
          `/api/google/places?lat=${lat}&lng=${lng}&radius=${radiusM}&type=${type}`
        );
        const data: GooglePlacesResponse = await res.json();
        if (data.status === 'OK' && data.results) {
          allPlaces.push(...data.results);
        }
      }

      // Deduplicate by name
      const seen = new Set<string>();
      const unique: GooglePlaceResult[] = [];
      for (const place of allPlaces) {
        const key = place.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(place);
        }
      }

      return unique.slice(0, 6).map(place => {
        const type = classifyGoogleType(place.types);
        return {
          name: place.name,
          type,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          emoji: POI_EMOJIS[type] || '📍',
        };
      });
    } catch {
      return [];
    }
  }

  async getIslandOutline(_lat: number, _lng: number): Promise<Polygon | null> {
    return null;
  }
}
