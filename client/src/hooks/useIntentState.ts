import { posKey } from '@/lib/gameUtils';
import type { Pos } from '@/types/game';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface NextPosition {
  x: number;
  y: number;
  intendedTarget: number | string | null;
  userCommittedToPosition: boolean;
}

export type ActionPendingState = 'idle' | 'pending' | 'confirmed';

export interface IntentState {
  nextPosition: NextPosition | null;
  pathTiles: Set<string>;
  pendingAction: ActionPendingState;
}

export interface UseIntentStateReturn {
  intent: IntentState;
  setHoverPreview: (pos: Pos, path: Pos[], intendedTarget: number | string | null) => void;
  commitIntent: () => void;
  setPendingAction: (state: ActionPendingState) => void;
  clearIntent: () => void;
}

const EMPTY_SET = new Set<string>();

export function useIntentState(): UseIntentStateReturn {
  const [nextPosition, setNextPosition] = useState<NextPosition | null>(null);
  const [pathTiles, setPathTiles] = useState<Set<string>>(EMPTY_SET);
  const [pendingAction, setPendingActionState] = useState<ActionPendingState>('idle');
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIntent = useCallback(() => {
    setNextPosition(null);
    setPathTiles(EMPTY_SET);
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  const setHoverPreview = useCallback(
    (pos: Pos, path: Pos[], intendedTarget: number | string | null) => {
      if (pendingAction === 'pending') return;
      setNextPosition({ x: pos.x, y: pos.y, intendedTarget, userCommittedToPosition: false });
      const pathSet = new Set<string>();
      for (let i = 0; i < path.length - 1; i++) pathSet.add(posKey(path[i]));
      setPathTiles(pathSet);
    },
    [pendingAction],
  );

  const commitIntent = useCallback(() => {
    setNextPosition((prev) => (prev ? { ...prev, userCommittedToPosition: true } : null));
  }, []);

  const setPendingAction = useCallback((state: ActionPendingState) => {
    setPendingActionState(state);
    if (state === 'confirmed') {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = setTimeout(() => {
        setPendingActionState('idle');
        setNextPosition(null);
        setPathTiles(EMPTY_SET);
      }, 450);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  return {
    intent: { nextPosition, pathTiles, pendingAction },
    setHoverPreview,
    commitIntent,
    setPendingAction,
    clearIntent,
  };
}
