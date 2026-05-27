import type { CastleView } from '@/types/game';
import { PlayerTag } from '@/types/game';
import { useEffect, useRef } from 'react';

interface CastleTokenProps {
  castle: CastleView;
}

function CastlePixelArt({ ownerColor }: { ownerColor: string }) {
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

    const STONE = '#8a8a9a';
    const STONE_HI = '#b0b0c0';
    const STONE_SH = '#5a5a6a';
    const SIDE = '#7a7a8a';
    const BATT = '#4a4a58';
    const BATT_TOP = '#30303e';
    const SKY_NOTCH = '#1a1a28';
    const GATE_DARK = '#2a2a3a';
    const ARROW_SLIT = '#2a2a3a';
    const MORTAR = '#6a6a7a';
    const POLE = '#5a4a30';

    fill(2, 34, 40, 10, STONE);
    fill(2, 34, 40, 2, STONE_HI);
    fill(2, 40, 40, 4, STONE_SH);
    fill(2, 37, 40, 1, MORTAR);
    fill(11, 34, 1, 10, MORTAR);
    fill(22, 34, 1, 10, MORTAR);
    fill(33, 34, 1, 10, MORTAR);

    fill(2, 18, 8, 16, SIDE);
    fill(2, 18, 1, 16, STONE_HI);
    fill(9, 18, 1, 16, STONE_SH);
    fill(2, 22, 8, 1, MORTAR);
    fill(2, 26, 8, 1, MORTAR);
    fill(2, 30, 8, 1, MORTAR);
    fill(5, 21, 2, 4, ARROW_SLIT);
    fill(2, 14, 2, 4, BATT);
    fill(2, 13, 2, 1, BATT_TOP);
    fill(6, 14, 2, 4, BATT);
    fill(6, 13, 2, 1, BATT_TOP);
    fill(4, 14, 2, 4, SKY_NOTCH);

    fill(34, 18, 8, 16, SIDE);
    fill(34, 18, 1, 16, STONE_HI);
    fill(41, 18, 1, 16, STONE_SH);
    fill(34, 22, 8, 1, MORTAR);
    fill(34, 26, 8, 1, MORTAR);
    fill(34, 30, 8, 1, MORTAR);
    fill(37, 21, 2, 4, ARROW_SLIT);
    fill(34, 14, 2, 4, BATT);
    fill(34, 13, 2, 1, BATT_TOP);
    fill(38, 14, 2, 4, BATT);
    fill(38, 13, 2, 1, BATT_TOP);
    fill(36, 14, 2, 4, SKY_NOTCH);

    fill(12, 12, 20, 22, STONE);
    fill(12, 12, 2, 22, STONE_HI);
    fill(30, 12, 2, 22, STONE_SH);
    for (const y of [16, 20, 24, 28, 32]) fill(12, y, 20, 1, MORTAR);
    fill(17, 12, 1, 4, MORTAR);
    fill(24, 12, 1, 4, MORTAR);
    fill(14, 16, 1, 4, MORTAR);
    fill(21, 16, 1, 4, MORTAR);
    fill(28, 16, 1, 4, MORTAR);
    fill(16, 20, 1, 4, MORTAR);
    fill(23, 20, 1, 4, MORTAR);
    fill(15, 24, 1, 4, MORTAR);
    fill(22, 24, 1, 4, MORTAR);
    fill(29, 24, 1, 4, MORTAR);
    fill(15, 17, 2, 4, ARROW_SLIT);
    fill(27, 17, 2, 4, ARROW_SLIT);

    fill(18, 24, 8, 10, GATE_DARK);
    fill(19, 22, 6, 3, GATE_DARK);
    fill(20, 21, 4, 2, GATE_DARK);
    fill(16, 21, 2, 13, STONE_HI);
    fill(26, 21, 2, 13, STONE_SH);
    ctx.fillStyle = '#604828';
    for (const x of [19, 21, 23, 25]) ctx.fillRect(x, 24, 1, 10);
    ctx.fillRect(19, 28, 7, 1);

    fill(12, 8, 4, 4, BATT);
    fill(12, 7, 4, 1, BATT_TOP);
    fill(20, 8, 4, 4, BATT);
    fill(20, 7, 4, 1, BATT_TOP);
    fill(28, 8, 4, 4, BATT);
    fill(28, 7, 4, 1, BATT_TOP);
    fill(16, 8, 4, 4, SKY_NOTCH);
    fill(24, 8, 4, 4, SKY_NOTCH);

    fill(21, 1, 1, 7, POLE);
    fill(22, 1, 6, 2, ownerColor);
    fill(22, 3, 6, 2, ownerColor);
    fill(22, 5, 5, 1, ownerColor);
    fill(22, 6, 3, 1, ownerColor);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(22, 1, 4, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(4, 43, 36, 1);
  }, [ownerColor]);

  return (
    <canvas
      ref={canvasRef}
      width={44}
      height={44}
      style={{ imageRendering: 'pixelated', display: 'block', width: '100%', height: '100%' }}
    />
  );
}

export default function CastleToken({ castle }: CastleTokenProps) {
  const isBlue = castle.owner === PlayerTag.blue;
  const ownerColor = isBlue ? '#4040e8' : '#e84040';
  const hpRatio = Math.max(0, Math.min(1, castle.hp / castle.maxHp));
  const hpBarColor = hpRatio > 0.6 ? '#22c55e' : hpRatio > 0.3 ? '#eab308' : '#ef4444';

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none"
      aria-label={`${isBlue ? 'Blue' : 'Red'} castle, HP ${castle.hp}`}
    >
      <div className="flex items-end justify-center w-full" style={{ height: '44px' }}>
        <CastlePixelArt ownerColor={ownerColor} />
      </div>
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
    </div>
  );
}
