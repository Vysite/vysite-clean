import React, { useState, useEffect, useCallback } from 'react';
import { FileImage, Upload, Search, Trash2, Eye, X, FileText, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import { supabase } from '../../lib/supabase';
import type { DBTenderDrawing } from './drawingTypes';
import { DISCIPLINES } from './drawingTypes';
import TenderDrawingWorkspace from './TenderDrawingWorkspace';

interface Props {
  tenderId: string;
  tenderName: string;
}

const DISCIPLINE_COLORS: Record<string, string> = {
  General: 'bg-slate-700 text-slate-400',
  Architectural: 'bg-blue-900/60 text-blue-400',
  Structural: 'bg-amber-900/60 text-amber-400',
  Mechanical: 'bg-teal-900/60 text-teal-400',
  Electrical: 'bg-yellow-900/60 text-yellow-400',
  Civil: 'bg-orange-900/60 text-orange-400',
  Landscape: 'bg-emerald-900/60 text-emerald-400',
  Interior: 'bg-purple-900/60 text-purple-400',
  'Fire Protection': 'bg-red-900/60 text-red-400',
  Drainage: 'bg-cyan-900/60 text-cyan-400',
};

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function TenderDrawingsTab({ tenderId, tenderName }: Props) {
  const store = useAppStore();
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [openDrawing, setOpenDrawing] = useState<DBTenderDrawing | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DBTenderDrawing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    store.loadTenderDrawings(tenderId);
  }, [tenderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawings = store.tenderDrawings.filter(d => {
    if (d.tender_id !== tenderId) return false;
    if (disciplineFilter !== 'all' && d.discipline !== disciplineFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.title.toLowerCase().includes(q) || d.drawing_number.toLowerCase().includes(q) || d.revision.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await store.removeTenderDrawing(deleteConfirm.id, deleteConfirm.storage_path);
    setDeleteConfirm(null);
  };

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
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search drawings..."
            className="w-full pl-9 pr-3 py-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:border-[#f97316]/50 focus:outline-none"
          />
        </div>
        <select
          value={disciplineFilter}
          onChange={e => setDisciplineFilter(e.target.value)}
          className="px-3 py-2 bg-[#1a2236] border border-[#1e2d4a] rounded-lg text-sm text-slate-300 focus:border-[#f97316]/50 focus:outline-none"
        >
          <option value="all">All Disciplines</option>
          {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          <Upload size={14} />Upload Drawing
        </button>
      </div>

      {/* Loading state */}
      {store.tenderDrawingsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-slate-600 border-t-[#f97316] rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!store.tenderDrawingsLoading && drawings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="w-14 h-14 rounded-2xl bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center mb-4">
            <FileImage size={26} className="text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-300 mb-1.5">No drawings yet</p>
          <p className="text-xs text-slate-500 max-w-sm">Upload a PDF drawing to get started. Drawings uploaded here are private to your organisation and this tender.</p>
        </div>
      )}

      {/* Drawing register table */}
      {!store.tenderDrawingsLoading && drawings.length > 0 && (
        <div className="overflow-x-auto bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2d4a]">
                {['Drawing No.', 'Title', 'Discipline', 'Rev', 'Pages', 'Size', 'Uploaded', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider pb-3 pr-4 pl-4 pt-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]">
              {drawings.map(d => (
                <tr
                  key={d.id}
                  className="hover:bg-[#0d1628]/40 transition-colors group cursor-pointer"
                  onClick={() => setOpenDrawing(d)}
                >
                  <td className="py-3 pl-4 pr-4 text-sm font-mono text-slate-300 whitespace-nowrap">{d.drawing_number || '—'}</td>
                  <td className="py-3 pr-4 text-sm font-semibold text-slate-200 max-w-[300px] truncate">{d.title || 'Untitled'}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DISCIPLINE_COLORS[d.discipline] ?? DISCIPLINE_COLORS.General}`}>{d.discipline}</span>
                  </td>
                  <td className="py-3 pr-4 text-xs font-mono text-slate-400">{d.revision}</td>
                  <td className="py-3 pr-4 text-xs text-slate-400">{d.page_count}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{fmtSize(d.file_size)}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenDrawing(d); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#f97316] hover:bg-[#1e2d4a] transition-colors"
                        title="Open drawing"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(d); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                        title="Delete drawing"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadDrawingModal
          tenderId={tenderId}
          tenderName={tenderName}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); store.loadTenderDrawings(tenderId); }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Drawing workspace */}
      {openDrawing && (
        <TenderDrawingWorkspace
          drawing={openDrawing}
          tenderId={tenderId}
          onClose={() => setOpenDrawing(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-900/30 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Delete Drawing</p>
                <p className="text-xs text-slate-500">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-1">Are you sure you want to delete:</p>
            <p className="text-sm font-semibold text-[#f97316] mb-4">{deleteConfirm.drawing_number} — {deleteConfirm.title}</p>
            <p className="text-xs text-slate-500 mb-5">The PDF file and all calibration data will be permanently removed.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadProps {
  tenderId: string;
  tenderName: string;
  onClose: () => void;
  onUploaded: () => void;
  onError: (msg: string) => void;
}

function UploadDrawingModal({ tenderId, tenderName, onClose, onUploaded, onError }: UploadProps) {
  const store = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [drawingNumber, setDrawingNumber] = useState('');
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState<string>('General');
  const [revision, setRevision] = useState('P01');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback(async (f: File) => {
    if (f.type !== 'application/pdf') {
      onError('Please select a PDF file.');
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      setPageCount(pdf.numPages);
    } catch {
      setPageCount(null);
    }
  }, [title, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file) { onError('Please select a PDF file.'); return; }
    const oid = store.currentOrgId;
    if (!oid) { onError('No organisation context.'); return; }

    setUploading(true);
    setProgress('Uploading PDF...');

    const drawingId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${oid}/${tenderId}/${drawingId}/${safeName}`;

    try {
      const { error: uploadErr } = await supabase.storage
        .from('tender-drawings')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });

      if (uploadErr) {
        onError(`Upload failed: ${uploadErr.message}`);
        setUploading(false);
        return;
      }

      setProgress('Saving drawing metadata...');

      let pages = pageCount ?? 1;
      if (!pageCount) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          pages = pdf.numPages;
        } catch { pages = 1; }
      }

      const drawing: DBTenderDrawing = {
        id: drawingId,
        org_id: oid,
        tender_id: tenderId,
        drawing_number: drawingNumber,
        title: title || file.name.replace(/\.pdf$/i, ''),
        discipline,
        revision,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        page_count: pages,
        current_page: 1,
        status: 'active',
        notes,
        uploaded_by: store.currentUser?.name ?? '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const err = await store.addTenderDrawing(drawing);
      if (err) {
        // Clean up orphaned storage object
        await supabase.storage.from('tender-drawings').remove([storagePath]);
        onError(`Failed to save drawing: ${err}`);
      } else {
        onUploaded();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onError(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a2236] rounded-2xl border border-[#1e2d4a] shadow-2xl w-full max-w-lg my-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a] shrink-0">
          <p className="text-sm font-bold text-white">Upload Drawing — {tenderName}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1e2d4a] transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-[#f97316] bg-orange-950/10' : 'border-[#1e2d4a] hover:border-[#f97316]/40'}`}
            onClick={() => document.getElementById('drawing-file-input')?.click()}
          >
            <input
              id="drawing-file-input"
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText size={20} className="text-[#f97316]" />
                <span className="text-sm text-slate-200 font-medium">{file.name}</span>
                {pageCount && <span className="text-xs text-slate-500">({pageCount} pages)</span>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={24} className="text-slate-600" />
                <p className="text-sm text-slate-400">Drop a PDF here or click to browse</p>
                <p className="text-xs text-slate-600">PDF files only</p>
              </div>
            )}
          </div>

          {/* Metadata fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Drawing Number</label>
              <input value={drawingNumber} onChange={e => setDrawingNumber(e.target.value)} className="w-full px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:border-[#f97316]/50 focus:outline-none" placeholder="e.g. DWG-001" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Revision</label>
              <input value={revision} onChange={e => setRevision(e.target.value)} className="w-full px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:border-[#f97316]/50 focus:outline-none" placeholder="P01" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:border-[#f97316]/50 focus:outline-none" placeholder="Drawing title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Discipline</label>
              <select value={discipline} onChange={e => setDiscipline(e.target.value)} className="w-full px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:border-[#f97316]/50 focus:outline-none">
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 bg-[#0d1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-200 focus:border-[#f97316]/50 focus:outline-none" placeholder="Notes" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-[#1e2d4a] shrink-0">
          <button onClick={onClose} disabled={uploading} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] rounded-lg hover:bg-[#1e2d4a] transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleUpload} disabled={!file || uploading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#f97316] rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50">
            {uploading ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{progress || 'Uploading...'}</>
            ) : (
              <><Upload size={14} />Upload</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
