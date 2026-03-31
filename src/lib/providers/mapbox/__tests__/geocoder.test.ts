import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapboxGeocoder } from '../geocoder';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeGeocodeResponse(overrides: Record<string, unknown> = {}) {
  return {
    features: [
      {
        properties: {
          name: 'Kungsholmen',
          full_address: 'Kungsholmen, Stockholm, Sweden',
          context: {
            neighborhood: { name: 'Kungsholmen' },
            place: { name: 'Stockholm' },
            country: { name: 'Sweden' },
          },
        },
        geometry: {
          coordinates: [18.04, 59.33],
        },
      },
    ],
    ...overrides,
  };
}

describe('MapboxGeocoder', () => {
  let geocoder: MapboxGeocoder;

  beforeEach(() => {
    geocoder = new MapboxGeocoder();
    vi.clearAllMocks();
  });

  describe('reverseGeocode', () => {
    it('extracts neighborhood, city, country from context', async () => {
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
      expect(callUrl).toContain('/api/mapbox/geocode');
      expect(callUrl).toContain('lat=59.33');
      expect(callUrl).toContain('lng=18.04');
    });

    it('falls back to city when no neighborhood', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          features: [{
            properties: {
              name: 'Stockholm',
              context: {
                place: { name: 'Stockholm' },
                country: { name: 'Sweden' },
              },
            },
            geometry: { coordinates: [18.04, 59.33] },
          }],
        }),
      });

      const result = await geocoder.reverseGeocode(59.33, 18.04);
      expect(result.name).toBe('Stockholm');
    });

    it('falls back to feature name when no context names', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          features: [{
            properties: {
              name: 'Norr Mälarstrand',
              context: {},
            },
            geometry: { coordinates: [18.04, 59.33] },
          }],
        }),
      });

      const result = await geocoder.reverseGeocode(59.33, 18.04);
      expect(result.name).toBe('Norr Mälarstrand');
    });

    it('returns Unknown on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await geocoder.reverseGeocode(59.33, 18.04);
      expect(result.name).toBe('Unknown');
      expect(result.city).toBe('');
    });

    it('returns Unknown when no features', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] }),
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
      expect(results[0].lng).toBe(18.04);
    });

    it('calls with query param', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGeocodeResponse()),
      });

      await geocoder.search('Kungsholmen');

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('query=Kungsholmen');
    });

    it('passes proximity when near is provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGeocodeResponse()),
      });

      await geocoder.search('Kungsholmen', { lat: 59.33, lng: 18.04 });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('lng=18.04');
      expect(callUrl).toContain('lat=59.33');
    });

    it('returns empty on error', async () => {
      mockFetch.mockRejectedValue(new Error('fail'));
      const results = await geocoder.search('test');
      expect(results).toEqual([]);
    });

    it('returns empty when no features', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] }),
      });

      const results = await geocoder.search('nowhere');
      expect(results).toEqual([]);
    });
  });
});
