'use strict';

// Single in-memory pub/sub bus. It is the integration spine between the
// mutation sources (REST, GraphQL, JSON-RPC) and the live channels (SSE +
// Socket.io). Every store mutation publishes here so all transports fan out
// identically regardless of which protocol the client used.
const { EventEmitter } = require('events');

const bus = new EventEmitter();
// SSE + socket subscribers can be many; raise the default ceiling.
bus.setMaxListeners(100);

module.exports = bus;
