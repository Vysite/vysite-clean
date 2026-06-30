import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

interface Props {
  actions: RowAction[];
  /** Extra classes on the trigger button */
  className?: string;
}

export function RowActionsMenu({ actions, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const visible = actions.filter(a => a !== null && a !== undefined);
  if (visible.length === 0) return null;

  return (
    <div ref={ref} className={`relative ${className}`} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(p => !p)}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-[#0d1628] transition-colors"
        title="Actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-xl shadow-black/40 py-1 min-w-[160px]">
          {visible.map((action, idx) => {
            const Icon = action.icon;
            return (
              <div key={idx}>
                {action.dividerBefore && idx > 0 && (
                  <div className="my-1 border-t border-[#1e2d4a]" />
                )}
                <button
                  onClick={() => { setOpen(false); action.onClick(); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                    action.danger
                      ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                      : 'text-slate-300 hover:bg-[#0d1628] hover:text-white'
                  }`}
                >
                  <Icon size={13} className="shrink-0" />
                  {action.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
