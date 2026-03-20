/**
 * Pure navigation utility functions.
 * All functions accept (lat, lng) as separate params.
 * Polylines are [lng, lat][] (MapLibre convention) and must be destructured.
 */

const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEGREE = 111320;

/**
 * Shortest distance from a point to a line segment (in meters).
 * Uses equirectangular projection with cos(lat) correction.
 */
export function pointToSegmentDistance(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const cosLat = Math.cos(pLat * DEG_TO_RAD);

  // Project to approximate local meters (relative to point A)
  const px = (pLng - aLng) * cosLat;
  const py = pLat - aLat;
  const bx = (bLng - aLng) * cosLat;
  const by = bLat - aLat;

  const lenSq = bx * bx + by * by;

  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  }

  const projX = t * bx;
  const projY = t * by;

  const distDeg = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  return distDeg * METERS_PER_DEGREE;
}

/**
 * Find minimum distance from point to any segment in polyline.
 * Polyline is [lng, lat][] pairs.
 */
export function distanceToRoute(
  lat: number,
  lng: number,
  polyline: [number, number][]
): number {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLng, aLat] = polyline[i];
    const [bLng, bLat] = polyline[i + 1];
    const d = pointToSegmentDistance(lat, lng, aLat, aLng, bLat, bLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Returns index of nearest segment start point in polyline.
 * Polyline is [lng, lat][] pairs.
 */
export function findNearestSegmentIndex(
  lat: number,
  lng: number,
  polyline: [number, number][]
): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLng, aLat] = polyline[i];
    const [bLng, bLat] = polyline[i + 1];
    const d = pointToSegmentDistance(lat, lng, aLat, aLng, bLat, bLng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

/**
 * 8-point compass direction from one coordinate to another.
 */
export function getCompassDirection(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): string {
  const dLat = toLat - fromLat;
  const dLng = (toLng - fromLng) * Math.cos(fromLat * DEG_TO_RAD);
  const angle = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(angle / 45) % 8];
}

/**
 * Exponential moving average for heading smoothing with 360/0 wrap-around.
 */
export function smoothHeading(
  current: number | null,
  previous: number | null,
  alpha: number = 0.3
): number | null {
  if (current === null) return previous;
  if (previous === null) return current;

  let diff = current - previous;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return ((previous + alpha * diff) + 360) % 360;
}

/**
 * Bearing between two coordinates in degrees (0-360).
 * 0 = north, 90 = east, 180 = south, 270 = west.
 */
export function bearingBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
