import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const DEV = import.meta.env.DEV;

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
  // Start true: holds the loading gate until we know whether a session exists
  // and, if so, until org resolution completes. Prevents the window where
  // loading=false but currentOrgId=null while resolveOrg is still in-flight.
  const [orgLoading, setOrgLoading] = useState(true);

  async function resolveOrg(userId: string) {
    if (DEV) console.log('[VYSITE] resolveOrg() for user:', userId);
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
    if (DEV) console.log('[VYSITE] resolveOrg() result:', resolved, error ?? '');
    setCurrentOrgId(resolved);
    setOrgLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (DEV) console.log('[VYSITE] getSession() user:', data.session?.user?.id ?? 'none');
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        // resolveOrg will call setOrgLoading(false) when done
        resolveOrg(data.session.user.id);
      } else {
        // No session — nothing to resolve, clear the gate immediately
        setOrgLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (DEV) console.log('[VYSITE] onAuthStateChange:', _event, newSession?.user?.id ?? 'none');
      setSession(newSession);
      if (newSession?.user) {
        (async () => { await resolveOrg(newSession.user.id); })();
      } else {
        setCurrentOrgId(null);
        setOrgLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
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
