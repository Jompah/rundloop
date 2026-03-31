// src/lib/providers/__tests__/types.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type {
  LatLng,
  MapRenderer,
  RoutingEngine,
  Geocoder,
  POIProvider,
  ProviderRoute,
  ProviderInstruction,
  Place,
  POI,
  PolylineStyle,
  MarkerOptions,
  MapOptions,
  ProviderConfig,
  GenerationLog,
} from '../types';

describe('Provider types', () => {
  it('LatLng has lat and lng', () => {
    expectTypeOf<LatLng>().toHaveProperty('lat');
    expectTypeOf<LatLng>().toHaveProperty('lng');
  });

  it('MapRenderer has required methods', () => {
    expectTypeOf<MapRenderer>().toHaveProperty('init');
    expectTypeOf<MapRenderer>().toHaveProperty('setCenter');
    expectTypeOf<MapRenderer>().toHaveProperty('addPolyline');
    expectTypeOf<MapRenderer>().toHaveProperty('removePolyline');
    expectTypeOf<MapRenderer>().toHaveProperty('addMarker');
    expectTypeOf<MapRenderer>().toHaveProperty('removeMarker');
    expectTypeOf<MapRenderer>().toHaveProperty('fitBounds');
    expectTypeOf<MapRenderer>().toHaveProperty('setHeading');
    expectTypeOf<MapRenderer>().toHaveProperty('onMove');
    expectTypeOf<MapRenderer>().toHaveProperty('destroy');
  });

  it('RoutingEngine has getRoute and getRouteWithAlternatives', () => {
    expectTypeOf<RoutingEngine>().toHaveProperty('getRoute');
    expectTypeOf<RoutingEngine>().toHaveProperty('getRouteWithAlternatives');
  });

  it('Geocoder has reverseGeocode and search', () => {
    expectTypeOf<Geocoder>().toHaveProperty('reverseGeocode');
    expectTypeOf<Geocoder>().toHaveProperty('search');
  });

  it('POIProvider has getNaturePOIs, getLandmarks, getIslandOutline', () => {
    expectTypeOf<POIProvider>().toHaveProperty('getNaturePOIs');
    expectTypeOf<POIProvider>().toHaveProperty('getLandmarks');
    expectTypeOf<POIProvider>().toHaveProperty('getIslandOutline');
  });

  it('ProviderConfig has bundle and optional overrides', () => {
    expectTypeOf<ProviderConfig>().toHaveProperty('bundle');
    expectTypeOf<ProviderConfig>().toHaveProperty('overrides');
    expectTypeOf<ProviderConfig>().toHaveProperty('abTestEnabled');
  });

  it('GenerationLog has timing fields', () => {
    expectTypeOf<GenerationLog>().toHaveProperty('routingMs');
    expectTypeOf<GenerationLog>().toHaveProperty('geocodeMs');
    expectTypeOf<GenerationLog>().toHaveProperty('totalMs');
  });
});
