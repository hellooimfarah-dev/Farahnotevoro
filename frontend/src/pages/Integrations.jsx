import React from 'react';
import { toast } from 'sonner';
import { Icon } from '../lib/icons';
import { useActiveSpace } from '../lib/spaces';

const INTEGRATIONS = [
  ['mail', 'Gmail', 'Email', 'Communication'],
  ['mail', 'Outlook', 'Email', 'Communication'],
  ['hard-drive', 'Google Drive', 'Files & storage', 'Storage'],
  ['calendar', 'Google Calendar', 'Events & scheduling', 'Calendar'],
  ['table', 'Google Sheets', 'Spreadsheets', 'Productivity'],
  ['message-square', 'Slack', 'Team messaging', 'Communication'],
  ['users', 'Microsoft Teams', 'Team messaging', 'Communication'],
  ['github', 'GitHub', 'Code & issues', 'Developer'],
  ['git-branch', 'GitLab', 'Code & issues', 'Developer'],
  ['square-kanban', 'Jira', 'Issue tracking', 'Developer'],
  ['activity', 'Linear', 'Issue tracking', 'Developer'],
  ['video', 'Zoom', 'Meetings', 'Communication'],
];

export default function Integrations() {
  const { active } = useActiveSpace();
  const connect = (name) => toast(`Connecting ${name} is coming soon.`, { description: 'Integrations become usable by Pages, App Builder, Workflows and Agents.' });
  return (
    <div className="px-6 py-6 fade-up" data-testid="integrations-page">
      <h1 className="nv-h1">Integrations</h1>
      <p className="text-[13px] nv-muted mb-5">Connect external services to {active?.name || 'your Space'}. One connection powers Pages, Workflows, App Builder and Agents.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INTEGRATIONS.map(([ic, name, desc, cat]) => (
          <div key={name} className="nv-card p-4 flex items-center gap-3" data-testid="integration-card">
            <div className="stat-icon tone-slate shrink-0" style={{ width: 40, height: 40 }}><Icon name={ic} size={19} /></div>
            <div className="min-w-0 flex-1"><div className="text-[14px] font-bold">{name}</div><div className="text-[11px] nv-faint">{desc} · {cat}</div></div>
            <button onClick={() => connect(name)} className="nv-btn nv-btn-outline nv-btn-sm" data-testid="connect-btn">Connect</button>
          </div>
        ))}
      </div>
    </div>
  );
}
