import { useState } from 'react';
import { Plus, X, ChevronRight, ChevronDown, MapPin, Building2, Layers, Trash2, Edit3, Save, Package } from 'lucide-react';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import type { DBAssetSite, DBAssetBuilding, DBAssetLocation, LocationStatus } from './types';

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

export default function SitesLocations() {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canEdit = perms['asset.edit'] || isAdmin;

  const sites = store.assetSites;
  const buildings = store.assetBuildings;
  const locations = store.assetLocations;
  const assets = store.assets;

  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<DBAssetSite | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<DBAssetBuilding | null>(null);
  const [editingLocation, setEditingLocation] = useState<DBAssetLocation | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddBuilding, setShowAddBuilding] = useState<string | null>(null);
  const [showAddLocation, setShowAddLocation] = useState<string | null>(null);

  function assetsAtSite(siteId: string) { return assets.filter(a => a.site_id === siteId).length; }
  function assetsAtBuilding(bldId: string) { return assets.filter(a => a.building_id === bldId).length; }
  function assetsAtLocation(locId: string) { return assets.filter(a => a.location_id === locId).length; }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit && (
          <button onClick={() => setShowAddSite(true)} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Plus size={16} />Add Site
          </button>
        )}
      </div>

      {sites.length === 0 ? (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-8 text-center">
          <MapPin size={28} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No sites created yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sites.map(site => {
            const siteBuildings = buildings.filter(b => b.site_id === site.id);
            const isExpanded = expandedSite === site.id;
            return (
              <div key={site.id} className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#0d1628] transition-colors cursor-pointer"
                  onClick={() => setExpandedSite(isExpanded ? null : site.id)}>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                  <MapPin size={16} className="text-[#f97316]" />
                  <span className="text-sm font-semibold text-white flex-1">{site.name}</span>
                  <span className="text-[10px] text-slate-600">{siteBuildings.length} buildings · {assetsAtSite(site.id)} assets</span>
                  {site.status === 'Inactive' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">Inactive</span>}
                  {canEdit && (
                    <button onClick={e => { e.stopPropagation(); setEditingSite(site); }} className="p-1 text-slate-500 hover:text-[#f97316] transition-colors"><Edit3 size={13} /></button>
                  )}
                </div>
                {isExpanded && (
                  <div className="border-t border-[#0d1628] p-3 space-y-2 bg-[#0d1628]/50">
                    {canEdit && (
                      <button onClick={() => setShowAddBuilding(site.id)} className="flex items-center gap-1.5 text-xs font-semibold text-[#f97316] hover:text-orange-400 transition-colors mb-2">
                        <Plus size={12} />Add Building
                      </button>
                    )}
                    {siteBuildings.length === 0 ? (
                      <p className="text-xs text-slate-600 italic py-2">No buildings in this site.</p>
                    ) : (
                      siteBuildings.map(bld => {
                        const bldLocations = locations.filter(l => l.building_id === bld.id);
                        const bldExpanded = expandedBuilding === bld.id;
                        return (
                          <div key={bld.id} className="bg-[#1a2236] rounded-lg border border-[#1e2d4a] overflow-hidden">
                            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#0d1628] transition-colors cursor-pointer"
                              onClick={() => setExpandedBuilding(bldExpanded ? null : bld.id)}>
                              {bldExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                              <Building2 size={14} className="text-blue-400" />
                              <span className="text-sm font-medium text-slate-200 flex-1">{bld.name}</span>
                              <span className="text-[10px] text-slate-600">{bldLocations.length} locations · {assetsAtBuilding(bld.id)} assets</span>
                              {canEdit && <button onClick={e => { e.stopPropagation(); setEditingBuilding(bld); }} className="p-1 text-slate-500 hover:text-[#f97316] transition-colors"><Edit3 size={12} /></button>}
                            </div>
                            {bldExpanded && (
                              <div className="border-t border-[#0d1628] p-2 space-y-1.5 bg-[#0d1628]/30">
                                {canEdit && (
                                  <button onClick={() => setShowAddLocation(bld.id)} className="flex items-center gap-1.5 text-xs font-semibold text-[#f97316] hover:text-orange-400 transition-colors mb-1">
                                    <Plus size={11} />Add Location
                                  </button>
                                )}
                                {bldLocations.length === 0 ? (
                                  <p className="text-xs text-slate-600 italic py-1">No locations in this building.</p>
                                ) : (
                                  bldLocations.map(loc => (
                                    <div key={loc.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1e2d4a]">
                                      <Layers size={13} className="text-emerald-400" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-200">{loc.name}</p>
                                        {(loc.floor || loc.area || loc.room) && (
                                          <p className="text-[10px] text-slate-600">{[loc.floor && `Floor ${loc.floor}`, loc.area, loc.room].filter(Boolean).join(' · ')}</p>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-600 flex items-center gap-1"><Package size={10} />{assetsAtLocation(loc.id)}</span>
                                      {canEdit && <button onClick={() => setEditingLocation(loc)} className="p-1 text-slate-500 hover:text-[#f97316] transition-colors"><Edit3 size={11} /></button>}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAddSite && <SiteModal onClose={() => setShowAddSite(false)} />}
      {editingSite && <SiteModal site={editingSite} onClose={() => setEditingSite(null)} />}
      {showAddBuilding && <BuildingModal siteId={showAddBuilding} onClose={() => setShowAddBuilding(null)} />}
      {editingBuilding && <BuildingModal building={editingBuilding} siteId={editingBuilding.site_id} onClose={() => setEditingBuilding(null)} />}
      {showAddLocation && <LocationModal buildingId={showAddLocation} onClose={() => setShowAddLocation(null)} />}
      {editingLocation && <LocationModal location={editingLocation} buildingId={editingLocation.building_id} onClose={() => setEditingLocation(null)} />}
    </div>
  );
}

function SiteModal({ site, onClose }: { site?: DBAssetSite; onClose: () => void }) {
  const store = useAppStore();
  const [name, setName] = useState(site?.name ?? '');
  const [address, setAddress] = useState(site?.address ?? '');
  const [status, setStatus] = useState<LocationStatus>(site?.status ?? 'Active');
  const [notes, setNotes] = useState(site?.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (site) {
      await store.updateAssetSite({ id: site.id, name: name.trim(), address: address || null, status, notes: notes || null });
    } else {
      await store.addAssetSite({ org_id: store.currentOrgId ?? '', name: name.trim(), address: address || null, status, notes: notes || null, sort_order: 0 });
    }
    setSaving(false);
    onClose();
  }

  return (
    <Modal title={site ? 'Edit Site' : 'Add Site'} onClose={onClose} onSave={handleSave} saving={saving}>
      <Field label="Site Name *"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Princess Royal University Hospital" /></Field>
      <Field label="Address"><input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} /></Field>
      <Field label="Status"><select className={inputCls} value={status} onChange={e => setStatus(e.target.value as LocationStatus)}><option>Active</option><option>Inactive</option></select></Field>
      <Field label="Notes"><textarea className={inputCls + ' resize-none'} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
    </Modal>
  );
}

function BuildingModal({ building, siteId, onClose }: { building?: DBAssetBuilding; siteId: string | null; onClose: () => void }) {
  const store = useAppStore();
  const [name, setName] = useState(building?.name ?? '');
  const [status, setStatus] = useState<LocationStatus>(building?.status ?? 'Active');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (building) {
      await store.updateAssetBuilding({ id: building.id, name: name.trim(), status });
    } else {
      await store.addAssetBuilding({ org_id: store.currentOrgId ?? '', site_id: siteId, name: name.trim(), status, notes: null, sort_order: 0 });
    }
    setSaving(false);
    onClose();
  }

  return (
    <Modal title={building ? 'Edit Building' : 'Add Building'} onClose={onClose} onSave={handleSave} saving={saving}>
      <Field label="Building Name *"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Farnborough Ward" /></Field>
      <Field label="Status"><select className={inputCls} value={status} onChange={e => setStatus(e.target.value as LocationStatus)}><option>Active</option><option>Inactive</option></select></Field>
    </Modal>
  );
}

function LocationModal({ location, buildingId, onClose }: { location?: DBAssetLocation; buildingId: string | null; onClose: () => void }) {
  const store = useAppStore();
  const [name, setName] = useState(location?.name ?? '');
  const [floor, setFloor] = useState(location?.floor ?? '');
  const [area, setArea] = useState(location?.area ?? '');
  const [room, setRoom] = useState(location?.room ?? '');
  const [status, setStatus] = useState<LocationStatus>(location?.status ?? 'Active');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (location) {
      await store.updateAssetLocation({ id: location.id, name: name.trim(), floor: floor || null, area: area || null, room: room || null, status });
    } else {
      await store.addAssetLocation({ org_id: store.currentOrgId ?? '', building_id: buildingId, name: name.trim(), floor: floor || null, area: area || null, room: room || null, notes: null, status, sort_order: 0 });
    }
    setSaving(false);
    onClose();
  }

  return (
    <Modal title={location ? 'Edit Location' : 'Add Location'} onClose={onClose} onSave={handleSave} saving={saving}>
      <Field label="Location Name *"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Level 2 Plantroom" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Floor"><input className={inputCls} value={floor} onChange={e => setFloor(e.target.value)} /></Field>
        <Field label="Area"><input className={inputCls} value={area} onChange={e => setArea(e.target.value)} /></Field>
        <Field label="Room"><input className={inputCls} value={room} onChange={e => setRoom(e.target.value)} /></Field>
      </div>
      <Field label="Status"><select className={inputCls} value={status} onChange={e => setStatus(e.target.value as LocationStatus)}><option>Active</option><option>Inactive</option></select></Field>
    </Modal>
  );
}

function Modal({ title, onClose, onSave, saving, children }: { title: string; onClose: () => void; onSave: () => void; saving: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 p-5 border-t border-[#1e2d4a]">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 bg-[#f97316] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label><div className="mt-1.5">{children}</div></div>;
}
