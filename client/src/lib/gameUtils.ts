import type { CastleView, GameStatus, Pos, StructureView, Tile, UnitView } from '@/types/game';
import { PlayerTag, StructureKind, TerrainKind } from '@/types/game';

export function posKey(pos: Pos): string {
  return `${pos.x},${pos.y}`;
}

export function keyToPos(key: string): Pos {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function findPath(
  unit: UnitView,
  from: Pos,
  to: Pos,
  tiles: Tile[],
  units: UnitView[],
  castles: CastleView[],
  structures?: StructureView[],
): Pos[] {
  const budget = unit.moveRange;
  const targetKey = posKey(to);

  // Enemy units fully block traversal; friendly units can be passed through but not stopped on.
  const enemyUnitKeys = new Set<string>(
    units.filter(u => u.owner !== unit.owner).map(u => posKey(u.pos)),
  );
  const friendlyUnitKeys = new Set<string>(
    units.filter(u => u.id !== unit.id && u.owner === unit.owner).map(u => posKey(u.pos)),
  );
  const occupiedByCastle = new Set<string>(
    castles.filter(c => c.owner === unit.owner).map(c => posKey(c.pos)),
  );
  const occupiedByStructure = new Set<string>((structures ?? []).map(s => posKey(s.pos)));
  const terrainMap = new Map<string, TerrainKind>(tiles.map(t => [posKey(t.pos), t.terrain]));
  const maxX = tiles.reduce((m, t) => Math.max(m, t.pos.x), 0);
  const maxY = tiles.reduce((m, t) => Math.max(m, t.pos.y), 0);

  const bestBudget = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const fromKey = posKey(from);
  bestBudget.set(fromKey, budget);
  parent.set(fromKey, null);

  const queue: Array<{ pos: Pos; remaining: number }> = [{ pos: from, remaining: budget }];

  while (queue.length > 0) {
    queue.sort((a, b) => b.remaining - a.remaining);
    const { pos: current, remaining } = queue.shift()!;
    const curKey = posKey(current);
    if (remaining <= 0) continue;

    const neighbours: Pos[] = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x,     y: current.y - 1 },
      { x: current.x,     y: current.y + 1 },
    ];

    for (const nb of neighbours) {
      if (nb.x < 0 || nb.y < 0 || nb.x > maxX || nb.y > maxY) continue;
      const key = posKey(nb);
      const terrain = terrainMap.get(key);
      if (!terrain || isImpassable(terrain)) continue;
      if (enemyUnitKeys.has(key)) continue;     // enemy units hard-block
      if (occupiedByCastle.has(key)) continue;
      if (occupiedByStructure.has(key)) continue;
      // Friendly units are passable waypoints — skip destination check here;
      // the caller already ensures the destination is not a friendly tile.
      const cost = moveCostFloat(terrain);
      const newRemaining = remaining - cost;
      if (newRemaining < 0) continue;
      const prev = bestBudget.get(key) ?? -1;
      if (newRemaining <= prev) continue;
      bestBudget.set(key, newRemaining);
      parent.set(key, curKey);
      queue.push({ pos: nb, remaining: newRemaining });
    }
  }

  if (!parent.has(targetKey)) return [];
  const path: Pos[] = [];
  let cur: string | null = targetKey;
  while (cur !== null) {
    path.unshift(keyToPos(cur));
    cur = parent.get(cur) ?? null;
  }
  return path;
}

export function getMoveAndAttackPath(
  unit: UnitView,
  targetPos: Pos,
  tiles: Tile[],
  units: UnitView[],
  castles: CastleView[],
  structures?: StructureView[],
): { landingPos: Pos; path: Pos[] } | null {
  const reachable = getReachableTiles(unit, tiles, units, castles, structures);
  const minR = unit.attackRangeMin;
  const maxR = unit.attackRangeMax;

  const cardinalCandidates: Pos[] = [];
  const diagonalCandidates: Pos[] = [];

  for (let dx = -maxR; dx <= maxR; dx++) {
    for (let dy = -maxR; dy <= maxR; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (dx !== 0 && dy !== 0) continue;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < minR || dist > maxR) continue;
      const nx = targetPos.x + dx;
      const ny = targetPos.y + dy;
      const key = posKey({ x: nx, y: ny });
      if (!reachable.has(key)) continue;
      const isCardinal = dx === 0 || dy === 0;
      if (isCardinal) cardinalCandidates.push({ x: nx, y: ny });
      else diagonalCandidates.push({ x: nx, y: ny });
    }
  }

  const ax = unit.pos.x;
  const ay = unit.pos.y;
  const tx = targetPos.x;
  const ty = targetPos.y;
  const dirX = tx - ax;
  const dirY = ty - ay;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;

  function pickBest(pool: Pos[]): { landingPos: Pos; path: Pos[] } | null {
    let best: { landingPos: Pos; path: Pos[] } | null = null;
    let bestCosine = -Infinity;
    let bestPathLen = Infinity;
    for (const candidate of pool) {
      const cx = candidate.x;
      const cy = candidate.y;
      const vecX = cx - ax;
      const vecY = cy - ay;
      const vecLen = Math.sqrt(vecX * vecX + vecY * vecY) || 1;
      const cosine = (vecX * dirX + vecY * dirY) / (vecLen * dirLen);
      if (cosine < bestCosine - 0.05) continue;
      const path = findPath(unit, unit.pos, candidate, tiles, units, castles, structures);
      if (path.length === 0) continue;
      const beatsByCosine = cosine > bestCosine + 0.05;
      const tieOnCosine = Math.abs(cosine - bestCosine) <= 0.05;
      if (beatsByCosine || (tieOnCosine && path.length < bestPathLen)) {
        bestCosine = cosine;
        bestPathLen = path.length;
        best = { landingPos: candidate, path };
      }
    }
    return best;
  }
  return pickBest(cardinalCandidates) ?? pickBest(diagonalCandidates);
}

export function isAttackableViaMove(
  unit: UnitView,
  target: UnitView,
  tiles: Tile[],
  units: UnitView[],
  castles: CastleView[],
  structures?: StructureView[],
): boolean {
  return getMoveAndAttackPath(unit, target.pos, tiles, units, castles, structures) !== null;
}

export function chebyshevDistance(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function isImpassable(terrain: TerrainKind): boolean {
  return terrain === TerrainKind.water;
}

export function getTileAt(tiles: Tile[], pos: Pos): Tile | undefined {
  return tiles.find(t => t.pos.x === pos.x && t.pos.y === pos.y);
}

export function getUnitAt(units: UnitView[], pos: Pos): UnitView | undefined {
  return units.find(u => u.pos.x === pos.x && u.pos.y === pos.y);
}

export function getCastleAt(castles: CastleView[], pos: Pos): CastleView | undefined {
  return castles.find(c => c.pos.x === pos.x && c.pos.y === pos.y);
}

export function getStructureAt(structures: StructureView[], pos: Pos): StructureView | undefined {
  return structures.find(s => s.pos.x === pos.x && s.pos.y === pos.y);
}

export function getAttackableStructures(unit: UnitView, structures: StructureView[]): StructureView[] {
  const ownerIdx = unit.owner === PlayerTag.blue ? 0 : 1;
  return structures.filter(s => {
    if (s.kind === StructureKind.barricade) return false;
    if (s.owner !== undefined && s.owner === ownerIdx) return false;
    return isCardinalInRange(unit.pos, s.pos, unit.attackRangeMin, unit.attackRangeMax);
  });
}

function moveCostFloat(terrain: TerrainKind): number {
  switch (terrain) {
    case TerrainKind.forest:   return 1.5;
    case TerrainKind.mountain: return 2.0;
    case TerrainKind.water:    return Infinity;
    default:                   return 1.0;
  }
}

export function getReachableTiles(
  unit: UnitView,
  tiles: Tile[],
  units: UnitView[],
  castles: CastleView[],
  structures?: StructureView[],
): Set<string> {
  const budget = unit.moveRange;
  // Enemy units fully block traversal; friendly units are passable waypoints (can't stop on them).
  const enemyUnitKeys = new Set<string>(units.filter(u => u.owner !== unit.owner).map(u => posKey(u.pos)));
  const friendlyUnitKeys = new Set<string>(
    units.filter(u => u.id !== unit.id && u.owner === unit.owner).map(u => posKey(u.pos))
  );
  const occupiedByCastle = new Set<string>(castles.filter(c => c.owner === unit.owner).map(c => posKey(c.pos)));
  const occupiedByStructure = new Set<string>((structures ?? []).map(s => posKey(s.pos)));
  const terrainMap = new Map<string, TerrainKind>(tiles.map(t => [posKey(t.pos), t.terrain]));
  const maxX = tiles.reduce((m, t) => Math.max(m, t.pos.x), 0);
  const maxY = tiles.reduce((m, t) => Math.max(m, t.pos.y), 0);

  const reachable = new Set<string>();
  const bestBudget = new Map<string, number>();
  bestBudget.set(posKey(unit.pos), budget);
  const queue: Array<{ pos: Pos; remaining: number }> = [{ pos: unit.pos, remaining: budget }];

  while (queue.length > 0) {
    const { pos: current, remaining } = queue.shift()!;
    if (remaining <= 0) continue;
    const neighbours: Pos[] = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x,     y: current.y - 1 },
      { x: current.x,     y: current.y + 1 },
    ];
    for (const nb of neighbours) {
      if (nb.x < 0 || nb.y < 0 || nb.x > maxX || nb.y > maxY) continue;
      const key = posKey(nb);
      const terrain = terrainMap.get(key);
      if (!terrain || isImpassable(terrain)) continue;
      if (enemyUnitKeys.has(key)) continue;     // enemy units hard-block
      if (occupiedByCastle.has(key)) continue;
      if (occupiedByStructure.has(key)) continue;
      const cost = moveCostFloat(terrain);
      const newRemaining = remaining - cost;
      if (newRemaining < 0) continue;
      const prev = bestBudget.get(key) ?? -1;
      if (newRemaining <= prev) continue;
      bestBudget.set(key, newRemaining);
      if (!friendlyUnitKeys.has(key)) reachable.add(key); // can traverse but not stop on friendlies
      queue.push({ pos: nb, remaining: newRemaining });
    }
  }
  return reachable;
}

/** Returns true when `to` is a valid attack target from `from`: cardinal-only, within range. */
function isCardinalInRange(from: Pos, to: Pos, minR: number, maxR: number): boolean {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  if (dx !== 0 && dy !== 0) return false; // no diagonal attacks
  const dist = dx + dy;
  return dist >= minR && dist <= maxR;
}

export function getAttackTargets(unit: UnitView, units: UnitView[]): UnitView[] {
  return units.filter(u =>
    u.owner !== unit.owner &&
    isCardinalInRange(unit.pos, u.pos, unit.attackRangeMin, unit.attackRangeMax),
  );
}

export function getAttackableCastle(unit: UnitView, castles: CastleView[]): CastleView | null {
  return castles.find(c =>
    c.owner !== unit.owner &&
    isCardinalInRange(unit.pos, c.pos, unit.attackRangeMin, unit.attackRangeMax),
  ) ?? null;
}

export function isWon(status: GameStatus): boolean {
  return status.__kind__ === 'won';
}

export function getWinner(status: GameStatus): PlayerTag | null {
  if (status.__kind__ === 'won') return status.won;
  return null;
}

/** Returns the set of posKey strings adjacent to structurePos that are valid spawn targets. */
export function getAdjacentSpawnTiles(
  structurePos: Pos,
  units: UnitView[],
  castles: CastleView[],
  structures: StructureView[],
  tiles: Tile[],
): Set<string> {
  const occupied = new Set<string>([
    ...units.map((u) => posKey(u.pos)),
    ...castles.map((c) => posKey(c.pos)),
    ...structures.map((s) => posKey(s.pos)),
  ]);
  const result = new Set<string>();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const pos: Pos = { x: structurePos.x + dx, y: structurePos.y + dy };
      const key = posKey(pos);
      if (occupied.has(key)) continue;
      const tile = tiles.find((t) => t.pos.x === pos.x && t.pos.y === pos.y);
      if (!tile || tile.terrain === TerrainKind.water) continue;
      result.add(key);
    }
  }
  return result;
}
