# Map Provider Abstraction Layer — Design Spec

## Problem

Drift använder idag en fast open-source-stack (MapLibre + OSRM + Nominatim + Overpass) med direkta API-anrop utan abstraktionslager. Vi vill kunna jämföra denna stack mot Google Maps och Mapbox för att hitta bästa kombinationen av prestanda, ruttkvalitet och kostnad.

## Approach

**Hybrid provider-bundles med override.** Varje provider (Open, Google, Mapbox) levereras som ett bundle med alla 4 tjänster, men enskilda tjänster kan overridas. Admin-toggle i Settings + A/B-testläge som randomiserar bundle per session.

## Providers

| Provider | Rendering | Routing | Geocoding | POI |
|----------|-----------|---------|-----------|-----|
| **Open** (default) | MapLibre GL (CartoDB dark tiles) | OSRM foot profile | Nominatim | Overpass API |
| **Google** | Google Maps JS API | Directions API (walking) | Geocoding API | Places API |
| **Mapbox** | Mapbox GL JS | Mapbox Directions (walking) | Mapbox Geocoding | Mapbox POI / Overpass fallback |

Open är alltid default och automatisk fallback om API-nyckel saknas.

## Interfaces

### MapRenderer

```typescript
interface MapRenderer {
  init(container: HTMLElement, options: MapOptions): Promise<void>
  setCenter(lat: number, lng: number, zoom: number): void
  addPolyline(coords: [number, number][], style: PolylineStyle): string
  removePolyline(id: string): void
  addMarker(lat: number, lng: number, options: MarkerOptions): string
  removeMarker(id: string): void
  fitBounds(bounds: LatLngBounds, padding?: number): void
  setHeading(degrees: number): void
  onMove(callback: (center: LatLng) => void): void
  destroy(): void
}
```

Gradient-polyline (elevation coloring) hanteras via `PolylineStyle.colorExpression` — varje adapter översätter till sitt interna format (MapLibre data-driven styling, Google Maps PolylineOptions, etc.).

### RoutingEngine

```typescript
interface RoutingEngine {
  getRoute(waypoints: LatLng[]): Promise<Route>
  getRouteWithAlternatives(waypoints: LatLng[]): Promise<Route[]>
}
```

### Geocoder

```typescript
interface Geocoder {
  reverseGeocode(lat: number, lng: number): Promise<Place>
  search(query: string, near?: LatLng): Promise<Place[]>
}
```

`search` förberett för framtida "sök destination"-feature. Idag används bara `reverseGeocode`.

### POIProvider

```typescript
interface POIProvider {
  getNaturePOIs(center: LatLng, radiusKm: number): Promise<POI[]>
  getLandmarks(center: LatLng, radiusKm: number): Promise<POI[]>
  getIslandOutline(lat: number, lng: number): Promise<Polygon | null>
}
```

## Normaliserade datatyper

```typescript
interface Route {
  polyline: [number, number][]
  distance: number          // meter
  duration: number          // sekunder
  instructions: Instruction[]
  metadata?: Record<string, unknown>
}

interface Instruction {
  type: 'turn-left' | 'turn-right' | 'continue' | 'arrive' | 'depart' | 'u-turn'
  text: string
  distance: number          // meter till nästa instruktion
  location: LatLng
}

interface Place {
  name: string
  city: string
  country: string
  lat: number
  lng: number
  metadata?: Record<string, unknown>
}

interface POI {
  name: string
  type: string
  lat: number
  lng: number
  emoji?: string
  metadata?: Record<string, unknown>
}

interface LatLng {
  lat: number
  lng: number
}
```

Provider-specifik extra-data (Google ratings, Mapbox confidence scores) exponeras via valfritt `metadata`-fält.

## Elevation

Elevation (Open-Meteo) hålls utanför provider-abstraktionen — den fungerar med alla providers och behöver ingen adapter.

## Registry & Bundle-logik

```typescript
// src/lib/providers/registry.ts

interface ProviderConfig {
  bundle: 'open' | 'google' | 'mapbox'
  overrides?: {
    renderer?: 'open' | 'google' | 'mapbox'
    router?: 'open' | 'google' | 'mapbox'
    geocoder?: 'open' | 'google' | 'mapbox'
    poi?: 'open' | 'google' | 'mapbox'
  }
  abTestEnabled?: boolean
}

function getRenderer(): MapRenderer
function getRouter(): RoutingEngine
function getGeocoder(): Geocoder
function getPOIProvider(): POIProvider
function getActiveConfig(): ProviderConfig
```

Registry läser config från Settings (IndexedDB). Om A/B-test är aktiverat randomiseras bundle vid session-start. Override-logik: om `overrides.router` är satt, används den istället för bundle-default.

## A/B-testning

- **A/B toggle** i Settings (dev/admin) — randomiserar bundle per session (session = varje gång appen öppnas/laddas om)
- Visar diskret i UI vilken provider som är aktiv (liten badge)
- Bara bundles med giltiga API-nycklar ingår i randomiseringen
- Fallback till Open om vald provider failar

## Prestanda-logging

### Vid ruttgenerering (automatiskt)

```typescript
interface GenerationLog {
  id: string
  timestamp: string
  provider: string
  providerOverrides: Record<string, string>
  location: LatLng
  distanceRequested: number
  distanceActual: number
  routingMs: number
  geocodeMs: number
  poiMs: number
  totalMs: number
  success: boolean
  error?: string
}
```

Varje interface-anrop wrappas med timing i `logger.ts`. Sparas i IndexedDB.

### Vid run-slut (utökar CompletedRun)

Befintligt CompletedRun-objekt utökas med:

```typescript
{
  providerBundle: string
  providerOverrides: Record<string, string>
  generationLogId: string
  tileLoadMsAvg: number
  rating: number | null       // 1-5, valfritt
  notes: string | null        // fritext, valfritt
}
```

### Export

Alla loggar kan exporteras som JSON från Settings-sidan för att dela med Claude för analys.

## Feedback-flöde

1. Generera rutt → auto-logga prestanda
2. Spring/gå rutten → auto-logga run-data + provider-info
3. (Valfritt) Rating + anteckning i appen efter run
4. (Valfritt) Exportera loggar / dela anteckningar med Claude vid tillfälle

Under tidiga testfasen: Johannes testar hemma i Stockholm (kända rutter) och på Sicilien (okänd terräng). Feedback ges konversationellt till Claude eller via Apple Notes.

## Filstruktur

```
src/lib/providers/
├── types.ts              # Interfaces + normaliserade typer
├── registry.ts           # Bundle-hantering, override-logik, A/B
├── logger.ts             # Prestanda-wrapping, auto-timing, IndexedDB
├── open/
│   ├── renderer.ts       # ← refaktorerad från MapView.tsx
│   ├── router.ts         # ← refaktorerad från route-osrm.ts
│   ├── geocoder.ts       # ← refaktorerad från geolocation.ts (Nominatim)
│   ├── poi.ts            # ← refaktorerad från overpass.ts
│   └── index.ts          # OpenBundle export
├── google/
│   ├── renderer.ts       # Google Maps JS API
│   ├── router.ts         # Directions API
│   ├── geocoder.ts       # Geocoding API
│   ├── poi.ts            # Places API
│   └── index.ts          # GoogleBundle export
└── mapbox/
    ├── renderer.ts       # Mapbox GL JS
    ├── router.ts         # Mapbox Directions
    ├── geocoder.ts       # Mapbox Geocoding
    ├── poi.ts            # Mapbox POI / Overpass fallback
    └── index.ts          # MapboxBundle export
```

## Migrationsstrategi

1. **Skapa interfaces + types** baserat på befintlig kod
2. **Wrappa befintlig kod** som Open-provider — inga nya API:er, appen fungerar identiskt
3. **Byt ut direktanrop** i komponenter → registry-anrop
4. **Verifiera** att allt funkar exakt som innan
5. **Lägg till logging**-wrapper
6. **Implementera Google**-adapter
7. **Implementera Mapbox**-adapter
8. **A/B + Settings UI**

Steg 1-4 görs först. Appen ska vara 100% funktionellt identisk efter steg 4 innan vi går vidare.

## API-nycklar

- Google Maps och Mapbox API-nycklar hanteras server-side som env vars (samma pattern som `ANTHROPIC_API_KEY`)
- API-routes i `src/app/api/` proxar anrop för att inte exponera nycklar i klientkod
- Om nyckel saknas → provider exkluderas från A/B-pool, manuellt val ger felmeddelande + fallback till Open

## Utanför scope

- **Re-routing vid avvikelse** — viktig framtida feature, behöver egen spec. Bygger ovanpå detta abstraktionslager.
- **Offline map tiles** — separat feature
- **Backend/molnlagring** — Phase 2+
- **Automatiserad A/B-analytics** — vi gör manuell utvärdering först
