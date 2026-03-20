'use client';

import { useState, useCallback } from 'react';
import type { GeneratedRoute } from '@/types';
import { saveRoute } from '@/lib/storage';

export interface RouteGeneratorProps {
  onGenerate: (distance: number) => void;
  isLoading: boolean;
  userLocation: [number, number] | null;
  cityName: string;
  route?: GeneratedRoute | null;
}

export default function RouteGenerator({ onGenerate, isLoading, userLocation, cityName, route }: RouteGeneratorProps) {
  const [distance, setDistance] = useState(5);
  const [saved, setSaved] = useState(false);

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
    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm rounded-t-2xl p-6 z-20 safe-bottom">
      {/* City name */}
      <div className="text-gray-400 text-sm mb-1">
        {userLocation ? cityName || 'Getting location...' : 'Waiting for GPS...'}
      </div>

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
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
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
      <button
        onClick={() => handleGenerate(distance)}
        disabled={isLoading || !userLocation}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
          isLoading || !userLocation
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-green-500 text-white active:bg-green-600 active:scale-[0.98]'
        }`}
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
      </button>

      {/* Save Route button - shown after route generation */}
      {route && !isLoading && (
        <button
          onClick={handleSaveRoute}
          disabled={saved}
          className={`w-full mt-3 py-2 rounded-xl px-4 font-semibold transition-all ${
            saved
              ? 'bg-gray-700 text-green-400 cursor-default'
              : 'bg-green-500 text-white active:bg-green-600 active:scale-[0.98]'
          }`}
        >
          {saved ? 'Saved!' : 'Save Route'}
        </button>
      )}
    </div>
  );
}
