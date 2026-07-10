import React, { useState, useEffect, useRef } from 'react';
import {
  X, Building2, MapPin, Globe, Mail, Phone, User, Star, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp, Upload, FileText,
  Paperclip, Download, Trash2, Eye, Plus, Check, Shield, Tag,
  Banknote, ClipboardList, FileCheck, StickyNote, Network,
  FileDown, ClipboardCheck, MoreHorizontal, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore, usePermissions } from '../../lib/StoreContext';
import type {
  DBSupplier, DBSupplierTradeLink, DBSupplierSpecialismLink,
  DBSupplierLabourRate, DBSupplierPqqResponse, DBSupplierDocument,
} from './types';
import { PQQ_SECTIONS, REGIONS, DOCUMENT_CATEGORIES, APPROVAL_STATUSES } from './types';
import { exportSupplierSummaryPdf } from './SupplierPDF';
import { downloadPqqPdf, downloadPqqWord } from './SupplierPQQ';
import UploadPqqModal from './UploadPqqModal';
import type { PqqImportMeta } from './UploadPqqModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() { return `sc${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function isExpiringSoon(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const diff = (d.getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff <= 30;
}
function isExpired(dateStr: string) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

const inputCls = 'w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#f97316] transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

type DetailTab = 'overview' | 'company' | 'trades' | 'pqq' | 'documents' | 'notes';

const APPROVAL_COLORS: Record<string, string> = {
  'Pending':                'bg-slate-900/60 text-slate-400 border-slate-700',
  'Under Review':           'bg-amber-900/40 text-amber-400 border-amber-800',
  'Approved':               'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  'Conditionally Approved': 'bg-blue-900/40 text-blue-400 border-blue-800',
  'Rejected':               'bg-red-900/40 text-red-400 border-red-800',
  'Suspended':              'bg-orange-900/40 text-orange-400 border-orange-800',
};

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  supplier,
  tradeLinks,
  specialismLinks,
  documents,
  pqqResponses,
  trades,
  specialisms,
  canEdit,
  onChangeStatus,
}: {
  supplier: DBSupplier;
  tradeLinks: DBSupplierTradeLink[];
  specialismLinks: DBSupplierSpecialismLink[];
  documents: DBSupplierDocument[];
  pqqResponses: DBSupplierPqqResponse[];
  trades: { id: string; name: string }[];
  specialisms: { id: string; name: string }[];
  canEdit: boolean;
  onChangeStatus: (status: string) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);

  const myTrades = tradeLinks.map(l => trades.find(t => t.id === l.trade_id)?.name).filter(Boolean);
  const mySpecialisms = specialismLinks.map(l => specialisms.find(s => s.id === l.specialism_id)?.name).filter(Boolean);
  const pqqComplete = pqqResponses.filter(r => r.section_status === 'complete').length;
  const expiringDocs = documents.filter(d => d.expiry_date && (isExpiringSoon(d.expiry_date) || isExpired(d.expiry_date)));

  return (
    <div className="space-y-6">
      {/* Status + preferred row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button
            onClick={() => canEdit && setStatusOpen(o => !o)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
              APPROVAL_COLORS[supplier.approval_status] ?? APPROVAL_COLORS['Pending']
            } ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          >
            {supplier.approval_status}
            {canEdit && <ChevronDown size={13} />}
          </button>
          {statusOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-2xl z-20 py-1">
              {APPROVAL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { onChangeStatus(s); setStatusOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[#0d1628] transition-colors ${
                    supplier.approval_status === s ? 'text-[#f97316]' : 'text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {supplier.preferred_supplier && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 border border-amber-800 rounded-xl text-amber-400 text-xs font-bold">
            <Star size={11} fill="currentColor" /> Preferred Supplier
          </span>
        )}
        {supplier.supplier_type && (
          <span className="px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] rounded-xl text-slate-400 text-xs font-medium">
            {supplier.supplier_type}
          </span>
        )}
      </div>

      {/* Key info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {supplier.general_telephone && (
          <div className="flex items-start gap-3 bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
            <Phone size={16} className="text-[#f97316] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Telephone</p>
              <p className="text-sm text-slate-200">{supplier.general_telephone}</p>
            </div>
          </div>
        )}
        {supplier.general_email && (
          <div className="flex items-start gap-3 bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
            <Mail size={16} className="text-[#f97316] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Email</p>
              <a href={`mailto:${supplier.general_email}`} className="text-sm text-blue-400 hover:underline">{supplier.general_email}</a>
            </div>
          </div>
        )}
        {supplier.primary_contact && (
          <div className="flex items-start gap-3 bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
            <User size={16} className="text-[#f97316] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Primary Contact</p>
              <p className="text-sm text-slate-200">{supplier.primary_contact}</p>
              {supplier.contact_position && <p className="text-xs text-slate-500">{supplier.contact_position}</p>}
            </div>
          </div>
        )}
        {(supplier.reg_address_city || supplier.reg_address_postcode) && (
          <div className="flex items-start gap-3 bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
            <MapPin size={16} className="text-[#f97316] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Location</p>
              <p className="text-sm text-slate-200">{[supplier.reg_address_city, supplier.reg_address_postcode].filter(Boolean).join(', ')}</p>
            </div>
          </div>
        )}
        {supplier.website && (
          <div className="flex items-start gap-3 bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
            <Globe size={16} className="text-[#f97316] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-semibond uppercase tracking-wider mb-0.5">Website</p>
              <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline truncate">{supplier.website}</a>
            </div>
          </div>
        )}
        {supplier.company_number && (
          <div className="flex items-start gap-3 bg-[#0d1628] rounded-xl border border-[#1e2d4a] p-4">
            <Building2 size={16} className="text-[#f97316] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Company Number</p>
              <p className="text-sm text-slate-200">{supplier.company_number}</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-white">{pqqComplete}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">PQQ Complete</p>
          <p className="text-[10px] text-slate-600">of {PQQ_SECTIONS.length} sections</p>
        </div>
        <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-white">{documents.length}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Documents</p>
        </div>
        <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-white">{myTrades.length}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Trades</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${expiringDocs.length > 0 ? 'bg-red-900/20 border-red-800' : 'bg-[#0d1628] border-[#1e2d4a]'}`}>
          <p className={`text-2xl font-black ${expiringDocs.length > 0 ? 'text-red-400' : 'text-white'}`}>{expiringDocs.length}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Doc Alerts</p>
        </div>
      </div>

      {/* PQQ progress */}
      <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-white">PQQ Progress</p>
          <span className="text-xs text-slate-500">{pqqComplete} / {PQQ_SECTIONS.length} sections</span>
        </div>
        <div className="w-full bg-[#1e2d4a] rounded-full h-2 mb-3">
          <div
            className="h-2 rounded-full bg-[#f97316] transition-all duration-500"
            style={{ width: `${(pqqComplete / PQQ_SECTIONS.length) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PQQ_SECTIONS.map(s => {
            const resp = pqqResponses.find(r => r.section_key === s.key);
            const status = resp?.section_status ?? 'not_started';
            return (
              <div key={s.key} className={`rounded-lg px-2 py-1.5 text-center border ${
                status === 'complete' ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' :
                status === 'in_progress' ? 'bg-amber-900/30 border-amber-800 text-amber-400' :
                status === 'na' ? 'bg-slate-800/60 border-slate-700 text-slate-600' :
                'bg-[#111827] border-[#1e2d4a] text-slate-600'
              }`}>
                <p className="text-[9px] font-semibold leading-tight">{s.title.split(' ').slice(0, 2).join(' ')}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trades & regions */}
      {(myTrades.length > 0 || supplier.regions.length > 0 || mySpecialisms.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {myTrades.length > 0 && (
            <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Trades</p>
              <div className="flex flex-wrap gap-1.5">
                {myTrades.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-[#1a2236] border border-[#1e2d4a] rounded-full text-xs text-slate-300">{t}</span>
                ))}
              </div>
            </div>
          )}
          {mySpecialisms.length > 0 && (
            <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Specialisms</p>
              <div className="flex flex-wrap gap-1.5">
                {mySpecialisms.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-[#1a2236] border border-[#1e2d4a] rounded-full text-xs text-slate-300">{s}</span>
                ))}
              </div>
            </div>
          )}
          {supplier.regions.length > 0 && (
            <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Coverage</p>
              <div className="flex flex-wrap gap-1.5">
                {supplier.regions.map(r => (
                  <span key={r} className="px-2 py-0.5 bg-[#1a2236] border border-[#1e2d4a] rounded-full text-xs text-slate-300">{r}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {supplier.company_description && (
        <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Company Description</p>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{supplier.company_description}</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Company ─────────────────────────────────────────────────────────────

function CompanyTab({ supplier, canEdit, onSave }: { supplier: DBSupplier; canEdit: boolean; onSave: (s: DBSupplier) => void }) {
  const [form, setForm] = useState(supplier);
  const [saved, setSaved] = useState(false);

  function set(key: keyof DBSupplier, val: unknown) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleSave() {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const F = ({ label, field, type = 'text', span = false }: { label: string; field: keyof DBSupplier; type?: string; span?: boolean }) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value)} disabled={!canEdit} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white mb-4">Company Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Company Name *" field="company_name" span />
          <F label="Trading Name" field="trading_name" />
          <F label="Company Number" field="company_number" />
          <F label="VAT Number" field="vat_number" />
          <F label="UTR Number" field="utr_number" />
          <F label="Website" field="website" />
          <F label="General Email" field="general_email" type="email" />
          <F label="General Telephone" field="general_telephone" />
          <F label="Primary Contact" field="primary_contact" />
          <F label="Contact Position" field="contact_position" />
          <F label="Mobile Number" field="mobile_number" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Company Description</label>
        <textarea
          rows={3}
          className={`${inputCls} resize-none`}
          value={form.company_description}
          onChange={e => set('company_description', e.target.value)}
          disabled={!canEdit}
        />
      </div>

      <div>
        <h3 className="text-sm font-bold text-white mb-4">Registered Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Address Line 1" field="reg_address_line1" span />
          <F label="Address Line 2" field="reg_address_line2" span />
          <F label="Town / City" field="reg_address_city" />
          <F label="County" field="reg_address_county" />
          <F label="Postcode" field="reg_address_postcode" />
          <F label="Country" field="reg_address_country" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-sm font-bold text-white">Trading Address</h3>
          {canEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.trading_address_same}
                onChange={e => set('trading_address_same', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-600 accent-[#f97316]"
              />
              <span className="text-xs text-slate-400">Same as registered address</span>
            </label>
          )}
        </div>
        {!form.trading_address_same && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F label="Address Line 1" field="trade_address_line1" span />
            <F label="Address Line 2" field="trade_address_line2" span />
            <F label="Town / City" field="trade_address_city" />
            <F label="County" field="trade_address_county" />
            <F label="Postcode" field="trade_address_postcode" />
            <F label="Country" field="trade_address_country" />
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              saved ? 'bg-emerald-600 text-white' : 'bg-[#f97316] hover:bg-orange-400 text-white'
            }`}
          >
            {saved ? <><Check size={14} /> Saved</> : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Trades & Coverage ───────────────────────────────────────────────────

function TradesCoverageTab({
  supplier,
  tradeLinks,
  specialismLinks,
  labourRates,
  rateTypes,
  trades,
  specialisms,
  canEdit,
  onSave,
  onTradeLinksChange,
  onSpecialismLinksChange,
  onLabourRatesChange,
}: {
  supplier: DBSupplier;
  tradeLinks: DBSupplierTradeLink[];
  specialismLinks: DBSupplierSpecialismLink[];
  labourRates: DBSupplierLabourRate[];
  rateTypes: { id: string; name: string; is_active: boolean }[];
  trades: { id: string; name: string; is_active: boolean }[];
  specialisms: { id: string; name: string; is_active: boolean }[];
  canEdit: boolean;
  onSave: (s: DBSupplier) => void;
  onTradeLinksChange: (links: DBSupplierTradeLink[]) => void;
  onSpecialismLinksChange: (links: DBSupplierSpecialismLink[]) => void;
  onLabourRatesChange: (rates: DBSupplierLabourRate[]) => void;
}) {
  const [form, setForm] = useState({
    supplier_type: supplier.supplier_type,
    preferred_supplier: supplier.preferred_supplier,
    approval_status: supplier.approval_status,
    approval_date: supplier.approval_date,
    approved_by: supplier.approved_by,
    approval_notes: supplier.approval_notes,
    primary_trade_id: supplier.primary_trade_id,
    regions: supplier.regions,
    min_package_value: supplier.min_package_value,
    preferred_package_value: supplier.preferred_package_value,
    max_package_value: supplier.max_package_value,
  });

  const [saved, setSaved] = useState(false);

  function toggleTrade(tradeId: string) {
    if (!canEdit) return;
    const exists = tradeLinks.find(l => l.trade_id === tradeId);
    if (exists) {
      onTradeLinksChange(tradeLinks.filter(l => l.trade_id !== tradeId));
    } else {
      onTradeLinksChange([...tradeLinks, { supplier_id: supplier.id, trade_id: tradeId, org_id: supplier.org_id }]);
    }
  }

  function toggleSpecialism(spId: string) {
    if (!canEdit) return;
    const exists = specialismLinks.find(l => l.specialism_id === spId);
    if (exists) {
      onSpecialismLinksChange(specialismLinks.filter(l => l.specialism_id !== spId));
    } else {
      onSpecialismLinksChange([...specialismLinks, { supplier_id: supplier.id, specialism_id: spId, org_id: supplier.org_id }]);
    }
  }

  function toggleRegion(region: string) {
    if (!canEdit) return;
    const regions = form.regions.includes(region)
      ? form.regions.filter(r => r !== region)
      : [...form.regions, region];
    setForm(f => ({ ...f, regions }));
  }

  function updateRate(rateTypeId: string, field: keyof DBSupplierLabourRate, val: string) {
    const parsed = val === '' ? null : parseFloat(val);
    const existing = labourRates.find(r => r.rate_type_id === rateTypeId);
    if (existing) {
      onLabourRatesChange(labourRates.map(r => r.rate_type_id === rateTypeId ? { ...r, [field]: parsed } : r));
    } else {
      onLabourRatesChange([...labourRates, {
        id: genId(), supplier_id: supplier.id, org_id: supplier.org_id,
        rate_type_id: rateTypeId, standard_rate: null, overtime_rate: null, weekend_rate: null, night_rate: null,
        [field]: parsed,
      }]);
    }
  }

  function handleSave() {
    onSave({ ...supplier, ...form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activeRateTypes = rateTypes.filter(rt => rt.is_active);

  return (
    <div className="space-y-6">
      {/* Classification */}
      <div>
        <h3 className="text-sm font-bold text-white mb-4">Classification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Supplier Type</label>
            <select className={inputCls} value={form.supplier_type} onChange={e => setForm(f => ({ ...f, supplier_type: e.target.value }))} disabled={!canEdit}>
              <option value="">— Select type —</option>
              {['Contractor','Subcontractor','Specialist Subcontractor','Consultant','Supplier / Manufacturer','Labour Only','Other'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.preferred_supplier}
                onChange={e => setForm(f => ({ ...f, preferred_supplier: e.target.checked }))}
                disabled={!canEdit}
                className="w-4 h-4 rounded border-slate-600 accent-[#f97316]"
              />
              <span className="text-sm text-slate-300">Preferred Supplier</span>
            </label>
          </div>
          <div>
            <label className={labelCls}>Approval Status</label>
            <select className={inputCls} value={form.approval_status} onChange={e => setForm(f => ({ ...f, approval_status: e.target.value }))} disabled={!canEdit}>
              {APPROVAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Approval Date</label>
            <input type="date" className={inputCls} value={form.approval_date} onChange={e => setForm(f => ({ ...f, approval_date: e.target.value }))} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>Approved By</label>
            <input className={inputCls} value={form.approved_by} onChange={e => setForm(f => ({ ...f, approved_by: e.target.value }))} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>Primary Trade</label>
            <select className={inputCls} value={form.primary_trade_id} onChange={e => setForm(f => ({ ...f, primary_trade_id: e.target.value }))} disabled={!canEdit}>
              <option value="">— Select primary trade —</option>
              {trades.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Approval Notes</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.approval_notes} onChange={e => setForm(f => ({ ...f, approval_notes: e.target.value }))} disabled={!canEdit} />
          </div>
        </div>
      </div>

      {/* Trades */}
      {trades.filter(t => t.is_active).length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Trades Covered</h3>
          <div className="flex flex-wrap gap-2">
            {trades.filter(t => t.is_active).map(t => {
              const selected = tradeLinks.some(l => l.trade_id === t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTrade(t.id)}
                  disabled={!canEdit}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    selected ? 'bg-[#f97316]/20 border-[#f97316] text-[#f97316]' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-400 hover:border-slate-500'
                  } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {selected && <Check size={10} className="inline mr-1" />}{t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Specialisms */}
      {specialisms.filter(s => s.is_active).length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Specialisms</h3>
          <div className="flex flex-wrap gap-2">
            {specialisms.filter(s => s.is_active).map(s => {
              const selected = specialismLinks.some(l => l.specialism_id === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSpecialism(s.id)}
                  disabled={!canEdit}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    selected ? 'bg-blue-900/30 border-blue-700 text-blue-400' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-400 hover:border-slate-500'
                  } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {selected && <Check size={10} className="inline mr-1" />}{s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Geographic Coverage */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3">Geographic Coverage</h3>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map(r => {
            const selected = form.regions.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggleRegion(r)}
                disabled={!canEdit}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  selected ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400' : 'bg-[#0d1628] border-[#1e2d4a] text-slate-400 hover:border-slate-500'
                } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {selected && <Check size={10} className="inline mr-1" />}{r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Package Values */}
      <div>
        <h3 className="text-sm font-bold text-white mb-4">Package Values</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Minimum Package Value (£)', field: 'min_package_value' as const },
            { label: 'Preferred Package Value (£)', field: 'preferred_package_value' as const },
            { label: 'Maximum Package Value (£)', field: 'max_package_value' as const },
          ].map(({ label, field }) => (
            <div key={field}>
              <label className={labelCls}>{label}</label>
              <input
                type="number"
                className={inputCls}
                value={form[field] ?? ''}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                disabled={!canEdit}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Labour Rates */}
      {activeRateTypes.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white mb-4">Labour Rates</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2d4a]">
                  <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Role</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-semibold">Standard</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-semibold">Overtime</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-semibold">Weekend</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-semibold">Night</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {activeRateTypes.map(rt => {
                  const rate = labourRates.find(r => r.rate_type_id === rt.id);
                  return (
                    <tr key={rt.id} className="hover:bg-[#0d1628]/50 transition-colors">
                      <td className="py-2 pr-4 text-slate-300 font-medium whitespace-nowrap">{rt.name}</td>
                      {(['standard_rate','overtime_rate','weekend_rate','night_rate'] as const).map(f => (
                        <td key={f} className="py-1 px-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-xs">£</span>
                            <input
                              type="number"
                              className="w-20 bg-[#0d1628] border border-[#1e2d4a] rounded px-2 pl-5 py-1 text-xs text-white text-right focus:outline-none focus:border-[#f97316] transition-colors"
                              value={rate?.[f] ?? ''}
                              onChange={e => updateRate(rt.id, f, e.target.value)}
                              disabled={!canEdit}
                              placeholder="0.00"
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              saved ? 'bg-emerald-600 text-white' : 'bg-[#f97316] hover:bg-orange-400 text-white'
            }`}
          >
            {saved ? <><Check size={14} /> Saved</> : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: PQQ ────────────────────────────────────────────────────────────────

function PqqTab({
  supplier,
  pqqResponses,
  orgId,
  canEdit,
  currentUserName,
  onResponsesChange,
}: {
  supplier: DBSupplier;
  pqqResponses: DBSupplierPqqResponse[];
  orgId: string;
  canEdit: boolean;
  currentUserName: string;
  onResponsesChange: (responses: DBSupplierPqqResponse[]) => void;
}) {
  const [openSection, setOpenSection] = useState<string | null>(PQQ_SECTIONS[0].key);

  function getResponse(sectionKey: string): DBSupplierPqqResponse {
    return pqqResponses.find(r => r.section_key === sectionKey) ?? {
      id: genId(),
      supplier_id: supplier.id,
      org_id: orgId,
      section_key: sectionKey,
      responses: {},
      section_status: 'not_started',
      notes: '',
      completed_at: null,
      completed_by: '',
    };
  }

  function updateField(sectionKey: string, fieldId: string, value: unknown) {
    const resp = getResponse(sectionKey);
    const updated: DBSupplierPqqResponse = {
      ...resp,
      responses: { ...resp.responses, [fieldId]: value },
      section_status: resp.section_status === 'not_started' ? 'in_progress' : resp.section_status,
      updated_at: new Date().toISOString(),
    };
    const without = pqqResponses.filter(r => r.section_key !== sectionKey);
    onResponsesChange([...without, updated]);
  }

  function markComplete(sectionKey: string, complete: boolean) {
    const resp = getResponse(sectionKey);
    const updated: DBSupplierPqqResponse = {
      ...resp,
      section_status: complete ? 'complete' : 'in_progress',
      completed_at: complete ? new Date().toISOString() : null,
      completed_by: complete ? currentUserName : '',
    };
    const without = pqqResponses.filter(r => r.section_key !== sectionKey);
    onResponsesChange([...without, updated]);
  }

  function updateNotes(sectionKey: string, notes: string) {
    const resp = getResponse(sectionKey);
    const updated = { ...resp, notes };
    const without = pqqResponses.filter(r => r.section_key !== sectionKey);
    onResponsesChange([...without, updated]);
  }

  const pqqComplete = pqqResponses.filter(r => r.section_status === 'complete').length;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white">Overall Progress</span>
          <span className="text-xs text-slate-400">{pqqComplete} of {PQQ_SECTIONS.length} sections complete</span>
        </div>
        <div className="w-full bg-[#1e2d4a] rounded-full h-2">
          <div className="h-2 rounded-full bg-[#f97316] transition-all" style={{ width: `${(pqqComplete / PQQ_SECTIONS.length) * 100}%` }} />
        </div>
      </div>

      {/* Sections */}
      {PQQ_SECTIONS.map(section => {
        const resp = getResponse(section.key);
        const isOpen = openSection === section.key;
        const status = resp.section_status;

        return (
          <div key={section.key} className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenSection(isOpen ? null : section.key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#111827]/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  status === 'complete' ? 'bg-emerald-400' :
                  status === 'in_progress' ? 'bg-amber-400' :
                  'bg-slate-700'
                }`} />
                <span className="text-sm font-semibold text-white">{section.title}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  status === 'complete' ? 'bg-emerald-900/40 text-emerald-400' :
                  status === 'in_progress' ? 'bg-amber-900/40 text-amber-400' :
                  'bg-slate-800 text-slate-600'
                }`}>
                  {status === 'not_started' ? 'Not Started' : status === 'in_progress' ? 'In Progress' : 'Complete'}
                </span>
              </div>
              {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-[#1e2d4a]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                  {section.fields.map(field => {
                    const val = resp.responses[field.id];
                    return (
                      <div key={field.id} className={field.type === 'text' && field.id.includes('notes') ? 'sm:col-span-2' : ''}>
                        <label className={labelCls}>{field.label}</label>
                        {field.type === 'yesno' && (
                          <div className="flex gap-2">
                            {['Yes', 'No'].map(opt => (
                              <button key={opt} onClick={() => canEdit && updateField(section.key, field.id, opt)}
                                className={`px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                  val === opt ? (opt === 'Yes' ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400' : 'bg-red-900/40 border-red-700 text-red-400')
                                  : 'bg-[#111827] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                                } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                              >{opt}</button>
                            ))}
                          </div>
                        )}
                        {field.type === 'yesnona' && (
                          <div className="flex gap-2">
                            {['Yes', 'No', 'N/A'].map(opt => (
                              <button key={opt} onClick={() => canEdit && updateField(section.key, field.id, opt)}
                                className={`px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                  val === opt ? (opt === 'Yes' ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400' : opt === 'No' ? 'bg-red-900/40 border-red-700 text-red-400' : 'bg-slate-800 border-slate-600 text-slate-400')
                                  : 'bg-[#111827] border-[#1e2d4a] text-slate-500 hover:border-slate-500'
                                } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                              >{opt}</button>
                            ))}
                          </div>
                        )}
                        {field.type === 'text' && (
                          <input className={inputCls} value={(val as string) ?? ''} onChange={e => canEdit && updateField(section.key, field.id, e.target.value)} disabled={!canEdit} />
                        )}
                        {field.type === 'date' && (
                          <input type="date" className={inputCls} value={(val as string) ?? ''} onChange={e => canEdit && updateField(section.key, field.id, e.target.value)} disabled={!canEdit} />
                        )}
                        {field.type === 'number' && (
                          <input type="number" className={inputCls} value={(val as string) ?? ''} onChange={e => canEdit && updateField(section.key, field.id, e.target.value)} disabled={!canEdit} placeholder="0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Section notes */}
                <div>
                  <label className={labelCls}>Section Notes</label>
                  <textarea
                    rows={2}
                    className={`${inputCls} resize-none`}
                    value={resp.notes}
                    onChange={e => canEdit && updateNotes(section.key, e.target.value)}
                    disabled={!canEdit}
                    placeholder="Any additional notes for this section…"
                  />
                </div>

                {canEdit && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => markComplete(section.key, status !== 'complete')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        status === 'complete'
                          ? 'bg-emerald-900/40 border border-emerald-700 text-emerald-400 hover:bg-emerald-900/60'
                          : 'bg-[#f97316] hover:bg-orange-400 text-white'
                      }`}
                    >
                      {status === 'complete' ? <><CheckCircle2 size={13} /> Marked Complete — Click to Reopen</> : 'Mark Section Complete'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Documents ───────────────────────────────────────────────────────────

function DocumentsTab({
  supplier,
  documents,
  orgId,
  canEdit,
  currentUserName,
  onDocumentsChange,
}: {
  supplier: DBSupplier;
  documents: DBSupplierDocument[];
  orgId: string;
  canEdit: boolean;
  currentUserName: string;
  onDocumentsChange: (docs: DBSupplierDocument[]) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [filterCat, setFilterCat] = useState('All');
  const [preview, setPreview] = useState<DBSupplierDocument | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    document_title: '',
    document_category: 'Other',
    issue_date: '',
    expiry_date: '',
    verified: false,
    verified_by: '',
    verification_date: '',
    notes: '',
    file_name: '',
    file_type: '',
    file_size: null as number | null,
    data_url: '',
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setForm(f => ({
        ...f,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        data_url: ev.target?.result as string,
        document_title: f.document_title || file.name.replace(/\.[^.]+$/, ''),
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleAdd() {
    if (!form.document_title.trim()) return;
    const doc: DBSupplierDocument = {
      id: genId(),
      supplier_id: supplier.id,
      org_id: orgId,
      ...form,
      created_by: currentUserName,
    };
    onDocumentsChange([doc, ...documents]);
    setForm({ document_title: '', document_category: 'Other', issue_date: '', expiry_date: '', verified: false, verified_by: '', verification_date: '', notes: '', file_name: '', file_type: '', file_size: null, data_url: '' });
    setShowAdd(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const filtered = filterCat === 'All' ? documents : documents.filter(d => d.document_category === filterCat);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <select className="bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#f97316]" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option>All</option>
            {DOCUMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(s => !s)} className="flex items-center gap-1.5 px-3 py-2 bg-[#f97316] hover:bg-orange-400 text-white rounded-lg text-xs font-bold transition-colors">
            <Plus size={13} /> Add Document
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#0d1628] border border-[#1e2d4a] rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-white">Add Document</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Document Title *</label>
              <input className={inputCls} value={form.document_title} onChange={e => setForm(f => ({ ...f, document_title: e.target.value }))} placeholder="e.g. Public Liability Insurance 2026" />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={form.document_category} onChange={e => setForm(f => ({ ...f, document_category: e.target.value }))}>
                {DOCUMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" className={inputCls} value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" className={inputCls} value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>File Attachment</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#1e2d4a] hover:border-[#f97316] rounded-xl p-4 text-center cursor-pointer transition-colors"
              >
                {form.file_name ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
                    <FileText size={16} className="text-[#f97316]" />
                    <span>{form.file_name}</span>
                    {form.file_size && <span className="text-slate-500 text-xs">({fmtSize(form.file_size)})</span>}
                  </div>
                ) : (
                  <>
                    <Upload size={18} className="mx-auto mb-1 text-slate-600" />
                    <p className="text-xs text-slate-500">Click to select a file</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={!form.document_title.trim()} className="px-5 py-2 bg-[#f97316] hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors">
              Add Document
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-600">
          <Paperclip size={28} className="mx-auto mb-3" />
          <p className="text-sm">No documents yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const expired = doc.expiry_date && isExpired(doc.expiry_date);
            const expiring = doc.expiry_date && !expired && isExpiringSoon(doc.expiry_date);
            return (
              <div key={doc.id} className={`flex items-start gap-3 bg-[#0d1628] border rounded-xl px-4 py-3 transition-colors ${
                expired ? 'border-red-800/60' : expiring ? 'border-amber-800/60' : 'border-[#1e2d4a]'
              }`}>
                <div className="w-8 h-8 rounded-lg bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0 mt-0.5">
                  <FileText size={14} className={expired ? 'text-red-400' : expiring ? 'text-amber-400' : 'text-slate-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate flex-1">{doc.document_title}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#1a2236] border border-[#1e2d4a] rounded-full text-slate-400 shrink-0">{doc.document_category}</span>
                    {doc.verified && <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-900/30 border border-emerald-800 rounded-full text-emerald-400 shrink-0">Verified</span>}
                    {expired && <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-900/30 border border-red-800 rounded-full text-red-400 shrink-0">Expired</span>}
                    {expiring && <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-900/30 border border-amber-800 rounded-full text-amber-400 shrink-0">Expiring Soon</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {doc.issue_date && <span className="text-[10px] text-slate-600">Issued {fmtDate(doc.issue_date)}</span>}
                    {doc.expiry_date && <span className={`text-[10px] ${expired ? 'text-red-400' : expiring ? 'text-amber-400' : 'text-slate-600'}`}>Expires {fmtDate(doc.expiry_date)}</span>}
                    {doc.file_name && <span className="text-[10px] text-slate-600">{doc.file_name}</span>}
                  </div>
                  {doc.notes && <p className="text-xs text-slate-500 mt-1">{doc.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.data_url && (
                    <button onClick={() => setPreview(doc)} className="p-1.5 text-slate-500 hover:text-white transition-colors"><Eye size={13} /></button>
                  )}
                  {doc.data_url && (
                    <a href={doc.data_url} download={doc.file_name || doc.document_title} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                      <Download size={13} />
                    </a>
                  )}
                  {canEdit && (
                    confirmDelete === doc.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { onDocumentsChange(documents.filter(d => d.id !== doc.id)); setConfirmDelete(null); }} className="px-2 py-1 bg-red-900/40 text-red-400 border border-red-800 rounded text-[10px] font-semibold">Delete</button>
                        <button onClick={() => setConfirmDelete(null)} className="p-1 text-slate-500"><X size={11} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(doc.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white">{preview.document_title}</p>
            <div className="flex items-center gap-2">
              <a href={preview.data_url} download={preview.file_name} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold">
                <Download size={13} /> Download
              </a>
              <button onClick={() => setPreview(null)} className="p-1.5 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {preview.file_type?.startsWith('image/') ? (
              <img src={preview.data_url} alt={preview.document_title} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : preview.file_type === 'application/pdf' ? (
              <iframe src={preview.data_url} title={preview.document_title} className="w-full h-full rounded-lg border-0" />
            ) : (
              <div className="text-center">
                <FileText size={40} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-4">{preview.file_name}</p>
                <a href={preview.data_url} download={preview.file_name} className="inline-flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold">
                  <Download size={14} /> Download
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main SupplierDetail component ────────────────────────────────────────────

interface SupplierDetailProps {
  supplier: DBSupplier;
  onClose: () => void;
  onUpdate: (s: DBSupplier) => void;
}

export default function SupplierDetail({ supplier, onClose, onUpdate }: SupplierDetailProps) {
  const store = useAppStore();
  const perms = usePermissions();
  const canEdit = perms['supply_chain.create_edit'] ?? false;

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [localSupplier, setLocalSupplier] = useState(supplier);

  // Detail data — loaded on mount, not in global store
  const [tradeLinks, setTradeLinks] = useState<DBSupplierTradeLink[]>([]);
  const [specialismLinks, setSpecialismLinks] = useState<DBSupplierSpecialismLink[]>([]);
  const [labourRates, setLabourRates] = useState<DBSupplierLabourRate[]>([]);
  const [pqqResponses, setPqqResponses] = useState<DBSupplierPqqResponse[]>([]);
  const [documents, setDocuments] = useState<DBSupplierDocument[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);

  const [notesDraft, setNotesDraft] = useState(supplier.notes);
  const [notesSaved, setNotesSaved] = useState(false);
  const [showPqqMenu, setShowPqqMenu] = useState(false);
  const [showUploadPqq, setShowUploadPqq] = useState(false);
  const [importMeta, setImportMeta] = useState<PqqImportMeta | null>(
    (supplier.pqq_import_raw as PqqImportMeta | null) ?? null
  );

  const orgId = store.currentOrgId ?? '';
  const currentUserName = store.currentUser?.name ?? '';

  // Load detail data
  useEffect(() => {
    setDetailLoading(true);
    const id = supplier.id;
    Promise.all([
      supabase.from('vy_supplier_trade_links').select('*').eq('supplier_id', id),
      supabase.from('vy_supplier_specialism_links').select('*').eq('supplier_id', id),
      supabase.from('vy_supplier_labour_rates').select('*').eq('supplier_id', id),
      supabase.from('vy_supplier_pqq_responses').select('*').eq('supplier_id', id),
      supabase.from('vy_supplier_documents').select('*').eq('supplier_id', id).order('created_at', { ascending: false }),
    ]).then(([tl, sl, lr, pqq, docs]) => {
      setTradeLinks((tl.data ?? []) as DBSupplierTradeLink[]);
      setSpecialismLinks((sl.data ?? []) as DBSupplierSpecialismLink[]);
      setLabourRates((lr.data ?? []) as DBSupplierLabourRate[]);
      setPqqResponses((pqq.data ?? []) as DBSupplierPqqResponse[]);
      setDocuments((docs.data ?? []) as DBSupplierDocument[]);
      setDetailLoading(false);
    });
  }, [supplier.id]);

  // Persist supplier changes
  async function handleSaveSupplier(updated: DBSupplier) {
    setLocalSupplier(updated);
    onUpdate(updated);
    await supabase.from('vy_suppliers').upsert({ ...updated, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  }

  // Persist trade links
  async function handleTradeLinksChange(links: DBSupplierTradeLink[]) {
    setTradeLinks(links);
    await supabase.from('vy_supplier_trade_links').delete().eq('supplier_id', supplier.id);
    if (links.length > 0) await supabase.from('vy_supplier_trade_links').insert(links);
  }

  // Persist specialism links
  async function handleSpecialismLinksChange(links: DBSupplierSpecialismLink[]) {
    setSpecialismLinks(links);
    await supabase.from('vy_supplier_specialism_links').delete().eq('supplier_id', supplier.id);
    if (links.length > 0) await supabase.from('vy_supplier_specialism_links').insert(links);
  }

  // Persist labour rates
  async function handleLabourRatesChange(rates: DBSupplierLabourRate[]) {
    setLabourRates(rates);
    for (const rate of rates) {
      await supabase.from('vy_supplier_labour_rates').upsert({ ...rate, updated_at: new Date().toISOString() }, { onConflict: 'supplier_id,rate_type_id' });
    }
  }

  // Persist PQQ responses
  async function handlePqqResponsesChange(responses: DBSupplierPqqResponse[]) {
    setPqqResponses(responses);
    // Compute pqq_status
    const complete = responses.filter(r => r.section_status === 'complete').length;
    const pqqStatus = complete === 0 ? 'Not Started' : complete < PQQ_SECTIONS.length ? 'In Progress' : 'Complete';
    const updatedSupplier = { ...localSupplier, pqq_status: pqqStatus };
    if (pqqStatus !== localSupplier.pqq_status) {
      setLocalSupplier(updatedSupplier);
      onUpdate(updatedSupplier);
      await supabase.from('vy_suppliers').update({ pqq_status: pqqStatus, updated_at: new Date().toISOString() }).eq('id', supplier.id);
    }
    // Save only the changed response
    const latest = responses[responses.length - 1];
    if (latest) {
      await supabase.from('vy_supplier_pqq_responses').upsert({ ...latest, updated_at: new Date().toISOString() }, { onConflict: 'supplier_id,section_key' });
    }
  }

  // Persist documents
  async function handleDocumentsChange(docs: DBSupplierDocument[]) {
    const prevIds = new Set(documents.map(d => d.id));
    const newIds = new Set(docs.map(d => d.id));
    const added = docs.filter(d => !prevIds.has(d.id));
    const removed = [...prevIds].filter(id => !newIds.has(id));
    setDocuments(docs);
    for (const doc of added) await supabase.from('vy_supplier_documents').insert(doc);
    for (const id of removed) await supabase.from('vy_supplier_documents').delete().eq('id', id);
  }

  // Save notes
  async function handleSaveNotes() {
    const updated = { ...localSupplier, notes: notesDraft };
    setLocalSupplier(updated);
    onUpdate(updated);
    await supabase.from('vy_suppliers').update({ notes: notesDraft, updated_at: new Date().toISOString() }).eq('id', supplier.id);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  // Handle PQQ upload completion
  function handlePqqUploaded(doc: DBSupplierDocument, meta: PqqImportMeta, updatedSupplier: DBSupplier) {
    setDocuments(prev => [doc, ...prev]);
    setImportMeta(meta);
    setLocalSupplier(updatedSupplier);
    onUpdate(updatedSupplier);
  }

  // Export: Supplier Summary PDF
  function handleExportSummary() {
    const tradeNames = tradeLinks
      .map(l => store.supplierTrades.find(t => t.id === l.trade_id)?.name)
      .filter(Boolean) as string[];
    const specialismNames = specialismLinks
      .map(l => store.supplierSpecialisms.find(s => s.id === l.specialism_id)?.name)
      .filter(Boolean) as string[];
    const rateTypeNames = new Map(store.supplierLabourRateTypes.map(rt => [rt.id, rt.name]));
    exportSupplierSummaryPdf({
      supplier: localSupplier,
      tradeNames,
      specialismNames,
      labourRates,
      rateTypeNames,
      pqqResponses,
      documents,
    });
  }

  // Export: PQQ Template
  function handlePqqTemplate(format: 'pdf' | 'word') {
    const tradeNames = tradeLinks
      .map(l => store.supplierTrades.find(t => t.id === l.trade_id)?.name)
      .filter(Boolean) as string[];
    const specialismNames = specialismLinks
      .map(l => store.supplierSpecialisms.find(s => s.id === l.specialism_id)?.name)
      .filter(Boolean) as string[];
    const rateTypeNames = new Map(store.supplierLabourRateTypes.map(rt => [rt.id, rt.name]));
    const data = { supplier: localSupplier, pqqResponses, tradeNames, specialismNames, rateTypeNames, labourRates };
    if (format === 'pdf') downloadPqqPdf(data);
    else downloadPqqWord(data);
    setShowPqqMenu(false);
  }

  const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',   label: 'Overview',         icon: <Building2 size={13} /> },
    { id: 'company',    label: 'Company',           icon: <Network size={13} /> },
    { id: 'trades',     label: 'Trades & Coverage', icon: <Tag size={13} /> },
    { id: 'pqq',        label: 'PQQ',               icon: <ClipboardList size={13} /> },
    { id: 'documents',  label: 'Documents',         icon: <FileCheck size={13} /> },
    { id: 'notes',      label: 'Notes',             icon: <StickyNote size={13} /> },
  ];

  const pqqBadge = pqqResponses.filter(r => r.section_status === 'complete').length;
  const docAlert = documents.filter(d => d.expiry_date && (isExpiringSoon(d.expiry_date) || isExpired(d.expiry_date))).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111827]">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-[#1e2d4a] bg-[#0d1628] shrink-0">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight">{localSupplier.company_name}</h1>
            {localSupplier.trading_name && localSupplier.trading_name !== localSupplier.company_name && (
              <p className="text-xs text-slate-500 mt-0.5">t/a {localSupplier.trading_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${APPROVAL_COLORS[localSupplier.approval_status] ?? APPROVAL_COLORS['Pending']}`}>
                {localSupplier.approval_status}
              </span>
              {localSupplier.preferred_supplier && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-800 text-amber-400 flex items-center gap-1">
                  <Star size={9} fill="currentColor" /> Preferred
                </span>
              )}
              {localSupplier.supplier_type && (
                <span className="text-[10px] text-slate-500">{localSupplier.supplier_type}</span>
              )}
            </div>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Export Supplier Pack */}
          <button
            onClick={handleExportSummary}
            title="Export Supplier Pack"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1a2236] border border-[#1e2d4a] hover:border-[#f97316] text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <FileDown size={13} /> <span className="hidden sm:inline">Export Supplier Pack</span>
          </button>

          {/* Download PQQ Template dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPqqMenu(o => !o)}
              title="Download PQQ Template"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1a2236] border border-[#1e2d4a] hover:border-[#f97316] text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <ClipboardCheck size={13} /> <span className="hidden sm:inline">Download PQQ Template</span>
              <ChevronDown size={11} />
            </button>
            {showPqqMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowPqqMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-2xl z-30 py-1">
                  <button
                    onClick={() => handlePqqTemplate('pdf')}
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-[#0d1628] transition-colors flex items-center gap-2"
                  >
                    <FileText size={12} className="text-red-400" /> Download as PDF
                  </button>
                  <button
                    onClick={() => handlePqqTemplate('word')}
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-[#0d1628] transition-colors flex items-center gap-2"
                  >
                    <FileText size={12} className="text-blue-400" /> Download as Word
                  </button>
                  <div className="border-t border-[#1e2d4a] my-1" />
                  <button
                    onClick={() => { setShowPqqMenu(false); setShowUploadPqq(true); }}
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-[#0d1628] transition-colors flex items-center gap-2"
                  >
                    <Upload size={12} className="text-emerald-400" /> Upload Completed PQQ
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-[#1a2236] rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-0.5 px-6 pt-3 border-b border-[#1e2d4a] bg-[#0d1628] shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
              activeTab === t.id
                ? 'text-[#f97316] border-[#f97316] bg-[#1a2236]/50'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-[#1a2236]/30'
            }`}
          >
            {t.icon} {t.label}
            {t.id === 'pqq' && pqqBadge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#f97316]/20 text-[#f97316] text-[9px] font-bold rounded-full">{pqqBadge}</span>
            )}
            {t.id === 'documents' && docAlert > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-900/40 text-red-400 text-[9px] font-bold rounded-full">{docAlert}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {detailLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500 text-sm">Loading…</div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-6 py-6">
            {activeTab === 'overview' && (
              <OverviewTab
                supplier={localSupplier}
                tradeLinks={tradeLinks}
                specialismLinks={specialismLinks}
                documents={documents}
                pqqResponses={pqqResponses}
                trades={store.supplierTrades}
                specialisms={store.supplierSpecialisms}
                canEdit={canEdit}
                onChangeStatus={status => handleSaveSupplier({ ...localSupplier, approval_status: status })}
              />
            )}
            {activeTab === 'company' && (
              <CompanyTab supplier={localSupplier} canEdit={canEdit} onSave={handleSaveSupplier} />
            )}
            {activeTab === 'trades' && (
              <TradesCoverageTab
                supplier={localSupplier}
                tradeLinks={tradeLinks}
                specialismLinks={specialismLinks}
                labourRates={labourRates}
                rateTypes={store.supplierLabourRateTypes}
                trades={store.supplierTrades}
                specialisms={store.supplierSpecialisms}
                canEdit={canEdit}
                onSave={handleSaveSupplier}
                onTradeLinksChange={handleTradeLinksChange}
                onSpecialismLinksChange={handleSpecialismLinksChange}
                onLabourRatesChange={handleLabourRatesChange}
              />
            )}
            {activeTab === 'pqq' && (
              <div className="space-y-4">
                {/* Import status banner */}
                {importMeta && (
                  <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                    importMeta.import_status === 'pending_review'
                      ? 'bg-amber-900/20 border-amber-800/50'
                      : 'bg-emerald-900/20 border-emerald-800/50'
                  }`}>
                    <AlertCircle size={15} className={importMeta.import_status === 'pending_review' ? 'text-amber-400 shrink-0 mt-0.5' : 'text-emerald-400 shrink-0 mt-0.5'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${importMeta.import_status === 'pending_review' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {importMeta.import_status === 'pending_review' ? 'Completed PQQ Uploaded — Pending Review' : 'PQQ Import Reviewed'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {importMeta.document_name} · Uploaded by {importMeta.uploaded_by} · {new Date(importMeta.uploaded_at).toLocaleDateString('en-GB')}
                      </p>
                      {importMeta.import_note && <p className="text-xs text-slate-500 mt-0.5">{importMeta.import_note}</p>}
                    </div>
                    <button
                      onClick={() => setShowUploadPqq(true)}
                      className="text-[10px] text-slate-400 hover:text-white underline whitespace-nowrap"
                    >
                      Replace
                    </button>
                  </div>
                )}
                {!importMeta && (
                  <div className="flex items-center justify-between px-4 py-3 bg-[#0d1628] border border-[#1e2d4a] rounded-xl">
                    <div className="flex items-center gap-3">
                      <Upload size={14} className="text-slate-500" />
                      <div>
                        <p className="text-xs font-semibold text-slate-300">Have a completed PQQ to upload?</p>
                        <p className="text-xs text-slate-500">Upload a returned questionnaire to store it against this record.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUploadPqq(true)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2236] border border-[#1e2d4a] hover:border-[#f97316] text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Upload size={11} /> Upload Completed PQQ
                    </button>
                  </div>
                )}
                <PqqTab
                  supplier={localSupplier}
                  pqqResponses={pqqResponses}
                  orgId={orgId}
                  canEdit={canEdit}
                  currentUserName={currentUserName}
                  onResponsesChange={handlePqqResponsesChange}
                />
              </div>
            )}
            {activeTab === 'documents' && (
              <DocumentsTab
                supplier={localSupplier}
                documents={documents}
                orgId={orgId}
                canEdit={canEdit}
                currentUserName={currentUserName}
                onDocumentsChange={handleDocumentsChange}
              />
            )}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Internal Notes</h3>
                  <p className="text-xs text-slate-500 mb-3">Notes are visible only to your team and are not included in any supplier communication.</p>
                  <textarea
                    rows={10}
                    className={`${inputCls} resize-none`}
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Internal notes about this supplier…"
                  />
                </div>
                {canEdit && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveNotes}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        notesSaved ? 'bg-emerald-600 text-white' : 'bg-[#f97316] hover:bg-orange-400 text-white'
                      }`}
                    >
                      {notesSaved ? <><Check size={14} /> Saved</> : 'Save Notes'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Completed PQQ modal */}
      {showUploadPqq && (
        <UploadPqqModal
          supplier={localSupplier}
          orgId={orgId}
          currentUserName={currentUserName}
          onClose={() => setShowUploadPqq(false)}
          onUploaded={handlePqqUploaded}
        />
      )}
    </div>
  );
}
