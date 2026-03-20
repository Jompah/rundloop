export type HapticPattern = 'tap' | 'success' | 'milestone' | 'warning';

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 50,
  success: [50, 50, 50],
  milestone: [100, 50, 100],
  warning: [100, 50, 100, 50, 100],
};

export function haptic(pattern: HapticPattern): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(patterns[pattern]);
  }
}
