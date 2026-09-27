import React from 'react';
import { toast } from 'sonner';
import { Icon } from '../lib/icons';
import { Empty } from '../lib/ui';
import { useActiveSpace } from '../lib/spaces';

const STATS = [['zap', 'Active', 0, 'green'], ['play-circle', 'Runs Today', 0, 'blue'], ['check-circle-2', 'Successful', 0, 'green'], ['alert-circle', 'Failed', 0, 'red'], ['clock', 'Time Saved', '0h', 'amber']];
const TEMPLATES = [
  ['check-square', 'Task Completion', 'When a task is completed → update project, notify owner, AI summary'],
  ['rocket', 'New Project Setup', 'When a project is created → create task list, assign team, create folder'],
  ['video', 'Meeting Follow-up', 'When a meeting ends → transcribe, summarize, create tasks'],
  ['git-branch', 'Release Automation', 'When a release is created → build & test, deploy, notify team'],
];

export default function Workflows() {
  const { active } = useActiveSpace();
  const create = () => toast('Workflow engine is coming to this Space.', { description: 'The visual builder connects triggers, conditions, actions, AI and integrations.' });
  return (
    <div className="px-6 py-6 fade-up" data-testid="workflows-page">
      <div className="flex items-center justify-between mb-1">
        <h1 className="nv-h1">Workflows</h1>
        <button onClick={create} className="nv-btn nv-btn-primary" data-testid="create-workflow"><Icon name="plus" size={15} /> Create Workflow</button>
      </div>
      <p className="text-[13px] nv-muted mb-5">Automate work across {active?.name || 'your Space'} with rules, actions, AI and integrations.</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {STATS.map(([ic, l, v, tone]) => (
          <div key={l} className="nv-card p-3.5"><div className="flex items-center gap-2 mb-2"><div className={`stat-icon tone-${tone}`} style={{ width: 28, height: 28, borderRadius: 8 }}><Icon name={ic} size={14} /></div><span className="text-[12px] nv-muted font-semibold">{l}</span></div><div className="text-[24px] font-extrabold">{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 nv-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--nv-border-soft)] flex items-center gap-2"><Icon name="workflow" size={16} className="nv-muted" /><span className="nv-h2">All Workflows</span></div>
          <Empty icon="workflow" title="No workflows yet" hint="Automate your first process — trigger, condition, action, AI and integration." action={<button onClick={create} className="nv-btn nv-btn-primary nv-btn-sm"><Icon name="plus" size={13} /> Create Workflow</button>} />
        </div>
        <div className="nv-card p-4">
          <div className="nv-h2 mb-3">Templates</div>
          <div className="space-y-2">
            {TEMPLATES.map(([ic, t, d]) => (
              <button key={t} onClick={create} className="w-full text-left nv-card-2 p-3 hover:border-[var(--nv-border)] transition-colors flex gap-3" data-testid="workflow-template">
                <div className="stat-icon tone-slate shrink-0" style={{ width: 32, height: 32 }}><Icon name={ic} size={15} /></div>
                <div className="min-w-0"><div className="text-[13px] font-bold">{t}</div><div className="text-[11px] nv-faint leading-snug">{d}</div></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
