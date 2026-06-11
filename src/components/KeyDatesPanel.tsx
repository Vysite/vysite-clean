import { useState } from 'react';
import { Plus, Calendar, Printer, Pencil, Trash2, X } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import type { Project } from '../data/types';
import type { DBKeyDate } from '../lib/store';

export interface KeyDatesPanelProps {
  project: Project;
  keyDates: DBKeyDate[];
  currentUserName: string;
  onAdd: (d: DBKeyDate) => Promise<void>;
  onUpdate: (d: DBKeyDate) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function keyDateStatusCls(d: DBKeyDate): string {
  if (d.status === 'Closed') return 'bg-emerald-900/60 text-emerald-400';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = d.date ? new Date(d.date) : null;
  if (dt && dt < today) return 'bg-red-900/60 text-red-400';
  return 'bg-orange-900/60 text-orange-400';
}

function keyDateLabel(d: DBKeyDate): string {
  if (d.status === 'Closed') return 'Closed';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = d.date ? new Date(d.date) : null;
  if (dt && dt < today) return 'Overdue';
  return 'Open';
}

function daysRemaining(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = new Date(dateStr);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `${diff}d remaining`;
}

function exportKeyDatesPDF(project: Project, keyDates: DBKeyDate[]) {
  const today = new Date();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const rows = keyDates.map(d => {
    const isOverdue = d.status === 'Open' && d.date && new Date(d.date) < today;
    const cls = d.status === 'Closed' ? 'closed' : isOverdue ? 'overdue' : 'open';
    const label = d.status === 'Closed' ? 'Closed' : isOverdue ? 'Overdue' : 'Open';
    return `<tr>
      <td>${esc(d.title)}</td>
      <td>${fmtDate(d.date)}</td>
      <td>${esc(d.description || '—')}</td>
      <td>${esc(d.comments || '—')}</td>
      <td><span class="badge ${cls}">${esc(label)}</span></td>
      <td>${esc(d.created_by)}</td>
      <td>${fmtDate(d.created_date)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Key Dates — ${esc(project.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 18px; font-weight: 700; color: #f97316; }
    .header p { font-size: 11px; color: #555; margin-top: 2px; }
    .meta { font-size: 10px; color: #555; text-align: right; }
    h2 { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f97316; color: #fff; font-weight: 600; padding: 7px 8px; text-align: left; font-size: 10px; }
    td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-size: 10px; }
    tr:nth-child(even) td { background: #fafafa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 9px; font-weight: 700; }
    .open { background: #fff3e0; color: #e65100; }
    .closed { background: #e8f5e9; color: #1b5e20; }
    .overdue { background: #ffebee; color: #b71c1c; }
    .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #999; }
  </style></head><body>
  <div class="header">
    <div><h1>Key Dates</h1><p>${esc(project.name)}${project.client ? ' — ' + esc(project.client) : ''}</p></div>
    <div class="meta">Exported ${today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}<br/>${keyDates.length} date${keyDates.length !== 1 ? 's' : ''}</div>
  </div>
  <h2>Key Dates Register</h2>
  <table>
    <thead><tr><th>Title</th><th>Date</th><th>Description</th><th>Comments</th><th>Status</th><th>Created By</th><th>Created Date</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">No key dates recorded</td></tr>'}</tbody>
  </table>
  <div class="footer"><span>VYSITE | Construction Operating System</span><span>© VYSITE. All rights reserved.</span></div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

type KDForm = { title: string; date: string; description: string; comments: string; status: string };

export default function KeyDatesPanel({ project, keyDates, currentUserName, onAdd, onUpdate, onRemove }: KeyDatesPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DBKeyDate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBKeyDate | null>(null);
  const [form, setForm] = useState<KDForm>({ title: '', date: '', description: '', comments: '', status: 'Open' });

  function openCreate() {
    setForm({ title: '', date: '', description: '', comments: '', status: 'Open' });
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(d: DBKeyDate) {
    setForm({ title: d.title, date: d.date, description: d.description, comments: d.comments, status: d.status });
    setEditing(d);
    setShowModal(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    const now = new Date().toISOString().slice(0, 10);
    if (editing) {
      onUpdate({ ...editing, ...form });
    } else {
      onAdd({
        id: `kd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        project_id: project.id,
        project_name: project.name,
        ...form,
        created_by: currentUserName || 'Unknown',
        created_date: now,
      });
    }
    setShowModal(false);
  }

  const sorted = [...keyDates].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
          <h3 className="text-sm font-semibold text-white">
            Key Dates <span className="text-slate-600 font-normal ml-1">({keyDates.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            {keyDates.length > 0 && (
              <button
                onClick={() => exportKeyDatesPDF(project, sorted)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
              >
                <Printer size={12} />Export PDF
              </button>
            )}
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus size={13} />Add Key Date
            </button>
          </div>
        </div>

        {keyDates.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar size={32} className="text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No key dates added yet</p>
            <p className="text-xs text-slate-600 mt-1">Click "Add Key Date" to record an important date</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e2d4a]">
            {sorted.map(d => {
              const statusCls = keyDateStatusCls(d);
              const label = keyDateLabel(d);
              const remaining = d.status === 'Open' ? daysRemaining(d.date) : '';
              return (
                <div key={d.id} className="p-4 hover:bg-[#0d1628]/50 transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-slate-200">{d.title}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{label}</span>
                        {remaining && <span className="text-[10px] text-slate-500">{remaining}</span>}
                      </div>
                      <p className="text-xs text-orange-400 font-medium mb-1">
                        {d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                      </p>
                      {d.description && <p className="text-xs text-slate-400 mb-0.5">{d.description}</p>}
                      {d.comments && <p className="text-xs text-slate-500 italic">{d.comments}</p>}
                      <p className="text-[11px] text-slate-600 mt-1">
                        Added by {d.created_by} · {d.created_date ? new Date(d.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.status === 'Open' && (
                        <button
                          onClick={() => onUpdate({ ...d, status: 'Closed' })}
                          className="px-2 py-1 text-[10px] font-semibold text-emerald-400 bg-emerald-900/30 hover:bg-emerald-900/60 rounded transition-colors"
                          title="Close"
                        >Close</button>
                      )}
                      {d.status === 'Closed' && (
                        <button
                          onClick={() => onUpdate({ ...d, status: 'Open' })}
                          className="px-2 py-1 text-[10px] font-semibold text-orange-400 bg-orange-900/30 hover:bg-orange-900/60 rounded transition-colors"
                          title="Reopen"
                        >Reopen</button>
                      )}
                      <button
                        onClick={() => openEdit(d)}
                        className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1e2d4a] rounded transition-colors"
                        title="Edit"
                      ><Pencil size={13} /></button>
                      <button
                        onClick={() => setDeleteTarget(d)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        title="Delete"
                      ><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
              <h3 className="text-sm font-bold text-white">{editing ? 'Edit Key Date' : 'Add Key Date'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Title <span className="text-red-400">*</span></label>
                <input
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316]"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Practical Completion"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316]"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] resize-none"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description..."
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Comments</label>
                <textarea
                  rows={2}
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316] resize-none"
                  value={form.comments}
                  onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                  placeholder="Any additional comments..."
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select
                  className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f97316]"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option>Open</option>
                  <option>Closed</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[#1e2d4a]">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim()}
                className="px-4 py-2 bg-[#f97316] hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >{editing ? 'Save Changes' : 'Add Key Date'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete Key Date"
          message={`Delete "${deleteTarget.title}"? This cannot be undone.`}
          onConfirm={() => { onRemove(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
