/**
 * Scenic geometry library.
 *
 * Pure TypeScript helpers (no external deps, no side effects) for:
 *  - scoring how "scenic" a finished route is against real OSM geometries
 *  - finding the nearest waterfront feature (coastline, beach, water, waterway)
 *  - building corridor waypoints that follow e.g. a coastline
 *
 * All math uses haversine for distances and a local equirectangular
 * projection (meters) for point-to-segment distances — accurate enough
 * at city scale.
 */

import { RouteWaypoint } from '@/types';

export type ScenicFeatureType =
  | 'coastline'
  | 'beach'
  | 'water'
  | 'waterway'
  | 'park'
  | 'forest'
  | 'landmark';

export interface ScenicFeature {
  id: string;
  type: ScenicFeatureType;
  name?: string;
  /** Way-geometri som [lat, lng]-par (en punkt för punkt-features som landmarks) */
  points: [number, number][];
}

export interface ScenicAnchor {
  lat: number;
  lng: number;
  /** meter från start till anchor-punkten */
  distanceM: number;
  /** bäring start → anchor, 0-360 */
  bearingDeg: number;
  /** featurens lokala riktning vid anchor, 0-180 */
  orientationDeg: number;
  feature: ScenicFeature;
  /** index i feature.points närmast anchor */
  pointIndex: number;
}

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;
/** Meters per degree of latitude (and of longitude at the equator). */
const M_PER_DEG = (Math.PI * EARTH_RADIUS_M) / 180; // ~111194.9

/** Great-circle distance in meters between two [lat, lng] points. */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from point 1 to point 2, degrees 0-360. */
export function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Move from [lat, lng] by `distM` meters along `bearing` (equirectangular, fine for short hops). */
function offsetPoint(
  lat: number,
  lng: number,
  bearing: number,
  distM: number
): [number, number] {
  const rad = bearing * DEG_TO_RAD;
  const dLat = (distM * Math.cos(rad)) / M_PER_DEG;
  const dLng =
    (distM * Math.sin(rad)) / (M_PER_DEG * Math.cos(lat * DEG_TO_RAD));
  return [lat + dLat, lng + dLng];
}

/**
 * Distance in meters from point P to segment AB using a local
 * equirectangular projection centered on P.
 */
function pointToSegmentM(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const cosLat = Math.cos(pLat * DEG_TO_RAD);
  const ax = (aLng - pLng) * cosLat * M_PER_DEG;
  const ay = (aLat - pLat) * M_PER_DEG;
  const bx = (bLng - pLng) * cosLat * M_PER_DEG;
  const by = (bLat - pLat) * M_PER_DEG;
  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;
  let t = 0;
  if (segLenSq > 0) {
    t = -(ax * dx + ay * dy) / segLenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt(cx * cx + cy * cy);
}

/** Min distance in meters from a [lat, lng] point to a feature's geometry. */
function pointToFeatureM(
  lat: number,
  lng: number,
  feature: ScenicFeature
): number {
  const pts = feature.points;
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) {
    return haversineM(lat, lng, pts[0][0], pts[0][1]);
  }
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointToSegmentM(
      lat,
      lng,
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1]
    );
    if (d < min) min = d;
  }
  return min;
}

interface Bbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Bounding box of a feature, expanded by `padM` meters. */
function featureBbox(feature: ScenicFeature, padM: number): Bbox {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of feature.points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const midLat = (minLat + maxLat) / 2;
  const latPad = padM / M_PER_DEG;
  const lngPad =
    padM / (M_PER_DEG * Math.max(0.01, Math.cos(midLat * DEG_TO_RAD)));
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function inBbox(lat: number, lng: number, b: Bbox): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/**
 * Resample a [lat, lng] polyline into points spaced ~`spacingM` apart,
 * capped at ~`maxSamples` samples (spacing grows for long routes).
 */
function samplePolyline(
  latLng: [number, number][],
  spacingM: number,
  maxSamples: number
): [number, number][] {
  if (latLng.length === 0) return [];
  if (latLng.length === 1) return [latLng[0]];

  let total = 0;
  for (let i = 0; i < latLng.length - 1; i++) {
    total += haversineM(
      latLng[i][0],
      latLng[i][1],
      latLng[i + 1][0],
      latLng[i + 1][1]
    );
  }
  const spacing = Math.max(spacingM, total / maxSamples);

  const samples: [number, number][] = [latLng[0]];
  let target = spacing;
  let traveled = 0;
  for (let i = 0; i < latLng.length - 1; i++) {
    const [aLat, aLng] = latLng[i];
    const [bLat, bLng] = latLng[i + 1];
    const segLen = haversineM(aLat, aLng, bLat, bLng);
    while (segLen > 0 && target <= traveled + segLen) {
      const t = (target - traveled) / segLen;
      samples.push([aLat + t * (bLat - aLat), aLng + t * (bLng - aLng)]);
      target += spacing;
    }
    traveled += segLen;
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Threshold used for landmark point features regardless of thresholdM. */
const LANDMARK_THRESHOLD_M = 120;

/**
 * Andel (0..1) av ruttens samplade punkter som ligger inom thresholdM från
 * någon scenic feature.
 * OBS: polyline kommer från OSRM/Google i [lng, lat]-ordning (GeoJSON).
 */
export function scenicScore(
  polylineLngLat: [number, number][],
  features: ScenicFeature[],
  thresholdM: number = 120
): number {
  if (polylineLngLat.length === 0 || features.length === 0) return 0;

  // Convert GeoJSON [lng, lat] → [lat, lng]
  const latLng: [number, number][] = polylineLngLat.map(([lng, lat]) => [
    lat,
    lng,
  ]);

  const samples = samplePolyline(latLng, 100, 80);
  if (samples.length === 0) return 0;

  // Precompute per-feature threshold + expanded bbox for prefiltering.
  const prepared = features
    .filter((f) => f.points.length > 0)
    .map((f) => {
      const limit = f.type === 'landmark' ? LANDMARK_THRESHOLD_M : thresholdM;
      return { feature: f, limit, bbox: featureBbox(f, limit) };
    });
  if (prepared.length === 0) return 0;

  let hits = 0;
  for (const [lat, lng] of samples) {
    for (const { feature, limit, bbox } of prepared) {
      if (!inBbox(lat, lng, bbox)) continue;
      if (pointToFeatureM(lat, lng, feature) <= limit) {
        hits++;
        break;
      }
    }
  }
  return hits / samples.length;
}

const WATER_TYPES: ReadonlySet<ScenicFeatureType> = new Set([
  'coastline',
  'beach',
  'water',
  'waterway',
]);

/**
 * Minsta utsträckning (bbox-diagonal i meter) för att en 'water'-feature ska
 * kvala som anchor. Filtrerar bort fontäner, dammar och andra små vattenytor
 * som annars vinner över den riktiga kajen/stranden längre bort.
 */
const MIN_WATER_EXTENT_M = 150;

/** Geometrisk utsträckning av en feature: bbox-diagonalen i meter. */
function featureExtentM(feature: ScenicFeature): number {
  const pts = feature.points;
  if (pts.length < 2) return 0;
  const b = featureBbox(feature, 0);
  return haversineM(b.minLat, b.minLng, b.maxLat, b.maxLng);
}

/**
 * Föredragen minsta utsträckning (bbox-diagonal i meter) för en anchor-feature.
 * Korta fragment (t.ex. 50 m coastline-bitar i splittrad OSM-data) bär inte en
 * hel korridor — en längre feature något längre bort ger en bättre runda.
 */
const PREFERRED_ANCHOR_EXTENT_M = 400;

/**
 * Närmsta punkt på en VATTEN-feature (coastline|beach|water|waterway) inom
 * maxDistanceM. null om ingen. Vertex-granularitet (geometrin är nedsamplad).
 * 'water'-features med utsträckning < ~150 m (fontäner, små dammar)
 * diskvalificeras som anchor.
 * Features med utsträckning >= preferredExtentM föredras: närmaste sådana
 * vinner över ännu närmare korta fragment. Finns ingen tillräckligt lång
 * feature inom räckhåll används närmaste kandidat oavsett utsträckning.
 */
export function findScenicAnchor(
  lat: number,
  lng: number,
  features: ScenicFeature[],
  maxDistanceM: number = 2000,
  preferredExtentM: number = PREFERRED_ANCHOR_EXTENT_M
): ScenicAnchor | null {
  type Candidate = { feature: ScenicFeature; index: number; distM: number };
  let bestLong: Candidate | null = null; // extent >= preferredExtentM
  let bestAny: Candidate | null = null; // fallback: any qualifying candidate

  for (const feature of features) {
    if (!WATER_TYPES.has(feature.type)) continue;
    const extent = featureExtentM(feature);
    if (feature.type === 'water' && extent < MIN_WATER_EXTENT_M) continue;
    const isLong = extent >= preferredExtentM;
    for (let i = 0; i < feature.points.length; i++) {
      const d = haversineM(lat, lng, feature.points[i][0], feature.points[i][1]);
      if (d > maxDistanceM) continue;
      if (bestAny === null || d < bestAny.distM) {
        bestAny = { feature, index: i, distM: d };
      }
      if (isLong && (bestLong === null || d < bestLong.distM)) {
        bestLong = { feature, index: i, distM: d };
      }
    }
  }

  const best = bestLong ?? bestAny;
  if (!best) return null;

  const pts = best.feature.points;
  const [aLat, aLng] = pts[best.index];

  // Local direction of the feature around the anchor, normalized to 0-180.
  let orientation = 0;
  if (pts.length > 1) {
    const prev = pts[Math.max(0, best.index - 1)];
    const next = pts[Math.min(pts.length - 1, best.index + 1)];
    orientation = bearingDeg(prev[0], prev[1], next[0], next[1]) % 180;
  }

  return {
    lat: aLat,
    lng: aLng,
    distanceM: best.distM,
    bearingDeg: bearingDeg(lat, lng, aLat, aLng),
    orientationDeg: orientation,
    feature: best.feature,
    pointIndex: best.index,
  };
}

/** Cumulative length (m) available along `pts` from `index` in `dir` (+1/-1). */
function availableLength(
  pts: [number, number][],
  index: number,
  dir: 1 | -1
): number {
  let len = 0;
  for (let i = index; i + dir >= 0 && i + dir < pts.length; i += dir) {
    len += haversineM(pts[i][0], pts[i][1], pts[i + dir][0], pts[i + dir][1]);
  }
  return len;
}

/**
 * Walk along `pts` from `index` in `dir`, emitting interpolated points every
 * `spacingM` meters up to `lengthM`, plus the end point at `lengthM`
 * (or at the polyline end if shorter). Does not include the start vertex.
 */
function walkAlong(
  pts: [number, number][],
  index: number,
  dir: 1 | -1,
  lengthM: number,
  spacingM: number
): [number, number][] {
  const out: [number, number][] = [];
  if (lengthM <= 0) return out;

  let traveled = 0;
  let target = spacingM;
  let i = index;
  while (i + dir >= 0 && i + dir < pts.length && traveled < lengthM) {
    const [aLat, aLng] = pts[i];
    const [bLat, bLng] = pts[i + dir];
    const segLen = haversineM(aLat, aLng, bLat, bLng);
    while (segLen > 0 && target <= traveled + segLen && target <= lengthM) {
      const t = (target - traveled) / segLen;
      out.push([aLat + t * (bLat - aLat), aLng + t * (bLng - aLng)]);
      target += spacingM;
    }
    // End point exactly at lengthM, if it falls inside this segment.
    if (traveled + segLen >= lengthM) {
      const t = (lengthM - traveled) / segLen;
      const end: [number, number] = [
        aLat + t * (bLat - aLat),
        aLng + t * (bLng - aLng),
      ];
      const last = out[out.length - 1];
      if (!last || haversineM(last[0], last[1], end[0], end[1]) > 1) {
        out.push(end);
      }
      return out;
    }
    traveled += segLen;
    i += dir;
  }
  // Ran out of polyline: make sure the terminal vertex is included.
  const terminal = pts[i];
  const last = out[out.length - 1];
  if (!last || haversineM(last[0], last[1], terminal[0], terminal[1]) > 1) {
    out.push(terminal);
  }
  return out;
}

/** Offset (m) applied to corridor points toward the start so OSRM snaps to the land side. */
const CORRIDOR_OFFSET_M = 25;
/** Spacing (m) between corridor waypoints. */
const CORRIDOR_SPACING_M = 600;

/**
 * Out-and-back-korridor längs anchor-featuren: [start, ...punkter längs
 * featuren, start]. Längs-korridoren-längd ≈ max(0, distanceKm*1000*0.45 -
 * anchor.distanceM), waypoints var ~600m, varje korridorpunkt offsettas ~25 m
 * i riktning mot start. Väljer den riktning längs featuren med mest
 * tillgänglig längd; räcker den inte, förlängs åt andra hållet från anchor.
 */
export function buildCorridorWaypoints(
  startLat: number,
  startLng: number,
  anchor: ScenicAnchor,
  distanceKm: number
): RouteWaypoint[] {
  const targetLen = Math.max(0, distanceKm * 1000 * 0.45 - anchor.distanceM);
  const pts = anchor.feature.points;
  const idx = anchor.pointIndex;

  const fwdAvail = availableLength(pts, idx, 1);
  const bwdAvail = availableLength(pts, idx, -1);
  const primaryDir: 1 | -1 = fwdAvail >= bwdAvail ? 1 : -1;
  const primaryAvail = Math.max(fwdAvail, bwdAvail);
  const secondaryAvail = Math.min(fwdAvail, bwdAvail);

  const primaryLen = Math.min(targetLen, primaryAvail);
  const secondaryLen = Math.min(
    Math.max(0, targetLen - primaryLen),
    secondaryAvail
  );

  const primaryPts = walkAlong(pts, idx, primaryDir, primaryLen, CORRIDOR_SPACING_M);
  const secondaryPts = walkAlong(
    pts,
    idx,
    primaryDir === 1 ? -1 : 1,
    secondaryLen,
    CORRIDOR_SPACING_M
  );

  // Corridor follows the feature continuously:
  // farthest secondary point → ... → anchor → ... → farthest primary point.
  const corridor: [number, number][] = [
    ...secondaryPts.reverse(),
    [anchor.lat, anchor.lng],
    ...primaryPts,
  ];

  // Offset each corridor point ~25 m toward the start (land side).
  const offsetCorridor: RouteWaypoint[] = corridor.map(([lat, lng]) => {
    const d = haversineM(lat, lng, startLat, startLng);
    if (d < 1) return { lat, lng };
    const brg = bearingDeg(lat, lng, startLat, startLng);
    const [oLat, oLng] = offsetPoint(lat, lng, brg, CORRIDOR_OFFSET_M);
    return { lat: oLat, lng: oLng };
  });

  return [
    { lat: startLat, lng: startLng, label: 'Start' },
    ...offsetCorridor,
    { lat: startLat, lng: startLng, label: 'Finish' },
  ];
}

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

function compassDirection(bearing: number): string {
  return COMPASS_8[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

const ORIENTATIONS = ['N-S', 'NE-SW', 'E-W', 'NW-SE'] as const;

function orientationLabel(orientationDeg: number): string {
  return ORIENTATIONS[Math.round((((orientationDeg % 180) + 180) % 180) / 45) % 4];
}

const FEATURE_LABELS: Record<ScenicFeatureType, string> = {
  coastline: 'a coastline',
  beach: 'a beach',
  water: 'a body of water',
  waterway: 'a waterway',
  park: 'a park',
  forest: 'a forest',
  landmark: 'a landmark',
};

/**
 * Engelsk text för AI-prompten, t.ex:
 * "VERIFIED GEOGRAPHY (OpenStreetMap): nearest waterfront is a coastline
 *  180 m NE of the start (bearing 45°), oriented NW-SE. Routing along it is
 *  possible and strongly preferred."
 */
export function describeAnchor(anchor: ScenicAnchor): string {
  const dist = Math.round(anchor.distanceM);
  const dir = compassDirection(anchor.bearingDeg);
  const what = FEATURE_LABELS[anchor.feature.type];
  const name = anchor.feature.name ? ` (${anchor.feature.name})` : '';
  const orientation = orientationLabel(anchor.orientationDeg);
  return (
    `VERIFIED GEOGRAPHY (OpenStreetMap): nearest waterfront is ${what}${name} ` +
    `${dist} m ${dir} of the start (bearing ${Math.round(anchor.bearingDeg)}°), ` +
    `oriented ${orientation}. Routing along it is possible and strongly preferred.`
  );
}
