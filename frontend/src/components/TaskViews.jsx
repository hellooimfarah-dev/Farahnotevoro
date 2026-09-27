import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { Icon } from '../lib/icons';
import { Empty, priorityTone, dueLabel } from '../lib/ui';

export const COLUMNS = [
  ['backlog', 'Backlog', 'slate'],
  ['todo', 'Todo', 'blue'],
  ['in_progress', 'In Progress', 'amber'],
  ['review', 'Review', 'violet'],
  ['done', 'Done', 'green'],
];
const STATUS_LABEL = { backlog: 'Backlog', todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_TONE = { backlog: 'slate', todo: 'blue', in_progress: 'amber', review: 'violet', done: 'green' };
const toDateInput = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : '');
const fromDateInput = (d) => (d ? dayjs(d).endOf('day').toISOString() : null);

export function useTasks(spaceId) {
  return useQuery({ queryKey: ['tasks', spaceId], queryFn: () => api.get(`/spaces/${spaceId}/tasks?limit=300`).then((r) => r.data), enabled: !!spaceId });
}

function useTaskMutations(spaceId) {
  const qc = useQueryClient();
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tasks', spaceId] }); qc.invalidateQueries({ queryKey: ['home', spaceId] }); };
  const patch = useMutation({
    mutationFn: ({ id, patch }) => api.patch(`/spaces/${spaceId}/tasks/${id}`, patch).then((r) => r.data),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['tasks', spaceId] });
      const prev = qc.getQueryData(['tasks', spaceId]);
      qc.setQueryData(['tasks', spaceId], (old) => (old || []).map((t) => (t.id === id ? { ...t, ...patch } : t)));
      return { prev };
    },
    onError: (e, v, ctx) => { qc.setQueryData(['tasks', spaceId], ctx?.prev); toast.error('Could not update task'); },
    onSettled: invalidate,
  });
  const create = useMutation({
    mutationFn: (body) => api.post(`/spaces/${spaceId}/tasks`, body).then((r) => r.data),
    onSuccess: invalidate,
    onError: () => toast.error('Could not create task'),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/spaces/${spaceId}/tasks/${id}`),
    onSuccess: invalidate,
  });
  return { patch, create, remove };
}

/* ---------------- Board ---------------- */
function Board({ tasks, projects, m }) {
  const [dragId, setDragId] = useState(null);
  const grouped = useMemo(() => { const g = {}; COLUMNS.forEach(([k]) => (g[k] = [])); tasks.forEach((t) => (g[t.status] || g.backlog).push(t)); return g; }, [tasks]);
  const projName = (id) => projects.find((p) => p.id === id);
  const drop = (status) => { if (dragId) { m.patch.mutate({ id: dragId, patch: { status } }); setDragId(null); } };
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="view-board">
      {COLUMNS.map(([key, label, tone]) => (
        <div key={key} className="min-w-0 rounded-xl p-1.5 transition-colors" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(key)}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-2 h-2 rounded-full" style={{ background: `var(--nv-${tone})` }} /><span className="text-[12px] font-bold">{label}</span>
            <span className="text-[11px] nv-faint font-semibold ml-auto">{grouped[key].length}</span>
          </div>
          <div className="space-y-2 min-h-[40px]">
            {grouped[key].map((t) => {
              const proj = projName(t.project_id);
              return (
                <div key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)}
                  className="nv-card-2 p-2.5 cursor-grab active:cursor-grabbing hover:border-[var(--nv-border)] transition-colors" data-testid="board-card">
                  <div className="text-[12.5px] font-semibold leading-snug mb-2">{t.title}</div>
                  <div className="flex items-center justify-between gap-2">
                    {proj ? <span className={`nv-tag tone-${proj.color || 'slate'}`}>{proj.name}</span> : <span className="nv-tag tone-slate">General</span>}
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--nv-${priorityTone(t.priority)})` }} title={t.priority} />
                  </div>
                </div>
              );
            })}
            <button onClick={() => m.create.mutate({ title: 'New task', status: key, priority: 'medium' })} className="w-full text-left text-[11.5px] nv-faint hover:text-[var(--nv-text)] px-2 py-1.5 rounded-lg hover:bg-[var(--nv-card-2)] flex items-center gap-1.5" data-testid="board-add"><Icon name="plus" size={12} /> Add task</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Table ---------------- */
function Table({ tasks, projects, m }) {
  const cell = "px-3 py-2 border-t border-[var(--nv-border-soft)] align-middle";
  return (
    <div className="nv-card overflow-hidden" data-testid="view-table">
      <div className="overflow-x-auto nv-scroll">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left nv-faint text-[11px] uppercase tracking-wide">
            <th className="font-semibold px-3 py-2.5">Task</th><th className="font-semibold px-3 py-2.5">Project</th><th className="font-semibold px-3 py-2.5">Status</th><th className="font-semibold px-3 py-2.5">Priority</th><th className="font-semibold px-3 py-2.5">Due</th><th className="w-8" />
          </tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-[var(--nv-card-2)]" data-testid="table-row">
                <td className={cell}>
                  <input defaultValue={t.title} onBlur={(e) => { if (e.target.value !== t.title) m.patch.mutate({ id: t.id, patch: { title: e.target.value } }); }} className="bg-transparent outline-none font-medium w-full min-w-[180px]" />
                </td>
                <td className={cell}>
                  <select value={t.project_id || ''} onChange={(e) => m.patch.mutate({ id: t.id, patch: { project_id: e.target.value || null } })} className="bg-transparent outline-none nv-muted text-[12px] cursor-pointer">
                    <option value="">—</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <select value={t.status} onChange={(e) => m.patch.mutate({ id: t.id, patch: { status: e.target.value } })} className={`nv-tag tone-${STATUS_TONE[t.status]} cursor-pointer outline-none border-0`} data-testid="table-status">
                    {COLUMNS.map(([k]) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <select value={t.priority || 'medium'} onChange={(e) => m.patch.mutate({ id: t.id, patch: { priority: e.target.value } })} className={`nv-tag tone-${priorityTone(t.priority)} cursor-pointer outline-none border-0 capitalize`}>
                    {['high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <input type="date" value={toDateInput(t.due_at)} onChange={(e) => m.patch.mutate({ id: t.id, patch: { due_at: fromDateInput(e.target.value) } })} className="bg-transparent outline-none nv-muted text-[12px] cursor-pointer" />
                </td>
                <td className={cell}><button onClick={() => m.remove.mutate(t.id)} className="text-[var(--nv-faint)] hover:text-[var(--nv-red)]" data-testid="table-delete"><Icon name="trash-2" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => m.create.mutate({ title: 'New task', status: 'todo', priority: 'medium' })} className="w-full text-left text-[12px] nv-faint hover:text-[var(--nv-text)] px-4 py-2.5 border-t border-[var(--nv-border-soft)] flex items-center gap-1.5" data-testid="table-add"><Icon name="plus" size={13} /> New row</button>
    </div>
  );
}

/* ---------------- Timeline ---------------- */
function Timeline({ tasks }) {
  const items = tasks.filter((t) => t.due_at);
  const range = useMemo(() => {
    const now = dayjs(); let min = now.subtract(3, 'day'), max = now.add(21, 'day');
    items.forEach((t) => { const s = dayjs(t.created_at); const e = dayjs(t.due_at); if (s.isBefore(min)) min = s; if (e.isAfter(max)) max = e; });
    return { min, max, days: Math.max(1, max.diff(min, 'day')) };
  }, [items]);
  if (!items.length) return <Empty icon="git-branch" title="No dated tasks" hint="Tasks with a due date appear here on the timeline." />;
  return (
    <div className="nv-card p-4" data-testid="view-timeline">
      <div className="flex items-center justify-between mb-3 text-[11px] nv-faint font-semibold"><span>{range.min.format('MMM D')}</span><span>{range.max.format('MMM D')}</span></div>
      <div className="space-y-1.5">
        {items.slice(0, 30).map((t) => {
          const s = dayjs(t.created_at); const e = dayjs(t.due_at);
          const left = Math.max(0, (s.diff(range.min, 'day') / range.days) * 100);
          const width = Math.max(5, (Math.max(1, e.diff(s, 'day')) / range.days) * 100);
          return (
            <div key={t.id} className="flex items-center gap-3 h-8">
              <div className="w-40 shrink-0 text-[12px] font-medium truncate">{t.title}</div>
              <div className="flex-1 relative h-full flex items-center">
                <div className="absolute h-2.5 rounded-full flex items-center" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, background: `var(--nv-${STATUS_TONE[t.status]})`, opacity: 0.9 }} />
              </div>
              <div className="w-16 shrink-0 text-[11px] nv-faint text-right">{dueLabel(t.due_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Calendar ---------------- */
function Calendar({ tasks, m }) {
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const start = month.startOf('week');
  const days = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
  const byDay = useMemo(() => { const g = {}; tasks.forEach((t) => { if (t.due_at) { const k = dayjs(t.due_at).format('YYYY-MM-DD'); (g[k] = g[k] || []).push(t); } }); return g; }, [tasks]);
  return (
    <div className="nv-card p-4" data-testid="view-calendar">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-[14px]">{month.format('MMMM YYYY')}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(month.subtract(1, 'month'))} className="nv-btn nv-btn-ghost w-8 px-0"><Icon name="chevron-left" size={16} /></button>
          <button onClick={() => setMonth(dayjs().startOf('month'))} className="nv-btn nv-btn-ghost nv-btn-sm">Today</button>
          <button onClick={() => setMonth(month.add(1, 'month'))} className="nv-btn nv-btn-ghost w-8 px-0"><Icon name="chevron-right" size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px text-[10px] nv-faint font-semibold mb-1">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-px bg-[var(--nv-border-soft)] rounded-lg overflow-hidden">
        {days.map((d) => {
          const key = d.format('YYYY-MM-DD'); const list = byDay[key] || []; const other = d.month() !== month.month(); const today = d.isSame(dayjs(), 'day');
          return (
            <div key={key} className={`min-h-[76px] bg-[var(--nv-card)] p-1.5 ${other ? 'opacity-40' : ''}`} data-testid="cal-day">
              <div className={`text-[11px] font-semibold mb-1 ${today ? 'text-[var(--nv-ai)]' : 'nv-muted'}`}>{d.date()}</div>
              <div className="space-y-1">
                {list.slice(0, 3).map((t) => <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate tone-${STATUS_TONE[t.status]}`} title={t.title}>{t.title}</div>)}
                {list.length > 3 && <div className="text-[10px] nv-faint px-1">+{list.length - 3} more</div>}
                {!other && <button onClick={() => m.create.mutate({ title: 'New task', status: 'todo', priority: 'medium', due_at: fromDateInput(key) })} className="text-[10px] nv-faint hover:text-[var(--nv-text)] flex items-center gap-0.5 px-1"><Icon name="plus" size={10} /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Public block ---------------- */
export default function TaskViewBlock({ spaceId, mode = 'board', projectId }) {
  const { data: tasks = [], isLoading } = useTasks(spaceId);
  const { data: projects = [] } = useQuery({ queryKey: ['projects', spaceId], queryFn: () => api.get(`/spaces/${spaceId}/projects?limit=50`).then((r) => r.data), enabled: !!spaceId });
  const m = useTaskMutations(spaceId);
  const filtered = projectId ? tasks.filter((t) => t.project_id === projectId) : tasks;
  if (isLoading) return <div className="text-[13px] nv-faint p-4">Loading tasks…</div>;
  if (mode === 'table') return <Table tasks={filtered} projects={projects} m={m} />;
  if (mode === 'timeline') return <Timeline tasks={filtered} />;
  if (mode === 'calendar') return <Calendar tasks={filtered} m={m} />;
  return <Board tasks={filtered} projects={projects} m={m} />;
}
