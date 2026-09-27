import React, { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../lib/icons';
import { useActiveSpace } from '../lib/spaces';

const SUGGESTIONS = [
  'Summarize what happened in this Space this week',
  'Find blockers across my projects',
  'Turn my notes into tasks',
  'Create a timeline from my roadmap',
  'Build a workflow for overdue tasks',
];

export default function VoroAI() {
  const { active } = useActiveSpace();
  const [q, setQ] = useState('');
  const ask = () => toast('Connect an AI key in Settings to chat with Voro.', { description: 'Voro understands ' + (active?.name || 'your Space') + ' — tasks, pages, files and more.' });
  return (
    <div className="min-h-full px-6 py-12 fade-up" data-testid="voro-ai-page">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto grid place-items-center tone-ai nv-ring-ai"><Icon name="sparkles" size={26} /></div>
        <h1 className="text-[34px] font-extrabold tracking-tight mt-5">Voro AI</h1>
        <p className="text-[15px] nv-muted mt-2">Your contextual sidekick for {active?.name || 'your workspace'}. It understands your Space, pages and everything in it.</p>
        <div className="nv-card mt-8 p-2 flex items-center gap-2 nv-ring-ai">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Voro anything about your workspace…" className="flex-1 bg-transparent outline-none px-3 text-[14px]" data-testid="voro-input" />
          <button onClick={ask} className="nv-btn nv-btn-primary w-10 px-0" data-testid="voro-ask"><Icon name="arrow-up" size={16} /></button>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setQ(s)} className="nv-card px-4 py-3 text-left text-[13px] hover:border-[var(--nv-border)] transition-colors flex items-center gap-2.5" data-testid="voro-suggestion"><Icon name="circle-help" size={14} className="nv-faint" /> {s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
