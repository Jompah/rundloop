import { describe, it, expect } from 'vitest';

describe('shouldAcceptPosition', () => {
  it.todo('accepts first position when accuracy is within threshold (<=30m)');
  it.todo('rejects position with accuracy > 30m');
  it.todo('rejects position less than 3m from previous accepted (jitter)');
  it.todo('rejects position implying speed > 45 km/h (teleport)');
  it.todo('accepts position with valid accuracy, distance, and speed');
  it.todo('accepts position when time delta is 0 (avoids division by zero)');
});

describe('watchFilteredPosition', () => {
  it.todo('calls onAccepted for valid positions');
  it.todo('calls onRejected with reason for invalid positions');
  it.todo('maintains stateful last-accepted tracking across calls');
});
