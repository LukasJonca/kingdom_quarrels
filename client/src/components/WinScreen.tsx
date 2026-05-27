import { PlayerTag } from '@/types/game';

interface WinScreenProps {
  winner: PlayerTag;
  onPlayAgain: () => void;
}

export function WinScreen({ winner, onPlayAgain }: WinScreenProps) {
  const isBlue = winner === PlayerTag.blue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div
        className={`bg-card border-2 rounded-2xl p-10 flex flex-col items-center gap-6 shadow-2xl max-w-sm text-center ${
          isBlue ? 'border-[oklch(0.65_0.28_260)]' : 'border-[oklch(0.65_0.28_10)]'
        }`}
      >
        <div className="text-6xl">
          <svg
            aria-hidden="true"
            width="48"
            height="48"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
            shapeRendering="crispEdges"
            style={{ imageRendering: 'pixelated', display: 'inline-block' }}
          >
            {isBlue ? (
              <>
                <rect x="16" y="4" width="16" height="4" fill="#4040e8" />
                <rect x="8" y="8" width="32" height="4" fill="#4040e8" />
                <rect x="4" y="12" width="40" height="24" fill="#4040e8" />
                <rect x="8" y="36" width="32" height="4" fill="#4040e8" />
                <rect x="16" y="40" width="16" height="4" fill="#4040e8" />
                <rect x="10" y="16" width="8" height="4" fill="#8080ff" />
                <rect x="20" y="20" width="6" height="4" fill="#8080ff" />
              </>
            ) : (
              <>
                <rect x="16" y="4" width="16" height="4" fill="#e84040" />
                <rect x="8" y="8" width="32" height="4" fill="#e84040" />
                <rect x="4" y="12" width="40" height="24" fill="#e84040" />
                <rect x="8" y="36" width="32" height="4" fill="#e84040" />
                <rect x="16" y="40" width="16" height="4" fill="#e84040" />
                <rect x="10" y="16" width="8" height="4" fill="#ff8080" />
                <rect x="20" y="20" width="6" height="4" fill="#ff8080" />
              </>
            )}
          </svg>
        </div>
        <h2
          className={`font-display text-3xl font-bold ${
            isBlue ? 'text-[oklch(0.65_0.28_260)]' : 'text-[oklch(0.65_0.28_10)]'
          }`}
        >
          {isBlue ? 'Blue' : 'Red'} Wins!
        </h2>
        <p className="text-muted-foreground text-sm">
          {isBlue ? 'Blue' : 'Red'} team has conquered the battlefield.
        </p>
        <button
          type="button"
          onClick={onPlayAgain}
          className={`px-8 py-3 rounded-xl font-display font-bold text-lg text-white transition-smooth ${
            isBlue
              ? 'bg-[oklch(0.65_0.28_260)] hover:bg-[oklch(0.55_0.28_260)]'
              : 'bg-[oklch(0.65_0.28_10)] hover:bg-[oklch(0.55_0.28_10)]'
          }`}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
