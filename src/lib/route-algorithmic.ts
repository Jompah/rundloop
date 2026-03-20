import { RouteWaypoint } from '@/types';

/**
 * Algorithmic route generation — no AI, no API key needed.
 * Generates waypoints in geometric patterns (circle, figure-8, cloverleaf)
 * that get snapped to real roads by OSRM.
 */

type Pattern = 'circle' | 'figure8' | 'cloverleaf';

/**
 * Road-routing correction factor.
 * OSRM routes on real roads which are significantly longer than the
 * straight-line geometry due to detours, one-way streets, and non-circular
 * street layouts. Empirical testing shows a factor of ~3.0 is needed
 * so that a 5 km requested distance actually produces ~5 km of road routing.
 */
const ROAD_ROUTING_FACTOR = 3.0;

/** 1 degree of latitude in km */
const KM_PER_DEG_LAT = 111.0;

/** 1 degree of longitude in km at a given latitude */
function kmPerDegLng(latDeg: number): number {
  return 111.0 * Math.cos((latDeg * Math.PI) / 180);
}

/** Convert km offset to degree offset */
function kmToDegLat(km: number): number {
  return km / KM_PER_DEG_LAT;
}

function kmToDegLng(km: number, latDeg: number): number {
  return km / kmPerDegLng(latDeg);
}

/** Pick pattern based on distance */
function pickPattern(distanceKm: number): Pattern {
  if (distanceKm <= 5) return 'circle';
  if (distanceKm <= 12) return 'figure8';
  return 'cloverleaf';
}

/** Add random jitter of +/-percent to a value */
function jitter(value: number, percent: number = 0.15): number {
  const factor = 1 + (Math.random() * 2 - 1) * percent;
  return value * factor;
}

/**
 * Generate points along a circle.
 * We shrink the geometric circumference by ROAD_ROUTING_FACTOR so that
 * when OSRM routes on real roads the total distance matches the request.
 */
function generateCircle(
  lat: number,
  lng: number,
  distanceKm: number,
  numPoints: number,
  rotationRad: number
): RouteWaypoint[] {
  const radius = (distanceKm / ROAD_ROUTING_FACTOR) / (2 * Math.PI);
  const points: RouteWaypoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = rotationRad + (2 * Math.PI * i) / numPoints;
    const dLat = jitter(radius) * Math.cos(angle);
    const dLng = jitter(radius) * Math.sin(angle);

    points.push({
      lat: lat + kmToDegLat(dLat),
      lng: lng + kmToDegLng(dLng, lat),
    });
  }

  return points;
}

/**
 * Generate a figure-8 pattern (two connected loops).
 * Each loop covers roughly half the total distance.
 */
function generateFigure8(
  lat: number,
  lng: number,
  distanceKm: number,
  numPoints: number,
  rotationRad: number
): RouteWaypoint[] {
  // Each loop has perimeter ~ distanceKm / 2, corrected for road routing
  const loopRadius = (distanceKm / ROAD_ROUTING_FACTOR) / (4 * Math.PI);
  const points: RouteWaypoint[] = [];
  const halfPoints = Math.floor(numPoints / 2);

  // Offset the two loop centers along the rotation axis
  const offsetKm = loopRadius * 1.1;
  const centerOffsetLat = offsetKm * Math.cos(rotationRad);
  const centerOffsetLng = offsetKm * Math.sin(rotationRad);

  // First loop (offset in positive direction)
  const c1Lat = lat + kmToDegLat(centerOffsetLat);
  const c1Lng = lng + kmToDegLng(centerOffsetLng, lat);

  for (let i = 0; i < halfPoints; i++) {
    const angle = rotationRad + (2 * Math.PI * i) / halfPoints;
    const dLat = jitter(loopRadius) * Math.cos(angle);
    const dLng = jitter(loopRadius) * Math.sin(angle);

    points.push({
      lat: c1Lat + kmToDegLat(dLat),
      lng: c1Lng + kmToDegLng(dLng, lat),
    });
  }

  // Second loop (offset in negative direction), traced in reverse for smooth figure-8
  const c2Lat = lat - kmToDegLat(centerOffsetLat);
  const c2Lng = lng - kmToDegLng(centerOffsetLng, lat);

  for (let i = 0; i < halfPoints; i++) {
    // Reverse direction for the second loop
    const angle = rotationRad - (2 * Math.PI * i) / halfPoints;
    const dLat = jitter(loopRadius) * Math.cos(angle);
    const dLng = jitter(loopRadius) * Math.sin(angle);

    points.push({
      lat: c2Lat + kmToDegLat(dLat),
      lng: c2Lng + kmToDegLng(dLng, lat),
    });
  }

  return points;
}

/**
 * Generate a cloverleaf pattern (three or four petals).
 * Good for longer distances, creates an interesting multi-loop route.
 */
function generateCloverleaf(
  lat: number,
  lng: number,
  distanceKm: number,
  numPoints: number,
  rotationRad: number
): RouteWaypoint[] {
  const numPetals = distanceKm > 20 ? 4 : 3;
  // Each petal covers distance / numPetals of the total, corrected for road routing
  const petalRadius = (distanceKm / ROAD_ROUTING_FACTOR) / (numPetals * 2 * Math.PI);
  const offsetKm = petalRadius * 1.3;
  const pointsPerPetal = Math.floor(numPoints / numPetals);
  const points: RouteWaypoint[] = [];

  for (let p = 0; p < numPetals; p++) {
    const petalAngle = rotationRad + (2 * Math.PI * p) / numPetals;
    const centerLat = lat + kmToDegLat(offsetKm * Math.cos(petalAngle));
    const centerLng = lng + kmToDegLng(offsetKm * Math.sin(petalAngle), lat);

    for (let i = 0; i < pointsPerPetal; i++) {
      const angle = petalAngle + (2 * Math.PI * i) / pointsPerPetal;
      const dLat = jitter(petalRadius) * Math.cos(angle);
      const dLng = jitter(petalRadius) * Math.sin(angle);

      points.push({
        lat: centerLat + kmToDegLat(dLat),
        lng: centerLng + kmToDegLng(dLng, lat),
      });
    }

    // Add a waypoint back near center between petals to create the cloverleaf crossing
    if (p < numPetals - 1) {
      points.push({
        lat: lat + kmToDegLat(jitter(0.05, 0.5)),
        lng: lng + kmToDegLng(jitter(0.05, 0.5), lat),
      });
    }
  }

  return points;
}

/**
 * Generate route waypoints algorithmically (no AI required).
 *
 * The waypoints form geometric patterns that OSRM will snap to real roads.
 * Pattern selection: short routes get circles, medium get figure-8s, long get cloverleafs.
 */
export function generateAlgorithmicWaypoints(
  lat: number,
  lng: number,
  distanceKm: number
): RouteWaypoint[] {
  const pattern = pickPattern(distanceKm);
  const rotationRad = Math.random() * 2 * Math.PI;

  // More waypoints for longer / more complex routes
  let numPoints: number;
  switch (pattern) {
    case 'circle':
      numPoints = 8;
      break;
    case 'figure8':
      numPoints = 10;
      break;
    case 'cloverleaf':
      numPoints = 12;
      break;
  }

  let waypoints: RouteWaypoint[];

  switch (pattern) {
    case 'circle':
      waypoints = generateCircle(lat, lng, distanceKm, numPoints, rotationRad);
      break;
    case 'figure8':
      waypoints = generateFigure8(lat, lng, distanceKm, numPoints, rotationRad);
      break;
    case 'cloverleaf':
      waypoints = generateCloverleaf(lat, lng, distanceKm, numPoints, rotationRad);
      break;
  }

  // Close the route: ensure start and end are at the origin
  const start: RouteWaypoint = { lat, lng };
  waypoints = [start, ...waypoints, start];

  return waypoints;
}
