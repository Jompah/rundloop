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
      console.warn('GPS error:', err.code, err.message);
      onError(err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000,
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

export function getCurrentPosition(): Promise<GeoPosition> {
  if (fakePosition) {
    return Promise.resolve(buildFakeGeoPosition());
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        });
      },
      reject,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { 'User-Agent': 'RundLoop/1.0' } }
    );
    const data = await res.json();
    return data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0] || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Map GeolocationPositionError codes to user-facing Swedish messages.
 */
export function geoErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return 'Du behöver tillåta platsåtkomst i webbläsarens inställningar';
    case 2: // POSITION_UNAVAILABLE
      return 'Kunde inte hitta din position. Kontrollera att GPS är aktiverat.';
    case 3: // TIMEOUT
      return 'Det tog för lång tid att hitta din position. Försök igen.';
    default:
      return 'Ett okänt GPS-fel uppstod. Försök igen.';
  }
}

export { watchFilteredPosition } from './gps-filter';
