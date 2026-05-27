import type {
  Castle,
  GameStatus,
  MatchState,
  Pos,
  Structure,
  TerrainKind,
  Tile,
  Unit,
  UnitArchetype,
  UnitKind,
  UnitStats,
} from './types';

export const MAP_SIZE = 13;
export const CASTLE_HP = 500;

const CIRCLE_CX = 6.0;
const CIRCLE_CY = 6.0;
const CIRCLE_R = 5.5;

export function isInCircle(x: number, y: number): boolean {
  const fx = x - CIRCLE_CX;
  const fy = y - CIRCLE_CY;
  return fx * fx + fy * fy <= CIRCLE_R * CIRCLE_R;
}

export function posKey(x: number, y: number): number {
  return y * MAP_SIZE + x;
}

export function chebyshevDist(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function moveCostFloat(t: TerrainKind): number {
  switch (t) {
    case 'grass':    return 1.0;
    case 'forest':   return 1.5;
    case 'mountain': return 2.0;
    case 'water':    return 0.0;
  }
}

export function terrainArmor(t: TerrainKind): number {
  switch (t) {
    case 'grass':    return 0.0;
    case 'forest':   return 0.15;
    case 'mountain': return 0.30;
    case 'water':    return 0.0;
  }
}

function lcgNext(state: number): [number, number] {
  const next = ((state * 1664525) + 1013904223) >>> 0;
  return [next, next % 100];
}

function isCastleZone(x: number, y: number): boolean {
  for (const [cx, cy] of [[1, 6], [11, 6]] as [number, number][]) {
    if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) return true;
  }
  return false;
}

export function buildTileMap(seed: number, structurePositions: [number, number][]): Map<number, TerrainKind> {
  let rng = seed;
  const terrainMap = new Map<number, TerrainKind>();

  for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
    const x = i % MAP_SIZE;
    const y = Math.floor(i / MAP_SIZE);
    const k = posKey(x, y);

    if (!isInCircle(x, y)) {
      terrainMap.set(k, 'water');
    } else if (isCastleZone(x, y)) {
      terrainMap.set(k, 'grass');
    } else {
      const isStructPos = structurePositions.some(([sx, sy]) => sx === x && sy === y);
      if (isStructPos) {
        terrainMap.set(k, 'grass');
      } else {
        const [nextRng, roll] = lcgNext(rng);
        rng = nextRng;
        const t: TerrainKind = roll < 20 ? 'forest' : roll < 30 ? 'mountain' : 'grass';
        terrainMap.set(k, t);
      }
    }
  }

  // Water body generation
  let wRng = seed + 777777;
  const dirs4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function isValidWaterTile(x: number, y: number, structPos: [number, number][]): boolean {
    if (!isInCircle(x, y)) return false;
    if (isCastleZone(x, y)) return false;
    for (const [sx, sy] of structPos) {
      if (sx === x && sy === y) return false;
      if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) return false;
    }
    return true;
  }

  function inZone(x: number, y: number): boolean {
    return x >= 5 && x <= 7 && y >= 3 && y <= 9;
  }

  const midCandidates: [number, number][] = [
    [5,3],[6,3],[7,3],[5,4],[6,4],[7,4],[5,5],[6,5],[7,5],
    [5,6],[6,6],[7,6],[5,7],[6,7],[7,7],[5,8],[6,8],[7,8],
    [5,9],[6,9],[7,9],
  ];
  const poolSize = midCandidates.length;

  const [wRng0] = lcgNext(wRng);
  wRng = wRng0;

  let lakePlaced = false;
  let retryCount = 0;

  while (retryCount < 3 && !lakePlaced) {
    let seedFound = false;
    let seedX = 0;
    let seedY = 0;
    let seedAttempts = 0;

    while (seedAttempts < 15 && !seedFound) {
      const [wRng1, pick1] = lcgNext(wRng);
      wRng = wRng1;
      const idx = pick1 % poolSize;
      const [cx, cy] = midCandidates[idx];
      if (isValidWaterTile(cx, cy, structurePositions)) {
        seedX = cx; seedY = cy; seedFound = true;
      }
      seedAttempts++;
    }

    if (seedFound) {
      const seedKey = posKey(seedX, seedY);
      const seedOrig = terrainMap.get(seedKey) ?? 'grass';
      terrainMap.set(seedKey, 'water');
      let lakeSize = 1;
      const revertMap = new Map<number, TerrainKind>();
      revertMap.set(seedKey, seedOrig);
      const q: [number, number][] = [[seedX, seedY]];

      while (lakeSize < 6 && q.length > 0) {
        const [cx2, cy2] = q.shift()!;
        const [wRngA, startDir] = lcgNext(wRng);
        wRng = wRngA;
        const sDir = startDir % 4;

        for (let i = 0; i < 4 && lakeSize < 6; i++) {
          const dirIdx = (sDir + i) % 4;
          const [dx, dy] = dirs4[dirIdx];
          const nx = cx2 + dx;
          const ny = cy2 + dy;
          if (nx >= 0 && ny >= 0 && nx < MAP_SIZE && ny < MAP_SIZE) {
            if (inZone(nx, ny) && isValidWaterTile(nx, ny, structurePositions)) {
              const nk = posKey(nx, ny);
              if (terrainMap.get(nk) !== 'water') {
                revertMap.set(nk, terrainMap.get(nk) ?? 'grass');
                terrainMap.set(nk, 'water');
                q.push([nx, ny]);
                lakeSize++;
              }
            }
          }
        }
      }

      if (lakeSize >= 4) {
        lakePlaced = true;
      } else {
        for (const [rk, orig] of revertMap) {
          terrainMap.set(rk, orig);
        }
        retryCount++;
      }
    } else {
      retryCount++;
    }
  }

  return terrainMap;
}

export function tileMapToView(tiles: Map<number, TerrainKind>): Tile[] {
  const result: Tile[] = [];
  for (const [key, terrain] of tiles) {
    const x = key % MAP_SIZE;
    const y = Math.floor(key / MAP_SIZE);
    result.push({ pos: { x, y }, terrain });
  }
  return result;
}

export function unitStatsFor(kind: UnitKind): UnitStats {
  switch (kind) {
    case 'swordsman': return { cost: 100,  maxHp: 120, strength: 50, moveRange: 3.0, attackRangeMin: 1, attackRangeMax: 1, killGold: 25,  archetype: 'infantry'       };
    case 'pikeman':   return { cost: 150,  maxHp: 120, strength: 50, moveRange: 3.0, attackRangeMin: 1, attackRangeMax: 1, killGold: 50,  archetype: 'antiCavalry'   };
    case 'pillager':  return { cost: 200,  maxHp: 120, strength: 50, moveRange: 4.0, attackRangeMin: 1, attackRangeMax: 1, killGold: 50,  archetype: 'scout'          };
    case 'archer':    return { cost: 250,  maxHp: 100, strength: 50, moveRange: 3.5, attackRangeMin: 2, attackRangeMax: 3, killGold: 100, archetype: 'rangedInfantry' };
    case 'knight':    return { cost: 400,  maxHp: 180, strength: 50, moveRange: 4.5, attackRangeMin: 1, attackRangeMax: 1, killGold: 150, archetype: 'cavalry'        };
    case 'brute':     return { cost: 550,  maxHp: 300, strength: 50, moveRange: 2.5, attackRangeMin: 1, attackRangeMax: 1, killGold: 200, archetype: 'heavyInfantry'  };
    case 'catapult':  return { cost: 700,  maxHp: 120, strength: 60, moveRange: 2.0, attackRangeMin: 3, attackRangeMax: 4, killGold: 300, archetype: 'siege'          };
  }
}

export function counterMultiplier(atk: UnitArchetype, def: UnitArchetype): number {
  const table: Record<string, number> = {
    'infantry-infantry': 1.00, 'infantry-antiCavalry': 1.50, 'infantry-scout': 1.00,
    'infantry-cavalry': 1.00, 'infantry-rangedInfantry': 1.00, 'infantry-siege': 1.00, 'infantry-heavyInfantry': 0.50,
    'antiCavalry-infantry': 0.75, 'antiCavalry-antiCavalry': 1.00, 'antiCavalry-scout': 1.00,
    'antiCavalry-cavalry': 2.00, 'antiCavalry-rangedInfantry': 1.00, 'antiCavalry-siege': 1.00, 'antiCavalry-heavyInfantry': 0.75,
    'scout-infantry': 0.50, 'scout-antiCavalry': 0.50, 'scout-scout': 0.50,
    'scout-cavalry': 0.50, 'scout-rangedInfantry': 0.50, 'scout-siege': 2.00, 'scout-heavyInfantry': 0.50,
    'cavalry-infantry': 1.00, 'cavalry-antiCavalry': 0.50, 'cavalry-scout': 2.00,
    'cavalry-cavalry': 1.00, 'cavalry-rangedInfantry': 2.00, 'cavalry-siege': 1.00, 'cavalry-heavyInfantry': 1.00,
    'rangedInfantry-infantry': 2.25, 'rangedInfantry-antiCavalry': 2.00, 'rangedInfantry-scout': 0.75,
    'rangedInfantry-cavalry': 0.75, 'rangedInfantry-rangedInfantry': 1.00, 'rangedInfantry-siege': 0.75, 'rangedInfantry-heavyInfantry': 1.25,
    'siege-infantry': 1.50, 'siege-antiCavalry': 1.50, 'siege-scout': 0.50,
    'siege-cavalry': 0.75, 'siege-rangedInfantry': 1.50, 'siege-siege': 1.00, 'siege-heavyInfantry': 2.00,
    'heavyInfantry-infantry': 2.00, 'heavyInfantry-antiCavalry': 1.00, 'heavyInfantry-scout': 1.00,
    'heavyInfantry-cavalry': 1.50, 'heavyInfantry-rangedInfantry': 2.00, 'heavyInfantry-siege': 1.50, 'heavyInfantry-heavyInfantry': 1.00,
  };
  return table[`${atk}-${def}`] ?? 1.0;
}

export function counterMultiplierVsStructure(atk: UnitArchetype): number {
  switch (atk) {
    case 'infantry':      return 1.00;
    case 'antiCavalry':   return 1.00;
    case 'scout':         return 2.50;
    case 'cavalry':       return 1.00;
    case 'rangedInfantry': return 0.75;
    case 'siege':         return 2.00;
    case 'heavyInfantry': return 1.50;
  }
}

export function checkWin(units: Map<number, Unit>, castles: Map<number, Castle>): GameStatus {
  let hasBlue = false;
  let hasRed = false;
  for (const u of units.values()) {
    if (u.owner === 'blue') hasBlue = true;
    else hasRed = true;
  }
  if (!hasBlue) return { __kind__: 'won', won: 'red' };
  if (!hasRed)  return { __kind__: 'won', won: 'blue' };

  const blueCastle = castles.get(0);
  const redCastle  = castles.get(1);
  if (blueCastle && blueCastle.hp === 0) return { __kind__: 'won', won: 'red' };
  if (redCastle  && redCastle.hp === 0)  return { __kind__: 'won', won: 'blue' };
  return { __kind__: 'active', active: null };
}

export function initialStructures(seed: number): [Map<string, Structure>, [number, number][]] {
  // Near-castle mines (fixed)
  const nearCastleMines: [number, number][] = [[3, 4], [9, 8]];

  // Simulate water placement to find water tiles
  let wRng = seed + 777777;
  const waterTiles = new Set<number>();
  const dirs4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const midCandidates: [number, number][] = [
    [5,3],[6,3],[7,3],[5,4],[6,4],[7,4],[5,5],[6,5],[7,5],
    [5,6],[6,6],[7,6],[5,7],[6,7],[7,7],[5,8],[6,8],[7,8],
    [5,9],[6,9],[7,9],
  ];
  const poolSize = midCandidates.length;

  function isValidForWater(x: number, y: number, structPos: [number, number][]): boolean {
    if (!isInCircle(x, y)) return false;
    if (isCastleZone(x, y)) return false;
    for (const [sx, sy] of structPos) {
      if (sx === x && sy === y) return false;
      if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) return false;
    }
    return true;
  }

  const [wRng0] = lcgNext(wRng);
  wRng = wRng0;
  let lakePlaced = false;
  let retryCount = 0;

  while (retryCount < 3 && !lakePlaced) {
    let seedFound = false;
    let seedX = 0;
    let seedY = 0;
    let seedAttempts = 0;
    while (seedAttempts < 15 && !seedFound) {
      const [wRng1, pick1] = lcgNext(wRng);
      wRng = wRng1;
      const idx = pick1 % poolSize;
      const [cx, cy] = midCandidates[idx];
      if (isValidForWater(cx, cy, nearCastleMines)) {
        seedX = cx; seedY = cy; seedFound = true;
      }
      seedAttempts++;
    }
    if (seedFound) {
      const seedKey = posKey(seedX, seedY);
      const tempWater = new Set<number>([seedKey]);
      let lakeSize = 1;
      const q: [number, number][] = [[seedX, seedY]];
      while (lakeSize < 6 && q.length > 0) {
        const [cx2, cy2] = q.shift()!;
        const [wRngA, startDir] = lcgNext(wRng);
        wRng = wRngA;
        const sDir = startDir % 4;
        for (let i = 0; i < 4 && lakeSize < 6; i++) {
          const dirIdx = (sDir + i) % 4;
          const [dx, dy] = dirs4[dirIdx];
          const nx = cx2 + dx;
          const ny = cy2 + dy;
          if (nx >= 0 && ny >= 0 && nx < MAP_SIZE && ny < MAP_SIZE) {
            if (nx >= 5 && nx <= 7 && ny >= 3 && ny <= 9 && isValidForWater(nx, ny, nearCastleMines)) {
              const nk = posKey(nx, ny);
              if (!tempWater.has(nk)) {
                tempWater.add(nk);
                q.push([nx, ny]);
                lakeSize++;
              }
            }
          }
        }
      }
      if (lakeSize >= 4) {
        for (const k of tempWater) waterTiles.add(k);
        lakePlaced = true;
      } else {
        retryCount++;
      }
    } else {
      retryCount++;
    }
  }

  // Pick outpost row in col 6
  const outpostCol = 6;
  let outpostRow = 6;
  function minWaterDist(r: number): number {
    let minD = 9999;
    for (const wk of waterTiles) {
      const wx = wk % MAP_SIZE;
      const wy = Math.floor(wk / MAP_SIZE);
      const d = Math.abs(outpostCol - wx) + Math.abs(r - wy);
      if (d < minD) minD = d;
    }
    return minD;
  }

  let bestRow = 9999;
  let bestDist = 0;
  let foundValid = false;
  for (let ri = 3; ri <= 9; ri++) {
    if (!waterTiles.has(posKey(outpostCol, ri)) && isInCircle(outpostCol, ri)) {
      const d = minWaterDist(ri);
      if (d >= 3) {
        const distFromCenter = Math.abs(ri - 6);
        if (!foundValid || distFromCenter > bestDist) {
          bestRow = ri; bestDist = distFromCenter; foundValid = true;
        }
      }
    }
  }
  if (!foundValid) {
    for (let ri = 3; ri <= 9; ri++) {
      if (!waterTiles.has(posKey(outpostCol, ri)) && isInCircle(outpostCol, ri)) {
        const d = minWaterDist(ri);
        if (d >= 1 && d > bestDist) { bestRow = ri; bestDist = d; }
      }
    }
  }
  outpostRow = bestRow === 9999 ? 6 : bestRow;

  // Pick middle mine positions
  const mine1Candidates: [number, number][] = [[5,6],[5,5],[5,7],[5,4],[5,8],[5,3],[5,9]];
  const fixedPositions: [number, number][] = [[3,4],[9,8],[outpostCol, outpostRow]];

  function isValidMinePos(cx: number, cy: number): boolean {
    if (!isInCircle(cx, cy)) return false;
    if (waterTiles.has(posKey(cx, cy))) return false;
    for (const [fx, fy] of fixedPositions) {
      if (fx === cx && fy === cy) return false;
      if (Math.abs(cx - fx) <= 1 && Math.abs(cy - fy) <= 1) return false;
    }
    for (const [mx, my] of nearCastleMines) {
      if (mx === cx && my === cy) return false;
      if (Math.abs(cx - mx) <= 1 && Math.abs(cy - my) <= 1) return false;
    }
    return true;
  }

  let mine1X = 5;
  let mine1Y = 9;
  for (const [cx, cy] of mine1Candidates) {
    if (isValidMinePos(cx, cy)) { mine1X = cx; mine1Y = cy; break; }
  }
  const mine2X = 12 - mine1X;
  const mine2Y = mine1Y;

  const structures = new Map<string, Structure>();
  structures.set('mine0',   { id: 'mine0',   kind: 'mine',       pos: { x: 3,          y: 4          }, hp: 150, maxHp: 150, goldGenerated: 0 });
  structures.set('mine1',   { id: 'mine1',   kind: 'mine',       pos: { x: mine1X,     y: mine1Y     }, hp: 150, maxHp: 150, goldGenerated: 0 });
  structures.set('mine2',   { id: 'mine2',   kind: 'mine',       pos: { x: mine2X,     y: mine2Y     }, hp: 150, maxHp: 150, goldGenerated: 0 });
  structures.set('mine3',   { id: 'mine3',   kind: 'mine',       pos: { x: 9,          y: 8          }, hp: 150, maxHp: 150, goldGenerated: 0 });
  structures.set('outpost0',{ id: 'outpost0',kind: 'settlement', pos: { x: outpostCol, y: outpostRow }, hp: 250, maxHp: 250, goldGenerated: 0 });

  const positions: [number, number][] = [
    [3, 4], [mine1X, mine1Y], [mine2X, mine2Y], [9, 8], [outpostCol, outpostRow],
  ];

  return [structures, positions];
}

export function initialUnits(): Map<number, Unit> {
  const units = new Map<number, Unit>();
  const sStats = unitStatsFor('swordsman');
  const mkUnit = (id: number, owner: 'blue' | 'red', x: number, y: number): Unit => ({
    id, owner, kind: 'swordsman', archetype: sStats.archetype,
    strength: sStats.strength, moveRange: sStats.moveRange,
    attackRangeMin: sStats.attackRangeMin, attackRangeMax: sStats.attackRangeMax,
    killGold: sStats.killGold, pos: { x, y }, hp: sStats.maxHp, maxHp: sStats.maxHp,
    moved: false, attacked: false,
  });
  units.set(0, mkUnit(0, 'blue', 2, 5));
  units.set(1, mkUnit(1, 'blue', 2, 6));
  units.set(2, mkUnit(2, 'blue', 2, 7));
  units.set(3, mkUnit(3, 'red',  10, 5));
  units.set(4, mkUnit(4, 'red',  10, 6));
  units.set(5, mkUnit(5, 'red',  10, 7));
  return units;
}

export function initialCastles(): Map<number, Castle> {
  const castles = new Map<number, Castle>();
  castles.set(0, { owner: 'blue', pos: { x: 1,  y: 6 }, hp: CASTLE_HP, maxHp: CASTLE_HP, goldGenerated: 0 });
  castles.set(1, { owner: 'red',  pos: { x: 11, y: 6 }, hp: CASTLE_HP, maxHp: CASTLE_HP, goldGenerated: 0 });
  return castles;
}

export function isMoveValid(state: MatchState, unit: Unit, dest: Pos): boolean {
  if (dest.x >= MAP_SIZE || dest.y >= MAP_SIZE) return false;
  if (!isInCircle(dest.x, dest.y)) return false;
  const destTerrain = state.tiles.get(posKey(dest.x, dest.y)) ?? 'grass';
  if (moveCostFloat(destTerrain) === 0.0) return false;
  for (const u of state.units.values()) {
    if (u.pos.x === dest.x && u.pos.y === dest.y && u.id !== unit.id) return false;
  }
  for (const s of state.structures.values()) {
    if (s.pos.x === dest.x && s.pos.y === dest.y) return false;
  }
  for (const c of state.castles.values()) {
    if (c.pos.x === dest.x && c.pos.y === dest.y) return false;
  }

  // Pre-compute blocked tile sets once (avoids O(n) spreads inside the BFS loop).
  // Enemy units hard-block traversal; friendly units are passable waypoints.
  const enemyTag = unit.owner === 'blue' ? 'red' : 'blue';
  const enemyUnitTiles = new Set<number>();
  for (const u of state.units.values()) {
    if (u.owner === enemyTag) enemyUnitTiles.add(posKey(u.pos.x, u.pos.y));
  }
  const structureTiles = new Set<number>();
  for (const s of state.structures.values()) structureTiles.add(posKey(s.pos.x, s.pos.y));
  const castleTiles = new Set<number>();
  for (const c of state.castles.values()) castleTiles.add(posKey(c.pos.x, c.pos.y));

  // BFS budget check
  const budget = new Map<number, number>();
  const startKey = posKey(unit.pos.x, unit.pos.y);
  budget.set(startKey, unit.moveRange);
  const q: [number, number, number][] = [[unit.pos.x, unit.pos.y, unit.moveRange]];
  const dirs4: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];

  let found = false;
  while (q.length > 0 && !found) {
    const [cx, cy, rem] = q.shift()!;
    if (cx === dest.x && cy === dest.y) { found = true; break; }
    for (const [dx, dy] of dirs4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE) continue;
      const nk = posKey(nx, ny);
      if (nx !== unit.pos.x || ny !== unit.pos.y) {
        if (enemyUnitTiles.has(nk)) continue;  // enemy units hard-block
        if (structureTiles.has(nk)) continue;
        if (castleTiles.has(nk)) continue;
      }
      const nTerrain = state.tiles.get(nk) ?? 'grass';
      const cost = moveCostFloat(nTerrain);
      if (cost === 0.0) continue;
      const newRem = rem - cost;
      if (newRem < 0) continue;
      const prevBest = budget.get(nk) ?? -1;
      if (newRem > prevBest) {
        budget.set(nk, newRem);
        q.push([nx, ny, newRem]);
      }
    }
  }
  return found;
}

export function stateToView(state: MatchState): import('./types').MatchStateView {
  return {
    tiles: tileMapToView(state.tiles),
    units: [...state.units.values()],
    castles: [...state.castles.values()],
    structures: [...state.structures.values()],
    playerGold: [...state.playerGold.entries()],
    tickCount: state.tickCount,
    lastTickTime: state.lastTickTime,
    status: state.status,
    mapSeed: state.mapSeed,
    playerCount: state.playerCount,
  };
}
