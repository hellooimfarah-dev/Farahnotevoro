import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useActiveSpace } from '../lib/spaces';
import { Icon } from '../lib/icons';
import { Loading, Empty, ago } from '../lib/ui';
import BlockEditor, { newBlock } from '../components/Blocks';

function normalizeBlocks(content) {
  if (content && Array.isArray(content.blocks)) return content.blocks;
  return [];
}

export default function Pages() {
  const params = useParams();
  const { active } = useActiveSpace();
  const sid = params.spaceId || active?.id;
  const pageId = params.pageId;
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['page', sid, pageId],
    queryFn: () => api.get(`/spaces/${sid}/pages/${pageId}`).then((r) => r.data),
    enabled: !!sid && !!pageId,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [favorite, setFavorite] = useState(false);
  const [visibility, setVisibility] = useState('private');
  const loadedFor = useRef(null);
  const saveTimer = useRef(null);
  const [saved, setSaved] = useState(true);

  // initialize local state when a page loads
  useEffect(() => {
    if (page && loadedFor.current !== page.id) {
      loadedFor.current = page.id;
      setTitle(page.title || '');
      setDescription(page.content?.description || '');
      setBlocks(normalizeBlocks(page.content));
      setFavorite(!!page.is_favorite);
      setVisibility(page.visibility || 'private');
      setSaved(true);
    }
  }, [page]);

  // debounced autosave of content (blocks + description)
  useEffect(() => {
    if (!page || loadedFor.current !== page.id) return;
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.patch(`/spaces/${sid}/pages/${pageId}`, { content: { v: 1, description, blocks } });
        setSaved(true);
      } catch { setSaved(false); }
    }, 700);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [blocks, description]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = async () => {
    if (!page || title === page.title) return;
    try { await api.patch(`/spaces/${sid}/pages/${pageId}`, { title: title || 'Untitled' }); qc.invalidateQueries({ queryKey: ['pages-tree', sid] }); qc.invalidateQueries({ queryKey: ['page', sid, pageId] }); } catch { /* ignore */ }
  };
  const toggleFavorite = async () => {
    const v = !favorite; setFavorite(v);
    try { await api.patch(`/spaces/${sid}/pages/${pageId}`, { is_favorite: v }); qc.invalidateQueries({ queryKey: ['pages-tree', sid] }); } catch { setFavorite(!v); }
  };
  const toggleShare = async () => {
    const next = visibility === 'team' ? 'private' : 'team';
    try { await api.post(`/spaces/${sid}/pages/${pageId}/visibility`, { visibility: next }); setVisibility(next); toast.success(next === 'team' ? 'Shared with the Space' : 'Set to private'); qc.invalidateQueries({ queryKey: ['pages-tree', sid] }); } catch { toast.error('Could not update sharing'); }
  };
  const addFirstBlock = (type) => setBlocks([newBlock(type)]);

  if (!sid) return <div className="p-10"><Empty icon="file-text" title="No Space selected" hint="Pick a Space to open its pages." /></div>;
  if (!pageId) return (
    <div className="p-10"><Empty icon="file-text" title="No page selected" hint="Choose a page from the sidebar, or create a new one." action={<button className="nv-btn nv-btn-primary" data-testid="pages-create" onClick={async () => { const { data } = await api.post(`/spaces/${sid}/pages`, { title: 'Untitled' }); qc.invalidateQueries({ queryKey: ['pages-tree', sid] }); nav(`/dashboard/pages/${data.id}`); }}><Icon name="plus" size={14} /> Create a page</button>} /></div>
  );
  if (isLoading) return <div className="p-10"><Loading label="Opening page…" /></div>;
  if (error) return <div className="p-10"><Empty icon="alert-circle" title="Page unavailable" hint="It may have been deleted or you don't have access." /></div>;

  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-10 py-6 fade-up" data-testid="page-editor">
      {/* breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-[12px] nv-faint min-w-0">
          <button onClick={() => nav('/dashboard')} className="hover:text-[var(--nv-text)] truncate">{active?.name || 'Space'}</button>
          <Icon name="chevron-right" size={13} /><span className="nv-muted">Pages</span>
          <Icon name="chevron-right" size={13} /><span className="text-[var(--nv-text)] font-medium truncate">{title || 'Untitled'}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] nv-faint mr-1 flex items-center gap-1">{saved ? <><Icon name="check" size={12} /> Saved</> : <><Icon name="loader-2" size={12} className="spin" /> Saving…</>}</span>
          <button onClick={toggleShare} className="nv-btn nv-btn-outline nv-btn-sm" data-testid="page-share"><Icon name={visibility === 'team' ? 'users' : 'lock'} size={13} /> {visibility === 'team' ? 'Shared' : 'Share'}</button>
          <button onClick={toggleFavorite} className="nv-btn nv-btn-ghost w-8 px-0" data-testid="page-favorite"><Icon name="star" size={16} className={favorite ? 'text-[var(--nv-amber)]' : ''} /></button>
          <button onClick={() => nav('/dashboard/voro-ai')} className="nv-btn nv-btn-ai nv-btn-sm" data-testid="page-ask-voro"><Icon name="sparkles" size={13} /> Ask Voro</button>
        </div>
      </div>

      {/* title + description */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--nv-card-2)] border border-[var(--nv-border-soft)] grid place-items-center shrink-0"><Icon name={page.icon || 'book-open'} size={22} /></div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} placeholder="Untitled" className="flex-1 bg-transparent outline-none text-[30px] font-extrabold tracking-tight" data-testid="page-title" />
        </div>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description…" className="w-full bg-transparent outline-none text-[14px] nv-muted mt-1 pl-14" data-testid="page-description" />
        <div className="text-[11px] nv-faint mt-2 pl-14">Updated {ago(page.updated_at)}</div>
      </div>

      <div className="h-px bg-[var(--nv-border-soft)] mb-5" />

      {/* blocks */}
      {blocks.length === 0 ? (
        <div className="py-6">
          <Empty icon="blocks" title="An empty canvas" hint="Add text, headings, callouts and a live Task View that stays in sync with your Space." action={
            <div className="flex items-center gap-2">
              <button className="nv-btn nv-btn-primary nv-btn-sm" onClick={() => addFirstBlock('view')} data-testid="empty-add-view"><Icon name="kanban" size={13} /> Add Task View</button>
              <button className="nv-btn nv-btn-outline nv-btn-sm" onClick={() => addFirstBlock('text')} data-testid="empty-add-text"><Icon name="type" size={13} /> Add Text</button>
            </div>
          } />
        </div>
      ) : (
        <BlockEditor blocks={blocks} setBlocks={setBlocks} spaceId={sid} />
      )}
    </div>
  );
}
