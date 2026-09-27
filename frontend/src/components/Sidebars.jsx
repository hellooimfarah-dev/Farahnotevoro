import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useActiveSpace } from '../lib/spaces';
import { Icon, SpaceIcon } from '../lib/icons';

function Section({ label, children, action }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-3 mb-1.5">
        <span className="nv-eyebrow">{label}</span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarHeader({ icon, title, onClick }) {
  return (
    <div className="p-3">
      <button onClick={onClick} className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[var(--nv-card-2)] transition-colors">
        <div className="w-[30px] h-[30px] rounded-lg bg-[var(--nv-card-2)] border border-[var(--nv-border-soft)] grid place-items-center"><Icon name={icon} size={16} /></div>
        <span className="text-[14px] font-bold truncate flex-1 text-left">{title}</span>
        <Icon name="chevron-down" size={15} className="nv-faint" />
      </button>
    </div>
  );
}

function CurrentSpaceBlock() {
  const { active } = useActiveSpace();
  if (!active) return null;
  return (
    <Section label="Current Space">
      <div className="flex items-center gap-2.5 px-3 py-1.5">
        <SpaceIcon icon={active.icon} accent={active.accent} size={22} radius={6} />
        <span className="text-[13px] font-semibold truncate">{active.name}</span>
      </div>
    </Section>
  );
}

function Wrap({ children }) {
  return <div className="flex-1 overflow-auto nv-scroll px-2 pb-3">{children}</div>;
}

/* ---------------- Space (default) ---------------- */
function flattenPages(list) {
  const byId = {};
  list.forEach((p) => { byId[p.id] = { ...p, children: [] }; });
  const roots = [];
  list.forEach((p) => { const parent = p.parent_page_id ? byId[p.parent_page_id] : null; if (parent) { parent.children.push(byId[p.id]); } else { roots.push(byId[p.id]); } });
  const out = [];
  const walk = (nodes, depth) => { nodes.forEach((n) => { out.push({ page: n, depth }); if (n.children.length) walk(n.children, depth + 1); }); };
  walk(roots, 0);
  return out;
}

export function SpaceSidebar() {
  const { active } = useActiveSpace();
  const nav = useNavigate();
  const sid = active?.id;
  const { data: tree } = useQuery({ queryKey: ['pages-tree', sid], queryFn: () => api.get(`/spaces/${sid}/pages/tree`).then((r) => r.data).catch(() => []), enabled: !!sid });
  const flat = useMemo(() => flattenPages(Array.isArray(tree) ? tree : (tree?.items || [])), [tree]);
  const addPage = async () => { if (!sid) return; try { const { data } = await api.post(`/spaces/${sid}/pages`, { title: 'Untitled' }); nav(`/dashboard/pages/${data.id}`); } catch { /* ignore */ } };
  return (
    <>
      <SidebarHeader icon={active?.icon || 'sparkles'} title={active?.name || 'Notevoro'} onClick={() => nav('/dashboard')} />
      <Wrap>
        <Section label="Main">
          <NavLink to="/dashboard" end className="nav-item" data-testid="ctx-home"><Icon name="home" /> Home</NavLink>
          {sid && <NavLink to={`/dashboard/spaces/${sid}/my-work`} className="nav-item" data-testid="ctx-mywork"><Icon name="check-square" /> My Work</NavLink>}
          {sid && <NavLink to={`/dashboard/spaces/${sid}/activity`} className="nav-item" data-testid="ctx-activity"><Icon name="activity" /> Activity</NavLink>}
        </Section>
        <Section label="Pages">
          {flat.length === 0 && <div className="px-3 py-1.5 text-[12px] nv-faint">No pages yet</div>}
          {flat.map(({ page, depth }) => (
            <NavLink key={page.id} to={`/dashboard/pages/${page.id}`} className="nav-item h-8 min-w-0" style={{ paddingLeft: 12 + depth * 14 }} data-testid={`page-${page.id}`}>
              <Icon name={page.icon || 'file-text'} size={15} /><span className="truncate text-[13px]">{page.title || 'Untitled'}</span>
            </NavLink>
          ))}
          <button onClick={addPage} className="nav-item w-full mt-0.5" data-testid="add-page"><Icon name="plus" /> Add Page</button>
        </Section>
      </Wrap>
    </>
  );
}

/* ---------------- App Builder ---------------- */
export function AppBuilderSidebar() {
  const nav = useNavigate();
  const TEMPLATES = [['layout-dashboard', 'Project Management'], ['users', 'CRM'], ['settings-2', 'Operations'], ['landmark', 'Finance'], ['graduation-cap', 'Education'], ['megaphone', 'Marketing'], ['user-round', 'HR'], ['package', 'Inventory'], ['shapes', 'Custom']];
  return (
    <>
      <SidebarHeader icon="layout-grid" title="App Builder" onClick={() => nav('/dashboard/app-builder')} />
      <Wrap>
        <Section label="My Apps">
          <NavLink to="/dashboard/app-builder" end className="nav-item"><Icon name="layout-grid" /> All Apps</NavLink>
          <div className="nav-item"><Icon name="history" /> Recent</div>
          <div className="nav-item"><Icon name="star" /> Favorites</div>
        </Section>
        <CurrentSpaceBlock />
        <div className="px-2 mt-3"><button className="nv-btn nv-btn-outline w-full"><Icon name="plus" size={14} /> Create App</button></div>
        <Section label="Templates">
          {TEMPLATES.map(([ic, l]) => <div key={l} className="nav-item"><Icon name={ic} /> {l}</div>)}
        </Section>
      </Wrap>
    </>
  );
}

/* ---------------- Workflows ---------------- */
export function WorkflowsSidebar() {
  const nav = useNavigate();
  return (
    <>
      <SidebarHeader icon="workflow" title="Workflows" onClick={() => nav('/dashboard/workflows')} />
      <Wrap>
        <Section label="Workflows">
          <NavLink to="/dashboard/workflows" end className="nav-item"><Icon name="workflow" /> All Workflows</NavLink>
          <div className="nav-item"><Icon name="zap" /> Active</div>
          <div className="nav-item"><Icon name="file-edit" /> Drafts</div>
          <div className="nav-item"><Icon name="layout-template" /> Templates</div>
          <div className="nav-item"><Icon name="star" /> Favorites</div>
        </Section>
        <CurrentSpaceBlock />
        <div className="px-2 mt-3"><button className="nv-btn nv-btn-outline w-full"><Icon name="plus" size={14} /> Create Workflow</button></div>
        <Section label="Activity">
          <div className="nav-item"><Icon name="play-circle" /> Runs</div>
          <div className="nav-item"><Icon name="alert-circle" /> Failed Runs</div>
          <div className="nav-item"><Icon name="history" /> History</div>
        </Section>
      </Wrap>
    </>
  );
}

/* ---------------- Agents ---------------- */
export function AgentsSidebar() {
  const nav = useNavigate();
  return (
    <>
      <SidebarHeader icon="bot" title="Agents" onClick={() => nav('/dashboard/agents')} />
      <Wrap>
        <Section label="Agents">
          <NavLink to="/dashboard/agents" end className="nav-item"><Icon name="plus" /> New Agent</NavLink>
          <div className="nav-item"><Icon name="bot" /> My Agents</div>
          <div className="nav-item"><Icon name="library" /> Agent Directory</div>
          <div className="nav-item"><Icon name="rss" /> Feed</div>
        </Section>
        <CurrentSpaceBlock />
        <Section label="Categories">
          {['Project Management', 'Marketing', 'Operations', 'Sales', 'Product & Engineering'].map((c) => <div key={c} className="nav-item"><Icon name="hash" /> {c}</div>)}
        </Section>
      </Wrap>
    </>
  );
}

/* ---------------- Integrations ---------------- */
export function IntegrationsSidebar() {
  const nav = useNavigate();
  return (
    <>
      <SidebarHeader icon="blocks" title="Integrations" onClick={() => nav('/dashboard/integrations')} />
      <Wrap>
        <Section label="Browse">
          <NavLink to="/dashboard/integrations" end className="nav-item"><Icon name="grid-2x2" /> All</NavLink>
          <div className="nav-item"><Icon name="check-circle-2" /> Connected</div>
          <div className="nav-item"><Icon name="sparkles" /> Recommended</div>
        </Section>
        <CurrentSpaceBlock />
        <Section label="Categories">
          {['Communication', 'Productivity', 'Developer', 'Storage', 'Calendar'].map((c) => <div key={c} className="nav-item"><Icon name="folder" /> {c}</div>)}
        </Section>
      </Wrap>
    </>
  );
}
