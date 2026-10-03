import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Package, FileText, MessageSquare, Edit3, Save, Plus, Trash2, Download, Paperclip, FileDown, Image as ImageIcon, Star, X, Loader2, Wrench } from 'lucide-react';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import FileUpload, { type UploadedFile } from '../../components/FileUpload';
import type { DBAsset, AssetStatus, DBAssetDocument, DBAssetActivity, DBAssetMedia } from './types';
import { ASSET_STATUSES, ASSET_TYPES, ASSET_STATUS_COLORS, ASSET_DOC_CATEGORIES } from './types';
import { exportAssetPDF } from './AssetPDF';
import ServiceTab from './ServiceTab';

interface Props {
  asset: DBAsset;
  onBack: () => void;
  onAssetUpdated: (a: DBAsset) => void;
}

type Tab = 'overview' | 'service' | 'documents' | 'activity';

export default function AssetDetail({ asset, onBack, onAssetUpdated }: Props) {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canEdit = perms['asset.edit'] || isAdmin;
  const canDelete = perms['asset.delete'] || isAdmin;
  const canComment = perms['asset.comment'] || isAdmin;
  const canUpload = perms['asset.upload'] || isAdmin;
  const canCreate = perms['asset.create'] || isAdmin;
  const canView = perms['asset.view'] || isAdmin;

  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const sites = store.assetSites ?? [];
  const buildings = store.assetBuildings ?? [];
  const locations = store.assetLocations ?? [];

  function siteName(id: string | null) { return sites.find(s => s.id === id)?.name ?? '—'; }
  function buildingName(id: string | null) { return buildings.find(b => b.id === id)?.name ?? '—'; }
  function locationName(id: string | null) { return locations.find(l => l.id === id)?.name ?? '—'; }

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      await store.loadAssetDocuments(asset.id);
      await store.loadAssetActivity(asset.id);
      await store.loadAssetMedia(asset.id);

      let primaryImageUrl: string | null = null;
      const primary = (store.assetMedia ?? []).find(m => m.is_primary);
      if (primary) {
        primaryImageUrl = await store.getAssetMediaSignedUrl(primary.storage_path);
      }

      exportAssetPDF({
        asset,
        siteName: siteName(asset.site_id),
        buildingName: buildingName(asset.building_id),
        locationName: locationName(asset.location_id),
        documents: store.assetDocuments ?? [],
        activity: store.assetActivity ?? [],
        serviceRecords: store.assetServiceRecords ?? [],
        primaryImageUrl,
        currentUserName: store.currentUser?.name ?? '',
      });
    } finally {
      setExporting(false);
    }
  }, [asset, store]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabCls = (t: Tab) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
      tab === t ? 'text-[#f97316] border-[#f97316]' : 'text-slate-500 border-transparent hover:text-slate-300'
    }`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d4a] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
            <Package size={20} className="text-[#f97316]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{asset.name}</h2>
            <p className="text-sm text-slate-500 font-mono">{asset.asset_tag}</p>
          </div>
        </div>
        {canView && (
          <button onClick={handleExportPDF} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-[#f97316] border border-[#1e2d4a] rounded-lg hover:border-[#f97316] transition-colors disabled:opacity-60">
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}Export PDF
          </button>
        )}
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ASSET_STATUS_COLORS[asset.status as keyof typeof ASSET_STATUS_COLORS] ?? 'bg-slate-700 text-slate-400'}`}>{asset.status}</span>
      </div>

      <div className="flex gap-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg p-1 overflow-x-auto">
        <button className={tabCls('overview')} onClick={() => setTab('overview')}><Package size={15} />Overview</button>
        <button className={tabCls('service')} onClick={() => setTab('service')}><Wrench size={15} />Service & Maintenance</button>
        <button className={tabCls('documents')} onClick={() => setTab('documents')}><FileText size={15} />Documents</button>
        <button className={tabCls('activity')} onClick={() => setTab('activity')}><MessageSquare size={15} />Activity</button>
      </div>

      {tab === 'overview' && (
        <OverviewTab asset={asset} canEdit={canEdit} canUpload={canUpload} editing={editing} setEditing={setEditing}
          siteName={siteName} buildingName={buildingName} locationName={locationName}
          onAssetUpdated={onAssetUpdated} />
      )}
      {tab === 'service' && (
        <ServiceTab asset={asset} canEdit={canEdit} canCreate={canCreate} canDelete={canDelete} />
      )}
      {tab === 'documents' && (
        <DocumentsTab asset={asset} canUpload={canUpload} canDelete={canDelete} />
      )}
      {tab === 'activity' && (
        <ActivityTab asset={asset} canComment={canComment} />
      )}
    </div>
  );
}

function OverviewTab({ asset, canEdit, canUpload, editing, setEditing, siteName, buildingName, locationName, onAssetUpdated }: {
  asset: DBAsset; canEdit: boolean; canUpload: boolean; editing: boolean; setEditing: (b: boolean) => void;
  siteName: (id: string | null) => string; buildingName: (id: string | null) => string; locationName: (id: string | null) => string;
  onAssetUpdated: (a: DBAsset) => void;
}) {
  const store = useAppStore();

  if (editing) {
    return <EditAssetForm asset={asset} onCancel={() => setEditing(false)} onSave={(updated) => { onAssetUpdated(updated); setEditing(false); }} />;
  }

  function Row({ label, value }: { label: string; value: string | null | undefined }) {
    return (
      <div className="flex justify-between py-2 border-b border-[#0d1628] last:border-0">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-sm text-slate-200 font-medium text-right">{value || '—'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ImageSection asset={asset} canUpload={canUpload} />
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
        <div className="flex justify-end mb-4">
          {canEdit && <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-[#f97316] border border-[#1e2d4a] rounded-lg hover:border-[#f97316] transition-colors"><Edit3 size={12} />Edit Asset</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <Row label="Asset Tag" value={asset.asset_tag} />
            <Row label="Asset Name" value={asset.name} />
            <Row label="Type" value={asset.asset_type} />
            <Row label="Status" value={asset.status} />
            <Row label="Manufacturer" value={asset.manufacturer} />
            <Row label="Model" value={asset.model} />
            <Row label="Serial Number" value={asset.serial_number} />
          </div>
          <div>
            <Row label="Site" value={siteName(asset.site_id)} />
            <Row label="Building" value={buildingName(asset.building_id)} />
            <Row label="Location" value={locationName(asset.location_id)} />
            <Row label="Installation Date" value={asset.installation_date} />
            <Row label="Commissioning Date" value={asset.commissioning_date} />
            <Row label="Warranty Expiry" value={asset.warranty_expiry} />
            <Row label="Project Reference" value={asset.project_name} />
          </div>
        </div>
        {asset.notes && (
          <div className="mt-4 pt-4 border-t border-[#1e2d4a]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{asset.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageSection({ asset, canUpload }: { asset: DBAsset; canUpload: boolean }) {
  const store = useAppStore();
  const [media, setMedia] = useState<DBAssetMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    store.loadAssetMedia(asset.id).then(() => setLoading(false));
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMedia(store.assetMedia ?? []);
  }, [store.assetMedia]);

  useEffect(() => {
    const primary = media.find(m => m.is_primary);
    const others = media.filter(m => !m.is_primary);
    const all = [primary, ...others].filter(Boolean) as DBAssetMedia[];
    all.forEach(async (m) => {
      if (!imageUrls[m.id]) {
        const url = await store.getAssetMediaSignedUrl(m.storage_path);
        if (url) setImageUrls(prev => ({ ...prev, [m.id]: url }));
      }
    });
  }, [media]); // eslint-disable-line react-hooks/exhaustive-deps

  const primary = media.find(m => m.is_primary);
  const others = media.filter(m => !m.is_primary);
  const primaryUrl = primary ? imageUrls[primary.id] : undefined;

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    const id = await store.uploadAssetImage(asset.id, selectedFile, caption || undefined);
    if (id) {
      const isOnlyImage = media.length === 0;
      if (isOnlyImage) {
        await store.setPrimaryAssetImage(id, asset.id);
      }
      await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'image_upload', text: `Image uploaded: ${selectedFile.name}`, user_name: store.currentUser?.name ?? '' });
      await store.loadAssetMedia(asset.id);
    }
    setUploading(false);
    setSelectedFile(null);
    setCaption('');
    setShowUpload(false);
  }

  async function handleSetPrimary(mediaId: string) {
    await store.setPrimaryAssetImage(mediaId, asset.id);
    await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'primary_changed', text: 'Primary image changed', user_name: store.currentUser?.name ?? '' });
    await store.loadAssetMedia(asset.id);
  }

  async function handleRemoveImage(m: DBAssetMedia) {
    await store.removeAssetImage(m.id);
    await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'image_removed', text: `Image removed: ${m.file_name}`, user_name: store.currentUser?.name ?? '' });
    await store.loadAssetMedia(asset.id);
  }

  if (loading) {
    return (
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5 flex justify-center">
        <Loader2 size={20} className="text-slate-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Asset Images</h3>
        {canUpload && !showUpload && (
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#f97316] border border-[#f97316]/30 rounded-lg hover:bg-[#f97316]/10 transition-colors">
            <Plus size={12} />Add Image
          </button>
        )}
      </div>

      {showUpload && (
        <div className="mb-4 bg-[#0d1628] border border-[#1e2d4a] rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Image File</label>
              <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full mt-1.5 text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#f97316] file:text-white file:text-xs file:font-semibold hover:file:bg-orange-600 cursor-pointer" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Caption (optional)</label>
              <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Main plant room view"
                className="w-full mt-1.5 bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowUpload(false); setSelectedFile(null); setCaption(''); }} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleUpload} disabled={!selectedFile || uploading}
              className="flex items-center gap-1.5 bg-[#f97316] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Upload
            </button>
          </div>
        </div>
      )}

      {media.length === 0 && !showUpload ? (
        <div className="text-center py-8">
          <ImageIcon size={32} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-3">No asset image uploaded</p>
          {canUpload && (
            <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#f97316] border border-[#f97316]/30 rounded-lg hover:bg-[#f97316]/10 transition-colors">
              <Plus size={12} />Add Image
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {primary && (
            <div className="relative rounded-lg overflow-hidden border border-[#1e2d4a] bg-[#0d1628]">
              {primaryUrl ? (
                <img src={primaryUrl} alt={primary.caption || primary.file_name} className="w-full max-h-80 object-contain" />
              ) : (
                <div className="w-full h-48 flex items-center justify-center"><Loader2 size={20} className="text-slate-600 animate-spin" /></div>
              )}
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f97316] text-white text-[10px] font-semibold">
                <Star size={10} className="fill-white" />Primary
              </div>
              {primary.caption && <p className="absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs text-white bg-black/60">{primary.caption}</p>}
            </div>
          )}
          {others.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {others.map(m => (
                <div key={m.id} className="relative group rounded-lg overflow-hidden border border-[#1e2d4a] bg-[#0d1628] aspect-square">
                  {imageUrls[m.id] ? (
                    <img src={imageUrls[m.id]} alt={m.caption || m.file_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Loader2 size={14} className="text-slate-600 animate-spin" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    {canUpload && <button onClick={() => handleSetPrimary(m.id)} title="Set as Primary" className="p-1.5 rounded bg-black/70 text-amber-400 hover:text-amber-300 transition-colors"><Star size={12} /></button>}
                    {canUpload && <button onClick={() => handleRemoveImage(m)} title="Remove" className="p-1.5 rounded bg-black/70 text-red-400 hover:text-red-300 transition-colors"><Trash2 size={12} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {primary && canUpload && others.length > 0 && (
            <p className="text-[10px] text-slate-600">Hover over additional photos for Set as Primary / Remove options.</p>
          )}
        </div>
      )}
    </div>
  );
}

function EditAssetForm({ asset, onCancel, onSave }: { asset: DBAsset; onCancel: () => void; onSave: (a: DBAsset) => void }) {
  const store = useAppStore();
  const sites = store.assetSites ?? [];
  const buildings = (store.assetBuildings ?? []).filter(b => b.site_id === asset.site_id);
  const locations = (store.assetLocations ?? []).filter(l => l.building_id === asset.building_id);
  const [form, setForm] = useState({
    name: asset.name, asset_type: asset.asset_type, manufacturer: asset.manufacturer ?? '', model: asset.model ?? '',
    serial_number: asset.serial_number ?? '', site_id: asset.site_id ?? '', building_id: asset.building_id ?? '',
    location_id: asset.location_id ?? '', status: asset.status as AssetStatus,
    installation_date: asset.installation_date ?? '', commissioning_date: asset.commissioning_date ?? '',
    warranty_expiry: asset.warranty_expiry ?? '', notes: asset.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [serialWarn, setSerialWarn] = useState(false);
  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (k === 'serial_number') setSerialWarn(false);
  };

  async function handleSave() {
    setSaving(true);
    const prevStatus = asset.status;
    const updates: Partial<DBAsset> & { id: string } = {
      id: asset.id,
      name: form.name, asset_type: form.asset_type,
      manufacturer: form.manufacturer || null, model: form.model || null,
      serial_number: form.serial_number || null,
      site_id: form.site_id || null, building_id: form.building_id || null, location_id: form.location_id || null,
      status: form.status,
      installation_date: form.installation_date || null, commissioning_date: form.commissioning_date || null,
      warranty_expiry: form.warranty_expiry || null, notes: form.notes || null,
    };
    await store.updateAsset(updates);
    if (form.status !== prevStatus) {
      await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'status_change', text: `Status changed: ${prevStatus} \u2192 ${form.status}`, user_name: store.currentUser?.name ?? '' });
    } else {
      await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'updated', text: 'Asset details updated', user_name: store.currentUser?.name ?? '' });
    }
    setSaving(false);
    onSave({ ...asset, ...updates });
  }

  async function handleSerialBlur() {
    if (!form.serial_number.trim() || form.serial_number === asset.serial_number) return;
    const dup = await store.checkSerialDuplicate(form.serial_number, asset.id);
    if (dup) setSerialWarn(true);
  }

  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Edit Asset</h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-[#f97316] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}Save
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className={labelCls}>Asset Name</label><input className={inputCls + ' mt-1.5'} value={form.name} onChange={set('name')} /></div>
        <div><label className={labelCls}>Asset Type</label><select className={inputCls + ' mt-1.5'} value={form.asset_type} onChange={set('asset_type')}>{ASSET_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className={labelCls}>Manufacturer</label><input className={inputCls + ' mt-1.5'} value={form.manufacturer} onChange={set('manufacturer')} /></div>
        <div><label className={labelCls}>Model</label><input className={inputCls + ' mt-1.5'} value={form.model} onChange={set('model')} /></div>
        <div><label className={labelCls}>Serial Number</label><input className={inputCls + ' mt-1.5'} value={form.serial_number} onChange={set('serial_number')} onBlur={handleSerialBlur} />{serialWarn && <p className="mt-1 text-[10px] text-amber-400">Serial number already exists in this organisation</p>}</div>
        <div><label className={labelCls}>Status</label><select className={inputCls + ' mt-1.5'} value={form.status} onChange={set('status')}>{ASSET_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className={labelCls}>Site</label><select className={inputCls + ' mt-1.5'} value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value, building_id: '', location_id: '' }))}><option value="">—</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className={labelCls}>Building</label><select className={inputCls + ' mt-1.5'} value={form.building_id} onChange={e => setForm(f => ({ ...f, building_id: e.target.value, location_id: '' }))} disabled={!form.site_id}><option value="">—</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div><label className={labelCls}>Location</label><select className={inputCls + ' mt-1.5'} value={form.location_id} onChange={set('location_id')} disabled={!form.building_id}><option value="">—</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div><label className={labelCls}>Installation Date</label><input type="date" className={inputCls + ' mt-1.5'} value={form.installation_date} onChange={set('installation_date')} /></div>
        <div><label className={labelCls}>Commissioning Date</label><input type="date" className={inputCls + ' mt-1.5'} value={form.commissioning_date} onChange={set('commissioning_date')} /></div>
        <div><label className={labelCls}>Warranty Expiry</label><input type="date" className={inputCls + ' mt-1.5'} value={form.warranty_expiry} onChange={set('warranty_expiry')} /></div>
      </div>
      <div><label className={labelCls}>Notes</label><textarea className={inputCls + ' mt-1.5 resize-none'} rows={3} value={form.notes} onChange={set('notes')} /></div>
    </div>
  );
}

function DocumentsTab({ asset, canUpload, canDelete }: { asset: DBAsset; canUpload: boolean; canDelete: boolean }) {
  const store = useAppStore();
  const [docs, setDocs] = useState<DBAssetDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadedFile[]>([]);
  const [category, setCategory] = useState<string>('Other');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    store.loadAssetDocuments(asset.id).then(() => setLoading(false));
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDocs(store.assetDocuments ?? []);
  }, [store.assetDocuments]);

  const fmtSize = (n: number) => n < 1024 ? `${n}B` : n < 1048576 ? `${(n / 1024).toFixed(0)}KB` : `${(n / 1048576).toFixed(1)}MB`;
  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  async function handleSaveUpload() {
    if (uploadFiles.length === 0) return;
    setSaving(true);
    for (const f of uploadFiles) {
      const id = await store.addAssetDocument({
        org_id: store.currentOrgId ?? '',
        asset_id: asset.id,
        name: f.name,
        category,
        file_type: f.type,
        file_size: f.size,
        storage_path: null,
        data_url: f.dataUrl ?? null,
        notes: notes || null,
        uploaded_by: store.currentUser?.name ?? null,
      });
      if (id) {
        await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'document_upload', text: `Document uploaded: ${f.name}`, user_name: store.currentUser?.name ?? '' });
      }
    }
    setSaving(false);
    setUploadFiles([]);
    setCategory('Other');
    setNotes('');
    setShowUpload(false);
    await store.loadAssetDocuments(asset.id);
  }

  async function handleDelete(doc: DBAssetDocument) {
    await store.removeAssetDocument(doc.id);
    await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'document_removed', text: `Document removed: ${doc.name}`, user_name: store.currentUser?.name ?? '' });
    await store.loadAssetDocuments(asset.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canUpload && <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"><Plus size={16} />Upload Document</button>}
      </div>
      {showUpload && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4 space-y-3">
          <FileUpload files={uploadFiles} onChange={setUploadFiles} label="Upload Documents" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls + ' mt-1.5'} value={category} onChange={e => setCategory(e.target.value)}>
                {ASSET_DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input className={inputCls + ' mt-1.5'} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowUpload(false); setUploadFiles([]); }} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSaveUpload} disabled={uploadFiles.length === 0 || saving}
              className="flex items-center gap-1.5 bg-[#f97316] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
              {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}Save Documents
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" /></div>
      ) : docs.length === 0 ? (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-8 text-center">
          <FileText size={28} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 bg-[#1a2236] rounded-lg border border-[#1e2d4a] px-4 py-3 group">
              <div className="w-8 h-8 rounded bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                <Paperclip size={14} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{doc.name}</p>
                <p className="text-[10px] text-slate-600">{doc.category} · {fmtSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
              </div>
              {doc.data_url && <a href={doc.data_url} download={doc.name} className="p-1.5 text-slate-500 hover:text-[#f97316] transition-colors"><Download size={14} /></a>}
              {canDelete && <button onClick={() => handleDelete(doc)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ asset, canComment }: { asset: DBAsset; canComment: boolean }) {
  const store = useAppStore();
  const [activity, setActivity] = useState<DBAssetActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    store.loadAssetActivity(asset.id).then(() => setLoading(false));
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActivity(store.assetActivity ?? []);
  }, [store.assetActivity]);

  async function handleAddComment() {
    if (!comment.trim()) return;
    setPosting(true);
    await store.addAssetActivity({
      org_id: store.currentOrgId ?? '',
      asset_id: asset.id,
      type: 'comment',
      text: comment.trim(),
      user_name: store.currentUser?.name ?? '',
    });
    setComment('');
    setPosting(false);
    await store.loadAssetActivity(asset.id);
  }

  function ActivityIcon({ type }: { type: string }) {
    if (type === 'created') return <Plus size={12} className="text-emerald-400" />;
    if (type === 'status_change') return <Edit3 size={12} className="text-amber-400" />;
    if (type === 'document_upload' || type === 'document_removed') return <FileText size={12} className="text-blue-400" />;
    if (type === 'image_upload' || type === 'image_removed' || type === 'primary_changed') return <ImageIcon size={12} className="text-orange-400" />;
    if (type.startsWith('service_')) return <Wrench size={12} className="text-sky-400" />;
    return <MessageSquare size={12} className="text-slate-500" />;
  }

  return (
    <div className="space-y-4">
      {canComment && (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4">
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..."
            className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none" rows={2} />
          <div className="flex justify-end mt-2">
            <button onClick={handleAddComment} disabled={!comment.trim() || posting}
              className="flex items-center gap-1.5 bg-[#f97316] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
              {posting ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <MessageSquare size={12} />}Post Comment
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" /></div>
      ) : activity.length === 0 ? (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-8 text-center">
          <MessageSquare size={28} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4 space-y-1">
          {activity.map((a, i) => (
            <div key={a.id} className={`flex gap-3 py-2.5 ${i < activity.length - 1 ? 'border-b border-[#0d1628]' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center shrink-0 mt-0.5">
                <ActivityIcon type={a.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">{a.text}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {a.user_name && ` · ${a.user_name}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
