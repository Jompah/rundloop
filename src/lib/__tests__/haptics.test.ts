import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { haptic } from '../haptics';

describe('haptic', () => {
  let vibrateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tap calls navigator.vibrate with 50', () => {
    haptic('tap');
    expect(vibrateMock).toHaveBeenCalledWith(50);
  });

  it('success calls navigator.vibrate with [50, 50, 50]', () => {
    haptic('success');
    expect(vibrateMock).toHaveBeenCalledWith([50, 50, 50]);
  });

  it('milestone calls navigator.vibrate with [100, 50, 100]', () => {
    haptic('milestone');
    expect(vibrateMock).toHaveBeenCalledWith([100, 50, 100]);
  });

  it('warning calls navigator.vibrate with [100, 50, 100, 50, 100]', () => {
    haptic('warning');
    expect(vibrateMock).toHaveBeenCalledWith([100, 50, 100, 50, 100]);
  });

  it('is a no-op when navigator.vibrate is undefined', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => haptic('tap')).not.toThrow();
  });
});
