'use strict';

// In-memory product catalog with seed data.
const products = [
  { id: 'p1', name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse', price: 24.99, stock: 50, category: 'Peripherals' },
  { id: 'p2', name: 'HD Monitor', description: '27" 1080p IPS display', price: 199.99, stock: 20, category: 'Displays' },
  { id: 'p3', name: 'Mechanical Keyboard', description: 'Hot-swappable RGB keyboard', price: 79.99, stock: 35, category: 'Peripherals' },
  { id: 'p4', name: 'Laptop Stand', description: 'Aluminium adjustable stand', price: 34.99, stock: 40, category: 'Accessories' },
  { id: 'p5', name: 'USB-C Cable', description: 'Braided 2m 100W charging cable', price: 9.99, stock: 100, category: 'Accessories' },
  { id: 'p6', name: 'Webcam', description: '1080p autofocus webcam', price: 59.99, stock: 25, category: 'Peripherals' },
];

module.exports = {
  list: () => products.map((p) => ({ ...p })),
  get: (id) => {
    const p = products.find((x) => x.id === id);
    return p ? { ...p } : null;
  },
  // Reduce stock for a product. Returns the updated product or null if not
  // enough stock / not found. Does NOT throw — callers decide how to react.
  decrementStock(id, qty) {
    const p = products.find((x) => x.id === id);
    if (!p) return null;
    if (p.stock < qty) return null;
    p.stock -= qty;
    return { ...p };
  },
};
