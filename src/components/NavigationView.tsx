'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GeneratedRoute, TurnInstruction, FilteredPosition, AppSettings } from '@/types';
import { speak, stopSpeaking } from '@/lib/voice';
import { getSettings } from '@/lib/storage';
import { formatElapsed } from '@/lib/metrics';
import { distanceToRoute, findNearestSegmentIndex, getCompassDirection } from '@/lib/navigation';
import RunMetricsOverlay from './RunMetricsOverlay';
import OffRouteBanner from './OffRouteBanner';

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

export default function NavigationView({ route, userLocation, onStop, runStatus, elapsedMs, distanceMeters, trace, onPause, onResume, onEndRun }: NavigationViewProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [totalCovered, setTotalCovered] = useState(0);
  const [lastSpokenStep, setLastSpokenStep] = useState(-1);
  const [settings, setSettings] = useState<AppSettings>({ voiceEnabled: false, voiceStyle: 'concise', units: 'km', defaultDistance: 5 });
  useEffect(() => { getSettings().then(setSettings); }, []);

  // Off-route detection state
  const [offRoute, setOffRoute] = useState(false);
  const [offRouteDirection, setOffRouteDirection] = useState('');
  const offRouteAnnouncedRef = useRef(false);
  const offRouteRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      speak(`Off route. Head ${direction} to rejoin.`, settings.voiceEnabled);

      // Repeat every 30 seconds
      offRouteRepeatRef.current = setInterval(() => {
        speak(`Off route. Head ${direction} to rejoin.`, settings.voiceEnabled);
      }, 30000);
    } else if (dist <= 50 && offRouteAnnouncedRef.current) {
      setOffRoute(false);
      offRouteAnnouncedRef.current = false;

      if (offRouteRepeatRef.current) {
        clearInterval(offRouteRepeatRef.current);
        offRouteRepeatRef.current = null;
      }

      // Back on route announcement (respects NAV-04 mute toggle)
      speak('Back on route.', settings.voiceEnabled);
    }

    return () => {
      if (offRouteRepeatRef.current) {
        clearInterval(offRouteRepeatRef.current);
        offRouteRepeatRef.current = null;
      }
    };
  }, [userLocation, runStatus, settings.voiceEnabled, route.polyline]);

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
              {currentStep?.text || 'Starting...'}
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
            <span>Then: {nextStep.text}</span>
          </div>
        )}
      </div>

      {/* Off-route banner */}
      <OffRouteBanner visible={offRoute} direction={offRouteDirection} />

      {/* Metrics overlay for active/paused runs */}
      {(runStatus === 'active' || runStatus === 'paused') && (
        <RunMetricsOverlay
          trace={trace}
          elapsedMs={elapsedMs}
          distanceMeters={distanceMeters}
          routeDistanceMeters={route.distance}
          runStatus={runStatus as 'active' | 'paused'}
          units={settings.units}
          onPause={onPause}
          onResume={onResume}
          onEndRun={onEndRun}
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
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
