// End-to-end smoke test for all four protocols.
// Run AFTER the backend is listening, e.g.:
//   PORT=4011 node server.js      # in another shell
//   BASE_URL=http://localhost:4011 node tests/smoke.mjs
'use strict';

import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:4011';
const JSON_CT = { 'Content-Type': 'application/json' };

const passed = [];
const failed = [];
function assert(name, cond, extra = '') {
  if (cond) { passed.push(name); console.log('  PASS  ' + name + (extra ? '  ' + extra : '')); }
  else { failed.push(name); console.error('  FAIL  ' + name + (extra ? '  ' + extra : '')); }
}

async function post(path, body) {
  return fetch(BASE + path, { method: 'POST', headers: JSON_CT, body: JSON.stringify(body) });
}
async function j(res) { return res.json(); }

console.log('Target: ' + BASE);

// 1. Health ----------------------------------------------------------------
const health = await fetch(`${BASE}/health`);
assert('GET /health → 200', health.ok);

// 2. REST: catalog ---------------------------------------------------------
const catalog = await j(await fetch(`${BASE}/api/v1/catalog`));
assert('REST GET /api/v1/catalog', Array.isArray(catalog) && catalog.length > 0);
assert('REST catalog includes p1', catalog.some((p) => p.id === 'p1'));

// 3. REST: create order ----------------------------------------------------
const created = await j(await post('/api/v1/orders', { customerName: 'Smoke Test', items: [{ productId: 'p1', qty: 2 }] }));
assert('REST POST /api/v1/orders', !!created.id && created.status === 'pending', created.id);
const orderId = created.id;

// 4. REST: get order -------------------------------------------------------
const got = await j(await fetch(`${BASE}/api/v1/orders/${orderId}`));
assert('REST GET /api/v1/orders/:id', got.id === orderId);

// 5. REST: patch status ----------------------------------------------------
const patched = await j(await fetch(`${BASE}/api/v1/orders/${orderId}/status`, { method: 'PATCH', headers: JSON_CT, body: JSON.stringify({ status: 'confirmed' }) }));
assert('REST PATCH /api/v1/orders/:id/status', patched.status === 'confirmed');

// 6. GraphQL: query --------------------------------------------------------
const gqlCatalog = await j(await post('/graphql', { query: '{ catalog { id name price } }' }));
assert('GraphQL query { catalog }', !gqlCatalog.errors && gqlCatalog.data.catalog.length > 0);

// 7. GraphQL: mutation createOrder ----------------------------------------
const gqlCreate = await j(await post('/graphql', { query: 'mutation { createOrder(customerName:"GraphQL User", items:[{productId:"p3",qty:1}]) { id status total } }' }));
assert('GraphQL mutation createOrder', !gqlCreate.errors && gqlCreate.data.createOrder.id);

// 8. JSON-RPC: listOrders --------------------------------------------------
const rpcList = await j(await post('/rpc', { jsonrpc: '2.0', method: 'listOrders', id: 1 }));
assert('RPC listOrders', rpcList.jsonrpc === '2.0' && Array.isArray(rpcList.result));

// 9. JSON-RPC: cancelOrder -------------------------------------------------
const rpcCancel = await j(await post('/rpc', { jsonrpc: '2.0', method: 'cancelOrder', params: { orderId }, id: 2 }));
assert('RPC cancelOrder', rpcCancel.result && rpcCancel.result.status === 'cancelled');

// 10. JSON-RPC: method not found -------------------------------------------
const rpcNotFound = await j(await post('/rpc', { jsonrpc: '2.0', method: 'doesNotExist', id: 3 }));
assert('RPC method-not-found → -32601', rpcNotFound.error && rpcNotFound.error.code === -32601);

// 11. JSON-RPC: batch ------------------------------------------------------
const batch = await j(await post('/rpc', [
  { jsonrpc: '2.0', method: 'listOrders', id: 4 },
  { jsonrpc: '2.0', method: 'listCatalog', id: 5 },
]));
assert('RPC batch returns array', Array.isArray(batch) && batch.length === 2);

// 12. JSON-RPC: notification (no id) → 204 ----------------------------------
const notif = await post('/rpc', { jsonrpc: '2.0', method: 'listCatalog' });
assert('RPC notification → 204', notif.status === 204);

// 13. SSE: live alert ------------------------------------------------------
await (async () => {
  const res = await fetch(`${BASE}/events`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const seen = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for alert')), 6000);
    (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        if (buf.includes('event: alert')) { clearTimeout(timer); resolve(true); break; }
      }
    })().catch(reject);
  });
  // Trigger an alert by creating an order through REST.
  await post('/api/v1/orders', { customerName: 'SSE Trigger', items: [{ productId: 'p2', qty: 1 }] });
  try { await seen; assert('SSE alert received on /events', true); }
  catch (e) { assert('SSE alert received on /events', false, e.message); }
  await reader.cancel();
})();

// 14. Socket.io: 1-on-1 chat (two sockets — sender is excluded from its own
// broadcast, so the receiver must be a separate socket) ----------------
await (async () => {
  const customer = io(BASE, { transports: ['websocket'] });
  const agent = io(BASE, { transports: ['websocket'] });
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), 6000);
    let agentJoined = false;
    agent.on('connect', () => agent.emit('chat:join', { roomId: 'smoke-room', role: 'agent', name: 'Agent' }));
    agent.on('chat:joined', () => { agentJoined = true; });
    agent.on('chat:message', (m) => {
      if (m.text === 'hello from smoke') { clearTimeout(timer); resolve('ok'); }
    });
    customer.on('connect', () => customer.emit('chat:join', { roomId: 'smoke-room', role: 'customer', name: 'Smoke' }));
    customer.on('chat:joined', () => {
      // wait until the agent has joined the room too, then send.
      const trySend = () => agentJoined
        ? customer.emit('chat:message', { roomId: 'smoke-room', text: 'hello from smoke' })
        : setTimeout(trySend, 50);
      trySend();
    });
  });
  assert('Socket.io chat:message round-trip', result === 'ok');
  customer.disconnect(); agent.disconnect();
})();

// 15. Socket.io: live order status update ---------------------------------
await (async () => {
  const order = await j(await post('/api/v1/orders', { customerName: 'Socket Test', items: [{ productId: 'p4', qty: 1 }] }));
  const s = io(BASE, { transports: ['websocket'] });
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), 6000);
    s.on('connect', () => {
      s.emit('subscribeOrder', order.id);
      setTimeout(() => fetch(`${BASE}/api/v1/orders/${order.id}/status`, { method: 'PATCH', headers: JSON_CT, body: JSON.stringify({ status: 'shipped' }) }), 300);
    });
    s.on('order:statusUpdate', (o) => { if (o.id === order.id && o.status === 'shipped') { clearTimeout(timer); resolve('ok'); } });
  });
  assert('Socket.io order:statusUpdate', result === 'ok');
  s.disconnect();
})();

console.log(`\n=== ${passed.length} passed, ${failed.length} failed ===`);
if (failed.length) { console.error('FAILED:', failed); process.exit(1); }
