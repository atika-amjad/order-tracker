'use strict';

const http = require('node:http');
const { Server } = require('socket.io');
const config = require('./src/config');
const createApp = require('./src/app');
const setupSockets = require('./src/realtime/socketHandler');

const app = createApp();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: config.corsOrigin, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});

// Expose io so any route that needs to push to sockets can reach it.
app.set('io', io);

setupSockets(io);

httpServer.listen(config.port, () => {
  console.log(`Order Tracker backend listening on port ${config.port} (${config.isProd ? 'production' : 'development'})`);
  console.log('  REST:      /api/v1/catalog, /api/v1/orders');
  console.log('  GraphQL:   /graphql');
  console.log('  JSON-RPC:  /rpc');
  console.log('  SSE:       /events');
  console.log('  WebSocket: Socket.io (same origin)');
});

module.exports = httpServer;
