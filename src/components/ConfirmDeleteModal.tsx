import { Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({ title, description, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-[#1a2236] border border-[#1e2d4a] rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-900/40 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
            <button onClick={onCancel} className="ml-auto text-slate-600 hover:text-slate-400 transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-[#1e2d4a] rounded-lg text-xs font-semibold text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
