import { useEffect, useRef, useState } from 'react';
import { rest } from '../api/rest';
import { getSocket, joinChat, sendChat } from '../api/socket';

// Support-agent console: lists all orders, can update status, and can accept
// incoming support requests then chat with the customer over Socket.io.
export default function AgentPanel() {
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeRoom, setActiveRoom] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const reqMap = useRef(new Map());
  const cleanupRef = useRef(null);

  async function load() {
    try { setOrders(await rest.listOrders()); setErr(''); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => {
    load();
    const s = getSocket();
    s.emit('support:joinAgents');

    const onReq = (r) => {
      reqMap.current.set(r.roomId, r);
      setRequests((prev) => [...prev.filter((x) => x.roomId !== r.roomId), r]);
    };
    const onTaken = ({ roomId }) => {
      setRequests((prev) => prev.filter((x) => x.roomId !== roomId));
    };
    s.on('support:request', onReq);
    s.on('support:taken', onTaken);

    return () => { s.off('support:request', onReq); s.off('support:taken', onTaken); };
  }, []);

  useEffect(() => () => { if (cleanupRef.current) cleanupRef.current(); }, []);

  async function updateStatus(o, status) {
    try { await rest.updateOrderStatus(o.id, status); await load(); }
    catch (e) { setErr(e.message); }
  }

  function accept(r) {
    const s = getSocket();
    s.emit('support:accept', { roomId: r.roomId });
    setActiveRoom(r.roomId);
    setMessages([]);
    cleanupRef.current = joinChat(r.roomId, 'agent', 'Support Agent', (m) => {
      setMessages((prev) => [...prev, m]);
    });
    setRequests((prev) => prev.filter((x) => x.roomId !== r.roomId));
  }

  function send() {
    if (!text.trim() || !activeRoom) return;
    setMessages((prev) => [...prev, { sender: 'agent', name: 'Support Agent', text: text.trim(), ts: new Date().toISOString() }]);
    sendChat(activeRoom, text.trim());
    setText('');
  }

  return (
    <div className="grid grid-2">
      <div className="panel">
        <h2>🎧 Agent Console <span className="tag">REST + WS</span></h2>
        {err && <p className="error">{err}</p>}
        <button className="btn ghost" onClick={load}>↻ Refresh orders</button>

        <h3>Incoming support requests ({requests.length})</h3>
        {requests.length === 0 && <p className="empty">No pending requests. Open the Live Support tab and request support.</p>}
        {requests.map((r) => (
          <div className="card" key={r.roomId}>
            <div><strong>{r.customerName}</strong> <span className="small muted">{r.orderId ? `order ${r.orderId.slice(0, 8)}` : 'no order'}</span></div>
            <button className="btn" style={{ marginTop: 4 }} onClick={() => accept(r)}>Accept chat</button>
          </div>
        ))}

        <h3>Orders ({orders.length})</h3>
        <ul className="orders">
          {orders.map((o) => (
            <li key={o.id}>
              <div className="row">
                <strong>{o.id.slice(0, 8)}</strong>
                <span className="small muted">{o.customerName}</span>
                <span className={`badge ${o.status}`}>{o.status}</span>
                <span className="right small muted">${o.total.toFixed(2)}</span>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                {o.status !== 'delivered' && o.status !== 'cancelled' && (
                  <>
                    <button className="btn ghost" onClick={() => updateStatus(o, 'confirmed')}>confirm</button>
                    <button className="btn ghost" onClick={() => updateStatus(o, 'preparing')}>prepare</button>
                    <button className="btn ghost" onClick={() => updateStatus(o, 'shipped')}>ship</button>
                    <button className="btn ghost" onClick={() => updateStatus(o, 'delivered')}>deliver</button>
                    <button className="btn danger" onClick={() => updateStatus(o, 'cancelled')}>cancel</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>Active Chat</h2>
        {!activeRoom && <p className="empty">Accept a request to start chatting.</p>}
        {activeRoom && (
          <>
            <p className="small muted">Room: {activeRoom}</p>
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
              <input style={{ flex: 1 }} placeholder="Type a reply…" value={text}
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
              <button className="btn" onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
