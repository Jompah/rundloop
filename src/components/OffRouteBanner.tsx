'use client';

interface OffRouteBannerProps {
  visible: boolean;
  direction: string;
}

export default function OffRouteBanner({ visible, direction }: OffRouteBannerProps) {
  return (
    <div
      className={`overflow-hidden transition-all duration-200 ${
        visible
          ? 'max-h-24 opacity-100 translate-y-0'
          : 'max-h-0 opacity-0 -translate-y-full'
      }`}
    >
      <div className="bg-amber-500/20 backdrop-blur-sm border-y border-amber-500/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <div className="text-sm font-semibold text-white">Off route</div>
            <div className="text-xs text-amber-200">Head {direction} to rejoin</div>
          </div>
        </div>
      </div>
    </div>
  );
}
