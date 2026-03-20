'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeneratedRoute } from '@/types';
import { smoothHeading, bearingBetween } from '@/lib/navigation';
import { fetchElevations, computeGrades, getSignificantTurns } from '@/lib/elevation';
import {
  DARK_STYLE,
  addGradientRoute,
  addStartFinishMarkers,
  addTurnIndicators,
  removeRouteVisuals,
} from '@/lib/route-visuals';

interface MapViewProps {
  route?: GeneratedRoute | null;
  userLocation?: [number, number] | null; // [lng, lat]
  heading?: number | null;
  speed?: number | null;
  isNavigating?: boolean;
  onMapReady?: (map: maplibregl.Map) => void;
}

export default function MapView({ route, userLocation, heading, speed, isNavigating, onMapReady }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const isAutoRotating = useRef(true);
  const prevHeadingRef = useRef<number | null>(null);
  const [showRecenter, setShowRecenter] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: DARK_STYLE,
      center: [18.0686, 59.3293], // Stockholm default
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      setMapLoaded(true);
      onMapReady?.(map);
    });

    mapRef.current = map;

    return () => {
      routeMarkersRef.current.forEach((m) => m.remove());
      routeMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Interaction detection: disable auto-rotation on manual pan/zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isNavigating) return;

    const handleInteraction = () => {
      isAutoRotating.current = false;
      setShowRecenter(true);
    };

    map.on('dragstart', handleInteraction);
    map.on('zoomstart', handleInteraction);

    return () => {
      map.off('dragstart', handleInteraction);
      map.off('zoomstart', handleInteraction);
    };
  }, [isNavigating, mapLoaded]);

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userLocation) return;

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#3b82f6';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.6)';

      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(userLocation)
        .addTo(mapRef.current);
    } else {
      userMarkerRef.current.setLngLat(userLocation);
    }
  }, [userLocation, mapLoaded]);

  // Draw route on map with elevation gradient, markers, and turn indicators
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Clean up previous route visuals
    removeRouteVisuals(map);
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    if (!route || route.polyline.length === 0) return;

    // Fetch elevation data and render gradient route
    fetchElevations(route.polyline)
      .then((elevations) => {
        const grades = computeGrades(route.polyline, elevations);
        addGradientRoute(map, route.polyline, grades);
      })
      .catch(() => {
        // Elevation API down: fallback to solid green
        addGradientRoute(map, route.polyline, []);
      })
      .finally(() => {
        // Add start/finish markers
        routeMarkersRef.current = addStartFinishMarkers(map, route.polyline);

        // Add turn indicators at significant turns
        if (route.instructions) {
          const turns = getSignificantTurns(route.instructions);
          addTurnIndicators(map, turns);
        }
      });

    // Fit map to route bounds
    const bounds = new maplibregl.LngLatBounds();
    route.polyline.forEach((coord) => bounds.extend(coord as [number, number]));
    map.fitBounds(bounds, { padding: 60 });
  }, [route, mapLoaded]);

  // Heading-aware auto-rotation during navigation
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    if (isNavigating) {
      if (!isAutoRotating.current) return;

      // Compute smoothed heading
      let computedHeading: number | null = null;

      if (speed !== null && speed !== undefined && speed > 1.0 && heading !== null && heading !== undefined) {
        computedHeading = smoothHeading(heading, prevHeadingRef.current, 0.3);
      } else {
        // Fallback: use prevHeadingRef or 0
        computedHeading = prevHeadingRef.current ?? 0;
      }

      prevHeadingRef.current = computedHeading;

      mapRef.current.easeTo({
        center: userLocation,
        bearing: computedHeading ?? 0,
        pitch: 30,
        zoom: 16,
        duration: 500,
      });
    } else {
      // Not navigating: reset rotation state
      if (prevHeadingRef.current !== null) {
        isAutoRotating.current = true;
        prevHeadingRef.current = null;
        setShowRecenter(false);
        mapRef.current.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 500,
        });
      }
    }
  }, [userLocation, isNavigating, heading, speed]);

  const handleRecenter = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    isAutoRotating.current = true;
    setShowRecenter(false);

    const currentHeading = prevHeadingRef.current ?? 0;
    mapRef.current.easeTo({
      center: userLocation,
      bearing: currentHeading,
      pitch: 30,
      zoom: 16,
      duration: 500,
    });
  }, [userLocation]);

  const centerOnUser = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.flyTo({
      center: userLocation,
      zoom: 15,
      duration: 1000,
    });
  }, [userLocation]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Re-center button: shown during navigation when auto-rotation is disabled */}
      {isNavigating && showRecenter && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-[220px] right-4 bg-gray-800 text-white rounded-full shadow-lg z-10 active:bg-gray-700 flex items-center justify-center"
          style={{ width: 48, height: 48 }}
          aria-label="Re-center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l4 8-4 12-4-12z" fill="currentColor" stroke="none" />
          </svg>
        </button>
      )}

      {/* Center on user button: shown when NOT navigating */}
      {!isNavigating && userLocation && (
        <button
          onClick={centerOnUser}
          className="absolute bottom-6 right-4 bg-gray-800 text-white rounded-full p-3 shadow-lg z-10 active:bg-gray-700"
          aria-label="Center on my location"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className="text-white">Loading map...</div>
        </div>
      )}
    </div>
  );
}
