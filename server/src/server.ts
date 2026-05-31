import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createStateStore } from './state.js';
import { setupWebSocket } from './websocket.js';
import { registerRoutes } from './routes.js';

const port = Number(process.env.PORT || 3000);
const stateFile = process.env.STATE_FILE || '/data/state.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

console.log(publicDir);

const app = express();
const server = createServer(app);

const stateStore = createStateStore(stateFile);
const { broadcastJson } = setupWebSocket(server, {
  readState: stateStore.readState
});

registerRoutes(app, {
  publicDir,
  readState: stateStore.readState,
  writeState: stateStore.writeState,
  broadcastJson
});

server.listen(port, async () => {
  await stateStore.ensureStateFileExists();
  console.log(`Wedding app listening on http://0.0.0.0:${port}`);
});