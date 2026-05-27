import CastleToken from '@/components/CastleToken';
import { StructureToken } from '@/components/StructureToken';
import TileCell from '@/components/TileCell';
import { UnitToken } from '@/components/UnitToken';
import type { IntentState } from '@/hooks/useIntentState';
import { getCastleAt, getStructureAt, getTileAt, getUnitAt, posKey } from '@/lib/gameUtils';
import type { MatchStateView, Pos, StructureView, UnitView } from '@/types/game';
import { type MutableRefObject, type RefObject, forwardRef, useCallback, useRef } from 'react';

const BOARD_SIZE = 13;

interface GameBoardProps {
  state: MatchStateView;
  selectedUnitId: number | null;
  reachableTiles: Set<string>;
  attackableStructureIds: Set<string>;
  structures: StructureView[];
  intent: IntentState;
  smoothPos: { unitId: number; smoothX: number; smoothY: number } | null;
  overlayDivRef: RefObject<HTMLDivElement | null>;
  walkingUnitId?: number | null;
  attackingUnitId?: number | null;
  onTileClick: (pos: Pos) => void;
  onTileHover: (pos: Pos | null) => void;
}

function AttackArrow({ from, to }: { from: Pos; to: Pos }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-hidden="true">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated', transform: `rotate(${angle}deg)`, opacity: 0.85 }}>
        <rect x="0" y="6" width="10" height="4" fill="#ff4040" />
        <rect x="10" y="3" width="2" height="10" fill="#ff4040" />
        <rect x="12" y="5" width="2" height="6" fill="#ff4040" />
        <rect x="14" y="7" width="2" height="2" fill="#ff4040" />
      </svg>
    </div>
  );
}

function DirectAttackReticle() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" aria-hidden="true">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="2" width="3" height="3" fill="#ff2222" />
        <rect x="5" y="5" width="3" height="3" fill="#ff2222" />
        <rect x="8" y="8" width="3" height="3" fill="#ff5555" />
        <rect x="11" y="11" width="3" height="3" fill="#ff2222" />
        <rect x="14" y="14" width="3" height="3" fill="#ff2222" />
        <rect x="17" y="17" width="3" height="3" fill="#ff2222" />
        <rect x="17" y="2" width="3" height="3" fill="#ff2222" />
        <rect x="14" y="5" width="3" height="3" fill="#ff2222" />
        <rect x="11" y="8" width="3" height="3" fill="#ff5555" />
        <rect x="8" y="11" width="3" height="3" fill="#ff2222" />
        <rect x="5" y="14" width="3" height="3" fill="#ff2222" />
        <rect x="2" y="17" width="3" height="3" fill="#ff2222" />
        <rect x="9" y="9" width="4" height="4" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
}

function GhostUnit({ unit, isPending }: { unit: UnitView; isPending: boolean }) {
  const isBlue = unit.owner === 'blue';
  const factionColor = isBlue ? '#4040e8' : '#e84040';
  return (
    <div
      className={['absolute inset-0 m-auto pointer-events-none z-10', isPending ? 'ghost-unit-pending' : 'ghost-unit'].join(' ')}
      style={{ width: '75%', height: '75%', opacity: 0.6 }}
      aria-hidden="true"
    >
      <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="0" y="0" width="32" height="2" fill={factionColor} />
        <rect x="0" y="30" width="32" height="2" fill={factionColor} />
        <rect x="0" y="0" width="2" height="32" fill={factionColor} />
        <rect x="30" y="0" width="2" height="32" fill={factionColor} />
        <rect x="14" y="14" width="4" height="4" fill={factionColor} />
      </svg>
    </div>
  );
}

const SmoothUnitOverlay = forwardRef<HTMLDivElement, {
  unit: UnitView; initX: number; initY: number; boardSize: number;
  isWalking: boolean; isAttacking: boolean; isSelected: boolean; onTileClick: (pos: Pos) => void;
}>(function SmoothUnitOverlay({ unit, initX, initY, boardSize, isWalking, isAttacking, isSelected, onTileClick }, forwardedRef) {
  const tilePct = 100 / boardSize;
  const localRef = useRef<HTMLDivElement | null>(null);

  // Stable callback ref — called only on mount/unmount, never on re-renders.
  // Sets the initial position imperatively so React's style prop can never reset it.
  // All subsequent position updates are handled by the RAF via overlayDivRef.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally empty — initX/initY are stable for the animation lifetime
  const setRef = useCallback((node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
    }
    if (node) {
      node.style.left = `${initX * tilePct}%`;
      node.style.top  = `${initY * tilePct}%`;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={setRef}
      className="absolute pointer-events-none"
      style={{ width: `${tilePct}%`, height: `${tilePct}%`, willChange: 'left, top', zIndex: 30, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <div style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}>
        <UnitToken unit={unit} isSelected={isSelected} isWalking={isWalking} isAttacking={isAttacking} onClick={() => onTileClick(unit.pos)} />
      </div>
    </div>
  );
});

export function GameBoard({
  state, selectedUnitId, reachableTiles, attackableStructureIds, structures,
  intent, smoothPos, overlayDivRef, walkingUnitId = null, attackingUnitId = null,
  onTileClick, onTileHover,
}: GameBoardProps) {
  const selectedUnit = selectedUnitId !== null ? (state.units.find((u) => u.id === selectedUnitId) ?? null) : null;
  const selectedPosKey = selectedUnit ? posKey(selectedUnit.pos) : null;
  const { nextPosition, pathTiles, pendingAction } = intent;
  const isAttackIntent = nextPosition?.intendedTarget !== null && nextPosition?.intendedTarget !== undefined;
  const ghostKey = nextPosition ? posKey({ x: nextPosition.x, y: nextPosition.y }) : null;
  const isPending = pendingAction === 'pending';

  return (
    <div
      className="relative w-full max-w-[min(92vw,92vh)] aspect-square rounded-full overflow-hidden border-2 border-border shadow-2xl"
      aria-label="Game board"
      onMouseLeave={() => onTileHover(null)}
    >
      <div className="grid w-full h-full" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
        {Array.from({ length: BOARD_SIZE }, (_, row) =>
          Array.from({ length: BOARD_SIZE }, (_, col) => {
            const distFromCenter = Math.sqrt((col - 6) ** 2 + (row - 6) ** 2);
            const isVoidTile = distFromCenter > 5.5;
            const pos: Pos = { x: col, y: row };
            const key = posKey(pos);
            const tile = getTileAt(state.tiles, pos);
            const castle = getCastleAt(state.castles, pos);
            const structure = getStructureAt(structures, pos);

            if (!tile) return null;
            if (isVoidTile) return <div key={key} className="tile-void" aria-hidden="true" />;

            let unit = getUnitAt(state.units, pos);
            const animUnitId = walkingUnitId ?? smoothPos?.unitId ?? null;
            if (animUnitId !== null && unit && unit.id === animUnitId) unit = undefined;

            const isReachable = reachableTiles.has(key);
            const isSelected = selectedPosKey === key;
            const isAttackableStructure = attackableStructureIds.has(key);
            const isPathTile = pathTiles.has(key);
            const isGhostTile = ghostKey === key;

            const intentClass = isGhostTile
              ? isAttackIntent ? 'ghost-tile-attack' : 'ghost-tile'
              : isPathTile
                ? isAttackIntent ? 'path-tile-attack' : 'path-tile'
                : undefined;

            const cursorClass = isGhostTile || isPathTile ? 'cursor-crosshair' : undefined;

            return (
              <TileCell
                key={key}
                tile={tile}
                isSelected={isSelected}
                isReachable={isReachable && !isPathTile && !isGhostTile}
                isAttackTarget={isAttackableStructure}
                extraClass={[intentClass, cursorClass].filter(Boolean).join(' ')}
                onClick={onTileClick}
                onHover={onTileHover}
              >
                {structure && <StructureToken structure={structure} />}
                {castle && <CastleToken castle={castle} />}
                {unit && (
                  <UnitToken
                    unit={unit}
                    isSelected={unit.id === selectedUnitId}
                    isWalking={walkingUnitId !== null && unit.id === walkingUnitId}
                    isAttacking={attackingUnitId !== null && unit.id === attackingUnitId}
                    onClick={() => onTileClick(pos)}
                  />
                )}
                {isGhostTile && !unit && selectedUnit && (
                  <GhostUnit unit={selectedUnit} isPending={isPending} />
                )}
                {isGhostTile && nextPosition?.intendedTarget !== null && nextPosition?.intendedTarget !== undefined && (() => {
                  let targetPos: Pos | null = null;
                  const unitTarget = state.units.find(
                    (u) => typeof nextPosition.intendedTarget === 'number' && u.id === nextPosition.intendedTarget,
                  );
                  if (unitTarget) {
                    targetPos = unitTarget.pos;
                  } else {
                    const structureTarget = structures.find(
                      (s) => typeof nextPosition.intendedTarget === 'string' && s.id === nextPosition.intendedTarget,
                    );
                    if (structureTarget) {
                      targetPos = structureTarget.pos;
                    } else {
                      const castleTarget = state.castles.find((c) => {
                        const castleId = c.owner === 'blue' ? 'castle-0' : 'castle-1';
                        return typeof nextPosition.intendedTarget === 'string' && castleId === nextPosition.intendedTarget;
                      });
                      if (castleTarget) targetPos = castleTarget.pos;
                    }
                  }
                  if (!targetPos) return null;
                  const fromPos = { x: nextPosition.x, y: nextPosition.y };
                  if (fromPos.x === targetPos.x && fromPos.y === targetPos.y) return <DirectAttackReticle />;
                  return <AttackArrow from={fromPos} to={targetPos} />;
                })()}
              </TileCell>
            );
          }),
        )}
      </div>
      {smoothPos && (() => {
        const smoothUnit = state.units.find((u) => u.id === smoothPos.unitId);
        if (!smoothUnit) return null;
        return (
          <SmoothUnitOverlay
            ref={overlayDivRef}
            unit={smoothUnit}
            initX={smoothPos.smoothX}
            initY={smoothPos.smoothY}
            boardSize={BOARD_SIZE}
            isWalking={walkingUnitId !== null && smoothUnit.id === walkingUnitId}
            isAttacking={attackingUnitId !== null && smoothUnit.id === attackingUnitId}
            isSelected={smoothUnit.id === selectedUnitId}
            onTileClick={onTileClick}
          />
        );
      })()}
    </div>
  );
}
