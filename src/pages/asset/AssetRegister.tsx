import { useState, useMemo } from 'react';
import { Plus, Search, Package, X, AlertTriangle, ChevronDown } from 'lucide-react';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import type { DBAsset, AssetStatus } from './types';
import { ASSET_STATUSES, ASSET_TYPES, ASSET_STATUS_COLORS } from './types';

interface Props {
  onSelectAsset: (a: DBAsset) => void;
}

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

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

  const assets = store.assets ?? [];
  const sites = store.assetSites ?? [];
  const buildings = store.assetBuildings ?? [];
  const locations = store.assetLocations ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return assets.filter(a => {
      if (q && !(
        a.asset_tag.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.manufacturer ?? '').toLowerCase().includes(q) ||
        (a.model ?? '').toLowerCase().includes(q) ||
        (a.serial_number ?? '').toLowerCase().includes(q)
      )) return false;
      if (filterSite !== 'All' && a.site_id !== filterSite) return false;
      if (filterBuilding !== 'All' && a.building_id !== filterBuilding) return false;
      if (filterType !== 'All' && a.asset_type !== filterType) return false;
      if (filterStatus !== 'All' && a.status !== filterStatus) return false;
      return true;
    });
  }, [assets, search, filterSite, filterBuilding, filterType, filterStatus]);

  const kpiStats = useMemo(() => ({
    total: assets.length,
    active: assets.filter(a => a.status === 'Active').length,
    outOfService: assets.filter(a => a.status === 'Out of Service').length,
    underRepair: assets.filter(a => a.status === 'Under Repair').length,
  }), [assets]);

  const filteredBuildings = useMemo(() => {
    if (filterSite === 'All') return buildings;
    return buildings.filter(b => b.site_id === filterSite);
  }, [buildings, filterSite]);

  function siteName(id: string | null) { return sites.find(s => s.id === id)?.name ?? '—'; }
  function buildingName(id: string | null) { return buildings.find(b => b.id === id)?.name ?? '—'; }
  function locationName(id: string | null) { return locations.find(l => l.id === id)?.name ?? '—'; }

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
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Assets" value={kpiStats.total} color="text-white" />
        <KpiCard label="Active" value={kpiStats.active} color="text-emerald-400" />
        <KpiCard label="Out of Service" value={kpiStats.outOfService} color="text-amber-400" />
        <KpiCard label="Under Repair" value={kpiStats.underRepair} color="text-orange-400" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 flex-1 min-w-0">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tag, name, manufacturer, model, serial..."
            className="bg-transparent text-sm text-slate-300 outline-none flex-1 placeholder:text-slate-600" />
        </div>
        <FilterSelect value={filterSite} onChange={setFilterSite} options={['All', ...sites.map(s => s.id)]} labels={{ All: 'All Sites' }} renderOpt={id => id === 'All' ? 'All Sites' : siteName(id)} />
        <FilterSelect value={filterBuilding} onChange={setFilterBuilding} options={['All', ...filteredBuildings.map(b => b.id)]} labels={{ All: 'All Buildings' }} renderOpt={id => id === 'All' ? 'All Buildings' : buildingName(id)} />
        <FilterSelect value={filterType} onChange={setFilterType} options={['All', ...ASSET_TYPES]} labels={{ All: 'All Types' }} renderOpt={t => t} />
        <FilterSelect value={filterStatus} onChange={setFilterStatus} options={['All', ...ASSET_STATUSES]} labels={{ All: 'All Statuses' }} renderOpt={s => s} />
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors shrink-0">
            <Plus size={16} />Add Asset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
        {store.assetsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">{assets.length === 0 ? 'No assets registered yet.' : 'No assets match your filters.'}</p>
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
                {filtered.map(a => (
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

      {showCreate && <CreateAssetModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function FilterSelect({ value, onChange, options, renderOpt }: { value: string; onChange: (v: string) => void; options: string[]; labels: Record<string, string>; renderOpt: (id: string) => string }) {
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
    project_id: '', notes: '',
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
    const existingCount = store.assets.filter(a => a.asset_tag.startsWith(`${tagPrefix}-${typeAbbr}-`)).length;
    const autoTag = `${tagPrefix}-${typeAbbr}-${String(existingCount + 1).padStart(4, '0')}`;

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
