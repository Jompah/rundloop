// src/lib/providers/__tests__/registry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage', () => ({
  getSettings: vi.fn(),
}));

import { getSettings } from '@/lib/storage';
import {
  getRouter,
  getGeocoder,
  getPOIProvider,
  getActiveConfig,
  setProviderConfig,
  resetRegistry,
} from '../registry';

const mockGetSettings = vi.mocked(getSettings);

describe('Provider Registry', () => {
  beforeEach(() => {
    resetRegistry();
    vi.clearAllMocks();
  });

  it('returns Open adapters by default when no config set', () => {
    const router = getRouter();
    const geocoder = getGeocoder();
    const poi = getPOIProvider();

    expect(router).toBeDefined();
    expect(geocoder).toBeDefined();
    expect(poi).toBeDefined();
    expect(getActiveConfig().bundle).toBe('open');
  });

  it('setProviderConfig updates active config', () => {
    setProviderConfig({ bundle: 'google' });
    expect(getActiveConfig().bundle).toBe('google');
  });

  it('falls back to Open when unknown bundle is set', () => {
    setProviderConfig({ bundle: 'open' });
    const router = getRouter();
    expect(router).toBeDefined();
  });

  it('supports per-service overrides', () => {
    setProviderConfig({
      bundle: 'open',
      overrides: { router: 'google' },
    });
    const config = getActiveConfig();
    expect(config.overrides?.router).toBe('google');
  });
});
