'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n';

interface AuthModalProps {
  onSignIn: (email: string) => Promise<{ error: unknown }>;
  onVerifyOtp: (email: string, token: string) => Promise<{ error: unknown }>;
  onSkip: () => void;
  authError?: boolean;
}

export default function AuthModal({ onSignIn, onVerifyOtp, onSkip, authError }: AuthModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(authError ? t('auth.magicLinkError') : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setErrorMsg(null);

    const { error: err } = await onSignIn(email.trim());
    setSending(false);

    if (err) {
      const msg = (err as { message?: string })?.message ?? t('auth.error');
      setErrorMsg(msg.includes('rate limit') ? 'För många försök. Vänta en stund och försök igen.' : msg);
    } else {
      setSent(true);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length !== 6 || verifying) return;
    setVerifying(true);
    setErrorMsg(null);

    const { error: err } = await onVerifyOtp(email.trim(), trimmed);
    setVerifying(false);

    if (err) {
      setErrorMsg(t('auth.invalidCode'));
    }
    // On success, SIGNED_IN auth state change will close the modal via parent.
  };

  const handleChangeEmail = () => {
    setSent(false);
    setCode('');
    setErrorMsg(null);
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
              <h2 className="text-white text-xl font-bold">{t('auth.codeSentTitle')}</h2>
              <p className="text-gray-400 mt-2 text-sm">
                {t('auth.codeSentDesc').replace('{email}', email)}
              </p>
            </div>

            <form onSubmit={handleVerify}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('auth.codePlaceholder')}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500 text-center tracking-[0.5em] text-lg"
              />
              {errorMsg && (
                <p className="text-red-400 text-sm mb-3">{errorMsg}</p>
              )}
              <Button
                type="submit"
                fullWidth
                disabled={code.length !== 6 || verifying}
              >
                {verifying ? t('auth.sending') : t('auth.verifyCode')}
              </Button>
            </form>

            <button
              type="button"
              className="w-full text-gray-500 text-sm mt-4 py-2 min-h-[44px]"
              onClick={handleChangeEmail}
            >
              {t('auth.changeEmail')}
            </button>
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
              {errorMsg && (
                <p className="text-red-400 text-sm mb-3">{errorMsg}</p>
              )}
              <Button
                type="submit"
                fullWidth
                disabled={!email.trim() || sending}
              >
                {sending ? t('auth.sending') : t('auth.sendCode')}
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
