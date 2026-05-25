import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  currentOrgId: string | null;
  orgLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  // orgLoading starts true — holds the UI gate until the first resolution
  // completes. It is only ever set back to true on a genuine sign-in/sign-out,
  // NOT on token refresh events.
  const [orgLoading, setOrgLoading] = useState(true);

  // Track the user ID we last resolved so we never resolve the same user twice
  // (avoids re-running on TOKEN_REFRESHED which fires with the same user).
  const resolvedForRef = useRef<string | null>(null);

  async function resolveOrg(userId: string, isInitial: boolean) {
    // Skip if we already have an org for this exact user — prevents TOKEN_REFRESHED
    // from clearing currentOrgId and re-running the spinner.
    if (!isInitial && resolvedForRef.current === userId && currentOrgId !== null) {
      console.log('[VYSITE] resolveOrg() skipped — already resolved for:', userId, 'orgId:', currentOrgId);
      return;
    }

    console.log('[VYSITE] resolveOrg() for user:', userId, 'isInitial:', isInitial);
    if (isInitial) setOrgLoading(true);

    const { data, error } = await supabase
      .from('user_orgs')
      .select('org_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const resolved = data?.org_id ?? null;
    console.log('[VYSITE] resolveOrg() result:', resolved);
    if (error) console.error('[VYSITE] resolveOrg() error:', error);

    resolvedForRef.current = userId;
    setCurrentOrgId(resolved);
    if (isInitial) setOrgLoading(false);
  }

  useEffect(() => {
    // getSession() is the source of truth on page load / refresh.
    supabase.auth.getSession().then(({ data }) => {
      console.log('[VYSITE] getSession() user:', data.session?.user?.id ?? 'none');
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        resolveOrg(data.session.user.id, true);
      } else {
        setOrgLoading(false);
      }
    });

    // onAuthStateChange handles sign-in / sign-out / token refresh.
    // Only re-resolve org on SIGNED_IN and SIGNED_OUT — not on TOKEN_REFRESHED
    // or USER_UPDATED, which fire frequently and would clear currentOrgId.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[VYSITE] onAuthStateChange:', event, newSession?.user?.id ?? 'none');
      setSession(newSession);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newSession?.user) {
          // isInitial=false: don't show the org spinner again if we already have an org
          resolveOrg(newSession.user.id, false);
        }
      } else if (event === 'SIGNED_OUT') {
        resolvedForRef.current = null;
        setCurrentOrgId(null);
        setOrgLoading(false);
      }
      // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY — no org change needed
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    // Reset resolved cache on a fresh sign-in so a different user gets re-resolved
    resolvedForRef.current = null;
    setOrgLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setOrgLoading(false);
      return { error: error.message };
    }
    // resolveOrg will be triggered by the SIGNED_IN event in onAuthStateChange
    return { error: null };
  }

  async function signOut() {
    resolvedForRef.current = null;
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, currentOrgId, orgLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
