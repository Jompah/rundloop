import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGeocoder } from '../geocoder';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeGeocodeResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 'OK',
    results: [
      {
        address_components: [
          { long_name: 'Kungsholmen', short_name: 'Kungsholmen', types: ['sublocality', 'political'] },
          { long_name: 'Stockholm', short_name: 'Stockholm', types: ['locality', 'political'] },
          { long_name: 'Sweden', short_name: 'SE', types: ['country', 'political'] },
        ],
        formatted_address: 'Kungsholmen, Stockholm, Sweden',
        geometry: { location: { lat: 59.33, lng: 18.04 } },
      },
    ],
    ...overrides,
  };
}

describe('GoogleGeocoder', () => {
  let geocoder: GoogleGeocoder;

  beforeEach(() => {
    geocoder = new GoogleGeocoder();
    vi.clearAllMocks();
  });

  describe('reverseGeocode', () => {
    it('extracts neighborhood, city, country from address_components', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGeocodeResponse()),
      });

      const result = await geocoder.reverseGeocode(59.33, 18.04);

      expect(result.name).toBe('Kungsholmen');
      expect(result.city).toBe('Stockholm');
      expect(result.country).toBe('Sweden');
      expect(result.lat).toBe(59.33);
      expect(result.lng).toBe(18.04);
    });

    it('calls the correct API endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGeocodeResponse()),
      });

      await geocoder.reverseGeocode(59.33, 18.04);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/google/geocode');
      expect(callUrl).toContain('latlng=59.33,18.04');
    });

    it('falls back to city when no sublocality', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'OK',
          results: [{
            address_components: [
              { long_name: 'Stockholm', short_name: 'Stockholm', types: ['locality'] },
              { long_name: 'Sweden', short_name: 'SE', types: ['country'] },
            ],
            formatted_address: 'Stockholm, Sweden',
            geometry: { location: { lat: 59.33, lng: 18.04 } },
          }],
        }),
      });

      const result = await geocoder.reverseGeocode(59.33, 18.04);
      expect(result.name).toBe('Stockholm');
    });

    it('returns Unknown on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await geocoder.reverseGeocode(59.33, 18.04);
      expect(result.name).toBe('Unknown');
      expect(result.city).toBe('');
    });

    it('returns Unknown on non-OK status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
      });

      const result = await geocoder.reverseGeocode(59.33, 18.04);
      expect(result.name).toBe('Unknown');
    });
  });

  describe('search', () => {
    it('returns places from geocoding results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGeocodeResponse()),
      });

      const results = await geocoder.search('Kungsholmen');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Kungsholmen');
      expect(results[0].lat).toBe(59.33);
    });

    it('calls with address param', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGeocodeResponse()),
      });

      await geocoder.search('Kungsholmen');

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('address=Kungsholmen');
    });

    it('returns empty on error', async () => {
      mockFetch.mockRejectedValue(new Error('fail'));
      const results = await geocoder.search('test');
      expect(results).toEqual([]);
    });
  });
});
