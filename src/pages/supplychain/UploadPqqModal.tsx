/**
 * Upload Completed PQQ modal.
 *
 * Stores the uploaded file as a 'PQQ Document' in vy_supplier_documents
 * and records structured import metadata in pqq_import_raw on the supplier.
 *
 * Import architecture:
 *   pqq_import_raw = {
 *     document_id: string,
 *     document_name: string,
 *     file_type: string,
 *     uploaded_at: string,
 *     uploaded_by: string,
 *     import_status: 'pending_review' | 'reviewed' | 'imported',
 *     import_note: string,
 *   }
 *
 * A future AI extraction service can read document_id → fetch the base64 from
 * vy_supplier_documents → parse answers → write to vy_supplier_pqq_responses
 * with section_status = 'in_progress' and flag uncertain fields.
 * Confirmed data must always require manual review before going live.
 */

import React, { useRef, useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DBSupplier, DBSupplierDocument } from './types';

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-400 mb-1.5';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function genId(): string {
  return `sc${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface PqqImportMeta {
  document_id: string;
  document_name: string;
  file_type: string;
  uploaded_at: string;
  uploaded_by: string;
  import_status: 'pending_review' | 'reviewed' | 'imported';
  import_note: string;
}

interface Props {
  supplier: DBSupplier;
  orgId: string;
  currentUserName: string;
  onClose: () => void;
  onUploaded: (doc: DBSupplierDocument, importMeta: PqqImportMeta, updatedSupplier: DBSupplier) => void;
}

export default function UploadPqqModal({ supplier, orgId, currentUserName, onClose, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
      setError('Please upload a PDF or Word document (.pdf, .doc, .docx)');
      return;
    }
    setError('');

    const reader = new FileReader();
    reader.onload = ev => {
      setFileName(file.name);
      setFileType(file.type || 'application/octet-stream');
      setFileSize(file.size);
      setDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!dataUrl || !fileName) return;
    setSaving(true);

    const docId = genId();
    const now = new Date().toISOString();

    const doc: DBSupplierDocument = {
      id: docId,
      supplier_id: supplier.id,
      org_id: orgId,
      document_category: 'PQQ Document',
      document_title: `Completed PQQ — ${supplier.company_name}`,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      data_url: dataUrl,
      issue_date: now.slice(0, 10),
      expiry_date: '',
      verified: false,
      verified_by: '',
      verification_date: '',
      notes: note.trim() || 'Uploaded completed PQQ — awaiting import review',
      created_by: currentUserName,
      created_at: now,
    };

    const importMeta: PqqImportMeta = {
      document_id: docId,
      document_name: fileName,
      file_type: fileType,
      uploaded_at: now,
      uploaded_by: currentUserName,
      import_status: 'pending_review',
      import_note: note.trim() || '',
    };

    const updatedSupplier: DBSupplier = {
      ...supplier,
      pqq_import_raw: importMeta,
      updated_at: now,
    };

    try {
      await supabase.from('vy_supplier_documents').insert(doc);
      await supabase.from('vy_suppliers').update({
        pqq_import_raw: importMeta,
        updated_at: now,
      }).eq('id', supplier.id);

      onUploaded(doc, importMeta, updatedSupplier);
      onClose();
    } catch (err) {
      console.error('[VYSITE] PQQ upload error:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2d4a]">
          <div>
            <h2 className="text-base font-black text-white">Upload Completed PQQ</h2>
            <p className="text-xs text-slate-500 mt-0.5">{supplier.company_name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-[#1a2236] rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Info banner */}
          <div className="flex gap-3 p-4 bg-blue-900/20 border border-blue-800/50 rounded-xl">
            <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              Upload the completed questionnaire returned by this supplier.
              The document will be stored against this record and marked as
              <strong className="text-slate-200"> Pending Review</strong>.
              No existing PQQ data will be changed until you review and confirm imported information.
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className={labelCls}>Completed PQQ File <span className="text-slate-600">(PDF or Word)</span></label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                dataUrl ? 'border-emerald-700/60 bg-emerald-900/10' : 'border-[#1e2d4a] hover:border-[#f97316]'
              }`}
            >
              {dataUrl ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-900/30 border border-emerald-800 flex items-center justify-center">
                    <FileText size={14} className="text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">{fileName}</p>
                    {fileSize && <p className="text-xs text-slate-500">{fmtSize(fileSize)}</p>}
                  </div>
                  <CheckCircle2 size={16} className="text-emerald-400 ml-auto" />
                </div>
              ) : (
                <>
                  <Upload size={20} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm text-slate-400 font-medium">Click to select file</p>
                  <p className="text-xs text-slate-600 mt-1">PDF, DOC or DOCX</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Optional note */}
          <div>
            <label className={labelCls}>Notes <span className="text-slate-600">(optional)</span></label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="e.g. Returned by email 10 Jul 2026 — awaiting supporting documents"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-400">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Import architecture note */}
          <div className="p-3 bg-[#0d1628] border border-[#1e2d4a] rounded-xl">
            <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mb-1.5">Import Process</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Once uploaded, the document will be available for AI-assisted extraction in a future release.
              The extraction service will identify answers, labour rates, geographic coverage, and
              supporting document expiry dates, and populate a <strong className="text-slate-400">draft review</strong> for your approval.
              No data will be applied automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#1e2d4a]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!dataUrl || saving}
            className="flex items-center gap-2 px-5 py-2 bg-[#f97316] hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors"
          >
            {saving ? (
              <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
            ) : (
              <><Upload size={13} /> Upload Completed PQQ</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
