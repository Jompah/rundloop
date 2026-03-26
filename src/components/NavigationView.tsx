'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GeneratedRoute, TurnInstruction, FilteredPosition, AppSettings, Landmark } from '@/types';
import { speak, stopSpeaking } from '@/lib/voice';
import { haptic } from '@/lib/haptics';
import { getSettings } from '@/lib/storage';
import { formatElapsed, computeAveragePace, formatPace } from '@/lib/metrics';
import { detectMilestone, formatMilestoneMessage } from '@/lib/milestones';
import { distanceToRoute, findNearestSegmentIndex, getCompassDirection } from '@/lib/navigation';
import RunMetricsOverlay from './RunMetricsOverlay';
import OffRouteBanner from './OffRouteBanner';
import { useTranslation } from '@/i18n';

const LANDMARK_ICONS: Record<string, string> = {
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

type RunStatus = 'idle' | 'active' | 'paused' | 'completed';

interface NavigationViewProps {
  route: GeneratedRoute;
  userLocation: [number, number] | null; // [lng, lat]
  onStop: () => void;
  runStatus: RunStatus;
  elapsedMs: number;
  distanceMeters: number;
  trace: FilteredPosition[];
  onPause: () => void;
  onResume: () => void;
  onEndRun: () => void;
  landmarks?: Landmark[];
}

function getDistanceBetween(
  loc1: [number, number],
  loc2: [number, number]
): number {
  // Haversine formula - returns meters
  const R = 6371000;
  const dLat = ((loc2[1] - loc1[1]) * Math.PI) / 180;
  const dLng = ((loc2[0] - loc1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1[1] * Math.PI) / 180) *
    Math.cos((loc2[1] * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(meters: number): string {
  if (meters < 100) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function getDirectionIcon(type: TurnInstruction['type']): string {
  switch (type) {
    case 'turn-left': return '\u2B05';
    case 'turn-right': return '\u27A1';
    case 'u-turn': return '\u21A9';
    case 'arrive': return '\uD83C\uDFC1';
    case 'depart': return '\uD83C\uDFC3';
    default: return '\u2B06';
  }
}

export default function NavigationView({ route, userLocation, onStop, runStatus, elapsedMs, distanceMeters, trace, onPause, onResume, onEndRun, landmarks }: NavigationViewProps) {
  const { t } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [totalCovered, setTotalCovered] = useState(0);
  const [lastSpokenStep, setLastSpokenStep] = useState(-1);
  const [settings, setSettings] = useState<AppSettings>({ voiceEnabled: false, voiceStyle: 'concise', units: 'km', defaultDistance: 5, paceSecondsPerKm: 360, scenicMode: 'standard' });
  useEffect(() => { getSettings().then(setSettings); }, []);

  // Milestone tracking refs
  const announcedMilestonesRef = useRef(new Set<string>());
  const prevDistanceRef = useRef(0);

  // Off-route detection state
  const [offRoute, setOffRoute] = useState(false);
  const [offRouteDirection, setOffRouteDirection] = useState('');
  const offRouteAnnouncedRef = useRef(false);
  const offRouteRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Landmark proximity notification state
  const [nearbyLandmark, setNearbyLandmark] = useState<Landmark | null>(null);
  const shownLandmarkIdsRef = useRef(new Set<number>());
  const landmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = route.instructions[currentStepIndex];
  const nextStep = route.instructions[currentStepIndex + 1];

  // Update navigation based on user position
  useEffect(() => {
    if (!userLocation || !currentStep) return;

    const distToCurrentManeuver = getDistanceBetween(
      userLocation,
      currentStep.location
    );

    setDistanceToNext(distToCurrentManeuver);

    // If within 25m of current maneuver point, advance to next step
    if (distToCurrentManeuver < 25 && currentStepIndex < route.instructions.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }

    // Calculate total distance covered (rough estimate)
    if (route.polyline.length > 0) {
      const startPoint = route.polyline[0];
      const distFromStart = getDistanceBetween(userLocation, startPoint as [number, number]);
      // This is a rough approximation
      setTotalCovered(Math.min(distFromStart, route.distance));
    }
  }, [userLocation, currentStepIndex, currentStep, route]);

  // Speak instructions
  useEffect(() => {
    if (!currentStep || currentStepIndex === lastSpokenStep) return;

    speak(currentStep.text, settings.voiceEnabled);
    setLastSpokenStep(currentStepIndex);

    // Vibrate on step change
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  }, [currentStepIndex, currentStep, lastSpokenStep, settings.voiceEnabled]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // Stop voice on pause
  useEffect(() => {
    if (runStatus === 'paused') {
      stopSpeaking();
    }
  }, [runStatus]);

  // Milestone voice announcements
  useEffect(() => {
    if (runStatus !== 'active' || distanceMeters <= 0) return;

    const milestone = detectMilestone(
      prevDistanceRef.current,
      distanceMeters,
      route.distance,
      settings.units,
      announcedMilestonesRef.current
    );

    prevDistanceRef.current = distanceMeters;

    if (milestone) {
      const avgPace = computeAveragePace(distanceMeters, elapsedMs);
      const avgPaceFormatted = formatPace(avgPace, settings.units);
      const voiceStyle = settings.voiceStyle || 'concise';
      const message = formatMilestoneMessage(milestone, voiceStyle, settings.units, avgPaceFormatted);
      speak(message, settings.voiceEnabled);
      haptic('milestone');
    }
  }, [distanceMeters, runStatus, settings.voiceEnabled, settings.voiceStyle, settings.units, elapsedMs, route.distance]);

  // Reset milestones when run resets to idle
  useEffect(() => {
    if (runStatus === 'idle') {
      announcedMilestonesRef.current = new Set();
      prevDistanceRef.current = 0;
    }
  }, [runStatus]);

  // Off-route detection
  useEffect(() => {
    if (!userLocation || runStatus !== 'active') {
      setOffRoute(false);
      offRouteAnnouncedRef.current = false;
      if (offRouteRepeatRef.current) {
        clearInterval(offRouteRepeatRef.current);
        offRouteRepeatRef.current = null;
      }
      return;
    }

    // userLocation is [lng, lat]; navigation functions expect (lat, lng)
    const lat = userLocation[1];
    const lng = userLocation[0];
    const dist = distanceToRoute(lat, lng, route.polyline);

    if (dist > 50 && !offRouteAnnouncedRef.current) {
      const nearestIdx = findNearestSegmentIndex(lat, lng, route.polyline);
      const [targetLng, targetLat] = route.polyline[nearestIdx];
      const direction = getCompassDirection(lat, lng, targetLat, targetLng);

      setOffRoute(true);
      setOffRouteDirection(direction);
      offRouteAnnouncedRef.current = true;

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      // Voice announcement (respects NAV-04 mute toggle)
      speak(t('nav.offRouteVoice', { direction }), settings.voiceEnabled);

      // Repeat every 30 seconds
      offRouteRepeatRef.current = setInterval(() => {
        speak(t('nav.offRouteVoice', { direction }), settings.voiceEnabled);
      }, 30000);
    } else if (dist <= 50 && offRouteAnnouncedRef.current) {
      setOffRoute(false);
      offRouteAnnouncedRef.current = false;

      if (offRouteRepeatRef.current) {
        clearInterval(offRouteRepeatRef.current);
        offRouteRepeatRef.current = null;
      }

      // Back on route announcement (respects NAV-04 mute toggle)
      speak(t('nav.backOnRoute'), settings.voiceEnabled);
    }

    return () => {
      if (offRouteRepeatRef.current) {
        clearInterval(offRouteRepeatRef.current);
        offRouteRepeatRef.current = null;
      }
    };
  }, [userLocation, runStatus, settings.voiceEnabled, route.polyline]);

  // Landmark proximity detection
  useEffect(() => {
    if (!userLocation || !landmarks || landmarks.length === 0 || runStatus !== 'active') return;

    const PROXIMITY_THRESHOLD = 100; // meters

    for (const lm of landmarks) {
      if (shownLandmarkIdsRef.current.has(lm.id)) continue;

      const dist = getDistanceBetween(userLocation, [lm.lng, lm.lat]);
      if (dist <= PROXIMITY_THRESHOLD) {
        shownLandmarkIdsRef.current.add(lm.id);
        setNearbyLandmark(lm);

        // Auto-dismiss after 5 seconds
        if (landmarkTimerRef.current) clearTimeout(landmarkTimerRef.current);
        landmarkTimerRef.current = setTimeout(() => {
          setNearbyLandmark(null);
          landmarkTimerRef.current = null;
        }, 5000);

        break; // Show one at a time
      }
    }
  }, [userLocation, landmarks, runStatus]);

  // Reset landmark tracking when run resets
  useEffect(() => {
    if (runStatus === 'idle') {
      shownLandmarkIdsRef.current = new Set();
      setNearbyLandmark(null);
      if (landmarkTimerRef.current) {
        clearTimeout(landmarkTimerRef.current);
        landmarkTimerRef.current = null;
      }
    }
  }, [runStatus]);

  // Cleanup landmark timer on unmount
  useEffect(() => {
    return () => {
      if (landmarkTimerRef.current) {
        clearTimeout(landmarkTimerRef.current);
        landmarkTimerRef.current = null;
      }
    };
  }, []);

  const progress = route.distance > 0 ? Math.min((totalCovered / route.distance) * 100, 100) : 0;

  return (
    <div className="absolute inset-x-0 top-0 z-20">
      {/* Current instruction */}
      <div className="bg-gray-900/95 backdrop-blur-sm p-4 safe-top">
        <div className="flex items-center gap-4">
          <div className="text-4xl">
            {currentStep ? getDirectionIcon(currentStep.type) : '\u2B06'}
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-lg">
              {currentStep?.text || t('nav.starting')}
            </div>
            {distanceToNext !== null && (
              <div className="text-green-400 text-sm mt-1">
                {formatDistance(distanceToNext)}
              </div>
            )}
          </div>
        </div>

        {/* Next instruction preview */}
        {nextStep && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-3 text-gray-400 text-sm">
            <span>{getDirectionIcon(nextStep.type)}</span>
            <span>{t('nav.then', { instruction: nextStep.text })}</span>
          </div>
        )}
      </div>

      {/* Off-route banner */}
      <OffRouteBanner visible={offRoute} direction={offRouteDirection} />

      {/* Landmark proximity notification */}
      {nearbyLandmark && (
        <div
          className="mx-4 mt-2 bg-indigo-600/90 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-top duration-300"
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}
        >
          <span className="text-2xl flex-shrink-0">
            {LANDMARK_ICONS[nearbyLandmark.type] || '\uD83D\uDCCD'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{nearbyLandmark.name}</p>
            {nearbyLandmark.description && (
              <p className="text-indigo-200 text-xs truncate">{nearbyLandmark.description}</p>
            )}
          </div>
          <button
            onClick={() => setNearbyLandmark(null)}
            className="text-white/60 hover:text-white flex-shrink-0"
            aria-label={t('nav.dismiss')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Metrics overlay for active/paused runs */}
      {(runStatus === 'active' || runStatus === 'paused') && (
        <RunMetricsOverlay
          trace={trace}
          elapsedMs={elapsedMs}
          distanceMeters={distanceMeters}
          routeDistanceMeters={route.distance}
          runStatus={runStatus as 'active' | 'paused'}
          units={settings.units}
          onPause={() => { haptic('tap'); onPause(); }}
          onResume={() => { haptic('tap'); onResume(); }}
          onEndRun={() => { haptic('success'); onEndRun(); }}
          onVoiceToggle={() => {
            const newEnabled = !settings.voiceEnabled;
            const newSettings = { ...settings, voiceEnabled: newEnabled };
            setSettings(newSettings);
            import('@/lib/storage').then(m => m.saveSettings(newSettings));
            if (!newEnabled) stopSpeaking();
          }}
          voiceEnabled={settings.voiceEnabled}
        />
      )}

      {/* Stop button for idle/completed states */}
      {runStatus !== 'active' && runStatus !== 'paused' && (
        <div className="absolute bottom-0 inset-x-0 bg-gray-900/95 backdrop-blur-sm p-4 safe-bottom">
          <div className="flex justify-end">
            <button
              onClick={() => {
                stopSpeaking();
                onStop();
              }}
              className="bg-red-500 text-white px-6 py-2 rounded-lg font-semibold active:bg-red-600"
            >
              {t('nav.stop')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
