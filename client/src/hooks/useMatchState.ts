import { getMatchState } from '@/api/client';
import type { MatchStateView } from '@/types/game';
import { useQuery } from '@tanstack/react-query';
import type { MutableRefObject } from 'react';

export function useMatchState(gameId: string, animatingRef: MutableRefObject<boolean>) {
  const query = useQuery<MatchStateView>({
    queryKey: ['matchState', gameId],
    queryFn: () => getMatchState(gameId),
    enabled: !!gameId,
    // WebSocket pushes keep the cache fresh in real time.
    // This poll is a fallback only — it fires every 5s when idle so the game
    // recovers automatically if the socket connection drops briefly.
    refetchInterval: () => (animatingRef.current ? false : 5000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Never treat cached data as stale automatically — socket events update it.
    staleTime: Infinity,
    retry: 1,
  });

  return {
    state: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}
