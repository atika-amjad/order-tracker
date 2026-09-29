// Socket.io singleton client. Connects to the backend (same origin in dev
// via the Vite proxy, or SOCKET_URL in production).
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL || undefined, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
  }
  return socket;
}

export function connect() {
  return getSocket();
}

// Subscribe to a single order's live status updates.
export function subscribeOrder(orderId, onUpdate) {
  const s = getSocket();
  s.emit('subscribeOrder', orderId);
  const handler = (order) => {
    if (order.id === orderId) onUpdate(order);
  };
  s.on('order:statusUpdate', handler);
  return () => {
    s.off('order:statusUpdate', handler);
    s.emit('unsubscribeOrder', orderId);
  };
}

// Join a 1-on-1 support chat room.
export function joinChat(roomId, role, name, onMessage, onTyping) {
  const s = getSocket();
  s.emit('chat:join', { roomId, role, name });
  const msgHandler = (m) => m.roomId === roomId && onMessage && onMessage(m);
  const typingHandler = (t) => t.roomId === roomId && onTyping && onTyping(t);
  s.on('chat:message', msgHandler);
  s.on('chat:typing', typingHandler);
  return () => {
    s.off('chat:message', msgHandler);
    s.off('chat:typing', typingHandler);
  };
}

export function sendChat(roomId, text) {
  getSocket().emit('chat:message', { roomId, text });
}

export function sendTyping(roomId) {
  getSocket().emit('chat:typing', { roomId });
}
