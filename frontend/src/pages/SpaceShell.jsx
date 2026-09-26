import { createContext, useContext } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { Avatar, Icon, SpaceIcon } from '../lib/icons';
import { ErrorState, Loading } from '../lib/ui';
import { Popover } from '../components/Chrome';

const SpaceCtx = createContext(null);
export const useSpace = () => useContext(SpaceCtx);

// ----------------------------------------------------------------------------
// Sidebar navigation — flat structure matching the new Notevoro 2 design.
// Simple, clean navigation with visual separators between major sections.
// ----------------------------------------------------------------------------
const NAV_ITEMS = [
  // Core Space destinations
  { key: 'home',     label: 'Home',     icon: 'home',        route: '' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar',    route: 'calendar' },
  { key: 'activity', label: 'Activity', icon: 'activity',    route: 'activity' },
  // Separator (rendered as visual gap)
  { separator: true },
  // Personal work layer
  { key: 'my-work',  label: 'My Work',  icon: 'user',        route: 'my-work', teamOnly: true },
  // Separator
  { separator: true },
  // Pages
  { key: 'pages',    label: 'Pages',    icon: 'file-stack',  route: 'pages' },
  // Separator
  { separator: true },
  // Favorites (placeholder for future implementation)
  { key: 'favorites', label: 'Favorites', icon: 'star', route: 'favorites', placeholder: true },
  // Separator
  { separator: true },
  // Agents
  { key: 'agents',   label: 'Agents',   icon: 'bot',         route: 'voro' },
];

const KIND_ROUTE = { notes: 'notes', pages: 'pages', documents: 'documents', files: 'files', knowledge: 'knowledge', tasks: 'tasks', projects: 'projects', calendar: 'calendar', meetings: 'meetings', chat: 'chat', team: 'team', activity: 'activity' };
export const capRoute = (c) => (c.kind === 'records' ? `m/${c.key}` : c.kind === 'tool' ? `tools/${c.key}` : c.kind === 'view' ? c.key : KIND_ROUTE[c.kind] || c.key);

export default function SpaceShell() {
  const { spaceId } = useParams();
  const nav = useNavigate();
  const user = useApp((s) => s.user);
  const { data: space, isLoading, error, refetch } = useQuery({ queryKey: ['space', spaceId], queryFn: () => api.get(`/spaces/${spaceId}`).then((r) => r.data) });
  const { data: spaces = [] } = useQuery({ queryKey: ['spaces'], queryFn: () => api.get('/spaces').then((r) => r.data) });
  const { data: inbox } = useQuery({ queryKey: ['inbox-count'], queryFn: () => api.get('/inbox', { params: { limit: 1 } }).then((r) => r.data), refetchInterval: 45000 });

  if (isLoading) return <div className="h-screen grid place-items-center"><Loading label="Entering Space…" /></div>;
  if (error) return <div className="h-screen p-8"><ErrorState error={error} onRetry={refetch} /><button className="nv-btn nv-btn-outline ml-4" onClick={() => nav('/dashboard/spaces')}>Back</button></div>;

  const isTeam = space.type === 'team';

  return (
    <SpaceCtx.Provider value={{ space, spaceId, role: space.role, canWrite: ['owner', 'admin', 'member'].includes(space.role), isAdmin: ['owner', 'admin'].includes(space.role) }}>
      <div className="h-screen flex overflow-hidden bg-[#faf9fb]" data-testid="space-shell">
        {/* ==== Fixed left rail ==== */}
        <aside className="w-[240px] shrink-0 bg-white border-r border-[var(--nv-border)] flex flex-col sticky top-0 h-screen" data-testid="space-sidebar">
          {/* Space Header */}
          <div className="px-3 pt-4 pb-3 border-b border-[var(--nv-border)]/60">
            <Popover align="left" width={280} testId="space-switcher-trigger" trigger={
              <button className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#f6f5fa] text-left border border-transparent hover:border-[var(--nv-border)] transition-colors" data-testid="space-header-button">
                <SpaceIcon icon={space.icon} accent={space.accent} size={38} radius={10} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-extrabold truncate leading-tight">{space.name}</div>
                  <div className="text-[11px] nv-muted capitalize leading-tight mt-0.5">{space.type} Space</div>
                </div>
                <Icon name="chevron-down" size={13} className="nv-faint" />
              </button>}>
              {(close) => <SpaceSwitcher spaces={spaces} current={space} onPick={(id) => { close(); nav(`/dashboard/spaces/${id}`); }} onBrain={() => { close(); nav('/dashboard'); }} onCreate={() => { close(); nav('/dashboard/spaces/new'); }} />}
            </Popover>
          </div>



          {/* Nav */}
          <nav className="flex-1 overflow-auto nv-scroll px-2 pt-1.5 pb-2" data-testid="space-nav">
            {NAV_ITEMS.map((item, index) => {
              if (item.separator) {
                return <div key={`separator-${index}`} className="h-4" />;
              }
              if (item.teamOnly && !isTeam) return null;
              if (item.placeholder) {
                return (
                  <button
                    key={item.key}
                    className="w-full flex items-center gap-2.5 h-8 px-2 rounded-lg hover:bg-[#f4f3f7] text-left opacity-50 cursor-not-allowed"
                    data-testid={`space-nav-${item.key}`}
                    disabled
                  >
                    <Icon name={item.icon} size={14} className="nv-faint" />
                    <span className="text-[13px] font-semibold flex-1">{item.label}</span>
                  </button>
                );
              }
              const to = item.route ? `/dashboard/spaces/${spaceId}/${item.route}` : `/dashboard/spaces/${spaceId}`;
              return (
                <NavLink
                  key={item.key}
                  to={to}
                  end={item.key === 'home'}
                  className={({ isActive }) => `flex items-center gap-2.5 h-8 px-2 rounded-lg ${isActive ? 'bg-[#eeebfe] text-[#5b43e6] font-bold' : 'hover:bg-[#f4f3f7] font-semibold'}`}
                  data-testid={`space-nav-${item.key}`}
                >
                  <Icon name={item.icon} size={14} className="nv-faint" />
                  <span className="text-[13px] flex-1">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Footer account */}
          <div className="px-2 py-2 border-t border-[var(--nv-border)]">
            <button className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#f4f3f7] text-left" onClick={() => nav('/dashboard/settings')} data-testid="space-sidebar-account">
              <Avatar user={user} size={30} />
              <div className="text-[13px] font-bold flex-1 truncate">{user?.name}</div>
              <Icon name="chevron-down" size={13} className="nv-faint" />
            </button>
          </div>
        </aside>

        {/* ==== Main workspace ==== */}
        <div className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </div>
      </div>
    </SpaceCtx.Provider>
  );
}

function SpaceSwitcher({ spaces, current, onPick, onBrain, onCreate }) {
  const groups = [['Personal Spaces', spaces.filter((s) => s.type === 'personal')], ['Team Spaces', spaces.filter((s) => s.type === 'team')]];
  return (
    <div className="p-2" data-testid="space-switcher">
      <div className="px-3 py-2 nv-eyebrow">Current Space</div>
      <div className="flex items-center gap-3 px-3 py-1.5">
        <SpaceIcon icon={current.icon} accent={current.accent} size={28} radius={8} />
        <div className="text-[13px] font-bold">{current.name}</div>
        <Icon name="check" size={14} className="ml-auto text-[#6e56f5]" />
      </div>
      {groups.map(([label, list]) => list.length > 0 && (
        <div key={label}>
          <div className="px-3 pt-3 pb-1 nv-eyebrow">{label}</div>
          {list.map((s) => (
            <button key={s.id} className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-[#f4f2ff] text-left" onClick={() => onPick(s.id)} data-testid={`switcher-space-${s.id}`}>
              <SpaceIcon icon={s.icon} accent={s.accent} size={24} radius={7} />
              <span className="text-[13px] font-semibold truncate">{s.name}</span>
            </button>
          ))}
        </div>
      ))}
      <div className="border-t border-[var(--nv-border)] mt-2 pt-2 space-y-0.5">
        <button className="w-full flex items-center gap-2.5 h-8 px-3 rounded-lg hover:bg-[#f4f3f7] text-left" onClick={onCreate} data-testid="switcher-create"><Icon name="plus" size={13} /> <span className="text-[13px] font-semibold">Create Space</span></button>
        <button className="w-full flex items-center gap-2.5 h-8 px-3 rounded-lg hover:bg-[#f4f3f7] text-left" onClick={onBrain} data-testid="switcher-brain"><Icon name="arrow-left" size={13} /> <span className="text-[13px] font-semibold">Back to Brain</span></button>
      </div>
    </div>
  );
}

export function PageHeader({ icon, title, subtitle, actions, children }) {
  return (
    <div className="px-7 pt-6 pb-4 flex items-start gap-3" data-testid="page-header">
      {icon && <div className="stat-icon tone-violet"><Icon name={icon} size={18} /></div>}
      <div className="flex-1 min-w-0"><h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>{subtitle && <div className="text-xs nv-muted mt-0.5">{subtitle}</div>}{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function MemberAvatar({ userId, size = 22 }) {
  const { space } = useSpace();
  const m = (space.members || []).find((x) => x.user.id === userId);
  return m ? <Avatar user={m.user} size={size} /> : null;
}
