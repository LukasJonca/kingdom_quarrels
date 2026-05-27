import { GoldBar } from '@/components/GoldBar';
import type { PlayerTag } from '@/types/game';
import { useEffect, useState } from 'react';

const TICK_MS = 15_000;

interface TurnHeaderProps {
  tickCount: number;
  lastTickTime: number;
  phase: 'idle' | 'selected' | 'moved';
  playerSide: PlayerTag | null;
  onNewGame?: () => void;
  isLoading: boolean;
  playerGold?: Array<[number, number]>;
  incomePerTick?: { blue: number; red: number };
  statusText?: string;
}

const PHASE_HINT: Record<string, string> = {
  idle: 'Select any of your units',
  selected: 'Move your unit or attack',
  moved: 'Attack or select another unit',
};

function useTickCountdown(lastTickTime: number): number {
  const calc = () => {
    const elapsed = Date.now() - lastTickTime;
    return Math.max(0, Math.ceil((TICK_MS - elapsed) / 1000));
  };
  const [seconds, setSeconds] = useState(calc);

  useEffect(() => {
    setSeconds(calc());
    const id = setInterval(() => setSeconds(calc()), 250);
    return () => clearInterval(id);
  }, [lastTickTime]);

  return seconds;
}

export function TurnHeader({
  tickCount,
  lastTickTime,
  phase,
  playerSide,
  onNewGame,
  isLoading,
  playerGold,
  incomePerTick,
  statusText,
}: TurnHeaderProps) {
  const secondsLeft = useTickCountdown(lastTickTime);
  const urgentTick = secondsLeft <= 4;

  const sideLabel = playerSide === 'blue' ? '🔵 Blue' : playerSide === 'red' ? '🔴 Red' : '👁️ Observer';
  const hintText = playerSide ? PHASE_HINT[phase] : 'Watching…';

  return (
    <header className="bg-card border-b border-border px-4 py-3 flex flex-col gap-2 shadow-md">
      <div className="flex flex-wrap items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-xl">⚔️</span>
          <h1 className="font-display font-bold text-lg text-foreground hidden sm:block">
            Kingdom Quarrels
          </h1>
        </div>

        {/* Tick counter + countdown */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-base px-3 py-1 rounded-full border bg-muted/40 border-border">
              Tick {tickCount}
            </span>
            <span
              className={`font-mono font-bold text-sm px-2 py-1 rounded border tabular-nums transition-colors ${
                urgentTick
                  ? 'bg-red-500/10 border-red-500 text-red-500'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}
              title="Time until unit actions reset"
            >
              ⏱ {secondsLeft}s
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">{hintText}</span>
        </div>

        {/* Player side indicator */}
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full border ${
            playerSide === 'blue'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : playerSide === 'red'
              ? 'bg-secondary/10 border-secondary/30 text-secondary'
              : 'bg-muted/40 border-border text-muted-foreground'
          }`}
        >
          {sideLabel}
        </span>

        {/* Lobby button */}
        {onNewGame && (
          <button
            type="button"
            onClick={onNewGame}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg border border-border text-muted-foreground font-medium text-sm hover:text-foreground hover:border-foreground/30 disabled:opacity-50"
          >
            Lobby
          </button>
        )}
      </div>

      {playerGold && (
        <div className="flex items-center gap-2">
          <GoldBar playerGold={playerGold} incomePerTick={incomePerTick} />
        </div>
      )}

      {statusText && (
        <p className="text-xs text-muted-foreground">{statusText}</p>
      )}
    </header>
  );
}
