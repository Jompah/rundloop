import { describe, it, expect } from 'vitest';
import { estimateCalories } from '../calories';

describe('estimateCalories', () => {
  it('returns 363 for 5000m at 70kg', () => {
    expect(estimateCalories(5000, 70)).toBe(363);
  });

  it('returns 829 for 10000m at 80kg', () => {
    expect(estimateCalories(10000, 80)).toBe(829);
  });

  it('returns 0 for 0m distance', () => {
    expect(estimateCalories(0, 70)).toBe(0);
  });

  it('returns 0 for 0kg weight', () => {
    expect(estimateCalories(1000, 0)).toBe(0);
  });
});
