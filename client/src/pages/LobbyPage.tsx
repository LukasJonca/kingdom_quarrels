import { createGame, joinGame, listGames } from '@/api/client';
import type { GameListEntry } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

interface LobbyPageProps {
  onEnterGame: (gameId: string) => void;
}

function statusLabel(status: { __kind__: string }): string {
  return status.__kind__ === 'won' ? 'Finished' : 'In Progress';
}

export function LobbyPage({ onEnterGame }: LobbyPageProps) {
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: games = [], isLoading, refetch } = useQuery<GameListEntry[]>({
    queryKey: ['games'],
    queryFn: listGames,
    refetchInterval: 3000,
  });

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const { gameId, playerToken, playerSide } = await createGame();
      localStorage.setItem(`kq-token-${gameId}`, playerToken);
      localStorage.setItem(`kq-side-${gameId}`, playerSide);
      onEnterGame(gameId);
    } catch (e) {
      setError(String(e));
      setCreating(false);
    }
  }

  async function handleJoin(gameId: string) {
    setJoiningId(gameId);
    setError(null);
    try {
      const { playerToken, playerSide } = await joinGame(gameId);
      localStorage.setItem(`kq-token-${gameId}`, playerToken);
      localStorage.setItem(`kq-side-${gameId}`, playerSide);
      onEnterGame(gameId);
    } catch (e) {
      setError(String(e));
      setJoiningId(null);
    }
  }

  function handleSpectate(gameId: string) {
    onEnterGame(gameId);
  }

  const openGames = games.filter((g) => g.playerCount < 2 && g.status.__kind__ === 'active');
  const activeGames = games.filter((g) => g.playerCount >= 2 && g.status.__kind__ === 'active');
  const finishedGames = games.filter((g) => g.status.__kind__ === 'won');

  function GameRow({ g }: { g: GameListEntry }) {
    const isMyGame = !!localStorage.getItem(`kq-token-${g.id}`);
    const isOpen = g.playerCount < 2 && g.status.__kind__ === 'active';
    const isJoining = joiningId === g.id;
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-muted-foreground truncate">{g.id.slice(0, 8)}…</div>
          <div className="text-xs text-foreground mt-0.5">
            Tick {g.tickCount} · {g.playerCount}/2 players · {statusLabel(g.status)}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {isMyGame && (
            <button
              type="button"
              onClick={() => handleSpectate(g.id)}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/80"
            >
              Rejoin
            </button>
          )}
          {!isMyGame && isOpen && (
            <button
              type="button"
              disabled={isJoining}
              onClick={() => handleJoin(g.id)}
              className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 disabled:opacity-50"
            >
              {isJoining ? 'Joining…' : 'Join'}
            </button>
          )}
          {!isMyGame && !isOpen && (
            <button
              type="button"
              onClick={() => handleSpectate(g.id)}
              className="px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:text-foreground"
            >
              Watch
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🏰</div>
        <h1 className="font-display font-bold text-4xl text-foreground">Kingdom Quarrels</h1>
        <p className="text-muted-foreground mt-2 text-sm">2-player real-time strategy</p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold text-lg hover:bg-primary/80 disabled:opacity-50 shadow-md"
        >
          {creating ? 'Creating…' : 'Create New Game'}
        </button>

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-sm text-foreground">Games</h2>
            <button type="button" onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground">
              Refresh
            </button>
          </div>

          {isLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
          )}

          {!isLoading && games.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No games yet. Create one to get started!
            </p>
          )}

          {openGames.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waiting for player</p>
              {openGames.map((g) => <GameRow key={g.id} g={g} />)}
            </>
          )}

          {activeGames.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">Active</p>
              {activeGames.map((g) => <GameRow key={g.id} g={g} />)}
            </>
          )}

          {finishedGames.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">Finished</p>
              {finishedGames.map((g) => <GameRow key={g.id} g={g} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
