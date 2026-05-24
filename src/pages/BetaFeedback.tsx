import { useState, useRef } from 'react';
import { MessageSquare, Bug, Paperclip, Send, Info } from 'lucide-react';

function TextareaCard({
  title,
  description,
  icon: Icon,
  iconColor,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (text: string, file?: File | null) => void;
  allowAttachment?: boolean;
}) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
      <div className="p-5 border-b border-[#1e2d4a] flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-600">{text.length > 0 ? `${text.length} characters` : ''}</span>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              submitted
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 cursor-default'
                : text.trim()
                ? 'bg-[#f97316] hover:bg-orange-400 text-white'
                : 'bg-[#0d1628] text-slate-600 border border-[#1e2d4a] cursor-not-allowed'
            }`}
          >
            <Send size={12} />
            {submitted ? 'Submitted!' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function BugReportCard({
  onSubmit,
}: {
  onSubmit: (text: string, file?: File | null) => void;
}) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit(text.trim(), file);
    setText('');
    setFile(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a] overflow-hidden">
      <div className="p-5 border-b border-[#1e2d4a] flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-900/60 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
          <Bug size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Bug Reports</h3>
          <p className="text-xs text-slate-500 mt-0.5">Report unexpected behaviour, errors or broken features</p>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe the issue, bug or unexpected behaviour…"
          rows={5}
          className="w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-[#f97316] transition-colors resize-none"
        />

        {/* Attachment area */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 bg-[#0d1628] border border-[#1e2d4a] hover:border-slate-600 transition-colors"
          >
            <Paperclip size={12} />
            {file ? file.name : 'Attach screenshot or file (optional)'}
          </button>
          {file && (
            <button
              onClick={() => setFile(null)}
              className="ml-2 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-600">{text.length > 0 ? `${text.length} characters` : ''}</span>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              submitted
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 cursor-default'
                : text.trim()
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-[#0d1628] text-slate-600 border border-[#1e2d4a] cursor-not-allowed'
            }`}
          >
            <Send size={12} />
            {submitted ? 'Submitted!' : 'Submit Bug Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BetaFeedback() {
  function handleSuggestion(text: string) {
    console.log('[BETA] Feature suggestion:', text);
  }

  function handleBugReport(text: string, file?: File | null) {
    console.log('[BETA] Bug report:', text, file ?? 'no attachment');
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">BETA Feedback</h2>
        <p className="text-sm text-slate-500">Help improve VYSITE by reporting bugs, issues and feature suggestions.</p>
      </div>

      {/* Beta disclaimer banner */}
      <div className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10">
        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-300 leading-relaxed">
          This platform is currently in active beta development. Your feedback helps shape future improvements.
        </p>
      </div>

      {/* Feedback cards */}
      <div className="flex flex-col gap-5">
        <TextareaCard
          title="Feature Suggestions"
          description="Suggest improvements, workflows or new features you'd like to see"
          icon={MessageSquare}
          iconColor="bg-emerald-900/60 text-emerald-400"
          placeholder="Suggest improvements, workflows or new features…"
          submitLabel="Submit Suggestion"
          onSubmit={handleSuggestion}
        />

        <BugReportCard onSubmit={handleBugReport} />
      </div>
    </div>
  );
}
