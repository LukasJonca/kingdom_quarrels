import * as api from '@/api/client';
import type { ActionResult, Pos, UnitId, UnitKind } from '@/types/game';
import { GameError } from '@/types/game';
import { useQueryClient } from '@tanstack/react-query';

export function useGameActions(gameId: string, playerToken: string) {
  const queryClient = useQueryClient();

  // Fallback invalidation — only needed if a WebSocket broadcast was missed.
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['matchState', gameId] });
  }

  async function moveUnit(unitId: UnitId, pos: Pos): Promise<ActionResult> {
    // State update arrives via WebSocket broadcast from the server.
    return api.moveUnit(gameId, playerToken, unitId, pos);
  }

  async function attackUnit(unitId: UnitId, targetId: UnitId): Promise<ActionResult> {
    return api.attackUnit(gameId, playerToken, unitId, targetId);
  }

  async function attackCastle(unitId: UnitId): Promise<ActionResult> {
    const result = await api.attackCastle(gameId, playerToken, unitId);
    if (!result.success) invalidate();
    return result;
  }

  async function attackStructure(unitId: UnitId, structureId: string): Promise<ActionResult> {
    const result = await api.attackStructure(gameId, playerToken, unitId, structureId);
    if (!result.success) invalidate();
    return result;
  }

  async function spawnUnit(kind: UnitKind, structureId: string, targetPos: Pos): Promise<ActionResult> {
    const result = await api.spawnUnit(gameId, playerToken, kind, structureId, targetPos);
    if (!result.success) invalidate();
    return result;
  }

  async function resetGame(): Promise<ActionResult> {
    return api.resetGame(gameId, playerToken);
  }

  return { moveUnit, attackUnit, attackCastle, attackStructure, spawnUnit, resetGame };
}

export type { ActionResult };
export { GameError };
