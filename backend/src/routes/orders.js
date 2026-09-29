'use strict';

const express = require('express');
const orders = require('../store/orders');

const router = express.Router();

// GET /api/v1/orders?status=pending — list (optionally filtered by status).
router.get('/', (req, res) => {
  res.json(orders.list({ status: req.query.status }));
});

// GET /api/v1/orders/:id — one order.
router.get('/:id', (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  res.json(o);
});

// POST /api/v1/orders — create an order.
router.post('/', (req, res) => {
  try {
    const o = orders.create(req.body);
    res.status(201).json(o);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/v1/orders/:id/status — update order status.
router.patch('/:id/status', (req, res) => {
  try {
    const o = orders.updateStatus(req.params.id, req.body && req.body.status);
    res.json(o);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/v1/orders/:id — cancel an order.
router.delete('/:id', (req, res) => {
  try {
    const o = orders.cancel(req.params.id);
    res.json(o);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
