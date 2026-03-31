// src/lib/providers/open/index.ts
import type { ProviderBundle } from '../types';
import { OpenRouter } from './router';
import { OpenGeocoder } from './geocoder';
import { OpenPOIProvider } from './poi';

export { OpenRouter, OpenGeocoder, OpenPOIProvider };

export function createOpenBundle(): Omit<ProviderBundle, 'renderer'> & { name: 'open' } {
  return {
    name: 'open' as const,
    router: new OpenRouter(),
    geocoder: new OpenGeocoder(),
    poi: new OpenPOIProvider(),
  };
}
