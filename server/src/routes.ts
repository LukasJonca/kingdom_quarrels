import { Router } from 'express';
import {
  createGame,
  getGame,
  getPlayerSide,
  joinGame,
  listGames,
  resetGame,
  stopTick,
} from './gameRooms';
import {
  checkWin,
  counterMultiplier,
  counterMultiplierVsStructure,
  isMoveValid,
  posKey,
  stateToView,
  terrainArmor,
  unitStatsFor,
} from './gameLogic';
import type { GameListEntry, PlayerTag, UnitKind } from './types';
import { broadcastState } from './socket';

export const router = Router();

// ─── Lobby ────────────────────────────────────────────────────────────────────

router.get('/games', (_req, res) => {
  const games = listGames();
  const list: GameListEntry[] = games.map((g) => ({
    id: g.id,
    playerCount: g.playerCount,
    tickCount: g.tickCount,
    status: g.status,
    createdAt: g.createdAt,
  }));
  res.json(list);
});

router.post('/games', (_req, res) => {
  const { gameId, playerToken } = createGame();
  broadcastState(gameId, stateToView(getGame(gameId)!));
  res.json({ gameId, playerToken, playerSide: 'blue' });
});

router.post('/games/:id/join', (req, res) => {
  const result = joinGame(req.params.id);
  if ('error' in result) { res.status(400).json({ error: result.error }); return; }
  broadcastState(req.params.id, stateToView(getGame(req.params.id)!));
  res.json(result);
});

router.get('/games/:id/state', (req, res) => {
  const state = getGame(req.params.id);
  if (!state) { res.status(404).json({ error: 'Game not found' }); return; }
  res.json(stateToView(state));
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

function validatePlayer(
  req: { body: { playerToken?: string } },
  gameId: string,
): { side: PlayerTag; state: NonNullable<ReturnType<typeof getGame>> } | { error: string; status: number } {
  const state = getGame(gameId);
  if (!state) return { error: 'Game not found', status: 404 };
  const token = req.body.playerToken as string | undefined;
  if (!token) return { error: 'Missing playerToken', status: 401 };
  const side = getPlayerSide(state, token);
  if (!side) return { error: 'Unauthorized', status: 403 };
  return { side, state };
}

// After a mutation that can end the game, stop the tick if won.
function handleWin(state: NonNullable<ReturnType<typeof getGame>>): void {
  if (state.status.__kind__ === 'won') stopTick(state);
}

// ─── Game actions ─────────────────────────────────────────────────────────────

// Move unit
router.post('/games/:id/move', (req, res) => {
  const v = validatePlayer(req, req.params.id);
  if ('error' in v) { res.status(v.status).json({ error: v.error }); return; }
  const { side, state } = v;

  if (state.status.__kind__ === 'won') { res.json({ __kind__: 'err', err: 'gameOver' }); return; }

  const { unitId, to } = req.body as { unitId: number; to: { x: number; y: number } };
  const unit = state.units.get(unitId);
  if (!unit) { res.json({ __kind__: 'err', err: 'unitNotFound' }); return; }
  if (unit.owner !== side) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  if (unit.moved) { res.json({ __kind__: 'err', err: 'unitAlreadyMoved' }); return; }
  if (!isMoveValid(state, unit, to)) { res.json({ __kind__: 'err', err: 'impassableTerrain' }); return; }

  unit.pos = to;
  unit.moved = true;
  broadcastState(req.params.id, stateToView(state));
  res.json({ __kind__: 'ok', ok: null });
});

// Attack unit
router.post('/games/:id/attack', (req, res) => {
  const v = validatePlayer(req, req.params.id);
  if ('error' in v) { res.status(v.status).json({ error: v.error }); return; }
  const { side, state } = v;

  if (state.status.__kind__ === 'won') { res.json({ __kind__: 'err', err: 'gameOver' }); return; }

  const { attackerId, targetId } = req.body as { attackerId: number; targetId: number };
  const attacker = state.units.get(attackerId);
  if (!attacker) { res.json({ __kind__: 'err', err: 'unitNotFound' }); return; }
  if (attacker.owner !== side) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  if (attacker.attacked) { res.json({ __kind__: 'err', err: 'unitAlreadyAttacked' }); return; }

  const target = state.units.get(targetId);
  if (!target) { res.json({ __kind__: 'err', err: 'unitNotFound' }); return; }
  if (target.owner === attacker.owner) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }

  const adx = Math.abs(attacker.pos.x - target.pos.x);
  const ady = Math.abs(attacker.pos.y - target.pos.y);
  const dist = adx + ady;
  if ((adx !== 0 && ady !== 0) || dist < attacker.attackRangeMin || dist > attacker.attackRangeMax) {
    res.json({ __kind__: 'err', err: 'outOfRange' }); return;
  }

  const raw = counterMultiplier(attacker.archetype, target.archetype) * attacker.strength;
  const armor = terrainArmor(state.tiles.get(posKey(target.pos.x, target.pos.y)) ?? 'grass');
  const dmg = Math.max(1, Math.floor(raw * (1 - armor)));

  attacker.attacked = true;
  attacker.moved = true;

  if (target.hp <= dmg) {
    state.units.delete(targetId);
    const attackerIdx = attacker.owner === 'blue' ? 0 : 1;
    const prev = state.playerGold.get(attackerIdx) ?? 0;
    state.playerGold.set(attackerIdx, Math.min(9_999, prev + target.killGold));
  } else {
    target.hp -= dmg;
  }

  state.status = checkWin(state.units, state.castles);
  handleWin(state);
  broadcastState(req.params.id, stateToView(state));
  res.json({ __kind__: 'ok', ok: null });
});

// Attack castle
router.post('/games/:id/attack-castle', (req, res) => {
  const v = validatePlayer(req, req.params.id);
  if ('error' in v) { res.status(v.status).json({ error: v.error }); return; }
  const { side, state } = v;

  if (state.status.__kind__ === 'won') { res.json({ __kind__: 'err', err: 'gameOver' }); return; }

  const { attackerId } = req.body as { attackerId: number };
  const attacker = state.units.get(attackerId);
  if (!attacker) { res.json({ __kind__: 'err', err: 'unitNotFound' }); return; }
  if (attacker.owner !== side) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  if (attacker.attacked) { res.json({ __kind__: 'err', err: 'unitAlreadyAttacked' }); return; }

  let targetCastleKey: number | null = null;
  let targetCastle = null;
  for (const [k, c] of state.castles) {
    if (c.owner !== attacker.owner) {
      const cdx = Math.abs(attacker.pos.x - c.pos.x);
      const cdy = Math.abs(attacker.pos.y - c.pos.y);
      const dist = cdx + cdy;
      if ((cdx === 0 || cdy === 0) && dist >= attacker.attackRangeMin && dist <= attacker.attackRangeMax) {
        targetCastleKey = k; targetCastle = c; break;
      }
    }
  }
  if (!targetCastle || targetCastleKey === null) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }

  const mult = counterMultiplierVsStructure(attacker.archetype);
  const raw = mult * attacker.strength;
  const armor = terrainArmor(state.tiles.get(posKey(targetCastle.pos.x, targetCastle.pos.y)) ?? 'grass');
  const dmg = Math.max(1, Math.floor(raw * (1 - armor)));

  attacker.attacked = true;
  attacker.moved = true;
  targetCastle.hp = Math.max(0, targetCastle.hp - dmg);

  state.status = checkWin(state.units, state.castles);
  handleWin(state);
  broadcastState(req.params.id, stateToView(state));
  res.json({ __kind__: 'ok', ok: null });
});

// Attack structure
router.post('/games/:id/attack-structure', (req, res) => {
  const v = validatePlayer(req, req.params.id);
  if ('error' in v) { res.status(v.status).json({ error: v.error }); return; }
  const { side, state } = v;

  if (state.status.__kind__ === 'won') { res.json({ __kind__: 'err', err: 'gameOver' }); return; }

  const { attackerId, structureId } = req.body as { attackerId: number; structureId: string };
  const attacker = state.units.get(attackerId);
  if (!attacker) { res.json({ __kind__: 'err', err: 'unitNotFound' }); return; }
  if (attacker.owner !== side) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  if (attacker.attacked) { res.json({ __kind__: 'err', err: 'unitAlreadyAttacked' }); return; }

  const structure = state.structures.get(structureId);
  if (!structure) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  if (structure.kind === 'castle') { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }

  const sdx = Math.abs(attacker.pos.x - structure.pos.x);
  const sdy = Math.abs(attacker.pos.y - structure.pos.y);
  const dist = sdx + sdy;
  if ((sdx !== 0 && sdy !== 0) || dist < attacker.attackRangeMin || dist > attacker.attackRangeMax) {
    res.json({ __kind__: 'err', err: 'outOfRange' }); return;
  }

  const mult = counterMultiplierVsStructure(attacker.archetype);
  const raw = mult * attacker.strength;
  const armor = terrainArmor(state.tiles.get(posKey(structure.pos.x, structure.pos.y)) ?? 'grass');
  const dmg = Math.max(1, Math.floor(raw * (1 - armor)));

  attacker.attacked = true;
  attacker.moved = true;

  if (structure.hp <= dmg) {
    if (structure.kind === 'barricade') {
      state.structures.delete(structureId);
    } else {
      structure.owner = attacker.owner === 'blue' ? 0 : 1;
      structure.hp = structure.maxHp;
    }
  } else {
    structure.hp -= dmg;
  }

  broadcastState(req.params.id, stateToView(state));
  res.json({ __kind__: 'ok', ok: null });
});

// Spawn unit
router.post('/games/:id/spawn', (req, res) => {
  const v = validatePlayer(req, req.params.id);
  if ('error' in v) { res.status(v.status).json({ error: v.error }); return; }
  const { side, state } = v;

  if (state.status.__kind__ === 'won') { res.json({ __kind__: 'err', err: 'gameOver' }); return; }

  const { kind, structureId, targetPos } = req.body as {
    kind: UnitKind;
    structureId: string;
    targetPos: { x: number; y: number };
  };

  let spawnerPos = null;
  let ownerIdx = side === 'blue' ? 0 : 1;

  if (structureId === 'castle-0' || structureId === 'castle-1') {
    const castleIdx = structureId === 'castle-0' ? 0 : 1;
    const castle = state.castles.get(castleIdx);
    if (!castle) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
    ownerIdx = castleIdx;
    spawnerPos = castle.pos;
  } else {
    const structure = state.structures.get(structureId);
    if (!structure) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
    if (structure.kind !== 'castle' && structure.kind !== 'settlement') {
      res.json({ __kind__: 'err', err: 'invalidTarget' }); return;
    }
    if (structure.owner === undefined) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
    ownerIdx = structure.owner;
    spawnerPos = structure.pos;
  }

  if (ownerIdx !== (side === 'blue' ? 0 : 1)) {
    res.json({ __kind__: 'err', err: 'invalidTarget' }); return;
  }

  const dist = Math.max(
    Math.abs(spawnerPos.x - targetPos.x),
    Math.abs(spawnerPos.y - targetPos.y),
  );
  if (dist > 1) { res.json({ __kind__: 'err', err: 'outOfRange' }); return; }

  const terrain = state.tiles.get(posKey(targetPos.x, targetPos.y)) ?? 'grass';
  if (terrain === 'water') { res.json({ __kind__: 'err', err: 'impassableTerrain' }); return; }
  if ([...state.structures.values()].some((s) => s.pos.x === targetPos.x && s.pos.y === targetPos.y)) {
    res.json({ __kind__: 'err', err: 'impassableTerrain' }); return;
  }
  if ([...state.castles.values()].some((c) => c.pos.x === targetPos.x && c.pos.y === targetPos.y)) {
    res.json({ __kind__: 'err', err: 'impassableTerrain' }); return;
  }
  if ([...state.units.values()].some((u) => u.pos.x === targetPos.x && u.pos.y === targetPos.y)) {
    res.json({ __kind__: 'err', err: 'impassableTerrain' }); return;
  }

  const stats = unitStatsFor(kind);
  const gold = state.playerGold.get(ownerIdx) ?? 0;
  if (gold < stats.cost) { res.json({ __kind__: 'err', err: 'notEnoughGold' }); return; }

  state.playerGold.set(ownerIdx, gold - stats.cost);
  const id = state.nextUnitId++;
  state.units.set(id, {
    id, owner: side, kind, archetype: stats.archetype, strength: stats.strength,
    moveRange: stats.moveRange, attackRangeMin: stats.attackRangeMin,
    attackRangeMax: stats.attackRangeMax, killGold: stats.killGold,
    pos: targetPos, hp: stats.maxHp, maxHp: stats.maxHp,
    moved: true, attacked: false,
  });

  broadcastState(req.params.id, stateToView(state));
  res.json({ __kind__: 'ok', ok: null });
});

// Reset game
router.post('/games/:id/reset', (req, res) => {
  const state = getGame(req.params.id);
  if (!state) { res.status(404).json({ error: 'Game not found' }); return; }
  const token = (req.body as { playerToken?: string }).playerToken;
  if (!token || getPlayerSide(state, token) === null) {
    res.status(403).json({ error: 'Unauthorized' }); return;
  }
  resetGame(state);
  broadcastState(req.params.id, stateToView(state));
  res.json({ __kind__: 'ok', ok: null });
});

// Capture structure (direct ownership transfer for adjacent neutral structures)
router.post('/games/:id/capture', (req, res) => {
  const v = validatePlayer(req, req.params.id);
  if ('error' in v) { res.status(v.status).json({ error: v.error }); return; }
  const { side, state } = v;

  if (state.status.__kind__ === 'won') { res.json({ __kind__: 'err', err: 'gameOver' }); return; }

  const { unitId, structureId } = req.body as { unitId: number; structureId: string };
  const unit = state.units.get(unitId);
  if (!unit) { res.json({ __kind__: 'err', err: 'unitNotFound' }); return; }
  if (unit.owner !== side) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  if (unit.moved && unit.attacked) { res.json({ __kind__: 'err', err: 'unitAlreadyMoved' }); return; }

  const structure = state.structures.get(structureId);
  if (!structure) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  if (structure.kind === 'barricade') { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }
  const ownerIdx = side === 'blue' ? 0 : 1;
  if (structure.owner === ownerIdx) { res.json({ __kind__: 'err', err: 'invalidTarget' }); return; }

  const dist = Math.max(Math.abs(unit.pos.x - structure.pos.x), Math.abs(unit.pos.y - structure.pos.y));
  if (dist > 1) { res.json({ __kind__: 'err', err: 'outOfRange' }); return; }

  structure.owner = ownerIdx;
  unit.moved = true;
  unit.attacked = true;

  broadcastState(req.params.id, stateToView(state));
  res.json({ __kind__: 'ok', ok: null });
});
