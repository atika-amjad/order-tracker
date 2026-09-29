import { useEffect, useRef, useState } from 'react';
import { rest } from '../api/rest';
import { rpc } from '../api/rpc';
import { subscribeOrder } from '../api/socket';
import { useAlerts } from '../context/AlertsContext';

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];

export default function OrderTracker() {
  const [orders, setOrders] = useState([]);
  const [watchId, setWatchId] = useState('');
  const [watched, setWatched] = useState(null);
  const [err, setErr] = useState('');
  const unsubRef = useRef(null);
  const { alerts } = useAlerts();

  async function load() {
    try { setOrders(await rest.listOrders()); setErr(''); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { load(); }, []);

  // Live-subscribe to the watched order via Socket.io.
  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (!watchId) { setWatched(null); return; }
    setWatched(orders.find((o) => o.id === watchId) || null);
    unsubRef.current = subscribeOrder(watchId, (o) => setWatched(o));
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [watchId, orders]);

  async function advance(o) {
    const idx = STATUS_FLOW.indexOf(o.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    try { await rest.updateOrderStatus(o.id, next); await load(); }
    catch (e) { setErr(e.message); }
  }

  // Cancel via JSON-RPC to demonstrate the /rpc protocol from the UI.
  async function cancelRpc(o) {
    try { await rpc('cancelOrder', { orderId: o.id }); await load(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="panel">
      <h2>Order Tracker <span className="tag">WS + RPC</span></h2>
      <button className="btn ghost" onClick={load}>↻ Refresh</button>
      {err && <p className="error">{err}</p>}
      {alerts.length > 0 && <p className="small muted">Latest: {alerts[0].message}</p>}

      <label className="small" style={{ marginTop: 8, display: 'block' }}>Watch an order live (Socket.io):</label>
      <div className="row">
        <select value={watchId} onChange={(e) => setWatchId(e.target.value)}>
          <option value="">— select an order —</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.id.slice(0, 8)} · {o.customerName}</option>)}
        </select>
      </div>
      {watched && (
        <div className="card">
          <div className="top">
            <strong>{watched.id.slice(0, 8)}</strong>
            <span className={`badge ${watched.status}`}>{watched.status}</span>
          </div>
          <div className="small muted">Live status via WebSocket · updated {new Date(watched.updatedAt).toLocaleTimeString()}</div>
        </div>
      )}

      <h3>All orders</h3>
      {orders.length === 0 && <p className="empty">No orders yet.</p>}
      <ul className="orders">
        {orders.map((o) => (
          <li key={o.id}>
            <div className="row">
              <strong>{o.id.slice(0, 8)}</strong>
              <span className="small muted">{o.customerName}</span>
              <span className={`badge ${o.status}`}>{o.status}</span>
              <span className="small muted">${o.total.toFixed(2)}</span>
              <span className="right small muted">{o.items.length} item(s)</span>
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              {watched && watched.id === o.id && <span className="tag">● watching</span>}
              <button className="btn ghost" onClick={() => setWatchId(o.id)}>Watch</button>
              {o.status !== 'delivered' && o.status !== 'cancelled' && (
                <button className="btn" onClick={() => advance(o)}>→ next status</button>
              )}
              {o.status !== 'cancelled' && o.status !== 'delivered' && (
                <button className="btn danger" onClick={() => cancelRpc(o)}>Cancel (RPC)</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
