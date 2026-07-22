import { describe, it, expect } from 'vitest';
import { computeOverlapRatio } from '../route-quality';

// Polyline format is [lng, lat]. Tests use coordinates near the equator so
// 0.001 degrees ~ 111 m in both axes — well above the ~25 m snap grid.
const STEP = 0.001;

/** Straight line of points from [lng0, lat0] stepping (dLng, dLat) per point. */
function line(
  lng0: number,
  lat0: number,
  dLng: number,
  dLat: number,
  count: number
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    points.push([lng0 + i * dLng, lat0 + i * dLat]);
  }
  return points;
}

/** Closed square loop with the given side length (in degrees), vertices every STEP. */
function squareLoop(side: number): [number, number][] {
  const n = Math.round(side / STEP);
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) points.push([i * STEP, 0]); // south side, eastbound
  for (let i = 0; i < n; i++) points.push([side, i * STEP]); // east side, northbound
  for (let i = 0; i < n; i++) points.push([side - i * STEP, side]); // north side, westbound
  for (let i = 0; i < n; i++) points.push([0, side - i * STEP]); // west side, southbound
  points.push([0, 0]); // close the loop
  return points;
}

describe('computeOverlapRatio', () => {
  it('returns ~0 for a clean loop (square)', () => {
    const ratio = computeOverlapRatio(squareLoop(0.009));
    expect(ratio).toBeLessThan(0.05);
  });

  it('returns ~1.0 for a perfect out-and-back', () => {
    const out = line(0, 0, STEP, 0, 10);
    const back = [...out].reverse().slice(1); // return on the exact same path
    const ratio = computeOverlapRatio([...out, ...back]);
    expect(ratio).toBeGreaterThan(0.95);
  });

  it('returns ~0.2 for a loop with an out-and-back tail that is ~20% of the length', () => {
    // Tail: 1 km out + 1 km back (2 km overlapping), then an 8 km square loop
    // → 2 / 10 = 0.2 of total length traversed twice.
    const tailOut = line(0, 0, -STEP, 0, 10); // [0,0] west to [-0.009,0]
    const tailBack = [...tailOut].reverse().slice(1); // back to [0,0]
    const loop = squareLoop(0.018).slice(1); // 8 km loop from/to [0,0]
    const ratio = computeOverlapRatio([...tailOut, ...tailBack, ...loop]);
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.25);
  });

  it('returns 0 for an empty polyline', () => {
    expect(computeOverlapRatio([])).toBe(0);
  });

  it('returns 0 for a single-point polyline', () => {
    expect(computeOverlapRatio([[18.02, 59.33]])).toBe(0);
  });

  it('returns 0 for a two-point polyline', () => {
    expect(
      computeOverlapRatio([
        [18.02, 59.33],
        [18.03, 59.33],
      ])
    ).toBe(0);
  });

  it('is direction-agnostic: a segment re-traversed the opposite way counts as a duplicate', () => {
    // A → B → C → B: the B-C segment is traversed twice (once per direction),
    // A-B only once → 2 of 3 equal-length segments overlap.
    const polyline: [number, number][] = [
      [0, 0],
      [STEP, 0],
      [2 * STEP, 0],
      [STEP, 0],
    ];
    const ratio = computeOverlapRatio(polyline);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.75);
  });
});
