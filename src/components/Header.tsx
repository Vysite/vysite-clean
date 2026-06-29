import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Search, ChevronDown, X, CheckSquare, AlertTriangle, ClipboardList, CheckCircle, User, FolderOpen, LogOut, Settings, FileText, Wrench, ClipboardCheck, Briefcase, FolderKanban } from 'lucide-react';
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

// ─── Global search ────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  badge: string;
  badgeClass: string;
  page: Page;
  icon: React.ReactNode;
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-orange-500/30 text-orange-300 rounded-sm">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function GlobalSearch({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const store = useAppStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useCallback((): SearchResult[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchResult[] = [];

    const match = (...fields: (string | undefined | null)[]) =>
      fields.some(f => f && f.toLowerCase().includes(q));

    // Projects
    for (const p of store.projects) {
      if (match(p.name, p.client, p.location, p.projectManager, p.status)) {
        out.push({
          id: `project-${p.id}`,
          label: p.name,
          sub: `${p.client} · ${p.status}`,
          badge: 'Project',
          badgeClass: 'bg-blue-900/60 text-blue-300',
          page: 'projects',
          icon: <FolderKanban size={13} className="text-blue-400 shrink-0" />,
        });
      }
    }

    // Tenders
    for (const t of store.tenders) {
      if (match(t.name, t.ref, t.client, t.status, t.location)) {
        out.push({
          id: `tender-${t.id}`,
          label: t.name,
          sub: `${t.ref} · ${t.client} · ${t.status}`,
          badge: 'Tender',
          badgeClass: 'bg-emerald-900/60 text-emerald-300',
          page: 'tenders',
          icon: <Briefcase size={13} className="text-emerald-400 shrink-0" />,
        });
      }
    }

    // Site Forms
    for (const f of store.siteForms) {
      if (match(f.type, f.project_name, f.status, f.description, f.completed_by)) {
        out.push({
          id: `form-${f.id}`,
          label: f.type,
          sub: `${f.project_name} · ${f.status}`,
          badge: 'Site Form',
          badgeClass: 'bg-teal-900/60 text-teal-300',
          page: 'site-forms',
          icon: <FileText size={13} className="text-teal-400 shrink-0" />,
        });
      }
    }

    // Snags
    for (const s of store.snags) {
      if (match(s.title, s.projectName, s.status, s.description, s.location, s.assignedTo)) {
        out.push({
          id: `snag-${s.id}`,
          label: s.title,
          sub: `${s.projectName} · ${s.status} · ${s.priority}`,
          badge: 'Snag',
          badgeClass: 'bg-amber-900/60 text-amber-300',
          page: 'snagging',
          icon: <Wrench size={13} className="text-amber-400 shrink-0" />,
        });
      }
    }

    // Actions
    for (const a of store.actions) {
      if (match(a.title, a.projectName, a.status, a.description, a.owner, a.priority)) {
        out.push({
          id: `action-${a.id}`,
          label: a.title,
          sub: `${a.projectName} · ${a.status}`,
          badge: 'Action',
          badgeClass: 'bg-orange-900/60 text-orange-300',
          page: 'actions',
          icon: <ClipboardCheck size={13} className="text-orange-400 shrink-0" />,
        });
      }
    }

    // Project Documents
    for (const d of store.projectDocuments) {
      if (match(d.name, d.type, d.project_name, d.category)) {
        out.push({
          id: `doc-${d.id}`,
          label: d.name,
          sub: `${d.project_name} · ${d.type}`,
          badge: 'Document',
          badgeClass: 'bg-slate-700/60 text-slate-300',
          page: 'projects',
          icon: <FolderOpen size={13} className="text-slate-400 shrink-0" />,
        });
      }
    }

    return out.slice(0, 10);
  }, [query, store]);

  const items = results();

  useEffect(() => { setFocused(0); }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[focused]) { onNavigate(items[focused].page); setOpen(false); setQuery(''); } }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  }

  function handleSelect(item: SearchResult) {
    onNavigate(item.page);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative hidden md:block w-64">
      <div className="flex items-center gap-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 focus-within:border-slate-500 transition-colors">
        <Search size={14} className="text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="bg-transparent text-sm text-slate-300 outline-none w-full placeholder:text-slate-500"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="text-slate-600 hover:text-slate-400 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-2xl z-50 overflow-hidden">
          {items.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <Search size={16} className="text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No results for <span className="text-slate-300">"{query}"</span></p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-[#1e2d4a] flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{items.length} result{items.length !== 1 ? 's' : ''}</span>
                <span className="text-[10px] text-slate-600">↑↓ to navigate · Enter to open</span>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setFocused(i)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${i === focused ? 'bg-[#0d1628]' : 'hover:bg-[#0d1628]/50'}`}
                  >
                    <div className="shrink-0">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate">
                        {highlight(item.label, query)}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{item.sub}</div>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${item.badgeClass}`}>{item.badge}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  tenders: 'Tender & Estimating',
  projects: 'Projects',
  maintenance: 'Maintenance & Servicing',
  'site-forms': 'Site Forms',
  snagging: 'Snagging',
  actions: 'Actions Tracker',
  testing: 'O&M Manual',
  reports: 'Reports',
  'beta-feedback': 'BETA Feedback',
  settings: 'Settings',
  'super-admin': 'Super Admin',
  'super-admin-orgs': 'Organisations',
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
      <GlobalSearch onNavigate={onNavigate} />

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
