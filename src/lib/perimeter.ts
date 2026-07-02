/**
 * Perimeter loop library.
 *
 * Pure TypeScript helpers (no external deps, no side effects) for turning
 * PerimeterRing candidates (island outlines or waterfront rings from
 * ring-assembly) into a runnable loop:
 *  - picking the ring whose predicted loop distance best matches the
 *    requested distance
 *  - building routing waypoints evenly sampled around the ring, starting
 *    and ending at the user's position
 *
 * All math uses haversine for distances — accurate enough at city scale.
 */

import { RouteWaypoint } from '@/types';
import type { PerimeterRing } from './ring-assembly';
import { haversineM } from './scenic';

/**
 * Vägnätet viker av något från strandlinjen, så den faktiska rundan blir
 * längre än ringens omkrets.
 */
const ROAD_NETWORK_FACTOR = 1.05;

/** Tillåtet fönster för predikterad runddistans relativt önskad distans. */
const MIN_DISTANCE_RATIO = 0.8;
const MAX_DISTANCE_RATIO = 1.2;

/** Max anslutningsavstånd (m) från start till ringens närmaste punkt. */
const MAX_CONNECTION_M = 1200;

/** Straff per meter anslutning — litet, bryter främst lika-lägen. */
const CONNECTION_PENALTY_PER_M = 1 / 10000;

/**
 * Predikterad total runddistans (km) för en ring: omkretsen uppskalad för
 * vägnätets avvikelser plus anslutningen till ringen tur och retur.
 */
function predictedLoopKm(ring: PerimeterRing): number {
  return ring.perimeterKm * ROAD_NETWORK_FACTOR + (2 * ring.distanceM) / 1000;
}

/**
 * Väljer den ring vars predikterade runddistans bäst matchar distanceKm.
 * Ringar med predikterad distans utanför [0.8, 1.2] × distanceKm eller med
 * anslutning längre än 1200 m diskvalificeras. Poängen domineras av närhet
 * till måldistansen; ett litet anslutningsstraff bryter lika-lägen till
 * förmån för ringen närmast användaren. null om ingen ring kvalar.
 */
export function pickBestRing(
  rings: PerimeterRing[],
  distanceKm: number
): PerimeterRing | null {
  if (distanceKm <= 0) return null;

  let best: PerimeterRing | null = null;
  let bestScore = -Infinity;
  for (const ring of rings) {
    if (ring.distanceM > MAX_CONNECTION_M) continue;
    const predictedKm = predictedLoopKm(ring);
    if (predictedKm < MIN_DISTANCE_RATIO * distanceKm) continue;
    if (predictedKm > MAX_DISTANCE_RATIO * distanceKm) continue;

    const score =
      1 -
      Math.abs(predictedKm - distanceKm) / distanceKm -
      ring.distanceM * CONNECTION_PENALTY_PER_M;
    if (score > bestScore) {
      bestScore = score;
      best = ring;
    }
  }
  return best;
}

/**
 * Waypoints för en runda runt en ring: [start, ...punkter jämnt fördelade
 * längs ringen, start] — samma struktur som buildCorridorWaypoints.
 *
 * Ringen roteras så att den börjar vid outline-punkten närmast start, och
 * upp till maxIntermediates punkter samplas jämnt över kumulativ båglängd
 * (inklusive slutsegmentet tillbaka till rotationspunkten). Rotationspunkten
 * är alltid första ringpunkten; sista samplade punkten hamnar en jämn
 * delsträcka FÖRE rotationspunkten — rundan sluts via start, inte genom att
 * upprepa första ringpunkten. Max 14 intermediates som default (Google
 * Routes-gräns med marginal).
 */
export function buildPerimeterWaypoints(
  ring: PerimeterRing,
  startLat: number,
  startLng: number,
  maxIntermediates: number = 14
): RouteWaypoint[] {
  const start: RouteWaypoint = { lat: startLat, lng: startLng, label: 'Start' };
  const finish: RouteWaypoint = { lat: startLat, lng: startLng, label: 'Finish' };
  const outline = ring.outline;
  if (outline.length === 0) return [start, finish];

  // Rotate the ring to begin at the outline point nearest the start.
  let nearestIdx = 0;
  let nearestD = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const d = haversineM(startLat, startLng, outline[i].lat, outline[i].lng);
    if (d < nearestD) {
      nearestD = d;
      nearestIdx = i;
    }
  }
  const rotated = [...outline.slice(nearestIdx), ...outline.slice(0, nearestIdx)];

  // Cumulative arc length around the ring, incl. the closing segment
  // rotated[n-1] → rotated[0]. cum[i] = meters from rotated[0] to vertex i.
  const n = rotated.length;
  const cum: number[] = [0];
  for (let i = 0; i < n; i++) {
    const a = rotated[i];
    const b = rotated[(i + 1) % n];
    cum.push(cum[i] + haversineM(a.lat, a.lng, b.lat, b.lng));
  }
  const totalM = cum[n];

  const count = Math.max(1, Math.min(maxIntermediates, n));
  if (totalM <= 0 || count === 1) {
    const only: RouteWaypoint = { lat: rotated[0].lat, lng: rotated[0].lng };
    if (ring.name) only.label = ring.name;
    return [start, only, finish];
  }

  // Sample `count` points evenly by arc length: targets k * totalM / count,
  // k = 0..count-1. k=0 is exactly the rotation point; the last target lands
  // (count-1)/count around the loop, never back on the first point.
  const samples: RouteWaypoint[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const s = (k * totalM) / count;
    while (seg < n - 1 && cum[seg + 1] <= s) seg++;
    const a = rotated[seg];
    const b = rotated[(seg + 1) % n];
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > 0 ? (s - cum[seg]) / segLen : 0;
    samples.push({
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    });
  }
  if (ring.name) samples[0].label = ring.name;

  return [start, ...samples, finish];
}
