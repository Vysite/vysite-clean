import { useState, useMemo } from 'react';
import { Plus, Mail, Building2, X, User, Calendar, CheckSquare, Shield, Search, CreditCard as Edit2, Trash2, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../lib/StoreContext';
import type { DBPlatformUser, PlatformUserRole } from '../lib/store';

const roleColors: Record<PlatformUserRole, string> = {
  Admin: 'bg-red-900/60 text-red-400',
  Manager: 'bg-orange-900/60 text-orange-400',
  User: 'bg-blue-900/60 text-blue-400',
  'Client User': 'bg-teal-900/60 text-teal-400',
};

const roleDescriptions: Record<PlatformUserRole, string> = {
  Admin: 'Full platform access including settings and user management.',
  Manager: 'Full project access — can create and manage all items.',
  User: 'Can raise snags, forms and actions. View-only on commercial items.',
  'Client User': 'View-only access to assigned projects. Cannot edit or access internal data.',
};

const avatarColors = [
  'bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-sky-500',
];

function getAvatarColor(idx: number) {
  return avatarColors[idx % avatarColors.length];
}

// ─── View Profile Modal ───────────────────────────────────────────────────────

interface ViewProfileModalProps {
  user: DBPlatformUser;
  idx: number;
  onClose: () => void;
  onEdit: () => void;
}

function ViewProfileModal({ user, idx, onClose, onEdit }: ViewProfileModalProps) {
  const store = useAppStore();

  const userActions = store.actions.filter(a => a.owner === user.name);
  const userSnags = store.snags.filter(s => s.assignedTo === user.name);
  const openActions = userActions.filter(a => a.status !== 'Complete');
  const overdueActions = userActions.filter(a => a.overdue);
  const openSnags = userSnags.filter(s => s.status !== 'Closed');
  const assignedProjects = store.projects.filter(p => user.assigned_project_ids.includes(p.id));

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
          <h2 className="text-lg font-bold text-white">User Profile</h2>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors">
              <Edit2 size={12} />Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start gap-5">
            <div className={`w-16 h-16 rounded-2xl ${getAvatarColor(idx)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
              {user.avatar_initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-white">{user.name}</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${roleColors[user.role]}`}>{user.role}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {user.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-400 mt-1">
                <span className="flex items-center gap-1.5"><Mail size={13} className="text-slate-600" />{user.email}</span>
                {user.company && <span className="flex items-center gap-1.5"><Building2 size={13} className="text-slate-600" />{user.company}</span>}
                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-600" />
                  Joined {new Date(user.join_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {user.role === 'Client User' && (
            <div className="flex items-start gap-3 bg-teal-900/20 border border-teal-800/40 rounded-xl p-4">
              <Eye size={15} className="text-teal-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-teal-400">Client View Only</p>
                <p className="text-xs text-slate-400 mt-0.5">This user can view assigned projects, reports, snags and actions. They cannot edit records or access commercial workflows.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4 text-center">
              <p className="text-2xl font-bold text-white">{openActions.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Open Actions</p>
            </div>
            <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4 text-center">
              <p className={`text-2xl font-bold ${overdueActions.length > 0 ? 'text-red-400' : 'text-white'}`}>{overdueActions.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Overdue</p>
            </div>
            <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4 text-center">
              <p className="text-2xl font-bold text-white">{openSnags.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Open Snags</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Assigned Projects</p>
            {assignedProjects.length === 0 ? (
              <p className="text-sm text-slate-600">No projects currently assigned.</p>
            ) : (
              <div className="space-y-2">
                {assignedProjects.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-[#0d1628] rounded-xl border border-[#1e2d4a] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.client}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500">{p.progress}%</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        p.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' :
                        p.status === 'On Hold' ? 'bg-amber-900/60 text-amber-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {userActions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Actions</p>
              <div className="space-y-2">
                {userActions.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-start justify-between bg-[#0d1628] rounded-xl border border-[#1e2d4a] px-4 py-3 gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <CheckSquare size={13} className="text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-300 line-clamp-1">{a.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.overdue && <span className="text-[9px] font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded-full border border-red-800">OVERDUE</span>}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        a.status === 'Complete' ? 'bg-emerald-900/60 text-emerald-400' :
                        a.status === 'In Progress' ? 'bg-blue-900/60 text-blue-400' :
                        'bg-[#1e2d4a] text-slate-400'
                      }`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-[#1e2d4a]">
          <button onClick={onClose} className="px-5 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-300 hover:bg-[#1e2d4a] transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit / Invite / Add User Modal ──────────────────────────────────────────

interface UserFormModalProps {
  existing?: DBPlatformUser;
  mode?: 'invite' | 'add' | 'edit';
  onClose: () => void;
  onSave: (u: DBPlatformUser) => void;
}

function UserFormModal({ existing, mode = existing ? 'edit' : 'invite', onClose, onSave }: UserFormModalProps) {
  const store = useAppStore();
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    name: existing?.name ?? '',
    email: existing?.email ?? '',
    role: (existing?.role ?? 'User') as PlatformUserRole,
    company: existing?.company ?? 'VY Construction Ltd',
    status: (existing?.status ?? 'Active') as 'Active' | 'Inactive',
    assigned_project_ids: existing?.assigned_project_ids ?? [] as string[],
  });
  const [sent, setSent] = useState(false);

  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  const toggleProject = (id: string) => {
    setForm(f => ({
      ...f,
      assigned_project_ids: f.assigned_project_ids.includes(id)
        ? f.assigned_project_ids.filter(x => x !== id)
        : [...f.assigned_project_ids, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const initials = form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const user: DBPlatformUser = {
      id: existing?.id ?? `pu-${Date.now()}`,
      name: form.name,
      email: form.email,
      role: form.role,
      company: form.company,
      status: form.status,
      avatar_initials: existing?.avatar_initials ?? initials,
      join_date: existing?.join_date ?? new Date().toISOString().split('T')[0],
      assigned_project_ids: form.assigned_project_ids,
    };
    onSave(user);
    if (mode === 'invite') {
      setSent(true);
      setTimeout(() => onClose(), 2000);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">
            {mode === 'edit' ? 'Edit User' : mode === 'add' ? 'Add User' : 'Invite Team Member'}
          </h2>
            {mode === 'invite' && <p className="text-xs text-slate-500 mt-0.5">They will receive an email invitation to join VYSITE.</p>}
            {mode === 'add' && <p className="text-xs text-slate-500 mt-0.5">Create an internal account directly. No email sent.</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-emerald-400" />
            </div>
            <p className="text-white font-bold mb-1">Invitation Sent</p>
            <p className="text-sm text-slate-400">An invitation email has been sent to <span className="text-[#f97316]">{form.email}</span></p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. John Smith" />
              </div>
              <div>
                <label className={labelCls}>Email Address *</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="john@company.co.uk" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Role</label>
                <div className="relative mt-1.5">
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as PlatformUserRole }))}
                    className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] appearance-none pr-8">
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="User">User</option>
                    <option value="Client User">Client User</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputCls} />
              </div>
            </div>

            {isEdit && (
              <div>
                <label className={labelCls}>Status</label>
                <div className="flex gap-2 mt-1.5">
                  {(['Active', 'Inactive'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        form.status === s
                          ? s === 'Active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600'
                          : 'bg-[#0d1628] text-slate-400 border-[#1e2d4a] hover:border-slate-500'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
              <div className="flex items-start gap-3">
                <Shield size={15} className="text-[#f97316] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-300">Access: <span className="text-[#f97316]">{form.role}</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">{roleDescriptions[form.role]}</p>
                </div>
              </div>
            </div>

            {form.role === 'Client User' && (
              <div className="flex items-start gap-3 bg-teal-900/20 border border-teal-800/40 rounded-xl p-3">
                <EyeOff size={13} className="text-teal-400 mt-0.5 shrink-0" />
                <p className="text-xs text-teal-300">Client Users cannot access: Tender & Estimating, Settings, User Management, internal notes or commercial workflows.</p>
              </div>
            )}

            <div>
              <label className={labelCls}>Assign to Projects</label>
              <div className="mt-2 space-y-1.5">
                {store.projects.map(p => (
                  <label key={p.id} className="flex items-center gap-3 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-600 transition-colors">
                    <input type="checkbox" checked={form.assigned_project_ids.includes(p.id)} onChange={() => toggleProject(p.id)}
                      className="w-4 h-4 rounded accent-orange-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 truncate">{p.client}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      p.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-amber-900/60 text-amber-400'
                    }`}>{p.status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
              <button type="submit" className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
                {mode === 'edit' ? <><Edit2 size={14} />Save Changes</> : mode === 'add' ? <><Plus size={14} />Add User</> : <><Mail size={14} />Send Invitation</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Delete User Confirm Modal ────────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onConfirm }: { user: DBPlatformUser; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={20} className="text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white text-center mb-2">Delete User</h3>
          <p className="text-sm text-slate-400 text-center mb-1">
            <span className="font-semibold text-slate-200">{user.name}</span>
          </p>
          <p className="text-sm text-slate-500 text-center mb-6">
            This permanently removes the user from the system. Historical operational records may still retain references for audit purposes.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">Delete User</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Users() {
  const store = useAppStore();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [viewProfile, setViewProfile] = useState<{ user: DBPlatformUser; idx: number } | null>(null);
  const [editUser, setEditUser] = useState<DBPlatformUser | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DBPlatformUser | null>(null);

  const platformUsers = store.platformUsers;

  const filtered = useMemo(() => platformUsers.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.company.toLowerCase().includes(search.toLowerCase());
    return matchSearch
      && (filterRole === 'All' || u.role === filterRole)
      && (filterStatus === 'All' || u.status === filterStatus);
  }), [platformUsers, search, filterRole, filterStatus]);

  const stats = useMemo(() => ({
    total: platformUsers.filter(u => u.status === 'Active').length,
    admins: platformUsers.filter(u => u.role === 'Admin').length,
    managers: platformUsers.filter(u => u.role === 'Manager').length,
    clients: platformUsers.filter(u => u.role === 'Client User').length,
  }), [platformUsers]);

  const handleSaveUser = async (u: DBPlatformUser) => {
    if (platformUsers.find(x => x.id === u.id)) {
      await store.updatePlatformUser(u);
    } else {
      await store.addPlatformUser(u);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    await store.removePlatformUser(deleteTarget.id);
    setDeleteTarget(null);
  };

  const liveProfile = viewProfile
    ? (platformUsers.find(u => u.id === viewProfile.user.id) ?? viewProfile.user)
    : null;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Users</h2>
          <p className="text-sm text-slate-500">{stats.total} active team members</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 border border-[#1e2d4a] text-slate-300 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e2d4a] transition-colors">
            <Plus size={16} />Add User
          </button>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Mail size={16} />Invite User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Users', value: stats.total, color: 'text-white' },
          { label: 'Admins', value: stats.admins, color: 'text-red-400' },
          { label: 'Managers', value: stats.managers, color: 'text-orange-400' },
          { label: 'Client Users', value: stats.clients, color: 'text-teal-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
            {['All', 'Admin', 'Manager', 'User', 'Client User'].map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${filterRole === r ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{r}</button>
            ))}
          </div>
          <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1">
            {['All', 'Active', 'Inactive'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((user, idx) => {
          const userActions = store.actions.filter(a => a.owner === user.name && a.status !== 'Complete');
          const overdueCount = store.actions.filter(a => a.owner === user.name && a.overdue).length;
          const openSnags = store.snags.filter(s => s.assignedTo === user.name && s.status !== 'Closed').length;
          const assignedProjectCount = user.assigned_project_ids.length;

          return (
            <div key={user.id} className={`bg-[#1a2236] rounded-xl border transition-all ${user.status === 'Inactive' ? 'border-[#1e2d4a] opacity-60' : 'border-[#1e2d4a] hover:border-[#2a3d5a]'}`}>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${getAvatarColor(idx)} flex items-center justify-center text-white font-bold text-sm shrink-0 ${user.status === 'Inactive' ? 'grayscale' : ''}`}>
                    {user.avatar_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{user.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColors[user.role]}`}>{user.role}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-[#1e2d4a] text-slate-500'}`}>{user.status}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail size={12} className="text-slate-600 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.company && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Building2 size={12} className="text-slate-600 shrink-0" />
                      <span className="truncate">{user.company}</span>
                    </div>
                  )}
                </div>

                {user.role !== 'Client User' && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="bg-[#0d1628] rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-white">{userActions.length}</p>
                      <p className="text-[10px] text-slate-600">Actions</p>
                    </div>
                    <div className="bg-[#0d1628] rounded-lg p-2 text-center">
                      <p className={`text-sm font-bold ${overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>{overdueCount}</p>
                      <p className="text-[10px] text-slate-600">Overdue</p>
                    </div>
                    <div className="bg-[#0d1628] rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-white">{openSnags}</p>
                      <p className="text-[10px] text-slate-600">Snags</p>
                    </div>
                  </div>
                )}

                {user.role === 'Client User' && assignedProjectCount > 0 && (
                  <div className="mt-3 bg-[#0d1628] rounded-lg px-3 py-2 flex items-center gap-2">
                    <Eye size={11} className="text-teal-500 shrink-0" />
                    <p className="text-xs text-slate-400">{assignedProjectCount} project{assignedProjectCount !== 1 ? 's' : ''} assigned</p>
                  </div>
                )}
              </div>

              <div className="px-5 pb-4 border-t border-[#1e2d4a] pt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-600">
                  Joined {new Date(user.join_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewProfile({ user, idx })}
                    className="flex items-center gap-1 text-xs text-[#f97316] font-semibold hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-orange-950/30">
                    <User size={11} />Profile
                  </button>
                  <button onClick={() => setEditUser(user)}
                    className="flex items-center gap-1 text-xs text-slate-500 font-semibold hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-[#1e2d4a]">
                    <Edit2 size={11} />Edit
                  </button>
                  <button onClick={() => setDeleteTarget(user)}
                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-[#1e2d4a]"
                    title="Permanently delete user">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <User size={36} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No users match your filters</p>
          </div>
        )}
      </div>

      {liveProfile && viewProfile && (
        <ViewProfileModal
          user={liveProfile}
          idx={viewProfile.idx}
          onClose={() => setViewProfile(null)}
          onEdit={() => { setEditUser(liveProfile); setViewProfile(null); }}
        />
      )}
      {showInvite && (
        <UserFormModal
          mode="invite"
          onClose={() => setShowInvite(false)}
          onSave={async (u) => { await handleSaveUser(u); }}
        />
      )}
      {showAdd && (
        <UserFormModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSave={async (u) => { await handleSaveUser(u); setShowAdd(false); }}
        />
      )}
      {editUser && (
        <UserFormModal
          mode="edit"
          existing={editUser}
          onClose={() => setEditUser(null)}
          onSave={async (u) => { await handleSaveUser(u); setEditUser(null); }}
        />
      )}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteUser}
        />
      )}
    </div>
  );
}
