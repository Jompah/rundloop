// src/lib/providers/open/__tests__/poi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenPOIProvider } from '../poi';

vi.mock('@/lib/overpass', () => ({
  fetchLandmarksNearRoute: vi.fn(),
}));

import { fetchLandmarksNearRoute } from '@/lib/overpass';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockLandmarks = vi.mocked(fetchLandmarksNearRoute);

describe('OpenPOIProvider', () => {
  let provider: OpenPOIProvider;

  beforeEach(() => {
    provider = new OpenPOIProvider();
    vi.clearAllMocks();
  });

  it('getLandmarks delegates to fetchLandmarksNearRoute and normalizes', async () => {
    mockLandmarks.mockResolvedValue([
      { id: 1, name: 'Stadshuset', type: 'landmark', lat: 59.33, lng: 18.05, description: 'City Hall' },
    ]);

    const polyline: [number, number][] = [[18.04, 59.32], [18.06, 59.34]];
    const result = await provider.getLandmarks(polyline, 300);

    expect(mockLandmarks).toHaveBeenCalledWith(polyline, 300);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Stadshuset');
    expect(result[0].type).toBe('landmark');
    expect(result[0].lat).toBe(59.33);
    expect(result[0].lng).toBe(18.05);
  });

  it('getNaturePOIs calls /api/pois and normalizes response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        pois: [
          { id: 10, name: 'Rålambshovsparken', lat: 59.33, lng: 18.03, type: 'park' },
        ],
      }),
    });

    const result = await provider.getNaturePOIs({ lat: 59.33, lng: 18.03 }, 2);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Rålambshovsparken');
    expect(result[0].type).toBe('park');
  });

  it('getIslandOutline calls /api/island-outline and normalizes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        island: {
          name: 'Kungsholmen',
          perimeterKm: 8.5,
          outline: [
            { lat: 59.33, lng: 18.03 },
            { lat: 59.34, lng: 18.05 },
          ],
        },
      }),
    });

    const result = await provider.getIslandOutline(59.33, 18.04);
    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(2);
    expect(result!.points[0].lat).toBe(59.33);
  });

  it('getIslandOutline returns null when no island found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ island: null }),
    });

    const result = await provider.getIslandOutline(59.33, 18.04);
    expect(result).toBeNull();
  });
});
