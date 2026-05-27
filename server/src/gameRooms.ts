import { v4 as uuidv4 } from 'uuid';
import type { MatchState, PlayerTag } from './types';
import {
  buildTileMap,
  initialCastles,
  initialStructures,
  initialUnits,
  stateToView,
} from './gameLogic';
import { broadcastState } from './socket';

const TICK_INTERVAL_MS = 15_000;
const TICK_INCOME = 50;
// Per-source lifetime gold caps — income stops once each source reaches its cap.
const CASTLE_INCOME_CAP = 500;   // 10 ticks  (~2.5 min)
const MINE_INCOME_CAP   = 1_000; // 20 ticks  (~5 min)
// Player balance cap — high enough to never be a real constraint.
const PLAYER_GOLD_CAP = 9_999;

const rooms = new Map<string, MatchState>();

// ─── Tick system ──────────────────────────────────────────────────────────────

function awardGold(state: MatchState, playerIdx: number, amount: number): void {
  const current = state.playerGold.get(playerIdx) ?? 0;
  state.playerGold.set(playerIdx, Math.min(PLAYER_GOLD_CAP, current + amount));
}

function runTick(state: MatchState): void {
  if (state.status.__kind__ === 'won') {
    stopTick(state);
    return;
  }

  // Reset every unit's action flags so both players can act again.
  for (const unit of state.units.values()) {
    unit.moved = false;
    unit.attacked = false;
  }

  // Castle (SpawnSettlement) income: +50g/tick per castle, lifetime cap 500g.
  // Castles are never capturable — each always belongs to its original owner.
  for (const castle of state.castles.values()) {
    if (castle.goldGenerated >= CASTLE_INCOME_CAP) continue;
    const income = Math.min(TICK_INCOME, CASTLE_INCOME_CAP - castle.goldGenerated);
    castle.goldGenerated += income;
    const ownerIdx = castle.owner === 'blue' ? 0 : 1;
    awardGold(state, ownerIdx, income);
  }

  // Mine income: +50g/tick per owned mine, per-mine lifetime cap 1,000g.
  // goldGenerated does NOT reset on capture — new owner earns only what's left.
  for (const structure of state.structures.values()) {
    if (structure.kind !== 'mine') continue;
    if (structure.owner === undefined) continue;
    if (structure.goldGenerated >= MINE_INCOME_CAP) continue;
    const income = Math.min(TICK_INCOME, MINE_INCOME_CAP - structure.goldGenerated);
    structure.goldGenerated += income;
    awardGold(state, structure.owner, income);
  }

  state.tickCount++;
  state.lastTickTime = Date.now();

  broadcastState(state.id, stateToView(state));
}

export function startTick(state: MatchState): void {
  if (state.tickIntervalId) return; // Already running
  state.tickIntervalId = setInterval(() => runTick(state), TICK_INTERVAL_MS);
}

export function stopTick(state: MatchState): void {
  if (state.tickIntervalId) {
    clearInterval(state.tickIntervalId);
    state.tickIntervalId = undefined;
  }
}

// ─── Room management ──────────────────────────────────────────────────────────

export function createGame(): { gameId: string; playerToken: string } {
  const gameId = uuidv4();
  const playerToken = uuidv4();
  const seed = Math.floor(Math.random() * 1_000_000);

  const [structures, structPositions] = initialStructures(seed);
  const tiles = buildTileMap(seed, structPositions);
  const units = initialUnits();
  const castles = initialCastles();
  const playerGold = new Map<number, number>([[0, 1_000], [1, 1_000]]);

  const state: MatchState = {
    id: gameId,
    tiles,
    units,
    castles,
    structures,
    playerGold,
    nextUnitId: 6,
    tickCount: 1,
    lastTickTime: Date.now(),
    status: { __kind__: 'active', active: null },
    mapSeed: seed,
    playerTokens: [playerToken, null],
    playerCount: 1,
    createdAt: Date.now(),
  };

  rooms.set(gameId, state);
  return { gameId, playerToken };
}

export function joinGame(
  gameId: string,
): { playerToken: string; playerSide: PlayerTag } | { error: string } {
  const state = rooms.get(gameId);
  if (!state) return { error: 'Game not found' };
  if (state.playerCount >= 2) return { error: 'Game is full' };

  const playerToken = uuidv4();
  state.playerTokens[1] = playerToken;
  state.playerCount = 2;
  state.lastTickTime = Date.now(); // Reset clock so both players get a full first tick

  // Start the 15-second game clock now that both players are in.
  startTick(state);

  return { playerToken, playerSide: 'red' };
}

export function getGame(gameId: string): MatchState | undefined {
  return rooms.get(gameId);
}

export function listGames(): MatchState[] {
  // Filter out games older than 2 hours.
  return [...rooms.values()].filter(
    (g) => Date.now() - g.createdAt < 2 * 60 * 60 * 1_000,
  );
}

export function getPlayerSide(state: MatchState, token: string): PlayerTag | null {
  if (state.playerTokens[0] === token) return 'blue';
  if (state.playerTokens[1] === token) return 'red';
  return null;
}

export function resetGame(state: MatchState): void {
  stopTick(state);

  const seed = Math.floor(Math.random() * 1_000_000);
  const [structures, structPositions] = initialStructures(seed);

  state.tiles = buildTileMap(seed, structPositions);
  state.units = initialUnits();
  state.castles = initialCastles();
  state.structures = structures;
  state.playerGold = new Map([[0, 1_000], [1, 1_000]]);
  state.nextUnitId = 6;
  state.tickCount = 1;
  state.lastTickTime = Date.now();
  state.status = { __kind__: 'active', active: null };
  state.mapSeed = seed;

  // Restart the tick for the new game.
  startTick(state);
}
