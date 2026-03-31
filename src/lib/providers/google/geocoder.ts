import type { Geocoder, LatLng, Place } from '../types';

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  address_components: GoogleAddressComponent[];
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
}

interface GoogleGeocodeResponse {
  results: GoogleGeocodeResult[];
  status: string;
}

function extractComponent(components: GoogleAddressComponent[], type: string): string {
  const match = components.find(c => c.types.includes(type));
  return match?.long_name || '';
}

export class GoogleGeocoder implements Geocoder {
  async reverseGeocode(lat: number, lng: number): Promise<Place> {
    try {
      const res = await fetch(`/api/google/geocode?latlng=${lat},${lng}`);
      const data: GoogleGeocodeResponse = await res.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return { name: 'Unknown', city: '', country: '', lat, lng };
      }

      const result = data.results[0];
      const neighborhood = extractComponent(result.address_components, 'sublocality')
        || extractComponent(result.address_components, 'neighborhood');
      const city = extractComponent(result.address_components, 'locality');
      const country = extractComponent(result.address_components, 'country');
      const name = neighborhood || city || result.formatted_address?.split(',')[0] || 'Unknown';

      return { name, city, country, lat, lng };
    } catch {
      return { name: 'Unknown', city: '', country: '', lat, lng };
    }
  }

  async search(query: string, near?: LatLng): Promise<Place[]> {
    try {
      let url = `/api/google/geocode?address=${encodeURIComponent(query)}`;
      if (near) {
        // Google geocoding doesn't directly support bias by proximity in the basic API,
        // but we pass it as a bounds hint for ranking
        const delta = 0.1;
        url += `&bounds=${near.lat - delta},${near.lng - delta}|${near.lat + delta},${near.lng + delta}`;
      }

      const res = await fetch(url);
      const data: GoogleGeocodeResponse = await res.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return [];
      }

      return data.results.map(result => {
        const city = extractComponent(result.address_components, 'locality');
        const country = extractComponent(result.address_components, 'country');
        const name = result.formatted_address?.split(',')[0] || 'Unknown';

        return {
          name,
          city,
          country,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        };
      });
    } catch {
      return [];
    }
  }
}
