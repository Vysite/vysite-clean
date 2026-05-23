import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../lib/StoreContext';
import type { DBNotification } from '../lib/store';

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (val: string, mentionedUserIds: string[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  linkedType: string;
  linkedId: string;
  projectId: string;
  projectName: string;
}

function renderWithMentions(text: string) {
  const parts = text.split(/(@\w[\w\s]*)/g);
  return parts.map((part, i) =>
    /^@\w/.test(part)
      ? <span key={i} className="text-[#f97316] font-semibold bg-orange-950/40 px-0.5 rounded">{part}</span>
      : <span key={i}>{part}</span>
  );
}

export { renderWithMentions };

export default function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder = 'Add a comment... Use @name to mention someone',
  rows = 2,
  className = '',
  linkedType,
  linkedId,
  projectId,
  projectName,
}: MentionTextareaProps) {
  const store = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);

  const activeUsers = store.platformUsers.filter(u => u.status === 'Active');

  const matchedUsers = mentionSearch.length >= 0
    ? activeUsers.filter(u =>
        u.name.toLowerCase().includes(mentionSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const cursor = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursor);
    const atMatch = beforeCursor.match(/@(\w[\w\s]*)$/);
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
      // Position dropdown near cursor
      const ta = textareaRef.current;
      if (ta) {
        setMentionPos({ top: ta.offsetTop + ta.offsetHeight + 4, left: ta.offsetLeft });
      }
    } else {
      setMentionSearch('');
      setMentionPos(null);
      setMentionStart(-1);
    }
  }, [onChange]);

  const insertMention = useCallback((name: string) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current?.selectionStart ?? mentionStart + mentionSearch.length + 1);
    const newVal = `${before}@${name} ${after}`;
    onChange(newVal);
    setMentionSearch('');
    setMentionPos(null);
    setMentionStart(-1);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = before.length + name.length + 2;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [value, mentionStart, mentionSearch, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionPos && matchedUsers.length > 0 && e.key === 'Escape') {
      setMentionSearch('');
      setMentionPos(null);
      setMentionStart(-1);
      e.preventDefault();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Find mentioned users — word-boundary safe: @Name must be followed by space, end, or punctuation
    const mentioned = activeUsers.filter(u => {
      const pattern = new RegExp(`@${u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s,.:!?]|$)`);
      return pattern.test(trimmed);
    });
    const mentionedIds = mentioned.map(u => u.id);

    // Create notifications for each mentioned user
    mentioned.forEach(async (u) => {
      const notif: DBNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        recipient_id: u.id,
        type: 'mention',
        title: `You were mentioned in a ${linkedType}`,
        body: trimmed.slice(0, 120),
        linked_type: linkedType,
        linked_id: linkedId,
        project_id: projectId,
        project_name: projectName,
        read: false,
        created_at: new Date().toISOString(),
      };
      await store.addNotification(notif);
    });

    onSubmit(trimmed, mentionedIds);
    onChange('');
    setMentionSearch('');
    setMentionPos(null);
    setMentionStart(-1);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={`w-full bg-[#0d1628] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#f97316] placeholder:text-slate-600 resize-none ${className}`}
      />

      {/* Mention dropdown */}
      {mentionPos && matchedUsers.length > 0 && (
        <div
          className="absolute z-50 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-2xl overflow-hidden min-w-[200px]"
          style={{ top: mentionPos.top, left: mentionPos.left }}
        >
          {matchedUsers.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(u.name); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#0d1628] transition-colors ${i > 0 ? 'border-t border-[#1e2d4a]' : ''}`}
            >
              <div className="w-6 h-6 rounded-full bg-[#f97316] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {u.avatar_initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{u.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{u.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-slate-600">Ctrl+Enter to post · @name to mention</p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Post
        </button>
      </div>
    </div>
  );
}
