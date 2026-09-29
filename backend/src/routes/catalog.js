'use strict';

const express = require('express');
const catalog = require('../store/catalog');

const router = express.Router();

// GET /api/v1/catalog — list all products.
router.get('/', (_req, res) => res.json(catalog.list()));

// GET /api/v1/catalog/:id — one product.
router.get('/:id', (req, res) => {
  const p = catalog.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

module.exports = router;
