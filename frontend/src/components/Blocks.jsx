import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Icon } from '../lib/icons';
import { Popover } from './Chrome';
import TaskViewBlock from './TaskViews';

export const BLOCK_TYPES = [
  ['heading', 'Heading', 'heading', 'Section title'],
  ['text', 'Text', 'type', 'Plain paragraph'],
  ['callout', 'Callout', 'lightbulb', 'Highlighted note'],
  ['view', 'Task View', 'kanban', 'Board · Table · Timeline · Calendar on your tasks'],
  ['divider', 'Divider', 'minus', 'Visual separator'],
];

let _seq = 0;
const uid = () => `b_${Date.now().toString(36)}_${(_seq++).toString(36)}`;

export function newBlock(type) {
  const base = { id: uid(), type };
  if (type === 'heading') return { ...base, text: 'New heading', level: 2 };
  if (type === 'text') return { ...base, text: '' };
  if (type === 'callout') return { ...base, text: 'Important note…', icon: 'lightbulb' };
  if (type === 'view') return { ...base, title: 'Tasks', mode: 'board', projectId: null };
  return base; // divider
}

const VIEW_MODES = [['board', 'Board', 'kanban'], ['table', 'Table', 'table'], ['timeline', 'Timeline', 'git-branch'], ['calendar', 'Calendar', 'calendar']];

function ViewBlock({ block, spaceId, update }) {
  const { data: projects = [] } = useQuery({ queryKey: ['projects', spaceId], queryFn: () => api.get(`/spaces/${spaceId}/projects?limit=50`).then((r) => r.data), enabled: !!spaceId });
  return (
    <div className="nv-card p-3.5" data-testid="block-view">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Icon name="database" size={16} className="nv-muted" />
        <input value={block.title || ''} onChange={(e) => update({ title: e.target.value })} className="bg-transparent outline-none font-bold text-[14px] w-auto min-w-[80px]" />
        <div className="flex items-center gap-0.5 ml-2 p-0.5 rounded-lg bg-[var(--nv-card-2)]">
          {VIEW_MODES.map(([k, label, ic]) => (
            <button key={k} onClick={() => update({ mode: k })} className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] font-semibold transition-colors ${block.mode === k ? 'bg-[var(--nv-primary)] text-[var(--nv-primary-fg)]' : 'nv-muted hover:text-[var(--nv-text)]'}`} data-testid={`view-mode-${k}`}>
              <Icon name={ic} size={13} /> {label}
            </button>
          ))}
        </div>
        <select value={block.projectId || ''} onChange={(e) => update({ projectId: e.target.value || null })} className="ml-auto nv-chip nv-btn-sm cursor-pointer outline-none" data-testid="view-filter">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <TaskViewBlock spaceId={spaceId} mode={block.mode} projectId={block.projectId} />
    </div>
  );
}

function BlockBody({ block, spaceId, update }) {
  if (block.type === 'divider') return <hr className="border-0 border-t border-[var(--nv-border)] my-2" />;
  if (block.type === 'heading') {
    const size = block.level === 1 ? 'text-[24px]' : block.level === 3 ? 'text-[16px]' : 'text-[19px]';
    return <input value={block.text} onChange={(e) => update({ text: e.target.value })} placeholder="Heading" className={`w-full bg-transparent outline-none font-extrabold tracking-tight ${size}`} data-testid="block-heading" />;
  }
  if (block.type === 'callout') {
    return (
      <div className="nv-card-2 p-3 flex gap-2.5 items-start border-l-2 border-[var(--nv-ai)]" data-testid="block-callout">
        <Icon name={block.icon || 'lightbulb'} size={16} className="text-[var(--nv-ai)] mt-0.5 shrink-0" />
        <textarea value={block.text} onChange={(e) => update({ text: e.target.value })} rows={1} placeholder="Write a note…" className="w-full bg-transparent outline-none resize-none text-[13.5px] leading-relaxed" />
      </div>
    );
  }
  if (block.type === 'view') return <ViewBlock block={block} spaceId={spaceId} update={update} />;
  // text
  return <textarea value={block.text} onChange={(e) => update({ text: e.target.value })} rows={1} placeholder="Type something…  press the + on the left to add blocks" className="w-full bg-transparent outline-none resize-none text-[14px] leading-relaxed nv-autosize" data-testid="block-text" onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} />;
}

function AddMenu({ onAdd, label = 'Add block', compact }) {
  return (
    <Popover align="left" width={300} testId="add-block-menu" trigger={
      compact
        ? <button className="w-6 h-6 grid place-items-center rounded-md text-[var(--nv-faint)] hover:bg-[var(--nv-card-2)] hover:text-[var(--nv-text)]" data-testid="add-block-inline"><Icon name="plus" size={15} /></button>
        : <button className="nv-btn nv-btn-soft" data-testid="add-block-btn"><Icon name="plus" size={15} /> {label}</button>
    }>
      {(close) => (
        <div className="p-1.5">
          <div className="nv-eyebrow px-2.5 pt-1 pb-1.5">Blocks</div>
          {BLOCK_TYPES.map(([type, name, ic, desc]) => (
            <button key={type} onClick={() => { onAdd(type); close(); }} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--nv-card-2)] text-left" data-testid={`add-${type}`}>
              <div className="stat-icon tone-slate shrink-0" style={{ width: 30, height: 30 }}><Icon name={ic} size={15} /></div>
              <div className="min-w-0"><div className="text-[13px] font-bold">{name}</div><div className="text-[11px] nv-faint truncate">{desc}</div></div>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export default function BlockEditor({ blocks, setBlocks, spaceId }) {
  const [hover, setHover] = useState(null);
  const update = (id, patch) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id) => setBlocks(blocks.filter((b) => b.id !== id));
  const move = (idx, dir) => {
    const j = idx + dir; if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice(); const [x] = next.splice(idx, 1); next.splice(j, 0, x); setBlocks(next);
  };
  const addAfter = (idx, type) => { const next = blocks.slice(); next.splice(idx + 1, 0, newBlock(type)); setBlocks(next); };
  const addEnd = (type) => setBlocks([...blocks, newBlock(type)]);

  return (
    <div className="space-y-1" data-testid="block-editor">
      {blocks.map((b, idx) => (
        <div key={b.id} className="group relative flex items-start gap-1" onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)}>
          <div className={`flex flex-col items-center gap-0.5 pt-1.5 transition-opacity ${hover === b.id ? 'opacity-100' : 'opacity-0'}`}>
            <AddMenu compact onAdd={(t) => addAfter(idx, t)} />
            <div className="flex flex-col">
              <button onClick={() => move(idx, -1)} className="w-6 h-4 grid place-items-center text-[var(--nv-faint)] hover:text-[var(--nv-text)]" title="Move up"><Icon name="chevron-up" size={13} /></button>
              <button onClick={() => move(idx, 1)} className="w-6 h-4 grid place-items-center text-[var(--nv-faint)] hover:text-[var(--nv-text)]" title="Move down"><Icon name="chevron-down" size={13} /></button>
            </div>
            <button onClick={() => remove(b.id)} className="w-6 h-5 grid place-items-center text-[var(--nv-faint)] hover:text-[var(--nv-red)]" title="Delete" data-testid="block-delete"><Icon name="trash-2" size={13} /></button>
          </div>
          <div className="flex-1 min-w-0 py-0.5">
            <BlockBody block={b} spaceId={spaceId} update={(patch) => update(b.id, patch)} />
          </div>
        </div>
      ))}
      <div className="pt-3 pl-7">
        <AddMenu onAdd={addEnd} />
      </div>
    </div>
  );
}
