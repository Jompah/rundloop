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
}

export interface TurnInstruction {
  text: string;
  distance: number; // meters to next turn
  location: [number, number]; // [lng, lat]
  type: 'turn-left' | 'turn-right' | 'straight' | 'arrive' | 'depart' | 'u-turn';
}

export interface AppSettings {
  apiProvider?: 'claude' | 'perplexity';
  apiKey?: string;
  voiceEnabled: boolean;
  units: 'km' | 'miles';
  defaultDistance: number; // km
}

export type AppView = 'map' | 'generate' | 'navigate' | 'settings' | 'history';

export type RouteMode = 'ai' | 'algorithmic';

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
}

export type Run = ActiveRunSnapshot | CompletedRun;
