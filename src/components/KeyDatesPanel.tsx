import { useState } from 'react';
import { Plus, Calendar, Pencil, Trash2, X, ChevronDown, ChevronUp, FileText, Layers } from 'lucide-react';
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
  collapsible?: boolean;
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

// ─── VYSITE PDF helpers ────────────────────────────────────────────────────────

const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: #1e293b; background: white; font-size: 11px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { max-width: 880px; margin: 0 auto; padding: 36px 40px; }
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #f97316; margin-bottom: 20px; }
  .doc-logo { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: 0.05em; }
  .doc-type-label { font-size: 10px; color: #64748b; margin-top: 4px; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 18px; font-weight: 900; color: #111; margin-bottom: 4px; line-height: 1.25; }
  .doc-dateline { font-size: 11px; color: #64748b; }
  .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
  .meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .meta-value { font-size: 11px; font-weight: 600; color: #0f172a; }
  .section-heading { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 12px; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f97316; color: #fff; font-weight: 700; padding: 8px 10px; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-size: 10px; }
  tr:nth-child(even) td { background: #fafafa; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 9999px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge-open    { background: #fff3e0; color: #c2410c; }
  .badge-closed  { background: #dcfce7; color: #15803d; }
  .badge-overdue { background: #fee2e2; color: #b91c1c; }
  .kd-card { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 18px; overflow: hidden; page-break-inside: avoid; }
  .kd-card-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .kd-card-title { font-size: 13px; font-weight: 800; color: #0f172a; }
  .kd-card-body { padding: 12px 14px; }
  .data-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
  .data-cell { background: white; padding: 8px 10px; }
  .data-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 2px; }
  .data-value { font-size: 10.5px; font-weight: 600; color: #0f172a; }
  .text-field { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; margin-bottom: 8px; }
  .text-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
  .text-value { font-size: 10.5px; color: #334155; line-height: 1.6; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
  @media print { body { padding: 0; } .page { padding: 20px 24px; } }
`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(s: string): string {
  return s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

function openPDF(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function docHeader(project: Project, subtitle: string, exportedDate: string, count: number): string {
  return `
  <div class="doc-header">
    <div>
      <div class="doc-logo">VYSITE</div>
      <div class="doc-type-label">Construction Operating System</div>
    </div>
    <div class="doc-header-right">
      <div class="doc-title">${esc(subtitle)}</div>
      <div class="doc-dateline">${esc(project.name)}${project.client ? ' &mdash; ' + esc(project.client) : ''}</div>
      <div class="doc-dateline" style="margin-top:2px">Exported ${exportedDate} &bull; ${count} date${count !== 1 ? 's' : ''}</div>
    </div>
  </div>`;
}

function projectMetaBlock(project: Project): string {
  const fmt = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  return `
  <div class="meta-block">
    <div class="meta-grid">
      <div><div class="meta-label">Project</div><div class="meta-value">${esc(project.name)}</div></div>
      <div><div class="meta-label">Client</div><div class="meta-value">${esc(project.client || '—')}</div></div>
      <div><div class="meta-label">Location</div><div class="meta-value">${esc(project.location || '—')}</div></div>
      <div><div class="meta-label">Project Manager</div><div class="meta-value">${esc(project.projectManager || '—')}</div></div>
      <div><div class="meta-label">Start Date</div><div class="meta-value">${fmt(project.startDate)}</div></div>
      <div><div class="meta-label">Completion Date</div><div class="meta-value">${fmt(project.completionDate)}</div></div>
    </div>
  </div>`;
}

function exportKeyDatesListPDF(project: Project, keyDates: DBKeyDate[]) {
  const today = new Date();
  const exportedDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

  const rows = keyDates.map(d => {
    const isOverdue = d.status === 'Open' && d.date && new Date(d.date) < todayMidnight;
    const label = d.status === 'Closed' ? 'Closed' : isOverdue ? 'Overdue' : 'Open';
    const badgeCls = d.status === 'Closed' ? 'badge-closed' : isOverdue ? 'badge-overdue' : 'badge-open';
    const dr = d.status === 'Open' && d.date ? (() => {
      const diff = Math.round((new Date(d.date).getTime() - todayMidnight.getTime()) / 86400000);
      if (diff === 0) return 'Today';
      if (diff < 0) return `${Math.abs(diff)}d overdue`;
      return `${diff}d remaining`;
    })() : '—';
    return `<tr>
      <td>${fmtDate(d.date)}</td>
      <td><strong>${esc(d.title)}</strong>${d.description ? '<br/><span style="color:#64748b;font-size:9.5px">' + esc(d.description) + '</span>' : ''}</td>
      <td><span class="badge ${badgeCls}">${esc(label)}</span></td>
      <td>${esc(dr)}</td>
      <td>${esc(d.created_by)}</td>
      <td>${fmtDate(d.created_date)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Key Dates List — ${esc(project.name)}</title>
  <style>${PDF_CSS}</style></head>
  <body><div class="page">
    ${docHeader(project, 'Key Dates List', exportedDate, keyDates.length)}
    ${projectMetaBlock(project)}
    <div class="section-heading">Key Dates Register</div>
    <table>
      <thead><tr><th style="width:110px">Date</th><th>Title / Description</th><th style="width:80px">Status</th><th style="width:100px">Days Remaining</th><th style="width:110px">Created By</th><th style="width:110px">Created Date</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">No key dates recorded</td></tr>'}</tbody>
    </table>
    <div class="footer"><span>VYSITE &bull; Construction Operating System</span><span>&copy; VYSITE. All rights reserved. Confidential.</span></div>
  </div></body></html>`;

  openPDF(html);
}

function exportKeyDatesFullPDF(project: Project, keyDates: DBKeyDate[]) {
  const today = new Date();
  const exportedDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

  const cards = keyDates.map(d => {
    const isOverdue = d.status === 'Open' && d.date && new Date(d.date) < todayMidnight;
    const label = d.status === 'Closed' ? 'Closed' : isOverdue ? 'Overdue' : 'Open';
    const badgeCls = d.status === 'Closed' ? 'badge-closed' : isOverdue ? 'badge-overdue' : 'badge-open';
    const dr = d.status === 'Open' && d.date ? (() => {
      const diff = Math.round((new Date(d.date).getTime() - todayMidnight.getTime()) / 86400000);
      if (diff === 0) return 'Today';
      if (diff < 0) return `${Math.abs(diff)}d overdue`;
      return `${diff}d remaining`;
    })() : '—';
    return `
    <div class="kd-card">
      <div class="kd-card-header">
        <span class="kd-card-title">${esc(d.title)}</span>
        <span class="badge ${badgeCls}">${esc(label)}</span>
      </div>
      <div class="kd-card-body">
        <div class="data-grid">
          <div class="data-cell"><div class="data-label">Due Date</div><div class="data-value">${fmtDate(d.date)}</div></div>
          <div class="data-cell"><div class="data-label">Days Remaining</div><div class="data-value">${esc(dr)}</div></div>
          <div class="data-cell"><div class="data-label">Status</div><div class="data-value">${esc(label)}</div></div>
          <div class="data-cell"><div class="data-label">Created By</div><div class="data-value">${esc(d.created_by)}</div></div>
          <div class="data-cell"><div class="data-label">Created Date</div><div class="data-value">${fmtDate(d.created_date)}</div></div>
          <div class="data-cell"><div class="data-label">Project</div><div class="data-value">${esc(d.project_name || project.name)}</div></div>
        </div>
        ${d.description ? `<div class="text-field"><div class="text-label">Description</div><div class="text-value">${esc(d.description)}</div></div>` : ''}
        ${d.comments ? `<div class="text-field"><div class="text-label">Notes</div><div class="text-value">${esc(d.comments)}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Key Dates Full Export — ${esc(project.name)}</title>
  <style>${PDF_CSS}</style></head>
  <body><div class="page">
    ${docHeader(project, 'Key Dates Full Export', exportedDate, keyDates.length)}
    ${projectMetaBlock(project)}
    <div class="section-heading">Key Dates Detail</div>
    ${cards || '<p style="text-align:center;color:#94a3b8;padding:24px">No key dates recorded</p>'}
    <div class="footer"><span>VYSITE &bull; Construction Operating System</span><span>&copy; VYSITE. All rights reserved. Confidential.</span></div>
  </div></body></html>`;

  openPDF(html);
}

type KDForm = { title: string; date: string; description: string; comments: string; status: string };

export default function KeyDatesPanel({ project, keyDates, currentUserName, onAdd, onUpdate, onRemove, collapsible = false }: KeyDatesPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DBKeyDate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBKeyDate | null>(null);
  const [form, setForm] = useState<KDForm>({ title: '', date: '', description: '', comments: '', status: 'Open' });
  const [expanded, setExpanded] = useState(false);

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

  // For collapsible mode: find next upcoming open date
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextOpen = sorted.find(d => d.status === 'Open' && d.date && new Date(d.date) >= today)
    ?? sorted.find(d => d.status === 'Open')
    ?? null;

  if (collapsible && !expanded) {
    return (
      <div className="space-y-4">
        <div className="bg-[#1a2236] rounded-xl border-2 border-[#f97316]">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Calendar size={15} className="text-[#f97316] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Key Dates</p>
                {nextOpen ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-200 truncate">{nextOpen.title}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${keyDateStatusCls(nextOpen)}`}>{keyDateLabel(nextOpen)}</span>
                    {nextOpen.date && <span className="text-[10px] text-slate-500 shrink-0">{daysRemaining(nextOpen.date)}</span>}
                    {nextOpen.date && (
                      <span className="text-xs text-orange-400 font-medium shrink-0">
                        {new Date(nextOpen.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{keyDates.length === 0 ? 'No key dates added' : 'All dates closed'}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-xs text-slate-500">{keyDates.length} date{keyDates.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0d1628] border border-[#1e2d4a] text-slate-300 hover:text-[#f97316] hover:border-[#f97316] rounded-lg text-xs font-semibold transition-colors"
              >
                View All <ChevronDown size={12} />
              </button>
            </div>
          </div>
        </div>

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

  return (
    <div className="space-y-4">
      <div className={`bg-[#1a2236] rounded-xl ${collapsible ? 'border-2 border-[#f97316]' : 'border border-[#1e2d4a]'}`}>
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
          <h3 className="text-sm font-semibold text-white">
            Key Dates <span className="text-slate-600 font-normal ml-1">({keyDates.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            {keyDates.length > 0 && (
              <>
                <button
                  onClick={() => exportKeyDatesListPDF(project, sorted)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                >
                  <FileText size={12} />Export List
                </button>
                <button
                  onClick={() => exportKeyDatesFullPDF(project, sorted)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] text-slate-300 rounded-lg text-xs font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                >
                  <Layers size={12} />Export Full
                </button>
              </>
            )}
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus size={13} />Add Key Date
            </button>
            {collapsible && (
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0d1628] border border-[#1e2d4a] text-slate-300 hover:text-[#f97316] hover:border-[#f97316] rounded-lg text-xs font-semibold transition-colors"
              >
                Collapse <ChevronUp size={12} />
              </button>
            )}
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
