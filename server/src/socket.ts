import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let _io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  _io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  _io.on('connection', (socket) => {
    socket.on('join_game', (gameId: string) => {
      socket.join(gameId);
    });
    socket.on('leave_game', (gameId: string) => {
      socket.leave(gameId);
    });
  });

  return _io;
}

// Broadcast updated game state to every client in a game room.
// Called by routes.ts after every successful mutation.
export function broadcastState(gameId: string, state: object): void {
  _io?.to(gameId).emit('state_update', state);
}
