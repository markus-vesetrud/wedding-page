import { type Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { AppState, WsDeltaUpdate } from '../../shared/types.js';

const supportedProtocol = 'json.webpubsub.azure.v1';

export interface WebSocketHandlers {
  readState: () => Promise<AppState>;
}

export function setupWebSocket(server: HttpServer, handlers: WebSocketHandlers) {
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => {
      if (protocols.has(supportedProtocol)) return supportedProtocol;
      return false;
    }
  });

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost';
    const { pathname } = new URL(request.url || '/', `http://${host}`);

    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws) => {
    const state = await handlers.readState();
    ws.send(JSON.stringify({ type: 'state', data: state }));
  });

  function broadcastJson(message: WsDeltaUpdate): void {
    const payload = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  return {
    broadcastJson
  };
}