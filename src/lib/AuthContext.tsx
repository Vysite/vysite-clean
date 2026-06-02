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
  clearPasswordSetupFlag: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Persisted across renders but cleared on tab close (sessionStorage).
// Set when Supabase establishes a session from an invite or recovery link.
const NEEDS_SETUP_KEY = 'vysite_needs_password_setup';

function setNeedsSetup() {
  try { sessionStorage.setItem(NEEDS_SETUP_KEY, '1'); } catch { /* */ }
}
function clearNeedsSetup() {
  try { sessionStorage.removeItem(NEEDS_SETUP_KEY); } catch { /* */ }
}
function checkNeedsSetup() {
  try { return sessionStorage.getItem(NEEDS_SETUP_KEY) === '1'; } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(checkNeedsSetup);

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

      // Detect invite/recovery sessions — Supabase fires SIGNED_IN for invites
      // and PASSWORD_RECOVERY for password reset links. In both cases we must
      // route the user to /set-password before they enter the dashboard.
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsSetup();
        setNeedsPasswordSetup(true);
        console.log('[VYSITE] PASSWORD_RECOVERY — flagging needs password setup');
      } else if (event === 'SIGNED_IN') {
        // Check URL hash at fire time — it still contains type=invite because
        // Supabase fires onAuthStateChange synchronously during token exchange.
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (hash.includes('type=invite') || hash.includes('type=recovery')) {
          setNeedsSetup();
          setNeedsPasswordSetup(true);
          console.log('[VYSITE] SIGNED_IN via invite/recovery hash — flagging needs password setup');
        }
      }

      setSession(newSession);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newSession?.user) {
          resolveOrg(newSession.user.id);
        }
      } else if (event === 'USER_UPDATED') {
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
    clearNeedsSetup();
    setNeedsPasswordSetup(false);

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('[VYSITE] signOut() error:', error.message);
    }
  }

  function clearPasswordSetupFlag() {
    clearNeedsSetup();
    setNeedsPasswordSetup(false);
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, currentOrgId, orgLoading, needsPasswordSetup, signIn, signOut, updatePassword, clearPasswordSetupFlag }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
