import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { useSpaces, useActiveSpace } from '../lib/spaces';
import { Icon, SpaceIcon, Avatar } from '../lib/icons';
import { Popover, NotificationsMenu } from './Chrome';
import { SpaceSidebar, AppBuilderSidebar, WorkflowsSidebar, AgentsSidebar, IntegrationsSidebar } from './Sidebars';
import { signOut } from '../lib/auth';

export { useSpaces, useActiveSpace };

/* ---------------- Global Rail ---------------- */
const RAIL_TOP = [
  ['home', 'Home', '/dashboard'],
  ['bot', 'Agents', '/dashboard/agents'],
  ['layout-grid', 'App Builder', '/dashboard/app-builder'],
  ['workflow', 'Workflows', '/dashboard/workflows'],
  ['sparkles', 'Voro AI', '/dashboard/voro-ai'],
  ['blocks', 'Integrations', '/dashboard/integrations'],
];

function RailButton({ icon, label, to, active }) {
  return (
    <NavLink to={to} className="block" data-testid={`rail-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className={`group relative flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] rounded-xl transition-colors ${active ? 'text-[var(--nv-text)]' : 'text-[var(--nv-faint)] hover:text-[var(--nv-text)]'}`}>
        {active && <span className="absolute inset-0 rounded-xl bg-[var(--nv-primary-soft)]" />}
        <span className="relative"><Icon name={icon} size={19} /></span>
        <span className="relative text-[9px] font-semibold tracking-tight leading-none">{label}</span>
      </div>
    </NavLink>
  );
}

function GlobalRail() {
  const loc = useLocation();
  const isActive = (to) => to === '/dashboard' ? (loc.pathname === '/dashboard' || loc.pathname.startsWith('/dashboard/spaces')) : loc.pathname.startsWith(to);
  return (
    <nav className="w-[var(--rail-w)] shrink-0 flex flex-col items-center py-2 bg-[var(--nv-shell)]" data-testid="global-rail">
      <div className="flex flex-col items-center gap-1">
        {RAIL_TOP.map(([icon, label, to]) => <RailButton key={label} icon={icon} label={label} to={to} active={isActive(to)} />)}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1">
        <RailButton icon="star" label="Favorites" to="/dashboard/favorites" active={isActive('/dashboard/favorites')} />
        <RailButton icon="more-horizontal" label="More" to="/dashboard/more" active={isActive('/dashboard/more')} />
      </div>
    </nav>
  );
}

/* ---------------- Space Switcher ---------------- */
function SpaceSwitcher() {
  const { spaces, active } = useActiveSpace();
  const setActiveSpaceId = useApp((s) => s.setActiveSpaceId);
  const nav = useNavigate();
  return (
    <Popover align="left" width={300} testId="space-switcher" trigger={
      <button className="flex items-center gap-2.5 h-9 pl-1.5 pr-2.5 rounded-lg border border-[var(--nv-border)] hover:bg-[var(--nv-card-2)] transition-colors" data-testid="space-switcher-button">
        {active ? <SpaceIcon icon={active.icon} accent={active.accent} size={24} radius={7} /> : <div className="w-6 h-6 rounded-md bg-[var(--nv-card-2)]" />}
        <span className="text-[13px] font-bold max-w-[150px] truncate">{active?.name || 'Select Space'}</span>
        <Icon name="chevrons-up-down" size={14} className="nv-faint" />
      </button>
    }>
      {(close) => (
        <div className="p-1.5">
          <div className="nv-eyebrow px-2.5 pt-1.5 pb-1">Spaces</div>
          <div className="max-h-72 overflow-auto nv-scroll">
            {spaces.map((s) => (
              <button key={s.id} data-testid={`switch-space-${s.id}`} onClick={() => { setActiveSpaceId(s.id); close(); nav('/dashboard'); }}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--nv-card-2)] text-left ${active?.id === s.id ? 'bg-[var(--nv-primary-soft)]' : ''}`}>
                <SpaceIcon icon={s.icon} accent={s.accent} size={30} radius={8} />
                <div className="min-w-0 flex-1"><div className="text-[13px] font-bold truncate">{s.name}</div><div className="text-[11px] nv-faint capitalize">{s.type} Space</div></div>
                {active?.id === s.id && <Icon name="check" size={15} />}
              </button>
            ))}
            {!spaces.length && <div className="text-xs nv-muted p-3">No Spaces yet.</div>}
          </div>
          <div className="border-t border-[var(--nv-border)] mt-1 pt-1">
            <button onClick={() => { close(); nav('/dashboard/spaces/new'); }} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--nv-card-2)] text-left text-[13px] font-semibold" data-testid="switch-new-space">
              <div className="w-[30px] h-[30px] rounded-lg border border-dashed border-[var(--nv-border)] grid place-items-center"><Icon name="plus" size={15} /></div>
              Create Space
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}

/* ---------------- Top Bar ---------------- */
function ThemeToggle() {
  const theme = useApp((s) => s.theme);
  const toggle = useApp((s) => s.toggleTheme);
  return (
    <button onClick={toggle} className="w-9 h-9 grid place-items-center rounded-lg text-[var(--nv-muted)] hover:bg-[var(--nv-card-2)] hover:text-[var(--nv-text)] transition-colors" title="Toggle theme" data-testid="theme-toggle">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
    </button>
  );
}

function TopBar() {
  const nav = useNavigate();
  const user = useApp((s) => s.user);
  return (
    <header className="h-[var(--header-h)] shrink-0 flex items-center gap-3 pr-3 bg-[var(--nv-shell)] z-30" data-testid="top-bar">
      <div className="w-[var(--rail-w)] shrink-0 grid place-items-center">
        <div className="w-8 h-8 rounded-lg bg-[var(--nv-primary)] grid place-items-center"><span className="text-[15px] font-black text-[var(--nv-primary-fg)]">N</span></div>
      </div>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[15px] font-extrabold tracking-tight hidden sm:block">Notevoro</span>
        <div className="w-px h-5 bg-[var(--nv-border)] hidden sm:block" />
        <SpaceSwitcher />
      </div>
      <button onClick={() => nav('/dashboard/search')} className="flex-1 max-w-xl mx-auto flex items-center gap-2.5 h-9 px-3.5 rounded-lg bg-[var(--nv-card)] border border-[var(--nv-border-soft)] text-[var(--nv-faint)] hover:border-[var(--nv-border)] transition-colors" data-testid="global-search">
        <Icon name="search" size={15} /><span className="text-[13px]">Search anything in Notevoro…</span><span className="ml-auto kbd hidden sm:inline">⌘ K</span>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <NotificationsMenu />
        <button className="w-9 h-9 grid place-items-center rounded-lg text-[var(--nv-muted)] hover:bg-[var(--nv-card-2)] hover:text-[var(--nv-text)] transition-colors" title="Help" data-testid="help-button"><Icon name="help-circle" size={17} /></button>
        <ThemeToggle />
        <Popover width={240} testId="account-trigger" trigger={<button className="ml-0.5" data-testid="account-button"><Avatar user={user} size={30} /></button>}>
          {(close) => (
            <div className="p-2">
              <div className="px-3 py-2"><div className="font-bold text-sm truncate">{user?.name}</div><div className="text-xs nv-muted truncate">{user?.email}</div></div>
              <button className="nav-item w-full" onClick={() => { close(); nav('/dashboard/settings'); }}><Icon name="settings" /> Settings</button>
              <button className="nav-item w-full" onClick={() => { close(); nav('/dashboard/settings?tab=billing'); }}><Icon name="crown" /> Plan &amp; usage</button>
              <button className="nav-item w-full" onClick={() => signOut()}><Icon name="log-out" /> Sign out</button>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}

/* ---------------- Section-aware Contextual Sidebar ---------------- */
function ContextualSidebar() {
  const loc = useLocation();
  const p = loc.pathname;
  let Body = SpaceSidebar;
  if (p.startsWith('/dashboard/app-builder')) Body = AppBuilderSidebar;
  else if (p.startsWith('/dashboard/workflows')) Body = WorkflowsSidebar;
  else if (p.startsWith('/dashboard/agents')) Body = AgentsSidebar;
  else if (p.startsWith('/dashboard/integrations')) Body = IntegrationsSidebar;
  return (
    <aside className="w-[var(--sidebar-w)] shrink-0 flex flex-col bg-[var(--nv-sidebar)] border-r border-[var(--nv-border-soft)]" data-testid="contextual-sidebar">
      <Body />
    </aside>
  );
}

/* ---------------- Shell ---------------- */
export default function Shell() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--nv-shell)]" data-testid="app-shell">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <GlobalRail />
        <div className="flex-1 flex min-h-0 bg-[var(--nv-bg)] rounded-tl-[20px] border-t border-l border-[var(--nv-border)] overflow-hidden">
          <ContextualSidebar />
          <main className="flex-1 min-w-0 overflow-auto nv-scroll" data-testid="main-canvas"><Outlet /></main>
        </div>
      </div>
    </div>
  );
}
