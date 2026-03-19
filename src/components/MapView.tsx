'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeneratedRoute } from '@/types';

interface MapViewProps {
  route?: GeneratedRoute | null;
  userLocation?: [number, number] | null; // [lng, lat]
  isNavigating?: boolean;
  onMapReady?: (map: maplibregl.Map) => void;
}

export default function MapView({ route, userLocation, isNavigating, onMapReady }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
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
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      el.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.5)';

      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(userLocation)
        .addTo(mapRef.current);
    } else {
      userMarkerRef.current.setLngLat(userLocation);
    }
  }, [userLocation, mapLoaded]);

  // Draw route on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Remove existing route layer/source
    if (map.getLayer('route-line')) map.removeLayer('route-line');
    if (map.getSource('route')) map.removeSource('route');

    if (!route || route.polyline.length === 0) return;

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route.polyline,
        },
      },
    });

    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#22c55e',
        'line-width': 4,
        'line-opacity': 0.8,
      },
    });

    // Fit map to route bounds
    const bounds = new maplibregl.LngLatBounds();
    route.polyline.forEach(coord => bounds.extend(coord as [number, number]));
    map.fitBounds(bounds, { padding: 60 });
  }, [route, mapLoaded]);

  // Center on user when navigating
  useEffect(() => {
    if (!mapRef.current || !isNavigating || !userLocation) return;
    mapRef.current.easeTo({
      center: userLocation,
      zoom: 16,
      duration: 1000,
    });
  }, [userLocation, isNavigating]);

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

      {userLocation && (
        <button
          onClick={centerOnUser}
          className="absolute bottom-6 right-4 bg-white rounded-full p-3 shadow-lg z-10 active:bg-gray-100"
          aria-label="Center on my location"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="text-white">Loading map...</div>
        </div>
      )}
    </div>
  );
}
