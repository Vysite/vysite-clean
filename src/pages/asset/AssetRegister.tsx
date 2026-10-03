import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Search, Package, X, AlertTriangle, ChevronDown, FileDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import { supabase } from '../../lib/supabase';
import type { DBAsset, AssetStatus } from './types';
import { ASSET_STATUSES, ASSET_TYPES, ASSET_STATUS_COLORS } from './types';
import { exportAssetRegisterPDF } from './AssetRegisterPDF';

interface Props {
  onSelectAsset: (a: DBAsset) => void;
}

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';
const PAGE_SIZE = 50;

export default function AssetRegister({ onSelectAsset }: Props) {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canCreate = perms['asset.create'] || isAdmin;

  const [search, setSearch] = useState('');
  const [filterSite, setFilterSite] = useState('All');
  const [filterBuilding, setFilterBuilding] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const sites = store.assetSites ?? [];
  const buildings = store.assetBuildings ?? [];
  const locations = store.assetLocations ?? [];

  // Build lookup maps for O(1) name resolution
  const siteMap = useMemo(() => new Map(sites.map(s => [s.id, s.name])), [sites]);
  const buildingMap = useMemo(() => new Map(buildings.map(b => [b.id, b.name])), [buildings]);
  const locationMap = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);

  const filteredBuildings = useMemo(() => {
    if (filterSite === 'All') return buildings;
    return buildings.filter(b => b.site_id === filterSite);
  }, [buildings, filterSite]);

  // Debounced server-side search + filter
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterSite, filterBuilding, filterType, filterStatus]);

  // Load register data from server whenever params change
  useEffect(() => {
    store.loadAssetRegister({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      siteId: filterSite,
      buildingId: filterBuilding,
      assetType: filterType,
      status: filterStatus,
    });
  }, [page, debouncedSearch, filterSite, filterBuilding, filterType, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = store.assetRegisterRows ?? [];
  const total = store.assetRegisterTotal ?? 0;
  const loading = store.assetRegisterLoading;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function siteName(id: string | null) { return id ? (siteMap.get(id) ?? '—') : '—'; }
  function buildingName(id: string | null) { return id ? (buildingMap.get(id) ?? '—') : '—'; }
  function locationName(id: string | null) { return id ? (locationMap.get(id) ?? '—') : '—'; }

  async function handleExportPDF() {
    setExporting(true);
    try {
      // Run a dedicated query for PDF export — separate from the paginated register
      const oid = store.currentOrgId;
      if (!oid) return;
      let q = supabase.from('vy_assets').select(ASSET_REGISTER_COLS).eq('org_id', oid);
      if (debouncedSearch) {
        q = q.or(`asset_tag.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%,manufacturer.ilike.%${debouncedSearch}%,model.ilike.%${debouncedSearch}%,serial_number.ilike.%${debouncedSearch}%`);
      }
      if (filterSite !== 'All') q = q.eq('site_id', filterSite);
      if (filterBuilding !== 'All') q = q.eq('building_id', filterBuilding);
      if (filterType !== 'All') q = q.eq('asset_type', filterType);
      if (filterStatus !== 'All') q = q.eq('status', filterStatus);
      q = q.order('updated_at', { ascending: false });
      const { data } = await q;
      exportAssetRegisterPDF({
        assets: (data ?? []) as DBAsset[],
        sites, buildings, locations,
        filters: {
          site: filterSite !== 'All' ? filterSite : null,
          building: filterBuilding !== 'All' ? filterBuilding : null,
          type: filterType !== 'All' ? filterType : null,
          status: filterStatus !== 'All' ? filterStatus : null,
          search: debouncedSearch || null,
        },
        currentUserName: store.currentUser?.name ?? '',
      });
    } finally {
      setExporting(false);
    }
  }

  function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs from server-side counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Assets" value={store.assetKPIs.total} color="text-white" />
        <KpiCard label="Active" value={store.assetKPIs.active} color="text-emerald-400" />
        <KpiCard label="Out of Service" value={store.assetKPIs.outOfService} color="text-amber-400" />
        <KpiCard label="Under Repair" value={store.assetKPIs.underRepair} color="text-orange-400" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tag, name, manufacturer, model, serial..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>
        <FilterSelect value={filterSite} onChange={setFilterSite} options={['All', ...sites.map(s => s.id)]} renderOpt={id => id === 'All' ? 'All Sites' : siteName(id)} />
        <FilterSelect value={filterBuilding} onChange={setFilterBuilding} options={['All', ...filteredBuildings.map(b => b.id)]} renderOpt={id => id === 'All' ? 'All Buildings' : buildingName(id)} />
        <FilterSelect value={filterType} onChange={setFilterType} options={['All', ...ASSET_TYPES]} renderOpt={t => t} />
        <FilterSelect value={filterStatus} onChange={setFilterStatus} options={['All', ...ASSET_STATUSES]} renderOpt={s => s} />
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors shrink-0">
            <Plus size={16} />Add Asset
          </button>
        )}
        <button onClick={handleExportPDF} disabled={exporting}
          className="flex items-center gap-2 text-slate-400 hover:text-[#f97316] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm font-semibold hover:border-[#f97316] transition-colors shrink-0 disabled:opacity-60">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}Export PDF
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Package size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">{total === 0 && !debouncedSearch && filterSite === 'All' && filterType === 'All' && filterStatus === 'All' ? 'No assets registered yet.' : 'No assets match your filters.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d4a]">
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3">Asset Tag</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3">Asset</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3">Type</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3 hidden md:table-cell">Manufacturer</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3 hidden lg:table-cell">Model</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3 hidden lg:table-cell">Serial</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3 hidden md:table-cell">Site</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3 hidden xl:table-cell">Building</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3 hidden xl:table-cell">Location</th>
                  <th className="text-left text-[10px] font-bold text-slate-600 uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0d1628]">
                {rows.map(a => (
                  <tr key={a.id} onClick={() => onSelectAsset(a)}
                    className="hover:bg-[#0d1628] cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-[#f97316] font-semibold">{a.asset_tag}</td>
                    <td className="px-4 py-3 text-sm text-slate-200 font-medium">{a.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{a.asset_type}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{a.manufacturer ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">{a.model ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono hidden lg:table-cell">{a.serial_number ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{siteName(a.site_id)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden xl:table-cell">{buildingName(a.building_id)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden xl:table-cell">{locationName(a.location_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ASSET_STATUS_COLORS[a.status as keyof typeof ASSET_STATUS_COLORS] ?? 'bg-slate-700 text-slate-400'}`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-400 border border-[#1e2d4a] rounded-lg hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={14} />Prev
            </button>
            <span className="text-xs text-slate-400 font-medium">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-400 border border-[#1e2d4a] rounded-lg hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Next<ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {showCreate && <CreateAssetModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// Lightweight columns for register — shared with store
const ASSET_REGISTER_COLS = 'id,asset_tag,name,asset_type,manufacturer,model,serial_number,site_id,building_id,location_id,status,project_id,project_name,updated_at';

function FilterSelect({ value, onChange, options, renderOpt }: { value: string; onChange: (v: string) => void; options: string[]; renderOpt: (id: string) => string }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 pr-8 text-sm text-slate-300 outline-none focus:border-[#f97316] appearance-none">
        {options.map(o => <option key={o} value={o}>{renderOpt(o)}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

function CreateAssetModal({ onClose }: { onClose: () => void }) {
  const store = useAppStore();
  const sites = store.assetSites ?? [];
  const buildings = store.assetBuildings ?? [];
  const locations = store.assetLocations ?? [];
  const projects = store.projects ?? [];

  const [form, setForm] = useState({
    name: '', asset_type: 'Other', manufacturer: '', model: '', serial_number: '',
    site_id: '', building_id: '', location_id: '', status: 'Active' as AssetStatus,
    installation_date: '', commissioning_date: '', warranty_expiry: '',
    project_id: '', notes: '', original_asset_cost: '', current_replacement_cost: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serialWarn, setSerialWarn] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (k === 'serial_number') setSerialWarn(false);
  };

  const filteredBuildings = buildings.filter(b => b.site_id === form.site_id);
  const filteredLocations = locations.filter(l => l.building_id === form.building_id);

  async function handleSerialBlur() {
    if (!form.serial_number.trim()) return;
    const dup = await store.checkSerialDuplicate(form.serial_number);
    if (dup) setSerialWarn(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Asset Name is required'); return; }
    if (!form.site_id) { setError('Site is required'); return; }
    setSaving(true);
    setError(null);

    const site = sites.find(s => s.id === form.site_id);
    const tagPrefix = site ? site.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() : 'AST';
    const typeAbbr = form.asset_type.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    // Use server-side count for tag sequence instead of scanning local array
    const { count } = await supabase.from('vy_assets')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', store.currentOrgId ?? '')
      .like('asset_tag', `${tagPrefix}-${typeAbbr}-%`);
    const nextNum = (count ?? 0) + 1;
    const autoTag = `${tagPrefix}-${typeAbbr}-${String(nextNum).padStart(4, '0')}`;

    const project = projects.find(p => p.id === form.project_id);

    const newAsset: Omit<DBAsset, 'id' | 'created_at' | 'updated_at'> = {
      org_id: store.currentOrgId ?? '',
      asset_tag: autoTag,
      name: form.name.trim(),
      asset_type: form.asset_type,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      site_id: form.site_id || null,
      building_id: form.building_id || null,
      location_id: form.location_id || null,
      status: form.status,
      installation_date: form.installation_date || null,
      commissioning_date: form.commissioning_date || null,
      warranty_expiry: form.warranty_expiry || null,
      project_id: form.project_id || null,
      project_name: project?.name ?? null,
      notes: form.notes || null,
      public_asset_token: null,
      created_by: store.currentUser?.name ?? null,
      original_asset_cost: form.original_asset_cost ? parseFloat(form.original_asset_cost) : null,
      current_replacement_cost: form.current_replacement_cost ? parseFloat(form.current_replacement_cost) : null,
    };

    const id = await store.addAsset(newAsset);
    setSaving(false);
    if (id) {
      await store.addAssetActivity({
        org_id: store.currentOrgId ?? '',
        asset_id: id,
        type: 'created',
        text: 'Asset created',
        user_name: store.currentUser?.name ?? '',
      });
      onClose();
    } else {
      setError('Failed to save asset. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-2xl my-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a] shrink-0">
          <h3 className="text-base font-bold text-white">Add New Asset</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2.5 text-xs text-red-400">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Asset Name *</label><input className={inputCls + ' mt-1.5'} value={form.name} onChange={set('name')} placeholder="e.g. AHU-01" required /></div>
            <div><label className={labelCls}>Asset Type *</label>
              <select className={inputCls + ' mt-1.5'} value={form.asset_type} onChange={set('asset_type')}>{ASSET_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </div>
            <div><label className={labelCls}>Manufacturer</label><input className={inputCls + ' mt-1.5'} value={form.manufacturer} onChange={set('manufacturer')} /></div>
            <div><label className={labelCls}>Model</label><input className={inputCls + ' mt-1.5'} value={form.model} onChange={set('model')} /></div>
            <div>
              <label className={labelCls}>Serial Number</label>
              <input className={inputCls + ' mt-1.5'} value={form.serial_number} onChange={set('serial_number')} onBlur={handleSerialBlur} />
              {serialWarn && <p className="mt-1 text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle size={11} />Serial number already exists in this organisation</p>}
            </div>
            <div><label className={labelCls}>Status</label><select className={inputCls + ' mt-1.5'} value={form.status} onChange={set('status')}>{ASSET_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className={labelCls}>Site *</label><select className={inputCls + ' mt-1.5'} value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value, building_id: '', location_id: '' }))}><option value="">Select site...</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className={labelCls}>Building</label><select className={inputCls + ' mt-1.5'} value={form.building_id} onChange={e => setForm(f => ({ ...f, building_id: e.target.value, location_id: '' }))} disabled={!form.site_id}><option value="">—</option>{filteredBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={labelCls}>Location</label><select className={inputCls + ' mt-1.5'} value={form.location_id} onChange={set('location_id')} disabled={!form.building_id}><option value="">—</option>{filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
            <div><label className={labelCls}>Project (optional)</label><select className={inputCls + ' mt-1.5'} value={form.project_id} onChange={set('project_id')}><option value="">—</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className={labelCls}>Installation Date</label><input type="date" className={inputCls + ' mt-1.5'} value={form.installation_date} onChange={set('installation_date')} /></div>
            <div><label className={labelCls}>Commissioning Date</label><input type="date" className={inputCls + ' mt-1.5'} value={form.commissioning_date} onChange={set('commissioning_date')} /></div>
            <div><label className={labelCls}>Warranty Expiry</label><input type="date" className={inputCls + ' mt-1.5'} value={form.warranty_expiry} onChange={set('warranty_expiry')} /></div>
          </div>
          <div className="border-t border-[#1e2d4a] pt-4 mt-2">
            <p className="text-xs font-bold text-[#f97316] uppercase tracking-wider mb-3">Asset Value</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Original Asset Cost (£)</label>
                <input type="number" step="0.01" min="0" className={inputCls + ' mt-1.5'} value={form.original_asset_cost} onChange={set('original_asset_cost')} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Current Replacement Cost (£)</label>
                <input type="number" step="0.01" min="0" className={inputCls + ' mt-1.5'} value={form.current_replacement_cost} onChange={set('current_replacement_cost')} placeholder="0.00" />
              </div>
            </div>
          </div>
          <div><label className={labelCls}>Notes</label><textarea className={inputCls + ' mt-1.5 resize-none'} rows={3} value={form.notes} onChange={set('notes')} /></div>
        </form>
        <div className="flex items-center justify-end gap-2 p-6 border-t border-[#1e2d4a] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={14} />}Create Asset
          </button>
        </div>
      </div>
    </div>
  );
}
