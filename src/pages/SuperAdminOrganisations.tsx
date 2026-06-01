import { useEffect, useState } from 'react';
import {
  Building2, Search, Archive, RotateCcw, Trash2,
  AlertCircle, ChevronDown, Calendar, Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConfirmDeleteOrgModal from '../components/ConfirmDeleteOrgModal';

type OrgStatus = 'active' | 'archived' | 'deleted';

interface Org {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  created_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  // joined from org_settings
  account_type?: string;
  account_status?: string;
  trial_expires_at?: string | null;
  // joined counts
  user_count?: number;
}

const STATUS_FILTERS: { label: string; value: OrgStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
];

function StatusBadge({ status }: { status: OrgStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Active
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-900/40 text-amber-400 border border-amber-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-900/40 text-red-400 border border-red-800/50">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Deleted
    </span>
  );
}

function AccountTypeBadge({ type }: { type?: string }) {
  if (type === 'trial') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-900/40 text-sky-400 border border-sky-800/50">
        Trial
      </span>
    );
  }
  if (type === 'internal') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/50">
        Internal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-900/40 text-[#f97316] border border-orange-800/50">
      Paid
    </span>
  );
}

export default function SuperAdminOrganisations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrgStatus | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => { loadOrgs(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-org-menu]')) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function loadOrgs() {
    setLoading(true);
    setError(null);
    try {
      const { data: orgRows, error: orgErr } = await supabase
        .from('organisations')
        .select('id, name, slug, status, created_at, archived_at, deleted_at')
        .order('created_at', { ascending: false });

      if (orgErr) throw orgErr;

      const orgIds = (orgRows ?? []).map(o => o.id);

      // Fetch org_settings in parallel with user counts
      const [settingsRes, userCountRes] = await Promise.all([
        supabase
          .from('org_settings')
          .select('org_id, account_type, account_status, trial_expires_at')
          .in('org_id', orgIds),
        supabase
          .from('user_orgs')
          .select('org_id')
          .in('org_id', orgIds)
          .eq('status', 'active'),
      ]);

      const settingsMap = new Map(
        (settingsRes.data ?? []).map(s => [s.org_id, s])
      );

      // Count users per org
      const userCountMap = new Map<string, number>();
      for (const row of userCountRes.data ?? []) {
        userCountMap.set(row.org_id, (userCountMap.get(row.org_id) ?? 0) + 1);
      }

      const enriched: Org[] = (orgRows ?? []).map(o => ({
        ...o,
        ...settingsMap.get(o.id),
        user_count: userCountMap.get(o.id) ?? 0,
      }));

      setOrgs(enriched);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }

  async function archiveOrg(org: Org) {
    setActionLoading(org.id);
    setActionError(null);
    const { error } = await supabase
      .from('organisations')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (error) {
      setActionError(error.message);
    } else {
      // Also disable account access
      await supabase
        .from('org_settings')
        .update({ account_status: 'disabled', updated_by: 'super-admin:archive' })
        .eq('org_id', org.id);
      await loadOrgs();
    }
    setActionLoading(null);
    setOpenMenuId(null);
  }

  async function restoreOrg(org: Org) {
    setActionLoading(org.id);
    setActionError(null);
    const { error } = await supabase
      .from('organisations')
      .update({
        status: 'active',
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (error) {
      setActionError(error.message);
    } else {
      await supabase
        .from('org_settings')
        .update({ account_status: 'active', updated_by: 'super-admin:restore' })
        .eq('org_id', org.id);
      await loadOrgs();
    }
    setActionLoading(null);
    setOpenMenuId(null);
  }

  async function handleDeleteConfirmed(org: Org) {
    setActionLoading(org.id);
    setActionError(null);
    setDeleteTarget(null);

    const { error } = await supabase.rpc('super_admin_delete_org', { p_org_id: org.id });

    if (error) {
      setActionError(`Delete failed: ${error.message}`);
      setActionLoading(null);
    } else {
      await loadOrgs();
      setActionLoading(null);
    }
  }

  const filtered = orgs.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: orgs.length,
    active: orgs.filter(o => o.status === 'active').length,
    archived: orgs.filter(o => o.status === 'archived').length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center">
            <Building2 size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Organisations</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {counts.active} active · {counts.archived} archived
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-lg bg-red-900/20 border border-red-800/40">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{actionError}</p>
          <button onClick={() => setActionError(null)} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search organisations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#f97316] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-[10px] ${statusFilter === f.value ? 'opacity-80' : 'text-slate-600'}`}>
                {counts[f.value === 'all' ? 'all' : f.value as 'active' | 'archived']}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No organisations found</p>
        </div>
      ) : (
        <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2d4a]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organisation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Users</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]/60">
              {filtered.map(org => (
                <tr key={org.id} className="hover:bg-[#0d1628]/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-slate-300">
                          {org.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{org.name}</p>
                        <p className="text-xs text-slate-500 truncate">{org.slug}</p>
                      </div>
                    </div>
                    {/* Mobile-only status */}
                    <div className="mt-1.5 sm:hidden">
                      <StatusBadge status={org.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <div className="flex flex-col gap-1.5">
                      <StatusBadge status={org.status} />
                      {org.status === 'archived' && org.archived_at && (
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Calendar size={9} />
                          {new Date(org.archived_at).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex flex-col gap-1">
                      <AccountTypeBadge type={org.account_type} />
                      {org.account_type === 'trial' && org.trial_expires_at && (
                        <span className={`text-[10px] flex items-center gap-1 ${
                          new Date(org.trial_expires_at) < new Date() ? 'text-red-400' : 'text-slate-600'
                        }`}>
                          <Calendar size={9} />
                          Expires {new Date(org.trial_expires_at).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Users size={13} className="text-slate-500" />
                      {org.user_count}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-slate-500">
                      {new Date(org.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="relative inline-block" data-org-menu>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === org.id ? null : org.id)}
                        disabled={actionLoading === org.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d1628] border border-[#1e2d4a] text-xs text-slate-300 hover:text-white hover:border-[#2e3d5a] transition-colors disabled:opacity-50"
                      >
                        {actionLoading === org.id ? (
                          <span className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>Actions <ChevronDown size={12} /></>
                        )}
                      </button>

                      {openMenuId === org.id && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-[#0d1628] border border-[#1e2d4a] rounded-xl shadow-2xl shadow-black/50 z-50 py-1 overflow-hidden">
                          {org.status === 'active' && (
                            <button
                              onClick={() => archiveOrg(org)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-amber-400 hover:bg-amber-900/20 transition-colors"
                            >
                              <Archive size={13} />
                              Archive Organisation
                            </button>
                          )}
                          {org.status === 'archived' && (
                            <button
                              onClick={() => restoreOrg(org)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-emerald-400 hover:bg-emerald-900/20 transition-colors"
                            >
                              <RotateCcw size={13} />
                              Restore Organisation
                            </button>
                          )}
                          <div className="border-t border-[#1e2d4a] my-1" />
                          <button
                            onClick={() => { setDeleteTarget(org); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 size={13} />
                            Permanently Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmDeleteOrgModal
          org={deleteTarget}
          onConfirm={() => handleDeleteConfirmed(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}


export default SuperAdminOrganisations