import { useState, useRef, useEffect, type FormEvent } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface Org {
  id: string;
  name: string;
  slug: string;
  user_count?: number;
}

interface Props {
  org: Org;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteOrgModal({ org, onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when modal opens
    setTimeout(() => inputRef.current?.focus(), 50);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isMatch = typed === org.name;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isMatch) onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-[#0d1628] border border-red-900/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-[#1e2d4a]">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-red-900/30 border border-red-800/40 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">Permanently delete organisation</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This will <span className="text-red-400 font-semibold">permanently delete all data</span> for{' '}
                <span className="text-white font-semibold">{org.name}</span> including all projects, tenders,
                users, and records. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats warning */}
        {(org.user_count ?? 0) > 0 && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 rounded-lg bg-red-900/20 border border-red-800/40">
            <p className="text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle size={12} className="shrink-0" />
              This organisation has <strong className="text-red-200">{org.user_count} active user{org.user_count !== 1 ? 's' : ''}</strong> who will lose all access.
            </p>
          </div>
        )}

        {/* Confirmation form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Type the organisation name to confirm
            </label>
            <div className="text-sm text-slate-300 font-mono bg-[#1a2236] border border-[#1e2d4a] rounded-lg px-3 py-2 mb-3 select-all">
              {org.name}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={`Type "${org.name}" to confirm`}
              autoComplete="off"
              spellCheck={false}
              className={`w-full bg-[#1a2236] border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors ${
                typed.length > 0
                  ? isMatch
                    ? 'border-red-600 focus:border-red-500'
                    : 'border-[#1e2d4a] focus:border-slate-500'
                  : 'border-[#1e2d4a] focus:border-slate-500'
              }`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#1e2d4a] text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-900/40 disabled:text-red-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
            >
              <Trash2 size={14} />
              Delete Permanently
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
