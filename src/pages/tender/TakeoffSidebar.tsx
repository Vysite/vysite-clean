import React, { useState, useEffect } from 'react';
import { MousePointer2, Plus, Hash, Minus, Square, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Undo2, Redo2, Layers, Check } from 'lucide-react';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { MeasurementType, TakeoffLineType } from './takeoffTypes';
import { TAKEOFF_COLOURS } from './takeoffTypes';
import { DISCIPLINES } from './drawingTypes';
import { finalQuantity, groupLinearRuns, areaPolygonQuantity, calcTakeoffCosts, signedTakeoffCosts, formatDuration, formatCurrency } from './takeoffCalculations';
import type { LabourBasis } from './takeoffTypes';
import type { DBTenderDrawingCalibration } from './drawingTypes';
import type { LinearGeometry, AreaGeometry } from './takeoffGeometry';

export type Tool = 'select' | 'pan' | 'count' | 'linear' | 'area';

interface Props {
  items: DBTenderTakeoffItem[];
  activeItemId: string | null;
  selectedGeometryId: string | null;
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  needsCalibration: boolean;
  calibration: DBTenderDrawingCalibration | null;
  pageWidth: number;
  pageHeight: number;
  onToolChange: (tool: Tool) => void;
  onItemSelect: (itemId: string) => void;
  onCreateItem: (type: MeasurementType) => void;
  onUpdateItem: (id: string, updates: Partial<DBTenderTakeoffItem>) => void;
  onFlushSaveItem: (id: string) => Promise<boolean>;
  onDeleteItem: (id: string) => void;
  onGeometrySelect: (geometryId: string) => void;
  canViewFinancials: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelectedGeometry: () => void;
}

const TOOLS: { key: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { key: 'select', label: 'Select', icon: MousePointer2 },
  { key: 'pan', label: 'Pan', icon: Layers },
  { key: 'count', label: 'Count', icon: Hash },
  { key: 'linear', label: 'Linear', icon: Minus },
  { key: 'area', label: 'Area', icon: Square },
];

const LINE_TYPE_COLORS: Record<TakeoffLineType, string> = {
  standard: 'text-slate-400',
  addition: 'text-emerald-400',
  omission: 'text-red-400',
};

export default function TakeoffSidebar({
  items, activeItemId, selectedGeometryId, tool, canUndo, canRedo, saveStatus, needsCalibration,
  calibration, pageWidth, pageHeight, canViewFinancials,
  onToolChange, onItemSelect, onCreateItem, onUpdateItem, onFlushSaveItem, onDeleteItem, onGeometrySelect, onUndo, onRedo, onDeleteSelectedGeometry,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auto-expand the active item so the user sees its breakdown
  useEffect(() => {
    if (activeItemId) setExpandedId(activeItemId);
  }, [activeItemId]);

  const grouped = {
    count: items.filter(i => i.measurement_type === 'count'),
    linear: items.filter(i => i.measurement_type === 'linear'),
    area: items.filter(i => i.measurement_type === 'area'),
  };

  return (
    <div className="w-72 shrink-0 border-l border-[#1e2d4a] bg-[#1a2236] flex flex-col h-full">
      {/* Tools */}
      <div className="p-3 border-b border-[#1e2d4a]">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Tools</p>
        <div className="grid grid-cols-5 gap-1">
          {TOOLS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onToolChange(key)}
              title={label}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[9px] font-semibold transition-colors ${
                tool === key ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-[#0d1628]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        {/* Undo/Redo + Delete */}
        <div className="flex items-center gap-1 mt-2">
          <button onClick={onUndo} disabled={!canUndo} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] disabled:opacity-30 transition-colors">
            <Undo2 size={12} />Undo
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] disabled:opacity-30 transition-colors">
            <Redo2 size={12} />Redo
          </button>
          {selectedGeometryId && (
            <button onClick={onDeleteSelectedGeometry} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-red-400 hover:text-red-300 border border-red-900/50 hover:bg-red-900/20 transition-colors ml-auto">
              <Trash2 size={12} />Del
            </button>
          )}
        </div>
        {/* Save status */}
        <div className="mt-2 text-[9px] text-slate-600 text-center">
          {saveStatus === 'saving' && <span className="text-amber-400">Saving...</span>}
          {saveStatus === 'saved' && <span className="text-emerald-400">Saved</span>}
          {saveStatus === 'error' && <span className="text-red-400">Save failed</span>}
        </div>
      </div>

      {/* Calibration warning */}
      {needsCalibration && (tool === 'linear' || tool === 'area') && (
        <div className="px-3 py-2 bg-amber-900/20 border-b border-amber-900/40 text-[10px] text-amber-400 font-semibold">
          Calibration required for {tool} measurements on this page.
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {(['count', 'linear', 'area'] as const).map(type => {
          const group = grouped[type];
          const typeLabel = type === 'count' ? 'Counted' : type === 'linear' ? 'Linear' : 'Area';
          return (
            <div key={type} className="border-b border-[#1e2d4a]">
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{typeLabel}</span>
                {group.length > 0 && <span className="text-[9px] text-slate-700">{group.length}</span>}
                <button onClick={() => onCreateItem(type)} className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#f97316] border border-[#f97316]/40 rounded-md hover:bg-[#f97316]/10 transition-colors">
                  <Plus size={12} />New
                </button>
              </div>
              {group.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isActive={activeItemId === item.id}
                  isExpanded={expandedId === item.id}
                  selectedGeometryId={selectedGeometryId}
                  calibration={calibration}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onSelect={() => onItemSelect(item.id)}
                  onGeometrySelect={onGeometrySelect}
                  canViewFinancials={canViewFinancials}
                  onUpdate={(updates) => onUpdateItem(item.id, updates)}
                  onDelete={() => onDeleteItem(item.id)}
                  onCollapse={() => setExpandedId(null)}
                  onFlushSave={() => onFlushSaveItem(item.id)}
                />
              ))}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-slate-600">No take-off items yet.</p>
            <p className="text-[10px] text-slate-700 mt-1">Select a tool and start measuring.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item, isActive, isExpanded, selectedGeometryId, calibration, pageWidth, pageHeight, canViewFinancials,
  onToggle, onSelect, onGeometrySelect, onUpdate, onDelete, onCollapse, onFlushSave,
}: {
  item: DBTenderTakeoffItem;
  isActive: boolean;
  isExpanded: boolean;
  selectedGeometryId: string | null;
  calibration: DBTenderDrawingCalibration | null;
  pageWidth: number;
  pageHeight: number;
  canViewFinancials: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onGeometrySelect: (geometryId: string) => void;
  onUpdate: (updates: Partial<DBTenderTakeoffItem>) => void;
  onDelete: () => void;
  onCollapse: () => void;
  onFlushSave: () => Promise<boolean>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quickDeleteTarget, setQuickDeleteTarget] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fq = finalQuantity(item);
  const measuredQty = item.source === 'manual' ? item.manual_quantity : item.quantity;

  // Build measurement breakdown
  const measurements: { id: string; label: string; qty: number }[] = [];
  if (item.geometry && item.measurement_type === 'linear') {
    const geo = item.geometry as LinearGeometry;
    const runs = groupLinearRuns(geo, calibration, pageWidth, pageHeight);
    runs.forEach((run, i) => {
      measurements.push({ id: run.runId, label: `Run ${String(i + 1).padStart(2, '0')}`, qty: run.quantity });
    });
  } else if (item.geometry && item.measurement_type === 'area') {
    const geo = item.geometry as AreaGeometry;
    geo.polygons.forEach((poly, i) => {
      const q = areaPolygonQuantity(poly, calibration, pageWidth, pageHeight);
      measurements.push({ id: poly.id, label: `Area ${String(i + 1).padStart(2, '0')}`, qty: Math.round(q * 10000) / 10000 });
    });
  } else if (item.geometry && item.measurement_type === 'count') {
    // Count: no per-point breakdown unless many points — just show total
  }

  return (
    <div className={`border-t border-[#0d1628] ${isActive ? 'bg-[#f97316]/10 border-l-2 border-l-[#f97316]' : 'border-l-2 border-l-transparent'}`}>
      <div className="flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-[#0d1628]/50 transition-colors" onClick={onSelect}>
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5 text-slate-600 hover:text-slate-400">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: item.colour }} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold truncate ${isActive ? 'text-[#f97316]' : 'text-slate-200'}`}>{item.label || 'Untitled'}{isActive && <span className="ml-1.5 text-[8px] font-bold text-[#f97316] bg-[#f97316]/20 px-1 py-0.5 rounded">ACTIVE</span>}</p>
          <p className="text-[9px] text-slate-500">{fq.toFixed(2)} {item.unit} · <span className={LINE_TYPE_COLORS[item.line_type]}>{item.line_type}</span></p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onUpdate({ is_visible: !item.is_visible }); }} className="p-0.5 text-slate-600 hover:text-slate-400 transition-colors">
          {item.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); setQuickDeleteTarget(true); }} className="p-0.5 text-slate-600 hover:text-red-400 transition-colors" title="Delete item">
          <Trash2 size={13} />
        </button>
      </div>

      {quickDeleteTarget && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4" onClick={() => setQuickDeleteTarget(false)}>
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] shadow-2xl w-full max-w-xs p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-white mb-1">Delete "{item.label || 'Untitled'}"?</p>
            <p className="text-xs text-slate-400 mb-4">This will remove the Take-Off item and its associated measurement geometry.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setQuickDeleteTarget(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-400 border border-[#1e2d4a] rounded hover:bg-[#1e2d4a] transition-colors">Cancel</button>
              <button onClick={() => { setQuickDeleteTarget(false); onDelete(); }} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="bg-[#0d1628]/30">
          {/* Measurement breakdown */}
          {measurements.length > 0 && (
            <div className="px-3 pt-2 pb-1">
              <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Measurements</p>
              <div className="space-y-0.5">
                {measurements.map((m, i) => {
                  const isMeasSelected = selectedGeometryId === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer text-[10px] transition-colors ${isMeasSelected ? 'bg-[#f97316]/20 text-[#f97316]' : 'text-slate-400 hover:bg-[#1e2d4a]'}`}
                      onClick={() => onGeometrySelect(m.id)}
                    >
                      <span className="flex-1 font-mono">{m.label}</span>
                      <span className="font-semibold">{m.qty.toFixed(2)} {item.unit}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onGeometrySelect(m.id); }}
                        className="p-0.5 text-slate-600 hover:text-red-400 transition-colors"
                        title="Select then use Del key or toolbar delete"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* Total row */}
              <div className="flex items-center gap-1.5 px-1.5 pt-1 mt-1 border-t border-[#1e2d4a]">
                <span className="flex-1 text-[10px] font-bold text-slate-500">Total</span>
                <span className="text-[10px] font-bold text-slate-300">{measuredQty.toFixed(2)} {item.unit}</span>
              </div>
              {item.adjustment_quantity !== 0 && (
                <div className="flex items-center gap-1.5 px-1.5 pt-0.5">
                  <span className="flex-1 text-[10px] text-slate-600">Adjustment</span>
                  <span className="text-[10px] text-slate-400">{item.adjustment_quantity > 0 ? '+' : ''}{item.adjustment_quantity.toFixed(2)}</span>
                </div>
              )}
              {item.adjustment_quantity !== 0 && (
                <div className="flex items-center gap-1.5 px-1.5 pt-0.5">
                  <span className="flex-1 text-[10px] font-bold text-slate-500">Final</span>
                  <span className="text-[10px] font-bold text-[#f97316]">{fq.toFixed(2)} {item.unit}</span>
                </div>
              )}
            </div>
          )}

          {/* Item properties */}
          <div className="px-3 pb-3 space-y-2">
            <div>
              <label className="text-[9px] font-bold text-slate-600 uppercase">Label</label>
              <input value={item.label} onChange={e => onUpdate({ label: e.target.value, updated_at: new Date().toISOString() })} className="w-full mt-0.5 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-600 uppercase">Description</label>
              <input value={item.description} onChange={e => onUpdate({ description: e.target.value, updated_at: new Date().toISOString() })} className="w-full mt-0.5 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-600 uppercase">Discipline</label>
                <select value={item.discipline} onChange={e => onUpdate({ discipline: e.target.value, updated_at: new Date().toISOString() })} className="w-full mt-0.5 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none">
                  {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-600 uppercase">Type</label>
                <div className="flex gap-1 mt-0.5">
                  <button onClick={() => onUpdate({ line_type: 'standard' as TakeoffLineType, updated_at: new Date().toISOString() })} className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${item.line_type === 'standard' ? 'bg-slate-600 text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#0d1628]'}`}>STD</button>
                  <button onClick={() => onUpdate({ line_type: 'addition' as TakeoffLineType, updated_at: new Date().toISOString() })} className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${item.line_type === 'addition' ? 'bg-emerald-600 text-white' : 'text-emerald-400 border border-[#1e2d4a] hover:bg-[#0d1628]'}`}>+ ADD</button>
                  <button onClick={() => onUpdate({ line_type: 'omission' as TakeoffLineType, updated_at: new Date().toISOString() })} className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${item.line_type === 'omission' ? 'bg-red-600 text-white' : 'text-red-400 border border-[#1e2d4a] hover:bg-[#0d1628]'}`}>- OMIT</button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-600 uppercase">Colour</label>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {TAKEOFF_COLOURS.map(c => (
                  <button key={c} onClick={() => onUpdate({ colour: c, updated_at: new Date().toISOString() })} className={`w-5 h-5 rounded ${item.colour === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-600 uppercase">Adjustment</label>
                <input type="number" step="any" value={item.adjustment_quantity} onChange={e => onUpdate({ adjustment_quantity: parseFloat(e.target.value) || 0, updated_at: new Date().toISOString() })} className="w-full mt-0.5 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-600 uppercase">Unit</label>
                <input value={item.unit} onChange={e => onUpdate({ unit: e.target.value, updated_at: new Date().toISOString() })} className="w-full mt-0.5 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-600 uppercase">Notes</label>
              <input value={item.notes} onChange={e => onUpdate({ notes: e.target.value, updated_at: new Date().toISOString() })} className="w-full mt-0.5 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50" />
            </div>
            {/* Cost Build-Up */}
            {canViewFinancials && (
              <CostBuildUpSection item={item} onUpdate={onUpdate} />
            )}
            {/* Save + Delete actions */}
            {saveError && <p className="text-[9px] text-red-400 font-semibold">{saveError}</p>}
            <div className="flex items-center justify-between pt-1">
              <button onClick={async () => {
                setIsSaving(true);
                setSaveError(null);
                const ok = await onFlushSave();
                setIsSaving(false);
                if (ok) { onCollapse(); } else { setSaveError('Save failed — check connection and retry.'); }
              }} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <Check size={12} />{isSaving ? 'Saving...' : 'Save'}
              </button>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-red-400 hover:text-red-300 border border-red-900/50 rounded hover:bg-red-900/20 transition-colors">
                  <Trash2 size={11} />Delete Item
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={onDelete} className="px-2 py-1 text-[10px] font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors">Confirm Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-[10px] font-semibold text-slate-400 border border-[#1e2d4a] rounded hover:bg-[#1e2d4a] transition-colors">Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CostBuildUpSection({ item, onUpdate }: {
  item: DBTenderTakeoffItem;
  onUpdate: (updates: Partial<DBTenderTakeoffItem>) => void;
}) {
  const costs = calcTakeoffCosts(item);
  const signed = signedTakeoffCosts(item);
  const labourBasis = item.labour_basis ?? 'per_unit';
  const labelCls = 'text-[9px] font-bold text-slate-600 uppercase';
  const inputCls = 'w-full px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none focus:border-[#f97316]/50 font-mono';
  const valCls = 'text-[10px] text-slate-300 font-mono';
  const totalCls = 'text-[10px] font-bold text-[#f97316] font-mono';

  const perUnitMins = item.labour_minutes_per_unit ?? 0;
  const lumpSumMins = item.labour_minutes_lump_sum ?? 0;

  return (
    <div className="mt-2 pt-2 border-t border-[#1e2d4a] space-y-2">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Cost Build-Up</p>

      {/* Material */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <label className={`${labelCls} w-20 shrink-0`}>Material Rate</label>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-[10px] text-slate-500">£</span>
            <input
              type="number" step="any" min="0"
              value={item.material_cost_rate ?? 0}
              onChange={e => onUpdate({ material_cost_rate: parseFloat(e.target.value) || 0, updated_at: new Date().toISOString() })}
              className={inputCls}
            />
            <span className="text-[10px] text-slate-500 whitespace-nowrap">/ {item.unit}</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] text-slate-600">Material Cost</span>
          <span className={valCls}>{formatCurrency(costs.materialCostTotal)}</span>
        </div>
      </div>

      {/* Labour */}
      <div className="space-y-1 pt-1 border-t border-[#1e2d4a]/50">
        <div className="flex items-center gap-2">
          <label className={`${labelCls} w-20 shrink-0`}>Labour Basis</label>
          <div className="flex gap-1 flex-1">
            <button
              onClick={() => onUpdate({ labour_basis: 'per_unit' as LabourBasis, updated_at: new Date().toISOString() })}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${labourBasis === 'per_unit' ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#0d1628]'}`}
            >Per Unit</button>
            <button
              onClick={() => onUpdate({ labour_basis: 'lump_sum' as LabourBasis, updated_at: new Date().toISOString() })}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${labourBasis === 'lump_sum' ? 'bg-[#f97316] text-white' : 'text-slate-400 border border-[#1e2d4a] hover:bg-[#0d1628]'}`}
            >Lump Sum</button>
          </div>
        </div>

        {labourBasis === 'per_unit' ? (
          <div className="flex items-center gap-2">
            <label className={`${labelCls} w-20 shrink-0`}>Labour / {item.unit}</label>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number" min="0"
                value={Math.floor(perUnitMins / 60)}
                onChange={e => {
                  const h = parseInt(e.target.value) || 0;
                  const m = perUnitMins % 60;
                  onUpdate({ labour_minutes_per_unit: h * 60 + m, updated_at: new Date().toISOString() });
                }}
                className={`${inputCls} w-14`}
                placeholder="hrs"
              />
              <span className="text-[10px] text-slate-500">h</span>
              <input
                type="number" min="0" max="59"
                value={perUnitMins % 60}
                onChange={e => {
                  const m = parseInt(e.target.value) || 0;
                  const h = Math.floor(perUnitMins / 60);
                  onUpdate({ labour_minutes_per_unit: h * 60 + m, updated_at: new Date().toISOString() });
                }}
                className={`${inputCls} w-14`}
                placeholder="min"
              />
              <span className="text-[10px] text-slate-500">m</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className={`${labelCls} w-20 shrink-0`}>Total Labour</label>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number" min="0"
                value={Math.floor(lumpSumMins / 60)}
                onChange={e => {
                  const h = parseInt(e.target.value) || 0;
                  const m = lumpSumMins % 60;
                  onUpdate({ labour_minutes_lump_sum: h * 60 + m, updated_at: new Date().toISOString() });
                }}
                className={`${inputCls} w-14`}
                placeholder="hrs"
              />
              <span className="text-[10px] text-slate-500">h</span>
              <input
                type="number" min="0" max="59"
                value={lumpSumMins % 60}
                onChange={e => {
                  const m = parseInt(e.target.value) || 0;
                  const h = Math.floor(lumpSumMins / 60);
                  onUpdate({ labour_minutes_lump_sum: h * 60 + m, updated_at: new Date().toISOString() });
                }}
                className={`${inputCls} w-14`}
                placeholder="min"
              />
              <span className="text-[10px] text-slate-500">m</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className={`${labelCls} w-20 shrink-0`}>Labour Rate</label>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-[10px] text-slate-500">£</span>
            <input
              type="number" step="any" min="0"
              value={item.labour_rate ?? 0}
              onChange={e => onUpdate({ labour_rate: parseFloat(e.target.value) || 0, updated_at: new Date().toISOString() })}
              className={inputCls}
            />
            <span className="text-[10px] text-slate-500 whitespace-nowrap">/ hr</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] text-slate-600">Total Labour</span>
          <span className={valCls}>{formatDuration(costs.totalLabourMinutes)}</span>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] text-slate-600">Labour Cost</span>
          <span className={valCls}>{formatCurrency(costs.labourCostTotal)}</span>
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-1 pt-1 border-t border-[#1e2d4a]">
        <span className="text-[10px] font-bold text-slate-400">Total Cost</span>
        <span className={totalCls}>{formatCurrency(costs.totalCost)}</span>
      </div>
      {/* Commercial Effect (signed by line_type) */}
      {signed.lineType === 'omission' && (
        <div className="flex items-center justify-between px-1 pt-1 border-t border-[#1e2d4a]/50">
          <span className="text-[10px] font-bold text-red-400">Commercial Effect</span>
          <span className="text-[10px] font-bold text-red-400 font-mono">−{formatCurrency(costs.totalCost)}</span>
        </div>
      )}
    </div>
  );
}
