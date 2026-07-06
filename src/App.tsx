import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Ban, AlertTriangle, CheckCircle, FlaskConical } from 'lucide-react';
import Sidebar, { type Page } from './components/Sidebar';
import Header from './components/Header';
import EnvBanner from './components/EnvBanner';
import Dashboard from './pages/Dashboard';
import TenderTracker from './pages/TenderTracker';
import Projects from './pages/Projects';
import SiteForms from './pages/SiteForms';
import Snagging from './pages/Snagging';
import Actions from './pages/Actions';
import Reports from './pages/Reports';
import BetaFeedback from './pages/BetaFeedback';
import Settings from './pages/Settings';
import TestingCommissioning from './pages/TestingCommissioning';
import OAndMManual from './pages/OAndMManual';
import MaintenanceServicing from './pages/MaintenanceServicing';
import Commercial from './pages/Commercial';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import SuperAdmin from './pages/SuperAdmin';
import SuperAdminOrganisations from './pages/SuperAdminOrganisations';
import { StoreContext, usePermissions, useAppStore } from './lib/StoreContext';
import { useStore } from './lib/store';
import { useAuth } from './lib/AuthContext';
import { OrgSettingsProvider, useOrgSettings } from './lib/OrgSettingsContext';
import { supabase } from './lib/supabase';

function AccessRestricted({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center mb-4">
        <Lock size={24} className="text-slate-500" />
      </div>
      <h2 className="text-lg font-bold text-white mb-1">Access Restricted</h2>
      <p className="text-sm text-slate-500 max-w-xs">
        You don't have permission to view <span className="text-slate-300 font-medium">{label}</span>. Contact your administrator if you need access.
      </p>
    </div>
  );
}

function AppPages({ activePage, navigateTo, pendingOpen, setPendingOpen, pendingFilter, setPendingFilter, pendingProjectId, setPendingProjectId, isSuperAdmin }: {
  activePage: Page;
  navigateTo: (page: Page, filter?: import('./App').PendingFilter, open?: import('./App').PendingOpen) => void;
  pendingOpen: import('./App').PendingOpen | null;
  setPendingOpen: (v: import('./App').PendingOpen | null) => void;
  pendingFilter: import('./App').PendingFilter | null;
  setPendingFilter: (v: import('./App').PendingFilter | null) => void;
  pendingProjectId: string | null;
  setPendingProjectId: (v: string | null) => void;
  isSuperAdmin: boolean;
}) {
  const perms = usePermissions();
  const { isModuleEnabled, loading: orgSettingsLoading } = useOrgSettings();
  const store = useAppStore();

  // Do not show "Access Restricted" while org settings or the user profile are
  // still resolving. Both have brief loading windows where permissions appear
  // false even for users who genuinely have access. Return null (blank) instead.
  const permissionsReady = !orgSettingsLoading && !!store.currentUser;

  function guard(condition: boolean, node: React.ReactNode, label: string): React.ReactNode {
    if (!permissionsReady) return null;
    return condition ? node : <AccessRestricted label={label} />;
  }

  switch (activePage) {
    case 'dashboard':
      return <Dashboard onNavigate={navigateTo} onNavigateProject={(id) => { setPendingProjectId(id); navigateTo('projects'); }} />;
    case 'tenders':
      return guard(perms['tender.view'] && isModuleEnabled('tenders'),
        <TenderTracker onConvertToProject={() => navigateTo('projects')} pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} />,
        'Tender & Estimating');
    case 'projects':
      return guard((perms['modules.projects'] || perms['projects.view_all'] || perms['projects.view_assigned']) && isModuleEnabled('projects'),
        <Projects onNavigate={(page, open) => { if (open) setPendingOpen(open); navigateTo(page); }} pendingProjectId={pendingProjectId} onPendingProjectConsumed={() => setPendingProjectId(null)} />,
        'Projects');
    case 'commercial':
      return guard(perms['modules.commercial'] && isModuleEnabled('commercial'),
        <Commercial />,
        'Commercial');
    case 'maintenance':
      return guard(perms['maintenance.view'] && isModuleEnabled('maintenance'),
        <MaintenanceServicing />,
        'Maintenance & Servicing');
    case 'site-forms':
      return guard(perms['modules.site_forms'] && isModuleEnabled('site-forms'),
        <SiteForms pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />,
        'Site Forms');
    case 'snagging':
      return guard(perms['modules.snagging'] && isModuleEnabled('snagging'),
        <Snagging pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />,
        'Snagging');
    case 'actions':
      return guard(perms['modules.actions'] && isModuleEnabled('actions'),
        <Actions pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />,
        'Actions Tracker');
    case 'testing':
      return guard(perms['modules.testing'] && isModuleEnabled('testing'),
        <OAndMManual />,
        'O&M Manual');
    case 'reports':
      return guard(perms['modules.reports'] && isModuleEnabled('reports'),
        <Reports />,
        'Reports');
    case 'beta-feedback':
      return <BetaFeedback />;
    case 'settings':
      return guard(!!perms['admin.manage_settings'],
        <Settings />,
        'Settings');
    case 'super-admin':
      return isSuperAdmin ? <SuperAdmin /> : <AccessRestricted label="Super Admin" />;
    case 'super-admin-orgs':
      return isSuperAdmin ? <SuperAdminOrganisations /> : <AccessRestricted label="Super Admin" />;
    default:
      return null;
  }
}

function linkedTypeToPage(linkedType: string): Page | null {
  switch (linkedType) {
    case 'action': return 'actions';
    case 'snag': return 'snagging';
    case 'form': return 'site-forms';
    case 'tender': return 'tenders';
    case 'testing': return 'testing';
    case 'project': return 'projects';
    default: return null;
  }
}

export interface PendingOpen {
  linkedType: string;
  linkedId: string;
}

export interface PendingFilter {
  filterKey: string;
  filterValue: string;
}

const SHOW_DEBUG = typeof window !== 'undefined' && window.location.search.includes('debug');

function DebugPanel({ auth, store }: {
  auth: { loading: boolean; orgLoading: boolean; user: { id: string } | null; currentOrgId: string | null };
  store?: { loading: boolean; currentOrgId?: string | null; currentUser?: { name: string } | null; platformUsers?: unknown[] };
}) {
  if (!SHOW_DEBUG) return null;
  return (
    <div style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 2147483647, background: '#0d1117', border: '2px solid #f97316', borderRadius: 8, padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0', maxWidth: 360, lineHeight: 1.7, userSelect: 'text' }}>
      <div style={{ color: '#f97316', fontWeight: 700, marginBottom: 4 }}>VYSITE DEBUG</div>
      <div>auth.loading: <b>{String(auth.loading)}</b></div>
      <div>auth.orgLoading: <b>{String(auth.orgLoading)}</b></div>
      <div>auth.user.id: <b style={{ fontSize: 10 }}>{auth.user?.id ?? 'null'}</b></div>
      <div>auth.currentOrgId: <b style={{ color: auth.currentOrgId ? '#4ade80' : '#f87171' }}>{auth.currentOrgId ?? 'null'}</b></div>
      {store && <>
        <div>store.loading: <b>{String(store.loading)}</b></div>
        <div>store.currentOrgId: <b style={{ color: store.currentOrgId ? '#4ade80' : '#f87171' }}>{store.currentOrgId ?? 'null'}</b></div>
        <div>currentUser: <b>{store.currentUser?.name ?? 'null'}</b></div>
        <div>platformUsers: <b>{store.platformUsers?.length ?? 0}</b></div>
      </>}
    </div>
  );
}

// ─── Plan Selector ────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Core project and tender management for small teams.',
    features: ['Tender & Estimating', 'Projects & Programmes', 'Site Forms & Snagging', 'Actions & Testing', 'Maintenance & Servicing', 'Reports'],
    monthly: '£84',
    annual: '£799',
    highlight: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Advanced tools and AI features for growing contractors.',
    features: ['Everything in Starter', 'AI Contract Review', 'AI Tender Assistant', 'Priority Support'],
    monthly: '£156',
    annual: '£1,495',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Full platform access including the Commercial Module.',
    features: ['Everything in Professional', 'Commercial Module', 'Variations & Compensation Events', 'Delay Notices'],
    monthly: '£260',
    annual: '£2,495',
    highlight: false,
  },
] as const;

function PlanSelector({
  loading,
  error,
  onSelect,
}: {
  loading: boolean;
  error: string | null;
  onSelect: (plan: string, interval: string) => void;
}) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSelect = (planId: string) => {
    setSelecting(planId);
    onSelect(planId, billingInterval);
  };

  return (
    <div className="w-full">
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span className={`text-sm font-medium ${billingInterval === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
        <button
          onClick={() => setBillingInterval(i => i === 'monthly' ? 'annual' : 'monthly')}
          className={`relative w-12 h-6 rounded-full transition-colors ${billingInterval === 'annual' ? 'bg-[#f97316]' : 'bg-[#1e2d4a]'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${billingInterval === 'annual' ? 'translate-x-6' : ''}`} />
        </button>
        <span className={`text-sm font-medium ${billingInterval === 'annual' ? 'text-white' : 'text-slate-500'}`}>
          Annual <span className="text-emerald-400 text-xs font-bold">Save 20%</span>
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-5 text-left transition-all ${
              plan.highlight
                ? 'border-[#f97316] bg-orange-950/20 shadow-lg shadow-orange-900/20'
                : 'border-[#1e2d4a] bg-[#1a2236]'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#f97316] text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                Most Popular
              </div>
            )}
            <h3 className="text-base font-bold text-white mb-1">{plan.name}</h3>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">{plan.description}</p>
            <div className="mb-4">
              <span className="text-2xl font-black text-white">
                {billingInterval === 'monthly' ? plan.monthly : plan.annual}
              </span>
              <span className="text-xs text-slate-500 ml-1">
                /{billingInterval === 'monthly' ? 'mo' : 'yr'}
              </span>
            </div>
            <ul className="space-y-1.5 mb-5">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSelect(plan.id)}
              disabled={loading}
              className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                plan.highlight
                  ? 'bg-[#f97316] hover:bg-orange-400 text-white shadow shadow-orange-900/30'
                  : 'bg-[#0d1628] border border-[#1e2d4a] hover:border-[#f97316] text-slate-200 hover:text-white'
              }`}
            >
              {loading && selecting === plan.id ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Redirecting…
                </span>
              ) : (
                `Subscribe — ${plan.name}`
              )}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-400 text-center mt-2">{error}</p>
      )}
    </div>
  );
}

interface OrgGatedAppProps {
  debugPanel: React.ReactNode;
  activePage: Page;
  setActivePage: (p: Page) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarWidth: number;
  navigateTo: (page: Page, filter?: PendingFilter, open?: PendingOpen) => void;
  pendingOpen: PendingOpen | null;
  setPendingOpen: (v: PendingOpen | null) => void;
  pendingFilter: PendingFilter | null;
  setPendingFilter: (v: PendingFilter | null) => void;
  pendingProjectId: string | null;
  setPendingProjectId: (v: string | null) => void;
  handleNotificationNavigate: (linkedType: string, linkedId: string) => void;
  isSuperAdmin: boolean;
}

function OrgGatedApp({
  debugPanel, activePage, setActivePage, sidebarCollapsed, setSidebarCollapsed,
  mobileMenuOpen, setMobileMenuOpen, sidebarWidth,
  navigateTo, pendingOpen, setPendingOpen, pendingFilter, setPendingFilter,
  pendingProjectId, setPendingProjectId, handleNotificationNavigate, isSuperAdmin,
}: OrgGatedAppProps) {
  const { orgSettings, isModuleEnabled, isTrialExpired, isFreeAccessOverride } = useOrgSettings();
  const { signOut, session } = useAuth();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Detect ?checkout_success=1 on return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout_success') === '1') {
      setCheckoutSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const startCheckout = useCallback(async (plan: string, interval: string) => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ plan, interval }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setCheckoutError(json.error ?? 'Unable to start checkout. Please try again.');
        setCheckoutLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setCheckoutError('Network error — please check your connection and try again.');
      setCheckoutLoading(false);
    }
  }, [session]);

  const openPortal = useCallback(async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ return_url: window.location.origin }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setCheckoutError(json.error ?? 'Unable to open billing portal. Please try again.');
        setCheckoutLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setCheckoutError('Network error — please check your connection and try again.');
      setCheckoutLoading(false);
    }
  }, [session]);

  const subscriptionStatus = orgSettings.subscription_status;
  const isPaymentFailed = subscriptionStatus === 'past_due';
  const isSubscriptionEnded = subscriptionStatus === 'canceled' || subscriptionStatus === 'unpaid';
  // Free access override bypasses all subscription/trial gates
  const isBlocked = !isFreeAccessOverride && (isTrialExpired || orgSettings.account_status === 'disabled' || isSubscriptionEnded);

  if (isBlocked) {
    const isExpiredTrial = isTrialExpired && !isSubscriptionEnded;
    const isAdminDisabled = orgSettings.account_status === 'disabled';

    return (
      <>
        {debugPanel}
        <div className="min-h-screen bg-[#111827] flex items-center justify-center p-6">
          <div className="text-center max-w-2xl w-full">
            {isAdminDisabled ? (
              /* ── Admin-disabled ── */
              <>
                <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-800/30 flex items-center justify-center mx-auto mb-5">
                  <Ban size={28} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Account Disabled</h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  This company account has been disabled. Please contact{' '}
                  <a href="mailto:hello@vysite.com" className="text-[#f97316] hover:underline">VYSITE support</a> to restore access.
                </p>
              </>
            ) : isSubscriptionEnded ? (
              /* ── Subscription cancelled / unpaid ── */
              <>
                <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-800/30 flex items-center justify-center mx-auto mb-5">
                  <Ban size={28} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Subscription Ended</h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Your VYSITE subscription has been cancelled or has lapsed. Re-subscribe below to restore access to your account and data.
                </p>
                <PlanSelector
                  loading={checkoutLoading}
                  error={checkoutError}
                  onSelect={startCheckout}
                />
              </>
            ) : isExpiredTrial ? (
              /* ── Trial expired ── */
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border border-amber-700/40 flex items-center justify-center mx-auto mb-5">
                  <FlaskConical size={28} className="text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Your free trial has ended</h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Your 14-day VYSITE trial has expired. Choose a plan below to restore access and keep your data.
                </p>
                <PlanSelector
                  loading={checkoutLoading}
                  error={checkoutError}
                  onSelect={startCheckout}
                />
              </>
            ) : null}

            <button
              onClick={signOut}
              className="mt-6 px-5 py-2 border border-[#1e2d4a] text-slate-400 hover:text-white rounded-lg text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {debugPanel}
      {/* Payment warning banner — past_due but not yet hard-blocked */}
      {isPaymentFailed && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white text-xs font-semibold flex items-center justify-center gap-2 px-4 py-2.5">
          <AlertTriangle size={13} />
          <span>Payment failed — please update your payment method to avoid losing access.</span>
          <button
            onClick={openPortal}
            disabled={checkoutLoading}
            className="ml-2 underline hover:no-underline disabled:opacity-60"
          >
            {checkoutLoading ? 'Opening…' : 'Update now'}
          </button>
        </div>
      )}
      {/* Checkout success banner */}
      {checkoutSuccess && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-2 px-4 py-2.5">
          <CheckCircle size={13} />
          <span>Subscription activated — welcome to VYSITE!</span>
          <button
            onClick={() => setCheckoutSuccess(false)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <EnvBanner />
      <div className={`min-h-screen bg-[#111827] flex ${(isPaymentFailed || checkoutSuccess) ? 'pt-9' : ''}`}>
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          isModuleEnabled={isModuleEnabled}
        />
        <div
          className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ml-0 lg:ml-[var(--sidebar-width)]"
          style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
        >
          <Header
            activePage={activePage}
            onOpenMobile={() => setMobileMenuOpen(true)}
            onNavigate={setActivePage}
            onNotificationNavigate={handleNotificationNavigate}
          />
          <main className="flex-1 overflow-auto">
            <AppPages
              activePage={activePage}
              navigateTo={navigateTo}
              pendingOpen={pendingOpen}
              setPendingOpen={setPendingOpen}
              pendingFilter={pendingFilter}
              setPendingFilter={setPendingFilter}
              pendingProjectId={pendingProjectId}
              setPendingProjectId={setPendingProjectId}
              isSuperAdmin={isSuperAdmin}
            />
          </main>
        </div>
      </div>
    </>
  );
}

export default function App() {
  if (typeof window !== 'undefined') {
    // /set-password is a standalone route — rendered outside AuthProvider.
    // Handles the redirectTo path: /set-password?token_hash=XXX&type=invite
    if (window.location.pathname === '/set-password') {
      return <SetPassword />;
    }
  }
  return <AppInner />;
}

function AppInner() {
  const auth = useAuth();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);
  const [pendingFilter, setPendingFilter] = useState<PendingFilter | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const store = useStore(auth.currentOrgId, auth.user?.id ?? null);

  // Check super admin status once we have a session
  useEffect(() => {
    if (!auth.user) { setIsSuperAdmin(false); return; }
    supabase.rpc('is_super_admin').then(({ data }) => {
      setIsSuperAdmin(!!data);
    });
  }, [auth.user?.id]);

  function navigateTo(page: Page, filter?: PendingFilter, open?: PendingOpen) {
    setActivePage(page);
    setPendingFilter(filter ?? null);
    setPendingOpen(open ?? null);
  }

  const sidebarWidth = sidebarCollapsed ? 72 : 256;

  function handleNotificationNavigate(linkedType: string, linkedId: string) {
    const page = linkedTypeToPage(linkedType);
    if (page) {
      setActivePage(page);
      setPendingOpen({ linkedType, linkedId });
    }
  }

  const debugPanel = <DebugPanel auth={auth} store={store} />;

  console.log('[VYSITE] AppInner render | loading:', auth.loading,
    '| session:', auth.session ? 'set' : 'null',
    '| needsPasswordSetup:', auth.needsPasswordSetup,
    '| pathname:', window.location.pathname,
    '| hash:', window.location.hash || '(none)');

  if (auth.loading) {
    return (
      <>
        {debugPanel}
        <div className="min-h-screen bg-[#111827] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl mx-auto mb-4">V</div>
            <p className="text-slate-400 text-sm">Loading VYSITE...</p>
          </div>
        </div>
      </>
    );
  }

  if (!auth.session) {
    return (
      <>
        {debugPanel}
        <Login />
      </>
    );
  }

  // User arrived via an invite or password-reset link — force password setup
  // before they can access any part of the dashboard. This is the authoritative
  // gate: even if Supabase already established a session, they must set a
  // password first. The flag is cleared by SetPassword on success.
  if (auth.needsPasswordSetup) {
    return <SetPassword onSetupComplete={auth.clearPasswordSetupFlag} />;
  }

  if (auth.orgLoading) {
    return (
      <>
        {debugPanel}
        <div className="min-h-screen bg-[#111827] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl mx-auto mb-4">V</div>
            <p className="text-slate-400 text-sm">Loading VYSITE...</p>
          </div>
        </div>
      </>
    );
  }

  if (store.loading) {
    return (
      <>
        {debugPanel}
        <div className="min-h-screen bg-[#111827] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl mx-auto mb-4">V</div>
            <p className="text-slate-400 text-sm">Loading VYSITE...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <StoreContext.Provider value={store}>
      <OrgSettingsProvider orgId={auth.currentOrgId}>
        <OrgGatedApp
          debugPanel={debugPanel}
          activePage={activePage}
          setActivePage={setActivePage}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          sidebarWidth={sidebarWidth}
          navigateTo={navigateTo}
          pendingOpen={pendingOpen}
          setPendingOpen={setPendingOpen}
          pendingFilter={pendingFilter}
          setPendingFilter={setPendingFilter}
          pendingProjectId={pendingProjectId}
          setPendingProjectId={setPendingProjectId}
          handleNotificationNavigate={handleNotificationNavigate}
          isSuperAdmin={isSuperAdmin}
        />
      </OrgSettingsProvider>
    </StoreContext.Provider>
  );
}
