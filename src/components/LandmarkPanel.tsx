'use client';

import type { Landmark } from '@/lib/overpass';
import { useTranslation } from '@/i18n';

const LANDMARK_ICONS: Record<string, string> = {
  museum: '\uD83C\uDFDB\uFE0F',
  monument: '\uD83D\uDDFF',
  viewpoint: '\uD83D\uDC41\uFE0F',
  park: '\uD83C\uDF33',
  church: '\u26EA',
  historic: '\uD83C\uDFF0',
  artwork: '\uD83C\uDFA8',
  fountain: '\u26F2',
  ruins: '\uD83C\uDFDA\uFE0F',
  castle: '\uD83C\uDFF0',
  landmark: '\uD83D\uDCCD',
};

interface Props {
  landmarks: Landmark[];
  onLandmarkClick?: (landmark: Landmark) => void;
}

export default function LandmarkPanel({ landmarks, onLandmarkClick }: Props) {
  const { t } = useTranslation();
  if (!landmarks || landmarks.length === 0) return null;

  return (
    <div className="bg-gray-900/80 backdrop-blur rounded-xl p-3 mt-3">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">
        {t('landmarks.title', { count: landmarks.length })}
      </h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {landmarks.map((lm) => (
          <button
            key={lm.id}
            onClick={() => onLandmarkClick?.(lm)}
            className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <span className="text-lg flex-shrink-0">
              {LANDMARK_ICONS[lm.type] || '\uD83D\uDCCD'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{lm.name}</p>
              {lm.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{lm.description}</p>
              )}
              {lm.distance !== undefined && (
                <p className="text-xs text-gray-500">{t('landmarks.fromRoute', { distance: Math.round(lm.distance) })}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
