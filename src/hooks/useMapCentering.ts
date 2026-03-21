'use client';

import { useReducer, useEffect } from 'react';
import { dbGet } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CenteringMode =
  | 'initializing'
  | 'centered'
  | 'free-pan'
  | 'navigating';

export type CenteringAction =
  | { type: 'GPS_LOCK'; position: [number, number] }
  | { type: 'USER_PAN' }
  | { type: 'RECENTER' }
  | { type: 'START_NAVIGATION' }
  | { type: 'STOP_NAVIGATION' }
  | { type: 'GPS_UPDATE'; position: [number, number] };

export interface CenteringState {
  mode: CenteringMode;
  userPosition: [number, number] | null;
  lastStoredPosition: [number, number] | null;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: CenteringState = {
  mode: 'initializing',
  userPosition: null,
  lastStoredPosition: null,
};

// ---------------------------------------------------------------------------
// Pure reducer (exported for testing)
// ---------------------------------------------------------------------------

export function centeringReducer(
  state: CenteringState,
  action: CenteringAction,
): CenteringState {
  switch (action.type) {
    case 'GPS_LOCK':
      return { ...state, mode: 'centered', userPosition: action.position };

    case 'USER_PAN':
      if (state.mode === 'initializing') return state;
      return { ...state, mode: 'free-pan' };

    case 'RECENTER':
      return { ...state, mode: 'centered' };

    case 'START_NAVIGATION':
      return { ...state, mode: 'navigating' };

    case 'STOP_NAVIGATION':
      return { ...state, mode: 'centered' };

    case 'GPS_UPDATE':
      return { ...state, userPosition: action.position };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface StoredPosition {
  key: string;
  lng: number;
  lat: number;
  timestamp: number;
}

export function useMapCentering() {
  const [state, dispatch] = useReducer(centeringReducer, initialState);

  // Load last-known position from IndexedDB on mount
  useEffect(() => {
    dbGet<StoredPosition>('settings', 'lastPosition')
      .then((stored) => {
        if (stored && Date.now() - stored.timestamp < 24 * 60 * 60 * 1000) {
          // Use GPS_UPDATE (not GPS_LOCK) -- this is stored, not live
          dispatch({
            type: 'GPS_UPDATE',
            position: [stored.lng, stored.lat],
          });
        }
      })
      .catch(() => {
        /* no stored position, map starts at world view */
      });
  }, []);

  return { state, dispatch };
}
