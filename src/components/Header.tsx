import { useState } from 'react';
import { Bell, Search, ChevronDown, X, CheckSquare, AlertTriangle, ClipboardList, CheckCircle, User, FolderOpen, LogOut, Settings } from 'lucide-react';
import { MobileMenuButton } from './Sidebar';
import type { Page } from './Sidebar';
import { useAppStore } from '../lib/StoreContext';
import type { DBNotification } from '../lib/store';
import { useAuth } from '../lib/AuthContext';

interface HeaderProps {
  activePage: Page;
  onOpenMobile: () => void;
  onNavigate: (page: Page) => void;
  onNotificationNavigate: (linkedType: string, linkedId: string) => void;
}

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  tenders: 'Tender & Estimating',
  projects: 'Projects',
  'site-forms': 'Site Forms',
  snagging: 'Snagging',
  actions: 'Actions Tracker',
  testing: 'Testing & Commissioning',
  reports: 'Reports',
  users: 'Users',
  'beta-feedback': 'BETA Feedback',
  settings: 'Settings',
};

function notifIcon(type: string) {
  if (type === 'action_assigned' || type === 'overdue') return <CheckSquare size={13} className="text-blue-400 shrink-0" />;
  if (type === 'snag_assigned') return <AlertTriangle size={13} className="text-amber-400 shrink-0" />;
  if (type === 'form_submitted') return <ClipboardList size={13} className="text-teal-400 shrink-0" />;
  if (type === 'mention') return <Bell size={13} className="text-orange-400 shrink-0" />;
  return <Bell size={13} className="text-slate-400 shrink-0" />;
}

function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead, onNotificationNavigate }: {
  notifications: DBNotification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNotificationNavigate: (linkedType: string, linkedId: string) => void;
}) {
  const unread = notifications.filter(n => !n.read);
  const recent = notifications.slice(0, 12);

  function handleClick(n: DBNotification) {
    if (!n.read) onMarkRead(n.id);
    if (n.linked_type && n.linked_id) {
      onNotificationNavigate(n.linked_type, n.linked_id);
      onClose();
    }
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-[#1a2236] border border-[#1e2d4a] rounded-2xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">Notifications</h3>
          {unread.length > 0 && (
            <span className="text-[10px] font-bold bg-[#f97316] text-white px-1.5 py-0.5 rounded-full">{unread.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button onClick={onMarkAllRead} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-semibold">
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {recent.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle size={24} className="text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">All caught up</p>
            <p className="text-xs text-slate-600 mt-0.5">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e2d4a]">
            {recent.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                  n.linked_type ? 'cursor-pointer hover:bg-[#0d1628]' : n.read ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-[#0d1628]'
                } ${n.read ? 'opacity-60' : ''}`}
              >
                <div className="mt-0.5">{notifIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-snug ${n.read ? 'text-slate-400' : 'text-slate-200'}`}>{n.title}</p>
                  {n.body && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {n.project_name && <span className="text-[10px] text-slate-600 truncate">{n.project_name}</span>}
                    {n.linked_type && <span className="text-[10px] text-[#f97316]/70 font-semibold">Tap to open →</span>}
                    {n.created_at && (
                      <span className="text-[10px] text-slate-700">
                        {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="px-4 py-3 border-t border-[#1e2d4a]">
          <p className="text-[10px] text-slate-600 text-center">Showing {recent.length} most recent notifications</p>
        </div>
      )}
    </div>
  );
}

function ProfileDropdown({ onNavigate, onClose }: { onNavigate: (page: Page) => void; onClose: () => void }) {
  const store = useAppStore();
  const { signOut, user: authUser } = useAuth();
  const user = store.currentUser;

  function go(page: Page) {
    onNavigate(page);
    onClose();
  }

  async function handleSignOut() {
    onClose();
    await signOut();
  }

  const displayEmail = authUser?.email ?? '';

  return (
    <div className="absolute right-0 top-full mt-2 w-56 bg-[#1a2236] border border-[#1e2d4a] rounded-2xl shadow-2xl z-50 overflow-hidden">
      {/* User info header */}
      <div className="px-4 py-3 border-b border-[#1e2d4a]">
        <p className="text-sm font-semibold text-slate-200 leading-tight">{user?.name ?? 'My Account'}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{user?.role ?? 'Authenticated User'}</p>
        {displayEmail && <p className="text-[10px] text-slate-600 mt-0.5 truncate">{displayEmail}</p>}
      </div>

      <div className="py-1">
        <button onClick={() => go('dashboard')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-[#0d1628] hover:text-white transition-colors">
          <User size={14} className="text-slate-500 shrink-0" />My Dashboard
        </button>
        <button onClick={() => go('projects')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-[#0d1628] hover:text-white transition-colors">
          <FolderOpen size={14} className="text-slate-500 shrink-0" />My Projects
        </button>
        {user?.role !== 'Client User' && (
          <button onClick={() => go('settings')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-[#0d1628] hover:text-white transition-colors">
            <Settings size={14} className="text-slate-500 shrink-0" />Settings
          </button>
        )}
      </div>

      <div className="border-t border-[#1e2d4a] py-1">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors"
        >
          <LogOut size={14} className="shrink-0" />Sign Out
        </button>
      </div>
    </div>
  );
}

export default function Header({ activePage, onOpenMobile, onNavigate, onNotificationNavigate }: HeaderProps) {
  const store = useAppStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const user = store.currentUser;
  const initials = user?.avatar_initials ?? 'JT';
  const myNotifications = store.notifications.filter(n =>
    !user || n.recipient_id === user.id
  );
  const unreadCount = myNotifications.filter(n => !n.read).length;

  return (
    <header className="h-20 bg-[#1a2236] border-b border-[#1e2d4a] flex items-center px-4 lg:px-6 gap-4 shrink-0">
      <MobileMenuButton onClick={onOpenMobile} />

      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-white truncate">{pageTitles[activePage]}</h1>
        <p className="text-xs text-slate-400 hidden sm:block">{today}</p>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 w-64">
        <Search size={14} className="text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Search..."
          className="bg-transparent text-sm text-slate-300 outline-none w-full placeholder:text-slate-500"
        />
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setShowNotif(v => !v); setShowProfile(false); }}
          className={`relative p-2 rounded-lg transition-colors ${showNotif ? 'bg-[#1e2d4a] text-white' : 'text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200'}`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-[#f97316] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotif && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
            <div className="relative z-50">
              <NotificationPanel
                notifications={myNotifications}
                onClose={() => setShowNotif(false)}
                onMarkRead={store.markNotificationRead}
                onMarkAllRead={store.markAllNotificationsRead}
                onNotificationNavigate={onNotificationNavigate}
              />
            </div>
          </>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => { setShowProfile(v => !v); setShowNotif(false); }}
          className={`flex items-center gap-2 pl-3 border-l border-[#1e2d4a] transition-colors ${showProfile ? 'opacity-100' : 'hover:opacity-90'}`}
        >
          <div className="w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-slate-200 leading-none">{user?.name ?? 'My Account'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.role ?? 'Administrator'}</p>
          </div>
          <ChevronDown size={14} className={`text-slate-500 hidden sm:block transition-transform ${showProfile ? 'rotate-180' : ''}`} />
        </button>

        {showProfile && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
            <div className="relative z-50">
              <ProfileDropdown onNavigate={onNavigate} onClose={() => setShowProfile(false)} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
