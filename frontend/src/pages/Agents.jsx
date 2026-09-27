import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useActiveSpace } from '../lib/spaces';
import { Icon } from '../lib/icons';
import { Loading, Empty, ago } from '../lib/ui';

const CATS = ['Project management', 'Marketing', 'Operations', 'Sales', 'HR', 'Product & Engineering'];
const TEMPLATES = [
  ['radar', 'Competitor Watch', 'Track competitors, pricing and hiring; deliver a weekly intelligence brief.'],
  ['calendar-check', 'Project Guardian', 'Find overdue tasks, summarize blockers every morning and prepare follow-ups.'],
  ['mail', 'Inbox Triage', 'Read incoming messages, classify urgency and draft replies.'],
  ['bar-chart-3', 'Metrics Analyst', 'Analyze your databases and post a daily performance digest.'],
];
const PERMS = [['read', 'Read', 'Pages, tasks, files'], ['create', 'Create', 'Tasks, pages, comments'], ['modify', 'Modify', 'Tasks, projects, records'], ['external', 'External', 'Emails, messages, integrations']];

function Builder({ sid, agent, onBack }) {
  const qc = useQueryClient();
  const [name, setName] = useState(agent.name);
  const [instructions, setInstructions] = useState(agent.instructions || agent.description || '');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const cfg = agent.config || {};
  const perms = cfg.permissions || {};
  const { data: runs = [] } = useQuery({ queryKey: ['agent-runs', agent.id], queryFn: () => api.get(`/spaces/${sid}/agents/${agent.id}/runs`).then((r) => r.data) });

  const patch = async (body) => { try { await api.patch(`/spaces/${sid}/agents/${agent.id}`, body); qc.invalidateQueries({ queryKey: ['agents', sid] }); } catch { toast.error('Could not save'); } };
  const togglePerm = (k) => patch({ config: { ...cfg, permissions: { ...perms, [k]: !perms[k] } } });
  const run = async () => {
    setRunning(true); setOutput(null);
    try { const { data } = await api.post(`/spaces/${sid}/agents/${agent.id}/run`, {}); setOutput(data.output); qc.invalidateQueries({ queryKey: ['agent-runs', agent.id] }); }
    catch (e) { const code = e?.response?.data?.error?.code; toast.error(code === 'AI_NOT_CONFIGURED' ? 'Add an AI key in Settings to run agents' : 'Agent run failed'); }
    finally { setRunning(false); }
  };

  return (
    <div className="h-full flex flex-col" data-testid="agent-builder">
      <div className="h-12 shrink-0 flex items-center gap-2.5 px-5 border-b border-[var(--nv-border-soft)]">
        <button onClick={onBack} className="nv-btn nv-btn-ghost w-8 px-0"><Icon name="arrow-left" size={16} /></button>
        <div className="w-7 h-7 rounded-lg tone-ai grid place-items-center"><Icon name={agent.icon || 'bot'} size={15} /></div>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== agent.name && patch({ name })} className="bg-transparent outline-none font-bold text-[14px]" data-testid="agent-name" />
        <button onClick={run} disabled={running} className="ml-auto nv-btn nv-btn-primary nv-btn-sm" data-testid="agent-run"><Icon name={running ? 'loader-2' : 'play'} size={13} className={running ? 'spin' : ''} /> {running ? 'Running…' : 'Test run'}</button>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        {/* Left: conversational */}
        <div className="overflow-auto nv-scroll p-5 border-r border-[var(--nv-border-soft)]">
          <div className="nv-eyebrow mb-2">Purpose &amp; instructions</div>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} onBlur={() => patch({ instructions })} rows={6} className="nv-input" data-testid="agent-instructions" />
          <div className="nv-eyebrow mt-5 mb-2">Latest output</div>
          {running ? <Loading label="Agent is thinking…" /> : output ? <div className="nv-card p-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap prose-nv">{output}</div>
            : runs[0] ? <div className="nv-card p-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">{runs[0].output}</div>
            : <Empty icon="play" title="No runs yet" hint="Hit Test run to see your agent work." />}
        </div>
        {/* Right: structured config */}
        <div className="overflow-auto nv-scroll p-5 space-y-5">
          <div>
            <div className="nv-eyebrow mb-2">Brain</div>
            <div className="nv-card p-3 flex items-center gap-2.5"><div className="stat-icon tone-ai" style={{ width: 30, height: 30 }}><Icon name="cpu" size={15} /></div><div><div className="text-[13px] font-bold">Emergent · gpt-5.4</div><div className="text-[11px] nv-faint">Reasoning model</div></div></div>
          </div>
          <div>
            <div className="nv-eyebrow mb-2">Permissions</div>
            <div className="space-y-2">
              {PERMS.map(([k, label, desc]) => (
                <button key={k} onClick={() => togglePerm(k)} className="w-full nv-card p-3 flex items-center gap-3 text-left" data-testid={`perm-${k}`}>
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-bold">{label}</div><div className="text-[11px] nv-faint">{desc}</div></div>
                  <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${perms[k] ? 'bg-[var(--nv-green)]' : 'bg-[var(--nv-border)]'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${perms[k] ? 'translate-x-4' : ''}`} /></div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="nv-eyebrow mb-2">Activity</div>
            {runs.length ? <div className="space-y-1.5">{runs.slice(0, 6).map((r) => <div key={r.id} className="flex items-center gap-2 text-[12px]"><span className={`w-1.5 h-1.5 rounded-full bg-[var(--nv-${r.status === 'completed' ? 'green' : 'red'})]`} /><span className="nv-muted flex-1 truncate">Run · {r.output?.slice(0, 40)}…</span><span className="nv-faint">{ago(r.created_at)}</span></div>)}</div> : <div className="text-[12px] nv-faint">No activity yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Agents() {
  const { active } = useActiveSpace();
  const sid = active?.id;
  const qc = useQueryClient();
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Project management');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const { data: agents = [], isLoading } = useQuery({ queryKey: ['agents', sid], queryFn: () => api.get(`/spaces/${sid}/agents`).then((r) => r.data), enabled: !!sid });

  const create = async (description) => {
    const text = (description ?? desc).trim();
    if (!text) return toast('Describe what your agent should do first.');
    setCreating(true);
    try { const { data } = await api.post(`/spaces/${sid}/agents`, { description: text }); setDesc(''); await qc.invalidateQueries({ queryKey: ['agents', sid] }); setSelected(data); }
    catch { toast.error('Could not create agent'); }
    finally { setCreating(false); }
  };

  if (selected) return <Builder sid={sid} agent={agents.find((a) => a.id === selected.id) || selected} onBack={() => setSelected(null)} />;

  return (
    <div className="min-h-full px-6 py-10 fade-up" data-testid="agents-page">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <h1 className="text-[38px] font-extrabold tracking-tight">Create an AI Agent</h1>
          <p className="text-[15px] nv-muted mt-2">What do you want your agent to do?</p>
        </div>
        <div className="nv-card mt-7 p-2 nv-ring-ai">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="e.g. Monitor my projects, find overdue tasks, summarize blockers every morning and prepare follow-up tasks." className="w-full bg-transparent resize-none outline-none p-3 text-[14px] leading-relaxed" data-testid="agent-prompt" />
          <div className="flex items-center gap-2 px-1 pb-1">
            <button className="nv-chip nv-btn-sm"><Icon name="paperclip" size={13} /> Add context</button>
            <button className="nv-chip nv-btn-sm"><Icon name="cpu" size={13} /> gpt-5.4</button>
            <button onClick={() => create()} disabled={creating} className="nv-btn nv-btn-primary ml-auto w-10 px-0" data-testid="create-agent"><Icon name={creating ? 'loader-2' : 'arrow-up'} size={16} className={creating ? 'spin' : ''} /></button>
          </div>
        </div>

        {isLoading ? <div className="mt-8"><Loading /></div> : agents.length > 0 && (
          <div className="mt-8">
            <div className="nv-eyebrow mb-3">My Agents</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((a) => (
                <button key={a.id} onClick={() => setSelected(a)} className="nv-card p-4 text-left hover:border-[var(--nv-border)] transition-colors flex gap-3" data-testid="my-agent">
                  <div className="stat-icon tone-ai shrink-0" style={{ width: 38, height: 38 }}><Icon name={a.icon || 'bot'} size={18} /></div>
                  <div className="min-w-0 flex-1"><div className="text-[14px] font-bold truncate">{a.name}</div><div className="text-[12px] nv-muted mt-0.5 leading-snug line-clamp-2">{a.description}</div></div>
                  <span className={`nv-tag tone-${a.status === 'active' ? 'green' : 'slate'} h-fit`}>{a.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap justify-center mt-9">
          {CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={`px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition-colors ${cat === c ? 'bg-[var(--nv-primary)] text-[var(--nv-primary-fg)]' : 'nv-chip'}`}>{c}</button>)}
        </div>
        <div className="mt-6">
          <div className="text-[15px] font-bold mb-3">{cat} templates</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map(([ic, t, d]) => (
              <button key={t} onClick={() => create(d)} className="nv-card p-4 text-left hover:border-[var(--nv-border)] transition-colors flex gap-3" data-testid="agent-template">
                <div className="stat-icon tone-slate shrink-0" style={{ width: 38, height: 38 }}><Icon name={ic} size={18} /></div>
                <div className="min-w-0"><div className="text-[14px] font-bold">{t}</div><div className="text-[12px] nv-muted mt-0.5 leading-snug">{d}</div></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
