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

  // Check for API keys via server endpoint first so we can pick a smart default bundle.
  let googleAvailable = false;
  let mapboxAvailable = false;
  try {
    const keysRes = await fetch('/api/provider-keys');
    const keys = await keysRes.json();
    googleAvailable = !!keys.google;
    mapboxAvailable = !!keys.mapbox;
  } catch {
    // No keys available, only Open provider will work
  }

  // Respect the user's explicit choice if saved. Otherwise prefer 'google' when
  // the server has a Google Maps key (Places/geocoding are higher quality than
  // Nominatim/Overpass); fall back to 'open'.
  const defaultBundle: ProviderConfig['bundle'] = googleAvailable ? 'google' : 'open';

  const config: ProviderConfig = {
    bundle: settings.providerBundle ?? defaultBundle,
    overrides: settings.providerOverrides,
    abTestEnabled: settings.abTestEnabled,
  };

  if (googleAvailable) config.googleApiKey = 'true';
  if (mapboxAvailable) config.mapboxApiKey = 'true';

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
