import type {
  ActionResult,
  GameError,
  MatchStateView,
  PlayerTag,
  UnitKind,
} from '@/types/game';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type ApiResult = { __kind__: 'ok'; ok: null } | { __kind__: 'err'; err: GameError };

function fromApiResult(r: ApiResult): ActionResult {
  if (r.__kind__ === 'ok') return { success: true, data: null };
  return { success: false, error: r.err };
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

export interface GameListEntry {
  id: string;
  playerCount: number;
  tickCount: number;
  status: { __kind__: string };
  createdAt: number;
}

export function listGames(): Promise<GameListEntry[]> {
  return apiFetch('/games');
}

export async function createGame(): Promise<{ gameId: string; playerToken: string; playerSide: PlayerTag }> {
  return apiFetch('/games', { method: 'POST' });
}

export async function joinGame(gameId: string): Promise<{ playerToken: string; playerSide: PlayerTag }> {
  return apiFetch(`/games/${gameId}/join`, { method: 'POST' });
}

// ─── Game actions ─────────────────────────────────────────────────────────────

export async function getMatchState(gameId: string): Promise<MatchStateView> {
  return apiFetch(`/games/${gameId}/state`);
}

export async function moveUnit(gameId: string, playerToken: string, unitId: number, to: { x: number; y: number }): Promise<ActionResult> {
  const r = await apiFetch<ApiResult>(`/games/${gameId}/move`, {
    method: 'POST',
    body: JSON.stringify({ playerToken, unitId, to }),
  });
  return fromApiResult(r);
}

export async function attackUnit(gameId: string, playerToken: string, attackerId: number, targetId: number): Promise<ActionResult> {
  const r = await apiFetch<ApiResult>(`/games/${gameId}/attack`, {
    method: 'POST',
    body: JSON.stringify({ playerToken, attackerId, targetId }),
  });
  return fromApiResult(r);
}

export async function attackCastle(gameId: string, playerToken: string, attackerId: number): Promise<ActionResult> {
  const r = await apiFetch<ApiResult>(`/games/${gameId}/attack-castle`, {
    method: 'POST',
    body: JSON.stringify({ playerToken, attackerId }),
  });
  return fromApiResult(r);
}

export async function attackStructure(gameId: string, playerToken: string, attackerId: number, structureId: string): Promise<ActionResult> {
  const r = await apiFetch<ApiResult>(`/games/${gameId}/attack-structure`, {
    method: 'POST',
    body: JSON.stringify({ playerToken, attackerId, structureId }),
  });
  return fromApiResult(r);
}

export async function spawnUnit(gameId: string, playerToken: string, kind: UnitKind, structureId: string, targetPos: { x: number; y: number }): Promise<ActionResult> {
  const r = await apiFetch<ApiResult>(`/games/${gameId}/spawn`, {
    method: 'POST',
    body: JSON.stringify({ playerToken, kind, structureId, targetPos }),
  });
  return fromApiResult(r);
}

export async function resetGame(gameId: string, playerToken: string): Promise<ActionResult> {
  const r = await apiFetch<ApiResult>(`/games/${gameId}/reset`, {
    method: 'POST',
    body: JSON.stringify({ playerToken }),
  });
  return fromApiResult(r);
}
