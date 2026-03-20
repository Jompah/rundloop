import { describe, it, expect } from 'vitest';
import {
  pointToSegmentDistance,
  distanceToRoute,
  findNearestSegmentIndex,
  getCompassDirection,
  smoothHeading,
  bearingBetween,
} from '../navigation';

describe('pointToSegmentDistance', () => {
  it('returns ~0 for a point on the segment', () => {
    // Point exactly on segment from (59.33, 18.06) to (59.34, 18.06)
    const d = pointToSegmentDistance(59.335, 18.06, 59.33, 18.06, 59.34, 18.06);
    expect(d).toBeLessThan(1); // < 1 meter
  });

  it('returns ~55-65m for a point offset east by ~0.001 deg lng at lat 59', () => {
    // Segment runs N-S: (59.33, 18.06) to (59.34, 18.06)
    // Point offset east by 0.001 degrees longitude at lat ~59.335
    // cos(59.335) ~ 0.510, so 0.001 * 111320 * 0.510 ~ 56.8m
    const d = pointToSegmentDistance(59.335, 18.061, 59.33, 18.06, 59.34, 18.06);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(75);
  });

  it('returns distance to nearest endpoint for point beyond segment', () => {
    // Segment from (0, 0) to (0, 0.001) -- roughly E-W at equator
    // Point at (0, 0.002) -- beyond the segment end
    const d = pointToSegmentDistance(0, 0.002, 0, 0, 0, 0.001);
    // Should be distance from (0, 0.002) to nearest endpoint (0, 0.001) ~111m
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(130);
  });
});

describe('distanceToRoute', () => {
  it('returns ~0 for a point on the route', () => {
    // Polyline is [lng, lat][] format
    const polyline: [number, number][] = [
      [18.06, 59.33],
      [18.06, 59.34],
      [18.07, 59.34],
    ];
    const d = distanceToRoute(59.335, 18.06, polyline);
    expect(d).toBeLessThan(1);
  });

  it('returns correct distance for point ~80m from route', () => {
    // Simple N-S polyline near equator for easy math
    const polyline: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    // Point offset east by ~0.00072 deg at equator (~80m)
    const d = distanceToRoute(0.5, 0.00072, polyline);
    expect(d).toBeGreaterThan(60);
    expect(d).toBeLessThan(100);
  });

  it('handles single-segment polyline', () => {
    const polyline: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const d = distanceToRoute(0.5, 0, polyline);
    expect(d).toBeLessThan(1);
  });
});

describe('findNearestSegmentIndex', () => {
  it('returns index of closest segment in polyline', () => {
    const polyline: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ];
    // Point near the third segment (index 2, between [0,2] and [0,3])
    const idx = findNearestSegmentIndex(2.5, 0, polyline);
    expect(idx).toBe(2);
  });

  it('returns 0 for point near the first segment', () => {
    const polyline: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const idx = findNearestSegmentIndex(0.3, 0, polyline);
    expect(idx).toBe(0);
  });
});

describe('getCompassDirection', () => {
  it('returns N for due north', () => {
    expect(getCompassDirection(0, 0, 1, 0)).toBe('N');
  });

  it('returns E for due east', () => {
    expect(getCompassDirection(0, 0, 0, 1)).toBe('E');
  });

  it('returns S for due south', () => {
    expect(getCompassDirection(1, 0, 0, 0)).toBe('S');
  });

  it('returns W for due west', () => {
    expect(getCompassDirection(0, 1, 0, 0)).toBe('W');
  });

  it('returns SW for southwest', () => {
    expect(getCompassDirection(0, 0, -1, -1)).toBe('SW');
  });

  it('returns NE for northeast', () => {
    expect(getCompassDirection(0, 0, 1, 1)).toBe('NE');
  });
});

describe('smoothHeading', () => {
  it('returns previous when current is null', () => {
    expect(smoothHeading(null, 90)).toBe(90);
  });

  it('returns current when previous is null', () => {
    expect(smoothHeading(45, null)).toBe(45);
  });

  it('returns null when both are null', () => {
    expect(smoothHeading(null, null)).toBeNull();
  });

  it('handles wrap-around 350 -> 10 correctly (not via 180)', () => {
    // Previous 350, current 10, alpha 0.3
    // Diff = 10 - 350 = -340, adjusted to +20
    // Result = (350 + 0.3 * 20) % 360 = 356
    const result = smoothHeading(10, 350, 0.3);
    expect(result).toBeGreaterThan(350);
    expect(result).toBeLessThanOrEqual(360);
  });

  it('produces weighted average with alpha=0.3', () => {
    // Previous 100, current 120, alpha 0.3
    // Result = 100 + 0.3 * 20 = 106
    const result = smoothHeading(120, 100, 0.3);
    expect(result).toBeCloseTo(106, 0);
  });
});

describe('bearingBetween', () => {
  it('returns ~0 for due north', () => {
    const b = bearingBetween(0, 0, 1, 0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(5);
  });

  it('returns ~90 for due east', () => {
    const b = bearingBetween(0, 0, 0, 1);
    expect(b).toBeGreaterThan(85);
    expect(b).toBeLessThan(95);
  });

  it('returns ~180 for due south', () => {
    const b = bearingBetween(1, 0, 0, 0);
    expect(b).toBeGreaterThan(175);
    expect(b).toBeLessThan(185);
  });
});
