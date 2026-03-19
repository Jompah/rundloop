'use client';

import { useState, useEffect, useCallback } from 'react';
import { GeneratedRoute, TurnInstruction } from '@/types';
import { speak, stopSpeaking } from '@/lib/voice';
import { getSettings } from '@/lib/storage';

interface NavigationViewProps {
  route: GeneratedRoute;
  userLocation: [number, number] | null; // [lng, lat]
  onStop: () => void;
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

export default function NavigationView({ route, userLocation, onStop }: NavigationViewProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [totalCovered, setTotalCovered] = useState(0);
  const [lastSpokenStep, setLastSpokenStep] = useState(-1);
  const settings = getSettings();

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

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gray-900/95 backdrop-blur-sm p-4 safe-bottom">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-800 rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-white font-bold">
              {(route.distance / 1000).toFixed(1)} km
            </span>
            <span className="text-gray-500 ml-2">
              ~{Math.round(route.duration / 60)} min
            </span>
          </div>

          <div className="flex gap-2">
            {/* Voice toggle */}
            <button
              onClick={() => {
                const s = getSettings();
                const newSettings = { ...s, voiceEnabled: !s.voiceEnabled };
                import('@/lib/storage').then(m => m.saveSettings(newSettings));
                if (!newSettings.voiceEnabled) stopSpeaking();
              }}
              className={`px-3 py-2 rounded-lg text-sm ${
                settings.voiceEnabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-800 text-gray-500'
              }`}
            >
              {settings.voiceEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
            </button>

            {/* Stop button */}
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
      </div>
    </div>
  );
}
