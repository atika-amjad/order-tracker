'use strict';

const express = require('express');
const bus = require('../eventBus');

const router = express.Router();

// Active SSE client responses.
const clients = new Set();

function broadcast(eventName, payload) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    // Honour an optional ?topic=alerts|orders filter.
    if (res.topic === 'alerts' && eventName !== 'alert') continue;
    if (res.topic === 'orders' && eventName === 'alert') continue;
    res.write(data);
  }
}

function attach(res, topic) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.topic = topic;
  res.write(`event: hello\ndata: ${JSON.stringify({ message: 'connected to live alert stream', ts: new Date().toISOString() })}\n\n`);
  clients.add(res);
}

// GET /events?topic=alerts|orders — open an SSE stream.
router.get('/', (req, res) => {
  const topic = req.query.topic; // undefined => all events
  attach(res, topic);

  // Keepalive heartbeat so proxies/Render don't idle-close the stream.
  const hb = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  res.on('close', () => {
    clearInterval(hb);
    clients.delete(res);
  });
});

// Subscribe to the event bus once (at module load). Store mutations publish
// 'alert' (human-readable) and 'order:created|status|cancelled' (the order).
bus.on('alert', (alert) => broadcast('alert', alert));
bus.on('order:created', (order) => broadcast('order', order));
bus.on('order:status', (order) => broadcast('order', order));
bus.on('order:cancelled', (order) => broadcast('order', order));

module.exports = router;
