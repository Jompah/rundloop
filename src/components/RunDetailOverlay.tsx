'use client';

import { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CompletedRun } from '@/types';
import type { SavedRoute } from '@/lib/storage';
import { dbDelete, dbGet } from '@/lib/db';
import {
  formatMetricDistance,
  formatElapsed,
  formatPace,
  computeAveragePace,
} from '@/lib/metrics';
import DeleteRunDialog from './DeleteRunDialog';

interface RunDetailOverlayProps {
  run: CompletedRun;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function RunDetailOverlay({ run, onClose, onDelete }: RunDetailOverlayProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);

  // Load planned route polyline
  useEffect(() => {
    if (run.routePolyline) {
      setRoutePolyline(run.routePolyline);
      return;
    }
    if (run.routeId) {
      dbGet<SavedRoute>('routes', run.routeId).then((saved) => {
        if (saved?.route?.polyline) {
          setRoutePolyline(saved.route.polyline);
        }
      });
    }
  }, [run.routePolyline, run.routeId]);

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
      if (routePolyline && routePolyline.length > 0) {
        routePolyline.forEach((coord) => bounds.extend(coord as [number, number]));

        map.addSource('planned-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routePolyline,
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
      if (run.trace.length > 0) {
        const traceCoords: [number, number][] = run.trace.map((p) => [p.lng, p.lat]);
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
  }, [run, routePolyline]);

  const avgPace = computeAveragePace(run.distanceMeters, run.elapsedMs);
  const calories = Math.round((run.distanceMeters / 1000) * 60);

  const handleDelete = async () => {
    await dbDelete('runs', run.id);
    onDelete(run.id);
  };

  return (
    <div className="fixed inset-0 z-30 bg-gray-900 overflow-y-auto">
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 z-40 text-white bg-black/40 rounded-full w-10 h-10 flex items-center justify-center"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Map section */}
      <div ref={mapRef} className="h-[50vh] w-full relative" />

      {/* Stats card */}
      <div className="bg-gray-800 rounded-2xl mx-4 p-6 -mt-6 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Distance</p>
            <p className="text-3xl font-bold text-white">
              {formatMetricDistance(run.distanceMeters, 'km')}
              <span className="text-sm font-normal text-gray-400 ml-1">km</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Time</p>
            <p className="text-3xl font-bold text-white">
              {formatElapsed(run.elapsedMs)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Avg Pace</p>
            <p className="text-3xl font-bold text-green-400">
              {formatPace(avgPace, 'km')}
              <span className="text-sm font-normal text-gray-400 ml-1">/km</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Calories</p>
            <p className="text-3xl font-bold text-white">
              {calories}
              <span className="text-sm font-normal text-gray-400 ml-1">kcal</span>
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          {new Date(run.startTime).toLocaleDateString('en', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          at{' '}
          {new Date(run.startTime).toLocaleTimeString('en', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => setShowDeleteDialog(true)}
        className="mx-4 mt-6 mb-8 py-3 rounded-xl font-semibold bg-red-500 text-white w-full text-center"
        style={{ width: 'calc(100% - 2rem)' }}
      >
        Delete Run
      </button>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <DeleteRunDialog
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}
