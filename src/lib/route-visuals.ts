import maplibregl from 'maplibre-gl';
import type { TurnInstruction } from '@/types';
import type { Landmark } from '@/lib/overpass';
import { buildGradientExpression } from './elevation';

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
 * Add a dashed "walk to start" line from the user's GPS position to the route start.
 * Uses a distinct dashed style to differentiate from the main route.
 */
export function addWalkToStartLine(
  map: maplibregl.Map,
  walkCoords: [number, number][],
  sourceId = 'walk-to-start',
  layerId = 'walk-to-start-line'
): void {
  if (walkCoords.length < 2) return;

  map.addSource(sourceId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: walkCoords,
      },
    },
  });

  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-width': 3,
      'line-color': '#94a3b8', // slate-400 gray
      'line-dasharray': [3, 3],
      'line-opacity': 0.8,
    },
  });
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
 * Add landmark markers to the map as emoji icons with circular backgrounds.
 */
export function addLandmarkMarkers(map: maplibregl.Map, landmarks: Landmark[]): void {
  // Remove existing landmark markers if any
  removeLandmarkMarkers(map);

  if (!landmarks || landmarks.length === 0) return;

  // Add a GeoJSON source with all landmarks
  map.addSource('landmarks', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: landmarks.map((lm, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lm.lng, lm.lat] },
        properties: {
          name: lm.name,
          type: lm.type,
          description: lm.description || '',
          icon: LANDMARK_ICONS[lm.type] || '\uD83D\uDCCD',
          index: i,
        },
      })),
    },
  });

  // Add a circle behind for visibility
  map.addLayer({
    id: 'landmark-circles',
    type: 'circle',
    source: 'landmarks',
    paint: {
      'circle-radius': 14,
      'circle-color': '#ffffff',
      'circle-opacity': 0.9,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#6366f1',
    },
  });

  // Use symbol layer with text for the emoji icons
  map.addLayer({
    id: 'landmark-icons',
    type: 'symbol',
    source: 'landmarks',
    layout: {
      'text-field': ['get', 'icon'],
      'text-size': 20,
      'text-allow-overlap': true,
      'text-anchor': 'center',
    },
  });
}

/**
 * Remove landmark marker layers and source from the map.
 */
export function removeLandmarkMarkers(map: maplibregl.Map): void {
  if (map.getLayer('landmark-icons')) map.removeLayer('landmark-icons');
  if (map.getLayer('landmark-circles')) map.removeLayer('landmark-circles');
  if (map.getSource('landmarks')) map.removeSource('landmarks');
}

/**
 * Remove all route visual layers and sources from the map.
 * Does NOT remove HTML markers (caller manages those via returned refs).
 */
export function removeRouteVisuals(map: maplibregl.Map): void {
  // Remove layers first (must be removed before their sources)
  if (map.getLayer('route-gradient')) map.removeLayer('route-gradient');
  if (map.getLayer('turn-arrows')) map.removeLayer('turn-arrows');
  if (map.getLayer('walk-to-start-line')) map.removeLayer('walk-to-start-line');

  // Remove sources
  if (map.getSource('route')) map.removeSource('route');
  if (map.getSource('turn-indicators')) map.removeSource('turn-indicators');
  if (map.getSource('walk-to-start')) map.removeSource('walk-to-start');

  // Remove landmark markers
  removeLandmarkMarkers(map);
}
