import { useState } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, CreditCard as Edit2, Check, X, GripVertical, FileText, FlaskConical, FolderOpen, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBOAndMSection, DBOAndMItem, OAndMSourceModule } from './types';
import { SOURCE_MODULE_LABELS, SOURCE_MODULE_COLOURS, genId } from './types';
import OAndMSourcePicker from './OAndMSourcePicker';

const SOURCE_ICON: Record<OAndMSourceModule, React.ComponentType<{ size?: number; className?: string }>> = {
  project_document: FolderOpen,
  tc_record: FlaskConical,
  site_form: FileText,
};

interface Props {
  sections: DBOAndMSection[];
  items: DBOAndMItem[];
  manualId: string;
  projectId: string;
  canEdit: boolean;
  onAddSection: (s: DBOAndMSection) => void;
  onUpdateSection: (s: DBOAndMSection) => void;
  onRemoveSection: (id: string) => void;
  onReorderSections: (sections: DBOAndMSection[]) => void;
  onAddItem: (item: DBOAndMItem) => void;
  onUpdateItem: (item: DBOAndMItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (items: DBOAndMItem[]) => void;
  currentUserName: string;
}

function SectionRow({
  section, items, index, total, canEdit,
  onUpdate, onRemove, onMoveUp, onMoveDown,
  onAddItem, onUpdateItem, onRemoveItem, onReorderItems,
  projectId, currentUserName,
}: {
  section: DBOAndMSection;
  items: DBOAndMItem[];
  index: number;
  total: number;
  canEdit: boolean;
  onUpdate: (s: DBOAndMSection) => void;
  onRemove: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddItem: (item: DBOAndMItem) => void;
  onUpdateItem: (item: DBOAndMItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (items: DBOAndMItem[]) => void;
  projectId: string;
  currentUserName: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(section.description);
  const [showPicker, setShowPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemNotesDraft, setItemNotesDraft] = useState('');

  const existingSourceIds = new Set(items.map(i => i.source_record_id));

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== section.title) onUpdate({ ...section, title: t });
    else setTitleDraft(section.title);
    setEditingTitle(false);
  };

  const saveDesc = () => {
    onUpdate({ ...section, description: descDraft });
    setEditingDesc(false);
  };

  const handlePickerAdd = (picked: { source_module: OAndMSourceModule; source_record_id: string; title: string; subtitle: string }[]) => {
    const baseOrder = items.length;
    picked.forEach((p, idx) => {
      onAddItem({
        id: genId(),
        section_id: section.id,
        manual_id: section.manual_id,
        project_id: projectId,
        source_module: p.source_module,
        source_record_id: p.source_record_id,
        title: p.title,
        subtitle: p.subtitle,
        notes: '',
        sort_order: baseOrder + idx,
        created_by: currentUserName,
      });
    });
    setShowPicker(false);
  };

  const moveItem = (item: DBOAndMItem, dir: 'up' | 'down') => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(i => i.id === item.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newOrder = sorted.map((it, i) => ({ ...it, sort_order: i }));
    const tmp = newOrder[idx].sort_order;
    newOrder[idx] = { ...newOrder[idx], sort_order: newOrder[swapIdx].sort_order };
    newOrder[swapIdx] = { ...newOrder[swapIdx], sort_order: tmp };
    onReorderItems(newOrder);
  };

  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111827] border-b border-[#1e2d4a]">
        {canEdit && (
          <div className="flex flex-col gap-0.5">
            <button onClick={onMoveUp} disabled={index === 0} className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors p-0.5">
              <ChevronUp size={12} />
            </button>
            <button onClick={onMoveDown} disabled={index === total - 1} className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors p-0.5">
              <ChevronDown size={12} />
            </button>
          </div>
        )}

        <button onClick={() => setExpanded(v => !v)} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <span className="text-[10px] font-mono text-slate-600 shrink-0 w-6 text-center">
            {String(index + 1).padStart(2, '0')}
          </span>
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleDraft(section.title); setEditingTitle(false); } }}
              onBlur={saveTitle}
              autoFocus
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-[#0d1628] border border-[#2a3a5a] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
          ) : (
            <span className="text-sm font-bold text-white truncate">{section.title}</span>
          )}
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${items.length > 0 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-slate-600 bg-transparent border-[#1e2d4a]'}`}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          <ChevronDown size={13} className={`shrink-0 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {canEdit && !editingTitle && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setEditingTitle(true); setTitleDraft(section.title); }}
              className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-[#1e2d4a] rounded transition-colors"
            >
              <Edit2 size={11} />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button onClick={() => onRemove(section.id)} className="px-2 py-1 text-[10px] font-semibold text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors">
                  Delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section body */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Section description */}
          <div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  rows={2}
                  placeholder="Section introductory note (optional) — appears in PDF header for this section"
                  className="w-full bg-[#111827] border border-[#2a3a5a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#f97316] resize-none transition-colors"
                />
                <div className="flex gap-2">
                  <button onClick={saveDesc} className="flex items-center gap-1.5 px-3 py-1 bg-[#f97316] text-white text-xs font-semibold rounded transition-colors hover:bg-orange-400">
                    <Check size={10} /> Save note
                  </button>
                  <button onClick={() => { setDescDraft(section.description); setEditingDesc(false); }} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => canEdit && setEditingDesc(true)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-xs ${
                  section.description
                    ? 'text-slate-400 border-[#1e2d4a] hover:border-[#2a3a5a] bg-[#0a1220]'
                    : 'text-slate-600 border-dashed border-[#1e2d4a] hover:border-[#2a3a5a] hover:text-slate-500'
                } ${!canEdit ? 'cursor-default' : 'cursor-text'}`}
              >
                {section.description || (canEdit ? 'Add introductory note for this section…' : 'No introductory note')}
              </button>
            )}
          </div>

          {/* Items */}
          {sortedItems.length > 0 && (
            <div className="space-y-1.5">
              {sortedItems.map((item, iIdx) => {
                const Icon = SOURCE_ICON[item.source_module];
                const colourClass = SOURCE_MODULE_COLOURS[item.source_module];
                const label = SOURCE_MODULE_LABELS[item.source_module];
                const isEditingNotes = editingItemId === item.id;

                return (
                  <div key={item.id} className="flex items-start gap-2 group bg-[#111827] border border-[#1e2d4a] rounded-lg px-3 py-2.5 hover:border-[#2a3a5a] transition-colors">
                    {canEdit && (
                      <div className="flex flex-col gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveItem(item, 'up')} disabled={iIdx === 0} className="text-slate-700 hover:text-slate-400 disabled:opacity-20 p-0.5 transition-colors">
                          <ChevronUp size={10} />
                        </button>
                        <button onClick={() => moveItem(item, 'down')} disabled={iIdx === sortedItems.length - 1} className="text-slate-700 hover:text-slate-400 disabled:opacity-20 p-0.5 transition-colors">
                          <ChevronDown size={10} />
                        </button>
                      </div>
                    )}
                    <GripVertical size={12} className="text-slate-700 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colourClass}`}>
                          <Icon size={9} />
                          {label}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate">{item.title}</span>
                        {item.subtitle && (
                          <span className="text-[10px] text-slate-600 truncate">{item.subtitle}</span>
                        )}
                      </div>

                      {isEditingNotes ? (
                        <div className="mt-2 space-y-1.5">
                          <textarea
                            value={itemNotesDraft}
                            onChange={e => setItemNotesDraft(e.target.value)}
                            rows={2}
                            placeholder="Editor annotation for this item…"
                            className="w-full bg-[#0d1628] border border-[#2a3a5a] rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#f97316] resize-none transition-colors"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { onUpdateItem({ ...item, notes: itemNotesDraft }); setEditingItemId(null); }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white bg-[#f97316] rounded hover:bg-orange-400 transition-colors"
                            >
                              <Check size={9} /> Save
                            </button>
                            <button onClick={() => setEditingItemId(null)} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : item.notes ? (
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{item.notes}</p>
                      ) : null}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                        <button
                          onClick={() => { setEditingItemId(item.id); setItemNotesDraft(item.notes); }}
                          className="p-1 text-slate-600 hover:text-slate-300 hover:bg-[#1e2d4a] rounded transition-colors"
                          title="Add note"
                        >
                          <Edit2 size={10} />
                        </button>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                          title="Remove from section"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add record button */}
          {canEdit && (
            <button
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-[#1e2d4a] hover:border-[#f97316]/40 hover:bg-[#f97316]/5 rounded-lg text-xs text-slate-600 hover:text-[#f97316] transition-colors group"
            >
              <Plus size={13} className="group-hover:text-[#f97316]" />
              Add existing records
            </button>
          )}
        </div>
      )}

      {showPicker && (
        <OAndMSourcePicker
          section={section}
          projectId={projectId}
          existingSourceIds={existingSourceIds}
          onAdd={handlePickerAdd}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

export default function OAndMSectionEditor({
  sections, items, manualId, projectId, canEdit,
  onAddSection, onUpdateSection, onRemoveSection, onReorderSections,
  onAddItem, onUpdateItem, onRemoveItem, onReorderItems,
  currentUserName,
}: Props) {
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  const handleAddSection = () => {
    const t = newSectionTitle.trim();
    if (!t) return;
    onAddSection({
      id: genId(),
      manual_id: manualId,
      project_id: projectId,
      title: t,
      description: '',
      sort_order: sortedSections.length,
    });
    setNewSectionTitle('');
    setAddingSection(false);
  };

  const moveSection = (index: number, dir: 'up' | 'down') => {
    const next = [...sortedSections];
    const swapIdx = dir === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    onReorderSections(next.map((s, i) => ({ ...s, sort_order: i })));
  };

  if (sortedSections.length === 0 && !addingSection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center mb-4">
          <FileText size={20} className="text-slate-600" />
        </div>
        <p className="text-sm font-semibold text-slate-400 mb-1">No sections yet</p>
        <p className="text-xs text-slate-600 max-w-xs mb-5 leading-relaxed">
          Add sections to organise your O&M evidence — for example "Testing & Commissioning" or "Warranties".
        </p>
        {canEdit && (
          <button
            onClick={() => setAddingSection(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white text-sm font-semibold rounded-lg hover:bg-orange-400 transition-colors"
          >
            <Plus size={14} /> Add First Section
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedSections.map((section, index) => (
        <SectionRow
          key={section.id}
          section={section}
          items={items.filter(i => i.section_id === section.id)}
          index={index}
          total={sortedSections.length}
          canEdit={canEdit}
          onUpdate={onUpdateSection}
          onRemove={onRemoveSection}
          onMoveUp={() => moveSection(index, 'up')}
          onMoveDown={() => moveSection(index, 'down')}
          onAddItem={onAddItem}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          onReorderItems={onReorderItems}
          projectId={projectId}
          currentUserName={currentUserName}
        />
      ))}

      {/* Add section */}
      {canEdit && (
        addingSection ? (
          <div className="flex items-center gap-2 p-3 bg-[#0d1628] border border-[#1e2d4a] rounded-xl">
            <input
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') { setAddingSection(false); setNewSectionTitle(''); } }}
              placeholder="Section title (e.g. Testing & Commissioning)…"
              autoFocus
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
            />
            <button onClick={handleAddSection} disabled={!newSectionTitle.trim()} className="p-1.5 bg-[#f97316] disabled:opacity-40 text-white rounded transition-colors hover:bg-orange-400">
              <Check size={13} />
            </button>
            <button onClick={() => { setAddingSection(false); setNewSectionTitle(''); }} className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingSection(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[#1e2d4a] hover:border-[#f97316]/40 hover:bg-[#f97316]/5 rounded-xl text-sm text-slate-600 hover:text-[#f97316] transition-colors group"
          >
            <Plus size={14} className="group-hover:text-[#f97316]" /> Add Section
          </button>
        )
      )}
    </div>
  );
}
