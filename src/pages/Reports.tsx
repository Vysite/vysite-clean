import { useState, useMemo } from 'react';
import { FileText, Download, BarChart3, TrendingUp, Calendar, X, Printer, ChevronDown } from 'lucide-react';
import { openPrintTab, buildPrintDocument } from '../lib/printTab';
import type { Action, Snag, Tender, Project } from '../data/types';
import { useAppStore } from '../lib/StoreContext';
import type { DBSiteForm, DBTCRecord } from '../lib/store';


// ─── Report type cards ────────────────────────────────────────────────────────

const REPORT_TYPE_CARDS = [
  { id: 'project-status', name: 'Project Status Report', description: 'Full status overview across all active projects', icon: BarChart3, color: 'bg-orange-900/60 text-orange-400' },
  { id: 'snag-summary', name: 'Snag Summary', description: 'Open, in-progress and closed snags by project', icon: FileText, color: 'bg-red-900/60 text-red-400' },
  { id: 'actions-report', name: 'Actions Report', description: 'All open and overdue actions with owners', icon: TrendingUp, color: 'bg-blue-900/60 text-blue-400' },
  { id: 'forms-log', name: 'Site Forms Log', description: 'Daily reports and QA inspections submitted', icon: Calendar, color: 'bg-emerald-900/60 text-emerald-400' },
] as const;


// ─── Print content builders ───────────────────────────────────────────────────

function PrintHeader({ title, subtitle, today }: { title: string; subtitle?: string; today: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '3px solid #f97316' }}>
        <img src="/VYSITE_Logo_Long.png" alt="VYSITE" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
          <div>{today}</div>
          <div style={{ marginTop: '2px' }}>VY Construction Ltd · Confidential</div>
        </div>
      </div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#111', marginBottom: '4px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11px', color: '#64748b' }}>{subtitle}</div>}
      </div>
    </>
  );
}

// Single action row PDF
function SingleActionPrint({ action, today }: { action: Action; today: string }) {
  return (
    <>
      <PrintHeader title="Action Record" subtitle={`Project: ${action.projectName} · Generated: ${today} · VY Construction Ltd`} today={today} />
      <table>
        <thead>
          <tr><th>Field</th><th>Detail</th></tr>
        </thead>
        <tbody>
          <tr><td style={{ fontWeight: 600, width: '30%' }}>Reference</td><td style={{ fontFamily: 'monospace' }}>#{action.id.toUpperCase()}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Title</td><td>{action.title}{action.overdue && action.status !== 'Complete' && <span className="rpt-overdue">OVERDUE</span>}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Project</td><td>{action.projectName}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Description</td><td>{action.description}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Owner</td><td>{action.owner}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Status</td><td className={action.status === 'Complete' ? 'rpt-complete' : action.status === 'In Progress' ? 'rpt-inprogress' : ''}>{action.status}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Priority</td><td className={`rpt-${action.priority.toLowerCase()}`}>{action.priority}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Due Date</td><td style={{ color: action.overdue && action.status !== 'Complete' ? '#dc2626' : undefined }}>{action.dueDate ? new Date(action.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Created By</td><td>{action.createdBy}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Created Date</td><td>{action.createdDate ? new Date(action.createdDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
        </tbody>
      </table>
    </>
  );
}

// Single snag row PDF
function SingleSnagPrint({ snag, today }: { snag: Snag; today: string }) {
  return (
    <>
      <PrintHeader title="Snag Record" subtitle={`Project: ${snag.projectName} · Generated: ${today} · VY Construction Ltd`} today={today} />
      <table>
        <thead>
          <tr><th>Field</th><th>Detail</th></tr>
        </thead>
        <tbody>
          <tr><td style={{ fontWeight: 600, width: '30%' }}>Reference</td><td style={{ fontFamily: 'monospace' }}>#{snag.id.toUpperCase()}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Title</td><td>{snag.title}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Project</td><td>{snag.projectName}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Description</td><td>{snag.description}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Location</td><td>{snag.location}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Assigned To</td><td>{snag.assignedTo}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Raised By</td><td>{snag.raisedBy}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Status</td><td className={snag.status === 'Closed' ? 'rpt-closed' : snag.status === 'In Progress' ? 'rpt-inprogress' : 'rpt-open'}>{snag.status}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Priority</td><td className={`rpt-${snag.priority.toLowerCase()}`}>{snag.priority}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Raised Date</td><td>{snag.raisedDate ? new Date(snag.raisedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Due Date</td><td>{snag.dueDate ? new Date(snag.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
          {snag.comments.length > 0 && <tr><td style={{ fontWeight: 600 }}>Comments</td><td>{snag.comments.join(' | ')}</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// Single form row PDF
function SingleFormPrint({ form, today }: { form: DBSiteForm; today: string }) {
  return (
    <>
      <PrintHeader title={form.type} subtitle={`Project: ${form.project_name} · Generated: ${today} · VY Construction Ltd`} today={today} />
      <table>
        <thead>
          <tr><th>Field</th><th>Detail</th></tr>
        </thead>
        <tbody>
          <tr><td style={{ fontWeight: 600, width: '30%' }}>Reference</td><td style={{ fontFamily: 'monospace' }}>{form.id.toUpperCase()}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Form Type</td><td>{form.type}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Project</td><td>{form.project_name}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Date</td><td>{form.date ? new Date(form.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Completed By</td><td>{form.completed_by}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Status</td><td className={form.status === 'Approved' ? 'rpt-complete' : form.status === 'Submitted' ? 'rpt-inprogress' : ''}>{form.status}</td></tr>
          {form.description && <tr><td style={{ fontWeight: 600 }}>Description</td><td>{form.description}</td></tr>}
          {form.comments && <tr><td style={{ fontWeight: 600 }}>Comments</td><td>{form.comments}</td></tr>}
          {form.notes && <tr><td style={{ fontWeight: 600 }}>Notes</td><td>{form.notes}</td></tr>}
          {form.submitted_date && <tr><td style={{ fontWeight: 600 }}>Submitted</td><td>{new Date(form.submitted_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// Single TC record row PDF
function SingleTCPrint({ record, today }: { record: DBTCRecord; today: string }) {
  return (
    <>
      <PrintHeader title="Testing & Commissioning Record" subtitle={`Project: ${record.project_name} · Generated: ${today} · VY Construction Ltd`} today={today} />
      <table>
        <thead>
          <tr><th>Field</th><th>Detail</th></tr>
        </thead>
        <tbody>
          <tr><td style={{ fontWeight: 600, width: '30%' }}>Reference</td><td style={{ fontFamily: 'monospace' }}>{record.ref}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Title</td><td>{record.title}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Project</td><td>{record.project_name}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Category</td><td>{record.category}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Area</td><td>{record.area}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Engineer</td><td>{record.engineer}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Date</td><td>{record.date ? new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Status</td><td className={record.status === 'Passed' ? 'rpt-complete' : record.status === 'Failed' ? 'rpt-open' : 'rpt-inprogress'}>{record.status}</td></tr>
          {record.result && <tr><td style={{ fontWeight: 600 }}>Result</td><td>{record.result}</td></tr>}
          {record.notes && <tr><td style={{ fontWeight: 600 }}>Notes</td><td>{record.notes}</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// Bulk: Project Status
function BulkProjectStatus({ filterProject, today, projects }: { filterProject: string; today: string; projects: import('../data/types').Project[] }) {
  const filtered = filterProject === 'All' ? projects : projects.filter(p => p.name === filterProject);
  return (
    <>
      <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.6' }}>
        Project status overview — {filtered.length} project{filtered.length !== 1 ? 's' : ''} as at {today}.
      </p>
      <table>
        <thead>
          <tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Contract Value</th><th>PM</th></tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>{p.name}</td>
              <td>{p.client}</td>
              <td>{p.status}</td>
              <td>{p.progress}%</td>
              <td>{p.value}</td>
              <td>{p.projectManager}</td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>No projects found</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// Bulk: Snag Summary
function BulkSnagSummary({ snags, filterProject, today, projects }: { snags: Snag[]; filterProject: string; today: string; projects: Project[] }) {
  const filtered = filterProject === 'All' ? snags : snags.filter(s => s.projectName === filterProject);
  const priorities = ['Critical', 'High', 'Medium', 'Low'] as const;
  return (
    <>
      <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.6' }}>
        Snag summary as at {today}. Total: {filtered.length} | Open: {filtered.filter(s => s.status === 'Open').length} | In Progress: {filtered.filter(s => s.status === 'In Progress').length} | Closed: {filtered.filter(s => s.status === 'Closed').length}
      </p>
      <table>
        <thead>
          <tr><th>Ref</th><th>Title</th><th>Project</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Due Date</th></tr>
        </thead>
        <tbody>
          {filtered.map(s => (
            <tr key={s.id}>
              <td style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>#{s.id.toUpperCase()}</td>
              <td style={{ fontWeight: 600 }}>{s.title}</td>
              <td>{s.projectName}</td>
              <td className={`rpt-${s.priority.toLowerCase()}`}>{s.priority}</td>
              <td className={s.status === 'Closed' ? 'rpt-closed' : s.status === 'In Progress' ? 'rpt-inprogress' : 'rpt-open'}>{s.status}</td>
              <td>{s.assignedTo}</td>
              <td>{s.dueDate ? new Date(s.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>No snags recorded</td></tr>}
        </tbody>
      </table>
      {filterProject === 'All' && (
        <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                {priorities.map(p => <th key={p} style={{ textAlign: 'right' }}>{p}</th>)}
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(proj => {
                const ps = filtered.filter(s => s.projectName === proj.name);
                return (
                  <tr key={proj.id}>
                    <td>{proj.name}</td>
                    {priorities.map(p => <td key={p} style={{ textAlign: 'right' }}>{ps.filter(s => s.priority === p).length || '—'}</td>)}
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{ps.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// Bulk: Actions Report
function BulkActionsReport({ actions, filterProject, today }: { actions: Action[]; filterProject: string; today: string }) {
  const filtered = filterProject === 'All' ? actions : actions.filter(a => a.projectName === filterProject);
  const open = filtered.filter(a => a.status !== 'Complete');
  const overdue = filtered.filter(a => a.overdue && a.status !== 'Complete');
  return (
    <>
      <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.6' }}>
        Actions report as at {today}. {open.length} open action{open.length !== 1 ? 's' : ''}, of which {overdue.length} {overdue.length === 1 ? 'is' : 'are'} overdue.
      </p>
      <table>
        <thead>
          <tr><th>Ref</th><th>Title</th><th>Project</th><th>Owner</th><th>Status</th><th>Priority</th><th>Due Date</th></tr>
        </thead>
        <tbody>
          {filtered.map(a => (
            <tr key={a.id}>
              <td style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>#{a.id.toUpperCase()}</td>
              <td>{a.title}{a.overdue && a.status !== 'Complete' && <span className="rpt-overdue">OVERDUE</span>}</td>
              <td>{a.projectName}</td>
              <td>{a.owner}</td>
              <td className={a.status === 'Complete' ? 'rpt-complete' : a.status === 'In Progress' ? 'rpt-inprogress' : ''}>{a.status}</td>
              <td className={`rpt-${a.priority.toLowerCase()}`}>{a.priority}</td>
              <td style={{ color: a.overdue && a.status !== 'Complete' ? '#dc2626' : undefined }}>
                {a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>No actions recorded</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// Bulk: Forms Log
function BulkFormsLog({ forms, filterProject, today }: { forms: DBSiteForm[]; filterProject: string; today: string }) {
  const filtered = filterProject === 'All' ? forms : forms.filter(f => f.project_name === filterProject);
  return (
    <>
      <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.6' }}>
        Site forms log as at {today}. {filtered.length} form{filtered.length !== 1 ? 's' : ''} recorded.
        Submitted: {filtered.filter(f => f.status === 'Submitted').length} | Approved: {filtered.filter(f => f.status === 'Approved').length} | Draft: {filtered.filter(f => f.status === 'Draft').length}
      </p>
      <table>
        <thead>
          <tr><th>Ref</th><th>Type</th><th>Project</th><th>Completed By</th><th>Date</th><th>Status</th><th>Description</th></tr>
        </thead>
        <tbody>
          {filtered.map(f => (
            <tr key={f.id}>
              <td style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>{f.id.toUpperCase()}</td>
              <td>{f.type}</td>
              <td>{f.project_name}</td>
              <td>{f.completed_by}</td>
              <td>{f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
              <td className={f.status === 'Approved' ? 'rpt-complete' : f.status === 'Submitted' ? 'rpt-inprogress' : ''}>{f.status}</td>
              <td>{f.description || '—'}</td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>No forms recorded</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function BulkTenderPipeline({ tenders, today }: { tenders: Tender[]; today: string }) {
  const active = tenders.filter(t => !['Won', 'Lost', 'No Bid'].includes(t.status));
  const totalValue = tenders.reduce((sum, t) => sum + (t.estimatedValue ?? 0), 0);
  const fmt = (n: number) => n >= 1000000 ? `£${(n / 1000000).toFixed(2)}m` : n >= 1000 ? `£${(n / 1000).toFixed(0)}k` : `£${n.toLocaleString()}`;
  return (
    <>
      <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.6' }}>
        Tender pipeline report as at {today}. {tenders.length} tender{tenders.length !== 1 ? 's' : ''} total.
        Active: {active.length} | Won: {tenders.filter(t => t.status === 'Won').length} | Lost: {tenders.filter(t => t.status === 'Lost').length} | No Bid: {tenders.filter(t => t.status === 'No Bid').length} | Pipeline Value: {fmt(totalValue)}
      </p>
      <table>
        <thead>
          <tr><th>Ref</th><th>Tender Name</th><th>Client</th><th>Status</th><th>Priority</th><th>Owner</th><th>Return Date</th><th>Est. Value</th><th>Progress</th></tr>
        </thead>
        <tbody>
          {tenders.map(t => (
            <tr key={t.id}>
              <td style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>{t.ref}</td>
              <td style={{ fontWeight: 600 }}>{t.name}</td>
              <td>{t.client}</td>
              <td className={t.status === 'Won' ? 'rpt-complete' : t.status === 'Lost' ? 'rpt-overdue' : 'rpt-inprogress'}>{t.status}</td>
              <td>{t.priority}</td>
              <td>{t.owner}</td>
              <td>{t.returnDate ? new Date(t.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
              <td style={{ fontWeight: 600 }}>{t.estimatedValue ? fmt(t.estimatedValue) : '—'}</td>
              <td>{t.progress != null ? `${t.progress}%` : '—'}</td>
            </tr>
          ))}
          {tenders.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>No tenders recorded</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// ─── Print state types ────────────────────────────────────────────────────────

type PrintMode =
  | { kind: 'bulk'; reportId: string; filterProject: string }
  | { kind: 'single-action'; action: Action }
  | { kind: 'single-snag'; snag: Snag }
  | { kind: 'single-form'; form: DBSiteForm }
  | { kind: 'single-tc'; record: DBTCRecord };

// ─── Preview modal ────────────────────────────────────────────────────────────

function PrintPreviewModal({
  printMode, onClose, onPrint,
  snags, actions, forms, tenders, today, projects,
}: {
  printMode: PrintMode;
  onClose: () => void;
  onPrint: () => void;
  snags: Snag[];
  actions: Action[];
  forms: DBSiteForm[];
  tenders: Tender[];
  today: string;
  projects: Project[];
}) {
  const title = printMode.kind === 'bulk'
    ? (REPORT_TYPE_CARDS.find(r => r.id === printMode.reportId)?.name ?? 'Report')
    : printMode.kind === 'single-action' ? 'Action Record'
    : printMode.kind === 'single-snag' ? 'Snag Record'
    : printMode.kind === 'single-form' ? printMode.form.type
    : 'T&C Record';

  const filterProject = printMode.kind === 'bulk' ? printMode.filterProject : 'All';

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-start overflow-y-auto py-6 px-4">
      <div className="w-full max-w-3xl flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400 font-medium">Print Preview — {title}</span>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="flex items-center gap-2 px-4 py-2 bg-[#f97316] hover:bg-orange-400 text-white rounded-lg text-sm font-semibold transition-colors">
            <Printer size={14} />Print / Download PDF
          </button>
          <button onClick={onClose} className="flex items-center gap-2 px-3 py-2 bg-[#1a2236] hover:bg-[#1e2d4a] text-slate-300 rounded-lg text-sm font-semibold transition-colors border border-[#1e2d4a]">
            <X size={14} />Close
          </button>
        </div>
      </div>

      <div className="w-full max-w-3xl bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div className="bg-[#0d1628] px-8 py-6 flex items-center justify-between border-b border-[#1e2d4a]">
          <div className="flex items-center gap-3">
            <img src="/VYSITE_Logo_Long.png" alt="VYSITE" className="h-9 w-auto object-contain" />
          </div>
          <div className="text-right">
            <div className="text-slate-300 text-xs font-medium">{today}</div>
            <div className="text-slate-500 text-[11px] mt-0.5">Generated by VYSITE</div>
          </div>
        </div>
        <div className="bg-white text-gray-900 px-8 py-8 overflow-x-auto">
          <div className="border-b border-gray-200 pb-5 mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>
            <p className="text-sm text-gray-500">
              Generated: {today} &nbsp;·&nbsp; VY Construction Ltd &nbsp;·&nbsp; Confidential
              {filterProject !== 'All' && <> &nbsp;·&nbsp; Project: {filterProject}</>}
            </p>
          </div>
          <div className="text-sm text-gray-800">
            {printMode.kind === 'bulk' && printMode.reportId === 'project-status' && <BulkProjectStatus filterProject={printMode.filterProject} today={today} projects={projects} />}
            {printMode.kind === 'bulk' && printMode.reportId === 'snag-summary' && <BulkSnagSummary snags={snags} filterProject={printMode.filterProject} today={today} projects={projects} />}
            {printMode.kind === 'bulk' && printMode.reportId === 'actions-report' && <BulkActionsReport actions={actions} filterProject={printMode.filterProject} today={today} />}
            {printMode.kind === 'bulk' && printMode.reportId === 'forms-log' && <BulkFormsLog forms={forms} filterProject={printMode.filterProject} today={today} />}
            {printMode.kind === 'bulk' && printMode.reportId === 'tender-pipeline' && <BulkTenderPipeline tenders={tenders} today={today} />}
            {printMode.kind === 'single-action' && <SingleActionPrint action={printMode.action} today={today} />}
            {printMode.kind === 'single-snag' && <SingleSnagPrint snag={printMode.snag} today={today} />}
            {printMode.kind === 'single-form' && <SingleFormPrint form={printMode.form} today={today} />}
            {printMode.kind === 'single-tc' && <SingleTCPrint record={printMode.record} today={today} />}
          </div>
          <div className="mt-10 pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">Generated by VYSITE &mdash; VY Construction Ltd &mdash; {today}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HTML builders for Blob URL print ────────────────────────────────────────

const REPORT_PRINT_STYLES = `
  .rpt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:14px;margin-bottom:20px}
  .rpt-logo{font-size:22px;font-weight:900;color:#f97316;letter-spacing:.05em}
  .rpt-dateline{font-size:11px;color:#64748b;text-align:right}
  .rpt-title{font-size:18px;font-weight:900;color:#111;margin-bottom:4px}
  .rpt-subtitle{font-size:11px;color:#64748b;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #e2e8f0}
  table{width:100%;border-collapse:collapse}
  th{background:#f1f5f9;color:#334155;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
  td{padding:8px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:11px}
  tr:nth-child(even) td{background:#f8fafc}
  .rpt-footer{margin-top:32px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  .c-critical{color:#dc2626;font-weight:700}
  .c-high{color:#f97316;font-weight:700}
  .c-medium{color:#d97706;font-weight:600}
  .c-low{color:#64748b}
  .c-open{color:#dc2626}
  .c-inprogress{color:#2563eb}
  .c-closed{color:#059669}
  .c-complete{color:#059669}
  .overdue-badge{display:inline-block;background:#fee2e2;color:#dc2626;font-size:9px;font-weight:700;padding:1px 5px;border-radius:9999px;margin-left:4px}
`;

function buildReportHTML(
  mode: PrintMode,
  snags: Snag[],
  actions: Action[],
  forms: DBSiteForm[],
  tenders: Tender[],
  today: string,
  projects: Project[],
): string {
  const title = mode.kind === 'bulk'
    ? (REPORT_TYPE_CARDS.find(r => r.id === mode.reportId)?.name ?? 'Report')
    : mode.kind === 'single-action' ? 'Action Record'
    : mode.kind === 'single-snag' ? 'Snag Record'
    : mode.kind === 'single-form' ? mode.form.type
    : 'T&C Record';

  const filterProject = mode.kind === 'bulk' ? mode.filterProject : 'All';
  const subtitle = `Generated: ${today} · VY Construction Ltd · Confidential${filterProject !== 'All' ? ` · Project: ${filterProject}` : ''}`;

  const header = `<div class="rpt-header"><div><div class="rpt-logo">VYSITE</div></div><div class="rpt-dateline">${today}<br>VY Construction Ltd</div></div>
    <div class="rpt-title">${title}</div><div class="rpt-subtitle">${subtitle}</div>`;

  let content = '';

  if (mode.kind === 'bulk' && mode.reportId === 'project-status') {
    const filtered = mode.filterProject === 'All' ? projects : projects.filter(p => p.name === mode.filterProject);
    const rows = filtered.map(p => `<tr><td style="font-weight:600">${p.name}</td><td>${p.client}</td><td>${p.status}</td><td>${p.progress}%</td><td>${p.value}</td><td>${p.projectManager}</td></tr>`).join('');
    content = `<p style="font-size:12px;color:#475569;margin-bottom:16px">Project status overview — ${filtered.length} project${filtered.length !== 1 ? 's' : ''} as at ${today}.</p>
      <table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Contract Value</th><th>PM</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">No projects found</td></tr>'}</tbody></table>`;

  } else if (mode.kind === 'bulk' && mode.reportId === 'snag-summary') {
    const filtered = mode.filterProject === 'All' ? snags : snags.filter(s => s.projectName === mode.filterProject);
    const rows = filtered.map(s => `<tr>
      <td style="font-family:monospace;font-size:10px;color:#64748b">#${s.id.toUpperCase()}</td>
      <td style="font-weight:600">${s.title}</td><td>${s.projectName}</td>
      <td class="c-${s.priority.toLowerCase()}">${s.priority}</td>
      <td class="${s.status === 'Closed' ? 'c-closed' : s.status === 'In Progress' ? 'c-inprogress' : 'c-open'}">${s.status}</td>
      <td>${s.assignedTo}</td>
      <td>${s.dueDate ? new Date(s.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
    </tr>`).join('');
    content = `<p style="font-size:12px;color:#475569;margin-bottom:16px">Snag summary as at ${today}. Total: ${filtered.length} | Open: ${filtered.filter(s => s.status === 'Open').length} | In Progress: ${filtered.filter(s => s.status === 'In Progress').length} | Closed: ${filtered.filter(s => s.status === 'Closed').length}</p>
      <table><thead><tr><th>Ref</th><th>Title</th><th>Project</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Due Date</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">No snags recorded</td></tr>'}</tbody></table>`;

  } else if (mode.kind === 'bulk' && mode.reportId === 'actions-report') {
    const filtered = mode.filterProject === 'All' ? actions : actions.filter(a => a.projectName === mode.filterProject);
    const open = filtered.filter(a => a.status !== 'Complete');
    const overdue = filtered.filter(a => a.overdue && a.status !== 'Complete');
    const rows = filtered.map(a => {
      const badge = a.overdue && a.status !== 'Complete' ? '<span class="overdue-badge">OVERDUE</span>' : '';
      return `<tr>
        <td style="font-family:monospace;font-size:10px;color:#64748b">#${a.id.toUpperCase()}</td>
        <td>${a.title}${badge}</td><td>${a.projectName}</td><td>${a.owner}</td>
        <td class="${a.status === 'Complete' ? 'c-complete' : a.status === 'In Progress' ? 'c-inprogress' : ''}">${a.status}</td>
        <td class="c-${a.priority.toLowerCase()}">${a.priority}</td>
        <td style="color:${a.overdue && a.status !== 'Complete' ? '#dc2626' : '#1e293b'}">${a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
      </tr>`;
    }).join('');
    content = `<p style="font-size:12px;color:#475569;margin-bottom:16px">Actions report as at ${today}. ${open.length} open action${open.length !== 1 ? 's' : ''}, of which ${overdue.length} ${overdue.length === 1 ? 'is' : 'are'} overdue.</p>
      <table><thead><tr><th>Ref</th><th>Title</th><th>Project</th><th>Owner</th><th>Status</th><th>Priority</th><th>Due Date</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">No actions recorded</td></tr>'}</tbody></table>`;

  } else if (mode.kind === 'bulk' && mode.reportId === 'forms-log') {
    const filtered = mode.filterProject === 'All' ? forms : forms.filter(f => f.project_name === mode.filterProject);
    const rows = filtered.map(f => `<tr>
      <td style="font-family:monospace;font-size:10px;color:#64748b">${f.id.toUpperCase()}</td>
      <td>${f.type}</td><td>${f.project_name}</td><td>${f.completed_by}</td>
      <td>${f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
      <td class="${f.status === 'Approved' ? 'c-complete' : f.status === 'Submitted' ? 'c-inprogress' : ''}">${f.status}</td>
      <td>${f.description || '—'}</td>
    </tr>`).join('');
    content = `<p style="font-size:12px;color:#475569;margin-bottom:16px">Site forms log as at ${today}. ${filtered.length} form${filtered.length !== 1 ? 's' : ''} recorded.</p>
      <table><thead><tr><th>Ref</th><th>Type</th><th>Project</th><th>Completed By</th><th>Date</th><th>Status</th><th>Description</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">No forms recorded</td></tr>'}</tbody></table>`;

  } else if (mode.kind === 'bulk' && mode.reportId === 'tender-pipeline') {
    const fmt = (n: number) => n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}m` : n >= 1000 ? `£${(n / 1000).toFixed(0)}k` : `£${n.toLocaleString()}`;
    const active = tenders.filter(t => !['Won', 'Lost', 'No Bid'].includes(t.status));
    const rows = tenders.map(t => `<tr>
      <td style="font-family:monospace;font-size:10px;color:#64748b">${t.ref}</td>
      <td style="font-weight:600">${t.name}</td><td>${t.client}</td>
      <td class="${t.status === 'Won' ? 'c-complete' : 'c-inprogress'}">${t.status}</td>
      <td>${t.priority}</td><td>${t.owner}</td>
      <td>${t.returnDate ? new Date(t.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
      <td style="font-weight:600">${t.estimatedValue ? fmt(t.estimatedValue) : '—'}</td>
      <td>${t.progress != null ? `${t.progress}%` : '—'}</td>
    </tr>`).join('');
    content = `<p style="font-size:12px;color:#475569;margin-bottom:16px">Tender pipeline as at ${today}. ${tenders.length} total. Active: ${active.length} | Won: ${tenders.filter(t => t.status === 'Won').length} | Lost: ${tenders.filter(t => t.status === 'Lost').length}</p>
      <table><thead><tr><th>Ref</th><th>Name</th><th>Client</th><th>Status</th><th>Priority</th><th>Owner</th><th>Return</th><th>Est. Value</th><th>Progress</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">No tenders recorded</td></tr>'}</tbody></table>`;

  } else if (mode.kind === 'single-action') {
    const a = mode.action;
    const badge = a.overdue && a.status !== 'Complete' ? '<span class="overdue-badge">OVERDUE</span>' : '';
    content = `<table><thead><tr><th>Field</th><th>Detail</th></tr></thead><tbody>
      <tr><td style="font-weight:600;width:30%">Reference</td><td style="font-family:monospace">#${a.id.toUpperCase()}</td></tr>
      <tr><td style="font-weight:600">Title</td><td>${a.title}${badge}</td></tr>
      <tr><td style="font-weight:600">Project</td><td>${a.projectName}</td></tr>
      <tr><td style="font-weight:600">Description</td><td>${a.description || '—'}</td></tr>
      <tr><td style="font-weight:600">Owner</td><td>${a.owner}</td></tr>
      <tr><td style="font-weight:600">Status</td><td class="${a.status === 'Complete' ? 'c-complete' : a.status === 'In Progress' ? 'c-inprogress' : ''}">${a.status}</td></tr>
      <tr><td style="font-weight:600">Priority</td><td class="c-${a.priority.toLowerCase()}">${a.priority}</td></tr>
      <tr><td style="font-weight:600">Due Date</td><td style="color:${a.overdue && a.status !== 'Complete' ? '#dc2626' : '#1e293b'}">${a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
      <tr><td style="font-weight:600">Created By</td><td>${a.createdBy}</td></tr>
      <tr><td style="font-weight:600">Created Date</td><td>${a.createdDate ? new Date(a.createdDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
    </tbody></table>`;

  } else if (mode.kind === 'single-snag') {
    const s = mode.snag;
    content = `<table><thead><tr><th>Field</th><th>Detail</th></tr></thead><tbody>
      <tr><td style="font-weight:600;width:30%">Reference</td><td style="font-family:monospace">#${s.id.toUpperCase()}</td></tr>
      <tr><td style="font-weight:600">Title</td><td>${s.title}</td></tr>
      <tr><td style="font-weight:600">Project</td><td>${s.projectName}</td></tr>
      <tr><td style="font-weight:600">Description</td><td>${s.description || '—'}</td></tr>
      <tr><td style="font-weight:600">Location</td><td>${s.location}</td></tr>
      <tr><td style="font-weight:600">Assigned To</td><td>${s.assignedTo}</td></tr>
      <tr><td style="font-weight:600">Raised By</td><td>${s.raisedBy}</td></tr>
      <tr><td style="font-weight:600">Status</td><td class="${s.status === 'Closed' ? 'c-closed' : s.status === 'In Progress' ? 'c-inprogress' : 'c-open'}">${s.status}</td></tr>
      <tr><td style="font-weight:600">Priority</td><td class="c-${s.priority.toLowerCase()}">${s.priority}</td></tr>
      <tr><td style="font-weight:600">Raised Date</td><td>${s.raisedDate ? new Date(s.raisedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
      <tr><td style="font-weight:600">Due Date</td><td>${s.dueDate ? new Date(s.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
      ${s.comments.length > 0 ? `<tr><td style="font-weight:600">Comments</td><td>${s.comments.join(' | ')}</td></tr>` : ''}
    </tbody></table>`;

  } else if (mode.kind === 'single-form') {
    const f = mode.form;
    content = `<table><thead><tr><th>Field</th><th>Detail</th></tr></thead><tbody>
      <tr><td style="font-weight:600;width:30%">Reference</td><td style="font-family:monospace">${f.id.toUpperCase()}</td></tr>
      <tr><td style="font-weight:600">Form Type</td><td>${f.type}</td></tr>
      <tr><td style="font-weight:600">Project</td><td>${f.project_name}</td></tr>
      <tr><td style="font-weight:600">Date</td><td>${f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
      <tr><td style="font-weight:600">Completed By</td><td>${f.completed_by}</td></tr>
      <tr><td style="font-weight:600">Status</td><td class="${f.status === 'Approved' ? 'c-complete' : f.status === 'Submitted' ? 'c-inprogress' : ''}">${f.status}</td></tr>
      ${f.description ? `<tr><td style="font-weight:600">Description</td><td>${f.description}</td></tr>` : ''}
      ${f.comments ? `<tr><td style="font-weight:600">Comments</td><td>${f.comments}</td></tr>` : ''}
      ${f.notes ? `<tr><td style="font-weight:600">Notes</td><td>${f.notes}</td></tr>` : ''}
      ${f.submitted_date ? `<tr><td style="font-weight:600">Submitted</td><td>${new Date(f.submitted_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>` : ''}
    </tbody></table>`;

  } else if (mode.kind === 'single-tc') {
    const r = mode.record;
    content = `<table><thead><tr><th>Field</th><th>Detail</th></tr></thead><tbody>
      <tr><td style="font-weight:600;width:30%">Reference</td><td style="font-family:monospace">${r.ref}</td></tr>
      <tr><td style="font-weight:600">Title</td><td>${r.title}</td></tr>
      <tr><td style="font-weight:600">Project</td><td>${r.project_name}</td></tr>
      <tr><td style="font-weight:600">Category</td><td>${r.category}</td></tr>
      <tr><td style="font-weight:600">Area</td><td>${r.area}</td></tr>
      <tr><td style="font-weight:600">Engineer</td><td>${r.engineer}</td></tr>
      <tr><td style="font-weight:600">Date</td><td>${r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>
      <tr><td style="font-weight:600">Status</td><td class="${r.status === 'Passed' ? 'c-complete' : r.status === 'Failed' ? 'c-open' : 'c-inprogress'}">${r.status}</td></tr>
      ${r.result ? `<tr><td style="font-weight:600">Result</td><td>${r.result}</td></tr>` : ''}
      ${r.notes ? `<tr><td style="font-weight:600">Notes</td><td>${r.notes}</td></tr>` : ''}
    </tbody></table>`;
  }

  const body = `${header}${content}<div class="rpt-footer">Generated by VYSITE · VY Construction Ltd · ${today}</div>`;
  return buildPrintDocument(title, REPORT_PRINT_STYLES, body);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SelectFilter({
  label, value, onChange, children,
}: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="appearance-none bg-[#1a2236] border border-[#1e2d4a] rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-slate-300 outline-none focus:border-[#f97316] hover:border-slate-600 transition-colors cursor-pointer min-w-[150px]"
        >
          {children}
        </select>
        <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}

function DateInput({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 outline-none focus:border-[#f97316] hover:border-slate-600 transition-colors cursor-pointer [color-scheme:dark]"
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const store = useAppStore();
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Filters
  const [filterReportType, setFilterReportType] = useState('all');
  const [filterProject, setFilterProject] = useState('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterOwner, setFilterOwner] = useState('All');

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const { visibleProjectIds } = store;
  const allSnags = visibleProjectIds ? store.snags.filter(s => visibleProjectIds.includes(s.projectId)) : store.snags;
  const allActions = visibleProjectIds ? store.actions.filter(a => visibleProjectIds.includes(a.projectId)) : store.actions;
  const allForms = visibleProjectIds ? store.siteForms.filter(f => visibleProjectIds.includes(f.project_id)) : store.siteForms;

  const snags = filterProject === 'All' ? allSnags : allSnags.filter(s => s.projectName === filterProject);
  const actions = filterProject === 'All' ? allActions : allActions.filter(a => a.projectName === filterProject);
  const forms = filterProject === 'All' ? allForms : allForms.filter(f => f.project_name === filterProject);

  // Project names derived only from live store.projects
  const liveProjectNames = useMemo(
    () => store.projects.map(p => p.name).sort(),
    [store.projects],
  );

  // Owner names derived from live platform users (active only)
  const liveOwnerNames = useMemo(
    () => [...new Set(store.platformUsers.filter(u => u.status === 'Active').map(u => u.name))].sort(),
    [store.platformUsers],
  );

  // Filtered report type cards
  const visibleReportCards = useMemo(
    () => filterReportType === 'all' ? REPORT_TYPE_CARDS : REPORT_TYPE_CARDS.filter(r => r.id === filterReportType),
    [filterReportType],
  );

  const hasActiveFilters = filterReportType !== 'all' || filterProject !== 'All' || filterDateFrom !== '' || filterDateTo !== '' || filterOwner !== 'All';

  function clearFilters() {
    setFilterReportType('all');
    setFilterProject('All');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterOwner('All');
  }

  function handleBulkExport(reportCardId: string) {
    setPrintMode({ kind: 'bulk', reportId: reportCardId, filterProject });
    setShowPreview(true);
  }

  function handleClose() {
    setShowPreview(false);
    setPrintMode(null);
  }

  return (
    <>
      <div className="p-4 lg:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">Reports</h2>
          <p className="text-sm text-slate-500">Generate and download project reports</p>
        </div>

        {/* Filter bar */}
        <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <SelectFilter label="Report Type" value={filterReportType} onChange={setFilterReportType}>
              <option value="all">All Report Types</option>
              {REPORT_TYPE_CARDS.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </SelectFilter>

            <SelectFilter label="Project" value={filterProject} onChange={setFilterProject}>
              <option value="All">All Projects</option>
              {liveProjectNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </SelectFilter>

            <DateInput label="Date From" value={filterDateFrom} onChange={setFilterDateFrom} />
            <DateInput label="Date To" value={filterDateTo} onChange={setFilterDateTo} />

            {liveOwnerNames.length > 0 && (
              <SelectFilter label="Owner / Generated By" value={filterOwner} onChange={setFilterOwner}>
                <option value="All">All Owners</option>
                {liveOwnerNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </SelectFilter>
            )}

            {hasActiveFilters && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider opacity-0 select-none">Clear</label>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-[#0d1628] border border-[#1e2d4a] hover:border-slate-600 transition-colors"
                >
                  <X size={12} />Clear filters
                </button>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#1e2d4a]">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Active:</span>
              {filterReportType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f97316]/15 text-[#f97316] text-[10px] font-semibold rounded-full">
                  {REPORT_TYPE_CARDS.find(r => r.id === filterReportType)?.name}
                  <button onClick={() => setFilterReportType('all')} className="hover:text-white transition-colors"><X size={9} /></button>
                </span>
              )}
              {filterProject !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 text-[10px] font-semibold rounded-full">
                  {filterProject}
                  <button onClick={() => setFilterProject('All')} className="hover:text-white transition-colors"><X size={9} /></button>
                </span>
              )}
              {filterDateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold rounded-full">
                  From: {new Date(filterDateFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <button onClick={() => setFilterDateFrom('')} className="hover:text-white transition-colors"><X size={9} /></button>
                </span>
              )}
              {filterDateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold rounded-full">
                  To: {new Date(filterDateTo).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <button onClick={() => setFilterDateTo('')} className="hover:text-white transition-colors"><X size={9} /></button>
                </span>
              )}
              {filterOwner !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/20 text-slate-300 text-[10px] font-semibold rounded-full">
                  Owner: {filterOwner}
                  <button onClick={() => setFilterOwner('All')} className="hover:text-white transition-colors"><X size={9} /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Report type cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {visibleReportCards.map((report) => {
            const Icon = report.icon;
            return (
              <div key={report.id} className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] p-4 hover:border-[#2a3d5a] transition-all group cursor-pointer">
                <div className={`w-9 h-9 rounded-lg ${report.color} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                  <Icon size={16} />
                </div>
                <h3 className="font-semibold text-white text-xs mb-1 leading-snug">{report.name}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3 line-clamp-2">{report.description}</p>
                <button
                  onClick={() => handleBulkExport(report.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#0d1628] hover:bg-[#f97316] hover:text-white text-slate-400 rounded-lg text-xs font-semibold transition-all border border-[#1e2d4a] hover:border-[#f97316]"
                >
                  <Download size={12} />
                  {filterProject !== 'All' ? `Export — ${filterProject.split(' ').slice(0, 2).join(' ')}` : 'Generate PDF'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Report history — clean empty state; no static rows */}
        <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="p-5 border-b border-[#1e2d4a] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Report History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Reports generated this session will appear here</p>
            </div>
          </div>
          <div className="px-5 py-14 flex flex-col items-center justify-center gap-2">
            <FileText size={28} className="text-slate-700" />
            <p className="text-slate-600 text-sm font-medium">No reports generated yet</p>
            <p className="text-slate-700 text-xs">Use the report cards above to generate and download a PDF</p>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && printMode && (
        <PrintPreviewModal
          printMode={printMode}
          onClose={handleClose}
          onPrint={() => openPrintTab(buildReportHTML(printMode, snags, actions, forms, store.tenders, today, store.projects))}
          snags={snags}
          actions={actions}
          forms={forms}
          tenders={store.tenders}
          today={today}
          projects={store.projects}
        />
      )}
    </>
  );
}
