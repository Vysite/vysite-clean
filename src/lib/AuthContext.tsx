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
  // orgLoading starts true — holds the UI gate until the first resolution completes.
  const [orgLoading, setOrgLoading] = useState(true);

  // Refs keep the skip-guard readable from within the stable useEffect closure
  // without needing to re-register the onAuthStateChange listener on every render.
  const resolvedForRef = useRef<string | null>(null);
  const currentOrgIdRef = useRef<string | null>(null);
  currentOrgIdRef.current = currentOrgId;

  // resolveOrg always manages orgLoading. The ref guard prevents re-running for
  // the same user on TOKEN_REFRESHED (same userId, org already set).
  async function resolveOrg(userId: string) {
    if (resolvedForRef.current === userId && currentOrgIdRef.current !== null) {
      console.log('[VYSITE] resolveOrg() skipped — already resolved for:', userId, 'orgId:', currentOrgIdRef.current);
      return;
    }

    console.log('[VYSITE] resolveOrg() for user:', userId);
    setOrgLoading(true);

    const { data, error } = await supabase
      .from('user_orgs')
      .select('org_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const resolved = data?.org_id ?? null;
    console.log('[VYSITE] resolveOrg() result:', resolved, error ? `error: ${error.message}` : '');
    if (error) console.error('[VYSITE] resolveOrg() error:', error);

    resolvedForRef.current = userId;
    setCurrentOrgId(resolved);
    setOrgLoading(false);
  }

  useEffect(() => {
    // getSession() is the source of truth on page load / refresh.
    // onAuthStateChange also fires INITIAL_SESSION shortly after, but we
    // handle org resolution here to avoid a double-resolve on first load.
    supabase.auth.getSession().then(({ data }) => {
      console.log('[VYSITE] getSession() user:', data.session?.user?.id ?? 'none');
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        resolveOrg(data.session.user.id);
      } else {
        setOrgLoading(false);
      }
    });

    // onAuthStateChange handles sign-in / sign-out / token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[VYSITE] onAuthStateChange:', event, newSession?.user?.id ?? 'none');
      setSession(newSession);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newSession?.user) {
          // resolveOrg is idempotent for the same userId — TOKEN_REFRESHED and
          // duplicate INITIAL_SESSION events are no-ops when already resolved.
          resolveOrg(newSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        resolvedForRef.current = null;
        setCurrentOrgId(null);
        setOrgLoading(false);
      }
      // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY — resolveOrg skip guard handles these
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    // Reset the resolved cache so a fresh sign-in (possibly a different user)
    // always runs resolveOrg rather than hitting the skip guard.
    resolvedForRef.current = null;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // SIGNED_IN fires in onAuthStateChange → resolveOrg() handles orgLoading
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
