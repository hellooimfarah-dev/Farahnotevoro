import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useActiveSpace } from '../lib/spaces';
import { Icon } from '../lib/icons';
import { Loading, Empty, ago } from '../lib/ui';

const TEMPLATES = [
  ['check-square', 'Task Completion', 'When a task is completed', [{ id: 'n1', type: 'condition', label: 'Priority = High' }, { id: 'n2', type: 'action', label: 'Create follow-up task', config: { action: 'create_task', title: 'Follow-up' } }, { id: 'n3', type: 'ai', label: 'AI summary', config: { prompt: 'Summarize the completed work.' } }], 'task_completed'],
  ['rocket', 'New Project Setup', 'When a project is created', [{ id: 'n1', type: 'action', label: 'Create task list', config: { action: 'create_task', title: 'Kick-off' } }, { id: 'n2', type: 'action', label: 'Notify team', config: {} }], 'project_created'],
  ['video', 'Meeting Follow-up', 'When a meeting ends', [{ id: 'n1', type: 'ai', label: 'Summarize meeting', config: { prompt: 'Summarize and extract action items.' } }, { id: 'n2', type: 'action', label: 'Create tasks', config: { action: 'create_task', title: 'Action item' } }], 'meeting_ended'],
];
const NODE_ICON = { trigger: 'zap', condition: 'filter', action: 'square-check', ai: 'sparkles', notify: 'bell' };

function Detail({ sid, wf, onChange }) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const { data: runs = [] } = useQuery({ queryKey: ['wf-runs', wf.id], queryFn: () => api.get(`/spaces/${sid}/workflows/${wf.id}/runs`).then((r) => r.data) });
  const run = async () => { setRunning(true); try { await api.post(`/spaces/${sid}/workflows/${wf.id}/run`, {}); toast.success('Workflow ran'); qc.invalidateQueries({ queryKey: ['wf-runs', wf.id] }); qc.invalidateQueries({ queryKey: ['workflows', sid] }); qc.invalidateQueries({ queryKey: ['tasks', sid] }); } catch { toast.error('Run failed'); } finally { setRunning(false); } };
  const nodes = [{ id: 't', type: 'trigger', label: wf.trigger?.label || 'Trigger' }, ...(wf.nodes || [])];
  return (
    <div className="h-full flex flex-col" data-testid="workflow-detail">
      <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-[var(--nv-border-soft)]">
        <div className="font-bold text-[14px] truncate flex-1">{wf.name}</div>
        <button onClick={run} disabled={running} className="nv-btn nv-btn-soft nv-btn-sm" data-testid="wf-run"><Icon name={running ? 'loader-2' : 'play'} size={13} className={running ? 'spin' : ''} /> Test</button>
        <button onClick={() => onChange({ enabled: !wf.enabled })} className={`nv-btn nv-btn-sm ${wf.enabled ? 'nv-btn-primary' : 'nv-btn-outline'}`} data-testid="wf-toggle">{wf.enabled ? 'Active' : 'Enable'}</button>
      </div>
      <div className="flex-1 overflow-auto nv-scroll p-5">
        <div className="max-w-md mx-auto space-y-0">
          {nodes.map((n, i) => (
            <div key={n.id}>
              <div className="nv-card p-3 flex items-center gap-3" data-testid="wf-node">
                <div className={`stat-icon ${n.type === 'ai' ? 'tone-ai' : 'tone-slate'}`} style={{ width: 34, height: 34 }}><Icon name={NODE_ICON[n.type] || 'circle'} size={16} /></div>
                <div className="min-w-0"><div className="text-[10px] nv-faint uppercase font-bold tracking-wide">{n.type}</div><div className="text-[13px] font-semibold truncate">{n.label}</div></div>
              </div>
              {i < nodes.length - 1 && <div className="h-5 w-px bg-[var(--nv-border)] mx-auto" />}
            </div>
          ))}
        </div>
        <div className="max-w-md mx-auto mt-6">
          <div className="nv-eyebrow mb-2">Run history</div>
          {runs.length ? runs.slice(0, 8).map((r) => (
            <div key={r.id} className="nv-card-2 p-2.5 mb-1.5 text-[12px]">
              <div className="flex items-center gap-2 mb-1"><span className={`w-1.5 h-1.5 rounded-full bg-[var(--nv-${r.status === 'success' ? 'green' : 'red'})]`} /><span className="font-semibold capitalize">{r.status}</span><span className="nv-faint ml-auto">{ago(r.created_at)}</span></div>
              {(r.logs || []).map((l, idx) => <div key={idx} className="flex items-center gap-1.5 nv-muted pl-3.5"><Icon name={l.status === 'ok' ? 'check' : l.status === 'failed' ? 'x' : 'minus'} size={11} /> {l.label}{l.detail ? ` — ${l.detail}` : ''}</div>)}
            </div>
          )) : <div className="text-[12px] nv-faint">No runs yet — hit Test.</div>}
        </div>
      </div>
    </div>
  );
}

export default function Workflows() {
  const { active } = useActiveSpace();
  const sid = active?.id;
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const { data: wfs = [], isLoading } = useQuery({ queryKey: ['workflows', sid], queryFn: () => api.get(`/spaces/${sid}/workflows`).then((r) => r.data), enabled: !!sid });

  const create = async (tpl) => {
    const body = tpl ? { name: tpl[1], description: tpl[2], trigger: { type: tpl[4], label: tpl[2] }, nodes: tpl[3], enabled: true } : { name: 'New Workflow' };
    try { const { data } = await api.post(`/spaces/${sid}/workflows`, body); await qc.invalidateQueries({ queryKey: ['workflows', sid] }); setSelected(data.id); } catch { toast.error('Could not create'); }
  };
  const patchWf = async (id, body) => { try { await api.patch(`/spaces/${sid}/workflows/${id}`, body); qc.invalidateQueries({ queryKey: ['workflows', sid] }); } catch { toast.error('Could not update'); } };
  const del = async (id) => { try { await api.delete(`/spaces/${sid}/workflows/${id}`); if (selected === id) setSelected(null); qc.invalidateQueries({ queryKey: ['workflows', sid] }); } catch { toast.error('Could not delete'); } };

  const totalRuns = wfs.reduce((s, w) => s + (w.stats?.runs || 0), 0);
  const totalSucc = wfs.reduce((s, w) => s + (w.stats?.success || 0), 0);
  const totalFail = wfs.reduce((s, w) => s + (w.stats?.failed || 0), 0);
  const active_ = wfs.filter((w) => w.enabled).length;
  const STATS = [['zap', 'Active', active_, 'green'], ['play-circle', 'Total Runs', totalRuns, 'blue'], ['check-circle-2', 'Successful', totalSucc, 'green'], ['alert-circle', 'Failed', totalFail, 'red']];
  const selWf = wfs.find((w) => w.id === selected);

  return (
    <div className="h-full flex" data-testid="workflows-page">
      <div className="flex-1 min-w-0 overflow-auto nv-scroll px-6 py-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="nv-h1">Workflows</h1>
          <button onClick={() => create()} className="nv-btn nv-btn-primary" data-testid="create-workflow"><Icon name="plus" size={15} /> Create Workflow</button>
        </div>
        <p className="text-[13px] nv-muted mb-5">Automate work across {active?.name || 'your Space'} with triggers, actions, AI and integrations.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {STATS.map(([ic, l, v, tone]) => (
            <div key={l} className="nv-card p-3.5"><div className="flex items-center gap-2 mb-2"><div className={`stat-icon tone-${tone}`} style={{ width: 28, height: 28, borderRadius: 8 }}><Icon name={ic} size={14} /></div><span className="text-[12px] nv-muted font-semibold">{l}</span></div><div className="text-[24px] font-extrabold">{v}</div></div>
          ))}
        </div>

        {isLoading ? <Loading /> : wfs.length ? (
          <div className="nv-card overflow-hidden mb-6">
            {wfs.map((w) => (
              <div key={w.id} onClick={() => setSelected(w.id)} className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--nv-border-soft)] cursor-pointer hover:bg-[var(--nv-card-2)] ${selected === w.id ? 'bg-[var(--nv-card-2)]' : ''}`} data-testid="workflow-row">
                <div className="stat-icon tone-slate shrink-0" style={{ width: 34, height: 34 }}><Icon name={w.icon || 'workflow'} size={16} /></div>
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold truncate">{w.name}</div><div className="text-[11px] nv-faint truncate">{w.trigger?.label} · {(w.nodes || []).length} steps</div></div>
                <div className="text-[12px] nv-muted hidden sm:block">{w.stats?.runs || 0} runs</div>
                <button onClick={(e) => { e.stopPropagation(); patchWf(w.id, { enabled: !w.enabled }); }} className={`nv-tag tone-${w.enabled ? 'green' : 'slate'}`} data-testid="wf-row-toggle">{w.enabled ? 'Active' : 'Paused'}</button>
                <button onClick={(e) => { e.stopPropagation(); del(w.id); }} className="text-[var(--nv-faint)] hover:text-[var(--nv-red)]"><Icon name="trash-2" size={15} /></button>
              </div>
            ))}
          </div>
        ) : <div className="nv-card mb-6"><Empty icon="workflow" title="No workflows yet" hint="Automate your first process — pick a template below or create one." /></div>}

        <div className="nv-eyebrow mb-3">Templates</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => (
            <button key={t[1]} onClick={() => create(t)} className="nv-card p-4 text-left hover:border-[var(--nv-border)] transition-colors" data-testid="workflow-template">
              <div className="stat-icon tone-slate mb-2.5" style={{ width: 34, height: 34 }}><Icon name={t[0]} size={16} /></div>
              <div className="text-[13.5px] font-bold">{t[1]}</div><div className="text-[11px] nv-faint mt-0.5">{t[2]}</div>
            </button>
          ))}
        </div>
      </div>
      {selWf && <div className="w-[420px] shrink-0 border-l border-[var(--nv-border-soft)] bg-[var(--nv-sidebar)] hidden lg:block"><Detail sid={sid} wf={selWf} onChange={(b) => patchWf(selWf.id, b)} /></div>}
    </div>
  );
}
