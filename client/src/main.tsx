import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GamePage } from './pages/GamePage';
import { LobbyPage } from './pages/LobbyPage';
import './index.css';

function App() {
  const [gameId, setGameId] = useState<string | null>(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#\/game\/(.+)$/);
    return match ? match[1] : null;
  });

  function navigateToGame(id: string) {
    window.location.hash = `#/game/${id}`;
    setGameId(id);
  }

  function navigateToLobby() {
    window.location.hash = '';
    setGameId(null);
  }

  return gameId
    ? <GamePage gameId={gameId} onLeave={navigateToLobby} />
    : <LobbyPage onEnterGame={navigateToGame} />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
