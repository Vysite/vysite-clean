import React, { useState } from 'react';
import { FileImage, Ruler, Calculator, ClipboardList } from 'lucide-react';
import type { Tender } from '../../data/types';
import TenderDrawingsTab from './TenderDrawingsTab';
import TakeoffSchedule from './TakeoffSchedule';

interface EstimatingTabProps {
  tender: Tender;
  onUpdate: (t: Tender) => void;
}

type EstSubTab = 'Drawings' | 'Take-Off' | 'Estimate' | 'Summary';

const SUB_TABS: { key: EstSubTab; label: string; icon: typeof FileImage }[] = [
  { key: 'Drawings', label: 'Drawings', icon: FileImage },
  { key: 'Take-Off', label: 'Take-Off', icon: Ruler },
  { key: 'Estimate', label: 'Estimate', icon: Calculator },
  { key: 'Summary', label: 'Summary', icon: ClipboardList },
];

function PlaceholderPanel({ title, description, icon: Icon }: { title: string; description: string; icon: typeof FileImage }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#0d1628] border border-[#1e2d4a] flex items-center justify-center mb-4">
        <Icon size={26} className="text-slate-600" />
      </div>
      <p className="text-sm font-semibold text-slate-300 mb-1.5">{title}</p>
      <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{description}</p>
    </div>
  );
}

export default function EstimatingWorkspace({ tender, onUpdate, EstimatingTab }: EstimatingTabProps & { EstimatingTab: React.ComponentType<EstimatingTabProps> }) {
  const [subTab, setSubTab] = useState<EstSubTab>('Estimate');

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-[#0d1628] rounded-lg p-1 border border-[#1e2d4a]">
        {SUB_TABS.map(({ key, label, icon: Icon }) => {
          const isActive = subTab === key;
          return (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                isActive ? 'bg-[#f97316] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {subTab === 'Drawings' && (
        <TenderDrawingsTab tenderId={tender.id} tenderName={tender.name} />
      )}

      {subTab === 'Take-Off' && (
        <TakeoffSchedule tenderId={tender.id} tenderName={tender.name} tenderRef={tender.ref} tenderClient={tender.client} tenderLocation={tender.location} tender={tender} onUpdate={onUpdate} />
      )}

      {subTab === 'Estimate' && (
        <EstimatingTab tender={tender} onUpdate={onUpdate} />
      )}

      {subTab === 'Summary' && (
        <PlaceholderPanel
          title="Summary"
          description="A consolidated summary of Drawings, Take-Off, and Estimate data will be available here once configured. This workspace is not yet set up."
          icon={ClipboardList}
        />
      )}
    </div>
  );
}
