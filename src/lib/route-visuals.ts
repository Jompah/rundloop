import maplibregl from 'maplibre-gl';
import type { TurnInstruction } from '@/types';
import { buildGradientExpression } from './elevation';

/** Shared dark map style URL (CartoDB dark-matter vector tiles). */
export const DARK_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * Add a gradient-colored route line to the map.
 * Uses line-gradient with line-progress for elevation-based coloring.
 * Falls back to solid green if grades are empty or all zeros.
 *
 * CRITICAL: Source uses lineMetrics: true (required for line-gradient).
 */
export function addGradientRoute(
  map: maplibregl.Map,
  coords: [number, number][],
  grades: number[],
  sourceId = 'route',
  layerId = 'route-gradient'
): void {
  const geojsonData = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: coords,
    },
  };

  map.addSource(sourceId, {
    type: 'geojson',
    lineMetrics: true,
    data: geojsonData,
  });

  // Determine if we have meaningful grade data
  const hasGrades =
    grades.length > 0 && grades.some((g) => g > 0);

  if (hasGrades) {
    const gradientExpr = buildGradientExpression(coords, grades);

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-width': 5,
        'line-gradient': gradientExpr as maplibregl.ExpressionSpecification,
      },
    });
  } else {
    // Fallback: solid green line (no gradient data)
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-width': 5,
        'line-color': '#22c55e',
      },
    });
  }
}

/**
 * Add start (green circle) and finish (checkered flag) markers to the map.
 * Returns the created Marker instances for cleanup by the caller.
 */
export function addStartFinishMarkers(
  map: maplibregl.Map,
  coords: [number, number][]
): maplibregl.Marker[] {
  const markers: maplibregl.Marker[] = [];

  if (coords.length === 0) return markers;

  // Start marker: green circle with white border and glow
  const startEl = document.createElement('div');
  startEl.style.cssText = `
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #22c55e;
    border: 3px solid white;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  `;
  const startMarker = new maplibregl.Marker({ element: startEl })
    .setLngLat(coords[0])
    .addTo(map);
  markers.push(startMarker);

  // Finish marker: checkered flag SVG
  const finishEl = document.createElement('div');
  finishEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="24" height="24" fill="none"/>
    <g transform="translate(4, 2)">
      <rect x="0" y="0" width="4" height="4" fill="white"/>
      <rect x="4" y="0" width="4" height="4" fill="#1a1a1a"/>
      <rect x="8" y="0" width="4" height="4" fill="white"/>
      <rect x="12" y="0" width="4" height="4" fill="#1a1a1a"/>
      <rect x="0" y="4" width="4" height="4" fill="#1a1a1a"/>
      <rect x="4" y="4" width="4" height="4" fill="white"/>
      <rect x="8" y="4" width="4" height="4" fill="#1a1a1a"/>
      <rect x="12" y="4" width="4" height="4" fill="white"/>
      <rect x="0" y="8" width="4" height="4" fill="white"/>
      <rect x="4" y="8" width="4" height="4" fill="#1a1a1a"/>
      <rect x="8" y="8" width="4" height="4" fill="white"/>
      <rect x="12" y="8" width="4" height="4" fill="#1a1a1a"/>
      <rect x="0" y="12" width="4" height="4" fill="#1a1a1a"/>
      <rect x="4" y="12" width="4" height="4" fill="white"/>
      <rect x="8" y="12" width="4" height="4" fill="#1a1a1a"/>
      <rect x="12" y="12" width="4" height="4" fill="white"/>
      <line x1="0" y1="0" x2="0" y2="20" stroke="white" stroke-width="2"/>
    </g>
  </svg>`;
  const finishMarker = new maplibregl.Marker({ element: finishEl, anchor: 'bottom' })
    .setLngLat(coords[coords.length - 1])
    .addTo(map);
  markers.push(finishMarker);

  return markers;
}

/**
 * Add turn indicator arrows at significant turn locations.
 * Creates a canvas-drawn white arrow image and renders as a symbol layer.
 */
export function addTurnIndicators(
  map: maplibregl.Map,
  turns: TurnInstruction[]
): void {
  if (turns.length === 0) return;

  // Create arrow image via canvas (32x32 white arrow)
  if (!map.hasImage('turn-arrow')) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(28, 28);
    ctx.lineTo(16, 20);
    ctx.lineTo(4, 28);
    ctx.closePath();
    ctx.fill();

    // Convert canvas to ImageData for MapLibre addImage compatibility
    const imageData = ctx.getImageData(0, 0, 32, 32);
    map.addImage('turn-arrow', imageData);
  }

  // Build GeoJSON features with bearing property
  const features = turns.map((turn) => {
    // Compute a basic bearing from the turn type
    let bearing = 0;
    if (turn.type === 'turn-right') bearing = 90;
    else if (turn.type === 'turn-left') bearing = -90;
    else if (turn.type === 'u-turn') bearing = 180;

    return {
      type: 'Feature' as const,
      properties: { bearing },
      geometry: {
        type: 'Point' as const,
        coordinates: turn.location,
      },
    };
  });

  map.addSource('turn-indicators', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features,
    },
  });

  map.addLayer({
    id: 'turn-arrows',
    type: 'symbol',
    source: 'turn-indicators',
    layout: {
      'icon-image': 'turn-arrow',
      'icon-size': 0.5,
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
    },
  });
}

/**
 * Remove all route visual layers and sources from the map.
 * Does NOT remove HTML markers (caller manages those via returned refs).
 */
export function removeRouteVisuals(map: maplibregl.Map): void {
  // Remove layers first (must be removed before their sources)
  if (map.getLayer('route-gradient')) map.removeLayer('route-gradient');
  if (map.getLayer('turn-arrows')) map.removeLayer('turn-arrows');

  // Remove sources
  if (map.getSource('route')) map.removeSource('route');
  if (map.getSource('turn-indicators')) map.removeSource('turn-indicators');
}
