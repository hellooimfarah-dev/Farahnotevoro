import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useActiveSpace } from '../lib/spaces';
import { useApp } from '../lib/store';
import { Icon, Avatar } from '../lib/icons';

const SUGGESTIONS = [
  ['sparkles', 'Summarize what needs my attention this week'],
  ['target', 'Find blockers across my projects'],
  ['list-checks', 'What are my highest-priority tasks right now?'],
  ['calendar', 'What deadlines are coming up in the next 7 days?'],
];

function Bubble({ m, user }) {
  const mine = m.role === 'user';
  return (
    <div className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`} data-testid={`msg-${m.role}`}>
      {mine ? <Avatar user={user} size={30} /> : <div className="w-[30px] h-[30px] rounded-lg tone-ai grid place-items-center shrink-0"><Icon name="sparkles" size={16} /></div>}
      <div className={`max-w-[76%] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${mine ? 'bubble-me' : 'bubble-them'}`}>{m.content || (m._pending ? '' : '…')}
        {m._pending && <span className="inline-flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" /><span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" style={{ animationDelay: '.2s' }} /><span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" style={{ animationDelay: '.4s' }} /></span>}
      </div>
    </div>
  );
}

export default function VoroAI() {
  const { active } = useActiveSpace();
  const user = useApp((s) => s.user);
  const sid = active?.id;
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [local, setLocal] = useState([]); // optimistic + pending
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const { data: history = [] } = useQuery({ queryKey: ['voro-history', sid], queryFn: () => api.get(`/voro/history?space_id=${sid}`).then((r) => r.data), enabled: !!sid });

  const messages = [...history, ...local];
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages.length, busy]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy || !sid) return;
    setInput('');
    setLocal((l) => [...l, { id: `u-${Date.now()}`, role: 'user', content: msg }, { id: `a-${Date.now()}`, role: 'assistant', content: '', _pending: true }]);
    setBusy(true);
    try {
      await api.post('/voro/ask', { message: msg, space_id: sid });
      setLocal([]);
      await qc.invalidateQueries({ queryKey: ['voro-history', sid] });
      qc.invalidateQueries({ queryKey: ['home', sid] });
      qc.invalidateQueries({ queryKey: ['tasks', sid] });
    } catch (e) {
      setLocal((l) => l.filter((x) => !x._pending));
      const code = e?.response?.data?.error?.code || e?.response?.data?.detail?.code;
      if (code === 'AI_NOT_CONFIGURED') toast.error('AI is not configured', { description: 'Add an OpenAI key in Settings to use Voro.' });
      else toast.error('Voro could not respond', { description: 'Please try again.' });
    } finally { setBusy(false); }
  };

  const empty = messages.length === 0;

  return (
    <div className="h-full flex flex-col" data-testid="voro-chat">
      <div className="h-12 shrink-0 flex items-center gap-2.5 px-5 border-b border-[var(--nv-border-soft)]">
        <div className="w-7 h-7 rounded-lg tone-ai grid place-items-center"><Icon name="sparkles" size={15} /></div>
        <div className="font-bold text-[14px]">Voro AI</div>
        <span className="text-[12px] nv-faint">· {active?.name || 'Workspace'}</span>
        <button onClick={() => { setLocal([]); qc.invalidateQueries({ queryKey: ['voro-history', sid] }); }} className="ml-auto nv-btn nv-btn-ghost nv-btn-sm" data-testid="voro-refresh"><Icon name="rotate-cw" size={14} /> Refresh</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto nv-scroll">
        {empty ? (
          <div className="h-full grid place-items-center px-6">
            <div className="max-w-xl w-full text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto grid place-items-center tone-ai nv-ring-ai"><Icon name="sparkles" size={26} /></div>
              <h1 className="text-[26px] font-extrabold tracking-tight mt-4">How can I help in {active?.name || 'your workspace'}?</h1>
              <p className="text-[14px] nv-muted mt-1.5">I understand this Space — its tasks, projects, notes and deadlines.</p>
              <div className="grid sm:grid-cols-2 gap-2.5 mt-6">
                {SUGGESTIONS.map(([ic, s]) => (
                  <button key={s} onClick={() => send(s)} className="nv-card px-3.5 py-3 text-left text-[13px] hover:border-[var(--nv-border)] transition-colors flex items-center gap-2.5" data-testid="voro-suggestion"><Icon name={ic} size={15} className="nv-faint shrink-0" /> {s}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
            {messages.map((m) => <Bubble key={m.id} m={m} user={user} />)}
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 pb-5 pt-2">
        <div className="max-w-3xl mx-auto nv-card p-2 flex items-end gap-2 nv-ring-ai">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1} placeholder="Message Voro…  (Enter to send)" className="flex-1 bg-transparent outline-none resize-none px-2 py-1.5 text-[14px] max-h-40" data-testid="voro-input"
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }} />
          <button onClick={() => send()} disabled={busy || !input.trim()} className="nv-btn nv-btn-primary w-9 h-9 px-0 shrink-0" data-testid="voro-send"><Icon name={busy ? 'loader-2' : 'arrow-up'} size={16} className={busy ? 'spin' : ''} /></button>
        </div>
        <div className="text-center text-[10.5px] nv-faint mt-2">Voro can make mistakes. It only sees data you have access to in this Space.</div>
      </div>
    </div>
  );
}
