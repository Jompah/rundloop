// src/lib/providers/open/geocoder.ts
import type { Geocoder, LatLng, Place } from '../types';

export class OpenGeocoder implements Geocoder {
  async reverseGeocode(lat: number, lng: number): Promise<Place> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`,
        { headers: { 'User-Agent': 'Drift/1.0' } }
      );
      const data = await res.json();

      const suburb = data.address?.suburb || data.address?.neighbourhood || '';
      const city = data.address?.city || data.address?.town || data.address?.village || '';
      const country = data.address?.country || '';
      const name = suburb || city || data.display_name?.split(',')[0] || 'Unknown';

      return { name, city, country, lat, lng };
    } catch {
      return { name: 'Unknown', city: '', country: '', lat, lng };
    }
  }

  async search(_query: string, _near?: LatLng): Promise<Place[]> {
    return [];
  }
}
