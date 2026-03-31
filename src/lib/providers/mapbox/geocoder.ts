import type { Geocoder, LatLng, Place } from '../types';

interface MapboxContext {
  neighborhood?: { name: string };
  place?: { name: string };
  country?: { name: string };
}

interface MapboxFeature {
  properties: {
    name?: string;
    full_address?: string;
    context?: MapboxContext;
  };
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
}

interface MapboxGeocodeResponse {
  features: MapboxFeature[];
}

export class MapboxGeocoder implements Geocoder {
  async reverseGeocode(lat: number, lng: number): Promise<Place> {
    try {
      const res = await fetch(`/api/mapbox/geocode?lat=${lat}&lng=${lng}`);
      const data: MapboxGeocodeResponse = await res.json();

      if (!data.features?.length) {
        return { name: 'Unknown', city: '', country: '', lat, lng };
      }

      const feature = data.features[0];
      const ctx = feature.properties.context || {};
      const neighborhood = ctx.neighborhood?.name || '';
      const city = ctx.place?.name || '';
      const country = ctx.country?.name || '';
      const name = neighborhood || city || feature.properties.name || 'Unknown';

      return { name, city, country, lat, lng };
    } catch {
      return { name: 'Unknown', city: '', country: '', lat, lng };
    }
  }

  async search(query: string, near?: LatLng): Promise<Place[]> {
    try {
      let url = `/api/mapbox/geocode?query=${encodeURIComponent(query)}`;
      if (near) {
        url += `&lng=${near.lng}&lat=${near.lat}`;
      }

      const res = await fetch(url);
      const data: MapboxGeocodeResponse = await res.json();

      if (!data.features?.length) {
        return [];
      }

      return data.features.map(feature => {
        const ctx = feature.properties.context || {};
        const city = ctx.place?.name || '';
        const country = ctx.country?.name || '';
        const name = feature.properties.name || feature.properties.full_address?.split(',')[0] || 'Unknown';

        return {
          name,
          city,
          country,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
        };
      });
    } catch {
      return [];
    }
  }
}
