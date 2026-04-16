'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n';

interface AuthModalProps {
  onSignIn: (email: string) => Promise<{ error: unknown }>;
  onSkip: () => void;
}

export default function AuthModal({ onSignIn, onSkip }: AuthModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError(false);

    const { error: err } = await onSignIn(email.trim());
    setSending(false);

    if (err) {
      setError(true);
    } else {
      setSent(true);
    }
  };

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
        {sent ? (
          <>
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">✉️</div>
              <h2 className="text-white text-xl font-bold">{t('auth.checkEmail')}</h2>
              <p className="text-gray-400 mt-2">
                {t('auth.checkEmailHint').replace('{email}', email)}
              </p>
            </div>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => { setSent(false); setEmail(''); }}
            >
              {t('auth.tryAgain')}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-white text-xl font-bold">{t('auth.title')}</h2>
            <p className="text-gray-400 mt-1 mb-5">{t('auth.subtitle')}</p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500"
              />
              {error && (
                <p className="text-red-400 text-sm mb-3">{t('auth.error')}</p>
              )}
              <Button
                type="submit"
                fullWidth
                disabled={!email.trim() || sending}
              >
                {sending ? t('auth.sending') : t('auth.sendLink')}
              </Button>
            </form>

            <button
              type="button"
              className="w-full text-gray-500 text-sm mt-4 py-2 min-h-[44px]"
              onClick={onSkip}
            >
              {t('auth.skipForNow')}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
