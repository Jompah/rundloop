// src/lib/providers/open/__tests__/geocoder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenGeocoder } from '../geocoder';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OpenGeocoder', () => {
  let geocoder: OpenGeocoder;

  beforeEach(() => {
    geocoder = new OpenGeocoder();
    vi.clearAllMocks();
  });

  it('reverseGeocode returns Place with suburb and city', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        display_name: 'Kungsholmen, Stockholm, Sweden',
        address: {
          suburb: 'Kungsholmen',
          city: 'Stockholm',
          country: 'Sweden',
        },
      }),
    });

    const place = await geocoder.reverseGeocode(59.33, 18.04);
    expect(place.name).toBe('Kungsholmen');
    expect(place.city).toBe('Stockholm');
    expect(place.country).toBe('Sweden');
    expect(place.lat).toBe(59.33);
    expect(place.lng).toBe(18.04);
  });

  it('reverseGeocode falls back to display_name when address parts missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        display_name: 'Some Place, Italy',
        address: {},
      }),
    });

    const place = await geocoder.reverseGeocode(37.5, 15.1);
    expect(place.name).toBe('Some Place');
  });

  it('reverseGeocode returns unknown on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const place = await geocoder.reverseGeocode(0, 0);
    expect(place.name).toBe('Unknown');
  });

  it('search returns empty array (not yet supported by Nominatim adapter)', async () => {
    const results = await geocoder.search('Stockholm');
    expect(results).toEqual([]);
  });
});
