import { useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardList,
  AlertTriangle,
  CheckSquare,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  FileSpreadsheet,
  FlaskConical,
} from 'lucide-react';
import { useAppStore } from '../lib/StoreContext';
import { switchUser } from '../lib/store';

type Page =
  | 'dashboard'
  | 'tenders'
  | 'projects'
  | 'site-forms'
  | 'snagging'
  | 'actions'
  | 'testing'
  | 'reports'
  | 'users'
  | 'settings';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const navItems: { id: Page; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenders', label: 'Tender & Estimating', icon: FileSpreadsheet },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'site-forms', label: 'Site Forms', icon: ClipboardList },
  { id: 'snagging', label: 'Snagging', icon: AlertTriangle },
  { id: 'actions', label: 'Actions Tracker', icon: CheckSquare },
  { id: 'testing', label: 'Testing & Commissioning', icon: FlaskConical },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activePage, onNavigate, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const store = useAppStore();
  const isClientUser = store.currentUser?.role === 'Client User';
  const isAdmin = store.currentUser?.role === 'Admin';
  const [showUserSwitch, setShowUserSwitch] = useState(false);

  // Pages hidden from Client Users
  const clientHiddenPages = new Set<Page>(['tenders', 'users', 'settings']);

  const visibleNavItems = isClientUser
    ? navItems.filter(item => !clientHiddenPages.has(item.id))
    : navItems;

  const handleNav = (page: Page) => {
    onNavigate(page);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-black border-r border-[#1a1a1a]
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo area */}
        <div className={`flex items-center h-20 px-4 border-b border-[#1a1a1a] shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <img
              src="/VYSITE_Logo_Long.png"
              alt="VYSITE"
              className="h-11 w-auto object-contain"
            />
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-[#f97316] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Main Menu
            </p>
          )}
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNav(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-150 group relative
                      ${isActive
                        ? 'bg-[#f97316] text-white shadow-lg shadow-orange-900/30'
                        : 'text-slate-400 hover:text-white hover:bg-[#1a1a1a]'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-[#1e2d4a] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                        {item.label}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Build marker — remove once Vercel deployment is confirmed */}
        {!collapsed && (
          <div className="shrink-0 px-4 pb-1">
            <p className="text-[9px] text-orange-500 font-mono font-bold tracking-wide">
              BUILD 1.1.0 – REPORTS CLEAN
            </p>
          </div>
        )}

        {/* Support link */}
        {!collapsed && (
          <div className="shrink-0 px-4 pb-2">
            <a
              href="mailto:support@vysite.co.uk"
              className="flex items-center gap-2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              <span className="w-1 h-1 rounded-full bg-slate-700 shrink-0" />
              Help & Support
            </a>
          </div>
        )}

        {/* User area */}
        <div className={`shrink-0 border-t border-[#1a1a1a] p-3 relative ${collapsed ? 'flex justify-center' : ''}`}>
          <div
            className={`flex items-center gap-3 ${!collapsed && isAdmin ? 'cursor-pointer hover:bg-[#1a1a1a] rounded-lg px-1 py-0.5 -mx-1 transition-colors' : ''}`}
            onClick={() => !collapsed && isAdmin && setShowUserSwitch(v => !v)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
              store.currentUser?.role === 'Admin' ? 'bg-[#f97316]' :
              store.currentUser?.role === 'Manager' ? 'bg-blue-600' :
              store.currentUser?.role === 'Client User' ? 'bg-teal-600' : 'bg-slate-600'
            }`}>
              {store.currentUser?.avatar_initials ?? '?'}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs font-semibold truncate">{store.currentUser?.name ?? 'No user set up'}</p>
                  <p className="text-slate-500 text-[10px] truncate">{store.currentUser?.role ?? 'Go to Users to add'}</p>
                </div>
                {isAdmin && <ChevronDown size={12} className={`text-slate-600 shrink-0 transition-transform ${showUserSwitch ? 'rotate-180' : ''}`} />}
              </>
            )}
          </div>

          {/* User switcher dropdown — Admin only */}
          {showUserSwitch && !collapsed && isAdmin && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden z-50">
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider px-3 pt-2.5 pb-1.5">Simulate As User</p>
              <div className="max-h-48 overflow-y-auto">
                {store.platformUsers.filter(u => u.status === 'Active').map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setShowUserSwitch(false); switchUser(u.name); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#2a2a2a] transition-colors ${store.currentUser?.id === u.id ? 'bg-[#f97316]/10' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${
                      u.role === 'Admin' ? 'bg-[#f97316]' :
                      u.role === 'Manager' ? 'bg-blue-600' :
                      u.role === 'Client User' ? 'bg-teal-600' : 'bg-slate-600'
                    }`}>{u.avatar_initials}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-300 truncate">{u.name}</p>
                      <p className="text-[10px] text-slate-600">{u.role}</p>
                    </div>
                    {store.currentUser?.id === u.id && <span className="text-[9px] text-[#f97316] font-bold shrink-0">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export type { Page };

interface MobileMenuButtonProps {
  onClick: () => void;
}

export function MobileMenuButton({ onClick }: MobileMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
    >
      <Menu size={20} />
    </button>
  );
}
