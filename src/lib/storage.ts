import { AppSettings, GeneratedRoute } from '@/types';

const SETTINGS_KEY = 'rundloop_settings';
const HISTORY_KEY = 'rundloop_history';

const defaultSettings: AppSettings = {
  apiProvider: 'claude',
  apiKey: '',
  voiceEnabled: false,
  units: 'km',
  defaultDistance: 5,
};

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings;
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface SavedRoute {
  id: string;
  route: GeneratedRoute;
  city: string;
  createdAt: string;
}

export function getSavedRoutes(): SavedRoute[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveRoute(route: GeneratedRoute, city: string): SavedRoute {
  const saved: SavedRoute = {
    id: crypto.randomUUID(),
    route,
    city,
    createdAt: new Date().toISOString(),
  };
  const routes = getSavedRoutes();
  routes.unshift(saved);
  // Keep max 50 routes
  localStorage.setItem(HISTORY_KEY, JSON.stringify(routes.slice(0, 50)));
  return saved;
}

export function deleteRoute(id: string): void {
  const routes = getSavedRoutes().filter(r => r.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(routes));
}
