import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Hash, Minus, Square, FileText, AlertCircle, X, Download, ChevronDown } from 'lucide-react';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { MeasurementType, TakeoffLineType } from './takeoffTypes';
import { DISCIPLINES } from './drawingTypes';
import { finalQuantity, calcTakeoffCosts, signedTakeoffCosts, formatCurrency } from './takeoffCalculations';
import { exportInternalTakeoffPDF, exportClientTakeoffPDF } from './TakeoffSchedulePDF';
import { exportMarkedUpDrawingPDF } from './TakeoffDrawingPDF';

interface Props {
  tenderId: string;
  tenderName: string;
  tenderRef: string;
  tenderClient: string;
  tenderLocation: string;
}

const TYPE_ICONS: Record<MeasurementType, typeof Hash> = {
  count: Hash, linear: Minus, area: Square,
};

const LINE_TYPE_BADGES: Record<TakeoffLineType, string> = {
  standard: 'bg-slate-700 text-slate-400',
  addition: 'bg-emerald-900/60 text-emerald-400',
  omission: 'bg-red-900/60 text-red-400',
};

export default function TakeoffSchedule({ tenderId, tenderName, tenderRef, tenderClient, tenderLocation }: Props) {
  const store = useAppStore();
  const perms = usePermissions();
  const isAdmin = store.currentUser?.role === 'Admin';
  const canViewFinancials = perms['tender.view_financials'] || isAdmin;
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [lineTypeFilter, setLineTypeFilter] = useState('all');
  const [drawingFilter, setDrawingFilter] = useState('all');
  const [view, setView] = useState<'byDrawing' | 'list'>('list');
  const [showAddManual, setShowAddManual] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    store.loadTenderTakeoffItems(tenderId);
  }, [tenderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also load drawings for the filter/grouping
  useEffect(() => {
    store.loadTenderDrawings(tenderId);
  }, [tenderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawings = store.tenderDrawings.filter(d => d.tender_id === tenderId);
  const drawingName = useCallback((id: string | null) => {
    if (!id) return 'Manual';
    const d = drawings.find(dr => dr.id === id);
    return d ? `${d.drawing_number || d.title}` : 'Unknown Drawing';
  }, [drawings]);

  const filtered = store.tenderTakeoffItems.filter(item => {
    if (item.tender_id !== tenderId) return false;
    if (disciplineFilter !== 'all' && item.discipline !== disciplineFilter) return false;
    if (lineTypeFilter !== 'all' && item.line_type !== lineTypeFilter) return false;
    if (drawingFilter !== 'all') {
      if (drawingFilter === 'manual' && item.drawing_id !== null) return false;
      if (drawingFilter !== 'manual' && item.drawing_id !== drawingFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by drawing
  const byDrawing = filtered.reduce<Record<string, DBTenderTakeoffItem[]>>((acc, item) => {
    const key = item.drawing_id ?? 'manual';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Export handlers
  const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const logoDataUrl = store.settings?.logo_data_url;

  function buildPDFData() {
    return {
      tenderName, tenderRef, client: tenderClient, location: tenderLocation,
      exportDate, logoDataUrl,
      items: store.tenderTakeoffItems.filter(i => i.tender_id === tenderId),
      drawings: store.tenderDrawings.filter(d => d.tender_id === tenderId),
      calibrations: store.tenderDrawingCalibrations,
    };
  }

  function handleExportInternal() {
    const data = buildPDFData();
    if (data.items.length === 0) { setError('No Take-Off items to export.'); return; }
    exportInternalTakeoffPDF(data);
  }

  function handleExportClient() {
    const data = buildPDFData();
    if (data.items.length === 0) { setError('No Take-Off items to export.'); return; }
    exportClientTakeoffPDF(data);
  }

  async function handleExportDrawing() {
    const data = buildPDFData();
    const drawingItems = data.items.filter(i => i.drawing_id !== null);
    if (drawingItems.length === 0) { setError('No drawing-linked Take-Off items to export.'); return; }
    const drawingIds = [...new Set(drawingItems.map(i => i.drawing_id!))];
    setExporting(true);
    try {
      for (const drawingId of drawingIds) {
        const drawing = data.drawings.find(d => d.id === drawingId);
        if (!drawing) continue;
        const url = await store.getTenderDrawingSignedUrl(drawing.storage_path);
        if (!url) continue;
        const response = await fetch(url);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        await exportMarkedUpDrawingPDF({
          drawing,
          items: data.items.filter(i => i.drawing_id === drawingId),
          calibrations: data.calibrations,
          pdfBytes: arrayBuffer,
          tenderName, tenderRef,
          internal: canViewFinancials,
        });
      }
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-0.5 hover:text-red-200"><X size={14} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search take-off..." className="w-full pl-9 pr-3 py-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:border-[#f97316]/50 focus:outline-none" />
        </div>
        <select value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)} className="px-3 py-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-sm text-slate-300 focus:outline-none">
          <option value="all">All Disciplines</option>
          {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={drawingFilter} onChange={e => setDrawingFilter(e.target.value)} className="px-3 py-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-sm text-slate-300 focus:outline-none">
          <option value="all">All Drawings</option>
          <option value="manual">Manual Items</option>
          {drawings.map(d => <option key={d.id} value={d.id}>{d.drawing_number || d.title}</option>)}
        </select>
        <select value={lineTypeFilter} onChange={e => setLineTypeFilter(e.target.value)} className="px-3 py-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-sm text-slate-300 focus:outline-none">
          <option value="all">All Types</option>
          <option value="standard">Standard</option>
          <option value="addition">Addition</option>
          <option value="omission">Omission</option>
        </select>
        <div className="flex gap-1 bg-[#0d1628] rounded-lg p-1 border border-[#1e2d4a]">
          <button onClick={() => setView('list')} className={`px-2.5 py-1 rounded text-xs font-semibold ${view === 'list' ? 'bg-[#f97316] text-white' : 'text-slate-500'}`}>List</button>
          <button onClick={() => setView('byDrawing')} className={`px-2.5 py-1 rounded text-xs font-semibold ${view === 'byDrawing' ? 'bg-[#f97316] text-white' : 'text-slate-500'}`}>By Drawing</button>
        </div>
        <button onClick={() => setShowAddManual(true)} className="flex items-center gap-2 px-3 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
          <Plus size={14} />Manual Item
        </button>
        <div className="relative">
          <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exporting || store.tenderTakeoffItems.length === 0} className="flex items-center gap-2 px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-300 hover:bg-[#1e2d4a] hover:text-white disabled:opacity-30 transition-colors">
            <Download size={14} />Export PDF <ChevronDown size={12} />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-[#1a2236] border border-[#1e2d4a] rounded-lg shadow-2xl overflow-hidden">
                {canViewFinancials && (
                  <button onClick={() => { setShowExportMenu(false); handleExportInternal(); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-[#1e2d4a] hover:text-white transition-colors text-left">
                    <FileText size={14} />Internal Take-Off
                  </button>
                )}
                <button onClick={() => { setShowExportMenu(false); handleExportClient(); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-[#1e2d4a] hover:text-white transition-colors text-left border-t border-[#1e2d4a]">
                  <FileText size={14} />Client Take-Off
                </button>
                <button onClick={() => { setShowExportMenu(false); handleExportDrawing(); }} disabled={drawings.length === 0} className="w-full flex items-center gap-3 px-4 py-3 text-xs text-slate-300 hover:bg-[#1e2d4a] hover:text-white transition-colors text-left border-t border-[#1e2d4a] disabled:opacity-30">
                  <FileText size={14} />Marked-Up Drawing
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary — no mixed-unit totals */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-[#1a2236] rounded-lg border border-[#1e2d4a] text-xs flex-wrap">
        <span className="text-slate-500">{filtered.length} Take-Off Items</span>
        {(() => {
          const counted = filtered.filter(i => i.measurement_type === 'count');
          const linear = filtered.filter(i => i.measurement_type === 'linear');
          const area = filtered.filter(i => i.measurement_type === 'area');
          const countTotal = counted.reduce((s, i) => s + finalQuantity(i), 0);
          const linearTotal = linear.reduce((s, i) => s + finalQuantity(i), 0);
          const areaTotal = area.reduce((s, i) => s + finalQuantity(i), 0);
          return (
            <>
              {counted.length > 0 && <span className="text-slate-300">Counted: <span className="text-[#f97316] font-semibold">{countTotal.toFixed(0)} nr</span></span>}
              {linear.length > 0 && <span className="text-slate-300">Linear: <span className="text-[#f97316] font-semibold">{linearTotal.toFixed(2)} m</span></span>}
              {area.length > 0 && <span className="text-slate-300">Area: <span className="text-[#f97316] font-semibold">{areaTotal.toFixed(2)} m²</span></span>}
            </>
          );
        })()}
        {canViewFinancials && filtered.length > 0 && (() => {
          const signed = filtered.map(i => signedTakeoffCosts(i));
          const totalMaterial = signed.reduce((s, c) => s + c.signedMaterialCost, 0);
          const totalLabour = signed.reduce((s, c) => s + c.signedLabourCost, 0);
          const totalCost = signed.reduce((s, c) => s + c.signedTotalCost, 0);
          return (
            <span className="ml-auto text-slate-300">
              Material: <span className="text-slate-200 font-semibold">{formatCurrency(totalMaterial)}</span>
              <span className="text-slate-600 mx-2">·</span>
              Labour: <span className="text-slate-200 font-semibold">{formatCurrency(totalLabour)}</span>
              <span className="text-slate-600 mx-2">·</span>
              <span className="text-[#f97316] font-bold">{formatCurrency(totalCost)}</span>
            </span>
          );
        })()}
      </div>

      {/* Loading */}
      {store.tenderTakeoffItems.length === 0 && !search && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="w-14 h-14 rounded-2xl bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center mb-4">
            <Hash size={26} className="text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-300 mb-1.5">No take-off items yet</p>
          <p className="text-xs text-slate-500 max-w-sm">Open a drawing from the Drawings tab to start measuring, or add a manual item.</p>
        </div>
      )}

      {/* List view */}
      {view === 'list' && filtered.length > 0 && (
        <div className="overflow-x-auto bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2d4a]">
                {['Label', 'Drawing', 'Pg', 'Discipline', 'Type', 'Measured', 'Adj', 'Final', 'Unit', 'Line', 'Source', ...(canViewFinancials ? ['Mat Rate', 'Mat Cost', 'Labour Cost', 'Effect'] : [])].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider pb-3 pt-3 px-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]">
              {filtered.map(item => {
                const Icon = TYPE_ICONS[item.measurement_type];
                const fq = finalQuantity(item);
                const costs = canViewFinancials ? calcTakeoffCosts(item) : null;
                return (
                  <tr key={item.id} className="hover:bg-[#0d1628]/40 transition-colors">
                    <td className="py-2.5 px-3 text-sm text-slate-200 font-medium max-w-[200px] truncate">{item.label || 'Untitled'}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-400 whitespace-nowrap">{drawingName(item.drawing_id)}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">{item.page_number}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-400">{item.discipline}</td>
                    <td className="py-2.5 px-3"><Icon size={13} className="text-slate-500" /></td>
                    <td className="py-2.5 px-3 text-xs text-slate-300 font-mono">{item.source === 'manual' ? item.manual_quantity.toFixed(3) : item.quantity.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-400 font-mono">{item.adjustment_quantity !== 0 ? item.adjustment_quantity.toFixed(3) : '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-[#f97316] font-mono font-semibold">{fq.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-400">{item.unit}</td>
                    <td className="py-2.5 px-3"><span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${LINE_TYPE_BADGES[item.line_type]}`}>{item.line_type}</span></td>
                    <td className="py-2.5 px-3 text-[10px] text-slate-500">{item.source}</td>
                    {canViewFinancials && costs && (() => {
                      const signed = signedTakeoffCosts(item);
                      return (
                        <>
                          <td className="py-2.5 px-3 text-xs text-slate-400 font-mono whitespace-nowrap">{formatCurrency(costs.materialCostRate)}</td>
                          <td className="py-2.5 px-3 text-xs text-slate-300 font-mono whitespace-nowrap">{formatCurrency(costs.materialCostTotal)}</td>
                          <td className="py-2.5 px-3 text-xs text-slate-300 font-mono whitespace-nowrap">{formatCurrency(costs.labourCostTotal)}</td>
                          <td className={`py-2.5 px-3 text-xs font-mono font-semibold whitespace-nowrap ${signed.lineType === 'omission' ? 'text-red-400' : 'text-[#f97316]'}`}>{signed.lineType === 'omission' ? '−' : ''}{formatCurrency(costs.totalCost)}</td>
                        </>
                      );
                    })()}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* By Drawing view */}
      {view === 'byDrawing' && filtered.length > 0 && (
        <div className="space-y-3">
          {Object.entries(byDrawing).map(([drawKey, drawItems]) => (
            <div key={drawKey} className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1e2d4a] bg-[#0d1628]/50">
                {drawKey === 'manual' ? <Plus size={14} className="text-slate-500" /> : <FileText size={14} className="text-[#f97316]" />}
                <span className="text-sm font-semibold text-slate-200">{drawingName(drawKey === 'manual' ? null : drawKey)}</span>
                <span className="text-[10px] text-slate-600">{drawItems.length} items</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e2d4a]">
                    {['Label', 'Pg', 'Type', 'Measured', 'Adj', 'Final', 'Unit', 'Line'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider pb-2 pt-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d4a]">
                  {drawItems.map(item => {
                    const Icon = TYPE_ICONS[item.measurement_type];
                    const fq = finalQuantity(item);
                    return (
                      <tr key={item.id} className="hover:bg-[#0d1628]/40 transition-colors">
                        <td className="py-2 px-3 text-sm text-slate-200 font-medium max-w-[200px] truncate">{item.label || 'Untitled'}</td>
                        <td className="py-2 px-3 text-xs text-slate-500">{item.page_number}</td>
                        <td className="py-2 px-3"><Icon size={13} className="text-slate-500" /></td>
                        <td className="py-2 px-3 text-xs text-slate-300 font-mono">{item.source === 'manual' ? item.manual_quantity.toFixed(3) : item.quantity.toFixed(3)}</td>
                        <td className="py-2 px-3 text-xs text-slate-400 font-mono">{item.adjustment_quantity !== 0 ? item.adjustment_quantity.toFixed(3) : '—'}</td>
                        <td className="py-2 px-3 text-xs text-[#f97316] font-mono font-semibold">{fq.toFixed(3)}</td>
                        <td className="py-2 px-3 text-xs text-slate-400">{item.unit}</td>
                        <td className="py-2 px-3"><span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${LINE_TYPE_BADGES[item.line_type]}`}>{item.line_type}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Add manual item modal */}
      {showAddManual && (
        <AddManualItemModal
          tenderId={tenderId}
          tenderName={tenderName}
          onClose={() => setShowAddManual(false)}
          onAdded={() => { setShowAddManual(false); store.loadTenderTakeoffItems(tenderId); }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

function AddManualItemModal({ tenderId, tenderName, onClose, onAdded, onError }: {
  tenderId: string; tenderName: string; onClose: () => void; onAdded: () => void; onError: (msg: string) => void;
}) {
  const store = useAppStore();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [measurementType, setMeasurementType] = useState<MeasurementType>('count');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [unit, setUnit] = useState('nr');
  const [discipline, setDiscipline] = useState('General');
  const [category, setCategory] = useState('');
  const [lineType, setLineType] = useState<TakeoffLineType>('standard');
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    if (!label.trim()) { onError('Label is required.'); return; }
    const oid = store.currentOrgId;
    if (!oid) { onError('No organisation context.'); return; }

    const item: DBTenderTakeoffItem = {
      id: crypto.randomUUID(),
      org_id: oid,
      tender_id: tenderId,
      drawing_id: null,
      page_number: 1,
      label: label.trim(),
      description: description.trim(),
      measurement_type: measurementType,
      quantity: 0,
      unit,
      geometry: null,
      colour: '#f97316',
      notes: notes.trim(),
      sort_order: 0,
      is_visible: true,
      source: 'manual',
      discipline,
      category: category.trim(),
      manual_quantity: parseFloat(manualQuantity) || 0,
      adjustment_quantity: 0,
      line_type: lineType,
      created_by: store.currentUser?.name ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const err = await store.addTenderTakeoffItem(item);
    if (err) { onError(`Failed to add item: ${err}`); } else { onAdded(); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <p className="text-sm font-bold text-white">Add Manual Item — {tenderName}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase">Label *</label>
            <input value={label} onChange={e => setLabel(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" placeholder="e.g. Fire Dampers" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Type</label>
              <select value={measurementType} onChange={e => setMeasurementType(e.target.value as MeasurementType)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none">
                <option value="count">Count</option>
                <option value="linear">Linear</option>
                <option value="area">Area</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Quantity</label>
              <input type="number" step="any" value={manualQuantity} onChange={e => setManualQuantity(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Unit</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Line Type</label>
              <select value={lineType} onChange={e => setLineType(e.target.value as TakeoffLineType)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none">
                <option value="standard">Standard</option>
                <option value="addition">Addition</option>
                <option value="omission">Omission</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Discipline</label>
              <select value={discipline} onChange={e => setDiscipline(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none">
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full mt-1 px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
          </div>
        </div>
        <div className="flex gap-3 justify-end p-5 border-t border-[#1e2d4a]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors">Cancel</button>
          <button onClick={handleAdd} className="px-4 py-2 text-sm font-semibold text-white bg-[#f97316] rounded-lg hover:bg-orange-600 transition-colors">Add Item</button>
        </div>
      </div>
    </div>
  );
}
