import React, { useState } from 'react';
import { MousePointer2, Plus, Hash, Minus, Square, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Undo2, Redo2, Layers } from 'lucide-react';
import type { DBTenderTakeoffItem } from './takeoffTypes';
import type { MeasurementType, TakeoffLineType } from './takeoffTypes';
import { TAKEOFF_COLOURS, DEFAULT_UNIT_FOR_TYPE } from './takeoffTypes';
import { DISCIPLINES } from './drawingTypes';
import { finalQuantity } from './takeoffCalculations';

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
  onToolChange: (tool: Tool) => void;
  onItemSelect: (itemId: string) => void;
  onCreateItem: (type: MeasurementType) => void;
  onUpdateItem: (id: string, updates: Partial<DBTenderTakeoffItem>) => void;
  onDeleteItem: (id: string) => void;
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
  onToolChange, onItemSelect, onCreateItem, onUpdateItem, onDeleteItem, onUndo, onRedo, onDeleteSelectedGeometry,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onSelect={() => onItemSelect(item.id)}
                  onUpdate={(updates) => onUpdateItem(item.id, updates)}
                  onDelete={() => onDeleteItem(item.id)}
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
  item, isActive, isExpanded, onToggle, onSelect, onUpdate, onDelete,
}: {
  item: DBTenderTakeoffItem;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onUpdate: (updates: Partial<DBTenderTakeoffItem>) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fq = finalQuantity(item);

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
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 bg-[#0d1628]/30">
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
              <label className="text-[9px] font-bold text-slate-600 uppercase">Line Type</label>
              <select value={item.line_type} onChange={e => onUpdate({ line_type: e.target.value as TakeoffLineType, updated_at: new Date().toISOString() })} className="w-full mt-0.5 px-2 py-1 bg-[#0d1628] border border-[#1e2d4a] rounded text-xs text-slate-200 focus:outline-none">
                <option value="standard">Standard</option>
                <option value="addition">Addition</option>
                <option value="omission">Omission</option>
              </select>
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
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-red-400 hover:text-red-300 border border-red-900/50 rounded hover:bg-red-900/20 transition-colors">
              <Trash2 size={11} />Delete Item
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={onDelete} className="px-2 py-1 text-[10px] font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors">Confirm Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-[10px] font-semibold text-slate-400 border border-[#1e2d4a] rounded hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
