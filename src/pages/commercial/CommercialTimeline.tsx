import { useMemo } from 'react';
import { Clock, GitBranch, FileText, TrendingUp, Printer } from 'lucide-react';
import type { CommercialRecord } from '../../data/types';
import type { DBVariationAccountItem } from '../../lib/store';
import type { Project } from './types';
import { fmtCurrency, fmtDate, typeInfo, statusInfo } from './types';
import { exportTimelinePDF } from './CommercialPDF';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventSource = 'Variation Account' | 'Commercial Register';
type EventKind =
  | 'va-raised'
  | 'va-agreed'
  | 'cr-added'
  | 'cr-submitted'
  | 'cr-agreed';

interface TimelineEvent {
  id: string;
  sortDate: string;
  displayDate: string;
  kind: EventKind;
  source: EventSource;
  reference: string;
  title: string;
  statusLabel?: string;
  statusColor?: string;
  value?: number;
  isPositive?: boolean;
  createdBy?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIND_META: Record<EventKind, { label: string; dotColor: string }> = {
  'va-raised':    { label: 'Variation Raised',   dotColor: 'bg-amber-400'    },
  'va-agreed':    { label: 'Variation Agreed',   dotColor: 'bg-emerald-400'  },
  'cr-added':     { label: 'Record Added',       dotColor: 'bg-[#f97316]'    },
  'cr-submitted': { label: 'Submitted',          dotColor: 'bg-sky-400'      },
  'cr-agreed':    { label: 'Agreed',             dotColor: 'bg-emerald-400'  },
};

const KIND_LABEL_COLOR: Record<EventKind, string> = {
  'va-raised':    'text-amber-400',
  'va-agreed':    'text-emerald-400',
  'cr-added':     'text-[#f97316]',
  'cr-submitted': 'text-sky-400',
  'cr-agreed':    'text-emerald-400',
};

function safeDate(d: string | null | undefined): string {
  return d ?? '';
}

function buildEvents(
  projectId: string,
  vaItems: DBVariationAccountItem[],
  allRecords: CommercialRecord[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // ── Variation Account events ──────────────────────────────────────────────
  for (const item of vaItems.filter(v => v.project_id === projectId)) {
    const raisedDate = safeDate(item.date_raised || item.created_at);
    if (raisedDate) {
      const si = statusInfo(item.status as Parameters<typeof statusInfo>[0]);
      events.push({
        id: `va-raised-${item.id}`,
        sortDate: raisedDate,
        displayDate: fmtDate(raisedDate),
        kind: 'va-raised',
        source: 'Variation Account',
        reference: item.reference,
        title: item.title,
        statusLabel: si.label,
        statusColor: si.color,
        value: item.value,
        isPositive: item.is_positive,
        createdBy: item.created_by,
      });
    }

    if (item.date_agreed && (item.status === 'agreed' || item.status === 'paid')) {
      events.push({
        id: `va-agreed-${item.id}`,
        sortDate: safeDate(item.date_agreed),
        displayDate: fmtDate(item.date_agreed),
        kind: 'va-agreed',
        source: 'Variation Account',
        reference: item.reference,
        title: item.title,
        value: item.value,
        isPositive: item.is_positive,
        createdBy: item.created_by,
      });
    }
  }

  // ── Commercial Register events ────────────────────────────────────────────
  const projectRecords = allRecords.filter(r => r.projectId === projectId);
  for (const rec of projectRecords) {
    const ti = typeInfo(rec.recordType);
    const si = statusInfo(rec.status);
    const addedDate = safeDate(rec.createdAt);
    if (addedDate) {
      events.push({
        id: `cr-added-${rec.id}`,
        sortDate: addedDate,
        displayDate: fmtDate(addedDate),
        kind: 'cr-added',
        source: 'Commercial Register',
        reference: rec.reference || ti.prefix,
        title: `${rec.title} — ${ti.label}`,
        statusLabel: si.label,
        statusColor: si.color,
        createdBy: rec.createdBy,
      });
    }

    if (rec.dateSubmitted) {
      events.push({
        id: `cr-submitted-${rec.id}`,
        sortDate: safeDate(rec.dateSubmitted),
        displayDate: fmtDate(rec.dateSubmitted),
        kind: 'cr-submitted',
        source: 'Commercial Register',
        reference: rec.reference,
        title: rec.title,
        createdBy: rec.createdBy,
      });
    }

    if (rec.dateAgreed && (rec.status === 'agreed' || rec.status === 'added_to_valuation' || rec.status === 'paid' || rec.status === 'complete')) {
      events.push({
        id: `cr-agreed-${rec.id}`,
        sortDate: safeDate(rec.dateAgreed),
        displayDate: fmtDate(rec.dateAgreed),
        kind: 'cr-agreed',
        source: 'Commercial Register',
        reference: rec.reference,
        title: rec.title,
        createdBy: rec.createdBy,
      });
    }
  }

  // Sort newest first; events with empty sortDate go last
  return events.sort((a, b) => {
    if (!a.sortDate && !b.sortDate) return 0;
    if (!a.sortDate) return 1;
    if (!b.sortDate) return -1;
    return b.sortDate.localeCompare(a.sortDate);
  });
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: EventSource }) {
  const isVA = source === 'Variation Account';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${
      isVA
        ? 'bg-amber-950/30 border-amber-800/40 text-amber-500/80'
        : 'bg-orange-950/30 border-orange-800/40 text-[#f97316]/80'
    }`}>
      {isVA ? <GitBranch size={9} /> : <FileText size={9} />}
      {source}
    </span>
  );
}

// ─── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const meta = KIND_META[event.kind];
  const labelColor = KIND_LABEL_COLOR[event.kind];

  return (
    <div className="flex gap-0">
      {/* Left: date column */}
      <div className="w-28 shrink-0 pt-0.5 pr-4 text-right">
        <span className="text-[11px] text-slate-500 tabular-nums leading-4">{event.displayDate || '—'}</span>
      </div>

      {/* Center: dot + line */}
      <div className="flex flex-col items-center w-5 shrink-0">
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${meta.dotColor}`} />
        {!isLast && <div className="w-px flex-1 bg-[#1e2d4a] mt-1 mb-0" />}
      </div>

      {/* Right: content */}
      <div className={`pl-3 pb-4 min-w-0 flex-1 ${isLast ? 'pb-0' : ''}`}>
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <span className={`text-xs font-semibold ${labelColor}`}>{meta.label}</span>
          {event.reference && (
            <span className="text-[11px] text-slate-400 font-mono">{event.reference}</span>
          )}
          <SourceBadge source={event.source} />
        </div>

        <p className="text-xs text-slate-300 leading-4 mb-1">{event.title}</p>

        <div className="flex flex-wrap items-center gap-2">
          {event.statusLabel && (
            <span className={`text-[10px] font-medium ${event.statusColor ?? 'text-slate-400'}`}>
              {event.statusLabel}
            </span>
          )}
          {event.value !== undefined && (
            <span className={`text-[10px] tabular-nums font-semibold ${
              event.isPositive !== false ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {event.isPositive !== false ? '+' : '-'}{fmtCurrency(event.value)}
            </span>
          )}
          {event.createdBy && (
            <span className="text-[10px] text-slate-600">{event.createdBy}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CommercialTimelineProps {
  project: Project | null;
  records: CommercialRecord[];
  variationItems: DBVariationAccountItem[];
  currentUserName?: string;
}

export default function CommercialTimeline({
  project,
  records,
  variationItems,
  currentUserName,
}: CommercialTimelineProps) {
  const events = useMemo(() => {
    if (!project) return [];
    return buildEvents(project.id, variationItems ?? [], records ?? []);
  }, [project, variationItems, records]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock size={28} className="text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">Select a project to view the timeline.</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp size={14} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-white">Commercial Timeline</h3>
        <span className="text-slate-600 text-xs">— {project.name}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-[#1a2236] border border-[#1e2d4a] text-slate-500">
          Read-only
        </span>
        {events.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#0d1628] border border-[#1e2d4a] text-slate-500 tabular-nums">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={() => exportTimelinePDF({ project, events, currentUserName: currentUserName || '' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-[#1e2d4a] hover:border-slate-600 rounded-lg transition-colors"
          title="Export Timeline PDF"
        >
          <Printer size={13} /> Export PDF
        </button>
      </div>

      {/* Legend */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5 pb-4 border-b border-[#1e2d4a]">
          {[
            { dot: 'bg-[#f97316]',    label: 'Register Record' },
            { dot: 'bg-sky-400',      label: 'Submitted'       },
            { dot: 'bg-amber-400',    label: 'VA Raised'       },
            { dot: 'bg-emerald-400',  label: 'Agreed'          },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#111827] border border-[#1e2d4a] flex items-center justify-center mb-3">
            <Clock size={16} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500 mb-1">No commercial events yet</p>
          <p className="text-xs text-slate-600">
            Events appear here as Variation Account records and Register entries are added.
          </p>
        </div>
      ) : (
        <div>
          {events.map((event, idx) => (
            <TimelineRow key={event.id} event={event} isLast={idx === events.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
