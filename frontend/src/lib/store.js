import { create } from 'zustand';
import { api } from './api';
import { getToken } from './auth';

const THEME_KEY = 'nv-theme';
const SPACE_KEY = 'nv-active-space';
const initialTheme = (() => {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
})();
export function applyTheme(theme) {
  try {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* ignore */ }
}
applyTheme(initialTheme);

export const useApp = create((set, get) => ({
  user: null,
  entitlements: null,
  authReady: false,
  online: navigator.onLine,
  presence: new Set(),
  typing: {},
  unread: 0,
  wsStatus: 'idle',
  voroOpen: true,
  theme: initialTheme,
  activeSpaceId: (() => { try { return localStorage.getItem(SPACE_KEY) || null; } catch { return null; } })(),
  setTheme: (theme) => { applyTheme(theme); set({ theme }); },
  toggleTheme: () => { const t = get().theme === 'dark' ? 'light' : 'dark'; applyTheme(t); set({ theme: t }); },
  setActiveSpaceId: (id) => { try { if (id) localStorage.setItem(SPACE_KEY, id); } catch { /* ignore */ } set({ activeSpaceId: id }); },
  setOnline: (online) => set({ online }),
  setVoroOpen: (voroOpen) => set({ voroOpen }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setPresence: (ids) => set({ presence: new Set(ids) }),
  presenceChange: (id, online) => {
    const p = new Set(get().presence);
    online ? p.add(id) : p.delete(id);
    set({ presence: p });
  },
  setTyping: (convId, userId, name, typing) => {
    const t = { ...get().typing };
    const cur = { ...(t[convId] || {}) };
    if (typing) cur[userId] = name; else delete cur[userId];
    t[convId] = cur;
    set({ typing: t });
  },
  setUnread: (unread) => set({ unread }),
  loadMe: async () => {
    const token = await getToken();
    if (!token) return set({ authReady: true, user: null });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, entitlements: data.entitlements, authReady: true });
    } catch {
      set({ authReady: true, user: null });
    }
  },
  setEntitlements: (entitlements) => set({ entitlements }),
  setUser: (user) => set({ user }),
  reset: () => set({ user: null, entitlements: null }),
}));
