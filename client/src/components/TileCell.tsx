import { posKey } from '@/lib/gameUtils';
import type { Pos, Tile } from '@/types/game';
import { TerrainKind } from '@/types/game';
import { useEffect, useRef } from 'react';

function usePixelCanvas(draw: (ctx: CanvasRenderingContext2D) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRef.current(ctx);
  }, []);
  return ref;
}

function GrassSprite() {
  return (
    <img
      src="/assets/grass.png"
      alt=""
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated', display: 'block', objectFit: 'cover' }}
    />
  );
}

function ForestSprite() {
  return (
    <img
      src="/assets/forrest.png"
      alt=""
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated', display: 'block', objectFit: 'cover' }}
    />
  );
}

function MountainSprite() {
  return (
    <img
      src="/assets/rocky.png"
      alt=""
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated', display: 'block', objectFit: 'cover' }}
    />
  );
}

function WaterSprite() {
  const ref = usePixelCanvas((ctx) => {
    ctx.fillStyle = '#3a7bd5';
    ctx.fillRect(0, 0, 16, 16);
  });
  return (
    <canvas
      ref={ref}
      width={16}
      height={16}
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  );
}

interface TileCellProps {
  tile: Tile;
  isSelected: boolean;
  isReachable: boolean;
  isAttackTarget?: boolean;
  extraClass?: string;
  onClick: (pos: Pos) => void;
  onHover?: (pos: Pos) => void;
  children?: React.ReactNode;
}

export default function TileCell({
  tile,
  isSelected,
  isReachable,
  isAttackTarget = false,
  extraClass,
  onClick,
  onHover,
  children,
}: TileCellProps) {
  const key = posKey(tile.pos);

  const extraClasses = [
    isReachable ? 'range-highlight' : '',
    isSelected ? 'tile-selected' : '',
    isAttackTarget ? 'attack-target-highlight' : '',
    extraClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      aria-label={`Tile ${key} (${tile.terrain})`}
      onClick={() => onClick(tile.pos)}
      onMouseEnter={() => onHover?.(tile.pos)}
      className={[
        'grid-cell relative flex items-center justify-center',
        'w-full aspect-square overflow-hidden',
        'transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'cursor-pointer hover:brightness-110 active:brightness-90',
        'pixel-tile',
        extraClasses,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tile.terrain === TerrainKind.grass && <GrassSprite />}
      {tile.terrain === TerrainKind.forest && <ForestSprite />}
      {tile.terrain === TerrainKind.mountain && <MountainSprite />}
      {tile.terrain === TerrainKind.water && <WaterSprite />}
      {children}
    </button>
  );
}
