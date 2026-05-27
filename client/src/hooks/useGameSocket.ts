import type { MatchStateView } from '@/types/game';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import type { MutableRefObject } from 'react';

/**
 * Opens a socket.io connection for a specific game room and keeps the
 * React Query cache up-to-date via server-pushed `state_update` events.
 *
 * While an animation is in progress (`isAnimatingRef.current === true`) the
 * incoming state is buffered so a mid-walk server push can't snap the unit
 * back to its old grid position.  Call `flushPending()` once the animation
 * finishes to apply the buffered state immediately.
 */
export function useGameSocket(
  gameId: string,
  isAnimatingRef: MutableRefObject<boolean>,
) {
  const queryClient = useQueryClient();
  const pendingStateRef = useRef<MatchStateView | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket.emit('join_game', gameId);
    });

    socket.on('state_update', (state: MatchStateView) => {
      if (isAnimatingRef.current) {
        // Buffer the update — the overlay is still playing over the old state.
        pendingStateRef.current = state;
      } else {
        queryClient.setQueryData(['matchState', gameId], state);
      }
    });

    socket.on('reconnect', () => {
      // Re-join the room after a reconnect and trigger a manual refetch so
      // any events missed during the outage are caught up.
      socket.emit('join_game', gameId);
      queryClient.invalidateQueries({ queryKey: ['matchState', gameId] });
    });

    return () => {
      socket.emit('leave_game', gameId);
      socket.disconnect();
    };
  }, [gameId, queryClient, isAnimatingRef]);

  // Call this when an animation finishes to apply any buffered state update.
  const flushPending = useCallback(() => {
    if (pendingStateRef.current) {
      queryClient.setQueryData(['matchState', gameId], pendingStateRef.current);
      pendingStateRef.current = null;
    }
  }, [gameId, queryClient]);

  return { flushPending };
}
