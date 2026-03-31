import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouter } from '../router';
import type { LatLng, ProviderRoute } from '../../types';

vi.mock('@/lib/route-osrm', () => ({
  routeViaOSRM: vi.fn(),
}));

import { routeViaOSRM } from '@/lib/route-osrm';

const mockOSRM = vi.mocked(routeViaOSRM);

describe('OpenRouter', () => {
  let router: OpenRouter;

  beforeEach(() => {
    router = new OpenRouter();
    vi.clearAllMocks();
  });

  it('getRoute calls routeViaOSRM and returns normalized ProviderRoute', async () => {
    mockOSRM.mockResolvedValue({
      waypoints: [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }],
      polyline: [[18.07, 59.33], [18.08, 59.34]],
      distance: 1500,
      duration: 540,
      instructions: [
        { text: 'Start on Main St', distance: 500, location: [18.07, 59.33], type: 'depart' },
        { text: 'You have arrived', distance: 0, location: [18.08, 59.34], type: 'arrive' },
      ],
    });

    const waypoints: LatLng[] = [
      { lat: 59.33, lng: 18.07 },
      { lat: 59.34, lng: 18.08 },
    ];

    const result = await router.getRoute(waypoints, 360);

    expect(mockOSRM).toHaveBeenCalledWith(
      [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }],
      360
    );
    expect(result.polyline).toEqual([[18.07, 59.33], [18.08, 59.34]]);
    expect(result.distance).toBe(1500);
    expect(result.duration).toBe(540);
    expect(result.instructions).toHaveLength(2);
    expect(result.instructions[0].type).toBe('depart');
  });

  it('getRoute maps "straight" instruction type to "continue"', async () => {
    mockOSRM.mockResolvedValue({
      waypoints: [{ lat: 59.33, lng: 18.07 }],
      polyline: [[18.07, 59.33]],
      distance: 100,
      duration: 36,
      instructions: [
        { text: 'Continue on path', distance: 100, location: [18.07, 59.33], type: 'straight' },
      ],
    });

    const result = await router.getRoute([{ lat: 59.33, lng: 18.07 }]);
    expect(result.instructions[0].type).toBe('continue');
  });

  it('getRouteWithAlternatives returns single-element array', async () => {
    mockOSRM.mockResolvedValue({
      waypoints: [],
      polyline: [],
      distance: 0,
      duration: 0,
      instructions: [],
    });

    const result = await router.getRouteWithAlternatives([{ lat: 59.33, lng: 18.07 }]);
    expect(result).toHaveLength(1);
  });
});
