import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useApp } from './store';

export function useSpaces() {
  return useQuery({ queryKey: ['spaces'], queryFn: () => api.get('/spaces').then((r) => r.data) });
}

export function useActiveSpace() {
  const { data: spaces } = useSpaces();
  const activeSpaceId = useApp((s) => s.activeSpaceId);
  const setActiveSpaceId = useApp((s) => s.setActiveSpaceId);
  const active = useMemo(() => {
    if (!spaces?.length) return null;
    return spaces.find((s) => s.id === activeSpaceId) || spaces[0];
  }, [spaces, activeSpaceId]);
  useEffect(() => { if (active && active.id !== activeSpaceId) setActiveSpaceId(active.id); }, [active?.id]); // eslint-disable-line
  return { spaces: spaces || [], active };
}
