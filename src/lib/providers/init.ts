// src/lib/providers/init.ts
import { setProviderConfig } from './registry';
import { getSessionProvider } from './ab-test';
import { getSettings } from '@/lib/storage';
import type { ProviderConfig } from './types';

let initialized = false;

export async function initProviders(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (initialized) return;

  const settings = await getSettings();

  const config: ProviderConfig = {
    bundle: settings.providerBundle || 'open',
    overrides: settings.providerOverrides,
    abTestEnabled: settings.abTestEnabled,
  };

  // Check for API keys via server endpoint
  try {
    const keysRes = await fetch('/api/provider-keys');
    const keys = await keysRes.json();
    if (keys.google) config.googleApiKey = keys.google;
    if (keys.mapbox) config.mapboxApiKey = keys.mapbox;
  } catch {
    // No keys available, only Open provider will work
  }

  // Register adapters for available providers
  if (config.googleApiKey) {
    const { registerGoogleProvider } = await import('./google/index');
    registerGoogleProvider();
  }
  if (config.mapboxApiKey) {
    const { registerMapboxProvider } = await import('./mapbox/index');
    registerMapboxProvider();
  }

  // Determine active bundle (A/B or manual)
  const activeBundle = getSessionProvider(config);
  config.bundle = activeBundle;

  setProviderConfig(config);
  initialized = true;

  console.log(`[Providers] Initialized with bundle: ${activeBundle}`);
}
