import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TurnInstruction } from '@/types';

// Will import from elevation.ts once implemented
import {
  fetchElevations,
  computeGrades,
  gradeToColor,
  buildGradientExpression,
  getSignificantTurns,
} from '../elevation';

describe('computeGrades', () => {
  it('returns grades near 0 for flat terrain (same elevation)', () => {
    const coords: [number, number][] = [
      [18.0, 59.0],
      [18.001, 59.0],
      [18.002, 59.0],
    ];
    const elevations = [100, 100, 100];
    const grades = computeGrades(coords, elevations);
    expect(grades).toHaveLength(3);
    grades.forEach((g) => expect(g).toBeCloseTo(0, 1));
  });

  it('computes 10% grade for 10m rise over ~100m horizontal', () => {
    // Two points ~100m apart horizontally
    // At 59N, 0.001 deg lng ~= 57m, so use ~0.00175 deg for ~100m
    const coords: [number, number][] = [
      [18.0, 59.0],
      [18.00175, 59.0],
    ];
    const elevations = [100, 110]; // 10m rise
    const grades = computeGrades(coords, elevations);
    expect(grades[0]).toBe(0); // first point always 0
    expect(grades[1]).toBeCloseTo(10, 0); // ~10% grade
  });

  it('returns 0 grade for first point (no previous point)', () => {
    const coords: [number, number][] = [
      [18.0, 59.0],
      [18.001, 59.0],
    ];
    const elevations = [100, 110];
    const grades = computeGrades(coords, elevations);
    expect(grades[0]).toBe(0);
  });

  it('returns 0 grade for zero-distance segments (no division by zero)', () => {
    const coords: [number, number][] = [
      [18.0, 59.0],
      [18.0, 59.0], // same point
    ];
    const elevations = [100, 110];
    const grades = computeGrades(coords, elevations);
    expect(grades[1]).toBe(0);
    expect(Number.isFinite(grades[1])).toBe(true);
  });
});

describe('gradeToColor', () => {
  it('returns green (#22c55e) for grade < 2% (flat)', () => {
    expect(gradeToColor(1)).toBe('#22c55e');
    expect(gradeToColor(0)).toBe('#22c55e');
    expect(gradeToColor(1.9)).toBe('#22c55e');
  });

  it('returns yellow (#eab308) for grade 2-4% (gentle)', () => {
    expect(gradeToColor(2)).toBe('#eab308');
    expect(gradeToColor(3)).toBe('#eab308');
    expect(gradeToColor(3.9)).toBe('#eab308');
  });

  it('returns orange (#f97316) for grade 4-8% (moderate)', () => {
    expect(gradeToColor(4)).toBe('#f97316');
    expect(gradeToColor(6)).toBe('#f97316');
    expect(gradeToColor(7.9)).toBe('#f97316');
  });

  it('returns red (#ef4444) for grade >= 8% (steep)', () => {
    expect(gradeToColor(8)).toBe('#ef4444');
    expect(gradeToColor(10)).toBe('#ef4444');
    expect(gradeToColor(20)).toBe('#ef4444');
  });
});

describe('buildGradientExpression', () => {
  it('returns interpolate expression with line-progress', () => {
    const coords: [number, number][] = [
      [18.0, 59.0],
      [18.001, 59.0],
      [18.002, 59.0],
    ];
    const grades = [0, 1, 5];
    const expr = buildGradientExpression(coords, grades) as unknown[];
    expect(expr[0]).toBe('interpolate');
    expect(expr[1]).toEqual(['linear']);
    expect(expr[2]).toEqual(['line-progress']);
  });

  it('has first stop at progress 0 and last stop near 1', () => {
    const coords: [number, number][] = [
      [18.0, 59.0],
      [18.001, 59.0],
      [18.002, 59.0],
    ];
    const grades = [0, 5, 10]; // different colors to avoid dedup
    const expr = buildGradientExpression(coords, grades) as unknown[];
    // After 'interpolate', ['linear'], ['line-progress'], stops start at index 3
    const stops = expr.slice(3);
    // First stop progress should be 0
    expect(stops[0]).toBe(0);
    // Last stop progress should be close to 1
    const lastProgress = stops[stops.length - 2] as number;
    expect(lastProgress).toBeCloseTo(1, 1);
  });

  it('deduplicates consecutive same-color stops', () => {
    const coords: [number, number][] = [
      [18.0, 59.0],
      [18.001, 59.0],
      [18.002, 59.0],
      [18.003, 59.0],
    ];
    // All flat = all green = should deduplicate
    const grades = [0, 0.5, 1, 0.8];
    const expr = buildGradientExpression(coords, grades) as unknown[];
    const stops = expr.slice(3);
    // All green, so after dedup should be just one stop pair [0, '#22c55e']
    expect(stops).toHaveLength(2); // [progress, color]
    expect(stops[1]).toBe('#22c55e');
  });
});

describe('getSignificantTurns', () => {
  const makeTurn = (type: TurnInstruction['type']): TurnInstruction => ({
    text: `Test ${type}`,
    distance: 100,
    location: [18.0, 59.0],
    type,
  });

  it('filters out straight, arrive, depart types', () => {
    const instructions: TurnInstruction[] = [
      makeTurn('straight'),
      makeTurn('arrive'),
      makeTurn('depart'),
    ];
    expect(getSignificantTurns(instructions)).toEqual([]);
  });

  it('keeps turn-left, turn-right, u-turn types', () => {
    const instructions: TurnInstruction[] = [
      makeTurn('turn-left'),
      makeTurn('turn-right'),
      makeTurn('u-turn'),
    ];
    const result = getSignificantTurns(instructions);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.type)).toEqual([
      'turn-left',
      'turn-right',
      'u-turn',
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(getSignificantTurns([])).toEqual([]);
  });
});

describe('fetchElevations', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('batches coordinates in groups of 100', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    // Create 150 coordinates
    const coords: [number, number][] = Array.from({ length: 150 }, (_, i) => [
      18.0 + i * 0.0001,
      59.0,
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        elevation: Array.from(
          { length: coords.length <= 100 ? coords.length : 100 },
          () => 50
        ),
      }),
    } as Response);

    // Override for second call to return 50 items
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: Array(100).fill(50) }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: Array(50).fill(60) }),
      } as Response);

    const result = await fetchElevations(coords);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(150);
  });

  it('correctly swaps lng,lat to lat,lng for Open-Meteo API', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elevation: [100] }),
    } as Response);

    const coords: [number, number][] = [[18.0686, 59.3293]]; // [lng, lat]
    await fetchElevations(coords);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    // latitude param should be 59.3293 (the lat from [lng,lat])
    expect(calledUrl).toContain('latitude=59.3293');
    // longitude param should be 18.0686 (the lng from [lng,lat])
    expect(calledUrl).toContain('longitude=18.0686');
  });
});
