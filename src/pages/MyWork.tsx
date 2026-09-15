import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Calendar, CheckCircle, Circle, Trash2, Pencil,
  ChevronDown, ChevronUp, AlertTriangle, Clock, X, Download,
  RotateCcw, RefreshCw, Undo2, MessageSquare, Check,
} from 'lucide-react';
import { useAppStore } from '../lib/StoreContext';
import type { DBMyWorkItem, DBMyWorkNote } from '../lib/store';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';

type Urgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type Status = 'ACTIVE' | 'COMPLETED';
type ViewFilter = 'ACTIVE' | 'TODAY' | 'THIS_WEEK' | 'OVERDUE' | 'NO_DUE_DATE' | 'COMPLETED';
type SortKey = 'smart' | 'due_date' | 'urgency' | 'created_at';

const URGENCY_ORDER: Record<Urgency, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const URGENCY_STYLES: Record<Urgency, string> = {
  URGENT: 'text-red-400',
  HIGH: 'text-orange-400',
  NORMAL: 'text-sky-400',
  LOW: 'text-slate-500',
};
const URGENCY_BADGE: Record<Urgency, string> = {
  URGENT: 'bg-red-900/40 text-red-300 border-red-700/50',
  HIGH: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  NORMAL: 'bg-sky-900/40 text-sky-300 border-sky-700/50',
  LOW: 'bg-slate-700/40 text-slate-400 border-slate-600/50',
};

function isOverdue(item: DBMyWorkItem): boolean {
  if (item.status === 'COMPLETED' || !item.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(item.due_date) < today;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
}

function isThisWeek(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d >= today && d <= end;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateShort(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dMid = new Date(dateStr);
  dMid.setHours(0, 0, 0, 0);
  if (dMid.getTime() === today.getTime()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dMid.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─── Quick Add / Edit modal ──────────────────────────────────────────────────────

interface ItemFormData {
  title: string;
  description: string;
  notes: string;
  project_id: string;
  urgency: Urgency;
  due_date: string;
}

interface ItemModalProps {
  initial: ItemFormData;
  mode: 'create' | 'edit';
  projects: { id: string; name: string }[];
  onSave: (data: ItemFormData) => void;
  onClose: () => void;
}

function ItemModal({ initial, mode, projects, onSave, onClose }: ItemModalProps) {
  const [form, setForm] = useState<ItemFormData>(initial);
  const inputCls = 'mt-1.5 w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
          <h2 className="text-base font-bold text-white">{mode === 'create' ? 'Add Item' : 'Edit Item'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (form.title.trim()) onSave(form); }} className="p-5 space-y-3">
          <div>
            <label className={labelCls}>Title *</label>
            <input autoFocus required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="What needs doing?" />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Brief explanation (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Project</label>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className={inputCls}>
                <option value="">— General —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Urgency</label>
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value as Urgency }))} className={inputCls}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} rows={3} placeholder="Personal running notes (optional)" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#1e2d4a] rounded-lg text-sm font-semibold text-slate-400 hover:bg-[#1e2d4a] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">{mode === 'create' ? 'Add' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Notes section inside expanded detail ──────────────────────────────────────

function fmtNoteTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

function NotesSection({ itemId, orgId, userId }: { itemId: string; orgId: string; userId: string }) {
  const store = useAppStore();
  const notes = useMemo(
    () => store.myWorkNotes.filter(n => n.my_work_item_id === itemId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [store.myWorkNotes, itemId],
  );
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    const note: DBMyWorkNote = {
      id: crypto.randomUUID(),
      org_id: orgId,
      user_id: userId,
      my_work_item_id: itemId,
      note_text: text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await store.addMyWorkNote(note);
    setDraft('');
  }, [draft, orgId, userId, itemId, store]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const note = notes.find(n => n.id === editingId);
    if (!note) return;
    await store.updateMyWorkNote({ ...note, note_text: editText.trim() });
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, notes, store]);

  const handleDelete = useCallback(async (id: string) => {
    await store.removeMyWorkNote(id);
    setConfirmDeleteId(null);
  }, [store]);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={11} className="text-slate-600" />
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Notes / Updates</span>
      </div>

      {notes.length === 0 && !editingId && (
        <p className="text-[11px] text-slate-700 mb-2">No notes yet.</p>
      )}

      <div className="space-y-2 mb-3">
        {notes.map(note => (
          <div key={note.id} className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2">
            {editingId === note.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={2}
                  autoFocus
                  className="w-full bg-[#111827] border border-[#2a3a5a] rounded-md px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-[#f97316] resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-[#f97316] rounded-md hover:bg-orange-600 transition-colors">
                    <Check size={9} /> Save
                  </button>
                  <button onClick={() => { setEditingId(null); setEditText(''); }} className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">{note.note_text}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-slate-600">{fmtNoteTimestamp(note.created_at)}</span>
                  {note.updated_at !== note.created_at && (
                    <span className="text-[9px] text-slate-700 italic">edited</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {confirmDeleteId === note.id ? (
                      <>
                        <button onClick={() => handleDelete(note.id)} className="text-[10px] font-semibold text-red-400 hover:text-red-300 px-1.5 py-0.5">Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(note.id); setEditText(note.note_text); }}
                          className="p-1 text-slate-600 hover:text-[#f97316] transition-colors"
                          title="Edit note"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(note.id)}
                          className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 size={10} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Quick add input */}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
          placeholder="+ Add a quick note…"
          className="flex-1 bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 transition-colors"
        />
        {draft.trim() && (
          <button onClick={handleAdd} className="px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors">
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inline expand row ───────────────────────────────────────────────────────────

function ItemDetail({ item, projectName, onEdit }: { item: DBMyWorkItem; projectName: string; onEdit: () => void }) {
  return (
    <div className="px-4 pb-3 pt-1 border-t border-[#1e2d4a]/50 space-y-2">
      {item.description && <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>}
      {item.notes && (
        <div>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Notes</span>
          <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{item.notes}</p>
        </div>
      )}
      <div className="flex items-center gap-4 text-[10px] text-slate-600">
        <span>Added: <span className="text-slate-500">{fmtDate(item.created_at)}</span></span>
        {item.completed_at && <span>Completed: <span className="text-slate-500">{fmtDate(item.completed_at)}</span></span>}
        <button onClick={onEdit} className="ml-auto flex items-center gap-1 text-slate-500 hover:text-[#f97316] transition-colors font-semibold">
          <Pencil size={11} /> Edit
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────────

export default function MyWork() {
  const store = useAppStore();
  const orgId = store.currentOrgId ?? '';
  const userId = store.currentUser?.id ?? '';
  const userName = store.currentUser?.name ?? 'User';

  const [view, setView] = useState<ViewFilter>('ACTIVE');
  const [filterProject, setFilterProject] = useState('All');
  const [filterUrgency, setFilterUrgency] = useState('All');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('smart');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<DBMyWorkItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadedNotesFor, setLoadedNotesFor] = useState<Set<string>>(new Set());
  const [quickAdd, setQuickAdd] = useState('');
  const [undoItem, setUndoItem] = useState<DBMyWorkItem | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Load on mount only — NOT part of global loadAllData
  useEffect(() => {
    if (orgId && userId) {
      store.reloadMyWork();
      store.loadAllMyWorkNoteCounts();
    }
  }, [orgId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleProjects = useMemo(() => {
    const projs = store.visibleProjectIds
      ? store.projects.filter(p => store.visibleProjectIds!.includes(p.id))
      : store.projects;
    return projs.map(p => ({ id: p.id, name: p.name }));
  }, [store.projects, store.visibleProjectIds]);

  const projectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    store.projects.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [store.projects]);

  // ─── Filtering ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = store.myWorkItems;

    // View filter
    switch (view) {
      case 'ACTIVE':
        items = items.filter(i => i.status === 'ACTIVE');
        break;
      case 'COMPLETED':
        items = items.filter(i => i.status === 'COMPLETED');
        break;
      case 'TODAY':
        items = items.filter(i => i.status === 'ACTIVE' && i.due_date && isToday(i.due_date));
        break;
      case 'THIS_WEEK':
        items = items.filter(i => i.status === 'ACTIVE' && i.due_date && isThisWeek(i.due_date));
        break;
      case 'OVERDUE':
        items = items.filter(i => isOverdue(i));
        break;
      case 'NO_DUE_DATE':
        items = items.filter(i => i.status === 'ACTIVE' && !i.due_date);
        break;
    }

    // Project filter
    if (filterProject !== 'All') {
      items = items.filter(i => (i.project_id ?? '') === filterProject);
    }

    // Urgency filter
    if (filterUrgency !== 'All') {
      items = items.filter(i => i.urgency === filterUrgency);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        (i.notes ?? '').toLowerCase().includes(q)
      );
    }

    // Sorting
    const sorted = [...items];
    switch (sortKey) {
      case 'smart':
        sorted.sort((a, b) => {
          const ao = isOverdue(a) ? 0 : 1;
          const bo = isOverdue(b) ? 0 : 1;
          if (ao !== bo) return ao - bo;
          const au = URGENCY_ORDER[a.urgency];
          const bu = URGENCY_ORDER[b.urgency];
          if (au !== bu) return au - bu;
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;
          return b.created_at.localeCompare(a.created_at);
        });
        break;
      case 'due_date':
        sorted.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
        break;
      case 'urgency':
        sorted.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
        break;
      case 'created_at':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
    }
    return sorted;
  }, [store.myWorkItems, view, filterProject, filterUrgency, search, sortKey]);

  // ─── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = store.myWorkItems.filter(i => i.status === 'ACTIVE');
    return {
      total: active.length,
      overdue: active.filter(i => isOverdue(i)).length,
      today: active.filter(i => i.due_date && isToday(i.due_date)).length,
      completed: store.myWorkItems.filter(i => i.status === 'COMPLETED').length,
    };
  }, [store.myWorkItems]);

  // ─── Actions ───────────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (data: ItemFormData) => {
    const item: DBMyWorkItem = {
      id: crypto.randomUUID(),
      org_id: orgId,
      user_id: userId,
      title: data.title.trim(),
      description: data.description.trim() || null,
      notes: data.notes.trim() || null,
      project_id: data.project_id || null,
      urgency: data.urgency,
      due_date: data.due_date || null,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    };
    await store.addMyWorkItem(item);
    setShowModal(false);
  }, [orgId, userId, store]);

  const handleEdit = useCallback(async (data: ItemFormData) => {
    if (!editItem) return;
    await store.updateMyWorkItem({
      ...editItem,
      title: data.title.trim(),
      description: data.description.trim() || null,
      notes: data.notes.trim() || null,
      project_id: data.project_id || null,
      urgency: data.urgency,
      due_date: data.due_date || null,
    });
    setEditItem(null);
    setShowModal(false);
  }, [editItem, store]);

  const handleToggleComplete = useCallback(async (item: DBMyWorkItem) => {
    if (item.status === 'ACTIVE') {
      await store.updateMyWorkItem({ ...item, status: 'COMPLETED', completed_at: new Date().toISOString() });
      setUndoItem(item);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoItem(null), 5000);
    } else {
      await store.updateMyWorkItem({ ...item, status: 'ACTIVE', completed_at: null });
    }
  }, [store]);

  const handleUndoComplete = useCallback(async () => {
    if (!undoItem) return;
    await store.updateMyWorkItem({ ...undoItem, status: 'ACTIVE', completed_at: null });
    setUndoItem(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, [undoItem, store]);

  const handleQuickAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickAdd.trim();
    if (!title) return;
    const item: DBMyWorkItem = {
      id: crypto.randomUUID(),
      org_id: orgId,
      user_id: userId,
      title,
      description: null,
      notes: null,
      project_id: null,
      urgency: 'NORMAL',
      due_date: null,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    };
    await store.addMyWorkItem(item);
    setQuickAdd('');
    quickAddRef.current?.focus();
  }, [quickAdd, orgId, userId, store]);

  const handleDelete = useCallback(async (id: string) => {
    await store.removeMyWorkItem(id);
    if (expandedId === id) setExpandedId(null);
  }, [store, expandedId]);

  const toggleExpand = useCallback((itemId: string) => {
    setExpandedId(prev => {
      if (prev === itemId) return null;
      if (!loadedNotesFor.has(itemId)) {
        store.loadMyWorkNotes(itemId);
        setLoadedNotesFor(prevSet => new Set(prevSet).add(itemId));
      }
      return itemId;
    });
  }, [loadedNotesFor, store]);

  // ─── PDF Export ────────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    const viewLabel = view === 'ACTIVE' ? 'Active Items'
      : view === 'TODAY' ? 'Due Today'
      : view === 'THIS_WEEK' ? 'Due This Week'
      : view === 'OVERDUE' ? 'Overdue Items'
      : view === 'NO_DUE_DATE' ? 'No Due Date'
      : view === 'COMPLETED' ? 'Completed / Archived'
      : 'All Items';

    const projectLabel = filterProject !== 'All' ? (projectNameById[filterProject] ?? filterProject) : 'All Projects';
    const urgencyLabel = filterUrgency !== 'All' ? filterUrgency : 'All Urgencies';

    const rows = filtered.map(item => {
      const proj = item.project_id ? (projectNameById[item.project_id] ?? 'Unknown') : 'General';
      const overdue = isOverdue(item) ? ' <span style="color:#dc2626;font-weight:700">OVERDUE</span>' : '';
      const due = item.due_date ? fmtDate(item.due_date) : '—';
      const completed = item.completed_at ? fmtDate(item.completed_at) : '';
      return `<tr>
        <td style="font-weight:600">${item.title}</td>
        <td>${proj}</td>
        <td style="text-align:center">${item.urgency}</td>
        <td style="text-align:center">${fmtDate(item.created_at)}</td>
        <td style="text-align:center">${due}${overdue}</td>
        <td style="text-align:center">${item.status}${completed ? '<br/><span style="color:#64748b;font-size:10px">' + completed + '</span>' : ''}</td>
        <td>${item.description ?? ''}</td>
      </tr>`;
    }).join('');

    const body = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f97316;padding-bottom:16px;margin-bottom:20px">
        <div>
          <div style="font-size:22px;font-weight:800;color:#0f172a">My Work List</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">${userName} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b">
          <div><strong>View:</strong> ${viewLabel}</div>
          <div><strong>Project:</strong> ${projectLabel}</div>
          <div><strong>Urgency:</strong> ${urgencyLabel}</div>
          <div><strong>Items:</strong> ${filtered.length}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1">
            <th style="text-align:left;padding:8px 6px;font-weight:700;color:#334155">Title</th>
            <th style="text-align:left;padding:8px 6px;font-weight:700;color:#334155">Project</th>
            <th style="text-align:center;padding:8px 6px;font-weight:700;color:#334155">Urgency</th>
            <th style="text-align:center;padding:8px 6px;font-weight:700;color:#334155">Added</th>
            <th style="text-align:center;padding:8px 6px;font-weight:700;color:#334155">Due Date</th>
            <th style="text-align:center;padding:8px 6px;font-weight:700;color:#334155">Status</th>
            <th style="text-align:left;padding:8px 6px;font-weight:700;color:#334155">Description</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">No items in this view</td></tr>'}
        </tbody>
      </table>
      <div style="margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px">
        VYSITE — Personal Work Organiser · Exported ${new Date().toLocaleString('en-GB')}
      </div>
    `;

    const styles = `
      table{width:100%;border-collapse:collapse}
      tr{border-bottom:1px solid #e2e8f0}
      td{padding:6px;vertical-align:top;color:#334155}
      th{font-size:10px;text-transform:uppercase}
    `;

    openPrintTab(buildPrintDocument('My Work List', styles, body));
  }, [filtered, view, filterProject, filterUrgency, projectNameById, userName]);

  // ─── Render ────────────────────────────────────────────────────────────────────
  const VIEW_TABS: { key: ViewFilter; label: string }[] = [
    { key: 'ACTIVE', label: 'Active' },
    { key: 'TODAY', label: 'Today' },
    { key: 'THIS_WEEK', label: 'This Week' },
    { key: 'OVERDUE', label: 'Overdue' },
    { key: 'NO_DUE_DATE', label: 'No Due Date' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const selectCls = 'bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 cursor-pointer';

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">My Work</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your personal task organiser</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleExportPDF} disabled={filtered.length === 0} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border border-[#1e2d4a] text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={14} /> Export PDF
          </button>
          <button onClick={() => { setEditItem(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#f97316] text-white hover:bg-orange-600 transition-colors">
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: stats.total, icon: Circle, color: 'text-sky-400', bg: 'bg-sky-900/30' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-900/30' },
          { label: 'Due Today', value: stats.today, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-900/30' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
        ].map(s => (
          <div key={s.label} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <s.icon size={15} className={s.color} />
            </div>
            <div>
              <div className={`text-lg font-bold leading-none ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-slate-600 mt-0.5 font-medium uppercase tracking-wide">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick add */}
      {view !== 'COMPLETED' && (
        <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Plus size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              ref={quickAddRef}
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              placeholder="Add an item…"
              className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 transition-colors"
            />
          </div>
        </form>
      )
      }

      {/* View tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {VIEW_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              view === tab.key
                ? 'bg-[#f97316] text-white'
                : 'bg-[#1a2236] border border-[#1e2d4a] text-slate-400 hover:text-slate-200 hover:bg-[#1e2d4a]'
            }`}
          >
            {tab.label}
            {tab.key === 'OVERDUE' && stats.overdue > 0 && <span className="ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">{stats.overdue}</span>}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, description, notes…"
            className="w-full bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 outline-none focus:border-slate-500 placeholder:text-slate-600"
          />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={selectCls}>
          <option value="All">All Projects</option>
          {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)} className={selectCls}>
          <option value="All">All Urgency</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className={selectCls}>
          <option value="smart">Smart Sort</option>
          <option value="due_date">Due Date</option>
          <option value="urgency">Urgency</option>
          <option value="created_at">Date Added</option>
        </select>
      </div>

      {/* List */}
      {store.myWorkStatus === 'loading' ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl px-4 py-3 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 bg-slate-700/60 rounded-full" />
                <div className="h-4 w-1/2 bg-slate-700/50 rounded" />
                <div className="ml-auto h-5 w-16 bg-slate-700/40 rounded-md" />
              </div>
              <div className="h-3 w-1/3 bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
      ) : store.myWorkStatus === 'error' ? (
        <div className="text-center py-14">
          <AlertTriangle size={28} className="mx-auto mb-3 text-red-500/60" />
          <p className="text-sm font-medium text-slate-400 mb-4">Could not load your work items.</p>
          <button onClick={() => store.reloadMyWork()} className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-300 hover:bg-[#1e2840] hover:text-white transition-colors">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 text-slate-600">
          <Circle size={28} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {store.myWorkItems.length === 0
              ? 'No items yet. Click "Add Item" to create your first task.'
              : 'No items match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(item => {
            const overdue = isOverdue(item);
            const proj = item.project_id ? (projectNameById[item.project_id] ?? 'Unknown') : null;
            const isExpanded = expandedId === item.id;
            const isCompleted = item.status === 'COMPLETED';

            return (
              <div
                key={item.id}
                className={`bg-[#1a2236] border rounded-xl overflow-hidden transition-colors ${
                  overdue ? 'border-red-800/50' : 'border-[#1e2d4a]'
                } ${isCompleted ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(item)}
                    className={`shrink-0 transition-colors ${isCompleted ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}
                    title={isCompleted ? 'Restore to active' : 'Mark complete'}
                  >
                    {isCompleted ? <CheckCircle size={18} /> : <Circle size={18} />}
                  </button>

                  {/* Title + meta — clickable to expand */}
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={`text-sm font-medium truncate ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {proj && <span className="text-[10px] text-slate-500 truncate">{proj}</span>}
                      {proj && item.due_date && <span className="text-slate-700">·</span>}
                      {item.due_date && (
                        <span className={`text-[10px] font-semibold flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                          <Calendar size={9} />
                          {overdue ? `OVERDUE · ${fmtDateShort(item.due_date)}` : fmtDateShort(item.due_date)}
                        </span>
                      )}
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${URGENCY_BADGE[item.urgency]}`}>
                        {item.urgency}
                      </span>
                      {(() => {
                        const noteCount = store.myWorkNoteCounts[item.id] ?? 0;
                        if (noteCount === 0) return null;
                        return (
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
                            <MessageSquare size={9} />
                            {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                          </span>
                        );
                      })()}
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditItem(item); setShowModal(true); }} className="p-1.5 rounded-lg text-slate-600 hover:text-[#f97316] hover:bg-[#0d1628] transition-colors" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-[#0d1628] transition-colors" title="Delete">
                      <Trash2 size={13} />
                    </button>
                    {isExpanded ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-[#1e2d4a]/50 space-y-2">
                    {item.description && <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>}
                    {item.notes && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Notes</span>
                        <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{item.notes}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-[10px] text-slate-600">
                      <span>Added: <span className="text-slate-500">{fmtDate(item.created_at)}</span></span>
                      {item.completed_at && <span>Completed: <span className="text-slate-500">{fmtDate(item.completed_at)}</span></span>}
                      <button onClick={() => { setEditItem(item); setShowModal(true); }} className="ml-auto flex items-center gap-1 text-slate-500 hover:text-[#f97316] transition-colors font-semibold">
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                    <NotesSection itemId={item.id} orgId={orgId} userId={userId} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed restore hint */}
      {view === 'COMPLETED' && filtered.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          Click the <CheckCircle size={11} className="inline" /> icon on any item to restore it to active.
        </p>
      )}

      {/* Undo toast */}
      {undoItem && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-2xl px-4 py-3">
          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          <span className="text-sm text-slate-300">Item completed</span>
          <button onClick={handleUndoComplete} className="flex items-center gap-1.5 text-sm font-semibold text-[#f97316] hover:text-orange-400 transition-colors">
            <Undo2 size={13} /> Undo
          </button>
          <button onClick={() => { setUndoItem(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }} className="p-1 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-[#0d1628] transition-colors">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ItemModal
          initial={editItem ? {
            title: editItem.title,
            description: editItem.description ?? '',
            notes: editItem.notes ?? '',
            project_id: editItem.project_id ?? '',
            urgency: editItem.urgency,
            due_date: editItem.due_date ?? '',
          } : { title: '', description: '', notes: '', project_id: '', urgency: 'NORMAL', due_date: '' }}
          mode={editItem ? 'edit' : 'create'}
          projects={visibleProjects}
          onSave={editItem ? handleEdit : handleCreate}
          onClose={() => { setShowModal(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}
