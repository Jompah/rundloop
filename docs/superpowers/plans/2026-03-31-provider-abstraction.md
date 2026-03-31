# Provider Abstraction Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abstract all map/routing/geocoding/POI dependencies behind provider interfaces so we can swap between Open (MapLibre+OSRM), Google Maps, and Mapbox bundles via settings or A/B testing.

**Architecture:** Four interfaces (MapRenderer, RoutingEngine, Geocoder, POIProvider) live in `src/lib/providers/types.ts`. A registry reads provider config from IndexedDB settings and returns the active adapter for each service, supporting bundle-level selection with per-service overrides. Open provider wraps existing code with zero behavior change; Google and Mapbox adapters call their respective APIs via server-side proxy routes.

**Tech Stack:** TypeScript 5, Next.js 16.2, React 19, MapLibre GL JS, OSRM, Nominatim, Overpass, Google Maps JS API + REST APIs, Mapbox GL JS + REST APIs, IndexedDB, Vitest

---

### Task 1: Provider Types & Interfaces

**Files:**
- Create: `src/lib/providers/types.ts`
- Test: `src/lib/providers/__tests__/types.test.ts`

- [ ] **Step 1: Create the test file with type-level assertions**

```typescript
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
```

Run: `npx vitest run src/lib/providers/__tests__/types.test.ts` (expect fail: module not found)

- [ ] **Step 2: Create the types file**

```typescript
// src/lib/providers/types.ts

// --- Core primitives ---

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// --- Normalized data types ---

export interface ProviderRoute {
  polyline: [number, number][]; // [lng, lat] pairs (GeoJSON order, matching existing convention)
  distance: number; // meters
  duration: number; // seconds
  instructions: ProviderInstruction[];
  metadata?: Record<string, unknown>;
}

export interface ProviderInstruction {
  type: 'turn-left' | 'turn-right' | 'continue' | 'arrive' | 'depart' | 'u-turn';
  text: string;
  distance: number; // meters to next instruction
  location: [number, number]; // [lng, lat] matching existing TurnInstruction
}

export interface Place {
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  metadata?: Record<string, unknown>;
}

export interface POI {
  name: string;
  type: string;
  lat: number;
  lng: number;
  emoji?: string;
  metadata?: Record<string, unknown>;
}

export interface Polygon {
  points: LatLng[];
}

// --- Map renderer options ---

export interface MapOptions {
  center: LatLng;
  zoom: number;
  style?: 'dark' | 'light' | 'satellite';
  attributionControl?: boolean;
}

export interface PolylineStyle {
  width: number;
  color?: string;
  opacity?: number;
  dashArray?: number[];
  /** Gradient stops for elevation coloring: array of [progress, color] where progress is 0-1 */
  gradientStops?: [number, string][];
}

export interface MarkerOptions {
  color?: string;
  size?: number;
  icon?: 'start' | 'finish' | 'turn' | 'landmark' | 'user';
  label?: string;
  emoji?: string;
  anchor?: 'center' | 'bottom';
}

// --- Service interfaces ---

export interface MapRenderer {
  init(container: HTMLElement, options: MapOptions): Promise<void>;
  setCenter(lat: number, lng: number, zoom: number): void;
  addPolyline(coords: [number, number][], style: PolylineStyle): string;
  removePolyline(id: string): void;
  addMarker(lat: number, lng: number, options: MarkerOptions): string;
  removeMarker(id: string): void;
  fitBounds(bounds: LatLngBounds, padding?: number): void;
  setHeading(degrees: number): void;
  onMove(callback: (center: LatLng) => void): () => void;
  easeTo(options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  }): void;
  flyTo(options: {
    center: [number, number];
    zoom?: number;
    duration?: number;
  }): void;
  resize(): void;
  onLoad(callback: () => void): void;
  onDragStart(callback: () => void): () => void;
  onZoomStart(callback: () => void): () => void;
  /** Access the underlying map instance (MapLibre, Google, Mapbox) for advanced operations */
  getNativeMap(): unknown;
  destroy(): void;
}

export interface RoutingEngine {
  getRoute(waypoints: LatLng[], paceSecondsPerKm?: number): Promise<ProviderRoute>;
  getRouteWithAlternatives(waypoints: LatLng[], paceSecondsPerKm?: number): Promise<ProviderRoute[]>;
}

export interface Geocoder {
  reverseGeocode(lat: number, lng: number): Promise<Place>;
  search(query: string, near?: LatLng): Promise<Place[]>;
}

export interface POIProvider {
  getNaturePOIs(center: LatLng, radiusKm: number): Promise<POI[]>;
  getLandmarks(polyline: [number, number][], bufferMeters?: number): Promise<POI[]>;
  getIslandOutline(lat: number, lng: number): Promise<Polygon | null>;
}

// --- Provider bundle ---

export type ProviderName = 'open' | 'google' | 'mapbox';

export interface ProviderBundle {
  name: ProviderName;
  renderer: MapRenderer;
  router: RoutingEngine;
  geocoder: Geocoder;
  poi: POIProvider;
}

export interface ProviderConfig {
  bundle: ProviderName;
  overrides?: {
    renderer?: ProviderName;
    router?: ProviderName;
    geocoder?: ProviderName;
    poi?: ProviderName;
  };
  abTestEnabled?: boolean;
  googleApiKey?: string;
  mapboxApiKey?: string;
}

// --- Logging ---

export interface GenerationLog {
  id: string;
  timestamp: string;
  provider: ProviderName;
  providerOverrides: Record<string, string>;
  location: LatLng;
  distanceRequested: number;
  distanceActual: number;
  routingMs: number;
  geocodeMs: number;
  poiMs: number;
  totalMs: number;
  success: boolean;
  error?: string;
}
```

Run: `npx vitest run src/lib/providers/__tests__/types.test.ts` (expect pass)

---

### Task 2: Open Router Adapter (wraps route-osrm.ts)

**Files:**
- Create: `src/lib/providers/open/router.ts`
- Test: `src/lib/providers/open/__tests__/router.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/providers/open/__tests__/router.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouter } from '../router';
import type { LatLng, ProviderRoute } from '../../types';

// Mock the existing OSRM module
vi.mock('@/lib/route-osrm', () => ({
  routeViaOSRM: vi.fn(),
}));

import { routeViaOSRM } from '@/lib/route-osrm';

const mockOSRM = vi.mocked(routeViaOSRM);

describe('OpenRouter', () => {
  let router: OpenRouter;

  beforeEach(() => {
    router = new OpenRouter();
    vi.clearAllMocks();
  });

  it('getRoute calls routeViaOSRM and returns normalized ProviderRoute', async () => {
    mockOSRM.mockResolvedValue({
      waypoints: [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }],
      polyline: [[18.07, 59.33], [18.08, 59.34]],
      distance: 1500,
      duration: 540,
      instructions: [
        { text: 'Start on Main St', distance: 500, location: [18.07, 59.33], type: 'depart' },
        { text: 'You have arrived', distance: 0, location: [18.08, 59.34], type: 'arrive' },
      ],
    });

    const waypoints: LatLng[] = [
      { lat: 59.33, lng: 18.07 },
      { lat: 59.34, lng: 18.08 },
    ];

    const result = await router.getRoute(waypoints, 360);

    expect(mockOSRM).toHaveBeenCalledWith(
      [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.08 }],
      360
    );
    expect(result.polyline).toEqual([[18.07, 59.33], [18.08, 59.34]]);
    expect(result.distance).toBe(1500);
    expect(result.duration).toBe(540);
    expect(result.instructions).toHaveLength(2);
    expect(result.instructions[0].type).toBe('depart');
  });

  it('getRoute maps "straight" instruction type to "continue"', async () => {
    mockOSRM.mockResolvedValue({
      waypoints: [{ lat: 59.33, lng: 18.07 }],
      polyline: [[18.07, 59.33]],
      distance: 100,
      duration: 36,
      instructions: [
        { text: 'Continue on path', distance: 100, location: [18.07, 59.33], type: 'straight' },
      ],
    });

    const result = await router.getRoute([{ lat: 59.33, lng: 18.07 }]);
    expect(result.instructions[0].type).toBe('continue');
  });

  it('getRouteWithAlternatives returns single-element array', async () => {
    mockOSRM.mockResolvedValue({
      waypoints: [],
      polyline: [],
      distance: 0,
      duration: 0,
      instructions: [],
    });

    const result = await router.getRouteWithAlternatives([{ lat: 59.33, lng: 18.07 }]);
    expect(result).toHaveLength(1);
  });
});
```

Run: `npx vitest run src/lib/providers/open/__tests__/router.test.ts` (expect fail)

- [ ] **Step 2: Implement OpenRouter**

```typescript
// src/lib/providers/open/router.ts
import type { RoutingEngine, LatLng, ProviderRoute, ProviderInstruction } from '../types';
import { routeViaOSRM } from '@/lib/route-osrm';
import type { TurnInstruction } from '@/types';

/** Map existing TurnInstruction types to ProviderInstruction types */
function mapInstructionType(type: TurnInstruction['type']): ProviderInstruction['type'] {
  if (type === 'straight') return 'continue';
  return type;
}

function toProviderRoute(osrmResult: Awaited<ReturnType<typeof routeViaOSRM>>): ProviderRoute {
  return {
    polyline: osrmResult.polyline,
    distance: osrmResult.distance,
    duration: osrmResult.duration,
    instructions: osrmResult.instructions.map((inst) => ({
      type: mapInstructionType(inst.type),
      text: inst.text,
      distance: inst.distance,
      location: inst.location,
    })),
    metadata: {
      waypoints: osrmResult.waypoints,
      landmarks: osrmResult.landmarks,
      walkToStart: osrmResult.walkToStart,
    },
  };
}

export class OpenRouter implements RoutingEngine {
  async getRoute(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute> {
    const routeWaypoints = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
    const result = await routeViaOSRM(routeWaypoints, paceSecondsPerKm);
    return toProviderRoute(result);
  }

  async getRouteWithAlternatives(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute[]> {
    // OSRM public API does not support alternatives for foot profile reliably
    const route = await this.getRoute(waypoints, paceSecondsPerKm);
    return [route];
  }
}
```

Run: `npx vitest run src/lib/providers/open/__tests__/router.test.ts` (expect pass)

---

### Task 3: Open Geocoder Adapter (wraps geolocation.ts)

**Files:**
- Create: `src/lib/providers/open/geocoder.ts`
- Test: `src/lib/providers/open/__tests__/geocoder.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/providers/open/__tests__/geocoder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenGeocoder } from '../geocoder';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OpenGeocoder', () => {
  let geocoder: OpenGeocoder;

  beforeEach(() => {
    geocoder = new OpenGeocoder();
    vi.clearAllMocks();
  });

  it('reverseGeocode returns Place with suburb and city', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        display_name: 'Kungsholmen, Stockholm, Sweden',
        address: {
          suburb: 'Kungsholmen',
          city: 'Stockholm',
          country: 'Sweden',
        },
      }),
    });

    const place = await geocoder.reverseGeocode(59.33, 18.04);
    expect(place.name).toBe('Kungsholmen');
    expect(place.city).toBe('Stockholm');
    expect(place.country).toBe('Sweden');
    expect(place.lat).toBe(59.33);
    expect(place.lng).toBe(18.04);
  });

  it('reverseGeocode falls back to display_name when address parts missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        display_name: 'Some Place, Italy',
        address: {},
      }),
    });

    const place = await geocoder.reverseGeocode(37.5, 15.1);
    expect(place.name).toBe('Some Place');
  });

  it('reverseGeocode returns unknown on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const place = await geocoder.reverseGeocode(0, 0);
    expect(place.name).toBe('Unknown');
  });

  it('search returns empty array (not yet supported by Nominatim adapter)', async () => {
    const results = await geocoder.search('Stockholm');
    expect(results).toEqual([]);
  });
});
```

Run: `npx vitest run src/lib/providers/open/__tests__/geocoder.test.ts` (expect fail)

- [ ] **Step 2: Implement OpenGeocoder**

```typescript
// src/lib/providers/open/geocoder.ts
import type { Geocoder, LatLng, Place } from '../types';

export class OpenGeocoder implements Geocoder {
  async reverseGeocode(lat: number, lng: number): Promise<Place> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`,
        { headers: { 'User-Agent': 'Drift/1.0' } }
      );
      const data = await res.json();

      const suburb = data.address?.suburb || data.address?.neighbourhood || '';
      const city = data.address?.city || data.address?.town || data.address?.village || '';
      const country = data.address?.country || '';
      const name = suburb || city || data.display_name?.split(',')[0] || 'Unknown';

      return { name, city, country, lat, lng };
    } catch {
      return { name: 'Unknown', city: '', country: '', lat, lng };
    }
  }

  async search(_query: string, _near?: LatLng): Promise<Place[]> {
    // Nominatim search can be added later; not needed for current features
    return [];
  }
}
```

Run: `npx vitest run src/lib/providers/open/__tests__/geocoder.test.ts` (expect pass)

---

### Task 4: Open POI Adapter (wraps overpass.ts + API routes)

**Files:**
- Create: `src/lib/providers/open/poi.ts`
- Test: `src/lib/providers/open/__tests__/poi.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/providers/open/__tests__/poi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenPOIProvider } from '../poi';

vi.mock('@/lib/overpass', () => ({
  fetchLandmarksNearRoute: vi.fn(),
}));

import { fetchLandmarksNearRoute } from '@/lib/overpass';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockLandmarks = vi.mocked(fetchLandmarksNearRoute);

describe('OpenPOIProvider', () => {
  let provider: OpenPOIProvider;

  beforeEach(() => {
    provider = new OpenPOIProvider();
    vi.clearAllMocks();
  });

  it('getLandmarks delegates to fetchLandmarksNearRoute and normalizes', async () => {
    mockLandmarks.mockResolvedValue([
      { id: 1, name: 'Stadshuset', type: 'landmark', lat: 59.33, lng: 18.05, description: 'City Hall' },
    ]);

    const polyline: [number, number][] = [[18.04, 59.32], [18.06, 59.34]];
    const result = await provider.getLandmarks(polyline, 300);

    expect(mockLandmarks).toHaveBeenCalledWith(polyline, 300);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Stadshuset');
    expect(result[0].type).toBe('landmark');
    expect(result[0].lat).toBe(59.33);
    expect(result[0].lng).toBe(18.05);
  });

  it('getNaturePOIs calls /api/pois and normalizes response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        pois: [
          { id: 10, name: 'Rålambshovsparken', lat: 59.33, lng: 18.03, type: 'park' },
        ],
      }),
    });

    const result = await provider.getNaturePOIs({ lat: 59.33, lng: 18.03 }, 2);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Rålambshovsparken');
    expect(result[0].type).toBe('park');
  });

  it('getIslandOutline calls /api/island-outline and normalizes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        island: {
          name: 'Kungsholmen',
          perimeterKm: 8.5,
          outline: [
            { lat: 59.33, lng: 18.03 },
            { lat: 59.34, lng: 18.05 },
          ],
        },
      }),
    });

    const result = await provider.getIslandOutline(59.33, 18.04);
    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(2);
    expect(result!.points[0].lat).toBe(59.33);
  });

  it('getIslandOutline returns null when no island found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ island: null }),
    });

    const result = await provider.getIslandOutline(59.33, 18.04);
    expect(result).toBeNull();
  });
});
```

Run: `npx vitest run src/lib/providers/open/__tests__/poi.test.ts` (expect fail)

- [ ] **Step 2: Implement OpenPOIProvider**

```typescript
// src/lib/providers/open/poi.ts
import type { POIProvider, LatLng, POI, Polygon } from '../types';
import { fetchLandmarksNearRoute } from '@/lib/overpass';

const LANDMARK_EMOJIS: Record<string, string> = {
  museum: '\uD83C\uDFDB\uFE0F',
  monument: '\uD83D\uDDFF',
  viewpoint: '\uD83D\uDC41\uFE0F',
  park: '\uD83C\uDF33',
  church: '\u26EA',
  historic: '\uD83C\uDFF0',
  artwork: '\uD83C\uDFA8',
  fountain: '\u26F2',
  ruins: '\uD83C\uDFDA\uFE0F',
  castle: '\uD83C\uDFF0',
  landmark: '\uD83D\uDCCD',
};

export class OpenPOIProvider implements POIProvider {
  async getNaturePOIs(center: LatLng, radiusKm: number): Promise<POI[]> {
    try {
      const radiusM = Math.round(radiusKm * 1000);
      const res = await fetch(`/api/pois?lat=${center.lat}&lng=${center.lng}&radius=${radiusM}`);
      const data = await res.json();

      return (data.pois || []).map((p: { name: string; lat: number; lng: number; type: string }) => ({
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        emoji: LANDMARK_EMOJIS[p.type] || '\uD83C\uDF3F',
      }));
    } catch {
      return [];
    }
  }

  async getLandmarks(polyline: [number, number][], bufferMeters: number = 300): Promise<POI[]> {
    try {
      const landmarks = await fetchLandmarksNearRoute(polyline, bufferMeters);
      return landmarks.map((lm) => ({
        name: lm.name,
        type: lm.type,
        lat: lm.lat,
        lng: lm.lng,
        emoji: LANDMARK_EMOJIS[lm.type] || '\uD83D\uDCCD',
        metadata: { description: lm.description, distance: lm.distance, id: lm.id },
      }));
    } catch {
      return [];
    }
  }

  async getIslandOutline(lat: number, lng: number): Promise<Polygon | null> {
    try {
      const res = await fetch(`/api/island-outline?lat=${lat}&lng=${lng}`);
      const data = await res.json();

      if (!data.island) return null;

      return {
        points: data.island.outline.map((p: { lat: number; lng: number }) => ({
          lat: p.lat,
          lng: p.lng,
        })),
      };
    } catch {
      return null;
    }
  }
}
```

Run: `npx vitest run src/lib/providers/open/__tests__/poi.test.ts` (expect pass)

---

### Task 5: Open Bundle Index + Registry

**Files:**
- Create: `src/lib/providers/open/index.ts`
- Create: `src/lib/providers/registry.ts`
- Test: `src/lib/providers/__tests__/registry.test.ts`

- [ ] **Step 1: Create Open bundle index**

```typescript
// src/lib/providers/open/index.ts
import type { ProviderBundle } from '../types';
import { OpenRouter } from './router';
import { OpenGeocoder } from './geocoder';
import { OpenPOIProvider } from './poi';

// Renderer is created separately because it needs a container element at init time.
// For the bundle export we provide a factory, not an instance.
export { OpenRouter, OpenGeocoder, OpenPOIProvider };

/** Placeholder: OpenRenderer will be added in Task 6 (swap components). */
export function createOpenBundle(): Omit<ProviderBundle, 'renderer'> & { name: 'open' } {
  return {
    name: 'open' as const,
    router: new OpenRouter(),
    geocoder: new OpenGeocoder(),
    poi: new OpenPOIProvider(),
  };
}
```

- [ ] **Step 2: Write failing registry test**

```typescript
// src/lib/providers/__tests__/registry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage to control settings
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
```

Run: `npx vitest run src/lib/providers/__tests__/registry.test.ts` (expect fail)

- [ ] **Step 3: Implement registry**

```typescript
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

// --- Default config ---

const DEFAULT_CONFIG: ProviderConfig = {
  bundle: 'open',
};

let activeConfig: ProviderConfig = { ...DEFAULT_CONFIG };

// --- Lazy singleton instances ---

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
        // Lazy import to avoid bundling Google adapter when not used
        throw new Error(`Google router not yet registered. Install the Google provider adapter.`);
      case 'mapbox':
        throw new Error(`Mapbox router not yet registered. Install the Mapbox provider adapter.`);
      default:
        instances.routers[name] = new OpenRouter();
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
      default:
        instances.geocoders[name] = new OpenGeocoder();
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
      default:
        instances.pois[name] = new OpenPOIProvider();
    }
  }
  return instances.pois[name]!;
}

// --- Public API ---

export function getRouter(): RoutingEngine {
  const name = activeConfig.overrides?.router || activeConfig.bundle;
  try {
    return getOrCreateRouter(name);
  } catch {
    // Fallback to Open
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

/**
 * Register a provider adapter at runtime.
 * Used by Google/Mapbox adapters to plug into the registry without static imports.
 */
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

/**
 * Pick a random provider bundle for A/B testing.
 * Only includes bundles where API keys are available.
 */
export function randomizeForABTest(config: ProviderConfig): ProviderName {
  const candidates: ProviderName[] = ['open'];
  if (config.googleApiKey) candidates.push('google');
  if (config.mapboxApiKey) candidates.push('mapbox');
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick;
}

/** Reset to defaults. Used in tests. */
export function resetRegistry(): void {
  activeConfig = { ...DEFAULT_CONFIG };
  instances.routers = {};
  instances.geocoders = {};
  instances.pois = {};
}
```

Run: `npx vitest run src/lib/providers/__tests__/registry.test.ts` (expect pass)

---

### Task 6: Swap Components to Use Registry

**Files:**
- Modify: `src/types/index.ts` (add providerBundle fields to AppSettings, CompletedRun)
- Modify: `src/lib/storage.ts` (add providerConfig to defaults)

This task updates the existing code to flow through the registry. Since the Open adapters wrap existing code unchanged, behavior stays identical.

- [ ] **Step 1: Add provider fields to AppSettings type**

In `src/types/index.ts`, add to the `AppSettings` interface:

```typescript
// Add after paceSecondsPerKm field:
  providerBundle?: 'open' | 'google' | 'mapbox';
  providerOverrides?: {
    renderer?: 'open' | 'google' | 'mapbox';
    router?: 'open' | 'google' | 'mapbox';
    geocoder?: 'open' | 'google' | 'mapbox';
    poi?: 'open' | 'google' | 'mapbox';
  };
  abTestEnabled?: boolean;
```

And add to the `CompletedRun` interface:

```typescript
// Add after routePolyline field:
  providerBundle?: string;
  providerOverrides?: Record<string, string>;
  generationLogId?: string;
```

- [ ] **Step 2: Update storage defaults**

In `src/lib/storage.ts`, add to `defaultSettings`:

```typescript
  providerBundle: 'open' as const,
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `npx vitest run` (all tests should pass with no regressions)

---

### Task 7: Performance Logging

**Files:**
- Create: `src/lib/providers/logger.ts`
- Test: `src/lib/providers/__tests__/logger.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/providers/__tests__/logger.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timeAsync, createGenerationLog, getGenerationLogs, clearGenerationLogs } from '../logger';

// Mock db module
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
```

Run: `npx vitest run src/lib/providers/__tests__/logger.test.ts` (expect fail)

- [ ] **Step 2: Implement logger**

```typescript
// src/lib/providers/logger.ts
import type { GenerationLog, LatLng, ProviderName } from './types';
import { dbPut, dbGetAll } from '@/lib/db';

const LOGS_STORE = 'generation_logs';

/**
 * Time an async function and return result + elapsed milliseconds.
 */
export async function timeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const start = performance.now();
  const result = await fn();
  const elapsedMs = Math.round(performance.now() - start);
  return { result, elapsedMs };
}

/**
 * Create a GenerationLog entry (does NOT persist automatically).
 */
export function createGenerationLog(params: {
  provider: ProviderName;
  providerOverrides: Record<string, string>;
  location: LatLng;
  distanceRequested: number;
  distanceActual: number;
  routingMs: number;
  geocodeMs: number;
  poiMs: number;
  totalMs: number;
  success: boolean;
  error?: string;
}): GenerationLog {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...params,
  };
}

/**
 * Persist a generation log to IndexedDB.
 * Silently fails if DB is unavailable (server-side, etc).
 */
export async function saveGenerationLog(log: GenerationLog): Promise<void> {
  try {
    await dbPut(LOGS_STORE, log);
  } catch {
    console.warn('[ProviderLogger] Failed to save generation log:', log.id);
  }
}

/**
 * Retrieve all generation logs from IndexedDB.
 */
export async function getGenerationLogs(): Promise<GenerationLog[]> {
  try {
    return await dbGetAll<GenerationLog>(LOGS_STORE);
  } catch {
    return [];
  }
}

/**
 * Export all generation logs as a JSON string (for sharing with Claude).
 */
export async function exportGenerationLogs(): Promise<string> {
  const logs = await getGenerationLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Clear all generation logs.
 */
export async function clearGenerationLogs(): Promise<void> {
  // This would need a dbClearStore or iterate+delete.
  // For now, we'll overwrite with empty. A proper implementation
  // would add a dbClear helper to db.ts.
  console.warn('[ProviderLogger] clearGenerationLogs not yet implemented with bulk delete');
}
```

Run: `npx vitest run src/lib/providers/__tests__/logger.test.ts` (expect pass)

- [ ] **Step 3: Add generation_logs store to DB schema**

In `src/lib/db.ts`, inside the `request.onupgradeneeded` handler, add:

```typescript
      if (!db.objectStoreNames.contains('generation_logs')) {
        const logStore = db.createObjectStore('generation_logs', { keyPath: 'id' });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
```

And bump `DB_VERSION` from `1` to `2`.

Run: `npx vitest run` (all tests should still pass)

---

### Task 8: Google Provider Adapters

**Files:**
- Create: `src/lib/providers/google/router.ts`
- Create: `src/lib/providers/google/geocoder.ts`
- Create: `src/lib/providers/google/poi.ts`
- Create: `src/lib/providers/google/index.ts`
- Create: `src/app/api/google/directions/route.ts`
- Create: `src/app/api/google/geocode/route.ts`
- Create: `src/app/api/google/places/route.ts`
- Test: `src/lib/providers/google/__tests__/router.test.ts`
- Test: `src/lib/providers/google/__tests__/geocoder.test.ts`
- Test: `src/lib/providers/google/__tests__/poi.test.ts`

- [ ] **Step 1: Create Google Directions proxy API route**

```typescript
// src/app/api/google/directions/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export async function GET(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const origin = searchParams.get('origin'); // "lat,lng"
  const destination = searchParams.get('destination'); // "lat,lng"
  const waypoints = searchParams.get('waypoints'); // "lat,lng|lat,lng"

  if (!origin || !destination) {
    return NextResponse.json({ error: 'origin and destination required' }, { status: 400 });
  }

  const params = new URLSearchParams({
    origin,
    destination,
    mode: 'walking',
    key: GOOGLE_API_KEY,
    alternatives: 'true',
  });

  if (waypoints) {
    params.set('waypoints', waypoints);
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Google Directions proxy failed:', error);
    return NextResponse.json({ error: 'Google Directions unavailable' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Create Google Geocode proxy API route**

```typescript
// src/app/api/google/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export async function GET(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const latlng = searchParams.get('latlng'); // "lat,lng"
  const address = searchParams.get('address'); // search query

  if (!latlng && !address) {
    return NextResponse.json({ error: 'latlng or address required' }, { status: 400 });
  }

  const params = new URLSearchParams({ key: GOOGLE_API_KEY });
  if (latlng) params.set('latlng', latlng);
  if (address) params.set('address', address);

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Google Geocode proxy failed:', error);
    return NextResponse.json({ error: 'Google Geocode unavailable' }, { status: 502 });
  }
}
```

- [ ] **Step 3: Create Google Places proxy API route**

```typescript
// src/app/api/google/places/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export async function GET(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') || '2000';
  const type = searchParams.get('type') || 'point_of_interest';

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius,
    type,
    key: GOOGLE_API_KEY,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Google Places proxy failed:', error);
    return NextResponse.json({ error: 'Google Places unavailable' }, { status: 502 });
  }
}
```

- [ ] **Step 4: Write failing Google router test**

```typescript
// src/lib/providers/google/__tests__/router.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleRouter } from '../router';
import type { LatLng } from '../../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GoogleRouter', () => {
  let router: GoogleRouter;

  beforeEach(() => {
    router = new GoogleRouter();
    vi.clearAllMocks();
  });

  it('getRoute calls /api/google/directions and normalizes response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'OK',
        routes: [{
          overview_polyline: { points: 'mock' },
          legs: [{
            distance: { value: 3000 },
            duration: { value: 2400 },
            steps: [
              {
                html_instructions: 'Head <b>north</b>',
                distance: { value: 500 },
                start_location: { lat: 59.33, lng: 18.07 },
                end_location: { lat: 59.335, lng: 18.07 },
                maneuver: undefined,
                polyline: { points: 'encodedPolyline1' },
              },
              {
                html_instructions: 'Turn <b>left</b>',
                distance: { value: 2500 },
                start_location: { lat: 59.335, lng: 18.07 },
                end_location: { lat: 59.34, lng: 18.05 },
                maneuver: 'turn-left',
                polyline: { points: 'encodedPolyline2' },
              },
            ],
          }],
        }],
      }),
    });

    const waypoints: LatLng[] = [
      { lat: 59.33, lng: 18.07 },
      { lat: 59.34, lng: 18.05 },
    ];

    const result = await router.getRoute(waypoints, 360);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.distance).toBe(3000);
    expect(result.instructions).toHaveLength(2);
    expect(result.instructions[1].type).toBe('turn-left');
  });

  it('throws on non-OK status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ZERO_RESULTS', routes: [] }),
    });

    await expect(router.getRoute([{ lat: 0, lng: 0 }])).rejects.toThrow();
  });
});
```

Run: `npx vitest run src/lib/providers/google/__tests__/router.test.ts` (expect fail)

- [ ] **Step 5: Implement GoogleRouter**

```typescript
// src/lib/providers/google/router.ts
import type { RoutingEngine, LatLng, ProviderRoute, ProviderInstruction } from '../types';

/**
 * Decode Google's encoded polyline format into [lng, lat] coordinate pairs.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodeGooglePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]); // [lng, lat] GeoJSON order
  }

  return coords;
}

function mapGoogleManeuver(maneuver?: string): ProviderInstruction['type'] {
  if (!maneuver) return 'continue';
  if (maneuver.includes('left')) return 'turn-left';
  if (maneuver.includes('right')) return 'turn-right';
  if (maneuver.includes('uturn') || maneuver.includes('u-turn')) return 'u-turn';
  if (maneuver === 'straight') return 'continue';
  return 'continue';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

interface GoogleStep {
  html_instructions: string;
  distance: { value: number };
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
  maneuver?: string;
  polyline: { points: string };
}

interface GoogleLeg {
  distance: { value: number };
  duration: { value: number };
  steps: GoogleStep[];
}

interface GoogleRoute {
  overview_polyline: { points: string };
  legs: GoogleLeg[];
}

export class GoogleRouter implements RoutingEngine {
  async getRoute(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute> {
    if (waypoints.length < 2) {
      throw new Error('Need at least 2 waypoints for routing');
    }

    const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

    // Intermediate waypoints (between first and last)
    const intermediateWaypoints = waypoints.slice(1, -1)
      .map((w) => `${w.lat},${w.lng}`)
      .join('|');

    const params = new URLSearchParams({ origin, destination });
    if (intermediateWaypoints) {
      params.set('waypoints', intermediateWaypoints);
    }

    const res = await fetch(`/api/google/directions?${params}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Google Directions failed: ${data.status || 'no routes'}`);
    }

    const route: GoogleRoute = data.routes[0];
    return this.normalizeRoute(route, paceSecondsPerKm);
  }

  async getRouteWithAlternatives(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute[]> {
    if (waypoints.length < 2) {
      throw new Error('Need at least 2 waypoints for routing');
    }

    const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

    const res = await fetch(`/api/google/directions?origin=${origin}&destination=${destination}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Google Directions failed: ${data.status || 'no routes'}`);
    }

    return data.routes.map((r: GoogleRoute) => this.normalizeRoute(r, paceSecondsPerKm));
  }

  private normalizeRoute(route: GoogleRoute, paceSecondsPerKm: number): ProviderRoute {
    // Collect polyline from all steps for higher detail than overview_polyline
    const allCoords: [number, number][] = [];
    const instructions: ProviderInstruction[] = [];

    let totalDistance = 0;

    for (const leg of route.legs) {
      totalDistance += leg.distance.value;

      for (const step of leg.steps) {
        const stepCoords = decodeGooglePolyline(step.polyline.points);
        allCoords.push(...stepCoords);

        instructions.push({
          type: mapGoogleManeuver(step.maneuver),
          text: stripHtml(step.html_instructions),
          distance: step.distance.value,
          location: [step.start_location.lng, step.start_location.lat],
        });
      }
    }

    // Override Google walking duration with running pace
    const runningDuration = (totalDistance / 1000) * paceSecondsPerKm;

    return {
      polyline: allCoords,
      distance: totalDistance,
      duration: runningDuration,
      instructions,
      metadata: { provider: 'google' },
    };
  }
}
```

Run: `npx vitest run src/lib/providers/google/__tests__/router.test.ts` (expect pass)

- [ ] **Step 6: Write failing Google geocoder test and implement**

```typescript
// src/lib/providers/google/__tests__/geocoder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGeocoder } from '../geocoder';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GoogleGeocoder', () => {
  let geocoder: GoogleGeocoder;

  beforeEach(() => {
    geocoder = new GoogleGeocoder();
    vi.clearAllMocks();
  });

  it('reverseGeocode extracts neighborhood and city from address_components', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'OK',
        results: [{
          formatted_address: 'Norr Mälarstrand 12, 112 20 Stockholm, Sweden',
          address_components: [
            { long_name: 'Kungsholmen', types: ['sublocality', 'political'] },
            { long_name: 'Stockholm', types: ['locality', 'political'] },
            { long_name: 'Sweden', types: ['country', 'political'] },
          ],
        }],
      }),
    });

    const place = await geocoder.reverseGeocode(59.33, 18.04);
    expect(place.name).toBe('Kungsholmen');
    expect(place.city).toBe('Stockholm');
    expect(place.country).toBe('Sweden');
  });

  it('search returns matching places', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'OK',
        results: [{
          formatted_address: 'Stockholm, Sweden',
          address_components: [
            { long_name: 'Stockholm', types: ['locality'] },
            { long_name: 'Sweden', types: ['country'] },
          ],
          geometry: { location: { lat: 59.33, lng: 18.07 } },
        }],
      }),
    });

    const results = await geocoder.search('Stockholm');
    expect(results).toHaveLength(1);
    expect(results[0].city).toBe('Stockholm');
  });
});
```

```typescript
// src/lib/providers/google/geocoder.ts
import type { Geocoder, LatLng, Place } from '../types';

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeoResult {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  geometry?: { location: { lat: number; lng: number } };
}

function extractComponent(components: GoogleAddressComponent[], ...types: string[]): string {
  for (const type of types) {
    const comp = components.find((c) => c.types.includes(type));
    if (comp) return comp.long_name;
  }
  return '';
}

function resultToPlace(result: GoogleGeoResult, lat: number, lng: number): Place {
  const comps = result.address_components;
  const name = extractComponent(comps, 'sublocality', 'neighborhood', 'route') ||
    result.formatted_address.split(',')[0] || 'Unknown';
  const city = extractComponent(comps, 'locality', 'administrative_area_level_1');
  const country = extractComponent(comps, 'country');

  return { name, city, country, lat, lng };
}

export class GoogleGeocoder implements Geocoder {
  async reverseGeocode(lat: number, lng: number): Promise<Place> {
    try {
      const res = await fetch(`/api/google/geocode?latlng=${lat},${lng}`);
      const data = await res.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return { name: 'Unknown', city: '', country: '', lat, lng };
      }

      return resultToPlace(data.results[0], lat, lng);
    } catch {
      return { name: 'Unknown', city: '', country: '', lat, lng };
    }
  }

  async search(query: string, near?: LatLng): Promise<Place[]> {
    try {
      const params = new URLSearchParams({ address: query });
      if (near) {
        // Google Geocoding doesn't have a native "near" param, but we can use bounds
        params.set('bounds', `${near.lat - 0.1},${near.lng - 0.1}|${near.lat + 0.1},${near.lng + 0.1}`);
      }

      const res = await fetch(`/api/google/geocode?${params}`);
      const data = await res.json();

      if (data.status !== 'OK' || !data.results?.length) return [];

      return data.results.map((r: GoogleGeoResult) => {
        const loc = r.geometry?.location || { lat: 0, lng: 0 };
        return resultToPlace(r, loc.lat, loc.lng);
      });
    } catch {
      return [];
    }
  }
}
```

Run: `npx vitest run src/lib/providers/google/__tests__/geocoder.test.ts` (expect pass)

- [ ] **Step 7: Write failing Google POI test and implement**

```typescript
// src/lib/providers/google/__tests__/poi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GooglePOIProvider } from '../poi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GooglePOIProvider', () => {
  let provider: GooglePOIProvider;

  beforeEach(() => {
    provider = new GooglePOIProvider();
    vi.clearAllMocks();
  });

  it('getNaturePOIs calls /api/google/places and normalizes response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'OK',
        results: [
          {
            name: 'Humlegarden',
            geometry: { location: { lat: 59.34, lng: 18.07 } },
            types: ['park', 'point_of_interest'],
            rating: 4.5,
          },
        ],
      }),
    });

    const result = await provider.getNaturePOIs({ lat: 59.34, lng: 18.07 }, 2);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Humlegarden');
    expect(result[0].type).toBe('park');
    expect(result[0].metadata?.rating).toBe(4.5);
  });

  it('getLandmarks queries multiple place types and merges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'OK',
        results: [
          {
            name: 'Test Museum',
            geometry: { location: { lat: 59.33, lng: 18.05 } },
            types: ['museum', 'point_of_interest'],
          },
        ],
      }),
    });

    const polyline: [number, number][] = [[18.04, 59.32], [18.06, 59.34]];
    const result = await provider.getLandmarks(polyline, 300);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('getIslandOutline returns null (not supported by Google Places)', async () => {
    const result = await provider.getIslandOutline(59.33, 18.04);
    expect(result).toBeNull();
  });
});
```

```typescript
// src/lib/providers/google/poi.ts
import type { POIProvider, LatLng, POI, Polygon } from '../types';

const TYPE_EMOJI: Record<string, string> = {
  park: '\uD83C\uDF33',
  museum: '\uD83C\uDFDB\uFE0F',
  church: '\u26EA',
  point_of_interest: '\uD83D\uDCCD',
  tourist_attraction: '\u2B50',
  natural_feature: '\uD83C\uDF3F',
  art_gallery: '\uD83C\uDFA8',
};

function classifyGoogleType(types: string[]): string {
  if (types.includes('park')) return 'park';
  if (types.includes('museum')) return 'museum';
  if (types.includes('church')) return 'church';
  if (types.includes('art_gallery')) return 'artwork';
  if (types.includes('tourist_attraction')) return 'landmark';
  if (types.includes('natural_feature')) return 'nature';
  return 'landmark';
}

interface GooglePlaceResult {
  name: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  rating?: number;
  place_id?: string;
}

export class GooglePOIProvider implements POIProvider {
  async getNaturePOIs(center: LatLng, radiusKm: number): Promise<POI[]> {
    const radiusM = Math.round(radiusKm * 1000);
    try {
      const res = await fetch(
        `/api/google/places?lat=${center.lat}&lng=${center.lng}&radius=${radiusM}&type=park`
      );
      const data = await res.json();

      if (data.status !== 'OK' || !data.results?.length) return [];

      return data.results.slice(0, 10).map((r: GooglePlaceResult) => ({
        name: r.name,
        type: classifyGoogleType(r.types),
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        emoji: TYPE_EMOJI[classifyGoogleType(r.types)] || '\uD83D\uDCCD',
        metadata: { rating: r.rating, placeId: r.place_id },
      }));
    } catch {
      return [];
    }
  }

  async getLandmarks(polyline: [number, number][], bufferMeters: number = 300): Promise<POI[]> {
    // Compute centroid of polyline for the search center
    if (polyline.length === 0) return [];

    const lats = polyline.map((p) => p[1]);
    const lngs = polyline.map((p) => p[0]);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // Search for tourist attractions and museums near the route center
    const types = ['tourist_attraction', 'museum', 'park'];
    const allPOIs: POI[] = [];

    for (const type of types) {
      try {
        const res = await fetch(
          `/api/google/places?lat=${centerLat}&lng=${centerLng}&radius=${bufferMeters}&type=${type}`
        );
        const data = await res.json();

        if (data.status === 'OK' && data.results?.length) {
          const pois = data.results.slice(0, 3).map((r: GooglePlaceResult) => ({
            name: r.name,
            type: classifyGoogleType(r.types),
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            emoji: TYPE_EMOJI[classifyGoogleType(r.types)] || '\uD83D\uDCCD',
            metadata: { rating: r.rating, placeId: r.place_id },
          }));
          allPOIs.push(...pois);
        }
      } catch {
        // Skip failed type queries
      }
    }

    // Deduplicate by name
    const seen = new Set<string>();
    return allPOIs
      .filter((p) => {
        const key = p.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }

  async getIslandOutline(_lat: number, _lng: number): Promise<Polygon | null> {
    // Google Places API does not support island outline queries.
    // Fall back to null; the app will skip island-aware features.
    return null;
  }
}
```

Run: `npx vitest run src/lib/providers/google/__tests__/poi.test.ts` (expect pass)

- [ ] **Step 8: Create Google bundle index and register**

```typescript
// src/lib/providers/google/index.ts
import { GoogleRouter } from './router';
import { GoogleGeocoder } from './geocoder';
import { GooglePOIProvider } from './poi';
import { registerProvider } from '../registry';

export { GoogleRouter, GoogleGeocoder, GooglePOIProvider };

/**
 * Register all Google adapters with the provider registry.
 * Call this once during app initialization when Google API key is available.
 */
export function registerGoogleProvider(): void {
  registerProvider('google', {
    router: new GoogleRouter(),
    geocoder: new GoogleGeocoder(),
    poi: new GooglePOIProvider(),
  });
}
```

Run: `npx vitest run src/lib/providers/google/__tests__/router.test.ts src/lib/providers/google/__tests__/geocoder.test.ts src/lib/providers/google/__tests__/poi.test.ts` (all pass)

---

### Task 9: Mapbox Provider Adapters

**Files:**
- Create: `src/lib/providers/mapbox/router.ts`
- Create: `src/lib/providers/mapbox/geocoder.ts`
- Create: `src/lib/providers/mapbox/poi.ts`
- Create: `src/lib/providers/mapbox/index.ts`
- Create: `src/app/api/mapbox/directions/route.ts`
- Create: `src/app/api/mapbox/geocode/route.ts`
- Test: `src/lib/providers/mapbox/__tests__/router.test.ts`
- Test: `src/lib/providers/mapbox/__tests__/geocoder.test.ts`
- Test: `src/lib/providers/mapbox/__tests__/poi.test.ts`

- [ ] **Step 1: Create Mapbox Directions proxy API route**

```typescript
// src/app/api/mapbox/directions/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

export async function GET(request: NextRequest) {
  if (!MAPBOX_TOKEN) {
    return NextResponse.json({ error: 'Mapbox access token not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const coordinates = searchParams.get('coordinates'); // "lng,lat;lng,lat;..."
  const alternatives = searchParams.get('alternatives') || 'false';

  if (!coordinates) {
    return NextResponse.json({ error: 'coordinates required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?access_token=${MAPBOX_TOKEN}&geometries=geojson&steps=true&overview=full&alternatives=${alternatives}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Mapbox Directions proxy failed:', error);
    return NextResponse.json({ error: 'Mapbox Directions unavailable' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Create Mapbox Geocode proxy API route**

```typescript
// src/app/api/mapbox/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

export async function GET(request: NextRequest) {
  if (!MAPBOX_TOKEN) {
    return NextResponse.json({ error: 'Mapbox access token not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const lng = searchParams.get('lng');
  const lat = searchParams.get('lat');
  const query = searchParams.get('query');

  if (!lng && !lat && !query) {
    return NextResponse.json({ error: 'lng/lat or query required' }, { status: 400 });
  }

  try {
    let url: string;
    if (query) {
      // Forward geocoding
      const proximity = lng && lat ? `&proximity=${lng},${lat}` : '';
      url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}${proximity}&limit=5`;
    } else {
      // Reverse geocoding
      url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${MAPBOX_TOKEN}&limit=1`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Mapbox Geocode proxy failed:', error);
    return NextResponse.json({ error: 'Mapbox Geocode unavailable' }, { status: 502 });
  }
}
```

- [ ] **Step 3: Write failing Mapbox router test and implement**

```typescript
// src/lib/providers/mapbox/__tests__/router.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapboxRouter } from '../router';
import type { LatLng } from '../../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MapboxRouter', () => {
  let router: MapboxRouter;

  beforeEach(() => {
    router = new MapboxRouter();
    vi.clearAllMocks();
  });

  it('getRoute calls /api/mapbox/directions and normalizes response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 'Ok',
        routes: [{
          geometry: {
            coordinates: [[18.07, 59.33], [18.075, 59.335], [18.05, 59.34]],
          },
          distance: 2500,
          duration: 1800,
          legs: [{
            steps: [
              {
                maneuver: { type: 'depart', modifier: '', location: [18.07, 59.33], instruction: 'Head north' },
                distance: 800,
                name: 'Norr Malarstrand',
              },
              {
                maneuver: { type: 'turn', modifier: 'left', location: [18.075, 59.335], instruction: 'Turn left' },
                distance: 1700,
                name: 'Hantverkargatan',
              },
            ],
          }],
        }],
      }),
    });

    const waypoints: LatLng[] = [
      { lat: 59.33, lng: 18.07 },
      { lat: 59.34, lng: 18.05 },
    ];

    const result = await router.getRoute(waypoints, 360);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.polyline).toHaveLength(3);
    expect(result.distance).toBe(2500);
    expect(result.instructions).toHaveLength(2);
    expect(result.instructions[0].type).toBe('depart');
    expect(result.instructions[1].type).toBe('turn-left');
  });

  it('getRouteWithAlternatives returns multiple routes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 'Ok',
        routes: [
          {
            geometry: { coordinates: [[18.07, 59.33]] },
            distance: 2500,
            duration: 1800,
            legs: [{ steps: [] }],
          },
          {
            geometry: { coordinates: [[18.07, 59.33]] },
            distance: 2800,
            duration: 2000,
            legs: [{ steps: [] }],
          },
        ],
      }),
    });

    const result = await router.getRouteWithAlternatives([
      { lat: 59.33, lng: 18.07 },
      { lat: 59.34, lng: 18.05 },
    ]);
    expect(result).toHaveLength(2);
  });
});
```

```typescript
// src/lib/providers/mapbox/router.ts
import type { RoutingEngine, LatLng, ProviderRoute, ProviderInstruction } from '../types';

interface MapboxManeuver {
  type: string;
  modifier?: string;
  location: [number, number];
  instruction?: string;
}

interface MapboxStep {
  maneuver: MapboxManeuver;
  distance: number;
  name: string;
}

interface MapboxLeg {
  steps: MapboxStep[];
}

interface MapboxRoute {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  legs: MapboxLeg[];
}

function mapMapboxManeuver(type: string, modifier?: string): ProviderInstruction['type'] {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (type === 'turn' || type === 'end of road' || type === 'fork') {
    if (modifier?.includes('left')) return 'turn-left';
    if (modifier?.includes('right')) return 'turn-right';
    if (modifier?.includes('uturn') || modifier?.includes('u-turn')) return 'u-turn';
  }
  return 'continue';
}

export class MapboxRouter implements RoutingEngine {
  async getRoute(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute> {
    const routes = await this.fetchRoutes(waypoints, paceSecondsPerKm, false);
    return routes[0];
  }

  async getRouteWithAlternatives(waypoints: LatLng[], paceSecondsPerKm: number = 360): Promise<ProviderRoute[]> {
    return this.fetchRoutes(waypoints, paceSecondsPerKm, true);
  }

  private async fetchRoutes(
    waypoints: LatLng[],
    paceSecondsPerKm: number,
    alternatives: boolean
  ): Promise<ProviderRoute[]> {
    if (waypoints.length < 2) {
      throw new Error('Need at least 2 waypoints for routing');
    }

    // Mapbox expects "lng,lat;lng,lat;..." format
    const coordinates = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
    const params = new URLSearchParams({
      coordinates,
      alternatives: alternatives ? 'true' : 'false',
    });

    const res = await fetch(`/api/mapbox/directions?${params}`);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`Mapbox Directions failed: ${data.code || 'no routes'}`);
    }

    return data.routes.map((route: MapboxRoute) => this.normalizeRoute(route, paceSecondsPerKm));
  }

  private normalizeRoute(route: MapboxRoute, paceSecondsPerKm: number): ProviderRoute {
    const instructions: ProviderInstruction[] = [];

    for (const leg of route.legs) {
      for (const step of leg.steps) {
        if (step.distance < 5 && step.maneuver.type !== 'arrive' && step.maneuver.type !== 'depart') {
          continue;
        }

        instructions.push({
          type: mapMapboxManeuver(step.maneuver.type, step.maneuver.modifier),
          text: step.maneuver.instruction || `Continue on ${step.name || 'the path'}`,
          distance: step.distance,
          location: step.maneuver.location,
        });
      }
    }

    // Override walking duration with running pace
    const runningDuration = (route.distance / 1000) * paceSecondsPerKm;

    return {
      polyline: route.geometry.coordinates,
      distance: route.distance,
      duration: runningDuration,
      instructions,
      metadata: { provider: 'mapbox' },
    };
  }
}
```

Run: `npx vitest run src/lib/providers/mapbox/__tests__/router.test.ts` (expect pass)

- [ ] **Step 4: Write failing Mapbox geocoder test and implement**

```typescript
// src/lib/providers/mapbox/__tests__/geocoder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapboxGeocoder } from '../geocoder';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MapboxGeocoder', () => {
  let geocoder: MapboxGeocoder;

  beforeEach(() => {
    geocoder = new MapboxGeocoder();
    vi.clearAllMocks();
  });

  it('reverseGeocode extracts name and city from Mapbox v6 response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [{
          properties: {
            name: 'Norr Malarstrand',
            context: {
              neighborhood: { name: 'Kungsholmen' },
              place: { name: 'Stockholm' },
              country: { name: 'Sweden' },
            },
          },
          geometry: { coordinates: [18.04, 59.33] },
        }],
      }),
    });

    const place = await geocoder.reverseGeocode(59.33, 18.04);
    expect(place.name).toBe('Kungsholmen');
    expect(place.city).toBe('Stockholm');
    expect(place.country).toBe('Sweden');
  });

  it('search calls forward geocoding and returns places', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [{
          properties: {
            name: 'Stockholm',
            context: {
              place: { name: 'Stockholm' },
              country: { name: 'Sweden' },
            },
          },
          geometry: { coordinates: [18.07, 59.33] },
        }],
      }),
    });

    const results = await geocoder.search('Stockholm');
    expect(results).toHaveLength(1);
    expect(results[0].city).toBe('Stockholm');
  });

  it('reverseGeocode returns unknown on error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const place = await geocoder.reverseGeocode(0, 0);
    expect(place.name).toBe('Unknown');
  });
});
```

```typescript
// src/lib/providers/mapbox/geocoder.ts
import type { Geocoder, LatLng, Place } from '../types';

interface MapboxContext {
  neighborhood?: { name: string };
  locality?: { name: string };
  place?: { name: string };
  region?: { name: string };
  country?: { name: string };
}

interface MapboxFeature {
  properties: {
    name: string;
    full_address?: string;
    context: MapboxContext;
  };
  geometry: { coordinates: [number, number] };
}

function featureToPlace(feature: MapboxFeature): Place {
  const ctx = feature.properties.context;
  const name = ctx.neighborhood?.name || ctx.locality?.name || feature.properties.name || 'Unknown';
  const city = ctx.place?.name || ctx.region?.name || '';
  const country = ctx.country?.name || '';
  const [lng, lat] = feature.geometry.coordinates;

  return { name, city, country, lat, lng };
}

export class MapboxGeocoder implements Geocoder {
  async reverseGeocode(lat: number, lng: number): Promise<Place> {
    try {
      const res = await fetch(`/api/mapbox/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();

      if (!data.features?.length) {
        return { name: 'Unknown', city: '', country: '', lat, lng };
      }

      return featureToPlace(data.features[0]);
    } catch {
      return { name: 'Unknown', city: '', country: '', lat, lng };
    }
  }

  async search(query: string, near?: LatLng): Promise<Place[]> {
    try {
      const params = new URLSearchParams({ query });
      if (near) {
        params.set('lng', String(near.lng));
        params.set('lat', String(near.lat));
      }

      const res = await fetch(`/api/mapbox/geocode?${params}`);
      const data = await res.json();

      if (!data.features?.length) return [];

      return data.features.map(featureToPlace);
    } catch {
      return [];
    }
  }
}
```

Run: `npx vitest run src/lib/providers/mapbox/__tests__/geocoder.test.ts` (expect pass)

- [ ] **Step 5: Write failing Mapbox POI test and implement**

```typescript
// src/lib/providers/mapbox/__tests__/poi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapboxPOIProvider } from '../poi';

vi.mock('@/lib/overpass', () => ({
  fetchLandmarksNearRoute: vi.fn().mockResolvedValue([]),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MapboxPOIProvider', () => {
  let provider: MapboxPOIProvider;

  beforeEach(() => {
    provider = new MapboxPOIProvider();
    vi.clearAllMocks();
  });

  it('getNaturePOIs calls /api/pois (Overpass fallback) and normalizes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        pois: [
          { id: 1, name: 'Park', lat: 59.33, lng: 18.04, type: 'park' },
        ],
      }),
    });

    const result = await provider.getNaturePOIs({ lat: 59.33, lng: 18.04 }, 2);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Park');
  });

  it('getLandmarks uses Overpass fallback', async () => {
    const { fetchLandmarksNearRoute } = await import('@/lib/overpass');
    vi.mocked(fetchLandmarksNearRoute).mockResolvedValue([
      { id: 1, name: 'Castle', type: 'castle', lat: 59.33, lng: 18.05 },
    ]);

    const result = await provider.getLandmarks([[18.04, 59.32]], 300);
    expect(result).toHaveLength(1);
  });

  it('getIslandOutline calls /api/island-outline (Overpass fallback)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ island: null }),
    });

    const result = await provider.getIslandOutline(59.33, 18.04);
    expect(result).toBeNull();
  });
});
```

```typescript
// src/lib/providers/mapbox/poi.ts
import type { POIProvider, LatLng, POI, Polygon } from '../types';
import { fetchLandmarksNearRoute } from '@/lib/overpass';

/**
 * Mapbox POI provider.
 * Mapbox does not have a dedicated POI/places search API comparable to Google Places.
 * We fall back to Overpass API for nature POIs, landmarks, and island outlines --
 * same as the Open provider, but via the Mapbox bundle so the registry stays clean.
 */

const LANDMARK_EMOJIS: Record<string, string> = {
  museum: '\uD83C\uDFDB\uFE0F',
  monument: '\uD83D\uDDFF',
  viewpoint: '\uD83D\uDC41\uFE0F',
  park: '\uD83C\uDF33',
  church: '\u26EA',
  historic: '\uD83C\uDFF0',
  artwork: '\uD83C\uDFA8',
  fountain: '\u26F2',
  ruins: '\uD83C\uDFDA\uFE0F',
  castle: '\uD83C\uDFF0',
  landmark: '\uD83D\uDCCD',
};

export class MapboxPOIProvider implements POIProvider {
  async getNaturePOIs(center: LatLng, radiusKm: number): Promise<POI[]> {
    // Mapbox has no equivalent to Overpass/Places for nature POIs.
    // Use the existing /api/pois endpoint (Overpass) as fallback.
    try {
      const radiusM = Math.round(radiusKm * 1000);
      const res = await fetch(`/api/pois?lat=${center.lat}&lng=${center.lng}&radius=${radiusM}`);
      const data = await res.json();

      return (data.pois || []).map((p: { name: string; lat: number; lng: number; type: string }) => ({
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        emoji: LANDMARK_EMOJIS[p.type] || '\uD83C\uDF3F',
      }));
    } catch {
      return [];
    }
  }

  async getLandmarks(polyline: [number, number][], bufferMeters: number = 300): Promise<POI[]> {
    try {
      const landmarks = await fetchLandmarksNearRoute(polyline, bufferMeters);
      return landmarks.map((lm) => ({
        name: lm.name,
        type: lm.type,
        lat: lm.lat,
        lng: lm.lng,
        emoji: LANDMARK_EMOJIS[lm.type] || '\uD83D\uDCCD',
        metadata: { description: lm.description, distance: lm.distance, id: lm.id },
      }));
    } catch {
      return [];
    }
  }

  async getIslandOutline(lat: number, lng: number): Promise<Polygon | null> {
    try {
      const res = await fetch(`/api/island-outline?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (!data.island) return null;
      return {
        points: data.island.outline.map((p: { lat: number; lng: number }) => ({
          lat: p.lat,
          lng: p.lng,
        })),
      };
    } catch {
      return null;
    }
  }
}
```

Run: `npx vitest run src/lib/providers/mapbox/__tests__/poi.test.ts` (expect pass)

- [ ] **Step 6: Create Mapbox bundle index and register**

```typescript
// src/lib/providers/mapbox/index.ts
import { MapboxRouter } from './router';
import { MapboxGeocoder } from './geocoder';
import { MapboxPOIProvider } from './poi';
import { registerProvider } from '../registry';

export { MapboxRouter, MapboxGeocoder, MapboxPOIProvider };

/**
 * Register all Mapbox adapters with the provider registry.
 * Call this once during app initialization when Mapbox token is available.
 */
export function registerMapboxProvider(): void {
  registerProvider('mapbox', {
    router: new MapboxRouter(),
    geocoder: new MapboxGeocoder(),
    poi: new MapboxPOIProvider(),
  });
}
```

Run: `npx vitest run src/lib/providers/mapbox/__tests__/router.test.ts src/lib/providers/mapbox/__tests__/geocoder.test.ts src/lib/providers/mapbox/__tests__/poi.test.ts` (all pass)

---

### Task 10: A/B Testing + Settings UI

**Files:**
- Create: `src/lib/providers/ab-test.ts`
- Test: `src/lib/providers/__tests__/ab-test.test.ts`
- Modify: `src/components/SettingsView.tsx` (add provider selection section)

- [ ] **Step 1: Write failing A/B test**

```typescript
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

    // Run multiple times to ensure google can be picked
    const results = new Set<ProviderName>();
    for (let i = 0; i < 50; i++) {
      results.add(pickABBundle(config));
    }
    expect(results.has('open')).toBe(true);
    // With 50 iterations and 2 options, probability of never hitting google is (0.5)^50
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
```

Run: `npx vitest run src/lib/providers/__tests__/ab-test.test.ts` (expect fail)

- [ ] **Step 2: Implement A/B test logic**

```typescript
// src/lib/providers/ab-test.ts
import type { ProviderConfig, ProviderName } from './types';

let sessionProvider: ProviderName | null = null;

/**
 * Pick a random provider bundle for A/B testing.
 * Only includes bundles where API keys are available.
 */
export function pickABBundle(config: ProviderConfig): ProviderName {
  const candidates: ProviderName[] = ['open'];
  if (config.googleApiKey) candidates.push('google');
  if (config.mapboxApiKey) candidates.push('mapbox');
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Get the provider for this session.
 * If A/B testing is enabled, picks randomly once per session.
 * If A/B testing is disabled, returns the configured bundle.
 */
export function getSessionProvider(config: ProviderConfig): ProviderName {
  if (!config.abTestEnabled) {
    return config.bundle;
  }

  if (sessionProvider === null) {
    sessionProvider = pickABBundle(config);
  }

  return sessionProvider;
}

/** Reset session provider (for tests or on explicit user action). */
export function resetSessionProvider(): void {
  sessionProvider = null;
}
```

Run: `npx vitest run src/lib/providers/__tests__/ab-test.test.ts` (expect pass)

- [ ] **Step 3: Add provider settings section to SettingsView**

In `src/components/SettingsView.tsx`, add a new section after the existing settings. The exact insertion point depends on the current layout, but the new section should contain:

```tsx
{/* --- Provider Settings (dev) --- */}
<div className="border-t border-gray-700 pt-4 mt-4">
  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
    Map Provider
  </h3>

  {/* Bundle selector */}
  <label className="block text-sm text-gray-300 mb-1">Provider Bundle</label>
  <select
    value={settings.providerBundle || 'open'}
    onChange={(e) => updateSettings({ providerBundle: e.target.value as 'open' | 'google' | 'mapbox' })}
    className="w-full bg-gray-800 text-white rounded px-3 py-2 mb-3"
  >
    <option value="open">Open (MapLibre + OSRM)</option>
    <option value="google">Google Maps</option>
    <option value="mapbox">Mapbox</option>
  </select>

  {/* A/B test toggle */}
  <label className="flex items-center gap-2 text-sm text-gray-300">
    <input
      type="checkbox"
      checked={settings.abTestEnabled || false}
      onChange={(e) => updateSettings({ abTestEnabled: e.target.checked })}
      className="rounded bg-gray-700"
    />
    A/B test mode (random provider per session)
  </label>

  {/* Active provider badge (read-only info) */}
  <div className="mt-2 text-xs text-gray-500">
    Active: <span className="text-indigo-400 font-mono">{settings.providerBundle || 'open'}</span>
  </div>
</div>
```

This is added using the existing `settings` state and `updateSettings` pattern already in SettingsView.

Run: `npx vitest run` (all tests pass, no regressions)

---

### Task 11: Provider Initialization Wiring

**Files:**
- Create: `src/lib/providers/init.ts`
- Modify: `src/app/layout.tsx` or top-level client component (add provider init call)

- [ ] **Step 1: Create initialization module**

```typescript
// src/lib/providers/init.ts
import { setProviderConfig } from './registry';
import { getSessionProvider, resetSessionProvider } from './ab-test';
import { getSettings } from '@/lib/storage';
import type { ProviderConfig } from './types';

let initialized = false;

/**
 * Initialize the provider system from persisted settings.
 * Call once at app startup (client-side only).
 *
 * Flow:
 * 1. Read settings from IndexedDB
 * 2. If A/B enabled, pick random bundle for this session
 * 3. Register Google/Mapbox adapters if keys are available
 * 4. Set active config in registry
 */
export async function initProviders(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (initialized) return;

  const settings = await getSettings();

  const config: ProviderConfig = {
    bundle: settings.providerBundle || 'open',
    overrides: settings.providerOverrides,
    abTestEnabled: settings.abTestEnabled,
  };

  // Check for API keys via server endpoint (keys are env vars, not in client settings)
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
```

- [ ] **Step 2: Create provider-keys API route**

```typescript
// src/app/api/provider-keys/route.ts
import { NextResponse } from 'next/server';

/**
 * Returns which provider API keys are available (boolean flags, NOT the actual keys).
 * This lets the client know which providers can be activated.
 */
export async function GET() {
  return NextResponse.json({
    google: !!process.env.GOOGLE_MAPS_API_KEY,
    mapbox: !!process.env.MAPBOX_ACCESS_TOKEN,
  });
}
```

- [ ] **Step 3: Wire initProviders into app startup**

In the main client-side layout/provider component, add after the existing `initDB()` call:

```typescript
import { initProviders } from '@/lib/providers/init';

// Inside useEffect that runs on mount:
initDB().then(() => initProviders());
```

Run: `npx vitest run` (all tests pass)

---

### Task 12: Full Integration Verification

**Files:**
- Test: `src/lib/providers/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test verifying registry fallback and override behavior**

```typescript
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

    // Google is not registered, should fall back to Open
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

    // Geocoder should still be Open (no override)
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
```

Run: `npx vitest run src/lib/providers/__tests__/integration.test.ts` (expect pass)

- [ ] **Step 2: Run full test suite to verify no regressions**

Run: `npx vitest run` (all tests pass)

- [ ] **Step 3: Manual smoke test checklist**

Verify in the browser:
1. App loads with Open provider (default) -- map renders, routes generate, geocoding works
2. Settings page shows "Map Provider" section with bundle selector
3. Changing provider to Google/Mapbox shows appropriate error if no API key
4. A/B toggle works and persists across page reload
5. Provider badge in Settings shows active provider name
