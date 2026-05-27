import { GameBoard } from '@/components/GameBoard';
import { SpawnPanel } from '@/components/SpawnPanel';
import { TurnHeader } from '@/components/TurnHeader';
import { UnitInfoPanel } from '@/components/UnitInfoPanel';
import { WinScreen } from '@/components/WinScreen';
import { type ActionResult, useGameActions } from '@/hooks/useGameActions';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useIntentState } from '@/hooks/useIntentState';
import { useMatchState } from '@/hooks/useMatchState';
import {
  findPath, getAdjacentSpawnTiles, getAttackTargets, getAttackableCastle, getAttackableStructures,
  getCastleAt, getMoveAndAttackPath, getReachableTiles, getStructureAt,
  getUnitAt, getWinner, isAttackableViaMove, isWon, posKey,
} from '@/lib/gameUtils';
import type { Pos, StructureView, UnitView } from '@/types/game';
import { PlayerTag, StructureKind, parsePlayerGold } from '@/types/game';
import { useCallback, useEffect, useRef, useState } from 'react';

type GamePhase = 'idle' | 'selected' | 'moved';

interface PendingSpawn {
  kind: string;
  structureId: string;
  structurePos: Pos;
}

const MS_PER_TILE = 350;

interface GamePageProps {
  gameId: string;
  onLeave: () => void;
}

export function GamePage({ gameId, onLeave }: GamePageProps) {
  const playerToken = localStorage.getItem(`kq-token-${gameId}`) ?? '';
  const playerSide = localStorage.getItem(`kq-side-${gameId}`) as PlayerTag | null;

  const isAnimatingRef = useRef(false);

  const { state, loading, error, refetch } = useMatchState(gameId, isAnimatingRef);
  const { flushPending } = useGameSocket(gameId, isAnimatingRef);
  const { moveUnit, attackUnit, attackCastle, attackStructure, spawnUnit } = useGameActions(
    gameId, playerToken,
  );

  // In the simultaneous tick system there is no "current player" — you control
  // your own units at any time within the 15-second window.
  function canControl(unit: UnitView): boolean {
    return unit.owner === playerSide;
  }

  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [attackingUnitId, setAttackingUnitId] = useState<number | null>(null);
  const [walkingUnitId, setWalkingUnitId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [spawnTarget, setSpawnTarget] = useState<{ structure: StructureView } | null>(null);
  const [pendingSpawn, setPendingSpawn] = useState<PendingSpawn | null>(null);
  const [statusText, setStatusText] = useState<string>('');

  const intentState = useIntentState();
  const { setHoverPreview, commitIntent, setPendingAction, clearIntent } = intentState;

  const animRef = useRef<{
    unitId: number;
    pathSteps: Pos[];
    startTime: number;
    movementComplete: boolean;
  } | null>(null);

  const smoothPosRef = useRef<{ unitId: number; smoothX: number; smoothY: number } | null>(null);
  const [smoothPos, setSmoothPos] = useState<{ unitId: number; smoothX: number; smoothY: number } | null>(null);
  const overlayDivRef = useRef<HTMLDivElement | null>(null);

  const startWalking = useCallback((unitId: number) => {
    isAnimatingRef.current = true;
    setWalkingUnitId(unitId);
  }, []);

  const pendingAttackRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  // Updated every render so RAF closures always call the latest finish logic.
  const onAnimDoneRef = useRef<() => void>(() => {});
  const [animTick, setAnimTick] = useState(0);
  // Keep onAnimDoneRef current — not a hook, just an inline assignment.
  onAnimDoneRef.current = () => {
    isAnimatingRef.current = false;
    flushPending();
    animRef.current = null;
    smoothPosRef.current = null;
    setWalkingUnitId(null);
    setSmoothPos(null);
    setAttackingUnitId(null);
  };

  const selectedUnit: UnitView | null =
    state && selectedUnitId !== null
      ? (state.units.find((u) => u.id === selectedUnitId) ?? null)
      : null;

  const structures: StructureView[] = state?.structures ?? [];

  const spawnAdjacentTiles: Set<string> = pendingSpawn && state
    ? getAdjacentSpawnTiles(pendingSpawn.structurePos, state.units, state.castles, structures, state.tiles)
    : new Set<string>();

  const reachableTiles: Set<string> = pendingSpawn
    ? spawnAdjacentTiles
    : state && selectedUnit && phase === 'selected'
      ? getReachableTiles(selectedUnit, state.tiles, state.units, state.castles, structures)
      : new Set();

  const attackableStructureIds = new Set<string>(
    state && selectedUnit && (phase === 'moved' || phase === 'selected')
      ? getAttackableStructures(selectedUnit, structures).map((s) => posKey(s.pos))
      : [],
  );

  const deselect = useCallback(() => {
    setSelectedUnitId(null);
    setPhase('idle');
    clearIntent();
  }, [clearIntent]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') deselect();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deselect]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: animTick triggers RAF restart
  useEffect(() => {
    if (!animRef.current) return;
    let rafId: number;
    const capturedPath = animRef.current.pathSteps;
    const capturedUnitId = animRef.current.unitId;
    const capturedStartTime = animRef.current.startTime;
    const BOARD_SIZE = 13;

    function tick(now: number) {
      const au = animRef.current;
      if (!au || au.unitId !== capturedUnitId) return;

      const elapsed = now - capturedStartTime;
      const segments = Math.max(1, capturedPath.length - 1);
      const totalDuration = segments * MS_PER_TILE;
      const progress = Math.min(1, elapsed / totalDuration);
      const segProgress = progress * segments;
      const segIdx = Math.min(Math.floor(segProgress), segments - 1);
      const segT = segProgress - segIdx;

      const from = capturedPath[segIdx];
      const to = capturedPath[segIdx + 1];
      const smoothX = from.x + (to.x - from.x) * segT;
      const smoothY = from.y + (to.y - from.y) * segT;

      smoothPosRef.current = { unitId: capturedUnitId, smoothX, smoothY };

      const overlayDiv = overlayDivRef.current;
      if (overlayDiv) {
        const tilePct = 100 / BOARD_SIZE;
        overlayDiv.style.left = `${smoothX * tilePct}%`;
        overlayDiv.style.top = `${smoothY * tilePct}%`;
      }

      if (progress >= 1 && !au.movementComplete) {
        // Snap to exact final tile
        const finalNode = capturedPath[capturedPath.length - 1];
        smoothPosRef.current = { unitId: capturedUnitId, smoothX: finalNode.x, smoothY: finalNode.y };
        if (overlayDiv) {
          const tilePct = 100 / BOARD_SIZE;
          overlayDiv.style.left = `${finalNode.x * tilePct}%`;
          overlayDiv.style.top  = `${finalNode.y * tilePct}%`;
        }
        au.movementComplete = true;
        rafIdRef.current = null;

        if (pendingAttackRef.current !== null && pendingAttackRef.current === capturedUnitId) {
          // Play attack flash, then finish
          pendingAttackRef.current = null;
          setAttackingUnitId(capturedUnitId);
          setTimeout(() => onAnimDoneRef.current(), 900);
        } else {
          // Pure move — finish immediately
          onAnimDoneRef.current();
        }
        return;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    }

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [animTick]);

  // Animation cleanup is now handled directly inside the RAF (onAnimDoneRef).

  const handleTileHover = useCallback(
    (pos: Pos | null) => {
      if (!state || !pos) { clearIntent(); return; }
      if (pendingSpawn || phase !== 'selected' || !selectedUnit) { clearIntent(); return; }

      const key = posKey(pos);
      const hoveredUnit = getUnitAt(state.units, pos);

      if (hoveredUnit && hoveredUnit.owner !== selectedUnit.owner) {
        const directTargets = getAttackTargets(selectedUnit, state.units);
        if (directTargets.some((t) => t.id === hoveredUnit.id)) {
          setHoverPreview(hoveredUnit.pos, [], hoveredUnit.id);
          return;
        }
        if (isAttackableViaMove(selectedUnit, hoveredUnit, state.tiles, state.units, state.castles, structures)) {
          const result = getMoveAndAttackPath(selectedUnit, hoveredUnit.pos, state.tiles, state.units, state.castles, structures);
          if (result) setHoverPreview(result.landingPos, result.path, hoveredUnit.id);
        } else {
          clearIntent();
        }
        return;
      }

      const hoveredStructure = getStructureAt(structures, pos);
      if (hoveredStructure && hoveredStructure.owner !== (selectedUnit.owner === 'blue' ? 0 : 1)) {
        const attackableNow = getAttackableStructures(selectedUnit, structures);
        if (attackableNow.some((s) => s.id === hoveredStructure.id)) {
          setHoverPreview(hoveredStructure.pos, [], hoveredStructure.id);
          return;
        }
        const result = getMoveAndAttackPath(selectedUnit, hoveredStructure.pos, state.tiles, state.units, state.castles, structures);
        if (result) { setHoverPreview(result.landingPos, result.path, hoveredStructure.id); return; }
      }

      const hoveredCastle = getCastleAt(state.castles, pos);
      if (hoveredCastle && hoveredCastle.owner !== selectedUnit.owner) {
        const attackable = getAttackableCastle(selectedUnit, state.castles);
        if (attackable && attackable.pos.x === pos.x && attackable.pos.y === pos.y) {
          const castleId = hoveredCastle.owner === 'blue' ? 'castle-0' : 'castle-1';
          setHoverPreview(hoveredCastle.pos, [], castleId);
          return;
        }
        const result = getMoveAndAttackPath(selectedUnit, hoveredCastle.pos, state.tiles, state.units, state.castles, structures);
        if (result) {
          const castleId = hoveredCastle.owner === 'blue' ? 'castle-0' : 'castle-1';
          setHoverPreview(result.landingPos, result.path, castleId);
          return;
        }
      }

      if (reachableTiles.has(key) && !hoveredUnit) {
        const path = findPath(selectedUnit, selectedUnit.pos, pos, state.tiles, state.units, state.castles, structures);
        if (path.length > 0) setHoverPreview(pos, path, null);
        else clearIntent();
        return;
      }
      clearIntent();
    },
    [state, pendingSpawn, phase, selectedUnit, reachableTiles, structures, setHoverPreview, clearIntent],
  );

  const clearAnimation = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isAnimatingRef.current = false;
    animRef.current = null;
    setSmoothPos(null);
    setWalkingUnitId(null);
    setAttackingUnitId(null);
    pendingAttackRef.current = null;
    flushPending();
  }, [flushPending]);

  function seedSmoothPos(unitId: number, path: Pos[]) {
    const startNode = path[0];
    const initPos = { unitId, smoothX: startNode.x, smoothY: startNode.y };
    smoothPosRef.current = initPos;
    setSmoothPos(initPos);
    animRef.current = { unitId, pathSteps: path, startTime: performance.now(), movementComplete: false };
    startWalking(unitId);
    setAnimTick((t) => t + 1);
  }

  const handleTileClick = useCallback(
    async (pos: Pos) => {
      if (!state || actionLoading) return;

      if (pendingSpawn) {
        if (spawnAdjacentTiles.has(posKey(pos))) {
          setPendingSpawn(null);
          setActionLoading(true);
          const result = await spawnUnit(pendingSpawn.kind as any, pendingSpawn.structureId, { x: pos.x, y: pos.y });
          setActionLoading(false);
          if (result.success) { setStatusText('Unit spawned!'); refetch(); }
          else setStatusText(`Spawn failed: ${result.error ?? 'unknown error'}`);
        } else {
          setPendingSpawn(null);
          clearIntent();
          setStatusText('Spawn cancelled');
        }
        return;
      }

      const clickedUnit = getUnitAt(state.units, pos);
      const clickedCastle = getCastleAt(state.castles, pos);
      const clickedStructure = getStructureAt(structures, pos);
      const { nextPosition } = intentState.intent;

      if (selectedUnitId === null) {
        if (clickedCastle) {
          const ownerIdx = clickedCastle.owner === 'blue' ? 0 : 1;
          const castleStructureId = ownerIdx === 0 ? 'castle-0' : 'castle-1';
          const castleAsStructure: StructureView = {
            id: castleStructureId,
            kind: StructureKind.castle,
            pos: clickedCastle.pos,
            owner: ownerIdx,
            hp: clickedCastle.hp,
            maxHp: clickedCastle.hp,
            goldGenerated: clickedCastle.goldGenerated,
          };
          setSpawnTarget({ structure: castleAsStructure });
          return;
        }
        if (clickedStructure && (clickedStructure.kind === StructureKind.castle || clickedStructure.kind === StructureKind.settlement)) {
          setSpawnTarget({ structure: clickedStructure });
          return;
        }
        if (clickedUnit) {
          // Only select units you own; you can still view enemy units by clicking them
          if (canControl(clickedUnit)) {
            setSelectedUnitId(clickedUnit.id);
            clearIntent();
            if (!clickedUnit.moved) setPhase('selected');
            else if (!clickedUnit.attacked) setPhase('moved');
            else setPhase('idle');
          }
        }
        return;
      }

      if (clickedUnit && clickedUnit.id === selectedUnitId) { deselect(); return; }

      if (phase === 'selected' || phase === 'moved') {
        if (!selectedUnit) return;

        // Direct unit attack
        if (clickedUnit && clickedUnit.owner !== selectedUnit.owner) {
          const targets = getAttackTargets(selectedUnit, state.units);
          if (targets.some((t) => t.id === clickedUnit.id)) {
            setActionLoading(true);
            isAnimatingRef.current = true;
            setAttackingUnitId(selectedUnitId);
            const attackTimeout = setTimeout(() => {
              setAttackingUnitId(null);
              isAnimatingRef.current = false;
              flushPending();
            }, 900);
            const result = await attackUnit(selectedUnitId, clickedUnit.id);
            setActionLoading(false);
            if (result.success) {
              setStatusText('Attacked enemy unit!');
              setSelectedUnitId(null); setPhase('idle'); clearIntent();
            } else {
              clearTimeout(attackTimeout);
              setAttackingUnitId(null);
              isAnimatingRef.current = false;
              setStatusText('Attack failed.');
              refetch();
            }
            return;
          }
        }

        // Direct castle attack
        if (clickedCastle && clickedCastle.owner !== selectedUnit.owner) {
          const attackable = getAttackableCastle(selectedUnit, state.castles);
          if (attackable && attackable.pos.x === pos.x && attackable.pos.y === pos.y) {
            setActionLoading(true);
            isAnimatingRef.current = true;
            setAttackingUnitId(selectedUnitId);
            const castleAttackTimeout = setTimeout(() => {
              setAttackingUnitId(null);
              isAnimatingRef.current = false;
              flushPending();
            }, 900);
            const result = await attackCastle(selectedUnitId);
            setActionLoading(false);
            if (result.success) {
              setStatusText('Attacked enemy castle!');
              setSelectedUnitId(null); setPhase('idle'); clearIntent();
            } else {
              clearTimeout(castleAttackTimeout);
              setAttackingUnitId(null);
              isAnimatingRef.current = false;
              setStatusText('Castle attack failed.');
              refetch();
            }
            return;
          }
        }

        // Direct structure attack
        if (clickedStructure) {
          const attackableNow = getAttackableStructures(selectedUnit, structures);
          if (attackableNow.some((s) => s.id === clickedStructure.id)) {
            setActionLoading(true);
            isAnimatingRef.current = true;
            setAttackingUnitId(selectedUnitId);
            const structTimeout = setTimeout(() => {
              setAttackingUnitId(null);
              isAnimatingRef.current = false;
              flushPending();
            }, 700);
            const structAttackResult = await attackStructure(selectedUnitId, clickedStructure.id);
            setActionLoading(false);
            if (structAttackResult.success) {
              setStatusText('Structure attacked!');
              setSelectedUnitId(null); setPhase('idle'); clearIntent();
            } else {
              clearTimeout(structTimeout);
              setAttackingUnitId(null);
              isAnimatingRef.current = false;
              setStatusText('Structure attack failed.');
              refetch();
            }
            return;
          }
        }

        // Move+attack to structure
        if (phase === 'selected' && clickedStructure) {
          const moveAttackResult = getMoveAndAttackPath(selectedUnit, clickedStructure.pos, state.tiles, state.units, state.castles, structures);
          if (moveAttackResult) {
            const { landingPos, path } = moveAttackResult;
            setPendingAction('pending');
            setActionLoading(true);
            clearIntent();
            if (path.length > 1) { seedSmoothPos(selectedUnitId, path); pendingAttackRef.current = selectedUnitId; }
            else {
              isAnimatingRef.current = true;
              setAttackingUnitId(selectedUnitId);
              setTimeout(() => {
                setAttackingUnitId(null);
                isAnimatingRef.current = false;
                flushPending();
              }, 900);
            }
            const moveResult = await moveUnit(selectedUnitId, landingPos);
            if (moveResult.success) {
              const attackResult = await attackStructure(selectedUnitId, clickedStructure.id);
              setActionLoading(false);
              setPendingAction('confirmed');
              setStatusText(attackResult.success ? 'Move + structure attack executed!' : 'Structure attack failed after move.');
            } else {
              setActionLoading(false); setPendingAction('idle'); setStatusText('Move failed.'); clearAnimation();
            }
            setSelectedUnitId(null); setPhase('idle'); clearIntent();
            return;
          }
        }

        // Move+attack to enemy unit
        if (phase === 'selected' && clickedUnit && clickedUnit.owner !== selectedUnit.owner) {
          const moveAttackResult = getMoveAndAttackPath(selectedUnit, clickedUnit.pos, state.tiles, state.units, state.castles, structures);
          if (moveAttackResult) {
            const { landingPos, path } = moveAttackResult;
            setPendingAction('pending');
            setActionLoading(true);
            clearIntent();
            if (path.length > 1) { seedSmoothPos(selectedUnitId, path); pendingAttackRef.current = selectedUnitId; }
            else {
              isAnimatingRef.current = true;
              setAttackingUnitId(selectedUnitId);
              setTimeout(() => {
                setAttackingUnitId(null);
                isAnimatingRef.current = false;
                flushPending();
              }, 900);
            }
            const moveResult = await moveUnit(selectedUnitId, landingPos);
            if (moveResult.success) {
              const attackResult = await attackUnit(selectedUnitId, clickedUnit.id);
              setActionLoading(false); setPendingAction('confirmed');
              setStatusText(attackResult.success ? 'Move + attack executed!' : 'Attack failed after move.');
            } else {
              setActionLoading(false); setPendingAction('idle'); setStatusText('Move failed.'); clearAnimation();
            }
            setSelectedUnitId(null); setPhase('idle'); clearIntent();
            return;
          }
        }

        // Two-click commit: clicked tile matches previewed nextPosition
        if (nextPosition && !nextPosition.userCommittedToPosition && pos.x === nextPosition.x && pos.y === nextPosition.y) {
          commitIntent();

          if (nextPosition.intendedTarget !== null) {
            const landingPos: Pos = { x: nextPosition.x, y: nextPosition.y };
            const path = findPath(selectedUnit, selectedUnit.pos, landingPos, state.tiles, state.units, state.castles, structures);
            setPendingAction('pending');
            setActionLoading(true);
            if (path.length > 1) { seedSmoothPos(selectedUnitId, path); pendingAttackRef.current = selectedUnitId; }
            else {
              isAnimatingRef.current = true;
              setAttackingUnitId(selectedUnitId);
              setTimeout(() => {
                setAttackingUnitId(null);
                isAnimatingRef.current = false;
                flushPending();
              }, 900);
            }
            const moveResult = await moveUnit(selectedUnitId, landingPos);
            if (moveResult.success) {
              let attackResult: ActionResult | undefined;
              if (typeof nextPosition.intendedTarget === 'number') {
                attackResult = await attackUnit(selectedUnitId, nextPosition.intendedTarget);
              } else if (typeof nextPosition.intendedTarget === 'string') {
                if (nextPosition.intendedTarget.startsWith('castle-')) {
                  attackResult = await attackCastle(selectedUnitId);
                } else {
                  attackResult = await attackStructure(selectedUnitId, nextPosition.intendedTarget);
                }
              }
              setActionLoading(false); setPendingAction('confirmed');
              setStatusText(attackResult?.success ? 'Move + attack executed!' : 'Attack failed after move.');
            } else {
              setActionLoading(false); setPendingAction('idle'); setStatusText('Move failed.'); clearAnimation();
            }
            setSelectedUnitId(null); setPhase('idle'); clearIntent();
            return;
          }

          if (phase === 'selected' && reachableTiles.has(posKey(pos))) {
            const path = findPath(selectedUnit, selectedUnit.pos, pos, state.tiles, state.units, state.castles, structures);
            setPendingAction('pending');
            setActionLoading(true);
            if (path.length > 1) seedSmoothPos(selectedUnitId, path);
            const result = await moveUnit(selectedUnitId, pos);
            setActionLoading(false);
            if (result.success) {
              setPendingAction('confirmed'); setPhase('moved'); clearIntent();
            } else {
              setPendingAction('idle'); setStatusText('Move failed.'); clearIntent(); clearAnimation();
            }
            return;
          }
        }

        // First click on reachable tile — set preview
        if (phase === 'selected' && reachableTiles.has(posKey(pos))) {
          if (!clickedUnit || clickedUnit.id === selectedUnitId) {
            if (!nextPosition || pos.x !== nextPosition.x || pos.y !== nextPosition.y) {
              const path = findPath(selectedUnit, selectedUnit.pos, pos, state.tiles, state.units, state.castles, structures);
              if (path.length > 0) setHoverPreview(pos, path, null);
            }
            return;
          }
        }

        // Re-select a unit you own
        if (clickedUnit && canControl(clickedUnit)) {
          setSelectedUnitId(clickedUnit.id);
          clearIntent();
          if (!clickedUnit.moved) setPhase('selected');
          else if (!clickedUnit.attacked) setPhase('moved');
          else setPhase('idle');
          return;
        }
      }

      deselect();
    },
    [
      state, actionLoading, playerSide, selectedUnitId, phase, reachableTiles, selectedUnit, structures,
      pendingSpawn, spawnAdjacentTiles, intentState.intent, spawnUnit, moveUnit, attackUnit,
      attackCastle, attackStructure, refetch, deselect, commitIntent, setPendingAction, clearIntent,
      setHoverPreview, startWalking, clearAnimation, flushPending,
    ],
  );

  function handleSpawnPanelSelect(kind: any, structureId: string) {
    if (!spawnTarget || actionLoading || !state) return;
    const sp = spawnTarget.structure.pos;
    setSpawnTarget(null);
    const tiles = getAdjacentSpawnTiles(sp, state.units, state.castles, structures, state.tiles);
    if (tiles.size === 0) { setStatusText('No space to spawn'); return; }
    setPendingSpawn({ kind, structureId, structurePos: sp });
    setStatusText('Select a tile to spawn your unit');
  }

  const winner = state ? getWinner(state.status) : null;
  const gameWon = state ? isWon(state.status) : false;

  const myGold = (() => {
    if (!state) return 0;
    const goldMap = parsePlayerGold(state.playerGold);
    return goldMap[playerSide === PlayerTag.blue ? 0 : 1] ?? 0;
  })();

  // Compute how much each side earns next tick based on remaining source lifetime.
  const incomePerTick = (() => {
    if (!state) return undefined;
    const CASTLE_CAP = 500;
    const MINE_CAP = 1_000;
    const TICK_INCOME = 50;
    let blue = 0;
    let red = 0;
    for (const castle of state.castles) {
      if (castle.goldGenerated < CASTLE_CAP) {
        const income = Math.min(TICK_INCOME, CASTLE_CAP - castle.goldGenerated);
        if (castle.owner === 'blue') blue += income;
        else red += income;
      }
    }
    for (const structure of state.structures) {
      if (structure.kind !== 'mine' || structure.owner === undefined) continue;
      if (structure.goldGenerated < MINE_CAP) {
        const income = Math.min(TICK_INCOME, MINE_CAP - structure.goldGenerated);
        if (structure.owner === 0) blue += income;
        else red += income;
      }
    }
    return { blue, red };
  })();

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-body">Loading match…</p>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="text-3xl">⚠️</span>
        <p className="text-foreground font-display font-semibold">Connection Error</p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <button type="button" onClick={() => refetch()} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/80">
          Retry
        </button>
        <button type="button" onClick={onLeave} className="text-sm text-muted-foreground hover:text-foreground underline">
          Back to Lobby
        </button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Waiting for game to start…</p>
        <button type="button" onClick={onLeave} className="text-sm text-muted-foreground hover:text-foreground underline">
          Back to Lobby
        </button>
      </div>
    );
  }

  const waitingForPlayer = state.playerCount < 2;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TurnHeader
        tickCount={state.tickCount}
        lastTickTime={state.lastTickTime}
        phase={phase}
        playerSide={playerSide}
        onNewGame={onLeave}
        isLoading={actionLoading}
        playerGold={state.playerGold}
        incomePerTick={incomePerTick}
        statusText={
          waitingForPlayer
            ? 'Waiting for opponent to join…'
            : statusText || undefined
        }
      />

      {waitingForPlayer ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="w-8 h-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <p className="text-sm">Share the URL so your opponent can join</p>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(window.location.href); setStatusText('URL copied!'); }}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:text-foreground"
          >
            Copy URL
          </button>
        </div>
      ) : (
        <main className="flex-1 flex flex-col md:flex-row items-start justify-center gap-4 p-4 overflow-auto">
          <div className="flex-1 flex items-center justify-center">
            <GameBoard
              state={state}
              selectedUnitId={selectedUnitId}
              reachableTiles={reachableTiles}
              attackableStructureIds={attackableStructureIds}
              structures={structures}
              intent={intentState.intent}
              smoothPos={smoothPos}
              walkingUnitId={walkingUnitId}
              attackingUnitId={attackingUnitId}
              overlayDivRef={overlayDivRef}
              onTileClick={handleTileClick}
              onTileHover={handleTileHover}
            />
          </div>

          <div className="w-full md:w-auto flex flex-col gap-3 items-center md:items-start">
            {selectedUnit && <UnitInfoPanel unit={selectedUnit} onDeselect={deselect} />}
            {spawnTarget && (
              <SpawnPanel
                structure={spawnTarget.structure}
                playerGold={myGold}
                onSpawn={handleSpawnPanelSelect}
                onClose={() => setSpawnTarget(null)}
              />
            )}
          </div>
        </main>
      )}

      <div className="px-4 pb-2 flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[oklch(0.45_0.28_260)]" /> Blue
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[oklch(0.45_0.28_10)]" /> Red
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 range-highlight rounded" /> Reachable
        </span>
        <span>🏰 Castle 🌲 Forest 🌊 Water ⛰️ Mountain</span>
        <span className="text-[10px] opacity-60">Esc to deselect · hover to preview · click twice to commit</span>
      </div>

      <footer className="bg-muted/40 border-t border-border px-6 py-2 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Kingdom Quarrels
      </footer>

      {gameWon && winner && <WinScreen winner={winner} onPlayAgain={onLeave} />}
    </div>
  );
}
