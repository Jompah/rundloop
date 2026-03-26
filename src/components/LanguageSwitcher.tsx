'use client';

import { useTranslation, type Locale } from '@/i18n';

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'sv', label: 'SV' },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex bg-gray-800 rounded-lg overflow-hidden">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLocale(lang.code)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
            locale === lang.code
              ? 'bg-green-500 text-white'
              : 'text-gray-400 active:bg-gray-700'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
