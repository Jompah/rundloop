// src/lib/providers/ab-test.ts
import type { ProviderConfig, ProviderName } from './types';

let sessionProvider: ProviderName | null = null;

export function pickABBundle(config: ProviderConfig): ProviderName {
  const candidates: ProviderName[] = ['open'];
  if (config.googleApiKey) candidates.push('google');
  if (config.mapboxApiKey) candidates.push('mapbox');
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getSessionProvider(config: ProviderConfig): ProviderName {
  if (!config.abTestEnabled) {
    return config.bundle;
  }
  if (sessionProvider === null) {
    sessionProvider = pickABBundle(config);
  }
  return sessionProvider;
}

export function resetSessionProvider(): void {
  sessionProvider = null;
}
