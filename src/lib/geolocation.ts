export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

// --- Fake GPS ---
let fakePosition: { lat: number; lng: number } | null = null;
let nextFakeWatchId = -1;

export function setFakePosition(lat: number, lng: number) {
  fakePosition = { lat, lng };
}

export function clearFakePosition() {
  fakePosition = null;
}

export function isFakeGPS(): boolean {
  return fakePosition !== null;
}

function buildFakeGeoPosition(): GeoPosition {
  return {
    lat: fakePosition!.lat,
    lng: fakePosition!.lng,
    accuracy: 10,
    heading: null,
    speed: null,
    timestamp: Date.now(),
  };
}

export function watchPosition(
  onUpdate: (pos: GeoPosition) => void,
  onError: (err: GeolocationPositionError) => void
): number {
  if (fakePosition) {
    onUpdate(buildFakeGeoPosition());
    const id = nextFakeWatchId--;
    return id;
  }
  return navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
      });
    },
    (err) => {
      console.warn('GPS watch error:', err.code, err.message);
      onError(err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    }
  );
}

export function clearWatch(watchId: number): void {
  if (watchId < 0) {
    // Fake watch ID — no-op
    return;
  }
  navigator.geolocation.clearWatch(watchId);
}

/**
 * Two-phase GPS acquisition for reliable mobile positioning:
 * 1. Try high accuracy (GPS hardware) with generous timeout (20s)
 * 2. If that fails with timeout/unavailable, fall back to low accuracy
 *    (WiFi/cell tower) which resolves much faster on mobile
 *
 * On iOS Safari, enableHighAccuracy:true can fail entirely if the GPS
 * chip hasn't warmed up, while low-accuracy resolves in 1-2 seconds.
 */
export function getCurrentPosition(): Promise<GeoPosition> {
  if (fakePosition) {
    return Promise.resolve(buildFakeGeoPosition());
  }

  function toGeoPosition(position: GeolocationPosition): GeoPosition {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    };
  }

  return new Promise((resolve, reject) => {
    // Phase 1: High accuracy with generous timeout
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toGeoPosition(position)),
      (highAccError) => {
        // PERMISSION_DENIED (code 1): user blocked access, no point retrying
        if (highAccError.code === 1) {
          reject(highAccError);
          return;
        }
        console.warn(
          'GPS high-accuracy failed (code %d: %s), falling back to low accuracy',
          highAccError.code,
          highAccError.message
        );
        // Phase 2: Low accuracy fallback (WiFi/cell tower positioning)
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(toGeoPosition(position)),
          (lowAccError) => {
            console.warn(
              'GPS low-accuracy also failed (code %d: %s)',
              lowAccError.code,
              lowAccError.message
            );
            reject(lowAccError);
          },
          {
            enableHighAccuracy: false,
            maximumAge: 60000, // Accept a cached position up to 1 minute old
            timeout: 15000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000, // Accept a cached position up to 10 seconds old
        timeout: 20000,    // 20 seconds for GPS hardware to get a fix
      }
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`,
      { headers: { 'User-Agent': 'Drift/1.0' } }
    );
    const data = await res.json();
    const suburb = data.address?.suburb || data.address?.neighbourhood || '';
    const city = data.address?.city || data.address?.town || data.address?.village || '';
    if (suburb && city) return `${suburb}, ${city}`;
    return city || suburb || data.display_name?.split(',')[0] || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Map GeolocationPositionError codes to user-facing messages.
 * Accepts an optional translation function for i18n support.
 */
export function geoErrorMessage(
  error: GeolocationPositionError,
  t?: (key: string, params?: Record<string, string | number>) => string
): string {
  if (t) {
    switch (error.code) {
      case 1: return t('gps.permissionDenied');
      case 2: return t('gps.positionUnavailable');
      case 3: return t('gps.timeout');
      default: return t('gps.unknownError');
    }
  }
  // Fallback English defaults (for non-React contexts)
  switch (error.code) {
    case 1: return 'Location permission denied. Enable location access in your browser settings to use GPS.';
    case 2: return 'Could not find your position. Make sure GPS is enabled.';
    case 3: return 'It took too long to find your position. Try again.';
    default: return 'An unknown GPS error occurred. Try again.';
  }
}

export { watchFilteredPosition } from './gps-filter';
