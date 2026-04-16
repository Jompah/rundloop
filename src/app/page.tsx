'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import type maplibregl from 'maplibre-gl';
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
import LandmarkPanel from '@/components/LandmarkPanel';
import { GeneratedRoute, AppView, RouteMode, ScenicMode, RouteWaypoint, ActiveRunSnapshot, CompletedRun } from '@/types';
import { getCurrentPosition, reverseGeocode, watchFilteredPosition, setFakePosition, clearFakePosition, isFakeGPS, geoErrorMessage } from '@/lib/geolocation';
import { fetchLandmarksNearRoute } from '@/lib/overpass';
import { initDB, dbDelete, dbPut, dbGet } from '@/lib/db';
import { generateRouteWaypoints, generateRouteAlgorithmic, NaturePOI } from '@/lib/route-ai';
import { routeViaOSRM } from '@/lib/route-osrm';
import { routeViaGoogle } from '@/lib/route-google';
import { analyzeStreetDuplication, shouldRejectRoute } from '@/lib/street-dedup';
import { assessRouteQuality, hasExcessiveShortSegments, detectDeadEndDetours } from '@/lib/route-quality';
import { findNearbySavedRoutes, getSettings, saveSettings, haversineMeters } from '@/lib/storage';
import { useRunSession } from '@/hooks/useRunSession';
import { useMapCentering } from '@/hooks/useMapCentering';
import { unlockIOSAudio, ensureSpeechReady } from '@/lib/voice';
import { haptic } from '@/lib/haptics';
import { Button } from '@/components/ui/Button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from '@/i18n';
import { findIncompleteRun, clearIncompleteRun } from '@/lib/crash-recovery';
import { initProviders } from '@/lib/providers/init';
import { computeRunAnalysis, saveRunAnalysis } from '@/lib/run-analysis';
import { updateRouteStats, findCandidateRoutes, promoteRunToRoute } from '@/lib/route-library';
import { buildPromptFeedback } from '@/lib/prompt-feedback';
import { PreviousRoutesDialog } from '@/components/PreviousRoutesDialog';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/hooks/useAuth';
import type { SavedRoute } from '@/lib/storage';

// Dynamic import MapView to avoid SSR issues with MapLibre
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[#0a0a0a]" />
  ),
});

const FAKE_CITIES = [
  { name: 'Stockholm (Gamla Stan)', lat: 59.3251, lng: 18.0711 },
  { name: 'Goteborg (Haga)', lat: 57.6969, lng: 11.9569 },
  { name: 'Malmo (Mollan)', lat: 55.5900, lng: 13.0038 },
  { name: 'Barcelona (Gothic Quarter)', lat: 41.3833, lng: 2.1761 },
];

export default function Home() {
  const { t } = useTranslation();
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
  const [routeMode, setRouteMode] = useState<RouteMode>('ai');
  const [scenicMode, setScenicMode] = useState<ScenicMode>('standard');
  const [recoverySnapshot, setRecoverySnapshot] = useState<ActiveRunSnapshot | null>(null);
  const [showEndRunDialog, setShowEndRunDialog] = useState(false);
  const [completedRunData, setCompletedRunData] = useState<CompletedRun | null>(null);
  const [selectedRun, setSelectedRun] = useState<CompletedRun | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [gpsError, setGpsError] = useState(false);
  const [previousRoutesDialog, setPreviousRoutesDialog] = useState<{
    candidates: SavedRoute[];
    targetKm: number;
    proceedWithBias: () => Promise<void>;
  } | null>(null);
  const [authSkipped, setAuthSkipped] = useState(false);
  const [authError, setAuthError] = useState(false);
  const { user, loading: authLoading, signInWithEmail, signOut } = useAuth();
  const showAuthModal = !authLoading && !user && !authSkipped;
  const runSession = useRunSession();
  const { state: centeringState, dispatch: centeringDispatch } = useMapCentering();
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  // Pre-GPS-lock position loading state
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [positionLoaded, setPositionLoaded] = useState(false);

  // Load stored position BEFORE map renders (runs once on mount)
  useEffect(() => {
    dbGet<{ key: string; lng: number; lat: number; timestamp: number }>('settings', 'lastPosition')
      .then((stored) => {
        if (stored && (Date.now() - stored.timestamp < 24 * 60 * 60 * 1000)) {
          setInitialCenter([stored.lng, stored.lat]);
        }
        setPositionLoaded(true);
      })
      .catch(() => setPositionLoaded(true));
  }, []);

  // Check for auth error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_error') === 'true') {
      setAuthError(true);
      setAuthSkipped(false);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Initialize IndexedDB: migration + persistent storage
  useEffect(() => {
    initDB().then(() => initProviders());
  }, []);

  // Load persisted scenic mode preference
  useEffect(() => {
    getSettings().then((s) => {
      if (s.scenicMode) setScenicMode(s.scenicMode);
    });
  }, []);

  const handleScenicModeChange = useCallback(async (mode: ScenicMode) => {
    setScenicMode(mode);
    const settings = await getSettings();
    await saveSettings({ ...settings, scenicMode: mode });
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

  // GPS watch ID ref for cleanup
  const gpsWatchIdRef = useRef<number | undefined>(undefined);
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [gpsRequesting, setGpsRequesting] = useState(false);

  // Track if GPS permission was permanently denied (retrying won't help)
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  // Address input state (manual geocoding fallback)
  const [addressInput, setAddressInput] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Request location on user gesture (iOS requires user interaction for geolocation)
  const requestLocation = useCallback(async () => {
    // Check if geolocation API is available at all
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(true);
      setGpsErrorMessage(t('gps.browserNotSupported'));
      return;
    }

    setGpsRequesting(true);
    setGpsErrorMessage(null);
    // Keep gpsError visible during retry so the banner stays (no flash)
    try {
      const pos = await getCurrentPosition();
      const loc: [number, number] = [pos.lng, pos.lat];
      setUserLocation(loc);
      setGpsError(false);
      setGpsErrorMessage(null);
      setGpsPermissionDenied(false);
      centeringDispatch({ type: 'GPS_LOCK', position: loc });

      const city = await reverseGeocode(pos.lat, pos.lng);
      setCityName(city);

      // Start watching position after successful initial lock
      if (gpsWatchIdRef.current !== undefined) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
      gpsWatchIdRef.current = watchFilteredPosition(
        (pos) => {
          setUserLocation([pos.lng, pos.lat]);
          setUserHeading(pos.heading);
          setUserSpeed(pos.speed);
          centeringDispatch({ type: 'GPS_UPDATE', position: [pos.lng, pos.lat] });
          dbPut('settings', { key: 'lastPosition', lng: pos.lng, lat: pos.lat, timestamp: Date.now() });
        },
        (_pos, _reason) => { /* rejected, ignore for location display */ },
        (err) => console.warn('GPS error:', err.message)
      );
    } catch (err: any) {
      setGpsError(true);
      if (err && typeof err.code === 'number') {
        const geoErr = err as GeolocationPositionError;
        setGpsErrorMessage(geoErrorMessage(geoErr, t as (key: string, params?: Record<string, string | number>) => string));
        // PERMISSION_DENIED (code 1): retrying won't help, user must change browser settings
        setGpsPermissionDenied(geoErr.code === 1);
      } else {
        setGpsErrorMessage(t('gps.couldNotGet'));
        setGpsPermissionDenied(false);
      }
    } finally {
      setGpsRequesting(false);
    }
  }, [centeringDispatch]);

  // Geocode an address via Nominatim and set as user location
  const handleAddressSearch = useCallback(async () => {
    const query = addressInput.trim();
    if (!query) return;

    setAddressSearching(true);
    setAddressError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'User-Agent': 'Drift/1.0' } }
      );
      const results = await res.json();
      if (!results || results.length === 0) {
        setAddressError(t('gps.addressNotFound'));
        return;
      }
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      setFakePosition(lat, lon);
      setFakeGPSActive(true);
      const displayName = results[0].display_name?.split(',').slice(0, 2).join(',') || query;
      setFakeGPSLabel(displayName);
      const loc: [number, number] = [lon, lat];
      setUserLocation(loc);
      setGpsError(false);
      setGpsErrorMessage(null);
      setGpsPermissionDenied(false);
      const city = await reverseGeocode(lat, lon);
      setCityName(city);
      setAddressInput('');
    } catch {
      setAddressError(t('gps.addressNotFound'));
    } finally {
      setAddressSearching(false);
    }
  }, [addressInput, t]);

  // Cleanup GPS watch on unmount
  useEffect(() => {
    return () => {
      if (gpsWatchIdRef.current !== undefined) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
    };
  }, []);

  const handleGenerate = useCallback(async (distance: number) => {
    if (!userLocation) return;
    setIsLoading(true);
    setError(null);
    let usedFallback = false;
    let aiErrorMessage = '';

    const MAX_ITERATIONS = 3; // Fewer iterations = faster generation with tight initial bounds
    const TOLERANCE_UNDER = 0.10; // Accept routes up to 10% shorter than target
    const TOLERANCE_OVER = 0.10;  // Accept routes up to 10% longer than target
    const MAX_ATTEMPTS = 2; // Retry with different initial waypoints to handle OSRM non-monotonicity
    const startLat = userLocation[1]; // userLocation is [lng, lat]
    const startLng = userLocation[0];

    try {
      let generatedRoute: GeneratedRoute | null = null;
      let overallBestRoute: GeneratedRoute | null = null;
      let overallBestDiff = Infinity;

      // Load settings once for pace and AI route generation
      const settings = await getSettings();
      const paceSecondsPerKm = settings.paceSecondsPerKm ?? 360;

      // Fetch nearby POIs for AI mode (before route generation)
      let naturePOIs: NaturePOI[] = [];
      if (routeMode === 'ai') {
        try {
          const poiRes = await fetch(`/api/pois?lat=${startLat}&lng=${startLng}&radius=${Math.round(distance * 250)}`);
          if (poiRes.ok) {
            const poiData = await poiRes.json();
            naturePOIs = (poiData.pois || []).slice(0, 8); // Max 8 POIs
          }
        } catch (e) {
          console.warn('POI fetch failed, using AI-only routing:', e);
        }
      }

      // Fetch island outline for geographic context
      let islandData: { name: string; perimeterKm: number; outline: { lat: number; lng: number }[] } | null = null;
      if (routeMode === 'ai') {
        try {
          const islandRes = await fetch(`/api/island-outline?lat=${startLat}&lng=${startLng}`);
          if (islandRes.ok) {
            const data = await islandRes.json();
            islandData = data.island || null;
            if (islandData) {
              console.log(`[route] Island detected: ${islandData.name} (${islandData.perimeterKm.toFixed(1)}km perimeter)`);
            }
          }
        } catch (e) {
          console.warn('Island detection failed:', e);
        }
      }

      // Check for candidate routes from library
      let candidates: SavedRoute[] = [];
      try {
        candidates = await findCandidateRoutes(startLat, startLng, distance);
      } catch (err) {
        console.warn('[RouteGen] Candidate search failed:', err);
      }

      const runAiGeneration = async (pastRoutes: SavedRoute[]) => {

      // Build feedback context for AI
      let feedbackContext = '';
      try {
        feedbackContext = await buildPromptFeedback(startLat, startLng);
        if (feedbackContext) {
          console.log('[RouteGen] Including historical feedback in prompt');
        }
      } catch (err) {
        console.warn('[RouteGen] Feedback build failed:', err);
      }

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Generate initial waypoints (different each time due to random rotation / AI variance)
        let initialWaypoints: RouteWaypoint[];
        if (routeMode === 'algorithmic') {
          initialWaypoints = await generateRouteAlgorithmic(startLat, startLng, distance);
        } else {
          try {
            initialWaypoints = await generateRouteWaypoints({ lat: startLat, lng: startLng, distanceKm: distance, cityName, settings, scenicMode, poiWaypoints: naturePOIs.length > 0 ? naturePOIs : undefined, island: islandData, feedbackContext, pastRoutes });
          } catch (aiError: any) {
            console.warn('AI route generation failed, using algorithmic fallback:', aiError);
            aiErrorMessage = aiError?.message || 'unknown error';
            initialWaypoints = await generateRouteAlgorithmic(startLat, startLng, distance);
            usedFallback = true;
          }
        }

        // Snap waypoints to 4 decimal places (~11m precision).
        // This prevents waypoints landing in the middle of residential blocks
        // where OSRM must detour through side streets to reach them.
        initialWaypoints = initialWaypoints.map((wp) => ({
          ...wp,
          lat: Math.round(wp.lat * 10000) / 10000,
          lng: Math.round(wp.lng * 10000) / 10000,
        }));

        // Check asymmetric tolerance: accept -15% to +10%
        const isWithinTolerance = (ratio: number) =>
          ratio >= (1 - TOLERANCE_UNDER) && ratio <= (1 + TOLERANCE_OVER);

        let bestRoute: GeneratedRoute | null = null;
        let bestDiff = Infinity;

        if (routeMode === 'algorithmic') {
          // --- Iterative distance calibration via binary search (algorithmic only) ---
          // Binary search over a scale factor applied to the initial waypoints.
          // This avoids oscillation from proportional scaling on non-linear OSRM routes.
          let lowScale = 0.05;
          let highScale = 3.0;

          // First, route the initial waypoints to establish a baseline
          let initialRoute;
          try {
            initialRoute = await routeViaGoogle(initialWaypoints, paceSecondsPerKm);
            console.log(`[RouteGen] Google Routes: ${(initialRoute.distance / 1000).toFixed(1)}km`);
          } catch (googleErr) {
            console.warn('[RouteGen] Google Routes failed, falling back to OSRM:', googleErr);
            initialRoute = await routeViaOSRM(initialWaypoints, paceSecondsPerKm);
            console.log(`[RouteGen] OSRM fallback: ${(initialRoute.distance / 1000).toFixed(1)}km`);
          }
          const initialKm = initialRoute.distance / 1000;
          const initialRatio = initialKm / distance;

          console.log(`[Attempt ${attempt + 1}/${MAX_ATTEMPTS}] baseline=${initialKm.toFixed(2)}km, target=${distance}km, ratio=${initialRatio.toFixed(2)}`);

          // Track baseline as candidate (quality-adjusted diff)
          const initialQuality = assessRouteQuality(initialRoute);
          const initialSmooth = !hasExcessiveShortSegments(initialRoute.polyline);
          // Penalize detour-heavy routes: add up to 0.30 to the diff for low-quality routes
          bestDiff = Math.abs(initialRatio - 1) + (initialSmooth ? 0 : 0.30);
          bestRoute = initialRoute;

          console.log(`[Attempt ${attempt + 1}] Kvalitet: ${initialQuality}/100, smooth=${initialSmooth}`);

          // If not already within tolerance, run binary search
          if (!isWithinTolerance(initialRatio)) {
            // Determine initial bounds based on first measurement -- tight bounds from actual ratio
            const targetRatio = distance / initialKm; // scale factor needed to hit target
            if (initialRatio > 1) {
              // Route is too long, we need to shrink. Search between 0.5 and just below current.
              lowScale = 0.5;
              highScale = targetRatio * 0.95;
            } else {
              // Route is too short, we need to expand. Search from just above current to 2x needed.
              lowScale = targetRatio * 1.05;
              highScale = targetRatio * 2.0;
            }

            for (let i = 0; i < MAX_ITERATIONS; i++) {
              const midScale = (lowScale + highScale) / 2;

              // Scale waypoints relative to the INITIAL waypoints (never scale already-scaled ones)
              const scaledWaypoints: RouteWaypoint[] = initialWaypoints.map((wp, idx) => {
                if (idx === 0 || idx === initialWaypoints.length - 1) return wp;
                return {
                  lat: Math.round((startLat + (wp.lat - startLat) * midScale) * 10000) / 10000,
                  lng: Math.round((startLng + (wp.lng - startLng) * midScale) * 10000) / 10000,
                  ...(wp.label ? { label: wp.label } : {}),
                };
              });

              let candidate;
              try {
                candidate = await routeViaGoogle(scaledWaypoints, paceSecondsPerKm);
                console.log(`[RouteGen] Google Routes: ${(candidate.distance / 1000).toFixed(1)}km`);
              } catch (googleErr) {
                console.warn('[RouteGen] Google Routes failed, falling back to OSRM:', googleErr);
                candidate = await routeViaOSRM(scaledWaypoints, paceSecondsPerKm);
                console.log(`[RouteGen] OSRM fallback: ${(candidate.distance / 1000).toFixed(1)}km`);
              }
              const actualKm = candidate.distance / 1000;
              const ratio = actualKm / distance;
              const rawDiff = Math.abs(ratio - 1);

              // Route smoothness check: penalize routes with excessive short segments
              const isSmooth = !hasExcessiveShortSegments(candidate.polyline);
              const qualityPenalty = isSmooth ? 0 : 0.30;
              const adjustedDiff = rawDiff + qualityPenalty;

              const quality = assessRouteQuality(candidate);
              console.log(`[Attempt ${attempt + 1} iter ${i + 1}] scale=${midScale.toFixed(3)}, actual=${actualKm.toFixed(2)}km, target=${distance}km, kvalitet=${quality}/100, smooth=${isSmooth}`);

              if (adjustedDiff < bestDiff) {
                bestDiff = adjustedDiff;
                bestRoute = candidate;
              }

              // Within asymmetric tolerance? Done with this attempt!
              if (isWithinTolerance(ratio) && isSmooth) {
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
        } else {
          // --- AI mode: single OSRM call, no scaling ---
          // AI already knows the target distance and places waypoints with geographic
          // intelligence (perimeter loops, waterfront paths, etc.). Scaling toward
          // the center would destroy these carefully placed routes.
          let aiRoute;
          try {
            aiRoute = await routeViaGoogle(initialWaypoints, paceSecondsPerKm);
            console.log(`[RouteGen] Google Routes: ${(aiRoute.distance / 1000).toFixed(1)}km`);
          } catch (googleErr) {
            console.warn('[RouteGen] Google Routes failed, falling back to OSRM:', googleErr);
            aiRoute = await routeViaOSRM(initialWaypoints, paceSecondsPerKm);
            console.log(`[RouteGen] OSRM fallback: ${(aiRoute.distance / 1000).toFixed(1)}km`);
          }
          const aiKm = aiRoute.distance / 1000;
          const aiRatio = aiKm / distance;
          const aiQuality = assessRouteQuality(aiRoute);
          const aiSmooth = !hasExcessiveShortSegments(aiRoute.polyline);

          console.log(`[AI mode, attempt ${attempt + 1}] route=${aiKm.toFixed(2)}km, target=${distance}km, ratio=${aiRatio.toFixed(2)}, kvalitet=${aiQuality}/100, smooth=${aiSmooth}`);

          // Distance validation: if way off target, retry with fresh waypoints
          if ((aiKm > distance * 1.1 || aiKm < distance * 0.9) && attempt < MAX_ATTEMPTS - 1) {
            console.warn(`[RouteGen] AI route ${aiKm.toFixed(1)}km too far from ${distance}km target, retrying...`);
            continue;
          }

          bestRoute = aiRoute;
          bestDiff = Math.abs(aiRatio - 1) + (aiSmooth ? 0 : 0.30);
        }

        // Always track the best route from this attempt as a fallback,
        // even if quality filters reject it. This prevents returning nothing
        // when all attempts are rejected by quality filters.
        if (bestRoute && bestDiff < overallBestDiff) {
          overallBestDiff = bestDiff;
          overallBestRoute = bestRoute;
        }

        // Early exit: if first attempt produced a good route, skip remaining attempts
        if (attempt === 0 && bestRoute) {
          const earlyRatio = bestRoute.distance / 1000 / distance;
          const earlyQuality = assessRouteQuality(bestRoute);
          if (isWithinTolerance(earlyRatio) && earlyQuality > 60) {
            console.log(`[Attempt 1] Early exit: within tolerance (${((earlyRatio - 1) * 100).toFixed(1)}%) and quality ${earlyQuality}/100 > 60`);
            break;
          }
        }

        // Post-processing: detect dead-end detours
        if (bestRoute) {
          const detours = detectDeadEndDetours(bestRoute.instructions);
          console.log(`[Attempt ${attempt + 1}] Dead-end detours: ${detours.length}${detours.length > 0 ? ` (${detours.map(d => d.streetName).join(', ')})` : ''}`);
          if (detours.length > 0 && attempt < MAX_ATTEMPTS - 1) {
            console.log(`[Attempt ${attempt + 1}] Detected ${detours.length} dead-end detour(s), trying different waypoints...`);
            continue; // Skip to next attempt
          }
        }

        // Street deduplication: log but don't reject (backtracking along scenic paths is acceptable)
        if (bestRoute) {
          const dupAnalysis = analyzeStreetDuplication(bestRoute.instructions)
          if (shouldRejectRoute(dupAnalysis)) {
            console.log(`[Attempt ${attempt + 1}] ${(dupAnalysis.duplicationRate * 100).toFixed(0)}% duplicate streets (${dupAnalysis.nonConsecutiveDuplicates.join(', ')}), accepting anyway`)
          }
        }

        // If within tolerance (using raw distance diff from overall best), no need for more attempts
        if (overallBestRoute) {
          const overallRatio = overallBestRoute.distance / 1000 / distance;
          if (isWithinTolerance(overallRatio)) {
            console.log(`[Attempt ${attempt + 1}] Inom tolerans (${((overallRatio - 1) * 100).toFixed(1)}%), klar.`);
            break;
          }
        }

        if (attempt < MAX_ATTEMPTS - 1 && overallBestRoute) {
          console.log(`[Attempt ${attempt + 1}] Best so far: ${(overallBestRoute.distance / 1000).toFixed(1)}km (${(overallBestDiff * 100).toFixed(1)}% off), trying different waypoints...`);
        }
      }

      generatedRoute = overallBestRoute ?? null;

      if (!generatedRoute) {
        setError(t('route.generationFailed'));
        return;
      }

      if (generatedRoute) {
        // Fetch nearby landmarks (non-blocking -- route works without them)
        try {
          const landmarks = await fetchLandmarksNearRoute(generatedRoute.polyline);
          generatedRoute.landmarks = landmarks;
        } catch (e) {
          console.warn('Landmark fetch failed:', e);
        }

        // Compute walk-to-start segment if route start differs from GPS
        if (generatedRoute.polyline.length > 0) {
          const routeStart = generatedRoute.polyline[0]; // [lng, lat]
          const gpsLng = startLng;
          const gpsLat = startLat;
          const distToRouteStart = haversineMeters(gpsLat, gpsLng, routeStart[1], routeStart[0]);

          if (distToRouteStart > 10 && distToRouteStart <= 300) {
            // Route start is 10-300m from GPS - show walk segment
            generatedRoute.walkToStart = [
              [gpsLng, gpsLat],
              routeStart,
            ];
          } else if (distToRouteStart > 300) {
            // Route start beyond 300m - clamp by showing walk segment anyway
            console.warn(`Route start ${distToRouteStart.toFixed(0)}m from GPS, clamping`);
            generatedRoute.walkToStart = [
              [gpsLng, gpsLat],
              routeStart,
            ];
          }
        }

        setRoute(generatedRoute);
        if (usedFallback) {
          setError(`AI route failed: ${aiErrorMessage || 'unknown error'}. Using simple route.`);
        }
        setView('map');
      }
      }; // end runAiGeneration

      if (candidates.length === 0) {
        await runAiGeneration([]);
      } else {
        setIsLoading(false);
        setPreviousRoutesDialog({
          candidates,
          targetKm: distance,
          proceedWithBias: async () => {
            setPreviousRoutesDialog(null);
            setIsLoading(true);
            await runAiGeneration(candidates);
          },
        });
        return;
      }
    } catch (err: any) {
      console.error('Route generation error:', err);
      const msg = err?.message || '';
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError(t('route.networkError'));
      } else {
        setError(msg || t('route.generationFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, cityName, routeMode, scenicMode, t]);

  return (
    <main className="h-[100dvh] w-full max-w-[480px] mx-auto relative overflow-hidden bg-gray-950">
      {/* Map fills entire screen */}
      <MapView
        route={route}
        userLocation={userLocation}
        heading={userHeading}
        speed={userSpeed}
        isNavigating={view === 'navigate'}
        initialCenter={initialCenter}
        positionLoaded={positionLoaded}
        centeringMode={centeringState.mode}
        onPan={() => centeringDispatch({ type: 'USER_PAN' })}
        onRecenter={() => centeringDispatch({ type: 'RECENTER' })}
        onMapReady={(map) => { mapInstanceRef.current = map; }}
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
          {t('gps.simulatedGps', { label: fakeGPSLabel })}
          <button
            onClick={disableFakeGPS}
            className="ml-1 text-white/70 hover:text-white"
            aria-label={t('gps.closeSimulation')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* GPS permission error banner */}
      {gpsError && !fakeGPSActive && (
        <div className="absolute top-16 left-4 right-4 z-30 bg-red-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-xl text-sm shadow-lg">
          <div className="font-medium mb-1">{t('gps.positionMissing')}</div>
          <div className="text-white/90 text-xs mb-3">
            {gpsErrorMessage || t('gps.defaultError')}
          </div>
          {gpsPermissionDenied && (
            <div className="text-white/80 text-xs mb-3 bg-white/10 rounded-lg px-3 py-2 space-y-2">
              <div className="font-medium">{t('gps.permissionDeniedDetail')}</div>
              <ul className="list-disc list-inside space-y-1 text-white/70">
                <li>{t('gps.permissionGuide.iosSafari')}</li>
                <li>{t('gps.permissionGuide.iosChrome')}</li>
                <li>{t('gps.permissionGuide.androidChrome')}</li>
                <li>{t('gps.permissionGuide.desktopChrome')}</li>
              </ul>
              <div className="text-white/60 italic">{t('gps.permissionGuide.or')}</div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={requestLocation}
              disabled={gpsRequesting}
              className="bg-white/20 px-3 py-1.5 rounded-lg text-xs font-medium active:bg-white/30 disabled:opacity-50 flex items-center gap-1.5"
            >
              {gpsRequesting ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('gps.searching')}
                </>
              ) : (
                t('gps.retry')
              )}
            </button>
            <button
              onClick={() => {
                setGpsError(false);
                setGpsErrorMessage(null);
                setGpsPermissionDenied(false);
                applyFakeGPS(FAKE_CITIES[0]);
              }}
              className="bg-white/20 px-3 py-1.5 rounded-lg text-xs font-medium active:bg-white/30"
            >
              {t('gps.simulatePositionShort')}
            </button>
          </div>
          {/* Compact address input in error banner */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            <span className="text-white/50 text-xs whitespace-nowrap">{t('gps.orEnterAddress')}:</span>
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddressSearch(); }}
              className="flex gap-1.5 flex-1"
            >
              <input
                type="text"
                value={addressInput}
                onChange={(e) => { setAddressInput(e.target.value); setAddressError(null); }}
                placeholder={t('gps.addressPlaceholder')}
                className="flex-1 bg-white/10 text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:border-white/30 focus:outline-none placeholder-white/30 min-w-0"
              />
              <button
                type="submit"
                disabled={addressSearching || !addressInput.trim()}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-600/50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                {addressSearching ? t('gps.addressSearching') : t('gps.addressGo')}
              </button>
            </form>
          </div>
          {addressError && (
            <p className="text-red-300 text-xs mt-1.5">{addressError}</p>
          )}
        </div>
      )}

      {/* Hitta min position - prominent button when location is unknown and no error shown */}
      {!userLocation && !gpsError && !gpsRequesting && !fakeGPSActive && view === 'generate' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6 pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl pointer-events-auto">
            <div className="mb-4 flex justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-bold mb-2">{t('gps.whereAreYou')}</h2>
            <p className="text-gray-400 text-sm mb-6">
              {t('gps.needPosition')}
            </p>
            <button
              onClick={requestLocation}
              disabled={gpsRequesting}
              className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-blue-500/50 text-white font-semibold text-lg py-4 px-6 rounded-xl transition-colors shadow-lg shadow-blue-500/25"
            >
              {gpsRequesting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('gps.searchingPosition')}
                </span>
              ) : (
                t('gps.findPosition')
              )}
            </button>
            <button
              onClick={() => setShowFakeMenu(true)}
              className="mt-3 w-full text-gray-400 hover:text-gray-300 text-sm py-2 transition-colors"
            >
              {t('gps.simulatePosition')}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-4 mb-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-gray-500 text-xs">{t('gps.orEnterAddress')}</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Address input */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddressSearch(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={addressInput}
                onChange={(e) => { setAddressInput(e.target.value); setAddressError(null); }}
                placeholder={t('gps.addressPlaceholder')}
                className="flex-1 bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={addressSearching || !addressInput.trim()}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-600/50 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
              >
                {addressSearching ? t('gps.addressSearching') : t('gps.addressGo')}
              </button>
            </form>
            {addressError && (
              <p className="text-red-400 text-xs mt-2">{addressError}</p>
            )}
          </div>
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
              scenicMode={scenicMode}
              onScenicModeChange={handleScenicModeChange}
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
            className="absolute inset-0 z-10 bg-gray-950"
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
            className="absolute inset-0 z-10 bg-gray-950"
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
      <nav className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setView('settings')}
          className="bg-gray-800/80 backdrop-blur-sm rounded-full p-3 shadow-lg active:bg-gray-700 text-gray-300"
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
          onStop={() => { centeringDispatch({ type: 'STOP_NAVIGATION' }); runSession.reset(); setView('map'); }}
          runStatus={runSession.status}
          elapsedMs={runSession.elapsedMs}
          distanceMeters={runSession.distanceMeters}
          trace={runSession.trace}
          onPause={() => runSession.pauseRun()}
          onResume={() => runSession.resumeRun()}
          onEndRun={() => setShowEndRunDialog(true)}
          landmarks={route.landmarks}
        />
      )}

      {/* End Run confirmation dialog */}
      <AnimatePresence>
        {showEndRunDialog && (
          <EndRunDialog
            onConfirm={async () => {
              const completed = await runSession.endRun();
              // Promote free runs (no planned route) to saved routes
              if (completed.routeId == null && completed.trace && completed.trace.length >= 10 && completed.distanceMeters >= 500) {
                try {
                  const promoted = await promoteRunToRoute(completed, cityName || 'Unknown');
                  completed.routeId = promoted.id;
                  completed.routePolyline = promoted.route.polyline;
                } catch (err) {
                  console.warn('[end-run] promoteRunToRoute failed', err);
                }
              }
              // Attach planned route polyline for history detail view
              if (route?.polyline) {
                completed.routePolyline = route.polyline;
                // Re-save with polyline attached
                await dbPut('runs', completed);
              }

              // Implicit feedback: analyze run quality
              try {
                const analysis = computeRunAnalysis(completed);
                if (analysis) {
                  await saveRunAnalysis(analysis);
                  // Update CompletedRun with analysisId
                  completed.analysisId = analysis.id;
                  await dbPut('runs', completed);
                  // Update route stats if route was used
                  if (completed.routeId) {
                    await updateRouteStats(completed.routeId, analysis);
                  }
                  console.log(`[Feedback] Run analyzed: ${analysis.adherence.toFixed(0)}% adherence, ${(analysis.completion * 100).toFixed(0)}% completion`);
                }
              } catch (err) {
                console.warn('[Feedback] Analysis failed (non-blocking):', err);
              }

              setCompletedRunData(completed);
              setShowEndRunDialog(false);
              centeringDispatch({ type: 'STOP_NAVIGATION' });
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

      {previousRoutesDialog && (
        <PreviousRoutesDialog
          open={true}
          candidates={previousRoutesDialog.candidates}
          targetKm={previousRoutesDialog.targetKm}
          onSelectRoute={(selected) => {
            setPreviousRoutesDialog(null);
            setRoute(selected.route);
            setView('map');
          }}
          onGenerateSimilar={() => previousRoutesDialog.proceedWithBias()}
          onClose={() => setPreviousRoutesDialog(null)}
        />
      )}

      {(showAuthModal || authError) && (
        <AuthModal
          onSignIn={signInWithEmail}
          onSkip={() => { setAuthSkipped(true); setAuthError(false); }}
          authError={authError}
        />
      )}

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
          className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-gray-900/95 backdrop-blur-sm rounded-t-2xl p-4 z-20 max-h-[60vh] overflow-y-auto"
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
            <Button
              variant="primary"
              size="lg"
              onClick={() => { haptic('success'); unlockIOSAudio(); runSession.startRun(null); centeringDispatch({ type: 'START_NAVIGATION' }); setView('navigate'); }}
            >
              {t('route.startRun')}
            </Button>
          </div>
          {route.landmarks && route.landmarks.length > 0 && (
            <LandmarkPanel
              landmarks={route.landmarks}
              onLandmarkClick={(lm) => {
                mapInstanceRef.current?.flyTo({ center: [lm.lng, lm.lat], zoom: 16, duration: 800 });
              }}
            />
          )}
          <Button
            variant="secondary"
            fullWidth
            className="mt-3 flex items-center justify-center gap-2"
            onClick={() => { setRoute(null); setView('generate'); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            {t('route.newRoute')}
          </Button>
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
