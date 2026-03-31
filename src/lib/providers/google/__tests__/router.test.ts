import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleRouter, decodeGooglePolyline } from '../router';
import type { LatLng } from '../../types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeGoogleResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 'OK',
    routes: [
      {
        overview_polyline: { points: '_p~iF~ps|U' },
        legs: [
          {
            distance: { value: 2500 },
            duration: { value: 1800 },
            steps: [
              {
                polyline: { points: '_p~iF~ps|U_ulLnnqC' },
                html_instructions: '<b>Head</b> <i>north</i> on <b>Main St</b>',
                distance: { value: 1200 },
                duration: { value: 900 },
                start_location: { lat: 59.33, lng: 18.07 },
                maneuver: 'turn-left',
              },
              {
                polyline: { points: '_mqiF~bs|U_seK_seK' },
                html_instructions: 'Turn <b>right</b> onto Park Ave',
                distance: { value: 1300 },
                duration: { value: 900 },
                start_location: { lat: 59.335, lng: 18.075 },
                maneuver: 'turn-right',
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('GoogleRouter', () => {
  let router: GoogleRouter;

  beforeEach(() => {
    router = new GoogleRouter();
    vi.clearAllMocks();
  });

  describe('decodeGooglePolyline', () => {
    it('decodes a simple encoded polyline', () => {
      // Known test: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" decodes to 3 points
      const coords = decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
      expect(coords).toHaveLength(3);
      // First point should be approximately [-120.2, 38.5]
      expect(coords[0][1]).toBeCloseTo(38.5, 0);
      expect(coords[0][0]).toBeCloseTo(-120.2, 0);
    });

    it('returns [lng, lat] order (GeoJSON convention)', () => {
      const coords = decodeGooglePolyline('_p~iF~ps|U');
      expect(coords).toHaveLength(1);
      // [lng, lat] order
      const [lng, lat] = coords[0];
      expect(lat).toBeCloseTo(38.5, 0);
      expect(lng).toBeCloseTo(-120.2, 0);
    });
  });

  describe('getRoute', () => {
    it('calls /api/google/directions and normalizes response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoogleResponse()),
      });

      const waypoints: LatLng[] = [
        { lat: 59.33, lng: 18.07 },
        { lat: 59.34, lng: 18.08 },
      ];

      const result = await router.getRoute(waypoints, 360);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/google/directions');
      expect(callUrl).toContain('origin=59.33');
      expect(callUrl).toContain('destination=59.34');

      expect(result.distance).toBe(2500);
      expect(result.instructions).toHaveLength(2);
      expect(result.polyline.length).toBeGreaterThan(0);
    });

    it('strips HTML from instructions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoogleResponse()),
      });

      const result = await router.getRoute(
        [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }]
      );

      expect(result.instructions[0].text).toBe('Head north on Main St');
      expect(result.instructions[0].text).not.toContain('<b>');
    });

    it('maps maneuver types correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoogleResponse()),
      });

      const result = await router.getRoute(
        [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }]
      );

      expect(result.instructions[0].type).toBe('turn-left');
      expect(result.instructions[1].type).toBe('turn-right');
    });

    it('overrides walking duration with running pace', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoogleResponse()),
      });

      const paceSecondsPerKm = 300; // 5:00/km
      const result = await router.getRoute(
        [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }],
        paceSecondsPerKm
      );

      // 2500m = 2.5km * 300s/km = 750s
      expect(result.duration).toBe(750);
    });

    it('passes intermediate waypoints', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoogleResponse()),
      });

      await router.getRoute([
        { lat: 59.33, lng: 18.07 },
        { lat: 59.335, lng: 18.075 },
        { lat: 59.34, lng: 18.08 },
      ]);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('waypoints=59.335');
    });

    it('throws on non-OK status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ZERO_RESULTS', routes: [] }),
      });

      await expect(
        router.getRoute([{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }])
      ).rejects.toThrow('Google Directions API error');
    });

    it('throws if fewer than 2 waypoints', async () => {
      await expect(
        router.getRoute([{ lat: 59.33, lng: 18.07 }])
      ).rejects.toThrow('At least 2 waypoints');
    });
  });

  describe('getRouteWithAlternatives', () => {
    it('returns multiple routes when available', async () => {
      const response = makeGoogleResponse();
      // Add a second route
      (response.routes as unknown[]).push({
        overview_polyline: { points: '_p~iF~ps|U' },
        legs: [
          {
            distance: { value: 3000 },
            duration: { value: 2100 },
            steps: [
              {
                polyline: { points: '_p~iF~ps|U_ulLnnqC' },
                html_instructions: 'Alternative route',
                distance: { value: 3000 },
                duration: { value: 2100 },
                start_location: { lat: 59.33, lng: 18.07 },
              },
            ],
          },
        ],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const results = await router.getRouteWithAlternatives(
        [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }]
      );

      expect(results).toHaveLength(2);
      expect(results[0].distance).toBe(2500);
      expect(results[1].distance).toBe(3000);
    });
  });
});
