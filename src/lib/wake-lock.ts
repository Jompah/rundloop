let wakeLock: WakeLockSentinel | null = null;

/**
 * Check if the Wake Lock API is supported in the current environment.
 */
export function isWakeLockSupported(): boolean {
  return typeof window !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Acquire a screen wake lock to prevent the display from sleeping.
 * Returns true on success, false if unsupported or if the request fails.
 */
export async function acquireWakeLock(): Promise<boolean> {
  if (!isWakeLockSupported()) return false;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Release the current wake lock, if any.
 */
export function releaseWakeLock(): void {
  wakeLock?.release();
  wakeLock = null;
}

/**
 * Set up automatic wake lock re-acquisition when the page becomes visible.
 * Returns a cleanup function that removes the event listener.
 */
export function setupVisibilityReacquire(): () => void {
  const handler = async () => {
    if (document.visibilityState === 'visible' && !wakeLock) {
      await acquireWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
