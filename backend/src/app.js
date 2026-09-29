'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');
const catalogRoutes = require('./routes/catalog');
const ordersRoutes = require('./routes/orders');
const graphqlRoute = require('./routes/graphql');
const rpcRoute = require('./routes/rpc');
const sseRoute = require('./sse/events');

function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  // Lightweight request log (useful in Render logs).
  app.use((req, _res, next) => {
    if (!req.url.startsWith('/events')) {
      console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    }
    next();
  });

  // Health check for Render.
  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // REST resource management.
  app.use('/api/v1/catalog', catalogRoutes);
  app.use('/api/v1/orders', ordersRoutes);

  // GraphQL.
  app.use('/graphql', graphqlRoute);

  // JSON-RPC 2.0.
  app.use('/rpc', rpcRoute);

  // Server-Sent Events.
  app.use('/events', sseRoute);

  // Root index describing the API surface.
  app.get('/', (_req, res) => res.json({
    name: 'order-tracker-backend',
    description: 'Real-Time Order Tracker & Live Support System — CSC337 Lab 04',
    endpoints: {
      rest: ['/api/v1/catalog', '/api/v1/orders'],
      graphql: '/graphql (GraphiQL UI available in browser)',
      jsonrpc: '/rpc',
      sse: '/events',
      websocket: 'Socket.io on the same origin',
      health: '/health',
    },
  }));

  // Centralised error handler.
  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

module.exports = createApp;
