import React, { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../lib/icons';
import { useActiveSpace } from '../lib/spaces';

const EXAMPLES = [
  ['folder-kanban', 'Project Manager', 'Tasks, timeline, team, reports'],
  ['users', 'CRM', 'Leads, contacts, pipeline'],
  ['package', 'Inventory', 'Products, stock, suppliers'],
  ['user-round', 'Client Portal', 'Clients, projects, documents'],
];
const INCLUDES = [['file-text', 'Pages', '5+ pages'], ['database', 'Database', 'Structured data'], ['workflow', 'Workflows', 'Automations'], ['sparkles', 'AI Actions', 'Smart features']];

export default function AppBuilder() {
  const { active } = useActiveSpace();
  const [prompt, setPrompt] = useState('Build a project management app with projects, tasks, team members, deadlines, Kanban, timeline, and overdue notifications.');
  const build = () => toast('Connect an AI key in Settings to generate your app.', { description: 'App Builder generation runs on your configured model.' });
  return (
    <div className="min-h-full px-6 py-10 fade-up" data-testid="app-builder">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 nv-chip mb-6"><Icon name="layout-grid" size={14} /> AI App Builder</div>
        <h1 className="text-[38px] font-extrabold tracking-tight leading-tight">Describe the app you want to build</h1>
        <p className="text-[15px] nv-muted mt-3 max-w-xl mx-auto">Turn your idea into a complete, powerful application — with data, pages, workflows and AI, all in {active?.name || 'your Space'}.</p>

        <div className="nv-card mt-8 p-2 text-left">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full bg-transparent resize-none outline-none p-3 text-[14px] leading-relaxed" data-testid="app-prompt" />
          <div className="flex items-center gap-2 flex-wrap px-1 pb-1">
            <button className="nv-chip nv-btn-sm"><Icon name="image" size={13} /> Use a reference image</button>
            <button className="nv-chip nv-btn-sm"><Icon name="database" size={13} /> Connect data</button>
            <button className="nv-chip nv-btn-sm"><Icon name="blocks" size={13} /> Add integrations</button>
            <button className="nv-chip nv-btn-sm"><Icon name="cpu" size={13} /> Model</button>
            <button onClick={build} className="nv-btn nv-btn-primary ml-auto" data-testid="build-app"><Icon name="sparkles" size={15} /> Build app</button>
          </div>
        </div>

        <div className="mt-10 text-left">
          <div className="nv-eyebrow mb-3">Try an example</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {EXAMPLES.map(([ic, t, d]) => (
              <button key={t} onClick={() => setPrompt(`Build a ${t.toLowerCase()} app: ${d}.`)} className="nv-card p-3.5 text-left hover:border-[var(--nv-border)] transition-colors" data-testid="app-example">
                <div className="stat-icon tone-slate mb-2.5" style={{ width: 32, height: 32 }}><Icon name={ic} size={16} /></div>
                <div className="text-[13px] font-bold">{t}</div>
                <div className="text-[11px] nv-faint mt-0.5">{d}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="nv-card mt-8 p-5 text-left">
          <div className="inline-flex items-center gap-2 nv-chip mb-3"><Icon name="sparkles" size={13} /> AI Generated</div>
          <div className="text-[18px] font-extrabold">Your app will include</div>
          <div className="text-[13px] nv-muted mt-1 mb-4">Notevoro will create a complete application with everything you need — instantly.</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {INCLUDES.map(([ic, t, d]) => (
              <div key={t} className="nv-card-2 p-3"><div className="stat-icon tone-slate mb-2" style={{ width: 30, height: 30 }}><Icon name={ic} size={15} /></div><div className="text-[13px] font-bold">{t}</div><div className="text-[11px] nv-faint">{d}</div></div>
            ))}
          </div>
        </div>
        <div className="text-[12px] nv-faint mt-8 flex items-center justify-center gap-2"><Icon name="sparkles" size={13} /> From idea to fully functional app — in seconds.</div>
      </div>
    </div>
  );
}
