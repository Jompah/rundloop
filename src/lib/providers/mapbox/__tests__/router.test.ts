import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapboxRouter } from '../router';
import type { LatLng } from '../../types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeMapboxResponse(overrides: Record<string, unknown> = {}) {
  return {
    code: 'Ok',
    routes: [
      {
        geometry: {
          coordinates: [
            [18.07, 59.33],
            [18.075, 59.335],
            [18.08, 59.34],
          ],
        },
        distance: 2500,
        duration: 1800,
        legs: [
          {
            steps: [
              {
                maneuver: {
                  type: 'depart',
                  modifier: undefined,
                  location: [18.07, 59.33],
                  instruction: 'Head north on Main St',
                },
                distance: 1200,
                name: 'Main St',
              },
              {
                maneuver: {
                  type: 'turn',
                  modifier: 'left',
                  location: [18.075, 59.335],
                  instruction: 'Turn left onto Park Ave',
                },
                distance: 800,
                name: 'Park Ave',
              },
              {
                maneuver: {
                  type: 'turn',
                  modifier: 'right',
                  location: [18.078, 59.337],
                  instruction: 'Turn right onto Lake Rd',
                },
                distance: 500,
                name: 'Lake Rd',
              },
              {
                maneuver: {
                  type: 'arrive',
                  modifier: undefined,
                  location: [18.08, 59.34],
                  instruction: 'You have arrived',
                },
                distance: 0,
                name: '',
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('MapboxRouter', () => {
  let router: MapboxRouter;

  beforeEach(() => {
    router = new MapboxRouter();
    vi.clearAllMocks();
  });

  describe('getRoute', () => {
    it('calls /api/mapbox/directions and normalizes response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeMapboxResponse()),
      });

      const waypoints: LatLng[] = [
        { lat: 59.33, lng: 18.07 },
        { lat: 59.34, lng: 18.08 },
      ];

      const result = await router.getRoute(waypoints, 360);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/mapbox/directions');
      expect(callUrl).toContain('coordinates=18.07,59.33;18.08,59.34');

      expect(result.distance).toBe(2500);
      // depart(1200) + turn-left(800) + turn-right(500) = 3 steps (arrive is 0m, skipped)
      expect(result.instructions).toHaveLength(3);
      expect(result.polyline).toHaveLength(3);
      expect(result.polyline[0]).toEqual([18.07, 59.33]);
    });

    it('skips steps shorter than 5m', async () => {
      const response = makeMapboxResponse();
      // Add a tiny step
      (response.routes[0].legs[0].steps as unknown[]).splice(2, 0, {
        maneuver: {
          type: 'turn',
          modifier: 'left',
          location: [18.076, 59.336],
          instruction: 'Slight left',
        },
        distance: 3,
        name: '',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const result = await router.getRoute(
        [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }]
      );

      // The tiny step and the 0m arrive step should both be skipped
      const tinySteps = result.instructions.filter(i => i.distance < 5);
      expect(tinySteps).toHaveLength(0);
    });

    it('maps maneuver types correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeMapboxResponse()),
      });

      const result = await router.getRoute(
        [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }]
      );

      expect(result.instructions[0].type).toBe('depart');
      expect(result.instructions[1].type).toBe('turn-left');
      expect(result.instructions[2].type).toBe('turn-right');
    });

    it('overrides walking duration with running pace', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeMapboxResponse()),
      });

      const paceSecondsPerKm = 300; // 5:00/km
      const result = await router.getRoute(
        [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }],
        paceSecondsPerKm
      );

      // 2500m = 2.5km * 300s/km = 750s
      expect(result.duration).toBe(750);
    });

    it('throws on non-Ok code', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'NoRoute', routes: [] }),
      });

      await expect(
        router.getRoute([{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }])
      ).rejects.toThrow('Mapbox Directions API error');
    });

    it('throws if fewer than 2 waypoints', async () => {
      await expect(
        router.getRoute([{ lat: 59.33, lng: 18.07 }])
      ).rejects.toThrow('At least 2 waypoints');
    });

    it('passes intermediate waypoints in coordinates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeMapboxResponse()),
      });

      await router.getRoute([
        { lat: 59.33, lng: 18.07 },
        { lat: 59.335, lng: 18.075 },
        { lat: 59.34, lng: 18.08 },
      ]);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('18.07,59.33;18.075,59.335;18.08,59.34');
    });
  });

  describe('getRouteWithAlternatives', () => {
    it('returns multiple routes when available', async () => {
      const response = makeMapboxResponse();
      (response.routes as unknown[]).push({
        geometry: {
          coordinates: [
            [18.07, 59.33],
            [18.06, 59.335],
            [18.08, 59.34],
          ],
        },
        distance: 3000,
        duration: 2100,
        legs: [
          {
            steps: [
              {
                maneuver: {
                  type: 'depart',
                  location: [18.07, 59.33],
                  instruction: 'Alternative route',
                },
                distance: 3000,
                name: 'Alt St',
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

      // Should request alternatives=true
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('alternatives=true');
    });
  });
});
