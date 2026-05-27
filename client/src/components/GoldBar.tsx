import { parsePlayerGold } from '@/types/game';

interface GoldBarProps {
  playerGold: Array<[number, number]>;
  /** Current income per tick for each side — shown as "+Xg/tick" */
  incomePerTick?: { blue: number; red: number };
}

export function GoldBar({ playerGold, incomePerTick }: GoldBarProps) {
  const gold = parsePlayerGold(playerGold);
  const blueGold = gold[0] ?? 0;
  const redGold  = gold[1] ?? 0;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/60 border border-border">
      <span className="flex items-center gap-1.5 text-sm font-bold font-display text-[oklch(0.65_0.28_260)]">
        🔵 {blueGold.toLocaleString()}g
        {incomePerTick !== undefined && (
          <span className={`text-xs font-normal tabular-nums ${incomePerTick.blue > 0 ? 'text-[oklch(0.60_0.18_140)]' : 'text-muted-foreground'}`}>
            {incomePerTick.blue > 0 ? `+${incomePerTick.blue}/tick` : '—'}
          </span>
        )}
      </span>
      <span className="text-muted-foreground/50 text-xs">|</span>
      <span className="flex items-center gap-1.5 text-sm font-bold font-display text-[oklch(0.65_0.28_10)]">
        🔴 {redGold.toLocaleString()}g
        {incomePerTick !== undefined && (
          <span className={`text-xs font-normal tabular-nums ${incomePerTick.red > 0 ? 'text-[oklch(0.60_0.18_140)]' : 'text-muted-foreground'}`}>
            {incomePerTick.red > 0 ? `+${incomePerTick.red}/tick` : '—'}
          </span>
        )}
      </span>
    </div>
  );
}
