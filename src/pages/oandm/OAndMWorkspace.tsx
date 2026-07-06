import { useState, useMemo } from 'react';
import { BookOpen, Plus, Trash2, CreditCard as Edit2, Check, X, ChevronDown, Building2, LayoutList, AlertCircle, Eye } from 'lucide-react';
import { useAppStore } from '../../lib/StoreContext';
import type { DBOAndMManual } from './types';
import {
  STATUS_LABELS, STATUS_COLOURS, DEFAULT_SECTION_TITLES, genId,
} from './types';
import OAndMSectionEditor from './OAndMSectionEditor';
import OAndMPreview from './OAndMPreview';

const STATUS_OPTIONS: DBOAndMManual['status'][] = ['draft', 'in_progress', 'finalised'];

export default function OAndMWorkspace() {
  const store = useAppStore();
  const orgId = store.currentOrgId ?? '';
  const currentUserName = store.currentUser?.name ?? '';

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedManualId, setSelectedManualId] = useState<string | null>(null);
  const [showCreateManual, setShowCreateManual] = useState(false);
  const [newManualTitle, setNewManualTitle] = useState('O&M Manual');
  const [editingManual, setEditingManual] = useState<DBOAndMManual | null>(null);
  const [confirmDeleteManualId, setConfirmDeleteManualId] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAddSections, setShowAddSections] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Filter projects to those visible to this user
  const projects = store.visibleProjectIds
    ? store.projects.filter(p => store.visibleProjectIds!.includes(p.id))
    : store.projects;

  const projectManualsMap = useMemo(() => {
    const map: Record<string, typeof store.oAndMManuals> = {};
    for (const m of store.oAndMManuals) {
      if (!map[m.project_id]) map[m.project_id] = [];
      map[m.project_id].push(m);
    }
    return map;
  }, [store.oAndMManuals]);

  const manuals = selectedProjectId ? (projectManualsMap[selectedProjectId] ?? []) : [];
  const selectedManual = selectedManualId ? store.oAndMManuals.find(m => m.id === selectedManualId) ?? null : null;

  const manualSections = useMemo(
    () => store.oAndMSections.filter(s => s.manual_id === selectedManualId).sort((a, b) => a.sort_order - b.sort_order),
    [store.oAndMSections, selectedManualId],
  );
  const manualItems = useMemo(
    () => store.oAndMItems.filter(i => i.manual_id === selectedManualId),
    [store.oAndMItems, selectedManualId],
  );

  const totalItems = manualItems.length;
  const populatedSections = manualSections.filter(s => manualItems.some(i => i.section_id === s.id)).length;

  // ── Manual CRUD ──────────────────────────────────────────────────────────────

  const handleCreateManual = () => {
    const t = newManualTitle.trim();
    if (!t || !selectedProjectId) return;
    const manual: DBOAndMManual = {
      id: genId(),
      org_id: orgId,
      project_id: selectedProjectId,
      title: t,
      status: 'draft',
      version: '',
      notes: '',
      created_by: currentUserName,
    };
    store.addOAndMManual(manual);
    setSelectedManualId(manual.id);
    setShowCreateManual(false);
    setNewManualTitle('O&M Manual');
  };

  const handleDeleteManual = (id: string) => {
    if (selectedManualId === id) setSelectedManualId(null);
    store.removeOAndMManual(id);
    setConfirmDeleteManualId(null);
  };

  const saveManualEdit = () => {
    if (!editingManual) return;
    store.updateOAndMManual(editingManual);
    setEditingManual(null);
  };

  const setStatus = (status: DBOAndMManual['status']) => {
    if (!selectedManual) return;
    store.updateOAndMManual({ ...selectedManual, status });
    setShowStatusMenu(false);
  };

  const addDefaultSections = () => {
    if (!selectedManual) return;
    const existing = manualSections.map(s => s.title.toLowerCase());
    const toAdd = DEFAULT_SECTION_TITLES.filter(t => !existing.includes(t.toLowerCase()));
    toAdd.forEach((title, idx) => {
      store.addOAndMSection({
        id: genId(),
        manual_id: selectedManual.id,
        project_id: selectedManual.project_id,
        title,
        description: '',
        sort_order: manualSections.length + idx,
      });
    });
    setShowAddSections(false);
  };

  const isLoading = store.modulesLoading;

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center mx-auto mb-3">
            <BookOpen size={18} className="text-[#f97316]" />
          </div>
          <p className="text-sm text-slate-500">Loading O&M workspace…</p>
        </div>
      </div>
    );
  }

  // ── No project selected ───────────────────────────────────────────────────

  if (!selectedProjectId) {
    return (
      <div className="min-h-screen bg-[#0a1628] text-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
                <BookOpen size={15} className="text-[#f97316]" />
              </div>
              <h1 className="text-xl font-black tracking-tight text-white">O&M Manual</h1>
            </div>
            <p className="text-sm text-slate-500 ml-11">
              Select a project to open its O&M workspace.
            </p>
          </div>

          {/* Project grid */}
          {projects.length === 0 ? (
            <div className="text-center py-16">
              <Building2 size={28} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No projects found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.map(project => {
                const pManuals = projectManualsMap[project.id] ?? [];
                return (
                  <button
                    key={project.id}
                    onClick={() => { setSelectedProjectId(project.id); setSelectedManualId(null); }}
                    className="text-left bg-[#111827] border border-[#1e2d4a] hover:border-[#f97316]/30 hover:bg-[#1a2236] rounded-xl p-4 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-bold text-white group-hover:text-[#f97316] transition-colors leading-snug">
                        {project.name}
                      </span>
                      <span className={`shrink-0 ml-2 text-[10px] px-1.5 py-0.5 rounded-full border ${pManuals.length > 0 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-slate-600 border-[#1e2d4a]'}`}>
                        {pManuals.length} manual{pManuals.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{project.client || 'No client'}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // ── Project selected, no manual ───────────────────────────────────────────

  const sidebar = (
    <aside className="w-64 shrink-0 flex flex-col gap-3">
      {/* Project info */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl p-4">
        <button
          onClick={() => { setSelectedProjectId(''); setSelectedManualId(null); }}
          className="text-[10px] text-slate-600 hover:text-slate-400 mb-2 transition-colors"
        >
          ← All projects
        </button>
        <p className="text-xs font-bold text-white leading-snug">{selectedProject?.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{selectedProject?.client}</p>
      </div>

      {/* Manuals list */}
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-xl overflow-hidden flex-1">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manuals</span>
          <button
            onClick={() => setShowCreateManual(v => !v)}
            className="p-1 text-slate-600 hover:text-[#f97316] hover:bg-[#f97316]/10 rounded transition-colors"
            title="New manual"
          >
            <Plus size={13} />
          </button>
        </div>

        {showCreateManual && (
          <div className="px-3 py-2.5 border-b border-[#1e2d4a] bg-[#0d1628]">
            <input
              value={newManualTitle}
              onChange={e => setNewManualTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateManual(); if (e.key === 'Escape') { setShowCreateManual(false); setNewManualTitle('O&M Manual'); } }}
              placeholder="Manual title…"
              autoFocus
              className="w-full bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={handleCreateManual} disabled={!newManualTitle.trim()} className="flex-1 py-1.5 text-[10px] font-bold text-white bg-[#f97316] disabled:opacity-40 rounded transition-colors hover:bg-orange-400">
                Create
              </button>
              <button onClick={() => { setShowCreateManual(false); setNewManualTitle('O&M Manual'); }} className="px-2 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="py-1">
          {manuals.length === 0 ? (
            <p className="px-4 py-6 text-xs text-slate-600 text-center">No manuals yet</p>
          ) : (
            manuals.map(manual => {
              const isActive = selectedManualId === manual.id;
              return (
                <div key={manual.id} className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isActive ? 'bg-[#1a2236]' : 'hover:bg-[#0d1628]'}`}>
                  <button
                    onClick={() => setSelectedManualId(manual.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    {editingManual?.id === manual.id ? (
                      <input
                        value={editingManual.title}
                        onChange={e => setEditingManual({ ...editingManual, title: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') saveManualEdit(); if (e.key === 'Escape') setEditingManual(null); }}
                        onBlur={saveManualEdit}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-transparent text-xs text-white focus:outline-none border-b border-[#f97316]"
                      />
                    ) : (
                      <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {manual.title}
                      </p>
                    )}
                    <span className={`text-[9px] px-1 py-0.5 rounded border mt-0.5 inline-block ${STATUS_COLOURS[manual.status]}`}>
                      {STATUS_LABELS[manual.status]}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setEditingManual(manual)} className="p-1 text-slate-600 hover:text-slate-300 rounded transition-colors">
                      <Edit2 size={9} />
                    </button>
                    {confirmDeleteManualId === manual.id ? (
                      <>
                        <button onClick={() => handleDeleteManual(manual.id)} className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-colors">
                          <Check size={9} />
                        </button>
                        <button onClick={() => setConfirmDeleteManualId(null)} className="p-1 text-slate-600 hover:text-slate-300 rounded transition-colors">
                          <X size={9} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteManualId(manual.id)} className="p-1 text-slate-600 hover:text-red-400 rounded transition-colors">
                        <Trash2 size={9} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );

  // ── Manual selected ───────────────────────────────────────────────────────

  if (!selectedManual) {
    return (
      <div className="min-h-screen bg-[#0a1628] text-white">
        <div className="max-w-5xl mx-auto px-6 py-10 flex gap-6">
          {sidebar}
          <main className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1a2236] border border-[#1e2d4a] flex items-center justify-center mb-4">
              <LayoutList size={20} className="text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400 mb-1">Select or create a manual</p>
            <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
              Choose a manual from the sidebar or create a new one for this project.
            </p>
            {manuals.length === 0 && (
              <button
                onClick={() => setShowCreateManual(true)}
                className="mt-5 flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white text-sm font-semibold rounded-lg hover:bg-orange-400 transition-colors"
              >
                <Plus size={14} /> Create First Manual
              </button>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ── Full workspace ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-6">
        {sidebar}

        <main className="flex-1 min-w-0 space-y-5">
          {/* Manual header card */}
          <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl overflow-hidden">
            {/* Dark header band */}
            <div className="px-6 py-4 bg-[#0d1628] border-b border-[#1e2d4a] flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black text-white truncate">{selectedManual.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedProject?.name} · {selectedProject?.client}</p>
              </div>
              {/* Preview button */}
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/60 border border-slate-600/40 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
              >
                <Eye size={13} />
                Preview Manual
              </button>
              {/* Status picker */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowStatusMenu(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${STATUS_COLOURS[selectedManual.status]}`}
                >
                  {STATUS_LABELS[selectedManual.status]}
                  <ChevronDown size={11} className={`transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
                </button>
                {showStatusMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-[#1a2236] border border-[#1e2d4a] rounded-xl shadow-xl z-20 min-w-[140px] overflow-hidden py-1">
                    {STATUS_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors hover:bg-[#1e2d4a] ${
                          selectedManual.status === s ? 'font-semibold text-white' : 'text-slate-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s === 'draft' ? 'bg-slate-500' : s === 'in_progress' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats band */}
            <div className="grid grid-cols-3 divide-x divide-[#1e2d4a] px-0 py-0">
              {[
                { label: 'Sections', value: manualSections.length },
                { label: 'Records', value: totalItems },
                { label: 'Sections populated', value: `${populatedSections} / ${manualSections.length}` },
              ].map(stat => (
                <div key={stat.label} className="px-5 py-3 text-center">
                  <p className="text-lg font-black text-white">{stat.value}</p>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Gap analysis banner */}
          {manualSections.length > 0 && populatedSections < manualSections.length && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-400/5 border border-amber-400/20 rounded-xl">
              <AlertCircle size={14} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">
                <span className="font-semibold">{manualSections.length - populatedSections} section{manualSections.length - populatedSections !== 1 ? 's' : ''} without records.</span>
                {' '}Add records to complete this manual.
              </p>
            </div>
          )}

          {/* Quick-add default sections */}
          {manualSections.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3.5 bg-sky-400/5 border border-sky-400/20 rounded-xl">
              <BookOpen size={14} className="text-sky-400 shrink-0" />
              <p className="text-xs text-sky-300 flex-1">
                Start with the standard O&M section structure, or add your own sections below.
              </p>
              <button
                onClick={addDefaultSections}
                className="shrink-0 px-3 py-1.5 text-[10px] font-bold text-sky-300 border border-sky-400/30 rounded-lg hover:bg-sky-400/10 transition-colors"
              >
                Add standard sections
              </button>
            </div>
          )}

          {/* Section editor */}
          <OAndMSectionEditor
            sections={manualSections}
            items={manualItems}
            manualId={selectedManual.id}
            projectId={selectedManual.project_id}
            canEdit={true}
            onAddSection={store.addOAndMSection}
            onUpdateSection={store.updateOAndMSection}
            onRemoveSection={store.removeOAndMSection}
            onReorderSections={store.reorderOAndMSections}
            onAddItem={store.addOAndMItem}
            onUpdateItem={store.updateOAndMItem}
            onRemoveItem={store.removeOAndMItem}
            onReorderItems={store.reorderOAndMItems}
            currentUserName={currentUserName}
          />
        </main>
      </div>

      {/* Preview overlay */}
      {showPreview && selectedProject && (
        <OAndMPreview
          manual={selectedManual}
          sections={manualSections}
          items={manualItems}
          project={selectedProject}
          orgInfo={{
            companyName: store.settings.company_name,
            logoDataUrl: store.settings.logo_data_url || undefined,
          }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
