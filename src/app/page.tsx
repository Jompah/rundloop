'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import RouteGenerator from '@/components/RouteGenerator';
import NavigationView from '@/components/NavigationView';
import SettingsView from '@/components/SettingsView';
import TabBar from '@/components/TabBar';
import { RunHistoryView } from '@/components/RunHistoryView';
import { RunDetailOverlay } from '@/components/RunDetailOverlay';
import { SavedRoutesView } from '@/components/SavedRoutesView';
import EndRunDialog from '@/components/EndRunDialog';
import CrashRecoveryDialog from '@/components/CrashRecoveryDialog';
import RunSummaryView from '@/components/RunSummaryView';
import { GeneratedRoute, AppView, RouteMode, RouteWaypoint, ActiveRunSnapshot, CompletedRun } from '@/types';
import { getCurrentPosition, reverseGeocode, watchFilteredPosition, setFakePosition, clearFakePosition, isFakeGPS } from '@/lib/geolocation';
import { initDB, dbDelete } from '@/lib/db';
import { generateRouteWaypoints, generateRouteAlgorithmic } from '@/lib/route-ai';
import { routeViaOSRM } from '@/lib/route-osrm';
import { findNearbySavedRoutes, getSettings } from '@/lib/storage';
import { useRunSession } from '@/hooks/useRunSession';
import { unlockIOSAudio, ensureSpeechReady } from '@/lib/voice';
import { findIncompleteRun, clearIncompleteRun } from '@/lib/crash-recovery';

// Dynamic import MapView to avoid SSR issues with MapLibre
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const FAKE_CITIES = [
  { name: 'Stockholm (Gamla Stan)', lat: 59.3251, lng: 18.0711 },
  { name: 'Goteborg (Haga)', lat: 57.6969, lng: 11.9569 },
  { name: 'Malmo (Mollan)', lat: 55.5900, lng: 13.0038 },
  { name: 'Barcelona (Gothic Quarter)', lat: 41.3833, lng: 2.1761 },
];

export default function Home() {
  const [view, setView] = useState<AppView>('generate');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [cityName, setCityName] = useState('');
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [userSpeed, setUserSpeed] = useState<number | null>(null);
  const [fakeGPSActive, setFakeGPSActive] = useState(false);
  const [fakeGPSLabel, setFakeGPSLabel] = useState('');
  const [showFakeMenu, setShowFakeMenu] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(5);
  const [routeMode, setRouteMode] = useState<RouteMode>('algorithmic');
  const [recoverySnapshot, setRecoverySnapshot] = useState<ActiveRunSnapshot | null>(null);
  const [showEndRunDialog, setShowEndRunDialog] = useState(false);
  const [completedRunData, setCompletedRunData] = useState<CompletedRun | null>(null);
  const [selectedRun, setSelectedRun] = useState<CompletedRun | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const runSession = useRunSession();

  // Initialize IndexedDB: migration + persistent storage
  useEffect(() => {
    initDB();
  }, []);

  // Check for crashed/incomplete runs on mount
  useEffect(() => {
    async function checkCrashRecovery() {
      const incomplete = await findIncompleteRun();
      if (incomplete) {
        setRecoverySnapshot(incomplete);
      }
    }
    checkCrashRecovery();
  }, []);

  // Reset speechSynthesis on iOS Safari when app returns from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ensureSpeechReady();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Compute nearby saved routes whenever position or distance changes
  const [nearbyRoutes, setNearbyRoutes] = useState<GeneratedRoute[]>([]);
  useEffect(() => {
    if (!userLocation) {
      setNearbyRoutes([]);
      return;
    }
    // userLocation is [lng, lat]
    findNearbySavedRoutes(userLocation[1], userLocation[0], selectedDistance)
      .then(setNearbyRoutes)
      .catch(() => setNearbyRoutes([]));
  }, [userLocation, selectedDistance]);

  const handleLoadNearby = useCallback((nearbyRoute: GeneratedRoute) => {
    setRoute(nearbyRoute);
    setView('map');
  }, []);

  const applyFakeGPS = useCallback(async (city: { name: string; lat: number; lng: number }) => {
    setFakePosition(city.lat, city.lng);
    setFakeGPSActive(true);
    setFakeGPSLabel(city.name);
    setShowFakeMenu(false);
    const loc: [number, number] = [city.lng, city.lat];
    setUserLocation(loc);
    const resolvedCity = await reverseGeocode(city.lat, city.lng);
    setCityName(resolvedCity);
  }, []);

  const disableFakeGPS = useCallback(() => {
    clearFakePosition();
    setFakeGPSActive(false);
    setFakeGPSLabel('');
    setShowFakeMenu(false);
  }, []);

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

        watchId = watchFilteredPosition(
          (pos) => {
            setUserLocation([pos.lng, pos.lat]);
            setUserHeading(pos.heading);
            setUserSpeed(pos.speed);
          },
          (_pos, _reason) => { /* rejected, ignore for location display */ },
          (err) => console.warn('GPS error:', err.message)
        );
      } catch (err) {
        // Geolocation failed — fall back to Stockholm (Gamla Stan) automatically
        const fallback = FAKE_CITIES[0];
        applyFakeGPS(fallback);
      }
    };

    initLocation();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [applyFakeGPS]);

  const handleGenerate = useCallback(async (distance: number) => {
    if (!userLocation) return;
    setIsLoading(true);
    setError(null);

    const MAX_ITERATIONS = 6; // Per attempt (reduced from 8 since we now retry with different waypoints)
    const TOLERANCE = 0.20;
    const MAX_ATTEMPTS = 3; // Retry with different initial waypoints to handle OSRM non-monotonicity
    const startLat = userLocation[1]; // userLocation is [lng, lat]
    const startLng = userLocation[0];

    try {
      let generatedRoute: GeneratedRoute | null = null;
      let overallBestRoute: GeneratedRoute | null = null;
      let overallBestDiff = Infinity;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Generate initial waypoints (different each time due to random rotation / AI variance)
        let initialWaypoints: RouteWaypoint[];
        if (routeMode === 'algorithmic') {
          initialWaypoints = await generateRouteAlgorithmic(startLat, startLng, distance);
        } else {
          const settings = await getSettings();
          initialWaypoints = await generateRouteWaypoints({ lat: startLat, lng: startLng, distanceKm: distance, cityName, settings });
        }

        // --- Iterative distance calibration via binary search ---
        // Binary search over a scale factor applied to the initial waypoints.
        // This avoids oscillation from proportional scaling on non-linear OSRM routes.
        let lowScale = 0.05;
        let highScale = 3.0;
        let bestRoute: GeneratedRoute | null = null;
        let bestDiff = Infinity;

        // First, route the initial waypoints to establish a baseline
        const initialRoute = await routeViaOSRM(initialWaypoints);
        const initialKm = initialRoute.distance / 1000;
        const initialRatio = initialKm / distance;

        console.log(`[Attempt ${attempt + 1}/${MAX_ATTEMPTS}] baseline=${initialKm.toFixed(2)}km, target=${distance}km, ratio=${initialRatio.toFixed(2)}`);

        // Track baseline as candidate
        bestDiff = Math.abs(initialRatio - 1);
        bestRoute = initialRoute;

        // If not already within tolerance, run binary search
        if (!(initialRatio >= (1 - TOLERANCE) && initialRatio <= (1 + TOLERANCE))) {
          // Determine initial bounds based on first measurement
          if (initialRatio > 1) {
            // Route is too long, we need to shrink. Current scale (1.0) is too big.
            highScale = 1.0;
            lowScale = (distance / initialKm) * 0.3; // Wider lower bound for OSRM non-linearities
          } else {
            // Route is too short, we need to expand. Current scale (1.0) is too small.
            lowScale = 1.0;
            highScale = (distance / initialKm) * 3.0; // Wider upper bound for OSRM non-linearities
          }

          for (let i = 0; i < MAX_ITERATIONS; i++) {
            const midScale = (lowScale + highScale) / 2;

            // Scale waypoints relative to the INITIAL waypoints (never scale already-scaled ones)
            const scaledWaypoints: RouteWaypoint[] = initialWaypoints.map((wp, idx) => {
              if (idx === 0 || idx === initialWaypoints.length - 1) return wp;
              return {
                lat: startLat + (wp.lat - startLat) * midScale,
                lng: startLng + (wp.lng - startLng) * midScale,
                ...(wp.label ? { label: wp.label } : {}),
              };
            });

            const candidate = await routeViaOSRM(scaledWaypoints);
            const actualKm = candidate.distance / 1000;
            const ratio = actualKm / distance;
            const diff = Math.abs(ratio - 1);

            console.log(`[Attempt ${attempt + 1} iter ${i + 1}] scale=${midScale.toFixed(3)}, actual=${actualKm.toFixed(2)}km, target=${distance}km`);

            if (diff < bestDiff) {
              bestDiff = diff;
              bestRoute = candidate;
            }

            // Within tolerance? Done with this attempt!
            if (ratio >= (1 - TOLERANCE) && ratio <= (1 + TOLERANCE)) {
              break;
            }

            // Binary search: adjust bounds
            if (actualKm > distance) {
              highScale = midScale; // Too long, shrink upper bound
            } else {
              lowScale = midScale; // Too short, expand lower bound
            }
          }
        }

        // Update overall best across all attempts
        if (bestDiff < overallBestDiff) {
          overallBestDiff = bestDiff;
          overallBestRoute = bestRoute;
        }

        // If within tolerance, no need for more attempts
        if (overallBestDiff <= TOLERANCE) {
          console.log(`[Attempt ${attempt + 1}] Within tolerance (${(overallBestDiff * 100).toFixed(1)}%), done.`);
          break;
        }

        if (attempt < MAX_ATTEMPTS - 1) {
          console.log(`[Attempt ${attempt + 1}] Best so far: ${(overallBestRoute!.distance / 1000).toFixed(1)}km (${(overallBestDiff * 100).toFixed(1)}% off), trying different waypoints...`);
        }
      }

      generatedRoute = overallBestRoute!;

      if (generatedRoute) {
        setRoute(generatedRoute);
        setView('map');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate route');
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, cityName, routeMode]);

  return (
    <main className="h-[100dvh] w-full relative overflow-hidden bg-gray-950">
      {/* Map fills entire screen */}
      <MapView
        route={route}
        userLocation={userLocation}
        heading={userHeading}
        speed={userSpeed}
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

      {/* Fake GPS indicator */}
      {fakeGPSActive && (
        <div className="absolute top-16 left-4 z-30 bg-amber-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-lg">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          Simulerad GPS: {fakeGPSLabel}
          <button
            onClick={disableFakeGPS}
            className="ml-1 text-white/70 hover:text-white"
            aria-label="Stang simulering"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Animated view panels */}
      <AnimatePresence mode="wait">
        {/* Bottom panel - Route Generator */}
        {view === 'generate' && (
          <motion.div
            key="generate"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <RouteGenerator
              onGenerate={handleGenerate}
              isLoading={isLoading}
              userLocation={userLocation}
              cityName={cityName}
              route={route}
              nearbyRoutes={nearbyRoutes}
              onDistanceChange={setSelectedDistance}
              onLoadNearby={handleLoadNearby}
              routeMode={routeMode}
              onModeChange={setRouteMode}
            />
          </motion.div>
        )}

        {/* Settings overlay */}
        {view === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <SettingsView onClose={() => setView('generate')} />
          </motion.div>
        )}

        {/* History view */}
        {view === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <RunHistoryView
              onSelectRun={(run) => setSelectedRun(run)}
              refreshKey={historyRefreshKey}
            />
          </motion.div>
        )}

        {/* Saved routes view */}
        {view === 'routes' && (
          <motion.div
            key="routes"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <SavedRoutesView
              onRunRoute={(savedRoute) => {
                setRoute(savedRoute);
                setView('map');
              }}
            />
          </motion.div>
        )}

        {/* Summary view */}
        {view === 'summary' && completedRunData && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <RunSummaryView
              completedRun={completedRunData}
              route={route}
              onSave={() => {
                setCompletedRunData(null);
                runSession.reset();
                setRoute(null);
                setView('generate');
              }}
              onDiscard={async () => {
                await dbDelete('runs', completedRunData.id);
                setCompletedRunData(null);
                runSession.reset();
                setRoute(null);
                setView('generate');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation bar */}
      <nav className="absolute top-4 right-4 z-20 flex gap-2">
        {/* Fake GPS button */}
        <div className="relative">
          <button
            onClick={() => setShowFakeMenu((v) => !v)}
            className={`rounded-full px-3 py-2 shadow-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              fakeGPSActive
                ? 'bg-amber-500 text-white active:bg-amber-600'
                : 'bg-white/90 text-gray-700 active:bg-gray-100'
            }`}
            aria-label="Fake GPS"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {fakeGPSActive ? fakeGPSLabel : 'Simulera position'}
          </button>
          {showFakeMenu && (
            <div className="absolute right-0 top-full mt-1 bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden min-w-[160px]">
              {FAKE_CITIES.map((city) => (
                <button
                  key={city.name}
                  onClick={() => applyFakeGPS(city)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors ${
                    fakeGPSLabel === city.name ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {city.name}
                </button>
              ))}
              <button
                onClick={disableFakeGPS}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 border-t border-white/10 transition-colors"
              >
                Avaktivera
              </button>
            </div>
          )}
        </div>
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
      </nav>

      {/* Navigation overlay */}
      {view === 'navigate' && route && (
        <NavigationView
          route={route}
          userLocation={userLocation}
          onStop={() => { runSession.reset(); setView('map'); }}
          runStatus={runSession.status}
          elapsedMs={runSession.elapsedMs}
          distanceMeters={runSession.distanceMeters}
          trace={runSession.trace}
          onPause={() => runSession.pauseRun()}
          onResume={() => runSession.resumeRun()}
          onEndRun={() => setShowEndRunDialog(true)}
        />
      )}

      {/* End Run confirmation dialog */}
      <AnimatePresence>
        {showEndRunDialog && (
          <EndRunDialog
            onConfirm={async () => {
              const completed = await runSession.endRun();
              setCompletedRunData(completed);
              setShowEndRunDialog(false);
              setView('summary');
            }}
            onCancel={() => setShowEndRunDialog(false)}
          />
        )}
      </AnimatePresence>

      {/* Crash recovery dialog */}
      <AnimatePresence>
        {recoverySnapshot && (
          <CrashRecoveryDialog
            snapshot={recoverySnapshot}
            onResume={() => {
              runSession.recoverRun(recoverySnapshot);
              setRecoverySnapshot(null);
              setView('navigate');
            }}
            onDiscard={async () => {
              await clearIncompleteRun(recoverySnapshot.id);
              setRecoverySnapshot(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Run detail overlay */}
      {selectedRun && (
        <RunDetailOverlay
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onDelete={(id) => {
            setSelectedRun(null);
            setHistoryRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Route info bar */}
      {route && view === 'map' && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm rounded-t-2xl p-4 z-20 safe-bottom"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-white">
                {(route.distance / 1000).toFixed(1)} km
              </span>
              <span className="text-gray-400 ml-3">
                ~{Math.round(route.duration / 60)} min
              </span>
            </div>
            <button
              onClick={() => { unlockIOSAudio(); runSession.startRun(null); setView('navigate'); }}
              className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold active:bg-green-600"
            >
              Start Run
            </button>
          </div>
          <button
            onClick={() => { setRoute(null); setView('generate'); }}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white/80 rounded-xl py-3 text-sm font-medium transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Ny rutt
          </button>
        </motion.div>
      )}

      {/* Tab bar - visible on generate, history, routes, map */}
      {(view === 'generate' || view === 'history' || view === 'routes' || view === 'map') && (
        <TabBar
          activeTab={view === 'map' ? 'generate' : (view as 'generate' | 'history' | 'routes')}
          onTabChange={(tab: 'generate' | 'history' | 'routes') => setView(tab)}
        />
      )}
    </main>
  );
}
