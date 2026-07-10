import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import { usePermissions } from '../../lib/StoreContext';
import type { DBSupplierTrade, DBSupplierSpecialism, DBSupplierLabourRateType } from './types';

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors';
const btnPrimary = 'flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-400 text-white rounded-lg text-xs font-semibold transition-colors';
const btnSecondary = 'flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] hover:border-slate-500 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors';

type ListTab = 'trades' | 'specialisms' | 'rate_types';

interface EditRow {
  id: string;
  name: string;
}

function ListManager<T extends { id: string; name: string; is_active: boolean; sort_order: number }>({
  title,
  items,
  canEdit,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  items: T[];
  canEdit: boolean;
  onAdd: (name: string) => void;
  onUpdate: (item: T) => void;
  onRemove: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [editRow, setEditRow] = useState<EditRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName('');
  }

  function handleSaveEdit() {
    if (!editRow || !editRow.name.trim()) return;
    const item = items.find(i => i.id === editRow.id);
    if (item) onUpdate({ ...item, name: editRow.name.trim() });
    setEditRow(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-slate-500">{items.filter(i => i.is_active).length} active</span>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder={`Add new ${title.toLowerCase().replace(/s$/, '')}…`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} className={btnPrimary} disabled={!newName.trim()}>
            <Plus size={13} /> Add
          </button>
        </div>
      )}

      <div className="space-y-1">
        {sorted.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-6">No {title.toLowerCase()} added yet.</p>
        )}
        {sorted.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2">
            {editRow?.id === item.id ? (
              <>
                <input
                  autoFocus
                  className={`flex-1 bg-transparent border-b border-[#f97316] text-sm text-white focus:outline-none py-0.5`}
                  value={editRow.name}
                  onChange={e => setEditRow({ ...editRow, name: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditRow(null); }}
                />
                <button onClick={handleSaveEdit} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={13} /></button>
                <button onClick={() => setEditRow(null)} className="p-1 text-slate-500 hover:text-white"><X size={13} /></button>
              </>
            ) : confirmDelete === item.id ? (
              <>
                <span className="flex-1 text-xs text-red-400">Remove "{item.name}"?</span>
                <button onClick={() => { onRemove(item.id); setConfirmDelete(null); }} className="px-2 py-1 bg-red-900/40 text-red-400 border border-red-800 rounded text-[10px] font-semibold">Remove</button>
                <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-slate-500 hover:text-white text-[10px]">Cancel</button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${item.is_active ? 'text-slate-200' : 'text-slate-600 line-through'}`}>{item.name}</span>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdate({ ...item, is_active: !item.is_active })}
                      className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                      title={item.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {item.is_active ? <ToggleRight size={15} className="text-emerald-400" /> : <ToggleLeft size={15} />}
                    </button>
                    <button onClick={() => setEditRow({ id: item.id, name: item.name })} className="p-1 text-slate-500 hover:text-[#f97316] transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setConfirmDelete(item.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SupplyChainSettings() {
  const store = useAppStore();
  const perms = usePermissions();
  const canEdit = perms['supply_chain.create_edit'] ?? false;

  const [tab, setTab] = useState<ListTab>('trades');

  function genId() { return `sc${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

  // ── Trades ──────────────────────────────────────────────────────────────────

  function handleAddTrade(name: string) {
    const item: DBSupplierTrade = {
      id: genId(),
      org_id: store.currentOrgId ?? '',
      name,
      is_active: true,
      sort_order: store.supplierTrades.length,
    };
    store.addSupplierTrade(item);
  }

  // ── Specialisms ──────────────────────────────────────────────────────────────

  function handleAddSpecialism(name: string) {
    const item: DBSupplierSpecialism = {
      id: genId(),
      org_id: store.currentOrgId ?? '',
      name,
      is_active: true,
      sort_order: store.supplierSpecialisms.length,
    };
    store.addSupplierSpecialism(item);
  }

  // ── Labour Rate Types ────────────────────────────────────────────────────────

  function handleAddRateType(name: string) {
    const item: DBSupplierLabourRateType = {
      id: genId(),
      org_id: store.currentOrgId ?? '',
      name,
      is_default: false,
      is_active: true,
      sort_order: store.supplierLabourRateTypes.length,
    };
    store.addSupplierLabourRateType(item);
  }

  const tabCls = (t: ListTab) => `px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
    tab === t ? 'bg-[#f97316] text-white' : 'text-slate-400 hover:text-white hover:bg-[#1e2d4a]'
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-white mb-1">Supply Chain Settings</h2>
        <p className="text-xs text-slate-500">Manage the configurable lists used across all supplier records.</p>
      </div>

      <div className="flex gap-1 flex-wrap">
        <button className={tabCls('trades')} onClick={() => setTab('trades')}>Trades</button>
        <button className={tabCls('specialisms')} onClick={() => setTab('specialisms')}>Specialisms</button>
        <button className={tabCls('rate_types')} onClick={() => setTab('rate_types')}>Labour Rate Types</button>
      </div>

      <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-5">
        {tab === 'trades' && (
          <ListManager
            title="Trades"
            items={store.supplierTrades}
            canEdit={canEdit}
            onAdd={handleAddTrade}
            onUpdate={store.updateSupplierTrade}
            onRemove={store.removeSupplierTrade}
          />
        )}
        {tab === 'specialisms' && (
          <ListManager
            title="Specialisms"
            items={store.supplierSpecialisms}
            canEdit={canEdit}
            onAdd={handleAddSpecialism}
            onUpdate={store.updateSupplierSpecialism}
            onRemove={store.removeSupplierSpecialism}
          />
        )}
        {tab === 'rate_types' && (
          <ListManager
            title="Labour Rate Types"
            items={store.supplierLabourRateTypes}
            canEdit={canEdit}
            onAdd={handleAddRateType}
            onUpdate={store.updateSupplierLabourRateType}
            onRemove={store.removeSupplierLabourRateType}
          />
        )}
      </div>
    </div>
  );
}
