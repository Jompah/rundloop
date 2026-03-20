'use client';

import { useEffect } from 'react';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  return (
    <>
      <OfflineBanner />
      {children}
    </>
  );
}
