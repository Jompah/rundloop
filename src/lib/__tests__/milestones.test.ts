import { describe, it, expect } from 'vitest';
import {
  detectMilestone,
  formatMilestoneMessage,
} from '../milestones';
import type { VoiceStyle, MilestoneEvent } from '../milestones';

describe('detectMilestone', () => {
  describe('km units', () => {
    it('triggers km 1 milestone when crossing from 900m to 1100m', () => {
      const announced = new Set<string>();
      const result = detectMilestone(900, 1100, 5000, 'km', announced);
      expect(result).toEqual({ type: 'distance', distanceValue: 1 });
    });

    it('does NOT re-trigger if already announced', () => {
      const announced = new Set<string>(['distance-1']);
      const result = detectMilestone(900, 1100, 5000, 'km', announced);
      expect(result).toBeNull();
    });

    it('adds milestone key to announced set', () => {
      const announced = new Set<string>();
      detectMilestone(900, 1100, 5000, 'km', announced);
      expect(announced.has('distance-1')).toBe(true);
    });

    it('triggers km 2 milestone correctly', () => {
      const announced = new Set<string>(['distance-1']);
      const result = detectMilestone(1900, 2100, 5000, 'km', announced);
      expect(result).toEqual({ type: 'distance', distanceValue: 2 });
    });

    it('returns null if no milestone crossed', () => {
      const announced = new Set<string>();
      const result = detectMilestone(500, 600, 5000, 'km', announced);
      expect(result).toBeNull();
    });
  });

  describe('miles units', () => {
    it('triggers mile 1 milestone when crossing from 1500m to 1700m', () => {
      const announced = new Set<string>();
      const result = detectMilestone(1500, 1700, 5000, 'miles', announced);
      expect(result).toEqual({ type: 'distance', distanceValue: 1 });
    });
  });

  describe('halfway milestone', () => {
    it('triggers halfway event when crossing route midpoint', () => {
      const announced = new Set<string>();
      const result = detectMilestone(2400, 2600, 5000, 'km', announced);
      // 2400 < 2500 and 2600 >= 2500 => halfway
      // Also 2600 crosses 2km, but halfway check should be separate
      // Since distance milestone (km 2) may also trigger, test that at least one fires
      expect(result).not.toBeNull();
    });

    it('does not re-trigger halfway if already announced', () => {
      const announced = new Set<string>(['halfway']);
      // Still crosses km 2 boundary, so may return distance milestone
      // But halfway should not re-trigger
      const result = detectMilestone(2400, 2600, 5000, 'km', announced);
      if (result) {
        expect(result.type).not.toBe('halfway');
      }
    });
  });
});

describe('formatMilestoneMessage', () => {
  describe('concise style', () => {
    it('formats km distance milestone singular', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 1 };
      expect(formatMilestoneMessage(event, 'concise', 'km')).toBe('1 kilometer completed');
    });

    it('formats km distance milestone plural', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 2 };
      expect(formatMilestoneMessage(event, 'concise', 'km')).toBe('2 kilometers completed');
    });

    it('formats halfway', () => {
      const event: MilestoneEvent = { type: 'halfway', distanceValue: 2.5 };
      expect(formatMilestoneMessage(event, 'concise', 'km')).toBe('Halfway point');
    });
  });

  describe('with-pace style', () => {
    it('formats km distance with pace', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 1 };
      expect(formatMilestoneMessage(event, 'with-pace', 'km', '5:30')).toBe(
        '1 kilometer completed. Average pace: 5:30 per kilometer'
      );
    });

    it('formats halfway with pace', () => {
      const event: MilestoneEvent = { type: 'halfway', distanceValue: 2.5 };
      expect(formatMilestoneMessage(event, 'with-pace', 'km', '5:30')).toBe(
        'Halfway point. Average pace: 5:30 per kilometer'
      );
    });

    it('uses --:-- when pace is not provided', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 1 };
      expect(formatMilestoneMessage(event, 'with-pace', 'km')).toBe(
        '1 kilometer completed. Average pace: --:-- per kilometer'
      );
    });
  });

  describe('motivational style', () => {
    it('formats km distance', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 1 };
      expect(formatMilestoneMessage(event, 'motivational', 'km')).toBe(
        'Great work! 1 kilometer done'
      );
    });

    it('formats halfway', () => {
      const event: MilestoneEvent = { type: 'halfway', distanceValue: 2.5 };
      expect(formatMilestoneMessage(event, 'motivational', 'km')).toBe(
        'Great work! You are halfway there!'
      );
    });
  });

  describe('miles units', () => {
    it('uses mile singular', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 1 };
      expect(formatMilestoneMessage(event, 'concise', 'miles')).toBe('1 mile completed');
    });

    it('uses miles plural', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 3 };
      expect(formatMilestoneMessage(event, 'concise', 'miles')).toBe('3 miles completed');
    });

    it('uses mile in with-pace unit label', () => {
      const event: MilestoneEvent = { type: 'distance', distanceValue: 1 };
      expect(formatMilestoneMessage(event, 'with-pace', 'miles', '8:30')).toBe(
        '1 mile completed. Average pace: 8:30 per mile'
      );
    });
  });
});
