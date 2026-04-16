'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { RouteThumbnail } from './RouteThumbnail';
import type { SavedRoute } from '@/lib/storage';

interface PreviousRoutesDialogProps {
  open: boolean;
  candidates: SavedRoute[];
  targetKm: number;
  onSelectRoute: (route: SavedRoute) => void;
  onGenerateSimilar: () => void;
  onClose: () => void;
}

function formatLastRun(value: string | number | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export function PreviousRoutesDialog({
  open,
  candidates,
  targetKm,
  onSelectRoute,
  onGenerateSimilar,
  onClose,
}: PreviousRoutesDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const count = candidates.length;
  const subtitle = `Vi hittade ${count} ${count === 1 ? 'runda' : 'rundor'} runt ${targetKm} km från samma startpunkt.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Stäng"
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-800 min-h-[44px] min-w-[44px]"
        >
          <span className="text-xl leading-none">×</span>
        </button>

        <div className="p-6 pb-3">
          <h2 className="text-white text-xl font-bold pr-8">Tidigare rundor härifrån</h2>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {candidates.map((route) => {
            const distanceKm = (route.route.distance / 1000).toFixed(2);
            const lastRun = formatLastRun(route.lastRunAt);
            const timesRun = route.timesRun ?? 0;
            const points = route.route.polyline.map(([lng, lat]) => ({ lat, lng }));
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelectRoute(route)}
                className="mb-3 bg-gray-800 rounded-2xl p-3 flex items-center gap-4 active:bg-gray-700 w-full text-left min-h-[44px]"
              >
                <RouteThumbnail points={points} size={72} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-lg font-bold">{distanceKm} km</p>
                  {lastRun && (
                    <p className="text-gray-400 text-sm">{lastRun}</p>
                  )}
                  {timesRun > 1 && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-gray-700 text-gray-200 text-xs font-medium">
                      {timesRun} ggr
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-800 p-4">
          <Button variant="secondary" fullWidth onClick={onGenerateSimilar}>
            Generera ny liknande rutt
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PreviousRoutesDialog;
