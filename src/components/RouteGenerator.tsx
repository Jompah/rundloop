'use client';

import { useState, useCallback, useEffect } from 'react';
import type { GeneratedRoute, RouteMode, ScenicMode } from '@/types';
import { saveRoute, getSettings } from '@/lib/storage';
import { Button } from '@/components/ui/Button';

export interface RouteGeneratorProps {
  onGenerate: (distance: number) => void;
  isLoading: boolean;
  userLocation: [number, number] | null;
  cityName: string;
  route?: GeneratedRoute | null;
  nearbyRoutes?: GeneratedRoute[];
  onDistanceChange?: (distance: number) => void;
  onLoadNearby?: (route: GeneratedRoute) => void;
  routeMode?: RouteMode;
  onModeChange?: (mode: RouteMode) => void;
  scenicMode?: ScenicMode;
  onScenicModeChange?: (mode: ScenicMode) => void;
}

export default function RouteGenerator({ onGenerate, isLoading, userLocation, cityName, route, nearbyRoutes, onDistanceChange, onLoadNearby, routeMode, onModeChange, scenicMode, onScenicModeChange }: RouteGeneratorProps) {
  const [distance, setDistance] = useState(5);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.defaultDistance) {
        setDistance(s.defaultDistance);
      }
    });
  }, []);

  const handleSaveRoute = useCallback(async () => {
    if (!route || saved) return;
    await saveRoute(route, cityName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [route, cityName, saved]);

  // Reset saved state when a new route is generated
  const handleGenerate = useCallback((d: number) => {
    setSaved(false);
    onGenerate(d);
  }, [onGenerate]);

  const presets = [3, 5, 7, 10, 15, 21];

  return (
    <div className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-gray-900/95 backdrop-blur-sm rounded-t-2xl p-6 z-20 overflow-hidden">
      {/* City name */}
      <div className="text-gray-400 text-sm mb-1">
        {userLocation ? cityName || 'Getting location...' : 'Waiting for GPS...'}
      </div>

      {/* Scenic mode toggle - only for AI routes */}
      {routeMode === 'ai' && (
        <div className="flex gap-1 mb-4 bg-gray-800 rounded-xl p-1">
          {([
            { value: 'standard' as ScenicMode, label: 'Standard' },
            { value: 'nature' as ScenicMode, label: 'Natur' },
            { value: 'explore' as ScenicMode, label: 'Utforska' },
          ]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onScenicModeChange?.(value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                scenicMode === value
                  ? 'bg-green-500 text-white'
                  : 'text-gray-400 active:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Distance display */}
      <div className="text-center mb-4">
        <span className="text-5xl font-bold text-white tabular-nums">{distance}</span>
        <span className="text-xl text-gray-400 ml-2">km</span>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-2 mb-4 justify-center flex-wrap">
        {presets.map((d) => (
          <button
            key={d}
            onClick={() => setDistance(d)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
              distance === d
                ? 'bg-green-500 text-white'
                : 'bg-gray-800 text-gray-300 active:bg-gray-700'
            }`}
          >
            {d} km
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="mb-6 px-2">
        <input
          type="range"
          min={1}
          max={30}
          step={0.5}
          value={distance}
          onChange={(e) => setDistance(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1 km</span>
          <span>30 km</span>
        </div>
      </div>

      {/* Generate button */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => handleGenerate(distance)}
        disabled={isLoading || !userLocation}
        className={isLoading || !userLocation ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : ''}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating route...
          </span>
        ) : !userLocation ? (
          'Waiting for GPS...'
        ) : (
          `Generate ${distance} km route`
        )}
      </Button>

      {/* Save Route button - shown after route generation */}
      {route && !isLoading && (
        <Button
          variant={saved ? 'secondary' : 'primary'}
          fullWidth
          className={`mt-3 ${saved ? 'text-green-400 cursor-default' : ''}`}
          onClick={handleSaveRoute}
          disabled={saved}
        >
          {saved ? 'Saved!' : 'Save Route'}
        </Button>
      )}
    </div>
  );
}
