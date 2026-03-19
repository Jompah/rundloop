'use client';

import { useState, useEffect } from 'react';
import { AppSettings } from '@/types';
import { getSettings, saveSettings } from '@/lib/storage';

interface SettingsViewProps {
  onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
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
        <h1 className="text-xl font-bold text-white">Settings</h1>
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
        {/* AI Provider */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">AI Provider</label>
          <div className="flex gap-2">
            {(['claude', 'perplexity'] as const).map((provider) => (
              <button
                key={provider}
                onClick={() => setSettings({ ...settings, apiProvider: provider })}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  settings.apiProvider === provider
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-300 active:bg-gray-700'
                }`}
              >
                {provider === 'claude' ? 'Claude' : 'Perplexity'}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">
            {settings.apiProvider === 'claude' ? 'Anthropic API Key' : 'Perplexity API Key'}
          </label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            placeholder={settings.apiProvider === 'claude' ? 'sk-ant-...' : 'pplx-...'}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-green-500 focus:outline-none text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your key is stored locally on this device only.
          </p>
        </div>

        {/* Voice */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-white block">Voice Navigation</label>
            <p className="text-xs text-gray-500">Read turn instructions aloud</p>
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

        {/* Units */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">Units</label>
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
                {unit === 'km' ? 'Kilometers' : 'Miles'}
              </button>
            ))}
          </div>
        </div>

        {/* Default Distance */}
        <div>
          <label className="text-sm font-medium text-gray-400 block mb-2">
            Default Distance: {settings.defaultDistance} km
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

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-green-500 text-white active:bg-green-600'
          }`}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>

        {/* App info */}
        <div className="text-center text-xs text-gray-600 pt-4">
          RundLoop v0.1.0
        </div>
      </div>
    </div>
  );
}
