'use strict';

const bus = require('../eventBus');

// Socket.io connection + event handling for:
//  - live order status updates (per-order rooms)
//  - 1-on-1 customer <-> support chat (per-room)
//  - support request routing to agents
function setupSockets(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id}`);

    // ---- Order status subscriptions -------------------------------------
    socket.on('subscribeOrder', (orderId) => {
      socket.join(`order:${orderId}`);
      socket.emit('subscribed', { room: `order:${orderId}` });
    });

    socket.on('unsubscribeOrder', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    // ---- 1-on-1 support chat -------------------------------------------
    socket.on('chat:join', ({ roomId, role, name }) => {
      socket.join(`chat:${roomId}`);
      socket.data.role = role || 'customer';
      socket.data.name = name || 'Guest';
      io.to(`chat:${roomId}`).emit('chat:joined', {
        roomId,
        participant: { id: socket.id, role: socket.data.role, name: socket.data.name },
      });
    });

    socket.on('chat:message', ({ roomId, text }) => {
      if (!roomId || typeof text !== 'string' || !text.trim()) return;
      const msg = {
        roomId,
        sender: socket.data.role || 'customer',
        name: socket.data.name || 'Guest',
        text: text.trim(),
        ts: new Date().toISOString(),
      };
      io.to(`chat:${roomId}`).emit('chat:message', msg);
    });

    socket.on('chat:typing', ({ roomId }) => {
      socket.to(`chat:${roomId}`).emit('chat:typing', {
        roomId,
        name: socket.data.name,
        ts: new Date().toISOString(),
      });
    });

    // ---- Support request routing (customer -> agents) ------------------
    socket.on('support:joinAgents', () => {
      socket.join('agents');
      socket.data.role = 'agent';
      socket.emit('support:agentsReady', { message: 'Joined the agents room' });
    });

    socket.on('support:request', ({ orderId, customerName, roomId }) => {
      const req = {
        orderId,
        customerName: customerName || 'Customer',
        roomId: roomId || `support:${Date.now()}`,
        ts: new Date().toISOString(),
      };
      socket.join(`chat:${req.roomId}`);
      io.to('agents').emit('support:request', req);
      socket.emit('support:queued', { roomId: req.roomId });
    });

    socket.on('support:accept', ({ roomId }) => {
      socket.join(`chat:${roomId}`);
      io.to(`chat:${roomId}`).emit('support:accepted', {
        roomId,
        agent: { id: socket.id, name: socket.data.name || 'Support Agent' },
        ts: new Date().toISOString(),
      });
      io.to('agents').emit('support:taken', { roomId });
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected ${socket.id}`);
    });
  });

  // ---- Relay store mutations (from the event bus) to socket clients ----
  // Per-order room gets the precise status update; everyone gets a list-refresh
  // event so the order tracker / agent panel can stay in sync.
  bus.on('order:created', (order) => {
    io.to(`order:${order.id}`).emit('order:statusUpdate', order);
    io.emit('order:created', order);
  });
  bus.on('order:status', (order) => {
    io.to(`order:${order.id}`).emit('order:statusUpdate', order);
    io.emit('order:updated', order);
  });
  bus.on('order:cancelled', (order) => {
    io.to(`order:${order.id}`).emit('order:statusUpdate', order);
    io.emit('order:updated', order);
  });
}

module.exports = setupSockets;
