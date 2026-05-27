import type { UnitView } from '@/types/game';
import { PlayerTag } from '@/types/game';

interface UnitInfoPanelProps {
  unit: UnitView | null;
  onDeselect: () => void;
}

function getStatus(unit: UnitView): string {
  if (unit.moved && unit.attacked) return 'Done';
  if (unit.attacked) return 'Attacked';
  if (unit.moved) return 'Moved';
  return 'Ready';
}

const STATUS_COLORS: Record<string, string> = {
  Ready: 'text-[oklch(0.70_0.20_140)] bg-[oklch(0.70_0.20_140)]/10',
  Moved: 'text-[oklch(0.75_0.20_40)] bg-[oklch(0.75_0.20_40)]/10',
  Attacked: 'text-[oklch(0.65_0.28_10)] bg-[oklch(0.65_0.28_10)]/10',
  Done: 'text-muted-foreground bg-muted/50',
};

export function UnitInfoPanel({ unit, onDeselect }: UnitInfoPanelProps) {
  if (!unit) return null;

  const isBlue = unit.owner === PlayerTag.blue;
  const status = getStatus(unit);

  return (
    <aside className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 w-48 shadow-md">
      <div className="flex items-center gap-2">
        <span
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            isBlue ? 'bg-[oklch(0.65_0.28_260)]' : 'bg-[oklch(0.65_0.28_10)]'
          }`}
        />
        <span className="font-display font-bold text-foreground text-sm capitalize">
          {unit.kind}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs">
        <span className="text-muted-foreground">HP</span>
        <span className="font-mono font-semibold text-foreground text-right">{unit.hp}</span>
        <span className="text-muted-foreground">Team</span>
        <span
          className={`font-semibold text-right ${
            isBlue ? 'text-[oklch(0.65_0.28_260)]' : 'text-[oklch(0.65_0.28_10)]'
          }`}
        >
          {isBlue ? 'Blue' : 'Red'}
        </span>
        <span className="text-muted-foreground">Move</span>
        <span className="font-mono font-semibold text-foreground text-right">{unit.moveRange}</span>
        <span className="text-muted-foreground">Atk</span>
        <span className="font-mono font-semibold text-foreground text-right">
          {unit.attackRangeMin}–{unit.attackRangeMax}
        </span>
      </div>

      <div
        className={`text-xs font-semibold px-2 py-1 rounded-full text-center ${
          STATUS_COLORS[status] ?? STATUS_COLORS.Done
        }`}
      >
        {status}
      </div>

      <button
        type="button"
        onClick={onDeselect}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 text-center"
      >
        Deselect
      </button>
    </aside>
  );
}
