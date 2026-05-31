'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) {
        import('@/lib/supabase/sync').then(({ pullFromSupabase }) => pullFromSupabase()).catch(() => {});
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (event === 'SIGNED_IN' && session?.user) {
          import('@/lib/supabase/sync')
            .then(({ syncAllToSupabase, pullFromSupabase }) => syncAllToSupabase().then(() => pullFromSupabase()))
            .catch(() => {});
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithEmail = useCallback(async (email: string) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/`,
      },
    });
    return { error };
  }, [supabase.auth]);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { error };
  }, [supabase.auth]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, [supabase.auth]);

  const setPassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase.auth]);

  return { user, loading, signInWithEmail, verifyOtp, signInWithPassword, setPassword, signOut };
}
