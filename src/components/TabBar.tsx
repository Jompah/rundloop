'use client';

import { useTranslation } from '@/i18n';

interface TabBarProps {
  activeTab: 'generate' | 'history' | 'routes' | 'stats';
  onTabChange: (tab: 'generate' | 'history' | 'routes' | 'stats') => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { t } = useTranslation();
  const tabs: { value: 'generate' | 'history' | 'routes' | 'stats'; label: string; icon: React.ReactNode }[] = [
    {
      value: 'generate',
      label: t('tab.map'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      ),
    },
    {
      value: 'history',
      label: t('tab.history'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      value: 'stats',
      label: t('tab.stats'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 16l4-8 4 4 5-9" />
        </svg>
      ),
    },
    {
      value: 'routes',
      label: t('tab.routes'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3v12" />
          <path d="M18 9v12" />
          <path d="M6 15c0 0 3-3 6-3s6 3 6 3" />
          <circle cx="6" cy="3" r="2" />
          <circle cx="18" cy="21" r="2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-gray-900 border-t border-gray-700 pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[44px] ${
              activeTab === tab.value ? 'text-green-400' : 'text-gray-500'
            }`}
            onClick={() => onTabChange(tab.value)}
          >
            {tab.icon}
            <span className="text-xs mt-1">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
