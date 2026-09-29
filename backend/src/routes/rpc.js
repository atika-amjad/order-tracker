'use strict';

const express = require('express');
const catalog = require('../store/catalog');
const orders = require('../store/orders');

const router = express.Router();

// JSON-RPC 2.0 error codes (per the spec).
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function rpcError(code, message, data) {
  const e = new Error(message);
  e.rpcCode = code;
  e.rpcData = data;
  return e;
}

function makeError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', error, id: (id === undefined ? null : id) };
}

// Registered methods. Each is a pure function of `params` that uses the same
// store as REST + GraphQL, so side effects (event-bus fan-out) are identical.
const methods = {
  listCatalog: () => catalog.list(),
  getProduct: ({ id }) => {
    const p = catalog.get(id);
    if (!p) throw rpcError(METHOD_NOT_FOUND, `Product ${id} not found`);
    return p;
  },
  listOrders: ({ status } = {}) => orders.list({ status }),
  getOrder: ({ orderId }) => {
    const o = orders.get(orderId);
    if (!o) throw rpcError(METHOD_NOT_FOUND, `Order ${orderId} not found`);
    return o;
  },
  createOrder: ({ customerName, items }) => orders.create({ customerName, items }),
  updateOrderStatus: ({ orderId, status }) => orders.updateStatus(orderId, status),
  cancelOrder: ({ orderId }) => orders.cancel(orderId),
};

// Handle a single request object. Returns a response object, or null for a
// notification (no response should be sent).
function handleOne(req) {
  if (typeof req !== 'object' || req === null || Array.isArray(req)) {
    return makeError(null, INVALID_REQUEST, 'Invalid Request');
  }
  const { jsonrpc, method, params, id } = req;
  const isNotification = id === undefined || id === null;

  if (jsonrpc !== '2.0') {
    return isNotification ? null : makeError(id, INVALID_REQUEST, 'jsonrpc must be "2.0"');
  }
  if (typeof method !== 'string') {
    return isNotification ? null : makeError(id, INVALID_REQUEST, 'method must be a string');
  }

  const fn = methods[method];
  if (typeof fn !== 'function') {
    return isNotification ? null : makeError(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }

  try {
    const result = fn(params || {});
    // A request without an id is a notification: the server MUST NOT respond.
    if (isNotification) return null;
    return { jsonrpc: '2.0', result, id: (id === undefined ? null : id) };
  } catch (e) {
    if (e && e.rpcCode) {
      return isNotification ? null : makeError(id, e.rpcCode, e.message, e.rpcData);
    }
    return isNotification ? null : makeError(id, INVALID_PARAMS, e.message);
  }
}

// POST /rpc — accepts a single request object or a batch array.
router.post('/', (req, res) => {
  const payload = req.body;

  if (payload === undefined || payload === null) {
    return res.status(400).json(makeError(null, PARSE_ERROR, 'Parse error'));
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return res.status(400).json(makeError(null, INVALID_REQUEST, 'Invalid Request'));
    }
    const results = payload.map(handleOne).filter((r) => r !== null);
    if (results.length === 0) return res.status(204).end(); // all notifications
    return res.json(results);
  }

  const result = handleOne(payload);
  if (result === null) return res.status(204).end(); // notification
  return res.json(result);
});

module.exports = router;
