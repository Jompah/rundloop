'use client';

import { useState, useEffect } from 'react';
import { AppSettings } from '@/types';
import { getSettings, saveSettings } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface SettingsViewProps {
  onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>({ voiceEnabled: false, voiceStyle: 'concise', units: 'km', defaultDistance: 5, paceSecondsPerKm: 360, scenicMode: 'standard' });
  useEffect(() => { getSettings().then(setSettings); }, []);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="absolute inset-0 bg-gray-950 z-30 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">{t('settings.title')}</h1>
        <button
          onClick={onClose}
          className="text-gray-400 p-2 active:text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* AI info */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(34 197 94)" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{t('settings.claudeSubscription')}</p>
              <p className="text-xs text-gray-400">{t('settings.noApiKeyNeeded')}</p>
            </div>
          </div>
        </div>

        {/* Voice */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-white block">{t('settings.voiceNavigation')}</label>
            <p className="text-xs text-gray-500">{t('settings.voiceNavigationHint')}</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, voiceEnabled: !settings.voiceEnabled })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.voiceEnabled ? 'bg-green-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                settings.voiceEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Voice Style */}
        {settings.voiceEnabled && (
          <div>
            <label className="text-sm font-medium text-gray-400 block mb-2">{t('settings.voiceStyle')}</label>
            <div className="flex flex-col gap-2">
              {([
                { value: 'concise' as const, label: t('settings.voiceConcise'), example: t('settings.voiceConciseExample') },
                { value: 'with-pace' as const, label: t('settings.voiceWithPace'), example: t('settings.voiceWithPaceExample') },
                { value: 'motivational' as const, label: t('settings.voiceMotivational'), example: t('settings.voiceMotivationalExample') },
              ]).map((style) => (
                <button
                  key={style.value}
                  onClick={() => setSettings({ ...settings, voiceStyle: style.value })}
                  className={`w-full min-h-[44px] py-3 px-4 rounded-xl text-left transition-colors ${
                    settings.voiceStyle === style.value
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-800 text-gray-300 active:bg-gray-700'
                  }`}
                >
                  <span className="text-sm font-semibold block">{style.label}</span>
                  <span className={`text-xs block mt-0.5 ${
                    settings.voiceStyle === style.value ? 'text-green-100' : 'text-gray-400'
                  }`}>{style.example}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Units */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">{t('settings.units')}</label>
          <div className="flex gap-2">
            {(['km', 'miles'] as const).map((unit) => (
              <button
                key={unit}
                onClick={() => setSettings({ ...settings, units: unit })}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  settings.units === unit
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-300 active:bg-gray-700'
                }`}
              >
                {unit === 'km' ? t('settings.kilometers') : t('settings.miles')}
              </button>
            ))}
          </div>
        </div>

        {/* Default Distance */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">
            {t('settings.defaultDistance', { distance: settings.defaultDistance })}
          </label>
          <input
            type="range"
            min={1}
            max={30}
            step={0.5}
            value={settings.defaultDistance}
            onChange={(e) => setSettings({ ...settings, defaultDistance: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

        {/* Running Pace */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">
            {t('settings.runningPace')}
          </label>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                type="number"
                min={1}
                max={15}
                placeholder="6"
                value={Math.floor((settings.paceSecondsPerKm ?? 360) / 60)}
                onChange={(e) => {
                  const mins = parseInt(e.target.value) || 0;
                  const secs = (settings.paceSecondsPerKm ?? 360) % 60;
                  setSettings({ ...settings, paceSecondsPerKm: mins * 60 + secs });
                }}
                className="bg-gray-800 text-white rounded-lg px-4 py-3 w-full pr-14"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">min</span>
            </div>
            <span className="text-gray-400 text-lg font-bold">:</span>
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={59}
                placeholder="00"
                value={String((settings.paceSecondsPerKm ?? 360) % 60).padStart(2, '0')}
                onChange={(e) => {
                  const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                  const mins = Math.floor((settings.paceSecondsPerKm ?? 360) / 60);
                  setSettings({ ...settings, paceSecondsPerKm: mins * 60 + secs });
                }}
                className="bg-gray-800 text-white rounded-lg px-4 py-3 w-full pr-14"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">sec</span>
            </div>
            <span className="text-gray-400 text-sm whitespace-nowrap">/km</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('settings.paceHint')}
          </p>
        </div>

        {/* Body Weight */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">
            {t('settings.bodyWeight')}
          </label>
          <div className="relative">
            <input
              type="number"
              min={30}
              max={300}
              placeholder={settings.units === 'miles' ? '154' : '70'}
              value={
                settings.bodyWeightKg != null
                  ? settings.units === 'miles'
                    ? Math.round(settings.bodyWeightKg * 2.20462)
                    : settings.bodyWeightKg
                  : ''
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setSettings({ ...settings, bodyWeightKg: undefined });
                  return;
                }
                const val = parseFloat(raw);
                if (isNaN(val)) return;
                const kg = settings.units === 'miles' ? val / 2.20462 : val;
                setSettings({ ...settings, bodyWeightKg: Math.round(kg) });
              }}
              className="bg-gray-800 text-white rounded-lg px-4 py-3 w-full pr-14"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {settings.units === 'miles' ? 'lbs' : 'kg'}
            </span>
          </div>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">{t('settings.language')}</label>
          <LanguageSwitcher />
        </div>

        {/* Save button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSave}
        >
          {saved ? t('settings.saved') : t('settings.save')}
        </Button>

        {/* App info */}
        <div className="text-center text-xs text-gray-600 pt-4">
          Drift v0.1.0
        </div>
      </div>
    </div>
  );
}
