import { useState } from 'react';
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
import Login from './pages/Login';
import { StoreContext } from './lib/StoreContext';
import { useStore } from './lib/store';
import { useAuth } from './lib/AuthContext';

// Maps notification linked_type to a Page
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
  filterKey: string;   // e.g. 'status', 'priority'
  filterValue: string; // e.g. 'Overdue', 'Critical'
}

export default function App() {
  const auth = useAuth();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);
  const [pendingFilter, setPendingFilter] = useState<PendingFilter | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const store = useStore(auth.currentOrgId, auth.user?.id ?? null);

  function navigateTo(page: Page, filter?: PendingFilter, open?: PendingOpen) {
    setActivePage(page);
    setPendingFilter(filter ?? null);
    setPendingOpen(open ?? null);
  }

  const sidebarWidth = sidebarCollapsed ? 72 : 256;

  const clientRestrictedPages: Page[] = ['tenders', 'users', 'settings'];

  function handleNotificationNavigate(linkedType: string, linkedId: string) {
    const page = linkedTypeToPage(linkedType);
    if (page) {
      setActivePage(page);
      setPendingOpen({ linkedType, linkedId });
    }
  }

  const renderPage = () => {
    const isClientUser = store.currentUser?.role === 'Client User';
    if (isClientUser && clientRestrictedPages.includes(activePage)) {
      return <Dashboard onNavigate={navigateTo} onNavigateProject={(id) => { setPendingProjectId(id); setActivePage('projects'); }} />;
    }
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={navigateTo} onNavigateProject={(id) => { setPendingProjectId(id); setActivePage('projects'); }} />;
      case 'tenders':
        return <TenderTracker onConvertToProject={() => setActivePage('projects')} pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} />;
      case 'projects':
        return <Projects onNavigate={(page, open) => { if (open) setPendingOpen(open); setActivePage(page); }} pendingProjectId={pendingProjectId} onPendingProjectConsumed={() => setPendingProjectId(null)} />;
      case 'site-forms':
        return <SiteForms pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />;
      case 'snagging':
        return <Snagging pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />;
      case 'actions':
        return <Actions pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />;
      case 'testing':
        return <TestingCommissioning pendingOpen={pendingOpen} onPendingOpenConsumed={() => setPendingOpen(null)} pendingFilter={pendingFilter} onPendingFilterConsumed={() => setPendingFilter(null)} />;
      case 'reports':
        return <Reports />;
      case 'users':
        return <Users />;
      case 'beta-feedback':
        return <BetaFeedback />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  };

  // Show spinner while auth session or org membership is being resolved
  if (auth.loading || auth.orgLoading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl mx-auto mb-4">V</div>
          <p className="text-slate-400 text-sm">Loading VYSITE...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated — show login gate
  if (!auth.session) {
    return <Login />;
  }

  if (store.loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#f97316] flex items-center justify-center font-black text-white text-2xl mx-auto mb-4">V</div>
          <p className="text-slate-400 text-sm">Loading VYSITE...</p>
        </div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={store}>
      <EnvBanner />
      <div className="min-h-screen bg-[#111827] flex">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
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
            {renderPage()}
          </main>
        </div>
      </div>
    </StoreContext.Provider>
  );
}
