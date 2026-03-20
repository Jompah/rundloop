import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GeoPosition } from '../geolocation';
import type { FilteredPosition } from '@/types';

// Mock the geolocation module before any imports of gps-filter
vi.mock('../geolocation', () => ({
  watchPosition: vi.fn(),
}));

import { shouldAcceptPosition, watchFilteredPosition } from '../gps-filter';
import { watchPosition } from '../geolocation';

const mockWatchPosition = vi.mocked(watchPosition);

function makePos(overrides: Partial<GeoPosition> = {}): GeoPosition {
  return {
    lat: 59.3293,
    lng: 18.0686,
    accuracy: 10,
    heading: null,
    speed: 2.5,
    timestamp: 1000000,
    ...overrides,
  };
}

function makeFiltered(overrides: Partial<FilteredPosition> = {}): FilteredPosition {
  return {
    lat: 59.3293,
    lng: 18.0686,
    accuracy: 10,
    timestamp: 1000000,
    speed: 2.5,
    ...overrides,
  };
}

describe('shouldAcceptPosition', () => {
  it('accepts first position when accuracy is within threshold (<=30m)', () => {
    const pos = makePos({ accuracy: 25 });
    const result = shouldAcceptPosition(pos, null);
    expect(result.accepted).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects position with accuracy > 30m', () => {
    const pos = makePos({ accuracy: 31 });
    const result = shouldAcceptPosition(pos, null);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('accuracy');
  });

  it('rejects position less than 3m from previous accepted (jitter)', () => {
    const last = makeFiltered({ lat: 59.3293, lng: 18.0686 });
    // ~1m offset
    const pos = makePos({ lat: 59.32931, lng: 18.0686, timestamp: 1001000 });
    const result = shouldAcceptPosition(pos, last);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('jitter');
  });

  it('rejects position implying speed > 45 km/h (teleport)', () => {
    const last = makeFiltered({ lat: 59.3293, lng: 18.0686, timestamp: 1000000 });
    // ~500m north in 1 second = 500 m/s >> 12.5 m/s
    const pos = makePos({ lat: 59.3338, lng: 18.0686, timestamp: 1001000 });
    const result = shouldAcceptPosition(pos, last);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('teleport');
  });

  it('accepts position with valid accuracy, distance, and speed', () => {
    const last = makeFiltered({ lat: 59.3293, lng: 18.0686, timestamp: 1000000 });
    // ~50m north, 10 seconds later = 5 m/s (18 km/h) -- valid running speed
    const pos = makePos({ lat: 59.32975, lng: 18.0686, timestamp: 1010000 });
    const result = shouldAcceptPosition(pos, last);
    expect(result.accepted).toBe(true);
  });

  it('accepts position when time delta is 0 (avoids division by zero)', () => {
    const last = makeFiltered({ lat: 59.3293, lng: 18.0686, timestamp: 1000000 });
    // Same timestamp but different location (>3m away) -- timeDelta is 0, skip teleport check
    const pos = makePos({ lat: 59.3294, lng: 18.0686, timestamp: 1000000 });
    const result = shouldAcceptPosition(pos, last);
    expect(result.accepted).toBe(true);
  });
});

describe('watchFilteredPosition', () => {
  beforeEach(() => {
    mockWatchPosition.mockReset();
  });

  it('calls onAccepted for valid positions', () => {
    mockWatchPosition.mockImplementation((onUpdate) => {
      onUpdate(makePos({ accuracy: 10 }));
      return 42;
    });

    const onAccepted = vi.fn();
    const onRejected = vi.fn();
    const onError = vi.fn();

    const id = watchFilteredPosition(onAccepted, onRejected, onError);

    expect(id).toBe(42);
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 59.3293,
        lng: 18.0686,
        accuracy: 10,
      })
    );
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('calls onRejected with reason for invalid positions', () => {
    mockWatchPosition.mockImplementation((onUpdate) => {
      onUpdate(makePos({ accuracy: 50 }));
      return 43;
    });

    const onAccepted = vi.fn();
    const onRejected = vi.fn();
    const onError = vi.fn();

    watchFilteredPosition(onAccepted, onRejected, onError);

    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 50 }),
      'accuracy'
    );
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('maintains stateful last-accepted tracking across calls', () => {
    let capturedCallback: (pos: GeoPosition) => void;
    mockWatchPosition.mockImplementation((onUpdate) => {
      capturedCallback = onUpdate;
      return 44;
    });

    const onAccepted = vi.fn();
    const onRejected = vi.fn();
    const onError = vi.fn();

    watchFilteredPosition(onAccepted, onRejected, onError);

    // First position: accepted
    capturedCallback!(makePos({ lat: 59.3293, lng: 18.0686, accuracy: 10, timestamp: 1000000 }));
    expect(onAccepted).toHaveBeenCalledTimes(1);

    // Second position: jitter (same location)
    capturedCallback!(makePos({ lat: 59.3293, lng: 18.0686, accuracy: 10, timestamp: 1001000 }));
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledWith(
      expect.anything(),
      'jitter'
    );

    // Third position: valid (far enough, reasonable speed)
    capturedCallback!(makePos({ lat: 59.32975, lng: 18.0686, accuracy: 10, timestamp: 1010000 }));
    expect(onAccepted).toHaveBeenCalledTimes(2);
  });
});
