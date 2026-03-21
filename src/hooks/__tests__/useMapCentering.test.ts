import { describe, it, expect } from 'vitest';
import { centeringReducer, CenteringState } from '../useMapCentering';

const INITIAL_STATE: CenteringState = {
  mode: 'initializing',
  userPosition: null,
  lastStoredPosition: null,
};

describe('centeringReducer', () => {
  describe('GPS_LOCK transition', () => {
    it('transitions from initializing to centered with position', () => {
      const result = centeringReducer(INITIAL_STATE, {
        type: 'GPS_LOCK',
        position: [18.07, 59.33],
      });
      expect(result.mode).toBe('centered');
      expect(result.userPosition).toEqual([18.07, 59.33]);
    });
  });

  describe('USER_PAN transition', () => {
    it('transitions from centered to free-pan', () => {
      const centeredState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'centered',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(centeredState, { type: 'USER_PAN' });
      expect(result.mode).toBe('free-pan');
      expect(result.userPosition).toEqual([18.07, 59.33]);
    });

    it('ignores USER_PAN in initializing state', () => {
      const result = centeringReducer(INITIAL_STATE, { type: 'USER_PAN' });
      expect(result).toBe(INITIAL_STATE);
      expect(result.mode).toBe('initializing');
    });

    it('transitions from navigating to free-pan', () => {
      const navigatingState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'navigating',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(navigatingState, { type: 'USER_PAN' });
      expect(result.mode).toBe('free-pan');
    });
  });

  describe('RECENTER transition', () => {
    it('transitions from free-pan to centered', () => {
      const freePanState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'free-pan',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(freePanState, { type: 'RECENTER' });
      expect(result.mode).toBe('centered');
    });
  });

  describe('NAVIGATION transitions', () => {
    it('START_NAVIGATION from centered -> navigating', () => {
      const centeredState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'centered',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(centeredState, {
        type: 'START_NAVIGATION',
      });
      expect(result.mode).toBe('navigating');
    });

    it('START_NAVIGATION from free-pan -> navigating', () => {
      const freePanState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'free-pan',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(freePanState, {
        type: 'START_NAVIGATION',
      });
      expect(result.mode).toBe('navigating');
    });

    it('STOP_NAVIGATION -> centered', () => {
      const navigatingState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'navigating',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(navigatingState, {
        type: 'STOP_NAVIGATION',
      });
      expect(result.mode).toBe('centered');
    });
  });

  describe('GPS_UPDATE', () => {
    it('updates position without changing mode in free-pan', () => {
      const freePanState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'free-pan',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(freePanState, {
        type: 'GPS_UPDATE',
        position: [18.08, 59.34],
      });
      expect(result.mode).toBe('free-pan');
      expect(result.userPosition).toEqual([18.08, 59.34]);
    });

    it('updates position in centered mode without changing mode', () => {
      const centeredState: CenteringState = {
        ...INITIAL_STATE,
        mode: 'centered',
        userPosition: [18.07, 59.33],
      };
      const result = centeringReducer(centeredState, {
        type: 'GPS_UPDATE',
        position: [18.08, 59.34],
      });
      expect(result.mode).toBe('centered');
      expect(result.userPosition).toEqual([18.08, 59.34]);
    });
  });
});
