import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Icon, SpaceIcon, Avatar } from '../lib/icons';
import { Loading, Empty, ago, dueLabel, priorityTone } from '../lib/ui';
import { useActiveSpace } from '../lib/spaces';
import dayjs from 'dayjs';

const COLUMNS = [
  ['backlog', 'Backlog', 'slate'],
  ['todo', 'Todo', 'blue'],
  ['in_progress', 'In Progress', 'amber'],
  ['review', 'Review', 'violet'],
  ['done', 'Done', 'green'],
];
const STATUS_LABEL = { backlog: 'Backlog', todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_TONE = { backlog: 'slate', todo: 'blue', in_progress: 'amber', review: 'violet', done: 'green' };

function StatCard({ icon, tone, label, value, sub, subTone }) {
  return (
    <div className="nv-card p-3.5 flex flex-col gap-2.5" data-testid="stat-card">
      <div className="flex items-center gap-2">
        <div className={`stat-icon tone-${tone}`} style={{ width: 30, height: 30, borderRadius: 9 }}><Icon name={icon} size={15} /></div>
        <span className="text-[12px] font-semibold nv-muted">{label}</span>
      </div>
      <div className="text-[26px] font-extrabold leading-none tracking-tight">{value}</div>
      {sub && <div className={`text-[11px] font-medium ${subTone === 'red' ? 'text-[var(--nv-red)]' : subTone === 'green' ? 'text-[var(--nv-green)]' : 'nv-faint'}`}>{sub}</div>}
    </div>
  );
}

function TaskCard({ task, projects, onOpen }) {
  const proj = projects.find((p) => p.id === task.project_id);
  return (
    <button onClick={onOpen} className="w-full text-left nv-card-2 p-2.5 hover:border-[var(--nv-border)] transition-colors" data-testid="kanban-card">
      <div className="text-[12.5px] font-semibold leading-snug mb-2 line-clamp-2">{task.title}</div>
      <div className="flex items-center justify-between">
        {proj ? <span className={`nv-tag tone-${proj.color || 'slate'}`}>{proj.name}</span> : <span className="nv-tag tone-slate">General</span>}
        <span className={`w-1.5 h-1.5 rounded-full bg-[var(--nv-${priorityTone(task.priority)})]`} title={task.priority} />
      </div>
    </button>
  );
}

function ProjectBoard({ tasks, projects, sid, nav }) {
  const grouped = useMemo(() => {
    const g = {}; COLUMNS.forEach(([k]) => (g[k] = []));
    tasks.forEach((t) => { (g[t.status] || g.backlog).push(t); });
    return g;
  }, [tasks]);
  return (
    <div className="nv-card p-4" data-testid="project-board">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2"><Icon name="kanban" size={16} className="nv-muted" /><span className="nv-h2">Project Board</span></div>
        <button onClick={() => nav(`/dashboard/spaces/${sid}/board`)} className="nv-chip nv-btn-sm"><Icon name="chevron-down" size={13} /> Kanban</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {COLUMNS.map(([key, label, tone]) => (
          <div key={key} className="min-w-0">
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <span className={`w-2 h-2 rounded-full bg-[var(--nv-${tone})]`} />
              <span className="text-[12px] font-bold">{label}</span>
              <span className="text-[11px] nv-faint font-semibold ml-auto">{grouped[key].length}</span>
            </div>
            <div className="space-y-2">
              {grouped[key].slice(0, 4).map((t) => <TaskCard key={t.id} task={t} projects={projects} onOpen={() => nav(`/dashboard/spaces/${sid}/board`)} />)}
              <button onClick={() => nav(`/dashboard/spaces/${sid}/tasks?new=1`)} className="w-full text-left text-[11.5px] nv-faint hover:text-[var(--nv-text)] px-2 py-1.5 rounded-lg hover:bg-[var(--nv-card-2)] flex items-center gap-1.5"><Icon name="plus" size={12} /> Add task</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ projects }) {
  const range = useMemo(() => {
    const now = dayjs();
    let min = now, max = now.add(30, 'day');
    projects.forEach((p) => { const s = dayjs(p.created_at); const e = p.due_at ? dayjs(p.due_at) : s.add(14, 'day'); if (s.isBefore(min)) min = s; if (e.isAfter(max)) max = e; });
    return { min, max, days: Math.max(1, max.diff(min, 'day')) };
  }, [projects]);
  const bar = (p, i) => {
    const s = dayjs(p.created_at); const e = p.due_at ? dayjs(p.due_at) : s.add(14, 'day');
    const left = (s.diff(range.min, 'day') / range.days) * 100;
    const width = Math.max(6, (e.diff(s, 'day') / range.days) * 100);
    return (
      <div key={p.id} className="flex items-center gap-3 h-9">
        <div className="w-24 shrink-0 flex items-center gap-1.5 text-[12px] font-medium truncate"><span className={`w-1.5 h-1.5 rounded-full bg-[var(--nv-${p.color || 'slate'})]`} />{p.name}</div>
        <div className="flex-1 relative h-full flex items-center">
          <div className="absolute h-2 rounded-full" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, background: `var(--nv-${p.color || 'slate'})`, opacity: 0.85 }} />
        </div>
      </div>
    );
  };
  return (
    <div className="nv-card p-4" data-testid="project-timeline">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2"><Icon name="git-branch" size={16} className="nv-muted" /><span className="nv-h2">Project Timeline</span></div>
        <span className="text-[11px] nv-faint font-semibold">{range.min.format('MMM D')} – {range.max.format('MMM D')}</span>
      </div>
      {projects.length ? <div className="space-y-1">{projects.slice(0, 6).map(bar)}</div> : <Empty icon="git-branch" title="No projects yet" hint="Projects will appear here as a timeline." />}
    </div>
  );
}

function TasksTable({ tasks, projects, sid, nav }) {
  return (
    <div className="nv-card overflow-hidden" data-testid="tasks-table">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--nv-border-soft)]">
        <div className="flex items-center gap-2"><Icon name="list-checks" size={16} className="nv-muted" /><span className="nv-h2">Tasks</span></div>
        <button onClick={() => nav(`/dashboard/spaces/${sid}/tasks?new=1`)} className="nv-btn nv-btn-primary nv-btn-sm"><Icon name="plus" size={13} /> New Task</button>
      </div>
      <div className="overflow-x-auto nv-scroll">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left nv-faint text-[11px] uppercase tracking-wide">
            <th className="font-semibold px-4 py-2.5">Task</th><th className="font-semibold px-3 py-2.5">Status</th><th className="font-semibold px-3 py-2.5">Priority</th><th className="font-semibold px-3 py-2.5">Due date</th>
          </tr></thead>
          <tbody>
            {tasks.slice(0, 8).map((t) => (
              <tr key={t.id} onClick={() => nav(`/dashboard/spaces/${sid}/tasks`)} className="border-t border-[var(--nv-border-soft)] hover:bg-[var(--nv-card-2)] cursor-pointer">
                <td className="px-4 py-2.5 font-medium max-w-[240px] truncate">{t.title}</td>
                <td className="px-3 py-2.5"><span className={`nv-tag tone-${STATUS_TONE[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                <td className="px-3 py-2.5"><span className={`nv-tag tone-${priorityTone(t.priority)} capitalize`}>{t.priority}</span></td>
                <td className="px-3 py-2.5 nv-muted">{t.due_at ? dueLabel(t.due_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tasks.length && <Empty icon="list-checks" title="No tasks yet" hint="Create your first task to see it here." />}
      </div>
    </div>
  );
}

function ActivityFeed({ activity }) {
  return (
    <div className="nv-card p-4" data-testid="activity-feed">
      <div className="flex items-center gap-2 mb-3"><Icon name="activity" size={16} className="nv-muted" /><span className="nv-h2">Activity</span></div>
      {activity.length ? (
        <div className="space-y-3.5">
          {activity.slice(0, 6).map((a) => (
            <div key={a.id} className="flex gap-2.5">
              <Avatar user={a.actor} size={28} />
              <div className="min-w-0"><div className="text-[12.5px] leading-snug"><span className="font-semibold">{a.actor?.name || 'Someone'}</span> <span className="nv-muted">{(a.text || '').replace(a.actor?.name || '', '').trim() || 'made an update'}</span></div><div className="text-[10.5px] nv-faint mt-0.5">{ago(a.created_at)}</div></div>
            </div>
          ))}
        </div>
      ) : <Empty icon="activity" title="No activity yet" hint="Team activity will show up here." />}
    </div>
  );
}

function ProgressDonut({ tasks }) {
  const counts = useMemo(() => {
    const c = { done: 0, in_progress: 0, todo: 0, backlog: 0, review: 0 };
    tasks.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [tasks]);
  const total = tasks.length || 1;
  const pct = Math.round((counts.done / total) * 100);
  const r = 34, circ = 2 * Math.PI * r;
  return (
    <div className="nv-card p-4" data-testid="progress-donut">
      <div className="flex items-center gap-2 mb-3"><Icon name="pie-chart" size={16} className="nv-muted" /><span className="nv-h2">Project Progress</span></div>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 90, height: 90 }}>
          <svg width="90" height="90" className="-rotate-90">
            <circle cx="45" cy="45" r={r} fill="none" stroke="var(--nv-border)" strokeWidth="9" />
            <circle cx="45" cy="45" r={r} fill="none" stroke="var(--nv-green)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} />
          </svg>
          <div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="text-[18px] font-extrabold leading-none">{pct}%</div><div className="text-[9px] nv-faint">done</div></div></div>
        </div>
        <div className="flex-1 space-y-1.5 text-[12px]">
          {[['Done', 'green', counts.done], ['In Progress', 'amber', counts.in_progress], ['Todo', 'blue', counts.todo], ['Backlog', 'slate', counts.backlog]].map(([l, tone, n]) => (
            <div key={l} className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full bg-[var(--nv-${tone})]`} /><span className="nv-muted flex-1">{l}</span><span className="font-bold">{n}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeHub() {
  const { active } = useActiveSpace();
  const nav = useNavigate();
  const sid = active?.id;
  const { data: home, isLoading } = useQuery({ queryKey: ['home', sid], queryFn: () => api.get(`/spaces/${sid}/home`).then((r) => r.data), enabled: !!sid });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', sid], queryFn: () => api.get(`/spaces/${sid}/tasks?limit=200`).then((r) => r.data), enabled: !!sid });
  const { data: projects = [] } = useQuery({ queryKey: ['projects', sid], queryFn: () => api.get(`/spaces/${sid}/projects?limit=50`).then((r) => r.data), enabled: !!sid });

  if (!active) return <div className="p-10"><Empty icon="layers" title="No Space selected" hint="Create a Space to get started." action={<button className="nv-btn nv-btn-primary" onClick={() => nav('/dashboard/spaces/new')}><Icon name="plus" size={14} /> Create Space</button>} /></div>;
  if (isLoading) return <div className="p-10"><Loading label="Opening your workspace…" /></div>;

  const s = home?.stats || {};
  const now = dayjs();
  const overdue = tasks.filter((t) => t.status !== 'done' && t.due_at && dayjs(t.due_at).isBefore(now)).length;
  const upcomingDeadlines = tasks.filter((t) => t.status !== 'done' && t.due_at && dayjs(t.due_at).isAfter(now) && dayjs(t.due_at).isBefore(now.add(7, 'day'))).length;
  const recentWork = (s.notes || 0) + (s.documents || 0) + (s.files || 0) + (tasks.filter((t) => dayjs(t.updated_at).isAfter(now.subtract(7, 'day'))).length);
  const donePct = tasks.length ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100) : 0;

  return (
    <div className="p-5 md:p-6 max-w-[1600px] mx-auto fade-up" data-testid="home-hub">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <SpaceIcon icon={active.icon} accent={active.accent} size={48} radius={13} iconSize={24} />
          <div className="min-w-0">
            <h1 className="nv-h1 truncate">{active.name}</h1>
            <div className="text-[13px] nv-muted">{active.description || `${active.type === 'team' ? 'Team' : 'Personal'} workspace`}</div>
          </div>
        </div>
        <button className="nv-btn nv-btn-outline" data-testid="customize-btn"><Icon name="settings-2" size={15} /> Customize</button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <StatCard icon="briefcase" tone="violet" label="Active Projects" value={s.active_projects ?? 0} sub={s.new_projects ? `↑ ${s.new_projects} this week` : 'No new this week'} subTone={s.new_projects ? 'green' : ''} />
        <StatCard icon="history" tone="blue" label="Recent Work" value={recentWork} sub="in the last 7 days" />
        <StatCard icon="calendar-clock" tone="amber" label="Upcoming Deadlines" value={upcomingDeadlines} sub="next 7 days" />
        <StatCard icon="list-todo" tone="pink" label="Current Tasks" value={s.open_tasks ?? 0} sub={overdue ? `${overdue} overdue` : 'on track'} subTone={overdue ? 'red' : 'green'} />
        <StatCard icon="zap" tone="teal" label="Recent Activity" value={(home?.activity || []).length} sub="in the last 24 hours" />
        <div className="nv-card p-3.5 flex flex-col gap-2 nv-ring-ai relative overflow-hidden" data-testid="ai-insight-stat">
          <div className="flex items-center gap-2"><div className="stat-icon tone-ai" style={{ width: 30, height: 30, borderRadius: 9 }}><Icon name="sparkles" size={15} /></div><span className="text-[12px] font-semibold nv-muted">AI Workspace Insight</span></div>
          <div className="text-[12px] leading-snug text-[var(--nv-text)]">{donePct}% of tasks complete{overdue ? `, ${overdue} overdue need attention` : ' — strong momentum this sprint'}.</div>
        </div>
      </div>

      {/* Board + Timeline */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 min-w-0"><ProjectBoard tasks={tasks} projects={projects} sid={sid} nav={nav} /></div>
        <div className="min-w-0"><Timeline projects={projects} /></div>
      </div>

      {/* Tasks + Activity + Progress */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 min-w-0"><TasksTable tasks={tasks} projects={projects} sid={sid} nav={nav} /></div>
        <div className="min-w-0 space-y-4"><ActivityFeed activity={home?.activity || []} /><ProgressDonut tasks={tasks} /></div>
      </div>
    </div>
  );
}
