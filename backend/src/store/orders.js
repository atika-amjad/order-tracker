'use strict';

const { randomUUID } = require('node:crypto');
const bus = require('../eventBus');
const catalog = require('./catalog');

// Valid order statuses. 'cancelled' is reachable from any other state.
const STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];

const orders = [];

function round2(n) { return Math.round(n * 100) / 100; }
function totalOf(items) { return round2(items.reduce((sum, i) => sum + i.price * i.qty, 0)); }

function now() { return new Date().toISOString(); }

// Publish an order event to the bus plus a human-readable alert.
function publish(type, order, message) {
  const safe = serialize(order);
  bus.emit(`order:${type}`, safe);
  bus.emit('alert', { type, message, ts: now(), orderId: order.id });
}

// Return a deep-enough copy so callers cannot mutate internal state.
function serialize(order) {
  return {
    ...order,
    items: order.items.map((i) => ({ ...i })),
  };
}

// Seed a couple of sample orders so the UI has data on first load.
(function seed() {
  const base = Date.now() - 2 * 3600_000;
  orders.push({
    id: 'seed-1',
    customerName: 'Alice',
    items: [{ productId: 'p1', name: 'Wireless Mouse', qty: 1, price: 24.99 }],
    total: 24.99,
    status: 'confirmed',
    createdAt: new Date(base + 1800_000).toISOString(),
    updatedAt: new Date(base + 3600_000).toISOString(),
  });
  orders.push({
    id: 'seed-2',
    customerName: 'Bob',
    items: [
      { productId: 'p3', name: 'Mechanical Keyboard', qty: 1, price: 79.99 },
      { productId: 'p5', name: 'USB-C Cable', qty: 2, price: 9.99 },
    ],
    total: 99.97,
    status: 'preparing',
    createdAt: new Date(base).toISOString(),
    updatedAt: new Date(base + 3000_000).toISOString(),
  });
})();

module.exports = {
  STATUSES,

  list({ status } = {}) {
    return orders
      .filter((o) => !status || o.status === status)
      .map(serialize);
  },

  get(id) {
    const o = orders.find((x) => x.id === id);
    return o ? serialize(o) : null;
  },

  create({ customerName, items }) {
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      throw new Error('customerName is required');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('items must be a non-empty array');
    }
    const built = [];
    for (const it of items) {
      const p = catalog.get(it.productId);
      if (!p) throw new Error(`Unknown product: ${it.productId}`);
      const qty = Number(it.qty);
      if (!Number.isInteger(qty) || qty < 1) throw new Error(`Invalid qty for ${it.productId}`);
      if (p.stock < qty) throw new Error(`Insufficient stock for ${p.name}`);
      catalog.decrementStock(it.productId, qty);
      built.push({ productId: p.id, name: p.name, qty, price: p.price });
    }
    const order = {
      id: randomUUID(),
      customerName: customerName.trim(),
      items: built,
      total: totalOf(built),
      status: 'pending',
      createdAt: now(),
      updatedAt: now(),
    };
    orders.push(order);
    publish('created', order, `New order ${order.id.slice(0, 8)} placed by ${order.customerName}`);
    return serialize(order);
  },

  updateStatus(id, status) {
    if (!STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
    const o = orders.find((x) => x.id === id);
    if (!o) throw new Error('Order not found');
    if (o.status === 'cancelled') throw new Error('Cancelled orders cannot be updated');
    o.status = status;
    o.updatedAt = now();
    const type = status === 'cancelled' ? 'cancelled' : 'status';
    publish(type, o, `Order ${o.id.slice(0, 8)} is now ${status}`);
    return serialize(o);
  },

  cancel(id) {
    return this.updateStatus(id, 'cancelled');
  },
};
