import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  currentOrgId: string | null;
  orgLoading: boolean;
  needsPasswordSetup: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthState | null>(null);

// Detect whether the URL contains a Supabase recovery/invite token fragment.
// Supabase embeds tokens as a URL hash: #access_token=...&type=recovery
// or as query params after the hash when using PKCE: ?token_hash=...&type=...
function hasRecoveryTokenInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  // Hash-based (implicit flow): #access_token=...&type=recovery
  if (hash.includes('type=recovery') || hash.includes('type=invite')) return true;
  // Query-based (PKCE flow): ?token_hash=...&type=recovery
  if (search.includes('type=recovery') || search.includes('type=invite')) return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  // orgLoading starts true — holds the UI gate until the first resolution completes.
  const [orgLoading, setOrgLoading] = useState(true);

  const resolvedForRef = useRef<string | null>(null);
  const currentOrgIdRef = useRef<string | null>(null);
  currentOrgIdRef.current = currentOrgId;

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
    // If the URL contains a recovery/invite token, sign out any existing session
    // first so the token exchange runs cleanly without the old session interfering.
    // onAuthStateChange will fire PASSWORD_RECOVERY once the exchange completes.
    if (hasRecoveryTokenInUrl()) {
      console.log('[VYSITE] Recovery/invite token detected in URL — clearing existing session');
      supabase.auth.signOut({ scope: 'local' }).then(() => {
        setLoading(false);
        setOrgLoading(false);
        // The Supabase client will automatically exchange the token in the URL
        // and fire PASSWORD_RECOVERY via onAuthStateChange.
      });
      return;
    }

    // Normal startup — get existing session.
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[VYSITE] onAuthStateChange:', event, newSession?.user?.id ?? 'none');
      setSession(newSession);

      if (event === 'PASSWORD_RECOVERY') {
        // Invite/recovery link token was exchanged — session is now active but
        // the user must set a password before entering the app.
        setNeedsPasswordSetup(true);
        setLoading(false);
        setOrgLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newSession?.user) {
          resolveOrg(newSession.user.id);
        }
      } else if (event === 'USER_UPDATED') {
        // Password was successfully updated — clear the setup gate and resolve org.
        setNeedsPasswordSetup(false);
        if (newSession?.user) resolveOrg(newSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        resolvedForRef.current = null;
        setCurrentOrgId(null);
        setOrgLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function updatePassword(password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    resolvedForRef.current = null;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    resolvedForRef.current = null;
    setSession(null);
    setCurrentOrgId(null);
    setOrgLoading(false);
    setNeedsPasswordSetup(false);

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('[VYSITE] signOut() error:', error.message);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, currentOrgId, orgLoading, needsPasswordSetup, signIn, signOut, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
