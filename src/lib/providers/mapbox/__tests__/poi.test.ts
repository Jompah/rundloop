import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapboxPOIProvider } from '../poi';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/lib/overpass', () => ({
  fetchLandmarksNearRoute: vi.fn(),
}));

import { fetchLandmarksNearRoute } from '@/lib/overpass';
const mockFetchLandmarks = vi.mocked(fetchLandmarksNearRoute);

describe('MapboxPOIProvider', () => {
  let poi: MapboxPOIProvider;

  beforeEach(() => {
    poi = new MapboxPOIProvider();
    vi.clearAllMocks();
  });

  describe('getNaturePOIs', () => {
    it('queries /api/pois and returns mapped POIs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          pois: [
            { name: 'Rålambshovsparken', lat: 59.327, lng: 18.038, type: 'park' },
            { name: 'Kronobergsparken', lat: 59.334, lng: 18.039, type: 'park' },
          ],
        }),
      });

      const results = await poi.getNaturePOIs({ lat: 59.33, lng: 18.04 }, 2);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/pois');
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
    it('calls fetchLandmarksNearRoute and maps results', async () => {
      mockFetchLandmarks.mockResolvedValue([
        {
          id: '1',
          name: 'City Hall',
          type: 'landmark',
          lat: 59.327,
          lng: 18.054,
          description: 'Stockholm City Hall',
          distance: 150,
        },
        {
          id: '2',
          name: 'Old Church',
          type: 'church',
          lat: 59.33,
          lng: 18.05,
          description: 'Historic church',
          distance: 200,
        },
      ]);

      const polyline: [number, number][] = [
        [18.04, 59.33],
        [18.06, 59.33],
      ];

      const results = await poi.getLandmarks(polyline, 300);

      expect(mockFetchLandmarks).toHaveBeenCalledWith(polyline, 300);
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('City Hall');
      expect(results[0].emoji).toBe('📍');
      expect(results[1].name).toBe('Old Church');
      expect(results[1].emoji).toBe('⛪');
    });

    it('returns empty on error', async () => {
      mockFetchLandmarks.mockRejectedValue(new Error('fail'));
      const results = await poi.getLandmarks([[18.04, 59.33]]);
      expect(results).toEqual([]);
    });
  });

  describe('getIslandOutline', () => {
    it('returns island polygon from /api/island-outline', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          island: {
            outline: [
              { lat: 59.33, lng: 18.04 },
              { lat: 59.34, lng: 18.05 },
              { lat: 59.33, lng: 18.06 },
            ],
          },
        }),
      });

      const result = await poi.getIslandOutline(59.33, 18.04);

      expect(result).not.toBeNull();
      expect(result!.points).toHaveLength(3);
      expect(result!.points[0]).toEqual({ lat: 59.33, lng: 18.04 });
    });

    it('returns null when no island data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ island: null }),
      });

      const result = await poi.getIslandOutline(59.33, 18.04);
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('fail'));
      const result = await poi.getIslandOutline(59.33, 18.04);
      expect(result).toBeNull();
    });
  });
});
