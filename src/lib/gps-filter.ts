import { GeoPosition } from './geolocation';
import { FilteredPosition } from '@/types';
import { watchPosition } from './geolocation';

export type FilterRejectionReason = 'accuracy' | 'jitter' | 'teleport';

/**
 * Haversine distance between two points in meters.
 * Inline copy -- canonical until storage.ts exports it.
 */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Pure function: decides whether to accept or reject a GPS position.
 */
export function shouldAcceptPosition(
  newPos: GeoPosition,
  lastAccepted: FilteredPosition | null
): { accepted: boolean; reason?: FilterRejectionReason } {
  // Accuracy gate: reject if GPS uncertainty > 30m
  if (newPos.accuracy > 30) {
    return { accepted: false, reason: 'accuracy' };
  }

  // First accepted point -- no previous to compare
  if (!lastAccepted) {
    return { accepted: true };
  }

  // Distance delta
  const distance = haversineMeters(
    lastAccepted.lat,
    lastAccepted.lng,
    newPos.lat,
    newPos.lng
  );

  // Jitter gate: reject if moved < 3m (GPS noise)
  if (distance < 3) {
    return { accepted: false, reason: 'jitter' };
  }

  // Teleport gate: reject if implied speed > 45 km/h (12.5 m/s)
  const timeDeltaSec = (newPos.timestamp - lastAccepted.timestamp) / 1000;
  if (timeDeltaSec > 0) {
    const speedMs = distance / timeDeltaSec;
    if (speedMs > 12.5) {
      return { accepted: false, reason: 'teleport' };
    }
  }

  return { accepted: true };
}

/**
 * Stateful wrapper: watches GPS positions and filters them through
 * shouldAcceptPosition before passing to consumers.
 */
export function watchFilteredPosition(
  onAccepted: (pos: FilteredPosition) => void,
  onRejected: (pos: GeoPosition, reason: FilterRejectionReason) => void,
  onError: (err: GeolocationPositionError) => void
): number {
  let lastAccepted: FilteredPosition | null = null;

  return watchPosition(
    (pos: GeoPosition) => {
      const result = shouldAcceptPosition(pos, lastAccepted);

      if (!result.accepted) {
        onRejected(pos, result.reason!);
        return;
      }

      const filtered: FilteredPosition = {
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        timestamp: pos.timestamp,
        speed: pos.speed,
      };
      lastAccepted = filtered;
      onAccepted(filtered);
    },
    onError
  );
}
