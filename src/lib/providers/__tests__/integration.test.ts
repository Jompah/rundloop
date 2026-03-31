// src/lib/providers/__tests__/integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRouter,
  getGeocoder,
  getPOIProvider,
  getActiveConfig,
  setProviderConfig,
  registerProvider,
  resetRegistry,
} from '../registry';
import { OpenRouter } from '../open/router';
import { OpenGeocoder } from '../open/geocoder';
import { OpenPOIProvider } from '../open/poi';
import type { RoutingEngine, LatLng, ProviderRoute } from '../types';

describe('Provider integration', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('defaults to Open adapters', () => {
    const router = getRouter();
    const geocoder = getGeocoder();
    const poi = getPOIProvider();

    expect(router).toBeInstanceOf(OpenRouter);
    expect(geocoder).toBeInstanceOf(OpenGeocoder);
    expect(poi).toBeInstanceOf(OpenPOIProvider);
  });

  it('falls back to Open when requested provider is not registered', () => {
    setProviderConfig({ bundle: 'google' });
    const router = getRouter();
    expect(router).toBeInstanceOf(OpenRouter);
  });

  it('uses registered provider when available', () => {
    class MockRouter implements RoutingEngine {
      async getRoute(_w: LatLng[]): Promise<ProviderRoute> {
        return { polyline: [], distance: 0, duration: 0, instructions: [] };
      }
      async getRouteWithAlternatives(_w: LatLng[]): Promise<ProviderRoute[]> {
        return [];
      }
    }

    const mockRouter = new MockRouter();
    registerProvider('google', { router: mockRouter });
    setProviderConfig({ bundle: 'google' });

    const router = getRouter();
    expect(router).toBe(mockRouter);
  });

  it('supports per-service overrides', () => {
    class MockRouter implements RoutingEngine {
      async getRoute(_w: LatLng[]): Promise<ProviderRoute> {
        return { polyline: [], distance: 999, duration: 0, instructions: [] };
      }
      async getRouteWithAlternatives(_w: LatLng[]): Promise<ProviderRoute[]> {
        return [];
      }
    }

    const mockRouter = new MockRouter();
    registerProvider('mapbox', { router: mockRouter });

    setProviderConfig({
      bundle: 'open',
      overrides: { router: 'mapbox' },
    });

    const router = getRouter();
    expect(router).toBe(mockRouter);

    const geocoder = getGeocoder();
    expect(geocoder).toBeInstanceOf(OpenGeocoder);
  });

  it('getActiveConfig returns current config snapshot', () => {
    setProviderConfig({ bundle: 'mapbox', abTestEnabled: true });
    const config = getActiveConfig();
    expect(config.bundle).toBe('mapbox');
    expect(config.abTestEnabled).toBe(true);
  });
});
