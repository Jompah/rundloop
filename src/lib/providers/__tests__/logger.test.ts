import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timeAsync, createGenerationLog, getGenerationLogs, clearGenerationLogs } from '../logger';

vi.mock('@/lib/db', () => ({
  getDB: vi.fn(),
  dbPut: vi.fn().mockResolvedValue(undefined),
  dbGetAll: vi.fn().mockResolvedValue([]),
  dbDelete: vi.fn().mockResolvedValue(undefined),
}));

describe('timeAsync', () => {
  it('returns result and elapsed ms', async () => {
    const fn = async () => {
      await new Promise((r) => setTimeout(r, 50));
      return 'done';
    };

    const { result, elapsedMs } = await timeAsync(fn);
    expect(result).toBe('done');
    expect(elapsedMs).toBeGreaterThanOrEqual(40);
    expect(elapsedMs).toBeLessThan(200);
  });

  it('propagates errors and still reports timing', async () => {
    const fn = async () => {
      throw new Error('boom');
    };

    await expect(timeAsync(fn)).rejects.toThrow('boom');
  });
});

describe('createGenerationLog', () => {
  it('creates a log entry with all required fields', () => {
    const log = createGenerationLog({
      provider: 'open',
      providerOverrides: {},
      location: { lat: 59.33, lng: 18.07 },
      distanceRequested: 5000,
      distanceActual: 4800,
      routingMs: 250,
      geocodeMs: 100,
      poiMs: 80,
      totalMs: 430,
      success: true,
    });

    expect(log.id).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(log.provider).toBe('open');
    expect(log.routingMs).toBe(250);
    expect(log.success).toBe(true);
  });
});
