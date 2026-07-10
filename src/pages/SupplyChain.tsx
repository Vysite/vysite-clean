import React, { useState } from 'react';
import {
  Network, Plus, Search, Star, CheckCircle2, Clock, AlertTriangle,
  X, Building2, ChevronDown, Filter, Settings2, SlidersHorizontal,
} from 'lucide-react';
import { useAppStore, usePermissions } from '../lib/StoreContext';
import type { DBSupplier } from './supplychain/types';
import { APPROVAL_STATUSES, REGIONS, PQQ_STATUSES } from './supplychain/types';
import SupplierDetail from './supplychain/SupplierDetail';
import SupplyChainSettings from './supplychain/SupplyChainSettings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() { return `sc${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function isExpiringSoon(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const diff = (d.getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff <= 30;
}
function isExpired(dateStr: string) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

const APPROVAL_COLORS: Record<string, string> = {
  'Pending':                'bg-slate-900/60 text-slate-400 border-slate-700',
  'Under Review':           'bg-amber-900/40 text-amber-400 border-amber-800',
  'Approved':               'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  'Conditionally Approved': 'bg-blue-900/40 text-blue-400 border-blue-800',
  'Rejected':               'bg-red-900/40 text-red-400 border-red-800',
  'Suspended':              'bg-orange-900/40 text-orange-400 border-orange-800',
};

const PQQ_STATUS_COLORS: Record<string, string> = {
  'Not Started': 'text-slate-500',
  'In Progress': 'text-amber-400',
  'Complete':    'text-emerald-400',
};

// ─── Create Supplier Modal ────────────────────────────────────────────────────

function CreateSupplierModal({ onClose, onSave }: { onClose: () => void; onSave: (s: DBSupplier) => void }) {
  const store = useAppStore();
  const [form, setForm] = useState({
    company_name: '',
    trading_name: '',
    general_email: '',
    general_telephone: '',
    supplier_type: '',
    primary_contact: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const supplier: DBSupplier = {
      id: genId(),
      org_id: store.currentOrgId ?? '',
      company_name: form.company_name.trim(),
      trading_name: form.trading_name.trim(),
      company_number: '', vat_number: '', utr_number: '',
      reg_address_line1: '', reg_address_line2: '', reg_address_city: '',
      reg_address_county: '', reg_address_postcode: '', reg_address_country: 'United Kingdom',
      trading_address_same: true,
      trade_address_line1: '', trade_address_line2: '', trade_address_city: '',
      trade_address_county: '', trade_address_postcode: '', trade_address_country: 'United Kingdom',
      website: '',
      general_email: form.general_email.trim(),
      general_telephone: form.general_telephone.trim(),
      primary_contact: form.primary_contact.trim(),
      contact_position: '', mobile_number: '', company_description: '',
      supplier_type: form.supplier_type,
      preferred_supplier: false,
      approval_status: 'Pending',
      approval_date: '', approved_by: '', approval_notes: '',
      primary_trade_id: '',
      regions: [],
      min_package_value: null, preferred_package_value: null, max_package_value: null,
      pqq_status: 'Not Started',
      pqq_import_raw: null,
      notes: '',
      created_by: store.currentUser?.name ?? '',
      created_at: today,
      updated_at: today,
    };
    await store.addSupplier(supplier);
    onSave(supplier);
    setSaving(false);
    onClose();
  }

  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2d4a]">
          <h2 className="text-base font-bold text-white">Add Supplier</h2>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-[#0d1628] rounded-lg transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Company Name *</label>
            <input required autoFocus className={inputCls} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Smith Electrical Ltd" />
          </div>
          <div>
            <label className={labelCls}>Trading Name</label>
            <input className={inputCls} value={form.trading_name} onChange={e => setForm(f => ({ ...f, trading_name: e.target.value }))} placeholder="If different from company name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>General Email</label>
              <input type="email" className={inputCls} value={form.general_email} onChange={e => setForm(f => ({ ...f, general_email: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Telephone</label>
              <input className={inputCls} value={form.general_telephone} onChange={e => setForm(f => ({ ...f, general_telephone: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Supplier Type</label>
              <select className={inputCls} value={form.supplier_type} onChange={e => setForm(f => ({ ...f, supplier_type: e.target.value }))}>
                <option value="">— Select —</option>
                {['Contractor','Subcontractor','Specialist Subcontractor','Consultant','Supplier / Manufacturer','Labour Only','Other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Primary Contact</label>
              <input className={inputCls} value={form.primary_contact} onChange={e => setForm(f => ({ ...f, primary_contact: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.company_name.trim()} className="px-5 py-2 bg-[#f97316] hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors">
              {saving ? 'Adding…' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterState {
  status: string;
  preferred: string;
  trade: string;
  specialism: string;
  region: string;
  pqqStatus: string;
  maxPackage: string;
  expiringDocs: boolean;
}

function FilterPanel({
  filters,
  onChange,
  onClear,
  trades,
  specialisms,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClear: () => void;
  trades: { id: string; name: string }[];
  specialisms: { id: string; name: string }[];
}) {
  const selectCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#f97316]';

  return (
    <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div>
        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">Status</label>
        <select className={selectCls} value={filters.status} onChange={e => onChange({ ...filters, status: e.target.value })}>
          <option value="">All</option>
          {APPROVAL_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">Trade</label>
        <select className={selectCls} value={filters.trade} onChange={e => onChange({ ...filters, trade: e.target.value })}>
          <option value="">All</option>
          {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">Specialism</label>
        <select className={selectCls} value={filters.specialism} onChange={e => onChange({ ...filters, specialism: e.target.value })}>
          <option value="">All</option>
          {specialisms.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">Coverage</label>
        <select className={selectCls} value={filters.region} onChange={e => onChange({ ...filters, region: e.target.value })}>
          <option value="">All</option>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">PQQ Status</label>
        <select className={selectCls} value={filters.pqqStatus} onChange={e => onChange({ ...filters, pqqStatus: e.target.value })}>
          <option value="">All</option>
          {PQQ_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">Preferred</label>
        <select className={selectCls} value={filters.preferred} onChange={e => onChange({ ...filters, preferred: e.target.value })}>
          <option value="">All</option>
          <option value="preferred">Preferred Only</option>
          <option value="standard">Standard Only</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">Max Package (£)</label>
        <input
          type="number"
          placeholder="e.g. 500000"
          className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#f97316]"
          value={filters.maxPackage}
          onChange={e => onChange({ ...filters, maxPackage: e.target.value })}
        />
      </div>
      <div className="flex items-end gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={filters.expiringDocs} onChange={e => onChange({ ...filters, expiringDocs: e.target.checked })} className="w-3.5 h-3.5 accent-[#f97316]" />
          <span className="text-xs text-slate-400">Expiring Docs</span>
        </label>
        <button onClick={onClear} className="text-xs text-slate-500 hover:text-white underline ml-auto">Clear</button>
      </div>
    </div>
  );
}

// ─── Supplier Row ─────────────────────────────────────────────────────────────

function SupplierRow({
  supplier,
  primaryTradeName,
  onOpen,
  onDelete,
  canEdit,
}: {
  supplier: DBSupplier;
  primaryTradeName: string;
  onOpen: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <tr className="hover:bg-[#1a2236]/60 transition-colors group cursor-pointer" onClick={onOpen}>
      <td className="py-3.5 pl-5 pr-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0 group-hover:border-[#f97316]/30 transition-colors">
            <Building2 size={14} className="text-slate-500 group-hover:text-[#f97316] transition-colors" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{supplier.company_name}</p>
            {supplier.trading_name && supplier.trading_name !== supplier.company_name && (
              <p className="text-[10px] text-slate-600">t/a {supplier.trading_name}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3.5 px-3">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${APPROVAL_COLORS[supplier.approval_status] ?? APPROVAL_COLORS['Pending']}`}>
          {supplier.approval_status}
        </span>
      </td>
      <td className="py-3.5 px-3">
        {supplier.preferred_supplier && (
          <Star size={13} className="text-amber-400" fill="currentColor" />
        )}
      </td>
      <td className="py-3.5 px-3 text-xs text-slate-400">{primaryTradeName || '—'}</td>
      <td className="py-3.5 px-3 text-xs text-slate-400">{supplier.supplier_type || '—'}</td>
      <td className="py-3.5 px-3">
        <span className={`text-[10px] font-semibold ${PQQ_STATUS_COLORS[supplier.pqq_status] ?? 'text-slate-500'}`}>
          {supplier.pqq_status}
        </span>
      </td>
      <td className="py-3.5 px-3 text-xs text-slate-500">
        {supplier.regions.length > 0 ? (
          <span>{supplier.regions.includes('Nationwide') ? 'Nationwide' : `${supplier.regions.length} region${supplier.regions.length === 1 ? '' : 's'}`}</span>
        ) : '—'}
      </td>
      <td className="py-3.5 pr-5 pl-3" onClick={e => e.stopPropagation()}>
        {canEdit && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="px-2 py-1 bg-red-900/40 text-red-400 border border-red-800 rounded text-[10px] font-semibold">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="p-1 text-slate-500 hover:text-white"><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="opacity-0 group-hover:opacity-100 px-2 py-1 text-slate-500 hover:text-red-400 text-[10px] transition-all">Remove</button>
          )
        )}
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = 'suppliers' | 'settings';

const EMPTY_FILTERS: FilterState = {
  status: '', preferred: '', trade: '', specialism: '', region: '', pqqStatus: '', maxPackage: '', expiringDocs: false,
};

export default function SupplyChain() {
  const store = useAppStore();
  const perms = usePermissions();
  const canView = perms['supply_chain.view'] ?? perms['supply_chain.create_edit'] ?? false;
  const canEdit = perms['supply_chain.create_edit'] ?? false;

  const [mainTab, setMainTab] = useState<MainTab>('suppliers');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<DBSupplier | null>(null);

  if (!canView) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center mb-4">
          <Network size={24} className="text-slate-500" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Supply Chain</h2>
        <p className="text-sm text-slate-500 max-w-xs">You do not have permission to view the Supply Chain module.</p>
      </div>
    );
  }

  const activeFilters = Object.values(filters).some(v => v !== '' && v !== false);

  // Apply filters + search
  const filteredSuppliers = store.suppliers.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.company_name.toLowerCase().includes(q) &&
          !s.trading_name.toLowerCase().includes(q) &&
          !s.primary_contact.toLowerCase().includes(q) &&
          !s.general_email.toLowerCase().includes(q)) return false;
    }
    if (filters.status && s.approval_status !== filters.status) return false;
    if (filters.preferred === 'preferred' && !s.preferred_supplier) return false;
    if (filters.preferred === 'standard' && s.preferred_supplier) return false;
    if (filters.pqqStatus && s.pqq_status !== filters.pqqStatus) return false;
    if (filters.region && !s.regions.includes(filters.region)) return false;
    if (filters.maxPackage) {
      const max = parseFloat(filters.maxPackage);
      if (!s.max_package_value || s.max_package_value < max) return false;
    }
    return true;
  });

  // Stats
  const total = store.suppliers.length;
  const approved = store.suppliers.filter(s => s.approval_status === 'Approved').length;
  const pending = store.suppliers.filter(s => s.approval_status === 'Pending' || s.approval_status === 'Under Review').length;
  const preferred = store.suppliers.filter(s => s.preferred_supplier).length;

  const tabCls = (t: MainTab) => `px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
    mainTab === t ? 'text-[#f97316] border-[#f97316]' : 'text-slate-500 border-transparent hover:text-slate-300'
  }`;

  return (
    <div className="flex flex-col min-h-full bg-[#111827]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[#1e2d4a]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center">
              <Network size={18} className="text-[#f97316]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Supply Chain</h1>
              <p className="text-xs text-slate-500">Supplier management & compliance</p>
            </div>
          </div>
          {canEdit && mainTab === 'suppliers' && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#f97316] hover:bg-orange-400 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-900/20">
              <Plus size={15} /> Add Supplier
            </button>
          )}
        </div>

        {/* Stats */}
        {mainTab === 'suppliers' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Suppliers', value: total, icon: <Building2 size={14} />, color: 'text-slate-300' },
              { label: 'Approved',        value: approved, icon: <CheckCircle2 size={14} />, color: 'text-emerald-400' },
              { label: 'Pending / Review',value: pending,  icon: <Clock size={14} />,        color: 'text-amber-400' },
              { label: 'Preferred',       value: preferred, icon: <Star size={14} />,         color: 'text-amber-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className={`${stat.color} shrink-0`}>{stat.icon}</span>
                <div>
                  <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1">
          <button className={tabCls('suppliers')} onClick={() => setMainTab('suppliers')}>Suppliers</button>
          {canEdit && <button className={tabCls('settings')} onClick={() => setMainTab('settings')}><Settings2 size={11} className="inline mr-1" />Settings</button>}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-5">
        {mainTab === 'settings' ? (
          <SupplyChainSettings />
        ) : (
          <div className="space-y-4">
            {/* Search + filter toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  placeholder="Search suppliers…"
                  className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  showFilters || activeFilters
                    ? 'bg-[#f97316]/10 border-[#f97316] text-[#f97316]'
                    : 'bg-[#1a2236] border-[#1e2d4a] text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFilters && <span className="w-1.5 h-1.5 bg-[#f97316] rounded-full" />}
              </button>
            </div>

            {showFilters && (
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                onClear={() => setFilters(EMPTY_FILTERS)}
                trades={store.supplierTrades.filter(t => t.is_active)}
                specialisms={store.supplierSpecialisms.filter(s => s.is_active)}
              />
            )}

            {/* Table */}
            {store.modulesLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading suppliers…</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center mb-4">
                  <Network size={22} className="text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-400 mb-1">
                  {total === 0 ? 'No suppliers yet' : 'No suppliers match your filters'}
                </p>
                {total === 0 && canEdit && (
                  <p className="text-xs text-slate-600">Click <span className="font-semibold text-[#f97316]">Add Supplier</span> to get started.</p>
                )}
              </div>
            ) : (
              <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e2d4a]">
                      <th className="text-left py-3 pl-5 pr-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                      <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pref</th>
                      <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Primary Trade</th>
                      <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">PQQ</th>
                      <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Coverage</th>
                      <th className="py-3 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2d4a]">
                    {filteredSuppliers.map(s => (
                      <SupplierRow
                        key={s.id}
                        supplier={s}
                        primaryTradeName={store.supplierTrades.find(t => t.id === s.primary_trade_id)?.name ?? ''}
                        onOpen={() => setSelectedSupplier(s)}
                        onDelete={() => store.removeSupplier(s.id)}
                        canEdit={canEdit}
                      />
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-[#1e2d4a]">
                  <p className="text-[10px] text-slate-600">{filteredSuppliers.length} supplier{filteredSuppliers.length === 1 ? '' : 's'}{activeFilters ? ' (filtered)' : ''}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateSupplierModal
          onClose={() => setShowCreate(false)}
          onSave={s => setSelectedSupplier(s)}
        />
      )}

      {selectedSupplier && (
        <SupplierDetail
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onUpdate={updated => {
            store.updateSupplier(updated);
            setSelectedSupplier(updated);
          }}
        />
      )}
    </div>
  );
}
