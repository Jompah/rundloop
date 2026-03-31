// src/lib/providers/registry.ts
import type {
  ProviderConfig,
  ProviderName,
  RoutingEngine,
  Geocoder,
  POIProvider,
} from './types';
import { OpenRouter } from './open/router';
import { OpenGeocoder } from './open/geocoder';
import { OpenPOIProvider } from './open/poi';

const DEFAULT_CONFIG: ProviderConfig = {
  bundle: 'open',
};

let activeConfig: ProviderConfig = { ...DEFAULT_CONFIG };

const instances: {
  routers: Partial<Record<ProviderName, RoutingEngine>>;
  geocoders: Partial<Record<ProviderName, Geocoder>>;
  pois: Partial<Record<ProviderName, POIProvider>>;
} = {
  routers: {},
  geocoders: {},
  pois: {},
};

function getOrCreateRouter(name: ProviderName): RoutingEngine {
  if (!instances.routers[name]) {
    switch (name) {
      case 'open':
        instances.routers[name] = new OpenRouter();
        break;
      case 'google':
        throw new Error(`Google router not yet registered. Install the Google provider adapter.`);
      case 'mapbox':
        throw new Error(`Mapbox router not yet registered. Install the Mapbox provider adapter.`);
    }
  }
  return instances.routers[name]!;
}

function getOrCreateGeocoder(name: ProviderName): Geocoder {
  if (!instances.geocoders[name]) {
    switch (name) {
      case 'open':
        instances.geocoders[name] = new OpenGeocoder();
        break;
      case 'google':
        throw new Error(`Google geocoder not yet registered. Install the Google provider adapter.`);
      case 'mapbox':
        throw new Error(`Mapbox geocoder not yet registered. Install the Mapbox provider adapter.`);
    }
  }
  return instances.geocoders[name]!;
}

function getOrCreatePOI(name: ProviderName): POIProvider {
  if (!instances.pois[name]) {
    switch (name) {
      case 'open':
        instances.pois[name] = new OpenPOIProvider();
        break;
      case 'google':
        throw new Error(`Google POI provider not yet registered. Install the Google provider adapter.`);
      case 'mapbox':
        throw new Error(`Mapbox POI provider not yet registered. Install the Mapbox provider adapter.`);
    }
  }
  return instances.pois[name]!;
}

export function getRouter(): RoutingEngine {
  const name = activeConfig.overrides?.router || activeConfig.bundle;
  try {
    return getOrCreateRouter(name);
  } catch {
    return getOrCreateRouter('open');
  }
}

export function getGeocoder(): Geocoder {
  const name = activeConfig.overrides?.geocoder || activeConfig.bundle;
  try {
    return getOrCreateGeocoder(name);
  } catch {
    return getOrCreateGeocoder('open');
  }
}

export function getPOIProvider(): POIProvider {
  const name = activeConfig.overrides?.poi || activeConfig.bundle;
  try {
    return getOrCreatePOI(name);
  } catch {
    return getOrCreatePOI('open');
  }
}

export function getActiveConfig(): ProviderConfig {
  return { ...activeConfig };
}

export function setProviderConfig(config: Partial<ProviderConfig>): void {
  activeConfig = { ...activeConfig, ...config };
}

export function registerProvider(
  name: ProviderName,
  adapters: {
    router?: RoutingEngine;
    geocoder?: Geocoder;
    poi?: POIProvider;
  }
): void {
  if (adapters.router) instances.routers[name] = adapters.router;
  if (adapters.geocoder) instances.geocoders[name] = adapters.geocoder;
  if (adapters.poi) instances.pois[name] = adapters.poi;
}

export function randomizeForABTest(config: ProviderConfig): ProviderName {
  const candidates: ProviderName[] = ['open'];
  if (config.googleApiKey) candidates.push('google');
  if (config.mapboxApiKey) candidates.push('mapbox');
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick;
}

export function resetRegistry(): void {
  activeConfig = { ...DEFAULT_CONFIG };
  instances.routers = {};
  instances.geocoders = {};
  instances.pois = {};
}
