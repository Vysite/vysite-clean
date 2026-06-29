import {
  LayoutDashboard, FileText, FolderKanban, ClipboardList,
  AlertOctagon, Zap, BookOpen, BarChart2, Users,
  Settings, MessageSquare, Wrench, ChevronLeft,
  ChevronRight, X, TrendingUp,
} from 'lucide-react';

export type Page =
  | 'dashboard'
  | 'tenders'
  | 'projects'
  | 'commercial'
  | 'maintenance'
  | 'site-forms'
  | 'snagging'
  | 'actions'
  | 'testing'
  | 'reports'
  | 'users'
  | 'beta-feedback'
  | 'settings'
  | 'super-admin'
  | 'super-admin-orgs';

interface NavItem {
  page: Page;
  label: string;
  icon: React.ReactNode;
  moduleKey?: string;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard',     label: 'Dashboard',          icon: <LayoutDashboard size={18} /> },
  { page: 'tenders',       label: 'Tender & Estimating', icon: <FileText size={18} />,        moduleKey: 'tenders' },
  { page: 'projects',      label: 'Projects',            icon: <FolderKanban size={18} />,    moduleKey: 'projects' },
  { page: 'commercial',    label: 'Commercial',          icon: <TrendingUp size={18} />,      moduleKey: 'commercial' },
  { page: 'maintenance',   label: 'Maintenance',         icon: <Wrench size={18} />,          moduleKey: 'maintenance' },
  { page: 'site-forms',    label: 'Site Forms',          icon: <ClipboardList size={18} />,   moduleKey: 'site-forms' },
  { page: 'snagging',      label: 'Snagging',            icon: <AlertOctagon size={18} />,    moduleKey: 'snagging' },
  { page: 'actions',       label: 'Actions',             icon: <Zap size={18} />,             moduleKey: 'actions' },
  { page: 'testing',       label: 'O&M Manual',          icon: <BookOpen size={18} />,        moduleKey: 'testing' },
  { page: 'reports',       label: 'Reports',             icon: <BarChart2 size={18} />,       moduleKey: 'reports' },
  { page: 'users',         label: 'Users',               icon: <Users size={18} /> },
  { page: 'beta-feedback', label: 'Feedback',            icon: <MessageSquare size={18} /> },
  { page: 'settings',      label: 'Settings',            icon: <Settings size={18} /> },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isModuleEnabled: (key: string) => boolean;
}

export default function Sidebar({
  activePage, onNavigate, collapsed, onToggleCollapse,
  mobileOpen, onCloseMobile, isModuleEnabled,
}: SidebarProps) {
  const width = collapsed ? 72 : 256;

  function NavLink({ item }: { item: NavItem }) {
    const active = activePage === item.page;
    const hidden = item.moduleKey && !isModuleEnabled(item.moduleKey);
    if (hidden) return null;

    return (
      <button
        onClick={() => { onNavigate(item.page); onCloseMobile(); }}
        title={collapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group ${
          active
            ? 'bg-[#f97316] text-white shadow-lg shadow-orange-900/30'
            : 'text-slate-400 hover:text-slate-100 hover:bg-[#1e2d4a]/60'
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
      </button>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0d1628] border-r border-[#1e2d4a]" style={{ width }}>
      {/* Logo */}
      <div
        className={`flex items-center shrink-0 border-b border-[#1e2d4a] ${
          collapsed ? 'justify-center px-2 h-16' : 'px-3 h-20'
        }`}
      >
        {collapsed ? (
          <img
            src="/image_(3).png"
            alt="VYSITE"
            className="w-11 h-11 rounded-xl object-cover shrink-0"
          />
        ) : (
          <img
            src="/VYSITE_Logo_Long.png"
            alt="VYSITE"
            className="w-full h-full object-contain"
            style={{ mixBlendMode: 'lighten' }}
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(item => <NavLink key={item.page} item={item} />)}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden lg:flex shrink-0 border-t border-[#1e2d4a] p-2">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a]/60 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col transition-all duration-300"
        style={{ width }}
      >
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex flex-col" style={{ width: 256 }}>
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-4 text-slate-400 hover:text-white z-50"
            >
              <X size={20} />
            </button>
            <div style={{ width: 256 }}>
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Standalone mobile hamburger button exported for use in Header
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors"
      aria-label="Open menu"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <rect x="2" y="4" width="16" height="2" rx="1" />
        <rect x="2" y="9" width="16" height="2" rx="1" />
        <rect x="2" y="14" width="16" height="2" rx="1" />
      </svg>
    </button>
  );
}
