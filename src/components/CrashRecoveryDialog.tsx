'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import type { ActiveRunSnapshot } from '@/types';

interface CrashRecoveryDialogProps {
  snapshot: ActiveRunSnapshot;
  onResume: () => void;
  onDiscard: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function computeSnapshotDistance(trace: ActiveRunSnapshot['trace']): number {
  if (trace.length < 2) return 0;
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < trace.length; i++) {
    const dLat = toRad(trace[i].lat - trace[i - 1].lat);
    const dLng = toRad(trace[i].lng - trace[i - 1].lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(trace[i - 1].lat)) *
        Math.cos(toRad(trace[i].lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
}

export default function CrashRecoveryDialog({ snapshot, onResume, onDiscard }: CrashRecoveryDialogProps) {
  const distanceKm = (computeSnapshotDistance(snapshot.trace) / 1000).toFixed(1);
  const elapsed = formatElapsed(snapshot.elapsedMs);
  const started = new Date(snapshot.startTime).toLocaleString();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <h2 className="text-white text-xl font-bold">Unfinished Run Found</h2>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-white font-bold text-lg">{distanceKm} km</div>
            <div className="text-gray-500 text-xs">Distance</div>
          </div>
          <div>
            <div className="text-white font-bold text-lg">{elapsed}</div>
            <div className="text-gray-500 text-xs">Time</div>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">{started}</div>
            <div className="text-gray-500 text-xs">Started</div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" fullWidth onClick={onDiscard}>Discard</Button>
          <Button variant="primary" fullWidth onClick={onResume}>Resume Run</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
