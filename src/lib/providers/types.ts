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
