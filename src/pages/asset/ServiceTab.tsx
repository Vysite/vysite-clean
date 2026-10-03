import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Wrench, Edit3, Save, Trash2, X, FileText, ChevronDown, ChevronRight, Paperclip, Download, Calendar, AlertTriangle, FileDown, Loader2 } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBAsset, DBAssetDocument, DBAssetServiceRecord, ServiceRecordStatus, ServiceCondition } from './types';
import { SERVICE_TYPES, SERVICE_STATUSES, SERVICE_CONDITIONS, SERVICE_STATUS_COLORS, SERVICE_CONDITION_COLORS } from './types';
import { exportServiceRecordPDF, exportServiceRecordFileName } from './ServiceRecordPDF';

interface Props {
  asset: DBAsset;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canView: boolean;
  canViewFinancials: boolean;
}

export default function ServiceTab({ asset, canEdit, canCreate, canDelete, canView, canViewFinancials }: Props) {
  const store = useAppStore();
  const [records, setRecords] = useState<DBAssetServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DBAssetServiceRecord | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  useEffect(() => {
    store.loadAssetServiceRecords(asset.id).then(() => setLoading(false));
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setRecords(store.assetServiceRecords ?? []);
  }, [store.assetServiceRecords]);

  const lastService = records.length > 0 ? records[0] : null;
  const nextDue = records.find(r => r.next_service_due && r.status !== 'Open')?.next_service_due ?? null;
  const isOverdue = nextDue && new Date(nextDue) < new Date();

  return (
    <div className="space-y-4">
      {/* KPI indicators */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Last Service</p>
          {lastService ? (
            <>
              <p className="text-sm font-semibold text-slate-200">{new Date(lastService.service_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{lastService.service_type} · {lastService.engineer_name || '—'}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">No service recorded</p>
          )}
        </div>
        <div className={`bg-[#1a2236] rounded-xl border p-3 ${isOverdue ? 'border-red-800/40' : 'border-[#1e2d4a]'}`}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Next Service Due</p>
          {nextDue ? (
            <>
              <p className={`text-sm font-semibold ${isOverdue ? 'text-red-400' : 'text-slate-200'}`}>{new Date(nextDue).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              {isOverdue && <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1"><AlertTriangle size={10} />Overdue</p>}
            </>
          ) : (
            <p className="text-sm text-slate-600">Not scheduled</p>
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        {canCreate && (
          <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Plus size={16} />Add Service Record
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <ServiceRecordForm asset={asset} record={editingRecord} canEdit={canEdit}
          onClose={() => { setShowForm(false); setEditingRecord(null); }}
          onSave={async (rec) => {
            if (editingRecord) {
              await store.updateAssetServiceRecord(rec);
              await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'service_updated', text: `Service record updated: ${rec.service_type} (${rec.service_date})`, user_name: store.currentUser?.name ?? '' });
            } else {
              const id = await store.addAssetServiceRecord({ ...rec, org_id: store.currentOrgId ?? '', asset_id: asset.id, created_by: store.currentUser?.name ?? null });
              if (id) {
                await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'service_created', text: `Service record created: ${rec.service_type} (${rec.service_date})`, user_name: store.currentUser?.name ?? '' });
              }
            }
            await store.loadAssetServiceRecords(asset.id);
            setShowForm(false);
            setEditingRecord(null);
          }} />
      )}

      {/* Records list */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-8 text-center">
          <Wrench size={28} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No service records yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(rec => {
            const isExpanded = expandedRecord === rec.id;
            const linkedDocs = (store.assetDocuments ?? []).filter(d => d.service_record_id === rec.id);
            return (
              <div key={rec.id} className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#0d1628] transition-colors cursor-pointer"
                  onClick={() => setExpandedRecord(isExpanded ? null : rec.id)}>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-200">{new Date(rec.service_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="text-xs text-slate-500">{rec.service_type}</span>
                      {rec.engineer_name && <span className="text-xs text-slate-600">· {rec.engineer_name}</span>}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{rec.work_carried_out}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {linkedDocs.length > 0 && <span className="text-[10px] text-slate-600 flex items-center gap-1"><Paperclip size={10} />{linkedDocs.length}</span>}
                    {rec.next_service_due && <span className="text-[10px] text-slate-600 flex items-center gap-1"><Calendar size={10} />{new Date(rec.next_service_due).toLocaleDateString('en-GB')}</span>}
                    {rec.cost != null && <span className="text-[10px] text-slate-500 font-mono">£{rec.cost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${SERVICE_STATUS_COLORS[rec.status as ServiceRecordStatus] ?? 'bg-slate-800 text-slate-400'}`}>{rec.status}</span>
                  </div>
                  {canEdit && <button onClick={e => { e.stopPropagation(); setEditingRecord(rec); setShowForm(true); }} className="p-1 text-slate-500 hover:text-[#f97316] transition-colors"><Edit3 size={13} /></button>}
                  {canView && <ExportServicePDF asset={asset} record={rec} linkedDocs={linkedDocs} canViewFinancials={canViewFinancials} />}
                </div>
                {isExpanded && (
                  <div className="border-t border-[#0d1628] p-4 bg-[#0d1628]/50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                      <DetailRow label="Engineer" value={rec.engineer_name} />
                      <DetailRow label="Company" value={rec.company} />
                      <DetailRow label="Condition" value={rec.condition ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SERVICE_CONDITION_COLORS[rec.condition as ServiceCondition] ?? ''}`}>{rec.condition}</span> : null} />
                      <DetailRow label="Status" value={<span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SERVICE_STATUS_COLORS[rec.status as ServiceRecordStatus] ?? ''}`}>{rec.status}</span>} />
                      <DetailRow label="Next Service Due" value={rec.next_service_due ? new Date(rec.next_service_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
                      <DetailRow label="Cost" value={rec.cost != null ? `£${rec.cost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : null} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Work Carried Out</p>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{rec.work_carried_out}</p>
                    </div>
                    {rec.parts_replaced && <div><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Parts Replaced</p><p className="text-sm text-slate-300 whitespace-pre-wrap">{rec.parts_replaced}</p></div>}
                    {rec.recommendations && <div><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Recommendations</p><p className="text-sm text-slate-300 whitespace-pre-wrap">{rec.recommendations}</p></div>}
                    {rec.notes && <div><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</p><p className="text-sm text-slate-300 whitespace-pre-wrap">{rec.notes}</p></div>}

                    {/* Linked documents */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Linked Documents</p>
                        {canEdit && <LinkDocumentButton asset={asset} serviceRecordId={rec.id} />}
                      </div>
                      {linkedDocs.length === 0 ? (
                        <p className="text-xs text-slate-600 italic">No documents linked.</p>
                      ) : (
                        <div className="space-y-1">
                          {linkedDocs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 bg-[#1a2236] rounded-lg border border-[#1e2d4a] px-3 py-2">
                              <Paperclip size={12} className="text-slate-500" />
                              <span className="text-xs text-slate-300 flex-1 truncate">{doc.name}</span>
                              <span className="text-[10px] text-slate-600">{doc.category}</span>
                              {doc.data_url && <a href={doc.data_url} download={doc.name} className="p-1 text-slate-500 hover:text-[#f97316] transition-colors"><Download size={11} /></a>}
                              {canEdit && <button onClick={async () => { await store.linkDocumentToServiceRecord(doc.id, null); await store.loadAssetDocuments(asset.id); }} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><X size={11} /></button>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#0d1628]">
                      <p className="text-[10px] text-slate-600">Created by {rec.created_by || '—'} · {new Date(rec.created_at).toLocaleDateString('en-GB')}</p>
                      {canDelete && (
                        <button onClick={async () => {
                          if (confirm('Delete this service record? This cannot be undone.')) {
                            await store.removeAssetServiceRecord(rec.id);
                            await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'service_deleted', text: `Service record deleted: ${rec.service_type} (${rec.service_date})`, user_name: store.currentUser?.name ?? '' });
                            await store.loadAssetServiceRecords(asset.id);
                          }
                        }} className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 size={11} />Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
      <span className="text-sm text-slate-200 font-medium">{value || '—'}</span>
    </div>
  );
}

function LinkDocumentButton({ asset, serviceRecordId }: { asset: DBAsset; serviceRecordId: string }) {
  const store = useAppStore();
  const [show, setShow] = useState(false);
  const unlinkedDocs = (store.assetDocuments ?? []).filter(d => !d.service_record_id);

  if (unlinkedDocs.length === 0) return null;

  return (
    <>
      <button onClick={() => setShow(!show)} className="text-[10px] font-semibold text-[#f97316] hover:text-orange-400 transition-colors">
        + Link Document
      </button>
      {show && (
        <div className="absolute z-10 mt-1 bg-[#1a2236] border border-[#1e2d4a] rounded-lg shadow-xl p-2 space-y-1 min-w-[200px]">
          {unlinkedDocs.map(doc => (
            <button key={doc.id} onClick={async () => {
              await store.linkDocumentToServiceRecord(doc.id, serviceRecordId);
              await store.loadAssetDocuments(asset.id);
              setShow(false);
              await store.addAssetActivity({ org_id: store.currentOrgId ?? '', asset_id: asset.id, type: 'service_doc_linked', text: `Document linked to service record: ${doc.name}`, user_name: store.currentUser?.name ?? '' });
            }} className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-[#0d1628] transition-colors truncate">
              <Paperclip size={10} className="inline mr-1.5 text-slate-500" />{doc.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ExportServicePDF({ asset, record, linkedDocs, canViewFinancials }: {
  asset: DBAsset; record: DBAssetServiceRecord; linkedDocs: DBAssetDocument[]; canViewFinancials: boolean;
}) {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuPos = useRef<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 170 });
  const [, forceRender] = useState(0);

  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuWidth = 170;
      const left = Math.min(r.right - menuWidth, window.innerWidth - menuWidth - 8);
      menuPos.current = { top: r.bottom + 4, left: Math.max(8, left), width: menuWidth };
      forceRender(n => n + 1);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleScroll() {
      if (open) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  async function handleExport(internal: boolean) {
    setExporting(true);
    setOpen(false);
    try {
      await store.loadAssetDocuments(asset.id);
      await store.loadAssetMedia(asset.id);

      let primaryImageUrl: string | null = null;
      const primary = (store.assetMedia ?? []).find(m => m.is_primary);
      if (primary) {
        primaryImageUrl = await store.getAssetMediaSignedUrl(primary.storage_path);
      }

      const sites = store.assetSites ?? [];
      const buildings = store.assetBuildings ?? [];
      const locations = store.assetLocations ?? [];
      const siteName = sites.find(s => s.id === asset.site_id)?.name ?? '\u2014';
      const buildingName = buildings.find(b => b.id === asset.building_id)?.name ?? '\u2014';
      const locationName = locations.find(l => l.id === asset.location_id)?.name ?? '\u2014';

      const docs = (store.assetDocuments ?? []).filter(d => d.service_record_id === record.id);

      exportServiceRecordPDF({
        asset,
        record,
        siteName,
        buildingName,
        locationName,
        linkedDocuments: docs,
        primaryImageUrl,
        internal,
        currentUserName: store.currentUser?.name ?? '',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <button ref={btnRef} onClick={e => { e.stopPropagation(); setOpen(!open); }} disabled={exporting}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-[#f97316] border border-[#1e2d4a] rounded-lg hover:border-[#f97316] transition-colors disabled:opacity-60">
        {exporting ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}Export PDF
        <ChevronDown size={10} />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: menuPos.current.top, left: menuPos.current.left, width: menuPos.current.width, zIndex: 9999 }}
          className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg shadow-xl py-1"
          onMouseDown={e => e.stopPropagation()}>
          <button onClick={() => handleExport(false)}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-[#0d1628] transition-colors">
            Client Service Record
          </button>
          {canViewFinancials && (
            <button onClick={() => handleExport(true)}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-[#0d1628] transition-colors">
              Internal Service Record
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function ServiceRecordForm({ asset, record, canEdit, onClose, onSave }: {
  asset: DBAsset; record: DBAssetServiceRecord | null; canEdit: boolean;
  onClose: () => void; onSave: (rec: Omit<DBAssetServiceRecord, 'id' | 'org_id' | 'asset_id' | 'created_at' | 'updated_at' | 'created_by'>) => Promise<void>;
}) {
  const store = useAppStore();
  const [form, setForm] = useState({
    service_date: record?.service_date ?? new Date().toISOString().slice(0, 10),
    service_type: record?.service_type ?? 'Planned Service',
    engineer_name: record?.engineer_name ?? '',
    company: record?.company ?? '',
    work_carried_out: record?.work_carried_out ?? '',
    condition: record?.condition ?? 'Not Assessed',
    parts_replaced: record?.parts_replaced ?? '',
    recommendations: record?.recommendations ?? '',
    next_service_due: record?.next_service_due ?? '',
    cost: record?.cost != null ? String(record.cost) : '',
    status: record?.status ?? 'Completed',
    notes: record?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  async function handleSave() {
    if (!form.work_carried_out.trim()) return;
    setSaving(true);
    await onSave({
      service_date: form.service_date,
      service_type: form.service_type,
      engineer_name: form.engineer_name || null,
      company: form.company || null,
      work_carried_out: form.work_carried_out,
      condition: form.condition || null,
      parts_replaced: form.parts_replaced || null,
      recommendations: form.recommendations || null,
      next_service_due: form.next_service_due || null,
      cost: form.cost ? parseFloat(form.cost) : null,
      status: form.status,
      notes: form.notes || null,
    });
    setSaving(false);
  }

  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{record ? 'Edit Service Record' : 'New Service Record'}</h3>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.work_carried_out.trim()}
            className="flex items-center gap-1.5 bg-[#f97316] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}Save
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className={labelCls}>Service Date *</label><input type="date" className={inputCls + ' mt-1.5'} value={form.service_date} onChange={set('service_date')} /></div>
        <div><label className={labelCls}>Service Type *</label><select className={inputCls + ' mt-1.5'} value={form.service_type} onChange={set('service_type')}>{SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className={labelCls}>Engineer Name</label><input className={inputCls + ' mt-1.5'} value={form.engineer_name} onChange={set('engineer_name')} placeholder="e.g. John Smith" /></div>
        <div><label className={labelCls}>Company</label><input className={inputCls + ' mt-1.5'} value={form.company} onChange={set('company')} placeholder="e.g. ACME Facilities" /></div>
        <div><label className={labelCls}>Condition</label><select className={inputCls + ' mt-1.5'} value={form.condition} onChange={set('condition')}>{SERVICE_CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className={labelCls}>Status</label><select className={inputCls + ' mt-1.5'} value={form.status} onChange={set('status')}>{SERVICE_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className={labelCls}>Next Service Due</label><input type="date" className={inputCls + ' mt-1.5'} value={form.next_service_due} onChange={set('next_service_due')} /></div>
        <div><label className={labelCls}>Cost (£)</label><input type="number" step="0.01" min="0" className={inputCls + ' mt-1.5'} value={form.cost} onChange={set('cost')} placeholder="0.00" /></div>
      </div>
      <div><label className={labelCls}>Work Carried Out *</label><textarea className={inputCls + ' mt-1.5 resize-none'} rows={3} value={form.work_carried_out} onChange={set('work_carried_out')} placeholder="Describe the work performed..." /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className={labelCls}>Parts Replaced</label><textarea className={inputCls + ' mt-1.5 resize-none'} rows={2} value={form.parts_replaced} onChange={set('parts_replaced')} placeholder="List any parts replaced..." /></div>
        <div><label className={labelCls}>Recommendations</label><textarea className={inputCls + ' mt-1.5 resize-none'} rows={2} value={form.recommendations} onChange={set('recommendations')} placeholder="Any recommendations..." /></div>
      </div>
      <div><label className={labelCls}>Notes</label><textarea className={inputCls + ' mt-1.5 resize-none'} rows={2} value={form.notes} onChange={set('notes')} /></div>
    </div>
  );
}
