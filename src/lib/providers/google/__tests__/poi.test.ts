import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GooglePOIProvider } from '../poi';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makePlacesResponse(results: Record<string, unknown>[] = []) {
  return {
    status: 'OK',
    results: results.length ? results : [
      {
        name: 'Rålambshovsparken',
        geometry: { location: { lat: 59.327, lng: 18.038 } },
        types: ['park', 'point_of_interest'],
      },
      {
        name: 'Kronobergsparken',
        geometry: { location: { lat: 59.334, lng: 18.039 } },
        types: ['park', 'point_of_interest'],
      },
    ],
  };
}

describe('GooglePOIProvider', () => {
  let poi: GooglePOIProvider;

  beforeEach(() => {
    poi = new GooglePOIProvider();
    vi.clearAllMocks();
  });

  describe('getNaturePOIs', () => {
    it('queries /api/google/places with type=park', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makePlacesResponse()),
      });

      const results = await poi.getNaturePOIs({ lat: 59.33, lng: 18.04 }, 2);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/google/places');
      expect(callUrl).toContain('type=park');
      expect(callUrl).toContain('radius=2000');

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Rålambshovsparken');
      expect(results[0].type).toBe('park');
      expect(results[0].emoji).toBe('🌳');
    });

    it('returns empty on error', async () => {
      mockFetch.mockRejectedValue(new Error('fail'));
      const results = await poi.getNaturePOIs({ lat: 59.33, lng: 18.04 }, 2);
      expect(results).toEqual([]);
    });
  });

  describe('getLandmarks', () => {
    it('queries multiple types and deduplicates', async () => {
      // Return different results for each type query
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makePlacesResponse([
            { name: 'City Hall', geometry: { location: { lat: 59.327, lng: 18.054 } }, types: ['tourist_attraction'] },
            { name: 'Vasa Museum', geometry: { location: { lat: 59.328, lng: 18.091 } }, types: ['tourist_attraction', 'museum'] },
          ])),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makePlacesResponse([
            { name: 'Vasa Museum', geometry: { location: { lat: 59.328, lng: 18.091 } }, types: ['museum'] },
            { name: 'Nordic Museum', geometry: { location: { lat: 59.329, lng: 18.092 } }, types: ['museum'] },
          ])),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makePlacesResponse([
            { name: 'Humlegården', geometry: { location: { lat: 59.34, lng: 18.07 } }, types: ['park'] },
          ])),
        });

      const polyline: [number, number][] = [
        [18.04, 59.33],
        [18.06, 59.33],
        [18.08, 59.33],
      ];

      const results = await poi.getLandmarks(polyline);

      // 3 fetch calls: tourist_attraction, museum, park
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // "Vasa Museum" appears twice but should be deduped
      expect(results.filter(r => r.name === 'Vasa Museum')).toHaveLength(1);
      // Total unique: City Hall, Vasa Museum, Nordic Museum, Humlegården = 4
      expect(results).toHaveLength(4);
    });

    it('limits results to 6', async () => {
      const manyPlaces = Array.from({ length: 10 }, (_, i) => ({
        name: `Place ${i}`,
        geometry: { location: { lat: 59.33, lng: 18.04 + i * 0.01 } },
        types: ['tourist_attraction'],
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makePlacesResponse(manyPlaces)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
        });

      const polyline: [number, number][] = [[18.04, 59.33], [18.08, 59.33]];
      const results = await poi.getLandmarks(polyline);

      expect(results.length).toBeLessThanOrEqual(6);
    });

    it('classifies Google types correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makePlacesResponse([
            { name: 'Museum', geometry: { location: { lat: 59.33, lng: 18.04 } }, types: ['museum'] },
          ])),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
        });

      const results = await poi.getLandmarks([[18.04, 59.33], [18.08, 59.33]]);

      expect(results[0].type).toBe('museum');
      expect(results[0].emoji).toBe('🏛️');
    });

    it('returns empty on error', async () => {
      mockFetch.mockRejectedValue(new Error('fail'));
      const results = await poi.getLandmarks([[18.04, 59.33]]);
      expect(results).toEqual([]);
    });
  });

  describe('getIslandOutline', () => {
    it('returns null (not supported)', async () => {
      const result = await poi.getIslandOutline(59.33, 18.04);
      expect(result).toBeNull();
    });
  });
});
