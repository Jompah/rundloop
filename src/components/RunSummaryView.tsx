'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { CompletedRun, GeneratedRoute, AppSettings } from '@/types';
import { estimateCalories } from '@/lib/calories';
import {
  computeAveragePace,
  formatPace,
  formatMetricDistance,
  formatElapsed,
} from '@/lib/metrics';
import { getSettings } from '@/lib/storage';
import DiscardConfirmDialog from './DiscardConfirmDialog';

interface RunSummaryViewProps {
  completedRun: CompletedRun;
  route: GeneratedRoute | null;
  onSave: () => void;
  onDiscard: () => void;
}

export default function RunSummaryView({
  completedRun,
  route,
  onSave,
  onDiscard,
}: RunSummaryViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [visible, setVisible] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Fade-in on mount
  useEffect(() => {
    setVisible(true);
  }, []);

  // Load settings
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // Map initialization
  useEffect(() => {
    if (!mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      interactive: false,
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      const bounds = new maplibregl.LngLatBounds();

      // Add planned route polyline (green, underneath)
      if (route && route.polyline.length > 0) {
        const routeCoords = route.polyline;
        routeCoords.forEach((coord) => bounds.extend(coord as [number, number]));

        map.addSource('planned-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoords,
            },
          },
        });

        map.addLayer({
          id: 'planned-route-layer',
          type: 'line',
          source: 'planned-route',
          paint: {
            'line-color': '#4ade80',
            'line-width': 3,
            'line-opacity': 0.6,
          },
        });
      }

      // Add actual trace polyline (cyan, on top)
      if (completedRun.trace.length > 0) {
        const traceCoords: [number, number][] = completedRun.trace.map((p) => [
          p.lng,
          p.lat,
        ]);
        traceCoords.forEach((coord) => bounds.extend(coord));

        map.addSource('actual-trace', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: traceCoords,
            },
          },
        });

        map.addLayer({
          id: 'actual-trace-layer',
          type: 'line',
          source: 'actual-trace',
          paint: {
            'line-color': '#22d3ee',
            'line-width': 3,
            'line-opacity': 1.0,
          },
        });

        // Start marker (green circle)
        const startCoord = traceCoords[0];
        new maplibregl.Marker({ color: '#4ade80' })
          .setLngLat(startCoord)
          .addTo(map);

        // End marker (green circle)
        const endCoord = traceCoords[traceCoords.length - 1];
        new maplibregl.Marker({ color: '#4ade80' })
          .setLngLat(endCoord)
          .addTo(map);
      }

      // Fit bounds
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40 });
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [completedRun, route]);

  const units = settings?.units ?? 'km';
  const bodyWeightKg = settings?.bodyWeightKg ?? 70;
  const avgPace = computeAveragePace(
    completedRun.distanceMeters,
    completedRun.elapsedMs
  );
  const calories = estimateCalories(completedRun.distanceMeters, bodyWeightKg);
  const paceUnit = units === 'km' ? '/km' : '/mi';

  const showCalorieNote = settings?.bodyWeightKg === undefined;
  const calorieNote =
    units === 'km'
      ? 'Based on 70 kg -- update weight in Settings'
      : 'Based on 154 lbs -- update weight in Settings';

  return (
    <div
      className={`bg-gray-900 min-h-screen flex flex-col transition-opacity duration-500 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Map container */}
      <div ref={mapRef} className="h-[50vh] w-full" />

      {/* Stats card */}
      <div className="bg-gray-800 rounded-2xl mx-4 p-6 -mt-6 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">
              Distance
            </p>
            <p className="text-3xl font-bold text-white">
              {formatMetricDistance(completedRun.distanceMeters, units)}
              <span className="text-sm font-normal text-gray-400 ml-1">
                {units === 'km' ? 'km' : 'mi'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">
              Time
            </p>
            <p className="text-3xl font-bold text-white">
              {formatElapsed(completedRun.elapsedMs)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">
              Avg Pace
            </p>
            <p className="text-3xl font-bold text-green-400">
              {formatPace(avgPace, units)}
              <span className="text-sm font-normal text-gray-400 ml-1">
                {paceUnit}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">
              Calories
            </p>
            <p className="text-3xl font-bold text-white">
              {calories}
              <span className="text-sm font-normal text-gray-400 ml-1">
                kcal
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Calorie note */}
      {showCalorieNote && (
        <p className="text-sm text-gray-400 text-center mt-2 mx-4">
          {calorieNote}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mx-4 mt-auto pb-safe">
        <button
          onClick={onSave}
          className="flex-1 py-3 rounded-xl font-semibold bg-green-500 text-white active:bg-green-600"
        >
          Save Run
        </button>
        <button
          onClick={() => setShowDiscardDialog(true)}
          className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-white active:bg-gray-700"
        >
          Discard
        </button>
      </div>

      {/* Discard confirmation dialog */}
      {showDiscardDialog && (
        <DiscardConfirmDialog
          onConfirm={onDiscard}
          onCancel={() => setShowDiscardDialog(false)}
        />
      )}
    </div>
  );
}
