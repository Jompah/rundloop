// src/lib/providers/__tests__/ab-test.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickABBundle, getSessionProvider, resetSessionProvider } from '../ab-test';
import type { ProviderConfig, ProviderName } from '../types';

describe('A/B test bundle picker', () => {
  beforeEach(() => {
    resetSessionProvider();
  });

  it('returns "open" when no API keys are set', () => {
    const config: ProviderConfig = { bundle: 'open', abTestEnabled: true };
    const result = pickABBundle(config);
    expect(result).toBe('open');
  });

  it('includes google when googleApiKey is set', () => {
    const config: ProviderConfig = {
      bundle: 'open',
      abTestEnabled: true,
      googleApiKey: 'test-key',
    };
    const results = new Set<ProviderName>();
    for (let i = 0; i < 50; i++) {
      results.add(pickABBundle(config));
    }
    expect(results.has('open')).toBe(true);
    expect(results.has('google')).toBe(true);
  });

  it('getSessionProvider returns same provider for entire session', () => {
    const config: ProviderConfig = {
      bundle: 'open',
      abTestEnabled: true,
      googleApiKey: 'test-key',
    };
    const first = getSessionProvider(config);
    const second = getSessionProvider(config);
    expect(first).toBe(second);
  });

  it('returns config.bundle when abTestEnabled is false', () => {
    const config: ProviderConfig = {
      bundle: 'google',
      abTestEnabled: false,
      googleApiKey: 'test-key',
    };
    const result = getSessionProvider(config);
    expect(result).toBe('google');
  });
});
