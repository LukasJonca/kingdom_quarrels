import type { StructureView, UnitKind } from '@/types/game';
import { StructureKind, UnitKind as UK } from '@/types/game';

interface SpawnEntry {
  kind: UnitKind;
  label: string;
  cost: number;
  icon: string;
  desc: string;
}

const SPAWN_UNITS: SpawnEntry[] = [
  { kind: UK.swordsman, label: 'Swordsman', cost: 100, icon: '⚔️', desc: 'Basic infantry' },
  { kind: UK.pikeman,   label: 'Pikeman',   cost: 150, icon: '🗡️', desc: 'Anti-cavalry' },
  { kind: UK.pillager,  label: 'Saboteur',  cost: 200, icon: '🔪', desc: 'Fast scout vs structures' },
  { kind: UK.archer,    label: 'Archer',    cost: 250, icon: '🏹', desc: 'Ranged infantry' },
  { kind: UK.knight,    label: 'Knight',    cost: 400, icon: '🐴', desc: 'Fast cavalry' },
  { kind: UK.brute,     label: 'Brute',     cost: 550, icon: '🪓', desc: 'Heavy infantry' },
  { kind: UK.catapult,  label: 'Catapult',  cost: 700, icon: '🪃', desc: 'Siege engine' },
];

interface SpawnPanelProps {
  structure: StructureView;
  playerGold: number;
  onSpawn: (kind: UnitKind, structureId: string) => void;
  onClose: () => void;
}

export function SpawnPanel({ structure, playerGold, onSpawn, onClose }: SpawnPanelProps) {
  const structureLabel = structure.kind === StructureKind.castle ? 'Castle' : 'Settlement';

  return (
    <div className="bg-card border border-border rounded-xl shadow-2xl p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-foreground text-sm">
          Spawn from {structureLabel}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none transition-colors"
          aria-label="Close spawn panel"
        >
          ×
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Gold available:{' '}
        <span className="font-bold text-foreground">{playerGold.toLocaleString()}g</span>
      </p>
      <ul className="flex flex-col gap-1.5">
        {SPAWN_UNITS.map((entry) => {
          const canAfford = playerGold >= entry.cost;
          return (
            <li key={entry.kind}>
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => onSpawn(entry.kind, structure.id)}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                  canAfford
                    ? 'bg-muted hover:bg-muted/80 text-foreground cursor-pointer'
                    : 'bg-muted/30 text-muted-foreground cursor-not-allowed opacity-60',
                ].join(' ')}
              >
                <span className="text-base w-5 text-center">{entry.icon}</span>
                <span className="flex-1">
                  <span className="font-semibold">{entry.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">— {entry.desc}</span>
                </span>
                <span className="font-bold text-xs shrink-0">{entry.cost}g</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
