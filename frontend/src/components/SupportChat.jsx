import { useEffect, useRef, useState } from 'react';
import { rest } from '../api/rest';
import { joinChat, sendChat, sendTyping, getSocket } from '../api/socket';

// Customer-side live support chat. The customer requests support; an agent
// (AgentPanel tab) accepts and the two converse over Socket.io.
export default function SupportChat() {
  const [name, setName] = useState('');
  const [orderId, setOrderId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const cleanupRef = useRef(null);

  useEffect(() => () => { if (cleanupRef.current) cleanupRef.current(); }, []);

  function requestSupport() {
    if (!name.trim()) { setStatus('Enter your name first'); return; }
    const s = getSocket();
    const id = `support:${Date.now()}`;
    s.emit('support:request', { orderId: orderId || undefined, customerName: name, roomId: id });
    setRoomId(id);
    setStatus('Waiting for a support agent… (open the Agent tab and accept)');
    // Listen for acceptance.
    const onAccepted = () => { setAccepted(true); setStatus('Connected to an agent'); };
    s.on('support:accepted', onAccepted);
    // Start receiving chat messages for this room.
    cleanupRef.current = joinChat(id, 'customer', name, (m) => {
      setMessages((prev) => [...prev, m]);
    });
  }

  function send() {
    if (!text.trim() || !roomId) return;
    setMessages((prev) => [...prev, { sender: 'customer', name, text: text.trim(), ts: new Date().toISOString() }]);
    sendChat(roomId, text.trim());
    setText('');
  }

  return (
    <div className="panel">
      <h2>💬 Live Support Chat <span className="tag">Socket.io</span></h2>
      <p className="small muted">1-on-1 chat between customer and support agent over WebSockets. Open the <strong>Agent</strong> tab in another window to talk back.</p>

      {!roomId && (
        <div className="row" style={{ marginBottom: 8 }}>
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Order ID (optional)" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <button className="btn" onClick={requestSupport}>Request Support</button>
        </div>
      )}
      {status && <p className="small" style={{ color: 'var(--amber)' }}>{status}</p>}
      {accepted && <p className="success">Agent connected — you can chat now.</p>}

      {roomId && (
        <>
          <div className="chat-window">
            {messages.length === 0 && <p className="empty">No messages yet.</p>}
            {messages.map((m, i) => (
              <div className={`chat-msg ${m.sender}`} key={i}>
                <span className="who">{m.name || m.sender}</span> <span className="t">{new Date(m.ts).toLocaleTimeString()}</span>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="row">
            <input
              style={{ flex: 1 }}
              placeholder="Type a message…"
              value={text}
              onChange={(e) => { setText(e.target.value); sendTyping(roomId); }}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="btn" onClick={send}>Send</button>
          </div>
          <p className="small muted">Room: {roomId}</p>
        </>
      )}
    </div>
  );
}
