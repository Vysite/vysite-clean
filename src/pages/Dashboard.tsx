import { useMemo } from 'react';
import { AlertTriangle, CheckSquare, FolderOpen, Clock, FileText, ArrowRight, Activity, Wrench, ClipboardList, FileSpreadsheet } from 'lucide-react';
import { useAppStore } from '../lib/StoreContext';
import type { PendingFilter, PendingOpen } from '../App';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  onClick,
  alert,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  onClick?: () => void;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-[#1a2236] rounded-xl p-5 border transition-all relative${onClick ? ' cursor-pointer hover:border-[#2a3d5a]' : ''} ${alert ? 'border-red-900/60' : 'border-[#1e2d4a]'}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {onClick && (
        <div className="absolute bottom-3 right-3">
          <ArrowRight size={14} className="text-slate-600" />
        </div>
      )}
    </div>
  );
}

function ProjectProgressBar({ progress, status }: { progress: number; status: string }) {
  const color = status === 'Active' ? 'bg-[#f97316]' : status === 'On Hold' ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="w-full bg-[#0d1628] rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${progress}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: 'bg-emerald-900/60 text-emerald-400 border border-emerald-800',
    'On Hold': 'bg-amber-900/60 text-amber-400 border border-amber-800',
    Completed: 'bg-slate-700 text-slate-300 border border-slate-600',
    Tender: 'bg-blue-900/60 text-blue-400 border border-blue-800',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] || 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  );
}

type ActivityItemType = 'action' | 'snag' | 'form' | 'project' | 'testing' | 'tender';

interface ActivityItem {
  id: string;
  type: ActivityItemType;
  title: string;
  sub: string;
  ts: string;
  dest: DashboardPage;
  itemId: string;
  linkedType: string;
  projectId?: string;
}

function ActivityIcon({ type }: { type: ActivityItemType }) {
  const map: Record<ActivityItemType, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
    action:  { icon: CheckSquare,    color: 'bg-blue-900/60 text-blue-400' },
    snag:    { icon: AlertTriangle,  color: 'bg-red-900/60 text-red-400' },
    form:    { icon: ClipboardList,  color: 'bg-emerald-900/60 text-emerald-400' },
    project: { icon: FolderOpen,     color: 'bg-orange-900/60 text-orange-400' },
    testing: { icon: Wrench,         color: 'bg-teal-900/60 text-teal-400' },
    tender:  { icon: FileSpreadsheet,color: 'bg-amber-900/60 text-amber-400' },
  };
  const { icon: Icon, color } = map[type];
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center shrink-0`}>
      <Icon size={14} />
    </div>
  );
}

function formatActivityDate(ts: string): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return ts;
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return `Today`;
  if (diffDays === 1) return `Yesterday`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type DashboardPage = 'projects' | 'snagging' | 'actions' | 'site-forms' | 'testing' | 'reports' | 'tenders';

interface DashboardProps {
  onNavigate: (page: DashboardPage, filter?: PendingFilter, open?: PendingOpen) => void;
  onNavigateProject?: (projectId: string) => void;
}

export default function Dashboard({ onNavigate, onNavigateProject }: DashboardProps) {
  const store = useAppStore();
  const { visibleProjectIds } = store;

  const allProjects = visibleProjectIds
    ? store.projects.filter(p => visibleProjectIds.includes(p.id))
    : store.projects;
  const actionList = visibleProjectIds
    ? store.actions.filter(a => visibleProjectIds.includes(a.projectId))
    : store.actions;
  const snags = visibleProjectIds
    ? store.snags.filter(s => visibleProjectIds.includes(s.projectId))
    : store.snags;
  const siteForms = visibleProjectIds
    ? store.siteForms.filter(f => visibleProjectIds.includes(f.project_id))
    : store.siteForms;

  const activeProjects = allProjects.filter(p => p.status === 'Active').length;
  const openSnags = snags.filter(s => s.status !== 'Closed').length;
  const openActions = actionList.filter(a => a.status !== 'Complete').length;
  const overdueActions = actionList.filter(a => a.overdue && a.status !== 'Complete').length;
  const formsCount = siteForms.length;

  const closeAction = (id: string) => {
    const action = actionList.find(a => a.id === id);
    if (action) store.updateAction({ ...action, status: 'Complete', overdue: false });
  };

  // Build live activity feed from store data, newest first
  const liveActivity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    actionList.forEach(a => {
      if (a.createdDate) items.push({
        id: `act-${a.id}`,
        type: 'action',
        title: `Action: ${a.title}`,
        sub: `${a.projectName} — ${a.owner} · ${a.status}${a.overdue && a.status !== 'Complete' ? ' · OVERDUE' : ''}`,
        ts: a.createdDate,
        dest: 'actions',
        itemId: a.id,
        linkedType: 'action',
        projectId: a.projectId,
      });
    });

    snags.forEach(s => {
      if (s.raisedDate) items.push({
        id: `snag-${s.id}`,
        type: 'snag',
        title: `Snag: ${s.title}`,
        sub: `${s.projectName} — ${s.raisedBy} · ${s.priority} · ${s.status}`,
        ts: s.raisedDate,
        dest: 'snagging',
        itemId: s.id,
        linkedType: 'snag',
        projectId: s.projectId,
      });
    });

    siteForms.forEach(f => {
      const ts = f.submitted_date || f.date;
      if (ts) items.push({
        id: `form-${f.id}`,
        type: 'form',
        title: `${f.type}: ${f.status}`,
        sub: `${f.project_name} — ${f.completed_by}`,
        ts,
        dest: 'site-forms',
        itemId: f.id,
        linkedType: 'form',
        projectId: f.project_id,
      });
    });

    const tcRecords = visibleProjectIds
      ? store.tcRecords.filter(r => visibleProjectIds.includes(r.project_id))
      : store.tcRecords;
    tcRecords.forEach(r => {
      if (r.date) items.push({
        id: `tc-${r.id}`,
        type: 'testing',
        title: `T&C: ${r.title}`,
        sub: `${r.project_name} — ${r.engineer} · ${r.status}`,
        ts: r.date,
        dest: 'testing',
        itemId: r.id,
        linkedType: 'testing',
        projectId: r.project_id,
      });
    });

    store.tenders.forEach(t => {
      if (t.lastUpdated) items.push({
        id: `ten-${t.id}`,
        type: 'tender',
        title: `Tender: ${t.name}`,
        sub: `${t.client} — ${t.owner} · ${t.status}`,
        ts: t.lastUpdated,
        dest: 'tenders',
        itemId: t.id,
        linkedType: 'tender',
      });
    });

    allProjects.forEach(p => {
      if (p.startDate) items.push({
        id: `proj-${p.id}`,
        type: 'project',
        title: `Project: ${p.name}`,
        sub: `${p.client} — ${p.projectManager} · ${p.status} · ${p.progress}%`,
        ts: p.startDate,
        dest: 'projects',
        itemId: p.id,
        linkedType: 'project',
      });
    });

    return items
      .sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0))
      .slice(0, 20);
  }, [actionList, snags, siteForms, store.tcRecords, store.tenders, allProjects, visibleProjectIds]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Projects"
          value={activeProjects}
          subtitle={`${allProjects.length - activeProjects} on hold or complete`}
          icon={FolderOpen}
          color="bg-[#f97316]"
          onClick={() => onNavigate('projects')}
        />
        <StatCard
          title="Open Snags"
          value={openSnags}
          subtitle={`${snags.filter(s => s.priority === 'Critical' && s.status !== 'Closed').length} critical · click to view`}
          icon={AlertTriangle}
          color="bg-red-600"
          onClick={() => onNavigate('snagging')}
        />
        <StatCard
          title="Open Actions"
          value={openActions}
          subtitle={overdueActions > 0 ? `${overdueActions} overdue — click to view` : 'No overdue actions'}
          icon={CheckSquare}
          color={overdueActions > 0 ? 'bg-red-700' : 'bg-blue-600'}
          alert={overdueActions > 0}
          onClick={() => onNavigate('actions')}
        />
        <StatCard
          title="Site Forms"
          value={formsCount}
          subtitle={`${siteForms.filter(f => f.status === 'Draft').length} draft · ${siteForms.filter(f => f.status === 'Submitted').length} submitted`}
          icon={FileText}
          color="bg-emerald-600"
          onClick={() => onNavigate('site-forms')}
        />
      </div>

      {/* Overdue Banner */}
      {overdueActions > 0 && (
        <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-900/60 rounded-lg flex items-center justify-center shrink-0">
              <Clock size={18} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-300">
                {overdueActions} overdue action{overdueActions > 1 ? 's' : ''} require attention
              </p>
              <p className="text-xs text-red-500">Items past their due date — click to view overdue actions</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('actions', { filterKey: 'status', filterValue: 'Overdue' })}
            className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-200 transition-colors self-start sm:self-auto ml-12 sm:ml-0"
          >
            View overdue <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Projects List */}
        <div className="xl:col-span-2 bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
          <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
            <div>
              <h2 className="text-sm font-semibold text-white">Active Projects</h2>
              <p className="text-xs text-slate-500 mt-0.5">Current site work in progress</p>
            </div>
            <button
              onClick={() => onNavigate('projects')}
              className="flex items-center gap-1 text-xs font-semibold text-[#f97316] hover:text-orange-400 transition-colors"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-[#1e2d4a]">
            {allProjects.filter(p => p.status === 'Active').slice(0, 6).map((project) => (
              <div key={project.id} className="p-4 hover:bg-[#0d1628]/50 transition-colors cursor-pointer group"
                onClick={() => { onNavigateProject?.(project.id); onNavigate('projects'); }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-[#f97316] transition-colors truncate">{project.name}</p>
                    <p className="text-xs text-slate-500 truncate">{project.client}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-xs text-slate-400">PM: {project.projectManager}</span>
                  <span className="text-xs text-slate-500">{project.location.split(',').slice(-2).join(',').trim()}</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <ProjectProgressBar progress={project.progress} status={project.status} />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 w-8 text-right">{project.progress}%</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onNavigate('snagging', { filterKey: 'project', filterValue: project.id }); }}
                  >
                    <AlertTriangle size={10} className="text-red-400" />
                    {project.openSnags} snags
                  </button>
                  <button
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onNavigate('actions', { filterKey: 'project', filterValue: project.id }); }}
                  >
                    <CheckSquare size={10} className="text-blue-400" />
                    {project.openActions} actions
                  </button>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    Due {new Date(project.completionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {allProjects.filter(p => p.status === 'Active').length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No active projects</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Snag Summary */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
              <h2 className="text-sm font-semibold text-white">Snag Summary</h2>
              <button
                onClick={() => onNavigate('snagging')}
                className="text-xs text-[#f97316] font-semibold hover:text-orange-400 transition-colors"
              >
                View all
              </button>
            </div>
            <div className="p-4 space-y-3">
              {(['Critical', 'High', 'Medium', 'Low'] as const).map((priority) => {
                const count = snags.filter(s => s.priority === priority && s.status !== 'Closed').length;
                const colors: Record<string, string> = { Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-amber-400', Low: 'bg-slate-600' };
                const textColors: Record<string, string> = { Critical: 'text-red-400', High: 'text-orange-400', Medium: 'text-amber-400', Low: 'text-slate-400' };
                return (
                  <div key={priority} className="flex items-center gap-3 cursor-pointer hover:bg-[#0d1628]/50 rounded-lg px-1 -mx-1 transition-colors"
                    onClick={() => onNavigate('snagging', { filterKey: 'priority', filterValue: priority })}>
                    <span className={`text-xs font-semibold ${textColors[priority]} w-16`}>{priority}</span>
                    <div className="flex-1 bg-[#0d1628] rounded-full h-2">
                      <div className={`h-2 rounded-full ${colors[priority]}`} style={{ width: `${openSnags > 0 ? (count / openSnags) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-300 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions due */}
          <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
            <div className="flex items-center justify-between p-5 border-b border-[#1e2d4a]">
              <div>
                <h2 className="text-sm font-semibold text-white">Actions Due Soon</h2>
                {overdueActions > 0 && (
                  <button
                    onClick={() => onNavigate('actions', { filterKey: 'status', filterValue: 'Overdue' })}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors mt-0.5 flex items-center gap-0.5"
                  >
                    {overdueActions} overdue — view <ArrowRight size={10} />
                  </button>
                )}
              </div>
              <button onClick={() => onNavigate('actions')} className="text-xs text-[#f97316] font-semibold hover:text-orange-400 transition-colors">View all</button>
            </div>
            <div className="divide-y divide-[#1e2d4a]">
              {actionList.filter(a => a.status !== 'Complete').slice(0, 4).map((action) => (
                <div key={action.id}
                  className="p-4 hover:bg-[#0d1628]/50 transition-colors group cursor-pointer"
                  onClick={() => onNavigate('actions', undefined, { linkedType: 'action', linkedId: action.id })}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-200 leading-snug line-clamp-2">{action.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {action.overdue && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded-full border border-red-800">OVERDUE</span>
                      )}
                      <button onClick={e => { e.stopPropagation(); closeAction(action.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-600 hover:text-emerald-400 transition-all" title="Mark complete">
                        <CheckSquare size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-500">{action.owner}</span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className={`text-[10px] font-medium ${action.overdue ? 'text-red-400' : 'text-slate-500'}`}>
                      {new Date(action.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-auto">{action.projectName.split(' ').slice(0, 3).join(' ')}</span>
                  </div>
                </div>
              ))}
              {actionList.filter(a => a.status !== 'Complete').length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">No open actions</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity — live from store */}
      <div className="bg-[#1a2236] rounded-xl border border-[#1e2d4a]">
        <div className="flex items-center gap-2 p-5 border-b border-[#1e2d4a]">
          <Activity size={16} className="text-[#f97316]" />
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
          <span className="text-xs text-slate-600 ml-1">Live</span>
        </div>
        {liveActivity.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">No activity yet</p>
        ) : (
          <div className="divide-y divide-[#1e2d4a]">
            {liveActivity.map((item) => (
              <div key={item.id}
                className="flex items-start gap-3 p-4 hover:bg-[#0d1628]/50 transition-colors cursor-pointer group"
                onClick={() => {
                  if (item.linkedType === 'project') {
                    onNavigateProject?.(item.itemId);
                    onNavigate('projects');
                  } else if (item.linkedType === 'tender') {
                    onNavigate(item.dest, undefined, { linkedType: item.linkedType, linkedId: item.itemId });
                  } else {
                    onNavigate(item.dest, undefined, { linkedType: item.linkedType, linkedId: item.itemId });
                  }
                }}>
                <ActivityIcon type={item.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-[#f97316] transition-colors line-clamp-1">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{item.sub}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500">{formatActivityDate(item.ts)}</span>
                  <ArrowRight size={12} className="text-slate-700 group-hover:text-[#f97316] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
