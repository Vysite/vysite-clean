import { GitBranch, Clock } from 'lucide-react';

export function VariationAccountPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#111827] border border-[#1e2d4a] flex items-center justify-center mb-5">
        <GitBranch size={22} className="text-[#f97316]" />
      </div>
      <h3 className="text-base font-bold text-white mb-2">Variation Account</h3>
      <p className="text-sm text-slate-400 max-w-md mb-1">
        Track value movements against the contract sum.
      </p>
      <p className="text-xs text-slate-500 max-w-md mb-6">
        Each entry records a variation — positive or negative — with status workflow and approval tracking.
        Drives Variation Exposure, Agreed Variations, Forecast Contract Sum and Adjusted Contract Sum.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a2236] border border-[#1e2d4a] text-xs text-slate-400">
        <Clock size={12} className="text-[#f97316]" />
        Coming in Phase 2b
      </div>
    </div>
  );
}

export function ApplicationsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#111827] border border-[#1e2d4a] flex items-center justify-center mb-5">
        <div className="text-[#f97316]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
      </div>
      <h3 className="text-base font-bold text-white mb-2">Applications</h3>
      <p className="text-sm text-slate-400 max-w-md mb-1">
        Track applications for payment, certified amounts and payments received.
      </p>
      <p className="text-xs text-slate-500 max-w-md mb-3">
        Applications will extend the commercial position statement with:
      </p>
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl px-6 py-4 mb-6 text-left min-w-[260px] font-mono text-xs space-y-1.5">
        <div className="flex justify-between text-slate-400"><span>Applied To Date</span><span>—</span></div>
        <div className="flex justify-between text-slate-400"><span>Certified To Date</span><span>—</span></div>
        <div className="flex justify-between text-slate-400"><span>Paid To Date</span><span>—</span></div>
        <div className="border-t border-[#1e2d4a] my-1" />
        <div className="flex justify-between text-slate-300 font-semibold"><span>Outstanding</span><span>—</span></div>
      </div>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a2236] border border-[#1e2d4a] text-xs text-slate-400">
        <Clock size={12} className="text-[#f97316]" />
        Coming in Phase 3
      </div>
    </div>
  );
}

export function CommercialTimelinePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#111827] border border-[#1e2d4a] flex items-center justify-center mb-5">
        <div className="text-[#f97316]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
      </div>
      <h3 className="text-base font-bold text-white mb-2">Commercial Timeline</h3>
      <p className="text-sm text-slate-400 max-w-md mb-1">
        Chronological commercial journey from contract award to present.
      </p>
      <p className="text-xs text-slate-500 max-w-md mb-4">
        Every commercial event — contract award, variation raised, variation agreed, application submitted — recorded in chronological order. Audit trail and final account support.
      </p>
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl px-6 py-4 mb-6 text-left min-w-[280px] text-xs space-y-3">
        {[
          { date: '01 Jun 2026', label: 'Contract Award',     color: 'text-[#f97316]' },
          { date: '05 Jun 2026', label: 'Variation Raised',   color: 'text-amber-400' },
          { date: '15 Jun 2026', label: 'Variation Agreed',   color: 'text-emerald-400' },
          { date: '30 Jun 2026', label: 'Application No.1 Submitted', color: 'text-sky-400' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shrink-0 bg-current ${item.color}`} />
            <span className="text-slate-500 tabular-nums w-24 shrink-0">{item.date}</span>
            <span className={`font-medium ${item.color}`}>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a2236] border border-[#1e2d4a] text-xs text-slate-400">
        <Clock size={12} className="text-[#f97316]" />
        Coming in Phase 2c
      </div>
    </div>
  );
}
