import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/protocol.ts';
import { IS_DEFAULT_ADMIN_PASSWORD } from './auth.ts';
import { SessionManager } from './game/manager.ts';
import { createRouter } from './routes.ts';
import { attachSockets, type SocketData } from './sockets.ts';

const PORT = Number(process.env.PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_DIST = path.resolve(SERVER_DIR, '../client/dist');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

if (!IS_PROD) {
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

const manager = new SessionManager();
app.use('/api', createRouter(manager));

if (IS_PROD) {
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    console.warn(`[server] client build not found at ${CLIENT_DIST}; run "npm run build" first`);
  }
  app.use(express.static(CLIENT_DIST, { index: 'index.html', maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>(httpServer, {
  cors: IS_PROD ? undefined : { origin: true, credentials: true },
  pingInterval: 10000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e5,
});

attachSockets(io, manager);

httpServer.listen(PORT, () => {
  const pwHint = IS_DEFAULT_ADMIN_PASSWORD
    ? 'admin password: default (set ADMIN_PASSWORD to change)'
    : 'admin password: from ADMIN_PASSWORD env';
  console.log(`[server] CBC Quiz listening on http://localhost:${PORT} (${IS_PROD ? 'production' : 'dev'}) — ${pwHint}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[server] ${signal} received, shutting down`);
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
