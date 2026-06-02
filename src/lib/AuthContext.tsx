import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Capture the URL at module load — BEFORE the Supabase client clears the hash
// when it exchanges an invite/recovery token. ES module imports are evaluated
// synchronously; the Supabase client schedules its token exchange via a
// microtask/setTimeout, so these captures run first.
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';
const INITIAL_SEARCH = typeof window !== 'undefined' ? window.location.search : '';
const INITIAL_PATHNAME = typeof window !== 'undefined' ? window.location.pathname : '';

function isInviteOrRecoveryUrl(): boolean {
  return INITIAL_HASH.includes('type=invite') ||
    INITIAL_HASH.includes('type=recovery') ||
    INITIAL_SEARCH.includes('type=invite') ||
    INITIAL_SEARCH.includes('type=recovery');
}

console.log('[VYSITE] AuthContext init | path:', INITIAL_PATHNAME,
  '| hash:', INITIAL_HASH || '(none)',
  '| search:', INITIAL_SEARCH || '(none)',
  '| isInviteOrRecovery:', isInviteOrRecoveryUrl());

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

const NEEDS_SETUP_KEY = 'vysite_needs_password_setup';

function setNeedsSetup() {
  try { sessionStorage.setItem(NEEDS_SETUP_KEY, '1'); } catch { /* */ }
}
function clearNeedsSetup() {
  try { sessionStorage.removeItem(NEEDS_SETUP_KEY); } catch { /* */ }
}
function checkNeedsSetup(): boolean {
  try { return sessionStorage.getItem(NEEDS_SETUP_KEY) === '1'; } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  // Initialise from sessionStorage so the gate survives a React re-render;
  // also pre-flag immediately if the page loaded with an invite/recovery URL.
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState<boolean>(() => {
    if (isInviteOrRecoveryUrl()) {
      setNeedsSetup();
      console.log('[VYSITE] Initial state: needsPasswordSetup=true (invite/recovery URL detected)');
      return true;
    }
    return checkNeedsSetup();
  });

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
      console.log('[VYSITE] getSession() user:', data.session?.user?.id ?? 'none',
        '| needsSetup:', checkNeedsSetup());
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        resolveOrg(data.session.user.id);
      } else {
        setOrgLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // By the time this fires, Supabase has already cleared the URL hash.
      // Use INITIAL_HASH/INITIAL_SEARCH captured at module load instead.
      console.log('[VYSITE] onAuthStateChange:', event,
        '| user:', newSession?.user?.id ?? 'none',
        '| hash now:', window.location.hash || '(cleared)',
        '| initialHash:', INITIAL_HASH || '(none)',
        '| needsSetup:', checkNeedsSetup());

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[VYSITE] PASSWORD_RECOVERY — flagging needs password setup');
        setNeedsSetup();
        setNeedsPasswordSetup(true);
      } else if (event === 'SIGNED_IN') {
        // Supabase fires SIGNED_IN for both normal logins and invite token
        // exchanges. Distinguish by checking the URL that was present at load.
        if (isInviteOrRecoveryUrl()) {
          console.log('[VYSITE] SIGNED_IN from invite/recovery URL — flagging needs password setup');
          setNeedsSetup();
          setNeedsPasswordSetup(true);
        } else {
          console.log('[VYSITE] SIGNED_IN — normal login, no password setup needed');
        }
      }

      setSession(newSession);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newSession?.user) resolveOrg(newSession.user.id);
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
    if (error) console.error('[VYSITE] signOut() error:', error.message);
  }

  function clearPasswordSetupFlag() {
    clearNeedsSetup();
    setNeedsPasswordSetup(false);
  }

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, loading,
      currentOrgId, orgLoading,
      needsPasswordSetup,
      signIn, signOut, updatePassword, clearPasswordSetupFlag,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
