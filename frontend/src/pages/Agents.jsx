import React, { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../lib/icons';
import { useActiveSpace } from '../lib/spaces';

const CATS = ['Project management', 'Marketing', 'Operations', 'Sales', 'HR', 'Product & Engineering', 'Productivity'];
const TEMPLATES = [
  ['radar', 'Competitor Watch', 'Tracks competitors, pricing and hiring; delivers weekly intelligence.'],
  ['calendar-check', 'Project Guardian', 'Finds overdue tasks, summarizes blockers, prepares follow-ups every morning.'],
  ['mail', 'Inbox Triage', 'Reads incoming messages, classifies urgency and drafts replies.'],
  ['bar-chart-3', 'Metrics Analyst', 'Analyzes your databases and posts a daily performance digest.'],
  ['file-search', 'Research Assistant', 'Searches the web and your Space, then compiles cited briefs.'],
  ['users', 'Onboarding Buddy', 'Guides new members and sets up their starter tasks and pages.'],
];

export default function Agents() {
  const { active } = useActiveSpace();
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Project management');
  const create = () => {
    if (!desc.trim()) return toast('Describe what your agent should do first.');
    toast('Connect an AI key in Settings to generate your agent.', { description: 'Agents run on your configured model in ' + (active?.name || 'this Space') + '.' });
  };
  return (
    <div className="min-h-full px-6 py-10 fade-up" data-testid="agents-page">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <span />
          <div className="flex items-center gap-2">
            <button className="nv-chip nv-btn-sm"><Icon name="upload" size={13} /> Bring your agent</button>
            <button className="nv-chip nv-btn-sm"><Icon name="plus" size={13} /> Start from blank</button>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-[40px] font-extrabold tracking-tight">Create an AI Agent</h1>
          <p className="text-[15px] nv-muted mt-2">What do you want your agent to do?</p>
        </div>
        <div className="nv-card mt-7 p-2 nv-ring-ai">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="e.g. Monitor my projects, find overdue tasks, summarize blockers every morning and prepare follow-up tasks." className="w-full bg-transparent resize-none outline-none p-3 text-[14px] leading-relaxed" data-testid="agent-prompt" />
          <div className="flex items-center gap-2 px-1 pb-1">
            <button className="nv-chip nv-btn-sm"><Icon name="paperclip" size={13} /> Add context</button>
            <button className="nv-chip nv-btn-sm"><Icon name="cpu" size={13} /> AI model</button>
            <button onClick={create} className="nv-btn nv-btn-primary ml-auto w-10 px-0" data-testid="create-agent"><Icon name="arrow-up" size={16} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center mt-6">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition-colors ${cat === c ? 'bg-[var(--nv-primary)] text-[var(--nv-primary-fg)]' : 'nv-chip'}`} data-testid="agent-cat">{c}</button>
          ))}
        </div>
        <div className="mt-8">
          <div className="text-[15px] font-bold mb-3">{cat}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map(([ic, t, d]) => (
              <button key={t} onClick={() => setDesc(d)} className="nv-card p-4 text-left hover:border-[var(--nv-border)] transition-colors flex gap-3" data-testid="agent-template">
                <div className="stat-icon tone-ai shrink-0" style={{ width: 38, height: 38 }}><Icon name={ic} size={18} /></div>
                <div className="min-w-0"><div className="text-[14px] font-bold">{t}</div><div className="text-[12px] nv-muted mt-0.5 leading-snug">{d}</div></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
