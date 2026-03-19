'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import RouteGenerator from '@/components/RouteGenerator';
import NavigationView from '@/components/NavigationView';
import SettingsView from '@/components/SettingsView';
import HistoryView from '@/components/HistoryView';
import { GeneratedRoute, AppView } from '@/types';
import { getCurrentPosition, reverseGeocode, watchPosition } from '@/lib/geolocation';
import { generateRouteWaypoints } from '@/lib/route-ai';
import { routeViaOSRM } from '@/lib/route-osrm';
import { getSettings, saveRoute } from '@/lib/storage';

// Dynamic import MapView to avoid SSR issues with MapLibre
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function Home() {
  const [view, setView] = useState<AppView>('generate');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [cityName, setCityName] = useState('');
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user location on mount
  useEffect(() => {
    let watchId: number;

    const initLocation = async () => {
      try {
        const pos = await getCurrentPosition();
        const loc: [number, number] = [pos.lng, pos.lat];
        setUserLocation(loc);

        const city = await reverseGeocode(pos.lat, pos.lng);
        setCityName(city);

        // Start watching for updates
        watchId = watchPosition(
          (pos) => setUserLocation([pos.lng, pos.lat]),
          (err) => console.warn('GPS error:', err.message)
        );
      } catch (err) {
        setError('Could not get your location. Please enable GPS.');
      }
    };

    initLocation();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleGenerate = useCallback(async (distance: number) => {
    if (!userLocation) return;
    setIsLoading(true);
    setError(null);

    try {
      const settings = getSettings();

      // Step 1: Get AI-generated waypoints
      const waypoints = await generateRouteWaypoints({
        lat: userLocation[1], // userLocation is [lng, lat]
        lng: userLocation[0],
        distanceKm: distance,
        cityName,
        settings,
      });

      // Step 2: Route via OSRM for real roads
      const generatedRoute = await routeViaOSRM(waypoints);

      setRoute(generatedRoute);

      // Save to history
      saveRoute(generatedRoute, cityName);

      // Switch to map view to show the route
      setView('map');
    } catch (err: any) {
      setError(err.message || 'Failed to generate route');
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, cityName]);

  return (
    <main className="h-[100dvh] w-full relative overflow-hidden bg-gray-950">
      {/* Map fills entire screen */}
      <MapView
        route={route}
        userLocation={userLocation}
        isNavigating={view === 'navigate'}
      />

      {/* Error toast */}
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white px-4 py-3 rounded-xl z-30 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="absolute top-2 right-3 text-white/70"
          >
            x
          </button>
        </div>
      )}

      {/* Bottom panel - Route Generator */}
      {view === 'generate' && (
        <RouteGenerator
          onGenerate={handleGenerate}
          isLoading={isLoading}
          userLocation={userLocation}
          cityName={cityName}
        />
      )}

      {/* Navigation bar */}
      <nav className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => setView('settings')}
          className="bg-white/90 rounded-full p-3 shadow-lg active:bg-gray-100"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <button
          onClick={() => setView('history')}
          className="bg-white/90 rounded-full p-3 shadow-lg active:bg-gray-100"
          aria-label="History"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
      </nav>

      {/* Settings overlay */}
      {view === 'settings' && (
        <SettingsView onClose={() => setView('generate')} />
      )}

      {/* History overlay */}
      {view === 'history' && (
        <HistoryView
          onClose={() => setView('generate')}
          onLoadRoute={(loadedRoute) => {
            setRoute(loadedRoute);
            setView('map');
          }}
        />
      )}

      {/* Navigation overlay */}
      {view === 'navigate' && route && (
        <NavigationView
          route={route}
          userLocation={userLocation}
          onStop={() => setView('map')}
        />
      )}

      {/* Route info bar */}
      {route && view === 'map' && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm rounded-t-2xl p-4 z-20 safe-bottom">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-bold text-white">
                {(route.distance / 1000).toFixed(1)} km
              </span>
              <span className="text-gray-400 ml-3">
                ~{Math.round(route.duration / 60)} min
              </span>
            </div>
            <button
              onClick={() => { setView('navigate'); }}
              className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold active:bg-green-600"
            >
              Start Run
            </button>
          </div>
          <button
            onClick={() => { setRoute(null); setView('generate'); }}
            className="text-gray-400 text-sm underline"
          >
            Generate new route
          </button>
        </div>
      )}
    </main>
  );
}
