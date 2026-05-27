import type { StructureView } from '@/types/game';
import { StructureKind } from '@/types/game';
import { useEffect, useRef } from 'react';

interface StructureTokenProps {
  structure: StructureView;
}

function ownerColor(owner: number | undefined): string {
  if (owner === undefined) return '#888877';
  return owner === 0 ? '#4040e8' : '#e84040';
}

function MineSprite({ flagColor }: { flagColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 44, 44);

    const fill = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };

    const HILL = '#7a5a3a';
    const HILL_HI = '#a08060';
    const HILL_SH = '#504030';
    const CAVE = '#2a2a3a';
    const BEAM = '#8b5a2a';
    const BEAM_HI = '#a87040';
    const BEAM_SH = '#5a3a18';
    const LANTERN = '#d4a020';
    const ROCK_G = '#909090';
    const ROCK_M = '#707070';

    fill(2, 28, 40, 12, HILL);
    fill(4, 24, 36, 6, HILL);
    fill(8, 20, 28, 6, HILL);
    fill(14, 17, 16, 5, HILL);
    fill(14, 17, 16, 1, HILL_HI);
    fill(8, 20, 28, 1, HILL_HI);
    fill(4, 24, 36, 1, HILL_HI);
    fill(2, 28, 40, 1, HILL_HI);
    fill(2, 28, 2, 12, HILL_SH);
    fill(40, 28, 2, 12, HILL_SH);
    fill(6, 30, 4, 3, HILL_HI);
    fill(32, 29, 5, 3, HILL_SH);
    fill(6, 25, 3, 2, HILL_SH);
    fill(34, 25, 3, 2, HILL_HI);

    fill(15, 18, 14, 16, CAVE);
    fill(17, 22, 10, 10, '#100a04');

    fill(13, 16, 4, 20, BEAM);
    fill(13, 16, 1, 20, BEAM_HI);
    fill(16, 16, 1, 20, BEAM_SH);
    fill(14, 22, 2, 2, BEAM_SH);

    fill(27, 16, 4, 20, BEAM);
    fill(27, 16, 1, 20, BEAM_HI);
    fill(30, 16, 1, 20, BEAM_SH);
    fill(28, 22, 2, 2, BEAM_SH);

    fill(2, 14, 40, 4, BEAM);
    fill(2, 14, 40, 1, BEAM_HI);
    fill(2, 17, 40, 1, BEAM_SH);
    fill(10, 14, 2, 4, BEAM_SH);
    fill(20, 14, 2, 4, BEAM_SH);
    fill(32, 14, 2, 4, BEAM_SH);

    fill(21, 15, 2, 2, '#6a5020');
    fill(19, 17, 6, 2, '#b08000');
    fill(20, 18, 4, 6, LANTERN);
    fill(21, 19, 2, 2, '#fff8a0');
    fill(20, 23, 4, 1, '#b08000');

    fill(3, 35, 6, 4, ROCK_G);
    fill(2, 37, 8, 2, ROCK_G);
    fill(4, 33, 4, 3, ROCK_M);
    fill(5, 32, 2, 2, ROCK_G);
    fill(35, 35, 6, 4, ROCK_G);
    fill(34, 37, 8, 2, ROCK_G);
    fill(36, 33, 4, 3, ROCK_M);
    fill(37, 32, 2, 2, ROCK_G);

    fill(30, 8, 1, 6, '#7a5a30');
    fill(31, 8, 4, 2, flagColor);
    fill(31, 10, 4, 2, flagColor);
    fill(31, 12, 3, 1, flagColor);
    fill(31, 13, 2, 1, flagColor);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(31, 8, 3, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(4, 43, 36, 1);
  }, [flagColor]);

  return (
    <canvas
      ref={canvasRef}
      width={44}
      height={44}
      style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }}
    />
  );
}

function SettlementSprite({ flagColor }: { flagColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 44, 44);

    const fill = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };

    const FOUND = '#808070';
    const FOUND_HI = '#9a9888';
    const FOUND_SH = '#606058';
    const WALL = '#c0a870';
    const WALL_HI = '#d4be90';
    const WALL_SH = '#9a8050';
    const MORTAR = '#806850';
    const ROOF_D = '#6b4020';
    const ROOF_M = '#8b5a2a';
    const ROOF_L = '#a87040';
    const DOOR = '#402010';
    const DOOR_FR = '#6b4a2a';
    const WIN_GLOW = '#ffe090';
    const WIN_FR = '#806040';
    const CHIMNEY = '#808080';
    const CHIM_HI = '#a0a0a0';

    fill(4, 36, 36, 6, FOUND);
    fill(4, 36, 36, 1, FOUND_HI);
    fill(4, 40, 36, 2, FOUND_SH);
    fill(4, 38, 36, 1, MORTAR);
    fill(12, 36, 1, 6, MORTAR);
    fill(22, 36, 1, 6, MORTAR);
    fill(32, 36, 1, 6, MORTAR);

    fill(8, 18, 28, 18, WALL);
    fill(8, 18, 2, 18, WALL_HI);
    fill(34, 18, 2, 18, WALL_SH);
    fill(8, 18, 28, 1, WALL_HI);
    for (const y of [22, 26, 30, 34]) fill(8, y, 28, 1, MORTAR);
    fill(14, 18, 1, 4, MORTAR);
    fill(22, 18, 1, 4, MORTAR);
    fill(30, 18, 1, 4, MORTAR);
    fill(11, 22, 1, 4, MORTAR);
    fill(19, 22, 1, 4, MORTAR);
    fill(28, 22, 1, 4, MORTAR);

    fill(5, 14, 34, 4, ROOF_D);
    fill(5, 14, 34, 1, '#7a5030');
    fill(8, 10, 28, 5, ROOF_M);
    fill(8, 10, 28, 1, '#9a6840');
    fill(12, 6, 20, 5, ROOF_L);
    fill(12, 6, 20, 1, '#c09060');
    fill(16, 5, 12, 2, ROOF_D);
    fill(5, 17, 34, 1, '#3a2010');
    fill(8, 14, 28, 1, '#3a2010');

    fill(28, 2, 4, 10, CHIMNEY);
    fill(28, 2, 1, 10, CHIM_HI);
    fill(31, 2, 1, 10, '#606060');
    fill(27, 1, 6, 2, '#606060');
    ctx.fillStyle = 'rgba(208,208,208,0.7)';
    ctx.fillRect(28, 0, 4, 1);

    fill(19, 28, 6, 8, DOOR);
    fill(18, 27, 8, 1, DOOR_FR);
    fill(18, 27, 1, 9, DOOR_FR);
    fill(25, 27, 1, 9, WALL_SH);
    for (const y of [29, 31, 33]) fill(19, y, 6, 1, '#5a3018');
    fill(24, 31, 1, 2, '#d4a030');

    fill(9, 21, 8, 6, WIN_FR);
    fill(10, 22, 6, 4, WIN_GLOW);
    fill(12, 22, 1, 4, WIN_FR);
    fill(10, 24, 6, 1, WIN_FR);
    fill(10, 22, 5, 1, '#fff4c0');

    fill(32, 0, 1, 6, '#7a6040');
    fill(33, 0, 4, 2, flagColor);
    fill(33, 2, 4, 2, flagColor);
    fill(33, 4, 3, 1, flagColor);
    fill(33, 5, 2, 1, flagColor);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(33, 0, 3, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(4, 43, 36, 1);
  }, [flagColor]);

  return (
    <canvas
      ref={canvasRef}
      width={44}
      height={44}
      style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }}
    />
  );
}

function BarricadeSprite() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 44, 44);

    const fill = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };

    const GROUND = '#4a3820';
    const STAKE = '#8b5a2a';
    const STAKE_HI = '#b07840';
    const STAKE_SH = '#6a3a1a';
    const ROPE = '#c8a040';
    const ROPE_HI = '#e0c060';

    fill(0, 38, 44, 4, GROUND);
    fill(0, 38, 44, 1, '#5a4828');
    ctx.fillStyle = 'rgba(36,24,8,0.5)';
    ctx.fillRect(4, 41, 36, 1);

    fill(7, 12, 8, 26, STAKE);
    fill(7, 14, 2, 22, STAKE_HI);
    fill(14, 12, 1, 26, STAKE_SH);
    fill(8, 10, 6, 2, STAKE);
    fill(9, 8, 4, 2, STAKE);
    fill(10, 7, 2, 1, STAKE_SH);

    fill(18, 8, 8, 30, STAKE);
    fill(18, 10, 2, 26, STAKE_HI);
    fill(25, 8, 1, 30, STAKE_SH);
    fill(19, 6, 6, 2, STAKE);
    fill(20, 4, 4, 2, STAKE);
    fill(21, 3, 2, 1, STAKE_SH);

    fill(29, 12, 8, 26, STAKE);
    fill(29, 14, 2, 22, STAKE_HI);
    fill(36, 12, 1, 26, STAKE_SH);
    fill(30, 10, 6, 2, STAKE);
    fill(31, 8, 4, 2, STAKE);
    fill(32, 7, 2, 1, STAKE_SH);

    fill(6, 22, 32, 2, ROPE);
    fill(6, 22, 32, 1, ROPE_HI);
    fill(7, 21, 8, 1, ROPE);
    fill(18, 21, 8, 1, ROPE);
    fill(29, 21, 8, 1, ROPE);
    ctx.fillStyle = 'rgba(112,80,32,0.6)';
    ctx.fillRect(6, 24, 32, 1);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={44}
      height={44}
      style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }}
    />
  );
}

const MINE_INCOME_CAP = 1_000;

export function StructureToken({ structure }: StructureTokenProps) {
  const fc = ownerColor(structure.owner);
  const hp = structure.hp;
  const maxHp = structure.maxHp;
  const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const hpBarColor = hpRatio > 0.6 ? '#22c55e' : hpRatio > 0.3 ? '#eab308' : '#ef4444';

  const isMine = structure.kind === StructureKind.mine;
  const goldRemaining = isMine ? Math.max(0, MINE_INCOME_CAP - structure.goldGenerated) : 0;
  const goldRatio = isMine ? goldRemaining / MINE_INCOME_CAP : 0;
  const isDepleted = isMine && goldRemaining === 0;

  const structureLabel =
    isMine
      ? `Mine (${goldRemaining}g left)`
      : structure.kind === StructureKind.settlement
        ? 'Settlement'
        : 'Barricade';

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none"
      aria-label={`${structureLabel} HP ${hp}`}
    >
      <div
        className="flex items-end justify-center w-full"
        style={{ height: '44px', opacity: isDepleted ? 0.55 : 1, transition: 'opacity 0.3s' }}
      >
        {isMine && <MineSprite flagColor={isDepleted ? '#666' : fc} />}
        {structure.kind === StructureKind.settlement && <SettlementSprite flagColor={fc} />}
        {structure.kind === StructureKind.barricade && <BarricadeSprite />}
      </div>

      {/* HP bar */}
      <div
        className="w-[36px] h-[4px] rounded-sm overflow-hidden mt-[1px]"
        style={{ background: 'rgba(0,0,0,0.45)' }}
      >
        <div
          style={{
            width: `${Math.round(hpRatio * 100)}%`,
            height: '100%',
            background: hpBarColor,
            transition: 'width 0.15s',
          }}
        />
      </div>

      {/* Gold-remaining bar — mines only */}
      {isMine && (
        <div
          className="w-[36px] h-[3px] rounded-sm overflow-hidden mt-[1px]"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          title={isDepleted ? 'Mine depleted' : `${goldRemaining}g income remaining`}
        >
          <div
            style={{
              width: `${Math.round(goldRatio * 100)}%`,
              height: '100%',
              background: isDepleted ? '#555' : '#d4a020',
              transition: 'width 0.3s',
            }}
          />
        </div>
      )}
    </div>
  );
}
