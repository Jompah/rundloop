/**
 * Milestone detection and message formatting.
 * Pure functions for distance milestones and voice announcements.
 */

export type VoiceStyle = 'concise' | 'with-pace' | 'motivational';

export interface MilestoneEvent {
  type: 'distance' | 'halfway';
  distanceValue: number;
}

/**
 * Detect if a milestone was crossed between previous and current distance.
 * Mutates announcedMilestones set to track what has been announced.
 * Returns the milestone event or null if none crossed.
 */
export function detectMilestone(
  prevDistanceMeters: number,
  currentDistanceMeters: number,
  routeDistanceMeters: number,
  units: 'km' | 'miles',
  announcedMilestones: Set<string>
): MilestoneEvent | null {
  const divisor = units === 'miles' ? 1609.34 : 1000;

  // Check whole km/mile milestone
  const prevUnits = Math.floor(prevDistanceMeters / divisor);
  const currentUnits = Math.floor(currentDistanceMeters / divisor);

  if (currentUnits > prevUnits && currentUnits > 0) {
    const key = `distance-${currentUnits}`;
    if (!announcedMilestones.has(key)) {
      announcedMilestones.add(key);
      return { type: 'distance', distanceValue: currentUnits };
    }
  }

  // Check halfway milestone
  const halfwayKey = 'halfway';
  if (
    !announcedMilestones.has(halfwayKey) &&
    routeDistanceMeters > 0 &&
    prevDistanceMeters < routeDistanceMeters / 2 &&
    currentDistanceMeters >= routeDistanceMeters / 2
  ) {
    announcedMilestones.add(halfwayKey);
    return { type: 'halfway', distanceValue: currentDistanceMeters / divisor };
  }

  return null;
}

/**
 * Format a milestone event into a voice announcement string.
 */
export function formatMilestoneMessage(
  event: MilestoneEvent,
  style: VoiceStyle,
  units: 'km' | 'miles',
  avgPaceFormatted?: string
): string {
  const unitLabel = units === 'miles' ? 'mile' : 'kilometer';
  const plural = event.distanceValue !== 1 ? 's' : '';

  if (event.type === 'halfway') {
    switch (style) {
      case 'concise':
        return 'Halfway point';
      case 'with-pace':
        return `Halfway point. Average pace: ${avgPaceFormatted ?? '--:--'} per ${unitLabel}`;
      case 'motivational':
        return 'Great work! You are halfway there!';
    }
  }

  switch (style) {
    case 'concise':
      return `${event.distanceValue} ${unitLabel}${plural} completed`;
    case 'with-pace':
      return `${event.distanceValue} ${unitLabel}${plural} completed. Average pace: ${avgPaceFormatted ?? '--:--'} per ${unitLabel}`;
    case 'motivational':
      return `Great work! ${event.distanceValue} ${unitLabel}${plural} done`;
  }
}
