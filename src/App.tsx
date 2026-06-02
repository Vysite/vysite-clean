import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
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
import Users from './pages/Users';
import BetaFeedback from './pages/BetaFeedback';
import Settings from './pages/Settings';
import TestingCommissioning from './pages/TestingCommissioning';
import MaintenanceServicing from './pages/MaintenanceServicing';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import SuperAdmin from './pages/SuperAdmin';
import SuperAdminOrganisations from './pages/SuperAdminOrganisations';
import { StoreContext, usePermissions } from './lib/StoreContext';
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
  const { isModuleEnabled } = useOrgSettings();

  switch (activePage) {
    case 'dashboard':
      return <Dashboard onNavigate={navigateTo} onNavigateProject={(id) => { setPendingProjectId(id); navigateTo('projects'); }} />;
    case 'tenders':
      return (perms['tender.view'] && isModuleEnabled('tenders'))
        ? <TenderTracker onConvertToProject={() => navigateTo('projects')} pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} />
        : <AccessRestricted label="Tender & Estimating" />;
    case 'projects':
      return ((perms['modules.projects'] || perms['projects.view_all'] || perms['projects.view_assigned']) && isModuleEnabled('projects'))
        ? <Projects onNavigate={(page, open) => { if (open) setPendingOpen(open); navigateTo(page); }} pendingProjectId={pendingProjectId} onPendingProjectConsumed={() => setPendingProjectId(null)} />
        : <AccessRestricted label="Projects" />;
    case 'maintenance':
      return (perms['maintenance.view'] && isModuleEnabled('maintenance'))
        ? <MaintenanceServicing />
        : <AccessRestricted label="Maintenance & Servicing" />;
    case 'site-forms':
      return (perms['modules.site_forms'] && isModuleEnabled('site-forms'))
        ? <SiteForms pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />
        : <AccessRestricted label="Site Forms" />;
    case 'snagging':
      return (perms['modules.snagging'] && isModuleEnabled('snagging'))
        ? <Snagging pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />
        : <AccessRestricted label="Snagging" />;
    case 'actions':
      return (perms['modules.actions'] && isModuleEnabled('actions'))
        ? <Actions pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />
        : <AccessRestricted label="Actions Tracker" />;
    case 'testing':
      return (perms['modules.testing'] && isModuleEnabled('testing'))
        ? <TestingCommissioning pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />
        : <AccessRestricted label="Testing & Commissioning" />;
    case 'reports':
      return (perms['modules.reports'] && isModuleEnabled('reports'))
        ? <Reports />
        : <AccessRestricted label="Reports" />;
    case 'users':
      return (perms['admin.edit_users'] || perms['admin.invite_users'])
        ? <Users />
        : <AccessRestricted label="Users" />;
    case 'beta-feedback':
      return <BetaFeedback />;
    case 'settings':
      return perms['admin.manage_settings']
        ? <Settings />
        : <AccessRestricted label="Settings" />;
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
  const { orgSettings, isModuleEnabled } = useOrgSettings();
  const { signOut } = useAuth();

  if (orgSettings.account_status === 'disabled') {
    return (
      <>
        {debugPanel}
        <div className="min-h-screen bg-[#111827] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Account Disabled</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              This company account is currently disabled. Please contact{' '}
              <a href="mailto:support@vysite.co.uk" className="text-[#f97316] hover:underline">VYSITE support</a>
              {' '}to restore access.
            </p>
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
      <EnvBanner />
      <div className="min-h-screen bg-[#111827] flex">
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
    const path = window.location.pathname;

    // If Supabase delivers the invite/recovery token as a hash fragment
    // (e.g. #access_token=...&type=invite), intercept it here before the
    // Supabase client auto-exchanges it and silently creates a session that
    // bypasses the password-setup screen.
    const hash = window.location.hash;
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
      // Parse the hash into query params and redirect to /set-password
      // carrying them as query params so SetPassword.tsx can handle them.
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      const tokenHash = hashParams.get('token_hash') ?? hashParams.get('access_token');
      const type = hashParams.get('type') ?? 'invite';
      if (tokenHash && path !== '/set-password') {
        window.location.replace(`/set-password?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`);
        return null;
      }
    }

    // /set-password is a standalone route — render before any auth/hook logic.
    if (path === '/set-password') {
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
