import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useActiveSpace } from '../lib/spaces';
import { Icon } from '../lib/icons';
import { Loading, Empty, ago } from '../lib/ui';

export default function Favorites() {
  const { active } = useActiveSpace();
  const nav = useNavigate();
  const sid = active?.id;
  const { data: pages = [], isLoading } = useQuery({ queryKey: ['pages-list', sid], queryFn: () => api.get(`/spaces/${sid}/pages`).then((r) => (Array.isArray(r.data) ? r.data : r.data?.items || [])), enabled: !!sid });
  const favs = pages.filter((p) => p.is_favorite);
  return (
    <div className="px-6 py-6 fade-up" data-testid="favorites-page">
      <div className="flex items-center gap-2.5 mb-1"><Icon name="star" size={22} className="text-[var(--nv-amber)]" /><h1 className="nv-h1">Favorites</h1></div>
      <p className="text-[13px] nv-muted mb-5">Your starred pages in {active?.name || 'this Space'}.</p>
      {isLoading ? <Loading /> : favs.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {favs.map((p) => (
            <button key={p.id} onClick={() => nav(`/dashboard/pages/${p.id}`)} className="nv-card p-4 text-left hover:border-[var(--nv-border)] transition-colors" data-testid="fav-page">
              <div className="flex items-center gap-2.5 mb-2"><div className="w-9 h-9 rounded-lg bg-[var(--nv-card-2)] border border-[var(--nv-border-soft)] grid place-items-center"><Icon name={p.icon || 'file-text'} size={17} /></div><Icon name="star" size={15} className="text-[var(--nv-amber)] ml-auto" /></div>
              <div className="text-[14px] font-bold truncate">{p.title || 'Untitled'}</div>
              <div className="text-[11px] nv-faint mt-0.5">Updated {ago(p.updated_at)}</div>
            </button>
          ))}
        </div>
      ) : <div className="nv-card"><Empty icon="star" title="No favorites yet" hint="Star a page (☆ on any page) to pin it here for quick access." action={<button className="nv-btn nv-btn-primary nv-btn-sm" onClick={() => nav('/dashboard')} data-testid="fav-go-home"><Icon name="home" size={13} /> Go to Home</button>} /></div>}
    </div>
  );
}
