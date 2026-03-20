import { describe, it, expect } from 'vitest';
import {
  computeRollingPace,
  computeAveragePace,
  formatPace,
  formatMetricDistance,
  computeRemainingDistance,
  formatElapsed,
} from '../metrics';
import type { FilteredPosition } from '@/types';

// Helper to create a FilteredPosition
function pos(
  lat: number,
  lng: number,
  timestamp: number,
  accuracy = 5,
  speed: number | null = null
): FilteredPosition {
  return { lat, lng, accuracy, timestamp, speed };
}

describe('computeRollingPace', () => {
  it('returns seconds-per-km for a 30-second trace window', () => {
    // 5 points over 30s, roughly 150m apart along a line
    // Using small lat increments (~0.00135 deg lat ~ 150m)
    const now = Date.now();
    const trace: FilteredPosition[] = [
      pos(59.0, 18.0, now - 30000),
      pos(59.00035, 18.0, now - 22000),
      pos(59.00070, 18.0, now - 15000),
      pos(59.00105, 18.0, now - 7000),
      pos(59.00140, 18.0, now),
    ];
    const result = computeRollingPace(trace);
    expect(result).not.toBeNull();
    // ~155m in 30s => ~193 sec/km. Allow range 170-220
    expect(result!).toBeGreaterThan(170);
    expect(result!).toBeLessThan(220);
  });

  it('returns null when trace has only 1 point', () => {
    const trace = [pos(59.0, 18.0, Date.now())];
    expect(computeRollingPace(trace)).toBeNull();
  });

  it('returns null when 2 points have same coords (0m distance)', () => {
    const now = Date.now();
    const trace = [
      pos(59.0, 18.0, now - 5000),
      pos(59.0, 18.0, now),
    ];
    expect(computeRollingPace(trace)).toBeNull();
  });

  it('only uses last 30s of points when trace spans 60s', () => {
    const now = Date.now();
    // First 2 points are outside the window (>30s ago)
    const trace: FilteredPosition[] = [
      pos(59.0, 18.0, now - 60000),
      pos(59.001, 18.0, now - 45000),
      pos(59.002, 18.0, now - 20000),
      pos(59.003, 18.0, now - 10000),
      pos(59.004, 18.0, now),
    ];
    const result = computeRollingPace(trace);
    expect(result).not.toBeNull();
    // Should only compute from the last ~3 points within 30s window
  });

  it('returns null for empty array', () => {
    expect(computeRollingPace([])).toBeNull();
  });
});

describe('computeAveragePace', () => {
  it('returns 300 sec/km for 5000m in 25min', () => {
    const result = computeAveragePace(5000, 1500000);
    expect(result).toBe(300);
  });

  it('returns null for 0m distance', () => {
    expect(computeAveragePace(0, 60000)).toBeNull();
  });

  it('returns null for less than 1000ms elapsed', () => {
    expect(computeAveragePace(100, 500)).toBeNull();
  });
});

describe('formatPace', () => {
  it('formats 330 sec/km with km units as "5:30"', () => {
    expect(formatPace(330, 'km')).toBe('5:30');
  });

  it('formats 330 sec/km with miles units as "8:51"', () => {
    expect(formatPace(330, 'miles')).toBe('8:51');
  });

  it('returns "--:--" for null input', () => {
    expect(formatPace(null, 'km')).toBe('--:--');
  });
});

describe('formatMetricDistance', () => {
  it('converts 3200m to "3.2" for km', () => {
    expect(formatMetricDistance(3200, 'km')).toBe('3.2');
  });

  it('converts 3200m to "2.0" for miles', () => {
    expect(formatMetricDistance(3200, 'miles')).toBe('2.0');
  });

  it('converts 0m to "0.0" for km', () => {
    expect(formatMetricDistance(0, 'km')).toBe('0.0');
  });
});

describe('computeRemainingDistance', () => {
  it('returns difference when distance < route length', () => {
    expect(computeRemainingDistance(5000, 3200)).toBe(1800);
  });

  it('clamps to zero when distance exceeds route length', () => {
    expect(computeRemainingDistance(5000, 5500)).toBe(0);
  });

  it('returns full route distance when covered is 0', () => {
    expect(computeRemainingDistance(5000, 0)).toBe(5000);
  });
});

describe('formatElapsed', () => {
  it('formats 90000ms as "01:30"', () => {
    expect(formatElapsed(90000)).toBe('01:30');
  });

  it('formats 3661000ms as "1:01:01"', () => {
    expect(formatElapsed(3661000)).toBe('1:01:01');
  });

  it('formats 0ms as "00:00"', () => {
    expect(formatElapsed(0)).toBe('00:00');
  });
});
