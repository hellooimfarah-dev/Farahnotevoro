import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useApp } from './lib/store';
import { loadAuthConfig } from './lib/auth';
import { connectRealtime, disconnectRealtime, onEvent } from './lib/ws';
import { initCollab } from './lib/supabase';
import { Loading } from './lib/ui';
import AuthPage from './pages/AuthPage';
import BrainLayout from './pages/BrainLayout';
import Brain from './pages/Brain';
import Today from './pages/Today';
import SearchPage from './pages/SearchPage';
import SpaceWizard from './pages/SpaceWizard';
import SpaceShell from './pages/SpaceShell';
import SpaceHome from './pages/SpaceHome';
import Chat from './pages/Chat';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';
import Calendar from './pages/Calendar';
import Notes from './pages/Notes';
import Documents from './pages/Documents';
import Files from './pages/Files';
import Records from './pages/Records';
import Library from './pages/Library';
import Team from './pages/Team';
import Meetings from './pages/Meetings';
import Knowledge from './pages/Knowledge';
import Tools from './pages/Tools';
import VoroPage from './pages/VoroPage';
import Settings from './pages/Settings';
import SpaceSettings from './pages/SpaceSettings';
import ActivityPage from './pages/ActivityPage';
import InboxPage from './pages/InboxPage';
import Pages from './pages/Pages';
import ToolsHub from './pages/ToolsHub';
import AgentsHub from './pages/AgentsHub';
import ProgressPage from './pages/ProgressPage';
import MyWork from './pages/MyWork';
import { NotesLanding, ProjectsLanding, TranscriberLanding, VoroHubLanding, SpacesLanding } from './pages/GlobalLandings';
import './App.css';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: false } } });

function RealtimeBridge() {
  const queryClient = useQueryClient();
  const user = useApp((s) => s.user);
  useEffect(() => {
    if (!user) return;
    connectRealtime();
    initCollab();
    const off = onEvent((event, payload) => {
      if (event.startsWith('message.') || event.startsWith('conversation.')) queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (event === 'notification.created') queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (event === 'activity.created') { queryClient.invalidateQueries({ queryKey: ['activity'] }); queryClient.invalidateQueries({ queryKey: ['home'] }); }
      if (event.endsWith('.changed')) { queryClient.invalidateQueries({ queryKey: [event.replace('.changed', ''), payload.space_id] }); queryClient.invalidateQueries({ queryKey: ['home', payload.space_id] }); }
      if (event.startsWith('space.')) queryClient.invalidateQueries({ queryKey: ['spaces'] });
    });
    const on = () => { useApp.getState().setOnline(true); connectRealtime(); queryClient.invalidateQueries(); };
    const offl = () => useApp.getState().setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', offl);
    return () => { off(); disconnectRealtime(); window.removeEventListener('online', on); window.removeEventListener('offline', offl); };
  }, [user?.id, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Protected() {
  const { user, authReady } = useApp();
  const loc = useLocation();
  if (!authReady) return <div className="h-screen grid place-items-center"><Loading label="Opening Notevoro…" /></div>;
  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  return <><RealtimeBridge /><Outlet /></>;
}

export default function App() {
  const loadMe = useApp((s) => s.loadMe);
  useEffect(() => { loadAuthConfig().finally(loadMe); }, [loadMe]);
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<Protected />}>
            <Route path="/dashboard" element={<BrainLayout />}>
              <Route index element={<Brain />} />
              <Route path="today" element={<Today />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="spaces" element={<SpacesLanding />} />
              <Route path="vorohub" element={<VoroHubLanding />} />
              <Route path="notes" element={<NotesLanding />} />
              <Route path="projects" element={<ProjectsLanding />} />
              <Route path="transcriber" element={<TranscriberLanding />} />
              <Route path="tools" element={<ToolsHub />} />
              <Route path="agents" element={<AgentsHub />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="voro" element={<VoroPage />} />
              <Route path="settings" element={<Settings />} />
              {/* Legacy top-level route compatibility — old bookmarks land on the Tools launcher which routes to the right per-Space module. */}
              <Route path="pages" element={<Navigate to="/dashboard/notes" replace />} />
              <Route path="documents" element={<Navigate to="/dashboard/notes" replace />} />
              <Route path="tasks" element={<Navigate to="/dashboard/projects" replace />} />
              <Route path="calendar" element={<Navigate to="/dashboard/tools" replace />} />
              <Route path="files" element={<Navigate to="/dashboard/tools" replace />} />
              <Route path="meetings" element={<Navigate to="/dashboard/projects" replace />} />
              <Route path="flashcards" element={<Navigate to="/dashboard/vorohub" replace />} />
              <Route path="quizzes" element={<Navigate to="/dashboard/vorohub" replace />} />
              <Route path="tests" element={<Navigate to="/dashboard/vorohub" replace />} />
              <Route path="mind-maps" element={<Navigate to="/dashboard/vorohub" replace />} />
              <Route path="research" element={<Navigate to="/dashboard/vorohub" replace />} />
            </Route>
            <Route path="/dashboard/spaces/new" element={<SpaceWizard />} />
            <Route path="/dashboard/spaces/:spaceId" element={<SpaceShell />}>
              <Route index element={<SpaceHome />} />
              <Route path="library" element={<Library />} />
              <Route path="chat" element={<Chat />} />
              <Route path="chat/:convId" element={<Chat />} />
              <Route path="inbox" element={<Navigate to="/dashboard/inbox" replace />} />
              <Route path="my-work" element={<MyWork />} />
              <Route path="pages" element={<Pages />} />
              <Route path="pages/:pageId" element={<Pages />} />
              <Route path="favorites" element={<Navigate to="/dashboard/spaces/:spaceId" replace />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="board" element={<Tasks view="board" />} />
              <Route path="table_view" element={<Tasks view="table" />} />
              <Route path="timeline" element={<Tasks view="timeline" />} />
              <Route path="gantt" element={<Tasks view="timeline" />} />
              <Route path="calendar_view" element={<Calendar />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:projectId" element={<Projects />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="notes" element={<Notes />} />
              <Route path="notes/:noteId" element={<Notes />} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/:docId" element={<Documents />} />
              <Route path="gallery" element={<Documents gallery />} />
              <Route path="files" element={<Files />} />
              <Route path="knowledge" element={<Knowledge />} />
              <Route path="meetings" element={<Meetings />} />
              <Route path="team" element={<Team />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="tools/:toolKey" element={<Tools />} />
              <Route path="voro" element={<VoroPage inSpace />} />
              <Route path="settings" element={<SpaceSettings />} />
              <Route path="m/:capKey" element={<Records />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
