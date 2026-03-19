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
  apiProvider: 'claude' | 'perplexity';
  apiKey: string;
  voiceEnabled: boolean;
  units: 'km' | 'miles';
  defaultDistance: number; // km
}

export type AppView = 'map' | 'generate' | 'navigate' | 'settings' | 'history';
