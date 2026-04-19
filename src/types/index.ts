import type { Landmark, LandmarkType } from '@/lib/overpass';
export type { Landmark, LandmarkType };

export interface RouteWaypoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface GeneratedRoute {
  waypoints: RouteWaypoint[];
  polyline: [number, number][]; // [lng, lat] pairs from OSRM
  distance: number; // meters
  duration: number; // seconds
  instructions: TurnInstruction[];
  landmarks?: Landmark[];
  walkToStart?: [number, number][]; // [lng, lat] pairs from GPS to route start (dashed line)
}

export interface TurnInstruction {
  text: string;
  distance: number; // meters to next turn
  location: [number, number]; // [lng, lat]
  type: 'turn-left' | 'turn-right' | 'straight' | 'arrive' | 'depart' | 'u-turn';
}

export interface AppSettings {
  apiProvider?: 'claude' | 'perplexity' | 'gemini' | 'minimax';
  apiKey?: string;
  voiceEnabled: boolean;
  voiceStyle: 'concise' | 'with-pace' | 'motivational';
  units: 'km' | 'miles';
  defaultDistance: number; // km
  bodyWeightKg?: number;
  paceSecondsPerKm: number; // running pace in seconds per km (default 360 = 6:00/km)
  providerBundle?: 'open' | 'google' | 'mapbox';
  providerOverrides?: {
    renderer?: 'open' | 'google' | 'mapbox';
    router?: 'open' | 'google' | 'mapbox';
    geocoder?: 'open' | 'google' | 'mapbox';
    poi?: 'open' | 'google' | 'mapbox';
  };
  abTestEnabled?: boolean;
  scenicMode: ScenicMode;
}

export type AppView = 'map' | 'generate' | 'navigate' | 'settings' | 'history' | 'routes' | 'summary' | 'stats';

export type RouteMode = 'ai' | 'algorithmic';

export type ScenicMode = 'standard' | 'explore';

export interface FilteredPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
  heading: number | null;
}

export interface ActiveRunSnapshot {
  id: string;
  startTime: number;
  elapsedMs: number;
  paused: boolean;
  routeId: string | null;
  trace: FilteredPosition[];
}

export interface CompletedRun {
  id: string;
  startTime: number;
  endTime: number;
  elapsedMs: number;
  distanceMeters: number;
  trace: FilteredPosition[];
  routeId: string | null;
  routePolyline?: [number, number][]; // [lng, lat] planned route at time of run
  providerBundle?: string;
  providerOverrides?: Record<string, string>;
  generationLogId?: string;
  analysisId?: string;
}

export type Run = ActiveRunSnapshot | CompletedRun;
